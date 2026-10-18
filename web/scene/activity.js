import {activityAnchor} from './motion.js';
const clamp=n=>Math.max(0,Math.min(1,n));
const smooth=n=>{const t=clamp(n);return t*t*(3-2*t);};
const turn=(a,b,t)=>a+Math.atan2(Math.sin(b-a),Math.cos(b-a))*t;
const mix=(a,b,t)=>a+(b-a)*t;
export const ACTIVITY_TIMING={approach:650,turn:350,settle:800,exit:1000,duration:10000};
export function startActivity(fixture,activity,position,time,age=0){
 return{key:JSON.stringify(activity),fixture:{...fixture},kind:activity.kind,slot:activity.slot,from:{...position},start:time-Math.max(0,age)};
}
// Same sequence for the local citizen and privacy-filtered neighbours. Never
// writes a position, reward, water entitlement, or activity back to the server.
export function sampleActivity(track,time,fallback,reduced=false){
 if(!track)return null;
 if(time<track.start)return null;
 const {fixture:f,kind,from}=track,anchor=activityAnchor(f,kind,from,track.slot),elapsed=Math.max(0,time-track.start);
 if(kind==='Wash'){
  const cx=f.x+f.w/2,cz=f.y+f.h/2,dx=from.x-cx,dz=from.z-cz;
  if(Math.abs(dx)>Math.abs(dz)){anchor.x=cx+Math.sign(dx)*(f.w/2+.12);anchor.z=from.z;}
  else{anchor.x=from.x;anchor.z=cz+Math.sign(dz)*(f.h/2+.12);}
 }
 if(track.exit){
  const t=(time-track.exit.start)/700;if(t>=1)return null;
  const standing=smooth(t/.6),walking=smooth((t-.6)/.4),p=track.exit.pose;
  return{...p,x:mix(p.x,fallback.x,walking),z:mix(p.z,fallback.z,walking),weight:p.weight*(1-standing),walkWeight:t>.6?1:0,phase:t<.6?'standing':'leaving',water:0};
 }
 if(elapsed>=ACTIVITY_TIMING.duration)return null;
 const seat=kind==='Sit'||kind==='Rest',out=Math.max(0,elapsed-(ACTIVITY_TIMING.duration-ACTIVITY_TIMING.exit));
 if(out>0){
  const standing=smooth(out/600),leaving=smooth((out-600)/400);
  return{kind,x:mix(anchor.x,from.x,leaving),z:mix(anchor.z,from.z,leaving),yaw:anchor.yaw,seatHeight:anchor.seatHeight,weight:1-standing,walkWeight:out>600?1:0,phase:out<600?'standing':'leaving',water:0};
 }
 const approach=reduced?1:smooth(elapsed/650),turning=reduced?1:smooth((elapsed-650)/350),settling=reduced?1:smooth((elapsed-1000)/800);
 // The route planner brings the citizen to the front; finish the small final
 // approach before turning and lowering. No instantaneous seat-centre jump.
 const depth=(f.rotation??0)%180?f.w:f.h,front={x:Math.sin(anchor.yaw),z:Math.cos(anchor.yaw)};
 const inFront=(from.x-(f.x+f.w/2))*front.x+(from.z-(f.y+f.h/2))*front.z>=depth/2-.05;
 const near=seat&&inFront?{x:anchor.x+front.x*(depth/2+.40),z:anchor.z+front.z*(depth/2+.40)}:{x:from.x,z:from.z},facing=anchor.yaw;
 const approached={x:mix(from.x,near.x,approach),z:mix(from.z,near.z,approach)};
 const position=seat?{x:mix(approached.x,anchor.x,settling),z:mix(approached.z,anchor.z,settling)}:{x:mix(from.x,anchor.x,approach),z:mix(from.z,anchor.z,approach)};
 const startYaw=from.yaw??facing;
 return{kind,...position,yaw:turn(startYaw,facing,turning),seatHeight:anchor.seatHeight,weight:seat?settling:approach,walkWeight:seat&&elapsed<650?1:0,phase:elapsed<650?'approaching':elapsed<1000?'turning':elapsed<1800?'settling':'using',water:kind==='Wash'&&elapsed>=1000&&elapsed<8500?1:0};
}
export function stopActivity(track,time,fallback,reduced=false){
 if(!track||track.exit)return track;const pose=sampleActivity(track,time,fallback,reduced);
 return pose?{...track,exit:{start:time,pose}}:null;
}
