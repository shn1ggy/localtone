import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ProgressiveAudio } from '../app/progressive-audio.js';
const require = createRequire(import.meta.url);
const { StreamDecoder } = require('../src/stream-decoder.cjs');
const ffmpeg = require('ffmpeg-static');
const rate = 8000;
function wav(seconds = 3) {
  const frames = Math.round(seconds * rate), b = Buffer.alloc(44 + frames * 8);
  b.write('RIFF'); b.writeUInt32LE(b.length - 8, 4); b.write('WAVEfmt ', 8);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(3, 20); b.writeUInt16LE(2, 22);
  b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * 8, 28);
  b.writeUInt16LE(8, 32); b.writeUInt16LE(32, 34); b.write('data', 36);
  b.writeUInt32LE(frames * 8, 40);
  for (let i = 0; i < frames; i++) for (let c = 0; c < 2; c++) b.writeFloatLE(.2 * Math.sin(i * .037), 44 + i * 8 + c * 4);
  return b;
}
async function fixture(run) {
  const root = await mkdtemp(path.join(tmpdir(), 'localtone-stream-test-'));
  const decoder = new StreamDecoder(ffmpeg), file = path.join(root, 'tone.wav');
  await writeFile(file, wav());
  try { await run({ decoder, file, root }); }
  finally { await decoder.dispose(); await rm(root, { recursive: true, force: true }); }
}
async function drain(decoder, token) {
  const chunks = [];
  for (;;) { const data = await decoder.read(token); chunks.push(Buffer.from(data.pcm)); if (data.eof) break; }
  return Buffer.concat(chunks);
}
test('progressive decoder delivers small chunks without the whole-song limit; all samples remain exact', () => fixture(async ({ decoder, file }) => {
  const item = await decoder.open({ path: file, duration: 3600 }, rate);
  const first = await decoder.read(item.token);
  assert.equal(first.pcm.byteLength, rate * 8 / 2);
  assert.equal(first.eof, false);
  const rest = await drain(decoder, item.token);
  assert.deepEqual(Buffer.concat([Buffer.from(first.pcm), rest]), wav().subarray(44));
  await decoder.close(item.token);
  assert.equal(decoder.sessions.size, 0);
}));
test('seeking starts at the requested sample and cancelling a stalled preload releases its process', () => fixture(async ({ decoder, file }) => {
  const item = await decoder.open({ path: file, duration: 3 }, rate, 1.25);
  assert.deepEqual(await drain(decoder, item.token), wav().subarray(44 + rate * 8 * 1.25));
  const next = await decoder.open({ path: file, duration: 3 }, rate);
  const reading = decoder.read(next.token).catch(() => null);
  await decoder.close(next.token); await reading;
  assert.equal(decoder.sessions.has(next.token), false);
}));
test('editing the original leaves delivered and remaining playback samples intact', () => fixture(async ({ decoder, file }) => {
  const item = await decoder.open({ path: file, duration: 3 }, rate);
  const first = await decoder.read(item.token);
  await decoder.beforeWrite(file);
  await writeFile(file, Buffer.from('replaced original'));
  const rest = await drain(decoder, item.token);
  assert.deepEqual(Buffer.concat([Buffer.from(first.pcm), rest]), wav().subarray(44));
}));
test('MP3 edit handoff preserves decoder samples and encoder padding', () => fixture(async ({ decoder, file, root }) => {
  const mp3 = path.join(root, 'tone.mp3');
  assert.equal(spawnSync(ffmpeg, ['-v', 'error', '-i', file, '-c:a', 'libmp3lame', mp3]).status, 0);
  const reference = await decoder.open({ path: mp3, duration: 3 }, rate);
  const expected = await drain(decoder, reference.token); await decoder.close(reference.token);
  const item = await decoder.open({ path: mp3, duration: 3 }, rate);
  const first = await decoder.read(item.token); await decoder.beforeWrite(mp3);
  const actual = Buffer.concat([Buffer.from(first.pcm), await drain(decoder, item.token)]);
  assert.equal(actual.length, expected.length);
  let different=0, firstDifference=-1, last=-1, maximum=0;
  for(let i=0;i<actual.length;i+=4){const difference=Math.abs(actual.readFloatLE(i)-expected.readFloatLE(i));if(difference>1e-6){different++;if(firstDifference<0)firstDifference=i/8;last=i/8;maximum=Math.max(maximum,difference);}}
  assert.equal(different,0, JSON.stringify({different,firstDifference,last,maximum}));
}));
class Native extends EventTarget { pause() {} load() {} removeAttribute() {} async play() {} }
function context() {
  return { currentTime: 0, sampleRate: rate, destination: {}, nodes: [],
    createGain: () => ({ gain: { value: 1 }, connect() {} }),
    createBuffer(c, n, r) { const channels = Array.from({length:c}, () => new Float32Array(n)); return { duration:n/r, getChannelData:i=>channels[i] }; },
    createBufferSource() { const node = { connect(){},disconnect(){},stop(){this.stopped=true;},start(when,offset=0){this.when=when;this.offset=offset;} }; this.nodes.push(node); return node; },
    async resume(){}, async close(){},
  };
}
const tick = () => new Promise(r => setImmediate(r));
function player(length = 3) {
  const ctx = context(), calls = [], positions = new Map(); let serial=0;
  const stream = {
    async open(id, sampleRate, offset) { const token = String(++serial); calls.push(id); positions.set(token, offset); return { token, duration:length }; },
    async read(token) { const offset = positions.get(token); const seconds=Math.max(0,Math.min(.5,length-offset)); positions.set(token,offset+seconds); return {pcm:new Uint8Array(new Float32Array(Math.round(seconds*rate)*2).fill(.2).buffer),eof:offset+seconds>=length}; },
    async close(token) { positions.delete(token); },
  };
  const audio = new ProgressiveAudio(new Native(),{stream,contextFactory:()=>ctx});
  return {audio,ctx,calls,stream};
}
test('gapless chunks and the next track share exact boundaries; pause and seek discard old scheduled audio', async () => {
  const {audio,ctx}=player();
  try {
    audio.enabled=true; audio.src='localtone://audio/A'; await audio.play();
    await audio.setNext({url:'localtone://audio/B',key:'B',index:1}); await tick();
    const current=audio.current,next=audio.next;
    assert.equal(current.eof,true);
    assert.equal(next.clock,current.clock+3);
    const nodes=ctx.nodes.filter(n=>!n.stopped).sort((a,b)=>a.when-b.when);
    for(let i=1;i<nodes.length;i++) assert.equal(nodes[i].when,nodes[i-1].when+nodes[i-1].buffer.duration);
    ctx.currentTime=1; audio.pause(); assert.ok(ctx.nodes.every(n=>n.stopped));
    const position=audio.currentTime; await audio.play(); assert.equal(audio.currentTime,position);
    const previous=audio.current; audio.currentTime=2; await audio.ready; await tick();
    assert.equal(previous.closed,true); assert.equal(audio.current.offset,2); assert.equal(audio.paused,false);
  } finally {audio.dispose();}
});
test('Next reuses the pending preload instead of opening the same decoder again', async () => {
  const {audio,calls,stream}=player();
  const original=stream.read; let release;
  try {
    audio.enabled=true;audio.src='localtone://audio/A';await audio.play();await tick();
    stream.read=token=>new Promise(resolve=>{release=()=>original(token).then(resolve);});
    const preparing=audio.setNext({url:'localtone://audio/B',key:'B',index:1});await tick();
    stream.read=original;
    audio.src='localtone://audio/B'; const playing=audio.play();release();await playing;await preparing;
    assert.deepEqual(calls,['A','B']);assert.equal(audio.src,'localtone://audio/B');assert.equal(audio.paused,false);
  } finally {audio.dispose();}
});
test('long playback keeps only a bounded runway; disabling gapless cancels the next song without interrupting current audio', async () => {
  const {audio,ctx}=player(3600);
  try {
    audio.enabled=true;audio.src='localtone://audio/A';await audio.play();await tick();
    assert.ok(audio.current.frames/rate<=6.5);
    await audio.setNext({url:'localtone://audio/B',key:'B',index:1});await tick();
    const current=audio.current, next=audio.next;audio.setEnabled(false);
    assert.equal(audio.current,current);assert.equal(audio.paused,false);assert.equal(next.closed,true);
    assert.ok(ctx.nodes.some(n=>!n.stopped));
  } finally {audio.dispose();}
});
test('opening a file during its tag write waits for completion without blocking other tracks', () => fixture(async ({decoder,file,root}) => {
  let finish;
  const writing=decoder.withWrite(file,()=>new Promise(resolve=>{finish=resolve;}));
  await new Promise(r=>setImmediate(r));
  let opened=false;
  const waiting=decoder.open({path:file,duration:3},rate).then(item=>{opened=true;return item;});
  const other=path.join(root,'other.wav');await writeFile(other,wav());
  const unrelated=await decoder.open({path:other,duration:3},rate);
  assert.equal(opened,false);assert.ok((await decoder.read(unrelated.token)).pcm.length);
  finish();await writing;const item=await waiting;
  assert.equal(opened,true);assert.ok((await decoder.read(item.token)).pcm.length);
}));
test('ordinary mode also streams promptly, and seeking a paused song does not resume it', async()=>{
  const {audio,calls}=player(600);
  try {
    audio.src='localtone://audio/A';await audio.play();await tick();
    assert.equal(audio.enabled,false);assert.equal(audio.buffered,true);
    await audio.setNext({url:'localtone://audio/B',key:'B',index:1});assert.deepEqual(calls,['A']);
    audio.pause();audio.currentTime=300;await audio.ready;await tick();
    assert.equal(audio.paused,true);assert.equal(audio.currentTime,300);
    await audio.play();assert.equal(audio.paused,false);assert.equal(audio.currentTime,300);
  } finally {audio.dispose();}
});
test('rapid replacement and disposal cancel pending decoders without leaking sessions',()=>fixture(async({decoder,file})=>{
  const ctx=context();
  const audio=new ProgressiveAudio(new Native(),{contextFactory:()=>ctx,stream:{open:(_id,r,o)=>decoder.open({path:file,duration:3},r,o),read:t=>decoder.read(t),close:t=>decoder.close(t)}});
  for(let i=0;i<20;i++){audio.src='localtone://audio/'+i;await tick();}
  await audio.play();audio.dispose();
  for(let i=0;i<50&&decoder.sessions.size;i++)await new Promise(r=>setTimeout(r,10));
  assert.equal(decoder.sessions.size,0);
}));
