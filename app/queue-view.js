export function queuePage(queueLength, cursor, count = 100) {
  const size = Number.isInteger(count) && count >= 10 && count <= 1000 ? count : 100;
  const start =
    Math.floor(Math.max(0, Math.min(cursor, Math.max(0, queueLength - 1))) / size) * size;
  return { start, end: Math.min(queueLength, start + size) };
}

// Bound comparison work to the queue rows we actually render. Keeping their DOM
// avoids losing focus, scroll position and decoded artwork on unrelated browsing.
export function createQueueViewCache() {
  let previous = null;
  return {
    changed(queue, cursor, tracks, count = 100) {
      const { start, end } = queuePage(queue.length, cursor, count);
      const rows = queue.slice(start, end).map((id) => {
        const track = tracks.get(id);
        return [id, track, track?.title, track?.artist, track?.cover, track?.modifiedAt];
      });
      const same =
        previous &&
        previous.length === queue.length &&
        previous.cursor === cursor &&
        previous.count === count &&
        rows.length === previous.rows.length &&
        rows.every((row, i) => row.every((value, j) => value === previous.rows[i][j]));
      previous = { length: queue.length, cursor, count, rows };
      return !same;
    },
  };
}
