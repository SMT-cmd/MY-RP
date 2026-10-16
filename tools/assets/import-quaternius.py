"""Reproduce the CC0 subset: python tools/assets/import-quaternius.py <official ZIP>."""
import hashlib,json,struct,sys,zipfile,contextlib
from pathlib import Path
source=Path(sys.argv[1])
if not source.is_dir() and hashlib.sha256(source.read_bytes()).hexdigest()!='fdbf1804c90dfc1ea03e992bff7da2dfd1a79318e13270a660180f9308455f40': raise SystemExit('Unexpected archive; review its licence and origin.')
output=Path(__file__).resolve().parents[2]/'web/assets/characters';output.mkdir(parents=True,exist_ok=True)
class VerifiedFolder:
 def read(self,name):
  name=name.removeprefix('Universal Base Characters[Standard]/')
  expected={'License_Standard.txt':'383cc15f00799f91d6e69407ea8f4037be9492e9','Base Characters/Godot - UE/Superhero_Male_FullBody.gltf':'7e4b5b57dca66cced9127b25a6f111a0919da00a','Base Characters/Godot - UE/Superhero_Male_FullBody.bin':'54309de6c6ccad823a8ced11056f4013b197b1c6','Base Characters/Godot - UE/Superhero_Female_FullBody.gltf':'804aa3d3bbbd1977d31ec25c7dbf9a00705be49d','Base Characters/Godot - UE/Superhero_Female_FullBody.bin':'6e6507c85a4993e97d31f187b4d0715af300400d','Base Characters/Godot - UE/T_Eye_Brown.png':'0d037febc2789c86fdb40d7ccd4c0a1d0591cfbe'}
  if name not in expected:raise ValueError('Unlisted source member')
  data=(source/name).read_bytes()
  if hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()!=expected[name]:raise ValueError('Source member hash mismatch')
  return data.replace(b'\n',b'\r\n') if name=='License_Standard.txt' else data
with (contextlib.nullcontext(VerifiedFolder()) if source.is_dir() else zipfile.ZipFile(source)) as archive:
 prefix='Universal Base Characters[Standard]/';licence=archive.read(prefix+'License_Standard.txt')
 if b'CC0 1.0 Universal' not in licence: raise SystemExit('Expected licence absent.')
 (output/'LICENSE-Quaternius.txt').write_bytes(licence)
 (output/'eyes-brown.png').write_bytes(archive.read(prefix+'Base Characters/Godot - UE/T_Eye_Brown.png'))
 for body in ['Male','Female']:
  base=prefix+'Base Characters/Godot - UE/Superhero_'+body+'_FullBody';g=json.loads(archive.read(base+'.gltf'));b=archive.read(base+'.bin')
  if len(g['buffers'])!=1 or g['buffers'][0]['byteLength']!=len(b): raise SystemExit('Unexpected buffers.')
  for mat in g['materials']:
   p=mat.setdefault('pbrMetallicRoughness',{});p.pop('baseColorTexture',None);p.pop('metallicRoughnessTexture',None);p['metallicFactor']=0;p['roughnessFactor']=.8;mat.pop('normalTexture',None)
  for k in ['images','textures','samplers']:g.pop(k,None)
  g['buffers'][0].pop('uri',None);g['asset']['extras']={'source':'Quaternius Universal Base Characters Standard','licence':'CC0-1.0','processing':'Geometry and skinning retained; external texture references removed for local palette clothing.'}
  j=json.dumps(g,separators=(',',':')).encode();j+=b' '*(-len(j)%4);b+=b'\0'*(-len(b)%4)
  glb=struct.pack('<III',0x46546c67,2,28+len(j)+len(b))+struct.pack('<II',len(j),0x4e4f534a)+j+struct.pack('<II',len(b),0x004e4942)+b
  target=output/('adult-'+body.lower()+'.glb');target.write_bytes(glb);print(target.name,len(glb),hashlib.sha256(glb).hexdigest())
