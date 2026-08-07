import { PrismaClient } from '@prisma/client';

/**
 * Seed di TEST — cliente + progetto "Arkiroma (test)".
 *
 * Corrisponde al cliente `arkiroma` del progetto "Revisioni fogli di calcolo"
 * (agenzia di lead generation, export contatti/lead in Excel), ma i dati qui sono
 * INVENTATI: nessun PII reale. Serve come fixture per sviluppare/collaudare il
 * sotto-modulo Excel+AI del modulo Reportistica (upload export lead -> mappatura AI
 * -> snapshot). Il nome contiene "test" per riconoscerlo.
 *
 * Idempotente: riconosce cliente/progetto per nome nel workspace Demo e li aggiorna.
 * Esecuzione: `npx tsx prisma/seed-test-arkiroma.ts`
 */

const prisma = new PrismaClient();
const WORKSPACE_SLUG = 'demo';

const CLIENT_NAME = 'Arkiroma Lead Gen (test)';
const PROJECT_NAME = 'Arkiroma - Reportistica (test)';

async function main() {
  const workspace = await prisma.workspace.findFirst({
    where: { slug: WORKSPACE_SLUG },
    select: { id: true },
  });
  if (!workspace) {
    throw new Error(`Workspace "${WORKSPACE_SLUG}" non trovato.`);
  }
  const workspaceId = workspace.id;

  const clientData = {
    type: 'company' as const,
    email: 'info@arkiroma-test.example',
    phone: '+39 06 5550 0142',
    city: 'Roma',
    province: 'RM',
    country: 'Italia',
    notes:
      'Cliente di TEST (dati inventati, nessun PII reale). Corrisponde ad "arkiroma" ' +
      '(lead generation) del progetto Revisioni. Usato per collaudare il sotto-modulo Excel+AI.',
    tags: ['test', 'lead-gen'],
  };

  const existingClient = await prisma.client.findFirst({
    where: { workspaceId, name: CLIENT_NAME },
    select: { id: true },
  });
  const client = existingClient
    ? await prisma.client.update({ where: { id: existingClient.id }, data: clientData })
    : await prisma.client.create({ data: { workspaceId, name: CLIENT_NAME, ...clientData } });

  const scopePurchased = {
    website: false,
    landing_page: false,
    google_ads: true,
    meta_ads: true,
    seo: false,
    reporting: true,
    diagnosis: false,
  };

  const projectData = {
    clientId: client.id,
    statusAgency: 'LIVE' as const,
    goal:
      'Reportistica multi-sorgente: performance Ads (Google/Meta) piu\' standardizzazione ' +
      'degli export lead (Excel) del cliente, con storico e dashboard.',
    scopePurchased,
  };

  const existingProject = await prisma.project.findFirst({
    where: { workspaceId, name: PROJECT_NAME },
    select: { id: true },
  });
  const project = existingProject
    ? await prisma.project.update({ where: { id: existingProject.id }, data: projectData })
    : await prisma.project.create({
        data: {
          workspaceId,
          name: PROJECT_NAME,
          description: 'Progetto di TEST per il sotto-modulo Excel+AI (dati inventati).',
          ...projectData,
        },
      });

  // La lista /agency/projects include un progetto solo se ha un projectType, una
  // ProjectMemory, oppure almeno un ProjectActiveModule (agency.repository.ts:530).
  // Creiamo i moduli attivi (come i progetti demo) cosi' il progetto test compare
  // in lista ed e' navigabile dalla UI.
  const MODULES = [
    { moduleKey: 'discovery', moduleLabel: 'Brief', included: true, suggested: false, active: true },
    { moduleKey: 'brain', moduleLabel: 'Agency Brain', included: true, suggested: false, active: true },
    { moduleKey: 'memory', moduleLabel: 'Memoria', included: true, suggested: false, active: true },
    { moduleKey: 'ads', moduleLabel: 'Campagne ADS', included: true, suggested: false, active: true },
    { moduleKey: 'reports', moduleLabel: 'Report', included: true, suggested: false, active: true },
    { moduleKey: 'assets', moduleLabel: 'Fonti', included: false, suggested: true, active: true },
  ];
  await prisma.projectActiveModule.deleteMany({ where: { workspaceId, projectId: project.id } });
  await prisma.projectActiveModule.createMany({
    data: MODULES.map((module) => ({
      workspaceId,
      projectId: project.id,
      moduleKey: module.moduleKey,
      moduleLabel: module.moduleLabel,
      included: module.included,
      suggested: module.suggested,
      active: module.active,
      source: 'seed-test',
    })),
  });

  console.log(
    JSON.stringify(
      { workspaceId, clientId: client.id, projectId: project.id, clientName: CLIENT_NAME, projectName: PROJECT_NAME },
      null,
      2,
    ),
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exitCode = 1;
  });
