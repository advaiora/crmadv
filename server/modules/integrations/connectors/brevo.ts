// Connettore Brevo (ex Sendinblue). Documentazione API: https://developers.brevo.com
// Copre le due operazioni che servono al layer integrazioni V3:
//  - testConnection: verifica che la chiave API sia valida (GET /account).
//  - upsertContact: crea/aggiorna un contatto per email (POST /contacts).
// Il client HTTP usa la fetch globale (Node 18+); nessuna dipendenza esterna.

const BREVO_API_BASE = 'https://api.brevo.com/v3';
const REQUEST_TIMEOUT_MS = 15000;

export type BrevoAccountSummary = {
  email: string | null;
  companyName: string | null;
};

export type BrevoContactInput = {
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  listIds?: number[];
};

// Errore "di trasporto/API" del connettore: porta con sé un messaggio leggibile
// e l'eventuale codice HTTP, così il servizio può riportarlo per riga/contatto.
export class BrevoApiError extends Error {
  status: number | null;

  constructor(message: string, status: number | null = null) {
    super(message);
    this.name = 'BrevoApiError';
    this.status = status;
  }
}

const buildHeaders = (apiKey: string): Record<string, string> => ({
  accept: 'application/json',
  'content-type': 'application/json',
  'api-key': apiKey,
});

// Estrae un messaggio d'errore leggibile dal corpo di risposta di Brevo.
const extractErrorMessage = (status: number, body: unknown): string => {
  if (body && typeof body === 'object') {
    const record = body as Record<string, unknown>;
    if (typeof record.message === 'string' && record.message.trim()) {
      return record.message.trim();
    }
    if (typeof record.code === 'string' && record.code.trim()) {
      return record.code.trim();
    }
  }
  return `Brevo ha risposto con stato ${status}`;
};

const requestBrevo = async (
  apiKey: string,
  path: string,
  init: { method: string; body?: unknown },
): Promise<{ status: number; json: unknown }> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${BREVO_API_BASE}${path}`, {
      method: init.method,
      headers: buildHeaders(apiKey),
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: controller.signal,
    });
  } catch (error) {
    const reason = error instanceof Error && error.name === 'AbortError'
      ? 'Timeout nella richiesta a Brevo'
      : 'Impossibile contattare Brevo';
    throw new BrevoApiError(reason, null);
  } finally {
    clearTimeout(timeout);
  }

  // 204 No Content (es. aggiornamento contatto) non ha corpo.
  let json: unknown = null;
  if (response.status !== 204) {
    try {
      json = await response.json();
    } catch {
      json = null;
    }
  }

  return { status: response.status, json };
};

export const brevoConnector = {
  // Verifica la chiave API leggendo i dati account. Non lancia: ritorna esito.
  async testConnection(apiKey: string): Promise<
    { ok: true; account: BrevoAccountSummary } | { ok: false; message: string }
  > {
    try {
      const { status, json } = await requestBrevo(apiKey, '/account', { method: 'GET' });
      if (status === 200 && json && typeof json === 'object') {
        const record = json as Record<string, unknown>;
        return {
          ok: true,
          account: {
            email: typeof record.email === 'string' ? record.email : null,
            companyName:
              typeof record.companyName === 'string' ? record.companyName : null,
          },
        };
      }
      if (status === 401) {
        return { ok: false, message: 'Chiave API Brevo non valida o non autorizzata' };
      }
      return { ok: false, message: extractErrorMessage(status, json) };
    } catch (error) {
      return {
        ok: false,
        message: error instanceof BrevoApiError ? error.message : 'Errore di connessione a Brevo',
      };
    }
  },

  // Crea o aggiorna (per email) un contatto. Lancia BrevoApiError in caso di
  // fallimento, con un messaggio adatto a essere mostrato per contatto.
  async upsertContact(apiKey: string, contact: BrevoContactInput): Promise<void> {
    const attributes: Record<string, string> = {};
    if (contact.firstName) attributes.FIRSTNAME = contact.firstName;
    if (contact.lastName) attributes.LASTNAME = contact.lastName;
    if (contact.phone) attributes.SMS = contact.phone;

    const body: Record<string, unknown> = {
      email: contact.email,
      updateEnabled: true,
    };
    if (Object.keys(attributes).length > 0) {
      body.attributes = attributes;
    }
    if (contact.listIds && contact.listIds.length > 0) {
      body.listIds = contact.listIds;
    }

    const { status, json } = await requestBrevo(apiKey, '/contacts', {
      method: 'POST',
      body,
    });

    // 201 = creato, 204 = aggiornato: entrambi successo.
    if (status === 201 || status === 204) {
      return;
    }
    throw new BrevoApiError(extractErrorMessage(status, json), status);
  },
};
