// Session navigation is local state, separate from transferable preferences.
function validateSession(value) {
  if (!value || value.version !== 1 || !['all', 'library', 'playlist'].includes(value.scope?.kind))
    throw Error('Invalid browsing session.');
  const text = (v) => typeof v === 'string' && v.length <= 32768;
  const key = (v) => v === null || text(v);
  const group = (g) => {
    if (
      !g ||
      !Array.isArray(g.keys) ||
      g.keys.length > 50000 ||
      !g.keys.every(text) ||
      !key(g.current) ||
      !key(g.anchor)
    )
      throw Error('Invalid session selection.');
    return { keys: [...g.keys], current: g.current, anchor: g.anchor };
  };
  if (
    !['albums', 'covers', 'tracks'].includes(value.view) ||
    !['sidebar', 'artists', 'tracks'].includes(value.pane) ||
    !text(value.query) ||
    value.query.length > 2000 ||
    ![
      'folder',
      'manual',
      'artist',
      'album',
      'year',
      'genre',
      'title',
      'duration',
      'rating',
      'random',
      'addedAt',
      'modifiedAt',
    ].includes(value.sort) ||
    ![-1, 1].includes(value.direction)
  )
    throw Error('Invalid browsing state.');
  const scroll = {};
  for (const name of ['content', 'artists', 'playlists', 'queue']) {
    const top = value.scroll?.[name];
    if (!Number.isFinite(top) || top < 0 || top > 1e9) throw Error('Invalid session scroll.');
    scroll[name] = top;
  }
  if (
    !Array.isArray(value.expanded) ||
    value.expanded.length > 50000 ||
    !value.expanded.every((v) => Array.isArray(v) && text(v[0]) && typeof v[1] === 'boolean')
  )
    throw Error('Invalid album state.');
  const clean = {
    version: 1,
    scope: {
      kind: value.scope.kind,
      ...(value.scope.kind !== 'all' ? { id: value.scope.id } : {}),
    },
    view: value.view,
    pane: value.pane,
    query: value.query,
    sort: value.sort,
    direction: value.direction,
    scroll,
    expanded: value.expanded.map((v) => [...v]),
    groups: Object.fromEntries(
      ['artists', 'tracks', 'albums', 'openedAlbums'].map((name) => [
        name,
        group(value.groups?.[name]),
      ]),
    ),
    queueOpen: value.queueOpen === true,
  };
  if (value.scope.kind !== 'all' && !text(value.scope.id))
    throw Error('Invalid session collection.');
  for (const name of ['albumDetail', 'albumFocus', 'coverFocus']) {
    if (!key(value[name])) throw Error('Invalid album focus.');
    clean[name] = value[name];
  }
  clean.coverReturnScroll = Number.isFinite(value.coverReturnScroll)
    ? Math.max(0, value.coverReturnScroll)
    : 0;
  clean.seed = Number.isSafeInteger(value.seed) ? value.seed : 0;
  if (value.window) {
    const b = value.window.bounds;
    if (
      !b ||
      !['x', 'y', 'width', 'height'].every((k) => Number.isFinite(b[k])) ||
      b.width < 100 ||
      b.height < 100 ||
      b.width > 20000 ||
      b.height > 20000
    )
      throw Error('Invalid session window.');
    clean.window = {
      bounds: { x: b.x, y: b.y, width: b.width, height: b.height },
      maximized: value.window.maximized === true,
    };
  }
  return clean;
}
module.exports = { validateSession };
