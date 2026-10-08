import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { PostgresWorldStore } from '../src/postgres.ts';
import type { Database, Sql } from '../src/postgres.ts';
import { RULES } from '../src/domain.ts';
import type { Command } from '../src/domain.ts';
import { createApp } from '../src/http.ts';
import { supabaseAuthenticator } from '../src/auth.ts';
import { prepareStoredWork } from './helpers.ts';
import {examPayload} from './helpers.ts';
import {PRACTICALS} from '../src/education.ts';
import {DAY} from '../src/domain.ts';
import {completeStoredCourse} from './helpers.ts';
import {reconcile} from '../src/recovery.ts';
const command: Command = { id:'create_database_01',type:'CreateCitizen',payload:{ name:'Ada',state:'Lagos',adultConfirmed:true } };
test('furnished shelter position and nearby actions persist without changing the outdoor lease or duplicating rest',async t=>{
 const {database,store}=await setup(t);await store.dispatch('citizen-one',command,100);
 for(let i=0;i<3;i++)await store.dispatch('citizen-one',{id:'home_walk_'+i,type:'MoveCitizen',payload:{dx:-1,dy:0}},500+i*300);
 await store.dispatch('citizen-one',{id:'home_enter',type:'EnterBuilding',payload:{buildingId:'shelter'}},2000);
 for(const [i,[dx,dy]] of [[0,-1],[0,-1],[0,-1],[-1,0],[0,-1]].entries())await store.dispatch('citizen-one',{id:'home_room_move_'+i,type:'MoveInterior',payload:{dx,dy,leaseVersion:2}},2500+i*300);
 const reopened=new PostgresWorldStore(database,'test-world'),position=(await reopened.snapshot()).world!.positions['citizen-one'];assert.deepEqual([position.x,position.y,position.interiorX,position.interiorY],[4,7,3,2]);
 const rest={id:'home_database_rest',type:'InteractHomeFixture',payload:{fixtureId:'bed',leaseVersion:2}};await reopened.dispatch('citizen-one',rest,5000);assert.equal((await store.dispatch('citizen-one',rest,5100)).replayed,true);
 assert.equal((await store.snapshot()).citizens['citizen-one'].life!.lastRestAt,5000);
 await store.dispatch('citizen-one',{id:'home_exit',type:'ExitBuilding',payload:{leaseVersion:2}},6000);assert.equal((await reopened.snapshot()).world!.positions['citizen-one'].interior,null);
 for(let i=0;i<27;i++)await reopened.dispatch('citizen-one',{id:'district_database_east_'+i,type:'MoveCitizen',payload:{dx:1,dy:0,leaseVersion:3}},7000+i*300);
 for(let i=0;i<3;i++)await reopened.dispatch('citizen-one',{id:'district_database_south_'+i,type:'MoveCitizen',payload:{dx:0,dy:1,leaseVersion:3}},16000+i*300);
 const seat={id:'district_database_seat',type:'InteractStreetObject',payload:{objectId:'bench-1',leaseVersion:3}};await reopened.dispatch('citizen-one',seat,18000);assert.equal((await store.dispatch('citizen-one',seat,18100)).replayed,true);
 const saved=(await new PostgresWorldStore(database,'test-world').snapshot()).world!.positions['citizen-one'];assert.deepEqual([saved.x,saved.y,saved.district,saved.leaseVersion,saved.activity?.fixtureId],[31,10,'Market quarter',3,'bench-1']);

});
test('corporate escrow, approvals and share settlement survive rollback and SQL rejects changed terms or unsupported ownership',async t=>{
 const {pg,database,store}=await setup(t),actor='citizen-one';let sequence=0;
 const run=(type:string,payload:Record<string,unknown>,at:number,who=actor)=>store.dispatch(who,{id:'corporate_database_'+ ++sequence,type,payload},at);
 await store.dispatch(actor,command,100);
 for(let i=0;i<3;i++)await run('MoveCitizen',{dx:-1,dy:0},500+i*250);
 await run('EnterBuilding',{buildingId:'shelter'},2000);await run('ExitBuilding',{},2001);await run('BuyBasicMeal',{},2002);
 await prepareStoredWork(store,actor,3000);await run('CompleteShift',{},63000);await run('ChooseGoal',{goal:'business'},63001);
 for(let day=1;day<=5;day++){const at=100+(day-1)*DAY+(day===1?64000:0);if(day===2)await run('SetPrivacy',{dm:false,location:false,presence:false},at);for(const task of PRACTICALS[day-1])await run('FoundationPractice',{day,choice:task.correct},at);await run('CompleteLesson',{day},at);}
 await run('SubmitExam',examPayload(await store.snapshot(),actor),100+4*DAY);
 await completeStoredCourse(store,actor,'secondary',100+5*DAY);await completeStoredCourse(store,actor,'business',100+6*DAY);const at=100+7*DAY;
 for(const who of ['citizen-two','citizen-three'])await store.dispatch(who,{id:'create_corporate_'+who,type:'CreateCitizen',payload:{name:'Citizen',state:'Lagos',adultConfirmed:true}},at);
 const id=String((await run('RegisterCompany',{name:'Shared SQL Works',sector:'manufacturing',capital:100000},at)).receipt.detail.companyId);
 const snapshot=await store.snapshot(),invite=await run('InviteCompanyRole',{companyId:id,citizenId:snapshot.citizens['citizen-two'].id,role:'cofounder'},at);
 await run('AcceptCompanyRole',{invitationId:invite.receipt.detail.invitationId,consent:true},at,'citizen-two');
 const proposal=await run('ProposeCorporateAction',{companyId:id,kind:'transfer',units:25000,amount:15000,buyerCitizenId:snapshot.citizens['citizen-three'].id,acceptTerms:true},at),pid=String(proposal.receipt.detail.proposalId),terms=(await store.snapshot()).governance!.actions[pid];
 await run('AcceptCorporateTerms',{proposalId:pid,acceptedAmount:15000,acceptedUnits:25000,signature:terms.signature,acceptTerms:true},at,'citizen-three');
 await run('VoteCorporateAction',{proposalId:pid,signature:terms.signature,approve:true},at,'citizen-two');
 const before=(await store.snapshot()).balances['citizen:citizen-three'];assert.equal((await store.snapshot()).balances['share-purchase:'+pid],15000);
 await assert.rejects(pg.query("UPDATE simulator.domain_records SET data=jsonb_set(data,'{amount}','1'::jsonb) WHERE domain='governance.action' AND id=$1",[pid]),/terms are immutable/);
 await pg.exec("ALTER TABLE simulator.domain_records ADD CONSTRAINT prevent_corporate_execution CHECK (domain <> 'governance.action' OR data->>'status' <> 'executed')");
 const settle={id:'corporate_database_settle_once',type:'ExecuteCorporateAction',payload:{proposalId:pid}};
 await assert.rejects(store.dispatch(actor,settle,at));assert.equal((await store.snapshot()).balances['share-purchase:'+pid],15000);assert.equal((await store.snapshot()).commerce!.companies[id].shares['citizen-three'],undefined);
 await pg.exec('ALTER TABLE simulator.domain_records DROP CONSTRAINT prevent_corporate_execution');
 const reopened=new PostgresWorldStore(database,'test-world');await reopened.dispatch(actor,settle,at);assert.equal((await store.dispatch(actor,settle,at+DAY)).replayed,true);
 const after=await reopened.snapshot();assert.equal(after.commerce!.companies[id].shares['citizen-three'],25000);assert.equal(after.balances['share-purchase:'+pid],0);assert.equal(after.balances['citizen:citizen-three'],before);reconcile(after);
 await assert.rejects(pg.transaction(async tx=>{await tx.query("UPDATE simulator.worlds SET state=jsonb_set(state,ARRAY['commerce','companies',$1,'shares'],'{\"citizen-one\":74999,\"citizen-three\":25001}'::jsonb) WHERE id='test-world'",[id]);}),/settled transfer evidence/);
 await assert.rejects(pg.query("UPDATE simulator.domain_records SET data=jsonb_set(data,'{status}','\"pending\"'::jsonb) WHERE domain='governance.action' AND id=$1",[pid]),/Finished corporate action is immutable/);
 const dividend=await run('ProposeCorporateAction',{companyId:id,kind:'dividend',amount:1000,acceptTerms:true},at);const did=String(dividend.receipt.detail.proposalId);
 await assert.rejects(pg.transaction(async tx=>{await tx.query("UPDATE simulator.worlds SET state=jsonb_set(state,ARRAY['governance','actions',$1,'amount'],'1001'::jsonb) WHERE id='test-world'",[did]);}),/Corporate reservation does not reconcile/);
});
test('reserved NPC wages, work checks and settlement survive PostgreSQL reopening', async t=>{
  const {pg,database,store}=await setup(t);await store.dispatch('citizen-one',command,100);
  await prepareStoredWork(store,'citizen-one',1000,'courier');
  const shift=(await store.snapshot()).life!.work!.active['citizen-one'];
  assert.equal((await store.snapshot()).balances['escrow:'+shift],RULES.shiftPay);
  const reopened=new PostgresWorldStore(database,'test-world'),settle={id:'settle_database_01',type:'CompleteShift',payload:{shiftId:shift}};
  await reopened.dispatch('citizen-one',settle,61000);assert.equal((await store.dispatch('citizen-one',settle,99000)).replayed,true);
  assert.equal((await store.snapshot()).balances['escrow:'+shift],0);
  assert.equal((await store.snapshot()).balances['citizen:citizen-one'],RULES.starterCash+RULES.shiftPay);
  const record=(await pg.query<{status:string;data:{steps:number}}> ('SELECT status,data FROM simulator.work_shifts')).rows[0];assert.equal(record.status,'completed');assert.equal(record.data.steps,3);
});
test('PostgreSQL inventory journals reject quantity editing and duplicate stock issuance',async t=>{
 const {pg,database,store}=await setup(t);await store.dispatch('citizen-one',command,100);
 const buy={id:'buy_stock_database',type:'BuyNPCSupply',payload:{goodsId:'grain',quantity:5,acceptedUnitPrice:1000}};
 const bought=await store.dispatch('citizen-one',buy,200),id=String(bought.receipt.detail.batchId);assert.equal((await new PostgresWorldStore(database,'test-world').dispatch('citizen-one',buy,300)).replayed,true);
 assert.equal((await store.snapshot()).commerce?.batches[id].quantity,5);assert.equal((await pg.query('SELECT * FROM simulator.stock_journals')).rows.length,1);
 await assert.rejects(pg.transaction(async tx=>{await tx.query("UPDATE simulator.stock_accounts SET quantity=quantity+1 WHERE id=$1",['batch:'+id]);}),/immutable journal/);
 await assert.rejects(pg.query("UPDATE simulator.stock_journals SET reason='tampered'"),/immutable/);
 await assert.rejects(pg.transaction(async tx=>{await tx.query("UPDATE simulator.worlds SET state=jsonb_set(state,ARRAY['commerce','batches',$1,'quantity'],'6'::jsonb) WHERE id='test-world'",[id]);}),/does not reconcile/);
 assert.equal((await store.snapshot()).commerce?.batches[id].quantity,5);
});
async function setup(t: { after: (fn: ()=>Promise<void>)=>void }) {
  const pg = new PGlite(); await pg.waitReady; t.after(()=>pg.close());
  for(const file of (await readdir(new URL('../supabase/migrations/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort()) await pg.exec(await readFile(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));
  const database: Database = { transaction: work => pg.transaction(async tx => work({ query: async (sql,params) => tx.query(sql,params) } as Sql)) };
  const store = new PostgresWorldStore(database,'test-world'); await store.createWorld(); return { pg,database,store };
}
test('mutual relationships commit with immutable consent mirrors, roll back acceptance and blocking, and reopen without restoring ended authority',async t=>{
 const {pg,database,store}=await setup(t);let sequence=0,now=1000;
 const run=(actor:string,type:string,payload:Record<string,unknown>={})=>store.dispatch(actor,{id:'relationship_sql_'+ ++sequence,type,payload},now+=100);
 for(const actor of ['relation-ada','relation-bola'])await run(actor,'CreateCitizen',{name:actor,state:'Lagos',adultConfirmed:true});await run('relation-bola','SetPrivacy',{relationships:true});
 const offered=await run('relation-ada','InviteRelationship',{citizenId:(await store.snapshot()).citizens['relation-bola'].id,kind:'partner',termsVersion:'relationships-v1',acceptTerms:true}),r=offered.receipt.detail.relationship as import('../src/relationships.ts').Relationship,before=await store.snapshot();
 const c={id:'accept_sql_relation_once',type:'AcceptRelationship',payload:{relationshipId:r.id,relationshipVersion:1,kind:r.kind,senderCitizenId:before.citizens['relation-ada'].id,acceptedExpiresAt:r.expiresAt,termsVersion:r.termsVersion,acceptTerms:true}};
 await pg.exec("ALTER TABLE simulator.domain_records ADD CONSTRAINT fail_relation_accept CHECK(domain<>'social.relationship' OR data->>'status'<>'active')");await assert.rejects(store.dispatch('relation-bola',c,now+100));assert.deepEqual(await store.snapshot(),before);await pg.exec('ALTER TABLE simulator.domain_records DROP CONSTRAINT fail_relation_accept');await store.dispatch('relation-bola',c,now+=200);
 const reopened=new PostgresWorldStore(database,'test-world');assert.equal((await reopened.dispatch('relation-bola',c,now+100)).replayed,true);const active=await reopened.snapshot();assert.equal(active.relationships!.records[r.id].status,'active');reconcile(active);
 await assert.rejects(pg.query("UPDATE simulator.domain_records SET data=jsonb_set(data,'{kind}','\"friend\"') WHERE world_id='test-world' AND domain='social.relationship' AND id=$1",[r.id]),/terms and consent are immutable/);
 await assert.rejects(pg.transaction(async tx=>{await tx.query("UPDATE simulator.worlds SET state=jsonb_set(state,ARRAY['relationships','records',$1,'acceptedKey'],'\"relation-ada:fake_command\"') WHERE id='test-world'",[r.id]);}),/mutual consent evidence/);
 await assert.rejects(pg.transaction(async tx=>{await tx.query("UPDATE simulator.worlds SET state=jsonb_set(state,ARRAY['relationships','records',$1,'recipient'],'\"relation-ada\"') WHERE id='test-world'",[r.id]);}),/Invalid relationship terms/);
 await pg.exec("ALTER TABLE simulator.domain_records ADD CONSTRAINT fail_relation_end CHECK(domain<>'social.relationship' OR data->>'status'<>'ended')");const block={id:'block_sql_relation_once',type:'BlockCitizen',payload:{citizenId:active.citizens['relation-ada'].id}};await assert.rejects(reopened.dispatch('relation-bola',block,now+200));assert.deepEqual(await store.snapshot(),active);await pg.exec('ALTER TABLE simulator.domain_records DROP CONSTRAINT fail_relation_end');await reopened.dispatch('relation-bola',block,now+=300);
 assert.equal((await store.dispatch('relation-bola',block,now+100)).replayed,true);await run('relation-bola','UnblockCitizen',{citizenId:active.citizens['relation-ada'].id});const saved=await new PostgresWorldStore(database,'test-world').snapshot();assert.equal(saved.relationships!.records[r.id].closeReason,'blocked');assert.deepEqual(saved.balances,active.balances);reconcile(saved);
 await assert.rejects(pg.query("DELETE FROM simulator.domain_records WHERE world_id='test-world' AND domain='social.relationship' AND id=$1",[r.id]),/cannot be deleted/);
 await assert.rejects(pg.transaction(async tx=>{await tx.query("UPDATE simulator.worlds SET state=state #- ARRAY['relationships','records',$1] WHERE id='test-world'",[r.id]);}),/Orphan relationship mirror/);
 const outsider=new PostgresWorldStore(database,'other-relationship-world');await outsider.createWorld();assert.deepEqual((await outsider.snapshot()).relationships,undefined);
 await pg.exec('CREATE ROLE anon NOLOGIN');await pg.exec('SET ROLE anon');await assert.rejects(pg.query('SELECT * FROM simulator.domain_records'),/permission denied/);await pg.exec('RESET ROLE');
});
test('shared furniture claims are receipt-backed and unique in SQL, expire/release atomically and survive rollback and reopening',async t=>{
 const {pg,database,store}=await setup(t);let sequence=0,now=1000;
 const run=(actor:string,type:string,payload:Record<string,unknown>={})=>store.dispatch(actor,{id:'fixture_use_sql_'+ ++sequence,type,payload},now+=700);
 for(const actor of ['use-host','use-guest'])await run(actor,'CreateCitizen',{name:actor,state:'Lagos',adultConfirmed:true});for(const actor of ['use-host','use-guest'])for(let i=0;i<3;i++)await run(actor,'MoveCitizen',{dx:-1,dy:0});await run('use-host','EnterBuilding',{buildingId:'shelter'});
 const offered=await run('use-host','InviteHomeVisit',{citizenId:(await store.snapshot()).citizens['use-guest'].id,homeVersion:1,leaseVersion:2,durationMinutes:15,termsVersion:'home-visits-v1',acceptTerms:true}),visit=offered.receipt.detail.visit as {id:string;homeId:string;expiresAt:number};await run('use-guest','AcceptHomeVisit',{visitId:visit.id,visitVersion:1,homeId:visit.homeId,acceptedExpiresAt:visit.expiresAt,termsVersion:'home-visits-v1',acceptTerms:true});await run('use-guest','EnterBuilding',{buildingId:'visit:'+visit.id});
 for(const actor of ['use-host','use-guest'])for(const [dx,dy] of [[1,0],[1,0],[0,-1]])await run(actor,'MoveInterior',{dx,dy});
 const pose={id:'furniture_sql_pose_once',type:'InteractHomeFixture',payload:{fixtureId:'sofa',useSlot:0}},before=await store.snapshot();await pg.exec("ALTER TABLE simulator.domain_records ADD CONSTRAINT fail_fixture_use CHECK(domain<>'world.position' OR data->'activity'->>'slot' IS DISTINCT FROM '0')");await assert.rejects(store.dispatch('use-host',pose,now+700));assert.deepEqual(await store.snapshot(),before);await pg.exec('ALTER TABLE simulator.domain_records DROP CONSTRAINT fail_fixture_use');await store.dispatch('use-host',pose,now+=1400);
 const reopened=new PostgresWorldStore(database,'test-world');assert.equal((await reopened.dispatch('use-host',pose,now+1)).replayed,true);const saved=await reopened.snapshot(),hostPose=saved.world!.positions['use-host'].activity!;assert.equal(hostPose.slot,0);reconcile(saved);
 await assert.rejects(pg.transaction(async tx=>{const p={...saved.world!.positions['use-host'],activity:{...hostPose,slot:2}};await tx.query("UPDATE simulator.domain_records SET data=$1::jsonb WHERE domain='world.position' AND id='use-host'",[JSON.stringify(p)]);await tx.query("UPDATE simulator.worlds SET state=jsonb_set(state,ARRAY['world','positions','use-host'],$1::jsonb) WHERE id='test-world'",[JSON.stringify(p)]);}),/Furniture use lacks/);
 await assert.rejects(run('use-guest','InteractHomeFixture',{fixtureId:'sofa',useSlot:0}),(e:any)=>e.code==='FIXTURE_BUSY');await run('use-host','MoveInterior',{dx:1,dy:0});await run('use-guest','InteractHomeFixture',{fixtureId:'sofa',useSlot:0});
 const occupied=await reopened.snapshot();await assert.rejects(pg.transaction(async tx=>{const p={...occupied.world!.positions['use-host'],activity:hostPose};await tx.query("UPDATE simulator.domain_records SET data=$1::jsonb WHERE domain='world.position' AND id='use-host'",[JSON.stringify(p)]);await tx.query("UPDATE simulator.worlds SET state=jsonb_set(state,ARRAY['world','positions','use-host'],$1::jsonb) WHERE id='test-world'",[JSON.stringify(p)]);}),/slot is already occupied/);
 now=occupied.world!.positions['use-guest'].activity!.startedAt+10000;await run('use-host','InteractHomeFixture',{fixtureId:'sofa',useSlot:0});const expired=await new PostgresWorldStore(database,'test-world').snapshot();assert.equal(expired.world!.positions['use-guest'].activity,undefined);assert.equal(expired.world!.positions['use-host'].activity!.slot,0);assert.deepEqual(expired.balances,before.balances);reconcile(expired);
});
test('home visit consent, guest movement and revocation commit atomically; immutable SQL mirrors reject unsupported access and survive reopening',async t=>{
 const {pg,database,store}=await setup(t);let sequence=0,now=1000;
 const run=(actor:string,type:string,payload:Record<string,unknown>={})=>store.dispatch(actor,{id:'visit_database_'+ ++sequence,type,payload},now+=700);
 for(const actor of ['visit-host','visit-guest','visit-other'])await run(actor,'CreateCitizen',{name:actor,state:'Lagos',adultConfirmed:true});
 for(const actor of ['visit-host','visit-guest'])for(let i=0;i<3;i++)await run(actor,'MoveCitizen',{dx:-1,dy:0});await run('visit-host','EnterBuilding',{buildingId:'shelter'});
 const home=(await store.snapshot()).world!.positions['visit-host'].homeId!,offered=await run('visit-host','InviteHomeVisit',{citizenId:(await store.snapshot()).citizens['visit-guest'].id,homeVersion:1,leaseVersion:2,durationMinutes:15,termsVersion:'home-visits-v1',acceptTerms:true}),v=offered.receipt.detail.visit as {id:string;expiresAt:number},id=v.id;
 await assert.rejects(pg.query("UPDATE simulator.domain_records SET data=jsonb_set(data,'{expiresAt}','1'::jsonb) WHERE domain='furnishing.visit' AND id=$1",[id]),/immutable/);
 await assert.rejects(pg.transaction(async tx=>{await tx.query("UPDATE simulator.domain_records SET data=jsonb_set(jsonb_set(data,'{status}','\"accepted\"'::jsonb),'{version}','2'::jsonb) WHERE domain='furnishing.visit' AND id=$1",[id]);}),/mirror mismatch/);
 const accept={id:'home_visit_sql_accept_once',type:'AcceptHomeVisit',payload:{visitId:id,visitVersion:1,homeId:home,acceptedExpiresAt:v.expiresAt,termsVersion:'home-visits-v1',acceptTerms:true}};
 await pg.exec("ALTER TABLE simulator.domain_records ADD CONSTRAINT fail_visit_consent CHECK(domain<>'furnishing.visit' OR data->>'status'<>'accepted')");const before=await store.snapshot();await assert.rejects(store.dispatch('visit-guest',accept,now+700));assert.deepEqual(await store.snapshot(),before);
 await pg.exec('ALTER TABLE simulator.domain_records DROP CONSTRAINT fail_visit_consent');await store.dispatch('visit-guest',accept,now+=1400);const reopened=new PostgresWorldStore(database,'test-world');assert.equal((await reopened.dispatch('visit-guest',accept,now+1)).replayed,true);
 await run('visit-guest','EnterBuilding',{buildingId:'visit:'+id,leaseVersion:1});await run('visit-guest','MoveInterior',{dx:1,dy:0,leaseVersion:2});
 const inside=await reopened.snapshot();reconcile(inside);assert.equal(inside.world!.positions['visit-guest'].homeId,home);assert.equal((await pg.query("SELECT * FROM simulator.domain_records WHERE domain='furnishing.visit'")).rows.length,1);
 await assert.rejects(pg.transaction(async tx=>{await tx.query("UPDATE simulator.worlds SET state=jsonb_set(state,ARRAY['furnishing','visits',$1,'acceptedKey'],'\"visit-other:forged\"'::jsonb) WHERE id='test-world'",[id]);}),/guest consent evidence/);
 await assert.rejects(pg.transaction(async tx=>{const position={...inside.world!.positions['visit-guest']};await tx.query("UPDATE simulator.domain_records SET data=$1::jsonb WHERE domain='world.position' AND id='visit-other'",[JSON.stringify(position)]);await tx.query("UPDATE simulator.worlds SET state=jsonb_set(state,ARRAY['world','positions','visit-other'],$1::jsonb) WHERE id='test-world'",[JSON.stringify(position)]);}),/guest position/);
 const end={id:'home_visit_sql_withdraw_once',type:'WithdrawHomeVisit',payload:{visitId:id,visitVersion:2}};
 await pg.exec("ALTER TABLE simulator.domain_records ADD CONSTRAINT fail_visit_ejection CHECK(domain<>'furnishing.visit' OR data->>'status'<>'ended')");const preserved=await store.snapshot();await assert.rejects(reopened.dispatch('visit-host',end,now+700));assert.deepEqual(await store.snapshot(),preserved);assert.equal((await pg.query<{data:{visitId:string}}>("SELECT data FROM simulator.domain_records WHERE domain='world.position' AND id='visit-guest'")).rows[0].data.visitId,id);
 await pg.exec('ALTER TABLE simulator.domain_records DROP CONSTRAINT fail_visit_ejection');await reopened.dispatch('visit-host',end,now+=1400);assert.equal((await store.dispatch('visit-host',end,now+1)).replayed,true);
 const ended=await new PostgresWorldStore(database,'test-world').snapshot();assert.equal(ended.world!.positions['visit-guest'].interior,null);assert.equal(ended.world!.positions['visit-guest'].leaseVersion,3);assert.equal(ended.furnishing!.visits![id].closeReason,'withdrawn');assert.deepEqual(ended.balances,preserved.balances);reconcile(ended);
 await assert.rejects(pg.query("UPDATE simulator.domain_records SET data=jsonb_set(data,'{status}','\"accepted\"'::jsonb) WHERE domain='furnishing.visit' AND id=$1",[id]),/immutable/);await assert.rejects(pg.query("DELETE FROM simulator.domain_records WHERE domain='furnishing.visit' AND id=$1",[id]),/cannot be deleted/);
 await assert.rejects(pg.transaction(async tx=>{await tx.query("UPDATE simulator.worlds SET state=state #- ARRAY['furnishing','visits',$1] WHERE id='test-world'",[id]);}),/mirror count/);
 // A later unrelated command settles expiry without exposing the private record.
 const second=await run('visit-host','InviteHomeVisit',{citizenId:ended.citizens['visit-guest'].id,homeVersion:1,leaseVersion:2,durationMinutes:15,termsVersion:'home-visits-v1',acceptTerms:true}),other=second.receipt.detail.visit as {id:string;expiresAt:number};
 const expired=await store.dispatch('visit-other',{id:'visit_sql_expiry_once',type:'BuyBasicMeal',payload:{}},other.expiresAt);assert.ok(!JSON.stringify(expired.receipt).includes(other.id));reconcile(await reopened.snapshot());assert.equal((await pg.query<{data:{closeReason:string}}>("SELECT data FROM simulator.domain_records WHERE domain='furnishing.visit' AND id=$1",[other.id])).rows[0].data.closeReason,'expired');
 await pg.exec('CREATE ROLE visit_anon');await assert.rejects(pg.transaction(async tx=>{await tx.exec('SET LOCAL ROLE visit_anon');await tx.query("SELECT * FROM simulator.domain_records WHERE domain='furnishing.visit'");}),/permission denied/);
 await pg.transaction(async tx=>{await tx.exec('SET LOCAL ROLE simulator_server');await tx.query("SELECT set_config('simulator.world_id','other-world',true)");assert.equal((await tx.query("SELECT * FROM simulator.domain_records WHERE domain='furnishing.visit'")).rows.length,0);});
});
test('private residence entry rolls back every mirror on SQL failure and door, parking and moving survive reopening',async t=>{
 const {pg,database,store}=await setup(t),actor='door-database';let sequence=0,now=1000;
 const run=(type:string,payload:Record<string,unknown>={})=>store.dispatch(actor,{id:'door_database_'+ ++sequence,type,payload},now+=700);
 await run('CreateCitizen',{name:'Door Resident',state:'Lagos',adultConfirmed:true});const reservation=await run('ReservePropertyPurchase',{propertyId:'npc-Lagos-home',acceptedTotal:512500,acceptTerms:true});await run('CompletePropertyPurchase',{purchaseId:reservation.receipt.detail.purchaseId});
 await assert.rejects(run('EnterBuilding',{buildingId:'shelter'}),(e:any)=>e.code==='INVALID_BUILDING');for(let i=0;i<20;i++)await run('MoveCitizen',{dx:1,dy:0});
 const before=await store.snapshot(),entry={id:'private_database_entry_once',type:'EnterBuilding',payload:{buildingId:'residence:npc-Lagos-home',leaseVersion:1}};
 await pg.exec("ALTER TABLE simulator.domain_records ADD CONSTRAINT test_private_entry_failure CHECK (domain<>'world.position' OR data->>'homeId' IS DISTINCT FROM 'npc-Lagos-home')");
 await assert.rejects(store.dispatch(actor,entry,now+1000));assert.deepEqual(await store.snapshot(),before);assert.equal((await pg.query("SELECT * FROM simulator.domain_records WHERE domain='furnishing.home' AND id='npc-Lagos-home'")).rows.length,0);
 await pg.exec('ALTER TABLE simulator.domain_records DROP CONSTRAINT test_private_entry_failure');await store.dispatch(actor,entry,now+=1500);
 const reopened=new PostgresWorldStore(database,'test-world');assert.equal((await reopened.dispatch(actor,entry,now+100)).replayed,true);const saved=await reopened.snapshot();assert.equal(saved.world!.positions[actor].homeId,'npc-Lagos-home');assert.equal(saved.world!.positions[actor].leaseVersion,2);assert.equal((await pg.query("SELECT * FROM simulator.domain_records WHERE domain='furnishing.item' AND data->>'homeId'='npc-Lagos-home'")).rows.length,6);reconcile(saved);
 await run('ExitBuilding',{leaseVersion:2});const car=await run('BuyNPCVehicle',{modelId:'compact',acceptedPrice:300000,acceptTerms:true});await run('ParkVehicle',{vehicleId:car.receipt.detail.vehicleId,slot:2});
 await run('SetResidence',{propertyId:null,acceptTerms:true});const moved=await new PostgresWorldStore(database,'test-world').snapshot();assert.equal(moved.citizens[actor].housing,'Starter accommodation');assert.equal(Object.values(moved.furnishing!.parking)[0].status,'released');assert.ok(Object.values(moved.furnishing!.items).filter(i=>i.owner===actor).every(i=>i.placement===null));assert.equal(moved.property!.assets['npc-Lagos-home'].owner,actor);reconcile(moved);
});
test('staff changes and append-only audits commit together, survive restart and reject unsupported authority or cross-world access',async t=>{
 const {pg,database,store}=await setup(t),roots=['00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002'],at=1000000,reason='Independent operational permission review';
 await store.bootstrapStaff(roots,reason,at);assert.equal((await pg.query('SELECT * FROM simulator.staff_grants')).rows.length,2);
 const session=(actor:string)=>({sessionId:'staff-session-'+actor,assurance:'aal2' as const,stepUpAt:at}),run=async(actor:string,id:string,type:string,payload:Record<string,unknown>)=>store.dispatch(actor,{id,type,payload:{adminVersion:(await store.snapshot()).administration!.version,...payload}},at,session(actor).sessionId,{administration:{session:session(actor)}});
 const proposed=await run(roots[0],'staff_sql_propose','ProposeStaffChange',{action:'grant',targetActorId:roots[1],role:'economy',region:'Lagos',grantUntil:at+DAY,reason}),id=String(proposed.receipt.detail.proposalId);
 const p=(await store.snapshot()).administration!.proposals[id];await run(roots[1],'staff_sql_review','DecideStaffChange',{proposalId:id,proposalVersion:p.version,signature:p.signature,approve:true,reason});
 await assert.rejects(pg.query("UPDATE simulator.staff_proposals SET version=version+1,data=jsonb_set(jsonb_set(data,'{role}','\"technical\"'),'{version}',to_jsonb(version+1)) WHERE id=$1",[id]),/Staff/);
 const ready=(await store.snapshot()).administration!.proposals[id],apply:Command={id:'staff_sql_apply',type:'ApplyStaffChange',payload:{adminVersion:3,proposalId:id,proposalVersion:ready.version,signature:ready.signature}},context={administration:{session:session(roots[0])}};
 await pg.exec('ALTER TABLE simulator.staff_audit ADD CONSTRAINT fail_staff_application CHECK(sequence<4)');
 await assert.rejects(store.dispatch(roots[0],apply,at,session(roots[0]).sessionId,context));assert.equal((await store.snapshot()).administration!.version,3);assert.equal((await pg.query('SELECT * FROM simulator.staff_grants')).rows.length,2);
 await pg.exec('ALTER TABLE simulator.staff_audit DROP CONSTRAINT fail_staff_application');
 const reopened=new PostgresWorldStore(database,'test-world'),applied=await reopened.dispatch(roots[0],apply,at,session(roots[0]).sessionId,context);assert.equal((await store.dispatch(roots[0],apply,at+1,session(roots[0]).sessionId,context)).replayed,true);
 const state=await reopened.snapshot();reconcile(state);assert.equal(state.administration!.audit.length,4);assert.equal(Object.keys(state.citizens).length,0);assert.equal(state.journals.length,0);assert.equal(applied.receipt.detail.adminVersion,4);
 await assert.rejects(pg.exec("UPDATE simulator.staff_audit SET data=jsonb_set(data,'{reason}','\"Changed\"')"),/append only/);
 await assert.rejects(pg.exec('DELETE FROM simulator.staff_audit'),/append only/);
 await assert.rejects(pg.transaction(async tx=>{await tx.query("UPDATE simulator.worlds SET state=state-'administration' WHERE id='test-world'");}),/cannot be removed/);
 await assert.rejects(pg.transaction(async tx=>{await tx.query("UPDATE simulator.worlds SET state=jsonb_set(state,ARRAY['administration','grants','staff-root-1','role'],'\"technical\"') WHERE id='test-world'");}),/mirror/);
 await pg.transaction(async tx=>{await tx.exec('SET LOCAL ROLE simulator_server');await tx.query("SELECT set_config('simulator.world_id','other-world',true)");assert.equal((await tx.query('SELECT * FROM simulator.staff_grants')).rows.length,0);assert.equal((await tx.query('SELECT * FROM simulator.staff_audit')).rows.length,0);});
 await pg.exec('CREATE ROLE anon NOLOGIN');await assert.rejects(pg.transaction(async tx=>{await tx.exec('SET LOCAL ROLE anon');await tx.query('SELECT * FROM simulator.staff_grants');}),/permission denied/);
});
test('client fencing commits atomically with SQL mirrors, survives restart and rejects stale writers, tampering and revoked public presence',async t=>{
 const {pg,database}=await setup(t),store=new PostgresWorldStore(database,'test-world',{requireConnection:true}),actor='citizen-one',sid='session-one',at=Date.now();
 const id='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
 const claim={id,claimId:id},first=(await store.claimClient(actor,sid,claim,false,at)).clientLease;
 assert.deepEqual((await store.claimClient(actor,sid,claim,false,at+1)).clientLease,first);
 assert.equal((await pg.query('SELECT * FROM simulator.client_sessions')).rows.length,1);
 await assert.rejects(store.dispatch(actor,command,at+2,sid),/Reconnect this tab/);assert.equal((await store.snapshot()).outbox.length,0);
 const committed=await store.dispatch(actor,command,at+3,sid,{clientLease:first});
 const reopened=new PostgresWorldStore(database,'test-world',{requireConnection:true}),newer=(await reopened.claimClient(actor,sid,{id,claimId:other},false,at+4)).clientLease;
 assert.equal(newer.epoch,2);await assert.rejects(store.dispatch(actor,{id:'fenced_meal_sql',type:'BuyBasicMeal',payload:{}},at+5,sid,{clientLease:first}),/Reconnect this tab/);
 assert.deepEqual((await store.dispatch(actor,command,at+5,sid,{clientLease:first})).receipt,committed.receipt);
 await assert.rejects(pg.query("UPDATE simulator.client_sessions SET epoch=1,data=jsonb_set(data,'{epoch}','1'::jsonb) WHERE world_id='test-world'"),/cannot be reversed/);
 await assert.rejects(pg.transaction(async tx=>{await tx.query("UPDATE simulator.worlds SET state=jsonb_set(state,ARRAY['sessions','leases',$1,'epoch'],'99'::jsonb) WHERE id='test-world'",[actor]);}),/mirror mismatch/);
 const before=await reopened.snapshot();const broken:Database={transaction:work=>database.transaction(sql=>work({query:async(query,params)=>{if(query.startsWith('UPDATE simulator.worlds SET state=$2'))throw Error('Lease write failed');return sql.query(query,params);}}))};
 await assert.rejects(new PostgresWorldStore(broken,'test-world').claimClient(actor,sid,{id:other,claimId:other},true,at+6),/Lease write failed/);
 assert.deepEqual(await reopened.snapshot(),before);assert.equal((await pg.query<{epoch:number}>('SELECT epoch FROM simulator.client_sessions')).rows[0].epoch,2);
 await pg.query("INSERT INTO simulator.revoked_sessions(world_id,session_id,reason) VALUES ('test-world',$1,'emergency')",[sid]);
 const live=await reopened.liveState([]);assert.deepEqual(live.revokedSessionIds,[sid]);assert.equal(live.state.sessions!.leases[actor].status,'released');assert.equal((await reopened.snapshot()).sessions!.leases[actor].status,'active');
 await assert.rejects(reopened.renewClient(actor,sid,newer,at+7),/Sign in again/);await assert.rejects(reopened.dispatch(actor,command,at+7,sid,{clientLease:newer}),/Sign in again/);
 await pg.exec('CREATE ROLE lease_anonymous');await assert.rejects(pg.transaction(async tx=>{await tx.exec('SET LOCAL ROLE lease_anonymous');await tx.query('SELECT * FROM simulator.client_sessions');}),/permission denied/);
 const otherWorld=new PostgresWorldStore(database,'other-lease-world');await otherWorld.createWorld();await assert.rejects(database.transaction(async sql=>{await sql.query('SET LOCAL ROLE simulator_server');await sql.query("SELECT set_config('simulator.world_id','other-lease-world',true),set_config('simulator.actor_id',$1,true)",[actor]);await sql.query("UPDATE simulator.client_sessions SET data=data WHERE world_id='test-world' RETURNING actor_id").then(r=>assert.equal(r.rows.length,0));throw Error('verified isolation');}),/verified isolation/);
});
test('guided foundation and tuition records commit with receipts and survive database reopening',async t=>{
 const {pg,database,store}=await setup(t),actor='citizen-one';let sequence=0;
 const run=(type:string,payload:Record<string,unknown>,now:number)=>store.dispatch(actor,{id:'edu_database_'+ ++sequence,type,payload},now);
 await store.dispatch(actor,command,100);
 for(let i=0;i<3;i++)await run('MoveCitizen',{dx:-1,dy:0},500+i*250);
 await run('EnterBuilding',{buildingId:'shelter'},2000);await run('ExitBuilding',{},2001);await run('BuyBasicMeal',{},2002);
 await prepareStoredWork(store,actor,3000);await run('CompleteShift',{},63000);
 await run('ChooseGoal',{goal:'business'},63001);
 for(let day=1;day<=5;day++){const now=100+(day-1)*DAY+(day===1?64000:0);if(day===2)await run('SetPrivacy',{dm:false,location:false,presence:false},now);for(const task of PRACTICALS[day-1])await run('FoundationPractice',{day,choice:task.correct},now);await run('CompleteLesson',{day},now);}
 const reopened=new PostgresWorldStore(database,'test-world');await reopened.dispatch(actor,{id:'exam_database_pass',type:'SubmitExam',payload:examPayload(await reopened.snapshot(),actor)},100+4*DAY);
 const enrolled=await run('EnrollCourse',{courseId:'secondary',acceptedFee:50000,acceptTerms:true},100+5*DAY);const id=enrolled.receipt.detail.enrolmentId;
 assert.equal((await pg.query("SELECT * FROM simulator.domain_records WHERE domain='education.enrolment'")).rows.length,1);
 assert.equal((await reopened.snapshot()).balances['tuition:'+id],50000);
 await pg.exec("ALTER TABLE simulator.domain_records ADD CONSTRAINT reject_cancel CHECK (domain <> 'education.enrolment' OR data->>'status' <> 'cancelled')");
 const cancel={id:'cancel_database_course',type:'CancelCourse',payload:{enrolmentId:id}};await assert.rejects(reopened.dispatch(actor,cancel,100+5*DAY+1000));assert.equal((await store.snapshot()).balances['tuition:'+id],50000);
 await pg.exec('ALTER TABLE simulator.domain_records DROP CONSTRAINT reject_cancel');await reopened.dispatch(actor,cancel,100+5*DAY+1000);assert.equal((await store.dispatch(actor,cancel,100+6*DAY)).replayed,true);assert.equal((await store.snapshot()).balances['tuition:'+id],0);
});
test('PostgreSQL stores one balanced settlement, receipt and outbox across retries and reopening', async t => {
  const { pg,database,store } = await setup(t);
  const results=await Promise.all(Array.from({length:8},()=>store.dispatch('citizen-one',command,100)));
  assert.equal(results.filter(r=>!r.replayed).length,1);
  assert.equal((await store.snapshot()).balances['citizen:citizen-one'],RULES.starterCash);
  const reopened=new PostgresWorldStore(database,'test-world');
  assert.equal((await reopened.dispatch('citizen-one',command,999)).replayed,true);
  assert.equal((await pg.query<{sum:string}>('SELECT sum(amount)::text AS sum FROM simulator.journal_lines')).rows[0].sum,'0');
  assert.equal((await pg.query('SELECT * FROM simulator.commands')).rows.length,1);
  assert.equal((await store.events(0)).length,1);
  await assert.rejects(store.dispatch('citizen-one',{...command,payload:{...command.payload,state:'Kano'}},100),/different action/);
});
test('a failed database commit rolls back state, money, receipt and outbox', async t => {
  const { pg,database,store }=await setup(t);
  // Force a database constraint failure after the domain has produced a valid result.
  await pg.exec("ALTER TABLE simulator.outbox ADD CONSTRAINT reject_test_event CHECK (type <> 'CreateCitizen')");
  await assert.rejects(store.dispatch('citizen-one',command,100));
  assert.equal(Object.keys((await store.snapshot()).citizens).length,0);
  for(const table of ['citizens','accounts','journals','journal_lines','commands','outbox']) assert.equal((await pg.query('SELECT * FROM simulator.'+table)).rows.length,0);
  await pg.exec('ALTER TABLE simulator.outbox DROP CONSTRAINT reject_test_event');
  await new PostgresWorldStore(database,'test-world').dispatch('citizen-one',command,200);
  assert.equal((await store.events(0)).length,1);
});
test('SQL rejects unbalanced journals, balance editing, record mutation and cross-world access', async t => {
  const { pg,store }=await setup(t); await store.dispatch('citizen-one',command,100);
  await assert.rejects(pg.transaction(async tx=>{await tx.query("UPDATE simulator.accounts SET balance=balance+1 WHERE id='citizen:citizen-one'");}),/does not match/);
  await assert.rejects(pg.query('UPDATE simulator.journals SET reason=$1',['tampered']),/immutable/);
  await assert.rejects(pg.transaction(async tx=>{await tx.query("INSERT INTO simulator.journals(world_id,id,occurred_at,reason) VALUES ('test-world','bad',now(),'invalid')");}),/at least two/);
  await pg.transaction(async tx=>{
    await tx.exec("SET LOCAL ROLE simulator_server; SELECT set_config('simulator.world_id','other-world',true)");
    assert.equal((await tx.query('SELECT * FROM simulator.accounts')).rows.length,0);
    assert.equal((await tx.query("UPDATE simulator.worlds SET id='other-world' WHERE id='test-world' RETURNING id")).rows.length,0);
  });
  await pg.exec('CREATE ROLE anonymous_client');
  await assert.rejects(pg.transaction(async tx=>{await tx.exec('SET LOCAL ROLE anonymous_client');await tx.query('SELECT * FROM simulator.accounts');}),/permission denied/);
});
test('worlds isolate starter entitlements and revoked sessions cannot commit', async t => {
  const { pg,database,store }=await setup(t);const other=new PostgresWorldStore(database,'other-world');await other.createWorld();
  await store.dispatch('citizen-one',command,100); await other.dispatch('citizen-one',command,100);
  assert.equal((await pg.query('SELECT * FROM simulator.commands')).rows.length,2);
  await pg.query("INSERT INTO simulator.revoked_sessions(world_id,session_id,reason) VALUES ('test-world','revoked','recovery')");
  await assert.rejects(store.dispatch('citizen-one',{id:'meal_database_01',type:'BuyBasicMeal',payload:{}},200,'revoked'),/Sign in again/);
  assert.equal((await store.snapshot()).balances['citizen:citizen-one'],RULES.starterCash);
  await assert.rejects(store.snapshot('citizen-one','revoked'),/Sign in again/);
  await assert.rejects(store.dispatch('citizen-one',{id:'meal_database_02',type:'BuyBasicMeal',payload:{},expectedVersion:0},200),/record changed/);
  await assert.rejects(store.dispatch('citizen-one',{id:'meal_database_03',type:'BuyBasicMeal',payload:{},worldId:'other-world'},200),/selected world/);
});
test('authenticated HTTP commands use verified identities and durable PostgreSQL receipts',async t=>{
  const {pg,store}=await setup(t);
  const first='00000000-0000-4000-8000-000000000001',second='00000000-0000-4000-8000-000000000002',session='00000000-0000-4000-8000-000000000003';
  const token=(actor:string)=>'header.'+Buffer.from(JSON.stringify({sub:actor,session_id:session,exp:Math.floor(Date.now()/1000)+600})).toString('base64url')+'.signature';
  const firstToken=token(first),secondToken=token(second);
  const tokens=new Map([[firstToken,first],[secondToken,second]]);
  const auth=supabaseAuthenticator('https://example.supabase.co','sb_publishable_test',async(_url,options)=>{
    const access=new Headers(options?.headers).get('authorization')?.slice(7),id=tokens.get(access??'');
    return new Response(JSON.stringify(id?{id}:{error:'invalid'}),{status:id?200:401});
  });
  const server=createApp({store,authenticate:req=>auth(req.headers.authorization)});
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise<void>(resolve=>server.close(()=>resolve())));
  const address=server.address();if(!address||typeof address==='string')throw new Error('Missing address');const origin='http://127.0.0.1:'+address.port;
  assert.equal((await fetch(origin+'/api/citizen')).status,401);
  const post=(actor:string,body:unknown)=>fetch(origin+'/api/commands',{method:'POST',headers:{Authorization:'Bearer '+(actor===first?firstToken:secondToken),'Content-Type':'application/json'},body:JSON.stringify(body)});
  const firstCommand={...command,payload:{...command.payload,actorId:second,role:'super_admin'}};
  assert.equal((await post(first,firstCommand)).status,200);
  assert.equal((await post(second,{...command,payload:{...command.payload,name:'Bola'}})).status,200);
  const replay=await (await post(first,firstCommand)).json();assert.equal(replay.replayed,true);assert.equal(replay.view.citizen.actorId,first);assert.ok(replay.view.receipts.every((r:{actorId:string})=>r.actorId===first));
  const meal={id:'http_meal_0001',type:'BuyBasicMeal',payload:{actorId:second}};
  assert.equal((await post(first,meal)).status,200);assert.equal((await post(first,meal)).status,200);
  const snapshot=await store.snapshot();assert.equal(snapshot.balances['citizen:'+first],RULES.starterCash-RULES.basicMealCost);assert.equal(snapshot.balances['citizen:'+second],RULES.starterCash);
  assert.equal((await pg.query('SELECT * FROM simulator.commands')).rows.length,3);
});
test('property title, deposits and purchase settlement survive reopening and SQL rejects forged reserves',async t=>{
 const {pg,database,store}=await setup(t);await store.dispatch('citizen-one',command,10*DAY);
 const reserve=await store.dispatch('citizen-one',{id:'reserve_house_sql',type:'ReservePropertyPurchase',payload:{propertyId:'npc-Lagos-home',acceptedTotal:512500,acceptTerms:true}},10*DAY);
 const purchaseId=String(reserve.receipt.detail.purchaseId);assert.equal((await pg.query("SELECT * FROM simulator.domain_records WHERE domain='property.purchase'")).rows.length,1);
 const reopened=new PostgresWorldStore(database,'test-world'),settle={id:'complete_house_sql',type:'CompletePropertyPurchase',payload:{purchaseId}};await reopened.dispatch('citizen-one',settle,10*DAY+100);assert.equal((await store.dispatch('citizen-one',settle,10*DAY+101)).replayed,true);
 await store.dispatch('citizen-two',{...command,id:'create_tenant_sql'},10*DAY);
 const offer=await store.dispatch('citizen-one',{id:'rental_offer_sql',type:'OfferTenancy',payload:{propertyId:'npc-Lagos-home',rent:10000,deposit:20000}},10*DAY+200);
 const accepted=await reopened.dispatch('citizen-two',{id:'accept_rental_sql',type:'AcceptTenancy',payload:{rentalId:offer.receipt.detail.rentalId,acceptedRent:10000,acceptedDeposit:20000,acceptTerms:true}},10*DAY+300),tenancyId=String(accepted.receipt.detail.tenancyId);
 await assert.rejects(pg.transaction(async tx=>{await tx.query("UPDATE simulator.worlds SET state=jsonb_set(state,ARRAY['property','tenancies',$1,'deposit'],'1'::jsonb) WHERE id='test-world'",[tenancyId]);}),/reserve does not reconcile/);
 await assert.rejects(pg.transaction(async tx=>{await tx.query("UPDATE simulator.worlds SET state=jsonb_set(state,ARRAY['property','assets','npc-Lagos-home','owner'],'\"citizen-two\"'::jsonb) WHERE id='test-world'");}),/records do not match/);
 assert.equal((await reopened.snapshot()).balances['deposit:'+tenancyId],20000);
});
test('vehicle tank stock, title and cash reserves persist and SQL rejects phantom fuel',async t=>{
 const {pg,database,store}=await setup(t);await store.dispatch('citizen-one',command,10*DAY);
 const buy=await store.dispatch('citizen-one',{id:'buy_vehicle_sql',type:'BuyNPCVehicle',payload:{modelId:'compact',acceptedPrice:300000,acceptTerms:true}},10*DAY),vehicleId=String(buy.receipt.detail.vehicleId);
 await store.dispatch('citizen-one',{id:'buy_vehicle_fuel_sql',type:'BuyNPCSupply',payload:{goodsId:'fuel',quantity:10,acceptedUnitPrice:300}},10*DAY);
 const refuel={id:'refuel_vehicle_sql',type:'RefuelVehicle',payload:{vehicleId,litres:10}};await store.dispatch('citizen-one',refuel,10*DAY);assert.equal((await new PostgresWorldStore(database,'test-world').dispatch('citizen-one',refuel,10*DAY+100)).replayed,true);
 assert.equal((await pg.query("SELECT * FROM simulator.domain_records WHERE domain='mobility.vehicle'")).rows.length,1);
 await assert.rejects(pg.transaction(async tx=>{await tx.query("UPDATE simulator.worlds SET state=jsonb_set(state,ARRAY['mobility','vehicles',$1,'fuel'],'11'::jsonb) WHERE id='test-world'",[vehicleId]);}),/tank does not reconcile/);
 const snapshot=await store.snapshot();assert.equal(snapshot.mobility!.vehicles[vehicleId].fuel,10);assert.equal(snapshot.commerce!.stock!.balances['fuel:vehicle:'+vehicleId],10);
});
test('clinical recovery, supply journals and unearned-fee reserves survive database reopening',async t=>{
 const {pg,database,store}=await setup(t),actor='citizen-one',now=10*DAY;await store.dispatch(actor,command,now);
 const intake=await store.dispatch(actor,{id:'clinical_intake_sql',type:'RequestAssessment',payload:{providerId:'npc',acceptedConsultation:0,consent:true}},now),caseId=String(intake.receipt.detail.caseId);
 await store.dispatch(actor,{id:'clinical_assess_sql',type:'AssessPatient',payload:{caseId,choice:0}},now+2000);
 await store.dispatch(actor,{id:'clinical_accept_sql',type:'AcceptTreatment',payload:{caseId,acceptedFee:0,acceptTerms:true}},now+2001);
 await store.dispatch(actor,{id:'clinical_treat_sql',type:'TreatPatient',payload:{caseId,choice:0}},now+2002);
 const reopened=new PostgresWorldStore(database,'test-world'),finish={id:'clinical_finish_sql',type:'CompleteRecovery',payload:{caseId}};await reopened.dispatch(actor,finish,now+62002);assert.equal((await store.dispatch(actor,finish,now+63000)).replayed,true);
 assert.equal((await pg.query("SELECT * FROM simulator.domain_records WHERE domain='healthcare.case'")).rows.length,1);
 await assert.rejects(pg.transaction(async tx=>{await tx.query("UPDATE simulator.worlds SET state=jsonb_set(state,ARRAY['healthcare','cases',$1,'status'],'\"funded\"'::jsonb) WHERE id='test-world'",[caseId]);}),/Clinical records do not match snapshot/);
 assert.equal((await reopened.snapshot()).healthcare!.cases[caseId].status,'completed');
});
test('insurance coverage and premium stay reserved across recovery and SQL rejects unfunded policy edits',async t=>{
 const {pg,database,store}=await setup(t),now=10*DAY,actor='citizen-one';await store.dispatch(actor,command,now);
 const buy={id:'buy_policy_sql',type:'BuyInsurance',payload:{providerId:'npc',coverage:'health',acceptedPremium:5000,acceptedLimit:50000,acceptedExcess:5000,acceptTerms:true}},policy=await store.dispatch(actor,buy,now),policyId=String(policy.receipt.detail.policyId);assert.equal((await new PostgresWorldStore(database,'test-world').dispatch(actor,buy,now+100)).replayed,true);
 assert.equal((await pg.query("SELECT * FROM simulator.domain_records WHERE domain='insurance.policy'")).rows.length,1);
 await assert.rejects(pg.transaction(async tx=>{await tx.query("UPDATE simulator.worlds SET state=jsonb_set(state,ARRAY['insurance','policies',$1,'remaining'],'60000'::jsonb) WHERE id='test-world'",[policyId]);}),/coverage does not reconcile/);
 const cancel={id:'cancel_policy_sql',type:'CancelInsurance',payload:{policyId}};await store.dispatch(actor,cancel,now+1000);assert.equal((await store.dispatch(actor,cancel,now+1001)).replayed,true);assert.equal((await store.snapshot()).balances['policy:'+policyId],0);assert.equal((await store.snapshot()).balances['citizen:'+actor],RULES.starterCash);
});
test('real property exposure and paid invoice persist with immutable incident evidence',async t=>{
 const {pg,database,store}=await setup(t),start=10*DAY,actor='citizen-one';let sequence=0;const run=(type:string,payload:Record<string,unknown>,at:number)=>store.dispatch(actor,{id:'incident_database_'+ ++sequence,type,payload},at);await store.dispatch(actor,command,start);
 const reserve=await run('ReservePropertyPurchase',{propertyId:'npc-Lagos-home',acceptedTotal:512500,acceptTerms:true},start);await run('CompletePropertyPurchase',{purchaseId:reserve.receipt.detail.purchaseId},start);await run('ConnectUtilities',{propertyId:'npc-Lagos-home',acceptedFee:5000},start);
 for(let day=1;day<=44;day++)await run('InspectProperty',{propertyId:'npc-Lagos-home'},start+day*DAY);
 const at=start+47*DAY;for(const [goodsId,quantity,acceptedUnitPrice] of [['energy',2,200],['water',4,100],['materials',2,2000]] as const)await run('BuyNPCSupply',{goodsId,quantity,acceptedUnitPrice},at);
 const {incidentRoll}=await import('../src/incidents.ts'),snapshot=await store.snapshot(),fire={id:'verified_fire_database',type:'UseHomeUtilities',payload:{propertyId:'npc-Lagos-home',acceptedBill:800}};for(let n=0;n<10000;n++){snapshot.life!.seed='isolated-database-secret-'+n;if(incidentRoll(snapshot,actor+':'+fire.id)<1)break;}
 // Test-only deterministic private randomness. No player command can edit this seed.
 await pg.query("UPDATE simulator.worlds SET state=jsonb_set(state,ARRAY['life','seed'],to_jsonb($1::text)) WHERE id='test-world'",[snapshot.life!.seed]);
 await store.dispatch(actor,fire,at);await run('RepairProperty',{propertyId:'npc-Lagos-home',acceptedFee:10000},at+1000);const reopened=new PostgresWorldStore(database,'test-world'),incident=Object.values((await reopened.snapshot()).incidents!.records)[0];assert.equal(incident.invoice!.amount,10000);assert.equal(incident.healthAfter,80);
 await assert.rejects(pg.query("UPDATE simulator.domain_records SET data=jsonb_set(data,'{loss}','100000'::jsonb) WHERE domain='incident.record'"),/evidence is immutable/);
 assert.equal((await reopened.snapshot()).incidents!.records[incident.id].loss,10000);
});
test('furniture ownership and layout commit with receipts; SQL rejects forged acquisition and rolls back failed placement',async t=>{
 const {pg,database,store}=await setup(t);await store.dispatch('citizen-one',command,100);
 for(let i=0;i<3;i++)await store.dispatch('citizen-one',{id:'furniture_walk_'+i,type:'MoveCitizen',payload:{dx:-1,dy:0}},500+i*300);
 await store.dispatch('citizen-one',{id:'furniture_enter',type:'EnterBuilding',payload:{buildingId:'shelter'}},2000);
 const buy={id:'furniture_database_buy',type:'BuyFurniture',payload:{modelId:'armchair',acceptedPrice:25000,finish:'navy',acceptTerms:true}},bought=await store.dispatch('citizen-one',buy,3000),id=String(bought.receipt.detail.furnitureId);
 assert.equal((await new PostgresWorldStore(database,'test-world').dispatch('citizen-one',buy,3001)).replayed,true);
 const place={id:'furniture_database_place',type:'PlaceFurniture',payload:{furnitureId:id,x:9,y:6,rotation:90,finish:'oak',homeVersion:1}};
 await pg.exec("ALTER TABLE simulator.domain_records ADD CONSTRAINT prevent_furniture_placement CHECK(domain<>'furnishing.item' OR data->>'id'<>'"+id+"' OR data->>'homeId' IS NULL)");
 await assert.rejects(store.dispatch('citizen-one',place,4000));assert.equal((await store.snapshot()).furnishing!.items[id].placement,null);
 await pg.exec('ALTER TABLE simulator.domain_records DROP CONSTRAINT prevent_furniture_placement');await store.dispatch('citizen-one',place,4001);const reopened=new PostgresWorldStore(database,'test-world');assert.deepEqual((await reopened.snapshot()).furnishing!.items[id].placement,{x:9,y:6,rotation:90});
 await assert.rejects(pg.query("UPDATE simulator.domain_records SET data=jsonb_set(data,'{owner}','\"forged\"'::jsonb) WHERE domain='furnishing.item' AND id=$1",[id]),/immutable/);
 await assert.rejects(pg.transaction(async tx=>{await tx.query("UPDATE simulator.worlds SET state=jsonb_set(state,ARRAY['furnishing','items',$1,'purchaseKey'],'\"forged\"'::jsonb) WHERE id='test-world'",[id]);}),/purchase evidence/);
 reconcile(await reopened.snapshot());
});
test('signed-out sessions cannot read or commit even while an access token remains valid',async t=>{
 const {pg,store}=await setup(t);await store.dispatch('citizen-one',command,100,'session-one');await store.revokeSession('citizen-one','session-one');await store.revokeSession('citizen-one','session-one');
 assert.equal((await pg.query<{n:number}>('SELECT count(*)::integer n FROM simulator.revoked_sessions')).rows[0].n,1);
 await assert.rejects(store.snapshot('citizen-one','session-one'),/Sign in again/);await assert.rejects(store.dispatch('citizen-one',{id:'signed_out_command',type:'BuyBasicMeal',payload:{}},200,'session-one'),/Sign in again/);
 assert.equal((await store.snapshot('citizen-one','new-session')).citizens['citizen-one'].name,'Ada');
});

test('appearance and its receipt roll back together, survive reopening and reject unsupported SQL edits',async t=>{
 const {pg,database,store}=await setup(t),actor='citizen-one';await store.dispatch(actor,command,100);for(let i=0;i<3;i++)await store.dispatch(actor,{id:'appearance_db_street_'+i,type:'MoveCitizen',payload:{dx:-1,dy:0}},500+i*300);await store.dispatch(actor,{id:'appearance_db_enter',type:'EnterBuilding',payload:{buildingId:'shelter'}},2000);
 for(const [i,[dx,dy]] of [[0,-1],[0,-1],[0,-1],[0,-1],[1,0]].entries())await store.dispatch(actor,{id:'appearance_db_room_'+i,type:'MoveInterior',payload:{dx,dy}},2500+i*300);
 const before=await store.snapshot(),{version,...choices}=before.citizens[actor].appearance!,change={id:'appearance_db_change',type:'ChangeAppearance',payload:{appearance:{...choices,hair:'braids',outfit:'jacket',top:'wine'},appearanceVersion:version,wardrobeId:'wardrobe',homeVersion:1,leaseVersion:2}};
 await pg.exec("ALTER TABLE simulator.citizens ADD CONSTRAINT reject_appearance_change CHECK((data->'appearance'->>'version')::integer=1)");await assert.rejects(store.dispatch(actor,change,5000));assert.deepEqual(await store.snapshot(),before);await pg.exec('ALTER TABLE simulator.citizens DROP CONSTRAINT reject_appearance_change');await store.dispatch(actor,change,5001);
 const reopened=new PostgresWorldStore(database,'test-world'),saved=await reopened.snapshot();assert.equal((await reopened.dispatch(actor,change,6000)).replayed,true);assert.equal(saved.citizens[actor].appearance!.hair,'braids');assert.equal(saved.citizens[actor].appearance!.version,2);assert.deepEqual(saved.balances,before.balances);reconcile(saved);
 for(const hair of ['afro','external-asset'])await assert.rejects(pg.transaction(async tx=>{const citizen=structuredClone(saved.citizens[actor]);citizen.appearance!.hair=hair;await tx.query('UPDATE simulator.citizens SET data=$2::jsonb WHERE actor_id=$1',[actor,JSON.stringify(citizen)]);await tx.query("UPDATE simulator.worlds SET state=jsonb_set(state,ARRAY['citizens',$1],$2::jsonb) WHERE id='test-world'",[actor,JSON.stringify(citizen)]);}),hair==='afro'?/saved command evidence/:/Invalid citizen appearance/);
 assert.equal((await store.snapshot()).citizens[actor].appearance!.hair,'braids');
});

test('interior construction rolls back cash and materials together; reopening retains doors and SQL rejects wall conflicts',async t=>{
 const {pg,database,store}=await setup(t),actor='citizen-one';await store.dispatch(actor,command,100);for(let i=0;i<3;i++)await store.dispatch(actor,{id:'partition_db_walk_'+i,type:'MoveCitizen',payload:{dx:-1,dy:0}},1000+i*300);await store.dispatch(actor,{id:'partition_db_enter',type:'EnterBuilding',payload:{buildingId:'shelter'}},3000);
 await store.dispatch(actor,{id:'partition_db_materials',type:'BuyNPCSupply',payload:{goodsId:'materials',quantity:4,acceptedUnitPrice:2000}},4000);const before=await store.snapshot(),homeId=before.world!.positions[actor].homeId!,build={id:'partition_db_build',type:'BuildHomePartition',payload:{axis:'h',x:0,y:3,length:10,doorAt:4,acceptedLabour:26000,acceptedMaterials:4,acceptTerms:true,homeVersion:1}};
 await pg.exec("ALTER TABLE simulator.domain_records ADD CONSTRAINT reject_partition_build CHECK(domain<>'furnishing.home' OR COALESCE(jsonb_array_length(data->'partitions'),0)=0)");await assert.rejects(store.dispatch(actor,build,5000));assert.deepEqual(await store.snapshot(),before);await pg.exec('ALTER TABLE simulator.domain_records DROP CONSTRAINT reject_partition_build');await store.dispatch(actor,build,5100);
 const reopened=new PostgresWorldStore(database,'test-world'),saved=await reopened.snapshot();assert.equal((await reopened.dispatch(actor,build,5200)).replayed,true);assert.equal(saved.balances['citizen:'+actor],before.balances['citizen:'+actor]-26000);assert.equal(Object.values(saved.commerce!.batches)[0].quantity,0);assert.equal(saved.furnishing!.homes[homeId].partitions?.filter(p=>p.door).length,1);reconcile(saved);
 const bed=Object.values(saved.furnishing!.items).find(i=>i.alias==='bed')!,changed={...bed,placement:{x:1,y:2,rotation:0}};
 await assert.rejects(pg.transaction(async tx=>{await tx.query("UPDATE simulator.domain_records SET data=$2::jsonb WHERE domain='furnishing.item' AND id=$1",[bed.id,JSON.stringify(changed)]);await tx.query("UPDATE simulator.worlds SET state=jsonb_set(state,ARRAY['furnishing','items',$1],$2::jsonb) WHERE id='test-world'",[bed.id,JSON.stringify(changed)]);}),/Partitions must preserve/);assert.deepEqual((await store.snapshot()).furnishing!.items[bed.id].placement,bed.placement);
 await assert.rejects(pg.transaction(async tx=>{const home=structuredClone(saved.furnishing!.homes[homeId]);home.partitions![0].purchaseKey='forged';await tx.query("UPDATE simulator.domain_records SET data=$2::jsonb WHERE domain='furnishing.home' AND id=$1",[homeId,JSON.stringify(home)]);await tx.query("UPDATE simulator.worlds SET state=jsonb_set(state,ARRAY['furnishing','homes',$1],$2::jsonb) WHERE id='test-world'",[homeId,JSON.stringify(home)]);}),/construction evidence/);
});
