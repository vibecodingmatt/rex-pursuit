// Model-space suspension: two weight transfers per stride, with a smaller lateral
// rock over each supporting leg. Large quadrupeds carry their mass more quietly.
export const SAFARI_MOTION={
 gallimimus:[.014,.018,.025],raptor:[.013,.022,.03],dilophosaurus:[.012,.018,.026],
 parasaurolophus:[.009,.012,.017],pachycephalosaurus:[.011,.022,.028],
 triceratops:[.005,.008,.013],stegosaurus:[.004,.007,.011],
};
export function safariBody(phase,stride,profile,out){
 const th=phase*Math.PI*2,a=stride*stride;
 out.x=profile[0]*a*(.25+.75*Math.cos(th*2.));
 out.y=profile[1]*a*Math.sin(th*2.-.45);
 out.z=profile[2]*a*Math.sin(th);
 return out;
}

// aBody is the instance's model-space heave, pitch, roll and body-centre height.
// Undo its transform at the toes, fading the correction up the leg: the torso
// can rise and rock without pulling the supporting foot off the road.
export const SAFARI_GAIT_GLSL=`
 vec3 critterPitch(vec3 p,float a){float c=cos(a),s=sin(a);return vec3(p.x,c*p.y-s*p.z,s*p.y+c*p.z);}
 vec3 critterRoll(vec3 p,float a){float c=cos(a),s=sin(a);return vec3(c*p.x-s*p.y,s*p.x+c*p.y,p.z);}
 void critterSupport(inout vec3 p,inout vec3 n,float weight){
  vec3 centre=vec3(0.,aBody.w,0.);
  vec3 plant=critterRoll(critterPitch(p-centre-vec3(0.,aBody.x,0.),-aBody.y),-aBody.z)+centre;
  p=mix(p,plant,weight);
  n=normalize(mix(n,critterRoll(critterPitch(n,-aBody.y),-aBody.z),weight));
 }
 void safariPose(inout vec3 p,inout vec3 n){
  float part=rig.x,w=rig.y,side=rig.z,lead=rig.w,th=aPose.x*6.2831853,amp=aPose.y,dead=aPose.w;
  float blend=smoothstep(0.,.24,w),ph=th+(side*lead>0.?0.:3.1415927);
  vec3 rest=p,q=p-pivot;
  if(part>2.5&&part<3.5){
   float a=(amp*sin(ph)*.72+dead*(lead<0.?-.7:1.15+side*.2))*blend;
   q=critterPitch(q,-a);n=critterPitch(n,-a);p=pivot+q;
   // Remove the pendulum's artificial lift, then clear the road on the return.
   float toe=smoothstep(.3,.9,w),lift=max(0.,cos(ph))*amp*.08;
   p.y+=toe*(rest.y-p.y+lift)*(1.-dead);
   critterSupport(p,n,toe*(1.-dead));
  }else{
   if(part>3.5){
    // Loose forearms lag the shoulder and counter the same-side hind leg.
    float a=(amp*(.23*sin(ph-.65)+.065*sin(th*2.-.4))+dead*.65)*blend;
    q=critterPitch(q,a);n=critterPitch(n,a);
    float sway=side*amp*.035*sin(th*2.-.6)*blend*(1.-dead);
    q=critterRoll(q,sway);n=critterRoll(n,sway);
   }else if(part>.5&&part<1.5){
    float a=(-aPose.z*1.05-amp*.045*sin(th*2.-.35)+dead*.75)*blend;
    q=critterPitch(q,-a);n=critterPitch(n,-a);
   }else if(part>1.5){
    float a=(amp*.18*sin(th-.3)+dead*.45)*w*blend,c=cos(a),s=sin(a);
    q.xz=vec2(c*q.x-s*q.z,s*q.x+c*q.z);n.xz=vec2(c*n.x-s*n.z,s*n.x+c*n.z);
    q.y+=w*w*blend*amp*.018*cos(th*2.-.5);
   }
   p=pivot+q;
  }
 }
`;
