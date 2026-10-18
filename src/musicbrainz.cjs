// Read-only release lookup. Requests are serialized and cached in memory.
const { version, homepage } = require('../package.json');
const validId = (value) =>
  typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const credit = (items) =>
  (items || [])
    .map((item) => (item.name || item.artist?.name || '') + (item.joinphrase || ''))
    .join('');
const quoted = (value) => '"' + value.replace(/[\\"]/g, '\\$&') + '"';
function createMusicBrainz({
  fetch = globalThis.fetch,
  now = Date.now,
  wait = (ms) => new Promise((r) => setTimeout(r, ms)),
  userAgent = `Localtone/${version} (${homepage})`,
} = {}) {
  let lane = Promise.resolve(),
    last = -Infinity;
  const cache = new Map();
  function request(relative, params) {
    const url = new URL('https://musicbrainz.org/ws/2/' + relative);
    url.search = new URLSearchParams({ ...params, fmt: 'json' });
    const key = url.href;
    if (cache.has(key)) return cache.get(key);
    const job = lane
      .catch(() => {})
      .then(async () => {
        const gap = 1100 - (now() - last);
        if (gap > 0) await wait(gap);
        last = now();
        const response = await fetch(url.href, {
          headers: { 'User-Agent': userAgent, Accept: 'application/json' },
          signal: AbortSignal.timeout(15000),
          redirect: 'error',
        });
        if (!response.ok)
          throw Error(
            response.status === 503 || response.status === 429
              ? 'MusicBrainz is busy. Please try again shortly.'
              : `MusicBrainz lookup failed (${response.status}).`,
          );
        return response.json();
      });
    lane = job;
    cache.set(key, job);
    if (cache.size > 64) cache.delete(cache.keys().next().value);
    job.catch(() => cache.delete(key));
    return job;
  }
  return {
    async search({ album, artist }) {
      if (
        typeof album !== 'string' ||
        !album.trim() ||
        album.length > 500 ||
        typeof artist !== 'string' ||
        artist.length > 500
      )
        throw Error('Album and artist names are required for lookup.');
      const query =
        'release:' +
        quoted(album.trim()) +
        (artist.trim() ? ' AND artist:' + quoted(artist.trim()) : '');
      const data = await request('release', { query, limit: '25' });
      return (data.releases || [])
        .filter((r) => validId(r.id))
        .map((r) => ({
          id: r.id,
          title: r.title,
          artist: credit(r['artist-credit']),
          date: r.date || '',
          country: r.country || '',
          status: r.status || '',
          edition: r.disambiguation || '',
          tracks: r['track-count'] || 0,
          formats: (r.media || [])
            .map((m) => m.format)
            .filter(Boolean)
            .join(' / '),
        }));
    },
    async release(id) {
      if (!validId(id)) throw Error('Invalid MusicBrainz release.');
      const data = await request('release/' + id, {
        inc: 'recordings+artist-credits+release-groups+genres',
      });
      const tracks = [];
      for (const medium of data.media || []) {
        const total = medium['track-count'];
        for (const track of medium.tracks || []) {
          const number = track.position;
          if (!Number.isInteger(number) || number < 1 || !Number.isInteger(total) || total < number)
            continue;
          tracks.push({
            key: `${medium.position}:${number}`,
            disc: medium.position || 1,
            number,
            total,
            title: track.title || track.recording?.title || '',
            artist:
              credit(track['artist-credit'] || track.recording?.['artist-credit']) ||
              credit(data['artist-credit']),
            duration: Number(track.length || track.recording?.length || 0) / 1000,
          });
        }
      }
      return {
        id: data.id,
        title: data.title,
        artist: credit(data['artist-credit']),
        year: /^\d{4}/.exec(data.date || '')?.[0] || '',
        genre: ((data.genres?.length ? data.genres : data['release-group']?.genres) || [])
          .filter((g) => g.name)
          .toSorted((a, b) => (b.count || 0) - (a.count || 0))
          .map((g) => g.name)
          .join(', '),
        discTotal: (data.media || []).length,
        tracks,
      };
    },
  };
}
module.exports = { createMusicBrainz };
