import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {cleanUnusedCache} from '../cache-cleanup.cjs';
import {waveformCacheKey} from '../waveform.cjs';
test('cache cleanup removes only obsolete cache files and protects current data and symlinks',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'localtone-cache-'));
 try{
  const track={id:'a'.repeat(64),path:'/music/song.mp3',size:100,mtime:1,cover:true,missing:true};
  const current=waveformCacheKey(track)+'.json',old=waveformCacheKey({...track,mtime:0})+'.json',active='e'.repeat(64),orphan='b'.repeat(64);
  for(const folder of ['covers','waveforms'])await mkdir(path.join(dir,folder));
  const contents={['covers/'+track.id]:'current cover',['covers/'+orphan]:'old cover',['waveforms/'+current]:'current waveform',['waveforms/'+old]:'old waveform',['waveforms/'+active+'.json']:'active waveform','covers/notes.txt':'notes','collection.json':'settings','outside':'safe'};
  for(const [file,value]of Object.entries(contents))await writeFile(path.join(dir,file),value);
  await symlink(path.join(dir,'outside'),path.join(dir,'covers','c'.repeat(64)));
  const result=await cleanUnusedCache(dir,[track],active);assert.equal(result.files,2);assert.equal(result.bytes,21);
  for(const [file,value]of Object.entries(contents)){if(file==='covers/'+orphan||file==='waveforms/'+old)await assert.rejects(readFile(path.join(dir,file)),{code:'ENOENT'});else assert.equal(await readFile(path.join(dir,file),'utf8'),value);}
  assert.equal((await cleanUnusedCache(dir,[track],active)).files,0);
  await rm(path.join(dir,'covers'),{recursive:true});await symlink(dir,path.join(dir,'covers'));await assert.rejects(cleanUnusedCache(dir,[track]),/regular directory/);
 }finally{await rm(dir,{recursive:true,force:true});}
});
