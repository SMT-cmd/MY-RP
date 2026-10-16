import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {JSDOM,VirtualConsole} from 'jsdom';
import {createApp} from '../src/http.ts';
import {WorldStore} from '../src/store.ts';
import {DomainError,initialState} from '../src/domain.ts';
import {readRefreshCookie,refreshCookie} from '../src/account-cookie.ts';
import {supabaseAccounts} from '../src/account.ts';
const wait=async(check:()=>boolean)=>{for(let n=0;n<700;n++){if(check())return;await new Promise(r=>setTimeout(r,10));}throw Error('Interaction did not settle');};
const session={access_token:'eyJhbGciOiJub25lIn0.eyJzdWIiOiJhY2NvdW50In0.signature',refresh_token:'private-refresh-123',expires_in:3600};
test('session resume exchanges an HttpOnly host cookie only at the same origin, rotates it and preserves it on provider outages',async t=>{
 assert.equal(readRefreshCookie('myrp-refresh=good-token-123; myrp-refresh=other-token-123',false),null);assert.equal(readRefreshCookie('myrp-refresh=%0D%0Abad',false),null);assert.match(refreshCookie(session.refresh_token,true),/__Secure-myrp-refresh=.*; Path=\/api\/auth; HttpOnly; SameSite=Strict; Secure$/);assert.doesNotMatch(refreshCookie(session.refresh_token,true),/Domain=|Max-Age=/);
 let calls=0,fail=0;const server=createApp({appOrigin:'https://game.example',config:{mode:'supabase'},store:{snapshot:()=>initialState(),dispatch:async()=>{throw Error();}},authenticate:async()=>({actorId:'account',sessionId:'verified',assurance:'aal1'}),accounts:async(action,input)=>{calls++;if(fail)throw new DomainError(fail===401?'AUTH_REQUIRED':'AUTH_UNAVAILABLE','Account unavailable.',fail);if(action==='refresh')assert.equal(input.refresh_token,session.refresh_token);return{...session,refresh_token:action==='refresh'?'rotated-refresh-456':session.refresh_token};}});
 await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise<void>(r=>server.close(()=>r())));const a=server.address();if(!a||typeof a==='string')throw Error();const root='http://127.0.0.1:'+a.port;
 const post=(action:string,origin:string|undefined,cookie?:string)=>fetch(root+'/api/auth/'+action,{method:'POST',headers:{'Content-Type':'application/json',...(origin?{Origin:origin}:{}),...(cookie?{Cookie:cookie}:{})},body:JSON.stringify(action==='login'?{email:'test@example.com',password:'testing-password'}:{})});
 const cookie='__Secure-myrp-refresh='+session.refresh_token;
 assert.deepEqual(await(await post('resume','https://game.example')).json(),{sessionAvailable:false});assert.equal(calls,0);
 assert.equal((await post('resume','https://attacker.example',cookie)).status,403);assert.equal((await post('resume',undefined,cookie)).status,403);assert.equal(calls,0);
 const login=await post('login','https://game.example');assert.match(login.headers.get('set-cookie')!,/HttpOnly; SameSite=Strict; Secure/);assert.equal(calls,1);
 const resumed=await post('resume','https://game.example',cookie);assert.equal(resumed.status,200);assert.equal((await resumed.json()).refresh_token,'rotated-refresh-456');assert.match(resumed.headers.get('set-cookie')!,/rotated-refresh-456/);
 fail=503;const outage=await post('resume','https://game.example',cookie);assert.equal(outage.status,503);assert.equal(outage.headers.get('set-cookie'),null);
 fail=401;const expired=await post('resume','https://game.example',cookie);assert.equal(expired.status,401);assert.match(expired.headers.get('set-cookie')!,/Max-Age=0/);
});
test('unconfirmed email and provider downtime have distinct safe errors instead of a wrong-password message',async()=>{
 for(const [status,body,expected] of [[403,{code:'email_not_confirmed',message:'private@example.com'},'EMAIL_CONFIRMATION_REQUIRED'],[503,{message:'provider-private-diagnostic'},'AUTH_UNAVAILABLE']] as const){const accounts=supabaseAccounts('https://example.supabase.co','sb_publishable_test',async()=>new Response(JSON.stringify(body),{status}));await assert.rejects(accounts('login',{email:'test@example.com',password:'testing-password'}),e=>e instanceof DomainError&&e.code===expected&&!e.message.includes('private'));}
});
test('command response uses its exact committed snapshot without another database read or private-state disclosure',async t=>{
 const store=await WorldStore.open();await store.dispatch('resident',{id:'snapshot_create',type:'CreateCitizen',payload:{name:'Resident',state:'Lagos',adultConfirmed:true}},1000);
 const server=createApp({store:{snapshot:()=>{throw Error('A redundant read must not happen');},dispatch:store.dispatch.bind(store)},authenticate:async()=>({actorId:'resident',sessionId:'verified',assurance:'aal1'}),clock:()=>2000});await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise<void>(r=>server.close(()=>r())));const a=server.address();if(!a||typeof a==='string')throw Error();
 const response=await fetch('http://127.0.0.1:'+a.port+'/api/commands',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:'snapshot_move',type:'MoveCitizen',payload:{dx:1,dy:0}})});assert.equal(response.status,200);const data=await response.json();assert.equal(data.view.world.position.x,8);assert.equal(data.state,undefined);assert.equal(data.view.commands,undefined);assert.equal(store.snapshot().world!.positions.resident.x,8);
});
test('a real bubbling pointer release keeps the whole route; a second floor tap retargets after the current confirmed step',async t=>{
 const store=await WorldStore.open(),actor='tap-resident';let clock=1000,seq=0;const setup=(type:string,payload:Record<string,unknown>)=>store.dispatch(actor,{id:'tap_setup_'+ ++seq,type,payload},clock+=700);
 await setup('CreateCitizen',{name:'Tap Resident',state:'Lagos',adultConfirmed:true});for(let i=0;i<3;i++)await setup('MoveCitizen',{dx:-1,dy:0});await setup('EnterBuilding',{buildingId:'shelter'});
 const server=createApp({store,authenticate:async()=>({actorId:actor,sessionId:'tap-session',assurance:'aal1'}),clock:()=>clock});await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise<void>(r=>server.close(()=>r())));const a=server.address();if(!a||typeof a==='string')throw Error();const origin='http://127.0.0.1:'+a.port,errors:unknown[]=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e));let hold=false,release:(()=>void)|null=null;
 const dom=await JSDOM.fromURL(origin,{resources:'usable',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){Object.defineProperty(w.crypto,'randomUUID',{value:randomUUID});w.AbortSignal=AbortSignal as typeof w.AbortSignal;w.fetch=async(url,options)=>{clock+=700;const r=await fetch(new URL(String(url),origin),options);if(hold&&String(url)==='/api/commands'){hold=false;await new Promise<void>(resolve=>release=resolve);}return r;};}});t.after(()=>dom.window.close());const w=dom.window,d=w.document,el=(id:string)=>d.getElementById(id)!,ready=()=>!(el('refresh') as HTMLButtonElement).disabled;
 await wait(()=>d.readyState==='complete');(el('access-key') as HTMLInputElement).value='tap-test';(el('access-form') as HTMLFormElement).requestSubmit();await wait(()=>d.body.classList.contains('is-playing')&&ready());
 const homeId=store.snapshot().world!.positions[actor].homeId!,select=(x:number,y:number)=>{w.dispatchEvent(new w.CustomEvent('world-tile-select',{detail:{x,y,homeId,leaseVersion:2}}));el('world-canvas').dispatchEvent(new w.Event('pointerup',{bubbles:true}));};
 select(5,3);await wait(()=>store.snapshot().world!.positions[actor].interiorX===5&&store.snapshot().world!.positions[actor].interiorY===3&&ready());
 hold=true;select(4,6);await wait(()=>release!==null);select(7,6);release!();await wait(()=>store.snapshot().world!.positions[actor].interiorX===7&&store.snapshot().world!.positions[actor].interiorY===6&&ready());
 const mutations=store.snapshot().outbox.length;w.dispatchEvent(new w.CustomEvent('home-fixture-select',{detail:{fixtureId:'sofa',homeId,leaseVersion:2}}));assert.equal(el('object-menu').hidden,false);assert.equal(store.snapshot().outbox.length,mutations,'selection must not silently use or move furniture');assert.ok([...el('object-menu').querySelectorAll('button')].some(b=>b.textContent==='Rotate 90°'));assert.ok([...el('object-menu').querySelectorAll('button')].some(b=>b.textContent==='Move / change finish'));assert.deepEqual(errors,[]);
});
