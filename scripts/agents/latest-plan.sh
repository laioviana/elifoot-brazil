#!/usr/bin/env bash
# latest-plan.sh ISSUE — imprime o último plano postado pelo agente na issue (comentário marcado <!-- agent-plan -->).
set -euo pipefail
gh issue view "$1" --json comments --jq '
  [.comments[] | select(.author.login == "github-actions" and (.body | contains("<!-- agent-plan -->")))]
  | last | .body // empty' | sed '/<!-- agent-plan -->/d'
