### Brief Operativo Definitivo: Sviluppo CRM Multi-tenant "Agenzia Next-Gen"

#### 1\. Visione del Prodotto e Filosofia di Design

##### 1.1 Core Philosophy: Apple Style (Sottrazione del Superfluo)

Il CRM deve essere progettato seguendo un rigoroso approccio minimalista. La missione architettonica è la "sottrazione": rimuovere ogni elemento visivo o funzionale non strettamente necessario per ridurre il carico cognitivo dell'utente. L'interfaccia deve nascondere la complessità tecnica, presentando solo gli strumenti pertinenti al task corrente. L'obiettivo è un sistema "frictionless" dove la navigazione è intuitiva anche per utenti non esperti, supportata da un sistema di  **Advanced Find**  (ricerca globale istantanea) e  **Shortcuts**  personalizzabili per minimizzare i click necessari a raggiungere qualsiasi funzione.

##### 1.2 Obiettivi Strategici Primari

* **Semplificazione Operativa Team-Centric** : Centralizzare il flusso di lavoro affinché ogni dipendente veda esclusivamente ciò che serve alla sua operatività quotidiana.  
* **Efficienza AI-Driven** : Abbattimento dei tempi di esecuzione tramite un motore di contesto che automatizza ricerca, analisi e generazione di asset.  
* **Integrità del Dato e Zero Errori** : Eliminare le criticità manuali, con un focus ossessivo sul reparto  **Laboratorio (Stampa)** , dove l'AI deve validare misure e materiali incrociandoli con i brief originali per prevenire sprechi di produzione.

#### 2\. Architettura Multi-tenant e Gestione Accessi

##### 2.1 Struttura Workspace e Controllo Super Admin

Il sistema adotta un'architettura multi-tenant pura. Il  **Super Admin**  dispone di una dashboard di controllo globale per la creazione, sospensione e configurazione di workspace isolati. Ogni workspace è un ecosistema indipendente con database e configurazioni API proprie.

##### 2.2 Sistema Ruoli "Discord-Style" e Gerarchia Funzionale

La gestione dei permessi deve essere granulare e altamente flessibile, permettendo la creazione di ruoli custom basati sull'organigramma aziendale.| Ruolo | Esempio Permesso Granulare | Vincolo Gerarchico (Business Logic) || \------ | \------ | \------ || **Admin** | Gestione Totale | Accesso completo a log di costo AI e configurazioni API. || **Capo Reparto** | Edit Progetti Reparto | Può fissare appuntamenti per i dipendenti del proprio reparto. || **Dipendente** | View/Edit Task Assegnati | Non può fissare appuntamenti per il Capo Reparto (Vincolo Source). || **Reparto Lab** | Validazione Tecnica | Accesso specifico a schede materiali e misure. || **Client (Future)** | Sola Visualizzazione | Accesso limitato tramite link temporanei o credenziali dedicate. |

##### 2.3 User Experience & Navigazione Rapida

Ogni utente deve poter personalizzare il proprio ambiente (tema, colori, foto profilo) per ottimizzare il comfort visivo. La navigazione deve essere potenziata da una barra di ricerca "Command-K style" per l'accesso rapido a progetti, clienti o comandi rapidi (shortcuts).

#### 3\. Modulo Anagrafica Clienti (B2B & B2C)

##### 3.1 Gestione Contatti e Data Persistence

Gestione completa di anagrafiche B2B e B2C con import/export massivo. Il sistema deve garantire la  **Flessibilità del Dato**  attraverso l'implementazione di "Campi Personalizzati" (Custom Fields). Una volta definiti (es. "Tipo di Trattamento Preferito" o "Codice Destinatario"), questi campi diventano parte dello schema database persistente per l'intero workspace.

##### 3.2 Ecosistema di Integrazione API

Architettura predisposta per sincronizzazioni bidirezionali:

* **Brevo (ex Sendinblue)** : Sincronizzazione real-time dei contatti per campagne di email marketing.  
* **Fatture in Cloud** : Recupero dati anagrafici e storici di fatturazione per analisi di redditività.  
* **API Framework** : Struttura a plugin per future integrazioni scalabili.

#### 4\. Modulo Team e Organizzazione Reparti

##### 4.1 Mappatura Reparti Agenzia

Il workspace è suddiviso nei seguenti reparti operativi:

* **Web**  
* **Marketing**  
* **Social**  
* **Grafica**  
* **Laboratorio (Stampa)**

##### 4.2 Logica di Visibilità Pertinente

La visibilità è regolata dal principio di assegnazione: un utente visualizza solo i progetti e i task in cui è attivamente coinvolto. Questo garantisce che la dashboard di un grafico non sia inquinata da task del reparto web, a meno che il progetto non sia trasversale.

#### 5\. Ecosistema Progetti e Motore AI Context-Aware

##### 5.1 Il Modulo "Fonti" (Knowledge Base Vectorizzata)

Il cuore del sistema è il modulo Fonti. Ogni progetto (es.  **Medical Prime** ) deve avere una base di conoscenza alimentata da:

* URL (sito web, social).  
* Trascrizioni di call e brief (Word/PDF).  
* Asset di brand (loghi, stili, palette). Questi dati devono essere processati (vectorization) per permettere all'AI di avere una "memoria di progetto" persistente.

##### 5.2 Discovery e Analisi Strategica

Tramite un pulsante "Discovery", l'AI analizza le fonti per estrarre:

* **Business Recap** : Chi è il cliente e cosa fa.  
* **Obiettivi e Target** : Cosa vuole ottenere e a chi si rivolge.  
* **Offerta & Competitors** : Analisi di mercato basata sui dati caricati.

##### 5.3 Modelli AI e Cost Control (Token Budgeting)

Il sistema deve implementare una logica di efficienza economica:

* **Modelli Multipli** : Utilizzo di modelli economici (OpenAI GPT-4o mini) per task di discovery/recap e modelli premium (Claude 3.5 Sonnet) per prompt engineering complesso e strategia.  
* **Tracciamento Consumi** : Ogni pulsante AI deve mostrare una  **stima del costo/token**  prima dell'esecuzione.  
* **Limitazioni** : Possibilità di impostare un budget di token giornaliero per dipendente (es. 100 token/die) per prevenire escalation dei costi API.

##### 5.4 Higgsfield & Visual Generation

Integrazione del protocollo  **Higgsfield**  per la generazione di asset visuali. La catena di comando sarà:  **Contesto Progetto \-\> Claude (Prompt Architect) \-\> Higgsfield (Generation)** . Claude agisce come mediatore per garantire che i prompt generati siano coerenti con lo stile e il brand presenti nel modulo Fonti.

##### 5.5 Chat AI di Progetto

Dashboard di interazione in tempo reale che mantiene il contesto totale. L'utente può interrogare l'AI su qualsiasi dato presente nelle fonti (es. "Quali sono i vantaggi della Criolipolisi nel brief di Medical Prime?") senza dover rileggere i documenti originali.

#### 6\. Moduli Operativi Specifici (Verticali)

##### 6.1 Modulo Web & ADV

* Generazione strutture HTML e scheletri di landing page.  
* Creazione di copy e strutture campagne per Meta, Google Ads e TikTok, differenziati per sotto-progetto (es. landing specifica per Criolipolisi).

##### 6.2 Modulo Laboratorio e Stampa (Zero Error Protocol)

Per abbattere gli errori umani (misure e materiali), il sistema deve implementare una  **Validazione AI Obbligatoria** . Prima di mandare in stampa, l'AI confronta i dati tecnici inseriti con le specifiche presenti nelle "Fonti" del progetto, segnalando discrepanze in tempo reale.

##### 6.3 Audit Continuo e Reportistica

* **Audit Engine** : Analisi automatica di URL per identificare errori SEO (H1 mancanti, meta tag) o mancanze comunicative.  
* **Report PDF** : Generazione di documenti brandizzati per il cliente con dati importati (es. conversioni Google Ads), presentati con estetica Apple-style.

#### 7\. Preventivatore e Strumenti di Vendita

##### 7.1 Creazione Rapida e Pacchettizzazione

Sistema drag-and-drop basato su pacchetti predefiniti (es. "Sito Web Pro", "Gestione Social").

##### 7.2 Output Duale e Business Logic

Il sistema deve generare:

1. **Preventivo Analitico** : Documento tecnico/economico dettagliato.  
2. **Proposta Apple-style** : Slide accattivanti e visuali per la vendita in call.  
* **Vincolo di Validità** : Ogni proposta deve includere automaticamente una  **validità di 72 ore** , trascorsa la quale il sistema deve notificare l'account manager.

#### 8\. Calendario e Comunicazione Interna

##### 8.1 Gestione Appuntamenti e Automazione

Integrazione con Meet/Zoom e sistema di notifica automatica per i clienti (reminders). Implementazione di link personali "Calendly-style" per ogni dipendente, riflettendo la disponibilità reale del workspace.

##### 8.2 Messaggistica Asincrona

Sistema interno di messaggistica per centralizzare le comunicazioni sui progetti, eliminando la frammentazione causata da WhatsApp o email esterne.

#### 9\. Contabilità e Controllo di Gestione

##### 9.1 Monitoraggio Performance

Integrazione API con  **Fatture in Cloud**  per visualizzare fatturati e flussi finanziari direttamente nel CRM (riservato agli Admin).

##### 9.2 Analisi di Redditività Real-Time

Il sistema deve incrociare il tempo/risorse allocate sui singoli progetti con i dati di fatturazione per generare statistiche sulla redditività effettiva di ogni cliente e reparto.

#### 10\. Protocollo Operativo di Merge AI (Roadmap Strategica)

##### 10.1 Analisi e Strategia di Fusione

Per la transizione dal sistema legacy alla nuova architettura, un LLM (Claude) eseguirà un protocollo di merge analizzando:

1. Il presente  **Brief Operativo Definitivo** .  
2. La documentazione tecnica (schema database e funzioni) del CRM preesistente.

##### 10.2 Output del Protocollo di Merge

Claude dovrà produrre:

* **Feature Gap Analysis** : Identificazione delle funzioni attuali da migrare, migliorare o dismettere.  
* **Schema Mapping** : Strategia di fusione dei database per garantire la continuità dei dati clienti.  
* **Priorità di Rilascio** : Roadmap modulare per il passaggio alla nuova UX "Apple-style" senza interruzioni operative.

