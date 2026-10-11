export function createSettingsTabs({ document, onSelect }) {
  const tabs = [...document.querySelectorAll('.settings-tabs [role=tab]')];
  const panels = document.querySelector('.settings-panels');
  let current = 'general';
  const handlers = [];
  function select(key, focus = false) {
    if (!tabs.some((button) => button.id === `settings-tab-${key}`)) return;
    current = key;
    for (const button of tabs) {
      const active = button.id === `settings-tab-${key}`;
      button.setAttribute('aria-selected', String(active));
      button.tabIndex = active ? 0 : -1;
      document.getElementById(button.getAttribute('aria-controls')).hidden = !active;
      if (active && focus) button.focus();
    }
    panels.scrollTop = 0;
    onSelect?.(key);
  }
  for (const [index, button] of tabs.entries()) {
    const click = () => select(button.id.replace('settings-tab-', ''));
    const keydown = (event) => {
      let next;
      if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
      else if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = tabs.length - 1;
      else return;
      event.preventDefault();
      select(tabs[next].id.replace('settings-tab-', ''), true);
    };
    button.addEventListener('click', click);
    button.addEventListener('keydown', keydown);
    handlers.push(() => {
      button.removeEventListener('click', click);
      button.removeEventListener('keydown', keydown);
    });
  }
  return {
    get current() {
      return current;
    },
    select,
    dispose() {
      handlers.forEach((remove) => remove());
    },
  };
}
