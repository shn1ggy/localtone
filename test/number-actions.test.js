import test from 'node:test';
import assert from 'node:assert/strict';
import '../app/rules/number-actions.js';
const {canRenumber,numberActionNeeded,folderNumbers}=globalThis.LocaltoneNumbers;
const track=(id,album='Album')=>({id,album,folderKey:'library/artist',albumFolder:album,codec:'MP3',disc:1});
test('renumber requires a complete available album rather than search/playlist subsets or multiple albums',()=>{
 const a=track('a'),b=track('b'),c=track('c','Other'),all=[a,b,c];
 assert.equal(canRenumber([a,b],all),true);assert.equal(canRenumber([a],all),false);assert.equal(canRenumber([a,b,c],all),false);assert.equal(canRenumber([],all),false);assert.equal(canRenumber([a,b],[a,{...b,missing:true},c]),false);assert.equal(canRenumber([a,{...b,codec:'FLAC'}],all),false);
});
test('number commands enable for changes to either number component and remain disabled for matching tags',()=>{
 const check=(raw,mode)=>numberActionNeeded({trackRaw:raw},mode);
 assert.equal(check('01/09','pad'),false);assert.equal(check('01/9','pad'),true);assert.equal(check('1/09','pad'),true);assert.equal(check('10/19','pad'),false);
 assert.equal(check('1/9','unpad'),false);assert.equal(check('10/019','unpad'),true);
 assert.equal(check('01/09','total'),false);assert.equal(check('01','total'),true);assert.equal(check('01/00','total'),true);assert.equal(check('','total'),false);assert.equal(check('bad','pad'),false);
});
test('natural folder order renumbers each tagged disc independently, ignoring metadata track order',()=>{
 const a={...track('a'),artistPath:'Album/CD1/10 Song.mp3'},b={...track('b'),artistPath:'Album/CD1/2 Song.mp3'},c={...track('c'),disc:2,artistPath:'Album/CD2/1 Song.mp3'};
 assert.deepEqual([...folderNumbers([a,c,b])],[['b',1],['a',2],['c',1]]);
});

test('ignore discs creates one continuous folder sequence without mutating disc metadata',()=>{const tracks=[{...track('a'),artistPath:'CD1/1.mp3'},{...track('b'),disc:2,artistPath:'CD2/1.mp3'}];assert.deepEqual([...folderNumbers(tracks,true)],[['a',1],['b',2]]);assert.equal(tracks[1].disc,2);});

test('renumber repairs totals per disc and applies the shared leading-zero preference',()=>{
 const tracks=[{...track('a'),disc:1,artistPath:'CD1/2.mp3',trackRaw:'7/99'},{...track('b'),disc:1,artistPath:'CD1/1.mp3',trackRaw:'4/9'},{...track('c'),disc:2,artistPath:'CD2/1.mp3',trackRaw:''}];
 const tags=globalThis.LocaltoneNumbers.folderNumberTags;assert.deepEqual([...tags(tracks,{leadingZeros:true})],[['a','02/02'],['b','01/02'],['c','01/01']]);assert.deepEqual([...tags(tracks,{ignoreDiscs:true,leadingZeros:true})],[['a','02/03'],['b','01/03'],['c','03/03']]);assert.equal(tags(tracks).get('a'),'2/2');assert.equal(tags([{...tracks[0],trackRaw:'007/009'}]).get('a'),'001/001');assert.equal(tracks[0].trackRaw,'7/99');
});
