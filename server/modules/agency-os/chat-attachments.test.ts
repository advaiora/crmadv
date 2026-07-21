import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ATTACHMENT_PROMPT_CHARS,
  MAX_ATTACHMENT_CHARS,
  extractAttachmentFileText,
  formatAttachmentForPrompt,
  isAttachableEntityType,
  isImageAttachment,
  imagePlaceholderText,
  resolveVisionMediaType,
  buildMultimodalMessages,
  type ChatTextMessage,
  type ChatVisionImage,
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

test('isImageAttachment: riconosce le immagini da mimeType e da estensione', () => {
  // Dal mimeType, anche se l'estensione non ci fosse.
  assert.equal(isImageAttachment({ mimeType: 'image/png', fileName: 'senza-estensione' }), true);
  assert.equal(isImageAttachment({ mimeType: 'image/jpeg', fileName: 'foto.jpg' }), true);
  // Dall'estensione, quando il mimeType manca (o e' generico).
  assert.equal(isImageAttachment({ mimeType: '', fileName: 'foto.PNG' }), true);
  assert.equal(isImageAttachment({ mimeType: 'application/octet-stream', fileName: 'immagine.webp' }), true);
  // Non immagini.
  assert.equal(isImageAttachment({ mimeType: 'application/pdf', fileName: 'brief.pdf' }), false);
  assert.equal(isImageAttachment({ mimeType: '', fileName: 'nota.txt' }), false);
});

test('imagePlaceholderText: testo segnaposto con il nome del file', () => {
  assert.equal(imagePlaceholderText('foto.png'), '[IMMAGINE ALLEGATA] foto.png');
});

// --- "Vista" multimodale (Fase 3b) -----------------------------------------------

test('resolveVisionMediaType: mappa i formati supportati e scarta gli altri', () => {
  // Dal mimeType (normalizzato a minuscolo).
  assert.equal(resolveVisionMediaType({ mimeType: 'image/png', fileName: 'x' }), 'image/png');
  assert.equal(resolveVisionMediaType({ mimeType: 'IMAGE/JPEG', fileName: 'x' }), 'image/jpeg');
  // Dedotto dall'estensione quando il mime manca o è generico.
  assert.equal(resolveVisionMediaType({ mimeType: '', fileName: 'foto.WEBP' }), 'image/webp');
  assert.equal(resolveVisionMediaType({ mimeType: 'application/octet-stream', fileName: 'a.jpg' }), 'image/jpeg');
  // Immagini in formati che i provider NON vedono → null (resta il segnaposto).
  assert.equal(resolveVisionMediaType({ mimeType: 'image/svg+xml', fileName: 'logo.svg' }), null);
  assert.equal(resolveVisionMediaType({ mimeType: '', fileName: 'foto.bmp' }), null);
  // Non immagini.
  assert.equal(resolveVisionMediaType({ mimeType: 'application/pdf', fileName: 'brief.pdf' }), null);
});

test('buildMultimodalMessages: senza immagini lascia i messaggi solo-testo invariati', () => {
  const msgs: ChatTextMessage[] = [
    { role: 'user', content: 'ciao' },
    { role: 'assistant', content: 'ehi' },
  ];
  const out = buildMultimodalMessages(msgs, [], 'anthropic');
  assert.deepEqual(out, [
    { role: 'user', content: 'ciao' },
    { role: 'assistant', content: 'ehi' },
  ]);
});

test('buildMultimodalMessages: inietta le immagini solo nell ultimo user (formato Anthropic)', () => {
  const msgs: ChatTextMessage[] = [
    { role: 'user', content: 'prima' },
    { role: 'assistant', content: 'risposta' },
    { role: 'user', content: 'guarda questa' },
  ];
  const images: ChatVisionImage[] = [{ mediaType: 'image/png', dataBase64: 'AAAA' }];
  const out = buildMultimodalMessages(msgs, images, 'anthropic');
  // I messaggi precedenti restano intatti (content stringa).
  assert.deepEqual(out[0], { role: 'user', content: 'prima' });
  assert.deepEqual(out[1], { role: 'assistant', content: 'risposta' });
  // Solo l'ultimo user diventa blocchi: testo + immagine.
  assert.deepEqual(out[2], {
    role: 'user',
    content: [
      { type: 'text', text: 'guarda questa' },
      { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'AAAA' } },
    ],
  });
});

test('buildMultimodalMessages: formati OpenAI (responses e chat) per l immagine', () => {
  const msgs: ChatTextMessage[] = [{ role: 'user', content: 'vedi' }];
  const images: ChatVisionImage[] = [{ mediaType: 'image/jpeg', dataBase64: 'ZZZZ' }];

  const responses = buildMultimodalMessages(msgs, images, 'openai-responses');
  assert.deepEqual(responses[0], {
    role: 'user',
    content: [
      { type: 'input_text', text: 'vedi' },
      { type: 'input_image', image_url: 'data:image/jpeg;base64,ZZZZ' },
    ],
  });

  const chat = buildMultimodalMessages(msgs, images, 'openai-chat');
  assert.deepEqual(chat[0], {
    role: 'user',
    content: [
      { type: 'text', text: 'vedi' },
      { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,ZZZZ' } },
    ],
  });
});

test('buildMultimodalMessages: più immagini in coda al testo, nell ordine dato', () => {
  const msgs: ChatTextMessage[] = [{ role: 'user', content: 'due foto' }];
  const images: ChatVisionImage[] = [
    { mediaType: 'image/png', dataBase64: 'UNO' },
    { mediaType: 'image/webp', dataBase64: 'DUE' },
  ];
  const out = buildMultimodalMessages(msgs, images, 'anthropic') as Array<{ role: string; content: unknown[] }>;
  const blocks = out[0].content;
  assert.equal(blocks.length, 3); // testo + 2 immagini
  assert.deepEqual(blocks[0], { type: 'text', text: 'due foto' });
  assert.deepEqual(blocks[1], { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'UNO' } });
  assert.deepEqual(blocks[2], { type: 'image', source: { type: 'base64', media_type: 'image/webp', data: 'DUE' } });
});
