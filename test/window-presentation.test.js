import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createWindowPresentation } from '../app/window-presentation.js';

test('extended queue keeps its waveform reservation until the frozen layout is released', async () => {
 const dom=new JSDOM('<body><button id="queue"></button><section id="queue-panel" hidden><button id="close-queue"></button><div id="queue-list"></div></section></body>'),w=dom.window,d=w.document;
 w.requestAnimationFrame=callback=>w.setTimeout(callback,0);
 const states=[],actions=[];
 const observer=new w.MutationObserver(()=>states.push([d.body.classList.contains('window-transition'),d.body.classList.contains('queue-extended')]));
 observer.observe(d.body,{attributes:true,attributeFilter:['class']});
 const presentation=createWindowPresentation({window:w,document:d,api:{windowAction:async action=>{actions.push(action);return {value:action==='queue-open'};}},getPreferences:()=>({queuePresentation:'extend'}),syncPaneBounds(){},toast(message){throw Error(message);}});
 try {
  await presentation.setQueueVisible(true);assert.equal(d.body.classList.contains('queue-extended'),true);
  states.length=0;await presentation.setQueueVisible(false);
  assert.ok(states.filter(([frozen])=>frozen).length>0);
  assert.ok(states.every(([frozen,extended])=>!frozen||extended),'No frame releases queue padding while the shell is frozen');
  assert.equal(d.body.classList.contains('window-transition'),false);assert.equal(d.body.classList.contains('queue-extended'),false);assert.equal(d.getElementById('queue-panel').hidden,true);
  assert.deepEqual(actions,['queue-open','queue-close']);
 }finally{observer.disconnect();presentation.dispose();w.close();}
});

test('Windows queue transitions avoid repeated native animation while rapid requests settle to the latest state',async()=>{const dom=new JSDOM('<body><button id="queue"></button><section id="queue-panel" hidden><button id="close-queue"></button><div id="queue-list"></div></section></body>'),w=dom.window,d=w.document;w.requestAnimationFrame=callback=>w.setTimeout(callback,0);const calls=[];const presentation=createWindowPresentation({window:w,document:d,api:{platform:'win32',windowAction:async(action,options)=>{calls.push({action,options});return {value:action==='queue-open',contentSize:[w.innerWidth,w.innerHeight]};}},getPreferences:()=>({queuePresentation:'extend'}),syncPaneBounds(){},toast(message){throw Error(message);}});try{await presentation.setQueueVisible(true);assert.equal(calls[0].options.animate,false);await Promise.all([presentation.setQueueVisible(false),presentation.setQueueVisible(true),presentation.setQueueVisible(false)]);assert.equal(d.getElementById('queue-panel').hidden,true);assert.equal(d.body.classList.contains('window-transition'),false);assert.equal(d.body.classList.contains('queue-extended'),false);}finally{presentation.dispose();w.close();}});
