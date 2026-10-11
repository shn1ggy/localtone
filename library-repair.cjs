const fs = require('node:fs/promises'),
  path = require('node:path');
function relativeFile(root, file) {
  const flavor = /^(?:[a-z]:[\\/]|\\\\)/i.test(root) ? path.win32 : path.posix;
  const relative = flavor.relative(root, file);
  if (
    !relative ||
    flavor.isAbsolute(relative) ||
    relative === '..' ||
    relative.startsWith('..' + flavor.sep)
  )
    throw new Error('A track is outside its library folder. Reconnect was cancelled.');
  return relative.split(flavor.sep);
}
async function planReconnect(library, tracks, newRoot) {
  let matches = 0;
  const mapped = [];
  for (const track of tracks) {
    const filename = path.join(newRoot, ...relativeFile(library.root, track.path));
    let missing = false;
    try {
      const stat = await fs.stat(filename);
      if (!stat.isFile() || stat.size !== track.size)
        throw new Error('File differs from the indexed track: ' + filename);
      matches++;
    } catch (error) {
      if (error.code === 'ENOENT' || error.code === 'ENOTDIR') missing = true;
      else throw error;
    }
    mapped.push({ ...track, path: filename, missing });
  }
  if (tracks.length && !matches)
    throw new Error(
      'No matching tracks found. Choose the folder with the same artist/album structure.',
    );
  return { tracks: mapped, matches, missing: mapped.length - matches };
}
async function findMissing(tracks) {
  const missing = [];
  let index = 0;
  await Promise.all(
    Array.from({ length: Math.min(16, tracks.length) }, async () => {
      while (index < tracks.length) {
        const track = tracks[index++];
        try {
          const stat = await fs.stat(track.path);
          if (!stat.isFile())
            missing.push({
              id: track.id,
              libraryId: track.libraryId,
              title: track.title,
              path: track.path,
              reason: 'Not a file',
            });
        } catch (error) {
          missing.push({
            id: track.id,
            libraryId: track.libraryId,
            title: track.title,
            path: track.path,
            reason: ['ENOENT', 'ENOTDIR'].includes(error.code)
              ? 'Missing'
              : 'Unavailable (' + (error.code || 'read error') + ')',
          });
        }
      }
    }),
  );
  return missing.sort((a, b) => a.path.localeCompare(b.path));
}
async function requireMissing(track) {
  try {
    await fs.stat(track.path);
  } catch (error) {
    if (['ENOENT', 'ENOTDIR'].includes(error.code)) return;
    throw Error(
      'The file is unavailable, not confirmed missing. Reconnect its drive or sync folder first.',
    );
  }
  throw Error('This file is available again. Check the missing-files list again.');
}
function suggestedMatches(track, available) {
  const text = (value) =>
    String(value || '')
      .trim()
      .toLowerCase();
  return available
    .filter((t) => t.id !== track.id && t.libraryId === track.libraryId)
    .map((t) => {
      const reasons = [];
      if (Number.isFinite(track.size) && t.size === track.size) reasons.push('size');
      if (track.duration > 0 && Math.abs(t.duration - track.duration) < 1) reasons.push('duration');
      if (text(track.title) && text(t.title) === text(track.title)) reasons.push('title');
      if (text(track.artist) && text(t.artist) === text(track.artist)) reasons.push('artist');
      if (text(track.album) && text(t.album) === text(track.album)) reasons.push('album');
      const plausible =
        reasons.includes('size') ||
        (reasons.includes('title') && (reasons.includes('duration') || reasons.includes('album')));
      return { id: t.id, path: t.path, reasons, score: reasons.length, plausible };
    })
    .filter((t) => t.plausible)
    .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path))
    .slice(0, 5)
    .map(({ id, path, reasons }) => ({ id, path, reasons }));
}
async function planTrackReconnect(library, track, filename, tracks) {
  await requireMissing(track);
  const file = await fs.realpath(filename),
    root = await fs.realpath(library.root);
  relativeFile(root, file);
  const info = await fs.lstat(file);
  if (!info.isFile()) throw Error('Choose an audio file.');
  if (!/\.(mp3|flac|wav|ogg|m4a|aac|opus|aiff)$/i.test(file))
    throw Error('Choose a supported audio file.');
  const duplicates = tracks.filter((t) => t.id !== track.id && t.path === file);
  if (duplicates.some((t) => t.libraryId !== library.id))
    throw Error('This file belongs to another library. Choose a file in this library.');
  return { file, duplicates: duplicates.map((t) => t.id), size: info.size, mtime: info.mtimeMs };
}
function replaceTrackReferences(db, remap) {
  const map = (id) => (Object.hasOwn(remap, id) ? remap[id] : id);
  for (const playlist of db.playlists)
    playlist.trackIds = [...new Set(playlist.trackIds.map(map).filter(Boolean))];
  for (const id of Object.keys(remap)) {
    delete db.ratings[id];
    delete db.pendingRatings?.[id];
  }
}
module.exports = {
  relativeFile,
  planReconnect,
  findMissing,
  requireMissing,
  suggestedMatches,
  planTrackReconnect,
  replaceTrackReferences,
};
