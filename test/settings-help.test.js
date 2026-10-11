import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {createSettingsHelp,settingsHelp} from '../app/settings-help.js';
const html=await readFile(new URL('../app/index.html',import.meta.url),'utf8');
function setup(){const dom=new JSDOM(html),d=dom.window.document;for(const dialog of d.querySelectorAll('dialog')){dialog.showModal=()=>dialog.open=true;dialog.close=()=>{dialog.open=false;dialog.dispatchEvent(new dom.window.Event('close'));};}d.getElementById('settings-dialog').open=true;return {dom,d,ui:createSettingsHelp({document:d}),key:key=>d.activeElement.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key,bubbles:true,cancelable:true}))};}
test('one settings popover floats without toggling its setting and restores focus on dismissal',()=>{
 const {dom,d,ui,key}=setup(),a=d.querySelector('[data-settings-help=setting-exportCollections]'),b=d.querySelector('[data-settings-help=setting-portable]'),panel=d.getElementById('settings-help-popover'),control=d.getElementById('setting-exportCollections');
 try{assert.equal(panel.hidden,true);const value=control.checked;a.focus();key('Enter');assert.equal(control.checked,value);assert.equal(a.getAttribute('aria-expanded'),'true');assert.equal(d.getElementById('settings-help-body').textContent,settingsHelp['setting-exportCollections'].body);b.click();assert.equal(a.getAttribute('aria-expanded'),'false');assert.equal(b.getAttribute('aria-expanded'),'true');b.click();assert.equal(panel.hidden,true);a.focus();key(' ');key('Escape');assert.equal(panel.hidden,true);assert.equal(d.activeElement,a);a.click();d.getElementById('settings-help-close').click();assert.equal(d.activeElement,a);a.click();d.getElementById('settings-tab-audio').click();assert.equal(panel.hidden,true);a.click();d.body.dispatchEvent(new dom.window.Event('pointerdown',{bubbles:true}));assert.equal(panel.hidden,true);}finally{ui.dispose();dom.window.close();}
});
test('popover positioning flips above the anchor and stays within a narrow viewport',()=>{
 const {dom,d,ui}=setup(),a=d.querySelector('[data-settings-help=setting-exportCollections]'),panel=d.getElementById('settings-help-popover');
 try{Object.defineProperty(dom.window,'innerWidth',{value:280});Object.defineProperty(dom.window,'innerHeight',{value:300});a.getBoundingClientRect=()=>({left:250,top:270,bottom:294});panel.getBoundingClientRect=()=>({height:160});a.click();assert.equal(panel.style.width,'264px');assert.equal(panel.style.left,'8px');assert.equal(panel.style.top,'104px');}finally{ui.dispose();dom.window.close();}
});
test('search guide preserves documentation, traps focus and closes before settings',()=>{
 const {dom,d,ui,key}=setup(),trigger=d.querySelector('#settings-dialog [data-settings-guide=search]'),guide=d.getElementById('settings-guide'),close=d.getElementById('settings-guide-close');
 try{trigger.click();assert.equal(guide.open,true);assert.equal(d.activeElement,close);for(const word of ['artist:','duration:','AND','OR','NOT','EXCEPT','rating:>=4'])assert.ok(guide.textContent.includes(word));key('Tab');assert.equal(d.activeElement,close);key('Escape');assert.equal(guide.open,false);assert.equal(d.getElementById('settings-dialog').open,true);assert.equal(d.activeElement,trigger);trigger.click();close.click();assert.equal(d.activeElement,trigger);}finally{ui.dispose();dom.window.close();}
});
