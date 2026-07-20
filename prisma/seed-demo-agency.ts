import { readFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';

/**
 * Seed DEMO — AGENCY / AI (Fonti indicizzate per il RAG + Discovery).
 *
 * Colma il buco lasciato di proposito da `seed-demo.ts` (che NON tocca Agency-OS):
 * aggiunge a un gruppo di progetti demo delle FONTI testuali realistiche, le
 * INDICIZZA (chunk + embedding pgvector) e popola la DISCOVERY (ProjectMemory).
 * Serve ad avere materiale vero per testare chat AI "grounded", RAG, allegati,
 * Discovery, senza caricare nulla a mano.
 *
 * Ordine: `npm run db:seed` -> `npm run db:seed:demo` -> `npm run db:seed:demo:agency`.
 * Ripetibile: per i progetti target rigenera le Fonti (cancella+ricrea+reindicizza)
 * e fa l'upsert della Discovery.
 *
 * L'INDICIZZAZIONE (embedding) usa la chiave OpenAI del workspace (quella salvata in
 * Impostazioni Agency, cifrata): la risolve `indexSourceBestEffort` come fa l'app. Se
 * la chiave non c'e', le fonti restano con 0 chunk (nessun errore) e si potranno
 * reindicizzare dopo dal pannello Fonti.
 */

// Carica .env (DATABASE_URL + ENCRYPTION_KEY + eventuale OPENAI_API_KEY) in process.env
// se non gia' presenti: l'indicizzazione decifra il segreto AI del workspace con
// ENCRYPTION_KEY, quindi qui deve essere disponibile (a differenza degli altri seed,
// che usano solo DATABASE_URL).
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

type DemoAgencyEntry = {
  project: string; // nome ESATTO del progetto demo (creato da seed-demo.ts)
  sources: { title: string; content: string }[];
  discovery: { businessContext: string; projectGoal: string; target: string; offer: string };
  contextSummary: string;
};

// Contenuti verosimili e con FATTI SPECIFICI verificabili (nomi, prezzi, obiettivi),
// cosi' le domande di collaudo "dentro le fonti" hanno risposte controllabili.
const DEMO_AGENCY: DemoAgencyEntry[] = [
  {
    project: 'Portfolio fotografico Anna Fontana',
    sources: [
      {
        title: 'Profilo e attività della cliente',
        content:
          'Anna Fontana è una fotografa professionista specializzata in ritratti e reportage di matrimonio. Ha aperto il suo studio a Torino nel 2016 e lavora in tutto il Piemonte. Il suo stile è naturale e documentaristico, con predilezione per la luce ambientale e ritocchi minimi. Oltre ai privati, collabora con piccole aziende per foto di team e ambienti di lavoro. Finora si è fatta conoscere quasi esclusivamente tramite Instagram e il passaparola.',
      },
      {
        title: 'Obiettivi del progetto',
        content:
          'Il progetto prevede un nuovo sito portfolio che sostituisca Instagram come vetrina principale. Deve avere gallerie divise per categoria (ritratti, matrimoni, eventi aziendali), una pagina "chi sono" e un modulo di contatto per richiedere un preventivo. L\'obiettivo dichiarato dalla cliente è aumentare del 30% le richieste per i servizi di matrimonio entro un anno dalla pubblicazione.',
      },
      {
        title: 'Offerta e pacchetti',
        content:
          'I pacchetti fotografici di Anna Fontana sono tre: "Ritratto" a partire da 150 euro per una sessione in studio o all\'aperto; "Matrimonio" da 1200 euro con copertura dell\'intera giornata e album stampato; "Shooting Aziendale" su preventivo, per foto di team e ambienti. La consegna delle foto avviene entro tre settimane dallo shooting.',
      },
    ],
    discovery: {
      businessContext:
        'Fotografa professionista di ritratti e matrimoni, studio a Torino dal 2016, operativa in Piemonte. Notorietà finora costruita su Instagram e passaparola.',
      projectGoal:
        'Realizzare un sito portfolio che sostituisca Instagram come vetrina, con gallerie per categoria e richiesta preventivo. Target di crescita: +30% richieste matrimoni in un anno.',
      target:
        'Coppie tra i 28 e i 40 anni in Piemonte in procinto di sposarsi, più piccole e medie imprese locali per foto aziendali.',
      offer:
        'Pacchetto Ritratto da 150€, Matrimonio da 1200€ con album, Shooting Aziendale su preventivo. Consegna entro 3 settimane.',
    },
    contextSummary:
      'Progetto sito portfolio per Anna Fontana, fotografa di ritratti e matrimoni a Torino (dal 2016). Obiettivo: vetrina web al posto di Instagram + richieste preventivo, puntando a +30% di matrimoni. Pacchetti: Ritratto da 150€, Matrimonio da 1200€, Aziendale su preventivo.',
  },
  {
    project: 'E-commerce Dolce Vita',
    sources: [
      {
        title: 'Profilo e attività del cliente',
        content:
          'Dolce Vita è una pasticceria artigianale di Napoli attiva dal 1998, specializzata in dolci della tradizione partenopea: sfogliatelle, babà e pastiere. Produce tutto a mano ogni giorno e finora vende esclusivamente nel punto vendita fisico in centro città. La titolare vuole aprirsi alla vendita a distanza mantenendo la qualità artigianale.',
      },
      {
        title: 'Obiettivi del progetto',
        content:
          'Il progetto è un e-commerce per vendere i dolci in tutta Italia con spedizione refrigerata. Serve un catalogo prodotti con foto, un carrello, il calcolo delle spese di spedizione e la gestione degli ordini. L\'obiettivo è aprire un canale di vendita online e raggiungere soprattutto i napoletani che vivono fuori sede.',
      },
      {
        title: 'Catalogo e condizioni',
        content:
          'Prodotti principali: sfogliatella riccia in confezione da 6 pezzi a 18 euro, babà al rum in vasetto a 12 euro, pastiera napoletana formato famiglia a 28 euro. La spedizione avviene in 24-48 ore con corriere refrigerato. L\'ordine minimo è di 25 euro.',
      },
    ],
    discovery: {
      businessContext:
        'Pasticceria artigianale napoletana attiva dal 1998, dolci tradizionali fatti a mano, vendita finora solo nel punto vendita fisico.',
      projectGoal:
        'Aprire un e-commerce con spedizione refrigerata in tutta Italia: catalogo, carrello, spese di spedizione, gestione ordini.',
      target:
        'Napoletani fuori sede e appassionati di pasticceria tradizionale in tutta Italia.',
      offer:
        'Sfogliatella (6 pz) 18€, babà al rum 12€, pastiera famiglia 28€. Spedizione refrigerata 24-48h, ordine minimo 25€.',
    },
    contextSummary:
      'E-commerce per Dolce Vita, pasticceria artigianale napoletana (dal 1998). Obiettivo: vendere online in tutta Italia con spedizione refrigerata. Prodotti chiave: sfogliatella (6 pz) 18€, babà 12€, pastiera 28€; ordine minimo 25€.',
  },
  {
    project: 'Sito corporate Rossi Costruzioni',
    sources: [
      {
        title: 'Profilo e attività del cliente',
        content:
          'Rossi Costruzioni è un\'impresa edile di Bergamo con oltre 40 dipendenti, attiva da tre generazioni nell\'edilizia residenziale e nelle ristrutturazioni. Lavora principalmente per clienti privati e piccoli condomini, con un forte accento su affidabilità e rispetto dei tempi.',
      },
      {
        title: 'Obiettivi del progetto',
        content:
          'Il progetto è un sito corporate istituzionale, pensato per dare credibilità all\'impresa e raccogliere richieste di preventivo. Deve mostrare i cantieri realizzati con confronto prima/dopo, le certificazioni ottenute e una pagina contatti con modulo. Non è un e-commerce: l\'obiettivo è la generazione di contatti qualificati.',
      },
    ],
    discovery: {
      businessContext:
        'Impresa edile storica di Bergamo (tre generazioni, oltre 40 dipendenti), edilizia residenziale e ristrutturazioni per privati e condomini.',
      projectGoal:
        'Sito corporate istituzionale per credibilità e generazione contatti: portfolio cantieri prima/dopo, certificazioni, contatti con form. Non e-commerce.',
      target:
        'Proprietari di casa e amministratori di piccoli condomini in provincia di Bergamo interessati a ristrutturazioni.',
      offer:
        'Costruzioni residenziali e ristrutturazioni chiavi in mano, preventivo su richiesta.',
    },
    contextSummary:
      'Sito corporate per Rossi Costruzioni, impresa edile di Bergamo (tre generazioni, 40+ dipendenti). Obiettivo: credibilità e richieste di preventivo tramite portfolio cantieri prima/dopo e certificazioni. Non è un e-commerce.',
  },
  {
    project: 'App corsi UrbanFit',
    sources: [
      {
        title: 'Profilo e attività del cliente',
        content:
          'UrbanFit è una catena di tre palestre a Milano focalizzata sui corsi di gruppo: functional training, spinning e yoga. Conta circa 1500 iscritti. Oggi le prenotazioni ai corsi si gestiscono per telefono o in reception, con frequenti sovrapposizioni e posti sprecati per le mancate disdette.',
      },
      {
        title: 'Obiettivi del progetto',
        content:
          'Il progetto è un\'app mobile per prenotare i corsi, consultare il calendario delle lezioni e gestire il proprio abbonamento. Servono login utente, calendario delle prenotazioni con posti limitati e notifiche promemoria. L\'obiettivo è ridurre le telefonate in reception e abbattere i no-show (le assenze senza disdetta).',
      },
    ],
    discovery: {
      businessContext:
        'Catena di tre palestre a Milano (~1500 iscritti) incentrata sui corsi di gruppo: functional, spinning, yoga. Prenotazioni oggi via telefono/reception.',
      projectGoal:
        'App per prenotare i corsi, vedere il calendario e gestire l\'abbonamento, con login, posti limitati e notifiche. Obiettivo: meno telefonate e meno no-show.',
      target:
        'Iscritti alle palestre UrbanFit a Milano, prevalentemente 25-45 anni, abituati a prenotare i corsi di gruppo.',
      offer:
        'Abbonamenti mensili e annuali con accesso ai corsi di gruppo nelle tre sedi.',
    },
    contextSummary:
      'App di prenotazione corsi per UrbanFit, catena di 3 palestre a Milano (~1500 iscritti, corsi di gruppo). Obiettivo: prenotazioni con posti limitati + promemoria per ridurre telefonate e no-show.',
  },
  {
    project: 'Sito studio Bassi & Partner',
    sources: [
      {
        title: 'Profilo e attività del cliente',
        content:
          'Bassi & Partner è uno studio di commercialisti di Verona con cinque professionisti, specializzato nella consulenza fiscale per PMI e partite IVA. Lo studio cura contabilità, dichiarazioni dei redditi e consulenza fiscale e societaria, con un approccio molto orientato alle piccole imprese del territorio.',
      },
      {
        title: 'Obiettivi del progetto',
        content:
          'Il progetto è un sito professionale che presenti i servizi (contabilità, dichiarazioni, consulenza) e generi contatti qualificati. Deve avere una sezione blog per articoli fiscali di aggiornamento e un modulo per richiedere una prima consulenza gratuita. L\'obiettivo è posizionarsi come studio di riferimento per le PMI veronesi.',
      },
    ],
    discovery: {
      businessContext:
        'Studio di commercialisti a Verona (5 professionisti), consulenza fiscale per PMI e partite IVA: contabilità, dichiarazioni, consulenza societaria.',
      projectGoal:
        'Sito professionale per presentare i servizi e generare contatti qualificati, con blog fiscale e modulo di prima consulenza gratuita.',
      target:
        'Piccole e medie imprese e partite IVA della provincia di Verona in cerca di un commercialista.',
      offer:
        'Contabilità, dichiarazioni dei redditi, consulenza fiscale e societaria; prima consulenza gratuita.',
    },
    contextSummary:
      'Sito professionale per Bassi & Partner, studio di commercialisti di Verona (5 professionisti) specializzato in PMI e partite IVA. Obiettivo: presentare i servizi, blog fiscale e lead da prima consulenza gratuita.',
  },
];

async function main() {
  const workspace = await prisma.workspace.findUnique({ where: { slug: 'demo' } });
  if (!workspace) {
    throw new Error('Workspace "demo" non trovato: eseguire prima `npm run db:seed`.');
  }

  // Indicizzatore ufficiale del progetto (chunk + embedding con la chiave del workspace).
  // Import DINAMICO in try/catch: tira il motore agency solo qui, e isola eventuali
  // problemi di caricamento senza far fallire tutta la creazione dei dati.
  let indexSourceBestEffort:
    | ((s: { workspaceId: string; projectId: string; id: string; content: string; status: string }, opts?: { logger?: { warn: (m: string) => void } }) => Promise<{ indexed: boolean; chunks?: number; reason?: string }>)
    | null = null;
  try {
    // Il progetto NON auto-inizializza il Prisma singleton (vedi server/prisma.ts): va
    // fatto esplicitamente come in server/index.ts, altrimenti resolveAgencyOpenAiApiKey
    // e reindexSource falliscono con "Prisma client is not initialized".
    const { initializePrisma } = await import('../server/prisma.js');
    initializePrisma(process.env.DATABASE_URL ?? '');
    ({ indexSourceBestEffort } = await import('../server/modules/sources/sources.indexing.js'));
  } catch (error) {
    console.warn(`Indicizzatore non caricato (${(error as Error).message}); le fonti verranno create ma NON indicizzate.`);
  }

  let totFonti = 0;
  let totChunk = 0;
  let totDiscovery = 0;
  let progettiOk = 0;
  const saltati: string[] = [];

  for (const entry of DEMO_AGENCY) {
    const project = await prisma.project.findFirst({
      where: { workspaceId: workspace.id, name: entry.project },
      select: { id: true },
    });
    if (!project) {
      saltati.push(entry.project);
      continue;
    }
    progettiOk += 1;

    // Fonti: rigenerazione pulita. Questi progetti sono demo e non hanno fonti reali,
    // quindi si cancellano tutte le fonti del progetto (i chunk cadono in cascade) e
    // si ricreano — cosi' il seed resta ripetibile.
    await prisma.projectSource.deleteMany({ where: { projectId: project.id } });

    for (const src of entry.sources) {
      const content = src.content.trim();
      const created = await prisma.projectSource.create({
        data: {
          workspaceId: workspace.id,
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
          {
            workspaceId: workspace.id,
            projectId: project.id,
            id: created.id,
            content,
            status: 'ready',
          },
          { logger: { warn: (msg: string) => console.warn(`    ⚠ ${msg}`) } },
        );
        if (outcome.indexed) {
          totChunk += outcome.chunks ?? 0;
        } else {
          console.warn(`  · "${entry.project}" / "${src.title}": non indicizzata (${outcome.reason}).`);
        }
      }
    }

    // Discovery (ProjectMemory): brief strutturato + sintesi di contesto.
    const briefJson = {
      ...entry.discovery,
      brandCommunication: '',
      availableMaterials: '',
      technicalAspects: '',
      marketingAcquisition: '',
      notes: '',
    };
    await prisma.projectMemory.upsert({
      where: { projectId: project.id },
      update: { briefJson, contextSummary: entry.contextSummary },
      create: { workspaceId: workspace.id, projectId: project.id, briefJson, contextSummary: entry.contextSummary },
    });
    totDiscovery += 1;
    console.log(`✓ ${entry.project} — ${entry.sources.length} fonti + Discovery`);
  }

  console.log('\nSeed demo Agency/AI completato');
  console.log(`Progetti aggiornati: ${progettiOk}/${DEMO_AGENCY.length}`);
  console.log(`Fonti create: ${totFonti} — chunk indicizzati (RAG): ${totChunk}`);
  console.log(`Discovery (ProjectMemory): ${totDiscovery}`);
  if (!indexSourceBestEffort) {
    console.log('⚠ Indicizzazione saltata (indicizzatore non caricato): reindicizza dal pannello Fonti.');
  } else if (totFonti > 0 && totChunk === 0) {
    console.log('⚠ 0 chunk generati: la chiave OpenAI del workspace non è stata risolta? Verifica Impostazioni Agency.');
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
    console.error('Seed demo Agency fallito', error);
    await prisma.$disconnect().catch(() => {});
    process.exit(1);
  });
