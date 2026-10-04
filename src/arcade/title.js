import * as T from 'three';
import {STAGES} from './rules.js';
import {PLAZA,routeX,groundAt} from './world.js';

// A15: the 3D title. Behind the menu the hero Rex stands on the Visitor Center's forecourt under the moon,
// low and close on the right of the frame, and roars every few seconds while the camera drifts. It is the
// finale's own set and boss rig, driven by a stand-in game: one Rex entity held in her entrance (stand and
// roar) by looping its age, so boss-rex.js never charges. The renderer falls back to the 2D key art until
// the world and the hero Rex have loaded.
const STAGE=STAGES.find(s=>s.id==='visitor'),AT=PLAZA+6,ROAR=7.5;

export class Title {
 constructor(){this.game=null;this.since=0;this.look=new T.Vector3();this.eye=new T.Vector3();}
 /** The stand-in game for this frame (time in seconds since the menu opened). */
 frame(time,aspect){
  const g=this.game??={stage:STAGE,entities:[{id:-94,boss:true,kind:'rex',lane:.5,age:0,attack:0,dead:false,weak:false,hp:1e9,size:.9}],travel:AT,speed:0,time:0,focusTime:0,phase:'boss',phaseTime:0,stageTime:STAGE.duration,hp:100};
  const dt=Math.max(0,Math.min(.1,time-g.time));g.time=time;g.phaseTime+=dt;
  // Wider screens put her further right; a portrait phone keeps her centred above the menu.
  g.entities[0].lane=aspect<1?.5:.5+Math.min(.28,(aspect-1)*.32);
  // Her age loops through the entrance only: stand, roar, hold; never past 1.25 s, where she would charge.
  const e=g.entities[0];this.clock=(this.clock||0)+dt;if(this.clock>ROAR){this.clock=0;this.roared=true;}e.age=Math.min(1.25,this.clock);
  return g;
 }
 /** A warm key from the front left and a cold moon rim behind her, borrowed from the stage's practical lamps
  * (the light count must not change). The key breathes a little, like a lamp in the wind. */
 light(lamps,head,time){
  lamps[0].position.set(head.x+5,head.y+1.2,head.z-7);lamps[0].color.set(0xffc27a);lamps[0].intensity=150*(1+.08*Math.sin(time*2.3));lamps[0].distance=30;
  lamps[1].position.set(head.x-4,head.y+5,head.z+7);lamps[1].color.set(0x9cc0ea);lamps[1].intensity=260;lamps[1].distance=34;
  for(const l of lamps.slice(2))l.intensity=0;
 }
 /** After a roar loop restarts, her slot must roar again; returns true once per loop. */
 again(){const r=this.roared;this.roared=false;return r;}
 /** A low, slow camera: close in front of her, drifting sideways, looking up past her toward the moonlit building. */
 camera(cam,head,time,aspect){
  const x0=routeX(AT,STAGE.id),side=Math.sin(time*.07)*1.6,portrait=aspect<1;
  const z=head.z-(portrait?11:12)+Math.sin(time*.05)*1.2;
  this.eye.set(x0+(portrait?-1:1.6)+side,groundAt(x0,z,STAGE.id)+.95+Math.sin(time*.11)*.15,z);
  // Aim left of her so she stands in the right third (centre on a portrait phone), level with her chest.
  // On a portrait phone the menu fills the lower screen: aim low so her head rises into the band above it.
  this.look.copy(head).add(new T.Vector3(portrait?0:4.2,portrait?-4.5:-1.4,0));
  cam.position.copy(this.eye);cam.lookAt(this.look);cam.updateMatrixWorld();
 }
}
