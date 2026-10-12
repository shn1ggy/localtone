// Real Chromium/native-window regression checks. Isolated data, never user music.
const electron = require('electron');
const { app, BrowserWindow, screen } = electron;
app.disableHardwareAcceleration();
if (process.env.UI_CHECK_SCALE)
  app.commandLine.appendSwitch('force-device-scale-factor', process.env.UI_CHECK_SCALE);
process.on('uncaughtException', (error) => {
  console.error(error);
  app.exit(1);
});
process.on('unhandledRejection', (error) => {
  console.error(error);
  app.exit(1);
});
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'localtone-ui-'));
app.setPath('userData', temporary);
// The check uses an isolated instance; no OS singleton socket is required.
app.requestSingleInstanceLock = () => true;
app.on('quit', () => {
  try {
    fs.rmSync(temporary, { recursive: true, force: true, maxRetries: 3, retryDelay: 40 });
  } catch (error) {
    console.warn('Temporary UI data cleanup deferred:', error.code);
  }
});
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const fail = (error) => {
  console.error(error);
  app.exit(1);
};
setTimeout(() => fail(Error('Native UI check timed out.')), 60000).unref();
app.on('browser-window-created', (_event, win) => {
  win.webContents.once('did-finish-load', async () => {
    try {
      win.setContentSize(1440, 1000);
      win.webContents.setZoomFactor(1);
      // Windows hosted runners disable OS animations. Exercise the animated branch explicitly.
      win.webContents.debugger.attach('1.3');
      await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia', {
        features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }],
      });
      await delay(100);
      const js = (code) => win.webContents.executeJavaScript(code);
      const geometry = () =>
        js(
          `(()=>{const result={};for(const id of ['empty-add','empty-import','view-albums','view-covers','view-tracks','sort','volume','queue']){const b=document.getElementById(id),r=b.getBoundingClientRect(),s=getComputedStyle(b);result[id]={x:r.x,y:r.y,width:r.width,height:r.height,font:s.fontSize,line:s.lineHeight,padding:s.padding,color:s.color,background:s.backgroundColor,text:b.textContent,weight:s.fontWeight,decoration:s.textDecorationLine};}return result;})()`,
        );
      console.log('UI_CHECK loaded');
      win.focus();
      const before = await geometry();
      for (const id of ['empty-add', 'empty-import']) {
        assert.equal(before[id].height, 28);
        assert.equal(before[id].font, '13px');
        assert.equal(before[id].line, '20px');
      }
      assert.equal(before['empty-add'].width, before['empty-import'].width);
      assert.equal(before['empty-add'].weight, before['empty-import'].weight);
      assert.equal(
        await js(
          "getComputedStyle(document.querySelector('#artist-list .browse-empty')).color === getComputedStyle(document.querySelector('#empty h2')).color",
        ),
        true,
      );
      await js("document.getElementById('empty-add').click()");
      assert.equal(await js("document.getElementById('library-create-name-row').hidden"), false);
      if (process.env.UI_CHECK_CAPTURE)
        fs.writeFileSync(
          process.env.UI_CHECK_CAPTURE.replace('.png', '-create.png'),
          (await win.webContents.capturePage()).toPNG(),
        );
      win.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'ESC' });
      await delay(60);
      assert.equal(await js("document.getElementById('library-settings-dialog').open"), false);
      const cancelled = await geometry();
      assert.equal(cancelled['empty-add'].text, 'Add library…');
      assert.notEqual(cancelled['empty-add'].color, cancelled['empty-add'].background);
      assert.equal(cancelled['empty-add'].decoration, 'none');
      await js(
        "document.getElementById('view-tracks').dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,clientX:600,clientY:40}))",
      );
      const menu = await js(
        "(()=>{const b=document.querySelector('#track-actions button'),m=document.getElementById('track-actions');return {height:b.getBoundingClientRect().height,font:getComputedStyle(b).fontSize,scroll:m.scrollHeight>m.clientHeight}})()",
      );
      assert.equal(menu.height, 28);
      assert.equal(menu.font, '12px');
      assert.equal(menu.scroll, false);
      await js("document.querySelector('#track-actions button').click()");
      assert.equal(await js("document.getElementById('context-menu').hidden"), true);
      console.log('UI_CHECK cancellation and menus passed');
      const bounds = win.getBounds();
      const start = Date.now();
      const stableBounds = () => {
        const actual = win.getBounds();
        for (const key of ['x', 'y', 'width', 'height'])
          assert.ok(
            Math.abs(actual[key] - bounds[key]) <= 1,
            `Window ${key} drifted: ${JSON.stringify(bounds)} → ${JSON.stringify(actual)}`,
          );
      };
      await js(
        "window.__queueRevealCalls=0;const panel=document.getElementById('queue-panel'),animate=panel.animate.bind(panel);panel.animate=(...args)=>{window.__queueRevealCalls++;return animate(...args)};void 0",
      );
      for (let cycle = 0; cycle < 10; cycle++) {
        await js("document.getElementById('queue').click()");
        await delay(350);
        if (process.platform === 'win32')
          assert.equal(
            await js('window.__queueRevealCalls'),
            cycle * 2 + 1,
            'Queue reveal must animate',
          );
        assert.equal(await js("document.body.classList.contains('queue-extended')"), true);
        await js("document.getElementById('queue').click()");
        await delay(350);
        stableBounds();
        await js(
          "document.body.dispatchEvent(new KeyboardEvent('keydown',{key:'m',bubbles:true,cancelable:true}))",
        );
        await delay(250);
        assert.equal(await js("document.body.classList.contains('mini-player')"), true);
        await js(
          "document.body.dispatchEvent(new KeyboardEvent('keydown',{key:'m',bubbles:true,cancelable:true}))",
        );
        await delay(250);
        assert.equal(await js("document.body.classList.contains('mini-player')"), false);
        stableBounds();
      }
      const after = await geometry();
      for (const id of ['view-albums', 'view-covers', 'view-tracks', 'sort', 'volume', 'queue'])
        for (const key of ['x', 'y', 'width', 'height'])
          assert.ok(Math.abs(before[id][key] - after[id][key]) <= 1, `${id} ${key} shifted`);
      assert.equal(await js("document.body.classList.contains('window-transition')"), false);
      console.log('UI_CHECK native queue and mini passed');
      const music = path.join(temporary, 'Music');
      fs.mkdirSync(music);
      for (const name of ['song.mp3', 'preview.mp3'])
        fs.copyFileSync(path.join(root, 'test', 'fixtures', 'tone.mp3'), path.join(music, name));
      electron.dialog.showOpenDialog = async () => ({ canceled: true, filePaths: [] });
      await js(
        "document.getElementById('empty-add').click();document.getElementById('library-create-name').value='Music';document.getElementById('library-exclude-names').value='*preview*';document.getElementById('library-settings-form').requestSubmit(document.getElementById('library-settings-save'))",
      );
      await delay(100);
      assert.equal(await js("document.getElementById('library-settings-dialog').open"), true);
      assert.equal(await js('(async()=> (await localtone.load()).libraries.length)()'), 0);
      assert.equal(await js("document.getElementById('library-exclude-names').value"), '*preview*');
      electron.dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [music] });
      await js(
        "document.getElementById('library-settings-form').requestSubmit(document.getElementById('library-settings-save'))",
      );
      for (let i = 0; i < 100; i++) {
        if (
          await js(
            "!!document.querySelector('#libraries [data-source-kind]') && !document.getElementById('add-library').disabled",
          )
        )
          break;
        await delay(50);
      }
      await js(
        "document.querySelector('#libraries [data-source-kind]').dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,clientX:120,clientY:120}));[...document.querySelectorAll('#track-actions button')].find(b=>b.textContent==='Library settings…').click()",
      );
      if (process.env.UI_CHECK_CAPTURE) {
        await delay(100);
        win.webContents.invalidate();
        fs.writeFileSync(
          process.env.UI_CHECK_CAPTURE.replace('.png', '-library.png'),
          (await win.webContents.capturePage()).toPNG(),
        );
      }
      assert.equal(
        await js(
          "getComputedStyle(document.querySelector('#library-settings-dialog h2')).fontSize",
        ),
        '18px',
      );
      assert.equal(
        await js(
          "getComputedStyle(document.querySelector('#library-settings-dialog h3')).fontSize",
        ),
        '13px',
      );
      win.setContentSize(1440, 800);
      await delay(60);
      assert.equal(
        await js(
          "document.getElementById('library-settings-dialog').getBoundingClientRect().height <= window.innerHeight * .8",
        ),
        true,
      );
      win.setContentSize(1440, 1000);
      await delay(60);
      const centers = await js(
        "[...document.querySelectorAll('#library-settings-dialog .setting-row')].filter(row=>!row.hidden).map(row=>{const l=row.querySelector('label').getBoundingClientRect(),c=row.querySelector('input').getBoundingClientRect();return Math.abs(l.top+l.height/2-c.top-c.height/2);})",
      );
      assert.ok(centers.every((value) => value <= 0.5));
      const rows = await js(
        "[...document.querySelectorAll('#library-settings-dialog .setting-row input')].filter(b=>!b.closest('[hidden]')).map(b=>({width:b.getBoundingClientRect().width,height:b.getBoundingClientRect().height,font:getComputedStyle(b).fontSize,type:b.type}))",
      );
      for (const row of rows) {
        assert.equal(row.width, row.type === 'checkbox' ? 30 : 245);
        assert.equal(row.height, row.type === 'checkbox' ? 17 : 28);
        if (row.type !== 'checkbox') assert.equal(row.font, '13px');
      }
      assert.equal(
        await js("document.getElementById('library-settings-close').getBoundingClientRect().width"),
        28,
      );
      await js(
        "document.getElementById('library-exclude-names').value='*preview*';document.getElementById('library-settings-form').requestSubmit(document.getElementById('library-settings-save'))",
      );
      for (let i = 0; i < 100; i++) {
        if (!(await js("document.getElementById('library-settings-dialog').open"))) break;
        await delay(50);
      }
      assert.equal(
        await js(
          '(async()=>{const s=await localtone.load();return s.tracks.filter(t=>!t.excluded&&!t.missing).length})()',
        ),
        1,
      );
      await js(
        "HTMLMediaElement.prototype.play=async()=>{};document.getElementById('audio').onerror=null;document.getElementById('view-albums').click();document.querySelector('#libraries [data-source-kind]').dispatchEvent(new MouseEvent('dblclick',{bubbles:true}));void 0",
      );
      assert.equal(
        await js("!!document.querySelector('.album-section.album-playing .album-info')"),
        true,
      );
      const titleColor = await js(
        "getComputedStyle(document.querySelector('.album-playing .album-info')).color",
      );
      await js("document.querySelector('.album-side-cover, .album-expand .cover').click()");
      assert.equal(
        await js("getComputedStyle(document.querySelector('.album-playing .album-info')).color"),
        titleColor,
      );
      const menuMetrics = await js(
        "(()=>{document.querySelector('.album-expand').dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,clientX:600,clientY:120}));const m=document.getElementById('context-menu'),a=document.getElementById('track-actions');return {outer:m.scrollHeight>m.clientHeight,inner:a.scrollHeight>a.clientHeight,height:m.getBoundingClientRect().height}})()",
      );
      assert.equal(menuMetrics.outer, false);
      assert.equal(menuMetrics.inner, false);
      await js(
        "[...document.querySelectorAll('#track-actions button')].find(b=>b.dataset.playlistSubmenu).click()",
      );
      const fonts = await js(
        "({main:getComputedStyle(document.querySelector('#track-actions button')).fontSize,sub:getComputedStyle(document.querySelector('.playlist-submenu button')).fontSize})",
      );
      assert.equal(fonts.main, fonts.sub);
      await delay(100);
      if (process.env.UI_CHECK_CAPTURE)
        fs.writeFileSync(
          process.env.UI_CHECK_CAPTURE,
          (await win.webContents.capturePage()).toPNG(),
        );
      console.log(
        JSON.stringify({
          platform: process.platform,
          zoom: 1,
          queueRoundTripAndMiniChecks: true,
          milliseconds: Date.now() - start,
        }),
      );
      console.log('UI_CHECK library and album highlight passed');
      BrowserWindow.getAllWindows().forEach((window) => window.hide());
      app.quit();
    } catch (error) {
      fail(error);
    }
  });
});
const Module = require('node:module');
const load = Module._load;
Module._load = function (name, ...args) {
  if (name === './portable.cjs')
    return { ...load.call(this, name, ...args), configurePortable() {} };
  if (name !== 'electron') return load.call(this, name, ...args);
  const desktopScreen = Object.create(screen);
  Object.defineProperty(desktopScreen, 'getDisplayMatching', {
    value: (bounds) => ({
      ...screen.getDisplayMatching(bounds),
      workArea: { x: 0, y: 0, width: 4000, height: 2200 },
    }),
  });
  const native = Object.fromEntries(
    [
      'app',
      'ipcMain',
      'dialog',
      'protocol',
      'net',
      'session',
      'shell',
      'safeStorage',
      'globalShortcut',
    ].map((key) => [key, electron[key]]),
  );
  return {
    ...native,
    screen: desktopScreen,
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
  };
};
require('../main.cjs');
Module._load = load;
