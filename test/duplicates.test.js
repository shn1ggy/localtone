import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
const {createDuplicates}=createRequire(import.meta.url)('../duplicates.cjs');
test('duplicate review hashes only size candidates and separates exact from possible recordings',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'localtone-duplicates-'));
 try{
  const tracks=[];for(const [id,content] of [['a','copy'],['b','copy'],['c','diff'],['d','longer']]){const file=path.join(dir,id+'.mp3');await writeFile(file,content);tracks.push({id,path:file,libraryId:'l',artist:'Artist',title:'Song',album:'Album',duration:123});}
  const service=createDuplicates(),libraries=[{id:'l',root:dir}];
  const exact=await service.review(tracks,libraries);assert.deepEqual(exact.groups.map(g=>g.items.map(i=>i.id)),[['a','b']]);
  const possible=await service.review(tracks,libraries,'metadata');assert.equal(possible.groups[0].items.length,4);
  let confirmed=false;await assert.rejects(service.remove(possible.token,['a','b','c','d'],{confirm:()=>{confirmed=true;},trash(){},onRemoved(){}}),/Keep at least one/);assert.equal(confirmed,false);
  const cancelled=await service.remove(possible.token,['b'],{confirm:async()=>false,trash:()=>assert.fail('cancelled'),onRemoved:()=>assert.fail('cancelled')});assert.equal(cancelled.cancelled,true);
  let removed;const result=await service.remove(possible.token,['b'],{confirm:async(files,mode)=>{assert.equal(mode,'metadata');assert.equal(files[0].id,'b');return true;},trash:file=>rm(file),onRemoved:ids=>removed=ids});assert.deepEqual(result.removed,['b']);assert.deepEqual(removed,['b']);assert.equal(await readFile(tracks[0].path,'utf8'),'copy');
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('duplicate deletion rejects changed files and refuses to remove the last copy after confirmation',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'localtone-duplicate-changes-'));
 try{
  const tracks=[];for(const id of ['a','b']){const file=path.join(dir,id+'.mp3');await writeFile(file,'copy');tracks.push({id,path:file,libraryId:'l'});}
  const service=createDuplicates(),libraries=[{id:'l',root:dir}];let review=await service.review(tracks,libraries);
  await writeFile(tracks[1].path,'changed');await assert.rejects(service.remove(review.token,['b'],{confirm:async()=>true,trash:()=>assert.fail('changed'),onRemoved(){}}),/changed/);
  await writeFile(tracks[1].path,'copy');review=await service.review(tracks,libraries);
  const result=await service.remove(review.token,['b'],{confirm:async()=>{await rm(tracks[0].path);return true;},trash:()=>assert.fail('no keeper'),onRemoved(){}});
  assert.deepEqual(result.removed,[]);assert.match(result.failures[0].message,/No unchanged copy/);assert.equal(await readFile(tracks[1].path,'utf8'),'copy');
 }finally{await rm(dir,{recursive:true,force:true});}
});
