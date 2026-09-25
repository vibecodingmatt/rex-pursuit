// Shared GLSL for the swallow interior (swallow.js, stomach.js).
// Wet tissue lit by a lamp at the eye (the last light from the mouth), plus
// daylight transmitted through the wall. Shared with stomach.js.
export const TISSUE=`
 vec3 bumpNormal(vec3 pos,vec3 n,float h,float k){
  vec3 sx=dFdx(pos),sy=dFdy(pos),r1=cross(sy,n),r2=cross(n,sx);float det=dot(sx,r1);
  vec2 d=vec2(dFdx(h),dFdy(h))*k;return normalize(abs(det)*n-sign(det)*(d.x*r1+d.y*r2));}
 vec3 wetLight(vec3 albedo,vec3 n,vec3 pos,vec3 eye,float gloss,float mucus,vec3 glow){
  vec3 v=normalize(eye-pos),l=normalize(eye+vec3(-.25,.35,-.3)-pos);if(dot(n,v)<0.)n=-n;
  float d=length(eye-pos),fall=1./(1.+d*d*.16),diff=max(0.,dot(n,l)),h=max(0.,dot(n,normalize(l+v)));
  float spec=pow(h,mix(40.,160.,gloss))*mix(.5,2.2,gloss)+pow(h,12.)*.08;
  float fres=pow(1.-max(0.,dot(n,v)),4.);
  vec3 c=albedo*(.05+diff*1.25)*fall+vec3(1.,.9,.82)*spec*fall*(.55+.9*mucus)+vec3(.9,.55,.45)*fres*.05*fall;
  return c+glow;}`;

