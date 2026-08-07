import React from "react";
import { useParams } from "react-router-dom";
import AgencyProjectPageTemplate from "./AgencyProjectPageTemplate";
import {
  fetchAgencyPerformanceConnectors,
  fetchAgencyProjectPerformanceSnapshots,
  refreshAgencyProjectPerformanceSnapshot,
  deleteAgencyProjectPerformanceSnapshot,
  fetchAgencyPerformanceMetricSets,
  createAgencyPerformanceMetricSet,
  updateAgencyPerformanceMetricSet,
  deleteAgencyPerformanceMetricSet,
  previewAgencyProjectExcel,
  commitAgencyProjectExcel,
} from "../../../modules/agency-os/api/agency.api";
import {
  METRIC_DEFS,
  METRIC_FAMILIES,
  METRIC_DEF_BY_KEY,
  DEFAULT_METRIC_KEYS,
  formatMetric,
  formatMetricValue,
  deriveTotals,
  latestPerMonthSource,
  sourceLabel,
  sourceShort,
  formatPeriod,
  currentMonthRange,
} from "../../../modules/agency-os/reporting/performancePresentation";

// Metriche di testata del riepilogo (fisse): il resto e' personalizzabile a chip.
const HEADLINE_KEYS = ["cost", "conversions", "conversionValue", "roas"];
// Metriche selezionabili come asse dell'andamento storico.
const TREND_KEYS = ["cost", "conversions", "conversionValue", "roas", "clicks", "impressions"];

const statusBadge = (status) => {
  switch (status) {
    case "connected":
      return { className: "text-bg-success", label: "Connesso" };
    case "simulated":
      return { className: "text-bg-warning", label: "Dati simulati" };
    case "manual":
      return { className: "text-bg-light border", label: "Caricamento file" };
    default:
      return { className: "text-bg-light border", label: "Da configurare" };
  }
};

const AgencyProjectPerformancePage = () => {
  const { projectId } = useParams();

  const [connectors, setConnectors] = React.useState([]);
  const [snapshots, setSnapshots] = React.useState([]);
  const [metricSets, setMetricSets] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  const [sourceFilter, setSourceFilter] = React.useState("ALL");
  const [selectedMetrics, setSelectedMetrics] = React.useState(DEFAULT_METRIC_KEYS);
  const [activeSetId, setActiveSetId] = React.useState(null);
  const [trendMetric, setTrendMetric] = React.useState("cost");
  const [refreshingSource, setRefreshingSource] = React.useState("");

  // Form del carne' (salva nuovo / rinomina attivo).
  const [setForm, setSetForm] = React.useState({ open: false, mode: "create", name: "", id: null });

  // Ingestion Excel: upload -> anteprima mappatura AI -> conferma.
  const [excelBusy, setExcelBusy] = React.useState(false);
  const [excelPreview, setExcelPreview] = React.useState(null);
  const [excelFile, setExcelFile] = React.useState(null);

  const loadSnapshots = React.useCallback(async () => {
    const rows = await fetchAgencyProjectPerformanceSnapshots(projectId);
    setSnapshots(Array.isArray(rows) ? rows : []);
  }, [projectId]);

  const loadAll = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [connectorRows, snapshotRows, setRows] = await Promise.all([
        fetchAgencyPerformanceConnectors(),
        fetchAgencyProjectPerformanceSnapshots(projectId),
        fetchAgencyPerformanceMetricSets(),
      ]);
      setConnectors(Array.isArray(connectorRows) ? connectorRows : []);
      setSnapshots(Array.isArray(snapshotRows) ? snapshotRows : []);
      setMetricSets(Array.isArray(setRows) ? setRows : []);
    } catch (loadError) {
      setError(loadError?.message || "Impossibile caricare i dati di performance.");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  React.useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const presentSources = React.useMemo(
    () => Array.from(new Set(snapshots.map((snapshot) => snapshot.source))),
    [snapshots],
  );

  const filteredSnapshots = React.useMemo(() => {
    if (sourceFilter === "ALL") {
      return snapshots;
    }
    return snapshots.filter((snapshot) => snapshot.source === sourceFilter);
  }, [snapshots, sourceFilter]);

  // "Ultima fotografia per mese/fonte": totali e andamento non sommano le
  // fotografie ripetute dello stesso mese (i connettori le accumulano), cosi' i
  // numeri non si gonfiano. Lo storico grezzo (tabella) resta su filteredSnapshots.
  const dedupedSnapshots = React.useMemo(
    () => latestPerMonthSource(filteredSnapshots),
    [filteredSnapshots],
  );

  const totals = React.useMemo(() => deriveTotals(dedupedSnapshots), [dedupedSnapshots]);

  const trendRows = React.useMemo(() => {
    const groups = new Map();
    dedupedSnapshots.forEach((snapshot) => {
      // Raggruppo per mese (periodStart e' sempre il primo del mese): piu' fonti
      // dello stesso mese confluiscono in un unico punto dell'andamento.
      const key = snapshot.periodStart;
      if (!groups.has(key)) {
        groups.set(key, { periodStart: snapshot.periodStart, periodEnd: snapshot.periodEnd, items: [] });
      }
      const group = groups.get(key);
      group.items.push(snapshot);
      if (new Date(snapshot.periodEnd).getTime() > new Date(group.periodEnd).getTime()) {
        group.periodEnd = snapshot.periodEnd;
      }
    });
    const rows = Array.from(groups.values()).map((group) => ({
      periodStart: group.periodStart,
      periodEnd: group.periodEnd,
      value: Number(deriveTotals(group.items)[trendMetric]) || 0,
    }));
    rows.sort((a, b) => new Date(a.periodStart).getTime() - new Date(b.periodStart).getTime());
    return rows;
  }, [dedupedSnapshots, trendMetric]);

  const trendMax = React.useMemo(
    () => Math.max(1, ...trendRows.map((row) => row.value)),
    [trendRows],
  );

  const orderedSelected = React.useMemo(
    () => METRIC_DEFS.filter((def) => selectedMetrics.includes(def.key)),
    [selectedMetrics],
  );

  const toggleMetric = (key) => {
    setActiveSetId(null);
    setSelectedMetrics((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key],
    );
  };

  const applySet = (metricSet) => {
    setActiveSetId(metricSet.id);
    setSelectedMetrics(
      Array.isArray(metricSet.metrics) && metricSet.metrics.length
        ? metricSet.metrics.filter((key) => METRIC_DEF_BY_KEY[key])
        : [],
    );
  };

  const handleRefresh = async (source) => {
    setRefreshingSource(source);
    setError("");
    try {
      // I connettori accumulano una fotografia datata a ogni aggiornamento (lo
      // storico non si sovrascrive); il doppio conteggio dei totali e' evitato in
      // lettura da latestPerMonthSource, non bloccando qui la scrittura.
      await refreshAgencyProjectPerformanceSnapshot(projectId, { source, ...currentMonthRange() });
      await loadSnapshots();
    } catch (refreshError) {
      setError(refreshError?.message || "Aggiornamento non riuscito.");
    } finally {
      setRefreshingSource("");
    }
  };

  const handleExcelSelected = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }
    setExcelBusy(true);
    setError("");
    setExcelPreview(null);
    try {
      const preview = await previewAgencyProjectExcel(projectId, file);
      setExcelPreview(preview);
      setExcelFile(file);
    } catch (previewError) {
      setError(previewError?.message || "Lettura del file Excel non riuscita.");
    } finally {
      setExcelBusy(false);
    }
  };

  const cancelExcel = () => {
    setExcelPreview(null);
    setExcelFile(null);
  };

  const handleExcelCommit = async (replace = false) => {
    if (!excelFile || !excelPreview) {
      return;
    }
    setExcelBusy(true);
    setError("");
    try {
      await commitAgencyProjectExcel(projectId, excelFile, excelPreview.mapping, { replace });
      await loadSnapshots();
      setExcelPreview(null);
      setExcelFile(null);
    } catch (commitError) {
      setError(commitError?.message || "Import dell'Excel non riuscito.");
    } finally {
      setExcelBusy(false);
    }
  };

  const handleDeleteSnapshot = async (snapshotId) => {
    if (!window.confirm("Eliminare questa rilevazione? Lo storico si puo' solo aggiungere: l'azione non si annulla.")) {
      return;
    }
    try {
      await deleteAgencyProjectPerformanceSnapshot(projectId, snapshotId);
      await loadSnapshots();
    } catch (deleteError) {
      setError(deleteError?.message || "Eliminazione non riuscita.");
    }
  };

  const openCreateSet = () => setSetForm({ open: true, mode: "create", name: "", id: null });
  const openRenameSet = (metricSet) =>
    setSetForm({ open: true, mode: "rename", name: metricSet.name, id: metricSet.id });
  const closeSetForm = () => setSetForm({ open: false, mode: "create", name: "", id: null });

  const submitSetForm = async (event) => {
    event.preventDefault();
    const name = setForm.name.trim();
    if (!name) {
      return;
    }
    try {
      if (setForm.mode === "rename" && setForm.id) {
        await updateAgencyPerformanceMetricSet(setForm.id, { name });
      } else {
        const created = await createAgencyPerformanceMetricSet({ name, metrics: selectedMetrics });
        if (created?.id) {
          setActiveSetId(created.id);
        }
      }
      const rows = await fetchAgencyPerformanceMetricSets();
      setMetricSets(Array.isArray(rows) ? rows : []);
      closeSetForm();
    } catch (setError) {
      setError(setError?.message || "Salvataggio del set non riuscito.");
    }
  };

  const handleDeleteSet = async (metricSet) => {
    if (!window.confirm(`Eliminare il set "${metricSet.name}"?`)) {
      return;
    }
    try {
      await deleteAgencyPerformanceMetricSet(metricSet.id);
      if (activeSetId === metricSet.id) {
        setActiveSetId(null);
      }
      const rows = await fetchAgencyPerformanceMetricSets();
      setMetricSets(Array.isArray(rows) ? rows : []);
    } catch (deleteError) {
      setError(deleteError?.message || "Eliminazione del set non riuscita.");
    }
  };

  const summaryTitle = sourceFilter === "ALL" ? "Riepilogo combinato" : `Riepilogo ${sourceShort(sourceFilter)}`;

  // Anti-doppione Excel: mesi (periodStart) del file gia' presenti nel serbatoio.
  const excelExistingPeriods = excelPreview?.preview?.existingPeriods || [];
  const excelHasDuplicates = excelExistingPeriods.length > 0;
  const excelSnapshotCount = excelPreview?.preview?.snapshots?.length || 0;
  const excelNewCount = Math.max(0, excelSnapshotCount - excelExistingPeriods.length);
  // Re-import "puro" = TUTTI i mesi del file sono gia' presenti; "arricchimento" =
  // file incrementale con alcuni mesi ripetuti + almeno un mese nuovo in coda.
  const excelAllExisting = excelSnapshotCount > 0 && excelNewCount === 0;
  let excelNoticeText = "";
  if (excelHasDuplicates) {
    const nEx = excelExistingPeriods.length;
    if (excelAllExisting) {
      excelNoticeText =
        nEx === 1
          ? "L’unico mese di questo file è già presente nel database. “Sostituisci e importa” lo riscrive con i valori di questo file (utile se il file è stato corretto)."
          : `Tutti i ${nEx} mesi di questo file sono già presenti nel database. “Sostituisci e importa” li riscrive con i valori di questo file (utile se il file è stato corretto).`;
    } else {
      const presenti = nEx === 1 ? "1 mese già presente" : `${nEx} mesi già presenti`;
      const nuovi = excelNewCount === 1 ? "1 mese nuovo" : `${excelNewCount} mesi nuovi`;
      excelNoticeText = `Questo file contiene anche ${presenti} (contrassegnati sotto), oltre a ${nuovi}. Con “Sostituisci e importa” i mesi già presenti vengono aggiornati con i valori di questo file e quelli nuovi vengono aggiunti — nessun doppione.`;
    }
  }

  return (
    <AgencyProjectPageTemplate
      title="Performance"
      subtitle="Dashboard operativa multi-sorgente: storico delle rilevazioni, metriche configurabili e connettori."
    >
      {error && (
        <div className="alert alert-warning py-2 px-3 small" role="alert">
          {error}
        </div>
      )}

      {/* Connettori (modello card "Provider AI") */}
      <div className="row g-2 mb-3">
        {connectors.map((connector) => {
          const badge = statusBadge(connector.status);
          const isRefreshing = refreshingSource === connector.source;
          return (
            <div className="col-12 col-md-4" key={connector.source}>
              <div className="border rounded-3 p-3 h-100 d-flex flex-column">
                <div className="d-flex justify-content-between align-items-start gap-2 mb-1">
                  <span className="fw-semibold">{connector.label}</span>
                  <span className={`badge ${badge.className}`}>{badge.label}</span>
                </div>
                <div className="small text-muted flex-grow-1">{connector.note}</div>
                {connector.kind === "connector" && (
                  <div className="mt-2">
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-primary"
                      disabled={isRefreshing}
                      onClick={() => handleRefresh(connector.source)}
                    >
                      {isRefreshing ? "Aggiorno…" : "Aggiorna ora"}
                    </button>
                  </div>
                )}
                {connector.kind === "file" && (
                  <div className="mt-2">
                    <label className={`btn btn-sm btn-outline-primary mb-0 ${excelBusy ? "disabled" : ""}`}>
                      {excelBusy ? "Elaboro…" : "Carica Excel"}
                      <input type="file" accept=".xlsx" hidden disabled={excelBusy} onChange={handleExcelSelected} />
                    </label>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {excelPreview && (
        <section className="border rounded-3 p-3 mb-3">
          <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-2">
            <div>
              <h6 className="mb-0">Anteprima import Excel — {excelPreview.filename}</h6>
              <div className="small text-muted">
                Foglio “{excelPreview.sheetName}”, {excelPreview.rowCount} righe. Mappatura{" "}
                {excelPreview.mappingMode === "ai_structured" ? "proposta dall'AI" : "euristica (fallback)"}.
              </div>
            </div>
            <span className={`badge ${excelPreview.preview.reconciliation.balanced ? "text-bg-success" : "text-bg-warning"}`}>
              {excelPreview.preview.reconciliation.balanced ? "Riconciliazione OK" : "Da controllare"}
            </span>
          </div>

          <div className="small mb-2">
            <span className="text-muted">Colonne:</span>{" "}
            data = <span className="fw-semibold">{excelPreview.mapping.dateColumn || "—"}</span>,{" "}
            valore = <span className="fw-semibold">{excelPreview.mapping.valueColumn || "—"}</span>,{" "}
            sorgente = <span className="fw-semibold">{excelPreview.mapping.sourceColumn || "—"}</span>
            {excelPreview.mapping.notes ? <div className="text-muted mt-1">{excelPreview.mapping.notes}</div> : null}
          </div>

          <div className="small text-muted mb-2">
            {excelPreview.preview.reconciliation.rowsParsed} righe → {excelPreview.preview.reconciliation.months} mesi
            {excelPreview.preview.reconciliation.rowsSkippedNoDate > 0
              ? ` · ${excelPreview.preview.reconciliation.rowsSkippedNoDate} righe senza data (escluse)`
              : ""}
          </div>

          <div className="table-responsive mb-2">
            <table className="table table-sm align-middle mb-0">
              <thead>
                <tr>
                  <th scope="col" className="small text-muted">Periodo</th>
                  <th scope="col" className="small text-muted text-end">Lead</th>
                  <th scope="col" className="small text-muted text-end">Conversioni</th>
                  <th scope="col" className="small text-muted text-end">Valore</th>
                </tr>
              </thead>
              <tbody>
                {excelPreview.preview.snapshots.map((snapshot) => (
                  <tr key={snapshot.periodKey}>
                    <td className="small">
                      {formatPeriod(snapshot.periodStart, snapshot.periodEnd)}
                      {excelExistingPeriods.includes(snapshot.periodStart) ? (
                        <span className="badge text-bg-warning ms-2">già presente</span>
                      ) : excelHasDuplicates ? (
                        <span className="badge text-bg-success ms-2">nuovo</span>
                      ) : null}
                    </td>
                    <td className="text-end small">{formatMetricValue(snapshot.metrics.leads, "int")}</td>
                    <td className="text-end small">{formatMetricValue(snapshot.metrics.conversions, "int")}</td>
                    <td className="text-end small">{formatMetricValue(snapshot.metrics.conversionValue, "currency")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {excelHasDuplicates && (
            <div className="alert alert-warning py-2 px-3 small" role="alert">
              {excelNoticeText}
            </div>
          )}

          <div className="d-flex gap-2">
            {excelHasDuplicates ? (
              <button type="button" className="btn btn-sm btn-warning" disabled={excelBusy} onClick={() => handleExcelCommit(true)}>
                {excelBusy ? "Importo…" : "Sostituisci e importa"}
              </button>
            ) : (
              <button type="button" className="btn btn-sm btn-primary" disabled={excelBusy} onClick={() => handleExcelCommit(false)}>
                {excelBusy ? "Importo…" : `Conferma e importa (${excelPreview.preview.snapshots.length} rilevazioni)`}
              </button>
            )}
            <button type="button" className="btn btn-sm btn-outline-secondary" disabled={excelBusy} onClick={cancelExcel}>
              Annulla
            </button>
          </div>
        </section>
      )}

      {loading && <p className="mb-0 text-muted small">Caricamento performance…</p>}

      {!loading && (
        <>
          {/* Filtro sorgente */}
          <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
            <span className="small text-muted me-1">Sorgente:</span>
            <button
              type="button"
              className={`btn btn-sm ${sourceFilter === "ALL" ? "btn-primary" : "btn-outline-secondary"}`}
              onClick={() => setSourceFilter("ALL")}
            >
              Tutte
            </button>
            {presentSources.map((source) => (
              <button
                type="button"
                key={source}
                className={`btn btn-sm ${sourceFilter === source ? "btn-primary" : "btn-outline-secondary"}`}
                onClick={() => setSourceFilter(source)}
              >
                {sourceShort(source)}
              </button>
            ))}
            <span className="small text-muted ms-auto">
              {filteredSnapshots.length} rilevazioni
            </span>
          </div>

          {/* Riepilogo (rapporti ricalcolati dai totali) */}
          <div className="d-flex align-items-baseline justify-content-between mb-2">
            <h6 className="mb-0">{summaryTitle}</h6>
            <span className="small text-muted">rapporti ricalcolati dai totali</span>
          </div>
          <div className="row g-2 mb-3">
            {HEADLINE_KEYS.map((key) => (
              <div className="col-6 col-xl-3" key={key}>
                <div className="border rounded-3 p-3 h-100">
                  <div className="small text-muted">{METRIC_DEF_BY_KEY[key]?.label || key}</div>
                  <div className="fs-4 fw-semibold">
                    {formatMetricValue(totals[key], METRIC_DEF_BY_KEY[key]?.format)}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {filteredSnapshots.length === 0 ? (
            <div className="border rounded-3 p-4 text-center">
              <p className="mb-1 fw-semibold">Nessuna rilevazione per questa vista.</p>
              <p className="mb-0 text-muted small">
                Usa “Aggiorna ora” su un connettore per registrare la prima fotografia dei dati.
              </p>
            </div>
          ) : (
            <>
              {/* Andamento storico */}
              <section className="border rounded-3 p-3 mb-3">
                <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
                  <div>
                    <h6 className="mb-0">Andamento</h6>
                    <div className="small text-muted">Per periodo, sorgenti combinate secondo il filtro.</div>
                  </div>
                  <div className="d-flex align-items-center gap-2">
                    <label className="small text-muted mb-0" htmlFor="trend-metric">Metrica</label>
                    <select
                      id="trend-metric"
                      className="form-select form-select-sm w-auto"
                      value={trendMetric}
                      onChange={(event) => setTrendMetric(event.target.value)}
                    >
                      {TREND_KEYS.map((key) => (
                        <option key={key} value={key}>{METRIC_DEF_BY_KEY[key]?.label || key}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="d-flex flex-column gap-2">
                  {trendRows.map((row) => (
                    <div className="d-flex align-items-center gap-2" key={`${row.periodStart}|${row.periodEnd}`}>
                      <div className="small text-muted text-truncate" style={{ width: "10rem", flex: "0 0 auto" }}>
                        {formatPeriod(row.periodStart, row.periodEnd)}
                      </div>
                      <div
                        className="rounded-pill bg-body-secondary flex-grow-1"
                        style={{ height: "0.5rem" }}
                        aria-hidden="true"
                      >
                        <div
                          className="rounded-pill bg-primary"
                          style={{ height: "0.5rem", width: `${Math.round((row.value / trendMax) * 100)}%` }}
                        />
                      </div>
                      <div className="small fw-semibold text-end" style={{ width: "8rem", flex: "0 0 auto" }}>
                        {formatMetricValue(row.value, METRIC_DEF_BY_KEY[trendMetric]?.format)}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Metriche mostrate: chip per famiglia + carne' */}
              <section className="border rounded-3 p-3 mb-3">
                <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-2">
                  <h6 className="mb-0">Metriche mostrate</h6>
                </div>
                <div className="d-flex flex-column gap-2 mb-3">
                  {METRIC_FAMILIES.map((family) => (
                    <div className="d-flex flex-wrap align-items-center gap-2" key={family.key}>
                      <span className="small text-muted" style={{ width: "6rem", flex: "0 0 auto" }}>
                        {family.label}
                      </span>
                      {METRIC_DEFS.filter((def) => def.family === family.key).map((def) => (
                        <button
                          type="button"
                          key={def.key}
                          className={`btn btn-sm ${selectedMetrics.includes(def.key) ? "btn-primary" : "btn-outline-secondary"}`}
                          onClick={() => toggleMetric(def.key)}
                        >
                          {def.label}
                        </button>
                      ))}
                    </div>
                  ))}
                </div>

                <div className="d-flex flex-wrap align-items-center gap-2">
                  <span className="small text-muted">Selezioni salvate:</span>
                  {metricSets.length === 0 && (
                    <span className="small text-muted fst-italic">nessuno salvato</span>
                  )}
                  {metricSets.map((metricSet) => (
                    <span
                      key={metricSet.id}
                      className={`btn btn-sm d-inline-flex align-items-center gap-2 ${activeSetId === metricSet.id ? "btn-primary" : "btn-outline-secondary"}`}
                    >
                      <span role="button" tabIndex={0} onClick={() => applySet(metricSet)} onKeyDown={(event) => { if (event.key === "Enter") applySet(metricSet); }}>
                        {metricSet.icon ? `${metricSet.icon} ` : ""}{metricSet.name}
                      </span>
                      <span role="button" tabIndex={0} aria-label="Rinomina" title="Rinomina" onClick={() => openRenameSet(metricSet)} onKeyDown={(event) => { if (event.key === "Enter") openRenameSet(metricSet); }}>✎</span>
                      <span role="button" tabIndex={0} aria-label="Elimina" title="Elimina" onClick={() => handleDeleteSet(metricSet)} onKeyDown={(event) => { if (event.key === "Enter") handleDeleteSet(metricSet); }}>×</span>
                    </span>
                  ))}
                  {!setForm.open && (
                    <button type="button" className="btn btn-sm btn-outline-primary" onClick={openCreateSet}>
                      + Salva selezione
                    </button>
                  )}
                  {setForm.open && (
                    <form className="d-flex align-items-center gap-2" onSubmit={submitSetForm}>
                      <input
                        type="text"
                        className="form-control form-control-sm w-auto"
                        placeholder={setForm.mode === "rename" ? "Nuovo nome" : "Nome del set"}
                        value={setForm.name}
                        onChange={(event) => setSetForm((current) => ({ ...current, name: event.target.value }))}
                        autoFocus
                      />
                      <button type="submit" className="btn btn-sm btn-primary">
                        {setForm.mode === "rename" ? "Rinomina" : "Salva"}
                      </button>
                      <button type="button" className="btn btn-sm btn-outline-secondary" onClick={closeSetForm}>
                        Annulla
                      </button>
                    </form>
                  )}
                </div>
              </section>

              {/* Storico */}
              <section className="border rounded-3 p-0">
                <div className="table-responsive">
                  <table className="table table-sm align-middle mb-0">
                    <thead>
                      <tr>
                        <th scope="col" className="small text-muted">Periodo</th>
                        <th scope="col" className="small text-muted">Sorgente</th>
                        {orderedSelected.map((def) => (
                          <th scope="col" key={def.key} className="small text-muted text-end">{def.label}</th>
                        ))}
                        <th scope="col" aria-label="Azioni" />
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSnapshots.map((snapshot) => (
                        <tr key={snapshot.id}>
                          <td>
                            <div className="small">{formatPeriod(snapshot.periodStart, snapshot.periodEnd)}</div>
                            {snapshot.contextEvent && (
                              <span className="badge text-bg-light border mt-1">{snapshot.contextEvent}</span>
                            )}
                          </td>
                          <td className="small">{sourceLabel(snapshot.source)}</td>
                          {orderedSelected.map((def) => (
                            <td key={def.key} className="text-end small">{formatMetric(snapshot.metrics, def.key)}</td>
                          ))}
                          <td className="text-end">
                            <button
                              type="button"
                              className="btn btn-sm btn-link text-danger p-0"
                              aria-label="Elimina rilevazione"
                              title="Elimina rilevazione"
                              onClick={() => handleDeleteSnapshot(snapshot.id)}
                            >
                              Elimina
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}
        </>
      )}
    </AgencyProjectPageTemplate>
  );
};

export default AgencyProjectPerformancePage;
