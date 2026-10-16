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

test('Windows reveal animates the panel around a single native resize, with a stationary close button',async()=>{
 const dom=new JSDOM('<body><button id="queue"></button><section id="queue-panel" hidden><button id="close-queue"></button><div id="queue-list"></div></section></body>'),w=dom.window,d=w.document;w.requestAnimationFrame=callback=>w.setTimeout(callback,0);const steps=[];
 d.getElementById('queue-panel').animate=(frames,options)=>{steps.push(['reveal',frames[0].clipPath,options.duration]);return {finished:Promise.resolve(),cancel(){}};};
 const presentation=createWindowPresentation({window:w,document:d,api:{platform:'win32',windowAction:async(action,options)=>{steps.push(['native',action,options.animate]);return {value:action==='queue-open'};}},getPreferences:()=>({queuePresentation:'extend'}),syncPaneBounds(){},toast(message){throw Error(message);}});
 try{await presentation.setQueueVisible(true);assert.equal(d.getElementById('close-queue').style.position,'absolute');await presentation.setQueueVisible(false);assert.deepEqual(steps,[['native','queue-open',false],['reveal','inset(0 100% 0 0)',180],['reveal','inset(0 0% 0 0)',140],['native','queue-close',false]]);assert.equal(d.getElementById('queue-panel').style.transform,'');}finally{presentation.dispose();w.close();}
});

test('Windows queue reveal respects reduced motion',async()=>{
 const dom=new JSDOM('<body><button id="queue"></button><section id="queue-panel" hidden><button id="close-queue"></button><div id="queue-list"></div></section></body>'),w=dom.window,d=w.document;w.requestAnimationFrame=callback=>w.setTimeout(callback,0);w.matchMedia=()=>({matches:true});let animated=0;d.getElementById('queue-panel').animate=()=>{animated++;throw Error('Reduced motion must not animate');};
 const presentation=createWindowPresentation({window:w,document:d,api:{platform:'win32',windowAction:async action=>({value:action==='queue-open'})},getPreferences:()=>({queuePresentation:'extend'}),syncPaneBounds(){},toast(message){throw Error(message);}});
 try{await presentation.setQueueVisible(true);await presentation.setQueueVisible(false);assert.equal(animated,0);assert.equal(d.getElementById('queue-panel').style.transform,'');assert.equal(d.body.classList.contains('window-transition'),false);}finally{presentation.dispose();w.close();}
});

test('Windows transitions finish even when Chromium animation frames stop arriving',{timeout:1500},async()=>{
 const dom=new JSDOM('<body><button id="queue"></button><section id="queue-panel" hidden><button id="close-queue"></button><div id="queue-list"></div></section></body>'),w=dom.window,d=w.document;w.requestAnimationFrame=()=>1;w.cancelAnimationFrame=()=>{};
 const presentation=createWindowPresentation({window:w,document:d,api:{platform:'win32',windowAction:async action=>({value:action==='queue-open',contentSize:[w.innerWidth+2,w.innerHeight]})},getPreferences:()=>({queuePresentation:'extend'}),syncPaneBounds(){},toast(message){throw Error(message);}});
 try{const started=Date.now();await presentation.setQueueVisible(true);await presentation.setQueueVisible(false);assert.ok(Date.now()-started<1000);assert.equal(d.body.classList.contains('window-transition'),false);}finally{presentation.dispose();w.close();}
});


test('fractional CSS viewport is frozen without rounding to innerWidth at 130% scale',async()=>{
 const dom=new JSDOM('<body><button id="queue"></button><section id="queue-panel" hidden><button id="close-queue"></button><div id="queue-list"></div></section></body>'),w=dom.window,d=w.document;w.requestAnimationFrame=callback=>w.setTimeout(callback,0);const viewport={width:1200.765625,height:760.765625};Object.defineProperty(w,'visualViewport',{value:viewport});const widths=[];
 const presentation=createWindowPresentation({window:w,document:d,api:{platform:'win32',windowAction:async(action)=>{widths.push(d.documentElement.style.getPropertyValue('--motion-width'));viewport.width=action==='queue-open'?1424.609375:1200.765625;return {value:action==='queue-open'};}},getPreferences:()=>({queuePresentation:'extend'}),syncPaneBounds(){},toast(message){throw Error(message);}});
 try{await presentation.setQueueVisible(true);assert.equal(presentation.queueWidth,223.84375);assert.equal(d.documentElement.style.getPropertyValue('--queue-width'),'223.84375px');assert.equal(d.documentElement.style.getPropertyValue('--motion-height'),'760.765625px');await presentation.setQueueVisible(false);assert.equal(widths[0],'1424.765625px');assert.equal(widths[1],'1424.609375px');}finally{presentation.dispose();w.close();}
});
