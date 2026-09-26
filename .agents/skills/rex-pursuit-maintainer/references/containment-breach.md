# Containment Breach

Read for the compound encounter or when reusing its authored attacks. File paths below are relative to the Rex checkout. Current branch/release state and completed checks belong in `docs/HANDOFF.md`; timings in source take precedence over this reference.

## Boundaries and ownership

`breach.html` is a separate Vite entry reached by the main menu's Containment link. It shares renderer, Jeep, dinosaur rigs, audio, effects, weather and pointer controls with Pursuit/Safari, but does not extend their `combat.js` state machine.

| File | Responsibility |
| --- | --- |
| `src/breach/main.js` | Loading, input, cameras, ordered hit routing, scene/audio updates, HUD, results and local best |
| `src/breach/rules.js` | Pure `BreachRound`: weapons, score/integrity, timeline, trap cooldown, Rex distance/stagger and win/loss events |
| `src/breach/director.js` | Three approach lanes, bounded live attackers, crouch/leap/board/bite/retreat, kills and trap/blast selection |
| `src/breach/world.js` | Compound props, fences/gates, lights, electrical arcs, scenery quality and reset |
| `src/breach/style.css`, `breach.html` | Briefing, HUD, touch controls, pause and results |

The first version has three raptor waves and a Rex finale over a two-minute hold, then a four-second escape. Only one raptor leaps or boards at once, with a warning and time to react after landing. The two shootable switches share a cooldown; the yard discharge cannot reach a boarded raptor. A Rex in the yard can be staggered by it. Keep exact ranges/damage/times in the rules/director and describe player-facing changes in README.

No Dilophosaurus support, alternate weapons or recorded control-room speech is implemented here. Radio messages are captions plus existing cues. River Escape is planned in the roadmap; do not treat it as an unfinished part of this mode.

## Integration lessons

- **Authored creatures:** call `critters.updateDirected(dt,{speed})` after setting live transforms/stride. Ordinary `critters.update()` runs Safari steering and will overwrite the paths. The directed API retains shared materials, hit proxies and pooled death physics. Prune actors whose `c.on` is false **before** spawning: the creature pool may reuse the same object, making an old actor reference control a new animal.
- **Pose channel:** the Safari shader interprets negative `aPose.w` as the leap tuck/reach and nonnegative values as death curl. Preserve a negative `c.curl` when killing an airborne raptor, then blend into the physical fall. Torso suspension, toe support, material normals and depth shadows must agree. Existing Safari inputs stay nonnegative.
- **Hit ordering:** `rex.aimHit(ray,out)` returns a point or null. Compute `ray.origin.distanceTo(out)` before comparing it to switch/critter distances. Treating its return value as a number silently discards Rex bullet hits. Aim the visible gun at the actual selected hit point; a fixed short ray distance from the third-person camera points the gun back into the Jeep.
- **Jeep station:** `createJeep(scene,{gunOffset})` moves the pedestal, weapon and gunner together, including weapon reset. The default remains zero; Breach uses -1.31 m to clear the rear landing deck. Moving only the gun's yaw group leaves a floating mount and disconnected arms.
- **Camera clearance:** the front roll bar is at z=-.60. Breach's first-person camera is ahead of it at -.45; placing it behind that tube at eye height fills the middle of the view with an obstruction. The getaway camera also passes inside the opened service gate. Inspect the close attack and escape, not only the menu.
- **Close lighting:** the shared flashlight is tuned for a distant Rex. At arm's reach it clips the raptor's face to white. Breach attenuates the narrow beam near a close attacker and adds a broad work light. Check lit eyes/hide and aim readability at High and Low rather than hiding defects with global darkness.
- **Rex scale/motion:** construct and solve the real rig in world metres. Use the real hit proxies; do not replace it with a scaled presentation group. `rexVisualDistance` eases toward the rules distance to avoid teleporting on stagger. Keep loss/escape authority in `BreachRound`.
- **Preferences/clock:** fixed weather uses `weather.set('night-storm',{instant:true,persist:false})` so entering Breach does not overwrite the other modes' conditions. Pause/backgrounding stops simulation and clears held input. The best is local to `rex-breach-best-v1`; storage failure must not prevent finishing or restarting.
- **Touch:** a landscape phone can be wider than 800 CSS pixels. Show FIRE for coarse pointers as well as narrow layouts, and let gaps in the control row pass aiming gestures through. Reuse the independent aim/fire contacts in `pointer-controls.js`.

## Verification and review

`npm run test:breach` runs pure rules and a browser playthrough: actual aimed raptor kills, shooting the switch, grenade damage, third-person gun alignment, complete legal-weapon win, unattended defeat, restart, local score, pause/blur, trusted simultaneous touch aim/fire, portrait/landscape and Low. Start the source server on 5188 first. `TEST_URL` can point to a root/base directory containing `breach.html`, including `http://127.0.0.1:5188/dist/`; the built-assets-only Pages check is stronger evidence of packaging.

`window.breach` exposes `ready`, `round`, `director`, `critters`, `world`, `rex`, `jeep`, `camera`, `renderer`, `mode`, `view`, `freeze`, `start`, `step`, `aimAt`, `shoot`, `grenade`, `triggerTrap` and `snapshot`. Wait for `ready`, then start with a real click to unlock sound. Freeze for deterministic captures and advance with `step(1/60)`; use the actual Pause UI for pause verification. `aimAt()` takes a Three.js world-space Vector3. Do not use direct state edits as proof that shooting or a complete win works.

Captures are in ignored `art/review/breach/`: `raptor`, `third-raptor`, `grid`, `rex-finale`, `getaway`, results and phone views. These are local review artifacts, not prerequisites available in every checkout. Add `test:safari-motion` when changing shared pose/hit/death code, and the relevant Pursuit/Safari checks when changing their shared modules. See [verification-and-release.md](verification-and-release.md) for focused selection and packaged-site validation. Phone emulation does not establish physical-device performance or player feel.
