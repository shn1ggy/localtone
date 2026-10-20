import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import NodeID3 from 'node-id3';
import { parseFile } from 'music-metadata';
import editor from '../src/tags.cjs';
const fixture=await readFile(new URL('./fixtures/tone.mp3',import.meta.url));
async function setup(fn) {const dir=await mkdtemp(path.join(tmpdir(),'localtone-tags-'));try{const file=path.join(dir,'test.mp3');await writeFile(file,fixture);await fn(file,path.join(dir,'backups'));}finally{await rm(dir,{recursive:true,force:true});}}
test('MP3 save preserves audio, artwork, comments, and an exact original backup',async()=>setup(async(file,backupDir)=>{
 const image=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jMZkAAAAASUVORK5CYII=','base64');
 await writeFile(file,NodeID3.update({image:{mime:'image/png',type:{id:3,name:'front cover'},description:'Cover',imageBuffer:image},comment:{language:'eng',text:'Keep this'}},fixture));
 const original=await readFile(file),{values,token}=await editor.readTags(file);
 await editor.writeTags({file,backupDir,token,values:{...values,title:'Über den Wolken',artist:'New artist',albumArtist:'New artist',album:'New album',year:'2026',genre:'Ambient',track:'3/12',disc:'1/2'}});
 const changed=await readFile(file),tags=NodeID3.read(changed),files=await readdir(backupDir);
 assert.equal(tags.title,'Über den Wolken');assert.equal(tags.trackNumber,'3/12');assert.equal(tags.comment.text,'Keep this');assert.deepEqual(tags.image.imageBuffer,image);
 assert.deepEqual(NodeID3.removeTagsFromBuffer(changed),NodeID3.removeTagsFromBuffer(original));assert.deepEqual(await readFile(path.join(backupDir,files[0])),original);
 const metadata=await parseFile(file);assert.equal(metadata.common.year,2026);assert.equal(metadata.common.albumartist,'New artist');assert.equal(metadata.common.track.no,3);
}));
test('stale edit and invalid values never overwrite the MP3',async()=>setup(async(file,backupDir)=>{
 const {values,token}=await editor.readTags(file);await assert.rejects(editor.writeTags({file,backupDir,token,values:{...values,year:'bad'}}),/four digits/);assert.deepEqual(await readFile(file),fixture);
 const external=NodeID3.update({title:'External edit'},fixture);await writeFile(file,external);await assert.rejects(editor.writeTags({file,backupDir,token,values}),/changed since/);assert.deepEqual(await readFile(file),external);
}));
test('collection-save failure rolls the MP3 back to original bytes',async()=>setup(async(file,backupDir)=>{
 const {values,token}=await editor.readTags(file);await assert.rejects(editor.writeTags({file,backupDir,token,values:{...values,title:'Changed'},onSaved:async()=>{throw new Error('Disk full');}}),/Disk full/);assert.deepEqual(await readFile(file),fixture);
}));
test('blank tag values clear fields on rescan',async()=>setup(async(file,backupDir)=>{
 const {values,token}=await editor.readTags(file);await editor.writeTags({file,backupDir,token,values:{...values,title:'',artist:'',album:'',year:''}});const {common}=await parseFile(file);assert.ok(!common.title);assert.ok(!common.artist);assert.ok(!common.year);
}));
test('ID3v2.4 recording year edits agree with scanner metadata',async()=>setup(async(file,backupDir)=>{
 await writeFile(file,await readFile(new URL('./fixtures/tone-v24.mp3',import.meta.url)));
 const {values,token}=await editor.readTags(file);assert.equal(values.year,'2001');
 await editor.writeTags({file,backupDir,token,values:{...values,year:'2026'}});const {common}=await parseFile(file);assert.equal(common.year,2026);
}));

test('MP3 ratings write both star bytes and RATING, preserve audio, and clear',async()=>setup(async(file,backupDir)=>{
 const {default:ratingTags}=await import('../src/rating-tags.cjs');
 const original=await readFile(file);
 for(const [rating,byte] of [[1,1],[2,64],[3,128],[4,196],[5,255],[0,0]]){
  await ratingTags.writeRating({file,backupDir,rating});const content=await readFile(file),tags=NodeID3.read(content);
  assert.equal(tags.popularimeter.rating,byte);assert.equal(tags.popularimeter.email,'Windows Media Player 9 Series');assert.equal(tags.userDefinedText.find(t=>t.description==='RATING').value,String(rating));assert.equal(ratingTags.readRating(content),rating);
  assert.deepEqual(NodeID3.removeTagsFromBuffer(content),NodeID3.removeTagsFromBuffer(original));assert.equal(tags.title,'Original');
 }
 assert.equal((await readdir(backupDir)).length,6);
}));

test('selective batch patch preserves differing fields and unknown binary frames; explicit removal removes only its frame',async()=>setup(async(file,backupDir)=>{
 const frames=(await import('../src/tag-frames.cjs')).default;
 const original=NodeID3.update({artist:'Shared',comment:{language:'eng',text:'Keep comment'},userDefinedText:[{description:'RATING',value:'4'},{description:'JUNK',value:'Remove me'}]},fixture);
 const p=frames.parse(original),raw=Buffer.concat([Buffer.from('XABC'),Buffer.from([0,0,0,4,0,0,0,1,2,255])]);
 await writeFile(file,frames.encode(p.version,[...p.frames,{raw}],p.audio));
 const before=await readFile(file),tags=await editor.readTags(file);
 assert.ok(tags.extras.some(e=>e.id==='XABC'));assert.ok(tags.extras.some(e=>e.label==='Custom: RATING'&&e.value==='4'&&e.keep));assert.equal(tags.values.comment,'Keep comment');assert.ok(!tags.extras.some(e=>e.label==='Comment'));
 const junk=tags.extras.find(e=>e.value.includes('Remove me'));
 await editor.writeTags({file,backupDir,token:tags.token,patch:{artist:'Together'},remove:[junk.key]});
 const after=await readFile(file),read=NodeID3.read(after);
 assert.equal(read.artist,'Together');assert.equal(read.title,'Original');assert.equal(read.comment.text,'Keep comment');
 assert.equal(read.userDefinedText.find(t=>t.description==='RATING').value,'4');assert.ok(!read.userDefinedText.some(t=>t.description==='JUNK'));
 assert.deepEqual(frames.parse(after).frames.find(f=>f.id==='XABC').raw,raw);assert.deepEqual(frames.parse(before).audio,frames.parse(after).audio);
}));
test('tag-only removal, explicit clearing, and unsupported ID3 headers are safe',async()=>setup(async(file,backupDir)=>{
 await writeFile(file,NodeID3.update({publisher:'Delete',comment:{language:'eng',text:'Clear me'}},fixture));
 let tags=await editor.readTags(file);await editor.writeTags({file,backupDir,token:tags.token,patch:{},remove:tags.extras.filter(e=>e.id==='TPUB').map(e=>e.key)});
 assert.ok(!NodeID3.read(await readFile(file)).publisher);assert.equal(NodeID3.read(await readFile(file)).title,'Original');assert.equal(NodeID3.read(await readFile(file)).comment.text,'Clear me');
 tags=await editor.readTags(file);await editor.writeTags({file,backupDir,token:tags.token,patch:{comment:''},remove:[]});assert.ok(!NodeID3.read(await readFile(file)).comment);
 tags=await editor.readTags(file);await editor.writeTags({file,backupDir,token:tags.token,patch:{title:''},remove:[]});assert.ok(!NodeID3.read(await readFile(file)).title);
 const bad=Buffer.from(fixture);bad[5]=128;await writeFile(file,bad);await assert.rejects(editor.readTags(file),/cannot be edited safely/);assert.deepEqual(await readFile(file),bad);
}));

test('legacy ID3v1 and APE metadata blocks are visible and explicitly removable without audio changes',async()=>setup(async(file,backupDir)=>{
 const frames=(await import('../src/tag-frames.cjs')).default;
 const legacy=Buffer.alloc(128);legacy.write('TAG');legacy.write('Legacy title',3);
 const ape=Buffer.alloc(32);ape.write('APETAGEX');ape.writeUInt32LE(2000,8);ape.writeUInt32LE(32,12);
 await writeFile(file,Buffer.concat([fixture,ape,legacy]));const tags=await editor.readTags(file);
 assert.ok(tags.extras.some(e=>e.id==='ID3v1'));assert.ok(tags.extras.some(e=>e.id==='APEv2'));
 await editor.writeTags({file,backupDir,token:tags.token,patch:{},remove:tags.extras.filter(e=>['ID3v1','APEv2'].includes(e.id)).map(e=>e.key)});
 const after=await readFile(file);assert.equal(frames.tails(after).items.length,0);assert.deepEqual(frames.parse(after).audio,frames.parse(fixture).audio);
}));

test('batch processing bounds concurrency, preserves input order and drains pending tasks before error',async()=>{
 let active=0,max=0;const order=await editor.mapTagFiles([0,1,2,3,4],async n=>{active++;max=Math.max(max,active);await new Promise(r=>setTimeout(r,n%2?2:10));active--;return n*2;});assert.deepEqual(order,[0,2,4,6,8]);assert.equal(max,2);let finished=false;await assert.rejects(editor.mapTagFiles([0,1,2],async n=>{if(n===0){await new Promise(r=>setTimeout(r,2));throw Error('Invalid edit');}await new Promise(r=>setTimeout(r,15));finished=true;}),/Invalid edit/);assert.equal(finished,true);
});

test('comment is an editable field; described comments, publisher and legacy blocks are other tags; artwork and ratings are always kept',async()=>setup(async(file,backupDir)=>{
 const frames=(await import('../src/tag-frames.cjs')).default;
 const image=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jMZkAAAAASUVORK5CYII=','base64');
 const tagged=NodeID3.update({comment:{language:'eng',text:'Vinyl rip'},publisher:'Some Label',encodingTechnology:'LAME',image:{mime:'image/png',type:{id:3,name:'front cover'},description:'',imageBuffer:image},popularimeter:{email:'Windows Media Player 9 Series',rating:196,counter:0},userDefinedText:[{description:'RATING',value:'4'},{description:'CATALOG',value:'X1'}]},fixture);
 const p=frames.parse(tagged),itunes=frames.parse(NodeID3.create({comment:{language:'eng',shortText:'iTunNORM',text:' 00000001'}})).frames[0];
 await writeFile(file,Buffer.concat([frames.encode(p.version,[...p.frames,itunes],p.audio),Buffer.from('TAG'.padEnd(128,'\0'))]));
 let tags=await editor.readTags(file);
 assert.equal(tags.values.comment,'Vinyl rip');
 assert.ok(tags.extras.some(e=>e.label==='Comment: iTunNORM'&&!e.keep));assert.ok(tags.extras.some(e=>e.label==='Publisher'&&e.value==='Some Label'));
 assert.deepEqual(tags.extras.filter(e=>e.keep).map(e=>e.id).sort(),['APIC','POPM','TXXX']);
 await editor.writeTags({file,backupDir,token:tags.token,patch:{comment:'Remastered'},remove:[]});
 tags=await editor.readTags(file);assert.equal(tags.values.comment,'Remastered');assert.ok(tags.extras.some(e=>e.label==='Comment: iTunNORM'));
 const before=await readFile(file);
 await editor.writeTags({file,backupDir,token:tags.token,patch:{},remove:tags.extras.filter(e=>!e.keep).map(e=>e.key)});
 const after=await readFile(file),read=NodeID3.read(after);tags=await editor.readTags(file);
 assert.deepEqual(tags.extras.map(e=>e.id).sort(),['APIC','POPM','TXXX']);assert.equal(tags.values.comment,'Remastered');assert.equal(read.title,'Original');
 assert.deepEqual(read.image.imageBuffer,image);assert.equal(read.popularimeter.rating,196);assert.equal(read.userDefinedText.find(t=>t.description==='RATING').value,'4');
 assert.ok(!read.publisher);assert.equal(frames.tails(after).items.length,0);assert.deepEqual(frames.parse(after).audio,frames.parse(before).audio);
}));

test('extra text fields read, write and clear frame IDs and TXXX descriptions case-insensitively without touching other frames',async()=>setup(async(file,backupDir)=>{
 const frames=(await import('../src/tag-frames.cjs')).default;
 await writeFile(file,NodeID3.update({composer:'Bach',publisher:'Label',userDefinedText:[{description:'CatalogNumber',value:'X-1'},{description:'RATING',value:'4'}]},fixture));
 let tags=await editor.readTags(file);
 const {TSSE,...custom}=tags.custom;assert.deepEqual(custom,{TCOM:'Bach',TPUB:'Label','TXXX:CatalogNumber':'X-1'});
 assert.equal(tags.extras.find(e=>e.id==='TCOM').field,'TCOM');assert.equal(tags.extras.find(e=>e.field==='TXXX:CatalogNumber').label,'Custom: CatalogNumber');assert.ok(!tags.extras.find(e=>e.label==='Custom: RATING').field);
 const before=await readFile(file);
 await editor.writeTags({file,backupDir,token:tags.token,patch:{'x:TCOM':'Johann Sebastian Bach','x:TXXX:CATALOGNUMBER':'X-2','x:TBPM':'120','x:TXXX:Mood':'Calm Ü'}});
 let read=NodeID3.read(await readFile(file));tags=await editor.readTags(file);
 assert.equal(read.composer,'Johann Sebastian Bach');assert.equal(read.bpm,'120');assert.equal(read.publisher,'Label');
 assert.deepEqual(read.userDefinedText.map(t=>[t.description,t.value]).sort(),[['CatalogNumber','X-2'],['Mood','Calm Ü'],['RATING','4']]);
 assert.deepEqual(frames.parse(await readFile(file)).audio,frames.parse(before).audio);
 await editor.writeTags({file,backupDir,token:tags.token,patch:{'x:TPUB':'','x:TXXX:mood':''}});
 tags=await editor.readTags(file);assert.deepEqual({...tags.custom,TSSE:undefined},{TCOM:'Johann Sebastian Bach','TXXX:CatalogNumber':'X-2',TBPM:'120',TSSE:undefined});
 for(const patch of [{'x:TIT2':'a'},{'x:TXXX:RATING':'5'},{'x:TXXX':'a'},{'x:WOAR':'a'},{'x:TCOM':'a\0b'}])await assert.rejects(editor.writeTags({file,backupDir,token:tags.token,patch}),/Invalid/);
}));

test('cleaning legacy metadata retains editable fields and the original audio',async()=>setup(async(file,backupDir)=>{
 const frames=(await import('../src/tag-frames.cjs')).default;
 const legacy=Buffer.alloc(128);legacy.write('TAG');legacy.write('Legacy title',3);legacy.write('Legacy artist',33);legacy.write('Legacy album',63);legacy.write('1999',93);legacy.write('Legacy comment',97);legacy[125]=0;legacy[126]=7;
 const audio=frames.parse(fixture).audio;await writeFile(file,Buffer.concat([audio,legacy]));
 const before=await editor.readTags(file);assert.equal(before.values.title,'Legacy title');
 await editor.writeTags({file,backupDir,token:before.token,patch:{},remove:before.extras.filter(x=>!x.keep).map(x=>x.key)});
 const after=await editor.readTags(file);assert.deepEqual(after.values,before.values);assert.equal(after.extras.length,0);assert.deepEqual(frames.parse(await readFile(file)).audio,audio);
}));

test('a tag replacement retry refuses an external edit made while the target was locked',async()=>setup(async(file,backupDir)=>{
 const {createRequire}=await import('node:module'),require=createRequire(import.meta.url),fs=require('node:fs/promises');
 const rename=fs.rename, before=await editor.readTags(file), external=NodeID3.update({title:'External edit during retry'},fixture);let calls=0;
 try{fs.rename=async(...args)=>{if(args[1]===file && ++calls===1){await writeFile(file,external);throw Object.assign(Error('locked'),{code:'EPERM'});}return rename(...args);};
 await assert.rejects(editor.writeTags({file,backupDir,token:before.token,patch:{title:'Should not replace'}}),/changed while saving/);
 assert.deepEqual(await readFile(file),external);assert.equal(calls,1);
 }finally{fs.rename=rename;}
}));
