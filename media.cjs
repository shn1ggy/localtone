const { stat, open } = require('node:fs/promises');
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
// Keep each native playback session on the same inode across atomic tag writes.
// libuv opens with FILE_SHARE_DELETE on Windows, so saving tags need not stop playback.
function createAudioSources(limit = 2) {
  const sources = new Map();
  async function retire(pending) {
    const source = await pending;
    source.retired = true;
    if (!source.readers) await source.handle.close();
  }
  return {
    async serve(file, request) {
      const key = request.url;
      if (!sources.has(key)) {
        const pending = open(file, 'r').then(async (handle) => {
          let info;
          try {
            info = await handle.stat();
          } catch (error) {
            await handle.close();
            throw error;
          }
          const source = {
            handle,
            info,
            readers: 0,
            retired: false,
            stream(range) {
              source.readers++;
              const stream = createReadStream(file, { ...range, fd: handle.fd, autoClose: false });
              let finished = false;
              const release = () => {
                if (finished) return;
                finished = true;
                source.readers--;
                if (source.retired && !source.readers) handle.close().catch(() => {});
              };
              stream.once('end', release);
              stream.once('error', release);
              stream.once('close', release);
              return stream;
            },
          };
          return source;
        });
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
    async dispose() {
      const pending = [...sources.values()];
      sources.clear();
      await Promise.allSettled(pending.map(retire));
    },
  };
}
module.exports = { parseRange, serveAudio, createAudioSources };
