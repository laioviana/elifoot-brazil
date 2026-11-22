# Plan: Add a nice creative create by (#32)

## Size
small — touches 2 code files (`js/ui.js`, `css/style.css`). It doesn't change game rules, balance or the save format, and it doesn't remove any feature. The only new things are a footer and its text, and the text is easy to change.

## Goal
At the bottom of the title screen, the player sees a short 8-bit style credit line saying who made the game. The author's handle links to https://x.com/laioviana and opens in a new tab. It matches the retro look and works in Portuguese and English.

## Decisions
- None asked. The issue already sets the location (bottom of the start page) and the link target (x.com/laioviana).

## Assumptions
- **Text** (bilingual through `L()`, Portuguese first), in the style of a game's closing credits:
  - PT: `Escalado, treinado e apitado por` + link `@laioviana`
  - EN: `Picked, coached and refereed by` + link `@laioviana`
  - A small pixel heart (`♥`, red) before the text, as a decoration.
- **Position**: a `<footer class="credit">` element inside `.title`, after the blinking `▼ PRESS START ▼` line. It shows only on the title screen.
- **Link**: `<a href="https://x.com/laioviana" target="_blank" rel="noopener noreferrer">@laioviana</a>`, with no `data-a`, so the global click handler (`document.addEventListener('click', ...)` in `js/ui.js`) ignores it.
- **Style**: `.credit` uses the `--px` font at a small size (8–9px), color `var(--dim)`, and a top margin of about 28px. The link `.credit a` is `var(--yellow)` with no underline and a `2px 2px 0 #000` text-shadow. On `:hover`/`:focus`, it switches to `var(--pink)` with a dashed underline.

## Files to change
- `js/ui.js` — in `title()`, add the credit footer at the end of `<div class="title">`.
- `css/style.css` — in the `/* título */` block, add the `.credit` and `.credit a` (+ `:hover`/`:focus`) rules.
- `test/credits.test.js` (new) and `package.json` — a light regression test.

## Tasks
1. In `js/ui.js`, inside `title()`, after `<p class="dim small blink">▼ PRESS START ▼</p>`, insert:
   ```js
   <footer class="credit"><span class="red">♥</span> ${L('Escalado, treinado e apitado por', 'Picked, coached and refereed by')} <a href="https://x.com/laioviana" target="_blank" rel="noopener noreferrer">@laioviana</a></footer>
   ```
2. In `css/style.css`, after the `.blink` / `@keyframes blink` rules, add:
   - `.credit { font-family: var(--px); font-size: 9px; line-height: 1.8; color: var(--dim); margin-top: 28px; }`
   - `.credit a { color: var(--yellow); text-decoration: none; text-shadow: 2px 2px 0 #000; }`
   - `.credit a:hover, .credit a:focus { color: var(--pink); text-decoration: underline dashed; }`
3. Create `test/credits.test.js`. It reads `js/ui.js` with `fs.readFileSync` and checks the items listed in the test plan.
4. Append `&& node test/credits.test.js` to the `test` script in `package.json`, following the existing pattern.

## Test plan
- `test/credits.test.js` (new, plain `assert`, no DOM):
  - `js/ui.js` contains `href="https://x.com/laioviana"`.
  - The same `<a>` has `target="_blank"` and `rel="noopener noreferrer"`.
  - The credit text goes through `L(` with the Portuguese and English versions (`'Escalado, treinado e apitado por'` and `'Picked, coached and refereed by'`).
  - The footer is in the `title()` function: the `class="credit"` excerpt appears between `function title()` and `function drawTitle()`.

## Acceptance criteria
- [ ] The title screen shows the credit line below "▼ PRESS START ▼", in the 8-bit font.
- [ ] Clicking `@laioviana` opens https://x.com/laioviana in a new tab, and the game screen doesn't change.
- [ ] Switching the language (PT > EN) switches the credit text.
- [ ] The credit doesn't appear on the other screens (new game, hub, results, season).
- [ ] The layout stays correct on a narrow screen (the line wraps without horizontal overflow).
- [ ] `npm test` passes

## Out of scope
- An "about"/credits page or a modal.
- Credits on screens other than the title screen.
- Changes to `index.html`, the README or the save format.

