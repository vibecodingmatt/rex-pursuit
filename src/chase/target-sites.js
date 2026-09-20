// Shared by the combat shuffle and the skinned surface markers.
export const TARGET_SITES=[
 {name:'JAW',region:'head',at:[.65,4.12,6.50]},
 {name:'BROW',region:'head',at:[-.60,4.79,6.20]},
 {name:'CHIN',region:'head',at:[.05,3.65,6.45]},
 {name:'CHEEK',region:'head',at:[.66,4.60,5.92]},
 {name:'JAW',region:'head',at:[-.68,4.12,6.50]},
 {name:'BROW',region:'head',at:[.62,4.82,6.10]},
 {name:'NECK',region:'body',at:[-.73,3.66,4.55]},
 {name:'NECK',region:'body',at:[.73,3.66,4.55]},
 {name:'SHOULDER',region:'body',at:[-1.17,3.14,2.65]},
 {name:'SHOULDER',region:'body',at:[1.17,3.14,2.65]},
 {name:'CHEST',region:'body',at:[-.85,2.83,3.55]},
 {name:'CHEST',region:'body',at:[.85,2.83,3.55]},
];
export const SITE_OFFSETS=[[0,0,0],[.10,.09,0],[-.10,-.07,.05],[.06,-.10,-.07],[-.06,.10,.05]];
export function targetSequence(random,count,previous=[]){
 const shuffle=list=>{for(let i=list.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[list[i],list[j]]=[list[j],list[i]];}return list;};
 const pools=['head','body'].map(region=>shuffle(TARGET_SITES.flatMap((s,i)=>s.region===region?[i]:[])));
 const start=random()<.5?0:1,order=[];
 for(let i=0;i<count;i++)order.push(pools[(start+i)%2].pop());
 if(order.join(',')===previous.join(','))[order[0],order[2]]=[order[2],order[0]];
 return{order,variants:Object.fromEntries(order.map(id=>[id,Math.floor(random()*SITE_OFFSETS.length)]))};
}
