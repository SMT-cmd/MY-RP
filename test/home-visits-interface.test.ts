import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {WebSocket} from 'ws';
import {JSDOM,VirtualConsole} from 'jsdom';
import {WorldStore} from '../src/store.ts';
import {createApp} from '../src/http.ts';
import {DomainError} from '../src/domain.ts';
import type {ClientFence} from '../src/sessions.ts';
const waitFor=async(check:()=>boolean)=>{for(let i=0;i<800;i++){if(check())return;await new Promise(resolve=>setTimeout(resolve,10));}throw Error('Home visit interface did not settle');};
test('two authenticated browsers review home consent, recover lost acceptance, share an interior and refresh revoked or expired access without a guest action',async t=>{
 const store=await WorldStore.open(),sockets:WebSocket[]=[],doms:JSDOM[]=[],errors:unknown[]=[];let clock=Date.now(),sequence=0,dropAccept=false;
 const run=(actor:string,type:string,payload:Record<string,unknown>={})=>store.dispatch(actor,{id:'home_visit_ui_setup_'+ ++sequence,type,payload},clock+=700);
 for(const [actor,name] of [['visit-host','Home Resident'],['visit-guest','Home Guest']]){await run(actor,'CreateCitizen',{name,state:'Lagos',adultConfirmed:true});await run(actor,'SetPrivacy',{location:true,presence:true,dm:false});}
 const p=await run('visit-host','ReservePropertyPurchase',{propertyId:'npc-Lagos-home',acceptedTotal:512500,acceptTerms:true});await run('visit-host','CompletePropertyPurchase',{purchaseId:p.receipt.detail.purchaseId});
 for(const actor of ['visit-host','visit-guest'])for(let i=0;i<(actor==='visit-host'?20:19);i++)await run(actor,'MoveCitizen',{dx:1,dy:0});await run('visit-host','EnterBuilding',{buildingId:'residence:npc-Lagos-home'});
 const server=createApp({store,multiplayer:true,clock:()=>clock,authenticate:async req=>{const actor=String(req.headers['x-development-key']??'');if(!['visit-host','visit-guest'].includes(actor))throw new DomainError('AUTH_REQUIRED','Sign in.',401);return{actorId:actor,sessionId:actor+'-session',assurance:'aal1'};}});
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(async()=>{doms.forEach(d=>d.window.close());sockets.forEach(s=>s.terminate());await new Promise<void>(resolve=>server.close(()=>resolve()));});const a=server.address();if(!a||typeof a==='string')throw Error();const origin='http://127.0.0.1:'+a.port;
 async function browser(actor:string){
  const vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e));const dom=await JSDOM.fromURL(origin,{runScripts:'dangerously',resources:'usable',pretendToBeVisual:true,virtualConsole:vc,beforeParse(window){
   Object.defineProperty(window.crypto,'randomUUID',{value:randomUUID});window.AbortSignal=AbortSignal as typeof window.AbortSignal;
   window.WebSocket=class extends WebSocket{constructor(url:string|URL){super(String(url),{origin});sockets.push(this);}} as unknown as typeof window.WebSocket;
   window.fetch=async(url,options)=>{if(String(url)==='/api/commands')clock+=700;const response=await fetch(new URL(String(url),origin),options);if(dropAccept&&actor==='visit-guest'&&String(options?.body).includes('AcceptHomeVisit')){dropAccept=false;await response.text();throw new TypeError('Acceptance response lost after commit');}return response;};
  }});doms.push(dom);const doc=dom.window.document;if(doc.readyState!=='complete')await new Promise<void>(resolve=>dom.window.addEventListener('load',()=>resolve(),{once:true}));(doc.getElementById('access-key') as HTMLInputElement).value=actor;(doc.getElementById('access-form') as HTMLFormElement).requestSubmit();await waitFor(()=>doc.getElementById('connection-status')!.textContent!.startsWith('Connected')&&!(doc.getElementById('refresh') as HTMLButtonElement).disabled);
  const saver=doc.getElementById('data-saver') as HTMLInputElement;saver.checked=true;saver.dispatchEvent(new dom.window.Event('change'));return dom;
 }
 const host=await browser('visit-host'),guest=await browser('visit-guest'),hd=host.window.document,gd=guest.window.document;
 const fence=(dom:JSDOM)=>(dom.window as unknown as {WorldSync:{fence:()=>ClientFence}}).WorldSync.fence();
 const button=(doc:Document,root:string,label:string)=>[...doc.querySelectorAll<HTMLButtonElement>(root+' button')].find(b=>b.textContent===label)!;
 const invite=async()=>{const form=hd.querySelector<HTMLFormElement>('#home-visits-records form')!;form.querySelector<HTMLInputElement>('[name=citizenId]')!.value=store.snapshot().citizens['visit-guest'].id;form.querySelector<HTMLInputElement>('[name=consent]')!.checked=true;form.requestSubmit();await waitFor(()=>!!button(gd,'#home-visits-records','Accept home visit')&&!button(hd,'#home-visits-records','Withdraw home visit').disabled);};
 const accept=()=>{const form=button(gd,'#home-visits-records','Accept home visit').form!;form.querySelector<HTMLInputElement>('input[type=checkbox]')!.checked=true;form.requestSubmit();};
 await invite();const before=store.snapshot(),id=Object.keys(before.furnishing!.visits!)[0];assert.equal(before.furnishing!.visits![id].status,'invited');assert.ok(!button(gd,'#home-visits-records','Walk to invited home'));
 const form=button(gd,'#home-visits-records','Accept home visit').form!;form.requestSubmit();await new Promise(resolve=>setTimeout(resolve,20));assert.equal(store.snapshot().furnishing!.visits![id].status,'invited');
 dropAccept=true;accept();await waitFor(()=>!(gd.getElementById('retry-panel') as HTMLElement).hidden);const pending=guest.window.sessionStorage.getItem('simulator-pending');assert.ok(pending);assert.equal(store.snapshot().furnishing!.visits![id].status,'accepted');assert.equal(store.snapshot().world!.positions['visit-guest'].interior,null);
 await waitFor(()=>!button(gd,'#retry-panel','Retry last action').disabled);button(gd,'#retry-panel','Retry last action').click();await waitFor(()=>(gd.getElementById('retry-panel') as HTMLElement).hidden&&!!button(gd,'#home-visits-records','Walk to invited home'));assert.equal(Object.values(store.snapshot().commands).filter(c=>c.receipt.type==='AcceptHomeVisit').length,1);
 button(gd,'#home-visits-records','Walk to invited home').click();await waitFor(()=>store.snapshot().world!.positions['visit-guest'].visitId===id&&gd.getElementById('world-location')!.textContent!.includes("Home Resident's home"));
 await waitFor(()=>hd.getElementById('world-neighbours')!.textContent!.includes('Home Guest')&&gd.getElementById('world-neighbours')!.textContent!.includes('Home Resident'));
 assert.equal(button(gd,'#world-interactions','Upholstered double bed · Rest').disabled,true);assert.equal(button(gd,'#world-interactions','Double wardrobe · Use wardrobe').disabled,true);
 for(const direction of ['North','East','East']){button(gd,'#world-interactions','Walk '+direction).click();await waitFor(()=>!(gd.getElementById('refresh') as HTMLButtonElement).disabled);}
 button(gd,'#world-interactions','Three-seat sofa · Sit').click();await waitFor(()=>store.snapshot().world!.positions['visit-guest'].activity?.kind==='Sit'&&!(gd.getElementById('refresh') as HTMLButtonElement).disabled);
 assert.equal(store.snapshot().world!.positions['visit-guest'].activity!.slot,0);
 // A hidden peer's busy fixture expires and refreshes controls without a new
 // command/cursor, while the public crowd remains empty.
 await run('visit-host','SetPrivacy',{location:false,presence:false});
 for(const [actor,steps] of [['visit-host',[[0,-1],[0,-1],[0,-1],[1,0],[1,0],[1,0]]],['visit-guest',[[-1,0],[-1,0],[0,-1],[0,-1],[1,0],[1,0],[1,0]]]] as const)for(const [dx,dy] of steps)await run(actor,'MoveInterior',{dx,dy});
 await run('visit-host','InteractHomeFixture',{fixtureId:'sink'});await waitFor(()=>button(gd,'#world-interactions','Kitchen sink unit · Wash hands').disabled&&gd.getElementById('world-interactions')!.textContent!.includes('Kitchen sink unit: 0 of 1 positions free.')&&gd.getElementById('world-neighbours')!.children.length===0);
 for(const [actor,dom] of [['visit-host',host],['visit-guest',guest]] as const)await store.renewClient(actor,actor+'-session',fence(dom),clock);
 const useCursor=store.snapshot().outbox.length;clock+=10000;await waitFor(()=>!button(gd,'#world-interactions','Kitchen sink unit · Wash hands').disabled&&gd.getElementById('world-interactions')!.textContent!.includes('Kitchen sink unit: 1 of 1 positions free.'));assert.equal(store.snapshot().outbox.length,useCursor);assert.equal(gd.getElementById('world-neighbours')!.children.length,0);
 const sofa=Object.values(store.snapshot().furnishing!.items).find(i=>i.homeId==='npc-Lagos-home'&&i.model==='sofa')!;
 const hostForm=[...hd.querySelectorAll<HTMLFormElement>('#furnishing-records form')].find(f=>f.textContent!.includes('Three-seat sofa'))!;[...hostForm.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent==='Put into storage')!.click();
 await waitFor(()=>store.snapshot().furnishing!.items[sofa.id].homeId===null&&!button(gd,'#world-interactions','Three-seat sofa · Sit'));assert.equal(store.snapshot().world!.positions['visit-guest'].activity,undefined);
 const wallets={...store.snapshot().balances};button(hd,'#home-visits-records','Withdraw home visit').click();await waitFor(()=>store.snapshot().furnishing!.visits![id].status==='ended'&&!gd.getElementById('world-location')!.textContent!.startsWith('Inside')&&!(gd.getElementById('world-controls') as HTMLElement).hidden);assert.deepEqual(store.snapshot().balances,wallets);assert.equal(hd.getElementById('world-neighbours')!.children.length,0);
 // Expiry changes the private read scope without adding an outbox command.
 await invite();accept();await waitFor(()=>!!button(gd,'#home-visits-records','Walk to invited home')&&!button(gd,'#home-visits-records','Walk to invited home').disabled);button(gd,'#home-visits-records','Walk to invited home').click();await waitFor(()=>store.snapshot().world!.positions['visit-guest'].interior==='shelter'&&gd.getElementById('world-location')!.textContent!.startsWith('Inside'));
 const active=Object.values(store.snapshot().furnishing!.visits!).find(v=>v.status==='accepted')!,cursor=store.snapshot().outbox.length;
 for(const [actor,dom] of [['visit-host',host],['visit-guest',guest]] as const)await store.renewClient(actor,actor+'-session',fence(dom),clock);
 while(clock<active.expiresAt){clock=Math.min(active.expiresAt,clock+50000);for(const [actor,dom] of [['visit-host',host],['visit-guest',guest]] as const)await store.renewClient(actor,actor+'-session',fence(dom),clock);}
 await waitFor(()=>!gd.getElementById('world-location')!.textContent!.startsWith('Inside')&&gd.getElementById('home-visits-records')!.textContent!.includes('Visit ended: expired.'));assert.equal(store.snapshot().outbox.length,cursor);assert.equal(store.snapshot().furnishing!.visits![active.id].status,'accepted');assert.deepEqual(errors,[]);
});
