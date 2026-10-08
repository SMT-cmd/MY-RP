import {changeResidence} from './furnishing.ts';
import { randomBytes,createHmac } from 'node:crypto';
import { DomainError,DAY,post } from './domain.ts';
import type { State,Command,Citizen } from './domain.ts';
import type { WorkState } from './jobs.ts';

export type Band='struggling'|'working-class'|'middle-class'|'upper-middle-class'|'wealthy';
export type LifeCitizen={ phone:string; needs:{ hunger:number; energy:number; health:number }; lastActiveAt:number; householdId:string|null; path:'independent'|'random-family'; skills:Record<string,number>; privacy:{dm:boolean;location:boolean;presence:boolean;relationships?:boolean}; lastRestAt:number|null };
type Household={id:string;kind:'npc'|'player';state:string;name:string;band:Band|null;members:Record<string,'owner'|'member'>;adults:{name:string;occupation:string;personality:string}[];lastPeriod:number;lastAllowance:Record<string,number>;version:number;active:boolean;terms:string};
type Invite={id:string;householdId:string;sender:string;recipient:string;expiresAt:number;status:'pending'|'accepted'|'declined'};
export type LifeState={seed:string;households:Record<string,Household>;invitations:Record<string,Invite>;blocks:Record<string,string[]>;care:Record<string,number>;work?:WorkState};
export const initialLife=():LifeState=>({seed:randomBytes(32).toString('hex'),households:{},invitations:{},blocks:{},care:{}});
const getLife=(state:State)=>state.life??=initialLife();
const hash=(life:LifeState,key:string)=>createHmac('sha256',life.seed).update(key).digest('hex');
const bands:{band:Band;threshold:number;allowance:number;capital:number;dailyIncome:number}[]=[
  {band:'struggling',threshold:20,allowance:100000,capital:500000,dailyIncome:20000},
  {band:'working-class',threshold:55,allowance:200000,capital:1500000,dailyIncome:50000},
  {band:'middle-class',threshold:85,allowance:500000,capital:5000000,dailyIncome:100000},
  {band:'upper-middle-class',threshold:97,allowance:1000000,capital:15000000,dailyIncome:200000},
  {band:'wealthy',threshold:100,allowance:2000000,capital:50000000,dailyIncome:400000}
];
export const householdTerms='Contributions are voluntary gifts to the shared household account. The owner may spend shared funds. Leaving preserves your personal money and provides starter shelter; it does not refund a gift.';
export function familyBand(seed:string,actor:string):Band {
  const score=parseInt(createHmac('sha256',seed).update(actor).digest('hex').slice(0,8),16)%100;
  return bands.find(b=>score<b.threshold)!.band;
}
export function provisionLife(state:State,citizen:Citizen,path:unknown,now:number,key:string){
  if(path!==undefined&&!['independent','random-family'].includes(path as string))throw new DomainError('INVALID_START','Choose Independent or Random Family start.',400);
  const life=getLife(state);
  citizen.life={phone:'SIM-'+hash(life,citizen.actorId).slice(0,10).toUpperCase(),needs:{hunger:90,energy:90,health:100},lastActiveAt:now,householdId:null,path:path==='random-family'?'random-family':'independent',skills:{},privacy:{dm:false,location:false,presence:false},lastRestAt:null};
  if(path!=='random-family')return 2000000;
  const band=familyBand(life.seed,citizen.actorId),rules=bands.find(b=>b.band===band)!,id='household_'+hash(life,citizen.actorId).slice(0,20);
  const names=['Ada','Bola','Chidi','Amina','Tunde','Zainab','Emeka','Sade'],pick=parseInt(hash(life,id).slice(0,2),16)%names.length;
  life.households[id]={id,kind:'npc',state:citizen.state,name:names[pick]+' household',band,members:{[citizen.actorId]:'member'},adults:[{name:names[pick],occupation:'NPC household provider',personality:'Practical and supportive'},{name:names[(pick+3)%names.length],occupation:'NPC service worker',personality:'Patient and sociable'}],lastPeriod:Math.floor(now/DAY),lastAllowance:{},version:1,active:true,terms:'Support is budgeted. Requests are voluntary; family members cannot debit your personal account.'};
  citizen.life.householdId=id;citizen.housing='NPC family accommodation';
  post(state,key+':family',now,'NPC household initial capital',[{account:'system:npc-household-issuance',amount:-rules.capital},{account:'household:'+id,amount:rules.capital}]);
  return rules.allowance;
}
export function citizenLife(state:State,citizen:Citizen,now:number):LifeCitizen{
  if(!citizen.life)citizen.life={phone:'SIM-'+citizen.id,needs:{hunger:90,energy:90,health:100},lastActiveAt:now,householdId:null,path:'independent',skills:{},privacy:{dm:false,location:false,presence:false},lastRestAt:null};
  return citizen.life;
}
export function activeNeeds(citizen:Citizen,now:number){
  const life=citizenLife({} as State,citizen,now),elapsed=Math.min(Math.max(0,now-life.lastActiveAt),60*60*1000)/60000;
  life.needs.hunger=Math.max(20,life.needs.hunger-Math.floor(elapsed/5));life.needs.energy=Math.max(20,life.needs.energy-Math.floor(elapsed/10));life.needs.health=Math.max(60,life.needs.health);life.lastActiveAt=now;
}
const person=(state:State,actor:string)=>{const c=state.citizens[actor];if(!c)throw new DomainError('CITIZEN_REQUIRED','Create your citizen first.');return c;};
const household=(state:State,actor:string,now:number)=>{const c=person(state,actor),id=citizenLife(state,c,now).householdId,h=id?getLife(state).households[id]:null;if(!h?.active||!h.members[actor])throw new DomainError('HOUSEHOLD_REQUIRED','Join a household first.');return h;};
const amount=(value:unknown)=>{if(!Number.isSafeInteger(value)||(value as number)<=0)throw new DomainError('INVALID_AMOUNT','Use a positive whole amount in minor units.',400);return value as number;};
export function lifeCommand(state:State,actor:string,command:Command,now:number,key:string):Record<string,unknown>|undefined{
  const handled=['Rest','RequestBasicCare','SetPrivacy','CreateHousehold','InviteHousehold','AcceptHousehold','DeclineHousehold','LeaveHousehold','ContributeHousehold','WithdrawHousehold','ReviewFamilyPeriod','RequestFamilyAllowance','BlockCitizen','UnblockCitizen'];
  if(!handled.includes(command.type))return;
  const c=person(state,actor),life=getLife(state),profile=citizenLife(state,c,now);activeNeeds(c,now);const p=command.payload;
  if(command.type==='Rest'){
    if(profile.lastRestAt!==null&&now-profile.lastRestAt<60000)throw new DomainError('REST_COOLDOWN','Your next rest is available in a minute.');profile.needs.energy=Math.min(100,profile.needs.energy+30);profile.lastRestAt=now;return{message:'You rested safely.',needs:profile.needs};
  }
  if(command.type==='RequestBasicCare'){
    const day=actor+':'+Math.floor(now/DAY),used=life.care[day]??0;if(used>=4)throw new DomainError('CARE_LIMIT','Basic treatment is already recorded for today.');
    const fee=(state.balances['citizen:'+actor]??0)>=2500&&now>=c.protectionEndsAt?2500:0;if(fee)post(state,key,now,'NPC basic care',[{account:'citizen:'+actor,amount:-fee},{account:'system:health-provider',amount:fee}]);profile.needs.health=100;life.care[day]=used+1;return{fee,message:fee?'Basic treatment recorded.':'Protective basic treatment recorded.'};
  }
  if(command.type==='SetPrivacy'){
    for(const field of ['dm','location','presence','relationships'] as const)if(p[field]!==undefined){if(typeof p[field]!=='boolean')throw new DomainError('INVALID_PRIVACY','Choose explicit privacy settings.',400);profile.privacy[field]=p[field] as boolean;}return{message:'Privacy preferences saved.',privacy:profile.privacy};
  }
  if(command.type==='BlockCitizen'||command.type==='UnblockCitizen'){
    const target=Object.values(state.citizens).find(x=>x.id===p.citizenId);if(!target||target.actorId===actor)throw new DomainError('INVALID_TARGET','Choose another citizen.',400);
    const blocked=life.blocks[actor]??=[];if(command.type==='BlockCitizen'){if(!blocked.includes(target.actorId))blocked.push(target.actorId);for(const mentoring of Object.values(state.education?.mentorships??{}))if([mentoring.student,mentoring.mentor].includes(actor)&&[mentoring.student,mentoring.mentor].includes(target.actorId)){mentoring.status='ended';mentoring.version++;for(const session of Object.values(state.education?.practiceSessions??{}))if(session.mentorship===mentoring.id&&session.status==='offered'){session.status='cancelled';session.version++;}}}else life.blocks[actor]=blocked.filter(x=>x!==target.actorId);return{citizenId:target.id,message:command.type==='BlockCitizen'?'Citizen blocked.':'Citizen unblocked.'};
  }
  if(command.type==='CreateHousehold'){
    if(profile.householdId)throw new DomainError('ALREADY_IN_HOUSEHOLD','Leave your current household first.');if(p.consent!==true)throw new DomainError('CONSENT_REQUIRED','Review the shared-funds terms first.');
    const name=typeof p.name==='string'?p.name.trim():'';if(name.length<2||name.length>50)throw new DomainError('INVALID_NAME','Use a household name of 2 to 50 characters.',400);
    const id='household_'+hash(life,key).slice(0,20);life.households[id]={id,kind:'player',state:c.state,name,band:null,members:{[actor]:'owner'},adults:[],lastPeriod:Math.floor(now/DAY),lastAllowance:{},version:1,active:true,terms:householdTerms};profile.householdId=id;return{householdId:id,message:'Your household is ready.'};
  }
  if(command.type==='InviteHousehold'){
    const h=household(state,actor,now);if(h.kind!=='player'||h.members[actor]!=='owner')throw new DomainError('ROLE_REQUIRED','Only the household owner can invite members.',403);
    const target=Object.values(state.citizens).find(x=>x.id===p.citizenId);if(!target||target.actorId===actor)throw new DomainError('INVALID_TARGET','Choose another citizen.',400);
    if(life.blocks[actor]?.includes(target.actorId)||life.blocks[target.actorId]?.includes(actor))throw new DomainError('CONTACT_BLOCKED','This invitation cannot be sent.',403);
    if(Object.keys(h.members).length>=10)throw new DomainError('HOUSEHOLD_FULL','The household is at capacity.');const id='invite_'+hash(life,key).slice(0,20);life.invitations[id]={id,householdId:h.id,sender:actor,recipient:target.actorId,expiresAt:now+7*DAY,status:'pending'};return{invitationId:id,message:'Household invitation sent.'};
  }
  if(command.type==='AcceptHousehold'||command.type==='DeclineHousehold'){
    const invitation=life.invitations[String(p.invitationId)];if(!invitation||invitation.recipient!==actor)throw new DomainError('INVITATION_NOT_FOUND','This invitation is unavailable.',404);
    if(invitation.status!=='pending'||invitation.expiresAt<=now)throw new DomainError('INVITATION_CLOSED','This invitation has closed.');
    if(command.type==='DeclineHousehold'){invitation.status='declined';return{message:'Invitation declined.'};}
    if(p.consent!==true)throw new DomainError('CONSENT_REQUIRED','Review and accept the household terms.');if(profile.householdId)throw new DomainError('ALREADY_IN_HOUSEHOLD','Leave your current household before joining.');
    const h=life.households[invitation.householdId];if(!h.active||Object.keys(h.members).length>=10)throw new DomainError('HOUSEHOLD_FULL','This household cannot accept a new member.');
    if(life.blocks[actor]?.includes(invitation.sender)||life.blocks[invitation.sender]?.includes(actor))throw new DomainError('CONTACT_BLOCKED','This invitation cannot be accepted.',403);
    h.members[actor]='member';h.version++;profile.householdId=h.id;changeResidence(state,actor,'Shared household accommodation');invitation.status='accepted';return{householdId:h.id,message:'Household joined. Your personal funds remain yours.'};
  }
  const h=household(state,actor,now);
  if(command.type==='LeaveHousehold'){
    delete h.members[actor];const remaining=Object.keys(h.members);if(!remaining.length){h.active=false;const balance=state.balances['household:'+h.id]??0;if(h.kind==='player'&&balance)post(state,key,now,'Final household closure',[{account:'household:'+h.id,amount:-balance},{account:'citizen:'+actor,amount:balance}]);}
    else if(!Object.values(h.members).includes('owner')&&h.kind==='player')h.members[remaining.sort()[0]]='owner';h.version++;profile.householdId=null;changeResidence(state,actor,'Starter accommodation');return{message:'You left the household. Starter shelter is available.'};
  }
  if(command.type==='ContributeHousehold'||command.type==='WithdrawHousehold'){
    const value=amount(p.amount);if(h.kind!=='player')throw new DomainError('HOUSEHOLD_KIND','NPC support is managed through its published programme.');if(p.consent!==true)throw new DomainError('CONSENT_REQUIRED','Confirm the shared-funds terms first.');
    if(command.type==='WithdrawHousehold'&&h.members[actor]!=='owner')throw new DomainError('ROLE_REQUIRED','Only the household owner can spend shared funds.',403);
    const contribution=command.type==='ContributeHousehold';post(state,key,now,contribution?'Voluntary household contribution':'Authorised household withdrawal',[{account:contribution?'citizen:'+actor:'household:'+h.id,amount:-value},{account:contribution?'household:'+h.id:'citizen:'+actor,amount:value}]);h.version++;return{amount:value,message:contribution?'Contribution recorded.':'Shared withdrawal recorded.'};
  }
  if(h.kind!=='npc')throw new DomainError('HOUSEHOLD_KIND','This action is for an NPC family.');
  const rules=bands.find(x=>x.band===h.band)!;
  if(command.type==='ReviewFamilyPeriod'){
    const period=Math.floor(now/DAY);if(period<=h.lastPeriod)throw new DomainError('PERIOD_SETTLED','This household period is already recorded.');const old=state.balances['household:'+h.id]??0;
    const income=rules.dailyIncome,expenses=Math.floor(income*.75),event=parseInt(hash(life,h.id+':'+period).slice(0,4),16)%4,loss=event===0?Math.min(Math.floor(old*.1),income):0;
    post(state,key+':income',now,'Budgeted NPC household income',[{account:'system:npc-household-income',amount:-income},{account:'household:'+h.id,amount:income}]);
    post(state,key+':expense',now,'NPC household expenses and bounded event',[{account:'household:'+h.id,amount:-(expenses+loss)},{account:'system:household-expenses',amount:expenses+loss}]);h.lastPeriod=period;h.version++;return{income,expenses,loss,event:['Temporary income setback','Stable work','Education support planning','Business opportunity'][event],message:'A bounded household period was recorded; your personal funds were unchanged.'};
  }
  const period=Math.floor(now/DAY);if(h.lastAllowance[actor]===period)throw new DomainError('ALLOWANCE_SETTLED','Today’s family allowance is already recorded.');const support=Math.floor(rules.dailyIncome*.2);post(state,key,now,'Budgeted NPC family allowance',[{account:'household:'+h.id,amount:-support},{account:'citizen:'+actor,amount:support}]);h.lastAllowance[actor]=period;h.version++;return{amount:support,message:'Family allowance recorded.'};
}
export function lifeView(state:State,citizen:Citizen|null,actor:string,now:number){
  if(!citizen)return null;const lastActive=citizen.life?.lastActiveAt??now,copy=structuredClone(citizen);activeNeeds(copy,now);const profile=copy.life!,life=state.life,h=profile.householdId?life?.households[profile.householdId]:null;
  return{...profile,offlineSummary:now-lastActive>60*60*1000?'Needs are bounded while you are away.':null,household:h?{id:h.id,name:h.name,kind:h.kind,band:h.band,adults:h.adults,terms:h.terms,role:h.members[actor],members:Object.keys(h.members).map(a=>({citizenId:state.citizens[a]?.id,name:state.citizens[a]?.name,role:h.members[a]})),balance:state.balances['household:'+h.id]??0}:null,invitations:Object.values(life?.invitations??{}).filter(i=>i.recipient===actor&&i.status==='pending'&&i.expiresAt>now).map(i=>({id:i.id,householdId:i.householdId,name:life?.households[i.householdId]?.name,terms:life?.households[i.householdId]?.terms,expiresAt:i.expiresAt}))};
}
