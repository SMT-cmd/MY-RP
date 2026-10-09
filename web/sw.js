/* The server injects a content-derived version and exact public asset allowlist. */
const CACHE='myrp-public-__STATIC_VERSION__';
const PUBLIC=new Set(__PUBLIC_ASSETS__);
const SHELL=['/offline.html','/style.css','/favicon.svg','/app-icon-192.png','/app-icon-512.png'];
const publicRequest=path=>new Request(new URL(path,self.location.origin),{credentials:'omit',cache:'no-store'});
const acceptable=response=>response.status===200&&!response.redirected&&['basic','default'].includes(response.type)&&!/(?:^|,)\s*private\b/i.test(response.headers.get('cache-control')??'');
self.addEventListener('install',event=>event.waitUntil((async()=>{
 const cache=await caches.open(CACHE);
 try{for(const path of SHELL){const response=await fetch(publicRequest(path));if(!acceptable(response))throw Error('Public offline shell unavailable');await cache.put(path,response);}}
 catch(error){await caches.delete(CACHE);throw error;}
 // Updates wait for old tabs to close. Never reload an uncertain action automatically.
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
 for(const key of await caches.keys())if(key.startsWith('myrp-public-')&&key!==CACHE)await caches.delete(key);
})()));
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==self.location.origin||url.search||url.username||url.password||url.pathname.startsWith('/api/')||request.headers.has('authorization')||request.headers.has('x-development-key'))return;
 if(request.mode==='navigate'){
  event.respondWith((async()=>{try{return await fetch(request);}catch{const cache=await caches.open(CACHE);return await cache.match('/offline.html')??new Response('Connection unavailable. Reconnect to recover saved actions.',{status:503,headers:{'Content-Type':'text/plain','Cache-Control':'no-store'}});}})());return;
 }
 if(!PUBLIC.has(url.pathname))return;
 event.respondWith((async()=>{
  const cache=await caches.open(CACHE);
  try{const response=await fetch(publicRequest(url.pathname));if(acceptable(response)){try{await cache.put(url.pathname,response.clone());}catch{/* Storage limits must not block the live public asset. */}}return response;}
  catch{const saved=await cache.match(url.pathname);if(saved)return saved;return new Response('Public asset unavailable.',{status:503,headers:{'Cache-Control':'no-store'}});}
 })());
});
