import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { assembleDownloads } from '../build/assemble-downloads.mjs';
test('release assembly combines verified platform downloads and rejects damaged or existing candidates',async()=>{
 const root=await fs.mkdtemp(path.join(tmpdir(),'localtone-assembly-'));
 try {
 const input=path.join(root,'input');await fs.mkdir(input);
 for(const platform of ['mac-arm64','mac-x64','win-x64','linux-x64']){
  const dir=path.join(input,platform);await fs.mkdir(dir);
  const name=`Localtone-0.112.0-${platform}.zip`,body=Buffer.from(platform);
  await fs.writeFile(path.join(dir,name),body);
  await fs.writeFile(path.join(dir,'checksums.json'),JSON.stringify({schema:1,artifacts:[{name,size:body.length,sha256:createHash('sha256').update(body).digest('hex')}]}));
 }
 const output=path.join(root,'output');assert.equal((await assembleDownloads(input,output)).length,4);
 const report=JSON.parse(await fs.readFile(path.join(output,'checksums.json')));assert.equal(report.artifacts.length,4);
 await assert.rejects(assembleDownloads(input,output),/EEXIST/);
 await fs.writeFile(path.join(input,'mac-arm64','Localtone-0.112.0-mac-arm64.zip'),'damaged');
 await assert.rejects(assembleDownloads(input,path.join(root,'bad')),/verification/);
 await assert.rejects(fs.access(path.join(root,'bad')));
 } finally {await fs.rm(root,{recursive:true,force:true});}
});
