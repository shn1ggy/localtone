import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
const { createOnlineUpdates, newerVersion, trustedURL } = createRequire(import.meta.url)('../online-updates.cjs');
const payload = Buffer.from('A verified desktop archive');
const sha256 = createHash('sha256').update(payload).digest('hex');
const url = name => `https://github.com/shn1ggy/localtone/releases/download/v0.112.0/${name}`;
function fixture({platform='darwin',arch='arm64',tag='v0.112.0',checksum=sha256,body=payload,assets, fetchOverride}={}) {
 const name=`Localtone-${tag.replace(/^v/,'')}-${{darwin:'mac',win32:'win',linux:'linux'}[platform]}-${arch}.zip`;
 const release={tag_name:tag,body:'Release notes <script>never run</script>',assets:assets||[{name,size:payload.length,browser_download_url:url(name)},{name:'checksums.json',browser_download_url:url('checksums.json')}]};
 const fetch=fetchOverride|| (async address => new Response(address.includes('/releases?')?JSON.stringify([release]):address.endsWith('checksums.json')?JSON.stringify({schema:1,artifacts:[{name,size:payload.length,sha256:checksum}]}):body));
 const progress=[];
 return {name,service:createOnlineUpdates({fetch,version:'0.111.0',platform,arch,progress:value=>progress.push(value)}),progress};
}
async function directory(fn) {const dir=await mkdtemp(path.join(tmpdir(),'localtone-online-'));try {await fn(dir);}finally{await rm(dir,{recursive:true,force:true});}}
test('release selection matches OS and architecture and compares numeric versions',async()=>{
 assert.equal(newerVersion('v0.112.0','0.111.0'),true);assert.equal(newerVersion('0.9.0','0.111.0'),false);assert.equal(newerVersion('0.111.0','0.111.0'),false);assert.throws(()=>newerVersion('v1.0.0-beta','0.111.0'));
 for(const platform of ['darwin','win32','linux'])for(const arch of ['arm64','x64']) {const {name,service}=fixture({platform,arch});assert.equal((await service.check()).name,name);}
 assert.deepEqual(await fixture({tag:'v0.110.0'}).service.check(),{available:false,version:'0.111.0'});
 await assert.rejects(fixture({assets:[]}).service.check(),/compatible/);
 await assert.rejects(fixture({checksum:'bad'}).service.check(),/checksum/);
});
test('verified downloads are atomic, bounded, and preserve existing destination files',()=>directory(async dir=>{
 const {service,name,progress}=fixture();await service.check();const file=path.join(dir,name);
 assert.equal((await service.download(file)).version,'0.112.0');assert.deepEqual(await readFile(file),payload);assert.equal(progress.at(-1).received,payload.length);assert.deepEqual(await readdir(dir),[name]);
 await assert.rejects(service.download(file),/already exists/);assert.deepEqual(await readFile(file),payload);
 await assert.rejects(service.download(path.join(dir,'wrong.zip'),'wrong.zip'),/changed/);
 for(const body of [Buffer.alloc(payload.length,1),Buffer.from('short'),Buffer.alloc(payload.length+1)]){const broken=fixture({body}).service;await broken.check();await assert.rejects(broken.download(path.join(dir,'broken.zip')),/verification|exceeds/);assert.deepEqual(await readdir(dir),[name]);}
}));
test('metadata/network errors have actionable outcomes and unsafe redirects are rejected',async()=>{
 for(const [status,pattern] of [[404,/public release/],[403,/limited/],[429,/limited/],[500,/500/]])await assert.rejects(fixture({fetchOverride:async()=>new Response('',{status})}).service.check(),pattern);
 for(const target of ['http://github.com/file','https://evil.example/file','https://github.com@evil.example/file','https://github.com:444/file'])assert.throws(()=>trustedURL(target),/untrusted/);
 await assert.rejects(fixture({fetchOverride:async()=>new Response(null,{status:302,headers:{location:'https://evil.example/file'}})}).service.check(),/untrusted/);
 await assert.rejects(fixture({fetchOverride:async()=>new Response('x'.repeat(4*1024**2+1))}).service.check(),/too large/);
});
test('cancelled operations remove partial files and can be retried; duplicate checks are blocked',()=>directory(async dir=>{
 let block=false,started;
 const wait=new Promise(resolve=>started=resolve);
 const {service}=fixture({fetchOverride:async(address,{signal})=>{
  if(address.includes('/releases?'))return new Response(JSON.stringify([{tag_name:'v0.112.0',assets:[{name:'Localtone-0.112.0-mac-arm64.zip',size:payload.length,browser_download_url:url('archive.zip')},{name:'checksums.json',browser_download_url:url('checksums.json')}]}]));
  if(address.endsWith('checksums.json'))return new Response(JSON.stringify({schema:1,artifacts:[{name:'Localtone-0.112.0-mac-arm64.zip',size:payload.length,sha256}]}));
  if(block){started();return await new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}));}
  return new Response(payload);
 }});
 await service.check();block=true;const task=service.download(path.join(dir,'update.zip'));await wait;
 await assert.rejects(service.check(),/already running/);service.cancel();assert.deepEqual(await task,{cancelled:true});assert.deepEqual(await readdir(dir),[]);
 block=false;await service.download(path.join(dir,'update.zip'));assert.deepEqual(await readFile(path.join(dir,'update.zip')),payload);
}));

test('early-access releases are recognized, drafts ignored and numeric versions ordered',async()=>{
 const service = (version, releases) => createOnlineUpdates({version,platform:'darwin',arch:'arm64',fetch:async address=>{
  assert.match(address,/\/releases\?per_page=100$/);
  return new Response(JSON.stringify(releases));
 }});
 const releases=[{tag_name:'v0.114.0',prerelease:true},{tag_name:'v0.115.0',prerelease:true},{tag_name:'v0.999.0',draft:true},{tag_name:'nightly',prerelease:true}];
 assert.deepEqual(await service('0.115.0',releases).check(),{available:false,version:'0.115.0'});
 await assert.rejects(service('0.114.0',releases).check(),/compatible verified/);
 assert.deepEqual(await service('1.0.0',[{tag_name:'v1.1.0',prerelease:true},{tag_name:'v1.0.0',prerelease:false}]).check(),{available:false,version:'1.0.0'});
 await assert.rejects(service('0.115.0',[]).check(),/No published Localtone/);
 await assert.rejects(service('1.0.0',[{tag_name:'v1.1.0',prerelease:true}]).check(),/No stable Localtone/);
});

test('trusted manual redirects work for both checksums and archives while unsafe targets are never fetched',()=>directory(async dir=>{
 const requested=[];const name='Localtone-0.112.0-mac-arm64.zip';
 const redirected='https://release-assets.githubusercontent.com/asset/';
 const service=fixture({fetchOverride:async(address,options)=>{requested.push(address);assert.equal(options.redirect,'manual');
 if(address.includes('/releases?'))return new Response(JSON.stringify([{tag_name:'v0.112.0',assets:[{name,size:payload.length,browser_download_url:url(name)},{name:'checksums.json',browser_download_url:url('checksums.json')}]}]));
 if(address.startsWith('https://github.com/'))return new Response(null,{status:302,headers:{location:redirected+(address.endsWith('checksums.json')?'checksums':'archive')}});
 return new Response(address.endsWith('checksums')?JSON.stringify({schema:1,artifacts:[{name,size:payload.length,sha256}]}):payload);
 }}).service;await service.check();await service.download(path.join(dir,name));assert.deepEqual(await readFile(path.join(dir,name)),payload);assert.ok(requested.includes(redirected+'checksums'));assert.ok(requested.includes(redirected+'archive'));
}));
