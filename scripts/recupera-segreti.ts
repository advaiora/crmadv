/**
 * Legge i segreti cifrati dentro un database del CRM e li ristampa in chiaro,
 * usando la ENCRYPTION_KEY del `.env` che sta accanto a quel database.
 *
 *   npx tsx scripts/recupera-segreti.ts [opzioni]
 *
 * Serve a recuperare le chiavi API (OpenAI, Anthropic), la password del server
 * di posta e le voci del Vault da un'installazione precedente — per esempio il
 * CRM di sviluppo sul PC locale — senza doverle reinserire a mano.
 *
 * Opzioni:
 *   --mostra          stampa i valori per intero. Senza questa opzione i segreti
 *                     sono mascherati: si vede QUANTI sono e SE sono leggibili,
 *                     ma non il contenuto. Serve a poter lanciare lo script su un
 *                     terminale condiviso senza far comparire una chiave API.
 *   --env <percorso>  file `.env` da cui leggere DATABASE_URL e ENCRYPTION_KEY.
 *                     Predefinito: il `.env` nella radice del progetto.
 *
 * Le due variabili devono essere quelle dello STESSO impianto: la ENCRYPTION_KEY
 * di un'installazione non apre il database di un'altra. Se non combaciano lo
 * script lo dice esplicitamente, invece di stampare zero segreti come se non ce
 * ne fossero.
 *
 * Usa gli stessi moduli di cifratura del CRM (`server/modules/vault/crypto`),
 * quindi non puo' divergere dal modo in cui l'applicazione scrive i dati.
 */
import { readFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';
import { decryptAESGCM } from '../server/modules/vault/crypto/aesGcm.js';
import { parseMasterKeyFromEnv } from '../server/modules/vault/crypto/masterKey.js';

const flags = process.argv.slice(2);
const mostraInChiaro = flags.includes('--mostra');

const readFlagValue = (name: string) => {
  const index = flags.indexOf(name);
  if (index === -1) {
    return null;
  }
  const value = flags[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`L'opzione ${name} vuole un valore (es. ${name} ../vecchio/.env).`);
  }
  return value.trim();
};

/**
 * Carica il `.env` indicato SENZA sovrascrivere l'ambiente gia' presente, con una
 * eccezione: quando l'utente passa `--env` esplicitamente sta dicendo "voglio
 * quelle credenziali li'", quindi in quel caso il file vince. Senza questa
 * distinzione, un DATABASE_URL gia' esportato nella shell dirotterebbe in
 * silenzio la lettura sul database sbagliato.
 */
const loadEnvFile = (path: string, sovrascrivi: boolean) => {
  let contenuto: string;
  try {
    contenuto = readFileSync(path, 'utf8');
  } catch {
    return false;
  }

  for (const riga of contenuto.split(/\r?\n/)) {
    const m = riga.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!m) {
      continue;
    }
    const [, chiave, grezzo] = m;
    if (!sovrascrivi && process.env[chiave] !== undefined) {
      continue;
    }
    process.env[chiave] = grezzo.replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1');
  }

  return true;
};

const envEsplicito = readFlagValue('--env');
const envPath = envEsplicito ?? new URL('../.env', import.meta.url).pathname;
const envTrovato = loadEnvFile(envPath, Boolean(envEsplicito));

const maschera = (valore: string) => {
  if (mostraInChiaro) {
    return valore;
  }
  if (valore.length <= 8) {
    return `${'•'.repeat(valore.length)}  (${valore.length} caratteri)`;
  }
  return `${valore.slice(0, 4)}${'•'.repeat(12)}${valore.slice(-4)}  (${valore.length} caratteri)`;
};

const decodeBase64 = (value: string) => Buffer.from(value, 'base64');

type Cifrato = {
  ciphertext: string | null;
  iv: string | null;
  authTag: string | null;
  keyVersion: number | null;
};

const main = async () => {
  if (!envTrovato) {
    throw new Error(
      `Non trovo il file ${envPath}. Indicane uno con --env <percorso>, oppure lancia lo ` +
        'script dalla radice del progetto dove sta il `.env`.',
    );
  }

  if (!process.env.DATABASE_URL) {
    throw new Error(`In ${envPath} manca DATABASE_URL: non so a quale database collegarmi.`);
  }

  // Fallisce subito e con un messaggio chiaro se la chiave non e' una chiave valida,
  // invece di arrivare a fine giro con "0 segreti leggibili".
  const masterKey = parseMasterKeyFromEnv(process.env.ENCRYPTION_KEY);

  console.log(`File di configurazione : ${envPath}`);
  console.log(`Database               : ${process.env.DATABASE_URL.replace(/:[^:@/]+@/, ':****@')}`);
  console.log(`ENCRYPTION_KEY         : presente e valida (32 byte)`);
  if (!mostraInChiaro) {
    console.log('\nI valori sono mascherati. Rilancia con --mostra per vederli per intero.');
  }

  // --- Le chiavi in chiaro nel .env: il caso piu' semplice, nessuna cifratura ---
  const dallEnv = (['OPENAI_API_KEY', 'ANTHROPIC_API_KEY'] as const)
    .map((nome) => ({ nome, valore: process.env[nome]?.trim() }))
    .filter((riga): riga is { nome: string; valore: string } => Boolean(riga.valore));

  console.log('\n=== Chiavi scritte direttamente nel .env (nessuna cifratura) ===');
  if (dallEnv.length === 0) {
    console.log('(nessuna)');
  } else {
    for (const { nome, valore } of dallEnv) {
      console.log(`  ${nome} = ${maschera(valore)}`);
    }
  }

  const prisma = new PrismaClient();

  try {
    const workspaces = await prisma.workspace.findMany({ orderBy: { createdAt: 'asc' } });
    console.log(`\n=== Workspace nel database: ${workspaces.length} ===`);

    let totaleLetti = 0;
    let totaleIlleggibili = 0;

    for (const workspace of workspaces) {
      console.log(`\n--- Workspace "${workspace.slug}" (${workspace.name}) ---`);

      // La chiave di ogni workspace (DEK) sta nel database, avvolta con la
      // ENCRYPTION_KEY. Senza di lei non si apre niente altro, quindi si parte da qui.
      const chiaviWorkspace = await prisma.workspaceVaultKey.findMany({
        where: { workspaceId: workspace.id },
        orderBy: { keyVersion: 'asc' },
      });

      if (chiaviWorkspace.length === 0) {
        console.log('Nessuna chiave di workspace: qui non e mai stato salvato niente di cifrato.');
        continue;
      }

      const dekPerVersione = new Map<number, Buffer>();
      for (const record of chiaviWorkspace) {
        if (!record.iv || !record.authTag) {
          console.log(`  chiave v${record.keyVersion}: incompleta, la salto.`);
          continue;
        }
        try {
          dekPerVersione.set(
            record.keyVersion,
            decryptAESGCM({
              key: masterKey,
              ciphertext: decodeBase64(record.wrappedKey),
              iv: decodeBase64(record.iv),
              authTag: decodeBase64(record.authTag),
              aad: Buffer.from(
                `vault:workspace-dek:v${record.keyVersion}|workspace:${workspace.id}`,
                'utf8',
              ),
            }),
          );
        } catch {
          console.log(
            `  chiave v${record.keyVersion}: NON si apre con questa ENCRYPTION_KEY. ` +
              'Il database e la chiave vengono da due installazioni diverse.',
          );
        }
      }

      if (dekPerVersione.size === 0) {
        totaleIlleggibili += 1;
        continue;
      }

      const apri = (record: Cifrato, aad: string) => {
        if (!record.ciphertext || !record.iv || !record.authTag) {
          return null;
        }
        const dek = dekPerVersione.get(record.keyVersion ?? 1);
        if (!dek) {
          return null;
        }
        return decryptAESGCM({
          key: dek,
          ciphertext: decodeBase64(record.ciphertext),
          iv: decodeBase64(record.iv),
          authTag: decodeBase64(record.authTag),
          aad: Buffer.from(aad, 'utf8'),
        }).toString('utf8');
      };

      const stampa = (etichetta: string, valore: string | null) => {
        if (valore === null) {
          console.log(`  ${etichetta}: illeggibile`);
          totaleIlleggibili += 1;
          return;
        }
        console.log(`  ${etichetta}: ${maschera(valore)}`);
        totaleLetti += 1;
      };

      // --- Chiavi API salvate da Impostazioni -> Agency ---
      const impostazioni = await prisma.agencyRuntimeSetting.findMany({
        where: { workspaceId: workspace.id, ciphertext: { not: null } },
        orderBy: { key: 'asc' },
      });
      console.log(`Chiavi API (Impostazioni Agency): ${impostazioni.length}`);
      for (const record of impostazioni) {
        stampa(
          record.key,
          apri(
            record,
            `agency-runtime-setting:v1|workspace:${workspace.id}|key:${record.key}`,
          ),
        );
      }

      // --- Password del server di posta (Profilo -> Server di posta) ---
      const posta = await prisma.mailServerSettings.findUnique({
        where: { workspaceId: workspace.id },
      });
      if (posta?.ciphertext) {
        console.log(`Server di posta: ${posta.server}:${posta.porta} (utente ${posta.utente ?? '-'})`);
        stampa(
          'password SMTP',
          apri(posta, `mail-secret|workspace:${workspace.id}|field:password`),
        );
      }

      // --- Connettori esterni ---
      const integrazioni = await prisma.integration.findMany({
        where: { workspaceId: workspace.id, ciphertext: { not: null } },
        orderBy: { provider: 'asc' },
      });
      for (const record of integrazioni) {
        stampa(
          `integrazione ${record.provider}`,
          apri(
            record,
            `integration-secret|workspace:${workspace.id}|provider:${record.provider}`,
          ),
        );
      }

      // --- Vault (le credenziali dei clienti) ---
      const vociVault = await prisma.vaultItem.findMany({
        where: { workspaceId: workspace.id },
        orderBy: { name: 'asc' },
      });
      console.log(`Voci nel Vault: ${vociVault.length}`);
      for (const voce of vociVault) {
        stampa(
          `vault "${voce.name}"${voce.username ? ` (${voce.username})` : ''}`,
          apri(voce, `vault:v1|workspace:${workspace.id}|item:${voce.id}`),
        );
      }
    }

    console.log(
      `\n=== Totale: ${totaleLetti} segreti letti, ${totaleIlleggibili} illeggibili ===`,
    );
    if (totaleLetti === 0 && totaleIlleggibili === 0) {
      console.log(
        'Il database non contiene nessun segreto cifrato. Non e un problema di chiave: ' +
          'non e mai stato salvato niente da recuperare.',
      );
    }
  } finally {
    await prisma.$disconnect();
  }
};

main().catch((errore: unknown) => {
  console.error(`\nERRORE: ${errore instanceof Error ? errore.message : String(errore)}`);
  process.exit(1);
});
