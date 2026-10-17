// Detached mini player (Windows). Renders a live mirror of the main window's player
// and toast, sent as JSON trees, and sends clicks and keys back to the main window.
// It owns no playback state; the main window's handlers do all the work.
const bridge = window.localtoneMini;
const roots = [document.querySelector('.sidebar-player'), document.getElementById('toast')];
let last = null,
  previewStar = null;

function setAttributes(node, attrs) {
  const wanted = new Map(attrs);
  // Artwork in the mini window is always on screen: never lazy-load it.
  wanted.delete('loading');
  for (const { name } of [...node.attributes])
    if (!wanted.has(name)) {
      if (name === 'style') node.style.cssText = '';
      else node.removeAttribute(name);
    }
  for (const [name, value] of wanted) {
    // CSP forbids inline style attributes; CSSOM assignment is allowed.
    if (name === 'style') {
      if (node.style.cssText !== value) node.style.cssText = value;
    } else if (node.getAttribute(name) !== value) node.setAttribute(name, value);
  }
}
function build(tree) {
  if (typeof tree === 'string') return document.createTextNode(tree);
  const node = tree.n ? document.createElementNS(tree.n, tree.t) : document.createElement(tree.t);
  setAttributes(node, tree.a);
  for (const child of tree.c) node.append(build(child));
  return node;
}
function sameKind(node, tree) {
  if (typeof tree === 'string') return node.nodeType === 3;
  return (
    node.nodeType === 1 &&
    node.localName === tree.t &&
    node.namespaceURI === (tree.n || 'http://www.w3.org/1999/xhtml')
  );
}
// Minimal DOM morph: keeps unchanged nodes (and loaded artwork) in place.
function morph(node, tree) {
  setAttributes(node, tree.a);
  const children = [...node.childNodes];
  tree.c.forEach((child, i) => {
    const existing = children[i];
    if (existing && sameKind(existing, child)) {
      if (typeof child === 'string') {
        if (existing.nodeValue !== child) existing.nodeValue = child;
      } else morph(existing, child);
    } else if (existing) existing.replaceWith(build(child));
    else node.append(build(child));
  });
  for (const extra of children.slice(tree.c.length)) extra.remove();
}
function paintPreview() {
  if (!previewStar) return;
  const group = roots[0].querySelector('.stars');
  if (!group) return;
  group.classList.add('preview');
  [...group.children].forEach((button, i) =>
    button.classList.toggle('filled', i <= previewStar.index),
  );
}
function apply(payload) {
  last = payload;
  const root = document.documentElement;
  root.style.cssText = payload.root?.style || '';
  for (const key of Object.keys(root.dataset))
    if (!(key in (payload.root?.data || {}))) delete root.dataset[key];
  Object.assign(root.dataset, payload.root?.data || {});
  if (payload.size?.width) root.style.setProperty('--mini-width', `${payload.size.width}px`);
  document.body.className = ['mini-player', 'mini-window', ...(payload.bodyClass || [])].join(' ');
  payload.trees?.forEach((tree, i) => tree && roots[i] && morph(roots[i], tree));
  paintPreview();
}
bridge.onSync(apply);

function pathTo(node) {
  const rootIndex = roots.findIndex((root) => root.contains(node));
  if (rootIndex < 0) return null;
  const path = [];
  for (let current = node; current !== roots[rootIndex]; current = current.parentNode)
    path.unshift([...current.parentNode.childNodes].indexOf(current));
  return { root: rootIndex, path };
}
// Clicks never act locally; the matching control in the main window is clicked.
document.addEventListener('mousedown', (event) => event.preventDefault());
document.addEventListener('contextmenu', (event) => event.preventDefault());
document.addEventListener('click', (event) => {
  event.preventDefault();
  const control = event.target.closest?.('button');
  if (!control || control.disabled) return;
  const target = pathTo(control);
  if (target) bridge.input({ type: 'click', ...target });
});
document.addEventListener('keydown', (event) => {
  if (event.isComposing || ['Control', 'Shift', 'Alt', 'Meta'].includes(event.key)) return;
  // Let Windows handle Alt+F4 (closing the mini window quits, as before).
  if (event.altKey && event.key === 'F4') return;
  event.preventDefault();
  bridge.input({
    type: 'key',
    key: event.key,
    code: event.code,
    ctrlKey: event.ctrlKey,
    shiftKey: event.shiftKey,
    altKey: event.altKey,
    metaKey: event.metaKey,
    repeat: event.repeat,
  });
});
// Rating hover preview is drawn locally, like the main window's own preview.
document.addEventListener('pointerover', (event) => {
  const button = event.target.closest?.('.stars button');
  if (!button) return;
  previewStar = { index: [...button.parentNode.children].indexOf(button) };
  paintPreview();
});
document.addEventListener('pointerout', (event) => {
  const group = event.target.closest?.('.stars');
  if (!group || group.contains(event.relatedTarget)) return;
  previewStar = null;
  if (last) apply(last);
});
