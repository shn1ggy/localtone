// Ellipses indicate actions that ask for additional input in a dialog.
export function menuLabel(value) {
  const plain = value.trim().replace(/(?:\.\.\.|…)$/, '');
  return /^(Edit tags|Rename|Rename files and folders|Playlist settings|Library settings|Reconnect folder|Create playlist from selection|Delete files permanently)$/.test(
    plain,
  )
    ? plain + '…'
    : plain;
}
// Shared ordering and separators; action handlers remain with their owners.
export function normalizeMenu(menu) {
  const document = menu.ownerDocument;
  const el = (tag, text, className) => {
    const node = document.createElement(tag);
    if (text != null) node.textContent = text;
    if (className) node.className = className;
    return node;
  };
  for (const button of menu.querySelectorAll('button')) {
    const label = menuLabel(button.textContent),
      nodes = [...button.childNodes].filter((n) => n.nodeType === 3);
    if (nodes.length) {
      nodes[0].textContent = label;
      nodes.slice(1).forEach((n) => n.remove());
    }
  }
  menu.querySelectorAll('.menu-separator').forEach((n) => n.remove());
  const children = [...menu.children],
    boundary = children.findIndex((n) => n.tagName !== 'BUTTON'),
    main = boundary < 0 ? children : children.slice(0, boundary),
    tail = boundary < 0 ? [] : children.slice(boundary);
  const rank = (node) => {
    const t = node.textContent.trim();
    if (/^Delete files permanently/.test(t)) return 1;
    return /^(Add to play queue|Add to playlist|Create playlist from selection)/.test(t)
      ? 0
      : /^(Edit tags|Rename|Rename files and folders|Playlist settings|Library settings|Settings)/.test(
            t,
          )
        ? 1
        : /^(Renumber|Add leading|Remove leading|Add.*total|Leading|Track numbers)/.test(t)
          ? 2
          : /^(Open folder|Search .* on web)/.test(t)
            ? 3
            : /^(Rescan|Reconnect)/.test(t)
              ? 4
              : /^(Remove|Delete)/.test(t)
                ? 6
                : 5;
  };
  const numberOrder = (text) =>
    /^Renumber/.test(text)
      ? -1
      : /^Add.*total/.test(text)
        ? 0
        : /^Add leading/.test(text)
          ? 1
          : /^Remove leading/.test(text)
            ? 2
            : 3;
  const editOrder = (text) =>
    /^Edit tags/.test(text)
      ? 0
      : /^Rename/.test(text)
        ? 1
        : /^(Delete files permanently|Library settings)/.test(text)
          ? 2
          : 3;
  const queueOrder = (text) =>
    /^Add to play queue/.test(text) ? 0 : /^Add to playlist/.test(text) ? 1 : 2;
  main.sort(
    (a, b) =>
      rank(a) - rank(b) ||
      (rank(a) === 0 ? queueOrder(a.textContent) - queueOrder(b.textContent) : 0) ||
      (rank(a) === 1 ? editOrder(a.textContent) - editOrder(b.textContent) : 0) ||
      (rank(a) === 2 ? numberOrder(a.textContent) - numberOrder(b.textContent) : 0) ||
      (/^Edit tags/.test(a.textContent) ? -1 : /^Edit tags/.test(b.textContent) ? 1 : 0) ||
      (/^(Open folder)/.test(a.textContent) ? -1 : /^(Open folder)/.test(b.textContent) ? 1 : 0),
  );
  menu.replaceChildren();
  let last = null;
  for (const node of main) {
    const group = rank(node);
    if (last !== null && group !== last) {
      const separator = el('hr', null, 'menu-separator');
      separator.setAttribute('role', 'separator');
      menu.append(separator);
    }
    menu.append(node);
    last = group;
  }
  if (tail.length && main.length) {
    const separator = el('hr', null, 'menu-separator');
    separator.setAttribute('role', 'separator');
    menu.append(separator);
  }
  menu.append(...tail);
}
