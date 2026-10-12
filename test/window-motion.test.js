import test from 'node:test';
import assert from 'node:assert/strict';
import motion from '../window-motion.cjs';
import queue from '../queue-window.cjs';
test('window animation eases through intermediate frames and lands exactly at the target with bottom-left anchor',async()=>{let bounds={x:100,y:50,width:1200,height:800},clock=0;const frames=[],win={getBounds:()=>({...bounds}),setBounds:b=>{bounds={...b};frames.push({...b});},isDestroyed:()=>false};const target={x:100,y:500,width:240,height:350};await motion.animateBounds(win,target,{now:()=>clock,wait:async ms=>{clock+=ms;}});assert.deepEqual(bounds,target);assert.ok(frames.length>10);for(let i=0;i<frames.length;i++){assert.equal(frames[i].x,100);assert.equal(frames[i].y+frames[i].height,850);if(i)assert.ok(frames[i].width<=frames[i-1].width);}assert.ok(frames[1].width-frames[2].width<frames[6].width-frames[7].width);});
test('extended queue waits for animation before completing and restores original bounds',async()=>{let bounds={x:20,y:40,width:1100,height:750},clock=0;const original={...bounds},win={getBounds:()=>({...bounds}),setBounds:b=>bounds={...b},isMaximized:()=>false},screen={getDisplayMatching:()=>({workArea:{x:0,y:0,width:1920,height:1080}})},controller=queue.createQueueWindow(),resize=target=>motion.animateBounds(win,target,{now:()=>clock,wait:async ms=>{clock+=ms;}});assert.equal(await controller.open(win,screen,224,resize),true);assert.equal(bounds.width,1324);assert.equal(controller.extended,true);await controller.close(win,resize);assert.deepEqual(bounds,original);assert.equal(controller.extended,false);});
test('reduced-motion resize uses one final frame',async()=>{const frames=[],win={getBounds:()=>({x:0,y:0,width:1100,height:750}),setBounds:b=>frames.push(b)};const target={x:0,y:0,width:1324,height:750};await motion.animateBounds(win,target,{duration:0});assert.deepEqual(frames,[target]);});

test('queue bounds do not accumulate native rounding over repeated open/close cycles',async()=>{
 let bounds={x:20,y:40,width:1100,height:750};const original={...bounds};
 const win={getBounds:()=>({...bounds}),setBounds:b=>bounds={x:b.x+1,y:b.y+1,width:b.width+1,height:b.height+1},isMaximized:()=>false};
 const screen={getDisplayMatching:()=>({workArea:{x:0,y:0,width:3000,height:2000}})},controller=queue.createQueueWindow();
 for(let i=0;i<20;i++){await controller.open(win,screen);await controller.close(win);assert.deepEqual(bounds,{x:21,y:41,width:1101,height:751});}
 await controller.open(win,screen);bounds={...bounds,x:100,width:1400,height:900};await controller.close(win);assert.deepEqual(bounds,{x:101,y:42,width:1177,height:901});
 assert.notDeepEqual(bounds,original,'Real user resizing is preserved');
});
test('mini bounds memory restores a stable target despite native rounding, preserving manual changes',()=>{
 let bounds={x:10,y:20,width:1100,height:800};const win={getBounds:()=>({...bounds})},memory=queue.createBoundsMemory(),original={...bounds};
 for(let i=0;i<20;i++){const target=memory.capture(win);assert.deepEqual(target,original);bounds={x:target.x+1,y:target.y+1,width:target.width+1,height:target.height+1};memory.remember(win,target);}
 bounds.width+=100;assert.equal(memory.capture(win).width,1201);
});
