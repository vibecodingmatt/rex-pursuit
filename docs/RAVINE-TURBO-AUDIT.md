# Raptor Ravine: visual and arcade audit

2026-10-02. Local overhaul requested by the user. This applies the fidelity principles in [ROADMAP.md](ROADMAP.md) to chapter two; it does not resume Photo Mode or River Escape.

## Findings and executed plan

| Area | Before, observed in the running build | Implemented response |
| --- | --- | --- |
| Visual landmarks | A strong scanned canyon surrounds a plain, untextured viaduct frame. Most of the 86-second route has the same visual rhythm. | Weathered concrete decking, joints, exposed rebar, steel bracing, column protection and a two-sided articulated bridge failure after the Jeep clears it. Three quarry-charge stations create player-triggered explosions and leave damaged bases. |
| Motion | The shared rig, IK, articulated deaths and continuous retreats are worth preserving. Running turns and leap preparation have little weight shift. | Damped turn banking through the pelvis, counterbalancing neck/tail, Jeep-directed gaze, deeper leap preload and asymmetrical reaching arms. Existing foot placement and death dynamics remain authoritative. |
| Feedback | A small kill counter provides little reward for good aim or a last-second save. | World-positioned headshot, takedown and air-stop awards; a live score, visible chain countdown and ×1–×5 multiplier. Brief encounter cards introduce the route beats. |
| Player agency | Shooting and cooldown grenades are the only interventions; the clock defines success. | A 100-point skill charge unlocks six seconds of Turbo on E or touch: a fresh belt, canceled reload, no heat/ammo use, .05-second shot interval and 1.6× bullet damage. Shootable quarry charges clear nearby exposed hunters, with physical cover blocking their blast paths. |
| Replay | The results mainly count survival and kills. | D–S ranks, best chain, headshot/air-stop/quarry totals, and separate fair/cheater arcade boards. Existing chapter unlocks and old score storage remain intact. |
| Finishing and cost | Dry canyon ambience retains a prominent rainforest bed; static roadside objects rebuild over a thousand transforms each frame. | Recorded wind/engine dominate the canyon mix; muzzle flashes light nearby surfaces on Medium and above. Warmer haze/grade and irregular road patches add depth. Roadside transforms are authored once and translated only at wrap boundaries; HUD text updates only when values change. |

## Design rules

- A kill extends the chain by 5.5 simulation seconds. Every three chained kills adds one multiplier step, capped at ×5; a Jeep strike breaks the chain. Body kills start at 150 points, headshots add 100 and an airborne kill adds 200, before multiplying.
- Ordinary kills charge 20, headshots add 5 and air stops add 15. Active Turbo cannot charge itself. Earned Turbo is fair play; cheat use still marks the entire run.
- Quarry stations enter useful firing range around 13, 41 and 67 seconds. Each detonates once, adds 300 points, and damages exposed hunters within 23 metres. Aim assistance includes the detonator face. The stations are optional; ordinary aimed fire can still win the route.
- The bridge warning precedes its failure at 34.1 seconds. Its halves sag from the cliff-side pivots and settle; fragments land along the shoulders. This is an authored structural failure, not a general destruction solver. It does not invent unavoidable vehicle damage or block the shooting lanes.
- All new clocks use simulation time. Pause freezes Turbo, score windows, bridge motion, debris and award labels. Restart clears them. Reduced motion removes the Turbo camera expansion and label rise. Low retains gameplay, uses 40% scenery debris, and disables the new muzzle light.
- New scoring uses `rex-ravine-arcade-scores-v1` / `rex-ravine-arcade-cheaters-v1`. Old Ravine records are preserved under their previous keys rather than mixed with incomparable new totals.

## Verification and limits

Focused pure rules live in `scripts/test-ravine-arcade.mjs`; the browser flow is `scripts/verify-ravine-arcade.cjs` (`npm run test:ravine-arcade`). It checks earned keyboard/touch Turbo, ordinary weapon restoration, actual quarry rays, exactly-once scoring, bridge articulation/debris, pause, full fair wins, ranks, storage, restart and responsive layout. The existing Ravine suites cover ordinary wins/losses, actual campaign continuation, trusted aim/fire touches, concealment, articulated deaths, dismemberment and the gate perimeter.

The dist-only subpath check found a production-only failure: the bundler folded calls through an initially null `api.onEvent` property out of the nested scenery factory, despite the later external assignment. Scenery now exposes an explicit `setEventHandler()` that mutates a closure. Preserve this mechanism; the browser regression asserts both quarry points and the bridge event text, so visible animation alone cannot hide a lost callback.

Completed checks: full existing game logic, the new arcade rules, source Ravine campaign/combat/aftermath/idle-menu suites, source and dist-only arcade browser flows, the original Rex smoke check, production build, and release asset validation. No runtime, shader or asset errors were reported in the passing browser runs.

Before/after views and focused action captures are in ignored `art/review/ravine-turbo/`; existing combat views remain under `art/review/ravine/`. The perfect-aim desktop and phone arcade checks each repelled 41 hunters and accumulated 44,850 combat points. This proves a complete playable route and consistent rules, not a child's difficulty rating.

The matched local Chrome performance probe fixes resolution and actor count, measures simulation plus an explicit render/GPU finish, and compares original Git source against the revision. After HUD/scenery optimization its median was 6.7 → 5.1 ms at High/1600×900 and 5.2 → 4.4 ms at Low/390×844; simulation medians were 2.7 → 1.7 and 2.1 → 1.4 ms. These are short local approach-scene samples, not a guarantee about peak destruction, physical phones or the browser's full presentation/compositing cost. The first unoptimized High sample exceeded the +1.5 ms target, which prompted the HUD caching pass. Raw results and the reproducible probe are in the ignored review folder.

Physical-phone GPU performance, iOS behavior and the final subjective fun/sound judgment still require user play. The upgrade aims for a stronger arcade experience; it does not establish parity with a commercial cabinet budget. This work is local and is not a production release.
