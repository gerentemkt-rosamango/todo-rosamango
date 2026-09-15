# TODO Rosamango

PWA de lista de tarefas colaborativa, com **Google Sheets como backend** (via Google Apps
Script) e identidade visual Rosamango (preto/branco/vermelho, mesmo padrão do
"Planejamento Fim de Ano"). Qualquer pessoa com o link do site edita as tarefas — sem
precisar de conta Google nem login de nenhum tipo.

## Como funciona

- **Frontend** (`src/`): HTML/CSS/JS puro, sem build. Instalável como app (`manifest.webmanifest`
  + `service-worker.js`), funciona offline para leitura (mostra a última lista sincronizada).
- **Backend** (`backend/Code.gs`): Google Apps Script vinculado a uma Google Planilha nova,
  publicado como Web App público (`appsscript.json`: `executeAs: USER_DEPLOYING`,
  `access: ANYONE_ANONYMOUS`). Expõe `doGet`/`doPost` como uma API JSON simples
  (`list` / `create` / `update` / `delete`). A aba `Tarefas` é criada e formatada (cabeçalho
  preto, dropdown de status, cores por categoria) automaticamente na primeira chamada.
- **Deploy** (`scripts/deploy.ps1`): publica os dois lados com um comando.

## Pré-requisitos (fazer uma vez, manualmente)

Login é OAuth via navegador — não dá para automatizar numa sessão não-interativa. Rode no
seu terminal, uma vez:

```bash
clasp login
```

```bash
gh auth login
```

## Deploy

```powershell
.\scripts\deploy.ps1
```

Isso:
1. Na primeira vez, cria a Google Planilha + projeto Apps Script (`clasp create`) e escreve
   `backend/.clasp.json` (contém o `scriptId`, não é segredo — pode versionar).
2. Envia o código (`clasp push`) e publica um deployment (`clasp deploy`), gravando a URL do
   Web App em `src/config.js`.
3. Espelha `src/` em `docs/`, cria o repositório GitHub (se ainda não existir) e habilita o
   GitHub Pages apontando para `main` / `/docs`.

Parâmetros úteis (veja todos com `.\scripts\deploy.ps1 -Help`):

```powershell
.\scripts\deploy.ps1 -RepoOwner grupofizz -RepoName todo-rosamango -Private
.\scripts\deploy.ps1 -SkipFrontend   # só backend
.\scripts\deploy.ps1 -SkipBackend    # só frontend
```

> Repositório **privado** + GitHub Pages **público**: no GitHub Free isso não é permitido
> (Pages em repo privado exige plano Pro/Team/Enterprise). Se a conta for Free, use repo
> público ou ative o Pages manualmente depois de fazer upgrade.

## Rodar localmente sem publicar nada

Abra `src/index.html` direto no navegador (ou sirva a pasta com qualquer servidor estático).
Antes disso, preencha `src/config.js` com a URL de uma implantação de teste do Apps Script
(Extensões → Apps Script → Implantar → Implantação de teste, na planilha criada pelo clasp).

## Estrutura da planilha (aba "Tarefas")

| Coluna | Conteúdo |
| --- | --- |
| ID | UUID interno (coluna oculta) |
| Texto | Texto da tarefa |
| Categoria | Geral / Natal / Black Friday / Ano Novo (cores da paleta Rosamango) |
| Status | Pendente / Em andamento / Concluído (formatação condicional amarelo/verde) |
| CriadoEm / AtualizadoEm | Timestamps |

## Regenerar os ícones do PWA

```bash
uv run scripts/generate_icons.py
```

## Gotchas

- CORS: o POST do frontend usa `Content-Type: text/plain` (corpo continua sendo JSON) para
  evitar o preflight `OPTIONS`, que o Apps Script Web App não trata.
- Sem fila de escrita offline: criar/editar/excluir tarefa exige conexão; offline só mostra
  a última lista em cache (`localStorage`).
- `backend/.clasp.json` é gerado pelo `clasp create` e contém o `scriptId`/`parentId` — não é
  segredo, mas é específico deste deploy; se recriar do zero, ele muda.
