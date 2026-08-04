// Riduttori puri della bozza Web: prendono lo stato corrente e il pezzo appena
// generato dai builder rule-based, e restituiscono lo stato successivo.
// Sono stati estratti dagli aggiornamenti di stato di AgencyProjectWebPage.jsx
// (4/8/2026) senza cambiarne il comportamento: ogni riduttore lascia intatto
// cio' che non tocca e aggiorna sempre `lastGeneratedAt`.
//
// Regola comune: con stato `null` (pagina ancora in caricamento) si restituisce
// lo stato invariato, esattamente come faceva la guardia dentro `setWebState`.

const nowIso = () => new Date().toISOString();

// I tre campi di contesto vengono riempiti dalla Discovery solo se l'utente non
// li ha gia' valorizzati a mano: la generazione non deve mai sovrascriverli.
const fallbackContext = (current) => ({
  targetSummary: current.output.targetSummary || current.input.discovery.sections.target || "",
  offerSummary: current.output.offerSummary || current.input.discovery.sections.offer || "",
  pageGoal: current.output.pageGoal
    || current.input.discovery.sections.projectGoal
    || current.input.contextSummary
    || "",
});

export const applyGeneratedStructure = (current, sectionPlan) => {
  if (!current) {
    return current;
  }

  const context = fallbackContext(current);

  return {
    ...current,
    output: {
      ...current.output,
      sectionPlan,
      targetSummary: context.targetSummary,
      offerSummary: context.offerSummary,
      pageGoal: context.pageGoal,
      lastGeneratedAt: nowIso(),
    },
  };
};

export const applyGeneratedCopy = (current, generatedCopy) => {
  if (!current) {
    return current;
  }

  return {
    ...current,
    output: {
      ...current.output,
      ...generatedCopy,
      lastGeneratedAt: nowIso(),
    },
  };
};

export const applyGeneratedWireframe = (current, wireframe) => {
  if (!current) {
    return current;
  }

  return {
    ...current,
    output: {
      ...current.output,
      wireframe,
      lastGeneratedAt: nowIso(),
    },
  };
};

export const applyGeneratedPreview = (current, previewHtmlBase) => {
  if (!current) {
    return current;
  }

  return {
    ...current,
    output: {
      ...current.output,
      previewHtmlBase,
      lastGeneratedAt: nowIso(),
    },
  };
};

// Rigenerazione completa: l'output generato entra per intero, ma i tre campi di
// contesto restano quelli gia' scelti dall'utente (per questo sono applicati
// DOPO lo spread, come nell'originale).
export const applyRegeneratedOutput = (current, generatedOutput) => {
  if (!current) {
    return current;
  }

  const context = fallbackContext(current);

  return {
    ...current,
    output: {
      ...current.output,
      ...generatedOutput,
      pageGoal: context.pageGoal,
      targetSummary: context.targetSummary,
      offerSummary: context.offerSummary,
      lastGeneratedAt: nowIso(),
    },
  };
};
