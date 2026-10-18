import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {Vector3} from 'three';
// @ts-expect-error Browser module.
import {cameraStep,cameraPosition,clipCamera} from '../web/scene/camera.js';
// @ts-expect-error Browser module.
import {activityAnchor} from '../web/scene/motion.js';
// @ts-expect-error Browser module.
import {adultModel,disposeModels} from '../web/scene/models.js';
// @ts-expect-error Browser module.
import {createActivityEffects} from '../web/scene/activity-effects.js';
// @ts-expect-error Browser module.
import {activityTimeline} from '../web/scene/motion.js';
const close=(a:number,b:number)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
test('camera-relative movement remains cardinal and camera sweep stops before walls and furniture',()=>{
 for(const [yaw,expected] of [[0,[0,-1]],[Math.PI/2,[-1,0]],[Math.PI,[0,1]],[-Math.PI/2,[1,0]]] as [number,number[]][]){const step=cameraStep(0,-1,yaw);close(step.dx,expected[0]);close(step.dy,expected[1]);}
 for(let yaw=-6;yaw<6;yaw+=.1)for(const [x,y] of [[0,-1],[0,1],[-1,0],[1,0]]){const s=cameraStep(x,y,yaw);assert.equal(Math.abs(s.dx)+Math.abs(s.dy),1);}
 const target={x:0,y:1.3,z:0},desired=cameraPosition(target,0,.2,5),wall={min:{x:-2,y:0,z:2},max:{x:2,y:3,z:2.1}},point=clipCamera(target,desired,[wall]);assert.ok(point.z<1.78&&point.z>1.6);assert.deepEqual(clipCamera(target,desired,[]),desired);
 const overhead=cameraPosition(target,0,1.1,5);assert.deepEqual(clipCamera(target,overhead,[wall]),overhead);
});
test('server-clock activity phases lower before holding and stand before departure across rotated seats',()=>{
 for(const rotation of [0,90,180,270]){const f={x:3,y:3,w:rotation%180?1:3,h:rotation%180?3:1,rotation,model:'sofa'},from={x:2.5,z:5.5},input=JSON.stringify({f,from});
  assert.equal(activityTimeline('Sit',0,900).phase,'Approach');assert.equal(activityTimeline('Sit',0,900).weight,0);assert.equal(activityTimeline('Sit',0,2000).phase,'Lower');assert.equal(activityTimeline('Sit',0,4000).weight,1);assert.equal(activityTimeline('Sit',0,9300).phase,'Rise');assert.equal(activityTimeline('Sit',0,9900).weight,0);assert.equal(activityTimeline('Sit',0,10000).done,true);
  const anchor=activityAnchor(f,'Sit',from,1);assert.ok(Number.isFinite(anchor.yaw));assert.equal(JSON.stringify({f,from}),input);
 }
});
test('feet remain on the floor throughout lowering and standing for every adult frame',()=>{
 for(const frame of [.91,1,1.13]){const rig=adultModel({frame});for(const weight of [0,.1,.25,.5,.75,1]){rig.pose(0,0,'Sit',false,{activityWeight:weight});rig.root.updateMatrixWorld(true);for(const leg of rig.hips)close(leg.ankle.getWorldPosition(new Vector3()).y,.08);}disposeModels(rig.root);}
});
test('washing moves both hands and bounds water/soap to an active confirmed use',()=>{
 const rig=adultModel(),f={x:7,y:1,w:1,h:1,rotation:0};
 rig.pose(.1,0,'Wash',false,{activityPhase:'Rub'});const angle=rig.arms[0].elbow.rotation.x;rig.pose(.2,0,'Wash',false,{activityPhase:'Rub'});assert.notEqual(rig.arms[0].elbow.rotation.x,angle);
 const effects=createActivityEffects();effects.update({activity:{kind:'Wash'},fixture:f,timeline:activityTimeline('Wash',0,500),time:500,actor:rig});assert.equal(effects.root.children[0].visible,false);effects.update({activity:{kind:'Wash'},fixture:f,timeline:activityTimeline('Wash',0,4000),time:4000,actor:rig});assert.equal(effects.root.children[0].visible,true);assert.ok(effects.root.children[0].children.length<=30);effects.update();assert.equal(effects.root.children[0].visible,false);effects.dispose();disposeModels(rig.root);
});
test('furniture routes reach the front across rotations and refuse a blocked front',async()=>{
 const dom=new JSDOM('',{runScripts:'outside-only'});try{dom.window.eval(await readFile(new URL('../web/walking.js',import.meta.url),'utf8'));const walking=(dom.window as unknown as {Walking:{approach:(world:unknown,f:unknown)=>{dx:number;dy:number}[]|null}}).Walking;
  for(const rotation of [0,90,180,270]){const f={x:3,y:3,w:2,h:2,rotation,action:'Sit'},world={home:{x:1,y:1,width:8,height:8,fixtures:[f]},position:{}},route=walking.approach(world,f)!;assert.ok(route);const end=route.reduce((p,d)=>({x:p.x+d.dx,y:p.y+d.dy}),{x:1,y:1});const dx=Math.round(Math.sin(-rotation*Math.PI/180)),dy=Math.round(Math.cos(-rotation*Math.PI/180));if(dx)assert.equal(end.x,dx>0?5:2);if(dy)assert.equal(end.y,dy>0?5:2);}
  const f={x:2,y:2,w:2,h:1,rotation:0,action:'Sit'},world={home:{x:0,y:0,width:7,height:7,fixtures:[f,{x:2,y:3,w:2,h:1}]},position:{}};assert.equal(walking.approach(world,f),null);
 }finally{dom.window.close();}
});
