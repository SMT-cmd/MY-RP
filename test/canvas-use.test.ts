import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';

test('Canvas occupants use distinct sofa positions and expired poses cannot revive on a graphics refresh',async()=>{
 const dom=new JSDOM('<div id="world-canvas"></div>',{runScripts:'outside-only',pretendToBeVisual:true});
 try{
  const w=dom.window;let now=0,depth=0,nextFrame:FrameRequestCallback|undefined;const roots:number[][]=[];
  const context=new Proxy({save(){depth++;},restore(){depth--;},translate(x:number,y:number){if(depth===2)roots.push([x,y]);}},{get(target,key){return Reflect.get(target,key)??(()=>{});},set(target,key,value){Reflect.set(target,key,value);return true;}});
  Object.defineProperty(w,'CanvasRenderingContext2D',{value:function(){}});
  Object.defineProperty(w.HTMLCanvasElement.prototype,'getContext',{value:()=>context});
  Object.defineProperty(w.performance,'now',{value:()=>now});
  w.Date.now=()=>999999999; // The device clock must not expire server poses.
  w.requestAnimationFrame=callback=>{nextFrame=callback;return 1;};w.cancelAnimationFrame=()=>{nextFrame=undefined;};
  w.eval(await readFile(new URL('../web/world-renderer.js',import.meta.url),'utf8'));
  const renderer=(w as unknown as {WorldRenderer:{update:(view:unknown,mode:string)=>Promise<void>;destroy:()=>void}}).WorldRenderer;
  const activity=(slot:number)=>({kind:'Sit',fixtureId:'sofa',slot,startedAt:1000});
  const view={serverTime:1000,position:{region:'Lagos',interior:'shelter',x:4,y:7,facing:'front',activity:activity(0)},home:{id:'canvas-home',x:6,y:5,width:10,height:8,floor:'oak',wall:'cream',fixtures:[{id:'sofa',model:'sofa',x:6,y:4,w:3,h:1,rotation:0,finish:'sage'}]},people:[{id:'peer-one',x:6,y:5,activity:activity(1)},{id:'peer-two',x:6,y:5,activity:activity(2)}]};
  const paint=(at:number)=>{now=at;roots.length=0;const callback=nextFrame;assert.ok(callback);nextFrame=undefined;callback(at);assert.equal(depth,0);return roots.filter(([x])=>x!==0);};
  await renderer.update(view,'medium');
  assert.deepEqual(paint(100),[[84,231],[126,252],[168,273]]);
  assert.deepEqual(paint(11000),[[42,252],[42,252],[42,252]]);
  await renderer.update(view,'high');
  assert.deepEqual(paint(11100),[[42,252],[42,252],[42,252]],'reusing an old snapshot must not reset the server clock anchor');
  renderer.destroy();assert.equal(w.document.querySelector('canvas'),null);
 }finally{dom.window.close();}
});
