# Rex: Pursuit

Three jungle encounters from a Jeep's mounted gun: survive the T. rex in **Rex Pursuit**, chase a high score in **Safari Run**, or hold a trapped vehicle through **Containment Breach**. Each has first-person and external cameras.

**Play:** https://vibecodingmatt.github.io/rex-pursuit/

90 seconds. One Jeep. No second chances.

## Continuing development

Start with [the session handoff](docs/HANDOFF.md) and [AGENTS.md](AGENTS.md). The [Rex: Pursuit maintainer skill](.agents/skills/rex-pursuit-maintainer/SKILL.md) maps the code and records the animation, rendering, mobile, verification, and release lessons. Its repo folder is the maintained source and can also be copied to `~/.codex/skills/rex-pursuit-maintainer` for discovery in future sessions.

## Run

```powershell
npm install
npm start
```

Open **http://127.0.0.1:5188**. `npm run build` produces a static `dist/` directory with relative asset paths. `npm run preview` serves that build after stopping the development server.

## GitHub Pages and sharing

The `main` branch publishes through `.github/workflows/pages.yml`. CI installs the locked dependencies, checks combat/cinematic logic, builds the site, validates release assets and metadata, then deploys `dist/` to Pages. Raw audio references, Blender sources and local review captures remain outside Git.

The game has static Open Graph and X large-image metadata, canonical URL, VideoGame structured data, favicon/app icons and a manifest. The 1200×630 JPEG at `public/social/rex-pursuit-v4.jpg` uses the approved, text-free promotional artwork. `npm run social:render` packages it from the preserved source in `art/rex-pursuit-keyart-v3.png` using Chrome, without a running game. See [art provenance](art/rex-pursuit-keyart-v3.md). Social services decide when to refresh cached previews; keep Open Graph, X and structured data on the same versioned image URL when changing artwork.

Before publishing, run `npm run test:logic`, `npm run build`, `npm run test:release` and `npm run test:pages`. The last command serves only the built files under `/rex-pursuit/`, checks gameplay and every entry page, and rejects missing or incorrectly rooted assets. Set `TEST_URL` to the public URL to repeat that browser check against the live deployment. `npm run test:gaze` checks pupil tracking and saves eye closeups locally.

The Rex's eyes aim independently at a shared player position with a damped response. The irises move across the original eye surfaces without moving the sockets or corneas; constrained angles and an optical offset account for the deep brow. First-person and menu views follow the viewer; third-person follows the gunner. Gaze holds when the Rex dies and resets with a new encounter.

- `/` — Pursuit / Safari and the mode picker.
- `/breach.html` — Containment Breach, a two-minute compound holdout.
- `/model-lab.html` — preserved creature study, camera presets, exported clips, and original damage slider.
- `/creature-lab.html` — TEST ONLY catalogue of all 20 creature models, including rare variants and insects. Orbit/zoom, camera presets, High/Low meshes, pause/speed, rest poses, wireframe, and a manual or random Dilophosaurus frill display. Linked from the local menu; the production build strips that menu shortcut. `npm run test:creature-lab` checks every entry and both mesh tiers.
- `/sound-library.html` — audition and name the 34 cuts from the supplied audio reference; assign opening, charge, growl, and pain calls; export a named JSON catalog.

## Play

Choose **Rex Pursuit**, **Safari Run**, or **Containment** in the main menu. All three options change the homepage preview in place; Containment reuses the loaded creatures and renderer for its cached compound scene. Every fresh page load defaults to Rex Pursuit, including returning visitors. Press **Hold the compound** to enter its briefing. Breach has a persistent **Game modes** link, mode choices on its briefing, and return links from pause/results. Returning through these links selects the relevant homepage preview; ordinary reloads still default to Pursuit.

### Containment Breach

The Jeep is stopped at a failed service exit during a night storm. Hold for **two minutes**, then escape through the opening gate. Contacts start at three seconds. Three escalating waves allow **4 / 6 / 8 live attackers**, with short reload breaks and continued flanking pressure during the Rex finale. Raptors crouch before leaping onto either side of the lowered tailgate; **two can attack together**. A landed raptor waits 1.05 seconds before its first strike, then bites every 1.25 seconds for 10% integrity. Five bullets repel it.

Attackers run through the two breached service passages beside the main paddock gate. Their route begins behind concrete cover, turns through a lit doorway and continues into the yard at full size. Rattling gates and positioned calls announce each arrival. The entrance walls stop bullets and rocket blast damage.

Approaches, charges and retreats respect the compound's solid props, fences and Jeep body, with clearance for the head and tail as well as the feet. Direct rocket hits blow raptors and pachys into flying model fragments and blood; nearby splash kills retain the tumbling body. Rockets travel until contact rather than detonating at an animal's old position. The Rex remains a stagger threat and does not break apart.

**Pachycephalosaurus** joins the packs after the opening stretch. Its lowered-head warning precedes a ground charge that removes 20% integrity on contact. Ten bullets or a direct rocket stop it. **Space / ROCKET** fires a visible projectile with an 11-second cooldown and a 5.5 m lethal blast radius (lighter damage at the edge); it works while the machine gun reloads. Use it to break a charge or clear clustered attackers. Bullets throw directional blood spray and tissue fragments; explosive kills produce larger bursts, heavier body knockback and lingering blood splatter on the concrete and Jeep deck. The effects use fixed pools and reduced counts on Low; difficulty stays identical across graphics tiers.

Shoot either glowing blue electrical switch when a pack enters the yard. Both switches share an **18-second recharge**; the discharge clears its marked approach area, with bonus points for caught animals. It cannot reach a raptor already on the Jeep. During the finale it also staggers a Rex within the yard.

At 94 seconds the power fails and the Rex is revealed. She breaks the outer fence at 99 seconds and advances while the exit motors recover. Sustained fire builds stagger; head hits count double and rockets contribute ten hits. Each stagger drives her back. The smaller attackers keep coming, so split your attention between the pack and the Rex. Survive until the gate opens fully at 120 seconds for the getaway. The Rex reaching the vehicle, or the pack reducing integrity to zero, ends the run.

Gun, reload, camera, flashlight and pause controls match Pursuit; Breach uses a rocket launcher on the explosive control. The mode has its own score and browser-local best (`rex-breach-best-v1`), and its fixed night storm does not overwrite the Pursuit/Safari weather preference. `npm run test:breach` checks the pure rules, seeded director balance, and a complete browser win/loss with real aimed hits, rockets, trap, restart, pause and mobile controls. The future River Escape encounter is detailed in [the roadmap](docs/ROADMAP.md#river-escape--future-zone-requested-not-scheduled).

### Safari Run

A three-second ready countdown leads into **90 seconds of active play**. The Jeep keeps driving; animals cross the road, flush from the edge trees and fly down the canopy gap. Nothing attacks or damages you. Pause/backgrounding stops the clock. The run ends immediately at zero; only completed runs are recorded.

| Animal | Base points | Bullet hits | Frequency |
| --- | ---: | ---: | --- |
| Compy | 100 | 1 | Common |
| Jungle bird | 125 | 1 | Common |
| Lizard | 150 | 1 | Common |
| Gallimimus | 200 | 2 | Common |
| Dimorphodon | 250 | 1 | Uncommon |
| Pteranodon | 300 | 2 | Uncommon |
| Velociraptor | 450 | 3 | Uncommon |
| Pachycephalosaurus | 550 | 3 | Uncommon |
| Dilophosaurus | 700 | 4 | Rare |
| Parasaurolophus | 900 | 6 | Rare |
| Stegosaurus | 1,000 | 9 | Rare |
| Triceratops | 1,200 | 10 | Rare |
| Quetzalcoatlus | 1,800 | 8 | Legendary |
| Ghost raptor | 2,500 | 9 | Legendary |
| Golden compy | 3,000 | 1 | Legendary |

Common crossings arrive every one to two seconds and get denser in the last 30; pterosaurs pass every few seconds. One rare encounter is rolled every 12–17 seconds, with a horn sting, a banner and a tag over the animal; each legendary has about a 4–5% chance per roll, so none is guaranteed in a run. The golden compy is tiny and zigzags at 11 m/s; the ghost raptor is the fastest runner. At 13 seconds left a stampede of Gallimimus and compies pours across. The jungle's own life, roosting Dimorphodon, basking lizards and packs flushed by the Jeep, runs underneath as a bonus.

Kill again within **4 seconds** to extend the streak: **×2** from the 3rd kill, **×3** from the 6th, **×4** from the 10th and **×5** from the 15th. Points are awarded once, on the kill, and rise from the body; a wounded or announced animal carries a tag with its remaining hits. Big animals flinch and run harder when hit. Grenades deal four hits within their blast, so the biggest animals can survive one. Ranks: Trail rookie, Field scout (3,000), Expert marksman (9,000), Master tracker (18,000), Jungle legend (30,000). Reloads, heat, camera controls, weather and the flashlight work in both modes.

Results count the score up and show points by species, the best trophy, the next rank, animals bagged, best streak and the **local top five**. The field guide lists all 15 species and marks every one this browser has bagged. The versioned `rex_safari_v1` cookie (top five, run count, species bagged) lasts one year, scoped to this game's path, with SameSite=Lax and Secure on HTTPS. Local storage is a fallback if cookies are unavailable; if both are blocked the results say so. Records belong to this browser profile, are not an online leaderboard, and disappear when its site data is cleared. Sharing a Safari result includes its score and bag count.

The seven large ground species (Velociraptor, Dilophosaurus, Pachycephalosaurus, Parasaurolophus, Triceratops, Stegosaurus and Gallimimus, which also crosses in the chase) are original sculpts baked from signed distance fields into High and Low meshes. `npm run art:safari` rebuilds `public/models/safari-runners.bin` (10.4 MB). The film-reference pass gives each species distinct skull, neck, crest, limb and hide designs; see [visual targets and reference provenance](art/safari-models.md). Eyes have modeled lids and per-fragment iris/pupil detail. High adds fine scale relief and pigment variation; Low retains the silhouettes, baked hide and eyes with fewer triangles. Both tiers use the same body suspension, independent stride cadence, arm motion and compensated feet. Hit spheres follow the revised heads, frill and plates, and resting hulls come from the final sculpts. Scoring opportunities are independent of quality. `npm run test:safari` covers the rules and browser flow, `test:safari-motion` checks the GPU gait and hit/death transforms, and `test:wildlife` covers shared chase animals.

### Controls and Rex Pursuit

Type either code during Pursuit, Safari Run or Containment Breach:

- **`idkfa`** toggles infinite machine-gun ammo with **no heat or overheating**. Enabling it fills the magazine, cancels a reload and clears any existing heat lock. The gun's firing interval stays unchanged.
- **`idspispipd`** toggles unlimited explosives with **no cooldown**, immediately clearing any current recharge. Breach rockets can fly and hit independently when fired in rapid succession.

The codes work independently or together. **Type the same code again to disable it** and restore that weapon's normal rules. Active codes appear in the cheat badge, and the affected weapon shows **∞**. Codes are case-insensitive; menus, pause screens and text fields cannot activate them. Restarting or changing scenarios clears both effects.

Once either code has been activated, the **entire run** belongs to the **CHEATERS** leaderboard, even if both codes are subsequently disabled. Results have separate **FAIR PLAY / CHEATERS** top-five tabs. Safari's existing fair cookie and field-guide records remain untouched; its cheat scores use `rex_safari_cheaters_v1`. Containment keeps its existing fair personal best and adds separate top-five lists. Pursuit's new lists rank **wildlife points**, using the Safari catalogue's base points without streak multipliers. All records are local to this browser, not online. Shared results identify cheat runs.

Wildlife in Pursuit and Safari now uses the shared Containment blood spray, tissue and ground splatter. A lethal direct explosive hit breaks ground creatures into posed mesh fragments; nearby splash kills and flying animals retain their falling bodies with the larger blood/tissue burst. Explosives still deal four hits in Pursuit/Safari, once per victim. Explosive kills within nine metres in front of the camera spatter droplets onto the lens for roughly three to five seconds. In Containment, shooting a raptor that has boarded the Jeep also splatters the lens in both first and third person: bullet hits add small sprays, and kills add a larger burst. The boarded-raptor effect stays active when the external camera is farther away. Other bullets, surviving yard targets and distant explosions do not add lens blood. Pause freezes the effects; restart clears them. Low quality reduces the pools' emissions. `npm run test:cheats` covers activation, isolated score storage and shared effects; `npm run test:breach-splatter` checks boarded hits with both weapons, cameras and landing sides on desktop and phone, plus pause/fade/reset and yard exclusions.

| Control | Action |
| --- | --- |
| Mouse / screen drag | Aim; touch reticle stays above the thumb |
| Hold left mouse / touch FIRE | Fire the mounted gun |
| R / touch RELOAD | Reload the 80-round box |
| Space / right mouse / HE button | Explosive shot, with an 11-second cooldown |
| V / camera buttons | Switch first / third person |
| Escape or P | Pause |
| M | Mute |
| F / touch LIGHT | Night only: switch the gun-mounted flashlight |

Conditions (Menu or Pause): **Day**, **Storm** (the default on a first visit), **Night**, or **Night + Storm**. At night, the gun-mounted flashlight casts shadows and makes her eyes shine. The Jeep's headlights and taillights light the road, and muzzle flashes briefly light the jungle.

Touch aim sits 96 CSS pixels above the finger in portrait and 72 in landscape. At the top edge it shifts to the side to keep clear of the thumb. Drag with one thumb while holding FIRE with the other; releasing the aiming thumb keeps firing, and releasing FIRE leaves aim in place. The reticle, mounted gun and bullet ray all use the same offset point. RELOAD and GRENADE have dedicated large touch buttons with reload/cooldown feedback. Camera and header controls have at least 44-pixel tap areas, and the control row's empty space passes aiming gestures through to the scene. Portrait screens 650 pixels tall or shorter use a compact objective panel and move camera selection into Pause to keep targets clear.

Game controls suppress text selection, drag selection and long-press callouts, including the WebKit touch-callout rule for iOS. Pause, backgrounding, orientation/viewport changes, lost pointer capture and restart clear held input. `npm run test:touch` checks thumb clearance at screen edges and uses trusted Chrome touch events to test simultaneous aim/fire, actual aimed hits, release/cancel, long presses, reload/grenades, pause and rotation across phone, small-phone, landscape and tablet layouts. Browser emulation does not replace testing on physical iOS/Android devices.

Take the Rex down within **90 seconds of active chase time**. The opening and midpoint jungle detour do not consume the clock. Head hits deal more damage; grenades provide burst damage. Jeep integrity reaching zero also ends the run. The deadline triggers a final unavoidable bite, so the last seconds matter.

During an attack, the camera moves closer and numbered rings follow the animated face, neck, shoulders and chest. Shoot the highlighted ring, then the next number, before its separate timer expires. Each attack draws a new sequence from 12 sites, alternating head/body regions with small surface-position variations. Only the current and next target appear. Clear the sequence for bonus damage and a retreat window to reload. Failure commits the Rex to a bite or side ram; ordinary headshot stagger cannot cancel that attack. An explosive clears the current ring, including its two-hit requirement. Aim assistance covers the displayed ring; normal bullet wounds still use the first mesh surface hit.

| Pressure | Objective | Time available | Clear bonus |
| --- | --- | --- | --- |
| I | 4 targets, 1 hit each | 5.2 seconds | 100 damage |
| II | 5 targets, 2 hits each | 4.2 seconds | 130 damage |
| III | 6 targets, 2 hits each | 3.4 seconds | 160 damage |

Pressure increases at 30/60 seconds or 70%/35% remaining Rex health, whichever comes first. Later attacks arrive sooner and damage the Jeep more. The first attack warning arrives after 4.5 seconds of pursuit; subsequent pursuit gaps are 4/3.3/2.6 seconds. Successful sequences buy 3.05 seconds to reload. The Rex has 5,600 health; normal rounds deal 10 body damage or 14 head damage, and explosives deal 190. Head impacts use the same neutral hit feedback as other bullets, with no headshot callout.

Incoming wood debris adds a competing target. A low bough first passes over the Jeep intact, anchored to a roadside tree. When the Rex reaches it, the tip snaps off with a head recoil, wood cracks and splinters; only then does its red target and interception timer appear. Shoot the red square before it reaches the Jeep: it takes 2/3/3 rounds with 1.8/1.5/1.25 seconds to intercept, and a miss costs 8/10/12 integrity. Flight and tumbling are now 2–2.4 times faster than the original branch attack. The first branch approaches after 12 seconds and branches become more frequent under pressure. They can break during a Rex objective. A grenade clears the projectile in one hit, even while the gun reloads, but that spends the same explosive cooldown used against the Rex. A shot into debris does not also damage the animal or complete a gold target.

At 45 seconds or 50% Rex health, whichever comes first, a single 8.3-second jungle detour queues for the next safe break. Active objectives, committed attacks and incoming wood finish first. She veers into the left-hand treeline, disappears behind dense understory for almost three seconds, then bursts back from that same side just behind the Jeep with falling saplings, foliage, dust and a synchronized roar. She remains rendered and animated along a continuous path behind three layers of vegetation; there is no visibility switch or teleport. The gun stays live throughout. Rounds cannot find her while she is hidden, and she cannot go down in the trees (a killing shot as she breaks off leaves her at 1 health until she is back on the road). Her plunge flushes two files of compies out of that treeline and across the road behind the Jeep. Reload and weapon cooling continue while the chase clock holds, and her return is followed by a full timed target attack. The cinematic does not inflict automatic Jeep damage. Pause and restart also cover the detour.

The wildlife is fair game too, and it is tallied. Debris and numbered targets keep priority, and an animal only takes a round if it is nearer than the Rex; none of it affects the Rex, the clock or the Jeep. Small animals have a hit area of at least about 12 pixels (18 on touch). Every kill shows its species and the running count ("GALLIMIMUS DOWN · 5"), and the results screen lists the bag by species.

- **Compies** forage on the road and bolt across it; the detour flushes two files of them across the road behind the Jeep. A hit sends one tumbling; it lands on its side with its legs drawn up and rides the road away. **Lizards** bask on the verge rocks.
- **Gallimimus** herds (once or twice a chase) gallop out of the forest and stream across the road behind the Rex. A shot one crashes at full speed and rolls.
- **Dimorphodon** cling to the road side of the trunks of the trees that lean over the road, wings half open. A round close by, a big noise, the Jeep passing underneath or the Rex striding past flushes them, and they flap out across the road and away.
- **Pteranodon** fly in twos and threes down the open corridor over the road from far behind the Rex, passing overhead, or across it. A shot one spirals out of the sky.
- **Birds** burst out of the canopy at her roars, the crash of her return and the brachiosaur's stomp.
- An explosive takes out everything within about 5.5 m. Shoot the passing **brachiosaur** and she trumpets and rears up on her hind legs, as in the film, then drops back onto her forefeet with a thud that shakes the ground (she is not tallied).

Every loss (bite, ram, debris or timeout) cuts to the player's first-person position and locks that view for the finish. The Rex rushes alongside and strikes the Jeep at 1.65 seconds. The complete gun assembly tears free, tumbles through the air and bounces onto the verge. The Jeep and player camera make one full 360-degree spin together, shedding dust as the vehicle skids to a stop at 4.65 seconds. Only then does the Rex follow a gentle curve toward the player, facing the direction of travel and transferring her weight before a planted leg overextends. She settles with separated feet, her jaw closed, and pauses to look at the player. She quickly opens her mouth, throws her head back and lunges forward into a gulp; the wide gape lasts less than half a second. The camera stays at the seat through the windup, then aligns with her jaws for contact. Contact gives a brief red flash while an opening at the back of the gape expands. The player holds still just inside the mouth as the jaws close. She then lifts her head, tipping the view back, and the player slides 1.8 seconds down a collapsed esophagus seen as an endoscope would: wet mucosal folds converge ahead, peristaltic squeezes press the walls onto the lens, vessels pulse with her heartbeat, daylight glows red through the tissue and ropes of mucus stretch and snap, while slime and blood smear the lens. The cardia opens into the stomach: churning, ulcerated rugae over a frothing, fuming acid pool with half-digested prey, and Gennaro, days into digestion, slumped chest-deep with his face eaten to a lipless grin and a hand stripped to bone. The view drops past him and goes face first into the acid, where the lens blisters and burns before the retry screen. The finish lasts about 15.35 seconds; pause freezes the vehicle, gun flight, approach, interior, audio and fade. Restart reattaches the gun, restores the vehicle transform and clears the interior and fatal overlays. The interior pass only renders during the swallow, uses a capped render resolution and reduces camera roll when reduced motion is requested.

The roadside now has an open verge with small ferns and scattered shrubs. Larger trees stand farther back, and three understory layers become progressively taller and denser deeper in the jungle. The Rex travels farther into that cover during her detour. Scenery and road extend in both directions so the full Jeep spin keeps the player surrounded by jungle.

Tuning values live in `src/chase/combat.js`. Pause freezes the fight, target and debris timers, movement and sound playback. Restart resets the clock, random sequences, incoming debris, damage, entrance props and active calls.

## This iteration

### Chapter 02: Raptor Ravine

**Raptor Ravine is temporarily open for play-testing** from the chapter link or `ravine.html`; no Rex win is required. Pursuit victory still offers **Next level** and records the earned unlock separately. Survive an 86-second pack chase through a sunlit canyon, under an abandoned viaduct and through the north evacuation gate. Marked raptors are about to leap; stop them first, and use grenades against a clustered pack. The final six seconds close the barrier behind the Jeep.

The new creature is Animaniac888's CC0 [Dromaeosaur Raptor](https://blendswap.com/blend/4889), with its authored 2K maps and repaired eyes/mouth binding. The menu uses a planted idle pose. The canyon combines Poly Haven's CC0 [Namaqualand Cliff 02](https://polyhaven.com/a/namaqualand_cliff_02), [Sandstone Cracks](https://polyhaven.com/a/sandstone_cracks) and [Gravelly Sand](https://polyhaven.com/a/gravelly_sand) with continuous terrain, overlapping fractured outcrops and talus. Sources and authoring instructions are in [the chapter reference](docs/RAPTOR-RAVINE.md) and runtime provenance. The existing Rex retains its CC BY 4.0 attribution.

Progress and separate fair/cheat records are saved on this browser. First/third-person cameras, the existing touch controls and both cheat toggles work in the new chapter. `npm run test:ravine` checks progression and full gameplay flows.

### Existing jungle chase

- A river ford about twenty seconds into the chase. The Jeep rides down the bank into knee-deep, silty water and up the far side; its front tyres throw sheets of spray out along the doors and the rear tyres throw rooster tails, with a V wake, churned silt and foam behind. The Rex follows: each footfall is a plunge with a crown and white water, and her swinging feet throw water ahead of her stride. The river reflects the treeline, the canopy gaps and the Rex herself, flows downstream past foaming boulders and a drowned log, shows caustics on the shallow bed, and takes the storm's rain rings. Rounds and grenades raise spouts and columns of water. Spray that lands on the banks darkens them, the tyres print wet tracks for about 25 m and her feet leave wet prints, all drying slowly. The river, the tyres' churn and the splashes are real recordings.
- Mud and water build up on the Rex over the chase. Every footfall flings more splatter up her legs, belly and the underside of her tail, far more in the storm. On a dry day it dries to a lighter crust. The river rinses her legs and belly clean and soaks her to the line the spray reached; she streams water for a while, then dries from the top down. In the storm the rain keeps soaking in as she runs, and water runs down her hide. The Jeep's lower body is soaked by the crossing and dries too.

- Leathery skin finish: the chase remaps the authored roughness texture into a softer highlight range and lowers reflections on the hide. Scale normals remain intact; powder burns stay dry, wounds retain restrained moisture, and the eye and mouth materials keep their existing finish.
- Stopped-Jeep opening: the camera turns toward the right-hand jungle, the Rex breaks through falling saplings with flying leaves, splinters and dust, turns onto the road and roars. The Jeep accelerates into the chase while her stride follows travel speed. At rest, her feet settle beneath her instead of retaining the last sideways step.
- Interactive attack cinematics in both camera modes, randomized face/body targets, incoming breakable wood, rising pressure, attack feedback and the 90-second escape deadline. A failed challenge leads into the existing bite/ram animation. Touch reload/fire controls sit on opposite sides to keep the center clear for the additional targets.
- The supplied named sound catalog now populates the sound library and runtime. Roar jaw motion follows the decoded clip's amplitude envelope and actual audio playback clock, including playback-rate changes and pause/resume. Only one Rex vocal plays at a time. Real footfalls, bite and pain clips accompany actions, with quiet distant raptor/brachiosaur calls between attacks.

- Separate walking and running rhythms: at the menu's 2.2 m/s road speed, the gait uses about 0.96 footfalls per second with overlapping ground support. At the 10 m/s chase speed it uses about 1.94 footfalls per second, down from 2.70, with a broader leg sweep. Swing recovery preserves road velocity near contact and pelvis movement during a charge; the reach reserve prevents a planted knee from locking. These are cinematic game speeds and authored gaits, not a validated reconstruction of dinosaur locomotion.
- Left-hand steering and a seated Muldoon-inspired driver, visible in the menu and third person. The driver wears a bush hat, stone-colored safari shirt and shorts, utility vest, park ID, belt and boots; both hands follow the steering rim through small corrections. The external camera now sits on the driver's side. Costume reference: [Jurassic Park Motor Pool's Muldoon guide](https://www.jpmotorpool.com/reference/cosplay/muldoon.php). The character is procedural geometry; no reference photography is shipped as its texture.

- Original brown rex hero asset retained, with procedural running on its 130-bone rig. Roaring layers over locomotion: she stands while the Jeep is stopped and keeps running whenever it is moving. Feet plant in scene space and travel with the road during contact, then recover on a lower, smoother arc. Exact toe-off timing avoids double-counting the first airborne frame and snapping the hip. Cadence follows pursuit speed; the torso absorbs each step while the head stays steadier and the tail counterbalances. Bite, ram and stagger also layer onto the gait. Recovery distance changes are limited to keep her moving forward relative to the road.
- Each foot landing kicks up a small cloud and grit, with a low thump. Dust stays relative to the moving road and fades from a bounded particle pool.
- Death stops the running cycle and she goes down face first at speed. A small physics rig (240 Hz, frame-rate independent) carries her torso on buckling legs; the dragging feet trip her, the chin and chest hit, the hips follow and she skids on her belly until friction stops her (further in the wet). The neck and tail are mass chains that whip, slam and drag; each foot plants, folds and trails by IK. The ground records it: a ploughed furrow from the jaw, a belly smear, claw rakes and a tail drag, lit as relief and pooling rain in the storm; a bow wave of clods and rolling dust (muddy water sheets when wet); a ground surge at each landing; a mound of soil against her jaw; mud and dust caked where she hit; a last breath that stirs the dust; and a scrape built from the dirt-strike recording. The victory camera follows her down before pulling back, and victory waits for the 5.2-second sequence to finish.
- Tongue finish follows the supplied mouth reference: muted rose, a darker root, subtle central shading and a softer moist sheen. Original texture and normal detail remain, with the same finish shared by the chase and creature study.
- A procedurally built rainforest: buttressed giants with lianas, leaning trees that close a canopy tunnel over the road, palms, tree ferns, ferns, elephant-ear and banana leaves, mossy rocks, fallen logs and wind-blown grass on a rutted dirt road with leaf litter and wet patches.
- A living jungle: compy packs dodge the Jeep into the verge, then scatter again, some straight across the track, as the Rex comes on. Lizards bask on verge rocks and bolt. Butterflies and dragonflies fly by day (rain grounds most of them) and moths gather in the flashlight at night. Now and then a brachiosaur browses at the forest edge with her neck over the road and calls as the Jeep passes. The track carries storm-snapped branches, torn leafy limbs, dead fronds, pebble drifts and tyre ruts with tread marks.
- HDR rendering: sunlight dappled through the canopy, ray-marched light shafts, sunbeam motes, a procedural sky and forest-lit reflections, height fog, bloom and a filmic grade. Low/Medium/High/Ultra quality tiers (Auto by default) with dynamic resolution; the menu and Pause offer a graphics picker.
- Hide detail on the Rex: earthy regrade, dorsal banding, scales, mud, breathing ribs, blinking eyes, stained teeth and a wet, dark mouth interior when she roars.
- Wrangler-style open Jeep with cage, seats, spare tire, fenders, grille, treads, suspension movement, ammunition box, pintle-mounted gun, brass belt and a gunner visible in third person.
- Raycasts against the animated mesh. Each impact is mapped back to its undeformed triangle, keeping bullet punctures and explosive scorch/blood on the part hit, including the face. A persistent 1024-pixel wound atlas retains impacts after the 36 detailed recent-wound clusters cycle out. Repeated nearby hits enlarge a cluster. Three cumulative damage stages add irregular bruising, powder burns, dark punctures and short blood runs across the snout, brow, jaw, throat and shoulders. Skin texture remains visible underneath. Marks follow the animated skin through roars, the jungle detour and the death fall, and clear on restart. These are surface effects, without dismemberment or geometry destruction.
- Reloading, heat, muzzle flashes, tracers, ejected brass, impact particles, grenade blasts, hit confirmation, Jeep damage feedback, boss health, touch controls, pause and win/loss loops.
- Actual dinosaur calls from the supplied recording. Weapon, engine, wind and impact sounds use Web Audio synthesis. Audio begins with the Start button to meet browser autoplay requirements.

This is a playable visual concept, with the existing artist-authored rex as the strongest art asset. The Jeep, jungle and gunner remain procedural concept art; they are not scanned or film-production assets. The running gait, wounds and chase-specific motions live in the web code, not in the existing exported GLB.

## Audio workflow

The original `audio_reference/joelfazhari-jurassic-dinosaurs-sound-effects-372727.mp3` remains untouched. `npm run audio:split` decodes it with Chrome, finds quiet gaps, and writes numbered mono 24 kHz WAVs with short fades into `audio_reference/clips/`, alongside source timestamps and a waveform SVG. Runtime copies are in `public/audio/` (about 3.5 MB for all 34 clips).

The named catalog from `audio_reference/clips/rex-sound-catalog.json` is incorporated into `public/audio/catalog.json`. Defaults now use 01 for the opening roar, 02 for attack roars, 09 for Rex growls and 27 for pain. Footsteps cycle through 03–06; bites use 18. Distant ambience uses raptor calls 11/12/14 and brachiosaur calls 30/31. The passing brachiosaur calls with 30/31 from her head, and scattering compy packs chirp with raptor clips 12/14 pitched up. The earlier prototype's raptor squeal assignment (13) and unlabeled pain assignment (19) are migrated to the correctly labeled Rex clips. Explicit choices subsequently saved in the sound library remain customizable.

Names and roles save to this browser's local storage; export the catalog for a portable copy. Restart the encounter to reload choices saved from another tab. Roars sample a 60 Hz amplitude envelope from decoded audio and use the AudioContext playback clock. The opening accommodates the selected roar's duration. Ambient dinosaur calls never drive the Rex jaw.

## Model and art files

- `public/models/rex-hero.glb` — brown, refined animated model, approximately 12 MB, 13.7 m long and 5 m high.
- `art/rex-encounter.blend` — editable Blender master with packed textures and five actions: Idle, Roar, Bite, Recoil, Tail.
- `public/models/rex-encounter.glb` — intermediate normalized rig and standing animation export.
- `public/models/brachio.bin`, `brachio-low.bin` — the brachiosaur, generated by `npm run art:brachio` (`scripts/build-brachio.mjs`). The user-approved reference study has a compact deep ribcage, full curved neck, columnar legs and short low tail. Profile-controlled signed-distance lofts are meshed and baked with occlusion, crease cavity, body regions, a smooth limb mask and spine coordinates for animation. High is 83,496 triangles / 1.42 MB; Low is 28,468 / 0.48 MB. Rebuild and ship both binaries with the material code. Authoring lessons are in the project skill's [Living jungle reference](.agents/skills/rex-pursuit-maintainer/references/animation-and-rendering.md#living-jungle-critters-insects-brachiosaur).
- `art/source-draco.glb` — original attributed source distribution.
- `public/textures/jungle-branch.png` — generated transparent foliage texture.
- `public/textures/visitor-fossil-relief-v1.png` — generated carved entrance relief; see [Visitor Center references and provenance](art/visitor-center-references.md).
- `src/chase/` — environment, Jeep, creature, impact materials, combat, effects and audio modules.
- `art/review/` — browser captures and verification reports.

Rebuilding the original hero: run the server, `npm run art:export` (visits `model-lab.html?author=1`), then run Blender in background with `art/finish_rex.py`. The chase uses the exported hero without modifying that master file.

## Verification

The park Jeep now has sand-beige paint, red diagonal stripes and steel wheels, square YJ-style headlights, original canvas-drawn park badges, number 18 markings, a winch, mirrors and dust along the sills. Styling reference: [Movie Cars Central's Jurassic Park Jeep gallery](https://www.moviecarscentral.com/en/location-jeep-jurassic-park). Reference photos are not shipped as game textures. The external camera is pulled back to include the front bumper.

The mounted gun uses a shot-driven linked belt, separate pooled brass cases and steel links, receiver/barrel recoil and a short muzzle flash. Its 2.6-second reload opens the cover, withdraws the belt, swaps the can, feeds the new belt, closes the cover and then pulls the charging handle. The gloves have four articulated fingers and a separate thumb, padded palms, knuckles, seams and cuffs. Wrist turns follow the part being handled; a two-bone arm solver preserves upper-arm and forearm lengths, with shoulder reach instead of stretching. The left hand follows the cover, can and feed belt; the right supports the gun before operating the charging handle. Empty-belt, pause and restart states share the game's ammo/reload state. These are authored game animations, not a physics simulation of the mechanism.

With the preview server running:

```powershell
npm test
npm run test:gait
npm run test:motion
npm run test:vehicle
npm run test:gunner
npm run test:arcade
npm run test:pressure
npm run test:cinematic
npm run test:ford
npm run test:wildlife
npm run test:treeline
npm run test:defeat
npm run test:victory
npm run test:balance
npm run build
npm run test:build
npm run test:lab
```

Tests cover combat outcomes at different frame rates; actual browser shooting and head wounds; explosives; reload lockout; charge interruption; rig validity and alternating feet; pause; restart; victory/defeat; phone and landscape controls; sound naming/export; and the packaged site under `/dist/`. The gait check measures planted-foot sliding and leg reach at 30/60/144 fps and verifies running in the first second of the roar. The motion check measures knee/hip rotation speed, alternating dust events, road-relative drift, stopped stride after death, full skinned ground clearance and final settling. It captures side and game views of the fall. The packaged-site check also pauses a fall and verifies delayed victory and reset. Browser tests use locally installed Chrome via Playwright. Runtime performance still depends on the target device; phone checks are viewport/touch emulation, not physical-device profiling.

The arcade check exercises the full entrance, stationary road before launch, actual roar/jaw playback, audio pause, ordered target shots in both views, the harder two-hit sequence, committed attacks after failure, deadline damage lock, timeout defeat, restart and phone/landscape objective layouts. Combat tests cover all pressure tiers and timer boundaries at 30/60/144 Hz.

The pressure check shoots all 12 anchors in both cameras and phone/landscape viewports, verifies clear target paths past the HUD, intercepts debris with bullets and grenades, checks concurrent objective accounting and pause, and confirms that head impacts no longer show special text or color. Seeded combat checks cover randomized orders, every site, missed/lethal debris and reset. `test:balance` simulates 80 runs for each aim/accuracy profile and saves `art/review/pressure-balance.json`; these are tuning regressions, not human playtests. Ignoring every threat loses despite perfect head fire; fast/accurate play remains viable across multiple escalating attacks. Real player difficulty still needs playtesting.

The cinematic check covers the physical branch contact and full projectile window; both midpoint triggers and deferred objectives; paused fight time with continued reload; continuous travel through the concealed route; close return and roar/jaw synchronization; knee/hip continuity at 30/60/144 Hz; persistent wound-atlas overflow; damage-stage closeups; both camera views and phone framing; and clean restart. Captures and the report use the `art/review/cinematic-*` prefix. The wildlife check holds fire in the opening, fires through the detour with no damage to the hidden Rex, shoots down crossing compies, makes the brachiosaur rear and stomp, shoots a Gallimimus, Pteranodon, Dimorphodon (whose roost-mate then flies), bird and lizard, checks the bag on the results screen, and confirms a restart clears it all. The treeline check renders a diagnostic silhouette with and without surrounding scenery to measure actual foliage occlusion from both camera views. The defeat check exercises all four loss causes, forced first person, view/fire lockout, gun detachment, exactly one vehicle revolution, a stopped Jeep before the walking approach, a closed-jaw stare, a brief gape, visible head-back motion, a fast gulping lunge, jaw framing, a clearing red flash, the throat slide, full blackout, pause during the spin/interior and full reset. A separate rig check covers the braking steps before the walk as well as the curved approach at 30/60/144 Hz, with varied starting strides and timeout speeds. It checks foot/knee separation, leg reach, low foot clearance and continuous recovery motion. Recoil steps follow actual travel relative to the road, taper smoothly into contact, and settle before a fresh walking cycle starts. Pure timeline checks run at 30/60/144 Hz; browser captures include phone and landscape framing.

The vehicle check verifies shot/feed/ejection counts at 30/60/144 fps, empty-belt and reload presentation, rejected shots, case expiry, finite transforms and reset. Reload checks verify fixed upper-arm/forearm lengths and contact with the moving cover, can and charging handle in both views. The driver and wheel stay in the left seat, hands remain on the animated rim, and driver visibility follows the camera. The gait check includes six seconds of menu walking at each frame rate, requiring continuous ground support, a slower cadence, broad leg sweep and alternating contacts. These checks save first-person, third-person, driver-detail, walk/run and reload-stage captures in `art/review/`.

The rear player is a field palaeontologist inspired by [Alan Grant's 1993 outfit](https://bamfstyle.com/2019/09/14/jurassic-park-alan-grant/), with a blue work shirt, red neckerchief, woven hat, khaki trousers and boots. Its face, clothing and textures are original procedural geometry/materials in `player-character.js`. The braced stance clears the Jeep cage, and the torso follows the exterior reload. `test:gunner` checks head/hat clearance, shoulder reach, camera visibility, winning arrival and phone framing.

## Attribution

Base mesh, textures, rig and original **RunRoar** animation: **Tyrannosaurus Rex 2.0**, by **Stevenson / TStevenz**.

- Original: https://sketchfab.com/3d-models/tyrannosaurus-rex-20-512712b314404760a860389ebd0ce78a
- Creator: https://sketchfab.com/3dCoast
- Source distribution: https://naver.github.io/egjs-view3d/model/draco/trex.glb
- Distribution attribution: https://naver.github.io/egjs-view3d/docs/options/model/fixSkinnedBbox
- License embedded in that distributed GLB: **CC BY 4.0**, https://creativecommons.org/licenses/by/4.0/

Modifications: skull proportions, standing pose, outline-shell removal, clean skeleton rebind, jaw hierarchy repair, brown palette, skin subdivision, original behavior clips, procedural running, impact materials, lighting and web presentation. The current Sketchfab listing has different license metadata; provenance here is the CC BY 4.0 copy distributed by NAVER and its embedded author/license/source fields. The source is retained in `art/`.

Dinosaur audio was supplied by the user in the reference MP3; its filename identifies joelfazhari. River ford audio (CC0, Freesound): large stream by HowardV (777116), fast river wading by paulprit (563555), big water splash by qubodup (442773), water splash by Sheyvan (469608), water slaps and spray by kyles (637974) and a car through water by bengomori (381699); each at https://freesound.org/s/<id>/, trimmed by `scripts/prepare-ford-audio.cjs`. Storm audio (CC0, Freesound): heavy rain loop by Rubaoliva (https://freesound.org/people/Rubaoliva/sounds/624645/), close thunder by loganzsound (https://freesound.org/people/loganzsound/sounds/840628/), distant thunder by Fission9 (https://freesound.org/people/Fission9/sounds/581125/). World sounds (CC0, Freesound): heavy machine gun by SuperPhat (396324) and ShawnyBoy (165391), jungle ambience by paulprit (724054), diesel engine by AugustSandberg (264864), bullet flesh impact by JustInvoke (138480), ricochet by aust_paul (30932), branch crack (164472, account since deleted), explosion by florianreichelt (563010), forest wind by teadrinker (403051), machine-gun reload by ken788 (386777), birds taking off by Hope-Sounds (499679); each at https://freesound.org/s/<id>/. Foliage texture generated using OpenAI ImageGen. Jeep, environment geometry, effects, interface cues and the swallow/interior sounds authored for this prototype.

The 1993 Jurassic Park T. rex is the visual reference for this unofficial fan concept. The model is an attributed artist-created foundation, not a verified movie replica or an original film production mesh.
