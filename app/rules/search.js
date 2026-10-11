(function (root) {
  const searchFields = {
    artist: 'artist',
    artists: 'artist',
    album: 'album',
    albums: 'album',
    title: 'title',
    track: 'track',
    year: 'year',
    genre: 'genre',
    rating: 'rating',
    duration: 'duration',
    format: 'codec',
    codec: 'codec',
    albumartist: 'albumArtist',
    folder: 'folderArtist',
    disc: 'disc',
    discnumber: 'disc',
  };
  function missingTag(track, key, state = {}) {
    const raw = String(track.trackRaw ?? '').trim(),
      parts = raw.split('/');
    if (key === 'totaltracks')
      return parts.length !== 2 || !/^\d+$/.test(parts[1]) || Number(parts[1]) <= 0;
    if (key === 'leadingzeros') return parts.some((part) => /^[1-9]$/.test(part.trim()));
    const field = searchFields[key];
    if (field === 'disc')
      return (
        !/^\d+(?:\/\d+)?$/.test(String(track.discRaw ?? '').trim()) ||
        !(Number(String(track.discRaw).split('/')[0]) > 0)
      );
    if (field === 'rating') return !(state.ratings?.[track.id] > 0);
    if (field === 'track') return !/^\d+$/.test(parts[0]) || Number(parts[0]) <= 0;
    if (track.missingTags?.includes(field)) return true;
    const value = track[field];
    return (
      value == null ||
      String(value).trim() === '' ||
      (['year', 'duration'].includes(field) && !(Number(value) > 0)) ||
      (!track.missingTags &&
        ['artist', 'albumArtist', 'album'].includes(field) &&
        /^Unknown (artist|album)$/.test(value))
    );
  }
  const searchCache = new Map();
  function compileSearch(query = '') {
    if (searchCache.has(query)) return searchCache.get(query);
    let result;
    try {
      if (typeof query !== 'string' || query.length > 2000)
        throw Error('Use a search expression up to 2000 characters.');
      const tokens = [];
      let raw = '',
        quoted = false,
        escaped = false;
      const push = () => {
        if (raw) {
          tokens.push(raw);
          raw = '';
        }
      };
      for (const ch of query) {
        if (escaped) {
          raw += ch;
          escaped = false;
          continue;
        }
        if (ch === '\\' && quoted) {
          raw += ch;
          escaped = true;
          continue;
        }
        if (ch === '"') {
          quoted = !quoted;
          raw += ch;
          continue;
        }
        if (!quoted && (/\s/.test(ch) || ch === '(' || ch === ')')) {
          push();
          if (ch === '(' || ch === ')') tokens.push(ch);
        } else raw += ch;
      }
      if (quoted) throw new Error('Close the quoted phrase.');
      push();
      let at = 0;
      const term = (token) => {
        let field = null,
          value = token;
        const match = /^([a-zA-Z]+):(.*)$/.exec(token);
        const aliases = { ...searchFields, missing: 'missing', has: 'has' };
        if (match) {
          field = aliases[match[1].toLowerCase()];
          if (!field) throw new Error('Unknown search field: ' + match[1]);
          value = match[2] || tokens[at++];
          if (!value || ['AND', 'OR', 'NOT', 'EXCEPT', '(', ')'].includes(value))
            throw new Error('Enter a value after ' + match[1] + ':');
        }
        if (value.startsWith('"') && value.endsWith('"'))
          value = value.slice(1, -1).replace(/\\(["\\])/g, '$1');
        if (field === 'missing' || field === 'has') {
          const key = value.toLowerCase();
          if (!['leadingzeros', 'totaltracks'].includes(key) && !searchFields[key])
            throw Error('Unknown missing field: ' + value);
          return (t, state) =>
            field === 'has' ? !missingTag(t, key, state) : missingTag(t, key, state);
        }
        if (field && ['year', 'rating', 'duration', 'track', 'disc'].includes(field)) {
          const range = /^(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)$/.exec(value),
            cmp = /^(>=|<=|!=|>|<|=)?(\d+(?:\.\d+)?)$/.exec(value);
          if (!range && !cmp)
            throw new Error('Use a number, comparison or range for ' + field + '.');
          return (t, state) => {
            if (field === 'disc' && missingTag(t, 'disc', state)) return false;
            const n = field === 'rating' ? state.ratings?.[t.id] || 0 : Number(t[field]);
            if (!Number.isFinite(n)) return false;
            if (range) return n >= Number(range[1]) && n <= Number(range[2]);
            const v = Number(cmp[2]);
            return {
              '>=': () => n >= v,
              '<=': () => n <= v,
              '!=': () => n !== v,
              '>': () => n > v,
              '<': () => n < v,
              '=': () => n === v,
            }[cmp[1] || '=']();
          };
        }
        const needle = value.toLocaleLowerCase();
        return (t) =>
          (field
            ? String(t[field] || '')
            : [t.title, t.artist, t.folderArtist, t.album, t.year, t.genre, t.codec].join(' ')
          )
            .toLocaleLowerCase()
            .includes(needle);
      };
      const atom = () => {
        const token = tokens[at++];
        if (!token) throw new Error('Complete the search expression.');
        if (token === 'NOT' || token === 'EXCEPT') {
          const next = atom();
          return (t, s) => !next(t, s);
        }
        if (token === '(') {
          const next = or();
          if (tokens[at++] !== ')') throw new Error('Close the parentheses.');
          return next;
        }
        if (['AND', 'OR', ')'].includes(token)) throw new Error('Expected a search term.');
        if (token.startsWith('-') && token.length > 1) {
          const next = term(token.slice(1));
          return (t, s) => !next(t, s);
        }
        return term(token);
      };
      const and = () => {
        let left = atom();
        while (at < tokens.length && !['OR', ')'].includes(tokens[at])) {
          if (tokens[at] === 'AND') at++;
          const right = atom(),
            before = left;
          left = (t, s) => before(t, s) && right(t, s);
        }
        return left;
      };
      const or = () => {
        let left = and();
        while (tokens[at] === 'OR') {
          at++;
          const right = and(),
            before = left;
          left = (t, s) => before(t, s) || right(t, s);
        }
        return left;
      };
      const matches = tokens.length ? or() : () => true;
      if (at !== tokens.length) throw new Error('Unexpected closing parentheses.');
      result = { matches, error: null };
    } catch (error) {
      result = { matches: () => false, error: error.message };
    }
    searchCache.set(query, result);
    if (searchCache.size > 32) searchCache.delete(searchCache.keys().next().value);
    return result;
  }

  const api = { compileSearch, missingTag };
  root.LocaltoneSearch = api;
  if (typeof module !== 'undefined') module.exports = api;
})(globalThis);
