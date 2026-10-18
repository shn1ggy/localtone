const fs = require('node:fs/promises');
const { createReadStream } = require('node:fs');
const { createHash, randomUUID } = require('node:crypto');
const path = require('node:path');
async function fingerprint(file) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}
const same = (a, b) =>
  a.size === b.size && a.mtimeMs === b.mtimeMs && a.ino === b.ino && a.dev === b.dev;
function createDuplicates() {
  const reviews = new Map();
  async function review(tracks, libraries, mode = 'exact') {
    if (!['exact', 'metadata'].includes(mode)) throw Error('Choose a duplicate search method.');
    const candidates = [],
      skipped = [],
      paths = new Set();
    for (const track of tracks) {
      if (track.missing || paths.has(track.path)) continue;
      paths.add(track.path);
      const library = libraries.find((l) => l.id === track.libraryId);
      const relative = library && path.relative(library.root, track.path);
      if (
        !library ||
        relative === '..' ||
        relative.startsWith('..' + path.sep) ||
        path.isAbsolute(relative)
      )
        continue;
      try {
        const root = await fs.realpath(library.root),
          actual = await fs.realpath(track.path);
        const rel = path.relative(root, actual);
        if (rel === '..' || rel.startsWith('..' + path.sep) || path.isAbsolute(rel)) continue;
        const stat = await fs.lstat(track.path);
        if (!stat.isFile() || stat.isSymbolicLink()) continue;
        candidates.push({
          id: track.id,
          path: track.path,
          title: track.title,
          artist: track.artist,
          album: track.album,
          duration: track.duration,
          size: stat.size,
          stat,
          actual,
        });
      } catch {
        skipped.push(track.path);
      }
    }
    const buckets = new Map();
    const normalized = (text) =>
      String(text || '')
        .trim()
        .toLocaleLowerCase();
    for (const item of candidates) {
      if (
        mode === 'metadata' &&
        (!normalized(item.title) || !normalized(item.artist) || !(item.duration > 0))
      )
        continue;
      const key =
        mode === 'exact'
          ? item.size
          : JSON.stringify([
              normalized(item.artist),
              normalized(item.title),
              Math.round(item.duration),
            ]);
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(item);
    }
    const groups = [];
    for (const bucket of buckets.values()) {
      if (bucket.length < 2) continue;
      if (mode === 'metadata') {
        groups.push(bucket);
        continue;
      }
      const hashes = new Map();
      for (const item of bucket) {
        try {
          item.hash = await fingerprint(item.path);
          if (!same(item.stat, await fs.lstat(item.path))) throw Error('File changed.');
          if (!hashes.has(item.hash)) hashes.set(item.hash, []);
          hashes.get(item.hash).push(item);
        } catch {
          skipped.push(item.path);
        }
      }
      groups.push(...[...hashes.values()].filter((g) => g.length > 1));
    }
    const token = randomUUID();
    reviews.clear();
    reviews.set(token, { mode, groups });
    return {
      token,
      mode,
      skipped: skipped.length,
      groups: groups.map((items, index) => ({
        id: String(index),
        items: items.map(({ stat, hash, actual, ...item }) => item),
      })),
    };
  }
  async function remove(token, ids, { confirm, trash, onRemoved }) {
    const review = reviews.get(token);
    if (!review || !Array.isArray(ids) || !ids.length || new Set(ids).size !== ids.length)
      throw Error('Scan again and choose files to remove.');
    const lookup = new Map(review.groups.flat().map((item) => [item.id, item]));
    if (ids.some((id) => !lookup.has(id))) throw Error('Invalid duplicate selection.');
    const selected = new Set(ids),
      groups = review.groups.filter((g) => g.some((i) => selected.has(i.id)));
    for (const group of groups) {
      if (group.every((item) => selected.has(item.id)))
        throw Error('Keep at least one file in each group.');
      for (const item of group) {
        const stat = await fs.lstat(item.path);
        if (
          !stat.isFile() ||
          stat.isSymbolicLink() ||
          !same(item.stat, stat) ||
          (await fs.realpath(item.path)) !== item.actual
        )
          throw Error('A reviewed file changed. Scan again.');
        if (review.mode === 'exact' && (await fingerprint(item.path)) !== item.hash)
          throw Error('A reviewed file changed. Scan again.');
      }
    }
    const files = ids.map((id) => lookup.get(id));
    if (!(await confirm(files, review.mode))) return { removed: [], failures: [], cancelled: true };
    const removed = [],
      failures = [];
    for (const item of files) {
      try {
        const group = groups.find((g) => g.includes(item));
        let keeperAvailable = false;
        for (const keeper of group.filter((i) => !selected.has(i.id))) {
          try {
            const stat = await fs.lstat(keeper.path);
            if (
              stat.isFile() &&
              !stat.isSymbolicLink() &&
              same(keeper.stat, stat) &&
              (await fs.realpath(keeper.path)) === keeper.actual
            )
              keeperAvailable = true;
          } catch {
            /* Missing keepers cannot protect this group. */
          }
        }
        if (!keeperAvailable) throw Error('No unchanged copy remains in this group. Scan again.');
        const stat = await fs.lstat(item.path);
        if (
          !stat.isFile() ||
          stat.isSymbolicLink() ||
          !same(item.stat, stat) ||
          (await fs.realpath(item.path)) !== item.actual
        )
          throw Error('File changed since review.');
        if (review.mode === 'exact' && (await fingerprint(item.path)) !== item.hash)
          throw Error('File changed since review.');
        await trash(item.path);
        removed.push(item.id);
      } catch (error) {
        failures.push({ id: item.id, message: error.message });
      }
    }
    if (removed.length) await onRemoved(removed);
    reviews.delete(token);
    return { removed, failures, cancelled: false };
  }
  return { review, remove };
}
module.exports = { createDuplicates };
