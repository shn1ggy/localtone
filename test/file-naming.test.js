import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
const {format,createFileNaming,relocated}=createRequire(import.meta.url)('../src/file-naming.cjs');
test('naming formulas preserve punctuation, exclude totals and reject unsafe/unknown names',()=>{
 const track={artist:'Artist',albumArtist:'Album artist',album:'Album',year:2009,trackRaw:'07/19',title:'Song',genre:'Ambient',disc:2};assert.equal(format('%year% - %album%',track),'2009 - Album');assert.equal(format('%discnumber%.%tracknumber% - %title%',track),'2.07 - Song');assert.equal(format('%albumartist%, %artist% (%genre%)',track),'Album artist, Artist (Ambient)');assert.equal(format('%title%',{title:'A/B: C?'}),'A_B_ C_');assert.equal(format('%title%',{title:'100% Pure'}),'100% Pure');assert.equal(format('../',track),'.._');assert.throws(()=>format('.',track),/empty|reserved/);assert.throws(()=>format('%unknown%',track),/Unknown field/);assert.throws(()=>format('CON',track),/reserved/);
});
test('naming rejects collisions and external changes and rolls back a failed collection commit',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'localtone-naming-'));try{const folder=path.join(dir,'Artist','Album');await mkdir(folder,{recursive:true});const first=path.join(folder,'first.mp3'),second=path.join(folder,'second.mp3');await writeFile(first,'first');await writeFile(second,'second');const db={libraries:[{id:'l',root:dir}],tracks:[{id:'a',libraryId:'l',path:first,title:'Same',album:'Album',year:2009,trackRaw:'01/02'},{id:'b',libraryId:'l',path:second,title:'Same',album:'Album',year:2009,trackRaw:'02/02'}]},naming=createFileNaming(),config={files:true,folders:true,trackFormula:'%tracknumber% %title%',albumFormula:'%year% %album%'};
 const collision=await naming.preview(['a','b'],{...config,trackFormula:'%title%'},db);assert.equal(collision.issues.filter(i=>/same name/.test(i.message)).length,2);assert.equal(collision.items.filter(i=>i.kind==='file').length,0);await writeFile(path.join(folder,'01 Same.mp3'),'unrelated');const blocked=await naming.preview(['a'],config,db);assert.ok(blocked.issues.some(i=>/already exists/.test(i.message)));assert.equal(blocked.items.filter(i=>i.kind==='file').length,0);await rm(path.join(folder,'01 Same.mp3'));
 const stale=await naming.preview(['a'],config,db);await writeFile(first,'changed');await assert.rejects(naming.apply(stale.token,()=>{}),/changed/);assert.equal(await readFile(first,'utf8'),'changed');
 const preview=await naming.preview(['a','b'],config,db);await assert.rejects(naming.apply(preview.token,()=>{throw Error('Unable to save collection');}),/Unable to save/);assert.equal(await readFile(first,'utf8'),'changed');assert.equal(await readFile(second,'utf8'),'second');
 const next=await naming.preview(['a','b'],config,db);await naming.apply(next.token,moves=>{db.tracks.forEach(t=>t.path=relocated(t.path,moves));});assert.equal(await readFile(db.tracks[0].path,'utf8'),'changed');assert.match(db.tracks[0].path,/2009 Album/);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('rename checks current file availability instead of rejecting stale missing flags',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'localtone-returned-'));
 try{const file=path.join(dir,'old.mp3');await writeFile(file,'audio');const db={libraries:[{id:'l',root:dir}],tracks:[{id:'t',libraryId:'l',path:file,title:'New',missing:true}]};const config={files:true,folders:false,trackFormula:'%title%',albumFormula:'%album%'};
 const naming=createFileNaming();assert.equal((await naming.preview(['t'],config,db)).items.length,1);await rm(file);const missing=await naming.preview(['t'],config,db);assert.equal(missing.count,0);assert.ok(missing.issues.some(i=>i.from===file&&i.message.includes('missing')));
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('batch preview excludes unchanged names, reports missing/conflicting items and applies only valid changes with undo',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'localtone-partial-names-'));
 try{
  const entries=[['good','old.mp3','Good'],['same','Already.mp3','Already'],['missing','gone.mp3','Gone'],['one','one.mp3','Same'],['two','two.mp3','Same'],['occupied','occupied-old.mp3','Occupied']];
  const db={libraries:[{id:'l',root:dir}],tracks:entries.map(([id,name,title])=>({id,path:path.join(dir,name),title,libraryId:'l'}))};
  for(const track of db.tracks)if(track.id!=='missing')await writeFile(track.path,track.id);
  await writeFile(path.join(dir,'Occupied.mp3'),'unselected');
  const naming=createFileNaming(),config={files:true,folders:false,trackFormula:'%title%',albumFormula:'%album%'},preview=await naming.preview(db.tracks.map(t=>t.id),config,db);
  assert.equal(preview.count,1);assert.equal(preview.unchanged,1);assert.equal(preview.issues.length,4);assert.deepEqual(preview.affected,['good']);assert.equal(preview.items[0].to,path.join(dir,'Good.mp3'));
  await writeFile(path.join(dir,'Already.mp3'),'changed but not renamed');
  const commit=moves=>db.tracks.forEach(t=>t.path=relocated(t.path,moves));const result=await naming.apply(preview.token,commit);
  assert.equal(await readFile(path.join(dir,'Good.mp3'),'utf8'),'good');assert.equal(await readFile(path.join(dir,'one.mp3'),'utf8'),'one');assert.equal(await readFile(path.join(dir,'Occupied.mp3'),'utf8'),'unselected');
  await naming.restore(result.undoToken,false,commit);assert.equal(await readFile(path.join(dir,'old.mp3'),'utf8'),'good');
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('rejected destination moves invalidate dependent moves while unrelated previews and swaps stay valid',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'localtone-name-dependencies-'));
 try{for(const file of ['a.mp3','b.mp3','c.mp3','d.mp3'])await writeFile(path.join(dir,file),file);
 const db={libraries:[{id:'l',root:dir}],tracks:[['a','b'],['b','c'],['d','e']].map(([id,title])=>({id,title,libraryId:'l',path:path.join(dir,id+'.mp3')}))},config={files:true,folders:false,trackFormula:'%title%',albumFormula:'%album%'};
 const naming=createFileNaming(),preview=await naming.preview(['a','b','d'],config,db);assert.equal(preview.count,1);assert.equal(preview.issues.length,2);assert.deepEqual(preview.affected,['d']);await naming.apply(preview.token,()=>{});assert.equal(await readFile(path.join(dir,'e.mp3'),'utf8'),'d.mp3');
 db.tracks=db.tracks.slice(0,2);db.tracks[1].title='a';const swap=await naming.preview(['a','b'],config,db);assert.equal(swap.count,2);assert.equal(swap.issues.length,0);await naming.apply(swap.token,()=>{});assert.equal(await readFile(path.join(dir,'a.mp3'),'utf8'),'b.mp3');assert.equal(await readFile(path.join(dir,'b.mp3'),'utf8'),'a.mp3');
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('saved special characters remove or replace safely without changing tags',()=>{
 const track={title:'What? A/B: C*'};
 assert.equal(format('%title%',track,{'?':'','/':' - ',':':'','*':''}),'What A - B C');
 assert.equal(track.title,'What? A/B: C*');
 assert.throws(()=>format('%title%',track,{'/':'../'}),/safe replacement/);
 assert.throws(()=>format('%title%',track,{'?':'\0'}),/safe replacement/);
 assert.throws(()=>format('%title%',{title:'?'},{'?':''}),/empty/);
});
test('row selection applies only selected names, recalculates folder moves, and protects dependencies',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'localtone-selected-names-'));
 try{
  const folder=path.join(dir,'Artist','Old');await mkdir(folder,{recursive:true});
  const a=path.join(folder,'a.mp3'),b=path.join(folder,'b.mp3');await writeFile(a,'a');await writeFile(b,'b');
  const db={libraries:[{id:'l',root:dir}],tracks:[{id:'a',libraryId:'l',path:a,title:'A new',album:'New'},{id:'b',libraryId:'l',path:b,title:'B new',album:'New'}]};
  const naming=createFileNaming(),config={files:true,folders:true,trackFormula:'%title%',albumFormula:'%album%'};
  let preview=await naming.preview(['a','b'],config,db);
  const selected=preview.items.find(i=>i.from===a);await writeFile(b,'unselected changed');
  const result=await naming.apply(preview.token,moves=>db.tracks.forEach(t=>t.path=relocated(t.path,moves)),[selected.id]);
  assert.deepEqual(result.affected,['a']);assert.equal(db.tracks[0].path,path.join(folder,'A new.mp3'));assert.equal(await readFile(b,'utf8'),'unselected changed');
  await naming.restore(result.undoToken,false,moves=>db.tracks.forEach(t=>t.path=relocated(t.path,moves)));
  preview=await naming.preview(['a','b'],config,db);
  await naming.apply(preview.token,moves=>db.tracks.forEach(t=>t.path=relocated(t.path,moves)),[preview.items.find(i=>i.kind==='folder').id]);
  assert.equal(db.tracks[0].path,path.join(dir,'Artist','New','a.mp3'));
  db.tracks[0].title='b';db.tracks[1].title='a';
  preview=await naming.preview(['a','b'],{...config,folders:false},db);
  await assert.rejects(naming.apply(preview.token,()=>{},[preview.items[0].id]),/occupied/);
  assert.equal(await readFile(db.tracks[0].path,'utf8'),'a');
  await assert.rejects(naming.apply(preview.token,()=>{},['unknown']),/Invalid rename selection/);
 }finally{await rm(dir,{recursive:true,force:true});}
});
