// Session-only metadata snapshots. Audio bytes never enter the undo store.
const fs = require('node:fs/promises'),
  path = require('node:path'),
  crypto = require('node:crypto'),
  frames = require('./tag-frames.cjs');
const digest = (b) => crypto.createHash('sha256').update(b).digest('hex');
function audioBytes(buffer) {
  const body = frames.tails(buffer).body;
  let start = 0;
  if (body.toString('ascii', 0, 3) === 'ID3') {
    if (body.length < 10 || [...body.subarray(6, 10)].some((n) => n > 127))
      throw Error('Invalid metadata header.');
    start = 10 + body[6] * 2097152 + body[7] * 16384 + body[8] * 128 + body[9];
    if (body[3] === 4 && body[5] & 16) start += 10;
    if (start > body.length) throw Error('Incomplete metadata header.');
  }
  return body.subarray(start);
}
function split(buffer) {
  const tail = frames.tails(buffer),
    audio = audioBytes(buffer);
  return {
    head: buffer.subarray(0, tail.body.length - audio.length).toString('base64'),
    tail: buffer.subarray(tail.body.length).toString('base64'),
    hash: digest(buffer),
    audio: digest(audio),
  };
}
function createTagHistory(root) {
  const directory = path.join(root, 'session-' + crypto.randomUUID()),
    groups = new Map();
  const store = {
    async save(file, original, updated) {
      const before = split(original),
        after = split(updated);
      if (before.audio !== after.audio) throw Error('Audio changed; metadata undo is unavailable.');
      await fs.mkdir(directory, { recursive: true });
      const backup = path.join(directory, crypto.randomUUID() + '.json');
      await fs.writeFile(backup, JSON.stringify({ before, after }), { flag: 'wx' });
      return backup;
    },
  };
  function register(records) {
    if (!records.length) return null;
    const token = crypto.randomUUID();
    groups.set(token, records);
    return token;
  }
  async function restore(token, redo, resolve) {
    const records = groups.get(token);
    if (!records) throw Error('This tag edit is no longer available in this session.');
    const plans = [];
    for (const record of records) {
      const file = resolve(record.id);
      if (!file) throw Error('A track is no longer in the library.');
      const saved = JSON.parse(await fs.readFile(record.backup, 'utf8')),
        from = redo ? saved.before : saved.after,
        to = redo ? saved.after : saved.before;
      if (digest(await fs.readFile(file)) !== from.hash)
        throw Error('A file changed after this edit. It was left untouched.');
      plans.push({ file, from, to, id: record.id });
    }
    async function write(plan, reverse = false) {
      const from = reverse ? plan.to : plan.from,
        to = reverse ? plan.from : plan.to,
        current = await fs.readFile(plan.file);
      if (digest(current) !== from.hash) throw Error('A file changed while restoring tags.');
      const audio = audioBytes(current);
      if (digest(audio) !== to.audio) throw Error('Audio changed; file left untouched.');
      const updated = Buffer.concat([
        Buffer.from(to.head, 'base64'),
        audio,
        Buffer.from(to.tail, 'base64'),
      ]);
      if (digest(updated) !== to.hash) throw Error('Metadata snapshot is invalid.');
      const temporary = path.join(
        path.dirname(plan.file),
        '.localtone-undo-' + crypto.randomUUID() + '.tmp',
      );
      try {
        await fs.writeFile(temporary, updated, {
          flag: 'wx',
          mode: (await fs.stat(plan.file)).mode,
        });
        if (digest(await fs.readFile(plan.file)) !== from.hash)
          throw Error('A file changed while restoring tags.');
        await fs.rename(temporary, plan.file);
      } finally {
        await fs.rm(temporary, { force: true });
      }
    }
    const completed = [];
    try {
      for (const plan of plans) {
        await write(plan);
        completed.push(plan);
      }
    } catch (error) {
      for (const plan of completed.reverse()) await write(plan, true);
      throw error;
    }
    return plans.map((p) => p.id);
  }
  return {
    store,
    register,
    merge(tokens) {
      return register(tokens.flatMap((t) => groups.get(t) || []));
    },
    restore,
    async cleanup() {
      groups.clear();
      await fs.rm(root, { recursive: true, force: true });
    },
  };
}
module.exports = { createTagHistory };
