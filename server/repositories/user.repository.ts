import type { Prisma } from '@prisma/client';
import { prisma } from '../prisma.js';

const userSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  isPlatformAdmin: true,
  themePreference: true,
  avatarUrl: true,
} as const;

// L'utente come lo vede la guardia di autenticazione: `userSelect` piu' la data
// dell'ultimo cambio password, che serve a decidere se il token in mano al
// chiamante e' piu' vecchio della password.
//
// ⚠️ `passwordChangedAt` NON va aggiunta a `userSelect`: quella select esce dalle
// risposte del profilo (`/auth/me`), e quando l'utente ha cambiato la password
// e' un dato che il CRM non ha motivo di pubblicare. La guardia lo legge da qui
// e lo scarta prima di restituire l'utente al resto del codice.
const authIdentitySelect = {
  ...userSelect,
  passwordChangedAt: true,
} as const;

const loginUserSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  isPlatformAdmin: true,
  passwordHash: true,
  vaultPasswordHash: true,
} as const;

export const userRepository = {
  findById(userId: string) {
    return prisma.user.findUnique({
      where: { id: userId },
      select: userSelect,
    });
  },

  findAuthIdentityById(userId: string) {
    return prisma.user.findUnique({
      where: { id: userId },
      select: authIdentitySelect,
    });
  },

  findByIdForLogin(userId: string) {
    return prisma.user.findUnique({
      where: { id: userId },
      select: loginUserSelect,
    });
  },

  findByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: userSelect,
    });
  },

  findByEmailForLogin(email: string) {
    return prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: loginUserSelect,
    });
  },

  async isPlatformAdmin(userId: string): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isPlatformAdmin: true },
    });
    return Boolean(user?.isPlatformAdmin);
  },

  // Restituisce `userSelect`, che NON contiene nessun hash: una funzione che
  // scrive una password non deve poterne far uscire una. (`updateVaultPasswordHash`
  // qui sotto restituisce invece `loginUserSelect`; non fa danno perche' il
  // chiamante scarta il risultato, ma non e' il dettaglio da copiare.)
  // Scrive SEMPRE anche `passwordChangedAt`: e' quella data a far cadere le
  // sessioni aperte con la password vecchia (`server/guards/requireAuth.ts`).
  // Lasciarla facoltativa avrebbe voluto dire un chiamante che se la dimentica e
  // una revoca che non avviene, senza nessun errore a segnalarlo.
  //
  // ⚠️ Non usarla per la password della cassaforte: quella ha
  // `updateVaultPasswordHash` qui sotto e non deve buttare fuori nessuno.
  //
  // Il `tx` facoltativo serve al recupero password: bruciare il token e scrivere
  // la password nuova devono riuscire o fallire INSIEME. Senza transazione
  // esistono due finali storti, e il secondo e' grave: token bruciato e password
  // vecchia (l'utente resta fuori e il suo link non vale piu'), oppure password
  // nuova e token ancora vergine (un link al portatore riutilizzabile).
  updatePasswordHash(
    userId: string,
    passwordHash: string,
    passwordChangedAt: Date = new Date(),
    tx?: Prisma.TransactionClient,
  ) {
    return (tx ?? prisma).user.update({
      where: { id: userId },
      data: { passwordHash, passwordChangedAt },
      select: userSelect,
    });
  },

  updateVaultPasswordHash(userId: string, vaultPasswordHash: string) {
    return prisma.user.update({
      where: { id: userId },
      data: { vaultPasswordHash },
      select: loginUserSelect,
    });
  },
};

export type AuthUser = Awaited<ReturnType<typeof userRepository.findById>>;
