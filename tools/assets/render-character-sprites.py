"""Project the existing skinned adults into bounded atlases for Canvas devices."""
import importlib.util,json,pathlib,concurrent.futures,tempfile
import numpy as np
from PIL import Image
HERE=pathlib.Path(__file__).resolve().parent;ROOT=HERE.parents[1];SOURCE=ROOT.parent/'character-projection'
spec=importlib.util.spec_from_file_location('projection',HERE/'render-world-sprites.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
def one(frame):
 name=frame['name'];tri=np.fromfile(SOURCE/(name+'.f32'),dtype='<f4').reshape(-1,3,3);col=np.fromfile(SOURCE/(name+'.rgb'),dtype='u1').reshape(-1,3);cat=np.fromfile(SOURCE/(name+'.cat'),dtype='u1');out=SOURCE/(name+'.webp');meta=module.render(tri,col,out,cat);return frame,meta
def main():
 frames=json.loads((SOURCE/'frames.json').read_text());out=ROOT/'web/assets/world/characters';out.mkdir(exist_ok=True);atlas={};masks={};w,h=160,160
 with concurrent.futures.ProcessPoolExecutor(max_workers=3) as pool:
  for index,(frame,meta) in enumerate(pool.map(one,frames)):
   key=frame['body']+'-'+frame['outfit'];atlas.setdefault(key,Image.new('RGBA',(w*8,h*4)));masks.setdefault(key,Image.new('L',(w*8,h*4)));x=frame['phase']*w+80-meta['anchorX'];y=['front','right','back','left'].index(frame['face'])*h+128-meta['anchorY'];img=Image.open(SOURCE/(frame['name']+'.webp'));mask=Image.open(SOURCE/(frame['name']+'.mask.png'));cell=Image.new('RGBA',(w,h));cell.paste(img,(x-frame['phase']*w,y-['front','right','back','left'].index(frame['face'])*h));atlas[key].paste(cell,(frame['phase']*w,['front','right','back','left'].index(frame['face'])*h));maskcell=Image.new('L',(w,h));maskcell.paste(mask,(x-frame['phase']*w,y-['front','right','back','left'].index(frame['face'])*h));masks[key].paste(maskcell,(frame['phase']*w,['front','right','back','left'].index(frame['face'])*h))
   if index%32==0:print('Character frames',index+1,'/',len(frames),flush=True)
 for key,img in atlas.items():img.save(out/(key+'.webp'),lossless=True,method=6);masks[key].save(out/(key+'-mask.webp'),lossless=True,method=6)
 (out/'manifest.json').write_text(json.dumps({'cellWidth':w,'cellHeight':h,'anchorX':80,'anchorY':128,'phases':8,'directions':['front','right','back','left'],'atlases':list(atlas),'source':'Quaternius Universal Base Characters Standard CC0-1.0; MY RP pose driver'})+'\n');print('Saved',len(atlas),'character atlases;',sum(f.stat().st_size for f in out.glob('*.webp')),'bytes',flush=True)
if __name__=='__main__':main()
