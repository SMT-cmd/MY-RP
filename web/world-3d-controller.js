// WebGL is optional. All commands and accessible controls survive scene failure.
(()=>{
 const fallback=window.WorldRenderer;let engine=null,loading=null,failed=false,generation=0,last=null;
 async function update(world,quality){last={world,quality};const version=++generation,host=document.getElementById('world-canvas');
  if(quality==='low'){if(engine)engine.update(world,'low');else await fallback.update(world,'low');host.hidden=true;return;}
  if(failed||!window.WebGL2RenderingContext||!window.ResizeObserver){await fallback.update(world,quality);window.FurnishingUI?.syncScene();return;}
  try{loading??=import('/scene/engine.js');const module=await loading;if(version!==generation)return;if(!engine){fallback.destroy();engine=module.createEngine(host,()=>{failed=true;engine?.destroy();engine=null;Promise.resolve(fallback.update(last.world,last.quality)).then(()=>window.FurnishingUI?.syncScene());document.getElementById('notice').textContent='The 3D view paused. You can continue with the 2D view and controls.';});}host.hidden=false;engine.update(world,quality);window.FurnishingUI?.syncScene();}
  catch{failed=true;engine?.destroy();engine=null;await fallback.update(world,quality);window.FurnishingUI?.syncScene();}
 }
 window.WorldRenderer={update,destroy(){generation++;engine?.destroy();engine=null;fallback.destroy();last=null;}};
})();
