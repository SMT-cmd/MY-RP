import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {JSDOM,VirtualConsole} from 'jsdom';
import {WorldStore} from '../src/store.ts';
import {createApp} from '../src/http.ts';
import {DomainError,RULES} from '../src/domain.ts';
const waitFor=async(check:()=>boolean)=>{for(let i=0;i<600;i++){if(check())return;await new Promise(r=>setTimeout(r,10));}throw Error('Playing interface did not settle');};
type GameUI={open:(page:string)=>void;close:()=>void;reset:()=>void;blocksMovement:()=>boolean};

test('world-first panels stop held input, retain uncertain transactions and clear private HUD on revocation',async t=>{
 const store=await WorldStore.open(),actor='world-ui';let clock=Date.now(),drop=false,denied=false;
 await store.dispatch(actor,{id:'create_world_ui',type:'CreateCitizen',payload:{name:'World Resident',state:'Lagos',adultConfirmed:true}},clock);
 const server=createApp({store,clock:()=>clock,authenticate:async req=>{if(denied||req.headers['x-development-key']!=='world-ui-key')throw new DomainError('AUTH_REQUIRED','Sign in again.',401);return{actorId:actor,sessionId:'world-ui-session',assurance:'aal1'};}});
 await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise<void>(r=>server.close(()=>r())));
 const a=server.address();if(!a||typeof a==='string')throw Error();const origin='http://127.0.0.1:'+a.port,errors:unknown[]=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e));
 const dom=await JSDOM.fromURL(origin,{resources:'usable',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){
  Object.defineProperty(w.crypto,'randomUUID',{value:randomUUID});w.AbortSignal=AbortSignal as typeof w.AbortSignal;w.localStorage.setItem('simulator-data-saver','1');
  Object.defineProperty(w,'innerWidth',{value:390,writable:true});Object.defineProperty(w,'innerHeight',{value:844,writable:true});
  w.fetch=async(url,options)=>{clock+=700;const response=await fetch(new URL(String(url),origin),options);if(drop&&String(url)==='/api/commands'){drop=false;await response.text();throw Error('Committed response lost');}return response;};
 }});t.after(()=>dom.window.close());const w=dom.window,d=w.document,el=(id:string)=>d.getElementById(id)!;
 await waitFor(()=>d.readyState==='complete');(el('access-key') as HTMLInputElement).value='world-ui-key';(el('access-form') as HTMLFormElement).requestSubmit();
 await waitFor(()=>d.body.classList.contains('is-playing')&&!(el('refresh') as HTMLButtonElement).disabled);
 assert.equal(el('game-stage').hidden,false);assert.equal(el('game-drawer').hidden,true);assert.equal(el('game-name').textContent,'World Resident');assert.equal(el('world-canvas').hidden,false);
 assert.equal(el('game-rotate').hidden,false);el('game-rotate-dismiss').click();assert.equal(el('game-rotate').hidden,true);
 assert.ok(el('school-title').closest('[data-game-page="learn"]'));assert.ok(el('world-canvas').closest('#game-world'));assert.equal(el('world-controls').hidden,false);
 const before=store.snapshot().outbox.length;
 w.document.dispatchEvent(new w.KeyboardEvent('keydown',{key:'d',bubbles:true}));await waitFor(()=>store.snapshot().outbox.length>before&&!(el('refresh') as HTMLButtonElement).disabled);
 const moved=store.snapshot().world!.positions[actor].x;el('game-phone').click();assert.equal(el('game-drawer').hidden,false);assert.equal(d.activeElement?.id,'game-drawer-close');
 w.document.dispatchEvent(new w.KeyboardEvent('keydown',{key:'a',bubbles:true}));await new Promise(r=>setTimeout(r,760));assert.equal(store.snapshot().world!.positions[actor].x,moved,'opening a menu must cancel held walking');
 w.document.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert.equal(el('game-drawer').hidden,true);assert.equal(d.activeElement?.id,'game-phone');
 w.dispatchEvent(new w.Event('orientationchange'));await new Promise(r=>setTimeout(r,710));assert.equal(store.snapshot().world!.positions[actor].x,moved,'rotation must not resume the old input');
 const ui=(w as unknown as {GameUI:GameUI}).GameUI;
 drop=true;w.document.dispatchEvent(new w.KeyboardEvent('keydown',{key:'d',bubbles:true}));await waitFor(()=>!el('retry-panel').hidden);const uncertainX=store.snapshot().world!.positions[actor].x;
 el('retry').click();await waitFor(()=>el('retry-panel').hidden);await new Promise(r=>setTimeout(r,760));assert.equal(store.snapshot().world!.positions[actor].x,uncertainX,'recovering a lost movement receipt must not resume held input');
 ui.open('work');drop=true;el('meal').click();await waitFor(()=>!el('retry-panel').hidden);
 const pending=w.sessionStorage.getItem('simulator-pending');assert.ok(pending);assert.ok(el('retry-panel').closest('#game-alerts'));assert.equal(store.snapshot().balances['citizen:'+actor],RULES.starterCash-RULES.basicMealCost);
 assert.equal((el('game-drawer-close') as HTMLButtonElement).disabled,false);el('game-drawer-close').click();el('game-phone').click();assert.equal(el('game-drawer').hidden,false);
 assert.equal(w.sessionStorage.getItem('simulator-pending'),pending);el('retry').click();await waitFor(()=>el('retry-panel').hidden);assert.equal(store.snapshot().balances['citizen:'+actor],RULES.starterCash-RULES.basicMealCost);
 const mutations=store.snapshot().outbox.length;
 Object.defineProperty(el('game-stage'),'requestFullscreen',{value:async()=>{throw Error('Denied');},configurable:true});el('game-fullscreen').click();await waitFor(()=>el('game-display-status').textContent!.includes('unavailable'));assert.equal(store.snapshot().outbox.length,mutations);
 denied=true;ui.open('settings');el('refresh').click();await waitFor(()=>!d.body.classList.contains('is-playing'));
 assert.equal(el('game-name').textContent,'');assert.equal(el('game-wallet').textContent,'');assert.equal(el('game-context-actions').childElementCount,0);assert.equal(el('game-stage').hidden,true);assert.ok(!el('notice').closest('#game-stage'));assert.deepEqual(errors,[]);
});

test('confirmed school entry opens its app; home walking and wardrobe remain physical authoritative actions',async t=>{
 const store=await WorldStore.open(),actor='context-ui';let clock=1000,seq=0;
 const setup=(type:string,payload:Record<string,unknown>)=>store.dispatch(actor,{id:'context_setup_'+ ++seq,type,payload},clock+=700);
 await setup('CreateCitizen',{name:'Context Resident',state:'Lagos',adultConfirmed:true});
 for(let i=0;i<3;i++)await setup('MoveCitizen',{dx:1,dy:0}); // (10,7), within range of the school entrance.
 const wallStart=Date.now();const server=createApp({store,clock:()=>clock+Date.now()-wallStart,authenticate:async()=>({actorId:actor,sessionId:'context-ui-session',assurance:'aal1'})});await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise<void>(r=>server.close(()=>r())));const a=server.address();if(!a||typeof a==='string')throw Error();const origin='http://127.0.0.1:'+a.port,errors:unknown[]=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e));
 const dom=await JSDOM.fromURL(origin,{resources:'usable',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){Object.defineProperty(w.crypto,'randomUUID',{value:randomUUID});w.AbortSignal=AbortSignal as typeof w.AbortSignal;w.localStorage.setItem('simulator-data-saver','1');w.fetch=(url,options)=>{clock+=700;return fetch(new URL(String(url),origin),options);};}});t.after(()=>dom.window.close());const w=dom.window,d=w.document,el=(id:string)=>d.getElementById(id)!,button=(label:string)=>[...d.querySelectorAll<HTMLButtonElement>('#world-interactions button')].find(b=>b.textContent===label);
 await waitFor(()=>d.readyState==='complete');(el('access-key') as HTMLInputElement).value='context-key';(el('access-form') as HTMLFormElement).requestSubmit();await waitFor(()=>button('Enter Foundation school')?.disabled===false);
 button('Enter Foundation school')!.click();await waitFor(()=>store.snapshot().world!.positions[actor].interior==='school'&&!(el('refresh') as HTMLButtonElement).disabled);assert.equal(el('game-drawer').hidden,true,'Physical school entry keeps its room visible');assert.equal(store.snapshot().world!.positions[actor].interior,'school');
 button('Exit to the city')!.click();await waitFor(()=>el('game-drawer').hidden&&!(el('refresh') as HTMLButtonElement).disabled);
 const ui=(w as unknown as {GameUI:GameUI}).GameUI;ui.open('map');const visit=[...d.querySelectorAll<HTMLButtonElement>('#world-navigation button')].find(b=>b.textContent==='Visit Starter shelter')!;visit.click();await waitFor(()=>store.snapshot().world!.positions[actor].interior==='shelter'&&button('Exit to the city')?.disabled===false);
 assert.equal(el('world-controls').hidden,false);const homeId=store.snapshot().world!.positions[actor].homeId!;assert.ok(store.snapshot().furnishing!.homes[homeId]);
 const home=store.snapshot().world!.positions[actor];assert.ok(home.homeId);assert.equal(el('game-drawer').hidden,true);
 const beforeY=store.snapshot().world!.positions[actor].interiorY!;const north=d.querySelector<HTMLButtonElement>('#world-controls [data-dy="-1"]')!;north.click();await waitFor(()=>!(el('refresh') as HTMLButtonElement).disabled&&store.snapshot().world!.positions[actor].interiorY===beforeY-1);
 const wardrobe=[...d.querySelectorAll<HTMLButtonElement>('#world-interactions button')].find(b=>b.textContent!.includes('Use wardrobe'))!;
 // Walk to the wardrobe through the same scene event used by a graphical selection.
 const view=await (await fetch(origin+'/api/citizen')).json();const fixture=view.world.home.fixtures.find((f:{action:string})=>f.action==='Dress');
 w.dispatchEvent(new w.CustomEvent('home-fixture-select',{detail:{fixtureId:fixture.id,homeId:view.world.home.id,leaseVersion:view.world.position.leaseVersion}}));
 assert.equal(el('object-menu').hidden,false);([...el('object-menu').querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent!.includes('Change outfit'))!).click();
 await waitFor(()=>el('game-drawer-title').textContent==='Your wardrobe'&&d.activeElement?.id==='appearance-hair');assert.ok(wardrobe);
 ui.open('furnish');const choose=[...d.querySelectorAll<HTMLButtonElement>('#furnishing-records button')].find(b=>b.textContent==='Choose position on the floor')!;choose.click();
 const selected=d.querySelector<HTMLFormElement>('.furniture-selected')!,inputs=selected.querySelectorAll<HTMLInputElement>('input');inputs[0].value='5';inputs[0].dispatchEvent(new w.Event('change'));
 const revision=store.snapshot().outbox.length;w.dispatchEvent(new w.Event('resize'));w.dispatchEvent(new w.Event('orientationchange'));
 assert.equal(d.querySelector('.furniture-selected'),selected);assert.equal(inputs[0].value,'5');assert.equal(store.snapshot().outbox.length,revision,'rotation preserves an unsent draft without saving it');
 const formButton=[...selected.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent==='Cancel floor selection')!;formButton.click();
 let fullscreenRequests=0,lockCalls=0,exitCalls=0,fullElement:Element|null=null;
 Object.defineProperty(d,'fullscreenElement',{get:()=>fullElement,configurable:true});Object.defineProperty(el('game-stage'),'requestFullscreen',{value:async()=>{fullscreenRequests++;fullElement=el('game-stage');d.dispatchEvent(new w.Event('fullscreenchange'));},configurable:true});
 Object.defineProperty(d,'exitFullscreen',{value:async()=>{exitCalls++;fullElement=null;d.dispatchEvent(new w.Event('fullscreenchange'));},configurable:true});
 Object.defineProperty(w.screen,'orientation',{value:{lock:async(mode:string)=>{assert.equal(mode,'landscape');assert.equal(fullscreenRequests,1);lockCalls++;throw Error('Unsupported orientation');},unlock(){}},configurable:true});
 el('game-fullscreen').click();await waitFor(()=>el('game-display-status').textContent!.startsWith('Full screen opened'));assert.equal(lockCalls,1);assert.equal(store.snapshot().outbox.length,revision);
 el('game-fullscreen').click();await waitFor(()=>exitCalls===1);assert.equal(fullElement,null);assert.equal(el('game-display-status').textContent,'');assert.deepEqual(errors,[]);
});

test('light graphics keep rendering without importing WebGL; destroy invalidates a pending 3D load',async()=>{
 const dom=new JSDOM('<div id="world-canvas"></div><div id="notice"></div>',{runScripts:'outside-only'});
 try{
  const w=dom.window,calls:string[]=[];let destroyed=0;
  (w as unknown as {WorldRenderer:unknown}).WorldRenderer={update:async(_world:unknown,mode:string)=>{calls.push(mode);},destroy:()=>{destroyed++;}};
  Object.defineProperty(w,'WebGL2RenderingContext',{value:function(){}});Object.defineProperty(w,'ResizeObserver',{value:function(){}});
  w.eval(await readFile(new URL('../web/world-3d-controller.js',import.meta.url),'utf8'));
  const renderer=(w as unknown as {WorldRenderer:{update:(world:unknown,mode:string)=>Promise<void>;destroy:()=>void}}).WorldRenderer;
  await renderer.update({},'low');assert.deepEqual(calls,['low']);assert.equal(w.document.getElementById('world-canvas')!.hidden,false);
  const load=renderer.update({},'high');renderer.destroy();await load;assert.deepEqual(calls,['low'],'a late import failure must not restore the signed-out scene');assert.equal(destroyed,1);
 }finally{dom.window.close();}
});
