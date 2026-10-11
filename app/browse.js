import { artistGroupName, artistGroupKey, comparePaths, randomRank } from './core.js';
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
export const albumKey = (track) =>
  JSON.stringify([track.folderKey, track.albumFolder ?? track.album ?? '']);
export function artistsFor(tracks, sort = 'name', source = 'folder') {
  const groups = new Map();
  for (const track of tracks) {
    const key = artistGroupKey(track, source);
    if (!groups.has(key)) groups.set(key, { name: artistGroupName(track, source), duration: 0 });
    groups.get(key).duration += track.duration || 0;
  }
  return [...groups.keys()].sort((a, b) => {
    const left = groups.get(a),
      right = groups.get(b);
    return sort.startsWith('duration')
      ? (left.duration - right.duration) * (sort === 'duration-desc' ? -1 : 1) ||
          collator.compare(left.name, right.name)
      : collator.compare(left.name, right.name) * (sort === 'name-desc' ? -1 : 1);
  });
}
export function albumsFor(
  tracks,
  artist = null,
  sort = 'folder',
  direction = 1,
  { ratings = {}, seed = 0 } = {},
) {
  const groups = new Map();
  for (const track of tracks) {
    if (artist !== null && track.folderKey !== artist) continue;
    const key = albumKey(track);
    if (!groups.has(key))
      groups.set(key, {
        key,
        name: track.album || 'Unknown album',
        artist: track.albumArtist || track.artist,
        year: track.year,
        folderArtist: track.folderArtist,
        folder: track.albumFolder ?? track.album,
        tracks: [],
        cover: null,
      });
    const album = groups.get(key);
    album.tracks.push(track);
    if (track.cover && !album.cover) album.cover = track;
  }
  for (const album of groups.values())
    album.tracks.sort((a, b) => comparePaths(a.artistPath ?? a.title, b.artistPath ?? b.title));
  const albums = [...groups.values()],
    folder = (a, b) =>
      comparePaths(a.folderArtist, b.folderArtist) || comparePaths(a.folder, b.folder);
  if (sort === 'manual') return albums;
  if (sort === 'random') {
    const ranks = new Map(albums.map((a) => [a.key, randomRank(a.key, seed)]));
    return albums.sort((a, b) => ranks.get(a.key) - ranks.get(b.key) || folder(a, b));
  }
  const value = (album) =>
    sort === 'duration'
      ? album.tracks.reduce((sum, t) => sum + (t.duration || 0), 0)
      : sort === 'rating'
        ? album.tracks.reduce((sum, t) => sum + (ratings[t.id] || 0), 0) / album.tracks.length
        : sort === 'year'
          ? Number(album.year) || 0
          : sort === 'album' || sort === 'title'
            ? album.name
            : sort === 'genre'
              ? [...new Set(album.tracks.map((t) => t.genre).filter(Boolean))].join(', ')
              : album.artist;
  const values =
    sort === 'folder' ? null : new Map(albums.map((album) => [album.key, value(album)]));
  return albums.sort((a, b) => {
    if (sort === 'folder') return folder(a, b) * direction;
    const left = values.get(a.key),
      right = values.get(b.key),
      cmp = typeof left === 'number' ? left - right : collator.compare(left, right);
    return (cmp || folder(a, b)) * direction;
  });
}
