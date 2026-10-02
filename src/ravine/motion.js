import {hash,smooth} from './route.js';
// A damped, fixed-step body fall. The render rig supplies actual skinned ground
// contacts; root rotation is applied around the pelvis, never around the feet.
export class RaptorFall{
 constructor({side,seed,explosive=false,head=false,airV=0}){Object.assign(this,{age:0,side:Math.abs(side)>0?Math.sign(side):1,roll:0,rollV:(explosive?2.4:1.2)*side,pitch:0,pitchV:head?-.8:-.25,y:0,vy:airV+(explosive?1.9:0),impact:false,explosive,head,seed});}
 step(dt){let remaining=dt;while(remaining>1e-8){const h=Math.min(remaining,1/120);remaining-=h;this.age+=h;const rollTo=this.side*(1.35+hash(this.seed)*.15),pitchTo=-(this.head?.5:.26)*(1-smooth(this.age,.6,1.5)*.55);this.rollV+=(28*(rollTo-this.roll)-9*this.rollV)*h;this.pitchV+=(26*(pitchTo-this.pitch)-9*this.pitchV)*h;this.roll+=this.rollV*h;this.pitch+=this.pitchV*h;this.vy-=11.8*h;this.y+=this.vy*h;}}
 contact(correction,bodyContact){this.y+=correction;const impact=!this.impact&&this.age>.2&&bodyContact;this.vy=0;if(impact)this.impact=true;return impact;}
}
const noise=x=>{const i=Math.floor(x),u=smooth(x-i,0,1);return (hash(i+89)*(1-u)+hash(i+90)*u)*2-1;};
// Small, distance-based irregularities. Both axles cross the same terrain with
// wheelbase delay; several unrelated wavelengths avoid a metronomic bounce.
export function ravineRide(distance,speed=8.5){
 const sample=(d,side)=>noise(d*.38+side*4)*.0035+noise(d*1.07+side*11)*.0012+noise(d*.061+side)*.005;
 const fl=sample(distance+1.16,-1),fr=sample(distance+1.16,1),rl=sample(distance-1.16,-1),rr=sample(distance-1.16,1),weight=smooth(speed,0,5);
 return {heave:(fl+fr+rl+rr)*.25*weight,pitch:(fl+fr-rl-rr)/4.64*weight,roll:(fr+rr-fl-rl)/4*weight};
}
