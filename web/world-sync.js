// Transport metadata only. Economic intent remains in the existing pending-command flow.
window.WorldSync=(()=>{
 let enabled=false,ready=true,generation=0,context=null,account='',clientId='',lease=null,ws=null,timer=null,heartbeat=null,poll=null,connecting=false,backoff=1000,sequence=0,cursor=null;
 const $=id=>document.getElementById(id),later=(fn,ms)=>setTimeout(fn,ms);
 let confirmedCursor=null,confirmedScope=null,confirmedTime=0,confirmedUse=null,confirmedRelationships=null,wanted=null,recovering=null;
 const scopeOf=view=>view?.world?.position?{region:view.world.position.region,interior:view.world.position.interior,leaseVersion:view.world.position.leaseVersion,homeId:view.world.position.homeId??null}:null;
 const needsSnapshot=()=>wanted&&(wanted.cursor>confirmedCursor||wanted.cursor===confirmedCursor&&wanted.serverTime>=confirmedTime&&(JSON.stringify(wanted.scope)!==JSON.stringify(confirmedScope)||wanted.homeUseRevision!==confirmedUse||wanted.relationshipRevision!==confirmedRelationships));
 async function recoverScene(version){
  if(recovering===version||version!==generation||!needsSnapshot())return;recovering=version;
  try{const view=await context.request('/api/citizen');if(version!==generation)return;if(view.sync?.cursor>=confirmedCursor&&view.serverTime>=confirmedTime){confirmedCursor=view.sync.cursor;confirmedScope=scopeOf(view);confirmedTime=view.serverTime;confirmedUse=view.world?.home?.useRevision??null;confirmedRelationships=view.relationships?.revision??null;context.snapshot(view);}}
  catch(error){if(version===generation){if(error.auth){const onFailure=context?.authFailed;stop();onFailure?.(error);}else{clear();schedule(error.message+' Recovering the current home and location…');}}}
  finally{if(recovering===version)recovering=null;if(version===generation&&ready&&needsSnapshot())queueMicrotask(()=>void recoverScene(version));}
 }
 function status(message,canTakeover=false){const element=$('connection-status');if(element)element.textContent=message;const takeover=$('connection-takeover');if(takeover){takeover.hidden=!canTakeover;takeover.disabled=false;}}
 function setReady(value,message,takeover=false){const changed=ready!==value;ready=value;status(message,takeover);if(changed)context?.status(value);}
 function clear(){clearTimeout(timer);clearInterval(heartbeat);clearInterval(poll);timer=heartbeat=poll=null;if(ws){const previous=ws;ws=null;previous.onclose=null;previous.onmessage=null;previous.close();}}
 function stop(){generation++;clear();enabled=false;ready=true;context=null;account='';lease=null;connecting=false;sequence=0;cursor=null;confirmedCursor=confirmedScope=confirmedUse=confirmedRelationships=wanted=null;status('');}
 function schedule(message){if(!enabled)return;setReady(false,message);if(document.hidden)return;clearTimeout(timer);const version=generation;timer=later(()=>{if(version===generation)void connect(false);},backoff);backoff=Math.min(15000,backoff*2);}
 function frame(data,version){
  if(version!==generation||!data||data.leaseEpoch!==undefined&&data.leaseEpoch!==lease?.epoch)return;
  if(data.sequence!==undefined){if(!Number.isSafeInteger(data.sequence)||data.sequence<=sequence)return;if(sequence&&data.sequence!==sequence+1){clear();schedule('Recovering a missed scene update…');return;}sequence=data.sequence;}
  if(data.type==='heartbeat')return;
  if(data.protocol!==1||!Number.isSafeInteger(data.cursor)||!Array.isArray(data.people)||data.people.length>32)return;
  if(cursor!==null&&data.cursor<cursor)return;cursor=data.cursor;wanted={cursor:data.cursor,scope:data.scope??null,serverTime:data.serverTime,homeUseRevision:data.homeUseRevision??null,relationshipRevision:data.relationshipRevision??null};setReady(true,'Connected · actions use the saved world state.');context?.frame(data);void recoverScene(version);
 }
 async function fallback(version){
  if(version!==generation)return;try{const data=await context.request('/api/presence',undefined,false,{'x-client-id':lease.clientId,'x-client-epoch':String(lease.epoch)});frame(data,version);}catch(error){if(version!==generation)return;clear();schedule(error.message+' Reconnecting…');}
 }
 function open(version){
  if(version!==generation)return;sequence=0;
  if(typeof WebSocket!=='function'){
   void fallback(version);poll=setInterval(()=>{if(!document.hidden&&version===generation)void fallback(version);},3000);
   heartbeat=setInterval(()=>{if(!document.hidden&&version===generation)context.request('/api/heartbeat',{clientLease:lease}).catch(error=>{if(version!==generation)return;clear();schedule(error.message+' Reconnecting…');});},20000);return;
  }
  const url=new URL('/api/live',location.href);url.protocol=url.protocol==='https:'?'wss:':'ws:';ws=new WebSocket(url);const socket=ws;
  socket.onopen=()=>{if(version!==generation)return;socket.send(JSON.stringify({type:'hello',clientLease:lease,...context.credentials()}));};
  socket.onmessage=event=>{try{frame(JSON.parse(event.data),version);}catch{clear();schedule('Recovering the current scene…');}};
  socket.onerror=()=>{};
  socket.onclose=event=>{if(version!==generation)return;clear();if(event.code===4409){setReady(false,'This connection changed. Reconnect, or use this tab to take control.',true);return;}schedule('Connection interrupted. Pending actions are preserved. Reconnecting…');};
  heartbeat=setInterval(()=>{if(!document.hidden&&version===generation&&socket.readyState===1)socket.send(JSON.stringify({type:'heartbeat'}));},20000);
 }
 async function connect(takeover){
  if(!enabled||connecting||document.hidden)return;connecting=true;const version=++generation;clear();setReady(false,'Recovering your saved citizen…');
  try{
   // A fresh claim incarnation fences an old document, including a duplicated tab.
   const claimId=crypto.randomUUID(),result=await context.request('/api/connect',{clientId:{id:clientId,claimId},takeover});
   if(version!==generation)return;lease=result.clientLease;
   // A fresh snapshot covers the whole state even when the bounded receipt page hasMore.
   const recovered=cursor===null?result:await context.request('/api/recovery?after='+cursor);
   if(version!==generation)return;cursor=recovered.view.sync.cursor;confirmedCursor=cursor;confirmedScope=scopeOf(recovered.view);confirmedTime=recovered.view.serverTime;confirmedUse=recovered.view.world?.home?.useRevision??null;confirmedRelationships=recovered.view.relationships?.revision??null;wanted=null;backoff=1000;context.snapshot(recovered.view);open(version);
  }catch(error){if(version!==generation)return;lease=null;if(error.message.includes('Another tab'))setReady(false,error.message,true);else if(error.auth){const onFailure=context?.authFailed;stop();onFailure?.(error);}else schedule(error.message+' Reconnecting…');}
  finally{if(version===generation)connecting=false;}
 }
 function observe(view,nextContext){
  if(!view?.sync){if(enabled)stop();return;}
  const nextAccount=view.accountId+':'+view.worldId;context=nextContext;if(enabled&&account===nextAccount){confirmedCursor=view.sync.cursor;confirmedScope=scopeOf(view);confirmedTime=view.serverTime;confirmedUse=view.world?.home?.useRevision??null;confirmedRelationships=view.relationships?.revision??null;return;}
  stop();context=nextContext;enabled=true;account=nextAccount;setReady(false,'Recovering your saved citizen…');
  try{clientId=sessionStorage.getItem('simulator-client-id')||'';if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(clientId))clientId=crypto.randomUUID();sessionStorage.setItem('simulator-client-id',clientId);}catch{clientId=crypto.randomUUID();}
  queueMicrotask(()=>void connect(false));
 }
 document.addEventListener('visibilitychange',()=>{if(!enabled)return;if(document.hidden){generation++;clear();connecting=false;setReady(false,'Scene paused while this tab is hidden.');}else void connect(false);});
 window.addEventListener('online',()=>{if(enabled&&!ready)void connect(false);});
 window.addEventListener('offline',()=>{if(enabled){generation++;clear();connecting=false;setReady(false,'Offline. Pending actions are preserved.');}});
 document.addEventListener('DOMContentLoaded',()=>{$('connection-takeover')?.addEventListener('click',()=>void connect(true));});
 return{observe,stop,ready:()=>!enabled||ready,fence:()=>lease?{...lease}:undefined,reconnect:()=>connect(false)};
})();
