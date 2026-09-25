// Trims the ford's CC0 Freesound recordings (audio_reference/drop-audio/13-ford, ignored)
// into public/audio/ford/: decoded in Chrome, cut, faded, peak-normalized, written as WAV.
// Short one-shots are copied as the original MP3 previews. Re-run: node scripts/prepare-ford-audio.cjs
const {chromium}=require('playwright-core'),fs=require('fs'),path=require('path');
const dir='audio_reference/drop-audio/13-ford',out='public/audio/ford';
const cuts=[
 // [source, output, start s, end s, sample rate, peak]
 ['freesound-777116-large-stream.mp3','river-loop.wav',6,19,24000,.7],
 ['freesound-563555-river-wading-fast.mp3','wade-loop.wav',2.2,10.2,24000,.8],
 ['freesound-381699-car-through-water.mp3','water-pass.wav',11.6,15,32000,.9],
 ['freesound-637974-big-hand-slaps-spray.mp3','spray-slaps.wav',.25,7.1,32000,.9]];
const copies=[['freesound-442773-big-water-splash.mp3','splash-big.mp3'],['freesound-469608-watersplash.mp3','splash-small.mp3']];
function wav(samples,rate){const b=Buffer.alloc(44+samples.length*2);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(rate,24);b.writeUInt32LE(rate*2,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(samples.length*2,40);for(let i=0;i<samples.length;i++)b.writeInt16LE(Math.max(-32768,Math.min(32767,Math.round(samples[i]*32767))),44+i*2);return b;}
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 for(const [src,dst]of copies)fs.copyFileSync(path.join(dir,src),path.join(out,dst));
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 try{const p=await browser.newPage();
  for(const [src,dst,start,end,rate,peak]of cuts){
   const samples=await p.evaluate(async({d,start,end,rate})=>{const raw=Uint8Array.from(atob(d),c=>c.charCodeAt(0));const input=await new OfflineAudioContext(1,1,rate).decodeAudioData(raw.buffer);
    const len=Math.ceil((end-start)*rate),o=new OfflineAudioContext(1,len,rate),s=o.createBufferSource();s.buffer=input;s.connect(o.destination);s.start(0,start,end-start);const r=await o.startRendering();return Array.from(r.getChannelData(0));},{d:fs.readFileSync(path.join(dir,src)).toString('base64'),start,end,rate});
   let m=0;for(const v of samples)m=Math.max(m,Math.abs(v));const k=peak/Math.max(1e-4,m),fade=Math.floor(rate*.02);
   for(let i=0;i<samples.length;i++)samples[i]*=k*Math.min(1,i/fade,(samples.length-1-i)/fade);
   fs.writeFileSync(path.join(out,dst),wav(samples,rate));console.log(dst,(samples.length/rate).toFixed(2)+'s',Math.round(fs.statSync(path.join(out,dst)).size/1024)+' KB');
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
