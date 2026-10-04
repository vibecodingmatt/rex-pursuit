# Fresh-session handoff: Rex: Pursuit

Updated 2026-10-03. This is the portable entry point for a developer or AI agent from any provider. Read it as ordinary Markdown; no skill loader, proprietary memory, plugin or previous conversation is required. Paths below are relative to the repository root unless stated otherwise.

## Identify the correct project

This repository is **Rex: Pursuit**, package name `rex-pursuit`, remote `https://github.com/vibecodingmatt/rex-pursuit.git`. The known local checkout is `C:\Users\burns\dev\games-playground\rex-encounter`. The user's IDE may be showing `dino-collector/AGENTS.md`; that is a different project.

Read [AGENTS.md](../AGENTS.md) and run these from this checkout before changing files:

```sh
git status --short --branch
git log -5 --oneline
git remote -v
```

Inspect existing changes before editing. Do not switch branches or discard work to match a dated handoff. Current source and the user's latest instructions take precedence over historical notes.

## Latest work and its status

The current feature is **Lost Circuit '94**, a selectable side mode at `arcade.html`, launched from the Rex homepage. It is separate from Pursuit, Safari Run, Containment Breach and Raptor Ravine. The latest runtime checkpoint is **`a397b3b`**, on `feature/lost-circuit-arcade` at this documentation checkpoint. Later documentation commits may follow it.

| Checkpoint | What happened and why |
| --- | --- |
| `d2893fb` | Researched the 1994 Sega Jurassic Park shooter and added four-stage classic / seven-stage extended routes, with modern-film bosses. The first implementation used still scenery and animated image creatures. |
| User feedback | Rejected the small paper-like dinosaurs, arbitrary-looking arrivals, static travel and gunfire disconnected from gun orientation. Explicitly liked the boss fights. Asked for a demanding self-audit against a modern AAA reference and allowed substantial creative freedom. |
| `a397b3b` | Replaced traversal with a moving Three.js world, normal enemies with 3D actors, and the gun with a physically aimed mount. Reworked environments, water, lighting, creature approaches and bridge travel. Preserved the successful boss mechanics and artwork. |
| Roadmap + A1 (2026-10-03) | New [ARCADE-ROADMAP.md](ARCADE-ROADMAP.md): an independent diagnosis and 16 drops (A4–A6 polish the world and creature animation across every stage). A1 replaced the 2D Rex bosses with Pursuit's modeled hero Rex (reverse chase, bite, stagger, physics fall, rig hit tests) and moved world sounds to recorded audio. |
| A4 (2026-10-03) | Ground truth: a blended terrain material (rutted track with puddles, verges, litter floor, rock slopes, wet waterline, paved and canyon variants), CC0 scanned boulders in place of every icosahedron, clumped planting with track clutter and roots, and the bushes that had never drawn. New `src/arcade/ground.js`. |
| A5 (2026-10-03) | Light and air: each stage's own key, fill, haze, grade and sky (misty dawn, river haze, ember canyon, clear afternoon, blue dusk, storm night, moonlight), a layered horizon with volcanoes and cloud banks, shafts on every stage, creature rim light, and lamps that light the ground where they stand. Fixed the user's report of shadows sliding with the vehicle: the canopy dapple and lamp pools are now pinned to the world, and tree crowns cast real shade on the track. Motes, embers, falling leaves, insects and startled flocks fill the air; gusts and passing animals bend the planting. New `src/arcade/light.js` and `air.js`. |
| A6 (2026-10-03) | Creatures in motion: arcade animals lean into turns, gather into a crouch that telegraphs the charge, track the vehicle with their heads, flinch where they are hit, stumble and limp; pteranodons bank, glide and dive; a sculpted, swimming ichthyosaur breaches with spray; the crate, barrel and spit became real objects. New `src/arcade/ichthy.js`, `props.js` and `scripts/build-ichthy.mjs`. |
| A2 (2026-10-03) | Weight: you ride in Pursuit's park Jeep (windshield folded onto the hood, the warden at the wheel) on a spring-damper camera rig with braking dives, cornering roll, bumps and hit knocks; the Jeep shows claw gouges, a cracked windshield and engine smoke as integrity falls; every stage has its own ambience bed and room reverb; a Quality setting with tiers and a frame governor. New `src/arcade/vehicle.js`, `ambience.js` and `quality.js`. |
| A3 (2026-10-03) | Impact: 3D tracers from the muzzle, strikes that match what they hit (dirt, rock, concrete, water, hide, metal, wood), kills that burst in the world and splatter the lens up close, world-anchored chain-coloured score numerals, a reactive reticle and a hit-stop on boss staggers. Also fixed dead arcade animals vanishing instantly. New `src/arcade/impacts.js`. |
| A7 (2026-10-03) | The director: each stage plays one of three seeded beat sheets (raptor flanks, a Gallimimus stampede, pteranodon formations, an ambusher from the brush, paired attackers), called on the radio and by recorded calls. Contact attacks: the flank's lead raptor leaps onto the hood and bites unless shot off, unshot dilophosaur spit smears and blurs the windshield, and the ambusher breaks through a shivering wall of brush. A8 is next. |
| A8 (2026-10-03) | Through the gates: the north gate's timber doors swing open as the Jeep drives through, torches burning on the towers; electric fences with insulators and DANGER plates, and cut wires sparking on the verge; the Triceratops boss is now the 3D Safari sculpt at hero scale, charging, locking her horns on the bumper and shoving the Jeep sideways. New `src/arcade/gate.js`, `sparks.js` and `boss-trike.js`. |
| A9 (2026-10-03) | River of giants: on the water stages you ride the park's tour launch (teak foredeck, bow pulpit, the Jeep's livery) on a floating rig. The river flows toward you, is coloured by depth, and foams at its banks, around rocks, along the bow and in rings from splashes. The launch throws spray sheets off its chines. The 1994 moment: a brachiosaur wades across a gravel ford, lowers her head to the boat and calls, and the launch slows to pass under her belly between her legs. Ichthyosaur breaches and the Rex's footfalls splash, and the Rex's toes plough sheets of spray. New `src/arcade/boat.js`, `water.js`, `spray.js` and `brachio-crossing.js`. A10 is next. |
| A10 (2026-10-04) | The falling world: a lava tube with flowing glowing-crack lava and stalactites; the park's rope suspension bridge (log towers, sagging cables, gappy planks) tears apart plank by plank; 0.6 s of slow motion over the gap and a hard landing; an eruption column and flaming boulders that bounce down the canyon. Heat shimmer over the lava and the canyon floor, ash fall, an eruption that spreads into an umbrella under an ash sky, and the bridge's debris fall as flaming bombs. New `src/arcade/fault.js`. Also on 2026-10-04: the river brachiosaur walks on planted feet (the old walk skated about 3 m a step). |
| A11 (2026-10-04) | Nobody is in control: the Indominus is a 3D animal (the hero Rex re-proportioned with long clawed arms, a narrow skull, osteoderms and brow horns, a pale striped hide) with active camouflage that leaves her eyes lit and drops when she's hit. Innovation Valley gets an elevated monorail with a passing train, a steel geodesic aviary over the road and banners. New `src/arcade/indominus.js`, `src/arcade/promenade.js`. |
| A12 (2026-10-04) | Something in the water: the Mosasaurus is a 3D animal (new sculpt from `scripts/build-mosa.mjs` with a hinged, toothed jaw) that breaches beside the launch, slams down on her side and sends a swell that lifts the boat, resurfaces head-up and lunges into the bite. New `src/arcade/mosa.js`, `src/arcade/boss-mosa.js`. |
| A13 (2026-10-04) | Do not turn out the lights: the Indoraptor is a 3D raptor, black with a gold stripe, that drops through the glass roof, stalks along the walls and leaps onto the hood; the conservatory's raptors come through the roof in bursts of glass; a torch under the muzzle lights where you aim on the night stages. New `src/arcade/boss-indoraptor.js`, `src/arcade/glass.js`. |
| A14, A15 (2026-10-04) | The finale drives up the Visitor Center's steps and smashes through its doors into the rotunda: raptors among a T. rex and a sauropod skeleton, then the two kings smash in through the glass curtain. When they fall the skeletons collapse, the WHEN DINOSAURS RULED THE EARTH banner tears loose, and the camera follows it down. New `src/arcade/rotunda.js`. The cabinet: gamepad play, a CONTINUE? 10-second countdown, a local top ten with three-letter initials, a rank-letter flourish, and an attract mode that plays live gameplay when the menu sits idle. The menu is now a live 3D title: the hero Rex roaring on the Visitor Center's forecourt under the moon (`src/arcade/title.js`). The HUD has a cabinet look: glowing score digits and a HI-SCORE, integrity that turns amber then blinks red with DANGER, credit pips, a pulsing READY, faint scanlines. |
| Extras (2026-10-04) | Power crates: every other supply crate is a power crate, alternating orange explosive rounds (every round counts double for 8 s) and blue spread shot (each round also strikes the two nearest animals for 8 s). Power crates throb, and power rounds fly in their colour. A grenade launcher (right mouse, G, LB or the GRENADE button): three to start, one more per stage and per repair crate. Each stage clear banks an accuracy bonus and +5,000 for no damage. A DAILY RUN toggle plays the Extended Cut on today's seed with its own best and top ten. Perfect stages turn their route dot gold and count on the results screen; the rotunda has stone-hall reverb. Compy swarms pour down the road late on the gates and Innovation Valley stages. The chain multiplier pops and chimes at each step up. Everything after the explosive rounds (spread shot onward, A14's rotunda, the 3D title, the cabinet HUD, grenades) is local only (after the publish). |
| Current assessment | The implementation and automated routes pass their checks. **The AAA quality target is not met. The user has not accepted this rebuilt visual version yet.** The preceding agent's self-audit is not user approval or an independent review. |

Everything through A13, the A14/A15 work above and the explosive rounds was **published on 2026-10-04**, when the user asked to push all recent changes to prod. Work after that is committed locally and not pushed until the user asks again ("ship it" or "push to prod"). A push to `main` automatically deploys GitHub Pages, even for documentation changes. Older release authorizations in [HANDOFF.md](HANDOFF.md) refer to earlier work and do not authorize this feature's release.

## Read only what the next task needs

| Need | Read |
| --- | --- |
| What the user wanted, 1994 research sources, controls, routes and asset provenance | [LOST-CIRCUIT.md](LOST-CIRCUIT.md) |
| **Next arcade upgrade drop** | [ARCADE-ROADMAP.md](ARCADE-ROADMAP.md): read it, then only the files the drop names |
| Honest quality verdict, remaining gaps and evidence limits | [ARCADE-QUALITY-AUDIT.md](ARCADE-QUALITY-AUDIT.md) (2026-10-02; the roadmap's diagnosis is newer) |
| How to change the arcade safely: code ownership, clocks, coordinate systems, rendering traps and checks | [Lost Circuit maintenance reference](../.agents/skills/rex-pursuit-maintainer/references/lost-circuit.md) |
| Other modes and shared systems | [Maintainer skill](../.agents/skills/rex-pursuit-maintainer/SKILL.md), then only its relevant reference |
| Dated decisions and earlier fixes | Latest relevant section of [HANDOFF.md](HANDOFF.md); older sections are history |
| Broader future work | [ROADMAP.md](ROADMAP.md); it is not an instruction to start another feature |

The skill folder `.agents/skills/rex-pursuit-maintainer/` is the maintained, versioned source. Any agent can read its `SKILL.md` and `references/` directly. Agents that support skill discovery may install/copy that whole folder using their own conventions. `agents/openai.yaml` is optional Codex UI metadata; other tools can ignore it. The installed copy under `~/.codex/skills/` is a convenience, not the source of truth.

## Run and inspect

Use Node.js 24 to match CI. On a fresh clone, run `npm ci`. Run `npm start` in a terminal and open `http://127.0.0.1:5188/arcade.html`. Reuse an existing server only after confirming it serves this checkout. `npm run dev` uses the same port; do not start both. Keep this authoring server on loopback.

The source server and test commands are ordinary Node tools. Browser scripts use `playwright-core` and an installed Chrome/Chromium executable; they do not download a browser automatically. The arcade scripts accept `CHROME_PATH` for another executable and `TEST_URL` for a different **base URL ending with `/`**. Their default browser path is Windows-specific. Cross-platform execution has not been validated in this checkpoint.

For focused arcade changes, select the relevant checks in the [maintenance reference](../.agents/skills/rex-pursuit-maintainer/references/lost-circuit.md). A documentation-only change does not need a game rebuild. Broad runtime changes should include pure logic, source arcade flow, spatial/visual review, the existing Rex smoke, build, release-asset checks and the packaged arcade flow. `npm test` alone is not the full suite, and `test:arcade` refers to an older Pursuit check, not Lost Circuit.

## Evidence already obtained

At the runtime checkpoint, both routes passed source and packaged Chrome flows at 1440x900, 390x844, 320x568 and 844x390. Pure rules, Rex smoke, build and release checks passed. The spatial audit checked real travel, rigged actors, extreme muzzle alignment and normal/Overdrive bridge-jump alignment; desktop and portrait images were inspected.

An automated real-time classic run used held mouse fire, mouse aiming and earned Overdrive, without seeking, accelerated time, injected hits or health changes. It finished with **137,930 points, 93 HP and zero continues**. The final bridge placement/jump correction came afterward and was verified separately, including in the final packaged flow. This is completion evidence, not human playtesting or proof of fun.

Screenshots and raw reports live in ignored `art/review/lost-circuit/`; they may not exist on another machine or fresh clone. Recreate them with the scripts instead of claiming to have inspected missing evidence. The roughly 6 ms jungle frame samples are from workstation headless Chrome. Physical-phone performance and Safari/iOS compatibility remain unverified.

## What a next quality pass should address

The biggest unresolved issues are inconsistent art between image bosses, modeled creatures and the scenery kit; visibly repeated environments; limited encounter-specific animation and camera choreography; and a procedural soundscape. The audit explains these in detail. Additional bloom or denser props alone will not resolve them.

If the user asks for further improvement, use those findings to choose a concrete scene or encounter, inspect its current motion and framing, make the change, and compare the result. Preserve the boss attack windows and interruptions the user liked unless the new request changes that direction. Creative freedom applies to Lost Circuit's presentation; it does not require changes to the other modes. Do not interpret this list as a new assignment or claim AAA parity after automated checks.

## Copy into a fresh AI session

```text
Work in the Rex: Pursuit repository (package name rex-pursuit), not dino-collector.
Read AGENTS.md and docs/START-HERE.md, inspect Git status and recent commits,
then follow only the references relevant to my task. These files contain the
Lost Circuit '94 rebuild decisions, current code map, checks, known limitations
and publication boundary. Do not assume the rebuilt visuals have user approval.
My next task is: [describe the change or investigation here].
```
