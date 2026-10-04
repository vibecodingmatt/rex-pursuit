# Verification and release

## Local setup and common traps

Run commands from the Rex checkout, not the parent `games-playground` folder. Node dependencies are locked in `package-lock.json`; `npm ci` restores a fresh clone. CI uses Node 24. Browser checks use `playwright-core` with installed Chrome, normally `C:/Program Files/Google/Chrome/Application/chrome.exe`; only some scripts honor `CHROME_PATH`, so inspect the chosen script before changing platforms.

`npm start` runs `scripts/serve.mjs` at `http://127.0.0.1:5188/`. Reuse a server already serving this checkout. It is a development server with no-cache headers, `public/` fallback and authoring POST endpoints; keep it on loopback. It is not the production host. `npm run dev` also uses 5188; do not start both at once.

`npm run build` creates ignored `dist/`. On the custom development server the built entry is `/dist/index.html`, not `/dist/`. Its fallback to `public/` can hide missing packaged assets. For release confidence, use `npm run test:pages`: it serves **only dist** on 5189 beneath `/rex-pursuit/`, matching the Pages subpath. `vite.config.js` uses relative `base:'./'`; keep runtime URLs compatible with it.

Create ignored `art/review/` if a fresh clone lacks it; browser checks write captures and reports there. Most checks expect the source server on 5188. Many accept `TEST_URL`, but `verify-defeat-gait.cjs` is source-only and imports `./src/chase/defeat.js` in the page. Do not run that script against a build or live site and interpret the resulting import failure as a game bug.

The local sandbox identity has sometimes needed a per-command Git ownership override:

```powershell
git -c safe.directory=C:/Users/burns/dev/games-playground/rex-encounter status --short
```

Use that exact checkout if needed; do not globally disable ownership checks. Node/Chrome and authenticated network commands may need the environment's escalation tool. A permission denial is not evidence that the code is broken; use the available approval mechanism within the authorized scope.

## Test tiers (keep runs proportional)

The user asked that test effort match the change. Do not run the whole suite for small edits.

1. **Smoke** — `npm run test:smoke` (about 30 s): load, fire/hit, grenade, camera switch, pause, win transition and phone layout, with no page or console errors. Run it for any runtime change.
2. **Focused** — add only the checks from the table below that cover the systems touched (e.g. gun aim: `test:gunner`; understory/foliage placement: `test:treeline`; HUD/camera framing: `test:pressure`). Visual-only material, lighting or effect tweaks need the smoke run plus before/after captures, not the browser suites.
3. **Full** — every suite plus `build`, `test:release`, `test:pages` and `test:build` only before a publish or after broad cross-cutting changes (rig, timing, combat rules, render pipeline structure).

## Focused checks

Read `package.json` and the selected script before running it. There is no need to rerun every long browser sequence for a narrow visual edit.

| Changed behavior | Useful checks |
| --- | --- |
| Core combat, timers, objectives, deadline | `npm run test:logic`, `npm run test:arcade` |
| Main game shooting, damage, restart | `npm test` |
| Lost Circuit '94 rules, input, routes, 3D travel, muzzle alignment, bridge and packaged entry | `npm run test:lost-circuit`, `node scripts/verify-circuit-ride.cjs`; real-time and dist-only recipes are in [lost-circuit.md](lost-circuit.md). `test:arcade` is an older Pursuit check, not this mode. |
| Containment Breach: waves, trap, weapons, leap/board attacks, Rex/gate finale, pause/restart and touch | `npm run test:breach`; rules alone: `node scripts/test-breach.mjs` (also in `test:logic`) |
| Breach service-passage concealment, continuous arrivals, entrance cover and phone sightlines | `npm run test:breach-arrivals` (source server only) |
| Breach solid-object clearance, direct rocket contact and model breakup | `npm run test:breach-collisions` (source server only) |
| Safari rules, mode picker, scoring, results, remembered records and mobile flow | `npm run test:safari` |
| IDKFA, fair/cheater score isolation, shared wildlife gore and close explosive lens splatter | `npm run test:cheats` (source or built entry base); pure rules are also in `test:logic` |
| Homepage mode switching, cached compound preview, loading races and return navigation | `npm run test:mode-menu` |
| Shared Safari gait/frill, Breach leap pose, hit transforms and continuous deaths at both tiers | `npm run test:safari-motion` (source server only) |
| Full creature catalogue, frill presets, selection races and short-menu scrolling | `npm run test:creature-lab` |
| Walk/run cadence, foot planting, roar locomotion | `npm run test:gait` |
| Knee continuity, footstep dust, Rex death fall | `npm run test:motion` |
| River ford, spray, wet ground, the Rex's mud and soak | `npm run test:ford` |
| Firing in the detour, shooting wildlife of every species, the bag and results line, the brachiosaur's rear-up | `npm run test:wildlife`; `test:logic` for the rules and the bag |
| Player defeat, post-spin feet, jaw/interior timing | `npm run test:defeat` |
| Reload hands, ammo feed, driver, steering | `npm run test:vehicle` |
| Target distribution, HUD paths, debris balance | `npm run test:pressure`; `test:balance` for simulations |
| Branch contact, midpoint detour, damage persistence | `npm run test:cinematic` |
| Actual treeline concealment in both cameras | `npm run test:treeline` |
| Offset aiming and simultaneous touch controls | `npm run test:touch` |
| Eye focus and convergence | `npm run test:gaze` |
| Original creature study | `npm run test:lab` |
| Build-specific settings, paused fall and restart | `npm run test:build` after building |
| Release assets, metadata and Pages paths | `npm run test:release`, `npm run test:pages` after building |

`test:pressure`'s compact-phone view (320 by 568) is intermittent. It stops at the first failure, so later views do not run; check them with `TEST_VIEWS` (for example `TEST_VIEWS=tablet,landscape,phone-third`). About one run in three fails with `debris covered by #touch-grenade`, on both the previous and the articulated-foot gait (September 2026). The check freezes after a real-time 850 ms wait, so the in-Jeep camera pose, and with it a flying branch's projected path, varies between runs. A failure here alone is not evidence of a regression: rerun that view, and compare against the previous commit if it fails again. On 2026-09-24 (Drop 5) it failed three times in a row, both on `b7963a1` and with the night changes, always because of `#touch-grenade` coverage.

`TEST_CONDITIONS` (`storm`, `night` or `night-storm`) runs `test:pressure` under a chosen condition by seeding the stored picker value. Use `night` whenever touch controls change: at night the LIGHT button sits above FIRE.

`test:defeat` includes the pure timeline, source-only rig check, and complete browser cinematic. For a timing-only change, the browser portion can be aimed at the build separately:

```powershell
$env:TEST_URL = 'http://127.0.0.1:5188/dist/index.html'
node scripts/verify-defeat.cjs
Remove-Item Env:TEST_URL
```

Inspect before/after captures for animation and shader work. Meaningful checks include bone/foot continuity at multiple frame rates, all relevant loss routes, health stages, pause during a transition, restart after it, and desktop plus portrait/landscape phone framing. Choose what the edit can affect. Phone emulation does not establish physical-device performance or iOS compatibility.

## Browser diagnostics

`window.rexChase` exposes `rex`, scene, camera, renderer, state, Jeep, audio, effects, swallow, view, start, snapshot and a `freeze` setter for local verification. `window.rexStudy` exposes the preserved lab separately. Wait for `rexChase.rex` before accessing the model.

`window.breach` is the separate compound harness; wait for `breach.ready`. Its `round`, `director`, `step`, `aimAt` and `snapshot` are described in [containment-breach.md](containment-breach.md). `window.creatureLab` belongs to the full catalogue; wait for `active` and use `select(name)` for another model. Do not mix these page-specific globals.

`window.lostCircuit` belongs to `arcade.html`. Wait for `ready`; mutation/seek/step/spatial methods require `?test=1`, which disables record writes. See [the arcade diagnostics](lost-circuit.md#visual-review-and-diagnostics). Its freeze API is a function, `lostCircuit.freeze(true)`, not the Pursuit setter.

`freeze=true` stops simulation while continuing rendering, making it useful for exact cinematic captures and custom camera comparisons. It is **not** a pause test: verify Pause through the UI or keyboard and check AudioContext suspension as well. Start with a real click/tap to unlock sound.

For settled menu captures, wait for `#boot` to become hidden and the title reveal to finish. If changing conditions after freezing, step `weather.update(0,0,camera,{ground:true})` too: `setConditions(...,true)` updates the values/lights but rain visibility is applied during update. A capture-only HUD filter must preserve `#scene-viewport`, the parent of the canvas.

A reproducible loss can be triggered after starting: transition to `pursuit`, set distance to 19 and `nextDebris=Infinity`, let movement settle briefly, then set Jeep health to 1 and set phase `bite`, phaseTime `.77`. Existing `verify-defeat.cjs` demonstrates all loss causes. Avoid setting `state.result='lost'` by itself: that bypasses event setup needed for the actual cinematic.

Listen for both `pageerror` and browser console errors. Shader compilation failures can appear only in the console and leave a page that still responds to input. Screenshots alone cannot prove successful compilation.

`verify-lost-circuit.cjs`'s "actual pointer input hits" check is intermittent on the touch views: landscape failed once locally (2026-10-03) and compact once against the live site (2026-10-04), each passing on the next run with no change. The cause was timing: the ride runs for the 400 ms hold and the animal moves off a fixed tap point. Since 2026-10-04 the check sends touch-move events that follow the animal while the finger is down, so it no longer depends on frame timing. If it fails now, investigate.

## Publishing when authorized

Production is `https://vibecodingmatt.github.io/rex-pursuit/`, from `vibecodingmatt/rex-pursuit` main. Any push to main triggers `.github/workflows/pages.yml`, including documentation-only commits. Follow current user authorization; skill installation and local documentation edits do not themselves require a game release.

For a runtime release:

1. Run the relevant focused checks, then `npm run test:logic`, `npm run build`, `npm run test:release`, and `npm run test:pages`. Clear an inherited `TEST_URL` before the local Pages check so it actually tests the new dist.
2. Inspect `git diff --check` and status; stage only the intended changes. Preserve credits and source metadata. Build/review files, raw audio and Blender masters stay ignored.
3. Commit and push to the correct remote/main when authorized. Observe the Actions run with `gh run list` / `gh run watch`; pushing is not proof of a successful deployment. If CI fails, inspect the logs and fix the cause rather than repeatedly dispatching the same failing job.
4. Verify the live HTML references the new hashed `assets/chase-*.js` from local `dist/index.html`. Then inspect the affected behavior in the live browser and confirm runtime/asset errors are absent. Account for propagation if the old bundle is still served.

For a full live Pages smoke check:

```powershell
$env:TEST_URL = 'https://vibecodingmatt.github.io/rex-pursuit/'
npm run test:pages
Remove-Item Env:TEST_URL
```

`test:pages` verifies Pursuit, the Breach entry/start/pause flow, both labs, the sound library, all 34 published WAVs, camera/pause, phone layout and social image. It does not replace Breach's full win/loss check. Audio requests are checked sequentially so parallel fetch contention is not misdiagnosed as missing files. CI itself runs logic/build/release validation (including Breach rules), not the local Chrome suite; do not claim CI covered browser behavior.

No game build or browser regression run is needed solely for prose/skill edits. Validate Markdown links, skill frontmatter and referenced paths instead. If those changes are pushed, still observe the triggered CI result.

## Assets and social metadata

The hero is artist-authored fan-concept art, not a film production mesh. Keep the existing attribution and provenance in README, credits, and GLB metadata. Runtime tuning does not need asset re-export. `art:export` writes an intermediate model through the local authoring server; `art/finish_rex.py` uses Blender to overwrite the hero and editable master. Use that pipeline only for deliberate asset changes with the local source files available.

The Vite entries include chase, Containment Breach, Raptor Ravine, Lost Circuit, the original model lab, the full creature catalogue and the sound library; `vite.config.js` is authoritative. The local catalogue shortcut is stripped from the production menu by `data-dev-only`, but the page itself is built; the Containment link is public. Share metadata is static in `index.html`: Open Graph, X card, canonical URL and VideoGame JSON-LD. The current `public/social/rex-pursuit-v4.jpg` is 1200x630; source metadata and README take precedence over this checkpoint. When changing artwork, regenerate deliberately and update both metadata image URLs to a new versioned filename; social caches may retain old images. Do not rebuild social art for an unrelated code fix.
