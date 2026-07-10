// Estrazione del testo di una fonte (V4 — Modulo Fonti): URL, testo incollato e
// caricamento file (Word/PDF/TXT/CSV/MD). Per gli URL basta fetch globale (Node
// 18+) + strip HTML; per i file si riusano le librerie già in uso lato Agency
// (`mammoth` per .docx, `pdf-parse` per .pdf), importate on-demand.

export const MAX_CONTENT_CHARS = 200_000;

// Formati file di cui sappiamo estrarre il testo. Il resto (immagini, zip…) va
// rifiutato con un messaggio chiaro invece di salvare una fonte vuota.
export const SUPPORTED_FILE_EXTENSIONS = ['.txt', '.csv', '.md', '.docx', '.pdf'] as const;
export type SupportedFileExtension = (typeof SUPPORTED_FILE_EXTENSIONS)[number];

// Estensione (minuscola, col punto) dal nome file. '' se assente/sconosciuta.
export const getFileExtension = (fileName: string): string => {
  const match = /\.[a-z0-9]+$/i.exec((fileName ?? '').trim());
  return match ? match[0].toLowerCase() : '';
};
const FETCH_TIMEOUT_MS = 15_000;
const USER_AGENT = 'AdvaioraCRM/1.0 (+source-fetcher)';

// Errore "di estrazione": messaggio leggibile, da mostrare come stato della fonte.
export class SourceExtractionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SourceExtractionError';
  }
}

// Rimuove markup e rumore da un frammento HTML, restituendo testo leggibile.
const stripHtml = (html: string): string =>
  html
    // Il <head> (title, meta, style) è estratto a parte: fuori dal corpo testo.
    .replace(/<head[\s\S]*?<\/head>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&apos;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();

const extractHtmlTitle = (html: string): string | null => {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!match) {
    return null;
  }
  const title = stripHtml(match[1]).slice(0, 200);
  return title || null;
};

// Normalizza testo grezzo (incollato o non-HTML): newline uniformi, niente righe
// vuote multiple, tetto massimo di caratteri.
export const normalizeText = (raw: unknown): string => {
  const text = String(raw ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return text.slice(0, MAX_CONTENT_CHARS);
};

type FetchLike = typeof fetch;

// Estrae il testo da un PDF riusando `pdf-parse` (già dipendenza del progetto,
// usata anche lato Agency). L'import è dinamico: la libreria è pesante e serve
// solo quando arriva davvero un PDF. Gestisce sia l'API nuova (classe PDFParse)
// sia quella legacy (funzione default).
const extractPdfText = async (buffer: Buffer): Promise<string> => {
  const pdfParseModule = (await import('pdf-parse')) as {
    PDFParse?: new (options: { data: Buffer }) => {
      getText: () => Promise<{ text?: string }>;
      destroy?: () => Promise<void> | void;
    };
    default?: (buffer: Buffer) => Promise<{ text?: string }>;
  };
  if (pdfParseModule.PDFParse) {
    const parser = new pdfParseModule.PDFParse({ data: buffer });
    try {
      const extracted = await parser.getText();
      return extracted.text ?? '';
    } finally {
      await parser.destroy?.();
    }
  }
  if (pdfParseModule.default) {
    const extracted = await pdfParseModule.default(buffer);
    return extracted.text ?? '';
  }
  throw new SourceExtractionError('Parser PDF non disponibile nel runtime.');
};

export const sourceExtractor = {
  // Scarica un URL ed estrae il testo. `fetchImpl` iniettabile per i test.
  async fromUrl(
    url: string,
    fetchImpl: FetchLike = fetch,
  ): Promise<{ content: string; title: string | null }> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetchImpl(url, {
        method: 'GET',
        redirect: 'follow',
        signal: controller.signal,
        headers: { 'user-agent': USER_AGENT, accept: 'text/html,text/plain,*/*' },
      });
    } catch (error) {
      throw new SourceExtractionError(
        error instanceof Error && error.name === 'AbortError'
          ? 'Timeout nel download dell\'URL'
          : 'Impossibile scaricare l\'URL',
      );
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      throw new SourceExtractionError(`URL non raggiungibile (stato ${response.status})`);
    }

    const contentType = response.headers.get('content-type') ?? '';
    const body = await response.text();

    let content: string;
    let title: string | null = null;
    if (contentType.includes('html') || /^\s*</.test(body)) {
      title = extractHtmlTitle(body);
      content = stripHtml(body);
    } else {
      content = normalizeText(body);
    }

    content = content.slice(0, MAX_CONTENT_CHARS);
    if (!content) {
      throw new SourceExtractionError('Nessun testo estraibile dall\'URL');
    }

    return { content, title };
  },

  // Estrae il testo da un file caricato in base all'estensione. TXT/CSV/MD sono
  // letti come UTF-8; DOCX via mammoth; PDF via pdf-parse. Un formato non gestito
  // o un file illeggibile diventano un SourceExtractionError (stato "error").
  async fromFile(input: {
    buffer: Buffer;
    fileName: string;
  }): Promise<{ content: string; title: null }> {
    const extension = getFileExtension(input.fileName);
    if (!SUPPORTED_FILE_EXTENSIONS.includes(extension as SupportedFileExtension)) {
      throw new SourceExtractionError(
        `Formato non supportato${extension ? ` (${extension})` : ''}. Ammessi: TXT, CSV, MD, DOCX, PDF.`,
      );
    }

    let raw: string;
    try {
      if (extension === '.txt' || extension === '.csv' || extension === '.md') {
        raw = input.buffer.toString('utf8');
      } else if (extension === '.docx') {
        const mammoth = await import('mammoth');
        const extracted = await mammoth.extractRawText({ buffer: input.buffer });
        raw = extracted.value ?? '';
      } else {
        // extension === '.pdf'
        raw = await extractPdfText(input.buffer);
      }
    } catch (error) {
      if (error instanceof SourceExtractionError) {
        throw error;
      }
      const message = error instanceof Error ? error.message.toLowerCase() : '';
      if (message.includes('password') || message.includes('encrypted')) {
        throw new SourceExtractionError('File protetto da password: impossibile leggerne il contenuto.');
      }
      throw new SourceExtractionError('Estrazione del testo dal file non riuscita.');
    }

    const content = normalizeText(raw);
    if (!content) {
      throw new SourceExtractionError(
        'Nessun testo estraibile dal file (potrebbe essere vuoto o contenere solo immagini).',
      );
    }
    return { content, title: null };
  },
};
