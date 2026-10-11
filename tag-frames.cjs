// Preserve every untouched frame verbatim, including frames unknown to node-id3.
const crypto = require('node:crypto');
const NodeID3 = require('node-id3');
const standard = {
  title: ['TIT2'],
  artist: ['TPE1'],
  albumArtist: ['TPE2'],
  album: ['TALB'],
  year: ['TYER', 'TDRC'],
  genre: ['TCON'],
  track: ['TRCK'],
  disc: ['TPOS'],
};
const hash = (b) => crypto.createHash('sha256').update(b).digest('hex');
function syncRead(b, o) {
  if ([...b.subarray(o, o + 4)].some((v) => v > 127)) throw new Error('Invalid ID3 size.');
  return b[o] * 2097152 + b[o + 1] * 16384 + b[o + 2] * 128 + b[o + 3];
}
function syncWrite(n) {
  return Buffer.from([(n >>> 21) & 127, (n >>> 14) & 127, (n >>> 7) & 127, n & 127]);
}
function parse(buffer) {
  let version = 3,
    end = 0,
    frames = [];
  if (buffer.toString('ascii', 0, 3) === 'ID3') {
    version = buffer[3];
    if (![3, 4].includes(version) || buffer[5] !== 0)
      throw new Error(
        'This ID3 version or header flags cannot be edited safely. Convert the tags to plain ID3v2.3 or v2.4 first.',
      );
    end = 10 + syncRead(buffer, 6);
    if (end > buffer.length) throw new Error('Incomplete ID3 tag.');
    let at = 10;
    while (at < end) {
      if (buffer[at] === 0) {
        if (buffer.subarray(at, end).some((v) => v !== 0)) throw new Error('Invalid ID3 padding.');
        break;
      }
      if (at + 10 > end) throw new Error('Incomplete ID3 frame.');
      const id = buffer.toString('ascii', at, at + 4),
        size = version === 4 ? syncRead(buffer, at + 4) : buffer.readUInt32BE(at + 4);
      if (!/^[A-Z0-9]{4}$/.test(id) || at + 10 + size > end) throw new Error('Invalid ID3 frame.');
      const raw = buffer.subarray(at, at + 10 + size);
      frames.push({ id, raw, key: hash(raw) });
      at += 10 + size;
    }
  }
  return { version, frames, audio: buffer.subarray(end) };
}
function encode(version, frames, audio = Buffer.alloc(0)) {
  const body = Buffer.concat(frames.map((f) => f.raw));
  return Buffer.concat([
    Buffer.from([73, 68, 51, version, 0, 0]),
    syncWrite(body.length),
    body,
    audio,
  ]);
}
function summary(frame, version) {
  const names = {
    APIC: 'Artwork',
    POPM: 'Rating / play count',
    COMM: 'Comment',
    USLT: 'Lyrics',
    PRIV: 'Private data',
    TXXX: 'Custom text',
    WXXX: 'Custom URL',
  };
  let value = '';
  try {
    const raw = NodeID3.read(encode(version, [frame])).raw || {};
    const clean = (v) =>
      Buffer.isBuffer(v)
        ? `Binary (${v.length} bytes)`
        : Array.isArray(v)
          ? v.map(clean).join('; ')
          : v && typeof v === 'object'
            ? Object.entries(v)
                .filter(([k]) => !['imageBuffer'].includes(k))
                .map(([k, x]) => `${k}: ${clean(x)}`)
                .join(' · ')
            : String(v ?? '');
    value = clean(raw[frame.id]);
  } catch {}
  return {
    key: frame.key,
    id: frame.id,
    label: names[frame.id] || frame.id,
    value: value || `Binary / unrecognized data (${frame.raw.length - 10} bytes)`,
  };
}
function tails(buffer) {
  let end = buffer.length,
    items = [];
  if (end >= 128 && buffer.toString('ascii', end - 128, end - 125) === 'TAG') {
    const raw = buffer.subarray(end - 128);
    items.unshift({
      id: 'ID3v1',
      raw,
      key: hash(raw),
      label: 'Legacy ID3v1 block',
      value: 'Legacy title, artist, album, year, comment and genre',
    });
    end -= 128;
  }
  if (end >= 32 && buffer.toString('ascii', end - 32, end - 24) === 'APETAGEX') {
    const size = buffer.readUInt32LE(end - 20);
    if (size < 32 || size > end) throw new Error('Invalid APE tag size.');
    let start = end - size;
    if (start >= 32 && buffer.toString('ascii', start - 32, start - 24) === 'APETAGEX') start -= 32;
    const raw = buffer.subarray(start, end);
    items.unshift({
      id: 'APEv2',
      raw,
      key: hash(raw),
      label: 'APE metadata block',
      value: `Additional APE metadata (${raw.length} bytes). Remove the entire block.`,
    });
    end = start;
  }
  return { body: buffer.subarray(0, end), items };
}
function extras(buffer) {
  const p = parse(buffer);
  return [
    ...p.frames
      .filter((f) => !Object.values(standard).flat().includes(f.id))
      .map((f) => summary(f, p.version)),
    ...tails(buffer).items.map(({ raw, ...item }) => item),
  ];
}
function update(buffer, patch, remove = []) {
  const tail = tails(buffer),
    p = parse(tail.body),
    removed = new Set(remove),
    replaced = new Set(Object.keys(patch).flatMap((k) => standard[k] || []));
  const extraKeys = new Set(
    [...p.frames.filter((f) => !Object.values(standard).flat().includes(f.id)), ...tail.items].map(
      (f) => f.key,
    ),
  );
  for (const key of removed)
    if (!extraKeys.has(key))
      throw new Error('The selected extra tag is no longer present. Reopen the editor.');
  const kept = p.frames.filter((f) => !replaced.has(f.id) && !removed.has(f.key));
  const aliases = {
    title: 'title',
    artist: 'artist',
    albumArtist: 'performerInfo',
    album: 'album',
    year: 'year',
    genre: 'genre',
    track: 'trackNumber',
    disc: 'partOfSet',
  };
  const tags = Object.fromEntries(
    Object.entries(patch)
      .filter(([, v]) => v !== '')
      .map(([k, v]) => [aliases[k], v]),
  );
  const created = parse(NodeID3.create(tags)).frames.map((f) => {
    const raw = Buffer.from(f.raw);
    if (p.version === 4) {
      syncWrite(raw.length - 10).copy(raw, 4);
      if (f.id === 'TYER') raw.write('TDRC', 0);
    }
    return { ...f, raw };
  });
  return Buffer.concat([
    encode(p.version, [...kept, ...created], p.audio),
    ...tail.items
      .filter((f) => !removed.has(f.key) && !(f.id === 'ID3v1' && Object.keys(patch).length))
      .map((f) => f.raw),
  ]);
}
module.exports = { parse, encode, extras, update, tails };
