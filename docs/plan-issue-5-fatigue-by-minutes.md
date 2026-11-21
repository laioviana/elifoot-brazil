# Plan: Issue #5 – fatigue follows minutes played

Issue: https://github.com/laioviana/elifoot-brazil/issues/5
("Players are resting when subbed or left out of game?")
Branch: `claude/wizardly-lovelace-i9cv9a`

Status: design agreed with the owner in a grilling session; **no code written yet**.

## Current behavior (`js/engine.js`)

- `E.finishRound` (~line 365): every player in `m.used[s]` pays a flat fatigue cost:
  `fit - (starter ? 11 + (age > 30 ? 3 : 0) : 6)`, floor 20.
  - A starter subbed off at minute 20, injured, or sent off pays the full starter cost.
  - Any sub pays a flat 6 regardless of minutes.
- `E.finishRound` (~line 393): every player on every team gets `+9` (cap 100) each round,
  including players who did not play.
- Fitness is a single field `p.fit` (0–100). There is no minutes tracking. Fitness is
  constant during a match and feeds `E.eff` (`str * (0.55 + 0.45 * fit/100)`).
- Match object is built in `mkMatch` (~line 240) and lives only for one round
  (`startRound` -> `playAll`/`step` -> `finishRound`). It is not part of the player
  objects stored in `localStorage`.

## Decisions (all confirmed by the owner)

1. Change it: fatigue cost scales with minutes actually played.
2. Track minutes **on the match object only** (no new fields on players, so old saves
   need no migration).
3. Minutes played: starter = kickoff until subbed off / injured / sent off / minute 90.
   Sub = minute they entered until minute 90 / until they leave. Never entered = 0.
4. Cost = `11 per 90 min` (+3 per 90 min if `age > 30`), same rate for starters and subs
   (replaces the flat 6), **rounded to an integer**, floor 20 kept. No minimum cost, so a
   very short cameo can cost 0.
5. Recovery unchanged: everyone (including non-players) gets `+9` per round, cap 100.
6. Single shared code path for user and AI clubs (`finishRound`), no special cases.
7. Add a test for the minutes-scaled cost.

## Implementation steps

1. **Track minutes in `mkMatch`** (`js/engine.js` ~240-248).
   - NOTE: `m.min` is already the match clock. Do **not** reuse that name. Use a new
     field, e.g. `m.span = [ {}, {} ]` keyed by player id: `{ from, to }`
     (`to` stays `null` while on the pitch).
   - Initialize each starter with `{ from: 0, to: null }`.
2. **Sub in** (`E.sub`, ~265-282): when a bench player enters, set
   `m.span[s][pin.id] = { from: m.min, to: null }`. When `outId` is given, set
   `m.span[s][outId].to = m.min`.
3. **Leave the pitch by incident** (`E.step`, ~313-332): at the three places that do
   `on.splice(...)` (second yellow, straight red, injury), set
   `m.span[s][p.id].to = m.min`.
4. **Compute cost in `finishRound`** (~365-366). Replace the flat charge with:
   - `mins = (span.to ?? 90) - span.from` (clamp to 0..90; if no span, 0)
   - `cost = Math.round((11 + (p.age > 30 ? 3 : 0)) * mins / 90)`
   - `p.fit = Math.max(20, p.fit - cost)`
   - Iterate over `m.span[s]` entries (or players in `m.used[s]` with a span).
   - Check `E.playAll` (not yet read) so that matches simulated to completion always
     end at minute 90 and `to: null` means "until 90".
5. Leave the `+9` recovery line (~393) untouched.
6. **Test**: add `test/fatigue.test.js` and append it to the `test` script in
   `package.json` (currently `node test/sim.test.js && node test/roster.test.js &&
   node test/order.test.js`). Follow the style of `test/sim.test.js`
   (`require('../js/engine.js')`, seeded `E.rand`, `assert`). Build a match with
   `E.startRound`, set `m.span` / `m.min` by hand or call `E.sub`, then `E.finishRound`
   and assert `fit` for four cases:
   - starter plays 90 -> cost 11 (14 if age > 30), then +9 recovery
   - starter subbed off at 45 -> about half cost (rounded)
   - sub on at 60 -> about a third of cost (rounded)
   - player who did not play -> cost 0, then +9 recovery (cap 100)
   Pin `fit` values before the round so the expected numbers are exact. Remember
   `finishRound` applies cost then recovery in one call.
7. Run `npm test`; make sure `sim.test.js` invariants still hold.
8. Manual check in the UI (`npm start`): play a round, sub a player off early, confirm
   the fitness bars (`ui.js:52`, 150, 281, 378) show the expected values.

## Out of scope / not changing

- Recovery rate, the floor of 20, `E.eff`, injury odds, in-match fatigue.
- Any UI change (fitness is displayed as an integer, which the rounding keeps).
- Save migration (not needed, see decision 2).

## Open points to verify when starting

- Read `E.playAll` and any UI code that ends a match early to confirm `m.min` reaches 90.
- Confirm `finishRound` is the only place that applies fatigue (the earlier survey says so).
