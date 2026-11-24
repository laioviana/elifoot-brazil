# Plan: Button in not align in Mobile Version (#42)

## Size
small — one code file (`css/style.css`), no game rules/balance, no save-format change, no feature removed or redesigned; the fix only centres the existing buttons.

## Goal
On a phone (e.g. iPhone 14 Pro Max, 430 CSS px wide) the title-screen menu shows all its buttons in one centred column of equal width. Today the language button (`PT > EN`) and the sound button (`SOM: ON`) sit in a `.row` under "Continue"/"New game"; on a narrow screen they wrap onto two lines and stick to the left edge instead of being centred under the big buttons. Desktop keeps its current look (the two small buttons side by side, centred).

## Root cause
- `css/style.css:41` `.menu button { min-width: 240px; }` applies to every menu button, including the two small ones inside `<div class="row">` (`js/ui.js:84`, `title()`).
- Two 240px buttons plus the 8px gap need 488px. `#app` on a 430px screen leaves about 410px, so the `.row` (`display:flex; flex-wrap: wrap`, `css/style.css:15`) wraps.
- `.row` has no `justify-content`, so the wrapped buttons line up at the start (left) of the row instead of the centre. That is the misalignment in the screenshot.

## Decisions
- None asked. The issue is a clear layout bug, and the fix keeps the existing design.

## Assumptions
- On narrow screens the two small buttons stack vertically, centred, at the same 240px width as "Continue"/"New game". The result is one tidy column. On wide screens they stay side by side, centred, as today.
- The fix is scoped to the title menu (`.menu .row`), so other `.row` uses across the game don't change.
- The issue text and the code point to the wrapping row, so the plan fixes that. If the screenshot shows some other button out of line, the owner can say so on the PR.

## Files to change
- `css/style.css`: add a rule that centres the wrapped buttons in the title menu row.
- `test/titlemenu.test.js` (new): asserts on the CSS and the markup of `title()`.
- `package.json`: add the new test to the `test` script.
- `CHANGELOG.md`: add one line under `## Unreleased`.

## Tasks
1. In `css/style.css`, right after the `.menu button { min-width: 240px; }` line (section `/* título */`), add:
   `.menu .row { justify-content: center; }`
   (Write it on its own line starting with `.menu .row {` so the test helper can find it.)
2. Leave `js/ui.js` alone. The markup of `title()` already puts the two small buttons in `<div class="row">` inside `<div class="menu">`.
3. Create `test/titlemenu.test.js` (Portuguese comments, `'use strict'`, plain `assert`, following the style of `test/credits.test.js`; see the test plan below) and end it with `console.log('titlemenu.test.js ok');`.
4. Append `&& node test/titlemenu.test.js` to the `test` script in `package.json`.
5. Add under `## Unreleased` in `CHANGELOG.md`: `- Title screen: language and sound buttons stay centred under the main buttons on narrow (mobile) screens.`
6. Run `npm test`.

## Test plan
- New `test/titlemenu.test.js`. It reads `css/style.css` and `js/ui.js` as text, as `test/credits.test.js` does, and asserts:
  - a `.menu .row` rule exists in the CSS (found with `'\n.menu .row {'`) and contains `justify-content: center`;
  - the `.menu button` rule still contains `min-width: 240px`, so all menu buttons keep the same width and line up when stacked;
  - in the `title()` source (sliced between `function title()` and `function drawTitle()`), the `<div class="row">` with the `'lang'` and `'mute'` buttons comes after `<div class="menu">`.
- Manual check (in the PR description): `npm start`, browser dev tools in mobile mode at 430×932 (iPhone 14 Pro Max) and at 375px. Four buttons in one centred column of equal width. At 1024px wide, the two small buttons sit side by side, centred.

## Acceptance criteria
- [ ] At 430px and 375px viewport width, the `PT > EN`/`EN > PT` and `SOM`/`SOUND` buttons are horizontally centred and the same width as "Continue"/"New game".
- [ ] On desktop width the title menu looks as before (small buttons side by side, centred).
- [ ] No other screen's `.row` layout changes.
- [ ] `CHANGELOG.md` has the new line under `## Unreleased`.
- [ ] `npm test` passes.

## Out of scope
- Other mobile layout fixes (hub, match, tables).
- Changing button sizes, fonts, colours or the menu's contents.
- Any change to `js/engine.js`, save data or game logic.

