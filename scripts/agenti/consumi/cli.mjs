// Lettura e controllo degli argomenti della riga di comando (spezzato da
// consumi.mjs il 3/8/2026). Tutto puro: riceve l'array degli argomenti,
// non legge process.argv da solo.

// Torna il valore di un'opzione, `null` se l'opzione non e' stata usata,
// `undefined` se e' stata usata senza valore. Distinguere i due casi serve: un
// "--da" senza ora, trattato come "non chiesto", annotava di nascosto l'intera
// sessione invece del pezzo voluto.
export function valoreDi(args, nome) {
  const i = args.indexOf(nome);
  if (i < 0) return null;
  const dopo = args[i + 1];
  return dopo && !dopo.startsWith('--') ? dopo : undefined;
}

// Controlla che ogni opzione usata abbia il suo valore. Torna il nome della
// prima incompleta, o null se va tutto bene.
export function opzioneSenzaValore(args, nomi) {
  return nomi.find((n) => args.includes(n) && valoreDi(args, n) === undefined) || null;
}

// Accetta "14:30" (oggi, ora del computer) o una data intera ISO. Torna null se
// non e' stato chiesto niente, undefined se il testo non si capisce.
export function oraIndicata(testo, adesso) {
  if (!testo) return null;
  if (/^\d{1,2}:\d{2}$/.test(testo)) {
    const [h, m] = testo.split(':').map(Number);
    if (h > 23 || m > 59) return undefined; // "99:99" non e' un'ora
    const d = new Date(adesso);
    d.setHours(h, m, 0, 0);
    return d.getTime();
  }
  const t = Date.parse(testo);
  return Number.isNaN(t) ? undefined : t;
}

// Tutti i controlli sugli argomenti, PRIMA di leggere i registri: leggerli costa
// una ventina di secondi, e non ha senso spenderli per poi dire che il comando
// era scritto male. Torna false se c'e' qualcosa che non va (dopo aver spiegato
// cosa), true se si puo' procedere.
export function argomentiValidi(args) {
  // Un'opzione scritta senza il suo valore veniva ignorata in silenzio, e il
  // comando faceva un'altra cosa senza dirlo: e' esattamente il tipo di errore
  // muto che questo strumento serve a scovare, quindi qui si ferma.
  const esempi = {
    '--compito': 'npm run consumi:compito -- "spezzatura ClientsList, giro 2"',
    '--da': '--da 10:30   oppure   --da "2026-07-31T07:40Z"',
    '--a': '--a 11:15    oppure   --a "2026-07-31T08:26Z"',
    '--finestra-a': '--finestra-a "2026-07-31T09:50Z"',
  };
  const monca = opzioneSenzaValore(args, Object.keys(esempi));
  if (monca) {
    console.error(`Manca il valore di ${monca}. Esempio: ${esempi[monca]}`);
    return false;
  }
  // --da/--a delimitano un compito: da soli non vogliono dire niente, e prima
  // venivano ignorati senza un fiato.
  const solitari = ['--da', '--a'].filter((n) => args.includes(n));
  if (solitari.length > 0 && !args.includes('--compito')) {
    console.error(`${solitari.join(' e ')} serve solo insieme a --compito. Esempio: ${esempi['--compito']} --da 10:30`);
    return false;
  }
  return true;
}
