import { describe, expect, it } from 'vitest';

import { toImpactLabel, toReadableLabel } from './agencyStatusLabels';

// I valori provati qui sono quelli veri degli enum in prisma/schema.prisma:
// se un giorno l'enum cambia, questi test devono rompersi.
describe('toReadableLabel', () => {
  it('copre tutti gli stati possibili di un alert (ProjectAlertStatus)', () => {
    expect(toReadableLabel('open')).toBe('Da gestire');
    expect(toReadableLabel('monitoring')).toBe("Da tenere d'occhio");
    expect(toReadableLabel('resolved')).toBe('Risolto');
    expect(toReadableLabel('suggested')).toBe('Proposto');
  });

  it('copre tutti gli stati possibili di un\'opportunita (ProjectOpportunityStatus)', () => {
    expect(toReadableLabel('open')).toBe('Da gestire');
    expect(toReadableLabel('proposed')).toBe('Proposto');
    expect(toReadableLabel('won')).toBe('Vinta');
    expect(toReadableLabel('lost')).toBe('Persa');
    expect(toReadableLabel('suggested')).toBe('Proposto');
  });

  it('copre gravita e priorita (ProjectAlertSeverity, AgencyPriority)', () => {
    expect(toReadableLabel('low')).toBe('Bassa');
    expect(toReadableLabel('medium')).toBe('Media');
    expect(toReadableLabel('high')).toBe('Alta');
    expect(toReadableLabel('urgent')).toBe('Urgente');
    expect(toReadableLabel('critical')).toBe('Critica');
  });

  it('copre gli stati che il motore a regole scrive come stringa libera', () => {
    expect(toReadableLabel('todo')).toBe('Da fare');
    expect(toReadableLabel('in_progress')).toBe('In corso');
    expect(toReadableLabel('review')).toBe('In revisione');
    expect(toReadableLabel('needs_review')).toBe('Da rivedere');
    expect(toReadableLabel('done')).toBe('Completato');
    expect(toReadableLabel('blocked')).toBe('Bloccato');
    expect(toReadableLabel('on_hold')).toBe('In pausa');
  });

  it('copre gli stati di report, moduli e fonti', () => {
    expect(toReadableLabel('draft')).toBe('Bozza');
    expect(toReadableLabel('partial')).toBe('Parziale');
    expect(toReadableLabel('ready')).toBe('Pronto');
    expect(toReadableLabel('missing')).toBe('Assente');
    expect(toReadableLabel('active')).toBe('Attivo');
    expect(toReadableLabel('inactive')).toBe('Non attivo');
    expect(toReadableLabel('included')).toBe('Incluso');
  });

  it('accetta il valore come arriva dal database, maiuscolo o con spazi', () => {
    expect(toReadableLabel('OPEN')).toBe('Da gestire');
    expect(toReadableLabel('  Needs_Review  ')).toBe('Da rivedere');
  });

  it('un valore sconosciuto si mostra col vecchio ripiego, non sparisce', () => {
    expect(toReadableLabel('handover')).toBe('Handover');
    expect(toReadableLabel('waiting_for_client')).toBe('Waiting For Client');
  });

  it('senza valore usa il ripiego, personalizzabile da chi chiama', () => {
    expect(toReadableLabel('')).toBe('N/A');
    expect(toReadableLabel(null)).toBe('N/A');
    expect(toReadableLabel(undefined)).toBe('N/A');
    expect(toReadableLabel(42)).toBe('N/A');
    expect(toReadableLabel('', 'Non definito')).toBe('Non definito');
  });
});

describe('toImpactLabel', () => {
  // "Impatto" e' maschile: passare dal dizionario generale darebbe
  // "Impatto: Alta", che e' l'errore che questa funzione esiste per evitare.
  it('concorda al maschile', () => {
    expect(toImpactLabel('low')).toBe('Basso');
    expect(toImpactLabel('medium')).toBe('Medio');
    expect(toImpactLabel('high')).toBe('Alto');
    expect(toImpactLabel('critical')).toBe('Critico');
  });

  it('un valore sconosciuto resta visibile', () => {
    expect(toImpactLabel('massive')).toBe('Massive');
  });

  it('senza valore usa il ripiego', () => {
    expect(toImpactLabel(null)).toBe('N/A');
    expect(toImpactLabel('', 'Non stimato')).toBe('Non stimato');
  });
});
