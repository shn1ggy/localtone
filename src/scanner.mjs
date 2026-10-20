import { parentPort, workerData } from 'node:worker_threads';
import { readdir, stat, mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import libraryFilters from './library-filters.cjs';
const excluded = libraryFilters.compileFilters(workerData.root, workerData.filters);
import { createHash } from 'node:crypto';
import NodeID3 from 'node-id3';
import ratingTags from './rating-tags.cjs';
import tagFrames from './tag-frames.cjs';
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
const old = new Map(
  workerData.previous.map((t) => [t.path, t.excluded ? { ...t, excluded: false } : t]),
);
let scanned = 0,
  warnings = 0;
// Directories are walked first (in the same order as before), then files are read by
// a small pool. Results are stored by position, so the track order is unchanged.
// A directory or stat error still fails the whole scan.
const concurrency = 4;
async function collect(folder, output = []) {
  // A directory error fails the scan: never commit an incomplete replacement.
  const entries = workerData.files
    ? workerData.files.map((name) => ({ name, isDirectory: () => false, isFile: () => true }))
    : await readdir(folder, { withFileTypes: true });
  for (const entry of entries) {
    const filename = workerData.files ? entry.name : path.join(folder, entry.name);
    if (excluded(filename, entry.isDirectory())) continue;
    if (entry.isDirectory()) await collect(filename, output);
    else if (entry.isFile() && extensions.has(path.extname(filename).toLowerCase()))
      output.push(filename);
  }
  return output;
}
async function readTrack(filename) {
  const info = await stat(filename);
  const previous = old.get(filename);
  if (
    previous?.mtime === info.mtimeMs &&
    previous?.size === info.size &&
    'tagRating' in previous &&
    Array.isArray(previous.missingTags) &&
    typeof previous.trackRaw === 'string' &&
    typeof previous.discRaw === 'string' &&
    typeof previous.comment === 'string' &&
    typeof previous.bitrate === 'number'
  )
    return { ...previous, missing: false };
  const id = previous?.id || hash(workerData.libraryId + '\0' + filename);
  let common = {},
    format = {},
    cover = false,
    tagRating = null,
    trackRaw = '',
    discRaw = '',
    comment = '';
  try {
    ({ common, format } = await parseFile(filename, { duration: true }));
    if (previous && format.hasAudio === false) throw Error('The changed audio file is incomplete.');
    trackRaw = common.track?.no
      ? `${common.track.no}${common.track.of ? '/' + common.track.of : ''}`
      : '';
    discRaw = common.disk?.no
      ? `${common.disk.no}${common.disk.of ? '/' + common.disk.of : ''}`
      : '';
    const firstComment = common.comment?.[0];
    comment = typeof firstComment === 'string' ? firstComment : firstComment?.text || '';
    if (path.extname(filename).toLowerCase() === '.mp3') {
      const bytes = await readFile(filename);
      tagRating = ratingTags.readRating(bytes);
      const tags = NodeID3.read(bytes);
      trackRaw = String(tags.trackNumber || trackRaw);
      discRaw = String(tags.partOfSet || discRaw);
      // Only the plain comment counts; iTunes' described COMM frames are not notes.
      comment = tagFrames.comment(bytes);
    }
    const picture = common.picture?.[0];
    if (picture && ['image/jpeg', 'image/png', 'image/webp'].includes(picture.format)) {
      await writeFile(path.join(workerData.covers, id), picture.data);
      cover = true;
    }
  } catch {
    warnings++;
    if (previous) return { ...previous, missing: false };
  }
  return {
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
    // Average bitrate in kbps (0 when the format does not report one).
    bitrate: Math.round((format.bitrate || 0) / 1000),
    comment: String(comment).trim(),
    codec: path.extname(filename).slice(1).toUpperCase(),
    addedAt: previous ? (previous.addedAt ?? null) : Date.now(),
    modifiedAt: info.mtimeMs,
    missingTags: ['title', 'artist', 'albumArtist', 'album', 'year', 'genre'].filter((key) => {
      const value = common[key === 'albumArtist' ? 'albumartist' : key];
      return !value || (Array.isArray(value) && !value.length);
    }),
    mtime: info.mtimeMs,
    size: info.size,
    cover,
    tagRating,
  };
}
async function walk(root) {
  const files = await collect(root),
    output = new Array(files.length);
  let next = 0,
    failed = null;
  const worker = async () => {
    while (next < files.length && !failed) {
      const index = next++;
      try {
        output[index] = await readTrack(files[index]);
      } catch (error) {
        failed ??= error;
        return;
      }
      if (++scanned % 25 === 0) parentPort.postMessage({ progress: scanned });
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, files.length) }, worker));
  if (failed) throw failed;
  return output;
}
try {
  await mkdir(workerData.covers, { recursive: true });
  const tracks = await walk(workerData.root);
  parentPort.postMessage({ tracks, warnings });
} catch (error) {
  parentPort.postMessage({ error: error.message });
}
