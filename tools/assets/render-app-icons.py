"""Render the existing code-native favicon family for MY RP (no bitmap inputs)."""
from pathlib import Path
from PIL import Image,ImageDraw
root=Path(__file__).resolve().parents[2]/'web'
points=[(8,33),(20,33),(23,31),(25,27),(28,17),(30,14),(40,14)]
root.joinpath('favicon.svg').write_text('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" rx="12" fill="#0a0e17"/><path d="M8 33 20 33 23 31 25 27 28 17 30 14 40 14" fill="none" stroke="#ffb052" stroke-width="7" stroke-linejoin="round"/><path d="M8 20 21 9h8L16 20z" fill="#7498ff"/></svg>\n')
for size in [192,512]:
 scale=size/48;image=Image.new('RGBA',(size,size));draw=ImageDraw.Draw(image)
 draw.rounded_rectangle((0,0,size,size),radius=round(12*scale),fill='#0a0e17')
 draw.line([(round(x*scale),round(y*scale)) for x,y in points],fill='#ffb052',width=round(7*scale),joint='curve')
 draw.polygon([(round(x*scale),round(y*scale)) for x,y in [(8,20),(21,9),(29,9),(16,20)]],fill='#7498ff')
 image.save(root/f'app-icon-{size}.png',optimize=True)
