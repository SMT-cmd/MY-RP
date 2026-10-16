"""Deterministic software projection of licensed GLBs for the Canvas renderer.
Renders actual geometry and embedded palettes. No browser/GPU dependency.
"""
import io,json,math,pathlib,struct
import numpy as np
from PIL import Image
ROOT=pathlib.Path(__file__).resolve().parents[2];ART=ROOT/'web/assets/world'
SCALE=2
def load(path):
 b=path.read_bytes();n=struct.unpack_from('<I',b,12)[0];j=json.loads(b[20:20+n]);off=20+n;size=struct.unpack_from('<I',b,off)[0];blob=b[off+8:off+8+size]
 def accessor(i):
  a=j['accessors'][i];v=j['bufferViews'][a['bufferView']];dtype={5126:'<f4',5125:'<u4',5123:'<u2',5121:'u1',5122:'<i2'}[a['componentType']];count={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}[a['type']];start=v.get('byteOffset',0)+a.get('byteOffset',0);step=v.get('byteStride',np.dtype(dtype).itemsize*count)
  return np.ndarray((a['count'],count),dtype=dtype,buffer=blob,offset=start,strides=(step,np.dtype(dtype).itemsize)).copy()
 def matrix(node):
  if 'matrix' in node:return np.array(node['matrix']).reshape(4,4).T
  x,y,z,w=node.get('rotation',[0,0,0,1]);r=np.array([[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]])
  m=np.eye(4);m[:3,:3]=r@np.diag(node.get('scale',[1,1,1]));m[:3,3]=node.get('translation',[0,0,0]);return m
 images=[]
 for image in j.get('images',[]):
  v=j['bufferViews'][image['bufferView']];images.append(np.asarray(Image.open(io.BytesIO(blob[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']])).convert('RGBA')))
 triangles=[];colours=[]
 def visit(index,parent):
  node=j['nodes'][index];m=parent@matrix(node)
  if 'mesh' in node:
   for primitive in j['meshes'][node['mesh']]['primitives']:
    pos=accessor(primitive['attributes']['POSITION']);pos=(np.column_stack((pos,np.ones(len(pos))))@m.T)[:,:3];indices=accessor(primitive['indices']).reshape(-1,3) if 'indices' in primitive else np.arange(len(pos)).reshape(-1,3);triangles.extend(pos[indices]);material=j.get('materials',[{}])[primitive.get('material',0)].get('pbrMetallicRoughness',{});rgba=np.array(material.get('baseColorFactor',[1,1,1,1]));color=np.round(np.clip(rgba[:3],0,1)**(1/2.2)*255)
    if 'baseColorTexture' in material:
     texture=j['textures'][material['baseColorTexture']['index']];image=images[texture['source']];uv=accessor(primitive['attributes']['TEXCOORD_0'])[indices].mean(axis=1);u=np.clip((uv[:,0]*image.shape[1]).astype(int),0,image.shape[1]-1);v=np.clip((uv[:,1]*image.shape[0]).astype(int),0,image.shape[0]-1);colours.extend(image[v,u,:3]*rgba[:3])
    else:colours.extend(np.repeat(color[None,:],len(indices),axis=0))
  for child in node.get('children',[]):visit(child,m)
 for node in j['scenes'][j.get('scene',0)]['nodes']:visit(node,np.eye(4))
 return np.array(triangles),np.array(colours)
def render(tri,col,filename,category=None):
 flat=tri.reshape(-1,3);px=(flat[:,0]-flat[:,2])*42;py=(flat[:,0]+flat[:,2])*21-flat[:,1]*48
 minx,miny=math.floor(px.min())-4,math.floor(py.min())-4;w=math.ceil(px.max())-minx+5;h=math.ceil(py.max())-miny+5
 points=np.stack(((px-minx)*SCALE,(py-miny)*SCALE),axis=1).reshape(-1,3,2);depth=(flat[:,0]+flat[:,2]+flat[:,1]*1.75).reshape(-1,3)
 rgba=np.zeros((h*SCALE,w*SCALE,4),dtype=np.uint8);maskimage=np.zeros((h*SCALE,w*SCALE),dtype=np.uint8) if category is not None else None;zbuffer=np.full((h*SCALE,w*SCALE),-np.inf);sun=np.array([-.45,1,.65]);sun/=np.linalg.norm(sun)
 normal=np.cross(tri[:,1]-tri[:,0],tri[:,2]-tri[:,0]);normal/=np.maximum(np.linalg.norm(normal,axis=1,keepdims=True),1e-8);light=.57+.43*np.maximum(0,normal@sun)
 for i,(p,d) in enumerate(zip(points,depth)):
  ax,ay=p[0];bx,by=p[1];cx,cy=p[2];den=(by-cy)*(ax-cx)+(cx-bx)*(ay-cy)
  if abs(den)<.001:continue
  x0=max(0,math.floor(p[:,0].min()));x1=min(w*SCALE,math.ceil(p[:,0].max())+1);y0=max(0,math.floor(p[:,1].min()));y1=min(h*SCALE,math.ceil(p[:,1].max())+1)
  if x0>=x1 or y0>=y1:continue
  yy,xx=np.mgrid[y0:y1,x0:x1];xx=xx+.5;yy=yy+.5;a=((by-cy)*(xx-cx)+(cx-bx)*(yy-cy))/den;b=((cy-ay)*(xx-cx)+(ax-cx)*(yy-cy))/den;c=1-a-b;z=a*d[0]+b*d[1]+c*d[2];mask=(a>=-.001)&(b>=-.001)&(c>=-.001)&(z>=zbuffer[y0:y1,x0:x1]);zbuffer[y0:y1,x0:x1][mask]=z[mask];region=rgba[y0:y1,x0:x1];region[mask,:3]=np.clip(col[i]*light[i],0,255);region[mask,3]=255
  if maskimage is not None:maskimage[y0:y1,x0:x1][mask]=category[i]
 Image.fromarray(rgba).resize((w,h),Image.Resampling.LANCZOS).save(filename,lossless=True,method=6)
 if maskimage is not None:Image.fromarray(maskimage).resize((w,h),Image.Resampling.NEAREST).save(filename.with_suffix('.mask.png'))
 return {'file':filename.name,'width':w,'height':h,'anchorX':-minx,'anchorY':-miny}
def main():
 manifest=json.loads((ART/'manifest.json').read_text());out=ART/'sprites';out.mkdir(exist_ok=True);meta={}
 furniture={
 'bedDouble':(2,2,.68),'bedSingle':(1,2,.68),'kitchenCabinet':(1,1,1.05),'kitchenSink':(1,1,1.02),'kitchenFridge':(1,1,1.9),'loungeSofaLong':(3,1,1.1),'loungeDesignSofa':(2,1,1.1),'loungeDesignChair':(1,1,1.1),'chairModernCushion':(1,1,1.03),'loungeChairRelax':(2,1,1),'loungeSofaOttoman':(1,1,.6),'benchCushion':(2,1,.95),'desk':(2,1,.85),'tableRound':(2,2,.85),'tableCoffeeGlass':(2,1,.46),'sideTable':(1,1,.63),'bookcaseOpen':(1,2,2),'bookcaseClosedDoors':(1,2,2.1),'cabinetTelevisionDoors':(2,1,.83),'bathroomSink':(2,1,1.05),'pottedPlant':(1,1,1.6),'lampRoundFloor':(1,1,1.9),'lampRoundTable':(1,1,.8)}
 for key in manifest['assets']:
  pack,name=key.split('/');tri,col=load(ROOT/('web'+manifest['assets'][key]['url']));lo=tri.reshape(-1,3).min(axis=0);hi=tri.reshape(-1,3).max(axis=0);size=np.maximum(hi-lo,.001);tri-=(lo+hi)/2;tri[:,:,1]+=size[1]/2
  if pack=='furniture':dims=furniture.get(name,(1,1,.8));scale=np.array([dims[0]/size[0],dims[2]/size[1],dims[1]/size[2]])
  elif pack=='cars':scale=np.array([1.7/size[0],min(1.7/size[0],4.15/size[2]),4.15/size[2]]);dims=(1.7,4.15,size[1]*scale[1])
  elif name.startswith('tree'):scale=np.array([1.4/size[0],3.8/size[1],1.4/size[2]]);dims=(1.4,1.4,3.8)
  else:scale=np.array([4.88/size[0],min(4.88/size[0],3.88/size[2]),3.88/size[2]]);dims=(5,4,size[1]*scale[1])
  tri*=scale;views=[]
  for turn in range(4):
   angle=-turn*math.pi/2;c,s=math.cos(angle),math.sin(angle);rot=np.array([[c,0,s],[0,1,0],[-s,0,c]]);data=render(tri@rot.T,col,out/(key.replace('/','-')+'-'+str(turn)+'.webp'));views.append(data)
  meta[key]={'w':dims[0],'d':dims[1],'height':dims[2],'views':views}
 (out/'manifest.json').write_text(json.dumps(meta,separators=(',',':'))+'\n');print('Rendered',len(meta),'models in four views;',sum(p.stat().st_size for p in out.glob('*.webp')),'bytes',flush=True)
if __name__=='__main__':main()
