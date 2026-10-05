# Rex: Pursuit

This checkout is the Rex: Pursuit Three.js browser game. It is separate from Dino Defense, War Survival, and Approach Orlando; their skills and release destinations do not apply.

The current upgrade plan is [docs/ROADMAP.md](docs/ROADMAP.md): one drop per session, committed locally. Do not push until the user says "ship it".

For a fresh session, start with [docs/START-HERE.md](docs/START-HERE.md): the portable project identity, current checkpoint, user feedback, evidence limits and reading order. It works with any AI provider as ordinary Markdown. [docs/HANDOFF.md](docs/HANDOFF.md) preserves dated decisions. Use the project skill at [.agents/skills/rex-pursuit-maintainer/SKILL.md](.agents/skills/rex-pursuit-maintainer/SKILL.md) for the code map and task-specific references. [README.md](README.md) describes gameplay, controls, audio, and asset provenance.

## Working conventions

- Read the current code and Git status before editing. The handoff describes a checkpoint; source constants and subsequent user requests take precedence.
- `index.html` is the homepage hub for all five modes (`src/chase/hub.js`, `modes.js`, `hub.css`). `ravine.html`, `arcade.html` and `breach.html` send direct visits to the hub; `?start=1` plays at once and `?menu=1` keeps a page's own title screen (tests use it). See the hub section of `docs/HANDOFF.md`.
- Pursuit and Safari use `index.html` / `src/chase.js`; Containment Breach has its own entry, `breach.html` / `src/breach/main.js`. `creature-lab.html` is the full TEST ONLY catalogue; `model-lab.html` / `src/main.js` is the preserved Rex study. River Escape is a future roadmap item, not an implemented mode.
- Raptor Ravine is campaign chapter two (`ravine.html`, `src/ravine/`). It is temporarily open for play-testing via `RAVINE_PLAYTEST_OPEN` in `src/chase/campaign.js`; earned Pursuit progress remains separate. Read `docs/RAPTOR-RAVINE.md` for CC0 art provenance, authoring and focused regression.
- Lost Circuit '94 is the separate arcade ride (`arcade.html`, `src/arcade/`). Its AAA upgrade plan is [docs/ARCADE-ROADMAP.md](docs/ARCADE-ROADMAP.md): one drop per fresh session, committed locally on `feature/lost-circuit-arcade`. Read the [arcade maintenance reference](.agents/skills/rex-pursuit-maintainer/references/lost-circuit.md) before changing its travel, actors, gun or rendering. The rebuilt visuals have not received user acceptance and are not claimed to meet AAA quality.
- Ordinary animation and material changes belong in runtime code. Re-exporting the GLB is a separate asset-authoring operation that can overwrite existing work.
- For visual changes, inspect comparable before/after captures, including the relevant close-up and mobile framing. A passing numeric check does not establish that an animation looks good.
- Use the focused checks in the skill's verification reference. `npm test` is not the complete suite. Keep review images and temporary diagnostics in ignored `art/review/`.
- Publishing `main` deploys the live game automatically. Follow the user's current release authorization; these instructions themselves do not grant permission to publish.
- Update the handoff or skill reference when a fix reveals a reusable failure mode. Keep detailed guidance in one place and link to it.

The repo copy of `rex-pursuit-maintainer` is the maintained source. A matching user skill can be installed in `~/.codex/skills/rex-pursuit-maintainer` by copying that folder; refresh the installed copy after changing it.
