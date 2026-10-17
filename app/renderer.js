import { createDuplicatesDialog } from './duplicates-dialog.js';
import { createFileNamingDialog } from './file-naming-dialog.js';
import { createSettingsHelp } from './settings-help.js';
import { designDefaults, appearanceDefaults } from './design-defaults.js';
import { createSettingsWrites } from './settings-writes.js';
import { createTagEditor } from './tag-editor.js';
import { createPlaylistEditor } from './playlist-editor.js';
import { createLastfmSettings } from './lastfm-settings.js';
import { createDialogCoordinator } from './dialog-coordinator.js';
import { createSettingsTabs } from './settings-tabs.js';
import { createBrowseSelection } from './browse-selection.js';
import { createPlaybackQueue } from './playback-queue.js';
import { createWindowPresentation } from './window-presentation.js';
import { createAudioOutputSettings } from './audio-output-settings.js';
import { mountVirtualTracks } from './virtual-tracks.js';
import { createIcons } from './icons.js';
import { normalizeMenu } from './context-menu.js';
import { shortcutDefaults } from './shortcuts.js';
import { createQueueViewCache, queuePage } from './queue-view.js';
import { BufferedAudio } from './buffered-audio.js';
import { waveformPath } from './waveform-view.js';
import { ListenTracker } from './listen.js';
import { seekTo, columnWidths, resizeColumnBoundary } from './interactions.js';
import { artistsFor, albumsFor, albumKey } from './browse.js';
import { createNameDialog } from './name-dialog.js';
import {
  canRenumber,
  numberActionNeeded,
  artistGroupName,
  artistGroupKey,
  compileSearch,
  selectTracks,
  formatTime,
  playlistTracks,
  dateFields,
  openingArtist,
} from './core.js';
const $ = (id) => document.getElementById(id),
  api = window.localtone;

const selection = createBrowseSelection();
const deselectedBrowsePositions = { artists: null, tracks: null };
let recordingShortcut = null,
  searchResultIds = null;
let pendingBrowsingRestore = null,
  initialLibraryRefresh = null;
let state = { libraries: [], tracks: [], playlists: [] },
  scope = { kind: 'all' },
  query = '',
  sort = 'folder',
  direction = 1;
const columnDefaults = structuredClone(designDefaults.columns);
let trackLookup = new Map();
let playlistDragId = null;
let globalShortcutStatus = { active: false, error: '' };
let prefs = {
  renameAlbumFormula: '%year% %album%',
  renameTrackFormula: '%tracknumber% %title%',
  animateLogo: true,
  exportCollections: false,
  confirmMultiFileTags: true,
  totalLeadingZeros: false,
  lookupLeadingZeros: false,
  artistGrouping: 'albumArtist',
  defaultSort: 'year',
  seekStep: 5,
  queueDisplayCount: 100,
  gaplessPlayback: false,
  queuePresentation: 'overlay',
  audioOutputId: '',
  audioOutputName: 'System default',
  shortcuts: shortcutDefaults,
  albumDetails: ['artist', 'year', 'tracks', 'duration'],
  trackNumberFormat: 'number',
  showDiscNumber: false,
  albumLayout: 'side',
  sidebarLocked: false,
  artistLocked: false,
  globalPlaybackShortcuts: false,
  backgroundSaturation: 12,
  backgroundBrightness: 11,
  backgroundHue: 220,
  accentColor: '',
  seekHeight: 32,
  seekHeightLocked: false,
  libraryOpening: 'random',
  seekDisplay: 'waveform',
  waveformStyle: 'bars',
  waveformHeight: 'compact',
  waveformNormalize: true,
  showColumnHeaders: false,
  portable: true,
  theme: 'sage',
  coverSize: 'medium',
  defaultView: 'albums',
  albumView: 'list',
  sidebarWidth: 176,
  artistWidth: 220,
  volume: 0.8,
  shuffle: false,
  repeat: 0,
  artistSort: 'name',
  albumExpansion: 'expanded',
  columns: columnDefaults,
};
prefs = { ...prefs, ...structuredClone(designDefaults) };
let randomSortSeed = 0;
let preferenceWrites = Promise.resolve();
const settingsWrites = createSettingsWrites({
  getPreferences: () => prefs,
  setPreferences: (value) => {
    prefs = value;
  },
  isBusy: () => busy,
  apply: applyPreferences,
  write: (patch) => queuePreferenceWrite(() => api.settings(patch)),
  clearError: () => {
    $('settings-error').hidden = true;
  },
  showError: (message) => {
    $('settings-error').textContent = message;
    $('settings-error').hidden = false;
    toast(message);
  },
});

const ratingVersions = new Map();
let revealOpeningArtist = false;
let coverReturnScroll = 0;
function matchesOpenedAlbum(key) {
  return key === selection.albumDetail || selection.openedAlbums.has(key);
}
let view = 'albums';
const expandedAlbums = new Map();
const playback = createPlaybackQueue({ random: () => Math.random() });
let visible = [],
  folderTracks = [],
  shuffle = false,
  repeat = 0,
  busy = false,
  toastTimer,
  playGeneration = 0;
let dragPayload = null,
  seeking = false;
let playingOrigin = null,
  pendingPlaybackPosition = null;
const audio =
  typeof BufferedAudio !== 'undefined' && window.AudioContext && api.decodeGapless
    ? new BufferedAudio($('audio'), {
        decode: (id, rate) => api.decodeGapless(id, rate),
        cancelDecode: () => api.cancelGapless?.().catch(() => {}),
        status: (message) => {
          $('gapless-status').textContent = message;
        },
      })
    : $('audio');
let waveformPeaks = null,
  waveformGeneration = 0;
let lastfmState = { enabled: false };
const listener = new ListenTracker((kind, play) => {
  if (!api?.lastfmPlayback || !lastfmState.enabled) return;
  api
    .lastfmPlayback(kind, play)
    .then(showLastfmStatus)
    .catch((error) => {
      $('lastfm-error').textContent = error.message.replace(
        /^Error invoking remote method '[^']+': Error: /,
        '',
      );
      $('lastfm-error').hidden = false;
    });
});
audio.volume = 0.8;
const { icon, setIcon, animatePulse } = createIcons(document);
const windowPresentation = createWindowPresentation({
  window,
  document,
  api,
  getPreferences: () => prefs,
  syncPaneBounds,
  toast,
});
const { toggleMini, setQueueVisible, revealPlayingQueueItem } = windowPresentation;
window.addEventListener('beforeunload', () => windowPresentation.dispose());
function toast(message, persistent = false) {
  clearTimeout(toastTimer);
  $('toast').textContent = String(message).replace(
    /^Error invoking remote method '[^']+': (?:Error: )?/,
    '',
  );
  $('toast').hidden = false;
  positionNotice();
  if (!persistent) toastTimer = setTimeout(() => ($('toast').hidden = true), 5500);
}
function el(tag, text, className) {
  const node = document.createElement(tag);
  if (text != null) node.textContent = text;
  if (className) node.className = className;
  return node;
}
function cover(track) {
  const box = el('div', null, 'cover');
  box.append(icon('music'));
  if (track?.cover) {
    const img = new Image();
    img.src = `localtone://cover/${track.id}`;
    img.alt = '';
    img.draggable = false;
    img.onerror = () => box.replaceChildren(icon('music'));
    box.replaceChildren(img);
  }
  return box;
}
function activePlaylist() {
  return state.playlists.find((p) => scope.kind === 'playlist' && p.id === scope.id);
}
function currentTrack() {
  return trackLookup.get(playback.queue[playback.cursor]);
}
const dialogs = createDialogCoordinator({
  document,
  captureFocus: () => ({
    pane: selection.pane,
    scope: JSON.stringify(scope),
    node:
      selection.pane === 'artists'
        ? [...$('artist-list').querySelectorAll('button')].find(
            (n) => n.dataset.artistKey === selection.artists.current,
          ) || $('artist-list').querySelector('button')
        : document.activeElement,
  }),
  restoreFocus: (previous) => {
    const panes = [document.querySelector('.content-scroll'), $('artist-list')].map((node) => [
      node,
      node.scrollTop,
    ]);
    try {
      if (previous.scope === JSON.stringify(scope)) {
        selection.pane = previous.pane;
        paintPaneFocus(false);
        if (previous.node?.isConnected) {
          previous.node.focus({ preventScroll: true });
          return;
        }
      }
      focusBrowseSelection();
    } finally {
      for (const [node, top] of panes) node.scrollTop = top;
    }
  },
  canDismiss: () =>
    !tagEditor.saving && !fileNamesDialog?.saving && !duplicatesDialog.saving && !busy,
  onClose: () => {
    recordingShortcut = null;
  },
});
const nameDialog = createNameDialog(document, (dialog) => dialogs.open(dialog));
window.addEventListener('beforeunload', () => dialogs.dispose());
function setBusy(value) {
  for (const id of [
    'add-library',
    'empty-add',
    'empty-import',
    'add-playlist',
    'settings-import',
    'settings-export',
  ])
    $(id).disabled = value || (id === 'empty-import' && !api?.settingsTransfer);
}
async function operation(fn, message = 'Saving…') {
  if (busy) {
    toast('Please wait for the current operation.');
    return;
  }
  busy = true;
  setBusy(true);
  if (message) toast(message, true);
  else $('toast').hidden = true;
  try {
    const result = await fn();
    if (result) {
      state = result.state || result;
      render({ preserveScroll: true });
      if (result.warnings)
        toast(`Imported with ${result.warnings} unreadable tags. Filenames are used where needed.`);
      else $('toast').hidden = true;
    } else $('toast').hidden = true;
    return result;
  } catch (error) {
    toast(error.message.replace(/^Error invoking remote method '[^']+': Error: /, ''));
  } finally {
    busy = false;
    setBusy(false);
  }
}
function changeView(next) {
  view = next;
  if (prefs.lastView !== next)
    updateSettings({
      lastView: next,
      ...(next !== 'tracks' ? { albumView: next === 'covers' ? 'covers' : 'list' } : {}),
    });
}
function setScope(next) {
  deselectedBrowsePositions.artists = deselectedBrowsePositions.tracks = null;
  selection.resetCollection();
  searchResultIds = null;
  scope = next;
  expandedAlbums.clear();
  sort =
    next.kind === 'playlist' && !activePlaylist()?.dynamic?.enabled ? 'manual' : prefs.defaultSort;
  direction = 1;
  $('sort').value = sort;
  chooseOpeningArtist();
  render();
  if (!$('queue-panel').hidden) revealPlayingQueueItem();
}
function chooseOpeningArtist() {
  revealOpeningArtist = true;
  const tracks = selectTracks(state, scope, query, 'manual'),
    key =
      scope.kind === 'playlist'
        ? `playlist:${scope.id}`
        : scope.kind === 'library'
          ? scope.id
          : 'all';
  selection.artists.current =
    prefs.libraryOpening === 'first'
      ? (artistsFor(tracks, 'name', prefs.artistGrouping)[0] ?? null)
      : openingArtist(
          tracks,
          prefs.libraryOpening,
          state.playbackHistory?.[key],
          Math.random,
          prefs.artistGrouping,
        );
}
function renderSidebar() {
  const all = $('all');
  all.classList.toggle('active', scope.kind === 'all');
  all.classList.toggle('playing-source', !!currentTrack() && playingOrigin?.kind === 'all');
  for (const [container, items, kind] of [
    ['libraries', state.libraries.filter((l) => !l.importedFiles), 'library'],
    ['playlists', state.playlists, 'playlist'],
  ]) {
    $(container).replaceChildren();
    for (const item of items) {
      const button = el('button', null, 'nav');
      button.dataset.sourceKind = kind;
      button.dataset.sourceId = item.id;
      const dynamic = kind === 'playlist' && item.dynamic?.enabled;
      const mark = el('span');
      mark.append(icon(kind === 'library' ? 'folder' : dynamic ? 'dynamic' : 'playlist'));
      button.append(mark, document.createTextNode(item.name));
      button.classList.toggle('dynamic-playlist', !!dynamic);
      button.classList.toggle(
        'playing-source',
        !!currentTrack() && playingOrigin?.kind === kind && playingOrigin.id === item.id,
      );
      button.setAttribute('aria-label', dynamic ? `${item.name}, dynamic playlist` : item.name);
      const tracks =
        kind === 'playlist'
          ? playlistTracks(state, item)
          : state.tracks.filter((t) => !t.missing && !t.excluded && t.libraryId === item.id);
      const minutes = Math.round(tracks.reduce((n, t) => n + (Number(t.duration) || 0), 0) / 60);
      button.title = `${item.name}${dynamic ? ' · Dynamic playlist' : ''}\n${tracks.length.toLocaleString()} tracks · ${minutes.toLocaleString()} minutes`;
      button.classList.toggle('active', scope.kind === kind && scope.id === item.id);
      button.onclick = () => setScope({ kind, id: item.id });
      button.ondblclick = () => playRandomCollection({ kind, id: item.id });
      bindSidebarItem(button, item, kind);
      $(container).append(button);
    }
    if (container === 'libraries') $(container).append(all);
  }
  syncPlaybackMarkers();
}
function syncPlaybackMarkers() {
  const playing = currentTrack()?.id;
  for (const section of document.querySelectorAll('.album-section'))
    section.classList.toggle('album-playing', section._trackIds?.includes(playing) || false);
  for (const marker of document.querySelectorAll('.playback-marker')) {
    if (!marker.closest('.playing-source, tr.current')) marker.remove();
  }
  const playingAlbum = currentTrack() ? albumKey(currentTrack()) : null;
  for (const button of document.querySelectorAll('.album-cover-button'))
    button.classList.toggle('album-playing', button.dataset.albumKey === playingAlbum);
  for (const node of document.querySelectorAll('.playing-source, tr.current .track-name')) {
    if (!node.querySelector('.playback-marker')) {
      const marker = icon('playback');
      if (node.classList.contains('track-name')) node.prepend(marker);
      else node.append(marker);
    }
  }
}
function isFirstLaunch() {
  return (
    !state.libraries.some((library) => !library.importedFiles) &&
    !state.playlists.length &&
    !state.tracks.some((track) => !track.missing)
  );
}
function render({ preserveScroll = false } = {}) {
  if (!preserveScroll) $('playing-reveal-space')?.remove();
  const pane = document.querySelector('.content-scroll'),
    artists = $('artist-list');
  const position = preserveScroll
    ? { top: pane.scrollTop, artists: artists.scrollTop, focus: document.activeElement }
    : null;
  const focusedTrack = position?.focus?.closest('[data-track-id]')?.dataset.trackId;
  const focusedArtist = position?.focus?.closest('[data-artist-key]')?.dataset.artistKey;
  const focusedAlbum = position?.focus?.closest('[data-album-key]')?.dataset.albumKey;

  syncSearchClear();
  trackLookup = new Map(state.tracks.filter((t) => !t.missing).map((track) => [track.id, track]));
  renderSidebar();
  folderTracks = selectTracks(state, scope, query, 'manual');
  if (
    selection.artists.current !== null &&
    !folderTracks.some((t) => artistGroupKey(t, prefs.artistGrouping) === selection.artists.current)
  )
    selection.artists.current = null;
  for (const key of selection.artists)
    if (!folderTracks.some((t) => artistGroupKey(t, prefs.artistGrouping) === key))
      selection.artists.delete(key);
  visible = selectTracks(
    state,
    scope,
    query,
    sort,
    direction,
    selection.artists.size > 1 ? null : selection.artists.current,
    randomSortSeed,
    prefs.artistGrouping,
  );
  if (selection.artists.size > 1)
    visible = visible.filter((t) => selection.artists.has(artistGroupKey(t, prefs.artistGrouping)));
  renderArtistPane();
  const playlist = activePlaylist(),
    library = state.libraries.find((l) => scope.kind === 'library' && l.id === scope.id);
  $('title').textContent = playlist?.name || library?.name || 'All music';
  const collectionTracks = selectTracks(state, scope, '', 'manual');
  const seconds = collectionTracks.reduce(
    (total, track) => total + (Number(track.duration) || 0),
    0,
  );
  $('summary').textContent =
    `${collectionTracks.length.toLocaleString()} tracks · ${Math.round(seconds / 60).toLocaleString()} minutes${scope.kind === 'all' ? ` · ${state.libraries.length} libraries` : ''}`;
  $('sort').querySelector('[value=manual]').disabled = !playlist || !!playlist.dynamic?.enabled;
  if (playlist?.dynamic?.enabled && sort === 'manual') {
    sort = 'folder';
    $('sort').value = sort;
  }
  $('direction').title =
    direction === 1 ? 'Ascending — switch to descending' : 'Descending — switch to ascending';
  const table = $('tracks').closest('table');
  table._disposeVirtual?.();
  if (view === 'tracks') buildTrackTable(table, visible, visible, playlist);
  else $('tracks').replaceChildren();
  $('empty').hidden = visible.length > 0;
  const firstLaunch = isFirstLaunch() && !query;
  $('empty').classList.toggle('first-launch', firstLaunch);
  $('empty-import').hidden = !firstLaunch;
  $('empty-import').disabled = busy || !api?.settingsTransfer;
  if (firstLaunch) {
    $('empty-title').textContent = 'Add a library.';
    $('empty').querySelector('p').textContent =
      'Choose a music folder, or import a Localtone settings backup.';
    $('empty-add').hidden = false;
  } else {
    $('empty-title').textContent = query ? 'No matching tracks.' : 'No tracks.';
    const needsLibrary =
      scope.kind === 'all' && !query && !state.libraries.some((l) => !l.importedFiles);
    $('empty').querySelector('p').textContent = query
      ? 'Try another artist, album, year, or genre.'
      : playlist
        ? 'Drag audio files, tracks, albums, or artists here.'
        : needsLibrary
          ? 'Add a library to show music here.'
          : 'Add audio files to this folder, then rescan it.';
    $('empty-add').hidden = !needsLibrary;
    $('empty-status').hidden = true;
  }
  renderBrowser(position?.top);
  syncPlaybackMarkers();
  renderQueue({ reveal: false });
  renderPlayerRating();
  syncScrollbarControls();
  syncPaneBounds();
  if (position) {
    pane.scrollTop = position.top;
    artists.scrollTop = position.artists;
    for (const virtual of document.querySelectorAll('.track-table')) virtual._refreshVirtual?.();
    if (!position.focus?.isConnected && (focusedTrack || focusedArtist || focusedAlbum)) {
      const albumNode = [...pane.querySelectorAll('[data-album-key]')].find(
        (node) => node.dataset.albumKey === focusedAlbum,
      );
      const replacement = focusedTrack
        ? [...pane.querySelectorAll('[data-track-id]')].find(
            (node) => node.dataset.trackId === focusedTrack,
          )
        : focusedArtist
          ? [...artists.querySelectorAll('[data-artist-key]')].find(
              (node) => node.dataset.artistKey === focusedArtist,
            )
          : albumNode?.matches('button')
            ? albumNode
            : albumNode?.querySelector('button');
      replacement?.focus({ preventScroll: true });
    }
    pane.scrollTop = position.top;
    artists.scrollTop = position.artists;
  }
}
function addLibrary() {
  if (!busy) openLibrarySettings();
}
function createPlaylist() {
  if (!busy) openPlaylistSettings();
}
function showActions(track, event) {
  if (!selection.tracks.has(track.id)) selectTrack(track.id);
  const actionIds =
    selection.tracks.size > 1
      ? displayedTracks()
          .filter((t) => selection.tracks.has(t.id))
          .map((t) => t.id)
      : [track.id];
  const container = $('track-actions');
  container.replaceChildren();
  const button = (label, handler) => {
    const b = el('button', label);
    b.onclick = () => {
      closeContextMenu();
      handler();
    };
    container.append(b);
  };
  appendNamingAction(actionIds.map((id) => trackLookup.get(id)));
  if (actionIds.every((id) => trackLookup.get(id)?.codec === 'MP3'))
    button('Edit tags…', () => openTagEditor(actionIds.map((id) => trackLookup.get(id))));
  appendNumberActions(actionIds.map((id) => trackLookup.get(id)));
  button('Open folder', () => openFolder(track.id, 'track'));
  button('Add to play queue', () => addToQueue(actionIds));
  appendPlaylistActions(actionIds);
  appendWebSearch(track.id, 'track');
  appendDeleteFilesAction(actionIds.map((id) => trackLookup.get(id)));
  const playlist = activePlaylist();
  if (playlist && !playlist.dynamic?.enabled) {
    button('Remove from this playlist', () => removePlaylistSelection(playlist, actionIds));
  }
  openContextMenu(event);
}
function playRandomCollection(source) {
  if (busy) return;
  setScope(source);
  const tracks = selectTracks(state, scope, '', 'manual');
  if (tracks.length) {
    playVisible(tracks[Math.floor(Math.random() * tracks.length)].id);
    navigateFromPlayer(true, true, true);
  }
}
function playVisible(id) {
  let source = selectTracks(state, scope, '', sort, direction, null, randomSortSeed);
  if (view !== 'tracks')
    source = albumsFor(source, null, sort, direction, {
      ratings: state.ratings,
      seed: randomSortSeed,
    }).flatMap((a) => a.tracks);
  playback.seed(
    source.map((t) => t.id),
    scope,
    { chosen: id, shuffle },
  );
  if (!source.length) return;
  startTrack();
}
async function startTrack(resume = null, scheduled = false, { preserveQueueScroll = false } = {}) {
  const generation = ++playGeneration,
    track = currentTrack();
  if (!track) {
    toast('This track is no longer in the collection.');
    return;
  }
  playingOrigin = playback.origins[playback.cursor] || { kind: 'library', id: track.libraryId };
  if (navigator.mediaSession && typeof MediaMetadata !== 'undefined')
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: track.artist,
      album: track.album,
    });
  pendingPlaybackPosition =
    resume !== null ? Math.max(0, Math.min(Number(resume) || 0, track.duration || Infinity)) : null;
  listener.begin(track);
  loadWaveform(track);
  if (!scheduled) audio.src = `localtone://audio/${track.id}`;
  const artwork = el('button', null, 'cover');
  artwork.id = 'now-art';
  artwork.type = 'button';
  artwork.title = 'Show playing track';
  artwork.setAttribute('aria-label', 'Show playing track');
  artwork.append(...cover(track).childNodes);
  artwork.onclick = () => navigateFromPlayer(true, true, true);
  $('now-art').replaceWith(artwork);
  $('now-title').textContent = track.title;
  $('now-artist').textContent = track.artist;
  $('now-album').textContent = track.album;
  $('now-album').disabled = false;
  $('now-artist').disabled = false;
  $('now-separator').hidden = false;
  $('duration').textContent = formatTime(track.duration);
  $('elapsed').textContent = '0:00';
  $('seek').value = 0;
  document
    .querySelectorAll('.track-table tr[data-track-id]')
    .forEach((row) => row.classList.toggle('current', row.dataset.trackId === track.id));
  $('all').classList.toggle('playing-source', playingOrigin.kind === 'all');
  for (const button of document.querySelectorAll('[data-source-kind]'))
    button.classList.toggle(
      'playing-source',
      button.dataset.sourceKind === playingOrigin.kind &&
        button.dataset.sourceId === playingOrigin.id,
    );
  syncPlaybackMarkers();
  renderQueue({ reveal: !preserveQueueScroll });
  renderPlayerRating();
  if (resume !== null) {
    const position = Math.max(0, Math.min(Number(resume) || 0, track.duration || Infinity));
    $('elapsed').textContent = formatTime(position);
    $('seek').value = track.duration ? (position / track.duration) * 100 : 0;
    audio.addEventListener(
      'loadedmetadata',
      () => {
        if (generation === playGeneration) {
          audio.currentTime = Math.min(
            position,
            Number.isFinite(audio.duration) ? audio.duration : position,
          );
          pendingPlaybackPosition = null;
          paintWaveformProgress();
        }
      },
      { once: true },
    );
    return;
  }
  try {
    await audio.play();
    if (generation === playGeneration) {
      state.playbackHistory ??= {};
      state.playbackHistory[track.libraryId] = track.id;
      state.playbackHistory.all = track.id;
      for (const p of state.playlists)
        if (playlistTracks(state, p).some((t) => t.id === track.id))
          state.playbackHistory[`playlist:${p.id}`] = track.id;
      api
        ?.rememberPlayed?.(track.id)
        .catch((error) => toast('Could not remember the last artist: ' + error.message));
    }
  } catch (error) {
    if (generation === playGeneration && error.name !== 'AbortError')
      toast('Unable to play this file. It may be missing or use an unsupported codec.');
  }
}
function savePlayback() {
  const track = currentTrack();
  api?.savePlayback?.({
    id: track?.id || null,
    position: track ? (pendingPlaybackPosition ?? (audio.currentTime || 0)) : 0,
    origin: playingOrigin,
    ...playback.capture(),
    shuffle,
    repeat,
  });
}
function restorePlayback() {
  const saved = state.playbackSession,
    track = trackLookup.get(saved?.id);
  if (saved?.queue && saved.origins && saved.ordered) {
    playback.restoreSession(saved, (id) => trackLookup.has(id));
    if (typeof saved.shuffle === 'boolean') shuffle = prefs.shuffle = saved.shuffle;
    if ([0, 1, 2].includes(saved.repeat)) repeat = prefs.repeat = saved.repeat;
    applyPreferences();
    if (currentTrack()) startTrack(saved.position || 0);
    else renderQueue();
    return;
  }
  if (!track) return;
  const origin = saved.origin;
  const valid =
    origin?.kind === 'all' ||
    (origin?.kind === 'library' && state.libraries.some((l) => l.id === origin.id)) ||
    (origin?.kind === 'playlist' && state.playlists.some((p) => p.id === origin.id));
  const source = valid ? origin : { kind: 'library', id: track.libraryId };
  const ids = selectTracks(state, source, '', 'manual').map((t) => t.id);
  if (!ids.includes(track.id)) ids.push(track.id);
  playback.seed(ids, source, { chosen: track.id });
  startTrack(saved.position || 0);
}
let lastPlaybackSave = 0;
audio.addEventListener('timeupdate', () => {
  if (Date.now() - lastPlaybackSave > 5000) {
    lastPlaybackSave = Date.now();
    savePlayback();
  }
});
audio.addEventListener('pause', savePlayback);
audio.addEventListener('seeked', savePlayback);
window.addEventListener('beforeunload', savePlayback);
function advance(step, ended = false, forcePrevious = false) {
  if (!playback.queue.length) return;
  if (ended && repeat === 2) {
    startTrack();
    return;
  }
  if (step < 0 && audio.currentTime > 3 && !forcePrevious) {
    startTrack();
    if (!ended) navigateFromPlayer(true, true);
    return;
  }
  const next = playback.cursor + step;
  if (next >= playback.queue.length) {
    if (repeat !== 1) return;
    playback.select(0);
  } else if (next < 0) playback.select(0);
  else playback.select(next);
  startTrack();
  if (!ended) navigateFromPlayer(true, true, shuffle && step > 0);
}
function toggle() {
  if (!audio.src) {
    if (playback.queue.length) {
      playback.select(0);
      startTrack();
    } else playVisible(undefined, browsingTracks());
  } else if (audio.paused) audio.play().catch(() => toast('Unable to play this file.'));
  else audio.pause();
}
const queueViewCache = createQueueViewCache();
function renderQueue({ reveal = true } = {}) {
  prepareGaplessNext();
  if (
    !queueViewCache.changed(playback.queue, playback.cursor, trackLookup, prefs.queueDisplayCount)
  )
    return;
  const container = $('queue-list'),
    scrollTop = container.scrollTop;
  container.replaceChildren();
  if (!playback.queue.length) container.append(el('p', 'Your queue is empty.'));
  // Only render a window around the current item for large collections.
  const { start, end } = queuePage(playback.queue.length, playback.cursor, prefs.queueDisplayCount);
  for (let i = start; i < end; i++) {
    const track = trackLookup.get(playback.queue[i]);
    if (!track) continue;
    const item = el('button', null, 'queue-item'),
      text = el('span', null, 'queue-track-text');
    text.append(el('span', track.title, 'queue-track-title'), el('small', track.artist));
    item.append(cover(track), text);
    item.setAttribute('aria-label', `${track.title} — ${track.artist}`);
    item.classList.toggle('active', i === playback.cursor);
    item.oncontextmenu = (event) => {
      event.preventDefault();
      showActions(track, event);
      if (i !== playback.cursor) {
        const remove = el('button', 'Remove from queue');
        remove.onclick = () => {
          closeContextMenu();
          const before = captureQueue();
          playback.remove(i);
          renderQueue();
          rememberQueueEdit(before, 'Removed track from queue');
        };
        $('track-actions').append(remove);
        normalizeContextMenu();
      }
    };
    item.onkeydown = (event) => {
      if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
        event.preventDefault();
        item.oncontextmenu(event);
      }
    };
    item.onclick = () => {
      selection.tracks.current = track.id;
      playback.select(i);
      startTrack(null, false, { preserveQueueScroll: true });
    };
    makeDraggable(item, () => ({ ids: [track.id], queueIndex: i }));
    bindDrop(item, (payload) => dropOnQueue(payload, i));
    container.append(item);
  }
  bindDrop(container, (payload) =>
    dropOnQueue(
      payload,
      typeof payload.queueIndex === 'number'
        ? playback.queue.length
        : Math.max(0, playback.cursor + 1),
    ),
  );
  container.scrollTop = scrollTop;
  if (reveal && !$('queue-panel').hidden) revealPlayingQueueItem();
}
$('all').onclick = () => setScope({ kind: 'all' });
$('all').ondblclick = () => playRandomCollection({ kind: 'all' });
$('add-library').onclick = $('empty-add').onclick = addLibrary;
$('add-playlist').onclick = createPlaylist;
function syncSearchClear() {
  $('clear-search').hidden = !$('search').value;
}
function cancelSearch() {
  clearTimeout(searchTimer);
  $('search').value = '';
  query = '';
  searchResultIds = null;
  selection.albumDetail = null;
  selection.tracks.current = null;
  selection.tracks.clear();
  selection.tracks.anchor = null;
  syncSearchClear();
  render();
}
$('clear-search').onclick = () => {
  cancelSearch();
  $('search').focus();
};
let searchTimer;
$('search').oninput = () => {
  selection.artists.current = null;
  selection.artists.clear();
  selection.artists.anchor = null;
  selection.coverFocus = null;
  syncSearchClear();
  searchResultIds = null;
  $('create-search-playlist')?.remove();
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    query = $('search').value;
    selection.tracks.current = null;
    selection.tracks.clear();
    selection.tracks.anchor = null;
    selection.albumDetail = null;
    render();
  }, 120);
};
$('search').onkeydown = (event) => {
  if (event.isComposing) return;
  if (event.key === 'ArrowDown') {
    event.preventDefault();
    event.stopPropagation();
    clearTimeout(searchTimer);
    query = $('search').value;
    selection.albumDetail = null;
    selection.artists.current = null;
    selection.artists.clear();
    render();
    selection.pane = 'artists';
    navigateBrowse(1);
    paintPaneFocus(true);
  } else if (event.key === 'Enter') {
    event.preventDefault();
    clearTimeout(searchTimer);
    query = $('search').value;
    selection.albumDetail = null;
    selection.tracks.current = null;
    selection.tracks.clear();
    selection.tracks.anchor = null;
    render();
    searchResultIds = query.trim() && !compileSearch(query).error ? visible.map((t) => t.id) : null;
    renderBrowser();
    selection.pane = 'tracks';
    focusBrowseSelection(true);
    event.stopPropagation();
  } else if (event.key === 'Escape') {
    event.preventDefault();
    event.stopPropagation();
    cancelSearch();
    $('search').blur();
    selection.pane = 'tracks';
    focusBrowseSelection();
  }
};
$('sort').onchange = () => {
  sort = $('sort').value;
  if (sort === 'random') randomSortSeed = Math.floor(Math.random() * 0x7fffffff);
  render();
};
$('direction').onclick = () => {
  if (sort === 'random') {
    randomSortSeed = Math.floor(Math.random() * 0x7fffffff);
    render();
    return;
  }
  direction *= -1;
  setIcon($('direction'), direction === 1 ? 'up' : 'down');
  $('direction').title =
    direction === 1 ? 'Ascending — switch to descending' : 'Descending — switch to ascending';
  render();
};
document.querySelectorAll('[data-sort]').forEach(
  (button) =>
    (button.onclick = () => {
      sort = button.dataset.sort;
      $('sort').value = sort;
      render();
    }),
);
$('toggle').onclick = toggle;
$('previous-track').onclick = () => advance(-1);
$('next-track').onclick = () => advance(1);
$('shuffle').onclick = () => {
  shuffle = !shuffle;
  updateSettings({ shuffle, ...(shuffle ? { repeat: 0 } : {}) });
  if (playback.cursor >= 0) {
    playback.setShuffled(shuffle);
    renderQueue();
  }
};
$('repeat').onclick = () => {
  const next = (repeat + 1) % 3;
  if (next && shuffle) $('shuffle').click();
  repeat = next;
  updateSettings({ repeat, ...(repeat ? { shuffle: false } : {}) });
  prepareGaplessNext();
  if (!$('queue-panel').hidden) revealPlayingQueueItem();
};

$('queue').onclick = () => setQueueVisible($('queue-panel').hidden);
$('close-queue').onclick = () => setQueueVisible(false);
$('volume').oninput = () => {
  audio.volume = Number($('volume').value);
  audio.muted = false;
};
$('volume').onchange = () => updateSettings({ volume: Number($('volume').value) });
function setSeekValue() {
  try {
    const time = seekTo(audio, $('seek').value, currentTrack()?.duration || 0);
    if (time !== null) $('elapsed').textContent = formatTime(time);
    paintWaveformProgress();
  } catch {
    toast('This file is not ready to seek yet.');
  }
}
function pointerSeek(event) {
  const rect = $('seek').getBoundingClientRect();
  if (rect.width > 0) {
    $('seek').value = Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100));
    setSeekValue();
  }
}
$('seek').onpointerdown = (event) => {
  if (event.button !== undefined && event.button !== 0) return;
  event.preventDefault();
  seeking = true;
  document.activeElement?.blur();
  document.body.focus({ preventScroll: true });
  $('seek').setPointerCapture?.(event.pointerId);
  pointerSeek(event);
};
$('seek').onpointermove = (event) => {
  if (seeking) pointerSeek(event);
};
$('seek').oninput = setSeekValue;
$('seek').addEventListener('keydown', (event) => {
  if (
    [
      'ArrowLeft',
      'ArrowRight',
      'ArrowUp',
      'ArrowDown',
      'Home',
      'End',
      'PageUp',
      'PageDown',
      ' ',
    ].includes(event.key)
  )
    event.preventDefault();
});
$('seek').onchange = () => {
  setSeekValue();
  seeking = false;
};
$('seek').onpointerup = (event) => {
  if (seeking) pointerSeek(event);
  seeking = false;
  if ($('seek').hasPointerCapture?.(event.pointerId))
    $('seek').releasePointerCapture(event.pointerId);
};
$('seek').onpointercancel = () => {
  seeking = false;
};
audio.ontimeupdate = () => {
  if (!audio.seeking) listener.sample(audio.currentTime);
  if (seeking) return;
  $('elapsed').textContent = formatTime(audio.currentTime);
  const duration =
    Number.isFinite(audio.duration) && audio.duration > 0
      ? audio.duration
      : currentTrack()?.duration || 0;
  $('seek').value = duration ? (audio.currentTime / duration) * 100 : 0;
  paintWaveformProgress();
};
audio.onloadedmetadata = () => {
  $('duration').textContent = formatTime(
    Number.isFinite(audio.duration) ? audio.duration : currentTrack()?.duration || 0,
  );
};
audio.onplay = () => setIcon($('toggle'), 'pause');
audio.onpause = () => {
  listener.pause(audio.currentTime);
  setIcon($('toggle'), 'play');
};
audio.addEventListener('playing', () => {
  if (!listener.current && currentTrack()) listener.begin(currentTrack());
  listener.playing(audio.currentTime);
});
audio.addEventListener('waiting', () => listener.pause(audio.currentTime));
audio.addEventListener('seeking', () => {
  if (listener.current) listener.current.playing = false;
  listener.seek(audio.currentTime);
});
audio.addEventListener('seeked', () => {
  listener.seek(audio.currentTime);
  if (!audio.paused) listener.playing(audio.currentTime);
});
audio.addEventListener('emptied', () => {
  if (listener.current) listener.current.playing = false;
});
audio.onended = () => {
  listener.end(audio.currentTime);
  setIcon($('toggle'), 'play');
  advance(1, true);
};
audio.onerror = () =>
  toast('Unable to play this file. It may be missing or use an unsupported codec.');
document.onkeydown = (event) => {
  if (event.isComposing) return;
  if (!document.querySelector('dialog[open]') && event.target.closest?.('.empty-actions')) {
    if (['Enter', ' '].includes(event.key) && !event.ctrlKey && !event.metaKey && !event.altKey)
      return;
    if (event.key === 'Tab' && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      if (event.shiftKey) {
        selection.pane = 'sidebar';
        focusBrowseSelection(true);
      } else if (
        event.target.id === 'empty-add' &&
        !$('empty-import').hidden &&
        !$('empty-import').disabled
      ) {
        $('empty-import').focus({ preventScroll: true });
      } else {
        selection.pane = 'artists';
        focusBrowseSelection(true);
      }
      return;
    }
  }
  if (recordingShortcut) {
    event.preventDefault();
    event.stopPropagation();
    if (event.key === 'Escape') {
      const key = recordingShortcut;
      recordingShortcut = null;
      renderShortcutEditor();
      focusShortcutBinding(key);
      return;
    }
    if (['Control', 'Meta', 'Alt', 'Shift'].includes(event.key)) return;
    const binding = shortcutSignature(event),
      key = recordingShortcut;
    if (
      !/^(Mod\+)?(Alt\+)?(Shift\+)?([a-z0-9]|F([1-9]|1[0-2])|ArrowLeft|ArrowRight|ArrowUp|ArrowDown|Space|Delete|Backspace|Enter|Plus)$/.test(
        binding,
      ) ||
      [
        'Enter',
        'ArrowUp',
        'ArrowDown',
        'ArrowLeft',
        'ArrowRight',
        'Shift+ArrowUp',
        'Shift+ArrowDown',
      ].includes(binding)
    ) {
      $('settings-error').textContent =
        'Choose a letter, number, function key, or modified key. Tab, Enter and unmodified arrows are reserved for navigation.';
      $('settings-error').hidden = false;
      return;
    }
    const next = { ...(prefs.shortcuts || shortcutDefaults), [key]: binding };
    if (Object.values(next).filter((v) => v === binding).length > 1) {
      $('settings-error').textContent = 'That shortcut is already assigned.';
      $('settings-error').hidden = false;
      return;
    }
    recordingShortcut = null;
    updateSettings({ shortcuts: next });
    renderShortcutEditor();
    focusShortcutBinding(key);
    return;
  }
  const typing =
    (['INPUT', 'SELECT', 'TEXTAREA'].includes(event.target.tagName) &&
      !['seek', 'volume'].includes(event.target.id)) ||
    event.target.isContentEditable;
  if (
    !typing &&
    !document.querySelector('dialog[open]') &&
    shortcutSignature(event) === (prefs.shortcuts || shortcutDefaults).contextMenu
  ) {
    event.preventDefault();
    if (!event.repeat) openFocusedContextMenu();
    return;
  }
  if (
    !typing &&
    !document.querySelector('dialog[open]') &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.altKey
  ) {
    if (
      event.key === 'Backspace' &&
      !event.shiftKey &&
      $('context-menu').hidden &&
      (selection.pane === 'artists' ||
        (selection.pane === 'tracks' &&
          !(view === 'covers' && selection.albumDetail && !selection.tracks.size)))
    ) {
      event.preventDefault();
      if (!event.repeat) deselectBrowse();
      return;
    }
    if (
      event.key === 'Backspace' &&
      !event.shiftKey &&
      selection.pane === 'tracks' &&
      view === 'covers' &&
      selection.albumDetail &&
      $('context-menu').hidden
    ) {
      event.preventDefault();
      $('browse-navigation').querySelector('button')?.click();
      const button = coverButtons().find((b) => b.dataset.albumKey === selection.coverFocus);
      button?.focus({ preventScroll: true });
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      if (!$('context-menu').hidden) {
        closeContextMenu();
        return;
      }
      escapeBrowse();
      return;
    }
    if (
      selection.pane === 'tracks' &&
      view === 'covers' &&
      !selection.albumDetail &&
      ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Enter'].includes(event.key)
    ) {
      event.preventDefault();
      if (event.key === 'Enter') {
        const button =
          coverButtons().find((b) => b.dataset.albumKey === selection.coverFocus) ||
          coverButtons()[0];
        if (button) openCoverSelection(button.dataset.albumKey);
      } else navigateCovers(event.key, event.shiftKey);
      return;
    }
    if (['ArrowLeft', 'ArrowRight'].includes(event.key) && !event.shiftKey) {
      event.preventDefault();
      selection.cyclePane(event.key === 'ArrowRight' ? 1 : -1);
      focusBrowseSelection(true);
      return;
    }
    if (event.key === 'Enter' && selection.pane === 'artists') {
      event.preventDefault();
      selection.pane = 'tracks';
      focusBrowseSelection(true);
      return;
    }
    if (event.key === 'Tab') {
      event.preventDefault();
      selection.pane = event.shiftKey
        ? 'sidebar'
        : selection.pane === 'artists'
          ? 'tracks'
          : 'artists';
      focusBrowseSelection(true);
      return;
    }
    if (['ArrowUp', 'ArrowDown'].includes(event.key)) {
      event.preventDefault();
      navigateBrowse(event.key === 'ArrowDown' ? 1 : -1, event.shiftKey);
      return;
    }
    if (event.key === 'Enter' && selection.pane === 'sidebar') {
      event.preventDefault();
      const node = document.activeElement;
      if (sidebarNodes().includes(node)) {
        node.click();
        selection.pane = 'artists';
        focusBrowseSelection();
      }
      return;
    }
    if (event.key === 'Enter' && selection.pane === 'tracks' && selection.albumFocus) {
      event.preventDefault();
      toggleSelectedAlbums();
      return;
    }
    if (event.key === 'Enter' && selection.pane === 'tracks' && selection.tracks.current) {
      event.preventDefault();
      playVisible(selection.tracks.current);
      return;
    }
  }
  const sig = shortcutSignature(event),
    binding = Object.entries(prefs.shortcuts || shortcutDefaults).find(
      ([, value]) => value === sig,
    );
  if (binding) {
    const [action] = binding;
    if (action === 'columnHeadings' || action === 'deleteSelection') {
      if (!typing && !document.querySelector('dialog[open]') && $('context-menu').hidden) {
        event.preventDefault();
        if (!event.repeat && !busy) {
          if (action === 'columnHeadings') toggleColumnHeadings();
          else deleteBrowsingSelection();
        }
      }
      return;
    }
    if (action === 'quit') {
      if (!event.repeat) {
        event.preventDefault();
        api?.windowAction?.('quit').catch((error) => toast(error.message));
      }
      return;
    }
    if (globalShortcutStatus.active && ['previous', 'next', 'random'].includes(action)) return;
    if (['seekBackward', 'seekForward'].includes(action)) {
      if (!typing && !document.querySelector('dialog[open]')) {
        event.preventDefault();
        const limit = Number.isFinite(audio.duration) ? audio.duration : currentTrack()?.duration;
        if (limit > 0)
          audio.currentTime = Math.max(
            0,
            Math.min(
              limit,
              (audio.currentTime || 0) + (action === 'seekForward' ? 1 : -1) * prefs.seekStep,
            ),
          );
      }
      return;
    }
    if (['resetSort', 'newPlaylist', 'newLibrary'].includes(action)) {
      if (
        (!typing || (action !== 'resetSort' && (event.ctrlKey || event.metaKey))) &&
        !document.querySelector('dialog[open]')
      ) {
        event.preventDefault();
        if (!event.repeat) {
          if (action === 'newPlaylist') createPlaylist();
          else if (action === 'newLibrary') addLibrary();
          else {
            sort =
              scope.kind === 'playlist' && !activePlaylist()?.dynamic?.enabled
                ? 'manual'
                : prefs.defaultSort;
            direction = 1;
            $('sort').value = sort;
            setIcon($('direction'), 'up');
            render();
          }
        }
      }
      return;
    }
    if (['cycleView', 'cycleSort'].includes(action)) {
      if (!typing && !document.querySelector('dialog[open]')) {
        event.preventDefault();
        if (!event.repeat) {
          if (action === 'cycleView') {
            const tabs = ['albums', 'covers', 'tracks'];
            $('view-' + tabs[(tabs.indexOf(view) + 1) % 3]).click();
          } else if (!$('sort').disabled) {
            const options = [...$('sort').options].filter((o) => !o.disabled),
              i = options.findIndex((o) => o.value === $('sort').value);
            $('sort').value = options[(i + 1) % options.length].value;
            $('sort').dispatchEvent(new Event('change'));
          }
        }
      }
      return;
    }
    if (action === 'undo' || action === 'redo') {
      if (!typing && !document.querySelector('dialog[open]')) {
        event.preventDefault();
        if (!event.repeat) undoEdit(action === 'redo');
      }
      return;
    }
    if (action === 'collapseAlbums' || action === 'collapseAllAlbums') {
      if (!typing && !document.querySelector('dialog[open]')) {
        event.preventDefault();
        if (!event.repeat) toggleSelectedAlbums(action === 'collapseAllAlbums');
      }
      return;
    }
    if (action === 'rename') {
      if (!typing && !document.querySelector('dialog[open]') && $('context-menu').hidden) {
        event.preventDefault();
        if (!event.repeat && !busy) fileNamesDialog?.open(selectedBrowsingTracks());
      }
      return;
    }
    if (action === 'addPlaylist') {
      if (!typing && !document.querySelector('dialog[open]')) {
        event.preventDefault();
        if (!event.repeat) openAddToPlaylist(selectedBrowsingTracks().map((t) => t.id));
      }
      return;
    }
    if (action === 'addQueue') {
      if (!typing && !document.querySelector('dialog[open]')) {
        event.preventDefault();
        if (!event.repeat) addSelectionToQueue();
      }
      return;
    }
    if (['shuffle', 'repeat'].includes(action)) {
      if (!typing && !document.querySelector('dialog[open]')) {
        event.preventDefault();
        if (!event.repeat) $(action).click();
      }
      return;
    }
    event = shortcutEvent(event, shortcutDefaults[action]);
  } else if (Object.values(shortcutDefaults).includes(sig)) return;

  const modifier = event.ctrlKey || event.metaKey;

  const editing =
    (!['seek', 'volume'].includes(event.target.id) &&
      ['INPUT', 'SELECT', 'TEXTAREA'].includes(event.target.tagName)) ||
    event.target.isContentEditable;
  const dialogOpen = !!document.querySelector('dialog[open]');
  const settingsOpen = $('settings-dialog').hasAttribute('open');
  if (
    !event.altKey &&
    !event.shiftKey &&
    modifier &&
    event.key.toLowerCase() === 'p' &&
    (!dialogOpen || settingsOpen)
  ) {
    event.preventDefault();
    if (!event.repeat) toggleSettings();
    return;
  }
  if (
    !navigator.mediaSession &&
    !editing &&
    !dialogOpen &&
    ['MediaTrackNext', 'MediaTrackPrevious'].includes(event.key)
  ) {
    event.preventDefault();
    if (!event.repeat) advance(event.key === 'MediaTrackNext' ? 1 : -1, false, true);
    return;
  }
  if (
    !modifier &&
    !event.altKey &&
    !event.shiftKey &&
    !editing &&
    !dialogOpen &&
    $('context-menu').hidden &&
    event.key.toLowerCase() === 'e'
  ) {
    event.preventDefault();
    if (event.repeat || busy) return;
    const tracks = selectedBrowsingTracks();
    if (!tracks.length && currentTrack()) tracks.push(currentTrack());
    if (tracks.length && tracks.every((t) => t.codec === 'MP3')) openTagEditor(tracks);
    return;
  }
  if (
    !modifier &&
    !event.altKey &&
    !event.shiftKey &&
    !editing &&
    !dialogOpen &&
    $('context-menu').hidden &&
    ['f', 'p', 'm'].includes(event.key.toLowerCase())
  ) {
    event.preventDefault();
    if (event.repeat || (busy && event.key.toLowerCase() !== 'm')) return;
    const key = event.key.toLowerCase();
    if (windowPresentation.transitioning) return;
    if (key === 'm') {
      toggleMini();
    } else if (key === 'p') $('queue').click();
    else api?.windowAction?.('maximize').catch((error) => toast(error.message));
    return;
  }
  if (
    !modifier &&
    !event.altKey &&
    !editing &&
    !dialogOpen &&
    $('context-menu').hidden &&
    ['Backspace', 'Delete'].includes(event.key)
  ) {
    const playlist = activePlaylist(),
      ids = displayedTracks()
        .filter((t) => selection.tracks.has(t.id))
        .map((t) => t.id);
    if (playlist && !playlist.dynamic?.enabled && ids.length) {
      event.preventDefault();
      if (!event.repeat && !busy) removePlaylistSelection(playlist, ids);
    }
    return;
  }
  if (modifier && !event.altKey && !editing && !dialogOpen && event.key.toLowerCase() === 'a') {
    if (selection.pane === 'artists') {
      event.preventDefault();
      const buttons = [...$('artist-list').querySelectorAll('[data-artist-key]')];
      selection.artists.clear();
      buttons.forEach((button) => selection.artists.add(button.dataset.artistKey));
      if (buttons.length) {
        selection.artists.current = buttons.some(
          (b) => b.dataset.artistKey === selection.artists.current,
        )
          ? selection.artists.current
          : buttons[0].dataset.artistKey;
        selection.artists.anchor = buttons[0].dataset.artistKey;
      }
      render();
      [...$('artist-list').querySelectorAll('[data-artist-key]')]
        .find((b) => b.dataset.artistKey === selection.artists.current)
        ?.focus({ preventScroll: true });
      return;
    }
    const tracks = displayedTracks();
    if (tracks.length) {
      event.preventDefault();
      selection.tracks.clear();
      tracks.forEach((track) => selection.tracks.add(track.id));
      selection.tracks.current = tracks[0].id;
      selection.tracks.anchor = tracks[0].id;
      paintSelection();
    }
    return;
  }
  if (
    modifier &&
    !event.altKey &&
    !editing &&
    !dialogOpen &&
    ['ArrowLeft', 'ArrowRight'].includes(event.key)
  ) {
    event.preventDefault();
    if (event.key === 'ArrowLeft') advance(-1, false, true);
    else if (event.shiftKey) randomNext();
    else advance(1);
    return;
  }
  if (modifier && !event.altKey && event.key.toLowerCase() === 'f' && !dialogOpen) {
    event.preventDefault();
    $('search').focus();
    $('search').select();
    return;
  }
  if (
    modifier &&
    !event.altKey &&
    !event.shiftKey &&
    !editing &&
    !dialogOpen &&
    /^[0-5]$/.test(event.key)
  ) {
    event.preventDefault();
    rateSelection(Number(event.key));
    return;
  }
  if (event.code === 'Space' && !modifier && !editing && !dialogOpen) {
    event.preventDefault();
    toggle();
  }
};
for (const [id, name] of Object.entries({
  'add-library': 'plus',
  'add-playlist': 'plus',
  'open-settings': 'settings',
  'close-settings': 'close',
  'playlist-settings-close': 'close',
  'close-queue': 'close',
  shuffle: 'shuffle',
  repeat: 'repeat',
  'previous-track': 'previous',
  'next-track': 'next',
  toggle: 'play',
  queue: 'queue',
  direction: 'up',
  'now-art': 'music',
}))
  setIcon($(id), name);
setIcon(document.querySelector('#all span'), 'grid');
setIcon(document.querySelector('.brandmark'), 'pulse');
const pulseAnimation = animatePulse(document.querySelector('.brandmark svg'), audio);
window.addEventListener('beforeunload', () => pulseAnimation.dispose());
document.querySelector('.brand').oncontextmenu = (event) => {
  event.preventDefault();
  event.stopPropagation();
  const button = el('button', 'Animate logo');
  button.setAttribute('role', 'menuitemcheckbox');
  paintMenuCheck(button, prefs.animateLogo !== false);
  button.onclick = () => {
    updateSettings({ animateLogo: prefs.animateLogo === false });
    paintMenuCheck(button, prefs.animateLogo !== false);
    closeContextMenu(true);
  };
  $('track-actions').replaceChildren(button);
  openContextMenu(event);
};
setIcon(document.querySelector('.search>span'), 'search');
if (api) {
  api.onProgress((count) => toast(`Indexing your music… ${count.toLocaleString()} files`, true));
  try {
    state = await api.load({ cached: true });
    initialLibraryRefresh = api.load();
    globalShortcutStatus = state.globalShortcutStatus || globalShortcutStatus;
    prefs = { ...prefs, ...state.settings };
    sort = prefs.defaultSort;
    $('sort').value = sort;
    view =
      prefs.lastView ||
      (prefs.defaultView === 'tracks'
        ? 'tracks'
        : prefs.albumView === 'covers'
          ? 'covers'
          : 'albums');
    if (!restoreBrowsingState(state.browsingSession)) chooseOpeningArtist();
    applyPreferences();
    render();
    restorePlayback();
    if (state.startupRefresh?.warnings?.length)
      toast(state.startupRefresh.warnings.join(' · '), true);
  } catch (error) {
    toast(error.message, true);
  }
} else {
  render();
  toast('Open Localtone with npm start to access music folders.', true);
}

function browsingAlbums() {
  return albumsFor(visible, null, sort, direction, {
    ratings: state.ratings,
    seed: randomSortSeed,
  });
}
function displayedTracks() {
  if (view === 'tracks') return visible;
  if (view === 'covers' && !selection.albumDetail) return [];
  return browsingAlbums()
    .filter(
      (album) =>
        (!selection.albumDetail || matchesOpenedAlbum(album.key)) &&
        (expandedAlbums.get(album.key) ??
          (!!selection.albumDetail || prefs.albumExpansion === 'expanded')),
    )
    .flatMap((album) => album.tracks);
}
function browsingTracks() {
  if (view === 'tracks') return visible;
  const albums = browsingAlbums();
  return albums
    .filter((a) => !selection.albumDetail || matchesOpenedAlbum(a.key))
    .flatMap((a) => a.tracks);
}
function renderArtistPane() {
  $('artist-pane').hidden = false;
  $('artist-resize').hidden = false;
  const list = $('artist-list'),
    previousScroll = list.scrollTop,
    signature = JSON.stringify(artistsFor(folderTracks, 'name', prefs.artistGrouping));
  if (list.dataset.signature === signature && !revealOpeningArtist) {
    for (const b of list.querySelectorAll('[data-artist-key]')) {
      b.classList.toggle(
        'active',
        selection.artists.size > 1
          ? selection.artists.has(b.dataset.artistKey)
          : b.dataset.artistKey === selection.artists.current,
      );
      b.setAttribute(
        'aria-pressed',
        String(
          selection.artists.size > 1
            ? selection.artists.has(b.dataset.artistKey)
            : b.dataset.artistKey === selection.artists.current,
        ),
      );
    }
    return;
  }
  list.dataset.signature = signature;
  list.replaceChildren();
  const labels = new Map(
    folderTracks.map((t) => [
      artistGroupKey(t, prefs.artistGrouping),
      artistGroupName(t, prefs.artistGrouping),
    ]),
  );
  for (const key of artistsFor(folderTracks, 'name', prefs.artistGrouping)) {
    const button = el('button', labels.get(key) || 'Music', 'artist-name');
    button.classList.toggle(
      'active',
      selection.artists.size > 1 ? selection.artists.has(key) : selection.artists.current === key,
    );
    button.setAttribute(
      'aria-pressed',
      String(
        selection.artists.size > 1 ? selection.artists.has(key) : selection.artists.current === key,
      ),
    );
    button.title = labels.get(key) || 'Music';
    bindFolderMenu(
      button,
      () => folderTracks.find((t) => artistGroupKey(t, prefs.artistGrouping) === key)?.id,
      'artist',
    );
    button.dataset.artistKey = key;
    button.ondblclick = () => {
      selection.artists.clear();
      selection.artists.anchor = key;
      selection.artists.current = key;
      selection.pane = 'artists';
      render();
      const first = albumsFor(
        selectTracks(state, scope, '', 'folder', 1, key, 0, prefs.artistGrouping),
        null,
      )[0]?.tracks[0];
      if (first) playVisible(first.id);
    };
    button.onclick = (event) => {
      selection.albumFocus = null;
      selection.albums.clear();
      selection.coverFocus = null;

      if (event.ctrlKey || event.metaKey || event.shiftKey) {
        selection.pane = 'artists';
        if (!selection.artists.size && selection.artists.current)
          selection.artists.add(selection.artists.current);
        if (event.shiftKey) {
          const keys = artistsFor(folderTracks, 'name', prefs.artistGrouping);
          selection.artists.range(keys, key, { additive: event.ctrlKey || event.metaKey });
        } else {
          selection.artists.toggle(key);
          selection.artists.anchor = key;
        }
        selection.artists.current = selection.artists.has(key)
          ? key
          : [...selection.artists].at(-1) || null;
        selection.tracks.clear();
        selection.tracks.current = null;
        selection.albumDetail = null;
        expandedAlbums.clear();
        render();
        return;
      }
      selection.artists.clear();
      selection.artists.anchor = key;
      selection.pane = 'artists';
      expandedAlbums.clear();
      selection.artists.current = selection.artists.current === key ? null : key;
      selection.albumDetail = null;
      selection.tracks.current = null;
      selection.tracks.clear();
      selection.tracks.anchor = null;
      render();
    };
    makeDraggable(button, () => ({
      ids: folderTracks
        .filter((t) =>
          selection.artists.has(key)
            ? selection.artists.has(artistGroupKey(t, prefs.artistGrouping))
            : artistGroupKey(t, prefs.artistGrouping) === key,
        )
        .map((t) => t.id),
    }));
    list.append(button);
  }
  if (!list.children.length)
    list.append(el('p', query ? 'No matching artists.' : 'No artists.', 'browse-empty'));
  list.scrollTop = previousScroll;
  if (revealOpeningArtist) {
    revealOpeningArtist = false;
    const active = list.querySelector('.active');
    if (active) {
      const item = active.getBoundingClientRect(),
        pane = list.getBoundingClientRect();
      if (item.top < pane.top) list.scrollTop += item.top - pane.top;
      else if (item.bottom > pane.bottom) list.scrollTop += item.bottom - pane.bottom;
    } else list.scrollTop = 0;
  }
}
function renderBrowser(viewportTop = document.querySelector('.content-scroll').scrollTop) {
  const container = $('browser'),
    nav = $('browse-navigation');
  container.dataset.albumLayout = prefs.albumLayout;
  container._disposeAlbums?.();
  for (const table of container.querySelectorAll('table')) table._disposeVirtual?.();
  container.replaceChildren();
  container.classList.toggle('album-multi-selection', selection.albums.size > 1);
  nav.replaceChildren();
  document.querySelector('.table-wrap').hidden = view !== 'tracks' || !visible.length;
  $('sort').closest('.track-sort').hidden = false;
  $('sort').disabled = false;
  $('direction').hidden = false;
  $('direction').disabled = false;
  $('sort').closest('.track-sort').classList.toggle('unavailable', false);
  setIcon($('direction'), sort === 'random' ? 'shuffle' : direction === 1 ? 'up' : 'down');
  $('direction').title =
    sort === 'random'
      ? 'Reshuffle'
      : direction === 1
        ? 'Ascending — switch to descending'
        : 'Descending — switch to ascending';
  container.hidden = view === 'tracks' || !visible.length;
  document.querySelector('.view-tabs').hidden = false;
  for (const name of ['albums', 'covers', 'tracks']) {
    const button = $(`view-${name}`);
    button.classList.toggle('active', view === name);
    button.setAttribute('aria-pressed', String(view === name));
    button.disabled = false;
  }
  const searchError = compileSearch(query).error;
  if (searchError) {
    const note = el('span', searchError, 'search-error');
    note.setAttribute('role', 'status');
    nav.append(note);
  }
  if (searchResultIds) {
    const button = el('button', 'Create playlist from results', 'chip browse-action');
    button.id = 'create-search-playlist';
    button.disabled = !searchResultIds.length;
    button.onclick = () => openPlaylistSettings(null, [...searchResultIds]);
    nav.append(button);
  }
  if (view === 'tracks') return;
  const breadcrumb = (label, handler) => {
    const button = el('button', null, 'chip browse-action');
    button.append(icon('back'), el('span', 'Back'));
    button.onclick = handler;
    nav.append(button);
  };
  if (selection.albumDetail)
    breadcrumb('← Back', () => {
      selection.tracks.current = null;
      selection.albumDetail = null;
      selection.albums.clear();
      if (selection.coverFocus) selection.albums.add(selection.coverFocus);
      render();
      if (view === 'covers')
        document.querySelector('.content-scroll').scrollTop = coverReturnScroll;
    });

  const albums = browsingAlbums();
  if (!visible.length) return;
  if (view === 'covers' && !selection.albumDetail) {
    container.classList.toggle('album-multi-selection', selection.albums.size > 1);
    const grid = el('div', null, 'cover-grid');
    for (const album of albums) {
      const button = el('button', null, 'album-cover-button');
      button.title = `${album.artist} — ${album.name}${album.year ? ` (${album.year})` : ''}`;
      button.setAttribute('aria-label', button.title);
      bindFolderMenu(button, () => album.tracks[0]?.id, 'album');
      makeDraggable(button, () => ({ ids: album.tracks.map((track) => track.id) }));
      button.append(cover(album.cover));
      button.dataset.albumKey = album.key;
      button.classList.toggle(
        'album-playing',
        album.tracks.some((track) => track.id === currentTrack()?.id),
      );
      button.onpointermove = () => button.classList.add('cover-hover');
      button.onpointerleave = () => button.classList.remove('cover-hover');
      button.classList.toggle(
        'cover-keyboard-selected',
        selection.albums.has(album.key) && selection.coverFocus === album.key,
      );
      button.classList.toggle('album-selected', selection.albums.has(album.key));
      button.onclick = (event) => {
        if (selectAlbumWithModifier(event, album.key)) return;
        selection.albums.clear();
        selection.albums.add(album.key);
        openCoverSelection(album.key);
      };
      grid.append(button);
    }
    if (!grid.children.length) grid.append(el('p', 'No albums.', 'browse-empty'));
    container.append(grid);
    return;
  }
  const displayed = selection.albumDetail
    ? albums.filter((a) => matchesOpenedAlbum(a.key))
    : albums;
  if (!displayed.length) container.append(el('p', 'No matching albums.', 'browse-empty'));
  const scroller = document.querySelector('.content-scroll'),
    lazy = displayed.length > 30 && typeof IntersectionObserver !== 'undefined';
  const observer = lazy
    ? new IntersectionObserver(
        (entries) => {
          for (const entry of entries)
            if (entry.isIntersecting) {
              entry.target._mountAlbum?.();
              observer.unobserve(entry.target);
            }
          syncScrollbarControls();
        },
        { root: scroller, rootMargin: '600px 0px' },
      )
    : null;
  container._disposeAlbums = () => {
    observer?.disconnect();
    container._disposeAlbums = null;
  };
  let offset = 0;
  const selectionSource = displayed
    .filter(
      (a) =>
        expandedAlbums.get(a.key) ??
        (!!selection.albumDetail || prefs.albumExpansion === 'expanded'),
    )
    .flatMap((a) => a.tracks);
  for (const album of displayed) {
    const open =
      expandedAlbums.get(album.key) ??
      (!!selection.albumDetail || prefs.albumExpansion === 'expanded');
    const contentHeight = album.tracks.length * 28 + (prefs.showColumnHeaders ? 30 : 0) + 8;
    const height =
      prefs.albumLayout === 'side'
        ? open
          ? Math.max(128, 42 + contentHeight) + 17
          : 65
        : 55 + (open ? contentHeight : 0);
    const section = el('section', null, 'album-section');
    section.dataset.albumKey = album.key;
    section.classList.toggle('album-navigation-focus', selection.albumFocus === album.key);
    section._trackIds = album.tracks.map((t) => t.id);
    section.classList.toggle('album-selected', selection.albums.has(album.key));
    section.classList.toggle('album-open', open);
    section.classList.toggle(
      'album-playing',
      album.tracks.some((track) => track.id === currentTrack()?.id),
    );
    section.classList.toggle(
      'album-has-selection',
      album.tracks.some((t) => selection.tracks.has(t.id)),
    );
    section.style.minHeight = `${height}px`;
    section._mountAlbum = () => {
      if (section.dataset.mounted) return;
      section.dataset.mounted = 'true';
      section.style.minHeight = '';
      const heading = el('div', null, 'album-heading');
      const toggle = el('button', null, 'album-expand');
      toggle.setAttribute('aria-expanded', String(open));
      if (prefs.albumLayout !== 'side') toggle.append(cover(album.cover));
      const info = el('span', album.name, 'album-info');
      info.append(
        el(
          'small',
          (prefs.albumDetails || ['artist', 'year', 'tracks', 'duration'])
            .map(
              (key) =>
                ({
                  artist: album.artist,
                  year: album.year,
                  tracks: `${album.tracks.length} tracks`,
                  duration: formatTime(album.tracks.reduce((sum, t) => sum + (t.duration || 0), 0)),
                  genre: [...new Set(album.tracks.map((t) => t.genre).filter(Boolean))].join(', '),
                  format: [...new Set(album.tracks.map((t) => t.codec))].join(', '),
                })[key],
            )
            .filter(Boolean)
            .join(' · '),
        ),
      );
      toggle.append(info);
      const toggleAlbum = (event) => {
        if (selectAlbumWithModifier(event, album.key)) return;
        selection.albums.clear();
        const returnToCovers = view === 'covers' && !!selection.albumDetail,
          top = section.getBoundingClientRect().top;
        selection.tracks.clear();
        selection.tracks.current = null;
        selection.albumFocus = album.key;
        if (selection.albumDetail) selection.albumDetail = null;
        else expandedAlbums.set(album.key, !open);
        render();
        if (returnToCovers) scroller.scrollTop = coverReturnScroll;
        else {
          const replacement = [...$('browser').querySelectorAll('[data-album-key]')].find(
            (node) => node.dataset.albumKey === album.key,
          );
          replacement?._mountAlbum?.();
          if (replacement) scroller.scrollTop += replacement.getBoundingClientRect().top - top;
        }
      };
      if (prefs.albumLayout === 'side') {
        const art = el('button', null, 'album-side-cover');
        art.append(cover(album.cover));
        art.setAttribute('aria-label', `${open ? 'Collapse' : 'Expand'} ${album.name}`);
        art.setAttribute('aria-expanded', String(open));
        art.onclick = toggleAlbum;
        bindFolderMenu(art, () => album.tracks[0]?.id, 'album');
        makeDraggable(art, () => ({ ids: album.tracks.map((t) => t.id) }));
        section.append(art);
      }
      toggle.onclick = (event) => {
        if (event.target.closest('.cover')) {
          toggleAlbum(event);
          return;
        }
        if (selectAlbumWithModifier(event, album.key)) return;
        selection.pane = 'tracks';
        selection.albumFocus = album.key;
        selection.albums.select(album.key);
        selection.tracks.reset();
        for (const track of album.tracks) selection.tracks.add(track.id);
        selection.tracks.current = album.tracks[0]?.id ?? null;
        paintSelection();
        paintAlbumSelection();
        toggle.focus({ preventScroll: true });
      };
      bindFolderMenu(toggle, () => album.tracks[0]?.id, 'album');
      makeDraggable(toggle, () => ({ ids: album.tracks.map((track) => track.id) }));
      heading.append(toggle);
      section.append(heading);
      if (open) {
        const list = el('div', null, 'album-tracks'),
          table = el('table');
        buildTrackTable(table, album.tracks, selectionSource);
        list.append(table);
        section.append(list);
        table._resizeColumns?.();
        if (typeof requestAnimationFrame === 'function')
          requestAnimationFrame(() => table.isConnected && table._resizeColumns?.());
      }
    };
    container.append(section);
    if (
      !lazy ||
      (offset + height >= viewportTop - 600 &&
        offset <= viewportTop + (scroller.clientHeight || 600) + 600)
    )
      section._mountAlbum();
    else observer.observe(section);
    offset += height;
  }
}
for (const name of ['albums', 'covers', 'tracks']) {
  $(`view-${name}`).oncontextmenu = showTabMenu;
  $(`view-${name}`).addEventListener('keydown', (event) => {
    if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) showTabMenu(event);
  });
  $(`view-${name}`).onclick = () => {
    selection.albumFocus = null;
    selection.albums.clear();
    selection.albums.anchor = null;
    expandedAlbums.clear();
    selection.tracks.current = null;
    selection.tracks.clear();
    selection.tracks.anchor = null;
    changeView(name);
    selection.albumDetail = null;
    selection.pane = 'tracks';
    render();
    focusBrowseSelection();
  };
}
const tagLabels = {
  title: 'Title',
  artist: 'Artist',
  albumArtist: 'Album artist',
  album: 'Album',
  year: 'Year',
  genre: 'Genre',
  track: 'Track number',
  disc: 'Disc number',
};
const tagEditor = createTagEditor({
  document,
  api,
  el,
  tagLabels,
  dialogs,
  isBusy: () => busy,
  setAppBusy: (value) => {
    busy = value;
    setBusy(value);
  },
  currentTrack,
  audio,
  releaseTrack: (ids, work) =>
    withReleasedTrack(ids.includes(currentTrack()?.id) ? currentTrack().id : null, work),
  confirmMultiple: () => prefs.confirmMultiFileTags !== false,
  getSections: () => prefs,
  saveSections: updateSettings,
  getLeadingZeros: () => prefs.lookupLeadingZeros,
  saveLeadingZeros: (value) => updateSettings({ lookupLeadingZeros: value }),
  albumKey,
  onSaved: (result) => rememberTagEdit(result, result.saved),
  applyTagState: applyFileState,
  getTrack: (id) => trackLookup.get(id),
  toast,
  clearNotice: () => {
    clearTimeout(toastTimer);
    $('toast').hidden = true;
  },
});
function applyFileState(value) {
  const pane = document.querySelector('.content-scroll'),
    top = pane.scrollTop,
    updated = new Map(value.tracks.map((t) => [t.id, t])),
    albums = new Map(),
    artists = new Map();
  for (const old of state.tracks) {
    const next = updated.get(old.id);
    if (!next) continue;
    albums.set(albumKey(old), albumKey(next));
    const key = artistGroupKey(old, prefs.artistGrouping);
    if (!artists.has(key)) artists.set(key, new Set());
    artists.get(key).add(artistGroupKey(next, prefs.artistGrouping));
  }
  for (const key of ['albumDetail', 'albumFocus', 'coverFocus'])
    if (selection[key]) selection[key] = albums.get(selection[key]) || selection[key];
  for (const group of [selection.albums, selection.openedAlbums]) {
    const keys = [...group].map((key) => albums.get(key) || key),
      anchor = group.anchor;
    group.clear();
    keys.forEach((key) => group.add(key));
    group.anchor = albums.get(anchor) || anchor;
  }
  const expanded = [...expandedAlbums];
  expandedAlbums.clear();
  expanded.forEach(([key, open]) => expandedAlbums.set(albums.get(key) || key, open));
  const artistKeys = [...selection.artists].flatMap((key) => [
      ...(artists.get(key) || new Set([key])),
    ]),
    current = selection.artists.current,
    anchor = selection.artists.anchor;
  selection.artists.clear();
  artistKeys.forEach((key) => selection.artists.add(key));
  selection.artists.current = artists.get(current)?.values().next().value || current;
  selection.artists.anchor = artists.get(anchor)?.values().next().value || anchor;
  state = value;
  if (
    selection.artists.current &&
    !artistsFor(state.tracks, 'name', prefs.artistGrouping).includes(selection.artists.current)
  )
    selection.artists.current = null;
  render({ preserveScroll: true });
  const playing = currentTrack();
  if (playing) {
    $('now-title').textContent = playing.title;
    $('now-artist').textContent = playing.artist;
  }
  pane.scrollTop = top;
}
function rememberTagEdit(result, ids) {
  if (result?.undoToken) rememberEdit({ type: 'tags', token: result.undoToken, ids: ids || [] });
}
const duplicatesDialog = createDuplicatesDialog({
  document,
  api,
  dialogs,
  applyState: (value) => {
    const old = currentTrack();
    applyFileState(value);
    playback.prune((id) => trackLookup.has(id));
    if (old && !trackLookup.has(old.id)) {
      ++playGeneration;
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      listener.clear();
      playback.select(-1);
      $('now-title').textContent = 'Nothing playing';
      $('now-artist').textContent = '';
      $('now-art').replaceChildren();
      waveformPeaks = null;
      applyWaveformAppearance();
    }
    renderQueue();
  },
  releaseTrack: (ids, work) =>
    withReleasedTrack(ids.includes(currentTrack()?.id) ? currentTrack().id : null, work),
});
$('open-duplicates').onclick = () => duplicatesDialog.open();
const fileNamesDialog =
  typeof createFileNamingDialog === 'function'
    ? createFileNamingDialog({
        document,
        api,
        dialogs,
        getSettings: () => prefs,
        saveSettings: (patch) => updateSettings(patch),
        releaseTrack: (ids, work) =>
          withReleasedTrack(ids.includes(currentTrack()?.id) ? currentTrack().id : null, work),
        applyState: applyFileState,
        remember: (entry) => rememberEdit(entry),
        onError: toast,
      })
    : null;
function appendNamingAction(tracks) {
  if (!tracks.length) return;
  const button = el('button', 'Rename files and folders…');
  button.onclick = () => {
    closeContextMenu();
    fileNamesDialog?.open(tracks);
  };
  $('track-actions').append(button);
}
function openTagEditor(tracks) {
  return tagEditor.open(tracks);
}
window.addEventListener('beforeunload', () => {
  tagEditor.dispose();
  fileNamesDialog?.dispose();
});

function paintSelection() {
  for (const section of document.querySelectorAll('.album-section'))
    section.classList.toggle(
      'album-has-selection',
      section._trackIds?.some((id) => selection.tracks.has(id)) ?? false,
    );
  document.querySelectorAll('[data-track-id]').forEach((row) => {
    const selected = selection.tracks.has(row.dataset.trackId);
    row.classList.toggle('selected', selected);
    row.setAttribute('aria-selected', String(selected));
  });
}
function selectTrack(id) {
  selection.albumFocus = null;
  selection.albums.clear();
  paintAlbumSelection();
  for (const n of document.querySelectorAll('.album-navigation-focus'))
    n.classList.remove('album-navigation-focus');
  selection.tracks.select(id);
  paintSelection();
}
function bindTrackRow(row, track, source) {
  makeDraggable(row, () => {
    if (!selection.tracks.has(track.id)) selectTrack(track.id);
    return {
      ids: displayedTracks()
        .filter((t) => selection.tracks.has(t.id))
        .map((t) => t.id),
      originPlaylist: scope.kind === 'playlist' ? scope.id : null,
    };
  });
  row.dataset.trackId = track.id;
  row.classList.toggle('selected', selection.tracks.has(track.id));
  row.setAttribute('aria-selected', String(selection.tracks.has(track.id)));
  row.addEventListener('click', (event) => {
    selection.albumFocus = null;
    for (const n of document.querySelectorAll('.album-navigation-focus'))
      n.classList.remove('album-navigation-focus');
    selection.albums.clear();
    selection.pane = 'tracks';
    if (event.target.closest('button')) return;
    const ids = source.map((t) => t.id),
      a = ids.indexOf(selection.tracks.anchor);
    if (event.shiftKey && a >= 0) {
      selection.tracks.range(ids, track.id, { additive: event.metaKey || event.ctrlKey });
      selection.tracks.current = track.id;
      paintSelection();
    } else if (event.metaKey || event.ctrlKey) {
      selection.tracks.toggle(track.id);
      selection.tracks.current = track.id;
      selection.tracks.anchor = track.id;
      paintSelection();
    } else selectTrack(track.id);
  });
  row.oncontextmenu = (event) => {
    event.preventDefault();
    showActions(track, event);
  };
  row.addEventListener('keydown', (event) => {
    if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
      event.preventDefault();
      showActions(track, event);
    }
  });
}
function bindSidebarItem(button, item, kind) {
  button.oncontextmenu = (event) => {
    event.preventDefault();
    showCollectionActions(item, kind, event);
  };
  button.onkeydown = (event) => {
    if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
      event.preventDefault();
      showCollectionActions(item, kind, event);
    }
  };
  if (kind !== 'playlist') return;
  bindDrop(button, (payload) => dropOnPlaylist(item.id, payload));
  const trackOver = button.ondragover,
    trackDrop = button.ondrop;
  button.draggable = true;
  button.ondragstart = (event) => {
    playlistDragId = item.id;
    dragPayload = null;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('application/x-localtone-playlist', item.id);
    button.classList.add('dragging');
  };
  button.ondragend = () => {
    playlistDragId = null;
    button.classList.remove('dragging');
    document
      .querySelectorAll('.drop-target')
      .forEach((n) => n.classList.remove('drop-target', 'add-target', 'reorder-target'));
  };
  button.ondragover = (event) => {
    if (!playlistDragId) {
      if (item.dynamic?.enabled) {
        if (hasFileDrop(event)) event.preventDefault();
        if (event.dataTransfer) event.dataTransfer.dropEffect = 'none';
        return;
      }
      if (hasFileDrop(event)) {
        event.preventDefault();
        button.classList.add('drop-target', 'add-target');
        event.dataTransfer.dropEffect = 'copy';
        return;
      }
      if (dragPayload) button.classList.add('add-target');
      trackOver(event);
      if (dragPayload) event.dataTransfer.dropEffect = 'copy';
      return;
    }
    button.classList.add('reorder-target');
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    button.classList.add('drop-target');
  };
  button.ondragleave = () => button.classList.remove('drop-target', 'add-target', 'reorder-target');
  button.ondrop = (event) => {
    button.classList.remove('add-target', 'reorder-target');
    if (!playlistDragId && hasFileDrop(event)) {
      event.preventDefault();
      event.stopPropagation();
      button.classList.remove('drop-target');
      dropFilesOnPlaylist(item.id, event.dataTransfer.files);
      return;
    }
    if (!playlistDragId) return trackDrop(event);
    event.preventDefault();
    event.stopPropagation();
    button.classList.remove('drop-target', 'add-target', 'reorder-target');
    const ids = state.playlists.map((p) => p.id),
      from = ids.indexOf(playlistDragId),
      to = ids.indexOf(item.id);
    playlistDragId = null;
    if (from < 0 || from === to) return;
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    operation(() => api.playlist({ type: 'reorder', ids }), null);
  };
}
function cleanupRemovedPlayback() {
  const playing = currentTrack();
  playback.prune((id) => trackLookup.has(id));
  if (!playing) {
    waveformPeaks = null;
    ++waveformGeneration;
    api.cancelWaveform?.().catch(() => {});
    applyWaveformAppearance();
    listener.clear();
    ++playGeneration;
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    playback.select(-1);
    $('now-title').textContent = 'Nothing playing';
    $('now-artist').textContent = '';
    $('now-album').textContent = '';
    $('now-artist').disabled = true;
    $('now-album').disabled = true;
    $('now-separator').hidden = true;
    $('now-art').replaceChildren();
    $('now-art').disabled = true;
    $('seek').value = 0;
    $('elapsed').textContent = '0:00';
    $('duration').textContent = '0:00';
  }
}
async function deleteCollection(item, kind) {
  if (busy) return;
  if (kind === 'library') {
    if (
      !confirm(
        'Remove this library from Localtone? Its tracks will also be removed from playlists and the queue. Music files stay on disk.',
      )
    )
      return;
    const result = await operation(() => api.deleteLibrary(item.id));
    if (!result) return;
    cleanupRemovedPlayback();
    if (scope.kind === 'library' && scope.id === item.id) setScope({ kind: 'all' });
    else render();
  } else {
    if (confirm('Delete this playlist? Your music files will stay untouched.')) {
      const result = await operation(() => api.playlist({ type: 'delete', id: item.id }));
      if (result && scope.kind === 'playlist' && scope.id === item.id) setScope({ kind: 'all' });
    }
  }
}
async function deleteBrowsingSelection() {
  if (busy) return;
  if (selection.pane === 'sidebar') {
    const node = document.activeElement,
      kind = node?.dataset.sourceKind,
      id = node?.dataset.sourceId;
    const item = (kind === 'library' ? state.libraries : state.playlists).find(
      (item) => item.id === id,
    );
    if (item && ['library', 'playlist'].includes(kind)) await deleteCollection(item, kind);
    return;
  }
  const playlist = activePlaylist(),
    tracks = selectedBrowsingTracks();
  if (!playlist || playlist.dynamic?.enabled || !tracks.length) return;
  if (
    confirm(
      `Remove ${tracks.length} ${tracks.length === 1 ? 'track' : 'tracks'} from “${playlist.name}”? Music files will stay on disk.`,
    )
  )
    await removePlaylistSelection(
      playlist,
      tracks.map((track) => track.id),
    );
}
function appendDeleteFilesAction(tracks) {
  const ids = [...new Set(tracks.filter(Boolean).map((track) => track.id))];
  if (!ids.length) return;
  const button = el('button', 'Delete files permanently…');
  button.onclick = async () => {
    closeContextMenu();
    if (busy) return;
    const result = await withReleasedTrack(
      ids.includes(currentTrack()?.id) ? currentTrack().id : null,
      () => operation(() => api.deleteFiles(ids), 'Deleting selected files…'),
    );
    if (!result || result.cancelled) return;
    cleanupRemovedPlayback();
    for (const id of result.removed || []) selection.tracks.delete(id);
    selection.albums.clear();
    render({ preserveScroll: true });
    if (result.failures?.length)
      toast(`${result.failures.length} files could not be deleted. ${result.failures[0].message}`);
  };
  $('track-actions').append(button);
}
function toggleColumnHeadings() {
  updateSettings({ showColumnHeaders: !prefs.showColumnHeaders });
}
function showTabMenu(event) {
  event.preventDefault();
  event.stopPropagation();
  const menu = $('track-actions'),
    button = el('button', 'Show column headings');
  button.setAttribute('role', 'menuitemcheckbox');
  button.setAttribute('aria-checked', String(prefs.showColumnHeaders));
  paintMenuCheck(button, prefs.showColumnHeaders);
  button.onclick = () => {
    closeContextMenu();
    toggleColumnHeadings();
  };
  menu.replaceChildren(button);
  openContextMenu(event);
}
function showCollectionActions(item, kind, event) {
  const container = $('track-actions');
  container.replaceChildren();
  const add = (label, handler) => {
    const button = el('button', label);
    button.onclick = () => {
      closeContextMenu();
      handler();
    };
    container.append(button);
  };
  add('Rename…', async () => {
    const name = await nameDialog('Rename', item.name, 'Save');
    if (name)
      operation(() =>
        kind === 'library'
          ? api.renameLibrary(item.id, name)
          : api.playlist({ type: 'rename', id: item.id, name }),
      );
  });
  if (kind === 'library') {
    add('Library settings…', () => openLibrarySettings(item));
    add('Reconnect folder…', () =>
      operation(() => api.reconnectLibrary(item.id), 'Checking the new folder…'),
    );
    add('Rescan folder', () =>
      operation(() => api.rescan(item.id), 'Checking your folder for new and changed music…'),
    );
    add('Delete library', () => deleteCollection(item, kind));
  } else {
    add('Playlist settings…', () => openPlaylistSettings(item));
    add('Delete playlist', () => deleteCollection(item, kind));
  }
  openContextMenu(event);
}
function stars(track) {
  const group = el('div', null, 'stars');
  group.setAttribute('role', 'group');
  group.setAttribute('aria-label', `Rating for ${track.title}`);
  const rating = state.ratings?.[track.id] || 0;
  const paint = (value, preview = false) => {
    group.classList.toggle('preview', preview);
    for (const [i, button] of [...group.children].entries()) {
      button.classList.toggle('filled', i < value);
    }
  };
  for (let n = 1; n <= 5; n++) {
    const button = el('button');
    button.append(icon('star'));
    button.type = 'button';
    button.classList.toggle('filled', n <= rating);
    button.title = `${n} ${n === 1 ? 'star' : 'stars'}`;
    button.setAttribute('aria-label', `Rate ${track.title} ${n} ${n === 1 ? 'star' : 'stars'}`);
    button.setAttribute('aria-pressed', String(rating === n));
    button.onpointerenter = () => paint(n, true);
    button.onfocus = () => paint(n, true);
    button.onclick = (event) => {
      event.stopPropagation();
      selectTrack(track.id);
      rateTrack(track.id, n);
    };
    group.append(button);
  }
  group.onpointerleave = () => paint(state.ratings?.[track.id] || 0);
  group.onfocusout = (event) => {
    if (!group.contains(event.relatedTarget)) paint(state.ratings?.[track.id] || 0);
  };
  return group;
}
function renderPlayerRating() {
  const track = currentTrack();
  $('now-rating').replaceChildren();
  if (track) $('now-rating').append(stars(track));
}
function queuePreferenceWrite(fn) {
  const next = preferenceWrites.then(fn);
  preferenceWrites = next.catch(() => {});
  return next;
}
async function rateTrack(id, rating) {
  if (busy) {
    toast('Wait for the current operation.');
    return;
  }
  const before = state.ratings?.[id] || 0,
    version = (ratingVersions.get(id) || 0) + 1;
  ratingVersions.set(id, version);
  state.ratings ??= {};
  state.ratings[id] = rating;
  render({ preserveScroll: true });
  try {
    const result = await queuePreferenceWrite(() => saveRating(id, rating));
    rememberTagEdit(result, [id]);
  } catch (error) {
    if (ratingVersions.get(id) === version) {
      state.ratings[id] = before;
      render({ preserveScroll: true });
    }
    toast(error.message);
  }
}
function applyPreferences() {
  pulseAnimation.setEnabled(prefs.animateLogo !== false);
  $('setting-exportCollections').checked = !!prefs.exportCollections;
  $('setting-confirmMultiFileTags').checked = prefs.confirmMultiFileTags !== false;
  $('setting-totalLeadingZeros').checked = !!prefs.totalLeadingZeros;
  $('setting-renumberIgnoreDiscs').checked = !!prefs.renumberIgnoreDiscs;
  $('setting-queueDisplayCount').value = prefs.queueDisplayCount;
  $('setting-seekStep').value = prefs.seekStep;
  document.documentElement.dataset.theme = prefs.theme;
  document.documentElement.dataset.coverSize = prefs.coverSize;
  audio.setEnabled?.(prefs.gaplessPlayback);
  $('setting-gaplessPlayback').checked = !!prefs.gaplessPlayback;
  audio.volume = prefs.volume;
  $('volume').value = prefs.volume;
  shuffle = prefs.shuffle;
  repeat = prefs.repeat;
  prepareGaplessNext();
  $('shuffle').classList.toggle('enabled', shuffle);
  $('shuffle').setAttribute('aria-pressed', String(shuffle));
  $('shuffle').title = `Shuffle ${shuffle ? 'on' : 'off'}`;
  setIcon($('repeat'), repeat === 2 ? 'repeatOne' : 'repeat');
  $('repeat').classList.toggle('enabled', repeat > 0);
  $('repeat').title = `Repeat: ${['off', 'queue', 'track'][repeat]}`;
  $('repeat').setAttribute('aria-label', $('repeat').title);
  for (const key of [
    'artistGrouping',
    'defaultSort',
    'trackNumberFormat',
    'albumLayout',
    'coverSize',
    'libraryOpening',
    'albumExpansion',
    'seekDisplay',
    'waveformStyle',
  ])
    $(`setting-${key}`).value = prefs[key];
  $('setting-queuePresentation').value = prefs.queuePresentation || 'overlay';
  $('setting-trackNumberFormat').value = prefs.trackNumberFormat;
  $('setting-showDiscNumber').checked = prefs.showDiscNumber;
  $('setting-portable').checked = prefs.portable;
  $('cleanup-external-data').disabled = !(state.storage?.portable ?? true);
  if (state.storage?.cleanupError) $('cleanup-status').textContent = state.storage.cleanupError;
  $('portable-note').hidden = prefs.portable === (state.storage?.portable ?? true);
  $('setting-showColumnHeaders').checked = prefs.showColumnHeaders;
  document.documentElement.dataset.columnHeaders = String(prefs.showColumnHeaders);
  for (const head of document.querySelectorAll('.track-table thead'))
    head.hidden = !prefs.showColumnHeaders;
  $('setting-waveformNormalize').checked = prefs.waveformNormalize;
  applyWaveformAppearance();
  document.documentElement.style.setProperty('--sidebar-width', `${prefs.sidebarWidth}px`);
  document.documentElement.style.setProperty('--artist-width', `${prefs.artistWidth}px`);
  $('sidebar-resize').setAttribute('aria-valuenow', String(prefs.sidebarWidth));
  $('artist-resize').setAttribute('aria-valuenow', String(prefs.artistWidth));
  for (const [id, key] of [
    ['sidebar-resize', 'sidebarLocked'],
    ['artist-resize', 'artistLocked'],
  ]) {
    $(id).classList.toggle('locked', prefs[key]);
    $(id).setAttribute('aria-disabled', String(prefs[key]));
  }
  syncPaneBounds();
  applyCustomColors();
  $('setting-backgroundHue').value = prefs.backgroundHue;
  $('setting-backgroundSaturation').value = prefs.backgroundSaturation;
  $('setting-backgroundBrightness').value = prefs.backgroundBrightness;
  $('setting-accentColor').value = accentValue();
  $('setting-primaryTextColor').value = prefs.primaryTextColor || designDefaults.primaryTextColor;
  $('setting-secondaryTextColor').value =
    prefs.secondaryTextColor || designDefaults.secondaryTextColor;
  $('setting-seekHeightLocked').checked = prefs.seekHeightLocked;
  $('setting-globalPlaybackShortcuts').checked = prefs.globalPlaybackShortcuts;
  paintGlobalStatus();
}
function updateSettings(patch) {
  return settingsWrites.update(patch);
}
const settingsHelpUI = createSettingsHelp({ document, window });
window.addEventListener('beforeunload', () => settingsHelpUI.dispose());
const settingsTabs = createSettingsTabs({
  document,
  onSelect: (key) => {
    settingsHelpUI.close();
    if (key === 'audio') refreshAudioOutputs();
    if (key === 'about') refreshAbout();
  },
});
window.addEventListener('beforeunload', () => settingsTabs.dispose());
function toggleSettings() {
  renderShortcutEditor();
  if ($('settings-dialog').hasAttribute('open')) {
    $('settings-dialog').close();
    return;
  }
  applyPreferences();
  settingsTabs.select(settingsTabs.current);
  dialogs.open($('settings-dialog'));
  $(`settings-tab-${settingsTabs.current}`).focus();
  refreshLastfm();
}
$('open-settings').onclick = toggleSettings;
let aboutRevision = 0;
async function refreshAbout() {
  if (!api?.appInfo) return;
  const revision = ++aboutRevision;
  try {
    const info = await api.appInfo();
    if (revision !== aboutRevision) return;
    for (const [key, value] of Object.entries({
      version: info.version,
      build: info.packaged ? 'Desktop app' : 'Source',
      system: `${{ darwin: 'macOS', win32: 'Windows', linux: 'Linux' }[info.platform] || info.platform} · ${info.arch}`,
      storage: info.storage,
      'data-folder': info.dataFolder,
      electron: info.runtime.electron || '—',
      chromium: info.runtime.chromium || '—',
      node: info.runtime.node,
    }))
      $('about-' + key).textContent = value;
    $('about-error').hidden = true;
  } catch (error) {
    $('about-error').textContent = error.message;
    $('about-error').hidden = false;
  }
}
$('about-open-data').onclick = async () => {
  try {
    await api.aboutAction('open-data');
  } catch (error) {
    $('about-error').textContent = error.message;
    $('about-error').hidden = false;
  }
};
let availableUpdate = null,
  onlineUpdateBusy = false;
const onlineStatus = (text) => {
  $('about-online-status').hidden = false;
  $('about-online-status').textContent = text;
};
api?.onUpdateProgress?.(({ received, total }) => {
  if (!onlineUpdateBusy) return;
  $('about-cancel-download').hidden = false;
  onlineStatus(`Downloading… ${Math.floor((received / total) * 100)}%`);
});
$('about-check-update').onclick = async () => {
  if (onlineUpdateBusy || busy) return;
  onlineUpdateBusy = true;
  availableUpdate = null;
  $('about-check-update').disabled = true;
  $('about-download-update').hidden = true;
  $('about-release-notes').hidden = true;
  $('about-release-notes').open = false;
  onlineStatus('Checking GitHub releases…');
  try {
    const result = await api.checkUpdate();
    if (result.cancelled) {
      onlineStatus('Update check cancelled.');
      return;
    }
    if (result.available) {
      availableUpdate = result;
      onlineStatus(
        `Version ${result.version} is available · ${Math.ceil(result.size / 1024 ** 2)} MB`,
      );
      $('about-download-update').hidden = false;
      $('about-release-notes').hidden = !result.notes;
      $('about-release-notes-text').textContent = result.notes;
    } else onlineStatus('You are up to date.');
  } catch (error) {
    onlineStatus(error.message.replace(/^Error invoking remote method '[^']+': Error: /, ''));
  } finally {
    onlineUpdateBusy = false;
    $('about-check-update').disabled = false;
  }
};
$('about-download-update').onclick = async () => {
  if (!availableUpdate || onlineUpdateBusy || busy) return;
  onlineUpdateBusy = true;
  $('about-check-update').disabled = true;
  $('about-check-update').hidden = true;
  $('about-download-update').disabled = true;
  $('about-prepare-update').disabled = true;
  $('about-cancel-download').hidden = true;
  onlineStatus('Choose where to save the update…');
  try {
    const result = await api.downloadUpdate(availableUpdate.name);
    if (result.cancelled) {
      onlineStatus('Download cancelled.');
      return;
    }
    onlineStatus(
      `Version ${result.version} downloaded and verified. Extract the archive, then use Prepare update…`,
    );
    $('about-download-actions').hidden = false;
  } catch (error) {
    onlineStatus(error.message.replace(/^Error invoking remote method '[^']+': Error: /, ''));
  } finally {
    onlineUpdateBusy = false;
    $('about-check-update').disabled = false;
    $('about-check-update').hidden = false;
    $('about-download-update').disabled = false;
    $('about-prepare-update').disabled = false;
    $('about-cancel-download').hidden = true;
  }
};
$('about-cancel-download').onclick = () => api.cancelUpdate();
$('about-reveal-update').onclick = () => api.revealUpdate();
$('about-prepare-update').onclick = async () => {
  if (busy || onlineUpdateBusy || !api?.prepareUpdate) return;
  const button = $('about-prepare-update'),
    wasPlaying = !audio.paused;
  let prepared = false;
  busy = true;
  setBusy(true);
  button.disabled = true;
  $('about-error').hidden = true;
  $('about-update-status').hidden = false;
  $('about-update-status').textContent = 'Verifying the new release and preparing data…';
  audio.pause();
  savePlayback();
  saveBrowsingState();
  try {
    const result = await api.prepareUpdate();
    if (result.cancelled) {
      $('about-update-status').hidden = true;
      return;
    }
    prepared = true;
    $('about-update-status').textContent =
      `Version ${result.version} is prepared. Quit this version, then open the new one.${result.kind === 'source' ? ' For a source release, run npm ci in its folder before npm start.' : ''}`;
    $('about-update-actions').hidden = false;
  } catch (error) {
    $('about-update-status').hidden = true;
    $('about-error').textContent = error.message.replace(
      /^Error invoking remote method '[^']+': Error: /,
      '',
    );
    $('about-error').hidden = false;
  } finally {
    busy = false;
    setBusy(false);
    button.disabled = false;
    if (wasPlaying && !prepared) audio.play().catch(() => {});
  }
};
$('about-quit').onclick = () => api.windowAction('quit');

$('cleanup-external-data').onclick = async () => {
  const button = $('cleanup-external-data');
  button.disabled = true;
  try {
    const result = await api.cleanupExternalData();
    if (!result.cancelled && state.storage) state.storage.cleanupError = null;
    $('cleanup-status').textContent = result.cancelled
      ? ''
      : result.removed
        ? 'Old app data removed. A backup is saved in Localtone-data.'
        : 'No old app data found.';
  } catch (error) {
    $('cleanup-status').textContent = error.message.replace(
      /^Error invoking remote method '[^']+': Error: /,
      '',
    );
  } finally {
    button.disabled = !(state.storage?.portable ?? true);
  }
};
$('setting-artistGrouping').onchange = (event) => {
  selection.resetCollection();
  revealOpeningArtist = true;
  updateSettings({ artistGrouping: event.target.value });
  render();
};
$('setting-defaultSort').onchange = (event) => {
  sort = event.target.value;
  direction = 1;
  $('sort').value = sort;
  updateSettings({ defaultSort: sort });
  render();
};
$('setting-seekStep').onchange = (event) =>
  updateSettings({ seekStep: Number(event.target.value) });
$('setting-portable').onchange = (event) => updateSettings({ portable: event.target.checked });
$('setting-showColumnHeaders').onchange = (event) =>
  updateSettings({ showColumnHeaders: event.target.checked });
$('setting-showDiscNumber').onchange = (event) => {
  updateSettings({ showDiscNumber: event.target.checked });
  render({ preserveScroll: true });
};
$('close-settings').onclick = () => $('settings-dialog').close();
for (const key of [
  'trackNumberFormat',
  'albumLayout',
  'coverSize',
  'libraryOpening',
  'albumExpansion',
  'seekDisplay',
  'waveformStyle',
])
  $(`setting-${key}`).onchange = (event) => {
    updateSettings({ [key]: event.target.value });
    if (key === 'albumLayout' || key === 'trackNumberFormat') render({ preserveScroll: true });
    if (key === 'albumExpansion') {
      expandedAlbums.clear();
      render({ preserveScroll: true });
    }
    if (key === 'seekDisplay' && currentTrack()) loadWaveform(currentTrack());
  };
async function removePlaylistSelection(playlist, ids) {
  const result = await editPlaylistTracks(
    playlist,
    playlist.trackIds.filter((id) => !ids.includes(id)),
    'Removed tracks from playlist',
  );
  if (result) {
    for (const id of ids) selection.tracks.delete(id);
    if (ids.includes(selection.tracks.current)) selection.tracks.current = null;
    if (ids.includes(selection.tracks.anchor)) selection.tracks.anchor = null;
    paintSelection();
  }
}
const trackNumberChange = $('setting-trackNumberFormat').onchange;
async function refreshTrackTotals() {
  if (
    prefs.trackNumberFormat === 'full' &&
    api?.trackNumbers &&
    state.tracks.some((t) => typeof t.trackRaw !== 'string')
  ) {
    try {
      await preferenceWrites;
      const refreshed = await api.trackNumbers();
      state = refreshed;
      render({ preserveScroll: true });
    } catch (error) {
      toast('Could not refresh track totals: ' + error.message);
    }
  }
}
$('setting-trackNumberFormat').onchange = async (event) => {
  trackNumberChange(event);
  await refreshTrackTotals();
};
function navigateFromPlayer(album = false, preserveView = false, alignTop = false) {
  const pane = document.querySelector('.content-scroll'),
    previousScroll = pane.scrollTop;
  const previousScope = { ...scope };
  searchResultIds = null;
  const targetView = preserveView ? view : 'albums';
  const previousCoverScroll =
    view === 'covers' && !selection.albumDetail
      ? document.querySelector('.content-scroll').scrollTop
      : coverReturnScroll;
  const track = currentTrack();
  if (!track) return;
  clearTimeout(searchTimer);
  query = '';
  $('search').value = '';
  selection.tracks.clear();
  selection.tracks.current = null;
  selection.tracks.anchor = null;
  scope = album && playingOrigin ? { ...playingOrigin } : { kind: 'library', id: track.libraryId };
  if (!selectTracks(state, scope, '', 'manual').some((t) => t.id === track.id))
    scope = { kind: 'library', id: track.libraryId };
  selection.artists.clear();
  selection.artists.anchor = preserveView ? null : artistGroupKey(track, prefs.artistGrouping);
  selection.artists.current = preserveView ? null : artistGroupKey(track, prefs.artistGrouping);
  revealOpeningArtist = !preserveView;
  selection.albumDetail = null;
  const sameCollection = previousScope.kind === scope.kind && previousScope.id === scope.id;
  if (!preserveView || !sameCollection) expandedAlbums.clear();
  changeView(album ? targetView : prefs.albumView === 'covers' ? 'covers' : 'albums');
  sort = 'folder';
  $('sort').value = sort;
  if (album) {
    if (targetView === 'covers') {
      const key = albumKey(track);
      coverReturnScroll = previousCoverScroll;
      selection.albumDetail = key;
      selection.openedAlbums.select(key);
      selection.albums.select(key);
      selection.coverFocus = key;
    }
    expandedAlbums.set(albumKey(track), true);
    selection.tracks.current = track.id;
    selection.tracks.anchor = track.id;
    selection.tracks.add(track.id);
  }
  render({ preserveScroll: preserveView && sameCollection && !alignTop });
  if (preserveView && sameCollection) pane.scrollTop = previousScroll;
  if (targetView === 'tracks') $('tracks').closest('table')._revealTrack?.(track.id, true);
  else {
    const section = [...$('browser').querySelectorAll('[data-album-key]')].find(
      (node) => node.dataset.albumKey === albumKey(track),
    );
    section?._mountAlbum?.();
    section?.querySelector('table')?._revealTrack?.(track.id, true);
  }
  if (album) {
    const row = [
      ...(targetView === 'tracks' ? $('tracks') : $('browser')).querySelectorAll('[data-track-id]'),
    ].find((node) => node.dataset.trackId === track.id);
    if (row) {
      row.focus({ preventScroll: true });
      if (alignTop) {
        const target = targetView === 'tracks' ? row : row.closest('.album-section') || row;
        const header = targetView === 'tracks' ? row.closest('table').querySelector('thead') : null;
        const inset =
          (parseFloat(getComputedStyle(pane).paddingTop) || 0) +
          (header && !header.hidden ? header.getBoundingClientRect().height : 0);
        const paneBounds = pane.getBoundingClientRect(),
          rowBounds = row.getBoundingClientRect();
        const headingTop =
          pane.scrollTop + target.getBoundingClientRect().top - paneBounds.top - inset;
        const rowTop = pane.scrollTop + rowBounds.top - paneBounds.top - inset;
        const rowBottom = pane.scrollTop + rowBounds.bottom - paneBounds.top;
        // Keep the heading at the top only if it leaves the selected row fully visible.
        const top = Math.max(0, rowBottom - headingTop <= pane.clientHeight ? headingTop : rowTop);
        const space = el('div');
        space.id = 'playing-reveal-space';
        space.setAttribute('aria-hidden', 'true');
        space.style.height = '0px';
        pane.append(space);
        const contentEnd =
          pane.scrollTop +
          space.getBoundingClientRect().top -
          pane.getBoundingClientRect().top +
          (parseFloat(getComputedStyle(pane).paddingBottom) || 0);
        const extra = Math.max(0, top + pane.clientHeight - contentEnd);
        if (extra > 0) space.style.height = `${Math.ceil(extra)}px`;
        else space.remove();
        pane.scrollTop = top;
        for (const table of pane.querySelectorAll('.track-table')) table._refreshVirtual?.();
      }
      if (!alignTop)
        row.scrollIntoView?.({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
    }
  }
}
$('now-artist').onclick = () => navigateFromPlayer();
$('now-album').onclick = () => navigateFromPlayer(true);

function makeDraggable(node, getPayload) {
  node.draggable = true;
  node.ondragstart = (event) => {
    const payload = getPayload();
    payload.sourceScope = { ...scope };
    payload.ids = payload.ids.filter((id) => trackLookup.has(id));
    if (!payload.ids.length) {
      event.preventDefault();
      return;
    }
    dragPayload = payload;
    event.stopPropagation();
    event.dataTransfer.effectAllowed = 'copyMove';
    event.dataTransfer.setData('application/x-localtone', JSON.stringify(payload));
    event.dataTransfer.setData('text/plain', `${payload.ids.length} tracks`);
    node.classList.add('dragging');
  };
  node.ondragend = () => {
    dragPayload = null;
    node.classList.remove('dragging');
    document
      .querySelectorAll('.drop-target')
      .forEach((el) => el.classList.remove('drop-target', 'add-target', 'reorder-target'));
  };
}
function hasFileDrop(event) {
  return [...(event.dataTransfer?.types || [])].includes('Files');
}
async function dropFilesOnPlaylist(id, files) {
  const playlist = state.playlists.find((p) => p.id === id);
  if (!playlist || playlist.dynamic?.enabled) return;
  const paths = [...files].map((file) => api.filePath(file)).filter(Boolean);
  if (!paths.length) return;
  const before = [...playlist.trackIds],
    result = await operation(() => api.importPlaylistFiles(id, paths), 'Adding audio files…');
  if (result) {
    const after = state.playlists.find((p) => p.id === id)?.trackIds || before;
    rememberEdit({ type: 'playlist', id, before, after: [...after] }, null);
  }
}
function bindDrop(node, onDrop) {
  node.ondragover = (event) => {
    if (!dragPayload) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = dragPayload.queueIndex !== undefined ? 'move' : 'copy';
    node.classList.add('drop-target');
  };
  node.ondragleave = () => node.classList.remove('drop-target');
  node.ondrop = (event) => {
    if (!dragPayload) return;
    event.preventDefault();
    event.stopPropagation();
    node.classList.remove('drop-target');
    const payload = dragPayload;
    dragPayload = null;
    onDrop(payload);
  };
}
function dropOnPlaylist(id, payload, beforeId = null) {
  const playlist = state.playlists.find((p) => p.id === id);
  if (!playlist) return;
  if (playlist.dynamic?.enabled) {
    toast('This playlist is controlled by its filter rules.');
    return;
  }
  const moving = payload.originPlaylist === id;
  if (moving && payload.ids.includes(beforeId)) return;
  const ids = payload.ids.filter(
    (track) => trackLookup.has(track) && (moving || !playlist.trackIds.includes(track)),
  );
  const next = moving
    ? playlist.trackIds.filter((track) => !ids.includes(track))
    : [...playlist.trackIds];
  const index = beforeId ? next.indexOf(beforeId) : -1;
  next.splice(index < 0 ? next.length : index, 0, ...ids);
  editPlaylistTracks(playlist, next, 'Updated playlist');
}
function dropOnQueue(payload, at) {
  const before = captureQueue();
  if (payload.queueIndex !== undefined) {
    if (playback.queue[payload.queueIndex] !== payload.ids[0]) {
      toast('The queue changed. Drag the track again.');
      return;
    }
    playback.move(payload.queueIndex, at);
  } else
    playback.insert(
      payload.ids.filter((id) => trackLookup.has(id)),
      payload.sourceScope || scope,
      at,
    );
  renderQueue();
  renderPlayerRating();
  rememberQueueEdit(before, null);
}
bindDrop($('queue'), (payload) => {
  dropOnQueue(payload, playback.queue.length);
  setQueueVisible(true);
});
async function saveRating(id, rating, refresh = true) {
  // Ratings replace the file atomically; playback keeps its immutable source.
  const result = await api.rate(id, rating);
  if (result?.modifiedAt) {
    const track = state.tracks.find((t) => t.id === id);
    if (track) track.modifiedAt = result.modifiedAt;
    if (refresh) render({ preserveScroll: true });
  }
  return result;
}
async function withReleasedTrack(id, work) {
  const active = currentTrack()?.id === id && !!audio.getAttribute('src');
  const position = audio.currentTime,
    wasPlaying = !audio.paused;
  if (active) {
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
  }
  try {
    return await work();
  } finally {
    if (active && currentTrack()?.id === id) {
      const generation = ++playGeneration;
      audio.addEventListener(
        'loadedmetadata',
        () => {
          if (generation !== playGeneration) return;
          try {
            audio.currentTime = position;
          } catch {}
          if (wasPlaying) audio.play().catch(() => {});
        },
        { once: true },
      );
      audio.src = `localtone://audio/${id}`;
      audio.load();
    }
  }
}
function columnLabel(key) {
  return {
    number: '#',
    title: 'Title',
    artist: 'Artist',
    album: 'Album',
    year: 'Year',
    genre: 'Genre',
    duration: 'Duration',
    rating: 'Rating',
  }[key];
}
function formatTrackNumber(track) {
  const raw = track.trackRaw ?? (track.track ? String(track.track).padStart(2, '0') : '');
  const number = (prefs.trackNumberFormat === 'full' ? raw : raw.split('/')[0]) || '—';
  const disc = String(track.discRaw?.split('/')[0] || track.disc || 1);
  return prefs.showDiscNumber ? `${disc}.${number}` : number;
}
function buildTrackTable(table, tracks, playSource, playlist = null) {
  const layout =
    table.querySelector('#tracks') !== null
      ? scope.kind === 'playlist'
        ? 'playlists'
        : 'tracks'
      : 'albums';
  const main = table.querySelector('#tracks') !== null;
  table._disposeVirtual?.();
  table._revealTrack = null;
  table.className = main ? 'track-table main-track-table' : 'track-table';
  table.replaceChildren();
  const columns = columnsFor(layout)
      .filter((c) => c.visible)
      .map((c) =>
        !main && !c.fixed && ['duration', 'rating'].includes(c.key)
          ? { ...c, fixed: true, width: c.key === 'duration' ? 64 : 68 }
          : c,
      )
      .map((c) =>
        c.key === 'number' && (prefs.trackNumberFormat === 'full' || prefs.showDiscNumber)
          ? {
              ...c,
              width: Math.max(
                c.width,
                Math.max(3, ...tracks.map((t) => formatTrackNumber(t).length)) * 8 + 8,
              ),
            }
          : c,
      ),
    head = el('thead'),
    header = el('tr'),
    body = el('tbody');
  if (main) body.id = 'tracks';
  table.style.width = '100%';
  table.style.minWidth = '0';
  const colgroup = el('colgroup');
  for (const c of columns) {
    const col = el('col');
    col.dataset.column = c.key;
    colgroup.append(col);
  }
  const paintWidths = (widths) => {
    for (const i of columns.keys()) {
      for (const cell of [header.children[i], colgroup.children[i]])
        if (cell) cell.style.width = `${widths[i]}px`;
    }
  };
  const sizing = () => {
    const available =
      table.parentElement?.clientWidth || columns.reduce((sum, c) => sum + c.width, 0);
    paintWidths(columnWidths(columns, available));
  };
  table._resizeColumns = sizing;
  for (const column of columns) {
    const th = el('th');
    th.style.textAlign =
      column.align || (['rating', 'duration'].includes(column.key) ? 'right' : 'left');
    th.dataset.column = column.key;
    th.draggable = true;
    const button = el('button', columnLabel(column.key));
    button.dataset.sort = column.key;
    button.onclick = () => {
      if (column.key === 'number') return;
      sort = column.key;
      $('sort').value = sort;
      render();
    };
    button.onkeydown = (event) => {
      if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
        event.preventDefault();
        showColumnMenu(event, layout);
      }
    };
    th.append(button);
    th.ondragstart = (event) => {
      event.stopPropagation();
      event.dataTransfer.setData('application/x-localtone-column', column.key);
      event.dataTransfer.effectAllowed = 'move';
    };
    th.ondragover = (event) => {
      if ([...event.dataTransfer.types].includes('application/x-localtone-column')) {
        event.preventDefault();
        th.classList.add('column-drop');
      }
    };
    th.ondragleave = () => th.classList.remove('column-drop');
    th.ondrop = (event) => {
      const from = event.dataTransfer.getData('application/x-localtone-column');
      if (!from) return;
      event.preventDefault();
      event.stopPropagation();
      const next = [...columnsFor(layout)],
        index = next.findIndex((c) => c.key === from),
        to = next.findIndex((c) => c.key === column.key);
      if (index < 0) return;
      next.splice(to, 0, next.splice(index, 1)[0]);
      saveColumns(layout, next);
      render({ preserveScroll: true });
    };
    const resize = el('span', null, 'column-resize');
    resize.title = `Resize ${columnLabel(column.key)}`;
    resize.draggable = false;
    resize.onpointerdown = (event) => {
      event.preventDefault();
      event.stopPropagation();
      const index = columns.findIndex((c) => c.key === column.key);
      if (index === columns.length - 1) return;
      const x = event.clientX,
        initial = columns.map(
          (c, i) => header.children[i].getBoundingClientRect().width || c.width,
        );
      let widths = [...initial];
      th.draggable = false;
      document.body.classList.add('resizing-columns');
      resize.setPointerCapture?.(event.pointerId);
      resize.onpointermove = (move) => {
        widths = resizeColumnBoundary(
          initial,
          index,
          move.clientX - x,
          columns.map((c) => (c.key === 'number' ? 28 : 36)),
        );
        paintWidths(widths);
      };
      const finish = () => {
        resize.onpointermove = null;
        resize.onpointerup = null;
        resize.onpointercancel = null;
        th.draggable = true;
        document.body.classList.remove('resizing-columns');
        const maxFlex = Math.max(1, ...columns.map((c, i) => (c.fixed ? 0 : widths[i]))),
          factor = Math.min(1, 600 / maxFlex);
        const next = columnsFor(layout).map((c) => {
          const i = columns.findIndex((v) => v.key === c.key);
          return i < 0
            ? c
            : {
                ...c,
                width: Math.max(
                  c.key === 'number' ? 28 : 36,
                  Math.min(600, Math.round(widths[i] * (c.fixed ? 1 : factor))),
                ),
              };
        });
        saveColumns(layout, next);
        render({ preserveScroll: true });
      };
      resize.onpointerup = finish;
      resize.onpointercancel = finish;
    };
    if (column.key !== columns.at(-1).key) th.append(resize);
    header.append(th);
  }
  sizing();
  head.oncontextmenu = (event) => {
    event.preventDefault();
    showColumnMenu(event, layout);
  };
  head.append(header);
  head.hidden = !prefs.showColumnHeaders;
  table.append(colgroup, head, body);
  const createRow = (track, index) => {
    const row = el('tr', null, main ? '' : 'album-track');
    if (!main && index > 0 && (Number(track.disc) || 1) !== (Number(tracks[index - 1].disc) || 1))
      row.classList.add('disc-start');
    bindTrackRow(row, track, playSource);
    row.tabIndex = 0;
    row.classList.toggle('current', currentTrack()?.id === track.id);
    for (const column of columns) {
      const cell = el('td');
      cell.dataset.column = column.key;
      cell.style.textAlign =
        column.align || (['rating', 'duration'].includes(column.key) ? 'right' : 'left');
      cell.dataset.align =
        column.align || (['rating', 'duration'].includes(column.key) ? 'right' : 'left');
      if (column.key === 'title') {
        cell.className = 'title-cell';
        const title = el('div', null, 'track-title');
        if (main) title.append(cover(track));
        const name = el('span', track.title, 'track-name');
        if (row.classList.contains('current')) name.prepend(icon('playback'));
        title.append(name);
        cell.append(title);
      } else if (column.key === 'rating') {
        cell.className = 'rating-cell';
        cell.append(stars(track));
      } else
        cell.textContent =
          column.key === 'number'
            ? formatTrackNumber(track)
            : column.key === 'duration'
              ? formatTime(track.duration)
              : String(track[column.key] || '—');
      row.append(cell);
    }
    row.ondblclick = (event) => {
      if (!event.target.closest('.stars')) playVisible(track.id, playSource);
    };
    row.onkeydown = (event) => {
      if (
        event.key === 'Enter' &&
        event.target === row &&
        !event.shiftKey &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey
      ) {
        event.preventDefault();
        event.stopPropagation();
        playVisible(track.id, playSource);
      }
    };
    if (playlist && !playlist.dynamic?.enabled && sort === 'manual' && !query.trim())
      bindDrop(row, (payload) => dropOnPlaylist(playlist.id, payload, track.id));
    row.setAttribute('aria-rowindex', String(index + 2));
    return row;
  };
  if (tracks.length > 300) {
    mountVirtualTracks({
      window,
      document,
      table,
      head,
      body,
      scroller: document.querySelector('.content-scroll'),
      tracks,
      columnCount: columns.length,
      createRow,
    });
  } else {
    table.removeAttribute('aria-rowcount');
    const fragment = document.createDocumentFragment();
    tracks.forEach((track, index) => fragment.append(createRow(track, index)));
    body.append(fragment);
  }
  if (playlist && !playlist.dynamic?.enabled && sort === 'manual' && !query.trim()) {
    const foot = el('tfoot'),
      row = el('tr'),
      cell = el('td', null, 'playlist-end-drop');
    cell.colSpan = columns.length;
    cell.setAttribute('aria-label', 'Drop tracks at end');
    row.append(cell);
    foot.append(row);
    table.append(foot);
    bindDrop(cell, (payload) => dropOnPlaylist(playlist.id, payload));
  }
}
function showColumnMenu(event, layout) {
  const container = $('track-actions');
  container.replaceChildren();
  const hide = el('button', 'Hide column names');
  hide.onclick = () => {
    closeContextMenu();
    updateSettings({ showColumnHeaders: false });
  };
  container.append(hide);
  const selected = event.target.closest?.('[data-column]')?.dataset.column;
  if (selected) {
    container.append(el('p', `${columnLabel(selected)} alignment`));
    for (const align of ['left', 'center', 'right']) {
      const button = el('button', align[0].toUpperCase() + align.slice(1), 'column-alignment-item');
      button.setAttribute('role', 'menuitemradio');
      button.setAttribute(
        'aria-checked',
        String(
          (columnsFor(layout).find((c) => c.key === selected).align ||
            (['rating', 'duration'].includes(selected) ? 'right' : 'left')) === align,
        ),
      );
      button.onclick = () => {
        saveColumns(
          layout,
          columnsFor(layout).map((c) => (c.key === selected ? { ...c, align } : c)),
        );
        render({ preserveScroll: true });
        refreshContextOptions(() => showColumnMenu(event, layout));
      };
      container.append(button);
    }
  }
  for (const column of columnsFor(layout)) {
    const button = el('button', null, 'column-menu-item');
    button.setAttribute('role', 'menuitemcheckbox');
    button.setAttribute('aria-checked', String(column.visible));
    button.disabled =
      column.key === 'title' ||
      (column.visible &&
        !column.fixed &&
        columnsFor(layout).filter((c) => c.visible && !c.fixed).length === 1);
    const mark = el('span');
    if (column.visible) mark.append(icon('check'));
    button.append(mark, document.createTextNode(columnLabel(column.key)));
    button.onclick = () => {
      saveColumns(
        layout,
        columnsFor(layout).map((c) => (c.key === column.key ? { ...c, visible: !c.visible } : c)),
      );
      render({ preserveScroll: true });
      refreshContextOptions(() => showColumnMenu(event, layout));
    };
    container.append(button);
  }
  container.append(el('p', 'Column width'));
  for (const column of columnsFor(layout).filter((c) => c.visible)) {
    const button = el('button', null, 'column-menu-item column-width-item');
    button.setAttribute('role', 'menuitemcheckbox');
    button.setAttribute('aria-checked', String(!!column.fixed));
    button.disabled =
      !column.fixed && columnsFor(layout).filter((c) => c.visible && !c.fixed).length === 1;
    if (button.disabled) button.title = 'Keep one flexible column to fill the pane';
    const mark = el('span');
    if (column.fixed) mark.append(icon('check'));
    button.append(
      mark,
      document.createTextNode(
        `${columnLabel(column.key)} · ${column.fixed ? 'Fixed' : 'Flexible'}`,
      ),
    );
    button.onclick = () => {
      saveColumns(
        layout,
        columnsFor(layout).map((c) => (c.key === column.key ? { ...c, fixed: !c.fixed } : c)),
      );
      render({ preserveScroll: true });
      refreshContextOptions(() => showColumnMenu(event, layout));
    };
    container.append(button);
  }
  openContextMenu(event);
}
function refreshContextOptions(build) {
  const menu = $('context-menu'),
    buttons = [...menu.querySelectorAll('button')],
    index = buttons.indexOf(document.activeElement),
    left = menu.style.left,
    top = menu.style.top,
    origin = menuOrigin;
  build();
  menu.style.left = left;
  menu.style.top = top;
  menuOrigin = origin;
  [...menu.querySelectorAll('button')][index]?.focus({ preventScroll: true });
}
function paintMenuCheck(button, checked) {
  button.setAttribute('aria-checked', String(checked));
  let mark = button.querySelector('.menu-check');
  if (!mark) {
    mark = icon('check');
    mark.classList.add('menu-check');
    button.prepend(mark);
  }
  mark.style.visibility = checked ? 'visible' : 'hidden';
}
function openFocusedContextMenu() {
  let node = document.activeElement;
  if (
    node === document.body ||
    node === document.documentElement ||
    node === document.querySelector('.library-content') ||
    node === $('artist-pane')
  ) {
    focusBrowseSelection();
    node = document.activeElement;
  }
  node?.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'ContextMenu', bubbles: true, cancelable: true }),
  );
}
let menuOrigin = null;
function closeContextMenu(restoreFocus = false) {
  closePlaylistSubmenu();
  $('context-menu').hidden = true;
  if (restoreFocus && menuOrigin?.isConnected) menuOrigin.focus();
}
function openContextMenu(event) {
  normalizeContextMenu();
  const menu = $('context-menu');
  menuOrigin = event?.currentTarget || document.activeElement;
  for (const button of menu.querySelectorAll('button'))
    if (!button.hasAttribute('role')) button.setAttribute('role', 'menuitem');
  menu.hidden = false;
  menu.style.left = '0px';
  menu.style.top = '0px';
  const anchor = menuOrigin?.getBoundingClientRect?.() || { left: 8, bottom: 8 };
  const x = event?.type === 'contextmenu' ? event.clientX : anchor.left,
    y = event?.type === 'contextmenu' ? event.clientY : anchor.bottom;
  const rect = menu.getBoundingClientRect();
  menu.style.left = `${Math.max(6, Math.min(x, window.innerWidth - rect.width - 6))}px`;
  menu.style.top = `${Math.max(6, Math.min(y, window.innerHeight - rect.height - 6))}px`;
  menu.querySelector('button:not(:disabled)')?.focus();
}
document.addEventListener('pointerdown', (event) => {
  if (!$('context-menu').contains(event.target)) closeContextMenu();
});
document.addEventListener(
  'scroll',
  (event) => {
    if (!$('context-menu').contains(event.target)) closeContextMenu();
  },
  true,
);
window.addEventListener('resize', () => closeContextMenu());
window.addEventListener('blur', () => closeContextMenu());
$('context-menu').onkeydown = (event) => {
  if (
    playlistSubmenu &&
    !document.activeElement?.closest('.playlist-submenu') &&
    ['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)
  )
    closePlaylistSubmenu();
  const sub =
      document.activeElement?.closest('.playlist-submenu') ||
      (playlistSubmenu && document.activeElement === playlistSubmenuTrigger
        ? playlistSubmenu
        : null),
    root = sub || $('track-actions'),
    buttons = [...root.querySelectorAll('button:not(:disabled)')],
    index = buttons.indexOf(document.activeElement);
  if (sub && (event.key === 'ArrowLeft' || event.key === 'Escape')) {
    event.preventDefault();
    event.stopPropagation();
    closePlaylistSubmenu(true);
    return;
  }
  if (event.key === 'ArrowRight' && document.activeElement?.dataset.playlistSubmenu) {
    event.preventDefault();
    event.stopPropagation();
    document.activeElement.click();
    return;
  }
  if (['ArrowLeft', 'ArrowRight'].includes(event.key)) {
    event.preventDefault();
    event.stopPropagation();
    return;
  }
  if (['Escape', 'Tab'].includes(event.key)) {
    if (event.key === 'Escape') event.preventDefault();
    closeContextMenu(true);
    event.stopPropagation();
  } else if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    event.stopPropagation();
    if (!event.repeat) buttons[index]?.click();
  } else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
    event.preventDefault();
    event.stopPropagation();
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? buttons.length - 1
          : (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
    buttons[next]?.focus();
  } else event.stopPropagation();
};
function randomNext() {
  const pool = selectTracks(state, scope, '', 'manual'),
    choices = pool.filter((track) => track.id !== currentTrack()?.id);
  if (!choices.length) return;
  playback.randomNext(
    pool.map((t) => t.id),
    scope,
    currentTrack()?.id,
  );
  shuffle = true;
  repeat = 0;
  updateSettings({ shuffle: true, repeat: 0 });
  startTrack();
  navigateFromPlayer(true, true, true);
  if (!$('queue-panel').hidden) revealPlayingQueueItem();
}

// Limit sidebar width to the available square-cover height, retaining saved preference.
function sidebarMaximum() {
  return Math.max(
    140,
    Math.min(320, Math.floor(window.innerHeight * (window.innerHeight <= 650 ? 0.23 : 0.3)) + 20),
  );
}
function syncPaneBounds(sidebar = prefs.sidebarWidth, artist = prefs.artistWidth) {
  if (windowPresentation.transitioning || document.body.classList.contains('mini-player')) return;
  const maximum = sidebarMaximum(),
    width = Math.min(sidebar, maximum);
  document.documentElement.style.setProperty('--sidebar-max-width', `${maximum}px`);
  $('sidebar-resize').setAttribute('aria-valuemax', String(maximum));
  $('sidebar-resize').setAttribute('aria-valuenow', String(width));
  windowPresentation.refreshPlayerLayout();
  // 600px content + 36px main padding + two 6px dividers.
  const sidebarNode = document.querySelector('.sidebar');
  let needed = 28 + 148 + 14; // Sidebar padding plus five 28px playlist rows and four gaps.
  for (const child of sidebarNode.children) {
    if (child.id === 'playlists') continue;
    const style = getComputedStyle(child);
    needed +=
      child.getBoundingClientRect().height +
      (parseFloat(style.marginTop) || 0) +
      (parseFloat(style.marginBottom) || 0);
  }
  api.layoutMinimum?.(
    Math.ceil(
      width +
        artist +
        648 +
        (document.body.classList.contains('queue-extended') ? windowPresentation.queueWidth : 0),
    ),
    Math.max(740, Math.ceil(needed)),
    [window.innerWidth, window.innerHeight],
  );
}
window.addEventListener('resize', () => syncPaneBounds());
function bindPaneResize(id, key, min, max) {
  const grip = $(id),
    lockKey = key === 'sidebarWidth' ? 'sidebarLocked' : 'artistLocked',
    css = key === 'sidebarWidth' ? '--sidebar-width' : '--artist-width';
  const menu = (event) => {
    event.preventDefault();
    const container = $('track-actions');
    container.replaceChildren();
    const button = el('button', prefs[lockKey] ? 'Enable resizing' : 'Fix pane width');
    button.onclick = () => {
      closeContextMenu();
      updateSettings({ [lockKey]: !prefs[lockKey] });
    };
    container.append(button);
    openContextMenu(event);
  };
  grip.oncontextmenu = menu;
  const apply = (value) => {
    const width = Math.round(
      Math.max(min, Math.min(key === 'sidebarWidth' ? sidebarMaximum() : max, value)),
    );
    document.documentElement.style.setProperty(css, `${width}px`);
    grip.setAttribute('aria-valuenow', String(width));
    syncPaneBounds(
      key === 'sidebarWidth' ? width : prefs.sidebarWidth,
      key === 'artistWidth' ? width : prefs.artistWidth,
    );
    return width;
  };
  grip.setAttribute('aria-valuemin', String(min));
  grip.setAttribute('aria-valuemax', String(max));
  grip.onpointerdown = (event) => {
    if (prefs[lockKey] || event.button !== 0) return;
    event.preventDefault();
    const start = event.clientX,
      initial =
        key === 'sidebarWidth'
          ? document.querySelector('.sidebar').getBoundingClientRect().width
          : $('artist-pane').getBoundingClientRect().width;
    let width = initial || prefs[key];
    const base = width;
    grip.setPointerCapture(event.pointerId);
    document.body.classList.add('resizing-panes');
    grip.onpointermove = (move) => {
      width = apply(base + move.clientX - start);
    };
    const finish = () => {
      grip.onpointermove = null;
      grip.onpointerup = null;
      grip.onpointercancel = null;
      document.body.classList.remove('resizing-panes');
      updateSettings({ [key]: apply(width) });
    };
    grip.onpointerup = finish;
    grip.onpointercancel = finish;
  };
  grip.onkeydown = (event) => {
    if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
      menu(event);
      return;
    }
    if (prefs[lockKey] || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    const width = apply(prefs[key] + (event.key === 'ArrowLeft' ? -10 : 10));
    updateSettings({ [key]: width });
  };
}
bindPaneResize('sidebar-resize', 'sidebarWidth', 140, 320);
bindPaneResize('artist-resize', 'artistWidth', 160, 420);

const lastfmSettings = createLastfmSettings({
  document,
  api,
  confirm,
  onStatus: (value) => {
    const wasEnabled = lastfmState.enabled;
    lastfmState = value;
    if (!wasEnabled && value.enabled && currentTrack()) {
      listener.begin(currentTrack());
      if (!audio.paused) listener.playing(audio.currentTime);
    }
    if (wasEnabled && !value.enabled) listener.clear();
  },
});
function showLastfmStatus(value) {
  lastfmSettings.show(value);
}
function refreshLastfm() {
  return lastfmSettings.refresh();
}
refreshLastfm();
window.addEventListener('beforeunload', () => lastfmSettings.dispose());

function columnsFor() {
  return prefs.columnsByView?.tracks || prefs.columns || columnDefaults;
}
function saveColumns(layout, columns) {
  updateSettings({
    columns,
    columnsByView: Object.fromEntries(
      ['tracks', 'playlists', 'albums'].map((key) => [key, columns.map((c) => ({ ...c }))]),
    ),
  });
}
async function openFolder(id, kind) {
  if (!id) return;
  try {
    await api.openFolder({ id, kind });
  } catch (error) {
    toast(error.message.replace(/^Error invoking remote method '[^']+': Error: /, ''));
  }
}
function bindFolderMenu(node, getId, kind) {
  const show = (event) => {
    event.preventDefault();
    event.stopPropagation();
    const id = getId();
    if (!id) return;
    const container = $('track-actions');
    container.replaceChildren();
    const button = el('button', 'Open folder');
    button.onclick = () => {
      closeContextMenu();
      openFolder(id, kind);
    };
    container.append(button);
    appendWebSearch(id, kind);
    if (kind === 'artist') {
      const track = trackLookup.get(id),
        keys = selection.artists.has(artistGroupKey(track, prefs.artistGrouping))
          ? selection.artists
          : new Set([artistGroupKey(track, prefs.artistGrouping)]),
        tracks = folderTracks.filter((t) => keys.has(artistGroupKey(t, prefs.artistGrouping)));
      const add = el('button', 'Add to play queue');
      add.onclick = () => {
        closeContextMenu();
        addToQueue(tracks.map((t) => t.id));
      };
      container.append(add);
      appendPlaylistActions(tracks.map((t) => t.id));
      appendNamingAction(tracks);
      appendDeleteFilesAction(tracks);
      if (tracks.length && tracks.every((t) => t.codec === 'MP3')) {
        const edit = el('button', 'Edit tags…');
        edit.onclick = () => {
          closeContextMenu();
          openTagEditor(tracks);
        };
        container.append(edit);
      }
    }
    if (kind === 'album') {
      const track = trackLookup.get(id),
        key = albumKey(track);
      if (!selection.albums.has(key)) {
        selection.albums.clear();
        selection.albums.add(key);
      }
      const tracks = visible.filter((t) => selection.albums.has(albumKey(t)));
      const add = el('button', 'Add to play queue');
      add.onclick = () => {
        closeContextMenu();
        addToQueue(tracks.map((t) => t.id));
      };
      container.append(add);
      appendPlaylistActions(tracks.map((t) => t.id));
      appendNamingAction(tracks);
      appendDeleteFilesAction(tracks);
      if (tracks.length && tracks.every((t) => t.codec === 'MP3')) {
        const edit = el('button', 'Edit tags…');
        edit.onclick = () => {
          closeContextMenu();
          openTagEditor(tracks);
        };
        container.append(edit);
      }
      appendNumberActions(tracks);
      appendAlbumDetails();
    }
    openContextMenu(event);
  };
  node.oncontextmenu = show;
  node.addEventListener('keydown', (event) => {
    if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) show(event);
  });
}
function syncScrollbarControls() {
  for (const table of document.querySelectorAll('.track-table'))
    if (!document.body.classList.contains('resizing-columns')) table._resizeColumns?.();
  const pane = document.querySelector('.content-scroll');
  const overflowing = pane.scrollHeight > pane.clientHeight + 1;
  const nativeWidth = pane.offsetWidth - pane.clientWidth;
  document
    .querySelector('.library-content')
    .style.setProperty(
      '--scrollbar-control-inset',
      overflowing && nativeWidth < 2 ? '12px' : '0px',
    );
}
if (typeof ResizeObserver !== 'undefined') {
  const observer = new ResizeObserver(syncScrollbarControls);
  for (const node of document.querySelectorAll(
    '.content-scroll,.library-content,#browser,.table-wrap',
  ))
    observer.observe(node);
}
window.addEventListener('resize', syncScrollbarControls);

async function loadWaveform(track) {
  const generation = ++waveformGeneration;
  waveformPeaks = null;
  applyWaveformAppearance();
  if (prefs.seekDisplay !== 'waveform' || !track || !api?.waveform) {
    api?.cancelWaveform?.().catch(() => {});
    return;
  }
  $('seek-visual').title = 'Analyzing waveform…';
  try {
    const peaks = await api.waveform(track.id);
    if (generation !== waveformGeneration) return;
    waveformPeaks = peaks;
    $('seek-visual').title = '';
  } catch {
    if (generation !== waveformGeneration) return;
    $('seek-visual').title = 'Waveform unavailable — seek with the line.';
  } finally {
    if (generation === waveformGeneration) {
      applyWaveformAppearance();
    }
  }
}
function applyWaveformAppearance() {
  const enabled = prefs.seekDisplay === 'waveform',
    hasWaveform = enabled && !!waveformPeaks;
  document.documentElement.dataset.seekDisplay = prefs.seekDisplay;
  document.documentElement.dataset.waveformHeight = 'compact';
  applySeekHeight();
  const wrapper = $('seek-visual');
  wrapper.classList.toggle('has-waveform', hasWaveform);
  wrapper.dataset.style = prefs.waveformStyle;
  $('waveform-svg').toggleAttribute('hidden', !hasWaveform);
  $('waveform-cursor').hidden = !hasWaveform;
  if (hasWaveform) {
    const shape = waveformPath(waveformPeaks, prefs.waveformStyle, prefs.waveformNormalize);
    $('waveform-base').setAttribute('d', shape);
    $('waveform-played').setAttribute('d', shape);
  }
  paintWaveformProgress();
}
function paintWaveformProgress() {
  const progress = Math.max(0, Math.min(100, Number($('seek').value) || 0));
  $('waveform-clip').setAttribute('width', String(progress * 10));
  $('waveform-cursor').style.left = `${progress}%`;
}
function showSeekMenu(event) {
  event.preventDefault();
  event.stopPropagation();
  const container = $('track-actions');
  container.replaceChildren();
  const group = (title, key, choices) => {
    container.append(el('p', title));
    for (const [value, label] of choices) {
      const button = el('button', label);
      button.setAttribute('role', 'menuitemradio');
      button.setAttribute('aria-checked', String(prefs[key] === value));
      button.dataset.seekSetting = key;
      button.dataset.value = value;
      button.disabled = key !== 'seekDisplay' && prefs.seekDisplay === 'line';
      button.onclick = () => {
        updateSettings({ [key]: value });
        if (key === 'seekDisplay' && currentTrack()) loadWaveform(currentTrack());
        refreshContextOptions(() => showSeekMenu(event));
      };
      container.append(button);
    }
  };
  group('Seek bar', 'seekDisplay', [
    ['waveform', 'Waveform'],
    ['line', 'Line'],
  ]);
  group('Style', 'waveformStyle', [
    ['bars', 'Bars'],
    ['solid', 'Filled'],
    ['outline', 'Outline'],
  ]);
  const lock = el('button', 'Lock seek bar height');
  lock.setAttribute('role', 'menuitemcheckbox');
  paintMenuCheck(lock, prefs.seekHeightLocked);
  lock.onclick = () => {
    updateSettings({ seekHeightLocked: !prefs.seekHeightLocked });
    paintMenuCheck(lock, prefs.seekHeightLocked);
  };
  container.append(lock);
  const normalize = el('button', 'Normalize waveform');
  normalize.setAttribute('role', 'menuitemcheckbox');
  paintMenuCheck(normalize, prefs.waveformNormalize);
  normalize.disabled = prefs.seekDisplay === 'line';
  normalize.onclick = () => {
    updateSettings({ waveformNormalize: !prefs.waveformNormalize });
    paintMenuCheck(normalize, prefs.waveformNormalize);
  };
  container.append(normalize);
  openContextMenu(event);
}
$('seek-visual').oncontextmenu = showSeekMenu;
$('seek').addEventListener('keydown', (event) => {
  if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) showSeekMenu(event);
});
$('setting-waveformNormalize').onchange = (event) =>
  updateSettings({ waveformNormalize: event.target.checked });

const playlistEditor = createPlaylistEditor({
  document,
  api,
  el,
  icon,
  dialogs,
  getState: () => state,
  isBusy: () => busy,
  operation,
  setScope,
  onConfigured: (id, dynamic) => {
    if (scope.kind === 'playlist' && scope.id === id) {
      sort = dynamic.enabled ? 'folder' : 'manual';
      $('sort').value = sort;
      render();
    }
  },
});
function openPlaylistSettings(playlist, seedIds = null) {
  return playlistEditor.open(playlist, seedIds);
}
window.addEventListener('beforeunload', () => playlistEditor.dispose());
// Relative date rules must age out even while a playlist stays open.
const dynamicPlaylistTimer = setInterval(() => {
  if (
    !document.hidden &&
    !busy &&
    activePlaylist()?.dynamic?.enabled &&
    activePlaylist().dynamic.rules.some((r) => dateFields.includes(r.field))
  )
    render({ preserveScroll: true });
}, 60000);
window.addEventListener('beforeunload', () => clearInterval(dynamicPlaylistTimer));

function accentValue() {
  return (
    prefs.accentColor ||
    { sage: '#b5ed91', slate: '#b3bdcc', blue: '#8bafd7', lavender: '#b6a6dc', amber: '#d8b482' }[
      prefs.theme
    ] ||
    '#b5ed91'
  );
}
function applyCustomColors(
  hue = prefs.backgroundHue,
  accent = accentValue(),
  saturation = prefs.backgroundSaturation,
  brightness = prefs.backgroundBrightness,
) {
  for (const [key, value] of Object.entries({
    backgroundHue: hue,
    backgroundSaturation: saturation,
    backgroundBrightness: brightness,
    accentColor: accent.toUpperCase(),
  })) {
    const output = $(`setting-${key}-value`);
    if (output) output.textContent = value;
  }
  const root = document.documentElement;
  root.style.setProperty('--background-saturation', `${saturation}%`);
  root.style.setProperty('--background-brightness-offset', `${brightness - 11}%`);
  root.style.setProperty('--background-hue', String(hue));
  root.style.setProperty('--accent', accent);
  applyTextColors();
  root.style.setProperty(
    '--accent-rgb',
    [1, 3, 5].map((i) => parseInt(accent.slice(i, i + 2), 16)).join(' '),
  );
}
function applyTextColors() {
  const root = document.documentElement;
  for (const [key, token] of [
    ['primaryTextColor', '--text-primary'],
    ['secondaryTextColor', '--text-muted'],
  ]) {
    const color = prefs[key] || designDefaults[key];
    root.style.setProperty(token, color);
    const output = $(`setting-${key}-value`);
    if (output) output.textContent = color.toUpperCase();
  }
}
for (const key of ['primaryTextColor', 'secondaryTextColor']) {
  $(`setting-${key}`).oninput = (event) => {
    document.documentElement.style.setProperty(
      key === 'primaryTextColor' ? '--text-primary' : '--text-muted',
      event.target.value,
    );
    $(`setting-${key}-value`).textContent = event.target.value.toUpperCase();
  };
  $(`setting-${key}`).onchange = (event) => updateSettings({ [key]: event.target.value });
}
function paintGlobalStatus() {
  const node = $('global-shortcuts-status');
  if (node) node.textContent = globalShortcutStatus.error || '';
}
api?.onGlobalShortcutStatus?.((status) => {
  globalShortcutStatus = status;
  paintGlobalStatus();
});
api?.onGlobalPlayback?.((action) => {
  if (busy || tagEditor.saving) return;
  if (action === 'previous') advance(-1, false, true);
  else if (action === 'next') advance(1);
  else if (action === 'random') randomNext();
});
$('setting-globalPlaybackShortcuts').onchange = (e) =>
  updateSettings({ globalPlaybackShortcuts: e.target.checked });
$('setting-seekHeightLocked').onchange = (e) =>
  updateSettings({ seekHeightLocked: e.target.checked });
$('setting-backgroundHue').oninput = (e) => applyCustomColors(Number(e.target.value));
$('setting-backgroundHue').onchange = (e) =>
  updateSettings({ backgroundHue: Number(e.target.value) });
$('setting-accentColor').oninput = (e) => applyCustomColors(prefs.backgroundHue, e.target.value);
$('setting-accentColor').onchange = (e) => updateSettings({ accentColor: e.target.value });
function seekHeightLimit() {
  return Math.max(16, Math.min(200, window.innerHeight - 340));
}
function applySeekHeight(value = prefs.seekHeight) {
  const height = Math.min(value, seekHeightLimit());
  document.documentElement.style.setProperty('--seek-height', `${height}px`);
  const grip = $('seek-height-resize');
  grip.hidden = false;
  grip.classList.toggle('locked', prefs.seekHeightLocked);
  grip.setAttribute('aria-disabled', String(prefs.seekHeightLocked));
  grip.setAttribute('aria-valuemin', '16');
  grip.setAttribute('aria-valuemax', String(seekHeightLimit()));
  grip.setAttribute('aria-valuenow', String(height));
}
window.addEventListener('resize', () => applySeekHeight());
$('seek-height-resize').onpointerdown = (event) => {
  if (event.button !== 0 || prefs.seekHeightLocked || busy) return;
  event.preventDefault();
  const grip = event.currentTarget,
    start = event.clientY,
    base = Math.min(prefs.seekHeight, seekHeightLimit());
  let height = base;
  grip.setPointerCapture?.(event.pointerId);
  grip.onpointermove = (e) => {
    height = Math.round(Math.max(16, Math.min(seekHeightLimit(), base + start - e.clientY)));
    applySeekHeight(height);
  };
  const finish = () => {
    grip.onpointermove = null;
    grip.onpointerup = null;
    grip.onpointercancel = null;
    updateSettings({ seekHeight: height });
  };
  grip.onpointerup = finish;
  grip.onpointercancel = finish;
};
$('seek-height-resize').oncontextmenu = (event) => {
  event.preventDefault();
  event.stopPropagation();
  const menu = $('track-actions'),
    button = el('button', 'Lock seek bar height');
  button.setAttribute('role', 'menuitemcheckbox');
  paintMenuCheck(button, prefs.seekHeightLocked);
  button.onclick = () => {
    updateSettings({ seekHeightLocked: !prefs.seekHeightLocked });
    paintMenuCheck(button, prefs.seekHeightLocked);
  };
  menu.replaceChildren(button);
  openContextMenu(event);
};
$('volume').addEventListener('keydown', (event) => {
  if (
    [
      'ArrowLeft',
      'ArrowRight',
      'ArrowUp',
      'ArrowDown',
      'Home',
      'End',
      'PageUp',
      'PageDown',
      ' ',
    ].includes(event.key)
  )
    event.preventDefault();
});
$('volume').addEventListener('pointerup', () => {
  $('volume').blur();
  document.body.focus({ preventScroll: true });
});
$('seek-height-resize').onkeydown = (e) => {
  if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) {
    $('seek-height-resize').oncontextmenu(e);
    return;
  }
  if (prefs.seekHeightLocked || !['ArrowUp', 'ArrowDown'].includes(e.key)) return;
  e.preventDefault();
  updateSettings({
    seekHeight: Math.max(
      16,
      Math.min(seekHeightLimit(), prefs.seekHeight + (e.key === 'ArrowUp' ? 4 : -4)),
    ),
  });
};

for (const key of ['backgroundSaturation', 'backgroundBrightness']) {
  const input = $(`setting-${key}`);
  input.oninput = () =>
    applyCustomColors(
      prefs.backgroundHue,
      accentValue(),
      Number($('setting-backgroundSaturation').value),
      Number($('setting-backgroundBrightness').value),
    );
  input.onchange = () => updateSettings({ [key]: Number(input.value) });
}

$('reset-appearance').onclick = async () => {
  await updateSettings(appearanceDefaults());
  render({ preserveScroll: true });
  if (currentTrack()) loadWaveform(currentTrack());
};

if (navigator.mediaSession) {
  for (const [action, handler] of Object.entries({
    play: () => {
      if (audio.paused) toggle();
    },
    pause: () => audio.pause(),
    nexttrack: () => advance(1),
    previoustrack: () => advance(-1, false, true),
  })) {
    try {
      navigator.mediaSession.setActionHandler(action, () => {
        if (!busy && !tagEditor.saving) handler();
      });
    } catch {}
  }
  audio.addEventListener('playing', () => {
    navigator.mediaSession.playbackState = 'playing';
  });
  audio.addEventListener('pause', () => {
    navigator.mediaSession.playbackState = 'paused';
  });
}

refreshTrackTotals();

for (const input of document.querySelectorAll('#settings-dialog input[type=checkbox]'))
  input.setAttribute('role', 'switch');

function shortcutSignature(e) {
  if (e.key === '+' && !e.ctrlKey && !e.metaKey && !e.altKey) return 'Plus';
  let k = e.key === ' ' ? 'Space' : e.key.length === 1 ? e.key.toLowerCase() : e.key;
  return (
    (e.metaKey || e.ctrlKey ? 'Mod+' : '') +
    (e.altKey ? 'Alt+' : '') +
    (e.shiftKey ? 'Shift+' : '') +
    k
  );
}
function shortcutEvent(e, binding) {
  const parts = binding.split('+'),
    key = parts.at(-1);
  return {
    key: key === 'Space' ? ' ' : key,
    code: key === 'Space' ? 'Space' : e.code,
    ctrlKey: parts.includes('Mod'),
    metaKey: false,
    shiftKey: parts.includes('Shift'),
    altKey: parts.includes('Alt'),
    target: e.target,
    repeat: e.repeat,
    preventDefault: () => e.preventDefault(),
  };
}
function focusShortcutBinding(key) {
  document.querySelector(`[data-shortcut-action="${key}"]`)?.focus({ preventScroll: true });
}
function renderShortcutEditor() {
  const box = document.querySelector('#settings-panel-shortcuts .shortcuts');
  const ratingsOpen =
    box.querySelector('.rating-shortcuts')?.open || recordingShortcut?.startsWith('rate');
  const scroll = document.querySelector('.settings-panels').scrollTop;
  box.replaceChildren();
  const names = {
    seekBackward: 'Seek backward',
    seekForward: 'Seek forward',
    collapseAllAlbums: 'Expand / collapse all albums',
    collapseAlbums: 'Expand / collapse album',
    redo: 'Redo',
    undo: 'Undo',
    contextMenu: 'Open context menu',
    resetSort: 'Reset to default order',
    newPlaylist: 'New playlist',
    newLibrary: 'New library',
    cycleView: 'Cycle views',
    columnHeadings: 'Show / hide column headings',
    deleteSelection: 'Remove selected items (confirm)',
    cycleSort: 'Cycle sorting',
    addPlaylist: 'Add to playlist',
    addQueue: 'Add to queue',
    settings: 'Settings',
    search: 'Search',
    previous: 'Previous track',
    next: 'Next track',
    random: 'Random next',
    play: 'Play / pause',
    queue: 'Play queue',
    mini: 'Mini player',
    maximize: 'Maximize / restore',
    quit: 'Exit',
    tags: 'Edit tags',
    rename: 'Rename files and folders',
    shuffle: 'Shuffle',
    repeat: 'Repeat mode',
    selectAll: 'Select all artists / tracks',
    remove: 'Remove from playlist',
  };
  const bindings = { ...shortcutDefaults, ...prefs.shortcuts };
  function rows(keys) {
    const list = el('dl', null, 'shortcut-rows');
    for (const key of keys) {
      const label = el(
          'dt',
          names[key] || (key === 'rate0' ? 'Clear rating' : `Rating ${key.slice(4)}`),
        ),
        cell = el('dd'),
        button = el(
          'button',
          recordingShortcut === key
            ? 'Press shortcut…'
            : bindings[key]
                .replace('Plus', '＋')
                .replace('Mod', '⌘ / Ctrl')
                .replace('ArrowLeft', '←')
                .replace('ArrowRight', '→')
                .replace('ArrowUp', '↑')
                .replace('ArrowDown', '↓')
                .replace(/\b[a-z]\b/g, (c) => c.toUpperCase())
                .replaceAll('+', ' + '),
          'shortcut-binding',
        );
      button.type = 'button';
      button.setAttribute('aria-label', `Change shortcut for ${label.textContent}`);
      button.dataset.shortcutAction = key;
      button.onclick = () => {
        $('settings-error').hidden = true;
        recordingShortcut = key;
        renderShortcutEditor();
        focusShortcutBinding(key);
      };
      cell.append(button);
      list.append(label, cell);
    }
    return list;
  }
  for (const [title, keys] of [
    [
      'Playback',
      ['play', 'previous', 'next', 'random', 'seekBackward', 'seekForward', 'shuffle', 'repeat'],
    ],
    [
      'Browsing',
      [
        'search',
        'contextMenu',
        'cycleView',
        'columnHeadings',
        'cycleSort',
        'resetSort',
        'collapseAlbums',
        'collapseAllAlbums',
        'addQueue',
        'addPlaylist',
      ],
    ],
    [
      'Library & editing',
      [
        'newLibrary',
        'newPlaylist',
        'selectAll',
        'tags',
        'rename',
        'remove',
        'deleteSelection',
        'undo',
        'redo',
      ],
    ],
    ['Window', ['settings', 'queue', 'mini', 'maximize', 'quit']],
  ]) {
    const group = el('section', null, 'preference-group'),
      heading = el('h3', title);
    group.append(heading, rows(keys));
    if (title === 'Library & editing') {
      const ratings = el('details', null, 'rating-shortcuts');
      ratings.open = !!ratingsOpen;
      ratings.append(
        el('summary', 'Ratings'),
        rows(['rate0', 'rate1', 'rate2', 'rate3', 'rate4', 'rate5']),
      );
      group.append(ratings);
    }
    box.append(group);
  }
  const slot = $('shortcut-reset-slot');
  slot.replaceChildren();
  const reset = el('button', 'Reset shortcuts', 'chip');
  reset.id = 'reset-shortcuts';
  reset.type = 'button';
  reset.onclick = () => {
    recordingShortcut = null;
    updateSettings({ shortcuts: { ...shortcutDefaults } });
    renderShortcutEditor();
    $('reset-shortcuts').focus({ preventScroll: true });
  };
  slot.append(reset);
  document.querySelector('.settings-panels').scrollTop = scroll;
}
function focusBrowseSelection(pulse = false) {
  paintPaneFocus(pulse);
  if (selection.pane === 'sidebar') {
    const nodes = sidebarNodes(),
      node = nodes.find((n) => n.classList.contains('active')) || nodes[0];
    focusSidebar(node);
    return;
  }
  if (selection.pane === 'artists') {
    const node =
      [...$('artist-list').querySelectorAll('button')].find(
        (n) =>
          n.dataset.artistKey === (selection.artists.current || deselectedBrowsePositions.artists),
      ) || $('artist-list').querySelector('button');
    if (node) {
      node.focus({ preventScroll: true });
      node.scrollIntoView?.({ block: 'nearest' });
    } else {
      $('artist-list').tabIndex = -1;
      $('artist-list').focus({ preventScroll: true });
    }
  } else {
    if (
      !selection.tracks.current &&
      !selection.albumFocus &&
      !selection.coverFocus &&
      deselectedBrowsePositions.tracks
    ) {
      const content = document.querySelector('.library-content');
      content.tabIndex = -1;
      content.focus({ preventScroll: true });
      return;
    }
    if (!$('empty').hidden && !$('empty-add').hidden && !$('empty-add').disabled) {
      $('empty-add').focus({ preventScroll: true });
      return;
    }
    if (view === 'covers' && !selection.albumDetail) {
      focusCover(
        coverButtons().find((b) => b.dataset.albumKey === selection.coverFocus) ||
          coverButtons()[0],
        false,
        true,
      );
      return;
    }
    if (
      view !== 'tracks' &&
      selection.albumFocus &&
      [...$('browser').querySelectorAll('.album-section')].some(
        (n) => n.dataset.albumKey === selection.albumFocus,
      )
    ) {
      focusAlbumHeading(selection.albumFocus, { preserve: true, scroll: false });
      return;
    }
    const tracks = displayedTracks();
    if (!tracks.length && view !== 'tracks') {
      const album = browsingAlbums()[0];
      if (album) focusAlbumHeading(album.key);
      return;
    }
    if (!selection.tracks.has(selection.tracks.current) && tracks[0]) selectTrack(tracks[0].id);
    const pane = document.querySelector('.content-scroll'),
      top = pane.scrollTop;
    revealSelectedRow();
    if (pulse) pane.scrollTop = top;
  }
}
function revealSelectedRow() {
  const root = view === 'tracks' ? $('tracks').closest('table') : $('browser');
  if (view !== 'tracks') {
    const track = trackLookup.get(selection.tracks.current);
    if (track)
      [...root.querySelectorAll('[data-album-key]')]
        .find((n) => n.dataset.albumKey === albumKey(track))
        ?._mountAlbum?.();
  }
  const tables = view === 'tracks' ? [root] : [...root.querySelectorAll('.track-table')];
  for (const table of tables) table._revealTrack?.(selection.tracks.current, true);
  const row = [...root.querySelectorAll('[data-track-id]')].find(
    (n) => n.dataset.trackId === selection.tracks.current,
  );
  if (row) {
    row.focus({ preventScroll: true });
    const pane = document.querySelector('.content-scroll'),
      r = row.getBoundingClientRect(),
      p = pane.getBoundingClientRect();
    let target = r;
    const section = row.closest('.album-section'),
      height = p.bottom - p.top;
    if (section) {
      const rect = section.getBoundingClientRect(),
        albumTracks = section._trackIds || [];
      if (rect.bottom > rect.top) {
        if (rect.bottom - rect.top <= height) target = rect;
        else if (albumTracks[0] === selection.tracks.current)
          target = { top: rect.top, bottom: r.bottom };
        else if (albumTracks.at(-1) === selection.tracks.current)
          target = { top: r.top, bottom: rect.bottom };
      }
    }
    if (target.top < p.top) pane.scrollTop += target.top - p.top;
    else if (target.bottom > p.bottom) pane.scrollTop += target.bottom - p.bottom;
  } else {
    const pane = document.querySelector('.library-content');
    pane.tabIndex = -1;
    pane.focus({ preventScroll: true });
  }
}
function escapeBrowse() {
  const pane = document.querySelector('.content-scroll'),
    top = pane.scrollTop;
  selection.albumFocus = null;
  selection.tracks.clear();
  selection.tracks.current = null;
  selection.tracks.anchor = null;
  selection.albums.clear();
  selection.coverFocus = null;
  for (const button of coverButtons()) {
    button.classList.remove('cover-keyboard-selected');
    button.setAttribute('aria-pressed', 'false');
  }
  paintSelection();
  for (const node of document.querySelectorAll('.album-selected'))
    node.classList.remove('album-selected');
  if (selection.pane === 'artists') {
    selection.artists.clear();
    selection.artists.current = null;
    selection.artists.anchor = null;
    render();
    selection.pane = 'sidebar';
  } else if (selection.pane === 'tracks') selection.pane = 'artists';
  focusBrowseSelection();
  pane.scrollTop = top;
}

function deselectBrowse() {
  const pane = document.querySelector('.content-scroll'),
    top = pane.scrollTop;
  if (selection.pane === 'artists') {
    const list = $('artist-list'),
      artistTop = list.scrollTop;
    deselectedBrowsePositions.artists =
      selection.artists.current || deselectedBrowsePositions.artists;
    selection.artists.reset();
    render();
    list.scrollTop = artistTop;
    list.tabIndex = -1;
    list.focus({ preventScroll: true });
  } else {
    deselectedBrowsePositions.tracks = selection.tracks.current
      ? { id: selection.tracks.current }
      : selection.albumFocus || selection.coverFocus
        ? { key: selection.albumFocus || selection.coverFocus }
        : deselectedBrowsePositions.tracks;
    selection.tracks.reset();
    selection.albums.reset();
    selection.albumFocus = selection.coverFocus = null;
    paintSelection();
    paintAlbumSelection();
    const content = document.querySelector('.library-content');
    content.tabIndex = -1;
    content.focus({ preventScroll: true });
  }
  pane.scrollTop = top;
}

function navigateBrowse(step, extend = false) {
  if (selection.pane === 'sidebar') {
    const nodes = sidebarNodes(),
      i = nodes.indexOf(document.activeElement);
    focusSidebar(nodes[Math.max(0, Math.min(nodes.length - 1, i < 0 ? 0 : i + step))]);
    return;
  }
  if (selection.pane === 'artists') {
    selection.albumFocus = null;
    selection.albums.clear();
    selection.coverFocus = null;

    const keys = artistsFor(folderTracks, 'name', prefs.artistGrouping);
    if (!keys.length) return;
    const i = keys.indexOf(selection.artists.current || deselectedBrowsePositions.artists),
      next =
        keys[i < 0 ? (step > 0 ? 0 : keys.length - 1) : (i + step + keys.length) % keys.length];
    if (extend) {
      if (!selection.artists.anchor || !keys.includes(selection.artists.anchor))
        selection.artists.anchor = selection.artists.current || next;
      selection.artists.range(keys, next);
    } else {
      selection.artists.clear();
      selection.artists.anchor = next;
    }
    selection.artists.current = next;
    deselectedBrowsePositions.artists = null;
    selection.tracks.current = null;
    selection.tracks.clear();
    expandedAlbums.clear();
    selection.albumDetail = null;
    render();
    focusBrowseSelection();
  } else {
    if (view !== 'tracks' && !(view === 'covers' && !selection.albumDetail)) {
      navigateAlbumEntries(step, extend);
      return;
    }
    const tracks = displayedTracks();
    if (!tracks.length) return;
    const ids = tracks.map((t) => t.id),
      i = ids.indexOf(selection.tracks.current || deselectedBrowsePositions.tracks?.id),
      next = ids[i < 0 ? (step > 0 ? 0 : ids.length - 1) : (i + step + ids.length) % ids.length];
    if (extend) {
      if (!selection.tracks.anchor || !ids.includes(selection.tracks.anchor))
        selection.tracks.anchor = selection.tracks.current || next;
      selection.tracks.range(ids, next);
      selection.tracks.current = next;
      paintSelection();
    } else selectTrack(next);
    deselectedBrowsePositions.tracks = null;
    revealSelectedRow();
  }
}

function appendAlbumDetails() {
  const menu = $('track-actions');
  menu.append(el('p', 'Album information'));
  for (const key of ['artist', 'year', 'tracks', 'duration', 'genre', 'format']) {
    const button = el('button', key[0].toUpperCase() + key.slice(1));
    button.setAttribute('role', 'menuitemcheckbox');
    button.setAttribute('aria-checked', String(prefs.albumDetails.includes(key)));
    paintMenuCheck(button, prefs.albumDetails.includes(key));
    button.onclick = () => {
      const next = prefs.albumDetails.includes(key)
        ? prefs.albumDetails.filter((k) => k !== key)
        : [...prefs.albumDetails, key];
      updateSettings({ albumDetails: next });
      paintMenuCheck(button, prefs.albumDetails.includes(key));
      render({ preserveScroll: true });
    };
    menu.append(button);
  }
}

$('artist-list').addEventListener('focusin', () => {
  selection.pane = 'artists';
  document.body.dataset.browseFocus = selection.pane;
});
document.querySelector('.library-content').addEventListener('focusin', (event) => {
  if (event.target.closest('[data-track-id],[data-album-key],.album-expand,.empty-actions')) {
    selection.pane = 'tracks';
    document.body.dataset.browseFocus = selection.pane;
  }
});

function paintPaneFocus(pulse = true) {
  document.body.dataset.browseFocus = selection.pane;
  for (const item of document.querySelectorAll('.pane-focus-pulse'))
    item.classList.remove('pane-focus-pulse');
  const node =
    selection.pane === 'sidebar'
      ? document.querySelector('.sidebar')
      : selection.pane === 'artists'
        ? $('artist-pane')
        : document.querySelector('.library-content');
  const overlay =
    $('pane-focus-overlay') ||
    (() => {
      const element = el('div', null, '');
      element.id = 'pane-focus-overlay';
      element.setAttribute('aria-hidden', 'true');
      document.body.append(element);
      return element;
    })();
  overlay.classList.remove('pane-focus-pulse');
  if (pulse) {
    const bounds = node.getBoundingClientRect(),
      tracks = document.querySelector('.library-content > .view-toolbar').getBoundingClientRect(),
      queue = $('queue-panel'),
      queueLeft = queue.hidden ? window.innerWidth : queue.getBoundingClientRect().left,
      left =
        selection.pane === 'sidebar'
          ? bounds.left
          : selection.pane === 'artists'
            ? document.querySelector('.workspace').getBoundingClientRect().left
            : tracks.left,
      right =
        selection.pane === 'sidebar'
          ? bounds.right
          : selection.pane === 'artists'
            ? tracks.left
            : Math.min(window.innerWidth, queueLeft);
    overlay.style.left = `${left}px`;
    overlay.style.width = `${Math.max(0, right - left)}px`;
    overlay.style.height = `${selection.pane === 'sidebar' ? window.innerHeight : document.querySelector('.waveform-dock').getBoundingClientRect().top}px`;
    void overlay.offsetWidth;
    overlay.classList.add('pane-focus-pulse');
  }
}
function paintAlbumSelection() {
  for (const section of document.querySelectorAll('.album-section'))
    section.classList.toggle(
      'album-has-selection',
      section._trackIds?.some((id) => selection.tracks.has(id)) ?? false,
    );
  $('browser').classList.toggle('album-multi-selection', selection.albums.size > 1);
  for (const node of document.querySelectorAll('[data-album-key]')) {
    const selected = selection.albums.has(node.dataset.albumKey);
    node.classList.toggle('album-selected', selected);
    if (node.classList.contains('album-section'))
      node.classList.toggle(
        'album-navigation-focus',
        node.dataset.albumKey === selection.albumFocus,
      );
    if (node.classList.contains('album-cover-button')) {
      node.classList.toggle(
        'cover-keyboard-selected',
        selected && node.dataset.albumKey === selection.coverFocus,
      );
      node.setAttribute('aria-pressed', String(selected));
    }
  }
}
function selectAlbumWithModifier(event, key) {
  if (!event || !(event.ctrlKey || event.metaKey || event.shiftKey)) return false;
  selection.pane = 'tracks';
  selection.tracks.reset();
  if (event.shiftKey) {
    const keys = browsingAlbums().map((a) => a.key);
    selection.albums.anchor ??= selection.coverFocus || key;
    selection.albums.range(keys, key, { additive: event.ctrlKey || event.metaKey });
  } else {
    selection.albums.anchor = key;
    selection.albums.toggle(key);
  }
  selection.coverFocus = key;
  if (view === 'albums' || selection.albumDetail) selection.albumFocus = key;
  for (const track of visible)
    if (selection.albums.has(albumKey(track))) selection.tracks.add(track.id);
  paintSelection();
  paintAlbumSelection();
  return true;
}
function openCoverSelection(key) {
  const keys = selection.albums.has(key) ? [...selection.albums] : [key];
  selection.openedAlbums.clear();
  keys.forEach((k) => selection.openedAlbums.add(k));
  selection.albums.clear();
  selection.coverFocus = key;
  coverReturnScroll = document.querySelector('.content-scroll').scrollTop;
  selection.tracks.clear();
  selection.tracks.current = null;
  selection.albumDetail = key;
  render();
  document.querySelector('.content-scroll').scrollTop = 0;
}
function appendWebSearch(id, kind) {
  const button = el('button', `Search ${kind} on web`);
  button.onclick = async () => {
    closeContextMenu();
    try {
      await api.searchWeb({ id, kind });
    } catch (error) {
      toast(error.message);
    }
  };
  $('track-actions').append(button);
}
async function rateSelection(rating) {
  if (busy) {
    toast('Wait for the current operation.');
    return;
  }
  let tracks = selectedBrowsingTracks();
  if (!tracks.length) {
    const track = trackLookup.get(selection.tracks.current) || currentTrack();
    if (track) tracks = [track];
  }
  const ids = [...new Set(tracks.map((t) => t.id))];
  if (!ids.length) {
    toast('Select a track to rate it.');
    return;
  }
  const changes = ids.map((id) => {
    const change = {
      id,
      before: state.ratings?.[id] || 0,
      version: (ratingVersions.get(id) || 0) + 1,
    };
    ratingVersions.set(id, change.version);
    state.ratings ??= {};
    state.ratings[id] = rating;
    return change;
  });
  render({ preserveScroll: true });
  await queuePreferenceWrite(async () => {
    const failures = [],
      tokens = [];
    for (const change of changes) {
      try {
        const result = await saveRating(change.id, rating, false);
        if (result?.undoToken) tokens.push(result.undoToken);
      } catch (error) {
        if (ratingVersions.get(change.id) === change.version)
          state.ratings[change.id] = change.before;
        failures.push(error.message);
      }
    }
    if (tokens.length && api.mergeTagUndo)
      rememberTagEdit({ undoToken: await api.mergeTagUndo(tokens) }, ids);
    render({ preserveScroll: true });
    if (failures.length) toast(`${failures.length} rating(s) could not be saved: ${failures[0]}`);
  });
}
function selectedBrowsingTracks() {
  if (selection.pane === 'artists') {
    const keys = selection.artists.size ? selection.artists : new Set([selection.artists.current]);
    return folderTracks.filter((t) => keys.has(artistGroupKey(t, prefs.artistGrouping)));
  }
  if (selection.pane === 'tracks' && selection.albums.size)
    return visible.filter((t) => selection.albums.has(albumKey(t)));
  return displayedTracks().filter((t) => selection.tracks.has(t.id));
}
function appendNumberActions(tracks) {
  if (!tracks.length || !tracks.every((t) => t?.codec === 'MP3')) return;
  for (const [mode, label] of [
    ['renumber', 'Renumber by folder order'],
    ['pad', 'Add leading zeros'],
    ['unpad', 'Remove leading zeros'],
    ['total', 'Add total tracks'],
  ]) {
    const button = el('button', label);
    button.disabled =
      mode === 'renumber'
        ? !canRenumber(tracks, state.tracks)
        : !tracks.some((track) => numberActionNeeded(track, mode));
    button.onclick = async () => {
      closeContextMenu();
      selection.albums.clear();
      for (const node of document.querySelectorAll('.album-selected'))
        node.classList.remove('album-selected');
      const ids = [...new Set(tracks.map((t) => t.id))];
      const pane = document.querySelector('.content-scroll'),
        top = pane.scrollTop;
      const result = await operation(() =>
        withReleasedTrack(ids.includes(currentTrack()?.id) ? currentTrack().id : null, () =>
          api.formatTrackNumbers(ids, mode),
        ),
      );
      pane.scrollTop = top;
      rememberTagEdit(result, result?.saved);
      if (result?.failures?.length) toast(result.failures.map((f) => f.message).join(' · '));
    };
    $('track-actions').append(button);
  }
}

function sidebarNodes() {
  return [...document.querySelectorAll('#libraries .nav,#playlists .nav')];
}
function focusSidebar(node) {
  for (const item of sidebarNodes()) item.classList.toggle('keyboard-target', item === node);
  node?.focus({ preventScroll: true });
  node?.scrollIntoView?.({ block: 'nearest' });
}
function addToQueue(ids) {
  ids = ids.filter((id) => trackLookup.has(id));
  if (!ids.length) return;
  animateQueuedTracks(ids);
  const before = captureQueue();
  playback.insert(ids, scope);
  renderQueue();
  rememberQueueEdit(
    before,
    `Added ${ids.length === 1 ? '1 track' : ids.length + ' tracks'} to queue`,
  );
}
function addSelectionToQueue() {
  if (selection.pane === 'sidebar') return;
  if (selection.pane === 'artists') {
    const keys = selection.artists.size ? selection.artists : new Set([selection.artists.current]);
    addToQueue(
      folderTracks
        .filter((t) => keys.has(artistGroupKey(t, prefs.artistGrouping)))
        .map((t) => t.id),
    );
    return;
  }
  const focus = document.activeElement,
    trackFocused = !!focus?.closest('[data-track-id]'),
    albumNode = focus?.closest('[data-album-key]');
  const ids = displayedTracks()
    .filter((t) => selection.tracks.has(t.id))
    .map((t) => t.id);
  if (ids.length && (view === 'tracks' || trackFocused || !albumNode)) {
    addToQueue(ids);
    return;
  }
  const albumKeys = selection.albums.size
    ? selection.albums
    : albumNode
      ? new Set([albumNode.dataset.albumKey])
      : null;
  if (albumKeys) {
    addToQueue(visible.filter((t) => albumKeys.has(albumKey(t))).map((t) => t.id));
    return;
  }
  if (ids.length) addToQueue(ids);
  else if (selection.albumDetail)
    addToQueue(visible.filter((t) => albumKey(t) === selection.albumDetail).map((t) => t.id));
}

document.querySelector('.library-content').addEventListener('pointerdown', (event) => {
  if (event.target.closest('.view-toolbar')) return;
  selection.pane = 'tracks';
  document.body.dataset.browseFocus = selection.pane;
});

document.querySelector('.content-scroll').addEventListener('click', (event) => {
  if (
    event.target.closest('button, a, input, select, textarea, [data-track-id], th, .column-resize')
  )
    return;
  selection.pane = 'tracks';
  document.body.dataset.browseFocus = selection.pane;
  deselectBrowse();
});

function positionNotice() {
  const anchor = $('queue').getBoundingClientRect(),
    notice = $('toast');
  if (anchor.width && !document.body.classList.contains('mini-player')) {
    notice.style.top = `${anchor.bottom + 8}px`;
    notice.style.right = `${Math.max(12, window.innerWidth - anchor.right)}px`;
  } else {
    notice.style.top = '';
    notice.style.right = '';
  }
}
window.addEventListener('resize', () => {
  if (!$('toast').hidden) positionNotice();
});

function animateQueuedTracks(ids) {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  const selected = new Set(ids),
    keys = new Set(
      ids
        .map((id) => trackLookup.get(id))
        .filter(Boolean)
        .map(albumKey),
    );
  for (const track of visible) if (!selected.has(track.id)) keys.delete(albumKey(track));
  const rows = [
    ...document.querySelectorAll(
      '.library-content [data-track-id],.cover-grid [data-album-key],.album-section[data-album-key]',
    ),
  ].filter(
    (row) =>
      (selected.has(row.dataset.trackId) || keys.has(row.dataset.albumKey)) &&
      (!row.dataset.trackId || !keys.has(row.closest('.album-section')?.dataset.albumKey)),
  );
  const artists =
    selection.pane === 'artists'
      ? [...document.querySelectorAll('.artist-name')].filter((row) =>
          selection.artists.size
            ? selection.artists.has(row.dataset.artistKey)
            : selection.artists.current === row.dataset.artistKey,
        )
      : [];
  // Each pane ramps from first to last over 300ms, regardless of selection size.
  for (const group of [artists, rows])
    group.forEach((row, index) => {
      const delay = group.length > 1 ? (index * 300) / (group.length - 1) : 0;
      row._queueAnimation?.cancel();
      row._queueGlowAnimation?.cancel();
      let glow = row.querySelector(':scope > .queue-feedback-glow');
      if (!glow) {
        glow = el('span', null, 'queue-feedback-glow');
        glow.setAttribute('aria-hidden', 'true');
        row.append(glow);
      }
      row.style.setProperty('--queue-delay', `${delay}ms`);
      row.classList.add('queue-nudge');
      if (row.animate) {
        row.dataset.webAnimation = 'true';
        const options = { duration: 650, delay, fill: 'both' },
          ease = 'cubic-bezier(.2,.45,.3,1)',
          settle = 'cubic-bezier(.4,0,.2,1)';
        const animation = row.animate(
          [
            { transform: 'translateX(0)', easing: ease },
            { transform: 'translateX(8px)', offset: 0.42, easing: settle },
            { transform: 'translateX(0)' },
          ],
          options,
        );
        row._queueAnimation = animation;
        row._queueGlowAnimation = glow.animate?.(
          [
            { opacity: 0, easing: ease },
            { opacity: 1, offset: 0.42, easing: settle },
            { opacity: 0 },
          ],
          options,
        );
        animation.finished.then(
          () => {
            if (row._queueAnimation === animation) {
              row._queueGlowAnimation?.cancel();
              animation.cancel();
              row.classList.remove('queue-nudge');
              delete row.dataset.webAnimation;
              row._queueAnimation = null;
              row._queueGlowAnimation = null;
            }
          },
          () => {},
        );
      } else {
        const end = (event) => {
          if (event.target !== row) return;
          row.classList.remove('queue-nudge');
          row.removeEventListener('animationend', end);
        };
        row.addEventListener('animationend', end);
      }
    });
}

const outputSettings = createAudioOutputSettings({
  document,
  navigator,
  audio,
  getPreferences: () => prefs,
  updateSettings,
});
function refreshAudioOutputs() {
  return outputSettings.refresh();
}
outputSettings.refresh();
window.addEventListener('beforeunload', () => outputSettings.dispose());

function coverButtons() {
  return [...$('browser').querySelectorAll('.cover-grid .album-cover-button')];
}
function markFocusedCover(button) {
  selection.coverFocus = button.dataset.albumKey;
  paintAlbumSelection();
}
function focusCover(button, extend = false, preserve = false) {
  if (!button) return;
  if (preserve && selection.albums.size) {
  } else if (extend) selectAlbumWithModifier({ shiftKey: true }, button.dataset.albumKey);
  else {
    selection.albums.clear();
    selection.albums.add(button.dataset.albumKey);
    selection.albums.anchor = button.dataset.albumKey;
  }
  paintAlbumSelection();
  markFocusedCover(button);
  button.focus({ preventScroll: true });
  const pane = document.querySelector('.content-scroll'),
    r = button.getBoundingClientRect(),
    p = pane.getBoundingClientRect();
  if (r.top < p.top) pane.scrollTop += r.top - p.top;
  else if (r.bottom > p.bottom) pane.scrollTop += r.bottom - p.bottom;
}
function navigateCovers(key, extend = false) {
  const buttons = coverButtons();
  if (!buttons.length) return;
  let i = buttons.findIndex(
    (b) => b.dataset.albumKey === (selection.coverFocus || deselectedBrowsePositions.tracks?.key),
  );
  deselectedBrowsePositions.tracks = null;
  if (i < 0) {
    focusCover(buttons[0]);
    return;
  }
  const top = buttons[0].getBoundingClientRect().top;
  let columns = buttons.findIndex((b) => b.getBoundingClientRect().top > top + 1);
  if (columns < 1) columns = buttons.length;
  let next;
  if (key === 'ArrowLeft' || key === 'ArrowRight')
    next = (i + (key === 'ArrowRight' ? 1 : buttons.length - 1)) % buttons.length;
  else {
    const rows = Math.ceil(buttons.length / columns),
      row = Math.floor(i / columns),
      col = i % columns;
    next = Math.min(
      buttons.length - 1,
      ((row + (key === 'ArrowDown' ? 1 : rows - 1)) % rows) * columns + col,
    );
  }
  focusCover(buttons[next], extend);
}

$('setting-queuePresentation').onchange = async (event) => {
  await updateSettings({ queuePresentation: event.target.value });
  if (!$('queue-panel').hidden) setQueueVisible(true);
};
$('clean-cache').onclick = async () => {
  const button = $('clean-cache'),
    status = $('cache-status');
  button.disabled = true;
  status.textContent = 'Checking cache…';
  try {
    const result = await queuePreferenceWrite(() => api.cleanCache());
    status.textContent = result.files
      ? `Removed ${result.files} unused cache files (${(result.bytes / 1048576).toFixed(1)} MB).`
      : 'No unused cache files.';
  } catch (error) {
    status.textContent = error.message;
  } finally {
    button.disabled = false;
  }
};
async function transferSettings(action, status = $('transfer-status')) {
  if (busy) return;
  const firstLaunch = isFirstLaunch();
  busy = true;
  setBusy(true);
  status.hidden = false;
  status.textContent =
    action === 'import' ? 'Choose a settings backup…' : 'Choose where to save settings…';
  try {
    await preferenceWrites;
    const result = await api.settingsTransfer(action);
    if (result.cancelled) {
      status.textContent = '';
      status.hidden = true;
      return;
    }
    if (result.state) state = result.state;
    if (result.settings) {
      prefs = { ...prefs, ...result.settings };
      state.settings = prefs;
      shuffle = prefs.shuffle;
      repeat = prefs.repeat;
      if (firstLaunch) {
        changeView(prefs.lastView);
        sort = prefs.defaultSort;
        $('sort').value = sort;
        direction = 1;
      }
      applyPreferences();
      render();
      renderShortcutEditor();
      if (!$('queue-panel').hidden) setQueueVisible(true);
    }
    status.textContent =
      action === 'import'
        ? 'Settings imported. Previous preferences backed up.'
        : 'Settings exported.';
    if (firstLaunch && !isFirstLaunch() && status.id === 'empty-status') {
      selection.pane = 'artists';
      focusBrowseSelection(false);
    }
  } catch (error) {
    status.textContent = error.message.replace(
      /^Error invoking remote method '[^']+': (?:Error: )?/,
      '',
    );
  } finally {
    busy = false;
    setBusy(false);
  }
}
for (const action of ['import', 'export'])
  $('settings-' + action).onclick = () => transferSettings(action);
$('empty-import').onclick = () => transferSettings('import', $('empty-status'));
const undoHistory = [],
  redoHistory = [];
let undoBusy = false;
function rememberEdit(entry, label) {
  redoHistory.length = 0;
  undoHistory.push(entry);
  if (undoHistory.length > 50) undoHistory.shift();
  if (!label) return;
  toast(label);
  const button = el('button', 'Undo', 'chip');
  button.onclick = () => undoEdit();
  $('toast').append(document.createTextNode(' '), button);
}
function captureQueue() {
  return playback.capture();
}
function rememberQueueEdit(before, label) {
  if (JSON.stringify(before.queue) === JSON.stringify(playback.queue)) return;
  rememberEdit({ type: 'queue', before, after: captureQueue() }, label);
}
async function editPlaylistTracks(playlist, ids, label) {
  const before = [...playlist.trackIds];
  if (JSON.stringify(before) === JSON.stringify(ids)) return;
  const result = await operation(
    () => api.playlist({ type: 'tracks', id: playlist.id, trackIds: ids }),
    null,
  );
  if (result) rememberEdit({ type: 'playlist', id: playlist.id, before, after: [...ids] }, label);
  return result;
}
async function undoEdit(redo = false) {
  if (undoBusy || busy) return;
  const from = redo ? redoHistory : undoHistory,
    to = redo ? undoHistory : redoHistory,
    edit = from.at(-1);
  if (!edit) {
    toast(redo ? 'Nothing to redo.' : 'Nothing to undo.');
    return;
  }
  undoBusy = true;
  try {
    const expected = redo ? edit.before : edit.after,
      target = redo ? edit.after : edit.before;
    if (edit.type === 'tags' || edit.type === 'files') {
      busy = true;
      setBusy(true);
      let result;
      try {
        result = await withReleasedTrack(
          edit.ids.includes(currentTrack()?.id) ? currentTrack().id : null,
          () =>
            edit.type === 'tags'
              ? api.restoreTagEdit(edit.token, redo)
              : api.restoreFileNames(edit.token, redo),
        );
        applyFileState(result.state);
      } finally {
        busy = false;
        setBusy(false);
      }
    } else if (edit.type === 'playlist') {
      const playlist = state.playlists.find((p) => p.id === edit.id);
      if (
        !playlist ||
        playlist.dynamic?.enabled ||
        JSON.stringify(playlist.trackIds) !== JSON.stringify(expected)
      )
        throw new Error('This playlist changed; the edit can no longer be restored.');
      const result = await operation(
        () =>
          api.playlist({
            type: 'tracks',
            id: edit.id,
            trackIds: target.filter((id) => trackLookup.has(id)),
          }),
        null,
      );
      if (!result) return;
    } else {
      if (JSON.stringify(playback.queue) !== JSON.stringify(expected.queue))
        throw new Error('The queue changed; the edit can no longer be restored.');
      playback.restoreEdit(target, (id) => trackLookup.has(id));
      renderQueue();
      if (redo) edit.after = captureQueue();
      else edit.before = captureQueue();
    }
    from.pop();
    to.push(edit);
    toast(redo ? 'Edit redone.' : 'Edit undone.');
    const button = el('button', redo ? 'Undo' : 'Redo', 'chip');
    button.onclick = () => undoEdit(!redo);
    $('toast').append(document.createTextNode(' '), button);
  } catch (error) {
    from.pop();
    toast(error.message);
  } finally {
    undoBusy = false;
  }
}

function applyMissingRepair(result) {
  const old = currentTrack(),
    position = audio.currentTime,
    wasPlaying = !audio.paused,
    map = (id) => (Object.hasOwn(result.remap, id) ? result.remap[id] : id);
  playback.remapReferences(result.remap);
  const keys = [...selection.tracks].map(map).filter(Boolean),
    current = map(selection.tracks.current),
    anchor = map(selection.tracks.anchor);
  selection.tracks.clear();
  keys.forEach((id) => selection.tracks.add(id));
  selection.tracks.current = current;
  selection.tracks.anchor = anchor;
  if (searchResultIds) searchResultIds = searchResultIds.map(map).filter(Boolean);
  applyFileState(result.state);
  if (old && Object.hasOwn(result.remap, old.id)) {
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    if (map(old.id)) {
      const generation = ++playGeneration;
      audio.addEventListener(
        'loadedmetadata',
        () => {
          if (generation !== playGeneration) return;
          audio.currentTime = position;
          if (wasPlaying) audio.play().catch(() => {});
        },
        { once: true },
      );
      audio.src = 'localtone://audio/' + map(old.id);
      audio.load();
    } else {
      listener.clear();
      playback.select(-1);
      $('now-title').textContent = 'Nothing playing';
      $('now-artist').textContent = '';
      $('now-art').replaceChildren();
      waveformPeaks = null;
      applyWaveformAppearance();
      render();
    }
  }
}
async function refreshMissingFiles() {
  const button = $('missing-refresh'),
    list = $('missing-list');
  button.disabled = true;
  $('missing-status').textContent = 'Checking files…';
  try {
    const result = await api.missingFiles();
    state = result.state;
    render({ preserveScroll: true });
    list.replaceChildren();
    $('missing-status').textContent = result.missing.length
      ? `${result.missing.length} files missing or unavailable.`
      : 'All indexed files are available.';
    const groups = new Map();
    for (const track of result.missing) {
      if (!groups.has(track.libraryId)) groups.set(track.libraryId, []);
      groups.get(track.libraryId).push(track);
    }
    for (const [id, tracks] of groups) {
      const section = el('section', null, 'missing-group'),
        header = el('div', null, 'missing-heading'),
        library = state.libraries.find((l) => l.id === id),
        button = el('button', 'Reconnect folder…', 'chip dialog-button');
      button.onclick = async () => {
        button.disabled = true;
        try {
          const result = await operation(
            () => api.reconnectLibrary(id),
            'Checking the new folder…',
          );
          if (result) await refreshMissingFiles();
        } finally {
          button.disabled = false;
        }
      };
      header.append(el('strong', `${library?.name || 'Library'} · ${tracks.length}`), button);
      section.append(header);
      for (const track of tracks) {
        const row = el('div', null, 'missing-row');
        row.append(
          el('span', track.title),
          el('small', track.reason),
          el('span', track.path, 'missing-path'),
        );
        const actions = el('div', null, 'missing-actions'),
          select = el('select'),
          reconnect = el('button', 'Reconnect…', 'chip dialog-button'),
          forget = el('button', 'Forget entry…', 'chip dialog-button');
        select.setAttribute('aria-label', 'Replacement for ' + track.title);
        const choose = el('option', 'Choose file…');
        choose.value = '';
        select.append(choose);
        for (const candidate of track.candidates || []) {
          const option = el('option', candidate.path.split(/[\\/]/).at(-1));
          option.value = candidate.id;
          option.title = candidate.path + ' · Matches ' + candidate.reasons.join(', ');
          select.append(option);
        }
        const matchNote = el('small', null, 'missing-match-note');
        const describe = () => {
          const candidate = track.candidates?.find((c) => c.id === select.value);
          matchNote.textContent = candidate
            ? 'Matches ' + candidate.reasons.join(', ') + '. ' + candidate.path
            : track.candidates?.length
              ? 'Possible renamed files found. Choose a match or browse.'
              : 'Choose the new file, or forget an obsolete entry.';
        };
        select.onchange = describe;
        describe();
        const repair = async (action) => {
          if (busy) return;
          busy = true;
          setBusy(true);
          const controls = [...$('missing-dialog').querySelectorAll('button,select')];
          controls.forEach((n) => (n.disabled = true));
          try {
            const result = await api.repairMissingTrack(track.id, action, select.value || null);
            if (result) {
              applyMissingRepair(result);
              await refreshMissingFiles();
              if (result.notice) $('missing-status').textContent = result.notice;
            }
          } catch (error) {
            $('missing-status').textContent = error.message.replace(
              /^Error invoking remote method '[^']+': Error: /,
              '',
            );
          } finally {
            busy = false;
            setBusy(false);
            controls.forEach((n) => (n.disabled = false));
          }
        };
        reconnect.onclick = () => repair('reconnect');
        forget.onclick = () => repair('forget');
        actions.append(select, reconnect, forget);
        row.append(actions, matchNote);
        section.append(row);
      }
      list.append(section);
    }
  } catch (error) {
    $('missing-status').textContent = error.message;
  } finally {
    button.disabled = false;
  }
}
$('missing-refresh').onclick = refreshMissingFiles;
$('open-missing-files').onclick = () => {
  dialogs.open($('missing-dialog'));
  refreshMissingFiles();
};
$('missing-close').onclick = () => {
  if (!busy) $('missing-dialog').close();
};
$('missing-dialog').addEventListener('cancel', (event) => {
  if (busy) event.preventDefault();
});

function prepareGaplessNext() {
  if (!audio.setNext) return;
  audio.promoteIfDue();
  const index =
    repeat === 2
      ? playback.cursor
      : playback.cursor + 1 < playback.queue.length
        ? playback.cursor + 1
        : repeat === 1
          ? 0
          : -1;
  const id = playback.queue[index];
  audio.setNext(id ? { url: `localtone://audio/${id}`, key: `${index}:${id}`, index } : null);
}
audio.addEventListener('playing', prepareGaplessNext);
audio.ontransition = (item) => {
  listener.end(currentTrack()?.duration || 0);
  playback.select(item.index);
  startTrack(null, true);
};
$('setting-exportCollections').onchange = (event) =>
  updateSettings({ exportCollections: event.target.checked });
$('setting-confirmMultiFileTags').onchange = (event) =>
  updateSettings({ confirmMultiFileTags: event.target.checked });
$('setting-renumberIgnoreDiscs').onchange = (event) =>
  updateSettings({ renumberIgnoreDiscs: event.target.checked });
$('setting-totalLeadingZeros').onchange = (event) =>
  updateSettings({ totalLeadingZeros: event.target.checked });
$('setting-gaplessPlayback').onchange = (event) =>
  updateSettings({ gaplessPlayback: event.target.checked });
window.addEventListener('beforeunload', () => audio.dispose?.());

$('artist-pane').addEventListener('pointerdown', (event) => {
  if (event.target.closest('input,button')) return;
  selection.pane = 'artists';
  document.body.dataset.browseFocus = selection.pane;
  $('artist-list').tabIndex = -1;
  $('artist-list').focus({ preventScroll: true });
});

function normalizeContextMenu() {
  normalizeMenu($('track-actions'));
}
function focusAlbumHeading(key, { preserve = false, scroll = true } = {}) {
  selection.albumFocus = key;
  selection.tracks.current = null;
  selection.tracks.clear();
  selection.tracks.anchor = null;
  if (!preserve) {
    selection.albums.select(key);
  }
  paintSelection();
  paintAlbumSelection();
  for (const node of document.querySelectorAll('.album-section'))
    node.classList.toggle('album-navigation-focus', node.dataset.albumKey === key);
  const node = [...$('browser').querySelectorAll('.album-section')].find(
    (n) => n.dataset.albumKey === key,
  );
  node?._mountAlbum?.();
  node?.querySelector('.album-expand')?.focus({ preventScroll: true });
  if (scroll) node?.scrollIntoView?.({ block: 'nearest' });
}
function navigateAlbumEntries(step, extend = false) {
  const albums = browsingAlbums().filter(
    (a) => !selection.albumDetail || matchesOpenedAlbum(a.key),
  );
  const entries = albums.flatMap((a) =>
    (expandedAlbums.get(a.key) ?? (!!selection.albumDetail || prefs.albumExpansion === 'expanded'))
      ? a.tracks.map((t) => ({ id: t.id, key: a.key }))
      : [{ key: a.key }],
  );
  if (!entries.length) return;
  const trackCursor =
      selection.tracks.current || (!selection.albumFocus && deselectedBrowsePositions.tracks?.id),
    albumCursor = selection.albumFocus || (!trackCursor && deselectedBrowsePositions.tracks?.key);
  let i = entries.findIndex((e) =>
    trackCursor ? e.id === trackCursor : !e.id && e.key === albumCursor,
  );
  if (i < 0 && albumCursor) {
    const first = entries.findIndex((e) => e.key === albumCursor);
    if (first >= 0) i = step > 0 ? first - 1 : first;
  }
  const next =
    entries[
      i < 0 ? (step > 0 ? 0 : entries.length - 1) : (i + step + entries.length) % entries.length
    ];
  deselectedBrowsePositions.tracks = null;
  if (next.id) {
    selection.albumFocus = null;
    selection.albums.clear();
    if (extend) {
      const ids = displayedTracks().map((t) => t.id);
      selection.tracks.anchor ??= selection.tracks.current || next.id;
      selection.tracks.range(ids, next.id);
      selection.tracks.current = next.id;
      paintSelection();
    } else selectTrack(next.id);
    for (const n of document.querySelectorAll('.album-navigation-focus'))
      n.classList.remove('album-navigation-focus');
    paintAlbumSelection();
    revealSelectedRow();
  } else {
    if (extend) {
      selection.albums.anchor ??= selection.albumFocus || next.key;
      selection.albums.range(
        albums.map((a) => a.key),
        next.key,
      );
    }
    focusAlbumHeading(next.key, { preserve: extend });
  }
}
function toggleSelectedAlbums(all = false) {
  if (view === 'tracks' || (view === 'covers' && !selection.albumDetail)) return;
  const albums = browsingAlbums().filter(
    (a) => !selection.albumDetail || matchesOpenedAlbum(a.key),
  );
  let keys = selection.tracks.size
    ? [
        ...new Set(
          displayedTracks()
            .filter((t) => selection.tracks.has(t.id))
            .map(albumKey),
        ),
      ]
    : selection.albums.size
      ? [...selection.albums]
      : selection.albumFocus
        ? [selection.albumFocus]
        : [];
  if (all) keys = albums.map((a) => a.key);
  keys = keys.filter((key) => albums.some((a) => a.key === key));
  if (!keys.length) keys = albums.map((a) => a.key);
  if (!keys.length) return;
  const collapse = keys.some(
    (key) =>
      expandedAlbums.get(key) ?? (!!selection.albumDetail || prefs.albumExpansion === 'expanded'),
  );
  const pane = document.querySelector('.content-scroll'),
    top = pane.scrollTop;
  for (const key of keys) expandedAlbums.set(key, !collapse);
  selection.tracks.current = null;
  selection.tracks.clear();
  if (keys.length === 1) selection.albumFocus = keys[0];
  render();
  if (keys.length === 1) focusAlbumHeading(keys[0]);
  pane.scrollTop = top;
}

const playlistDropPane = document.querySelector('.content-scroll');
playlistDropPane.addEventListener('dragover', (event) => {
  const playlist = activePlaylist();
  if (playlist && !playlist.dynamic?.enabled && hasFileDrop(event)) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  }
});
playlistDropPane.addEventListener('drop', (event) => {
  const playlist = activePlaylist();
  if (playlist && !playlist.dynamic?.enabled && hasFileDrop(event)) {
    event.preventDefault();
    event.stopPropagation();
    dropFilesOnPlaylist(playlist.id, event.dataTransfer.files);
  }
});

$('setting-queueDisplayCount').onchange = async (event) => {
  await updateSettings({ queueDisplayCount: Number(event.target.value) });
  renderQueue();
};

for (const button of document.querySelectorAll(
  'dialog button[aria-label^="Close"],#settings-help-close',
)) {
  button.classList.add('dialog-close');
  setIcon(button, 'close');
}

let playlistSubmenu = null,
  playlistSubmenuTrigger = null,
  playlistTargetIds = [];
function closePlaylistSubmenu(focus = false) {
  playlistSubmenu?.remove();
  playlistSubmenu = null;
  if (playlistSubmenuTrigger) {
    playlistSubmenuTrigger.setAttribute('aria-expanded', 'false');
    if (focus) playlistSubmenuTrigger.focus();
  }
  playlistSubmenuTrigger = null;
}
function appendPlaylistActions(ids) {
  const frozen = [...new Set(ids)];
  if (!frozen.length) return;
  const menu = $('track-actions'),
    create = el('button', 'Create playlist from selection…'),
    add = el('button', 'Add to playlist');
  create.onclick = () => {
    closeContextMenu();
    openPlaylistSettings(null, frozen);
  };
  add.dataset.playlistSubmenu = 'true';
  add.setAttribute('aria-haspopup', 'menu');
  add.setAttribute('aria-expanded', 'false');
  const open = () => {
    if (playlistSubmenuTrigger === add) return;
    closePlaylistSubmenu();
    playlistSubmenuTrigger = add;
    add.setAttribute('aria-expanded', 'true');
    const sub = el('div', null, 'playlist-submenu');
    sub.setAttribute('role', 'menu');
    sub.setAttribute('aria-label', 'Add to playlist');
    const playlists = state.playlists.filter((p) => !p.dynamic?.enabled);
    for (const p of playlists) {
      const button = el('button', p.name);
      button.setAttribute('role', 'menuitem');
      button.onclick = async () => {
        closeContextMenu();
        await addIdsToPlaylist(p.id, frozen);
      };
      sub.append(button);
    }
    if (!playlists.length) {
      const empty = el('button', 'No regular playlists');
      empty.disabled = true;
      sub.append(empty);
    }
    $('context-menu').append(sub);
    playlistSubmenu = sub;
    const r = add.getBoundingClientRect(),
      bounds = sub.getBoundingClientRect();
    sub.style.left = `${Math.max(6, r.right + bounds.width + 6 > innerWidth ? r.left - bounds.width : r.right)}px`;
    sub.style.top = `${Math.max(6, Math.min(r.top, innerHeight - bounds.height - 6))}px`;
  };
  add.onclick = () => {
    open();
    playlistSubmenu?.querySelector('button:not(:disabled)')?.focus();
  };
  add.onpointerenter = open;
  for (const button of menu.querySelectorAll('button'))
    button.addEventListener('pointerenter', () => closePlaylistSubmenu());
  menu.append(add, create);
}
async function addIdsToPlaylist(id, ids) {
  const playlist = state.playlists.find((p) => p.id === id);
  if (!playlist || playlist.dynamic?.enabled) return false;
  const next = [...new Set([...playlist.trackIds, ...ids.filter((id) => trackLookup.has(id))])];
  if (next.length === playlist.trackIds.length) return true;
  return !!(await editPlaylistTracks(
    playlist,
    next,
    `Added ${next.length - playlist.trackIds.length} tracks to playlist`,
  ));
}
function openAddToPlaylist(ids) {
  playlistTargetIds = [...new Set(ids)].filter((id) => trackLookup.has(id));
  if (!playlistTargetIds.length) return;
  const select = $('add-to-playlist-select');
  select.replaceChildren();
  for (const p of state.playlists.filter((p) => !p.dynamic?.enabled)) {
    const option = el('option', p.name);
    option.value = p.id;
    select.append(option);
  }
  select.disabled = !select.options.length;
  $('add-to-playlist-apply').disabled = !select.options.length;
  $('add-to-playlist-status').textContent = `${playlistTargetIds.length} selected tracks`;
  dialogs.open($('add-to-playlist-dialog'));
  (select.disabled ? $('add-to-playlist-new') : select).focus();
}
$('add-to-playlist-close').onclick = $('add-to-playlist-cancel').onclick = () =>
  $('add-to-playlist-dialog').close();
$('add-to-playlist-new').onclick = () => {
  $('add-to-playlist-dialog').close();
  openPlaylistSettings(null, playlistTargetIds);
};
$('add-to-playlist-apply').onclick = async () => {
  const button = $('add-to-playlist-apply');
  if (busy || button.disabled) return;
  button.disabled = true;
  try {
    if (await addIdsToPlaylist($('add-to-playlist-select').value, playlistTargetIds))
      $('add-to-playlist-dialog').close();
  } finally {
    button.disabled = false;
  }
};

// Reveal only after settings, icons, layout and keyboard handlers are initialized.
document.documentElement.removeAttribute('data-booting');
await new Promise((resolve) =>
  typeof window.requestAnimationFrame === 'function'
    ? window.requestAnimationFrame(() => window.requestAnimationFrame(resolve))
    : resolve(),
);
await restoreBrowsingViewport();
api?.uiReady?.();

function restoreBrowsingState(saved) {
  if (!saved || saved.version !== 1) return false;
  const valid =
    saved.scope?.kind === 'all' ||
    (saved.scope?.kind === 'library' && state.libraries.some((l) => l.id === saved.scope.id)) ||
    (saved.scope?.kind === 'playlist' && state.playlists.some((p) => p.id === saved.scope.id));
  if (!valid) return false;
  scope = { ...saved.scope };
  query = saved.query || '';
  $('search').value = query;
  view = saved.view;
  sort = saved.sort;
  direction = saved.direction;
  randomSortSeed = saved.seed || 0;
  $('sort').value = sort;
  const ids = new Set(state.tracks.filter((t) => !t.missing).map((t) => t.id)),
    artistKeys = new Set(
      artistsFor(selectTracks(state, scope, query, 'manual'), 'name', prefs.artistGrouping),
    );
  const albumKeys = new Set(
    albumsFor(selectTracks(state, scope, query, 'manual')).map((a) => a.key),
  );
  for (const name of ['artists', 'tracks', 'albums', 'openedAlbums']) {
    const group = selection[name],
      savedGroup = saved.groups?.[name],
      allowed = name === 'artists' ? artistKeys : name === 'tracks' ? ids : albumKeys;
    group.reset();
    if (!savedGroup) continue;
    savedGroup.keys.filter((key) => allowed.has(key)).forEach((key) => group.add(key));
    group.current = allowed.has(savedGroup.current) ? savedGroup.current : null;
    group.anchor = allowed.has(savedGroup.anchor) ? savedGroup.anchor : null;
  }
  for (const key of ['albumDetail', 'albumFocus', 'coverFocus'])
    selection[key] = albumKeys.has(saved[key]) ? saved[key] : null;
  expandedAlbums.clear();
  for (const [key, open] of saved.expanded || [])
    if (albumKeys.has(key)) expandedAlbums.set(key, open);
  selection.pane = saved.pane;
  coverReturnScroll = saved.coverReturnScroll || 0;
  Object.assign(deselectedBrowsePositions, saved.deselected || {});
  revealOpeningArtist = false;
  pendingBrowsingRestore = saved;
  return true;
}
async function restoreBrowsingViewport() {
  const saved = pendingBrowsingRestore;
  if (!saved) return;
  pendingBrowsingRestore = null;
  if (saved.queueOpen) await setQueueVisible(true, { animate: false });
  const panes = [
    ['content', document.querySelector('.content-scroll')],
    ['artists', $('artist-list')],
    ['playlists', $('playlists')],
    ['libraries', $('libraries')],
    ['queue', $('queue-list')],
  ];
  for (const [key, node] of panes) {
    if (!node) continue;
    node.scrollTop = saved.scroll?.[key] || 0;
    node.dispatchEvent(new Event('scroll'));
  }
  await new Promise((resolve) =>
    window.requestAnimationFrame ? window.requestAnimationFrame(resolve) : resolve(),
  );
  paintPaneFocus(false);
  const pane = selection.pane;
  let target;
  if (pane === 'artists')
    target =
      [...$('artist-list').querySelectorAll('[data-artist-key]')].find(
        (n) => n.dataset.artistKey === selection.artists.current,
      ) || $('artist-pane');
  else if (pane === 'sidebar')
    target = sidebarNodes().find((n) => n.classList.contains('active')) || $('all');
  else
    target =
      [...document.querySelectorAll('[data-track-id]')].find(
        (n) => n.dataset.trackId === selection.tracks.current,
      ) ||
      [...$('browser').querySelectorAll('[data-album-key]')].find(
        (n) => n.dataset.albumKey === (selection.coverFocus || selection.albumFocus),
      ) ||
      document.querySelector('.library-content');
  if (target) {
    target.tabIndex = target.tabIndex < 0 ? -1 : target.tabIndex;
    target.focus({ preventScroll: true });
  }
  for (const [key, node] of panes) if (node) node.scrollTop = saved.scroll?.[key] || 0;
  if (saved.mini) await toggleMini();
}
function saveBrowsingState() {
  api?.saveBrowsing?.({
    version: 1,
    scope,
    view,
    pane: selection.pane,
    query,
    sort,
    direction,
    seed: randomSortSeed,
    groups: Object.fromEntries(
      ['artists', 'tracks', 'albums', 'openedAlbums'].map((key) => [
        key,
        selection[key].snapshot(),
      ]),
    ),
    albumDetail: selection.albumDetail,
    albumFocus: selection.albumFocus,
    coverFocus: selection.coverFocus,
    coverReturnScroll,
    expanded: [...expandedAlbums],
    queueOpen: !$('queue-panel').hidden,
    mini: document.body.classList.contains('mini-player'),
    deselected: { ...deselectedBrowsePositions },
    scroll: {
      content: document.querySelector('.content-scroll').scrollTop,
      artists: $('artist-list').scrollTop,
      playlists: $('playlists').scrollTop,
      libraries: $('libraries').scrollTop,
      queue: $('queue-list').scrollTop,
    },
  });
}
window.addEventListener('beforeunload', saveBrowsingState);
api?.onPrepareQuit?.(async () => {
  savePlayback();
  saveBrowsingState();
  await preferenceWrites;
});

// Quiet directory reconciliation after returning from Explorer/Finder, and while open.
if (api.refreshLibraries) {
  let refreshing = !!initialLibraryRefresh,
    queuedRefresh;
  const applyRefresh = (result) => {
    if (result.changed) {
      const old = currentTrack();
      applyFileState(result.state);
      playback.prune((id) => trackLookup.has(id));
      if (old && !trackLookup.has(old.id)) {
        audio.pause();
        audio.removeAttribute('src');
        audio.load();
        listener.clear();
        playback.select(-1);
        $('now-title').textContent = 'Nothing playing';
        $('now-artist').textContent = '';
        $('now-art').replaceChildren();
        waveformPeaks = null;
        applyWaveformAppearance();
      }
      renderQueue();
    }
  };
  initialLibraryRefresh
    ?.then((value) => {
      const changed = ['tracks', 'libraries', 'playlists', 'ratings'].some(
        (key) => JSON.stringify(value[key]) !== JSON.stringify(state[key]),
      );
      applyRefresh({ state: value, changed });
      if (value.startupRefresh?.warnings?.length)
        toast(value.startupRefresh.warnings.join(' · '), true);
    })
    .catch((error) => toast(error.message, true))
    .finally(() => {
      refreshing = false;
    });
  const refresh = async () => {
    if (refreshing || busy || !document.hasFocus() || document.querySelector('dialog[open]'))
      return;
    refreshing = true;
    try {
      const result = await api.refreshLibraries();
      applyRefresh(result);
    } catch {
      /* An edit may hold the write lane; retry on the next refresh. */
    } finally {
      refreshing = false;
    }
  };
  const focused = () => {
    clearTimeout(queuedRefresh);
    queuedRefresh = setTimeout(refresh, 250);
  };
  window.addEventListener('focus', focused);
  const timer = setInterval(refresh, 30000);
  window.addEventListener('beforeunload', () => {
    clearInterval(timer);
    clearTimeout(queuedRefresh);
    window.removeEventListener('focus', focused);
  });
}

let editingLibrary = null;
function openLibrarySettings(library) {
  editingLibrary = library?.id || null;
  const creating = !library;
  $('library-settings-dialog').querySelector('h2').textContent = creating
    ? 'Add library'
    : 'Library settings';
  $('library-create-name-row').hidden = !creating;
  $('library-create-name').required = creating;
  $('library-create-name').value = creating ? 'My music' : library.name;
  $('library-settings-name').hidden = creating;
  $('library-settings-save').textContent = creating ? 'Choose folder…' : 'Save and rescan';
  $('library-settings-name').textContent = library?.name || '';
  const filters = library?.filters || {};
  for (const [field, key] of [
    ['folders', 'folders'],
    ['types', 'fileTypes'],
    ['names', 'fileNames'],
  ])
    $('library-exclude-' + field).value = (filters[key] || []).join(', ');
  $('library-exclude-hidden').checked = !!filters.hiddenFolders;
  $('library-settings-error').hidden = true;
  dialogs.open($('library-settings-dialog'));
  $(creating ? 'library-create-name' : 'library-exclude-folders').focus();
  if (creating) $('library-create-name').select();
}
setIcon($('library-settings-close'), 'close');
$('library-settings-close').onclick = $('library-settings-cancel').onclick = () => {
  if (!busy) $('library-settings-dialog').close();
};
$('library-settings-dialog').addEventListener('cancel', (event) => {
  if (busy) event.preventDefault();
});
$('library-settings-form').onsubmit = async (event) => {
  event.preventDefault();
  if (busy) return;
  const creating = !editingLibrary;
  const before = new Set(state.libraries.map((library) => library.id));
  const filters = { hiddenFolders: $('library-exclude-hidden').checked };
  for (const [field, key] of [
    ['folders', 'folders'],
    ['types', 'fileTypes'],
    ['names', 'fileNames'],
  ])
    filters[key] = $('library-exclude-' + field)
      .value.split(',')
      .map((value) => value.trim())
      .filter(Boolean);
  const controls = [...$('library-settings-form').querySelectorAll('input,button')];
  controls.forEach((control) => (control.disabled = true));
  try {
    const result = await operation(
      () =>
        creating
          ? api.addLibrary($('library-create-name').value.trim(), filters)
          : api.configureLibrary(editingLibrary, filters),
      creating ? 'Choose a music folder…' : 'Checking your library…',
    );
    if (result) {
      $('library-settings-dialog').close();
      if (creating) {
        const added = state.libraries.find((library) => !before.has(library.id));
        if (added) setScope({ kind: 'library', id: added.id });
      } else render({ preserveScroll: true });
    } else if ($('toast').textContent && !$('toast').hidden) {
      $('library-settings-error').textContent = $('toast').textContent;
      $('library-settings-error').hidden = false;
    }
  } finally {
    controls.forEach((control) => (control.disabled = false));
  }
};
