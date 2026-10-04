import * as T from 'three';

// A11: the Indominus is Pursuit's hero Rex re-proportioned and reskinned; boss-rex.js drives her
// exactly like the Rex (the rules share the 6.4 s boss cycle). Longer, heavier arms with bigger
// claws and a narrower, longer skull come from bone scales in the rest pose (createRex's
// `proportions`; the legs stay as built, because the gait's IK is measured from them). Her hide
// is pale and chalky with dark grey stripes down the flanks and tail. While the rules hide her
// (e.alpha < 1) the hide fades to a shimmer with bright Fresnel edges; her eyes stay lit (the radio:
// "watch for the eyes"), her shadow stays, and a hit drops the camouflage for a moment.
//
// Bone axes (measured): Y runs along each bone; the head's X is across the skull, Y toward the
// snout, Z up. Arms scale uniformly: a non-uniform parent scale shears the rotated forearm.
export const PROPORTIONS={arm_01_:[1.45,1.45,1.45],arm_02_:[1,1.25,1],finger_01_01_:[1.3,1.3,1.3],finger_02_01_:[1.3,1.3,1.3],head_012:[.86,1.08,.97]};

const HIDE=`
    // Indominus: a pale, chalky hide; broken grey stripes down the flanks and tail; darker scutes along the back.
    {float il=dot(c,vec3(.2126,.7152,.0722));vec3 pale=vec3(.205,.2,.193)*(.75+.45*il)*(.82+.36*big);
     // Countershaded: a darker grey back over pale flanks and a near-white belly and throat.
     pale*=mix(1.,.58,dorsal*smoothstep(.2,.7,big+.25));
     float stripe=smoothstep(.25,.7,sin(p.z*3.6+big*2.6+p.y*1.9))*(1.-smoothstep(4.6,5.2,p.z))*smoothstep(-.2,.5,dorsal+.15)*(1.-ventral)*mix(.45,1.,smoothstep(.3,.6,mid+.18));
     pale=mix(pale,vec3(.038,.04,.042)*(.75+.5*speck),stripe*.85);
     pale=mix(pale,pale*vec3(.58,.57,.56),dorsal*smoothstep(.5,.85,rexScaleH)*.65);
     pale=mix(pale,vec3(.3,.295,.285),ventral*.6);
     // A dark mask around the eyes and down the snout's top.
     float face=smoothstep(4.9,5.4,p.z)*smoothstep(.1,.6,dorsal+abs(rn.x)*.6)*smoothstep(4.2,4.45,p.y)*smoothstep(.35,.65,mid+.15);pale=mix(pale,vec3(.03,.03,.032),face*.7);
     c=mix(pale,c,rexMouth);}
    if(uRexDebug>.5)`;
const CAMO=`#include <dithering_fragment>
    // Transparent only for the camouflage: the hide texture's alpha is not coverage.
    gl_FragColor.a=1.;
    if(uIndoCamo>.001){
     // Active camouflage: the hide goes clear but for a shimmer of moving cell lines and its silhouette's edge.
     float fres=pow(1.-abs(dot(normalize(normal),normalize(vViewPosition))),2.4);
     vec3 q=vImpactRest*6.5;float cells=abs(sin(q.x+uIndoTime*1.7)*sin(q.y-uIndoTime*1.1)*sin(q.z+uIndoTime*.8));
     float lines=1.-smoothstep(0.,.05,cells);
     gl_FragColor.rgb=mix(gl_FragColor.rgb,gl_FragColor.rgb*.35+vec3(.5,.62,.68)*(fres*.6+lines*.4),uIndoCamo);
     gl_FragColor.a*=mix(1.,.02+fres*.32+lines*.14,uIndoCamo);
    }`;

/**
 * Osteoderms down her back and tail, larger over the shoulders, and horns over her brows: one
 * skinned mesh on her own skeleton. Each spike copies the skin weights of the hide vertex it
 * stands on, so it rides every pose, the death fall included. Rest space: y up, z toward the snout.
 */
function osteoderms(rex){
 const skin=rex.skin,g=skin.geometry,P=g.attributes.position,N=g.attributes.normal,SI=g.attributes.skinIndex,SW=g.attributes.skinWeight,top=new Map();
 // The highest upward-facing hide vertex in each 0.32 m slice along the body is the dorsal ridge.
 for(let i=0;i<P.count;i++){if(N.getY(i)<.55)continue;const z=P.getZ(i),k=Math.round(z/.32),y=P.getY(i),b=top.get(k);if(!b||y>P.getY(b))top.set(k,i);}
 const cone=new T.ConeGeometry(1,1,5,1).translate(0,.5,0),pos=[],nor=[],idx=[],wts=[],ind=[],m=new T.Matrix4(),q=new T.Quaternion(),v=new T.Vector3(),n=new T.Vector3(),up=new T.Vector3(0,1,0);
 const spike=(i,dx,h,r,lean)=>{const base=new T.Vector3(P.getX(i)+dx,P.getY(i)-.04-Math.abs(dx)*.35,P.getZ(i)),dir=new T.Vector3(N.getX(i)+dx*1.5,N.getY(i),N.getZ(i)-lean).normalize();
  m.compose(base,q.setFromUnitVectors(up,dir),v.set(r,h,r));const o=pos.length/3,cp=cone.attributes.position,cn=cone.attributes.normal;
  for(let k=0;k<cp.count;k++){v.fromBufferAttribute(cp,k).applyMatrix4(m);pos.push(v.x,v.y,v.z);n.fromBufferAttribute(cn,k).transformDirection(m);nor.push(n.x,n.y,n.z);ind.push(SI.getX(i),SI.getY(i),SI.getZ(i),SI.getW(i));wts.push(SW.getX(i),SW.getY(i),SW.getZ(i),SW.getW(i));}
  for(let k=0;k<cone.index.count;k++)idx.push(o+cone.index.getX(k));};
 for(const [k,i]of top){const z=k*.32;if(z>5.1||z<-7.5)continue;
  // Biggest over the shoulders and hips, smaller up the neck and down the tail.
  const s=.55+.45*Math.exp(-(((z-1.6)/2.2)**2))-.25*T.MathUtils.smoothstep(z,3.6,5)-.3*T.MathUtils.smoothstep(-z,3,7.5);
  spike(i,0,.52*s,.11*s,.55);for(const dx of [-.17,.17])spike(i,dx,.34*s,.085*s,.45);}
 // Brow horns: the highest hide over each eye, from the eye mesh's own bounds.
 const eyes=rex.meshes.find(e=>e.name==='Rex_Eyes');eyes?.geometry.computeBoundingBox();const bb=eyes?.geometry.boundingBox;
 if(bb){const c=bb.getCenter(new T.Vector3());for(const ex of [bb.min.x+.04,bb.max.x-.04]){let best=-1;for(let i=0;i<P.count;i++){const dx=P.getX(i)-ex,dz=P.getZ(i)-c.z;if(dx*dx+dz*dz<.09*.09&&P.getY(i)>c.y&&(best<0||P.getY(i)>P.getY(best)))best=i;}if(best>=0)spike(best,0,.38,.1,.9);}}
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(pos,3));geo.setAttribute('normal',new T.Float32BufferAttribute(nor,3));
 geo.setAttribute('skinIndex',new T.Uint16BufferAttribute(ind,4));geo.setAttribute('skinWeight',new T.Float32BufferAttribute(wts,4));geo.setIndex(idx);
 const mesh=new T.SkinnedMesh(geo,new T.MeshStandardMaterial({color:0x5e5a54,roughness:.82}));mesh.name='Indominus_Osteoderms';mesh.castShadow=mesh.receiveShadow=true;mesh.frustumCulled=false;
 skin.parent.add(mesh);mesh.position.copy(skin.position);mesh.quaternion.copy(skin.quaternion);mesh.scale.copy(skin.scale);mesh.bind(skin.skeleton,skin.bindMatrix);
 return mesh;
}

/** Reskins a hero Rex (from createRex with PROPORTIONS) as the Indominus; returns her camouflage control. */
export function makeIndominus(rex){
 const camo={value:0},time={value:0},done=new Set(),spikes=osteoderms(rex);
 for(const mesh of [...rex.meshes,spikes]){const m=mesh.material;if(!m||done.has(m))continue;done.add(m);
  const skin=mesh===rex.skin,eyes=mesh.name==='Rex_Eyes',prev=m.onBeforeCompile,key=m.customProgramCacheKey.bind(m);
  if(!eyes)m.transparent=true;
  m.onBeforeCompile=(s,r)=>{prev.call(m,s,r);s.uniforms.uIndoCamo=camo;s.uniforms.uIndoTime=time;
   s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\nuniform float uIndoCamo,uIndoTime;');
   if(skin)s.fragmentShader=s.fragmentShader.replace('if(uRexDebug>.5)',HIDE).replace('#include <dithering_fragment>',CAMO);
   // Her eyes burn through the camouflage; the rest of her (teeth, tongue, claws, cornea) goes clear.
   else if(eyes)s.fragmentShader=s.fragmentShader.replace('#include <dithering_fragment>','#include <dithering_fragment>\n    gl_FragColor.rgb+=vec3(.9,.55,.12)*uIndoCamo*.35;');
   else s.fragmentShader=s.fragmentShader.replace('#include <dithering_fragment>',`#include <dithering_fragment>\n    ${m.blending===T.AdditiveBlending?'':'gl_FragColor.a=1.;'}gl_FragColor*=1.-uIndoCamo*.97;`);};
  m.customProgramCacheKey=()=>key()+'|indominus';m.needsUpdate=true;}
 let reveal=0;
 return{camo,
  /** A hit while she is hidden drops the camouflage for half a second. */
  hit(){reveal=.5;},
  update(dt,hidden,t){reveal=Math.max(0,reveal-dt);const want=hidden&&reveal<=0?1:0;camo.value=T.MathUtils.damp(camo.value,want,want?3.2:9,dt);time.value=t%62.8318;}};
}
