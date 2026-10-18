import test from 'node:test';
import assert from 'node:assert/strict';
import preferences from '../src/preferences.cjs';
import { selectTracks } from '../app/core.js';
test('whole-star ratings reject halves and out-of-range values',()=>{for(const n of [0,1,2,3,4,5])assert.equal(preferences.validateRating(n),n);for(const n of [0.5,5.5,-1,6,'3',NaN])assert.throws(()=>preferences.validateRating(n));});
test('old collections receive defaults; invalid saved preferences are normalized',()=>{assert.deepEqual(preferences.normalizeSettings(),preferences.defaults);const settings=preferences.normalizeSettings({theme:'blue',volume:4,coverSize:'tiny'});assert.equal(settings.theme,'blue');assert.equal(settings.volume,.8);assert.equal(settings.coverSize,'medium');assert.throws(()=>preferences.validateSettings({theme:'unknown'}));});
test('rating sorts by persisted whole stars with unrated first',()=>{const tracks=[1,2,3].map(id=>({id:String(id),title:String(id),album:'Album',disc:1,track:id}));assert.deepEqual(selectTracks({tracks,ratings:{1:5,3:2}},{kind:'all'},'','rating').map(t=>t.id),['2','3','1']);});
test('column settings validate order, visibility and width',()=>{const columns=preferences.defaults.columns.map(c=>({...c})).reverse();columns.find(c=>c.key==='genre').visible=false;columns.find(c=>c.key==='title').width=300;assert.deepEqual(preferences.validateSettings({columns}).columns,columns);assert.throws(()=>preferences.validateSettings({columns:columns.map(c=>({...c,width:0}))}));});
test('old global columns seed independent view layouts and view settings validate',()=>{
 const old=preferences.defaults.columns.map(c=>({...c,width:c.key==='title'?310:c.width}));const result=preferences.normalizeSettings({columns:old});assert.equal(result.columnsByView.albums.find(c=>c.key==='title').width,310);result.columnsByView.tracks[0].visible=false;assert.equal(result.columnsByView.playlists[0].visible,true);
 assert.throws(()=>preferences.validateSettings({columnsByView:{tracks:old}}));assert.throws(()=>preferences.validateSettings({albumExpansion:'maybe'}));assert.equal(preferences.validateSettings({albumExpansion:'expanded'}).albumExpansion,'expanded');
});
test('new preset uses four columns and requires a flexible column',()=>{
 const columns=preferences.defaults.columns;assert.deepEqual(columns.filter(c=>c.visible).map(c=>[c.key,c.fixed]),[['number',true],['title',false],['duration',true],['rating',true]]);
 assert.throws(()=>preferences.validateSettings({columns:columns.map(c=>({...c,fixed:true}))}),/flexible/);
 assert.throws(()=>preferences.validateSettings({columns:columns.map(c=>({...c,fixed:'yes'}))}),/fixed width/);
});
test('only untouched old column presets migrate; customized layouts survive',()=>{
 const old=[['number',38],['title',240],['artist',150],['album',160],['year',65],['genre',100],['duration',80],['rating',96]].map(([key,width])=>({key,width,visible:true}));
 const custom=old.map(c=>({...c,width:c.key==='title'?310:c.width}));const settings=preferences.normalizeSettings({columns:old,columnsByView:{tracks:old,albums:custom,playlists:old}});
 assert.deepEqual(settings.columnsByView.tracks,preferences.defaults.columns);assert.deepEqual(settings.columnsByView.playlists,preferences.defaults.columns);assert.equal(settings.columnsByView.albums.find(c=>c.key==='title').width,264);assert.equal(settings.columnsByView.albums.filter(c=>c.visible).length,4);
 assert.deepEqual(preferences.normalizeSettings({columns:old}).columnsByView.albums,preferences.defaults.columns);
});
test('column-heading preference restores and rejects non-boolean values',()=>{assert.equal(preferences.normalizeSettings({showColumnHeaders:false}).showColumnHeaders,false);assert.equal(preferences.normalizeSettings().showColumnHeaders,false);assert.throws(()=>preferences.validateSettings({showColumnHeaders:'false'}));});
test('column alignment defaults migrate, valid choices persist, invalid values reject',()=>{
 const columns=preferences.defaults.columns.map(({align,...c})=>c),clean=preferences.validateSettings({columns}).columns;assert.equal(clean.find(c=>c.key==='duration').align,'right');const centered=clean.map(c=>({...c,align:'center'}));assert.ok(preferences.validateSettings({columns:centered}).columns.every(c=>c.align==='center'));assert.throws(()=>preferences.validateSettings({columns:clean.map(c=>({...c,align:'sideways'}))}),/alignment/);
});
test('portable mode defaults on and accepts only booleans',()=>{assert.equal(preferences.normalizeSettings().portable,true);assert.equal(preferences.validateSettings({portable:false}).portable,false);assert.throws(()=>preferences.validateSettings({portable:'yes'}));});


test('compact column defaults upgrade only untouched prior layouts',()=>{
 const next=preferences.defaults.columns;assert.deepEqual(next.filter(c=>c.visible).map(c=>[c.key,c.width]),[['number',48],['title',264],['duration',47],['rating',76]]);
 const old=[['number',42,true,true],['title',240,true,false],['rating',100,true,true],['duration',80,true,true],['artist',150,false,false],['album',160,false,false],['year',65,false,true],['genre',100,false,false]].map(([key,width,visible,fixed])=>({key,width,visible,fixed,align:['rating','duration'].includes(key)?'right':key==='year'?'center':'left'}));
 assert.deepEqual(preferences.normalizeSettings({columns:old}).columns,next);
 const custom=old.map(c=>({...c,width:c.key==='title'?310:c.width}));assert.deepEqual(preferences.normalizeSettings({columns:custom}).columns,custom);
 assert.equal(preferences.normalizeSettings({sidebarLocked:true,artistLocked:true}).artistLocked,true);
});


test('background saturation and brightness persist with bounds and compatible defaults',()=>{
 const settings=preferences.normalizeSettings({backgroundSaturation:35,backgroundBrightness:18});assert.equal(settings.backgroundSaturation,35);assert.equal(settings.backgroundBrightness,18);assert.equal(preferences.defaults.backgroundSaturation,3);assert.equal(preferences.defaults.backgroundBrightness,12);
 for(const patch of [{backgroundSaturation:101},{backgroundSaturation:-1},{backgroundBrightness:31},{backgroundBrightness:2.5}])assert.throws(()=>preferences.validateSettings(patch));
});

test('personal design defaults apply to new collections while saved appearance remains intact',()=>{
 const fresh=preferences.normalizeSettings();assert.equal(fresh.backgroundHue,187);assert.equal(fresh.accentColor,'#47c1f5');assert.equal(fresh.sidebarWidth,242);assert.equal(fresh.artistWidth,288);assert.equal(fresh.sidebarLocked,true);assert.equal(fresh.artistLocked,true);assert.equal(fresh.lastView,'covers');assert.equal(fresh.trackNumberFormat,'full');assert.equal(fresh.waveformStyle,'outline');
 assert.deepEqual(fresh.columns.filter(c=>c.visible).map(c=>[c.key,c.width,c.fixed,c.align]),[['number',48,true,'left'],['title',264,false,'left'],['duration',47,true,'right'],['rating',76,true,'right']]);
 const saved=preferences.normalizeSettings({backgroundHue:40,sidebarWidth:200,sidebarLocked:false,columns:fresh.columns.map(c=>({...c,width:c.key==='title'?320:c.width}))});assert.equal(saved.backgroundHue,40);assert.equal(saved.sidebarWidth,200);assert.equal(saved.sidebarLocked,false);assert.equal(saved.columns.find(c=>c.key==='title').width,320);fresh.columns[0].width=99;assert.equal(preferences.normalizeSettings().columns[0].width,48);
});

test('new setups group by album artist and year; existing folder choices and new seek settings persist',()=>{
 const fresh=preferences.normalizeSettings();assert.equal(fresh.artistGrouping,'albumArtist');assert.equal(fresh.defaultSort,'year');assert.equal(fresh.seekStep,5);
 const old=preferences.normalizeSettings({theme:'blue'});assert.equal(old.artistGrouping,'folder');assert.equal(old.defaultSort,'folder');
 const patch={artistGrouping:'artist',defaultSort:'duration',seekStep:10};assert.deepEqual(preferences.validateSettings(patch),patch);assert.equal(preferences.normalizeSettings(patch).defaultSort,'duration');
 assert.throws(()=>preferences.validateSettings({seekStep:0}));assert.throws(()=>preferences.validateSettings({seekStep:2.5}));assert.throws(()=>preferences.validateSettings({artistGrouping:'genre'}));
});
test('seek shortcut migration keeps existing bindings unique',()=>{
 const old={...preferences.defaults.shortcuts};delete old.seekBackward;delete old.seekForward;old.tags='Alt+ArrowLeft';
 const next=preferences.normalizeSettings({shortcuts:old}).shortcuts;assert.equal(next.tags,'Alt+ArrowLeft');assert.notEqual(next.seekBackward,next.tags);assert.equal(next.seekForward,'Alt+ArrowRight');assert.equal(new Set(Object.values(next)).size,Object.keys(next).length);
});

test('context-menu shortcut migrates without collisions and lookup zero padding persists',()=>{const old={...preferences.defaults.shortcuts};delete old.contextMenu;old.tags='Shift+Enter';const next=preferences.normalizeSettings({shortcuts:old,lookupLeadingZeros:true});assert.equal(next.shortcuts.tags,'Shift+Enter');assert.notEqual(next.shortcuts.contextMenu,'Shift+Enter');assert.equal(next.lookupLeadingZeros,true);assert.equal(preferences.validateSettings({lookupLeadingZeros:false}).lookupLeadingZeros,false);assert.throws(()=>preferences.validateSettings({lookupLeadingZeros:1}));const invalid={...preferences.defaults.shortcuts,contextMenu:'Enter'};assert.throws(()=>preferences.validateSettings({shortcuts:invalid}));});

test('tag editor disclosure states default open and persist independently',()=>{assert.equal(preferences.defaults.tagFieldsExpanded,true);assert.equal(preferences.defaults.tagNumbersExpanded,true);assert.deepEqual(preferences.validateSettings({tagFieldsExpanded:false,tagNumbersExpanded:true}),{tagFieldsExpanded:false,tagNumbersExpanded:true});const restored=preferences.normalizeSettings({tagFieldsExpanded:false,tagNumbersExpanded:false});assert.equal(restored.tagFieldsExpanded,false);assert.equal(restored.tagNumbersExpanded,false);assert.throws(()=>preferences.validateSettings({tagFieldsExpanded:'closed'}));});

test('rename shortcut uses F2 and restores the v0.92 repeat default without changing custom bindings',()=>{
 const old={...preferences.defaults.shortcuts,repeat:'Shift+r',rename:'r'};
 const upgraded=preferences.normalizeSettings({shortcuts:old}).shortcuts;
 assert.equal(upgraded.rename,'F2');assert.equal(upgraded.repeat,'r');
 const custom={...old,repeat:'F8',rename:'r'};
 const next=preferences.normalizeSettings({shortcuts:custom}).shortcuts;
 assert.equal(next.repeat,'F8');assert.equal(next.rename,'r');
 assert.equal(new Set(Object.values(next)).size,Object.keys(next).length);
 const older={...preferences.defaults.shortcuts};delete older.rename;
 assert.equal(preferences.normalizeSettings({shortcuts:older}).shortcuts.rename,'F2');
});

test('quit default migrates without colliding with a custom action; text colors validate and persist',()=>{
 assert.equal(preferences.defaults.shortcuts.quit,'Mod+q');
 const legacy={...preferences.defaults.shortcuts,quit:'q'};
 assert.equal(preferences.normalizeSettings({shortcuts:legacy}).shortcuts.quit,'Mod+q');
 const custom={...legacy,tags:'Mod+q'};
 assert.equal(preferences.normalizeSettings({shortcuts:custom}).shortcuts.quit,'q');
 assert.equal(preferences.normalizeSettings({shortcuts:{...legacy,quit:'F9'}}).shortcuts.quit,'F9');
 const colors={primaryTextColor:'#FFEEDD',secondaryTextColor:'#778899'};
 assert.deepEqual(preferences.validateSettings(colors),colors);
 assert.equal(preferences.normalizeSettings(colors).secondaryTextColor,colors.secondaryTextColor);
 assert.equal(preferences.normalizeSettings().primaryTextColor,'#e0e4e7');
 for(const value of ['red','#123',null,'url(file:///bad)'])assert.throws(()=>preferences.validateSettings({primaryTextColor:value}));
});

test('ignoring discs for renumbering is opt-in and validated',()=>{assert.equal(preferences.defaults.renumberIgnoreDiscs,false);assert.equal(preferences.normalizeSettings({renumberIgnoreDiscs:true}).renumberIgnoreDiscs,true);assert.throws(()=>preferences.validateSettings({renumberIgnoreDiscs:'yes'}));});


test('disc-number display is off by default and persists only boolean preferences',()=>{
 assert.equal(preferences.normalizeSettings().showDiscNumber,false);
 assert.equal(preferences.normalizeSettings({showDiscNumber:true}).showDiscNumber,true);
 assert.throws(()=>preferences.validateSettings({showDiscNumber:'true'}));
});


test('new heading and confirmed removal bindings migrate without overwriting custom shortcuts',()=>{const old={...preferences.defaults.shortcuts};delete old.columnHeadings;delete old.deleteSelection;old.tags='Shift+x';const next=preferences.normalizeSettings({shortcuts:old}).shortcuts;assert.equal(next.tags,'Shift+x');assert.notEqual(next.columnHeadings,'Shift+x');assert.equal(next.deleteSelection,'Shift+Backspace');assert.equal(new Set(Object.values(next)).size,Object.keys(next).length);});

test('new installs expand albums but explicitly saved collapsed preference remains collapsed',()=>{assert.equal(preferences.defaults.albumExpansion,'expanded');assert.equal(preferences.normalizeSettings({albumExpansion:'collapsed'}).albumExpansion,'collapsed');});
