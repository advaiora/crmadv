// Analyzer SEO puro: dato l'HTML di una pagina (gia' scaricato in modo sicuro dal
// service) produce punteggio, segnali estratti, problemi e consigli. Nessuna rete, nessun
// DB, nessuna AI: e' deterministico e rule-based, cosi' e' testabile in isolamento e non
// dipende dal nodo AI (terreno condiviso, in mano a Claudio).

export type SeoIssueSeverity = 'high' | 'medium' | 'low';

export type SeoIssue = {
  code: string;
  severity: SeoIssueSeverity;
  message: string;
};

export type SeoAnalysis = {
  score: number;
  metaTitle: string | null;
  metaDescription: string | null;
  h1Count: number;
  detectedKeywords: string[];
  missingKeywords: string[];
  issues: SeoIssue[];
  suggestions: string[];
};

// Contenuto testuale di un tag a coppia (es. <title>…</title>), normalizzato.
const readTagContent = (html: string, tagName: string): string | null => {
  const match = html.match(new RegExp(`<${tagName}[^>]*>(.*?)<\\/${tagName}>`, 'is'));
  if (!match || typeof match[1] !== 'string') {
    return null;
  }
  return match[1].replace(/\s+/g, ' ').trim() || null;
};

// Contenuto di un <meta>, robusto all'ordine degli attributi e a name/property (per l'Open
// Graph). Ritorna il primo che combacia.
const readMetaContent = (html: string, key: string): string | null => {
  const metaTags = html.match(/<meta\b[^>]*>/gi) ?? [];
  const wanted = key.toLowerCase();

  for (const tag of metaTags) {
    const nameMatch = tag.match(/\b(?:name|property)\s*=\s*["']?([^"'\s>]+)/i);
    if (!nameMatch || nameMatch[1].toLowerCase() !== wanted) {
      continue;
    }

    const contentMatch =
      tag.match(/\bcontent\s*=\s*["']([^"']*)["']/i) ?? tag.match(/\bcontent\s*=\s*([^\s>]+)/i);
    if (contentMatch && typeof contentMatch[1] === 'string') {
      return contentMatch[1].trim() || null;
    }
  }

  return null;
};

// href di un <link rel="…"> (es. canonical). rel puo' contenere piu' valori separati da spazio.
const readLinkHref = (html: string, rel: string): string | null => {
  const linkTags = html.match(/<link\b[^>]*>/gi) ?? [];
  const wanted = rel.toLowerCase();

  for (const tag of linkTags) {
    const relMatch = tag.match(/\brel\s*=\s*["']?([^"'>]+)["']?/i);
    if (!relMatch || !relMatch[1].toLowerCase().split(/\s+/).includes(wanted)) {
      continue;
    }

    const hrefMatch = tag.match(/\bhref\s*=\s*["']([^"']*)["']/i);
    if (hrefMatch && typeof hrefMatch[1] === 'string') {
      return hrefMatch[1].trim() || null;
    }
  }

  return null;
};

const countTags = (html: string, tagName: string): number =>
  (html.match(new RegExp(`<${tagName}\\b[^>]*>`, 'gi')) ?? []).length;

const countImagesWithoutAlt = (html: string): { total: number; missing: number } => {
  const imgTags = html.match(/<img\b[^>]*>/gi) ?? [];
  const missing = imgTags.filter((tag) => {
    const altMatch = tag.match(/\balt\s*=\s*["']([^"']*)["']/i);
    return !altMatch || altMatch[1].trim() === '';
  }).length;
  return { total: imgTags.length, missing };
};

const isHttpsUrl = (url: string): boolean => {
  try {
    return new URL(url).protocol === 'https:';
  } catch {
    return false;
  }
};

export const analyzeSeoHtml = (input: {
  html: string;
  url: string;
  requestedKeywords: string[];
}): SeoAnalysis => {
  const { html } = input;

  const metaTitle = readTagContent(html, 'title');
  const metaDescription = readMetaContent(html, 'description');
  const keywordsMeta = readMetaContent(html, 'keywords');
  const h1Count = countTags(html, 'h1');
  const h2Count = countTags(html, 'h2');
  const canonical = readLinkHref(html, 'canonical');
  const viewport = readMetaContent(html, 'viewport');
  const robots = readMetaContent(html, 'robots');
  const ogTitle = readMetaContent(html, 'og:title');
  const ogDescription = readMetaContent(html, 'og:description');
  const ogImage = readMetaContent(html, 'og:image');
  const langMatch = html.match(/<html\b[^>]*\blang\s*=\s*["']([^"']+)["']/i);
  const lang = langMatch ? langMatch[1].trim() : null;
  const images = countImagesWithoutAlt(html);

  const detectedKeywords = keywordsMeta
    ? keywordsMeta.split(',').map((keyword) => keyword.trim()).filter(Boolean)
    : [];
  const requestedKeywords = input.requestedKeywords;

  let score = 100;
  const issues: SeoIssue[] = [];
  const suggestions: string[] = [];

  const penalize = (points: number, issue: SeoIssue) => {
    score -= points;
    issues.push(issue);
  };

  // Titolo
  if (!metaTitle) {
    penalize(30, { code: 'title-missing', severity: 'high', message: 'Manca il tag <title>.' });
    suggestions.push('Aggiungi un titolo di pagina descrittivo (30-60 caratteri).');
  } else if (metaTitle.length < 30 || metaTitle.length > 60) {
    penalize(8, {
      code: 'title-length',
      severity: 'low',
      message: `Titolo di ${metaTitle.length} caratteri (consigliato 30-60).`,
    });
    suggestions.push('Porta la lunghezza del titolo tra 30 e 60 caratteri.');
  }

  // Meta description
  if (!metaDescription) {
    penalize(20, {
      code: 'meta-description-missing',
      severity: 'high',
      message: 'Manca la meta description.',
    });
    suggestions.push('Aggiungi una meta description tra 70 e 160 caratteri.');
  } else if (metaDescription.length < 70 || metaDescription.length > 160) {
    penalize(8, {
      code: 'meta-description-length',
      severity: 'low',
      message: `Meta description di ${metaDescription.length} caratteri (consigliato 70-160).`,
    });
    suggestions.push('Ottimizza la lunghezza della meta description (70-160 caratteri).');
  }

  // Robots noindex: la pagina e' esclusa dall'indicizzazione — problema serio.
  if (robots && /\bnoindex\b/i.test(robots)) {
    penalize(25, {
      code: 'robots-noindex',
      severity: 'high',
      message: `La pagina ha robots "noindex": non verrà indicizzata dai motori.`,
    });
    suggestions.push('Rimuovi "noindex" dalla meta robots se la pagina deve essere indicizzata.');
  }

  // H1
  if (h1Count === 0) {
    penalize(18, { code: 'h1-missing', severity: 'high', message: 'Nessun heading H1 trovato.' });
    suggestions.push('Aggiungi un unico H1 principale che descriva la pagina.');
  } else if (h1Count > 1) {
    penalize(6, {
      code: 'h1-multiple',
      severity: 'medium',
      message: `Trovati ${h1Count} heading H1 (consigliato uno solo).`,
    });
    suggestions.push('Usa un solo H1 per pagina quando possibile.');
  }

  // Struttura headings
  if (h1Count > 0 && h2Count === 0) {
    suggestions.push("Aggiungi heading H2 per strutturare i contenuti sotto l'H1.");
  }

  // Viewport (mobile)
  if (!viewport) {
    penalize(8, {
      code: 'viewport-missing',
      severity: 'medium',
      message: 'Manca la meta viewport: la pagina potrebbe non essere responsive.',
    });
    suggestions.push('Aggiungi <meta name="viewport" content="width=device-width, initial-scale=1">.');
  }

  // Attributo lang
  if (!lang) {
    penalize(5, {
      code: 'html-lang-missing',
      severity: 'low',
      message: "Manca l'attributo lang su <html>.",
    });
    suggestions.push('Dichiara la lingua della pagina con <html lang="it"> (o la lingua giusta).');
  }

  // Canonical
  if (!canonical) {
    penalize(6, {
      code: 'canonical-missing',
      severity: 'low',
      message: 'Manca il link canonical.',
    });
    suggestions.push('Aggiungi un <link rel="canonical"> per evitare contenuti duplicati.');
  }

  // Open Graph (anteprima social)
  if (!ogTitle && !ogDescription && !ogImage) {
    penalize(6, {
      code: 'open-graph-missing',
      severity: 'low',
      message: 'Mancano i tag Open Graph (anteprima social).',
    });
    suggestions.push("Aggiungi og:title, og:description e og:image per l'anteprima sui social.");
  } else if (!ogImage) {
    suggestions.push("Aggiungi og:image per un'anteprima social più efficace.");
  }

  // Copertura alt delle immagini
  if (images.total > 0 && images.missing > 0) {
    penalize(Math.min(10, images.missing * 2), {
      code: 'image-alt-missing',
      severity: 'medium',
      message: `${images.missing} immagini su ${images.total} senza attributo alt.`,
    });
    suggestions.push('Aggiungi un testo alt descrittivo a tutte le immagini di contenuto.');
  }

  // HTTPS
  if (!isHttpsUrl(input.url)) {
    penalize(10, {
      code: 'not-https',
      severity: 'medium',
      message: 'La pagina non è servita in HTTPS.',
    });
    suggestions.push('Servi la pagina in HTTPS per sicurezza e ranking.');
  }

  // Copertura keyword richieste
  const normalizedHtml = html.toLowerCase();
  const missingKeywords = requestedKeywords.filter(
    (keyword) => !normalizedHtml.includes(keyword.toLowerCase()),
  );
  if (missingKeywords.length > 0) {
    penalize(Math.min(20, missingKeywords.length * 4), {
      code: 'keyword-coverage',
      severity: 'medium',
      message: `Keyword non presenti nella pagina: ${missingKeywords.join(', ')}`,
    });
    suggestions.push('Inserisci in modo naturale le keyword mancanti nei contenuti.');
  }

  score = Math.max(0, Math.min(100, score));

  return {
    score,
    metaTitle,
    metaDescription,
    h1Count,
    detectedKeywords,
    missingKeywords,
    issues,
    suggestions,
  };
};
