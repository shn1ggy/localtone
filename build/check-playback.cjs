// Real Chromium audio rendering, with isolated generated files and no user data.
const { app } = require('electron');
const syncFs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
let directory = require('node:fs').mkdtempSync(path.join(os.tmpdir(), 'localtone-audio-check-'));
app.setPath('userData', directory);
app.on('quit', () => {
  // Chromium owns databases in userData until its windows have shut down.
  // A temporary-file cleanup failure must not hide the audio test result.
  try {
    syncFs.rmSync(directory, { recursive: true, force: true, maxRetries: 3, retryDelay: 40 });
  } catch (error) {
    console.warn('Temporary audio test data cleanup deferred:', error.code);
  }
});
const timeout = setTimeout(() => {
  console.error('Playback verification timed out.');
  app.exit(1);
}, 60000);
const pcm = (start, count, rate) => {
  const b = Buffer.alloc(44 + count * 8);
  b.write('RIFF');
  b.writeUInt32LE(b.length - 8, 4);
  b.write('WAVEfmt ', 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(3, 20);
  b.writeUInt16LE(2, 22);
  b.writeUInt32LE(rate, 24);
  b.writeUInt32LE(rate * 8, 28);
  b.writeUInt16LE(8, 32);
  b.writeUInt16LE(32, 34);
  b.write('data', 36);
  b.writeUInt32LE(count * 8, 40);
  for (let i = 0; i < count; i++)
    for (let c = 0; c < 2; c++)
      b.writeFloatLE(0.2 * Math.sin((start + i) * 0.037), 44 + i * 8 + c * 4);
  return b;
};
const rate = 48000,
  frames = 36000;
const tracks = [];
for (const [index, id] of ['A', 'B'].entries()) {
  const file = path.join(directory, id + '.wav');
  syncFs.writeFileSync(file, pcm(index * frames, frames, rate));
  syncFs.copyFileSync(
    path.join(__dirname, '../test/fixtures/gapless-' + id.toLowerCase() + '.mp3'),
    path.join(directory, id + '.mp3'),
  );
  for (const format of ['wav', 'mp3'])
    tracks.push({
      id: id + '.' + format,
      path: path.join(directory, id + '.' + format),
      libraryId: 'probe',
      title: id,
      artist: 'Audio test',
      album: 'Continuous',
      duration: 0.75,
      codec: format.toUpperCase(),
    });
}
syncFs.writeFileSync(
  path.join(directory, 'collection.json'),
  JSON.stringify({
    libraries: [],
    playlists: [],
    tracks,
    settings: { gaplessPlayback: true },
    ratings: {},
  }),
);
app.requestSingleInstanceLock = () => true;
app.once('browser-window-created', (_event, win) => {
  win.webContents.once('did-finish-load', async () => {
    try {
      const moduleURL = 'localtone://app/progressive-audio.js';
      const result = await win.webContents.executeJavaScript(`(async()=>{
      const {ProgressiveAudio}=await import(${JSON.stringify(moduleURL)});
      const api=window.localtone;
      const stream={open:api.audioOpen,read:api.audioRead,close:api.audioClose};
      const wait=ms=>new Promise(r=>setTimeout(r,ms));
      const results=[];
      for(const format of ['wav','mp3']) {
        const ctx=new OfflineAudioContext(2,${frames * 2 + rate / 10},${rate});
        ctx.resume=async()=>{};ctx.close=async()=>{};
        const audio=new ProgressiveAudio(document.getElementById('audio'),{stream,contextFactory:()=>ctx});
        audio.enabled=true;audio.volume=1;
        let transitions=0;audio.ontransition=()=>{transitions++;};
        audio.src='localtone://audio/A.'+format;await audio.play();
        await audio.setNext({url:'localtone://audio/B.'+format,key:'B',index:1});
        for(let i=0;i<200 && (!audio.current.eof || !audio.next?.eof || audio.next.clock===null);i++)await wait(5);
        if(!audio.current.eof || !audio.next?.eof)throw Error('Prebuffer incomplete');
        const first=audio.current, second=audio.next;
        const expected=[...first.chunks,...second.chunks].flatMap(c=>Array.from(c.buffer.getChannelData(0)));
        const start=Math.round(first.clock*ctx.sampleRate);
        const output=await ctx.startRendering();
        const actual=output.getChannelData(0);
        let maxError=0;
        for(let i=0;i<expected.length;i++)maxError=Math.max(maxError,Math.abs(expected[i]-actual[start+i]));
        if(maxError>1e-6)throw Error(format+' output discontinuity: '+maxError);
        results.push({format,frames:expected.length,maxError,transitions});
        audio.dispose();await wait(10);
      }
      const clock=new AudioContext({sampleRate:48000,sinkId:{type:'none'}});
      const live=new ProgressiveAudio(document.createElement('audio'),{stream,contextFactory:()=>clock});
      live.enabled=true;
      let transitions=0;
      live.ontransition=()=>{
        transitions++;
        live.setNext(transitions<3?{url:'localtone://audio/'+(transitions%2?'A':'B')+'.mp3',key:String(transitions),index:transitions+1}:null);
      };
      const ended=new Promise((resolve,reject)=>{
        // Hosted macOS runs the silent output clock slower than wall time.
        // Allow scheduling headroom without relaxing sample continuity checks.
        const deadline=setTimeout(()=>reject(Error('Live playback did not finish: '+JSON.stringify({
          clock:clock.currentTime,state:clock.state,transitions,buffered:live.buffered,
          paused:live.paused,position:live.currentTime,
          current:live.current&&{clock:live.current.clock,eof:live.current.eof,duration:live.current.duration,chunks:live.current.chunks.length},
          next:live.next&&{clock:live.next.clock,eof:live.next.eof,chunks:live.next.chunks.length},
          rendered:results
        }))),15000);
        live.onended=()=>{clearTimeout(deadline);resolve();};
        live.onerror=()=>{clearTimeout(deadline);reject(Error('Live playback failed'));};
      });
      const before=performance.now();
      live.src='localtone://audio/A.mp3';await live.play();
      const startMs=Math.round(performance.now()-before);
      await live.setNext({url:'localtone://audio/B.mp3',key:'0',index:1});
      await ended;
      if(transitions!==3)throw Error('Missing live transitions: '+transitions);
      results.push({format:'live MP3',seconds:3,transitions,startMs});
      live.dispose();await wait(20);
      return results;
    })()`);
      for (const item of result) {
        if (item.frames !== undefined) assert.equal(item.frames, frames * 2);
        console.log('Chromium rendered seamless audio:', JSON.stringify(item));
      }

      clearTimeout(timeout);
      app.quit();
    } catch (error) {
      console.error(error);
      app.exit(1);
    }
  });
});
const Module = require('node:module');
const load = Module._load;
Module._load = function (name, ...args) {
  if (name === './portable.cjs')
    return { ...load.call(this, name, ...args), configurePortable() {} };
  if (name !== 'electron' || process.platform !== 'linux') return load.call(this, name, ...args);
  const electron = load.call(this, name, ...args);
  return {
    ...electron,
    BrowserWindow: class extends electron.BrowserWindow {
      constructor(options) {
        super({
          ...options,
          webPreferences: { ...options.webPreferences, offscreen: true, sandbox: false },
        });
      }
    },
  };
};
require('../main.cjs');
