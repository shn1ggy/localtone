import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { realpath, mkdtemp, mkdir, copyFile, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
const mainPath=fileURLToPath(new URL('../main.cjs',import.meta.url));
const source=await readFile(mainPath,'utf8'),require=createRequire(mainPath);
async function launch(userData,music,dialogs={}) {
 const handlers=new Map(),events=new Map(),opened=[];let quitCount=0;let ready,windowInstance,assetHandler;
 class Window {constructor(options){windowInstance=this;this.visible=options.show!==false;this.size=[options.width,options.height];this.minimum=[options.minWidth,options.minHeight];this.webContents={capturePage:async()=>({toDataURL:()=> 'data:image/png;base64,snapshot'}),setWindowOpenHandler(){},on(){},send(){}};}getBounds(){return {x:this.x??20,y:this.y??20,width:this.size[0],height:this.size[1]};}getNormalBounds(){return this.restoreBounds||this.getBounds();}setBounds(b){this.x=b.x;this.y=b.y;this.size=[b.width,b.height];}setResizable(value){this.resizable=value;}setContentSize(w,h){this.size=[w+16,h+32];}isMaximized(){return !!this.maximized;}maximize(){this.restoreBounds=this.getBounds();this.maximized=true;this.setBounds({x:0,y:0,width:1920,height:1080});}unmaximize(){this.maximized=false;if(this.restoreBounds)this.setBounds(this.restoreBounds);}getSize(){return this.size;}getContentSize(){return [this.size[0]-16,this.size[1]-32];}setMinimumSize(w,h){this.minimum=[w,h];}setSize(w,h){this.size=[w,h];}show(){this.visible=true;}async loadURL(){}isDestroyed(){return false;}}
 const electron={
  app:{getVersion:()=>'0.81.0',requestSingleInstanceLock:()=>true,on:(name,fn)=>events.set(name,fn),getPath:()=>userData,whenReady:()=>({then:fn=>{ready=fn();return ready;}}),quit(){let prevented=false;events.get('before-quit')?.({preventDefault(){prevented=true;}});if(!prevented)quitCount++;}},BrowserWindow:Window,
  ipcMain:{handle:(name,fn)=>handlers.set(name,fn),on:(name,fn)=>handlers.set(name,fn)},protocol:{registerSchemesAsPrivileged(){},handle:(_scheme,handler)=>assetHandler=handler},net:{fetch:async url=>new Response(await readFile(new URL(url)))},session:{defaultSession:{setPermissionRequestHandler(){}}},shell:{trashItem:dialogs.trashItem||(()=>{throw Error('Trash mock not configured');}),openExternal:async url=>opened.push(url),showItemInFolder:target=>opened.push(target),openPath:async folder=>{opened.push(folder);return '';}},
  dialog:{showOpenDialog:async()=>({canceled:false,filePaths:[music]}),showErrorBox:(_title,error)=>{throw new Error(error);},...dialogs}
 };
 vm.runInNewContext(`(function(){${source}\n})()`,{require:name=>name==='electron'?electron:require(name),__dirname:path.dirname(mainPath),structuredClone,process,console,URL,Response,setTimeout,clearTimeout});await ready;
 const invoke=(name,...args)=>handlers.get(name)({senderFrame:{url:'localtone://app/index.html'}},...args);invoke.shutdown=async()=>{events.get('before-quit')({preventDefault(){}});for(let i=0;i<200&&!quitCount;i++)await new Promise(r=>setTimeout(r,5));assert.ok(quitCount);};invoke.quitCount=()=>quitCount;invoke.opened=opened;invoke.window=windowInstance;invoke.asset=url=>assetHandler({url});return invoke;
}
test('ratings and settings survive rescans and main-process restart with real disk persistence',async()=>{
 const dir=await realpath(await mkdtemp(path.join(tmpdir(),'localtone-persistence-')));try{
  const userData=path.join(dir,'state'),music=path.join(dir,'music');await mkdir(music);await copyFile(new URL('./fixtures/tone.mp3',import.meta.url),path.join(music,'tone.mp3'));
  let invoke=await launch(userData,music);const added=await invoke('add-library','Music');const track=added.state.tracks[0],library=added.state.libraries[0];
  await invoke('rating',track.id,5);const albumKey=JSON.stringify([track.albumArtist,track.album]);const legacyPath=path.join(userData,'collection.json'),legacy=JSON.parse(await readFile(legacyPath,'utf8'));legacy.albumRatings={[albumKey]:4};await writeFile(legacyPath,JSON.stringify(legacy));invoke=await launch(userData,music);const columns=(await invoke('load')).settings.columns.map(c=>({...c,width:c.key==='title'?300:c.width,visible:c.key==='genre'?false:c.visible}));await invoke('settings',{columns});await invoke('settings',{queueDisplayCount:75,theme:'slate',coverSize:'large',shuffle:true,repeat:2,volume:.3,showColumnHeaders:false,sidebarLocked:true,artistLocked:true,backgroundHue:170,accentColor:'#aaccee',seekHeight:86,seekHeightLocked:true});await invoke('rescan',library.id);
  assert.equal((await invoke('load')).ratings[track.id],5);
  invoke=await launch(userData,music);const restored=await invoke('load');assert.equal(restored.ratings[track.id],5);assert.equal(restored.albumRatings[albumKey],4);assert.equal(restored.settings.columns.find(c=>c.key==='title').width,300);assert.equal(restored.settings.columns.find(c=>c.key==='genre').visible,false);assert.equal(restored.settings.theme,'slate');assert.equal(restored.settings.coverSize,'large');assert.equal(restored.settings.queueDisplayCount,75);assert.equal(restored.settings.volume,.3);assert.equal(restored.settings.shuffle,true);assert.equal(restored.settings.showColumnHeaders,false);for(const [key,value] of Object.entries({sidebarLocked:true,artistLocked:true,backgroundHue:170,accentColor:'#aaccee',seekHeight:86,seekHeightLocked:true}))assert.equal(restored.settings[key],value);
  await assert.rejects(invoke('rating',track.id,3.5),/whole-star/);assert.equal((await invoke('load')).ratings[track.id],5);
  await invoke('rating',track.id,0);assert.equal((await invoke('load')).ratings[track.id],undefined);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('legacy pending ratings survive rescans until an explicit rating writes the MP3',async()=>{
 const dir=await realpath(await mkdtemp(path.join(tmpdir(),'localtone-export-')));try{
  const userData=path.join(dir,'state'),music=path.join(dir,'music');await mkdir(music);const file=path.join(music,'tone.mp3');await copyFile(new URL('./fixtures/tone.mp3',import.meta.url),file);
  let invoke=await launch(userData,music);const added=await invoke('add-library','Music'),id=added.state.tracks[0].id;
  const dbPath=path.join(userData,'collection.json'),old=JSON.parse(await readFile(dbPath,'utf8'));old.ratings={[id]:4};delete old.ratingStorageVersion;delete old.pendingRatings;await writeFile(dbPath,JSON.stringify(old));
  invoke=await launch(userData,music);const migrated=await invoke('load');assert.equal(migrated.pendingRatings[id],4);await invoke('rescan',added.state.libraries[0].id);assert.equal((await invoke('load')).ratings[id],4);await invoke('rating',id,4);assert.equal((await invoke('load')).pendingRatings[id],undefined);
  const {default:ratingTags}=await import('../rating-tags.cjs');assert.equal(ratingTags.readRating(await readFile(file)),4);
  const fresh=await launch(path.join(dir,'fresh'),music);const imported=await fresh('add-library','Fresh');assert.equal(imported.state.ratings[imported.state.tracks[0].id],4);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('playlist order survives restart and malformed orders leave the collection intact',async()=>{
 const dir=await realpath(await mkdtemp(path.join(tmpdir(),'localtone-playlist-order-')));try{
  const userData=path.join(dir,'state');let invoke=await launch(userData,dir);
  await invoke('playlist',{type:'create',name:'First'});await invoke('playlist',{type:'create',name:'Second'});await invoke('playlist',{type:'create',name:'Third'});
  const ids=(await invoke('load')).playlists.map(p=>p.id),order=[ids[2],ids[0],ids[1]];
  await invoke('playlist',{type:'reorder',ids:order});invoke=await launch(userData,dir);
  assert.deepEqual(Array.from((await invoke('load')).playlists,p=>p.id),order);
  for(const invalid of [[ids[0],ids[0],ids[1]],[ids[0]],['unknown',ids[0],ids[1]]])await assert.rejects(invoke('playlist',{type:'reorder',ids:invalid}),/Invalid playlist order/);
  assert.deepEqual(Array.from((await invoke('load')).playlists,p=>p.id),order);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('folder artists derive from paths; deleting a library removes references but preserves music and settings',async()=>{
 const dir=await realpath(await mkdtemp(path.join(tmpdir(),'localtone-folders-')));try{
  const music=path.join(dir,'Music'),userData=path.join(dir,'state');
  const paths=['nine inch nails/Album/tone.mp3','nine inch nails b/Album/tone.mp3','root.mp3'];
  for(const name of paths){const file=path.join(music,name);await mkdir(path.dirname(file),{recursive:true});await copyFile(new URL('./fixtures/tone.mp3',import.meta.url),file);}
  const originals=await Promise.all(paths.map(name=>readFile(path.join(music,name))));
  let invoke=await launch(userData,music);const added=await invoke('add-library','Collection');const tracks=added.state.tracks,library=added.state.libraries[0];
  assert.deepEqual(Array.from(tracks,t=>t.folderArtist).sort(),['Music','nine inch nails','nine inch nails b']);assert.equal(new Set(tracks.map(t=>t.folderKey)).size,3);
  await invoke('playlist',{type:'create',name:'Mix'});const playlist=(await invoke('load')).playlists[0];await invoke('playlist',{type:'tracks',id:playlist.id,trackIds:tracks.map(t=>t.id)});
  await invoke('settings',{albumView:'covers',sidebarWidth:230,artistWidth:280});invoke=await launch(userData,music);
  let state=await invoke('load');assert.equal(state.settings.albumView,'covers');assert.equal(state.settings.sidebarWidth,230);assert.equal(state.settings.artistWidth,280);
  await invoke('delete-library',library.id);invoke=await launch(userData,music);state=await invoke('load');assert.equal(state.libraries.length,0);assert.equal(state.tracks.length,0);assert.equal(state.playlists[0].trackIds.length,0);
  for(let i=0;i<paths.length;i++)assert.deepEqual(await readFile(path.join(music,paths[i])),originals[i]);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('open-folder targets track, album and artist directories; view columns and album defaults persist',async()=>{
 const dir=await realpath(await mkdtemp(path.join(tmpdir(),'localtone-open-folder-')));try{
  const music=path.join(dir,'Music'),album=path.join(music,'Artist','Album'),disc=path.join(album,'Disc 2'),userData=path.join(dir,'state');await mkdir(disc,{recursive:true});await copyFile(new URL('./fixtures/tone.mp3',import.meta.url),path.join(disc,'Song.mp3'));
  let invoke=await launch(userData,music);const added=await invoke('add-library','Music'),id=added.state.tracks[0].id;
  for(const kind of ['track','album','artist'])await invoke('open-folder',{id,kind});assert.deepEqual(invoke.opened,[path.join(disc,'Song.mp3'),album,path.join(music,'Artist')]);await assert.rejects(invoke('open-folder',{id:'missing',kind:'track'}),/Track not found/);
  const settings=(await invoke('load')).settings,layouts=structuredClone(settings.columnsByView);layouts.tracks.find(c=>c.key==='genre').visible=true;layouts.tracks.find(c=>c.key==='duration').fixed=false;layouts.playlists.find(c=>c.key==='title').width=350;layouts.playlists.find(c=>c.key==='title').align='center';layouts.albums.reverse();
  await invoke('settings',{columnsByView:layouts,albumExpansion:'expanded'});invoke=await launch(userData,music);const saved=(await invoke('load')).settings;assert.equal(saved.albumExpansion,'expanded');assert.equal(saved.columnsByView.tracks.find(c=>c.key==='genre').visible,true);assert.deepEqual(saved.columnsByView.playlists,saved.columnsByView.tracks);assert.deepEqual(saved.columnsByView.albums,saved.columnsByView.tracks);assert.equal(saved.columnsByView.tracks.find(c=>c.key==='duration').fixed,false);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('dynamic playlists persist, update on ratings, reject manual additions, and freeze when disabled',async()=>{
 const dir=await realpath(await mkdtemp(path.join(tmpdir(),'localtone-dynamic-')));try{
 const music=path.join(dir,'music'),userData=path.join(dir,'state');await mkdir(music);await copyFile(new URL('./fixtures/tone.mp3',import.meta.url),path.join(music,'tone.mp3'));
 let invoke=await launch(userData,music);const added=await invoke('add-library','Music'),track=added.state.tracks[0];await invoke('playlist',{type:'create',name:'Favorites'});const id=(await invoke('load')).playlists[0].id;
 const dynamic={enabled:true,libraryId:track.libraryId,match:'all',rules:[{field:'rating',op:'gte',value:4}]};await invoke('playlist',{type:'configure',id,dynamic});assert.equal((await invoke('load')).playlists[0].trackIds.length,0);
 await invoke('rating',track.id,4);assert.equal((await invoke('load')).playlists[0].trackIds[0],track.id);await assert.rejects(invoke('playlist',{type:'tracks',id,trackIds:[]}),/filter rules/);
 invoke=await launch(userData,music);assert.equal((await invoke('load')).playlists[0].dynamic.enabled,true);await invoke('playlist',{type:'configure',id,dynamic:{...dynamic,enabled:false}});await invoke('rating',track.id,1);assert.equal((await invoke('load')).playlists[0].trackIds[0],track.id);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('atomic playlist creation saves browsing and empty rules; last listened and opening preference survive restart',async()=>{
 const dir=await realpath(await mkdtemp(path.join(tmpdir(),'localtone-create-')));try{
 const music=path.join(dir,'music'),userData=path.join(dir,'state');await mkdir(music);await copyFile(new URL('./fixtures/tone.mp3',import.meta.url),path.join(music,'tone.mp3'));
 let invoke=await launch(userData,music);const added=await invoke('add-library','Music'),track=added.state.tracks[0],dynamic={enabled:true,libraryId:track.libraryId,match:'all',rules:[{field:'rating',op:'isEmpty'}]};
 await invoke('playlist',{type:'create',name:'Unrated',browse:true,dynamic});assert.equal((await invoke('load')).playlists[0].trackIds[0],track.id);
 await assert.rejects(invoke('playlist',{type:'create',name:'Invalid',browse:'yes',dynamic}),/browsing/);assert.equal((await invoke('load')).playlists.length,1);
 await invoke('remember-played',track.id);await invoke('settings',{libraryOpening:'last',lastView:'tracks'});await assert.rejects(invoke('remember-played','missing'),/not found/);
 invoke=await launch(userData,music);let restored=await invoke('load');assert.equal(restored.settings.libraryOpening,'last');assert.equal(restored.settings.lastView,'tracks');assert.equal(restored.playbackHistory[track.libraryId],track.id);assert.equal(restored.playbackHistory.all,track.id);assert.equal(restored.playbackHistory['playlist:'+restored.playlists[0].id],track.id);assert.equal(restored.playlists[0].browse,true);
 const addedAt=restored.tracks[0].addedAt;assert.ok(addedAt>0);assert.ok(restored.tracks[0].modifiedAt>0);await invoke('rating',track.id,4);await invoke('rescan',track.libraryId);restored=await invoke('load');assert.equal(restored.tracks[0].addedAt,addedAt);assert.equal(restored.playlists[0].trackIds.length,0);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('batch tag IPC preflights all files, preserves independent titles, and rescans shared edits',async()=>{
 const dir=await realpath(await mkdtemp(path.join(tmpdir(),'localtone-batch-')));try{
  const NodeID3=require('node-id3'),music=path.join(dir,'Music');await mkdir(music);
  const fixture=await readFile(new URL('./fixtures/tone.mp3',import.meta.url));
  for(const title of ['One','Two'])await writeFile(path.join(music,title+'.mp3'),NodeID3.update({title,artist:'Shared'},fixture));
  const invoke=await launch(path.join(dir,'state'),music),added=await invoke('add-library','Music'),ids=added.state.tracks.map(t=>t.id);
  let entries=await invoke('read-tags-batch',ids);assert.equal(entries.length,2);
  const changed=path.join(music,'Two.mp3');await writeFile(changed,NodeID3.update({album:'External'},await readFile(changed)));
  const before=await readFile(path.join(music,'One.mp3'));
  await assert.rejects(invoke('write-tags-batch',entries,{genre:'Jazz'},[]),/changed since/);assert.deepEqual(await readFile(path.join(music,'One.mp3')),before);
  entries=await invoke('read-tags-batch',ids);const result=await invoke('write-tags-batch',entries,{genre:'Jazz'},[]);
  assert.equal(result.saved.length,2);assert.equal(result.failures.length,0);assert.deepEqual(Array.from(result.state.tracks,t=>t.title).sort(),['One','Two']);assert.ok(result.state.tracks.every(t=>t.genre==='Jazz'));
  assert.equal(NodeID3.read(await readFile(changed)).album,'External');
  entries=await invoke('read-tags-batch',ids);const proposals=entries.map(e=>({...e,patch:{year:e.values.title==='One'?'2009':'2010',track:e.values.title==='One'?'07/19':'08/19'}}));
  const merged=await invoke('write-tags-batch',proposals,{albumArtist:'Shared album artist'},[]);assert.equal(merged.failures.length,0);const reviewed=await invoke('read-tags-batch',ids);for(const entry of reviewed){assert.equal(entry.values.year,entry.values.title==='One'?'2009':'2010');assert.equal(entry.values.track,entry.values.title==='One'?'07/19':'08/19');assert.equal(entry.values.albumArtist,'Shared album artist');assert.equal(entry.values.genre,'Jazz');}
  const invalid=reviewed.map((e,i)=>({...e,patch:i?{unsupported:'value'}:{year:'2011'}}));await assert.rejects(invoke('write-tags-batch',invalid,{},[]),/Invalid tag changes/);await assert.rejects(invoke('write-tags-batch',reviewed,'invalid',[]),/Invalid tag edit/);assert.deepEqual(Array.from(await invoke('read-tags-batch',ids),e=>e.values.year),Array.from(reviewed,e=>e.values.year));

 }finally{await rm(dir,{recursive:true,force:true});}
});


test('desktop minimum includes window chrome and expands the window for wide panes',async()=>{
 const dir=await realpath(await mkdtemp(path.join(tmpdir(),'localtone-layout-')));try{
  const invoke=await launch(dir,dir);
  await invoke('layout-minimum',1388);
  assert.deepEqual(Array.from(invoke.window.minimum),[1404,772]);assert.equal(invoke.window.size[0],1404);
  await invoke('layout-minimum',1044);assert.equal(invoke.window.minimum[0],1060);assert.equal(invoke.window.size[0],1404);
  await invoke('layout-minimum',20);assert.equal(invoke.window.minimum[0],1060);
 }finally{await rm(dir,{recursive:true,force:true});}
});


test('window IPC toggles maximization and rejects unknown actions',async()=>{
 const dir=await realpath(await mkdtemp(path.join(tmpdir(),'localtone-window-')));try{
  const invoke=await launch(dir,dir);await invoke('window-action','maximize');assert.equal(invoke.window.isMaximized(),true);await invoke('window-action','maximize');assert.equal(invoke.window.isMaximized(),false);
  await assert.rejects(invoke('window-action','invalid'),/Invalid window action/);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('playback position and origin survive a disk restart',async()=>{
 const dir=await realpath(await mkdtemp(path.join(tmpdir(),'localtone-resume-')));try{const data=path.join(dir,'data'),music=path.join(dir,'music');await mkdir(music);await copyFile(new URL('./fixtures/tone.mp3',import.meta.url),path.join(music,'tone.mp3'));let invoke=await launch(data,music);const added=await invoke('add-library','Music'),id=added.state.tracks[0].id,origin={kind:'library',id:added.state.libraries[0].id};await invoke('save-playback',{id,position:42.5,origin});invoke=await launch(data,music);assert.deepEqual(JSON.parse(JSON.stringify((await invoke('load')).playbackSession)),{id,position:42.5,origin});await invoke('save-playback',{id,position:-1});assert.equal((await invoke('load')).playbackSession.position,42.5);}finally{await rm(dir,{recursive:true,force:true});}
});

test('tag editing refreshes only its file and retains raw track metadata',async()=>{
 const dir=await realpath(await mkdtemp(path.join(tmpdir(),'localtone-target-tags-')));try{const data=path.join(dir,'data'),music=path.join(dir,'music');await mkdir(music);for(const name of ['one.mp3','two.mp3'])await copyFile(new URL('./fixtures/tone.mp3',import.meta.url),path.join(music,name));const invoke=await launch(data,music),added=await invoke('add-library','Music'),tracks=added.state.tracks;const target=tracks[0],other=tracks[1];const entry=await invoke('read-tags',target.id);await rm(path.join(music,other.relativePath));const out=await invoke('write-tags-batch',[{id:target.id,token:entry.token,extraKeys:[]}],{title:'Edited',track:'07/19'},[]);assert.equal(out.failures.length,0);assert.equal(out.state.tracks.length,2);assert.equal(out.state.tracks.find(t=>t.id===target.id).trackRaw,'07/19');assert.deepEqual(out.state.tracks.find(t=>t.id===other.id),other);}finally{await rm(dir,{recursive:true,force:true});}
});

test('mini player lowers native minimum and restores normal bounds',async()=>{const dir=await realpath(await mkdtemp(path.join(tmpdir(),'localtone-mini-')));try{const invoke=await launch(path.join(dir,'data'),dir),win=invoke.window,before=win.getBounds();const pendingSave=invoke('settings',{volume:.5});assert.equal(await invoke('window-action','mini'),true);await pendingSave;assert.deepEqual(win.getContentSize(),[320,436]);await invoke('layout-minimum',1044,740);assert.deepEqual(win.getContentSize(),[320,436]);assert.equal(await invoke('window-action','mini'),false);assert.deepEqual(win.getBounds(),before);assert.equal(win.resizable,true);}finally{await rm(dir,{recursive:true,force:true});}});

test('mini retains current pane width and bottom-left edge; M and F restore exact bounds',async()=>{
 const dir=await realpath(await mkdtemp(path.join(tmpdir(),'localtone-window-bounds-')));try{const invoke=await launch(path.join(dir,'data'),dir),win=invoke.window;win.setBounds({x:137,y:89,width:1250,height:850});const before=win.getBounds();await invoke('window-action','mini',{width:224,height:330});assert.deepEqual(win.getContentSize(),[224,330]);assert.equal(win.getBounds().x,before.x);assert.equal(win.getBounds().y+win.getBounds().height,before.y+before.height);await invoke('window-action','mini');assert.deepEqual(win.getBounds(),before);for(let i=0;i<2;i++){await invoke('window-action','maximize');assert.equal(win.isMaximized(),true);await invoke('window-action','maximize');assert.deepEqual(win.getBounds(),before);}await invoke('window-action','maximize');await invoke('window-action','mini',{width:260,height:365});await invoke('window-action','mini');assert.equal(win.isMaximized(),true);await invoke('window-action','maximize');assert.deepEqual(win.getBounds(),before);}finally{await rm(dir,{recursive:true,force:true});}
});
test('number formatting preserves other tags, existing totals and audio and only refreshes selected files',async()=>{
 const dir=await realpath(await mkdtemp(path.join(tmpdir(),'localtone-format-')));try{
 const music=path.join(dir,'music');await mkdir(music);const id3=require('node-id3'),frames=require('./tag-frames.cjs');
 for(const [name,number] of [['one','3'],['two','4/12']]){const file=path.join(music,name+'.mp3');await copyFile(new URL('./fixtures/tone.mp3',import.meta.url),file);id3.update({title:name,artist:'Keep artist',trackNumber:number,comment:{language:'eng',text:'Keep comment'}},file);}
 const invoke=await launch(path.join(dir,'state'),music),added=await invoke('add-library','Music');const one=added.state.tracks.find(t=>t.title==='one'),two=added.state.tracks.find(t=>t.title==='two');one.path=path.join(music,'one.mp3');two.path=path.join(music,'two.mp3');const before=await readFile(one.path),untouched=await readFile(two.path);
 let result=await invoke('format-track-numbers',[one.id],'pad');assert.equal(result.failures.length,0);assert.equal(id3.read(await readFile(one.path)).trackNumber,'03');assert.deepEqual(await readFile(two.path),untouched);
 result=await invoke('format-track-numbers',[one.id,two.id],'total');assert.equal(result.failures.length,0);const after=await readFile(one.path),tags=id3.read(after);assert.equal(tags.trackNumber,'03/12');assert.equal(tags.artist,'Keep artist');assert.equal(tags.comment.text,'Keep comment');assert.equal(id3.read(await readFile(two.path)).trackNumber,'4/12');assert.deepEqual(frames.parse(frames.tails(before).body).audio,frames.parse(frames.tails(after).body).audio);
 result=await invoke('format-track-numbers',[one.id,two.id],'total');assert.equal(result.saved.length,0);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('search result playlists create atomically with saved membership and output preferences persist',async()=>{
 const dir=await realpath(await mkdtemp(path.join(tmpdir(),'localtone-results-')));try{
 const music=path.join(dir,'music'),data=path.join(dir,'state');await mkdir(music);for(const name of ['one','two'])await copyFile(new URL('./fixtures/tone.mp3',import.meta.url),path.join(music,name+'.mp3'));
 let invoke=await launch(data,music);const added=await invoke('add-library','Music'),ids=Array.from(added.state.tracks,t=>t.id).reverse();
 const created=await invoke('playlist',{type:'create',name:'Search results',trackIds:ids,dynamic:{enabled:false,libraryId:'',match:'all',rules:[]}});assert.deepEqual(Array.from(created.playlists[0].trackIds),ids);
 await assert.rejects(invoke('playlist',{type:'create',name:'Invalid',trackIds:['missing']}),/Invalid search/);await assert.rejects(invoke('playlist',{type:'create',name:'Dynamic',trackIds:ids,dynamic:{enabled:true,libraryId:'',match:'all',rules:[]}}),/regular playlists/);
 await invoke('settings',{audioOutputId:'usb-test',audioOutputName:'USB audio'});invoke=await launch(data,music);const restored=await invoke('load');assert.equal(restored.playlists.length,1);assert.deepEqual(Array.from(restored.playlists[0].trackIds),ids);assert.equal(restored.settings.audioOutputId,'usb-test');assert.equal(restored.settings.audioOutputName,'USB audio');
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('settings transfer uses dialogs, backs up current preferences, and preserves collection and storage across restart',async()=>{
 const dir=await realpath(await mkdtemp(path.join(tmpdir(),'localtone-transfer-')));try{const userData=path.join(dir,'state'),music=path.join(dir,'music'),file=path.join(dir,'settings.json');await mkdir(music);let accepted=true;
 const invoke=await launch(userData,music,{showSaveDialog:async()=>({canceled:false,filePath:file}),showOpenDialog:async()=>({canceled:false,filePaths:[file]}),showMessageBox:async()=>({response:accepted?1:0})});await invoke('settings',{backgroundHue:155,queuePresentation:'extend'});await invoke('playlist',{type:'create',name:'Keep playlist'});await invoke('settings-transfer','export');const exported=JSON.parse(await readFile(file,'utf8'));assert.equal(exported.settings.backgroundHue,155);assert.equal(exported.settings.portable,undefined);
 await invoke('settings',{backgroundHue:222});accepted=false;assert.equal((await invoke('settings-transfer','import')).cancelled,true);assert.equal((await invoke('load')).settings.backgroundHue,222);accepted=true;await invoke('settings-transfer','import');const loaded=await invoke('load');assert.equal(loaded.settings.backgroundHue,155);assert.equal(loaded.playlists[0].name,'Keep playlist');assert.equal(loaded.settings.portable,true);const {readdir}=await import('node:fs/promises');const backups=await readdir(path.join(userData,'settings-backups'));assert.equal(backups.length,1);assert.equal(JSON.parse(await readFile(path.join(userData,'settings-backups',backups[0]),'utf8')).settings.backgroundHue,222);
 const restarted=await launch(userData,music);assert.equal((await restarted('load')).settings.queuePresentation,'extend');await writeFile(file,JSON.stringify({...exported,settings:{portable:false}}));await assert.rejects(invoke('settings-transfer','import'),/storage/);assert.equal((await invoke('load')).settings.portable,true);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('missing overview and reconnect preserve IDs, playlists, ratings and missing entries through rescans',async()=>{
 const dir=await realpath(await mkdtemp(path.join(tmpdir(),'localtone-repair-')));try{const data=path.join(dir,'data'),oldRoot=path.join(dir,'old'),newRoot=path.join(dir,'new');await mkdir(oldRoot);for(const name of ['one.mp3','two.mp3'])await copyFile(new URL('./fixtures/tone.mp3',import.meta.url),path.join(oldRoot,name));let chosen=oldRoot;const invoke=await launch(data,oldRoot,{showOpenDialog:async()=>({canceled:false,filePaths:[chosen]}),showMessageBox:async()=>({response:1})});const added=await invoke('add-library','Archive'),library=added.state.libraries[0],ids=added.state.tracks.map(t=>t.id);await invoke('playlist',{type:'create',name:'Keep',trackIds:ids});await invoke('rating',ids[0],4);const {rename}=await import('node:fs/promises');await rename(oldRoot,newRoot);const missing=await invoke('missing-files');assert.equal(missing.missing.length,2);assert.equal(missing.state.playlists[0].trackIds.length,2);await assert.rejects(invoke('rescan',library.id));chosen=newRoot;const fixed=await invoke('reconnect-library',library.id);assert.deepEqual(new Set(fixed.state.tracks.map(t=>t.id)),new Set(ids));assert.equal(fixed.state.ratings[ids[0]],4);assert.equal((await invoke('missing-files')).missing.length,0);
 await rm(path.join(newRoot,'two.mp3'));const rescanned=await invoke('rescan',library.id);assert.equal(rescanned.state.tracks.length,2);assert.equal(rescanned.state.tracks.filter(t=>t.missing).length,1);assert.equal(rescanned.state.playlists[0].trackIds.length,2);await copyFile(new URL('./fixtures/tone.mp3',import.meta.url),path.join(newRoot,'two.mp3'));const restored=await invoke('rescan',library.id);assert.deepEqual(new Set(restored.state.tracks.map(t=>t.id)),new Set(ids));assert.equal(restored.state.tracks.some(t=>t.missing),false);const restarted=await launch(data,newRoot);assert.equal((await restarted('load')).libraries[0].root,newRoot);
 const wrong=path.join(dir,'wrong');await mkdir(wrong);chosen=wrong;await assert.rejects(invoke('reconnect-library',library.id),/No matching/);assert.equal((await invoke('load')).libraries[0].root,newRoot);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('all renderer module imports are served by the real app protocol allowlist',async()=>{
 const dir=await realpath(await mkdtemp(path.join(tmpdir(),'localtone-module-startup-')));try{const invoke=await launch(path.join(dir,'data'),dir),pending=['localtone://app/renderer.js'],visited=new Set();while(pending.length){const url=pending.pop();if(visited.has(url))continue;visited.add(url);const response=await invoke.asset(url);assert.equal(response.status,200,'Blocked startup module: '+url);const code=await response.text();for(const match of code.matchAll(/\b(?:import|export)\s+(?:[^;]*?\s+from\s+)?['"]([^'"]+)['"]/g)){if(match[1].startsWith('.'))pending.push(new URL(match[1],url).href);}}assert.ok(visited.has('localtone://app/buffered-audio.js'));assert.ok(visited.has('localtone://app/core.js'));assert.equal((await invoke.asset('localtone://app/main.cjs')).status,404);assert.equal((await invoke.asset('localtone://app/../package.json')).status,404);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('animated mini commands serialize, ignore responsive minimum updates, and report final viewport',async()=>{const dir=await realpath(await mkdtemp(path.join(tmpdir(),'localtone-motion-')));try{const invoke=await launch(path.join(dir,'data'),dir),before=invoke.window.getBounds();const frames=[],setBounds=invoke.window.setBounds.bind(invoke.window);invoke.window.setBounds=b=>{frames.push({...b});setBounds(b);};const entering=invoke('window-action','mini',{width:224,height:330,animate:true,report:true});await new Promise(resolve=>setTimeout(resolve,40));await invoke('layout-minimum',1400,900);const restoring=invoke('window-action','mini',{animate:true,report:true});const first=await entering,last=await restoring;assert.equal(first.value,true);assert.deepEqual(Array.from(first.contentSize),[224,330]);assert.equal(last.value,false);assert.deepEqual(invoke.window.getBounds(),before);if(process.platform==='win32')assert.equal(frames.length,2);else assert.ok(frames.length>15);}finally{await rm(dir,{recursive:true,force:true});}});


test('web search builds only encoded DuckDuckGo URLs from known track metadata',async()=>{
 const dir=await realpath(await mkdtemp(path.join(tmpdir(),'localtone-web-')));try{
  const music=path.join(dir,'music');await mkdir(music);await copyFile(new URL('./fixtures/tone.mp3',import.meta.url),path.join(music,'tone.mp3'));
  const invoke=await launch(path.join(dir,'state'),music),added=await invoke('add-library','Music'),track=added.state.tracks[0];
  for(const kind of ['artist','album','track']){await invoke('search-web',{id:track.id,kind});const url=new URL(invoke.opened.at(-1));assert.equal(url.origin,'https://duckduckgo.com');assert.ok(url.searchParams.get('q').startsWith('!g '));}
  await assert.rejects(invoke('search-web',{id:track.id,kind:'javascript:'}),/Invalid search/);await assert.rejects(invoke('search-web',{id:'missing',kind:'album'}),/Track not found/);
 }finally{await rm(dir,{recursive:true,force:true});}
});



test('file-browser playlist imports persist, deduplicate, preserve order and never scan unrelated files',async()=>{
 const dir=await realpath(await mkdtemp(path.join(tmpdir(),'localtone-file-drop-')));try{
  const music=path.join(dir,'music'),userData=path.join(dir,'state');await mkdir(music);const files=['a.mp3','b.mp3','unrelated.mp3'].map(name=>path.join(music,name));for(const file of files)await copyFile(new URL('./fixtures/tone.mp3',import.meta.url),file);
  let invoke=await launch(userData,music);await invoke('playlist',{type:'create',name:'Mix'});const id=(await invoke('load')).playlists[0].id;
  await invoke('import-playlist-files',id,[files[1],files[0],files[1]]);let state=await invoke('load');assert.equal(state.tracks.length,2);const stored=JSON.parse(await readFile(path.join(userData,'collection.json'),'utf8'));assert.deepEqual(stored.playlists[0].trackIds.map(id=>stored.tracks.find(t=>t.id===id).path),[files[1],files[0]]);
  await invoke('import-playlist-files',id,[files[0]]);assert.equal((await invoke('load')).tracks.length,2);invoke=await launch(userData,music);state=await invoke('load');assert.equal(state.playlists[0].trackIds.length,2);
  await invoke('playlist',{type:'configure',id,dynamic:{enabled:true,libraryId:'',match:'all',rules:[]}});await assert.rejects(invoke('import-playlist-files',id,[files[2]]),/regular playlist/);assert.equal((await invoke('load')).tracks.length,2);
  await assert.rejects(invoke('import-playlist-files',id+'bad',[files[2]]),/regular playlist/);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('per-file track proposals use the shared tag writer, back up MP3s and reject stale or invalid changes',async()=>{
 const dir=await realpath(await mkdtemp(path.join(tmpdir(),'localtone-album-numbers-')));try{const userData=path.join(dir,'state'),music=path.join(dir,'music');await mkdir(music);await copyFile(new URL('./fixtures/tone.mp3',import.meta.url),path.join(music,'song.mp3'));const invoke=await launch(userData,music);const result=await invoke('add-library','Music'),id=result.state.tracks[0].id;await invoke('rating',id,4);const [before]=await invoke('read-tags-batch',[id]);
 const saved=await invoke('write-tags-batch',[{id,token:before.token,patch:{track:'07/19'}}],{},[]);assert.deepEqual([...saved.saved],[id]);assert.equal(saved.failures.length,0);const [after]=await invoke('read-tags-batch',[id]);assert.equal(after.values.track,'07/19');for(const key of Object.keys(before.values))if(key!=='track')assert.equal(after.values[key],before.values[key]);assert.equal(saved.state.ratings[id],4);
 await assert.rejects(invoke('write-tags-batch',[{id,token:before.token,patch:{track:'08/19'}}],{},[]),/changed|modified/i);await assert.rejects(invoke('write-tags-batch',[{id,token:after.token,patch:{track:'20/19'}}],{},[]),/Invalid/);await assert.rejects(invoke('write-tags-batch',[{id,token:after.token,patch:{track:'08/19'}},{id,token:after.token,patch:{track:'09/19'}}],{},[]),/Invalid/);assert.equal((await invoke('read-tags',id)).values.track,'07/19');
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('native window stays hidden until the trusted renderer finishes initialization',async()=>{
 const dir=await realpath(await mkdtemp(path.join(tmpdir(),'localtone-startup-')));try{
  const invoke=await launch(dir,dir);assert.equal(invoke.window.visible,false);
  await invoke('load');assert.equal(invoke.window.visible,false);
  await invoke('ui-ready');assert.equal(invoke.window.visible,true);
 }finally{await rm(dir,{recursive:true,force:true});}
});


test('search-expression playlists persist through main-process restart and reject invalid syntax',async()=>{
 const dir=await realpath(await mkdtemp(path.join(tmpdir(),'localtone-search-playlist-')));try{
  const music=path.join(dir,'music'),data=path.join(dir,'state');await mkdir(music);await copyFile(new URL('./fixtures/tone.mp3',import.meta.url),path.join(music,'tone.mp3'));let invoke=await launch(data,music);await invoke('add-library','Music');
  const dynamic={enabled:true,libraryId:'',match:'all',rules:[],mode:'search',query:'missing:totaltracks OR rating:>=4'};const created=await invoke('playlist',{type:'create',name:'Needs totals',dynamic});assert.equal(created.playlists[0].dynamic.query,dynamic.query);
  await assert.rejects(invoke('playlist',{type:'create',name:'Invalid',dynamic:{...dynamic,query:'missing:unknown'}}),/Unknown/);invoke=await launch(data,music);const loaded=await invoke('load');assert.equal(loaded.playlists[0].dynamic.mode,'search');assert.equal(loaded.playlists[0].dynamic.query,dynamic.query);assert.equal(loaded.playlists.length,1);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('session tag snapshots support exact batch/rating undo and redo and are removed with legacy backups on exit',async()=>{
 const dir=await realpath(await mkdtemp(path.join(tmpdir(),'localtone-session-tags-')));try{const music=path.join(dir,'music'),data=path.join(dir,'data');await mkdir(music);for(const name of ['One','Two'])await copyFile(new URL('./fixtures/tone.mp3',import.meta.url),path.join(music,name+'.mp3'));const invoke=await launch(data,music),added=await invoke('add-library','Music'),ids=Array.from(added.state.tracks,t=>t.id),files=['One','Two'].map(n=>path.join(music,n+'.mp3')),original=await Promise.all(files.map(f=>readFile(f)));const entries=await invoke('read-tags-batch',ids),saved=await invoke('write-tags-batch',entries,{album:'Edited album'},[]);assert.ok(saved.undoToken);const undo=await invoke('restore-tag-edit',saved.undoToken,false);assert.ok(undo.state.tracks.every(t=>t.album!=='Edited album'));for(let i=0;i<files.length;i++)assert.deepEqual(await readFile(files[i]),original[i]);await invoke('restore-tag-edit',saved.undoToken,true);assert.ok((await invoke('load')).tracks.every(t=>t.album==='Edited album'));
 const rating=await invoke('rating',ids[0],5);assert.ok(rating.undoToken);assert.equal((await invoke('restore-tag-edit',rating.undoToken,false)).state.ratings[ids[0]],undefined);assert.equal((await invoke('restore-tag-edit',rating.undoToken,true)).state.ratings[ids[0]],5);
 const current=await readFile(files[0]);await writeFile(files[0],require('node-id3').update({title:'External edit'},current));await assert.rejects(invoke('restore-tag-edit',rating.undoToken,false),/changed after/);assert.equal(require('node-id3').read(await readFile(files[0])).title,'External edit');
 const {readdir}=await import('node:fs/promises'),backups=path.join(data,'tag-backups'),sessions=await readdir(backups),session=path.join(backups,sessions[0]),snapshots=await readdir(session);const snap=JSON.parse(await readFile(path.join(session,snapshots[0]),'utf8'));assert.ok(snap.before.head&&snap.before.hash);assert.ok((await readFile(path.join(session,snapshots[0]))).length<original[0].length);await writeFile(path.join(backups,'old-full-file.bak'),original[0]);await invoke.shutdown();await assert.rejects(readFile(path.join(backups,'old-full-file.bak')),/ENOENT/);await assert.rejects(readdir(backups),/ENOENT/);assert.ok((await readFile(files[0])).length>0);assert.ok((await readFile(path.join(data,'collection.json'))).length>0);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('renaming files and complete album folders preserves IDs, membership, content and restart, and supports undo/redo',async()=>{
 const dir=await realpath(await mkdtemp(path.join(tmpdir(),'localtone-file-names-')));try{const music=path.join(dir,'music'),data=path.join(dir,'data'),folder=path.join(music,'Artist','Old album');await mkdir(folder,{recursive:true});const id3=require('node-id3'),fixture=await readFile(new URL('./fixtures/tone.mp3',import.meta.url));await writeFile(path.join(folder,'old.mp3'),id3.update({title:'Song',artist:'Artist',album:'Album',year:'2009',trackNumber:'07/19'},fixture));await writeFile(path.join(folder,'cover.jpg'),'art');let invoke=await launch(data,music),added=await invoke('add-library','Music'),id=added.state.tracks[0].id;await invoke('playlist',{type:'create',name:'Saved',trackIds:[id]});const original=await readFile(path.join(folder,'old.mp3')),config={files:true,folders:true,albumFormula:'%year% - %album%',trackFormula:'%tracknumber%. %title%'};await invoke('settings',{renameAlbumFormula:config.albumFormula,renameTrackFormula:config.trackFormula});const preview=await invoke('preview-file-names',[id],config);assert.equal(preview.count,2);const renamed=await invoke('apply-file-names',preview.token),newFolder=path.join(music,'Artist','2009 - Album'),newFile=path.join(newFolder,'07. Song.mp3');assert.deepEqual(await readFile(newFile),original);assert.equal(await readFile(path.join(newFolder,'cover.jpg'),'utf8'),'art');assert.equal(renamed.state.tracks[0].id,id);assert.equal(renamed.state.playlists[0].trackIds[0],id);assert.equal(renamed.state.tracks[0].relativePath,'Artist/2009 - Album/07. Song.mp3');await invoke('restore-file-names',renamed.undoToken,false);assert.deepEqual(await readFile(path.join(folder,'old.mp3')),original);await invoke('restore-file-names',renamed.undoToken,true);assert.deepEqual(await readFile(newFile),original);invoke=await launch(data,music);const state=await invoke('load');assert.equal(state.tracks[0].id,id);assert.equal(state.settings.renameAlbumFormula,config.albumFormula);await invoke('rescan',state.libraries[0].id);assert.equal((await invoke('load')).tracks[0].id,id);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('adding missing totals obeys the saved leading-zero switch without changing existing totals',async()=>{
 const dir=await realpath(await mkdtemp(path.join(tmpdir(),'localtone-total-zeros-')));try{const music=path.join(dir,'music');await mkdir(music);const id3=require('node-id3'),file=path.join(music,'song.mp3');await writeFile(file,id3.update({trackNumber:'1'},await readFile(new URL('./fixtures/tone.mp3',import.meta.url))));const invoke=await launch(path.join(dir,'data'),music),added=await invoke('add-library','Music'),id=added.state.tracks[0].id;await invoke('settings',{totalLeadingZeros:true});const saved=await invoke('format-track-numbers',[id],'total');assert.equal((await invoke('read-tags',id)).values.track,'01/01');await invoke('restore-tag-edit',saved.undoToken,false);await invoke('settings',{totalLeadingZeros:false});await invoke('format-track-numbers',[id],'total');assert.equal((await invoke('read-tags',id)).values.track,'1/1');
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('leading zeros pad both track and total while preserving other tags and audio',async()=>{const frames=require('./tag-frames.cjs');const dir=await realpath(await mkdtemp(path.join(tmpdir(),'localtone-pad-both-')));try{const music=path.join(dir,'music');await mkdir(music);const id3=require('node-id3'),file=path.join(music,'song.mp3'),before=id3.update({trackNumber:'7/9',title:'Unchanged',artist:'Keep'},await readFile(new URL('./fixtures/tone.mp3',import.meta.url)));await writeFile(file,before);const invoke=await launch(path.join(dir,'data'),music),added=await invoke('add-library','Music'),id=added.state.tracks[0].id;const result=await invoke('format-track-numbers',[id],'pad');const after=await readFile(file);assert.equal(id3.read(after).trackNumber,'07/09');assert.equal(id3.read(after).title,'Unchanged');assert.equal(id3.read(after).artist,'Keep');assert.deepEqual(frames.parse(frames.tails(before).body).audio,frames.parse(frames.tails(after).body).audio);assert.equal((await invoke('format-track-numbers',[id],'pad')).saved.length,0);await invoke('restore-tag-edit',result.undoToken,false);assert.equal((await invoke('read-tags',id)).values.track,'7/9');await invoke('settings',{tagFieldsExpanded:false,tagNumbersExpanded:false});const reopened=await launch(path.join(dir,'data'),music);assert.equal((await reopened('load')).settings.tagFieldsExpanded,false);assert.equal((await reopened('load')).settings.tagNumbersExpanded,false);}finally{await rm(dir,{recursive:true,force:true});}});

test('folder-search playlist history and conversion retain the same matches as browsing',async()=>{const dir=await realpath(await mkdtemp(path.join(tmpdir(),'localtone-folder-rules-')));try{const music=path.join(dir,'music');for(const artist of ['Alpha','Beta']){await mkdir(path.join(music,artist,'Album'),{recursive:true});await copyFile(new URL('./fixtures/tone.mp3',import.meta.url),path.join(music,artist,'Album','song.mp3'));}const invoke=await launch(path.join(dir,'data'),music);await invoke('add-library','Music');const dynamic={enabled:true,libraryId:'',match:'all',rules:[],mode:'search',query:'folder:Alpha'};let state=await invoke('playlist',{type:'create',name:'Alpha only',dynamic});const p=state.playlists[0],id=state.tracks.find(t=>t.folderArtist==='Alpha').id;assert.deepEqual([...p.trackIds],[id]);const history=await invoke('remember-played',id);assert.equal(history['playlist:'+p.id],id);state=await invoke('playlist',{type:'configure',id:p.id,name:p.name,dynamic:{...dynamic,enabled:false}});assert.deepEqual([...state.playlists[0].trackIds],[id]);}finally{await rm(dir,{recursive:true,force:true});}});

test('About reports the native version and update preparation preserves the collection through restart',async()=>{
 const dir=await realpath(await mkdtemp(path.join(tmpdir(),'localtone-update-main-')));try{
  const old=path.join(dir,'old-data'),next=path.join(dir,'next');await mkdir(next);
  for(const name of ['app','node_modules'])await mkdir(path.join(next,name));
  await writeFile(path.join(next,'package.json'),JSON.stringify({name:'localtone',version:'0.90.0'}));
  await writeFile(path.join(next,'main.cjs'),'New app');await writeFile(path.join(next,'app/index.html'),'New UI');
  const release=require('./release.cjs'),manifest=await release.createManifest(next,{version:'0.90.0',kind:'source',platform:'any',arch:'any',entry:'main.cjs',files:['package.json','main.cjs','app/index.html']});
  await writeFile(path.join(next,'localtone-release.json'),JSON.stringify(manifest));let accept=false;
  const invoke=await launch(old,dir,{showOpenDialog:async()=>({canceled:false,filePaths:[next]}),showMessageBox:async()=>({response:accept?0:1})});
  await invoke('playlist',{type:'create',name:'Saved playlist'});await invoke('settings',{accentColor:'#123456',artistWidth:271,confirmMultiFileTags:false});
  const info=await invoke('app-info');assert.equal(info.version,'0.81.0');assert.equal(info.dataFolder,old);assert.equal(info.storage,'Portable');assert.equal(info.packaged,false);assert.ok(!Object.hasOwn(info,'credentials'));
  await assert.rejects(invoke('about-action','other'),/Unknown About/);await invoke('about-action','open-data');assert.equal(invoke.opened.at(-1),old);
  assert.equal((await invoke('prepare-update')).cancelled,true);assert.equal((await readFile(path.join(old,'collection.json'),'utf8')).includes('Saved playlist'),true);
  accept=true;const result=await invoke('prepare-update');assert.equal(result.version,'0.90.0');
  const restored=await launch(path.join(next,'Localtone-data'),dir);const state=await restored('load');assert.equal(state.playlists[0].name,'Saved playlist');assert.equal(state.settings.accentColor,'#123456');assert.equal(state.settings.artistWidth,271);assert.equal(state.settings.confirmMultiFileTags,false);
  await assert.rejects(invoke('prepare-update'),/already has/);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('optional collection settings backup restores regular and search playlists without replacing existing data',async()=>{
 const dir=await realpath(await mkdtemp(path.join(tmpdir(),'localtone-collection-transfer-')));
 try {
  const music=path.join(dir,'music'),file=path.join(dir,'settings.json');await mkdir(music);await copyFile(new URL('./fixtures/tone.mp3',import.meta.url),path.join(music,'song.mp3'));
  const dialogs={showSaveDialog:async()=>({canceled:false,filePath:file}),showMessageBox:async()=>({response:1})};
  const source=await launch(path.join(dir,'source'),music,dialogs),added=await source('add-library','Archive'),track=added.state.tracks[0],lib=added.state.libraries[0];
  await source('playlist',{type:'create',name:'Songs',trackIds:[track.id]});await source('playlist',{type:'create',name:'Search',dynamic:{enabled:true,libraryId:lib.id,match:'all',rules:[],mode:'search',query:'artist IS MISSING'}});
  await source('settings',{exportCollections:true});await source('settings-transfer','export');
  const target=await launch(path.join(dir,'target'),music,{...dialogs,showOpenDialog:async()=>({canceled:false,filePaths:[file]})});await target('playlist',{type:'create',name:'Keep'});
  const imported=await target('settings-transfer','import');assert.equal(imported.state.libraries.length,1);assert.equal(imported.state.tracks.length,1);assert.equal(imported.state.playlists.length,3);assert.equal(imported.state.playlists[0].name,'Keep');assert.equal(imported.state.playlists[1].trackIds[0],imported.state.tracks[0].id);assert.equal(imported.state.playlists[2].dynamic.libraryId,imported.state.libraries[0].id);
  const restarted=await launch(path.join(dir,'target'),music);assert.equal((await restarted('load')).playlists.length,3);assert.equal((await restarted('load')).settings.exportCollections,true);
 } finally {await rm(dir,{recursive:true,force:true});}
});

test('browsing session and open queue survive restart independently of preferences',async()=>{
 const dir=await realpath(await mkdtemp(path.join(tmpdir(),'localtone-browse-session-')));
 try{const data=path.join(dir,'data'),music=path.join(dir,'music');await mkdir(music);const invoke=await launch(data,music);await invoke('playlist',{type:'create',name:'Last playlist'});const playlist=(await invoke('load')).playlists[0];const fixture={version:1,scope:{kind:'all'},view:'covers',pane:'artists',query:'',sort:'year',direction:1,seed:42,scroll:{content:740,artists:80,playlists:25,queue:100},expanded:[],groups:Object.fromEntries(['artists','tracks','albums','openedAlbums'].map(k=>[k,{keys:[],current:null,anchor:null}])),albumDetail:null,albumFocus:null,coverFocus:null,queueOpen:true,coverReturnScroll:44};
 const value={...fixture,scope:{kind:'playlist',id:playlist.id}};
 await invoke('save-browsing',value);const saved=JSON.parse(await readFile(path.join(data,'browsing-session.json'),'utf8'));assert.equal(saved.scope.id,playlist.id);assert.equal(saved.queueOpen,true);assert.equal(saved.scroll.content,740);assert.deepEqual(saved.window.bounds,invoke.window.getNormalBounds());
 const restarted=await launch(data,music);assert.deepEqual(JSON.parse(JSON.stringify((await restarted('load')).browsingSession)),saved);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('remove leading zeros changes number and total only, preserves audio and supports undo',async()=>{
 const dir=await realpath(await mkdtemp(path.join(tmpdir(),'localtone-unpad-')));
 try{const music=path.join(dir,'music'),file=path.join(music,'song.mp3');await mkdir(music);const id3=require('node-id3'),frames=require('./tag-frames.cjs'),before=id3.update({trackNumber:'007/019',title:'Keep',artist:'Keep artist'},await readFile(new URL('./fixtures/tone.mp3',import.meta.url)));await writeFile(file,before);
 const invoke=await launch(path.join(dir,'data'),music),added=await invoke('add-library','Music'),id=added.state.tracks[0].id,result=await invoke('format-track-numbers',[id],'unpad'),after=await readFile(file);
 assert.equal(id3.read(after).trackNumber,'7/19');assert.equal(id3.read(after).title,'Keep');assert.deepEqual(frames.parse(frames.tails(before).body).audio,frames.parse(frames.tails(after).body).audio);assert.equal((await invoke('format-track-numbers',[id],'unpad')).saved.length,0);
 await invoke('restore-tag-edit',result.undoToken,false);assert.equal((await invoke('read-tags',id)).values.track,'007/019');
 }finally{await rm(dir,{recursive:true,force:true});}
});


test('separate indexes refresh shared MP3 edits on restart and update rating and modified-date playlists',async()=>{
 const dir=await realpath(await mkdtemp(path.join(tmpdir(),'localtone-shared-')));
 try {
  const music=path.join(dir,'shared');await mkdir(music);
  const files=['edited.mp3','unchanged.mp3'].map(name=>path.join(music,name));
  const {utimes}=await import('node:fs/promises');
  const old=new Date(Date.now()-10*86400000);
  for(const file of files){await copyFile(new URL('./fixtures/tone.mp3',import.meta.url),file);await utimes(file,old,old);}
  const a=await launch(path.join(dir,'a'),music);await a('add-library','Shared');
  let b=await launch(path.join(dir,'b'),music);const initial=(await b('add-library','Shared')).state;
  const track=initial.tracks.find(t=>t.relativePath==='edited.mp3'),unchanged=initial.tracks.find(t=>t.relativePath==='unchanged.mp3');
  const rules=[{field:'rating',op:'gte',value:4},{field:'modifiedAt',op:'inLast',value:{amount:2,unit:'days'}}];
  const playlist=await b('playlist',{type:'create',name:'Recent favorites',dynamic:{enabled:true,libraryId:track.libraryId,match:'all',rules}});
  assert.equal(playlist.playlists[0].trackIds.length,0);
  const at=(await a('load')).tracks.find(t=>t.relativePath==='edited.mp3');await a('rating',at.id,5);
  await writeFile(files[0],require('node-id3').update({title:'Shared edit',genre:'Ambient'},await readFile(files[0])));
  const edited=new Date();await utimes(files[0],edited,edited);
  b=await launch(path.join(dir,'b'),music);const refreshed=await b('load'),updated=refreshed.tracks.find(t=>t.id===track.id);
  assert.equal(refreshed.startupRefresh.changed,1);assert.equal(updated.title,'Shared edit');assert.equal(updated.genre,'Ambient');assert.equal(refreshed.ratings[track.id],5);assert.equal(updated.addedAt,track.addedAt);assert.ok(Math.abs(updated.modifiedAt-edited.getTime())<2);
  assert.deepEqual([...refreshed.playlists[0].trackIds],[track.id]);assert.equal(refreshed.tracks.find(t=>t.id===unchanged.id).modifiedAt,unchanged.modifiedAt);
  b=await launch(path.join(dir,'b'),music);assert.equal((await b('load')).startupRefresh.changed,0);
  await rm(files[0]);b=await launch(path.join(dir,'b'),music);assert.equal((await b('load')).tracks.find(t=>t.id===track.id).missing,true);
  await copyFile(new URL('./fixtures/tone.mp3',import.meta.url),files[0]);b=await launch(path.join(dir,'b'),music);const returned=await b('load');assert.equal(returned.tracks.find(t=>t.id===track.id).missing,false);assert.equal(returned.ratings[track.id],undefined);assert.equal(returned.playlists[0].trackIds.length,0);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('individual missing-file repair merges externally renamed duplicates, preserves references and forgets records without deleting music',async()=>{
 const dir=await realpath(await mkdtemp(path.join(tmpdir(),'localtone-repair-individual-')));
 try{
  const music=path.join(dir,'music'),data=path.join(dir,'data');await mkdir(music);const oldFile=path.join(music,'old.mp3'),newFile=path.join(music,'new.mp3'),{rename}=await import('node:fs/promises');await copyFile(new URL('./fixtures/tone.mp3',import.meta.url),oldFile);
  let choice=music,response=1,invoke=await launch(data,music,{showOpenDialog:async()=>({canceled:false,filePaths:[choice]}),showMessageBox:async()=>({response})});
  const initial=await invoke('add-library','Music'),old=initial.state.tracks[0],library=initial.state.libraries[0];await invoke('rating',old.id,4);await invoke('playlist',{type:'create',name:'Original',trackIds:[old.id]});
  await rename(oldFile,newFile);const rescanned=await invoke('rescan',library.id),replacement=rescanned.state.tracks.find(t=>!t.missing);assert.notEqual(replacement.id,old.id);await invoke('rating',replacement.id,5);await invoke('playlist',{type:'create',name:'New entry',trackIds:[replacement.id,old.id]});await invoke('remember-played',replacement.id);await invoke('save-playback',{id:replacement.id,position:12,origin:{kind:'all'}});
  const missing=await invoke('missing-files');assert.equal(missing.missing[0].candidates[0].id,replacement.id);
  response=0;assert.equal(await invoke('repair-missing-track',old.id,'reconnect',replacement.id),null);assert.equal((await invoke('load')).tracks.length,2);
  response=1;const fixed=await invoke('repair-missing-track',old.id,'reconnect',replacement.id);assert.equal(fixed.state.tracks.length,1);assert.equal(fixed.state.tracks[0].id,old.id);assert.equal(fixed.state.tracks[0].addedAt,old.addedAt);assert.equal(fixed.state.tracks[0].relativePath,'new.mp3');assert.equal(fixed.state.ratings[old.id],5);assert.equal(fixed.remap[replacement.id],old.id);for(const p of fixed.state.playlists)assert.deepEqual([...p.trackIds],[old.id]);assert.equal(fixed.state.playbackHistory.all,old.id);assert.equal(fixed.state.playbackSession.id,old.id);assert.equal((await invoke('missing-files')).missing.length,0);const preview=await invoke('preview-file-names',[old.id],{files:true,folders:false,trackFormula:'%title%',albumFormula:'%album%'});assert.ok(preview.token);
  await assert.rejects(invoke('repair-missing-track',old.id,'forget'),/available again/);
  const third=path.join(music,'third.mp3');await rename(newFile,third);choice=third;const located=await invoke('repair-missing-track',old.id,'reconnect');assert.equal(located.state.tracks[0].id,old.id);assert.equal(located.state.tracks[0].relativePath,'third.mp3');
  const fourth=path.join(music,'fourth.mp3');await rename(third,fourth);await invoke('rescan',library.id);const fresh=(await invoke('load')).tracks.find(t=>!t.missing),bytes=await readFile(fourth);const forgotten=await invoke('repair-missing-track',old.id,'forget');assert.equal(forgotten.state.tracks.length,1);assert.equal(forgotten.state.tracks[0].id,fresh.id);assert.ok(forgotten.state.playlists.every(p=>p.trackIds.length===0));assert.deepEqual(await readFile(fourth),bytes);
  invoke=await launch(data,music);assert.equal((await invoke('load')).tracks.length,1);assert.equal((await invoke('missing-files')).missing.length,0);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('startup and quiet directory refresh discover additions, hide deleted artists and preserve recoverable playlist references',async()=>{
 const dir=await realpath(await mkdtemp(path.join(tmpdir(),'localtone-directory-sync-')));
 try{
  const music=path.join(dir,'music'),data=path.join(dir,'data'),folder=path.join(music,'Deleted artist','Album');await mkdir(folder,{recursive:true});await copyFile(new URL('./fixtures/tone.mp3',import.meta.url),path.join(folder,'song.mp3'));
  let invoke=await launch(data,music);const initial=await invoke('add-library','Music'),id=initial.state.tracks[0].id;await invoke('playlist',{type:'create',name:'Keep refs',trackIds:[id]});await rm(path.join(music,'Deleted artist'),{recursive:true});
  const newFolder=path.join(music,'New artist','Album');await mkdir(newFolder,{recursive:true});await copyFile(new URL('./fixtures/tone.mp3',import.meta.url),path.join(newFolder,'new.mp3'));
  invoke=await launch(data,music);const state=await invoke('load'),core=await import('../app/core.js');assert.equal(state.tracks.find(t=>t.id===id).missing,true);assert.equal(state.tracks.length,2);assert.deepEqual([...state.playlists[0].trackIds],[id]);assert.equal(core.playlistTracks(state,state.playlists[0]).length,0);assert.deepEqual(Array.from(core.selectTracks(state,{kind:'all'},'','manual'),t=>t.folderArtist),['New artist']);assert.equal(core.matchingTracks(state,{enabled:true,libraryId:'',match:'all',rules:[]}).length,1);
  await rm(newFolder,{recursive:true});const refreshed=await invoke('refresh-libraries');assert.equal(refreshed.changed,true);assert.equal(core.selectTracks(refreshed.state,{kind:'all'},'','manual').length,0);assert.equal((await invoke('refresh-libraries')).changed,false);
  await mkdir(folder,{recursive:true});await copyFile(new URL('./fixtures/tone.mp3',import.meta.url),path.join(folder,'song.mp3'));const returned=await invoke('refresh-libraries');assert.equal(core.playlistTracks(returned.state,returned.state.playlists[0])[0].id,id);assert.equal(core.selectTracks(returned.state,{kind:'all'},'','manual').length,1);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('duplicate review IPC moves chosen files to Trash and preserves the keeper and remaining playlists through restart',async()=>{
 const dir=await realpath(await mkdtemp(path.join(tmpdir(),'localtone-duplicate-ipc-')));
 try{
  const music=path.join(dir,'music'),data=path.join(dir,'data'),trash=path.join(dir,'trash');await mkdir(music);await mkdir(trash);
  for(const name of ['first.mp3','second.mp3'])await copyFile(new URL('./fixtures/tone.mp3',import.meta.url),path.join(music,name));
  const {rename}=await import('node:fs/promises');let confirmations=0;
  let invoke=await launch(data,music,{showMessageBox:async()=>{confirmations++;return {response:1};},trashItem:file=>rename(file,path.join(trash,path.basename(file)))});
  const initial=await invoke('add-library','Music'),ids=Array.from(initial.state.tracks,t=>t.id);await invoke('playlist',{type:'create',name:'Mix',trackIds:ids});
  const review=await invoke('find-duplicates','exact');assert.equal(review.groups.length,1);assert.equal(review.groups[0].items.length,2);
  await assert.rejects(invoke('remove-duplicates',review.token,ids),/Keep at least one/);assert.equal(confirmations,0);
  const removedId=review.groups[0].items[1].id,removedName=path.basename(review.groups[0].items[1].path);
  const result=await invoke('remove-duplicates',review.token,[removedId]);assert.equal(confirmations,1);assert.deepEqual(Array.from(result.removed),[removedId]);assert.equal(result.state.tracks.length,1);assert.equal(result.state.playlists[0].trackIds.length,1);assert.ok(!result.state.playlists[0].trackIds.includes(removedId));assert.deepEqual(await readFile(path.join(trash,removedName)),await readFile(new URL('./fixtures/tone.mp3',import.meta.url)));
  invoke=await launch(data,music);const restored=await invoke('load');assert.equal(restored.tracks.length,1);assert.equal(restored.playlists[0].trackIds.length,1);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('disc tag presence uses persisted raw metadata and refreshes after edits',async()=>{
 const dir=await realpath(await mkdtemp(path.join(tmpdir(),'localtone-disc-tags-')));
 try{
  const music=path.join(dir,'music'),data=path.join(dir,'data');await mkdir(music);const file=path.join(music,'song.mp3');await copyFile(new URL('./fixtures/tone.mp3',import.meta.url),file);
  const id3=require('node-id3');assert.equal(id3.update({partOfSet:'02/03'},file),true);
  let invoke=await launch(data,music);const initial=await invoke('add-library','Music'),track=initial.state.tracks[0];assert.equal(track.discRaw,'02/03');assert.equal(track.disc,2);
  const core=await import('../app/core.js');assert.equal(core.selectTracks(initial.state,{kind:'all'},'has:disc','manual').length,1);
  const read=await invoke('read-tags',track.id);await invoke('write-tags',track.id,{...read.values,disc:''},read.token);const changed=await invoke('load');assert.equal(changed.tracks[0].discRaw,'');assert.equal(changed.tracks[0].disc,1);assert.equal(core.selectTracks(changed,{kind:'all'},'has:disc','manual').length,0);
  invoke=await launch(data,music);assert.equal((await invoke('load')).tracks[0].discRaw,'');
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('existing individually imported files read disc metadata once on startup without adding neighbors',async()=>{
 const dir=await realpath(await mkdtemp(path.join(tmpdir(),'localtone-imported-disc-')));
 try{
  const music=path.join(dir,'music'),data=path.join(dir,'data');await mkdir(music);const file=path.join(music,'song.mp3');await copyFile(new URL('./fixtures/tone.mp3',import.meta.url),file);assert.equal(require('node-id3').update({partOfSet:'02/03'},file),true);
  let invoke=await launch(data,music);await invoke('playlist',{type:'create',name:'Imported'});const id=(await invoke('load')).playlists[0].id;await invoke('import-playlist-files',id,[file]);
  const dbPath=path.join(data,'collection.json'),stored=JSON.parse(await readFile(dbPath,'utf8'));delete stored.tracks[0].discRaw;await writeFile(dbPath,JSON.stringify(stored));await copyFile(file,path.join(music,'neighbor.mp3'));
  invoke=await launch(data,music);const state=await invoke('load');assert.equal(state.tracks.length,1);assert.equal(state.tracks[0].discRaw,'02/03');assert.equal(state.playlists[0].trackIds.length,1);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('folder-order renumbering rejects partial albums, preserves tags/audio and supports undo',async()=>{
 const dir=await realpath(await mkdtemp(path.join(tmpdir(),'localtone-renumber-')));
 try{
  const music=path.join(dir,'music'),data=path.join(dir,'data'),album=path.join(music,'Artist','Album'),other=path.join(music,'Artist','Other');await mkdir(album,{recursive:true});await mkdir(other,{recursive:true});
  const id3=require('node-id3'),frames=require('./tag-frames.cjs'),fixture=await readFile(new URL('./fixtures/tone.mp3',import.meta.url));
  for(const [name,number] of [['10 Song.mp3','07/09'],['2 Song.mp3','05/09']])await writeFile(path.join(album,name),id3.update({title:name,trackNumber:number,artist:'Keep',comment:{language:'eng',text:'Keep comment'}},fixture));
  await writeFile(path.join(other,'song.mp3'),fixture);
  const invoke=await launch(data,music),initial=await invoke('add-library','Music'),selected=Array.from(initial.state.tracks).filter(t=>t.albumFolder==='Album'),ids=selected.map(t=>t.id),one=selected.find(t=>t.relativePath.endsWith('2 Song.mp3')),two=selected.find(t=>t.relativePath.endsWith('10 Song.mp3'));
  await assert.rejects(invoke('format-track-numbers',[one.id],'renumber'),/exactly one/);await assert.rejects(invoke('format-track-numbers',Array.from(initial.state.tracks,t=>t.id),'renumber'),/exactly one/);
  const before=await readFile(path.join(album,'2 Song.mp3')),result=await invoke('format-track-numbers',[...ids].reverse(),'renumber');assert.equal(result.saved.length,2);assert.equal((await invoke('read-tags',one.id)).values.track,'01/02');assert.equal((await invoke('read-tags',two.id)).values.track,'02/02');
  const after=await readFile(path.join(album,'2 Song.mp3'));assert.equal(id3.read(after).artist,'Keep');assert.equal(id3.read(after).comment.text,'Keep comment');assert.deepEqual(frames.parse(frames.tails(before).body).audio,frames.parse(frames.tails(after).body).audio);
  assert.equal((await invoke('format-track-numbers',ids,'renumber')).saved.length,0);await invoke('restore-tag-edit',result.undoToken,false);assert.equal((await invoke('read-tags',one.id)).values.track,'05/09');await invoke('restore-tag-edit',result.undoToken,true);assert.equal((await invoke('read-tags',one.id)).values.track,'01/02');
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('clearing a shared disc row removes different disc tags from every selected MP3 and supports undo',async()=>{
 const dir=await realpath(await mkdtemp(path.join(tmpdir(),'localtone-clear-mixed-disc-')));
 try{
  const music=path.join(dir,'music'),data=path.join(dir,'data');await mkdir(music);const id3=require('node-id3'),frames=require('./tag-frames.cjs'),fixture=await readFile(new URL('./fixtures/tone.mp3',import.meta.url));
  const originals=new Map();for(const [name,disc] of [['first.mp3','01/02'],['second.mp3','02/02']]){const bytes=id3.update({partOfSet:disc,title:name,trackNumber:'07/19',artist:'Keep artist'},fixture);await writeFile(path.join(music,name),bytes);originals.set(name,bytes);}
  const invoke=await launch(data,music),initial=await invoke('add-library','Music'),ids=Array.from(initial.state.tracks,t=>t.id),entries=await invoke('read-tags-batch',ids);
  const result=await invoke('write-tags-batch',Array.from(entries,e=>({id:e.id,token:e.token,extraKeys:[]})),{disc:''},[]);assert.equal(result.saved.length,2);
  for(const track of result.state.tracks){const bytes=await readFile(path.join(music,track.relativePath)),tags=id3.read(bytes);assert.ok(!tags.partOfSet);assert.equal(tags.trackNumber,'07/19');assert.equal(tags.artist,'Keep artist');assert.equal(tags.title,track.relativePath);assert.equal(track.discRaw,'');assert.deepEqual(frames.parse(frames.tails(originals.get(track.relativePath)).body).audio,frames.parse(frames.tails(bytes).body).audio);}
  await invoke('restore-tag-edit',result.undoToken,false);const restored=await invoke('read-tags-batch',ids);assert.deepEqual(Array.from(restored,e=>e.values.disc).sort(),['01/02','02/02']);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('quit is accepted during a library operation and waits for it to save before exit',async()=>{
 const dir=await realpath(await mkdtemp(path.join(tmpdir(),'localtone-quit-busy-')));
 try{const music=path.join(dir,'music'),data=path.join(dir,'data');await mkdir(music);await copyFile(new URL('./fixtures/tone.mp3',import.meta.url),path.join(music,'song.mp3'));let choose;const pending=new Promise(resolve=>choose=resolve);const invoke=await launch(data,music,{showOpenDialog:()=>pending});const adding=invoke('add-library','Music');await new Promise(resolve=>setImmediate(resolve));await invoke('window-action','quit');assert.equal(invoke.quitCount(),0);await assert.rejects(invoke('settings',{volume:.3}),/Localtone is updating your music or saving changes/);choose({canceled:false,filePaths:[music]});await adding;for(let i=0;i<200&&!invoke.quitCount();i++)await new Promise(r=>setTimeout(r,5));assert.equal(invoke.quitCount(),1);const saved=JSON.parse(await readFile(path.join(data,'collection.json'),'utf8'));assert.equal(saved.tracks.length,1);assert.equal(saved.libraries[0].name,'Music');}finally{await rm(dir,{recursive:true,force:true});}
});

test('sixty-file tag saves keep ordered outcomes, refreshed metadata and complete session undo',async()=>{
 const dir=await realpath(await mkdtemp(path.join(tmpdir(),'localtone-batch-sixty-')));try{const music=path.join(dir,'music'),data=path.join(dir,'data');await mkdir(music);const fixture=await readFile(new URL('./fixtures/tone.mp3',import.meta.url));await Promise.all(Array.from({length:60},(_,i)=>writeFile(path.join(music,String(i).padStart(2,'0')+'.mp3'),fixture)));const invoke=await launch(data,music),added=await invoke('add-library','Music'),ids=Array.from(added.state.tracks,t=>t.id),entries=await invoke('read-tags-batch',ids);const result=await invoke('write-tags-batch',entries,{genre:'Batch edit'},[]);assert.deepEqual(Array.from(result.saved),ids);assert.equal(result.failures.length,0);assert.equal(result.state.tracks.filter(t=>t.genre==='Batch edit').length,60);await invoke('restore-tag-edit',result.undoToken,false);for(const i of [0,30,59])assert.deepEqual(await readFile(path.join(music,String(i).padStart(2,'0')+'.mp3')),fixture);await invoke.shutdown();}finally{await rm(dir,{recursive:true,force:true});}
});


test('export/import/reconnect retains ordered playlists, dynamic rules, ratings and IDs across moved folders and old Windows backups',async()=>{
 const dir=await realpath(await mkdtemp(path.join(tmpdir(),'localtone-transfer-relocate-')));
 try{for(const legacy of [false,true]){
  const base=path.join(dir,legacy?'legacy':'current'),oldRoot=path.join(base,'old'),newRoot=path.join(base,'new'),backup=path.join(base,'settings.json');await mkdir(path.join(oldRoot,'Artist','Album'),{recursive:true});
  for(const name of ['a','b','c']){const filename=path.join(oldRoot,'Artist','Album',name+'.mp3');await copyFile(new URL('./fixtures/tone.mp3',import.meta.url),filename);assert.equal(require('node-id3').update({title:name,artist:'Artist',album:'Album'},filename),true);}
  const source=await launch(path.join(base,'source'),oldRoot,{showSaveDialog:async()=>({canceled:false,filePath:backup}),showMessageBox:async()=>({response:1})});const added=await source('add-library','Archive');const sourceIds=Object.fromEntries(added.state.tracks.map(t=>[t.title,t.id]));await source('rating',sourceIds.a,4);
  await source('playlist',{type:'create',name:'Ordered',trackIds:[sourceIds.c,sourceIds.a,sourceIds.c,sourceIds.b]});
  await source('playlist',{type:'create',name:'Rated',dynamic:{enabled:true,libraryId:added.state.libraries[0].id,match:'all',rules:[{field:'rating',op:'gte',value:4}]}});
  await source('playlist',{type:'create',name:'Search',dynamic:{enabled:true,libraryId:added.state.libraries[0].id,match:'all',rules:[],mode:'search',query:'title:a OR title:c'}});
  await source('settings',{exportCollections:true});await source('settings-transfer','export');let file=JSON.parse(await readFile(backup,'utf8'));assert.ok(file.collections.tracks.every(t=>t.size>0));
  if(legacy){file.collections.libraries[0].root='D:\\Music';for(const track of file.collections.tracks){track.size=0;track.path='D:\\Music\\Artist\\Album\\'+track.title+'.mp3';}await writeFile(backup,JSON.stringify(file));}
  await source('rating',sourceIds.a,5);if(!legacy)assert.equal((await readFile(path.join(oldRoot,'Artist','Album','a.mp3'))).length,file.collections.tracks.find(t=>t.id===sourceIds.a).size);const {rename}=await import('node:fs/promises');await rename(oldRoot,newRoot);let choice=backup,response=1;const target=await launch(path.join(base,'target'),newRoot,{showOpenDialog:async()=>({canceled:false,filePaths:[choice]}),showMessageBox:async()=>({response})});
  const imported=await target('settings-transfer','import');const ids=Object.fromEntries(imported.state.tracks.map(t=>[t.title,t.id])),lib=imported.state.libraries[0];assert.deepEqual([...imported.state.playlists[0].trackIds],[ids.c,ids.a,ids.b]);
  const wrong=path.join(base,'wrong');await mkdir(wrong);choice=wrong;await assert.rejects(target('reconnect-library',lib.id),/No matching/);assert.equal((await target('load')).libraries[0].root,lib.root);
  choice=newRoot;response=0;assert.equal(await target('reconnect-library',lib.id),null);assert.equal((await target('load')).libraries[0].root,lib.root);response=1;
  const fixed=await target('reconnect-library',lib.id);assert.equal(fixed.state.libraries[0].id,lib.id);assert.equal(fixed.state.libraries[0].root,newRoot);assert.deepEqual(new Set(fixed.state.tracks.map(t=>t.id)),new Set(Object.values(ids)));assert.equal(fixed.state.tracks.some(t=>t.missing),false);assert.equal(fixed.state.ratings[ids.a],5);assert.deepEqual([...fixed.state.playlists[0].trackIds],[ids.c,ids.a,ids.b]);assert.deepEqual([...fixed.state.playlists[1].trackIds],[ids.a]);assert.equal(fixed.state.playlists[2].dynamic.libraryId,lib.id);assert.deepEqual(new Set(fixed.state.playlists[2].trackIds),new Set([ids.a,ids.c]));
  const restarted=await launch(path.join(base,'target'),newRoot);const restored=await restarted('load');assert.equal(restored.libraries[0].root,newRoot);assert.deepEqual([...restored.playlists[0].trackIds],[ids.c,ids.a,ids.b]);assert.equal(restored.ratings[ids.a],5);assert.equal(restored.tracks.some(t=>t.missing),false);
 }}finally{await rm(dir,{recursive:true,force:true});}
});

test('confirmed permanent file deletion removes references, survives restart and preserves cancelled selections',async()=>{
 const dir=await realpath(await mkdtemp(path.join(tmpdir(),'localtone-permanent-delete-')));try{const music=path.join(dir,'Music'),folder=path.join(music,'Artist','Album');await mkdir(folder,{recursive:true});await copyFile(new URL('./fixtures/tone.mp3',import.meta.url),path.join(folder,'song.mp3'));let response=0,confirmation;let invoke=await launch(path.join(dir,'data'),music,{showMessageBox:async(_win,options)=>{confirmation=options;return {response};}});const added=await invoke('add-library','Music'),track=added.state.tracks[0];await invoke('playlist',{type:'create',name:'Mix',trackIds:[track.id]});await invoke('rating',track.id,4);let result=await invoke('delete-files',[track.id]);assert.equal(result.cancelled,true);assert.equal(result.state.tracks.length,1);assert.match(confirmation.detail,/cannot be undone/);assert.equal(confirmation.defaultId,0);response=1;result=await invoke('delete-files',[track.id]);assert.deepEqual(Array.from(result.removed),[track.id]);assert.equal(result.state.tracks.length,0);assert.equal(result.state.playlists[0].trackIds.length,0);assert.equal(result.state.ratings[track.id],undefined);await assert.rejects(readFile(path.join(folder,'song.mp3')),{code:'ENOENT'});invoke=await launch(path.join(dir,'data'),music);const restored=await invoke('load');assert.equal(restored.tracks.length,0);assert.equal(restored.playlists[0].trackIds.length,0);assert.equal(restored.libraries.length,1);}finally{await rm(dir,{recursive:true,force:true});}
});

test('library exclusions rescan, retain regular-playlist IDs, restore cleanly and survive backup and restart',async()=>{const dir=await realpath(await mkdtemp(path.join(tmpdir(),'localtone-library-filters-')));try{const music=path.join(dir,'Music'),album=path.join(music,'Artist','Album'),demos=path.join(music,'Artist','Demos');await mkdir(album,{recursive:true});await mkdir(demos);for(const file of [path.join(album,'song.mp3'),path.join(album,'preview1.mp3'),path.join(demos,'demo.mp3')])await copyFile(new URL('./fixtures/tone.mp3',import.meta.url),file);let invoke=await launch(path.join(dir,'data'),music);const added=await invoke('add-library','Music'),ids=Array.from(added.state.tracks.map(t=>t.id)),library=added.state.libraries[0];await invoke('playlist',{type:'create',name:'Keep',trackIds:ids});let result=await invoke('configure-library',library.id,{folders:['Demos'],fileNames:['preview*'],fileTypes:[],hiddenFolders:false});assert.equal(result.state.tracks.filter(t=>!t.excluded).length,1);assert.deepEqual(Array.from(result.state.playlists[0].trackIds),ids);assert.equal(result.state.tracks.some(t=>t.missing),false);invoke=await launch(path.join(dir,'data'),music);assert.equal((await invoke('load')).tracks.filter(t=>!t.excluded).length,1);result=await invoke('configure-library',library.id,{});assert.equal(result.state.tracks.filter(t=>!t.excluded).length,3);assert.deepEqual(Array.from(result.state.tracks.map(t=>t.id)).sort(),ids.sort());await assert.rejects(invoke('configure-library',library.id,{folders:['bad/name']}));assert.equal((await invoke('load')).tracks.filter(t=>!t.excluded).length,3);}finally{await rm(dir,{recursive:true,force:true});}});
