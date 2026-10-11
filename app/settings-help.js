// Shared, nonmodal explanations. Keys match the setting/control IDs.
export const settingsHelp = {
  'clean-cache': {
    title: 'Clean unused cache',
    body: 'Remove artwork for tracks no longer in the collection and waveform caches from earlier file versions. Current artwork and waveforms, settings, playlists, backups and undo history are retained.',
  },
  'setting-exportCollections': {
    title: 'Collection backup',
    body: 'Include library folders, playlist membership and dynamic rules. Music files and artwork are not embedded. Import adds collections without replacing existing ones. Paths must match the new computer; rescan libraries to restore artwork.',
  },
  'setting-portable': {
    title: 'Portable mode',
    body: 'Store settings, playlists and artwork beside the app. Restart Localtone after changing this setting.',
  },
  'cleanup-external-data': {
    title: 'Old app data',
    body: 'After switching to portable mode, remove data left in the operating system’s app-data folder. Localtone asks for confirmation first.',
  },
  'setting-waveformNormalize': {
    title: 'Normalize waveform',
    body: 'Scale each waveform to its own peak so quieter tracks are easier to see. Audio volume is unchanged.',
  },
  'setting-gaplessPlayback': {
    title: 'Gapless playback',
    body: 'Buffers the current and next track for seamless transitions. Uses more memory; very long or unsupported files use normal playback.',
  },
  'setting-globalPlaybackShortcuts': {
    title: 'Global playback keys',
    body: 'Previous, next and random-next shortcuts work even when another app has focus. Other shortcuts work inside Localtone.',
  },
  'lastfm-enabled': {
    title: 'Scrobbling',
    body: 'Send listening history to Last.fm using artist and title tags. Disconnecting clears unsent scrobbles.',
  },
};
export function createSettingsHelp({ document, window = document.defaultView }) {
  const panel = document.getElementById('settings-help-popover'),
    heading = document.getElementById('settings-help-title'),
    body = document.getElementById('settings-help-body'),
    guide = document.getElementById('settings-guide');
  let trigger = null,
    guideTrigger = null;
  const cleanups = [];
  function listen(node, event, handler, options) {
    node.addEventListener(event, handler, options);
    cleanups.push(() => node.removeEventListener(event, handler, options));
  }
  function close(restore = false) {
    if (!trigger) return;
    const previous = trigger;
    trigger = null;
    previous.setAttribute('aria-expanded', 'false');
    if (panel.hidePopover && panel.matches(':popover-open')) panel.hidePopover();
    panel.hidden = true;
    if (restore && previous.isConnected) previous.focus({ preventScroll: true });
  }
  function position() {
    if (!trigger) return;
    const r = trigger.getBoundingClientRect(),
      gap = 6,
      pad = 8;
    const width = Math.min(300, window.innerWidth - pad * 2);
    panel.style.width = width + 'px';
    const height = panel.getBoundingClientRect().height;
    panel.style.left = Math.max(pad, Math.min(r.left, window.innerWidth - width - pad)) + 'px';
    panel.style.top =
      Math.max(
        pad,
        Math.min(
          r.bottom + gap + height <= window.innerHeight - pad
            ? r.bottom + gap
            : r.top - height - gap,
          window.innerHeight - height - pad,
        ),
      ) + 'px';
  }
  for (const button of document.querySelectorAll('[data-settings-help]')) {
    const entry = settingsHelp[button.dataset.settingsHelp];
    if (!entry) continue;
    button.setAttribute('aria-label', 'Help for ' + entry.title.toLowerCase());
    button.setAttribute('aria-controls', panel.id);
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-haspopup', 'dialog');
    listen(button, 'keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        event.stopPropagation();
        if (!event.repeat) button.click();
      }
    });
    listen(button, 'click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (trigger === button) {
        close();
        return;
      }
      close();
      trigger = button;
      heading.textContent = entry.title;
      body.textContent = entry.body;
      button.setAttribute('aria-expanded', 'true');
      panel.hidden = false;
      if (panel.showPopover) panel.showPopover();
      position();
    });
  }
  listen(document.getElementById('settings-help-close'), 'click', () => close(true));
  listen(
    document,
    'pointerdown',
    (event) => {
      if (trigger && !panel.contains(event.target) && !trigger.contains(event.target)) close();
    },
    true,
  );
  listen(
    document,
    'keydown',
    (event) => {
      if (guide.open) {
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopImmediatePropagation();
          guide.close();
          return;
        }
        if (event.key === 'Tab') {
          const buttons = [
            ...guide.querySelectorAll('button,a[href],input,select,textarea,[tabindex="0"]'),
          ].filter((n) => !n.disabled && !n.hidden);
          const first = buttons[0],
            last = buttons.at(-1);
          if (
            (event.shiftKey && document.activeElement === first) ||
            (!event.shiftKey && document.activeElement === last)
          ) {
            event.preventDefault();
            (event.shiftKey ? last : first)?.focus();
          }
        }
        event.stopPropagation();
        return;
      }
      if (trigger && event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        close(true);
      }
    },
    true,
  );
  listen(document.querySelector('.settings-tabs'), 'click', () => close());
  listen(document.querySelector('.settings-tabs'), 'keydown', (event) => {
    if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) close();
  });
  listen(document.getElementById('settings-dialog'), 'close', () => {
    close();
    if (guide.open) guide.close();
  });
  listen(document.querySelector('.settings-panels'), 'scroll', position);
  listen(window, 'resize', position);
  document.body.append(guide);
  for (const button of document.querySelectorAll('[data-settings-guide]'))
    listen(button, 'click', () => {
      close();
      guideTrigger = button;
      const key = button.dataset.settingsGuide;
      document.getElementById('settings-guide-title').textContent =
        key === 'search' ? 'Search guide' : 'Navigation guide';
      for (const content of guide.querySelectorAll('[data-guide-content]'))
        content.hidden = content.dataset.guideContent !== key;
      guide.showModal();
      document.getElementById('settings-guide-close').focus();
    });
  listen(document.getElementById('settings-guide-close'), 'click', () => guide.close());
  listen(guide, 'close', () => {
    const previous = guideTrigger;
    guideTrigger = null;
    previous?.focus({ preventScroll: true });
  });
  return {
    close,
    dispose() {
      close();
      cleanups.forEach((fn) => fn());
    },
  };
}
