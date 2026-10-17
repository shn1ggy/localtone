import './rules/number-actions.js';
export const { canRenumber, numberActionNeeded } = globalThis.LocaltoneNumbers;
import './rules/search.js';
import './rules/playlist-rules.js';
export const {
  validateDynamic,
  matchingTracks,
  matchesTrack,
  fields: filterFields,
  textOps,
  numberOps,
  numeric: filterNumeric,
  dateFields,
  dateOps,
  emptyOps,
} = globalThis.LocaltoneRules;
// The renderer replaces state.tracks wholesale on every collection change, so one
// id lookup per tracks array can be shared by every playlist and every render.
const trackLookups = new WeakMap();
export function trackLookupFor(tracks) {
  let lookup = trackLookups.get(tracks);
  if (!lookup) {
    lookup = new Map(tracks.map((t) => [t.id, t]));
    trackLookups.set(tracks, lookup);
  }
  return lookup;
}
export function playlistTracks(state, playlist) {
  if (playlist?.dynamic?.enabled) return matchingTracks(state, playlist.dynamic);
  const lookup = trackLookupFor(state.tracks);
  return (playlist?.trackIds || []).map((id) => lookup.get(id)).filter((t) => t && !t.missing);
}
// Same answer as playlistTracks(state, playlist).some((t) => t.id === track.id),
// without materialising the playlist.
export function playlistIncludes(state, playlist, track) {
  const known = track && trackLookupFor(state.tracks).get(track.id);
  if (!known || known.missing) return false;
  if (playlist?.dynamic?.enabled) return matchesTrack(state, playlist.dynamic, known);
  return (playlist?.trackIds || []).includes(known.id);
}
const naturalCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
// Same ordering as String.prototype.localeCompare without arguments.
const defaultCollator = new Intl.Collator();
export const pathParts = (value) => String(value || '').split('/');
export function compareParts(left, right) {
  for (let i = 0; i < Math.min(left.length, right.length); i++) {
    const cmp = naturalCollator.compare(left[i], right[i]);
    if (cmp) return cmp;
  }
  return left.length - right.length;
}
export function comparePaths(a, b) {
  return compareParts(pathParts(a), pathParts(b));
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
            !t.excluded &&
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
  // Folder order compares split paths; split each track's paths once instead of on
  // every comparison (decorate, stable-sort, undecorate keeps the same order).
  if (sort === 'folder')
    return tracks
      .map((t) => ({
        t,
        a: pathParts(t.folderArtist),
        b: pathParts(t.artistPath),
        id: String(t.id),
      }))
      .sort(
        (left, right) =>
          (compareParts(left.a, right.a) ||
            compareParts(left.b, right.b) ||
            defaultCollator.compare(left.id, right.id)) * direction,
      )
      .map((entry) => entry.t);
  return tracks.toSorted((a, b) => {
    let cmp;
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
