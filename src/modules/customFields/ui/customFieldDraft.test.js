import { describe, expect, it } from 'vitest';
import {
  FIELD_TYPE_OPTIONS,
  buildCustomFieldPayload,
  createEmptyDraft,
  fieldToDraft,
  optionsToText,
  previewKeyFromDraft,
  textToOptions,
} from './customFieldDraft';

describe('customFieldDraft', () => {
  it('espone tutti e sei i tipi di campo', () => {
    expect(FIELD_TYPE_OPTIONS.map((option) => option.value)).toEqual([
      'text',
      'textarea',
      'number',
      'date',
      'boolean',
      'select',
    ]);
  });

  describe('optionsToText / textToOptions', () => {
    it('scrive «valore | etichetta» solo quando l\'etichetta e\' diversa', () => {
      expect(optionsToText([
        { value: 'alta', label: 'Alta' },
        { value: 'media', label: 'media' },
      ])).toBe('alta | Alta\nmedia');
    });

    it('regge opzioni assenti', () => {
      expect(optionsToText(undefined)).toBe('');
      expect(optionsToText(null)).toBe('');
    });

    it('legge una riga per opzione e usa il valore come etichetta se manca', () => {
      expect(textToOptions('alta | Alta\n  media  \n\nbassa|Bassa')).toEqual([
        { value: 'alta', label: 'Alta' },
        { value: 'media', label: 'media' },
        { value: 'bassa', label: 'Bassa' },
      ]);
    });

    it('scarta le righe senza valore e ricompone le etichette con la barra', () => {
      expect(textToOptions(' | solo etichetta\nsi | Sì | davvero')).toEqual([
        { value: 'si', label: 'Sì | davvero' },
      ]);
    });

    it('e\' stabile andata e ritorno', () => {
      const options = [{ value: 'web', label: 'Sito web' }, { value: 'social', label: 'social' }];
      expect(textToOptions(optionsToText(options))).toEqual(options);
    });
  });

  describe('fieldToDraft', () => {
    it('senza definizione torna una bozza vuota', () => {
      expect(fieldToDraft(null)).toEqual(createEmptyDraft());
    });

    it('porta dentro la bozza le opzioni gia\' salvate', () => {
      const draft = fieldToDraft({
        id: 'f1',
        label: 'Fonte del contatto',
        key: 'fonte_del_contatto',
        type: 'select',
        required: true,
        active: false,
        options: [{ value: 'passaparola', label: 'Passaparola' }],
      });

      expect(draft).toEqual({
        id: 'f1',
        label: 'Fonte del contatto',
        key: 'fonte_del_contatto',
        type: 'select',
        required: true,
        active: false,
        optionsText: 'passaparola | Passaparola',
      });
    });
  });

  describe('previewKeyFromDraft', () => {
    it('genera lo slug dall\'etichetta in creazione', () => {
      expect(previewKeyFromDraft({ ...createEmptyDraft(), label: 'Settore merceologico' }))
        .toBe('settore_merceologico');
    });

    it('toglie accenti e punteggiatura', () => {
      expect(previewKeyFromDraft({ ...createEmptyDraft(), label: "Città dell'azienda!" }))
        .toBe('citta_dell_azienda');
    });

    it('rispetta la chiave scritta a mano', () => {
      expect(previewKeyFromDraft({ ...createEmptyDraft(), label: 'Qualcosa', key: 'mia_chiave' }))
        .toBe('mia_chiave');
    });

    it('in modifica mostra la chiave esistente, non lo slug dell\'etichetta', () => {
      expect(previewKeyFromDraft({ id: 'f1', label: 'Nuova etichetta', key: 'vecchia_chiave' }))
        .toBe('vecchia_chiave');
    });
  });

  describe('buildCustomFieldPayload', () => {
    it('rifiuta l\'etichetta vuota', () => {
      expect(buildCustomFieldPayload({ ...createEmptyDraft(), label: '   ' }))
        .toEqual({ ok: false, error: 'Etichetta obbligatoria' });
    });

    it('rifiuta un elenco a tendina senza opzioni', () => {
      const result = buildCustomFieldPayload({ ...createEmptyDraft(), label: 'Fonte', type: 'select' });
      expect(result.ok).toBe(false);
      expect(result.error).toContain('almeno');
    });

    it('in creazione manda la chiave solo se scritta a mano', () => {
      const senzaChiave = buildCustomFieldPayload({ ...createEmptyDraft(), label: ' Settore ' });
      expect(senzaChiave).toEqual({
        ok: true,
        payload: { label: 'Settore', type: 'text', required: false, active: true },
      });

      const conChiave = buildCustomFieldPayload({ ...createEmptyDraft(), label: 'Settore', key: ' settore ' });
      expect(conChiave.payload.key).toBe('settore');
    });

    it('in modifica non manda mai la chiave', () => {
      const result = buildCustomFieldPayload({
        id: 'f1',
        label: 'Settore',
        key: 'settore',
        type: 'text',
        required: true,
        active: true,
        optionsText: '',
      });
      expect(result.ok).toBe(true);
      expect(result.payload).not.toHaveProperty('key');
      expect(result.payload.required).toBe(true);
    });

    it('manda le opzioni dell\'elenco a tendina', () => {
      const result = buildCustomFieldPayload({
        ...createEmptyDraft(),
        label: 'Fonte del contatto',
        type: 'select',
        optionsText: 'passaparola | Passaparola\nweb',
      });
      expect(result.payload.options).toEqual([
        { value: 'passaparola', label: 'Passaparola' },
        { value: 'web', label: 'web' },
      ]);
    });
  });
});
