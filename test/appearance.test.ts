import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,execute,DomainError,citizenView} from '../src/domain.ts';
import type {State} from '../src/domain.ts';
import {DEFAULT_APPEARANCE,APPEARANCE} from '../src/appearance.ts';
import {reconcile,exportBackup,restoreBackup} from '../src/recovery.ts';
import {homeFor} from '../src/furnishing.ts';
import {walkTo} from './helpers.ts';
let sequence=0;const actor='styled-citizen',choices={skin:'cocoa',frame:'broad',hair:'braids',hairColour:'silver',outfit:'linen',top:'cream',bottom:'olive'};
const cmd=(type:string,payload:Record<string,unknown>={})=>({id:'appearance_test_'+ ++sequence,type,payload});
const run=(s:State,type:string,payload:Record<string,unknown>={},now=10000)=>execute(s,actor,cmd(type,payload),now);
const code=(value:string)=>(e:unknown)=>e instanceof DomainError&&e.code===value;
function create(){return run(initialState(),'CreateCitizen',{name:'Styled Citizen',state:'Lagos',adultConfirmed:true,appearance:choices},100).state;}
function home(){let s=walkTo(create(),actor,4,7,1000);return run(s,'EnterBuilding',{buildingId:'shelter'},2000).state;}
function besideWardrobe(){let s=home();for(const [i,[dx,dy]] of [[0,-1],[0,-1],[0,-1],[0,-1],[1,0]].entries())s=run(s,'MoveInterior',{dx,dy},2500+i*300).state;return s;}
const change={appearance:{...choices,hair:'afro'},appearanceVersion:1,wardrobeId:'wardrobe',homeVersion:1,leaseVersion:2};
test('appearance creation is atomic, curated, retry-safe and has no economic advantage',()=>{
 const before=initialState(),unchanged=structuredClone(before),setup=cmd('CreateCitizen',{name:'Styled Citizen',state:'Lagos',adultConfirmed:true,appearance:choices}),first=execute(before,actor,setup,100);assert.equal(execute(first.state,actor,setup,200).replayed,true);assert.deepEqual(first.state.citizens[actor].appearance,{...choices,version:1});
 const plain=run(before,'CreateCitizen',{name:'Styled Citizen',state:'Lagos',adultConfirmed:true},100).state;assert.equal(first.state.balances['citizen:'+actor],plain.balances['citizen:'+actor]);assert.deepEqual(first.state.citizens[actor].life,plain.citizens[actor].life);assert.deepEqual(plain.citizens[actor].appearance,DEFAULT_APPEARANCE);
 for(const bad of [{...choices,skin:'#ffffff'},{...choices,hair:'https://example.test/asset'},{...choices,votes:20},{...choices,frame:'child'},{skin:'cocoa'},null])assert.throws(()=>run(before,'CreateCitizen',{name:'Styled Citizen',state:'Lagos',adultConfirmed:true,appearance:bad},100),code('INVALID_APPEARANCE'));
 assert.deepEqual(before,unchanged);assert.equal(citizenView(before,actor,100).appearance.catalogue.hair.length,APPEARANCE.hair.length);reconcile(first.state);
});
test('wardrobe changes require current room, version, range and an open wall edge',()=>{
 assert.throws(()=>run(create(),'ChangeAppearance',change),code('HOME_REQUIRED'));const inside=home(),original=JSON.stringify(inside);assert.throws(()=>run(inside,'ChangeAppearance',change),code('TOO_FAR'));assert.equal(JSON.stringify(inside),original);
 let s=besideWardrobe();assert.equal(citizenView(s,actor,9000).appearance.canChange,true);assert.throws(()=>run(s,'ChangeAppearance',{...change,leaseVersion:1}),code('STALE_LEASE'));assert.throws(()=>run(s,'ChangeAppearance',{...change,homeVersion:2}),code('HOME_CHANGED'));assert.throws(()=>run(s,'ChangeAppearance',{...change,wardrobeId:'sofa'}),code('WARDROBE_REQUIRED'));
 const beforeMoney=s.balances['citizen:'+actor],journalCount=s.journals.length,edit=cmd('ChangeAppearance',change);s=execute(s,actor,edit,10000).state;assert.equal(execute(s,actor,edit,11000).replayed,true);assert.equal(s.citizens[actor].appearance!.version,2);assert.equal(s.citizens[actor].appearance!.hair,'afro');assert.equal(s.balances['citizen:'+actor],beforeMoney);assert.equal(s.journals.length,journalCount);assert.throws(()=>run(s,'ChangeAppearance',change),code('APPEARANCE_CHANGED'));
 s=restoreBackup(exportBackup(s));assert.equal(citizenView(s,actor,11000).world!.avatar.hair,'afro');const forged=structuredClone(s);forged.citizens[actor].appearance!.top='navy';assert.throws(()=>reconcile(forged),/saved command evidence/);
 let w=home();w=run(w,'BuyNPCSupply',{goodsId:'materials',quantity:4,acceptedUnitPrice:2000},4000).state;w=run(w,'BuildHomePartition',{axis:'h',x:0,y:3,length:10,doorAt:4,acceptedLabour:26000,acceptedMaterials:4,acceptTerms:true,homeVersion:1},5000).state;
 for(const [i,[dx,dy]] of [[0,-1],[0,-1],[0,-1],[1,0],[1,0]].entries())w=run(w,'MoveInterior',{dx,dy},6000+i*300).state;assert.equal(citizenView(w,actor,9000).appearance.canChange,false);assert.throws(()=>run(w,'ChangeAppearance',{...change,homeVersion:2}),code('TOO_FAR'));
});
test('stored wardrobes and lost residence access cannot change appearance; old saves retain their default',()=>{
 let s=besideWardrobe(),wardrobe=Object.values(s.furnishing!.items).find(i=>i.model==='wardrobe')!;s=run(s,'StoreFurniture',{furnitureId:wardrobe.id,homeVersion:1}).state;assert.equal(citizenView(s,actor,11000).appearance.wardrobes.length,0);assert.throws(()=>run(s,'ChangeAppearance',{...change,homeVersion:2}),code('WARDROBE_REQUIRED'));
 s=run(s,'ExitBuilding').state;assert.throws(()=>run(s,'ChangeAppearance',{...change,homeVersion:2,leaseVersion:3}),code('HOME_REQUIRED'));
 const legacy=create();delete legacy.citizens[actor].appearance;assert.equal(citizenView(legacy,actor,1000).world!.avatar.hair,'crop');reconcile(legacy);assert.equal(homeFor(besideWardrobe(),actor).version,1);
});
