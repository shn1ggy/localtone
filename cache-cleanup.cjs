const fs = require('node:fs/promises'),
  path = require('node:path'),
  { waveformCacheKey } = require('./waveform.cjs');
async function cleanUnusedCache(root, tracks, activeWaveformKey) {
  const coverIds = new Set(tracks.filter((t) => t.cover).map((t) => t.id));
  const waveKeys = new Set(tracks.map((t) => waveformCacheKey(t) + '.json'));
  if (activeWaveformKey) waveKeys.add(activeWaveformKey + '.json');
  let files = 0,
    bytes = 0;
  for (const [name, keep, pattern] of [
    ['covers', coverIds, /^[a-f0-9]{64}$/],
    ['waveforms', waveKeys, /^[a-f0-9]{64}\.json$/],
  ]) {
    const dir = path.join(root, name);
    let entries;
    try {
      const info = await fs.lstat(dir);
      if (info.isSymbolicLink() || !info.isDirectory())
        throw Error('Cache folder is not a regular directory.');
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch (error) {
      if (error.code === 'ENOENT') continue;
      throw error;
    }
    for (const entry of entries) {
      if (!entry.isFile() || !pattern.test(entry.name) || keep.has(entry.name)) continue;
      const file = path.join(dir, entry.name);
      try {
        const info = await fs.lstat(file);
        if (!info.isFile() || info.isSymbolicLink()) continue;
        await fs.unlink(file);
        files++;
        bytes += info.size;
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
    }
  }
  return { files, bytes };
}
module.exports = { cleanUnusedCache };
