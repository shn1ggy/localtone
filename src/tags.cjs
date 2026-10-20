const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const NodeID3 = require('node-id3');
const frames = require('./tag-frames.cjs');
const { replaceFile } = require('./replace-file.cjs');
const fields = {
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
const digest = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');
function assertMp3(file, buffer) {
  if (path.extname(file).toLowerCase() !== '.mp3')
    throw new Error('Tag editing currently supports MP3 files only.');
  if (
    buffer.length < 4 ||
    !(buffer.toString('ascii', 0, 3) === 'ID3' || (buffer[0] === 255 && (buffer[1] & 224) === 224))
  )
    throw new Error('This file does not have a recognized MP3 header.');
}
async function readTags(file) {
  const buffer = await fs.readFile(file);
  assertMp3(file, buffer);
  return readBufferTags(buffer);
}
async function readBufferTags(buffer) {
  const tags = NodeID3.read(buffer);
  const { parseBuffer } = await import('music-metadata');
  const { common } = await parseBuffer(
    buffer,
    { mimeType: 'audio/mpeg' },
    { skipCovers: true, duration: false },
  );
  const number = (item) => (item?.no ? `${item.no}${item.of ? `/${item.of}` : ''}` : '');
  const fallback = {
    title: common.title,
    artist: common.artist,
    albumArtist: common.albumartist,
    album: common.album,
    year: common.year,
    genre: common.genre?.join(', '),
    track: number(common.track),
    disc: number(common.disk),
    comment: '',
  };
  const legacy = frames.tails(buffer).items.find((item) => item.id === 'ID3v1')?.raw;
  const legacyComment = legacy
    ? legacy
        .subarray(97, legacy[125] === 0 ? 125 : 127)
        .toString('latin1')
        .replace(/\0.*$/, '')
        .trim()
    : '';
  const plainComment = frames.comment(buffer) || legacyComment;
  return {
    extras: frames.extras(buffer),
    // Values of every extra text field in the file, for user-added editor fields.
    custom: frames.customValues(buffer),
    token: digest(buffer),
    values: Object.fromEntries(
      Object.entries(fields).map(([key, alias]) => [
        key,
        key === 'comment' ? plainComment : String(tags[alias] || fallback[key] || ''),
      ]),
    ),
  };
}
function validate(values) {
  if (!values || typeof values !== 'object' || Array.isArray(values))
    throw new Error('Invalid tags.');
  const tags = {};
  for (const [key, alias] of Object.entries(fields)) {
    if (typeof values[key] !== 'string' || values[key].length > 1000 || values[key].includes('\0'))
      throw new Error(`Invalid ${key}.`);
    const value = values[key].trim();
    if (key === 'year' && value && !/^\d{4}$/.test(value))
      throw new Error('Year must be four digits or empty.');
    if (['track', 'disc'].includes(key) && value && !/^\d+(\/\d+)?$/.test(value))
      throw new Error('Track and disc numbers must look like 3 or 3/12.');
    tags[alias] = value;
  }
  return tags;
}
async function prepareTags({ file, values, patch, remove = [], token }) {
  const original = await fs.readFile(file);
  assertMp3(file, original);
  if (typeof token !== 'string' || digest(original) !== token)
    throw new Error('This file changed since you opened the editor. Close it and open it again.');
  if (values) patch = values;
  if (
    !patch ||
    typeof patch !== 'object' ||
    Array.isArray(patch) ||
    Object.keys(patch).some(
      (k) =>
        !Object.hasOwn(fields, k) && !(k.startsWith('x:') && frames.validCustomKey(k.slice(2))),
    )
  )
    throw new Error('Invalid tag changes.');
  const custom = Object.entries(patch).filter(([k]) => k.startsWith('x:'));
  for (const [key, value] of custom)
    if (typeof value !== 'string' || value.length > 1000 || value.includes('\0'))
      throw new Error(`Invalid ${key.slice(2)}.`);
  if (!Array.isArray(remove) || remove.some((k) => typeof k !== 'string'))
    throw new Error('Invalid tag removals.');
  const standardPatch = Object.fromEntries(
      Object.entries(patch).filter(([k]) => !k.startsWith('x:')),
    ),
    checked = validate({
      ...Object.fromEntries(Object.keys(fields).map((k) => [k, ''])),
      ...standardPatch,
    });
  patch = {
    ...Object.fromEntries(Object.keys(standardPatch).map((k) => [k, checked[fields[k]]])),
    ...Object.fromEntries(custom.map(([k, v]) => [k, v.trim()])),
  };
  // Removing a legacy container must not erase the represented values it owns.
  // Migrate only missing ID3 fields, retaining all existing frames verbatim.
  let artwork = [];
  const tails = frames.tails(original).items;
  if (tails.some((item) => remove.includes(item.key))) {
    const existing = frames.parse(original).frames,
      saved = await readBufferTags(original);
    for (const [key, ids] of Object.entries(frames.standard))
      if (
        !Object.hasOwn(patch, key) &&
        saved.values[key] &&
        !existing.some((frame) => ids.includes(frame.id) && frames.standardFrame(frame))
      )
        patch[key] = saved.values[key];
    if (!existing.some((frame) => frame.id === 'APIC')) {
      const { parseBuffer } = await import('music-metadata');
      const { common } = await parseBuffer(
        original,
        { mimeType: 'audio/mpeg' },
        { duration: false },
      );
      artwork = (common.picture || []).map((picture) => ({
        mime: picture.format,
        type: { id: 3, name: 'front cover' },
        description: picture.description || '',
        imageBuffer: picture.data,
      }));
    }
  }
  const updated = frames.update(original, patch, remove, artwork);
  if (
    !frames
      .parse(frames.tails(original).body)
      .audio.equals(frames.parse(frames.tails(updated).body).audio)
  )
    throw new Error('Tag verification failed: audio data would change.');
  const readback = NodeID3.read(updated),
    written = custom.length ? frames.customValues(updated) : {};
  for (const [key, value] of Object.entries(patch))
    if (
      (key.startsWith('x:')
        ? frames.customValue(written, key.slice(2))
        : key === 'comment'
          ? frames.comment(updated)
          : String(readback[fields[key]] || (key === 'year' ? readback.raw?.TDRC : '') || '')) !==
      value
    )
      throw new Error(`Could not verify ${key}. File left untouched.`);
  return { file, original, updated, token };
}
async function writeTags(options) {
  const prepared = await prepareTags(options);
  return commitTags({ ...options, ...prepared });
}
async function commitTags({
  file,
  original,
  updated,
  token,
  backupDir,
  backupStore,
  onSaved = async () => {},
}) {
  const info = await fs.stat(file);
  if (!backupStore) await fs.mkdir(backupDir, { recursive: true });
  const stamp = `${Date.now()}-${crypto.randomUUID()}`;
  const backup = backupStore
    ? await backupStore.save(file, original, updated)
    : path.join(backupDir, `${path.basename(file)}.${stamp}.bak`);
  if (!backupStore) await fs.writeFile(backup, original, { flag: 'wx', mode: info.mode });
  const temporary = path.join(path.dirname(file), `.localtone-${stamp}.tmp`);
  let replaced = false;
  try {
    await fs.writeFile(temporary, updated, { flag: 'wx', mode: info.mode });
    // Check again just before replacement to avoid overwriting external edits.
    await replaceFile(temporary, file, {
      beforeRename: async () => {
        if (digest(await fs.readFile(file)) !== token)
          throw new Error('This file changed while saving. File left untouched.');
      },
    });
    replaced = true;
    await onSaved();
    return { backup };
  } catch (error) {
    if (replaced) {
      // Roll back only our own write, never a later edit by another program.
      if (digest(await fs.readFile(file)) === digest(updated)) {
        await fs.writeFile(temporary, original, { mode: info.mode });
        await replaceFile(temporary, file, {
          beforeRename: async () => {
            if (digest(await fs.readFile(file)) !== digest(updated))
              throw new Error(
                `Another program changed the file after this save. Original backup: ${backup}`,
              );
          },
        });
      } else
        throw new Error(
          `Another program changed the file after this save. Original backup: ${backup}`,
        );
    }
    throw error;
  } finally {
    await fs.rm(temporary, { force: true });
  }
}
// Bound MP3 buffers and simultaneous disk work; drain active tasks before rejecting.
async function mapTagFiles(items, work) {
  const results = new Array(items.length);
  let next = 0,
    failure;
  async function worker() {
    while (!failure && next < items.length) {
      const index = next++;
      try {
        results[index] = await work(items[index], index);
      } catch (error) {
        failure ||= error;
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(2, items.length) }, worker));
  if (failure) throw failure;
  return results;
}
module.exports = { readTags, writeTags, prepareTags, commitTags, mapTagFiles };
