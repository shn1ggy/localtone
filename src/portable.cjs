const fs = require('node:fs'),
  path = require('node:path');
const locations = new WeakMap(),
  files = [
    'collection.json',
    'collection-state.json',
    'playback-history.json',
    'playback-session.json',
    'browsing-session.json',
    'lastfm.enc',
    'tag-backups',
    'settings-backups',
    'covers',
    'waveforms',
  ];
function portableRoot({ packaged, platform, exe, source, env = {} }) {
  const paths = platform === 'win32' ? path.win32 : path.posix;
  if (!packaged) return source;
  if (platform === 'linux' && env.APPIMAGE) return paths.dirname(env.APPIMAGE);
  if (platform === 'win32' && env.PORTABLE_EXECUTABLE_DIR) return env.PORTABLE_EXECUTABLE_DIR;
  if (platform === 'darwin') {
    let folder = paths.dirname(exe);
    while (folder !== paths.dirname(folder)) {
      if (folder.endsWith('.app')) return paths.dirname(folder);
      folder = paths.dirname(folder);
    }
  }
  return paths.dirname(exe);
}
function writable(data) {
  fs.mkdirSync(data, { recursive: true });
  const probe = path.join(data, '.write-test-' + process.pid);
  fs.writeFileSync(probe, '');
  fs.unlinkSync(probe);
  return data;
}
function copySettings(source, target) {
  for (const name of files) {
    const from = path.join(source, name);
    if (fs.existsSync(from)) fs.cpSync(from, path.join(target, name), { recursive: true });
  }
}
function preparePortable(root) {
  const data = path.join(root, 'Localtone-data');
  if (!fs.existsSync(data)) {
    const stage = fs.mkdtempSync(path.join(root, '.localtone-data-'));
    try {
      fs.renameSync(stage, data);
    } catch (error) {
      fs.rmSync(stage, { recursive: true, force: true });
      throw error;
    }
  }
  return writable(data);
}
function readMode(root) {
  const file = path.join(root, 'Localtone-data', 'storage-mode.json');
  if (!fs.existsSync(file)) return { active: true };
  const mode = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (
    typeof mode.active !== 'boolean' ||
    (mode.next !== undefined && typeof mode.next !== 'boolean')
  )
    throw new Error('Invalid storage mode.');
  return mode;
}
function writeMode(root, mode) {
  const file = path.join(root, 'Localtone-data', 'storage-mode.json');
  fs.writeFileSync(file + '.tmp', JSON.stringify(mode));
  fs.renameSync(file + '.tmp', file);
}
function migrateSettings(source, target) {
  if (!fs.existsSync(source) || !fs.statSync(source).isDirectory())
    throw new Error('The current settings folder is unavailable.');
  const parent = path.dirname(target);
  fs.mkdirSync(parent, { recursive: true });
  const stage = fs.mkdtempSync(path.join(parent, '.localtone-migrate-')),
    backup = target + '.previous-' + path.basename(stage).slice('.localtone-migrate-'.length);
  let moved = false;
  try {
    copySettings(source, stage);
    writable(stage);
    if (fs.existsSync(target)) {
      fs.renameSync(target, backup);
      moved = true;
    }
    try {
      fs.renameSync(stage, target);
    } catch (error) {
      if (moved) fs.renameSync(backup, target);
      throw error;
    }
  } catch (error) {
    fs.rmSync(stage, { recursive: true, force: true });
    throw error;
  }
  return target;
}
function configurePortable(app, source) {
  const root = portableRoot({
      packaged: app.isPackaged,
      platform: process.platform,
      exe: app.getPath('exe'),
      source,
      env: process.env,
    }),
    legacy = app.getPath('userData'),
    local = path.join(root, 'Localtone-data');
  let mode = readMode(root);
  const cleanupRequested = mode.cleanup === true;
  if (mode.next !== undefined && mode.next !== mode.active) {
    migrateSettings(mode.active ? local : legacy, mode.next ? local : legacy);
    mode = { active: mode.next };
    writeMode(root, mode);
  }
  const data = mode.active ? preparePortable(root) : writable(legacy);
  locations.set(app, { root, legacy, active: mode.active });
  app.setPath('userData', data);
  const session = path.join(data, 'session');
  fs.mkdirSync(session, { recursive: true });
  app.setPath('sessionData', session);
  const logs = path.join(data, 'logs'),
    dumps = path.join(data, 'crash-dumps');
  fs.mkdirSync(logs, { recursive: true });
  fs.mkdirSync(dumps, { recursive: true });
  app.setAppLogsPath?.(logs);
  app.setPath('crashDumps', dumps);
  if (cleanupRequested && mode.active) {
    try {
      cleanupExternal(app);
    } catch (error) {
      locations.get(app).cleanupError = error.message;
    }
  }
  return data;
}
function requestMode(app, next, cleanup = false) {
  const info = locations.get(app);
  if (!info) throw new Error('Storage configuration is unavailable.');
  if (typeof next !== 'boolean') throw new Error('Invalid storage mode.');
  writable(next ? path.join(info.root, 'Localtone-data') : info.legacy);
  writeMode(
    info.root,
    next === info.active
      ? { active: info.active }
      : { active: info.active, next, ...(cleanup && next ? { cleanup: true } : {}) },
  );
}
function storageStatus(app) {
  const info = locations.get(app);
  return { portable: info?.active ?? true, cleanupError: info?.cleanupError || null };
}
function assertUpdateReady(app) {
  const info = locations.get(app);
  if (!info) return;
  const mode = readMode(info.root);
  if (mode.next !== undefined && mode.next !== mode.active)
    throw new Error(
      'Restart Localtone to finish changing storage mode before preparing an update.',
    );
}
function externalLocation(app) {
  const info = locations.get(app);
  if (!info) throw new Error('Storage configuration is unavailable.');
  return info.legacy;
}
function cleanupExternal(app) {
  const info = locations.get(app);
  if (!info?.active) throw new Error('Enable Portable and restart before cleaning up.');
  const source = path.resolve(info.legacy),
    local = path.resolve(info.root, 'Localtone-data');
  const contains = (a, b) => a === b || b.startsWith(a + path.sep);
  if (contains(source, local) || contains(local, source) || source === path.parse(source).root)
    throw new Error('The old and current data folders overlap. Nothing was deleted.');
  if (!fs.existsSync(source)) return { removed: false };
  const hash = (file) =>
    require('node:crypto').createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  const inspect = (dir, base = dir) => {
    const items = [];
    for (const name of fs.readdirSync(dir).sort()) {
      const file = path.join(dir, name),
        stat = fs.lstatSync(file),
        relative = path.relative(base, file);
      if (stat.isSymbolicLink())
        items.push({ path: relative, type: 'link', target: fs.readlinkSync(file) });
      else if (stat.isDirectory()) {
        items.push({ path: relative, type: 'directory' });
        for (const item of inspect(file, base)) items.push(item); // covers/ can exceed spread limits
      } else if (stat.isFile()) items.push({ path: relative, type: 'file', hash: hash(file) });
      else
        throw new Error(
          'Close other Localtone instances and try again. The old folder contains a special file: ' +
            file +
            '. Nothing was deleted.',
        );
    }
    return items;
  };
  if (fs.lstatSync(source).isSymbolicLink())
    throw new Error('The old data folder itself is a link: ' + source + '. Nothing was deleted.');
  const actualSource = fs.realpathSync(source),
    actualLocal = fs.realpathSync(local);
  if (contains(actualSource, actualLocal) || contains(actualLocal, actualSource))
    throw new Error('The old and current data folders overlap. Nothing was deleted.');
  const original = inspect(source),
    backup = fs.mkdtempSync(path.join(local, 'external-data-backup-'));
  // Copy link objects verbatim. Never traverse their targets, including broken links.
  fs.cpSync(source, backup, { recursive: true, dereference: false, verbatimSymlinks: true });
  if (JSON.stringify(inspect(backup)) !== JSON.stringify(original))
    throw new Error('Backup verification failed. Nothing was deleted.');
  if (JSON.stringify(inspect(source)) !== JSON.stringify(original))
    throw new Error('The old data folder changed. Nothing was deleted.');
  fs.rmSync(source, { recursive: true });
  info.cleanupError = null;
  return { removed: true, backup };
}
module.exports = {
  portableRoot,
  preparePortable,
  configurePortable,
  requestMode,
  storageStatus,
  migrateSettings,
  externalLocation,
  assertUpdateReady,
  cleanupExternal,
};
