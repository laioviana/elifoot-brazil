#!/usr/bin/env bash
# gate.sh ISSUE — decide se uma etapa pode começar agora. Escreve proceed=true|false em GITHUB_OUTPUT.
# Se não puder: coloca na fila (agent:queued) ou pausa (uso alto). Se puder: marca a issue com agent:working.
set -uo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
source "$here/lib.sh"
issue="$1"
decide() { echo "proceed=$1" >> "${GITHUB_OUTPUT:-/dev/null}"; log "proceed=$1"; exit 0; }

reason="$(blocked_reason "$issue")"
if [ -n "$reason" ]; then
  if ! has_label "$issue" agent:queued; then
    set_state "$issue" agent:queued
    comment "$issue" "🕒 **Na fila:** $reason. A etapa começa sozinha quando for possível."
  fi
  decide false
fi

bash "$here/usage-gate.sh" "$issue" || decide false

gh issue edit "$issue" --add-label agent:working >/dev/null
decide true
