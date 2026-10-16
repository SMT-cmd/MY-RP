'use strict';
window.AppearanceUI=(()=>{
 let draft=null,owner=null,version=null,preview=null;
 const el=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
 const labels={skin:'Skin tone',frame:'Body frame',hair:'Hairstyle',hairColour:'Hair colour',outfit:'Clothing style',top:'Top colour',bottom:'Trouser colour'};
 function fields(root,catalogue,profile,prefix){
  for(const [key,values] of Object.entries(catalogue)){
   const label=el('label',labels[key]),select=el('select');select.id=prefix+'-'+key;select.name=key;
   for(const value of values){const option=el('option',value.name);option.value=value.id;option.selected=profile[key]===value.id;select.append(option);}label.append(select);root.append(label);
   if(values.some(v=>v.color)){const swatches=el('div');swatches.className='appearance-swatches';swatches.setAttribute('role','group');swatches.setAttribute('aria-label',labels[key]+' colours');for(const value of values){const swatch=el('button');swatch.type='button';swatch.title=value.name;swatch.setAttribute('aria-label',value.name);swatch.setAttribute('aria-pressed',String(select.value===value.id));const chip=document.createElementNS('http://www.w3.org/2000/svg','svg');chip.setAttribute('viewBox','0 0 24 24');chip.setAttribute('aria-hidden','true');const circle=document.createElementNS('http://www.w3.org/2000/svg','circle');circle.setAttribute('cx','12');circle.setAttribute('cy','12');circle.setAttribute('r','10');circle.setAttribute('fill',value.color);chip.append(circle);swatch.append(chip);swatch.onclick=()=>{select.value=value.id;select.dispatchEvent(new Event('change',{bubbles:true}));};swatches.append(swatch);}select.addEventListener('change',()=>{for(const [i,b] of [...swatches.children].entries())b.setAttribute('aria-pressed',String(values[i].id===select.value));});root.append(swatches);}

  }
 }
 function values(root){return Object.fromEntries([...root.querySelectorAll('select[name]')].map(s=>[s.name,s.value]));}
 function creationPreview(root,catalogue){
  if(preview||!window.CanvasRenderingContext2D)return;const figure=el('figure'),canvas=el('canvas');figure.className='citizen-portrait';canvas.width=240;canvas.height=280;canvas.setAttribute('role','img');canvas.setAttribute('aria-label','Your selected adult citizen');figure.append(canvas,el('figcaption','Your citizen · turn to see each side'));const controls=el('div'),left=el('button','Turn left'),right=el('button','Turn right');left.type=right.type='button';controls.append(left,right);figure.append(controls);root.prepend(figure);let face=0,library=null,timer=null,alive=true;
  const paint=()=>{if(!alive)return;const c=canvas.getContext('2d');if(!c)return;c.clearRect(0,0,240,280);c.fillStyle='#17232d';c.fillRect(0,0,240,280);c.beginPath();c.ellipse(120,244,48,15,0,0,Math.PI*2);c.fillStyle='#070f1677';c.fill();const p=values(root),get=k=>catalogue[k].find(v=>v.id===p[k]),avatar={body:get('frame').body,frame:get('frame').scale,skin:get('skin').color,hair:p.hair,hairColour:get('hairColour').color,outfit:p.outfit,shirt:get('top').color,trousers:get('bottom').color};c.save();c.translate(120,244);c.scale(2,2);library?.character(c,avatar,['front','right','back','left'][face],0,false,null,0,0);c.restore();};
  const redraw=()=>{clearInterval(timer);paint();let attempts=0;timer=setInterval(()=>{paint();if(++attempts>=25)clearInterval(timer);},120);};left.onclick=()=>{face=(face+3)%4;redraw();};right.onclick=()=>{face=(face+1)%4;redraw();};root.addEventListener('change',redraw);
  import('/scene/sprites.js').then(module=>{if(!alive)return;library=module.createSpriteLibrary();redraw();}).catch(()=>{});preview={destroy(){alive=false;clearInterval(timer);library?.destroy();root.removeEventListener('change',redraw);figure.remove();preview=null;}};
 }
 function render(view,send,busy){
  const m=view.appearance;if(!m){draft=null;owner=null;version=null;return;}const creation=document.getElementById('creation-appearance');
  if(!creation.childElementCount)fields(creation,m.catalogue,m.profile,'create-appearance');
  if(!view.citizen)creationPreview(creation,m.catalogue);else preview?.destroy();
  const panel=document.getElementById('appearance-panel');panel.hidden=!view.citizen;if(!view.citizen){draft=null;owner=null;version=null;return;}
  if(owner!==view.citizen.id||version!==m.profile.version){owner=view.citizen.id;version=m.profile.version;draft={...m.profile};}
  const root=document.getElementById('appearance-records');root.replaceChildren();const form=el('form');form.id='appearance-form';form.append(el('p',m.reason));
  fields(form,m.catalogue,draft,'appearance');form.addEventListener('change',()=>{draft={...m.profile,...values(form)};});const save=el('button','Save my appearance');save.type='submit';save.disabled=busy||!m.canChange;form.append(save);
  form.onsubmit=event=>{event.preventDefault();const wardrobe=m.wardrobes.find(w=>w.nearby);if(!wardrobe||busy)return;send('ChangeAppearance',{appearance:values(form),appearanceVersion:m.profile.version,wardrobeId:wardrobe.id,homeVersion:view.world.home.version,leaseVersion:view.world.position.leaseVersion});};
  if(!m.canChange&&view.world.home){const wardrobe=m.wardrobes[0];if(wardrobe){const approach=el('button','Walk to my wardrobe');approach.type='button';approach.disabled=busy;approach.onclick=()=>window.dispatchEvent(new CustomEvent('home-fixture-use',{detail:{fixtureId:wardrobe.id,homeId:view.world.home.id,leaseVersion:view.world.position.leaseVersion}}));form.append(approach);}}
  root.append(form);
 }
 return{render,creation:()=>values(document.getElementById('creation-appearance'))};
})();
