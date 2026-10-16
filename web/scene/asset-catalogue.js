// Reviewed local CC0 assets. Collision, prices and use anchors stay server owned.
export const FURNITURE_ASSETS={
 bed:['bedDouble',2,2,.68], 'single-bed':['bedSingle',1,2,.68],pantry:['kitchenCabinet',1,1,1.05],sink:['kitchenSink',1,1,1.02],fridge:['kitchenFridge',1,1,1.9],
 sofa:['loungeSofaLong',3,1,1.1],loveseat:['loungeDesignSofa',2,1,1.1],armchair:['loungeDesignChair',1,1,1.1],'dining-chair':['chairModernCushion',1,1,1.03],chaise:['loungeChairRelax',2,1,1.0],ottoman:['loungeSofaOttoman',1,1,.6],bench:['benchCushion',2,1,.95],
 desk:['desk',2,1,.85],'dining-table':['tableRound',2,2,.85],'coffee-table':['tableCoffeeGlass',2,1,.46],'side-table':['sideTable',1,1,.63],bookshelf:['bookcaseOpen',1,2,2.0],wardrobe:['bookcaseClosedDoors',1,2,2.1],sideboard:['cabinetTelevisionDoors',2,1,.83],'display-case':['bookcaseOpen',1,2,2.0],'kitchen-island':['kitchenCabinet',2,1,1.05],vanity:['bathroomSink',2,1,1.05],plant:['pottedPlant',1,1,1.6],
 'floor-lamp':['lampRoundFloor',1,1,1.9],'table-lamp':['lampRoundTable',1,1,.8],'studio-light':['lampRoundFloor',1,1,1.7]
};
export const SUBURBAN=['a','c','e','g','i','k','m','o'].map(n=>'suburban/building-type-'+n);
export const COMMERCIAL=['a','c','f','h','k','n'].map(n=>'commercial/building-'+n);
export const TOWERS=['a','c','e'].map(n=>'commercial/building-skyscraper-'+n);
export const hashName=id=>[...String(id)].reduce((a,c)=>(a*31+c.charCodeAt(0))>>>0,0);
export function buildingAsset(b){if(b.id==='shelter')return SUBURBAN[2];const index=hashName(b.id);return b.x>=66?(b.y>=28?TOWERS[index%3]:COMMERCIAL[index%6]):b.kind==='facade'?SUBURBAN[index%8]:COMMERCIAL[index%6];}
export function furnitureAsset(f){const form=FURNITURE_ASSETS[f.kind??f.model??f.id];return form?'furniture/'+form[0]:null;}
export const carAsset=model=>model==='van'?'cars/van':model==='suv'?'cars/suv-luxury':'cars/sedan';
export function requiredAssets(world){
 if(world.home)return [...new Set(world.home.fixtures.map(furnitureAsset).filter(Boolean))];
 return [...new Set([...world.map.buildings.map(buildingAsset),...(world.map.obstacles??[]).filter(o=>o.kind!=='tree').map(buildingAsset),'suburban/tree-large',...(world.map.streetObjects??[]).map(furnitureAsset),...(world.parking?.vehicles??[]).map(v=>carAsset(v.model))])];
}
