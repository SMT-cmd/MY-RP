import {DomainError} from './domain.ts';
import type {State} from './domain.ts';
import type {AdminContext} from './admin.ts';

export const SESSION_RULES={version:'connection-1.0',ttl:60000,heartbeat:20000,maxActive:64};
export type ClientFence={clientId:string;epoch:number};
export type DispatchContext={clientLease?:ClientFence;requireConnection?:boolean;administration?:AdminContext};
export type ClientLease=ClientFence&{actor:string;sessionId:string;claimId:string;lastSeenAt:number;expiresAt:number;status:'active'|'released'};
export type SessionsState={leases:Record<string,ClientLease>;revoked:Record<string,{actor:string;at:number}>};
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export function validateClientId(clientId:unknown):string{
 if(typeof clientId!=='string'||!uuid.test(clientId))throw new DomainError('INVALID_CLIENT','Use a valid tab identifier.',400);return clientId;
}
function identity(actor:string,sessionId:string){if(!/^[a-zA-Z0-9_-]{3,80}$/.test(actor)||['constructor','prototype','__proto__'].includes(actor)||!/^[a-zA-Z0-9_-]{3,100}$/.test(sessionId))throw new DomainError('AUTH_REQUIRED','Sign in to continue.',401);}
export function assertClientLease(s:State,actor:string,sessionId:string|undefined,fence:unknown,now:number){
 const lease=s.sessions?.leases[actor],candidate=fence as ClientFence|undefined;
 if(sessionId&&s.sessions?.revoked[sessionId])throw new DomainError('SESSION_REVOKED','Sign in again to continue.',401);
 if(!lease||lease.status!=='active'||lease.expiresAt<=now||lease.sessionId!==sessionId||!candidate||candidate.clientId!==lease.clientId||!Number.isSafeInteger(candidate.epoch)||candidate.epoch!==lease.epoch)throw new DomainError('CLIENT_LEASE_REQUIRED','Reconnect this tab before issuing a new action. Another tab may have control.',409);
 return lease;
}
export function claimClient(s:State,actor:string,sessionId:string,clientId:unknown,takeover:unknown,now:number){
 identity(actor,sessionId);const request=clientId&&typeof clientId==='object'?clientId as {id?:unknown;claimId?:unknown}:null,id=validateClientId(request?request.id:clientId),claimId=validateClientId(request?request.claimId:clientId);if(takeover!==undefined&&typeof takeover!=='boolean')throw new DomainError('INVALID_CLIENT','Choose an explicit takeover preference.',400);
 if(s.sessions?.revoked[sessionId])throw new DomainError('SESSION_REVOKED','Sign in again to continue.',401);
 s.sessions??={leases:{},revoked:{}};const previous=s.sessions.leases[actor],active=previous?.status==='active'&&previous.expiresAt>now,sameTab=active&&previous.clientId===id&&previous.sessionId===sessionId,owned=sameTab&&previous.claimId===claimId;
 if(active&&!sameTab&&takeover!==true)throw new DomainError('CLIENT_IN_USE','Another tab is controlling this citizen. Use the takeover control to switch to this tab.',409);
 if(!active&&Object.values(s.sessions.leases).filter(l=>l.status==='active'&&l.expiresAt>now).length>=SESSION_RULES.maxActive)throw new DomainError('WORLD_AT_CAPACITY','The world has reached its current connection limit. Try again shortly.',503);
 const epoch=owned?previous.epoch:(previous?.epoch??0)+1;if(!Number.isSafeInteger(epoch))throw new DomainError('CLIENT_VERSION_LIMIT','This citizen connection cannot be versioned again.');
 const lease:ClientLease={actor,sessionId,claimId,clientId:id,epoch,lastSeenAt:now,expiresAt:now+SESSION_RULES.ttl,status:'active'};s.sessions.leases[actor]=lease;
 return{clientLease:{clientId:id,epoch},expiresAt:lease.expiresAt,heartbeat:SESSION_RULES.heartbeat};
}
export function renewClient(s:State,actor:string,sessionId:string,fence:unknown,now:number){const lease=assertClientLease(s,actor,sessionId,fence,now);lease.lastSeenAt=now;lease.expiresAt=now+SESSION_RULES.ttl;return{clientLease:{clientId:lease.clientId,epoch:lease.epoch},expiresAt:lease.expiresAt};}
export function releaseClient(s:State,actor:string,sessionId:string,fence:unknown,now:number){const lease=assertClientLease(s,actor,sessionId,fence,now);lease.status='released';lease.lastSeenAt=now;lease.expiresAt=now;return{released:true};}
export function revokeClient(s:State,actor:string,sessionId:string,now:number){s.sessions??={leases:{},revoked:{}};s.sessions.revoked[sessionId]={actor,at:now};const lease=s.sessions.leases[actor];if(lease?.sessionId===sessionId){lease.status='released';lease.lastSeenAt=now;lease.expiresAt=now;}}
export function reconcileSessions(s:State){
 const m=s.sessions;if(!m)return;for(const [actor,l] of Object.entries(m.leases)){
  if(actor!==l.actor)throw new Error('Client lease actor mismatch');identity(actor,l.sessionId);validateClientId(l.clientId);validateClientId(l.claimId);
  if(!Number.isSafeInteger(l.epoch)||l.epoch<1||!Number.isSafeInteger(l.lastSeenAt)||l.lastSeenAt<0||!Number.isSafeInteger(l.expiresAt)||!['active','released'].includes(l.status)||l.expiresAt<l.lastSeenAt||l.expiresAt-l.lastSeenAt>SESSION_RULES.ttl||l.status==='released'&&l.expiresAt!==l.lastSeenAt||m.revoked[l.sessionId]&&l.status==='active')throw new Error('Invalid client lease');
 }
 for(const [sid,r] of Object.entries(m.revoked)){identity(r.actor,sid);if(!Number.isSafeInteger(r.at)||r.at<0)throw new Error('Invalid revoked session');}
}
