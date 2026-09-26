import * as T from 'three';

// Both scenery and steering use this layout. The side-facing inlet is behind
// an opaque perimeter wall, so a full-size animal can start running offstage.
export const ENTRY={front:35,back:44,centre:8.2,halfWidth:1.9,height:4.8,spawnX:19,turnZ:40.5};
export function entryPath(side,windup){
 return new T.CatmullRomCurve3([
  new T.Vector3(side*ENTRY.spawnX,0,ENTRY.turnZ),
  new T.Vector3(side*14.5,0,ENTRY.turnZ),
  new T.Vector3(side*(ENTRY.centre+.3),0,ENTRY.turnZ-.5),
  new T.Vector3(side*ENTRY.centre,0,34),
  new T.Vector3(side*4.6,0,25.5),
  windup.clone()
 ],false,'centripetal');
}
