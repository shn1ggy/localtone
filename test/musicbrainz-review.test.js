import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {createTagEditor} from '../app/tag-editor.js';
const html=await readFile(new URL('../app/index.html',import.meta.url),'utf8');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function setup(api={}){
 const dom=new JSDOM(html),d=dom.window.document;for(const dialog of d.querySelectorAll('dialog')){dialog.showModal=()=>dialog.open=true;dialog.close=()=>{dialog.open=false;dialog.dispatchEvent(new dom.window.Event('close'));};}
 const tracks=[{id:'a',title:'First',album:'Old album',artist:'Old artist',codec:'MP3',disc:1},{id:'b',title:'Second',album:'Old album',artist:'Old artist',codec:'MP3',disc:1}],entries=tracks.map((t,i)=>({id:t.id,token:'token-'+t.id,values:{title:t.title,artist:t.artist,albumArtist:'',album:t.album,year:'2000',genre:'Keep genre',track:String(i+1),disc:'1'},extras:[]}));
 let saved,leading=false;const calls=[];
 const editor=createTagEditor({document:d,el:(tag,text,className)=>{const n=d.createElement(tag);if(className)n.className=className;if(text!=null)n.textContent=text;return n;},api:{readTagsBatch:async()=>entries,musicbrainzSearch:async()=>[{id:'release',title:'New album'}],musicbrainzRelease:async()=>({id:'release',title:'New album',artist:'New album artist',year:'2009',genre:'',discTotal:1,tracks:tracks.map((t,i)=>({key:'1:'+i,title:t.title,artist:'Artist '+i,disc:1,number:i+3,total:12}))}),writeTagsBatch:async(...args)=>{saved=args;return {state:{tracks},saved:args[0].map(e=>e.id),failures:[]};},...api},tagLabels:{title:'Title',artist:'Artist',albumArtist:'Album artist',album:'Album',year:'Year',genre:'Genre',track:'Track number',disc:'Disc number'},dialogs:{open:n=>n.showModal()},isBusy:()=>false,setAppBusy(){},currentTrack:()=>null,getTrack:()=>null,audio:{},applyTagState:value=>calls.push(value),toast(){},clearNotice(){},albumKey:t=>t.album,getLeadingZeros:()=>leading,saveLeadingZeros:v=>leading=v});
 const submit=()=>d.getElementById('tag-form').dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));
 return {dom,d,editor,tracks,entries,submit,get saved(){return saved;},calls,get leading(){return leading;},change(id,value){const n=d.getElementById(id);n.value=value;n.dispatchEvent(new dom.window.Event('change'));}};
}
test('one editor combines manual edits and per-file release proposals, preserving unchecked tags',async()=>{
 const f=setup();try{await f.editor.open(f.tracks);f.d.getElementById('tag-mb-toggle').click();await tick();assert.equal(f.d.getElementById('tag-mb-release').disabled,false);f.change('tag-mb-release','release');await tick();
  assert.equal(f.d.querySelectorAll('#tag-mb-tracks tr').length,2);assert.equal(f.d.querySelector('#tag-value-genre').closest('.tag-field-row').querySelector('.mb-use').disabled,true);
  for(const key of ['album','artist','year'])f.d.getElementById('tag-value-'+key).closest('.tag-field-row').querySelector('.mb-use').click();
  const proposal=f.d.getElementById('tag-value-year').closest('.tag-field-row').querySelector('.mb-proposal-value');proposal.value='2010';proposal.dispatchEvent(new f.dom.window.Event('input'));
  const local=f.d.getElementById('tag-value-genre');local.value='Manual genre';local.dispatchEvent(new f.dom.window.Event('input'));
  const zero=f.d.getElementById('tag-mb-zeros');zero.click();assert.equal(f.leading,true);f.submit();assert.equal(f.saved,undefined);assert.match(f.d.getElementById('tag-error').textContent,/2 files/);f.submit();await tick();
  assert.equal(f.saved[1].genre,'Manual genre');assert.deepEqual(f.saved[0].map(e=>e.patch),[{album:'New album',artist:'Artist 0',year:'2010',track:'03/12'},{album:'New album',artist:'Artist 1',year:'2010',track:'04/12'}]);assert.equal(f.d.getElementById('tag-dialog').open,false);
 }finally{f.editor.dispose();f.dom.window.close();}
});
test('search/release loading disables the dropdown, reports failures, retries and rejects stale responses',async()=>{
 let resolve,attempt=0;const f=setup({musicbrainzSearch:()=>++attempt===1?new Promise(r=>resolve=r):Promise.resolve([{id:'release',title:'Album'}])});try{
  await f.editor.open(f.tracks);f.d.getElementById('tag-mb-toggle').click();assert.equal(f.d.getElementById('tag-mb-release').disabled,true);assert.equal(f.d.getElementById('tag-mb-loading').hidden,false);f.d.getElementById('tag-dialog').close();resolve([{id:'stale',title:'Old'}]);await tick();
  await f.editor.open(f.tracks);f.d.getElementById('tag-mb-toggle').click();await tick();assert.equal(f.d.getElementById('tag-mb-release').options.length,2);assert.equal(f.d.getElementById('tag-mb-release').options[1].value,'release');assert.equal(f.d.getElementById('tag-mb-loading').hidden,true);
 }finally{f.editor.dispose();f.dom.window.close();}
 const bad=setup({musicbrainzSearch:async()=>{throw Error('Network unavailable');}});try{await bad.editor.open(bad.tracks);bad.d.getElementById('tag-mb-toggle').click();await tick();assert.match(bad.d.getElementById('tag-mb-status').textContent,/Network unavailable/);assert.equal(bad.d.getElementById('tag-mb-search').textContent,'Retry');assert.equal(bad.d.getElementById('tag-mb-search').disabled,false);}finally{bad.editor.dispose();bad.dom.window.close();}
});
test('album switching retains per-album reviews',async()=>{
 const f=setup();f.tracks[1].album='Other album';try{await f.editor.open(f.tracks);f.d.getElementById('tag-mb-toggle').click();await tick();f.change('tag-mb-release','release');await tick();const use=f.d.getElementById('tag-value-album').closest('.tag-field-row').querySelector('.mb-use');use.click();f.change('tag-mb-album','1');await tick();f.change('tag-mb-release','release');await tick();f.change('tag-mb-album','0');assert.equal(f.d.getElementById('tag-value-album').closest('.tag-field-row').querySelector('.mb-use').checked,true);
 }finally{f.editor.dispose();f.dom.window.close();}
});

test('unmatched files keep tags and numbers until a release track is explicitly chosen',async()=>{
 const f=setup({musicbrainzRelease:async()=>({id:'release',title:'New album',artist:'Artist',year:'2009',tracks:[{key:'1:7',title:'Different song',artist:'Artist',disc:1,number:7,total:19}],discTotal:1})});try{
 await f.editor.open(f.tracks);f.d.getElementById('tag-mb-toggle').click();await tick();f.change('tag-mb-release','release');await tick();
 assert.ok([...f.d.querySelectorAll('#tag-mb-tracks input')].every(n=>n.disabled&&!n.checked));f.submit();assert.equal(f.saved,undefined);assert.equal(f.d.getElementById('tag-dialog').open,false);
 await f.editor.open([f.tracks[0]]);f.d.getElementById('tag-mb-toggle').click();await tick();f.change('tag-mb-release','release');await tick();const match=f.d.querySelector('#tag-mb-tracks select');match.value='1:7';match.dispatchEvent(new f.dom.window.Event('change'));f.submit();await tick();assert.deepEqual(f.saved[0].map(e=>e.patch),[{track:'7/19'}]);assert.deepEqual(f.saved[1],{});
 }finally{f.editor.dispose();f.dom.window.close();}
});
test('release failure offers a working retry without repeating the search',async()=>{
 let calls=0,searches=0;const f=setup({musicbrainzSearch:async()=>{searches++;return [{id:'release',title:'Album'}];},musicbrainzRelease:async()=>{if(++calls===1)throw Error('Request timed out');return {id:'release',title:'Album',tracks:[],discTotal:1};}});try{
 await f.editor.open(f.tracks);f.d.getElementById('tag-mb-toggle').click();await tick();f.change('tag-mb-release','release');await tick();assert.equal(f.d.getElementById('tag-mb-search').textContent,'Retry');f.d.getElementById('tag-mb-search').click();await tick();assert.equal(searches,1);assert.equal(calls,2);assert.match(f.d.getElementById('tag-mb-status').textContent,/0 of 2 tracks matched/);
 }finally{f.editor.dispose();f.dom.window.close();}
});

test('an empty lookup is an explicit no-results state with no spinner or selectable release',async()=>{
 const f=setup({musicbrainzSearch:async()=>[]});try{await f.editor.open(f.tracks);f.d.getElementById('tag-mb-toggle').click();await tick();assert.match(f.d.getElementById('tag-mb-status').textContent,/No releases found/);assert.equal(f.d.getElementById('tag-mb-release').disabled,true);assert.equal(f.d.getElementById('tag-mb-loading').hidden,true);assert.equal(f.d.getElementById('tag-mb-search').disabled,false);}finally{f.editor.dispose();f.dom.window.close();}
});
