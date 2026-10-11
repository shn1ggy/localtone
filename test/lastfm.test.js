import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,copyFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createCipheriv,createDecipheriv,createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {ListenTracker} from '../app/listen.js';
const require=createRequire(import.meta.url),{LastfmService,signature,metadataFor}=require('../lastfm.cjs'),ID3=require('node-id3');
const key='a'.repeat(32),secret='b'.repeat(32),token='c'.repeat(32);
const storage={isEncryptionAvailable:()=>true,getSelectedStorageBackend:()=> 'test',encryptString:value=>{const cipher=createCipheriv('aes-256-cbc',Buffer.alloc(32,7),Buffer.alloc(16,8));return Buffer.concat([cipher.update(value),cipher.final()]);},decryptString:bytes=>{const cipher=createDecipheriv('aes-256-cbc',Buffer.alloc(32,7),Buffer.alloc(16,8));return Buffer.concat([cipher.update(bytes),cipher.final()]).toString();}};
const metadata={artist:'Nine Inch Nails',track:'A song',album:'Album',duration:100};
async function fixture(authToken=token){const directory=await mkdtemp(path.join(tmpdir(),'localtone-lastfm-')),calls=[],urls=[];let mode='success',time=1800000000000;
 const fetch=async(url,options)=>{const params=new URLSearchParams(options.body||new URL(url).search);const method=params.get('method');calls.push({method,params,url,options});assert.ok(url.startsWith('https://ws.audioscrobbler.com/2.0/'));assert.equal(params.get('api_sig'),signature(Object.fromEntries(params),secret));
  if(method==='auth.getToken')return {ok:true,json:async()=>({token:authToken})};if(method==='auth.getSession')return {ok:true,json:async()=>mode==='denied'?{error:15}:{session:{name:'nico',key:'session-key'}}};
  if(mode==='offline')throw new Error('network failed');if(mode==='expired')return {ok:true,json:async()=>({error:9})};if(mode==='bad-signature')return {ok:true,json:async()=>({error:13})};
  return {ok:true,json:async()=>({scrobbles:{scrobble:{ignoredMessage:{code:mode==='ignored'?'1':'0'}}}})};
 };
 const options={directory,storage,fetch,openExternal:async url=>urls.push(url),clock:()=>time};const service=new LastfmService(options);await service.init();
 return {service,options,calls,urls,mode:v=>{mode=v;},advance:()=>{time+=120000;},cleanup:async()=>{await service.close();await rm(directory,{recursive:true,force:true});}};
}
test('Last.fm signs UTF-8 parameters alphabetically and excludes response format',()=>{const params={method:'test',track:'Ä song',api_key:key,format:'json'};assert.equal(signature(params,secret),createHash('md5').update('api_key'+key+'methodtesttrackÄ song'+secret).digest('hex'));});
test('browser authorization, encrypted credentials, offline retry, deduplication and disconnect',async()=>{
 const f=await fixture();try{const s=f.service;await s.saveCredentials(key,secret);await s.connect();assert.equal(new URL(f.urls[0]).hostname,'www.last.fm');assert.equal(new URL(f.urls[0]).searchParams.get('token'),token);
  f.mode('denied');await assert.rejects(s.finish(),/Approve access/);f.mode('success');await s.finish();assert.equal(s.status().username,'nico');assert.equal(s.status().enabled,true);
  const disk=await readFile(s.file);assert.equal(disk.includes(Buffer.from(secret)),false);assert.equal(disk.includes(Buffer.from('session-key')),false);assert.equal(JSON.stringify(s.status()).includes(secret),false);
  f.mode('offline');const play={playId:'play-1',timestamp:1800000000,heard:50};await s.submit('scrobble',play,metadata);await s.flush();assert.equal(s.status().pending,1);
  await s.submit('scrobble',play,metadata);assert.equal(s.status().pending,1);await s.close();f.mode('success');
  const restored=new LastfmService(f.options);await restored.init();await restored.flush();assert.equal(restored.status().pending,0);assert.equal(restored.status().username,'nico');
  const sent=f.calls.filter(c=>c.method==='track.scrobble').at(-1);assert.equal(sent.params.get('timestamp'),'1800000000');assert.equal(sent.options.method,'POST');
  await restored.disconnect();assert.equal(restored.status().connected,false);assert.equal(restored.status().enabled,false);await restored.close();
 }finally{await f.cleanup();}
});
test('missing tags and short listening do not scrobble; revoked sessions retain queue for reconnection',async()=>{
 const f=await fixture();try{const s=f.service;await s.saveCredentials(key,secret);await s.connect();await s.finish();
  await s.submit('scrobble',{playId:'short',timestamp:1800000000,heard:49},metadata);await s.submit('scrobble',{playId:'untagged',timestamp:1800000000,heard:80},{...metadata,artist:''});assert.equal(s.status().pending,0);
  f.mode('expired');await s.submit('scrobble',{playId:'valid',timestamp:1800000000,heard:50},metadata);await s.flush();assert.equal(s.status().pending,1);assert.equal(s.status().connected,false);assert.equal(s.status().enabled,false);
  f.mode('success');await s.connect();await s.finish();await s.flush();assert.equal(s.status().pending,0);
 }finally{await f.cleanup();}
});
test('no plaintext credential fallback when secure OS storage is unavailable',async()=>{const f=await fixture();try{f.service.storage={isEncryptionAvailable:()=>false};await assert.rejects(f.service.saveCredentials(key,secret),/Secure credential/);assert.equal(f.service.status().configured,false);}finally{await f.cleanup();}});
test('listening excludes pause and seek time, submits once per play, repeats and respects minimum duration',()=>{
 let now=0;const calls=[],tracker=new ListenTracker((...args)=>calls.push(args),()=>now,()=>1800000000000+now);
 tracker.begin({id:'song',duration:100});tracker.playing(0);now=20000;tracker.sample(20);tracker.pause(20);now=80000;tracker.playing(20);tracker.seek(70);now=100000;tracker.sample(90);assert.equal(calls.filter(c=>c[0]==='scrobble').length,0);
 now=110000;tracker.end(100);assert.equal(calls.filter(c=>c[0]==='scrobble').length,1);tracker.sample(100);assert.equal(calls.length,2);
 tracker.playing(0);now+=50000;tracker.sample(50);assert.equal(calls.filter(c=>c[0]==='scrobble').length,2);assert.notEqual(calls[0][1].playId,calls[2][1].playId);
 tracker.begin({id:'short',duration:30});tracker.playing(0);now+=30000;tracker.end(30);assert.equal(calls.filter(c=>c[0]==='scrobble').length,2);
 tracker.begin({id:'long',duration:1000});tracker.playing(0);now+=240000;tracker.sample(240);assert.equal(calls.filter(c=>c[0]==='scrobble').length,3);
});
test('scrobble metadata comes from file tags, never a filename or artist-folder label',async()=>{const dir=await mkdtemp(path.join(tmpdir(),'localtone-tags-'));try{const file=path.join(dir,'Misleading title.mp3');await copyFile(new URL('./fixtures/tone.mp3',import.meta.url),file);ID3.removeTags(file);let tags=await metadataFor({path:file,duration:60});assert.equal(tags.artist,'');assert.equal(tags.track,'');ID3.update({artist:'Real artist',title:'Real title'},file);tags=await metadataFor({path:file});assert.equal(tags.artist,'Real artist');assert.equal(tags.track,'Real title');}finally{await rm(dir,{recursive:true,force:true});}});

test('authorization tokens are opaque: nonhex and variable-length tokens reach browser and session exchange unchanged',async()=>{
 for(const value of ['GzYpQrx9VmT2Nw6LhJsK7UbC4AeF0DoS','opaque-token_with+symbols/=']){
  const f=await fixture(value);try{await f.service.saveCredentials(key,secret);await f.service.connect();assert.equal(new URL(f.urls[0]).searchParams.get('token'),value);await f.service.finish();assert.equal(f.calls.find(call=>call.method==='auth.getSession').params.get('token'),value);assert.equal(f.service.status().connected,true);}finally{await f.cleanup();}
 }
});
test('missing or malformed tokens never open the browser',async()=>{
 for(const value of [null,{},'',123,'bad\ntoken']){
  const f=await fixture(value);try{await f.service.saveCredentials(key,secret);await assert.rejects(f.service.connect(),/usable authorization token/);assert.equal(f.urls.length,0);}finally{await f.cleanup();}
 }
});

test('closing Last.fm stops a flush after its in-flight request and keeps remaining scrobbles',async()=>{const f=await fixture();try{const s=f.service;await s.saveCredentials(key,secret);await s.connect();await s.finish();await s.chain;let resolve,calls=0;s.fetch=()=>{calls++;return new Promise(r=>resolve=r);};s.data.queue=[{playId:'one',params:{artist:'Artist',track:'First',timestamp:'1800000000'}},{playId:'two',params:{artist:'Artist',track:'Second',timestamp:'1800000000'}}];await s.persist();const flushing=s.flush();await new Promise(r=>setImmediate(r));const closing=s.close();resolve({ok:true,json:async()=>({scrobbles:{scrobble:{ignoredMessage:{code:'0'}}}})});await flushing;await closing;assert.equal(calls,1);assert.equal(s.data.queue.length,1);const persisted=JSON.parse(storage.decryptString(await readFile(s.file)));assert.equal(persisted.queue[0].playId,'two');}finally{await f.cleanup();}});
