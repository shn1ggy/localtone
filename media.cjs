const { stat, copyFile, mkdir, mkdtemp, rm } = require('node:fs/promises');
const { constants } = require('node:fs');
const { randomUUID } = require('node:crypto');
const { tmpdir } = require('node:os');
const { createReadStream } = require('node:fs');
const { Readable } = require('node:stream');
const path = require('node:path');
function parseRange(value, size) {
  if (!value) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(value);
  if (!match || (!match[1] && !match[2])) throw new Error('Invalid range');
  let start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
  let end = match[1] ? (match[2] ? Number(match[2]) : size - 1) : size - 1;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start >= size || start > end)
    throw new Error('Invalid range');
  return { start, end: Math.min(end, size - 1) };
}
async function serveAudio(file, request, source = null) {
  const { size } = source ? source.info : await stat(file);
  let range;
  try {
    range = parseRange(request.headers.get('range'), size);
  } catch {
    return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
  }
  const types = {
    '.mp3': 'audio/mpeg',
    '.flac': 'audio/flac',
    '.wav': 'audio/wav',
    '.ogg': 'audio/ogg',
    '.opus': 'audio/ogg',
    '.m4a': 'audio/mp4',
    '.aac': 'audio/aac',
    '.aiff': 'audio/aiff',
    '.aif': 'audio/aiff',
  };
  const headers = {
    'Accept-Ranges': 'bytes',
    'Content-Type': types[path.extname(file).toLowerCase()] || 'application/octet-stream',
    'Content-Length': String(range ? range.end - range.start + 1 : size),
    'Cache-Control': 'no-store',
  };
  if (range) headers['Content-Range'] = `bytes ${range.start}-${range.end}/${size}`;
  if (request.method === 'HEAD') return new Response(null, { status: range ? 206 : 200, headers });
  const stream = source
    ? source.stream(range || { start: 0, end: size - 1 })
    : createReadStream(file, range || {});
  return new Response(Readable.toWeb(stream), {
    status: range ? 206 : 200,
    headers,
  });
}
// Native playback reads an immutable copy, never the editable original. Windows
// cannot replace an open destination even when its reader allows shared deletion.
// Copies are bounded to two sessions and removed on retirement, quit and startup.
function createAudioSources({ limit = 2, directory } = {}) {
  const sources = new Map();
  let root,
    disposed = false;
  function sourceDirectory() {
    if (!root)
      root = (async () => {
        if (!directory) return mkdtemp(path.join(tmpdir(), 'localtone-playback-'));
        const target = directory();
        await rm(target, { recursive: true, force: true });
        await mkdir(target, { recursive: true });
        return target;
      })();
    return root;
  }
  async function retire(pending) {
    const source = await pending;
    source.retired = true;
    if (!source.readers) await source.close();
  }
  return {
    init: sourceDirectory,
    async serve(file, request) {
      if (disposed) throw new Error('Audio sources are closed.');
      const key = request.url;
      if (!sources.has(key)) {
        const pending = (async () => {
          const snapshot = path.join(await sourceDirectory(), randomUUID());
          let info;
          try {
            await copyFile(file, snapshot, constants.COPYFILE_FICLONE);
            info = await stat(snapshot);
          } catch (error) {
            await rm(snapshot, { force: true });
            throw error;
          }
          let closing;
          const source = {
            info,
            readers: 0,
            streams: new Set(),
            retired: false,
            close() {
              return (closing ||= (async () => {
                await rm(snapshot, { force: true });
              })());
            },
            stream(range) {
              source.readers++;
              // Chromium cancels range requests on seeks. Each response must own
              // its descriptor: destroying one must never close another's source.
              const stream = createReadStream(snapshot, range);
              source.streams.add(stream);
              let finished = false;
              const release = () => {
                if (finished) return;
                finished = true;
                source.readers--;
                source.streams.delete(stream);
                if (source.retired && !source.readers) source.close().catch(() => {});
              };
              stream.once('close', release);
              return stream;
            },
          };
          return source;
        })();
        pending.file = file;
        sources.set(key, pending);
        pending.catch(() => {
          if (sources.get(key) === pending) sources.delete(key);
        });
        while (sources.size > limit) {
          const [oldKey, old] = sources.entries().next().value;
          sources.delete(oldKey);
          retire(old).catch(() => {});
        }
      }
      return serveAudio(file, request, await sources.get(key));
    },
    async beforeWrite(file) {
      // Let an initial copy finish before attempting Windows replacement.
      await Promise.all([...sources.values()].filter((pending) => pending.file === file));
    },
    async dispose() {
      disposed = true;
      const pending = [...sources.values()];
      sources.clear();
      await Promise.allSettled(
        pending.map(async (pending) => {
          const source = await pending;
          source.retired = true;
          await Promise.all(
            [...source.streams].map(
              (stream) =>
                new Promise((resolve) => {
                  stream.once('close', resolve);
                  stream.destroy();
                }),
            ),
          );
          await source.close();
        }),
      );
      if (root) {
        const directory = await root;
        await rm(directory, { recursive: true, force: true, maxRetries: 3 });
      }
    },
  };
}
module.exports = { parseRange, serveAudio, createAudioSources };
