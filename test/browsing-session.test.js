import test from 'node:test';
import assert from 'node:assert/strict';
import session from '../src/browsing-session.cjs';
import queueWindow from '../src/queue-window.cjs';
export const fixture={version:1,scope:{kind:'playlist',id:'p'},view:'covers',pane:'artists',query:'year:2009',sort:'year',direction:-1,seed:42,scroll:{content:740,artists:80,playlists:25,libraries:0,queue:100},expanded:[['album',true]],groups:Object.fromEntries(['artists','tracks','albums','openedAlbums'].map(k=>[k,{keys:[],current:null,anchor:null}])),albumDetail:null,albumFocus:null,coverFocus:null,queueOpen:true,mini:false,deselected:{artists:null,tracks:null},coverReturnScroll:44,window:{bounds:{x:50,y:60,width:1180,height:800},maximized:false}};
test('browsing session retains navigation, queue state and bounds without accepting malformed state',()=>{
 assert.deepEqual(session.validateSession(fixture),fixture);
 for(const mutate of [s=>s.scroll.content=-1,s=>s.scope.kind='bad',s=>s.groups.tracks.keys=[{}],s=>s.pane='unknown',s=>s.window.bounds.width=Infinity]){const s=structuredClone(fixture);mutate(s);assert.throws(()=>session.validateSession(s));}
});
test('saving an extended queue returns normal bounds so each restart cannot extend twice',()=>{
 let bounds={x:100,y:50,width:1180,height:800};const win={getBounds:()=>({...bounds}),getNormalBounds:()=>({...bounds}),setBounds:b=>bounds=b,isMaximized:()=>false},screen={getDisplayMatching:()=>({workArea:{x:0,y:0,width:2000,height:1200}})},q=queueWindow.createQueueWindow();
 const original={...bounds};q.open(win,screen);assert.equal(bounds.width,1404);assert.deepEqual(q.normalBounds(win),original);q.close(win);assert.deepEqual(q.normalBounds(win),original);
});

test('older browsing sessions gain safe defaults for newly saved navigation state',()=>{
 const old=structuredClone(fixture);delete old.scroll.libraries;delete old.mini;delete old.deselected;const restored=session.validateSession(old);assert.equal(restored.scroll.libraries,0);assert.equal(restored.mini,false);assert.deepEqual(restored.deselected,{artists:null,tracks:null});
});
