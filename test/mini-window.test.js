// Detached mini window (Windows path), with a mocked Electron.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { realpath, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
const mainPath = fileURLToPath(new URL('../src/main.cjs', import.meta.url));
const source = await readFile(mainPath, 'utf8'),
  require = createRequire(mainPath);
const scale = 1.3020833730697632;
async function launch(userData, platform = 'win32') {
  const handlers = new Map(),
    windows = [];
  let ready;
  class Window {
    constructor(options) {
      windows.push(this);
      this.options = options;
      this.opacity = options.opacity ?? 1;
      this.ignore = false;
      this.visible = options.show !== false;
      this.focused = 0;
      this.bounds = { x: 200, y: 100, width: options.width || 1180, height: options.height || 760 };
      this.frame = { left: 7, top: 30, right: 7, bottom: 7 };
      this.events = new Map();
      const self = this;
      this.sent = [];
      this.webContents = {
        send(name, ...args) {
          self.sent.push([name, ...args]);
          if (name === 'paint-probe')
            setTimeout(() => handlers.get('paint-ack')({ sender: self.webContents }, args[0]), 5);
        },
        setWindowOpenHandler() {},
        on() {},
        once() {},
        isDestroyed: () => false,
      };
    }
    on(name, fn) {
      this.events.set(name, fn);
    }
    async loadURL(url) {
      this.url = url;
    }
    getBounds() {
      return { ...this.bounds };
    }
    setBounds(b) {
      this.bounds = { ...this.bounds, ...b };
    }
    getContentBounds() {
      const { x, y, width, height } = this.bounds,
        f = this.frame;
      return { x: x + f.left, y: y + f.top, width: width - f.left - f.right, height: height - f.top - f.bottom };
    }
    setContentBounds(c) {
      const f = this.frame;
      this.bounds = { x: c.x - f.left, y: c.y - f.top, width: c.width + f.left + f.right, height: c.height + f.top + f.bottom };
    }
    getSize() { return [this.bounds.width, this.bounds.height]; }
    getContentSize() { const c = this.getContentBounds(); return [c.width, c.height]; }
    setMinimumSize() {}
    getMinimumSize() { return [1, 1]; }
    setSize(w, h) { this.setBounds({ width: w, height: h }); }
    setOpacity(v) { this.opacity = v; }
    setIgnoreMouseEvents(v) { this.ignore = v; }
    showInactive() { this.visible = true; }
    show() { this.visible = true; }
    hide() { this.visible = false; }
    focus() { this.focused++; }
    isMaximized() { return false; }
    isMinimized() { return false; }
    isDestroyed() { return false; }
    maximize() {}
    restore() {}
    minimize() {}
    setResizable() {}
  }
  const display = { id: 1, scaleFactor: scale, workArea: { x: 0, y: 0, width: 2560, height: 1400 } };
  const electron = {
    app: {
      getVersion: () => '0.131.0',
      requestSingleInstanceLock: () => true,
      on() {},
      getPath: () => userData,
      whenReady: () => ({ then: (fn) => { ready = fn(); return ready; } }),
      quit() {},
    },
    BrowserWindow: Window,
    ipcMain: { handle: (n, fn) => handlers.set(n, fn), on: (n, fn) => handlers.set(n, fn) },
    protocol: { registerSchemesAsPrivileged() {}, handle() {} },
    net: { fetch: async () => new Response('') },
    session: { defaultSession: { setPermissionRequestHandler() {} } },
    shell: {},
    dialog: { showErrorBox: (_t, e) => { throw new Error(e); } },
    screen: {
      getDisplayMatching: () => display,
      ...(platform !== 'win32' ? {} : { dipToScreenRect: (_w, r) => ({
        x: Math.round(r.x * scale),
        y: Math.round(r.y * scale),
        width: Math.round(r.width * scale),
        height: Math.round(r.height * scale),
      }) }),
    },
  };
  const proc = new Proxy(process, { get: (t, k) => (k === 'platform' ? platform : t[k]) });
  vm.runInNewContext(`(function(){${source}\n})()`, {
    require: (name) => (name === 'electron' ? electron : require(name)),
    __dirname: path.dirname(mainPath),
    structuredClone, process: proc, console, URL, Response, setTimeout, clearTimeout,
  });
  await ready;
  const main = { senderFrame: { url: 'localtone://app/index.html' } };
  const invoke = (name, ...args) => handlers.get(name)({ ...main, sender: windows[0].webContents }, ...args);
  return { invoke, handlers, windows };
}
test('detached mini swaps window visibility without resizing the main window', async () => {
  const dir = await realpath(await mkdtemp(path.join(tmpdir(), 'localtone-mini-window-')));
  try {
    const { invoke, handlers, windows } = await launch(path.join(dir, 'data'));
    const [main] = windows,
      before = main.getBounds();
    handlers.get('mini-sync')({ senderFrame: { url: 'localtone://app/index.html' } }, { trees: [], size: { width: 242, height: 360 } });
    const client = main.getContentBounds();
    const request = { width: 242, height: 363, clientWidth: client.width, clientHeight: client.height, scale, detached: true, report: true };
    const entered = await invoke('window-action', 'mini', request);
    assert.equal(entered.value, true);
    const mini = windows[1];
    assert.ok(mini, 'mini window created');
    assert.equal(mini.options.parent, main);
    assert.equal(mini.url, 'localtone://app/mini.html');
    assert.deepEqual(main.getBounds(), before, 'main window never resized');
    assert.equal(main.opacity, 0);
    assert.equal(main.ignore, true);
    assert.equal(mini.opacity, 1);
    assert.equal(mini.ignore, false);
    assert.ok(mini.sent.some(([name]) => name === 'mini-sync'), 'buffered mirror delivered after load');
    // Outer bottom-left corners coincide in physical pixels (same frame => same client corner).
    const phys = (r) => ({ x: Math.round(r.x * scale), bottom: Math.round(r.y * scale) + Math.round(r.height * scale), width: Math.round(r.width * scale), height: Math.round(r.height * scale) });
    const pm = phys(main.getBounds()),
      pn = phys(mini.getBounds());
    assert.equal(pn.x, pm.x);
    assert.equal(pn.bottom, pm.bottom, 'bottoms align in physical pixels');
    const frameH = pm.height - Math.round(client.height * scale);
    assert.ok(pn.height - frameH >= Math.ceil(363 * scale - 0.01), 'mini client tall enough');
    // Input from the mini window is validated and forwarded to the main renderer.
    const miniEvent = { sender: mini.webContents, senderFrame: { url: 'localtone://app/mini.html' } };
    handlers.get('mini-input')(miniEvent, { type: 'click', root: 0, path: [1, 2, 0], extra: 'x' });
    handlers.get('mini-input')(miniEvent, { type: 'key', key: 'm', ctrlKey: false });
    handlers.get('mini-input')(miniEvent, { type: 'click', root: 5, path: [] });
    handlers.get('mini-input')({ sender: main.webContents, senderFrame: { url: 'localtone://app/index.html' } }, { type: 'key', key: 'x' });
    const forwarded = main.sent.filter(([name]) => name === 'mini-input').map(([, input]) => JSON.parse(JSON.stringify(input)));
    assert.deepEqual(forwarded, [
      { type: 'click', root: 0, path: [1, 2, 0] },
      { type: 'key', key: 'm', code: '', ctrlKey: false, shiftKey: false, altKey: false, metaKey: false, repeat: false },
    ]);
    // Leaving mini swaps back; still no resize.
    const left = await invoke('window-action', 'mini', request);
    assert.equal(left.value, false);
    assert.deepEqual(main.getBounds(), before);
    assert.equal(main.opacity, 1);
    assert.equal(main.ignore, false);
    assert.equal(mini.opacity, 0);
    assert.equal(mini.ignore, true);
    // Mirror input is ignored outside mini mode.
    handlers.get('mini-input')(miniEvent, { type: 'key', key: 'm' });
    assert.equal(main.sent.filter(([name]) => name === 'mini-input').length, 2);
    // Entering again reuses the same window. Moving the mini window moves the full view
    // by the same amount when leaving mini (kept on screen).
    await invoke('window-action', 'mini', request);
    assert.equal(windows.length, 2);
    const placed = mini.getBounds();
    mini.setBounds({ x: placed.x + 120, y: placed.y - 80 });
    await invoke('window-action', 'mini', request);
    assert.deepEqual(main.getBounds(), { ...before, x: before.x + 120, y: before.y - 80 });
    // If Windows lands the mini window lower than requested, placement reads back and corrects.
    const setBounds = mini.setBounds.bind(mini);
    mini.setBounds = (b) => setBounds({ ...b, ...(b.y !== undefined ? { y: b.y + 2 } : {}) });
    await invoke('window-action', 'mini', request);
    {
      const pm2 = phys(main.getBounds()),
        pn2 = phys(mini.getBounds());
      assert.equal(pn2.bottom, pm2.bottom, 'corrected after a skewed placement');
    }
    mini.setBounds = setBounds;
    await invoke('window-action', 'mini', request);
    await invoke('window-action', 'mini', request);
    mini.setBounds({ x: -500, y: 5000 });
    await invoke('window-action', 'mini', request);
    const clamped = main.getBounds();
    assert.equal(clamped.x, 0);
    assert.equal(clamped.y + clamped.height, 1400);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
for (const platform of ['darwin', 'linux'])
  test(`detached mini on ${platform}: separate window, main never resized, follows moves`, async () => {
    const dir = await realpath(await mkdtemp(path.join(tmpdir(), 'localtone-mini-' + platform + '-')));
    try {
      const { invoke, handlers, windows } = await launch(path.join(dir, 'data'), platform);
      const [main] = windows,
        before = main.getBounds();
      handlers.get('mini-sync')({ senderFrame: { url: 'localtone://app/index.html' } }, { trees: [], size: { width: 242, height: 360 } });
      const client = main.getContentBounds();
      const request = { width: 242, height: 363, clientWidth: client.width, clientHeight: client.height, scale: 2, detached: true, report: true };
      assert.equal((await invoke('window-action', 'mini', request)).value, true);
      const mini = windows[1];
      assert.equal(mini.options.parent, undefined, 'stands on its own');
      assert.equal(mini.options.resizable, false);
      assert.deepEqual(main.getBounds(), before, 'main window never resized');
      // Client areas share the bottom-left corner.
      const mc = main.getContentBounds(), nc = mini.getContentBounds();
      assert.equal(nc.x, mc.x);
      assert.equal(nc.y + nc.height, mc.y + mc.height);
      assert.deepEqual([nc.width, nc.height], [242, 363]);
      if (platform === 'linux') {
        assert.equal(main.visible, false, 'linux hides the main window');
        assert.equal(mini.visible, true);
      } else {
        assert.equal(main.opacity, 0);
        assert.equal(main.ignore, true);
        assert.equal(mini.opacity, 1);
        assert.equal(mini.visible, true);
      }
      mini.setBounds({ x: mini.getBounds().x + 50, y: mini.getBounds().y - 30 });
      assert.equal((await invoke('window-action', 'mini', request)).value, false);
      assert.deepEqual(main.getBounds(), { ...before, x: before.x + 50, y: before.y - 30 });
      if (platform === 'linux') {
        assert.equal(main.visible, true);
        assert.equal(mini.visible, false);
      } else {
        assert.equal(main.opacity, 1);
        assert.equal(mini.opacity, 0);
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
