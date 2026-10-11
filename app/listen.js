// Count actual media progress, capped by elapsed wall time. Seeking and waiting
// reset the baseline; neither can manufacture listening time.
export class ListenTracker {
  constructor(send, clock = () => performance.now(), timestamp = () => Date.now()) {
    this.send = send;
    this.clock = clock;
    this.timestamp = timestamp;
    this.serial = 0;
    this.current = null;
  }
  begin(track) {
    this.current = {
      track,
      position: 0,
      at: this.clock(),
      playing: false,
      heard: 0,
      sent: false,
      started: false,
      ended: false,
      playId: `${this.timestamp()}-${++this.serial}-${Math.random().toString(36).slice(2)}`,
    };
  }
  playing(position) {
    const p = this.current;
    if (!p) return;
    if (p.ended) this.begin(p.track);
    const active = this.current;
    active.at = this.clock();
    active.position = position;
    active.playing = true;
    if (!active.started) {
      active.started = true;
      active.timestamp = Math.floor(this.timestamp() / 1000);
      this.send('now', this.payload(active));
    }
  }
  payload(p) {
    return { id: p.track.id, playId: p.playId, timestamp: p.timestamp, heard: p.heard };
  }
  sample(position) {
    const p = this.current;
    if (!p) return;
    const now = this.clock(),
      wall = Math.max(0, (now - p.at) / 1000),
      progress = position - p.position;
    if (p.playing && progress > 0 && progress <= wall + 1) p.heard += Math.min(progress, wall);
    p.at = now;
    p.position = position;
    const duration = p.track.duration;
    if (p.started && !p.sent && duration > 30 && p.heard >= Math.min(duration / 2, 240)) {
      p.sent = true;
      this.send('scrobble', this.payload(p));
    }
  }
  pause(position) {
    this.sample(position);
    if (this.current) this.current.playing = false;
  }
  seek(position) {
    if (this.current) {
      this.current.position = position;
      this.current.at = this.clock();
    }
  }
  end(position) {
    this.pause(position);
    if (this.current) this.current.ended = true;
  }
  clear() {
    this.current = null;
  }
}
