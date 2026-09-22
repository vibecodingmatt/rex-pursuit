# Rex: Pursuit handoff

Checkpoint: 2026-09-22. This release adds six varied roadside trees/branches and the user-approved stomach lawyer reveal, followed by a continuous face-first plunge into acid before blackout. It follows `c225029` (impact blur and gradual vision recovery during player defeat).

## Branch and tree variation (2026-09-22)

- `src/chase/debris-models.js` builds six matching roadside trees and flying branches: forked hardwood, leafy spreading bough, pale crooked limb, weathered deadwood, hanging jungle branch and fine twig fan. Trunk lean, canopy, bark tint, tapered bends, forks, leaves and splintered ends vary. Geometry is built once and batched by material.
- `debris.js` selects from a shuffled bag, using every form before refilling and preventing consecutive repeats across bag boundaries. The selected tree/branch pair stays fixed through contact and flight. The attachment end faces its source on either roadside; projectile path, target radius, flight duration, hit requirements and damage retain their existing rules.
- `npm run test:debris` checks 24 hazards / 48 left-right attachment and release samples, stable appearance, geometry reuse and reset, and captures all six branches in `art/review/debris-variants.png`. Verified locally with `build`, `test:cinematic` and `test:pressure` for desktop first/third person and phone portrait/landscape. Before/after and close-up captures were inspected; no browser errors were reported.

## Late stomach reveal (2026-09-22)

- `src/chase/stomach-guest.js` adds a slumped Gennaro-inspired lawyer at the bottom of the existing throat shot. The user's direct film still is the appearance reference: narrow blue-gray shirt stripes, full sleeves and pale cuffs, a long dark patterned tie, shorts, prominent brows/nose and thinning swept-back hair. Skin and clothing retain the worn, sickly treatment. All geometry and textures are procedural. The user explicitly removed the initial toilet, briefcase and spectacles: none were swallowed/worn in the referenced moment. Keep those props absent.
- Following the user's scale/pose correction, the figure is 40% larger and rests against the side wall with his head tilted toward it, shoulders leaning back and legs partly submerged. The forehead/temple has an inset exposed-bone patch with an irregular dark tissue edge and fine cranial sutures. Check clearance against the shader-deformed wall when changing scale or pose; placing the enlarged figure too far outward cuts through the head.
- His eyes are closed with skin-covered lids and fine creases. The arms hang beside the knees with both hands below the acid surface. A translucent liquid film and depth-based absorption on the figure retain faint hand silhouettes while deeper limbs fade into the murk; world-space depth keeps the waterline level despite the body lean. This refinement passed `build`, desktop/phone reveal-and-fade captures and the focused build check for 30/60/144 Hz, reduced motion, resource reuse and restart, without browser errors.
- The reveal begins after 60% of the slide and becomes clear as the camera enters the wider chamber. A dark olive liquid surface, pooled bubbles/ripples, gentle passive body/tie movement and a quiet synthesized bubbling cue share defeat time. Reduced motion decreases the body/tie movement and bubble rate. The established mouth hold and initial throat descent are preserved; the view turns gently toward the side-wall figure late in the descent to keep him visible on phones.
- The user's requested final plunge replaces the previous stop above the acid. `stomachPlunge()` overlaps the throat exit from 13.70 s, keeps downward motion continuous past the chamber reveal, and tips the view face first toward the pool. The camera crosses the liquid level at `DEFEAT.acidAt` (15.00 s), with continuous velocity into fluid drag. A muffled splash, olive immersion wash and blackout begin at contact; full black is 15.60 s and retry is 16.15 s. Do not fade before contact or reintroduce a hover over the pool. The bubble/ripple meshes have enough segments for the final close-up, and reduced motion lowers the downward tilt while retaining the same entry path.
- `swallow.prepare()` compiles the new interior materials during loading. The scene stays hidden and unrendered during ordinary gameplay; geometry is batched and bubbles/ripples are instanced. Use a hemisphere only at the tube's far end: a full chamber sphere intersects the existing throat and creates black slivers during descent.
- `scripts/verify-defeat.cjs` checks late visibility, digestive/splash cues, actual pause of the guest/liquid/bubbles and the plunge/immersion/fade, restart cleanup, phone face framing and surface crossing before blackout in both orientations. `test-defeat.mjs` checks uninterrupted descent and continuous impact velocity at 30/60/144 Hz. Review captures remain under ignored `art/review/stomach-*` and `art/review/defeat-*`.
- The plunge passed `test:logic`, `build` and the full `verify-defeat.cjs` against the build: 27 desktop checkpoints, all four loss causes, real pause before/during immersion, and both phone orientations. The final immersion shading then passed a fresh build and focused browser checks, including desktop/phone approach/contact/blackout captures, identical camera and guest poses at 30/60/144 Hz, reduced motion, geometry reuse and audio/scene/immersion reset. No browser errors were reported. The current interior plus composite measured 29 draw calls / 83,403 triangles in Chrome; this is not a physical-phone performance measurement. The tie bends outward to stay clear of the shirt, and filtered crown wisps avoid aliasing from tiny hair geometry.
- The combined release passed fresh `test:logic`, `build`, `test:release` and isolated `test:pages` gates, including all 34 sounds, production paths, desktop camera/pause, phone layout and share metadata.

## Defeat vision recovery

- `defeatVision()` in `src/chase/defeat.js` shares the defeat clock. Blur starts at the Rex's impact (1.65 seconds) and ramps up over 0.28 seconds. The user requested twice the initial shock and more visible recovery: strength now steadily decreases throughout the spin and approach, reaching 15% at 8.62 seconds before the final smooth resolve. It clears at 9.12 seconds, just before the 9.22-second lunge. Existing camera, rig, audio and swallow timing are unchanged. Recovery is monotonic, without a hold, flashing or focus pulses.
- `updateVision()` in `src/chase.js` blurs only the world canvas, up to 12 CSS pixels on desktop / 6 on a small phone; reduced motion lowers the strength to 65%. A small scale increase conceals the filter's transparent edges. The fixed `#scene-viewport` wrapper clips that overscan so fractional transforms cannot cause page overflow. Both blur and scale follow the game clock, not CSS transitions, and reset before the bite/interior and on restart. Pause controls and results stay sharp.
- `npm run test:vision` checks recovery timing, real pause/audio suspension, restarting while blurred, victory isolation, clear bite/interior/results, reduced motion and desktop/phone portrait/landscape captures. Review images and reports are ignored under `art/review/vision-*`; the existing full defeat browser check continues to cover all loss routes and the swallow sequence.
- Verified with `test:logic`, `test:vision`, `build` and `verify-defeat.cjs` against the built game. Before/after approach and clear-windup captures were inspected at desktop and both phone orientations. Chrome reported no runtime errors; phone emulation does not establish physical-device performance.
- The final approved strength/recovery passed `test:vision` on desktop, phone portrait/landscape and reduced-motion settings. The release passed `test:logic`, `build`, `test:release` and the isolated `test:pages` check, including all 34 published sounds and production navigation.

## Rear player character

- `src/chase/player-character.js` replaces the old box torso and featureless head with an Alan Grant-inspired field palaeontologist: blue woven work shirt, pockets/collar/stitching, red patterned neckerchief, khaki trousers, belt pouch, boots, sculpted face, eyes, continuous hair surface and a woven pinched-crown hat. Geometry and textures are authored procedurally; no new external model or image download is required. Costume reference: [1993 film stills and outfit study](https://bamfstyle.com/2019/09/14/jurassic-park-alan-grant/).
- Preserve the intact Jeep cage. The player now takes a lower braced stance, with the head/hat below its crossbar and feet inside the rear tub. The head and torso track gun yaw subtly. `jeep.character` exposes the rig; `jeep.gunner` remains its root group for existing visibility checks.
- The exterior reload centers the weapon smoothly, leans the torso toward the cover/can and returns to aim. First-person weapon aiming and the established hand-contact choreography are preserved. Both views share the blue rolled sleeves and bare forearms. Shoulder anchors come from the character rig, with small cloth bridges for IK reach; upper/forearm lengths stay fixed.
- `test:gunner` samples aim limits and reload transitions at 30/60/144 Hz, measures actual head/hat surface clearance against the cage, limits shoulder reach, captures close-ups and third-person desktop/phone views, and checks the real winning arrival and restart. The current 298-pose sweep keeps at least 6 cm of clearance. `test:vehicle` continues to cover reload contact and weapon/driver behavior. Images/reports use ignored `art/review/gunner-*`.

## Victory arrival and results sharing

- `src/chase/victory.js` owns the 20-second win timeline. Preserve the existing Rex fall, pull back into third person from 2.8 seconds, cut locations under full black at 7.2 seconds, drive the Jeep to the entrance by 16.2 seconds, hold, then fade to full black at 19.6 seconds before results at 20 seconds. The combat clock and statistics stop at the winning hit.
- `src/chase/visitor-center.js` reconstructs the JP1 exterior from original set-design elevations, plans and finished photographs: broad concave façade, tapered buttresses, engaged columns, fine turquoise mullions, tiered thatch/clerestories, recessed fossil portal and sunburst doors, stairs, stepped water rills and ramps. Approximate scene dimensions are 59 m wide and 22 m tall, not authenticated set measurements. The Jeep model is unchanged. See [reference and generated-texture provenance](../art/visitor-center-references.md).
- `visitor-materials.js` creates deterministic stone, thatch, gravel, grass, bark and water-normal textures. `visitor-plants.js` builds individual palm leaflets, fern pinnae, folded broad leaves and reeds, with small textured distant branch clusters. `visitor-water.js` supplies the irregular reflecting pond, ripples, veined/notched lily pads, flowers and natural shore. All architectural transforms are baked before batching by material; planting is instanced. Water is kept out of static mesh merging because its reflection depends on its render callback. Reflection targets are 768 pixels desktop / 384 coarse-pointer. Water and wind use the paused game clock.
- The arrival uses a fixed environment and moving Jeep, while the chase uses scrolling scenery. The location change is concealed by the fade. Keep the lower camera, recognizable roof silhouette, generous building scale and detailed foliage; avoid replacing them with round shrub primitives or a flat opaque pond. Portrait framing focuses on the entrance and central roof.
- `src/chase.js` coordinates camera, audio, fades, scenery visibility and lighting from `state.victory.time`. Pause freezes the whole sequence. Restart restores the jungle, Rex, Jeep, shadow framing, fog and overlays. First/third-person controls cannot override the cinematic camera. Phone portrait uses a wider framing; reduced motion reduces the crane travel.
- Both results screens offer **Share the chase** and **Copy game link**. `src/chase/share.js` uses native Web Share when available, falls back to clipboard copying, and exposes a selectable URL if clipboard permission is unavailable. Dismissed share sheets do not report an error. Every shared link uses the public game URL, including during localhost testing. No share is sent without the player's button press and platform share choice.
- `npm run test:victory` covers the timeline at 30/60/144 Hz plus browser captures of the fall, pullback, drive, park, fade and results; pause, restart, win/loss sharing paths and phone portrait/landscape. `TEST_URL` can point the browser check at a build. Review images and the JSON report are in ignored `art/review/`.

The victory and sharing implementation passed `test:logic`, `build`, `test:release`, `test:pages`, `test:build`, and `test:victory` against the build, plus keyboard activation of Share. The reference reconstruction received an additional full victory browser pass and final release checks. Desktop and phone portrait/landscape captures were visually inspected. Native-share and clipboard outcomes were simulated in Chrome; physical-device share sheets were not tested. The approved v2 social artwork is included in this release and remains documented separately.

Production navigation omits the Creature Lab and Sound Library links, including the pause-screen shortcut. `vite.config.js` strips anchors marked `data-dev-only` during builds; source serving and Vite development retain them. The tools remain available by their direct URLs.

## Where to start

- Local checkout: `C:\Users\burns\dev\games-playground\rex-encounter`.
- Repository: [vibecodingmatt/rex-pursuit](https://github.com/vibecodingmatt/rex-pursuit).
- Live game: [Rex: Pursuit](https://vibecodingmatt.github.io/rex-pursuit/).
- [Maintainer skill and code map](../.agents/skills/rex-pursuit-maintainer/SKILL.md).
- [Animation, materials, audio, and mobile lessons](../.agents/skills/rex-pursuit-maintainer/references/animation-and-rendering.md).
- [Local testing and release workflow](../.agents/skills/rex-pursuit-maintainer/references/verification-and-release.md).
- [Gameplay, controls, assets, and attribution](../README.md).

## Product direction

The concept evolved from a stationary encounter into a first-person mounted-gun chase, with a third-person camera showing the park-themed Jeep and its left-seat driver. Keep the cinematic sense of scale, readable arcade targets, and believable creature movement. The user notices small problems in feet, knees, hands, eye focus, jaw timing, and close-up materials.

The main accepted features are:

- A stopped Jeep opening: the Rex breaks through the right-hand jungle, roars, and follows as the vehicle accelerates. Moving roars retain locomotion; audible Rex vocals drive the jaw from their actual audio envelope.
- A 90-second active pursuit deadline with ordered targets, increasing pressure, and branches broken by physical Rex contact before they fly toward the Jeep. No special headshot text or color.
- A midpoint escape feint into the left jungle and a close return from that same side. Concealment comes from foliage along a continuous route, not hiding or teleporting the model. The road verge stays relatively open and vegetation grows denser farther away.
- Persistent bullet/explosion damage, including the face. Skin, wounds, tongue, and eyes have distinct finishes.
- An animated gun feed, ejected cases and links, articulated reload hands, a left-hand steering wheel, and a safari ranger driver visible in third person.
- Touch aiming above the thumb, independent aim/fire pointers, accessible reload/grenade controls, and suppression of selection and long-press callouts.
- A flexible, weighted Rex death fall on victory. Player defeat instead forces first person, knocks the gun away, spins the Jeep once, and ends with the Rex walking up and swallowing the player.

## Recent fixes to preserve

| Commit | Change | Why it matters |
| --- | --- | --- |
| `eba7ce7` | Offset touch aim and independent thumb controls | The thumb must not cover the reticle; holding Fire must not interrupt aiming or select text. |
| `4d3de58` | Curved final approach and rendered throat interior | Turning with the walking path prevents crossed legs; the mouth opens into a 3D interior rather than a prolonged red screen. |
| `38006de` | Low recoil step after the Jeep spin | Foot plants must follow actual road-relative travel while the torso still faces the Jeep, then start a fresh walking cycle. |
| `ca6aba5` | Mouth pause, swallowing head lift, slower descent | The player remains still briefly, then the head lifts before the 3.2-second slide and swallowing audio begin. |
| `27f9a36` | Softer skin highlights | Authored roughness was multiplied down to a glossy surface. The runtime remap preserves texture variation with a drier hide and restrained wound moisture. |

The user specifically liked the eerie throat interior, the improved death fall, and the creature model. Tune the reported issue without replacing those effects or rebuilding the asset by default.

## Verification at this checkpoint

The skin update passed `test:logic`, `build`, `test:release`, and `test:pages`, plus before/after desktop and phone render comparisons of clean skin, wounds, the mouth, and the whole body. The published bundle was checked live with no runtime errors.

The preceding swallow update passed the same logic/build/release checks and the full `scripts/verify-defeat.cjs` sequence against the build: four loss causes, head lift, held interior position, slower slide, audio cue timing, pause, black fade, restart, and phone portrait/landscape framing. The earlier recoil fix passed 15 gait cases across 30/60/144 Hz and varied entry strides.

These are historical results, not substitutes for checking new changes. Chrome phone emulation is not physical iOS/Android testing. Balance simulations are not human playtests. No new feature is implicitly queued by this handoff.

## Local review material

`art/review/` is ignored and may be absent from a fresh clone. This machine currently has useful diagnostics:

- `review-skin.cjs`, `skin-before-*`, `skin-balanced-*`, and `skin-live-*` for comparable material views.
- `defeat-verification.json`, `defeat-*.png`, and `defeat-mobile-*.png` for the final sequence.
- `live-defeat-smoke.cjs` for the published bundle, low recoil step, held mouth beat, delayed audio, descent, blackout, and touch retry.

These local helpers are examples, not required release dependencies. The maintained checks are under `scripts/`. Do not point future instructions at an ignored file as their only source of truth.
