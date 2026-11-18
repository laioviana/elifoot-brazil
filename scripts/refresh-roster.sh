#!/usr/bin/env bash
# Atualiza js/roster.js pelo Transfermarkt e abre um PR. Rode quando quiser:
#
#   npm run refresh-roster                 # pergunta antes de criar a branch/PR
#   npm run refresh-roster -- --yes        # sem perguntar
#   npm run refresh-roster -- --no-pr      # cria e envia a branch, mas não abre o PR
#
# Precisa de: node, git (com acesso de escrita ao repositório) e, para abrir o PR sozinho, o GitHub CLI (`gh`).
# Opcional: FOOTBALL_DATA_TOKEN, usado como plano B (só Série A) se o Transfermarkt falhar.
set -euo pipefail
cd "$(dirname "$0")/.."

YES=0; NO_PR=0
for a in "$@"; do
  case "$a" in --yes) YES=1 ;; --no-pr) NO_PR=1 ;; *) echo "opção desconhecida: $a" >&2; exit 2 ;; esac
done
BASE="${ROSTER_BASE:-main}"
say() { printf '\n==> %s\n' "$*"; }
die() { printf '\nERRO: %s\n' "$*" >&2; exit 1; }

command -v node >/dev/null 2>&1 || die "node não encontrado"
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || die "isto não é um repositório git"
[ -z "$(git status --porcelain)" ] || die "há alterações não commitadas. Faça commit ou 'git stash' antes (veja 'git status')."

START="$(git rev-parse --abbrev-ref HEAD)"
TMP="$(mktemp -d)"
cleanup() {
  code=$?
  # desfaz mudanças não commitadas no roster e volta para a branch onde você estava
  git checkout -q -- js/roster.js 2>/dev/null || true
  [ "$(git rev-parse --abbrev-ref HEAD)" = "$START" ] || git checkout -q "$START" 2>/dev/null || true
  rm -rf "$TMP"
  exit $code
}
trap cleanup EXIT

say "Atualizando '$BASE' a partir do GitHub"
git fetch -q origin
git checkout -q "$BASE"
git pull -q --ff-only origin "$BASE"

cp js/roster.js "$TMP/old.js"

say "Buscando elencos no Transfermarkt (cerca de 10 minutos; 4 s entre as requisições)"
SOURCE="Transfermarkt"
FETCH_CMD="${ROSTER_FETCH_CMD:-node scripts/update-roster.js --source transfermarkt}"
if ! bash -c "$FETCH_CMD"; then
  if [ -n "${FOOTBALL_DATA_TOKEN:-}" ]; then
    say "Transfermarkt falhou; usando a football-data.org (só Série A)"
    node scripts/update-roster.js
    SOURCE="football-data.org (só Série A)"
  else
    die "o Transfermarkt falhou e FOOTBALL_DATA_TOKEN não está definido (plano B só para a Série A)."
  fi
fi

if git diff --quiet -- js/roster.js; then
  say "Nenhuma mudança nos elencos. Nada a fazer."
  exit 0
fi

say "Rodando os testes"
npm test --silent || die "os testes falharam com o novo js/roster.js; nada foi enviado (arquivo restaurado)."

say "O que mudou (fonte: $SOURCE)"
node scripts/roster-diff.js "$TMP/old.js" js/roster.js

if [ "$YES" -ne 1 ]; then
  printf '\nCriar a branch e enviar para o GitHub? [s/N] '
  read -r ans
  case "$ans" in s|S|y|Y|sim) ;; *) echo "Cancelado; arquivo restaurado."; exit 0 ;; esac
fi

BRANCH="roster-update-$(date +%Y%m%d-%H%M)"
say "Criando a branch $BRANCH"
git checkout -q -b "$BRANCH"
git add js/roster.js
git commit -q -m "Atualiza elencos reais ($SOURCE)"
git push -q -u origin "$BRANCH"

REPO="$(git remote get-url origin | sed -E 's#^(git@github\.com:|https://github\.com/)##; s#\.git$##')"
if [ "$NO_PR" -eq 0 ] && command -v gh >/dev/null 2>&1; then
  say "Abrindo o PR"
  gh pr create --base "$BASE" --head "$BRANCH" --title "Atualiza elencos reais" \
    --body "Atualização manual de js/roster.js. Fonte: $SOURCE. Testes (npm test) passaram localmente."
else
  say "Branch enviada. Abra o PR em:"
  echo "https://github.com/$REPO/compare/$BASE...$BRANCH?expand=1"
fi
