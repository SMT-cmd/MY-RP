import test from 'node:test';
import assert from 'node:assert/strict';
import {Box3,Vector3,Quaternion} from 'three';
// @ts-expect-error Original browser motion has no TypeScript declarations.
import {footTarget,adjacentMotion,sampleMotion,activityAnchor,WALK_STEP_MS} from '../web/scene/motion.js';
// @ts-expect-error Original browser geometry has no TypeScript declarations.
import {adultModel,disposeModels} from '../web/scene/models.js';
const close=(actual:number,expected:number,tolerance=1e-8)=>assert.ok(Math.abs(actual-expected)<tolerance,`${actual} should be ${expected}`);
test('stance feet stay planted at floor height as every adult frame travels forward',()=>{
 for(const frame of [.91,1,1.13]){
  const rig=adultModel({frame}),feet=[];
  for(const distance of [.10,.20,.30,.40,.50]){
   rig.root.position.z=distance;rig.pose(distance/1.5,1,null,false,{distance});rig.root.updateMatrixWorld(true);
   const foot=rig.hips[0].ankle.getWorldPosition(new Vector3());close(foot.y,.08);feet.push(foot.z);
   close(rig.hips[0].ankle.getWorldQuaternion(new Quaternion()).x,0);
  }
  for(const z of feet)close(z,feet[0]);disposeModels(rig.root);
 }
});
test('swing lifts the trailing foot and alternating feet share the same stride distance',()=>{
 const first=footTarget(.96,-1),second=footTarget(.36,1);assert.equal(first.stance,false);assert.ok(first.y>.18);close(first.y,second.y);close(first.z,second.z);
 const stance=footTarget(.24,-1);assert.equal(stance.stance,true);close(stance.y,.08);
});
test('motion sampling has the same travelled distance at 30 and 60 fps, with a stationary stop and reduced-motion snap',()=>{
 const move=adjacentMotion({x:4.5,z:6.5},{x:5.5,z:6.5},100);
 for(const fps of [30,60]){let previous=sampleMotion(move,100),distance=0;for(let time=100+1000/fps;time<100+WALK_STEP_MS;time+=1000/fps){const next=sampleMotion(move,time);distance+=Math.hypot(next.x-previous.x,next.z-previous.z);previous=next;}const last=sampleMotion(move,100+WALK_STEP_MS);distance+=Math.hypot(last.x-previous.x,last.z-previous.z);close(distance,1);assert.deepEqual(sampleMotion(move,10000),last);}
 assert.deepEqual(sampleMotion(move,100,true),{x:5.5,z:6.5,done:true});
});
test('seated pelvis matches cushions with grounded feet, and lying bodies fit the rotated bed footprint',()=>{
 const rig=adultModel();for(const seatHeight of [.50,.575]){rig.pose(0,0,'Sit',false,{seatHeight});rig.root.updateMatrixWorld(true);close(rig.hips[0].hip.getWorldPosition(new Vector3()).y,seatHeight+.015);for(const leg of rig.hips)close(leg.ankle.getWorldPosition(new Vector3()).y,.08);}
 for(const rotation of [0,90,180,270]){const f={x:2,y:2,w:2,h:2,rotation,model:'bed'},anchor=activityAnchor(f,'Rest',{x:1.5,z:2.5});rig.root.position.set(anchor.x,0,anchor.z);rig.root.rotation.y=anchor.yaw;rig.pose(0,0,'Rest');rig.root.updateMatrixWorld(true);const bounds=new Box3();rig.root.traverseVisible((o:{geometry?:unknown})=>{if(o.geometry)bounds.expandByObject(o as Parameters<Box3['expandByObject']>[0]);});assert.ok(bounds.min.x>=1.95&&bounds.max.x<=4.05);assert.ok(bounds.min.z>=1.95&&bounds.max.z<=4.05);assert.ok(bounds.min.y>.50&&bounds.max.y<1.2);}
 disposeModels(rig.root);
});
test('standing interactions face the actual fixture without changing the confirmed walking position',()=>{
 for(const rotation of [0,90,180,270]){const fixture={x:7,y:1,w:1,h:1,rotation,model:'sink'},position={x:6.5,z:1.5},anchor=activityAnchor(fixture,'Wash',position);assert.deepEqual({x:anchor.x,z:anchor.z},position);close(anchor.yaw,Math.PI/2);}
 const rig=adultModel();rig.pose(4.65,0,null);assert.ok(rig.eyes.every((eye:{scale:{y:number}})=>eye.scale.y<1));rig.pose(4.65,0,null,true);assert.ok(rig.eyes.every((eye:{scale:{y:number}})=>eye.scale.y===1));disposeModels(rig.root);
});
test('all adult frames use three distinct grounded sofa seats across every quarter turn without intersecting neighbouring seated bodies',()=>{
 for(const rotation of [0,90,180,270])for(const frame of [.91,1,1.13]){
  const f={x:3,y:3,w:rotation%180?1:3,h:rotation%180?3:1,rotation,model:'sofa'},bounds:Box3[]=[],points=[];
  for(let slot=0;slot<3;slot++){const a=activityAnchor(f,'Sit',{x:3.5,z:4.5},slot),rig=adultModel({frame});rig.root.position.set(a.x,0,a.z);rig.root.rotation.y=a.yaw;rig.pose(0,0,'Sit',false,{seatHeight:a.seatHeight});rig.root.updateMatrixWorld(true);const b=new Box3();rig.root.traverseVisible((o:{geometry?:unknown})=>{if(o.geometry)b.expandByObject(o as Parameters<Box3['expandByObject']>[0]);});bounds.push(b);points.push(a);for(const leg of rig.hips)close(leg.ankle.getWorldPosition(new Vector3()).y,.08);disposeModels(rig.root);}
  for(let i=1;i<3;i++){close(Math.hypot(points[i].x-points[i-1].x,points[i].z-points[i-1].z),1);assert.equal(bounds[i].intersectsBox(bounds[i-1]),false);}
 }
});
