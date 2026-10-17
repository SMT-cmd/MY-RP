import {DomainError} from './domain.ts';
import type {State,Command} from './domain.ts';
import {streetWalkable,districtAt,MAP} from './neighbourhood.ts';
import {usableInterior} from './home-visits.ts';
import {homeStep} from './furnishing.ts';
import {venueFor,venueStep} from './venues.ts';
import {drivingMode,driveStepAllowed,reserveDriveRoute,checkpointDrivePosition,releaseDriveRoute} from './driving.ts';
export type NavigationPoint={x:number;y:number};
export type NavigationPlan={id:string;mode:'walk'|'drive';startedAt:number;stepMs:number;points:NavigationPoint[];leaseVersion:number;homeId?:string;layoutVersion?:number};
export const NAVIGATION_RULES={walkStepMs:300,driveStepMs:150,maxSteps:512};
const coords=(p:NonNullable<State['world']>['positions'][string]):NavigationPoint=>p.interior?{x:p.interiorX??4,y:p.interiorY??6}:{x:p.x,y:p.y};
function context(s:State,actor:string,now:number,mode:'walk'|'drive'){
 const p=s.world!.positions[actor];
 if(p.interior==='shelter'){const home=usableInterior(s,actor,now);return{width:home.width,height:home.height,homeId:home.id,layoutVersion:home.version,step:(a:NavigationPoint,b:NavigationPoint)=>homeStep(s,home,a.x,a.y,b.x,b.y)};}
 if(p.interior){const room=venueFor(p.interior);if(!room)throw new DomainError('INTERIOR_ACTIVE','Use the exit before walking in the city.');return{width:room.width,height:room.height,homeId:room.id,layoutVersion:room.version,step:(a:NavigationPoint,b:NavigationPoint)=>venueStep(room.id,a.x,a.y,b.x,b.y)};}
 return{width:MAP.width,height:MAP.height,homeId:undefined,layoutVersion:undefined,step:(a:NavigationPoint,b:NavigationPoint)=>mode==='drive'?driveStepAllowed(s,actor,a.x,a.y,b.x,b.y):streetWalkable(b.x,b.y)};
}
/** Project only server-issued paths, on the transaction copy before actions. */
export function settleNavigation(s:State,actor:string,now:number){
 const p=s.world?.positions[actor],nav=p?.navigation;if(!p||!nav)return;
 let valid=nav.leaseVersion===p.leaseVersion&&!s.world?.activeTrips[actor],ctx:ReturnType<typeof context>|undefined;
 try{ctx=context(s,actor,now,nav.mode);valid=valid&&ctx.homeId===nav.homeId&&ctx.layoutVersion===nav.layoutVersion&&(nav.mode!=='drive'||drivingMode(s,actor)==='drive');}catch{valid=false;}
 if(!valid||!ctx){if(nav.mode==='drive')releaseDriveRoute(s,actor,now,nav.id+':interrupted');delete p.navigation;return;}
 const target=Math.min(nav.points.length-1,Math.max(0,Math.floor((now-nav.startedAt)/nav.stepMs))),current=coords(p);
 let index=nav.points.findIndex((point,i)=>i<=target&&point.x===current.x&&point.y===current.y);
 if(index<0){delete p.navigation;if(nav.mode==='drive')releaseDriveRoute(s,actor,now,nav.id+':invalid');return;}
 for(;index<target;index++){
  const a=nav.points[index],b=nav.points[index+1];if(!ctx.step(a,b)){delete p.navigation;if(nav.mode==='drive')releaseDriveRoute(s,actor,now,nav.id+':blocked');return;}
  if(p.interior){p.interiorX=b.x;p.interiorY=b.y;}else{p.x=b.x;p.y=b.y;p.district=districtAt(b.x,b.y)??p.district;}
  p.facing=b.x>a.x?'right':b.x<a.x?'left':b.y>a.y?'front':'back';p.lastMoveAt=nav.startedAt+(index+1)*nav.stepMs;
  if(nav.mode==='drive')checkpointDrivePosition(s,actor,b.x,b.y,p.lastMoveAt);
 }
 if(target===nav.points.length-1){delete p.navigation;if(nav.mode==='drive')releaseDriveRoute(s,actor,now,nav.id+':arrived');}
}
export function stopNavigation(s:State,actor:string,now:number,key:string){settleNavigation(s,actor,now);const p=s.world?.positions[actor];if(p?.navigation?.mode==='drive')releaseDriveRoute(s,actor,now,key);if(p)delete p.navigation;}
export function navigationCommand(s:State,actor:string,c:Command,now:number,key:string):Record<string,unknown>|undefined{
 if(c.type!=='NavigateCitizen'&&c.type!=='StopNavigation')return;
 const allowed=c.type==='NavigateCitizen'?['x','y','leaseVersion']:['leaseVersion'];if(Object.keys(c.payload).some(k=>!allowed.includes(k)))throw new DomainError('INVALID_COMMAND','Send only the destination and current location lease.',400);
 const p=s.world?.positions[actor];if(!s.citizens[actor]||!p)throw new DomainError('CITIZEN_REQUIRED','Create your citizen first.');
 if(c.payload.leaseVersion!==p.leaseVersion)throw new DomainError('STALE_LEASE','Your location changed. Refresh before moving again.');
 if(s.world?.activeTrips[actor])throw new DomainError('IN_TRANSIT','Finish your current journey first.');
 if(c.type==='StopNavigation'){stopNavigation(s,actor,now,key);return{position:coords(p),leaseVersion:p.leaseVersion};}
 const {x,y}=c.payload;if(!Number.isInteger(x)||!Number.isInteger(y))throw new DomainError('INVALID_DESTINATION','Choose a reachable floor or road tile.',400);
 const mode=drivingMode(s,actor)==='drive'?'drive':'walk',ctx=context(s,actor,now,mode);
 if((x as number)<0||(y as number)<0||(x as number)>=ctx.width||(y as number)>=ctx.height)throw new DomainError('INVALID_DESTINATION','Choose a point inside this neighbourhood or room.',400);
 const start=coords(p),queue=[{...start,parent:-1}],seen=new Set([start.y*ctx.width+start.x]);let goal=-1;
 for(let i=0;i<queue.length;i++){const a=queue[i];if(a.x===x&&a.y===y){goal=i;break;}for(const [dx,dy]of [[0,1],[1,0],[0,-1],[-1,0]]){const b={x:a.x+dx,y:a.y+dy},id=b.y*ctx.width+b.x;if(b.x<0||b.y<0||b.x>=ctx.width||b.y>=ctx.height||seen.has(id)||!ctx.step(a,b))continue;seen.add(id);queue.push({...b,parent:i});}}
 if(goal<0)throw new DomainError('PATH_BLOCKED','There is no clear route to that point.');
 const points:NavigationPoint[]=[];for(let i=goal;i>=0;i=queue[i].parent)points.push({x:queue[i].x,y:queue[i].y});points.reverse();
 if(points.length>NAVIGATION_RULES.maxSteps+1)throw new DomainError('ROUTE_TOO_LONG','Choose a closer point before continuing.');
 stopNavigation(s,actor,now,key+':retarget');delete p.activity;if(points.length===1)return{position:start,arriveAt:now,leaseVersion:p.leaseVersion};
 if(mode==='drive')reserveDriveRoute(s,actor,points,now,key);
 const plan:NavigationPlan={id:key,mode,startedAt:now,stepMs:mode==='drive'?NAVIGATION_RULES.driveStepMs:NAVIGATION_RULES.walkStepMs,points,leaseVersion:p.leaseVersion,...(ctx.homeId?{homeId:ctx.homeId,layoutVersion:ctx.layoutVersion}:{})};p.navigation=plan;
 return{navigation:structuredClone(plan),arriveAt:now+(points.length-1)*plan.stepMs,leaseVersion:p.leaseVersion};
}
export function reconcileNavigation(s:State){
 for(const [actor,p]of Object.entries(s.world?.positions??{})){
  const nav=p.navigation;if(!nav)continue;const receipt=s.commands[nav.id]?.receipt,expected=nav.mode==='drive'?NAVIGATION_RULES.driveStepMs:NAVIGATION_RULES.walkStepMs;
  if(!receipt||receipt.actorId!==actor||!['NavigateCitizen','BeginShowroomShuttle'].includes(receipt.type)||JSON.stringify(receipt.detail.navigation)!==JSON.stringify(nav)||receipt.at!==nav.startedAt||nav.leaseVersion!==p.leaseVersion||nav.stepMs!==expected||!['walk','drive'].includes(nav.mode)||!Number.isSafeInteger(nav.startedAt)||!Array.isArray(nav.points)||nav.points.length<2||nav.points.length>NAVIGATION_RULES.maxSteps+1)throw new Error('Navigation receipt mismatch');
  const seen=new Set<string>();for(const [i,point]of nav.points.entries()){const id=point.x+':'+point.y;if(!Number.isInteger(point.x)||!Number.isInteger(point.y)||seen.has(id)||i>0&&Math.abs(point.x-nav.points[i-1].x)+Math.abs(point.y-nav.points[i-1].y)!==1)throw new Error('Invalid navigation path');seen.add(id);}
  const current=coords(p),index=nav.points.findIndex(t=>t.x===current.x&&t.y===current.y);if(index<0||index>0&&p.lastMoveAt!==nav.startedAt+index*nav.stepMs||nav.mode==='drive'&&drivingMode(s,actor)!=='drive'||p.interior==='shelter'&&nav.homeId!==p.homeId||!p.interior&&nav.homeId)throw new Error('Navigation checkpoint mismatch');
 }
}
