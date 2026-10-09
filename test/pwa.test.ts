import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createContext,runInContext} from 'node:vm';
import {JSDOM,VirtualConsole} from 'jsdom';
import {createApp} from '../src/http.ts';
import {WorldStore} from '../src/store.ts';

test('public-only worker caches bounded help, bypasses credentials and APIs, and never returns private state offline',async t=>{
 const store=await WorldStore.open(),server=createApp({store,authenticate:async()=>({actorId:'pwa-test',sessionId:'pwa-session',assurance:'aal1'})});
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise<void>(resolve=>server.close(()=>resolve())));
 const addr=server.address();if(!addr||typeof addr==='string')throw Error();const origin='http://127.0.0.1:'+addr.port;
 const response=await fetch(origin+'/sw.js'),source=await response.text();assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-cache');assert.equal(response.headers.get('service-worker-allowed'),'/');assert.match(source,/myrp-public-[a-f0-9]{64}/);assert.ok(!source.includes('__STATIC_VERSION__'));assert.equal(await (await fetch(origin+'/sw.js')).text(),source);
 const manifest=await (await fetch(origin+'/manifest.webmanifest')).json();assert.equal(manifest.display,'standalone');assert.equal(manifest.scope,'/');assert.equal(manifest.icons.length,2);
 for(const size of [192,512]){const icon=Buffer.from(await (await fetch(origin+'/app-icon-'+size+'.png')).arrayBuffer());assert.equal(icon.readUInt32BE(16),size);assert.equal(icon.readUInt32BE(20),size);}
 const handlers=new Map<string,(event:any)=>void>(),storage=new Map<string,Map<string,Response>>(),requests:Request[]=[];let offline=false,quota=false,privateResponse=false;
 const key=(path:string|Request)=>new URL(typeof path==='string'?path:path.url,origin).pathname;
 const caches={open:async(name:string)=>{if(!storage.has(name))storage.set(name,new Map());const cache=storage.get(name)!;return{put:async(path:string|Request,response:Response)=>{if(quota)throw Error('Cache full');cache.set(key(path),response.clone());},match:async(path:string|Request)=>cache.get(key(path))?.clone()};},keys:async()=>[...storage.keys()],delete:async(name:string)=>storage.delete(name)};
 const context=createContext({URL,Request,Response,Set,caches,self:{location:{origin},addEventListener:(type:string,handler:(event:any)=>void)=>handlers.set(type,handler)},fetch:async(input:Request)=>{requests.push(input);if(offline)throw Error('Network lost');if(privateResponse)return new Response('Private response',{headers:{'Cache-Control':'private'}});return fetch(input.url);}});runInContext(source,context);
 async function event(type:string,request?:unknown){let promise:Promise<unknown>|undefined;handlers.get(type)!({request,waitUntil:(p:Promise<unknown>)=>promise=p,respondWith:(p:Promise<unknown>)=>promise=p});return promise?await promise:undefined;}
 await event('install');const name=[...storage.keys()][0],cache=storage.get(name)!;assert.equal(cache.size,5);assert.ok([...cache.keys()].every(path=>!path.startsWith('/api/')&&path!=='/'));assert.ok(requests.every(req=>req.credentials==='omit'));
 storage.set('myrp-public-old',new Map());storage.set('other-app-cache',new Map());await event('activate');assert.equal(storage.has('myrp-public-old'),false);assert.equal(storage.has('other-app-cache'),true);
 const protectedRequests=[new Request(origin+'/api/citizen'),new Request(origin+'/api/recovery?after=0'),new Request(origin+'/api/commands',{method:'POST',body:'sensitive'}),new Request(origin+'/app.js',{headers:{Authorization:'Bearer private'}}),new Request(origin+'/style.css',{headers:{'x-development-key':'private'}}),new Request(origin+'/app.js?account=private'),new Request('https://other.invalid/app.js'),new Request(origin+'/unknown-private-resource')];
 for(const request of protectedRequests)assert.equal(await event('fetch',request),undefined);
 assert.equal((await event('fetch',new Request(origin+'/app.js')) as Response).status,200);assert.equal(cache.has('/app.js'),true);
 offline=true;assert.equal((await event('fetch',new Request(origin+'/app.js')) as Response).status,200);
 const page=await event('fetch',{url:origin+'/',method:'GET',mode:'navigate',headers:new Headers()}) as Response;assert.match(await page.text(),/public help only/);assert.equal(cache.has('/'),false);assert.equal(await event('fetch',new Request(origin+'/api/citizen')),undefined);
 offline=false;privateResponse=true;await event('fetch',new Request(origin+'/walking.js'));assert.equal(cache.has('/walking.js'),false);
 privateResponse=false;quota=true;assert.equal((await event('fetch',new Request(origin+'/world-sync.js')) as Response).status,200);assert.equal(cache.has('/world-sync.js'),false);
 await assert.rejects(event('install'),/Cache full/);assert.equal(storage.has(name),false);assert.equal(storage.has('other-app-cache'),true);
 assert.equal(store.snapshot().outbox.length,0);
});

test('PWA installation is explicit and an update never reloads or clears a pending command',async t=>{
 const errors:unknown[]=[],console=new VirtualConsole();console.on('jsdomError',error=>errors.push(error));
 const dom=new JSDOM('<p id="pwa-status"></p><button id="install-game" hidden>Install</button>',{url:'https://game.invalid',runScripts:'outside-only',virtualConsole:console});t.after(()=>dom.window.close());
 const window=dom.window,worker=new window.EventTarget() as EventTarget&{state:string},registration=new window.EventTarget() as EventTarget&{active:unknown;installing:typeof worker};worker.state='installing';registration.active=null;registration.installing=worker;
 let registered=0,prompted=0;Object.defineProperty(window,'isSecureContext',{value:true});Object.defineProperty(window.navigator,'serviceWorker',{value:{controller:{},register:async(url:string,options:unknown)=>{assert.equal(url,'/sw.js');assert.deepEqual(JSON.parse(JSON.stringify(options)),{scope:'/',updateViaCache:'none'});registered++;return registration;}}});
 window.sessionStorage.setItem('simulator-pending','uncertain-request');window.eval(await readFile(new URL('../web/pwa.js',import.meta.url),'utf8'));window.document.dispatchEvent(new window.Event('DOMContentLoaded'));await new Promise(resolve=>setTimeout(resolve,0));assert.equal(registered,1);assert.equal(prompted,0);
 const event=new window.Event('beforeinstallprompt',{cancelable:true}) as Event&{prompt:()=>Promise<void>;userChoice:Promise<{outcome:string}>};event.prompt=async()=>{prompted++;};event.userChoice=Promise.resolve({outcome:'dismissed'});window.dispatchEvent(event);assert.equal(event.defaultPrevented,true);
 const button=window.document.getElementById('install-game')!;assert.equal(button.hidden,false);button.click();await new Promise(resolve=>setTimeout(resolve,0));assert.equal(prompted,1);assert.equal(button.hidden,true);assert.match(window.document.getElementById('pwa-status')!.textContent!,/dismissed/);
 worker.state='installed';worker.dispatchEvent(new window.Event('statechange'));assert.match(window.document.getElementById('pwa-status')!.textContent!,/Finish pending actions/);assert.equal(window.sessionStorage.getItem('simulator-pending'),'uncertain-request');assert.deepEqual(errors,[]);
});
