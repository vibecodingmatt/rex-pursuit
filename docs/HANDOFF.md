# Rex: Pursuit handoff

Checkpoint: 2026-09-20, after gameplay commit `27f9a36` (softer Rex skin highlights). The requested gameplay work at this checkpoint is complete, tested, and deployed. Read later commits and the current user request before treating this as the latest state.

## Where to start

- Local checkout: `C:\Users\burns\dev\games-playground\rex-encounter`.
- Repository: [vibecodingmatt/rex-pursuit](https://github.com/vibecodingmatt/rex-pursuit).
- Live game: [Rex: Pursuit](https://vibecodingmatt.github.io/rex-pursuit/).
- [Maintainer skill and code map](../.agents/skills/rex-pursuit-maintainer/SKILL.md).
- [Animation, materials, audio, and mobile lessons](../.agents/skills/rex-pursuit-maintainer/references/animation-and-rendering.md).
- [Local testing and release workflow](../.agents/skills/rex-pursuit-maintainer/references/verification-and-release.md).
- [Gameplay, controls, assets, and attribution](../README.md).

## Product direction

The concept evolved from a stationary encounter into a first-person mounted-gun chase, with a third-person camera showing the park-themed Jeep and its left-seat driver. Keep the cinematic sense of scale, readable arcade targets, and believable creature movement. The user notices small problems in feet, knees, hands, eye focus, jaw timing, and close-up materials.

The main accepted features are:

- A stopped Jeep opening: the Rex breaks through the right-hand jungle, roars, and follows as the vehicle accelerates. Moving roars retain locomotion; audible Rex vocals drive the jaw from their actual audio envelope.
- A 90-second active pursuit deadline with ordered targets, increasing pressure, and branches broken by physical Rex contact before they fly toward the Jeep. No special headshot text or color.
- A midpoint escape feint into the left jungle and a close return from that same side. Concealment comes from foliage along a continuous route, not hiding or teleporting the model. The road verge stays relatively open and vegetation grows denser farther away.
- Persistent bullet/explosion damage, including the face. Skin, wounds, tongue, and eyes have distinct finishes.
- An animated gun feed, ejected cases and links, articulated reload hands, a left-hand steering wheel, and a safari ranger driver visible in third person.
- Touch aiming above the thumb, independent aim/fire pointers, accessible reload/grenade controls, and suppression of selection and long-press callouts.
- A flexible, weighted Rex death fall on victory. Player defeat instead forces first person, knocks the gun away, spins the Jeep once, and ends with the Rex walking up and swallowing the player.

## Recent fixes to preserve

| Commit | Change | Why it matters |
| --- | --- | --- |
| `eba7ce7` | Offset touch aim and independent thumb controls | The thumb must not cover the reticle; holding Fire must not interrupt aiming or select text. |
| `4d3de58` | Curved final approach and rendered throat interior | Turning with the walking path prevents crossed legs; the mouth opens into a 3D interior rather than a prolonged red screen. |
| `38006de` | Low recoil step after the Jeep spin | Foot plants must follow actual road-relative travel while the torso still faces the Jeep, then start a fresh walking cycle. |
| `ca6aba5` | Mouth pause, swallowing head lift, slower descent | The player remains still briefly, then the head lifts before the 3.2-second slide and swallowing audio begin. |
| `27f9a36` | Softer skin highlights | Authored roughness was multiplied down to a glossy surface. The runtime remap preserves texture variation with a drier hide and restrained wound moisture. |

The user specifically liked the eerie throat interior, the improved death fall, and the creature model. Tune the reported issue without replacing those effects or rebuilding the asset by default.

## Verification at this checkpoint

The skin update passed `test:logic`, `build`, `test:release`, and `test:pages`, plus before/after desktop and phone render comparisons of clean skin, wounds, the mouth, and the whole body. The published bundle was checked live with no runtime errors.

The preceding swallow update passed the same logic/build/release checks and the full `scripts/verify-defeat.cjs` sequence against the build: four loss causes, head lift, held interior position, slower slide, audio cue timing, pause, black fade, restart, and phone portrait/landscape framing. The earlier recoil fix passed 15 gait cases across 30/60/144 Hz and varied entry strides.

These are historical results, not substitutes for checking new changes. Chrome phone emulation is not physical iOS/Android testing. Balance simulations are not human playtests. No new feature is implicitly queued by this handoff.

## Local review material

`art/review/` is ignored and may be absent from a fresh clone. This machine currently has useful diagnostics:

- `review-skin.cjs`, `skin-before-*`, `skin-balanced-*`, and `skin-live-*` for comparable material views.
- `defeat-verification.json`, `defeat-*.png`, and `defeat-mobile-*.png` for the final sequence.
- `live-defeat-smoke.cjs` for the published bundle, low recoil step, held mouth beat, delayed audio, descent, blackout, and touch retry.

These local helpers are examples, not required release dependencies. The maintained checks are under `scripts/`. Do not point future instructions at an ignored file as their only source of truth.
