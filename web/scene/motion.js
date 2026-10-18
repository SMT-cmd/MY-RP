// Presentation only: metre-scale joints and contact targets never alter authority.
export const WALK_STEP_MS=300;
export const STRIDE_METRES=1.2;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const smooth=t=>{const n=clamp(t,0,1);return n*n*(3-2*n);};
export const ACTIVITY_DURATIONS={Sit:10000,Read:10000,Dress:10000,Rest:10000,Wash:10000,Toilet:14000,Shower:18000,Clean:12000};
// Server-clock phases survive presence updates and account view refreshes.
export function activityTimeline(kind,startedAt,now,endsAt=startedAt+(ACTIVITY_DURATIONS[kind]??10000)){
 const progress=clamp((now-startedAt)/Math.max(1,endsAt-startedAt),0,1);
 const phases=kind==='Wash'?[[.12,'Approach'],[.22,'ReachTap'],[.58,'Rub'],[.76,'Rinse'],[.91,'Dry'],[1,'Rise']]:kind==='Shower'?[[.12,'Approach'],[.20,'ReachTap'],[.62,'Rub'],[.78,'Rinse'],[.93,'Dry'],[1,'Rise']]:kind==='Clean'?[[.12,'Approach'],[.72,'Scrub'],[.84,'Rinse'],[.94,'Dry'],[1,'Rise']]:kind==='Toilet'?[[.14,'Approach'],[.25,'Lower'],[.79,'Hold'],[.90,'Flush'],[1,'Rise']]:kind==='Rest'?[[.16,'Approach'],[.30,'Lower'],[.86,'Rest'],[1,'Rise']]:kind==='Sit'?[[.15,'Approach'],[.28,'Lower'],[.88,'Hold'],[1,'Rise']]:[[.15,'Approach'],[.88,kind==='Read'?'Read':'Dress'],[1,'Rise']];
 let from=0,phase='Rise',phaseProgress=1;for(const [end,name] of phases){if(progress<end||end===1){phase=name;phaseProgress=clamp((progress-from)/(end-from),0,1);break;}from=end;}
 const lower=phases.find(p=>p[1]==='Lower'),approach=phases[0][0],riseStart=phases[phases.length-2][0],rise=(progress-riseStart)/(1-riseStart);
 const weight=progress>=riseStart?1-smooth(rise/.55):lower?smooth((progress-approach)/(lower[0]-approach)):smooth(progress/approach);
 const contactWeight=progress<approach?smooth(progress/approach):progress>=riseStart?1-smooth((rise-.55)/.45):1;
 return{kind,phase,progress,phaseProgress,weight,contactWeight,walkWeight:phase==='Approach'||phase==='Rise'&&rise>.55?1:0,water:['ReachTap','Rub','Rinse'].includes(phase)&&['Wash','Shower'].includes(kind)||kind==='Clean'&&phase==='Rinse',foam:['Rub','Scrub'].includes(phase),towel:phase==='Dry',flush:phase==='Flush',scrub:phase==='Scrub',done:progress>=1};
}
export function fixtureApproachCells(f,slot){
 const rotation=((f.rotation??0)%360+360)%360,front=rotation===90?{x:-1,y:0}:rotation===180?{x:0,y:-1}:rotation===270?{x:1,y:0}:{x:0,y:1};
 if(f.action==='Rest'){const cells=[];if(rotation%180===0){for(let y=f.y;y<f.y+f.h;y++)cells.push({x:f.x-1,y},{x:f.x+f.w,y});}else for(let x=f.x;x<f.x+f.w;x++)cells.push({x,y:f.y-1},{x,y:f.y+f.h});return cells;}
 const cells=[];if(front.y)for(let x=f.x;x<f.x+f.w;x++)cells.push({x,y:front.y>0?f.y+f.h:f.y-1});else for(let y=f.y;y<f.y+f.h;y++)cells.push({x:front.x>0?f.x+f.w:f.x-1,y});
 if(slot!==undefined&&cells.length>1){const i=rotation===90||rotation===180?cells.length-1-slot:slot;return[cells[clamp(i,0,cells.length-1)],...cells.filter((_,n)=>n!==i)];}return cells;
}
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
 if(kind==='Sit'||kind==='Toilet'){
  // Cushion centre, with room for knees toward the front of the furnishing.
  const depth=(fixture.rotation??0)%180?fixture.w:fixture.h,offset=depth*.06,capacity=fixture.seats||(fixture.model==='sofa'?3:1),lateral=(slot??(capacity-1)/2)-(capacity-1)/2;
  return{x:fixture.x+fixture.w/2+Math.cos(rotation)*lateral+Math.sin(rotation)*offset,z:fixture.y+fixture.h/2-Math.sin(rotation)*lateral+Math.cos(rotation)*offset,yaw:rotation,seatHeight:kind==='Toilet'?.47:(fixture.kind??fixture.model)==='bench'?.50:.575};
 }
 if(kind==='Shower')return{x:fixture.x+fixture.w/2,z:fixture.y+fixture.h/2,yaw:rotation,seatHeight:0};
 return{x:position.x,z:position.z,yaw:Math.atan2(fixture.x+fixture.w/2-position.x,fixture.y+fixture.h/2-position.z),seatHeight:0};
}
export function adjacentMotion(from,to,start,duration=WALK_STEP_MS){return{from:{...from},to:{...to},start,end:start+duration};}
export function sampleMotion(motion,time,reduced=false){
 const t=reduced?1:clamp((time-motion.start)/(motion.end-motion.start),0,1);
 return{x:motion.from.x+(motion.to.x-motion.from.x)*t,z:motion.from.z+(motion.to.z-motion.from.z)*t,done:t===1};
}
// Local cancellation finishes standing before catching up to confirmed walking.
export function sampleDeparture(departure,time,destination,reduced=false){
 if(!departure)return null;const t=reduced?1:clamp((time-departure.start)/700,0,1);if(t>=1)return null;const travel=smooth((t-.55)/.45);
 return{x:departure.x+(destination.x-departure.x)*travel,z:departure.z+(destination.z-departure.z)*travel,weight:departure.weight*(1-smooth(t/.55)),walking:t>.55};
}
