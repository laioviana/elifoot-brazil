#!/usr/bin/env bash
# publish-plan.sh ISSUE OUT CLAUDE_OUTCOME — publica o resultado do planejador na issue.
# Perguntas → plan:questions. Plano pequeno (OUT/size.txt = small, sem o rótulo plan:manual) → começa o
# desenvolvimento sozinho. Plano grande → plan:ready, esperando você adicionar plan:approved.
set -uo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
source "$here/lib.sh"
issue="$1" out="$2" outcome="$3"
run_url="${GITHUB_SERVER_URL:-https://github.com}/${GITHUB_REPOSITORY:-}/actions/runs/${GITHUB_RUN_ID:-}"

if [ "$outcome" != success ]; then
  pause "$issue" "O agente de planejamento falhou ou atingiu o limite de uso do plano. Veja o log: $run_url"
  exit 0
fi

if [ -s "$out/questions.md" ]; then
  gh issue comment "$issue" --body-file "$out/questions.md" >/dev/null
  set_state "$issue" plan:questions
  exit 0
fi

if [ ! -s "$out/plan.md" ]; then
  set_state "$issue" needs-human
  comment "$issue" "⚠️ O agente de planejamento terminou sem perguntas nem plano. Log: $run_url"
  exit 0
fi

# Na dúvida, grande: só "small" exato conta como pequeno.
size="$(tr -d '[:space:]' < "$out/size.txt" 2>/dev/null | tr '[:upper:]' '[:lower:]')"
auto=false
if [ "$size" = small ]; then
  if has_label "$issue" plan:manual; then
    log "mudança pequena, mas a issue tem plan:manual"
  else
    auto=true
  fi
fi

{ echo '<!-- agent-plan -->'; cat "$out/plan.md"; echo; echo '<!-- /agent-plan -->'
  echo '---'
  if $auto; then
    echo '🚀 **Mudança pequena:** o desenvolvimento começou sem esperar aprovação. Você revisa o resultado no PR.'
  else
    echo '✅ Para aprovar, adicione o rótulo **`plan:approved`**. Para pedir mudanças, comente nesta issue.'
  fi
} > "$out/plan-comment.md"
gh issue comment "$issue" --body-file "$out/plan-comment.md" >/dev/null

if $auto; then
  # Rótulos adicionados pelo GITHUB_TOKEN não disparam workflows; workflow_dispatch dispara.
  gh issue edit "$issue" --add-label plan:approved >/dev/null
  set_state "$issue" agent:dev
  gh workflow run agent-develop.yml -f issue="$issue" \
    || { set_state "$issue" plan:ready; comment "$issue" 'Não consegui iniciar o desenvolvimento sozinho. Adicione o rótulo `plan:approved` (remova e adicione de novo se já estiver lá).'; }
else
  set_state "$issue" plan:ready
fi
