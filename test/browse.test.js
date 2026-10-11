import test from 'node:test';
import assert from 'node:assert/strict';
import { artistsFor, albumsFor } from '../app/browse.js';
const tracks=[
{id:'1',title:'One',artist:'A',albumArtist:'A',album:'Shared title',disc:2,track:1},
{id:'2',title:'Two',artist:'A',albumArtist:'A',album:'Shared title',disc:1,track:2},
{id:'3',title:'Three',artist:'B',albumArtist:'B',album:'Shared title',disc:1,track:1},
{id:'4',title:'Four',artist:'A',albumArtist:'Various Artists',album:'Compilation',disc:1,track:2},
{id:'5',title:'Five',artist:'C',albumArtist:'Various Artists',album:'Compilation',disc:1,track:1}].map(t=>({...t,folderKey:t.albumArtist,folderArtist:t.albumArtist,artistPath:t.id==='2'?'Album/01.mp3':t.id==='1'?'Album/02.mp3':t.title}));
test('artist list uses folder identity, not individual artist tags',()=>{assert.deepEqual(artistsFor(tracks),['A','B','Various Artists']);});
test('same album title by different artists stays separate; files use folder order rather than tag track numbers',()=>{const albums=albumsFor(tracks);assert.equal(albums.length,3);assert.deepEqual(albums.find(a=>a.artist==='A').tracks.map(t=>t.id),['2','1']);});
test('folder selection excludes tracks stored in other folders',()=>{const albums=albumsFor(tracks,'A');assert.equal(albums.length,1);assert.deepEqual(albums[0].tracks.map(t=>t.id),['2','1']);});
test('artists sort by total duration or reverse alphabetical name',()=>{const tracks=[{artist:'A',albumArtist:'A',duration:30},{artist:'A',albumArtist:'A',duration:90},{artist:'B',albumArtist:'B',duration:50}].map(t=>({...t,folderKey:t.artist,folderArtist:t.artist}));assert.deepEqual(artistsFor(tracks,'duration-desc'),['A','B']);assert.deepEqual(artistsFor(tracks,'duration'),['B','A']);assert.deepEqual(artistsFor(tracks,'name-desc'),['B','A']);});
test('album directories and nested filenames determine order even when year/track tags disagree',()=>{
 const tracks=[
 {id:'a',folderKey:'x',folderArtist:'Artist',albumFolder:'10 Later folder',artistPath:'10 Later folder/01.mp3',album:'Same tag',artist:'Tag',year:1900,track:1},
 {id:'b',folderKey:'x',folderArtist:'Artist',albumFolder:'2 Earlier folder',artistPath:'2 Earlier folder/CD2/01.mp3',album:'Same tag',artist:'Other tag',year:2025,track:1},
 {id:'c',folderKey:'x',folderArtist:'Artist',albumFolder:'2 Earlier folder',artistPath:'2 Earlier folder/CD1/10.mp3',album:'Different tag',artist:'Tag',year:2020,track:1},
 {id:'d',folderKey:'x',folderArtist:'Artist',albumFolder:'2 Earlier folder',artistPath:'2 Earlier folder/CD1/2.mp3',album:'Another tag',artist:'Tag',year:2021,track:99}];
 const albums=albumsFor(tracks,'x');assert.equal(albums.length,2);assert.equal(albums[0].folder,'2 Earlier folder');assert.deepEqual(albums[0].tracks.map(t=>t.id),['d','c','b']);
});

test('album sort uses album totals and average track ratings; random order remains stable for a seed',()=>{
 const tracks=[{id:'1',title:'One',folderKey:'artist',folderArtist:'Artist',album:'A',albumFolder:'a',artist:'Artist',year:2001,duration:40},{id:'2',title:'Two',folderKey:'artist',folderArtist:'Artist',album:'A',albumFolder:'a',artist:'Artist',year:2001,duration:40},{id:'3',title:'Three',folderKey:'artist',folderArtist:'Artist',album:'B',albumFolder:'b',artist:'Artist',year:1999,duration:60}];
 assert.deepEqual(albumsFor(tracks,null,'duration').map(a=>a.name),['B','A']);assert.deepEqual(albumsFor(tracks,null,'duration',-1).map(a=>a.name),['A','B']);assert.deepEqual(albumsFor(tracks,null,'year').map(a=>a.name),['B','A']);assert.deepEqual(albumsFor(tracks,null,'rating',1,{ratings:{1:5,2:1,3:4}}).map(a=>a.name),['A','B']);
 assert.deepEqual(albumsFor(tracks,null,'manual').map(a=>a.name),['A','B']);assert.deepEqual(albumsFor(tracks,null,'random',1,{seed:23}).map(a=>a.key),albumsFor(tracks.toReversed(),null,'random',1,{seed:23}).map(a=>a.key));
});
