import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,execute,citizenView,DomainError} from '../src/domain.ts';
import type {State,Command} from '../src/domain.ts';
import {homeFor,homeFixtures,homeWalkable} from '../src/furnishing.ts';
import {fixtureAccessible} from '../src/home-layout.ts';
import {restoreBackup,exportBackup,reconcile} from '../src/recovery.ts';
import {venueFor,venueWalkable,SHOWROOM_ENTRANCE} from '../src/venues.ts';
const code=(c:string)=>(e:unknown)=>e instanceof DomainError&&e.code===c;
function fixture(){
 let state=initialState(),clock=10000,seq=0;const actor='physical-player';
 const command=(type:string,payload:Record<string,unknown>={}):Command=>({id:'physical_flow_'+ ++seq,type,payload});
 const run=(type:string,payload:Record<string,unknown>={})=>{const result=execute(state,actor,command(type,payload),clock+=700);state=result.state;return result;};
 const navigate=(x:number,y:number)=>{const p=state.world!.positions[actor],r=run('NavigateCitizen',{x,y,leaseVersion:p.leaseVersion}),nav=r.receipt.detail.navigation as {points:unknown[];stepMs:number}|undefined;clock+=nav?(nav.points.length-1)*nav.stepMs+10:0;return run('StopNavigation',{leaseVersion:p.leaseVersion});};
 const beside=(id:string)=>{const p=state.world!.positions[actor],home=p.interior==='shelter'?homeFor(state,actor):null,v=venueFor(p.interior),f=home?homeFixtures(state,home).find(f=>f.id===id)!:v!.fixtures.find(f=>f.id===id)!;const candidates=[];for(let y=0;y<(home??v)!.height;y++)for(let x=0;x<(home??v)!.width;x++){const accessible=home?homeWalkable(state,home,x,y)&&fixtureAccessible(home,x,y,f):venueWalkable(v!.id,x,y)&&Math.max(f.x-x,0,x-(f.x+f.w-1))+Math.max(f.y-y,0,y-(f.y+f.h-1))===1;if(accessible)candidates.push({x,y,d:Math.abs(x-p.interiorX!)+Math.abs(y-p.interiorY!)});}candidates.sort((a,b)=>a.d-b.d);assert.ok(candidates.length);navigate(candidates[0].x,candidates[0].y);return f;};
 run('CreateCitizen',{name:'Physical Player',state:'Lagos',adultConfirmed:true});
 return{actor,run,navigate,beside,command,get state(){return state;},set state(s:State){state=s;},get clock(){return clock;},advance(ms:number){clock+=ms;},home(){navigate(4,7);run('EnterBuilding',{buildingId:'shelter'});}};
}
test('server-issued routes reject forged speed, project without mutating saves and recover across restart',()=>{
 const f=fixture(),p=f.state.world!.positions[f.actor],before={x:p.x,y:p.y},route=f.run('NavigateCitizen',{x:4,y:7,leaseVersion:p.leaseVersion}),nav=route.receipt.detail.navigation as {startedAt:number;stepMs:number;points:unknown[]};
 assert.equal(nav.stepMs,300);assert.equal(f.state.world!.positions[f.actor].x,before.x);const view=citizenView(f.state,f.actor,nav.startedAt+450);assert.equal(view.world!.position.x,before.x-1);assert.equal(f.state.world!.positions[f.actor].x,before.x);
 assert.throws(()=>f.run('NavigateCitizen',{x:4,y:7,leaseVersion:1,stepMs:1}),code('INVALID_COMMAND'));
 f.state=restoreBackup(exportBackup(f.state));f.advance(5000);f.run('StopNavigation',{leaseVersion:1});assert.equal(f.state.world!.positions[f.actor].x,4);assert.equal(f.state.world!.positions[f.actor].navigation,undefined);reconcile(f.state);
});
test('bathroom fit-out preserves existing placement and timed hygiene benefits cannot be claimed early or twice',()=>{
 const f=fixture();f.home();const home=homeFor(f.state,f.actor),before=homeFixtures(f.state,home).map(i=>[i.id,i.x,i.y]),version=home.version;
 const fit=f.run('PrepareHomeBathroom',{homeVersion:version,leaseVersion:2});assert.equal((fit.receipt.detail.installedFurniture as unknown[]).length,2);for(const [id,x,y] of before){const current=homeFixtures(f.state,homeFor(f.state,f.actor)).find(i=>i.id===id)!;assert.deepEqual([current.x,current.y],[x,y]);}
 f.beside('toilet');const start=f.run('InteractHomeFixture',{fixtureId:'toilet',leaseVersion:2}),id=String(start.receipt.detail.activitySessionId),xp=citizenView(f.state,f.actor,f.clock).world!.homeCare!.experience;
 assert.throws(()=>f.run('FinishHomeActivity',{sessionId:id,leaseVersion:2}),code('ACTIVITY_PENDING'));f.advance(14000);const finish=f.command('FinishHomeActivity',{sessionId:id,leaseVersion:2});let result=execute(f.state,f.actor,finish,f.clock);f.state=result.state;assert.equal(execute(f.state,f.actor,finish,f.clock+100).replayed,true);
 const care=citizenView(f.state,f.actor,f.clock).world!.homeCare!;assert.equal(care.bladder,100);assert.equal(care.experience,xp+1);assert.ok(care.fixtures.some(i=>i.needsCleaning));f.run('FinishHomeActivity',{sessionId:id});assert.equal(citizenView(f.state,f.actor,f.clock).world!.homeCare!.experience,xp+1);
 f.beside('toilet');const clean=f.run('InteractHomeFixture',{fixtureId:'toilet',action:'Clean',leaseVersion:2});f.advance(12000);f.run('FinishHomeActivity',{sessionId:clean.receipt.detail.activitySessionId});assert.ok(citizenView(f.state,f.actor,f.clock).world!.homeCare!.fixtures.every(i=>!i.needsCleaning));f.state=restoreBackup(exportBackup(f.state));reconcile(f.state);
});
test('leaving or changing a timed activity cancels its reward and retained start history survives recovery',()=>{
 const f=fixture();f.home();f.beside('sink');const start=f.run('InteractHomeFixture',{fixtureId:'sink'}),id=start.receipt.detail.activitySessionId;f.navigate(4,6);f.advance(12000);assert.throws(()=>f.run('FinishHomeActivity',{sessionId:id}),code('ACTIVITY_CANCELLED'));f.state=restoreBackup(exportBackup(f.state));assert.equal(citizenView(f.state,f.actor,f.clock).world!.homeCare!.completedActivities,0);
});
test('showroom purchase requires physical collection and placement awards Home Design XP once',()=>{
 const f=fixture();f.navigate(SHOWROOM_ENTRANCE.door.x,SHOWROOM_ENTRANCE.door.y);f.run('EnterBuilding',{buildingId:'showroom'});f.beside('display-living');
 const order=f.run('BuyShowroomFurniture',{fixtureId:'display-living',modelId:'armchair',acceptedPrice:25000,finish:'oak',acceptTerms:true,leaseVersion:2}),orderId=order.receipt.detail.orderId,itemId=order.receipt.detail.furnitureId;
 assert.throws(()=>f.run('CollectShowroomFurniture',{orderId,leaseVersion:2}),code('VENUE_DISTANCE'));f.beside('showroom-pickup');f.run('CollectShowroomFurniture',{orderId,leaseVersion:2});f.run('ExitBuilding');f.home();const home=homeFor(f.state,f.actor);
 const place=f.command('PlaceFurniture',{furnitureId:itemId,homeVersion:home.version,x:0,y:6,rotation:0,finish:'oak'});const result=execute(f.state,f.actor,place,f.clock+700);f.state=result.state;assert.equal(result.receipt.detail.designXp,25);assert.equal(execute(f.state,f.actor,place,f.clock+1400).replayed,true);assert.equal(f.state.venues!.designXp[f.actor],25);reconcile(f.state);f.state=restoreBackup(exportBackup(f.state));
});
test('physical work enforces station timers and cannot pay twice or bypass workstation checks',()=>{
 const f=fixture();f.navigate(10,8);f.run('EnterBuilding',{buildingId:'work'});f.beside('work-reception');const start=f.run('BeginVenueWork',{jobId:'cleaner',leaseVersion:2});
 assert.throws(()=>f.run('WorkStep',{choice:0}),code('VENUE_WORKSTATION'));
 for(let i=0;i<3;i++){f.beside('work-'+i);const task=f.run('BeginVenueTask',{leaseVersion:2});assert.throws(()=>f.run('CompleteVenueTask',{taskId:task.receipt.detail.taskId,leaseVersion:2}),code('VENUE_TASK_PENDING'));f.advance(5000);f.run('CompleteVenueTask',{taskId:task.receipt.detail.taskId,leaseVersion:2});}
 f.beside('work-reception');f.advance(60000);const settle=f.command('CompleteVenueWork',{leaseVersion:2}),before=f.state.balances['citizen:'+f.actor],result=execute(f.state,f.actor,settle,f.clock);f.state=result.state;assert.equal(f.state.balances['citizen:'+f.actor],before+Number(start.receipt.detail.wage));assert.equal(execute(f.state,f.actor,settle,f.clock+1).replayed,true);reconcile(f.state);
});
test('showroom shuttle follows a road route with no fuel minting and cannot exit while moving',()=>{
 const f=fixture();f.navigate(4,7);const stock=JSON.stringify(f.state.commerce?.stock??{}),ride=f.run('BeginShowroomShuttle',{destination:'showroom',leaseVersion:1});assert.equal(f.state.driving!.drivers[f.actor].shuttle,true);assert.throws(()=>f.run('ExitVehicle',{leaseVersion:2}),code('VEHICLE_MOVING'));const nav=ride.receipt.detail.navigation as {points:unknown[];stepMs:number};f.advance(nav.points.length*nav.stepMs+100);f.run('StopNavigation',{leaseVersion:2});f.run('ExitVehicle',{leaseVersion:2});assert.equal(f.state.driving!.drivers[f.actor],undefined);assert.equal(JSON.stringify(f.state.commerce?.stock??{}),stock);reconcile(f.state);
});

test('television settings require ownership, proximity and exact saved versions without touching a placement draft',()=>{
 const f=fixture();f.home();const bought=f.run('BuyFurniture',{modelId:'television',acceptedPrice:75000,finish:'oak',acceptTerms:true}),id=String(bought.receipt.detail.furnitureId);f.run('PlaceFurniture',{furnitureId:id,homeVersion:homeFor(f.state,f.actor).version,x:6,y:6,rotation:180,finish:'oak'});const version=homeFor(f.state,f.actor).version,settings={furnitureId:id,homeVersion:version,leaseVersion:2,screenVersion:0,enabled:true,channel:'city'};
 assert.throws(()=>f.run('SetHomeTelevision',settings),code('TOO_FAR'));f.beside(id);const on=f.command('SetHomeTelevision',settings),placed=JSON.stringify(f.state.furnishing!.items[id].placement);f.state=execute(f.state,f.actor,on,f.clock+700).state;assert.equal(execute(f.state,f.actor,on,f.clock+800).replayed,true);assert.equal(JSON.stringify(f.state.furnishing!.items[id].placement),placed);assert.equal(homeFor(f.state,f.actor).version,version);assert.throws(()=>f.run('SetHomeTelevision',settings),code('TELEVISION_CHANGED'));assert.throws(()=>f.run('SetHomeTelevision',{...settings,screenVersion:1,channel:'external-url'}),code('INVALID_TELEVISION'));f.state=restoreBackup(exportBackup(f.state));assert.equal(f.state.furnishing!.items[id].screen!.enabled,true);const forged=structuredClone(f.state);forged.furnishing!.items[id].screen!.channel='nature';assert.throws(()=>reconcile(forged),/Television/);
});

test('owned road driving reserves real fuel, consumes traversed units and returns unused reservation once',async()=>{
 const {graduate,completeCourse}=await import('./helpers.ts');const {DAY}=await import('../src/domain.ts');const f=fixture();f.state=graduate(f.state,f.actor,10*DAY);f.state=completeCourse(f.state,f.actor,'driving',15*DAY);f.advance(17*DAY);const purchase=f.run('BuyNPCVehicle',{modelId:'compact',acceptedPrice:300000,acceptTerms:true}),vehicleId=String(purchase.receipt.detail.vehicleId);f.run('BuyNPCSupply',{goodsId:'fuel',quantity:5,acceptedUnitPrice:300});f.run('RefuelVehicle',{vehicleId,litres:5});f.navigate(10,7);const lease=f.state.world!.positions[f.actor].leaseVersion;f.run('EnterVehicle',{vehicleId,leaseVersion:lease});const route=f.run('NavigateCitizen',{x:100,y:7,leaseVersion:lease+1});assert.equal(f.state.mobility!.vehicles[vehicleId].fuel,3);f.advance(750);const stop=f.command('StopNavigation',{leaseVersion:lease+1});f.state=execute(f.state,f.actor,stop,f.clock).state;assert.equal(f.state.mobility!.vehicles[vehicleId].fuel,4);assert.equal(execute(f.state,f.actor,stop,f.clock+10).replayed,true);assert.ok(Object.entries(f.state.commerce!.stock!.balances).filter(([id])=>id.startsWith('fuel:drive-fuel:')).every(([,amount])=>amount===0));f.run('ExitVehicle',{leaseVersion:lease+1});f.state=restoreBackup(exportBackup(f.state));reconcile(f.state);
});
