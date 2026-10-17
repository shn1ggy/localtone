import test from 'node:test';
import assert from 'node:assert/strict';
import {createPlaybackQueue} from '../app/playback-queue.js';
const library={kind:'library',id:'l'},playlist={kind:'playlist',id:'p'};
test('queue owns immutable arrays and origins without copying browsing collections',()=>{
 const queue=createPlaybackQueue(),ids=['a','b','c'];queue.seed(ids,library,{chosen:'b'});ids.push('extra');library.id='changed';assert.deepEqual(queue.queue,['a','b','c']);assert.equal(queue.origins[0].id,'l');library.id='l';assert.throws(()=>queue.queue.push('bad'),TypeError);assert.throws(()=>queue.origins[0].id='bad',TypeError);const before=queue.queue;queue.select(2);assert.equal(queue.queue,before);assert.equal(queue.cursor,2);
});
test('insert, move and remove preserve the playing entry and its collection origin',()=>{
 const queue=createPlaybackQueue();queue.seed(['a','b','c'],library,{chosen:'b'});queue.insert(['a'],playlist);assert.deepEqual(queue.queue,['a','b','a','c']);queue.move(2,0);assert.equal(queue.queue[queue.cursor],'b');assert.equal(queue.origins[0].kind,'playlist');queue.remove(0);assert.deepEqual(queue.queue,['a','b','c']);assert.equal(queue.cursor,1);assert.equal(queue.origins[1].kind,'library');
});
test('random-next regenerates order and disabling shuffle restores the normal successor',()=>{
 const queue=createPlaybackQueue({random:()=>0});queue.seed(['a','b','c','d'],library,{chosen:'c'});queue.randomNext(['a','b','c','d'],library,'c');assert.equal(queue.queue[queue.cursor],'a');assert.equal(new Set(queue.queue).size,4);queue.setShuffled(false);assert.deepEqual(queue.queue,['a','b','c','d']);assert.equal(queue.cursor,0);assert.equal(queue.queue[queue.cursor+1],'b');
});
test('history restoration keeps a currently playing added song and pruning retains origin alignment',()=>{
 const queue=createPlaybackQueue();queue.seed(['a','b'],library);const before=queue.capture();queue.insert(['c'],playlist);queue.select(1);queue.restoreEdit(before,()=>true);assert.equal(queue.queue[queue.cursor],'c');assert.equal(queue.origins[queue.cursor].id,'p');queue.prune(id=>id!=='a');assert.equal(queue.queue.length,queue.origins.length);assert.equal(queue.queue[queue.cursor],'c');assert.deepEqual(before.queue,['a','b']);
});

test('missing-entry repair remaps queue references without losing the active occurrence or origins',()=>{
 const queue=createPlaybackQueue();queue.seed(['before','duplicate','missing','after'],library,{chosen:'duplicate'});queue.insert(['duplicate'],playlist);const origins=queue.origins.map(o=>o.kind);queue.remapReferences({duplicate:'original',missing:null});assert.deepEqual(queue.queue,['before','original','original','after']);assert.equal(queue.cursor,1);assert.equal(queue.queue[queue.cursor],'original');assert.deepEqual(queue.origins.map(o=>o.kind),origins.filter((_,i)=>i!==3));queue.setShuffled(false);assert.equal(queue.queue[queue.cursor],'original');queue.remapReferences({original:null});assert.equal(queue.cursor,-1);assert.deepEqual(queue.queue,['before','after']);
});

test('session restoration keeps duplicate occurrences, origins and exact cursor',()=>{
 const original=createPlaybackQueue();original.seed(['a','b','c'],library,{chosen:'b'});original.insert(['b'],playlist);original.move(3,0);original.select(3);
 const saved=original.capture(),restored=createPlaybackQueue();restored.restoreSession(saved,()=>true);assert.deepEqual(restored.capture(),saved);
 restored.restoreSession(saved,id=>id!=='a');assert.equal(restored.queue[restored.cursor],saved.queue[saved.cursor]);assert.equal(restored.origins[restored.cursor].kind,saved.origins[saved.cursor].kind);
 restored.restoreSession({queue:[],origins:[],ordered:[],cursor:-1},()=>true);assert.deepEqual(restored.capture(),{queue:[],origins:[],ordered:[],cursor:-1});
});
