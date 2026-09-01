import assert from 'node:assert/strict';
import test from 'node:test';
import { CAMPI_LETTI, type ImpostazioniMailRecord } from './mail.repository.js';

/**
 * Una riga completa. Il tipo la costringe a nominare TUTTI i campi del record:
 * chi ne aggiunge uno allo schema e' obbligato a toccare anche questa, ed e'
 * quello che rende il test qui sotto una rete e non una ripetizione.
 */
const RIGA_COMPLETA: ImpostazioniMailRecord = {
  workspaceId: 'ws-1',
  attivo: true,
  server: 'mail.esempio.it',
  porta: 587,
  connessioneSicura: false,
  retePrivataConsentita: false,
  utente: 'noreply@esempio.it',
  mittente: 'Studio <noreply@esempio.it>',
  ciphertext: 'cifrata',
  iv: 'iv',
  authTag: 'tag',
  keyVersion: 1,
  updatedAt: new Date('2026-08-18T10:00:00.000Z'),
};

// Le due query del repository chiedono al database un elenco ESPLICITO di
// colonne. Un campo che sta nel tipo ma non nell'elenco non arriva mai: si
// salva e non si rilegge, senza nessun errore e senza nessun test rosso — a
// meno di questo. E' il buco in cui `retePrivataConsentita` sarebbe potuto
// cadere il 1/9/2026, quando e' diventato il primo campo di questa tabella a
// dover attraversare colonna, salvataggio e rilettura tutti insieme.
test('ogni campo del record e\' chiesto al database', () => {
  for (const campo of Object.keys(RIGA_COMPLETA)) {
    assert.equal(
      (CAMPI_LETTI as Record<string, true>)[campo],
      true,
      `il campo "${campo}" non e' nell'elenco delle colonne lette`,
    );
  }
});

test('l\'elenco delle colonne lette non chiede niente che il record non abbia', () => {
  for (const campo of Object.keys(CAMPI_LETTI)) {
    assert.ok(campo in RIGA_COMPLETA, `"${campo}" e' chiesto al database ma non sta nel record`);
  }
});
