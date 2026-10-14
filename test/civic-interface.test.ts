import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {WebSocket} from 'ws';
import {JSDOM,VirtualConsole} from 'jsdom';
import {WorldStore} from '../src/store.ts';
import {createApp} from '../src/http.ts';
import {DomainError} from '../src/domain.ts';
import {PETITION_RULES} from '../src/civic.ts';
import type {ClientFence} from '../src/sessions.ts';
const waitFor=async(fn:()=>boolean)=>{for(let i=0;i<700;i++){if(fn())return;await new Promise(r=>setTimeout(r,10));}throw Error('Civic interface timeout');};
test('two authenticated browsers recover a lost proposal, update private support and consideration, refresh idle expiry and clear revoked civic data',async t=>{
 const store=await WorldStore.open(),sockets:WebSocket[]=[],errors:unknown[]=[];let clock=8*86400000,drop=false;
 for(let i=0;i<12;i++)await store.dispatch('civic-ui-'+i,{id:'civic_ui_create',type:'CreateCitizen',payload:{name:'Citizen '+i,state:'Lagos',adultConfirmed:true}},100);
 const old=clock-PETITION_RULES.window+10000,termsVersion=PETITION_RULES.version;
 const water=await store.dispatch('civic-ui-2',{id:'civic_old_water',type:'CreateCivicPetition',payload:{topic:'water',termsVersion,consent:true}},old),waterId=String(water.receipt.detail.petitionId);
 for(let i=3;i<12;i++)await store.dispatch('civic-ui-'+i,{id:'civic_water_support',type:'SupportCivicPetition',payload:{petitionId:waterId,petitionVersion:store.snapshot().civic!.petitions[waterId].version,termsVersion,consent:true}},old);
 await store.dispatch('civic-ui-3',{id:'civic_old_housing',type:'CreateCivicPetition',payload:{topic:'housing',termsVersion,consent:true}},old);
 const server=createApp({store,multiplayer:true,clock:()=>clock,authenticate:async req=>{const actor=String(req.headers['x-development-key']);if(!['civic-ui-0','civic-ui-1'].includes(actor))throw new DomainError('AUTH_REQUIRED','Sign in.',401);return{actorId:actor,sessionId:actor+'-session',assurance:'aal1'};}});
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const address=server.address();if(!address||typeof address==='string')throw Error();const origin='http://127.0.0.1:'+address.port,doms:JSDOM[]=[];
 t.after(async()=>{doms.forEach(d=>d.window.close());sockets.forEach(s=>s.terminate());await new Promise<void>(resolve=>server.close(()=>resolve()));});
 async function browser(actor:string){const vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e));const dom=await JSDOM.fromURL(origin,{resources:'usable',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,beforeParse(window){
  window.localStorage.setItem('simulator-data-saver','1');Object.defineProperty(window.crypto,'randomUUID',{value:randomUUID});window.AbortSignal=AbortSignal as typeof window.AbortSignal;
  window.WebSocket=class extends WebSocket{constructor(url:string|URL){super(String(url),{origin});sockets.push(this);}} as unknown as typeof window.WebSocket;
  window.fetch=async(input,init)=>{const response=await fetch(new URL(String(input),origin),init);if(drop&&actor==='civic-ui-0'&&String(input)==='/api/commands'&&String(init?.body).includes('CreateCivicPetition')){drop=false;await response.text();throw new TypeError('Lost petition response');}return response;};
 }});doms.push(dom);const doc=dom.window.document;if(doc.readyState!=='complete')await new Promise<void>(resolve=>dom.window.addEventListener('load',()=>resolve(),{once:true}));(doc.getElementById('access-key') as HTMLInputElement).value=actor;(doc.getElementById('access-form') as HTMLFormElement).requestSubmit();await waitFor(()=>!doc.getElementById('civic-panel')!.hidden&&!doc.querySelector<HTMLButtonElement>('#civic-panel form button')!.disabled);doc.getElementById('game-phone')!.click();doc.querySelector<HTMLButtonElement>('[data-game-page=phone] [data-game-menu=civic]')!.click();return dom;}
 const a=await browser('civic-ui-0'),b=await browser('civic-ui-1'),da=a.window.document,db=b.window.document;
 const card=(doc:Document,text:string)=>[...doc.querySelectorAll<HTMLElement>('#civic-panel article')].find(a=>a.querySelector('h3')!.textContent!.includes(text))!;
 const button=(root:HTMLElement,text:string)=>[...root.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent===text)!;
 drop=true;(da.getElementById('civic-consent') as HTMLInputElement).checked=true;da.querySelector<HTMLFormElement>('#civic-panel form')!.requestSubmit();await waitFor(()=>!da.getElementById('retry-panel')!.hidden);assert.equal(Object.values(store.snapshot().civic!.petitions).filter(p=>p.topic==='roads').length,1);
 (da.getElementById('retry') as HTMLButtonElement).click();await waitFor(()=>da.getElementById('retry-panel')!.hidden&&!!card(da,'road maintenance')&&!!card(db,'road maintenance'));assert.equal(Object.values(store.snapshot().civic!.petitions).filter(p=>p.topic==='roads').length,1);
 const roadB=card(db,'road maintenance');roadB.querySelector<HTMLInputElement>('input')!.checked=true;button(roadB,'Record support').click();await waitFor(()=>card(da,'road maintenance').textContent!.includes('2/10 supporters')&&!button(card(db,'road maintenance'),'Withdraw my support').disabled);
 button(card(db,'road maintenance'),'Withdraw my support').click();await waitFor(()=>card(da,'road maintenance').textContent!.includes('1/10 supporters'));
 button(card(da,'water provision'),'Request NPC consideration').click();await waitFor(()=>card(da,'water provision').textContent!.includes('No funds were spent.')&&card(db,'water provision').textContent!.includes('No funds were spent.'));assert.equal(store.snapshot().civic!.petitions[waterId].review!.outcome,'funding-proposal-required');
 const topic=da.getElementById('civic-topic')!;topic.focus();const cursor=store.snapshot().outbox.length;clock+=10000;
 for(const [dom,actor] of [[a,'civic-ui-0'],[b,'civic-ui-1']] as const){const fence=(dom.window as unknown as {WorldSync:{fence:()=>ClientFence}}).WorldSync.fence();await store.renewClient(actor,actor+'-session',fence,clock);}
 await waitFor(()=>card(da,'housing conditions').textContent!.includes('expired')&&card(db,'housing conditions').textContent!.includes('expired'));assert.equal(store.snapshot().outbox.length,cursor);assert.equal(da.activeElement,topic);assert.equal(button(card(da,'housing conditions'),'Record support').hidden,true);
 const publicHTML=db.getElementById('civic-panel')!.innerHTML;assert.ok(!publicHTML.includes('civic-ui-0'));assert.ok(!publicHTML.includes('members'));assert.ok(!publicHTML.includes('sourceKey'));
 await store.revokeSession('civic-ui-1','civic-ui-1-session');await waitFor(()=>db.getElementById('civic-panel')!.childElementCount===0);assert.deepEqual(errors,[]);
});
