import test from 'node:test';
import assert from 'node:assert/strict';
import {moveQueueItem,insertQueueItems,seekTo} from '../app/interactions.js';
import {serveAudio} from '../media.cjs';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
test('queue reorder preserves the playing occurrence, even with duplicate songs',()=>{
 assert.deepEqual(moveQueueItem(['a','b','a','c'],2,0,4),{queue:['b','a','c','a'],cursor:1});
 assert.deepEqual(moveQueueItem(['a','b','c'],1,1,0),{queue:['b','a','c'],cursor:0});
 assert.deepEqual(insertQueueItems(['a','b'],1,['c','d'],0),{queue:['c','d','a','b'],cursor:3});
 assert.deepEqual(insertQueueItems([], -1,['a'],0),{queue:['a'],cursor:-1});
});
test('seek uses audio duration or scanner duration, and clamps endpoints',()=>{
 const audio={duration:120,currentTime:0};assert.equal(seekTo(audio,25),30);assert.equal(audio.currentTime,30);
 audio.duration=Infinity;assert.equal(seekTo(audio,50,180),90);assert.equal(seekTo(audio,110,180),180);assert.equal(seekTo(audio,20),null);
});
test('audio requests serve exact byte ranges needed for seeking',async()=>{
 const file=fileURLToPath(new URL('./fixtures/tone.mp3',import.meta.url)),bytes=await readFile(file);
 const request=(range,method='GET')=>({method,headers:new Headers(range?{range}:{})});
 const partial=await serveAudio(file,request('bytes=100-199'));assert.equal(partial.status,206);assert.equal(partial.headers.get('Content-Range'),`bytes 100-199/${bytes.length}`);assert.equal(partial.headers.get('Content-Length'),'100');assert.deepEqual(Buffer.from(await partial.arrayBuffer()),bytes.subarray(100,200));
 const suffix=await serveAudio(file,request('bytes=-10'));assert.deepEqual(Buffer.from(await suffix.arrayBuffer()),bytes.subarray(-10));
 assert.equal((await serveAudio(file,request('bytes=999999-'))).status,416);
 const head=await serveAudio(file,request(null,'HEAD'));assert.equal(head.headers.get('Accept-Ranges'),'bytes');assert.equal(head.body,null);
});
test('column boundaries move in pixels without changing total width, and layouts fit narrow panes',async()=>{
 const {columnWidths,resizeColumnBoundary}=await import('../app/interactions.js');
 const columns=[{width:42,fixed:true},{width:240,fixed:false},{width:100,fixed:true},{width:80,fixed:true}];
 assert.deepEqual(columnWidths(columns,640),[42,418,100,80]);assert.deepEqual(resizeColumnBoundary([42,418,100,80],1,30),[42,448,70,80]);assert.deepEqual(resizeColumnBoundary([42,418,100,80],1,200),[42,482,36,80]);
 const narrow=columnWidths(columns,180);assert.ok(narrow.every(w=>w>=0));assert.ok(Math.abs(narrow.reduce((a,b)=>a+b,0)-180)<.001);
});
