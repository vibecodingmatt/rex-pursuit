# Lost Circuit '94: AAA arcade roadmap

Started 2026-10-03. The user's goal: Sega's 1994 *Jurassic Park* arcade ride, rebuilt with everything Rex: Pursuit has learned, at a fidelity that shocks people. The current build (`a397b3b` plus docs) is playable and complete. The user's verdict: it "looks like a game developed by a high schooler." This roadmap breaks the upgrade into **drops**: 16 since the 2026-10-03 revision, which added the world and animation polish drops A4–A6. Each drop fits one fresh chat in a 5-hour usage window on a limited plan, and each leaves something visibly or audibly better that the user can play.

## How to run a drop

- Start a **fresh conversation** in this folder and say: *"Do the next arcade drop in docs/ARCADE-ROADMAP.md."*
- Read this file, then only the files the drop names. Skim `docs/START-HERE.md` for status; don't read `HANDOFF.md` end to end, and don't re-survey the codebase.
- `src/arcade/*.js` is written in a dense one-statement-per-line style (100 KB in about 800 lines). Use `grep -n` to find what you need and read with offsets. Printing whole files costs a large share of the window.
- Finish the "Must" items before any "Stretch" items. If the window runs short, cut Stretch and record where work stopped in the progress log.
- **Commit locally on `feature/lost-circuit-arcade`** at the end of each drop. **Never push.** Pushing `main` deploys the live site. Publish only when the user says "ship it" (or "push to prod"), then follow the release gate in the [verification reference](../.agents/skills/rex-pursuit-maintainer/references/verification-and-release.md).
- Test proportionally: `node scripts/test-lost-circuit.mjs`, `npm run test:smoke`, `npm run build`, plus the drop's focused checks. Run the full arcade browser suite (`npm run test:lost-circuit`) only for drops that change flow, input or HUD, and before shipping.
- Keep screenshots to 3–5 comparable before/after captures in `art/review/arcade-<drop>/`. The user plays and judges feel and sound; that costs fewer tokens than more captures.
- Work alone. Don't use helper agents.
- Update the progress log below, the Lost Circuit section of `docs/START-HERE.md`, and the [maintenance reference](../.agents/skills/rex-pursuit-maintainer/references/lost-circuit.md) when a drop changes a module's ownership or a failure mode.

## Why it reads as amateur (diagnosis, 2026-10-03)

Taken from the code and the ride-audit captures, not from the previous self-audit:

1. **The bosses are stickers.** Every boss is a PNG drawn by `puppet.js` on a Canvas2D layer *above* the WebGL scene. They get no scene light, shadow, fog or ground contact, and they draw over the gun: in `live/river-boss.png` the Rex stands on top of the receiver. The finale's two Rexes are the same image. This is the most damaging single problem, because the bosses are the money shots.
2. **The feedback is flat.** Hits are 2D `fillRect` squares, tracers are 2D lines, and score pops are 11 px Arial.
3. **The sound is synthesized beeps.** A gunshot is a noise burst plus a triangle oscillator, and the engine is a triangle wave. Pursuit's recorded .50-cal, impacts, engine, jungle beds and HRTF Rex voice are all unused.
4. **There's no vehicle and no mass.** The camera is a dolly on a sine spline with a sine bob, and the gun sits on a grey slab. A hit only flashes the screen red.
5. **It's a spawner, not a director.** One timer cycles the stage roster every 1.4–2 s. Every land attacker runs the same pace-turn-charge path and damages you automatically at 4.2 s.
6. **The environment is built from a box kit.** Rocks are squashed icosahedra that read as bread loaves. Buildings are instanced boxes, lava is flat orange boxes and fences are thin lines. The terrain is one vertex-coloured brown under one flat fog per stage.
7. **There are no quality tiers.** Pursuit and Breach have `graphics.js` tiers and a frame governor; the arcade has neither.

## The bar

**The over-the-shoulder test:** someone who watches 30 seconds of play should assume it's a console game. In practice:

1. **One world, one light.** Everything in gameplay is a lit 3D object in the scene: no 2D art except the HUD. Every creature casts a shadow, touches the ground, takes fog and takes the stage's light.
2. **Choreograph, don't spawn.** Each attack has an authored origin, a telegraph at least 0.8 s before contact, the contact itself, and a consequence you can see.
3. **Contact sells force.** Creatures touch the vehicle, the vehicle reacts (suspension, dents, glass), and the camera carries the hit.
4. **Real sound, placed in 3D.** Recordings only for world sounds, positioned where they happen. Designed tones only for UI.
5. **Reuse what Rex already proved.** The hero Rex and her death fall, gore pools, debris physics, soft smoke, weather, the Jeep with its livery and driver, the Pursuit road, the visitor center and the Safari sculpts are all shipped and accepted. Adapting them is cheaper and better than reinventing them.
6. **Keep what the user liked.** Boss attack windows, the amber weak point, the nine-hit interrupt, infinite fire, chains, Overdrive and continues all stay.
7. **Performance is a feature.** Every new effect gets a tier fallback. Shader inputs stay bounded for mobile precision ([rendering reference](../.agents/skills/rex-pursuit-maintainer/references/animation-and-rendering.md)).
8. **Judge with same-view captures.** Compare the same moment, camera and size before and after. A passing test doesn't prove that something looks good.

## Already in the arcade (don't rebuild)

- A real curved route with streamed 32 m chunks, the shared foliage kit, the HDR post chain (AO, bloom, volumetrics, motion blur), planar-reflection water, and the bridge collapse anchored to travel (`world.js`).
- Rigged normal enemies from shared critters and flyers with world-space approach paths (`actors.js`), and a physically aimed mounted gun with its muzzle, belt and cases (`weapon.js`).
- Deterministic rules with seeded spawns, chains, Overdrive, continues and records (`rules.js`), plus a full pure and browser test suite.

---

## A1: The King is real *(flagship: 3D Rex bosses)*: done 2026-10-03

**What you'll see:** the River boss and both kings in the finale are the game's hero 3D Rex, the same sculpted, skinned animal as Pursuit.

- She bursts out of the treeline. In the river she wades out of the water.
- The vehicle throws itself into reverse and she chases you.
- The amber window rides her real head. Nine precise hits snap her head aside and she stumbles back. If you don't stop her, her lunge ends in a bite that jolts the vehicle.
- She roars with the real recordings, her jaw synced to them and her voice placed in 3D. Her footfalls shake the camera and kick dust.
- Tranquilized, she goes down face first in Pursuit's physics fall.
- Gunfire, impacts and the engine become real recordings.

**Must:**
- New `src/arcade/boss-rex.js`. It loads `createRex` (`chase/creature.js`) in the background after the menu is ready, and falls back to the 2D boss if the model isn't ready yet.
  - She runs on a moving "treadmill" frame anchored to her world position, so the shared gait sees `roadSpeed` equal to her ground speed.
  - The rules' boss cycle (`e.cycle`, `e.attack`, `e.weak`, stagger) maps to distance, lunge, jaw and recoil. The death fall comes from `DeathMotion` with her frame frozen in the world.
- `rules.js`: the drive speed per boss (reverse for the Rex), a longer clear hold so the fall plays out, and a `projection.test(x, y)` hook so hits use her real body. Pure-rule tests keep the fallback 2D projection.
- `renderer.js`: skip the sprite for 3D bosses, draw the weak-point ring at her projected head, and anchor labels to her head.
- `main.js`: `ChaseAudio` for her voice, footfalls, bite and pain, plus real gun, impact and engine sounds. `RideAudio` keeps the score and UI tones. Pause, mute and reset cover both.
- `effects.js` footfall dust and hide bursts in world space; `ImpactDamage` wounds where rounds land.

**Stretch:** the Triceratops boss as a hero-scale 3D Safari sculpt; splash sheets around her legs in the river. *(Neither was done; the Triceratops moved to A8.)*

**Checks:** `test-lost-circuit.mjs`, `test:smoke`, `build`, `verify-circuit-ride.cjs` and a focused Rex capture script. Captures: the River entrance, a lunge, a stagger, the fall, and the finale twins, on desktop and portrait.

## A2: Weight *(the vehicle, the camera and the soundscape)*

**What you'll see:**
- You ride in Pursuit's park Jeep (`jeep.js`, `park-livery.js`, `park-driver.js`), looking forward over the hood with the driver at the wheel and the gun on its mount. Water stages keep the platform until A9.
- A spring-damper rig drives the camera: braking dives, launch squat, cornering roll, terrain bumps, and hits that knock the camera away from where they came from.
- Damage shows on the vehicle: claw scrapes, dents, a cracked windshield below 50%, and hood smoke below 25%.
- Every stage gets its own ambience bed (jungle, river, cave rumble, lagoon, rain on glass, night insects), with reverb that tightens in the cave and the conservatory.
- A Quality setting with `graphics.js` tiers and a frame governor.

**Must:** a vehicle and camera rig module; tier plumbing into `world.js`, `post` and the actors; ambience and reverb routing through `ChaseAudio`; vehicle damage states.
**Stretch:** a recorded score. Shopping list: CC0 tense percussion or orchestral loops from Freesound or Pixabay, put in `audio_reference/arcade-music/`.
**Checks:** `test:lost-circuit` (HUD and flow), `verify-circuit-ride.cjs` (muzzle alignment must survive the new mount), `test:smoke`, `build`, and performance at 1600×900 on High and Low.

## A3: Impact *(every shot lands in the world)*

**What you'll see:**
- HDR tracer streaks fired in 3D from the muzzle.
- Impacts that match the material: dirt kicks and pebbles on the ground, hide flecks and blood mist on animals, sparks on rock and metal, spouts in water.
- Raptors that die tumble with their momentum and skid (Ravine death dynamics); close kills splatter the lens; spent brass bounces on the hood.
- Score pops become crisp world-anchored arcade numerals coloured by chain.
- A 50 ms hit-stop and a low thump on boss staggers.
- A dynamic reticle: bloom under sustained fire, a hit confirm, and a head marker.

**Read:** `chase/effects.js`, `combat-fx.js`, `chunks.js`, `soft-smoke.js`, `screen-blood.js`, `ravine/death-dynamics.js`, `ravine/wounds.js`, and the arcade `renderer.js`.
**Checks:** `verify-circuit-ride.cjs`, `test:smoke`, `build`, and performance. Captures: a ground hit, a raptor kill, a boss stagger, and the reticle at rest and firing.

## World and animation polish *(cross-cutting, every stage)*

The stage drops (A8–A14) build each stage's set pieces. These three raise the **shared kit** that every stage stands on: the ground, the light, and the way every regular creature moves. They come before the stage drops, so each set piece lands on a polished world instead of being dressed up alone.

For all three:
- Take baseline captures *before* changing anything. Run `verify-circuit-ride.cjs`, which seeks every stage at fixed points, and copy `art/review/lost-circuit/ride-audit/` to `art/review/arcade-<drop>/before/`. Afterwards, compare the same frames.
- Keep every shader input bounded. Arcade travel reaches about 900 m, so feed noise chunk-local or wrapped coordinates, never raw world z. See [mobile precision](../.agents/skills/rex-pursuit-maintainer/references/animation-and-rendering.md#mobile-gpu-precision-shader-inputs-must-stay-small).
- Changes to shared Pursuit modules (`foliage.js`, `critters.js`, `flyers.js`, `environment.js`) can alter Pursuit and Safari, so prefer an arcade adapter. If a shared file must change, also run that mode's focused check (`test:treeline`, `test:wildlife`, `test:safari`).

## A4: Ground truth *(terrain, road, rock and ground cover)*: done 2026-10-03

**What you'll see:**
- **The ground stops being one brown sheet.** A blended terrain material gives packed dirt on the track, grass and moss on the verges, dark damp soil under trees and bare rock on slopes. Large-scale colour variation hides any tiling.
- **The track looks driven on.** It gets ruts, tyre tracks, puddles that reflect the sky, and clutter along its edges: pebbles, snapped branches and fallen fronds. These come from Pursuit's road (`chase/environment.js`). Port the material and clutter generators, not its chunk system, which assumes the Jeep's moving frame.
- **No more bread-loaf rocks.** Every squashed icosahedron becomes a scanned outcrop or boulder variant. That covers roadside rocks, river banks, the canyon floor and the thrown rocks. Each is buried at the base, rotated and scaled, with moss on top and contact shadow where it meets the ground.
- **Ground cover with structure.** Plants grow in clumps rather than scattered evenly, at varied heights, with leaf litter and roots between them.

**Read:** `world.js` (`makeChunk`, `materials`, `palettes`), the ground and road parts of `chase/environment.js`, `foliage.js`, `public/models/ravine-outcrop.glb`, and the Poly Haven textures in `public/textures/ravine/`.
**Checks:** `verify-circuit-ride.cjs` (every stage, before and after), `test:smoke`, `build`, and performance at 1600×900 (budget: +1.5 ms on High).

## A5: Light and air *(sky, light, depth and ambient life)*

**What you'll see:**
- **Each stage has its own light.** A key and fill per stage with a deliberate grade replaces today's flat green-grey: misty dawn at the gates, humid haze on the river, ember light in the canyon, a cold blue lagoon dusk, a storm-dark conservatory and a moonlit finale.
- **The horizon has depth.** Each stage gets layered distant ridgelines, volcanic peaks and cloud banks with aerial perspective, so the far view stops dissolving into fog.
- **Light you can see.** Sun shafts fall through the canopy and through dust in the canyon. Creatures get rim light, and practical lamps glow and throw pools of light on the ground.
- **The air is alive.** Motes drift in the light, insects and butterflies fly and leaves fall (`chase/insects.js`). Birds burst from the canopy as you pass or when a big animal moves (`chase/birds.js`).
- **Plants react.** Fronds and grass bend aside as the vehicle and running animals push through them. The wind blows in gusts instead of a steady sway.

**Read:** `world.js` (`setStage`, `sync`, `palettes`, practical lights), `chase/atmosphere.js`, the `post.js` settings, `foliage.js` (its wind and plant-bend shader), `birds.js`, `insects.js`.
**Checks:** `verify-circuit-ride.cjs` (every stage, before and after, desktop and portrait), `test:smoke`, `build`, and performance. If `foliage.js` changes, also run `test:treeline`.

## A6: Creatures in motion *(animation polish for every regular creature)*

**What you'll see:**
- **Raptors, dilophosaurs, Gallimimus and Triceratops move like animals.** They lean into turns and gather into a 0.3 s crouch before a charge, which doubles as the telegraph. Their heads stay steady while they run and turn to track the vehicle. Their tails counter-swing, and they pant while pacing alongside.
  - The shared critters already lean, but the arcade's directed path bypasses it: `actors.js` writes `c.yaw`, `c.phase` and `c.v` directly. Reconnect the lean through an adapter.
- **Hits read on the body.** The flinch follows where the round landed: the head snaps on a head hit, the body twists on a flank hit. Heavy hits make an animal stumble, and a wounded one limps.
- **Flyers fly.** Pteranodons bank into turns, glide between flaps and tuck into dives. Today `actors.js` overrides `flyers.js`'s own banking with a fixed sine roll; hand the attitude back to `flyers.js`.
- **The ichthyosaur becomes an animal.** Right now it's spheres and cones from `makeProp` in `actors.js`. Build a real sculpt with a script in the style of `scripts/build-safari.mjs`. Give it a spine wave, fin strokes and a leap that breaks the surface with spray.
- **Props become objects.** The supply crate and explosive barrel get bevelled models with decals and tumble when hit. Thrown rocks use A4's scanned boulders and trail dust. Spit becomes a glossy, stretching blob with a trail.

**Read:** `actors.js`, the directed-update and pose code in `chase/critters.js` and `flyers.js`, `raptor-models.js`, and `scripts/build-safari.mjs` for the sculpt pattern.
**Checks:** `verify-circuit-ride.cjs` (its five-frame approach sequence, before and after), `test:smoke`, `build`, and `test:wildlife` or `test:safari` if a shared module changed. Capture one short sequence per species: approach, turn, charge and hit.

## A7: The director *(authored encounters)*

**What you'll play:** each stage runs from a beat sheet instead of a roster timer.

- A raptor pack flanks the vehicle and one leaps onto the hood. It's a contact attack with its own animation: shoot it off before it bites.
- Dilophosaur spit hits the windshield and smears your view.
- A Gallimimus flock of 20–30 stampedes across the road ahead.
- Pteranodons dive at the camera in formation.
- An ambusher bursts through a wall of branches.
- Every attack is telegraphed by sound and motion at least 0.8 s ahead. Three seeded variations per stage keep runs different but deterministic for tests.

**Must:** beat-sheet data and a pure director in `rules.js`, contact attacks in `actors.js`, and updated `test-lost-circuit.mjs` timing assertions. Keep the boss mechanics unchanged.
**Checks:** `npm run test:lost-circuit` and `verify-circuit-live.cjs`. The automated classic run must still finish without continues on Arcade.

## A8: Through the gates *(the opening set piece, plus a 3D Triceratops)*

**What you'll see:** the opening stage's own moments, built on the world kit from A4–A6.

- The great wooden gate with burning torches swings open as you drive through.
- Electric fences with insulators, warning signs and sparking cut wires.
- The Triceratops boss becomes the 3D Safari sculpt at hero scale. It charges, locks its horns on the bumper and shoves the vehicle sideways.

**Read:** `world.js` (the gates stage and its landmark gateway), `safari-models.js`, `critters.js`, `actors.js`.
**Checks:** `verify-circuit-ride.cjs` (environment captures), `test:smoke`, `build`, and performance.

## A9: River of giants

**What you'll see:**
- A park tour boat with a proper hull, wake and bow spray.
- A living river: flow toward you, foam lines at the banks and rocks, colour by depth, wet shores.
- The 1994 moment: a Brachiosaurus walks across the river and the boat passes under her belly.
- Ichthyosaurs leap with real splashes, and the Rex from A1 wades in a sheet of spray.

**Read:** the water section of `world.js`, `chase/river.js`, `ford.js` (spray and foam methods), `brachio.js`, `actors.js`.

## A10: The falling world

**What you'll see:**
- A lava tube with real lava: flowing crust with glowing cracks, heat shimmer and embers, plus stalactites and scanned walls.
- An exit into a volcanic canyon under an ash sky with an eruption column, and flaming boulders that bounce with physics.
- A real rope suspension bridge with sagging cables that tears apart plank by plank under you.
- The jump: 0.6 s of slow motion over the gap, then a hard landing.

**Read:** the cave, canyon and bridge code in `world.js`, `soft-smoke.js`, `chunks.js`. Keep the bridge gap anchored to travel; the slowed-bridge test must still pass.

## A11: Nobody is in control *(Indominus and the promenade)*

**What you'll see:**
- Indominus as a true 3D animal. It reuses the hero Rex rig, re-proportioned: longer arms and claws, a narrower skull with brow ridges, a pale hide with dark striping, and osteoderms.
- An active-camouflage shader that gives refraction shimmer and Fresnel edges, and drops when she's hit.
- The promenade, monorail and aviary rebuilt as modeled pieces instead of boxes.

**Risk:** re-proportioning a skinned rig can break the gait IK. Prototype the bone scaling in `creature-lab.html` first, and fall back to hide, shader and silhouette props if it fights back.

## A12: Something in the water *(Mosasaurus)*

**What you'll see:** an open lagoon. The Mosasaurus (a new sculpt from a build script in the style of `scripts/build-brachio.mjs`) breaches beside the boat, raises a displacement wave and a rain of spray, and slams back down. Its bite window keeps the existing interrupt.

## A13: Do not turn out the lights *(conservatory and Indoraptor)*

**What you'll see:**
- The conservatory at night in a storm (`weather.js`), with lightning through the glass and a flashlight beam from the gun (`night.js`).
- Raptors crash through the glass roof, and the panes shatter.
- The Indoraptor is the shared raptor rig re-proportioned and reskinned black and gold, stalking along the walls.
- The conservatory is rebuilt as a real glasshouse.

## A14: When giants ruled *(the finale)*

**What you'll see:**
- The visitor center from `chase/visitor-center.js`: you drive up the steps and into the rotunda.
- Raptors among the skeleton displays, then both kings burst in.
- The "When dinosaurs ruled the earth" banner falls and the skeletons collapse.
- A closing shot leads into the results.

## A15: The cabinet *(presentation)*

**What you'll see:**
- An attract mode built from live 3D gameplay, with a 3D title that replaces the 2D Rex key art.
- A HUD redesign in an arcade-cabinet style, with a rank-letter flourish on the results screen.
- Three-letter initials on a local top-ten board, and a "CONTINUE? 9…" countdown.
- Gamepad support.

**Stretch:** local two-player co-op with a second reticle on a gamepad. The original cabinet had two players.

## A16: Ship gate

Physical phone performance and the Low tier, Safari/iOS, the full verification suite, and a release only when the user says "ship it".

## Backlog (not scheduled)

- Seat-rumble "moving seat" emulation: haptics on gamepads and phones.
- A branching route choice at the River (the original offered none; it would be new).
- Daily seeded challenge runs.

## Progress log

| Drop | Status | Date | Notes |
| --- | --- | --- | --- |
| A1 The King is real | local, `feature/lost-circuit-arcade` | 2026-10-03 | New `boss-rex.js`: Pursuit's hero Rex as the River boss and both finale kings. It loads after the menu; the 2D boss covers until then.<br>**Motion:** a sandbox frame keeps the shared gait and `DeathMotion` exact (see the arcade reference). She stands and roars at 24 m, the vehicle brakes and reverses (rules `DRIVE` rex -9, twins -8), she charges at up to 19 m/s, stalks through the weak window, then lunges. The bite opens as the window closes and snaps at the rules' damage. Nine head hits make her reel (`stunned` pose) and stop. Tranquilized, she falls face first and the camera cranes up during a 5 s clear. She wades at -0.85 m in the river; twins sit ±3.5 m apart (narrower in portrait).<br>**Hits:** the rig's ray test, precise within 1.25 m of the head bone, then an exact skinned ray for wounds; amber ring and labels at her projected head.<br>**Sound:** `ChaseAudio` gives recorded gunfire, flesh impacts, engine and wind, and HRTF roars, bite, pain and footfalls with jaw sync. Dust, spray and camera shake follow her feet. `RideAudio` keeps the score and UI tones. Boss cards sit above her, and the clear card waits 2.1 s.<br>**Checks:** test-lost-circuit.mjs, `npm run test:lost-circuit` (full flow, four viewports), verify-circuit-ride, test:smoke, build, test:release, dist flow. Frame interval with one or two Rexes matched the plain jungle (4.2 ms median, headless). Captures: `art/review/arcade-a1/`.<br>**Not done:** the Stretch items (3D Triceratops, river splash sheets). Hit sparks are still 2D (A3). The X3595 shader warning seen under ANGLE wasn't investigated. |
| A4 Ground truth | local, `feature/lost-circuit-arcade` | 2026-10-03 | New `ground.js`: one blended terrain material and the chunk scatter. Outdoor stages lose the separate road strip and the coarse vertex-coloured sheet.<br>**Ground:** a dense terrain grid with analytic normals carries route-space coordinates (lateral offset, z wrapped every 256 m at a chunk seam). The shader paints a packed-dirt track with continuous and wandering ruts, a crown, puddles that mirror the sky with a wet rim, grass and moss verges, and leaf litter with damp patches under the trees. Rock covers the slopes (side-projected sandstone on the canyon and gorge walls), the waterline gets a wet band, and large-scale noise hides tiling. Hybrid and visitor get weathered concrete with joints, patches, an edge line and litter along the kerbs; the canyon gets ash and scree. Scanned CC0 textures (Poly Haven): Forest Ground 05 for the track grain, Forest Ground 01 for the verge, Brown Mud Leaves 01 for the floor.<br>**Rocks:** `arcade-rocks.glb` (`art/prepare_arcade_rocks.py`; Rock Moss Sets 01/02 and Boulder 01, CC0) replaces every icosahedron, including the thrown-rock prop. Rocks sit in groups, buried at the lowest ground under them, rotated and tilted, with moss on top faces, a damp dark base and a contact-shadow decal. Each chunk shows two boulders and two stones, and switches to a far LOD beyond 70 m. River groups straddle the waterline; the canyon gets talus and cave-floor blocks. The loaves that floated beside the bridge over the gorge are gone.<br>**Cover:** planting gathers in clumps (fern beds, shrubs, tree ferns, grass meadows) with grass skirts and gaps of litter. Pursuit's track clutter (pebbles, snapped branches, torn limbs, dead fronds) is merged per material. Surface roots fan from the giant trees, and undergrowth covers the far slopes. Bushes now draw: since the rebuild they had instanced a missing `wood`/`leaves` pair and rendered nothing.<br>**Contact:** `landY` is the one land surface for terrain, trees, rocks and land creatures (`groundAt`); the water stages keep the old reference for swimmers and flyers. Fallen fronds no longer turn into grey "snow" slabs (the leaf shader now detects litter by height above the plant's root). The river mirror pass skips ground clutter.<br>**Checks:** test-lost-circuit.mjs, test:smoke, build, test:release (now lists the ground assets), verify-circuit-ride (before and after in `art/review/arcade-a4/before`, `after`). Same-method render cost at 1600×900 against the old build: gates +0.25 ms, river +0.3, fault +0.65, hybrid −0.3 (budget +1.5).<br>**Not done:** the conservatory's marble floor is unchanged (A13), and the cave floor is plain (A10). Puddles mirror the shared environment map's blue sky, not each stage's sky (A5). Dead palm fronds still read slightly yellow in strong sun. No stage throws rocks yet (A6/A7). Phone performance is unmeasured (A16). |
| Roadmap revision | done | 2026-10-03 | At the user's request, added a world and animation polish section ahead of the stage drops: A4 Ground truth, A5 Light and air, A6 Creatures in motion. Later drops renumbered A7–A16. The generic road, rock and light work moved out of the gates drop (now A8). |
| Roadmap | done | 2026-10-03 | Diagnosis from code and captures; 13 drops. |
