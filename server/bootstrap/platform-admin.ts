import type { PrismaClient } from '@prisma/client';

type MinimalLogger = {
  info: (obj: unknown, msg?: string) => void;
  warn: (obj: unknown, msg?: string) => void;
};

// Estrae e normalizza la lista di email da PLATFORM_ADMIN_EMAILS (separate da virgola).
export const parsePlatformAdminEmails = (raw: string | undefined | null): string[] => {
  if (!raw) {
    return [];
  }

  const seen = new Set<string>();
  for (const chunk of raw.split(',')) {
    const email = chunk.trim().toLowerCase();
    if (email) {
      seen.add(email);
    }
  }

  return [...seen];
};

// All'avvio promuove a Super Admin di piattaforma gli utenti la cui email compare
// in PLATFORM_ADMIN_EMAILS. E' l'unico modo per creare il PRIMO platform admin
// (rompe il paradosso "chi promuove il primo?"): la fonte e' la configurazione del
// server, non un altro utente. Da li' in poi le promozioni avvengono dalla console.
// La funzione e' idempotente e NON declassa nessuno: chi e' stato promosso dalla
// console resta admin anche se non compare nella variabile d'ambiente.
export const bootstrapPlatformAdmins = async ({
  prisma,
  emailsRaw,
  logger,
}: {
  prisma: Pick<PrismaClient, 'user'>;
  emailsRaw: string | undefined | null;
  logger: MinimalLogger;
}): Promise<{ promoted: string[]; notFound: string[] }> => {
  const emails = parsePlatformAdminEmails(emailsRaw);
  if (emails.length === 0) {
    return { promoted: [], notFound: [] };
  }

  const existingUsers = await prisma.user.findMany({
    where: { email: { in: emails } },
    select: { id: true, email: true, isPlatformAdmin: true },
  });

  const foundByEmail = new Map(existingUsers.map((user) => [user.email.toLowerCase(), user]));
  const notFound = emails.filter((email) => !foundByEmail.has(email));

  const toPromote = existingUsers.filter((user) => !user.isPlatformAdmin);
  if (toPromote.length > 0) {
    await prisma.user.updateMany({
      where: { id: { in: toPromote.map((user) => user.id) } },
      data: { isPlatformAdmin: true },
    });
  }

  const promoted = toPromote.map((user) => user.email);

  if (promoted.length > 0) {
    logger.info({ promoted }, 'Platform admins promoted from PLATFORM_ADMIN_EMAILS');
  }
  if (notFound.length > 0) {
    logger.warn(
      { notFound },
      'Some PLATFORM_ADMIN_EMAILS have no matching user yet; they will be promoted once they register',
    );
  }

  return { promoted, notFound };
};
