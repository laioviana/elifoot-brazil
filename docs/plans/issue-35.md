# Plano: The create by label in the start page should be in the very bottom of the page (#35)

## Tamanho
small — only one code file changes (`css/style.css`); no game rules, balance or save format change; no feature removed; assumptions are low risk.

## Objetivo
On the start (title) screen, the "♥ Picked, coached and refereed by @laioviana" credit (`<footer class="credit">`) should sit at the very bottom of the page. Today it follows the description text with a 28px gap, so on tall screens it floats in the middle with empty space below it. After the change, when the title content is shorter than the window, the credit is pinned to the bottom edge of the viewport. When the content is taller (small phones), the credit stays the last thing on the page, below everything else, and never overlaps the menu.

## Decisões
- None: the thread has no owner decisions. The request is unambiguous.

## Premissas
- "Very bottom of the page" means a *sticky footer*: at the bottom of the viewport when there is spare space, otherwise at the end of the content. It is **not** `position: fixed`, because a fixed footer would cover the menu buttons on short screens.
- The fix is CSS only. `title()` in `js/ui.js` already renders the `<footer class="credit">` as the last child of `.title`, so the markup does not change.
- Only the title screen changes. Other screens keep the `#app` bottom padding of 90px, which they need for the fixed `.playbar`.
- The `:has()` selector is used to drop that 90px padding on the title screen. It is supported by every current browser. In an older browser the only effect is 80px of extra space below the credit, so the page still works.
- The credit text, link and font size stay as they are.

## Arquivos a alterar
- `css/style.css` — turn `.title` into a full-height flex column, push `.credit` to the bottom with `margin-top: auto`, and reduce the `#app` bottom padding when it contains the title screen.
- `test/credits.test.js` — add assertions that guard the layout.

## Tarefas
1. In `css/style.css`, in the "título" section, add a rule `#app:has(> .title) { padding-bottom: 10px; }` so the title screen does not keep the 90px reserved for `.playbar`.
2. Change `.title` to: `display: flex; flex-direction: column; min-height: calc(100vh - 20px); min-height: calc(100dvh - 20px);`. Keep its existing `text-align: center; padding: 26px 0 10px;`. The `- 20px` matches the 10px top and 10px bottom padding of `#app` on this screen; the second `min-height` is the mobile-safe `dvh` fallback chain. Then confirm that the canvas (`display:block; margin: auto`) and `.menu` (`align-items: center`) still center horizontally inside the column. They should, because flex items stretch by default.
3. Change `.credit`: replace `margin-top: 28px` with `margin-top: auto; padding-top: 28px;`. The free space then goes above the credit, and a minimum 28px gap remains when the content fills the screen.
4. Leave `js/ui.js` unchanged, but check that `<footer class="credit">` is still the last element inside `<div class="title">` in `title()`.
5. Check by hand with `npm start`. On a tall desktop window, the credit should touch the bottom of the viewport without a scrollbar. On a narrow or short window (for example 360×640), the credit should come after the description text with no overlap. Toggle PT/EN and check both languages.

## Plano de testes
Extend `test/credits.test.js`:
- In `title()`, the `<footer class="credit"` comes after the description `<p class="dim small">` (that is, after the last `<p` in the string), and the only thing after `</footer>` is the closing `</div>` of `.title`.
- Read `css/style.css` and assert:
  - the `.credit {` rule contains `margin-top: auto`;
  - the `.title {` rule contains `display: flex`, `flex-direction: column` and a `min-height` using `100vh`;
  - a rule `#app:has(> .title)` exists and sets `padding-bottom`.

## Critérios de aceitação
- [ ] On the title screen in a tall window, the credit sits at the very bottom of the viewport, with no empty gap below it beyond the 10px page padding.
- [ ] In a short or narrow window, the credit is the last element, below the description, with no overlap and still reachable by scrolling.
- [ ] Other screens (new game, hub, results, season) look the same as before, and the `.playbar` does not cover content.
- [ ] The credit link still opens https://x.com/laioviana in a new tab.
- [ ] `npm test` passes.

## Fora do escopo
- Changing the credit's wording, link, colours or font size.
- Adding the credit to other screens.
- Any other change to the title screen layout.

