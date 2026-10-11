import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import portable from '../portable.cjs';
test('portable roots follow the installed program on each platform, outside bundles and mounts',()=>{
 const base={packaged:true,source:'/source',env:{}};
 assert.equal(portable.portableRoot({...base,platform:'darwin',exe:'/Apps/Localtone.app/Contents/MacOS/Localtone'}),'/Apps');
 assert.equal(portable.portableRoot({...base,platform:'win32',exe:'D:\\Music\\Localtone\\Localtone.exe'}),'D:\\Music\\Localtone');
 assert.equal(portable.portableRoot({...base,platform:'linux',exe:'/tmp/.mount_local/AppRun',env:{APPIMAGE:'/home/me/Apps/Localtone.AppImage'}}),'/home/me/Apps');
 assert.equal(portable.portableRoot({...base,platform:'linux',exe:'/opt/localtone/localtone'}),'/opt/localtone');
 assert.equal(portable.portableRoot({...base,platform:'win32',exe:'C:\\Temp\\App.exe',env:{PORTABLE_EXECUTABLE_DIR:'D:\\Apps'}}),'D:\\Apps');
 assert.equal(portable.portableRoot({...base,packaged:false,platform:'darwin',exe:'/node_modules/Electron.app/Contents/MacOS/Electron'}),'/source');
});
test('fresh portable data never imports legacy settings and never replaces existing local data',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'localtone-portable-'));
 try{
  const program=path.join(root,'program'),legacy=path.join(root,'legacy');fs.mkdirSync(program);fs.mkdirSync(legacy);fs.mkdirSync(path.join(legacy,'covers'));fs.writeFileSync(path.join(legacy,'covers','a.jpg'),'art');fs.writeFileSync(path.join(legacy,'collection.json'),'old');fs.writeFileSync(path.join(legacy,'lastfm.enc'),'encrypted');
  const data=portable.preparePortable(program,legacy);assert.equal(fs.existsSync(path.join(data,'collection.json')),false);assert.equal(fs.existsSync(path.join(data,'covers')),false);assert.equal(fs.existsSync(path.join(data,'lastfm.enc')),false);assert.equal(fs.readFileSync(path.join(legacy,'collection.json'),'utf8'),'old');
  fs.writeFileSync(path.join(data,'collection.json'),'new');portable.preparePortable(program,legacy);assert.equal(fs.readFileSync(path.join(data,'collection.json'),'utf8'),'new');assert.equal(fs.readdirSync(program).some(n=>n.startsWith('.localtone-data-')),false);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('portable configuration redirects persistent Electron paths to the program folder',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'localtone-config-'));
 try{
  const paths={exe:process.execPath,userData:path.join(root,'missing-legacy')};const app={isPackaged:false,getPath:key=>paths[key],setPath:(key,value)=>paths[key]=value,setAppLogsPath:value=>paths.logs=value};const data=portable.configurePortable(app,root);
  for(const key of ['userData','sessionData','logs','crashDumps']){assert.ok(paths[key]===data||paths[key].startsWith(data+path.sep));assert.ok(fs.statSync(paths[key]).isDirectory());}
  assert.equal(fs.existsSync(path.join(data,'.write-test-'+process.pid)),false);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('unavailable portable location fails without modifying legacy data',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'localtone-unavailable-'));
 try{const file=path.join(root,'not-a-directory');fs.writeFileSync(file,'keep');assert.throws(()=>portable.preparePortable(file,root));assert.equal(fs.readFileSync(file,'utf8'),'keep');}finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('portable switch migrates latest settings in both directions on next launch and preserves old copies',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'localtone-switch-'));
 try{
  const program=path.join(root,'program'),legacy=path.join(root,'standard');fs.mkdirSync(program);fs.mkdirSync(legacy);fs.writeFileSync(path.join(legacy,'collection.json'),'initial');
  const app=()=>{const paths={exe:process.execPath,userData:legacy};return {isPackaged:false,getPath:key=>paths[key],setPath:(key,value)=>paths[key]=value,setAppLogsPath(){}};};
  let instance=app(),data=portable.configurePortable(instance,program);fs.writeFileSync(path.join(data,'collection.json'),'portable latest');fs.writeFileSync(path.join(data,'lastfm.enc'),'secret');portable.requestMode(instance,false);assert.equal(instance.getPath('userData'),data);
  instance=app();assert.equal(portable.configurePortable(instance,program),legacy);assert.equal(portable.storageStatus(instance).portable,false);assert.equal(fs.readFileSync(path.join(legacy,'collection.json'),'utf8'),'portable latest');assert.equal(fs.readFileSync(path.join(legacy,'lastfm.enc'),'utf8'),'secret');assert.equal(fs.readFileSync(path.join(data,'collection.json'),'utf8'),'portable latest');
  fs.writeFileSync(path.join(legacy,'collection.json'),'standard latest');portable.requestMode(instance,true);instance=app();assert.equal(portable.configurePortable(instance,program),data);assert.equal(portable.storageStatus(instance).portable,true);assert.equal(fs.readFileSync(path.join(data,'collection.json'),'utf8'),'standard latest');assert.equal(fs.readFileSync(path.join(legacy,'collection.json'),'utf8'),'standard latest');assert.ok(fs.readdirSync(program).some(n=>n.startsWith('Localtone-data.previous-')));
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('cancelling a storage switch before restart leaves the active location untouched',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'localtone-cancel-storage-'));
 try{const paths={exe:process.execPath,userData:path.join(root,'standard')},app={isPackaged:false,getPath:key=>paths[key],setPath:(key,value)=>paths[key]=value,setAppLogsPath(){}};const data=portable.configurePortable(app,root);fs.writeFileSync(path.join(data,'collection.json'),'keep');portable.requestMode(app,false);portable.requestMode(app,true);const mode=JSON.parse(fs.readFileSync(path.join(data,'storage-mode.json'),'utf8'));assert.deepEqual(mode,{active:true});assert.equal(fs.readFileSync(path.join(data,'collection.json'),'utf8'),'keep');assert.throws(()=>portable.requestMode(app,'yes'));
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('external cleanup preserves every old file in verified local backup without replacing active preferences',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'localtone-cleanup-'));
 try{const program=path.join(root,'program'),legacy=path.join(root,'standard');fs.mkdirSync(program);fs.mkdirSync(legacy);fs.writeFileSync(path.join(legacy,'collection.json'),'old');fs.writeFileSync(path.join(legacy,'playback-session.json'),'resume');fs.mkdirSync(path.join(legacy,'session'));fs.writeFileSync(path.join(legacy,'session','cache'),'cached');const paths={exe:process.execPath,userData:legacy},app={isPackaged:false,getPath:k=>paths[k],setPath:(k,v)=>paths[k]=v,setAppLogsPath(){}};
 const data=portable.configurePortable(app,program);assert.equal(fs.existsSync(path.join(data,'playback-session.json')),false);fs.writeFileSync(path.join(data,'collection.json'),'current');const result=portable.cleanupExternal(app);assert.equal(result.removed,true);assert.equal(fs.existsSync(legacy),false);assert.equal(fs.readFileSync(path.join(result.backup,'collection.json'),'utf8'),'old');assert.equal(fs.readFileSync(path.join(result.backup,'session','cache'),'utf8'),'cached');assert.equal(fs.readFileSync(path.join(data,'collection.json'),'utf8'),'current');assert.equal(portable.cleanupExternal(app).removed,false);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('cleanup preserves symlinks without following targets and rejects overlapping folders',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'localtone-cleanup-safe-'));
 try{const program=path.join(root,'program'),legacy=path.join(root,'standard');fs.mkdirSync(program);fs.mkdirSync(legacy);const paths={exe:process.execPath,userData:legacy},app={isPackaged:false,getPath:k=>paths[k],setPath:(k,v)=>paths[k]=v,setAppLogsPath(){}};portable.configurePortable(app,program);fs.symlinkSync(program,path.join(legacy,'linked'),'dir');fs.symlinkSync('missing-target',path.join(legacy,'broken'));const result=portable.cleanupExternal(app);assert.equal(fs.existsSync(legacy),false);assert.equal(fs.readlinkSync(path.join(result.backup,'linked')),program);assert.equal(fs.readlinkSync(path.join(result.backup,'broken')),'missing-target');assert.ok(fs.existsSync(program));const paths2={exe:process.execPath,userData:root},app2={...app,getPath:k=>paths2[k],setPath:(k,v)=>paths2[k]=v};portable.configurePortable(app2,program);assert.throws(()=>portable.cleanupExternal(app2),/overlap/);assert.ok(fs.existsSync(program));
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('requested move-and-clean waits for restart, migrates current data, then removes external source',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'localtone-cleanup-restart-'));
 try{const program=path.join(root,'program'),legacy=path.join(root,'standard');fs.mkdirSync(program);fs.mkdirSync(legacy);fs.mkdirSync(path.join(program,'Localtone-data'));fs.writeFileSync(path.join(program,'Localtone-data','storage-mode.json'),JSON.stringify({active:false}));fs.writeFileSync(path.join(legacy,'collection.json'),'latest');const app=()=>{const paths={exe:process.execPath,userData:legacy};return {isPackaged:false,getPath:k=>paths[k],setPath:(k,v)=>paths[k]=v,setAppLogsPath(){}};};let instance=app();portable.configurePortable(instance,program);assert.throws(()=>portable.cleanupExternal(instance),/restart/);portable.requestMode(instance,true,true);assert.ok(fs.existsSync(legacy));instance=app();const data=portable.configurePortable(instance,program);assert.equal(fs.existsSync(legacy),false);assert.equal(fs.readFileSync(path.join(data,'collection.json'),'utf8'),'latest');assert.ok(fs.readdirSync(data).some(n=>n.startsWith('external-data-backup-')));
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('cleanup reports the exact special-file path and leaves source untouched',async()=>{
 if(process.platform==='win32')return;
 const {execFileSync}=await import('node:child_process'),root=fs.mkdtempSync(path.join(os.tmpdir(),'localtone-special-'));
 try{const program=path.join(root,'program'),legacy=path.join(root,'standard');fs.mkdirSync(program);fs.mkdirSync(legacy);const paths={exe:process.execPath,userData:legacy},app={isPackaged:false,getPath:k=>paths[k],setPath:(k,v)=>paths[k]=v,setAppLogsPath(){}};portable.configurePortable(app,program);const fifo=path.join(legacy,'process.pipe');execFileSync('mkfifo',[fifo]);assert.throws(()=>portable.cleanupExternal(app),error=>error.message.includes(fifo)&&error.message.includes('Nothing was deleted'));assert.ok(fs.existsSync(legacy));
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});

test('storage migration preserves the complete browsing session in both directions',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'localtone-browse-migrate-'));
 try{
  const a=path.join(root,'portable'),b=path.join(root,'system');fs.mkdirSync(a);
  const session=JSON.stringify({scope:{kind:'playlist',id:'mix'},view:'covers',queueOpen:true,scroll:{artists:91,content:830},pane:'artists'});
  fs.writeFileSync(path.join(a,'browsing-session.json'),session);
  portable.migrateSettings(a,b);assert.equal(fs.readFileSync(path.join(b,'browsing-session.json'),'utf8'),session);
  const changed=JSON.stringify({view:'tracks',queueOpen:false});fs.writeFileSync(path.join(b,'browsing-session.json'),changed);
  portable.migrateSettings(b,a);assert.equal(fs.readFileSync(path.join(a,'browsing-session.json'),'utf8'),changed);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
