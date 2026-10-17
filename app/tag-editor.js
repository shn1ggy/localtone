import { createMusicBrainzReview } from './musicbrainz-review.js';
export function createTagEditor({
  document,
  api,
  el,
  tagLabels,
  dialogs,
  isBusy,
  setAppBusy,
  currentTrack,
  audio,
  applyTagState,
  getTrack,
  toast,
  clearNotice,
  showSaveError = (message) => toast(message, true),
  albumKey,
  getLeadingZeros,
  saveLeadingZeros,
  onSaved = () => {},
  getSections = () => ({}),
  saveSections = () => {},
  releaseTrack = null,
  confirmMultiple = () => true,
}) {
  const $ = (id) => document.getElementById(id);
  let selectedTracks = [];
  const sections = [
    ['tag-standard-fields', 'tagFieldsExpanded'],
    ['tag-mb-numbers', 'tagNumbersExpanded'],
  ];
  const sectionChanged = (event) => {
    if (!$('tag-dialog').open) return;
    const key = sections.find(([id]) => id === event.target.id)?.[1];
    if (key && getSections()[key] !== event.target.open) saveSections({ [key]: event.target.open });
  };
  for (const [id] of sections) $(id)?.addEventListener('toggle', sectionChanged);
  let editingTag = null,
    tagSaving = false,
    disposed = false,
    openRevision = 0,
    saveJob = Promise.resolve();
  const removeProgress = api.onTagSaveProgress?.((value) => {
    if (disposed || !tagSaving) return;
    const label = value.phase === 'checking' ? 'Preparing tags' : 'Saving tags';
    toast(`${label}… ${value.completed}/${value.total}`, true);
  });
  const changed = () => {
    if (editingTag) editingTag.confirmed = false;
    $('tag-save').textContent = 'Save';
    $('tag-error').hidden = true;
  };
  const review = $('tag-mb-toggle')
    ? createMusicBrainzReview({
        document,
        api,
        el,
        albumKey,
        getEntries: () => editingTag?.entries || [],
        onChanged: changed,
        getLeadingZeros,
        saveLeadingZeros,
      })
    : null;
  async function openTagEditor(tracks) {
    if (disposed || !tracks.length) return;
    if (isBusy()) {
      toast('Wait for the current operation.');
      return;
    }
    for (const [id, key] of sections) if ($(id)) $(id).open = getSections()[key] !== false;
    const revision = ++openRevision;
    editingTag = null;
    selectedTracks = [...tracks];
    review?.reset([]);
    $('tag-fields').replaceChildren();
    $('tag-error').hidden = true;
    $('tag-save').disabled = true;
    $('tag-save').textContent = 'Save';
    $('tag-count').textContent =
      `Loading ${tracks.length} ${tracks.length === 1 ? 'file' : 'files'}…`;
    dialogs.open($('tag-dialog'));
    try {
      const entries = api.readTagsBatch
        ? await api.readTagsBatch(tracks.map((t) => t.id))
        : [{ id: tracks[0].id, ...(await api.readTags(tracks[0].id)) }];
      if (disposed || revision !== openRevision || !$('tag-dialog').open) return;
      editingTag = { entries, confirmed: false };
      $('tag-save').textContent = 'Save';
      $('tag-fields').replaceChildren();
      $('tag-error').hidden = true;
      $('tag-count').textContent = `${entries.length} ${entries.length === 1 ? 'file' : 'files'}`;
      for (const [key, label] of Object.entries(tagLabels)) {
        const values = [...new Set(entries.map((e) => e.values[key] || ''))],
          mixed = values.length > 1;
        const row = el('div', null, 'tag-field-row'),
          name = el('label', label),
          input = el('input');
        input.id = `tag-value-${key}`;
        name.htmlFor = input.id;
        input.name = key;
        input.value = mixed ? '' : values[0];
        input.placeholder = mixed ? '⟨multiple values⟩' : '';
        input.maxLength = 1000;
        input.title = mixed ? values.map((v) => v || '(empty)').join('\n') : values[0] || 'Empty';
        input.dataset.original = input.value;
        input.dataset.mixed = String(mixed);
        const markEdited = () => {
          input.dataset.changed = String(mixed || input.value !== input.dataset.original);
          row.classList.toggle('changed', input.dataset.changed === 'true');
          input.placeholder = '';
          input.setAttribute(
            'aria-description',
            input.value === '' && input.dataset.changed === 'true'
              ? 'This tag will be removed from all selected files.'
              : '',
          );
          if (editingTag) editingTag.confirmed = false;
          $('tag-save').textContent = 'Save';
          $('tag-error').hidden = true;
        };
        input.oninput = markEdited;
        if (mixed)
          input.setAttribute(
            'aria-description',
            'Multiple values. Press Delete or Backspace to remove this tag from all selected files.',
          );
        const clearMixed = (event) => {
          if (!mixed || input.value !== '' || event.isComposing) return;
          event.preventDefault();
          markEdited();
        };
        input.onkeydown = (event) => {
          if (event.key === 'Delete' || event.key === 'Backspace') clearMixed(event);
        };
        input.onbeforeinput = (event) => {
          if (event.inputType?.startsWith('delete')) clearMixed(event);
        };
        row.append(name, input);
        $('tag-fields').append(row);
      }
      review?.reset(selectedTracks);
      $('tag-save').disabled = false;
      if ($('tag-standard-fields')?.open === false)
        $('tag-standard-fields').querySelector('summary')?.focus();
      else $('tag-fields').querySelector('input')?.focus();
    } catch (error) {
      if (disposed || revision !== openRevision || !$('tag-dialog').open) return;
      $('tag-count').textContent = '';
      $('tag-error').textContent = error.message.replace(
        /^Error invoking remote method '[^']+': Error: /,
        '',
      );
      $('tag-error').hidden = false;
    }
  }
  $('tag-close').onclick = $('tag-cancel').onclick = () => {
    if (!tagSaving) $('tag-dialog').close();
  };
  const cancel = (event) => {
    if (tagSaving) event.preventDefault();
  };
  $('tag-dialog').addEventListener('cancel', cancel);
  const saveTags = async (event) => {
    event.preventDefault();
    if (tagSaving || isBusy() || !editingTag) return;
    const target = editingTag,
      patch = {};
    for (const input of $('tag-fields').querySelectorAll('input[name]'))
      if (input.dataset.changed === 'true') patch[input.name] = input.value;
    const remove = [],
      proposals = review?.patches() || new Map(),
      planned = target.entries.filter((e) => Object.keys(patch).length || proposals.has(e.id));
    if (!planned.length) {
      $('tag-dialog').close();
      return;
    }
    if (planned.length > 1 && confirmMultiple() && !target.confirmed) {
      target.confirmed = true;
      $('tag-error').textContent = `Apply these changes to all ${planned.length} files?`;
      $('tag-error').hidden = false;
      $('tag-save').textContent = 'Confirm changes';
      return;
    }
    review?.pause();
    tagSaving = true;
    setAppBusy(true);
    $('tag-error').hidden = true;
    $('tag-form')
      .querySelectorAll('input,select,button')
      .forEach((input) => (input.disabled = true));
    $('tag-dialog').close();
    toast('Preparing tags…', true);
    let saveError = null,
      savedCount = 0;
    const activeId = currentTrack()?.id,
      active = planned.some((e) => e.id === activeId);
    if (active && !releaseTrack) {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    }
    ++openRevision;
    try {
      const entries = planned.map((e) => ({
        id: e.id,
        token: e.token,
        extraKeys: (e.extras || []).map((x) => x.key),
        ...(proposals.has(e.id) ? { patch: proposals.get(e.id) } : {}),
      }));
      const write = () =>
        api.writeTagsBatch
          ? api.writeTagsBatch(entries, patch, remove)
          : api.writeTags(
              entries[0].id,
              {
                ...target.entries.find((e) => e.id === entries[0].id).values,
                ...patch,
                ...proposals.get(entries[0].id),
              },
              entries[0].token,
            );
      const result = releaseTrack
        ? await releaseTrack(
            planned.map((e) => e.id),
            write,
          )
        : await write();
      if (disposed) return;
      onSaved(result);

      savedCount = result.saved?.length ?? planned.length;
      if (result.failures?.length) {
        saveError = `${savedCount} files saved. ${result.failures.map((f) => `${f.name || 'Save'}: ${f.message}`).join(' ')} Close and reopen the editor before retrying failed files.`;
        $('tag-error').textContent = saveError;
        $('tag-error').hidden = false;
        editingTag = null;
      }
      applyTagState(result.state);
      if (active && currentTrack()?.id === activeId) {
        $('now-title').textContent = getTrack(activeId)?.title || '';
        $('now-artist').textContent = getTrack(activeId)?.artist || '';
      }
    } catch (error) {
      if (disposed) return;
      $('tag-error').textContent = error.message.replace(
        /^Error invoking remote method '[^']+': Error: /,
        '',
      );
      $('tag-error').hidden = false;
      saveError = $('tag-error').textContent;
    } finally {
      if (disposed) {
        tagSaving = false;
        setAppBusy(false);
        return;
      }
      if (active && !releaseTrack) {
        audio.src = `localtone://audio/${activeId}`;
        $('elapsed').textContent = '0:00';
        $('seek').value = 0;
      }
      clearNotice();
      tagSaving = false;
      setAppBusy(false);
      $('tag-form')
        .querySelectorAll('input,select,button')
        .forEach(
          (input) =>
            (input.disabled = !editingTag && !['tag-close', 'tag-cancel'].includes(input.id)),
        );
      $('tag-close').disabled = $('tag-cancel').disabled = false;
      if ($('tag-dialog').open) review?.refresh();
      $('tag-save').disabled = !editingTag;
      if (saveError) showSaveError(saveError, () => dialogs.open($('tag-dialog')));
      else toast(`Tags saved for ${savedCount} ${savedCount === 1 ? 'file' : 'files'}.`);
    }
  };

  $('tag-form').onsubmit = (event) => {
    if (tagSaving) {
      event.preventDefault();
      return saveJob;
    }
    saveJob = saveTags(event);
    return saveJob;
  };

  return {
    open: openTagEditor,
    whenSaved: () => saveJob,
    get saving() {
      return tagSaving;
    },
    dispose() {
      review?.dispose();
      removeProgress?.();
      for (const [id] of sections) $(id)?.removeEventListener('toggle', sectionChanged);
      disposed = true;
      openRevision++;
      $('tag-dialog').removeEventListener('cancel', cancel);
      for (const id of ['tag-close', 'tag-cancel']) $(id).onclick = null;
      $('tag-form').onsubmit = null;
    },
  };
}
