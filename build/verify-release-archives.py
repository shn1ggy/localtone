"""Check the actual archived app files and matching decoder sources before publishing."""
import hashlib
import json
import pathlib
import sys
import tarfile
import zipfile

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
        for file, expected in manifest['files'].items():
            matches = [n for n in archive.namelist() if n == file or n.endswith('/' + file)]
            assert len(matches) == 1, 'Missing or ambiguous manifest file: ' + file
            assert hashlib.sha256(archive.read(matches[0])).hexdigest() == expected, file
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
