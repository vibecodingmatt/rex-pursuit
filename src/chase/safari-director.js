import {SPECIES,isRare} from './safari-rules.js';
// Gameplay population is independent of graphics quality: lowering detail must
// never remove scoring opportunities. All creatures come from bounded pools.
// The jungle's own life (roosting Dimorphodon, basking lizards, packs flushed by the
// Jeep) runs underneath as a bonus layer.
const AIR=['pteranodon','dimorphodon','quetzalcoatlus'];
/** Weighted pick from [[weight, value], ...]. */
const pick=(table,r)=>{let total=0;for(const [w]of table)total+=w;r*=total;for(const [w,v]of table){if((r-=w)<0)return v;}return table.at(-1)[1];};
// Common crossings: [weight, [kind, how many, spacing along the road (m)]].
const COMMON=[[32,['compy',3,2.2]],[10,['lizard',2,1.8]],[22,['gallimimus',2,2.6]],[21,['raptor',2,3]],[15,['pachycephalosaurus',1,0]]];
// One rare encounter every 12-17 s; each roll is independent, so a legendary is never guaranteed.
const RARE=[[4,'goldenCompy'],[4,'ghostRaptor'],[5,'quetzalcoatlus'],[23,'dilophosaurus'],[21,'parasaurolophus'],[22,'triceratops'],[21,'stegosaurus']];
// The menu parade shows the whole roster, rare ones included, at a gentler pace.
const PARADE=[[16,'compy'],[13,'gallimimus'],[13,'raptor'],[11,'pachycephalosaurus'],[10,'dilophosaurus'],[9,'parasaurolophus'],[9,'triceratops'],[9,'stegosaurus'],[3,'ghostRaptor'],[3,'goldenCompy'],[4,'lizard']];
export function createSafariDirector({critters,flyers,birds,vector,random=Math.random}){
 let next=0,nextAir=3,nextRare=14,nextBirds=9,stampede=false,notice=null,menu={ground:0,air:2,birds:6};
 const side=()=>random()<.5?-1:1;
 function spawn(kind,z=18+random()*12,{announce=true,at=side()}={}){
  const s=SPECIES[kind],air=AIR.includes(kind);
  const c=air?flyers.huntSpawn(kind,at):critters.huntSpawn(kind,at,z);
  if(c&&announce&&isRare(kind))notice={kind,name:s.name,rarity:s.rarity,points:s.points,left:3.4,target:c,hp:s.hp};
  return c;
 }
 function crossing(kind,count,gap,z){const at=side();for(let i=0;i<count;i++)spawn(kind,z+i*gap+random()*1.2,{at});}
 return{
  reset(){next=.15;nextAir=2;nextRare=10+random()*6;nextBirds=7;stampede=false;notice=null;},
  get notice(){return notice;},spawn,
  update(dt,round){
   if(round.ready>0||round.complete)return;
   if(notice){notice.left-=dt;if(notice.left<=0||!notice.target.on)notice=null;}
   const t=round.elapsed;
   if(t>=next){
    const [kind,count,gap]=pick(COMMON,random());
    // Stagger packs along the road; never fill the whole shooting corridor.
    crossing(kind,count,gap,16+random()*10);
    next=t+(t>60?1.15:t>30?1.45:1.7)+random()*.65;
   }
   if(t>=nextAir){spawn(random()<.5?'pteranodon':'dimorphodon');nextAir=t+3.5+random()*2.5;}
   if(t>=nextBirds){birds.scatter(vector.set(side()*2,6,26),{spread:2,count:4});nextBirds=t+10+random()*5;}
   if(t>=nextRare&&t<84){spawn(pick(RARE,random()),20+random()*5);nextRare=t+12+random()*5;}
   // The final stretch opens with a stampede: a Gallimimus herd and compies pour across together.
   if(!stampede&&t>=77){stampede=true;const at=side();for(let i=0;i<6;i++)spawn('gallimimus',18+i*2.4+random(),{at});for(let i=0;i<5;i++)spawn('compy',14+i*1.6+random(),{at:-at});
    notice={kind:'stampede',name:'Stampede',rarity:'Final push',points:0,left:3,target:{on:true}};}
  },
  /** The Safari title screen: the roster crossing the road and the sky, nothing scored. */
  parade(dt){
   menu.ground-=dt;menu.air-=dt;menu.birds-=dt;
   if(menu.ground<=0){const kind=pick(PARADE,random()),big=['triceratops','stegosaurus','parasaurolophus'].includes(kind),z=big?17+random()*6:10+random()*9;
    if(kind==='compy')crossing(kind,3+Math.floor(random()*3),1.3,z);else if(kind==='gallimimus')crossing(kind,2+Math.floor(random()*3),2.4,z+3);else spawn(kind,z,{announce:false});
    menu.ground=(big?3.2:1.6)+random()*1.4;}
   if(menu.air<=0){const r=random();spawn(r<.12?'quetzalcoatlus':r<.6?'pteranodon':'dimorphodon',0,{announce:false});menu.air=4+random()*3.5;}
   if(menu.birds<=0){birds.scatter(vector.set(side()*3,7,20),{spread:3,count:5});menu.birds=9+random()*6;}
  },
  resetParade(){menu={ground:.2,air:1.5,birds:4};},
 };
}
