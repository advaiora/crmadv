import React from "react";
import { Alert, Badge, Button, Card, Col, Form, Row, Spinner, Table } from "react-bootstrap";
import { Link, useParams } from "react-router-dom";
import { useDropzone } from "react-dropzone";
import {
  deleteAgencyProjectSourceFile,
  fetchAgencyProjectSourceFileBlob,
  getAgencyProjectSources,
  saveAgencyProjectSources,
  searchAgencyProjectCompetitors,
  uploadAgencyProjectSourceFile,
} from "../../../modules/agency-os/data/agencyDataAdapter";
import { readAgencyDataMeta } from "../../../modules/agency-os/data/agencyDataSource";
import AgencyProjectPageTemplate from "./AgencyProjectPageTemplate";

const EMPTY_FILE = {
  name: "",
  type: "",
  notes: "",
};

const EMPTY_COMPETITOR = {
  name: "",
  url: "",
  reason: "",
};

const STATUS_VARIANT = {
  missing: "danger",
  partial: "warning",
  ready: "success",
};

const FILE_STATUS_VARIANT = {
  uploaded: "success",
  parsed: "info",
  partial: "warning",
  failed: "danger",
  metadata_only: "secondary",
  queued: "secondary",
  uploading: "primary",
};

const ALLOWED_EXTENSIONS_TEXT = "PDF, DOC, DOCX, TXT, CSV, XLSX, PNG, JPG, JPEG";
const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;
const URL_TYPE_OPTIONS = [
  { value: "website", label: "Sito principale" },
  { value: "landing", label: "Landing" },
  { value: "service_page", label: "Pagina servizio" },
  { value: "instagram", label: "Instagram" },
  { value: "facebook", label: "Facebook" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "youtube", label: "YouTube" },
  { value: "tiktok", label: "TikTok" },
  { value: "google_business", label: "Google Business Profile" },
  { value: "other", label: "Altro link utile" },
];

const formatFileSize = (bytes) => {
  const size = Number(bytes || 0);
  if (size >= 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }
  if (size >= 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }
  return `${size} byte`;
};

const getFriendlyFileStatus = (status) => {
  if (status === "uploaded") {
    return "Caricato";
  }
  if (status === "queued") {
    return "In coda";
  }
  if (status === "uploading") {
    return "Caricamento";
  }
  if (status === "failed") {
    return "Errore";
  }
  if (status === "parsed") {
    return "Letto correttamente";
  }
  return "File registrato, contenuto non ancora analizzato";
};

const getFriendlyParseStatus = (file) => {
  if (file.parseStatus === "parsed" || file.status === "parsed") {
    return file.parseStatus === "partial" ? "Letto parzialmente" : "Letto correttamente";
  }
  if (file.parseStatus === "partial") {
    return "Letto parzialmente";
  }
  if (file.parseStatus === "unsupported") {
    return "Formato non leggibile";
  }
  if (file.parseStatus === "failed") {
    return "Lettura non riuscita";
  }
  if (file.status === "metadata_only") {
    return "File registrato, contenuto non ancora analizzato";
  }
  return "Contenuto non letto";
};

const COMPETITOR_STATUS_VARIANT = {
  confirmed: "success",
  suggested: "warning",
  rejected: "secondary",
};

const SOURCE_STATUS_LABEL = {
  missing: "Fonti da completare",
  partial: "Fonti parziali",
  ready: "Fonti pronte",
};

const COMPETITOR_SOURCE_LABEL = {
  manual: "Manuale",
  auto_search: "Ricerca automatica",
  ai_search: "Ricerca AI",
  imported: "Importato",
  mock: "Bozza non reale",
};

const COMPETITOR_STATUS_LABEL = {
  confirmed: "Confermato",
  suggested: "Suggerito",
  rejected: "Rifiutato",
};

const splitCompetitorUrls = (value) => String(value || "")
  .split(/\r?\n|,/)
  .map((entry) => entry.trim())
  .filter(Boolean);

const createId = (prefix) => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

const deriveNameFromUrl = (url) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch (_error) {
    return url;
  }
};

const getUrlTypeLabel = (type) => URL_TYPE_OPTIONS.find((entry) => entry.value === type)?.label || "Link utile";

const isValidHttpUrl = (value) => {
  try {
    const parsed = new URL(String(value || "").trim());
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch (_error) {
    return false;
  }
};

const getInvalidUrlLabels = (urls, competitorUrls = []) => {
  const invalidProjectUrls = (urls || [])
    .filter((entry) => entry?.url && !isValidHttpUrl(entry.url))
    .map((entry) => entry.label || entry.url);
  const invalidCompetitorUrls = (competitorUrls || [])
    .filter((entry) => entry && !isValidHttpUrl(entry))
    .map((entry) => `Competitor: ${entry}`);

  return [...invalidProjectUrls, ...invalidCompetitorUrls];
};

const getFriendlyCompetitorSearchMessage = (result) => {
  const rawMessage = String(result?.message || "").trim();
  if (result?.providerStatus === "configured_error") {
    return rawMessage || "Ricerca online configurata, ma il servizio non ha risposto correttamente. Verifica chiave, modello e limiti API in Impostazioni Agency.";
  }
  if (result?.providerStatus === "configured_timeout") {
    return rawMessage || "La ricerca online ha richiesto troppo tempo. Riprova tra poco o scegli un modello piu veloce in Impostazioni Agency.";
  }
  if (result?.providerStatus === "configured" && !result?.realSearch) {
    return rawMessage || "Ricerca competitor configurata lato server.";
  }
  if (!result?.realSearch) {
    return "Ricerca automatica non configurata. Puoi inserire competitor manualmente oppure configurare la ricerca online in Impostazioni Agency.";
  }
  return rawMessage || "Ricerca competitor completata.";
};

const getCompetitorSearchAlertTitle = (result) => {
  if (result?.realSearch) {
    return "Ricerca automatica completata.";
  }
  if (result?.providerStatus === "configured_error") {
    return "Ricerca non riuscita.";
  }
  if (result?.providerStatus === "configured_timeout") {
    return "Ricerca interrotta per timeout.";
  }
  if (result?.providerStatus === "configured") {
    return "Ricerca configurata.";
  }
  return "Ricerca automatica non configurata.";
};

const getCompetitorSearchAlertVariant = (result) => {
  if (result?.realSearch) {
    return "info";
  }
  if (result?.providerStatus === "configured_error") {
    return "danger";
  }
  if (result?.providerStatus === "configured_timeout") {
    return "warning";
  }
  if (result?.providerStatus === "configured") {
    return "success";
  }
  return "warning";
};

const getFriendlySourcesError = (error, fallback) => {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("Invalid Agency project sources payload")) {
    return "Salvataggio fonti non riuscito: alcuni dati non sono nel formato previsto. Controlla URL, file e competitor, poi riprova.";
  }
  return message || fallback;
};

const mergeCompetitorsFromUrls = (competitors, urls) => {
  const merged = [];
  const seen = new Set();

  for (const competitor of competitors || []) {
    if (!competitor?.url) {
      continue;
    }
    const key = competitor.url.trim().toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(competitor);
    }
  }

  for (const url of urls) {
    const key = url.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      merged.push({
        id: createId("cmp"),
        name: deriveNameFromUrl(url),
        url,
        source: "manual",
        status: "confirmed",
        reason: "Inserito da URL manuale.",
        addedAt: new Date().toISOString(),
      });
    }
  }

  return merged;
};

const AgencyProjectAssetsPage = () => {
  const { projectId } = useParams();
  const [sources, setSources] = React.useState(null);
  const [competitorUrlsText, setCompetitorUrlsText] = React.useState("");
  const [fileDraft, setFileDraft] = React.useState(EMPTY_FILE);
  const [competitorDraft, setCompetitorDraft] = React.useState(EMPTY_COMPETITOR);
  const [uploadQueue, setUploadQueue] = React.useState([]);
  const [competitorSearch, setCompetitorSearch] = React.useState(null);
  const [dataMeta, setDataMeta] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [fileActionId, setFileActionId] = React.useState("");
  const [searching, setSearching] = React.useState(false);
  const [message, setMessage] = React.useState("");
  const [error, setError] = React.useState("");

  const loadSources = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const nextSources = await getAgencyProjectSources(projectId);
      setSources(nextSources);
      setCompetitorUrlsText((nextSources.competitorUrls || []).join("\n"));
      setDataMeta(readAgencyDataMeta(nextSources));
    } catch (loadError) {
      setError(getFriendlySourcesError(loadError, "Impossibile caricare le fonti progetto."));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  React.useEffect(() => {
    void loadSources();
  }, [loadSources]);

  const updateSourceField = (key, value) => {
    setSources((current) => ({
      ...(current || {}),
      [key]: value,
    }));
  };

  const updateUrlSource = (urlId, patch) => {
    setSources((current) => ({
      ...(current || {}),
      urls: (current?.urls || []).map((entry) => (
        entry.id === urlId ? { ...entry, ...patch } : entry
      )),
    }));
  };

  const addUrlSource = () => {
    setSources((current) => ({
      ...(current || {}),
      urls: [
        ...((current?.urls || [])),
        {
          id: createId("url"),
          label: "Link utile",
          type: "other",
          url: "",
          status: "active",
          notes: "",
          addedAt: new Date().toISOString(),
        },
      ],
    }));
  };

  const removeUrlSource = (urlId) => {
    setSources((current) => {
      const nextUrls = (current?.urls || []).filter((entry) => entry.id !== urlId);
      const primaryWebsiteUrl = current?.primaryWebsiteUrl && nextUrls.some((entry) => entry.url === current.primaryWebsiteUrl)
        ? current.primaryWebsiteUrl
        : nextUrls.find((entry) => entry.type === "website" && entry.status !== "ignored")?.url || nextUrls.find((entry) => entry.status !== "ignored")?.url || "";
      return {
        ...(current || {}),
        urls: nextUrls,
        primaryWebsiteUrl,
        websiteUrl: primaryWebsiteUrl,
      };
    });
  };

  const setPrimaryUrlSource = (urlEntry) => {
    const url = String(urlEntry?.url || "").trim();
    if (!url) {
      setError("Inserisci l'URL prima di impostarlo come sito principale.");
      return;
    }
    setSources((current) => ({
      ...(current || {}),
      primaryWebsiteUrl: url,
      websiteUrl: url,
      urls: (current?.urls || []).map((entry) => (
        entry.id === urlEntry.id ? { ...entry, type: "website", status: "active" } : entry
      )),
    }));
  };

  const addFileMetadata = () => {
    if (!fileDraft.name.trim()) {
      setError("Inserisci almeno il nome file per aggiungere metadata.");
      return;
    }

    setError("");
    setSources((current) => ({
      ...(current || {}),
      uploadedFiles: [
        ...((current?.uploadedFiles || [])),
        {
          id: createId("file"),
          name: fileDraft.name.trim(),
          type: fileDraft.type.trim(),
          size: 0,
          status: "metadata_only",
          source: "manual_upload",
          notes: fileDraft.notes.trim(),
        },
      ],
    }));
    setFileDraft(EMPTY_FILE);
  };

  const removeFile = async (file) => {
    if (file.storagePath) {
      setSaving(true);
      setError("");
      try {
        const saved = await deleteAgencyProjectSourceFile(projectId, file.id);
        setSources(saved);
        setCompetitorUrlsText((saved.competitorUrls || []).join("\n"));
        setDataMeta(readAgencyDataMeta(saved));
        setMessage("File caricato rimosso.");
      } catch (removeError) {
        setError(removeError instanceof Error ? removeError.message : "Rimozione file non riuscita.");
      } finally {
        setSaving(false);
      }
      return;
    }

    setSources((current) => ({
      ...(current || {}),
      uploadedFiles: (current?.uploadedFiles || []).filter((entry) => entry.id !== file.id),
    }));
  };

  const updateFileMetadata = (fileId, patch) => {
    setSources((current) => ({
      ...(current || {}),
      uploadedFiles: (current?.uploadedFiles || []).map((entry) => (
        entry.id === fileId ? { ...entry, ...patch } : entry
      )),
    }));
  };

  const openOrDownloadFile = async (file, download = false) => {
    if (!file.storagePath) {
      setError("Questo materiale e registrato solo come metadata: non c'e un file da aprire.");
      return;
    }

    setFileActionId(`${file.id}:${download ? "download" : "open"}`);
    setError("");
    try {
      const result = await fetchAgencyProjectSourceFileBlob(projectId, file.id, { download });
      const objectUrl = URL.createObjectURL(result.blob);
      if (download) {
        const anchor = document.createElement("a");
        anchor.href = objectUrl;
        anchor.download = result.filename || file.originalName || file.name;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
      } else {
        window.open(objectUrl, "_blank", "noopener,noreferrer");
      }
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
    } catch (fileError) {
      setError(fileError instanceof Error ? fileError.message : "File non apribile.");
    } finally {
      setFileActionId("");
    }
  };

  const onDrop = React.useCallback((acceptedFiles, rejectedFiles) => {
    const nextAccepted = acceptedFiles.map((file) => ({
      id: createId("upload"),
      file,
      name: file.name,
      size: file.size,
      status: "queued",
      error: "",
    }));
    const nextRejected = rejectedFiles.map((rejected) => ({
      id: createId("upload"),
      file: rejected.file,
      name: rejected.file.name,
      size: rejected.file.size,
      status: "failed",
      error: rejected.errors?.[0]?.code === "file-too-large"
        ? "Il file supera 20 MB."
        : `Formato non supportato. Usa ${ALLOWED_EXTENSIONS_TEXT}.`,
    }));

    setUploadQueue((current) => [...current, ...nextAccepted, ...nextRejected]);
    setError("");
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: true,
    maxSize: MAX_FILE_SIZE_BYTES,
    accept: {
      "application/pdf": [".pdf"],
      "application/msword": [".doc"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
      "text/plain": [".txt"],
      "text/csv": [".csv"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "image/png": [".png"],
      "image/jpeg": [".jpg", ".jpeg"],
    },
  });

  const uploadQueuedFiles = async () => {
    const queuedFiles = uploadQueue.filter((entry) => entry.status === "queued" && entry.file);
    if (queuedFiles.length === 0) {
      setError("Aggiungi almeno un file valido alla coda di upload.");
      return;
    }

    setUploading(true);
    setError("");
    setMessage("");
    try {
      for (const queueItem of queuedFiles) {
        setUploadQueue((current) => current.map((entry) => (
          entry.id === queueItem.id ? { ...entry, status: "uploading", error: "" } : entry
        )));
        try {
          await uploadAgencyProjectSourceFile(projectId, queueItem.file);
          setUploadQueue((current) => current.map((entry) => (
            entry.id === queueItem.id ? { ...entry, status: "uploaded", error: "" } : entry
          )));
        } catch (uploadError) {
          setUploadQueue((current) => current.map((entry) => (
            entry.id === queueItem.id
              ? {
                  ...entry,
                  status: "failed",
                  error: uploadError instanceof Error ? uploadError.message : "Upload non riuscito.",
                }
              : entry
          )));
        }
      }
      await loadSources();
      setMessage("Upload completato. TXT, CSV, PDF e DOCX vengono letti quando il parsing riesce; gli altri file restano materiali allegati.");
    } finally {
      setUploading(false);
    }
  };

  const addManualCompetitor = () => {
    const url = competitorDraft.url.trim();
    if (!url) {
      setError("Inserisci almeno l'URL competitor.");
      return;
    }

    setError("");
    setSources((current) => ({
      ...(current || {}),
      competitors: mergeCompetitorsFromUrls([
        ...((current?.competitors || [])),
        {
          id: createId("cmp"),
          name: competitorDraft.name.trim() || deriveNameFromUrl(url),
          url,
          source: "manual",
          status: "confirmed",
          reason: competitorDraft.reason.trim() || "Inserito manualmente.",
          addedAt: new Date().toISOString(),
        },
      ], []),
    }));
    setCompetitorDraft(EMPTY_COMPETITOR);
  };

  const addSuggestedCompetitor = (suggestion) => {
    const url = String(suggestion?.url || "").trim();
    if (!url) {
      return;
    }

    setError("");
    setSources((current) => ({
      ...(current || {}),
      competitors: mergeCompetitorsFromUrls([
        ...((current?.competitors || [])),
        {
          id: suggestion.id || createId("cmp_ai"),
          name: String(suggestion.name || "").trim() || deriveNameFromUrl(url),
          url,
          source: suggestion.source || "ai_search",
          status: "confirmed",
          reason: String(suggestion.reason || "").trim() || "Confermato da suggerimento AI.",
          addedAt: suggestion.addedAt || new Date().toISOString(),
        },
      ], current?.competitorUrls || []),
    }));
    setMessage("Competitor aggiunto alla lista. Salva le fonti per renderlo permanente.");
  };

  const updateCompetitorStatus = (competitorId, status) => {
    setSources((current) => ({
      ...(current || {}),
      competitors: (current?.competitors || []).map((entry) => (
        entry.id === competitorId ? { ...entry, status } : entry
      )),
    }));
  };

  const removeCompetitor = (competitorId) => {
    setSources((current) => ({
      ...(current || {}),
      competitors: (current?.competitors || []).filter((entry) => entry.id !== competitorId),
    }));
  };

  const runCompetitorSearch = async () => {
    setSearching(true);
    setError("");
    setMessage("");
    try {
      const result = await searchAgencyProjectCompetitors(projectId);
      setCompetitorSearch(result);
      setMessage(getFriendlyCompetitorSearchMessage(result));
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : "Ricerca competitor non riuscita.");
    } finally {
      setSearching(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const competitorUrls = splitCompetitorUrls(competitorUrlsText);
      const urls = (sources?.urls || [])
        .map((entry) => ({
          ...entry,
          label: String(entry?.label || "").trim() || getUrlTypeLabel(entry?.type),
          url: String(entry?.url || "").trim(),
          notes: String(entry?.notes || "").trim(),
          status: entry?.status === "ignored" ? "ignored" : "active",
        }))
        .filter((entry) => entry.url);
      const primaryWebsiteUrl = String(sources?.primaryWebsiteUrl || sources?.websiteUrl || "").trim();
      const resolvedPrimaryUrl = primaryWebsiteUrl && urls.some((entry) => entry.url === primaryWebsiteUrl)
        ? primaryWebsiteUrl
        : urls.find((entry) => entry.type === "website" && entry.status === "active")?.url || urls.find((entry) => entry.status === "active")?.url || "";
      const invalidUrlLabels = getInvalidUrlLabels(urls, competitorUrls);
      if (invalidUrlLabels.length > 0) {
        setError(`Controlla questi URL prima di salvare: ${invalidUrlLabels.slice(0, 4).join(", ")}. Usa link completi, ad esempio https://cliente.it.`);
        return;
      }
      const saved = await saveAgencyProjectSources(projectId, {
        ...sources,
        urls,
        primaryWebsiteUrl: resolvedPrimaryUrl,
        websiteUrl: resolvedPrimaryUrl,
        competitorUrls,
        competitors: mergeCompetitorsFromUrls(sources?.competitors || [], competitorUrls),
      });
      setSources(saved);
      setCompetitorUrlsText((saved.competitorUrls || []).join("\n"));
      setDataMeta(readAgencyDataMeta(saved));
      setMessage("Fonti progetto aggiornate e ricaricabili.");
    } catch (saveError) {
      setError(getFriendlySourcesError(saveError, "Salvataggio fonti non riuscito."));
    } finally {
      setSaving(false);
    }
  };

  if (loading || !sources) {
    return (
      <AgencyProjectPageTemplate
        title="Fonti e Materiali"
        subtitle="URL, brief e materiali usati dai moduli Agency."
        dataMeta={dataMeta}
      >
        <p className="mb-0 text-muted small">Caricamento fonti progetto...</p>
      </AgencyProjectPageTemplate>
    );
  }

  const status = sources.sourceStatus || "missing";
  const competitors = sources.competitors || [];
  const uploadedFiles = sources.uploadedFiles || [];
  const competitorSearchSuggestions = Array.isArray(competitorSearch?.suggestions)
    ? competitorSearch.suggestions
    : [];

  return (
    <AgencyProjectPageTemplate
      title="Fonti e Materiali"
      subtitle="URL, note, file e competitor usati come base dai moduli Agency."
      dataMeta={dataMeta}
    >
      <div className="d-flex justify-content-between align-items-start gap-2 mb-3">
        <div>
          <Badge bg={STATUS_VARIANT[status] || "secondary"} className="mb-2">
            Qualita delle fonti: {SOURCE_STATUS_LABEL[status] || status}
          </Badge>
          <p className="mb-0 text-muted small">{sources.sourceSummary}</p>
        </div>
        <div className="d-flex gap-2">
          <Button size="sm" variant="outline-secondary" onClick={loadSources} disabled={loading || saving}>
            Ricarica
          </Button>
          <Button size="sm" variant="primary" onClick={handleSave} disabled={saving}>
            {saving ? <><Spinner animation="border" size="sm" className="me-2" />Salvataggio...</> : "Aggiorna fonti"}
          </Button>
        </div>
      </div>

      {status === "missing" && (
        <Alert variant="danger">
          Nessuna fonte cliente reale registrata. Aggiungi almeno URL, note, file o competitor prima di usare gli output come base operativa.
        </Alert>
      )}
      {status === "partial" && (
        <Alert variant="warning">
          Fonti parziali: gli output saranno bozze basate sui dati disponibili.
        </Alert>
      )}
      {message && <Alert variant="info" role="status">{message}</Alert>}
      {error && <Alert variant="warning" role="alert">{error}</Alert>}

      <div className="agency-workflow-steps">
        <div className="agency-workflow-step">
          <div className="small fw-semibold">
            <span className="agency-workflow-step-number">1</span>Registra link
          </div>
          <div className="small text-muted mt-1">Sito, landing, social e pagine servizio.</div>
        </div>
        <div className="agency-workflow-step">
          <div className="small fw-semibold">
            <span className="agency-workflow-step-number">2</span>Carica materiali
          </div>
          <div className="small text-muted mt-1">File letti quando possibile, oppure testo manuale collegato.</div>
        </div>
        <div className="agency-workflow-step">
          <div className="small fw-semibold">
            <span className="agency-workflow-step-number">3</span>Conferma competitor
          </div>
          <div className="small text-muted mt-1">Solo competitor manuali o trovati davvero online.</div>
        </div>
      </div>

      <Row className="g-3">
        <Col lg={12}>
          <div className="agency-action-strip">
            <div>
              <strong>Prossima azione:</strong>{" "}
              {status === "ready"
                ? "Rigenera Discovery o passa a Web/Ads con fonti aggiornate."
                : "Completa almeno URL principale, note iniziali e un materiale o competitor confermato."}
            </div>
            <div className="d-flex flex-wrap gap-2">
              <Button size="sm" variant="outline-primary" onClick={addUrlSource}>
                Aggiungi URL
              </Button>
              <Button size="sm" variant="outline-primary" onClick={runCompetitorSearch} disabled={searching}>
                {searching
                  ? <><Spinner animation="border" size="sm" className="me-2" />Ricerca...</>
                  : <><i className="bi bi-stars me-1" aria-hidden="true" />Cerca competitor</>}
              </Button>
              <Button as={Link} to={`/agency/projects/${encodeURIComponent(projectId)}/discovery`} size="sm" variant="primary">
                Apri Discovery
              </Button>
            </div>
          </div>
        </Col>

        <Col lg={6}>
          <Card className="card-border h-100">
            <Card.Body>
              <div className="d-flex justify-content-between align-items-start gap-2 mb-3">
                <div>
                  <h6 className="mb-1">URL progetto</h6>
                  <p className="small text-muted mb-0">Aggiungi sito, landing, pagine servizio e canali social usati come riferimento.</p>
                </div>
                <Button size="sm" variant="outline-primary" onClick={addUrlSource}>
                  Aggiungi URL
                </Button>
              </div>

              {(sources.urls || []).length === 0 && (
                <Alert variant="light" className="border small">
                  Nessun URL registrato. Aggiungi almeno il sito principale o una landing.
                </Alert>
              )}

              <div className="agency-record-list mb-3">
                {(sources.urls || []).map((entry) => {
                  const isPrimary = entry.url && (entry.url === sources.primaryWebsiteUrl || entry.url === sources.websiteUrl);
                  return (
                    <div key={entry.id} className="agency-record-row">
                      <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
                        <Badge bg={isPrimary ? "primary" : "secondary"}>
                          {isPrimary ? "Sito principale" : getUrlTypeLabel(entry.type)}
                        </Badge>
                        <div className="d-flex gap-2">
                          <Button size="sm" variant="outline-primary" onClick={() => setPrimaryUrlSource(entry)}>
                            Imposta principale
                          </Button>
                          <Button size="sm" variant="outline-danger" onClick={() => removeUrlSource(entry.id)}>
                            Rimuovi
                          </Button>
                        </div>
                      </div>
                      <Row className="g-2">
                        <Col md={5}>
                          <Form.Label className="small mb-1">URL</Form.Label>
                          <Form.Control
                            size="sm"
                            value={entry.url || ""}
                            onChange={(event) => updateUrlSource(entry.id, { url: event.target.value })}
                            placeholder="https://www.cliente.it"
                          />
                        </Col>
                        <Col md={3}>
                          <Form.Label className="small mb-1">Tipo</Form.Label>
                          <Form.Select
                            size="sm"
                            value={entry.type || "other"}
                            onChange={(event) => updateUrlSource(entry.id, {
                              type: event.target.value,
                              label: entry.label || getUrlTypeLabel(event.target.value),
                            })}
                          >
                            {URL_TYPE_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                          </Form.Select>
                        </Col>
                        <Col md={4}>
                          <Form.Label className="small mb-1">Etichetta</Form.Label>
                          <Form.Control
                            size="sm"
                            value={entry.label || ""}
                            onChange={(event) => updateUrlSource(entry.id, { label: event.target.value })}
                            placeholder={getUrlTypeLabel(entry.type)}
                          />
                        </Col>
                        <Col md={8}>
                          <Form.Label className="small mb-1">Note URL</Form.Label>
                          <Form.Control
                            size="sm"
                            value={entry.notes || ""}
                            onChange={(event) => updateUrlSource(entry.id, { notes: event.target.value })}
                            placeholder="Esempio: landing attuale, pagina servizio prioritaria, profilo social attivo."
                          />
                        </Col>
                        <Col md={4}>
                          <Form.Label className="small mb-1">Stato</Form.Label>
                          <Form.Select
                            size="sm"
                            value={entry.status || "active"}
                            onChange={(event) => updateUrlSource(entry.id, { status: event.target.value })}
                          >
                            <option value="active">Registrato</option>
                            <option value="ignored">Non usare negli output</option>
                          </Form.Select>
                          <div className="small text-muted mt-1">
                            Link registrato come fonte. Non viene dichiarato come analizzato finche non attivi una lettura reale del contenuto.
                          </div>
                        </Col>
                      </Row>
                    </div>
                  );
                })}
              </div>

              <Form.Group>
                <Form.Label>Competitor URL rapidi</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={5}
                  value={competitorUrlsText}
                  onChange={(event) => setCompetitorUrlsText(event.target.value)}
                  placeholder="Uno per riga oppure separati da virgola"
                />
                <div className="small text-muted mt-2">
                  Verranno salvati come competitor manuali confermati.
                </div>
              </Form.Group>
            </Card.Body>
          </Card>
        </Col>

        <Col lg={6}>
          <Card className="card-border h-100">
            <Card.Body>
              <h6 className="mb-3">Brief grezzo / note</h6>
              <Form.Control
                as="textarea"
                rows={10}
                value={sources.manualNotes || ""}
                onChange={(event) => updateSourceField("manualNotes", event.target.value)}
                placeholder="Appunti call, contesto cliente, vincoli, materiali ricevuti."
              />
            </Card.Body>
          </Card>
        </Col>

        <Col lg={12}>
          <Card className="card-border">
            <Card.Body>
              <div className="d-flex justify-content-between align-items-start gap-2 mb-3">
                <div>
                  <h6 className="mb-1">File progetto</h6>
                  <p className="small text-muted mb-0">
                    Trascina uno o piu file. TXT, CSV, PDF e DOCX vengono letti quando il testo e estraibile; immagini, XLSX e DOC restano allegati consultabili.
                  </p>
                </div>
              </div>

              <div
                {...getRootProps({
                  className: `border rounded-3 p-4 text-center mb-3 ${isDragActive ? "border-primary bg-light" : "bg-white"}`,
                })}
                style={{ cursor: "pointer" }}
              >
                <input {...getInputProps()} />
                <div className="fw-semibold">
                  {isDragActive ? "Rilascia i file qui" : "Trascina qui i file o clicca per selezionarli"}
                </div>
                <div className="small text-muted mt-1">
                  Formati: {ALLOWED_EXTENSIONS_TEXT}. Dimensione massima: 20 MB per file.
                </div>
              </div>

              {uploadQueue.length > 0 && (
                <div className="border rounded-3 p-2 mb-3">
                  <div className="d-flex justify-content-between align-items-center gap-2 mb-2">
                    <div className="small fw-semibold">File in coda</div>
                    <div className="d-flex gap-2">
                      <Button
                        size="sm"
                        variant="outline-secondary"
                        onClick={() => setUploadQueue([])}
                        disabled={uploading}
                      >
                        Pulisci coda
                      </Button>
                      <Button
                        size="sm"
                        variant="outline-primary"
                        onClick={uploadQueuedFiles}
                        disabled={uploading || !uploadQueue.some((entry) => entry.status === "queued")}
                      >
                        {uploading ? <><Spinner animation="border" size="sm" className="me-2" />Caricamento...</> : "Carica file in coda"}
                      </Button>
                    </div>
                  </div>
                  <div className="d-flex flex-column gap-2">
                    {uploadQueue.map((entry) => (
                      <div key={entry.id} className="d-flex justify-content-between align-items-start gap-2 border rounded-3 p-2">
                        <div>
                          <div className="small fw-semibold">{entry.name}</div>
                          <div className="small text-muted">{formatFileSize(entry.size)}</div>
                          {entry.error && <div className="small text-danger">{entry.error}</div>}
                        </div>
                        <Badge bg={FILE_STATUS_VARIANT[entry.status] || "secondary"}>
                          {getFriendlyFileStatus(entry.status)}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="row g-2 mb-3">
                <div className="col-12 col-md-4">
                  <Form.Label className="small mb-1">Nome materiale senza upload</Form.Label>
                  <Form.Control
                    value={fileDraft.name}
                    onChange={(event) => setFileDraft((current) => ({ ...current, name: event.target.value }))}
                    placeholder="Nome materiale senza upload"
                  />
                </div>
                <div className="col-12 col-md-3">
                  <Form.Label className="small mb-1">Tipo materiale</Form.Label>
                  <Form.Control
                    value={fileDraft.type}
                    onChange={(event) => setFileDraft((current) => ({ ...current, type: event.target.value }))}
                    placeholder="Tipo, es. PDF/DOCX"
                  />
                </div>
                <div className="col-12 col-md-4">
                  <Form.Label className="small mb-1">Note contenuto</Form.Label>
                  <Form.Control
                    value={fileDraft.notes}
                    onChange={(event) => setFileDraft((current) => ({ ...current, notes: event.target.value }))}
                    placeholder="Note contenuto"
                  />
                </div>
                <div className="col-12 col-md-1 d-grid align-items-end">
                  <Button type="button" variant="outline-secondary" onClick={addFileMetadata}>
                    Registra
                  </Button>
                </div>
              </div>

              <div className="d-flex flex-column gap-2" role="list" aria-label="File allegati al progetto">
                {uploadedFiles.map((file) => (
                  <div key={file.id} className="agency-record-row" role="listitem">
                    <div className="flex-grow-1">
                      <div className="small fw-semibold">{file.name}</div>
                      <div className="small text-muted">
                        {file.mimeType || file.type || "tipo non specificato"} | {formatFileSize(file.size)} | {file.notes || "Nessuna nota"}
                      </div>
                      <div className="small text-muted mt-1">
                        Stato lettura: {getFriendlyParseStatus(file)}
                        {file.extractedTextLength ? ` | ${file.extractedTextLength} caratteri estratti` : ""}
                        {file.parseError ? ` | ${file.parseError}` : ""}
                      </div>
                      {file.extractedTextPreview && (
                        <details className="small mt-2">
                          <summary className="text-muted">Anteprima testo estratto</summary>
                          <div className="bg-light border rounded-3 p-2 mt-1" style={{ whiteSpace: "pre-wrap" }}>
                            {file.extractedTextPreview.slice(0, 700)}
                            {file.extractedTextPreview.length > 700 ? "..." : ""}
                          </div>
                        </details>
                      )}
                      {["failed", "unsupported", "not_parsed", "partial"].includes(file.parseStatus) && (
                        <details className="small mt-2">
                          <summary className="text-muted">Aggiungi testo manuale da questo file</summary>
                          <Form.Control
                            as="textarea"
                            rows={4}
                            className="mt-2"
                            value={file.manualText || ""}
                            onChange={(event) => updateFileMetadata(file.id, { manualText: event.target.value, markedUseful: Boolean(event.target.value.trim()) })}
                            placeholder="Incolla qui testo, punti chiave o brief presenti nel file. Verranno usati come fonte manuale."
                          />
                          <Form.Check
                            className="mt-2"
                            checked={Boolean(file.markedUseful)}
                            onChange={(event) => updateFileMetadata(file.id, { markedUseful: event.target.checked })}
                            label="Marca come fonte utile anche se il contenuto non e stato letto automaticamente"
                          />
                        </details>
                      )}
                    </div>
                    <div className="d-flex align-items-center gap-2">
                      <Badge bg={FILE_STATUS_VARIANT[file.parseStatus] || FILE_STATUS_VARIANT[file.status] || "secondary"}>
                        {getFriendlyParseStatus(file)}
                      </Badge>
                      <Button
                        size="sm"
                        variant="outline-secondary"
                        onClick={() => openOrDownloadFile(file, false)}
                        disabled={!file.storagePath || fileActionId === `${file.id}:open`}
                      >
                        {fileActionId === `${file.id}:open` ? "Apertura..." : "Apri"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline-secondary"
                        onClick={() => openOrDownloadFile(file, true)}
                        disabled={!file.storagePath || fileActionId === `${file.id}:download`}
                      >
                        {fileActionId === `${file.id}:download` ? "Download..." : "Scarica"}
                      </Button>
                      <Button size="sm" variant="outline-danger" onClick={() => removeFile(file)}>
                        Rimuovi
                      </Button>
                    </div>
                  </div>
                ))}
                {uploadedFiles.length === 0 && (
                  <div className="agency-empty-state small">
                    <strong>Nessun file registrato.</strong> Carica file reali oppure registra un materiale senza upload.
                  </div>
                )}
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col lg={12}>
          <Card className="card-border">
            <Card.Body>
              <div className="d-flex justify-content-between align-items-start gap-2 mb-3">
                <div>
                  <h6 className="mb-1">Competitor</h6>
                  <p className="small text-muted mb-0">
                    Aggiungi competitor manualmente oppure usa la ricerca automatica quando e attiva in Impostazioni Agency.
                  </p>
                </div>
                <Button size="sm" variant="outline-primary" onClick={runCompetitorSearch} disabled={searching}>
                  {searching
                    ? <><Spinner animation="border" size="sm" className="me-2" />Ricerca...</>
                    : <><i className="bi bi-stars me-1" aria-hidden="true" />Cerca competitor</>}
                </Button>
              </div>

              {competitorSearch && (
                <Alert variant={getCompetitorSearchAlertVariant(competitorSearch)}>
                  <strong>{getCompetitorSearchAlertTitle(competitorSearch)}</strong>{" "}
                  {getFriendlyCompetitorSearchMessage(competitorSearch)}
                </Alert>
              )}

              {competitorSearchSuggestions.length > 0 && (
                <div className="border rounded p-3 mb-3 bg-light">
                  <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
                    <div>
                      <div className="fw-semibold small">Suggerimenti trovati online</div>
                      <div className="small text-muted">Conferma solo i competitor pertinenti: verranno aggiunti alle fonti progetto.</div>
                    </div>
                    <Badge bg="info">Ricerca AI</Badge>
                  </div>
                  <div className="d-grid gap-2">
                    {competitorSearchSuggestions.map((suggestion) => (
                      <div key={suggestion.id || suggestion.url} className="d-flex flex-column flex-md-row justify-content-between gap-2 border rounded p-2 bg-white">
                        <div>
                          <div className="fw-semibold small">{suggestion.name || deriveNameFromUrl(suggestion.url)}</div>
                          <a className="small" href={suggestion.url} target="_blank" rel="noreferrer">{suggestion.url}</a>
                          {suggestion.reason && <div className="small text-muted mt-1">{suggestion.reason}</div>}
                          {typeof suggestion.confidence === "number" && (
                            <div className="small text-muted">Affidabilita suggerimento: {Math.round(suggestion.confidence * 100)}%</div>
                          )}
                        </div>
                        <div className="d-flex align-items-start gap-2">
                          <Button size="sm" variant="outline-success" onClick={() => addSuggestedCompetitor(suggestion)}>
                            Conferma
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="row g-2 mb-3">
                <div className="col-12 col-md-3">
                  <Form.Control
                    value={competitorDraft.name}
                    onChange={(event) => setCompetitorDraft((current) => ({ ...current, name: event.target.value }))}
                    placeholder="Nome competitor"
                  />
                </div>
                <div className="col-12 col-md-4">
                  <Form.Control
                    value={competitorDraft.url}
                    onChange={(event) => setCompetitorDraft((current) => ({ ...current, url: event.target.value }))}
                    placeholder="https://competitor.it"
                  />
                </div>
                <div className="col-12 col-md-4">
                  <Form.Control
                    value={competitorDraft.reason}
                    onChange={(event) => setCompetitorDraft((current) => ({ ...current, reason: event.target.value }))}
                    placeholder="Motivo / contesto"
                  />
                </div>
                <div className="col-12 col-md-1 d-grid">
                  <Button type="button" variant="outline-primary" onClick={addManualCompetitor}>
                    Aggiungi
                  </Button>
                </div>
              </div>

              <Table responsive size="sm" className="mb-0 align-middle">
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>URL</th>
                    <th>Fonte</th>
                    <th>Stato</th>
                    <th>Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {competitors.map((competitor) => (
                    <tr key={competitor.id}>
                      <td>
                        <div className="fw-semibold small">{competitor.name}</div>
                        {competitor.reason && <div className="small text-muted">{competitor.reason}</div>}
                      </td>
                      <td className="small">{competitor.url}</td>
                      <td>
                        <Badge bg={competitor.source === "manual" ? "secondary" : "warning"}>
                          {COMPETITOR_SOURCE_LABEL[competitor.source] || "Fonte esterna"}
                        </Badge>
                      </td>
                      <td>
                        <Badge bg={COMPETITOR_STATUS_VARIANT[competitor.status] || "secondary"}>
                          {COMPETITOR_STATUS_LABEL[competitor.status] || competitor.status}
                        </Badge>
                      </td>
                      <td>
                        <div className="d-flex gap-2">
                          <Button size="sm" variant="outline-success" onClick={() => updateCompetitorStatus(competitor.id, "confirmed")}>
                            Conferma
                          </Button>
                          <Button size="sm" variant="outline-secondary" onClick={() => updateCompetitorStatus(competitor.id, "rejected")}>
                            Rifiuta
                          </Button>
                          <Button size="sm" variant="outline-danger" onClick={() => removeCompetitor(competitor.id)}>
                            Rimuovi
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {competitors.length === 0 && (
                    <tr>
                      <td colSpan={5} className="small text-muted">
                        Nessun competitor strutturato. Aggiungili manualmente o configura la ricerca online in Impostazioni Agency.
                      </td>
                    </tr>
                  )}
                </tbody>
              </Table>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </AgencyProjectPageTemplate>
  );
};

export default AgencyProjectAssetsPage;
