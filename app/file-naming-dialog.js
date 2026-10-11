export function createFileNamingDialog({
  document,
  api,
  dialogs,
  getSettings,
  saveSettings,
  releaseTrack,
  applyState,
  remember,
}) {
  const $ = (id) => document.getElementById(id);
  let ids = [],
    preview = null,
    revision = 0,
    saving = false,
    disposed = false,
    preferenceSave = Promise.resolve();
  const characterInputs = new Map();
  for (const character of [...'<>:"/\\|?*']) {
    const row = document.createElement('div');
    row.className = 'setting-row';
    const label = document.createElement('label'),
      input = document.createElement('input');
    input.id = 'rename-character-' + character.charCodeAt(0);
    input.className = 'formula-input';
    input.maxLength = 20;
    input.placeholder = 'Remove';
    label.htmlFor = input.id;
    label.textContent = character;
    input.oninput = changed;
    row.append(label, input);
    $('rename-character-rows').append(row);
    characterInputs.set(character, input);
  }
  const replacements = () =>
    Object.fromEntries([...characterInputs].map(([key, input]) => [key, input.value]));
  const config = () => ({
    replacements: replacements(),
    files: $('rename-files').checked,
    folders: $('rename-folders').checked,
    trackFormula: $('rename-track-formula').value,
    albumFormula: $('rename-album-formula').value,
  });
  function invalidate() {
    revision++;
    preview = null;
    $('rename-preview').disabled = false;
    $('rename-apply').disabled = true;
    $('rename-status').textContent = 'Preview the names before applying.';
    $('rename-items').replaceChildren();
    $('rename-problems').hidden = true;
    $('rename-problems-list').replaceChildren();
  }
  function changed() {
    invalidate();
    preferenceSave = Promise.resolve(
      saveSettings({
        renameAlbumFormula: $('rename-album-formula').value,
        renameTrackFormula: $('rename-track-formula').value,
        renameReplacements: replacements(),
      }),
    ).catch((error) => {
      if (!disposed && $('rename-dialog').open) $('rename-status').textContent = error.message;
    });
  }
  async function showPreview() {
    if (disposed) return;
    const generation = ++revision;
    preview = null;
    $('rename-apply').disabled = true;
    $('rename-preview').disabled = true;
    $('rename-status').textContent = 'Checking names…';
    try {
      await preferenceSave;
      if (generation !== revision || !$('rename-dialog').open) return;
      const result = await api.previewFileNames(ids, config());
      if (generation !== revision || !$('rename-dialog').open) return;
      preview = result;
      $('rename-items').replaceChildren();
      for (const [index, item] of result.items.entries()) {
        item.id ??= String(index);
        item.enabled = true;
        const row = document.createElement('tr');
        for (const [value, title] of [
          [item.kind === 'folder' ? 'Album folder' : 'Track file', ''],
          [item.from.split(/[\\/]/).at(-1), item.from],
          [item.to.split(/[\\/]/).at(-1), item.to],
        ]) {
          const cell = document.createElement('td');
          cell.textContent = value;
          cell.title = title;
          row.append(cell);
        }
        const cell = document.createElement('td'),
          toggle = document.createElement('input');
        cell.className = 'rename-use';
        toggle.type = 'checkbox';
        toggle.className = 'preference-switch';
        toggle.setAttribute('role', 'switch');
        toggle.setAttribute('aria-label', 'Rename ' + item.from.split(/[\\/]/).at(-1));
        toggle.checked = true;
        toggle.onchange = () => {
          item.enabled = toggle.checked;
          updateSelection();
        };
        cell.append(toggle);
        row.append(cell);
        item.targetCell = row.children[2];
        $('rename-items').append(row);
      }
      const issues = result.issues || [],
        problemList = $('rename-problems-list');
      problemList.replaceChildren();
      $('rename-problems').hidden = !issues.length;
      $('rename-problems').open = false;
      $('rename-problems-heading').textContent = `${issues.length} problems skipped`;
      for (const issue of issues) {
        const row = document.createElement('p');
        row.className = 'settings-note';
        row.textContent = issue.from + ' — ' + issue.message;
        row.title = issue.to || '';
        problemList.append(row);
      }
      updateSelection();
    } catch (error) {
      if (generation === revision)
        $('rename-status').textContent = error.message.replace(
          /^Error invoking remote method '[^']+': Error: /,
          '',
        );
    } finally {
      if (generation === revision) $('rename-preview').disabled = false;
    }
  }
  function updateSelection() {
    if (!preview) return;
    const selected = preview.items.filter((item) => item.enabled);
    for (const item of preview.items) {
      if (!item.rawTo || item.kind !== 'file') continue;
      const folder = selected.find(
        (f) =>
          f.kind === 'folder' &&
          item.rawTo.startsWith(f.from + (f.from.includes('\\') ? '\\' : '/')),
      );
      const destination = folder ? folder.to + item.rawTo.slice(folder.from.length) : item.rawTo;
      item.targetCell.textContent = destination.split(/[\\/]/).at(-1);
      item.targetCell.title = destination;
    }
    $('rename-status').textContent =
      [
        selected.length ? `${selected.length} names will change` : 'No names selected',
        preview.issues?.length ? `${preview.issues.length} problems skipped` : '',
        preview.unchanged ? `${preview.unchanged} already match` : '',
      ]
        .filter(Boolean)
        .join(' · ') + '.';
    $('rename-apply').disabled = !selected.length;
  }
  for (const id of ['rename-files', 'rename-folders']) $(id).onchange = invalidate;
  for (const id of ['rename-track-formula', 'rename-album-formula']) $(id).oninput = changed;
  $('rename-preview').onclick = showPreview;
  $('rename-close').onclick = $('rename-cancel').onclick = () => {
    if (!saving) $('rename-dialog').close();
  };
  $('rename-apply').onclick = async () => {
    if (saving || !preview) return;
    saving = true;
    const target = preview;
    $('rename-dialog')
      .querySelectorAll('input,button')
      .forEach((n) => (n.disabled = true));
    try {
      const result = await releaseTrack(
        [
          ...new Set(
            target.items
              .filter((item) => item.enabled)
              .flatMap((item) => item.affected || target.affected),
          ),
        ],
        () =>
          api.applyFileNames(
            target.token,
            target.items.filter((item) => item.enabled).map((item) => item.id),
          ),
      );
      applyState(result.state);
      remember({ type: 'files', token: result.undoToken, ids: result.affected });
      $('rename-dialog').close();
    } catch (error) {
      $('rename-status').textContent = error.message;
      preview = null;
    } finally {
      saving = false;
      $('rename-dialog')
        .querySelectorAll('input,button')
        .forEach((n) => (n.disabled = false));
      $('rename-apply').disabled = true;
    }
  };
  const cancel = (event) => {
      if (saving) event.preventDefault();
    },
    closed = () => revision++;
  $('rename-dialog').addEventListener('cancel', cancel);
  $('rename-dialog').addEventListener('close', closed);
  return {
    get saving() {
      return saving;
    },
    open(tracks) {
      if (disposed) return;
      ids = [...new Set(tracks.map((t) => t.id))];
      if (!ids.length) return;
      const prefs = getSettings();
      $('rename-album-formula').value = prefs.renameAlbumFormula || '%year% %album%';
      $('rename-track-formula').value = prefs.renameTrackFormula || '%tracknumber% %title%';
      for (const [character, input] of characterInputs)
        input.value = prefs.renameReplacements?.[character] ?? '_';
      $('rename-files').checked = $('rename-folders').checked = true;
      invalidate();
      $('rename-preview').disabled = false;
      dialogs.open($('rename-dialog'));
      $('rename-album-formula').focus();
    },
    dispose() {
      disposed = true;
      for (const input of characterInputs.values()) input.oninput = null;
      $('rename-character-rows').replaceChildren();
      revision++;
      $('rename-dialog').removeEventListener('cancel', cancel);
      $('rename-dialog').removeEventListener('close', closed);
      for (const id of [
        'rename-files',
        'rename-folders',
        'rename-track-formula',
        'rename-album-formula',
        'rename-preview',
        'rename-close',
        'rename-cancel',
        'rename-apply',
      ]) {
        const n = $(id);
        n.onclick = n.oninput = n.onchange = null;
      }
    },
  };
}
