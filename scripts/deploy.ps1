<#
.SYNOPSIS
    Publica o TODO Rosamango: backend (Google Apps Script Web App) e frontend (GitHub Pages).

.DESCRIPTION
    - Backend: `clasp push` + `clasp deploy` da pasta backend/, injeta a URL do Web App em
      src/config.js. Na primeira execução, `clasp create` cria a Google Planilha + o projeto
      Apps Script vinculados (exige `clasp login` feito antes, manualmente).
    - Frontend: espelha src/ em docs/, cria (se preciso) o repositório GitHub e publica via
      GitHub Pages usando o `gh` CLI (exige `gh auth login` feito antes, manualmente).

.PARAMETER SkipBackend
    Pula o deploy do Apps Script (só publica o frontend).

.PARAMETER SkipFrontend
    Pula a publicação do GitHub Pages (só faz deploy do backend).

.PARAMETER RepoOwner
    Dono do repositório GitHub (usuário ou organização). Padrão: valor de DEPLOY_GITHUB_OWNER no .env.

.PARAMETER RepoName
    Nome do repositório GitHub. Padrão: valor de DEPLOY_GITHUB_REPO no .env.

.PARAMETER SheetTitle
    Título da Google Planilha criada na primeira execução. Padrão: DEPLOY_SHEET_TITLE no .env.

.PARAMETER Private
    Cria o repositório GitHub como privado (o GitHub Pages ainda fica público, se o plano permitir).

.EXAMPLE
    .\scripts\deploy.ps1
    .\scripts\deploy.ps1 -SkipFrontend
    .\scripts\deploy.ps1 -RepoOwner grupofizz -RepoName todo-rosamango -Private
#>
[CmdletBinding()]
param(
    [switch]$SkipBackend,
    [switch]$SkipFrontend,
    [string]$RepoOwner,
    [string]$RepoName,
    [string]$SheetTitle,
    [switch]$Private,
    [switch]$Help
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot

if ($Help) {
    Get-Help $PSCommandPath -Full
    exit 0
}

function Read-DotEnv {
    param([string]$Path)
    $values = @{}
    if (Test-Path $Path) {
        Get-Content $Path | ForEach-Object {
            if ($_ -match '^\s*#') { return }
            if ($_ -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$') {
                $values[$matches[1]] = $matches[2]
            }
        }
    }
    return $values
}

$envValues = Read-DotEnv (Join-Path $root '.env')
if (-not $RepoOwner) { $RepoOwner = $envValues['DEPLOY_GITHUB_OWNER'] }
if (-not $RepoName) { $RepoName = $envValues['DEPLOY_GITHUB_REPO'] }
if (-not $SheetTitle) { $SheetTitle = $envValues['DEPLOY_SHEET_TITLE'] }
if (-not $SheetTitle) { $SheetTitle = 'Grupo Fizz — TODO List' }

Write-Host "== TODO Rosamango — deploy ==" -ForegroundColor Cyan

# ---------------------------------------------------------------------------
# Backend: Google Apps Script (clasp)
# ---------------------------------------------------------------------------
if (-not $SkipBackend) {
    Write-Host "`n-- Backend (Apps Script) --" -ForegroundColor Yellow
    $backendDir = Join-Path $root 'backend'

    clasp show-authorized-user *> $null
    if (-not $?) {
        Write-Warning "clasp não está logado. Rode 'clasp login' manualmente (abre o navegador) e execute este script de novo. Pulando o backend."
    } else {
        $claspConfig = Join-Path $backendDir '.clasp.json'
        if (-not (Test-Path $claspConfig)) {
            Write-Host "Criando planilha + projeto Apps Script: '$SheetTitle'..."
            Push-Location $backendDir
            clasp create-script --type sheets --title $SheetTitle --rootDir .
            Pop-Location
        }

        Write-Host "Enviando código (clasp push)..."
        clasp -P $backendDir push --force

        Write-Host "Publicando deployment (clasp deploy)..."
        clasp -P $backendDir create-deployment --description ("deploy " + (Get-Date -Format 'yyyy-MM-dd HH:mm'))

        $deployments = clasp -P $backendDir list-deployments
        $deploymentId = ($deployments -split "`n" | Select-String -Pattern '- (\S+)\s' | Select-Object -Last 1).Matches.Groups[1].Value

        if ($deploymentId) {
            $webAppUrl = "https://script.google.com/macros/s/$deploymentId/exec"
            $configPath = Join-Path $root 'src\config.js'
            (Get-Content $configPath -Raw) -replace "WEBAPP_URL:\s*'[^']*'", "WEBAPP_URL: '$webAppUrl'" | Set-Content $configPath -NoNewline
            Write-Host "Web App URL: $webAppUrl" -ForegroundColor Green
            Write-Host "src/config.js atualizado." -ForegroundColor Green

            $claspJson = Get-Content $claspConfig -Raw | ConvertFrom-Json
            if ($claspJson.parentId) {
                Write-Host ("Planilha: https://docs.google.com/spreadsheets/d/" + $claspJson.parentId[0] + "/edit") -ForegroundColor Green
            }
        } else {
            Write-Warning "Não consegui extrair o deployment ID de 'clasp deployments'. Confira manualmente com 'clasp deployments --rootDir backend'."
        }
    }
}

# ---------------------------------------------------------------------------
# Frontend: GitHub Pages (gh)
# ---------------------------------------------------------------------------
if (-not $SkipFrontend) {
    Write-Host "`n-- Frontend (GitHub Pages) --" -ForegroundColor Yellow

    gh auth status *> $null
    if (-not $?) {
        Write-Warning "gh não está logado. Rode 'gh auth login' manualmente e execute este script de novo. Pulando o frontend."
    } elseif (-not $RepoOwner -or -not $RepoName) {
        Write-Warning "RepoOwner/RepoName não definidos (parâmetro ou .env). Pulando o frontend."
    } else {
        $fullName = "$RepoOwner/$RepoName"
        $docsDir = Join-Path $root 'docs'
        $srcDir = Join-Path $root 'src'

        Write-Host "Espelhando src/ em docs/..."
        if (Test-Path $docsDir) { Remove-Item $docsDir -Recurse -Force }
        Copy-Item $srcDir $docsDir -Recurse

        Push-Location $root
        git add docs src
        $hasChanges = -not (git diff --cached --quiet; $?)
        if ($hasChanges) {
            git commit -m "chore: publica build do frontend (docs/)" | Out-Null
        }

        gh repo view $fullName *> $null
        $repoExists = $?
        if (-not $repoExists) {
            Write-Host "Criando repositório $fullName..."
            $visibility = if ($Private) { '--private' } else { '--public' }
            gh repo create $fullName $visibility --source=. --remote=origin --push
        } else {
            if (-not (git remote | Select-String -Quiet '^origin$')) {
                git remote add origin "https://github.com/$fullName.git"
            }
            git push -u origin HEAD:main
        }

        Write-Host "Habilitando GitHub Pages (branch main, pasta /docs)..."
        gh api "repos/$fullName/pages" -X POST -f "source[branch]=main" -f "source[path]=/docs" *> $null
        if (-not $?) {
            gh api "repos/$fullName/pages" -X PUT -f "source[branch]=main" -f "source[path]=/docs" *> $null
        }

        Pop-Location
        Write-Host "Página: https://$($RepoOwner.ToLower()).github.io/$RepoName/" -ForegroundColor Green
        if ($Private) {
            Write-Host "Nota: repositório privado. GitHub Pages público em repo privado exige GitHub Pro/Team/Enterprise — se a conta for Free, ative manualmente ou deixe o repo público." -ForegroundColor DarkYellow
        }
    }
}

Write-Host "`nConcluído." -ForegroundColor Cyan
