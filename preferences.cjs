const columns = require('./columns.cjs');
const { validateReplacements } = require('./file-naming.cjs');
const { designDefaults } = require('./app/design-defaults.js');
const shortcutDefaults = {
  addPlaylist: 'Plus',
  contextMenu: 'Shift+Enter',
  seekBackward: 'Alt+ArrowLeft',
  seekForward: 'Alt+ArrowRight',
  collapseAllAlbums: 'Shift+c',
  collapseAlbums: 'c',
  redo: 'Mod+Shift+z',
  undo: 'Mod+z',
  resetSort: 'Shift+o',
  newPlaylist: 'Mod+n',
  newLibrary: 'Mod+l',
  cycleView: 'x',
  columnHeadings: 'Shift+x',
  deleteSelection: 'Shift+Backspace',
  cycleSort: 'o',
  addQueue: 'a',
  settings: 'Mod+p',
  search: 'Mod+f',
  previous: 'Mod+ArrowLeft',
  next: 'Mod+ArrowRight',
  random: 'Mod+Shift+ArrowRight',
  play: 'Space',
  queue: 'p',
  mini: 'm',
  maximize: 'f',
  quit: 'Mod+q',
  tags: 'e',
  shuffle: 's',
  repeat: 'r',
  rename: 'F2',
  selectAll: 'Mod+a',
  remove: 'Delete',
  rate0: 'Mod+0',
  rate1: 'Mod+1',
  rate2: 'Mod+2',
  rate3: 'Mod+3',
  rate4: 'Mod+4',
  rate5: 'Mod+5',
};
const defaults = Object.freeze({
  tagFieldsExpanded: true,
  tagNumbersExpanded: true,
  renameAlbumFormula: '%year% %album%',
  renameTrackFormula: '%tracknumber% %title%',
  renameReplacements: {},
  animateLogo: true,
  exportCollections: false,
  confirmMultiFileTags: true,
  totalLeadingZeros: false,
  renumberIgnoreDiscs: false,
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
  lastView: 'albums',
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
  albumExpansion: 'collapsed',
  columns: columns.defaults,
  columnsByView: Object.fromEntries(
    ['tracks', 'playlists', 'albums'].map((key) => [key, columns.defaults.map((c) => ({ ...c }))]),
  ),
  ...structuredClone(designDefaults),
});
const choices = {
  artistGrouping: ['folder', 'artist', 'albumArtist'],
  defaultSort: [
    'folder',
    'artist',
    'album',
    'title',
    'year',
    'genre',
    'duration',
    'rating',
    'random',
  ],
  queuePresentation: ['overlay', 'extend'],
  trackNumberFormat: ['number', 'full'],
  albumLayout: ['side', 'compact'],
  lastView: ['albums', 'covers', 'tracks'],
  libraryOpening: ['random', 'first', 'none', 'last'],
  seekDisplay: ['line', 'waveform'],
  waveformStyle: ['bars', 'solid', 'outline'],
  waveformHeight: ['compact', 'tall'],
  albumExpansion: ['expanded', 'collapsed'],
  albumView: ['list', 'covers'],
  artistSort: ['name', 'name-desc', 'duration', 'duration-desc'],
  theme: ['sage', 'slate', 'blue', 'lavender', 'amber'],
  coverSize: ['small', 'medium', 'large'],
  defaultView: ['artists', 'albums', 'covers', 'tracks'],
};
function validateSettings(patch) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch))
    throw new Error('Invalid settings.');
  const clean = {};
  for (const [key, value] of Object.entries(patch)) {
    if (key === 'renameReplacements') {
      clean[key] = validateReplacements(value);
      continue;
    }
    if (key === 'renameAlbumFormula' || key === 'renameTrackFormula') {
      if (typeof value !== 'string' || value.length > 500 || value.includes('\0'))
        throw new Error('Invalid naming formula.');
      clean[key] = value;
      continue;
    }
    if (key === 'seekStep') {
      if (!Number.isInteger(value) || value < 1 || value > 60)
        throw new Error('Seek step must be from 1 to 60 seconds.');
      clean[key] = value;
      continue;
    }
    if (key === 'queueDisplayCount') {
      if (!Number.isInteger(value) || value < 10 || value > 1000)
        throw new Error('Queue display count must be from 10 to 1000.');
      clean[key] = value;
      continue;
    }
    if (key === 'audioOutputId' || key === 'audioOutputName') {
      if (typeof value !== 'string' || value.length > 500 || value.includes('\0'))
        throw new Error('Invalid audio output.');
      clean[key] = value;
      continue;
    }
    if (key === 'albumDetails') {
      if (
        !Array.isArray(value) ||
        value.some((k) => !['artist', 'year', 'tracks', 'duration', 'genre', 'format'].includes(k))
      )
        throw new Error('Invalid album details');
      clean[key] = [...new Set(value)];
      continue;
    }
    if (key === 'shortcuts') {
      if (
        !value ||
        Object.keys(value).length !== Object.keys(shortcutDefaults).length ||
        Object.keys(shortcutDefaults).some(
          (k) =>
            typeof value[k] !== 'string' ||
            value[k] === 'Enter' ||
            !/^(Mod\+)?(Alt\+)?(Shift\+)?([a-z0-9]|F([1-9]|1[0-2])|ArrowLeft|ArrowRight|ArrowUp|ArrowDown|Space|Delete|Backspace|Enter|Plus)$/.test(
              value[k],
            ),
        ) ||
        new Set(Object.values(value)).size !== Object.keys(value).length
      )
        throw new Error('Use a unique shortcut for each action.');
      clean[key] = { ...value };
      continue;
    }
    if (key === 'columnsByView') {
      if (
        !value ||
        typeof value !== 'object' ||
        Array.isArray(value) ||
        Object.keys(value).length !== 3 ||
        !['tracks', 'playlists', 'albums'].every((k) => Object.hasOwn(value, k))
      )
        throw new Error('Invalid view columns');
      clean[key] = Object.fromEntries(
        ['tracks', 'playlists', 'albums'].map((k) => [k, columns.validateColumns(value[k])]),
      );
      continue;
    }
    if (key === 'columns') {
      clean[key] = columns.validateColumns(value);
      continue;
    }
    if (choices[key]) {
      if (!choices[key].includes(value)) throw new Error(`Invalid ${key}.`);
    } else if (key === 'sidebarWidth' || key === 'artistWidth') {
      if (
        !Number.isInteger(value) ||
        value < (key === 'sidebarWidth' ? 140 : 160) ||
        value > (key === 'sidebarWidth' ? 320 : 420)
      )
        throw new Error('Invalid pane width.');
    } else if (key === 'backgroundSaturation' || key === 'backgroundBrightness') {
      if (
        !Number.isInteger(value) ||
        value < 0 ||
        value > (key === 'backgroundSaturation' ? 100 : 30)
      )
        throw new Error('Invalid background color.');
    } else if (key === 'backgroundHue' || key === 'seekHeight') {
      if (
        !Number.isInteger(value) ||
        value < (key === 'seekHeight' ? 16 : 0) ||
        value > (key === 'seekHeight' ? 200 : 360)
      )
        throw new Error('Invalid appearance value.');
    } else if (['accentColor', 'primaryTextColor', 'secondaryTextColor'].includes(key)) {
      if (value !== '' && (typeof value !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(value)))
        throw new Error('Invalid appearance color.');
    } else if (key === 'volume') {
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1)
        throw new Error('Invalid volume.');
    } else if (
      key === 'animateLogo' ||
      key === 'exportCollections' ||
      key === 'confirmMultiFileTags' ||
      key === 'renumberIgnoreDiscs' ||
      key === 'tagFieldsExpanded' ||
      key === 'tagNumbersExpanded' ||
      key === 'totalLeadingZeros' ||
      key === 'lookupLeadingZeros' ||
      key === 'gaplessPlayback' ||
      key === 'sidebarLocked' ||
      key === 'artistLocked' ||
      key === 'globalPlaybackShortcuts' ||
      key === 'seekHeightLocked' ||
      key === 'shuffle' ||
      key === 'waveformNormalize' ||
      key === 'showColumnHeaders' ||
      key === 'showDiscNumber' ||
      key === 'portable'
    ) {
      if (typeof value !== 'boolean') throw new Error(`Invalid ${key}.`);
    } else if (key === 'repeat') {
      if (![0, 1, 2].includes(value)) throw new Error('Invalid repeat setting.');
    } else throw new Error('Unknown setting.');
    clean[key] = value;
  }
  return clean;
}
function upgradeShortcuts(bindings) {
  const upgraded = { ...bindings };
  if (upgraded.quit === 'q' && !Object.values(upgraded).includes('Mod+q')) upgraded.quit = 'Mod+q';
  if (
    upgraded.rename === 'r' &&
    upgraded.repeat === 'Shift+r' &&
    !Object.values(upgraded).includes('F2')
  ) {
    upgraded.rename = 'F2';
    upgraded.repeat = 'r';
  }
  for (const [action, preferred] of [
    ['rename', 'F2'],
    ['contextMenu', 'Shift+Enter'],
    ['seekBackward', 'Alt+ArrowLeft'],
    ['seekForward', 'Alt+ArrowRight'],
    ['collapseAllAlbums', 'Shift+c'],
    ['collapseAlbums', 'c'],
    ['redo', 'Mod+Shift+z'],
    ['undo', 'Mod+z'],
    ['addQueue', 'a'],
    ['cycleView', 'x'],
    ['columnHeadings', 'Shift+x'],
    ['deleteSelection', 'Shift+Backspace'],
    ['cycleSort', 'o'],
    ['resetSort', 'Shift+o'],
    ['newPlaylist', 'Mod+n'],
    ['newLibrary', 'Mod+l'],
  ])
    if (!Object.hasOwn(upgraded, action)) {
      const binding = [
        preferred,
        ...(preferred.includes('+') ? [] : ['Alt+' + preferred, 'Mod+Alt+' + preferred]),
        ...Array.from({ length: 12 }, (_, i) => 'F' + (i + 1)),
      ].find((k) => !Object.values(upgraded).includes(k));
      if (binding) upgraded[action] = binding;
    }
  return upgraded;
}
function normalizeSettings(stored) {
  const result = structuredClone(defaults);
  if (stored && Object.keys(stored).length) {
    if (!stored.artistGrouping) result.artistGrouping = 'folder';
    if (!stored.defaultSort) result.defaultSort = 'folder';
  }
  if (stored?.shortcuts) {
    const upgraded = upgradeShortcuts(stored.shortcuts);
    stored = { ...stored, shortcuts: upgraded };
  }
  if (stored && typeof stored === 'object')
    for (const key of Object.keys(defaults)) {
      try {
        Object.assign(result, validateSettings({ [key]: stored[key] }));
      } catch {}
    }
  if (!stored?.columnsByView)
    result.columnsByView = Object.fromEntries(
      ['tracks', 'playlists', 'albums'].map((key) => [key, result.columns.map((c) => ({ ...c }))]),
    );
  if (!stored?.albumView && stored?.defaultView === 'covers') result.albumView = 'covers';
  if (!['albums', 'covers', 'tracks'].includes(stored?.lastView))
    result.lastView =
      result.defaultView === 'tracks'
        ? 'tracks'
        : result.albumView === 'covers'
          ? 'covers'
          : 'albums';
  const oldPreset = [
    ['number', 38],
    ['title', 240],
    ['artist', 150],
    ['album', 160],
    ['year', 65],
    ['genre', 100],
    ['duration', 80],
    ['rating', 96],
  ];
  const isOldPreset = (value) =>
    Array.isArray(value) &&
    value.length === oldPreset.length &&
    value.every(
      (c, i) =>
        c.key === oldPreset[i][0] &&
        c.width === oldPreset[i][1] &&
        c.visible &&
        !c.fixed &&
        (c.align === undefined || c.align === columns.defaults.find((d) => d.key === c.key).align),
    );
  if (isOldPreset(stored?.columns)) result.columns = columns.defaults.map((c) => ({ ...c }));
  for (const view of ['tracks', 'playlists', 'albums'])
    if (
      isOldPreset(
        stored?.columnsByView?.[view] ?? (!stored?.columnsByView ? stored?.columns : null),
      )
    )
      result.columnsByView[view] = columns.defaults.map((c) => ({ ...c }));
  const legacyColumns = [
    ['number', 28, true, true],
    ['title', 240, true, false],
    ['rating', 84, true, true],
    ['duration', 72, true, true],
    ['artist', 150, false, false],
    ['album', 160, false, false],
    ['year', 65, false, true],
    ['genre', 100, false, false],
  ].map(([key, width, visible, fixed]) => ({
    key,
    width,
    visible,
    fixed,
    align: ['rating', 'duration'].includes(key) ? 'right' : key === 'year' ? 'center' : 'left',
  }));
  const previousPreset = legacyColumns.map((c) => ({
    ...c,
    width: c.key === 'number' ? 52 : c.key === 'duration' ? 72 : c.width,
  }));
  const updatePreset = (layout) =>
    layout.every((c, i) =>
      ['key', 'width', 'visible', 'fixed', 'align'].every((k) => c[k] === previousPreset[i][k]),
    )
      ? columns.defaults.map((c) => ({ ...c }))
      : layout;
  result.columns = updatePreset(result.columns);
  result.columnsByView = Object.fromEntries(
    Object.entries(result.columnsByView).map(([view, layout]) => [view, updatePreset(layout)]),
  );
  // Upgrade only exact shipped layouts; keep all user-customized widths and order.
  const prior = legacyColumns.map((c) => ({
    ...c,
    width: c.key === 'number' ? 42 : c.key === 'rating' ? 100 : c.key === 'duration' ? 80 : c.width,
  }));
  const migrate = (layout) =>
    layout.every((c, i) =>
      ['key', 'width', 'visible', 'fixed', 'align'].every((k) => c[k] === prior[i][k]),
    )
      ? columns.defaults.map((c) => ({ ...c }))
      : layout;
  result.columns = migrate(result.columns);
  result.columnsByView = Object.fromEntries(
    Object.entries(result.columnsByView).map(([key, value]) => [key, migrate(value)]),
  );
  const compactPrior = legacyColumns.map((c) => ({
    ...c,
    width: c.key === 'number' ? 36 : c.width,
  }));
  const compactUpgrade = (value) =>
    value.every((c, i) =>
      ['key', 'width', 'visible', 'fixed', 'align'].every((k) => c[k] === compactPrior[i][k]),
    )
      ? columns.defaults.map((c) => ({ ...c }))
      : value;
  result.columns = compactUpgrade(result.columns);
  result.columnsByView = Object.fromEntries(
    Object.entries(result.columnsByView).map(([key, value]) => [key, compactUpgrade(value)]),
  );
  const lastPreset = columns.defaults.map((c) => ({
    ...c,
    width: c.key === 'number' ? 32 : c.width,
  }));
  const tighten = (value) =>
    value.every((c, i) =>
      ['key', 'width', 'visible', 'fixed', 'align'].every((k) => c[k] === lastPreset[i][k]),
    )
      ? columns.defaults.map((c) => ({ ...c }))
      : value;
  result.columns = tighten(result.columns);
  result.columnsByView = Object.fromEntries(
    Object.entries(result.columnsByView).map(([key, value]) => [key, tighten(value)]),
  );
  const shared = stored?.columnsByView ? result.columnsByView.tracks : result.columns;
  result.columns = shared.map((c) => ({ ...c }));
  result.columnsByView = Object.fromEntries(
    ['tracks', 'playlists', 'albums'].map((k) => [k, shared.map((c) => ({ ...c }))]),
  );
  if (result.shuffle) result.repeat = 0;
  return result;
}
function validateRating(value) {
  if (!Number.isInteger(value) || value < 0 || value > 5)
    throw new Error('Choose a whole-star rating from 1 to 5, or clear it.');
  return value;
}
module.exports = {
  upgradeShortcuts,
  defaults,
  validateSettings,
  normalizeSettings,
  validateRating,
};
