const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const NodeID3 = require('node-id3');
const frames = require('./tag-frames.cjs');
const fields = {
  title: 'title',
  artist: 'artist',
  albumArtist: 'performerInfo',
  album: 'album',
  year: 'year',
  genre: 'genre',
  track: 'trackNumber',
  disc: 'partOfSet',
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
  };
  return {
    extras: frames.extras(buffer),
    token: digest(buffer),
    values: Object.fromEntries(
      Object.entries(fields).map(([key, alias]) => [
        key,
        String(tags[alias] || fallback[key] || ''),
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
    Object.keys(patch).some((k) => !Object.hasOwn(fields, k))
  )
    throw new Error('Invalid tag changes.');
  if (!Array.isArray(remove) || remove.some((k) => typeof k !== 'string'))
    throw new Error('Invalid tag removals.');
  const checked = validate({
    ...Object.fromEntries(Object.keys(fields).map((k) => [k, ''])),
    ...patch,
  });
  patch = Object.fromEntries(Object.keys(patch).map((k) => [k, checked[fields[k]]]));
  // Legacy ID3v1 is removed on a standard edit to prevent cleared fields reappearing.
  const base = original;
  const updated = frames.update(base, patch, remove);
  if (
    !frames
      .parse(frames.tails(original).body)
      .audio.equals(frames.parse(frames.tails(updated).body).audio)
  )
    throw new Error('Tag verification failed: audio data would change.');
  const readback = NodeID3.read(updated);
  for (const [key, value] of Object.entries(patch))
    if (String(readback[fields[key]] || (key === 'year' ? readback.raw?.TDRC : '') || '') !== value)
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
    if (digest(await fs.readFile(file)) !== token)
      throw new Error('This file changed while saving. File left untouched.');
    await fs.rename(temporary, file);
    replaced = true;
    await onSaved();
    return { backup };
  } catch (error) {
    if (replaced) {
      // Roll back only our own write, never a later edit by another program.
      if (digest(await fs.readFile(file)) === digest(updated)) {
        await fs.writeFile(temporary, original, { mode: info.mode });
        await fs.rename(temporary, file);
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
