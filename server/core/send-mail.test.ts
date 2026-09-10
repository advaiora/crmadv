import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSendMail } from './send-mail.js';
import type { EsitoCanaleDiPosta } from './mail.js';

// Cosa difende questo file: la regola «mai un invio che sembra riuscito e non lo
// e'». I due modi di romperla sono sempre gli stessi — appiattire i tre guasti
// della posta su un unico "non configurato", e restituire "inviata" per un
// messaggio finito in un trasporto finto. Entrambi qui sotto hanno un test.

const MESSAGGIO = {
  to: 'destinatario@esempio.it',
  subject: 'Oggetto di prova',
  text: 'Corpo del messaggio.',
};

type RigaDiLog = { livello: 'info' | 'errore'; messaggio: string; dettagli?: unknown };

/** Un trasporto che raccoglie quello che riceve invece di spedirlo. */
const trasportoFinto = (raccolti: Array<Record<string, unknown>>) => ({
  sendMail: async (messaggio: Record<string, unknown>) => {
    raccolti.push(messaggio);
    return { messageId: 'id-di-prova' };
  },
});

const canaleOk = (
  source: 'database' | 'env' | 'ethereal' | 'log',
  raccolti: Array<Record<string, unknown>>,
): EsitoCanaleDiPosta => ({
  esito: 'ok',
  source,
  from: 'no-reply@esempio.it',
  transport: trasportoFinto(raccolti) as never,
});

const costruisci = (canale: EsitoCanaleDiPosta, log: RigaDiLog[]) =>
  buildSendMail({
    resolveTransportFn: async () => canale,
    registra: (livello, messaggio, dettagli) => log.push({ livello, messaggio, dettagli }),
  });

test('server vero: il messaggio parte e risulta recapitato', async () => {
  const raccolti: Array<Record<string, unknown>> = [];
  const log: RigaDiLog[] = [];
  const sendMail = costruisci(canaleOk('database', raccolti), log);

  const esito = await sendMail({ workspaceId: 'ws-1', motivo: 'prova', messaggio: MESSAGGIO });

  assert.equal(esito.esito, 'inviata');
  assert.equal(esito.esito === 'inviata' && esito.recapitata, true);
  assert.equal(esito.esito === 'inviata' && esito.providerMessageId, 'id-di-prova');
  assert.equal(raccolti.length, 1);
  assert.equal(raccolti[0].from, 'no-reply@esempio.it');
  assert.equal(raccolti[0].to, 'destinatario@esempio.it');
});

test('trasporto dei log: risulta inviata ma NON recapitata, e il corpo finisce nel log', async () => {
  const raccolti: Array<Record<string, unknown>> = [];
  const log: RigaDiLog[] = [];
  const sendMail = costruisci(canaleOk('log', raccolti), log);

  const esito = await sendMail({
    workspaceId: 'ws-1',
    motivo: 'invito al Team',
    ripiegoDiSviluppo: true,
    messaggio: MESSAGGIO,
  });

  assert.equal(esito.esito, 'inviata');
  // Il campo che tiene in piedi la regola: il messaggio non e' arrivato a
  // nessuna casella vera, e chi legge l'esito lo deve poter sapere.
  assert.equal(esito.esito === 'inviata' && esito.recapitata, false);
  assert.equal(esito.esito === 'inviata' && esito.source, 'log');

  const righe = log.filter((r) => r.messaggio.includes('scritto'));
  assert.equal(righe.length, 1, 'il messaggio non spedito deve lasciare una riga di log');
  assert.equal(righe[0].livello, 'info');
  assert.deepEqual(righe[0].dettagli, {
    da: 'no-reply@esempio.it',
    a: 'destinatario@esempio.it',
    oggetto: 'Oggetto di prova',
    corpo: 'Corpo del messaggio.',
  });
});

test('nessun server configurato: esito distinto e riga di log con destinatario e oggetto', async () => {
  const log: RigaDiLog[] = [];
  const sendMail = costruisci({ esito: 'assente' }, log);

  const esito = await sendMail({ workspaceId: 'ws-1', motivo: 'invito al Team', messaggio: MESSAGGIO });

  assert.equal(esito.esito, 'non-configurata');
  assert.equal(log.length, 1);
  assert.match(log[0].messaggio, /SMTP_HOST/);
  assert.match(log[0].messaggio, /invito al Team/);
  assert.match(log[0].messaggio, /destinatario@esempio\.it/);
  assert.match(log[0].messaggio, /Oggetto di prova/);
});

test('configurazione illeggibile: non si confonde con "non configurato" e non si aggira col ripiego', async () => {
  const log: RigaDiLog[] = [];
  const sendMail = costruisci({ esito: 'illeggibile' }, log);

  const esito = await sendMail({
    workspaceId: 'ws-1',
    motivo: 'invito al Team',
    ripiegoDiSviluppo: true,
    messaggio: MESSAGGIO,
  });

  assert.equal(esito.esito, 'illeggibile');
  assert.equal(log.length, 1);
  assert.equal(log[0].livello, 'errore');
  assert.match(log[0].messaggio, /ENCRYPTION_KEY/);
});

test('il server rifiuta: esito "rifiutata", errore originale conservato, riga di errore nel log', async () => {
  const log: RigaDiLog[] = [];
  const guasto = new Error('550 mailbox unavailable');
  const sendMail = buildSendMail({
    resolveTransportFn: async () => ({
      esito: 'ok',
      source: 'env',
      from: 'no-reply@esempio.it',
      transport: {
        sendMail: async () => {
          throw guasto;
        },
      } as never,
    }),
    registra: (livello, messaggio, dettagli) => log.push({ livello, messaggio, dettagli }),
  });

  const esito = await sendMail({ workspaceId: 'ws-1', motivo: 'prova', messaggio: MESSAGGIO });

  assert.equal(esito.esito, 'rifiutata');
  // L'errore originale, non un rifacimento: chi lo riceve lo rilancia e i
  // contatori delle notifiche ci leggono dentro il messaggio del server.
  assert.equal(esito.esito === 'rifiutata' && esito.errore, guasto);
  assert.equal(log[0].livello, 'errore');
  assert.match(log[0].messaggio, /550 mailbox unavailable/);
});

test('gli allegati si preparano solo se il canale e\' pronto', async () => {
  const log: RigaDiLog[] = [];
  let preparazioni = 0;
  const preparaAllegati = async () => {
    preparazioni += 1;
    return [{ filename: 'preventivo.pdf', content: Buffer.from('%PDF'), contentType: 'application/pdf' }];
  };

  // Senza server: il PDF non deve nemmeno essere disegnato.
  const senzaServer = costruisci({ esito: 'assente' }, log);
  await senzaServer({ workspaceId: 'ws-1', motivo: 'prova', messaggio: MESSAGGIO, preparaAllegati });
  assert.equal(preparazioni, 0);

  // Con il server: si prepara, e arriva al trasporto.
  const raccolti: Array<Record<string, unknown>> = [];
  const conServer = costruisci(canaleOk('env', raccolti), log);
  await conServer({ workspaceId: 'ws-1', motivo: 'prova', messaggio: MESSAGGIO, preparaAllegati });

  assert.equal(preparazioni, 1);
  assert.equal((raccolti[0].attachments as Array<unknown>).length, 1);
});

test('il ripiego di sviluppo si chiede al canale solo quando lo si e\' dichiarato', async () => {
  const ripieghiRichiesti: Array<boolean | undefined> = [];
  const sendMail = buildSendMail({
    resolveTransportFn: async (options) => {
      ripieghiRichiesti.push(options.allowDevFallback);
      return { esito: 'assente' };
    },
    registra: () => {},
  });

  await sendMail({ workspaceId: 'ws-1', motivo: 'notifica preventivo', messaggio: MESSAGGIO });
  await sendMail({
    workspaceId: 'ws-1',
    motivo: 'invito al Team',
    ripiegoDiSviluppo: true,
    messaggio: MESSAGGIO,
  });

  // Il primo e' la posta che parla a un cliente: non deve mai finire in una
  // casella finta. Il secondo e' posta di servizio, e li' il ripiego serve.
  assert.deepEqual(ripieghiRichiesti, [false, true]);
});
