import {createHash} from 'node:crypto';
import {DomainError} from './domain.ts';
import type {State} from './domain.ts';
import {homeFixtures} from './furnishing.ts';
import type {Home} from './furnishing.ts';
export const FURNITURE_USE_RULES={version:'furniture-use-v1',duration:10000};
type Fixture={id:string;instanceId:string;model:string;action:string;x:number;y:number;w:number;h:number;rotation:number};
export const fixtureCapacity=(f:Pick<Fixture,'model'|'action'>)=>['Sit','Read','Wash','Rest','Dress'].includes(f.action)?f.model==='sofa'?3:1:0;
const slotOf=(f:Fixture,activity:{slot?:number})=>activity.slot??Math.floor(fixtureCapacity(f)/2);
function activeUses(s:State,home:Home,f:Fixture,now:number){
 return Object.entries(s.world?.positions??{}).flatMap(([actor,p])=>{
  const a=p.activity;return p.interior==='shelter'&&p.homeId===home.id&&a&&a.kind===f.action&&(a.instanceId===f.instanceId||!a.instanceId&&a.fixtureId===f.id)&&a.startedAt<=now&&now-a.startedAt<FURNITURE_USE_RULES.duration?[{actor,slot:slotOf(f,a),startedAt:a.startedAt}]:[];
 });
}
export function fixtureUse(s:State,home:Home,f:Fixture,actor:string,now:number){
 const capacity=fixtureCapacity(f),claims=activeUses(s,home,f,now),mine=claims.find(c=>c.actor===actor),others=claims.filter(c=>c.actor!==actor),occupied=new Set(others.map(c=>c.slot));
 return{capacity,free:capacity-new Set(claims.map(c=>c.slot)).size,availableSlots:Array.from({length:capacity},(_,i)=>i).filter(i=>!occupied.has(i)),currentSlot:mine?.slot??null,nextAvailableAt:others.length?Math.min(...others.map(c=>c.startedAt+FURNITURE_USE_RULES.duration)):null};
}
export function homeUseRevision(s:State,home:Home,now:number){
 const claims=homeFixtures(s,home).flatMap(f=>activeUses(s,home,f,now).map(c=>f.instanceId+':'+c.slot+':'+c.startedAt)).sort();
 return createHash('sha256').update(JSON.stringify(claims)).digest('hex');
}
export function claimFixtureUse(s:State,home:Home,f:Fixture,actor:string,now:number,requested:unknown){
 // Upgrading a saved world clears only legacy/expired presentation poses.
 for(const p of Object.values(s.world?.positions??{}))if(p.homeId===home.id&&p.activity&&(p.activity.slot===undefined||now-p.activity.startedAt>=FURNITURE_USE_RULES.duration))delete p.activity;
 const use=fixtureUse(s,home,f,actor,now);
 if(requested!==undefined&&(!Number.isInteger(requested)||Number(requested)<0||Number(requested)>=use.capacity))throw new DomainError('INVALID_USE_SLOT','Choose an available seat or fixture position.');
 if(requested!==undefined){if(!use.availableSlots.includes(Number(requested)))throw new DomainError('FIXTURE_BUSY','That seat is in use. Choose an available seat or wait.');return Number(requested);}
 if(!use.availableSlots.length)throw new DomainError('FIXTURE_BUSY','This furnishing is in use. Wait for it to become available.');
 if(use.currentSlot!==null&&use.availableSlots.includes(use.currentSlot))return use.currentSlot;
 const p=s.world!.positions[actor],rotation=-f.rotation*Math.PI/180,centre={x:f.x+f.w/2,y:f.y+f.h/2};
 return use.availableSlots.sort((a,b)=>{const distance=(slot:number)=>{const offset=slot-(use.capacity-1)/2;return Math.hypot(centre.x+Math.cos(rotation)*offset-(p.interiorX!+.5),centre.y-Math.sin(rotation)*offset-(p.interiorY!+.5));};return distance(a)-distance(b)||a-b;})[0];
}
export function reconcileFurnitureUse(s:State){
 const occupied=new Set<string>();
 for(const [actor,p] of Object.entries(s.world?.positions??{})){
  const a=p.activity;if(!a||a.slot===undefined)continue;
  if(p.interior!=='shelter')throw new Error('Furniture use is outside its home');
  const home=s.furnishing?.homes[p.homeId??''],fixture=home?homeFixtures(s,home).find(f=>f.instanceId===a.instanceId):null,receipt=s.commands[a.useKey??'']?.receipt,detail=receipt?.detail;
  if(!home||!fixture||fixture.action!==a.kind||fixture.id!==a.fixtureId||!Number.isInteger(a.slot)||a.slot<0||a.slot>=fixtureCapacity(fixture)||!Number.isSafeInteger(a.startedAt)||!receipt||receipt.type!=='InteractHomeFixture'||receipt.actorId!==actor||receipt.at!==a.startedAt||detail?.homeId!==home.id||detail.fixtureInstanceId!==a.instanceId||detail.fixtureUseSlot!==a.slot||detail.activityKind!==a.kind)throw new Error('Furniture use lacks position or interaction evidence');
  const key=home.id+':'+fixture.instanceId+':'+a.slot;if(occupied.has(key))throw new Error('Furniture use slot is already occupied');occupied.add(key);
 }
}
