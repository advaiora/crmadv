/**
 * Promuove un utente gia registrato a superadmin di un workspace, e — se richiesto —
 * lo sposta sul workspace giusto ripulendo quello creato per forza in fase di
 * registrazione.
 *
 *   npx tsx scripts/promote-superadmin.ts <email> [opzioni]
 *
 * Opzioni:
 *   --workspace <slug>          workspace su cui rendere l'utente superadmin.
 *                               Se manca, si usa quello a cui l'utente appartiene gia.
 *                               Se l'utente non ne e membro, la membership viene creata.
 *   --platform-admin            alza anche il flag isPlatformAdmin (poteri di piattaforma).
 *   --remove-other-workspaces   elimina gli altri workspace dell'utente, ma SOLO se
 *                               contengono zero dati di lavoro e nessun altro membro.
 *                               Se non e cosi, il workspace resta e viene segnalato.
 *   --dry-run                   esegue tutto dentro una transazione e la annulla:
 *                               stampa cosa succederebbe senza scrivere niente.
 *
 * Usa la stessa funzione che il CRM adopera in fase di registrazione
 * (assignWorkspaceUserRole), quindi ruolo, permessi e audit log restano
 * coerenti con quelli creati dall'applicazione.
 */
import { PrismaClient, type Prisma } from '@prisma/client';
import { assignWorkspaceUserRole, SYSTEM_ROLE_NAME } from '../server/auth/workspace-bootstrap.js';

const [, , emailArg, ...flags] = process.argv;

const readFlagValue = (name: string) => {
  const index = flags.indexOf(name);
  if (index === -1) {
    return null;
  }
  const value = flags[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`L'opzione ${name} vuole un valore (es. ${name} demo).`);
  }
  return value.trim();
};

const dryRun = flags.includes('--dry-run');
const alsoPlatformAdmin = flags.includes('--platform-admin');
const removeOtherWorkspaces = flags.includes('--remove-other-workspaces');
const targetWorkspaceSlug = readFlagValue('--workspace');

if (!emailArg) {
  console.error(
    'Uso: npx tsx scripts/promote-superadmin.ts <email> [--workspace <slug>] ' +
      '[--platform-admin] [--remove-other-workspaces] [--dry-run]',
  );
  process.exit(1);
}

const email = emailArg.trim().toLowerCase();
const prisma = new PrismaClient();

class Rollback extends Error {}

/**
 * Tabelle collegate a un workspace che esistono per il solo fatto che il workspace
 * esiste: le crea la registrazione, non l'utente lavorando. Un workspace che ha solo
 * queste righe e "vuoto" e si puo eliminare senza perdere niente.
 */
const BOOTSTRAP_TABLES = new Set([
  'AuditLog',
  'Membership',
  'Role',
  'UserRole',
  'WorkspaceBranding',
  'WorkspaceModule',
  'PipelineStage',
  'ProjectCategory',
  'ProjectType',
  'QuoteNotificationSettings',
  'WorkspaceVaultKey',
  'WorkspaceVaultPolicy',
]);

const listWorkspaceScopedTables = async (tx: Prisma.TransactionClient) => {
  const rows = await tx.$queryRawUnsafe<{ table_name: string }[]>(
    `select table_name from information_schema.columns
     where table_schema = 'public' and column_name = 'workspaceId'
     order by table_name`,
  );
  return rows.map((row) => row.table_name);
};

/** Righe di lavoro vere collegate al workspace, tabella per tabella. */
const countBusinessRows = async (tx: Prisma.TransactionClient, workspaceId: string) => {
  const tables = await listWorkspaceScopedTables(tx);
  const counts: { table: string; rows: number }[] = [];

  for (const table of tables) {
    if (BOOTSTRAP_TABLES.has(table)) {
      continue;
    }
    const result = await tx.$queryRawUnsafe<{ n: number }[]>(
      `select count(*)::int as n from "${table}" where "workspaceId" = $1`,
      workspaceId,
    );
    if (result[0]?.n > 0) {
      counts.push({ table, rows: result[0].n });
    }
  }

  return counts;
};

async function main() {
  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
    select: { id: true, email: true, name: true, role: true, isPlatformAdmin: true },
  });

  if (!user) {
    throw new Error(`Nessun utente registrato con l'email ${email}. Registrati prima su https://crm.advaiora.com`);
  }

  const memberships = await prisma.membership.findMany({
    where: { userId: user.id },
    select: {
      workspaceId: true,
      status: true,
      workspace: { select: { id: true, name: true, slug: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  let targetWorkspace: { id: string; name: string; slug: string } | null = null;

  if (targetWorkspaceSlug) {
    targetWorkspace = await prisma.workspace.findUnique({
      where: { slug: targetWorkspaceSlug },
      select: { id: true, name: true, slug: true },
    });
    if (!targetWorkspace) {
      const available = await prisma.workspace.findMany({ select: { slug: true } });
      throw new Error(
        `Nessun workspace con slug "${targetWorkspaceSlug}". Disponibili: ${available
          .map((w) => w.slug)
          .join(', ')}`,
      );
    }
  } else {
    targetWorkspace = memberships[0]?.workspace ?? null;
    if (!targetWorkspace) {
      throw new Error(
        `${email} non appartiene a nessun workspace: indica quale con --workspace <slug>.`,
      );
    }
  }

  console.log(
    `Utente: ${user.email} (${user.name ?? 'senza nome'}) — ruolo attuale "${user.role}", ` +
      `isPlatformAdmin=${user.isPlatformAdmin}`,
  );
  console.log(
    `  workspace attuali: ${
      memberships.length
        ? memberships.map((m) => `${m.workspace.slug} (${m.status})`).join(', ')
        : 'nessuno'
    }`,
  );
  console.log(`  workspace di destinazione: ${targetWorkspace.name} (${targetWorkspace.slug})`);

  const otherWorkspaces = memberships
    .map((m) => m.workspace)
    .filter((w) => w.id !== targetWorkspace!.id);

  try {
    await prisma.$transaction(
      async (tx) => {
        // 1. Membership sul workspace di destinazione: creata se manca, riattivata se spenta.
        const existing = memberships.find((m) => m.workspaceId === targetWorkspace!.id);
        if (!existing) {
          await tx.membership.create({
            data: { userId: user.id, workspaceId: targetWorkspace!.id, status: 'ACTIVE' },
          });
          console.log(`  ${dryRun ? '[dry-run] ' : ''}membership creata su "${targetWorkspace!.slug}" (ACTIVE)`);
        } else if (existing.status !== 'ACTIVE') {
          await tx.membership.updateMany({
            where: { userId: user.id, workspaceId: targetWorkspace!.id },
            data: { status: 'ACTIVE' },
          });
          console.log(`  ${dryRun ? '[dry-run] ' : ''}membership riattivata: ${existing.status} -> ACTIVE`);
        }

        // 2. Ruolo superadmin sul workspace di destinazione.
        const assignment = await assignWorkspaceUserRole({
          tx,
          workspaceId: targetWorkspace!.id,
          targetUserId: user.id,
          actorUserId: user.id,
          nextRoleName: SYSTEM_ROLE_NAME.superadmin,
          sourceAction: 'ops.promote-superadmin',
          enforceHierarchy: false,
        });

        console.log(
          `  ${dryRun ? '[dry-run] ' : ''}ruolo: ${assignment.previousRoleName ?? 'nessuno'} -> ` +
            `${assignment.assignedRoleName} (user.role="${assignment.assignedUserRole}", ` +
            `${assignment.assignedPermissionKeys.length} permessi)`,
        );

        // 3. Poteri di piattaforma.
        if (alsoPlatformAdmin) {
          await tx.user.update({ where: { id: user.id }, data: { isPlatformAdmin: true } });
          console.log(`  ${dryRun ? '[dry-run] ' : ''}isPlatformAdmin: ${user.isPlatformAdmin} -> true`);
        }

        // 4. Pulizia degli altri workspace dell'utente.
        if (removeOtherWorkspaces) {
          for (const workspace of otherWorkspaces) {
            const businessRows = await countBusinessRows(tx, workspace.id);
            const otherMembers = await tx.membership.count({
              where: { workspaceId: workspace.id, userId: { not: user.id } },
            });

            if (businessRows.length > 0) {
              console.log(
                `  ⚠️  workspace "${workspace.slug}" NON eliminato: contiene dati di lavoro — ` +
                  businessRows.map((c) => `${c.table}=${c.rows}`).join(', '),
              );
              continue;
            }
            if (otherMembers > 0) {
              console.log(
                `  ⚠️  workspace "${workspace.slug}" NON eliminato: ha altri ${otherMembers} membri.`,
              );
              continue;
            }

            await tx.workspace.delete({ where: { id: workspace.id } });
            console.log(
              `  ${dryRun ? '[dry-run] ' : ''}workspace "${workspace.slug}" eliminato ` +
                '(era vuoto: solo righe di impianto).',
            );
          }
        }

        if (dryRun) {
          throw new Rollback();
        }
      },
      { timeout: 60_000, maxWait: 20_000 },
    );
  } catch (error) {
    if (error instanceof Rollback) {
      console.log('  [dry-run] transazione annullata: nessuna modifica scritta.');
      return;
    }
    throw error;
  }

  const after = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      role: true,
      isPlatformAdmin: true,
      memberships: {
        select: { status: true, workspace: { select: { slug: true } } },
      },
      userRoles: {
        select: { role: { select: { name: true } }, workspace: { select: { slug: true } } },
      },
    },
  });
  const allWorkspaces = await prisma.workspace.findMany({ select: { slug: true } });

  console.log('Fatto. Riletto dal database:');
  console.log(`  user.role="${after?.role}", isPlatformAdmin=${after?.isPlatformAdmin}`);
  console.log(
    `  membership: ${after?.memberships.map((m) => `${m.workspace.slug}:${m.status}`).join(', ')}`,
  );
  console.log(
    `  ruoli: ${after?.userRoles.map((r) => `${r.workspace.slug}:${r.role.name}`).join(', ')}`,
  );
  console.log(`  workspace esistenti sull'istanza: ${allWorkspaces.map((w) => w.slug).join(', ')}`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
