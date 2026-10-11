const source = require('./source.json');
function verifyDecoder(versionOutput, provenance, hash) {
  if (/--enable-(?:nonfree|gpl|version3)(?:\s|$)/.test(versionOutput))
    throw Error('Release decoder contains prohibited nonfree or GPL-only build options.');
  if (!provenance || provenance.commit !== source.commit || provenance.sha256 !== hash)
    throw Error(
      'Release decoder needs matching pinned-source build provenance. Run the decoder source build first.',
    );
  if (!versionOutput.includes('--disable-autodetect') || !provenance.sourceArchive)
    throw Error('Release decoder is missing its controlled build configuration or source archive.');
  return provenance;
}
module.exports = { verifyDecoder };
