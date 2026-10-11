import {
  validateDynamic,
  matchingTracks,
  filterFields,
  textOps,
  numberOps,
  filterNumeric,
  dateFields,
  dateOps,
  emptyOps,
} from './core.js';
export function createPlaylistEditor({
  document,
  api,
  el,
  icon,
  dialogs,
  getState,
  isBusy,
  operation,
  setScope,
  onConfigured,
}) {
  const $ = (id) => document.getElementById(id);
  function fitRuleSelect(select) {
    const probe = el('span');
    probe.style.cssText = 'position:absolute;visibility:hidden;white-space:pre;font-size:13px;';
    document.body.append(probe);
    let width = 0;
    for (const option of select.options) {
      probe.textContent = option.textContent;
      width = Math.max(
        width,
        probe.getBoundingClientRect().width || option.textContent.length * 6.5,
      );
    }
    probe.remove();
    select.style.width = `${Math.ceil(width + 30)}px`;
  }

  let editingPlaylistId = null,
    playlistSeedIds = null;
  const filterLabels = {
    rating: 'Rating',
    year: 'Year',
    duration: 'Duration (seconds)',
    title: 'Title',
    artist: 'Artist',
    albumArtist: 'Album artist',
    album: 'Album',
    genre: 'Genre',
    codec: 'Format',
    addedAt: 'Date added',
    modifiedAt: 'Date modified',
  };
  const opLabels = {
    contains: 'contains',
    notContains: 'does not contain',
    is: 'is',
    isNot: 'is not',
    startsWith: 'starts with',
    gte: 'at least',
    gt: 'greater than',
    eq: 'equals',
    neq: 'not equal',
    lt: 'less than',
    lte: 'at most',
    isEmpty: 'is empty',
    isNotEmpty: 'is not empty',
    inLast: 'in the last',
    olderThan: 'older than',
    onOrAfter: 'on or after',
    onOrBefore: 'on or before',
    between: 'between',
  };
  function addPlaylistRule(rule = { field: 'rating', op: 'gte', value: 4 }) {
    const row = el('div', null, 'playlist-rule'),
      field = el('select'),
      op = el('select'),
      values = el('div', null, 'rule-values'),
      remove = el('button');
    remove.append(icon('close'));
    remove.type = 'button';
    remove.setAttribute('aria-label', 'Remove rule');
    field.setAttribute('aria-label', 'Filter field');
    op.setAttribute('aria-label', 'Comparison');
    for (const key of filterFields) {
      const option = el('option', filterLabels[key]);
      option.value = key;
      field.append(option);
    }
    field.value = rule.field;
    function inputs(value) {
      values.replaceChildren();
      const empty = emptyOps.includes(op.value);
      values.hidden = empty;
      if (empty) return;
      const input = (type, label, initial) => {
        const node = el('input');
        node.type = type;
        node.setAttribute('aria-label', label);
        node.value = initial ?? '';
        node.oninput = updatePlaylistPreview;
        values.append(node);
        return node;
      };
      if (dateFields.includes(field.value)) {
        if (['inLast', 'olderThan'].includes(op.value)) {
          const amount = input('number', 'Time frame', value?.amount ?? 2);
          amount.min = '1';
          amount.max = '36500';
          amount.step = '1';
          const unit = el('select');
          unit.setAttribute('aria-label', 'Time unit');
          for (const key of ['days', 'weeks']) {
            const option = el('option', key);
            option.value = key;
            unit.append(option);
          }
          unit.value = value?.unit || 'weeks';
          unit.onchange = updatePlaylistPreview;
          values.append(unit);
        } else if (op.value === 'between') {
          input('date', 'From date', Array.isArray(value) ? value[0] : '');
          input('date', 'Through date', Array.isArray(value) ? value[1] : '');
        } else input('date', 'Date', typeof value === 'string' ? value : '');
      } else {
        const numeric = Object.hasOwn(filterNumeric, field.value),
          node = input(numeric ? 'number' : 'text', 'Filter value', value);
        if (numeric) {
          node.min = '0';
          node.max = String(filterNumeric[field.value]);
          node.step = field.value === 'duration' ? 'any' : '1';
        }
        node.maxLength = 300;
      }
    }
    function setup(selected, value) {
      op.replaceChildren();
      for (const key of dateFields.includes(field.value)
        ? dateOps
        : Object.hasOwn(filterNumeric, field.value)
          ? numberOps
          : textOps) {
        const option = el('option', opLabels[key]);
        option.value = key;
        op.append(option);
      }
      if (selected) op.value = selected;
      inputs(value);
      fitRuleSelect(op);
    }
    setup(rule.op, rule.value);
    field.onchange = () => {
      setup(null, Object.hasOwn(filterNumeric, field.value) ? 0 : '');
      updatePlaylistPreview();
    };
    op.onchange = () => {
      inputs();
      updatePlaylistPreview();
    };
    row.readRule = () => {
      const result = { field: field.value, op: op.value };
      if (emptyOps.includes(op.value)) return result;
      const [first, second] = values.children;
      result.value = dateFields.includes(field.value)
        ? ['inLast', 'olderThan'].includes(op.value)
          ? { amount: Number(first.value), unit: second.value }
          : op.value === 'between'
            ? [first.value, second.value]
            : first.value
        : Object.hasOwn(filterNumeric, field.value)
          ? first.value === ''
            ? NaN
            : Number(first.value)
          : first.value;
      return result;
    };
    remove.onclick = () => {
      row.remove();
      updatePlaylistPreview();
    };
    row.append(field, op, values, remove);
    $('playlist-rules').append(row);
    fitRuleSelect(field);
    fitRuleSelect(op);
    updatePlaylistPreview();
  }
  function readPlaylistDynamic() {
    return {
      enabled: $('playlist-dynamic').checked,
      libraryId: $('playlist-library').value,
      match: $('playlist-match').value,
      mode: $('playlist-filter-mode').value,
      query: $('playlist-search').value,
      rules: [...$('playlist-rules').children].map((row) => row.readRule()),
    };
  }
  function updatePlaylistPreview() {
    const enabled = $('playlist-dynamic').checked;
    $('playlist-filters').hidden = !enabled;
    for (const input of $('playlist-filters').querySelectorAll('input,select,button'))
      input.disabled = !enabled;
    $('playlist-add-rule').disabled = !enabled || $('playlist-rules').children.length >= 20;
    const search = $('playlist-filter-mode').value === 'search';
    $('playlist-search-row').hidden = !search;
    $('playlist-match-row').hidden = search;
    $('playlist-rule-heading').hidden = $('playlist-rules').hidden = search;
    if (!enabled) {
      const playlist = getState().playlists.find((p) => p.id === editingPlaylistId);
      $('playlist-preview').textContent = playlistSeedIds
        ? `${playlistSeedIds.length} selected tracks.`
        : playlist?.dynamic?.enabled
          ? 'Current matches will become a manual playlist.'
          : 'Add and reorder tracks manually.';
      return;
    }
    try {
      const dynamic = validateDynamic(readPlaylistDynamic());
      $('playlist-preview').textContent =
        `${matchingTracks(getState(), dynamic).length} matching tracks${dynamic.mode === 'search' || dynamic.rules.length ? '' : ' · No rules: includes all tracks in the source'}`;
    } catch (error) {
      $('playlist-preview').textContent =
        error.message || 'Complete the filter values to preview matches.';
    }
  }
  function openPlaylistSettings(playlist, seedIds = null) {
    playlistSeedIds = seedIds;
    $('playlist-dynamic').disabled = !!seedIds;
    editingPlaylistId = playlist?.id || null;
    $('playlist-settings-title').textContent = playlist ? 'Playlist settings' : 'New playlist';
    $('playlist-name').value = playlist?.name || '';
    $('playlist-settings-error').hidden = true;
    $('playlist-settings-form').querySelector('[type=submit]').textContent = playlist
      ? 'Save'
      : 'Create';
    const dynamic = playlist?.dynamic || {
      enabled: false,
      libraryId: '',
      match: 'all',
      rules: [{ field: 'rating', op: 'gte', value: 4 }],
    };
    $('playlist-filter-mode').value = dynamic.mode || 'rules';
    $('playlist-search').value = dynamic.query || '';
    $('playlist-dynamic').checked = dynamic.enabled;
    $('playlist-match').value = dynamic.match;
    const select = $('playlist-library');
    select.replaceChildren();
    const all = el('option', 'All libraries');
    all.value = '';
    select.append(all);
    for (const library of getState().libraries.filter((l) => !l.importedFiles)) {
      const option = el('option', library.name);
      option.value = library.id;
      select.append(option);
    }
    if (dynamic.libraryId && !getState().libraries.some((l) => l.id === dynamic.libraryId)) {
      const option = el('option', 'Removed library');
      option.value = dynamic.libraryId;
      select.append(option);
    }
    select.value = dynamic.libraryId;
    $('playlist-rules').replaceChildren();
    dynamic.rules.forEach((rule) => addPlaylistRule(rule));
    updatePlaylistPreview();
    dialogs.open($('playlist-settings-dialog'));
    $('playlist-name').focus();
  }
  $('playlist-search').oninput = updatePlaylistPreview;
  $('playlist-filter-mode').onchange =
    $('playlist-dynamic').onchange =
    $('playlist-library').onchange =
    $('playlist-match').onchange =
      updatePlaylistPreview;
  $('playlist-add-rule').onclick = () => {
    if ($('playlist-rules').children.length < 20) addPlaylistRule();
  };
  $('playlist-settings-close').onclick = $('playlist-settings-cancel').onclick = () =>
    $('playlist-settings-dialog').close();
  $('playlist-settings-form').onsubmit = async (event) => {
    event.preventDefault();
    if (isBusy()) return;
    try {
      const name = $('playlist-name').value.trim();
      if (!name || name.length > 100) throw new Error('Use a name between 1 and 100 characters.');
      let raw = readPlaylistDynamic();
      if (!raw.enabled) {
        try {
          validateDynamic(raw);
        } catch {
          raw = {
            ...raw,
            rules:
              getState().playlists.find((p) => p.id === editingPlaylistId)?.dynamic?.rules || [],
          };
        }
      }
      const dynamic = validateDynamic(raw),
        creating = !editingPlaylistId,
        before = new Set(getState().playlists.map((p) => p.id));
      const result = await operation(
        () =>
          api.playlist({
            type: creating ? 'create' : 'configure',
            ...(creating ? {} : { id: editingPlaylistId }),
            name,
            dynamic,
            ...(creating && playlistSeedIds ? { trackIds: playlistSeedIds } : {}),
          }),
        null,
      );
      if (result) {
        if (creating) {
          const added = getState().playlists.find((p) => !before.has(p.id));
          if (added) setScope({ kind: 'playlist', id: added.id });
        } else onConfigured(editingPlaylistId, dynamic);
        $('playlist-settings-dialog').close();
      }
    } catch (error) {
      $('playlist-settings-error').textContent = error.message;
      $('playlist-settings-error').hidden = false;
    }
  };

  return {
    open: openPlaylistSettings,
    dispose() {
      for (const id of [
        'playlist-filter-mode',
        'playlist-dynamic',
        'playlist-library',
        'playlist-match',
      ])
        $(id).onchange = null;
      for (const id of ['playlist-add-rule', 'playlist-settings-close', 'playlist-settings-cancel'])
        $(id).onclick = null;
      $('playlist-settings-form').onsubmit = null;
    },
  };
}
