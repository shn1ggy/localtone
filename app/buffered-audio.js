// Two decoded tracks are scheduled on the audio clock; UI timers never start the next track.
export class BufferedAudio extends EventTarget {
  constructor(
    native,
    { decode, cancelDecode, contextFactory = () => new AudioContext(), status = () => {} },
  ) {
    super();
    this.native = native;
    this.decode = decode;
    this.cancelDecode = cancelDecode;
    this.contextFactory = contextFactory;
    this.status = status;
    this.enabled = false;
    this.buffered = false;
    this._src = '';
    this._volume = 0.8;
    this._muted = false;
    this._sinkId = '';
    this._paused = true;
    this.position = 0;
    this.generation = 0;
    this.revision = 0;
    this.cache = new Map();
    this.ready = Promise.resolve();
    this.nativeListeners = new Map();
    for (const type of [
      'loadedmetadata',
      'timeupdate',
      'play',
      'pause',
      'playing',
      'waiting',
      'seeking',
      'seeked',
      'emptied',
      'ended',
      'error',
    ]) {
      const listener = () => {
        if (!this.buffered) this.emit(type);
      };
      this.nativeListeners.set(type, listener);
      native.addEventListener(type, listener);
    }
  }
  emit(type) {
    this.dispatchEvent(new Event(type));
    this['on' + type]?.();
  }
  get src() {
    return this._src;
  }
  set src(value) {
    this.loadSource(value);
  }
  getAttribute(name) {
    return name === 'src' ? this._src || null : this.native.getAttribute(name);
  }
  removeAttribute(name) {
    if (name === 'src') this.src = '';
    else this.native.removeAttribute(name);
  }
  load() {
    if (!this.buffered) this.native.load();
  }
  async context() {
    if (!this.ctx) {
      this.ctx = this.contextFactory();
      this.gain = this.ctx.createGain();
      this.gain.connect(this.ctx.destination);
      this.paintGain();
    }
    if (this._sinkId && this.ctx.sinkId !== this._sinkId) {
      if (!this.ctx.setSinkId) throw new Error('Gapless output selection is unavailable.');
      await this.ctx.setSinkId(this._sinkId);
    }
    return this.ctx;
  }
  async buffer(url) {
    if (this.disposed) throw new Error('Audio player closed.');
    if (this.cache.has(url)) return this.cache.get(url);
    const ctx = await this.context(),
      id = url.split('/').at(-1),
      data = await this.decode(id, ctx.sampleRate);
    if (this.disposed) throw new Error('Audio player closed.');
    const raw = new Float32Array(data.pcm.buffer, data.pcm.byteOffset, data.pcm.byteLength / 4);
    if (data.channels !== 2 || data.sampleRate !== ctx.sampleRate || raw.length % 2)
      throw new Error('Invalid decoded audio.');
    const buffer = ctx.createBuffer(2, raw.length / 2, ctx.sampleRate);
    for (let channel = 0; channel < 2; channel++) {
      const target = buffer.getChannelData(channel);
      for (let i = 0; i < target.length; i++) target[i] = raw[i * 2 + channel];
    }
    this.cache.set(url, buffer);
    while (this.cache.size > 2) this.cache.delete(this.cache.keys().next().value);
    return buffer;
  }
  loadSource(url, position = 0) {
    this.cancelOutputReload?.();
    this.generation++;
    this.revision++;
    this.cancelDecode?.();
    this.stopNodes();
    this._src = url;
    this.position = position;
    this._paused = true;
    this.wanted = false;
    this.current = null;
    this.prepared = null;
    this.desired = null;
    this.buffered = !!(this.enabled && url);
    this.native.pause();
    this.native.removeAttribute('src');
    this.native.load();
    const generation = this.generation;
    this.emit('emptied');
    if (!url) {
      this.ready = Promise.resolve();
      return;
    }
    if (!this.buffered) {
      this.native.src = url;
      if (position)
        this.native.addEventListener(
          'loadedmetadata',
          () => {
            if (generation === this.generation) this.native.currentTime = position;
          },
          { once: true },
        );
      this.ready = Promise.resolve();
      return;
    }
    this.ready = this.buffer(url)
      .then((buffer) => {
        if (generation !== this.generation) return;
        this.current = buffer;
        this.position = Math.min(this.position, buffer.duration);
        this.emit('loadedmetadata');
        this.status('Gapless playback ready.');
      })
      .catch((error) => {
        if (generation !== this.generation) return;
        this.buffered = false;
        this.native.src = url;
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
  setEnabled(value) {
    value = !!value;
    if (this.enabled === value) return;
    const url = this.src,
      time = this.currentTime,
      playing = !this.paused;
    this.enabled = value;
    if (url) {
      this.loadSource(url, time);
      if (playing) this.play().catch(() => this.emit('error'));
    }
  }
  get paused() {
    return this.buffered ? this._paused : this.native.paused;
  }
  get duration() {
    return this.buffered ? this.current?.duration || NaN : this.native.duration;
  }
  get seeking() {
    return this.buffered ? false : this.native.seeking;
  }
  get currentTime() {
    return this.buffered
      ? Math.min(
          this.current?.duration || Infinity,
          Math.max(
            0,
            this._paused ? this.position : this.position + this.ctx.currentTime - this.anchor,
          ),
        )
      : this.native.currentTime;
  }
  set currentTime(value) {
    if (!this.buffered) {
      this.native.currentTime = value;
      return;
    }
    this.promoteIfDue();
    const playing = !this._paused;
    this.emit('seeking');
    this.position = Math.max(0, Math.min(Number(value) || 0, this.current?.duration || Infinity));
    this.stopNodes();
    if (playing && this.current) this.startNode();
    this.emit('seeked');
    this.emit('timeupdate');
  }
  get volume() {
    return this._volume;
  }
  set volume(value) {
    this._volume = Number(value);
    this.native.volume = this._volume;
    this.paintGain();
  }
  get muted() {
    return this._muted;
  }
  set muted(value) {
    this._muted = !!value;
    this.native.muted = this._muted;
    this.paintGain();
  }
  paintGain() {
    if (this.gain) this.gain.gain.value = this._muted ? 0 : this._volume;
  }
  get sinkId() {
    return this._sinkId;
  }
  // Reloading opens a new native output stream instead of retaining the old
  // CoreAudio route. Never restart the song or resume a user-paused track.
  async restartNativeOutput() {
    if (this.buffered || !this.native.src) return;
    const generation = this.generation,
      position = this.native.currentTime,
      playing = !this.native.paused;
    await new Promise((resolve, reject) => {
      const cleanup = () => {
        clearTimeout(timer);
        this.native.removeEventListener('loadedmetadata', loaded);
        this.native.removeEventListener('error', failed);
        if (this.cancelOutputReload === cancel) this.cancelOutputReload = null;
      };
      const cancel = () => {
        cleanup();
        resolve();
      };
      const loaded = () => {
        cleanup();
        resolve();
      };
      const failed = () => {
        cleanup();
        reject(new Error('Could not restart audio on the selected output.'));
      };
      const timer = setTimeout(failed, 8000);
      this.cancelOutputReload = cancel;
      this.native.addEventListener('loadedmetadata', loaded);
      this.native.addEventListener('error', failed);
      try {
        this.native.pause();
        this.native.load();
      } catch (error) {
        cleanup();
        reject(error);
      }
    });
    if (this.disposed || generation !== this.generation) return;
    this.native.currentTime = position;
    if (playing && this.wanted) await this.native.play();
  }
  async setSinkId(id) {
    if (id === this._sinkId) return;
    const previous = this._sinkId,
      context = this.ctx,
      running = context?.state === 'running',
      generation = this.generation,
      position = this.currentTime,
      playing = !this.paused;
    try {
      if (this.native.setSinkId) await this.native.setSinkId(id);
      else if (id) throw new Error('Output selection is unavailable.');
      if (context) {
        if (running && context.suspend) await context.suspend();
        if (context.setSinkId) await context.setSinkId(id);
        else if (id) throw new Error('Gapless output selection is unavailable.');
        if (running || (this.buffered && !this._paused)) await context.resume();
      }
      this._sinkId = id;
      await this.restartNativeOutput();
    } catch (error) {
      this._sinkId = previous;
      if (this.native.setSinkId) await this.native.setSinkId(previous).catch(() => {});
      if (context?.setSinkId) await context.setSinkId(previous).catch(() => {});
      if (running || (this.buffered && !this._paused)) await context?.resume().catch(() => {});
      if (!this.buffered && !this.disposed && generation === this.generation && this.native.src) {
        try {
          this.native.currentTime = position;
        } catch {}
        if (playing && this.wanted) await this.native.play().catch(() => {});
      }
      throw error;
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
    this.startNode();
    this.emit('play');
    this.emit('playing');
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
  node(buffer, when, offset = 0) {
    const node = this.ctx.createBufferSource();
    node.buffer = buffer;
    node.connect(this.gain);
    node.start(when, offset);
    return node;
  }
  startNode() {
    this.anchor = this.ctx.currentTime + 0.01;
    this.nodeCurrent = this.node(this.current, this.anchor, this.position);
    this.endTime = this.anchor + this.current.duration - this.position;
    const node = this.nodeCurrent;
    node.onended = () => {
      if (this.nodeCurrent !== node) return;
      if (this.nodeNext) {
        this.promoteIfDue();
        return;
      }
      this.position = this.current.duration;
      this._paused = true;
      clearInterval(this.timer);
      this.emit('timeupdate');
      this.emit('ended');
    };
    this.scheduleNext();
    clearInterval(this.timer);
    this.timer = setInterval(() => {
      this.promoteIfDue();
      this.emit('timeupdate');
    }, 100);
  }
  stop(node) {
    if (!node) return;
    node.onended = null;
    try {
      node.stop();
    } catch {}
    node.disconnect();
  }
  stopNodes() {
    clearInterval(this.timer);
    this.stop(this.nodeCurrent);
    this.stop(this.nodeNext);
    this.nodeCurrent = null;
    this.nodeNext = null;
  }
  async setNext(descriptor) {
    if (!this.enabled) return;
    if (this.desired?.key === descriptor?.key && this.desired?.url === descriptor?.url) return;
    this.desired = descriptor;
    const revision = ++this.revision,
      generation = this.generation;
    this.stop(this.nodeNext);
    this.nodeNext = null;
    this.prepared = null;
    if (!descriptor) return;
    await this.ready;
    if (revision !== this.revision || generation !== this.generation || !this.buffered) return;
    try {
      const buffer = descriptor.url === this.src ? this.current : await this.buffer(descriptor.url);
      if (revision !== this.revision || generation !== this.generation) return;
      this.prepared = { ...descriptor, buffer };
      this.scheduleNext();
    } catch (error) {
      if (revision === this.revision && generation === this.generation)
        this.status('Next track will use a normal transition: ' + error.message);
    }
  }
  scheduleNext() {
    if (
      this._paused ||
      !this.nodeCurrent ||
      !this.prepared ||
      this.nodeNext ||
      this.endTime <= this.ctx.currentTime
    )
      return;
    this.nodeNext = this.node(this.prepared.buffer, this.endTime);
  }
  promoteIfDue() {
    if (!this.nodeNext || this.ctx.currentTime < this.endTime) return;
    const item = this.prepared,
      when = this.endTime;
    this.nodeCurrent?.disconnect();
    this.nodeCurrent = this.nodeNext;
    this.nodeNext = null;
    this.prepared = null;
    this.desired = null;
    this.current = item.buffer;
    this._src = item.url;
    this.position = 0;
    this.anchor = when;
    this.endTime = when + item.buffer.duration;
    const node = this.nodeCurrent;
    node.onended = () => {
      if (this.nodeCurrent !== node) return;
      if (this.nodeNext) this.promoteIfDue();
      else {
        this.position = this.current.duration;
        this._paused = true;
        clearInterval(this.timer);
        this.emit('timeupdate');
        this.emit('ended');
      }
    };
    this.ontransition?.(item);
    this.emit('loadedmetadata');
    this.emit('playing');
  }
  dispose() {
    this.cancelOutputReload?.();
    if (this.disposed) return;
    this.pause();
    this.disposed = true;
    this.generation++;
    this.revision++;
    this.cancelDecode?.();
    for (const [type, listener] of this.nativeListeners)
      this.native.removeEventListener(type, listener);
    this.nativeListeners.clear();
    this.cache.clear();
    this.ctx?.close().catch(() => {});
  }
}
