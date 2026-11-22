# Agent pipeline — design record

This is the agreed design of the automated development pipeline, from the planning interview held on 2026-11-22.
How to set it up and use it: [`agent-pipeline.md`](agent-pipeline.md).

## Goal

Pick up issues, plan them with the owner, implement, review, and deliver a **PR that is ready to merge**. The owner
reviews and merges by hand. Agents never merge.

## Decisions

| # | Topic | Decision |
| --- | --- | --- |
| 1 | Where agents run | GitHub Actions, in this repo, triggered by issue events. |
| 2 | Which issues | Only issues the owner labels `agent:plan`. |
| 3 | Planning without live chat | A dedicated skill, `issue-planner` (instead of plain `grilling`): it explores the code first, decides low-risk points itself (listed as *Assumptions*), and asks only high-risk decisions as numbered questions with a recommended answer, in an issue comment. The owner answers in the issue; the next comment resumes planning. |
| 4 | Where the plan lives | Both: posted as an issue comment, and committed in the PR as `docs/plans/issue-<N>.md`. |
| 5 | Plan approval | Required. The owner adds the `plan:approved` label; comments while `plan:ready` ask for changes. |
| 6 | Review loop | Max 3 review rounds, then `needs-human`. |
| 7 | Reviewer | Opus, using the built-in `code-review` skill plus a check against the plan (`plan-review` skill). |
| 8 | "Ready to merge" | `npm test` passes in CI, reviewer approves, developer added/updated tests in `test/`. Then `ready-for-human`. |
| 9 | Concurrency | One issue at a time; others wait in a queue (`agent:queued`). |
| 10 | Auth and cost | `CLAUDE_CODE_OAUTH_TOKEN` from the owner's **Pro** plan (`claude setup-token`). Usage credits stay off, so the pipeline can never cost more than the subscription. No `ANTHROPIC_API_KEY`. |
| 11 | Planner skill | `issue-planner`, fixed plan format: Goal, Decisions, Assumptions, Files to change, Tasks, Test plan, Acceptance criteria, Out of scope. |
| 12 | Approval UX | One label click (`plan:approved`), works on GitHub mobile. Only users with write access can label or trigger runs. |
| 13 | Labels | `agent:plan` → `plan:questions` ⇄ (owner comments) → `plan:ready` → `plan:approved` → `agent:dev` ⇄ `agent:review` → `ready-for-human` / `needs-human`. Plus `agent:paused`, `agent:queued`, `agent:working`. The owner answers questions by commenting in the same issue. |
| 14 | Hard usage limit | Credits off; a run that hits the limit pauses the issue (`agent:paused`); the owner resumes by re-adding the label. |
| 15 | Dev ⇄ review | One workflow run does develop + review rounds (GitHub ignores events created by bots, so stages cannot hand off by label). |
| 16 | `main` protection | PR required, CI `test` check required, only the owner merges. |
| 17 | Branch / PR | `agent/issue-<N>-<slug>`, draft PR with `Closes #<N>` and a link to the plan, marked ready only at `ready-for-human`. |
| 18 | Language | Agents write in the language of the issue. |
| 19 | Extra controls | On/off switch `AGENTS_ENABLED`. Per-run turn caps kept as a safety net. |
| 20 | Deliverables | `CLAUDE.md`; skills `issue-planner`, `implement-plan`, `plan-review`; workflows `agent-plan`, `agent-develop`, `agent-queue`, `agent-labels`; scripts in `scripts/agents/`; these two docs. |
| 21 | Setup | Owner does the account-bound steps (token, secret, branch protection, run labels workflow), following `agent-pipeline.md`. |
| 22 | Delivery | One PR from the session branch. |
| 23 | First test | A small, real issue, after merge. |
| 24 | Keep usage for chat | Before each stage (plan, each review, each fix), read 5-hour and weekly usage; pause at ≥ `AGENTS_MAX_USAGE` (default 80%, adjustable). If the usage cannot be read, pause (fail-safe). |
| 25 | Fallback if 24 does not work | Both: the manual switch, and night mode (`AGENTS_NIGHT_ONLY`, 01:00–06:00 São Paulo). |

## Skills used

| Skill | Stage | Model |
| --- | --- | --- |
| `issue-planner` (new) | planning | Opus |
| `implement-plan` (new) | development and fix rounds | Sonnet |
| `plan-review` (new) | review | Opus |
| `code-review` (built into Claude Code) | called by `plan-review` | Opus |
| `grilling` / `grill-me` (existing) | interactive planning by hand, outside the pipeline | — |

## Implementation notes

- **Claude Code CLI, not `claude-code-action`.** The workflows install Claude Code and run `claude -p` directly. This
  allows the develop/review loop in one job, and keeps every GitHub write (comments, labels, commits, PRs) in the
  workflow's own steps. Claude itself runs **without a GitHub token**, with an explicit tool allowlist per stage, so
  issue text cannot make it push, merge or relabel anything.
- **CI on agent PRs.** Pushes and PRs made with `GITHUB_TOKEN` do not trigger workflows, so the develop run starts
  `ci.yml` with `workflow_dispatch` on the PR head and waits for it before marking the PR ready. The check is attached
  to the same commit, which satisfies the required `test` status.
- **Usage check.** The 5-hour and weekly percentages are only exposed to the interactive status line (no documented
  headless API). `scripts/agents/usage-check.sh` opens a short interactive session in `tmux` with a status line that
  saves `rate_limits`, sends one tiny prompt with the cheapest model, reads the file and exits. This is a workaround,
  not a supported interface; it fails safe.
- **Queue.** `agent-queue.yml` runs hourly and after every stage. It dispatches the oldest `agent:queued` issue when
  the switch is on, nothing is running (`agent:working`), and (in night mode) the hour is inside the window.
- **Resume.** Re-adding `plan:approved` finds the existing `agent/issue-<N>-*` branch and PR and continues with a review
  round instead of starting over.

## Known limitations

- The usage check runs before a stage, not during it: one long stage can go past the threshold.
- The usage check depends on Claude Code's interactive UI; an update can break it (pin `CLAUDE_CODE_VERSION` if so).
- GitHub keeps only one pending run per concurrency group; in rare bursts a trigger can be dropped. Re-add the label.
- If a job is cancelled hard, `agent:working` can stay on the issue and block the queue; remove it by hand.
- Each planning or review round consumes Pro usage shared with chat; Opus stages are the expensive ones.
