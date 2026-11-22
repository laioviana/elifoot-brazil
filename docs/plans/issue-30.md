# Plan: Versioning the game (#30)

## Size
big — touches more than 2 code files (`js/version.js`, `js/engine.js`, `js/ui.js`, `index.html`, `scripts/bump-version.js`) plus two GitHub workflows, and it changes the release/deploy process.

## Goal
The game gets a Semantic Version, starting at `1.0.0`. The title screen shows a small dimmed `v1.0.1` (etc.) line at the very bottom. Every merge to `main` automatically:
- bumps the patch number;
- turns `## Unreleased` in `CHANGELOG.md` into a dated version section;
- commits and tags it (`vX.Y.Z`) as `github-actions[bot]`;
- deploys to GitHub Pages, so the published game shows the new number.

For minor/major releases the owner runs `npm run bump -- minor|major`. That command updates the files, commits `Release vX.Y.0` and creates the tag locally. It only prints the push command and never pushes.

## Decisions
- Q1 Version scheme → SemVer `MAJOR.MINOR.PATCH`, starting at `1.0.0` (matches `package.json`). MAJOR = breaks old saves or redesigns the game, MINOR = new feature, PATCH = bug fix or balance tweak.
- Q2 Who bumps → patch: automatically on every PR merge. Minor/major: the owner, with the script.
- Q3 Release process → `CHANGELOG.md` (PRs add entries under `## Unreleased`) + git tag `vX.Y.Z` per release, documented in `docs/versioning.md`. No automatic GitHub Releases.
- Q4 Title screen → small dimmed `vX.Y.Z` line at the very bottom of the title screen, the same text in PT and EN. The save format is unchanged (the version is not stored in saves).
- Q5 How the patch bump happens → (a) a GitHub Action on every push to `main`:
  - bumps the patch and updates the changelog (if the PR added no entry, it uses the merged commit's title);
  - commits as `github-actions[bot]`, tags, then deploys to Pages;
  - skips `Release v…` commits.
- Q6 Minor/major tags → `npm run bump -- minor|major` updates the files, commits `Release vX.Y.0` and tags locally, then prints `git push --follow-tags origin main`. It never pushes.

## Assumptions
- The version has one source of truth in the game code: a new file `js/version.js`, loaded before `js/engine.js`. `package.json` `"version"` is kept in sync by the bump script. A test checks that the two match.
- The engine exposes the version as `E.VERSION` (also available in Node), so the UI reads it from `E` like everything else.
- The version line goes **after** the existing credit footer (`<footer class="credit">`), because the owner chose "very bottom of the title screen". The credit footer currently sits below "▼ PRESS START ▼".
- The changelog section heading is `## X.Y.Z — YYYY-MM-DD` (UTC date). The fallback entry is the first line of the merge commit message, kept as-is (e.g. `Implementa #32: Add a nice creative create by (#33)`).
- The Pages deploy moves from `ci.yml` into the new `release.yml`. Otherwise CI would deploy the pre-bump code first, racing the release run. Pushes made with `GITHUB_TOKEN` do not trigger other workflows, so the release workflow must deploy by itself. `ci.yml` keeps running tests on every push/PR and on `workflow_dispatch` (the agent pipeline still uses that).
- `release.yml` checks out the **latest** `main` (not the event SHA), runs with `concurrency: release` (no cancel), and runs `git pull --rebase` before tagging and pushing. Merges that land close together are then handled one after another. Occasionally one merge may get an extra patch number with a fallback entry, which is acceptable.
- The bump script refuses to run with a dirty working tree when it is asked to commit.
- `CHANGELOG.md` starts with a `## Unreleased` entry for this feature and a `## 1.0.0 — 2026-11-22` section (“State of the game before versioning.”). Merging this very PR produces `1.0.1`. No `v1.0.0` tag is created automatically. The owner may tag it by hand if they want.
- The changelog and its entries are written in English. The game strings stay bilingual as usual.
- `CHANGELOG.md` is added to `.assetsignore` (like `README.md` and `docs`), so it is not published as a site asset.

## Files to change
- `js/version.js` — **new**. Holds the version string, exposes `window.PB_VERSION` in the browser and `module.exports` in Node.
- `index.html` — load `js/version.js` before `js/engine.js`.
- `js/engine.js` — `E.VERSION`.
- `js/ui.js` — `title()`: add the version line.
- `css/style.css` — `.version` style (small, dimmed).
- `scripts/bump-version.js` — **new**. Bump logic (pure functions exported for tests) plus the CLI.
- `package.json` — `"bump"` script; add `test/version.test.js` to `"test"`.
- `CHANGELOG.md` — **new**.
- `docs/versioning.md` — **new**. The versioning and release process, plus the workflow setup for the owner.
- `CLAUDE.md` — add `js/version.js`, `CHANGELOG.md` and `docs/versioning.md` to the layout table, plus conventions: “add a line under `## Unreleased` in `CHANGELOG.md`; never change the version by hand”.
- `README.md` — the “Publicação” section now points to `release.yml` and `docs/versioning.md`.
- `.assetsignore` — add `CHANGELOG.md`.
- `test/version.test.js` — **new**.
- `.github/workflows/release.yml` — **new** (**done by hand by the owner**, see below).
- `.github/workflows/ci.yml` — remove the `deploy` job (**done by hand by the owner**).

> ⚠️ The development agent is not allowed to edit `.github/` (rule in `.claude/skills/implement-plan/SKILL.md`), and `GITHUB_TOKEN` cannot push workflow files anyway. Tasks 9–10 are therefore **manual steps for the owner**, done right after merging the agent's PR. The agent must put the exact content of both workflow changes in `docs/versioning.md` (section “Workflow setup”), so the owner can copy it.

## Tasks
1. **`js/version.js`**: same IIFE style as the other files:
   ```js
   /* Prancheta 8-Bit — versão do jogo (atualizada só por scripts/bump-version.js) */
   (function (root) {
     'use strict';
     const VERSION = '1.0.0';
     root.PB_VERSION = VERSION;
     if (typeof module !== 'undefined' && module.exports) module.exports = VERSION;
   })(typeof window !== 'undefined' ? window : globalThis);
   ```
   Keep the literal on a line that matches `/const VERSION = '(\d+\.\d+\.\d+)';/`. The bump script rewrites it.
2. **`index.html`**: add `<script src="js/version.js"></script>` right before `js/engine.js`. Update the load order in the `CLAUDE.md` layout table to match.
3. **`js/engine.js`**: near the top, after `const E = …`, add
   `E.VERSION = root.PB_VERSION || (typeof require === 'function' ? require('./version.js') : '');`
4. **`js/ui.js` `title()`**: after the `<footer class="credit">…</footer>` line, add `<p class="version">v${E.VERSION}</p>`. The text is not translated: it is the same in both languages, so no `L()` is needed. **`css/style.css`**: next to `.credit`, add `.version { font-family: var(--px); font-size: 8px; color: var(--dim); margin-top: 10px; opacity: .7; }`.
5. **`scripts/bump-version.js`** (Node, no dependencies, `'use strict'`, Portuguese comments). Export these pure functions:
   - `bump(version, kind)` — `kind` ∈ `patch|minor|major`. `1.2.3` → `1.2.4` / `1.3.0` / `2.0.0`. Throws on an invalid version or kind.
   - `releaseChangelog(text, version, date, fallback)` — finds the `## Unreleased` heading. It keeps an empty `## Unreleased` at the top and turns the old section body into `## <version> — <date>`. If that body has no `- ` bullet lines, it inserts `- <fallback>` (and if `fallback` is empty, `- Maintenance.`). Throws if `## Unreleased` is missing. The rest of the file is unchanged.
   - `setVersion(text, file, version)` — replaces the version in `package.json` (the `"version": "x.y.z"` field) or in `js/version.js` (`const VERSION = '…';`). Throws if nothing was replaced.

   CLI: `node scripts/bump-version.js <patch|minor|major> [--fallback "<text>"] [--no-git]`.
   1. Read the current version from `js/version.js` and compute the new one.
   2. Unless `--no-git`, abort if `git status --porcelain` is not empty.
   3. Write `js/version.js`, `package.json` and `CHANGELOG.md`, using today's UTC date `YYYY-MM-DD`.
   4. Unless `--no-git`, run `git add` on those 3 files, `git commit -m "Release vX.Y.Z"` and `git tag -a vX.Y.Z -m "vX.Y.Z"`.
   5. Print the new version and, unless `--no-git`, `Agora rode: git push --follow-tags origin main`.

   The script never pushes. Use `child_process.execFileSync` for git. Run the CLI only when `require.main === module`.
6. **`package.json`**: add `"bump": "node scripts/bump-version.js"`, and append `&& node test/version.test.js` to `"test"`. Leave `"version": "1.0.0"` as it is.
7. **`CHANGELOG.md`**:
   ```
   # Changelog

   All notable changes to Prancheta 8-Bit. Versions follow [Semantic Versioning](https://semver.org/):
   MAJOR = breaks old saves or redesigns the game, MINOR = new feature, PATCH = bug fix or balance tweak.
   Every PR adds a line under `## Unreleased`; the release workflow turns it into a version section on merge.

   ## Unreleased
   - Game versioning: version shown on the title screen, automatic patch release on every merge, `npm run bump` for minor/major releases.

   ## 1.0.0 — 2026-11-22
   - State of the game before versioning.
   ```
8. **`docs/versioning.md`**: explain the scheme (from Q1), the patch flow on merge, the minor/major flow (`npm run bump -- minor`, then `git push --follow-tags origin main`), and the rule that PRs add a changelog line but never change the version. Also add a “Workflow setup” section with the exact `release.yml` from task 9, the `ci.yml` change from task 10, and the repository settings:
   - Settings → Actions → General → Workflow permissions: *Read and write*.
   - If `main` has branch protection or rulesets: allow GitHub Actions to push, or the release job fails on push.
   - Pages source stays *GitHub Actions*.

   Update `README.md` “Publicação”, `CLAUDE.md` (layout + conventions) and `.assetsignore`.
9. **(Owner, manual) `.github/workflows/release.yml`**:
   ```yaml
   name: Release
   # A cada push na main: sobe o patch, fecha o CHANGELOG, cria a tag e publica no GitHub Pages.
   on:
     push:
       branches: [main]
   permissions:
     contents: write
   concurrency:
     group: release
     cancel-in-progress: false
   jobs:
     release:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
           with: { ref: main, fetch-depth: 0 }
         - uses: actions/setup-node@v4
           with: { node-version: 22 }
         - run: npm test
         - name: Bump patch
           if: ${{ !startsWith(github.event.head_commit.message, 'Release v') }}
           env:
             MSG: ${{ github.event.head_commit.message }}
           run: |
             git config user.name "github-actions[bot]"
             git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
             node scripts/bump-version.js patch --no-git --fallback "$(printf '%s' "$MSG" | head -n1)"
             V="$(node -p "require('./js/version.js')")"
             git add js/version.js package.json CHANGELOG.md
             git commit -m "Release v$V"
             git pull --rebase origin main   # tag só depois do rebase, para apontar para o commit final
             git tag -a "v$V" -m "v$V"
             git push origin HEAD:main --follow-tags
     deploy:
       needs: release
       runs-on: ubuntu-latest
       permissions: { pages: write, id-token: write }
       environment:
         name: github-pages
         url: ${{ steps.deployment.outputs.page_url }}
       steps:
         - uses: actions/checkout@v4
           with: { ref: main }
         - uses: actions/configure-pages@v5
         - uses: actions/upload-pages-artifact@v3
           with: { path: . }
         - id: deployment
           uses: actions/deploy-pages@v4
   ```
   The bot's push uses `GITHUB_TOKEN`, so it does not trigger this workflow (or CI) again. A `Release v…` commit pushed by the owner skips the bump but still deploys.
10. **(Owner, manual) `.github/workflows/ci.yml`**: delete the `deploy` job, which now lives in `release.yml`. Keep the `test` job and its triggers as they are.

## Test plan
`test/version.test.js` (new, plain `assert`, ends with `console.log('version.test.js ok')`):
- `require('../js/version.js')` matches `/^\d+\.\d+\.\d+$/` and equals `require('../package.json').version`.
- `require('../js/engine.js').VERSION` equals the version from `js/version.js`.
- `index.html` loads `js/version.js` before `js/engine.js` (compare `indexOf`).
- In `js/ui.js`, the `title()` slice (same technique as `test/credits.test.js`) contains `class="version"` and `${E.VERSION}`, and the version line comes after `class="credit"`.
- `bump`: `1.0.0`+patch → `1.0.1`, `1.0.9`+patch → `1.0.10`, `1.2.3`+minor → `1.3.0`, `1.2.3`+major → `2.0.0`. Throws on `'1.0'` and on kind `'huge'`.
- `releaseChangelog`:
  - With a bullet under Unreleased, the output has `## Unreleased` followed by an empty section, then `## 1.0.1 — 2026-11-22` holding the original bullet, and the fallback is **not** used.
  - With an empty Unreleased, the new section contains `- <fallback>`.
  - With an empty fallback, it contains `- Maintenance.`.
  - Older sections stay unchanged.
  - Throws when `## Unreleased` is missing.
- `setVersion`: rewrites `package.json` text (the result still parses as JSON with the new version) and `js/version.js` text. Throws when the pattern is missing.
- `CHANGELOG.md` in the repo contains `## Unreleased`, and running `releaseChangelog` on it does not throw.

## Acceptance criteria
- [ ] The title screen shows a dimmed `v1.0.0` line below the credit footer, the same in PT and EN.
- [ ] `E.VERSION`, `js/version.js` and `package.json` agree.
- [ ] `node scripts/bump-version.js patch --no-git` changes exactly `js/version.js`, `package.json` and `CHANGELOG.md` to `1.0.1` and moves the Unreleased entries into `## 1.0.1 — <date>`. (Verified by the developer, then reverted.)
- [ ] `npm run bump -- minor` (with git) commits `Release v1.1.0`, creates the local tag `v1.1.0`, prints the push command and does not push. It refuses to run on a dirty tree.
- [ ] `CHANGELOG.md` and `docs/versioning.md` exist. `docs/versioning.md` contains the full `release.yml`, the `ci.yml` change and the repository settings.
- [ ] `CLAUDE.md` tells contributors and agents to add a `CHANGELOG.md` line under `## Unreleased` and never to change the version by hand.
- [ ] The save format is unchanged.
- [ ] `npm test` passes.

## Out of scope
- Creating the workflow files or changing repository settings (the owner does this by hand, following `docs/versioning.md`).
- Automatic GitHub Releases.
- Storing the version in save games, or migrating saves based on the version.
- Showing the version anywhere other than the title screen.
- Changes to the agent pipeline scripts or skills.
- Backfilling changelog entries for past PRs.

