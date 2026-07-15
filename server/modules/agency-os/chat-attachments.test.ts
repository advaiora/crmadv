import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ATTACHMENT_PROMPT_CHARS,
  MAX_ATTACHMENT_CHARS,
  extractAttachmentFileText,
  formatAttachmentForPrompt,
  isAttachableEntityType,
} from './chat-attachments.js';

// Le parti pure degli allegati della chat (Fase 3a). Gli snapshot delle entita'
// leggono il DB e si provano via API; qui stanno formattazione e validazione.

test('isAttachableEntityType: accetta i tipi previsti e rifiuta il resto', () => {
  assert.equal(isAttachableEntityType('project'), true);
  assert.equal(isAttachableEntityType('client'), true);
  assert.equal(isAttachableEntityType('source'), true);
  assert.equal(isAttachableEntityType('quote'), true);
  // Fuori dalla Fase 3a: i thread di messaggistica (rimandati) e tutto il resto.
  assert.equal(isAttachableEntityType('message'), false);
  assert.equal(isAttachableEntityType('vaultItem'), false);
  assert.equal(isAttachableEntityType(''), false);
  assert.equal(isAttachableEntityType(undefined), false);
});

test('formatAttachmentForPrompt: intesta con la sigla [A1] e distingue documento da elemento', () => {
  const doc = formatAttachmentForPrompt({ kind: 'file', label: 'brief.md', content: 'Budget 12k' }, 0);
  assert.match(doc, /^\[A1\] DOCUMENTO ALLEGATO: brief\.md\n/);
  assert.match(doc, /Budget 12k/);

  const entity = formatAttachmentForPrompt({ kind: 'entity', label: 'Acme SpA', content: 'CLIENTE: Acme SpA' }, 1);
  assert.match(entity, /^\[A2\] ELEMENTO CRM ALLEGATO: Acme SpA\n/);
});

test('formatAttachmentForPrompt: tronca il testo lungo e lo dichiara', () => {
  const lungo = 'x'.repeat(ATTACHMENT_PROMPT_CHARS + 500);
  const out = formatAttachmentForPrompt({ kind: 'file', label: 'grosso.txt', content: lungo }, 0);
  assert.match(out, /\[…estratto troncato\]$/);
  assert.equal(out.includes('x'.repeat(ATTACHMENT_PROMPT_CHARS)), true);
  assert.equal(out.includes('x'.repeat(ATTACHMENT_PROMPT_CHARS + 1)), false);
});

test('formatAttachmentForPrompt: non segnala troncamento quando il testo ci sta tutto', () => {
  const out = formatAttachmentForPrompt({ kind: 'file', label: 'corto.txt', content: 'poche parole' }, 0);
  assert.equal(out.includes('estratto troncato'), false);
});

test('extractAttachmentFileText: estrae il testo di un documento supportato', async () => {
  const content = await extractAttachmentFileText({
    buffer: Buffer.from('Riga uno\r\n\r\n\r\n\r\nRiga due'),
    fileName: 'nota.txt',
  });
  // Passa dalla normalizzazione dell'estrattore delle Fonti.
  assert.equal(content, 'Riga uno\n\nRiga due');
});

test('extractAttachmentFileText: un formato non gestito diventa un 400 con messaggio leggibile', async () => {
  await assert.rejects(
    () => extractAttachmentFileText({ buffer: Buffer.from('fake'), fileName: 'foto.png' }),
    (error: { statusCode?: number; message: string }) => {
      assert.equal(error.statusCode, 400);
      assert.match(error.message, /Formato non supportato \(\.png\)/);
      return true;
    },
  );
});

test('extractAttachmentFileText: taglia il testo al tetto per allegato', async () => {
  const content = await extractAttachmentFileText({
    buffer: Buffer.from('a'.repeat(MAX_ATTACHMENT_CHARS + 1_000)),
    fileName: 'enorme.txt',
  });
  assert.equal(content.length, MAX_ATTACHMENT_CHARS);
});
