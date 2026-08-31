#!/bin/sh
# Prova della guardia .githooks/pre-push (CRM-12, 31/8/2026).
#
# Si lancia a mano quando si tocca l'hook:   sh .githooks/prova-pre-push.sh
# Non tocca ne' la repo del progetto ne' GitHub: costruisce una repo finta
# usa-e-getta in una cartella temporanea, ci monta l'hook, e verifica che
# rifiuti cio' che deve rifiutare e lasci passare tutto il resto.
# Esce 0 se tutti i casi tornano, 1 al primo che sbaglia.

set -e
QUI=$(cd "$(dirname "$0")" && pwd)
HOOK="$QUI/pre-push"
[ -x "$HOOK" ] || { echo "manca $HOOK (o non e' eseguibile)"; exit 1; }

T=$(mktemp -d)
trap 'rm -rf "$T"' EXIT

git init -q --bare "$T/remoto.git"
git init -q -b main "$T/locale"
cd "$T/locale"
git config user.email prova@esempio.it
git config user.name Prova
# hooksPath diverso da .githooks: qui interessa solo il pre-push, non la mappa
mkdir -p .ganci && cp "$HOOK" .ganci/pre-push && chmod +x .ganci/pre-push
git config core.hooksPath .ganci
git remote add origin "$T/remoto.git"
echo uno > a.txt && git add -A && git commit -qm primo

falliti=0
# verifica <atteso: rifiuta|passa> <descrizione> -- <comando...>
verifica() {
  atteso=$1; shift
  desc=$1; shift
  shift  # scarta il '--'
  if "$@" >/dev/null 2>&1; then esito=passa; else esito=rifiuta; fi
  if [ "$esito" = "$atteso" ]; then
    echo "  ok   $desc (atteso: $atteso)"
  else
    echo "  NO   $desc — atteso $atteso, ottenuto $esito"
    falliti=$((falliti + 1))
  fi
}

echo "Prova della guardia pre-push:"
verifica rifiuta "push su main"                    -- git push origin main
git switch -qc lavoro-mio && echo due > b.txt && git add -A && git commit -qm secondo
verifica passa   "push di un ramo normale"         -- git push origin lavoro-mio
git tag v0.1
verifica passa   "push di un tag"                  -- git push origin v0.1
verifica rifiuta "push HEAD:main da altro ramo"    -- git push origin HEAD:main
verifica passa   "UNIONE_MAIN=1 sul push a main"   -- env UNIONE_MAIN=1 git push origin HEAD:main
git switch -qc main-vecchio
verifica passa   "ramo il cui nome contiene main"  -- git push origin main-vecchio
git switch -q main && echo tre > c.txt && git add -A && git commit -qm terzo
verifica rifiuta "push --all con main fra i ref"   -- git push --all origin
verifica rifiuta "cancellazione di main"           -- git push origin :main

if [ "$falliti" -eq 0 ]; then
  echo "Tutti i casi tornano."
  exit 0
fi
echo "$falliti caso/i sbagliato/i."
exit 1
