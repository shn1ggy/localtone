import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {matchReleaseTrack,proposedTrackNumber} from '../app/album-number-lookup.js';
const {createMusicBrainz}=createRequire(import.meta.url)('../musicbrainz.cjs');
const id='59211ea4-ffd2-4ad9-9a4e-941d3148024a';
test('MusicBrainz search escapes names, caches results, serializes requests and counts per disc',async()=>{
 let clock=0;const calls=[],waits=[];
 const service=createMusicBrainz({now:()=>clock,wait:async ms=>{waits.push(ms);clock+=ms;},fetch:async(url,options)=>{calls.push({url,options,clock});return {ok:true,json:async()=>url.includes('/release/'+id)?{id,title:'Album',media:[{position:1,'track-count':12,tracks:[{position:7,title:'Only song',length:200000}]},{position:2,'track-count':5,tracks:[{position:3,title:'Bonus',length:100000}]}]}:{releases:[{id,title:'Album','artist-credit':[{name:'Artist'}],'track-count':17,media:[{format:'CD'}]}]}};}});
 const query={album:'Album " deluxe',artist:'Artist'};const [a,b]=await Promise.all([service.search(query),service.search(query)]);assert.deepEqual(a,b);assert.equal(calls.length,1);assert.match(new URL(calls[0].url).searchParams.get('query'),/release:"Album \\" deluxe" AND artist:"Artist"/);assert.equal(calls[0].options.headers['User-Agent'],`Localtone/${createRequire(import.meta.url)('../package.json').version} (https://github.com/shn1ggy/localtone)`);
 const release=await service.release(id);assert.deepEqual(waits,[1100]);assert.equal(release.tracks[0].number,7);assert.equal(release.tracks[0].total,12);assert.equal(release.tracks[1].total,5);assert.equal(release.tracks[1].disc,2);await assert.rejects(service.release('../../anything'),/Invalid/);
});
test('failed MusicBrainz requests can be retried and report throttling',async()=>{let n=0;const service=createMusicBrainz({wait:async()=>{},fetch:async()=>++n===1?{ok:false,status:503}:{ok:true,json:async()=>({releases:[]})}});await assert.rejects(service.search({album:'Album',artist:'Artist'}),/busy/);assert.deepEqual(await service.search({album:'Album',artist:'Artist'}),[]);});
test('partial album matching uses exact titles, avoids ambiguity and preserves zero padding',()=>{const tracks=[{key:'1:7',title:'Only Song',disc:1,number:7,total:19}];assert.equal(matchReleaseTrack({title:'Only song'},tracks),tracks[0]);assert.equal(proposedTrackNumber('01/1',tracks[0]),'07/19');assert.equal(proposedTrackNumber('1',tracks[0]),'7/19');assert.equal(matchReleaseTrack({title:'Different song'},tracks),null);assert.equal(matchReleaseTrack({title:'Only Song'},[...tracks,{...tracks[0],key:'1:8',number:8}]),null);});

test('leading-zero proposals pad number and total consistently',()=>{assert.equal(proposedTrackNumber('1',{number:7,total:9},true),'07/09');assert.equal(proposedTrackNumber('',{number:7,total:120},true),'007/120');});

test('release proposals include credited artists, release year, disc count and available genres',async()=>{
 const service=createMusicBrainz({fetch:async()=>({ok:true,json:async()=>({id,title:'Album',date:'2009-03-04','artist-credit':[{name:'Album artist'}],genres:[],'release-group':{genres:[{name:'ambient',count:2},{name:'rock',count:5}]},media:[{position:1,'track-count':1,tracks:[{position:1,title:'Song','artist-credit':[{name:'Guest'},{name:'Artist',joinphrase:''}]}]},{position:2,'track-count':1,tracks:[{position:1,title:'Bonus'}]}]})})});
 const release=await service.release(id);assert.equal(release.artist,'Album artist');assert.equal(release.year,'2009');assert.equal(release.discTotal,2);assert.equal(release.genre,'rock, ambient');assert.equal(release.tracks[0].artist,'GuestArtist');assert.equal(release.tracks[1].artist,'Album artist');
});
