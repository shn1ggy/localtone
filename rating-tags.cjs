const fs = require('node:fs/promises');
const crypto = require('node:crypto');
const NodeID3 = require('node-id3');
const { commitTags } = require('./tags.cjs');
const { validateRating } = require('./preferences.cjs');
const bytes = [0, 1, 64, 128, 196, 255];
function readRating(buffer) {
  const tags = NodeID3.read(buffer),
    pop = tags.popularimeter;
  if (pop?.email === 'Windows Media Player 9 Series')
    return pop.rating === 0
      ? 0
      : pop.rating >= 255
        ? 5
        : pop.rating >= 196
          ? 4
          : pop.rating >= 128
            ? 3
            : pop.rating >= 64
              ? 2
              : 1;
  const text = (tags.userDefinedText || []).find((t) => t.description?.toUpperCase() === 'RATING');
  if (text && /^[0-5]$/.test(String(text.value))) return Number(text.value);
  if (pop)
    return pop.rating === 0
      ? 0
      : pop.rating >= 255
        ? 5
        : pop.rating >= 196
          ? 4
          : pop.rating >= 128
            ? 3
            : pop.rating >= 64
              ? 2
              : 1;
  return null;
}
async function writeRating({ file, rating, backupDir, backupStore, onSaved }) {
  validateRating(rating);
  const original = await fs.readFile(file),
    existing = NodeID3.read(original);
  if (
    original.length < 4 ||
    !(
      original.toString('ascii', 0, 3) === 'ID3' ||
      (original[0] === 255 && (original[1] & 224) === 224)
    )
  )
    throw new Error('This file does not have a recognized MP3 header.');
  const token = crypto.createHash('sha256').update(original).digest('hex');
  // Update every existing spelling to avoid conflicting legacy RATING tags.
  const custom = (existing.userDefinedText || [])
    .filter((t) => t.description?.toUpperCase() === 'RATING')
    .map((t) => ({ ...t, value: String(rating) }));
  if (!custom.length) custom.push({ description: 'RATING', value: String(rating) });
  const updated = NodeID3.update(
    {
      userDefinedText: custom,
      popularimeter: {
        email: 'Windows Media Player 9 Series',
        rating: bytes[rating],
        counter: existing.popularimeter?.counter || 0,
      },
    },
    original,
  );
  if (
    !Buffer.isBuffer(updated) ||
    readRating(updated) !== rating ||
    !NodeID3.removeTagsFromBuffer(original).equals(NodeID3.removeTagsFromBuffer(updated))
  )
    throw new Error('Rating verification failed. File left untouched.');
  return commitTags({ file, original, updated, token, backupDir, backupStore, onSaved });
}
module.exports = { readRating, writeRating };
