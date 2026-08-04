// Riduttori puri della bozza Ads: prendono lo stato corrente e il pezzo appena
// prodotto dai builder rule-based, e restituiscono lo stato successivo.
// Estratti dagli aggiornamenti di stato di AgencyProjectAdsPage.jsx (4/8/2026)
// senza cambiarne il comportamento.
//
// Il punto delicato e' `adCopyBlocks`: e' un oggetto con una chiave per canale,
// e generare un canale NON deve cancellare il copy dell'altro — per questo si
// fonde a mano invece di lasciarlo allo spread.
//
// Con stato `null` (pagina ancora in caricamento) si restituisce lo stato
// invariato, come faceva la guardia dentro `setAdsState`.

const nowIso = () => new Date().toISOString();

export const applyGeneratedGoogleAds = (current, generated) => {
  if (!current) {
    return current;
  }

  return {
    ...current,
    output: {
      ...current.output,
      ...generated,
      adCopyBlocks: {
        ...current.output.adCopyBlocks,
        google: generated.adCopyBlocks.google,
      },
      googleAds: generated.googleAds,
      lastGeneratedAt: nowIso(),
    },
  };
};

export const applyGeneratedMetaAds = (current, generated) => {
  if (!current) {
    return current;
  }

  return {
    ...current,
    output: {
      ...current.output,
      ...generated,
      adCopyBlocks: {
        ...current.output.adCopyBlocks,
        meta: generated.adCopyBlocks.meta,
      },
      metaAds: generated.metaAds,
      messageHooks: generated.messageHooks,
      lastGeneratedAt: nowIso(),
    },
  };
};

export const applyGeneratedOperationalPlan = (current, generated) => {
  if (!current) {
    return current;
  }

  return {
    ...current,
    output: {
      ...current.output,
      ...generated,
      lastGeneratedAt: nowIso(),
    },
  };
};

// Rigenerazione completa: i tre output entrano insieme, e i campi che vanno
// ricomposti a mano (copy per canale, blocchi per canale, hook) vengono
// riapplicati DOPO gli spread, come nell'originale.
export const applyFullAdsRegeneration = (current, { googleOutput, metaOutput, operationalOutput }) => {
  if (!current) {
    return current;
  }

  return {
    ...current,
    output: {
      ...current.output,
      ...googleOutput,
      ...metaOutput,
      ...operationalOutput,
      adCopyBlocks: {
        ...current.output.adCopyBlocks,
        google: googleOutput.adCopyBlocks.google,
        meta: metaOutput.adCopyBlocks.meta,
      },
      googleAds: googleOutput.googleAds,
      metaAds: metaOutput.metaAds,
      messageHooks: metaOutput.messageHooks,
      lastGeneratedAt: nowIso(),
    },
  };
};
