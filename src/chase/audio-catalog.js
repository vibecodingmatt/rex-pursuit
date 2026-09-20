export const DEFAULT_ROLES={opening:1,charge:2,growl:9,pain:27};
export const AUDIO_KEY='rex-pursuit-audio-v1';
export async function readCatalog(){
 const response=await fetch('./audio/catalog.json');if(!response.ok)throw Error('Audio catalog could not load');return response.json();
}
export function resolveAudioSettings(catalog,saved={}){
 const roles={...DEFAULT_ROLES,...catalog.roles};
 for(const role of Object.keys(DEFAULT_ROLES)){
  const n=saved.roles?.[role];if(!Number.isInteger(n)||n<1||n>34)continue;
  // Old exports included the prototype's default raptor/unlabeled assignments.
  if(saved.revision!==2&&((role==='growl'&&n===13)||(role==='pain'&&n===19)))continue;
  roles[role]=n;
 }
 const labels=Object.fromEntries((catalog.clips||[]).map(c=>[c.id,c.label||'']));
 for(const [id,label]of Object.entries(saved.labels||{}))if(typeof label==='string'&&(saved.revision===2||label.trim()))labels[id]=label;
 return{revision:2,roles,labels};
}
export function clipEnvelope(buffer,hz=60){
 const data=buffer.getChannelData(0),count=Math.ceil(buffer.duration*hz),values=new Float32Array(count);let peak=0;
 for(let i=0;i<count;i++){let sum=0,n=0;const end=Math.min(data.length,Math.floor((i+1)*buffer.sampleRate/hz));for(let s=Math.floor(i*buffer.sampleRate/hz);s<end;s+=4){sum+=data[s]*data[s];n++;}values[i]=Math.sqrt(sum/Math.max(1,n));peak=Math.max(peak,values[i]);}
 for(let i=0;i<count;i++)values[i]=Math.pow(Math.max(0,values[i]/Math.max(.001,peak)-.035)/.965,.48);
 return{values,hz,duration:buffer.duration};
}
