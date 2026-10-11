export function moveQueueItem(queue, cursor, from, to) {
  if (!Number.isInteger(from) || from < 0 || from >= queue.length)
    return { queue: [...queue], cursor };
  const indexes = queue.map((_, i) => i),
    target = Math.max(0, Math.min(queue.length, to));
  indexes.splice(target > from ? target - 1 : target, 0, indexes.splice(from, 1)[0]);
  return { queue: indexes.map((i) => queue[i]), cursor: cursor < 0 ? -1 : indexes.indexOf(cursor) };
}
export function insertQueueItems(queue, cursor, ids, at) {
  const target = Math.max(0, Math.min(queue.length, at)),
    next = [...queue];
  next.splice(target, 0, ...ids);
  return { queue: next, cursor: cursor >= 0 && target <= cursor ? cursor + ids.length : cursor };
}
export function seekTo(audio, percent, fallback = 0) {
  const duration =
    Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : fallback;
  if (!(duration > 0)) return null;
  const target = Math.max(0, Math.min(duration, (Number(percent) / 100) * duration));
  if (!Number.isFinite(target)) return null;
  audio.currentTime = target;
  return target;
}
// Pixel widths are independent of the header: colgroups also work with hidden names.
export function columnWidths(columns, available) {
  const totalFixed = columns.filter((c) => c.fixed).reduce((n, c) => n + c.width, 0),
    totalFlex = columns.filter((c) => !c.fixed).reduce((n, c) => n + c.width, 0);
  const fixedBudget = Math.min(totalFixed, Math.max(0, available - Math.min(80, available * 0.25))),
    scale = totalFixed ? fixedBudget / totalFixed : 1,
    remaining = available - fixedBudget;
  return columns.map((c) => (c.fixed ? c.width * scale : (remaining * c.width) / (totalFlex || 1)));
}
export function resizeColumnBoundary(widths, index, delta, min = 36) {
  if (index < 0 || index >= widths.length - 1) return [...widths];
  const left = Array.isArray(min) ? min[index] : min,
    right = Array.isArray(min) ? min[index + 1] : min;
  const change = Math.max(left - widths[index], Math.min(widths[index + 1] - right, delta)),
    next = [...widths];
  next[index] += change;
  next[index + 1] -= change;
  return next;
}
