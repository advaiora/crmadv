import assert from 'node:assert/strict';
import test from 'node:test';
import { isHttpError } from '../../core/errors.js';
import { messagingRepository } from './repository.js';
import { messagingService } from './service.js';

// I controlli di accesso agli allegati, provati uno per uno. Il repository e' mockato
// (stesso modo di server/modules/checklists/checklists.service.gate.test.ts): qui non
// interessa cosa risponde il database, interessa che il service rifiuti chi non deve
// passare anche quando il database risponde con la riga giusta.
//
// Nota sui codici attesi: workspace diverso -> 404 e non 403, di proposito. Un 403
// confermerebbe che quell'id esiste da qualche altra parte.

const WORKSPACE = 'workspace-1';
const ALTRO_WORKSPACE = 'workspace-2';
const MITTENTE = 'user-mittente';
const DESTINATARIO = 'user-destinatario';
const ESTRANEO = 'user-estraneo';

const messaggio = {
  id: 'message-1',
  senderUserId: MITTENTE,
  recipientUserId: DESTINATARIO,
};

const rigaAllegato = (workspaceId: string) => ({
  id: 'attachment-1',
  workspaceId,
  label: 'preventivo.pdf',
  mimeType: 'application/pdf',
  message: messaggio,
  binary: { data: Buffer.from('byte-veri') },
});

const attendiErrore = async (
  esecuzione: () => Promise<unknown>,
  statusCode: number,
) => {
  await assert.rejects(esecuzione, (error: unknown) => {
    assert.equal(isHttpError(error), true);
    assert.equal((error as { statusCode: number }).statusCode, statusCode);
    return true;
  });
};

test('getAttachmentFile: allegato di un altro workspace risulta non trovato', async (t) => {
  t.mock.method(
    messagingRepository,
    'findAttachmentBinary',
    async () => rigaAllegato(ALTRO_WORKSPACE) as never,
  );

  await attendiErrore(
    () =>
      messagingService.getAttachmentFile({
        workspaceId: WORKSPACE,
        userId: MITTENTE,
        attachmentId: 'attachment-1',
      }),
    404,
  );
});

test('getAttachmentFile: chi non e\' nella conversazione riceve un rifiuto dal server', async (t) => {
  t.mock.method(
    messagingRepository,
    'findAttachmentBinary',
    async () => rigaAllegato(WORKSPACE) as never,
  );

  await attendiErrore(
    () =>
      messagingService.getAttachmentFile({
        workspaceId: WORKSPACE,
        userId: ESTRANEO,
        attachmentId: 'attachment-1',
      }),
    403,
  );
});

test('getAttachmentFile: il destinatario del messaggio scarica i byte', async (t) => {
  t.mock.method(
    messagingRepository,
    'findAttachmentBinary',
    async () => rigaAllegato(WORKSPACE) as never,
  );

  const file = await messagingService.getAttachmentFile({
    workspaceId: WORKSPACE,
    userId: DESTINATARIO,
    attachmentId: 'attachment-1',
  });

  assert.equal(file.data.toString(), 'byte-veri');
  assert.equal(file.mimeType, 'application/pdf');
  assert.equal(file.label, 'preventivo.pdf');
});

test('addAttachment: il destinatario non puo\' allegare a un messaggio ricevuto', async (t) => {
  t.mock.method(
    messagingRepository,
    'findMessageForAttachment',
    async () => ({ ...messaggio, workspaceId: WORKSPACE }) as never,
  );
  const createAttachment = t.mock.method(
    messagingRepository,
    'createAttachment',
    async () => {
      throw new Error('non deve arrivare qui');
    },
  );

  await attendiErrore(
    () =>
      messagingService.addAttachment({
        workspaceId: WORKSPACE,
        userId: DESTINATARIO,
        messageId: 'message-1',
        file: {
          buffer: Buffer.from('qualcosa'),
          fileName: 'preventivo.pdf',
          mimeType: 'application/pdf',
        },
      }),
    403,
  );

  // Il rifiuto arriva prima della scrittura, non dopo.
  assert.equal(createAttachment.mock.callCount(), 0);
});

test('removeAttachment: solo il mittente toglie il proprio allegato', async (t) => {
  t.mock.method(
    messagingRepository,
    'findAttachmentForDelete',
    async () => ({
      id: 'attachment-1',
      workspaceId: WORKSPACE,
      createdByUserId: MITTENTE,
      message: messaggio,
    }) as never,
  );
  const deleteAttachment = t.mock.method(
    messagingRepository,
    'deleteAttachment',
    async () => ({ id: 'attachment-1' }) as never,
  );

  await attendiErrore(
    () =>
      messagingService.removeAttachment({
        workspaceId: WORKSPACE,
        userId: DESTINATARIO,
        attachmentId: 'attachment-1',
      }),
    403,
  );
  assert.equal(deleteAttachment.mock.callCount(), 0);

  const rimosso = await messagingService.removeAttachment({
    workspaceId: WORKSPACE,
    userId: MITTENTE,
    attachmentId: 'attachment-1',
  });

  assert.equal(rimosso.id, 'attachment-1');
  assert.equal(deleteAttachment.mock.callCount(), 1);
});

test('removeAttachment: allegato di un altro workspace risulta non trovato', async (t) => {
  t.mock.method(
    messagingRepository,
    'findAttachmentForDelete',
    async () => ({
      id: 'attachment-1',
      workspaceId: ALTRO_WORKSPACE,
      createdByUserId: MITTENTE,
      message: messaggio,
    }) as never,
  );

  await attendiErrore(
    () =>
      messagingService.removeAttachment({
        workspaceId: WORKSPACE,
        userId: MITTENTE,
        attachmentId: 'attachment-1',
      }),
    404,
  );
});
