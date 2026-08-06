// I pallini sulle voci del gruppo "Priorita" della barra di progetto.
//
// Il dato non costa niente: il contesto di lavoro che la barra carica gia' di suo
// (`getAgencyProjectWorkingContext`) contiene le tre liste complete — alerts,
// tasks, opportunities — e fino al 6/8/2026 non le usava nessuno. Nessuna chiamata
// nuova al server.
//
// Il colore e' fisso per voce, non per gravita': rosso = c'e' qualcosa che non va,
// giallo = c'e' qualcosa da chiudere, verde = e' emerso qualcosa di buono. Il
// pallino compare solo se il numero e' maggiore di zero.

export const SIGNAL_TONE = {
  alerts: "danger",
  tasks: "warning",
  opportunities: "success",
};

// Uno stato "chiuso" non deve accendere niente. Il vocabolario e' quello di
// alertsConstants.js (open/todo/in_progress/review/resolved/done), piu' due voci
// che compaiono sulle opportunita'.
const CLOSED_STATUSES = new Set(["resolved", "done", "closed", "archived", "rejected", "discarded"]);

// "Task importanti da chiudere": non tutti i task accendono il pallino, o sarebbe
// sempre acceso e smetterebbe di dire qualcosa.
const IMPORTANT_PRIORITIES = new Set(["critical", "high"]);

const isOpen = (entry) => !CLOSED_STATUSES.has(String(entry?.status || "").toLowerCase());

const countOpen = (list, extraCondition) => (
  Array.isArray(list)
    ? list.filter((entry) => isOpen(entry) && (!extraCondition || extraCondition(entry))).length
    : 0
);

const isImportantTask = (task) => (
  IMPORTANT_PRIORITIES.has(String(task?.priority || "").toLowerCase())
);

// Torna quanti elementi meritano il pallino, per chiave di scheda. Zero = nessun
// pallino.
export const buildSectionSignals = (workingContext) => ({
  alerts: countOpen(workingContext?.alerts),
  tasks: countOpen(workingContext?.tasks, isImportantTask),
  opportunities: countOpen(workingContext?.opportunities),
});

// Cosa si legge quando il pallino e' spento. Il pallino spento c'e' sempre (scelta
// di Jacopo del 6/8/2026): cosi' l'assenza di segnale si legge come "non c'e'
// niente" invece che come "qui non e' previsto niente", e la barra non si muove
// quando un segnale si accende.
export const EMPTY_SIGNAL_LABEL = {
  alerts: "Nessuna segnalazione aperta",
  tasks: "Nessun task importante da chiudere",
  opportunities: "Nessuna opportunita da valutare",
};

// Cosa sente chi usa un lettore di schermo, e cosa si legge passando il mouse.
// Serve perche' un pallino colorato da solo comunica con il solo colore: chi non
// distingue i colori, o non vede affatto, non saprebbe che c'e' qualcosa.
export const describeSignal = (key, count) => {
  if (!count) {
    return "";
  }

  if (key === "alerts") {
    return count === 1 ? "1 segnalazione da risolvere" : `${count} segnalazioni da risolvere`;
  }
  if (key === "tasks") {
    return count === 1 ? "1 task importante da chiudere" : `${count} task importanti da chiudere`;
  }
  if (key === "opportunities") {
    return count === 1 ? "1 opportunita da valutare" : `${count} opportunita da valutare`;
  }

  return "";
};
