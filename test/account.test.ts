import test from 'node:test';
import assert from 'node:assert/strict';
import {supabaseAccounts} from '../src/account.ts';
import {createApp} from '../src/http.ts';
import {DomainError,initialState} from '../src/domain.ts';
import {JSDOM,VirtualConsole} from 'jsdom';
const session={access_token:'eyJhbGciOiJub25lIn0.eyJzdWIiOiJhY2NvdW50In0.signature',refresh_token:'refresh-test-token',expires_in:3600};
test('account gateway forwards only credentials, limits response fields and handles confirmation, refresh and local logout',async()=>{
 const calls:{url:string;body:Record<string,unknown>;headers:Headers}[]=[];let status=200,data:Record<string,unknown>={...session,user:{user_metadata:{admin:true}},secret:'never return'};
 const gateway=supabaseAccounts('https://example.supabase.co','sb_publishable_test',async(input,init)=>{calls.push({url:String(input),body:JSON.parse(String(init?.body)),headers:new Headers(init?.headers)});return new Response(JSON.stringify(data),{status});});
 assert.deepEqual(await gateway('login',{email:'test@example.com',password:'testing-password',actorId:'forged',role:'admin'}),session);
 assert.deepEqual(calls[0].body,{email:'test@example.com',password:'testing-password'});assert.match(calls[0].url,/grant_type=password/);assert.equal(calls[0].headers.get('apikey'),'sb_publishable_test');
 data={user:{id:'test'}};assert.equal((await gateway('signup',{email:'test@example.com',password:'testing-password'})).confirmationRequired,true);
 data=session;await gateway('refresh',{refresh_token:'refresh-test-token'});assert.match(calls.at(-1)!.url,/grant_type=refresh_token/);
 assert.deepEqual(await gateway('logout',{},'Bearer '+session.access_token),{signedOut:true});assert.match(calls.at(-1)!.url,/scope=local/);
 status=429;await assert.rejects(gateway('login',{email:'test@example.com',password:'testing-password'}),(e:unknown)=>e instanceof DomainError&&e.status===429);
 await assert.rejects(gateway('login',{email:'broken',password:'short'}),(e:unknown)=>e instanceof DomainError&&e.status===400);
});
test('production-origin account UI uses bearer sessions, signs out, and keeps credentials out of browser storage',async t=>{
 let signedOut=false;const state=initialState();const server=createApp({config:{mode:'supabase'},store:{snapshot:()=>state,dispatch:async()=>{throw Error('Unused');}},accounts:async(action)=>{if(action==='logout'){signedOut=true;return {signedOut:true};}return session;},authenticate:async req=>{assert.equal(req.headers['x-development-key'],undefined);if(req.headers.authorization!=='Bearer '+session.access_token)throw new DomainError('AUTH_REQUIRED','Sign in.',401);return {actorId:'account',sessionId:'session',assurance:'aal1'};}});
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise<void>(resolve=>server.close(()=>resolve())));const a=server.address();if(!a||typeof a==='string')throw Error();const origin='http://127.0.0.1:'+a.port,errors:unknown[]=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e));
 const dom=await JSDOM.fromURL(origin,{resources:'usable',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,beforeParse(window){window.AbortSignal=AbortSignal as typeof window.AbortSignal;window.fetch=(url,init)=>fetch(new URL(String(url),origin),init);}});t.after(()=>dom.window.close());const doc=dom.window.document;
 const until=async(fn:()=>boolean)=>{for(let i=0;i<200;i++){if(fn())return;await new Promise(r=>setTimeout(r,10));}throw Error('UI timeout');};
 await until(()=>!(doc.getElementById('account-panel') as HTMLElement)?.hidden);assert.equal((doc.getElementById('access-panel') as HTMLElement).hidden,true);
 (doc.getElementById('account-email') as HTMLInputElement).value='test@example.com';(doc.getElementById('account-password') as HTMLInputElement).value='testing-password';(doc.getElementById('account-form') as HTMLFormElement).requestSubmit(doc.getElementById('account-login') as HTMLButtonElement);
 await until(()=>!(doc.getElementById('creation-panel') as HTMLElement).hidden);assert.equal((doc.getElementById('account-password') as HTMLInputElement).value,'');assert.equal(dom.window.localStorage.length,0);assert.equal(dom.window.sessionStorage.length,0);
 (doc.getElementById('account-logout') as HTMLButtonElement).click();await until(()=>signedOut&&!(doc.getElementById('account-panel') as HTMLElement).hidden);assert.deepEqual(errors,[]);
});
test('configured HTTPS origin is enforced and readiness exposes no world data',async t=>{
 let unavailable=false;const server=createApp({appOrigin:'https://game.example',store:{snapshot:()=>{if(unavailable)throw Error('database credential secret');return initialState();},dispatch:async()=>{throw Error();}},authenticate:async()=>{throw Error();}});
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise<void>(resolve=>server.close(()=>resolve())));const a=server.address();if(!a||typeof a==='string')throw Error();const url='http://127.0.0.1:'+a.port;
 assert.equal((await fetch(url+'/healthz',{headers:{Origin:'https://game.example'}})).status,200);assert.equal((await fetch(url+'/healthz',{headers:{Origin:'https://attacker.example'}})).status,403);
 assert.deepEqual(await(await fetch(url+'/readyz')).json(),{status:'ready'});unavailable=true;const fail=await fetch(url+'/readyz');assert.equal(fail.status,503);assert.doesNotMatch(await fail.text(),/credential secret/);
});
test('production rejects a recovered command from a different account before any mutation',async t=>{
 let mutations=0;const server=createApp({accounts:async()=>session,store:{snapshot:()=>initialState(),dispatch:async()=>{mutations++;throw Error('Must not reach dispatch');}},authenticate:async()=>({actorId:'account-two',sessionId:'verified-session',assurance:'aal1'})});
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise<void>(resolve=>server.close(()=>resolve())));const a=server.address();if(!a||typeof a==='string')throw Error();const response=await fetch('http://127.0.0.1:'+a.port+'/api/commands',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:'recovered_other_account',type:'BuyFurniture',accountId:'account-one',payload:{}})});
 assert.equal(response.status,401);assert.equal((await response.json()).error,'ACCOUNT_CHANGED');assert.equal(mutations,0);
});
