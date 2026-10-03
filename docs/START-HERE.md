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
| Current assessment | The implementation and automated routes pass their checks. **The AAA quality target is not met. The user has not accepted this rebuilt visual version yet.** The preceding agent's self-audit is not user approval or an independent review. |

This work is committed locally and has **not been published**. Current instructions are to commit locally and not push until publication is requested. A push to `main` automatically deploys GitHub Pages, even for documentation changes. Older release authorizations in [HANDOFF.md](HANDOFF.md) refer to earlier work and do not authorize this feature's release.

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
