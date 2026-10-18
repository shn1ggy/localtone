import test from 'node:test';
import assert from 'node:assert/strict';
import shortcuts from '../src/global-shortcuts.cjs';
import preferences from '../src/preferences.cjs';
test('global shortcuts register each action once and unregister when disabled; conflicts roll back',()=>{
 const registered=new Map(),actions=[];let blocked=false;
 const api={register:(key,fn)=>{if(blocked&&key==='CommandOrControl+Right')return false;registered.set(key,fn);return true;},unregister:key=>registered.delete(key)};
 const service=new shortcuts.PlaybackShortcuts(api,action=>actions.push(action));service.set(true);assert.equal(registered.size,3);for(const fn of registered.values())fn();assert.deepEqual(actions,['previous','next','random']);service.set(true);assert.equal(registered.size,3);service.set(false);assert.equal(registered.size,0);
 blocked=true;assert.throws(()=>service.set(true),/Cannot register/);assert.equal(registered.size,0);assert.equal(service.status().active,false);service.set(false);assert.equal(service.status().error,'');
});
test('appearance and shortcut preferences round-trip, reject invalid inputs, and default to compact locked height',()=>{
 const patch={globalPlaybackShortcuts:true,seekHeight:82,seekHeightLocked:true,backgroundHue:360,accentColor:'#aabbcc'};
 const restored=preferences.normalizeSettings(preferences.validateSettings(patch));for(const [key,value] of Object.entries(patch))assert.equal(restored[key],value);
 assert.equal(preferences.defaults.seekHeight,32);assert.equal(preferences.defaults.seekHeightLocked,true);
 for(const patch of [{seekHeight:0},{seekHeight:201},{backgroundHue:361},{accentColor:'red'},{globalPlaybackShortcuts:1},{seekHeightLocked:'yes'}])assert.throws(()=>preferences.validateSettings(patch));
});
test('custom playback bindings replace defaults and survive preference normalization',()=>{
 const bindings={...preferences.defaults.shortcuts,next:'Alt+n',previous:'Alt+b',random:'Alt+r'},registered=new Map();
 const service=new shortcuts.PlaybackShortcuts({register:(k,fn)=>{registered.set(k,fn);return true;},unregister:k=>registered.delete(k)},()=>{});
 service.set(true);service.set(true,bindings);assert.deepEqual([...registered.keys()],['Alt+b','Alt+n','Alt+r']);
 assert.deepEqual(preferences.normalizeSettings(preferences.validateSettings({shortcuts:bindings})).shortcuts,bindings);
 assert.throws(()=>preferences.validateSettings({shortcuts:{...bindings,next:'Alt+b'}}));
 service.set(false,bindings);assert.equal(registered.size,0);
});
test('retired search queue preference is ignored and shortcut upgrade preserves existing bindings',()=>{
 assert.equal(preferences.normalizeSettings({searchQueueOnEnter:true}).searchQueueOnEnter,undefined);
 assert.throws(()=>preferences.validateSettings({searchQueueOnEnter:'yes'}));
 const old={...preferences.defaults.shortcuts,shuffle:'a'};delete old.addQueue;
 const result=preferences.normalizeSettings({shortcuts:old});assert.equal(result.shortcuts.shuffle,'a');assert.equal(result.shortcuts.addQueue,'Alt+a');
});
