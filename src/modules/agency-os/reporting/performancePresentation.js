// Presentazione delle metriche di performance (Reportistica multi-sorgente, V6).
// Il serbatoio cattura TUTTO il grezzo (metrics = oggetto libero); qui vivono le
// scelte di VISUALIZZAZIONE: quali metriche esistono, come si formattano, come si
// raggruppano in famiglie e come si sommano nel combinato (rapporti ricalcolati
// dai totali, non mediati).

export const METRIC_DEFS = [
  { key: "leads", label: "Lead", family: "volume", format: "int" },
  { key: "impressions", label: "Impression", family: "volume", format: "int" },
  { key: "clicks", label: "Click", family: "volume", format: "int" },
  { key: "cost", label: "Spesa", family: "volume", format: "currency" },
  { key: "ctr", label: "CTR", family: "efficienza", format: "percent" },
  { key: "cpc", label: "CPC medio", family: "efficienza", format: "currency" },
  { key: "cpa", label: "CPA", family: "efficienza", format: "currency" },
  { key: "conversionRate", label: "Tasso conversione", family: "efficienza", format: "percent" },
  { key: "conversions", label: "Conversioni", family: "risultato", format: "int" },
  { key: "conversionValue", label: "Valore conversioni", family: "risultato", format: "currency" },
  { key: "roas", label: "ROAS", family: "risultato", format: "ratio" },
  { key: "aov", label: "Valore medio ordine", family: "risultato", format: "currency" },
];

export const METRIC_FAMILIES = [
  { key: "volume", label: "Volume" },
  { key: "efficienza", label: "Efficienza" },
  { key: "risultato", label: "Risultato" },
];

// Preset di default editabile (non un limite): la variabilita' per cliente vive
// sui set/carne', non su cosa si salva.
export const DEFAULT_METRIC_KEYS = ["cost", "clicks", "conversions", "conversionValue", "roas", "ctr"];

// Metriche additive: si sommano. I rapporti si ricalcolano dai totali.
const ADDITIVE_KEYS = ["leads", "impressions", "clicks", "cost", "conversions", "conversionValue"];

export const METRIC_DEF_BY_KEY = METRIC_DEFS.reduce((acc, def) => {
  acc[def.key] = def;
  return acc;
}, {});

export const METRIC_KEYS = METRIC_DEFS.map((def) => def.key);

const numberFormat = (options) => new Intl.NumberFormat("it-IT", options);

export const formatMetricValue = (value, format) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "—";
  }
  const n = Number(value);
  switch (format) {
    case "currency":
      return numberFormat({ style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(n);
    case "percent":
      return numberFormat({ style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 2 }).format(n);
    case "ratio":
      return `${numberFormat({ minimumFractionDigits: 1, maximumFractionDigits: 2 }).format(n)}×`;
    case "int":
    default:
      return numberFormat({ maximumFractionDigits: 0 }).format(Math.round(n));
  }
};

export const formatMetric = (metrics, key) => {
  const def = METRIC_DEF_BY_KEY[key];
  if (!def) {
    return "—";
  }
  return formatMetricValue(metrics?.[key], def.format);
};

// Opzione "ultima fotografia": i connettori "aggiorna ora" ACCUMULANO fotografie
// datate dello stesso mese (decisione approvata: lo storico non si sovrascrive).
// Per i TOTALI e per l'ANDAMENTO non vanno sommate (sono cumulative → gonfierebbero
// i numeri): si tiene solo la piu' recente (createdAt max) per ciascuna coppia
// fonte+periodStart. La tabella dello storico resta invece completa, grezza.
// Il criterio (source, periodStart) e' lo stesso dell'anti-doppione lato serbatoio.
export const latestPerMonthSource = (snapshots) => {
  const latest = new Map();
  (snapshots || []).forEach((snapshot) => {
    const key = `${snapshot.source}|${snapshot.periodStart}`;
    const current = latest.get(key);
    if (
      !current ||
      new Date(snapshot.createdAt).getTime() > new Date(current.createdAt).getTime()
    ) {
      latest.set(key, snapshot);
    }
  });
  return Array.from(latest.values());
};

// Somma le metriche additive di piu' rilevazioni e RICALCOLA i rapporti dai totali
// (stessa regola del merge multi-fonte: non si mediano i rapporti).
export const deriveTotals = (snapshots) => {
  const totals = { leads: 0, impressions: 0, clicks: 0, cost: 0, conversions: 0, conversionValue: 0 };
  (snapshots || []).forEach((snapshot) => {
    const metrics = snapshot?.metrics || {};
    ADDITIVE_KEYS.forEach((key) => {
      totals[key] += Number(metrics[key]) || 0;
    });
  });
  const { impressions, clicks, cost, conversions, conversionValue } = totals;
  return {
    ...totals,
    ctr: impressions > 0 ? clicks / impressions : 0,
    cpc: clicks > 0 ? cost / clicks : 0,
    cpa: conversions > 0 ? cost / conversions : 0,
    roas: cost > 0 ? conversionValue / cost : 0,
    aov: conversions > 0 ? conversionValue / conversions : 0,
    conversionRate: clicks > 0 ? conversions / clicks : 0,
  };
};

export const SOURCE_META = {
  GOOGLE_ADS: { label: "Google Ads", short: "Google" },
  META_ADS: { label: "Meta Ads", short: "Meta" },
  EXCEL: { label: "File Excel", short: "Excel" },
};

export const sourceLabel = (source) => SOURCE_META[source]?.label || source;
export const sourceShort = (source) => SOURCE_META[source]?.short || source;

const dateFormat = new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "short", year: "numeric" });

export const formatPeriod = (startIso, endIso) => {
  try {
    return `${dateFormat.format(new Date(startIso))} – ${dateFormat.format(new Date(endIso))}`;
  } catch (_error) {
    return "—";
  }
};

// Periodo di default per "aggiorna ora": dal primo del mese corrente a oggi.
export const currentMonthRange = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const toIsoDay = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };
  return { periodStart: toIsoDay(start), periodEnd: toIsoDay(now) };
};
