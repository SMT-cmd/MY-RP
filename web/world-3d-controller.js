// WebGL is optional. All commands and accessible controls survive scene failure.
(()=>{
 const fallback=window.WorldRenderer;let engine=null,loading=null,failed=false,generation=0,last=null;
 async function update(world,quality){last={world,quality};const version=++generation,host=document.getElementById('world-canvas');
  if(!world)return;
  if(quality==='low'){engine?.destroy();engine=null;await fallback.update(world,'low');window.FurnishingUI?.syncScene();return;}
  if(failed||!window.WebGL2RenderingContext||!window.ResizeObserver){await fallback.update(world,quality);window.FurnishingUI?.syncScene();return;}
  try{loading??=import('/scene/engine.js');const module=await loading;if(version!==generation)return;if(!engine){fallback.destroy();engine=module.createEngine(host,()=>{failed=true;engine?.destroy();engine=null;Promise.resolve(fallback.update(last.world,last.quality)).then(()=>window.FurnishingUI?.syncScene());document.getElementById('notice').textContent='The 3D view paused. You can continue with the 2D view and controls.';});}host.hidden=false;engine.update(world,quality);window.FurnishingUI?.syncScene();}
  catch{if(version!==generation||!last)return;failed=true;engine?.destroy();engine=null;await fallback.update(world,quality);window.FurnishingUI?.syncScene();}
 }
 window.WorldRenderer={update,destroy(){generation++;engine?.destroy();engine=null;fallback.destroy();last=null;}};
})();
