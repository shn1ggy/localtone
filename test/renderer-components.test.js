import {readFile} from 'node:fs/promises';
import {createWindowPresentation} from '../app/window-presentation.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {createAudioOutputSettings} from '../app/audio-output-settings.js';
import {mountVirtualTracks} from '../app/virtual-tracks.js';

test('audio output controller releases device listeners and ignores in-flight enumeration after disposal',async()=>{
 const dom=new JSDOM('<select id="setting-audioOutput"><option>Original</option></select><p id="audio-output-status"></p><button id="refresh-audio"></button>');const document=dom.window.document;let resolve,listener,removed,calls=0;
 const mediaDevices={enumerateDevices:()=>new Promise(r=>{resolve=r;}),addEventListener:(name,fn)=>{listener=fn;},removeEventListener:(name,fn)=>{removed=fn;}};
 const controller=createAudioOutputSettings({document,navigator:{mediaDevices},audio:{setSinkId:async()=>calls++},getPreferences:()=>({}),updateSettings:async()=>{}});
 try{const pending=controller.refresh();await Promise.resolve();controller.dispose();resolve([{kind:'audiooutput',deviceId:'speakers',label:'Speakers'}]);await pending;assert.equal(removed,listener);assert.equal(calls,0);assert.equal(document.querySelector('option').textContent,'Original');assert.equal(document.querySelector('select').onchange,null);assert.equal(document.querySelector('button').onclick,null);}finally{dom.window.close();}
});

test('virtual table disposal cancels pending paint and detaches its listeners',()=>{
 const dom=new JSDOM('<div id="scroll"><table><thead></thead><tbody></tbody></table></div>'),window=dom.window,document=window.document;let frame,removed=0;
 window.requestAnimationFrame=fn=>{frame=fn;return 7;};window.cancelAnimationFrame=id=>{assert.equal(id,7);frame=null;};
 const scroller=document.getElementById('scroll'),table=document.querySelector('table'),body=table.tBodies[0],original=scroller.removeEventListener.bind(scroller);scroller.removeEventListener=(...args)=>{removed++;original(...args);};
 const controller=mountVirtualTracks({window,document,table,body,head:table.tHead,scroller,tracks:Array.from({length:5000},(_,i)=>({id:String(i)})),columnCount:1,createRow:track=>{const row=document.createElement('tr');row.dataset.id=track.id;return row;}});
 try{assert.ok(body.children.length<100);scroller.dispatchEvent(new window.Event('scroll'));assert.ok(frame);controller.dispose();controller.dispose();assert.equal(frame,null);assert.equal(removed,1);scroller.dispatchEvent(new window.Event('scroll'));assert.equal(frame,null);}finally{window.close();}
});

test('dialog lifecycle guards backdrop dismissal, restores captured focus once and disposes listeners',async()=>{
 const {createDialogCoordinator}=await import('../app/dialog-coordinator.js');
 const dom=new JSDOM('<dialog></dialog>'),document=dom.window.document,dialog=document.querySelector('dialog');let blocked=true,restored=0,closed=0;
 dialog.showModal=()=>{dialog.open=true;};dialog.close=()=>{dialog.open=false;dialog.dispatchEvent(new dom.window.Event('close'));};dialog.getBoundingClientRect=()=>({left:10,right:100,top:10,bottom:100});
 const context={pane:'artists'},controller=createDialogCoordinator({document,captureFocus:()=>context,restoreFocus:value=>{assert.equal(value,context);restored++;},canDismiss:()=>!blocked,onClose:()=>closed++});
 const outside=()=>{for(const type of ['pointerdown','click'])dialog.dispatchEvent(new dom.window.MouseEvent(type,{clientX:0,clientY:0}));};
 try{controller.open(dialog);outside();assert.equal(dialog.open,true);blocked=false;outside();assert.equal(dialog.open,false);assert.equal(restored,1);assert.equal(closed,1);dialog.dispatchEvent(new dom.window.Event('close'));assert.equal(restored,1);controller.open(dialog);controller.dispose();outside();assert.equal(dialog.open,true);dialog.close();assert.equal(restored,1);}finally{dom.window.close();}
});

test('settings tabs wrap by keyboard, preserve the selected tab and stop responding after disposal',async()=>{
 const {createSettingsTabs}=await import('../app/settings-tabs.js');
 const dom=new JSDOM('<div class="settings-tabs"><button role="tab" id="settings-tab-general" aria-controls="general"></button><button role="tab" id="settings-tab-audio" aria-controls="audio"></button></div><div class="settings-panels"><section id="general"></section><section id="audio"></section></div>'),document=dom.window.document,selected=[];
 const tabs=createSettingsTabs({document,onSelect:key=>selected.push(key)}),general=document.getElementById('settings-tab-general'),audio=document.getElementById('settings-tab-audio');
 try{general.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'ArrowLeft',cancelable:true}));assert.equal(tabs.current,'audio');assert.equal(document.getElementById('general').hidden,true);assert.equal(document.activeElement,audio);tabs.select(tabs.current);assert.equal(tabs.current,'audio');tabs.dispose();general.click();assert.equal(tabs.current,'audio');assert.deepEqual(selected,['audio','audio']);}finally{dom.window.close();}
});

test('failed old settings save cannot roll back a newer identical choice',async()=>{
 const {createSettingsWrites}=await import('../app/settings-writes.js');let prefs={volume:.5},writes=[],errors=[];
 const controller=createSettingsWrites({getPreferences:()=>prefs,setPreferences:v=>prefs=v,isBusy:()=>false,apply(){},clearError(){},showError:v=>errors.push(v),write:()=>new Promise((resolve,reject)=>writes.push({resolve,reject}))});
 const first=controller.update({volume:.8}),second=controller.update({volume:.8});writes[0].reject(new Error('Old failure'));await first;assert.equal(prefs.volume,.8);writes[1].resolve();await second;assert.deepEqual(errors,['Old failure']);
 const third=controller.update({volume:.2});writes[2].reject(new Error('Latest failure'));await third;assert.equal(prefs.volume,.8);
});

test('disposed Last.fm settings do not repaint after a delayed request',async()=>{
 const {createLastfmSettings}=await import('../app/lastfm-settings.js');
 const ids=['status','enabled','connect','finish','disconnect','retry','key','secret','error','save','api'];const dom=new JSDOM('<div id="lastfm-settings">'+ids.map(id=>`<button id="lastfm-${id}">Original</button>`).join('')+'</div>');let complete,notifications=0;
 const controller=createLastfmSettings({document:dom.window.document,api:{lastfm:()=>new Promise(r=>complete=r)},confirm:()=>true,onStatus:()=>notifications++});
 try{const pending=controller.refresh();controller.dispose();complete({connected:true,username:'User'});await pending;assert.equal(notifications,0);assert.equal(dom.window.document.getElementById('lastfm-status').textContent,'Original');}finally{dom.window.close();}
});

test('tag editor ignores a delayed metadata read after disposal',async()=>{
 const {createTagEditor}=await import('../app/tag-editor.js');const dom=new JSDOM('<dialog id="tag-dialog"></dialog><div id="tag-fields"></div><div id="tag-error"></div><button id="tag-save"></button><span id="tag-count"></span><button id="tag-close"></button><button id="tag-cancel"></button><button id="show-backups"></button><form id="tag-form"></form>');let complete,opened=0;
 const editor=createTagEditor({document:dom.window.document,api:{readTagsBatch:()=>new Promise(resolve=>complete=resolve)},el(){},tagLabels:{},dialogs:{open:()=>opened++},isBusy:()=>false,toast(){}});
 try{const pending=editor.open([{id:'a'}]);editor.dispose();complete([{id:'a',values:{}}]);await pending;assert.equal(opened,1);assert.equal(dom.window.document.getElementById('tag-fields').children.length,0);}finally{dom.window.close();}
});

test('tag editor opens immediately and does not populate a window closed while reading',async()=>{
 const {createTagEditor}=await import('../app/tag-editor.js'),{readFile}=await import('node:fs/promises');const html=await readFile(new URL('../app/index.html',import.meta.url),'utf8'),dom=new JSDOM(html),d=dom.window.document;let complete;
 const el=(tag,text)=>{const node=d.createElement(tag);if(text)node.textContent=text;return node;};
 const editor=createTagEditor({document:d,api:{readTagsBatch:()=>new Promise(resolve=>complete=resolve)},el,tagLabels:{title:'Title'},dialogs:{open:node=>node.open=true},isBusy:()=>false,toast(){}});
 try{const pending=editor.open([{id:'a'},{id:'b'}]);assert.equal(d.getElementById('tag-dialog').open,true);assert.equal(d.getElementById('tag-save').disabled,true);assert.match(d.getElementById('tag-count').textContent,/Loading 2 files/);d.getElementById('tag-dialog').open=false;complete([{id:'a',values:{title:'Old'}},{id:'b',values:{title:'Other'}}]);await pending;assert.equal(d.getElementById('tag-dialog').open,false);assert.equal(d.querySelectorAll('#tag-fields input').length,0);}finally{editor.dispose();dom.window.close();}
});

test('queue silently overlays when the desktop cannot accommodate extension',async()=>{
 const html=await readFile(new URL('../app/index.html',import.meta.url),'utf8'),dom=new JSDOM(html),messages=[];
 const controller=createWindowPresentation({document:dom.window.document,window:dom.window,api:{windowAction:async()=>false},getPreferences:()=>({queuePresentation:'extend'}),syncPaneBounds(){},toast:message=>messages.push(message)});
 try{await controller.setQueueVisible(true);assert.equal(dom.window.document.getElementById('queue-panel').hidden,false);assert.equal(dom.window.document.body.classList.contains('queue-extended'),false);assert.deepEqual(messages,[]);}finally{controller.dispose();dom.window.close();}
});

test('tag editor independently remembers collapsed fields and track numbers without discarding edits',async()=>{const {createTagEditor}=await import('../app/tag-editor.js');const html=await readFile(new URL('../app/index.html',import.meta.url),'utf8'),dom=new JSDOM(html),d=dom.window.document,prefs={tagFieldsExpanded:true,tagNumbersExpanded:true},changes=[];const el=(tag,text)=>{const n=d.createElement(tag);if(text)n.textContent=text;return n;};const editor=createTagEditor({document:d,api:{readTagsBatch:async()=>[{id:'a',values:{title:'Song'},extras:[]}]},el,tagLabels:{title:'Title'},dialogs:{open:n=>n.open=true},isBusy:()=>false,toast(){},getSections:()=>prefs,saveSections:patch=>{Object.assign(prefs,patch);changes.push(patch);},getLeadingZeros:()=>false});try{await editor.open([{id:'a',title:'Song'}]);const fields=d.getElementById('tag-standard-fields'),numbers=d.getElementById('tag-mb-numbers');const input=d.getElementById('tag-value-title');input.value='Edited';input.dispatchEvent(new dom.window.Event('input'));fields.open=false;fields.dispatchEvent(new dom.window.Event('toggle'));numbers.open=false;numbers.dispatchEvent(new dom.window.Event('toggle'));assert.equal(input.dataset.changed,'true');assert.equal(input.value,'Edited');assert.deepEqual(prefs,{tagFieldsExpanded:false,tagNumbersExpanded:false});d.getElementById('tag-dialog').open=false;await editor.open([{id:'a',title:'Song'}]);assert.equal(fields.open,false);assert.equal(numbers.open,false);assert.equal(changes.length,2);}finally{editor.dispose();dom.window.close();}});

test('tag saves use the shared playback release helper and never reset the player directly',async()=>{const {createTagEditor}=await import('../app/tag-editor.js'),html=await readFile(new URL('../app/index.html',import.meta.url),'utf8'),dom=new JSDOM(html),d=dom.window.document;let released,saved=false;const el=(tag,text)=>{const n=d.createElement(tag);if(text)n.textContent=text;return n;};const audio={pause(){throw Error('Unexpected direct pause');},set src(value){throw Error('Unexpected direct source reset');}};d.getElementById('tag-dialog').close=()=>d.getElementById('tag-dialog').open=false;const editor=createTagEditor({document:d,api:{readTagsBatch:async()=>[{id:'a',token:'token',values:{title:'Old'},extras:[]}],writeTagsBatch:async()=>({state:{},saved:['a'],failures:[]})},el,tagLabels:{title:'Title'},dialogs:{open:n=>n.open=true},isBusy:()=>false,setAppBusy(){},currentTrack:()=>({id:'a'}),audio,applyTagState:()=>saved=true,getTrack:()=>({title:'New'}),toast(){},clearNotice(){},getLeadingZeros:()=>false,releaseTrack:async(ids,work)=>{released=ids;return work();}});try{await editor.open([{id:'a'}]);const input=d.getElementById('tag-value-title');input.value='New';input.dispatchEvent(new dom.window.Event('input'));d.getElementById('tag-form').dispatchEvent(new dom.window.Event('submit',{cancelable:true}));await new Promise(r=>setImmediate(r));assert.deepEqual(released,['a']);assert.equal(saved,true);assert.equal(d.getElementById('tag-dialog').open,false);}finally{editor.dispose();dom.window.close();}});

test('overlapping failed settings saves restore the last confirmed value',async()=>{
 const {createSettingsWrites}=await import('../app/settings-writes.js');let prefs={volume:.5},writes=[];
 const controller=createSettingsWrites({getPreferences:()=>prefs,setPreferences:v=>prefs=v,isBusy:()=>false,apply(){},clearError(){},showError(){},write:()=>new Promise((resolve,reject)=>writes.push({resolve,reject}))});
 const first=controller.update({volume:.8}),second=controller.update({volume:.9});writes[0].reject(new Error('First'));await first;writes[1].reject(new Error('Second'));await second;assert.equal(prefs.volume,.5);
 const third=controller.update({volume:.3}),fourth=controller.update({volume:.7});writes[2].resolve();await third;writes[3].reject(new Error('Fourth'));await fourth;assert.equal(prefs.volume,.3);
});

test('failed Last.fm enable restores the saved switch value',async()=>{
 const {createLastfmSettings}=await import('../app/lastfm-settings.js');const ids=['status','enabled','connect','finish','disconnect','retry','key','secret','error','save','api'];const dom=new JSDOM('<div id="lastfm-settings">'+ids.map(id=>`<button id="lastfm-${id}"></button>`).join('')+'</div>');let reject;
 const controller=createLastfmSettings({document:dom.window.document,api:{lastfm:()=>new Promise((_,r)=>reject=r)},confirm:()=>true,onStatus(){}});
 try{controller.show({connected:true,configured:true,enabled:false});const toggle=dom.window.document.getElementById('lastfm-enabled');toggle.checked=true;const pending=toggle.onchange();assert.equal(toggle.disabled,true);reject(new Error('Network'));await pending;assert.equal(toggle.checked,false);assert.equal(toggle.disabled,false);}finally{controller.dispose();dom.window.close();}
});

test('multi-file tag confirmation can be disabled without changing the saved edits',async()=>{
 const {createTagEditor}=await import('../app/tag-editor.js');const html=await readFile(new URL('../app/index.html',import.meta.url),'utf8');
 for(const confirm of [true,false]){
  const dom=new JSDOM(html),d=dom.window.document;let writes=0;
  const el=(tag,text)=>{const n=d.createElement(tag);if(text)n.textContent=text;return n;};
  d.getElementById('tag-dialog').close=()=>d.getElementById('tag-dialog').open=false;
  const editor=createTagEditor({document:d,api:{readTagsBatch:async()=>['a','b'].map(id=>({id,token:id,values:{title:'Old'},extras:[]})),writeTagsBatch:async(entries,patch)=>{writes++;assert.equal(entries.length,2);assert.equal(patch.title,'New');return {state:{},saved:['a','b'],failures:[]};}},el,tagLabels:{title:'Title'},dialogs:{open:n=>n.open=true},isBusy:()=>false,setAppBusy(){},currentTrack:()=>null,releaseTrack:async(_ids,work)=>work(),applyTagState(){assert.equal(d.getElementById('tag-dialog').open,false);},getTrack:()=>({title:'New'}),toast(){},clearNotice(){},getLeadingZeros:()=>false,confirmMultiple:()=>confirm});
  try{await editor.open([{id:'a'},{id:'b'}]);const input=d.getElementById('tag-value-title');input.value='New';input.dispatchEvent(new dom.window.Event('input'));const submit=()=>d.getElementById('tag-form').onsubmit({preventDefault(){}});await submit();assert.equal(writes,confirm?0:1);if(confirm){assert.equal(d.getElementById('tag-save').textContent,'Confirm changes');await submit();assert.equal(writes,1);}assert.equal(d.getElementById('tag-dialog').open,false);}finally{editor.dispose();dom.window.close();}
 }
});

test('Delete and Backspace explicitly clear mixed tag rows without changing untouched mixed fields',async()=>{
 const {createTagEditor}=await import('../app/tag-editor.js');const html=await readFile(new URL('../app/index.html',import.meta.url),'utf8');
 for(const key of ['Delete','Backspace']){
  const dom=new JSDOM(html),d=dom.window.document;let patch,writes=0;const el=(tag,text,className)=>{const n=d.createElement(tag);if(text!=null)n.textContent=text;if(className)n.className=className;return n;};
  const editor=createTagEditor({document:d,api:{readTagsBatch:async()=>[{id:'a',token:'a',values:{disc:'01/02',title:'First'}},{id:'b',token:'b',values:{disc:'02/02',title:'Second'}}],writeTagsBatch:async(entries,change)=>{writes++;patch=change;assert.equal(entries.length,2);return {state:{},saved:['a','b'],failures:[]};}},el,tagLabels:{title:'Title',disc:'Disc number'},dialogs:{open:n=>n.open=true},isBusy:()=>false,setAppBusy(){},currentTrack:()=>null,releaseTrack:async(_ids,work)=>work(),applyTagState(){},getTrack:()=>({}),toast(){},clearNotice(){},getLeadingZeros:()=>false,confirmMultiple:()=>true});
  d.getElementById('tag-dialog').close=()=>d.getElementById('tag-dialog').open=false;
  try{await editor.open([{id:'a'},{id:'b'}]);const disc=d.querySelector('input[name=disc]');assert.equal(disc.value,'');assert.equal(disc.placeholder,'⟨multiple values⟩');disc.focus();disc.dispatchEvent(new dom.window.Event('blur'));assert.notEqual(disc.dataset.changed,'true');disc.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key,bubbles:true,cancelable:true}));assert.equal(disc.dataset.changed,'true');assert.equal(disc.placeholder,'');assert.match(disc.getAttribute('aria-description'),/removed/);
   d.getElementById('tag-form').dispatchEvent(new dom.window.Event('submit',{cancelable:true}));assert.equal(writes,0);assert.equal(d.getElementById('tag-save').textContent,'Confirm changes');d.getElementById('tag-form').dispatchEvent(new dom.window.Event('submit',{cancelable:true}));await new Promise(r=>setImmediate(r));assert.deepEqual(patch,{disc:''});assert.equal(writes,1);
  }finally{editor.dispose();dom.window.close();}
 }
});
