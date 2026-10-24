const startupStarted = Date.now();
let appReadyAt = 0,
  windowLoadAt = 0;
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
  normalVisualBounds = null;
const gaplessDecoder = new (require('./gapless-decoder.cjs').GaplessDecoder)(
  require('ffmpeg-static'),
);
const streamDecoder = new (require('./stream-decoder.cjs').StreamDecoder)(
  require('ffmpeg-static'),
  { directory: () => path.join(app.getPath('userData'), 'playback-edits') },
);
const duplicates = require('./duplicates.cjs').createDuplicates();
const numberActions = require('../app/rules/number-actions.js');
const libraryRepair = require('./library-repair.cjs');
const { validateFilters, compileFilters } = require('./library-filters.cjs');
const { deleteSelectedFiles } = require('./delete-files.cjs');
const fileNaming = require('./file-naming.cjs'),
  naming = fileNaming.createFileNaming();
const settingsTransfer = require('./settings-transfer.cjs');
const { changedTracks } = require('./startup-refresh.cjs');
const { replaceFile, replaceFileSync } = require('./replace-file.cjs');
const { cleanUnusedCache } = require('./cache-cleanup.cjs');
let startupRefresh = { changed: 0, unavailable: 0, warnings: [] };
let startupReady = Promise.resolve();
const { validateSession, validatePlaybackSession } = require('./browsing-session.cjs');
let browsingSession = null,
  rendererReady = false,
  finishSessionSave = null,
  quitJob = null;
const { createQueueWindow, createBoundsMemory, setStableBounds } = require('./queue-window.cjs');
const queueWindow = createQueueWindow();
const miniBoundsMemory = createBoundsMemory();
let normalFrame = null;
const fs = require('node:fs/promises');
const path = require('node:path');
const projectRoot = path.join(__dirname, '..');
const { pathToFileURL } = require('node:url');
const { randomUUID } = require('node:crypto');
const { Worker } = require('node:worker_threads');
require('../app/rules/search.js');
const playlistRules = require('../app/rules/playlist-rules.js');
const { validateIcon } = require('../app/rules/playlist-icons.js');
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
  lastfmReady,
  tagHistory,
  quitting = false;
const { createAudioSources } = require('./media.cjs');
const audioSources = createAudioSources({
  directory: () => path.join(app.getPath('userData'), 'playback-audio'),
});
const ratingTags = require('./rating-tags.cjs');
const tagEditor = require('./tags.cjs');
const musicbrainz = require('./musicbrainz.cjs').createMusicBrainz({
  fetch: (...args) => net.fetch(...args),
  userAgent: `Localtone/${app.getVersion()} (${require('../package.json').homepage})`,
});
const { normalizeSettings, validateSettings, validateRating } = require('./preferences.cjs');
if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}
if (typeof app.setPath === 'function') {
  try {
    // Source runs keep Localtone-data at the project root, beside package.json.
    portableStorage.configurePortable(app, projectRoot);
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
// ---- Detached mini window (all platforms) ------------------------------------------
// Mini mode never resizes the main window. A small, always-rendered window shows a live
// mirror of the player. Windows and macOS keep both windows shown and swap which one
// is opaque (no show/hide animation, no redraw). Linux window managers ignore window
// opacity, so there the two windows swap by showing and hiding instead.
const swapByVisibility = process.platform === 'linux';
const detachedMini = { window: null, ready: null, loaded: false, active: false, lastSync: null };
let paintProbeId = 0;
const paintProbes = new Map();
function waitPainted(contents, timeout = 300) {
  return new Promise((resolve) => {
    const id = ++paintProbeId;
    const timer = setTimeout(() => {
      paintProbes.delete(id);
      resolve(false);
    }, timeout);
    paintProbes.set(id, {
      contents,
      done: () => {
        clearTimeout(timer);
        resolve(true);
      },
    });
    contents.send('paint-probe', id);
  });
}
function createDetachedMini() {
  if (detachedMini.window && !detachedMini.window.isDestroyed()) return detachedMini.ready;
  const mini = new BrowserWindow({
    show: false,
    // Windows: owned by the main window, so the app keeps one taskbar button. macOS
    // child windows move together with their parent, which would drag the mini player
    // along when the full window follows it; Linux hides the main window during mini
    // mode. So elsewhere the mini window stands on its own.
    ...(process.platform === 'win32' ? { parent: win } : {}),
    useContentSize: true,
    width: 244,
    height: 360,
    opacity: 0,
    // Windows: same frame style as the main window (resizable keeps the same border
    // width), with resizing itself blocked below. Elsewhere it is simply not resizable.
    resizable: process.platform === 'win32',
    maximizable: false,
    fullscreenable: false,
    backgroundColor: '#101213',
    title: 'Localtone',
    icon: path.join(projectRoot, 'build/icon.png'),
    autoHideMenuBar: true,
    paintWhenInitiallyHidden: true,
    webPreferences: {
      preload: path.join(__dirname, 'mini-preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
    },
  });
  detachedMini.window = mini;
  mini.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mini.webContents.on('will-navigate', (event) => event.preventDefault());
  mini.on('will-resize', (event) => event.preventDefault());
  mini.on('close', (event) => {
    if (!quitting) {
      event.preventDefault();
      app.quit();
    }
  });
  // An owned window would minimize to a stub; minimize the app (main window) instead,
  // which hides the owned mini window with it.
  if (process.platform === 'win32')
    mini.on('minimize', () => {
      mini.restore();
      win?.minimize();
    });
  mini.on('closed', () => {
    if (detachedMini.window === mini)
      Object.assign(detachedMini, { window: null, ready: null, loaded: false });
  });
  detachedMini.ready = (async () => {
    await mini.loadURL('localtone://app/mini.html');
    detachedMini.loaded = true;
    if (detachedMini.lastSync) mini.webContents.send('mini-sync', detachedMini.lastSync);
    if (swapByVisibility) return;
    mini.setIgnoreMouseEvents(true);
    mini.showInactive();
    // Let the OS finish its window-show transition while the window is transparent.
    await new Promise((resolve) => setTimeout(resolve, 300));
  })();
  return detachedMini.ready;
}
// Place the mini window so its client area shares the main window's bottom-left
// client corner to the physical pixel. Bounds are integer DIPs, which at fractional
// scaling (e.g. 130%) round to physical pixels; so candidates are evaluated with the
// same DIP->physical conversion Electron uses for setBounds, and the main window's
// exact client size comes from its renderer (fractional CSS viewport x scale).
function physicalRect(target, rect) {
  return typeof screen?.dipToScreenRect === 'function'
    ? screen.dipToScreenRect(target, rect)
    : rect;
}
function placeDetachedMini(mini, size) {
  const width = Math.round(Math.max(140, Math.min(400, Number(size?.width) || 244))),
    height = Math.round(Math.max(120, Math.min(800, Number(size?.height) || 360)));
  const scale = Number(size?.scale),
    clientWidth = Number(size?.clientWidth),
    clientHeight = Number(size?.clientHeight);
  const fallback = () => {
    const content = win.getContentBounds();
    mini.setContentBounds({ x: content.x, y: content.y + content.height - height, width, height });
  };
  if (
    typeof screen?.dipToScreenRect !== 'function' ||
    !(scale >= 1 && scale <= 4) ||
    !(clientWidth > 0) ||
    !(clientHeight > 0)
  )
    return fallback();
  const bounds = win.getBounds(),
    main = physicalRect(win, bounds),
    frameWidth = main.width - Math.round(clientWidth * scale),
    frameHeight = main.height - Math.round(clientHeight * scale),
    bottom = main.y + main.height,
    needWidth = Math.ceil(width * scale - 0.01),
    needHeight = Math.ceil(height * scale - 0.01);
  if (frameWidth < 0 || frameHeight < 0) return fallback();
  const w0 = Math.round((needWidth + frameWidth) / scale),
    h0 = Math.round((needHeight + frameHeight) / scale);
  let best = null;
  for (let h = h0 - 1; h <= h0 + 3; h++)
    for (let w = w0 - 1; w <= w0 + 3; w++) {
      const y0 = Math.round(bottom / scale - h);
      for (const dy of [0, -1, 1, -2, 2]) {
        const rect = { x: bounds.x, y: y0 + dy, width: w, height: h },
          physical = physicalRect(null, rect);
        if (physical.x !== main.x || physical.y + physical.height !== bottom) continue;
        if (physical.width - frameWidth < needWidth || physical.height - frameHeight < needHeight)
          continue;
        const area = physical.width + physical.height;
        if (!best || area < best.area) best = { rect, area };
      }
    }
  if (!best) return fallback();
  // Windows can still land the window a pixel or two away from the requested rect
  // (seen at 130%: 2px low). Read back where it went and correct until the physical
  // bottom-left corner matches the main window's.
  const attempts = [];
  let request = best.rect;
  for (let i = 0; i < 4; i++) {
    mini.setBounds(request);
    const actual = mini.getBounds(),
      physical = physicalRect(mini, actual),
      errorX = main.x - physical.x,
      errorBottom = bottom - (physical.y + physical.height);
    attempts.push({ request, actual, physical });
    if (!errorX && !errorBottom) break;
    const step = (error) =>
      error ? Math.sign(error) * Math.max(1, Math.round(Math.abs(error) / scale)) : 0;
    request = { ...request, x: request.x + step(errorX), y: request.y + step(errorBottom) };
  }
  detachedMini.lastPlacement = { target: { x: main.x, bottom }, frameWidth, frameHeight, attempts };
}
// If the mini window was moved, move the (transparent) main window by the same amount
// so the full view comes back where the mini player is, kept on that screen.
function followMiniPosition(mini) {
  const placed = detachedMini.placed,
    now = mini.getBounds();
  if (!placed || normalMaximized || win.isMaximized()) return;
  const dx = now.x - placed.x,
    dy = now.y - placed.y;
  if (!dx && !dy) return;
  const bounds = win.getBounds(),
    area = screen?.getDisplayMatching?.(now)?.workArea;
  let x = bounds.x + dx,
    y = bounds.y + dy;
  if (area) {
    if (bounds.width <= area.width)
      x = Math.min(Math.max(x, area.x), area.x + area.width - bounds.width);
    if (bounds.height <= area.height)
      y = Math.min(Math.max(y, area.y), area.y + area.height - bounds.height);
  }
  win.setBounds({ ...bounds, x, y });
}
async function toggleDetachedMini(size) {
  await createDetachedMini();
  const mini = detachedMini.window;
  if (!detachedMini.active) {
    normalMaximized = win.isMaximized();
    placeDetachedMini(mini, size);
    detachedMini.placed = mini.getBounds();
    // The main renderer sent the mirror before this request; wait until it is drawn.
    await waitPainted(mini.webContents);
    if (swapByVisibility) {
      mini.setOpacity(1);
      mini.show();
      win.hide();
    } else {
      mini.setOpacity(1);
      mini.setIgnoreMouseEvents(false);
      win.setOpacity(0);
      win.setIgnoreMouseEvents(true);
    }
    detachedMini.active = miniMode = true;
    mini.focus();
  } else {
    followMiniPosition(mini);
    if (swapByVisibility) {
      win.show();
      mini.hide();
    } else {
      win.setIgnoreMouseEvents(false);
      win.setOpacity(1);
      mini.setOpacity(0);
      mini.setIgnoreMouseEvents(true);
    }
    detachedMini.active = miniMode = false;
    detachedMini.placed = null;
    win.focus();
  }
  return detachedMini.active;
}
app.on('second-instance', () => {
  if (detachedMini.active && detachedMini.window && !detachedMini.window.isDestroyed()) {
    if (win?.isMinimized()) win.restore();
    detachedMini.window.focus();
  } else if (win) {
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
  statePath,
  covers,
  busy = false,
  trackIndex = new Map();
const fresh = () => ({ libraries: [], tracks: [], playlists: [] });
function index() {
  trackIndex = new Map(db.tracks.map((t) => [t.id, t]));
}
// Settings and ratings change often but are tiny next to the track list, so they are
// also kept in collection-state.json. saveLight() rewrites only that file; save()
// rewrites both (state first, so the state file is never older than the collection).
// On load the state file is applied only when it is at least as new as
// collection.json, which keeps collection.json authoritative after a full save, after
// a restore from backup, and for older Localtone versions.
const lightKeys = ['settings', 'ratings', 'pendingRatings', 'ratingStorageVersion'];
let writeLane = Promise.resolve();
function serialWrite(task) {
  // One writer at a time: concurrent saves would otherwise share the same .tmp file.
  const run = writeLane.catch(() => {}).then(task);
  writeLane = run.catch(() => {});
  return run;
}
async function writeAtomic(file, data) {
  await fs.writeFile(file + '.tmp', data);
  await replaceFile(file + '.tmp', file);
}
const lightState = () =>
  JSON.stringify({ version: 1, ...Object.fromEntries(lightKeys.map((key) => [key, db[key]])) });
function saveLight() {
  return serialWrite(() => writeAtomic(statePath, lightState()));
}
function save() {
  return serialWrite(async () => {
    await writeAtomic(statePath, lightState());
    await writeAtomic(dbPath, JSON.stringify(db));
  });
}
async function applyLightState() {
  let light, lightTime, collectionTime;
  try {
    [light, lightTime] = await Promise.all([
      fs.readFile(statePath, 'utf8'),
      fs.stat(statePath).then((info) => info.mtimeMs),
    ]);
    light = JSON.parse(light);
  } catch (error) {
    if (error.code !== 'ENOENT')
      console.warn('Ignoring unreadable collection-state.json:', error.message);
    return;
  }
  try {
    collectionTime = (await fs.stat(dbPath)).mtimeMs;
  } catch {
    collectionTime = -Infinity;
  }
  if (!light || light.version !== 1 || lightTime < collectionTime) return;
  const isRecord = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
  if (isRecord(light.settings)) db.settings = light.settings;
  if (isRecord(light.ratings)) db.ratings = light.ratings;
  if (isRecord(light.pendingRatings)) db.pendingRatings = light.pendingRatings;
  if (light.ratingStorageVersion === 1) db.ratingStorageVersion = 1;
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
// Default rollback: a deep copy of the whole collection. That costs a full clone of
// every track per call, so handlers that never touch db pass `backup: null`, and
// handlers with a small, known footprint pass a narrower backup that returns its
// own restore function.
function fullBackup() {
  const before = structuredClone(db);
  return () => {
    db = before;
    index();
  };
}
// Collection changes run one at a time. A request that arrives while another is
// running (for example the quiet library refresh that runs on window focus and every
// 30 s) now waits its turn instead of failing with "please wait".
let collectionLane = Promise.resolve();
const quittingError = () =>
  new Error('Localtone is updating your music or saving changes. Please wait a moment.');
function handle(name, fn, { backup = fullBackup } = {}) {
  ipcMain.handle(name, async (event, ...args) => {
    check(event);
    await startupReady;
    if (quitting) throw quittingError();
    const run = collectionLane.then(async () => {
      if (quitting) throw quittingError();
      busy = true;
      let restore;
      try {
        restore = backup?.(...args);
        return await fn(...args);
      } catch (error) {
        restore?.();
        throw error;
      } finally {
        busy = false;
      }
    });
    collectionLane = run.catch(() => {});
    return run;
  });
}
const readOnly = { backup: null };
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
        filters: library.filters,
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
async function importLibrary(
  library,
  files = null,
  preserveRatings = false,
  quiet = false,
  { withState = true } = {},
) {
  const before = quiet ? JSON.stringify(db) : null;
  const result = await scan(library, files, undefined, quiet);
  if (files) {
    const updates = new Map(result.tracks.map((t) => [t.id, t]));
    db.tracks = db.tracks.map((t) => updates.get(t.id) || t);
  } else {
    const excluded = compileFilters(library.root, library.filters);
    const found = new Set(result.tracks.map((t) => t.id)),
      missing = db.tracks
        .filter((t) => t.libraryId === library.id && !found.has(t.id))
        .map((t) => ({
          ...t,
          excluded: excluded(t.path),
          missing: excluded(t.path) ? false : true,
        }));
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
  // Building the renderer snapshot is a full pass over the collection; skip it for
  // callers that only need the warnings.
  return { ...(withState ? { state: snapshot() } : {}), warnings: result.warnings };
}
function validName(name) {
  if (typeof name !== 'string' || !name.trim() || name.length > 100)
    throw new Error('Use a name between 1 and 100 characters.');
  return name.trim();
}
app.whenReady().then(async () => {
  appReadyAt = Date.now();
  dbPath = path.join(app.getPath('userData'), 'collection.json');
  statePath = path.join(app.getPath('userData'), 'collection-state.json');
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
  await applyLightState();
  try {
    playbackSession = validatePlaybackSession(
      JSON.parse(
        await fs.readFile(path.join(app.getPath('userData'), 'playback-session.json'), 'utf8'),
      ),
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
          'mini.html',
          'mini.js',
          'style.css',
          'renderer.js',
          'design-defaults.js',
          'settings-writes.js',
          'tag-editor.js',
          'playlist-editor.js',
          'playlist-icon-picker.js',
          'rules/playlist-icons.js',
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
          'progressive-audio.js',
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
      return net.fetch(pathToFileURL(path.join(projectRoot, 'app', relative)).href);
    }
    const id = url.pathname.slice(1),
      track = trackIndex.get(id);
    if (!track || !['audio', 'cover'].includes(url.host))
      return new Response('Not found', { status: 404 });
    try {
      if (url.host === 'audio') return await audioSources.serve(track.path, request);
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
  lastfmReady = lastfm.init();
  const metadataCache = new Map();
  ipcMain.handle('lastfm', async (event, action) => {
    check(event);
    await lastfmReady;
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
    await lastfmReady;
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
  ipcMain.handle('waveform', async (event, id, cachedOnly = false) => {
    check(event);
    const track = trackIndex.get(id);
    if (!track) throw new Error('Track not found.');
    return waveforms.get(track, { cachedOnly: cachedOnly === true });
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
  ipcMain.handle('load', async (event, options) => {
    check(event);
    if (options?.cached !== true) await startupReady;
    return snapshot();
  });
  ipcMain.on('save-browsing', (event, value) => {
    try {
      check(event);
      if (JSON.stringify(value).length > 2 * 1024 * 1024) throw Error('Session too large.');
      const bounds =
        miniMode && normalBounds
          ? queueWindow.baseBounds(normalBounds)
          : queueWindow.normalBounds(win);
      browsingSession = validateSession({
        ...value,
        window: { bounds, maximized: miniMode ? normalMaximized : win.isMaximized() },
      });
      const file = path.join(app.getPath('userData'), 'browsing-session.json'),
        sync = require('node:fs');
      sync.writeFileSync(file + '.tmp', JSON.stringify(browsingSession));
      replaceFileSync(file + '.tmp', file);
      event.returnValue = true;
    } catch {
      event.returnValue = false;
    }
  });
  ipcMain.on('save-playback', (event, value) => {
    try {
      check(event);
      if (JSON.stringify(value).length > 16 * 1024 * 1024) throw Error('Session too large.');
      const clean = validatePlaybackSession(value);
      if (clean.id && !trackIndex.has(clean.id)) throw Error('Invalid playback track.');
      playbackSession = clean;
      const file = path.join(app.getPath('userData'), 'playback-session.json'),
        sync = require('node:fs');
      sync.writeFileSync(file + '.tmp', JSON.stringify(playbackSession));
      replaceFileSync(file + '.tmp', file);
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
        await writeAtomic(historyPath, data);
      });
    historyWrites = write;
    await write;
    return { ...playbackHistory };
  });
  const runWindowAction = async (action, size) => {
    const animated = size?.animate === true && process.platform !== 'win32';
    const resize = (target) => {
      if (animated) return animateBounds(win, target);
      if (process.platform !== 'win32') return win.setBounds(target);
      return setStableBounds(win, target);
    };
    if (action === 'queue-open') return !miniMode && queueWindow.open(win, screen, 224, resize);
    if (action === 'queue-close') {
      // The queue is parked (not closed) while mini; leaving mini restores it.
      if (miniMode) return;
      if (queueWindow.extended) {
        normalMinimum = [Math.max(1, normalMinimum[0] - 224), normalMinimum[1]];
        win.setMinimumSize(...normalMinimum);
      }
      await queueWindow.close(win, resize);
      return;
    }
    if (action === 'mini' && size?.detached === true) return toggleDetachedMini(size);
    if (action === 'mini') {
      // An extended queue stays part of the normal bounds: mini mode shrinks straight
      // from the current window and leaving it restores the queue width as well.
      if (!miniMode) {
        const bounds = miniBoundsMemory.capture(win);
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
        if (process.platform !== 'win32') win.setResizable(true);
        await resize({
          x: bounds.x,
          y: bounds.y + bounds.height - height - frameH,
          width: width + frameW,
          height: height + frameH,
        });
        if (process.platform !== 'win32') win.setResizable(false);
      } else {
        if (process.platform !== 'win32') win.setResizable(true);
        await resize(normalMaximized ? normalVisualBounds : normalBounds);
        miniMode = false;
        win.setMinimumSize(...normalMinimum);
        if (!normalMaximized) miniBoundsMemory.remember(win, normalBounds);
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
    // Maximizing never touches the collection, so a background refresh must not block it.
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
  // Source runs only (npm start): keep the last 40 window transitions with native and
  // renderer geometry in logs/window-transitions.json, to diagnose pixel shifts.
  const transitionLog = [];
  const nativeGeometry = () => ({
    bounds: win.getBounds(),
    content: win.getContentSize(),
    physical: physicalRect(win, win.getBounds()),
    scale: screen?.getDisplayMatching?.(win.getBounds())?.scaleFactor ?? null,
    mini:
      detachedMini.window && !detachedMini.window.isDestroyed()
        ? {
            bounds: detachedMini.window.getBounds(),
            content: detachedMini.window.getContentSize(),
            physical: physicalRect(detachedMini.window, detachedMini.window.getBounds()),
          }
        : null,
    placement: detachedMini.lastPlacement ?? null,
  });
  ipcMain.on('mini-sync', (event, payload) => {
    try {
      check(event);
      if (JSON.stringify(payload).length > 2 * 1024 * 1024) return;
      // Kept so a mini window that is still loading starts from the current state.
      detachedMini.lastSync = payload;
      const mini = detachedMini.window;
      if (mini && !mini.isDestroyed() && detachedMini.loaded)
        mini.webContents.send('mini-sync', payload);
    } catch {}
  });
  ipcMain.on('mini-input', (event, input) => {
    const mini = detachedMini.window;
    if (
      !mini ||
      event.sender !== mini.webContents ||
      event.senderFrame?.url !== 'localtone://app/mini.html' ||
      !detachedMini.active ||
      !input ||
      typeof input !== 'object'
    )
      return;
    let clean = null;
    if (
      input.type === 'click' &&
      [0, 1].includes(input.root) &&
      Array.isArray(input.path) &&
      input.path.length <= 64 &&
      input.path.every((n) => Number.isInteger(n) && n >= 0 && n < 1000)
    )
      clean = { type: 'click', root: input.root, path: [...input.path] };
    else if (input.type === 'key' && typeof input.key === 'string' && input.key.length <= 32)
      clean = {
        type: 'key',
        key: input.key,
        code: typeof input.code === 'string' ? input.code.slice(0, 32) : '',
        ...Object.fromEntries(
          ['ctrlKey', 'shiftKey', 'altKey', 'metaKey', 'repeat'].map((k) => [k, input[k] === true]),
        ),
      };
    if (clean && win && !win.isDestroyed()) win.webContents.send('mini-input', clean);
  });
  ipcMain.on('paint-ack', (event, id) => {
    const probe = paintProbes.get(id);
    if (probe && probe.contents === event.sender) {
      paintProbes.delete(id);
      probe.done();
    }
  });
  ipcMain.handle('window-action', (event, action, size) => {
    check(event);
    const job = motionJobs.then(async () => {
      motionActive = true;
      const logging =
        !app.isPackaged &&
        !process.env.NODE_TEST_CONTEXT &&
        ['mini', 'queue-open', 'queue-close'].includes(action);
      const entry = logging
        ? {
            at: new Date().toISOString(),
            action,
            renderer: size?.metrics,
            before: nativeGeometry(),
          }
        : null;
      try {
        const value = await runWindowAction(action, size);
        if (entry) entry.result = value;
        return size?.report ? { value, contentSize: win.getContentSize() } : value;
      } finally {
        motionActive = false;
        if (entry) {
          entry.after = nativeGeometry();
          transitionLog.push(entry);
          if (transitionLog.length > 40) transitionLog.shift();
          const logs = path.join(app.getPath('userData'), 'logs');
          fs.mkdir(logs, { recursive: true })
            .then(() =>
              fs.writeFile(
                path.join(logs, 'window-transitions.json'),
                JSON.stringify(transitionLog, null, 1),
              ),
            )
            .catch(() => {});
        }
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
  handle(
    'clean-cache',
    async () => cleanUnusedCache(app.getPath('userData'), db.tracks, waveforms?.active?.key),
    readOnly,
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
  handle(
    'settings',
    async (patch) => {
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
        await saveLight();
        if (Object.hasOwn(clean, 'portable') && typeof app.setPath === 'function')
          portableStorage.requestMode(app, clean.portable, cleanup);
      } catch (error) {
        db.settings = before;
        try {
          playbackShortcuts.set(before.globalPlaybackShortcuts, before.shortcuts);
        } catch {}
        await saveLight();
        throw error;
      }
      win?.webContents.send('global-shortcut-status', playbackShortcuts.status());
      return db.settings;
    },
    {
      // This handler only ever replaces db.settings (it never mutates it in place).
      backup: () => {
        const settings = db.settings;
        return () => {
          db.settings = settings;
        };
      },
    },
  );
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
      // Only ratings reach disk here. The changed mtime/size of the rewritten MP3 stay
      // in memory until the next full save; if the app exits first, the next refresh
      // simply re-reads the file (and its rating tag).
      await saveLight();
    };
    let undoToken = null;
    if (track.codec === 'MP3') {
      await audioSources.beforeWrite(track.path);
      const saved = await streamDecoder.withWrite(track.path, () =>
        ratingTags.writeRating({
          file: track.path,
          rating,
          backupStore: tagHistory.store,
          onSaved: persist,
        }),
      );
      undoToken = tagHistory.register([{ id, backup: saved.backup }]);
    } else {
      if (rating) db.ratings[id] = rating;
      else delete db.ratings[id];
      await saveLight();
    }
    return { id, rating, modifiedAt: track.modifiedAt, undoToken };
  }
  // rateFile touches db.ratings, db.pendingRatings and a few fields on the tracks that
  // share the rated file's path, so back up exactly those.
  handle('rating', rateFile, {
    backup: (id) => {
      const track = trackIndex.get(id),
        ratings = { ...db.ratings },
        pendingRatings = { ...db.pendingRatings },
        keys = ['tagRating', 'mtime', 'modifiedAt', 'size'],
        tracks = track
          ? db.tracks
              .filter((t) => t.path === track.path)
              .map((t) => [t, keys.map((key) => [key, Object.hasOwn(t, key), t[key]])])
          : [];
      return () => {
        db.ratings = ratings;
        db.pendingRatings = pendingRatings;
        for (const [t, fields] of tracks)
          for (const [key, owned, value] of fields)
            if (owned) t[key] = value;
            else delete t[key];
      };
    },
  });
  handle(
    'search-web',
    async (action) => {
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
    },
    readOnly,
  );
  handle(
    'open-folder',
    async (action) => {
      if (!action || !['track', 'album', 'artist', 'library'].includes(action.kind))
        throw new Error('Invalid folder request.');
      if (action.kind === 'library') {
        const library = db.libraries.find((l) => l.id === action.id);
        if (!library) throw new Error('Library not found.');
        if (!(await fs.stat(library.root).catch(() => null))?.isDirectory())
          throw new Error('The library folder is unavailable. Reconnect it from the library menu.');
        const error = await shell.openPath(library.root);
        if (error) throw new Error(error);
        return null;
      }
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
    },
    readOnly,
  );
  handle('track-numbers', async () => {
    for (const library of db.libraries) {
      const files = db.tracks
        .filter((t) => t.libraryId === library.id && typeof t.trackRaw !== 'string')
        .map((t) => t.path);
      if (files.length) await importLibrary(library, files, false, false, { withState: false });
    }
    return snapshot();
  });
  handle(
    'read-tags',
    async (id) => {
      const track = trackIndex.get(id);
      if (!track) throw new Error('Track not found.');
      return tagEditor.readTags(track.path);
    },
    readOnly,
  );
  handle('write-tags', async (id, values, token) => {
    const track = trackIndex.get(id);
    if (!track) throw new Error('Track not found.');
    const library = db.libraries.find((l) => l.id === track.libraryId);
    if (!library) throw new Error('Library not found.');
    let result;
    const saved = await streamDecoder.withWrite(track.path, () =>
      tagEditor.writeTags({
        file: track.path,
        values,
        token,
        backupStore: tagHistory.store,
        onSaved: async () => {
          track.mtime = -1;
          result = await importLibrary(library, [track.path]);
        },
      }),
    );
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
        const written = await streamDecoder.withWrite(track.path, () =>
          tagEditor.writeTags({
            file: track.path,
            patch,
            token,
            backupStore: tagHistory.store,
          }),
        );
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
          false,
          false,
          { withState: false },
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
  handle(
    'read-tags-batch',
    async (ids) => {
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
    },
    readOnly,
  );
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
    let completed = 0,
      lastProgress = 0;
    const progress = (phase, force = false) => {
      if (force || Date.now() - lastProgress >= 80) {
        lastProgress = Date.now();
        if (win && !win.isDestroyed())
          win.webContents.send('tag-save-progress', { phase, completed, total: targets.length });
      }
    };
    progress('checking', true);
    // Validate all files and edits before writing any. Recheck tokens again at commit.
    await tagEditor.mapTagFiles(targets, async (track) => {
      const entry = entriesById.get(track.id);
      await tagEditor.prepareTags({
        file: track.path,
        patch: { ...patch, ...entry.patch },
        remove: remove.filter((k) => (entry.extraKeys || []).includes(k)),
        token: entry.token,
      });
      completed++;
      progress('checking');
    });
    completed = 0;
    progress('writing', true);
    const saved = [],
      failures = [],
      libraries = new Set(),
      records = [];
    const outcomes = await tagEditor.mapTagFiles(targets, async (track) => {
      const entry = entriesById.get(track.id);
      try {
        const written = await streamDecoder.withWrite(track.path, () =>
          tagEditor.writeTags({
            file: track.path,
            patch: { ...patch, ...entry.patch },
            remove: remove.filter((k) => (entry.extraKeys || []).includes(k)),
            token: entry.token,
            backupStore: tagHistory.store,
          }),
        );
        track.mtime = -1;
        return { track, backup: written.backup };
      } catch (error) {
        return {
          failure: { id: track.id, name: path.basename(track.path), message: error.message },
        };
      } finally {
        completed++;
        progress('writing', completed === targets.length);
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
          false,
          false,
          { withState: false },
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
  handle(
    'find-duplicates',
    async (mode) => duplicates.review(db.tracks, db.libraries, mode),
    readOnly,
  );
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
      trash: async (file) => {
        return streamDecoder.withWrite(file, () => shell.trashItem(file));
      },
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
    const result = await streamDecoder.withAllWrites(() =>
      deleteSelectedFiles(db, ids, async (files) => {
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
      }),
    );
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
  handle('preview-file-names', async (ids, config) => naming.preview(ids, config, db), readOnly);
  handle('apply-file-names', async (token, selectedIds) => {
    const result = await streamDecoder.withAllWrites(() =>
      naming.apply(token, commitNames, selectedIds),
    );
    return { ...result, state: snapshot() };
  });
  handle('restore-file-names', async (token, redo) => {
    if (typeof token !== 'string' || typeof redo !== 'boolean')
      throw Error('Invalid rename history.');
    const affected = await streamDecoder.withAllWrites(() =>
      naming.restore(token, redo, commitNames),
    );
    return { state: snapshot(), affected };
  });
  handle('merge-tag-undo', async (tokens) => {
    if (!Array.isArray(tokens) || tokens.some((t) => typeof t !== 'string'))
      throw Error('Invalid tag history.');
    return tagHistory.merge(tokens);
  });
  handle('restore-tag-edit', async (token, redo) => {
    if (typeof token !== 'string' || typeof redo !== 'boolean') throw Error('Invalid tag history.');
    const ids = await streamDecoder.withAllWrites(() =>
      tagHistory.restore(token, redo, (id) => trackIndex.get(id)?.path),
    );
    try {
      for (const id of ids) trackIndex.get(id).mtime = -1;
      for (const libraryId of new Set(ids.map((id) => trackIndex.get(id).libraryId)))
        await importLibrary(
          db.libraries.find((l) => l.id === libraryId),
          ids
            .map((id) => trackIndex.get(id))
            .filter((t) => t.libraryId === libraryId)
            .map((t) => t.path),
          false,
          false,
          { withState: false },
        );
      return { state: snapshot(), saved: ids };
    } catch (error) {
      await streamDecoder.withAllWrites(() =>
        tagHistory.restore(token, !redo, (id) => trackIndex.get(id)?.path),
      );
      throw error;
    }
  });
  handle('add-library', async (name, filters) => {
    name = validName(name);
    filters = validateFilters(filters || {});
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      properties: ['openDirectory'],
      title: 'Choose a music folder',
    });
    if (canceled) return null;
    const root = await fs.realpath(filePaths[0]);
    if (db.libraries.some((l) => l.root === root))
      throw new Error('This folder is already a library.');
    const library = { id: randomUUID(), name, root, filters };
    db.libraries.push(library);
    return importLibrary(library);
  });
  ipcMain.handle('audio-open', (event, id, sampleRate, offset) => {
    check(event);
    const track = trackIndex.get(id);
    if (!track) throw Error('Track not found.');
    return streamDecoder.open(track, sampleRate, offset);
  });
  ipcMain.handle('audio-read', (event, token) => {
    check(event);
    return streamDecoder.read(token);
  });
  ipcMain.handle('audio-close', (event, token) => {
    check(event);
    return streamDecoder.close(token);
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
          if (files.length) await importLibrary(library, files, false, true, { withState: false });
        } else await importLibrary(library, null, false, true, { withState: false });
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
  // Saves the collection once and carries ID changes into the saved sessions.
  async function finishMissingRepair(remap, extra = {}) {
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
        await writeAtomic(file, JSON.stringify(value));
      }),
    );
    return {
      state: snapshot(),
      remap,
      ...extra,
      notice: writes.some((r) => r.status === 'rejected')
        ? 'The library was repaired, but a session file could not be saved. Close the app normally to save the current session.'
        : '',
    };
  }
  handle(
    'choose-missing-file',
    async (id) => {
      const track = trackIndex.get(id);
      if (!track) throw Error('Track no longer exists in the library.');
      const library = db.libraries.find((l) => l.id === track.libraryId);
      const chosen = await dialog.showOpenDialog(win, {
        title: 'Locate ' + track.title,
        defaultPath: library?.root,
        properties: ['openFile'],
        filters: [
          {
            name: 'Audio',
            extensions: ['mp3', 'flac', 'wav', 'ogg', 'm4a', 'aac', 'opus', 'aiff'],
          },
        ],
      });
      return chosen.canceled ? null : chosen.filePaths[0];
    },
    readOnly,
  );
  // Batch review of missing files. 'plan' checks every entry and changes nothing;
  // the renderer shows that plan for confirmation. 'apply' repeats the checks, refuses
  // files that changed since the plan, then repairs everything with a single save.
  // Each entry: { id, action: 'reconnect' | 'forget', candidateId?, file?, expect? }.
  handle('repair-missing-tracks', async (entries, mode) => {
    if (
      !['plan', 'apply'].includes(mode) ||
      !Array.isArray(entries) ||
      !entries.length ||
      entries.length > 10000 ||
      entries.some(
        (e) =>
          !e ||
          typeof e.id !== 'string' ||
          !['reconnect', 'forget'].includes(e.action) ||
          (e.candidateId != null && typeof e.candidateId !== 'string') ||
          (e.file != null && typeof e.file !== 'string'),
      ) ||
      new Set(entries.map((e) => e.id)).size !== entries.length
    )
      throw Error('Invalid missing-file review.');
    const plans = [],
      claimed = new Map();
    for (const entry of entries) {
      const track = trackIndex.get(entry.id),
        library = db.libraries.find((l) => l.id === track?.libraryId);
      const item = {
        id: entry.id,
        action: entry.action,
        title: track?.title || '',
        from: track?.path || '',
      };
      try {
        if (!track || !library) throw Error('Track no longer exists in the library.');
        await libraryRepair.requireMissing(track);
        if (entry.action === 'reconnect') {
          let filename = entry.file;
          if (entry.candidateId) {
            const candidate = trackIndex.get(entry.candidateId);
            if (!candidate || candidate.libraryId !== library.id)
              throw Error('Suggested file no longer exists in this library.');
            filename = candidate.path;
          }
          if (!filename) throw Error('Choose a replacement file first.');
          const plan = await libraryRepair.planTrackReconnect(library, track, filename, db.tracks);
          if (claimed.has(plan.file))
            throw Error('The same file is also chosen for ' + claimed.get(plan.file) + '.');
          claimed.set(plan.file, track.title);
          Object.assign(item, {
            to: plan.file,
            merge: plan.duplicates.length > 0,
            size: plan.size,
            mtime: plan.mtime,
            plan,
            library,
            track,
          });
          if (
            mode === 'apply' &&
            (!entry.expect ||
              entry.expect.file !== plan.file ||
              entry.expect.size !== plan.size ||
              entry.expect.mtime !== plan.mtime)
          )
            throw Error('The file changed since the review. Review again.');
        } else Object.assign(item, { track });
      } catch (error) {
        item.error = error.message;
      }
      plans.push(item);
    }
    const publicPlan = (item) => ({
      id: item.id,
      action: item.action,
      title: item.title,
      from: item.from,
      ...(item.to ? { to: item.to, merge: item.merge, size: item.size, mtime: item.mtime } : {}),
      ...(item.error ? { error: item.error } : {}),
    });
    if (mode === 'plan') return { plan: plans.map(publicPlan) };
    // Read every replacement first (one scan per library); nothing changes on failure.
    const failures = plans.filter((item) => item.error).map(publicPlan),
      ready = plans.filter((item) => !item.error),
      scanned = new Map();
    const byLibrary = new Map();
    for (const item of ready.filter((i) => i.action === 'reconnect')) {
      if (!byLibrary.has(item.library.id)) byLibrary.set(item.library.id, []);
      byLibrary.get(item.library.id).push(item);
    }
    for (const items of byLibrary.values()) {
      const result = await scan(
        items[0].library,
        items.map((i) => i.plan.file),
        items.map((i) => ({ ...i.track, path: i.plan.file, mtime: -1, size: -1 })),
      );
      for (const track of result.tracks) scanned.set(track.path, track);
    }
    const remap = {},
      repaired = [];
    for (const item of ready) {
      if (item.action === 'forget') {
        remap[item.id] = null;
        db.tracks = db.tracks.filter((t) => t.id !== item.id);
        repaired.push(item.id);
        continue;
      }
      const updated = scanned.get(item.plan.file);
      try {
        if (!updated || updated.mtime === -1)
          throw Error(
            'The file could not be read. Wait for syncing to finish or choose another file.',
          );
        const verified = await fs.stat(item.plan.file);
        if (verified.size !== item.plan.size || verified.mtimeMs !== item.plan.mtime)
          throw Error('The file changed while reconnecting. Review again.');
      } catch (error) {
        failures.push({ ...publicPlan(item), error: error.message });
        continue;
      }
      const merged = Object.fromEntries(
        item.plan.duplicates.map((duplicate) => [duplicate, item.id]),
      );
      Object.assign(remap, merged);
      db.tracks = db.tracks.filter((t) => t.id !== item.id && !Object.hasOwn(merged, t.id));
      db.tracks.push(updated);
      delete db.pendingRatings?.[item.id];
      if (updated.codec === 'MP3') {
        if (updated.tagRating) db.ratings[item.id] = updated.tagRating;
        else delete db.ratings[item.id];
      }
      repaired.push(item.id);
    }
    if (!repaired.length) return { state: snapshot(), remap: {}, repaired, failures, notice: '' };
    libraryRepair.replaceTrackReferences(db, remap);
    return finishMissingRepair(remap, { repaired, failures });
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
  handle('configure-library', async (id, filters) => {
    const library = db.libraries.find((item) => item.id === id && !item.importedFiles);
    if (!library) throw Error('Library not found.');
    library.filters = validateFilters(filters);
    return importLibrary(library);
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
      return {
        dynamic,
        ...(action.browse !== undefined ? { browse: action.browse } : {}),
        ...(action.icon !== undefined ? { icon: validateIcon(action.icon) } : {}),
      };
    };
    if (action.type === 'create') {
      const config = action.dynamic
        ? configuration()
        : action.icon !== undefined
          ? { icon: validateIcon(action.icon) }
          : {};
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
    icon: path.join(projectRoot, 'build/icon.png'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  if (browsingSession?.window?.maximized) win.maximize();
  // Last session ended in mini mode: start preparing the mini window right away, in
  // parallel with the main window, so restoring mini does not delay startup.
  if (!process.env.NODE_TEST_CONTEXT && browsingSession?.mini)
    createDetachedMini().catch((error) => console.warn('Mini window:', error.message));
  // Route the title-bar close through the same session/pending-preferences drain
  // as Ctrl/Cmd+Q, while the renderer is still alive to capture its state.
  win.on?.('close', (event) => {
    if (!quitting) {
      event.preventDefault();
      app.quit();
    }
  });
  // Keep Windows frame styles unchanged: toggling resizable changes its native border geometry.
  win.on?.('will-resize', (event) => {
    if (miniMode && !motionActive) event.preventDefault();
  });
  // Never expose fallback markup or colors before saved preferences are applied.
  ipcMain.on('session-saved', (event) => {
    check(event);
    finishSessionSave?.();
  });
  // While the detached mini player is shown, the transparent main window should
  // never hold focus (for example after Alt+Tab).
  win.on?.('focus', () => {
    if (detachedMini.active && detachedMini.window && !detachedMini.window.isDestroyed())
      detachedMini.window.focus();
  });
  ipcMain.on('ui-ready', (event, marks) => {
    check(event);
    rendererReady = true;
    if (!win.isDestroyed()) win.show();
    // Prepare the mini window in the background so M is instant (not under node --test).
    if (!process.env.NODE_TEST_CONTEXT)
      setTimeout(
        () => createDetachedMini().catch((error) => console.warn('Mini window:', error.message)),
        1500,
      );
    const timings = {
      version: app.getVersion(),
      platform: process.platform,
      appReadyMs: appReadyAt - startupStarted,
      windowLoadMs: windowLoadAt - startupStarted,
      visibleMs: Date.now() - startupStarted,
      tracks: db.tracks.length,
      // Renderer timeline relative to app start: navigation start, then its own marks.
      ...(marks && typeof marks === 'object' && Number.isFinite(marks.timeOrigin)
        ? {
            renderer: Object.fromEntries(
              [
                ['navigationStart', 0],
                ...Object.entries(marks).filter(
                  ([key, value]) => key !== 'timeOrigin' && Number.isFinite(value),
                ),
              ].map(([key, value]) => [key, Math.round(marks.timeOrigin - startupStarted + value)]),
            ),
          }
        : {}),
    };
    const logs = path.join(app.getPath('userData'), 'logs');
    fs.mkdir(logs, { recursive: true })
      .then(() => fs.writeFile(path.join(logs, 'startup.json'), JSON.stringify(timings, null, 2)))
      .catch(() => {});
  });
  // Content-driven desktop minimum, including platform window decorations.
  ipcMain.on?.('layout-minimum', (event, width, height = 740, viewport) => {
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
    if (miniMode || motionActive) return;
    const display = screen?.getDisplayMatching(win.getBounds());
    const frameKey = `${display?.id ?? 'default'}:${display?.scaleFactor ?? 1}`;
    const renderedViewport =
      Array.isArray(viewport) &&
      viewport.length === 2 &&
      viewport.every((value) => Number.isInteger(value) && value > 0 && value <= 10000) &&
      Math.abs(viewport[0] - contentWidth) <= 2 &&
      Math.abs(viewport[1] - contentHeight) <= 2;
    const currentFrame = {
      key: frameKey,
      width: Math.max(0, outerWidth - (renderedViewport ? viewport[0] : contentWidth)),
      height: Math.max(0, outerHeight - (renderedViewport ? viewport[1] : contentHeight)),
    };
    // Maximized windows can report zero invisible-border extents; never cache those as normal chrome.
    if ((!normalFrame || normalFrame.key !== frameKey) && !win.isMaximized())
      normalFrame = currentFrame;
    else if (renderedViewport && normalFrame?.key === frameKey && !win.isMaximized()) {
      // Integer DIP rounding must never inflate the cached decoration/minimum on a later cycle.
      normalFrame.width = Math.min(normalFrame.width, currentFrame.width);
      normalFrame.height = Math.min(normalFrame.height, currentFrame.height);
    }
    const frame = normalFrame?.key === frameKey ? normalFrame : currentFrame;
    const minimum = width + frame.width;
    const minimumHeight = height + frame.height;
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
  // The cached collection is usable before slow disks or cloud folders finish
  // reconciliation. File mutations wait for this lane; playback remains usable.
  startupReady = (async () => {
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
                    (t) =>
                      t.libraryId === library.id &&
                      !t.missing &&
                      // Re-read once for fields added in later versions.
                      (typeof t.discRaw !== 'string' ||
                        typeof t.bitrate !== 'number' ||
                        typeof t.comment !== 'string'),
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
          { withState: false },
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
  })().catch((error) => {
    startupRefresh.warnings.push(error.message);
  });
  windowLoadAt = Date.now();
  await win.loadURL('localtone://app/index.html');
  await Promise.all([
    audioSources.init().catch((error) => console.warn('Playback cache:', error.message)),
    streamDecoder.init().catch((error) => console.warn('Playback edit cache:', error.message)),
    startupReady,
  ]);
});
app.on('will-quit', () => {
  playbackShortcuts.set(false);
});
app.on('before-quit', (event) => {
  if (quitting) return;
  event.preventDefault();
  if (quitJob) return;
  quitJob = (async () => {
    if (rendererReady && win && !win.isDestroyed() && !win.webContents.isDestroyed?.()) {
      await new Promise((resolve) => {
        const timer = setTimeout(() => finishSessionSave?.(), 5000);
        finishSessionSave = () => {
          clearTimeout(timer);
          finishSessionSave = null;
          resolve();
        };
        win.webContents.send('prepare-quit');
      });
    }
    quitting = true;
    gaplessDecoder.cancel();
    waveforms?.cancel();
    await Promise.allSettled([
      onlineUpdates.shutdown(),
      startupReady,
      audioSources.dispose(),
      streamDecoder.dispose(),
      historyWrites,
      lastfmReady?.then(() => lastfm.close()),
      (async () => {
        while (busy) await new Promise((resolve) => setTimeout(resolve, 25));
        await tagHistory?.cleanup();
      })(),
    ]);
  })().finally(() => app.quit());
});
app.on('window-all-closed', () => app.quit());
