import * as T from 'three';

export function seededRandom(seed=1993){return()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};}
export function canvasTexture(size,paint,color=true){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=size;
 paint(canvas.getContext('2d'),size);
 const texture=new T.CanvasTexture(canvas);if(color)texture.colorSpace=T.SRGBColorSpace;
 texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.anisotropy=8;return texture;
}
export function createVisitorMaterials(){
 const random=seededRandom(84521),standard=(color,extra={})=>new T.MeshStandardMaterial({color,roughness:.92,...extra});
 const limestone=canvasTexture(1024,(c,s)=>{
  c.fillStyle='#c7c5b9';c.fillRect(0,0,s,s);
  for(let i=0;i<85000;i++){const n=100+random()*115;c.fillStyle=`rgba(${n},${n},${n*.94},${.03+random()*.12})`;c.fillRect(random()*s,random()*s,1+random()*5,1+random()*3);}
  for(let i=0;i<150;i++){const x=random()*s,y=random()*s;c.strokeStyle=`rgba(89,86,69,${random()*.045})`;c.lineWidth=1+random()*3;c.beginPath();c.moveTo(x,y);c.bezierCurveTo(x+30,y+50,x-20,y+100,x+10,y+140);c.stroke();}
 });
 const thatch=canvasTexture(1024,(c,s)=>{
  c.fillStyle='#6d6047';c.fillRect(0,0,s,s);
  for(let i=0;i<30000;i++){const n=58+random()*102,x=random()*s,y=random()*s;c.strokeStyle=`rgb(${n*1.13},${n},${n*.70})`;c.lineWidth=.6+random()*1.4;c.beginPath();c.moveTo(x,y);c.lineTo(x+(random()-.5)*9,y+15+random()*105);c.stroke();}
  for(let y=0;y<s;y+=128){const g=c.createLinearGradient(0,y-6,0,y+26);g.addColorStop(0,'#211d1728');g.addColorStop(1,'#211d1700');c.fillStyle=g;c.fillRect(0,y-6,s,32);}
 });
 const gravel=canvasTexture(512,(c,s)=>{
  c.fillStyle='#665643';c.fillRect(0,0,s,s);
  for(let i=0;i<42000;i++){const n=40+random()*95;c.fillStyle=`rgba(${n*1.08},${n*.93},${n*.76},.55)`;c.fillRect(random()*s,random()*s,1+random()*2,1+random()*2);}
 });gravel.repeat.set(12,22);
 const grass=canvasTexture(512,(c,s)=>{
  c.fillStyle='#4d5939';c.fillRect(0,0,s,s);
  for(let i=0;i<55000;i++){const n=22+random()*60;c.strokeStyle=`rgba(${n*.87},${n+14},${n*.55},.55)`;const x=random()*s,y=random()*s;c.beginPath();c.moveTo(x,y);c.lineTo(x+random()*3-1,y-2-random()*5);c.stroke();}
 });grass.repeat.set(35,35);
 const bark=canvasTexture(512,(c,s)=>{
  c.fillStyle='#726d5a';c.fillRect(0,0,s,s);
  for(let i=0;i<16000;i++){const n=50+random()*100;c.strokeStyle=`rgba(${n},${n*.96},${n*.78},.28)`;const x=random()*s,y=random()*s;c.beginPath();c.moveTo(x,y);c.lineTo(x+random()*4,y+20+random()*50);c.stroke();}
  for(let y=0;y<s;y+=26){c.fillStyle='#332f242e';c.fillRect(0,y,s,3);c.fillStyle='#d3cbbb35';c.fillRect(0,y+3,s,2);}
 });bark.repeat.set(1,4);
 const waterNormals=canvasTexture(256,(c,s)=>{
  const data=c.createImageData(s,s);
  for(let y=0;y<s;y++)for(let x=0;x<s;x++){
   const a=x/s*Math.PI*2,b=y/s*Math.PI*2,n=(y*s+x)*4;
   const dx=.24*Math.cos(a*8+b*5)+.10*Math.cos(a*21-b*13),dy=.24*Math.cos(a*8+b*5)+.10*Math.cos(a*17+b*19);
   const v=new T.Vector3(dx,dy,1).normalize();data.data[n]=(v.x*.5+.5)*255;data.data[n+1]=(v.y*.5+.5)*255;data.data[n+2]=(v.z*.5+.5)*255;data.data[n+3]=255;
  }c.putImageData(data,0,0);
 },false);
 return {
  stone:standard(0xe3e1d6,{map:limestone,bumpMap:limestone,bumpScale:.045}),
  coping:standard(0xc6c5b8,{map:limestone,bumpMap:limestone,bumpScale:.035}),
  recess:standard(0x4b5148),seam:standard(0x737667),
  thatch:standard(0xc3b598,{map:thatch,bumpMap:thatch,bumpScale:.12,side:T.DoubleSide}),
  thatchEdge:standard(0x605139),wood:standard(0x714127,{roughness:.76}),
  turquoise:standard(0x3b746c,{roughness:.61,metalness:.12}),
  glass:standard(0x182e2c,{roughness:.2,metalness:.3,envMapIntensity:.45}),
  rail:standard(0x735046,{metalness:.2,roughness:.68}),
  gravel:standard(0xc2b095,{map:gravel,bumpMap:gravel,bumpScale:.065}),
  grass:standard(0xa2a889,{map:grass,bumpMap:grass,bumpScale:.045}),
  bark:standard(0xbdb7a0,{map:bark,bumpMap:bark,bumpScale:.10}),
  leaf:standard(0xffffff,{vertexColors:true,side:T.DoubleSide,roughness:.73}),
  soil:standard(0x3c3829),rock:standard(0x79796a,{map:limestone,bumpMap:limestone,bumpScale:.09}),
  waterNormals
 };
}
