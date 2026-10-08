import {createHash} from 'node:crypto';
import {DomainError,canonical} from './domain.ts';
import type {State,Command,Receipt} from './domain.ts';
import {homeIdentity,usableHome,entranceForHome} from './furnishing.ts';

export const HOME_VISIT_RULES={version:'home-visits-v1',durations:[15,30,60],maxActive:8,actions:['Sit','Read','Wash','inspect']};
export const HOME_VISIT_TERMS='A visit permits walking, sitting, reading, washing and inspecting placed furnishings until the displayed expiry. It grants no furniture, wardrobe, parking, property or household authority. The guest may leave, and the resident may withdraw access. Blocking or a residence change ends access. An ended visit returns the guest to the street entrance.';
type CloseReason='declined'|'withdrawn'|'guest-ended'|'expired'|'residence-changed'|'blocked';
export type HomeVisit={id:string;homeId:string;host:string;hostResidence:string;guest:string;createdAt:number;expiresAt:number;termsVersion:string;version:number;status:'invited'|'accepted'|'declined'|'ended';sourceKey:string;acceptedKey?:string;closedKey?:string;closedAt?:number;closeReason?:CloseReason};
const records=(s:State)=>s.furnishing?.visits??{};
const open=(v:HomeVisit)=>v.status==='invited'||v.status==='accepted';
const blocked=(s:State,a:string,b:string)=>s.life?.blocks[a]?.includes(b)||s.life?.blocks[b]?.includes(a);
const currentHost=(s:State,v:HomeVisit)=>s.citizens[v.host]?.housing===v.hostResidence&&isHomeResident(s,v.host,v.homeId);
export function isHomeResident(s:State,actor:string,homeId:string){
 const home=s.furnishing?.homes[homeId];
 return !!home&&!!s.citizens[actor]&&!!s.world?.positions[actor]&&homeIdentity(s,actor,home.region).id===homeId;
}
export function acceptedHomeVisit(s:State,actor:string,id:string,now?:number){
 const v=records(s)[id];
 return v?.guest===actor&&v.status==='accepted'&&(now===undefined||now>=v.createdAt&&v.expiresAt>now)&&currentHost(s,v)&&!blocked(s,v.host,actor)?v:null;
}
export function authorisedInterior(s:State,actor:string,now?:number){
 const p=s.world?.positions[actor];if(!p||p.interior!=='shelter')return null;
 if(p.visitId){const v=acceptedHomeVisit(s,actor,p.visitId,now);return v&&p.homeId===v.homeId&&s.furnishing!.homes[v.homeId].region===p.region?s.furnishing!.homes[v.homeId]:null;}
 const identity=homeIdentity(s,actor);
 return p.homeId===identity.id&&isHomeResident(s,actor,identity.id)?s.furnishing!.homes[identity.id]:null;
}
export function usableInterior(s:State,actor:string,now:number){
 const p=s.world?.positions[actor];
 if(p?.visitId){const home=authorisedInterior(s,actor,now);if(!home)throw new DomainError('VISIT_UNAVAILABLE','This home visit is no longer available.',403);return home;}
 return usableHome(s,actor);
}
function close(s:State,v:HomeVisit,now:number,key:string|undefined,reason:CloseReason){
 v.status=reason==='declined'?'declined':'ended';v.version++;v.closedAt=now;v.closeReason=reason;if(key)v.closedKey=key;
 const p=s.world?.positions[v.guest];
 if(p?.visitId===v.id){p.interior=null;delete p.homeId;delete p.visitId;delete p.interiorX;delete p.interiorY;delete p.activity;p.leaseVersion++;}
}
// On reads this operates on a copy. On writes closures share the command's atomic receipt.
export function settleHomeVisits(s:State,now:number,key?:string){
 const ended:HomeVisit[]=[];
 for(const v of Object.values(records(s))){
  if(!open(v))continue;
  const reason=v.expiresAt<=now?'expired':!currentHost(s,v)?'residence-changed':blocked(s,v.host,v.guest)?'blocked':null;
  if(reason){close(s,v,now,key,reason);ended.push(structuredClone(v));}
 }
 return ended;
}
export function visitEntrance(s:State,v:HomeVisit){
 const home=s.furnishing!.homes[v.homeId],host=s.citizens[v.host];
 return{...entranceForHome(s,home,v.host),id:'visit:'+v.id,name:host.name+"'s home",visitId:v.id,expiresAt:v.expiresAt};
}
export function guestEntrances(s:State,actor:string,now:number){
 const region=s.world?.positions[actor]?.region;
 return Object.values(records(s)).filter(v=>acceptedHomeVisit(s,actor,v.id,now)&&s.furnishing!.homes[v.homeId].region===region).map(v=>visitEntrance(s,v));
}
export function homeVisitCommand(s:State,actor:string,c:Command,now:number,key:string):Record<string,unknown>|undefined{
 if(!['InviteHomeVisit','AcceptHomeVisit','DeclineHomeVisit','WithdrawHomeVisit','EndHomeVisit'].includes(c.type))return;
 if(!s.citizens[actor])throw new DomainError('CITIZEN_REQUIRED','Create your citizen first.');
 const p=c.payload;
 if(c.type==='InviteHomeVisit'){
  const home=usableHome(s,actor),pos=s.world!.positions[actor];
  if(pos.visitId||!isHomeResident(s,actor,home.id))throw new DomainError('HOME_REQUIRED','Invite guests only from your own current residence.');
  if(p.leaseVersion!==pos.leaseVersion||p.homeVersion!==home.version)throw new DomainError('HOME_CHANGED','Refresh your current home before inviting a guest.');
  const guest=Object.values(s.citizens).find(c=>c.id===p.citizenId);
  if(!guest||guest.actorId===actor)throw new DomainError('INVALID_TARGET','Choose another citizen.',400);
  if(blocked(s,actor,guest.actorId))throw new DomainError('CONTACT_BLOCKED','This invitation cannot be sent.',403);
  if(!Number.isInteger(p.durationMinutes)||!HOME_VISIT_RULES.durations.includes(Number(p.durationMinutes))||p.termsVersion!==HOME_VISIT_RULES.version||p.acceptTerms!==true)throw new DomainError('VISIT_TERMS','Review the visit duration, permissions and expiry terms.');
  const active=Object.values(records(s)).filter(v=>open(v)&&v.homeId===home.id);
  if(active.length>=HOME_VISIT_RULES.maxActive)throw new DomainError('VISIT_CAPACITY','This home already has its maximum number of active invitations.');
  if(active.some(v=>v.guest===guest.actorId))throw new DomainError('VISIT_EXISTS','This citizen already has an invitation to this home.');
  const id='visit_'+createHash('sha256').update(key).digest('hex').slice(0,24);
  const visit:HomeVisit={id,homeId:home.id,host:actor,hostResidence:s.citizens[actor].housing,guest:guest.actorId,createdAt:now,expiresAt:now+Number(p.durationMinutes)*60000,termsVersion:HOME_VISIT_RULES.version,version:1,status:'invited',sourceKey:key};
  (s.furnishing!.visits??={})[id]=visit;
  return{visit:structuredClone(visit),message:'Home invitation recorded. Entry requires the guest’s explicit acceptance.'};
 }
 const v=records(s)[String(p.visitId)];
 const isHost=c.type==='WithdrawHomeVisit';
 if(!v||(isHost?v.host:v.guest)!==actor)throw new DomainError('VISIT_UNAVAILABLE','This home visit is unavailable.',404);
 if(!open(v))throw new DomainError('VISIT_UNAVAILABLE','This visit has ended.');
 if(now<v.createdAt)throw new DomainError('VISIT_UNAVAILABLE','This invitation is not available at the current server time.');
 if(p.visitVersion!==v.version)throw new DomainError('VISIT_CHANGED','Refresh the current invitation before continuing.');
 if(c.type==='AcceptHomeVisit'){
  if(v.status!=='invited')throw new DomainError('VISIT_CHANGED','This invitation is already accepted.');
  if(p.acceptTerms!==true||p.termsVersion!==v.termsVersion||p.homeId!==v.homeId||p.acceptedExpiresAt!==v.expiresAt)throw new DomainError('VISIT_TERMS','Accept the exact displayed home, expiry and guest permissions.');
  v.status='accepted';v.version++;v.acceptedKey=key;
  return{visit:structuredClone(v),message:'Visit accepted. Walk to the displayed entrance to enter; your current location is unchanged.'};
 }
 if(c.type==='DeclineHomeVisit'&&v.status!=='invited')throw new DomainError('VISIT_CHANGED','Use End visit for an accepted invitation.');
 if(c.type==='EndHomeVisit'&&v.status!=='accepted')throw new DomainError('VISIT_CHANGED','Accept or decline the invitation first.');
 close(s,v,now,key,c.type==='DeclineHomeVisit'?'declined':isHost?'withdrawn':'guest-ended');
 return{visit:structuredClone(v),message:isHost?'Visit access withdrawn. A guest inside has returned to the street.':'Visit ended. Your home, belongings and funds remain yours.'};
}
export function homeVisitsView(s:State,actor:string,now:number){
 if(!s.citizens[actor])return null;const copy=structuredClone(s);settleHomeVisits(copy,now);
 const visible=Object.values(records(copy)).filter(v=>v.host===actor||v.guest===actor).slice(-100).map(v=>{
  const h=copy.furnishing!.homes[v.homeId];
  return{id:v.id,homeId:v.homeId,hostId:copy.citizens[v.host].id,hostName:copy.citizens[v.host].name,guestId:copy.citizens[v.guest].id,guestName:copy.citizens[v.guest].name,region:h.region,address:entranceForHome(copy,h,v.host).address,status:v.status,version:v.version,expiresAt:v.expiresAt,termsVersion:v.termsVersion,closeReason:v.closeReason,entrance:acceptedHomeVisit(copy,actor,v.id,now)?visitEntrance(copy,v):null};
 });
 const p=copy.world?.positions[actor],home=p?.homeId?copy.furnishing?.homes[p.homeId]:null;
 return{rules:HOME_VISIT_RULES,terms:HOME_VISIT_TERMS,canInvite:!!home&&p?.interior==='shelter'&&!p.visitId&&isHomeResident(copy,actor,home.id),visits:visible};
}
export function publicHomeVisitReceipt(s:State,r:Receipt):Receipt{
 if(!r.detail.visit&&!r.detail.homeVisitClosureProofs)return r;
 const result=structuredClone(r);delete result.detail.homeVisitClosureProofs;
 if(result.detail.visit){const v=result.detail.visit as HomeVisit;result.detail.visit={id:v.id,homeId:v.homeId,hostId:s.citizens[v.host]?.id,guestId:s.citizens[v.guest]?.id,createdAt:v.createdAt,expiresAt:v.expiresAt,termsVersion:v.termsVersion,version:v.version,status:v.status,...(v.closeReason?{closeReason:v.closeReason}:{})};}
 return result;
}
const core=['id','homeId','host','hostResidence','guest','createdAt','expiresAt','termsVersion','sourceKey'] as const;
const sameTerms=(a:HomeVisit,b:HomeVisit)=>core.every(k=>a[k]===b[k]);
export const homeVisitClosureHash=(v:HomeVisit)=>createHash('sha256').update(canonical(v)).digest('hex');
function receipt(s:State,key:string|undefined){return key?s.commands[key]?.receipt:undefined;}
export function reconcileHomeVisits(s:State){
 const active=new Map<string,Set<string>>();
 for(const [id,v] of Object.entries(records(s))){
  const invited=receipt(s,v.sourceKey),born=invited?.detail.visit as HomeVisit|undefined,home=s.furnishing?.homes[v.homeId];
  if(v.id!==id||!s.citizens[v.host]||!s.citizens[v.guest]||v.host===v.guest||!home||!Number.isSafeInteger(v.createdAt)||v.createdAt<0||!Number.isSafeInteger(v.expiresAt)||!HOME_VISIT_RULES.durations.some(d=>v.expiresAt-v.createdAt===d*60000)||v.termsVersion!==HOME_VISIT_RULES.version||!invited||invited.type!=='InviteHomeVisit'||invited.actorId!==v.host||invited.at!==v.createdAt||!born||!sameTerms(v,born)||born.status!=='invited'||born.version!==1)throw new Error('Home invitation lacks resident terms evidence');
  const accepted=receipt(s,v.acceptedKey),consent=accepted?.detail.visit as HomeVisit|undefined;
  if(v.acceptedKey&&(!accepted||accepted.type!=='AcceptHomeVisit'||accepted.actorId!==v.guest||accepted.at<v.createdAt||accepted.at>=v.expiresAt||!consent||!sameTerms(v,consent)||consent.status!=='accepted'||consent.version!==2||consent.acceptedKey!==v.acceptedKey))throw new Error('Home visit lacks guest consent evidence');
  if(open(v)){
   if(v.closedKey!==undefined||v.closedAt!==undefined||v.closeReason!==undefined||v.status==='invited'&&(v.version!==1||v.acceptedKey!==undefined)||v.status==='accepted'&&(v.version!==2||!v.acceptedKey)||!currentHost(s,v)||blocked(s,v.host,v.guest))throw new Error('Home visit lacks current permission');
   const guests=active.get(v.homeId)??new Set<string>();if(guests.has(v.guest)||guests.size>=HOME_VISIT_RULES.maxActive)throw new Error('Home invitation capacity mismatch');guests.add(v.guest);active.set(v.homeId,guests);
  }else{
   const ending=receipt(s,v.closedKey),closed=ending?.detail.visit,closures=ending?.detail.homeVisitClosureProofs;
   const proof=closed&&canonical(closed)===canonical(v)||Array.isArray(closures)&&closures.includes(homeVisitClosureHash(v));
   if(!['ended','declined'].includes(v.status)||v.version!==(v.acceptedKey?3:2)||!Number.isSafeInteger(v.closedAt)||v.closedAt! < v.createdAt||!ending||ending.at!==v.closedAt||!proof||!['declined','withdrawn','guest-ended','expired','residence-changed','blocked'].includes(String(v.closeReason))||v.status==='declined'&&(v.acceptedKey||v.closeReason!=='declined')||v.closeReason==='expired'&&v.closedAt! < v.expiresAt||v.closeReason==='declined'&&(ending.type!=='DeclineHomeVisit'||ending.actorId!==v.guest)||v.closeReason==='withdrawn'&&(ending.type!=='WithdrawHomeVisit'||ending.actorId!==v.host)||v.closeReason==='guest-ended'&&(ending.type!=='EndHomeVisit'||ending.actorId!==v.guest))throw new Error('Home visit lacks closure evidence');
  }
 }
 for(const [actor,p] of Object.entries(s.world?.positions??{}))if(p.visitId&&(!authorisedInterior(s,actor)||!records(s)[p.visitId]?.acceptedKey||p.activity&&!HOME_VISIT_RULES.actions.includes(p.activity.kind)))throw new Error('Home guest position lacks consent or current permission');
}
