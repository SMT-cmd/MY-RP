import {DomainError} from './domain.ts';
import type {State,Command} from './domain.ts';
import {homeFor,usableHome,homeFixtures} from './furnishing.ts';
import {fixtureAccessible} from './home-layout.ts';

// Free authored cosmetics. No external images, user-provided URLs or gameplay modifiers.
export const APPEARANCE={
 skin:[{id:'umber',name:'Deep umber',color:'#543528'},{id:'cocoa',name:'Cocoa',color:'#70462f'},{id:'bronze',name:'Bronze',color:'#895c40'},{id:'copper',name:'Copper',color:'#a77551'},{id:'warm',name:'Warm beige',color:'#c39872'},{id:'light',name:'Light beige',color:'#dfba97'}],
 frame:[{id:'slender',name:'Slender',scale:.91},{id:'balanced',name:'Balanced',scale:1},{id:'broad',name:'Broad',scale:1.13}],
 hair:[{id:'crop',name:'Close crop'},{id:'afro',name:'Rounded afro'},{id:'locs',name:'Shoulder-length locs'},{id:'braids',name:'Braids with a tied bun'},{id:'shaved',name:'Shaved head'}],
 hairColour:[{id:'black',name:'Soft black',color:'#282521'},{id:'brown',name:'Dark brown',color:'#493125'},{id:'silver',name:'Silver grey',color:'#a4a49c'}],
 outfit:[{id:'tee',name:'Everyday T-shirt'},{id:'linen',name:'Collared linen shirt'},{id:'tunic',name:'Long tunic'},{id:'jacket',name:'Casual jacket'}],
 top:[{id:'teal',name:'Teal',color:'#2e7477'},{id:'ochre',name:'Ochre',color:'#bc914b'},{id:'cream',name:'Cream',color:'#e5dccb'},{id:'wine',name:'Wine',color:'#824c55'},{id:'navy',name:'Navy',color:'#354d68'},{id:'sage',name:'Sage',color:'#7c957e'}],
 bottom:[{id:'charcoal',name:'Charcoal',color:'#303f52'},{id:'sand',name:'Sand',color:'#9b8a70'},{id:'olive',name:'Olive',color:'#56664f'},{id:'denim',name:'Indigo',color:'#3b546f'}]
};
export type AppearanceChoices={skin:string;frame:string;hair:string;hairColour:string;outfit:string;top:string;bottom:string};
export type Appearance=AppearanceChoices&{version:number};
export const DEFAULT_APPEARANCE:Appearance={version:1,skin:'bronze',frame:'balanced',hair:'crop',hairColour:'black',outfit:'tee',top:'teal',bottom:'charcoal'};
const fields=Object.keys(APPEARANCE) as (keyof AppearanceChoices)[];
export function validateAppearance(value:unknown):AppearanceChoices{
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==fields.length||fields.some(k=>!APPEARANCE[k].some(o=>o.id===(value as Record<string,unknown>)[k])))throw new DomainError('INVALID_APPEARANCE','Choose one of the listed options for each appearance field.',400);
 return Object.fromEntries(fields.map(k=>[k,(value as AppearanceChoices)[k]])) as AppearanceChoices;
}
export function initialAppearance(value:unknown):Appearance{return value===undefined?{...DEFAULT_APPEARANCE}:{...validateAppearance(value),version:1};}
export function appearanceRender(profile:Appearance){
 return{skin:APPEARANCE.skin.find(o=>o.id===profile.skin)!.color,frame:APPEARANCE.frame.find(o=>o.id===profile.frame)!.scale,hair:profile.hair,hairColour:APPEARANCE.hairColour.find(o=>o.id===profile.hairColour)!.color,outfit:profile.outfit,shirt:APPEARANCE.top.find(o=>o.id===profile.top)!.color,trousers:APPEARANCE.bottom.find(o=>o.id===profile.bottom)!.color};
}
export function appearanceCommand(s:State,actor:string,c:Command,now:number):Record<string,unknown>|undefined{
 if(c.type!=='ChangeAppearance')return;
 const citizen=s.citizens[actor];if(!citizen)throw new DomainError('CITIZEN_REQUIRED','Create your citizen first.');
 const home=usableHome(s,actor),pos=s.world!.positions[actor],p=c.payload;
 if(s.world!.trips[s.world!.activeTrips[actor]]?.status==='travelling')throw new DomainError('IN_TRANSIT','Finish your journey before changing your appearance.');
 if(p.leaseVersion!==pos.leaseVersion)throw new DomainError('STALE_LEASE','Your location changed. Refresh before changing clothes.');
 if(p.homeVersion!==home.version)throw new DomainError('HOME_CHANGED','The furnishings changed. Refresh before using the wardrobe.');
 const wardrobe=homeFixtures(s,home).find(f=>f.id===p.wardrobeId&&f.action==='Dress');
 if(!wardrobe)throw new DomainError('WARDROBE_REQUIRED','Use a placed wardrobe in your current home.');
 if(!fixtureAccessible(home,pos.interiorX??4,pos.interiorY??6,wardrobe))throw new DomainError('TOO_FAR','Walk beside the wardrobe before changing your appearance.');
 const old=citizen.appearance??DEFAULT_APPEARANCE;
 if(p.appearanceVersion!==old.version)throw new DomainError('APPEARANCE_CHANGED','Your appearance changed. Refresh before saving again.');
 if(!Number.isSafeInteger(old.version+1))throw new DomainError('APPEARANCE_LIMIT','Your saved appearance cannot be versioned again.');
 const choices=validateAppearance(p.appearance);citizen.appearance={...choices,version:old.version+1};
 pos.activity={kind:'Dress',fixtureId:wardrobe.id,startedAt:now};
 return{appearance:{...citizen.appearance},previousVersion:old.version,message:'Your appearance is saved. These choices are free.'};
}
export function appearanceView(s:State,actor:string){
 const citizen=s.citizens[actor],profile=citizen?.appearance??DEFAULT_APPEARANCE;
 if(!citizen)return{catalogue:APPEARANCE,profile:{...profile},wardrobes:[],canChange:false,reason:'Choose your appearance when creating a citizen.'};
 if(!s.world?.positions[actor])return{catalogue:APPEARANCE,profile:{...profile},wardrobes:[],canChange:false,reason:'Enter your home to use the wardrobe.'};
 const copy=structuredClone(s),home=homeFor(copy,actor),pos=copy.world!.positions[actor],trip=copy.world!.trips[copy.world!.activeTrips[actor]],inside=pos.interior==='shelter'&&pos.homeId===home.id&&trip?.status!=='travelling';
 const wardrobes=inside?homeFixtures(copy,home).filter(f=>f.action==='Dress').map(f=>({id:f.id,name:f.name,nearby:fixtureAccessible(home,pos.interiorX??4,pos.interiorY??6,f)})):[];
 return{catalogue:APPEARANCE,profile:{...profile},wardrobes,canChange:wardrobes.some(f=>f.nearby),reason:!inside?'Enter your home to use the wardrobe.':!wardrobes.length?'Place a wardrobe from your furniture storage.':!wardrobes.some(f=>f.nearby)?'Walk beside your wardrobe to change your appearance.':'Your wardrobe is ready. All listed choices are free.'};
}
export function reconcileAppearance(s:State){
 for(const citizen of Object.values(s.citizens)){
  const profile=citizen.appearance;if(!profile)continue;const {version,...choices}=profile;
  try{validateAppearance(choices);}catch{throw new Error('Invalid citizen appearance');}
  if(!Number.isSafeInteger(version)||version<1)throw new Error('Invalid appearance version');
  const receipt=Object.values(s.commands).map(c=>c.receipt).filter(r=>r.actorId===citizen.actorId&&(r.type==='CreateCitizen'||r.type==='ChangeAppearance')&&r.detail.appearance&&typeof r.detail.appearance==='object').find(r=>(r.detail.appearance as Appearance).version===version);
  if(!receipt||(version===1?receipt.type!=='CreateCitizen':receipt.type!=='ChangeAppearance'||receipt.detail.previousVersion!==version-1)||['version',...fields].some(k=>(receipt.detail.appearance as Record<string,unknown>)[k]!==profile[k as keyof Appearance]))throw new Error('Appearance lacks saved command evidence');
 }
}
