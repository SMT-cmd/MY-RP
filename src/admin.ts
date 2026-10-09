import {createHash} from 'node:crypto';
import {DomainError,canonical,DAY} from './domain.ts';
import type {State,Command} from './domain.ts';
import {REGIONS,regionByName} from './geography.ts';
export const STAFF_ROLES=['super','moderator','economy','support','content','technical'] as const;
export type StaffRole=typeof STAFF_ROLES[number];
export type StaffSession={sessionId:string;assurance:'aal1'|'aal2';stepUpAt?:number};
export type AdminContext={session?:StaffSession;bootstrap?:boolean};
export const ADMIN_RULES={version:'staff-1.0',stepUp:15*60000,proposalTTL:15*60000,maxGrant:30*DAY,maxPending:64};
type Grant={id:string;actor:string;role:StaffRole;region:string|null;expiresAt:number|null;status:'active'|'revoked';version:number;issuedBy:string;bootstrap:boolean};
type Decision={actor:string;sessionId:string;at:number;stepUpAt:number;reason:string};
type Proposal={id:string;action:'grant'|'revoke';target:string;role:StaffRole;region:string|null;grantId:string|null;grantVersion:number|null;grantUntil:number|null;maker:string;reason:string;createdAt:number;expiresAt:number;signature:string;approvals:Decision[];status:'pending'|'ready'|'rejected'|'applied';version:number;settledBy:string|null};
type Audit={sequence:number;at:number;actor:string;sessionId:string|null;stepUpAt:number|null;role:string;action:string;target:string;reason:string;commandKey:string;before:string;after:string;previousHash:string;hash:string};
export type AdminState={version:number;bootstrapActors:string[];grants:Record<string,Grant>;proposals:Record<string,Proposal>;audit:Audit[]};
export const ADMIN_COMMANDS=new Set(['BootstrapStaff','ProposeStaffChange','DecideStaffChange','ApplyStaffChange']);
export const isAdminCommand=(type:string)=>ADMIN_COMMANDS.has(type);
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const digest=(value:unknown)=>createHash('sha256').update(canonical(value)).digest('hex');
const material=(m:AdminState|undefined)=>m?{version:m.version,bootstrapActors:m.bootstrapActors,grants:m.grants,proposals:m.proposals}:null;
const active=(g:Grant,now:number)=>g.status==='active'&&(g.expiresAt===null||g.expiresAt>now);
export const staffGrants=(s:State,actor:string,now:number)=>Object.values(s.administration?.grants??{}).filter(g=>g.actor===actor&&active(g,now));
const hasSuper=(s:State,actor:string,now:number)=>staffGrants(s,actor,now).some(g=>g.role==='super');
const fresh=(session:StaffSession|undefined,now:number)=>{const at=session?.stepUpAt;return session?.assurance==='aal2'&&typeof at==='number'&&Number.isSafeInteger(at)&&at>=0&&at<=now&&now-at<ADMIN_RULES.stepUp;};
function reason(value:unknown){if(typeof value!=='string'||value.trim().length<10||value.trim().length>400)throw new DomainError('ADMIN_REASON','Give a reason of 10–400 characters.',400);return value.trim();}
export function assertStaff(s:State,actor:string,session:StaffSession|undefined,now:number,superOnly=false){
 if(!staffGrants(s,actor,now).length||superOnly&&!hasSuper(s,actor,now))throw new DomainError('STAFF_PERMISSION','This staff action is outside your current permissions.',403);
 assertStaffSession(s,session,now);
}
export function assertStaffSession(s:State,session:StaffSession|undefined,now:number){
 if(!fresh(session,now))throw new DomainError('STAFF_STEP_UP','Verify a fresh authenticator code before using staff controls.',403);
 if(!session)throw new DomainError('STAFF_STEP_UP','Verify a fresh authenticator code before using staff controls.',403);
 if(!/^[a-zA-Z0-9_-]{3,100}$/.test(session.sessionId)||s.sessions?.revoked[session.sessionId])throw new DomainError('SESSION_REVOKED','Sign in again to continue.',401);
}
export function ownStaffReceipt(s:State,actor:string,session:StaffSession,commandId:string,now:number){
 assertStaffSession(s,session,now);if(!/^[a-zA-Z0-9_-]{8,100}$/.test(commandId))throw new DomainError('INVALID_COMMAND','Use a valid staff action identifier.',400);
 const receipt=s.commands[actor+':'+commandId]?.receipt;
 return{receipt:receipt&&isAdminCommand(receipt.type)&&receipt.type!=='BootstrapStaff'?receipt:null};
}
export function authoriseAdminCommand(s:State,actor:string,type:string,context:AdminContext|undefined,now:number){
 if(!isAdminCommand(type))return;
 if(type==='BootstrapStaff'){if(context?.bootstrap!==true)throw new DomainError('STAFF_PERMISSION','Initial staff setup requires the trusted operator command.',403);return;}
 assertStaff(s,actor,context?.session,now,true);
}
const terms=(p:Proposal)=>({id:p.id,action:p.action,target:p.target,role:p.role,region:p.region,grantId:p.grantId,grantVersion:p.grantVersion,grantUntil:p.grantUntil,maker:p.maker,reason:p.reason,createdAt:p.createdAt,expiresAt:p.expiresAt});
const validDecisions=(s:State,p:Proposal,now:number)=>p.approvals.filter(a=>hasSuper(s,a.actor,now)&&!s.sessions?.revoked[a.sessionId]&&a.at>=p.createdAt&&now-a.at<ADMIN_RULES.proposalTTL);
function audit(s:State,actor:string,command:Command,now:number,key:string,context:AdminContext|undefined,before:string,target:string,why:string){
 const m=s.administration!,previousHash=m.audit.at(-1)?.hash??'0'.repeat(64),record={sequence:m.audit.length+1,at:now,actor,sessionId:context?.session?.sessionId??null,stepUpAt:context?.session?.stepUpAt??null,role:context?.bootstrap?'out-of-band-bootstrap':'super',action:command.type,target,reason:why,commandKey:key,before,after:digest(material(m)),previousHash};
 m.audit.push({...record,hash:digest(record)});
}
export function adminCommand(s:State,actor:string,command:Command,now:number,key:string,context?:AdminContext):Record<string,unknown>|undefined{
 if(!isAdminCommand(command.type))return;
 authoriseAdminCommand(s,actor,command.type,context,now);const p=command.payload,before=digest(material(s.administration));let target=s.worldId,why:string;
 if(command.type==='BootstrapStaff'){
  if(s.administration)throw new DomainError('STAFF_ALREADY_CONFIGURED','Initial staff authority has already been recorded.');
  if(!Array.isArray(p.actors)||p.actors.length!==2||p.actors.some(a=>typeof a!=='string'||!uuid.test(a))||new Set(p.actors.map(a=>String(a).toLowerCase())).size!==2)throw new DomainError('STAFF_BOOTSTRAP','Choose two distinct verified Auth account IDs.',400);
  why=reason(p.reason);const actors=(p.actors as string[]).map(a=>a.toLowerCase()),m:AdminState={version:1,bootstrapActors:[...actors],grants:{},proposals:{},audit:[]};s.administration=m;
  for(const [i,subject] of actors.entries()){const id='staff-root-'+(i+1);m.grants[id]={id,actor:subject,role:'super',region:null,expiresAt:null,status:'active',version:1,issuedBy:key,bootstrap:true};}
  audit(s,actor,command,now,key,context,before,target,why);return{adminVersion:1,message:'Two independent staff-grant authorities recorded. Neither receives economy, support or technical powers.'};
 }
 const m=s.administration!;if(p.adminVersion!==m.version)throw new DomainError('STAFF_VERSION','Refresh staff controls and review the current permissions.');
 if(command.type==='ProposeStaffChange'){
  why=reason(p.reason);if(!['grant','revoke'].includes(String(p.action)))throw new DomainError('STAFF_TERMS','Choose grant or revoke.',400);
  if(Object.values(m.proposals).filter(a=>['pending','ready'].includes(a.status)&&a.expiresAt>now).length>=ADMIN_RULES.maxPending)throw new DomainError('STAFF_QUEUE_FULL','Review or expire existing staff proposals first.');
  let subject:string,role:StaffRole,region:string|null,grantId:string|null=null,grantVersion:number|null=null,grantUntil:number|null=null;
  if(p.action==='revoke'){
   const grant=m.grants[String(p.grantId)];if(!grant||!active(grant,now)||p.grantVersion!==grant.version)throw new DomainError('STAFF_GRANT_CHANGED','Review a current active grant before revoking it.');
   subject=grant.actor;role=grant.role;region=grant.region;grantId=grant.id;grantVersion=grant.version;
  }else{
   if(typeof p.targetActorId!=='string'||!uuid.test(p.targetActorId)||!s.citizens[p.targetActorId]&&!m.bootstrapActors.includes(p.targetActorId))throw new DomainError('STAFF_SUBJECT','Use a verified Auth account that has joined this world.',400);
   if(!STAFF_ROLES.includes(p.role as StaffRole)||p.region!==null&&!regionByName(p.region)||['super','technical'].includes(String(p.role))&&p.region!==null)throw new DomainError('STAFF_SCOPE','Choose a valid role and jurisdiction. Super and technical authority are world scoped.',400);
   if(!Number.isSafeInteger(p.grantUntil)||(p.grantUntil as number)<=now||(p.grantUntil as number)>now+ADMIN_RULES.maxGrant)throw new DomainError('STAFF_EXPIRY','Choose a future expiry within thirty days.',400);
   subject=p.targetActorId;role=p.role as StaffRole;region=p.region as string|null;grantUntil=p.grantUntil as number;
   const held=staffGrants(s,subject,now);if(held.some(g=>g.role===role&&g.region===region)||new Set([...held.map(g=>g.role),role]).size>2)throw new DomainError('STAFF_ROLE_LIMIT','Use distinct necessary permissions. A routine account can hold at most two staff roles.');
  }
  if(subject===actor&&p.action==='grant')throw new DomainError('STAFF_SELF_GRANT','Another authorised staff member must propose your grant.',403);
  const id='staff-'+digest(key).slice(0,24),proposal:Proposal={id,action:p.action as Proposal['action'],target:subject,role,region,grantId,grantVersion,grantUntil,maker:actor,reason:why,createdAt:now,expiresAt:now+ADMIN_RULES.proposalTTL,signature:'',approvals:[{actor,sessionId:context!.session!.sessionId,at:now,stepUpAt:context!.session!.stepUpAt!,reason:why}],status:'pending',version:1,settledBy:null};proposal.signature=digest(terms(proposal));m.proposals[id]=proposal;target=id;
 }else{
  const proposal=m.proposals[String(p.proposalId)];if(!proposal||!['pending','ready'].includes(proposal.status)||now>=proposal.expiresAt)throw new DomainError('STAFF_PROPOSAL_CLOSED','This staff proposal is unavailable, settled or expired.');
  if(p.proposalVersion!==proposal.version||p.signature!==proposal.signature)throw new DomainError('STAFF_TERMS_CHANGED','Review the exact current staff proposal.');
  target=proposal.id;why=proposal.reason;
  if(command.type==='DecideStaffChange'){
   why=reason(p.reason);
   if(typeof p.approve!=='boolean')throw new DomainError('STAFF_DECISION','Choose approve or reject.',400);
   if(proposal.approvals.some(a=>a.actor===actor))throw new DomainError('STAFF_INDEPENDENT_APPROVAL','A second distinct staff authority must review this change.');
   if(!p.approve)proposal.status='rejected';else{proposal.approvals.push({actor,sessionId:context!.session!.sessionId,at:now,stepUpAt:context!.session!.stepUpAt!,reason:why});proposal.status=validDecisions(s,proposal,now).length>=2?'ready':'pending';}proposal.version++;
  }else{
   if(proposal.status!=='ready'||new Set(validDecisions(s,proposal,now).map(a=>a.actor)).size<2)throw new DomainError('STAFF_APPROVALS','Two current independent staff approvals are required.');
   if(proposal.action==='revoke'){
    const grant=m.grants[proposal.grantId!];if(!grant||!active(grant,now)||grant.version!==proposal.grantVersion)throw new DomainError('STAFF_GRANT_CHANGED','The staff grant changed. Propose a fresh review.');
    if(grant.role==='super'&&new Set(Object.values(m.grants).filter(g=>active(g,now)&&g.role==='super'&&g.id!==grant.id).map(g=>g.actor)).size<2)throw new DomainError('STAFF_AUTHORITY_MINIMUM','Retain two independent staff-grant authorities before revoking this role.');
    grant.status='revoked';grant.version++;
   }else{
    const held=staffGrants(s,proposal.target,now);if(proposal.grantUntil!<=now||held.some(g=>g.role===proposal.role&&g.region===proposal.region)||new Set([...held.map(g=>g.role),proposal.role]).size>2)throw new DomainError('STAFF_GRANT_CHANGED','The proposed permissions or expiry changed. Propose a fresh review.');
    const id='grant-'+proposal.id;m.grants[id]={id,actor:proposal.target,role:proposal.role,region:proposal.region,expiresAt:proposal.grantUntil,status:'active',version:1,issuedBy:key,bootstrap:false};
   }
   proposal.status='applied';proposal.settledBy=key;proposal.version++;
  }
 }
 m.version++;audit(s,actor,command,now,key,context,before,target,why);return{adminVersion:m.version,proposalId:target,message:'Staff change recorded. Permissions change only after two independent approvals and application.'};
}
export function adminAccess(s:State,actor:string,session:StaffSession,now:number){const grants=staffGrants(s,actor,now);return{available:grants.length>0,stepUpRequired:!fresh(session,now),roles:grants.map(g=>({role:g.role,region:g.region,expiresAt:g.expiresAt}))};}
export function adminView(s:State,actor:string,session:StaffSession,now:number){
 assertStaff(s,actor,session,now);const own=staffGrants(s,actor,now),supervisor=own.some(g=>g.role==='super'),technical=own.some(g=>g.role==='technical'),economy=own.filter(g=>g.role==='economy'),m=s.administration!;
 const visibleRegions=economy.some(g=>g.region===null)?REGIONS.map(r=>r.name):economy.map(g=>g.region!);
 return{worldId:s.worldId,serverTime:now,adminVersion:m.version,stepUpUntil:session.stepUpAt!+ADMIN_RULES.stepUp,yourGrants:own,staffRoles:STAFF_ROLES,regions:REGIONS.map(r=>r.name),canManageStaff:supervisor,
  grants:supervisor?Object.values(m.grants):own,
  proposals:supervisor?Object.values(m.proposals).map(p=>({...p,expired:now>=p.expiresAt,validApprovals:validDecisions(s,p,now).length,canDecide:!p.approvals.some(a=>a.actor===actor)})):[],
  audit:m.audit.filter(a=>supervisor||a.actor===actor).slice(-100),
  availability:technical?{citizens:Object.keys(s.citizens).length,commands:Object.keys(s.commands).length,outbox:s.outbox.length,journals:s.journals.length,activeConnections:Object.values(s.sessions?.leases??{}).filter(l=>l.status==='active'&&l.expiresAt>now).length,lastEventAt:s.outbox.at(-1)?.at??null}:null,
  economy:visibleRegions.map(region=>({region,treasury:s.balances['treasury:state:'+region]??0,citizens:Object.values(s.citizens).filter(c=>c.state===region).length})),
  notice:'Staff roles are separate from elected offices. These controls cannot change money, ballots, qualifications or private messages.'};
}
export function reconcileAdministration(s:State){
 const m=s.administration;if(!m)return;if(!Number.isSafeInteger(m.version)||m.version<1||m.version!==m.audit.length||m.bootstrapActors.length!==2||new Set(m.bootstrapActors).size!==2||m.bootstrapActors.some(a=>!uuid.test(a)))throw Error('Invalid staff authority state');
 if(m.bootstrapActors.some((actor,i)=>m.grants['staff-root-'+(i+1)]?.actor!==actor||!m.grants['staff-root-'+(i+1)]?.bootstrap)||Object.values(m.grants).filter(g=>g.bootstrap).length!==2)throw Error('Invalid initial staff authority evidence');
 let previousHash='0'.repeat(64),previousMaterial=digest(null);
 for(const [i,entry] of m.audit.entries()){
  const {hash,...body}=entry,receipt=s.commands[entry.commandKey]?.receipt;
  if(entry.sequence!==i+1||entry.previousHash!==previousHash||entry.before!==previousMaterial||digest(body)!==hash||!receipt||receipt.type!==entry.action||receipt.actorId!==entry.actor||receipt.at!==entry.at||!isAdminCommand(entry.action)||entry.reason.trim().length<10||entry.reason.length>400||!Number.isSafeInteger(entry.at)||entry.at<0||i===0&&(entry.action!=='BootstrapStaff'||entry.sessionId!==null||entry.stepUpAt!==null||entry.role!=='out-of-band-bootstrap')||i>0&&(entry.role!=='super'||!/^[a-zA-Z0-9_-]{3,100}$/.test(entry.sessionId??'')||!fresh({sessionId:entry.sessionId??'',assurance:'aal2',stepUpAt:entry.stepUpAt??undefined},entry.at)))throw Error('Staff audit integrity mismatch');previousHash=hash;previousMaterial=entry.after;
 }
 if(previousMaterial!==digest(material(m)))throw Error('Staff authority lacks a matching audit');
 for(const [id,g] of Object.entries(m.grants)){
  if(id!==g.id||g.bootstrap&& !['staff-root-1','staff-root-2'].includes(id)||!g.bootstrap&&id!=='grant-'+Object.values(m.proposals).find(p=>p.settledBy===g.issuedBy)?.id)throw Error('Invalid staff grant identity');
  if(!uuid.test(g.actor)||!STAFF_ROLES.includes(g.role)||g.region!==null&&!regionByName(g.region)||['super','technical'].includes(g.role)&&g.region!==null||!Number.isSafeInteger(g.version)||g.version<1||!['active','revoked'].includes(g.status))throw Error('Invalid staff grant');
  if(g.bootstrap){if(g.role!=='super'||g.region!==null||g.expiresAt!==null||!m.bootstrapActors.includes(g.actor)||s.commands[g.issuedBy]?.receipt.type!=='BootstrapStaff')throw Error('Invalid initial staff authority');}
  else{const proposal=Object.values(m.proposals).find(p=>p.settledBy===g.issuedBy);if(!proposal||proposal.action!=='grant'||proposal.status!=='applied'||g.actor!==proposal.target||g.role!==proposal.role||g.region!==proposal.region||g.expiresAt!==proposal.grantUntil)throw Error('Staff grant lacks independent approval proof');}
  if(g.status==='revoked'&&!Object.values(m.proposals).some(p=>p.action==='revoke'&&p.status==='applied'&&p.grantId===g.id))throw Error('Staff revocation lacks approval proof');
 }
 for(const [id,p] of Object.entries(m.proposals)){
  if(id!==p.id||!['grant','revoke'].includes(p.action)||!uuid.test(p.target)||!uuid.test(p.maker)||!STAFF_ROLES.includes(p.role)||p.region!==null&&!regionByName(p.region)||['super','technical'].includes(p.role)&&p.region!==null||!Number.isSafeInteger(p.version)||p.version<1||!Number.isSafeInteger(p.createdAt)||p.createdAt<0||p.expiresAt!==p.createdAt+ADMIN_RULES.proposalTTL||p.reason.trim().length<10||p.reason.length>400||p.action==='grant'&&(!Number.isSafeInteger(p.grantUntil)||p.grantUntil!<=p.createdAt||p.grantUntil!>p.createdAt+ADMIN_RULES.maxGrant||p.grantId!==null||p.grantVersion!==null||p.target===p.maker)||p.action==='revoke'&&(!m.grants[p.grantId??'']||!Number.isSafeInteger(p.grantVersion)||p.grantVersion!<1||p.grantUntil!==null)||digest(terms(p))!==p.signature||new Set(p.approvals.map(a=>a.actor)).size!==p.approvals.length||p.approvals[0]?.actor!==p.maker||!['pending','ready','rejected','applied'].includes(p.status)||p.status==='applied'&&(!p.settledBy||s.commands[p.settledBy]?.receipt.type!=='ApplyStaffChange'||p.approvals.length<2))throw Error('Invalid staff proposal evidence');
  for(const a of p.approvals)if(!uuid.test(a.actor)||!Number.isSafeInteger(a.at)||a.at<p.createdAt||a.at>=p.expiresAt||!fresh({sessionId:a.sessionId,assurance:'aal2',stepUpAt:a.stepUpAt},a.at)||a.reason.trim().length<10||a.reason.length>400||!m.audit.some(e=>e.actor===a.actor&&e.sessionId===a.sessionId&&e.at===a.at&&e.stepUpAt===a.stepUpAt&&e.reason===a.reason&&e.target===p.id&&['ProposeStaffChange','DecideStaffChange'].includes(e.action)))throw Error('Invalid staff approval authentication evidence');
 }
}
