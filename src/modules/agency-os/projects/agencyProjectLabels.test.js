import { describe, expect, it } from 'vitest';

import { toPriorityLabel, toStatusLabel, toWorkStatusLabel } from './agencyProjectLabels';

describe('toStatusLabel', () => {
  it('traduce i sette stati previsti', () => {
    expect(toStatusLabel('discovery')).toBe('Discovery');
    expect(toStatusLabel('planning')).toBe('Planning');
    expect(toStatusLabel('production')).toBe('Production');
    expect(toStatusLabel('review')).toBe('Review');
    expect(toStatusLabel('live')).toBe('Live');
    expect(toStatusLabel('paused')).toBe('Paused');
    expect(toStatusLabel('archived')).toBe('Archived');
  });

  it('accetta il valore come arriva dal database, maiuscolo o con spazi', () => {
    expect(toStatusLabel('DISCOVERY')).toBe('Discovery');
    expect(toStatusLabel('  Review  ')).toBe('Review');
  });

  it('uno stato sconosciuto si mostra com\'e\', non sparisce', () => {
    expect(toStatusLabel('handover')).toBe('handover');
  });

  it('senza valore dice "n/a" invece di lasciare il posto vuoto', () => {
    expect(toStatusLabel('')).toBe('n/a');
    expect(toStatusLabel(null)).toBe('n/a');
    expect(toStatusLabel(undefined)).toBe('n/a');
    expect(toStatusLabel(42)).toBe('n/a');
  });
});

describe('toPriorityLabel', () => {
  it('traduce le quattro priorita in italiano', () => {
    expect(toPriorityLabel('low')).toBe('Bassa');
    expect(toPriorityLabel('medium')).toBe('Media');
    expect(toPriorityLabel('high')).toBe('Alta');
    expect(toPriorityLabel('urgent')).toBe('Urgente');
  });

  it('accetta il valore come arriva dal database', () => {
    expect(toPriorityLabel('HIGH')).toBe('Alta');
    expect(toPriorityLabel(' Urgent ')).toBe('Urgente');
  });

  it('una priorita sconosciuta si mostra com\'e\'', () => {
    expect(toPriorityLabel('blocker')).toBe('blocker');
  });

  it('senza valore dice "n/a"', () => {
    expect(toPriorityLabel('')).toBe('n/a');
    expect(toPriorityLabel(null)).toBe('n/a');
  });
});

describe('toWorkStatusLabel', () => {
  it('traduce i quattro stati di lavorazione di pagine e campagne', () => {
    expect(toWorkStatusLabel('draft')).toBe('Bozza');
    expect(toWorkStatusLabel('in_progress')).toBe('In corso');
    expect(toWorkStatusLabel('review')).toBe('In revisione');
    expect(toWorkStatusLabel('approved')).toBe('Approvato');
  });

  it('uno stato sconosciuto si mostra com\'e\', cosi la tendina non si svuota', () => {
    expect(toWorkStatusLabel('published')).toBe('published');
  });

  it('senza valore dice "n/a"', () => {
    expect(toWorkStatusLabel('')).toBe('n/a');
    expect(toWorkStatusLabel(null)).toBe('n/a');
  });
});
