import { apiDelete, apiGet, apiPost, apiPut } from '../../../utils/apiClient';

export const leggiImpostazioniMail = () => apiGet('/mail');

export const salvaImpostazioniMail = (impostazioni) => apiPut('/mail', impostazioni);

/** Apre la connessione al server e si autentica. Non spedisce niente a nessuno. */
export const provaServerMail = () => apiPost('/mail/test');

export const eliminaImpostazioniMail = () => apiDelete('/mail');
