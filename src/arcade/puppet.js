// Lightweight image-mesh puppetry. Smooth local influences move limbs, jaw and tail
// independently; UVs remain fixed on the generated hide. Geometry is reused per draw.
const COLS=8,ROWS=10,vertices=Array.from({length:(COLS+1)*(ROWS+1)},()=>({x:0,y:0,u:0,v:0}));
const bell=(x,center,width)=>Math.exp(-(((x-center)/width)**2));
function triangle(ctx,image,a,b,c){
 const det=(b.u-a.u)*(c.v-a.v)-(c.u-a.u)*(b.v-a.v);if(Math.abs(det)<.0001)return;
 const A=((b.x-a.x)*(c.v-a.v)-(c.x-a.x)*(b.v-a.v))/det;
 const B=((b.y-a.y)*(c.v-a.v)-(c.y-a.y)*(b.v-a.v))/det;
 const C=((c.x-a.x)*(b.u-a.u)-(b.x-a.x)*(c.u-a.u))/det;
 const D=((c.y-a.y)*(b.u-a.u)-(b.y-a.y)*(c.u-a.u))/det;
 ctx.save();ctx.beginPath();const mx=(a.x+b.x+c.x)/3,my=(a.y+b.y+c.y)/3;
 for(const [i,p]of [a,b,c].entries()){const dx=p.x-mx,dy=p.y-my,len=Math.hypot(dx,dy)||1,x=p.x+dx/len*.45,y=p.y+dy/len*.45;if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);}
 ctx.closePath();ctx.clip();ctx.transform(A,B,C,D,a.x-A*a.u-C*a.v,a.y-B*a.u-D*a.v);ctx.drawImage(image,0,0);ctx.restore();
}
export function drawPuppet(ctx,image,rect,size,kind,age,reduced=false){
 const [sx,sy,sw,sh]=rect,t=age*(kind==='rex'||kind==='indominus'?4.8:7.5),stride=reduced?.2:1;
 for(let j=0;j<=ROWS;j++)for(let i=0;i<=COLS;i++){
  const u=i/COLS,v=j/ROWS,p=vertices[j*(COLS+1)+i];let dx=0,dy=0;
  if(kind==='ptero'){
   const wing=Math.abs(u-.56);dy=Math.sin(t)*wing*wing*.35;dx=Math.cos(t)*wing*.035;
  }else if(kind==='mosa'||kind==='ichthy'){
   dx=Math.sin(t*.5+v*5)*.024*v;dy=Math.cos(t*.5+u*4)*.014;
  }else{
   const legs=Math.max(0,(v-.55)/.45),left=bell(u,.38,.16),right=bell(u,.76,.17);
   dx=legs*(left*Math.sin(t)+right*Math.sin(t+Math.PI))*.047;
   dy=legs*(left*Math.cos(t)+right*Math.cos(t+Math.PI))*.036;
   dx+=bell(v,.55,.28)*bell(u,.9,.22)*Math.sin(t*.65)*.025;
   const head=bell(u,kind==='dilo'?.5:.3,.24)*bell(v,.28,.22);
   dy+=head*Math.sin(t*.5)*.012;dx+=head*Math.cos(t*.4)*.008;
   dy+=Math.sin(t*2)*.004*(1-legs);
  }
  p.x=(u-.5+dx*stride)*size;p.y=(v-.5+dy*stride)*size;p.u=sx+u*sw;p.v=sy+v*sh;
 }
 for(let j=0;j<ROWS;j++)for(let i=0;i<COLS;i++){
  const a=vertices[j*(COLS+1)+i],b=vertices[j*(COLS+1)+i+1],c=vertices[(j+1)*(COLS+1)+i],d=vertices[(j+1)*(COLS+1)+i+1];triangle(ctx,image,a,b,c);triangle(ctx,image,b,d,c);
 }
}
