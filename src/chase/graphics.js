// Device-aware rendering budgets. The auto tier is chosen once from the GPU and
// device class, then a dynamic-resolution governor holds frame time. Content
// with a construction cost (grass, flora) is built at the tier's capacity and
// thinned at runtime through instance counts rather than being rebuilt.
const KEY='rex-pursuit-quality';
export const TIERS={
 low:{label:'Low',pixelRatio:1.25,scale:[.62,.86],msaa:2,bloomLevels:4,volumetric:null,shadow:1024,grass:.34,flora:.62,particles:.5,beams:true,detail:false},
 medium:{label:'Medium',pixelRatio:1.5,scale:[.7,1],msaa:4,bloomLevels:5,volumetric:{steps:10,resolution:.25},shadow:2048,grass:.62,flora:.82,particles:.75,beams:false,detail:true},
 high:{label:'High',pixelRatio:1.75,scale:[.78,1],msaa:4,bloomLevels:6,volumetric:{steps:18,resolution:.5},shadow:2048,grass:1,flora:1,particles:1,beams:false,detail:true},
 ultra:{label:'Ultra',pixelRatio:2.25,scale:[.85,1],msaa:4,bloomLevels:6,volumetric:{steps:28,resolution:.5},shadow:4096,grass:1.35,flora:1,particles:1,beams:false,detail:true}
};
export const ORDER=['low','medium','high','ultra'];

function gpuName(renderer){
 try{const gl=renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');return String(ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER)||'');}catch{return '';}
}
export function detectTier(renderer){
 const gpu=gpuName(renderer).toLowerCase(),coarse=matchMedia('(pointer:coarse)').matches,memory=navigator.deviceMemory||8,cores=navigator.hardwareConcurrency||4;
 const mobileGpu=/adreno|mali|powervr|apple gpu|immortalis|xclipse|videocore/.test(gpu);
 if(/swiftshader|llvmpipe|software|basic render/.test(gpu))return {tier:'low',gpu};
 if(coarse||mobileGpu){
  const weak=memory<=3||cores<=4||/adreno \(tm\) [3-5]\d\d|mali-[gt][0-7]\d(?!\d)|powervr/.test(gpu);
  return {tier:weak?'low':'medium',gpu};
 }
 if(/nvidia|geforce|rtx|gtx|radeon rx|radeon pro|apple m\d|apple m\d (pro|max|ultra)|arc a\d/.test(gpu))return {tier:'high',gpu};
 return {tier:memory<=4?'low':'medium',gpu};
}
export function storedQuality(){try{const v=localStorage.getItem(KEY);return v==='auto'||TIERS[v]?v:'auto';}catch{return 'auto';}}
export function storeQuality(v){try{localStorage.setItem(KEY,v);}catch{}}

/** Frame-time governor: EMA of frame time nudges the render scale in small steps. */
export function createGovernor(){
 let ema=16.7,cool=0,scale=1,range=[.7,1],strain=0;
 return{
  get scale(){return scale;},get frameMs(){return ema;},get strained(){return strain>4;},
  setRange(r){range=r;scale=Math.min(Math.max(scale,r[0]),r[1]);},
  reset(){ema=16.7;cool=1;strain=0;scale=range[1];},
  sample(ms,active){
   if(!active||ms>250)return false;ema+=(ms-ema)*.06;cool-=ms/1000;if(cool>0)return false;
   let next=scale;
   // Aim for ~60 Hz with hysteresis; displays above 60 Hz simply bank headroom.
   if(ema>19.5)next=Math.max(range[0],scale-.06);else if(ema<14.5)next=Math.min(range[1],scale+.03);
   strain=ema>21&&scale<=range[0]+1e-3?strain+ms/1000:Math.max(0,strain-ms/2000);
   if(Math.abs(next-scale)<1e-3)return false;scale=next;cool=.6;return true;
  }
 };
}
