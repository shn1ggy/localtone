import './rules/playlist-icons.js';

// A top-layer popover: opening it never changes the parent dialog's layout.
export function createPlaylistIconPicker({ document, icon, getDynamic }) {
  const window = document.defaultView;
  const { entries, paths } = globalThis.LocaltonePlaylistIcons;
  const trigger = document.getElementById('playlist-icon-trigger');
  const owner = document.getElementById('playlist-settings-dialog');
  const panel = document.createElement('div');
  panel.id = 'playlist-icon-picker';
  panel.setAttribute('popover', 'manual');
  if (typeof panel.showPopover !== 'function') panel.removeAttribute('popover');
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Playlist icons');
  panel.hidden = true;
  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'dialog-close';
  closeButton.setAttribute('aria-label', 'Close icon picker');
  closeButton.append(icon('close'));
  const grid = document.createElement('div');
  grid.className = 'playlist-icon-grid';
  grid.setAttribute('role', 'group');
  grid.setAttribute('aria-label', 'Playlist icons');
  const buttons = entries.map(([id, label]) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.playlistIcon = id;
    button.setAttribute('aria-label', label);
    button.title = label;
    button.append(icon(id));
    button.onclick = () => select(id);
    grid.append(button);
    return button;
  });
  const reset = document.createElement('button');
  reset.type = 'button';
  reset.className = 'playlist-icon-reset';
  reset.append(icon('history'), document.createTextNode('Reset to default'));
  reset.onclick = () => select('');
  const footer = document.createElement('div');
  footer.className = 'playlist-icon-footer';
  footer.append(reset, closeButton);
  panel.append(grid, footer);
  // Keep it in the modal's subtree so controls remain operable while it is open.
  owner.append(panel);
  let value = '';
  const bindings = [];
  function listen(target, event, handler, options) {
    target.addEventListener(event, handler, options);
    bindings.push(() => target.removeEventListener(event, handler, options));
  }
  function refresh() {
    const name = value || (getDynamic() ? 'dynamic' : 'playlist');
    trigger.replaceChildren(icon(name));
    const label = entries.find(([id]) => id === value)?.[1] || 'Default';
    trigger.title = `Playlist icon: ${label}`;
    trigger.setAttribute('aria-label', `Choose playlist icon: ${label}`);
    for (const button of buttons) {
      button.setAttribute('aria-pressed', String(button.dataset.playlistIcon === value));
      button.tabIndex = button.dataset.playlistIcon === (value || 'playlist') ? 0 : -1;
    }
  }
  function close(focus = false) {
    if (panel.hidden) return;
    if (panel.hidePopover && panel.matches(':popover-open')) panel.hidePopover();
    panel.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    if (focus && owner.open) trigger.focus({ preventScroll: true });
  }
  function select(id) {
    value = id;
    refresh();
    close(true);
  }
  function position() {
    if (panel.hidden) return;
    const r = trigger.getBoundingClientRect();
    const pad = 8,
      gap = 6;
    panel.style.width = Math.min(310, window.innerWidth - 2 * pad) + 'px';
    const { width, height } = panel.getBoundingClientRect();
    const above = r.top - height - gap;
    const top = above >= pad ? above : r.bottom + gap;
    panel.style.left =
      Math.max(pad, Math.min(r.right - width, window.innerWidth - width - pad)) + 'px';
    panel.style.top = Math.max(pad, Math.min(top, window.innerHeight - height - pad)) + 'px';
  }
  function open() {
    if (!panel.hidden) return close(true);
    panel.hidden = false;
    panel.showPopover?.();
    trigger.setAttribute('aria-expanded', 'true');
    position();
    (buttons.find((button) => button.tabIndex === 0) || buttons[0]).focus();
  }
  listen(trigger, 'click', open);
  listen(closeButton, 'click', () => close(true));
  listen(owner, 'close', () => close());
  listen(window, 'resize', position);
  listen(owner, 'scroll', position, true);
  listen(
    document,
    'pointerdown',
    (event) => {
      if (!panel.hidden && !panel.contains(event.target) && !trigger.contains(event.target))
        close();
    },
    true,
  );
  listen(
    document,
    'keydown',
    (event) => {
      if (panel.hidden) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        close(true);
        return;
      }
      const index = buttons.indexOf(document.activeElement);
      const moves = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 8, ArrowUp: -8 };
      if (index >= 0 && (Object.hasOwn(moves, event.key) || ['Home', 'End'].includes(event.key))) {
        event.preventDefault();
        event.stopImmediatePropagation();
        const next =
          event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? buttons.length - 1
              : (index + moves[event.key] + buttons.length) % buttons.length;
        buttons[index].tabIndex = -1;
        buttons[next].tabIndex = 0;
        buttons[next].focus();
      } else if (event.key === 'Tab') {
        const controls = [buttons.find((button) => button.tabIndex === 0), reset, closeButton];
        const current = controls.indexOf(document.activeElement);
        event.preventDefault();
        event.stopImmediatePropagation();
        controls[(current + (event.shiftKey ? -1 : 1) + controls.length) % controls.length].focus();
      }
    },
    true,
  );
  refresh();
  return {
    get value() {
      return value;
    },
    set(valueToSet) {
      close();
      value = Object.hasOwn(paths, valueToSet) ? valueToSet : '';
      refresh();
    },
    refresh,
    close,
    dispose() {
      close();
      bindings.forEach((remove) => remove());
      panel.remove();
    },
  };
}
