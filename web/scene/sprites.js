import {furnitureAsset,buildingAsset,carAsset} from './asset-catalogue.js';
export function createSpriteLibrary(){
 let manifest=null,alive=true;const images=new Map(),tints=new Map(),alphaMasks=new WeakMap(),abort=new AbortController();
 const imageFor=path=>{let image=images.get(path);if(!image){image=new Image();image.src=path;images.set(path,image);}return image.complete&&image.naturalWidth?image:null;};
 fetch('/assets/world/sprites/manifest.json',{signal:abort.signal,credentials:'omit'}).then(r=>r.ok?r.json():null).then(m=>{if(alive)manifest=m;}).catch(()=>{});
 function draw(ctx,key,x,y,turn=0,width=null,depth=null){
  const meta=manifest?.[key],view=meta?.views[((turn%4)+4)%4];if(!view)return null;const path='/assets/world/sprites/'+view.file;
  const image=imageFor(path);if(!image)return null;
  const sx=width===null?1:width/(turn%2?meta.d:meta.w),sy=depth===null?1:depth/(turn%2?meta.w:meta.d),scale=Math.min(sx,sy),left=x-view.anchorX*scale,top=y-view.anchorY*scale;
  ctx.drawImage(image,left,top,view.width*scale,view.height*scale);return{x:left,y:top,w:view.width*scale,h:view.height*scale,contains(px,py){let mask=alphaMasks.get(image);if(!mask){const off=document.createElement('canvas');off.width=image.naturalWidth;off.height=image.naturalHeight;const c=off.getContext('2d',{willReadFrequently:true});if(!c)return true;c.drawImage(image,0,0);mask=c.getImageData(0,0,off.width,off.height).data;alphaMasks.set(image,mask);}const ix=Math.floor((px-left)/scale),iy=Math.floor((py-top)/scale);return ix>=0&&iy>=0&&ix<image.naturalWidth&&iy<image.naturalHeight&&mask[(iy*image.naturalWidth+ix)*4+3]>32;}};
 }
 function character(ctx,avatar,face,time,walking,kind,x,y){
  const body=avatar.body==='female'?'female':'male',outfit=['tee','linen','tunic','jacket'].includes(avatar.outfit)?avatar.outfit:'tee',path='/assets/world/characters/'+body+'-'+outfit,source=imageFor(path+'.webp');if(!source)return false;
  const mask=imageFor(path+'-mask.webp'),colours=[null,avatar.skin??'#895c40',avatar.shirt??'#377f80',avatar.trousers??'#30465c',avatar.hair==='shaved'?(avatar.skin??'#895c40'):(avatar.hairColour??'#282623')],signature=path+JSON.stringify(colours);let tinted=tints.get(signature);
  if(!tinted&&mask){
   const off=document.createElement('canvas');off.width=source.naturalWidth;off.height=source.naturalHeight;const c=off.getContext('2d',{willReadFrequently:true});
   if(c){c.drawImage(mask,0,0);const ids=c.getImageData(0,0,off.width,off.height).data;c.clearRect(0,0,off.width,off.height);c.drawImage(source,0,0);const pixels=c.getImageData(0,0,off.width,off.height),base=[null,[137,92,64],[55,127,128],[48,70,92],[40,38,35]],rgb=colours.map(v=>v&&/^#[a-f0-9]{6}$/i.test(v)?[parseInt(v.slice(1,3),16),parseInt(v.slice(3,5),16),parseInt(v.slice(5,7),16)]:null);
    for(let i=0;i<pixels.data.length;i+=4){const region=ids[i];if(!rgb[region]||!pixels.data[i+3])continue;for(let channel=0;channel<3;channel++)pixels.data[i+channel]=Math.min(255,pixels.data[i+channel]*rgb[region][channel]/base[region][channel]);}c.putImageData(pixels,0,0);tinted=off;tints.set(signature,off);if(tints.size>8){const oldest=tints.keys().next().value;tints.get(oldest).width=1;tints.delete(oldest);}}
  }
  const phase=walking?1+Math.floor(time/90)%4:kind==='Sit'?5:kind==='Rest'?6:['Read','Wash','Dress'].includes(kind)?7:0,row=({front:0,right:1,back:2,left:3})[face]??0;
  ctx.save();ctx.translate(x,y);ctx.scale(avatar.frame??1,1);ctx.drawImage(tinted??source,phase*160,row*160,160,160,-80,-128,160,160);ctx.restore();return true;
 }
 return{character,furniture(ctx,f,point){return draw(ctx,furnitureAsset(f),point[0],point[1],Math.round((f.rotation??0)/90),f.w,f.h);},building(ctx,b,point){return draw(ctx,buildingAsset(b),point[0],point[1],0,b.w,b.h);},tree(ctx,point){return draw(ctx,'suburban/tree-large',...point);},car(ctx,model,point){return draw(ctx,carAsset(model),...point);},destroy(){alive=false;abort.abort();images.clear();for(const canvas of tints.values())canvas.width=1;tints.clear();}};
}
