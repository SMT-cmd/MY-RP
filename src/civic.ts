import {createHash} from 'node:crypto';
import {DomainError,canonical} from './domain.ts';
import type {State,Command} from './domain.ts';
export const PETITION_RULES={version:'petitions-1',window:7*86400000,reviewDelay:86400000,creationInterval:86400000,threshold:10,maxChanges:4};
export const PETITION_TOPICS=[
 {id:'roads',name:'Review neighbourhood road maintenance',cost:100000},
 {id:'water',name:'Review reliable water provision',cost:150000},
 {id:'housing',name:'Review starter housing conditions',cost:100000},
 {id:'school',name:'Review foundation-school accessibility',cost:75000},
 {id:'clinic',name:'Review community-clinic provision',cost:125000}
];
type Support={actor:string;changes:{key:string;at:number;supported:boolean}[]};
type Review={at:number;key:string;support:number;treasury:number;estimatedCost:number;outcome:'withdrawn'|'insufficient-support'|'funding-proposal-required'|'formal-budget-review-required'};
type Petition={id:string;author:string;region:string;topic:string;createdAt:number;deadline:number;threshold:number;termsVersion:string;sourceKey:string;version:number;members:Record<string,Support>;withdrawn:{at:number;key:string}|null;notice:{id:string;at:number;key:string}|null;review:Review|null};
export type CivicState={petitions:Record<string,Petition>};
const count=(p:Petition)=>Object.values(p.members).filter(m=>m.changes.at(-1)?.supported).length;
const open=(p:Petition,now:number)=>!p.withdrawn&&!p.review&&now<p.deadline;
const idFor=(key:string)=>'petition-'+createHash('sha256').update(key).digest('hex').slice(0,24);
export function civicCommand(s:State,actor:string,c:Command,now:number,key:string):Record<string,unknown>|undefined{
 if(!['CreateCivicPetition','SupportCivicPetition','WithdrawCivicSupport','WithdrawCivicPetition','ReviewCivicPetition'].includes(c.type))return;
 const citizen=s.citizens[actor];if(!citizen)throw new DomainError('CITIZEN_REQUIRED','Create your citizen first.');
 if(now<citizen.enrolledAt)throw new DomainError('CIVIC_CLOCK','Petition actions cannot predate citizen enrolment.');
 const input=c.payload,m=s.civic??={petitions:{}};let p:Petition;
 if(c.type==='CreateCivicPetition'){
  if(input.consent!==true||input.termsVersion!==PETITION_RULES.version)throw new DomainError('CIVIC_CONSENT','Agree to publish the petition under your citizen name and add your support.',400);
  if(!PETITION_TOPICS.some(t=>t.id===input.topic))throw new DomainError('PETITION_TOPIC','Choose a listed public-service subject.',400);
  if(Object.values(m.petitions).some(p=>p.author===actor&&now-p.createdAt<PETITION_RULES.creationInterval))throw new DomainError('PETITION_RATE_LIMIT','Wait a day before proposing another petition.');
  if(Object.values(m.petitions).some(p=>p.region===citizen.state&&p.topic===input.topic&&open(p,now)))throw new DomainError('PETITION_EXISTS','An open petition already covers this subject. Review it and choose whether to support it.');
  const id=idFor(key);p={id,author:actor,region:citizen.state,topic:String(input.topic),createdAt:now,deadline:now+PETITION_RULES.window,threshold:PETITION_RULES.threshold,termsVersion:PETITION_RULES.version,sourceKey:key,version:1,members:{[actor]:{actor,changes:[{key,at:now,supported:true}]}},withdrawn:null,notice:null,review:null};m.petitions[id]=p;
 }else{
  const found=m.petitions[String(input.petitionId)];if(!found)throw new DomainError('PETITION_NOT_FOUND','Choose an available petition.',404);p=found;
  if(citizen.state!==p.region)throw new DomainError('CIVIC_JURISDICTION','Participate in petitions for your registered state. Travel does not change civic registration.',403);
  if(now<p.createdAt||Object.values(p.members).some(m=>m.changes.some(c=>c.at>now))||p.withdrawn&&p.withdrawn.at>now||p.review&&p.review.at>now)throw new DomainError('CIVIC_CLOCK','The server clock must advance past the recorded action.');
  if(input.petitionVersion!==p.version||input.termsVersion!==p.termsVersion)throw new DomainError('PETITION_CHANGED','Refresh and review the current petition before continuing.');
  if(c.type==='SupportCivicPetition'||c.type==='WithdrawCivicSupport'){
   const support=p.members[actor],last=support?.changes.at(-1),sign=c.type==='SupportCivicPetition';
   if(sign&&input.consent!==true)throw new DomainError('CIVIC_CONSENT','Explicitly agree before recording private support.',400);
   if(sign&&!open(p,now))throw new DomainError('PETITION_CLOSED','Review an open petition and explicitly consent before supporting it.');
   if(!!last?.supported===sign)throw new DomainError(sign?'ALREADY_SUPPORTED':'NO_CIVIC_SUPPORT',sign?'Your support is already recorded.':'There is no active support to withdraw.');
   if((support?.changes.length??0)>=PETITION_RULES.maxChanges)throw new DomainError('CIVIC_CHANGE_LIMIT','The disclosed support-change limit has been reached.');
   const member=support??(p.members[actor]={actor,changes:[]});member.changes.push({key,at:now,supported:sign});
   if(!p.notice&&count(p)>=p.threshold)p.notice={id:'notice-'+p.id,at:now,key};
  }else if(c.type==='WithdrawCivicPetition'){
   if(p.author!==actor)throw new DomainError('PETITION_AUTHOR','Only the proposer can withdraw the petition.',403);
   if(p.withdrawn||p.review)throw new DomainError('PETITION_CLOSED','This petition has already closed. Your individual support can still be withdrawn.');
   p.withdrawn={at:now,key};
  }else{
   if(!p.notice||p.review||now<p.notice.at+PETITION_RULES.reviewDelay)throw new DomainError('CIVIC_REVIEW_PENDING','Formal consideration follows the notice after a day. Each petition is reviewed once.');
   const support=count(p),treasury=s.balances['treasury:state:'+p.region]??0,cost=PETITION_TOPICS.find(t=>t.id===p.topic)!.cost;
   p.review={at:now,key,support,treasury,estimatedCost:cost,outcome:p.withdrawn?'withdrawn':support<p.threshold?'insufficient-support':treasury<cost?'funding-proposal-required':'formal-budget-review-required'};
  }
  p.version++;
 }
 return{termsVersion:p.termsVersion,...(c.type==='CreateCivicPetition'||c.type==='SupportCivicPetition'?{consent:true}:{}),petitionId:p.id,region:p.region,topic:p.topic,petitionVersion:p.version,supportCount:count(p),...(p.notice?.key===key?{noticeCreated:{id:p.notice.id,at:p.notice.at}}:{}),...(p.review?.key===key?{consideration:{at:p.review.at,support:p.review.support,treasury:p.review.treasury,estimatedCost:p.review.estimatedCost,outcome:p.review.outcome}}:{}),message:c.type==='ReviewCivicPetition'?'The NPC civic desk recorded its consideration. This does not appropriate funds, change a policy or grant an office.':c.type.startsWith('Withdraw')?'Your withdrawal is recorded; the original evidence and any formal notice remain.':'Petition participation recorded. Support counts never grant government authority.'};
}
export function civicView(s:State,actor:string,now:number){
 const citizen=s.citizens[actor];if(!citizen)return null;
 const petitions=Object.values(s.civic?.petitions??{}).filter(p=>p.region===citizen.state).sort((a,b)=>b.createdAt-a.createdAt||a.id.localeCompare(b.id)).filter((p,index)=>index<50||open(p,now)||p.notice&&!p.review||p.members[actor]?.changes.at(-1)?.supported).map(p=>({id:p.id,author:s.citizens[p.author]?.name,topic:p.topic,subject:PETITION_TOPICS.find(t=>t.id===p.topic)!.name,region:p.region,createdAt:p.createdAt,deadline:p.deadline,threshold:p.threshold,termsVersion:p.termsVersion,version:p.version,supportCount:count(p),supported:!!p.members[actor]?.changes.at(-1)?.supported,canSupport:open(p,now)&&!p.members[actor]?.changes.at(-1)?.supported&&(p.members[actor]?.changes.length??0)<PETITION_RULES.maxChanges,canWithdrawSupport:!!p.members[actor]?.changes.at(-1)?.supported&&(p.members[actor]?.changes.length??0)<PETITION_RULES.maxChanges,canProposeWithdrawal:p.author===actor&&!p.withdrawn&&!p.review,open:open(p,now),status:p.review?'considered':p.withdrawn?'withdrawn':now>=p.deadline?'expired':p.notice?'noticed':'open',notice:p.notice?{id:p.notice.id,at:p.notice.at,reviewAt:p.notice.at+PETITION_RULES.reviewDelay}:null,review:p.review?{at:p.review.at,support:p.review.support,treasury:p.review.treasury,estimatedCost:p.review.estimatedCost,outcome:p.review.outcome}:null,canReview:!!p.notice&&!p.review&&now>=p.notice.at+PETITION_RULES.reviewDelay}));
 return{region:citizen.state,limits:{windowDays:7,reviewDelayDays:1,proposalIntervalDays:1,threshold:PETITION_RULES.threshold,supportChanges:PETITION_RULES.maxChanges},termsVersion:PETITION_RULES.version,topics:PETITION_TOPICS,petitions,notice:'Petitions are public-service requests. Signer identities remain private; aggregate support and the proposer’s citizen name are public. A threshold triggers NPC consideration, never an automatic law, expenditure or elected office.'};
}
export function civicRevision(s:State,actor:string,now:number){const view=civicView(s,actor,now);return createHash('sha256').update(canonical(view)).digest('hex');}
// Reconstruct from immutable receipts in durable event order, rather than JSON object
// order or wall-clock ties. Treasury snapshots use the journals of preceding commands.
export function reconcileCivic(s:State){
 const replay:State={...s,civic:{petitions:{}},balances:{}};
 const actions=new Set(['CreateCivicPetition','SupportCivicPetition','WithdrawCivicSupport','WithdrawCivicPetition','ReviewCivicPetition']);
 const seen=new Set<string>(),treasuryJournals=new Map<string,State['journals']>();
 for(const j of s.journals.filter(j=>j.entries.some(e=>e.account.startsWith('treasury:state:')))){
  const owner=s.outbox.find(e=>j.id===e.id||j.id.startsWith(e.id+':'));
  if(!owner)throw Error('Civic treasury journal lacks command evidence');
  const list=treasuryJournals.get(owner.id)??[];list.push(j);treasuryJournals.set(owner.id,list);
 }
 for(const event of s.outbox){
  const stored=s.commands[event.id],r=stored?.receipt;
  for(const j of treasuryJournals.get(event.id)??[])for(const e of j.entries)replay.balances[e.account]=(replay.balances[e.account]??0)+e.amount;
  if(!actions.has(event.type))continue;
  if(!r||r.type!==event.type||r.actorId!==event.actorId||r.at!==event.at||seen.has(event.id)||!Number.isSafeInteger(r.at)||r.at<0)throw Error('Invalid civic event evidence');
  seen.add(event.id);
  if(s.journals.some(j=>j.id===event.id||j.id.startsWith(event.id+':')))throw Error('Civic participation cannot move money');
  const payload={topic:r.detail.topic,termsVersion:r.detail.termsVersion,consent:r.detail.consent,petitionId:r.detail.petitionId,petitionVersion:Number(r.detail.petitionVersion)-1};
  let generated:Record<string,unknown>|undefined;
  try{generated=civicCommand(replay,r.actorId,{id:r.commandId,type:r.type,payload},r.at,event.id);}catch{throw Error('Invalid civic participation history');}
  const detail={...r.detail};delete detail.homeVisitClosureProofs;delete detail.relationshipClosureProofs;
  if(!generated||canonical(detail)!==canonical(generated))throw Error('Civic participation receipt mismatch');
  if(canonical(event.payload)!==canonical(r.detail))throw Error('Civic event differs from receipt');
 }
 if(Object.entries(s.commands).some(([key,v])=>actions.has(v.receipt.type)&&!seen.has(key)))throw Error('Orphan civic participation receipt');
 if(canonical(replay.civic?.petitions)!==canonical(s.civic?.petitions??{}))throw Error('Civic petition history mismatch');
}
