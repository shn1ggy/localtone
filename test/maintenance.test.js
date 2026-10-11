import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {createQueueViewCache} from '../app/queue-view.js';
import {shortcutDefaults} from '../app/shortcuts.js';
const require=createRequire(import.meta.url);
test('renderer and persisted shortcut defaults remain identical',()=>{
 const {defaults}=require('../preferences.cjs');assert.deepEqual(shortcutDefaults,defaults.shortcuts);
});
test('queue rows survive unrelated browsing but invalidate for reorder, cursor and metadata',()=>{
 const cache=createQueueViewCache(),track={id:'a',title:'A',artist:'Artist',cover:true},tracks=new Map([['a',track],['b',{id:'b',title:'B'}]]),queue=['a','b'];
 assert.equal(cache.changed(queue,0,tracks),true);assert.equal(cache.changed([...queue],0,new Map(tracks)),false);
 track.title='Edited';assert.equal(cache.changed(queue,0,tracks),true);assert.equal(cache.changed(queue,1,tracks),true);
 assert.equal(cache.changed(['b','a'],1,tracks),true);tracks.set('a',{...track});assert.equal(cache.changed(['b','a'],1,tracks),true);
});
test('packaged runtime includes every local main-process dependency',async()=>{
 const pkg=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
 for(const name of pkg.build.files.filter(n=>/\.(cjs|mjs)$/.test(n))){const source=await readFile(new URL('../'+name,import.meta.url),'utf8');for(const match of source.matchAll(/require\(['"]\.\/([^'"]+)['"]\)/g))assert.ok((pkg.build.files.includes(match[1])||(match[1].startsWith('app/')&&pkg.build.files.includes('app/**/*'))),`${name} requires missing ${match[1]}`);}
});

test('preload exposes only methods referenced by shipped renderer modules',async()=>{
 const {readdir}=await import('node:fs/promises');
 async function sources(dir){const entries=await readdir(dir,{withFileTypes:true});return (await Promise.all(entries.map(async e=>e.isDirectory()?sources(new URL(e.name+'/',dir)):e.name.endsWith('.js')?readFile(new URL(e.name,dir),'utf8'):''))).join('\n');}
 const app=await sources(new URL('../app/',import.meta.url)),preload=await readFile(new URL('../preload.cjs',import.meta.url),'utf8');
 for(const match of preload.matchAll(/^  (\w+):/gm))assert.match(app,new RegExp('\\b'+match[1]+'\\b'),'Unreferenced bridge method: '+match[1]);
});
test('every invoked preload channel has a main-process registration',async()=>{
 const preload=await readFile(new URL('../preload.cjs',import.meta.url),'utf8'),main=await readFile(new URL('../main.cjs',import.meta.url),'utf8');
 const channels=new Set([...main.matchAll(/(?:handle|ipcMain\.on(?:\?\.)?)\(\s*['"]([^'"]+)['"]/g)].map(m=>m[1]));
 for(const match of preload.matchAll(/ipcRenderer\.(?:invoke|send|sendSync)\(['"]([^'"]+)['"]/g))assert.ok(channels.has(match[1]),'Missing handler: '+match[1]);
});

test('queue pages advance at the display limit and count changes invalidate the cache',async()=>{
 const {queuePage}=await import('../app/queue-view.js');assert.deepEqual(queuePage(205,99),{start:0,end:100});assert.deepEqual(queuePage(205,100),{start:100,end:200});assert.deepEqual(queuePage(205,204),{start:200,end:205});assert.deepEqual(queuePage(205,25,25),{start:25,end:50});
 const queue=Array.from({length:205},(_,i)=>String(i)),tracks=new Map(queue.map(id=>[id,{id,title:id}])),cache=createQueueViewCache();assert.equal(cache.changed(queue,0,tracks,100),true);assert.equal(cache.changed(queue,0,tracks,100),false);assert.equal(cache.changed(queue,0,tracks,25),true);
});
