import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { realpath, mkdtemp, mkdir, copyFile, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
const mainPath=fileURLToPath(new URL('../src/main.cjs',import.meta.url));
const source=await readFile(mainPath,'utf8'),require=createRequire(mainPath);
async function launch(userData,music,dialogs={}) {
 const handlers=new Map(),events=new Map(),opened=[];let quitCount=0;let ready,windowInstance,assetHandler;
 class Window {constructor(options){windowInstance=this;this.visible=options.show!==false;this.size=[options.width,options.height];this.minimum=[options.minWidth,options.minHeight];this.webContents={capturePage:async()=>({toDataURL:()=> 'data:image/png;base64,snapshot'}),setWindowOpenHandler(){},on(){},send(name){dialogs.onSend?.(name,(channel,...args)=>handlers.get(channel)({senderFrame:{url:'localtone://app/index.html'}},...args));}};}on(name,fn){(this.events??=new Map()).set(name,fn);}requestClose(){let prevented=false;this.events.get('close')?.({preventDefault(){prevented=true;}});return prevented;}getBounds(){return {x:this.x??20,y:this.y??20,width:this.size[0],height:this.size[1]};}getNormalBounds(){return this.restoreBounds||this.getBounds();}setBounds(b){const next={...this.getBounds(),...b};this.x=next.x;this.y=next.y;this.size=[next.width,next.height];}setResizable(value){this.resizable=value;}setContentSize(w,h){this.size=[w+16,h+32];}isMaximized(){return !!this.maximized;}maximize(){this.restoreBounds=this.getBounds();this.maximized=true;this.setBounds({x:0,y:0,width:1920,height:1080});}unmaximize(){this.maximized=false;if(this.restoreBounds)this.setBounds(this.restoreBounds);}getSize(){return this.size;}getContentSize(){return [this.size[0]-16,this.size[1]-32];}setMinimumSize(w,h){this.minimum=[w,h];}setSize(w,h){this.size=[w,h];}show(){this.visible=true;}async loadURL(){await dialogs.onLoad?.((name,...args)=>handlers.get(name)({senderFrame:{url:'localtone://app/index.html'}},...args));}isDestroyed(){return false;}}
 const electron={
  app:{getVersion:()=>'0.81.0',requestSingleInstanceLock:()=>true,on:(name,fn)=>events.set(name,fn),getPath:()=>userData,whenReady:()=>({then:fn=>{ready=fn();return ready;}}),quit(){let prevented=false;events.get('before-quit')?.({preventDefault(){prevented=true;}});if(!prevented)quitCount++;}},BrowserWindow:Window,
  ipcMain:{handle:(name,fn)=>handlers.set(name,fn),on:(name,fn)=>handlers.set(name,fn)},protocol:{registerSchemesAsPrivileged(){},handle:(_scheme,handler)=>assetHandler=handler},net:{fetch:async url=>new Response(await readFile(new URL(url)))},session:{defaultSession:{setPermissionRequestHandler(){}}},shell:{trashItem:dialogs.trashItem||(()=>{throw Error('Trash mock not configured');}),openExternal:async url=>opened.push(url),showItemInFolder:target=>opened.push(target),openPath:async folder=>{opened.push(folder);return '';}},
  dialog:{showOpenDialog:async()=>({canceled:false,filePaths:[music]}),showErrorBox:(_title,error)=>{throw new Error(error);},...dialogs}
 };
 vm.runInNewContext(`(function(){${source}\n})()`,{require:name=>name==='electron'?electron:require(name),__dirname:path.dirname(mainPath),structuredClone,process,console,URL,Response,setTimeout,clearTimeout});await ready;
 const invoke=(name,...args)=>handlers.get(name)({senderFrame:{url:'localtone://app/index.html'}},...args);invoke.shutdown=async()=>{events.get('before-quit')({preventDefault(){}});const deadline=Date.now()+10000;while(!quitCount&&Date.now()<deadline)await new Promise(r=>setTimeout(r,10));assert.ok(quitCount);};invoke.quitCount=()=>quitCount;invoke.opened=opened;invoke.window=windowInstance;invoke.asset=(url,options={})=>assetHandler({url,method:'GET',headers:new Headers(),...options});return invoke;
}
import { stat, readdir } from 'node:fs/promises';
const song = (title, extra = {}) => JSON.stringify({ title, artist: 'Artist', album: 'Album', duration: 100, ...extra });
async function setup() {
  const dir = await realpath(await mkdtemp(path.join(tmpdir(), 'lt-storage-')));
  const music = path.join(dir, 'music'), data = path.join(dir, 'data');
  await mkdir(path.join(music, 'Artist', 'Album'), { recursive: true });
  for (const n of ['one', 'two', 'three']) await writeFile(path.join(music, 'Artist', 'Album', n + '.flac'), song(n));
  return { dir, music, data };
}
const readJson = async (f) => JSON.parse(await readFile(f, 'utf8'));
test('settings and ratings use the small state file and survive restart', async () => {
  const { dir, music, data } = await setup();
  try {
    let invoke = await launch(data, music);
    const added = await invoke('add-library', 'Music');
    assert.equal(added.state.tracks.length, 3);
    const id = added.state.tracks[0].id, collection = path.join(data, 'collection.json'), state = path.join(data, 'collection-state.json');
    const before = (await stat(collection)).mtimeMs;
    await new Promise((r) => setTimeout(r, 20));
    await invoke('rating', id, 4);
    await invoke('settings', { volume: 0.3, theme: 'slate' });
    assert.equal((await stat(collection)).mtimeMs, before, 'collection.json not rewritten for rating/settings');
    assert.equal((await readJson(state)).ratings[id], 4);
    assert.equal((await readJson(state)).settings.volume, 0.3);
    // rollback: invalid rating and invalid settings leave values unchanged
    await assert.rejects(invoke('rating', id, 3.5));
    assert.equal((await invoke('load')).ratings[id], 4);
    await assert.rejects(invoke('settings', { volume: 'loud' }));
    assert.equal((await invoke('load')).settings.volume, 0.3);
    // restart picks up light-only changes
    invoke = await launch(data, music);
    let loaded = await invoke('load');
    assert.equal(loaded.ratings[id], 4);
    assert.equal(loaded.settings.volume, 0.3);
    assert.equal(loaded.settings.theme, 'slate');
    // a full save writes both files; collection then contains the same values
    await invoke('playlist', { type: 'create', name: 'Keep', trackIds: [id] });
    const stored = await readJson(collection);
    assert.equal(stored.ratings[id], 4);
    assert.equal(stored.settings.volume, 0.3);
    assert.equal(stored.playlists[0].name, 'Keep');
    // collection.json edited later (e.g. restored backup) stays authoritative
    await new Promise((r) => setTimeout(r, 20));
    stored.ratings = { [id]: 2 };
    stored.settings.volume = 0.9;
    await writeFile(collection, JSON.stringify(stored));
    invoke = await launch(data, music);
    loaded = await invoke('load');
    assert.equal(loaded.ratings[id], 2);
    assert.equal(loaded.settings.volume, 0.9);
    // corrupt state file is ignored, collection still loads
    await writeFile(state, '{not json');
    await new Promise((r) => setTimeout(r, 20));
    invoke = await launch(data, music);
    assert.equal((await invoke('load')).ratings[id], 2);
    // read-only handlers still work
    assert.ok(await invoke('find-duplicates', 'metadata'));
    const leftovers = (await readdir(data)).filter((n) => n.endsWith('.tmp'));
    assert.deepEqual(leftovers, []);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
test('rescans keep ratings and refresh does not need snapshots', async () => {
  const { dir, music, data } = await setup();
  try {
    const invoke = await launch(data, music);
    const added = await invoke('add-library', 'Music'), lib = added.state.libraries[0], id = added.state.tracks[1].id;
    await invoke('rating', id, 5);
    await writeFile(path.join(music, 'Artist', 'Album', 'four.flac'), song('four'));
    const refreshed = await invoke('refresh-libraries');
    assert.equal(refreshed.state.tracks.length, 4);
    assert.equal(refreshed.state.ratings[id], 5);
    const rescanned = await invoke('rescan', lib.id);
    assert.equal(rescanned.state.tracks.filter((t) => !t.missing).length, 4);
    assert.equal(rescanned.state.ratings[id], 5);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
