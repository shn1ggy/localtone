import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {verifyDownloads} from '../build/verify-downloads.mjs';
const require = createRequire(import.meta.url);
const {binaryArchitectures,inspectBinary,packagedNotices} = require('../build/package-audit.cjs');
function elf(machine) {const b=Buffer.alloc(64);Buffer.from([127,69,76,70,2,1]).copy(b);b.writeUInt16LE(machine,18);return b;}
async function fixture(fn) {const dir=await fs.mkdtemp(path.join(os.tmpdir(),'localtone-package-'));try{await fn(dir);}finally{await fs.rm(dir,{force:true,recursive:true});}}
test('executable inspection recognizes ELF, PE, thin and universal Mach-O processors',()=>{
 assert.deepEqual(binaryArchitectures(elf(62)),['x64']);assert.deepEqual(binaryArchitectures(elf(183)),['arm64']);
 const pe=Buffer.alloc(256);pe.write('MZ');pe.writeUInt32LE(128,60);pe.writeUInt32LE(0x4550,128);pe.writeUInt16LE(0xaa64,132);assert.deepEqual(binaryArchitectures(pe),['arm64']);
 const thin=Buffer.alloc(32);thin.writeUInt32LE(0xfeedfacf);thin.writeUInt32LE(0x1000007,4);assert.deepEqual(binaryArchitectures(thin),['x64']);
 const fat=Buffer.alloc(48);fat.writeUInt32BE(0xcafebabe);fat.writeUInt32BE(2,4);fat.writeUInt32BE(0x1000007,8);fat.writeUInt32BE(0x100000c,28);assert.deepEqual(binaryArchitectures(fat),['x64','arm64']);
 assert.throws(()=>binaryArchitectures(Buffer.alloc(10)),/header/);pe.writeUInt32LE(1000,60);assert.throws(()=>binaryArchitectures(pe),/header/);fat.writeUInt32BE(32,4);assert.throws(()=>binaryArchitectures(fat),/header/);
});
test('packaging rejects a decoder built for the wrong processor before it can be executed',()=>fixture(async dir=>{
 const file=path.join(dir,'ffmpeg');await fs.writeFile(file,elf(62));assert.deepEqual((await inspectBinary(file,'x64')).architectures,['x64']);
 await assert.rejects(inspectBinary(file,'arm64'),/processor mismatch/);await assert.rejects(inspectBinary(file,'universal'),/processor mismatch/);
}));
test('dependency inventory retains nested packages and the notices actually packaged',()=>fixture(async dir=>{
 const source=path.join(dir,'source'),folder=path.join(source,'node_modules','a','node_modules','b');await fs.mkdir(folder,{recursive:true});
 await fs.writeFile(path.join(source,'node_modules','a','package.json'),JSON.stringify({name:'a',version:'1',license:'MIT'}));
 await fs.writeFile(path.join(source,'node_modules','a','LICENSE'),'Copyright A');await fs.writeFile(path.join(folder,'package.json'),JSON.stringify({name:'b',version:'2'}));await fs.writeFile(path.join(folder,'NOTICE.txt'),'Copyright B');
 const archive=path.join(dir,'app.asar');await require('@electron/asar').createPackage(source,archive);
 const result=await packagedNotices(archive);assert.deepEqual(result.packages.map(p=>p.name),['b','a']);assert.match(result.text,/Copyright A/);assert.match(result.text,/Copyright B/);assert.equal(result.packages[0].license,'Unspecified');
 const asar=require('@electron/asar'),list=asar.listPackage,normalListing=await packagedNotices(archive,source);
 // Exercise Windows archive listings even when this regression runs on Unix.
 asar.listPackage=(...args)=>list(...args).map(name=>name.replaceAll('/','\\'));
 try{assert.deepEqual(await packagedNotices(archive,source),normalListing);}finally{asar.listPackage=list;}
 await fs.writeFile(path.join(source,'node_modules','a','NOTICE'),'Additional copyright');const withInstalled=await packagedNotices(archive,source);assert.match(withInstalled.text,/Additional copyright/);assert.deepEqual(withInstalled.packages[1].additionalNotices,['node_modules/a/NOTICE']);
 await fs.writeFile(path.join(folder,'package.json'),JSON.stringify({name:'b',version:'different'}));const mismatched=await packagedNotices(archive,source);assert.equal(mismatched.packages[0].noticeSourceUnavailable,true);
 await fs.writeFile(path.join(source,'package-lock.json'),JSON.stringify({packages:{'node_modules/a/node_modules/b':{version:'2'}}}));await fs.writeFile(path.join(folder,'package.json'),JSON.stringify({name:'b',version:'2'}));assert.equal((await packagedNotices(archive,source)).packages[0].noticeSourceUnavailable,false);
}));
test('download verification accepts native and source checksum files and detects mixed or truncated downloads',()=>fixture(async dir=>{
 const data=Buffer.from('Downloaded app'),name='Localtone.zip',sha256=createHash('sha256').update(data).digest('hex');await fs.writeFile(path.join(dir,name),data);
 const manifest=path.join(dir,'checksums.json');await fs.writeFile(manifest,JSON.stringify({schema:1,artifacts:[{name,size:data.length,sha256}]}));assert.deepEqual(await verifyDownloads(manifest),[name]);
 const sums=path.join(dir,'SHA256SUMS.txt');await fs.writeFile(sums,sha256+'  '+name+'\n');assert.deepEqual(await verifyDownloads(sums),[name]);
 await fs.writeFile(path.join(dir,name),'Other');await assert.rejects(verifyDownloads(manifest),/size/);await assert.rejects(verifyDownloads(sums),/Checksum/);
 await fs.rm(path.join(dir,name));await assert.rejects(verifyDownloads(sums),/ENOENT/);
}));
test('download verification rejects traversal, duplicate names and empty manifests',()=>fixture(async dir=>{
 const manifest=path.join(dir,'checksums.json'),item={name:'../secret',sha256:'a'.repeat(64)};
 await fs.writeFile(manifest,JSON.stringify({schema:1,artifacts:[item]}));await assert.rejects(verifyDownloads(manifest),/Invalid/);
 item.name='same.zip';await fs.writeFile(manifest,JSON.stringify({schema:1,artifacts:[item,item]}));
 // First file must exist before duplicate validation is reached.
 await fs.writeFile(path.join(dir,item.name),'x');item.sha256=createHash('sha256').update('x').digest('hex');await fs.writeFile(manifest,JSON.stringify({schema:1,artifacts:[item,{...item,name:'SAME.zip'}]}));await assert.rejects(verifyDownloads(manifest),/duplicate/);
 await fs.writeFile(manifest,JSON.stringify({schema:1,artifacts:[]}));await assert.rejects(verifyDownloads(manifest),/count/);
}));
test('license text embedded in an omitted README remains in shipped notices',()=>fixture(async dir=>{
 const source=path.join(dir,'source'),pkg=path.join(source,'node_modules','legacy');await fs.mkdir(pkg,{recursive:true});
 await fs.writeFile(path.join(pkg,'package.json'),JSON.stringify({name:'legacy',version:'1',license:'MIT'}));
 await fs.writeFile(path.join(pkg,'index.js'),'module.exports=1;');
 const archive=path.join(dir,'app.asar');await require('@electron/asar').createPackage(source,archive);
 await fs.writeFile(path.join(pkg,'README.md'),'# Package\n\n## License\nCopyright (c) Example\nPermission is hereby granted to use this software.');
 const report=await packagedNotices(archive,source);assert.match(report.text,/Copyright \(c\) Example/);assert.deepEqual(report.packages[0].additionalNotices,['node_modules/legacy/README.md (license section)']);
 await fs.writeFile(path.join(pkg,'README.md'),'Package\n\nLicense\n-------\n\nCopyright (c) Other\nPermission is hereby granted to use this software.');
 const underlined=await packagedNotices(archive,source);assert.match(underlined.text,/Copyright \(c\) Other/);assert.equal(underlined.packages[0].additionalNotices.length,1);
}));
