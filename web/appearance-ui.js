'use strict';
window.AppearanceUI=(()=>{
 const el=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
 const labels={skin:'Skin tone',frame:'Body frame',hair:'Hairstyle',hairColour:'Hair colour',outfit:'Clothing style',top:'Top colour',bottom:'Trouser colour'};
 function fields(root,catalogue,profile,prefix){
  for(const [key,values] of Object.entries(catalogue)){
   const label=el('label',labels[key]),select=el('select');select.id=prefix+'-'+key;select.name=key;
   for(const value of values){const option=el('option',value.name);option.value=value.id;option.selected=profile[key]===value.id;select.append(option);}label.append(select);root.append(label);
  }
 }
 function values(root){return Object.fromEntries([...root.querySelectorAll('select[name]')].map(s=>[s.name,s.value]));}
 function render(view,send,busy){
  const m=view.appearance;if(!m)return;const creation=document.getElementById('creation-appearance');
  if(!creation.childElementCount)fields(creation,m.catalogue,m.profile,'create-appearance');
  const panel=document.getElementById('appearance-panel');panel.hidden=!view.citizen;if(!view.citizen)return;
  const root=document.getElementById('appearance-records');root.replaceChildren();const form=el('form');form.id='appearance-form';form.append(el('p',m.reason));
  fields(form,m.catalogue,m.profile,'appearance');const save=el('button','Save my appearance');save.disabled=busy||!m.canChange;form.append(save);
  form.onsubmit=event=>{event.preventDefault();const wardrobe=m.wardrobes.find(w=>w.nearby);if(!wardrobe||busy)return;send('ChangeAppearance',{appearance:values(form),appearanceVersion:m.profile.version,wardrobeId:wardrobe.id,homeVersion:view.world.home.version,leaseVersion:view.world.position.leaseVersion});};
  if(!m.canChange&&view.world.home){const wardrobe=m.wardrobes[0];if(wardrobe){const approach=el('button','Walk to my wardrobe');approach.type='button';approach.disabled=busy;approach.onclick=()=>window.dispatchEvent(new CustomEvent('home-fixture-select',{detail:{fixtureId:wardrobe.id,homeId:view.world.home.id,leaseVersion:view.world.position.leaseVersion}}));form.append(approach);}}
  root.append(form);
 }
 return{render,creation:()=>values(document.getElementById('creation-appearance'))};
})();
