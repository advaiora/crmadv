import { apiFetch } from '../../../lib/apiFetch';
import { ApiRequestError, apiDelete, apiGet, apiPatch, apiPost } from '../../../utils/apiClient';
import { getDevAuthHeaders } from '../../../utils/devAuthSession';

const getHeaders = () => {
    const headers = getDevAuthHeaders();
    if (Object.keys(headers).length === 0) {
        throw new Error('Sessione non disponibile. Effettua il login.');
    }

    return headers;
};

const withQuery = (path, params) => {
    const query = new URLSearchParams();

    Object.entries(params || {}).forEach(([key, value]) => {
        if (value === undefined || value === null || value === '') {
            return;
        }

        query.set(key, String(value));
    });

    const queryString = query.toString();
    return queryString ? `${path}?${queryString}` : path;
};

const parseExportFilename = (contentDisposition) => {
    if (typeof contentDisposition !== 'string') {
        return 'clients-export.csv';
    }

    const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
    if (utf8Match?.[1]) {
        return decodeURIComponent(utf8Match[1]);
    }

    const asciiMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
    if (asciiMatch?.[1]) {
        return asciiMatch[1];
    }

    return 'clients-export.csv';
};

const buildApiErrorFromResponse = async (response) => {
    const fallbackMessage = `Request failed with status ${response.status}`;
    const responseText = await response.text();

    if (!responseText) {
        return new ApiRequestError(fallbackMessage, { status: response.status });
    }

    try {
        const payload = JSON.parse(responseText);
        return new ApiRequestError(payload?.error?.message || fallbackMessage, {
            status: response.status,
            code: payload?.error?.code,
            details: payload?.error?.details,
        });
    } catch (_error) {
        return new ApiRequestError(responseText, {
            status: response.status,
            code: 'NON_JSON_ERROR_RESPONSE',
        });
    }
};

export const listClients = (params) =>
    apiGet(withQuery('/clients', params), {
        headers: getHeaders(),
    });

export const getClient = (clientId) =>
    apiGet(`/clients/${clientId}`, {
        headers: getHeaders(),
    });

export const createClient = (payload) =>
    apiPost('/clients', payload, {
        headers: getHeaders(),
    });

export const updateClient = (clientId, payload) =>
    apiPatch(`/clients/${clientId}`, payload, {
        headers: getHeaders(),
    });

export const deleteClient = (clientId) =>
    apiDelete(`/clients/${clientId}`, {
        headers: getHeaders(),
    });

// Import clienti: il file viaggia come allegato (multipart), non piu' dentro il
// corpo JSON. E' la strada che regge i file grossi — il tetto e' 20MB lato
// server, contro l'unico MB che reggeva il corpo — e l'unica che regge un
// `.xlsx`, che essendo binario non si puo' leggere come testo.
//
// ⚠️ `dryRun` e' l'interruttore fra i due passi: `true` chiede l'anteprima e non
// salva niente, `false` salva. Viaggia come campo del modulo, quindi come
// stringa: il backend riconosce 'true' e '1' (readBooleanField in
// import-file.ts), e qualunque altra cosa — compreso un campo assente — vale
// `false`. Sta prima del file per rispecchiare l'ordine gia' provato dal
// backend, dove il campo precede l'allegato.
export const importClients = (file, { dryRun = false } = {}) => {
    const formData = new FormData();
    formData.append('dryRun', dryRun ? 'true' : 'false');
    formData.append('file', file);

    // Nessun Content-Type a mano: con un body FormData l'apiClient non lo
    // imposta, e ci pensa il browser ad aggiungerlo col boundary giusto.
    return apiPost('/clients/import', formData, {
        headers: getHeaders(),
    });
};

export const exportClients = async (params) => {
    const response = await apiFetch(withQuery('/clients/export', params), {
        method: 'GET',
        headers: {
            ...getHeaders(),
            Accept: 'text/csv',
        },
    });

    if (!response.ok) {
        throw await buildApiErrorFromResponse(response);
    }

    const blob = await response.blob();
    const filename = parseExportFilename(response.headers.get('content-disposition'));

    return {
        blob,
        filename,
    };
};
