const fs = require('node:fs/promises'),
  path = require('node:path'),
  crypto = require('node:crypto');
const fields = {
  artist: (t) => t.artist,
  albumartist: (t) => t.albumArtist,
  album: (t) => t.album,
  year: (t) => t.year,
  tracknumber: (t) => String(t.trackRaw || t.track || '').split('/')[0],
  title: (t) => t.title,
  tracktitle: (t) => t.title,
  genre: (t) => t.genre,
  discnumber: (t) => String(t.discRaw || t.disc || '').split('/')[0],
};
const specialCharacters = [...'<>:"/\\|?*'];
function validateReplacements(value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw Error('Invalid character replacements.');
  const clean = {};
  for (const [character, replacement] of Object.entries(value)) {
    if (
      !specialCharacters.includes(character) ||
      typeof replacement !== 'string' ||
      replacement.length > 20 ||
      /[<>:"/\\|?*\x00-\x1f\x7f]/.test(replacement)
    )
      throw Error('Use a safe replacement of up to 20 characters, or leave it empty.');
    clean[character] = replacement;
  }
  return clean;
}
function format(formula, track, replacements = {}) {
  replacements = validateReplacements(replacements);
  if (typeof formula !== 'string' || !formula.trim() || formula.length > 500)
    throw Error('Enter a naming formula.');
  if (formula.replace(/%[a-z]+%/gi, '').includes('%'))
    throw Error('Use complete field names between % signs.');
  const text = formula.replace(/%([a-z]+)%/gi, (_, key) => {
    if (!fields[key.toLowerCase()]) throw Error('Unknown field: %' + key + '%');
    return String(fields[key.toLowerCase()](track) || '');
  });
  const name = text
    .replace(/[<>:"/\\|?*]/g, (character) => replacements[character] ?? '_')
    .replace(/[\x00-\x1f\x7f]/g, '_')
    .replace(/\s+/g, ' ')
    .replace(/[ .]+$/g, '')
    .trim();
  if (
    !name ||
    name === '.' ||
    name === '..' ||
    /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(name) ||
    Buffer.byteLength(name) > 200
  )
    throw Error('The formula produces an empty, reserved or overly long name.');
  return name;
}
const inside = (file, root) => {
  const rel = path.relative(root, file);
  return rel === '' || (!rel.startsWith('..' + path.sep) && rel !== '..' && !path.isAbsolute(rel));
};
async function exists(file) {
  try {
    await fs.lstat(file);
    return true;
  } catch (error) {
    if (['ENOENT', 'ENOTDIR'].includes(error.code)) return false;
    throw error;
  }
}
function createFileNaming() {
  const previews = new Map(),
    history = new Map();
  async function preview(ids, config, db) {
    if (
      !Array.isArray(ids) ||
      !ids.length ||
      ids.length > 10000 ||
      !config ||
      typeof config.files !== 'boolean' ||
      typeof config.folders !== 'boolean' ||
      (!config.files && !config.folders)
    )
      throw Error('Select files or folders to rename.');
    config = { ...config, replacements: validateReplacements(config.replacements) };
    const lookup = new Map(db.tracks.map((t) => [t.id, t])),
      tracks = [...new Set(ids)].map((id) => lookup.get(id));
    const fileMoves = [],
      folderMoves = [],
      folders = new Map(),
      stats = [],
      issues = [];
    let unchanged = 0;
    const issueKeys = new Set();
    const issue = (kind, from, to, message) => {
      const key = JSON.stringify([kind, from, to, message]);
      if (!issueKeys.has(key)) {
        issueKeys.add(key);
        issues.push({ kind, from, to, message });
      }
    };
    for (const track of tracks) {
      if (!track) {
        issue('file', 'Removed entry', '', 'The selected entry is no longer in the collection.');
        continue;
      }
      const library = db.libraries.find((l) => l.id === track.libraryId);
      try {
        if (!library || !inside(track.path, library.root))
          throw Error('The file is outside its library.');
        const stat = await fs.lstat(track.path);
        if (!stat.isFile() || stat.isSymbolicLink())
          throw Error('Only regular music files can be renamed.');
        stats.push({ file: track.path, size: stat.size, mtime: stat.mtimeMs });
      } catch (error) {
        issue(
          'file',
          track.path,
          '',
          ['ENOENT', 'ENOTDIR'].includes(error.code) ? 'File is missing.' : error.message,
        );
        continue;
      }
      if (config.files) {
        try {
          const to = path.join(
            path.dirname(track.path),
            format(config.trackFormula, track, config.replacements) + path.extname(track.path),
          );
          if (to !== track.path) fileMoves.push({ from: track.path, to, kind: 'file' });
          else unchanged++;
        } catch (error) {
          issue('file', track.path, '', error.message);
        }
      }
      if (config.folders) {
        const parts = path.relative(library.root, track.path).split(path.sep),
          folder =
            parts.length >= 3
              ? path.join(library.root, ...parts.slice(0, 2))
              : path.dirname(track.path);
        if (folder === library.root) {
          issue(
            'folder',
            folder,
            '',
            'No album folder: the track is directly in the library root.',
          );
          continue;
        }
        if (!folders.has(folder)) folders.set(folder, []);
        folders.get(folder).push(track);
      }
    }
    for (const [folder, group] of folders) {
      try {
        const names = new Set(
          group.map((t) => format(config.albumFormula, t, config.replacements)),
        );
        if (names.size !== 1)
          throw Error(
            'Conflicting album metadata. Use fields shared by all tracks in this folder.',
          );
        const stat = await fs.lstat(folder);
        if (!stat.isDirectory() || stat.isSymbolicLink())
          throw Error('Album folders must be regular directories.');
        const to = path.join(path.dirname(folder), [...names][0]);
        if (to !== folder) {
          folderMoves.push({ from: folder, to, kind: 'folder' });
          stats.push({ file: folder, size: stat.size, mtime: stat.mtimeMs });
        } else unchanged++;
      } catch (error) {
        issue('folder', folder, '', error.message);
      }
    }
    let moves = [...fileMoves, ...folderMoves];
    const blocked = new Set();
    for (const m of folderMoves)
      if (
        folderMoves.some(
          (other) => other !== m && (inside(m.from, other.from) || inside(other.from, m.from)),
        )
      ) {
        blocked.add(m);
        issue(m.kind, m.from, m.to, 'Overlapping album folders. Rename them separately.');
      }
    const destinations = new Map();
    for (const m of moves) {
      const key = m.to.toLocaleLowerCase();
      if (!destinations.has(key)) destinations.set(key, []);
      destinations.get(key).push(m);
    }
    for (const group of destinations.values())
      if (group.length > 1)
        for (const m of group) {
          blocked.add(m);
          issue(m.kind, m.from, m.to, 'Two items would have the same name. Adjust the formula.');
        }
    moves = moves.filter((m) => !blocked.has(m));
    // Repeat after rejecting a move: another move may depend on it vacating its source.
    let rejected;
    do {
      rejected = [];
      for (const m of moves) {
        try {
          if (await exists(m.to)) {
            const vacated = moves.some((other) => other.kind === m.kind && other.from === m.to);
            const sameFile =
              m.from.toLocaleLowerCase() === m.to.toLocaleLowerCase() &&
              (await fs.realpath(m.from)) === (await fs.realpath(m.to));
            if (!vacated && !sameFile) throw Error('A destination already exists.');
          }
        } catch (error) {
          rejected.push(m);
          issue(m.kind, m.from, m.to, error.message);
        }
      }
      moves = moves.filter((m) => !rejected.includes(m));
    } while (rejected.length);
    const validFolders = moves.filter((m) => m.kind === 'folder'),
      validFiles = moves.filter((m) => m.kind === 'file');
    const finalFile = (file) => {
      const folder = validFolders.find((m) => inside(file, m.from));
      return folder ? path.join(folder.to, path.relative(folder.from, file)) : file;
    };
    const affected = db.tracks
      .filter(
        (t) =>
          validFiles.some((m) => m.from === t.path) ||
          validFolders.some((m) => inside(t.path, m.from)),
      )
      .map((t) => t.id);
    const required = stats.filter((t) =>
      moves.some((m) => m.from === t.file || (m.kind === 'folder' && inside(t.file, m.from))),
    );
    const token = crypto.randomUUID();
    previews.clear();
    moves.forEach((m, index) => {
      m.id = String(index);
    });
    previews.set(token, {
      token,
      config,
      moves,
      stats: required,
      affected,
      tracks: db.tracks.map((t) => ({ id: t.id, path: t.path })),
    });
    return {
      token,
      affected,
      items: moves.map((m) => ({
        id: m.id,
        kind: m.kind,
        rawTo: m.to,
        affected: db.tracks
          .filter((t) => (m.kind === 'folder' ? inside(t.path, m.from) : t.path === m.from))
          .map((t) => t.id),
        from: m.from,
        to: m.kind === 'file' ? finalFile(m.to) : m.to,
      })),
      count: moves.length,
      issues,
      unchanged,
    };
  }
  async function move(item) {
    if (await exists(item.to))
      throw Error('A destination already exists: ' + path.basename(item.to));
    await fs.rename(item.from, item.to);
  }
  async function execute(moves, commit) {
    const done = [];
    try {
      for (const item of moves) {
        await move(item);
        done.push(item);
      }
      await commit(moves);
    } catch (error) {
      const failures = [];
      for (const item of done.reverse())
        try {
          await move({ from: item.to, to: item.from, kind: item.kind });
        } catch (e) {
          failures.push(e.message);
        }
      if (failures.length)
        throw Error(error.message + ' Some names could not be restored: ' + failures.join('; '));
      throw error;
    }
  }
  async function apply(token, commit, selectedIds) {
    const plan = previews.get(token);
    if (!plan) throw Error('Preview the names again before applying.');
    if (
      selectedIds !== undefined &&
      (!Array.isArray(selectedIds) ||
        selectedIds.some((id) => !plan.moves.some((m) => m.id === id)))
    )
      throw Error('Invalid rename selection. Preview again.');
    const moves =
      selectedIds === undefined ? plan.moves : plan.moves.filter((m) => selectedIds.includes(m.id));
    if (!moves.length) throw Error('Select at least one name change.');
    for (const m of moves) {
      if (await exists(m.to)) {
        const vacated = moves.some((other) => other.kind === m.kind && other.from === m.to);
        const sameFile =
          m.from.toLocaleLowerCase() === m.to.toLocaleLowerCase() &&
          (await fs.realpath(m.from)) === (await fs.realpath(m.to));
        if (!vacated && !sameFile)
          throw Error(
            'A selected destination is occupied. Enable its related rename or preview again.',
          );
      }
    }
    const affected = plan.tracks
      .filter((t) =>
        moves.some((m) => (m.kind === 'folder' ? inside(t.path, m.from) : m.from === t.path)),
      )
      .map((t) => t.id);
    const stats = plan.stats.filter((t) =>
      moves.some((m) => m.from === t.file || (m.kind === 'folder' && inside(t.file, m.from))),
    );
    for (const previous of stats) {
      const now = await fs.lstat(previous.file);
      if (now.size !== previous.size || now.mtimeMs !== previous.mtime)
        throw Error('A selected file changed. Preview again.');
    }
    const journal = [];
    for (const kind of ['file', 'folder']) {
      const list = moves
        .filter((m) => m.kind === kind)
        .sort((a, b) => b.from.length - a.from.length);
      const staged = list.map((m) => ({
        ...m,
        stage: path.join(
          path.dirname(m.from),
          '.localtone-rename-' + crypto.randomUUID() + path.extname(m.from),
        ),
      }));
      for (const m of staged) journal.push({ from: m.from, to: m.stage, kind });
      for (const m of staged) journal.push({ from: m.stage, to: m.to, kind });
    }
    await execute(journal, commit);
    previews.delete(token);
    const undoToken = crypto.randomUUID();
    history.set(undoToken, { journal, affected });
    return { undoToken, affected, config: plan.config };
  }
  async function restore(token, redo, commit) {
    const entry = history.get(token);
    if (!entry) throw Error('This rename is no longer available.');
    const journal = redo
      ? entry.journal
      : [...entry.journal].reverse().map((m) => ({ from: m.to, to: m.from, kind: m.kind }));
    await execute(journal, commit);
    return entry.affected;
  }
  return { preview, apply, restore };
}
function relocated(file, moves) {
  for (const move of moves)
    if (move.kind === 'folder' && inside(file, move.from))
      file = path.join(move.to, path.relative(move.from, file));
    else if (file === move.from) file = move.to;
  return file;
}
module.exports = { format, validateReplacements, createFileNaming, relocated };
