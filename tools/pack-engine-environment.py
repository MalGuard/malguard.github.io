"""Pack offline PMREM half floats as a prefiltered Radiance atlas (GPU row order)."""
from pathlib import Path
import json,struct,math,sys,gzip
meta=json.loads(Path(sys.argv[1]).read_text());width,height=meta['width'],meta['height']
raw=Path(sys.argv[2]).read_bytes();out=bytearray(f'#?RADIANCE\n# Premixed CubeUV atlas; GPU row order, flipY=false\nFORMAT=32-bit_rle_rgbe\n\n-Y {height} +X {width}\n'.encode())
def encode(values):
 result=bytearray();i=0
 while i<len(values):
  end=i+1
  while end<len(values) and values[end]==values[i] and end-i<127:end+=1
  if end-i>=4:result.extend((128+end-i,values[i]));i=end;continue
  start=i;i=end
  while i<len(values) and i-start<128:
   end=i+1
   while end<len(values) and values[end]==values[i] and end-i<127:end+=1
   if end-i>=4:break
   i=min(end,start+128)
  result.append(i-start);result.extend(values[start:i])
 return result
pixels=list(struct.iter_unpack('<4e',raw))
for y in range(height):
 row=bytearray()
 for r,g,b,_ in pixels[y*width:(y+1)*width]:
  m=max(r,g,b)
  if m<1e-32:row.extend((0,0,0,0));continue
  _,e=math.frexp(m);scale=math.ldexp(256.,-e)
  row.extend((min(255,int(r*scale)),min(255,int(g*scale)),min(255,int(b*scale)),e+128))
 out.extend((2,2,width>>8,width&255))
 for channel in range(4):out.extend(encode(row[channel::4]))
Path(sys.argv[3]).write_bytes(gzip.compress(out,compresslevel=9,mtime=0) if sys.argv[3].endswith('.gz') else out);print({'width':width,'height':height,'bytes':Path(sys.argv[3]).stat().st_size,'peak':meta['peak']})
