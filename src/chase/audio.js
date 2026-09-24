import {AUDIO_KEY,DEFAULT_ROLES,readCatalog,resolveAudioSettings,clipEnvelope} from './audio-catalog.js';
// Equal-power crossfade of the tail into the head, so a recorded bed loops without a seam.
function loopable(c,b,seconds){const n=Math.floor(seconds*b.sampleRate);if(b.length<n*3)return b;const out=c.createBuffer(b.numberOfChannels,b.length-n,b.sampleRate);
 for(let ch=0;ch<b.numberOfChannels;ch++){const src=b.getChannelData(ch),dst=out.getChannelData(ch);dst.set(src.subarray(0,b.length-n));for(let i=0;i<n;i++){const t=i/n*Math.PI/2;dst[i]=src[i]*Math.sin(t)+src[b.length-n+i]*Math.cos(t);}}return out;}
export class ChaseAudio {
 constructor(){this.context=null;this.muted=false;this.buffers=new Map();this.envelopes=new Map();this.ready=false;this.active=[];this.roles={...DEFAULT_ROLES};this.voice=null;this.jaw=0;this.labels={};this.ambientWait=12;this.ambientIndex=0;this.stepIndex=0;this.lastPain=-10;}
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
  await this.readRoles();if(this.context){await this.loadClips();await this.context.resume();return;}
  const c=this.context=new (window.AudioContext||window.webkitAudioContext)();this.master=c.createGain();this.master.gain.value=this.muted?0:.75;const compressor=c.createDynamicsCompressor();compressor.threshold.value=-18;compressor.ratio.value=5;this.master.connect(compressor);compressor.connect(c.destination);
  const noise=c.createBuffer(1,c.sampleRate*2,c.sampleRate),data=noise.getChannelData(0);let last=0;for(let i=0;i<data.length;i++){last=(last+Math.random()*.04-.02)*.97;data[i]=last;}this.noise=noise;
  const engine=c.createOscillator(),engine2=c.createOscillator(),filter=c.createBiquadFilter();filter.type='lowpass';filter.frequency.value=180;this.engineGain=c.createGain();this.engineGain.gain.value=0;engine.type='sawtooth';engine.frequency.value=42;engine2.type='triangle';engine2.frequency.value=83;engine.connect(filter);engine2.connect(filter);filter.connect(this.engineGain);this.engineGain.connect(this.master);engine.start();engine2.start();this.engine=engine;
  const wind=c.createBufferSource();wind.buffer=noise;wind.loop=true;const windFilter=c.createBiquadFilter();windFilter.type='bandpass';windFilter.frequency.value=550;this.windGain=c.createGain();this.windGain.gain.value=0;wind.connect(windFilter);windFilter.connect(this.windGain);this.windGain.connect(this.master);wind.start();
  const insects=c.createBufferSource();insects.buffer=noise;insects.loop=true;const insectFilter=c.createBiquadFilter();insectFilter.type='highpass';insectFilter.frequency.value=3300;this.ambienceGain=c.createGain();this.ambienceGain.gain.value=0;insects.connect(insectFilter);insectFilter.connect(this.ambienceGain);this.ambienceGain.connect(this.master);insects.start();
  await this.loadClips();this.ready=true;await c.resume();
 }
 play(n,volume=.8,rate=1,options={}){
  if(!this.context||!this.buffers.has(n))return null;
  const c=this.context,source=c.createBufferSource(),gain=c.createGain(),pan=c.createStereoPanner();source.buffer=this.buffers.get(n);source.playbackRate.value=rate;gain.gain.value=volume;pan.pan.value=options.pan||0;source.connect(gain);gain.connect(pan);pan.connect(this.master);
  const vocal=options.vocal??(/^TRex/i.test(this.labels[n]||'')?'growl':null);
  if(vocal){this.stopVoice();this.voice={source,gain,id:n,kind:vocal,start:c.currentTime,rate,envelope:this.envelopes.get(n),duration:source.buffer.duration/rate};}
  source.start();this.active.push(source);
  source.onended=()=>{this.active=this.active.filter(x=>x!==source);if(this.voice?.source===source)this.voice=null;source.disconnect();gain.disconnect();pan.disconnect();};return source;
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
   const gain=c.createGain();gain.gain.value=0;gain.connect(this.master);
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
  s.connect(f);f.connect(g);g.connect(this.master);s.start(c.currentTime+Math.min(delay,6));s.onended=()=>{s.disconnect();f.disconnect();g.disconnect();};
 }
 stopVoice(){if(this.voice){try{this.voice.source.stop();}catch{}}this.voice=null;}
 roar(opening=false){return this.play(opening?this.roles.opening:this.roles.charge,opening?.96:.68,opening?.95:1.03,{vocal:'roar'});}
 growl(){if(this.voice)return;this.play(this.roles.growl,.44,.96,{vocal:'growl'});}
 bite(){this.play(18,.8,1,{vocal:'bite'});}
 pain(force=false){if(!this.context)return;if(!force&&(this.voice||this.context.currentTime-this.lastPain<3.5))return;this.lastPain=this.context.currentTime;this.play(this.roles.pain,.64,.96,{vocal:'pain'});}
 footstep(weight=.3){this.play([3,4,5,6][this.stepIndex++%4],.17+weight*.42,.91+weight*.14,{vocal:false,pan:this.stepIndex%2?.12:-.12});this.groundImpact(weight*.6);}
 vocalPose(dt){
  let energy=0,kind=null,id=null,elapsed=0;const v=this.voice;
  if(v&&this.context){elapsed=(this.context.currentTime-v.start)*v.rate;kind=v.kind;id=v.id;const a=v.envelope.values,k=elapsed*v.envelope.hz,index=Math.floor(k);if(index>=0&&index<a.length)energy=a[index]+((a[index+1]??0)-a[index])*(k-index);}
  const level=energy>.025?(kind==='roar'?.44+.54*energy:kind==='bite'?.10+.55*energy:kind==='pain'?.13+.42*energy:.08+.27*energy):0;
  this.jaw+=(level-this.jaw)*(1-Math.exp(-dt*(level>this.jaw?48:24)));if(!v&&this.jaw<.002)this.jaw=0;
  return{jaw:this.jaw,energy,kind,id,elapsed,active:!!v,roar:kind==='roar'?this.jaw:0};
 }
 gun(){if(!this.context)return;const c=this.context,t=c.currentTime;const noise=c.createBufferSource(),filter=c.createBiquadFilter(),gain=c.createGain();noise.buffer=this.noise;filter.type='highpass';filter.frequency.value=700;noise.connect(filter);filter.connect(gain);gain.connect(this.master);gain.gain.setValueAtTime(3.5,t);gain.gain.exponentialRampToValueAtTime(.001,t+.13);noise.start(t,Math.random(),.14);
  const osc=c.createOscillator(),g=c.createGain();osc.type='triangle';osc.frequency.setValueAtTime(155,t);osc.frequency.exponentialRampToValueAtTime(38,t+.14);g.gain.setValueAtTime(.7,t);g.gain.exponentialRampToValueAtTime(.001,t+.17);osc.connect(g);g.connect(this.master);osc.start(t);osc.stop(t+.18);noise.onended=()=>{noise.disconnect();filter.disconnect();gain.disconnect();};osc.onended=()=>{osc.disconnect();g.disconnect();};
 }
 impact(explosive=false){if(!this.context)return;const c=this.context,t=c.currentTime,source=c.createBufferSource(),filter=c.createBiquadFilter(),gain=c.createGain();source.buffer=this.noise;filter.type='lowpass';filter.frequency.value=explosive?1600:400;source.connect(filter);filter.connect(gain);gain.connect(this.master);gain.gain.setValueAtTime(explosive?5:3,t);gain.gain.exponentialRampToValueAtTime(.001,t+(explosive?1.2:.5));source.start(t,0,explosive?1.3:.6);source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();};}
 groundImpact(weight=.3){if(!this.context)return;const c=this.context,t=c.currentTime,duration=.22+weight*.3,o=c.createOscillator(),g=c.createGain();o.type='sine';o.frequency.setValueAtTime(68,t);o.frequency.exponentialRampToValueAtTime(27,t+duration);g.gain.setValueAtTime(.001,t);g.gain.linearRampToValueAtTime(weight*.65,t+.014);g.gain.exponentialRampToValueAtTime(.001,t+duration);o.connect(g);g.connect(this.master);o.start(t);o.stop(t+duration+.02);o.onended=()=>{o.disconnect();g.disconnect();};}
 cue(success=false){if(!this.context)return;const c=this.context,t=c.currentTime;for(let i=0;i<(success?3:1);i++){const o=c.createOscillator(),g=c.createGain();o.type='sine';o.frequency.value=success?[440,554,660][i]:520;g.gain.setValueAtTime(.075,t+i*.055);g.gain.exponentialRampToValueAtTime(.001,t+i*.055+.10);o.connect(g);g.connect(this.master);o.start(t+i*.055);o.stop(t+i*.055+.11);o.onended=()=>{o.disconnect();g.disconnect();};}}
 reload(){if(!this.context)return;const c=this.context;for(const offset of [0,.35,1.9,2.3]){const o=c.createOscillator(),g=c.createGain(),t=c.currentTime+offset;o.type='square';o.frequency.value=offset>1?180:260;g.gain.setValueAtTime(.05,t);g.gain.exponentialRampToValueAtTime(.001,t+.06);o.connect(g);g.connect(this.master);o.start(t);o.stop(t+.07);o.onended=()=>{o.disconnect();g.disconnect();};}}
 vehicleCrash(){
  if(!this.context)return;this.impact();this.groundImpact(.9);const c=this.context,t=c.currentTime;
  const s=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain();s.buffer=this.noise;s.loop=true;f.type='bandpass';f.frequency.setValueAtTime(1050,t);f.frequency.exponentialRampToValueAtTime(340,t+2.8);f.Q.value=.7;g.gain.setValueAtTime(2.3,t);g.gain.exponentialRampToValueAtTime(.001,t+2.9);s.connect(f);f.connect(g);g.connect(this.master);s.start();s.stop(t+3);s.onended=()=>{s.disconnect();f.disconnect();g.disconnect();};
  for(const hz of [390,630,970]){const o=c.createOscillator(),gain=c.createGain();o.type='triangle';o.frequency.setValueAtTime(hz,t);o.frequency.exponentialRampToValueAtTime(hz*.65,t+.3);gain.gain.setValueAtTime(.12,t);gain.gain.exponentialRampToValueAtTime(.001,t+.5);o.connect(gain);gain.connect(this.master);o.start();o.stop(t+.52);o.onended=()=>{o.disconnect();gain.disconnect();};}
 }
 swallow(duration=2.55){
  if(!this.context)return;const c=this.context,t=c.currentTime;
  // Low, enclosed movement takes over as the jaws shut out the jungle.
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
  if(!this.context)return;const t=this.context.currentTime;this.engineGain.gain.setTargetAtTime(playing?.035+speed*.0075:0,t,.2);this.windGain.gain.setTargetAtTime(playing?Math.min(.6,speed*.055):0,t,.2);this.engine.frequency.setTargetAtTime(36+speed*1.5,t,.25);this.ambienceGain.gain.setTargetAtTime(playing?.085:0,t,.4);
  if(playing&&allowAmbience){this.ambientWait-=dt;if(this.ambientWait<=0&&!this.voice){const calls=[11,30,12,31,14],n=calls[this.ambientIndex++%calls.length];this.play(n,n>=30?.10:.08,.94,{vocal:false,pan:this.ambientIndex%2?-.72:.68});this.ambientWait=12+(this.ambientIndex%3)*4;}}
 }
 debrisWarning(){if(!this.context)return;const c=this.context,t=c.currentTime;for(let i=0;i<2;i++){const o=c.createOscillator(),g=c.createGain();o.type='triangle';o.frequency.setValueAtTime(720-i*160,t+i*.14);g.gain.setValueAtTime(.065,t+i*.14);g.gain.exponentialRampToValueAtTime(.001,t+i*.14+.10);o.connect(g);g.connect(this.master);o.start(t+i*.14);o.stop(t+i*.14+.11);o.onended=()=>{o.disconnect();g.disconnect();};}}
 woodBreak(weight=1){
  if(!this.context)return;const c=this.context,t=c.currentTime;
  for(let i=0;i<3;i++){const s=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain(),at=t+i*.047;
   s.buffer=this.noise;f.type='bandpass';f.frequency.value=850+i*650;f.Q.value=.7;g.gain.setValueAtTime(weight*(1.45-i*.28),at);g.gain.exponentialRampToValueAtTime(.001,at+.16+i*.04);
   s.connect(f);f.connect(g);g.connect(this.master);s.start(at,i*.09,.3);s.onended=()=>{s.disconnect();f.disconnect();g.disconnect();};
  }
  this.groundImpact(weight*.32);
 }
 mute(){this.muted=!this.muted;if(this.master)this.master.gain.value=this.muted?0:.75;return this.muted;}
 async pause(value){if(!this.context)return;if(value)await this.context.suspend();else await this.context.resume();}
 stopCalls(){for(const s of this.active){try{s.stop();}catch{}}this.active=[];this.voice=null;this.jaw=0;this.ambientWait=12;this.ambientIndex=0;}
}
