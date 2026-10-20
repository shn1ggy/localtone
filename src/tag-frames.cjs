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
  comment: ['COMM'],
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
// The editable comment is the plain COMM frame (no description). Described COMM
// frames such as iTunNORM or iTunSMPB stay "other tags".
function plainComment(frame) {
  if (frame.id !== 'COMM' || frame.raw[8] !== 0 || frame.raw[9] !== 0) return false;
  const body = frame.raw.subarray(10);
  if (body.length < 5) return body.length === 4;
  const encoding = body[0],
    rest = body.subarray(4);
  if (encoding === 1 || encoding === 2) {
    if (rest[0] === 0 && rest[1] === 0) return true;
    // UTF-16 with a byte-order mark and an empty description.
    return (
      ((rest[0] === 0xff && rest[1] === 0xfe) || (rest[0] === 0xfe && rest[1] === 0xff)) &&
      rest[2] === 0 &&
      rest[3] === 0
    );
  }
  return rest[0] === 0;
}
function standardFrame(frame) {
  if (frame.id === 'COMM') return plainComment(frame);
  return Object.values(standard).flat().includes(frame.id);
}
// Frames that describe the file for Localtone itself are never offered for clean-up.
const keptFrames = (frame, raw) =>
  frame.id === 'APIC' ||
  frame.id === 'POPM' ||
  (frame.id === 'TXXX' &&
    [raw?.TXXX].flat().some((item) => String(item?.description || '').toUpperCase() === 'RATING'));
// Text frames outside the standard fields can be shown as extra editor fields.
// Keys: a frame ID such as TCOM, or TXXX:<description> for custom text tags.
// TXXX descriptions match case-insensitively; an existing description keeps its case.
const standardIds = new Set(Object.values(standard).flat());
const fold = (key) => (key.startsWith('TXXX:') ? 'TXXX:' + key.slice(5).toUpperCase() : key);
function validCustomKey(key) {
  if (typeof key !== 'string') return false;
  if (key.startsWith('TXXX:')) {
    const description = key.slice(5);
    return (
      description.trim() === description &&
      description.length > 0 &&
      description.length <= 64 &&
      !/[\0-\x1f]/.test(description) &&
      description.toUpperCase() !== 'RATING'
    );
  }
  return /^T[A-Z0-9]{3}$/.test(key) && key !== 'TXXX' && !standardIds.has(key);
}
function decodeText(bytes, encoding) {
  let text;
  if (encoding === 0) text = bytes.toString('latin1');
  else if (encoding === 3) text = bytes.toString('utf8');
  else if (encoding === 2) text = Buffer.from(bytes).swap16().toString('utf16le');
  else {
    const big = bytes[0] === 0xfe && bytes[1] === 0xff,
      body = bytes[0] === 0xff || bytes[0] === 0xfe ? bytes.subarray(2) : bytes;
    text = (big ? Buffer.from(body.subarray(0, body.length & ~1)).swap16() : body).toString(
      'utf16le',
    );
  }
  // ID3v2.4 separates multiple values with NUL; show them as one line.
  return text
    .split('\0')
    .filter((part, index, parts) => part || index < parts.length - 1)
    .join('; ')
    .replace(/(; )+$/, '');
}
// Position just past the first NUL terminator for the given text encoding.
function afterTerminator(bytes, encoding) {
  if (encoding === 1 || encoding === 2) {
    for (let i = 0; i + 1 < bytes.length; i += 2) if (!bytes[i] && !bytes[i + 1]) return i;
    return -1;
  }
  return bytes.indexOf(0);
}
// The editable field (key, description, value) of a text frame, or null.
function textField(frame) {
  if (!/^T[A-Z0-9]{3}$/.test(frame.id) || standardIds.has(frame.id)) return null;
  if (frame.raw[8] || frame.raw[9] || frame.raw.length < 11) return null;
  const encoding = frame.raw[10],
    body = frame.raw.subarray(11);
  if (encoding > 3) return null;
  if (frame.id !== 'TXXX') return { key: frame.id, value: decodeText(body, encoding) };
  const end = afterTerminator(body, encoding);
  if (end < 0) return null;
  const description = decodeText(body.subarray(0, end), encoding),
    value = decodeText(body.subarray(end + (encoding === 1 || encoding === 2 ? 2 : 1)), encoding);
  const key = 'TXXX:' + description;
  return validCustomKey(key) ? { key, description, value } : null;
}
function customValues(buffer) {
  const values = {};
  for (const frame of parse(tails(buffer).body).frames) {
    const field = textField(frame);
    if (field && !Object.hasOwn(values, field.key)) values[field.key] = field.value;
  }
  return values;
}
function textFrame(version, id, value, description = null) {
  const utf16 = (text) => Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(text, 'utf16le')]);
  const body = Buffer.concat([
    Buffer.from([1]),
    ...(description === null ? [] : [utf16(description), Buffer.from([0, 0])]),
    utf16(value),
  ]);
  const size = version === 4 ? syncWrite(body.length) : Buffer.alloc(4);
  if (version !== 4) size.writeUInt32BE(body.length);
  const raw = Buffer.concat([Buffer.from(id, 'ascii'), size, Buffer.from([0, 0]), body]);
  return { id, raw, key: hash(raw) };
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
    PCNT: 'Play count',
    COMM: 'Comment',
    USLT: 'Lyrics',
    SYLT: 'Synced lyrics',
    PRIV: 'Private data',
    TXXX: 'Custom text',
    WXXX: 'Custom URL',
    TPUB: 'Publisher',
    TCOP: 'Copyright',
    TENC: 'Encoded by',
    TSSE: 'Encoder settings',
    TCOM: 'Composer',
    TEXT: 'Lyricist',
    TPE3: 'Conductor',
    TPE4: 'Remixed by',
    TIT1: 'Grouping',
    TIT3: 'Subtitle',
    TOPE: 'Original artist',
    TOAL: 'Original album',
    TORY: 'Original year',
    TDOR: 'Original release date',
    TDRL: 'Release date',
    TDEN: 'Encoding date',
    TDTG: 'Tagging date',
    TBPM: 'BPM',
    TKEY: 'Initial key',
    TLEN: 'Length',
    TMED: 'Media type',
    TSRC: 'ISRC',
    TLAN: 'Language',
    TCMP: 'Compilation',
    TSOA: 'Album sort order',
    TSOP: 'Artist sort order',
    TSO2: 'Album artist sort order',
    TSOT: 'Title sort order',
    TOWN: 'File owner',
    TRSN: 'Internet radio station',
    UFID: 'Unique file ID',
    GEOB: 'Embedded object',
    MCDI: 'CD identifier',
    WCOM: 'Purchase URL',
    WCOP: 'Copyright URL',
    WOAF: 'File URL',
    WOAR: 'Artist URL',
    WOAS: 'Source URL',
    WORS: 'Radio station URL',
    WPAY: 'Payment URL',
    WPUB: 'Publisher URL',
  };
  let value = '',
    label = names[frame.id] || frame.id,
    keep = frame.id === 'APIC' || frame.id === 'POPM';
  try {
    const raw = NodeID3.read(encode(version, [frame])).raw || {};
    keep = keptFrames(frame, raw);
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
    // Custom and described frames read better as "Name: value".
    const item = [raw[frame.id]].flat()[0];
    if (frame.id === 'TXXX' && item?.description) {
      label = `Custom: ${item.description}`;
      value = String(item.value ?? '');
    } else if (frame.id === 'COMM' && item) {
      label = item.shortText ? `Comment: ${item.shortText}` : 'Comment';
      value = String(item.text ?? '');
    } else if (frame.id === 'WXXX' && item?.description) {
      label = `URL: ${item.description}`;
      value = String(item.url ?? '');
    }
  } catch {}
  const field = textField(frame);
  return {
    key: frame.key,
    id: frame.id,
    ...(field ? { field: field.key } : {}),
    label,
    value: value || `Binary / unrecognized data (${frame.raw.length - 10} bytes)`,
    keep,
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
    ...p.frames.filter((f) => !standardFrame(f)).map((f) => summary(f, p.version)),
    ...tails(buffer).items.map(({ raw, ...item }) => item),
  ];
}
function update(buffer, patch, remove = [], artwork = []) {
  const tail = tails(buffer),
    p = parse(tail.body),
    removed = new Set(remove),
    // Extra fields arrive as "x:<key>"; the rest are standard fields.
    custom = Object.entries(patch)
      .filter(([k]) => k.startsWith('x:'))
      .map(([k, v]) => [k.slice(2), v]),
    customKeys = new Set(custom.map(([k]) => fold(k))),
    replaced = new Set(Object.keys(patch).flatMap((k) => standard[k] || [])),
    replacedFrame = (f) => {
      if (customKeys.size) {
        const field = textField(f);
        if (field && customKeys.has(fold(field.key))) return true;
      }
      return replaced.has(f.id) && (f.id !== 'COMM' || plainComment(f));
    };
  patch = Object.fromEntries(Object.entries(patch).filter(([k]) => !k.startsWith('x:')));
  for (const [key] of custom)
    if (!validCustomKey(key)) throw new Error('Unsupported tag field: ' + key);
  const extraKeys = new Set(
    [...p.frames.filter((f) => !standardFrame(f)), ...tail.items].map((f) => f.key),
  );
  for (const key of removed)
    if (!extraKeys.has(key))
      throw new Error('The selected extra tag is no longer present. Reopen the editor.');
  const kept = p.frames.filter((f) => !replacedFrame(f) && !removed.has(f.key));
  const aliases = {
    title: 'title',
    artist: 'artist',
    albumArtist: 'performerInfo',
    album: 'album',
    year: 'year',
    genre: 'genre',
    track: 'trackNumber',
    disc: 'partOfSet',
    comment: 'comment',
  };
  const tags = Object.fromEntries(
    Object.entries(patch)
      .filter(([, v]) => v !== '')
      .map(([k, v]) => [aliases[k], k === 'comment' ? { language: 'eng', text: v } : v]),
  );
  // Existing TXXX descriptions keep their spelling; new ones are written as entered.
  const descriptions = new Map(
    p.frames
      .map(textField)
      .filter((field) => field?.description)
      .map((field) => [fold(field.key), field.description]),
  );
  const extra = custom
    .filter(([, value]) => value !== '')
    .map(([key, value]) =>
      key.startsWith('TXXX:')
        ? textFrame(p.version, 'TXXX', value, descriptions.get(fold(key)) ?? key.slice(5))
        : textFrame(p.version, key, value),
    );
  const created = [NodeID3.create(tags), ...artwork.map((image) => NodeID3.create({ image }))]
    .flatMap((bytes) => parse(bytes).frames)
    .map((f) => {
      const raw = Buffer.from(f.raw);
      if (p.version === 4) {
        syncWrite(raw.length - 10).copy(raw, 4);
        if (f.id === 'TYER') raw.write('TDRC', 0);
      }
      return { ...f, raw };
    });
  return Buffer.concat([
    encode(p.version, [...kept, ...created, ...extra], p.audio),
    ...tail.items
      .filter(
        (f) =>
          !removed.has(f.key) &&
          !(f.id === 'ID3v1' && (Object.keys(patch).length || custom.length)),
      )
      .map((f) => f.raw),
  ]);
}
// Text of the plain comment frame, or '' when there is none.
function comment(buffer) {
  const p = parse(tails(buffer).body),
    frame = p.frames.find(plainComment);
  if (!frame) return '';
  try {
    return String(NodeID3.read(encode(p.version, [frame])).comment?.text || '');
  } catch {
    return '';
  }
}
// Value of an extra field in a file (TXXX descriptions match case-insensitively).
function customValue(values, key) {
  if (Object.hasOwn(values, key)) return values[key];
  const folded = fold(key),
    match = Object.keys(values).find((k) => fold(k) === folded);
  return match ? values[match] : '';
}
module.exports = {
  parse,
  encode,
  extras,
  update,
  tails,
  comment,
  customValues,
  customValue,
  validCustomKey,
  standard,
  standardFrame,
};
