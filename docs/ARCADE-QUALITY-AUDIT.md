# Lost Circuit: critical quality audit

2026-10-02. This is the developer's assessment of the rebuilt local version, not an independent review or a claim that automated tests can measure fun.

## Verdict

**It does not yet meet the user's 2026 AAA visual standard.** The original implementation failed the core brief: it presented attractive still artwork but did not convincingly convey a vehicle travelling through an inhabited world. Small scaling cutouts, arbitrary-looking entrances and a disconnected gun were fundamental failures, not small polish issues.

This revision corrects those foundations and makes a playable, materially stronger arcade ride. It should be evaluated as a substantial browser-game iteration. Calling it a finished AAA remake would still overstate the result.

## What was rebuilt and checked

| User expectation | Current result | Assessment |
| --- | --- | --- |
| Sega-style forward movement through terrain | A real curved, rising world; 14–27 m/s sector travel; nearby scenery passes the vehicle; suspension, turns, a bridge jump and falling boards; engine/wind respond to speed | The static-background problem is fixed. The route still needs more surprising camera choreography and authored transitions. |
| Dinosaurs belong in the scene | Weighted 3D raptors and animated modeled wildlife; roadside pacing followed by a turn and charge; conservatory ceiling drops; air/water encounters in water sectors | Stronger depth, grounding and readable origins. Gait transitions and species-specific behavior are still less expressive than a production animation library. |
| Gun follows aim and fires from its barrel | A real rotating mount, moving feed belt, ejected cases, recoil, flash and projected muzzle origin | Corrected. Left, center, right and low aiming pass bore alignment and visible-muzzle checks on desktop and portrait. Captured firing views were inspected. |
| Preserve the successful bosses | Original large boss artwork, attack windows, interruption mechanics and World-era encounters retained | Still the strongest spectacle. Their 2.5D presentation does not share all the lighting, occlusion and reflections of the 3D world. This is the most conspicuous remaining style mismatch. |
| Modern, vibrant environments | Scanned rock surfaces; textured terrain; layered plants; HDR lighting, atmospheric scattering, ambient occlusion, bloom and restrained motion blur; reflective animated water; generated facade textures; aviary dome, monorail, conservatory and thatched visitor rotunda | A clear improvement over both still backdrops and the first coarse 3D pass. Repeated chunks, simple building silhouettes and some procedural surfaces remain visible. Effects do not substitute for bespoke environment art. |
| A fun, complete arcade mode | Two complete routes, continuous fire, precision bonuses, chains, Overdrive, repairs, boss interruptions, loss/continues, records, mouse/keyboard/touch | Complete and testable. Automated wins establish that the game can be completed, not that first-time players will find every wave fair or exciting. |

## Failures found during this revision

The review was used to change the game, not simply describe it. The first 3D pass had coarse canopy blobs, sparse understory, an oversized gun and enemies spending too long at tiny apparent sizes. The next passes replaced the canopy, added vegetation layers, moved the physical mount forward, and changed the normal encounters to pace the vehicle before charging.

The stage review also caught land animals appearing on the river surface, trees intersecting the lava tunnel, seams between water chunks, facade-free repeated buildings, a lagoon that looked like a flooded corridor, and controls falling behind the canvas. Those were corrected. Architectural textures were generated specifically for the 3D surfaces, the lagoon was opened up, and the remaining water surface uses planar reflections. Shared foliage fading was adapted from the original fixed vehicle coordinate system to the moving arcade camera; without that correction, vegetation disappeared later in the route.

## Evidence and limits

- `scripts/test-lost-circuit.mjs` checks deterministic routes, cadence, damage, continues, boss interrupts and record isolation at 30/60/120 Hz.
- `scripts/verify-lost-circuit.cjs` checks actual mouse/touch input, pause/audio, Overdrive, every stage, both complete routes, loss/continue, storage denial and four viewport sizes. Its `CIRCUIT_DIST=1` mode tests only the packaged site beneath `/rex-pursuit/`.
- `scripts/verify-circuit-ride.cjs` checks real travel distance, rigged actors, extreme aim/muzzle alignment, normal/Overdrive bridge-jump alignment and clean shaders/assets. Its five-frame approach sequences and stage/weapon captures are saved under `art/review/lost-circuit/ride-audit/` and were visually inspected.
- `scripts/verify-circuit-live.cjs` runs the classic route in real time with held mouse fire and mouse aiming. It does not seek, fast-forward, change health or inject hits. The completed run finished at 137,930 points, 93 HP and zero continues, with no browser errors. It saves milestone captures and a final run report in `art/review/lost-circuit/live/`. The subsequent correction anchoring the bridge gap and jump to vehicle travel was checked separately under normal speed and Overdrive.
- Workstation headless Chrome sampling measured roughly 6 ms median frame intervals in the audited jungle section. This is a local diagnostic, not a physical-phone benchmark, a minimum-spec guarantee or an input-latency measurement. Reflective water is more expensive than the jungle section.
- Existing Rex smoke, pure logic, build and release-asset checks cover regressions and packaging. Physical iOS/Android devices and Safari have not been validated in this revision.

## What still separates it from the requested quality bar

1. **Art consistency:** the accepted cinematic bosses, authored raptor, procedural species and environment kit do not yet look as though one art team designed and lit every asset together. A coherent hero-creature/material pass would matter more than another screen effect.
2. **Encounter authorship:** there are still repeated side-entry and charge patterns. A production-quality ride needs more unique behavior, anticipation, near misses, environmental reactions, and transitions that tell a continuous story.
3. **World specificity:** the new landmarks help, but long stretches still expose a reusable scenery kit. The visitor plaza, lagoon and conservatory need more individually composed spaces and meaningful damage, rather than merely more prop density.
4. **Animation and sound:** the game needs a wider set of bespoke transitions, physical reactions, spatialized calls and a deliberately scored dramatic arc. The current procedural soundtrack and reused calls establish momentum but do not provide a film-quality soundscape.
5. **Human playtesting:** first-run readability, difficulty, sustained touch comfort and surprise need actual player feedback. Passing a scripted run is not a substitute.

The correct handoff is: **the paper-dinosaur traversal and disconnected muzzle have been replaced, the arcade loop is verified, and the game has received several real visual review passes. The AAA claim is not earned yet.**

## New art

The built-in ImageGen tool produced [architecture-v2.png](../public/arcade/architecture-v2.png). Its exact final prompt and tool provenance are in [architecture-v2-source.json](../public/arcade/architecture-v2-source.json). The atlas supplies visitor-center, modern, conservatory and thatch surfaces; it is applied to moving 3D scenery, not used as a stationary gameplay backdrop. Existing scanned/model asset credits remain in [Raptor Ravine's provenance](RAPTOR-RAVINE.md).
