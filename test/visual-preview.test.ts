import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { JSDOM, VirtualConsole } from 'jsdom';
import { CORE_MAP as MAP, BUILDINGS } from '../src/world.ts';
import {STARTER_HOME} from '../src/interiors.ts';
import { REGIONS } from '../src/geography.ts';

const root=new URL('../demo/',import.meta.url);
const html=await readFile(new URL('preview.html',root),'utf8');
const layout=JSON.parse(await readFile(new URL('world-layout.json',root),'utf8'));
const wait=(ms=10)=>new Promise(resolve=>setTimeout(resolve,ms));
function browser(saved?:string){
 const errors:unknown[]=[];
 const console=new VirtualConsole();console.on('jsdomError',error=>errors.push(error));
 const dom=new JSDOM(html,{url:'http://localhost/',runScripts:'dangerously',virtualConsole:console,beforeParse(window){
  // JSDOM is a DOM test runner, not browser rendering. Polyfill its absent
  // native modal behaviour and accelerate walking without changing the path.
  window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
  window.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new window.Event('close'));};
  const timeout=window.setTimeout.bind(window);window.setTimeout=((fn:TimerHandler,ms?:number,...args:unknown[])=>timeout(fn,Math.min(ms??0,1),...args)) as typeof window.setTimeout;
  if(saved)window.localStorage.setItem('my-rp-visual-preview-v1',saved);
 }});
 const click=(selector:string)=>{const node=dom.window.document.querySelector<HTMLElement>(selector);assert.ok(node,selector);node.dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true}));};
 const key=(key:string)=>dom.window.document.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key,bubbles:true}));
 const text=()=>dom.window.document.body.textContent??'';
 const travel=async(id:string)=>{click(`[data-place="${id}"]`);for(let i=0;i<100;i++){await wait(2);if(!dom.window.document.getElementById('interact-button')!.hasAttribute('disabled'))break;}key('e');};
 return {dom,errors,click,key,text,travel};
}
test('frozen visual preview preserves original service entrances and all region labels',()=>{
 assert.equal(layout.width,MAP.width);assert.equal(layout.height,MAP.height);
 assert.deepEqual(layout.buildings,BUILDINGS);assert.deepEqual(layout.guide,MAP.guide);
 assert.deepEqual(layout.regions,REGIONS.map(({name,capital})=>({name,capital})));
 assert.ok(Buffer.byteLength(html)<200_000);
 assert.ok(!/<script[^>]+src=|<link[^>]+href=|<img[^>]+src="https?:/.test(html));
});
test('preview completes its local first-day flow once, retries tasks, and reloads sample receipts',async()=>{
 const b=browser();
 try {
  b.key('e');assert.match(b.text(),/Welcome, Timi/);b.click('[data-action="go-home"]');
  await wait(40);b.key('e');assert.equal(b.dom.window.document.getElementById('home-layer')!.hasAttribute('hidden'),false);b.click('[data-furniture="bed"]');await wait(30);b.key('e');assert.match(b.text(),/Your bed/);b.click('[data-action="rest"]');
  b.click('#wallet-button');assert.match(b.text(),/DEMO-START-001/);b.click('#close-phone');
  await b.travel('school');b.click('[data-action="lesson"]');b.click('[data-action="lesson-retry"]');
  assert.match(b.text(),/Basic starter work does not require/);b.click('[data-action="lesson-correct"]');b.click('#close-dialog');
  await b.travel('work');b.click('[data-action="start-task"]');b.click('[data-answer="1"]');assert.match(b.text(),/Try again/);
  b.click('[data-answer="0"]');b.click('[data-answer="1"]');b.click('[data-answer="2"]');assert.match(b.text(),/DEMO-SHIFT-001/);
  b.click('[data-action="bank"]');assert.equal(b.dom.window.document.getElementById('balance')!.textContent,'₦20,250');
  assert.equal(b.dom.window.document.getElementById('quest-count')!.textContent,'5 of 5 steps');
  const saved=b.dom.window.localStorage.getItem('my-rp-visual-preview-v1')!;
  const reloaded=browser(saved);
  try {
   assert.equal(reloaded.dom.window.document.getElementById('balance')!.textContent,'₦20,250');
   await reloaded.travel('work');assert.match(reloaded.text(),/Your first wage is in/);
   assert.equal(reloaded.dom.window.document.querySelector('[data-action="start-task"]'),null);
   reloaded.click('[data-action="bank"]');assert.equal(reloaded.dom.window.document.querySelectorAll('.receipt-list li').length,2);
   assert.deepEqual(reloaded.errors,[]);
  }finally{reloaded.dom.window.close();}
  assert.deepEqual(b.errors,[]);
 }finally{b.dom.window.close();}
});
test('preview sample purchase requires review, settles once, and reset is scoped locally',async()=>{
 const b=browser();
 try {
  await b.travel('market');b.click('[data-action="buy-meal"]');
  assert.equal(b.dom.window.document.getElementById('balance')!.textContent,'₦20,000');
  b.click('[data-action="confirm-meal"]');assert.equal(b.dom.window.document.getElementById('balance')!.textContent,'₦19,200');
  b.click('[data-action="bank"]');assert.match(b.text(),/DEMO-MEAL-001/);b.click('#close-phone');
  await b.travel('market');assert.equal(b.dom.window.document.querySelector<HTMLButtonElement>('[data-action="buy-meal"]')!.disabled,true);b.click('#close-dialog');
  b.click('#settings-button');b.click('[data-action="reset-review"]');assert.equal(b.dom.window.document.getElementById('balance')!.textContent,'₦19,200');
  b.click('[data-action="reset-confirm"]');assert.equal(b.dom.window.document.getElementById('balance')!.textContent,'₦20,000');
  assert.equal(b.dom.window.document.getElementById('quest-count')!.textContent,'0 of 5 steps');assert.deepEqual(b.errors,[]);
 }finally{b.dom.window.close();}
});
test('preview rejects corrupted local positions, checks collision and keyboard modal isolation',()=>{
 const b=browser(JSON.stringify({version:1,x:4,y:4,region:'Made up',shift:'yes'}));
 try {
  assert.match(b.dom.window.document.getElementById('region-label')!.textContent!,/Lagos/);
  const start=b.dom.window.document.getElementById('player')!.getAttribute('transform');
  b.key('p');b.key('ArrowUp');assert.equal(b.dom.window.document.getElementById('player')!.getAttribute('transform'),start);
  b.key('Escape');b.key('ArrowLeft');b.key('ArrowUp');b.key('ArrowLeft');
  const valid=b.dom.window.document.getElementById('player')!.getAttribute('transform');b.key('ArrowUp');
  assert.equal(b.dom.window.document.getElementById('player')!.getAttribute('transform'),valid);
  assert.match(b.text(),/building is in the way/);assert.deepEqual(b.errors,[]);
 }finally{b.dom.window.close();}
});
test('preview host serves only public artefacts, rejects commands and sends matching CSP hashes',async()=>{
 const {createPreviewServer}=await import(new URL('server.mjs',root).href);
 const server=await createPreviewServer();await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
 const address=server.address();const url=`http://127.0.0.1:${address.port}`;
 try {
  const res=await fetch(url);assert.equal(res.status,200);assert.equal(await res.text(),html);
  const csp=res.headers.get('content-security-policy')!;
  for(const tag of ['script','style']){const content=html.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`))![1];assert.ok(csp.includes(createHash('sha256').update(content).digest('base64')));}
  assert.ok(csp.includes("frame-ancestors 'none'"));
  assert.equal(res.headers.get('permissions-policy'),'camera=(), microphone=(), geolocation=(), payment=()');
  assert.deepEqual(await (await fetch(url+'/healthz')).json(),{status:'ok',mode:'visual-preview'});
  for(const path of ['/api/citizen','/api/config','/src/server.ts','/demo/security.json','/.data/world.json','/../package.json'])assert.equal((await fetch(url+path)).status,404);
  assert.equal((await fetch(url+'/api/commands',{method:'POST',body:'{}'})).status,405);
  assert.equal((await fetch(url,{method:'HEAD'})).status,200);
 }finally{await new Promise<void>((resolve,reject)=>server.close((error:Error|undefined)=>error?reject(error):resolve()));}
});

test('preview enters a collision-aware furnished home, faces movement and reloads inside without moving the street position',async()=>{
 const b=browser();try{
  await b.travel('shelter');const street=JSON.parse(b.dom.window.localStorage.getItem('my-rp-visual-preview-v1')!);
  assert.equal(street.interior,'shelter');assert.deepEqual([street.roomX,street.roomY],[4,6]);
  assert.deepEqual(JSON.parse(await readFile(new URL('home-layout.json',root),'utf8')),STARTER_HOME);
  b.key('ArrowUp');assert.equal(b.dom.window.document.getElementById('player')!.getAttribute('data-facing'),'back');
  b.key('ArrowRight');assert.equal(b.dom.window.document.getElementById('player')!.getAttribute('data-facing'),'right');
  b.key('ArrowDown');b.key('ArrowLeft');assert.equal(b.dom.window.document.getElementById('player')!.getAttribute('data-facing'),'left');
  b.click('[data-furniture="desk"]');await wait(40);b.key('e');assert.match(b.text(),/Your book is open/);b.click('#close-dialog');
  const saved=b.dom.window.localStorage.getItem('my-rp-visual-preview-v1')!,reloaded=browser(saved);
  try{assert.equal(reloaded.dom.window.document.getElementById('city-layer')!.hasAttribute('hidden'),true);assert.equal(reloaded.dom.window.document.getElementById('home-exit')!.hidden,false);reloaded.click('#home-exit');const outside=JSON.parse(reloaded.dom.window.localStorage.getItem('my-rp-visual-preview-v1')!);assert.equal(outside.interior,null);assert.deepEqual([outside.x,outside.y],[street.x,street.y]);assert.deepEqual(reloaded.errors,[]);}finally{reloaded.dom.window.close();}
  assert.deepEqual(b.errors,[]);
 }finally{b.dom.window.close();}
});
test('preview camera pans and zooms independently of player motion; connected streets are reachable',async()=>{
 const b=browser();try{
  const svg=b.dom.window.document.getElementById('world-scene')!,initial=svg.getAttribute('viewBox'),position=b.dom.window.document.getElementById('player')!.getAttribute('transform');
  svg.dispatchEvent(new b.dom.window.WheelEvent('wheel',{deltaY:90,bubbles:true,cancelable:true}));assert.notEqual(svg.getAttribute('viewBox'),initial);assert.equal(b.dom.window.document.getElementById('player')!.getAttribute('transform'),position);assert.equal(b.dom.window.document.getElementById('follow-camera')!.getAttribute('aria-pressed'),'false');
  b.click('#zoom-in');assert.equal(b.dom.window.document.getElementById('zoom-label')!.textContent,'120%');b.click('#follow-camera');assert.equal(b.dom.window.document.getElementById('follow-camera')!.getAttribute('aria-pressed'),'true');
  b.click('#map-button');b.click('[data-walk="west"]');await wait(150);const s=JSON.parse(b.dom.window.localStorage.getItem('my-rp-visual-preview-v1')!);assert.equal(s.x,-7);assert.equal(s.y,7);assert.deepEqual(b.errors,[]);
 }finally{b.dom.window.close();}
});
