import assert from 'node:assert/strict';
import test from 'node:test';
import { NOT_DELETED, markTrashed } from '../../core/soft-delete.js';
import {
  buildAttachmentBinaryWhere,
  buildAttachmentForDeleteWhere,
  buildAttachmentsForMessagesWhere,
  buildMessageForAttachmentWhere,
} from './repository.js';

/**
 * Gli allegati di un messaggio cestinato, provati senza database (CRMA-169).
 *
 * Stesso metodo dei filtri di CRMA-133 (`repository.test.ts`): si provano le
 * funzioni `where` invece delle query, perche' `server/prisma.ts` esporta un
 * Proxy che spara se il client non e' inizializzato, e montare un database per
 * verificare un filtro sarebbe sproporzionato. Il filtro e' esattamente la cosa
 * che puo' sfuggire: era sfuggita, ed e' il motivo per cui questo file esiste.
 * Runner: `node --test`, non Vitest (nota #76).
 *
 * ⚠️ Il guasto che questi test sorvegliano non e' ipotetico. Gli allegati sono
 * nati su `main` (CRMA-30 / CRMA-138) quando i messaggi non avevano ancora una
 * `deletedAt`; il Cestino e' nato sul ramo quando gli allegati non c'erano. Il
 * download faceva due controlli — stesso workspace, chi chiede partecipa alla
 * conversazione — e nessuno dei due guardava il padre. Unendo i due lavori senza
 * questo filtro, un messaggio ritirato sparisce dalla conversazione ma il suo
 * documento resta scaricabile da entrambi i partecipanti.
 */

const ATTACHMENT_ID = 'attachment-1';
const MESSAGE_ID = 'message-1';
const WORKSPACE_ID = 'workspace-1';
const ME = 'user-me';

test('il download di un allegato non serve i byte di un messaggio cestinato', () => {
  const where = buildAttachmentBinaryWhere(ATTACHMENT_ID);

  assert.deepEqual(
    where.message,
    NOT_DELETED,
    "senza questo filtro l'allegato di un messaggio ritirato resta scaricabile",
  );
  // Gli altri due controlli del download restano dove sono: l'id qui, il
  // workspace e l'appartenenza alla conversazione nel service. Il filtro del
  // Cestino si aggiunge, non sostituisce.
  assert.equal(where.id, ATTACHMENT_ID);
  assert.deepEqual(where.binary, { isNot: null });
});

test('la lista allegati di una conversazione non propone quelli dei messaggi cestinati', () => {
  const where = buildAttachmentsForMessagesWhere([MESSAGE_ID, 'message-2']);

  assert.deepEqual(where.message, NOT_DELETED);
  assert.deepEqual(where.messageId, { in: [MESSAGE_ID, 'message-2'] });
});

test('un allegato di un messaggio cestinato non si puo togliere: il Cestino lo deve poter ripristinare intero', () => {
  // La scelta e' deliberata (punto 2 di CRMA-169). Lasciar passare la rimozione
  // toglierebbe per sempre un pezzo di qualcosa che il Cestino promette di
  // riportare indietro completo — e lo toglierebbe senza che nessuno lo veda,
  // visto che un messaggio cestinato non compare piu' nella conversazione.
  const where = buildAttachmentForDeleteWhere(ATTACHMENT_ID);

  assert.deepEqual(where.message, NOT_DELETED);
  assert.equal(where.id, ATTACHMENT_ID);
});

test('non si allega niente a un messaggio gia cestinato', () => {
  const where = buildMessageForAttachmentWhere({
    workspaceId: WORKSPACE_ID,
    messageId: MESSAGE_ID,
  });

  // Qui il filtro e' sul messaggio stesso, non su una relazione: e' il messaggio
  // che si legge. Il workspace resta, perche' nessuna lettura esce dall'azienda
  // di chi la chiede.
  assert.equal(where.deletedAt, null);
  assert.equal(where.workspaceId, WORKSPACE_ID);
  assert.equal(where.id, MESSAGE_ID);
});

test('l allegato non ha una deletedAt propria: si nasconde guardando il padre', () => {
  // Regola 2 di `server/core/soft-delete.ts`, messa alla prova sul caso che
  // l'ha resa necessaria. Cestinare scrive la data SUL MESSAGGIO; i quattro
  // `where` degli allegati la leggono da li'. Se un domani qualcuno aggiungesse
  // una seconda data sull'allegato, questo test non fallirebbe — ma il commento
  // sopra `buildAttachmentsForMessagesWhere` dice perche' non va fatto: un
  // messaggio ripristinato tornerebbe senza i suoi allegati.
  const scritto = markTrashed(ME, new Date('2026-09-11T10:00:00.000Z'));
  assert.notEqual(scritto.deletedAt, null);

  const filtriDegliAllegati = [
    buildAttachmentBinaryWhere(ATTACHMENT_ID).message,
    buildAttachmentsForMessagesWhere([MESSAGE_ID]).message,
    buildAttachmentForDeleteWhere(ATTACHMENT_ID).message,
  ];

  for (const filtro of filtriDegliAllegati) {
    assert.deepEqual(filtro, { deletedAt: null });
  }
});
