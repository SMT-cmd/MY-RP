import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,execute,citizenView,DomainError} from '../src/domain.ts';
import {nearbyNeighbours,neighbourAt,NEIGHBOUR_RULES,reconcileNeighbours} from '../src/neighbours.ts';
import {REGIONS} from '../src/geography.ts';
import {streetWalkable} from '../src/neighbourhood.ts';
import {walkTo} from './helpers.ts';
import {exportBackup,restoreBackup,reconcile} from '../src/recovery.ts';
import {WorldStore} from '../src/store.ts';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const create=()=>{const s=initialState();s.life!.seed='d'.repeat(64);return execute(s,'walker',{id:'neighbours_create',type:'CreateCitizen',payload:{name:'Ada',state:'Lagos',adultConfirmed:true}},100).state;};
const cmd=(npcId:string,topic='hello',id='neighbour_talk_first')=>({id,type:'TalkToNeighbour',payload:{npcId,topic,leaseVersion:1}});
const code=(value:string)=>(e:unknown)=>e instanceof DomainError&&e.code===value;
test('all regional NPC schedules are stable, adult styled, adjacent, collision free and derived without writing world state',()=>{
 const s=create(),before=JSON.stringify(s);
 for(const region of REGIONS)for(let i=0;i<6;i++){
  let previous=neighbourAt(s,region.name,i,0);
  for(let at=1500;at<250000;at+=1500){const n=neighbourAt(s,region.name,i,at);assert.ok(streetWalkable(n.x,n.y));assert.ok(Math.abs(n.x-previous.x)+Math.abs(n.y-previous.y)<=1);assert.equal(n.kind,'npc');assert.ok(n.avatar.frame>=.9&&n.avatar.frame<=1.13);previous=n;}
  assert.deepEqual(neighbourAt(s,region.name,i,120000),neighbourAt(structuredClone(s),region.name,i,120000));
 }
 nearbyNeighbours(s,'walker',10000);assert.equal(JSON.stringify(s),before);
});
test('physical NPC conversations enforce current city, lease, range, topic, cooldown and exact replay without funds or permissions',()=>{
 let s=create();const n=neighbourAt(s,'Lagos',0,20000);s=walkTo(s,'walker',n.x,n.y,2000);const balances=structuredClone(s.balances),journalCount=s.journals.length;
 assert.throws(()=>execute(s,'walker',cmd(n.id,'invented'),20000),code('NEIGHBOUR_TOPIC'));
 assert.throws(()=>execute(s,'walker',cmd('npc-kano-0'),20000),code('NEIGHBOUR_NOT_FOUND'));
 assert.throws(()=>execute(s,'walker',{...cmd(n.id),payload:{...cmd(n.id).payload,leaseVersion:2}},20000),code('STALE_LEASE'));
 const result=execute(s,'walker',cmd(n.id),20000);s=result.state;assert.equal(result.receipt.detail.conversationCount,1);assert.match(String(result.receipt.detail.message),/Hello|Welcome/);assert.deepEqual(s.balances,balances);assert.equal(s.journals.length,journalCount);
 const replay=execute(s,'walker',cmd(n.id),999999);assert.equal(replay.replayed,true);assert.deepEqual(replay.receipt,result.receipt);assert.equal(Object.keys(replay.state.neighbours!.conversations).length,1);
 assert.throws(()=>execute(s,'walker',cmd(n.id,'work','neighbour_talk_second'),20001),code('NEIGHBOUR_COOLDOWN'));
 assert.throws(()=>execute(s,'walker',cmd('citizen-forged','hello','npc_forged_target'),21000),code('NEIGHBOUR_NOT_FOUND'));
 const next=neighbourAt(s,'Lagos',0,70000);s=walkTo(s,'walker',next.x,next.y,30000);s=execute(s,'walker',cmd(n.id,'hello','neighbour_talk_second'),70000).state;assert.match(String(s.commands['walker:neighbour_talk_second'].receipt.detail.message),/Good to see you again/);reconcile(s);
 const privateView=citizenView(s,'walker',70000).world!;assert.equal(privateView.npcHistory[0].count,2);assert.ok(!JSON.stringify(privateView.npcs).includes('walker'));assert.ok(!JSON.stringify(privateView.npcHistory).includes('neighbour_talk_second'));
 s=execute(s,'other',{id:'other_create_npc',type:'CreateCitizen',payload:{name:'Bola',state:'Lagos',adultConfirmed:true}},70001).state;assert.deepEqual(citizenView(s,'other',71000).world!.npcHistory,[]);
 const restored=restoreBackup(exportBackup(s));reconcile(restored);restored.commands=Object.fromEntries(Object.entries(restored.commands).reverse());reconcileNeighbours(restored);
 const forged=structuredClone(s);Object.values(forged.neighbours!.conversations)[0].count++;assert.throws(()=>reconcile(forged),/conversation/);
});
test('NPCs remain outdoors, moving targets are checked at execution, and travel/home state does not expose or allow conversations',()=>{
 let s=create();const far=neighbourAt(s,'Lagos',5,20000);assert.throws(()=>execute(s,'walker',cmd(far.id),20000),code('TOO_FAR'));
 s=walkTo(s,'walker',4,7,2000);s=execute(s,'walker',{id:'npc_enter_home',type:'EnterBuilding',payload:{buildingId:'shelter'}},10000).state;assert.deepEqual(nearbyNeighbours(s,'walker',11000),[]);assert.throws(()=>execute(s,'walker',{...cmd('npc-lagos-0'),payload:{npcId:'npc-lagos-0',topic:'hello',leaseVersion:2}},11000),code('CITY_REQUIRED'));
 let moving=create();const old=neighbourAt(moving,'Lagos',0,20000);moving=walkTo(moving,'walker',old.x,old.y,2000);
 const future=Array.from({length:240},(_,i)=>20000+i*1500).find(at=>Math.abs(neighbourAt(moving,'Lagos',0,at).x-old.x)>2)!;assert.ok(future);
 assert.throws(()=>execute(moving,'walker',{...cmd(old.id),payload:{...cmd(old.id).payload,x:old.x,y:old.y}},future),code('TOO_FAR'));assert.equal(moving.neighbours,undefined);
});
test('saved NPC conversation counts survive file restart and concurrent duplicated requests settle once',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'myrp-neighbours-'));t.after(()=>rm(dir,{recursive:true,force:true}));const file=join(dir,'world.json'),store=await WorldStore.open(file);
 await store.dispatch('walker',{id:'npc_file_create',type:'CreateCitizen',payload:{name:'Ada',state:'Lagos',adultConfirmed:true}},100);const n=neighbourAt(store.snapshot(),'Lagos',0,20000);
 let at=1000;const p=store.snapshot().world!.positions.walker;
 for(let x=p.x;x!==n.x;x+=Math.sign(n.x-p.x))await store.dispatch('walker',{id:'npc_file_x_'+x,type:'MoveCitizen',payload:{dx:Math.sign(n.x-p.x),dy:0}},at+=500);
 if(n.y!==p.y)await store.dispatch('walker',{id:'npc_file_y',type:'MoveCitizen',payload:{dx:0,dy:1}},at+=500);
 const both=await Promise.all([store.dispatch('walker',cmd(n.id),20000),store.dispatch('walker',cmd(n.id),20000)]);assert.equal(both.filter(r=>r.replayed).length,1);
 const reopened=await WorldStore.open(file);assert.equal(Object.values(reopened.snapshot().neighbours!.conversations)[0].count,1);assert.equal((await reopened.dispatch('walker',cmd(n.id),30000)).replayed,true);
});
