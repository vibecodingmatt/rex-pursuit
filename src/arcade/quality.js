import {TIERS,ORDER,detectTier,storedQuality,storeQuality,createGovernor} from '../chase/graphics.js';

// The arcade's Quality setting on Pursuit's tiers (graphics.js) and frame governor. High
// is the look every earlier drop was tuned and timed at; Low and Medium shed post passes,
// resolution and shadow detail, Ultra spends more. Shared modules take the matching
// TIERS entry. Auto starts from the detected GPU tier and steps down if frames stay slow.
const ARCADE={
 low:{pixelRatio:1,scale:[.62,.86],shadow:1024,post:{msaa:2,bloomLevels:3,volumetric:false,ao:false,motionBlur:0}},
 medium:{pixelRatio:1.25,scale:[.7,1],shadow:1536,post:{msaa:2,bloomLevels:4,volumetric:{steps:6,resolution:.25},ao:false,motionBlur:.65}},
 high:{pixelRatio:1.5,scale:[.78,1],shadow:2048,post:{msaa:2,bloomLevels:4,volumetric:{steps:10,resolution:.4},ao:{samples:4,steps:4},motionBlur:.65}},
 ultra:{pixelRatio:2,scale:[.85,1],shadow:4096,post:{msaa:4,bloomLevels:6,volumetric:{steps:18,resolution:.5},ao:{samples:8,steps:8},motionBlur:.65}},
};
export class CircuitQuality{
 constructor(renderer,{fixed=null}={}){
  this.renderer=renderer;this.governor=createGovernor();this.detected=detectTier(renderer.world.renderer);
  this.auto=this.detected.tier;this.choice=fixed&&(fixed==='auto'||TIERS[fixed])?fixed:storedQuality();this.fixed=!!fixed;
 }
 get tier(){return this.choice==='auto'?this.auto:this.choice;}
 get label(){return this.choice==='auto'?`AUTO · ${TIERS[this.auto].label.toUpperCase()}`:TIERS[this.choice].label.toUpperCase();}
 apply(){
  const name=this.tier,a=ARCADE[name],t=TIERS[name],r=this.renderer,w=r.world,wide=innerWidth>700;r.tierName=name;w.coverDistance={low:80,medium:120,high:170}[name]??Infinity;
  w.renderer.setPixelRatio(Math.min(devicePixelRatio,a.pixelRatio));this.governor.setRange(a.scale);this.governor.reset();
  // Ambient occlusion only pays for itself on wide screens.
  w.post.configure({scale:this.governor.scale,...a.post,ao:wide?a.post.ao:false});
  const size=wide?a.shadow:Math.min(a.shadow,1536),shadow=w.sun.shadow;if(shadow.mapSize.x!==size){shadow.mapSize.setScalar(size);shadow.map?.dispose();shadow.map=null;}
  // The gun's many small parts all sit inside the shadow camera; on the lower tiers they stop casting.
  for(const wpn of [r.weapon,r.weapon2])wpn?.body.traverse(o=>{if(o.isMesh)o.castShadow=name==='high'||name==='ultra';});
  r.actors?.setQuality(t);r.bossMosa?.setQuality(t);r.effects?.setQuality?.(t);r.impacts?.setQuality(t);w.air?.setQuality?.(t);w.spray?.setQuality(name);w.river?.setQuality(name);
 }
 cycle(){const list=['auto',...ORDER];this.choice=list[(list.indexOf(this.choice)+1)%list.length];if(!this.fixed)storeQuality(this.choice);this.auto=this.detected.tier;this.apply();}
 /** Feed real frame times. Returns true when Auto stepped down a tier (the label changes). */
 sample(ms,active){
  if(this.governor.sample(ms,active))this.renderer.world.post.configure({scale:this.governor.scale});
  if(this.choice!=='auto'||!this.governor.strained||ORDER.indexOf(this.auto)<=0)return false;
  this.auto=ORDER[ORDER.indexOf(this.auto)-1];this.apply();return true;
 }
 diagnostics(){return{choice:this.choice,tier:this.tier,gpu:this.detected.gpu,scale:this.governor.scale,frameMs:this.governor.frameMs};}
}
