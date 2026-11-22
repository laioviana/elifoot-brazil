# Versionamento

O jogo segue [SemVer](https://semver.org/) `MAJOR.MINOR.PATCH`, começando em `1.0.0`.

- **MAJOR**: quebra saves antigos ou redesenha o jogo.
- **MINOR**: funcionalidade nova.
- **PATCH**: correção de bug ou ajuste de balanceamento.

A versão fica em `js/version.js` (fonte única); `package.json` é mantido igual pelo script de bump
(um teste confere). A tela de título mostra `vX.Y.Z` no rodapé. O formato dos saves não guarda a versão.

## Regra para PRs

Todo PR adiciona uma linha em `## Unreleased` no `CHANGELOG.md`. **Nunca** altere a versão à mão.

## Patch (automático)

A cada push na `main`, o workflow `release.yml`:

1. roda os testes;
2. sobe o patch e transforma `## Unreleased` em `## X.Y.Z — AAAA-MM-DD` (se o PR não deixou entrada,
   usa o título do commit do merge);
3. faz commit `Release vX.Y.Z` como `github-actions[bot]` e cria a tag `vX.Y.Z`;
4. publica no GitHub Pages.

Commits `Release v…` não geram novo bump (mas são publicados).

## Minor / major (manual)

```
npm run bump -- minor    # ou major
git push --follow-tags origin main
```

O script atualiza `js/version.js`, `package.json` e `CHANGELOG.md`, faz o commit `Release vX.Y.0` e cria a tag
local. Ele recusa rodar com a árvore suja e **nunca** faz push; só imprime o comando acima.

## Workflow setup

O agente de desenvolvimento não pode editar `.github/`. Depois de mergear o PR, o dono faz à mão:

### 1. Criar `.github/workflows/release.yml`

```yaml
name: Release
# A cada push na main: sobe o patch, fecha o CHANGELOG, cria a tag e publica no GitHub Pages.
on:
  push:
    branches: [main]
permissions:
  contents: write
concurrency:
  group: release
  cancel-in-progress: false
jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { ref: main, fetch-depth: 0 }
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: npm test
      - name: Bump patch
        if: ${{ !startsWith(github.event.head_commit.message, 'Release v') }}
        env:
          MSG: ${{ github.event.head_commit.message }}
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          node scripts/bump-version.js patch --no-git --fallback "$(printf '%s' "$MSG" | head -n1)"
          V="$(node -p "require('./js/version.js')")"
          git add js/version.js package.json CHANGELOG.md
          git commit -m "Release v$V"
          git pull --rebase origin main   # tag só depois do rebase, para apontar para o commit final
          git tag -a "v$V" -m "v$V"
          git push origin HEAD:main --follow-tags
  deploy:
    needs: release
    runs-on: ubuntu-latest
    permissions: { pages: write, id-token: write }
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4
        with: { ref: main }
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with: { path: . }
      - id: deployment
        uses: actions/deploy-pages@v4
```

O push do bot usa `GITHUB_TOKEN`, então não dispara este workflow (nem o CI) de novo.

### 2. Editar `.github/workflows/ci.yml`

Apague o job `deploy` (agora ele vive no `release.yml`). Mantenha o job `test` e os gatilhos como estão.

### 3. Configurações do repositório

- Settings → Actions → General → Workflow permissions: *Read and write*.
- Se a `main` tem proteção de branch ou rulesets: permita que o GitHub Actions faça push, senão o job de release falha.
- Pages continua com a fonte *GitHub Actions*.
