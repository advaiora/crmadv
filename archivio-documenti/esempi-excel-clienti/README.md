# Esempi Excel clienti — materiale per il sotto-modulo di standardizzazione

> Cartella per i **file di riferimento** su cui sviluppare la lettura/standardizzazione degli Excel dei clienti (parte "Excel + AI" del modulo Reportistica multi-sorgente). Nasce dal metodo del progetto **Revisioni-fogli-di-calcolo**.

## Cosa lasciare qui (in ordine di utilità)

1. **File grezzi reali** dei clienti, così come arrivano (fogli NON standardizzati).
   - Meglio **2 clienti/formati diversi**, per vedere la varietà che profilo + versionamento devono reggere.
   - Anche **un solo** file basta per partire.
2. **Mappatura esplicita** (se esiste, dal metodo Revisioni): colonna sorgente → campo canonico.
   - Serve come *verità di riferimento* per misurare quanto la mappatura proposta dall'AI ci azzecca.
3. **Template canonico/master** di destinazione (es. `Template_Dashboard_KPI_Marketing.xlsx`).
   - Allinea i nomi delle metriche canoniche e le sezioni.
4. **Note di parsing** dei singoli clienti: valuta, separatori, formato numeri/date (all'italiana), righe-totale da escludere, ecc.

## ⚠️ Privacy

L'origine di Revisioni è sanitaria (pazienti, codice fiscale, consenso). Se i file contengono **dati personali/sensibili**, **anonimizzali** prima di metterli qui (a me serve la *struttura* del foglio, non i dati veri) oppure scegli un file non sensibile.

## Nota

Questa cartella è materiale di lavoro/riferimento. Non contiene codice. Il sotto-modulo Excel+AI è quello marcato "da concordare con Claudio" negli handoff/decisioni: lo sviluppo procede solo col via esplicito di Jacopo.

## Fonte individuata (28/7) — progetto "Revisioni fogli di calcolo"

Il progetto d'origine è in `C:\Users\jacop\Documents\Revisioni fogli di calcolo\` (cartella sorella di `crmadv`). Contiene esattamente il materiale utile:

- **3 clienti con formati diversi** (la varietà richiesta):
  - `clienti/arkiroma/` — export contatti/lead;
  - `clienti/orologeria-cavour/` — registro transazioni (ri-export cumulativo, celle unite, blocchi multi-riga) + lead da form sito + LEAD-VALUTAZIONE;
  - `clienti/medical-prime/` — calendario prestazioni (sanitario).
- **Mappature esplicite** `clienti/*/mappatura.md` — è il formato-bersaglio dello structured-output dell'AI (fonti grezze → passi di trasformazione → tabella colonna-template→campo → QA di riconciliazione).
- **Master template** `_master-template/Template_Dashboard_KPI_Marketing.xlsx` e **skeleton** `_scaffold/mappatura_skeleton.md`.

⚠️ **Copia in sospeso (decisione utente).** Copiare i file grezzi reali dentro il repo è stato **bloccato dal classificatore di sicurezza** — corretto, perché sono **PII reali** (contatti, transazioni, dati sanitari). Questa cartella è comunque protetta da `.gitignore` (nessun dato cliente finisce mai su git). Alla ripresa: o si autorizza la copia nella cartella gitignorata, oppure si leggono i file **in loco** dal progetto Revisioni, oppure si usano campioni **anonimizzati**.
