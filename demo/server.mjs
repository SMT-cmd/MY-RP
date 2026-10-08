// Public visual-preview host only. Never imports the development game server,
// world store, credentials, database adapter, or production accounts.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export async function createPreviewServer(){
 const root=new URL('./',import.meta.url);
 const [html,scene,security]=await Promise.all(['preview.html','scene.svg','security.json'].map(name=>readFile(new URL(name,root))));
 const csp=JSON.parse(security).csp;
 const server=createServer((req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Content-Security-Policy',csp);
  res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=(), payment=()');
  const send=(status,type,body)=>{res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store','Content-Length':Buffer.byteLength(body)});res.end(req.method==='HEAD'?undefined:body);};
  if(!['GET','HEAD'].includes(req.method)){res.setHeader('Allow','GET, HEAD');return send(405,'text/plain; charset=utf-8','Preview is read-only.');}
  const path=(req.url||'/').split('?')[0];
  if(path==='/'||path==='/preview.html')return send(200,'text/html; charset=utf-8',html);
  if(path==='/scene.svg')return send(200,'image/svg+xml',scene);
  if(path==='/healthz')return send(200,'application/json','{"status":"ok","mode":"visual-preview"}');
  return send(404,'text/plain; charset=utf-8','Not found.');
 });
 server.requestTimeout=5000;server.headersTimeout=5000;server.maxHeadersCount=32;
 return server;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const port=Number(process.env.PORT??3100);
 if(!Number.isInteger(port)||port<0||port>65535)throw new Error('Invalid preview PORT');
 const server=await createPreviewServer();server.listen(port,'0.0.0.0',()=>{console.log(`MY RP visual preview listening on port ${server.address().port}`);});
}
