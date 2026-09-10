#!/usr/bin/env bash
#
# Backup del database di produzione del CRM Advaiora.
#
# Cosa fa, una volta a notte:
#   1. controlli preliminari (versione di pg_dump, cartelle scrivibili, config sana)
#   2. dump con "pg_dump -Fc -Z6" su un file temporaneo
#   3. VERIFICA il file appena scritto (indice leggibile + dimensione plausibile)
#   4. lo mette fra i giornalieri e ne aggancia una copia fra settimanali/mensili
#   5. ruota (7 giornalieri + 4 settimanali + 3 mensili, valori configurabili)
#   6. copia fuori sede con rclone
#   7. manda il segnale al "guardiano del silenzio"
#
# Se qualcosa fallisce: segnale di guasto al guardiano del silenzio + apertura di un
# compito su Paperclip. Quando va bene NON apre niente: la sveglia arriva dal guasto.
#
# Il perché di ogni scelta sta in archivio-documenti/backup-database-produzione.md.
# Come si installa: scripts/backup/README.md (compito CRMA-70).
#
# ⚠️ Questo file non contiene e non deve mai contenere credenziali: sta in un
#    repository pubblico. Tutto ciò che è segreto vive nel file di configurazione
#    (chmod 600) e nel ~/.pgpass dell'utente che esegue il backup.
#
# Uso:
#   backup-crmadv.sh              esegue il backup
#   backup-crmadv.sh --verifica   esegue solo i controlli preliminari, non scrive backup
#

# -E serve perche' la trappola sugli errori valga anche dentro le funzioni.
set -Eeuo pipefail
umask 077

CONFIG="${CRMADV_BACKUP_CONFIG:-/etc/crmadv-backup.env}"
SOLO_VERIFICA=0
[ "${1:-}" = "--verifica" ] && SOLO_VERIFICA=1

# --------------------------------------------------------------------------------------
# Registro
# --------------------------------------------------------------------------------------

# Non deve mai fallire: se il registro non e' scrivibile lo diciamo su stderr (che il cron
# manda per email) e si prosegue. Una funzione di registro che fallisce farebbe scattare la
# trappola degli errori, che a sua volta chiama il registro: giro senza fine.
registra() {
  local riga
  riga="$(date '+%Y-%m-%d %H:%M:%S%z')  $*"
  printf '%s\n' "$riga" >>"${LOG_FILE:-/dev/null}" 2>/dev/null ||
    printf '%s\n' "$riga" >&2
  [ -t 1 ] && printf '%s\n' "$*" || true
}

# --------------------------------------------------------------------------------------
# Configurazione
# --------------------------------------------------------------------------------------

if [ ! -r "$CONFIG" ]; then
  echo "FERMO: manca il file di configurazione $CONFIG (vedi crmadv-backup.env.example)" >&2
  exit 78 # EX_CONFIG
fi
# shellcheck disable=SC1090
. "$CONFIG"

: "${DEST_DIR:=/var/backups/crmadv}"
: "${LOG_FILE:=/var/log/crmadv-backup.log}"
: "${STATO_DIR:=/var/lib/crmadv-backup}"
: "${GIORNALIERI_DA_TENERE:=7}"
: "${SETTIMANALI_DA_TENERE:=4}"
: "${MENSILI_DA_TENERE:=3}"
: "${DIMENSIONE_MINIMA_BYTE:=1048576}"   # 1 MB: sotto è un dump vuoto travestito da riuscito
: "${CALO_MASSIMO_PERCENTUALE:=50}"      # un dump che dimezza rispetto a ieri è sospetto
: "${PGSSLMODE:=require}"                # Supabase pretende TLS
: "${PG_DUMP_OPZIONI_EXTRA:=}"
: "${RCLONE_REMOTE:=}"
: "${RCLONE_CONFIG:=}"
: "${HEALTHCHECK_URL:=}"
: "${PAPERCLIP_API_URL:=}"
: "${PAPERCLIP_API_KEY:=}"
: "${PAPERCLIP_COMPANY_ID:=}"
: "${PAPERCLIP_ASSIGNEE_AGENT_ID:=}"
: "${ORE_FRA_DUE_ALLARMI:=20}"           # un guasto che dura una settimana non apre 7 compiti

export PGSSLMODE
export PGCONNECT_TIMEOUT="${PGCONNECT_TIMEOUT:-30}"

OGGI="$(date +%F)"
NOME_FILE="crmadv-${OGGI}.dump"

# --------------------------------------------------------------------------------------
# Sorveglianza: si attiva SOLO quando qualcosa va storto
# --------------------------------------------------------------------------------------

# curl con la chiave passata da standard input, non sulla riga di comando:
# sulla riga di comando chiunque sulla macchina la leggerebbe con un "ps".
curl_con_chiave() {
  local chiave="$1"; shift
  printf 'header = "Authorization: Bearer %s"\n' "$chiave" | curl --config - "$@"
}

segnale_silenzio() {
  # $1 = "" (riuscito) oppure "/fail"
  [ -n "$HEALTHCHECK_URL" ] || return 0
  curl -fsS -m 10 --retry 3 -o /dev/null "${HEALTHCHECK_URL}${1:-}" ||
    registra "AVVISO: il guardiano del silenzio non ha ricevuto il segnale"
}

apri_compito_paperclip() {
  local motivo="$1"
  [ -n "$PAPERCLIP_API_URL" ] && [ -n "$PAPERCLIP_API_KEY" ] && [ -n "$PAPERCLIP_COMPANY_ID" ] || {
    registra "AVVISO: Paperclip non configurato, nessun compito aperto"
    return 0
  }

  # Anti-ripetizione: un guasto che dura giorni deve aprire UN compito, non uno a notte.
  local marcatore="$STATO_DIR/ultimo-allarme"
  if [ -f "$marcatore" ]; then
    local minuti_limite=$((ORE_FRA_DUE_ALLARMI * 60))
    if [ -z "$(find "$marcatore" -mmin "+${minuti_limite}" 2>/dev/null)" ]; then
      registra "Allarme già aperto meno di ${ORE_FRA_DUE_ALLARMI}h fa: non ne apro un altro"
      return 0
    fi
  fi

  local base corpo payload
  base="${PAPERCLIP_API_URL%/}"; base="${base%/api}"
  corpo="Il backup notturno del database di produzione e' fallito.

- Macchina: $(hostname)
- Quando: $(date '+%Y-%m-%d %H:%M:%S%z')
- Motivo: ${motivo}
- Ultime righe del registro (${LOG_FILE}):

\`\`\`
$(tail -n 25 "$LOG_FILE" 2>/dev/null || echo '(registro non leggibile)')
\`\`\`

Il database di produzione non ha altre reti di sicurezza: il piano Supabase e' gratuito e
non fa backup. Finche' questo non riparte, non esiste nessuna copia recente.
Procedura e contesto: archivio-documenti/backup-database-produzione.md (CRMA-70)."

  payload="$(
    CORPO="$corpo" \
    TITOLO="Backup di produzione fallito il ${OGGI}" \
    ASSEGNATARIO="$PAPERCLIP_ASSIGNEE_AGENT_ID" \
    node -e 'const o={title:process.env.TITOLO,description:process.env.CORPO,status:"todo",priority:"critical"};if(process.env.ASSEGNATARIO)o.assigneeAgentId=process.env.ASSEGNATARIO;process.stdout.write(JSON.stringify(o))' 2>/dev/null
  )" || payload=""

  if [ -z "$payload" ]; then
    registra "AVVISO: non riesco a costruire il messaggio per Paperclip (manca node?)"
    return 0
  fi

  if curl_con_chiave "$PAPERCLIP_API_KEY" -fsS -m 30 -o /dev/null \
       -X POST -H 'Content-Type: application/json' \
       --data-binary "$payload" \
       "${base}/api/companies/${PAPERCLIP_COMPANY_ID}/issues"; then
    mkdir -p "$STATO_DIR" && : >"$marcatore"
    registra "Aperto un compito su Paperclip"
  else
    registra "AVVISO: non sono riuscito ad aprire il compito su Paperclip"
  fi
}

fallisci() {
  local motivo="$1"
  registra "FALLITO: ${motivo}"
  segnale_silenzio "/fail"
  apri_compito_paperclip "$motivo"
  exit 1
}

trap 'fallisci "errore imprevisto alla riga $LINENO"' ERR

# --------------------------------------------------------------------------------------
# 1. Controlli preliminari
# --------------------------------------------------------------------------------------

controlli_preliminari() {
  command -v pg_dump    >/dev/null || fallisci "pg_dump non installato (serve postgresql-client)"
  command -v pg_restore >/dev/null || fallisci "pg_restore non installato: senza non posso verificare il file"

  for v in PGHOST PGUSER PGDATABASE; do
    [ -n "${!v:-}" ] || fallisci "manca ${v} nel file di configurazione"
  done

  mkdir -p "$DEST_DIR/giornalieri" "$DEST_DIR/settimanali" "$DEST_DIR/mensili" "$STATO_DIR"
  [ -w "$DEST_DIR" ] || fallisci "non posso scrivere in $DEST_DIR"

  # pg_dump piu' vecchio del server rifiuta di lavorare: meglio saperlo qui che alle 03:30.
  if command -v psql >/dev/null; then
    local server client
    server="$(psql -Atqc 'show server_version_num' 2>/dev/null || true)"
    client="$(pg_dump --version | grep -oE '[0-9]+' | head -1 || true)"
    if [ -n "$server" ]; then
      if [ "$client" -lt "$((server / 10000))" ]; then
        fallisci "pg_dump e' della versione ${client}, il server e' della $((server / 10000)): serve un client almeno pari"
      fi
      registra "Connessione al database: ok (server ${server}, client ${client})"
    else
      fallisci "non riesco a connettermi al database (host, utente, .pgpass o SSL?)"
    fi
  fi

  if [ -n "$RCLONE_REMOTE" ]; then
    command -v rclone >/dev/null || fallisci "rclone non installato ma RCLONE_REMOTE e' configurato"
  else
    registra "AVVISO: nessuna copia fuori sede configurata, il backup resta solo su questa macchina"
  fi

  [ -n "$HEALTHCHECK_URL" ] ||
    registra "AVVISO: guardiano del silenzio non configurato: se il backup smette di girare non lo sapra' nessuno"
}

controlli_preliminari

if [ "$SOLO_VERIFICA" = 1 ]; then
  registra "Controlli preliminari superati (--verifica: nessun backup prodotto)"
  exit 0
fi

# --------------------------------------------------------------------------------------
# 2. Il dump
# --------------------------------------------------------------------------------------

registra "--- Inizio backup ${OGGI} ---"
INIZIO="$(date +%s)"
TEMP="$(mktemp "${DEST_DIR}/.in-corso-XXXXXX.dump")"
trap 'rm -f "$TEMP"; fallisci "errore imprevisto alla riga $LINENO"' ERR

# shellcheck disable=SC2086
pg_dump -Fc -Z6 --no-owner --no-privileges $PG_DUMP_OPZIONI_EXTRA -f "$TEMP" ||
  fallisci "pg_dump ha restituito un errore"

# --------------------------------------------------------------------------------------
# 3. Verifica del file appena scritto
# --------------------------------------------------------------------------------------

DIMENSIONE="$(stat -c %s "$TEMP")"
[ "$DIMENSIONE" -ge "$DIMENSIONE_MINIMA_BYTE" ] ||
  fallisci "il dump e' di soli ${DIMENSIONE} byte: e' un fallimento travestito da successo"

pg_restore --list "$TEMP" >/dev/null 2>&1 ||
  fallisci "il file prodotto non e' un dump leggibile (pg_restore --list non lo apre)"

# Confronto con il backup precedente: un crollo di dimensione e' il modo in cui un dump
# fallisce restando "riuscito" (un permesso perso, uno schema che sparisce).
PRECEDENTE="$(find "$DEST_DIR/giornalieri" -name 'crmadv-*.dump' -type f -printf '%T@ %p\n' 2>/dev/null |
  sort -rn | head -1 | cut -d' ' -f2- || true)"
if [ -n "$PRECEDENTE" ] && [ -f "$PRECEDENTE" ]; then
  DIM_PREC="$(stat -c %s "$PRECEDENTE")"
  SOGLIA=$((DIM_PREC * (100 - CALO_MASSIMO_PERCENTUALE) / 100))
  [ "$DIMENSIONE" -ge "$SOGLIA" ] ||
    fallisci "il dump e' ${DIMENSIONE} byte contro i ${DIM_PREC} di ieri: calo oltre il ${CALO_MASSIMO_PERCENTUALE}%"
fi

# --------------------------------------------------------------------------------------
# 4. Al suo posto, e le copie settimanale/mensile
# --------------------------------------------------------------------------------------

FINALE="${DEST_DIR}/giornalieri/${NOME_FILE}"
chmod 600 "$TEMP"
mv -f "$TEMP" "$FINALE"
trap 'fallisci "errore imprevisto alla riga $LINENO"' ERR

# Collegamento fisico, non copia: due nomi, un solo file su disco. Lo spazio si libera
# quando cade l'ultimo dei due nomi.
# ⚠️ Scritto con "if" e non con "test && ln": in un giorno che non e' domenica il test
#    fallisce, e con "set -e" farebbe uscire lo script come se il backup fosse andato male.
if [ "$(date +%u)" = "7" ]; then
  ln -f "$FINALE" "${DEST_DIR}/settimanali/${NOME_FILE}"
  registra "Copia settimanale agganciata"
fi
if [ "$(date +%d)" = "01" ]; then
  ln -f "$FINALE" "${DEST_DIR}/mensili/${NOME_FILE}"
  registra "Copia mensile agganciata"
fi

DURATA=$(( $(date +%s) - INIZIO ))
registra "Dump riuscito: ${FINALE} ($((DIMENSIONE / 1024 / 1024)) MB in ${DURATA}s)"

# --------------------------------------------------------------------------------------
# 5. Rotazione
# --------------------------------------------------------------------------------------

ruota() {
  local cartella="$1" quanti="$2" f
  find "$cartella" -maxdepth 1 -name 'crmadv-*.dump' -type f -printf '%f\n' 2>/dev/null |
    sort -r | tail -n "+$((quanti + 1))" |
    while IFS= read -r f; do
      rm -f -- "${cartella}/${f}"
      registra "Rotazione: rimosso ${cartella}/${f}"
    done
}

ruota "${DEST_DIR}/giornalieri"  "$GIORNALIERI_DA_TENERE"
ruota "${DEST_DIR}/settimanali"  "$SETTIMANALI_DA_TENERE"
ruota "${DEST_DIR}/mensili"      "$MENSILI_DA_TENERE"

# --------------------------------------------------------------------------------------
# 6. Copia fuori sede
# --------------------------------------------------------------------------------------

if [ -n "$RCLONE_REMOTE" ]; then
  opzioni=(--transfers 1 --retries 3 --stats 0 --log-level ERROR)
  [ -n "$RCLONE_CONFIG" ] && opzioni+=(--config "$RCLONE_CONFIG")
  # Solo "copy": le chiavi sono di sola scrittura apposta, la scadenza dei file la decide
  # la regola del ciclo di vita sull'archivio (vedi README). Cosi' chi entrasse nella VPS
  # non puo' cancellare le copie di fuori.
  if rclone "${opzioni[@]}" copy "$FINALE" "${RCLONE_REMOTE%/}/giornalieri/"; then
    registra "Copia fuori sede riuscita: ${RCLONE_REMOTE%/}/giornalieri/${NOME_FILE}"
  else
    fallisci "la copia fuori sede e' fallita: il backup esiste solo su questa macchina"
  fi
fi

# --------------------------------------------------------------------------------------
# 7. Segnale: sono vivo e ho finito
# --------------------------------------------------------------------------------------

segnale_silenzio ""
registra "--- Backup ${OGGI} completato in $(( $(date +%s) - INIZIO ))s ---"
