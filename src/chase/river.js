import * as T from 'three';
// The river ford: one chunk slot of the scrolling road is swapped for a layout
// where a jungle river crosses the track. This module holds the channel's shape
// (shared by the carved ground, the planting, the water surface and the rig)
// and the uniforms the ground and Jeep shaders read.
//
// Chunk-local frame, as in environment.js: x across the road, z along it
// (-14..14), y up. The river runs across the road (along x) with a gentle
// meander. The Jeep drives toward -z, so it enters at the +z bank and climbs
// out on the -z bank; everything after it, the Rex included, follows.

/** Water surface (chunk-local y); the road is at 0. */
export const WATER=-.14;
/** Bed depth below the road where the track crosses (the ford itself). */
const FORD_BED=.56;
/** Width of the sloping bank between the channel floor and the bank top. */
export const BANK=4.6;
const smooth=(a,b,x)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t);};

/** Channel centre line (local z) at x. */
export function riverCentre(x){return 1.1*Math.sin(x*.047+.7)+.45*Math.sin(x*.13+1.9);}
/** Half-width of the channel floor at x: narrow at the ford, wider in the forest. */
export function riverHalf(x){return 4.2+.5*Math.sin(x*.085+2.2)+1.4*smooth(10,40,Math.abs(x));}
/** Distance across the channel from its centre line. */
export function riverOffset(x,z){return z-riverCentre(x);}
/** Floor of the channel: a shallow gravel riffle at the road, deeper pools either side. */
export function riverBed(x,z){
 const ax=Math.abs(x);
 return -(FORD_BED+.55*smooth(7,26,ax))+.035*Math.sin(x*.9+z*.5)+.025*Math.sin(x*.37-z*1.3);
}
/** How much of the terrain the channel replaces: 1 on the floor, 0 at the bank top. */
export function riverCarve(x,z){
 const s=Math.abs(riverOffset(x,z)),half=riverHalf(x);
 return 1-smooth(half,half+BANK,s);
}
/** Carved height at a chunk-local point, from the uncarved terrain height `h0`. */
export function riverHeight(x,z,h0){const k=riverCarve(x,z);return h0+(riverBed(x,z)-h0)*k;}
/** Largest |offset| the channel reaches; the chunk edges (|z|=14) stay untouched. */
export function riverReach(x){return riverHalf(x)+BANK;}

/** Shared uniforms: the wet-ground map and where the ford sits along the road. */
export const FORD={
 // x: 1 while a ford chunk is live; y: its scene z; z: bank surge 0..1 (the Jeep's
 // wake washing up the banks); w: spare. time: a wrapped clock for the bed's caustics.
 map:{value:null},state:{value:new T.Vector4()},time:{value:0},
 // Jeep bodywork soaked by the crossing, 0 dry .. 1 streaming.
 jeepWet:{value:0}
};
/** The wet map covers local x -16..16 and z -60..14: the crossing plus the road the Jeep and Rex drip along afterwards. */
export const WET_MAP={x0:-16,x1:16,z0:-60,z1:14,width:128,height:256};
