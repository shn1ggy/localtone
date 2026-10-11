import './rules/number-actions.js';
export const { canRenumber, numberActionNeeded } = globalThis.LocaltoneNumbers;
import './rules/search.js';
import './rules/playlist-rules.js';
export const {
  validateDynamic,
  matchingTracks,
  fields: filterFields,
  textOps,
  numberOps,
  numeric: filterNumeric,
  dateFields,
  dateOps,
  emptyOps,
} = globalThis.LocaltoneRules;
export function playlistTracks(state, playlist) {
  if (playlist?.dynamic?.enabled) return matchingTracks(state, playlist.dynamic);
  const lookup = new Map(state.tracks.map((t) => [t.id, t]));
  return (playlist?.trackIds || []).map((id) => lookup.get(id)).filter((t) => t && !t.missing);
}
const naturalCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
export function comparePaths(a, b) {
  const left = String(a || '').split('/'),
    right = String(b || '').split('/');
  for (let i = 0; i < Math.min(left.length, right.length); i++) {
    const cmp = naturalCollator.compare(left[i], right[i]);
    if (cmp) return cmp;
  }
  return left.length - right.length;
}
export function randomRank(key, seed = 0) {
  let hash = (2166136261 ^ seed) >>> 0;
  for (const char of String(key)) {
    hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
  }
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x7feb352d);
  hash ^= hash >>> 15;
  hash = Math.imul(hash, 0x846ca68b);
  return (hash ^ (hash >>> 16)) >>> 0;
}
export function artistGroupName(track, source = 'folder') {
  return source === 'folder'
    ? track.folderArtist || 'Music'
    : String(
        source === 'albumArtist'
          ? track.albumArtist || track.artist || 'Unknown artist'
          : track.artist || 'Unknown artist',
      ).trim() || 'Unknown artist';
}
export function artistGroupKey(track, source = 'folder') {
  return source === 'folder' ? track.folderKey : `${source}:${artistGroupName(track, source)}`;
}
export function selectTracks(
  state,
  scope,
  query = '',
  sort = 'artist',
  direction = 1,
  artist = null,
  randomSeed = 0,
  artistGrouping = 'folder',
) {
  const importedLibraries = new Set(
    (state.libraries || []).filter((l) => l.importedFiles).map((l) => l.id),
  );
  let tracks =
    scope.kind === 'playlist'
      ? playlistTracks(
          state,
          state.playlists.find((p) => p.id === scope.id),
        )
      : state.tracks.filter(
          (t) =>
            !t.missing &&
            !importedLibraries.has(t.libraryId) &&
            (scope.kind !== 'library' || t.libraryId === scope.id),
        );
  if (query.trim()) {
    const compiled = compileSearch(query);
    tracks = tracks.filter((t) => compiled.matches(t, state));
  }
  if (artist !== null) tracks = tracks.filter((t) => artistGroupKey(t, artistGrouping) === artist);
  if (sort === 'manual') return tracks;
  if (sort === 'random') {
    const ranks = new Map(tracks.map((t) => [t.id, randomRank(t.id, randomSeed)]));
    return tracks.toSorted(
      (a, b) => ranks.get(a.id) - ranks.get(b.id) || String(a.id).localeCompare(String(b.id)),
    );
  }
  return tracks.toSorted((a, b) => {
    let cmp;
    if (sort === 'folder')
      return (
        (comparePaths(a.folderArtist, b.folderArtist) ||
          comparePaths(a.artistPath, b.artistPath) ||
          String(a.id).localeCompare(String(b.id))) * direction
      );
    if (['year', 'duration', 'track', 'rating'].includes(sort))
      cmp =
        sort === 'rating'
          ? (state.ratings?.[a.id] || 0) - (state.ratings?.[b.id] || 0)
          : (Number(a[sort]) || 0) - (Number(b[sort]) || 0);
    else cmp = naturalCollator.compare(String(a[sort] || ''), String(b[sort] || ''));
    return (
      (cmp ||
        a.album.localeCompare(b.album) ||
        a.disc - b.disc ||
        a.track - b.track ||
        a.title.localeCompare(b.title)) * direction
    );
  });
}
export function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds),
    minutes = String(Math.floor((total % 3600) / 60)).padStart(2, '0'),
    remaining = String(total % 60).padStart(2, '0');
  return total >= 3600
    ? `${Math.floor(total / 3600)}:${minutes}:${remaining}`
    : `${Math.floor(total / 60)}:${remaining}`;
}
export function openingArtist(tracks, mode, lastId, random = Math.random, source = 'folder') {
  if (mode === 'none' || !tracks.length) return null;
  if (mode === 'first') {
    const first = tracks.toSorted((a, b) =>
      naturalCollator.compare(artistGroupName(a, source), artistGroupName(b, source)),
    )[0];
    return artistGroupKey(first, source);
  }
  if (mode === 'last') {
    const track = tracks.find((t) => t.id === lastId);
    if (track) return artistGroupKey(track, source);
  }
  const keys = [...new Set(tracks.map((t) => artistGroupKey(t, source)))];
  return keys[Math.min(keys.length - 1, Math.floor(random() * keys.length))] ?? null;
}

export const { compileSearch } = globalThis.LocaltoneSearch;
