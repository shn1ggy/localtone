// Collection requests that overlap wait their turn instead of failing.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { realpath, mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
const mainPath = fileURLToPath(new URL('../src/main.cjs', import.meta.url));
const source = await readFile(mainPath, 'utf8'),
  require = createRequire(mainPath);
async function launch(userData, music) {
  const handlers = new Map();
  let ready;
  class Window {
    constructor() {
      this.webContents = { send() {}, setWindowOpenHandler() {}, on() {}, once() {}, isDestroyed: () => false };
    }
    on() {}
    async loadURL() {}
    getBounds() { return { x: 0, y: 0, width: 1200, height: 800 }; }
    getContentBounds() { return { x: 8, y: 30, width: 1184, height: 762 }; }
    getSize() { return [1200, 800]; }
    getContentSize() { return [1184, 762]; }
    setMinimumSize() {}
    setSize() {}
    setBounds() {}
    show() {}
    isMaximized() { return false; }
    isMinimized() { return false; }
    isDestroyed() { return false; }
  }
  const electron = {
    app: { getVersion: () => '1.1.0', requestSingleInstanceLock: () => true, on() {}, getPath: () => userData, whenReady: () => ({ then: (fn) => { ready = fn(); return ready; } }), quit() {} },
    BrowserWindow: Window,
    ipcMain: { handle: (n, fn) => handlers.set(n, fn), on: (n, fn) => handlers.set(n, fn) },
    protocol: { registerSchemesAsPrivileged() {}, handle() {} },
    net: { fetch: async () => new Response('') },
    session: { defaultSession: { setPermissionRequestHandler() {} } },
    shell: {},
    dialog: { showOpenDialog: async () => ({ canceled: false, filePaths: [music] }), showErrorBox: (_t, e) => { throw new Error(e); } },
  };
  vm.runInNewContext(`(function(){${source}\n})()`, {
    require: (name) => (name === 'electron' ? electron : require(name)),
    __dirname: path.dirname(mainPath),
    structuredClone, process, console, URL, Response, setTimeout, clearTimeout,
  });
  await ready;
  return (name, ...args) => handlers.get(name)({ senderFrame: { url: 'localtone://app/index.html' } }, ...args);
}
test('a playlist created during a library refresh waits and succeeds', async () => {
  const dir = await realpath(await mkdtemp(path.join(tmpdir(), 'localtone-lane-')));
  try {
    const music = path.join(dir, 'music');
    await mkdir(music);
    for (let i = 0; i < 40; i++)
      await writeFile(path.join(music, `song${i}.flac`), JSON.stringify({ title: 'Song ' + i, wait: 5 }));
    const invoke = await launch(path.join(dir, 'data'), music);
    await invoke('add-library', 'Music');
    // Overlap: refresh (holds the lane while it walks the folder), then create + settings.
    const refresh = invoke('refresh-libraries');
    const created = invoke('playlist', { type: 'create', name: 'During refresh' });
    const setting = invoke('settings', { volume: 0.4 });
    const [, state, settings] = await Promise.all([refresh, created, setting]);
    assert.equal(state.playlists.at(-1).name, 'During refresh');
    assert.equal(settings.volume, 0.4);
    // A failing request does not block the ones behind it.
    const bad = invoke('playlist', { type: 'rename', id: 'missing', name: 'x' });
    const good = invoke('playlist', { type: 'create', name: 'After failure' });
    await assert.rejects(bad, /Playlist not found/);
    assert.equal((await good).playlists.at(-1).name, 'After failure');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
