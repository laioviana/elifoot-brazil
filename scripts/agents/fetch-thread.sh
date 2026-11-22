#!/usr/bin/env bash
# fetch-thread.sh ISSUE ARQUIVO — grava a issue e os comentários (só do dono, colaboradores e dos agentes) em Markdown.
set -euo pipefail
gh issue view "$1" --json number,title,body,author,comments --jq '
  "# #\(.number): \(.title)\n\n_Autor: \(.author.login)_\n\n\(.body)\n\n## Comentários\n" ,
  (.comments[]
    | select(.authorAssociation == "OWNER" or .authorAssociation == "MEMBER" or .authorAssociation == "COLLABORATOR"
             or .author.login == "github-actions")
    | "\n### \(.author.login) (\(.createdAt))\n\n\(.body)\n")
' > "$2"
