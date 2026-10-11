const fs = require('node:fs/promises'),
  path = require('node:path'),
  { createHash } = require('node:crypto'),
  { spawn } = require('node:child_process');
function waveformCacheKey(track, info = { size: track.size, mtimeMs: track.mtime }) {
  return createHash('sha256')
    .update([track.path, info.size, info.mtimeMs, 'wave-v1'].join('|'))
    .digest('hex');
}
class WaveformService {
  constructor(directory, binary) {
    this.directory = directory;
    this.binary = binary || require('ffmpeg-static');
    if (this.binary)
      this.binary = this.binary.replace('app.asar' + path.sep, 'app.asar.unpacked' + path.sep);
    this.active = null;
  }
  cancel() {
    if (this.active) {
      this.active.cancel();
      this.active = null;
    }
  }
  async get(track) {
    if (!this.binary) throw new Error('Waveform decoder is unavailable.');
    const info = await fs.stat(track.path),
      key = waveformCacheKey(track, info);
    const file = path.join(this.directory, key + '.json');
    try {
      const cached = JSON.parse(await fs.readFile(file, 'utf8'));
      if (cached.length === 1600 && cached.every((n) => Number.isFinite(n) && n >= 0 && n <= 1))
        return cached;
    } catch {}
    if (this.active?.key === key) return this.active.promise;
    this.cancel();
    if (!(track.duration > 0) || track.duration > 21600)
      throw new Error('Waveform needs a known duration of up to six hours.');
    const count = 1600,
      rate = 22050,
      channels = 2,
      peaks = new Array(count).fill(0),
      samplesPerBucket = (track.duration * rate * channels) / count;
    let child,
      finished = false,
      timer,
      rejectJob;
    const promise = new Promise((resolve, reject) => {
      rejectJob = reject;
      const done = (error) => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        if (error) {
          child?.kill();
          reject(error);
        } else resolve(peaks);
      };
      child = spawn(
        this.binary,
        [
          '-v',
          'error',
          '-nostdin',
          '-threads',
          '1',
          '-i',
          track.path,
          '-map',
          '0:a:0',
          '-vn',
          '-ac',
          String(channels),
          '-ar',
          String(rate),
          '-f',
          'f32le',
          'pipe:1',
        ],
        { stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true },
      );
      let tail = Buffer.alloc(0),
        index = 0;
      child.stdout.on('data', (chunk) => {
        const bytes = tail.length ? Buffer.concat([tail, chunk]) : chunk,
          limit = bytes.length - (bytes.length % 4);
        for (let offset = 0; offset < limit; offset += 4) {
          const value = Math.abs(bytes.readFloatLE(offset)),
            bucket = Math.min(count - 1, Math.floor(index++ / samplesPerBucket));
          if (Number.isFinite(value)) peaks[bucket] = Math.max(peaks[bucket], Math.min(1, value));
        }
        tail = bytes.subarray(limit);
      });
      child.on('error', () => done(new Error('Waveform decoder could not start.')));
      child.on('close', (code) =>
        done(code === 0 ? null : new Error('This file could not be analyzed.')),
      );
      timer = setTimeout(() => done(new Error('Waveform analysis timed out.')), 90000);
      timer.unref?.();
    });
    const job = {
      key,
      promise,
      cancel: () => {
        if (!finished) {
          finished = true;
          clearTimeout(timer);
          child?.kill();
          rejectJob(new Error('Waveform analysis cancelled.'));
        }
      },
    };
    this.active = job;
    try {
      const values = await promise;
      await fs.mkdir(this.directory, { recursive: true });
      await fs.writeFile(file, JSON.stringify(values));
      return values;
    } finally {
      if (this.active === job) this.active = null;
    }
  }
}
module.exports = { WaveformService, waveformCacheKey };
