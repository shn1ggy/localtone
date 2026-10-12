const {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  protocol,
  net,
  session,
  shell,
  safeStorage,
  globalShortcut,
  screen,
} = require('electron');
const { animateBounds } = require('./window-motion.cjs');
let motionJobs = Promise.resolve(),
  motionActive = false,
  normalVisualBounds = null,
  motionContentSize = null;
const gaplessDecoder = new (require('./gapless-decoder.cjs').GaplessDecoder)(
  require('ffmpeg-static'),
);
const duplicates = require('./duplicates.cjs').createDuplicates();
const numberActions = require('./app/rules/number-actions.js');
const libraryRepair = require('./library-repair.cjs');
const { deleteSelectedFiles } = require('./delete-files.cjs');
const fileNaming = require('./file-naming.cjs'),
  naming = fileNaming.createFileNaming();
const settingsTransfer = require('./settings-transfer.cjs');
const { changedTracks } = require('./startup-refresh.cjs');
const { cleanUnusedCache } = require('./cache-cleanup.cjs');
let startupRefresh = { changed: 0, unavailable: 0, warnings: [] };
const { validateSession } = require('./browsing-session.cjs');
let browsingSession = null;
const queueWindow = require('./queue-window.cjs').createQueueWindow();
const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { randomUUID } = require('node:crypto');
const { Worker } = require('node:worker_threads');
require('./app/rules/search.js');
const playlistRules = require('./app/rules/playlist-rules.js');
const { WaveformService } = require('./waveform.cjs');
const portableStorage = require('./portable.cjs');
const releaseInfo = require('./release.cjs');
const { prepareUpdate } = require('./update-preparation.cjs');
const onlineUpdates = require('./online-updates.cjs').createOnlineUpdates({
  version: app.getVersion(),
  platform: process.platform,
  arch: process.arch,
  progress: (value) => {
    if (win && !win.isDestroyed()) win.webContents.send('update-progress', value);
  },
});
let updateDownload = null;
const { PlaybackShortcuts } = require('./global-shortcuts.cjs');
const playbackShortcuts = new PlaybackShortcuts(globalShortcut, (action) => {
  if (win && !win.isDestroyed()) win.webContents.send('global-playback', action);
});
let playbackSession = null;
let waveforms,
  playbackHistory = {},
  historyPath,
  historyWrites = Promise.resolve();
const { LastfmService, metadataFor } = require('./lastfm.cjs');
let lastfm,
  tagHistory,
  quitting = false;
const { serveAudio } = require('./media.cjs');
const ratingTags = require('./rating-tags.cjs');
const tagEditor = require('./tags.cjs');
const musicbrainz = require('./musicbrainz.cjs').createMusicBrainz({
  fetch: (...args) => net.fetch(...args),
  userAgent: `Localtone/${app.getVersion()} (${require('./package.json').homepage})`,
});
const { normalizeSettings, validateSettings, validateRating } = require('./preferences.cjs');
if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}
if (typeof app.setPath === 'function') {
  try {
    portableStorage.configurePortable(app, __dirname);
  } catch (error) {
    app.whenReady().then(() => {
      dialog.showErrorBox(
        'Portable data folder unavailable',
        'Put Localtone in a writable folder, alongside Localtone-data.\n' + error.message,
      );
      app.quit();
    });
    return;
  }
}
app.on('second-instance', () => {
  if (win) {
    if (win.isMinimized()) win.restore();
    win.focus();
  }
});
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'localtone',
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
  },
]);
let maximizeRestore = null;
let miniMode = false,
  normalBounds = null,
  normalMaximized = false,
  normalMinimum = [1044, 740];
let win,
  db,
  dbPath,
  covers,
  busy = false,
  trackIndex = new Map();
const fresh = () => ({ libraries: [], tracks: [], playlists: [] });
function index() {
  trackIndex = new Map(db.tracks.map((t) => [t.id, t]));
}
async function save() {
  await fs.writeFile(dbPath + '.tmp', JSON.stringify(db));
  await fs.rename(dbPath + '.tmp', dbPath);
}
// One projection for browsing, dynamic membership, and freezing a dynamic playlist.
function presentTrack({ path: filename, mtime, size, ...track }, libraries) {
  const library = libraries.get(track.libraryId),
    relative = library ? path.relative(library.root, filename) : '',
    parts = relative.split(path.sep),
    folder = parts.length > 1 ? parts[0] : '';
  return {
    ...track,
    folderKey: JSON.stringify([track.libraryId, folder]),
    folderArtist: folder || (library ? path.basename(library.root) : 'Music'),
    relativePath: parts.join('/'),
    artistPath: (folder ? parts.slice(1) : parts).join('/'),
    albumFolder: folder && parts.length > 2 ? parts[1] : '',
  };
}
function collectionView() {
  const libraries = new Map(db.libraries.map((l) => [l.id, l]));
  return { ...db, tracks: db.tracks.map((track) => presentTrack(track, libraries)) };
}
function snapshot() {
  const view = collectionView();
  return {
    ...view,
    playbackSession,
    browsingSession,
    startupRefresh,
    globalShortcutStatus: playbackShortcuts.status(),
    storage: portableStorage.storageStatus(app),
    playbackHistory,
    playlists: db.playlists.map((p) =>
      p.dynamic?.enabled
        ? { ...p, trackIds: playlistRules.matchingTracks(view, p.dynamic).map((t) => t.id) }
        : p,
    ),
  };
}

function check(event) {
  if (!event.senderFrame || event.senderFrame.url !== 'localtone://app/index.html')
    throw new Error('Untrusted caller');
}
function handle(name, fn) {
  ipcMain.handle(name, async (event, ...args) => {
    check(event);
    if (busy || quitting)
      throw new Error('Localtone is updating your music or saving changes. Please wait a moment.');
    busy = true;
    let before;
    try {
      before = structuredClone(db);
      return await fn(...args);
    } catch (error) {
      if (before) {
        db = before;
        index();
      }
      throw error;
    } finally {
      busy = false;
    }
  });
}
function scan(
  library,
  files = null,
  previous = db.tracks.filter((t) => t.libraryId === library.id),
  quiet = false,
) {
  return new Promise((resolve, reject) => {
    let finished = false;
    const worker = new Worker(path.join(__dirname, 'scanner.mjs'), {
      workerData: {
        files,
        root: library.root,
        libraryId: library.id,
        covers,
        previous,
      },
    });
    worker.on('message', (value) => {
      if (value.progress != null) {
        if (!quiet && !files && !win.isDestroyed())
          win.webContents.send('scan-progress', value.progress);
      } else {
        finished = true;
        value.error ? reject(new Error(value.error)) : resolve(value);
      }
    });
    worker.on('error', reject);
    worker.on('exit', (code) => {
      if (!finished) reject(new Error(`Scanner stopped (${code})`));
    });
  });
}
async function importLibrary(library, files = null, preserveRatings = false, quiet = false) {
  const before = quiet ? JSON.stringify(db) : null;
  const result = await scan(library, files, undefined, quiet);
  if (files) {
    const updates = new Map(result.tracks.map((t) => [t.id, t]));
    db.tracks = db.tracks.map((t) => updates.get(t.id) || t);
  } else {
    const found = new Set(result.tracks.map((t) => t.id)),
      missing = db.tracks
        .filter((t) => t.libraryId === library.id && !found.has(t.id))
        .map((t) => ({ ...t, missing: true }));
    db.tracks = db.tracks.filter((t) => t.libraryId !== library.id).concat(result.tracks, missing);
  }
  const valid = new Set(db.tracks.map((t) => t.id));
  db.playlists.forEach((p) => (p.trackIds = p.trackIds.filter((id) => valid.has(id))));
  for (const track of result.tracks) {
    if (
      !preserveRatings &&
      track.codec === 'MP3' &&
      !Object.hasOwn(db.pendingRatings || {}, track.id)
    ) {
      if (track.tagRating) db.ratings[track.id] = track.tagRating;
      else delete db.ratings[track.id];
    }
  }
  index();
  if (!quiet || JSON.stringify(db) !== before) await save();
  return { state: snapshot(), warnings: result.warnings };
}
function validName(name) {
  if (typeof name !== 'string' || !name.trim() || name.length > 100)
    throw new Error('Use a name between 1 and 100 characters.');
  return name.trim();
}
app.whenReady().then(async () => {
  dbPath = path.join(app.getPath('userData'), 'collection.json');
  covers = path.join(app.getPath('userData'), 'covers');
  await fs.mkdir(app.getPath('userData'), { recursive: true });
  tagHistory = require('./tag-history.cjs').createTagHistory(
    path.join(app.getPath('userData'), 'tag-backups'),
  );
  try {
    db = JSON.parse(await fs.readFile(dbPath, 'utf8'));
    if (!['libraries', 'tracks', 'playlists'].every((k) => Array.isArray(db[k])))
      throw new Error('Invalid collection');
  } catch (error) {
    if (error.code !== 'ENOENT') {
      dialog.showErrorBox(
        'Unable to open collection',
        'Your collection file was left untouched. Restore collection.json from a backup.\n' +
          error.message,
      );
      app.quit();
      return;
    }
    db = fresh();
  }
  try {
    playbackSession = JSON.parse(
      await fs.readFile(path.join(app.getPath('userData'), 'playback-session.json'), 'utf8'),
    );
  } catch {}
  try {
    browsingSession = validateSession(
      JSON.parse(
        await fs.readFile(path.join(app.getPath('userData'), 'browsing-session.json'), 'utf8'),
      ),
    );
  } catch {}
  historyPath = path.join(app.getPath('userData'), 'playback-history.json');
  try {
    playbackHistory = JSON.parse(await fs.readFile(historyPath, 'utf8'));
  } catch {
    playbackHistory = {};
  }
  if (!playbackHistory || typeof playbackHistory !== 'object' || Array.isArray(playbackHistory))
    playbackHistory = {};
  for (const track of db.tracks) {
    track.addedAt ??= null;
    track.modifiedAt ??= track.mtime > 0 ? track.mtime : null;
  }
  db.settings = normalizeSettings(db.settings);
  if (!db.ratings || typeof db.ratings !== 'object' || Array.isArray(db.ratings)) db.ratings = {};
  if (db.ratingStorageVersion !== 1) {
    db.pendingRatings = Object.fromEntries(
      db.tracks
        .filter((t) => t.codec === 'MP3' && db.ratings[t.id])
        .map((t) => [t.id, db.ratings[t.id]]),
    );
    db.ratingStorageVersion = 1;
  }
  db.pendingRatings ??= {};
  index();
  protocol.handle('localtone', async (request) => {
    const url = new URL(request.url);
    if (url.host === 'app') {
      const relative = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
      if (
        ![
          'index.html',
          'style.css',
          'renderer.js',
          'design-defaults.js',
          'settings-writes.js',
          'tag-editor.js',
          'playlist-editor.js',
          'lastfm-settings.js',
          'dialog-coordinator.js',
          'settings-tabs.js',
          'settings-help.js',
          'album-number-lookup.js',
          'musicbrainz-review.js',
          'file-naming-dialog.js',
          'duplicates-dialog.js',
          'browse-selection.js',
          'playback-queue.js',
          'window-presentation.js',
          'audio-output-settings.js',
          'virtual-tracks.js',
          'icons.js',
          'context-menu.js',
          'shortcuts.js',
          'queue-view.js',
          'buffered-audio.js',
          'core.js',
          'name-dialog.js',
          'browse.js',
          'interactions.js',
          'listen.js',
          'waveform-view.js',
          'rules/playlist-rules.js',
          'rules/search.js',
          'rules/number-actions.js',
        ].includes(relative)
      )
        return new Response('Not found', { status: 404 });
      return net.fetch(pathToFileURL(path.join(__dirname, 'app', relative)).href);
    }
    const id = url.pathname.slice(1),
      track = trackIndex.get(id);
    if (!track || !['audio', 'cover'].includes(url.host))
      return new Response('Not found', { status: 404 });
    try {
      if (url.host === 'audio') return await serveAudio(track.path, request);
      return await net.fetch(pathToFileURL(path.join(covers, id)).href);
    } catch {
      return new Response('File unavailable', { status: 404 });
    }
  });
  const localAudioOrigin = (url) =>
    typeof url === 'string' && /^localtone:\/\/app(?:\/|$)/.test(url);
  session.defaultSession.setPermissionRequestHandler((wc, permission, callback, details) =>
    callback(
      permission === 'speaker-selection' &&
        localAudioOrigin(details?.requestingUrl || wc?.getURL?.()),
    ),
  );
  session.defaultSession.setPermissionCheckHandler?.(
    (_wc, permission, origin, details) =>
      permission === 'speaker-selection' && localAudioOrigin(details?.requestingUrl || origin),
  );
  lastfm = new LastfmService({
    directory: app.getPath('userData'),
    storage: safeStorage,
    fetch: (...args) => net.fetch(...args),
    openExternal: (url) => shell.openExternal(url),
  });
  await lastfm.init();
  const metadataCache = new Map();
  ipcMain.handle('lastfm', async (event, action) => {
    check(event);
    if (!action || typeof action !== 'object') throw new Error('Invalid Last.fm action.');
    if (action.type === 'status') return lastfm.status();
    if (action.type === 'credentials')
      return lastfm.saveCredentials(
        String(action.key || '').trim(),
        String(action.secret || '').trim(),
      );
    if (action.type === 'connect') return lastfm.connect();
    if (action.type === 'finish') return lastfm.finish();
    if (action.type === 'enable') return lastfm.enable(action.value);
    if (action.type === 'disconnect') return lastfm.disconnect();
    if (action.type === 'retry') return lastfm.flush();
    if (action.type === 'api-account') {
      await shell.openExternal('https://www.last.fm/api/account/create');
      return lastfm.status();
    }
    throw new Error('Invalid Last.fm action.');
  });
  ipcMain.handle('lastfm-playback', async (event, kind, play) => {
    check(event);
    if (!lastfm.status().enabled) return lastfm.status();
    if (!['now', 'scrobble'].includes(kind) || !play || typeof play.id !== 'string')
      throw new Error('Invalid playback event.');
    const track = trackIndex.get(play.id);
    if (!track) return lastfm.status();
    let cached = metadataCache.get(track.id);
    if (!cached || cached.mtime !== track.mtime) {
      try {
        cached = { mtime: track.mtime, tags: await metadataFor(track) };
        metadataCache.clear();
        metadataCache.set(track.id, cached);
      } catch {
        return { ...lastfm.status(), error: 'Unable to read tags for Last.fm.' };
      }
    }
    return lastfm.submit(kind, play, cached.tags);
  });
  waveforms = new WaveformService(path.join(app.getPath('userData'), 'waveforms'));
  ipcMain.handle('waveform', async (event, id) => {
    check(event);
    const track = trackIndex.get(id);
    if (!track) throw new Error('Track not found.');
    return waveforms.get(track);
  });
  ipcMain.handle('waveform-cancel', (event) => {
    check(event);
    waveforms.cancel();
  });
  ipcMain.handle('app-info', (event) => {
    check(event);
    return {
      name: 'Localtone',
      version: app.getVersion(),
      platform: process.platform,
      arch: process.arch,
      packaged: !!app.isPackaged,
      storage: portableStorage.storageStatus(app).portable ? 'Portable' : 'System app data',
      dataFolder: app.getPath('userData'),
      runtime: {
        electron: process.versions.electron || '',
        chromium: process.versions.chrome || '',
        node: process.versions.node,
      },
    };
  });
  ipcMain.handle('about-action', async (event, action) => {
    check(event);
    if (action !== 'open-data') throw new Error('Unknown About action.');
    const error = await shell.openPath(app.getPath('userData'));
    if (error) throw new Error(error);
  });
  ipcMain.handle('check-update', async (event) => {
    check(event);
    return onlineUpdates.check();
  });
  ipcMain.handle('cancel-update', (event) => {
    check(event);
    onlineUpdates.cancel();
  });
  ipcMain.handle('download-update', async (event, name) => {
    check(event);
    if (
      typeof name !== 'string' ||
      !/^Localtone-[0-9.]+-(mac|win|linux)-(x64|arm64)\.zip$/.test(name)
    )
      throw new Error('Invalid update filename.');
    const choice = await dialog.showSaveDialog(win, {
      title: 'Save Localtone update',
      defaultPath: path.join(app.getPath('downloads'), name),
      filters: [{ name: 'Desktop archive', extensions: ['zip'] }],
    });
    if (choice.canceled || !choice.filePath) return { cancelled: true };
    const result = await onlineUpdates.download(choice.filePath, name);
    if (!result.cancelled) updateDownload = result.file;
    return result;
  });
  ipcMain.handle('reveal-update', (event) => {
    check(event);
    if (updateDownload) shell.showItemInFolder(updateDownload);
  });
  handle('prepare-update', async () => {
    portableStorage.assertUpdateReady(app);
    const choice = await dialog.showOpenDialog(win, {
      title: 'Choose the new Localtone app folder',
      properties: ['openDirectory', 'treatPackageAsDirectory'],
    });
    if (choice.canceled || !choice.filePaths.length) return { cancelled: true };
    const release = await releaseInfo.inspectRelease(choice.filePaths[0], app.getVersion());
    const response = await dialog.showMessageBox(win, {
      type: 'question',
      buttons: ['Prepare update', 'Cancel'],
      defaultId: 1,
      cancelId: 1,
      title: 'Prepare Localtone update',
      message: `Prepare Localtone ${release.manifest.version}?`,
      detail:
        'Your saved data will be copied to the new app folder. The current version and its data stay intact. Close this version after preparation, then start the new one.',
    });
    if (response.response !== 0) return { cancelled: true };
    await save();
    await historyWrites;
    const copy = () =>
      prepareUpdate({
        source: app.getPath('userData'),
        targetRoot: release.dataRoot,
        portable: portableStorage.storageStatus(app).portable,
        version: release.manifest.version,
      });
    return {
      ...(await (lastfm ? lastfm.run(copy) : copy())),
      folder: release.dataRoot,
      kind: release.manifest.kind,
    };
  });
  ipcMain.handle('load', (event) => {
    check(event);
    return snapshot();
  });
  ipcMain.on('save-browsing', (event, value) => {
    try {
      check(event);
      if (JSON.stringify(value).length > 2 * 1024 * 1024) throw Error('Session too large.');
      const bounds = miniMode && normalBounds ? normalBounds : queueWindow.normalBounds(win);
      browsingSession = validateSession({
        ...value,
        window: { bounds, maximized: miniMode ? normalMaximized : win.isMaximized() },
      });
      const file = path.join(app.getPath('userData'), 'browsing-session.json'),
        sync = require('node:fs');
      sync.writeFileSync(file + '.tmp', JSON.stringify(browsingSession));
      sync.renameSync(file + '.tmp', file);
      event.returnValue = true;
    } catch {
      event.returnValue = false;
    }
  });
  ipcMain.on('save-playback', (event, value) => {
    try {
      check(event);
      if (
        !value ||
        !trackIndex.has(value.id) ||
        !Number.isFinite(value.position) ||
        value.position < 0
      )
        throw new Error('Invalid playback position');
      const origin = value.origin;
      playbackSession = {
        id: value.id,
        position: value.position,
        origin:
          origin && ['all', 'library', 'playlist'].includes(origin.kind)
            ? { kind: origin.kind, id: typeof origin.id === 'string' ? origin.id : undefined }
            : null,
      };
      const file = path.join(app.getPath('userData'), 'playback-session.json'),
        sync = require('node:fs');
      sync.writeFileSync(file + '.tmp', JSON.stringify(playbackSession));
      sync.renameSync(file + '.tmp', file);
      event.returnValue = true;
    } catch {
      event.returnValue = false;
    }
  });
  ipcMain.handle('remember-played', async (event, id) => {
    check(event);
    const track = trackIndex.get(id);
    if (!track) throw new Error('Track not found.');
    playbackHistory[track.libraryId] = id;
    playbackHistory.all = id;
    const presented = presentTrack(track, new Map(db.libraries.map((l) => [l.id, l]))),
      now = Date.now();
    for (const p of db.playlists) {
      const member = p.dynamic?.enabled
        ? playlistRules.matchesTrack(db, p.dynamic, presented, now)
        : p.trackIds.includes(id);
      if (member) playbackHistory[`playlist:${p.id}`] = id;
    }
    const data = JSON.stringify(playbackHistory);
    const write = historyWrites
      .catch(() => {})
      .then(async () => {
        await fs.writeFile(historyPath + '.tmp', data);
        await fs.rename(historyPath + '.tmp', historyPath);
      });
    historyWrites = write;
    await write;
    return { ...playbackHistory };
  });
  const runWindowAction = async (action, size) => {
    const animated = size?.animate === true;
    motionContentSize = null;
    const resize = (target) => {
      const [ow, oh] = win.getSize(),
        [cw, ch] = win.getContentSize();
      motionContentSize = [target.width - (ow - cw), target.height - (oh - ch)];
      return animated ? animateBounds(win, target) : win.setBounds(target);
    };
    if (action === 'queue-open') return !miniMode && queueWindow.open(win, screen, 224, resize);
    if (action === 'queue-close') {
      if (queueWindow.extended) {
        normalMinimum = [Math.max(1, normalMinimum[0] - 224), normalMinimum[1]];
        win.setMinimumSize(...normalMinimum);
      }
      await queueWindow.close(win, resize);
      return;
    }
    if (action === 'mini') {
      await queueWindow.close(win);
      if (!miniMode) {
        const bounds = win.getBounds();
        normalVisualBounds = { ...bounds };
        normalMaximized = win.isMaximized();
        normalBounds = normalMaximized
          ? win.getNormalBounds?.() || maximizeRestore || bounds
          : bounds;
        const width = Math.round(Math.max(140, Math.min(320, Number(size?.width) || 320))),
          height = Math.round(Math.max(120, Math.min(600, Number(size?.height) || width + 116)));
        const [ow, oh] = win.getSize(),
          [cw, ch] = win.getContentSize();
        const frameW = Math.max(0, ow - cw),
          frameH = Math.max(0, oh - ch);
        miniMode = true;
        if (normalMaximized) {
          win.unmaximize();
          win.setBounds(bounds);
        }
        win.setMinimumSize(1, 1);
        win.setResizable(true);
        await resize({
          x: bounds.x,
          y: bounds.y + bounds.height - height - frameH,
          width: width + frameW,
          height: height + frameH,
        });
        win.setResizable(false);
      } else {
        win.setResizable(true);
        await resize(normalMaximized ? normalVisualBounds : normalBounds);
        miniMode = false;
        win.setMinimumSize(...normalMinimum);
        if (normalMaximized) {
          maximizeRestore = normalBounds;
          win.maximize();
        }
      }
      return miniMode;
    }
    if (action === 'quit') {
      app.quit();
      return;
    }
    if (busy)
      throw new Error('Localtone is updating your music or saving changes. Please wait a moment.');
    if (action === 'maximize') {
      if (miniMode) return;
      if (win.isMaximized() || maximizeRestore) {
        const restore = maximizeRestore || win.getNormalBounds?.();
        win.unmaximize();
        if (restore) win.setBounds(restore);
        maximizeRestore = null;
      } else {
        maximizeRestore = win.getBounds();
        win.maximize();
      }
      return;
    }
    throw new Error('Invalid window action.');
  };
  ipcMain.handle('window-action', (event, action, size) => {
    check(event);
    const job = motionJobs.then(async () => {
      motionActive = true;
      try {
        const value = await runWindowAction(action, size);
        return size?.report
          ? { value, contentSize: motionContentSize || win.getContentSize() }
          : value;
      } finally {
        motionActive = false;
      }
    });
    motionJobs = job.catch(() => {});
    return job;
  });
  handle('cleanup-external-data', async () => {
    if (!portableStorage.storageStatus(app).portable)
      throw new Error('Enable Portable and restart first.');
    const answer = await dialog.showMessageBox(win, {
      type: 'warning',
      title: 'Remove old app data',
      message: 'Remove Localtone’s old app-data folder?',
      detail:
        'A verified backup of the entire folder will be saved inside Localtone-data first. Current settings will not be replaced. Only this folder is removed; operating-system history and other locations are not cleaned. Close other Localtone instances first.\n\n' +
        portableStorage.externalLocation(app),
      buttons: ['Cancel', 'Back up and remove'],
      defaultId: 0,
      cancelId: 0,
    });
    if (answer.response !== 1) return { cancelled: true };
    return portableStorage.cleanupExternal(app);
  });
  handle('clean-cache', async () =>
    cleanUnusedCache(app.getPath('userData'), db.tracks, waveforms?.active?.key),
  );
  handle('settings-transfer', async (action) => {
    if (action === 'export') {
      const result = await dialog.showSaveDialog(win, {
        title: 'Export settings',
        defaultPath: 'Localtone-settings.json',
        filters: [{ name: 'Settings', extensions: ['json'] }],
      });
      if (result.canceled || !result.filePath) return { cancelled: true };
      await fs.writeFile(
        result.filePath,
        JSON.stringify(settingsTransfer.exportSettings(db.settings, db), null, 2),
      );
      return { exported: true };
    }
    if (action !== 'import') throw new Error('Invalid settings action.');
    const result = await dialog.showOpenDialog(win, {
      title: 'Import settings',
      properties: ['openFile'],
      filters: [{ name: 'Settings', extensions: ['json'] }],
    });
    if (result.canceled || !result.filePaths[0]) return { cancelled: true };
    const file = result.filePaths[0];
    if ((await fs.stat(file)).size > 32 * 1024 * 1024)
      throw new Error('Settings file is too large.');
    let value;
    try {
      value = JSON.parse(await fs.readFile(file, 'utf8'));
    } catch {
      throw new Error('The settings file is not valid JSON.');
    }
    const patch = settingsTransfer.importSettings(value);
    const collections = value.collections
      ? settingsTransfer.mergeCollections(db, value.collections)
      : null;
    const answer = await dialog.showMessageBox(win, {
      type: 'question',
      title: 'Import settings',
      message: 'Apply these preferences?',
      detail: collections
        ? 'Preferences will be updated and libraries and playlists added. Existing collections are preserved. Music files are not included; paths must match this computer. Current settings and collections will be backed up. Storage mode, Last.fm and audio devices stay unchanged.'
        : 'Appearance, layout, shortcuts and browsing preferences will be updated. Libraries, playlists, storage mode, Last.fm and audio devices stay unchanged. Current preferences will be backed up.',
      buttons: ['Cancel', 'Import'],
      defaultId: 0,
      cancelId: 0,
    });
    if (answer.response !== 1) return { cancelled: true };
    const before = db.settings,
      dir = path.join(app.getPath('userData'), 'settings-backups');
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(
      path.join(dir, Date.now() + '-' + randomUUID() + '.json'),
      JSON.stringify(
        settingsTransfer.exportSettings(
          { ...before, exportCollections: !!collections || before.exportCollections },
          db,
        ),
        null,
        2,
      ),
    );
    try {
      if (collections) {
        Object.assign(db, collections);
        index();
      }
      db.settings = normalizeSettings({ ...before, ...patch });
      playbackShortcuts.set(db.settings.globalPlaybackShortcuts, db.settings.shortcuts);
      await save();
    } catch (error) {
      db.settings = before;
      playbackShortcuts.set(before.globalPlaybackShortcuts, before.shortcuts);
      throw error;
    }
    win?.webContents.send('global-shortcut-status', playbackShortcuts.status());
    return { settings: db.settings, ...(collections ? { state: snapshot() } : {}) };
  });
  handle('settings', async (patch) => {
    let cleanup = false;
    if (patch.portable === true && !portableStorage.storageStatus(app).portable) {
      const answer = await dialog.showMessageBox(win, {
        type: 'question',
        title: 'Enable portable storage',
        message: 'Move Localtone data into the program folder?',
        detail:
          'After restarting, settings and collection data will be copied into Localtone-data. You can also remove the old app-data folder after a verified backup inside Localtone-data. This does not erase operating-system history or files elsewhere.\n\nOld folder: ' +
          portableStorage.externalLocation(app),
        buttons: ['Copy and keep old files', 'Move and remove old files', 'Cancel'],
        defaultId: 0,
        cancelId: 2,
      });
      if (answer.response === 2) throw new Error('Storage change cancelled.');
      cleanup = answer.response === 1;
    }
    const clean = validateSettings(patch),
      before = db.settings;
    if (clean.shuffle === true) clean.repeat = 0;
    else if (clean.repeat > 0) clean.shuffle = false;
    if (clean.columns || clean.columnsByView) {
      const shared = clean.columns || clean.columnsByView.tracks;
      clean.columns = shared;
      clean.columnsByView = Object.fromEntries(
        ['tracks', 'playlists', 'albums'].map((k) => [k, shared.map((c) => ({ ...c }))]),
      );
    }
    db.settings = { ...before, ...clean };
    try {
      if (Object.hasOwn(clean, 'globalPlaybackShortcuts') || clean.shortcuts)
        playbackShortcuts.set(db.settings.globalPlaybackShortcuts, db.settings.shortcuts);
      await save();
      if (Object.hasOwn(clean, 'portable') && typeof app.setPath === 'function')
        portableStorage.requestMode(app, clean.portable, cleanup);
    } catch (error) {
      db.settings = before;
      try {
        playbackShortcuts.set(before.globalPlaybackShortcuts, before.shortcuts);
      } catch {}
      await save();
      throw error;
    }
    win?.webContents.send('global-shortcut-status', playbackShortcuts.status());
    return db.settings;
  });
  async function rateFile(id, value) {
    const track = trackIndex.get(id);
    if (!track) throw new Error('Track not found.');
    const rating = validateRating(value);
    const persist = async () => {
      for (const other of db.tracks.filter((t) => t.path === track.path)) {
        if (rating) db.ratings[other.id] = rating;
        else delete db.ratings[other.id];
        delete db.pendingRatings[other.id];
        other.tagRating = rating;
        const info = await fs.stat(other.path);
        other.mtime = info.mtimeMs;
        other.modifiedAt = info.mtimeMs;
        other.size = info.size;
      }
      await save();
    };
    let undoToken = null;
    if (track.codec === 'MP3') {
      const saved = await ratingTags.writeRating({
        file: track.path,
        rating,
        backupStore: tagHistory.store,
        onSaved: persist,
      });
      undoToken = tagHistory.register([{ id, backup: saved.backup }]);
    } else {
      if (rating) db.ratings[id] = rating;
      else delete db.ratings[id];
      await save();
    }
    return { id, rating, modifiedAt: track.modifiedAt, undoToken };
  }
  handle('rating', rateFile);
  handle('search-web', async (action) => {
    if (!action || !['track', 'album', 'artist'].includes(action.kind))
      throw new Error('Invalid search request.');
    const track = trackIndex.get(action.id);
    if (!track) throw new Error('Track not found.');
    const artist = track.artist || track.albumArtist || track.folderArtist || '';
    const query =
      action.kind === 'artist'
        ? artist
        : [artist, action.kind === 'album' ? track.album : track.title].filter(Boolean).join(' ');
    await shell.openExternal('https://duckduckgo.com/?q=' + encodeURIComponent('!g ' + query));
    return null;
  });
  handle('open-folder', async (action) => {
    if (!action || !['track', 'album', 'artist'].includes(action.kind))
      throw new Error('Invalid folder request.');
    const track = trackIndex.get(action.id);
    if (!track) throw new Error('Track not found.');
    const library = db.libraries.find((l) => l.id === track.libraryId);
    if (!library) throw new Error('Library not found.');
    const parts = path.relative(library.root, track.path).split(path.sep);
    let folder = path.dirname(track.path);
    if (action.kind === 'artist')
      folder = parts.length > 1 ? path.join(library.root, parts[0]) : library.root;
    if (action.kind === 'album')
      folder =
        parts.length > 2
          ? path.join(library.root, parts[0], parts[1])
          : parts.length > 1
            ? path.join(library.root, parts[0])
            : library.root;
    if (!(await fs.stat(folder)).isDirectory()) throw new Error('Folder is unavailable.');
    shell.showItemInFolder(action.kind === 'track' ? track.path : folder);
    return null;
  });
  handle('track-numbers', async () => {
    for (const library of db.libraries) {
      const files = db.tracks
        .filter((t) => t.libraryId === library.id && typeof t.trackRaw !== 'string')
        .map((t) => t.path);
      if (files.length) await importLibrary(library, files);
    }
    return snapshot();
  });
  handle('read-tags', async (id) => {
    const track = trackIndex.get(id);
    if (!track) throw new Error('Track not found.');
    return tagEditor.readTags(track.path);
  });
  handle('write-tags', async (id, values, token) => {
    const track = trackIndex.get(id);
    if (!track) throw new Error('Track not found.');
    const library = db.libraries.find((l) => l.id === track.libraryId);
    if (!library) throw new Error('Library not found.');
    let result;
    const saved = await tagEditor.writeTags({
      file: track.path,
      values,
      token,
      backupStore: tagHistory.store,
      onSaved: async () => {
        track.mtime = -1;
        result = await importLibrary(library, [track.path]);
      },
    });
    return { ...result, undoToken: tagHistory.register([{ id, backup: saved.backup }]) };
  });
  const tagTracks = (ids) => {
    if (!Array.isArray(ids) || !ids.length || ids.some((id) => typeof id !== 'string'))
      throw new Error('Select MP3 tracks to edit.');
    return [...new Set(ids)].map((id) => {
      const t = trackIndex.get(id);
      if (!t || t.codec !== 'MP3') throw new Error('Tag editing supports MP3 tracks only.');
      return t;
    });
  };
  ipcMain.handle('musicbrainz-search', (event, query) => {
    check(event);
    return musicbrainz.search(query || {});
  });
  ipcMain.handle('musicbrainz-release', (event, id) => {
    check(event);
    return musicbrainz.release(id);
  });
  handle('format-track-numbers', async (ids, mode) => {
    if (!['pad', 'unpad', 'total', 'renumber'].includes(mode))
      throw new Error('Invalid track-number action.');
    const targets = tagTracks(ids),
      plans = [],
      saved = [],
      failures = [],
      records = [];
    const presented = collectionView().tracks;
    const presentedLookup = new Map(presented.map((track) => [track.id, track]));
    const selected = targets.map((t) => presentedLookup.get(t.id));
    if (mode === 'renumber' && !numberActions.canRenumber(selected, presented))
      throw Error('Select all tracks from exactly one available album to renumber.');
    const numbers =
      mode === 'renumber'
        ? numberActions.folderNumberTags(selected, {
            ignoreDiscs: db.settings.renumberIgnoreDiscs,
            leadingZeros: db.settings.totalLeadingZeros,
          })
        : null;
    for (const track of targets) {
      const tags = await tagEditor.readTags(track.path),
        raw = tags.values.track;
      if (mode !== 'renumber' && !/^\d+(\/\d+)?$/.test(raw || '')) continue;
      const [number, total] = raw.split('/');
      let value = raw;
      if (mode === 'renumber') {
        value = numbers.get(track.id);
      } else if (mode === 'pad')
        value = number.padStart(2, '0') + (total !== undefined ? '/' + total.padStart(2, '0') : '');
      else if (mode === 'unpad')
        value = raw
          .split('/')
          .map((part) => part.replace(/^0+(?=\d)/, ''))
          .join('/');
      else if (total === undefined || !(Number(total) > 0)) {
        const peers = db.tracks.filter(
          (t) =>
            t.libraryId === track.libraryId &&
            path.dirname(t.path) === path.dirname(track.path) &&
            (t.disc || 1) === (track.disc || 1),
        );
        const known = peers
          .map((t) => Number(String(t.trackRaw || '').split('/')[1]))
          .filter((n) => Number.isInteger(n) && n > 0);
        const inferred = Math.max(peers.length, ...peers.map((t) => t.track || 0), Number(number));
        value =
          number +
          '/' +
          (known.length && new Set(known).size === 1 && known[0] >= inferred ? known[0] : inferred);
      }
      if (mode === 'total' && value !== raw && db.settings.totalLeadingZeros) {
        const [n, total] = value.split('/');
        value = n.padStart(Math.max(2, total.length, n.length), '0') + '/' + total.padStart(2, '0');
      }
      if (value !== raw) {
        const plan = { track, patch: { track: value }, token: tags.token };
        await tagEditor.prepareTags({ file: track.path, patch: plan.patch, token: plan.token });
        plans.push(plan);
      }
    }
    for (const { track, patch, token } of plans) {
      try {
        const written = await tagEditor.writeTags({
          file: track.path,
          patch,
          token,
          backupStore: tagHistory.store,
        });
        records.push({ id: track.id, backup: written.backup });
        track.mtime = -1;
        saved.push(track);
      } catch (error) {
        failures.push({ id: track.id, message: error.message });
      }
    }
    for (const id of new Set(saved.map((t) => t.libraryId))) {
      try {
        await importLibrary(
          db.libraries.find((l) => l.id === id),
          saved.filter((t) => t.libraryId === id).map((t) => t.path),
        );
      } catch (error) {
        failures.push({ message: 'Tags saved, but refresh failed: ' + error.message });
      }
    }
    return {
      state: snapshot(),
      saved: saved.map((t) => t.id),
      failures,
      undoToken: tagHistory.register(records),
    };
  });
  handle('read-tags-batch', async (ids) => {
    const tracks = tagTracks(ids),
      results = new Array(tracks.length);
    let next = 0;
    const worker = async () => {
      while (next < tracks.length) {
        const index = next++,
          track = tracks[index];
        results[index] = {
          id: track.id,
          name: path.basename(track.path),
          ...(await tagEditor.readTags(track.path)),
        };
      }
    };
    await Promise.all(Array.from({ length: Math.min(4, tracks.length) }, worker));
    return results;
  });
  handle('write-tags-batch', async (entries, patch, remove) => {
    if (
      !patch ||
      typeof patch !== 'object' ||
      Array.isArray(patch) ||
      !Array.isArray(entries) ||
      !entries.length ||
      entries.length > 10000 ||
      new Set(entries.map((e) => e?.id)).size !== entries.length ||
      entries.some(
        (e) =>
          !e ||
          typeof e.id !== 'string' ||
          typeof e.token !== 'string' ||
          (e.patch !== undefined &&
            (!e.patch || typeof e.patch !== 'object' || Array.isArray(e.patch))),
      ) ||
      !Array.isArray(remove)
    )
      throw new Error('Invalid tag edit.');
    for (const entry of entries) {
      const raw = entry.patch?.track;
      if (typeof raw === 'string' && raw.includes('/')) {
        const [number, total] = raw.split('/').map(Number);
        if (!Number.isInteger(number) || number < 1 || !Number.isInteger(total) || total < number)
          throw new Error('Invalid track-number change.');
      }
    }
    const targets = tagTracks(entries.map((e) => e.id)),
      entriesById = new Map(entries.map((e) => [e.id, e]));
    // Validate all files and edits before writing any. Recheck tokens again at commit.
    await tagEditor.mapTagFiles(targets, async (track) => {
      const entry = entriesById.get(track.id);
      await tagEditor.prepareTags({
        file: track.path,
        patch: { ...patch, ...entry.patch },
        remove: remove.filter((k) => (entry.extraKeys || []).includes(k)),
        token: entry.token,
      });
    });
    const saved = [],
      failures = [],
      libraries = new Set(),
      records = [];
    const outcomes = await tagEditor.mapTagFiles(targets, async (track) => {
      const entry = entriesById.get(track.id);
      try {
        const written = await tagEditor.writeTags({
          file: track.path,
          patch: { ...patch, ...entry.patch },
          remove: remove.filter((k) => (entry.extraKeys || []).includes(k)),
          token: entry.token,
          backupStore: tagHistory.store,
        });
        track.mtime = -1;
        return { track, backup: written.backup };
      } catch (error) {
        return {
          failure: { id: track.id, name: path.basename(track.path), message: error.message },
        };
      }
    });
    for (const outcome of outcomes) {
      if (outcome.failure) failures.push(outcome.failure);
      else {
        records.push({ id: outcome.track.id, backup: outcome.backup });
        saved.push(outcome.track.id);
        libraries.add(outcome.track.libraryId);
      }
    }
    for (const id of libraries) {
      try {
        await importLibrary(
          db.libraries.find((l) => l.id === id),
          targets.filter((t) => t.libraryId === id && saved.includes(t.id)).map((t) => t.path),
        );
      } catch (error) {
        failures.push({
          name: 'Library refresh',
          message: error.message + ' Rescan the library to refresh saved tags.',
        });
      }
    }
    return { state: snapshot(), saved, failures, undoToken: tagHistory.register(records) };
  });
  const commitNames = async (moves) => {
    for (const track of db.tracks) track.path = fileNaming.relocated(track.path, moves);
    index();
    await save();
  };
  handle('find-duplicates', async (mode) => duplicates.review(db.tracks, db.libraries, mode));
  handle('remove-duplicates', async (token, ids) => {
    const result = await duplicates.remove(token, ids, {
      confirm: async (files, mode) => {
        const answer = await dialog.showMessageBox(win, {
          type: 'warning',
          title: 'Remove duplicate files',
          message: `Move ${files.length} selected files to Trash?`,
          detail:
            (mode === 'metadata'
              ? 'These are possible duplicates based on tags and duration, not verified identical recordings.\n\n'
              : '') +
            files.map((f) => f.path).join('\n') +
            '\n\nTheir playlist entries will also be removed. Restore music files through your system Trash if needed.',
          buttons: ['Cancel', 'Move to Trash'],
          defaultId: 0,
          cancelId: 0,
        });
        return answer.response === 1;
      },
      trash: (file) => shell.trashItem(file),
      onRemoved: async (removed) => {
        const ids = new Set(removed);
        db.tracks = db.tracks.filter((t) => !ids.has(t.id));
        libraryRepair.replaceTrackReferences(
          db,
          Object.fromEntries(removed.map((id) => [id, null])),
        );
        index();
        await save();
      },
    });
    return { ...result, state: snapshot() };
  });
  handle('delete-files', async (ids) => {
    const result = await deleteSelectedFiles(db, ids, async (files) => {
      const answer = await dialog.showMessageBox(win, {
        type: 'warning',
        title: 'Delete music files permanently',
        message: `Permanently delete ${files.length} music ${files.length === 1 ? 'file' : 'files'}?`,
        detail:
          'This cannot be undone. Files will not go to Trash. Their playlist and queue entries will be removed. Empty album and artist folders will also be removed; the library folder stays.\n\n' +
          files
            .slice(0, 20)
            .map((file) => file.path)
            .join('\n') +
          (files.length > 20 ? `\n… and ${files.length - 20} more files` : ''),
        buttons: ['Cancel', 'Delete permanently'],
        defaultId: 0,
        cancelId: 0,
      });
      return answer.response === 1;
    });
    if (result.removed.length) {
      const removed = new Set(result.removed);
      db.tracks = db.tracks.filter((track) => !removed.has(track.id));
      libraryRepair.replaceTrackReferences(
        db,
        Object.fromEntries(result.removed.map((id) => [id, null])),
      );
      index();
      await save();
    }
    return { ...result, state: snapshot() };
  });
  handle('preview-file-names', async (ids, config) => naming.preview(ids, config, db));
  handle('apply-file-names', async (token, selectedIds) => {
    const result = await naming.apply(token, commitNames, selectedIds);
    return { ...result, state: snapshot() };
  });
  handle('restore-file-names', async (token, redo) => {
    if (typeof token !== 'string' || typeof redo !== 'boolean')
      throw Error('Invalid rename history.');
    const affected = await naming.restore(token, redo, commitNames);
    return { state: snapshot(), affected };
  });
  handle('merge-tag-undo', async (tokens) => {
    if (!Array.isArray(tokens) || tokens.some((t) => typeof t !== 'string'))
      throw Error('Invalid tag history.');
    return tagHistory.merge(tokens);
  });
  handle('restore-tag-edit', async (token, redo) => {
    if (typeof token !== 'string' || typeof redo !== 'boolean') throw Error('Invalid tag history.');
    const ids = await tagHistory.restore(token, redo, (id) => trackIndex.get(id)?.path);
    try {
      for (const id of ids) trackIndex.get(id).mtime = -1;
      for (const libraryId of new Set(ids.map((id) => trackIndex.get(id).libraryId)))
        await importLibrary(
          db.libraries.find((l) => l.id === libraryId),
          ids
            .map((id) => trackIndex.get(id))
            .filter((t) => t.libraryId === libraryId)
            .map((t) => t.path),
        );
      return { state: snapshot(), saved: ids };
    } catch (error) {
      await tagHistory.restore(token, !redo, (id) => trackIndex.get(id)?.path);
      throw error;
    }
  });
  handle('add-library', async (name) => {
    name = validName(name);
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      properties: ['openDirectory'],
      title: 'Choose a music folder',
    });
    if (canceled) return null;
    const root = await fs.realpath(filePaths[0]);
    if (db.libraries.some((l) => l.root === root))
      throw new Error('This folder is already a library.');
    const library = { id: randomUUID(), name, root };
    db.libraries.push(library);
    return importLibrary(library);
  });
  ipcMain.handle('decode-gapless', async (event, id, sampleRate) => {
    check(event);
    const track = trackIndex.get(id);
    if (!track) throw new Error('Track not found.');
    return gaplessDecoder.decode(track, sampleRate);
  });
  ipcMain.handle('cancel-gapless', (event) => {
    check(event);
    gaplessDecoder.cancel();
  });
  handle('refresh-libraries', async () => {
    const before = JSON.stringify(db.tracks),
      warnings = [];
    for (const library of db.libraries) {
      try {
        if (library.importedFiles) {
          const known = db.tracks.filter((t) => t.libraryId === library.id),
            external = await changedTracks(known),
            ids = new Set([...external.missing, ...external.unavailable]);
          known.forEach((t) => (t.missing = ids.has(t.id)));
          const files = external.changed.get(library.id) || [];
          if (files.length) await importLibrary(library, files, false, true);
        } else await importLibrary(library, null, false, true);
      } catch (error) {
        warnings.push({ libraryId: library.id, message: error.message });
        const missing = await libraryRepair.findMissing(
          db.tracks.filter((t) => t.libraryId === library.id),
        );
        const ids = new Set(missing.map((t) => t.id));
        for (const track of db.tracks)
          if (track.libraryId === library.id) track.missing = ids.has(track.id);
      }
    }
    index();
    const changed = JSON.stringify(db.tracks) !== before;
    if (changed) await save();
    return { state: snapshot(), changed, warnings };
  });
  handle('missing-files', async () => {
    const missing = await libraryRepair.findMissing(db.tracks),
      ids = new Set(missing.map((t) => t.id));
    db.tracks = db.tracks.map((t) => ({ ...t, missing: ids.has(t.id) }));
    index();
    await save();
    const available = db.tracks.filter((t) => !ids.has(t.id));
    return {
      state: snapshot(),
      missing: missing.map((t) => ({
        ...t,
        candidates: libraryRepair.suggestedMatches(trackIndex.get(t.id), available),
      })),
    };
  });
  handle('repair-missing-track', async (id, action, candidateId = null) => {
    const track = trackIndex.get(id),
      library = db.libraries.find((l) => l.id === track?.libraryId);
    if (!track || !library) throw Error('Track no longer exists in the library.');
    await libraryRepair.requireMissing(track);
    let remap = {},
      updated;
    if (action === 'reconnect') {
      let filename;
      if (candidateId) {
        const candidate = trackIndex.get(candidateId);
        if (!candidate || candidate.libraryId !== library.id)
          throw Error('Suggested file no longer exists in this library.');
        filename = candidate.path;
      } else {
        const chosen = await dialog.showOpenDialog(win, {
          title: 'Locate ' + track.title,
          properties: ['openFile'],
          filters: [
            {
              name: 'Audio',
              extensions: ['mp3', 'flac', 'wav', 'ogg', 'm4a', 'aac', 'opus', 'aiff'],
            },
          ],
        });
        if (chosen.canceled) return null;
        filename = chosen.filePaths[0];
      }
      const plan = await libraryRepair.planTrackReconnect(library, track, filename, db.tracks);
      const answer = await dialog.showMessageBox(win, {
        type: 'question',
        title: 'Reconnect missing file',
        message: 'Use this file for ' + track.title + '?',
        detail:
          track.path +
          '\n→ ' +
          plan.file +
          '\n\n' +
          (plan.duplicates.length
            ? 'The replacement is already indexed. Merge its references into the original entry, preserving playlists and using the replacement file’s current tags and rating.'
            : 'Keep the original track ID and playlist references, using this file’s current tags and rating.') +
          ' No music is moved or deleted.',
        buttons: ['Cancel', 'Reconnect'],
        defaultId: 0,
        cancelId: 0,
      });
      if (answer.response !== 1) return null;
      await libraryRepair.requireMissing(track);
      const info = await fs.stat(plan.file);
      if (info.size !== plan.size || info.mtimeMs !== plan.mtime)
        throw Error('The selected file changed while reconnecting. Please try again.');
      const scanned = await scan(
        library,
        [plan.file],
        [{ ...track, path: plan.file, mtime: -1, size: -1 }],
      );
      if (scanned.warnings || scanned.tracks.length !== 1)
        throw Error(
          'The selected file could not be read. Wait for syncing to finish or choose another file.',
        );
      updated = scanned.tracks[0];
      const verified = await fs.stat(plan.file);
      if (verified.size !== plan.size || verified.mtimeMs !== plan.mtime)
        throw Error('The selected file changed while reconnecting. Please try again.');
      remap = Object.fromEntries(plan.duplicates.map((duplicate) => [duplicate, id]));
      db.tracks = db.tracks.filter((t) => t.id !== id && !Object.hasOwn(remap, t.id));
      db.tracks.push(updated);
      libraryRepair.replaceTrackReferences(db, remap);
      delete db.pendingRatings?.[id];
      if (updated.codec === 'MP3') {
        if (updated.tagRating) db.ratings[id] = updated.tagRating;
        else delete db.ratings[id];
      }
    } else if (action === 'forget') {
      const answer = await dialog.showMessageBox(win, {
        type: 'question',
        title: 'Forget missing entry',
        message: 'Forget ' + track.title + '?',
        detail:
          track.path +
          '\n\nRemove only this missing record and its references from playlists and the play queue. No music file is deleted. You can reconnect instead to keep the original playlist references.',
        buttons: ['Cancel', 'Forget entry'],
        defaultId: 0,
        cancelId: 0,
      });
      if (answer.response !== 1) return null;
      await libraryRepair.requireMissing(track);
      remap = { [id]: null };
      db.tracks = db.tracks.filter((t) => t.id !== id);
      libraryRepair.replaceTrackReferences(db, remap);
    } else throw Error('Unknown missing-file action.');
    index();
    await save();
    const map = (value) => (Object.hasOwn(remap, value) ? remap[value] : value);
    for (const key of Object.keys(playbackHistory)) {
      const value = map(playbackHistory[key]);
      if (value) playbackHistory[key] = value;
      else delete playbackHistory[key];
    }
    if (playbackSession) {
      const value = map(playbackSession.id);
      playbackSession = value ? { ...playbackSession, id: value } : null;
    }
    if (browsingSession?.groups?.tracks) {
      const group = browsingSession.groups.tracks;
      group.keys = [...new Set(group.keys.map(map).filter(Boolean))];
      group.current = map(group.current);
      group.anchor = map(group.anchor);
    }
    const writes = await Promise.allSettled(
      [
        ['playback-history.json', playbackHistory],
        ['playback-session.json', playbackSession],
        ['browsing-session.json', browsingSession],
      ].map(async ([name, value]) => {
        const file = path.join(app.getPath('userData'), name);
        await fs.writeFile(file + '.tmp', JSON.stringify(value));
        await fs.rename(file + '.tmp', file);
      }),
    );
    return {
      state: snapshot(),
      remap,
      notice: writes.some((r) => r.status === 'rejected')
        ? 'The library was repaired, but a session file could not be saved. Close the app normally to save the current session.'
        : '',
    };
  });
  handle('reconnect-library', async (id) => {
    const library = db.libraries.find((l) => l.id === id);
    if (!library) throw new Error('Library not found.');
    const chosen = await dialog.showOpenDialog(win, {
      title: 'Choose the new location of ' + library.name,
      properties: ['openDirectory'],
    });
    if (chosen.canceled) return null;
    const root = await fs.realpath(chosen.filePaths[0]);
    if (db.libraries.some((l) => l.id !== id && l.root === root))
      throw new Error('This folder is already another library.');
    const plan = await libraryRepair.planReconnect(
      library,
      db.tracks.filter((t) => t.libraryId === id),
      root,
    );
    const answer = await dialog.showMessageBox(win, {
      type: 'question',
      title: 'Reconnect library',
      message: `Reconnect ${library.name}?`,
      detail: `${plan.matches} matching files; ${plan.missing} still missing. Playlists, ratings and track IDs will be preserved. Files are matched by their paths within the library. Sizes are checked when available; older backups use song details and duration. No music is moved or deleted.\n\n${root}`,
      buttons: ['Cancel', 'Reconnect'],
      defaultId: 0,
      cancelId: 0,
    });
    if (answer.response !== 1) return null;
    library.root = root;
    db.tracks = db.tracks.filter((t) => t.libraryId !== id).concat(plan.tracks);
    return importLibrary(library);
  });
  handle('rescan', async (id) => {
    const library = db.libraries.find((l) => l.id === id);
    if (!library) throw new Error('Library not found');
    return importLibrary(library);
  });
  handle('delete-library', async (id) => {
    if (!db.libraries.some((l) => l.id === id)) throw new Error('Library not found');
    const removed = new Set(db.tracks.filter((t) => t.libraryId === id).map((t) => t.id));
    db.libraries = db.libraries.filter((l) => l.id !== id);
    db.tracks = db.tracks.filter((t) => t.libraryId !== id);
    for (const playlist of db.playlists)
      playlist.trackIds = playlist.trackIds.filter((trackId) => !removed.has(trackId));
    for (const trackId of removed) {
      delete db.ratings[trackId];
      delete db.pendingRatings[trackId];
    }
    index();
    await save();
    return snapshot();
  });
  handle('rename-library', async (id, name) => {
    const library = db.libraries.find((l) => l.id === id);
    if (!library) throw new Error('Library not found');
    library.name = validName(name);
    await save();
    return snapshot();
  });
  handle('import-playlist-files', async (id, paths) => {
    const playlist = db.playlists.find((p) => p.id === id);
    if (!playlist || playlist.dynamic?.enabled) throw new Error('Choose a regular playlist.');
    if (
      !Array.isArray(paths) ||
      paths.length > 10000 ||
      paths.some((p) => typeof p !== 'string' || !path.isAbsolute(p))
    )
      throw new Error('Invalid audio files.');
    const extensions = new Set([
        '.mp3',
        '.flac',
        '.wav',
        '.ogg',
        '.m4a',
        '.aac',
        '.opus',
        '.aiff',
        '.aif',
      ]),
      ids = [],
      canonical = [],
      groups = new Map();
    for (const input of paths) {
      if (!extensions.has(path.extname(input).toLowerCase())) continue;
      const filename = await fs.realpath(input);
      if (!(await fs.stat(filename)).isFile()) continue;
      canonical.push(filename);
      const existing = db.tracks.find((t) => t.path === filename);
      if (existing) {
        ids.push(existing.id);
        continue;
      }
      const root = path.dirname(filename);
      if (!groups.has(root)) groups.set(root, []);
      groups.get(root).push(filename);
    }
    for (const [root, files] of groups) {
      let library =
        db.libraries
          .filter(
            (l) =>
              !l.importedFiles &&
              (() => {
                const relative = path.relative(l.root, root);
                return (
                  relative === '' ||
                  (!relative.startsWith('..' + path.sep) &&
                    relative !== '..' &&
                    !path.isAbsolute(relative))
                );
              })(),
          )
          .sort((a, b) => b.root.length - a.root.length)[0] ||
        db.libraries.find((l) => l.importedFiles && l.root === root);
      if (!library) {
        library = { id: randomUUID(), root, name: 'Imported files', importedFiles: true };
        db.libraries.push(library);
      }
      const result = await scan(library, [...new Set(files)]);
      db.tracks.push(...result.tracks);
      for (const track of result.tracks) {
        ids.push(track.id);
        if (track.tagRating) db.ratings[track.id] = track.tagRating;
      }
    }
    // Preserve file-browser order across existing tracks and newly indexed groups.
    const ordered = canonical.map((p) => db.tracks.find((t) => t.path === p)?.id).filter(Boolean);
    for (const trackId of [...ordered, ...ids])
      if (!playlist.trackIds.includes(trackId)) playlist.trackIds.push(trackId);
    index();
    await save();
    return { state: snapshot() };
  });
  handle('playlist', async (action) => {
    if (!action || typeof action !== 'object') throw new Error('Invalid action');
    const configuration = () => {
      const dynamic = playlistRules.validateDynamic(action.dynamic);
      if (
        dynamic.enabled &&
        dynamic.libraryId &&
        !db.libraries.some((l) => l.id === dynamic.libraryId)
      )
        throw new Error('Choose an existing source library.');
      if (action.browse !== undefined && typeof action.browse !== 'boolean')
        throw new Error('Invalid playlist browsing setting.');
      return { dynamic, ...(action.browse !== undefined ? { browse: action.browse } : {}) };
    };
    if (action.type === 'create') {
      const config = action.dynamic ? configuration() : {};
      let ids = [];
      if (action.trackIds !== undefined) {
        if (
          !Array.isArray(action.trackIds) ||
          action.trackIds.some((id) => typeof id !== 'string' || !trackIndex.has(id))
        )
          throw new Error('Invalid search result tracks.');
        if (config.dynamic?.enabled)
          throw new Error('Search result playlists must be regular playlists.');
        ids = [...new Set(action.trackIds)];
      }
      db.playlists.push({
        id: randomUUID(),
        name: validName(action.name),
        trackIds: ids,
        ...config,
      });
    } else if (action.type === 'reorder') {
      if (
        !Array.isArray(action.ids) ||
        action.ids.length !== db.playlists.length ||
        new Set(action.ids).size !== db.playlists.length ||
        action.ids.some((id) => !db.playlists.some((p) => p.id === id))
      )
        throw new Error('Invalid playlist order');
      db.playlists = action.ids.map((id) => db.playlists.find((p) => p.id === id));
    } else {
      const playlist = db.playlists.find((p) => p.id === action.id);
      if (!playlist) throw new Error('Playlist not found');
      if (action.type === 'rename') playlist.name = validName(action.name);
      else if (action.type === 'delete')
        db.playlists = db.playlists.filter((p) => p.id !== action.id);
      else if (action.type === 'configure') {
        const config = configuration();
        if (playlist.dynamic?.enabled && !config.dynamic.enabled)
          playlist.trackIds = playlistRules
            .matchingTracks(collectionView(), playlist.dynamic)
            .map((t) => t.id);
        if (action.name !== undefined) playlist.name = validName(action.name);
        Object.assign(playlist, config);
      } else if (action.type === 'tracks') {
        if (playlist.dynamic?.enabled)
          throw new Error('This playlist is controlled by its filter rules.');
        if (!Array.isArray(action.trackIds) || action.trackIds.some((id) => !trackIndex.has(id)))
          throw new Error('Invalid tracks');
        playlist.trackIds = [...new Set(action.trackIds)];
      } else throw new Error('Invalid action');
    }
    await save();
    return snapshot();
  });
  let restoredBounds = {};
  if (browsingSession?.window) {
    const bounds = browsingSession.window.bounds,
      area = screen?.getDisplayMatching(bounds)?.workArea;
    if (area)
      restoredBounds = {
        width: Math.max(1044, Math.min(bounds.width, area.width)),
        height: Math.max(740, Math.min(bounds.height, area.height)),
      };
    if (area) {
      restoredBounds.x = Math.max(
        area.x,
        Math.min(bounds.x, area.x + area.width - restoredBounds.width),
      );
      restoredBounds.y = Math.max(
        area.y,
        Math.min(bounds.y, area.y + area.height - restoredBounds.height),
      );
    }
  }
  win = new BrowserWindow({
    show: false,
    width: 1180,
    height: 760,
    ...restoredBounds,
    minWidth: 1044,
    minHeight: 740,
    backgroundColor: '#101213',
    title: 'Localtone',
    icon: path.join(__dirname, 'build/icon.png'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  if (browsingSession?.window?.maximized) win.maximize();
  // Never expose fallback markup or colors before saved preferences are applied.
  ipcMain.on('ui-ready', (event) => {
    check(event);
    if (!win.isDestroyed()) win.show();
  });
  // Content-driven desktop minimum, including platform window decorations.
  ipcMain.on?.('layout-minimum', (event, width, height = 740) => {
    check(event);
    if (
      !Number.isInteger(width) ||
      width < 900 ||
      width > 1500 ||
      !Number.isInteger(height) ||
      height < 740 ||
      height > 3000
    )
      return;
    const [outerWidth, outerHeight] = win.getSize(),
      [contentWidth, contentHeight] = win.getContentSize();
    const minimum = width + Math.max(0, outerWidth - contentWidth);
    const minimumHeight = height + Math.max(0, outerHeight - contentHeight);
    if (miniMode || motionActive) return;
    normalMinimum = [minimum, minimumHeight];
    win.setMinimumSize(minimum, minimumHeight);
    if (outerWidth < minimum || outerHeight < minimumHeight)
      win.setSize(Math.max(minimum, outerWidth), Math.max(minimumHeight, outerHeight));
  });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (event) => event.preventDefault());
  try {
    playbackShortcuts.set(db.settings.globalPlaybackShortcuts, db.settings.shortcuts);
  } catch {}
  const external = await changedTracks(db.tracks);
  startupRefresh.unavailable = external.unavailable.length;
  const missingIds = new Set([...external.missing, ...external.unavailable]);
  let missingChanged = false;
  for (const track of db.tracks)
    if (missingIds.has(track.id) && !track.missing) {
      track.missing = true;
      missingChanged = true;
    }
  for (const library of db.libraries) {
    const files = [
        ...new Set([
          ...(external.changed.get(library.id) || []),
          ...(library.importedFiles
            ? db.tracks
                .filter(
                  (t) => t.libraryId === library.id && !t.missing && typeof t.discRaw !== 'string',
                )
                .map((t) => t.path)
            : []),
        ]),
      ],
      beforeIds = new Set(db.tracks.map((t) => t.id));
    try {
      if (library.importedFiles && !files.length) continue;
      const result = await importLibrary(
        library,
        library.importedFiles ? files : null,
        false,
        true,
      );
      startupRefresh.changed +=
        files.length +
        db.tracks.filter((t) => t.libraryId === library.id && !beforeIds.has(t.id)).length;
      if (result.warnings)
        startupRefresh.warnings.push(
          `${library.name}: ${result.warnings} file(s) could not be read; retry after syncing finishes.`,
        );
    } catch (error) {
      startupRefresh.warnings.push(`${library.name}: ${error.message}`);
    }
  }
  if (missingChanged) await save();
  await win.loadURL('localtone://app/index.html');
});
app.on('will-quit', () => playbackShortcuts.set(false));
app.on('before-quit', (event) => {
  gaplessDecoder.cancel();
  waveforms?.cancel();
  if (!quitting) {
    event.preventDefault();
    quitting = true;
    Promise.allSettled([
      onlineUpdates.shutdown(),
      historyWrites,
      lastfm?.close(),
      (async () => {
        while (busy) await new Promise((resolve) => setTimeout(resolve, 25));
        await tagHistory?.cleanup();
      })(),
    ]).finally(() => app.quit());
  }
});
app.on('window-all-closed', () => app.quit());
