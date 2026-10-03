// Deterministic fixed-step arcade simulation. Coordinates are in the playable viewport.
export const STAGES = [
 {id:'gates',name:'Through the gates',era:'THE ORIGINAL CIRCUIT',location:'NORTH PADDOCK · 06:14',bg:0,duration:34,boss:'trike',roster:['raptor','dilo','galli','trike'],radio:'Keep the trigger down. We are going straight through.',setpiece:'stampede'},
 {id:'river',name:'River of giants',era:'THE ORIGINAL CIRCUIT',location:'RIVER VALLEY · 07:02',bg:4,duration:36,boss:'rex',roster:['ptero','ichthy','ptero'],radio:'That is not a bridge. Hold on to something.',setpiece:'brachio'},
 {id:'fault',name:'The falling world',era:'THE ORIGINAL CIRCUIT',location:'FAULTLINE · 18:46',bg:1,duration:38,boss:null,roster:['ptero','trike','raptor'],radio:'The bridge is coming apart! Clear us a way through.',setpiece:'bridge'},
 {id:'hybrid',name:'Nobody is in control',era:'THE WORLD DETOUR',location:'LAGOON PROMENADE · 20:31',bg:2,duration:30,boss:'indominus',roster:['raptor','ptero','dilo'],radio:'Thermal is blank. Watch for the eyes.',setpiece:'camouflage'},
 {id:'lagoon',name:'Something in the water',era:'THE WORLD DETOUR',location:'DEEP WATER · 20:48',bg:2,duration:28,boss:'mosa',roster:['ichthy','ptero'],radio:'Wake on the starboard side. A very, very big wake.',setpiece:'water'},
 {id:'manor',name:'Do not turn out the lights',era:'THE WORLD DETOUR',location:'GLASS CONSERVATORY · 23:09',bg:3,duration:30,boss:'indoraptor',roster:['raptor','dilo'],radio:'On the roof. No, inside. Keep your light on it.',setpiece:'blackout'},
 {id:'visitor',name:'When giants ruled',era:'THE LAST EXHIBIT',location:'VISITOR CENTER · 00:01',bg:6,duration:30,boss:'twins',roster:['raptor','dilo','ptero'],radio:'Two signatures. One exit. Make every shot count.',setpiece:'finale'},
];
// The director: each stage runs one of three seeded beat sheets ([stage seconds, pattern,
// kind, count]); the roster timer only fills the gaps. Every beat is called on the radio and
// telegraphed by motion before contact. The broken bridge (fault, 18-23 s) stays air-only.
export const BEATS={
 gates:[[[5,'flank','raptor',3],[11,'stampede','galli',16],[18,'ambush','raptor'],[24,'pair','dilo',2]],[[4,'ambush','raptor'],[9,'pair','dilo',2],[15,'stampede','galli',18],[22,'flank','raptor',4]],[[6,'stampede','galli',14],[12,'flank','raptor',3],[19,'pair','dilo',2],[25,'ambush','raptor']]],
 river:[[[6,'formation','ptero',3],[14,'pair','ichthy',2],[22,'formation','ptero',4]],[[5,'pair','ichthy',2],[12,'formation','ptero',3],[20,'pair','ichthy',2]],[[8,'formation','ptero',4],[16,'pair','ichthy',2],[24,'formation','ptero',3]]],
 fault:[[[5,'flank','raptor',3],[12,'pair','trike',1],[19,'formation','ptero',3],[27,'ambush','raptor']],[[6,'formation','ptero',3],[12,'flank','raptor',2],[20,'formation','ptero',4],[29,'pair','trike',1]],[[4,'pair','trike',1],[10,'ambush','raptor'],[18.5,'formation','ptero',3],[26,'flank','raptor',3]]],
 hybrid:[[[5,'ambush','raptor'],[11,'formation','ptero',3],[18,'flank','raptor',3]],[[6,'flank','raptor',3],[12,'pair','dilo',2],[19,'formation','ptero',3]],[[4,'formation','ptero',3],[10,'ambush','raptor'],[17,'pair','dilo',2]]],
 lagoon:[[[5,'pair','ichthy',2],[12,'formation','ptero',3],[19,'pair','ichthy',3]],[[6,'formation','ptero',3],[13,'pair','ichthy',2],[20,'formation','ptero',3]],[[4,'pair','ichthy',3],[11,'formation','ptero',4],[18,'pair','ichthy',2]]],
 manor:[[[5,'ambush','raptor'],[11,'pair','dilo',2],[18,'flank','raptor',3]],[[6,'flank','raptor',2],[12,'ambush','raptor'],[19,'pair','dilo',2]],[[4,'pair','dilo',2],[10,'flank','raptor',3],[17,'ambush','raptor']]],
 visitor:[[[5,'flank','raptor',3],[11,'formation','ptero',3],[17,'ambush','raptor']],[[4,'ambush','raptor'],[10,'pair','dilo',2],[16,'flank','raptor',4]],[[6,'formation','ptero',3],[12,'flank','raptor',3],[18,'pair','dilo',2]]],
};
const CALLS={flank:'Pack on both sides! They are flanking us!',stampede:'Stampede crossing {side}! Keep moving!',formation:'Flyers diving in formation, high!',ambush:'Movement in the brush, {side}!',pair:{dilo:'Spitters ahead. Watch the glass!',ichthy:'Something big under the surface!',trike:'Three horns on the road! Stop that charge!'}};
export const TYPES = {
 rex:{cell:0,hp:260,points:6000,head:[.26,.24],size:.65},raptor:{cell:1,hp:5,points:200,head:[.54,.22],size:.29},
 dilo:{cell:2,hp:6,points:300,head:[.48,.38],size:.31},ptero:{cell:3,hp:3,points:180,head:[.64,.47],size:.29},
 indominus:{cell:4,hp:340,points:9000,head:[.29,.27],size:.74},indoraptor:{cell:5,hp:240,points:8500,head:[.32,.5],size:.67},
 mosa:{cell:6,hp:300,points:8500,head:[.42,.4],size:.82},trike:{cell:7,hp:13,points:500,head:[.53,.48],size:.39},
 brachio:{cell:0,atlas:'wildlife',hp:1,points:0,head:[.8,.17],size:.8},galli:{cell:1,atlas:'wildlife',hp:3,points:150,head:[.8,.24],size:.31},
 anky:{cell:2,atlas:'wildlife',hp:10,points:350,head:[.74,.66],size:.34},ichthy:{cell:3,atlas:'wildlife',hp:4,points:220,head:[.74,.28],size:.3},
 rock:{hp:5,points:100,size:.16},spit:{hp:1,points:75,size:.10},supply:{hp:1,points:0,size:.13},barrel:{hp:2,points:250,size:.16}
};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
// A Rex boss is fought in reverse: the vehicle brakes, then backs away while she
// chases it. The clear phase holds longer so her fall can play out.
export const DRIVE={rex:-9,twins:-8};
export function project(e,aspect){
 const size=e.size*Math.min(1,aspect*1.2),w=size/aspect;
 const x=clamp(e.x,w*.38,1-w*.38),y=e.y;
 return{x,y,w,h:size,hx:x+(e.head[0]-.5)*w,hy:y+(e.head[1]-.5)*size};
}
export class Circuit {
 constructor({route='extended',difficulty='arcade',seed=94}={}) {
  this.route=route;this.difficulty=difficulty;this.rng=seed;this.path=route==='classic'?[0,1,2,6]:[0,1,2,3,4,5,6];
  this.status='playing';this.stageIndex=0;this.stageTime=0;this.time=0;this.phase='intro';this.phaseTime=0;this.hp=100;this.score=0;
  this.combo=0;this.maxCombo=0;this.chainTime=0;this.shots=0;this.hits=0;this.kills=0;this.bosses=0;this.credits=2;this.continues=0;
  this.entities=[];this.events=[];this.serial=0;this.spawnTimer=2.5;this.beats=null;this.hazardTimer=6;this.supplyTimer=11;this.travel=0;this.speed=0;
  this.cooldown=0;this.focus=0;this.focusTime=0;this.invulnerable=0;this.bossSpawned=false;this.bridgeBroken=false;this.wave=0;
  this.emit('stage',{stage:this.stage.id});
 }
 get stage(){return STAGES[this.path[this.stageIndex]];}
 get clearHold(){return DRIVE[this.stage.boss]?5:3.5;}
 random(){this.rng=(Math.imul(this.rng,1664525)+1013904223)>>>0;return this.rng/4294967296;}
 emit(type,data={}){this.events.push({type,...data});}
 drain(){return this.events.splice(0);}
 /** One authored encounter; see BEATS. */
 beat(pattern,kind,count=1){
  const side=this.random()<.5?-1:1,named=side<0?'on the right':'on the left',call=CALLS[pattern];
  if(pattern==='flank')for(let i=0;i<count;i++){const e=this.spawn(kind,{x:.5+(i%2?side:-side)*(.24+.07*(i>>1)),delay:i*.35});
   // The pack's lead pounces onto the hood at the end of its charge and bites unless shot off.
   if(!i&&kind==='raptor'){e.leaper=true;e.leapAt=e.life-.25;e.life+=1.8;}}
  else if(pattern==='stampede')for(let i=0;i<count;i++)this.spawn('galli',{x:.5+side*(.12+this.random()*.32),delay:i*.13});
  else if(pattern==='formation')for(let i=0;i<count;i++)this.spawn('ptero',{x:.5+(i-(count-1)/2)*.13,delay:i*.12});
  else if(pattern==='ambush'){const e=this.spawn(kind,{x:.5+side*.3,delay:.9});e.ambush=true;e.life=2.4;}
  else for(let i=0;i<count;i++)this.spawn(kind,{delay:i*.45});
  this.emit('beat',{pattern,kind,side,text:(typeof call==='string'?call:call?.[kind]||'').replace('{side}',named)});
 }
 spawn(kind,{boss=false,x,delay=0}={}){
  const def=TYPES[kind],side=this.random()<.5?-1:1;
  const e={id:++this.serial,kind,boss,hp:boss?(kind==='trike'?180:def.hp):def.hp,maxHp:boss?(kind==='trike'?180:def.hp):def.hp,
   age:-delay,life:boss?99:4.2+this.random()*.7,lane:x??(.5+side*(.12+this.random()*.23)),x:.5,y:.55,size:.01,head:def.head||[.5,.5],
   spawnTravel:this.travel+Math.max(0,delay)*this.speed,
   seed:this.random()*6.28,attack:0,cycle:0,hit:0,dead:false,fade:0,weak:0,weakHits:0,alpha:1};
  this.entities.push(e);return e;
 }
 pose(e){
  const d=TYPES[e.kind],t=Math.max(0,e.age),p=clamp(t/e.life,0,1),s=Math.sin(t*7+e.seed);
  if(e.boss){
   const approach=clamp(t/2.5,0,1),cycle=t%6.4;e.cycle=cycle;e.attack=cycle>4.5?(cycle-4.5)/1.9:0;
   e.x=clamp(e.lane+Math.sin(t*.8+e.seed)*.09,.2,.8);e.y=.56+Math.abs(s)*.008;
   e.size=d.size*(.4+.6*approach)*(1+e.attack*.35);e.weak=cycle>1.6&&cycle<5.8?1:0;
   e.alpha=e.kind==='indominus'&&cycle<1.6?.18+.12*Math.sin(t*4):1;
   if(e.kind==='mosa'){e.y=.68-Math.sin(clamp(cycle/4,0,1)*Math.PI)*.15;e.size*=.9;}
   if(e.kind==='indoraptor'){e.x=clamp(e.lane+Math.sin(t*1.2)*.23,.22,.78);e.y=.49+Math.sin(t*.8)*.1;}
  }else{
   const depth=p*p;e.x=.5+(e.lane-.5)*(.35+depth*1.4)+Math.sin(t*2+e.seed)*.025;e.y=.48+depth*.25+Math.abs(s)*.009;
   e.size=d.size*(.16+depth*1.2);
   if(['ptero','ichthy','spit'].includes(e.kind)){e.y=.26+depth*.22+Math.sin(t*2+e.seed)*.07;e.size*=1.15;}
   if(e.kind==='galli'){e.x=clamp(.1+t/e.life*.8,.08,.92);e.y=.58+depth*.06;}
   if(e.leaper&&t>e.leapAt){const u=clamp((t-e.leapAt)/.55,0,1);e.x+=(.5-e.x)*u;e.y+=(.64-e.y)*u;e.size=d.size*(1.2+.6*u);}
   e.weak=0;
  }
  if(e.dead){e.y+=e.fade*.15;e.alpha*=Math.max(0,1-e.fade/1.1);}
 }
 damage(amount,source=null){
  if(this.invulnerable>0||this.status!=='playing')return;
  this.hp=Math.max(0,this.hp-amount*(this.difficulty==='tour'?.55:1));this.combo=0;this.invulnerable=.6;this.emit('damage',{amount,id:source?.id});
  if(this.hp===0){this.status='continue';this.emit('loss');}
 }
 kill(e,precise=false){
  if(e.dead)return;e.dead=true;e.fade=0;this.kills++;this.combo++;this.maxCombo=Math.max(this.maxCombo,this.combo);this.chainTime=4.5;
  const multi=Math.min(5,1+Math.floor(this.combo/5)),points=TYPES[e.kind].points*multi*(precise?1.5:1);
  this.score+=Math.round(points);this.focus=Math.min(100,this.focus+(e.boss?30:9));
  if(e.boss)this.bosses++;this.emit('kill',{id:e.id,x:e.x,y:e.y,points:Math.round(points),kind:e.kind,boss:e.boss,precise});
 }
 shoot(x,y,aspect=16/9){
  if(this.status!=='playing'||this.cooldown>0||this.phase==='clear')return false;
  this.cooldown=this.focusTime>0?.057:.09;this.shots++;
  const list=this.entities.filter(e=>!e.dead&&e.age>.15).sort((a,b)=>b.size-a.size);
  let target=null,precise=false;
  for(const e of list){
   const projection=this.projector?this.projector(e,aspect):project(e,aspect);
   if(!projection||projection.visible===false)continue;
   // A modeled boss supplies its own ray test against the rig.
   if(projection.test){const part=projection.test(x,y);if(part){target=e;precise=part==='head';break;}continue;}
   const {x:cx,y:cy,w,h,hx,hy}=projection;
   const head=Math.hypot((x-hx)*aspect,y-hy)<Math.max(.035,h*.15);
   const body=((x-cx)/(w*.4))**2+((y-cy)/(h*.46))**2<1;
   if(head||body){target=e;precise=head;break;}
  }
  this.emit('shot',{x,y,hit:!!target,precise,id:target?.id});
  if(!target)return true;
  this.hits++;target.hit=.14;
  if(target.kind==='supply'){
   target.dead=true;this.hp=Math.min(100,this.hp+22);this.focus=Math.min(100,this.focus+25);this.emit('supply',{x:target.x,y:target.y,id:target.id});return true;
  }
  if(target.kind==='barrel'){
   target.hp--;if(target.hp<=0){this.kill(target);this.emit('blast',{x:target.x,y:target.y});
    for(const e of list)if(e!==target&&!e.dead){e.hp-=e.boss?14:20;if(e.hp<=0)this.kill(e);}}
   return true;
  }
  target.hp-=precise?(target.boss&&target.weak?5:3):1;
  if(target.boss&&precise&&target.weak){target.weakHits++;if(target.weakHits>=9){target.age=Math.floor(target.age/6.4)*6.4+6.4;target.weakHits=0;this.emit('stagger',{id:target.id,x:target.x,y:target.y});}}
  if(target.hp<=0)this.kill(target,precise);
  return true;
 }
 activateFocus(){if(this.status!=='playing'||this.focus<100||this.focusTime>0)return false;this.focus=0;this.focusTime=5;this.emit('focus');return true;}
 continueRun(){if(this.status!=='continue'||!this.credits)return false;this.credits--;this.continues++;this.hp=100;this.status='playing';this.invulnerable=3;this.combo=0;this.emit('continue');return true;}
 finish(){this.status='won';this.score+=Math.round(this.hp)*50+(this.continues===0?5000:0);this.emit('win');}
 update(dt){
  if(this.status!=='playing')return;
  dt=clamp(dt,0,.05);this.time+=dt;this.phaseTime+=dt;this.cooldown=Math.max(0,this.cooldown-dt);this.invulnerable=Math.max(0,this.invulnerable-dt);
  const cruise=this.stage.id==='manor'?14:this.stage.id==='fault'?27:24;
  const drive=DRIVE[this.stage.boss],brake=clamp((this.phaseTime-.8)/1.8,0,1);
  this.speed=this.phase==='ride'?cruise:this.phase==='intro'?8+16*clamp(this.phaseTime/3,0,1):drive&&this.phase==='boss'?5+(drive-5)*brake*brake*(3-2*brake):drive&&this.phase==='clear'?drive*(1-clamp((this.phaseTime-.4)/2.6,0,1)):7;
  if(this.focusTime>0)this.speed*=.52;
  this.travel+=dt*this.speed;
  this.focusTime=Math.max(0,this.focusTime-dt);this.chainTime=Math.max(0,this.chainTime-dt);if(!this.chainTime)this.combo=0;
  const pace=this.focusTime>0?.52:1;
  if(this.phase==='intro'&&this.phaseTime>=3){this.phase='ride';this.phaseTime=0;}
  if(this.phase==='ride'){
   this.stageTime+=dt;this.spawnTimer-=dt*pace;this.hazardTimer-=dt*pace;this.supplyTimer-=dt;
   if(!this.beats){const sheet=BEATS[this.stage.id]||[[]];this.variant=Math.floor(this.random()*sheet.length);this.beats=sheet[this.variant].filter(b=>b[0]>=this.stageTime-.5);}
   while(this.beats.length&&this.beats[0][0]<=this.stageTime)this.beat(...this.beats.shift().slice(1));
   if(this.spawnTimer<=0&&this.entities.filter(e=>!e.dead).length<8){
    const roster=this.stage.id==='fault'&&this.stageTime>18&&this.stageTime<23?['ptero']:this.stage.roster,arrival=this.spawn(roster[this.wave%roster.length]);this.wave++;this.spawnTimer=2+this.random()*.9;
    if(arrival.kind==='raptor'&&this.wave%3===1)this.emit('threat',{side:arrival.lane<.5?'right':'left'});
    if(this.stageTime>15&&this.wave%3===0)this.spawn(roster[0],{delay:.4});
   }
   if(this.hazardTimer<=0){this.spawn(this.stage.id==='manor'?'spit':'rock');this.hazardTimer=5.2;}
   if(this.supplyTimer<=0){this.spawn(this.wave%2?'supply':'barrel');this.supplyTimer=12;}
   if(this.stage.setpiece==='bridge'&&this.stageTime>19&&!this.bridgeBroken){this.bridgeBroken=true;this.bridgeOrigin=this.travel+30;this.emit('bridge');for(let i=0;i<3;i++)this.spawn('rock',{x:.27+i*.23,delay:i*.6});}
   if(this.stageTime>=this.stage.duration){
    this.phase='boss';this.phaseTime=0;
    // Let the vehicle pass the remaining waves before the boss arrives.
    for(const e of this.entities)if(!e.dead){e.dead=true;e.fade=0;}
    const boss=this.stage.boss;
    if(boss){if(boss==='twins'){this.spawn('rex',{boss:true,x:.28});this.spawn('rex',{boss:true,x:.72,delay:1});}
     else this.spawn(boss,{boss:true,x:.5});this.bossSpawned=true;this.emit('boss',{kind:boss});}
   }
  }
  for(const e of this.entities){
   e.hit=Math.max(0,e.hit-dt);
   if(e.dead){e.fade+=dt;this.pose(e);continue;}
   const oldCycle=Math.floor(Math.max(0,e.age)/6.4);e.age+=dt*pace;
   if(e.age<0)continue;this.pose(e);
   if(e.boss){if(Math.floor(e.age/6.4)>oldCycle){this.damage(e.kind==='mosa'?25:19,e);e.weakHits=0;this.emit('attack',{kind:e.kind,id:e.id});}}
   else if(e.age>=e.life){
    e.dead=true;e.fade=0;if(e.kind==='spit')this.emit('splat',{id:e.id,x:e.x,y:e.y});if(!['supply','barrel','galli'].includes(e.kind))this.damage(e.kind==='rock'?14:e.leaper?16:9,e);
   }
   if(e.leaper&&!e.leapt&&!e.dead&&e.age>=e.leapAt){e.leapt=true;this.emit('leap',{id:e.id});}
   if(e.kind==='dilo'&&!e.boss&&!e.dead&&e.age>3&&!e.spit){e.spit=true;this.spawn('spit',{x:e.x});this.emit('spit',{x:e.x,y:e.y});}
  }
  this.entities=this.entities.filter(e=>!e.dead||e.fade<1.1);
  if(this.status!=='playing')return;
  if(this.phase==='boss'&&this.entities.every(e=>e.dead)&&this.phaseTime>1.5){this.phase='clear';this.phaseTime=0;this.hp=Math.min(100,this.hp+12);this.score+=1500;this.emit('clear');}
  if(this.phase==='clear'&&this.phaseTime>this.clearHold){
   if(this.stageIndex===this.path.length-1)this.finish();
   else{this.stageIndex++;this.stageTime=0;this.travel=0;this.phase='intro';this.phaseTime=0;this.entities=[];this.spawnTimer=1;this.beats=null;this.hazardTimer=5;this.supplyTimer=9;this.bossSpawned=false;this.bridgeBroken=false;this.emit('stage',{stage:this.stage.id});}
  }
 }
 snapshot(){return{status:this.status,phase:this.phase,stage:this.stage.id,time:this.time,hp:this.hp,score:this.score,shots:this.shots,hits:this.hits,combo:this.combo,focus:this.focus,continues:this.continues,entities:this.entities.map(e=>({...e}))};}
}
export function grade(game){const accuracy=game.hits/Math.max(1,game.shots);return game.status==='won'?(game.continues?'B':accuracy>.65?'S':accuracy>.35?'A':'B'):'D';}
export function recordKey(route,difficulty,continued=false){return `rex-lost-circuit-v1:${route}:${difficulty}:${continued?'continued':'one-credit'}`;}
