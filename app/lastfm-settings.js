export function createLastfmSettings({ document, api, confirm, onStatus }) {
  const $ = (id) => document.getElementById(id);
  let lastfmState = { enabled: false },
    lastfmWorking = false,
    disposed = false,
    statusRevision = 0;
  function showLastfmStatus(value) {
    if (disposed) return;
    statusRevision++;
    onStatus(value);
    lastfmState = value;
    $('lastfm-status').textContent = value.connected
      ? `Connected as ${value.username}${value.pending ? ` · ${value.pending} queued` : ''}`
      : value.authorizing
        ? 'Approve access in your browser, then finish the connection.'
        : value.configured
          ? 'API details saved · Not connected'
          : 'Not connected';
    $('lastfm-enabled').checked = !!value.enabled;
    $('lastfm-enabled').disabled = !value.connected;
    $('lastfm-connect').disabled = !value.configured;
    $('lastfm-finish').hidden = !value.authorizing;
    $('lastfm-disconnect').hidden = !value.connected && !value.authorizing && !value.pending;
    $('lastfm-retry').hidden = !value.pending;
    $('lastfm-key').placeholder = value.configured ? 'Saved' : '';
    $('lastfm-secret').placeholder = value.configured ? 'Saved' : '';
    $('lastfm-error').textContent = value.error || value.lastResult || '';
    $('lastfm-error').hidden = !$('lastfm-error').textContent;
  }
  async function refreshLastfm() {
    if (!api?.lastfm) return;
    try {
      const revision = statusRevision,
        value = await api.lastfm({ type: 'status' });
      if (!disposed && revision === statusRevision) showLastfmStatus(value);
    } catch (error) {
      if (disposed) return;
      $('lastfm-error').textContent = error.message.replace(
        /^Error invoking remote method '[^']+': Error: /,
        '',
      );
      $('lastfm-error').hidden = false;
    }
  }
  async function lastfmAction(action) {
    if (lastfmWorking || !api?.lastfm) return;
    lastfmWorking = true;
    statusRevision++;
    const buttons = [...$('lastfm-settings').querySelectorAll('button')];
    buttons.forEach((b) => (b.disabled = true));
    $('lastfm-enabled').disabled = true;
    $('lastfm-error').hidden = true;
    try {
      const status = await api.lastfm(action);
      if (disposed) return;
      if (action.type === 'credentials') {
        $('lastfm-key').value = '';
        $('lastfm-secret').value = '';
      }
      showLastfmStatus(status);
    } catch (error) {
      if (disposed) return;
      $('lastfm-error').textContent = error.message.replace(
        /^Error invoking remote method '[^']+': Error: /,
        '',
      );
      $('lastfm-error').hidden = false;
    } finally {
      lastfmWorking = false;
      if (disposed) return;
      buttons.forEach((b) => (b.disabled = false));
      $('lastfm-connect').disabled = !lastfmState.configured;
      $('lastfm-enabled').checked = !!lastfmState.enabled;
      $('lastfm-enabled').disabled = !lastfmState.connected;
    }
  }
  $('lastfm-save').onclick = () => {
    if (lastfmState.connected || lastfmState.pending) {
      if (!confirm('Replace API details and clear the current connection and unsent scrobbles?'))
        return;
    }
    lastfmAction({
      type: 'credentials',
      key: $('lastfm-key').value,
      secret: $('lastfm-secret').value,
    });
  };
  for (const [type, id] of [
    ['api-account', 'api'],
    ['connect', 'connect'],
    ['finish', 'finish'],
    ['disconnect', 'disconnect'],
    ['retry', 'retry'],
  ])
    $('lastfm-' + id).onclick = () => lastfmAction({ type });
  $('lastfm-enabled').onchange = () =>
    lastfmAction({ type: 'enable', value: $('lastfm-enabled').checked });

  return {
    show: showLastfmStatus,
    refresh: refreshLastfm,
    dispose() {
      disposed = true;
      statusRevision++;
      for (const id of ['save', 'api', 'connect', 'finish', 'disconnect', 'retry'])
        $('lastfm-' + id).onclick = null;
      $('lastfm-enabled').onchange = null;
    },
  };
}
