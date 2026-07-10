// Estrazione del testo di una fonte (V4 — Modulo Fonti). Per ora URL e testo
// incollato; il caricamento file (Word/PDF) arriverà in uno step successivo.
// Nessuna dipendenza esterna: fetch globale (Node 18+) + strip HTML basilare.

export const MAX_CONTENT_CHARS = 200_000;
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
};
