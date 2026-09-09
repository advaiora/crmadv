// Intercettore automatico delle scritture (CRMA-28).
//
// Il problema che risolve: fino a oggi il Registro attività si reggeva solo su
// annotazioni scritte a mano, sparse in una ventina di file. Tutto ciò che
// nessuno si ricordava di annotare semplicemente non compariva — l'area
// Produzione AI, le conversazioni AI, le opportunità e gli avvisi non
// comparivano affatto.
//
// Come funziona: è un'estensione Prisma di tipo `query` applicata a tutti i
// modelli. Ogni scrittura passa di qui, quindi il codice scritto DOPO risulta
// tracciato per costruzione, senza che nessuno debba aggiungere una riga di
// annotazione.
//
// Tre scelte da conoscere prima di modificarlo:
//
// 1. LE REGISTRAZIONI NON SI SCRIVONO SUBITO. Si accumulano nel contesto di
//    richiesta e si scrivono tutte insieme alla fine, e solo se la richiesta è
//    andata a buon fine (vedi flushRequestAuditTrail). Il motivo è che una
//    scrittura intercettata può stare dentro una transazione ancora aperta:
//    scrivere subito, dall'esterno della transazione, produrrebbe una riga di
//    registro per un'operazione poi annullata, e in più fallirebbe il vincolo di
//    chiave esterna quando il workspace o l'utente sono appena stati creati
//    dentro quella stessa transazione e non sono ancora visibili fuori.
//
// 2. L'ANNOTAZIONE A MANO VINCE. Se nella stessa richiesta qualcuno ha già
//    annotato lo stesso bersaglio con `audit.log`, quella automatica viene
//    scartata. «Ha inviato il preventivo al cliente» dice molto più di «una riga
//    è cambiata», e non vogliamo due righe per lo stesso fatto.
//
// 3. È UN ELENCO DI ESCLUSIONI, NON DI INCLUSIONI. Di norma si traccia; si
//    elencano i modelli da NON tracciare. Il contrario (elenco di inclusioni)
//    tradirebbe lo scopo: un modello nuovo nascerebbe non tracciato, ed è
//    esattamente il guasto che questo file esiste per chiudere.

import { requestContext, type PendingAuditEntry } from '../core/request-context.js';

// Le operazioni che cambiano dati. Le letture non passano di qui.
const TRACKED_OPERATIONS = new Set([
  'create',
  'createMany',
  'createManyAndReturn',
  'update',
  'updateMany',
  'updateManyAndReturn',
  'upsert',
  'delete',
  'deleteMany',
]);

// Dall'operazione Prisma al verbo che finisce nel nome dell'evento.
const OPERATION_VERB: Record<string, 'create' | 'update' | 'delete'> = {
  create: 'create',
  createMany: 'create',
  createManyAndReturn: 'create',
  update: 'update',
  updateMany: 'update',
  updateManyAndReturn: 'update',
  upsert: 'update',
  delete: 'delete',
  deleteMany: 'delete',
};

// ⚠️ I modelli qui sotto NON vengono tracciati, e ognuno ha il suo motivo.
// Aggiungerne uno è una decisione: si toglie qualcosa dal registro. Toglierne
// uno invece è gratis e va nella direzione giusta.
const EXCLUDED_MODELS = new Map<string, string>([
  // Ricorsione: registrare la scrittura di una registrazione ne genererebbe
  // un'altra, all'infinito. Questa esclusione non è negoziabile.
  ['AuditLog', 'ricorsione: è il registro stesso'],

  // Scritture di macchina ad altissima frequenza. Il punto 4 della release
  // (CRMA-26) esiste proprio perché il registro era diventato illeggibile per
  // troppe righe automatiche: non lo si riempie di nuovo dall'altro lato.
  ['AiUsageLog', 'una riga per ogni chiamata AI: è già un registro suo'],
  ['ProjectSourceChunk', 'centinaia di righe per ogni documento caricato'],
  ['WebAssetAnalyticsEvent', 'telemetria, non azione di una persona'],
  ['WebAssetAnalyticsSnapshot', 'telemetria, non azione di una persona'],
  ['WebAssetHealthCheck', 'controllo automatico periodico'],
  ['WebAssetSeoReport', 'controllo automatico periodico'],
  ['PerformanceSnapshot', 'controllo automatico periodico'],
  ['PerformanceMetricSet', 'controllo automatico periodico'],

  // Segreti e materiale cifrato: il fatto va registrato dove lo si maneggia,
  // con il significato giusto, non da un intercettore che vede solo la riga.
  ['PasswordResetToken', 'materiale di sicurezza a vita breve'],
  ['WorkspaceVaultKey', 'chiavi: annotate a mano dal modulo vault'],
  ['AiConversationAttachmentBinary', 'blob senza workspace: non attribuibile'],
]);

// I tre tipi di sito hanno modelli distinti ma le annotazioni scritte a mano li
// chiamano tutti `web_asset`: se l'intercettore usasse tre nomi diversi, lo
// scarto dei doppioni non riconoscerebbe più il bersaglio già annotato.
const ENTITY_TYPE_OVERRIDES: Record<string, string> = {
  WebsiteAsset: 'web_asset',
  WebAppAsset: 'web_asset',
  EcommerceAsset: 'web_asset',
};

const toSnakeCase = (modelName: string) =>
  modelName
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .toLowerCase();

export const resolveEntityType = (modelName: string) =>
  ENTITY_TYPE_OVERRIDES[modelName] ?? toSnakeCase(modelName);

export const isTrackedModel = (modelName: string | undefined): modelName is string =>
  Boolean(modelName) && !EXCLUDED_MODELS.has(modelName as string);

export const isTrackedOperation = (operation: string) => TRACKED_OPERATIONS.has(operation);

const readString = (source: unknown, key: string): string | null => {
  if (typeof source !== 'object' || source === null) {
    return null;
  }

  // Su createMany `data` è un elenco di righe, non una riga: si guarda la prima.
  // Le righe di una stessa createMany appartengono sempre allo stesso workspace
  // (è la chiave con cui ogni query è delimitata), quindi la prima basta.
  if (Array.isArray(source)) {
    return source.length > 0 ? readString(source[0], key) : null;
  }

  const value = (source as Record<string, unknown>)[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
};

// Il workspace si cerca prima nella riga scritta, poi nel contesto della
// richiesta. L'ordine è voluto: la riga dice a quale workspace appartiene
// davvero il dato, mentre il contesto dice solo con quale workspace è entrato
// chi sta agendo — e per un amministratore di piattaforma i due possono
// differire.
export const resolveWorkspaceId = (args: unknown, result: unknown): string | null =>
  readString(result, 'workspaceId')
  ?? readString((args as { data?: unknown } | null)?.data, 'workspaceId')
  ?? readString((args as { create?: unknown } | null)?.create, 'workspaceId')
  ?? readString((args as { where?: unknown } | null)?.where, 'workspaceId')
  ?? requestContext.getWorkspaceId();

export const resolveEntityId = (args: unknown, result: unknown): string | null =>
  readString(result, 'id') ?? readString((args as { where?: unknown } | null)?.where, 'id');

const resolveAffectedCount = (operation: string, result: unknown): number => {
  if (operation === 'createMany' || operation === 'updateMany' || operation === 'deleteMany') {
    const count = (result as { count?: unknown } | null)?.count;
    return typeof count === 'number' ? count : 1;
  }

  return 1;
};

/**
 * Costruisce la registrazione da mettere in coda per una scrittura intercettata,
 * oppure `null` se questa scrittura non va tracciata.
 *
 * Esportata a parte dall'estensione perché è tutta la logica decisionale del
 * file, e così si può provare senza un database acceso.
 */
export const buildPendingAuditEntry = ({
  model,
  operation,
  args,
  result,
  actorUserId,
}: {
  model: string | undefined;
  operation: string;
  args: unknown;
  result: unknown;
  actorUserId: string | null;
}): { key: string; entry: PendingAuditEntry } | null => {
  if (!isTrackedModel(model) || !isTrackedOperation(operation)) {
    return null;
  }

  const workspaceId = resolveWorkspaceId(args, result);
  if (!workspaceId) {
    // Senza workspace la riga non è scrivibile (è una colonna obbligatoria con
    // vincolo di chiave esterna) e soprattutto non sarebbe leggibile da nessuno:
    // il Registro attività si consulta sempre dentro un workspace.
    return null;
  }

  const verb = OPERATION_VERB[operation];
  const entityType = resolveEntityType(model);
  const entityId = resolveEntityId(args, result);

  return {
    key: `${entityType}:${entityId ?? `${operation}:${workspaceId}`}:${verb}`,
    entry: {
      action: `${entityType}.${verb}`,
      entityType,
      entityId,
      workspaceId,
      actorUserId,
      operation,
      affectedCount: resolveAffectedCount(operation, result),
    },
  };
};

/**
 * L'estensione Prisma da applicare al client. Va applicata una volta sola, in
 * initializePrisma: il client esteso finisce dietro al Proxy `prisma`, quindi
 * tutti i cinquanta file che lo importano ricevono quello esteso senza che
 * nessuno di loro cambi di una riga.
 */
export const auditInterceptorExtension = {
  name: 'registro-attivita',
  query: {
    $allModels: {
      async $allOperations({
        model,
        operation,
        args,
        query,
      }: {
        model?: string;
        operation: string;
        args: unknown;
        query: (args: unknown) => Promise<unknown>;
      }) {
        const result = await query(args);

        if (!isTrackedOperation(operation)) {
          return result;
        }

        // L'accodamento non deve mai far fallire la scrittura che l'ha
        // provocata: registrare è importante, ma meno che salvare il dato.
        try {
          const pending = buildPendingAuditEntry({
            model,
            operation,
            args,
            result,
            actorUserId: requestContext.getUserId(),
          });

          if (pending) {
            requestContext.addPendingAuditEntry(pending.key, pending.entry);
          }
        } catch {
          // Volutamente silenzioso qui: chi svuota la coda a fine richiesta
          // scrive nel log dell'applicazione se qualcosa è andato storto, e
          // quello è il posto dove si vede. Vedi flushRequestAuditTrail.
        }

        return result;
      },
    },
  },
};
