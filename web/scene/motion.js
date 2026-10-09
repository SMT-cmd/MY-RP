// Presentation only: metre-scale joints and contact targets never alter authority.
export const WALK_STEP_MS=650;
export const STRIDE_METRES=1.2;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export function footTarget(distance,side,weight=1){
 const phase=((distance/STRIDE_METRES+(side<0?0:.5))%1+1)%1;
 const stance=phase<.6,t=(phase-.6)/.4;
 const z=stance?.36-phase*STRIDE_METRES:-.36+.72*(t*t*(3-2*t));
 return{z:z*weight,y:.08+(stance?0:.13*Math.sin(Math.PI*t))*weight,stance,phase};
}
export function legAngles(z,hipY,footY){
 const length=.43,vertical=hipY-footY,r=clamp(Math.hypot(vertical,z),.001,length*2);
 const hip=Math.atan2(-z,vertical)-Math.acos(clamp(r/(length*2),-1,1));
 const knee=Math.PI-Math.acos(clamp((2*length*length-r*r)/(2*length*length),-1,1));
 return{hip,knee,ankle:-hip-knee};
}
export function activityAnchor(fixture,kind,position,slot){
 const rotation=-(fixture.rotation??0)*Math.PI/180;
 if(kind==='Rest')return{x:fixture.x+fixture.w/2,z:fixture.y+fixture.h/2,yaw:rotation,seatHeight:0};
 if(kind==='Sit'){
  // Cushion centre, with room for knees toward the front of the furnishing.
  const depth=(fixture.rotation??0)%180?fixture.w:fixture.h,offset=depth*.06,capacity=fixture.model==='sofa'?3:1,lateral=(slot??(capacity-1)/2)-(capacity-1)/2;
  return{x:fixture.x+fixture.w/2+Math.cos(rotation)*lateral+Math.sin(rotation)*offset,z:fixture.y+fixture.h/2-Math.sin(rotation)*lateral+Math.cos(rotation)*offset,yaw:rotation,seatHeight:fixture.model==='bench'?.50:.575};
 }
 return{x:position.x,z:position.z,yaw:Math.atan2(fixture.x+fixture.w/2-position.x,fixture.y+fixture.h/2-position.z),seatHeight:0};
}
export function adjacentMotion(from,to,start,duration=WALK_STEP_MS){return{from:{...from},to:{...to},start,end:start+duration};}
export function sampleMotion(motion,time,reduced=false){
 const t=reduced?1:clamp((time-motion.start)/(motion.end-motion.start),0,1);
 return{x:motion.from.x+(motion.to.x-motion.from.x)*t,z:motion.from.z+(motion.to.z-motion.from.z)*t,done:t===1};
}
