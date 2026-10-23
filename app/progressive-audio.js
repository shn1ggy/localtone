import { BufferedAudio } from './buffered-audio.js';

const LOOKAHEAD = 6;
const PREFETCH = 1;
const START_DELAY = 0.02;

// Small PCM chunks share one audio clock. Timers refill the runway; they never
// choose the start time of an adjoining chunk or a prepared next track.
export class ProgressiveAudio extends BufferedAudio {
  constructor(native, { stream, ...options }) {
    super(native, { ...options, decode: () => {}, cancelDecode: () => {} });
    this.stream = stream;
    this.streams = new Set();
    this.next = null;
    this.current = null;
  }
  get supportsLiveEdits() {
    return this.buffered;
  }
  get duration() {
    return this.buffered ? this.current?.duration || NaN : this.native.duration;
  }
  get currentTime() {
    if (!this.buffered) return this.native.currentTime;
    const item = this.current;
    if (!item || this._paused || item.clock === null) return this.position;
    return Math.max(
      this.position,
      Math.min(item.duration || Infinity, this.ctx.currentTime - item.clock),
    );
  }
  set currentTime(value) {
    if (!this.buffered) {
      this.native.currentTime = value;
      return;
    }
    this.promoteIfDue();
    const playing = this.wanted;
    const position = Math.max(0, Math.min(Number(value) || 0, this.duration || Infinity));
    this.emit('seeking');
    this.loadSource(this.src, position, true);
    this.wanted = playing;
    const generation = this.generation;
    this.ready
      .then(async () => {
        if (generation !== this.generation) return;
        if (playing && this.wanted) await this.play();
        this.emit('seeked');
        this.emit('timeupdate');
      })
      .catch(() => this.emit('error'));
  }
  setEnabled(value) {
    this.promoteIfDue();
    this.enabled = !!value;
    if (!this.enabled) {
      this.closeItem(this.next);
      this.next = null;
      this.desired = null;
    }
  }
  loadSource(url, position = 0, keepNext = false) {
    this.cancelOutputReload?.();
    const reused = position === 0 && this.next?.url === url ? this.next : null;
    this.generation++;
    this.stopNodes();
    this.closeItem(this.current);
    if (!reused && !keepNext) this.closeItem(this.next);
    if (reused || !keepNext) {
      this.next = null;
      this.desired = null;
    }
    this._src = url;
    this.position = position;
    this._paused = true;
    this.wanted = false;
    this.buffered = !!url;
    this.native.pause();
    this.native.removeAttribute('src');
    this.native.load();
    this.current = null;
    this.emit('emptied');
    if (!url) {
      this.ready = Promise.resolve();
      return;
    }
    const generation = this.generation;
    const item = reused || this.createItem(url, position);
    item.clock = null;
    this.current = item;
    this.ready = item.ready
      .then(() => {
        if (generation !== this.generation) return;
        this.emit('loadedmetadata');
        this.status(this.enabled ? 'Gapless playback ready.' : 'Playback ready.');
      })
      .catch((error) => {
        if (generation !== this.generation) return;
        this.closeItem(item);
        this.closeItem(this.next);
        this.next = null;
        this.current = null;
        this.buffered = false;
        this.native.src = `${url}?playback=${generation}`;
        if (position)
          this.native.addEventListener(
            'loadedmetadata',
            () => {
              if (generation === this.generation) this.native.currentTime = position;
            },
            { once: true },
          );
        this.status('Normal playback for this track: ' + error.message);
      });
  }
  createItem(url, offset, priority) {
    const item = {
      url,
      offset,
      duration: 0,
      frames: 0,
      chunks: [],
      eof: false,
      closed: false,
      clock: null,
      token: null,
      pumping: null,
    };
    this.streams.add(item);
    item.ready = (async () => {
      await priority?.catch(() => {});
      const ctx = await this.context();
      if (item.closed) return;
      const info = await this.stream.open(url.split('/').at(-1), ctx.sampleRate, offset);
      item.token = info.token;
      if (item.closed) {
        await this.stream.close(info.token);
        return;
      }
      item.duration = info.duration;
      await this.readChunk(item);
    })();
    // The owning load/setNext handles the error. Closing a pending preload must
    // not leave its rejected promise without a listener.
    item.ready.catch(() => {});
    return item;
  }
  async readChunk(item) {
    const data = await this.stream.read(item.token);
    if (item.closed) return;
    const bytes = data.pcm;
    if (bytes.byteLength % 8) throw Error('Invalid decoded audio.');
    const raw = new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4);
    const frames = raw.length / 2;
    if (frames) {
      const buffer = this.ctx.createBuffer(2, frames, this.ctx.sampleRate);
      for (let c = 0; c < 2; c++) {
        const target = buffer.getChannelData(c);
        for (let i = 0; i < frames; i++) target[i] = raw[i * 2 + c];
      }
      item.chunks.push({
        buffer,
        offset: item.offset + item.frames / this.ctx.sampleRate,
        node: null,
      });
      item.frames += frames;
    }
    item.eof = data.eof;
    if (item.eof) {
      if (!item.frames && !item.offset) throw Error('No audio samples were decoded.');
      item.duration = item.offset + item.frames / this.ctx.sampleRate;
      if (item === this.current) this.emit('loadedmetadata');
    }
  }
  closeItem(item) {
    if (!item || item.closed) return;
    item.closed = true;
    for (const chunk of item.chunks) this.stop(chunk.node);
    item.chunks.length = 0;
    this.streams.delete(item);
    if (item.token) this.stream.close(item.token).catch(() => {});
  }
  stopNodes() {
    clearInterval(this.timer);
    for (const item of this.streams || []) {
      for (const chunk of item.chunks) {
        this.stop(chunk.node);
        chunk.node = null;
      }
      item.clock = null;
    }
  }
  async play() {
    if (this.buffered && !this._paused) return;
    const generation = this.generation;
    this.wanted = true;
    await this.ready;
    if (generation !== this.generation || !this.wanted) return;
    if (!this.buffered) return this.native.play();
    await this.ctx.resume();
    if (generation !== this.generation || !this.wanted || !this._paused) return;
    this._paused = false;
    this.current.clock = this.ctx.currentTime + START_DELAY - this.position;
    this.schedule(this.current);
    this.emit('play');
    this.emit('playing');
    this.tick();
    clearInterval(this.timer);
    this.timer = setInterval(() => this.tick(), 100);
  }
  pause() {
    this.wanted = false;
    if (!this.buffered) {
      this.native.pause();
      return;
    }
    this.promoteIfDue();
    this.position = this.currentTime;
    this._paused = true;
    this.stopNodes();
    this.emit('pause');
  }
  schedule(item) {
    if (!item || item.closed || item.clock === null || this._paused) return;
    for (const chunk of item.chunks) {
      if (chunk.node) continue;
      const end = chunk.offset + chunk.buffer.duration;
      const position = item === this.current ? this.position : item.offset;
      if (end <= position) continue;
      const offset = Math.max(0, position - chunk.offset);
      const when = item.clock + chunk.offset + offset;
      // A slow disk can exhaust the runway. Recover at the actual audio clock,
      // without dropping samples or pretending that uninterrupted audio played.
      if (when < this.ctx.currentTime) {
        item.clock += this.ctx.currentTime + START_DELAY - when;
        if (item === this.current) this.emit('waiting');
      }
      const node = this.node(chunk.buffer, item.clock + chunk.offset + offset, offset);
      chunk.node = node;
      node.onended = () => {
        if (chunk.node !== node) return;
        node.disconnect();
        const index = item.chunks.indexOf(chunk);
        if (index !== -1) item.chunks.splice(index, 1);
        this.tick();
      };
    }
    this.scheduleNext();
  }
  pump(item, target) {
    if (!item || item.closed || item.eof || item.pumping || !item.token) return;
    item.pumping = (async () => {
      await item.ready;
      while (!item.closed && !item.eof) {
        const position = item === this.current ? this.currentTime : item.offset;
        if (item.offset + item.frames / this.ctx.sampleRate - position >= target) break;
        await this.readChunk(item);
        this.schedule(item);
      }
    })()
      .catch((error) => {
        if (item.closed) return;
        item.error = error;
        if (item === this.current) {
          this.pause();
          this.status('Audio playback stopped: ' + error.message);
          this.emit('error');
        } else {
          this.closeItem(item);
          if (this.next === item) this.next = null;
          this.status('Next track will use a normal transition: ' + error.message);
        }
      })
      .finally(() => {
        item.pumping = null;
      });
  }
  async setNext(descriptor) {
    if (!this.enabled) return;
    this.desired = descriptor;
    if (this.next && this.next.url === descriptor?.url) {
      this.next.descriptor = descriptor;
      return;
    }
    this.closeItem(this.next);
    this.next = null;
    if (!descriptor || !this.buffered) return;
    const item = this.createItem(descriptor.url, 0, this.current?.ready);
    item.descriptor = descriptor;
    this.next = item;
    try {
      await item.ready;
      if (this.next !== item || item.closed) return;
      this.pump(item, PREFETCH);
      this.scheduleNext();
    } catch (error) {
      if (item.closed) return;
      this.closeItem(item);
      if (this.next === item) this.next = null;
      this.status('Next track will use a normal transition: ' + error.message);
    }
  }
  scheduleNext() {
    const item = this.current,
      next = this.next;
    if (
      !this.enabled ||
      this._paused ||
      !item?.eof ||
      item.clock === null ||
      !next ||
      next.closed ||
      next.clock !== null ||
      !next.chunks.length
    )
      return;
    const end = item.clock + item.duration;
    if (end < this.ctx.currentTime) return;
    next.clock = end;
    this.schedule(next);
  }
  promoteIfDue() {
    const item = this.current;
    if (
      !item ||
      this._paused ||
      !item.eof ||
      item.clock === null ||
      this.ctx.currentTime < item.clock + item.duration
    )
      return;
    if (this.next?.clock !== null && this.next?.clock !== undefined) {
      const next = this.next;
      this.next = null;
      this.desired = null;
      this.current = next;
      this._src = next.url;
      this.position = 0;
      this.closeItem(item);
      this.ontransition?.(next.descriptor);
      this.emit('loadedmetadata');
      this.emit('playing');
    } else {
      this.position = item.duration;
      this._paused = true;
      clearInterval(this.timer);
      this.emit('timeupdate');
      this.emit('ended');
    }
  }
  tick() {
    if (this.disposed || !this.buffered || this._paused) return;
    this.promoteIfDue();
    if (this._paused) return;
    this.pump(this.current, LOOKAHEAD);
    this.pump(this.next, PREFETCH);
    this.scheduleNext();
    this.emit('timeupdate');
  }
  dispose() {
    super.dispose();
    for (const item of [...this.streams]) this.closeItem(item);
  }
}
