import {createHash} from 'node:crypto';
import {DomainError,post} from './domain.ts';
import type {State,Command} from './domain.ts';
import {getCommerce,companyPermission} from './commerce.ts';
import type {Company} from './commerce.ts';
import {DAY} from './rules.ts';
import {companyObligations} from './company-obligations.ts';

export type CorporateAction={id:string;company:string;maker:string;kind:'dividend'|'transfer'|'issue'|'buyback'|'restructure'|'resume'|'liquidate';amount:number;units:number;holder:string|null;buyer:string|null;at:number;expiresAt:number;baseSignature:string;signature:string;controllers:string[];required:number;owners:string[];votes:Record<string,boolean>;consents:Record<string,boolean>;buyerAccepted:boolean;status:'pending'|'ready'|'executed'|'cancelled'|'expired';version:number;settledCommand?:string};
export type GovernanceState={actions:Record<string,CorporateAction>};
const governance=(s:State)=>s.governance??={actions:{}};
const number=(v:unknown,min=1,max=100000000)=>{if(!Number.isSafeInteger(v)||(v as number)<min||(v as number)>max)throw new DomainError('INVALID_AMOUNT','Use a whole amount within the disclosed limits.',400);return v as number;};
const controllers=(c:Company)=>Object.keys(c.members).filter(a=>['founder','cofounder','ceo'].includes(c.members[a])).sort();
export const issuedShares=(c:Company)=>c.issuedShares??100000;
const signature=(c:Company)=>createHash('sha256').update(JSON.stringify({shares:Object.entries(c.shares).sort(([a],[b])=>a.localeCompare(b)),controllers:controllers(c),issued:issuedShares(c),status:c.status})).digest('hex');
const active=(a:CorporateAction)=>['pending','ready'].includes(a.status);
function participant(c:Company,a:CorporateAction,actor:string){return !!c.members[actor]||!!c.shares[actor]||a.maker===actor||a.holder===actor||a.buyer===actor||a.controllers.includes(actor)||a.owners.includes(actor);}
function checkCurrent(c:Company,a:CorporateAction,now:number){
 if(!active(a))throw new DomainError('CORPORATE_ACTION_CLOSED','This proposal has already finished.');
 if(now>=a.expiresAt)throw new DomainError('CORPORATE_ACTION_EXPIRED','Return the expired reservations before making a new proposal.');
 if(!(a.kind==='resume'?['restructuring']:a.kind==='liquidate'?['active','restructuring']:['active']).includes(c.status))throw new DomainError('COMPANY_DISTRESSED','This action is unavailable in the current company stage.');
 if(signature(c)!==a.baseSignature)throw new DomainError('CORPORATE_ACTION_STALE','Ownership or controllers changed. Cancel and review a new proposal.');
}
function refresh(a:CorporateAction){a.status=a.controllers.filter(actor=>a.votes[actor]===true).length>=a.required&&a.owners.every(actor=>a.consents[actor]===true)&&(!a.buyer||a.buyerAccepted)?'ready':'pending';a.version++;}
export function availableShares(s:State,c:Company,actor:string){
 const reserved=Object.values(s.governance?.actions??{}).filter(a=>a.company===c.id&&active(a)&&a.holder===actor&&['transfer','buyback'].includes(a.kind)).reduce((n,a)=>n+a.units,0);
 return (c.shares[actor]??0)-reserved;
}
function release(s:State,a:CorporateAction,now:number,key:string,status:'cancelled'|'expired'){
 const corporate=s.balances['corporate:'+a.id]??0,purchase=s.balances['share-purchase:'+a.id]??0;
 if(corporate||purchase)post(s,key,now,'Uncommitted corporate reservation refund',[
  {account:'corporate:'+a.id,amount:-corporate},{account:'company:'+a.company,amount:corporate},
  {account:'share-purchase:'+a.id,amount:-purchase},{account:'citizen:'+a.buyer,amount:purchase}
 ]);
 a.status=status;a.version++;
}
export function proportionalDividend(c:Company,amount:number){
 const total=BigInt(issuedShares(c));
 const rows=Object.entries(c.shares).map(([actor,units])=>({actor,value:Number(BigInt(amount)*BigInt(units)/total),remainder:BigInt(amount)*BigInt(units)%total}));
 let remaining=amount-rows.reduce((n,row)=>n+row.value,0);
 for(const row of [...rows].sort((a,b)=>a.remainder>b.remainder?-1:a.remainder<b.remainder?1:a.actor.localeCompare(b.actor)))if(remaining-->0)row.value++;
 return rows.map(row=>({account:'citizen:'+row.actor,amount:row.value}));
}
export function governanceCommand(s:State,actor:string,command:Command,now:number,key:string):Record<string,unknown>|undefined{
 if(!['ProposeCorporateAction','VoteCorporateAction','AcceptCorporateTerms','ExecuteCorporateAction','CancelCorporateAction','ExpireCorporateAction'].includes(command.type))return;
 if(!s.citizens[actor])throw new DomainError('CITIZEN_REQUIRED','Create a citizen first.');
 const p=command.payload,m=getCommerce(s),g=governance(s);
 if(command.type==='ProposeCorporateAction'){
  const c=m.companies[String(p.companyId)],kind=String(p.kind) as CorporateAction['kind'];
  if(!c||!(kind==='resume'?['restructuring']:kind==='liquidate'?['active','restructuring']:['active']).includes(c.status))throw new DomainError('COMPANY_DISTRESSED','Choose a company in the appropriate operating stage.');
  if(!['dividend','transfer','issue','buyback','restructure','resume','liquidate'].includes(kind))throw new DomainError('INVALID_CORPORATE_ACTION','Choose a listed protected action.',400);
  if(p.acceptTerms!==true)throw new DomainError('TERMS_REQUIRED','Review the amount, ownership effect and seven-day reservation period.');
  if(kind!=='transfer')companyPermission(s,actor,c.id,'govern',now);
  const noncash=['restructure','resume'].includes(kind),minimum=['transfer','liquidate','restructure','resume'].includes(kind)?0:1,amount=number(p.amount,minimum),units=['transfer','issue','buyback'].includes(kind)?number(p.units,1,1000000):0;
  if(noncash&&amount!==0)throw new DomainError('NONCASH_ACTION','An operating-stage decision must have a zero payment amount.',400);
  if(kind==='liquidate'){
   const blockers=companyObligations(s,c.id);
   if(blockers.length)throw new DomainError('COMPANY_OBLIGATIONS','Resolve the recorded assets and commitments first: '+blockers.map(b=>b.kind).join(', ')+'.');
   if(amount!==(s.balances['company:'+c.id]??0))throw new DomainError('FINAL_BALANCE_CHANGED','Review the exact remaining company cash before liquidation.');
  }
  const buyer=['transfer','issue'].includes(kind)?Object.values(s.citizens).find(citizen=>citizen.id===p.buyerCitizenId)?.actorId??null:null;
  const holder=kind==='transfer'?actor:kind==='buyback'?Object.values(s.citizens).find(citizen=>citizen.id===p.holderCitizenId)?.actorId??null:null;
  if(['transfer','issue'].includes(kind)&&(!buyer||kind==='transfer'&&buyer===actor))throw new DomainError('INVALID_SHARE_RECIPIENT','Choose a valid recorded buyer; a transfer needs a different owner.',400);
  if(kind==='buyback'&&!holder)throw new DomainError('INVALID_SHARE_HOLDER','Choose a recorded shareholder.',400);
  if(holder&&availableShares(s,c,holder)<units)throw new DomainError('SHARES_UNAVAILABLE','The holder does not have enough unreserved shares.');
  if(kind==='buyback'&&issuedShares(c)-units<1)throw new DomainError('FINAL_SHARE_PROTECTED','A buyback cannot remove every issued share.');
  if(kind==='issue'&&issuedShares(c)+units>10000000)throw new DomainError('SHARE_ISSUE_LIMIT','The proposed issued-share limit is ten million.');
  const other=buyer??(kind==='buyback'?holder:null);
  if(other&&other!==actor&&(s.life?.blocks[actor]?.includes(other)||s.life?.blocks[other]?.includes(actor)))throw new DomainError('CONTACT_BLOCKED','This ownership invitation cannot be sent.',403);
  const electorate=controllers(c);if(!electorate.length)throw new DomainError('CONTROLLER_REQUIRED','Restore authorised company governance before changing ownership.');
  const id='corporate_'+createHash('sha256').update(key).digest('hex').slice(0,24);
  if(amount&&['dividend','buyback','liquidate'].includes(kind))post(s,key,now,'Reserved protected company action',[{account:'company:'+c.id,amount:-amount},{account:'corporate:'+id,amount}]);
  const baseSignature=signature(c),expiresAt=now+7*DAY;
  const termsSignature=createHash('sha256').update(JSON.stringify({id,company:c.id,maker:actor,kind,amount,units,holder,buyer,expiresAt,baseSignature})).digest('hex');
  const ownershipConsent=['issue','liquidate'].includes(kind);
  const a:CorporateAction={id,company:c.id,maker:actor,kind,amount,units,holder,buyer,at:now,expiresAt,baseSignature,signature:termsSignature,controllers:electorate,required:Math.min(2,electorate.length),owners:ownershipConsent?Object.keys(c.shares).sort():holder?[holder]:[],votes:electorate.includes(actor)?{[actor]:true}:{},consents:holder===actor||ownershipConsent&&!!c.shares[actor]?{[actor]:true}:{},buyerAccepted:false,status:'pending',version:1};
  refresh(a);g.actions[id]=a;
  return {proposalId:id,requiredApprovals:a.required,amount,units,expiresAt:a.expiresAt,message:'Exact terms recorded. Existing funds and offered shares are reserved; titles do not grant ownership.'};
 }
 const a=g.actions[String(p.proposalId)],c=a?m.companies[a.company]:null;
 if(!a||!c)throw new DomainError('CORPORATE_ACTION_NOT_FOUND','This proposal is unavailable.',404);
 if(!participant(c,a,actor))throw new DomainError('CORPORATE_PERMISSION','Only a recorded party can inspect or act on this proposal.',403);
 if(command.type==='CancelCorporateAction'||command.type==='ExpireCorporateAction'){
  if(!active(a))throw new DomainError('CORPORATE_ACTION_CLOSED','This proposal has already finished.');
  if(command.type==='ExpireCorporateAction'){if(now<a.expiresAt)throw new DomainError('CORPORATE_ACTION_PENDING','The reservation period has not expired.');}
  else if(![a.maker,a.buyer,a.holder].includes(actor))throw new DomainError('CORPORATE_PERMISSION','Only a proposing or trading party may cancel before settlement.',403);
  release(s,a,now,key,command.type==='ExpireCorporateAction'?'expired':'cancelled');
  return{proposalId:a.id,message:'Uncommitted funds returned to their original owners and share reservations released.'};
 }
 checkCurrent(c,a,now);
 if(command.type==='VoteCorporateAction'){
  if(!a.controllers.includes(actor)||!controllers(c).includes(actor))throw new DomainError('CORPORATE_PERMISSION','A current authorised controller must sign this decision.',403);
  if(typeof p.approve!=='boolean')throw new DomainError('DECISION_REQUIRED','Choose approve or reject.',400);
  if(p.signature!==a.signature)throw new DomainError('TERMS_CHANGED','Review the exact current terms before signing.');
  a.votes[actor]=p.approve;c.lastActive[actor]=now;refresh(a);
  return{proposalId:a.id,status:a.status,message:'One decision per authorised controller recorded. Rejection or withdrawal does not move money.'};
 }
 if(command.type==='AcceptCorporateTerms'){
  if(p.acceptTerms!==true||p.acceptedAmount!==a.amount||p.acceptedUnits!==a.units||p.signature!==a.signature)throw new DomainError('TERMS_CHANGED','Review the exact price, share quantity and ownership effect first.');
  if(!a.owners.includes(actor)&&a.buyer!==actor)throw new DomainError('CORPORATE_PERMISSION','Only the named buyer or an affected shareholder may accept these ownership terms.',403);
  if(a.buyer===actor&&!a.buyerAccepted){
   if(s.life?.blocks[actor]?.includes(a.maker)||s.life?.blocks[a.maker]?.includes(actor))throw new DomainError('CONTACT_BLOCKED','This ownership invitation cannot be accepted.',403);
   if(a.amount)post(s,key,now,'Reserved consented share purchase',[{account:'citizen:'+actor,amount:-a.amount},{account:'share-purchase:'+a.id,amount:a.amount}]);a.buyerAccepted=true;
  }
  if(a.owners.includes(actor))a.consents[actor]=true;
  refresh(a);return{proposalId:a.id,status:a.status,message:'Ownership terms accepted. The purchase remains reserved until all required signatures are present.'};
 }
 if(a.status!=='ready')throw new DomainError('CORPORATE_APPROVAL_REQUIRED','The independent controller approvals and ownership consents are incomplete.');
 // Recheck the cap table and all commitments inside the same domain transaction.
 if(a.kind==='dividend')post(s,key,now,'Approved proportional company dividend',[{account:'corporate:'+a.id,amount:-a.amount},...proportionalDividend(c,a.amount)]);
 else if(a.kind==='transfer'){
  if((c.shares[a.holder!]??0)<a.units)throw new DomainError('SHARES_UNAVAILABLE','The reserved shares are no longer available.');
  if(a.amount)post(s,key,now,'Approved share transfer settlement',[{account:'share-purchase:'+a.id,amount:-a.amount},{account:'citizen:'+a.holder,amount:a.amount}]);
  c.shares[a.holder!]-=a.units;c.shares[a.buyer!]=(c.shares[a.buyer!]??0)+a.units;if(c.shares[a.holder!]===0)delete c.shares[a.holder!];
 }else if(a.kind==='issue'){
  post(s,key,now,'Unanimously consented new share capital',[{account:'share-purchase:'+a.id,amount:-a.amount},{account:'company:'+c.id,amount:a.amount}]);
  c.issuedShares=issuedShares(c)+a.units;c.shares[a.buyer!]=(c.shares[a.buyer!]??0)+a.units;
 }else if(a.kind==='buyback'){
  post(s,key,now,'Approved consenting shareholder buyback',[{account:'corporate:'+a.id,amount:-a.amount},{account:'citizen:'+a.holder,amount:a.amount}]);
  c.issuedShares=issuedShares(c)-a.units;c.shares[a.holder!]-=a.units;if(c.shares[a.holder!]===0)delete c.shares[a.holder!];
 }else if(a.kind==='restructure')c.status='restructuring';
 else if(a.kind==='resume')c.status='active';
 else{
  const blockers=companyObligations(s,c.id,a.id);
  if(blockers.length)throw new DomainError('COMPANY_OBLIGATIONS','Resolve all recorded company assets and commitments before closing.');
  if((s.balances['company:'+c.id]??0)!==0)throw new DomainError('FINAL_BALANCE_CHANGED','Additional company cash arrived. Cancel and review the updated final distribution.');
  if(a.amount)post(s,key,now,'Approved final company liquidation distribution',[{account:'corporate:'+a.id,amount:-a.amount},...proportionalDividend(c,a.amount)]);
  c.status='closed';c.actingManager=null;
 }
 c.version++;a.status='executed';a.settledCommand=key;a.version++;
 return{proposalId:a.id,kind:a.kind,amount:a.amount,units:a.units,message:'Approved cash and ownership changes settled once. Employment roles and personal assets were not transferred.'};
}
export function governanceView(s:State,actor:string,now:number){
 const m=s.commerce;
 const citizen=(a:string|null)=>a?s.citizens[a]?.id:null;
 return {companies:Object.values(m?.companies??{}).filter(c=>c.members[actor]||c.shares[actor]).map(c=>({id:c.id,name:c.name,status:c.status,issuedShares:issuedShares(c),yourShares:c.shares[actor]??0,availableShares:availableShares(s,c,actor),controller:controllers(c).includes(actor),requiredApprovals:Math.min(2,controllers(c).length),balance:s.balances['company:'+c.id]??0,closureBlockers:companyObligations(s,c.id)})),actions:Object.values(s.governance?.actions??{}).filter(a=>m?.companies[a.company]&&participant(m.companies[a.company],a,actor)).map(a=>({...a,maker:citizen(a.maker),holder:citizen(a.holder),buyer:citizen(a.buyer),controllers:a.controllers.map(citizen),owners:a.owners.map(citizen),votes:Object.fromEntries(Object.entries(a.votes).map(([actor,vote])=>[citizen(actor),vote])),consents:Object.fromEntries(Object.entries(a.consents).map(([actor,consent])=>[citizen(actor),consent])),settledCommand:undefined,stale:signature(m!.companies[a.company])!==a.baseSignature,expired:active(a)&&now>=a.expiresAt,canVote:a.controllers.includes(actor),canConsent:a.owners.includes(actor)||a.buyer===actor,canCancel:[a.maker,a.buyer,a.holder].includes(actor)}))};
}
export function reconcileGovernance(s:State){
 for(const c of Object.values(s.commerce?.companies??{})){
  const entries=Object.entries(c.shares),issued=issuedShares(c);
  if(!Number.isSafeInteger(issued)||issued<1||issued>10000000||!entries.length||entries.some(([actor,units])=>!s.citizens[actor]||!Number.isSafeInteger(units)||units<1)||entries.reduce((n,[,units])=>n+BigInt(units),0n)!==BigInt(issued))throw new Error('Company cap table does not reconcile');
  for(const [actor] of entries)if(availableShares(s,c,actor)<0)throw new Error('Company share reservations exceed ownership');
  const registration=Object.values(s.commands).find(command=>command.receipt.type==='RegisterCompany'&&command.receipt.detail.companyId===c.id)?.receipt;
  if(!registration)throw new Error('Company registration proof missing');
  const expected:Record<string,number>={[registration.actorId]:100000};let expectedIssued=100000;
  for(const action of Object.values(s.governance?.actions??{}).filter(a=>a.company===c.id&&a.status==='executed')){
   if(action.kind==='transfer'||action.kind==='buyback')expected[action.holder!]=(expected[action.holder!]??0)-action.units;
   if(action.kind==='transfer'||action.kind==='issue')expected[action.buyer!]=(expected[action.buyer!]??0)+action.units;
   if(action.kind==='issue')expectedIssued+=action.units;if(action.kind==='buyback')expectedIssued-=action.units;
  }
  if(expectedIssued!==issued||[...new Set([...Object.keys(expected),...Object.keys(c.shares)])].some(actor=>(expected[actor]??0)!==(c.shares[actor]??0)))throw new Error('Company ownership lacks settled transfer evidence');
 }
 for(const a of Object.values(s.governance?.actions??{})){
  if(!s.commerce?.companies[a.company]||!s.citizens[a.maker]||!['dividend','transfer','issue','buyback','restructure','resume','liquidate'].includes(a.kind)||!Number.isSafeInteger(a.amount)||a.amount<0||!Number.isSafeInteger(a.units)||a.units<0||!Number.isInteger(a.required)||a.required!==Math.min(2,a.controllers.length)||a.required<1||new Set(a.controllers).size!==a.controllers.length||a.controllers.some(actor=>!s.citizens[actor])||a.owners.some(actor=>!s.citizens[actor])||!['pending','ready','executed','cancelled','expired'].includes(a.status))throw new Error('Invalid corporate action');
  const companyReserve=active(a)&&['dividend','buyback','liquidate'].includes(a.kind)?a.amount:0,purchaseReserve=active(a)&&a.buyerAccepted&&['transfer','issue'].includes(a.kind)?a.amount:0;
  if((s.balances['corporate:'+a.id]??0)!==companyReserve||(s.balances['share-purchase:'+a.id]??0)!==purchaseReserve)throw new Error('Corporate reservation does not reconcile');
  if(a.status==='executed'&&s.commands[a.settledCommand??'']?.receipt.detail.proposalId!==a.id)throw new Error('Corporate settlement proof missing');
 }
}
