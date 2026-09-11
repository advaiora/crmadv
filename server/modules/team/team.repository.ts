import type { Prisma } from '@prisma/client';
import { prisma } from '../../prisma.js';
import {
  MEMBERSHIP_ACCESS_SELECT,
  activeMember,
  markMembershipReactivated,
} from '../../core/membership-access.js';
import { isTrashed, notDeleted } from '../../core/soft-delete.js';

/**
 * I ruoli Superadmin che contano davvero in un workspace.
 *
 * ⚠️ Il filtro sulla membership non e' un dettaglio di lettura, e' la cosa che
 * regge la protezione dell'ultimo Superadmin (`team.service.ts:305`, `:362-363`,
 * `:430-431`). Senza il filtro del Cestino un Superadmin cestinato comanderebbe
 * ancora il modulo Team e farebbe da riempitivo al conteggio: la protezione
 * lascerebbe passare la rimozione dell'ultimo Superadmin **reale**, e il
 * workspace resterebbe senza nessuno che lo amministri (CRMA-157).
 *
 * E' esportata perche' quel filtro sia verificabile senza un database: vedi
 * `team.repository.test.ts`.
 */
export const buildSuperadminAssignmentsWhere = (
  workspaceId: string,
  userId?: string,
): Prisma.UserRoleWhereInput => ({
  workspaceId,
  ...(userId ? { userId } : {}),
  role: {
    isSuperadmin: true,
  },
  user: {
    memberships: {
      some: activeMember({ workspaceId }),
    },
  },
});

/**
 * Le tre risposte alla domanda «questa persona e' gia' dentro?» (CRMA-163).
 *
 * Fino al Cestino le risposte erano due — c'e' una membership oppure no — e
 * bastava il `Boolean` della riga letta. Da quando cestinare e' un gesto
 * possibile ce n'e' una terza, e trattarla come la prima chiude la porta a
 * chiave: le due sole vie per riportare dentro una persona (reinvitarla,
 * riaggiungerla a mano) rispondono «e' gia' membro» mentre a schermo non c'e'.
 *
 * `INACTIVE` resta invece un `present`, ed e' voluto: un membro disattivato e'
 * nella lista del Team, si riaccende da li', e non ha bisogno di un invito
 * nuovo. La terza risposta riguarda solo chi e' stato **tolto**.
 */
export type MembershipAdmission = 'none' | 'present' | 'trashed';

export const classifyMembershipAdmission = (
  membership: { status: string; deletedAt: Date | null } | null | undefined,
): MembershipAdmission => {
  if (!membership) {
    return 'none';
  }

  return isTrashed(membership) ? 'trashed' : 'present';
};

/**
 * Il `where` delle scritture che agiscono su un membro **come voce del Team**:
 * oggi il cambio di stato attivo/disattivo (CRMA-163).
 *
 * ⚠️ Il filtro del Cestino qui non e' una lettura mascherata, e' una difesa in
 * profondita': riaccendere lo stato di una membership cestinata scriverebbe
 * `status: 'ACTIVE'` senza toccare `deletedAt`, cioe' direbbe all'utente
 * «riattivato» lasciandolo fuori dal CRM (`membership-access.ts`: la riga resta
 * cestinata e ogni rotta risponde 403). Cosi' invece la scrittura non trova
 * niente, e il chiamante alza un 404 — che e' la verita': dal Team quella
 * persona non c'e', sta nel Cestino, e da li' si ripristina.
 *
 * ⚠️ `deleteMember` NON lo usa, e non e' una dimenticanza: quella e'
 * l'eliminazione definitiva, l'unico gesto che deve poter raggiungere proprio
 * una riga cestinata. Un filtro li' renderebbe impossibile svuotare il Cestino.
 */
export const buildTeamMemberWriteWhere = (workspaceId: string, memberId: string) =>
  notDeleted({
    workspaceId,
    id: memberId,
  });

export type TeamMemberRoleRecord = {
  roleId: string;
  roleName: string;
  isSuperadmin: boolean;
};

export type TeamMemberRecord = {
  memberId: string;
  userId: string;
  name: string | null;
  email: string;
  status: string;
  createdAt: Date;
  roles: TeamMemberRoleRecord[];
};

const buildMembershipSelect = (workspaceId: string) => ({
  id: true,
  userId: true,
  status: true,
  createdAt: true,
  user: {
    select: {
      id: true,
      name: true,
      email: true,
      userRoles: {
        where: {
          workspaceId,
        },
        select: {
          role: {
            select: {
              id: true,
              name: true,
              isSuperadmin: true,
            },
          },
        },
        orderBy: {
          role: {
            name: 'asc',
          },
        },
      },
    },
  },
});

const mapMembershipToTeamMember = (membership: {
  id: string;
  userId: string;
  status: string;
  createdAt: Date;
  user: {
    id: string;
    name: string | null;
    email: string;
    userRoles: Array<{
      role: {
        id: string;
        name: string;
        isSuperadmin: boolean;
      };
    }>;
  };
}): TeamMemberRecord => {
  const roles = membership.user.userRoles.map((entry) => ({
    roleId: entry.role.id,
    roleName: entry.role.name,
    isSuperadmin: entry.role.isSuperadmin,
  }));

  return {
    memberId: membership.id,
    userId: membership.userId,
    name: membership.user.name,
    email: membership.user.email,
    status: membership.status,
    createdAt: membership.createdAt,
    roles,
  };
};

const withClient = (tx?: Prisma.TransactionClient) => tx ?? prisma;

export const teamRepository = {
  async listMembers(workspaceId: string): Promise<TeamMemberRecord[]> {
    const memberships = await prisma.membership.findMany({
      where: {
        workspaceId,
      },
      select: buildMembershipSelect(workspaceId),
      orderBy: [
        {
          createdAt: 'asc',
        },
        {
          id: 'asc',
        },
      ],
    });

    return memberships.map(mapMembershipToTeamMember);
  },

  async findMemberById(
    workspaceId: string,
    memberId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<TeamMemberRecord | null> {
    const membership = await withClient(tx).membership.findFirst({
      where: {
        workspaceId,
        id: memberId,
      },
      select: buildMembershipSelect(workspaceId),
    });

    if (!membership) {
      return null;
    }

    return mapMembershipToTeamMember(membership);
  },

  /**
   * ⚠️ Questa lettura NON filtra il Cestino di proposito, ed e' l'unica del
   * modulo che puo' permetterselo: serve alle due porte d'ingresso al Team, che
   * devono sapere se la riga esiste **anche da cestinata** — altrimenti
   * riaggiungere la persona sbatterebbe sul vincolo unico `(workspaceId,
   * userId)`, che resta unico anche nel Cestino (`schema.prisma`, Membership).
   * Chi la chiama non guarda il `Boolean` della riga: passa per
   * `classifyMembershipAdmission`, che distingue i tre casi.
   */
  findMembershipByUserId(
    workspaceId: string,
    userId: string,
    tx?: Prisma.TransactionClient,
  ) {
    return withClient(tx).membership.findFirst({
      where: {
        workspaceId,
        userId,
      },
      // Lo stesso select della catena di accesso: `deletedAt` va chiesto per
      // nome, e un select che non lo nomina lo fa tornare `undefined` — cioe'
      // «non cestinato» per chiunque lo legga.
      select: MEMBERSHIP_ACCESS_SELECT,
    });
  },

  /**
   * Ammette una persona nel workspace: la crea se non c'e' mai stata, la riporta
   * indietro se era stata cestinata (CRMA-163).
   *
   * ⚠️ E' un `upsert` e non un `create`, per la ragione scritta sullo schema: la
   * coppia `(workspaceId, userId)` resta unica anche da cestinata, quindi un
   * `create` sulla persona rimossa sbatterebbe sul vincolo. E il ramo `update`
   * scrive `markMembershipReactivated()` e non il solo `status`, perche'
   * rimettere lo stato lasciando `deletedAt` valorizzata riammetterebbe qualcuno
   * che poi ogni rotta respinge con un 403 (CRMA-157).
   *
   * Chi chiama ha gia' rifiutato il caso `present`: qui il ramo `update` puo'
   * toccare solo una riga cestinata.
   */
  admitMembership(
    workspaceId: string,
    userId: string,
    tx?: Prisma.TransactionClient,
  ) {
    return withClient(tx).membership.upsert({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId,
        },
      },
      update: markMembershipReactivated(),
      create: {
        workspaceId,
        userId,
        status: 'ACTIVE',
      },
      select: {
        id: true,
      },
    });
  },

  async updateMembershipStatus(
    workspaceId: string,
    memberId: string,
    status: 'ACTIVE' | 'INACTIVE',
    tx?: Prisma.TransactionClient,
  ): Promise<boolean> {
    const updated = await withClient(tx).membership.updateMany({
      where: buildTeamMemberWriteWhere(workspaceId, memberId),
      data: {
        status,
      },
    });

    return updated.count > 0;
  },

  async deleteMember(
    workspaceId: string,
    memberId: string,
    userId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<boolean> {
    const client = withClient(tx);
    const deletedMembership = await client.membership.deleteMany({
      where: {
        workspaceId,
        id: memberId,
        userId,
      },
    });

    if (deletedMembership.count === 0) {
      return false;
    }

    await client.userRole.deleteMany({
      where: {
        workspaceId,
        userId,
      },
    });

    return true;
  },

  async countActiveSuperadminMembers(
    workspaceId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<number> {
    const activeSuperadminAssignments = await withClient(tx).userRole.findMany({
      where: buildSuperadminAssignmentsWhere(workspaceId),
      distinct: ['userId'],
      select: {
        userId: true,
      },
    });

    return activeSuperadminAssignments.length;
  },

  countActiveSuperadmins(
    workspaceId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<number> {
    return teamRepository.countActiveSuperadminMembers(workspaceId, tx);
  },

  async isSuperadmin(
    workspaceId: string,
    userId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<boolean> {
    const assignment = await withClient(tx).userRole.findFirst({
      where: buildSuperadminAssignmentsWhere(workspaceId, userId),
      select: {
        id: true,
      },
    });

    return Boolean(assignment);
  },
};
