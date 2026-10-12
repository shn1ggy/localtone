require('./app/rules/search.js');
const { defaults, validateSettings, upgradeShortcuts } = require('./preferences.cjs');
const excluded = new Set(['portable', 'audioOutputId', 'audioOutputName', 'shuffle', 'repeat']);
function exportSettings(settings, collection) {
  const allowed = Object.fromEntries(
    Object.keys(defaults)
      .filter((k) => !excluded.has(k))
      .map((k) => [k, settings[k] ?? defaults[k]]),
  );
  return {
    format: 'localtone-settings',
    version: 1,
    settings: validateSettings(allowed),
    ...(settings.exportCollections && collection
      ? { collections: validateCollections(collection) }
      : {}),
  };
}
function importSettings(value) {
  if (
    !value ||
    value.format !== 'localtone-settings' ||
    value.version !== 1 ||
    !value.settings ||
    typeof value.settings !== 'object' ||
    Array.isArray(value.settings)
  )
    throw new Error('Choose a Localtone settings export (version 1).');
  if (Object.keys(value.settings).some((k) => excluded.has(k)))
    throw new Error('Settings imports cannot change storage mode or audio devices.');
  if (value.collections !== undefined) validateCollections(value.collections);
  const input = { ...value.settings };
  // Retired setting: old backups remain importable, but search never changes the queue.
  delete input.searchQueueOnEnter;
  if (input.shortcuts && typeof input.shortcuts === 'object' && !Array.isArray(input.shortcuts))
    input.shortcuts = upgradeShortcuts(input.shortcuts);
  const patch = validateSettings(input);
  if (!Object.keys(patch).length) throw new Error('The settings file is empty.');
  return patch;
}
module.exports = { exportSettings, importSettings };

// Collection backups contain references and metadata, never audio or credentials.
function validateCollections(value) {
  if (
    !value ||
    !Array.isArray(value.libraries) ||
    !Array.isArray(value.tracks) ||
    !Array.isArray(value.playlists)
  )
    throw Error('Invalid collection backup.');
  const ids = (items) => {
    const seen = new Set();
    for (const item of items) {
      if (!item || typeof item.id !== 'string' || !item.id || seen.has(item.id))
        throw Error('Invalid collection IDs.');
      seen.add(item.id);
    }
    return seen;
  };
  const libraryIds = ids(value.libraries),
    trackIds = ids(value.tracks);
  ids(value.playlists);
  const text = (v) => typeof v === 'string' && v.length <= 32768 && !v.includes('\0');
  const libraries = value.libraries.map(({ id, name, root, filters, importedFiles }) => {
    if (!text(name) || !name.trim() || !text(root) || !root) throw Error('Invalid library backup.');
    return {
      id,
      name,
      root,
      ...(filters ? { filters: require('./library-filters.cjs').validateFilters(filters) } : {}),
      ...(importedFiles === true ? { importedFiles: true } : {}),
    };
  });
  const tracks = value.tracks.map((item) => {
    if (!text(item.path) || !item.path || !libraryIds.has(item.libraryId))
      throw Error('Invalid track reference.');
    const clean = {
      id: item.id,
      libraryId: item.libraryId,
      path: item.path,
      cover: false,
      mtime: 0,
      size: Number.isSafeInteger(item.size) && item.size >= 0 ? item.size : 0,
      missing: false,
      excluded: item.excluded === true,
    };
    if (item.size != null && (!Number.isSafeInteger(item.size) || item.size < 0))
      throw Error('Invalid file size in collection backup.');
    for (const key of [
      'title',
      'artist',
      'albumArtist',
      'album',
      'genre',
      'trackRaw',
      'discRaw',
      'codec',
    ]) {
      if (!text(item[key] ?? '')) throw Error('Invalid track metadata.');
      clean[key] = item[key] ?? '';
    }
    for (const key of ['track', 'disc', 'duration', 'addedAt', 'modifiedAt', 'tagRating']) {
      if (
        item[key] != null &&
        (typeof item[key] !== 'number' || !Number.isFinite(item[key]) || item[key] < 0)
      )
        throw Error('Invalid numeric metadata.');
      clean[key] = item[key] ?? null;
    }
    if (clean.tagRating != null && (!Number.isInteger(clean.tagRating) || clean.tagRating > 5))
      throw Error('Invalid rating.');
    if (!(text(item.year) || (Number.isInteger(item.year) && item.year >= 0)))
      throw Error('Invalid year.');
    clean.year = item.year;
    clean.missingTags = Array.isArray(item.missingTags) ? item.missingTags.filter(text) : [];
    return clean;
  });
  const rules = require('./app/rules/playlist-rules.js');
  const playlists = value.playlists.map((item) => {
    if (
      !text(item.name) ||
      !item.name.trim() ||
      !Array.isArray(item.trackIds) ||
      item.trackIds.some((id) => !trackIds.has(id))
    )
      throw Error('Invalid playlist backup.');
    const clean = { id: item.id, name: item.name, trackIds: [...item.trackIds] };
    if (item.browse !== undefined) {
      if (typeof item.browse !== 'boolean') throw Error('Invalid playlist browsing setting.');
      clean.browse = item.browse;
    }
    if (item.dynamic) {
      clean.dynamic = rules.validateDynamic(item.dynamic);
      if (clean.dynamic.libraryId && !libraryIds.has(clean.dynamic.libraryId))
        throw Error('Invalid playlist source library.');
    }
    return clean;
  });
  return { libraries, tracks, playlists };
}
function mergeCollections(current, incoming, makeId = require('node:crypto').randomUUID) {
  const clean = validateCollections(incoming),
    libraries = [...current.libraries],
    tracks = [...current.tracks],
    playlists = [...current.playlists],
    ratings = { ...current.ratings };
  const libraryMap = new Map(),
    trackMap = new Map();
  const byRoot = new Map(libraries.map((l) => [l.root, l])),
    byPath = new Map(tracks.map((t) => [t.path, t]));
  for (const library of clean.libraries) {
    const existing = byRoot.get(library.root),
      id = existing?.id || makeId();
    libraryMap.set(library.id, id);
    if (!existing) {
      const added = { ...library, id };
      libraries.push(added);
      byRoot.set(library.root, added);
    }
  }
  for (const track of clean.tracks) {
    const existing = byPath.get(track.path),
      id = existing?.id || makeId();
    trackMap.set(track.id, id);
    if (!existing) {
      const added = { ...track, id, libraryId: libraryMap.get(track.libraryId) };
      tracks.push(added);
      byPath.set(track.path, added);
      if (track.tagRating) ratings[id] = track.tagRating;
    }
  }
  for (const playlist of clean.playlists)
    playlists.push({
      ...playlist,
      id: makeId(),
      trackIds: playlist.trackIds.map((id) => trackMap.get(id)),
      ...(playlist.dynamic
        ? {
            dynamic: {
              ...playlist.dynamic,
              libraryId: libraryMap.get(playlist.dynamic.libraryId) || '',
            },
          }
        : {}),
    });
  return { libraries, tracks, playlists, ratings };
}
module.exports.validateCollections = validateCollections;
module.exports.mergeCollections = mergeCollections;
