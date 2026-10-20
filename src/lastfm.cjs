const fs = require('node:fs/promises');
const { replaceFile } = require('./replace-file.cjs');
const path = require('node:path');
const { createHash } = require('node:crypto');
function signature(params, secret) {
  return createHash('md5')
    .update(
      Object.keys(params)
        .filter((k) => !['format', 'callback', 'api_sig'].includes(k))
        .sort()
        .map((k) => k + params[k])
        .join('') + secret,
      'utf8',
    )
    .digest('hex');
}
class LastfmService {
  constructor({ directory, storage, fetch, openExternal, clock = () => Date.now() }) {
    this.file = path.join(directory, 'lastfm.enc');
    this.storage = storage;
    this.fetch = fetch;
    this.openExternal = openExternal;
    this.clock = clock;
    this.data = {
      key: '',
      secret: '',
      session: '',
      username: '',
      enabled: false,
      queue: [],
      seen: [],
    };
    this.chain = Promise.resolve();
    this.token = null;
    this.error = '';
    this.lastResult = '';
    this.nextRetry = 0;
    this.retryDelay = 60000;
    this.closed = false;
  }
  secure() {
    return (
      !!this.storage?.isEncryptionAvailable() &&
      this.storage.getSelectedStorageBackend?.() !== 'basic_text'
    );
  }
  async init() {
    try {
      const bytes = await fs.readFile(this.file);
      if (!this.secure()) throw new Error('Secure credential storage is unavailable.');
      const parsed = JSON.parse(this.storage.decryptString(bytes));
      if (!Array.isArray(parsed.queue) || !Array.isArray(parsed.seen))
        throw new Error('Invalid Last.fm settings.');
      this.data = parsed;
    } catch (e) {
      if (e.code !== 'ENOENT')
        this.error =
          'Last.fm credentials could not be opened. Save your API details again to reconnect.';
    }
    this.timer = setInterval(() => this.flush().catch(() => {}), 60000);
    this.timer.unref?.();
    if (this.data.enabled) this.flush().catch(() => {});
    return this.status();
  }
  status() {
    return {
      configured: !!this.data.key,
      connected: !!this.data.session,
      username: this.data.username,
      enabled: this.data.enabled,
      pending: this.data.queue.length,
      authorizing: !!this.token,
      secure: this.secure(),
      error: this.error,
      lastResult: this.lastResult,
    };
  }
  run(fn) {
    const task = this.chain.then(fn);
    this.chain = task.catch(() => {});
    return task;
  }
  async persist() {
    if (!this.secure())
      throw new Error(
        'Secure credential storage is unavailable. Enable your system keychain or keyring first.',
      );
    await fs.writeFile(this.file + '.tmp', this.storage.encryptString(JSON.stringify(this.data)), {
      mode: 0o600,
    });
    await replaceFile(this.file + '.tmp', this.file);
  }
  async request(method, extra = {}, session = true) {
    const params = { method, api_key: this.data.key, ...extra };
    if (session) params.sk = this.data.session;
    params.api_sig = signature(params, this.data.secret);
    params.format = 'json';
    const body = new URLSearchParams(params),
      auth = method.startsWith('auth.');
    let response, result;
    try {
      response = await this.fetch(
        'https://ws.audioscrobbler.com/2.0/' + (auth ? '?' + body.toString() : ''),
        {
          method: auth ? 'GET' : 'POST',
          headers: {
            'User-Agent': 'Localtone/' + require('../package.json').version,
            ...(!auth ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
          },
          ...(auth ? {} : { body: body.toString() }),
          signal: AbortSignal.timeout(12000),
          redirect: 'error',
        },
      );
      result = await response.json();
    } catch {
      throw Object.assign(new Error('Last.fm is unreachable. Eligible scrobbles stay queued.'), {
        retry: true,
      });
    }
    if (!result || typeof result !== 'object' || Array.isArray(result))
      throw Object.assign(new Error('Unexpected Last.fm response. Please try again.'), {
        retry: true,
      });
    if (result.error) {
      const code = Number(result.error),
        messages = {
          9: 'Last.fm authorization expired. Connect again.',
          10: 'Invalid Last.fm API key.',
          13: 'Last.fm rejected the API signature. Check the shared secret.',
          14: 'Authorization token expired. Connect again.',
          15: 'Approve access in your browser, then click Finish connection.',
          26: 'Last.fm API key suspended.',
          29: 'Last.fm rate limit reached. Scrobbles will retry later.',
        };
      throw Object.assign(new Error(messages[code] || `Last.fm error ${code}.`), {
        code,
        retry: [11, 16, 29].includes(code),
      });
    }
    if (!response.ok)
      throw Object.assign(new Error('Last.fm server error. Scrobbles will retry later.'), {
        retry: true,
      });
    return result;
  }
  saveCredentials(key, secret) {
    return this.run(async () => {
      if (!/^[a-f0-9]{32}$/i.test(key) || !/^[a-f0-9]{32}$/i.test(secret))
        throw new Error('Enter the 32-character API key and shared secret.');
      const before = this.data;
      this.data = { key, secret, session: '', username: '', enabled: false, queue: [], seen: [] };
      try {
        await this.persist();
      } catch (e) {
        this.data = before;
        throw e;
      }
      this.token = null;
      this.error = '';
      return this.status();
    });
  }
  connect() {
    return this.run(async () => {
      if (!this.data.key) throw new Error('Save your API key and shared secret first.');
      const result = await this.request('auth.getToken', {}, false);
      if (
        typeof result.token !== 'string' ||
        !result.token.length ||
        result.token.length > 4096 ||
        /[\s\u0000-\u001f\u007f]/.test(result.token)
      )
        throw new Error(
          'Last.fm did not return a usable authorization token. Please try Connect again.',
        );
      this.token = { value: result.token, at: this.clock() };
      await this.openExternal(
        'https://www.last.fm/api/auth/?' +
          new URLSearchParams({ api_key: this.data.key, token: this.token.value }),
      );
      this.error = '';
      return this.status();
    });
  }
  finish() {
    return this.run(async () => {
      if (!this.token || this.clock() - this.token.at > 3600000)
        throw new Error('Click Connect to start authorization again.');
      const result = await this.request('auth.getSession', { token: this.token.value }, false);
      if (!result.session?.key || !result.session?.name)
        throw new Error('Last.fm returned an invalid session.');
      if (this.data.username && this.data.username !== result.session.name) {
        this.data.queue = [];
        this.data.seen = [];
      }
      this.data.session = result.session.key;
      this.data.username = result.session.name;
      this.data.enabled = true;
      this.token = null;
      this.error = '';
      this.nextRetry = 0;
      await this.persist();
      return this.status();
    }).then((status) => {
      this.flush().catch(() => {});
      return status;
    });
  }
  enable(value) {
    return this.run(async () => {
      if (typeof value !== 'boolean') throw new Error('Invalid scrobbling setting.');
      if (value && !this.data.session) throw new Error('Connect your Last.fm account first.');
      this.data.enabled = value;
      await this.persist();
      return this.status();
    }).then((status) => {
      if (value) this.flush().catch(() => {});
      return status;
    });
  }
  disconnect() {
    return this.run(async () => {
      this.data.session = '';
      this.data.username = '';
      this.data.enabled = false;
      this.data.queue = [];
      this.data.seen = [];
      this.token = null;
      this.error = '';
      this.lastResult = '';
      await this.persist();
      return this.status();
    });
  }
  submit(kind, play, metadata) {
    return this.run(async () => {
      if (!this.data.enabled || !this.data.session) return this.status();
      if (!metadata?.artist || !metadata?.track) {
        this.lastResult = 'Skipped a track without artist/title tags.';
        return this.status();
      }
      const params = { artist: metadata.artist, track: metadata.track };
      for (const key of ['album', 'albumArtist', 'trackNumber', 'duration'])
        if (metadata[key]) params[key] = String(metadata[key]);
      if (kind === 'now') {
        try {
          await this.request('track.updateNowPlaying', params);
        } catch (e) {
          this.error = e.message;
          if (e.code === 9) {
            this.data.session = '';
            this.data.enabled = false;
            await this.persist();
          }
        }
        return this.status();
      }
      if (
        kind !== 'scrobble' ||
        !Number.isFinite(metadata.duration) ||
        metadata.duration <= 30 ||
        !Number.isFinite(play.heard) ||
        play.heard < Math.min(metadata.duration / 2, 240)
      )
        return this.status();
      if (
        typeof play.playId !== 'string' ||
        play.playId.length > 160 ||
        !Number.isInteger(play.timestamp) ||
        play.timestamp > Math.floor(this.clock() / 1000) + 60
      )
        throw new Error('Invalid playback event.');
      if (this.data.seen.includes(play.playId)) return this.status();
      const previousSeen = [...this.data.seen];
      this.data.queue.push({
        playId: play.playId,
        params: { ...params, timestamp: String(play.timestamp) },
      });
      this.data.seen.push(play.playId);
      this.data.seen = this.data.seen.slice(-1000);
      try {
        await this.persist();
      } catch (error) {
        this.data.queue.pop();
        this.data.seen = previousSeen;
        throw error;
      }
      return this.status();
    }).then((status) => {
      if (kind === 'scrobble') this.flush().catch(() => {});
      return status;
    });
  }
  flush() {
    return this.run(async () => {
      if (this.closed || !this.data.enabled || !this.data.session || this.clock() < this.nextRetry)
        return this.status();
      // One bounded batch per pass; older entries always go first.
      for (let i = 0; i < 50 && !this.closed && this.data.queue.length; i++) {
        const item = this.data.queue[0];
        let remove = false;
        try {
          const result = await this.request('track.scrobble', item.params);
          if (!result.scrobbles)
            throw Object.assign(new Error('Unexpected Last.fm response; scrobble retained.'), {
              retry: true,
            });
          const code = Number(result.scrobbles.scrobble?.ignoredMessage?.code || 0);
          this.lastResult = code ? `Last.fm ignored a scrobble (code ${code}).` : 'Scrobble sent.';
          this.error = '';
          remove = true;
          this.retryDelay = 60000;
          this.nextRetry = 0;
        } catch (e) {
          this.error = e.message;
          if (e.code === 9) {
            this.data.session = '';
            this.data.enabled = false;
            await this.persist();
            break;
          }
          if (e.retry) {
            this.nextRetry = this.clock() + this.retryDelay;
            this.retryDelay = Math.min(this.retryDelay * 2, 3600000);
            break;
          }
          if ([4, 10, 13, 26].includes(e.code)) {
            this.data.enabled = false;
            await this.persist();
            break;
          }
          this.lastResult = e.message;
          remove = true;
        }
        if (remove) {
          this.data.queue.shift();
          try {
            await this.persist();
          } catch (error) {
            this.data.queue.unshift(item);
            this.error = 'Unable to save the Last.fm queue. Check disk space.';
            throw error;
          }
        }
      }
      return this.status();
    });
  }
  async close() {
    this.closed = true;
    clearInterval(this.timer);
    await this.chain;
  }
}
async function metadataFor(track) {
  const { parseFile } = await import('music-metadata');
  const { common, format } = await parseFile(track.path, { duration: true, skipCovers: true });
  return {
    artist: common.artist || '',
    track: common.title || '',
    album: common.album || '',
    albumArtist: common.albumartist || '',
    trackNumber: common.track?.no || 0,
    duration: format.duration || track.duration || 0,
  };
}
module.exports = { LastfmService, signature, metadataFor };
