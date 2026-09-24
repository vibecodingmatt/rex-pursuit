# Animation and rendering lessons

Read the sections relevant to the reported issue. Values below describe the September 2026 implementation; inspect current constants before changing timing.

## Rig and road-relative locomotion

The chase loads the brown `public/models/rex-hero.glb`. Runtime motion is procedural on the existing 130-bone rig; editing an exported clip does not automatically change the chase. `createRex()` restores rest transforms each frame and layers gait, body motion, vocals, impacts, and scripted poses. Keep bone updates in this ownership model rather than adding competing frame loops.

The road moves toward scene +Z. The actor faces approximately PI yaw toward the Jeep. Planted feet live in scene space and advance with the road, so actor speed alone does not describe a stride. `RunGait.advance()` derives speed from root velocity relative to ground velocity. Cadence follows this speed; the menu walks more slowly than pursuit, and locomotion continues under a roar while moving.

Prior defects and their fixes:

- **Small rapid steps:** tune frequency, stance duration and reachable travel together. Slowing a phase clock alone can make plants slide or knees lock. Menu walking needs continuous support and a slower cadence, not a slowed running pose.
- **Knee snapping at toe-off:** reconstruct the exact fractional toe-off instant. Advancing the old plant by a whole frame double-counted the first swing interval. Swing endpoints use quintic blending and short contact-velocity windows; carrying full road velocity through the whole arc throws the foot behind the hip.
- **Crossing legs during the final walk:** the root follows a curved path and its heading follows that path's tangent. Sliding sideways while facing the Jeep makes planted legs cross the pelvis. The final approach transfers weight sooner to avoid exhausting leg reach.
- **High right-leg kick immediately after the spin:** the torso still faces the Jeep while the root recoils away. In `solve()`, the recoil blend points foot travel toward `rootVelocity - groundVelocity`; otherwise IK tries to rescue an unreachable target by lifting the foot. Flexion reserve tapers into landing. Entering the final approach resets phase/speed and leg initialization after the settled beat, rather than resuming the interrupted recoil swing.

`verify-defeat-gait.cjs` tests 30/60/144 Hz with varied entry strides and timeout speeds. The regression window is 3.5-5.5 seconds: toe height < .55 scene units, vertical speed < 3.5 units/s, knee angular speed < 16 rad/s. During the approach, toe/knee separation stays > .65 and reach error < .15. These are useful regression bounds, not a definition of natural motion; inspect the captures too.

A slow-Jeep loss (`verify-defeat-gait` case warm 1 s, speed 1) has a pre-existing kick just before that window. Around 3.3 seconds a right-foot swing target is horizontally out of reach. `lowest` then evaluates `sqrt(max(.05, reach² - horizontal))` as about 0.22, which lifts the target to just below the hip. The fully extended leg holds the claw about 2 m up until 3.41 seconds, then drops in one frame (about 26 rad/s at the knee). The window sees only the tail of that drop. The kick predates the foot articulation and remains unfixed.

### Foot roll and toes

The user found the rigid, flat feet unnatural. `FootMotion` in `foot-motion.js` articulates the metatarsus and toe bones from step-cycle keys. Positions are fractions of stance and swing, with walk and run values. A periodic monotone cubic interpolates them, so held poses stay held and planted toes never dip. In stance, the metatarsus leans back at touchdown and rolls forward over the balls of the toes. The ball then lifts, and the toes peel off from the base outward. In the air the toes curl and gather, then straighten and fan out, arriving flat at touchdown. The dewclaw tucks.

- The middle claw tip (`foot_02_04_*_end`) remains the IK contact. `reach()` gives the ankle-to-claw vector for the current angles, and the ankle target is the contact minus that vector. Planted claws therefore never slide, and the claw-based slip checks still apply.
- The metatarsus rolls about the line through the balls of the toes, and the toe bones are counter-rotated so planted toes stay flat. Toes spread only in the air; spreading planted toes would skid them.
- Curled toes raise the ankle for a given claw height, about 0.3 m at the swing peak. With the rigid foot, the reach clamp used to lift the running claw about 0.1 m above its arc, and the ±0.3 alternation checks in `verify-gait` and `verify-chase` relied on that. The rest pose also plants the claws at different heights (right 0.080, left 0.1125), so the right foot's margin is the smallest. The run lift is 0.36 so that the arc alone clears those checks.
- Recoil steps after the ram blend toward `RECOIL`, which reproduces the old rigid tilt. There the torso faces the Jeep while the body slides sideways or backward. A forward roll carried the ankle away from the hip and popped the claw up at toe-off. Curled toes made the fast catch-up swing exceed 16 rad/s at the knee. Zeroing the articulation instead overextended the leg at toe-off, because the tilt had been buying that leg reach.
- The toes straighten gradually across the late swing and arrive flat at touchdown. While they are tipped down, the claw remains the lowest point, so they cannot catch the road early.

For foot changes, compare low side and front close-ups that track the ball of the foot through one stride at walk (road 2.2) and run (road 10) speeds. Check the menu and third-person framing too.

Footstep dust and sounds consume footfall events, not a separate sine clock. Keep particle pools bounded and dust moving relative to the road.

## Two different endings

**Rex dies / player wins:** `death-motion.js` captures the current stride, stops gait, buckles the supporting leg, falls, partly rolls and slides. Damped spine, neck, limbs and tail responses prevent the board-stiff fall the user disliked. Skinned contact samples constrain ground penetration. Victory waits for this roughly 5.2-second sequence. This is authored motion with damping and contact constraints, not a full ragdoll solver.

**Player loses:** one `DEFEAT` clock drives the Rex, detached gun, vehicle, camera, overlays, audio cues and interior. Every loss route uses this sequence and locks first person and shooting. Avoid independent timers or arbitrary camera delays.

| Beat | Current defeat clock |
| --- | --- |
| Rex strikes side; gun detaches | 1.65 s |
| Jeep completes one 360-degree spin and stops | 4.65 s |
| Fresh walking approach starts | 5.00 s |
| Closed-jaw look at the player | 8.55 s |
| Brief gape / head-back windup / lunge | 8.90 / 9.22 s |
| Interior begins blending / contact | 9.46 / 9.56 s |
| Still mouth beat, then swallowing head lift | lift begins 10.20 s |
| Descent and muffled swallowing audio start | 10.85 s |
| Head lift completes | 11.10 s |
| End of 3.2-second descent | 14.05 s |
| Full black / retry screen | 14.85 / 15.40 s |

The wide gape lasts less than half a second. The external camera stays at the seat during the windup so following the head does not cancel the visible head-back motion. It then aligns between skinned lip landmarks. A brief red contact flash clears to reveal the interior.

`swallowPose()` shares the hold, head lift and slide curves between the rig and interior. The interior camera remains at the entrance until `slideAt`; it tips before translating. Bite calls stop as the jaws seal; swallowing sound starts at descent and lasts through the slide. Pause freezes the encounter clock and suspends the AudioContext. Restart resets gun attachment, vehicle transform, gaze, gait, wounds, interior and overlays.

## Interior rendering

`swallow.js` builds a curved, folded tube with a traveling contraction and a wider dark chamber. Keep the effect the user approved while adjusting its motion.

- Capture the aperture's projected origin before the lips pass behind the camera. Reprojecting those points later flips the opening under the tongue.
- Tube geometry extends behind the interior camera so the entrance rim cannot expose black gaps.
- Use periodic angular coordinates for tissue noise; an unwrapped angle causes a visible seam.
- Render to HalfFloat when `EXT_color_buffer_float` is available, with the existing byte fallback. Preserve the color-space conversion and composite dithering; missing shader chunks or double conversion caused bad shading/compilation previously. `dithering_pars_fragment` needs `common` for its helpers.
- Cap the target resolution at 1280 by 900, skip normal-world rendering while the interior covers the frame, and preserve/restore render target and `autoClear` state.
- Reduced motion lowers tilt/roll. A paused frame still renders the same interior composition. Darkness follows the descent rather than immediately covering it.

## Rendering pipeline and scenery (September 2026 overhaul)

See the dated handoff entry for the full description. Invariants:

- Only `renderFrame()` goes through `post.render()`. Diagnostics that call `renderer.render()` directly (treeline masks, reflections) still work. The swallow composite must stay after the post pass.
- Tone mapping and sRGB conversion happen once, in the final post pass. Scene materials render linear HDR into the half-float target; do not add `colorspace_fragment` to post shaders or tone-map twice.
- The canopy shadow caster lives on layer 0 with `colorWrite:false`. three picks shadow casters by the main camera's layers, so moving it to another layer silently removes the dappled light.
- Keep the 15-27 m understory belt dense and unthinned; `test:treeline` measures concealment through it. Tier thinning only touches shuffled optional planting via draw ranges.
- Ground noise frequencies must repeat over 28 m (`28*k` whole) or every chunk boundary shows a seam.
- Never draw a second pass into `sceneTarget` after `renderer.render()`. three resolves MSAA by blit and then invalidates the multisampled colour buffer, so a second pass with `autoClear=false` draws over undefined contents. Soft smoke (`soft-smoke.js`) therefore renders into its own half-res `smokeTarget`, reads the resolved `depthTexture`, and is composited in the final pass. Skip the depth read when `WEBGL_multisampled_render_to_texture` is present: the depth texture is then the live attachment.
- Camera motion blur lives in the final pass (depth + previous view-projection). It is off on Low and with reduced motion, fades out as `defeatVision()` takes over, excludes pixels within about 3 m of the lens (gun, arms), and restarts its history on camera cuts.
- AO and sun contact shadows (Medium and up) run at half resolution from the resolved depth, then a 4x4 bilateral blur and a depth-aware upsample in the final pass. The noise is a fixed 4x4 Bayer tile with no per-frame jitter, so it cannot shimmer; don't add temporal jitter without adding reprojection. They switch off while the swallow interior is active (`post.settings.aoAmount`).
- The scene target's alpha channel is the AO mask while `post.render()` draws the scene (`AO_MASK` in `post.js`): plant materials with translucency write 0.3, so swaying leaf cards and grass neither cast nor receive much AO. A custom opaque shader that writes alpha below 1 will lose AO; one that writes 1 over leaves will make them flicker.
- Don't hide streaming with a distance-based screen-door dither. Scenery always occupies the fade band, so the dither shows permanently on the far verge. Chunk ends fade into the fog instead (`vFade` in the plant shader), and grass tufts grow in by rank (the `tuftRank` attribute) as the draw count rises.
- `frame()` clamps negative time steps. A negative `dt` makes every damped blend diverge (camera FOV went to about -1e11 on phones).

## Skin, wounds, tongue, eyes

The runtime skin is `Rex_Skin` / `BodyMat`. The original texture includes a roughness map; setting `material.roughness=.72` multiplies its green channel rather than setting the final roughness to .72. Inspection found an average around .48 after that multiplication, producing strong wet-looking highlights on the face, body and feet.

The accepted correction in `creature.js` / `damage.js` sets the base factor to 1, remaps the sampled roughness with `mix(.48,.86,clamp(roughnessFactor,0.,1.))`, and reduces skin `envMapIntensity` from .45 to .30. Soot roughens the surface; wounds use restrained local moisture. An earlier .70-.94 remap looked too matte, so keep some highlight definition. Preserve authored color and scale normals. Do not dim all scene lighting to fix only the hide.

`ImpactDamage.install(material, finish)` owns the skin's `onBeforeCompile`; the hide finish from `rex-skin.js` is passed as `finish` and extends the shader after the wound code, so wounds render on top of it. Apply or compose skin shader edits there rather than overwriting the damage hook elsewhere. Update `customProgramCacheKey` when changing shader structure. Verify clean, staged damage and actual impact marks, not only pristine skin.

Hits map from deformed triangles back to rest space. A persistent 1024px UV atlas retains damage when the 36 recent clusters wrap; stage sites add face/body wear based on the worst health reached. Do not return to dinosaur claw-like scratches or erase older wounds during the jungle detour.

`finishTongue()` in `src/creature-materials.js` is shared by chase and lab: muted rose multiplier, darker root, subtle central crease, reduced normal intensity and bounded moist roughness. A saturated red multiplier made it unnaturally bright. Corneas/eyes use separate materials; their moisture and pupil tracking should not be flattened along with the hide. Gaze converges on the viewer in first person/menu and on the gunner in third person.

## Cinematic cover and audio

The midpoint feint exits and re-enters the left side. Use the continuous `ambushPose()` path and actual vegetation occlusion, including third person; `actor.visible=false` or a teleport is visibly wrong. Keep the verge open and concentrate dense cover farther from the road. Branch projectiles begin at the Rex's contact with a low bough, with a full interception window after breaking.

Named runtime clips live in `public/audio/catalog.json` and `public/audio/clip-NN.wav`. Raw references remain local. Default roles are opening 01, charge 02, growl 09, pain 27; footsteps 03-06 and bite 18. Roars use the decoded 60 Hz amplitude envelope and AudioContext playback clock, including playback rate and pause. Ambient calls never animate the Rex jaw. Rex vocals route through one HRTF panner at her head (`audio.listen()` each frame, listener on the camera); footfalls, bullet hits and distant calls get one-shot panners at their world positions. One-shots feed the generated forest reverb by their own `wet` amount; the loops stay dry, and `swallow()` closes the reverb return. The opening accommodates the chosen roar duration. Sound-library local storage can override the catalog, so use a fresh browser context when reproducing default audio behavior.

## Mobile and vehicle details

`pointer-controls.js` owns independent aim and fire pointer IDs. Aim appears 96 CSS pixels above the thumb in portrait and 72 in landscape, shifting sideways at the top edge. The displayed reticle, raycast and gun aim use the same offset. Do not apply the offset to desktop mouse input or make fire steal the aim pointer.

Keep `user-select`, WebKit callout suppression, touch actions, pointer capture/cancel handling, and large buttons coordinated. Pause, blur, orientation changes and restart clear held input. Short portrait layouts put camera choices in Pause. Test actual Playwright touch events, not only synthetic mouse clicks.

The left-seat driver and wheel, shot-driven ammo belt/case/link pools, and 2.6-second articulated reload use the game state. Arm IK preserves limb lengths while shoulders accommodate reach. Do not fix a reload contact error by stretching forearms or driving the belt from elapsed time when no shot was accepted.

## Hide sheen and mouth interior

The user asked that the Rex not look washed out or too shiny, and that the open mouth look natural and high fidelity. Keep these in mind:

- Legibility first: the sun must light her face as she chases (key from above and behind the Jeep). A sun behind her made her a dark silhouette, and the user flagged it. Compare against the pre-overhaul `art/review/before-*` captures when changing lights, fog or haze.
- The dry hide has a `.62` roughness floor outside the lips and mouth, on top of the accepted `.48-.86` remap. Its direct specular is scaled to 40%. The rim light stays low (about 0.6): stronger rim specular sparkles on the brow's fine scale bump.
- The mouth mask (`rexMouthMask` plus the `rexGape` membrane attribute) switches to dark wet flesh with occluded ambient and direct specular damped to 10%. Without that damping, the cool rim/fill lights turn the flattened corner membrane lilac. Check the mask with `uRexDebug=1` and inspect held-roar views (front, low front, three-quarter, side) with `art/review/capture-mouth.cjs` after any skin, lighting or rig change.
