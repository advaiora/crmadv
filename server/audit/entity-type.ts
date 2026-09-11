// La forma canonica del bersaglio di una registrazione (CRMA-28).
//
// Perché questo file esiste, invece di tenere la funzione dentro
// l'intercettore: la chiave con cui l'annotazione a mano e la registrazione
// automatica si riconoscono fra loro è costruita in DUE posti diversi —
// `server/core/request-context.ts` quando si marca e si filtra, e
// `server/audit/audit-interceptor.ts` quando si deriva dal nome del modello
// Prisma. Se ognuno dei due la costruisce a modo suo, lo scarto dei doppioni
// smette di agganciare senza dare nessun errore.
//
// Il difetto non è teorico: prima di questa correzione 41 annotazioni a mano su
// 90 nominavano il bersaglio col nome del modello in PascalCase (`'Client'`,
// `'Project'`, `'ChecklistInstanceItem'`…) mentre l'automatica usava la forma
// snake (`client`, `project`, `checklist_instance_item`). Ogni creazione di
// cliente, ogni modifica di progetto e ogni spunta di checklist finivano nel
// registro DUE volte.
//
// La normalizzazione vive solo dentro la richiesta, come chiave di confronto:
// il valore salvato in `AuditLog.entityType` resta quello che chi annota ha
// scritto. Le righe storiche non vanno toccate, e nessuna migrazione dati serve
// per questa correzione. Uniformare i nomi già in tabella è un lavoro diverso e
// separato (voce di roadmap).
//
// ⚠️ Chi tocca questo file tocca entrambi i lati del confronto: la funzione va
// usata in tutti e due, o in nessuno.

// I tre tipi di sito hanno modelli distinti ma le annotazioni scritte a mano li
// chiamano tutti `web_asset`: se l'intercettore usasse tre nomi diversi, lo
// scarto dei doppioni non riconoscerebbe più il bersaglio già annotato.
const ENTITY_TYPE_OVERRIDES: Record<string, string> = {
  WebsiteAsset: 'web_asset',
  WebAppAsset: 'web_asset',
  EcommerceAsset: 'web_asset',
};

const toSnakeCase = (name: string) =>
  name
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .toLowerCase();

// Porta un bersaglio nella forma canonica, da qualunque delle due convenzioni
// arrivi. È idempotente: un valore già in forma snake (`quote_template`) non
// contiene maiuscole e resta identico a sé stesso, quindi applicarla alle 49
// annotazioni che erano già giuste non cambia niente.
export const normalizeEntityType = (entityType: string) =>
  ENTITY_TYPE_OVERRIDES[entityType] ?? toSnakeCase(entityType);

// Il nome con cui l'intercettore chiama il bersaglio, partendo dal nome del
// modello Prisma. È la stessa funzione: il nome diverso dice solo da che lato
// la si sta guardando.
export const resolveEntityType = normalizeEntityType;
