#!/usr/bin/env bash
# run-claude.sh MODELO MAX_TURNS FERRAMENTAS PROMPT — roda o Claude Code sem interação, com log em $AGENT_LOG.
set -uo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
source "$here/lib.sh"
ensure_claude || exit 1
log="${AGENT_LOG:-${RUNNER_TEMP:-/tmp}/claude.log}"
log "claude --model $1 --max-turns $2"
claude -p "$4" --model "$1" --max-turns "$2" --allowedTools "$3" 2>&1 | tee -a "$log"
exit "${PIPESTATUS[0]}"
