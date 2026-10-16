# Lossless file-format encoding only. No pixel, crop, size or colour edits.
from PIL import Image
from pathlib import Path
import hashlib,json
root=Path('web/assets')
records=[]
for source in [root/'brand/my-rp-logo-night.png',root/'brand/my-rp-city-keyart.png',*sorted((root/'concepts').glob('*.png'))]:
 target=source.with_suffix('.webp')
 with Image.open(source) as image:
  image.save(target,'WEBP',lossless=True,method=6,exact=True)
  with Image.open(target) as encoded:
   assert image.size==encoded.size and image.convert('RGBA').tobytes()==encoded.convert('RGBA').tobytes()
  records.append({'source':str(source),'deployed':str(target),'width':image.width,'height':image.height,'source_bytes':source.stat().st_size,'web_bytes':target.stat().st_size,'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'decoded_pixels_identical':True})
Path('docs/art/web-encodings.json').write_text(json.dumps(records,indent=2)+'\n')
print(json.dumps(records))
