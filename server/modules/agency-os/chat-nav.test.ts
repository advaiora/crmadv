import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CHAT_NAV_AREAS,
  resolveAccessibleNavAreas,
  buildNavPromptSection,
  parseNavSuggestions,
} from './chat-nav.js';

// Navigazione suggerita (Fase 6). La generazione AI si collauda con le chiavi reali,
// ma il PARSING e il gating dei suggerimenti sono deterministici: si testano qui.

const areas = CHAT_NAV_AREAS;

test('resolveAccessibleNavAreas tiene solo le aree con modulo acceso E permesso', () => {
  const accessible = resolveAccessibleNavAreas(['clients'], ['clients.view']);
  const keys = accessible.map((a) => a.key);
  assert.ok(keys.includes('clienti'));
  // Progetti richiede projects.view: senza permesso, fuori.
  assert.ok(!keys.includes('progetti-agency'));
  // Preventivi richiede il modulo quotes, non acceso: fuori.
  assert.ok(!keys.includes('preventivi'));
});

test('resolveAccessibleNavAreas: modulo acceso ma permesso mancante = area esclusa', () => {
  const accessible = resolveAccessibleNavAreas(['projects'], []);
  assert.equal(accessible.length, 0);
});

test('buildNavPromptSection e vuota senza aree, elenca le chiavi con le aree', () => {
  assert.equal(buildNavPromptSection([]), '');
  const section = buildNavPromptSection(resolveAccessibleNavAreas(['clients'], ['clients.view']));
  assert.ok(section.includes('[[vai:CHIAVE]]'));
  assert.ok(section.includes('clienti:'));
  assert.ok(section.includes('NAVIGAZIONE SUGGERITA'));
});

test('parseNavSuggestions estrae i token noti e li toglie dal testo', () => {
  const raw = 'Ecco la mia analisi del progetto.\n\n[[vai:clienti]]';
  const { text, suggestions } = parseNavSuggestions(raw, areas);
  assert.equal(suggestions.length, 1);
  assert.equal(suggestions[0].key, 'clienti');
  assert.equal(suggestions[0].route, '/apps/clients');
  assert.ok(!text.includes('[[vai'));
  assert.equal(text, 'Ecco la mia analisi del progetto.');
});

test('parseNavSuggestions ignora le chiavi sconosciute o non accessibili', () => {
  const raw = 'Testo.\n[[vai:inesistente]]\n[[vai:clienti]]';
  const onlyClients = parseNavSuggestions(raw, resolveAccessibleNavAreas(['clients'], ['clients.view']));
  assert.deepEqual(
    onlyClients.suggestions.map((s) => s.key),
    ['clienti'],
  );
});

test('parseNavSuggestions deduplica e tollera spazi/maiuscole', () => {
  const raw = 'X [[ VAI : clienti ]] Y [[vai:clienti]]';
  const { suggestions } = parseNavSuggestions(raw, areas);
  assert.equal(suggestions.length, 1);
});

test('parseNavSuggestions tiene al massimo 3 suggerimenti', () => {
  const raw = '[[vai:dashboard]][[vai:clienti]][[vai:preventivi]][[vai:calendario]][[vai:messaggi]]';
  const { suggestions } = parseNavSuggestions(raw, areas);
  assert.equal(suggestions.length, 3);
});

test('parseNavSuggestions: nessun token = testo intatto, zero suggerimenti', () => {
  const raw = 'Una risposta normale, senza navigazione.';
  const { text, suggestions } = parseNavSuggestions(raw, areas);
  assert.equal(suggestions.length, 0);
  assert.equal(text, raw);
});
