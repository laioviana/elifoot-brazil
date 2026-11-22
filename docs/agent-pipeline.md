# Agent pipeline — setup and daily use

Issues are planned by **Opus**, implemented by **Sonnet**, reviewed by **Opus**, and handed to you as a PR that is
ready to merge. You merge by hand. Why it works this way: [`agent-pipeline-design.md`](agent-pipeline-design.md).

```
you: label agent:plan
  └─ Planner (Opus, issue-planner) ──► questions in the issue ──► you reply in a comment ──┐
                                   └─► plan in the issue (plan:ready) ◄──────────────────────┘
small change: development starts by itself  │  big change (or plan:manual): you add label plan:approved
  └─ Developer (Sonnet, implement-plan) ──► draft PR
       └─ Reviewer (Opus, plan-review + code-review) ──► changes? back to Developer (max 3 reviews)
            └─ CI green ──► PR marked ready, label ready-for-human ──► you review and merge
                                                                    └─ you "Request changes" ──► back to Developer
```

---

## One-time setup (step by step)

Do these after merging the PR that adds the pipeline.

### 1. Create the Claude token (on your own computer)

1. Make sure Claude Code is installed and you are logged in with your **Pro** account.
2. In a terminal run:

   ```bash
   claude setup-token
   ```

3. Follow the browser login. Copy the token it prints (it is valid for one year). Do not paste it anywhere else.

### 2. Add the token to GitHub

1. Open the repo on GitHub → **Settings** → **Secrets and variables** → **Actions** → tab **Secrets**.
2. **New repository secret**. Name: `CLAUDE_CODE_OAUTH_TOKEN`. Value: the token. Save.
3. In the same list, make sure there is **no** secret named `ANTHROPIC_API_KEY`. (The pipeline never reads it, but
   keep it out so nothing can bill the API by accident.)

### 3. Keep extra usage off (so you never pay more)

On claude.ai → **Settings** → **Usage**: make sure **usage credits / extra usage is off**. With it off, the worst
case is that a run stops at your plan limit; nothing is billed beyond your Pro subscription.

### 4. Let workflows open PRs

Repo → **Settings** → **Actions** → **General** → **Workflow permissions**:
- select **Read and write permissions**;
- tick **Allow GitHub Actions to create and approve pull requests**;
- **Save**.

### 5. Turn the pipeline on

Repo → **Settings** → **Secrets and variables** → **Actions** → tab **Variables** → **New repository variable**:
`AGENTS_ENABLED` = `true`.

(Optional variables are listed in [Settings reference](#settings-reference). The defaults are fine to start.)

### 6. Create the labels

Repo → **Actions** → **Agent: labels** (left list) → **Run workflow** → **Run workflow**. Wait for the green check.
Then open **Issues** → **Labels** and check that `agent:plan`, `plan:approved`, `ready-for-human` etc. exist.

### 7. Protect `main`

Repo → **Settings** → **Branches** → **Add branch ruleset** (or **Add rule**), target branch `main`:
- **Require a pull request before merging** — required approvals: **0** (GitHub does not let you approve your own
  PR, and you are the reviewer).
- **Require status checks to pass** → add the check **`test`** (from the CI workflow).
- **Block force pushes**.
- Save.

### 8. First test run

1. Pick a **small, real** issue (a UI tweak like the recent ones is ideal).
2. Add the label **`agent:plan`**.
3. Open **Actions** → **Agent: plan** → the running job → step **Gate**. Look for a line like
   `[agents] uso: 5h=12% semana=30% (limite 80%)`. That means the usage check works.
4. If instead the issue gets **`agent:paused`** with "Não consegui ler o uso do seu plano", the usage check does not
   work in GitHub Actions. Switch to the fallback (see [Usage protection](#usage-protection)) and re-add `agent:plan`.
5. Answer the planner's questions in the issue, approve the plan with `plan:approved`, and wait for
   `ready-for-human`.

After the first full run, look at how much usage one issue took (compare the numbers in the Gate step of the plan
run and the develop run) and tune `AGENTS_MAX_USAGE` if you want.

---

## Daily use

| You want to… | Do this |
| --- | --- |
| Start an issue | Add label **`agent:plan`** |
| Answer the planner's questions | **Comment in the same issue**, by number: `1 sim, 2 usar 3 substituições, 3 sim`. Just `sim` accepts every recommendation. |
| Approve the plan | Only for **big** changes: add label **`plan:approved`**. **Small** changes start development by themselves (the plan comment says "🚀 Mudança pequena"); you review the PR. |
| Always approve plans for one issue | Add label **`plan:manual`** together with `agent:plan` |
| Ask for plan changes | Comment in the issue with what to change (while it is `plan:ready`) |
| Ask the agent to change the PR | On the agent's PR: **Files changed** → leave your comments → **Review changes** → **Request changes** → **Submit review**. Sonnet fixes them, Opus re-reviews, CI runs, and the issue goes back to `ready-for-human`. Plain comments (without "Request changes") do **not** start an agent. |
| Merge | When the issue gets **`ready-for-human`**, review the PR and merge it yourself |
| Resume after `agent:paused` | Remove and re-add the last label you added (`agent:plan` or `plan:approved`) |
| Stop everything | Set variable `AGENTS_ENABLED` = `false` |
| Restart after `needs-human` | Read the comment; fix the issue/plan or PR by hand, or re-add `plan:approved` to resume on the existing branch |

Only comments from you (or collaborators with write access) are read. Comments from other people are ignored.

### Label meanings

| Label | Who sets it | Meaning |
| --- | --- | --- |
| `agent:plan` | you | start planning |
| `plan:questions` | pipeline | planner is waiting for your answers |
| `plan:ready` | pipeline | plan posted; approve or comment |
| `plan:manual` | you (optional) | require plan approval even if the change is small |
| `plan:approved` | you, or the pipeline for small changes | start development |
| `agent:dev` / `agent:review` | pipeline | developer / reviewer working |
| `ready-for-human` | pipeline | PR ready for your review and merge |
| `needs-human` | pipeline | stopped: review loop exhausted, CI failed, or something unexpected (see comment) |
| `agent:paused` | pipeline | stopped by the usage limit or a failed run (see comment) |
| `agent:queued` | pipeline | waiting: another issue is running, agents are off, or outside the night window |
| `agent:working` | pipeline | a job is running right now; remove it by hand only if a job was cancelled and the label stayed |

---

## Usage protection

Your Pro limits are shared between chat and the pipeline. To keep usage for chatting:

1. **Usage check before each stage.** Before planning, before each review and before each fix round, the pipeline
   opens a short Claude Code session (with the cheapest model) to read your 5-hour and weekly usage. If either is
   **≥ `AGENTS_MAX_USAGE`** (default **80%**), the issue gets `agent:paused` with a table of your usage and reset
   times. If the check cannot read the usage, it also pauses (fail-safe).
   - Why 80% and not 95%: the check runs *before* a stage and a stage can use several percent. Raise it after you see
     real numbers.
   - This check is **experimental**: it relies on the interactive status line. If it keeps failing, use the fallback.
2. **Fallback — night mode.** Set `AGENTS_USAGE_CHECK` = `off` and `AGENTS_NIGHT_ONLY` = `true`. Anything you trigger
   during the day is queued and runs between 01:00 and 06:00 (São Paulo), so the 5-hour window resets before your
   day. The weekly limit is still shared; watch it on claude.ai → Settings → Usage and use the switch.
3. **On/off switch.** `AGENTS_ENABLED` = `false` stops everything; queued issues wait.
4. **Hard limit.** Usage credits are off, so a run that hits the limit just stops and the issue gets `agent:paused`.

---

## Settings reference

Repository **variables** (Settings → Secrets and variables → Actions → Variables). All optional except `AGENTS_ENABLED`.

| Variable | Default | Meaning |
| --- | --- | --- |
| `AGENTS_ENABLED` | `true` | `false` stops the pipeline |
| `AGENTS_MAX_USAGE` | `80` | pause when 5-hour or weekly usage is at or above this % |
| `AGENTS_USAGE_CHECK` | `on` | `off` disables the usage check (use with night mode) |
| `AGENTS_NIGHT_ONLY` | `false` | `true` runs agents only in the night window |
| `AGENTS_NIGHT_START` / `AGENTS_NIGHT_END` | `1` / `6` | night window, hours in `AGENTS_TZ` |
| `AGENTS_TZ` | `America/Sao_Paulo` | time zone for the night window and messages |
| `AGENTS_PLAN_MODEL` | `claude-opus-5-5` | planner model |
| `AGENTS_DEV_MODEL` | `claude-sonnet-5-5` | developer model |
| `AGENTS_REVIEW_MODEL` | `claude-opus-5-5` | reviewer model |
| `AGENTS_MAX_ROUNDS` | `3` | maximum review rounds |
| `AGENTS_PLAN_MAX_TURNS` / `AGENTS_DEV_MAX_TURNS` / `AGENTS_REVIEW_MAX_TURNS` | `60` / `120` / `80` | safety cap on agent turns per run |
| `CLAUDE_CODE_VERSION` | `latest` | pin a Claude Code version if an update breaks something |

## Files

| File | Role |
| --- | --- |
| `.claude/skills/issue-planner/SKILL.md` | planner instructions |
| `.claude/skills/implement-plan/SKILL.md` | developer instructions |
| `.claude/skills/plan-review/SKILL.md` | reviewer instructions (uses the built-in `code-review` skill) |
| `.github/workflows/agent-plan.yml` | planning stage |
| `.github/workflows/agent-develop.yml` | develop + review loop |
| `.github/workflows/agent-queue.yml` | runs queued issues when possible (hourly and after each stage) |
| `.github/workflows/agent-labels.yml` | creates the labels (run once) |
| `scripts/agents/*` | gate, usage check, develop loop, helpers |
| `docs/plans/issue-<N>.md` | the approved plan, committed in each PR |

## Troubleshooting

- **Nothing happens when I add a label** → check `AGENTS_ENABLED`, then Actions → the workflow run. If the issue got
  `agent:queued`, read its comment.
- **`agent:working` stuck on an issue and everything else is queued** → a job was cancelled. Remove the label by hand.
- **CI required check is not shown on the agent's PR** → the pipeline starts CI itself with `workflow_dispatch`
  before marking the PR ready. Open Actions → CI and check the run for that branch.
- **Full logs** → each develop run uploads an `agent-logs-<issue>` artifact (Claude output, test output, review JSON).
