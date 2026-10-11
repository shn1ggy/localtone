import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, utimes } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Worker } from 'node:worker_threads';
function scan(data) { return new Promise((resolve,reject) => { const w = new Worker(new URL('../scanner.mjs', import.meta.url), {workerData:data}); w.on('message', m => { if (m.tracks || m.error) resolve(m); }); w.on('error',reject); }); }
test('scanner reads real WAV, reuses stable IDs and reports inaccessible roots', async () => {
 const temp = await mkdtemp(path.join(tmpdir(),'localtone-test-'));
 try {
  const root=path.join(temp,'music'), covers=path.join(temp,'covers');await mkdir(root);
  const samples=8000, wav=Buffer.alloc(44+samples*2);wav.write('RIFF');wav.writeUInt32LE(36+samples*2,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(8000,24);wav.writeUInt32LE(16000,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(samples*2,40);
  await writeFile(path.join(root,'Tone.wav'),wav);await writeFile(path.join(root,'ignore.txt'),'ignore');
  const data={root,covers,libraryId:'test',previous:[]};const first=await scan(data);assert.equal(first.tracks.length,1);assert.equal(first.tracks[0].title,'Tone');assert.equal(first.tracks[0].duration,1);
  const second=await scan({...data,previous:first.tracks});assert.deepEqual(second.tracks,first.tracks);
  assert.ok(first.tracks[0].addedAt>0);assert.ok(first.tracks[0].modifiedAt>0);assert.ok(first.tracks[0].missingTags.includes('title'));
  const oldTime=new Date('2020-01-01T00:00:00Z');await utimes(path.join(root,'Tone.wav'),oldTime,oldTime);const edited=await scan({...data,previous:second.tracks});assert.equal(edited.tracks[0].addedAt,first.tracks[0].addedAt);assert.equal(edited.tracks[0].modifiedAt,oldTime.getTime());
  const legacy=structuredClone(edited.tracks);delete legacy[0].addedAt;delete legacy[0].modifiedAt;delete legacy[0].missingTags;const migrated=await scan({...data,previous:legacy});assert.equal(migrated.tracks[0].addedAt,null);assert.equal(migrated.tracks[0].modifiedAt,oldTime.getTime());
  const failed=await scan({...data,root:path.join(temp,'missing')});assert.match(failed.error,/ENOENT/);
 } finally { await rm(temp,{recursive:true,force:true}); }
});

test('unreadable changed files preserve indexed tags and remain eligible for a later retry',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'localtone-sync-retry-'));
 try{const root=path.join(dir,'music'),covers=path.join(dir,'covers');await mkdir(root);const file=path.join(root,'song.mp3');await writeFile(file,Buffer.alloc(0));const previous={id:'stable',path:file,title:'Keep title',artist:'Keep artist',tagRating:5,missingTags:[],trackRaw:'07/19',size:1,mtime:1,missing:false};
 const result=await scan({root,covers,libraryId:'l',previous:[previous],files:[file]});assert.equal(result.warnings,1);assert.deepEqual(result.tracks,[previous]);
 }finally{await rm(dir,{recursive:true,force:true});}
});
