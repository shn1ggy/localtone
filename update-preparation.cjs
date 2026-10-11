const fs = require('node:fs/promises');
const path = require('node:path');
const { digest } = require('./release.cjs');

// Only persistent app data is transferred. Browser sessions, logs, temporary
// tag undo and native crash files belong to the old running instance.
const persistentNames = [
  'collection.json',
  'playback-history.json',
  'playback-session.json',
  'lastfm.enc',
  'settings-backups',
  'covers',
  'waveforms',
];
async function exists(file) {
  try {
    await fs.lstat(file);
    return true;
  } catch (e) {
    if (e.code === 'ENOENT') return false;
    throw e;
  }
}
async function copyTree(source, target, records, relative = '') {
  const stat = await fs.lstat(source);
  if (stat.isSymbolicLink() || (!stat.isDirectory() && !stat.isFile()))
    throw new Error('App data contains a link or special file. Nothing was replaced.');
  if (stat.isDirectory()) {
    await fs.mkdir(target);
    for (const name of (await fs.readdir(source)).sort()) {
      if (name.endsWith('.tmp') || name.startsWith('.')) continue;
      await copyTree(
        path.join(source, name),
        path.join(target, name),
        records,
        path.join(relative, name),
      );
    }
  } else {
    const before = await digest(source);
    await fs.copyFile(source, target, require('node:fs').constants.COPYFILE_EXCL);
    await fs.chmod(target, stat.mode & 0o777);
    if ((await digest(target)) !== before || (await digest(source)) !== before)
      throw new Error(
        'App data changed during preparation. Try again after playback or scanning finishes.',
      );
    records.push({ relative, hash: before });
  }
}
async function prepareUpdate({ source, targetRoot, portable, version }) {
  const realSource = await fs.realpath(source),
    realRoot = await fs.realpath(targetRoot);
  const target = path.join(realRoot, 'Localtone-data');
  const contains = (a, b) => a === b || b.startsWith(a + path.sep);
  if (contains(realSource, realRoot) || contains(realRoot, realSource))
    throw new Error('Choose a separate app folder outside the current data folder.');
  if (await exists(target))
    throw new Error(
      'The new app already has Localtone-data. Choose a fresh extracted release; nothing was replaced.',
    );
  const lockPath = target + '.update-lock';
  const lock = await fs.open(lockPath, 'wx');
  let stage;
  try {
    stage = await fs.mkdtemp(path.join(realRoot, '.localtone-update-'));
    const records = [];
    if (portable) {
      if (!(await exists(path.join(realSource, 'collection.json'))))
        throw new Error('The current collection is unavailable.');
      const names = [
        ...persistentNames,
        ...(await fs.readdir(realSource)).filter((n) => n.startsWith('external-data-backup-')),
      ];
      for (const name of names) {
        const file = path.join(realSource, name);
        if (await exists(file)) await copyTree(file, path.join(stage, name), records, name);
      }
      // Recheck persistent state after copying larger caches.
      for (const record of records)
        if ((await digest(path.join(realSource, record.relative))) !== record.hash)
          throw new Error('App data changed during preparation. Nothing was replaced.');
    }
    await fs.writeFile(path.join(stage, 'storage-mode.json'), JSON.stringify({ active: portable }));
    await fs.writeFile(
      path.join(stage, 'update-preparation.json'),
      JSON.stringify({
        version,
        preparedAt: new Date().toISOString(),
        portable,
        files: records.length,
      }),
    );
    if (await exists(target))
      throw new Error('The destination data folder changed. Nothing was replaced.');
    await fs.rename(stage, target);
    return { target, portable, files: records.length, version };
  } catch (error) {
    if (stage) await fs.rm(stage, { recursive: true, force: true });
    throw error;
  } finally {
    await lock.close();
    await fs.unlink(lockPath).catch(() => {});
  }
}
module.exports = { prepareUpdate, persistentNames };
