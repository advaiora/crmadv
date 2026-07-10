<#
  install-pgvector-win.ps1 — Installa l'estensione pgvector su PostgreSQL 17 (Windows, build EDB).
  V4 — Modulo Fonti: pgvector serve per la vettorizzazione/RAG (embeddings + ricerca semantica).

  PERCHE' SERVE ESEGUIRLO A MANO (come amministratore):
  - pgvector non e' incluso in PostgreSQL: va aggiunto ai file dell'installazione (cartella "lib" e
    "share\extension" dentro Program Files), operazione che richiede permessi di amministratore.
  - Su Windows pgvector si compila con gli strumenti C++ di Visual Studio (MSVC). Lo script installa
    i Build Tools se mancano, compila pgvector e lo installa, poi abilita l'estensione sul database.

  COME USARLO:
    1) Tasto destro su PowerShell -> "Esegui come amministratore".
    2) Consenti l'esecuzione script per questa sessione:
         Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
    3) Lancia:
         cd C:\Users\jacop\Documents\crmadv
         .\scripts\install-pgvector-win.ps1
    (Parametri opzionali: -PgRoot "C:\Program Files\PostgreSQL\17"  -Database "crm_advaiora"  -PgVectorVersion "v0.8.0")

  E' idempotente: se pgvector risulta gia' installato, esce senza fare nulla.
#>

param(
  [string]$PgRoot = "C:\Program Files\PostgreSQL\17",
  [string]$Database = "crm_advaiora",
  [string]$DbUser = "postgres",
  [string]$PgVectorVersion = "v0.8.0"
)

$ErrorActionPreference = "Stop"

function Write-Step($msg) { Write-Host "==> $msg" -ForegroundColor Cyan }
function Write-Ok($msg)   { Write-Host "    $msg" -ForegroundColor Green }
function Write-Warn2($msg){ Write-Host "    $msg" -ForegroundColor Yellow }

# --- 0) Verifica privilegi di amministratore ---
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
  Write-Host "Questo script va eseguito come AMMINISTRATORE (serve per scrivere in Program Files e riavviare il servizio)." -ForegroundColor Red
  Write-Host "Riapri PowerShell con 'Esegui come amministratore' e rilancialo." -ForegroundColor Red
  exit 1
}

# --- 1) Verifica installazione PostgreSQL ---
Write-Step "Controllo PostgreSQL in $PgRoot"
$pgConfig = Join-Path $PgRoot "bin\pg_config.exe"
$psql     = Join-Path $PgRoot "bin\psql.exe"
if (-not (Test-Path $pgConfig)) { throw "pg_config non trovato in $pgConfig. Passa il percorso giusto con -PgRoot." }
Write-Ok "Trovato: $pgConfig"

# --- 2) pgvector gia' presente? (idempotenza) ---
Write-Step "Controllo se pgvector e' gia' disponibile nel database '$Database'"
$env:PGCLIENTENCODING = "UTF8"
$already = & $psql -U $DbUser -d $Database -tAc "SELECT installed_version FROM pg_available_extensions WHERE name='vector';" 2>$null
if ($LASTEXITCODE -eq 0 -and $already -and $already.Trim() -ne "") {
  Write-Ok "pgvector risulta gia' installato (versione: $($already.Trim())). Niente da fare."
  exit 0
}

# --- 3) Strumenti C++ (MSVC). Se manca cl.exe, installa i VS Build Tools con il workload C++ ---
Write-Step "Controllo strumenti di compilazione C++ (MSVC)"
$vswhere = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
$vcInstall = $null
if (Test-Path $vswhere) {
  $vcInstall = & $vswhere -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath 2>$null
}
if (-not $vcInstall) {
  Write-Warn2 "Strumenti C++ non trovati. Installo i Visual Studio Build Tools (workload C++). Puo' richiedere diversi minuti e alcuni GB."
  winget install --id Microsoft.VisualStudio.2022.BuildTools -e --accept-source-agreements --accept-package-agreements `
    --override "--quiet --wait --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
  if (Test-Path $vswhere) {
    $vcInstall = & $vswhere -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath 2>$null
  }
  if (-not $vcInstall) { throw "Installazione Build Tools non riuscita o non rilevata. Installa manualmente i 'Desktop development with C++' e rilancia." }
}
$vcvars = Join-Path $vcInstall "VC\Auxiliary\Build\vcvars64.bat"
if (-not (Test-Path $vcvars)) { throw "vcvars64.bat non trovato in $vcvars" }
Write-Ok "MSVC: $vcInstall"

# --- 4) git ---
if (-not (Get-Command git -ErrorAction SilentlyContinue)) { throw "git non trovato nel PATH. Installalo (winget install Git.Git) e rilancia." }

# --- 5) Clona pgvector ---
$work = Join-Path $env:TEMP "pgvector-build"
if (Test-Path $work) { Remove-Item -Recurse -Force $work }
Write-Step "Clono pgvector $PgVectorVersion"
git clone --branch $PgVectorVersion --depth 1 https://github.com/pgvector/pgvector.git $work
if ($LASTEXITCODE -ne 0) { throw "git clone di pgvector non riuscito." }

# --- 6) Compila e installa (nmake) dentro l'ambiente vcvars, con PGROOT che punta a Postgres ---
Write-Step "Compilo e installo pgvector (nmake /F Makefile.win)"
$build = @"
@echo on
call "$vcvars"
set "PGROOT=$PgRoot"
cd /d "$work"
nmake /F Makefile.win
if errorlevel 1 exit /b 1
nmake /F Makefile.win install
if errorlevel 1 exit /b 1
"@
$bat = Join-Path $env:TEMP "pgvector-build.bat"
Set-Content -Path $bat -Value $build -Encoding ascii
& cmd.exe /c "`"$bat`""
if ($LASTEXITCODE -ne 0) { throw "Compilazione/installazione di pgvector fallita (codice $LASTEXITCODE)." }
Write-Ok "File dell'estensione copiati in $PgRoot (lib\ e share\extension\)."

# --- 7) Riavvia il servizio PostgreSQL cosi' carica la nuova libreria ---
Write-Step "Riavvio il servizio PostgreSQL"
$svc = Get-Service | Where-Object { $_.Name -like "postgresql*17*" } | Select-Object -First 1
if ($svc) { Restart-Service -Name $svc.Name -Force; Write-Ok "Servizio '$($svc.Name)' riavviato." }
else { Write-Warn2 "Servizio Postgres 17 non individuato: riavvialo a mano se necessario." }

# --- 8) Abilita l'estensione sul database e verifica ---
Write-Step "Abilito l'estensione 'vector' su '$Database'"
& $psql -U $DbUser -d $Database -c "CREATE EXTENSION IF NOT EXISTS vector;"
if ($LASTEXITCODE -ne 0) { throw "CREATE EXTENSION vector non riuscito." }
$ver = & $psql -U $DbUser -d $Database -tAc "SELECT extversion FROM pg_extension WHERE extname='vector';"
Write-Host ""
Write-Host "OK — pgvector installato e abilitato su '$Database' (versione $($ver.Trim()))." -ForegroundColor Green
Write-Host "Ora la parte di vettorizzazione/RAG della V4 puo' essere costruita." -ForegroundColor Green
