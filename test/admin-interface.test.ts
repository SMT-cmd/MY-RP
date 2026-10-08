import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM,VirtualConsole} from 'jsdom';
import {randomUUID} from 'node:crypto';
import {createApp} from '../src/http.ts';
import {WorldStore} from '../src/store.ts';
import {supabaseAuthenticator} from '../src/auth.ts';
import {supabaseMFA} from '../src/mfa.ts';
import {DomainError} from '../src/domain.ts';
const roots=['00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002'],outsider='00000000-0000-4000-8000-000000000003';
const decode=(authorization:string)=>JSON.parse(Buffer.from(authorization.split('.')[1],'base64url').toString());
const token=(actor:string,strong=false)=>['header',Buffer.from(JSON.stringify({sub:actor,session_id:actor,exp:Math.floor(Date.now()/1000)+3600,aal:strong?'aal2':'aal1',...(strong?{amr:[{method:'totp',timestamp:Math.floor(Date.now()/1000)}]}:{})})).toString('base64url'),'signature'].join('.');
const credentials=(actor:string,strong=false)=>({access_token:token(actor,strong),refresh_token:actor,expires_in:3600});
const waitFor=async(check:()=>boolean)=>{for(let i=0;i<300;i++){if(check())return;await new Promise(resolve=>setTimeout(resolve,10));}throw Error('Staff interface did not reach expected state');};
async function fixture(t:{after:(fn:()=>unknown)=>void}){
 const store=await WorldStore.open(null,{requireConnection:true});await store.bootstrapStaff(roots,'Two independently verified operator accounts');
 const factors=new Set<string>(),verified=new Set<string>();
 const provider:typeof fetch=async(url,options)=>{
  const claims=decode((options?.headers as Record<string,string>).Authorization),actor=claims.sub,path=new URL(String(url)).pathname,body=options?.body?JSON.parse(String(options.body)):{};
  if(path==='/auth/v1/user')return Response.json({id:actor,user_metadata:{role:'super'},factors:factors.has(actor)?[{id:actor,status:verified.has(actor)?'verified':'unverified',factor_type:'totp',friendly_name:'Test authenticator'}]:[]});
  if(path==='/auth/v1/factors'){factors.add(actor);return Response.json({id:actor,totp:{secret:'ABCDEFGHIJKLMNOP'}});}
  if(path.endsWith('/challenge'))return Response.json({id:actor});
  if(path.endsWith('/verify')){if(body.code!=='123456')return Response.json({private_trace:'not exposed'},{status:400});verified.add(actor);return Response.json(credentials(actor,true));}
  if(options?.method==='DELETE'){factors.delete(actor);return new Response(null,{status:204});}
  throw Error('Unexpected provider request');
 };
 const authenticate=supabaseAuthenticator('https://example.supabase.co','sb_publishable_test',provider),server=createApp({store,authenticate:req=>authenticate(req.headers.authorization),mfa:supabaseMFA('https://example.supabase.co','sb_publishable_test',provider),config:{mode:'supabase'},accounts:async(action,payload)=>{
  if(action==='logout')return{signedOut:true};const actor=payload.email==='first@example.com'?roots[0]:payload.email==='second@example.com'?roots[1]:outsider;return credentials(actor);
 }});
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise<void>(resolve=>server.close(()=>resolve())));const address=server.address();if(!address||typeof address==='string')throw Error();
 return{store,origin:'http://127.0.0.1:'+address.port};
}
test('staff HTTP routes enforce MFA, isolate ordinary actions, reject bootstrap and recover only own committed receipts',async t=>{
 const {store,origin}=await fixture(t),request=async(path:string,strong=false,actor=roots[0],body?:unknown)=>fetch(origin+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+token(actor,strong),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
 assert.equal((await request('/api/admin/access')).status,200);assert.equal((await request('/api/admin/view')).status,403);assert.equal((await request('/api/admin/view',true,outsider)).status,403);
 const command={id:'admin_http_grant',accountId:roots[0],type:'ProposeStaffChange',payload:{adminVersion:1,action:'grant',targetActorId:roots[1],role:'economy',region:'Lagos',grantUntil:Date.now()+86400000,reason:'Review exact scope for treasury diagnostics'}};
 assert.equal((await request('/api/commands',true,roots[0],command)).status,403);
 assert.equal((await request('/api/admin/commands',true,roots[0],{...command,type:'BootstrapStaff'})).status,400);
 assert.equal((await request('/api/admin/commands',false,roots[0],command)).status,403);assert.equal(store.snapshot().administration!.version,1);
 assert.equal((await request('/api/admin/commands',true,roots[1],command)).status,401);assert.equal(store.snapshot().administration!.version,1);
 const result=await request('/api/admin/commands',true,roots[0],command);assert.equal(result.status,200);const data=await result.json();assert.equal(data.view.proposals.length,1);
 assert.equal((await request('/api/admin/receipt?id='+command.id)).status,403);
 assert.equal((await (await request('/api/admin/receipt?id='+command.id,true,roots[1])).json()).receipt,null);
 assert.equal((await (await request('/api/admin/receipt?id='+command.id,true)).json()).receipt.commandId,command.id);
 const replay=await (await request('/api/admin/commands',true,roots[0],command)).json();assert.equal(replay.replayed,true);assert.equal(store.snapshot().administration!.audit.length,2);
 await store.revokeSession(roots[0],roots[0]);assert.equal((await request('/api/admin/access',true)).status,401);
});
test('applying own final-role revocation returns the committed receipt and only fresh own receipt recovery remains available',async t=>{
 const {store,origin}=await fixture(t),now=Date.now(),lease=(await store.claimClient(outsider,outsider,{id:randomUUID(),claimId:randomUUID()},false,now)).clientLease;
 await store.dispatch(outsider,{id:'staff_join_third',type:'CreateCitizen',payload:{name:'Third authority',state:'Lagos',adultConfirmed:true}},now,outsider,{clientLease:lease});
 let sequence=0;
 const run=async(actor:string,type:string,payload:Record<string,unknown>)=>{
  const id='staff_http_transition_'+ ++sequence,response=await fetch(origin+'/api/admin/commands',{method:'POST',headers:{Authorization:'Bearer '+token(actor,true),'Content-Type':'application/json'},body:JSON.stringify({id,accountId:actor,type,payload:{adminVersion:store.snapshot().administration!.version,...payload}})});assert.equal(response.status,200);return response.json();
 };
 const why='Two independent authorities reviewed this transition';
 async function approveApply(id:string){let p=store.snapshot().administration!.proposals[id];await run(roots[1],'DecideStaffChange',{proposalId:id,proposalVersion:p.version,signature:p.signature,approve:true,reason:why});p=store.snapshot().administration!.proposals[id];return run(roots[0],'ApplyStaffChange',{proposalId:id,proposalVersion:p.version,signature:p.signature});}
 const grant=await run(roots[0],'ProposeStaffChange',{action:'grant',targetActorId:outsider,role:'super',region:null,grantUntil:now+86400000,reason:why});await approveApply(grant.receipt.detail.proposalId);
 const revoke=await run(roots[0],'ProposeStaffChange',{action:'revoke',grantId:'staff-root-1',grantVersion:1,reason:why}),applied=await approveApply(revoke.receipt.detail.proposalId);assert.equal(applied.view,null);assert.equal(applied.access.available,false);
 const get=async(path:string)=>fetch(origin+path,{headers:{Authorization:'Bearer '+token(roots[0],true)}});
 assert.equal((await get('/api/admin/view')).status,403);const receipt=await (await get('/api/admin/receipt?id='+applied.receipt.commandId)).json();assert.equal(receipt.receipt.commandId,applied.receipt.commandId);
});
test('two signed-in staff pages enroll MFA, independently review exact grants and recover a committed response without duplicating audit',async t=>{
 const {store,origin}=await fixture(t),errors:unknown[]=[];let drop=false;
 async function page(email:string){const console=new VirtualConsole();console.on('jsdomError',e=>errors.push(e));const dom=await JSDOM.fromURL(origin,{resources:'usable',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:console,beforeParse(window){
  Object.defineProperty(window.crypto,'randomUUID',{value:randomUUID});window.AbortSignal=AbortSignal as typeof window.AbortSignal;window.confirm=()=>true;
  window.fetch=async(url,options)=>{const response=await fetch(new URL(String(url),origin),options);if(drop&&String(url)==='/api/admin/commands'){drop=false;await response.text();throw new TypeError('Staff response lost after commit');}return response;};
 }});t.after(()=>dom.window.close());if(dom.window.document.readyState!=='complete')await new Promise<void>(resolve=>dom.window.addEventListener('load',()=>resolve(),{once:true}));
  const doc=dom.window.document,$=(id:string)=>doc.getElementById(id)!;await waitFor(()=>!$('account-panel').hidden);($('account-email') as HTMLInputElement).value=email;($('account-password') as HTMLInputElement).value='test_password';($('account-form') as HTMLFormElement).requestSubmit($('account-login') as HTMLButtonElement);
  await waitFor(()=>!!$('staff-enroll'));assert.equal($('staff-controls').children.length,0);($('staff-enroll') as HTMLButtonElement).click();await waitFor(()=>!!$('staff-secret'));assert.equal($('staff-secret').textContent,'ABCDEFGHIJKLMNOP');
  ($('staff-code') as HTMLInputElement).value='123456';($('staff-mfa-form') as HTMLFormElement).requestSubmit();await waitFor(()=>!!$('staff-grant-form'));assert.equal($('staff-secret'),null);assert.equal($('staff-code'),null);assert.equal($('citizen-panel').hidden,true);
  assert.equal(dom.window.sessionStorage.length,0);return{dom,doc,$};
 }
 const first=await page('first@example.com'),second=await page('second@example.com');
 (first.$('staff-target') as HTMLInputElement).value=roots[1];(first.$('staff-role') as HTMLSelectElement).value='economy';(first.$('staff-region') as HTMLSelectElement).value='Lagos';(first.$('staff-grant-reason') as HTMLInputElement).value='Treasury diagnostics limited to Lagos';
 drop=true;(first.$('staff-grant-form') as HTMLFormElement).requestSubmit();await waitFor(()=>!!first.$('staff-retry')&&!first.$('staff-retry').hasAttribute('disabled'));
 assert.equal(Object.keys(store.snapshot().administration!.proposals).length,1);const proposal=Object.values(store.snapshot().administration!.proposals)[0];assert.equal(proposal.status,'pending');
 (first.$('staff-retry') as HTMLButtonElement).click();await waitFor(()=>!first.$('staff-retry')&&!!first.$('staff-grant-form'));assert.equal(store.snapshot().administration!.audit.length,2);
 (second.$('staff-refresh') as HTMLButtonElement).click();await waitFor(()=>!!second.$('staff-review-'+proposal.id)&&!second.$('staff-review-'+proposal.id).hasAttribute('disabled'));
 (second.$('staff-review-'+proposal.id) as HTMLInputElement).value='Independent review approves exact Lagos scope';const review=second.$('staff-review-'+proposal.id).closest('form') as HTMLFormElement;review.requestSubmit(review.querySelector('button')!);
 await waitFor(()=>store.snapshot().administration!.proposals[proposal.id].status==='ready'&&!!second.$('staff-apply-'+proposal.id)&&!second.$('staff-apply-'+proposal.id).hasAttribute('disabled'));
 (second.$('staff-apply-'+proposal.id) as HTMLButtonElement).click();await waitFor(()=>store.snapshot().administration!.proposals[proposal.id].status==='applied'&&!second.$('staff-refresh').hasAttribute('disabled'));
 assert.equal(store.snapshot().administration!.audit.length,4);assert.equal(store.snapshot().journals.length,0);assert.ok(second.$('staff-controls').textContent!.includes('Lagos · treasury ₦0.00'));
 (second.$('account-logout') as HTMLButtonElement).click();await waitFor(()=>second.$('staff-panel').hidden&&second.$('staff-controls').children.length===0);assert.equal(second.dom.window.sessionStorage.length,0);assert.deepEqual(errors,[]);
});
