(function (root) {
  const numeric = { rating: 5, year: 9999, duration: 86400, disc: 9999, bitrate: 100000 };
  const dateFields = ['addedAt', 'modifiedAt'],
    emptyOps = ['isEmpty', 'isNotEmpty'];
  const fields = [
    'rating',
    'year',
    'disc',
    'duration',
    'bitrate',
    'title',
    'artist',
    'albumArtist',
    'album',
    'genre',
    'codec',
    ...dateFields,
  ];
  const textOps = ['contains', 'notContains', 'is', 'isNot', 'startsWith', ...emptyOps],
    numberOps = ['gte', 'gt', 'eq', 'neq', 'lt', 'lte', ...emptyOps];
  const dateOps = ['inLast', 'olderThan', 'onOrAfter', 'onOrBefore', 'between', ...emptyOps];
  function dateStart(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return NaN;
    const [y, m, d] = value.split('-').map(Number),
      date = new Date(y, m - 1, d);
    return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d
      ? date.getTime()
      : NaN;
  }
  function nextDay(value) {
    const date = new Date(dateStart(value));
    date.setDate(date.getDate() + 1);
    return date.getTime();
  }
  function validateDynamic(value) {
    if (
      !value ||
      typeof value !== 'object' ||
      typeof value.enabled !== 'boolean' ||
      typeof value.libraryId !== 'string' ||
      !['all', 'any'].includes(value.match) ||
      !Array.isArray(value.rules) ||
      value.rules.length > 20
    )
      throw new Error('Invalid dynamic playlist settings.');
    const mode = value.mode || 'rules';
    if (!['rules', 'search'].includes(mode)) throw Error('Choose Rules or Search expression.');
    const query = value.query ?? '';
    if (typeof query !== 'string' || query.length > 2000)
      throw Error('Use a search expression up to 2000 characters.');
    if (mode === 'search' && value.enabled) {
      const result = root.LocaltoneSearch.compileSearch(query);
      if (!query.trim() || result.error) throw Error(result.error || 'Enter a search expression.');
    }
    const rules = value.rules.map((rule) => {
      if (!rule || !fields.includes(rule.field))
        throw new Error('Choose a supported filter field.');
      const isNumber = Object.hasOwn(numeric, rule.field),
        isDate = dateFields.includes(rule.field);
      if (!(isDate ? dateOps : isNumber ? numberOps : textOps).includes(rule.op))
        throw new Error('Choose a supported filter comparison.');
      if (emptyOps.includes(rule.op)) return { field: rule.field, op: rule.op };
      let clean = rule.value;
      if (isDate) {
        if (['inLast', 'olderThan'].includes(rule.op)) {
          if (
            !clean ||
            !Number.isInteger(clean.amount) ||
            clean.amount < 1 ||
            clean.amount > 36500 ||
            !['days', 'weeks'].includes(clean.unit)
          )
            throw new Error('Enter a time frame from 1 to 36500 days or weeks.');
          clean = { amount: clean.amount, unit: clean.unit };
        } else if (rule.op === 'between') {
          if (
            !Array.isArray(clean) ||
            clean.length !== 2 ||
            !clean.every((v) => Number.isFinite(dateStart(v))) ||
            dateStart(clean[0]) > dateStart(clean[1])
          )
            throw new Error('Choose a valid start and end date.');
          clean = [...clean];
        } else if (!Number.isFinite(dateStart(clean))) throw new Error('Choose a valid date.');
      } else if (isNumber) {
        if (
          typeof clean !== 'number' ||
          !Number.isFinite(clean) ||
          clean < 0 ||
          clean > numeric[rule.field] ||
          (rule.field !== 'duration' && !Number.isInteger(clean))
        )
          throw new Error('Enter a valid filter number.');
      } else {
        if (typeof clean !== 'string' || !clean.trim() || clean.length > 300)
          throw new Error('Enter filter text (up to 300 characters).');
        clean = clean.trim();
      }
      return { field: rule.field, op: rule.op, value: clean };
    });
    return {
      enabled: value.enabled,
      libraryId: value.libraryId,
      match: value.match,
      rules,
      ...(value.mode || value.query ? { mode, query } : {}),
    };
  }
  const compiledRules = new Map();
  function compileRule(rule) {
    const { field, op } = rule,
      isNumber = Object.hasOwn(numeric, field),
      isDate = dateFields.includes(field);
    let test;
    if (emptyOps.includes(op))
      test = (raw, track) => {
        const empty =
          track.missingTags?.includes(field) ||
          raw == null ||
          String(raw).trim() === '' ||
          (isNumber && Number(raw) === 0) ||
          (!track.missingTags &&
            ['artist', 'albumArtist', 'album'].includes(field) &&
            /^Unknown (artist|album)$/.test(raw));
        return op === 'isEmpty' ? !!empty : !empty;
      };
    else if (isDate) {
      const relative = ['inLast', 'olderThan'].includes(op),
        offset = relative
          ? rule.value.amount * (rule.value.unit === 'weeks' ? 7 : 1) * 86400000
          : 0;
      const start =
        op === 'between'
          ? dateStart(rule.value[0])
          : op === 'onOrAfter'
            ? dateStart(rule.value)
            : 0;
      const end =
        op === 'between' ? nextDay(rule.value[1]) : op === 'onOrBefore' ? nextDay(rule.value) : 0;
      test = (raw, _track, now) => {
        const time = Number(raw);
        if (!Number.isFinite(time) || time <= 0) return false;
        if (op === 'inLast') return time >= now - offset && time <= now;
        if (op === 'olderThan') return time < now - offset;
        if (op === 'onOrAfter') return time >= start;
        if (op === 'onOrBefore') return time < end;
        return time >= start && time < end;
      };
    } else if (isNumber) {
      const b = rule.value;
      test = (raw) => {
        const a = Number(raw) || 0;
        switch (op) {
          case 'gte':
            return a >= b;
          case 'gt':
            return a > b;
          case 'eq':
            return a === b;
          case 'neq':
            return a !== b;
          case 'lt':
            return a < b;
          case 'lte':
            return a <= b;
          default:
            return false;
        }
      };
    } else {
      const b = String(rule.value).toLocaleLowerCase();
      test = (raw) => {
        const a = String(raw || '').toLocaleLowerCase();
        switch (op) {
          case 'contains':
            return a.includes(b);
          case 'notContains':
            return !a.includes(b);
          case 'is':
            return a === b;
          case 'isNot':
            return a !== b;
          case 'startsWith':
            return a.startsWith(b);
          default:
            return false;
        }
      };
    }
    return (track, ratings, now) =>
      test(
        field === 'rating'
          ? ratings?.[track.id] || 0
          : field === 'disc' && track.discRaw !== undefined
            ? Number.parseInt(track.discRaw, 10) || 0
            : track[field],
        track,
        now,
      );
  }
  function matcher(dynamic) {
    if (dynamic.mode === 'search') {
      const compiled = root.LocaltoneSearch.compileSearch(dynamic.query || '');
      return (track, state) => compiled.matches(track, state);
    }
    const signature = JSON.stringify(dynamic.rules);
    let tests = compiledRules.get(signature);
    if (!tests) {
      tests = dynamic.rules.map(compileRule);
      if (compiledRules.size >= 64) compiledRules.delete(compiledRules.keys().next().value);
      compiledRules.set(signature, tests);
    }
    return (track, state, now) =>
      !tests.length ||
      (dynamic.match === 'any'
        ? tests.some((test) => test(track, state.ratings, now))
        : tests.every((test) => test(track, state.ratings, now)));
  }
  function sourceLibraries(state, dynamic) {
    return new Set(
      (state.libraries || [])
        .filter(
          (library) =>
            !library.importedFiles && (!dynamic.libraryId || library.id === dynamic.libraryId),
        )
        .map((library) => library.id),
    );
  }
  function matchesTrack(state, dynamic, track, now = Date.now()) {
    return (
      !track.missing &&
      !track.excluded &&
      sourceLibraries(state, dynamic).has(track.libraryId) &&
      matcher(dynamic)(track, state, now)
    );
  }
  function matchingTracks(state, dynamic, now = Date.now()) {
    const test = matcher(dynamic),
      libraries = sourceLibraries(state, dynamic);
    return state.tracks.filter(
      (track) =>
        !track.missing &&
        !track.excluded &&
        libraries.has(track.libraryId) &&
        test(track, state, now),
    );
  }

  const api = {
    validateDynamic,
    matchingTracks,
    matchesTrack,
    fields,
    textOps,
    numberOps,
    numeric,
    dateFields,
    dateOps,
    emptyOps,
  };
  root.LocaltoneRules = api;
  if (typeof module !== 'undefined') module.exports = api;
})(globalThis);
