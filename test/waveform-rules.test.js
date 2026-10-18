import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {WaveformService} from '../src/waveform.cjs';
import {waveformPath} from '../app/waveform-view.js';
import {validateDynamic,matchingTracks,playlistTracks} from '../app/core.js';
test('dynamic rules combine ratings, tags and sources, and reflect later edits',()=>{
 const state={libraries:[{id:'l'},{id:'other'}],tracks:[{id:'a',libraryId:'l',genre:'Ambient',year:2000},{id:'b',libraryId:'l',genre:'Rock',year:2020},{id:'c',libraryId:'other',genre:'Ambient',year:2021}],ratings:{a:4,b:3,c:5}};
 const dynamic=validateDynamic({enabled:true,libraryId:'l',match:'all',rules:[{field:'rating',op:'gte',value:4},{field:'genre',op:'is',value:'ambient'}]});
 assert.deepEqual(matchingTracks(state,dynamic).map(t=>t.id),['a']);state.ratings.a=2;assert.equal(playlistTracks(state,{dynamic}).length,0);
 dynamic.match='any';assert.deepEqual(matchingTracks(state,dynamic).map(t=>t.id),['a']);dynamic.rules.push({field:'year',op:'gte',value:2010});assert.equal(matchingTracks(state,dynamic).length,2);
 assert.throws(()=>validateDynamic({...dynamic,rules:[{field:'rating',op:'gte',value:3.5}]}));assert.throws(()=>validateDynamic({...dynamic,rules:[{field:'path',op:'contains',value:'x'}]}));
});
test('real decoder preserves music and captures changing amplitude; cache works without decoder',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'localtone-wave-'));try{
 const rate=22050,n=rate*2,b=Buffer.alloc(44+n*2);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(rate,24);b.writeUInt32LE(rate*2,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(n*2,40);
 for(let i=0;i<n;i++)b.writeInt16LE(Math.round(Math.sin(i*2*Math.PI*440/rate)*(i<rate?1000:24000)),44+i*2);
 const file=path.join(dir,'tone.wav');await writeFile(file,b);const service=new WaveformService(path.join(dir,'cache')),track={path:file,duration:2};const peaks=await service.get(track);
 assert.equal(peaks.length,1600);assert.ok(peaks.every(v=>Number.isFinite(v)&&v>=0&&v<=1));assert.ok(Math.max(...peaks.slice(0,700))*10<Math.max(...peaks.slice(900)));assert.deepEqual(await readFile(file),b);
 service.binary='/nonexistent/decoder';assert.deepEqual(await service.get(track),peaks);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('waveform styles generate finite shapes and normalization is optional',()=>{
 const peaks=Array(1600).fill(.2);const normalized=waveformPath(peaks),raw=waveformPath(peaks,'bars',false);assert.notEqual(normalized,raw);assert.match(normalized,/V98.00/);assert.match(waveformPath(peaks,'solid'),/Z$/);assert.doesNotMatch(waveformPath(peaks,'outline'),/NaN|Infinity/);
});
test('empty rules include unrated and genuinely missing tags, not display fallbacks',()=>{
 const state={libraries:[{id:'l'}],ratings:{b:4},tracks:[{id:'a',libraryId:'l',title:'file name',artist:'Unknown artist',year:'',missingTags:['title','artist']},{id:'b',libraryId:'l',title:'Named',artist:'Unknown artist',year:2000,missingTags:[]}]};
 const dynamic=op=>validateDynamic({enabled:true,libraryId:'',match:'all',rules:[op]});
 for(const field of ['rating','title','artist','year']){assert.deepEqual(matchingTracks(state,dynamic({field,op:'isEmpty'})).map(t=>t.id),['a']);assert.deepEqual(matchingTracks(state,dynamic({field,op:'isNotEmpty'})).map(t=>t.id),['b']);}
});
test('date filters use inclusive bounds, moving windows, empty unknown dates and reject bad input',()=>{
 const now=new Date(2026,9,6,12).getTime(),day=86400000,state={libraries:[{id:'l'}],tracks:[{id:'recent',libraryId:'l',addedAt:now-13*day},{id:'edge',libraryId:'l',addedAt:now-14*day},{id:'old',libraryId:'l',addedAt:now-15*day},{id:'unknown',libraryId:'l',addedAt:null},{id:'future',libraryId:'l',addedAt:now+day}]};
 const dynamic=rule=>validateDynamic({enabled:true,libraryId:'',match:'all',rules:[{field:'addedAt',...rule}]});
 const window=dynamic({op:'inLast',value:{amount:2,unit:'weeks'}});assert.deepEqual(matchingTracks(state,window,now).map(t=>t.id),['recent','edge']);assert.deepEqual(matchingTracks(state,window,now+day).map(t=>t.id),['recent','future']);
 assert.deepEqual(matchingTracks(state,dynamic({op:'olderThan',value:{amount:2,unit:'weeks'}}),now).map(t=>t.id),['old']);assert.deepEqual(matchingTracks(state,dynamic({op:'isEmpty'}),now).map(t=>t.id),['unknown']);
 const range={libraries:[{id:'l'}],tracks:[{id:'before',libraryId:'l',addedAt:new Date(2026,8,30,23,59).getTime()},{id:'start',libraryId:'l',addedAt:new Date(2026,9,1).getTime()},{id:'end',libraryId:'l',addedAt:new Date(2026,9,2,23,59).getTime()},{id:'after',libraryId:'l',addedAt:new Date(2026,9,3).getTime()}]};
 assert.deepEqual(matchingTracks(range,dynamic({op:'between',value:['2026-10-01','2026-10-02']})).map(t=>t.id),['start','end']);
 for(const rule of [{op:'onOrAfter',value:'2026-02-30'},{op:'between',value:['2026-10-02','2026-10-01']},{op:'inLast',value:{amount:-1,unit:'weeks'}}])assert.throws(()=>dynamic(rule));
});

test('compiled dynamic rules reflect edits, live ratings, empty tags and advancing relative dates',()=>{
 const now=Date.UTC(2026,9,9),state={libraries:[{id:'l'}],tracks:[{id:'a',libraryId:'l',title:'Ambient',genre:'Ambient',addedAt:now-86400000},{id:'b',libraryId:'l',title:'Rock',genre:'Rock',addedAt:now-5*86400000}],ratings:{a:5,b:0}},dynamic={libraryId:'',match:'all',rules:[{field:'rating',op:'gte',value:4},{field:'addedAt',op:'inLast',value:{amount:2,unit:'days'}}]};
 assert.deepEqual(matchingTracks(state,dynamic,now).map(t=>t.id),['a']);assert.deepEqual(matchingTracks(state,dynamic,now+3*86400000),[]);
 state.ratings.a=1;assert.deepEqual(matchingTracks(state,dynamic,now),[]);dynamic.rules[0].value=1;assert.deepEqual(matchingTracks(state,dynamic,now).map(t=>t.id),['a']);
 dynamic.rules=[{field:'genre',op:'contains',value:'ROCK'}];assert.deepEqual(matchingTracks(state,dynamic,now).map(t=>t.id),['b']);dynamic.rules[0].value='ambient';assert.deepEqual(matchingTracks(state,dynamic,now).map(t=>t.id),['a']);
 dynamic.rules=[{field:'rating',op:'isEmpty'}];assert.deepEqual(matchingTracks(state,dynamic,now).map(t=>t.id),['b']);
});

 test('dynamic sources exclude Finder-only containers and orphan tracks for rules and search',()=>{
 const state={libraries:[{id:'l'},{id:'imported',importedFiles:true}],tracks:[{id:'library',libraryId:'l',disc:2,discRaw:'02/03'},{id:'finder',libraryId:'imported',disc:2,discRaw:'02'},{id:'orphan',libraryId:'deleted',disc:2}],ratings:{}};
 for(const mode of ['rules','search']){const dynamic=validateDynamic({enabled:true,libraryId:'',match:'all',mode,query:'disc:2',rules:[{field:'disc',op:'eq',value:2}]});assert.deepEqual(matchingTracks(state,dynamic).map(t=>t.id),['library']);for(const track of state.tracks)assert.equal(globalThis.LocaltoneRules.matchesTrack(state,dynamic,track),track.id==='library');assert.deepEqual(matchingTracks(state,{...dynamic,libraryId:'imported'}),[]);}
 const regular={trackIds:['finder']};assert.deepEqual(playlistTracks(state,regular).map(t=>t.id),['finder']);
 });
 test('disc rules support comparisons and explicit missing tags without Disc 1 fallback',()=>{
 const state={libraries:[{id:'l'}],tracks:[{id:'tagged',libraryId:'l',disc:2,discRaw:'02/03'},{id:'missing',libraryId:'l',disc:1,discRaw:''}]};
 for(const [rule,expected] of [[{field:'disc',op:'gte',value:2},['tagged']],[{field:'disc',op:'isEmpty'},['missing']],[{field:'disc',op:'isNotEmpty'},['tagged']]]){const dynamic=validateDynamic({enabled:true,libraryId:'',match:'all',rules:[rule]});assert.deepEqual(matchingTracks(state,dynamic).map(t=>t.id),expected);}
 });
