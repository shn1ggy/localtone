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
  getCustomFields = () => [],
  saveCustomFields = () => {},
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
    removeOthers = false,
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
  // Tags outside the editor's fields; artwork and ratings are always kept and not listed.
  // User-added fields (frame IDs or TXXX:<description>) persist in settings.
  const fold = (key) => (key.startsWith('TXXX:') ? 'TXXX:' + key.slice(5).toUpperCase() : key);
  const customFields = () => getCustomFields() || [];
  const isCustomField = (key) => customFields().some((f) => fold(f.key) === fold(key));
  const customValue = (entry, key) => {
    const values = entry.custom || {},
      match = Object.keys(values).find((k) => fold(k) === fold(key));
    return match ? values[match] : '';
  };
  const fieldValue = (entry, key) =>
    key.startsWith('x:') ? customValue(entry, key.slice(2)) : entry.values[key] || '';
  // Other tags never include something now shown as an editor field.
  const otherTags = (entry) =>
    (entry.extras || []).filter((x) => !x.keep && !(x.field && isCustomField(x.field)));
  const removableKeys = (entry) => otherTags(entry).map((x) => x.key);
  function paintOtherTags() {
    const section = $('tag-other');
    if (!section) return;
    const entries = editingTag?.entries || [],
      groups = new Map();
    // Artwork and ratings are never removed, so they are not listed either.
    for (const entry of entries)
      for (const extra of otherTags(entry)) {
        const id = `${extra.label}\0${extra.value}`;
        if (!groups.has(id)) groups.set(id, { ...extra, files: 0 });
        groups.get(id).files++;
      }
    const items = [...groups.values()],
      removable = items.length;
    section.hidden = !items.length;
    section.classList.toggle('removing', removeOthers);
    $('tag-other-title').textContent = `Other tags (${items.length})`;
    $('tag-other-remove').textContent = removeOthers ? 'Keep other tags' : 'Remove other tags';
    $('tag-other-remove').setAttribute('aria-pressed', String(removeOthers));
    $('tag-other-note').textContent = removeOthers
      ? `${removable} ${removable === 1 ? 'tag' : 'tags'} will be removed when you save. Artwork and ratings are kept.`
      : 'Tags not shown above, such as publisher or encoder. Artwork and ratings are always kept.';
    $('tag-other-list').replaceChildren(
      ...items.map((item) => {
        const row = el('li'),
          label = el('span', item.label, 'tag-other-label'),
          value = el(
            'span',
            entries.length > 1 && item.files < entries.length
              ? `${item.value} (${item.files} of ${entries.length} files)`
              : item.value,
            'tag-other-value',
          );
        value.title = item.value;
        row.append(label, value);
        return row;
      }),
    );
  }
  if ($('tag-other-remove'))
    $('tag-other-remove').onclick = (event) => {
      // The button sits in the section's summary; do not toggle the section.
      event.preventDefault();
      event.stopPropagation();
      if (!editingTag || tagSaving) return;
      removeOthers = !removeOthers;
      changed();
      paintOtherTags();
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
  function addFieldRow(key, label, custom = false) {
    const entries = editingTag?.entries || [];
    {
      const values = [...new Set(entries.map((e) => fieldValue(e, key)))],
        mixed = values.length > 1;
      const row = el('div', null, 'tag-field-row'),
        name = el('label', label),
        input = el('input');
      input.id = `tag-value-${key.replace(/[^A-Za-z0-9_-]/g, '_')}`;
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
      if (custom) {
        // Removing a field only hides it here; the tag stays in the files.
        const remove = el('button', null, 'tag-field-remove');
        remove.type = 'button';
        remove.title = 'Remove this field from the editor. Tags in your files are not changed.';
        remove.setAttribute('aria-label', `Remove field ${label} from the editor`);
        remove.onclick = (event) => {
          event.preventDefault();
          if (tagSaving) return;
          saveCustomFields(customFields().filter((f) => 'x:' + f.key !== key));
          row.remove();
          paintOtherTags();
          paintAddField();
        };
        name.append(remove);
        row.classList.add('custom');
      }
      row.append(name, input);
      $('tag-fields').append(row);
      return input;
    }
  }
  // Add field: fields already in these files, common fields, or a custom TXXX name.
  const commonFields = [
    ['TCOM', 'Composer'],
    ['TEXT', 'Lyricist'],
    ['TPE3', 'Conductor'],
    ['TPE4', 'Remixed by'],
    ['TIT1', 'Grouping'],
    ['TIT3', 'Subtitle'],
    ['TPUB', 'Publisher'],
    ['TCOP', 'Copyright'],
    ['TBPM', 'BPM'],
    ['TKEY', 'Initial key'],
    ['TSRC', 'ISRC'],
    ['TMED', 'Media type'],
    ['TLAN', 'Language'],
    ['TOPE', 'Original artist'],
    ['TOAL', 'Original album'],
    ['TORY', 'Original year'],
    ['TENC', 'Encoded by'],
    ['TXXX:CATALOGNUMBER', 'Catalog number'],
    ['TXXX:BARCODE', 'Barcode'],
  ];
  function paintAddField() {
    const select = $('tag-add-field-choice');
    if (!select) return;
    const option = (value, text) => {
      const node = el('option', text);
      node.value = value;
      return node;
    };
    const present = new Map();
    for (const entry of editingTag?.entries || [])
      for (const extra of entry.extras || [])
        if (extra.field && !isCustomField(extra.field) && !present.has(fold(extra.field)))
          present.set(fold(extra.field), [extra.field, extra.label.replace(/^Custom: /, '')]);
    const groups = [];
    if (present.size) {
      const group = el('optgroup');
      group.label = 'In the selected files';
      group.append(...[...present.values()].map(([key, text]) => option(key, text)));
      groups.push(group);
    }
    const common = commonFields.filter(([key]) => !isCustomField(key) && !present.has(fold(key)));
    if (common.length) {
      const group = el('optgroup');
      group.label = 'Common fields';
      group.append(...common.map(([key, text]) => option(key, text)));
      groups.push(group);
    }
    select.replaceChildren(...groups, option('__custom', 'Custom field…'));
    syncAddField();
  }
  function syncAddField() {
    const custom = $('tag-add-field-choice').value === '__custom';
    $('tag-add-field-name').hidden = !custom;
    $('tag-add-field-error').textContent = '';
  }
  function closeAddField() {
    $('tag-add-field-form').hidden = true;
    $('tag-add-field-open').hidden = false;
  }
  if ($('tag-add-field-open')) {
    $('tag-add-field-open').onclick = () => {
      if (!editingTag || tagSaving) return;
      paintAddField();
      $('tag-add-field-name').value = '';
      $('tag-add-field-open').hidden = true;
      $('tag-add-field-form').hidden = false;
      $('tag-add-field-choice').focus();
    };
    $('tag-add-field-choice').onchange = () => {
      syncAddField();
      if (!$('tag-add-field-name').hidden) $('tag-add-field-name').focus();
    };
    $('tag-add-field-cancel').onclick = closeAddField;
    const add = () => {
      if (!editingTag || tagSaving) return;
      const choice = $('tag-add-field-choice'),
        error = $('tag-add-field-error');
      let key = choice.value,
        label = choice.selectedOptions[0]?.textContent || key;
      if (key === '__custom') {
        const name = $('tag-add-field-name').value.trim(),
          known = commonFields.find(([, text]) => text.toLowerCase() === name.toLowerCase());
        if (!name) {
          error.textContent = 'Enter a name for the field.';
          return;
        }
        if (name.length > 64 || /[\u0000-\u001f]/.test(name) || name.toUpperCase() === 'RATING') {
          error.textContent =
            name.toUpperCase() === 'RATING'
              ? 'Ratings are managed with the stars.'
              : 'Use a name of up to 64 characters.';
          return;
        }
        [key, label] = known || ['TXXX:' + name, name];
      }
      if (
        Object.values(tagLabels).some((text) => text.toLowerCase() === label.toLowerCase()) ||
        isCustomField(key)
      ) {
        error.textContent = 'This field is already in the editor.';
        return;
      }
      saveCustomFields([...customFields(), { key, label }]);
      const input = addFieldRow('x:' + key, label, true);
      paintOtherTags();
      closeAddField();
      paintAddField();
      input.focus();
    };
    $('tag-add-field-add').onclick = add;
    $('tag-add-field-name').onkeydown = (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        add();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        closeAddField();
      }
    };
  }
  async function openTagEditor(tracks) {
    if (disposed || !tracks.length) return;
    if (tagSaving || isBusy()) {
      toast('Wait for the current operation.');
      return;
    }
    $('tag-form')
      .querySelectorAll('input,select,button')
      .forEach((input) => (input.disabled = false));
    for (const [id, key] of sections) if ($(id)) $(id).open = getSections()[key] !== false;
    const revision = ++openRevision;
    editingTag = null;
    removeOthers = false;
    if ($('tag-add-field-form')) closeAddField();
    if ($('tag-other')) $('tag-other').hidden = true;
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
      for (const [key, label] of Object.entries(tagLabels)) addFieldRow(key, label);
      for (const field of customFields()) addFieldRow('x:' + field.key, field.label, true);
      paintAddField();
      paintOtherTags();
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
    const remove = removeOthers ? [...new Set(target.entries.flatMap(removableKeys))] : [],
      proposals = review?.patches() || new Map(),
      planned = target.entries.filter(
        (e) =>
          Object.keys(patch).length ||
          proposals.has(e.id) ||
          (removeOthers && removableKeys(e).length),
      );
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
