"""Check the actual archived app files and matching decoder sources before publishing."""
import hashlib
import json
import pathlib
import sys
import tarfile
import zipfile

def verify_manifest(archive, manifest_name, manifest):
    if manifest['kind'] == 'source':
        prefix = manifest_name[:-len('localtone-release.json')]
    else:
        suffix = ('Contents/Resources/' if manifest['platform'] == 'darwin' else 'resources/') + 'localtone-release.json'
        assert manifest_name.endswith(suffix)
        prefix = manifest_name[:-len(suffix)]
    for file, expected in manifest['files'].items():
        name = prefix + file
        assert archive.namelist().count(name) == 1, 'Missing or ambiguous manifest file: ' + file
        assert hashlib.sha256(archive.read(name)).hexdigest() == expected, file

if sys.argv[1] == '--self-test':
    import io
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, 'w') as archive:
        archive.writestr('Localtone/package.json', b'root')
        archive.writestr('Localtone/app/rules/package.json', b'nested')
    with zipfile.ZipFile(buffer) as archive:
        verify_manifest(archive, 'Localtone/localtone-release.json', {'kind': 'source', 'files': {'package.json': hashlib.sha256(b'root').hexdigest()}})
    print('Source archive root regression check passed.')
    sys.exit(0)

root = pathlib.Path(sys.argv[1])
plan = json.loads((pathlib.Path(__file__).parent / 'release-plan.json').read_text())
provenance = {}
for source in root.glob('*-ffmpeg-source-*.tar.gz'):
    with tarfile.open(source, 'r:gz') as archive:
        names = archive.getnames()
        assert 'COPYING.LGPLv2.1' in names
        record = json.load(archive.extractfile('Localtone-build/provenance.json'))
        assert record['sourceArchive'] == source.name
        assert record['commit'] == json.loads((pathlib.Path(__file__).parent / 'ffmpeg/source.json').read_text())['commit']
        provenance[(record['platform'], record['arch'])] = record
        for item in archive.getmembers():
            if item.isfile():
                archive.extractfile(item).read()

checked = set()
for app in root.glob('*.zip'):
    with zipfile.ZipFile(app) as archive:
        assert archive.testzip() is None, 'Invalid ZIP CRC: ' + app.name
        manifest_name = next(n for n in archive.namelist() if n.endswith('localtone-release.json'))
        manifest = json.loads(archive.read(manifest_name))
        assert manifest['version'] == plan['version']
        verify_manifest(archive, manifest_name, manifest)
        if manifest['kind'] == 'desktop':
            audit = json.loads(archive.read(next(n for n in archive.namelist() if n.endswith('localtone-build-audit.json'))))
            assert not audit['packagesWithoutNotice'], audit['packagesWithoutNotice']
            target = (audit['platform'], audit['arch'])
            assert target not in checked
            checked.add(target)
            record = provenance[target]
            decoder = next(n for n in archive.namelist() if n.endswith('/ffmpeg-static/ffmpeg') or n.endswith('/ffmpeg-static/ffmpeg.exe'))
            assert hashlib.sha256(archive.read(decoder)).hexdigest() == audit['ffmpeg']['sha256'] == record['sha256']
            assert '--enable-nonfree' not in audit['ffmpeg']['versionOutput']
        print('Verified archived release:', app.name)
assert checked == {('darwin', 'arm64'), ('darwin', 'x64'), ('win32', 'x64'), ('linux', 'x64')}
print('All desktop/source archives, internal update manifests and dependency notices verified.')
