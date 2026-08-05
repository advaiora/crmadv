import { describe, expect, it } from 'vitest';
import { ApiError } from '../../../modules/projects/api/projects.api';
import {
  computeReorderedItemIds,
  filterVisibleTemplates,
  findDuplicateTemplateByName,
  getErrorMessage,
  normalizeTemplateName,
  sumTemplateItems,
} from './templatesPureFunctions';

describe('getErrorMessage', () => {
  it('su un errore del server mostra messaggio e codice', () => {
    const errore = new ApiError('Nome gia usato', { status: 409, code: 'DUPLICATE_NAME' });

    expect(getErrorMessage(errore)).toBe('Nome gia usato (DUPLICATE_NAME)');
  });

  it('senza codice ripiega sullo stato, e senza stato su una sigla generica', () => {
    expect(getErrorMessage(new ApiError('Non trovato', { status: 404 }))).toBe('Non trovato (404)');
    expect(getErrorMessage(new ApiError('Boh'))).toBe('Boh (API_ERROR)');
  });

  it('su un errore qualsiasi mostra il suo messaggio senza codice', () => {
    expect(getErrorMessage(new Error('Rete non raggiungibile'))).toBe('Rete non raggiungibile');
  });

  it('senza errore, o con un errore muto, dice qualcosa di sensato', () => {
    expect(getErrorMessage(null)).toBe('Errore inatteso');
    expect(getErrorMessage(undefined)).toBe('Errore inatteso');
    expect(getErrorMessage({})).toBe('Errore inatteso');
  });
});

describe('normalizeTemplateName', () => {
  it('toglie spazi ai bordi e ignora le maiuscole', () => {
    expect(normalizeTemplateName('  Onboarding Cliente ')).toBe('onboarding cliente');
  });

  it('su valori vuoti torna stringa vuota invece di esplodere', () => {
    expect(normalizeTemplateName(null)).toBe('');
    expect(normalizeTemplateName(undefined)).toBe('');
  });
});

describe('findDuplicateTemplateByName', () => {
  const memo = [
    { id: 't1', name: 'Onboarding', isArchived: false },
    { id: 't2', name: 'Chiusura progetto', isArchived: true },
  ];

  it('trova il duplicato anche se cambia solo il maiuscolo o lo spazio', () => {
    expect(findDuplicateTemplateByName(memo, '  onboarding ')?.id).toBe('t1');
  });

  it('trova anche i memo archiviati', () => {
    expect(findDuplicateTemplateByName(memo, 'CHIUSURA PROGETTO')?.id).toBe('t2');
  });

  it('senza duplicati non torna niente', () => {
    expect(findDuplicateTemplateByName(memo, 'Nome nuovo')).toBeUndefined();
  });

  // In modifica il memo che si sta rinominando non deve risultare duplicato di
  // se stesso, altrimenti non si potrebbe piu' salvare senza cambiare nome.
  it('escludendo un id, quel memo non conta come duplicato', () => {
    expect(findDuplicateTemplateByName(memo, 'Onboarding', { excludeId: 't1' })).toBeUndefined();
    expect(findDuplicateTemplateByName(memo, 'Onboarding', { excludeId: 't2' })?.id).toBe('t1');
  });

  it('un nome vuoto non e duplicato di niente', () => {
    expect(findDuplicateTemplateByName(memo, '   ')).toBeUndefined();
  });

  it('senza elenco non esplode', () => {
    expect(findDuplicateTemplateByName(undefined, 'Onboarding')).toBeUndefined();
  });
});

describe('filterVisibleTemplates', () => {
  const memo = [
    { id: 't1', name: 'Onboarding', description: 'Primi passi col cliente', isArchived: false },
    { id: 't2', name: 'Chiusura', description: 'Consegna finale', isArchived: true },
    { id: 't3', name: 'Lancio campagna', description: null, isArchived: false },
  ];

  it('senza filtri nasconde gli archiviati', () => {
    expect(filterVisibleTemplates(memo).map((t) => t.id)).toEqual(['t1', 't3']);
  });

  it('con gli archiviati accesi li mostra tutti', () => {
    expect(filterVisibleTemplates(memo, { showArchived: true })).toHaveLength(3);
  });

  it('la ricerca guarda anche la descrizione, non solo il nome', () => {
    expect(filterVisibleTemplates(memo, { search: 'primi passi' }).map((t) => t.id)).toEqual(['t1']);
  });

  it('la ricerca ignora maiuscole e spazi ai bordi', () => {
    expect(filterVisibleTemplates(memo, { search: '  LANCIO ' }).map((t) => t.id)).toEqual(['t3']);
  });

  // I due filtri si applicano insieme: cercare un archiviato senza aver acceso
  // il filtro non lo fa comparire.
  it('ricerca e archiviati si combinano', () => {
    expect(filterVisibleTemplates(memo, { search: 'chiusura' })).toHaveLength(0);
    expect(filterVisibleTemplates(memo, { search: 'chiusura', showArchived: true }).map((t) => t.id)).toEqual(['t2']);
  });

  it('una descrizione mancante non rompe la ricerca', () => {
    expect(filterVisibleTemplates(memo, { search: 'campagna' }).map((t) => t.id)).toEqual(['t3']);
  });
});

describe('sumTemplateItems', () => {
  it('somma il numero di step dei memo', () => {
    expect(sumTemplateItems([{ itemsCount: 3 }, { itemsCount: 5 }])).toBe(8);
  });

  it('un memo senza conteggio vale zero, non NaN', () => {
    expect(sumTemplateItems([{ itemsCount: 2 }, {}, { itemsCount: null }])).toBe(2);
  });

  it('senza memo torna zero', () => {
    expect(sumTemplateItems([])).toBe(0);
    expect(sumTemplateItems(undefined)).toBe(0);
  });
});

describe('computeReorderedItemIds', () => {
  const step = [{ id: 'i1' }, { id: 'i2' }, { id: 'i3' }];

  it('sposta uno step in giu e torna l elenco completo nel nuovo ordine', () => {
    expect(computeReorderedItemIds(step, 'i1', 1)).toEqual(['i2', 'i1', 'i3']);
  });

  it('sposta uno step in su', () => {
    expect(computeReorderedItemIds(step, 'i3', -1)).toEqual(['i1', 'i3', 'i2']);
  });

  // Ai bordi non si chiama il server: il primo non puo' salire, l'ultimo non
  // puo' scendere.
  it('ai bordi non fa niente', () => {
    expect(computeReorderedItemIds(step, 'i1', -1)).toBeNull();
    expect(computeReorderedItemIds(step, 'i3', 1)).toBeNull();
  });

  it('su uno step sconosciuto non fa niente', () => {
    expect(computeReorderedItemIds(step, 'mai-visto', 1)).toBeNull();
  });

  it('non modifica l elenco di partenza', () => {
    const originale = [{ id: 'i1' }, { id: 'i2' }];
    computeReorderedItemIds(originale, 'i1', 1);

    expect(originale.map((i) => i.id)).toEqual(['i1', 'i2']);
  });

  it('senza step non esplode', () => {
    expect(computeReorderedItemIds(undefined, 'i1', 1)).toBeNull();
  });
});
