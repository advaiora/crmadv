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
//    ⚠️ Lo scarto si aggancia a `entityType`: un'annotazione a mano che non lo
//    porta non scarta niente. È il motivo per cui `audit.log` va sempre chiamata
//    con `entityType`/`targetType` — vedi il commento in server/audit/audit.ts.
//
// 3. È UN ELENCO DI ESCLUSIONI, NON DI INCLUSIONI. Di norma si traccia; si
//    elencano i modelli da NON tracciare. Il contrario (elenco di inclusioni)
//    tradirebbe lo scopo: un modello nuovo nascerebbe non tracciato, ed è
//    esattamente il guasto che questo file esiste per chiudere.

import { requestContext, type PendingAuditEntry } from '../core/request-context.js';
import { normalizeEntityType } from './entity-type.js';

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

// Le operazioni che toccano un insieme di righe invece che una sola. Servono
// distinte in due punti: per sapere quante righe ha toccato la scrittura, e per
// riconoscere quella che non ne ha toccata nessuna.
const BULK_OPERATIONS = new Set([
  'createMany',
  'createManyAndReturn',
  'updateMany',
  'updateManyAndReturn',
  'deleteMany',
]);

// ⚠️ QUESTO ELENCO NON È IL PERIMETRO INTERO. L'estensione vede solo ciò che
// passa dai metodi di modello di Prisma: le scritture in SQL grezzo
// (`$executeRaw`, `$executeRawUnsafe`) NON passano di qui e non finiscono nel
// registro, per quanto il modello non sia escluso. Oggi riguarda
// server/modules/agency-os/agency.repository.ts:354 e :404 (impostazioni di
// Produzione AI) — fuori dal perimetro di questa release, ma chi scriverà una
// `$executeRaw` domani non è coperto per costruzione e deve annotare a mano.
//
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
  // Stesso caso del precedente, per gli allegati ai messaggi (CRMA-30): i byte
  // stanno in una tabella a parte che NON ha workspaceId, quindi l'intercettore
  // non saprebbe a chi attribuire la riga. Il fatto e' gia' registrato dove ha
  // un significato - la rotta di caricamento annota
  // `messages.attachment.upload` sull'allegato vero, che il workspace ce l'ha.
  // Senza questa riga ogni caricamento produrrebbe DUE registrazioni: quella
  // buona e un doppione non attribuibile sul blob.
  ['WorkspaceMessageAttachmentBinary', 'blob senza workspace: non attribuibile'],
]);

// La forma canonica del bersaglio - e la tabella delle eccezioni sui tre tipi
// di sito, che le annotazioni a mano chiamano tutti `web_asset` - sta in
// server/audit/entity-type.ts: la usa anche l'altro lato del confronto,
// request-context.ts, quando marca un bersaglio annotato a mano e quando
// scarta i doppioni.

export { resolveEntityType } from './entity-type.js';

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
//
// ⚠️ IL MODELLO `Workspace` È IL CASO PARTICOLARE (CRMA-81). Un workspace non ha
// una colonna `workspaceId`: è lui stesso il workspace. Senza il ramo qui sotto
// ogni scrittura su quella tabella ripiegava sul contesto, cioè sul workspace da
// cui è entrato l'amministratore — e una sospensione del workspace B finiva
// annotata nel registro di A, dove non era mai successo niente. Scelta di Jacopo
// del 10/9/2026 (strada «b1»): la riga va nel registro del workspace bersaglio,
// perché è chi amministra B a dover vedere cosa gli è stato fatto, anche quando
// l'attore di B non è membro.
export const resolveWorkspaceId = (
  args: unknown,
  result: unknown,
  model?: string,
): string | null =>
  readString(result, 'workspaceId')
  ?? readString((args as { data?: unknown } | null)?.data, 'workspaceId')
  ?? readString((args as { create?: unknown } | null)?.create, 'workspaceId')
  ?? readString((args as { where?: unknown } | null)?.where, 'workspaceId')
  ?? (model === 'Workspace' ? resolveEntityId(args, result) : null)
  ?? requestContext.getWorkspaceId();

export const resolveEntityId = (args: unknown, result: unknown): string | null =>
  readString(result, 'id') ?? readString((args as { where?: unknown } | null)?.where, 'id');

export const isBulkOperation = (operation: string) => BULK_OPERATIONS.has(operation);

export const resolveAffectedCount = (operation: string, result: unknown): number => {
  if (!isBulkOperation(operation)) {
    return 1;
  }

  // `createManyAndReturn` e `updateManyAndReturn` restituiscono le righe scritte,
  // non un conteggio: lì il numero è la lunghezza dell'elenco.
  if (Array.isArray(result)) {
    return result.length;
  }

  const count = (result as { count?: unknown } | null)?.count;

  // Se il risultato non ha la forma attesa si ripiega su 1: meglio una riga di
  // registro con un conteggio impreciso che perdere del tutto la scrittura.
  return typeof count === 'number' ? count : 1;
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

  const workspaceId = resolveWorkspaceId(args, result, model);
  if (!workspaceId) {
    // Senza workspace la riga non è scrivibile (è una colonna obbligatoria con
    // vincolo di chiave esterna) e soprattutto non sarebbe leggibile da nessuno:
    // il Registro attività si consulta sempre dentro un workspace.
    return null;
  }

  const affectedCount = resolveAffectedCount(operation, result);
  if (isBulkOperation(operation) && affectedCount === 0) {
    // Una scrittura in blocco che non ha toccato nessuna riga NON è un
    // cambiamento. Registrarla comunque farebbe dire al registro una cosa falsa:
    // in tabella comparirebbe `workspace_message.update`, indistinguibile da un
    // aggiornamento vero (il conteggio non arriva nemmeno a chi legge, perché
    // audit-flush lo mette nei metadati solo se maggiore di 1). È il caso che
    // scatta a ogni giro di polling dei Messaggi su una conversazione già letta.
    return null;
  }

  const verb = OPERATION_VERB[operation];
  const entityType = normalizeEntityType(model);
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
      affectedCount,
      bulk: isBulkOperation(operation),
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
