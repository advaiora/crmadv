import { describe, expect, it } from 'vitest';

import {
  filterAgencyOpportunities,
  formatOpportunityLabel,
  getOpportunityBadgeClass,
  groupAgencyOpportunities,
  sortAgencyOpportunities,
} from './opportunityPresentation';

// Il difetto (CRMA-76): formatOpportunityLabel era solo ri-esportato, non
// importato nello scope locale del modulo. Con un tipo vero (non "other")
// groupAgencyOpportunities andava in ReferenceError durante il render.
describe('groupAgencyOpportunities', () => {
  it('raggruppa per tipo con l\'etichetta in italiano, senza andare in eccezione', () => {
    const items = [
      { title: 'Rifare il sito', type: 'critical', category: 'design' },
      { title: 'Upsell manutenzione', type: 'commercial', category: 'vendite' },
    ];

    const groups = groupAgencyOpportunities(items, 'type');

    const critical = groups.find((group) => group.key === 'critical');
    expect(critical.label).toBe('Critica');
    expect(critical.items).toHaveLength(1);

    const commercial = groups.find((group) => group.key === 'commercial');
    expect(commercial.label).toBe('Commerciale');
  });

  it('raggruppa per categoria quando richiesto', () => {
    const items = [{ title: 'Rifare il sito', type: 'critical', category: 'design' }];

    const groups = groupAgencyOpportunities(items, 'category');

    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe('design');
  });

  it('le opportunita senza tipo finiscono nel gruppo di ripiego "Altre Opportunita"', () => {
    const groups = groupAgencyOpportunities([{ title: 'Senza tipo' }], 'type');

    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe('other');
    expect(groups[0].label).toBe('Altre Opportunita');
  });

  it('con un elenco non valido torna un array vuoto', () => {
    expect(groupAgencyOpportunities(null)).toEqual([]);
  });
});

describe('formatOpportunityLabel', () => {
  it('e\' la stessa funzione del vocabolario condiviso, disponibile anche a chi importa da qui', () => {
    expect(formatOpportunityLabel('critical')).toBe('Critica');
  });
});

describe('sortAgencyOpportunities', () => {
  it('ordina per punteggio decrescente', () => {
    const items = [{ title: 'Bassa', score: 1 }, { title: 'Alta', score: 9 }];

    const sorted = sortAgencyOpportunities(items);

    expect(sorted.map((entry) => entry.title)).toEqual(['Alta', 'Bassa']);
  });
});

describe('filterAgencyOpportunities', () => {
  it('filtra per tipo', () => {
    const items = [
      { title: 'A', type: 'critical' },
      { title: 'B', type: 'commercial' },
    ];

    const filtered = filterAgencyOpportunities(items, { type: 'critical' });

    expect(filtered.map((entry) => entry.title)).toEqual(['A']);
  });
});

describe('getOpportunityBadgeClass', () => {
  it('riconosce le priorita urgenti', () => {
    expect(getOpportunityBadgeClass('priority', 'urgent')).toBe('text-bg-danger');
  });
});
