# CLAUDE.md — todo-rosamango

## Propósito

PWA de TODO list colaborativo (sem login) com Google Sheets como backend, identidade
visual Rosamango. Ver [README.md](README.md) para detalhes de uso e deploy.

## Stack

- **Frontend**: HTML/CSS/JS puro (`src/`), sem framework nem build step. PWA (manifest +
  service worker).
- **Backend**: Google Apps Script (`backend/Code.gs`, `backend/appsscript.json`), Node CLI
  `clasp` para deploy. Planilha Google como banco de dados (aba "Tarefas", criada/formatada
  automaticamente pelo próprio script no primeiro request).
- **Ícones**: Python 3.12 + Pillow via `uv` (`scripts/generate_icons.py`).
- **Deploy**: `scripts/deploy.ps1` (PowerShell) — orquestra `clasp` (backend) e `gh` CLI
  (frontend em GitHub Pages, servindo `docs/` espelhado de `src/`).

## Comandos

```powershell
uv run scripts/generate_icons.py     # regenera ícones do PWA
.\scripts\deploy.ps1                 # deploy completo (backend + frontend)
.\scripts\deploy.ps1 -Help           # todas as opções
```

Pré-requisitos manuais (OAuth via navegador, uma vez): `clasp login`, `gh auth login`.

## Arquitetura

```
src/          → frontend estático (PWA), servido via GitHub Pages a partir de docs/ (gerado)
backend/      → Google Apps Script (doGet/doPost = API JSON sobre a planilha)
scripts/      → generate_icons.py, deploy.ps1
docs/         → gerado por deploy.ps1 (espelho de src/); não editar à mão
```

Comunicação frontend→backend: `fetch` direto para a URL `/exec` do Web App do Apps Script
(gravada em `src/config.js` pelo deploy). Sem servidor intermediário, sem autenticação de
usuário — o Web App roda como o dono do script (`executeAs: USER_DEPLOYING`) e aceita
qualquer chamador (`access: ANYONE_ANONYMOUS`).

## Decisões tomadas

- Planilha **nova e dedicada** para este TODO app — não reaproveita a planilha de
  "Planejamento Fim de Ano" que já está em uso em produção.
- Backend como Web App público (em vez de OAuth por usuário) para manter "qualquer pessoa
  edita sem login", o mesmo motivo que levou a trocar o Claude Artifact anterior por
  Google Sheets no projeto de Planejamento.
- `docs/` (não `gh-pages` branch nem GitHub Actions) como fonte do GitHub Pages — mais
  simples de scriptar com `gh api`, sem precisar de workflow YAML.

## Gotchas conhecidos

- CORS do Apps Script: POST do frontend precisa ir com `Content-Type: text/plain` (corpo
  ainda é JSON) para não disparar preflight `OPTIONS`, que o Apps Script não implementa.
- GitHub Pages público em **repositório privado** exige GitHub Pro/Team/Enterprise — no
  plano Free isso falha silenciosamente na chamada da API do Pages.
- `clasp create` e `gh auth login` exigem OAuth interativo no navegador — não rodam numa
  sessão não-interativa; sempre pré-requisito manual antes do primeiro `deploy.ps1`.
- `backend/.clasp.json` guarda `scriptId`/`parentId` gerados pelo `clasp create` — versionar
  normalmente, não é segredo, mas é específico de cada planilha/deploy.
