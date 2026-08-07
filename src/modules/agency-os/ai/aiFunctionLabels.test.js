import { describe, expect, it } from 'vitest';

import { toAiFunctionLabel } from './aiFunctionLabels';

describe('toAiFunctionLabel', () => {
  it('traduce le cinque funzioni AI note nel lavoro che fanno', () => {
    expect(toAiFunctionLabel('discovery.generateBrief')).toBe('Brief completo');
    expect(toAiFunctionLabel('discovery.generateSection')).toBe('Sezione del Brief');
    expect(toAiFunctionLabel('web.generateProject')).toBe('Struttura sito/landing');
    expect(toAiFunctionLabel('web.generateBlock')).toBe('Blocco sito');
    expect(toAiFunctionLabel('ads.generateAsset')).toBe('Copy campagna ADV');
  });

  it('una funzione non ancora in elenco resta visibile com\'e\', non sparisce dal rendiconto', () => {
    expect(toAiFunctionLabel('seo.generateAudit')).toBe('seo.generateAudit');
  });

  it('senza valore dice "n/a" invece di lasciare la cella vuota', () => {
    expect(toAiFunctionLabel('')).toBe('n/a');
    expect(toAiFunctionLabel('   ')).toBe('n/a');
    expect(toAiFunctionLabel(null)).toBe('n/a');
    expect(toAiFunctionLabel(undefined)).toBe('n/a');
  });
});
