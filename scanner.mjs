import { parentPort, workerData } from 'node:worker_threads';
import { readdir, stat, mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import NodeID3 from 'node-id3';
import ratingTags from './rating-tags.cjs';
import { parseFile } from 'music-metadata';
const extensions = new Set([
  '.mp3',
  '.flac',
  '.wav',
  '.ogg',
  '.m4a',
  '.aac',
  '.opus',
  '.aiff',
  '.aif',
]);
const hash = (value) => createHash('sha256').update(value).digest('hex');
const old = new Map(workerData.previous.map((t) => [t.path, t]));
let scanned = 0,
  warnings = 0;
async function walk(folder) {
  // A directory error fails the scan: never commit an incomplete replacement.
  const entries = workerData.files
    ? workerData.files.map((name) => ({ name, isDirectory: () => false, isFile: () => true }))
    : await readdir(folder, { withFileTypes: true });
  const output = [];
  for (const entry of entries) {
    const filename = workerData.files ? entry.name : path.join(folder, entry.name);
    if (entry.isDirectory()) output.push(...(await walk(filename)));
    else if (entry.isFile() && extensions.has(path.extname(filename).toLowerCase())) {
      const info = await stat(filename);
      const previous = old.get(filename);
      if (
        previous?.mtime === info.mtimeMs &&
        previous?.size === info.size &&
        'tagRating' in previous &&
        Array.isArray(previous.missingTags) &&
        typeof previous.trackRaw === 'string' &&
        typeof previous.discRaw === 'string'
      )
        output.push({ ...previous, missing: false });
      else {
        const id = previous?.id || hash(workerData.libraryId + '\0' + filename);
        let common = {},
          format = {},
          cover = false,
          tagRating = null,
          trackRaw = '',
          discRaw = '';
        try {
          ({ common, format } = await parseFile(filename, { duration: true }));
          if (previous && format.hasAudio === false)
            throw Error('The changed audio file is incomplete.');
          trackRaw = common.track?.no
            ? `${common.track.no}${common.track.of ? '/' + common.track.of : ''}`
            : '';
          discRaw = common.disk?.no
            ? `${common.disk.no}${common.disk.of ? '/' + common.disk.of : ''}`
            : '';
          if (path.extname(filename).toLowerCase() === '.mp3') {
            const bytes = await readFile(filename);
            tagRating = ratingTags.readRating(bytes);
            const tags = NodeID3.read(bytes);
            trackRaw = String(tags.trackNumber || trackRaw);
            discRaw = String(tags.partOfSet || discRaw);
          }
          const picture = common.picture?.[0];
          if (picture && ['image/jpeg', 'image/png', 'image/webp'].includes(picture.format)) {
            await writeFile(path.join(workerData.covers, id), picture.data);
            cover = true;
          }
        } catch {
          warnings++;
          if (previous) {
            output.push({ ...previous, missing: false });
            continue;
          }
        }
        output.push({
          id,
          missing: false,
          path: filename,
          libraryId: workerData.libraryId,
          title: common.title || path.basename(filename, path.extname(filename)),
          artist: common.artist || 'Unknown artist',
          albumArtist: common.albumartist || common.artist || 'Unknown artist',
          album: common.album || 'Unknown album',
          year: common.year || '',
          genre: (common.genre || []).join(', '),
          trackRaw,
          track: common.track?.no || 0,
          disc: common.disk?.no || 1,
          discRaw,
          duration: format.duration || 0,
          codec: path.extname(filename).slice(1).toUpperCase(),
          addedAt: previous ? (previous.addedAt ?? null) : Date.now(),
          modifiedAt: info.mtimeMs,
          missingTags: ['title', 'artist', 'albumArtist', 'album', 'year', 'genre'].filter(
            (key) => {
              const value = common[key === 'albumArtist' ? 'albumartist' : key];
              return !value || (Array.isArray(value) && !value.length);
            },
          ),
          mtime: info.mtimeMs,
          size: info.size,
          cover,
          tagRating,
        });
      }
      if (++scanned % 25 === 0) parentPort.postMessage({ progress: scanned });
    }
  }
  return output;
}
try {
  await mkdir(workerData.covers, { recursive: true });
  const tracks = await walk(workerData.root);
  parentPort.postMessage({ tracks, warnings });
} catch (error) {
  parentPort.postMessage({ error: error.message });
}
