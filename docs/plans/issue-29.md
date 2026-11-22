# Plan: Change Press Start label position (#29)

## Size
small — touches 1 code file (`js/ui.js`), no game rules/balance, no save-game format change, no feature removed or redesigned, no risky assumptions.

## Goal
On the title screen, the blinking `▼ PRESS START ▼` label currently sits at the very bottom, below the menu and the tagline. The player should see it directly **above** the `Continuar` / `Novo jogo` buttons, with its ▼ arrows pointing down at them.

## Decisions
- None needed from the owner; the issue states the target position explicitly.

## Assumptions
- The label goes between the title canvas (`#tcv`) and the `.menu` block, i.e. right above the first button (`Continuar` when a save exists, otherwise `Novo jogo`).
- The tagline ("Comande um clube da Série D até o topo do futebol brasileiro.") stays where it is, below the menu.
- The label text stays `▼ PRESS START ▼` (not translated, same as today) and keeps its classes `dim small blink`.
- No CSS change: the canvas' bottom margin (14px) plus the paragraph margins and `.menu { margin-top: 10px }` already give enough spacing.

## Files to change
- `js/ui.js` — in `title()`, move the `<p class="dim small blink">▼ PRESS START ▼</p>` line from after the tagline to between the `<canvas id="tcv">` line and `<div class="menu">`.

## Tasks
1. In `js/ui.js`, function `title()` (around line 75–88), cut the line `<p class="dim small blink">▼ PRESS START ▼</p>` and paste it immediately after `<canvas id="tcv" width="64" height="36"></canvas>` and before `<div class="menu">`.
2. Keep the rest of `title()` unchanged (buttons, language/sound row, tagline).
3. Run `npm test`.

## Test plan
- No automated test: `title()` is a DOM-only render function in `js/ui.js`, which the Node test suite does not load, and the change contains no logic.
- Manual check with `npm start` (http://localhost:8080):
  - Without a save: `▼ PRESS START ▼` blinks right above `Novo jogo`.
  - With a save: it blinks right above `Continuar`.
  - The tagline still appears below the menu; switching PT/EN and toggling sound re-render the screen with the label still in the new position.

## Acceptance criteria
- [ ] On the title screen, the blinking `▼ PRESS START ▼` label appears below the title canvas and above the `Continuar` / `Novo jogo` buttons.
- [ ] The label is no longer shown at the bottom of the title screen (it appears only once).
- [ ] The label still blinks.
- [ ] `npm test` passes

## Out of scope
- Changing the label text, translating it, or restyling it.
- Moving or changing the tagline, the buttons, or the canvas.
- Any other screen.

