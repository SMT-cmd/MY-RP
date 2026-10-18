import {createHash} from 'node:crypto';
import {DomainError} from './domain.ts';
import type {State} from './domain.ts';
import {homeFixtures,homeFor,homeIdentity,validateLayout} from './furnishing.ts';
import type {Home,FurnitureItem} from './furnishing.ts';
import {fixtureAccessible} from './home-layout.ts';
import {authorisedInterior,HOME_VISIT_RULES} from './home-visits.ts';
import {lifeCommand} from './life.ts';

export const HOME_ACTIVITY_RULES={version:'home-activity-v1',durations:{Sit:10000,Read:10000,Dress:10000,Rest:10000,Wash:10000,Toilet:14000,Shower:18000,Clean:12000},finishGrace:120000,rewardInterval:60000};
export type HomeActivityKind=keyof typeof HOME_ACTIVITY_RULES.durations;
type Fixture=ReturnType<typeof homeFixtures>[number];
export type HomeActivitySession={id:string;actor:string;homeId:string;homeVersion:number;fixtureId:string;instanceId:string;fixtureVersion:number;kind:HomeActivityKind;slot:number;leaseVersion:number;origin:{x:number;y:number};startedAt:number;endsAt:number;useKey:string;completedAt?:number;completionKey?:string};
export type HomeCareState={sessions:Record<string,HomeActivitySession>;active:Record<string,string>};
const hash=(value:string)=>createHash('sha256').update(value).digest('hex').slice(0,24);
const kinds=Object.keys(HOME_ACTIVITY_RULES.durations);
const cleanable=(fixture:Pick<Fixture,'kind'|'model'>)=>['sink','vanity','toilet','shower'].includes(fixture.kind??fixture.model);
const care=(s:State):HomeCareState=>s.furnishing!.care??={sessions:{},active:{}};
export function resolveFixtureAction(fixture:Pick<Fixture,'action'|'kind'|'model'>,requested:unknown):string{
 const action=requested===undefined?fixture.action:requested;
 if(action===fixture.action||action==='Clean'&&cleanable(fixture))return String(action);
 throw new DomainError('FIXTURE_ACTION','Choose an action supported by this furnishing.',400);
}
export function homeActivityActions(fixture:Pick<Fixture,'action'|'kind'|'model'>){return cleanable(fixture)?[fixture.action,'Clean']:[fixture.action];}
export const timedHomeActivity=(kind:string):kind is HomeActivityKind=>kinds.includes(kind);
function sessionPosition(s:State,actor:string,home:Home){
 const p=s.world?.positions[actor];
 if(!p||p.interior!=='shelter'||p.homeId!==home.id||!authorisedInterior(s,actor))throw new DomainError('HOME_REQUIRED','Return to your authorised home before using this furnishing.');
 return p;
}
export function startHomeActivity(s:State,actor:string,home:Home,fixture:Fixture,kind:string,slot:number,now:number,key:string){
 if(!timedHomeActivity(kind)||resolveFixtureAction(fixture,kind)!==kind)throw new DomainError('FIXTURE_ACTION','Choose a supported home activity.');
 const p=sessionPosition(s,actor,home),item=s.furnishing!.items[fixture.instanceId];
 if(p.visitId&&!HOME_VISIT_RULES.actions.includes(kind))throw new DomainError('GUEST_PERMISSION','This action is reserved for the resident.',403);
 if(!fixtureAccessible(home,p.interiorX??4,p.interiorY??6,fixture))throw new DomainError('TOO_FAR','Walk to the front of the furnishing before using it.');
 const activeId=s.furnishing?.care?.active[actor],active=activeId?s.furnishing!.care!.sessions[activeId]:null;
 if(active&&active.instanceId===fixture.instanceId&&active.kind===kind&&now<active.endsAt&&!['Sit','Read','Dress'].includes(kind))throw new DomainError('ACTIVITY_ACTIVE','This activity is already in progress. Let it finish or stop it first.');
 if(kind==='Rest'){const last=s.citizens[actor].life?.lastRestAt;if(last!==undefined&&last!==null&&now-last<60000)throw new DomainError('REST_COOLDOWN','Your next rest is available in a minute.');}
 const m=care(s),id='activity_'+hash(key),session:HomeActivitySession={id,actor,homeId:home.id,homeVersion:home.version,fixtureId:fixture.id,instanceId:fixture.instanceId,fixtureVersion:item.version,kind,slot,leaseVersion:p.leaseVersion,origin:{x:p.interiorX??4,y:p.interiorY??6},startedAt:now,endsAt:now+HOME_ACTIVITY_RULES.durations[kind],useKey:key};
 m.sessions[id]=session;m.active[actor]=id;
 Object.assign(p,{activity:{kind,fixtureId:fixture.id,instanceId:fixture.instanceId,slot,startedAt:now,useKey:key,sessionId:id,endsAt:session.endsAt}});
 return{activitySessionId:id,activityEndsAt:session.endsAt,activityOrigin:{...session.origin},activityLeaseVersion:session.leaseVersion,activityHomeVersion:session.homeVersion,activityFixtureVersion:session.fixtureVersion,homeId:home.id,fixtureId:fixture.id,fixtureInstanceId:fixture.instanceId,fixtureUseSlot:slot,activityKind:kind,message:kind==='Rest'?'Settling into bed. Energy returns after a complete rest.':kind==='Wash'?'Turning on the tap, washing, rinsing and drying.':kind==='Clean'?'Cleaning the fixture. Finish the activity to remove the dirt.':`${kind} activity started.`};
}
export function cancelHomeActivity(s:State,actor:string,_now:number){const m=s.furnishing?.care;if(m)delete m.active[actor];const p=s.world?.positions[actor];if(p)delete p.activity;}
export function finishHomeActivity(s:State,actor:string,now:number,key:string,payload:Record<string,unknown>){
 const m=s.furnishing?.care,id=String(payload.sessionId??''),session=m?.sessions[id];
 if(!session||session.actor!==actor)throw new DomainError('ACTIVITY_NOT_FOUND','This activity is unavailable.',404);
 if(session.completedAt!==undefined)return{activitySessionId:id,completedAt:session.completedAt,message:'This activity was already completed.',care:homeCareView(s,actor,now)};
 if(m!.active[actor]!==id)throw new DomainError('ACTIVITY_CANCELLED','This activity was interrupted. Approach the furnishing to begin again.');
 const home=s.furnishing!.homes[session.homeId],p=s.world?.positions[actor],item=s.furnishing!.items[session.instanceId],fixture=home&&homeFixtures(s,home).find(f=>f.instanceId===session.instanceId);
 if(!home||!p||!item||!fixture||!authorisedInterior(s,actor,now)||p.homeId!==home.id||p.leaseVersion!==session.leaseVersion||home.version!==session.homeVersion||item.version!==session.fixtureVersion||p.interiorX!==session.origin.x||p.interiorY!==session.origin.y||p.activity?.useKey!==session.useKey)throw new DomainError('ACTIVITY_CANCELLED','The location or furnishing changed. Begin the activity again.');
 if(payload.leaseVersion!==undefined&&payload.leaseVersion!==p.leaseVersion)throw new DomainError('STALE_LEASE','Your location changed.');
 if(now<session.endsAt)throw new DomainError('ACTIVITY_PENDING','Let the activity finish before collecting its benefit.');
 if(now>session.endsAt+HOME_ACTIVITY_RULES.finishGrace)throw new DomainError('ACTIVITY_EXPIRED','This activity ended while you were away. Begin again to earn its benefit.');
 if(p.visitId&&!HOME_VISIT_RULES.actions.includes(session.kind))throw new DomainError('GUEST_PERMISSION','This activity is reserved for the resident.',403);
 const benefit=session.kind==='Rest'?lifeCommand(s,actor,{id:key,type:'Rest',payload:{}},now,key):{};
 session.completedAt=now;session.completionKey=key;delete m!.active[actor];delete p.activity;
 return{...benefit,activitySessionId:id,activityKind:session.kind,fixtureInstanceId:session.instanceId,homeId:session.homeId,completedAt:now,care:homeCareView(s,actor,now),message:session.kind==='Rest'?'Rest completed. Energy restored.':session.kind==='Clean'?'Fixture cleaned.':session.kind==='Wash'?'Hands washed, rinsed and dried.':session.kind==='Toilet'?'Toilet used and flushed. Wash your hands at the sink.':session.kind==='Shower'?'Shower completed and dried.':'Activity completed.'};
}
function completed(s:State){return Object.values(s.furnishing?.care?.sessions??{}).filter(a=>a.completedAt!==undefined).sort((a,b)=>a.completedAt!-b.completedAt!||a.id.localeCompare(b.id));}
export function homeCareView(s:State,actor:string,now:number){
 let hygiene=75,bladder=75,comfort=70,experience=0,last=now,lastReward=-Infinity;
 const sessions=completed(s),own=sessions.filter(a=>a.actor===actor);
 for(const a of own){if(a.kind==='Wash')hygiene=Math.min(100,hygiene+15);if(a.kind==='Shower')hygiene=100;if(a.kind==='Toilet'){bladder=100;hygiene=Math.max(0,hygiene-8);}if(a.kind==='Rest')comfort=Math.min(100,comfort+20);if(a.kind==='Sit')comfort=Math.min(100,comfort+5);if(['Wash','Shower','Toilet','Clean','Rest'].includes(a.kind)&&a.completedAt!-lastReward>=HOME_ACTIVITY_RULES.rewardInterval){experience++;lastReward=a.completedAt!;}last=a.completedAt!;}
 const elapsed=Math.min(60,Math.max(0,(now-last)/60000));hygiene=Math.max(20,hygiene-Math.floor(elapsed/6));bladder=Math.max(10,bladder-Math.floor(elapsed/3));
 const dirt:Record<string,number>={};for(const a of sessions){if(a.kind==='Clean')dirt[a.instanceId]=0;else if(['Wash','Shower','Toilet'].includes(a.kind))dirt[a.instanceId]=Math.min(100,(dirt[a.instanceId]??0)+(a.kind==='Toilet'?30:a.kind==='Shower'?15:5));}
 const p=s.world?.positions[actor],homeId=p?.homeId,id=s.furnishing?.care?.active[actor],a=id?s.furnishing!.care!.sessions[id]:null;
 const active=a&&p?.activity?.useKey===a.useKey&&p.leaseVersion===a.leaseVersion&&now<=a.endsAt+HOME_ACTIVITY_RULES.finishGrace?{sessionId:a.id,kind:a.kind,fixtureId:a.fixtureId,startedAt:a.startedAt,endsAt:a.endsAt,canFinish:now>=a.endsAt,progress:Math.min(1,Math.max(0,(now-a.startedAt)/(a.endsAt-a.startedAt)))}:null;
 return{hygiene,bladder,comfort,experience,completedActivities:own.length,active,fixtures:Object.values(s.furnishing?.items??{}).filter(i=>i.homeId===homeId).map(i=>({fixtureInstanceId:i.id,dirt:dirt[i.id]??0,needsCleaning:(dirt[i.id]??0)>=25}))};
}
export function reconcileHomeActivities(s:State){
 const m=s.furnishing?.care;if(!m)return;
 for(const [id,a] of Object.entries(m.sessions)){
  const receipt=s.commands[a.useKey]?.receipt,d=receipt?.detail;
  if(id!==a.id||id!=='activity_'+hash(a.useKey)||!s.citizens[a.actor]||!timedHomeActivity(a.kind)||!Number.isSafeInteger(a.startedAt)||a.endsAt!==a.startedAt+HOME_ACTIVITY_RULES.durations[a.kind]||!Number.isSafeInteger(a.slot)||a.slot<0||!Number.isSafeInteger(a.homeVersion)||a.homeVersion<1||!Number.isSafeInteger(a.fixtureVersion)||a.fixtureVersion<1||!Number.isSafeInteger(a.leaseVersion)||a.leaseVersion<1||!Number.isInteger(a.origin.x)||!Number.isInteger(a.origin.y)||!receipt||receipt.type!=='InteractHomeFixture'||receipt.actorId!==a.actor||receipt.at!==a.startedAt||d?.activitySessionId!==a.id||d.activityEndsAt!==a.endsAt||d.fixtureInstanceId!==a.instanceId||d.activityKind!==a.kind||d.homeId!==a.homeId||d.fixtureUseSlot!==a.slot||d.activityLeaseVersion!==a.leaseVersion||d.activityHomeVersion!==a.homeVersion||d.activityFixtureVersion!==a.fixtureVersion||JSON.stringify(d.activityOrigin)!==JSON.stringify(a.origin))throw new Error('Home activity lacks start receipt evidence');
  if(a.completedAt!==undefined){const finish=s.commands[a.completionKey??'']?.receipt;if(!Number.isSafeInteger(a.completedAt)||a.completedAt<a.endsAt||a.completedAt>a.endsAt+HOME_ACTIVITY_RULES.finishGrace||!finish||finish.type!=='FinishHomeActivity'||finish.actorId!==a.actor||finish.at!==a.completedAt||finish.detail.activitySessionId!==a.id||finish.detail.completedAt!==a.completedAt||finish.detail.activityKind!==a.kind)throw new Error('Home activity lacks timed completion evidence');}
  else if(a.completionKey!==undefined)throw new Error('Home activity has completion evidence without completion');
 }
 for(const [actor,id] of Object.entries(m.active)){const a=m.sessions[id],p=s.world?.positions[actor];if(!a||a.actor!==actor||a.completedAt!==undefined||!p?.activity||p.activity.useKey!==a.useKey||p.homeId!==a.homeId||p.leaseVersion!==a.leaseVersion)throw new Error('Active home activity lacks position evidence');}
}

// Explicit free sanitation fit-out for older saves. Search only empty positions;
// do not relocate existing furnishings. Atomic command execution rolls back if
// both fixtures cannot fit while keeping every door and furnishing reachable.
export function prepareHomeBathroom(s:State,actor:string,payload:Record<string,unknown>,now:number,_key:string){
 const home=homeFor(s,actor),p=sessionPosition(s,actor,home);
 if(p.visitId||homeIdentity(s,actor).id!==home.id)throw new DomainError('BATHROOM_PERMISSION','Only the resident can fit out this bathroom.',403);
 if(payload.homeVersion!==home.version||payload.leaseVersion!==p.leaseVersion)throw new DomainError('HOME_CHANGED','Refresh the current home before fitting its bathroom.');
 const items=s.furnishing!.items,installed:string[]=[];
 for(const model of ['toilet','shower']){
  if(Object.values(items).some(i=>i.owner===actor&&i.starter&&i.model===model))continue;
  const id='furniture_'+hash(home.id+':'+actor+':bathroom:'+model),item:FurnitureItem={id,owner:actor,model,finish:'cream',homeId:home.id,placement:{x:0,y:0,rotation:0},starter:true,alias:model,version:1};
  items[id]=item;let placed=false;
  const candidates=[{x:0,y:model==='toilet'?4:0,rotation:0}];
  for(let y=0;y<home.height;y++)for(let x=0;x<home.width;x++)for(const rotation of [0,90,180,270])candidates.push({x,y,rotation});
  for(const candidate of candidates){item.placement=candidate;try{validateLayout(s,home);placed=true;break;}catch(error){if(!(error instanceof DomainError))throw error;}}
  if(!placed){delete items[id];throw new DomainError('BATHROOM_SPACE','Make room for the bathroom fixtures while keeping every doorway and furnishing reachable.');}
  installed.push(id);
 }
 if(installed.length){home.version++;for(const [who,pos] of Object.entries(s.world?.positions??{}))if(pos.homeId===home.id)cancelHomeActivity(s,who,now);}
 return{homeId:home.id,homeVersion:home.version,installedFurniture:installed,amount:0,message:installed.length?'Bathroom fitted with a toilet and frosted shower. Existing furniture stayed in place.':'Your sanitation starter fixtures are already included.'};
}
