export function createDuplicatesDialog({ document, api, dialogs, applyState, releaseTrack }) {
  const $ = (id) => document.getElementById(id);
  let review = null,
    revision = 0,
    busy = false;
  const chosen = () =>
    [...$('duplicates-list').querySelectorAll('input:checked')].map((n) => n.dataset.id);
  function selectionChanged() {
    const ids = new Set(chosen());
    for (const group of review?.groups || []) {
      const all = group.items.every((i) => ids.has(i.id));
      if (all) {
        const keep = [...$('duplicates-list').querySelectorAll('input')].find(
          (n) => n.dataset.id === group.items[0].id,
        );
        keep.checked = false;
        $('duplicates-status').textContent = 'At least one file must stay in each group.';
      }
    }
    $('duplicates-remove').disabled = !chosen().length || busy;
  }
  function invalidate() {
    revision++;
    review = null;
    $('duplicates-list').replaceChildren();
    $('duplicates-remove').disabled = true;
    $('duplicates-status').textContent = 'Scan your collections to review duplicate files.';
  }
  async function scan() {
    const generation = ++revision;
    busy = true;
    $('duplicates-scan').disabled = $('duplicates-mode').disabled = true;
    $('duplicates-remove').disabled = true;
    $('duplicates-list').replaceChildren();
    $('duplicates-status').textContent = 'Checking files… Larger collections may take a moment.';
    try {
      const result = await api.findDuplicates($('duplicates-mode').value);
      if (generation !== revision || !$('duplicates-dialog').open) return;
      review = result;
      for (const group of result.groups) {
        const section = document.createElement('section');
        section.className = 'duplicate-group';
        const heading = document.createElement('h3');
        heading.textContent = group.items[0].artist + ' — ' + group.items[0].title;
        section.append(heading);
        for (const item of group.items) {
          const row = document.createElement('div'),
            label = document.createElement('label'),
            toggle = document.createElement('input');
          row.className = 'duplicate-row';
          label.textContent = item.path;
          label.title = item.path;
          toggle.type = 'checkbox';
          toggle.className = 'preference-switch';
          toggle.setAttribute('role', 'switch');
          toggle.setAttribute('aria-label', 'Move to Trash: ' + item.path);
          toggle.id = 'duplicate-file-' + item.id;
          label.htmlFor = toggle.id;
          toggle.dataset.id = item.id;
          toggle.onchange = selectionChanged;
          row.append(label, toggle);
          section.append(row);
        }
        $('duplicates-list').append(section);
      }
      $('duplicates-status').textContent =
        `${result.groups.length} ${result.mode === 'exact' ? 'byte-identical' : 'possible duplicate'} groups found.` +
        (result.skipped ? ` ${result.skipped} unavailable or changing files skipped.` : '');
    } catch (error) {
      if (generation === revision) $('duplicates-status').textContent = error.message;
    } finally {
      busy = false;
      $('duplicates-scan').disabled = $('duplicates-mode').disabled = false;
    }
  }
  $('duplicates-mode').onchange = invalidate;
  $('duplicates-scan').onclick = scan;
  $('duplicates-close').onclick = () => {
    if (!busy) $('duplicates-dialog').close();
  };
  $('duplicates-dialog').addEventListener('cancel', (event) => {
    if (busy) event.preventDefault();
  });
  $('duplicates-dialog').addEventListener('close', () => revision++);
  $('duplicates-remove').onclick = async () => {
    if (busy || !review) return;
    const ids = chosen();
    if (!ids.length) return;
    busy = true;
    $('duplicates-dialog')
      .querySelectorAll('button,input,select')
      .forEach((n) => (n.disabled = true));
    try {
      const result = await releaseTrack(ids, () => api.removeDuplicates(review.token, ids));
      if (result.cancelled) return;
      applyState(result.state);
      invalidate();
      $('duplicates-status').textContent =
        `${result.removed.length} files moved to Trash.` +
        (result.failures.length
          ? ' ' +
            result.failures.map((f) => f.message).join(' · ') +
            ' Scan again to review remaining files.'
          : '');
    } catch (error) {
      $('duplicates-status').textContent = error.message;
    } finally {
      busy = false;
      $('duplicates-dialog')
        .querySelectorAll('button,input,select')
        .forEach((n) => (n.disabled = false));
      selectionChanged();
    }
  };
  return {
    get saving() {
      return busy;
    },
    open() {
      invalidate();
      dialogs.open($('duplicates-dialog'));
    },
  };
}
