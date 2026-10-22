const { spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const { copyFile, mkdtemp, mkdir, rm } = require('node:fs/promises');
const { constants } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');

// Pulling half-second chunks lets the OS pipe apply backpressure to FFmpeg.
// Neither the main process nor the renderer accumulates a decoded whole song.
class StreamDecoder {
  constructor(binary, { directory } = {}) {
    this.binary = binary?.replace('app.asar' + path.sep, 'app.asar.unpacked' + path.sep);
    this.directory = directory;
    this.sessions = new Map();
    this.closing = new Map();
    this.writes = new Map();
  }
  init() {
    if (!this.root)
      this.root = (async () => {
        if (!this.directory) return mkdtemp(path.join(tmpdir(), 'localtone-edit-audio-'));
        const directory = this.directory();
        await rm(directory, { recursive: true, force: true });
        await mkdir(directory, { recursive: true });
        return directory;
      })();
    return this.root;
  }
  async open(track, sampleRate, offset = 0) {
    if (this.disposed) throw Error('Audio decoder closed.');
    while (this.allWrites || this.writes.has(track.path))
      await (this.allWrites || this.writes.get(track.path));
    if (this.disposed) throw Error('Audio decoder closed.');
    if (!Number.isInteger(sampleRate) || sampleRate < 8000 || sampleRate > 192000)
      throw Error('Invalid output sample rate.');
    if (!Number.isFinite(offset) || offset < 0 || offset > 604800)
      throw Error('Invalid playback position.');
    if (this.sessions.size >= 4) throw Error('Too many audio streams.');
    const token = randomUUID();
    const session = {
      token,
      file: track.path,
      input: track.path,
      sampleRate,
      offset,
      frames: 0,
      tail: Buffer.alloc(0),
      eof: false,
      closed: false,
      serial: Promise.resolve(),
    };
    this.sessions.set(token, session);
    try {
      this.start(session, offset);
    } catch (error) {
      this.sessions.delete(token);
      throw error;
    }
    return { token, sampleRate, channels: 2, duration: track.duration || 0, offset };
  }
  start(session, offset) {
    const args = ['-v', 'error', '-nostdin', '-threads', '1'];
    // Decode a short preroll before the seek point so MP3 bit reservoirs and
    // resamplers are warm before any samples reach the playback clock.
    const seek = Math.max(0, Math.floor(offset) - 2);
    if (seek) args.push('-ss', String(seek));
    args.push('-i', session.input);
    if (offset > seek) args.push('-ss', String(offset - seek));
    args.push(
      '-map',
      '0:a:0',
      '-vn',
      '-ac',
      '2',
      '-ar',
      String(session.sampleRate),
      '-f',
      'f32le',
      'pipe:1',
    );
    const child = spawn(this.binary, args, { windowsHide: true });
    session.child = child;
    session.iterator = child.stdout[Symbol.asyncIterator]();
    session.tail = Buffer.alloc(0);
    session.eof = false;
    let message = '';
    child.stderr.on('data', (chunk) => {
      if (message.length < 2000) message += chunk.toString();
    });
    // Always resolve exit: an unconsumed prefetched stream must not produce an
    // unhandled rejection if its decoder fails before the next read.
    session.exit = new Promise((resolve) => {
      child.once('error', (error) => resolve(error));
      child.once('close', (code) =>
        resolve(code === 0 ? null : Error(message || 'Audio decoding failed.')),
      );
    });
  }
  enqueue(session, work) {
    const result = session.serial.then(() => {
      if (session.closed) throw Error('Audio stream closed.');
      return work();
    });
    session.serial = result.catch(() => {});
    return result;
  }
  read(token) {
    const session = this.sessions.get(token);
    if (!session) return Promise.reject(Error('Audio stream closed.'));
    return this.enqueue(session, async () => {
      const size = Math.floor(session.sampleRate / 2) * 8;
      const parts = [];
      let length = 0;
      while (length < size && !session.eof) {
        if (!session.tail.length) {
          let timer;
          try {
            const next = await Promise.race([
              session.iterator.next(),
              new Promise((_, reject) => {
                timer = setTimeout(() => {
                  session.child.kill('SIGKILL');
                  session.child.stdout.destroy();
                  reject(Error('Audio decoding timed out.'));
                }, 15000);
                timer.unref?.();
              }),
            ]);
            if (next.done) {
              const error = await session.exit;
              if (error) throw error;
              session.eof = true;
              break;
            }
            session.tail = next.value;
          } finally {
            clearTimeout(timer);
          }
        }
        const count = Math.min(size - length, session.tail.length);
        parts.push(session.tail.subarray(0, count));
        session.tail = session.tail.subarray(count);
        length += count;
      }
      if (length % 8) throw Error('Invalid decoded audio.');
      const pcm = new Uint8Array(Buffer.concat(parts, length));
      session.frames += length / 8;
      return { pcm, eof: session.eof };
    });
  }
  async withWrite(file, work) {
    const previous = this.writes.get(file);
    let release;
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    this.writes.set(file, gate);
    try {
      await previous;
      await this.beforeWrite(file);
      return await work();
    } finally {
      if (this.writes.get(file) === gate) this.writes.delete(file);
      release();
    }
  }
  async withAllWrites(work) {
    const previous = this.allWrites;
    let release;
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    this.allWrites = gate;
    try {
      await previous;
      await Promise.all([...this.closing.values()].map((job) => job.promise));
      await Promise.all(
        [...new Set([...this.sessions.values()].map((s) => s.file))].map((file) =>
          this.beforeWrite(file),
        ),
      );
      return await work();
    } finally {
      if (this.allWrites === gate) this.allWrites = null;
      release();
    }
  }
  async beforeWrite(file) {
    await Promise.all(
      [...this.closing.values()].filter((job) => job.file === file).map((job) => job.promise),
    );
    await Promise.all(
      [...this.sessions.values()]
        .filter((s) => s.file === file)
        .map((session) =>
          this.enqueue(session, async () => {
            if (session.snapshot || session.eof) return;
            // Copy only when an edit actually needs it. Restart decoding at the exact
            // delivered frame, leaving already scheduled playback untouched.
            const directory = await mkdtemp(path.join(await this.init(), 'edit-'));
            const snapshot = path.join(directory, 'audio' + path.extname(file));
            try {
              await copyFile(file, snapshot, constants.COPYFILE_FICLONE);
              session.child.kill('SIGKILL');
              session.child.stdout.destroy();
              await session.exit;
              if (session.closed) throw Error('Audio stream closed.');
              session.snapshot = directory;
              session.input = snapshot;
              this.start(session, session.offset + session.frames / session.sampleRate);
            } catch (error) {
              await rm(directory, { recursive: true, force: true });
              throw error;
            }
          }).catch(async (error) => {
            if (!session.closed) throw error;
            await session.exit;
          }),
        ),
    );
  }
  close(token) {
    const session = this.sessions.get(token);
    if (!session) return this.closing.get(token)?.promise || Promise.resolve();
    this.sessions.delete(token);
    session.closed = true;
    const promise = (async () => {
      session.child.kill('SIGKILL');
      session.child.stdout.destroy();
      await session.exit;
      await session.serial;
      if (session.snapshot)
        await rm(session.snapshot, { recursive: true, force: true, maxRetries: 3 });
    })();
    this.closing.set(token, { file: session.file, promise });
    const finished = () => this.closing.delete(token);
    promise.then(finished, finished);
    return promise;
  }
  async dispose() {
    this.disposed = true;
    await Promise.allSettled([...this.writes.values(), this.allWrites]);
    await Promise.allSettled([
      ...[...this.sessions.keys()].map((token) => this.close(token)),
      ...[...this.closing.values()].map((job) => job.promise),
    ]);
    if (this.root) await rm(await this.root, { recursive: true, force: true, maxRetries: 3 });
  }
}
module.exports = { StreamDecoder };
