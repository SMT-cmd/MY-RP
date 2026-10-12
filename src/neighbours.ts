import {createHmac} from 'node:crypto';
import {DomainError} from './domain.ts';
import type {State,Command} from './domain.ts';
import {REGIONS,regionByName} from './geography.ts';
import {streetWalkable} from './neighbourhood.ts';
import {APPEARANCE,appearanceRender,DEFAULT_APPEARANCE} from './appearance.ts';

export const NEIGHBOUR_RULES={version:'neighbours-1',radius:12,range:2,cooldown:30000,step:1500,stop:90000,count:6};
export const NEIGHBOUR_TOPICS=['hello','services','work','travel'] as const;
type Topic=typeof NEIGHBOUR_TOPICS[number];
type Conversation={id:string;actor:string;npcId:string;region:string;topic:Topic;at:number;count:number;key:string;version:string};
export type NeighbourState={conversations:Record<string,Conversation>};
const routes=[
 {a:{x:4,y:8},b:{x:10,y:8},role:'Market assistant',from:'Food market',to:'Work desk'},
 {a:{x:17,y:7},b:{x:21,y:7},role:'Clinic receptionist',from:'Community clinic',to:'Centre lane'},
 {a:{x:24,y:7},b:{x:31,y:7},role:'Neighbourhood craftsperson',from:'Market Lane',to:'Market quarter'},
 {a:{x:20,y:21},b:{x:28,y:21},role:'Community gardener',from:'Centre lane',to:'Neighbourhood road'},
 {a:{x:42,y:21},b:{x:50,y:21},role:'Retired teacher',from:'Market lane',to:'Residential quarter'},
 {a:{x:44,y:35},b:{x:53,y:35},role:'Bus attendant',from:'Courtyard road',to:'Residential quarter'}
];
const names=['Amaka','Bola','Chidi','Hauwa','Ife','Kunle','Mariam','Nneka','Sani','Tomi','Yemi','Zara'];
const temperaments=['warm','practical','reflective'] as const;
const seed=(s:State,region:string,index:number)=>createHmac('sha256',s.life?.seed??s.worldId).update('neighbour:'+region+':'+index).digest();
const idFor=(region:string,index:number)=>'npc-'+regionByName(region)!.id+'-'+index;
export function neighbourAt(s:State,region:string,index:number,now:number){
 if(!regionByName(region)||!Number.isInteger(index)||index<0||index>=routes.length||!Number.isSafeInteger(now)||now<0)throw Error('Invalid neighbour schedule');
 const r=routes[index],bytes=seed(s,region,index),length=r.b.x-r.a.x,duration=length*NEIGHBOUR_RULES.step,cycle=2*(NEIGHBOUR_RULES.stop+duration),phase=(now%cycle+bytes.readUInt32BE(0)%cycle)%cycle;
 let x=r.a.x,facing='front',routine='At '+r.from;
 if(phase>=NEIGHBOUR_RULES.stop&&phase<NEIGHBOUR_RULES.stop+duration){x=r.a.x+Math.floor((phase-NEIGHBOUR_RULES.stop)/NEIGHBOUR_RULES.step);facing='right';routine='Walking to '+r.to;}
 else if(phase>=NEIGHBOUR_RULES.stop+duration&&phase<2*NEIGHBOUR_RULES.stop+duration){x=r.b.x;routine='At '+r.to;facing='left';}
 else if(phase>=2*NEIGHBOUR_RULES.stop+duration){x=r.b.x-Math.floor((phase-2*NEIGHBOUR_RULES.stop-duration)/NEIGHBOUR_RULES.step);facing='left';routine='Walking to '+r.from;}
 const profile={...DEFAULT_APPEARANCE,skin:APPEARANCE.skin[bytes[4]%APPEARANCE.skin.length].id,frame:APPEARANCE.frame[bytes[5]%3].id,hair:APPEARANCE.hair[bytes[6]%5].id,hairColour:APPEARANCE.hairColour[bytes[7]%3].id,outfit:APPEARANCE.outfit[bytes[8]%4].id,top:APPEARANCE.top[bytes[9]%6].id,bottom:APPEARANCE.bottom[bytes[10]%4].id};
 return{id:idFor(region,index),name:names[bytes[11]%names.length],kind:'npc' as const,role:r.role,temperament:temperaments[bytes[12]%3],x,y:r.a.y,facing,routine,avatar:appearanceRender(profile)};
}
export function nearbyNeighbours(s:State,actor:string,now:number){
 const p=s.world?.positions[actor];if(!p||p.interior||s.world?.activeTrips[actor])return [];
 return routes.map((_,i)=>neighbourAt(s,p.region,i,now)).filter(n=>Math.abs(n.x-p.x)+Math.abs(n.y-p.y)<=NEIGHBOUR_RULES.radius).map(n=>({...n,canTalk:Math.abs(n.x-p.x)+Math.abs(n.y-p.y)<=NEIGHBOUR_RULES.range,topics:NEIGHBOUR_TOPICS}));
}
function reply(n:ReturnType<typeof neighbourAt>,topic:Topic,repeated:boolean){
 if(topic==='hello')return (repeated?'Good to see you again. ':n.temperament==='warm'?'Welcome, neighbour! ':n.temperament==='practical'?'Hello. How is your day going? ':'Hello. It is good to take a little time to meet the neighbours. ')+`I am ${n.name}, a ${n.role.toLowerCase()}.`;
 if(topic==='services')return 'The school, clinic, food market, work desk and bus terminal are beside Welcome road. Use Places and neighbourhoods to walk to a marked entrance. Your home has its own door.';
 if(topic==='work')return 'The work desk has paid starter tasks. Read each task, finish its checks and collect the recorded wage. School stays available alongside work. A job title never transfers company ownership.';
 return 'Book state travel inside the bus terminal. Review the fare before reserving it, then finish the journey. A vehicle journey also needs permission, a current driving licence and fuel.';
}
export function neighbourCommand(s:State,actor:string,c:Command,now:number,key:string):Record<string,unknown>|undefined{
 if(c.type!=='TalkToNeighbour')return;
 if(!s.citizens[actor])throw new DomainError('CITIZEN_REQUIRED','Create your citizen first.');
 const p=s.world!.positions[actor];if(c.payload.leaseVersion!==p.leaseVersion)throw new DomainError('STALE_LEASE','Your location changed. Refresh before talking.');
 if(p.interior||s.world!.activeTrips[actor])throw new DomainError('CITY_REQUIRED','Return to the neighbourhood before talking to a neighbour.');
 const i=routes.findIndex((_,i)=>idFor(p.region,i)===c.payload.npcId);if(i<0)throw new DomainError('NEIGHBOUR_NOT_FOUND','Choose a neighbour in your current city.',404);
 if(!NEIGHBOUR_TOPICS.includes(c.payload.topic as Topic))throw new DomainError('NEIGHBOUR_TOPIC','Choose a listed conversation topic.',400);
 const n=neighbourAt(s,p.region,i,now);if(Math.abs(n.x-p.x)+Math.abs(n.y-p.y)>NEIGHBOUR_RULES.range)throw new DomainError('TOO_FAR','Walk beside the neighbour. They may have moved since your last update.');
 const m=s.neighbours??={conversations:{}},id=actor+':'+n.id,old=m.conversations[id];
 if(old&&now-old.at<NEIGHBOUR_RULES.cooldown)throw new DomainError('NEIGHBOUR_COOLDOWN','Give the neighbour a moment before starting another conversation.');
 const topic=c.payload.topic as Topic,count=(old?.count??0)+1;
 m.conversations[id]={id,actor,npcId:n.id,region:p.region,topic,at:now,count,key,version:NEIGHBOUR_RULES.version};
 return{npcId:n.id,region:p.region,topic,conversationCount:count,npcName:n.name,message:reply(n,topic,!!old)};
}
export function neighbourHistory(s:State,actor:string){return Object.values(s.neighbours?.conversations??{}).filter(r=>r.actor===actor).sort((a,b)=>b.at-a.at||a.id.localeCompare(b.id)).slice(0,6).map(r=>({npcId:r.npcId,region:r.region,topic:r.topic,at:r.at,count:r.count}));}
export function reconcileNeighbours(s:State){
 const records=s.neighbours?.conversations??{},expected=new Map<string,{count:number;last:string;at:number}>();
 for(const [key,stored] of Object.entries(s.commands).sort((a,b)=>a[1].receipt.at-b[1].receipt.at||a[0].localeCompare(b[0])))if(stored.receipt.type==='TalkToNeighbour'){
  const r=stored.receipt,d=r.detail,id=r.actorId+':'+d.npcId,old=expected.get(id);if(!NEIGHBOUR_TOPICS.includes(d.topic as Topic)||!REGIONS.some(region=>routes.some((_,i)=>idFor(region.name,i)===d.npcId)&&region.name===d.region)||!s.citizens[r.actorId]||!Number.isSafeInteger(d.conversationCount)||(d.conversationCount as number)!==(old?.count??0)+1)throw Error('Invalid neighbour conversation receipt');
  if(old&&r.at-old.at<NEIGHBOUR_RULES.cooldown)throw Error('Neighbour conversation cooldown evidence mismatch');
  expected.set(id,{count:d.conversationCount as number,last:key,at:r.at});
 }
 if(Object.keys(records).length!==expected.size)throw Error('Neighbour conversation count mismatch');
 for(const [id,r] of Object.entries(records)){
  const proof=expected.get(id),receipt=s.commands[r.key]?.receipt,d=receipt?.detail;
  if(Object.keys(r).sort().join(',')!=='actor,at,count,id,key,npcId,region,topic,version'||id!==r.id||id!==r.actor+':'+r.npcId||r.version!==NEIGHBOUR_RULES.version||proof?.count!==r.count||proof.last!==r.key||receipt?.type!=='TalkToNeighbour'||receipt.actorId!==r.actor||receipt.at!==r.at||d?.npcId!==r.npcId||d.region!==r.region||d.topic!==r.topic)throw Error('Invalid neighbour conversation evidence');
 }
}
export function validateNeighbourRoutes(){for(const r of routes)for(let x=r.a.x;x<=r.b.x;x++)if(!streetWalkable(x,r.a.y))throw Error('Neighbour route crosses a blocked tile');}
validateNeighbourRoutes();
