import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {WebSocket} from 'ws';
import {JSDOM,VirtualConsole} from 'jsdom';
import {WorldStore} from '../src/store.ts';
import {createApp} from '../src/http.ts';
import {DomainError} from '../src/domain.ts';
import {neighbourAt} from '../src/neighbours.ts';
const waitFor=async(fn:()=>boolean)=>{for(let i=0;i<700;i++){if(fn())return;await new Promise(r=>setTimeout(r,10));}throw Error('NPC interface timeout');};
test('authenticated NPC controls recover a lost conversation, update idle walking without business writes, preserve keyboard focus and clear after revocation',async t=>{
 const store=await WorldStore.open(),sockets:WebSocket[]=[],errors:unknown[]=[];let clock=20000,drop=false,sequence=0;
 await store.dispatch('npc-ui',{id:'npc_ui_create',type:'CreateCitizen',payload:{name:'Ada',state:'Lagos',adultConfirmed:true}},100);
 const initial=neighbourAt(store.snapshot(),'Lagos',0,clock);let p=store.snapshot().world!.positions['npc-ui'],at=1000;
 while(p.x!==initial.x||p.y!==initial.y){const dx=Math.sign(initial.x-p.x),dy=dx?0:Math.sign(initial.y-p.y);await store.dispatch('npc-ui',{id:'npc_ui_move_'+ ++sequence,type:'MoveCitizen',payload:{dx,dy}},at+=500);p=store.snapshot().world!.positions['npc-ui'];}
 const server=createApp({store,multiplayer:true,clock:()=>clock,authenticate:async req=>{if(req.headers['x-development-key']!=='npc-ui')throw new DomainError('AUTH_REQUIRED','Sign in.',401);return{actorId:'npc-ui',sessionId:'npc-ui-session',assurance:'aal1'};}});
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const address=server.address();if(!address||typeof address==='string')throw Error();const origin='http://127.0.0.1:'+address.port;
 const vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e));
 const dom=await JSDOM.fromURL(origin,{resources:'usable',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,beforeParse(window){
  window.localStorage.setItem('simulator-data-saver','1');Object.defineProperty(window.crypto,'randomUUID',{value:randomUUID});window.AbortSignal=AbortSignal as typeof window.AbortSignal;
  window.WebSocket=class extends WebSocket{constructor(url:string|URL){super(String(url),{origin});sockets.push(this);}} as unknown as typeof window.WebSocket;
  window.fetch=async(input,init)=>{const response=await fetch(new URL(String(input),origin),init);if(drop&&String(input)==='/api/commands'&&String(init?.body).includes('TalkToNeighbour')){drop=false;await response.text();throw new TypeError('Lost NPC response');}return response;};
 }});
 t.after(async()=>{dom.window.close();sockets.forEach(s=>s.terminate());await new Promise<void>(resolve=>server.close(()=>resolve()));});const doc=dom.window.document;
 if(doc.readyState!=='complete')await new Promise<void>(resolve=>dom.window.addEventListener('load',()=>resolve(),{once:true}));(doc.getElementById('access-key') as HTMLInputElement).value='npc-ui';(doc.getElementById('access-form') as HTMLFormElement).requestSubmit();
 const card=()=>[...doc.querySelectorAll<HTMLElement>('#world-npcs article')].find(a=>a.querySelector('h3')!.textContent!.includes('Market assistant'))!;
 await waitFor(()=>!!card()&&!card().querySelectorAll<HTMLButtonElement>('button')[1].disabled);
 drop=true;card().querySelectorAll<HTMLButtonElement>('button')[1].click();await waitFor(()=>!(doc.getElementById('retry-panel') as HTMLElement).hidden);assert.equal(Object.values(store.snapshot().neighbours!.conversations)[0].count,1);
 (doc.getElementById('retry') as HTMLButtonElement).click();await waitFor(()=>(doc.getElementById('retry-panel') as HTMLElement).hidden&&card().textContent!.includes('Conversations together: 1'));assert.equal(Object.values(store.snapshot().neighbours!.conversations)[0].count,1);assert.match(doc.getElementById('notice')!.textContent!,/original receipt/);
 const button=card().querySelector<HTMLButtonElement>('button')!;button.focus();const oldPosition=card().querySelector('p')!.textContent,commands=Object.keys(store.snapshot().commands).length,outbox=store.snapshot().outbox.length;
 let target=clock;for(let i=1;i<180;i++){const n=neighbourAt(store.snapshot(),'Lagos',0,20000+i*1500);if(n.x!==initial.x){target=20000+i*1500;break;}}
 const fence=(dom.window as unknown as {WorldSync:{fence:()=>import('../src/sessions.ts').ClientFence}}).WorldSync.fence();
 while(clock<target){clock=Math.min(target,clock+5000);await store.renewClient('npc-ui','npc-ui-session',fence,clock);}
 await waitFor(()=>!!card()&&card().querySelector('p')!.textContent!==oldPosition);assert.equal(doc.activeElement,button);assert.equal(Object.keys(store.snapshot().commands).length,commands);assert.equal(store.snapshot().outbox.length,outbox);
 await store.revokeSession('npc-ui','npc-ui-session');await waitFor(()=>doc.getElementById('world-npcs')!.childElementCount===0);assert.deepEqual(errors,[]);
});
