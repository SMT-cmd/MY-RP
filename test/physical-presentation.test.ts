import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {Vector3} from 'three';
// @ts-expect-error Browser module.
import {cameraStep,cameraPosition,clipCamera} from '../web/scene/camera.js';
// @ts-expect-error Browser module.
import {startActivity,sampleActivity,stopActivity} from '../web/scene/activity.js';
// @ts-expect-error Browser module.
import {adultModel,disposeModels} from '../web/scene/models.js';
// @ts-expect-error Browser module.
import {createActivityEffects} from '../web/scene/activity-effects.js';
const close=(a:number,b:number)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
test('camera-relative movement remains cardinal and camera sweep stops before walls and furniture',()=>{
 for(const [yaw,expected] of [[0,[0,-1]],[Math.PI/2,[-1,0]],[Math.PI,[0,1]],[-Math.PI/2,[1,0]]] as [number,number[]][]){const step=cameraStep(0,-1,yaw);close(step.dx,expected[0]);close(step.dy,expected[1]);}
 for(let yaw=-6;yaw<6;yaw+=.1)for(const [x,y] of [[0,-1],[0,1],[-1,0],[1,0]]){const s=cameraStep(x,y,yaw);assert.equal(Math.abs(s.dx)+Math.abs(s.dy),1);}
 const target={x:0,y:1.3,z:0},desired=cameraPosition(target,0,.2,5),wall={min:{x:-2,y:0,z:2},max:{x:2,y:3,z:2.1}},point=clipCamera(target,desired,[wall]);assert.ok(point.z<1.78&&point.z>1.6);assert.deepEqual(clipCamera(target,desired,[]),desired);
 const overhead=cameraPosition(target,0,1.1,5);assert.deepEqual(clipCamera(target,overhead,[wall]),overhead);
});
test('seat sequence approaches and turns before lowering, stands before leaving, and cannot mutate authority',()=>{
 for(const rotation of [0,90,180,270]){
  const f={x:3,y:3,w:rotation%180?1:3,h:rotation%180?3:1,rotation,model:'sofa'},yaw=-rotation*Math.PI/180;
  const from={x:f.x+f.w/2+Math.sin(yaw)*(rotation%180?f.w:f.h),z:f.y+f.h/2+Math.cos(yaw)*(rotation%180?f.w:f.h),yaw:1};
  const input=JSON.stringify({f,from}),track=startActivity(f,{kind:'Sit',slot:1,startedAt:0},from,0);
  assert.equal(sampleActivity(track,900,from).weight,0);assert.equal(sampleActivity(track,1400,from).phase,'settling');assert.ok(sampleActivity(track,1400,from).weight>0);assert.equal(sampleActivity(track,2000,from).weight,1);
  assert.equal(sampleActivity({...track,start:100},50,from),null,'A pending approach must not skip the final walking step');
  assert.equal(sampleActivity(track,9300,from).phase,'standing');assert.equal(sampleActivity(track,9700,from).weight,0);assert.equal(sampleActivity(track,10000,from),null);
  let previous=sampleActivity(track,0,from);for(let time=16;time<10000;time+=16){const next=sampleActivity(track,time,from);assert.ok(Math.hypot(next.x-previous.x,next.z-previous.z)<.09);previous=next;}
  assert.equal(JSON.stringify({f,from}),input);
  const stopped=stopActivity(track,3000,from),p=sampleActivity(track,3000,from);assert.deepEqual(sampleActivity(stopped,3000,from).x,p.x);assert.equal(sampleActivity(stopped,3400,from).phase,'standing');assert.equal(sampleActivity(stopped,3700,from),null);
 }
});
test('feet remain on the floor throughout lowering and standing for every adult frame',()=>{
 for(const frame of [.91,1,1.13]){const rig=adultModel({frame});for(const weight of [0,.1,.25,.5,.75,1]){rig.pose(0,0,'Sit',false,{activityWeight:weight});rig.root.updateMatrixWorld(true);for(const leg of rig.hips)close(leg.ankle.getWorldPosition(new Vector3()).y,.08);}disposeModels(rig.root);}
});
test('washing moves both hands and bounds water/soap to an active confirmed use',()=>{
 const rig=adultModel(),f={x:7,y:1,w:1,h:1,rotation:0},track=startActivity(f,{kind:'Wash'}, {x:7.5,z:2.5,yaw:0},0);
 rig.pose(.1,0,'Wash',false,{activityTime:.1});const angle=rig.arms[0].elbow.rotation.x;rig.pose(.2,0,'Wash',false,{activityTime:.2});assert.notEqual(rig.arms[0].elbow.rotation.x,angle);
 const effects=createActivityEffects();effects.update(f,sampleActivity(track,500,{x:7.5,z:2.5}).water,500);assert.equal(effects.root.visible,false);effects.update(f,sampleActivity(track,2000,{x:7.5,z:2.5}).water,2000);assert.equal(effects.root.visible,true);assert.equal(effects.root.children.length,15);effects.update(f,0,10000);assert.equal(effects.root.visible,false);effects.dispose();disposeModels(rig.root);
});
test('furniture routes reach the front across rotations and refuse a blocked front',async()=>{
 const dom=new JSDOM('',{runScripts:'outside-only'});try{dom.window.eval(await readFile(new URL('../web/walking.js',import.meta.url),'utf8'));const walking=(dom.window as unknown as {Walking:{approach:(world:unknown,f:unknown)=>{dx:number;dy:number}[]|null}}).Walking;
  for(const rotation of [0,90,180,270]){const f={x:3,y:3,w:2,h:2,rotation,action:'Sit'},world={home:{x:1,y:1,width:8,height:8,fixtures:[f]},position:{}},route=walking.approach(world,f)!;assert.ok(route);const end=route.reduce((p,d)=>({x:p.x+d.dx,y:p.y+d.dy}),{x:1,y:1});const dx=Math.round(Math.sin(-rotation*Math.PI/180)),dy=Math.round(Math.cos(-rotation*Math.PI/180));if(dx)assert.equal(end.x,dx>0?5:2);if(dy)assert.equal(end.y,dy>0?5:2);}
  const f={x:2,y:2,w:2,h:1,rotation:0,action:'Sit'},world={home:{x:0,y:0,width:7,height:7,fixtures:[f,{x:2,y:3,w:2,h:1}]},position:{}};assert.equal(walking.approach(world,f),null);
 }finally{dom.window.close();}
});
