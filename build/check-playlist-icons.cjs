const electron = require('electron');
const { app, BrowserWindow } = electron;
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const data = fs.mkdtempSync(path.join(os.tmpdir(), 'localtone-icons-ui-'));
fs.writeFileSync(
  path.join(data, 'collection.json'),
  JSON.stringify({
    libraries: [],
    tracks: [],
    playlists: [
      { id: 'favorites', name: 'FAVORITES', icon: 'heart', trackIds: [] },
      { id: 'recent', name: 'RECENTLY', icon: 'clock', trackIds: [] },
      { id: 'night', name: 'LATE NIGHT', icon: 'moon', trackIds: [] },
      {
        id: 'old',
        name: 'Original playlist',
        trackIds: [],
        dynamic: { enabled: true, libraryId: '', match: 'all', rules: [] },
      },
    ],
  }),
);
app.setPath('userData', data);
app.requestSingleInstanceLock = () => true;
app.disableHardwareAcceleration();
app.on('quit', () => {
  try {
    fs.rmSync(data, { recursive: true, force: true, maxRetries: 3, retryDelay: 40 });
  } catch (error) {
    console.warn('Temporary playlist UI data cleanup deferred:', error.code);
  }
});
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const errors = [];
process.on('uncaughtException', (e) => {
  console.error(e);
  app.exit(1);
});
setTimeout(() => {
  console.error('Playlist UI check timed out');
  app.exit(1);
}, 45000).unref();
let first = true;
app.on('browser-window-created', (_event, win) => {
  if (!first) return;
  first = false;
  win.webContents.on('console-message', (_e, details) => {
    if (details.level === 'error') errors.push(details.message);
  });
  win.webContents.once('did-finish-load', async () => {
    const js = (code) => win.webContents.executeJavaScript(code);
    try {
      win.webContents.setZoomFactor(1);
      win.setContentSize(1300, 820);
      for (
        let i = 0;
        i < 100 && (await js("document.documentElement.hasAttribute('data-booting')"));
        i++
      )
        await delay(50);
      assert.equal(await js("document.documentElement.hasAttribute('data-booting')"), false);
      assert.equal(
        await js("document.querySelector('#playlists .nav svg[data-icon=moon]')!==null"),
        true,
      );
      await js(
        "document.getElementById('add-playlist').click();document.getElementById('playlist-name').value='Night test'",
      );
      const geometry = () =>
        js(
          `(()=>{const ids=['playlist-settings-dialog','playlist-name','playlist-icon-trigger','playlist-dynamic'];return Object.fromEntries(ids.map(id=>{const r=document.getElementById(id).getBoundingClientRect();return [id,{x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom,right:r.right}]}));})()`,
        );
      const before = await geometry();
      assert.ok(before['playlist-settings-dialog'].height < 300);
      assert.ok(Math.abs(before['playlist-icon-trigger'].height - 28) < 0.05);
      assert.ok(Math.abs(before['playlist-icon-trigger'].y - before['playlist-name'].y) < 0.05);
      await js("document.getElementById('playlist-icon-trigger').click()");
      await delay(80);
      assert.deepEqual(await geometry(), before);
      assert.equal(
        await js("document.getElementById('playlist-icon-picker').matches(':popover-open')"),
        true,
      );
      assert.equal(
        await js(
          `(()=>{const p=document.getElementById('playlist-icon-picker'),r=p.getBoundingClientRect();return r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight&&[...p.querySelectorAll('[data-playlist-icon]')].every(b=>{const s=getComputedStyle(b);return s.borderTopWidth==='0px'&&s.backgroundColor==='rgba(0, 0, 0, 0)';});})()`,
        ),
        true,
      );
      if (process.env.UI_CHECK_CAPTURE)
        fs.writeFileSync(
          process.env.UI_CHECK_CAPTURE,
          (await win.webContents.capturePage()).toPNG(),
        );
      win.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Escape' });
      win.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Escape' });
      await delay(60);
      assert.equal(
        await js(
          "document.getElementById('playlist-settings-dialog').open && document.getElementById('playlist-icon-picker').hidden",
        ),
        true,
      );
      await js(
        "document.getElementById('playlist-icon-trigger').click();document.querySelector('[data-playlist-icon=moon]').click();document.getElementById('playlist-settings-form').requestSubmit()",
      );
      await delay(200);
      let saved = await js('window.localtone.load()');
      const created = saved.playlists.find((p) => p.name === 'Night test');
      assert.equal(created.icon, 'moon');
      assert.equal(await js("document.getElementById('playlist-settings-dialog').open"), false);
      await js(
        `(()=>{const b=[...document.querySelectorAll('#playlists .nav')].find(b=>b.textContent==='Night test');b.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true}));[...document.querySelectorAll('#context-menu button')].find(b=>b.textContent.includes('Playlist settings')).click();})()`,
      );
      assert.equal(
        await js("document.querySelector('#playlist-icon-trigger svg').dataset.icon"),
        'moon',
      );
      await js(
        "document.getElementById('playlist-icon-trigger').click();document.querySelector('[data-playlist-icon=star]').click();document.getElementById('playlist-settings-cancel').click()",
      );
      saved = await js('window.localtone.load()');
      assert.equal(saved.playlists.find((p) => p.id === created.id).icon, 'moon');
      // The palette also fits the short viewport with dynamic rules expanded.
      win.setMinimumSize(700, 500);
      win.setContentSize(1044, 560);
      await delay(80);
      await js(
        "document.getElementById('add-playlist').click();document.getElementById('playlist-dynamic').click();document.getElementById('playlist-icon-trigger').click()",
      );
      await delay(80);
      assert.equal(
        await js(
          "(()=>{const r=document.getElementById('playlist-icon-picker').getBoundingClientRect();return r.top>=8&&r.bottom<=innerHeight-8&&r.left>=8&&r.right<=innerWidth-8;})()",
        ),
        true,
      );
      await js(
        "document.getElementById('playlist-name').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}))",
      );
      assert.equal(await js("document.getElementById('playlist-icon-picker').hidden"), true);
      assert.deepEqual(errors, []);
      console.log(
        'PASS: real Electron layout, floating top layer, unboxed icons, short viewport, Escape, save, cancel and native persistence.',
      );
      for (const w of BrowserWindow.getAllWindows()) w.hide();
      app.quit();
    } catch (error) {
      console.error(error);
      app.exit(1);
    }
  });
});
const Module = require('node:module'),
  load = Module._load;
Module._load = function (name, ...args) {
  if (name === './portable.cjs')
    return { ...load.call(this, name, ...args), configurePortable() {} };
  if (name === 'electron')
    return {
      ...electron,
      BrowserWindow:
        process.platform === 'linux'
          ? class extends BrowserWindow {
              constructor(options) {
                super({
                  ...options,
                  webPreferences: { ...options.webPreferences, offscreen: true, sandbox: false },
                });
              }
            }
          : BrowserWindow,
      globalShortcut: { register: () => false, unregister() {}, unregisterAll() {} },
    };
  return load.call(this, name, ...args);
};
require(process.env.ICON_CHECK_APP || '../main.cjs');
Module._load = load;
