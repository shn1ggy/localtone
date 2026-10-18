const fs = require('node:fs/promises');
// Stat only known files; worker scans read metadata only for the changed subset.
async function changedTracks(tracks, concurrency = 32) {
  let cursor = 0;
  const changed = new Map(),
    missing = [],
    unavailable = [];
  await Promise.all(
    Array.from({ length: Math.min(concurrency, tracks.length) }, async () => {
      while (cursor < tracks.length) {
        const track = tracks[cursor++];
        try {
          const info = await fs.stat(track.path);
          if (!info.isFile()) {
            missing.push(track.id);
            continue;
          }
          if (track.missing || info.mtimeMs !== track.mtime || info.size !== track.size) {
            if (!changed.has(track.libraryId)) changed.set(track.libraryId, []);
            changed.get(track.libraryId).push(track.path);
          }
        } catch (error) {
          if (['ENOENT', 'ENOTDIR'].includes(error.code)) missing.push(track.id);
          else unavailable.push(track.id);
        }
      }
    }),
  );
  return { changed, missing, unavailable };
}
module.exports = { changedTracks };
