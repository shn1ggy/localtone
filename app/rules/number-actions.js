(function (root) {
  const albumIdentity = (track) =>
    JSON.stringify([track.folderKey, track.albumFolder ?? track.album ?? '']);
  const rawNumber = (track) => String(track.trackRaw ?? (track.track || ''));
  function numberActionNeeded(track, mode) {
    const raw = rawNumber(track);
    if (!/^\d+(\/\d+)?$/.test(raw)) return false;
    const parts = raw.split('/');
    if (mode === 'total' && !(Number(parts[0]) > 0)) return false;
    if (mode === 'pad') return parts.some((part) => part.length < 2);
    if (mode === 'unpad') return parts.some((part) => /^0\d/.test(part));
    return (
      mode === 'total' && Number(parts[0]) > 0 && (parts.length < 2 || !(Number(parts[1]) > 0))
    );
  }
  function canRenumber(tracks, allTracks) {
    if (!tracks.length || tracks.some((t) => !t || t.missing || t.codec !== 'MP3')) return false;
    const key = albumIdentity(tracks[0]);
    if (tracks.some((t) => albumIdentity(t) !== key)) return false;
    const peers = allTracks.filter((t) => albumIdentity(t) === key),
      ids = new Set(tracks.map((t) => t.id));
    return peers.length === ids.size && peers.every((t) => !t.missing && ids.has(t.id));
  }
  function folderNumbers(tracks) {
    const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
    const parts = (track) =>
      String(track.artistPath ?? track.relativePath ?? track.path ?? track.title ?? '')
        .replace(/\\/g, '/')
        .split('/');
    const ordered = [...tracks].sort((a, b) => {
      const left = parts(a),
        right = parts(b);
      for (let i = 0; i < Math.min(left.length, right.length); i++) {
        const cmp = collator.compare(left[i], right[i]);
        if (cmp) return cmp;
      }
      return left.length - right.length || String(a.id).localeCompare(String(b.id));
    });
    const counts = new Map(),
      numbers = new Map();
    for (const track of ordered) {
      const disc = Number(track.disc) || 1,
        number = (counts.get(disc) || 0) + 1;
      counts.set(disc, number);
      numbers.set(track.id, number);
    }
    return numbers;
  }
  const api = { canRenumber, numberActionNeeded, folderNumbers };
  root.LocaltoneNumbers = api;
  if (typeof module !== 'undefined') module.exports = api;
})(globalThis);
