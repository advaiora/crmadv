// Allegati ai messaggi interni (A1 punto 8a, CRMA-30): limiti e validazione, tutti
// applicati QUI, sul server. L'interfaccia puo' ripeterli per cortesia, ma non e' lei a
// deciderli - un client che li ignora deve trovare un rifiuto, non un passaggio.
//
// Specchio RIDOTTO di server/modules/agency-os/chat-attachments.ts: li' si estrae anche
// il testo per l'AI e il RAG, qui no. I messaggi interni non alimentano l'AI: servono
// solo i byte, il tipo e l'etichetta.

import { badRequest } from '../../core/errors.js';

// Tetto applicativo per singolo allegato di un messaggio.
//
// ⚠️ Sotto questo c'e' il tetto di TRASPORTO di @fastify/multipart, che e' GLOBALE e
// condiviso con l'import clienti e la Chat AI (server/app.ts: fileSize 20 MB, files 1).
// Non lo tocchiamo: alzarlo o abbassarlo per i messaggi lo cambierebbe per tutti. Il
// limite dei messaggi e' quindi volutamente PIU' BASSO del tetto globale, cosi' e'
// sempre questo a scattare per primo e il messaggio d'errore e' quello comprensibile
// scritto qui, non l'errore tecnico di multipart.
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

// Quanti allegati puo' portare un messaggio. Il tetto multipart e' 1 file per richiesta,
// quindi si caricano uno alla volta: questo conta quelli gia' attaccati al messaggio.
export const MAX_ATTACHMENTS_PER_MESSAGE = 5;

const MAX_LABEL_LENGTH = 200;

// Tipi ammessi, dichiarati per esteso invece che con un carattere jolly: un elenco
// chiuso e' l'unica forma che si puo' leggere e contestare. Sono i formati che circolano
// davvero fra le persone di un'agenzia - documenti, fogli, immagini, archivi.
export const ALLOWED_ATTACHMENT_MIME_TYPES: readonly string[] = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/zip',
  'text/plain',
  'text/csv',
  'text/markdown',
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  // ⚠️ image/svg+xml NON e' in elenco di proposito: un SVG puo' contenere <script>, e
  // servito dalla nostra stessa origine diventerebbe XSS. La Chat AI lo accetta perche'
  // li' l'allegato serve al modello; qui l'allegato torna al browser di una persona.
];

// Quanti MB "tondi" mostrare nel messaggio di rifiuto: 10, non 10485760.
const toMegabytes = (bytes: number) => Math.round((bytes / (1024 * 1024)) * 10) / 10;

// Il nome del file arriva dal client e non e' fidato: puo' contenere percorsi
// (../../etc/passwd), byte nulli o essere lungo quanto si vuole. Qui si riduce al solo
// nome finale. NON e' la difesa contro l'header injection nel download - quella sta
// nella rotta, che sanifica di nuovo al momento di scrivere Content-Disposition.
export const sanitizeAttachmentLabel = (rawFileName: string): string => {
  const withoutPaths = rawFileName.split(/[\\/]/).pop() ?? '';
  // Via i caratteri di controllo (byte nulli, a capo, ritorni a capo): sono cio' che
  // rende possibile spezzare un'intestazione HTTP o falsificare un nome a schermo.
  const cleaned = withoutPaths.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  return cleaned.slice(0, MAX_LABEL_LENGTH) || 'allegato';
};

type ValidateAttachmentInput = {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
};

export type ValidatedAttachment = {
  buffer: Buffer;
  label: string;
  mimeType: string;
  fileSize: number;
};

// Rifiuta con un messaggio in ITALIANO comprensibile, non con l'errore tecnico grezzo:
// e' esattamente cio' che il compito chiede ("non con un errore tecnico").
export const validateAttachment = (input: ValidateAttachmentInput): ValidatedAttachment => {
  if (input.buffer.length === 0) {
    throw badRequest('Il file è vuoto.');
  }

  if (input.buffer.length > MAX_ATTACHMENT_BYTES) {
    throw badRequest(
      `Il file supera il limite di ${toMegabytes(MAX_ATTACHMENT_BYTES)} MB consentito per gli allegati ai messaggi.`,
    );
  }

  // Il tipo dichiarato dal browser puo' portarsi dietro i parametri (charset, boundary):
  // si confronta solo la parte prima del ';', minuscola.
  const normalizedMimeType = input.mimeType.split(';')[0]?.trim().toLowerCase() ?? '';
  if (!ALLOWED_ATTACHMENT_MIME_TYPES.includes(normalizedMimeType)) {
    throw badRequest(
      // ⚠️ L'elenco qui dentro deve rispecchiare ALLOWED_ATTACHMENT_MIME_TYPES: SVG NON
      // va nominato, perche' non e' ammesso (vedi il commento sull'elenco). Prometterlo
      // qui manderebbe la persona a riprovare con un file che il server rifiutera'
      // comunque - il rifiuto piu' frustrante e' quello che elenca fra i tipi buoni
      // proprio quello che hai appena caricato.
      'Tipo di file non ammesso. Si possono allegare documenti (PDF, Word, Excel, PowerPoint, testo, CSV, Markdown), immagini (PNG, JPEG, GIF, WebP) e archivi ZIP.',
    );
  }

  return {
    buffer: input.buffer,
    label: sanitizeAttachmentLabel(input.fileName),
    mimeType: normalizedMimeType,
    fileSize: input.buffer.length,
  };
};
