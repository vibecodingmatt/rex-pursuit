// Per-stage ambience on Pursuit's recorded audio (ChaseAudio). Every bed is a real
// recording shaped per stage by playback rate and filters: the jungle bed, river water,
// a cave rumble from slowed, low-passed wind, gentle lagoon water, rain on the
// conservatory glass with thunder after each lightning flash, and a darker night forest.
// The room reverb that one-shots (gunfire, impacts, calls) send to tightens in the lava
// tube and the conservatory and opens up in the visitor center's rotunda.

const BEDS={
 gates:{jungle:1},river:{jungle:.45,river:.9},fault:{rumble:1},hybrid:{jungle:.6},
 lagoon:{lap:.8,jungle:.15},manor:{rain:.75},visitor:{night:.7},
};
/** Room impulses: length (s), decay rate, damping cutoff (Hz) and early-reflection spacing (s). */
const ROOMS={fault:{seconds:1.4,decay:5,cutoff:2400,early:.012},manor:{seconds:1.6,decay:4.2,cutoff:6800,early:.009},visitor:{seconds:2.9,decay:2.1,cutoff:4200,early:.024}};
function roomImpulse(c,{seconds,decay,cutoff,early}){
 const sr=c.sampleRate,n=Math.floor(seconds*sr),b=c.createBuffer(2,n,sr),a=Math.exp(-2*Math.PI*cutoff/sr);
 for(let ch=0;ch<2;ch++){const d=b.getChannelData(ch);let lp=0;
  for(let i=0;i<n;i++){const t=i/sr;lp+=(1-a)*((Math.random()*2-1)-lp);d[i]=lp*Math.exp(-t*decay)*Math.min(1,t/.008)*1.4;}
  // Hard walls: a train of early reflections that the tail grows out of.
  for(let k=1;k<14;k++){const t=k*early*(1+(Math.random()-.5)*.3)+ch*.002;if(t<seconds)d[Math.floor(t*sr)]+=(Math.random()<.5?-1:1)*.6*Math.exp(-t*decay*.8);}
 }
 return b;
}

export class StageAmbience{
 constructor(field,world){this.field=field;this.world=world;this.stage=null;this.beds={};this.buffers={};this.lastFlash=null;}
 async load(name,path){
  if(name in this.buffers)return this.buffers[name];this.buffers[name]=null;
  try{const r=await fetch(path);if(!r.ok)throw Error(r.status);this.buffers[name]=await this.field.context.decodeAudioData(await r.arrayBuffer());}catch(e){console.warn('Ambience unavailable',path,e.message);}
  return this.buffers[name];
 }
 /** Build each bed once: source -> filters -> gain -> the world bus (which ducks under the Rex). */
 setup(){
  const f=this.field,c=f.context;this.ready=true;this.dryReverb=f.reverb.buffer;this.rooms={};
  const bed=(name,gainScale=1)=>{const g=c.createGain();g.gain.value=0;g.connect(f.world);this.beds[name]={gain:g,scale:gainScale};return g;};
  // The jungle bed is ChaseAudio's own loop, rerouted through a stage gain.
  f.ambienceGain.disconnect();f.ambienceGain.connect(bed('jungle',1));
  const loop=async(name,path,{rate=1,type,frequency,q=.7,scale=1})=>{const out=bed(name,scale),buffer=await this.load(path,path);if(!buffer)return;
   const s=c.createBufferSource();s.buffer=buffer;s.loop=true;s.playbackRate.value=rate;let node=s;
   if(type){const flt=c.createBiquadFilter();flt.type=type;flt.frequency.value=frequency;flt.Q.value=q;node.connect(flt);node=flt;}node.connect(out);s.start(0,Math.random()*buffer.duration);};
  loop('river','./audio/ford/river-loop.wav',{scale:.55});
  loop('rumble','./audio/sfx/wind-loop.mp3',{rate:.38,type:'lowpass',frequency:240,scale:2.4});
  loop('lap','./audio/ford/river-loop.wav',{rate:.72,type:'lowpass',frequency:750,scale:.8});
  loop('night','./audio/sfx/jungle-loop.mp3',{rate:.66,type:'lowpass',frequency:1700,scale:.55});
  if(this.stage)this.setStage(this.stage);
 }
 setStage(id){
  this.stage=id;if(!this.ready)return;const f=this.field,t=f.context.currentTime,mix=BEDS[id]||{};
  for(const [name,b]of Object.entries(this.beds))b.target=(mix[name]||0)*b.scale;
  this.applyGains(t,1.2);
  const room=ROOMS[id];f.reverb.buffer=room?(this.rooms[id]??=roomImpulse(f.context,room)):this.dryReverb;
  // Rain on the glass uses Pursuit's wide rain wash; it stops off the storm stage.
  f.weather(mix.rain||0);this.lastFlash=null;
 }
 applyGains(t,tc){for(const b of Object.values(this.beds))b.gain.gain.setTargetAtTime(this.playing?b.target||0:0,t,tc);}
 update(playing){
  const f=this.field;if(!f.context)return;if(!this.ready)this.setup();
  if(playing!==this.playing){this.playing=playing;this.applyGains(f.context.currentTime,.5);if(this.stage==='manor')f.weather(playing?BEDS.manor.rain:0);}
  // Thunder follows each lightning flash, near or far.
  const flash=this.world?.light?.flashAt;if(playing&&this.stage==='manor'&&flash!==undefined&&flash!==this.lastFlash){if(this.lastFlash!==null){const near=Math.random();f.thunder(.3+(1-near)*2.4,near);}this.lastFlash=flash;}
 }
}
