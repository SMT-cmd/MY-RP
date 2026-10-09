import { randomBytes,createHash,timingSafeEqual } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { WorldStore } from './store.ts';
import { DomainError } from './domain.ts';
import { createApp } from './http.ts';
const port=Number(process.env.PORT??3000);
if(!Number.isInteger(port)||port<0||port>65535)throw new Error('Invalid PORT');
const store=await WorldStore.open(process.env.SIMULATOR_DATA_FILE??fileURLToPath(new URL('../.data/world.json',import.meta.url)),{requireConnection:true});
const key=randomBytes(24).toString('base64url'),digest=(s:string)=>createHash('sha256').update(s).digest(),expected=digest(key);
const server=createApp({multiplayer:true,store,authenticate:async req=>{
  const access=req.headers['x-development-key'];
  if(typeof access!=='string'||!timingSafeEqual(digest(access),expected))throw new DomainError('AUTH_REQUIRED','Enter the local development access key.',401);
  return {actorId:'developer-citizen',sessionId:'development-session',assurance:'aal1'};
}});
server.listen(port,'127.0.0.1',()=>{const address=server.address();if(address && typeof address!=='string'){console.log(`Development foundation: http://127.0.0.1:${address.port}`);console.log(`Development access key: ${key}`);}});
