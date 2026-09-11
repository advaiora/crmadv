import type { Prisma } from '@prisma/client';
import { prisma } from '../../prisma.js';
import { activeMember } from '../../core/membership-access.js';
import { markTrashed, notDeleted } from '../../core/soft-delete.js';

/**
 * I ruoli Superadmin che contano davvero in un workspace.
 *
 * ⚠️ Il filtro sulla membership non e' un dettaglio di lettura, e' la cosa che
 * regge la protezione dell'ultimo Superadmin — i tre punti che ci si appoggiano
 * sono, in `team.service.ts`, le chiamate a `isSuperadmin` e a
 * `countActiveSuperadmins` (fra cui `assertMembershipDestroyable`; i numeri di
 * riga che stavano qui sono stati tolti il 11/9/2026 perche' erano gia'
 * sbagliati dopo il primo spostamento). Senza il filtro del Cestino un
 * Superadmin cestinato comanderebbe
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

/**
 * La clausola della lista Team (CRMA-130).
 *
 * E' una funzione a se' e non un oggetto scritto dentro la query per un motivo
 * solo: cosi' si puo' provare che il filtro del Cestino c'e', senza montare un
 * database. `server/prisma.ts` esporta un Proxy che spara se il client non e'
 * inizializzato, quindi una clausola che vive dentro `findMany` e' verificabile
 * solo a integrazione.
 *
 * ⚠️ `status: 'ACTIVE'` non e' il filtro del Cestino e non lo sostituisce:
 * cestinare NON cambia lo stato della membership — la riga resta com'era e si
 * nasconde solo per la `deletedAt`.
 */
export const buildListMembersWhere = (workspaceId: string) =>
  notDeleted({
    workspaceId,
  });

/** La clausola del singolo membro letto dalla scheda Team (CRMA-130). */
export const buildFindMemberByIdWhere = (workspaceId: string, memberId: string) =>
  notDeleted({
    workspaceId,
    id: memberId,
  });

/**
 * Il `where` del gesto «rimuovi dal Team», che dal 11/9/2026 cestina (CRMA-165).
 *
 * `userId` c'e' oltre a `id` perche' c'era gia' nella cancellazione fisica che
 * questo gesto sostituisce: chi chiama ha appena letto quella membership e
 * dichiara di quale persona sia. Se i due non combaciano la scrittura non
 * avviene, e il servizio risponde 404 invece di cestinare la riga sbagliata.
 */
export const buildTrashMembershipWhere = (
  workspaceId: string,
  memberId: string,
  userId: string,
) =>
  notDeleted({
    workspaceId,
    id: memberId,
    userId,
  });

export const teamRepository = {
  async listMembers(workspaceId: string): Promise<TeamMemberRecord[]> {
    const memberships = await prisma.membership.findMany({
      where: buildListMembersWhere(workspaceId),
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
      where: buildFindMemberByIdWhere(workspaceId, memberId),
      select: buildMembershipSelect(workspaceId),
    });

    if (!membership) {
      return null;
    }

    return mapMembershipToTeamMember(membership);
  },

  /**
   * ⚠️ Questa NON prende `notDeleted`, ed e' l'unica lettura del Team che non lo
   * prende (CRMA-130).
   *
   * Non e' una lista: e' la prova di unicita' che gira PRIMA di creare una
   * membership. La coppia `(workspaceId, userId)` e' unica anche da cestinata
   * (`prisma/schema.prisma`, `@@unique([workspaceId, userId])` sul modello
   * `Membership`), quindi nascondere qui la riga cestinata direbbe al chiamante
   * «questa persona non c'e'», lui proverebbe a inserirla, e l'inserimento
   * sbatterebbe sul vincolo: un 500 al posto di un messaggio.
   *
   * Percio' la riga cestinata si legge, e si restituisce `deletedAt` perche' chi
   * chiama possa dire la cosa vera — «e' nel Cestino, ripristinala» invece di
   * «e' gia' un membro», che manderebbe a cercare il guasto nella lista Team
   * dove quella persona giustamente non compare.
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
      select: {
        id: true,
        status: true,
        deletedAt: true,
      },
    });
  },

  createMembership(
    workspaceId: string,
    userId: string,
    tx?: Prisma.TransactionClient,
  ) {
    return withClient(tx).membership.create({
      data: {
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
      where: {
        workspaceId,
        id: memberId,
      },
      data: {
        status,
      },
    });

    return updated.count > 0;
  },

  /**
   * Sposta un membro nel cestino (CRMA-165).
   *
   * Ha preso il posto di `deleteMember` nella rimozione dal Team: quella
   * resta qui sotto, ma da oggi e' il gesto dell'eliminazione definitiva
   * (`trash.purge`, CRMA-135) e non piu' quello che si esercita da «Rimuovi».
   *
   * Non serve una transazione, a differenza della cancellazione fisica: li'
   * erano due scritture da tenere insieme (membership + assegnazioni), qui e'
   * una sola riga, e le assegnazioni si lasciano dov'erano apposta.
   *
   * `notDeleted` nel `where` evita che un secondo "rimuovi" sulla stessa
   * persona riscriva data e autore del primo.
   */
  async markMemberTrashed(
    workspaceId: string,
    memberId: string,
    userId: string,
    actorUserId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<boolean> {
    const trashed = await withClient(tx).membership.updateMany({
      where: buildTrashMembershipWhere(workspaceId, memberId, userId),
      data: markTrashed(actorUserId),
    });

    return trashed.count > 0;
  },

  /**
   * Distrugge davvero la membership e le sue assegnazioni di ruolo.
   *
   * ⚠️ Dal 11/9/2026 questa NON e' piu' la rimozione dal Team: e'
   * l'eliminazione definitiva dal Cestino, e il suo unico chiamante sara' la
   * rotta dietro `trash.purge` (CRMA-135). Resta qui, invece di essere
   * riscritta la' da zero, perche' la cancellazione a due scritture dentro una
   * transazione e' gia' giusta e riscriverla sarebbe l'occasione per sbagliarla.
   * Chi la chiama deve prima passare da `assertMembershipDestroyable`.
   */
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
