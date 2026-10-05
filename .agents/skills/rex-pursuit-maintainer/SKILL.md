---
name: rex-pursuit-maintainer
description: "Maintain, diagnose, visually verify, or publish Rex: Pursuit in games-playground/rex-encounter, including Lost Circuit '94, Raptor Ravine, Pursuit, Safari Run, Containment Breach, shared creatures and mobile controls. Use for this game rather than Dino Defense, War Survival, or Approach Orlando."
---

# Rex: Pursuit maintainer

Use the existing game and rig as the starting point. The user values believable, continuous motion and movie-like scale, and has accepted the Jeep and creature. At the user's request (September 2026) the victory fall is now a face-first physics fall with ground effects, and the swallow interior is a shorter, deliberately graphic esophagus/stomach sequence; tune those rather than reverting them. Follow the requested change rather than rebuilding those systems.

Those accepted visuals concern the original Pursuit mode. For Lost Circuit '94, the user explicitly permits a new art direction, rejected the first static/cutout implementation, liked its boss fights, and has not yet accepted the rebuilt 3D traversal. Read the arcade reference instead of carrying acceptance claims from another mode.

## Locate and orient

The known checkout is `C:\Users\burns\dev\games-playground\rex-encounter`; if working elsewhere, identify it by `package.json` name `rex-pursuit` and its Git remote. This is a standalone repository inside `games-playground`.

Read its `AGENTS.md` and `docs/START-HERE.md`, then inspect current source and Git status. Use the latest relevant section of `docs/HANDOFF.md` for dated decisions, not as an instruction to repeat completed work. Public repository: `vibecodingmatt/rex-pursuit`; site: `https://vibecodingmatt.github.io/rex-pursuit/`.

This skill and its references are ordinary Markdown usable by any provider. A skill loader and `agents/openai.yaml` are optional. Resolve code/doc paths against the checkout, not an installed skill folder; the repo's startup guide contains the cross-provider reading order and session prompt.

## Code map

| Task | Main files relative to the checkout |
| --- | --- |
| Homepage hub: the five-mode rail, mode copy and options, live/recorded previews, launch and return URLs | `src/chase/hub.js`, `modes.js`, `hub.css`; loops in `public/previews/` (`scripts/previews/README.md`); entry scripts in the `<head>` of `ravine.html`, `arcade.html`, `breach.html` |
| Game entry, camera, frame clock, pause, event/audio cues | `index.html`, `src/chase.js`, `src/chase.css`, `src/chase-premium.css` |
| Lost Circuit '94: classic/extended arcade routes, moving world, normal actors, aimed gun, 2.5D bosses and records | `arcade.html`, `src/arcade/`; read the [Lost Circuit reference](references/lost-circuit.md) and `docs/ARCADE-QUALITY-AUDIT.md` |
| Raptor Ravine: campaign chase, shared authored raptor and scanned cliffs | `ravine.html`, `src/ravine/`, `src/chase/raptor-models.js`; read `docs/RAPTOR-RAVINE.md` and `docs/RAVINE-TURBO-AUDIT.md` |
| Containment Breach: compound holdout, raptor leap/board attacks, electrical trap, Rex charge and gate escape | `breach.html`, `src/breach/main.js`, `rules.js`, `director.js`, `world.js`, `style.css`; read the [Breach reference](references/containment-breach.md) |
| HDR post pipeline, quality tiers, dynamic resolution | `src/chase/post.js`, `graphics.js`, quality wiring in `src/chase.js` |
| Sky, environment light, fog, canopy dapple/shafts | `src/chase/atmosphere.js` |
| Rainforest plants, wind shader, ground | `src/chase/foliage.js`, `environment.js` |
| Hide finish, mouth interior, teeth, cornea | `src/chase/rex-skin.js` (composed via `damage.js`) |
| Combat/creature particles, flock | `src/chase/effects.js`, `birds.js` |
| Shared blood/tissue, ground splatter, direct-hit sculpt breakup and temporary camera droplets | `src/chase/combat-fx.js`, `breakup.js`, `screen-blood.js`; both game entries own update/reset/quality |
| IDKFA input and run flags; separate browser-local fair/cheater records | `src/chase/cheats.js`, `scoreboard.js`, `safari-rules.js`, `safari-ui.js`; `combat.js`, `src/breach/rules.js` for ammo rules |
| Compies, lizards, insects, brachiosaur; track clutter | `src/chase/critters.js`, `insects.js`, `brachio.js`; clutter in `environment.js`, `foliage.js` |
| Shooting wildlife and the bag: compy, lizard and Gallimimus kills (`critters.js` kinds, `herd`, `stream`), pterosaurs on trunk roosts and in the corridor (`flyers.js`; roosts from `foliage.js`/`environment.js`), birds (`birds.js`), the brachiosaur's rear-up (`brachio.js`); routing, tally and results line in `src/chase.js`, `bag` in `combat.js` | see the Living jungle reference |
| Safari Run: rules, streaks, ranks and cookie (`safari-rules.js`); spawning and the title parade (`safari-director.js`); HUD, field guide, results (`safari-ui.js`, `safari.css`); world kill points and tags (`safari-fx.js`); baked sculpts and their scale shader (`scripts/build-safari.mjs`, `safari-models.js`, `BAKED`/`SKIN_GLSL` in `critters.js`; the Gallimimus is baked there too); mode switch and title scene in `src/chase.js` | `src/chase/safari-*.js`; see the handoff |
| River ford: channel, layout slot, water, spray, wet ground | `src/chase/river.js`, `ford.js`; ford layout and ground shader in `environment.js`; splash and river sounds in `audio.js`; `scripts/prepare-ford-audio.cjs` |
| Mud and wetness the Rex gathers over the chase | `src/chase/rex-coat.js` (drawn in `rex-skin.js`) |
| Brachiosaur shape and baked High/Low meshes | `scripts/build-brachio.mjs`, `public/models/brachio.bin`, `public/models/brachio-low.bin` |
| Rules, pressure, damage totals, objectives, deadline | `src/chase/combat.js`, `src/chase/targets.js` |
| Rig orchestration and layered poses | `src/chase/creature.js` |
| Walking/running, plants, swing arcs, IK | `src/chase/locomotion.js` |
| Foot roll, toe peel, curl and spread | `src/chase/foot-motion.js` (driven by `locomotion.js`) |
| Rex victory fall and settling (physics rig) | `src/chase/death-motion.js` |
| Fall ground effects: furrows, bow wave, mound, mud coat | `src/chase/skid.js` (via `effects.js`, `mud.js`; coat in `rex-skin.js`) |
| Player defeat, Jeep spin, approach, bite/swallow timing | `src/chase/defeat.js`, camera/cues in `src/chase.js`, pose in `creature.js` |
| Throat geometry, interior camera, composite | `src/chase/swallow.js` (path in `defeat.js`, shared GLSL in `tissue.js`) |
| Stomach, acid, debris; digested guest | `src/chase/stomach.js`, `stomach-guest.js` |
| Persistent wounds and skin roughness | `src/chase/damage.js`, skin setup in `creature.js` |
| Shared tongue finish and eye focus | `src/creature-materials.js`, `src/chase/gaze.js` |
| Opening, jungle feint, branches, cover | `src/chase/opening.js`, `ambush.js`, `debris.js`, `environment.js` |
| Gun, reload arms, vehicle and driver | `src/chase/mounted-gun.js`, `gunner-arms.js`, `jeep.js`, `park-driver.js`, `park-livery.js` |
| Touch and keyboard/mouse integration | `src/chase/pointer-controls.js`, `src/chase.js`, `src/chase.css` |
| Sound roles, envelopes and playback | `src/chase/audio.js`, `audio-catalog.js`, `public/audio/catalog.json` |
| Preserved original creature study | `model-lab.html`, `src/main.js`, `src/prepare-model.js` |
| TEST ONLY catalogue of all 20 creature appearances, High/Low review, random/manual frill, fitted model views | `creature-lab.html`, `src/creature-lab.js`, `src/creature-lab.css`; `src/chase/safari-motion.js` for shared gait/frill |
| Hero asset and release | `public/models/rex-hero.glb`, `vite.config.js`, `.github/workflows/pages.yml` |

Paths abbreviated within a row share the first file's directory.

## Select the relevant workflow

- For the Lost Circuit arcade ride, read [lost-circuit.md](references/lost-circuit.md). It covers moving-world coordinates, Overdrive, physical muzzle alignment, shared-rendering traps, portable test commands and evidence limits. The user requested a hard quality audit; do not describe the current version as AAA or visually accepted.
- For rig, cinematic, material, sound, or mobile changes, read [animation-and-rendering.md](references/animation-and-rendering.md). It records the causes of prior regressions and the invariants behind their fixes.
- For Containment Breach gameplay, its compound, or reuse of its attacker states, read [containment-breach.md](references/containment-breach.md). Pursuit/Safari keep separate rules. River Escape is described in `docs/ROADMAP.md` but remains future work; the existing river ford is only a short crossing.
- For brachiosaur anatomy, use the accepted silhouette and loft-authoring notes in that reference's [Living jungle](references/animation-and-rendering.md#living-jungle-critters-insects-brachiosaur) section. Rebuild both mesh tiers and inspect neutral studio views as well as the game.
- Before browser checks or publishing, read [verification-and-release.md](references/verification-and-release.md). Select the focused checks that cover the changed behavior, plus the release gate when shipping.
- For art provenance, controls, exact current game rules and audio-editing workflow, use the checkout's `README.md` and source constants. Ordinary runtime tuning does not require Blender export or new image generation.

Compare relevant views before and after visual edits. Check clean and wounded skin for shader changes; check the entry/exit of a transition for motion changes. Preserve actual normal/scale detail rather than hiding a rendering issue with global darkness. Keep browser console and page errors visible during verification.

Publishing is conditional on the user's requested scope and existing authorization. A prior deployment or this skill alone does not authorize an unrelated future release. When publishing is authorized, complete the implementation and checks, push the scoped commit, observe the Pages action, and verify the live build; do not stop at a local build.

## Maintaining this skill

The maintained copy is `.agents/skills/rex-pursuit-maintainer/` in the repo. A user copy may also exist under `~/.codex/skills/rex-pursuit-maintainer/`. Keep copies synchronized when updating the skill within the session's filesystem permissions. Supporting references are bundled so the installed skill retains its detailed workflow; current state/provenance docs remain in the checkout. Other agents can read the repo files directly without installation. Update the dated handoff for meaningful new decisions, not routine tool output, and the startup guide when current scope or acceptance/release status changes.
