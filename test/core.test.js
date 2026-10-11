import test from 'node:test';
import assert from 'node:assert/strict';
import { selectTracks, formatTime } from '../app/core.js';
const track = (id, artist, year, libraryId = 'one') => ({ id, title: `Song ${id}`, artist, album: 'Album', year, genre: 'Ambient', disc: 1, track: Number(id), duration: 125, codec: 'FLAC', libraryId });
const state = { tracks: [track('1', 'B', 2001), track('2', 'A', 1999), track('3', 'C', 2020, 'two')], playlists: [{ id: 'p', trackIds: ['3', '1', 'missing'] }] };
test('search matches multiple tag terms and restricts library', () => { assert.deepEqual(selectTracks(state, { kind: 'library', id: 'one' }, 'ambient 1999').map(t => t.id), ['2']); });
test('year sorting is numeric in both directions', () => { assert.deepEqual(selectTracks(state, { kind: 'all' }, '', 'year', -1).map(t => t.id), ['3', '1', '2']); });
test('playlist order survives search and excludes missing tracks', () => { assert.deepEqual(selectTracks(state, { kind: 'playlist', id: 'p' }, '', 'manual').map(t => t.id), ['3','1']); assert.deepEqual(selectTracks(state, { kind: 'playlist', id: 'p' }, '2001', 'manual').map(t => t.id), ['1']); });
test('time formatting handles missing data', () => { assert.equal(formatTime(125), '2:05'); assert.equal(formatTime(NaN), '0:00'); });
test('opening artist chooses unique folders uniformly, restores last played, and handles none/empty/stale history',async()=>{
 const {openingArtist}=await import('../app/core.js');const tracks=[{id:'a',folderKey:'A'},{id:'b',folderKey:'A'},{id:'c',folderKey:'B'}];
 assert.equal(openingArtist(tracks,'random',null,()=>.75),'B');assert.equal(openingArtist(tracks,'last','a',()=>.75),'A');assert.equal(openingArtist(tracks,'last','missing',()=>.75),'B');assert.equal(openingArtist(tracks,'none','a'),null);assert.equal(openingArtist([],'random'),null);
});
test('duration formatting supports hours through 99:59:59',()=>{assert.equal(formatTime(3599),'59:59');assert.equal(formatTime(3600),'1:00:00');assert.equal(formatTime(359999),'99:59:59');});
test('field search supports phrases, exclusions, comparisons and boolean groups without changing plain text',()=>{
 const db={ratings:{a:5,b:3},tracks:[{...track('a','Nine Inch Nails',1994),album:'The Downward Spiral',genre:'Industrial rock'},{...track('b','Other',2001),genre:'Hip hop'},{...track('c','Third',1999),genre:'Ambient'}],playlists:[]};
 const ids=q=>selectTracks(db,{kind:'all'},q,'manual').map(t=>t.id);
 assert.deepEqual(ids('artist:"Nine Inch Nails" year:>=1994'),['a']);assert.deepEqual(ids('EXCEPT genre:"hip hop"'),['a','c']);assert.deepEqual(ids('rating:>=4 AND (genre:rock OR genre:ambient)'),['a']);assert.deepEqual(ids('year:1990-1999 NOT artist:third'),['a']);assert.deepEqual(ids('album: "Downward Spiral"'),['a']);assert.deepEqual(ids('-genre:"hip hop"'),['a','c']);assert.deepEqual(ids('artist:other OR artist:third AND year:1999'),['b','c']);assert.deepEqual(ids('Nine 1994'),['a']);assert.deepEqual(ids('rating:0'),['c']);assert.deepEqual(ids('year:nope'),[]);assert.deepEqual(ids('artist:"unfinished'),[]);assert.deepEqual(ids('(genre:rock OR genre:ambient'),[]);
});

test('artist grouping filters metadata names while keeping parent folder identities',async()=>{
 const {artistGroupKey,artistGroupName,selectTracks,openingArtist}=await import('../app/core.js');
 const tracks=[{id:'a',folderKey:'one',folderArtist:'Folder one',artist:'Guest A',albumArtist:'Various',album:'First',title:'A'},{id:'b',folderKey:'two',folderArtist:'Folder two',artist:'Guest B',albumArtist:'Various',album:'Second',title:'B'}];
 assert.equal(artistGroupName(tracks[0],'folder'),'Folder one');assert.equal(artistGroupKey(tracks[0],'albumArtist'),artistGroupKey(tracks[1],'albumArtist'));
 assert.deepEqual(selectTracks({tracks},{kind:'all'},'','manual',1,artistGroupKey(tracks[0],'albumArtist'),0,'albumArtist').map(t=>t.id),['a','b']);
 assert.deepEqual(selectTracks({tracks},{kind:'all'},'','manual',1,'one').map(t=>t.id),['a']);
 assert.equal(openingArtist(tracks,'last','b',Math.random,'artist'),'artist:Guest B');
 assert.equal(artistGroupName({artist:'Fallback'},'albumArtist'),'Fallback');
});


test('missing-tag searches inspect raw metadata, placeholders, numeric values and boolean expressions',async()=>{
 const {compileSearch}=await import('../app/core.js');
 const tracks=[{id:'a',track:7,trackRaw:'7/19',artist:'Folder fallback',year:0,genre:'',missingTags:['artist','year','genre']},{id:'b',track:7,trackRaw:'07',artist:'Tagged artist',year:2009,genre:'Jazz',missingTags:[]},{id:'c',track:10,trackRaw:'10/19',artist:'Tagged artist',year:2010,genre:'Jazz',missingTags:[]},{id:'d',track:1,trackRaw:'01/00',missingTags:[]}];
 const state={tracks,ratings:{b:4}};const ids=q=>{const search=compileSearch(q);assert.equal(search.error,null);return tracks.filter(t=>search.matches(t,state)).map(t=>t.id);};
 assert.deepEqual(ids('missing:leadingzeros'),['a']);assert.deepEqual(ids('missing:totaltracks'),['b','d']);assert.deepEqual(ids('missing:leadingzeros OR missing:totaltracks'),['a','b','d']);assert.deepEqual(ids('missing:year AND missing:artist'),['a','d']);assert.deepEqual(ids('rating:>=4 AND NOT missing:genre'),['b']);assert.equal(compileSearch('missing:nonexistent').matches(tracks[0],state),false);assert.match(compileSearch('missing:nonexistent').error,/Unknown/);
 assert.equal(compileSearch('missing:leadingzeros').matches({trackRaw:'10/9'},state),true);assert.equal(compileSearch('missing:track').matches({track:1,trackRaw:''},state),true);
});

test('dynamic Search expression uses the same parser and rejects invalid active queries',async()=>{
 const {compileSearch,validateDynamic,matchingTracks}=await import('../app/core.js'),state={tracks:[{id:'a',libraryId:'l',trackRaw:'7',year:2009},{id:'b',libraryId:'other',trackRaw:'07',year:2009},{id:'c',libraryId:'l',trackRaw:'07/19',year:2009}],ratings:{}};
 const dynamic=validateDynamic({enabled:true,libraryId:'l',match:'all',rules:[],mode:'search',query:'year:2009 AND missing:totaltracks'});
 assert.deepEqual(matchingTracks(state,dynamic).map(t=>t.id),['a']);assert.deepEqual(matchingTracks(state,dynamic),state.tracks.filter(t=>t.libraryId==='l'&&compileSearch(dynamic.query).matches(t,state)));
 assert.throws(()=>validateDynamic({...dynamic,query:'missing:unknown'}),/Unknown/);assert.throws(()=>validateDynamic({...dynamic,query:''}),/Enter/);assert.equal(validateDynamic({enabled:true,libraryId:'',match:'all',rules:[]}).mode,undefined);
});

test('single-track dynamic membership shares full-filter semantics without traversing the collection',async()=>{const {createRequire}=await import('node:module'),require=createRequire(import.meta.url),rules=require('../app/rules/playlist-rules.js');const track={id:'a',libraryId:'l',folderArtist:'Alpha',year:2009},state={ratings:{a:4},get tracks(){throw Error('Unexpected collection scan');}};for(const dynamic of [{enabled:true,libraryId:'l',match:'all',rules:[{field:'rating',op:'gte',value:4}]},{enabled:true,libraryId:'l',match:'all',rules:[],mode:'search',query:'folder:Alpha AND year:2009'}]){assert.equal(rules.matchesTrack(state,dynamic,track),true);assert.equal(rules.matchesTrack(state,{...dynamic,libraryId:'other'},track),false);}});
test('oversize searches fail clearly before building a predicate chain',async()=>{const {compileSearch}=await import('../app/core.js');const result=compileSearch('word '.repeat(1000));assert.match(result.error,/2000/);assert.equal(result.matches({title:'word'}),false);});

test('disc search distinguishes explicit tags from the untagged Disc 1 fallback',()=>{
 const tagged={id:'tagged',disc:2,discRaw:'02/03',title:'Song',artist:'Artist'},untagged={id:'untagged',disc:1,discRaw:'',title:'Other',artist:'Artist'};
 for(const query of ['has:disc','has:discnumber','NOT missing:disc','disc:>=2']) {const result=globalThis.LocaltoneSearch.compileSearch(query);assert.equal(result.error,null);assert.equal(result.matches(tagged,{}),true);assert.equal(result.matches(untagged,{}),false);}
 assert.equal(globalThis.LocaltoneSearch.compileSearch('missing:disc').matches(untagged,{}),true);
 assert.equal(globalThis.LocaltoneSearch.compileSearch('disc:1').matches(untagged,{}),false);
 assert.equal(globalThis.LocaltoneSearch.compileSearch('has:artist').matches(tagged,{}),true);
});
