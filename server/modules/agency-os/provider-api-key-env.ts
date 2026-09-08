// Lettura delle chiavi dei provider AI dalle variabili d'ambiente.
//
// Perche' esiste questo modulo. La configurazione leggeva la chiave con un
// semplice `process.env.OPENAI_API_KEY?.trim() || null`, quindi QUALUNQUE
// stringa non vuota valeva come "chiave presente". Un `.env` di messa online
// compilato con un segnaposto — `OPENAI_API_KEY=REPLACE_ME`, dieci caratteri —
// produceva questo scenario, visto in produzione l'8/9/2026:
//
//   - le Impostazioni AI mostravano «API key OpenAI: presente» e lo stato
//     «AI configurata», perche' la stringa c'era;
//   - la chat AI rispondeva "internal server error" (bollino rosso), perche'
//     `Authorization: Bearer REPLACE_ME` torna 401 da api.openai.com e il 401
//     diventa un errore non gestito.
//
// L'interfaccia diceva quindi l'opposto della verita' proprio nel momento in
// cui serviva la verita'. Con un segnaposto riconosciuto come "assente" il
// bollino torna onesto e la chat ripiega sul messaggio dichiarato
// («AI non configurata...») invece di rompersi.
//
// La regola non prova a validare la chiave — quello lo puo' fare solo il
// provider — riconosce soltanto cio' che una chiave NON puo' essere.

// Segnaposto tipici dei file di esempio e degli script di messa online.
// Confronto sull'intero valore (non "contiene"), per non scartare una chiave
// vera che per caso contenga una di queste parole.
const PLACEHOLDER_VALUES = new Set([
  'replace_me',
  'replaceme',
  'change_me',
  'changeme',
  'todo',
  'placeholder',
  'your_api_key',
  'your-api-key',
  'inserisci_la_chiave',
  'da_inserire',
  'none',
  'null',
  'undefined',
]);

// Sequenze di sole X o di soli asterischi: l'altra forma comune di segnaposto
// (`sk-xxxxxxxx`, `********`), anche col prefisso `sk-`.
const MASKED_VALUE = /^(sk-)?[x*]+$/i;

// Lunghezza minima plausibile. Le chiavi vere di OpenAI e Anthropic stanno
// abbondantemente sopra i 40 caratteri; la soglia e' tenuta bassa apposta,
// perche' il compito qui e' scartare i segnaposto, non indovinare il formato
// di una chiave futura.
const MIN_PLAUSIBLE_LENGTH = 20;

/**
 * Vero se il valore c'e' ma non puo' essere una chiave: segnaposto, valore
 * mascherato, oppure troppo corto per essere una chiave di provider.
 *
 * Una stringa vuota NON e' un segnaposto: e' semplicemente assente.
 */
export const isPlaceholderApiKey = (value: string | null | undefined): boolean => {
  const trimmed = (value ?? '').trim();
  if (!trimmed) {
    return false;
  }

  if (PLACEHOLDER_VALUES.has(trimmed.toLowerCase())) {
    return true;
  }

  if (MASKED_VALUE.test(trimmed)) {
    return true;
  }

  return trimmed.length < MIN_PLAUSIBLE_LENGTH;
};

/**
 * La chiave di provider letta dall'ambiente, oppure `null` se manca o se e'
 * un segnaposto. Da usare al posto di `process.env.X?.trim() || null`.
 */
export const readProviderApiKeyFromEnv = (value: string | null | undefined): string | null => {
  const trimmed = (value ?? '').trim();
  if (!trimmed || isPlaceholderApiKey(trimmed)) {
    return null;
  }
  return trimmed;
};
