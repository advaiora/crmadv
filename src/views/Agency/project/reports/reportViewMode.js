// Le due viste del Report — quella per il cliente e quella tecnica — vivono sullo
// STESSO percorso (.../reports/client) e si distinguono solo per questo parametro
// in coda all'indirizzo.
//
// ⚠️ Non trasformare la vista tecnica in un percorso a se': la scheda "Report" in
// cima si illumina confrontando il PERCORSO (AgencyProjectPageTemplate, dove
// `activeSection` e `renderNavigationLink` guardano `location.pathname`). Con un
// percorso diverso si spegnerebbe, ed e' esattamente il difetto che questa fusione
// e' nata per togliere (requisito posto da Jacopo il 6/8/2026). Con un parametro in
// coda resta accesa da sola, senza toccare il template.

export const VIEW_PARAM = "vista";
export const TECHNICAL_VIEW = "tecnica";

// Percorso della vista generale (quella per il cliente): nessun parametro.
export const reportViewPath = (projectId) => (
  `/agency/projects/${encodeURIComponent(projectId)}/reports/client`
);

// Stesso percorso, piu' il parametro che apre la vista tecnica.
export const technicalViewPath = (projectId) => (
  `${reportViewPath(projectId)}?${VIEW_PARAM}=${TECHNICAL_VIEW}`
);

// Legge la querystring (`location.search`) e dice se va mostrata la vista tecnica.
// Qualsiasi altro valore, o l'assenza del parametro, vale come vista generale:
// un indirizzo storpiato non deve mai portare a una pagina vuota.
export const isTechnicalView = (search) => (
  new URLSearchParams(search || "").get(VIEW_PARAM) === TECHNICAL_VIEW
);
