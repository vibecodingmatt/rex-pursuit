# Lost Circuit ’94

Research and implementation checkpoint: 2026-10-02. Local entry: `http://127.0.0.1:5188/arcade.html`. Select **Lost Circuit ’94** on the Rex: Pursuit home menu. This is a new single-player fan-concept ride, inspired by the original game's structure and freely extended into later-film settings.

## What made the 1994 game distinctive

**The cabinet was part of the game.** SEGA dates the original to February 1994 and identifies SYSTEM 32, one or two players, a moving seat, and a scenario set after the film: tranquilize the dinosaurs and restore the island's systems. The premise supports an expedition through a failing park, rather than a stationary survival arena. [SEGA historical archive](https://www.sega.jp/history/arcade/product/15581/).

**A joystick moved the on-screen sight.** The trigger fired while the vehicle followed its own route; players concentrated on threat selection, tracking and sustained fire. The museum documents an analog stick with trigger, simultaneous cooperative play, stereo sound and a moving bench shared with Rail Chase. That distinction is easy to lose when remembering this as a generic light-gun game. [Museum of the Game cabinet/control record](https://www.arcade-museum.com/Videogame/jurassic-park).

**It was much stranger than a movie recap.** The soundtrack's scene-indexed cue list records the opening raptor/cave stretch, Gallimimus grassland, Triceratops trouble, a Brachiosaurus back/neck traversal, water and flying reptiles, lava cave, volcanic debris, a suspension-bridge fall, submerged jungle and the visitor center. This community-maintained cue sheet is useful for route detail; it is not an official level-design document. [Scene and music index](https://w.atwiki.jp/gamemusicbest100/pages/9982.html).

**The full arc had four areas.** A documented longplay separates the route into four main areas, with the first major Rex fight in area two and another Rex confrontation in the finale. Its indexed recording offers a useful pacing reference for a compact ride: ordinary enemies and spectacle lead into larger confrontations. Playback timestamps vary between recordings, so this implementation does not use them as exact spawn timings. [JurassicVerse 64 longplay description and area timestamps](https://www.youtube.com/watch?v=q0uHt7wqDYw), [World of Longplays archival entry](https://longplays.org/infusions/longplays/longplays.php?longplay_id=16417).

**Obstacles were part of the shooting rhythm.** Dinosaurs shared attention with rocks and barricades. The creature roster included the familiar carnivores, herbivores, Pteranodon and Ichthyosaurus. The original's named boss was Tyrannosaurus; treating every large species as an original boss would conflate this release with later arcade games. The area roster also places Brachiosaurus and Ichthyosaurus in area two, and a second Rex confrontation at the end. [Jurassic Park Wiki's area breakdown](https://jurassicpark.fandom.com/wiki/Jurassic_Park_(arcade_game)).

The resulting design interpretation is a rhythm of **approach → panic → interruption → impossible escape → brief relief**. Sustained shooting should feel good without reload bookkeeping. The environment should create anticipation between attack groups. A huge animal should visibly occupy the route before its attack becomes urgent. Those are design conclusions drawn from the references, not claims about the original source code.

## The adaptation

The ’94 Circuit contains stages 1, 2, 3 and 7. The Extended Cut runs all seven. A precise automated player completes them in about 3.2 and 5.4 minutes respectively; these are simulation times, not human completion estimates.

| Stage | Scene and interaction | Relationship to the research |
| --- | --- | --- |
| Through the gates | Moving forest track, roadside pacing/charges, Gallimimus crossings, spit, Triceratops boss | Remixes the first area's mixed threats; Triceratops as a boss is a new liberty |
| River of giants | Reflective river, enormous Brachiosaurus passing close, aquatic/flying enemies, Rex | Recalls the original's sauropod and river excess; does not reproduce its exact traversal |
| The falling world | Lava cave exit, volcanic canyon, a breaking bridge and shootable falling rocks | The strongest direct set-piece homage; departure is earned by surviving the hazard wave |
| Nobody is in control | Modern promenade, monorail and glass aviary dome, camouflaging Indominus | Modern-film detour with a partially concealed approach and long-clawed silhouette |
| Something in the water | Wake effects, marine enemies, breaching Mosasaurus | A later-film scale escalation with a timed bite interruption |
| Do not turn out the lights | Vaulted conservatory, practical lights, raptors dropping from above, lateral Indoraptor attacks | A manor/roof horror interpretation of Fallen Kingdom |
| When giants ruled | Visitor-center approach, thatched rotunda and two independently attackable Rexes | Returns the ride to its classic finale after the modern detour |

The modern additions are explicitly separate from the 1994 research. The official Jurassic World channel's Indominus feature documents the hybrid threat; Universal's attraction description identifies the lagoon's enormous Mosasaurus; the licensed Lockwood Estate set describes an Indoraptor encounter in that setting. These establish the motifs; the encounter choreography here is new. [Official Indominus feature](https://www.youtube.com/watch?v=APCdnLpoOPs), [Universal's Jurassic World attraction](https://www.universalstudioshollywood.com/web/en/us/things-to-do/rides-and-attractions/jurassic-world), [Lockwood Estate reference](https://www.lego.com/en-us/product/indoraptor-rampage-at-lockwood-estate-75930).

## Playing

- Mouse: aim and hold left button to fire. Keyboard: arrow keys aim; Space fires. Touch: hold and drag to aim/fire, with the sight placed 42 CSS pixels above the finger.
- Infinite automatic tranquilizer ammunition. Body hits work; head hits are stronger. Amber boss marks open a further precision bonus. Nine accurate hits during a window interrupt the pending attack.
- Defeats build a 4.5-second chain, up to ×5. Shooting green supplies restores integrity and charges Overdrive; red canisters damage the crowd. Overdrive needs a full earned meter, lasts five seconds, slows threats and increases fire cadence. Activate with E or the HUD button.
- Esc or Pause suspends the simulation and AudioContext. Blur/backgrounding pauses automatically. Full/Low motion is available and the initial setting honors reduced-motion preferences. Sunday drive reduces incoming damage.
- Two free continues preserve stage progress and score. Route, difficulty and continued versus one-credit records have separate browser-local keys. No account or network leaderboard is used.

This intentionally adds score chains, repair canisters, Overdrive, explicit attack telegraphs and route selection. It does not claim those are original 1994 mechanics. It is single-player; the original cabinet's two-player cooperative mode and physical seat motion are not implemented.

## Art, sound and implementation

`arcade.html` and `src/arcade/` are a separate entry. The homepage imports none of its scene art or gameplay code. The build remains compatible with the GitHub Pages subpath.

The first version's zooming backgrounds and small image puppets were rejected by the user. The current ride replaces that traversal completely. `rules.js` owns deterministic combat, distance and vehicle speed. `world.js` builds a continuous curved Three.js route with real terrain, instanced vegetation, scanned cliffs, a lava tunnel, falling bridge planks, reflective water, a glass aviary, conservatory and thatched visitor rotunda. The vehicle travels at 14–27 metres/second during normal sectors; Overdrive slows both the vehicle and threats. Camera banking, suspension and motion blur respect the Low motion option.

`actors.js` directs actual 3D creatures: weighted raptors, shared sculpted herd animals, articulated flyers, a modeled marine reptile and physical props. Land attackers enter from roadside cover, pace the vehicle, turn, and charge. The conservatory's raptors drop from above; water sectors use aquatic/flying threats. Brachiosaurus is a large 3D river encounter. The shared raptor and scanned terrain credits are recorded in [Raptor Ravine's asset provenance](RAPTOR-RAVINE.md).

`weapon.js` uses the detailed mounted receiver, belt and ejected cases. Barrel yaw/pitch, muzzle flash and projected tracer origin derive from the same 3D mount. `renderer.js` supplies the transparent effects/reticle layer and the accepted large boss presentations. Those bosses deliberately retain their articulated image meshes in `puppet.js`, their attack windows, interruptions and World-era variants. They are still 2.5D artwork; the new traversal does not make them fully modeled 3D creatures.

The original PNG atlases and launcher remain under `public/arcade/` with their ImageGen provenance. The title and boss renderer still use that artwork; the launcher and small creature cutouts no longer render during traversal. `architecture-v2.png` is a new built-in ImageGen texture atlas, applied to real 3D facades and roofs, with its exact prompt in `architecture-v2-source.json`. These are generated fan-concept assets, not extracted film/arcade art. Existing authored/scanned 3D assets retain their original project credits.

`audio.js` supplies an original procedural pulse score, a speed-responsive engine and wind bed, firing, impacts and rewards, plus three existing dinosaur-call clips from the project's user-supplied library. No original arcade music is used. Audio starts from a user gesture; an unavailable sample falls back to synthesis.

## Verification and limits

For a fresh session, read [START-HERE.md](START-HERE.md). The [maintenance reference](../.agents/skills/rex-pursuit-maintainer/references/lost-circuit.md) maps the modules, explains fragile integration decisions, and gives source, real-time and packaged test recipes for different shells. The 3D rebuild is runtime commit `a397b3b`; scene descriptions above reflect that revision rather than the rejected backdrop version.

`npm run test:lost-circuit` runs deterministic 30/60/120 Hz, classic/extended and desktop/phone target checks, complete wins, unattended loss, continue exhaustion, shot cadence, pickups, boss interrupts and storage isolation/failure checks. The browser portion uses real mouse/touch events, checks pause/audio, Overdrive, all stages, full wins and continues, and captures desktop, portrait, compact and landscape views. Console/page/asset errors are failures.

After building, run `$env:CIRCUIT_DIST='1'; node scripts/verify-lost-circuit.cjs` to serve only `dist` under `/rex-pursuit/` on loopback port 5193. Remove that environment variable afterward. Existing Rex smoke and Ravine-menu checks cover the shared entry change. `test:release` checks the new page and art packaging. Review images and reports are ignored under `art/review/lost-circuit/`.

`node scripts/verify-circuit-ride.cjs` adds real distance advancement, rigged-actor presence, left/center/right/low barrel convergence and visible muzzle checks. It captures a five-frame approach, the gun firing at different aim positions, and every environment on desktop and portrait, plus workstation frame timing. Images and the numeric report go to ignored `art/review/lost-circuit/ride-audit/`. Inspect the images; passing numbers alone do not establish art quality.

The browser diagnostic is `window.lostCircuit`. Deterministic stepping/seeking and spatial diagnostics exist only with `?test=1`, which disables record writes. Ordinary visits expose readiness, snapshots, loaded-art dimensions and audio state. Physical phones, Safari/iOS and subjective difficulty remain unverified; desktop Chrome emulation cannot establish those results. The candid [quality audit](ARCADE-QUALITY-AUDIT.md) distinguishes corrected failures from the remaining gap to the user's AAA reference. This checkpoint is local and does not authorize a production release.
