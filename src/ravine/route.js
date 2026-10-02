export const ROAD_SPEED=8.5;
export const GATE={at:-86*ROAD_SPEED-7,closeStart:1.4,closeEnd:2.35};
export const hash=n=>{const v=Math.sin(n*127.1+311.7)*43758.5453;return v-Math.floor(v);};
export const smooth=(x,a,b)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
// Shared physical cover, present before attackers are allocated.
export const AMBUSH_SITES=Array.from({length:72},(_,i)=>({id:i,side:i%2?1:-1,x:(i%2?1:-1)*(10.5+hash(i+20)*.7),z:55-Math.floor(i/2)*28+(i%2?7:-7),sx:3.35+hash(i+50)*.8,sy:3.05+hash(i+90)*.6,sz:3.8+hash(i+70)*.35,yaw:hash(i+30)*Math.PI*2}));
export const shoulderHeight=x=>Math.max(0,Math.abs(x)-5.6)*.12;
export const gateZ=elapsed=>GATE.at+86*ROAD_SPEED+elapsed*ROAD_SPEED;
