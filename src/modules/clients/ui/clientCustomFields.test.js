import { describe, expect, it } from 'vitest';
import {
  customFieldErrorKey,
  isCustomFieldEmpty,
  selectActiveDefinitions,
  validateRequiredCustomFields,
} from './clientCustomFields';

describe('clientCustomFields', () => {
  it('tiene solo le definizioni attive', () => {
    const result = selectActiveDefinitions({
      definitions: [
        { id: '1', key: 'settore', active: true },
        { id: '2', key: 'vecchio', active: false },
      ],
    });
    expect(result.map((definition) => definition.key)).toEqual(['settore']);
  });

  it('regge una risposta senza definizioni', () => {
    expect(selectActiveDefinitions(undefined)).toEqual([]);
    expect(selectActiveDefinitions({})).toEqual([]);
  });

  it('considera vuoti stringa vuota, null, undefined e il no di un si\'/no', () => {
    expect(isCustomFieldEmpty('')).toBe(true);
    expect(isCustomFieldEmpty(null)).toBe(true);
    expect(isCustomFieldEmpty(undefined)).toBe(true);
    expect(isCustomFieldEmpty(false)).toBe(true);
    expect(isCustomFieldEmpty(0)).toBe(false);
    expect(isCustomFieldEmpty('x')).toBe(false);
    expect(isCustomFieldEmpty(true)).toBe(false);
  });

  describe('validateRequiredCustomFields', () => {
    const definizioni = [
      { id: '1', key: 'settore', required: true },
      { id: '2', key: 'note', required: false },
    ];

    it('segnala l\'obbligatorio non compilato, con la chiave prefissata', () => {
      const errors = validateRequiredCustomFields(definizioni, {});
      expect(errors).toEqual({ [customFieldErrorKey('settore')]: 'Questo campo è obbligatorio.' });
    });

    it('non segnala niente se gli obbligatori sono compilati', () => {
      expect(validateRequiredCustomFields(definizioni, { settore: 'Ristorazione' })).toEqual({});
    });

    it('ignora i campi non obbligatori lasciati vuoti', () => {
      expect(validateRequiredCustomFields(definizioni, { settore: 'x', note: '' })).toEqual({});
    });

    it('regge definizioni o valori assenti', () => {
      expect(validateRequiredCustomFields(undefined, undefined)).toEqual({});
      expect(validateRequiredCustomFields(definizioni, undefined)).toEqual({
        [customFieldErrorKey('settore')]: 'Questo campo è obbligatorio.',
      });
    });
  });
});
