import { describe, expect, it } from 'vitest';
import {
  createId,
  deriveNameFromUrl,
  formatFileSize,
  getFriendlyFileStatus,
  getFriendlyParseStatus,
  getFriendlySourcesError,
  getUrlTypeLabel,
} from './assetsFormatters';
import { getInvalidUrlLabels, isValidHttpUrl, splitCompetitorUrls } from './assetsUrlValidation';
import {
  getCompetitorSearchAlertTitle,
  getCompetitorSearchAlertVariant,
  getFriendlyCompetitorSearchMessage,
  mergeCompetitorsFromUrls,
} from './assetsCompetitorHelpers';

describe('formatFileSize', () => {
  it('sceglie l\'unita\' in base alla dimensione', () => {
    expect(formatFileSize(500)).toBe('500 byte');
    expect(formatFileSize(2048)).toBe('2.0 KB');
    expect(formatFileSize(3 * 1024 * 1024)).toBe('3.0 MB');
  });

  it('senza dimensione dice zero byte invece di NaN', () => {
    expect(formatFileSize(undefined)).toBe('0 byte');
    expect(formatFileSize(null)).toBe('0 byte');
  });
});

describe('getFriendlyFileStatus', () => {
  it('traduce gli stati noti del caricamento', () => {
    expect(getFriendlyFileStatus('uploaded')).toBe('Caricato');
    expect(getFriendlyFileStatus('queued')).toBe('In coda');
    expect(getFriendlyFileStatus('uploading')).toBe('Caricamento');
    expect(getFriendlyFileStatus('failed')).toBe('Errore');
    expect(getFriendlyFileStatus('parsed')).toBe('Letto correttamente');
  });

  it('su uno stato sconosciuto ripiega sul file registrato ma non analizzato', () => {
    expect(getFriendlyFileStatus('metadata_only')).toBe('File registrato, contenuto non ancora analizzato');
    expect(getFriendlyFileStatus(undefined)).toBe('File registrato, contenuto non ancora analizzato');
  });
});

describe('getFriendlyParseStatus', () => {
  it('distingue lettura completa e parziale', () => {
    expect(getFriendlyParseStatus({ parseStatus: 'parsed' })).toBe('Letto correttamente');
    expect(getFriendlyParseStatus({ parseStatus: 'partial' })).toBe('Letto parzialmente');
  });

  it('con il file "parsed" ma la lettura parziale prevale la lettura parziale', () => {
    expect(getFriendlyParseStatus({ status: 'parsed', parseStatus: 'partial' })).toBe('Letto parzialmente');
  });

  it('racconta i due modi in cui la lettura non riesce', () => {
    expect(getFriendlyParseStatus({ parseStatus: 'unsupported' })).toBe('Formato non leggibile');
    expect(getFriendlyParseStatus({ parseStatus: 'failed' })).toBe('Lettura non riuscita');
  });

  it('distingue il file registrato senza analisi dal contenuto non letto', () => {
    expect(getFriendlyParseStatus({ status: 'metadata_only' })).toBe('File registrato, contenuto non ancora analizzato');
    expect(getFriendlyParseStatus({ status: 'uploaded' })).toBe('Contenuto non letto');
  });
});

describe('createId', () => {
  it('usa il prefisso dato e non ripete due volte lo stesso identificativo', () => {
    const primo = createId('cmp');
    const secondo = createId('cmp');

    expect(primo.startsWith('cmp_')).toBe(true);
    expect(primo).not.toBe(secondo);
  });
});

describe('deriveNameFromUrl', () => {
  it('prende il dominio togliendo il www', () => {
    expect(deriveNameFromUrl('https://www.esempio.it/pagina')).toBe('esempio.it');
    expect(deriveNameFromUrl('https://blog.esempio.it')).toBe('blog.esempio.it');
  });

  it('se non e\' un indirizzo valido restituisce quello che ha ricevuto', () => {
    expect(deriveNameFromUrl('non-un-url')).toBe('non-un-url');
  });
});

describe('getUrlTypeLabel', () => {
  it('traduce i tipi previsti e ripiega su "Link utile"', () => {
    expect(getUrlTypeLabel('website')).toBe('Sito principale');
    expect(getUrlTypeLabel('google_business')).toBe('Google Business Profile');
    expect(getUrlTypeLabel('tipo_inventato')).toBe('Link utile');
  });
});

describe('getFriendlySourcesError', () => {
  it('traduce il payload rifiutato in una spiegazione utile', () => {
    const messaggio = getFriendlySourcesError(new Error('Invalid Agency project sources payload'), 'fallback');

    expect(messaggio).toMatch(/non sono nel formato previsto/);
  });

  it('lascia passare gli altri messaggi di errore', () => {
    expect(getFriendlySourcesError(new Error('Rete non raggiungibile'), 'fallback')).toBe('Rete non raggiungibile');
  });

  it('senza un vero errore usa il messaggio di riserva', () => {
    expect(getFriendlySourcesError(null, 'Salvataggio non riuscito.')).toBe('Salvataggio non riuscito.');
  });
});

describe('splitCompetitorUrls', () => {
  it('separa su virgole e a capo, ripulendo spazi e righe vuote', () => {
    expect(splitCompetitorUrls('a.it, b.it\nc.it\r\n\n , d.it')).toEqual(['a.it', 'b.it', 'c.it', 'd.it']);
  });

  it('su casella vuota torna una lista vuota', () => {
    expect(splitCompetitorUrls('')).toEqual([]);
    expect(splitCompetitorUrls(undefined)).toEqual([]);
  });
});

describe('isValidHttpUrl', () => {
  it('accetta http e https', () => {
    expect(isValidHttpUrl('https://esempio.it')).toBe(true);
    expect(isValidHttpUrl('  http://esempio.it  ')).toBe(true);
  });

  it('rifiuta gli indirizzi senza protocollo o con protocolli non leggibili', () => {
    expect(isValidHttpUrl('esempio.it')).toBe(false);
    expect(isValidHttpUrl('mailto:info@esempio.it')).toBe(false);
    expect(isValidHttpUrl('')).toBe(false);
  });
});

describe('getInvalidUrlLabels', () => {
  it('elenca per etichetta gli indirizzi di progetto da correggere', () => {
    const urls = [
      { url: 'https://ok.it', label: 'Sito' },
      { url: 'sbagliato', label: 'Landing' },
      { url: 'anche-questo' },
    ];

    expect(getInvalidUrlLabels(urls)).toEqual(['Landing', 'anche-questo']);
  });

  it('non considera errore una riga ancora da compilare', () => {
    expect(getInvalidUrlLabels([{ url: '', label: 'Vuota' }])).toEqual([]);
  });

  it('marca i competitor sbagliati distinguendoli dagli URL di progetto', () => {
    expect(getInvalidUrlLabels([], ['https://ok.it', 'sbagliato'])).toEqual(['Competitor: sbagliato']);
  });
});

describe('mergeCompetitorsFromUrls', () => {
  it('aggiunge i nuovi indirizzi come competitor confermati manuali', () => {
    const merged = mergeCompetitorsFromUrls([], ['https://www.rivale.it']);

    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({
      name: 'rivale.it',
      url: 'https://www.rivale.it',
      source: 'manual',
      status: 'confirmed',
    });
  });

  it('non duplica un competitor gia\' presente, ignorando maiuscole e spazi', () => {
    const esistente = { id: 'cmp_1', url: '  HTTPS://Rivale.it  ', name: 'Rivale' };

    const merged = mergeCompetitorsFromUrls([esistente], ['https://rivale.it']);

    expect(merged).toHaveLength(1);
    expect(merged[0]).toBe(esistente);
  });

  it('scarta le voci senza indirizzo', () => {
    expect(mergeCompetitorsFromUrls([{ id: 'cmp_1', name: 'Senza url' }], [])).toEqual([]);
  });
});

describe('esito della ricerca competitor', () => {
  it('quando la ricerca e\' avvenuta davvero usa il messaggio del servizio', () => {
    const result = { realSearch: true, message: 'Trovati 4 competitor.' };

    expect(getFriendlyCompetitorSearchMessage(result)).toBe('Trovati 4 competitor.');
    expect(getCompetitorSearchAlertTitle(result)).toBe('Ricerca automatica completata.');
    expect(getCompetitorSearchAlertVariant(result)).toBe('info');
  });

  it('senza ricerca configurata invita a inserirli a mano', () => {
    const result = { realSearch: false };

    expect(getFriendlyCompetitorSearchMessage(result)).toMatch(/non configurata/);
    expect(getCompetitorSearchAlertTitle(result)).toBe('Ricerca automatica non configurata.');
    expect(getCompetitorSearchAlertVariant(result)).toBe('warning');
  });

  it('sul servizio in errore spiega dove intervenire e colora di rosso', () => {
    const result = { providerStatus: 'configured_error' };

    expect(getFriendlyCompetitorSearchMessage(result)).toMatch(/Verifica chiave, modello e limiti API/);
    expect(getCompetitorSearchAlertTitle(result)).toBe('Ricerca non riuscita.');
    expect(getCompetitorSearchAlertVariant(result)).toBe('danger');
  });

  it('sul timeout suggerisce un modello piu\' veloce', () => {
    const result = { providerStatus: 'configured_timeout' };

    expect(getFriendlyCompetitorSearchMessage(result)).toMatch(/troppo tempo/);
    expect(getCompetitorSearchAlertTitle(result)).toBe('Ricerca interrotta per timeout.');
    expect(getCompetitorSearchAlertVariant(result)).toBe('warning');
  });

  it('configurata ma senza ricerca reale: titolo e colore non lo dichiarano un errore', () => {
    const result = { providerStatus: 'configured', realSearch: false };

    expect(getFriendlyCompetitorSearchMessage(result)).toBe('Ricerca competitor configurata lato server.');
    expect(getCompetitorSearchAlertTitle(result)).toBe('Ricerca configurata.');
    expect(getCompetitorSearchAlertVariant(result)).toBe('success');
  });

  it('un messaggio del servizio vince sul testo di riserva anche negli stati di errore', () => {
    expect(getFriendlyCompetitorSearchMessage({
      providerStatus: 'configured_error',
      message: 'Quota esaurita.',
    })).toBe('Quota esaurita.');
  });
});
