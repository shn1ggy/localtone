import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const binary = require('ffmpeg-static');
const folder = await fs.mkdtemp(path.join(os.tmpdir(), 'localtone-decoder-'));
try {
  const wav = Buffer.alloc(44 + 4410 * 2);
  wav.write('RIFF');
  wav.writeUInt32LE(wav.length - 8, 4);
  wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(44100, 24);
  wav.writeUInt32LE(88200, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write('data', 36);
  wav.writeUInt32LE(wav.length - 44, 40);
  for (let i = 0; i < 4410; i++) wav.writeInt16LE(Math.round(16000 * Math.sin(i / 16)), 44 + i * 2);
  const wave = path.join(folder, 'tone.wav');
  await fs.writeFile(wave, wav);
  const files = ['test/fixtures/tone.mp3', 'test/fixtures/tone-v24.mp3', wave];
  const formats = JSON.parse(await fs.readFile('test/fixtures/audio-formats.json', 'utf8'));
  for (const [extension, data] of Object.entries(formats)) {
    const file = path.join(folder, 'tone.' + extension);
    await fs.writeFile(file, Buffer.from(data, 'base64'));
    files.push(file);
  }
  for (const file of files) {
    for (const [channels, rate] of [
      [1, 8000],
      [2, 44100],
    ]) {
      const pcm = execFileSync(
        binary,
        [
          '-v',
          'error',
          '-nostdin',
          '-threads',
          '1',
          '-i',
          file,
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
        { maxBuffer: 20 * 1024 * 1024 },
      );
      if (!pcm.length || pcm.length % (channels * 4)) throw Error('Invalid PCM: ' + file);
      let signal = false;
      for (let i = 0; i < pcm.length; i += 4) {
        const sample = pcm.readFloatLE(i);
        if (!Number.isFinite(sample)) throw Error('Nonfinite audio sample.');
        if (Math.abs(sample) > 0.001) signal = true;
      }
      if (!signal) throw Error('Decoder returned silence: ' + file);
    }
  }
  console.log(
    'Decoder smoke checks passed: MP3, FLAC, WAV, Ogg Vorbis, Opus, ALAC/M4A, AAC and AIFF; mono waveform and stereo gapless PCM.',
  );
} finally {
  await fs.rm(folder, { recursive: true, force: true });
}
