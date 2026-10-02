// Pure arcade rules: simulation time owns every window, including pause/restart.
export const ARCADE={chain:5.5,turbo:6,charge:100};
export const rankFor=score=>score>=24000?'S':score>=16000?'A':score>=9500?'B':score>=4500?'C':'D';
export class RavineArcade{
 constructor(){this.reset();}
 reset(){Object.assign(this,{score:0,chain:0,bestChain:0,chainTime:0,multiplier:1,charge:0,turbo:0,turbos:0,headshots:0,airStops:0,quarries:0,last:null});}
 tick(dt){this.turbo=Math.max(0,this.turbo-dt);this.chainTime=Math.max(0,this.chainTime-dt);if(!this.chainTime){this.chain=0;this.multiplier=1;}}
 kill({head=false,air=false,explosive=false}={}){
  this.chain++;this.bestChain=Math.max(this.bestChain,this.chain);this.chainTime=ARCADE.chain;this.multiplier=Math.min(5,1+Math.floor(this.chain/3));
  const points=(150+(head?100:0)+(air?200:0))*this.multiplier;
  this.score+=points;if(head)this.headshots++;if(air)this.airStops++;
  const ready=this.charge<100;if(!this.turbo)this.charge=Math.min(100,this.charge+20+(head?5:0)+(air?15:0));
  this.last={points,label:air?'AIR STOP':head?'HEADSHOT':explosive?'BLAST TAKEDOWN':'TAKEDOWN',multiplier:this.multiplier,ready:ready&&this.charge===100};return this.last;
 }
 activate(){if(this.charge<100||this.turbo>0)return false;this.charge=0;this.turbo=ARCADE.turbo;this.turbos++;return true;}
 damage(){this.chainTime=0;this.chain=0;this.multiplier=1;}
 quarry(){this.quarries++;this.score+=300;}
 total(won,integrity){return this.score+(won?1000+Math.round(integrity)*10:0);}
}
