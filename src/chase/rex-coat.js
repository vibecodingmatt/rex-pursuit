import {WET} from './weather-state.js';
// Mud and water the Rex gathers over the chase (drawn by rex-skin.js). Physics first:
// - Every footfall on soft ground flings clods and slurry up the legs, into the belly
//   and under the tail. The more she runs, the higher and denser the splatter; wet
//   ground throws far more of it than dry ground.
// - Wading the river rinses her legs and belly clean up to the line the spray reached
//   and soaks her up to it; new splatter then lands on clean, wet hide.
// - On a dry day the water drains off and evaporates, top first, and the mud dries to a
//   pale crust. In the storm she stays wet, and the rain keeps soaking in as she runs.
const START=.35,MAX=1.3;
export function createRexCoat(uniforms){
 const coat=uniforms.uRexCoat.value,soak=uniforms.uRexSoak.value;
 return{
  /** Back to how she comes out of the jungle: some mud up the shins, as wet as the weather. */
  reset(){coat.set(START,0,0,0);soak.set(0,0,soak.z,WET.value*.8);},
  get level(){return coat.x;},get soak(){return soak.x;},
  /** A footfall on the road (not in the river). */
  step(speed=10){
   const ground=.4+.6*WET.value,pace=Math.min(1.3,Math.max(.5,speed/10));
   coat.x=Math.min(MAX,coat.x+.0062*ground*pace*(1-coat.x/(MAX+.15)));
   // Slurry off wet ground lands wet; dry ground only throws dust.
   coat.w*=1-.08*WET.value;
  },
  /** Called every frame while any foot is in the river: rinse below the spray line and soak. */
  wade(depth){
   coat.y=coat.x;coat.z=Math.max(coat.z,1.9+depth*1.2);coat.w=0;
   soak.x=1;soak.y=Math.max(soak.y,2.9+depth*.8);
  },
  update(dt,{active=true}={}){
   // The runoff pattern slides down the hide; the phase wraps so it stays small.
   soak.z=(soak.z+dt*(.22+.5*Math.max(soak.x,soak.w)))%1;
   if(!active){soak.w+=(WET.value*.8-soak.w)*Math.min(1,dt*2);return;}
   // Rain soaks in over the first half-minute of running; dry air takes the river water.
   soak.w+=(WET.value-soak.w)*(1-Math.exp(-dt/(WET.value>soak.w?28:6)));
   soak.x*=Math.exp(-dt/(WET.value>.5?90:30));if(soak.x<.01)soak.x=0;
   // Mud dries to a crust in the open (slowly), never while soaked.
   const wet=Math.max(WET.value,soak.x);
   coat.w+=((1-wet)*.6-coat.w)*(1-Math.exp(-dt/25));
  }
 };
}
