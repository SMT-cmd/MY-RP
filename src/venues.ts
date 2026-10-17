import {createHash} from 'node:crypto';
import {DomainError} from './domain.ts';
import type {State,Command} from './domain.ts';
import {FURNITURE,FINISHES,furnishingCommand} from './furnishing.ts';
import {STARTER_JOBS,workCommand,workView} from './jobs.ts';
import {citizenLife} from './life.ts';

// Public rooms are physical places; their economic actions use the original domains.
type Fixture={id:string;name:string;model:string;kind:string;x:number;y:number;w:number;h:number;rotation:number;finish:string;action:string;copy:string;category?:string};
export type Venue={id:string;name:string;width:number;height:number;version:number;wall:string;floor:string;spawn:{x:number;y:number};exit:{x:number;y:number};fixtures:Fixture[];jobs:string[]};
type WorkVisit={actor:string;venueId:string;shiftId:string;beginKey:string;task:null|{id:string;commandKey:string;step:number;fixtureId:string;startedAt:number;readyAt:number;leaseVersion:number};completedTasks:number;version:number};
type FurnitureOrder={id:string;actor:string;furnitureId:string;modelId:string;region:string;purchasedAt:number;collectedAt:number|null;placedAt:number|null;homeId:string|null;xp:number;version:number;purchaseKey:string;collectKey?:string;placeKey?:string};
export type VenueState={work:Record<string,WorkVisit>;orders:Record<string,FurnitureOrder>;designXp:Record<string,number>};
export const VENUE_TASK_MS=5000,SHOWROOM_ENTRANCE={id:'showroom',name:'Marina Home Studio',x:25,y:16,w:5,h:4,door:{x:27,y:20},colour:0x7497a7};
export const VENUE_BUILDINGS=[{...SHOWROOM_ENTRANCE,facadeId:'facade-1-1-0'}];
const f=(id:string,name:string,model:string,x:number,y:number,w:number,h:number,action='service',category?:string):Fixture=>({id,name,model,kind:model,x,y,w,h,rotation:0,finish:'oak',action,copy:name,...(category?{category}:{})});
const room=(id:string,name:string,fixtures:Fixture[],jobs:string[]=[],width=14,height=12):Venue=>({id,name,width,height,version:1,wall:'cream',floor:id==='clinic'?'slate':'oak',spawn:{x:Math.floor(width/2),y:height-2},exit:{x:Math.floor(width/2),y:height-1},fixtures,jobs});
const stations=[f('work-reception','Shift supervisor','desk',2,2,2,1,'work-start'),f('work-0','Prepare the work area','sideboard',8,2,2,1,'work-task'),f('work-1','Carry out the assigned work','kitchen-island',8,6,2,1,'work-task'),f('work-2','Inspect and record completion','desk',2,7,2,1,'work-task')];
const VENUES:Venue[]=[
 room('work','Civic Works & Employment',stations,['cleaner','delivery-helper','construction-labourer','car-wash','farm-helper','warehouse-hand','courier']),
 room('market','Neighbourhood Market',[f('market-counter','Grocer & supplies','sideboard',2,2,3,1,'market'),f('market-food','Fresh produce','pantry',9,2,2,1,'market'),f('work-reception','Market supervisor','desk',2,5,2,1,'work-start'),f('work-0','Receive and check stock','sideboard',8,5,2,1,'work-task'),f('work-1','Sort produce & shelves','bookshelf',9,8,1,2,'work-task'),f('work-2','Reconcile the market count','desk',2,8,2,1,'work-task')],['market-assistant','shop-assistant']),
 room('school','Foundation Learning Centre',[f('school-reception','Learning adviser','desk',2,2,2,1,'school'),f('school-study','Lesson workstation','desk',8,3,2,1,'school'),f('school-library','Reference library','bookshelf',2,6,1,2,'school'),f('school-exam','Assessment desk','desk',8,7,2,1,'school')]),
 room('clinic','Community Health Centre',[f('clinic-reception','Clinical reception','desk',2,2,2,1,'clinic'),f('clinic-treatment','Treatment bay','bed',8,3,2,2,'clinic'),f('clinic-wash','Hand hygiene station','sink',2,7,1,1,'clinic')]),
 room('terminal','Neighbourhood Transport Hub',[f('terminal-tickets','Interstate ticket counter','desk',2,2,3,1,'terminal'),f('terminal-waiting','Passenger waiting area','sofa',9,2,3,1,'terminal'),f('work-reception','Boarding supervisor','desk',2,6,2,1,'work-start'),f('work-0','Inspect boarding area','sideboard',9,5,2,1,'work-task'),f('work-1','Check available capacity','desk',9,8,2,1,'work-task'),f('work-2','Record the boarding count','desk',2,9,2,1,'work-task')],['bus-assistant'],16,12),
 room('showroom','Marina Home Studio',[f('display-living','Living room collection','sofa',2,2,3,1,'shop','living'),f('display-bedroom','Bedroom collection','bed',8,2,2,2,'shop','bedroom'),f('display-storage','Wardrobes & storage','wardrobe',15,2,1,2,'shop','bedroom'),f('display-dining','Dining collection','dining-table',2,7,2,2,'shop','dining'),f('display-study','Work & study collection','desk',7,7,2,1,'shop','study'),f('display-kitchen','Kitchen & bath collection','kitchen-island',12,7,2,1,'shop','kitchen'),f('display-lighting','Lighting & decor collection','floor-lamp',17,7,1,1,'shop','lighting'),f('showroom-counter','Design adviser','desk',2,12,3,1,'shop'),f('showroom-pickup','Order collection point','sideboard',14,12,3,1,'pickup')],[],20,16)
];
const get=(s:State):VenueState=>s.venues??={work:{},orders:{},designXp:{}};
const hash=(key:string)=>createHash('sha256').update(key).digest('hex').slice(0,24);
export function venueFor(id:string|null|undefined){return VENUES.find(v=>v.id===id)??null;}
export function venueWalkable(id:string,x:number,y:number){const v=venueFor(id);return !!v&&Number.isInteger(x)&&Number.isInteger(y)&&x>=0&&y>=0&&x<v.width&&y<v.height&&!v.fixtures.some(f=>x>=f.x&&x<f.x+f.w&&y>=f.y&&y<f.y+f.h);}
export function venueStep(id:string,x:number,y:number,nx:number,ny:number){return Math.abs(nx-x)+Math.abs(ny-y)===1&&venueWalkable(id,nx,ny);}
function distance(x:number,y:number,f:Fixture){return Math.max(f.x-x,0,x-(f.x+f.w-1))+Math.max(f.y-y,0,y-(f.y+f.h-1));}
function local(s:State,actor:string,c:Command){
 const p=s.world?.positions[actor],v=venueFor(p?.interior);if(!s.citizens[actor])throw new DomainError('CITIZEN_REQUIRED','Create your citizen first.');
 if(!p||!v||s.world?.activeTrips[actor])throw new DomainError('VENUE_REQUIRED','Walk into the appropriate service building first.');
 if(c.payload.leaseVersion!==p.leaseVersion)throw new DomainError('STALE_LEASE','Your location changed. Refresh before interacting.');return{p,v};
}
function beside(s:State,actor:string,c:Command,id:unknown){const {p,v}=local(s,actor,c),fixture=v.fixtures.find(f=>f.id===id);if(!fixture||distance(p.interiorX??v.spawn.x,p.interiorY??v.spawn.y,fixture)!==1)throw new DomainError('VENUE_DISTANCE','Walk beside the selected counter or workstation first.');return{p,v,fixture};}
export function venueCommand(s:State,actor:string,c:Command,now:number,key:string):Record<string,unknown>|undefined{
 const handled=['BeginVenueWork','BeginVenueTask','CompleteVenueTask','CompleteVenueWork','BuyShowroomFurniture','CollectShowroomFurniture'],physical=s.venues?.work[actor];
 if(physical&&['WorkStep','CompleteShift'].includes(c.type))throw new DomainError('VENUE_WORKSTATION','Complete this physical shift at its workstations and supervisor.');
 if(physical&&c.type==='CancelWork'){const result=workCommand(s,actor,c,now,key);delete get(s).work[actor];const p=s.world?.positions[actor];if(p?.activity?.kind==='Work')delete p.activity;return result;}
 if(c.type==='PlaceFurniture'){
  const order=Object.values(s.venues?.orders??{}).find(o=>o.furnitureId===c.payload.furnitureId);if(!order)return;
  if(order.actor!==actor)throw new DomainError('FURNITURE_PERMISSION','This order belongs to another resident.',403);
  if(order.collectedAt===null)throw new DomainError('COLLECTION_REQUIRED','Collect your order at the showroom before bringing it home.');
  const result=furnishingCommand(s,actor,c,now,key)!;
  if(order.placedAt===null){order.placedAt=now;order.homeId=s.furnishing!.items[order.furnitureId].homeId;order.placeKey=key;order.xp=25;order.version++;get(s).designXp[actor]=(get(s).designXp[actor]??0)+order.xp;citizenLife(s,s.citizens[actor],now).skills['home-design']=(s.citizens[actor].life!.skills['home-design']??0)+order.xp;return{...result,homeId:order.homeId,orderId:order.id,designXp:order.xp,totalDesignXp:get(s).designXp[actor],message:'Your collected furniture is installed. +25 Home Design XP.'};}return result;
 }
 if(!handled.includes(c.type))return;const state=get(s),payload=c.payload;
 if(c.type==='BeginVenueWork'){
  const {p,v}=beside(s,actor,c,'work-reception');if(!v.jobs.includes(String(payload.jobId)))throw new DomainError('VENUE_JOB','Choose a shift offered by this supervisor.');
  const result=workCommand(s,actor,{...c,type:'BeginWork',payload:{jobId:payload.jobId}},now,key)!;state.work[actor]={actor,venueId:v.id,shiftId:String(result.shiftId),beginKey:key,task:null,completedTasks:0,version:1};delete p.activity;return{...result,venueId:v.id,message:'Your secured shift is ready. Walk to the highlighted workstation to begin the first task.'};
 }
 if(['BeginVenueTask','CompleteVenueTask','CompleteVenueWork'].includes(c.type)){
  const visit=state.work[actor],active=s.life?.work?.shifts[visit?.shiftId];if(!visit||!active||active.actorId!==actor||active.status!=='active'||s.life?.work?.active[actor]!==active.id)throw new DomainError('VENUE_WORK_REQUIRED','Begin a physical shift at the supervisor first.');
  const {p,v}=local(s,actor,c);if(v.id!==visit.venueId)throw new DomainError('VENUE_WORK_LOCATION','Return to the workplace where this shift began.');
  if(c.type==='CompleteVenueWork'){beside(s,actor,c,'work-reception');if(visit.completedTasks!==3||visit.task)throw new DomainError('VENUE_TASKS_REQUIRED','Complete all three physical workstations first.');const result=workCommand(s,actor,{...c,type:'CompleteShift',payload:{shiftId:active.id}},now,key)!;delete p.activity;delete state.work[actor];return{...result,venueId:v.id};}
  const fixtureId='work-'+active.steps,{fixture}=beside(s,actor,c,fixtureId);
  if(c.type==='BeginVenueTask'){
   if(visit.task&&p.activity?.kind==='Work'&&p.activity.fixtureId===visit.task.fixtureId&&p.activity.startedAt===visit.task.startedAt&&visit.task.leaseVersion===p.leaseVersion)throw new DomainError('VENUE_TASK_ACTIVE','Finish the current workstation task first.');
   if(active.steps!==visit.completedTasks||active.steps>=3)throw new DomainError('VENUE_TASK_CHANGED','The work task changed. Refresh the current workstation.');
   visit.task={id:'venue-task_'+hash(key),commandKey:key,step:active.steps,fixtureId,startedAt:now,readyAt:now+VENUE_TASK_MS,leaseVersion:p.leaseVersion};visit.version++;p.activity={kind:'Work',fixtureId,startedAt:now};return{taskId:visit.task.id,shiftId:active.id,step:active.steps,readyAt:visit.task.readyAt,fixtureId,venueId:v.id,message:'Work in progress. Stay beside this station while the task completes.'};
  }
  const task=visit.task;if(!task||payload.taskId!==task.id||task.step!==active.steps||task.leaseVersion!==p.leaseVersion||p.activity?.kind!=='Work'||p.activity.fixtureId!==fixture.id||p.activity.startedAt!==task.startedAt)throw new DomainError('VENUE_TASK_INTERRUPTED','This task was interrupted. Resume it from the workstation.');
  if(now<task.readyAt)throw new DomainError('VENUE_TASK_PENDING','The physical task is still in progress.');const job=STARTER_JOBS.find(j=>j.id===active.jobId)!,result=workCommand(s,actor,{...c,type:'WorkStep',payload:{shiftId:active.id,choice:job.tasks[active.steps].correct}},now,key)!;visit.completedTasks++;visit.task=null;visit.version++;delete p.activity;return{...result,taskId:task.id,shiftId:active.id,fixtureId,venueId:v.id,message:visit.completedTasks===3?'Workstations complete. Return to the supervisor when the reserved shift interval ends.':'Task completed. Walk to the next highlighted workstation.'};
 }
 const {v}=local(s,actor,c);if(v.id!=='showroom')throw new DomainError('SHOWROOM_REQUIRED','Visit Marina Home Studio to buy or collect a showroom order.');
 if(c.type==='BuyShowroomFurniture'){
  const {fixture}=beside(s,actor,c,payload.fixtureId),model=FURNITURE.find(m=>m.id===payload.modelId);if(fixture.action!=='shop'||!model||fixture.category&&fixture.category!==model.category)throw new DomainError('SHOWROOM_DISPLAY','Choose an item from this display collection.');const result=furnishingCommand(s,actor,{...c,type:'BuyFurniture'},now,key)!,id='showroom-order_'+hash(key),furnitureId=String(result.furnitureId);state.orders[id]={id,actor,furnitureId,modelId:model.id,region:s.world!.positions[actor].region,purchasedAt:now,collectedAt:null,placedAt:null,homeId:null,xp:0,version:1,purchaseKey:key};return{...result,orderId:id,modelId:model.id,region:s.world!.positions[actor].region,message:'Your paid order is ready at the collection counter. Collect it, return home and choose its position.'};
 }
 beside(s,actor,c,'showroom-pickup');const order=state.orders[String(payload.orderId)];if(!order||order.actor!==actor||order.region!==s.world!.positions[actor].region)throw new DomainError('ORDER_PERMISSION','Choose one of your orders from this regional showroom.',403);if(order.collectedAt!==null)throw new DomainError('ORDER_COLLECTED','This order has already been collected.');const item=s.furnishing?.items[order.furnitureId];if(!item||item.owner!==actor||item.homeId||item.placement)throw new Error('Showroom order custody mismatch');order.collectedAt=now;order.collectKey=key;order.version++;return{orderId:order.id,furnitureId:order.furnitureId,message:'Order collected. Bring it home, then place it to earn Home Design XP.'};
}
export function venueView(s:State,actor:string,now:number){
 const p=s.world?.positions[actor],v=venueFor(p?.interior);if(!p||!v)return null;const visit=s.venues?.work[actor],active=visit?.venueId===v.id?s.life?.work?.shifts[visit.shiftId]:null,physical=active?.status==='active'?visit:null,task=physical?.task?(({commandKey,...task})=>task)(physical.task):null;
 return{...structuredClone(v),x:p.interiorX??v.spawn.x,y:p.interiorY??v.spawn.y,fixtures:v.fixtures.map(f=>({...f,nearby:distance(p.interiorX??v.spawn.x,p.interiorY??v.spawn.y,f)===1,highlight:f.id===(physical&&physical.completedTasks<3?'work-'+physical.completedTasks:physical?'work-reception':null)})),jobs:workView(s,actor,now).jobs.filter(j=>v.jobs.includes(j.id)),activeWork:physical?{shiftId:physical.shiftId,completedTasks:physical.completedTasks,task,settlementAt:active!.startedAt+60000,ready:physical.completedTasks===3&&now>=active!.startedAt+60000}:null,task,catalogue:v.id==='showroom'?FURNITURE:[],finishes:FINISHES,orders:Object.values(s.venues?.orders??{}).filter(o=>o.actor===actor&&o.region===p.region).map(({actor,purchaseKey,collectKey,placeKey,...o})=>o),designXp:s.venues?.designXp[actor]??0};
}
export function reconcileVenues(s:State){
 const v=s.venues;if(!v)return;const ids=new Set<string>();for(const o of Object.values(v.orders)){
  const item=s.furnishing?.items[o.furnitureId],purchase=s.commands[o.purchaseKey]?.receipt,collection=o.collectKey?s.commands[o.collectKey]?.receipt:null,placement=o.placeKey?s.commands[o.placeKey]?.receipt:null;
  if(!s.citizens[o.actor]||!item||item.owner!==o.actor||item.model!==o.modelId||item.purchaseKey!==o.purchaseKey||o.id!=='showroom-order_'+hash(o.purchaseKey)||ids.has(item.id)||!Number.isSafeInteger(o.xp)||o.xp!==(o.placedAt===null?0:25)||o.placedAt!==null&&(o.collectedAt===null||!o.homeId)||o.collectedAt===null&&(item.homeId!==null||item.placement!==null)||o.version!==1+(o.collectedAt===null?0:1)+(o.placedAt===null?0:1))throw new Error('Showroom order reconciliation mismatch');
  if(!purchase||purchase.type!=='BuyShowroomFurniture'||purchase.actorId!==o.actor||purchase.at!==o.purchasedAt||purchase.detail.orderId!==o.id||purchase.detail.furnitureId!==o.furnitureId||purchase.detail.modelId!==o.modelId||purchase.detail.region!==o.region)throw new Error('Showroom order lacks purchase evidence');
  if(o.collectedAt!==null&&(!collection||collection.type!=='CollectShowroomFurniture'||collection.actorId!==o.actor||collection.at!==o.collectedAt||collection.detail.orderId!==o.id||collection.detail.furnitureId!==o.furnitureId)||o.collectedAt===null&&o.collectKey)throw new Error('Showroom order lacks collection evidence');
  if(o.placedAt!==null&&(!placement||placement.type!=='PlaceFurniture'||placement.actorId!==o.actor||placement.at!==o.placedAt||placement.detail.orderId!==o.id||placement.detail.furnitureId!==o.furnitureId||placement.detail.designXp!==25||placement.detail.homeId!==o.homeId)||o.placedAt===null&&(o.placeKey||o.xp))throw new Error('Showroom order lacks placement evidence');ids.add(item.id);
 }
 for(const actor of new Set([...Object.keys(v.designXp),...Object.values(v.orders).map(o=>o.actor)]))if((v.designXp[actor]??0)!==Object.values(v.orders).filter(o=>o.actor===actor).reduce((n,o)=>n+o.xp,0)||(v.designXp[actor]??0)!==(s.citizens[actor]?.life?.skills['home-design']??0))throw new Error('Home Design XP reconciliation mismatch');
 for(const [actor,visit] of Object.entries(v.work)){
  const shift=s.life?.work?.shifts[visit.shiftId],begin=s.commands[visit.beginKey]?.receipt;if(visit.actor!==actor||!s.citizens[actor]||!venueFor(visit.venueId)||!shift||shift.status!=='active'||shift.actorId!==actor||visit.shiftId!=='shift_'+visit.beginKey||visit.completedTasks<0||visit.completedTasks>3||shift.steps!==visit.completedTasks||!begin||begin.type!=='BeginVenueWork'||begin.actorId!==actor||begin.detail.venueId!==visit.venueId||begin.detail.shiftId!==visit.shiftId)throw new Error('Physical workplace reconciliation mismatch');
  const completed=Object.values(s.commands).filter(c=>c.receipt.actorId===actor&&c.receipt.type==='CompleteVenueTask'&&c.receipt.detail.shiftId===shift.id);if(completed.length!==visit.completedTasks)throw new Error('Physical work lacks completed station evidence');
  if(visit.task){const task=visit.task,receipt=s.commands[task.commandKey]?.receipt;if(!receipt||receipt.type!=='BeginVenueTask'||receipt.actorId!==actor||receipt.at!==task.startedAt||receipt.detail.taskId!==task.id||receipt.detail.shiftId!==shift.id||receipt.detail.step!==task.step||receipt.detail.fixtureId!==task.fixtureId||task.step!==visit.completedTasks||task.fixtureId!=='work-'+task.step||task.id!=='venue-task_'+hash(task.commandKey)||task.readyAt!==task.startedAt+VENUE_TASK_MS)throw new Error('Physical workstation lacks timed start evidence');}
 }
}
