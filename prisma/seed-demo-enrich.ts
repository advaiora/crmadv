import { readFileSync } from 'node:fs';
import { PrismaClient, Prisma } from '@prisma/client';
import { getConnector, type ConnectorSource } from '../server/modules/agency-os/reporting/performance-connectors.js';

/**
 * Seed DEMO — ARRICCHIMENTO (base/input dei clienti e progetti demo).
 *
 * Scopo (handoff 30/7/2026): rendere i clienti/progetti demo "all'altezza" per
 * collaudare tutto il CRM, senza i buchi ("manca la fonte", progetti che non
 * compaiono in Agency, ecc.) che oggi appaiono ovunque.
 *
 * REGOLA D'ORO: si popola SOLO la BASE / input — cioe' i dati che una persona
 * inserirebbe a mano — e si lascia VUOTO tutto cio' che e' output generato
 * dall'AI (Discovery, Report cliente, Diagnosi, Ads, contenuti Web AI, chat),
 * cosi' Jacopo li genera lui testando le funzioni AI.
 *
 * COSA POPOLA:
 *  - Tipo progetto (ProjectType) su tutti i 9 progetti demo -> li rende visibili in Agency.
 *  - scopePurchased (oggetto a 7 chiavi) -> i motori a regole autogenerano da soli
 *    moduli attivi / alert / opportunita' / task all'apertura delle pagine (NON scritti qui).
 *  - Fonti V4 (ProjectSource) sui 4 progetti "vuoti" + indicizzazione RAG (best effort).
 *  - Fonti "legacy" (ProjectMemory.sourcesJson) su tutti i 9 -> spegne il flag
 *    "Nessuna fonte cliente reale registrata".
 *  - Web asset: snapshot/eventi analytics + finestre di manutenzione (dati "a mano").
 *  - Custom field: definizioni (entita' client) + valori su Client.customFields.
 *  - Performance (SIMULATA, manca l'OAuth): storico Google/Meta/Excel feb->lug sui
 *    progetti con campagne nello scope, NON distruttivo (salta i mesi gia' presenti).
 *
 * COSA AZZERA di proposito: la Discovery (ProjectMemory.briefJson + contextSummary)
 * ANCHE sui 5 progetti che oggi ce l'hanno dal vecchio seed-demo-agency.ts, cosi'
 * tutti i demo partono "puliti" lato AI e la generazione Discovery si testa ovunque
 * allo stesso modo.
 *
 * ORDINE DI ESECUZIONE (i seed NON sono commutativi):
 *   npm run db:seed  ->  db:seed:demo  ->  db:seed:demo:agency  ->  db:seed:demo:enrich
 * Questo va ESEGUITO PER ULTIMO. seed-demo.ts cancella e ricrea i progetti demo a
 * ogni run (cascade su fonti/discovery/performance): rilanciarlo DOPO cancellerebbe
 * l'arricchimento. seed-demo-agency.ts scrive la Discovery sui 5 progetti: questo
 * seed la azzera, quindi va dopo di lui.
 *
 * Idempotente: riconosce progetti/clienti/asset per nome/URL nel workspace demo e
 * riscrive solo cio' che crea lui.
 *
 * Uso: `npm run db:seed:demo:enrich`  (oppure `npx tsx prisma/seed-demo-enrich.ts`)
 */

// Carica .env (DATABASE_URL + ENCRYPTION_KEY + eventuale OPENAI_API_KEY) in process.env
// se non gia' presenti: l'indicizzazione delle fonti decifra il segreto AI del
// workspace con ENCRYPTION_KEY, quindi qui deve essere disponibile (stesso schema
// di prisma/seed-demo-agency.ts).
try {
  const envPath = new URL('../.env', import.meta.url);
  for (const raw of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = raw.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1');
    }
  }
} catch {
  // .env assente: si prosegue con le variabili gia' nell'ambiente.
}

const prisma = new PrismaClient();
const WORKSPACE_SLUG = 'demo';
const ADMIN_EMAIL = 'admin@test.com';

// --- Tipi progetto canonici (fonte di verita': server/modules/agency-os/agency.service.ts:704-745).
// Si creano SOLO quelli effettivamente assegnati qui sotto; i campi label/description
// ricalcano quelli canonici. La validazione backend accetta solo queste chiavi.
const PROJECT_TYPE_CATALOG = {
  website: { label: 'Website', description: 'Progetto orientato a sito, UX e conversione web.' },
  landing_page: { label: 'Landing Page', description: 'Progetto focalizzato su landing page dedicata e conversione.' },
  marketing_full: { label: 'Marketing Full', description: 'Progetto full-funnel con discovery, web, ads e reporting.' },
  ecommerce: { label: 'Ecommerce', description: 'Progetto orientato a catalogo, conversione e supporto paid.' },
} as const;

// --- Forma "grezza" delle fonti legacy (ProjectMemory.sourcesJson). I campi calcolati
// (sourceStatus/summary/quality) li ricostruisce l'app in lettura: qui basta il grezzo.
type LegacySocial = { type: 'instagram' | 'facebook' | 'linkedin' | 'behance' | 'google_business' | 'other'; url: string };
type LegacyInput = {
  websiteUrl?: string;
  socials?: LegacySocial[];
  competitors?: { name: string; url?: string }[];
  notes: string;
};

// `behance` non e' tra i type ammessi dallo schema fonti: lo mappo su 'other'.
const URL_TYPE_MAP: Record<LegacySocial['type'], string> = {
  instagram: 'instagram',
  facebook: 'facebook',
  linkedin: 'linkedin',
  google_business: 'google_business',
  behance: 'other',
  other: 'other',
};

function buildSourcesJson(input: LegacyInput): Prisma.InputJsonValue {
  const urls = (input.socials ?? []).map((s) => ({
    type: URL_TYPE_MAP[s.type],
    url: s.url,
    status: 'active' as const,
  }));
  return {
    websiteUrl: input.websiteUrl ?? '',
    urls,
    competitorUrls: (input.competitors ?? []).map((c) => c.url).filter((u): u is string => Boolean(u)),
    competitors: (input.competitors ?? []).map((c) => ({
      name: c.name,
      url: c.url ?? '',
      source: 'manual' as const,
      status: 'confirmed' as const,
    })),
    uploadedFiles: [],
    manualNotes: input.notes,
    sourceType: 'demo_seed',
  };
}

// --- Definizione dei 9 progetti demo -----------------------------------------
type ScopeKey = 'website' | 'landing_page' | 'google_ads' | 'meta_ads' | 'seo' | 'reporting' | 'diagnosis';
type ProjectEnrich = {
  name: string;
  typeKey: keyof typeof PROJECT_TYPE_CATALOG;
  status: 'DISCOVERY' | 'PLANNING' | 'PRODUCTION' | 'REVIEW' | 'LIVE' | 'PAUSED' | 'ARCHIVED';
  goal: string;
  scope: Partial<Record<ScopeKey, boolean>>;
  legacy: LegacyInput;
  // Fonti V4 SOLO per i 4 progetti "vuoti"; i 5 gia' coperti da seed-demo-agency.ts
  // lasciano `fonti` a undefined (le loro fonti esistenti NON vanno toccate).
  fonti?: { title: string; content: string }[];
};

const FULL_SCOPE = (partial: Partial<Record<ScopeKey, boolean>>) => ({
  website: false,
  landing_page: false,
  google_ads: false,
  meta_ads: false,
  seo: false,
  reporting: false,
  diagnosis: false,
  ...partial,
});

const PROJECTS: ProjectEnrich[] = [
  {
    name: 'Portfolio fotografico Anna Fontana',
    typeKey: 'website',
    status: 'LIVE',
    goal: 'Sito portfolio che sostituisca Instagram come vetrina, con richiesta preventivo. Crescita attesa: +30% richieste matrimoni in un anno.',
    scope: { website: true },
    legacy: {
      websiteUrl: '',
      socials: [{ type: 'instagram', url: 'https://instagram.com/annafontana.ph' }],
      notes: 'Notorieta\' finora su Instagram e passaparola. Vuole un sito portfolio con gallerie per categoria e modulo preventivo.',
    },
  },
  {
    name: 'E-commerce Dolce Vita',
    typeKey: 'ecommerce',
    status: 'PRODUCTION',
    goal: 'E-commerce con spedizione refrigerata in tutta Italia: catalogo, carrello, gestione ordini. Aprire il canale di vendita online.',
    scope: { website: true, google_ads: true, meta_ads: true, seo: true, reporting: true },
    legacy: {
      websiteUrl: 'https://shop.dolcevitatorino.it',
      competitors: [{ name: 'Pasticceria Poppella', url: 'https://www.poppella.it' }],
      notes: 'Pasticceria artigianale napoletana dal 1998. Vendita finora solo in negozio. Prodotti chiave: sfogliatella, baba\', pastiera. Ordine minimo 25 euro.',
    },
  },
  {
    name: 'Sito corporate Rossi Costruzioni',
    typeKey: 'website',
    status: 'LIVE',
    goal: 'Sito corporate istituzionale per credibilita\' e generazione contatti: portfolio cantieri prima/dopo, certificazioni, modulo preventivo. Non e-commerce.',
    scope: { website: true, seo: true, diagnosis: true },
    legacy: {
      websiteUrl: 'https://rossicostruzioni.it',
      notes: 'Impresa edile storica di Bergamo (tre generazioni, 40+ dipendenti). Edilizia residenziale e ristrutturazioni per privati e piccoli condomini.',
    },
  },
  {
    name: 'App corsi UrbanFit',
    typeKey: 'marketing_full',
    status: 'PLANNING',
    goal: 'App per prenotare i corsi, calendario con posti limitati e notifiche promemoria. Ridurre le telefonate in reception e i no-show.',
    scope: { website: true, google_ads: true, meta_ads: true, reporting: true },
    legacy: {
      websiteUrl: 'https://app.urbanfit.club',
      socials: [{ type: 'instagram', url: 'https://instagram.com/urbanfit.milano' }],
      competitors: [{ name: 'Virgin Active Milano', url: 'https://www.virginactive.it' }],
      notes: 'Catena di 3 palestre a Milano (~1500 iscritti), corsi di gruppo. Prenotazioni oggi via telefono/reception, molti no-show.',
    },
  },
  {
    name: 'Sito studio Bassi & Partner',
    typeKey: 'website',
    status: 'PRODUCTION',
    goal: 'Sito professionale per presentare i servizi e generare contatti qualificati, con blog fiscale e modulo di prima consulenza gratuita.',
    scope: { website: true, seo: true },
    legacy: {
      websiteUrl: 'https://staging.bassilegal.it',
      notes: 'Studio di commercialisti a Verona (5 professionisti), consulenza fiscale per PMI e partite IVA. Sito ancora in staging.',
    },
  },
  {
    name: 'Landing Immobiliare Piemonte',
    typeKey: 'landing_page',
    status: 'REVIEW',
    goal: 'Landing per lead generation sul quartiere Crocetta collegata a una campagna Google Ads. Obiettivo: 40 richieste qualificate al mese.',
    scope: { landing_page: true, google_ads: true, meta_ads: true, reporting: true, diagnosis: true },
    legacy: {
      websiteUrl: '',
      competitors: [
        { name: 'Gabetti Torino', url: 'https://www.gabetti.it' },
        { name: 'Tecnocasa Crocetta', url: 'https://www.tecnocasa.it' },
      ],
      notes: 'Agenzia immobiliare di Torino (dal 2009, sei agenti). Focus quartiere Crocetta. Budget Ads indicativo ~1.500 euro/mese. Landing non ancora online.',
    },
    fonti: [
      {
        title: 'Profilo e attivita\' del cliente',
        content:
          'Immobiliare Piemonte Casa e\' un\'agenzia immobiliare di Torino attiva dal 2009, specializzata nella compravendita di appartamenti residenziali in citta\' e prima cintura. Il team e\' di sei agenti. Finora i contatti arrivavano da portali generalisti (Immobiliare.it, Idealista) e dalle vetrine delle due sedi.',
      },
      {
        title: 'Obiettivi del progetto',
        content:
          'Il progetto e\' una landing page per la lead generation su un singolo quartiere in forte domanda (Crocetta), collegata a una campagna Google Ads. Serve un modulo di contatto essenziale (nome, telefono, tipo di immobile cercato) e un numero WhatsApp diretto. Obiettivo dichiarato: raccogliere almeno 40 richieste qualificate al mese durante la campagna.',
      },
      {
        title: 'Servizi e condizioni',
        content:
          'L\'agenzia si occupa di vendita e affitto, con provvigione standard del 3% sul venduto. Offre valutazione gratuita dell\'immobile e servizio fotografico incluso nel mandato. Orari: lun-ven 9-19, sabato 9-13.',
      },
    ],
  },
  {
    name: 'Booking B&B Le Vigne',
    typeKey: 'website',
    status: 'PRODUCTION',
    goal: 'Sito con motore di prenotazione diretta per ridurre le commissioni dei portali, con galleria, calendario disponibilita\' e caparra online. Obiettivo: 40% di prenotazioni dirette.',
    scope: { website: true, seo: true },
    legacy: {
      websiteUrl: 'https://levignebb.it',
      competitors: [{ name: 'Booking.com (listing struttura)', url: 'https://www.booking.com' }],
      notes: 'B&B di quattro camere sulle colline di Alba (Langhe), dal 2014. Turismo enogastronomico, clientela in buona parte straniera. Prenotazioni oggi da Booking.com e telefono.',
    },
    fonti: [
      {
        title: 'Profilo e attivita\' del cliente',
        content:
          'Le Vigne e\' un bed & breakfast di quattro camere sulle colline di Alba, nelle Langhe, aperto dal 2014. Punta su un turismo enogastronomico (visite in cantina, tartufo in stagione) e su una clientela in buona parte straniera. Finora le prenotazioni passavano da Booking.com e da telefonate dirette.',
      },
      {
        title: 'Obiettivi del progetto',
        content:
          'Il progetto e\' un sito con motore di prenotazione diretta per ridurre le commissioni dei portali, con galleria fotografica della struttura e delle camere, calendario disponibilita\' e pagamento della caparra online. Obiettivo: portare al 40% le prenotazioni dirette entro la stagione.',
      },
      {
        title: 'Camere e tariffe',
        content:
          'Quattro camere doppie (Nebbiolo, Barbera, Dolcetto, Arneis) da 95 euro a notte in bassa stagione e 130 euro in alta, colazione con prodotti locali inclusa. Check-in 15-19, check-out entro le 10:30. Minimo due notti nei weekend di ottobre.',
      },
    ],
  },
  {
    name: 'Portfolio Martina Galli',
    typeKey: 'website',
    status: 'REVIEW',
    goal: 'Portfolio online che raccolga i lavori per categoria con schede di caso e pagina contatti. Avere un indirizzo unico da lasciare ai potenziali clienti.',
    scope: { website: true },
    legacy: {
      websiteUrl: '',
      socials: [{ type: 'behance', url: 'https://behance.net/martinagalli' }],
      notes: 'Graphic e web designer freelance di Asti (dal 2019). Finora si presentava con profilo Behance e un PDF via email. Vuole un portfolio unico.',
    },
    fonti: [
      {
        title: 'Profilo e attivita\' della cliente',
        content:
          'Martina Galli e\' una graphic e web designer freelance di Asti, attiva dal 2019. Lavora soprattutto su identita\' visive e siti per piccole attivita\' locali. Finora si e\' presentata con un profilo Behance e un PDF inviato via email.',
      },
      {
        title: 'Obiettivi del progetto',
        content:
          'Il progetto e\' un portfolio online che raccolga i lavori per categoria (logo, brand identity, siti web) con schede di caso e una pagina contatti. Obiettivo: avere un indirizzo unico da lasciare ai potenziali clienti e smettere di inviare il PDF.',
      },
      {
        title: 'Servizi e tariffe',
        content:
          'Logo e identita\' visiva a partire da 600 euro, sito vetrina da 1200 euro, restyling da 400 euro. Tempi medi di consegna 3-4 settimane. Lavora da remoto con clienti in tutto il Nord Italia.',
      },
    ],
  },
  {
    name: 'Sito Farmacia San Carlo',
    typeKey: 'website',
    status: 'PRODUCTION',
    goal: 'Sito con turni (di guardia e notturni), elenco servizi e modulo per prenotare le autoanalisi in fascia oraria, per ridurre le code al banco e le telefonate sui turni.',
    scope: { website: true, seo: true, diagnosis: true },
    legacy: {
      websiteUrl: 'https://prenota.farmaciasancarlo.it',
      notes: 'Farmacia di quartiere in centro a Torino, gestione familiare dagli anni \'80. Servizi di autoanalisi, noleggio apparecchi, prenotazione CUP. Bacino di clienti fedeli, soprattutto anziani.',
    },
    fonti: [
      {
        title: 'Profilo e attivita\' del cliente',
        content:
          'La Farmacia San Carlo e\' una farmacia di quartiere in centro a Torino, a gestione familiare dagli anni \'80. Offre, oltre al banco, servizi di autoanalisi (glicemia, colesterolo, pressione), noleggio di apparecchi sanitari e prenotazione CUP. Ha un bacino di clienti fedeli soprattutto anziani.',
      },
      {
        title: 'Obiettivi del progetto',
        content:
          'Il progetto e\' un sito con l\'indicazione dei turni (di guardia e notturni), l\'elenco dei servizi e un modulo per prenotare le autoanalisi in fascia oraria, cosi\' da ridurre le code al banco. Obiettivo: dare un riferimento online chiaro e sfoltire le richieste telefoniche sui turni.',
      },
      {
        title: 'Servizi e orari',
        content:
          'Autoanalisi glicemia 8 euro, colesterolo 12 euro, misurazione pressione gratuita; noleggio tiralatte e stampelle. Orari: lun-sab 8:30-19:30, con turni di guardia pubblicati mensilmente. Consegna a domicilio gratuita per over 75 nel quartiere.',
      },
    ],
  },
];

// --- Piano PERFORMANCE (simulata) --------------------------------------------
// Mesi 2026: feb=1 ... lug=6 (indice mese JS 0-based: feb=1, lug=6).
type PerfPlan = { projectName: string; connectors: { source: ConnectorSource; fromMonth: number; toMonth: number }[]; excelMonths?: number[] };
const PERFORMANCE_PLANS: PerfPlan[] = [
  {
    projectName: 'Landing Immobiliare Piemonte',
    connectors: [
      { source: 'GOOGLE_ADS', fromMonth: 1, toMonth: 6 }, // feb->lug
      { source: 'META_ADS', fromMonth: 2, toMonth: 6 }, // mar->lug
    ],
    excelMonths: [5, 6], // giu, lug — export lead del cliente
  },
  {
    // Ha gia' Google+Meta feb->lug (creati dall'uso live della dashboard). La dedup
    // in questa sessione li salta tutti (non li tocca). Il piano serve dopo un reseed
    // pulito (seed-demo.ts azzera i progetti in cascade): li rigenera cosi' come sono.
    projectName: 'E-commerce Dolce Vita',
    connectors: [
      { source: 'GOOGLE_ADS', fromMonth: 1, toMonth: 6 }, // feb->lug
      { source: 'META_ADS', fromMonth: 1, toMonth: 6 },
    ],
  },
  {
    // Come Dolce Vita: gia' pieno ora (dedup salta), rigenerabile dopo un reseed.
    projectName: 'App corsi UrbanFit',
    connectors: [
      { source: 'GOOGLE_ADS', fromMonth: 1, toMonth: 6 }, // feb->lug
      { source: 'META_ADS', fromMonth: 1, toMonth: 6 },
    ],
  },
];

// Export lead "Excel" a mano (lead-gen: niente ricavo). Chiavi coerenti con
// excel-ingestion.service.ts (leads/conversions/conversionValue/conversionRate/aov + leads_<sorgente>).
const EXCEL_METRICS_BY_MONTH: Record<number, Record<string, number>> = {
  5: { leads: 58, conversions: 21, conversionValue: 0, conversionRate: 0.3621, aov: 0, leads_google: 34, leads_meta: 24 },
  6: { leads: 63, conversions: 26, conversionValue: 0, conversionRate: 0.4127, aov: 0, leads_google: 37, leads_meta: 26 },
};

// --- Piano WEB ANALYTICS ------------------------------------------------------
// Riconosce l'asset per URL (chiave unica per tabella). assetType: website|webapp|ecommerce.
type AssetKind = 'website' | 'webapp' | 'ecommerce';
type AnalyticsMonth = { month: number; sessions: number; users: number; pageViews: number; bounceRate: number; avgLoadTimeMs: number; uptimePercent: number; errorRate: number };
type WebPlan = {
  url: string;
  kind: AssetKind;
  environment: 'DEVELOPMENT' | 'STAGING' | 'PRODUCTION';
  snapshots: AnalyticsMonth[];
  events?: { eventName: string; eventLabel: string; count: number; month: number }[];
  maintenance?: { fromDay: number; durationHours: number; reason: string; status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELED' }[];
};

const A = (month: number, sessions: number, users: number, pageViews: number, bounceRate: number, avgLoadTimeMs: number, uptimePercent: number, errorRate: number): AnalyticsMonth =>
  ({ month, sessions, users, pageViews, bounceRate, avgLoadTimeMs, uptimePercent, errorRate });

const WEB_PLANS: WebPlan[] = [
  {
    url: 'https://rossicostruzioni.it',
    kind: 'website',
    environment: 'PRODUCTION',
    snapshots: [
      A(4, 2140, 1680, 6120, 51.4, 820, 99.95, 0.2), // mag
      A(5, 2380, 1855, 6870, 49.1, 780, 99.98, 0.1), // giu
      A(6, 2610, 2040, 7480, 47.8, 760, 99.97, 0.15), // lug
    ],
    events: [
      { eventName: 'form_submit', eventLabel: 'Richiesta preventivo', count: 34, month: 5 },
      { eventName: 'form_submit', eventLabel: 'Richiesta preventivo', count: 41, month: 6 },
    ],
    maintenance: [
      { fromDay: -40, durationHours: 2, reason: 'Aggiornamento CMS e plugin di sicurezza', status: 'COMPLETED' },
    ],
  },
  {
    url: 'https://levignebb.it',
    kind: 'website',
    environment: 'PRODUCTION',
    snapshots: [
      A(4, 3120, 2510, 9840, 44.2, 690, 99.9, 0.3),
      A(5, 3860, 3080, 12210, 42.7, 670, 99.95, 0.2),
      A(6, 4520, 3610, 14780, 40.9, 650, 99.96, 0.2),
    ],
    events: [
      { eventName: 'booking_started', eventLabel: 'Avvio prenotazione', count: 96, month: 5 },
      { eventName: 'booking_completed', eventLabel: 'Prenotazione completata', count: 38, month: 5 },
      { eventName: 'booking_started', eventLabel: 'Avvio prenotazione', count: 118, month: 6 },
      { eventName: 'booking_completed', eventLabel: 'Prenotazione completata', count: 47, month: 6 },
    ],
  },
  {
    url: 'https://shop.dolcevitatorino.it',
    kind: 'ecommerce',
    environment: 'PRODUCTION',
    snapshots: [
      A(4, 5240, 4180, 18620, 38.6, 720, 99.92, 0.4),
      A(5, 6110, 4870, 22140, 37.2, 700, 99.95, 0.3),
      A(6, 7020, 5590, 25980, 35.9, 690, 99.94, 0.3),
    ],
    events: [
      { eventName: 'add_to_cart', eventLabel: 'Aggiunta al carrello', count: 512, month: 5 },
      { eventName: 'purchase', eventLabel: 'Acquisto', count: 143, month: 5 },
      { eventName: 'add_to_cart', eventLabel: 'Aggiunta al carrello', count: 604, month: 6 },
      { eventName: 'purchase', eventLabel: 'Acquisto', count: 171, month: 6 },
    ],
    maintenance: [
      { fromDay: 12, durationHours: 1, reason: 'Migrazione gateway di pagamento (finestra notturna)', status: 'SCHEDULED' },
    ],
  },
  // Ambienti non di produzione: traffico basso (una sola fotografia recente).
  {
    url: 'https://staging.bassilegal.it',
    kind: 'website',
    environment: 'STAGING',
    snapshots: [A(6, 84, 22, 310, 62.0, 910, 99.0, 0.8)],
  },
  {
    url: 'https://app.urbanfit.club',
    kind: 'webapp',
    environment: 'DEVELOPMENT',
    snapshots: [A(6, 156, 41, 980, 33.5, 540, 98.5, 1.2)],
    events: [{ eventName: 'class_booked', eventLabel: 'Corso prenotato (beta)', count: 73, month: 6 }],
  },
  {
    url: 'https://prenota.farmaciasancarlo.it',
    kind: 'webapp',
    environment: 'STAGING',
    snapshots: [A(6, 62, 18, 214, 58.0, 880, 97.5, 0.9)],
  },
];

// --- Custom field (entita' client) -------------------------------------------
const CUSTOM_FIELD_DEFS = [
  {
    key: 'settore',
    label: 'Settore',
    type: 'select' as const,
    order: 1,
    options: [
      { value: 'edilizia', label: 'Edilizia' },
      { value: 'professionisti', label: 'Professionisti' },
      { value: 'food', label: 'Food' },
      { value: 'ristorazione', label: 'Ristorazione' },
      { value: 'turismo', label: 'Turismo' },
      { value: 'immobiliare', label: 'Immobiliare' },
      { value: 'sanita', label: 'Sanita\'' },
      { value: 'sport', label: 'Sport' },
      { value: 'fotografia', label: 'Fotografia' },
      { value: 'freelance', label: 'Freelance' },
      { value: 'artigiani', label: 'Artigiani' },
      { value: 'altro', label: 'Altro' },
    ],
  },
  {
    // Riusa il campo 'priorita' gia' esistente nel workspace demo (residuo dei test
    // V3 Custom Fields, 9/7/2026, stesse opzioni): l'upsert lo allinea e questo seed
    // resta self-sufficient anche su un DB pulito dove quel campo non c'e'.
    key: 'priorita',
    label: 'Priorita\' cliente',
    type: 'select' as const,
    order: 2,
    options: [
      { value: 'alta', label: 'Alta' },
      { value: 'media', label: 'Media' },
      { value: 'bassa', label: 'Bassa' },
    ],
  },
  { key: 'referente', label: 'Referente', type: 'text' as const, order: 3, options: null },
  {
    key: 'come_ci_ha_trovato',
    label: 'Come ci ha trovato',
    type: 'select' as const,
    order: 4,
    options: [
      { value: 'passaparola', label: 'Passaparola' },
      { value: 'google', label: 'Google' },
      { value: 'social', label: 'Social' },
      { value: 'fiera', label: 'Fiera / Evento' },
      { value: 'cliente_esistente', label: 'Cliente esistente' },
      { value: 'altro', label: 'Altro' },
    ],
  },
  // Riusa il campo booleano 'marketing' gia' esistente (test V3): true = il cliente
  // ha attivita' di marketing/advertising in corso.
  { key: 'marketing', label: 'Marketing attivo', type: 'boolean' as const, order: 5, options: null },
];

// Valori per cliente (riconosciuto per nome). Coerenti con i tag gia' presenti.
// `marketing` = true per i clienti con advertising/marketing attivo (scope ads/reporting).
// Nota: Trattoria Da Beppe aveva gia' priorita='media' dai test V3: si conserva.
const CLIENT_CUSTOM_VALUES: Record<string, Record<string, string | boolean>> = {
  'Rossi Costruzioni SRL': { settore: 'edilizia', priorita: 'alta', referente: 'Geom. Paolo Rossi', come_ci_ha_trovato: 'passaparola', marketing: false },
  'Studio Legale Bassi & Partner': { settore: 'professionisti', priorita: 'media', referente: 'Avv. Bassi', come_ci_ha_trovato: 'google', marketing: false },
  'Pasticceria Dolce Vita': { settore: 'food', priorita: 'alta', referente: 'Lucia Esposito', come_ci_ha_trovato: 'social', marketing: true },
  'Martina Galli': { settore: 'freelance', priorita: 'bassa', referente: 'Martina Galli', come_ci_ha_trovato: 'social', marketing: false },
  'Officina Meccanica F.lli Serra': { settore: 'artigiani', priorita: 'bassa', referente: 'Sig. Serra', come_ci_ha_trovato: 'passaparola', marketing: false },
  'B&B Le Vigne': { settore: 'turismo', priorita: 'media', referente: 'Elena', come_ci_ha_trovato: 'google', marketing: false },
  'Paolo Ricci': { settore: 'altro', priorita: 'bassa', referente: 'Paolo Ricci', come_ci_ha_trovato: 'passaparola', marketing: false },
  'Farmacia San Carlo': { settore: 'sanita', priorita: 'media', referente: 'Dott. Carlo', come_ci_ha_trovato: 'passaparola', marketing: false },
  'Immobiliare Piemonte Casa': { settore: 'immobiliare', priorita: 'alta', referente: 'Ing. Marco Ferrero', come_ci_ha_trovato: 'google', marketing: true },
  'Anna Fontana': { settore: 'fotografia', priorita: 'media', referente: 'Anna Fontana', come_ci_ha_trovato: 'social', marketing: false },
  'Palestra UrbanFit': { settore: 'sport', priorita: 'alta', referente: 'Direzione UrbanFit', come_ci_ha_trovato: 'social', marketing: true },
  'Trattoria Da Beppe': { settore: 'ristorazione', priorita: 'media', referente: 'Beppe', come_ci_ha_trovato: 'passaparola', marketing: false },
};

// --- utilita' mesi ------------------------------------------------------------
const YEAR = 2026;
// periodStart = primo del mese (UTC, mezzanotte); periodEnd = ultimo del mese.
const monthStart = (monthIndex: number): Date => new Date(Date.UTC(YEAR, monthIndex, 1));
const monthEnd = (monthIndex: number): Date => new Date(Date.UTC(YEAR, monthIndex + 1, 0));
const daysFromNow = (days: number): Date => new Date(Date.now() + days * 24 * 60 * 60 * 1000);

async function main() {
  const workspace = await prisma.workspace.findUnique({ where: { slug: WORKSPACE_SLUG }, select: { id: true } });
  if (!workspace) {
    throw new Error(`Workspace "${WORKSPACE_SLUG}" non trovato: eseguire prima \`npm run db:seed\`.`);
  }
  const workspaceId = workspace.id;

  const admin = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL }, select: { id: true } });
  if (!admin) {
    throw new Error(`Utente ${ADMIN_EMAIL} non trovato: eseguire prima \`npm run db:seed\`.`);
  }
  const adminId = admin.id;

  // Indicizzatore fonti (best effort), come in seed-demo-agency.ts: import dinamico
  // dopo aver inizializzato il singleton Prisma dell'app.
  let indexSourceBestEffort:
    | ((s: { workspaceId: string; projectId: string; id: string; content: string; status: string }, opts?: { logger?: { warn: (m: string) => void } }) => Promise<{ indexed: boolean; chunks?: number; reason?: string }>)
    | null = null;
  try {
    const { initializePrisma } = await import('../server/prisma.js');
    initializePrisma(process.env.DATABASE_URL ?? '');
    ({ indexSourceBestEffort } = await import('../server/modules/sources/sources.indexing.js'));
  } catch (error) {
    console.warn(`Indicizzatore non caricato (${(error as Error).message}); le fonti verranno create ma NON indicizzate.`);
  }

  // 1) Tipi progetto (solo quelli usati). Upsert per (workspaceId, key).
  const typeIdByKey = new Map<string, string>();
  const usedTypeKeys = Array.from(new Set(PROJECTS.map((p) => p.typeKey)));
  for (const key of usedTypeKeys) {
    const def = PROJECT_TYPE_CATALOG[key];
    const row = await prisma.projectType.upsert({
      where: { workspaceId_key: { workspaceId, key } },
      update: { label: def.label, description: def.description },
      create: { workspaceId, key, label: def.label, description: def.description },
      select: { id: true },
    });
    typeIdByKey.set(key, row.id);
  }

  // 2) Per ogni progetto: tipo + scope + goal + stato; poi ProjectMemory
  //    (sourcesJson valorizzato, Discovery azzerata); poi fonti V4 sui 4 vuoti.
  let totFonti = 0;
  let totChunk = 0;
  const projectIdByName = new Map<string, string>();
  const saltati: string[] = [];

  for (const entry of PROJECTS) {
    const project = await prisma.project.findFirst({
      where: { workspaceId, name: entry.name },
      select: { id: true },
    });
    if (!project) {
      saltati.push(entry.name);
      continue;
    }
    projectIdByName.set(entry.name, project.id);

    await prisma.project.update({
      where: { id: project.id },
      data: {
        projectTypeId: typeIdByKey.get(entry.typeKey) ?? null,
        scopePurchased: FULL_SCOPE(entry.scope),
        goal: entry.goal,
        statusAgency: entry.status,
      },
    });

    // ProjectMemory: fonti legacy popolate; Discovery e tutti gli output AI azzerati.
    const sourcesJson = buildSourcesJson(entry.legacy);
    await prisma.projectMemory.upsert({
      where: { projectId: project.id },
      update: {
        sourcesJson,
        briefJson: Prisma.JsonNull,
        contextSummary: null,
        webJson: Prisma.JsonNull,
        adsJson: Prisma.JsonNull,
        reportsJson: Prisma.JsonNull,
        diagnosisJson: Prisma.JsonNull,
      },
      create: {
        workspaceId,
        projectId: project.id,
        sourcesJson,
        briefJson: Prisma.JsonNull,
        contextSummary: null,
      },
    });

    // Fonti V4 solo per i progetti "vuoti" (i 5 coperti da seed-demo-agency le hanno gia').
    if (entry.fonti) {
      await prisma.projectSource.deleteMany({ where: { projectId: project.id } });
      for (const src of entry.fonti) {
        const content = src.content.trim();
        const created = await prisma.projectSource.create({
          data: {
            workspaceId,
            projectId: project.id,
            type: 'text',
            title: src.title,
            content,
            contentChars: content.length,
            status: 'ready',
          },
          select: { id: true },
        });
        totFonti += 1;
        if (indexSourceBestEffort) {
          const outcome = await indexSourceBestEffort(
            { workspaceId, projectId: project.id, id: created.id, content, status: 'ready' },
            { logger: { warn: (msg: string) => console.warn(`    ! ${msg}`) } },
          );
          if (outcome.indexed) {
            totChunk += outcome.chunks ?? 0;
          } else {
            console.warn(`  - "${entry.name}" / "${src.title}": non indicizzata (${outcome.reason}).`);
          }
        }
      }
    }

    console.log(`OK progetto: ${entry.name} (tipo ${entry.typeKey}, stato ${entry.status}) — Discovery azzerata`);
  }

  // 3) Performance (simulata), NON distruttivo: si saltano i mesi gia' presenti
  //    per (workspaceId, projectId, source).
  let totPerf = 0;
  let perfSkipped = 0;
  for (const plan of PERFORMANCE_PLANS) {
    const projectId = projectIdByName.get(plan.projectName);
    if (!projectId) {
      continue; // progetto saltato sopra
    }

    for (const conn of plan.connectors) {
      const months: number[] = [];
      for (let m = conn.fromMonth; m <= conn.toMonth; m += 1) {
        months.push(m);
      }
      const periodStarts = months.map(monthStart);
      const existing = await prisma.performanceSnapshot.findMany({
        where: { workspaceId, projectId, source: conn.source, periodStart: { in: periodStarts } },
        select: { periodStart: true },
        distinct: ['periodStart'],
      });
      const existingKeys = new Set(existing.map((r) => r.periodStart.getTime()));

      for (const m of months) {
        const periodStart = monthStart(m);
        if (existingKeys.has(periodStart.getTime())) {
          perfSkipped += 1;
          continue;
        }
        const periodEnd = monthEnd(m);
        const { metrics, sourceLabel } = getConnector(conn.source).fetchMetrics({ projectId, periodStart, periodEnd });
        await prisma.performanceSnapshot.create({
          data: {
            workspaceId,
            projectId,
            source: conn.source,
            sourceLabel,
            scopeLevel: 'ACCOUNT',
            periodStart,
            periodEnd,
            metrics,
            campaignRefs: [],
            contextEvent: null,
            tags: ['demo', 'simulato'],
            createdByUserId: adminId,
          },
        });
        totPerf += 1;
      }
    }

    // Sorgente EXCEL (export lead a mano), se prevista.
    for (const m of plan.excelMonths ?? []) {
      const excelMetrics = EXCEL_METRICS_BY_MONTH[m];
      if (!excelMetrics) {
        continue;
      }
      const periodStart = monthStart(m);
      const already = await prisma.performanceSnapshot.findFirst({
        where: { workspaceId, projectId, source: 'EXCEL', periodStart },
        select: { id: true },
      });
      if (already) {
        perfSkipped += 1;
        continue;
      }
      await prisma.performanceSnapshot.create({
        data: {
          workspaceId,
          projectId,
          source: 'EXCEL',
          sourceLabel: 'Export lead cliente (Excel)',
          scopeLevel: 'ACCOUNT',
          periodStart,
          periodEnd: monthEnd(m),
          metrics: excelMetrics,
          campaignRefs: [],
          contextEvent: null,
          tags: ['demo', 'excel'],
          createdByUserId: adminId,
        },
      });
      totPerf += 1;
    }
  }

  // 4) Web asset: analytics snapshot + eventi + finestre di manutenzione.
  //    Idempotenza: si cancella solo cio' che crea questo seed (provider GA / eventi
  //    demo / manutenzione con marcatore), poi si ricrea.
  let totSnap = 0;
  let totEvt = 0;
  let totMaint = 0;
  const MAINT_MARK = '[demo] ';
  for (const plan of WEB_PLANS) {
    // Lookup per URL sulla tabella specifica (chiave unica per tabella). Switch
    // esplicito: evita accessi dinamici a `prisma[...]` e resta tipizzato.
    const found =
      plan.kind === 'website'
        ? await prisma.websiteAsset.findFirst({ where: { workspaceId, url: plan.url }, select: { id: true } })
        : plan.kind === 'webapp'
          ? await prisma.webAppAsset.findFirst({ where: { workspaceId, url: plan.url }, select: { id: true } })
          : await prisma.ecommerceAsset.findFirst({ where: { workspaceId, url: plan.url }, select: { id: true } });
    if (!found) {
      continue; // asset non presente (seed-demo non eseguito?): si salta
    }
    const assetType = plan.kind;
    const assetId = found.id;

    await prisma.webAssetAnalyticsSnapshot.deleteMany({ where: { workspaceId, assetType, assetId, provider: 'google_analytics' } });
    for (const s of plan.snapshots) {
      await prisma.webAssetAnalyticsSnapshot.create({
        data: {
          workspaceId,
          assetType,
          assetId,
          environment: plan.environment,
          provider: 'google_analytics',
          sourceLabel: 'Google Analytics (demo)',
          periodStart: monthStart(s.month),
          periodEnd: monthEnd(s.month),
          sessions: s.sessions,
          users: s.users,
          pageViews: s.pageViews,
          bounceRate: s.bounceRate,
          avgLoadTimeMs: s.avgLoadTimeMs,
          uptimePercent: s.uptimePercent,
          errorRate: s.errorRate,
          createdByUserId: adminId,
        },
      });
      totSnap += 1;
    }

    const eventNames = Array.from(new Set((plan.events ?? []).map((e) => e.eventName)));
    if (eventNames.length) {
      await prisma.webAssetAnalyticsEvent.deleteMany({ where: { workspaceId, assetType, assetId, eventName: { in: eventNames } } });
    }
    for (const e of plan.events ?? []) {
      await prisma.webAssetAnalyticsEvent.create({
        data: {
          workspaceId,
          assetType,
          assetId,
          environment: plan.environment,
          eventName: e.eventName,
          eventLabel: e.eventLabel,
          count: e.count,
          occurredAt: monthEnd(e.month),
          createdByUserId: adminId,
        },
      });
      totEvt += 1;
    }

    await prisma.webAssetMaintenanceWindow.deleteMany({ where: { workspaceId, assetType, assetId, reason: { startsWith: MAINT_MARK } } });
    for (const w of plan.maintenance ?? []) {
      const startsAt = daysFromNow(w.fromDay);
      startsAt.setHours(2, 0, 0, 0);
      await prisma.webAssetMaintenanceWindow.create({
        data: {
          workspaceId,
          assetType,
          assetId,
          startsAt,
          endsAt: new Date(startsAt.getTime() + w.durationHours * 60 * 60 * 1000),
          timezone: 'Europe/Rome',
          reason: `${MAINT_MARK}${w.reason}`,
          status: w.status,
          createdByUserId: adminId,
        },
      });
      totMaint += 1;
    }
  }

  // 5) Custom field: definizioni (entita' client) + valori sui clienti.
  for (const def of CUSTOM_FIELD_DEFS) {
    await prisma.customFieldDefinition.upsert({
      where: { workspaceId_entity_key: { workspaceId, entity: 'client', key: def.key } },
      update: { label: def.label, type: def.type, options: def.options ?? Prisma.JsonNull, order: def.order, active: true },
      create: { workspaceId, entity: 'client', key: def.key, label: def.label, type: def.type, options: def.options ?? Prisma.JsonNull, order: def.order },
    });
  }

  let totClienti = 0;
  for (const [clientName, values] of Object.entries(CLIENT_CUSTOM_VALUES)) {
    const client = await prisma.client.findFirst({ where: { workspaceId, name: clientName }, select: { id: true, customFields: true } });
    if (!client) {
      continue;
    }
    const current = (client.customFields && typeof client.customFields === 'object' && !Array.isArray(client.customFields))
      ? (client.customFields as Record<string, unknown>)
      : {};
    await prisma.client.update({
      where: { id: client.id },
      data: { customFields: { ...current, ...values } as Prisma.InputJsonObject },
    });
    totClienti += 1;
  }

  // --- Resoconto ---
  console.log('\nArricchimento demo completato');
  console.log(`Progetti arricchiti: ${projectIdByName.size}/${PROJECTS.length}`);
  console.log(`Fonti V4 create (progetti vuoti): ${totFonti} — chunk indicizzati: ${totChunk}`);
  console.log(`Performance snapshot creati: ${totPerf} (saltati perche' gia' presenti: ${perfSkipped})`);
  console.log(`Web analytics: ${totSnap} snapshot, ${totEvt} eventi, ${totMaint} finestre manutenzione`);
  console.log(`Custom field: ${CUSTOM_FIELD_DEFS.length} definizioni, valori su ${totClienti} clienti`);
  if (!indexSourceBestEffort) {
    console.log('! Indicizzazione saltata (indicizzatore non caricato): reindicizza dal pannello Fonti.');
  } else if (totFonti > 0 && totChunk === 0) {
    console.log("! 0 chunk generati: la chiave OpenAI del workspace non e' stata risolta? Verifica Impostazioni Agency.");
  }
  if (saltati.length) {
    console.log(`Progetti non trovati (saltati): ${saltati.join(', ')}`);
  }
}

main()
  .then(async () => {
    await prisma.$disconnect().catch(() => {});
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('Arricchimento demo fallito', error);
    await prisma.$disconnect().catch(() => {});
    process.exit(1);
  });
