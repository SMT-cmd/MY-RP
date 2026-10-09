import type {State} from './domain.ts';
import {isAdminCommand} from './admin.ts';
import {appearanceRender,DEFAULT_APPEARANCE} from './appearance.ts';
import {assertClientLease,SESSION_RULES} from './sessions.ts';
import type {ClientFence} from './sessions.ts';
import {settleHomeVisits,authorisedInterior} from './home-visits.ts';
import {publicCitizenReceipt} from './public-receipts.ts';
import {relationshipRevision} from './relationships.ts';
import {homeUseRevision} from './furniture-use.ts';
export const PRESENCE_RULES={radius:12,maxVisible:32,protocol:1};
export function nearbyPresence(s:State,actor:string,sessionId:string,fence:ClientFence,now:number){
 assertClientLease(s,actor,sessionId,fence,now);s=structuredClone(s);settleHomeVisits(s,now);const here=s.world?.positions[actor],room=here?.interior==='shelter'?authorisedInterior(s,actor,now):null;
 const scope=here?{region:here.region,interior:here.interior,leaseVersion:here.leaseVersion,homeId:here.homeId??null}:null;
 const coords=(p:NonNullable<typeof here>)=>p.interior?{x:p.interiorX??4,y:p.interiorY??6}:{x:p.x,y:p.y};
 const distance=(p:NonNullable<typeof here>)=>{const a=coords(here!),b=coords(p);return Math.abs(a.x-b.x)+Math.abs(a.y-b.y);};
 const people=here&&(!here.interior||room)&&!s.world?.activeTrips[actor]?Object.values(s.citizens).filter(c=>{
  const pos=s.world?.positions[c.actorId],lease=s.sessions?.leases[c.actorId];
  return c.actorId!==actor&&lease?.status==='active'&&lease.expiresAt>now&&!s.sessions?.revoked[lease.sessionId]&&c.life?.privacy.location===true&&c.life.privacy.presence===true&&pos&&pos.region===here.region&&(room?pos.interior==='shelter'&&pos.homeId===room.id&&!!authorisedInterior(s,c.actorId,now):!pos.interior)&&!s.world?.activeTrips[c.actorId]&&!s.life?.blocks[actor]?.includes(c.actorId)&&!s.life?.blocks[c.actorId]?.includes(actor)&&distance(pos)<=PRESENCE_RULES.radius;
 }).sort((a,b)=>distance(s.world!.positions[a.actorId])-distance(s.world!.positions[b.actorId])||a.id.localeCompare(b.id)).slice(0,PRESENCE_RULES.maxVisible).map(c=>{const p=s.world!.positions[c.actorId];return{id:c.id,name:c.name,...coords(p),facing:p.facing??'front',avatar:appearanceRender(c.appearance??DEFAULT_APPEARANCE),...(room&&p.activity&&now>=p.activity.startedAt&&now-p.activity.startedAt<10000?{activity:{kind:p.activity.kind,fixtureId:p.activity.fixtureId,startedAt:p.activity.startedAt,...(p.activity.slot!==undefined?{slot:p.activity.slot}:{})}}:{})};}):[];
 return{protocol:PRESENCE_RULES.protocol,cursor:s.outbox.length,serverTime:now,scope,relationshipRevision:relationshipRevision(s,actor,now),homeUseRevision:room?homeUseRevision(s,room,now):null,people,limits:{visible:PRESENCE_RULES.maxVisible,connections:SESSION_RULES.maxActive}};
}
export function recoveryCursor(s:State,actor:string,after:unknown){
 const latest=s.outbox.length;let cursor=after===undefined?latest:Number(after);
 if(!Number.isSafeInteger(cursor)||cursor<0)throw new Error('Invalid recovery cursor');
 const reset=cursor>latest;if(reset)cursor=0;const end=Math.min(latest,cursor+256);
 return{cursor:end,latest,reset,hasMore:end<latest,receipts:s.outbox.slice(cursor,end).filter(e=>e.actorId===actor&&!isAdminCommand(e.type)).map(e=>s.commands[e.id]?.receipt).filter(Boolean).map(r=>publicCitizenReceipt(s,r!))};
}
