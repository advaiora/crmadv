import { forbidden, notFound } from '../../core/errors.js';
import { teamRepository, type TeamMemberRecord } from './team.repository.js';

/**
 * Le guardie che stanno davanti alle scritture sul Team (CRMA-165).
 *
 * ⚠️ Perche' un file suo, invece di restare dentro `team.service.ts` dov'erano
 * scritte: fino al 11/9/2026 la rimozione di un membro era **un** gesto solo,
 * e i suoi tre divieti potevano vivere dentro la funzione che li esercitava.
 * Dal Cestino in avanti i gesti sono due — `removeMember`, che sposta la riga
 * nel cestino, e l'eliminazione definitiva dietro `trash.purge` che arriva con
 * CRMA-135 — e gli stessi tre divieti valgono per tutti e due. Lasciarli dentro
 * il servizio avrebbe voluto dire, per la rotta `purge`, o importare mezzo
 * modulo Team o riscriverne una copia: e due copie di un controllo di sicurezza
 * divergono al primo che qualcuno corregge.
 *
 * La seconda ragione e' la soglia delle 500 righe: `team.service.ts` era a 465
 * e questa estrazione lo avrebbe portato a 519. Il codice nuovo nasce sotto
 * soglia (CLAUDE.md, «Dimensione dei file»).
 *
 * `team.service.ts` ri-esporta `assertMembershipDestroyable`, cosi' chi la
 * cerca da la' la trova lo stesso.
 */

/** Legge la membership o risponde 404. */
export const requireWorkspaceMemberById = async (workspaceId: string, memberId: string) => {
  const member = await teamRepository.findMemberById(workspaceId, memberId);
  if (!member) {
    throw notFound('Team member not found', {
      workspaceId,
      memberId,
    });
  }

  return member;
};

/**
 * I tre divieti che proteggono la rimozione di un membro, in ordine, e cosa
 * impediscono davvero:
 *
 *   1. **solo un Superadmin rimuove** — chiunque altro non tocca il Team;
 *   2. **non te stesso** — o un Superadmin distratto si chiude fuori;
 *   3. **non l'ultimo Superadmin attivo** — o il workspace resta senza nessuno
 *      che possa riaprirlo, ed e' l'unico dei tre danni che non ha rimedio
 *      dall'interno del CRM.
 *
 * Torna il membro gia' letto, cosi' chi chiama non lo rilegge: il controllo
 * vale per quella riga li', non per una rilettura successiva che nel frattempo
 * puo' essere cambiata.
 *
 * ⚠️ Il terzo divieto regge solo se il conteggio dei Superadmin esclude i
 * cestinati: un Superadmin nel cestino che continuasse a contare farebbe da
 * riempitivo, e la guardia lascerebbe passare la rimozione dell'ultimo
 * Superadmin **vero**. Quel filtro sta in `buildSuperadminAssignmentsWhere`
 * (CRMA-157) ed e' provato in `team.repository.test.ts`.
 */
export const assertMembershipDestroyable = async ({
  workspaceId,
  actorUserId,
  memberId,
}: {
  workspaceId: string;
  actorUserId: string;
  memberId: string;
}): Promise<TeamMemberRecord> => {
  const member = await requireWorkspaceMemberById(workspaceId, memberId);

  const actorIsSuperadmin = await teamRepository.isSuperadmin(workspaceId, actorUserId);
  if (!actorIsSuperadmin) {
    throw forbidden('Only Superadmin can remove team members');
  }

  if (member.userId === actorUserId) {
    throw forbidden('You cannot remove your own membership');
  }

  const targetIsActiveSuperadmin =
    member.status === 'ACTIVE'
    && member.roles.some((role) => role.isSuperadmin);

  if (targetIsActiveSuperadmin) {
    const activeSuperadminCount = await teamRepository.countActiveSuperadmins(workspaceId);
    if (activeSuperadminCount <= 1) {
      throw forbidden('Cannot remove the last active Superadmin in workspace', {
        workspaceId,
        memberId,
      });
    }
  }

  return member;
};
