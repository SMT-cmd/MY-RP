(() => {
 const cards=new Map();let latest=null,dispatch=null,locked=true,owner=null;
 const topics={hello:'Say hello',services:'Ask about services',work:'Ask about work',travel:'Ask about travel'};
 function render(view,perform,disabled){
  const host=document.getElementById('world-npcs');if(!host)return;
  latest=view;dispatch=perform;locked=disabled;
  if(!view?.world||owner!==view.accountId){cards.clear();host.replaceChildren();owner=view?.accountId??null;}
  const visible=new Set();
  for(const n of view?.world?.npcs??[]){
   visible.add(n.id);let card=cards.get(n.id);
   if(!card){
    const root=document.createElement('article'),heading=document.createElement('h3'),position=document.createElement('p'),remembered=document.createElement('p'),walk=document.createElement('button'),buttons=[];
    walk.type='button';walk.textContent='Walk to neighbour';
    walk.addEventListener('click',()=>{const current=latest?.world?.npcs?.find(p=>p.id===n.id);if(!current||locked)return;window.dispatchEvent(new CustomEvent('world-tile-select',{detail:{x:current.x,y:current.y,homeId:null,leaseVersion:latest.world.position.leaseVersion}}));});
    root.append(heading,position,remembered,walk);
    for(const [topic,label] of Object.entries(topics)){const b=document.createElement('button');b.type='button';b.textContent=label;b.addEventListener('click',()=>{const current=latest?.world?.npcs?.find(p=>p.id===n.id);if(!current||locked||!current.canTalk)return;dispatch('TalkToNeighbour',{npcId:n.id,topic,leaseVersion:latest.world.position.leaseVersion});});root.append(b);buttons.push(b);}
    card={root,heading,position,remembered,walk,buttons};cards.set(n.id,card);host.append(root);
   }
   card.heading.textContent=n.name+' · '+n.role;
   card.position.textContent=n.routine+' · tile ('+n.x+','+n.y+'). '+(n.canTalk?'Close enough to talk.':'Walk closer to talk.');
   const memory=view.world.npcHistory?.find(r=>r.npcId===n.id);
   card.remembered.textContent=memory?'Conversations together: '+memory.count+'. Last topic: '+memory.topic+'.':'';
   card.walk.disabled=locked;card.buttons.forEach(b=>b.disabled=locked||!n.canTalk);
  }
  for(const [id,card] of cards)if(!visible.has(id)){card.root.remove();cards.delete(id);}
  host.hidden=visible.size===0;
 }
 window.NeighboursUI={render,focus(id){const card=cards.get(id);if(!card)return;card.root.scrollIntoView?.({block:'nearest',behavior:'auto'});card.walk.focus();}};
 window.addEventListener('npc-select',event=>window.NeighboursUI.focus(event.detail?.npcId));
})();
