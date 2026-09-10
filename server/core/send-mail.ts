import {
  getDevPreviewUrl,
  isDevelopment,
  resolveMailTransportDettagliato,
  type EsitoCanaleDiPosta,
  type MailSettingsSource,
} from './mail.js';

/**
 * L'unico punto da cui il backend spedisce posta.
 *
 * `core/mail.ts` risponde alla domanda «con quali parametri si spedisce»;
 * questo file risponde a «cosa succede quando si spedisce davvero» — e sono due
 * domande diverse che prima venivano risolte due volte, una per ogni mittente.
 * Fino al 10/9/2026 l'invito al Team e le notifiche dei preventivi risolvevano
 * il canale dallo stesso posto ma poi facevano ciascuno il proprio
 * `transport.sendMail`, il proprio `try/catch` e la propria traduzione degli
 * errori: due copie della stessa logica, che divergevano a ogni ritocco (una
 * scriveva il link di anteprima, l'altra no; nessuna delle due lasciava una
 * riga di log quando la posta non era configurata).
 *
 * Da qui in avanti: chi deve spedire chiama `sendMail` e legge l'esito. Chi ha
 * bisogno di `nodemailer` direttamente e' solo `core/mail.ts`, che costruisce i
 * trasporti; nessun altro file del backend lo importa.
 *
 * ⚠️ L'unica eccezione consapevole e' la «Prova connessione» della pagina
 * *Server di posta* (`modules/mail/mail.service.ts`), che chiama
 * `createMailTransport` per fare `verify()` con timeout propri. Non spedisce
 * niente: prova solo se un indirizzo risponde. Passare da qui non avrebbe senso
 * — non c'e' nessun messaggio da mandare.
 */

/** Un allegato, nella forma che nodemailer accetta. */
export type AllegatoDiPosta = {
  filename: string;
  content: Buffer;
  contentType?: string;
};

export type MessaggioDiPosta = {
  to: string;
  subject: string;
  text: string;
};

export type InvioDiPosta = {
  /**
   * Il workspace di cui usare il server configurato dalla pagina «Server di
   * posta». Senza, valgono solo le variabili d'ambiente — che e' il
   * comportamento giusto per le spedizioni che non appartengono a nessun
   * workspace, non un ripiego da correggere.
   */
  workspaceId?: string | null;
  messaggio: MessaggioDiPosta;
  /**
   * Gli allegati, costruiti su richiesta e non prima.
   *
   * E' una funzione, non un elenco gia' pronto, e il motivo e' concreto:
   * l'allegato delle notifiche dei preventivi e' un PDF che va disegnato, e
   * disegnarlo costa secondi. Se il workspace non ha nessun server di posta
   * configurato, quel PDF non lo leggerebbe nessuno. Passandolo come funzione,
   * si costruisce SOLO dopo che il canale risulta pronto.
   *
   * ⚠️ Se la preparazione fallisce, l'eccezione risale a chi ha chiamato invece
   * di diventare un `rifiutata`: un PDF che non si disegna e' un guasto di chi
   * produce l'allegato, non un rifiuto del server di posta, e confonderli
   * manderebbe a controllare la posta per un problema che sta altrove.
   */
  preparaAllegati?: () => Promise<AllegatoDiPosta[]>;
  /**
   * Etichetta breve di chi sta spedendo («invito al Team», «notifica
   * preventivo»). Finisce nei log: senza, una riga di errore dice che la posta
   * non e' configurata ma non dice quale funzione del CRM se ne e' accorta.
   */
  motivo: string;
  /**
   * Se in sviluppo, senza nessun server configurato, si puo' ripiegare su un
   * trasporto finto (Ethereal, o i log) invece di rinunciare.
   *
   * ⚠️ Non e' un interruttore di comodo, e non va acceso «per uniformita'».
   * Vale per la posta di servizio, dove l'importante e' poter collaudare il
   * flusso (l'invito al Team). NON vale per la posta che parla a un cliente:
   * una notifica di preventivo non deve mai risultare recapitata perche' e'
   * finita in una casella finta.
   */
  ripiegoDiSviluppo?: boolean;
};

/**
 * L'esito, con i guasti tenuti distinti fino a chi deve spiegarli.
 *
 * `non-configurata` = non c'e' nessun server di posta, ne' nel CRM ne'
 * nell'ambiente: si risolve configurando.
 * `illeggibile` = il server c'e' ma la sua password non si decifra, cioe' la
 * chiave di cifratura e' cambiata: si risolve reinserendo la password, NON
 * riscrivendo i parametri (che erano gia' giusti).
 * `rifiutata` = il server c'e', ha risposto, e ha detto di no.
 */
export type EsitoInvio =
  | {
      esito: 'inviata';
      source: MailSettingsSource;
      /**
       * `false` quando il messaggio e' finito in un trasporto finto (Ethereal o
       * i log) e quindi non e' arrivato a nessuna casella vera.
       *
       * ⚠️ E' il campo che tiene in piedi la regola «mai un invio che sembra
       * riuscito e non lo e'». Chi mappa questo esito su un «email inviata»
       * mostrato a schermo deve guardare qui, non solo `esito`.
       */
      recapitata: boolean;
      providerMessageId: string | null;
      /** Il link per leggere il messaggio nella casella finta di sviluppo. */
      previewUrl: string | null;
    }
  | { esito: 'non-configurata' }
  | { esito: 'illeggibile' }
  | { esito: 'rifiutata'; errore: unknown };

export type SendMailFn = (input: InvioDiPosta) => Promise<EsitoInvio>;

/** Le sorgenti che recapitano davvero. Le altre due sono finte. */
const RECAPITA_DAVVERO: ReadonlySet<MailSettingsSource> = new Set<MailSettingsSource>([
  'database',
  'env',
]);

type SendMailDependencies = {
  resolveTransportFn: (options: {
    workspaceId?: string | null;
    allowDevFallback?: boolean;
  }) => Promise<EsitoCanaleDiPosta>;
  /** Iniettabile per i test: verificare che una riga di log ci sia e' parte del contratto. */
  registra: (livello: 'info' | 'errore', messaggio: string, dettagli?: unknown) => void;
};

const defaultDependencies: SendMailDependencies = {
  resolveTransportFn: resolveMailTransportDettagliato,
  registra: (livello, messaggio, dettagli) => {
    if (livello === 'errore') {
      if (dettagli === undefined) {
        console.error(`[Posta] ${messaggio}`);
        return;
      }
      console.error(`[Posta] ${messaggio}`, dettagli);
      return;
    }

    if (dettagli === undefined) {
      console.info(`[Posta] ${messaggio}`);
      return;
    }
    console.info(`[Posta] ${messaggio}`, dettagli);
  },
};

const descriviErrore = (errore: unknown) =>
  errore instanceof Error ? errore.message : 'errore sconosciuto';

export const buildSendMail = (
  dependencies: SendMailDependencies = defaultDependencies,
): SendMailFn => {
  const { resolveTransportFn, registra } = dependencies;

  return async (input) => {
    const canale = await resolveTransportFn({
      workspaceId: input.workspaceId ?? null,
      allowDevFallback: input.ripiegoDiSviluppo ?? false,
    });

    if (canale.esito === 'illeggibile') {
      // Errore in entrambi gli ambienti: e' un guasto, non una configurazione
      // mancante, e in sviluppo non lo si aggira col trasporto finto.
      registra(
        'errore',
        `${input.motivo}: il server di posta e' configurato nel CRM ma la sua password non si`
        + ' decifra (la chiave di cifratura ENCRYPTION_KEY e\' cambiata). Il messaggio NON e\''
        + ' partito; va reinserita la password nella pagina «Server di posta».',
      );
      return { esito: 'illeggibile' };
    }

    if (canale.esito !== 'ok') {
      // In produzione l'assenza di configurazione e' un errore che qualcuno
      // deve leggere: senza questa riga, un invito che non parte non lascia
      // nessuna traccia lato server e sembra un problema di chi l'ha ricevuto.
      registra(
        isDevelopment() ? 'info' : 'errore',
        `${input.motivo}: nessun server di posta configurato (ne' nella pagina «Server di posta»`
        + ' del workspace, ne\' nella variabile d\'ambiente SMTP_HOST). Il messaggio NON e\''
        + ` partito. Destinatario: ${input.messaggio.to}; oggetto: "${input.messaggio.subject}".`,
      );
      return { esito: 'non-configurata' };
    }

    // Fuori dal `try` di proposito: vedi il commento su `preparaAllegati`.
    const allegati = input.preparaAllegati ? await input.preparaAllegati() : undefined;

    try {
      const info = await canale.transport.sendMail({
        from: canale.from,
        to: input.messaggio.to,
        subject: input.messaggio.subject,
        text: input.messaggio.text,
        ...(allegati && allegati.length > 0 ? { attachments: allegati } : {}),
      });

      const recapitata = RECAPITA_DAVVERO.has(canale.source);

      if (canale.source === 'log') {
        // Qui il "trasporto" non ha spedito niente: l'unica copia del messaggio
        // e' questa riga. Il corpo si stampa per intero perche' in sviluppo
        // serve proprio a leggere il link d'invito.
        registra('info', `${input.motivo}: nessun server di posta configurato, messaggio scritto`
          + ' qui invece che spedito (sviluppo).', {
          da: canale.from,
          a: input.messaggio.to,
          oggetto: input.messaggio.subject,
          corpo: input.messaggio.text,
        });
      }

      return {
        esito: 'inviata',
        source: canale.source,
        recapitata,
        providerMessageId:
          typeof info.messageId === 'string' && info.messageId.trim().length > 0
            ? info.messageId
            : null,
        previewUrl: canale.source === 'ethereal' ? getDevPreviewUrl(info) : null,
      };
    } catch (errore) {
      registra(
        'errore',
        `${input.motivo}: il server di posta ha rifiutato il messaggio per`
        + ` ${input.messaggio.to} — ${descriviErrore(errore)}`,
      );
      return { esito: 'rifiutata', errore };
    }
  };
};

export const sendMail = buildSendMail();
