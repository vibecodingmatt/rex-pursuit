# Rex: Pursuit — AAA upgrade roadmap

Started 2026-09-24. The user shared the prompt history behind a viral Three.js ocean scene as inspiration. This roadmap breaks the ideas that transfer to Rex into **drops**. Each drop fits one 5-hour usage window on a $20 plan and leaves something visibly or audibly better that the user can play.

## How to run a drop

- Start a **fresh conversation** in this folder and say: *"Do the next drop in docs/ROADMAP.md."*
- Read this file, then only the files the drop names. Don't re-survey the codebase or read the handoff end to end.
- Finish the "Must" items before any "Stretch" items. If the window runs short, cut Stretch and record where work stopped in the progress log.
- **Shipped 2026-09-24:** Drops 1–5 are live (`8d9fa60`), along with fixes for the menu layout, rain streaks, eye shine and mobile sky precision. Drop 6 is committed on `aaa-upgrade` (not shipped). Next up: Drop 7.
- **Mobile precision:** local headless captures can't show phone-GPU precision bugs. Keep every shader input bounded (no raw ever-growing clocks into noise or hashes). See [Mobile GPU precision](../.agents/skills/rex-pursuit-maintainer/references/animation-and-rendering.md#mobile-gpu-precision-shader-inputs-must-stay-small).
- **Do not push.** Pushing `main` deploys the live game. Commit locally on the `aaa-upgrade` branch at the end of each drop; at ship time merge it into `main`. Publish only when the user says "ship it", and run the full release gate from the [verification reference](../.agents/skills/rex-pursuit-maintainer/references/verification-and-release.md) first.
- Test proportionally. Each drop runs `build`, `test:smoke` and the focused suites it lists. The full browser suite runs only at ship time.
- Keep screenshots to 3–5 comparable before/after captures, saved in `art/review/<drop>/`. For feel and sound, the user plays and judges; that costs fewer tokens than more captures.
- Put every new effect in the quality tiers (`src/chase/graphics.js`), turned off or reduced on Low. Measure cost with `art/review/perf-tiers.cjs` (ignored, local). Budget: at most +1.5 ms per drop on High at 1600×900.
- Gameplay rules, timings and balance (`combat.js`) stay unchanged unless a drop says otherwise.

## What made his scene look AAA (apply to every drop)

1. **Work out the physics before drawing the effect.** Where do particles spawn, how do they move, and what lights them? Most of his corrections were "sprites are blobs" and "that's not how spray forms". Flat billboard puffs are the biggest giveaway that an effect is cheap.
2. **Break up uniformity.** No visible tiling. Irregular dark patches, streaks and placed clutter (pebbles, logs, debris) make a surface look real.
3. **The subtle finishing layer.** Haze, light shafts, ambient occlusion, contact shadows, blended shadow cascades, motion blur, bounce light, faint particles in the air, a custom lens flare, dithered fades instead of pop-in, and anti-aliasing. Each is barely noticeable alone; together they make the scene look real.
4. **World sounds are real recordings.** No synthesized world sounds, sources placed in 3D, subtle footsteps, and audible ambient life.
5. **The world is alive.** Small creatures react to the player.
6. **Every light lights the scene**, including one the player controls (his flashlight).
7. **Performance budget is a feature.** Optimize as you go and tier everything.
8. **Remove artifacts before adding more.** Check for flicker, jitter, z-fighting, shimmer and visible seams from several camera views.

## Already in Rex (don't rebuild)

- **Rendering:** HDR pipeline with ACES, bloom, grade, grain, chromatic aberration and vignette. Ray-marched sun shafts and dappled canopy light. Height fog with a sun glow. Procedural sky with drifting clouds.
- **World and effects:** procedural rainforest with wind sway, light-shaft motes and falling leaves, footfall dust, breath mist, birds that flush from the canopy on a roar, and HDR tracers, sparks and explosions.
- **Engine and sound:** quality tiers with a frame-time governor. Real Rex vocals and footfalls, with jaw motion driven by the audio's amplitude.

**Gaps found 2026-09-24:**

- All world sounds except the Rex are synthesized (`audio.js`): gun, impacts, reload, engine, wind, insects and the branch crack. Panning is stereo only.
- No ambient occlusion or contact shadows, and a single shadow map.
- No motion blur, weather, night lighting or lens flare.
- Particles are billboard puffs.
- No small ground creatures and no parameter or photo UI.

---

## Drop 1: Storm *(flagship visual)*

**What you'll see:** a **Conditions: Clear | Storm** picker in Menu and Pause, stored like Quality.

- A dark, bruised sky with heavier fog.
- Slanted rain streaks that respond to Jeep speed, with splash rings on the road.
- A wet, darker road with puddles reflecting the sky.
- The Rex's hide darkens and glistens.
- Stronger wind in the foliage.
- Lightning that lights up the Rex, plus a visible bolt.

**Must:**
- New `src/chase/weather.js`:
  - Rain as one instanced draw in a camera-relative volume, slanted by velocity.
  - Instanced road splashes.
  - A lightning scheduler with a flash curve, a bolt billboard and boosts to the sun and hemisphere lights.
  - Exports `wetness` and `flash`.
- `atmosphere.js`: storm sky, cloud cover and fog, blended by a 0–1 weather value.
- Ground shader (`environment.js`): wetness darkens albedo and drops roughness; a puddle mask reuses the existing wet patches.
- `rex-skin.js`: wetness uniform with darker albedo and lower roughness. Scales stay; the mouth interior and throat are unaffected.
- Shared plant shader: wind strength follows the weather.
- `graphics.js`: rain density and splash count per tier.
- `index.html` and `chase.js`: the Conditions picker.
- A tiny FPS overlay behind `?fps` for the user's own performance checks.

**Stretch:** raindrops beading and running on the lens in first person (`post.js`), ripple normals in puddles, and rain audio and thunder if those files are already in `audio_reference/drop-audio/` (thunder delayed by lightning distance).

**Checks:** `build`, `test:logic`, `test:smoke`, `test:pressure`. Check performance against the budget. Captures: first person during pursuit, third person, phone portrait, and a lightning frame. Clear must look unchanged.

## Drop 2: Real sound

**Needs:** candidates are already downloaded and screened (2026-09-24) in the ignored `audio_reference/drop-audio/`: 35 CC0 Freesound files in 12 slot folders, `SOURCES.md` (author, license, measurements, TOP PICK per slot) and `index.html` (open from disk to audition). Use the user's picks if they gave any; otherwise the TOP PICKs. The storm rain and thunder are already wired (Drop 1).

**What you'll hear:**
- Real .50-cal bursts with an echo tail off the jungle, and real impacts on hide and dirt.
- A real engine that climbs with speed.
- A living rainforest ambience, branch snaps, and storm rain and thunder.
- The Rex placed in 3D: on headphones, you hear her swing behind you, muffled with distance.

**Must (`audio.js`):**
- An HRTF `PannerNode` for Rex vocals, footfalls and pain calls, following her head and feet. The listener follows the camera.
- Replace the synthesized `gun`, `impact`, `groundImpact`, `reload`, engine, wind, insects and branch-crack sounds with samples. Add variation with round-robin samples and small pitch randomization.
- The gun uses a burst loop, with a tail on release.
- A forest-reverb send using a generated impulse response. That's a room model, not a synthesized sound, so it's fine.
- Ambience ducks under roars. Keep footsteps subtle.
- Trim and normalize with the existing `audio:split` tooling. Processed clips go in `public/audio/`; raw files stay in the ignored `audio_reference/`.
- UI cues (target chimes, warnings) stay as designed sounds unless the user says otherwise.

**Checks:** `test:logic`, `test:smoke`, `test:defeat` (swallow cue timing), `test:victory`. Check that the Sound Library page still loads. The user listens and judges.

**Shopping list:** use Pixabay (where the existing Rex pack came from) or Freesound with the CC0 filter. Put the files in `audio_reference/drop-audio/`; file names don't matter.

| # | Search | Want |
| --- | --- | --- |
| 1 | "50 cal machine gun" / "heavy machine gun burst" | 2–3 bursts plus a single shot, dry if possible |
| 2 | "bullet impact flesh" / "bullet hit meat" | 3–4 short hits |
| 3 | "bullet impact dirt" / "bullet ricochet" | 3–4 |
| 4 | "machine gun reload" / "ammo belt" / "metal ammo box" | 1–2 |
| 5 | "old jeep engine" / "truck driving loop" | a steady driving loop |
| 6 | "tropical rainforest ambience" | a long loop with birds and insects, no music |
| 7 | "wind through trees" | a loop |
| 8 | "tree branch snap" / "wood crack" | 2–3 |
| 9 | "explosion" / "grenade explosion" | 1–2 |
| 10 | "heavy rain loop" and "rain on metal roof" | one of each |
| 11 | "thunder close" / "thunder rumble distant" | 2–3 |
| 12 | "birds flock take off wings" | 1–2 |

## Drop 3: Impact and speed *(effects fidelity)*

**What you'll see:**
- Rounds hitting the road kick dirt and pebbles out in a ricochet cone.
- Hits on the Rex throw hide flecks and a brief dark mist.
- Grenades throw debris chunks under gravity, followed by sunlit rolling smoke.
- Rex footfalls throw clods and leaves, and splash in puddles during a storm.
- Camera motion blur on stomps, the defeat spin and fast turns.
- Smoke fades softly into geometry instead of showing flat sprite edges.

**Must:**
- `effects.js`:
  - An instanced physics-debris pool with gravity, bounce, spin and fade.
  - A soft-particle smoke shader that fades by depth, is lit by the sun direction and uses animated noise instead of a flat texture.
  - Spawn directions work out the physics first (principle 1).
- `post.js`: motion blur from camera velocity, using depth and the previous frame's camera matrices. Off on Low and with reduced motion. It must not double up with the defeat blur in `defeatVision()`.
- The gun already ejects cases and links; improve those only if there's time left.

**Checks:** `build`, `test:smoke`, `test:cinematic`, `test:defeat`, performance. Captures: a road hit, a hide hit, a grenade, and a footfall close-up.

## Drop 4: Grounding *(AO, contact shadows, shadows)*

**What you'll see:**
- Feet, tyres, rocks and roots sit in the ground.
- Deep shade under the canopy and in the folds of the jaw and legs.
- Crisper shadows near the Jeep.
- Foliage fades in instead of popping.

**Must:**
- `post.js`: half-resolution GTAO/SAO from resolved depth with an edge-aware upsample, and screen-space contact shadows along `SUN_DIRECTION` in the same pass. It skips the swallow interior.
- Guard against the flicker he fought on his fishing net: limit AO on alpha-tested leaves and keep it temporally stable.
- Bayer-dithered fade-in for scenery chunks.

**Stretch:** two shadow cascades (near: Jeep and Rex; far: the road window) with a dithered seam. Check first how three's `CSM` would interact with the custom `onBeforeCompile` materials; if it's messy, tighten the single frustum instead.

**Checks:** `build`, `test:smoke`, `test:pressure`, `test:treeline`, performance. Captures: a foot close-up, the Jeep, and a canopy-shade view.

## Drop 5: Night hunt *(gameplay)*

**What you'll play:** two new conditions: **Night**, and **Night + Storm** (the paddock scene).

- A moonlit sky and fog, and Jeep headlights and taillights that cast real light.
- A **gun-mounted flashlight** (F key or touch button) that's your main way of seeing her. The beam casts shadows, her eyes shine in it, and muzzle flashes briefly light the jungle.
- Fireflies.
- Target rings stay readable; incoming wood shows only in light or flashes.

**Must:**
- Night sky, moon and stars in `atmosphere.js`.
- A lighting rig: a flashlight `SpotLight` with shadows that follows the gun aim, a headlight pair, and a muzzle-flash light.
- Eye shine on the Rex's eye material.
- An input binding and a touch button that respects the existing thumb-clearance rules.

**Stretch:** a faint volumetric cone for the beam in fog, and a small score bonus for harder conditions if the results screen supports it.

**Checks:** `build`, `test:smoke`, `test:touch` (new button), `test:pressure`, `test:gaze`, performance. Captures: the beam on the Rex, headlights, and phone.

## Drop 6: Living jungle

**What you'll see:**
- Small compsognathus-like dinosaurs skittering off the road ahead of the Jeep.
- Lizards bolting from rocks.
- Dragonflies and butterflies in the light shafts.
- A distant brachiosaur neck through a canopy gap, with a 3D call.
- Placed clutter so the road isn't uniform: tyre ruts, broken branches, fallen fronds and pebbles.

**Must:**
- New `src/chase/critters.js`: one instanced mesh with a vertex-shader gait, and steering that makes them flee the Jeep.
- Instanced flying insects.
- Clutter in the environment chunks.

**Checks:** `build`, `test:smoke`, `test:treeline`, `test:cinematic` (the opening must still read well), performance.

## Drop 7: Photo mode *(small; can be added to any drop that finishes early)*

Pause, then Photo:

- A free camera with the HUD hidden.
- Sliders for sun azimuth and elevation, conditions, exposure and depth-of-field focus.
- Save a PNG, and share through the existing `share.js`.

This is Rex's version of his parameter UI, and it makes the upgrades shareable.

## Backlog (not scheduled)

- A custom lens flare for the sun in the menu and third person, and an anamorphic muzzle-flash streak.
- A **river ford** segment where the Jeep and Rex throw spray and leave wet banks. This is the closest match to his water work.
- Mud and wetness building up on the Rex over the course of the chase.
- Rain beading on the Jeep bodywork.

## Progress log

| Drop | Status | Date | Notes |
| --- | --- | --- | --- |
| Roadmap | done | 2026-09-24 | Inspiration mapped; nothing shipped. |
| 6 follow-up (user feedback) | committed, not shipped | 2026-09-24 | **Day** is offered again (Day, Storm, Night, Night + Storm); Storm stays the default on a first visit. The menu and pause pickers fit on one row on all 14 audited sizes. **Snowy plants** had three causes, each found by A/B against the pre-Drop 6 build. Fallen fronds and limbs lying flat mirrored the sky; they now drop specular and backlight. The storm's wet verge was a silver sheet; it is now rougher. At night the unshadowed moon rim lit every leaf; leaves now keep a quarter of it. **The brachiosaur is rebuilt** as a sculpted model from `scripts/build-brachio.mjs` (`npm run art:brachio`): about 60 blended anatomical volumes in a signed distance field, meshed at 7 cm (130k triangles, 2.2 MB; 44k and 0.75 MB for Low), with baked AO and crease cavity. Her proportions are Giraffatitan's: tall withers, a deep neck base, a heavy throat, massive columnar legs with padded, clawed feet, and a short tail. The head has the arched nasal crest, glossy eyes, a muzzle and a jaw. The shader adds pebbly scales, hanging folds, throat folds, leg wrinkles, countershading, mottling and saddles, mud up the legs and a wet sheen. The neck and tail bend as joint chains, the jaw opens for her call, and her shadow follows. The **"jelly" wobble** the user saw was her first idle animation (26° head swing, a travelling tail wave). It is now about 7° at 1.5°/s, with a stiff tail under 5°. Measured plant motion is unchanged from before Drop 6. Perf with her on screen: High +0.05–0.4 ms, Low +0.3 ms. Checks: build, test:smoke, test:release, menu and pause audits. Captures: `art/review/drop6/st-v7-montage.png` (studio), `crop-br-clear.png`, `br-v8-montage.png`, `night-fix-montage.png`, `storm-fix-montage.png`. |
| 6 Living jungle | committed, not shipped | 2026-09-24 | New `critters.js`: compies and lizards, one instanced draw each. Their gait runs in the vertex shader from a CPU-wrapped per-instance pose (hip swing, foot lift, tail and spine sway, pecks), and a custom depth material makes the shadows step too. Road packs are flushed by the Jeep into the near verge and watch; her approach flushes them again and about half panic across the track in front of her, which is what the gunner sees (the reference explains why). Lizards bask on verge rocks (perches recorded per layout) and bolt. Alarms come from her footfalls (scaled by speed), bullet strikes, blasts and the opening roar; scattering packs chirp (raptor clips 12/14 pitched up). New `insects.js`: blue morpho, orange and yellow butterflies and dragonflies by day, mostly grounded by rain; at night, moths that steer for the flashlight beam. Wings flap with turning normals. New `brachio.js`: every 900–1400 m, a brachiosaur side-on at the forest edge, neck over the road. As she comes level she lifts her head and calls (clips 30/31) from her head; in the menu she browses beyond the Rex. Track clutter uses its own random stream, so the existing layout is unchanged: pebble drifts and cobbles off the ruts, snapped branches, torn leafy limbs and curled dead fronds. Ruts now vary in depth, with an older wandering pair and chevron tread lugs, and moss no longer grows on the track. New `fauna` tier field (Low .5, Medium .75); critter shadows off on Low. Checks: build, test:smoke, test:treeline, test:cinematic. Perf A/B against the stashed baseline on this machine (busy, so absolute numbers ran high): Storm High +0.1–0.7 ms, Low +0.1–0.4 ms, Night within noise. Captures in `art/review/drop6/`: `crop-cross-0.png` (unseeded crossing), `v3-menu-storm-desk.png`, `probe-brachio-storm--12-30.png`, `v2-zoom-storm.png`, `clutter2-road-clear.png`, with `before-*.png` for comparison. Open: the opening's pack is hard to see at the roar; moths are specks at pursuit speed; the brachiosaur stands still (no walk cycle). |
| Post-ship fixes | shipped 8d9fa60 | 2026-09-24 | From the user's phone play-tests. Hit blinks no longer flicker the night eye shine; the menu stack is anchored above the footer (audited on 14 sizes); rain streaks are capped on screen (`d57d51f`); storm clouds no longer quantize into blocks on mobile GPUs (the cloud scroll wraps on the CPU, with periodic noise). The precision rules are in the rendering reference. |
| 5 Night hunt | shipped 8d9fa60 | 2026-09-24 | The Conditions picker is back: Storm (default), Night and Night + Storm. Clear is still reachable through `rexChase.setConditions`. `weather.js` blends a night value over the storm value; `atmosphere.js` adds stars, a moon with maria low over the road behind the Rex (`MOON_DIRECTION`, which the rim light follows at night), moonlit cloud edges and night environment maps. The faint moon key stays on `SUN_DIRECTION`, so the canopy dapple stays aligned. The grade gets blue shadows, and sunbeam motes fade out (`NIGHT` in `weather-state.js`). New `night.js`: a flashlight spot under the muzzle with a 1024 shadow map (none on Low), switched by F or the touch LIGHT button above FIRE. Switching changes intensity and the shadow auto-update, never the light count, so it doesn't recompile shaders. It also adds one headlight spot between the lit lens pair, a red tail point light, a muzzle light boosted to 32 m, verge fireflies (fewer in rain) and rain streaks that glitter in the beam. Eye shine (`gaze.js`) is retroreflective: it needs the cone, her facing the gun and a viewer near the lamp. In the menu at night the gunner holds the beam on her face. On short landscape screens the two pickers share a row. The rig joins the scene only at night, so switching conditions recompiles once, in the menu or pause. Perf on High at 1600×900: Storm 4.0 ms, Night 4.5, Night + Storm 4.66 (+0.66 ms). Low's steady state is +0.1 ms. Checks: build, test:smoke, test:touch (now also checks LIGHT at night), test:gaze, test:pressure. Every view passes except compact-phone, which also fails on `b7963a1` (grenade coverage, the known flake). All views except compact-phone also pass at night (`TEST_CONDITIONS=night`). Captures are in `art/review/drop5/`. Stretch not done: the beam's volumetric cone (needs a depth-aware pass to avoid hard edges) and the score bonus (the results screen has no score). |
| 4 Grounding | shipped 8d9fa60 | 2026-09-24 | `post.js`: half-res AO (golden-angle spiral, world radius 0.8 m near to 2.6 m far) and a sun contact-shadow march in one pass from resolved depth, gated by the sun shadow map so it never doubles up; 4x4 bilateral blur, depth-aware upsample, faded by fog. A fixed Bayer tile instead of per-frame noise keeps it temporally stable. Leaves and grass write 0.3 to scene alpha (`AO_MASK`), so they cast and receive little AO. Off on Low (Medium 6 samples, High 8, Ultra 12) and during the swallow. Pop-in: a screen-door dither at the chunk ends sat permanently on the far verge (visible in the first capture), so chunk ends fade into the fog instead, and grass tufts grow in by rank rather than popping as the draw count changes. Checks: build, test:smoke, test:pressure, test:treeline. Perf on every tier within headless noise. Captures in `art/review/drop4/` (`cmp-foot.png`, `cmp-jeep.png` are 2x crops). Stretch (shadow cascades) not started: three's `CSM` replaces `onBeforeCompile`, which the plant and Rex skin shaders depend on. |
| 3 Impact and speed | shipped 8d9fa60 | 2026-09-24 | `chunks.js`: one instanced draw of faceted debris (pebble, clod, fleck, leaf, splinter) with gravity, air drag, bounce and road friction in the Jeep frame. Road hits throw a ricochet cone around the reflected round; hide hits spray flecks and a brief dark mist back toward the gun; airborne wood splinters along the round; grenades throw rubble, a base surge and a buoyant, rolling column; footfalls and body impacts kick clods and the odd leaf. `soft-smoke.js`: puffs, smoke and mist as noise-lumped, sun-lit, fogged billboards in a half-res buffer that fades against scene depth. `post.js`: camera motion blur (1/120 s shutter, gated as above). Checks: build, test:smoke, test:cinematic, test:defeat; perf on High within noise (about +0.3 ms). Captures in `art/review/drop3/`. Case/link ejection untouched. |
| 2 Real sound (finish) | shipped 8d9fa60 | 2026-09-24 | HRTF Rex voice following her head, distance muffling, positioned footfalls/hits/distant calls, generated forest reverb send (closed during the swallow). Checks: test:logic, test:smoke, test:defeat, test:victory. No mix tweaks from the user yet. |
| 2 Real sound (mostly) | shipped 770ec45 | 2026-09-24 | All top picks in use (`public/audio/sfx/`): gun shots sliced from recordings with a release tail, distance-delayed hit sounds, reload, wood, explosion, crash, birds, engine/jungle/wind loops. A world bus ducks about 10 dB under Rex calls. Still open from Drop 2: HRTF 3D panning for the Rex and a forest reverb send. Splash fall-back (rim drops, landing rings) and irregular lens drops landed in the same pass. |
| 1b Storm refinements | shipped 770ec45 | 2026-09-24 | Storm is the default and only offered condition (picker hidden). Wet footfalls: droplet streaks, a torn splash crown and lit three-toed mud prints (`mud.js`). Lens drops now splat and fade. |
| 1 Storm | shipped 770ec45 | 2026-09-24 | `weather.js` + `weather-state.js`; Conditions picker; rain, splashes, puddle ripples, wet ground/foliage/hide, lightning + bolt, storm sky/grade, third-person lens beads, `?fps`. Storm audio added afterwards: a rain bed (two detuned, offset copies of a crossfaded loop) and distance-delayed, low-passed thunder from `public/audio/storm/` (CC0, credited in README). Review captures in `art/review/storm/`. Checks: build, test:logic, test:smoke, test:pressure (first run hit the known intermittent compact-phone case; the re-run passed every view), phone portrait and menu captures. |
