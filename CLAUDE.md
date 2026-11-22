# Prancheta 8-Bit — guide for Claude

Browser football-manager game in 8-bit style covering Brazil's Séries A–D. Plain HTML/CSS/JS, **no build step and no
dependencies**. See `README.md` for game mechanics.

## Layout

| Path | What lives there |
| --- | --- |
| `index.html` | Loads `js/data.js`, `js/roster.js`, `js/version.js`, `js/engine.js`, `js/ui.js` in that order |
| `js/engine.js` | Game engine, **no DOM**, also runs in Node (exported as `module.exports = E`, `window.PB` in the browser) |
| `js/ui.js` | Screens, live match, audio (DOM only) |
| `js/version.js` | Game version (SemVer); changed only by `scripts/bump-version.js` |
| `js/data.js` | Clubs and name lists |
| `CHANGELOG.md` | Release notes; PRs add lines under `## Unreleased` |
| `js/roster.js` | **Generated** by `scripts/update-roster.js`; never edit by hand |
| `css/style.css` | 8-bit look |
| `test/*.test.js` | Plain Node `assert` tests, one file per topic |
| `scripts/` | Roster tooling and the agent pipeline scripts (`scripts/agents/`) |
| `docs/` | Agent pipeline docs and committed plans (`docs/plans/issue-<N>.md`) |

## Commands

- `npm test` — runs every test file. Must pass before any commit.
- `npm start` — serves the game on http://localhost:8080.

## Conventions

- Game logic belongs in `js/engine.js` so it can be tested in Node; `js/ui.js` only renders and wires events.
- Every user-facing string is bilingual through `L('texto em português', 'English text')`. Portuguese first.
- Code comments are in Portuguese, matching the existing files.
- Keep the existing style: `'use strict'`, IIFE modules, short helpers, 2-space indent, semicolons.
- New logic needs a test. Add a new `test/<topic>.test.js` and append it to the `test` script in `package.json`,
  or extend an existing test file when it fits. Tests that use randomness set `E.rand` to a seeded generator
  (see `test/sim.test.js`).
- Add a line under `## Unreleased` in `CHANGELOG.md` for every change; never change the version by hand
  (see `docs/versioning.md`, which also describes the release workflow).
- Save games live in `localStorage`. If you change the shape of the saved state, keep old saves loading.

## Agent pipeline

Issues are planned, implemented and reviewed by agents. See `docs/agent-pipeline.md` (how to use it) and
`docs/agent-pipeline-design.md` (why it works this way). Agents never merge; the owner merges by hand.
