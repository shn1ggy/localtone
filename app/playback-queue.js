import { moveQueueItem, insertQueueItems } from './interactions.js';

// Sole owner of queue order, collection origins and playing index. The renderer
// reads immutable views; mutations commit all related fields together.
export function createPlaybackQueue({ random = Math.random } = {}) {
  let state = {
    queue: Object.freeze([]),
    origins: Object.freeze([]),
    ordered: Object.freeze([]),
    cursor: -1,
  };
  const copyOrigin = (origin) => origin && { ...origin };
  function commit(queue, origins, ordered, cursor) {
    if (queue.length !== origins.length) throw new Error('Queue origins must match queue entries.');
    state = {
      queue: Object.freeze([...queue]),
      origins: Object.freeze(origins.map((origin) => origin && Object.freeze(copyOrigin(origin)))),
      ordered: Object.freeze([...ordered]),
      cursor,
    };
  }
  function shuffled(items) {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
  return {
    get queue() {
      return state.queue;
    },
    get origins() {
      return state.origins;
    },
    get ordered() {
      return state.ordered;
    },
    get cursor() {
      return state.cursor;
    },
    select(index) {
      state = { ...state, cursor: index };
    },
    seed(ids, origin, { chosen, shuffle = false } = {}) {
      if (!ids.length) return;
      let queue = [...ids],
        cursor = chosen ? ids.indexOf(chosen) : 0;
      if (shuffle) {
        chosen ||= ids[Math.floor(random() * ids.length)];
        queue = [chosen, ...shuffled(ids.filter((id) => id !== chosen))];
        cursor = 0;
      }
      commit(
        queue,
        queue.map(() => origin),
        ids,
        cursor,
      );
    },
    insert(ids, origin, at = Math.max(0, state.cursor + 1)) {
      const next = insertQueueItems(state.queue, state.cursor, ids, at);
      const origins = insertQueueItems(
        state.origins,
        state.cursor,
        ids.map(() => origin),
        at,
      ).queue;
      commit(next.queue, origins, next.queue, next.cursor);
    },
    move(from, at) {
      const next = moveQueueItem(state.queue, state.cursor, from, at);
      const origins = moveQueueItem(state.origins, state.cursor, from, at).queue;
      commit(next.queue, origins, next.queue, next.cursor);
    },
    remove(index) {
      const queue = state.queue.filter((_, i) => i !== index);
      const origins = state.origins.filter((_, i) => i !== index);
      commit(queue, origins, queue, index < state.cursor ? state.cursor - 1 : state.cursor);
    },
    remapReferences(remap) {
      const map = (id) => (Object.hasOwn(remap, id) ? remap[id] : id);
      const queue = state.queue.map(map),
        cursor = queue[state.cursor]
          ? queue.slice(0, state.cursor + 1).filter(Boolean).length - 1
          : -1;
      commit(
        queue.filter(Boolean),
        state.origins.filter((_, i) => queue[i]),
        state.ordered.map(map).filter(Boolean),
        cursor,
      );
    },
    prune(hasTrack) {
      const queue = state.queue.filter(hasTrack);
      const origins = state.origins.filter((_, i) => hasTrack(state.queue[i]));
      const cursor = state.queue.slice(0, state.cursor + 1).filter(hasTrack).length - 1;
      commit(queue, origins, state.ordered.filter(hasTrack), cursor);
    },
    setShuffled(enabled) {
      if (state.cursor < 0) return;
      if (enabled) {
        const entries = state.queue.map((id, i) => ({ id, origin: state.origins[i] }));
        const playing = entries[state.cursor];
        const next = [playing, ...shuffled(entries.filter((_, i) => i !== state.cursor))];
        commit(
          next.map((e) => e.id),
          next.map((e) => e.origin),
          state.ordered,
          0,
        );
        return;
      }
      const playing = state.queue[state.cursor],
        buckets = new Map();
      state.queue.forEach((id, i) => {
        if (!buckets.has(id)) buckets.set(id, []);
        buckets.get(id).push(state.origins[i]);
      });
      const queue = [],
        origins = [];
      for (const id of state.ordered) {
        const items = buckets.get(id);
        if (items?.length) {
          queue.push(id);
          origins.push(items.shift());
        }
      }
      for (const [id, items] of buckets)
        for (const origin of items) {
          queue.push(id);
          origins.push(origin);
        }
      commit(queue, origins, state.ordered, Math.max(0, queue.indexOf(playing)));
    },
    randomNext(ids, origin, currentId) {
      const choices = ids.filter((id) => id !== currentId);
      if (!choices.length) return false;
      const chosen = choices[Math.floor(random() * choices.length)];
      const queue = [
        ...(currentId ? [currentId] : []),
        chosen,
        ...shuffled(choices.filter((id) => id !== chosen)),
      ];
      commit(
        queue,
        queue.map(() => origin),
        ids,
        currentId ? 1 : 0,
      );
      return true;
    },
    capture() {
      return {
        queue: [...state.queue],
        origins: state.origins.map(copyOrigin),
        ordered: [...state.ordered],
        cursor: state.cursor,
      };
    },
    restoreEdit(target, hasTrack) {
      const playing = state.queue[state.cursor],
        origin = state.origins[state.cursor];
      const queue = target.queue.filter(hasTrack);
      const origins = target.origins.filter((_, i) => hasTrack(target.queue[i]));
      const ordered = target.ordered.filter(hasTrack);
      let cursor = queue[target.cursor] === playing ? target.cursor : queue.indexOf(playing);
      if (playing && cursor < 0) {
        queue.unshift(playing);
        origins.unshift(origin);
        ordered.unshift(playing);
        cursor = 0;
      }
      commit(queue, origins, ordered, cursor);
    },
  };
}
