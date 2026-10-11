// Owns output-device jobs and listeners. Preferences are read live, not copied.
export function createAudioOutputSettings({
  document,
  navigator,
  audio,
  getPreferences,
  updateSettings,
}) {
  const select = document.getElementById('setting-audioOutput');
  const status = document.getElementById('audio-output-status');
  const refreshButton = document.getElementById('refresh-audio');
  let jobs = Promise.resolve();
  let disposed = false;

  function option(label, value, disabled = false) {
    const node = document.createElement('option');
    node.textContent = label;
    node.value = value;
    node.disabled = disabled;
    return node;
  }

  function enqueue(job) {
    const next = jobs.then(() => (disposed ? undefined : job()));
    jobs = next.catch(() => {});
    return next;
  }

  function refresh() {
    return enqueue(async () => {
      if (!navigator.mediaDevices?.enumerateDevices || typeof audio.setSinkId !== 'function') {
        select.disabled = true;
        status.textContent =
          'Output selection is unavailable on this system. Playback uses the system default.';
        return;
      }
      try {
        const devices = (await navigator.mediaDevices.enumerateDevices()).filter(
          (device) =>
            device.kind === 'audiooutput' && device.deviceId && device.deviceId !== 'default',
        );
        if (disposed) return;
        select.replaceChildren(option('System default', ''));
        const unique = new Map(devices.map((device) => [device.deviceId, device]));
        let index = 1;
        for (const device of unique.values()) {
          select.append(option(device.label || `Audio output ${index++}`, device.deviceId));
        }
        const preferences = getPreferences();
        const saved = preferences.audioOutputId || '';
        const available = !saved || unique.has(saved);
        const target = available ? saved : '';
        if (saved && !available) {
          select.append(
            option(`${preferences.audioOutputName || 'Saved output'} (unavailable)`, saved, true),
          );
        }
        if (audio.sinkId !== target) await audio.setSinkId(target);
        if (disposed) return;
        select.value = saved;
        select.disabled = false;
        status.textContent = available
          ? saved
            ? 'Playback uses the selected device.'
            : 'Playback follows the system default.'
          : 'Saved device unavailable. Using the system default.';
      } catch (error) {
        if (disposed) return;
        select.disabled = false;
        status.textContent = 'Could not list or select audio outputs: ' + error.message;
      }
    });
  }

  function changeOutput() {
    const id = select.value;
    const name = select.selectedOptions[0]?.textContent || 'System default';
    select.disabled = true;
    return enqueue(async () => {
      try {
        await audio.setSinkId(id);
        if (disposed) return;
        await updateSettings({ audioOutputId: id, audioOutputName: name });
        if (disposed) return;
        if (getPreferences().audioOutputId !== id) {
          await audio.setSinkId(getPreferences().audioOutputId || '');
          if (disposed) return;
          select.value = getPreferences().audioOutputId || '';
          throw new Error('The output preference could not be saved.');
        }
        status.textContent = id
          ? 'Playback uses the selected device.'
          : 'Playback follows the system default.';
      } catch (error) {
        if (disposed) return;
        const previous = getPreferences().audioOutputId || '';
        if (audio.sinkId !== previous) await audio.setSinkId(previous).catch(() => {});
        if (disposed) return;
        select.value = previous;
        status.textContent = 'Could not switch output: ' + error.message;
      } finally {
        if (!disposed) select.disabled = false;
      }
    });
  }

  refreshButton.onclick = refresh;
  select.onchange = changeOutput;
  navigator.mediaDevices?.addEventListener?.('devicechange', refresh);
  return {
    refresh,
    dispose() {
      disposed = true;
      navigator.mediaDevices?.removeEventListener?.('devicechange', refresh);
      refreshButton.onclick = null;
      select.onchange = null;
    },
  };
}
