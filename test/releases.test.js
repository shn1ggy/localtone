import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { realpath, mkdtemp, mkdir, writeFile, readFile, readdir, rm, symlink } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { sourceFiles, sourceZip } from '../build/release.mjs';
const require = createRequire(import.meta.url);
const release = require('../release.cjs');
const { prepareUpdate } = require('../update-preparation.cjs');
async function fixture(fn) {
  const dir = await realpath(await mkdtemp(path.join(tmpdir(), 'localtone-release-')));
  try { await fn(dir); } finally { await rm(dir, { recursive: true, force: true }); }
}
async function sourceRelease(dir, version = '0.91.0') {
  await mkdir(path.join(dir, 'app'), { recursive: true });
  for (const name of ['package.json', 'main.cjs', 'app/index.html'])
    await writeFile(path.join(dir, name), name === 'package.json' ? JSON.stringify({name:'localtone',version}) : name);
  const manifest = await release.createManifest(dir, { version, kind:'source', platform:'any', arch:'any', entry:'main.cjs', files:['package.json','main.cjs','app/index.html'] });
  await writeFile(path.join(dir, 'localtone-release.json'), JSON.stringify(manifest));
  return manifest;
}
test('release inspection verifies newer versions and rejects corruption or path traversal', () => fixture(async dir => {
  const manifest = await sourceRelease(dir);
  assert.equal((await release.inspectRelease(dir, '0.90.0')).manifest.version, '0.91.0');
  await assert.rejects(release.inspectRelease(dir, '0.91.0'), /newer/);
  await writeFile(path.join(dir, 'main.cjs'), 'Corrupt');
  await assert.rejects(release.inspectRelease(dir, '0.90.0'), /verification failed/);
  manifest.files['../outside'] = 'a'.repeat(64);
  manifest.files['main.cjs'] = await release.digest(path.join(dir, 'main.cjs'));
  await writeFile(path.join(dir, 'localtone-release.json'), JSON.stringify(manifest));
  await assert.rejects(release.inspectRelease(dir, '0.90.0'), /file path/);
}));
test('release inspection rejects wrong desktop platform and missing checksum entries', () => fixture(async dir => {
  await mkdir(path.join(dir, 'resources'));
  await writeFile(path.join(dir, 'resources', 'app.asar'), 'Archive');
  await writeFile(path.join(dir, 'Localtone.exe'), 'Exe');
  const manifest = await release.createManifest(dir, {version:'0.91.0',kind:'desktop',platform:'win32',arch:'x64',entry:'Localtone.exe',files:['resources/app.asar']});
  await writeFile(path.join(dir, 'resources/localtone-release.json'), JSON.stringify(manifest));
  await assert.rejects(release.inspectRelease(dir,'0.90.0',{platform:'darwin',arch:'arm64'}),/different operating/);
  assert.equal((await release.inspectRelease(dir,'0.90.0',{platform:'win32',arch:'x64'})).entry,path.join(dir,'Localtone.exe'));
  manifest.files = {'Localtone.exe':await release.digest(path.join(dir,'Localtone.exe'))};
  await writeFile(path.join(dir, 'resources/localtone-release.json'), JSON.stringify(manifest));
  await assert.rejects(release.inspectRelease(dir,'0.90.0',{platform:'win32',arch:'x64'}),/missing required/);
}));
test('portable preparation preserves settings, collection, credentials and backups without copying session undo', () => fixture(async dir => {
  const source = path.join(dir,'old','Localtone-data'), target = path.join(dir,'new');
  await mkdir(source,{recursive:true});await mkdir(target);
  const data = JSON.stringify({libraries:[{id:'l',root:'/music'}],playlists:[{id:'p',trackIds:['t']}],settings:{accentColor:'#abcdef',sidebarWidth:242},tracks:[{id:'t'}]});
  await writeFile(path.join(source,'collection.json'),data);
  await writeFile(path.join(source,'lastfm.enc'),'Encrypted credentials',{mode:0o600});
  await mkdir(path.join(source,'settings-backups'));await writeFile(path.join(source,'settings-backups','before.json'),'Backup');
  await mkdir(path.join(source,'tag-backups'));await writeFile(path.join(source,'tag-backups','undo'),'Temporary');
  await mkdir(path.join(source,'session'));await writeFile(path.join(source,'session','lock'),'Runtime');
  const result = await prepareUpdate({source,targetRoot:target,portable:true,version:'0.91.0'});
  assert.equal(await readFile(path.join(result.target,'collection.json'),'utf8'),data);
  assert.equal(await readFile(path.join(source,'collection.json'),'utf8'),data);
  assert.equal(await readFile(path.join(result.target,'lastfm.enc'),'utf8'),'Encrypted credentials');
  assert.equal(await readFile(path.join(result.target,'settings-backups','before.json'),'utf8'),'Backup');
  assert.equal(JSON.parse(await readFile(path.join(result.target,'storage-mode.json'))).active,true);
  const names = await readdir(result.target);assert.ok(!names.includes('tag-backups'));assert.ok(!names.includes('session'));
  await assert.rejects(prepareUpdate({source,targetRoot:target,portable:true,version:'0.91.0'}),/already has/);
}));
test('system data mode remains system data after preparing a separate release', () => fixture(async dir => {
  const source=path.join(dir,'system'),target=path.join(dir,'new');await mkdir(source);await mkdir(target);
  await writeFile(path.join(source,'collection.json'),'Original');
  const result=await prepareUpdate({source,targetRoot:target,portable:false,version:'0.91.0'});
  assert.equal(JSON.parse(await readFile(path.join(result.target,'storage-mode.json'))).active,false);
  assert.ok(!(await readdir(result.target)).includes('collection.json'));
  assert.equal(await readFile(path.join(source,'collection.json'),'utf8'),'Original');
}));
test('failed preparation discards staging and never overwrites source or follows links', () => fixture(async dir => {
  const source=path.join(dir,'old'),target=path.join(dir,'new');await mkdir(source);await mkdir(target);
  await writeFile(path.join(source,'collection.json'),'Original');
  await symlink(path.join(source,'collection.json'),path.join(source,'lastfm.enc'));
  await assert.rejects(prepareUpdate({source,targetRoot:target,portable:true,version:'0.91.0'}),/link or special/);
  assert.deepEqual(await readdir(target),[]);
  assert.equal(await readFile(path.join(source,'collection.json'),'utf8'),'Original');
  await assert.rejects(prepareUpdate({source,targetRoot:source,portable:true,version:'0.91.0'}),/separate app/);
}));
test('source release inventory excludes dependencies and user data, and ZIP headers match payloads', () => fixture(async dir => {
  await writeFile(path.join(dir,'package.json'),'{}');
  for(const name of ['node_modules','Localtone-data','dist']){await mkdir(path.join(dir,name));await writeFile(path.join(dir,name,'private'),'Secret');}
  assert.deepEqual(await sourceFiles(dir),['package.json']);
  const zip=sourceZip([{name:'package.json',data:Buffer.from('{}')}]);
  assert.equal(zip.readUInt32LE(0),0x04034b50);assert.equal(zip.readUInt32LE(zip.length-22),0x06054b50);
  assert.equal(zip.readUInt16LE(zip.length-22+10),1);
  assert.equal(zip.subarray(30,30+zip.readUInt16LE(26)).toString(),'Localtone/package.json');
}));

test('release inspection resolves symlinked parent paths consistently',()=>fixture(async dir=>{
 const actual=path.join(dir,'actual'),alias=path.join(dir,'alias');await mkdir(actual);await sourceRelease(actual);await symlink(actual,alias,'dir');
 const result=await release.inspectRelease(alias,'0.90.0');assert.equal(result.entry,path.join(actual,'main.cjs'));
}));

test('source archives omit portable backups and signing secrets but retain GitHub project configuration',()=>fixture(async dir=>{
 for(const folder of ['Localtone-data.previous-abcd','local-data.previous-1234','app','build','My music','.github/workflows'])await mkdir(path.join(dir,folder),{recursive:true});
 for(const name of ['Localtone-data.previous-abcd/collection.json','local-data.previous-1234/lastfm.enc','.env','build/signing.p12','build/private.pem','collection.json','Localtone-settings.json','My music/private.mp3'])await writeFile(path.join(dir,name),'private');
 for(const name of ['package.json','app/index.html','.github/workflows/ci.yml','.gitignore','.gitattributes','.nvmrc'])await writeFile(path.join(dir,name),'project');
 assert.deepEqual((await sourceFiles(dir)).sort(),['.gitattributes','.github/workflows/ci.yml','.gitignore','.nvmrc','app/index.html','package.json'].sort());
}));
