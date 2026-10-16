"""Import a reviewed CC0 subset, embedding every referenced texture into GLB.
Usage: python tools/assets/import-kenney.py /tmp/myrp-kenney
Archives are data only; no downloaded script is executed.
"""
import hashlib, json, pathlib, struct, sys, zipfile
ROOT=pathlib.Path(__file__).resolve().parents[2]
PACKS={
 'furniture':('e67652d0932cee41683f74711c03d3e192a2af9979ef8e6b237711f5482d46b0','https://kenney.nl/assets/furniture-kit',[
 'bedDouble','bedSingle','kitchenCabinet','kitchenSink','kitchenFridge','loungeDesignSofa','loungeSofaLong','loungeDesignChair','loungeChairRelax','loungeSofaOttoman','chairModernCushion','benchCushion','desk','tableRound','tableCoffeeGlass','sideTable','bookcaseOpen','bookcaseClosedDoors','cabinetTelevisionDoors','bathroomSink','pottedPlant','lampRoundFloor','lampRoundTable','computerScreen','computerKeyboard','rugRectangle','pillowBlueLong']),
 'suburban':('5869c35cf30b1c87bdb2d197b6d325eebadd2ef08ea27f04797e8e08d77a9a39','https://kenney.nl/assets/city-kit-suburban', ['building-type-'+x for x in ['a','c','e','g','i','k','m','o']]+['tree-large','tree-small']),
 'commercial':('f8b09b081c2bb88bcc126e2dec1cb40fd0dad7e7e591b6c26aaefe96fb35276b','https://kenney.nl/assets/city-kit-commercial',['building-'+x for x in ['a','c','f','h','k','n']]+['building-skyscraper-'+x for x in ['a','c','e']]),
 'cars':('fac7dacac5c7874348cf19729af3ef205f3d366493edaf0a827d93f4fdf3d0c4','https://kenney.nl/assets/car-kit',['sedan','suv-luxury','van','taxi'])}
def embedded(data,z,member):
 assert data[:4]==b'glTF'
 n=struct.unpack_from('<I',data,12)[0];doc=json.loads(data[20:20+n]);offset=20+n
 size,kind=struct.unpack_from('<II',data,offset);assert kind==0x004e4942
 binary=bytearray(data[offset+8:offset+8+size])
 for image in doc.get('images',[]):
  if 'uri' not in image:continue
  uri=image.pop('uri');assert not uri.startswith(('/', 'http', 'data:')) and '..' not in pathlib.PurePosixPath(uri).parts
  content=z.read(str(pathlib.PurePosixPath(member).parent/uri));binary.extend(b'\0'*((-len(binary))%4));view={'buffer':0,'byteOffset':len(binary),'byteLength':len(content)}
  image['bufferView']=len(doc.setdefault('bufferViews',[]));image['mimeType']='image/png';doc['bufferViews'].append(view);binary.extend(content)
 doc['buffers']=[{'byteLength':len(binary)}];raw=json.dumps(doc,separators=(',',':')).encode();raw+=b' '*((-len(raw))%4);binary.extend(b'\0'*((-len(binary))%4))
 return struct.pack('<III',0x46546c67,2,28+len(raw)+len(binary))+struct.pack('<II',len(raw),0x4e4f534a)+raw+struct.pack('<II',len(binary),0x004e4942)+binary
def main():
 source=pathlib.Path(sys.argv[1]);out=ROOT/'web/assets/world';out.mkdir(parents=True,exist_ok=True);manifest={'licence':'CC0-1.0','packs':{},'assets':{}}
 for pack,(checksum,url,names) in PACKS.items():
  archive=source/(pack+'.zip');assert hashlib.sha256(archive.read_bytes()).hexdigest()==checksum,pack+' archive checksum mismatch'
  z=zipfile.ZipFile(archive);licence=z.read('License.txt');assert b'CC0' in licence
  (out/('LICENSE-'+pack+'.txt')).write_bytes(licence);manifest['packs'][pack]={'source':url,'archiveSha256':checksum}
  for name in names:
   members=[p for p in z.namelist() if p.endswith('/'+name+'.glb')];assert len(members)==1
   raw=z.read(members[0]);data=embedded(raw,z,members[0]);key=pack+'/'+name;dest=out/pack/(name+'.glb');dest.parent.mkdir(exist_ok=True);dest.write_bytes(data)
   manifest['assets'][key]={'url':'/assets/world/'+key+'.glb','bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'sourceMember':members[0],'sourceSha256':hashlib.sha256(raw).hexdigest()}
 (out/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n');print(len(manifest['assets']),'models;',sum(a['bytes'] for a in manifest['assets'].values()),'bytes')
if __name__=='__main__':main()
