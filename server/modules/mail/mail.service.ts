import type { FastifyRequest } from 'fastify';
import { z } from 'zod';
import { audit } from '../../audit/audit.js';
import { badRequest } from '../../core/errors.js';
import {
  createMailTransport,
  readMailSettingsFromEnv,
  resolveMailSettingsDettagliato,
  type MailSettings,
} from '../../core/mail.js';
import { mailCrypto } from './mail.crypto.js';
import { mailRepository } from './mail.repository.js';

/**
 * Un mittente valido e' o un indirizzo nudo (`noreply@studio.it`) o un
 * indirizzo con davanti il nome da mostrare (`Studio <noreply@studio.it>`).
 * La seconda forma e' quella che si vede nella casella di chi riceve, quindi
 * rifiutarla costringerebbe a spedire da un mittente senza nome.
 */
const MITTENTE_CON_NOME = /^\s*[^<>]{1,120}<\s*([^<>\s@]+@[^<>\s@]+\.[^<>\s@]+)\s*>\s*$/;
const INDIRIZZO_NUDO = /^[^<>\s@]+@[^<>\s@]+\.[^<>\s@]+$/;

const mittenteSchema = z
  .string()
  .trim()
  .min(1)
  .max(255)
  .refine(
    (value) => INDIRIZZO_NUDO.test(value) || MITTENTE_CON_NOME.test(value),
    'Il mittente deve essere un indirizzo email, eventualmente preceduto dal nome da mostrare (es. Studio <noreply@studio.it>)',
  );

export const salvaImpostazioniMailSchema = z
  .object({
    attivo: z.boolean().default(true),
    server: z.string().trim().min(1).max(255),
    porta: z.coerce.number().int().min(1).max(65535).default(587),
    connessioneSicura: z.boolean().default(false),
    /**
     * Autorizza la prova di connessione a raggiungere un indirizzo della rete
     * interna. `default(false)` e non `optional`: una maschera vecchia che non
     * manda il campo deve ricadere sul blocco, non lasciarlo com'era.
     */
    retePrivataConsentita: z.boolean().default(false),
    utente: z.string().trim().max(255).nullable().optional(),
    mittente: mittenteSchema,
    /**
     * Assente o stringa vuota = non si tocca la password gia' salvata: e' quello
     * che succede quando si modifica la porta senza voler ridigitare il segreto.
     * `null` esplicito = togliere la password (server di posta senza
     * autenticazione).
     */
    password: z.string().max(255).nullable().optional(),
  })
  .strict();

export type SalvaImpostazioniMailBody = z.infer<typeof salvaImpostazioniMailSchema>;

/**
 * Quello che il CRM sta usando adesso per spedire, e da dove viene.
 *
 * `illeggibile` non e' un caso teorico ed e' il motivo per cui questa pagina
 * esiste: la configurazione c'e', ma la sua password non si decifra piu'.
 * Appiattirlo su `nessuna` farebbe dire alla pagina "nessun server
 * configurato" mentre la maschera davanti a chi legge e' piena — e lo
 * manderebbe a riscrivere parametri che erano gia' giusti.
 */
export type OrigineConfigurazione = 'database' | 'env' | 'nessuna' | 'illeggibile';

/**
 * L'esito della prova di connessione. Porta sempre `origine` e `server`, anche
 * quando riesce: sono quelli che dicono su COSA e' stata fatta la prova.
 */
export type EsitoProva =
  | { riuscita: true; origine: OrigineConfigurazione; server: string | null }
  | { riuscita: false; origine: OrigineConfigurazione; server: string | null; errore: string };

export type ImpostazioniMailPubbliche = {
  /** `true` se esiste una configurazione salvata nel CRM per questo workspace. */
  configurata: boolean;
  /** Cosa sta usando il CRM adesso per spedire davvero. */
  origineInUso: OrigineConfigurazione;
  /** `true` se una password e' salvata. Il valore non esce mai da qui. */
  passwordSalvata: boolean;
  attivo: boolean;
  /**
   * I campi della maschera. Quando non c'e' ancora una configurazione salvata
   * arrivano dalle variabili d'ambiente, cosi' chi apre la pagina la prima
   * volta trova gia' scritto quello che il CRM sta usando invece di dover
   * ridigitare tutto a mano da un file che magari non ha davanti.
   */
  server: string;
  porta: number;
  connessioneSicura: boolean;
  /** Se la prova di connessione puo' raggiungere la rete interna. */
  retePrivataConsentita: boolean;
  utente: string | null;
  mittente: string;
  aggiornatoIl: string | null;
};

const dallAmbiente = (env: MailSettings | null) => ({
  server: env?.host ?? '',
  porta: env?.port ?? 587,
  connessioneSicura: env?.secure ?? false,
  utente: env?.user ?? null,
  mittente: env?.from ?? '',
});

type MailServiceDependencies = {
  repository: typeof mailRepository;
  crypto: typeof mailCrypto;
  /**
   * Iniettate — invece di chiamate dirette — perche' altrimenti non si potrebbe
   * provare per davvero la regola che conta di questo modulo: una password
   * lasciata in bianco non deve cancellare quella gia' salvata. Senza questo,
   * un test dovrebbe passare da database e cifratura veri per verificare una
   * decisione che sta tutta in tre righe.
   */
  resolveSettings: typeof resolveMailSettingsDettagliato;
  leggiAmbiente: typeof readMailSettingsFromEnv;
  registraAudit: typeof audit.log;
};

export const buildMailService = (
  overrides: Partial<MailServiceDependencies> = {},
) => {
  const dependencies: MailServiceDependencies = {
    repository: overrides.repository ?? mailRepository,
    crypto: overrides.crypto ?? mailCrypto,
    resolveSettings: overrides.resolveSettings ?? resolveMailSettingsDettagliato,
    leggiAmbiente: overrides.leggiAmbiente ?? readMailSettingsFromEnv,
    registraAudit: overrides.registraAudit ?? ((input) => audit.log(input)),
  };

  /**
   * Lo stato della configurazione, senza mai la password.
   * Dice anche COSA STA USANDO IL CRM in questo momento (`origineInUso`): se la
   * pagina mostrasse solo quello che c'e' a database, un workspace non ancora
   * configurato sembrerebbe "senza posta" mentre invece sta spedendo benissimo
   * con le variabili d'ambiente.
   */
  const getImpostazioni = async (workspaceId: string): Promise<ImpostazioniMailPubbliche> => {
    const record = await dependencies.repository.findByWorkspaceId(workspaceId);
    const inUso = await dependencies.resolveSettings(workspaceId);
    const origineInUso: OrigineConfigurazione =
      inUso.esito === 'ok' ? inUso.source : inUso.esito === 'illeggibile' ? 'illeggibile' : 'nessuna';

    if (!record) {
      return {
        configurata: false,
        origineInUso,
        passwordSalvata: false,
        attivo: true,
        // Senza riga a database non c'e' nessuna autorizzazione dichiarata: la
        // maschera nasce con la spunta spenta anche quando si precompila con le
        // variabili d'ambiente.
        retePrivataConsentita: false,
        ...dallAmbiente(dependencies.leggiAmbiente()),
        aggiornatoIl: null,
      };
    }

    return {
      configurata: true,
      origineInUso,
      passwordSalvata: Boolean(record.ciphertext),
      attivo: record.attivo,
      server: record.server,
      porta: record.porta,
      connessioneSicura: record.connessioneSicura,
      retePrivataConsentita: record.retePrivataConsentita,
      utente: record.utente,
      mittente: record.mittente,
      aggiornatoIl: record.updatedAt.toISOString(),
    };
  };

  return {
    getImpostazioni,

    async salvaImpostazioni(input: {
      workspaceId: string;
      actorUserId: string;
      body: unknown;
      request?: FastifyRequest;
    }): Promise<ImpostazioniMailPubbliche> {
      const parsed = salvaImpostazioniMailSchema.safeParse(input.body ?? {});
      if (!parsed.success) {
        throw badRequest('Impostazioni del server di posta non valide', {
          issues: parsed.error.flatten(),
        });
      }

      const dati = parsed.data;
      const utente = dati.utente?.trim() ? dati.utente.trim() : null;
      // La ripulitura degli spazi ai bordi si fa QUI e solo qui: una spaziatura
      // incollata per sbaglio nel campo farebbe rifiutare l'autenticazione senza
      // che si capisca perche', e la password non si puo' rileggere per
      // accorgersene. Ripulirla anche in lettura, invece, farebbe divergere il
      // valore salvato da quello usato.
      const passwordRipulita = typeof dati.password === 'string' ? dati.password.trim() : dati.password;
      const passwordDaSalvare =
        typeof passwordRipulita === 'string' && passwordRipulita.length > 0
          ? passwordRipulita
          : undefined;

      const esistente = await dependencies.repository.findByWorkspaceId(input.workspaceId);

      let segreto: Parameters<typeof dependencies.repository.upsert>[0]['segreto'];
      if (passwordDaSalvare !== undefined) {
        segreto = await dependencies.crypto.encrypt({
          workspaceId: input.workspaceId,
          value: passwordDaSalvare,
        });
      } else if (passwordRipulita === null) {
        segreto = null;
      } else {
        segreto = undefined;
      }

      // Un utente senza password non si autentica: se si toglie l'utente si
      // toglie anche il segreto, o resterebbe cifrato a database una password
      // che nessuno usa piu'.
      if (!utente && segreto === undefined && esistente?.ciphertext) {
        segreto = null;
      }

      await dependencies.repository.upsert({
        workspaceId: input.workspaceId,
        attivo: dati.attivo,
        server: dati.server,
        porta: dati.porta,
        connessioneSicura: dati.connessioneSicura,
        retePrivataConsentita: dati.retePrivataConsentita,
        utente,
        mittente: dati.mittente,
        segreto,
      });

      await dependencies.registraAudit({
        event: 'mail.save',
        actorUserId: input.actorUserId,
        workspaceId: input.workspaceId,
        entityType: 'MailServerSettings',
        entityId: input.workspaceId,
        metadata: {
          server: dati.server,
          porta: dati.porta,
          connessioneSicura: dati.connessioneSicura,
          retePrivataConsentita: dati.retePrivataConsentita,
          attivo: dati.attivo,
          // Che la password sia cambiata si annota; il valore no, mai.
          passwordCambiata: passwordDaSalvare !== undefined,
          passwordRimossa: segreto === null,
        },
        request: input.request,
      });

      return getImpostazioni(input.workspaceId);
    },

    /**
     * Apre la connessione al server e si autentica, senza spedire niente a
     * nessuno. E' la differenza fra "salvato" e "funziona": senza questa prova
     * il primo a scoprire che le credenziali sono sbagliate sarebbe qualcuno
     * che non riceve un invito.
     */
    async provaConnessione(input: {
      workspaceId: string;
      actorUserId: string;
      request?: FastifyRequest;
    }): Promise<EsitoProva> {
      const resolved = await dependencies.resolveSettings(input.workspaceId);

      // ⚠️ `origine` e `server` tornano SEMPRE, anche quando la prova riesce.
      // Senza, mettendo in pausa la configurazione si legge "connessione
      // riuscita" avendo pero' collaudato il server delle variabili d'ambiente
      // invece di quello scritto nella maschera — cioe' la prova direbbe il
      // vero su una domanda diversa da quella che si e' fatta.
      const esito: EsitoProva = await (async () => {
        if (resolved.esito === 'illeggibile') {
          return {
            riuscita: false as const,
            origine: 'illeggibile' as const,
            server: null,
            errore:
              "Il server di posta è configurato, ma il CRM non riesce più a leggerne la password: succede quando cambia la chiave di cifratura del server, o quando il database arriva da un altro ambiente. Reinserisci la password e salva.",
          };
        }

        if (resolved.esito !== 'ok') {
          return {
            riuscita: false as const,
            origine: 'nessuna' as const,
            server: null,
            errore: 'Nessun server di posta configurato.',
          };
        }

        // Timeout espliciti: da qui in avanti l'indirizzo lo sceglie chi preme
        // il pulsante, e verso un IP filtrato `verify()` resterebbe appeso fino
        // al default di nodemailer (due minuti), con la richiesta aperta e il
        // pulsante che gira senza dire niente.
        const transport = createMailTransport(resolved.settings, {
          connectionTimeout: 10_000,
          greetingTimeout: 10_000,
          socketTimeout: 15_000,
        });
        try {
          await transport.verify();
          return {
            riuscita: true as const,
            origine: resolved.source,
            server: resolved.settings.host,
          };
        } catch (error) {
          return {
            riuscita: false as const,
            origine: resolved.source,
            server: resolved.settings.host,
            errore:
              error instanceof Error
                ? error.message
                : 'Il server di posta ha rifiutato la connessione.',
          };
        } finally {
          transport.close();
        }
      })();

      // La prova e' l'unica azione di questo modulo che tocca la rete, e apre
      // una connessione verso un indirizzo scelto da chi la lancia: e' proprio
      // quella che deve lasciare traccia, non solo il salvataggio.
      await dependencies.registraAudit({
        event: 'mail.test',
        actorUserId: input.actorUserId,
        workspaceId: input.workspaceId,
        entityType: 'MailServerSettings',
        entityId: input.workspaceId,
        metadata: {
          riuscita: esito.riuscita,
          origine: esito.origine,
          server: esito.server,
        },
        request: input.request,
      });

      return esito;
    },

    async eliminaImpostazioni(input: {
      workspaceId: string;
      actorUserId: string;
      request?: FastifyRequest;
    }): Promise<void> {
      await dependencies.repository.deleteByWorkspaceId(input.workspaceId);

      await dependencies.registraAudit({
        event: 'mail.delete',
        actorUserId: input.actorUserId,
        workspaceId: input.workspaceId,
        entityType: 'MailServerSettings',
        entityId: input.workspaceId,
        request: input.request,
      });
    },
  };
};

export const mailService = buildMailService();
