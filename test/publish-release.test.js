import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp,writeFile,rm,readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
const plan=JSON.parse(await readFile(new URL('../build/release-plan.json',import.meta.url)));
const script=new URL('../build/publish-release.mjs',import.meta.url).href;
function run(mock,args=['--wait']){
 const code=`delete process.env.GITHUB_OUTPUT;process.env.GH_TOKEN='test-only';process.argv=['node','publish',...${JSON.stringify(args)}];globalThis.fetch=${mock};await import(${JSON.stringify(script)});`;
 return spawnSync(process.execPath,['--input-type=module','-e',code],{encoding:'utf8'});
}
const identity={head_sha:plan.commit,head_branch:'main',event:'push',status:'completed',conclusion:'success'};
test('publishing refuses a different commit or unsuccessful build before any writes',()=>{
 for(const changes of [{head_sha:'different'},{head_branch:'other'},{event:'pull_request'},{conclusion:'failure'}]){
  const state={...identity,...changes};const r=run(`async(url,options)=>{if(options.method!=='GET')throw Error('Unexpected mutation');return {ok:true,json:async()=>(${JSON.stringify(state)})}}`);
  assert.notEqual(r.status,0);assert.match(r.stderr,/Build identity|did not succeed/);
 }
});
test('verified-build waiting accepts only the approved successful main push',()=>{
 const r=run(`async()=>({ok:true,json:async()=>(${JSON.stringify(identity)})})`);assert.equal(r.status,0,r.stderr);
});
test('release publication verifies upload digests before turning a draft public',async()=>{
 const folder=await mkdtemp(path.join(tmpdir(),'localtone-publish-'));
 try {
  const names=['mac-arm64.zip','mac-x64.zip','win-x64.zip','linux-x64.zip',...['darwin-arm64','darwin-x64','win32-x64','linux-x64'].map(x=>'ffmpeg-source-'+x+'.tar.gz')].map(x=>'Localtone-'+plan.version+'-'+x);
  names.push('Localtone-v'+plan.version.replace(/\.0$/, '')+'-source.zip');const artifacts=[];
  for(const name of names){const data=Buffer.from(name);await writeFile(path.join(folder,name),data);artifacts.push({name,size:data.length,sha256:createHash('sha256').update(data).digest('hex')});}
  await writeFile(path.join(folder,'checksums.json'),JSON.stringify({schema:1,artifacts}));await writeFile(path.join(folder,'SHA256SUMS.txt'),'checksums');
  const mock=`(()=>{const assets=[];const draft={id:1,tag_name:${JSON.stringify(plan.tag)},draft:true,assets,upload_url:'https://uploads.github.com/repos/shn1ggy/localtone/releases/1/assets{?name,label}'};return async(url,options)=>{
   let result;if(url.includes('/actions/runs/'))result=${JSON.stringify(identity)};
   else if(options.method==='GET'&&url.endsWith('/releases'))result=[draft];
   else if(url.includes('uploads.github.com')){const name=new URL(url).searchParams.get('name');const {createHash}=await import('node:crypto');const hash=createHash('sha256');let size=0;for await(const chunk of options.body){hash.update(chunk);size+=chunk.length;}result={name,size,digest:'sha256:'+hash.digest('hex')};assets.push(result);}
   else if(options.method==='GET'&&url.endsWith('/assets'))result=assets;
   else if(options.method==='PATCH'){const body=JSON.parse(options.body);if(body.draft===false){if(assets.length!==11)throw Error('Publishing incomplete assets');result={draft:false,prerelease:true,html_url:'https://github.com/shn1ggy/localtone/releases/tag/${plan.tag}'};}else result=draft;}
   else throw Error('Unexpected API call');return {ok:true,json:async()=>result};};})()`;
  const good=run(mock,[folder]);assert.equal(good.status,0,good.stderr);assert.match(good.stdout,/Published verified/);
  const bad=run(mock.replace("'sha256:'+hash.digest('hex')","'sha256:wrong'"),[folder]);assert.notEqual(bad.status,0);assert.match(bad.stderr,/integrity mismatch/);assert.doesNotMatch(bad.stdout,/Published verified/);
 }finally{await rm(folder,{recursive:true,force:true});}
});
