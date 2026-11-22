#!/usr/bin/env bash
# Lê o uso do plano (janela de 5 h e semanal) abrindo uma sessão interativa curta do Claude Code num terminal
# virtual (tmux). Os percentuais só existem na status line, que só roda no modo interativo.
# Saída (stdout): five=<%> week=<%> five_reset=<epoch> week_reset=<epoch>. Código 0 = leu; 1 = não conseguiu ler.
set -uo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
source "$here/lib.sh"
ensure_claude || exit 1
command -v tmux >/dev/null 2>&1 || sudo apt-get install -y tmux >/dev/null 2>&1 || exit 1

work="$(mktemp -d)"
sock="$work/tmux.sock"
out="$work/usage.json"
cleanup() { tmux -S "$sock" kill-server >/dev/null 2>&1; rm -rf "$work"; }
trap cleanup EXIT
mkdir -p "$work/home/.claude" "$work/proj"
cat > "$work/home/.claude/settings.json" <<JSON
{"statusLine":{"type":"command","command":"node $here/statusline-capture.js $out"}}
JSON
cat > "$work/home/.claude.json" <<JSON
{"hasCompletedOnboarding":true,"theme":"dark","projects":{"$work/proj":{"hasTrustDialogAccepted":true,"hasCompletedProjectOnboarding":true}}}
JSON

HOME="$work/home" tmux -S "$sock" new-session -d -s usage -x 200 -y 50 -c "$work/proj" \
  "claude --model '${AGENTS_USAGE_MODEL:-claude-haiku-5-5}'"

send_prompt() {
  tmux -S "$sock" send-keys -t usage -l 'Responda apenas: OK'
  sleep 1
  tmux -S "$sock" send-keys -t usage Enter
}

sleep 8
send_prompt
for i in $(seq 1 60); do
  [ -s "$out" ] && break
  # Se algum diálogo inicial apareceu, Enter aceita a opção padrão; depois manda o prompt de novo.
  if [ "$i" -eq 10 ] || [ "$i" -eq 25 ]; then tmux -S "$sock" send-keys -t usage Enter; sleep 2; send_prompt; fi
  sleep 2
done

if [ ! -s "$out" ]; then
  log "não consegui ler o uso. Tela do terminal:"
  tmux -S "$sock" capture-pane -p -t usage >&2 2>/dev/null || true
  exit 1
fi

node -e '
  const r = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
  const v = (w, k) => (r[w] && r[w][k] != null ? r[w][k] : "");
  const five = v("five_hour", "used_percentage"), week = v("seven_day", "used_percentage");
  if (five === "" && week === "") process.exit(1);
  console.log(`five=${five} week=${week} five_reset=${v("five_hour", "resets_at")} week_reset=${v("seven_day", "resets_at")}`);
' "$out"
