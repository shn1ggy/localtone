// One mounted table owns one viewport. Dispose before rebuilding/removing it.
export function mountVirtualTracks({
  window,
  document,
  table,
  head,
  body,
  scroller,
  tracks,
  columnCount,
  createRow,
}) {
  const el = (tag, text, className) => {
    const node = document.createElement(tag);
    if (text != null) node.textContent = text;
    if (className) node.className = className;
    return node;
  };
  // Keep the full collection in memory, but mount only the viewport and overscan.
  const rowHeight = 28,
    overscan = 15;
  let first = -1,
    last = -1,
    frame = null,
    disposed = false;
  const rows = new Map();
  table.classList.add('virtual-tracks');
  table.setAttribute('aria-rowcount', String(tracks.length + 1));
  const origin = () =>
    table.getBoundingClientRect().top -
    scroller.getBoundingClientRect().top +
    scroller.scrollTop +
    (head.hidden ? 0 : head.getBoundingClientRect().height);
  const spacer = (height) => {
    const row = el('tr', null, 'virtual-spacer'),
      cell = el('td');
    row.setAttribute('aria-hidden', 'true');
    cell.colSpan = columnCount;
    cell.style.height = `${height}px`;
    row.append(cell);
    return row;
  };
  const paint = () => {
    frame = null;
    if (disposed) return;
    const height = scroller.clientHeight || 600,
      offset = Math.max(0, scroller.scrollTop - origin());
    const start = Math.min(
      Math.max(0, tracks.length - 1),
      Math.max(0, Math.floor(offset / rowHeight) - overscan),
    );
    const end = Math.min(tracks.length, Math.ceil((offset + height) / rowHeight) + overscan);
    if (start === first && end === last) return;
    first = start;
    last = end;
    const indices = new Set(Array.from({ length: end - start }, (_, i) => start + i));
    // Keep a focused or dragged row alive even when it leaves the viewport.
    for (const [i, row] of rows)
      if (row.contains(document.activeElement) || row.classList.contains('dragging'))
        indices.add(i);
    const desired = [];
    let previous = 0;
    for (const i of [...indices].sort((a, b) => a - b)) {
      if (i > previous) desired.push(spacer((i - previous) * rowHeight));
      if (!rows.has(i)) rows.set(i, createRow(tracks[i], i));
      desired.push(rows.get(i));
      previous = i + 1;
    }
    if (previous < tracks.length) desired.push(spacer((tracks.length - previous) * rowHeight));
    const keep = new Set(desired);
    for (const node of [...body.children]) if (!keep.has(node)) node.remove();
    let cursor = body.firstChild;
    for (const node of desired) {
      if (node === cursor) cursor = cursor.nextSibling;
      else body.insertBefore(node, cursor);
    }
    for (const i of rows.keys()) if (!indices.has(i)) rows.delete(i);
  };
  const schedule = () => {
    if (frame === null)
      frame = window.requestAnimationFrame
        ? window.requestAnimationFrame(paint)
        : window.setTimeout(paint, 0);
  };
  scroller.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  table._disposeVirtual = () => {
    disposed = true;
    scroller.removeEventListener('scroll', schedule);
    window.removeEventListener('resize', schedule);
    if (frame !== null) {
      window.cancelAnimationFrame?.(frame);
      window.clearTimeout(frame);
    }
    table._disposeVirtual = null;
    table._refreshVirtual = null;
  };
  table._refreshVirtual = paint;
  table._revealTrack = (id, nearest = false) => {
    const index = tracks.findIndex((t) => t.id === id);
    if (index < 0) return;
    const top = origin() + index * rowHeight,
      height = scroller.clientHeight || 600;
    if (nearest) {
      if (top < scroller.scrollTop) scroller.scrollTop = Math.max(0, top);
      else if (top + rowHeight > scroller.scrollTop + height)
        scroller.scrollTop = top + rowHeight - height;
    } else scroller.scrollTop = Math.max(0, top - height / 2 + rowHeight / 2);
    paint();
  };
  paint();
  return {
    dispose: () => table._disposeVirtual?.(),
    reveal: (id, nearest = false) => table._revealTrack?.(id, nearest),
  };
}
