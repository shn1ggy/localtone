import { matchReleaseTrack, proposedTrackNumber } from './album-number-lookup.js';

// One review per editor session; responses are accepted only for the current album/job.
export function createMusicBrainzReview({
  document,
  api,
  el,
  albumKey,
  getEntries,
  onChanged,
  getLeadingZeros = () => false,
  saveLeadingZeros = () => {},
}) {
  const $ = (id) => document.getElementById(id),
    dialog = $('tag-dialog');
  let groups = [],
    models = new Map(),
    selected = 0,
    job = 0,
    disposed = false,
    expanded = false,
    pending = false,
    entriesById = new Map();
  const option = (label, value) => {
    const node = el('option', label);
    node.value = value;
    return node;
  };
  const model = () => models.get(selected);
  const groupEntries = () =>
    groups[selected]?.map((t) => entriesById.get(t.id)).filter(Boolean) || [];
  const valid = (revision) => !disposed && revision === job && dialog.open;
  function status(text) {
    $('tag-mb-status').textContent = text;
  }
  function loading(active, text) {
    pending = active;
    $('tag-mb-loading').hidden = !active;
    $('tag-mb-controls').setAttribute('aria-busy', String(active));
    $('tag-mb-release').disabled = active || !model()?.releases?.length;
    $('tag-mb-search').disabled = active;
    $('tag-mb-search').textContent = 'Find release…';
    if (text) status(text);
  }
  function value(entry, key, state) {
    const match = state.matches.get(entry.id)?.track,
      release = state.release;
    if (!release) return '';
    switch (key) {
      case 'title':
        return match?.title || '';
      case 'artist':
        return match?.artist || '';
      case 'albumArtist':
        return release.artist || '';
      case 'album':
        return release.title || '';
      case 'year':
        return release.year || '';
      case 'genre':
        return release.genre || '';
      case 'disc':
        return match ? `${match.disc}${release.discTotal > 1 ? '/' + release.discTotal : ''}` : '';
      default:
        return '';
    }
  }
  function paintFields() {
    const state = model();
    for (const row of $('tag-fields').children) {
      row.querySelectorAll('.mb-proposal,.mb-use').forEach((n) => n.remove());
      const key = row.querySelector('input[name]')?.name;
      if (!key) continue;
      const cell = el('div', null, 'mb-proposal'),
        input = el('input'),
        use = el('input');
      use.type = 'checkbox';
      use.className = 'preference-switch mb-use';
      use.setAttribute('role', 'switch');
      use.setAttribute('aria-label', 'Use MusicBrainz ' + row.querySelector('label').textContent);
      input.className = 'mb-proposal-value';
      input.maxLength = 1000;
      input.setAttribute(
        'aria-label',
        'MusicBrainz proposal for ' + row.querySelector('label').textContent,
      );
      const entries = groupEntries(),
        values = [
          ...new Set(entries.map((e) => (state ? value(e, key, state) : '')).filter(Boolean)),
        ],
        override = state?.overrides.get(key);
      input.value = override !== undefined ? override : values.length === 1 ? values[0] : '';
      input.placeholder =
        key === 'track'
          ? 'Use track matches below'
          : values.length > 1
            ? '⟨matched values⟩'
            : 'Not provided';
      input.disabled = key === 'track' || (!values.length && !state?.overrides.has(key));
      use.disabled = input.disabled;
      use.checked = !!state?.use.has(key);
      input.oninput = () => {
        state.overrides.set(key, input.value);
        state.use.add(key);
        use.checked = true;
        onChanged();
      };
      use.onchange = () => {
        if (use.checked) state.use.add(key);
        else state.use.delete(key);
        onChanged();
      };
      cell.append(input);
      row.append(cell, use);
    }
  }
  function paintTracks() {
    const body = $('tag-mb-tracks');
    body.replaceChildren();
    const state = model();
    if (!state?.release) {
      $('tag-mb-numbers').hidden = true;
      return;
    }
    $('tag-mb-numbers').hidden = !expanded;
    const entries = groupEntries();
    for (const entry of entries) {
      const local = { title: entry.values.title || entry.name || 'Untitled' },
        match = state.matches.get(entry.id),
        row = el('tr'),
        name = el('td', entry.values.title || local.title),
        before = el('td', entry.values.track || '—'),
        after = el('td'),
        cell = el('td'),
        select = el('select'),
        use = el('input');
      select.setAttribute('aria-label', 'Release track for ' + local.title);
      select.append(option('Choose track…', ''));
      for (const track of state.release.tracks)
        select.append(
          option(
            `${state.release.discTotal > 1 ? 'Disc ' + track.disc + ' · ' : ''}${proposedTrackNumber('', track, $('tag-mb-zeros').checked)} · ${track.title}`,
            track.key,
          ),
        );
      select.value = match?.track?.key || '';
      use.type = 'checkbox';
      use.className = 'preference-switch';
      use.setAttribute('role', 'switch');
      use.setAttribute('aria-label', 'Update track number for ' + local.title);
      use.disabled = !match?.track;
      use.checked = !!match?.use;
      select.onchange = () => {
        const track = state.release.tracks.find((t) => t.key === select.value) || null;
        state.matches.set(entry.id, { track, use: !!track });
        use.disabled = !track;
        use.checked = !!track;
        paintFields();
        onChanged();
      };
      use.onchange = () => {
        state.matches.get(entry.id).use = use.checked;
        onChanged();
      };
      after.append(select);
      cell.append(use);
      row.append(name, before, after, cell);
      body.append(row);
    }
  }
  function paint() {
    paintFields();
    paintTracks();
    const state = model(),
      select = $('tag-mb-release');
    select.replaceChildren(option('Choose release…', ''));
    for (const release of state?.releases || [])
      select.append(
        option(
          [
            release.title,
            release.edition,
            release.date,
            release.country,
            release.formats,
            release.tracks ? release.tracks + ' tracks' : '',
          ]
            .filter(Boolean)
            .join(' · '),
          release.id,
        ),
      );
    select.value = state?.releaseId || '';
    loading(false);
  }
  async function search() {
    const revision = ++job;
    const state = model();
    state.release = null;
    state.releaseId = '';
    state.releases = [];
    state.use.clear();
    state.overrides.clear();
    state.matches.clear();
    paintFields();
    paintTracks();
    $('tag-mb-release').replaceChildren(option('Searching releases…', ''));
    loading(true, 'Searching MusicBrainz…');
    onChanged();
    const first = groups[selected]?.[0],
      entry = entriesById.get(first?.id),
      local = (key) => {
        const input = $('tag-value-' + key);
        return input?.dataset.changed === 'true'
          ? input.value
          : entry?.values[key] || first?.[key] || '';
      };
    try {
      const releases = await api.musicbrainzSearch({
        album: local('album'),
        artist: local('albumArtist') || local('artist'),
      });
      if (!valid(revision)) return;
      state.releases = releases;
      paint();
      status(
        releases.length
          ? 'Choose your release, then review the proposed changes.'
          : 'No releases found. Check the album and artist tags, then retry.',
      );
    } catch (error) {
      if (!valid(revision)) return;
      loading(false, error.message);
      $('tag-mb-release').replaceChildren(option('Lookup failed — retry', ''));
      $('tag-mb-search').textContent = 'Retry';
    }
  }
  async function chooseRelease() {
    const id = $('tag-mb-release').value,
      revision = ++job,
      state = model();
    state.release = null;
    state.releaseId = id;
    state.use.clear();
    state.overrides.clear();
    state.matches.clear();
    paintFields();
    paintTracks();
    onChanged();
    if (!id) {
      loading(false);
      status('Choose a release.');
      return;
    }
    loading(true, 'Loading release metadata and tracks…');
    try {
      const release = await api.musicbrainzRelease(id);
      if (!valid(revision)) return;
      state.release = release;
      for (const track of groups[selected]) {
        const entry = entriesById.get(track.id),
          match = matchReleaseTrack(
            { ...track, title: entry?.values.title || track.title },
            release.tracks,
          );
        state.matches.set(track.id, { track: match, use: !!match });
      }
      paint();
      const matched = [...state.matches.values()].filter((m) => m.track).length;
      status(
        `${matched} of ${groups[selected].length} tracks matched · Enable the fields you want to use. Totals are per disc.`,
      );
    } catch (error) {
      if (!valid(revision)) return;
      loading(false, error.message);
      $('tag-mb-search').textContent = 'Retry';
    }
  }
  function toggle() {
    if (!getEntries().length) return;
    expanded = !expanded;
    dialog.classList.toggle('tag-comparison', expanded);
    $('tag-mb-controls').hidden = $('tag-field-headings').hidden = !expanded;
    $('tag-mb-toggle').setAttribute('aria-expanded', String(expanded));
    $('tag-mb-toggle').textContent = expanded ? 'Hide comparison' : 'Compare with MusicBrainz…';
    $('tag-mb-numbers').hidden = !expanded || !model()?.release;
    if (expanded && !model()?.releases) search();
    else if (expanded && !pending) paint();
  }
  function reset(tracks) {
    job++;
    entriesById = new Map(getEntries().map((e) => [e.id, e]));
    status('');
    expanded = false;
    groups = [];
    models = new Map();
    const grouped = new Map();
    for (const track of tracks) {
      const key = albumKey ? albumKey(track) : track.album || '';
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(track);
    }
    groups = [...grouped.values()];
    groups.forEach((_, i) =>
      models.set(i, {
        releases: null,
        release: null,
        releaseId: '',
        matches: new Map(),
        use: new Set(),
        overrides: new Map(),
      }),
    );
    selected = 0;
    dialog.classList.remove('tag-comparison');
    $('tag-mb-controls').hidden =
      $('tag-field-headings').hidden =
      $('tag-mb-numbers').hidden =
        true;
    $('tag-mb-toggle').disabled = !getEntries().length;
    $('tag-mb-toggle').textContent = 'Compare with MusicBrainz…';
    $('tag-mb-toggle').setAttribute('aria-expanded', 'false');
    $('tag-mb-album-row').hidden = groups.length < 2;
    $('tag-mb-album').replaceChildren(
      ...groups.map((g, i) =>
        option(
          [g[0].album, g[0].albumArtist || g[0].artist].filter(Boolean).join(' · '),
          String(i),
        ),
      ),
    );
    $('tag-mb-zeros').checked = !!getLeadingZeros();
    loading(false);
  }
  function patches() {
    const changes = new Map();
    for (const [index, state] of models) {
      if (!state.release) continue;
      for (const track of groups[index]) {
        const entry = entriesById.get(track.id),
          patch = {};
        for (const key of state.use) {
          const proposal = state.overrides.has(key)
            ? state.overrides.get(key)
            : value(entry, key, state);
          if (proposal !== '' || state.overrides.has(key))
            if (proposal !== entry.values[key]) patch[key] = proposal;
        }
        const match = state.matches.get(track.id);
        if (match?.track && match.use) {
          const proposal = proposedTrackNumber(
            entry.values.track,
            match.track,
            $('tag-mb-zeros').checked,
          );
          if (proposal !== entry.values.track) patch.track = proposal;
        }
        if (Object.keys(patch).length) changes.set(track.id, patch);
      }
    }
    return changes;
  }
  $('tag-mb-toggle').onclick = toggle;
  $('tag-mb-search').onclick = () => {
    if (model()?.releaseId && !model().release) chooseRelease();
    else search();
  };
  $('tag-mb-release').onchange = chooseRelease;
  $('tag-mb-album').onchange = () => {
    job++;
    selected = Number($('tag-mb-album').value);
    if (!model().releases) search();
    else {
      paint();
      status('Review the proposed changes for this album.');
    }
  };
  $('tag-mb-zeros').onchange = () => {
    saveLeadingZeros($('tag-mb-zeros').checked);
    paintTracks();
    onChanged();
  };
  const closed = () => {
    job++;
    loading(false);
  };
  dialog.addEventListener('close', closed);
  return {
    reset,
    patches,
    pause() {
      job++;
      loading(false);
    },
    refresh() {
      if (model()) paint();
    },
    dispose() {
      disposed = true;
      job++;
      dialog.removeEventListener('close', closed);
      for (const id of ['tag-mb-toggle', 'tag-mb-search']) $(id).onclick = null;
      for (const id of ['tag-mb-release', 'tag-mb-album', 'tag-mb-zeros']) $(id).onchange = null;
    },
  };
}
