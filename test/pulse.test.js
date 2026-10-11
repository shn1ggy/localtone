import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {createIcons} from '../app/icons.js';
import preferences from '../preferences.cjs';
import transfer from '../settings-transfer.cjs';
function setup() {
 const dom=new JSDOM('<div class="brand"></div>',{pretendToBeVisual:true}),w=dom.window,d=w.document;
 let id=0,now=0;const frames=new Map();
 w.requestAnimationFrame=fn=>{frames.set(++id,fn);return id;};w.cancelAnimationFrame=id=>frames.delete(id);
 const media=new w.EventTarget();media.matches=false;w.matchMedia=()=>media;
 const api=createIcons(d),svg=api.icon('pulse');d.querySelector('.brand').append(svg);
 const audio=new w.EventTarget();audio.paused=false;
 const controller=api.animatePulse(svg,audio);
 return {dom,w,d,svg,api,audio,media,controller,frames,event:name=>audio.dispatchEvent(new w.Event(name)),tick(){now+=16;const pending=[...frames.values()];frames.clear();pending.forEach(fn=>fn(now));}};
}
const shape=s=>[...s.svg.children].map(b=>[b.getAttribute('y'),b.getAttribute('height')]);
test('Pulse changes real bar heights, preserves circular ends and freezes its frame on pause',()=>{
 const s=setup();try{
 assert.equal(s.svg.children.length,4);assert.equal(s.frames.size,0);
 s.event('playing');s.tick();const first=shape(s);assert.deepEqual(first.map(b=>b.map(Number)),[['2','22'],['9.5','11.8'],['15.1','11.2'],['10.5','11.5']].map(b=>b.map(Number)));for(let i=0;i<30;i++)s.tick();const next=shape(s);assert.notDeepEqual(next,first);
 for(const b of s.svg.children){assert.equal(b.getAttribute('rx'),'2.4');assert.equal(b.getAttribute('width'),'4.8');assert.equal(b.hasAttribute('transform'),false);}
 s.event('pause');assert.equal(s.frames.size,0);s.tick();assert.deepEqual(shape(s),next);
 s.event('playing');s.tick();assert.deepEqual(shape(s),next);s.tick();assert.notDeepEqual(shape(s),next);
 for(const event of ['waiting','seeking','ended','error','emptied']){s.event('playing');s.tick();s.event(event);assert.equal(s.frames.size,0);}
 }finally{s.controller.dispose();s.dom.window.close();}
});
test('Pulse disable freezes current geometry and visibility/reduced motion stop all frame work',()=>{
 const s=setup();try{
 const original=shape(s);s.event('playing');for(let i=0;i<30;i++)s.tick();const frozen=shape(s);assert.notDeepEqual(frozen,original);s.controller.setEnabled(false);assert.deepEqual(shape(s),frozen);assert.equal(s.frames.size,0);
 s.controller.setEnabled(true);assert.equal(s.frames.size,1);
 s.media.matches=true;s.media.dispatchEvent(new s.w.Event('change'));assert.equal(s.frames.size,0);
 s.media.matches=false;s.media.dispatchEvent(new s.w.Event('change'));assert.equal(s.frames.size,1);
 Object.defineProperty(s.d,'hidden',{value:true,configurable:true});s.d.dispatchEvent(new s.w.Event('visibilitychange'));assert.equal(s.frames.size,0);
 Object.defineProperty(s.d,'hidden',{value:false,configurable:true});s.d.dispatchEvent(new s.w.Event('visibilitychange'));assert.equal(s.frames.size,1);
 s.controller.dispose();assert.equal(s.frames.size,0);s.event('playing');assert.equal(s.frames.size,0);
 }finally{s.controller.dispose();s.dom.window.close();}
});
test('logo preference persists and legacy search queue exports import without restoring retired behavior',()=>{
 assert.equal(preferences.defaults.animateLogo,true);assert.equal(preferences.normalizeSettings({animateLogo:false}).animateLogo,false);
 const file=transfer.exportSettings({...preferences.defaults,animateLogo:false});file.settings.searchQueueOnEnter=true;
 const result=transfer.importSettings(file);assert.equal(result.animateLogo,false);assert.equal(Object.hasOwn(result,'searchQueueOnEnter'),false);
});

test('playback markers share logo geometry and freeze on pause, including newly rendered markers',()=>{
 const s=setup();try {
  const marker=s.api.icon('playback');s.d.body.append(marker);
  s.event('playing');for(let i=0;i<40;i++)s.tick();
  assert.deepEqual(shape({svg:marker}),shape(s));
  const later=s.api.icon('playback');s.d.body.append(later);
  assert.deepEqual(shape({svg:later}),shape(s));
  s.tick();assert.deepEqual(shape({svg:later}),shape(s));
  const frozen=shape({svg:marker});s.event('pause');for(let i=0;i<10;i++)s.tick();assert.deepEqual(shape({svg:marker}),frozen);
  s.event('playing');s.controller.setEnabled(false);const logo=shape(s);for(let i=0;i<10;i++)s.tick();assert.deepEqual(shape(s),logo);assert.notDeepEqual(shape({svg:marker}),frozen);
  for(const bar of marker.children)assert.equal(bar.getAttribute('rx'),'2.4');
 }finally{s.controller.dispose();s.dom.window.close();}
});
