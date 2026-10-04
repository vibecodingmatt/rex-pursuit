// An original, simulation-clocked pulse score. No arcade soundtrack samples.
export class RideAudio {
 constructor(){this.context=null;this.muted=false;this.paused=true;this.beat=-1;this.buffers={};this.voices=new Set();}
 async unlock(){
  if(!this.context){
   const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;
   this.context=new AC();this.master=this.context.createGain();this.master.gain.value=this.muted?0:.52;this.master.connect(this.context.destination);
   const length=this.context.sampleRate;this.noise=this.context.createBuffer(1,length,this.context.sampleRate);const data=this.noise.getChannelData(0);for(let i=0;i<length;i++)data[i]=Math.random()*2-1;
   this.engine=this.context.createOscillator();this.engine.type='triangle';this.engineGain=this.context.createGain();this.engineGain.gain.value=0;this.engine.connect(this.engineGain);this.engineGain.connect(this.master);this.engine.start();
   this.wind=this.context.createBufferSource();this.wind.buffer=this.noise;this.wind.loop=true;this.windFilter=this.context.createBiquadFilter();this.windFilter.type='lowpass';this.windGain=this.context.createGain();this.windGain.gain.value=0;this.wind.connect(this.windFilter);this.windFilter.connect(this.windGain);this.windGain.connect(this.master);this.wind.start();
   Promise.all([1,9,14].map(async id=>{try{const response=await fetch(new URL(`./audio/clip-${String(id).padStart(2,'0')}.wav`,document.baseURI));if(response.ok)this.buffers[id]=await this.context.decodeAudioData(await response.arrayBuffer());}catch{/* Synthesis remains available offline. */}}));
  }
  this.paused=false;try{await this.context.resume();}catch{/* A later gesture can unlock audio. */}
 }
 mute(value){this.muted=value;if(this.master)this.master.gain.setTargetAtTime(value?0:.52,this.context.currentTime,.04);}
 pause(value){this.paused=value;if(!this.context)return;if(value)this.context.suspend().catch(()=>{});else this.context.resume().catch(()=>{});}
 reset(){this.beat=-1;if(this.engineGain){this.engineGain.gain.value=0;this.windGain.gain.value=0;}for(const voice of this.voices){try{voice.stop();}catch{/* Already ended. */}}this.voices.clear();}
 track(source,gain,filter){this.voices.add(source);source.onended=()=>{this.voices.delete(source);source.disconnect();gain.disconnect();filter?.disconnect();};}
 tone(freq,duration,volume=.1,type='sine',end=freq){
  if(!this.context||this.paused||this.voices.size>40)return;const c=this.context,t=c.currentTime,o=c.createOscillator(),g=c.createGain();o.type=type;o.frequency.setValueAtTime(freq,t);o.frequency.exponentialRampToValueAtTime(Math.max(20,end),t+duration);g.gain.setValueAtTime(volume,t);g.gain.exponentialRampToValueAtTime(.0001,t+duration);o.connect(g);g.connect(this.master);o.start();o.stop(t+duration);this.track(o,g);
 }
 hiss(duration=.1,volume=.13,frequency=1800){
  if(!this.context||this.paused||this.voices.size>40)return;const c=this.context,t=c.currentTime,s=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain();s.buffer=this.noise;f.type='lowpass';f.frequency.value=frequency;g.gain.setValueAtTime(volume,t);g.gain.exponentialRampToValueAtTime(.0001,t+duration);s.connect(f);f.connect(g);g.connect(this.master);s.start(0,Math.random()*.3,duration);this.track(s,g,f);
 }
 roar(id=1){
  if(!this.context||this.paused)return;const buffer=this.buffers[id];if(!buffer){this.tone(95,1.2,.2,'sawtooth',32);this.hiss(.8,.2,500);return;}
  const s=this.context.createBufferSource(),g=this.context.createGain();s.buffer=buffer;g.gain.value=.4;s.connect(g);g.connect(this.master);s.start();this.track(s,g);
 }
 event(e){
  if(e.type==='threat')this.roar(9);
  if(e.type==='shot'){if(this.worldSounds!==false){this.hiss(.055,.13,2400);this.tone(170,.065,.09,'triangle',65);}if(e.precise)this.tone(1350,.06,.035,'sine',780);}
  if(e.type==='damage'||e.type==='blast'){this.hiss(.45,.5,850);this.tone(72,.65,.36,'sine',27);}
  if(e.type==='boss'&&!(this.modeledRex&&['rex','twins','indominus'].includes(e.kind))&&!(this.modeledMosa&&e.kind==='mosa'))this.roar(e.kind==='indoraptor'?14:1);
  if(e.type==='stage'){this.tone(220,.6,.13,'triangle',440);this.tone(330,.7,.1,'triangle',660);}
  if(e.type==='kill'){this.tone(e.boss?150:440,.18,.09,'triangle',e.boss?55:880);if(e.boss)this.roar(9);}
  if(e.type==='supply'||e.type==='focus'||e.type==='stagger'){this.tone(660,.4,.13,'sine',1320);this.tone(990,.5,.07);}
  if(e.type==='bridge'){this.hiss(1,.45,1100);this.tone(60,1,.4,'sawtooth',25);}
 }
 update(game){
  if(this.paused||!this.context)return;const now=this.context.currentTime,beds=this.worldSounds===false?0:1;this.engine.frequency.setTargetAtTime(35+Math.abs(game.speed)*1.9+Math.sin(game.time*16)*2,now,.05);this.engineGain.gain.setTargetAtTime((.025+Math.abs(game.speed)*.0008)*beds,now,.1);this.windFilter.frequency.setTargetAtTime(250+Math.abs(game.speed)*62,now,.1);this.windGain.gain.setTargetAtTime(Math.abs(game.speed)*.0025*beds,now,.1);const b=Math.floor(game.time*(game.phase==='boss'?4.6:3.6));if(b===this.beat)return;this.beat=b;
  const root=[55,49,65.4,58.3][Math.floor(b/32)%4];
  if(b%4===0){this.tone(100,.22,.17,'sine',28);this.tone(root,.4,.08,'triangle');}
  if(b%4===2)this.hiss(.11,.065,1100);
  this.hiss(.024,.025,7000);
  if(b%2===0){const notes=[1,1.5,2,1.125,1.5,2.25,2,1.5];this.tone(root*notes[b%8]*4,.24,.032,'sine');}
 }
}
