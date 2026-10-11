const { spawn } = require('node:child_process');
const MAX_BYTES = 256 * 1024 * 1024;
class GaplessDecoder {
  constructor(binary) {
    this.binary = binary?.replace(
      'app.asar' + require('node:path').sep,
      'app.asar.unpacked' + require('node:path').sep,
    );
    this.active = null;
  }
  cancel() {
    this.active?.cancel();
  }
  decode(track, sampleRate) {
    if (!Number.isInteger(sampleRate) || sampleRate < 8000 || sampleRate > 192000)
      throw new Error('Invalid output sample rate.');
    if (track.duration * sampleRate * 8 > MAX_BYTES)
      throw new Error('Track exceeds the gapless buffer limit.');
    this.cancel();
    return new Promise((resolve, reject) => {
      const child = spawn(
        this.binary,
        [
          '-v',
          'error',
          '-nostdin',
          '-threads',
          '1',
          '-i',
          track.path,
          '-vn',
          '-ac',
          '2',
          '-ar',
          String(sampleRate),
          '-f',
          'f32le',
          'pipe:1',
        ],
        { windowsHide: true },
      );
      const chunks = [];
      let timer;
      let size = 0,
        done = false,
        errorText = '';
      const finish = (error, value) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        if (this.active === job) this.active = null;
        if (error) {
          child.kill();
          reject(error);
        } else resolve(value);
      };
      const job = { cancel: () => finish(new Error('Decode cancelled.')) };
      this.active = job;
      timer = setTimeout(() => finish(new Error('Audio decoding timed out.')), 90000);
      timer.unref?.();
      child.stdout.on('data', (chunk) => {
        size += chunk.length;
        if (size > MAX_BYTES) return finish(new Error('Track exceeds the gapless buffer limit.'));
        chunks.push(chunk);
      });
      child.stderr.on('data', (chunk) => {
        if (errorText.length < 2000) errorText += chunk.toString();
      });
      child.on('error', (error) => finish(error));
      child.on('close', (code) => {
        if (code !== 0) return finish(new Error(errorText || 'Audio decoding failed.'));
        if (!size || size % 8) return finish(new Error('Invalid decoded audio.'));
        const bytes = Buffer.concat(chunks);
        finish(null, { pcm: new Uint8Array(bytes), sampleRate, channels: 2 });
      });
    });
  }
}
module.exports = { GaplessDecoder, MAX_BYTES };
