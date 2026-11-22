#!/usr/bin/env bash
# usage-gate.sh ISSUE — pausa a issue e sai com 1 se o uso do plano passou do limite (AGENTS_MAX_USAGE, padrão 80)
# ou se não deu para ler o uso. Desligue com AGENTS_USAGE_CHECK=off.
set -uo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
source "$here/lib.sh"
issue="$1"
max="${AGENTS_MAX_USAGE:-80}"

if [ "${AGENTS_USAGE_CHECK:-on}" = off ]; then log "checagem de uso desligada"; exit 0; fi

if ! res="$(bash "$here/usage-check.sh")"; then
  pause "$issue" "Não consegui ler o uso do seu plano Claude, então não iniciei a etapa (por segurança).
Se isso se repetir, use o modo noturno: \`AGENTS_USAGE_CHECK=off\` e \`AGENTS_NIGHT_ONLY=true\` (veja \`docs/agent-pipeline.md\`)."
  exit 1
fi
eval "$res"
log "uso: 5h=${five:-?}% semana=${week:-?}% (limite ${max}%)"
echo "five=${five:-} week=${week:-}" >> "${GITHUB_OUTPUT:-/dev/null}"

over() { [ -n "$1" ] && awk -v u="$1" -v m="$max" 'BEGIN { exit !(u >= m) }'; }
if over "${five:-}" || over "${week:-}"; then
  pause "$issue" "O uso do seu plano Claude chegou ao limite configurado (${max}%), para sobrar uso para o chat.

| Janela | Uso | Renova em |
| --- | --- | --- |
| 5 horas | ${five:-?}% | $(fmt_time "${five_reset:-}") |
| Semanal | ${week:-?}% | $(fmt_time "${week_reset:-}") |"
  exit 1
fi
exit 0
