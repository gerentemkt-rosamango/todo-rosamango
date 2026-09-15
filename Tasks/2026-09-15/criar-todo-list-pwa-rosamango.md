# Criar TODO list PWA com Google Sheets como backend

**Status:** em andamento
**Data:** 2026-09-15

## Objetivo

Um PWA instalável (funciona offline para leitura, mobile-friendly) onde qualquer pessoa
com o link edita uma lista de tarefas compartilhada, sem precisar de conta/login — usando
uma Google Planilha nova e dedicada como banco de dados, com a identidade visual da
Rosamango (preto/branco/vermelho, cabeçalho preto/texto branco, status com cores
verde/amarelo/cinza). Inclui script de deploy que publica o backend (Apps Script) e o
frontend (GitHub Pages) com um comando.

## Contexto

Baseado no relato do usuário sobre o "Planejamento Fim de Ano Rosamango": a solução
anterior (Claude Artifact com capability `db`) foi descontinuada porque exigia login
Claude na organização Grupo Fizz para editar, e nem todo colega tem. A troca foi para
Google Sheets puro, que qualquer pessoa com conta Google edita. Este TODO app aplica o
mesmo princípio de acesso (sem barreira de login) só que com uma interface PWA dedicada
por cima da planilha, em vez de editar a grade do Sheets diretamente.

Decisões confirmadas com o usuário:
- Planilha **nova e dedicada** (não mexe na planilha de Planejamento em produção).
- Backend como **Google Apps Script Web App público** (executa como o dono, acesso
  "qualquer pessoa") — evita OAuth por usuário.
- Frontend publicado no **GitHub Pages via `gh` CLI**.

Pré-requisitos que só o usuário pode fazer (OAuth interativo, não dá pra automatizar
numa sessão não-interativa):
- `clasp login` (login Google para deploy do Apps Script)
- `gh auth login` (login GitHub — checado, sessão atual não está autenticada)

## Plano

1. Estrutura do projeto em `C:\Dev\todo-rosamango` (CLAUDE.md, .gitignore, .env.example).
2. Backend Apps Script (`backend/Code.gs`, `backend/appsscript.json`):
   - Sheet-bound, auto-inicializa cabeçalho/formatação na primeira chamada.
   - `doGet` lista tarefas (JSON), `doPost` cria/atualiza/remove.
   - Manifest configura Web App: `executeAs: USER_DEPLOYING`, `access: ANYONE_ANONYMOUS`.
3. Frontend PWA (`src/`): `index.html`, `styles.css` (paleta Rosamango), `app.js`,
   `manifest.webmanifest`, `service-worker.js` (cache do app shell), ícones gerados.
4. Script `scripts/generate_icons.py` (Python + uv + Pillow) gera os ícones do PWA.
5. Script `scripts/deploy.ps1`: `clasp push` + `clasp deploy` do backend, injeta a URL do
   Web App no `src/config.js`, cria/atualiza repo GitHub e publica `src/` no GitHub Pages
   via `gh`.
6. `git init`, primeiro commit.

## Critérios de aceite

- [ ] `backend/Code.gs` roda `doGet`/`doPost` contra uma planilha nova e devolve/grava JSON.
- [ ] `src/index.html` abre localmente, lista/cria/edita/exclui tarefas contra o backend.
- [ ] PWA instalável (manifest + service worker válidos, ícones presentes).
- [ ] `scripts/deploy.ps1 -h` documenta uso; roda até onde não depende de login interativo.
- [ ] Repositório git local inicializado com commit inicial.
- [ ] Documentado no README o passo manual (`clasp login`, `gh auth login`) que o usuário
      precisa rodar antes do primeiro deploy.

## Riscos / decisões

- **CORS em Apps Script Web App:** POST do frontend usa `Content-Type: text/plain` no
  fetch (corpo ainda é JSON) para evitar preflight OPTIONS, que Apps Script não trata bem.
- **Sem fila offline de escrita:** offline mostra o último estado em cache
  (localStorage); criar/editar tarefa exige conexão. Decisão: manter simples, escopo do
  pedido é "PWA de forma simples".
- **Deploy do Apps Script exige login Google interativo (`clasp login`)** — não pode ser
  automatizado nesta sessão; documentado como pré-requisito manual.
- **`gh` não está autenticado nesta máquina** — deploy do frontend também depende de
  `gh auth login` manual antes de rodar `scripts/deploy.ps1`.
