import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {WebSocket} from 'ws';
import {createApp} from '../src/http.ts';
import {WorldStore} from '../src/store.ts';
import {DomainError} from '../src/domain.ts';
import type {ClientFence} from '../src/sessions.ts';
type Frame={type:string;sequence:number;leaseEpoch:number;cursor:number;people:{name:string;id:string}[]};
async function fixture(t:{after:(fn:()=>Promise<void>)=>void}){
 let now=10000;const store=await WorldStore.open(null,{requireConnection:true}),sockets:WebSocket[]=[];
 const server=createApp({store,multiplayer:true,clock:()=>now,authenticate:async req=>{
  const actor=String(req.headers['x-development-key']??'');if(!['viewer-one','peer-one'].includes(actor))throw new DomainError('AUTH_REQUIRED','Sign in.',401);return{actorId:actor,sessionId:actor+'-session',assurance:'aal1'};
 }});
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(async()=>{sockets.forEach(s=>s.terminate());await new Promise<void>(resolve=>server.close(()=>resolve()));});
 const addr=server.address();if(!addr||typeof addr==='string')throw Error();const origin='http://127.0.0.1:'+addr.port;
 const request=async(actor:string,path:string,body?:unknown,headers={})=>fetch(origin+path,{method:body===undefined?'GET':'POST',headers:{'x-development-key':actor,'Content-Type':'application/json',...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});
 const connect=async(actor:string,takeover=false)=>{const response=await request(actor,'/api/connect',{clientId:{id:randomUUID(),claimId:randomUUID()},takeover});assert.equal(response.status,200);return (await response.json()).clientLease as ClientFence;};
 function socket(path='/api/live',socketOrigin=origin){
  const ws=new WebSocket(origin.replace('http:','ws:')+path,{origin:socketOrigin});sockets.push(ws);const frames:Frame[]=[],waiters:{predicate:(f:Frame)=>boolean;resolve:(f:Frame)=>void;timer:ReturnType<typeof setTimeout>}[]=[];
  const closed=new Promise<{code:number;reason:string}>(resolve=>ws.once('close',(code,reason)=>resolve({code,reason:String(reason)})));ws.on('error',()=>{});
  ws.on('message',data=>{const frame=JSON.parse(String(data));frames.push(frame);for(const waiter of [...waiters])if(waiter.predicate(frame)){clearTimeout(waiter.timer);waiters.splice(waiters.indexOf(waiter),1);waiter.resolve(frame);}});
  const next=(predicate:(f:Frame)=>boolean)=>{const previous=frames.find(predicate);if(previous)return Promise.resolve(previous);return new Promise<Frame>((resolve,reject)=>{const waiter={predicate,resolve,timer:setTimeout(()=>reject(Error('Missing live frame')),4000)};waiters.push(waiter);});};
  const hello=async(actor:string,fence:ClientFence)=>{if(ws.readyState===WebSocket.CONNECTING)await new Promise<void>((resolve,reject)=>{ws.once('open',resolve);ws.once('error',reject);});ws.send(JSON.stringify({type:'hello',developmentKey:actor,clientLease:fence}));return next(f=>f.type==='snapshot');};
  return{ws,frames,next,closed,hello};
 }
 return{store,request,connect,socket,advance:(ms:number)=>now+=ms};
}

test('live snapshots use authenticated first-frame credentials, privacy, monotonic sequencing and fenced takeover with recoverable receipts',async t=>{
 const f=await fixture(t),viewer=await f.connect('viewer-one'),peer=await f.connect('peer-one');
 const html=await f.request('viewer-one','/');assert.match(html.headers.get('content-security-policy')!,/connect-src 'self' ws:\/\/127\.0\.0\.1:\d+;/);
 const command=(actor:string,fence:ClientFence,id:string,type:string,payload={})=>f.request(actor,'/api/commands',{id,type,payload,clientLease:fence});
 for(const [actor,fence,name] of [['viewer-one',viewer,'Ada'],['peer-one',peer,'Bola']] as const)assert.equal((await command(actor,fence,'create_live_'+actor,'CreateCitizen',{name,state:'Lagos',adultConfirmed:true})).status,200);
 const live=f.socket(),initial=await live.hello('viewer-one',viewer);assert.deepEqual(initial.people,[]);assert.equal(initial.sequence,1);
 const visible=await command('peer-one',peer,'privacy_live_001','SetPrivacy',{dm:false,location:true,presence:true});assert.equal(visible.status,200);
 const frame=await live.next(frame=>frame.people?.some(p=>p.name==='Bola'));assert.equal(frame.sequence,2);assert.equal(frame.people[0].id,f.store.snapshot().citizens['peer-one'].id);
 assert.ok(!JSON.stringify(frame).includes('peer-one-session'));assert.ok(!JSON.stringify(frame).includes('balance'));
 live.ws.send(JSON.stringify({type:'heartbeat'}));const beat=await live.next(frame=>frame.type==='heartbeat');assert.equal(beat.sequence,3);
 const meal={id:'live_meal_001',type:'BuyBasicMeal',payload:{},clientLease:viewer};const paid=await (await f.request('viewer-one','/api/commands',meal)).json();
 assert.equal((await f.request('viewer-one','/api/connect',{clientId:{id:randomUUID(),claimId:randomUUID()},takeover:false})).status,409);
 const newer=await f.connect('viewer-one',true);const closed=await live.closed;assert.equal(closed.code,4409);
 const stale=await f.request('viewer-one','/api/commands',{...meal,id:'live_stale_001'});assert.equal(stale.status,409);assert.equal((await stale.json()).error,'CLIENT_LEASE_REQUIRED');
 const replay=await (await f.request('viewer-one','/api/commands',meal)).json();assert.equal(replay.replayed,true);assert.deepEqual(replay.receipt,paid.receipt);
 const resumed=f.socket(),fresh=await resumed.hello('viewer-one',newer);assert.equal(fresh.sequence,1);assert.equal(fresh.cursor,f.store.snapshot().outbox.length);assert.equal(fresh.people.length,1);
 const recovered=await (await f.request('viewer-one','/api/recovery?after=0')).json();assert.equal(recovered.receipts.length,2);assert.ok(recovered.receipts.every((r:{actorId:string})=>r.actorId==='viewer-one'));
 assert.equal((await f.request('viewer-one','/api/recovery?after=-1')).status,400);
 await f.store.revokeSession('viewer-one','viewer-one-session');assert.equal((await resumed.closed).code,4401);
 assert.equal((await f.request('viewer-one','/api/citizen')).status,401);assert.equal((await f.request('viewer-one','/api/commands',meal)).status,401);
});

test('live transport rejects cross-origin or credential URLs, stale authentication, binary/actions and heartbeat flooding',async t=>{
 const f=await fixture(t),fence=await f.connect('viewer-one');
 for(const live of [f.socket('/api/live?token=forbidden'),f.socket('/api/live','https://other.invalid')]){
  const error=await new Promise<Error>(resolve=>live.ws.once('error',resolve));assert.match(error.message,/403/);assert.equal((await live.closed).code,1006);
 }
 const unauth=f.socket();await new Promise<void>(resolve=>unauth.ws.once('open',resolve));unauth.ws.send(JSON.stringify({type:'hello',developmentKey:'invalid',clientLease:fence}));assert.equal((await unauth.closed).code,4401);
 const action=f.socket();await action.hello('viewer-one',fence);action.ws.send(JSON.stringify({type:'BuyBasicMeal'}));assert.equal((await action.closed).code,4400);assert.equal(f.store.snapshot().outbox.length,0);
 const binary=f.socket();await binary.hello('viewer-one',fence);binary.ws.send(Buffer.from('not supported'));assert.equal((await binary.closed).code,4400);
 const flood=f.socket();await flood.hello('viewer-one',fence);for(let i=0;i<9;i++)flood.ws.send(JSON.stringify({type:'heartbeat'}));assert.equal((await flood.closed).code,4429);
});
