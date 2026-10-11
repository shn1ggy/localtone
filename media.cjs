const { stat } = require('node:fs/promises');
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
async function serveAudio(file, request) {
  const { size } = await stat(file);
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
  return new Response(Readable.toWeb(createReadStream(file, range || {})), {
    status: range ? 206 : 200,
    headers,
  });
}
module.exports = { parseRange, serveAudio };
