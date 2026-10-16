const { contextBridge, ipcRenderer, webUtils } = require('electron');
contextBridge.exposeInMainWorld('localtone', {
  platform: process.platform,
  onGlobalPlayback: (callback) => {
    ipcRenderer.on('global-playback', (_event, action) => callback(action));
  },
  onGlobalShortcutStatus: (callback) => {
    ipcRenderer.on('global-shortcut-status', (_event, status) => callback(status));
  },
  appInfo: () => ipcRenderer.invoke('app-info'),
  aboutAction: (action) => ipcRenderer.invoke('about-action', action),
  checkUpdate: () => ipcRenderer.invoke('check-update'),
  downloadUpdate: (name) => ipcRenderer.invoke('download-update', name),
  cancelUpdate: () => ipcRenderer.invoke('cancel-update'),
  revealUpdate: () => ipcRenderer.invoke('reveal-update'),
  onUpdateProgress: (callback) => {
    const listener = (_event, value) => callback(value);
    ipcRenderer.on('update-progress', listener);
    return () => ipcRenderer.removeListener('update-progress', listener);
  },
  prepareUpdate: () => ipcRenderer.invoke('prepare-update'),
  uiReady: () => ipcRenderer.send('ui-ready'),
  windowAction: (action, size) => ipcRenderer.invoke('window-action', action, size),
  layoutMinimum: (width, height, viewport) =>
    ipcRenderer.send('layout-minimum', width, height, viewport),
  saveBrowsing: (value) => ipcRenderer.sendSync('save-browsing', value),
  savePlayback: (value) => ipcRenderer.sendSync('save-playback', value),
  rememberPlayed: (id) => ipcRenderer.invoke('remember-played', id),
  decodeGapless: (id, sampleRate) => ipcRenderer.invoke('decode-gapless', id, sampleRate),
  cancelGapless: () => ipcRenderer.invoke('cancel-gapless'),
  waveform: (id) => ipcRenderer.invoke('waveform', id),
  cancelWaveform: () => ipcRenderer.invoke('waveform-cancel'),
  searchWeb: (action) => ipcRenderer.invoke('search-web', action),
  openFolder: (action) => ipcRenderer.invoke('open-folder', action),
  lastfm: (action) => ipcRenderer.invoke('lastfm', action),
  lastfmPlayback: (kind, play) => ipcRenderer.invoke('lastfm-playback', kind, play),
  cleanupExternalData: () => ipcRenderer.invoke('cleanup-external-data'),
  findDuplicates: (mode) => ipcRenderer.invoke('find-duplicates', mode),
  removeDuplicates: (token, ids) => ipcRenderer.invoke('remove-duplicates', token, ids),
  cleanCache: () => ipcRenderer.invoke('clean-cache'),
  settingsTransfer: (action) => ipcRenderer.invoke('settings-transfer', action),
  settings: (patch) => ipcRenderer.invoke('settings', patch),
  rate: (id, value) => ipcRenderer.invoke('rating', id, value),
  previewFileNames: (ids, config) => ipcRenderer.invoke('preview-file-names', ids, config),
  applyFileNames: (token, selectedIds) =>
    ipcRenderer.invoke('apply-file-names', token, selectedIds),
  restoreFileNames: (token, redo) => ipcRenderer.invoke('restore-file-names', token, redo),
  restoreTagEdit: (token, redo) => ipcRenderer.invoke('restore-tag-edit', token, redo),
  mergeTagUndo: (tokens) => ipcRenderer.invoke('merge-tag-undo', tokens),
  trackNumbers: () => ipcRenderer.invoke('track-numbers'),
  musicbrainzSearch: (query) => ipcRenderer.invoke('musicbrainz-search', query),
  musicbrainzRelease: (id) => ipcRenderer.invoke('musicbrainz-release', id),
  formatTrackNumbers: (ids, mode) => ipcRenderer.invoke('format-track-numbers', ids, mode),
  readTagsBatch: (ids) => ipcRenderer.invoke('read-tags-batch', ids),
  writeTagsBatch: (entries, patch, remove) =>
    ipcRenderer.invoke('write-tags-batch', entries, patch, remove),
  readTags: (id) => ipcRenderer.invoke('read-tags', id),
  writeTags: (id, values, token) => ipcRenderer.invoke('write-tags', id, values, token),
  load: (options) => ipcRenderer.invoke('load', options),
  addLibrary: (name, filters) => ipcRenderer.invoke('add-library', name, filters),
  refreshLibraries: () => ipcRenderer.invoke('refresh-libraries'),
  missingFiles: () => ipcRenderer.invoke('missing-files'),
  repairMissingTrack: (id, action, candidateId) =>
    ipcRenderer.invoke('repair-missing-track', id, action, candidateId),
  reconnectLibrary: (id) => ipcRenderer.invoke('reconnect-library', id),
  rescan: (id) => ipcRenderer.invoke('rescan', id),
  deleteLibrary: (id) => ipcRenderer.invoke('delete-library', id),
  deleteFiles: (ids) => ipcRenderer.invoke('delete-files', ids),
  configureLibrary: (id, filters) => ipcRenderer.invoke('configure-library', id, filters),
  renameLibrary: (id, name) => ipcRenderer.invoke('rename-library', id, name),
  filePath: (file) => webUtils.getPathForFile(file),
  importPlaylistFiles: (id, paths) => ipcRenderer.invoke('import-playlist-files', id, paths),
  playlist: (action) => ipcRenderer.invoke('playlist', action),
  onProgress: (callback) => {
    const listener = (_event, count) => callback(count);
    ipcRenderer.on('scan-progress', listener);
    return () => ipcRenderer.removeListener('scan-progress', listener);
  },
});
