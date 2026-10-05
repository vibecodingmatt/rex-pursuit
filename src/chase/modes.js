// Every experience on the homepage, in rail order. `live` modes preview in this page's own
// 3D scene; `video` modes preview with a recorded loop of their own title and gameplay and
// launch their own page straight into play (`?start=1`), returning here with `?mode=<id>`.
export const MODES={
 pursuit:{tag:'CHAPTER 01',name:'Rex Pursuit',short:'Survive the chase',preview:'live',
  eyebrow:'CHAPTER 01 / THE JUNGLE ROAD',title:'Objects in mirror<br>are <em>closer.</em>',copy:'90 seconds to stop her.<br>Break her attacks. Keep the Jeep alive.',cta:'START THE CHASE',
  tip:'Gold targets repel her. Red targets stop debris. R reloads · Space launches a grenade.',touch:'Your crosshair sits above your thumb.<br>Aim with one thumb. Hold FIRE with the other.'},
 ravine:{tag:'CHAPTER 02',name:'Raptor Ravine',short:'Outrun the pack',preview:'video',href:'./ravine.html?start=1',
  eyebrow:'CHAPTER 02 / THE NORTH PASS',title:'Raptor<br><em>ravine.</em>',copy:'The jungle was only the beginning.<br>Chain your kills. Blast the quarry. Unleash Turbo.',cta:'RUN THE RAVINE',
  tip:'Stop leaping raptors to earn Turbo faster. E or TURBO for six seconds of rapid fire.',touch:'Drag to aim, hold FIRE.<br>Tap TURBO when it charges.'},
 safari:{tag:'SCORE ATTACK',name:'Safari Run',short:'90-second hunt',preview:'live',
  eyebrow:'SAFARI RUN / THE JUNGLE ROAD',title:'The jungle.<br>Your <em>high score.</em>',copy:'90 seconds. A jungle full of moving targets.<br>Build a streak. Bag a legend. Beat your best.',cta:'START SAFARI RUN',
  tip:'Hold to fire · R reloads · Space launches a grenade.',touch:'Drag to aim above your thumb.<br>Hold FIRE with the other.'},
 containment:{tag:'HOLDOUT',name:'Containment',short:'Hold the compound',preview:'live',href:'./breach.html?start=1',
  eyebrow:'CONTAINMENT / SECTOR 07',title:'Containment<br><em>breach.</em>',copy:'Hold the compound for two minutes.<br>Break the packs. Repel the Rex. Reach the exit.',cta:'HOLD THE COMPOUND',
  tip:'Stop leaping raptors and charging pachys. R reloads · Space fires a rocket. Shoot blue switches to electrify the yard.',touch:'Drag to aim, hold FIRE.<br>Shoot the blue switches to electrify the yard.'},
 arcade:{tag:'ARCADE',name:'Lost Circuit ’94',short:'Rail-shooter ride',preview:'video',href:'./arcade.html?start=1',
  eyebrow:'LOST CIRCUIT ’94 / THE ARCADE RIDE',title:'Lost<br><em>circuit ’94.</em>',copy:'The park is closed. The ride is far from over.<br>Seven stops, apex bosses and unlimited ammo.',cta:'START THE RIDE',
  tip:'Hold to fire · E Overdrive · G grenade · Shoot crates for power rounds.',touch:'Touch and drag to aim and fire.<br>Tap GRENADE or OVERDRIVE when charged.'}
};
export const MODE_IDS=Object.keys(MODES);
// Recorded previews: a landscape loop and a portrait loop, each with a still poster and a rail thumbnail.
export function previewFiles(id){const base=`./previews/${id}`;return{wide:`${base}-wide.mp4`,tall:`${base}-tall.mp4`,poster:`${base}-wide.jpg`,posterTall:`${base}-tall.jpg`,thumb:`${base}-thumb.jpg`};}
