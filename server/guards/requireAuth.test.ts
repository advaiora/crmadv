import assert from 'node:assert/strict';
import test from 'node:test';
import { isTokenOlderThanPassword } from './requireAuth.js';

// La revoca delle sessioni sta tutta in questo confronto. E' l'unica cosa che
// rende vera la risposta `otherSessionsRevoked: true` della rotta di cambio
// password: se smettesse di funzionare, il CRM continuerebbe a dichiarare
// all'utente di aver chiuso le altre sessioni senza averlo fatto, e nessun altro
// test se ne accorgerebbe.

/** L'`iat` di un JWT: secondi interi, arrotondati per difetto. */
const iatDi = (data: Date) => Math.floor(data.getTime() / 1000);

const CAMBIO = new Date('2026-09-09T10:00:00.000Z');

test('chi non ha mai cambiato la password non viene mai rifiutato', () => {
  assert.equal(isTokenOlderThanPassword(iatDi(new Date('2020-01-01')), null), false);
  assert.equal(isTokenOlderThanPassword(undefined, null), false);
});

test('un token emesso prima del cambio password viene rifiutato', () => {
  const unGiornoPrima = new Date(CAMBIO.getTime() - 24 * 60 * 60 * 1000);

  assert.equal(isTokenOlderThanPassword(iatDi(unGiornoPrima), CAMBIO), true);
});

test('un token emesso dopo il cambio password resta valido', () => {
  const unMinutoDopo = new Date(CAMBIO.getTime() + 60_000);

  assert.equal(isTokenOlderThanPassword(iatDi(unMinutoDopo), CAMBIO), false);
});

// ⚠️ Il caso che ha deciso la forma del confronto. `passwordChangedAt` ha i
// millisecondi, l'`iat` no: il token consegnato a chi ha appena cambiato la
// password ha un `iat` arrotondato per difetto, quindi confrontando i
// millisecondi risulterebbe piu' vecchio della password di una frazione di
// secondo — e chi cambia la password verrebbe sloggiato dalla propria stessa
// richiesta. Ecco perche' si confronta al secondo.
test('il token consegnato nello stesso istante del cambio NON viene rifiutato', () => {
  const cambioConMillisecondi = new Date('2026-09-09T10:00:00.750Z');
  const tokenEmessoSubitoDopo = iatDi(new Date('2026-09-09T10:00:00.800Z'));

  assert.equal(tokenEmessoSubitoDopo, iatDi(cambioConMillisecondi));
  assert.equal(isTokenOlderThanPassword(tokenEmessoSubitoDopo, cambioConMillisecondi), false);
});

// L'altra faccia della stessa medaglia, dichiarata perche' non si scopra per
// caso: nello stesso secondo del cambio, un token di un'altra sessione
// sopravvive. E' il prezzo del confronto al secondo, ed e' un secondo.
test('nello stesso secondo del cambio, un token altrui sopravvive: e il prezzo noto', () => {
  const cambio = new Date('2026-09-09T10:00:00.900Z');
  const tokenDellAltraSessione = iatDi(new Date('2026-09-09T10:00:00.100Z'));

  assert.equal(isTokenOlderThanPassword(tokenDellAltraSessione, cambio), false);
});

test('un token che non dice quando e nato viene rifiutato, se la password e cambiata', () => {
  assert.equal(isTokenOlderThanPassword(undefined, CAMBIO), true);
});
