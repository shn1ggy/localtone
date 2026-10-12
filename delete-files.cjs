const fs = require('node:fs/promises');
const path = require('node:path');

function inside(root, file) {
  const relative = path.relative(root, file);
  return (
    relative !== '' &&
    !path.isAbsolute(relative) &&
    relative !== '..' &&
    !relative.startsWith('..' + path.sep)
  );
}
function sameFile(a, b) {
  return a.size === b.size && a.mtimeMs === b.mtimeMs && a.dev === b.dev && a.ino === b.ino;
}
// Resolve only indexed IDs. Never accept renderer-provided paths or recursively delete folders.
async function deleteSelectedFiles(db, ids, confirm) {
  if (!Array.isArray(ids) || !ids.length || ids.some((id) => typeof id !== 'string'))
    throw Error('Select music files to delete.');
  const selected = [...new Set(ids)].map((id) => db.tracks.find((track) => track.id === id));
  if (selected.some((track) => !track)) throw Error('A selected track is no longer available.');
  const files = new Map();
  for (const track of selected) {
    const file = path.resolve(track.path),
      library = db.libraries.find((item) => item.id === track.libraryId);
    if (!library?.root || !inside(path.resolve(library.root), file))
      throw Error('A selected file is outside its music folder. Nothing was deleted.');
    if (files.has(file)) continue;
    const stat = await fs.lstat(file),
      root = await fs.realpath(library.root),
      real = await fs.realpath(file);
    if (!stat.isFile() || !inside(root, real))
      throw Error('A selected file cannot be safely deleted. Nothing was deleted.');
    files.set(file, { path: file, root: path.resolve(library.root), stat });
  }
  if (!(await confirm([...files.values()])))
    return { cancelled: true, removed: [], failures: [], folders: [] };
  // Validate the complete selection again after confirmation, before deleting anything.
  for (const file of files.values()) {
    const stat = await fs.lstat(file.path);
    if (
      !stat.isFile() ||
      !sameFile(stat, file.stat) ||
      !inside(await fs.realpath(file.root), await fs.realpath(file.path))
    )
      throw Error('A selected file changed while the dialog was open. Nothing was deleted.');
  }
  const deleted = new Set(),
    failures = [],
    folders = [];
  for (const file of files.values()) {
    try {
      await fs.unlink(file.path);
      deleted.add(file.path);
    } catch (error) {
      failures.push({ path: file.path, message: error.message });
    }
  }
  for (const file of files.values()) {
    if (!deleted.has(file.path)) continue;
    // At most the album and artist directories; the library root and nonempty folders stay intact.
    let folder = path.dirname(file.path);
    for (
      let level = 0;
      level < 2 && inside(file.root, folder);
      level++, folder = path.dirname(folder)
    ) {
      try {
        if (!(await fs.lstat(folder)).isDirectory()) break;
        await fs.rmdir(folder);
        folders.push(folder);
      } catch {
        break;
      }
    }
  }
  const removed = db.tracks
    .filter((track) => deleted.has(path.resolve(track.path)))
    .map((track) => track.id);
  return { cancelled: false, removed, failures, folders };
}
module.exports = { deleteSelectedFiles };
