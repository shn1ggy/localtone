import test from 'node:test';
import assert from 'node:assert/strict';
import repair from '../library-repair.cjs';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
test('reconnection handles Windows/POSIX relative paths and refuses outside-library entries',()=>{assert.deepEqual(repair.relativeFile('D:\\Music','D:\\Music\\Artist\\Album\\01.mp3'),['Artist','Album','01.mp3']);assert.deepEqual(repair.relativeFile('/Music','/Music/Artist/01.mp3'),['Artist','01.mp3']);assert.throws(()=>repair.relativeFile('/Music','/Other/file.mp3'));assert.throws(()=>repair.relativeFile('D:\\Music','E:\\Music\\a.mp3'));});
test('reconnection rejects mismatched files and zero matches without writing anything',async()=>{const dir=await mkdtemp(path.join(os.tmpdir(),'repair-match-'));try{await mkdir(path.join(dir,'Artist'));await writeFile(path.join(dir,'Artist','a.mp3'),'different');const tracks=[{id:'same-id',path:'/old/Artist/a.mp3',size:1}];await assert.rejects(repair.planReconnect({root:'/old'},tracks,dir),/differs/);assert.equal(tracks[0].path,'/old/Artist/a.mp3');const plan=await repair.planReconnect({root:'/old'},[{...tracks[0],size:9},{id:'missing',path:'/old/Artist/b.mp3',size:1}],dir);assert.equal(plan.matches,1);assert.equal(plan.missing,1);assert.equal(plan.tracks[0].id,'same-id');}finally{await rm(dir,{recursive:true,force:true});}});

test('renamed-file suggestions use size and metadata as hints, never as automatic identity',()=>{
 const old={id:'old',libraryId:'l',size:100,duration:60,title:'Song',artist:'Artist',album:'Album'};
 const candidates=repair.suggestedMatches(old,[{...old,id:'same',path:'/same.mp3'},{...old,id:'edited',size:200,path:'/edited.mp3'},{id:'unrelated',libraryId:'l',size:1,title:'Other',duration:12,path:'/other.mp3'},{...old,id:'other-library',libraryId:'else',path:'/else.mp3'}]);
 assert.deepEqual(candidates.map(t=>t.id),['same','edited']);assert.deepEqual(candidates[0].reasons,['size','duration','title','artist','album']);
});
test('individual reconnect validates actual absence and an available audio file inside the library',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'repair-single-'));
 try{const library={id:'l',root:dir},old={id:'old',libraryId:'l',path:path.join(dir,'old.mp3')},file=path.join(dir,'new.mp3');await writeFile(file,'audio');const {realpath}=await import('node:fs/promises');const canonical=await realpath(file);const plan=await repair.planTrackReconnect(library,old,file,[{id:'new',libraryId:'l',path:canonical}]);assert.deepEqual(plan.duplicates,['new']);await assert.rejects(repair.requireMissing({...old,path:file}),/available again/);await assert.rejects(repair.planTrackReconnect(library,old,file,[{id:'other',libraryId:'different',path:canonical}]),/another library/);
 }finally{await rm(dir,{recursive:true,force:true});}
});
