# Rex: Pursuit

This checkout is the Rex: Pursuit Three.js browser game. It is separate from Dino Defense, War Survival, and Approach Orlando; their skills and release destinations do not apply.

The current upgrade plan is [docs/ROADMAP.md](docs/ROADMAP.md): one drop per session, committed locally. Do not push until the user says "ship it".

Start with [docs/HANDOFF.md](docs/HANDOFF.md) for the accepted behavior and recent fixes. Use the project skill at [.agents/skills/rex-pursuit-maintainer/SKILL.md](.agents/skills/rex-pursuit-maintainer/SKILL.md) for the code map and task-specific references. [README.md](README.md) describes gameplay, controls, audio, and asset provenance.

## Working conventions

- Read the current code and Git status before editing. The handoff describes a checkpoint; source constants and subsequent user requests take precedence.
- The playable entry is `index.html` / `src/chase.js`. `model-lab.html` / `src/main.js` is the preserved creature study, not the chase.
- Ordinary animation and material changes belong in runtime code. Re-exporting the GLB is a separate asset-authoring operation that can overwrite existing work.
- For visual changes, inspect comparable before/after captures, including the relevant close-up and mobile framing. A passing numeric check does not establish that an animation looks good.
- Use the focused checks in the skill's verification reference. `npm test` is not the complete suite. Keep review images and temporary diagnostics in ignored `art/review/`.
- Publishing `main` deploys the live game automatically. Follow the user's current release authorization; these instructions themselves do not grant permission to publish.
- Update the handoff or skill reference when a fix reveals a reusable failure mode. Keep detailed guidance in one place and link to it.

The repo copy of `rex-pursuit-maintainer` is the maintained source. A matching user skill can be installed in `~/.codex/skills/rex-pursuit-maintainer` by copying that folder; refresh the installed copy after changing it.
