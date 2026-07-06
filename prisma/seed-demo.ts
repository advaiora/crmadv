import { createHash, randomUUID } from 'node:crypto';
import { PrismaClient, Prisma } from '@prisma/client';
import bcrypt from 'bcrypt';
import { SYSTEM_ROLE_NAME } from '../server/auth/rbac-catalog.js';

/**
 * Seed DEMO — dati verosimili per valutare e testare le pagine con contenuti
 * reali (Clienti, Preventivi, Team, Template). NON tocca la struttura di base
 * (utenti admin, ruoli, moduli): quella la crea `prisma/seed.ts`, che va
 * eseguito PRIMA (`npm run db:seed`).
 *
 * Uso: `npm run db:seed:demo` — ripetibile: al secondo lancio aggiorna i
 * clienti/membri demo (riconosciuti per nome/email) e ricrea da zero i
 * preventivi demo (riconosciuti dal marcatore in `internalNotes`).
 */

const prisma = new PrismaClient();

const DEMO_MARKER = 'seed-demo';
const IVA = 0.22;

const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);
const daysFromNow = (days: number) => new Date(Date.now() + days * 24 * 60 * 60 * 1000);

// --- Team ------------------------------------------------------------------

const DEMO_MEMBERS = [
  { email: 'giulia.ferrari@demo.local', name: 'Giulia Ferrari', role: SYSTEM_ROLE_NAME.admin, status: 'ACTIVE' },
  { email: 'marco.russo@demo.local', name: 'Marco Russo', role: SYSTEM_ROLE_NAME.manager, status: 'ACTIVE' },
  { email: 'sara.colombo@demo.local', name: 'Sara Colombo', role: SYSTEM_ROLE_NAME.operativo, status: 'ACTIVE' },
  { email: 'luca.esposito@demo.local', name: 'Luca Esposito', role: SYSTEM_ROLE_NAME.operativo, status: 'ACTIVE' },
  { email: 'elena.bianchi@demo.local', name: 'Elena Bianchi', role: SYSTEM_ROLE_NAME.viewer, status: 'ACTIVE' },
  { email: 'davide.romano@demo.local', name: 'Davide Romano', role: SYSTEM_ROLE_NAME.operativo, status: 'INACTIVE' },
] as const;

const DEMO_INVITES = [
  { email: 'chiara.greco@example.com', role: SYSTEM_ROLE_NAME.operativo, expiresInDays: 7 },
  { email: 'andrea.marino@example.com', role: SYSTEM_ROLE_NAME.viewer, expiresInDays: -2 }, // scaduto
] as const;

// --- Clienti -----------------------------------------------------------------

const DEMO_CLIENTS = [
  { name: 'Rossi Costruzioni SRL', type: 'company', email: 'info@rossicostruzioni.it', phone: '+39 011 5566771', city: 'Torino', vatNumber: 'IT01234567890', tags: ['Edilizia', 'Cliente storico'] },
  { name: 'Studio Legale Bassi & Partner', type: 'company', email: 'segreteria@bassilegal.it', phone: '+39 02 87654321', city: 'Milano', vatNumber: 'IT09876543210', tags: ['Professionisti'] },
  { name: 'Pasticceria Dolce Vita', type: 'company', email: 'ordini@dolcevitatorino.it', phone: '+39 011 2233445', city: 'Torino', tags: ['Food', 'E-commerce'] },
  { name: 'Martina Galli', type: 'person', email: 'martina.galli@gmail.com', phone: '+39 347 1122334', city: 'Asti', tags: ['Freelance'] },
  { name: 'Officina Meccanica F.lli Serra', type: 'company', email: 'info@officinaserra.it', phone: '+39 0141 998877', city: 'Alessandria', vatNumber: 'IT11223344556', tags: ['Artigiani'] },
  { name: 'B&B Le Vigne', type: 'company', email: 'prenotazioni@levignebb.it', city: 'Alba', tags: ['Turismo', 'Booking'] },
  { name: 'Paolo Ricci', type: 'person', email: 'paolo.ricci@outlook.it', phone: '+39 333 9988776', city: 'Cuneo', tags: [] },
  { name: 'Farmacia San Carlo', type: 'company', email: 'farmacia.sancarlo@pec.it', phone: '+39 011 4455667', city: 'Torino', vatNumber: 'IT66554433221', tags: ['Sanità'] },
  { name: 'Immobiliare Piemonte Casa', type: 'company', email: 'agenzia@piemontecasa.it', phone: '+39 011 7788990', city: 'Torino', tags: ['Immobiliare', 'Lead generation'] },
  { name: 'Anna Fontana', type: 'person', email: 'anna.fontana@libero.it', city: 'Novara', tags: ['Freelance', 'Fotografia'] },
  { name: 'Palestra UrbanFit', type: 'company', email: 'info@urbanfit.club', phone: '+39 02 3344556', city: 'Milano', tags: ['Sport', 'Abbonamenti'] },
  { name: 'Trattoria Da Beppe', type: 'company', phone: '+39 0173 556677', city: 'Bra', tags: ['Food'] },
] as const;

// --- Template preventivi ------------------------------------------------------

const DEMO_QUOTE_TEMPLATES = [
  {
    name: 'Sito Vetrina Base',
    description: 'Pacchetto standard per siti vetrina fino a 5 pagine.',
    defaultNotes: 'Consegna prevista in 4 settimane dalla conferma. Sono incluse due sessioni di revisione.',
    items: [
      { title: 'Design e prototipo', description: 'Wireframe e design responsive', quantity: 1, unitPrice: 900 },
      { title: 'Sviluppo sito (fino a 5 pagine)', quantity: 1, unitPrice: 1600 },
      { title: 'Configurazione hosting e dominio', quantity: 1, unitPrice: 250 },
    ],
  },
  {
    name: 'Gestione Social Mensile',
    description: 'Piano editoriale e gestione profili social.',
    defaultNotes: 'Canone mensile, rinnovo tacito salvo disdetta con 30 giorni di preavviso.',
    items: [
      { title: 'Piano editoriale mensile', quantity: 1, unitPrice: 350 },
      { title: 'Creazione contenuti (8 post)', quantity: 8, unitPrice: 45 },
      { title: 'Report mensile risultati', quantity: 1, unitPrice: 120 },
    ],
  },
] as const;

// --- Preventivi ----------------------------------------------------------------

type DemoQuoteItem = {
  title: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  discountPercent?: number;
};

type DemoQuote = {
  clientName: string;
  status: 'DRAFT' | 'SENT' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED';
  createdDaysAgo: number;
  validDays: number; // rispetto alla data di emissione
  notes?: string;
  items: DemoQuoteItem[];
};

const DEMO_QUOTES: DemoQuote[] = [
  { clientName: 'Rossi Costruzioni SRL', status: 'ACCEPTED', createdDaysAgo: 75, validDays: 30, notes: 'Rifacimento completo sito aziendale.', items: [
    { title: 'Design e prototipo', quantity: 1, unitPrice: 1200 },
    { title: 'Sviluppo sito corporate (10 pagine)', quantity: 1, unitPrice: 3400 },
    { title: 'Migrazione contenuti', quantity: 1, unitPrice: 600 },
  ] },
  { clientName: 'Pasticceria Dolce Vita', status: 'ACCEPTED', createdDaysAgo: 48, validDays: 30, notes: 'E-commerce con ritiro in negozio.', items: [
    { title: 'Setup e-commerce', quantity: 1, unitPrice: 2200 },
    { title: 'Caricamento catalogo (60 prodotti)', quantity: 60, unitPrice: 8 },
    { title: 'Formazione gestionale ordini', quantity: 2, unitPrice: 150 },
  ] },
  { clientName: 'Immobiliare Piemonte Casa', status: 'ACCEPTED', createdDaysAgo: 20, validDays: 45, items: [
    { title: 'Landing page lead generation', quantity: 2, unitPrice: 650 },
    { title: 'Campagna Google Ads (setup)', quantity: 1, unitPrice: 480 },
  ] },
  { clientName: 'Studio Legale Bassi & Partner', status: 'SENT', createdDaysAgo: 12, validDays: 30, notes: 'In attesa di riscontro dal titolare.', items: [
    { title: 'Sito vetrina studio (5 pagine)', quantity: 1, unitPrice: 1900 },
    { title: 'Testi professionali', quantity: 5, unitPrice: 110 },
  ] },
  { clientName: 'B&B Le Vigne', status: 'SENT', createdDaysAgo: 8, validDays: 30, items: [
    { title: 'Sito con booking engine', quantity: 1, unitPrice: 2600 },
    { title: 'Servizio fotografico struttura', quantity: 1, unitPrice: 450, discountPercent: 10 },
  ] },
  { clientName: 'Palestra UrbanFit', status: 'SENT', createdDaysAgo: 5, validDays: 20, items: [
    { title: 'App prenotazione corsi (MVP)', quantity: 1, unitPrice: 5200 },
    { title: 'Integrazione gestionale abbonamenti', quantity: 1, unitPrice: 900 },
  ] },
  { clientName: 'Martina Galli', status: 'SENT', createdDaysAgo: 3, validDays: 15, items: [
    { title: 'Portfolio online', quantity: 1, unitPrice: 750 },
  ] },
  { clientName: 'Farmacia San Carlo', status: 'DRAFT', createdDaysAgo: 2, validDays: 30, notes: 'Da completare con listino turni notturni.', items: [
    { title: 'Sito con turni e servizi', quantity: 1, unitPrice: 1400 },
    { title: 'Modulo prenotazione autoanalisi', quantity: 1, unitPrice: 500 },
  ] },
  { clientName: 'Anna Fontana', status: 'DRAFT', createdDaysAgo: 1, validDays: 30, items: [
    { title: 'Portfolio fotografico', quantity: 1, unitPrice: 680 },
    { title: 'Galleria protetta clienti', quantity: 1, unitPrice: 320 },
  ] },
  { clientName: 'Trattoria Da Beppe', status: 'DRAFT', createdDaysAgo: 6, validDays: 30, items: [
    { title: 'Sito con menu stagionale', quantity: 1, unitPrice: 950 },
  ] },
  { clientName: 'Officina Meccanica F.lli Serra', status: 'REJECTED', createdDaysAgo: 40, validDays: 30, notes: 'Rifiutato: budget rimandato al prossimo anno.', items: [
    { title: 'Sito vetrina officina', quantity: 1, unitPrice: 1300 },
    { title: 'Scheda Google Business', quantity: 1, unitPrice: 200 },
  ] },
  { clientName: 'Paolo Ricci', status: 'REJECTED', createdDaysAgo: 30, validDays: 20, items: [
    { title: 'Blog personale', quantity: 1, unitPrice: 550 },
  ] },
  { clientName: 'Studio Legale Bassi & Partner', status: 'EXPIRED', createdDaysAgo: 90, validDays: 30, notes: 'Prima proposta, mai riscontrata.', items: [
    { title: 'Restyling logo e immagine coordinata', quantity: 1, unitPrice: 1100 },
  ] },
  { clientName: 'Palestra UrbanFit', status: 'EXPIRED', createdDaysAgo: 70, validDays: 20, items: [
    { title: 'Gestione social 3 mesi', quantity: 3, unitPrice: 800, discountPercent: 5 },
  ] },
];

// --- Progetti (board pipeline) -------------------------------------------------

// Stage aggiuntivi nella categoria "Pipeline" (oltre a "Stage Gate Demo" del seed base),
// così la board mostra più colonne con progetti distribuiti.
const DEMO_PIPELINE_STAGES = [
  { name: 'In lavorazione', sortOrder: 1, isClosed: false },
  { name: 'In revisione', sortOrder: 2, isClosed: false },
  { name: 'In pubblicazione', sortOrder: 3, isClosed: false },
  { name: 'Completato', sortOrder: 4, isClosed: true },
] as const;

type DemoProject = {
  name: string;
  clientName: string;
  stage: string;
  value: number;
  dueInDays: number;
  description: string;
};

const DEMO_PROJECTS: DemoProject[] = [
  { name: 'Sito corporate Rossi Costruzioni', clientName: 'Rossi Costruzioni SRL', stage: 'Completato', value: 5200, dueInDays: -10, description: 'Rifacimento completo del sito aziendale con sezione cantieri.' },
  { name: 'E-commerce Dolce Vita', clientName: 'Pasticceria Dolce Vita', stage: 'In pubblicazione', value: 4360, dueInDays: 6, description: 'Shop online con ritiro in negozio e pagamenti.' },
  { name: 'Landing Immobiliare Piemonte', clientName: 'Immobiliare Piemonte Casa', stage: 'In revisione', value: 1780, dueInDays: 9, description: 'Landing per lead generation con campagna Google Ads.' },
  { name: 'Sito studio Bassi & Partner', clientName: 'Studio Legale Bassi & Partner', stage: 'In lavorazione', value: 2450, dueInDays: 18, description: 'Sito vetrina professionale con aree di competenza.' },
  { name: 'Booking B&B Le Vigne', clientName: 'B&B Le Vigne', stage: 'In lavorazione', value: 3050, dueInDays: 22, description: 'Sito con motore di prenotazione e gallery struttura.' },
  { name: 'App corsi UrbanFit', clientName: 'Palestra UrbanFit', stage: 'Stage Gate Demo', value: 6100, dueInDays: 35, description: 'MVP app prenotazione corsi e gestionale abbonamenti.' },
  { name: 'Portfolio Martina Galli', clientName: 'Martina Galli', stage: 'In revisione', value: 750, dueInDays: 4, description: 'Portfolio online per freelance.' },
  { name: 'Sito Farmacia San Carlo', clientName: 'Farmacia San Carlo', stage: 'In lavorazione', value: 1900, dueInDays: 27, description: 'Sito con turni, servizi e prenotazione autoanalisi.' },
  { name: 'Portfolio fotografico Anna Fontana', clientName: 'Anna Fontana', stage: 'Completato', value: 1000, dueInDays: -3, description: 'Portfolio con galleria protetta per i clienti.' },
];

// --- Memo operativi (checklist template) --------------------------------------

const DEMO_CHECKLIST_TEMPLATES = [
  {
    name: 'Onboarding Cliente',
    description: 'Passi per avviare un nuovo cliente in modo ordinato.',
    items: [
      { title: 'Raccolta accessi e materiali', isRequired: true },
      { title: 'Brief iniziale e obiettivi', isRequired: true },
      { title: 'Creazione cartella progetto', isRequired: false },
      { title: 'Presentazione del team di riferimento', isRequired: false },
    ],
  },
  {
    name: 'Consegna Progetto',
    description: 'Verifiche prima della consegna finale al cliente.',
    items: [
      { title: 'Test su mobile e desktop', isRequired: true },
      { title: 'Controllo velocità e SEO di base', isRequired: true },
      { title: 'Backup e credenziali consegnate', isRequired: true },
      { title: 'Formazione cliente completata', isRequired: false },
    ],
  },
] as const;

// --- Calendario ----------------------------------------------------------------
// Nessun colore fisso: si lascia la categoria, il calendario colora di default.

type DemoEvent = {
  title: string;
  category: string;
  startInDays: number;
  startHour: number;
  durationHours: number;
  allDay: boolean;
  description?: string;
  location?: string;
};

const DEMO_CALENDAR_EVENTS: DemoEvent[] = [
  { title: 'Kickoff Rossi Costruzioni', category: 'Riunione', startInDays: -6, startHour: 10, durationHours: 1, allDay: false, description: 'Avvio del progetto sito corporate.', location: 'Ufficio' },
  { title: 'Consegna E-commerce Dolce Vita', category: 'Scadenza', startInDays: 6, startHour: 9, durationHours: 0, allDay: true, description: 'Data di go-live prevista.' },
  { title: 'Call UrbanFit — MVP app', category: 'Riunione', startInDays: 2, startHour: 15, durationHours: 1, allDay: false, description: 'Confronto sulle funzionalità della prima versione.' },
  { title: 'Revisione landing Immobiliare', category: 'Attività', startInDays: 1, startHour: 11, durationHours: 2, allDay: false },
  { title: 'Scadenza preventivo Palestra UrbanFit', category: 'Scadenza', startInDays: 4, startHour: 9, durationHours: 0, allDay: true },
  { title: 'Servizio fotografico Le Vigne', category: 'Attività', startInDays: 8, startHour: 14, durationHours: 3, allDay: false, location: 'Alba' },
  { title: 'Riunione settimanale team', category: 'Riunione', startInDays: 3, startHour: 9, durationHours: 1, allDay: false, description: 'Stato avanzamento progetti.' },
  { title: 'Formazione gestionale Pasticceria', category: 'Attività', startInDays: -2, startHour: 16, durationHours: 2, allDay: false },
];

// --- Web Assets ----------------------------------------------------------------

type DemoWebAsset = {
  kind: 'website' | 'webapp' | 'ecommerce';
  name: string;
  url: string;
  status: 'ACTIVE' | 'MAINTENANCE' | 'PAUSED' | 'ARCHIVED';
  environment: 'DEVELOPMENT' | 'STAGING' | 'PRODUCTION';
  clientName: string;
  version?: string;
};

const DEMO_WEB_ASSETS: DemoWebAsset[] = [
  { kind: 'website', name: 'rossicostruzioni.it', url: 'https://rossicostruzioni.it', status: 'ACTIVE', environment: 'PRODUCTION', clientName: 'Rossi Costruzioni SRL', version: '1.4.0' },
  { kind: 'website', name: 'Studio Bassi (staging)', url: 'https://staging.bassilegal.it', status: 'MAINTENANCE', environment: 'STAGING', clientName: 'Studio Legale Bassi & Partner', version: '0.9.0' },
  { kind: 'website', name: 'levignebb.it', url: 'https://levignebb.it', status: 'ACTIVE', environment: 'PRODUCTION', clientName: 'B&B Le Vigne', version: '2.1.0' },
  { kind: 'webapp', name: 'UrbanFit Booking', url: 'https://app.urbanfit.club', status: 'ACTIVE', environment: 'DEVELOPMENT', clientName: 'Palestra UrbanFit', version: '0.3.0' },
  { kind: 'webapp', name: 'Prenotazioni Farmacia San Carlo', url: 'https://prenota.farmaciasancarlo.it', status: 'PAUSED', environment: 'STAGING', clientName: 'Farmacia San Carlo' },
  { kind: 'ecommerce', name: 'Shop Dolce Vita', url: 'https://shop.dolcevitatorino.it', status: 'ACTIVE', environment: 'PRODUCTION', clientName: 'Pasticceria Dolce Vita', version: '1.0.2' },
];

// --- Messaggi ------------------------------------------------------------------

type DemoMessage = {
  from: string; // email mittente
  to: string;   // email destinatario
  body: string;
  daysAgo: number;
  read: boolean;
};

const ADMIN_EMAIL = 'admin@test.com';

const DEMO_MESSAGES: DemoMessage[] = [
  { from: 'giulia.ferrari@demo.local', to: ADMIN_EMAIL, body: 'Ho aggiornato il preventivo per Rossi Costruzioni, quando puoi dagli un occhio.', daysAgo: 2, read: false },
  { from: ADMIN_EMAIL, to: 'giulia.ferrari@demo.local', body: 'Perfetto, lo guardo oggi pomeriggio.', daysAgo: 2, read: true },
  { from: 'marco.russo@demo.local', to: ADMIN_EMAIL, body: 'Il cliente UrbanFit chiede una call per la app corsi.', daysAgo: 1, read: false },
  { from: ADMIN_EMAIL, to: 'marco.russo@demo.local', body: 'Organizza tu la call con UrbanFit per giovedì mattina.', daysAgo: 1, read: true },
  { from: 'sara.colombo@demo.local', to: ADMIN_EMAIL, body: 'Screenshot finali del sito Le Vigne caricati nella cartella condivisa.', daysAgo: 0, read: false },
];

// --- Esecuzione ----------------------------------------------------------------

async function main() {
  const workspace = await prisma.workspace.findUnique({ where: { slug: 'demo' } });
  if (!workspace) {
    throw new Error('Workspace "demo" non trovato: eseguire prima `npm run db:seed`.');
  }

  const adminUser = await prisma.user.findUnique({ where: { email: 'admin@test.com' } });
  if (!adminUser) {
    throw new Error('Utente admin@test.com non trovato: eseguire prima `npm run db:seed`.');
  }

  // Mappa email → id utente (parte dall'admin), popolata creando i membri.
  const userIdByEmail = new Map<string, string>([[adminUser.email, adminUser.id]]);

  // Team: utenti, membership con stati misti, ruoli di sistema.
  const memberPasswordHash = await bcrypt.hash('demo123', 10);
  for (const member of DEMO_MEMBERS) {
    const user = await prisma.user.upsert({
      where: { email: member.email },
      update: { name: member.name },
      create: { email: member.email, name: member.name, passwordHash: memberPasswordHash, role: 'user' },
    });
    userIdByEmail.set(member.email, user.id);

    await prisma.membership.upsert({
      where: { workspaceId_userId: { workspaceId: workspace.id, userId: user.id } },
      update: { status: member.status },
      create: { workspaceId: workspace.id, userId: user.id, status: member.status },
    });

    const role = await prisma.role.findUnique({
      where: { workspaceId_name: { workspaceId: workspace.id, name: member.role } },
      select: { id: true },
    });
    if (role) {
      await prisma.userRole.upsert({
        where: { workspaceId_userId_roleId: { workspaceId: workspace.id, userId: user.id, roleId: role.id } },
        update: {},
        create: { workspaceId: workspace.id, userId: user.id, roleId: role.id },
      });
    }
  }

  // Inviti team (uno pendente, uno scaduto). Il token reale non serve ai test
  // di interfaccia: si salva solo un hash casuale, come farebbe l'API.
  for (const invite of DEMO_INVITES) {
    const existing = await prisma.teamInvite.findFirst({
      where: { workspaceId: workspace.id, email: invite.email },
      select: { id: true },
    });
    if (existing) {
      continue;
    }

    await prisma.teamInvite.create({
      data: {
        workspaceId: workspace.id,
        email: invite.email,
        tokenHash: createHash('sha256').update(randomUUID()).digest('hex'),
        expiresAt: daysFromNow(invite.expiresInDays),
        status: invite.expiresInDays < 0 ? 'EXPIRED' : 'PENDING',
        rolePresetName: invite.role,
        invitedByUserId: adminUser.id,
      },
    });
  }

  // Clienti: riconosciuti per (workspace, nome) — al secondo giro si aggiornano.
  const clientIdByName = new Map<string, string>();
  for (const client of DEMO_CLIENTS) {
    const data = {
      type: client.type,
      email: 'email' in client ? client.email : null,
      phone: 'phone' in client ? client.phone : null,
      vatNumber: 'vatNumber' in client ? client.vatNumber : null,
      city: client.city,
      country: 'IT',
      tags: [...client.tags],
    };

    const existing = await prisma.client.findFirst({
      where: { workspaceId: workspace.id, name: client.name },
      select: { id: true },
    });

    const record = existing
      ? await prisma.client.update({ where: { id: existing.id }, data, select: { id: true } })
      : await prisma.client.create({
          data: { workspaceId: workspace.id, name: client.name, ...data },
          select: { id: true },
        });

    clientIdByName.set(client.name, record.id);
  }

  // Template preventivi.
  for (const template of DEMO_QUOTE_TEMPLATES) {
    const record = await prisma.quoteTemplate.upsert({
      where: { workspaceId_name: { workspaceId: workspace.id, name: template.name } },
      update: { description: template.description, defaultNotes: template.defaultNotes },
      create: {
        workspaceId: workspace.id,
        name: template.name,
        description: template.description,
        defaultNotes: template.defaultNotes,
      },
      select: { id: true },
    });

    await prisma.quoteTemplateItem.deleteMany({ where: { templateId: record.id } });
    await prisma.quoteTemplateItem.createMany({
      data: template.items.map((item, position) => ({
        workspaceId: workspace.id,
        templateId: record.id,
        position,
        title: item.title,
        description: 'description' in item ? item.description : null,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      })),
    });
  }

  // Preventivi: quelli demo (marcatore in internalNotes) si ricreano da zero,
  // così lo script resta ripetibile senza duplicare.
  await prisma.quote.deleteMany({
    where: { workspaceId: workspace.id, internalNotes: DEMO_MARKER },
  });

  for (const quote of DEMO_QUOTES) {
    const clientId = clientIdByName.get(quote.clientName);
    if (!clientId) {
      throw new Error(`Cliente demo mancante per il preventivo: ${quote.clientName}`);
    }

    const lines = quote.items.map((item) => {
      const gross = item.quantity * item.unitPrice;
      const lineTotal = item.discountPercent ? gross * (1 - item.discountPercent / 100) : gross;
      return { ...item, lineTotal: Math.round(lineTotal * 100) / 100 };
    });

    const subtotal = Math.round(lines.reduce((sum, line) => sum + line.lineTotal, 0) * 100) / 100;
    const taxTotal = Math.round(subtotal * IVA * 100) / 100;
    const total = Math.round((subtotal + taxTotal) * 100) / 100;
    const issueDate = daysAgo(quote.createdDaysAgo);
    const validUntil = new Date(issueDate.getTime() + quote.validDays * 24 * 60 * 60 * 1000);

    await prisma.quote.create({
      data: {
        workspaceId: workspace.id,
        clientId,
        createdByUserId: adminUser.id,
        status: quote.status,
        subtotal,
        taxTotal,
        total,
        taxRate: new Prisma.Decimal(IVA * 100),
        issueDate,
        validUntil,
        notes: quote.notes ?? null,
        internalNotes: DEMO_MARKER,
        createdAt: issueDate,
        items: {
          create: lines.map((line, position) => ({
            workspaceId: workspace.id,
            position,
            title: line.title,
            description: line.description ?? null,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            discountType: line.discountPercent ? 'PERCENT' : null,
            discountValue: line.discountPercent ?? null,
            lineTotal: line.lineTotal,
          })),
        },
      },
    });
  }

  // Progetti (board): categoria "Pipeline" + stage aggiuntivi + progetti distribuiti.
  const pipelineCategory = await prisma.projectCategory.upsert({
    where: { workspaceId_name: { workspaceId: workspace.id, name: 'Pipeline' } },
    update: {},
    create: { workspaceId: workspace.id, name: 'Pipeline', sortOrder: 0 },
    select: { id: true },
  });

  const stageIdByName = new Map<string, string>();

  // Stage già esistente dal seed base (gated): lo recuperiamo per collocarci un progetto.
  const gateStage = await prisma.pipelineStage.findFirst({
    where: { workspaceId: workspace.id, name: 'Stage Gate Demo' },
    select: { id: true },
  });
  if (gateStage) {
    stageIdByName.set('Stage Gate Demo', gateStage.id);
  }

  for (const stage of DEMO_PIPELINE_STAGES) {
    const existing = await prisma.pipelineStage.findFirst({
      where: { workspaceId: workspace.id, categoryId: pipelineCategory.id, name: stage.name },
      select: { id: true },
    });
    const record = existing
      ? await prisma.pipelineStage.update({
          where: { id: existing.id },
          data: { sortOrder: stage.sortOrder, isClosed: stage.isClosed },
          select: { id: true },
        })
      : await prisma.pipelineStage.create({
          data: {
            workspaceId: workspace.id,
            categoryId: pipelineCategory.id,
            name: stage.name,
            sortOrder: stage.sortOrder,
            isClosed: stage.isClosed,
          },
          select: { id: true },
        });
    stageIdByName.set(stage.name, record.id);
  }

  // Progetti demo: riconosciuti per nome, ricreati da zero (senza toccare "Project Gate Demo").
  const demoProjectNames = DEMO_PROJECTS.map((project) => project.name);
  await prisma.project.deleteMany({
    where: { workspaceId: workspace.id, name: { in: demoProjectNames } },
  });

  for (const project of DEMO_PROJECTS) {
    const clientId = clientIdByName.get(project.clientName);
    const stageId = stageIdByName.get(project.stage);
    if (!stageId) {
      throw new Error(`Stage demo mancante per il progetto: ${project.stage}`);
    }

    await prisma.project.create({
      data: {
        workspaceId: workspace.id,
        name: project.name,
        description: project.description,
        value: project.value,
        dueDate: daysFromNow(project.dueInDays),
        pipelineStageId: stageId,
        clientId: clientId ?? null,
        ...(clientId ? { clientLinks: { create: [{ clientId }] } } : {}),
      },
    });
  }

  // Memo operativi (checklist template) demo, oltre a "Pre Pubblicazione" del seed base.
  for (const template of DEMO_CHECKLIST_TEMPLATES) {
    const record = await prisma.checklistTemplate.upsert({
      where: { workspaceId_name: { workspaceId: workspace.id, name: template.name } },
      update: { description: template.description, isArchived: false },
      create: {
        workspaceId: workspace.id,
        name: template.name,
        description: template.description,
      },
      select: { id: true },
    });

    await prisma.checklistTemplateItem.deleteMany({ where: { templateId: record.id } });
    for (let index = 0; index < template.items.length; index += 1) {
      const item = template.items[index];
      await prisma.checklistTemplateItem.create({
        data: {
          workspaceId: workspace.id,
          templateId: record.id,
          title: item.title,
          sortOrder: index,
          isRequired: item.isRequired,
        },
      });
    }
  }

  // Calendario: eventi demo riconosciuti per titolo, ricreati da zero.
  await prisma.calendarEvent.deleteMany({
    where: { workspaceId: workspace.id, title: { in: DEMO_CALENDAR_EVENTS.map((event) => event.title) } },
  });
  for (const event of DEMO_CALENDAR_EVENTS) {
    const startAt = daysFromNow(event.startInDays);
    startAt.setHours(event.startHour, 0, 0, 0);
    const endAt = event.allDay
      ? null
      : new Date(startAt.getTime() + event.durationHours * 60 * 60 * 1000);

    await prisma.calendarEvent.create({
      data: {
        workspaceId: workspace.id,
        createdByUserId: adminUser.id,
        title: event.title,
        description: event.description ?? null,
        location: event.location ?? null,
        category: event.category,
        startAt,
        endAt,
        allDay: event.allDay,
      },
    });
  }

  // Web Assets: upsert per URL (chiave unica per tabella), tabella diversa per tipo.
  for (const asset of DEMO_WEB_ASSETS) {
    const clientId = clientIdByName.get(asset.clientName) ?? null;
    const data = {
      workspaceId: workspace.id,
      clientId,
      ownerUserId: adminUser.id,
      name: asset.name,
      url: asset.url,
      status: asset.status,
      deploymentEnvironment: asset.environment,
      version: asset.version ?? null,
    };
    const where = { workspaceId_url: { workspaceId: workspace.id, url: asset.url } };
    const update = {
      name: asset.name,
      status: asset.status,
      deploymentEnvironment: asset.environment,
      version: asset.version ?? null,
      clientId,
    };

    if (asset.kind === 'website') {
      await prisma.websiteAsset.upsert({ where, update, create: data });
    } else if (asset.kind === 'webapp') {
      await prisma.webAppAsset.upsert({ where, update, create: data });
    } else {
      await prisma.ecommerceAsset.upsert({ where, update, create: data });
    }
  }

  // Messaggi tra admin e membri demo: si ricreano da zero (nessuna chiave naturale).
  const demoMemberIds = DEMO_MEMBERS
    .map((member) => userIdByEmail.get(member.email))
    .filter((id): id is string => Boolean(id));
  await prisma.workspaceMessage.deleteMany({
    where: {
      workspaceId: workspace.id,
      OR: [
        { senderUserId: { in: demoMemberIds } },
        { recipientUserId: { in: demoMemberIds } },
      ],
    },
  });
  for (const message of DEMO_MESSAGES) {
    const senderUserId = userIdByEmail.get(message.from);
    const recipientUserId = userIdByEmail.get(message.to);
    if (!senderUserId || !recipientUserId) {
      continue;
    }
    const createdAt = daysAgo(message.daysAgo);
    await prisma.workspaceMessage.create({
      data: {
        workspaceId: workspace.id,
        senderUserId,
        recipientUserId,
        body: message.body,
        readAt: message.read ? createdAt : null,
        createdAt,
      },
    });
  }

  console.log('Seed demo completato');
  console.log(`Membri team: ${DEMO_MEMBERS.length} (+ ${DEMO_INVITES.length} inviti)`);
  console.log(`Clienti: ${DEMO_CLIENTS.length}`);
  console.log(`Template preventivi: ${DEMO_QUOTE_TEMPLATES.length}`);
  console.log(`Preventivi: ${DEMO_QUOTES.length}`);
  console.log(`Progetti: ${DEMO_PROJECTS.length} (stage pipeline: ${DEMO_PIPELINE_STAGES.length} aggiunti)`);
  console.log(`Memo operativi (checklist): ${DEMO_CHECKLIST_TEMPLATES.length}`);
  console.log(`Eventi calendario: ${DEMO_CALENDAR_EVENTS.length}`);
  console.log(`Web asset: ${DEMO_WEB_ASSETS.length}`);
  console.log(`Messaggi: ${DEMO_MESSAGES.length}`);
  console.log('Nota: Vault e Agency-OS non inclusi (vedi handoff).');
}

main()
  .catch((error) => {
    console.error('Seed demo fallito', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
