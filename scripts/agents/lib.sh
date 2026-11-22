# Funções comuns do pipeline de agentes. Use com: source scripts/agents/lib.sh
# Requer GH_TOKEN (token do workflow) e GITHUB_REPOSITORY.

# Rótulos de estado: uma issue tem no máximo um deles por vez.
STATE_LABELS=(plan:questions plan:ready agent:dev agent:review ready-for-human needs-human agent:paused agent:queued)
AGENT_TZ="${AGENTS_TZ:-America/Sao_Paulo}"

log() { echo "[agents] $*" >&2; }

issue_labels() { gh issue view "$1" --json labels --jq '.labels[].name'; }

has_label() { issue_labels "$1" | grep -qx "$2"; }

# set_state ISSUE NOVO_ROTULO — remove os outros rótulos de estado e aplica o novo.
set_state() {
  local issue="$1" new="$2" current rm=()
  current="$(issue_labels "$issue")"
  for l in "${STATE_LABELS[@]}"; do
    [ "$l" != "$new" ] && grep -qx "$l" <<<"$current" && rm+=("$l")
  done
  local args=(--add-label "$new")
  [ ${#rm[@]} -gt 0 ] && args+=(--remove-label "$(IFS=,; echo "${rm[*]}")")
  gh issue edit "$issue" "${args[@]}" >/dev/null
  log "issue #$issue -> $new"
}

clear_state() {
  local issue="$1" current rm=()
  current="$(issue_labels "$issue")"
  for l in "${STATE_LABELS[@]}"; do grep -qx "$l" <<<"$current" && rm+=("$l"); done
  [ ${#rm[@]} -gt 0 ] && gh issue edit "$issue" --remove-label "$(IFS=,; echo "${rm[*]}")" >/dev/null
  return 0
}

# comment ISSUE TEXTO
comment() { gh issue comment "$1" --body "$2" >/dev/null; }

# pause ISSUE MOTIVO — para o pipeline desta issue até o dono retomar.
pause() {
  local issue="$1" reason="$2" how
  if has_label "$issue" plan:approved; then how='remova e adicione de novo o rótulo `plan:approved`'
  else how='remova e adicione de novo o rótulo `agent:plan`'; fi
  set_state "$issue" agent:paused
  comment "$issue" "⏸️ **Pipeline pausado.** $reason

Para retomar, $how."
}

# fmt_time EPOCH — data/hora local para mensagens.
fmt_time() { [ -n "${1:-}" ] && [ "$1" != null ] && TZ="$AGENT_TZ" date -d "@$1" '+%d/%m %H:%M' || echo '?'; }

# in_night_window — 0 se a hora local está na janela noturna (AGENTS_NIGHT_START..AGENTS_NIGHT_END).
in_night_window() {
  local h s="${AGENTS_NIGHT_START:-1}" e="${AGENTS_NIGHT_END:-6}"
  h=$((10#$(TZ="$AGENT_TZ" date +%H)))
  if [ "$s" -le "$e" ]; then [ "$h" -ge "$s" ] && [ "$h" -lt "$e" ]
  else [ "$h" -ge "$s" ] || [ "$h" -lt "$e" ]; fi
}

# busy_issue [EXCETO] — imprime a issue que está com um agente rodando (rótulo agent:working).
busy_issue() {
  gh issue list --state open --label agent:working --json number --jq '.[].number' | grep -vx "${1:-0}" | head -n1
}

# Por que o pipeline não pode rodar agora (vazio = pode). Usado pelo gate e pela fila.
blocked_reason() {
  local busy
  if [ "${AGENTS_ENABLED:-true}" = false ]; then echo 'os agentes estão desligados (`AGENTS_ENABLED=false`)'; return; fi
  if [ "${AGENTS_NIGHT_ONLY:-false}" = true ] && ! in_night_window; then
    echo "os agentes só rodam entre ${AGENTS_NIGHT_START:-1}h e ${AGENTS_NIGHT_END:-6}h (\`AGENTS_NIGHT_ONLY=true\`)"; return
  fi
  busy="$(busy_issue "${1:-0}")"
  if [ -n "$busy" ]; then echo "outra issue está em andamento (#$busy)"; fi
}

ensure_claude() {
  command -v claude >/dev/null 2>&1 && return 0
  log "instalando Claude Code ${CLAUDE_CODE_VERSION:-latest}"
  npm install -g "@anthropic-ai/claude-code@${CLAUDE_CODE_VERSION:-latest}" >/dev/null
}
