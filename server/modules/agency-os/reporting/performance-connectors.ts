// Connettori di performance (Reportistica multi-sorgente, V6).
// Interfaccia comune che i futuri connettori reali (Google Ads, Meta) implementeranno;
// per ora esiste solo lo StubConnector, che genera metriche SIMULATE plausibili cosi'
// la dashboard e' navigabile finche' non ci sono OAuth e credenziali reali (decisione
// in report-multisorgente-decisioni.md: connettore "finto" con la stessa interfaccia
// dei futuri reali + dati demo). L'Excel NON e' un connettore: e' una sorgente a
// caricamento file (sotto-modulo dedicato), quindi non fetcha da qui.

export type ConnectorSource = 'GOOGLE_ADS' | 'META_ADS';

export type ConnectorStatus = 'simulated' | 'not_configured' | 'connected';

export interface ConnectorFetchInput {
  projectId: string;
  periodStart: Date;
  periodEnd: Date;
}

export interface ConnectorFetchResult {
  metrics: Record<string, number>;
  sourceLabel: string;
}

export interface PerformanceConnector {
  readonly source: ConnectorSource;
  readonly label: string;
  readonly status: ConnectorStatus;
  fetchMetrics(input: ConnectorFetchInput): ConnectorFetchResult;
}

// --- utilita' deterministiche ---
// Niente Math.random: stesse date + stesso progetto -> stessi numeri. Cosi' i dati
// demo sono stabili nel tempo e un secondo "aggiorna ora" sullo stesso periodo non
// fa ballare i valori (le piattaforme vere invece possono variare: quello lo si
// modella quando arrivano i connettori reali).

const hashString = (value: string): number => {
  let h = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

// mulberry32: PRNG deterministico e veloce, seed -> sequenza in [0,1).
const makeRng = (seed: number): (() => number) => {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const round = (n: number): number => Math.round(n);
const round2 = (n: number): number => Math.round(n * 100) / 100;
const round4 = (n: number): number => Math.round(n * 10000) / 10000;

const dayKey = (date: Date): string => date.toISOString().slice(0, 10);

const periodDays = (start: Date, end: Date): number => {
  const ms = end.getTime() - start.getTime();
  return Math.max(1, Math.round(ms / 86_400_000) + 1);
};

// Profilo indicativo per sorgente: Google piu' intento e CPC piu' alto; Meta piu'
// volume e CPC piu' basso. Numeri puramente dimostrativi.
const SOURCE_PROFILE: Record<
  ConnectorSource,
  { label: string; volume: number; cpc: [number, number]; ctr: [number, number] }
> = {
  GOOGLE_ADS: { label: 'Google Ads', volume: 1, cpc: [0.6, 2.6], ctr: [0.02, 0.08] },
  META_ADS: { label: 'Meta Ads', volume: 1.6, cpc: [0.2, 1.4], ctr: [0.008, 0.045] },
};

const buildStubMetrics = (
  source: ConnectorSource,
  input: ConnectorFetchInput,
): Record<string, number> => {
  const profile = SOURCE_PROFILE[source];
  const seed = hashString(`${source}|${input.projectId}|${dayKey(input.periodStart)}`);
  const rng = makeRng(seed);
  const weeks = periodDays(input.periodStart, input.periodEnd) / 7;

  const impressions = round((6000 + rng() * 42_000) * profile.volume * weeks);
  const ctr = profile.ctr[0] + rng() * (profile.ctr[1] - profile.ctr[0]);
  const clicks = Math.max(0, round(impressions * ctr));
  const cpc = profile.cpc[0] + rng() * (profile.cpc[1] - profile.cpc[0]);
  const cost = round2(clicks * cpc);
  const convRate = 0.015 + rng() * 0.055;
  const conversions = Math.max(0, round(clicks * convRate));
  // ROAS realistico (1.3-6.8) generato direttamente: da qui deriva il valore
  // conversioni, cosi' il rapporto principale resta credibile e coerente col costo
  // (invece di sommare AOV casuali che producono ROAS assurdi).
  const roasTarget = 1.3 + rng() * 5.5;
  const conversionValue = round2(cost * roasTarget);

  // Le metriche additive sono il "grezzo"; i rapporti si ricalcolano DAI TOTALI
  // (stessa regola del merge multi-fonte), non si inventano a parte.
  return {
    impressions,
    clicks,
    cost,
    conversions,
    conversionValue,
    ctr: impressions > 0 ? round4(clicks / impressions) : 0,
    cpc: clicks > 0 ? round2(cost / clicks) : 0,
    cpa: conversions > 0 ? round2(cost / conversions) : 0,
    roas: cost > 0 ? round2(conversionValue / cost) : 0,
    aov: conversions > 0 ? round2(conversionValue / conversions) : 0,
    conversionRate: clicks > 0 ? round4(conversions / clicks) : 0,
  };
};

class StubConnector implements PerformanceConnector {
  readonly source: ConnectorSource;
  readonly label: string;
  readonly status: ConnectorStatus = 'simulated';

  constructor(source: ConnectorSource) {
    this.source = source;
    this.label = SOURCE_PROFILE[source].label;
  }

  fetchMetrics(input: ConnectorFetchInput): ConnectorFetchResult {
    return {
      metrics: buildStubMetrics(this.source, input),
      sourceLabel: `${this.label} (simulato)`,
    };
  }
}

const CONNECTORS: Record<ConnectorSource, PerformanceConnector> = {
  GOOGLE_ADS: new StubConnector('GOOGLE_ADS'),
  META_ADS: new StubConnector('META_ADS'),
};

export const CONNECTOR_SOURCES: ConnectorSource[] = ['GOOGLE_ADS', 'META_ADS'];

export const isConnectorSource = (value: string): value is ConnectorSource =>
  value === 'GOOGLE_ADS' || value === 'META_ADS';

export const getConnector = (source: ConnectorSource): PerformanceConnector => CONNECTORS[source];

// Descrittori per la UI (card connettori, modello "Provider AI"). Include anche
// l'Excel come sorgente a caricamento file (non un connettore) con stato dedicato.
export interface ConnectorDescriptor {
  source: 'GOOGLE_ADS' | 'META_ADS' | 'EXCEL';
  label: string;
  status: ConnectorStatus | 'manual';
  kind: 'connector' | 'file';
  note: string;
}

export const listConnectorDescriptors = (): ConnectorDescriptor[] => [
  {
    source: 'GOOGLE_ADS',
    label: 'Google Ads',
    status: 'simulated',
    kind: 'connector',
    note: 'Dati simulati (connettore demo). La connessione reale richiede OAuth e developer token.',
  },
  {
    source: 'META_ADS',
    label: 'Meta Ads',
    status: 'simulated',
    kind: 'connector',
    note: 'Dati simulati (connettore demo). La connessione reale richiede OAuth.',
  },
  {
    source: 'EXCEL',
    label: 'File Excel del cliente',
    status: 'manual',
    kind: 'file',
    note: 'Sorgente a caricamento file con standardizzazione assistita. Sotto-modulo in sviluppo.',
  },
];
