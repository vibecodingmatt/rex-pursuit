import {AUDIO_KEY,DEFAULT_ROLES,readCatalog,resolveAudioSettings,clipEnvelope} from './audio-catalog.js';
// Equal-power crossfade of the tail into the head, so a recorded bed loops without a seam.
function loopable(c,b,seconds){const n=Math.floor(seconds*b.sampleRate);if(b.length<n*3)return b;const out=c.createBuffer(b.numberOfChannels,b.length-n,b.sampleRate);
 for(let ch=0;ch<b.numberOfChannels;ch++){const src=b.getChannelData(ch),dst=out.getChannelData(ch);dst.set(src.subarray(0,b.length-n));for(let i=0;i<n;i++){const t=i/n*Math.PI/2;dst[i]=src[i]*Math.sin(t)+src[b.length-n+i]*Math.cos(t);}}return out;}
// Real recordings for every world sound (CC0, credited in README). Fetching starts
// when the audio object is created, so the files arrive during the loading screen.
const SFX=['gun-burst','gun-shots','impact-flesh','impact-dirt','branch-snap','explosion','reload','engine-loop','jungle-loop','wind-loop','birds-takeoff'];
function normalize(b,peak=.9){let m=0;for(let ch=0;ch<b.numberOfChannels;ch++){const d=b.getChannelData(ch);for(let i=0;i<d.length;i++)m=Math.max(m,Math.abs(d[i]));}
 if(m>0){const k=peak/m;for(let ch=0;ch<b.numberOfChannels;ch++){const d=b.getChannelData(ch);for(let i=0;i<d.length;i++)d[i]*=k;}}return b;}
/** Shot onsets in a gun recording: sharp rises over the recent 4 ms envelope. */
function onsets(b){
 const d=b.getChannelData(0),sr=b.sampleRate,w=Math.max(1,Math.floor(sr*.004)),env=[];
 for(let i=0;i<d.length;i+=w){let m=0;for(let j=i;j<Math.min(i+w,d.length);j++)m=Math.max(m,Math.abs(d[j]));env.push(m);}
 let peak=0;for(const v of env)peak=Math.max(peak,v);const out=[];let last=-1;
 for(let k=4;k<env.length;k++){const base=(env[k-4]+env[k-3]+env[k-2])/3,t=k*w/sr;if(env[k]>peak*.3&&env[k]>base*2.2&&t-last>.065){out.push(Math.max(0,t-.006));last=t;}}
 return out;
}
// A generated impulse response for the rainforest (a room model, not a synthesized sound):
// sparse early reflections off trunks, smeared slaps back from the treeline, then a dense
// tail whose highs the foliage soaks up first. Independent noise per ear keeps it wide.
function forestImpulse(c,seconds=2.4){
 const sr=c.sampleRate,n=Math.floor(seconds*sr),b=c.createBuffer(2,n,sr);
 for(let ch=0;ch<2;ch++){const d=b.getChannelData(ch);let lp=0;
  for(let i=0;i<n;i++){const t=i/sr,a=Math.exp(-2*Math.PI*(380+8200*Math.exp(-t*2.6))/sr);lp+=(1-a)*((Math.random()*2-1)-lp);d[i]=lp*Math.exp(-t*3.1)*Math.min(1,Math.max(0,(t-.014)/.06))*1.6;}
  for(let k=0;k<16;k++){const t=.006+Math.random()**1.4*.11;d[Math.floor(t*sr)]+=(Math.random()<.5?-1:1)*.55*Math.exp(-t*12);}
  for(const [t0,amp]of [[.17+ch*.012,.3],[.34-ch*.018,.17],[.52,.08]])for(let k=0;k<36;k++){const t=t0+Math.random()*.03;d[Math.floor(t*sr)]+=(Math.random()<.5?-1:1)*amp*.35;}
 }
 return b;
}
/** Air and leaves take the top end off distant sources. */
const muffle=d=>Math.min(20000,24000*Math.pow(6/Math.max(6,d),1.15));
function place(node,at,t,smooth=0){
 if(node.positionX){for(const [param,v]of [[node.positionX,at.x],[node.positionY,at.y],[node.positionZ,at.z]])smooth?param.setTargetAtTime(v,t,smooth):param.setValueAtTime(v,t);}
 else node.setPosition(at.x,at.y,at.z);
}
export class ChaseAudio {
 constructor(){this.context=null;this.muted=false;this.buffers=new Map();this.envelopes=new Map();this.ready=false;this.active=[];this.roles={...DEFAULT_ROLES};this.voice=null;this.jaw=0;this.labels={};this.ambientWait=12;this.ambientIndex=0;this.stepIndex=0;this.lastPain=-10;this.sfxData=Promise.all(SFX.map(n=>fetch(`./audio/sfx/${n}.mp3`).then(r=>r.ok?r.arrayBuffer():null).catch(()=>null)));}
 async readRoles(){
  try{this.catalog=await readCatalog();}catch(e){console.warn(e.message);this.catalog={roles:DEFAULT_ROLES,clips:[]};}
  let saved={};try{saved=JSON.parse(localStorage.getItem(AUDIO_KEY))||{};}catch{}
  const settings=resolveAudioSettings(this.catalog,saved);this.roles=settings.roles;this.labels=settings.labels;
 }
 async loadClips(){
  const ids=[...new Set([...Object.values(this.roles),3,4,5,6,9,18,27,11,12,14,30,31])];
  await Promise.all(ids.filter(n=>!this.buffers.has(n)).map(async n=>{try{const r=await fetch(`./audio/clip-${String(n).padStart(2,'0')}.wav`);if(!r.ok)throw Error(r.status);const buffer=await this.context.decodeAudioData(await r.arrayBuffer());this.buffers.set(n,buffer);this.envelopes.set(n,clipEnvelope(buffer));}catch(e){console.warn('Audio clip unavailable',n,e.message);}}));
 }
 async init(){
  await this.readRoles();if(this.context){this.reverbReturn.gain.cancelScheduledValues(0);this.reverbReturn.gain.value=1;await this.loadClips();await this.context.resume();return;}
  const c=this.context=new (window.AudioContext||window.webkitAudioContext)();this.master=c.createGain();this.master.gain.value=this.muted?0:.75;const compressor=c.createDynamicsCompressor();compressor.threshold.value=-18;compressor.ratio.value=5;this.master.connect(compressor);compressor.connect(c.destination);
  // Everything except the Rex runs through the world bus, which ducks under her calls.
  this.world=c.createGain();this.world.connect(this.master);
  // Forest reverb: one-shots send to it by their own amount; the loops stay dry.
  this.reverb=c.createConvolver();this.reverb.buffer=forestImpulse(c);this.reverbReturn=c.createGain();this.reverb.connect(this.reverbReturn);this.reverbReturn.connect(this.master);
  // Her voice is placed in 3D at her head (HRTF), muffled and a little quieter with distance.
  // The reverb send is taken before the distance loss, so far calls sound further away.
  this.ear={x:0,y:1.6,z:0};this.rexVoice=c.createGain();this.rexTone=c.createBiquadFilter();this.rexTone.type='lowpass';this.rexTone.frequency.value=20000;this.rexPanner=this.panner(null,{rolloff:.35,ref:14});
  this.rexVoice.connect(this.rexTone);this.rexTone.connect(this.rexPanner);this.rexPanner.connect(this.master);this.rexSend=c.createGain();this.rexSend.gain.value=.28;this.rexVoice.connect(this.rexSend);this.rexSend.connect(this.reverb);
  const noise=c.createBuffer(1,c.sampleRate*2,c.sampleRate),data=noise.getChannelData(0);let last=0;for(let i=0;i<data.length;i++){last=(last+Math.random()*.04-.02)*.97;data[i]=last;}this.noise=noise;
  // Gain stages for the recorded beds; loadSfx() attaches the loops.
  this.engineGain=c.createGain();this.engineGain.gain.value=0;this.engineGain.connect(this.world);this.windGain=c.createGain();this.windGain.gain.value=0;this.windGain.connect(this.world);this.ambienceGain=c.createGain();this.ambienceGain.gain.value=0;this.ambienceGain.connect(this.world);
  await this.loadClips();this.ready=true;await c.resume();this.loadSfx();
 }
 play(n,volume=.8,rate=1,options={}){
  if(!this.context||!this.buffers.has(n))return null;
  const c=this.context,source=c.createBufferSource(),gain=c.createGain();source.buffer=this.buffers.get(n);source.playbackRate.value=rate;gain.gain.value=volume;source.connect(gain);
  const vocal=options.vocal??(/^TRex/i.test(this.labels[n]||'')?'growl':null);let pan=null,tone=null,wet=null;
  if(vocal)gain.connect(this.rexVoice);
  else if(options.at){tone=c.createBiquadFilter();tone.type='lowpass';tone.frequency.value=muffle(this.distance(options.at));pan=this.panner(options.at);gain.connect(tone);tone.connect(pan);pan.connect(this.master);if(options.wet){wet=c.createGain();wet.gain.value=options.wet;gain.connect(wet);wet.connect(this.reverb);}}
  else{pan=c.createStereoPanner();pan.pan.value=options.pan||0;gain.connect(pan);pan.connect(this.master);}
  if(vocal){this.stopVoice();this.voice={source,gain,id:n,kind:vocal,start:c.currentTime,rate,envelope:this.envelopes.get(n),duration:source.buffer.duration/rate};}
  source.start();this.active.push(source);
  source.onended=()=>{this.active=this.active.filter(x=>x!==source);if(this.voice?.source===source)this.voice=null;source.disconnect();gain.disconnect();pan?.disconnect();tone?.disconnect();wet?.disconnect();};return source;
 }
 panner(at,{rolloff=0,ref=10}={}){const p=this.context.createPanner();p.panningModel='HRTF';p.distanceModel='inverse';p.refDistance=ref;p.rolloffFactor=rolloff;if(at)place(p,at,this.context.currentTime);return p;}
 distance(at){return Math.hypot(at.x-this.ear.x,at.y-this.ear.y,at.z-this.ear.z);}
 /** The listener rides the camera; her voice follows her head. */
 listen(camera,head){
  if(!this.context)return;const l=this.context.listener,t=this.context.currentTime,e=camera.matrixWorld.elements;
  this.ear={x:e[12],y:e[13],z:e[14]};const f=[-e[8],-e[9],-e[10]],u=[e[4],e[5],e[6]];
  if(l.positionX){place(l,this.ear,t,.02);[l.forwardX,l.forwardY,l.forwardZ,l.upX,l.upY,l.upZ].forEach((param,i)=>param.setTargetAtTime(i<3?f[i]:u[i-3],t,.02));}
  else{l.setPosition(this.ear.x,this.ear.y,this.ear.z);l.setOrientation(...f,...u);}
  if(head){place(this.rexPanner,head,t,.03);this.rexTone.frequency.setTargetAtTime(muffle(this.distance(head)),t,.08);}
 }
 // Storm: recorded rain bed and thunder, loaded the first time the storm is heard.
 async loadStorm(){
  if(this.storm||!this.context)return;this.storm={};
  await Promise.all([['rain','rain-loop'],['near','thunder-near'],['far','thunder-far']].map(async([k,f])=>{try{const r=await fetch(`./audio/storm/${f}.mp3`);if(!r.ok)throw Error(r.status);this.storm[k]=await this.context.decodeAudioData(await r.arrayBuffer());}catch(e){console.warn('Storm audio unavailable',f,e.message);}}));
  if(this.storm.rain)this.storm.rain=loopable(this.context,this.storm.rain,1.2);
 }
 weather(level){
  if(!this.context)return;if(level>.01&&!this.storm)this.loadStorm();
  const c=this.context;
  if(!this.rainBed&&this.storm?.rain){
   // Two copies of the bed, offset, slightly detuned and panned apart: a wide wash that hides the loop length.
   const gain=c.createGain();gain.gain.value=0;gain.connect(this.world);
   this.rainBed={gain,sources:[-.6,.6].map((p,i)=>{const s=c.createBufferSource(),pan=c.createStereoPanner();s.buffer=this.storm.rain;s.loop=true;s.playbackRate.value=i?1.03:.97;pan.pan.value=p;s.connect(pan);pan.connect(gain);s.start(0,i*s.buffer.duration*.5);return s;})};
  }
  if(this.rainBed)this.rainBed.gain.gain.setTargetAtTime(level*1.5,c.currentTime,.35);
 }
 /** Thunder arrives after the flash by distance / speed of sound; air absorbs the highs of far strikes. */
 thunder(delay,near){
  if(!this.context)return;if(!this.storm){this.loadStorm();return;}
  const buffer=near>.72?this.storm.near:this.storm.far;if(!buffer)return;
  const c=this.context,s=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain();
  s.buffer=buffer;s.playbackRate.value=.92+Math.random()*.14;f.type='lowpass';f.frequency.value=700+near*near*9000;g.gain.value=.25+near*.55;
  const w=c.createGain();w.gain.value=.3;
  s.connect(f);f.connect(g);g.connect(this.world);g.connect(w);w.connect(this.reverb);s.start(c.currentTime+Math.min(delay,6));s.onended=()=>{s.disconnect();f.disconnect();g.disconnect();w.disconnect();};
 }
 // River ford: CC0 recordings (credited in README), fetched the first time a ford is laid out.
 async loadFord(){
  if(this.ford||!this.context)return;this.ford={};
  const files={river:'river-loop.wav',wade:'wade-loop.wav',pass:'water-pass.wav',slaps:'spray-slaps.wav',big:'splash-big.mp3',small:'splash-small.mp3'};
  await Promise.all(Object.entries(files).map(async([k,f])=>{try{const r=await fetch(`./audio/ford/${f}`);if(!r.ok)throw Error(r.status);this.ford[k]=normalize(await this.context.decodeAudioData(await r.arrayBuffer()));}catch(e){console.warn('Ford audio unavailable',f,e.message);}}));
  if(this.ford.slaps)this.ford.slapAt=onsets(this.ford.slaps);
 }
 /** The river's bed, placed at the nearest point of the channel (`level` 0..1 by distance),
  *  and the churn of the Jeep's tyres while they are in the water (`churn` 0..1). */
 river(level,at,churn=0){
  if(!this.context)return;if(level>.01&&!this.ford)this.loadFord();const c=this.context,t=c.currentTime;
  if(!this.riverBed&&this.ford?.river){const g=c.createGain(),p=this.panner(null,{rolloff:.5,ref:9}),s=c.createBufferSource();g.gain.value=0;s.buffer=loopable(c,this.ford.river,1.5);s.loop=true;s.connect(g);g.connect(p);p.connect(this.world);s.start();this.riverBed={g,p};}
  if(this.riverBed){this.riverBed.g.gain.setTargetAtTime(level*.8,t,.35);if(at)place(this.riverBed.p,at,t,.05);}
  if(!this.wadeBed&&this.ford?.wade){const g=c.createGain(),s=c.createBufferSource();g.gain.value=0;s.buffer=loopable(c,this.ford.wade,.8);s.loop=true;s.playbackRate.value=1.12;s.connect(g);g.connect(this.world);s.start();this.wadeBed={g};}
  if(this.wadeBed)this.wadeBed.g.gain.setTargetAtTime(churn*1.05,t,churn>.5?.04:.3);
 }
 /** Splashes: a Rex footfall in the river, the Jeep hitting and leaving the water, a round or a grenade into it. */
 splash(kind,at=null,strength=1){
  if(!this.context)return;if(!this.ford){this.loadFord();return;}const f=this.ford,r=Math.random;
  if(kind==='step'){
   this.sample(f.big,{volume:.5*strength,rate:.6+r()*.14,at,wet:.3,lowpass:6000});
   const on=f.slapAt||[];if(on.length&&f.slaps){const k=Math.floor(r()*on.length);this.sample(f.slaps,{volume:.5*strength,rate:.78+r()*.1,offset:on[k],duration:1.1,fade:.4,at,wet:.25});}
  }else if(kind==='enter'){this.sample(f.pass,{volume:1,rate:.95+r()*.06,wet:.2});this.sample(f.big,{volume:.85,rate:.78,wet:.25,delay:.05});}
  else if(kind==='exit')this.sample(f.pass,{volume:.5,rate:1.05,offset:1.2,wet:.15});
  else if(kind==='bullet')this.sample(f.small,{volume:.28*strength,rate:1.35+r()*.35,duration:.55,fade:.25,at,wet:.15});
  else if(kind==='blast')this.sample(f.big,{volume:1,rate:.52,at,wet:.45});
 }
 async loadSfx(){
  if(this.sfxLoading||!this.context)return this.sfxLoading;
  return this.sfxLoading=(async()=>{
   const c=this.context,data=await this.sfxData,s={};
   await Promise.all(SFX.map(async(name,i)=>{if(!data[i])return;try{s[name]=normalize(await c.decodeAudioData(data[i]));}catch(e){console.warn('Sound unavailable',name,e.message);}}));
   this.sfx=s;this.shots=[];
   // Every shot in both gun recordings becomes one round; the burst's last shot keeps its decay for the tail.
   for(const name of ['gun-burst','gun-shots']){const b=s[name];if(!b)continue;const on=onsets(b);for(let i=0;i<on.length-1;i++)this.shots.push({buffer:b,at:on[i],dur:Math.min(on[i+1]-on[i],.15)});if(name==='gun-burst'&&on.length)this.gunTailAt=on[on.length-1];}
   for(const [name,gain,key]of [['engine-loop',this.engineGain,'engine'],['jungle-loop',this.ambienceGain,'ambience'],['wind-loop',this.windGain,'wind']]){
    if(!s[name])continue;const src=c.createBufferSource();src.buffer=loopable(c,s[name],1.5);src.loop=true;src.connect(gain);src.start(0,Math.random()*src.buffer.duration*.5);this[key]=src;
   }
   return s;
  })();
 }
 /** One-shot of a recording (by name or buffer) with delay, rate, low-pass, region, and either
  *  a stereo pan or a world position (`at`, HRTF and distance muffling); `wet` feeds the reverb. */
 sample(name,{volume=1,rate=1,delay=0,lowpass=0,offset=0,duration,pan=0,fade=.03,at=null,wet=0}={}){
  const b=typeof name==='string'?this.sfx?.[name]:name;if(!this.context||!b)return null;
  const c=this.context,t=c.currentTime+delay,s=c.createBufferSource(),g=c.createGain(),p=at?this.panner(at):c.createStereoPanner();let f=null,w=null,head=s;
  s.buffer=b;s.playbackRate.value=rate;if(!at)p.pan.value=pan;else lowpass=Math.min(lowpass||20000,muffle(this.distance(at)));
  if(lowpass){f=c.createBiquadFilter();f.type='lowpass';f.frequency.value=lowpass;s.connect(f);head=f;}
  head.connect(g);g.connect(p);p.connect(this.world||this.master);if(wet){w=c.createGain();w.gain.value=wet;g.connect(w);w.connect(this.reverb);}
  const len=Math.max(.01,duration??(b.duration-offset));g.gain.setValueAtTime(volume,t);
  if(duration!==undefined){g.gain.setValueAtTime(volume,t+Math.max(0,len/rate-fade));g.gain.linearRampToValueAtTime(0,t+len/rate);}
  s.start(t,offset,len);s.onended=()=>{s.disconnect();f?.disconnect();w?.disconnect();g.disconnect();p.disconnect();};return s;
 }
 /** Bullet strikes, heard after the sound travels back from the impact. */
 hit(kind,distance=10,at=null){
  if(!this.context)return;const now=this.context.currentTime;if(now-(this.lastHit||0)<.05)return;this.lastHit=now;
  const delay=Math.min(.2,distance/343),far=Math.max(.35,1-distance/60);
  if(kind==='flesh')this.sample('impact-flesh',{volume:.55*far,rate:.9+Math.random()*.2,delay,at,wet:.18});
  else if(kind==='water')this.splash('bullet',at,far);
  else if(kind==='wood')this.sample('branch-snap',{volume:.35*far,rate:1.35+Math.random()*.2,delay,duration:.25,fade:.08,at,wet:.25});
  else this.sample('impact-dirt',{volume:.3*far,rate:.9+Math.random()*.2,delay,duration:Math.random()<.35?undefined:.35,fade:.1,at,wet:.15});
 }
 birds(){this.sample('birds-takeoff',{volume:.5,rate:.95+Math.random()*.1,pan:(Math.random()-.5)*.8,wet:.2});}
 /** Alarm chirp where a compy pack breaks: a raptor call pitched up to their size. */
 chirp(at){this.play(Math.random()<.5?14:12,.07,2.1+Math.random()*.35,{vocal:false,at,wet:.12});}
 /** A shot animal's death call: raptor clips pitched to its size (the compy's is the chirp pitched higher still). */
 death(kind,at){
  if(!this.context||this.context.currentTime-(this.lastDeath||0)<.07)return;this.lastDeath=this.context.currentTime;const r=Math.random();
  const call={compy:[r<.5?14:12,.1,2.8+r*.5],lizard:[14,.05,3.6+r*.4],gallimimus:[11,.22,1.55+r*.2],dimorphodon:[13,.1,2.1+r*.3],pteranodon:[13,.26,1.2+r*.15],bird:[14,.06,3.3+r*.4]}[kind];
  if(call)this.play(call[0],call[1],call[2],{vocal:false,at,wet:.15});
 }
 /** A Gallimimus herd breaking cover: honking calls. */
 herd(at){this.play(11,.2,1.5+Math.random()*.25,{vocal:false,at,wet:.3});}
 /** Pteranodon passing overhead: a distant screech. */
 screech(at){this.play(13,.16,1.15+Math.random()*.12,{vocal:false,at,wet:.5});}
 /** Dimorphodon flushed off a trunk: wingbeats and a chirp. */
 flush(at){if(!this.context||this.context.currentTime-(this.lastFlush||0)<.5)return;this.lastFlush=this.context.currentTime;this.sample('birds-takeoff',{volume:.18,rate:1.2+Math.random()*.2,at,duration:.9,fade:.3,wet:.2});this.play(12,.05,2.3+Math.random()*.3,{vocal:false,at,wet:.15});}
 /** The passing brachiosaur's trumpet, placed at her head. */
 brachio(at){this.play(Math.random()<.5?30:31,.32,.92+Math.random()*.08,{vocal:false,at,wet:.45});}
 stopVoice(){if(this.voice){try{this.voice.source.stop();}catch{}}this.voice=null;}
 roar(opening=false){return this.play(opening?this.roles.opening:this.roles.charge,opening?1.35:1.12,opening?.95:1.03,{vocal:'roar'});}
 growl(){if(this.voice)return;this.play(this.roles.growl,.72,.96,{vocal:'growl'});}
 bite(){this.play(18,1,1,{vocal:'bite'});}
 pain(force=false){if(!this.context)return;if(!force&&(this.voice||this.context.currentTime-this.lastPain<3.5))return;this.lastPain=this.context.currentTime;this.play(this.roles.pain,.92,.96,{vocal:'pain'});}
 footstep(weight=.3,at=null){this.play([3,4,5,6][this.stepIndex++%4],.17+weight*.42,.91+weight*.14,at?{vocal:false,at,wet:.22}:{vocal:false,pan:this.stepIndex%2?.12:-.12});this.groundImpact(weight*.6,at);}
 vocalPose(dt){
  let energy=0,kind=null,id=null,elapsed=0;const v=this.voice;
  if(v&&this.context){elapsed=(this.context.currentTime-v.start)*v.rate;kind=v.kind;id=v.id;const a=v.envelope.values,k=elapsed*v.envelope.hz,index=Math.floor(k);if(index>=0&&index<a.length)energy=a[index]+((a[index+1]??0)-a[index])*(k-index);}
  const level=energy>.025?(kind==='roar'?.44+.54*energy:kind==='bite'?.10+.55*energy:kind==='pain'?.13+.42*energy:.08+.27*energy):0;
  this.jaw+=(level-this.jaw)*(1-Math.exp(-dt*(level>this.jaw?48:24)));if(!v&&this.jaw<.002)this.jaw=0;
  return{jaw:this.jaw,energy,kind,id,elapsed,active:!!v,roar:kind==='roar'?this.jaw:0};
 }
 gun(){
  if(!this.context)return;if(!this.shots?.length){this.loadSfx();return;}
  let k;do k=Math.floor(Math.random()*this.shots.length);while(this.shots.length>1&&k===this.lastShot);this.lastShot=k;const shot=this.shots[k];
  this.sample(shot.buffer,{volume:.95,rate:.97+Math.random()*.06,offset:shot.at,duration:shot.dur+.03,wet:.42});
  // The recording's own decay rings out only after the last round of a burst.
  try{this.gunTail?.stop();}catch{}
  const b=this.sfx['gun-burst'];if(b&&this.gunTailAt!==undefined){const at=Math.min(b.duration-.2,this.gunTailAt+.1);this.gunTail=this.sample(b,{volume:.8,delay:.12,offset:at,duration:Math.min(1.3,b.duration-at),fade:.5,wet:.3});}
 }
 impact(explosive=false){
  if(!this.context)return;if(explosive){this.sample('explosion',{volume:1,wet:.45});return;}
  // Heavy body contact: the blast recording, slowed and muffled into a crunch.
  this.sample('explosion',{volume:.75,rate:.72,lowpass:650,duration:.9,fade:.35,wet:.2});
 }
 groundImpact(weight=.3,at=null){if(!this.context)return;this.sample('explosion',{volume:.35+weight*.9,rate:.5,lowpass:160,duration:.3+weight*.45,fade:.2,at});}
 /** A body dragged through dirt: overlapping grains of the dirt-strike recording,
  *  slowed and muffled into a grinding scrape, denser and brighter with speed.
  *  `level` 0..1; call every frame while she slides. */
 skid(level,at=null,dt=0){
  if(!this.context)return;this.skidClock=(this.skidClock||0)-dt;if(level<.03||this.skidClock>0)return;
  const b=this.sfx?.['impact-dirt'];if(!b)return;this.skidClock=.045+.07*(1-level)*Math.random();
  const offset=.04+Math.random()*Math.max(0,b.duration-.35);
  this.sample(b,{volume:.08+.3*level,rate:.42+.2*level+Math.random()*.12,offset,duration:.2+.1*Math.random(),fade:.09,lowpass:500+1400*level,at,wet:.12});
 }
 cue(success=false){if(!this.context)return;const c=this.context,t=c.currentTime;for(let i=0;i<(success?3:1);i++){const o=c.createOscillator(),g=c.createGain();o.type='sine';o.frequency.value=success?[440,554,660][i]:520;g.gain.setValueAtTime(.075,t+i*.055);g.gain.exponentialRampToValueAtTime(.001,t+i*.055+.10);o.connect(g);g.connect(this.master);o.start(t+i*.055);o.stop(t+i*.055+.11);o.onended=()=>{o.disconnect();g.disconnect();};}}
 reload(){if(!this.context)return;this.sample('reload',{volume:.8});}
 vehicleCrash(){
  if(!this.context)return;this.impact();this.groundImpact(.9);
  this.sample('branch-snap',{volume:.8,rate:.6,lowpass:2400});this.sample('explosion',{volume:.6,rate:.9,lowpass:1400,duration:1.6,fade:.8});
 }
 swallow(duration=2.55){
  if(!this.context)return;const c=this.context,t=c.currentTime;this.reverbReturn.gain.setTargetAtTime(0,t,.12);
  // Low, enclosed movement takes over as the jaws shut out the jungle (and its reverb).
  const s=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain();s.buffer=this.noise;s.loop=true;
  f.type='lowpass';f.frequency.setValueAtTime(540,t);f.frequency.exponentialRampToValueAtTime(70,t+duration-.15);f.Q.value=1.1;
  g.gain.setValueAtTime(.001,t);g.gain.linearRampToValueAtTime(1.05,t+.18);g.gain.exponentialRampToValueAtTime(.001,t+duration-.05);
  s.connect(f);f.connect(g);g.connect(this.master);s.start();s.stop(t+duration);this.active.push(s);
  s.onended=()=>{this.active=this.active.filter(x=>x!==s);s.disconnect();f.disconnect();g.disconnect();};
  this.groundImpact(.45);
 }
 acidSplash(){
  if(!this.context)return;const c=this.context,t=c.currentTime;
  const source=c.createBufferSource(),filter=c.createBiquadFilter(),gain=c.createGain();source.buffer=this.noise;
  filter.type='lowpass';filter.frequency.setValueAtTime(1250,t);filter.frequency.exponentialRampToValueAtTime(85,t+.42);filter.Q.value=.8;
  gain.gain.setValueAtTime(.001,t);gain.gain.linearRampToValueAtTime(2.3,t+.025);gain.gain.exponentialRampToValueAtTime(.001,t+.5);
  source.connect(filter);filter.connect(gain);gain.connect(this.master);source.start(t,0,.52);this.active.push(source);
  source.onended=()=>{this.active=this.active.filter(s=>s!==source);source.disconnect();filter.disconnect();gain.disconnect();};
 }
 digest(){
  if(!this.context)return;const c=this.context,t=c.currentTime;
  // A few subdued, enclosed bubbles punctuate the late chamber reveal.
  for(const [delay,hz,volume]of [[0,132,.085],[.24,91,.11],[.58,155,.06]]){
   const source=c.createOscillator(),gain=c.createGain(),at=t+delay;source.type='sine';
   source.frequency.setValueAtTime(hz,at);source.frequency.exponentialRampToValueAtTime(hz*.38,at+.22);
   gain.gain.setValueAtTime(.001,at);gain.gain.exponentialRampToValueAtTime(volume,at+.045);gain.gain.exponentialRampToValueAtTime(.001,at+.28);
   source.connect(gain);gain.connect(this.master);source.start(at);source.stop(at+.3);this.active.push(source);
   source.onended=()=>{this.active=this.active.filter(s=>s!==source);source.disconnect();gain.disconnect();};
  }
 }
 update(speed,dt=0,playing=false,allowAmbience=true){
  if(!this.context)return;const t=this.context.currentTime;
  // Duck the world under her voice, following the jaw (the call's own loudness): a
  // full roar pulls it down ~10 dB with a fast attack and a slower swell back.
  const v=this.voice,duck=v?1-Math.min(.7,this.jaw*(v.kind==='roar'?1.15:.9)):1;if(this.world)this.world.gain.setTargetAtTime(duck,t,duck<this.world.gain.value?.05:.4);
  this.engineGain.gain.setTargetAtTime(playing?.1+speed*.014:0,t,.2);this.windGain.gain.setTargetAtTime(playing?Math.min(.3,speed*.03):0,t,.2);this.engine?.playbackRate.setTargetAtTime(.82+speed*.028,t,.25);this.ambienceGain.gain.setTargetAtTime(playing?.3:0,t,.4);
  if(playing&&allowAmbience){this.ambientWait-=dt;if(this.ambientWait<=0&&!this.voice){const calls=[11,30,12,31,14],n=calls[this.ambientIndex++%calls.length];const side=this.ambientIndex%2?-1:1,e=this.ear;this.play(n,n>=30?.10:.08,.94,{vocal:false,at:{x:e.x+side*45,y:e.y+6,z:e.z+(Math.random()-.3)*50},wet:.35});this.ambientWait=12+(this.ambientIndex%3)*4;}}
 }
 debrisWarning(){if(!this.context)return;const c=this.context,t=c.currentTime;for(let i=0;i<2;i++){const o=c.createOscillator(),g=c.createGain();o.type='triangle';o.frequency.setValueAtTime(720-i*160,t+i*.14);g.gain.setValueAtTime(.065,t+i*.14);g.gain.exponentialRampToValueAtTime(.001,t+i*.14+.10);o.connect(g);g.connect(this.master);o.start(t+i*.14);o.stop(t+i*.14+.11);o.onended=()=>{o.disconnect();g.disconnect();};}}
 woodBreak(weight=1){if(!this.context)return;this.sample('branch-snap',{volume:weight*.95,rate:.85+Math.random()*.1,wet:.3});this.groundImpact(weight*.32);}
 mute(){this.muted=!this.muted;if(this.master)this.master.gain.value=this.muted?0:.75;return this.muted;}
 async pause(value){if(!this.context)return;if(value)await this.context.suspend();else await this.context.resume();}
 stopCalls(){for(const s of this.active){try{s.stop();}catch{}}this.active=[];this.voice=null;this.jaw=0;this.ambientWait=12;this.ambientIndex=0;}
}
