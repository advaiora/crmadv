import { describe, expect, it } from 'vitest';
import { buildWebMissingInputs } from './buildWebMissingInputs';

// Input completo di riferimento: da qui si toglie un campo alla volta per
// verificare che l'etichetta corrispondente compaia fra i mancanti.
const inputCompleto = () => ({
  discovery: {
    sections: {
      target: 'PMI del settore edile',
      offer: 'Consulenza marketing a canone',
      brandCommunication: 'Unico studio con garanzia sui lead',
      availableMaterials: 'Case study 2025, foto cantieri',
    },
  },
});

const outputCompleto = () => ({ ctaSet: { primary: 'Prenota call' } });

const fontiPronte = { status: 'ready' };

describe('buildWebMissingInputs', () => {
  it('non segnala niente quando ci sono tutti i dati e le fonti sono pronte', () => {
    expect(buildWebMissingInputs(inputCompleto(), outputCompleto(), fontiPronte)).toEqual([]);
  });

  it.each([
    ['target', 'target'],
    ['offer', 'offerta'],
    ['brandCommunication', 'differenzianti/USP'],
    ['availableMaterials', 'prove o materiali'],
  ])('segnala %s mancante come "%s"', (campo, etichetta) => {
    const input = inputCompleto();
    input.discovery.sections[campo] = '';

    const mancanti = buildWebMissingInputs(input, outputCompleto(), fontiPronte);

    expect(mancanti).toEqual([etichetta]);
  });

  it('segnala la CTA primaria quando manca', () => {
    const output = { ctaSet: { primary: '' } };

    expect(buildWebMissingInputs(inputCompleto(), output, fontiPronte)).toEqual(['CTA primaria']);
  });

  it('segnala le fonti quando la prontezza non e\' "ready"', () => {
    expect(buildWebMissingInputs(inputCompleto(), outputCompleto(), { status: 'partial' }))
      .toEqual(['fonti progetto complete']);
    expect(buildWebMissingInputs(inputCompleto(), outputCompleto(), undefined))
      .toEqual(['fonti progetto complete']);
  });

  it('tratta "n/a" come valore assente (regola di readableValue)', () => {
    const input = inputCompleto();
    input.discovery.sections.target = 'N/A';

    expect(buildWebMissingInputs(input, outputCompleto(), fontiPronte)).toEqual(['target']);
  });

  it('regge input e output vuoti senza esplodere, elencando tutto', () => {
    expect(buildWebMissingInputs(undefined, undefined, undefined)).toEqual([
      'target',
      'offerta',
      'CTA primaria',
      'differenzianti/USP',
      'prove o materiali',
      'fonti progetto complete',
    ]);
  });

  it('mantiene l\'ordine di presentazione dei mancanti', () => {
    const input = inputCompleto();
    input.discovery.sections.target = '';
    input.discovery.sections.availableMaterials = '';

    const mancanti = buildWebMissingInputs(input, { ctaSet: { primary: '' } }, fontiPronte);

    expect(mancanti).toEqual(['target', 'CTA primaria', 'prove o materiali']);
  });
});
