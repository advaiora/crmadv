// Allegati della Chat AI collaborativa (Fase 3a): portare contesto SPECIFICO nella
// conversazione, sopra il contesto d'ambito (progetto/cliente/generale).
//
// Due tipi:
//  - file caricato: si conservano i BYTE VERI (documenti e immagini) in una tabella a
//    parte. Per i documenti si estrae anche il testo col medesimo estrattore delle Fonti
//    (TXT/CSV/MD/DOCX/PDF), che e' cio' che legge l'AI/il RAG; per le immagini il testo
//    e' un segnaposto (la "vista" multimodale vera arriva con le chiavi).
//  - elemento CRM (progetto/cliente/fonte/preventivo): se ne salva uno SNAPSHOT
//    testuale al momento dell'allegato, così il contesto resta quello che l'utente
//    vedeva quando ha allegato (e non cambia sotto ai messaggi già scritti).
//
// Nota (16/7/2026): prima il binario NON veniva conservato (come le Fonti, "estrai e
// butta") e le immagini erano proprio rifiutate. Ora i byte si tengono per tutti i
// file, così l'originale si può riscaricare e — con le chiavi — dare in "vista" al
// modello. Il modulo Fonti resta invariato (decisione separata).

import { prisma } from '../../prisma.js';
import { badRequest, notFound } from '../../core/errors.js';
import { sourceExtractor, SourceExtractionError } from '../sources/sources.extractor.js';

// Tetto del testo conservato per allegato. L'estrattore delle Fonti arriva a 200k
// caratteri: per un allegato di chat è sproporzionato (gonfia il DB e comunque il
// prompt ne usa una frazione), quindi si taglia qui.
export const MAX_ATTACHMENT_CHARS = 20_000;

// Quanto testo di ciascun allegato finisce nel prompt. Sotto al tetto di storage:
// il resto è troncato con un marcatore esplicito, così il modello sa che manca.
export const ATTACHMENT_PROMPT_CHARS = 6_000;

export const ATTACHABLE_ENTITY_TYPES = ['project', 'client', 'source', 'quote'] as const;
export type AttachableEntityType = (typeof ATTACHABLE_ENTITY_TYPES)[number];

export const isAttachableEntityType = (value: unknown): value is AttachableEntityType =>
  typeof value === 'string' && (ATTACHABLE_ENTITY_TYPES as readonly string[]).includes(value);

// Etichetta leggibile del tipo, per la UI e per intestare lo snapshot nel prompt.
export const ENTITY_TYPE_LABEL: Record<AttachableEntityType, string> = {
  project: 'Progetto',
  client: 'Cliente',
  source: 'Fonte',
  quote: 'Preventivo',
};

const clip = (text: string, max: number): string => (text.length > max ? text.slice(0, max) : text);

const line = (label: string, value: unknown): string | null => {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  return `- ${label}: ${String(value)}`;
};

const formatDate = (value: Date | null | undefined): string | null =>
  value ? value.toISOString().slice(0, 10) : null;

const formatMoney = (value: unknown, currency = 'EUR'): string | null =>
  value === null || value === undefined ? null : `${String(value)} ${currency}`;

export type EntitySnapshot = {
  label: string;
  content: string;
  // Progetto/cliente di appartenenza: servono a validare la visibilità (V2) prima
  // di lasciar allegare l'elemento.
  projectId: string | null;
  clientId: string | null;
};

// Snapshot testuale di un elemento del CRM. Null se non esiste nel workspace.
export const buildEntitySnapshot = async (
  workspaceId: string,
  entityType: AttachableEntityType,
  entityId: string,
): Promise<EntitySnapshot | null> => {
  if (entityType === 'project') {
    const project = await prisma.project.findFirst({
      where: { workspaceId, id: entityId },
      select: {
        id: true,
        name: true,
        description: true,
        goal: true,
        statusAgency: true,
        priorityAgency: true,
        value: true,
        startDate: true,
        endDate: true,
        dueDate: true,
        clientId: true,
        client: { select: { name: true } },
      },
    });
    if (!project) {
      return null;
    }
    const content = [
      `PROGETTO: ${project.name}`,
      line('Cliente', project.client?.name),
      line('Obiettivo', project.goal),
      line('Descrizione', project.description),
      line('Stato', project.statusAgency),
      line('Priorità', project.priorityAgency),
      line('Valore', project.value),
      line('Inizio', formatDate(project.startDate)),
      line('Fine', formatDate(project.endDate)),
      line('Scadenza', formatDate(project.dueDate)),
    ]
      .filter(Boolean)
      .join('\n');
    return { label: project.name, content, projectId: project.id, clientId: project.clientId };
  }

  if (entityType === 'client') {
    const client = await prisma.client.findFirst({
      where: { workspaceId, id: entityId },
      select: {
        id: true,
        name: true,
        type: true,
        email: true,
        phone: true,
        vatNumber: true,
        city: true,
        province: true,
        country: true,
        notes: true,
        tags: true,
      },
    });
    if (!client) {
      return null;
    }
    const content = [
      `CLIENTE: ${client.name}`,
      line('Tipo', client.type),
      line('Email', client.email),
      line('Telefono', client.phone),
      line('Partita IVA', client.vatNumber),
      line('Città', [client.city, client.province, client.country].filter(Boolean).join(', ')),
      line('Tag', client.tags.length > 0 ? client.tags.join(', ') : null),
      line('Note', client.notes),
    ]
      .filter(Boolean)
      .join('\n');
    return { label: client.name, content, projectId: null, clientId: client.id };
  }

  if (entityType === 'source') {
    const source = await prisma.projectSource.findFirst({
      where: { workspaceId, id: entityId },
      select: {
        id: true,
        title: true,
        type: true,
        url: true,
        fileName: true,
        content: true,
        status: true,
        projectId: true,
        project: { select: { clientId: true } },
      },
    });
    if (!source) {
      return null;
    }
    const body = (source.content ?? '').trim();
    const content = [
      `FONTE: ${source.title}`,
      line('Tipo', source.type),
      line('URL', source.url),
      line('File', source.fileName),
      line('Stato', source.status),
      '',
      body ? 'CONTENUTO:' : 'CONTENUTO: (nessun testo estratto per questa fonte)',
      body,
    ]
      .filter((row) => row !== null)
      .join('\n');
    return {
      label: source.title,
      content: clip(content, MAX_ATTACHMENT_CHARS),
      projectId: source.projectId,
      clientId: source.project?.clientId ?? null,
    };
  }

  // quote
  const quote = await prisma.quote.findFirst({
    where: { workspaceId, id: entityId },
    select: {
      id: true,
      status: true,
      currency: true,
      subtotal: true,
      taxTotal: true,
      total: true,
      issueDate: true,
      validUntil: true,
      notes: true,
      projectId: true,
      clientId: true,
      client: { select: { name: true } },
      project: { select: { name: true } },
      items: {
        orderBy: { position: 'asc' },
        select: { title: true, description: true, quantity: true, unitPrice: true, lineTotal: true },
      },
    },
  });
  if (!quote) {
    return null;
  }
  // Etichetta: i preventivi non hanno un nome proprio, quindi si compone da cliente
  // e id breve — è ciò che rende riconoscibile il chip in chat.
  const label = `Preventivo ${quote.client?.name ?? ''} (${quote.id.slice(-6)})`.replace(/\s+/g, ' ').trim();
  const items = quote.items.map(
    (item, index) =>
      `${index + 1}. ${item.title}${item.description ? ` — ${item.description}` : ''} | qta ${String(item.quantity)} x ${String(item.unitPrice)} = ${String(item.lineTotal)}`,
  );
  const content = [
    `PREVENTIVO per ${quote.client?.name ?? 'n/d'}`,
    line('Progetto', quote.project?.name),
    line('Stato', quote.status),
    line('Data emissione', formatDate(quote.issueDate)),
    line('Valido fino al', formatDate(quote.validUntil)),
    line('Imponibile', formatMoney(quote.subtotal, quote.currency)),
    line('Imposte', formatMoney(quote.taxTotal, quote.currency)),
    line('Totale', formatMoney(quote.total, quote.currency)),
    line('Note', quote.notes),
    items.length > 0 ? ['', 'VOCI:', ...items].join('\n') : null,
  ]
    .filter(Boolean)
    .join('\n');
  // internalNotes è deliberatamente escluso: sono note interne, non contesto da
  // dare in pasto al modello insieme al resto.
  return {
    label,
    content: clip(content, MAX_ATTACHMENT_CHARS),
    projectId: quote.projectId,
    clientId: quote.clientId,
  };
};

// Estensioni immagine riconosciute (fallback quando il mimeType manca o è generico).
const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg']);

// È un'immagine? Prima si guarda il mimeType (image/*), poi l'estensione del nome.
// Le immagini non passano dall'estrattore di testo (darebbe errore): si conservano
// i byte e basta, col nome come segnaposto testuale.
export const isImageAttachment = (input: { mimeType?: string | null; fileName: string }): boolean => {
  const mime = (input.mimeType ?? '').toLowerCase();
  if (mime.startsWith('image/')) {
    return true;
  }
  const ext = input.fileName.split('.').pop()?.toLowerCase() ?? '';
  return IMAGE_EXTENSIONS.has(ext);
};

// Testo segnaposto per un'immagine allegata NEL PROMPT DI SISTEMA: dà al modello il
// nome del file e la sigla [A1] per citarla. Con la "vista" multimodale (Fase 3b) il
// modello riceve ANCHE l'immagine vera, come content block del messaggio utente.
export const imagePlaceholderText = (fileName: string): string => `[IMMAGINE ALLEGATA] ${fileName}`;

// --- "Vista" multimodale delle immagini (Fase 3b) --------------------------------
// Finché non c'erano le chiavi un'immagine allegata dava al modello solo il nome
// (segnaposto). Qui si costruisce il payload per FARGLIELA VEDERE: i byte diventano un
// content block immagine nell'ultimo messaggio dell'utente, nel formato del provider.
// Le tre API multimodali hanno forme diverse, quindi si tratta ogni provider a parte.

// Formati immagine che TUTTI i provider usati (Anthropic + OpenAI) sanno "vedere".
// SVG e BMP restano fuori (nessuno dei due li accetta): quelle immagini tengono il
// solo segnaposto testuale.
export const SUPPORTED_VISION_MEDIA_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
]);

// Estensione → media type, per dedurre il tipo quando il mimeType salvato manca o è
// generico (es. application/octet-stream da certi upload).
const VISION_EXTENSION_MEDIA_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
};

// Quante immagini al massimo si danno in pasto al modello per turno: il contesto
// allegato è già limitato a pochi elementi, questo è un ulteriore tetto sui costi
// (ogni immagine pesa parecchi token).
export const MAX_VISION_IMAGES = 4;

// Tetto di dimensione per immagine "vista". Oltre, l'immagine resta il suo segnaposto:
// i provider rifiutano immagini troppo grandi, e il ridimensionamento vero è un lavoro
// a sé (serve una libreria immagini) — fuori da questa passata.
export const MAX_VISION_IMAGE_BYTES = 4 * 1024 * 1024;

// Stima GROSSOLANA dei token di un'immagine, così il registro consumi non resta a zero
// sul costo immagine (il costo reale dipende dalla risoluzione, che qui non si conosce).
// Si somma alla stima già in uso per il testo.
export const VISION_IMAGE_TOKEN_ESTIMATE = 1_300;

// Media type "vedibile" di un allegato, o null se non è un'immagine in un formato
// supportato. Prima il mimeType, poi l'estensione del nome come rete di sicurezza.
export const resolveVisionMediaType = (input: {
  mimeType?: string | null;
  fileName: string;
}): string | null => {
  const mime = (input.mimeType ?? '').toLowerCase().trim();
  if (SUPPORTED_VISION_MEDIA_TYPES.has(mime)) {
    return mime;
  }
  const ext = input.fileName.split('.').pop()?.toLowerCase() ?? '';
  return VISION_EXTENSION_MEDIA_TYPES[ext] ?? null;
};

// Un'immagine pronta per il prompt: media type + byte in base64 (senza il prefisso
// `data:`, che si aggiunge solo dove serve).
export type ChatVisionImage = { mediaType: string; dataBase64: string };

// Messaggio di conversazione a solo testo (come lo passa il motore chat).
export type ChatTextMessage = { role: 'user' | 'assistant'; content: string };

// I tre "dialetti" multimodali da produrre: Anthropic Messages, OpenAI Responses e il
// fallback OpenAI Chat Completions.
export type VisionProvider = 'anthropic' | 'openai-responses' | 'openai-chat';

// Blocco immagine nel formato del provider.
const visionImageBlock = (image: ChatVisionImage, provider: VisionProvider): Record<string, unknown> => {
  const dataUri = `data:${image.mediaType};base64,${image.dataBase64}`;
  if (provider === 'anthropic') {
    return { type: 'image', source: { type: 'base64', media_type: image.mediaType, data: image.dataBase64 } };
  }
  if (provider === 'openai-responses') {
    return { type: 'input_image', image_url: dataUri };
  }
  // openai-chat (chat/completions): image_url è un oggetto con `url`.
  return { type: 'image_url', image_url: { url: dataUri } };
};

// Blocco testo nel formato del provider (la Responses API usa 'input_text').
const visionTextBlock = (text: string, provider: VisionProvider): Record<string, unknown> =>
  provider === 'openai-responses' ? { type: 'input_text', text } : { type: 'text', text };

// Rende multimodale l'ULTIMO messaggio 'user' della conversazione, aggiungendo le
// immagini come content block dopo il testo. Se non ci sono immagini (o non c'è un
// messaggio user) restituisce i messaggi invariati con content stringa — cioè il
// comportamento solo-testo di prima, byte per byte: il flusso senza immagini non cambia.
export const buildMultimodalMessages = (
  messages: ChatTextMessage[],
  images: ChatVisionImage[],
  provider: VisionProvider,
): Array<{ role: string; content: unknown }> => {
  const passthrough = () => messages.map((message) => ({ role: message.role, content: message.content }));
  if (images.length === 0) {
    return passthrough();
  }
  let lastUserIndex = -1;
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i].role === 'user') {
      lastUserIndex = i;
      break;
    }
  }
  if (lastUserIndex === -1) {
    return passthrough();
  }
  return messages.map((message, index) => {
    if (index !== lastUserIndex) {
      return { role: message.role, content: message.content };
    }
    return {
      role: message.role,
      content: [
        visionTextBlock(message.content, provider),
        ...images.map((image) => visionImageBlock(image, provider)),
      ],
    };
  });
};

// Estrae il testo di un documento caricato. Traduce l'errore dell'estrattore in un
// 400 leggibile: l'utente deve capire perché quel file non si può allegare.
export const extractAttachmentFileText = async (input: {
  buffer: Buffer;
  fileName: string;
}): Promise<string> => {
  try {
    const { content } = await sourceExtractor.fromFile(input);
    return clip(content, MAX_ATTACHMENT_CHARS);
  } catch (error) {
    if (error instanceof SourceExtractionError) {
      throw badRequest(error.message);
    }
    throw error;
  }
};

// Testo di un allegato pronto per il prompt: intestato con l'etichetta e troncato,
// con marcatore esplicito quando è stato tagliato.
export const formatAttachmentForPrompt = (
  attachment: { kind: string; label: string; content: string },
  index: number,
): string => {
  const head = `[A${index + 1}] ${attachment.kind === 'file' ? 'DOCUMENTO ALLEGATO' : 'ELEMENTO CRM ALLEGATO'}: ${attachment.label}`;
  const truncated = attachment.content.length > ATTACHMENT_PROMPT_CHARS;
  const body = clip(attachment.content, ATTACHMENT_PROMPT_CHARS);
  return `${head}\n${body}${truncated ? '\n[…estratto troncato]' : ''}`;
};

// 404 uniforme quando l'elemento non esiste (o non è nel workspace).
export const entityNotFound = (entityType: AttachableEntityType) =>
  notFound(`${ENTITY_TYPE_LABEL[entityType]} non trovato.`);
