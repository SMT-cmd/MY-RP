import {createHash} from 'node:crypto';
import {DomainError,canonical,DAY} from './domain.ts';
import type {State,Command,Receipt} from './domain.ts';

export const RELATIONSHIP_RULES={version:'relationships-v1',invitationDuration:7*DAY,maxPending:20,maxDailyInvitations:20,maxActive:100,historyVisible:100};
export const RELATIONSHIP_TERMS='This records a mutually accepted friendship or partnership in this game. It shares no money, belongings, household, home entry, location or message permission. Either person may end it. Blocking ends it and pending requests; disabling relationship requests closes incoming pending requests. Acceptance is optional.';
type Reason='declined'|'withdrawn'|'left'|'blocked'|'expired'|'privacy';
export type Relationship={id:string;sender:string;recipient:string;kind:'friend'|'partner';createdAt:number;expiresAt:number;termsVersion:string;sourceKey:string;status:'invited'|'active'|'ended';version:number;acceptedKey?:string;closedKey?:string;closedAt?:number;closeReason?:Reason};
export type RelationshipState={records:Record<string,Relationship>};
const records=(s:State)=>s.relationships?.records??{};
const open=(r:Relationship)=>r.status!=='ended';
const blocked=(s:State,r:Pick<Relationship,'sender'|'recipient'>)=>s.life?.blocks[r.sender]?.includes(r.recipient)||s.life?.blocks[r.recipient]?.includes(r.sender);
const involved=(r:Relationship,actor:string)=>r.sender===actor||r.recipient===actor;
const core=(r:Relationship)=>{const {status,version,acceptedKey,closedKey,closedAt,closeReason,...terms}=r;return terms;};
const endingReason=(s:State,r:Relationship,now:number)=>blocked(s,r)?'blocked':r.status==='invited'?(r.expiresAt<=now?'expired':s.citizens[r.recipient]?.life?.privacy.relationships!==true?'privacy':null):null;
export function relationshipRevision(s:State,actor:string,now:number){
 const items=Object.values(records(s)).filter(r=>involved(r,actor)).map(r=>{const reason=open(r)?endingReason(s,r,now):null;return[r.id,reason?'ended':r.status,r.version+(reason?1:0),reason??r.closeReason??null];});
 return createHash('sha256').update(canonical([s.citizens[actor]?.life?.privacy.relationships===true,items])).digest('hex');
}
export const relationshipClosureHash=(r:Relationship)=>createHash('sha256').update(canonical(r)).digest('hex');
function close(r:Relationship,now:number,key:string|undefined,reason:Reason){r.status='ended';r.version++;r.closedAt=now;r.closeReason=reason;if(key)r.closedKey=key;}
export function settleRelationships(s:State,now:number,key?:string){
 const ended:Relationship[]=[];
 for(const r of Object.values(records(s))){
  if(!open(r))continue;
  const reason=endingReason(s,r,now);
  if(reason){close(r,now,key,reason);ended.push({...r});}
 }
 return ended;
}
export function relationshipCommand(s:State,actor:string,c:Command,now:number,key:string):Record<string,unknown>|undefined{
 if(!['InviteRelationship','AcceptRelationship','DeclineRelationship','WithdrawRelationship','EndRelationship'].includes(c.type))return;
 if(!s.citizens[actor])throw new DomainError('CITIZEN_REQUIRED','Create your citizen first.');
 const p=c.payload,all=records(s);
 if(c.type==='InviteRelationship'){
  const target=Object.values(s.citizens).find(x=>x.id===p.citizenId);
  if(!target||target.actorId===actor)throw new DomainError('INVALID_TARGET','Choose another citizen.',400);
  if(!['friend','partner'].includes(String(p.kind))||p.termsVersion!==RELATIONSHIP_RULES.version||p.acceptTerms!==true)throw new DomainError('RELATIONSHIP_TERMS','Review the relationship type and terms.');
  const kind=p.kind as Relationship['kind'],pair={sender:actor,recipient:target.actorId};
  if(!Number.isSafeInteger(now+RELATIONSHIP_RULES.invitationDuration))throw new DomainError('INVALID_TIME','This request expiry cannot be recorded.');
  // The same generic response applies to a blocked or closed request inbox.
  if(blocked(s,pair)||target.life?.privacy.relationships!==true)throw new DomainError('CONTACT_UNAVAILABLE','This citizen is not accepting relationship requests.',403);
  if(Object.values(all).some(r=>open(r)&&r.kind===kind&&involved(r,actor)&&involved(r,target.actorId)))throw new DomainError('RELATIONSHIP_EXISTS','This relationship or request already exists.');
  if(Object.values(all).filter(r=>r.sender===actor&&now-r.createdAt<DAY).length>=RELATIONSHIP_RULES.maxDailyInvitations)throw new DomainError('RELATIONSHIP_RATE','Your relationship request limit has been reached for this rolling day.');
  if([actor,target.actorId].some(person=>Object.values(all).filter(r=>r.status==='invited'&&involved(r,person)).length>=RELATIONSHIP_RULES.maxPending))throw new DomainError('RELATIONSHIP_CAPACITY','There is no available relationship request position.');
  if([actor,target.actorId].some(person=>Object.values(all).filter(r=>r.status==='active'&&involved(r,person)).length>=RELATIONSHIP_RULES.maxActive))throw new DomainError('RELATIONSHIP_CAPACITY','There is no available relationship position.');
  const id='relationship_'+createHash('sha256').update(key).digest('hex').slice(0,24),r:Relationship={id,sender:actor,recipient:target.actorId,kind,createdAt:now,expiresAt:now+RELATIONSHIP_RULES.invitationDuration,termsVersion:RELATIONSHIP_RULES.version,sourceKey:key,status:'invited',version:1};
  (s.relationships??={records:{}}).records[id]=r;return{relationship:{...r},message:'Request sent. Acceptance is optional.'};
 }
 const r=all[String(p.relationshipId)];
 if(!r||!involved(r,actor))throw new DomainError('RELATIONSHIP_UNAVAILABLE','Choose one of your own relationship records.',403);
 if(c.type==='EndRelationship'&&r.status==='ended')return{relationship:{...r},message:'This relationship has already ended.'};
 if(p.relationshipVersion!==r.version)throw new DomainError('RELATIONSHIP_CHANGED','Refresh the current relationship before continuing.');
 if(c.type==='AcceptRelationship'){
  if(r.status!=='invited'||r.recipient!==actor||now<r.createdAt||now>=r.expiresAt)throw new DomainError('RELATIONSHIP_UNAVAILABLE','This request is no longer available.',403);
  if(p.kind!==r.kind||p.senderCitizenId!==s.citizens[r.sender].id||p.acceptedExpiresAt!==r.expiresAt||p.termsVersion!==r.termsVersion||p.acceptTerms!==true)throw new DomainError('RELATIONSHIP_TERMS','Review and accept this exact request and relationship type.');
  if([r.sender,r.recipient].some(person=>Object.values(all).filter(x=>x.status==='active'&&involved(x,person)).length>=RELATIONSHIP_RULES.maxActive))throw new DomainError('RELATIONSHIP_CAPACITY','There is no available relationship position.');
  r.status='active';r.acceptedKey=key;r.version++;return{relationship:{...r},message:r.kind==='friend'?'Friendship accepted.':'Partnership accepted.'};
 }
 const reason=c.type==='DeclineRelationship'&&r.status==='invited'&&r.recipient===actor?'declined':c.type==='WithdrawRelationship'&&r.status==='invited'&&r.sender===actor?'withdrawn':c.type==='EndRelationship'&&r.status==='active'?'left':null;
 if(!reason)throw new DomainError('RELATIONSHIP_UNAVAILABLE','That action is not available for this relationship.',403);
 close(r,now,key,reason);return{relationship:{...r},message:'Relationship request or connection ended. Personal assets and other permissions are preserved.'};
}
export function relationshipsView(s:State,actor:string,now:number){
 if(!s.citizens[actor])return null;s=structuredClone(s);settleRelationships(s,now);
 const mine=Object.values(records(s)).filter(r=>involved(r,actor)),visible=[...mine.filter(open),...mine.filter(r=>!open(r)).sort((a,b)=>b.closedAt!-a.closedAt!||a.id.localeCompare(b.id)).slice(0,RELATIONSHIP_RULES.historyVisible)];
 return{rules:RELATIONSHIP_RULES,terms:RELATIONSHIP_TERMS,revision:relationshipRevision(s,actor,now),accepting:s.citizens[actor].life?.privacy.relationships===true,records:visible.map(r=>{
  const other=s.citizens[r.sender===actor?r.recipient:r.sender];
  return{id:r.id,kind:r.kind,status:r.status,version:r.version,createdAt:r.createdAt,expiresAt:r.expiresAt,termsVersion:r.termsVersion,incoming:r.recipient===actor,other:{id:other.id,name:other.name},closeReason:r.closeReason??null};
 })};
}
export function publicRelationshipReceipt(s:State,receipt:Receipt):Receipt{
 const result=structuredClone(receipt);delete result.detail.relationshipClosureProofs;
 if(result.type.includes('Relationship')&&result.detail.relationship){const r=result.detail.relationship as Relationship;const {sourceKey,acceptedKey,closedKey,...safe}=r;result.detail.relationship={...safe,sender:s.citizens[r.sender]?.id,recipient:s.citizens[r.recipient]?.id};}
 return result;
}
export function reconcileRelationships(s:State){
 const pairs=new Set<string>(),pending=new Map<string,number>(),active=new Map<string,number>();
 for(const [id,r] of Object.entries(records(s))){
  const born=s.commands[r.sourceKey]?.receipt,invited=born?.detail.relationship as Relationship|undefined;
  if(id!==r.id||!s.citizens[r.sender]||!s.citizens[r.recipient]||r.sender===r.recipient||!['friend','partner'].includes(r.kind)||!Number.isSafeInteger(r.createdAt)||r.createdAt<0||!Number.isSafeInteger(r.expiresAt)||r.expiresAt-r.createdAt!==RELATIONSHIP_RULES.invitationDuration||r.termsVersion!==RELATIONSHIP_RULES.version||!born||born.type!=='InviteRelationship'||born.actorId!==r.sender||born.at!==r.createdAt||!invited||canonical(invited)!==canonical({...core(r),status:'invited',version:1}))throw new Error('Relationship lacks invitation evidence');
  if(Object.values(records(s)).filter(x=>x.sender===r.sender&&x.createdAt<=r.createdAt&&x.createdAt>r.createdAt-DAY).length>RELATIONSHIP_RULES.maxDailyInvitations)throw new Error('Relationship request rate mismatch');
  const acceptance=r.acceptedKey?s.commands[r.acceptedKey]?.receipt:null;
  if(r.acceptedKey&&(!acceptance||acceptance.type!=='AcceptRelationship'||acceptance.actorId!==r.recipient||acceptance.at<r.createdAt||acceptance.at>=r.expiresAt||canonical(acceptance.detail.relationship)!==canonical({...core(r),status:'active',version:2,acceptedKey:r.acceptedKey})))throw new Error('Relationship lacks mutual consent evidence');
  if(open(r)){
   if(blocked(s,r)||r.closedAt!==undefined||r.closedKey!==undefined||r.closeReason!==undefined||r.status==='invited'&&(r.version!==1||r.acceptedKey!==undefined||s.citizens[r.recipient].life?.privacy.relationships!==true)||r.status==='active'&&(r.version!==2||!r.acceptedKey)||!['invited','active'].includes(r.status))throw new Error('Relationship lacks current permission');
   const pair=[r.sender,r.recipient].sort().join(':')+':'+r.kind;if(pairs.has(pair))throw new Error('Duplicate relationship');pairs.add(pair);
   const counts=r.status==='invited'?pending:active,max=r.status==='invited'?RELATIONSHIP_RULES.maxPending:RELATIONSHIP_RULES.maxActive;
   for(const person of [r.sender,r.recipient]){const count=(counts.get(person)??0)+1;if(count>max)throw new Error('Relationship capacity mismatch');counts.set(person,count);}
  }else{
   const ended=r.closedKey?s.commands[r.closedKey]?.receipt:null,proof=ended?.detail.relationship,proofs=ended?.detail.relationshipClosureProofs;
   if(r.status!=='ended'||r.version!==(r.acceptedKey?3:2)||!Number.isSafeInteger(r.closedAt)||r.closedAt!<r.createdAt||!ended||ended.at!==r.closedAt||!(proof&&canonical(proof)===canonical(r)||Array.isArray(proofs)&&proofs.includes(relationshipClosureHash(r)))||!['declined','withdrawn','left','blocked','expired','privacy'].includes(String(r.closeReason))||r.closeReason==='left'&&(!r.acceptedKey||ended.type!=='EndRelationship'||!involved(r,ended.actorId))||r.closeReason==='declined'&&(r.acceptedKey||ended.type!=='DeclineRelationship'||ended.actorId!==r.recipient)||r.closeReason==='withdrawn'&&(r.acceptedKey||ended.type!=='WithdrawRelationship'||ended.actorId!==r.sender)||r.closeReason==='expired'&&(r.acceptedKey||r.closedAt!<r.expiresAt)||r.closeReason==='privacy'&&r.acceptedKey)throw new Error('Relationship lacks closure evidence');
   if(r.closeReason==='blocked'&&(ended.type!=='BlockCitizen'||!involved(r,ended.actorId)||ended.detail.citizenId!==s.citizens[ended.actorId===r.sender?r.recipient:r.sender].id)||r.closeReason==='privacy'&&(ended.type!=='SetPrivacy'||ended.actorId!==r.recipient||(ended.detail.privacy as {relationships?:boolean}|undefined)?.relationships!==false))throw new Error('Relationship lacks block or privacy evidence');
  }
 }
}
