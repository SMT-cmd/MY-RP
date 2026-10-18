import {AccountRateLimitError} from './account.ts';
import {readRefreshCookie,refreshCookie} from './account-cookie.ts';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import {readFileSync} from 'node:fs';
import { DomainError, citizenView } from './domain.ts';
import type { Command, Receipt, State } from './domain.ts';
import type { Identity } from './auth.ts';
import type { AccountGateway, AccountAction } from './account.ts';
import type { IncomingMessage } from 'node:http';
import {SESSION_RULES} from './sessions.ts';
import type {ClientFence,DispatchContext} from './sessions.ts';
import {nearbyPresence,recoveryCursor} from './presence.ts';
import {attachRealtime,liveStore} from './realtime.ts';
import {adminAccess,adminView,isAdminCommand,ownStaffReceipt} from './admin.ts';
import type {MFAGateway,MFAAction} from './mfa.ts';
import {publicCitizenReceipt} from './public-receipts.ts';

export interface CommandStore {
  revokeSession?(actorId:string,sessionId:string):Promise<void>;
  snapshot(actorId?: string, sessionId?: string): State | Promise<State>;
  dispatch(actorId: string, command: Command, now?: number, sessionId?: string,context?:DispatchContext): Promise<{ receipt: Receipt; replayed: boolean; state?:State }>;
  claimClient?(actorId:string,sessionId:string,clientId:unknown,takeover:unknown,now?:number):Promise<{clientLease:ClientFence;expiresAt:number;heartbeat:number}>;
  renewClient?(actorId:string,sessionId:string,fence:ClientFence,now?:number):Promise<{clientLease:ClientFence;expiresAt:number}>;
  releaseClient?(actorId:string,sessionId:string,fence:ClientFence,now?:number):Promise<{released:boolean}>;
  liveState?(sessionIds?:string[]):Promise<{state:State;revokedSessionIds:string[]}>;
}
export function createApp(options: { store: CommandStore; authenticate: (req: IncomingMessage)=>Promise<Identity>; config?: Record<string, unknown>; accounts?:AccountGateway; mfa?:MFAGateway; appOrigin?:string; clock?: ()=>number;multiplayer?:boolean }) {
  const importMap='{"imports":{"three":"/engine/three.module.js","three/addons/geometries/RoundedBoxGeometry.js":"/engine/rounded-box.js","three/addons/":"/engine/addons/"}}',mapHash=createHash('sha256').update(importMap).digest('base64');
  const { store, authenticate } = options, clock = options.clock ?? Date.now;
  if(options.multiplayer&&!liveStore(store))throw new Error('Multiplayer requires a durable connection store.');
  let origin = options.appOrigin??'';
  if(origin){const u=new URL(origin);if(u.origin!==origin||u.protocol!=='https:')throw new Error('APP_ORIGIN must be an HTTPS origin.');}
  async function body(req:IncomingMessage){
    if(req.headers['content-type']?.split(';')[0]!=='application/json')throw new DomainError('JSON_REQUIRED','Send JSON.',415);
    const chunks:Buffer[]=[];let bytes=0;
    for await(const chunk of req.iterator({destroyOnReturn:false})){bytes+=chunk.length;if(bytes>8192){req.resume();throw new DomainError('BODY_TOO_LARGE','This request is too large.',413);}chunks.push(chunk);}
    try{const parsed=JSON.parse(Buffer.concat(chunks).toString('utf8'));if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw Error();return parsed;}catch{throw new DomainError('INVALID_JSON','Send a valid JSON object.',400);}
  }
  const assets = new Map([['/', ['index.html','text/html']], ['/app.js',['app.js','text/javascript']], ['/style.css',['style.css','text/css']], ['/favicon.svg',['favicon.svg','image/svg+xml']]]);
  assets.set('/auth-return.js',['auth-return.js','text/javascript']);
  assets.set('/civic-ui.js',['civic-ui.js','text/javascript']);
  assets.set('/game-ui.js',['game-ui.js','text/javascript']);
  assets.set('/object-ui.js',['object-ui.js','text/javascript']);
  assets.set('/city-map.js',['city-map.js','text/javascript']);
  assets.set('/neighbours-ui.js',['neighbours-ui.js','text/javascript']);
  assets.set('/world-sync.js',['world-sync.js','text/javascript']);
  assets.set('/admin-ui.js',['admin-ui.js','text/javascript']);
  for(const [url,type] of [['manifest.webmanifest','application/manifest+json'],['offline.html','text/html'],['pwa.js','text/javascript'],['app-icon-192.png','image/png'],['app-icon-512.png','image/png']])assets.set('/'+url,[url,type]);
  assets.set('/appearance-ui.js',['appearance-ui.js','text/javascript']);
  assets.set('/walking.js',['walking.js','text/javascript']);
  assets.set('/world-renderer.js',['world-renderer.js','text/javascript']);
  for(const [url,file] of [['/world-3d-controller.js','world-3d-controller.js'],['/scene/engine.js','scene/engine.js'],['/scene/models.js','scene/models.js'],['/scene/motion.js','scene/motion.js'],['/engine/three.module.js','../node_modules/three/build/three.module.js'],['/engine/three.core.js','../node_modules/three/build/three.core.js'],['/engine/rounded-box.js','../node_modules/three/examples/jsm/geometries/RoundedBoxGeometry.js']])assets.set(url,[file,'text/javascript']);
  for(const file of ['authored-characters.js','lighting.js','world-assets.js','asset-catalogue.js','sprites.js','camera.js','activity.js','activity-effects.js'])assets.set('/scene/'+file,['scene/'+file,'text/javascript']);
  const artManifest=JSON.parse(readFileSync(new URL('../web/assets/world/manifest.json',import.meta.url),'utf8'));
  for(const item of Object.values(artManifest.assets) as {url:string}[]){if(!/^\/assets\/world\/[a-z]+\/[A-Za-z0-9-]+\.glb$/.test(item.url))throw Error('Invalid local art manifest.');assets.set(item.url,[item.url.slice(1),'model/gltf-binary']);}
  assets.set('/assets/world/manifest.json',['assets/world/manifest.json','application/json']);
  for(const pack of ['furniture','suburban','commercial','cars'])assets.set('/assets/world/LICENSE-'+pack+'.txt',['assets/world/LICENSE-'+pack+'.txt','text/plain']);
  const sprites=JSON.parse(readFileSync(new URL('../web/assets/world/sprites/manifest.json',import.meta.url),'utf8'));
  assets.set('/assets/world/sprites/manifest.json',['assets/world/sprites/manifest.json','application/json']);
  for(const item of Object.values(sprites) as {views:{file:string}[]}[])for(const view of item.views){if(!/^[A-Za-z0-9-]+\.webp$/.test(view.file))throw Error('Invalid sprite manifest.');assets.set('/assets/world/sprites/'+view.file,['assets/world/sprites/'+view.file,'image/webp']);}
  for(const body of ['male','female'])for(const outfit of ['tee','linen','tunic','jacket'])for(const suffix of ['', '-mask']){const file=body+'-'+outfit+suffix+'.webp';assets.set('/assets/world/characters/'+file,['assets/world/characters/'+file,'image/webp']);}
  for(const file of ['loaders/GLTFLoader.js','utils/BufferGeometryUtils.js','utils/SkeletonUtils.js'])assets.set('/engine/addons/'+file,['../node_modules/three/examples/jsm/'+file,'text/javascript']);
  for(const file of ['adult-male.glb','adult-female.glb'])assets.set('/assets/characters/'+file,['assets/characters/'+file,'model/gltf-binary']);
  for(const [file,type] of [['eyes-brown.png','image/png'],['LICENSE-Quaternius.txt','text/plain']])assets.set('/assets/characters/'+file,['assets/characters/'+file,type]);
  for(const file of ['furniture-art.js','furniture-shop.js'])assets.set('/'+file,[file,'text/javascript']);
  assets.set('/economy-ui.js',['economy-ui.js','text/javascript']);
  assets.set('/governance-ui.js',['governance-ui.js','text/javascript']);
  assets.set('/insurance-ui.js',['insurance-ui.js','text/javascript']);
  assets.set('/healthcare-ui.js',['healthcare-ui.js','text/javascript']);
  assets.set('/mobility-ui.js',['mobility-ui.js','text/javascript']);
  assets.set('/property-ui.js',['property-ui.js','text/javascript']);
  assets.set('/furnishing-ui.js',['furnishing-ui.js','text/javascript']);
  assets.set('/relationships-ui.js',['relationships-ui.js','text/javascript']);
  assets.set('/home-visits-ui.js',['home-visits-ui.js','text/javascript']);
  assets.set('/teaching-ui.js',['teaching-ui.js','text/javascript']);
  assets.set('/entry-ui.js',['entry-ui.js','text/javascript']);
  assets.set('/brand.css',['brand.css','text/css']);
  assets.set('/world-art.html',['world-art.html','text/html']);
  for(const file of ['my-rp-logo-night.webp','my-rp-city-keyart.webp'])assets.set('/assets/brand/'+file,['assets/brand/'+file,'image/webp']);
  for(const file of ['home-interior.webp','workspace-office.webp','city-district.webp','vehicle-sedan.webp'])assets.set('/assets/concepts/'+file,['assets/concepts/'+file,'image/webp']);
  const publicAssets=[...assets.keys()].filter(path=>path!=='/');let worker:Promise<string>|null=null;
  async function serviceWorker(){
    if(!worker)worker=(async()=>{const template=await readFile(new URL('../web/sw.js',import.meta.url),'utf8'),hash=createHash('sha256').update(template);
      for(const [path,[file]] of assets)hash.update(path).update(await readFile(new URL('../web/'+file,import.meta.url)));
      return template.replace('__STATIC_VERSION__',hash.digest('hex')).replace('__PUBLIC_ASSETS__',JSON.stringify(publicAssets));
    })().catch(error=>{worker=null;throw error;});
    return worker;
  }
  const server = createServer(async (req,res)=>{
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Content-Security-Policy',`default-src 'self'; script-src 'self' 'sha256-${mapHash}'; style-src 'self'; img-src 'self' blob:; connect-src 'self' blob:${options.multiplayer?' '+origin.replace(/^http/,'ws'):''}; frame-ancestors 'none'; form-action 'self'`);
    res.setHeader('Referrer-Policy','no-referrer'); res.setHeader('Cache-Control','no-store');
    const json = (status: number,data: unknown)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(data));};
    try {
      if(req.headers.origin && req.headers.origin!==origin)return json(403,{error:'ORIGIN_FORBIDDEN',message:'Use the simulator origin.'});
      const url=new URL(req.url??'/',origin);
      if(req.method==='GET'&&url.pathname==='/sw.js'){const source=await serviceWorker();res.writeHead(200,{'Content-Type':'text/javascript; charset=utf-8','Cache-Control':'no-cache','Service-Worker-Allowed':'/'});res.end(source);return;}
      if(req.method==='GET' && assets.has(url.pathname)){
        const [name,type]=assets.get(url.pathname)!;const content=await readFile(new URL('../web/'+name,import.meta.url));res.writeHead(200,{'Content-Type':type+(type.startsWith('text/')||type.includes('json')?'; charset=utf-8':'')});res.end(content);return;
      }
      if(req.method==='GET' && url.pathname==='/healthz')return json(200,{status:'ok'});
      if(req.method==='GET' && url.pathname==='/api/config')return json(200,{...(options.config??{mode:'development'}),multiplayer:options.multiplayer===true,...(options.accounts?{sessionResume:true}:{} )});
      if(req.method==='GET'&&url.pathname==='/readyz'){await store.snapshot();return json(200,{status:'ready'});}
      if(req.method==='POST'&&['/api/auth/login','/api/auth/signup','/api/auth/refresh','/api/auth/logout','/api/auth/resume'].includes(url.pathname)){
        if(!options.accounts)return json(404,{error:'NOT_FOUND',message:'Unknown route.'});
        const secure=origin.startsWith('https:'),action=url.pathname.slice(10),input=await body(req);
        if(action==='resume'){
          const token=readRefreshCookie(req.headers.cookie,secure);
          if(!token)return json(200,{sessionAvailable:false});
          if(req.headers.origin!==origin)throw new DomainError('ORIGIN_FORBIDDEN','Open the game to resume your session.',403);
          try{const session=await options.accounts('refresh',{refresh_token:token});res.setHeader('Set-Cookie',refreshCookie(String(session.refresh_token),secure));return json(200,session);}
          catch(error){if(error instanceof DomainError&&error.status===401)res.setHeader('Set-Cookie',refreshCookie(null,secure));throw error;}
        }
        if(action==='logout'&&store.revokeSession){const identity=await authenticate(req);await store.revokeSession(identity.actorId,identity.sessionId);}
        const session=await options.accounts(action as AccountAction,input,req.headers.authorization);
        if(action==='logout')res.setHeader('Set-Cookie',refreshCookie(null,secure));
        else if(session.refresh_token)res.setHeader('Set-Cookie',refreshCookie(String(session.refresh_token),secure));
        return json(200,session);
      }
      const identity=await authenticate(req);
      if(req.method==='POST'&&['/api/mfa/list','/api/mfa/enroll','/api/mfa/challenge','/api/mfa/verify','/api/mfa/discard'].includes(url.pathname)){
        if(!options.mfa)return json(404,{error:'NOT_FOUND',message:'Authenticator setup is unavailable.'});
        await store.snapshot(identity.actorId,identity.sessionId);return json(200,await options.mfa(url.pathname.slice(9) as MFAAction,await body(req),req.headers.authorization));
      }
      if(req.method==='GET'&&url.pathname==='/api/admin/access'){const state=await store.snapshot(identity.actorId,identity.sessionId);return json(200,adminAccess(state,identity.actorId,identity,clock()));}
      if(req.method==='GET'&&url.pathname==='/api/admin/view'){const state=await store.snapshot(identity.actorId,identity.sessionId);return json(200,adminView(state,identity.actorId,identity,clock()));}
      if(req.method==='GET'&&url.pathname==='/api/admin/receipt'){const state=await store.snapshot(identity.actorId,identity.sessionId);return json(200,ownStaffReceipt(state,identity.actorId,identity,url.searchParams.get('id')??'',clock()));}
      if(req.method==='POST'&&url.pathname==='/api/admin/commands'){
        const command=await body(req);if(!isAdminCommand(command.type)||command.type==='BootstrapStaff')throw new DomainError('STAFF_COMMAND','Choose a supported staff control.',400);
        if(command.accountId!==identity.actorId)throw new DomainError('ACCOUNT_CHANGED','Sign in to the account that created this staff action.',401);
        const result=await store.dispatch(identity.actorId,command,clock(),identity.sessionId,{administration:{session:{sessionId:identity.sessionId,assurance:identity.assurance,stepUpAt:identity.stepUpAt}}});
        const state=await store.snapshot(identity.actorId,identity.sessionId),access=adminAccess(state,identity.actorId,identity,clock());
        return json(200,{...result,access,view:access.available&&!access.stepUpRequired?adminView(state,identity.actorId,identity,clock()):null});
      }
      const currentView=(state:State)=>({...citizenView(state,identity.actorId,clock()),accountId:identity.actorId,...(options.multiplayer?{sync:{protocol:1,cursor:state.outbox.length,heartbeat:SESSION_RULES.heartbeat}}:{})});
      const view=async()=>currentView(await store.snapshot(identity.actorId,identity.sessionId));
      if(req.method==='GET' && url.pathname==='/api/citizen')return json(200,await view());
      if(options.multiplayer&&liveStore(store)){
        if(req.method==='POST'&&url.pathname==='/api/connect'){const input=await body(req),result=await store.claimClient(identity.actorId,identity.sessionId,input.clientId,input.takeover,clock());void realtime?.publish();return json(200,{...result,view:await view()});}
        if(req.method==='POST'&&url.pathname==='/api/heartbeat'){const input=await body(req);return json(200,await store.renewClient(identity.actorId,identity.sessionId,input.clientLease,clock()));}
        if(req.method==='POST'&&url.pathname==='/api/disconnect'){const input=await body(req),result=await store.releaseClient(identity.actorId,identity.sessionId,input.clientLease,clock());void realtime?.publish();return json(200,result);}
        if(req.method==='GET'&&url.pathname==='/api/presence'){const {state,revokedSessionIds}=await store.liveState([identity.sessionId]);if(revokedSessionIds.includes(identity.sessionId))throw new DomainError('SESSION_REVOKED','Sign in again to continue.',401);const fence={clientId:String(req.headers['x-client-id']??''),epoch:Number(req.headers['x-client-epoch'])};return json(200,nearbyPresence(state,identity.actorId,identity.sessionId,fence,clock()));}
        if(req.method==='GET'&&url.pathname==='/api/recovery'){const state=await store.snapshot(identity.actorId,identity.sessionId);let recovery;try{recovery=recoveryCursor(state,identity.actorId,url.searchParams.get('after')??undefined);}catch{throw new DomainError('INVALID_CURSOR','Use a valid recovery cursor.',400);}return json(200,{...recovery,view:await view()});}
      }
      if(req.method==='POST' && url.pathname==='/api/commands'){
        const command:Command & {accountId?:unknown;clientLease?:ClientFence}=await body(req);
        if(isAdminCommand(command.type))throw new DomainError('STAFF_COMMAND','Use the separately authenticated staff controls.',403);
        if(options.accounts&&command.accountId!==identity.actorId)throw new DomainError('ACCOUNT_CHANGED','Sign in to the account that created this action.',401);
        const result=await store.dispatch(identity.actorId,command,clock(),identity.sessionId,{requireConnection:options.multiplayer===true,clientLease:command.clientLease,includeState:true});
        void realtime?.publish();
        // Stores can return the exact committed state. This removes a second
        // database transaction from every step; private world data stays here.
        const state=result.state??await store.snapshot(identity.actorId,identity.sessionId);return json(200,{replayed:result.replayed,receipt:publicCitizenReceipt(state,result.receipt),view:currentView(state)});
      }
      return json(404,{error:'NOT_FOUND',message:'Unknown route.'});
    }catch(error){
      if(error instanceof AccountRateLimitError){res.setHeader('Retry-After',String(error.retryAfterSeconds));return json(429,{error:error.code,message:error.message,retryAfterSeconds:error.retryAfterSeconds,rateLimitScope:error.action});}
      if(error instanceof DomainError)return json(error.status,{error:error.code,message:error.message});
      return json(req.url==='/readyz'?503:500,{error:'SERVER_ERROR',message:'The action was not confirmed. Retry with the same request identifier.'});
    }
  });
  const realtime=options.multiplayer&&liveStore(store)?attachRealtime(server,{store,authenticate,origin:()=>origin,clock}):null;
  server.requestTimeout=10000;
  server.on('listening',()=>{const address=server.address();if(!options.appOrigin && address && typeof address!=='string')origin=`http://127.0.0.1:${address.port}`;});
  return server;
}
