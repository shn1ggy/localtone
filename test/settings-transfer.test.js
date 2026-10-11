import test from 'node:test';
import assert from 'node:assert/strict';
import transfer from '../settings-transfer.cjs';
import preferences from '../preferences.cjs';
import queueWindow from '../queue-window.cjs';
test('settings export round trips preferences without paths, collection or device/storage settings',()=>{const source={...preferences.defaults,backgroundHue:140,queuePresentation:'extend',portable:false,audioOutputId:'device',libraries:[{path:'/private'}],lastfm:'secret'};const result=transfer.exportSettings(source);assert.equal(result.settings.backgroundHue,140);assert.equal(result.settings.queuePresentation,'extend');for(const key of ['portable','audioOutputId','audioOutputName','libraries','lastfm'])assert.equal(Object.hasOwn(result.settings,key),false);assert.deepEqual(transfer.importSettings(JSON.parse(JSON.stringify(result))),result.settings);});
test('settings imports reject malformed versions, unsafe fields and invalid values',()=>{for(const file of [{format:'other',version:1,settings:{}},{format:'localtone-settings',version:2,settings:{}},{format:'localtone-settings',version:1,settings:{portable:false}},{format:'localtone-settings',version:1,settings:{backgroundHue:999}},{format:'localtone-settings',version:1,settings:{libraries:[]}},{format:'localtone-settings',version:1,settings:{}}])assert.throws(()=>transfer.importSettings(file));});
test('queue extends right, stays on screen, restores bounds, and falls back when space is unavailable',()=>{let bounds={x:100,y:30,width:1100,height:760},max=false;const original={...bounds},win={getBounds:()=>({...bounds}),setBounds:b=>bounds={...b},isMaximized:()=>max},screen={getDisplayMatching:()=>({workArea:{x:0,y:0,width:1600,height:1000}})},controller=queueWindow.createQueueWindow();assert.equal(controller.open(win,screen),true);assert.equal(bounds.width,1324);assert.equal(bounds.x,100);controller.close(win);assert.deepEqual(bounds,original);bounds.x=500;assert.equal(controller.open(win,screen),true);assert.equal(bounds.x,276);controller.close(win);assert.equal(bounds.x,500);max=true;assert.equal(controller.open(win,screen),false);max=false;bounds.width=1500;assert.equal(controller.open(win,screen),false);});
test('previous settings exports gain Redo without replacing customized shortcuts',()=>{const file=transfer.exportSettings(preferences.defaults);delete file.settings.shortcuts.redo;file.settings.shortcuts.play='F10';const settings=transfer.importSettings(file);assert.equal(settings.shortcuts.redo,'Mod+Shift+z');assert.equal(settings.shortcuts.play,'F10');file.settings.shortcuts.play='invalid binding';assert.throws(()=>transfer.importSettings(file));});

const collection = {libraries:[{id:'lib',name:'Music',root:'/Music'}],tracks:[{id:'t',libraryId:'lib',path:'/Music/song.mp3',title:'Song',year:2020,trackRaw:'01/10',tagRating:4}],playlists:[{id:'p',name:'Favorites',trackIds:['t','t']},{id:'d',name:'Rated',trackIds:[],dynamic:{enabled:true,libraryId:'lib',match:'all',mode:'rules',query:'',rules:[{field:'rating',op:'gte',value:4}]}}]};
test('collection export is opt-in and round trips references, playlist order and dynamic rules',()=>{
assert.equal(transfer.exportSettings(preferences.defaults,collection).collections,undefined);
const file=transfer.exportSettings({...preferences.defaults,exportCollections:true},collection);
assert.equal(file.collections.tracks[0].trackRaw,'01/10');
assert.deepEqual(file.collections.playlists[0].trackIds,['t','t']);
assert.equal(file.collections.playlists[1].dynamic.rules[0].value,4);
assert.equal(transfer.importSettings(JSON.parse(JSON.stringify(file))).exportCollections,true);
});
test('collection import merges by folder and file while retaining existing playlists and metadata',()=>{
let n=0;
const current={libraries:[{id:'existing-lib',name:'Existing',root:'/Music'}],tracks:[{id:'existing-track',libraryId:'existing-lib',path:'/Music/song.mp3',title:'Keep me'}],playlists:[{id:'old',name:'Keep',trackIds:[]}],ratings:{'existing-track':5}};
const result=transfer.mergeCollections(current,collection,()=>`new-${++n}`);
assert.equal(result.libraries.length,1);assert.equal(result.tracks.length,1);assert.equal(result.tracks[0].title,'Keep me');assert.equal(result.playlists.length,3);
assert.deepEqual(result.playlists[1].trackIds,['existing-track','existing-track']);assert.equal(result.playlists[2].dynamic.libraryId,'existing-lib');assert.equal(result.ratings['existing-track'],5);assert.equal(current.playlists.length,1);
});
test('collection import rejects dangling references, invalid metadata and dynamic rules',()=>{
for(const mutate of [c=>c.tracks[0].libraryId='missing',c=>c.playlists[0].trackIds=['missing'],c=>c.libraries.push(c.libraries[0]),c=>c.tracks[0].tagRating=6,c=>c.playlists[1].dynamic.rules[0].field='unsupported']){
const invalid=structuredClone(collection);mutate(invalid);assert.throws(()=>transfer.validateCollections(invalid));
}
});
test('new collection references get fresh IDs, ratings and no stale artwork cache',()=>{
let n=0;const result=transfer.mergeCollections({libraries:[],tracks:[],playlists:[],ratings:{}},collection,()=>String(++n));
assert.equal(result.tracks[0].libraryId,result.libraries[0].id);assert.equal(result.ratings[result.tracks[0].id],4);assert.equal(result.tracks[0].cover,false);assert.equal(result.tracks[0].mtime,0);
});
