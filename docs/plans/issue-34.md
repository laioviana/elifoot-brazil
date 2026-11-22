# Plan: Two press to start label (#34)

## Size
small — one code file (`js/ui.js`), no game rules/balance, no save-format change, no feature removed (only a duplicated label), no risky assumptions.

## Goal
The title screen currently shows the blinking `▼ PRESS START ▼` label twice: once above the `Continue` / `New game` buttons (moved there in #29) and once more below the tagline (a leftover). The player should see it only once, directly above the menu buttons.

## Decisions
- Which label to keep → the one above `Continue` / `New game` (stated in the issue).

## Assumptions
- The kept label stays exactly as it is today (`<p class="dim small blink">▼ PRESS START ▼</p>`, untranslated, same classes and position).
- The credit footer (`<footer class="credit">`) stays where it is; after the removal it follows the tagline directly.
- No CSS changes are needed.

## Files to change
- `js/ui.js` — in `title()`, delete the second `▼ PRESS START ▼` line (the one after the tagline, currently line 87).
- `test/credits.test.js` — add an assertion that `title()` contains the label exactly once, before the menu.

## Tasks
1. In `js/ui.js`, function `title()`, delete the line `<p class="dim small blink">▼ PRESS START ▼</p>` that sits between the tagline `<p class="dim small">${L('Comande um clube ...')}</p>` and `<footer class="credit">`. Leave the one between `<canvas id="tcv" ...>` and `<div class="menu">` untouched.
2. In `test/credits.test.js` (which already slices the `title()` source into `titulo`), add:
   - the count of `▼ PRESS START ▼` in `titulo` is exactly 1;
   - its index is lower than the index of `<div class="menu">`.
   Comment in Portuguese, e.g. `// "PRESS START" aparece uma única vez, acima do menu.`
3. Run `npm test`.

## Test plan
- `test/credits.test.js`: assert `titulo.split('▼ PRESS START ▼').length - 1 === 1` and `titulo.indexOf('▼ PRESS START ▼') < titulo.indexOf('<div class="menu">')`. Existing credit assertions must keep passing.

## Acceptance criteria
- [ ] The title screen shows the blinking `▼ PRESS START ▼` label only once, below the title canvas and above the `Continue` / `New game` buttons.
- [ ] Nothing appears between the tagline and the credit footer anymore.
- [ ] Language and sound buttons, tagline and credit footer are unchanged.
- [ ] `npm test` passes.

## Out of scope
- Translating or restyling the label.
- Any other change to the title screen layout.

