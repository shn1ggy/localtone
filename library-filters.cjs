const path = require('node:path');
function validateFilters(value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw Error('Invalid library exclusions.');
  if (
    Object.keys(value).some(
      (key) => !['folders', 'fileTypes', 'fileNames', 'hiddenFolders'].includes(key),
    )
  )
    throw Error('Unknown library exclusion.');
  const clean = {};
  for (const key of ['folders', 'fileTypes', 'fileNames']) {
    const values = value[key] ?? [];
    if (
      !Array.isArray(values) ||
      values.length > 100 ||
      values.some(
        (item) =>
          typeof item !== 'string' || !item.trim() || item.length > 200 || /[\0\r\n/\\]/.test(item),
      )
    )
      throw Error('Use up to 100 comma-separated names or patterns.');
    clean[key] = [...new Set(values.map((item) => item.trim()))];
  }
  clean.fileTypes = clean.fileTypes.map((item) => item.replace(/^\./, '').toLowerCase());
  if (clean.fileTypes.some((item) => !/^[a-z0-9]+$/.test(item)))
    throw Error('File types must be extensions, such as mp3 or flac.');
  if (value.hiddenFolders != null && typeof value.hiddenFolders !== 'boolean')
    throw Error('Invalid hidden-folder setting.');
  clean.hiddenFolders = value.hiddenFolders === true;
  return clean;
}
function compileFilters(root, value) {
  const filters = validateFilters(value),
    folders = new Set(filters.folders.map((name) => name.toLowerCase())),
    types = new Set(filters.fileTypes);
  const patterns = filters.fileNames.map(
    (pattern) =>
      new RegExp(
        '^' +
          pattern
            .split('')
            .map((c) =>
              c === '*' ? '.*' : c === '?' ? '.' : c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
            )
            .join('') +
          '$',
        'i',
      ),
  );
  return (filename, directory = false) => {
    const parts = path.relative(root, filename).split(path.sep),
      names = directory ? parts : parts.slice(0, -1);
    return (
      names.some(
        (name) =>
          folders.has(name.toLowerCase()) || (filters.hiddenFolders && name.startsWith('.')),
      ) ||
      (!directory &&
        (types.has(path.extname(filename).slice(1).toLowerCase()) ||
          patterns.some((pattern) => pattern.test(path.basename(filename)))))
    );
  };
}
module.exports = { validateFilters, compileFilters };
