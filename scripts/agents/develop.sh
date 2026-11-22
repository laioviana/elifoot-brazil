#!/usr/bin/env bash
# develop.sh ISSUE — etapas 3 e 4: Sonnet implementa o plano aprovado, Opus revisa, até MAX_ROUNDS revisões.
# Termina com o rótulo ready-for-human, needs-human ou agent:paused. Nunca faz merge.
set -uo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
source "$here/lib.sh"
issue="$1"
base="${BASE:-main}"
max_rounds="${MAX_ROUNDS:-3}"
out="${RUNNER_TEMP:-/tmp}/agent-out"; mkdir -p "$out"
plan="docs/plans/issue-$issue.md"
run_url="${GITHUB_SERVER_URL:-https://github.com}/${GITHUB_REPOSITORY:-}/actions/runs/${GITHUB_RUN_ID:-}"
dev_tools="Skill Read Glob Grep Edit Write Bash(npm test) Bash(npm run test) Bash(node:*) Bash(git status:*) Bash(git diff:*) Bash(git log:*) Bash(ls:*)"
review_tools="Skill Agent Read Glob Grep Write Bash(git diff:*) Bash(git log:*) Bash(git show:*) Bash(git status:*) Bash(npm test) Bash(ls:*)"

fail() { set_state "$issue" needs-human; comment "$issue" "⚠️ **Precisa de você:** $1

Log: $run_url"; exit 0; }
stop_paused() { pause "$issue" "$1 Log: $run_url"; exit 0; }
# O Claude roda sem GH_TOKEN: ele só mexe nos arquivos; o workflow é quem fala com o GitHub.
claude_run() { GH_TOKEN= AGENT_LOG="$out/claude.log" bash "$here/run-claude.sh" "$@"; }

git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
git fetch -q origin "$base"

title="$(gh issue view "$issue" --json title --jq .title)"
slug="$(printf '%s' "$title" | iconv -f utf-8 -t ascii//TRANSLIT 2>/dev/null | tr '[:upper:]' '[:lower:]' \
  | tr -cs 'a-z0-9' '-' | sed 's/^-*//; s/-*$//' | cut -c1-40 | sed 's/-*$//')"
existing="$(git ls-remote --heads origin "agent/issue-$issue-*" "agent/issue-$issue" | head -n1 | sed 's#.*refs/heads/##')"

commit_push() {
  git add -A
  git diff --cached --quiet && return 1
  git commit -q -m "$1" && git push -q -u origin "$branch"
}

write_pr_body() {
  { echo "Closes #$issue"; echo
    echo "Plano aprovado: [\`$plan\`](../blob/$branch/$plan)"; echo
    [ -s "$out/summary.md" ] && cat "$out/summary.md" && echo
    echo '---'
    echo '🤖 Aberto pelo pipeline de agentes (`docs/agent-pipeline.md`). Revisão e merge são humanos.'
  } > "$out/pr-body.md"
}

if [ -n "$existing" ]; then
  branch="$existing"
  log "retomando $branch"
  git fetch -q origin "$branch" && git checkout -q -B "$branch" FETCH_HEAD
  pr="$(gh pr list --head "$branch" --state open --json number --jq '.[0].number // empty')"
else
  branch="agent/issue-$issue${slug:+-$slug}"
  git checkout -q -B "$branch" "origin/$base"
  mkdir -p docs/plans
  bash "$here/latest-plan.sh" "$issue" > "$plan"
  [ -s "$plan" ] || fail 'não encontrei o plano aprovado nos comentários da issue. Rode o planejamento de novo (rótulo `agent:plan`).'

  set_state "$issue" agent:dev
  claude_run "$DEV_MODEL" "$DEV_MAX_TURNS" "$dev_tools" \
    "/implement-plan PLAN=$plan OUT=$out (issue #$issue, primeira rodada: implementar)" \
    || stop_paused 'O agente de desenvolvimento falhou ou atingiu o limite de uso do plano.'
  git add "$plan"
  commit_push "Implementa #$issue: $title" || fail 'o agente de desenvolvimento não alterou nenhum arquivo.'
  pr=""
fi

if [ -z "$pr" ]; then
  write_pr_body
  pr="$(gh pr create --draft --base "$base" --head "$branch" --title "$title (#$issue)" --body-file "$out/pr-body.md" \
        | grep -o '[0-9]*$')" || fail 'não consegui abrir o PR.'
  comment "$issue" "🛠️ PR aberto: #$pr. Começando a revisão."
fi

approved=false
for round in $(seq 1 "$max_rounds"); do
  npm test > "$out/tests.txt" 2>&1; tests_rc=$?
  echo "exit code: $tests_rc" >> "$out/tests.txt"

  bash "$here/usage-gate.sh" "$issue" || exit 0
  set_state "$issue" agent:review
  rm -f "$out/review.json"
  claude_run "$REVIEW_MODEL" "$REVIEW_MAX_TURNS" "$review_tools" \
    "/plan-review PLAN=$plan BASE=origin/$base TESTS=$out/tests.txt SUMMARY=$out/summary.md OUT=$out (PR #$pr, rodada $round de $max_rounds)" \
    || stop_paused 'O agente de revisão falhou ou atingiu o limite de uso do plano.'

  verdict="$(node "$here/review-comment.js" "$out/review.json" "$round" "$max_rounds" "$tests_rc" "$out/review.md")" \
    || fail 'o agente de revisão não gerou um veredito válido (review.json).'
  gh pr comment "$pr" --body-file "$out/review.md" >/dev/null

  if [ "$verdict" = APPROVE ] && [ "$tests_rc" -eq 0 ]; then approved=true; break; fi
  [ "$round" -eq "$max_rounds" ] && break

  bash "$here/usage-gate.sh" "$issue" || exit 0
  set_state "$issue" agent:dev
  claude_run "$DEV_MODEL" "$DEV_MAX_TURNS" "$dev_tools" \
    "/implement-plan PLAN=$plan OUT=$out REVIEW=$out/review.json TESTS=$out/tests.txt (issue #$issue, rodada de correção $round)" \
    || stop_paused 'O agente de desenvolvimento falhou ou atingiu o limite de uso do plano.'
  commit_push "Corrige revisão $round de #$issue" || log "nenhuma mudança nesta rodada"
done

$approved || fail "a revisão ainda pede mudanças depois de $max_rounds rodadas. Veja os comentários no PR #$pr."

# CI oficial: pushes feitos pelo GITHUB_TOKEN não disparam workflows, então o CI é disparado manualmente aqui.
sha="$(git rev-parse HEAD)"
gh workflow run ci.yml --ref "$branch" || fail 'não consegui disparar o CI.'
run_id=""
for _ in $(seq 1 30); do
  sleep 5
  run_id="$(gh run list --workflow ci.yml --branch "$branch" --event workflow_dispatch --limit 5 \
            --json databaseId,headSha --jq "map(select(.headSha == \"$sha\")) | .[0].databaseId // empty")"
  [ -n "$run_id" ] && break
done
[ -n "$run_id" ] || fail 'o CI não começou.'
gh run watch "$run_id" --exit-status >/dev/null || fail "o CI falhou no PR #$pr."

write_pr_body
gh pr edit "$pr" --body-file "$out/pr-body.md" >/dev/null
gh pr ready "$pr" >/dev/null
set_state "$issue" ready-for-human
comment "$issue" "✅ **Pronto para sua revisão:** #$pr. Revisão aprovada pelo agente e CI verde. O merge é seu."
