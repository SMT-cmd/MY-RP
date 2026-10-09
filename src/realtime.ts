import {WebSocketServer,WebSocket} from 'ws';
import type {Server,IncomingMessage} from 'node:http';
import type {Identity} from './auth.ts';
import type {CommandStore} from './http.ts';
import {nearbyPresence} from './presence.ts';
import {assertClientLease,SESSION_RULES} from './sessions.ts';
import type {ClientFence} from './sessions.ts';
import {DomainError} from './domain.ts';
export type LiveStore=CommandStore&Required<Pick<CommandStore,'claimClient'|'renewClient'|'releaseClient'|'liveState'>>;
type Client={ws:WebSocket;request:IncomingMessage;identity:Identity;fence:ClientFence;sequence:number;signature:string;verifiedAt:number;checking:boolean;messages:number;period:number};
export function liveStore(store:CommandStore):store is LiveStore{return ['claimClient','renewClient','releaseClient','liveState'].every(k=>typeof (store as unknown as Record<string,unknown>)[k]==='function');}
export function attachRealtime(server:Server,options:{store:LiveStore;authenticate:(r:IncomingMessage)=>Promise<Identity>;origin:()=>string;clock:()=>number}){
 const wss=new WebSocketServer({noServer:true,maxPayload:8192,perMessageDeflate:false}),clients=new Map<WebSocket,Client>();let publishing=false,again=false,closed=false;
 const close=(ws:WebSocket,code:number,reason:string)=>{if(ws.readyState===WebSocket.OPEN)ws.close(code,reason);};
 function send(client:Client,data:unknown){if(client.ws.readyState!==WebSocket.OPEN)return;if(client.ws.bufferedAmount>65536){close(client.ws,4413,'Reconnect to recover the current scene.');return;}client.ws.send(JSON.stringify(data));}
 async function publish(){
  if(closed)return;if(publishing){again=true;return;}publishing=true;
  try{
   const connected=[...clients.values()];if(!connected.length)return;
   const {state,revokedSessionIds}=await options.store.liveState(connected.map(c=>c.identity.sessionId)),revoked=new Set(revokedSessionIds),now=options.clock();
   for(const client of connected){
    try{
     if(revoked.has(client.identity.sessionId))throw new DomainError('SESSION_REVOKED','Sign in again.',401);
     const frame=nearbyPresence(state,client.identity.actorId,client.identity.sessionId,client.fence,now),signature=JSON.stringify([frame.cursor,frame.scope,frame.homeUseRevision,frame.relationshipRevision,frame.people]);
     if(signature!==client.signature){client.signature=signature;send(client,{type:'snapshot',sequence:++client.sequence,leaseEpoch:client.fence.epoch,...frame});}
    }catch(e){close(client.ws,e instanceof DomainError&&e.status===401?4401:4409,'Reconnect this tab before continuing.');}
   }
  }catch{for(const client of clients.values())close(client.ws,4413,'The scene is unavailable. Reconnect shortly.');}
  finally{publishing=false;if(again&&!closed){again=false;void publish();}}
 }
 server.on('upgrade',(request,socket,head)=>{
  let url:URL;try{url=new URL(request.url??'/',options.origin());}catch{socket.destroy();return;}
  if(url.pathname!=='/api/live'||url.search||request.headers.origin!==options.origin()||wss.clients.size>=SESSION_RULES.maxActive+8){socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');return;}
  wss.handleUpgrade(request,socket,head,ws=>wss.emit('connection',ws,request));
 });
 wss.on('connection',(ws,request:IncomingMessage)=>{
  let authenticated=false,authenticating=false;const deadline=setTimeout(()=>close(ws,4401,'Sign in before opening the live scene.'),5000);deadline.unref();
  ws.on('error',()=>{});ws.on('close',()=>{clearTimeout(deadline);clients.delete(ws);});
  ws.on('message',async(data,binary)=>{
   if(binary){close(ws,4400,'Use the supported scene protocol.');return;}
   let message:Record<string,unknown>;try{message=JSON.parse(data.toString());if(!message||typeof message!=='object'||Array.isArray(message))throw Error();}catch{close(ws,4400,'Use the supported scene protocol.');return;}
   if(!authenticated){
    if(authenticating||message.type!=='hello'){close(ws,4400,'Authenticate the scene once.');return;}authenticating=true;
    try{
     const authRequest=Object.create(request) as IncomingMessage;authRequest.headers={...request.headers,authorization:typeof message.authorization==='string'?message.authorization:undefined,'x-development-key':typeof message.developmentKey==='string'?message.developmentKey:undefined};
     const identity=await options.authenticate(authRequest),state=await options.store.snapshot(identity.actorId,identity.sessionId),fence=message.clientLease as ClientFence;assertClientLease(state,identity.actorId,identity.sessionId,fence,options.clock());
     if(closed||ws.readyState!==WebSocket.OPEN)return;for(const old of clients.values())if(old.identity.actorId===identity.actorId)close(old.ws,4409,'This citizen has opened a newer live connection.');
     clearTimeout(deadline);authenticated=true;const client:Client={ws,request:authRequest,identity,fence,sequence:0,signature:'',verifiedAt:options.clock(),checking:false,messages:0,period:options.clock()};clients.set(ws,client);await publish();
    }catch{close(ws,4401,'Sign in and reconnect the current tab.');}
    return;
   }
   const client=clients.get(ws);if(!client)return;const now=options.clock();if(now-client.period>=10000){client.messages=0;client.period=now;}if(++client.messages>8||client.checking){close(ws,4429,'Scene updates exceeded the allowed rate.');return;}
   if(message.type!=='heartbeat'){close(ws,4400,'Game actions use the authenticated command API.');return;}
   client.checking=true;
   try{if(now-client.verifiedAt>=30000){const identity=await options.authenticate(client.request);if(identity.actorId!==client.identity.actorId||identity.sessionId!==client.identity.sessionId)throw Error();client.verifiedAt=now;}const result=await options.store.renewClient(client.identity.actorId,client.identity.sessionId,client.fence,now);send(client,{type:'heartbeat',sequence:++client.sequence,leaseEpoch:client.fence.epoch,expiresAt:result.expiresAt,serverTime:now});await publish();}catch{close(ws,4401,'Sign in and reconnect the current tab.');}finally{client.checking=false;}
  });
 });
 const timer=setInterval(()=>{void publish();},1000);timer.unref();
 server.on('close',()=>{closed=true;clearInterval(timer);for(const ws of wss.clients)ws.terminate();wss.close();clients.clear();});
 return{publish,close(){closed=true;clearInterval(timer);for(const ws of wss.clients)ws.terminate();wss.close();clients.clear();}};
}
