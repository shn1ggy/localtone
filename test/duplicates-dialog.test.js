import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {createDuplicatesDialog} from '../app/duplicates-dialog.js';
const html=await readFile(new URL('../app/index.html',import.meta.url),'utf8'),tick=()=>new Promise(r=>setImmediate(r));
test('duplicate switches begin off, keep one copy and pass only enabled removal ids',async()=>{
 const dom=new JSDOM(html),d=dom.window.document,dialog=d.getElementById('duplicates-dialog');let removed,applied;
 const editor=createDuplicatesDialog({document:d,api:{findDuplicates:async()=>({token:'t',mode:'exact',groups:[{items:['a','b'].map(id=>({id,path:'/Music/'+id+'.mp3',artist:'Artist',title:'Song'}))}]}),removeDuplicates:async(token,ids)=>{removed={token,ids};return {removed:ids,failures:[],state:{tracks:[]}};}},dialogs:{open:n=>n.open=true},releaseTrack:(_ids,work)=>work(),applyState:state=>applied=state});
 try{editor.open();d.getElementById('duplicates-scan').click();await tick();const switches=d.querySelectorAll('#duplicates-list input');assert.equal(switches.length,2);assert.ok([...switches].every(n=>!n.checked));assert.equal(d.getElementById('duplicates-remove').disabled,true);switches[0].click();switches[1].click();assert.equal(switches[0].checked,false);assert.equal(switches[1].checked,true);assert.match(d.getElementById('duplicates-status').textContent,/At least one/);d.getElementById('duplicates-remove').click();await tick();assert.deepEqual(removed,{token:'t',ids:['b']});assert.deepEqual(applied,{tracks:[]});assert.equal(d.getElementById('duplicates-remove').disabled,true);assert.match(d.getElementById('duplicates-status').textContent,/1 files moved/);
 }finally{dom.window.close();}
});
