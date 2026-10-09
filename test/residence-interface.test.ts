import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {JSDOM,VirtualConsole} from 'jsdom';
import {WorldStore} from '../src/store.ts';
import {createApp} from '../src/http.ts';
import {DomainError} from '../src/domain.ts';
const waitFor=async(check:()=>boolean)=>{for(let i=0;i<1000;i++){if(check())return;await new Promise(resolve=>setTimeout(resolve,10));}throw Error('Residence interface did not settle');};
test('accessible private-door navigation, garage controls and residence switching use real HTTP authority',async t=>{
 const store=await WorldStore.open(),actor='private-home-ui';let sequence=0,clock=1000;
 const dispatch=(type:string,payload:Record<string,unknown>={})=>store.dispatch(actor,{id:'home_ui_setup_'+ ++sequence,type,payload},clock+=700);
 await dispatch('CreateCitizen',{name:'Home Resident',state:'Lagos',adultConfirmed:true});const purchase=await dispatch('ReservePropertyPurchase',{propertyId:'npc-Lagos-home',acceptedTotal:512500,acceptTerms:true});await dispatch('CompletePropertyPurchase',{purchaseId:purchase.receipt.detail.purchaseId});
 for(let i=0;i<19;i++)await dispatch('MoveCitizen',{dx:1,dy:0}); // (26,7), two moves from the door range.
 const car=await dispatch('BuyNPCVehicle',{modelId:'compact',acceptedPrice:300000,acceptTerms:true});
 const server=createApp({store,clock:()=>clock,authenticate:async req=>{if(req.headers['x-development-key']!=='residence_ui_key')throw new DomainError('AUTH_REQUIRED','Sign in.',401);return{actorId:actor,sessionId:'residence-ui-session',assurance:'aal1'};}});await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise<void>(resolve=>server.close(()=>resolve())));const a=server.address();if(!a||typeof a==='string')throw Error();const origin='http://127.0.0.1:'+a.port,errors:unknown[]=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e));
 const dom=await JSDOM.fromURL(origin,{runScripts:'dangerously',resources:'usable',pretendToBeVisual:true,virtualConsole:vc,beforeParse(window){Object.defineProperty(window.crypto,'randomUUID',{value:randomUUID});window.AbortSignal=AbortSignal as typeof window.AbortSignal;window.fetch=(url,options)=>{clock+=700;return fetch(new URL(String(url),origin),options);};}});t.after(()=>dom.window.close());const doc=dom.window.document;if(doc.readyState!=='complete')await new Promise<void>(resolve=>dom.window.addEventListener('load',()=>resolve(),{once:true}));(doc.getElementById('access-key') as HTMLInputElement).value='residence_ui_key';(doc.getElementById('access-form') as HTMLFormElement).requestSubmit();await waitFor(()=>!(doc.getElementById('citizen-panel') as HTMLElement).hidden);
 const button=(root:string,label:string)=>[...doc.querySelectorAll<HTMLButtonElement>(root+' button')].find(b=>b.textContent===label)!;
 assert.equal(button('#world-navigation','Visit Starter shelter'),undefined);assert.ok(button('#world-navigation','Visit Your home'));assert.match(doc.getElementById('furnishing-records')!.textContent!,/1 Market Lane/);
 button('#world-navigation','Visit Your home').click();await waitFor(()=>store.snapshot().world!.positions[actor].homeId==='npc-Lagos-home'&&!button('#world-interactions','Exit to the city').disabled);assert.match(doc.getElementById('world-location')!.textContent!,/Inside Your home · 1 Market Lane/);
 button('#world-interactions','Exit to the city').click();await waitFor(()=>store.snapshot().world!.positions[actor].interior===null&&!(doc.getElementById('refresh') as HTMLButtonElement).disabled);
 const garage=button('#furnishing-records','Park compact in space 2');assert.equal(garage.disabled,false);garage.click();await waitFor(()=>Object.values(store.snapshot().furnishing!.parking).some(p=>p.vehicleId===car.receipt.detail.vehicleId&&p.status==='parked')&&!(doc.getElementById('refresh') as HTMLButtonElement).disabled);
 button('#property-records','Accept moving terms and use starter accommodation').click();await waitFor(()=>store.snapshot().citizens[actor].housing==='Starter accommodation'&&!(doc.getElementById('refresh') as HTMLButtonElement).disabled);assert.ok(button('#world-navigation','Visit Starter shelter'));assert.equal(Object.values(store.snapshot().furnishing!.parking)[0].status,'released');assert.equal(store.snapshot().property!.assets['npc-Lagos-home'].owner,actor);assert.deepEqual(errors,[]);
});
