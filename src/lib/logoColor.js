// Estrazione del colore dominante da un'immagine (il logo del workspace).
// Serve a suggerire l'accento della palette piu' "in tinta" col logo caricato.
// Interamente lato browser (canvas). Non blocca mai: se non riesce ritorna null.

const SAMPLE_SIZE = 48; // l'immagine viene ridotta a questa dimensione per campionare

const toHex = (r, g, b) =>
  `#${[r, g, b]
    .map((channel) => Math.max(0, Math.min(255, Math.round(channel))).toString(16).padStart(2, '0'))
    .join('')}`;

const loadImage = (imageUrl) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    // Necessario per poter leggere i pixel di immagini servite da altra origine.
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Immagine non leggibile.'));
    image.src = imageUrl;
  });

/**
 * Ritorna il colore dominante come hex (#RRGGBB) o null se non estraibile.
 * Ignora i pixel trasparenti e quelli quasi bianchi/neri (sfondo o testo neutro),
 * cosi' da cogliere la tinta "di marca" del logo.
 */
export const extractDominantColor = async (imageUrl) => {
  if (typeof document === 'undefined' || !imageUrl) {
    return null;
  }

  let image;
  try {
    image = await loadImage(imageUrl);
  } catch {
    return null;
  }

  const canvas = document.createElement('canvas');
  canvas.width = SAMPLE_SIZE;
  canvas.height = SAMPLE_SIZE;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) {
    return null;
  }

  context.drawImage(image, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);

  let pixels;
  try {
    // Puo' lanciare SecurityError se il canvas e' "tainted" (immagine cross-origin
    // senza header CORS): in quel caso rinunciamo silenziosamente.
    pixels = context.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE).data;
  } catch {
    return null;
  }

  let sumR = 0;
  let sumG = 0;
  let sumB = 0;
  let count = 0;

  for (let index = 0; index < pixels.length; index += 4) {
    const r = pixels[index];
    const g = pixels[index + 1];
    const b = pixels[index + 2];
    const alpha = pixels[index + 3];

    if (alpha < 128) {
      continue; // trasparente
    }

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const isNearWhite = min > 220;
    const isNearBlack = max < 40;
    const isGray = max - min < 24;
    if (isNearWhite || isNearBlack || isGray) {
      continue; // scarta bianco/nero/grigio: cerchiamo la tinta di marca
    }

    sumR += r;
    sumG += g;
    sumB += b;
    count += 1;
  }

  if (count === 0) {
    return null; // logo neutro (solo bianco/nero/grigio): nessun colore da suggerire
  }

  return toHex(sumR / count, sumG / count, sumB / count);
};
