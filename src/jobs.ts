import { DomainError,DAY,RULES,post } from './domain.ts';
import type { State,Command } from './domain.ts';
import { citizenLife,activeNeeds,initialLife } from './life.ts';
const task=(label:string,choices:string[],correct:number)=>({label,choices,correct});
export const STARTER_JOBS=[
  {id:'cleaner',name:'Cleaner',skill:'reliability',tasks:[task('Prepare the work area',['Mark the wet area','Hide the warning sign','Block the exit'],0),task('Handle sorted waste',['Mix everything','Use the marked collection bins','Leave it in the road'],1),task('Finish the area check',['Inspect and report completion','Ignore a remaining hazard','Claim a second wage'],0)]},
  {id:'shop-assistant',name:'Shop assistant',skill:'service',tasks:[task('Receive stock',['Ignore the delivery note','Count against the delivery note','Set your own stock reward'],1),task('Arrange shelves',['Keep expiry labels visible','Cover expiry labels','Mix damaged goods in'],0),task('Close the task',['Reconcile the shelf count','Delete the stock record','Take customer funds'],0)]},
  {id:'delivery-helper',name:'Delivery helper',skill:'logistics',tasks:[task('Check the parcel',['Check the manifest and seal','Open private contents','Change its owner'],0),task('Prepare handoff',['Leave it unattended','Use the recorded carrier','Skip custody'],1),task('Record the task',['Use the verified handoff record','Invent a delivery','Claim twice'],0)]},
  {id:'market-assistant',name:'Market assistant',skill:'service',tasks:[task('Check the stall',['Inspect the price labels','Hide all prices','Mark food as medicine'],0),task('Sort produce',['Mix spoiled stock in','Separate damaged produce','Delete all stock'],1),task('Record the count',['Record the verified units','Invent extra units','Take the trader’s wallet'],0)]},
  {id:'construction-labourer',name:'Construction labourer',skill:'construction',tasks:[task('Check the worksite',['Ignore the barrier','Use the marked safe area','Stand under lifting equipment'],1),task('Handle materials',['Check the approved load','Overload the trolley','Throw supplies away'],0),task('Finish the task',['Report the completed load','Certify the building yourself','Skip inspection'],0)]},
  {id:'car-wash',name:'Car wash worker',skill:'maintenance',tasks:[task('Inspect the vehicle',['Record existing damage','Hide damage','Take the vehicle keys home'],0),task('Wash safely',['Use approved cleaning supplies','Use fuel as cleaner','Disable the brakes'],0),task('Finish the service',['Record the completed wash','Transfer vehicle ownership','Invent a second customer'],0)]},
  {id:'farm-helper',name:'Farm helper',skill:'farming',tasks:[task('Check the row',['Use the assigned crop row','Harvest another farm','Change land ownership'],0),task('Handle produce',['Mix in spoiled produce','Sort the approved harvest','Hide the batch record'],1),task('Record the harvest',['Use the verified batch count','Create extra produce','Claim land as pay'],0)]},
  {id:'warehouse-hand',name:'Warehouse hand',skill:'logistics',tasks:[task('Inspect the pallet',['Check its manifest','Ignore its label','Break the seal'],0),task('Place the stock',['Use its recorded bay','Block emergency access','Hide it outside'],0),task('Finish the count',['Reconcile the bay count','Invent another pallet','Change its owner'],0)]},
  {id:'bus-assistant',name:'Bus assistant',skill:'transport',tasks:[task('Check the boarding area',['Use the marked boarding area','Block the road','Board through a closed exit'],0),task('Check capacity',['Ignore the passenger limit','Use the available-seat record','Sell the same seat twice'],1),task('Finish the task',['Confirm the boarding count','Take passenger wallets','Invent passengers'],0)]},
  {id:'courier',name:'Basic courier',skill:'logistics',tasks:[task('Check the delivery',['Match the parcel and address','Change the destination secretly','Open private contents'],0),task('Prepare the route',['Use the approved route','Skip the transport cost','Teleport the parcel'],0),task('Record handoff',['Keep the verified handoff','Invent a signature','Collect payment twice'],0)]}
];
export const WORK_DURATION=60000,STEP_INTERVAL=2000,REGION_DAILY_BUDGET=100000000;
type Shift={id:string;actorId:string;jobId:string;startedAt:number;lastStepAt:number;steps:number;wage:number;period:number;region:string;status:'active'|'completed'|'cancelled';completedAt:number|null;version:number};
export type WorkState={shifts:Record<string,Shift>;active:Record<string,string>;reserved:Record<string,number>};
const getWork=(state:State):WorkState=>state.life!.work??={shifts:{},active:{},reserved:{}};
const budgetKeys=(actor:string,region:string,period:number)=>['actor:'+actor+':'+period,'region:'+region+':'+period];
function release(state:State,shift:Shift){const work=getWork(state);for(const key of budgetKeys(shift.actorId,shift.region,shift.period))work.reserved[key]=(work.reserved[key]??0)-shift.wage;delete work.active[shift.actorId];}
export function workCommand(state:State,actor:string,command:Command,now:number,key:string):Record<string,unknown>|undefined{
  if(!['BeginWork','WorkStep','CancelWork','CompleteShift'].includes(command.type))return;
  const citizen=state.citizens[actor];if(!citizen)throw new DomainError('CITIZEN_REQUIRED','Create your citizen first.');citizenLife(state,citizen,now);activeNeeds(citizen,now);
  state.life??=initialLife();const work=getWork(state),active=work.active[actor]?work.shifts[work.active[actor]]:null,p=command.payload;
  if(command.type==='BeginWork'){
    const job=STARTER_JOBS.find(j=>j.id===p.jobId);if(!job)throw new DomainError('INVALID_JOB','Choose an available NPC starter job.',400);
    if(active)throw new DomainError('WORK_ACTIVE','Finish or cancel your existing task first.');
    if(citizen.lastShiftAt!==null&&now-citizen.lastShiftAt<RULES.shiftCooldown)throw new DomainError('SHIFT_COOLDOWN','Your next starter shift is not available yet.');
    const period=Math.floor(now/DAY),keys=budgetKeys(actor,citizen.state,period);
    if(keys.some((k,i)=>(state.npcSpend[k]??0)+(work.reserved[k]??0)+RULES.shiftPay>(i===0?RULES.dailyNpcBudget:REGION_DAILY_BUDGET)))throw new DomainError('NPC_BUDGET_LIMIT','Today’s protected work budget is committed.');
    const id='shift_'+key,shift:Shift={id,actorId:actor,jobId:job.id,startedAt:now,lastStepAt:now,steps:0,wage:RULES.shiftPay,period,region:citizen.state,status:'active',completedAt:null,version:1};
    post(state,key+':reserve',now,'Reserved NPC shift wage',[{account:'system:npc-wage-issuance',amount:-shift.wage},{account:'escrow:'+id,amount:shift.wage}]);
    for(const k of keys)work.reserved[k]=(work.reserved[k]??0)+shift.wage;work.shifts[id]=shift;work.active[actor]=id;
    return{shiftId:id,job:job.name,wage:shift.wage,earliestCompletionAt:now+WORK_DURATION,message:'Your wage is reserved. Complete the three task checks; settlement opens after one minute.'};
  }
  if(!active||active.status!=='active')throw new DomainError('WORK_REQUIRED','Begin an NPC work task first.');
  if(p.shiftId!==undefined&&p.shiftId!==active.id)throw new DomainError('INVALID_SHIFT','This task belongs to a different shift.',403);
  const job=STARTER_JOBS.find(j=>j.id===active.jobId)!;
  if(command.type==='WorkStep'){
    if(active.steps>=job.tasks.length)throw new DomainError('TASKS_COMPLETE','All checks are complete. Wait for settlement to open.');
    if(now-active.lastStepAt<STEP_INTERVAL)throw new DomainError('TASK_COOLDOWN','Take a moment to review the next check.');
    const current=job.tasks[active.steps];if(p.choice!==current.correct)throw new DomainError('TASK_REVIEW','Review this check and try the safe action again.');
    active.steps++;active.lastStepAt=now;active.version++;return{step:active.steps,message:'Task check recorded.'};
  }
  if(command.type==='CancelWork'){
    if(active.steps===job.tasks.length)throw new DomainError('EARNED_WORK','Your checks are complete. Settle the reserved wage instead.');
    post(state,key,now,'Cancelled uncompleted NPC task',[{account:'escrow:'+active.id,amount:-active.wage},{account:'system:npc-wage-issuance',amount:active.wage}]);active.status='cancelled';active.version++;release(state,active);return{message:'The uncompleted task was cancelled. Reserved funds returned to the NPC budget.'};
  }
  if(active.steps!==job.tasks.length)throw new DomainError('TASKS_REQUIRED','Complete all three task checks first.');
  if(now-active.startedAt<WORK_DURATION)throw new DomainError('SHIFT_TOO_EARLY','Your reserved wage settles after the one-minute task interval.');
  post(state,key,now,'Validated NPC starter work',[{account:'escrow:'+active.id,amount:-active.wage},{account:'citizen:'+actor,amount:active.wage}]);
  for(const k of budgetKeys(actor,active.region,active.period))state.npcSpend[k]=(state.npcSpend[k]??0)+active.wage;
  active.status='completed';active.completedAt=now;active.version++;release(state,active);citizen.lastShiftAt=now;
  citizen.life!.skills[job.skill]=(citizen.life!.skills[job.skill]??0)+1;citizen.life!.needs.energy=Math.max(20,citizen.life!.needs.energy-10);
  return{shiftId:active.id,amount:active.wage,job:job.name,nextShiftAt:now+RULES.shiftCooldown,message:'Your validated work was paid once from its reserved wage.'};
}
export function workView(state:State,actor:string,now:number){
  const work=state.life?.work,active=work?.active[actor]?work.shifts[work.active[actor]]:null,job=active?STARTER_JOBS.find(j=>j.id===active.jobId):null,current=active?job?.tasks[active.steps]:null;
  return{jobs:STARTER_JOBS.map(({id,name,skill})=>({id,name,skill,wage:RULES.shiftPay,duration:WORK_DURATION})),active:active?{id:active.id,job:job?.name,steps:active.steps,total:job?.tasks.length,wage:active.wage,settlementAt:active.startedAt+WORK_DURATION,stepAt:active.lastStepAt+STEP_INTERVAL,ready:active.steps===job?.tasks.length&&now>=active.startedAt+WORK_DURATION,current:current?{label:current.label,choices:current.choices}:null}:null};
}
