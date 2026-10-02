# Raptor Ravine — chapter two

Implemented locally on 2026-10-02, then revised following visual feedback. It is temporarily open for play-testing: `RAVINE_PLAYTEST_OPEN` in `src/chase/campaign.js` bypasses the access gate without inventing a Rex win. Turn that one flag off to restore earned access. It is a separate entry (`ravine.html`), so its assets and pack simulation do not load into Pursuit, Safari or Containment.

## Art selection

The original Rex distribution is **CC BY 4.0**, not CC0. Its existing attribution remains intact. New downloaded assets for this chapter are CC0:

| Asset | Source and author | Use |
| --- | --- | --- |
| Dromaeosaur Raptor | [Animaniac888 / BlendSwap](https://blendswap.com/blend/4889), distributed on [OpenGameArt](https://opengameart.org/content/dromaeosaur-dinosaur) | 47,164 triangles, original 2K color/normal maps, repaired skull/eye binding, weighted skeleton with runtime limb IK, tail, jaw, leap and fall poses. Pack instances share geometry and textures. |
| Namaqualand Cliff 02 | [Dario Barresi and Rico Cilliers / Poly Haven](https://polyhaven.com/a/namaqualand_cliff_02) | Fractured canyon outcrops: 15,999 / 3,499 triangle LODs share 4K color and 2K surface maps in one GLB. Varied, mirrored instances overlap continuous backing terrain. |
| Sandstone Cracks | [Rob Tuytel / Poly Haven](https://polyhaven.com/a/sandstone_cracks) | 2K PBR maps for the terrain backing and talus. |
| Gravelly Sand | [Dario Barresi / Poly Haven](https://polyhaven.com/a/gravelly_sand) | 2K color, normal and roughness maps for the road. |

The artist's listing explicitly confirms the raptor's CC0 status. Poly Haven's [asset license](https://polyhaven.com/license) covers the environment downloads. Machine-readable source records, retrieval dates and source hashes are alongside the GLBs. These are artist-authored/scanned assets, not licensed film production meshes. The raptor is a stylized reconstruction; the visual result should be judged in the running game, not inferred from polygon count or described as proven AAA parity.

The search also surfaced [Quaternius's CC0 dinosaur pack](https://quaternius.itch.io/animated-lowpoly-dinosaurs), whose deliberately low-poly style did not fit this chapter, and [CC0 Allosaurus scan data](https://sketchfab.com/3d-models/allosaurus-fragilis-b30bd9c9d048435cb412bc76314cca62), which is skeletal data rather than a textured living chase creature. Free-to-download CC BY candidates were not substituted for the requested CC0 creature.

## Route and rules

- Survive an 86-second moving chase followed by six seconds through the closing evacuation gate. The cut, abandoned viaduct and widening north pass form three phases of this one level.
- At most three living attackers at first, four in the last phase. Attackers approach separate lanes, give a 1.85-second warning, then leap. An unopposed strike costs 17 Jeep integrity. Defeated bodies settle and leave with the road; actor storage is bounded.
- Raptors have 150 health. Body hits deal 20; head hits 32. Grenades deal 230 within five metres. The existing 80-round magazine, 2.6-second reload, heat, fire interval and 11-second explosive cooldown carry over.
- First/third-person cameras, thumb-offset aiming, simultaneous aim/fire, pause, blur/background pausing, graphics tiers, reduced motion and both existing cheat toggles are supported. Fair and cheat records use separate browser-local keys.
- The victory screen unlocks the chapter and offers a direct continuation. A persistent menu link allows replay. Local storage failure does not prevent the immediate victory continuation; without storage, progress cannot survive a fresh visit.

## Code and authoring

- `src/chase/campaign.js`: versioned browser-local unlock/completion state.
- `src/ravine/rules.js`: deterministic pack/combat rules and fixed substeps.
- `src/ravine/main.js`: controls, sound, camera, HUD, lifecycle, results and shared HDR pipeline.
- `src/ravine/raptors.js`: repaired skinned asset, bounded actor pool and animation.
- `src/ravine/geology.js`: continuous 1,320m canyon backing, overlapping scan reliefs, mirrored geometry, near/far LODs and shared stone materials. Scan cut edges are buried; the old Coastal Cliff 01 strip is retired. Do not use an open scan as a freestanding wall.
- `src/ravine/world.js`: gravel road, talus, sparse agaves/dry grass, route markers, viaduct and sliding gate. Continuous rails were removed.
- `art/prepare_raptor.py`, `art/prepare_ravine_outcrop.py`: explicit Blender export. Run with `--background --disable-autoexec`; source scripts are never needed. The raptor export repairs 292 unweighted mouth-interior vertices, in addition to the eyes. Unweighted vertices previously exported on `neutral_bone` and protruded below the moving jaw. `scripts/fetch-ravine-assets.ps1` restores inputs. Raw sources/review captures are ignored; runtime assets are committed.

The menu is an idle composition, with closed jaw, planted staggered feet, subtle breathing/head/tail motion and a small camera drift. It never advances the run gait or road. Reduced-motion mode holds the pose. Portrait camera targeting follows the skull so the snout remains within the frame; menu FOV is separate from the wide combat FOV.

`window.ravine` exposes the local diagnostic scene, round, pack, camera, step, aim and freeze helpers, following the existing game's test conventions. A storage continuation is a local convenience flag, not an authentication mechanism.

## Verification

`npm run test:ravine` covers rules plus fresh play-test entry without a fake earned unlock, actual Rex victory and continuation, real-ray firing, pause, both cameras, a complete fair win, a complete loss, restart, save/reload, independent cheats, blocked storage, and trusted touch controls in portrait/landscape. It watches console, page and asset errors and saves review captures to ignored `art/review/ravine/`.

`node scripts/verify-ravine-art.cjs` checks 24 seconds of stationary foot placement, no walking cycle, no unbound mouth vertices, and desktop/portrait/compact/landscape menu captures. Inspect those captures and gameplay shots; numeric checks do not establish visual quality.

Use `TEST_URL` to run the same browser check against a built entry. The release validator requires the new entry, models, provenance and ground textures. Phone emulation checks layout and input; physical-device performance remains unverified.
