import type { FastifyRequest } from 'fastify';
import type { passwordResetRepository } from './password-reset.repository.js';

// La pulizia della tabella `PasswordResetToken`, che fino al 9/9/2026 non
// esisteva: nessuno cancellava mai ne' i token usati ne' quelli scaduti, quindi
// la tabella cresceva e non calava mai (CRMA-59).
//
// Sta in un file suo e non dentro `password-reset.service.ts` per due motivi:
// e' una concern diversa — manutenzione della tabella, non recupero password —
// e il servizio era gia' a 467 righe, cioe' a un passo dalle 500 oltre le quali
// CLAUDE.md vuole che un file si spezzi.
//
// ⚠️ NON e' un lavoro periodico, ed e' una scelta: nel CRM non esiste nessuno
// schedulatore, e montarne uno per una tabella sola sarebbe piu' pezzo da
// mantenere che problema risolto. La cancellazione e' quindi opportunistica,
// appesa alla sola rotta che quella tabella la fa crescere. Il giorno in cui il
// progetto avesse davvero uno schedulatore, questa funzione e' gia' pronta per
// essergli attaccata cosi' com'e'.

/**
 * Da quanto dev'essere scaduta una riga perche' la si possa buttare via.
 *
 * ⚠️ DEVE restare ben oltre `RESET_IP_DB_WINDOW_MS` (un'ora), e il motivo e' che
 * le due cose lavorano sulla stessa tabella con intenzioni opposte: il tetto per
 * indirizzo IP CONTA le righe recenti, la purga le CANCELLA. Una purga troppo
 * aggressiva azzererebbe il contatore proprio a chi sta abusando della rotta
 * pubblica, cioe' la manutenzione smonterebbe la difesa. Ventiquattro ore contro
 * un'ora e' un margine che non si consuma per sbaglio, e c'e' una prova che lo
 * controlla (`password-reset.service.test.ts`).
 *
 * Il margine vero e' anche piu' largo: la purga taglia su `expiresAt`, che e'
 * sempre posteriore al `createdAt` su cui conta il tetto — vedi `purgeExpired`
 * in `password-reset.repository.ts`, dove sta la dimostrazione per esteso.
 */
export const RESET_PURGE_RETENTION_MS = 24 * 60 * 60 * 1000;

/**
 * Butta via le righe scadute da un pezzo. Non alza mai un errore.
 *
 * ⚠️ Il `catch` non e' una svista ed e' la parte che conta: questa e'
 * manutenzione della tabella, non il lavoro che l'utente ha chiesto. Se il
 * database avesse un intoppo proprio sulla cancellazione, far fallire la
 * richiesta vorrebbe dire chiudere fuori dal CRM chi ha perso la password per
 * colpa di una pulizia. La riga di log resta, cosi' non e' un fallimento
 * silenzioso.
 *
 * Il repository arriva come parametro invece di essere importato qui: il
 * servizio inietta gia' tutte le sue dipendenze, e prendere la scorciatoia
 * dell'import diretto renderebbe questa funzione l'unico pezzo del giro che nei
 * test pretende un database vero.
 */
export const purgeStaleResetTokens = async (input: {
  repository: Pick<typeof passwordResetRepository, 'purgeExpired'>;
  now: Date;
  request?: FastifyRequest;
}) => {
  try {
    await input.repository.purgeExpired({
      expiredBefore: new Date(input.now.getTime() - RESET_PURGE_RETENTION_MS),
    });
  } catch (error) {
    input.request?.log?.warn(
      { err: error },
      'Purga dei token di recupero password non riuscita: la richiesta prosegue',
    );
  }
};
