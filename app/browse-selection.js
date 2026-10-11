// Browsing owns selection and anchors; it has no playback or DOM dependencies.
export function createSelectionGroup() {
  const keys = new Set();
  let current = null,
    anchor = null;
  const group = {
    get current() {
      return current;
    },
    set current(value) {
      current = value;
    },
    get anchor() {
      return anchor;
    },
    set anchor(value) {
      anchor = value;
    },
    get size() {
      return keys.size;
    },
    has(key) {
      return keys.has(key);
    },
    add(key) {
      keys.add(key);
      return group;
    },
    delete(key) {
      return keys.delete(key);
    },
    clear() {
      keys.clear();
    },
    [Symbol.iterator]() {
      return keys.values();
    },
    forEach(callback) {
      keys.forEach((key) => callback(key, key, group));
    },
    select(key) {
      keys.clear();
      if (key != null) keys.add(key);
      current = anchor = key;
    },
    toggle(key) {
      if (keys.has(key)) keys.delete(key);
      else keys.add(key);
    },
    range(order, target, { from = anchor || current || target, additive = false } = {}) {
      const end = order.indexOf(target);
      if (end < 0) return;
      let start = order.indexOf(from);
      if (start < 0) start = end;
      if (!additive) keys.clear();
      for (const key of order.slice(Math.min(start, end), Math.max(start, end) + 1)) keys.add(key);
    },
    reset() {
      keys.clear();
      current = anchor = null;
    },
    snapshot() {
      return { keys: [...keys], current, anchor };
    },
  };
  return group;
}

export function createBrowseSelection() {
  const tracks = createSelectionGroup();
  const artists = createSelectionGroup();
  const albums = createSelectionGroup();
  const openedAlbums = createSelectionGroup();
  let pane = 'tracks',
    coverFocus = null,
    albumFocus = null,
    albumDetail = null;
  const panes = ['sidebar', 'artists', 'tracks'];
  return {
    tracks,
    artists,
    albums,
    openedAlbums,
    get pane() {
      return pane;
    },
    set pane(value) {
      if (!panes.includes(value)) throw new Error('Unknown browsing pane.');
      pane = value;
    },
    get coverFocus() {
      return coverFocus;
    },
    set coverFocus(value) {
      coverFocus = value;
    },
    get albumFocus() {
      return albumFocus;
    },
    set albumFocus(value) {
      albumFocus = value;
    },
    get albumDetail() {
      return albumDetail;
    },
    set albumDetail(value) {
      albumDetail = value;
    },
    cyclePane(step) {
      pane = panes[(panes.indexOf(pane) + step + panes.length) % panes.length];
    },
    resetCollection() {
      tracks.reset();
      artists.reset();
      albums.reset();
      openedAlbums.reset();
      coverFocus = albumFocus = albumDetail = null;
    },
  };
}
