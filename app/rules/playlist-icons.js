(function (root) {
  // Stable identifiers are saved with playlists; SVG markup never enters collection data.
  const entries = [
    ['playlist', 'Playlist', 'M4 5h16M4 10h16M4 15h9M4 20h9M18 14v7m-3-3h6'],
    ['star', 'Star', 'm12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z'],
    [
      'heart',
      'Heart',
      'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z',
    ],
    ['bookmark', 'Bookmark', 'M6 3h12v18l-6-4-6 4Z'],
    ['flag', 'Flag', 'M4 21V3m0 1c5-4 11 4 16 0v10c-5 4-11-4-16 0'],
    ['clock', 'Clock', 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM12 7v5l3 2'],
    ['history', 'History', 'M3 11a9 9 0 1 1 2 7M3 4v7h7M12 7v5l3 2'],
    ['pencil', 'Pencil', 'm16 3 5 5L8 21H3v-5Zm-3 3 5 5'],
    ['check', 'Check', 'm4 12 5 5L20 6'],
    ['cross', 'Cross', 'm6 6 12 12M18 6 6 18'],
    ['up', 'Arrow up', 'm6 10 6-6 6 6M12 4v16'],
    ['down', 'Arrow down', 'm6 14 6 6 6-6M12 4v16'],
    ['right', 'Arrow right', 'M4 12h16m-6-6 6 6-6 6'],
    [
      'shuffle',
      'Shuffle',
      'M3 6h3c5 0 7 12 12 12h3m-4-4 4 4-4 4M3 18h3c2 0 4-3 6-6s4-6 6-6h3m-4-4 4 4-4 4',
    ],
    [
      'repeat',
      'Repeat',
      'm17 2 4 4-4 4M3 11V8a2 2 0 0 1 2-2h16M7 22l-4-4 4-4M21 13v3a2 2 0 0 1-2 2H3',
    ],
    ['lightning', 'Lightning', 'm13 2-9 12h7l-1 8 10-12h-7Z'],
    [
      'sun',
      'Sun',
      'M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5',
    ],
    ['moon', 'Moon', 'M20.5 14A9 9 0 0 1 10 3a9 9 0 1 0 10.5 11Z'],
    ['cloud', 'Cloud', 'M6 19a5 5 0 0 1-1-10 7 7 0 0 1 13-1 5.5 5.5 0 0 1 0 11Z'],
    [
      'flame',
      'Flame',
      'M13 2c1 6 7 7 7 13a8 8 0 0 1-16 0c0-3 2-6 4-8 0 4 2 5 2 5s4-3 3-10ZM12 14c-4 4-3 7 0 7s4-3 0-7Z',
    ],
    ['leaf', 'Leaf', 'M21 3C9 2 2 8 5 16c8 6 17-1 16-13ZM3 21 16 8'],
    ['mountain', 'Mountain', 'm2 20 7-14 4 7 3-9 6 16Zm5-10 2 3 2-3m4-3 1 3 2-1'],
    [
      'headphones',
      'Headphones',
      'M3 17v-5a9 9 0 0 1 18 0v5M3 13h4v8H5a2 2 0 0 1-2-2Zm18 0h-4v8h2a2 2 0 0 0 2-2Z',
    ],
    ['music', 'Music notes', 'M9 18V5l11-2v13M9 8l11-2M9 18a3 3 0 1 1-3-3h3M20 16a3 3 0 1 1-3-3h3'],
    [
      'record',
      'Record',
      'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0ZM16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM12 12h.01M5 8l2-2m10 12 2-2',
    ],
    [
      'cassette',
      'Cassette',
      'M3 4h18v16H3ZM8 8a3 3 0 1 0 0 6h8a3 3 0 1 0 0-6Zm0 0a3 3 0 1 1 0 6m8-6a3 3 0 1 0 0 6M6 20l2-4h8l2 4',
    ],
    ['radio', 'Radio', 'M3 8h18v13H3ZM5 8l13-6M13 11h5m-5 4h5M10 15a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z'],
    ['film', 'Film strip', 'M3 3h18v18H3ZM7 3v18M17 3v18M3 8h4m-4 8h4M17 8h4m-4 8h4'],
    ['clapperboard', 'Clapperboard', 'm3 7 17-5 1 5-17 5Zm1 5h17v9H4ZM7 6l3 4m3-6 3 4M4 15h17'],
    ['coffee', 'Coffee', 'M3 4h14v10a6 6 0 0 1-12 0V4Zm14 1h2a3 3 0 0 1 0 6h-2M2 21h17'],
    ['briefcase', 'Briefcase', 'M3 7h18v14H3ZM8 7V3h8v4M3 12h18M10 12v3h4v-3'],
    ['car', 'Car', 'm3 10 3-7h12l3 7v9H3ZM3 10h18M6 14h2m8 0h2M5 19v3m14-3v3'],
  ];
  const paths = Object.fromEntries(entries.map(([id, , path]) => [id, path]));
  function validateIcon(value) {
    if (value !== '' && (typeof value !== 'string' || !Object.hasOwn(paths, value)))
      throw new Error('Choose a valid playlist icon.');
    return value;
  }
  function playlistIcon(playlist) {
    return Object.hasOwn(paths, playlist?.icon)
      ? playlist.icon
      : playlist?.dynamic?.enabled
        ? 'dynamic'
        : 'playlist';
  }
  const api = { entries, paths, validateIcon, playlistIcon };
  root.LocaltonePlaylistIcons = api;
  if (typeof module !== 'undefined') module.exports = api;
})(globalThis);
