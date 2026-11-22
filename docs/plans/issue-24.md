# Plan: Change subtitle in the main page (#24)

## Goal
On the title screen, the green subtitle under the "PRANCHETA" logo reads `8-BIT · BRASIL A-D` today. It should read
`Campeonato Brasileiro Serie A - D` instead. The text is the same whether the game is in Portuguese or English.

## Decisions
- Subtitle text → `Campeonato Brasileiro Serie A - D` (from the issue).
- Same text in both languages → yes (from the issue: "for both english and portugues version").

## Assumptions
- Use the owner's text exactly: capitalisation as written, "Serie" without an accent, spaces around the hyphen.
  The `.logo2` CSS has no `text-transform`, so it shows as typed.
- The subtitle has to be identical in both languages, so it stays a plain literal. It is not wrapped in `L(...)`,
  just like the current subtitle and the `PRANCHETA` logo.
- No CSS change. `.logo2` uses `font-size: clamp(12px, 3.6vw, 22px)` and wraps normally inside `.title`, so the longer
  text may wrap onto two lines on narrow screens. That is acceptable.
- Only the visible title-screen subtitle changes. The browser `<title>`, the meta description, README and
  `package.json` stay as they are.

## Files to change
- `js/ui.js`: in `title()` (line 78), replace the contents of `<div class="logo2">`.

## Tasks
1. In `js/ui.js`, function `title()`, change
   `<div class="logo2">8-BIT · BRASIL A-D</div>` to
   `<div class="logo2">Campeonato Brasileiro Serie A - D</div>`.
2. Run `npm test`.

## Test plan
- No new automated test. The change is one static string in DOM-only code (`js/ui.js`), and the Node test suite
  does not load it. `npm test` must still pass.
- Manual check: `npm start`, open http://localhost:8080. The title screen shows `Campeonato Brasileiro Serie A - D`
  under the logo. Toggle `PT > EN` / `EN > PT` and confirm the subtitle stays the same.

## Acceptance criteria
- [ ] The title screen subtitle reads `Campeonato Brasileiro Serie A - D`.
- [ ] The subtitle is identical in PT and EN.
- [ ] `8-BIT · BRASIL A-D` no longer appears in `js/ui.js`.
- [ ] `npm test` passes.

## Out of scope
- Changing the page `<title>`, the meta description, README, `package.json` or the project name "Prancheta 8-Bit".
- Any styling or layout change to the title screen.

---
✅ Para aprovar, adicione o rótulo **`plan:approved`**. Para pedir mudanças, comente nesta issue.

