import React from "react";
import { Alert, Button, Form, Spinner } from "react-bootstrap";
import { useHistory, Link } from "react-router-dom";
import { listClients } from "../../modules/clients/ui/clientApi";
import { createAgencyProject } from "../../modules/agency-os/data/agencyDataAdapter";
import {
  AGENCY_PROJECT_PRIORITY_OPTIONS,
  AGENCY_PROJECT_SCOPE_OPTIONS,
  AGENCY_PROJECT_TYPE_OPTIONS,
  createEmptyAgencyProjectScope,
} from "../../modules/agency-os/projects/agencyProjectsModel";
import AgencyPageShell from "./AgencyPageShell";

const DEFAULT_FORM_STATE = {
  name: "",
  clientId: "",
  clientName: "",
  projectType: "website",
  goal: "",
  priorityAgency: "MEDIUM",
  scopePurchased: createEmptyAgencyProjectScope(),
  websiteUrl: "",
  competitorUrlsText: "",
  manualNotes: "",
  hasMaterialsToAttach: false,
  fileName: "",
  fileType: "",
  fileNotes: "",
};

const SOURCE_REQUIRED_PROJECT_TYPES = new Set([
  "website",
  "landing_page",
  "google_ads",
  "meta_ads",
  "google_meta_ads",
  "local_ads",
  "ecommerce",
]);

const normalizeCompetitorUrls = (value) => String(value || "")
  .split(/\r?\n|,/)
  .map((entry) => entry.trim())
  .filter(Boolean);

const AgencyProjectNewPage = () => {
  const history = useHistory();
  const [formState, setFormState] = React.useState(DEFAULT_FORM_STATE);
  const [clients, setClients] = React.useState([]);
  const [clientsLoading, setClientsLoading] = React.useState(true);
  const [clientsError, setClientsError] = React.useState("");
  const [submitError, setSubmitError] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    setClientsLoading(true);
    setClientsError("");

    listClients({
      page: 1,
      pageSize: 100,
      sort: "name",
    })
      .then((result) => {
        if (!cancelled) {
          setClients(Array.isArray(result?.items) ? result.items : []);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setClients([]);
          setClientsError(error?.message || "Impossibile caricare i clienti.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setClientsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const onScopeToggle = (scopeKey) => {
    setFormState((current) => ({
      ...current,
      scopePurchased: {
        ...current.scopePurchased,
        [scopeKey]: !current.scopePurchased[scopeKey],
      },
    }));
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setSubmitError("");

    if (!formState.name.trim()) {
      setSubmitError("Il nome progetto e obbligatorio.");
      return;
    }

    if (!formState.goal.trim()) {
      setSubmitError("L'obiettivo del progetto e obbligatorio.");
      return;
    }

    const competitorUrls = normalizeCompetitorUrls(formState.competitorUrlsText);
    const uploadedFiles = formState.fileName.trim()
      ? [{
          id: `file_${Date.now()}`,
          name: formState.fileName.trim(),
          type: formState.fileType.trim(),
          size: 0,
          status: "metadata_only",
          source: "manual_upload",
          notes: formState.fileNotes.trim(),
        }]
      : [];
    const hasRealSource = Boolean(
      formState.websiteUrl.trim()
      || formState.manualNotes.trim()
      || uploadedFiles.length > 0,
    );
    if (SOURCE_REQUIRED_PROJECT_TYPES.has(formState.projectType) && !hasRealSource) {
      const shouldProceed = window.confirm(
        "Non hai inserito URL, brief o materiali. Il progetto verra creato, ma le bozze saranno basate su dati incompleti. Continuare?",
      );
      if (!shouldProceed) {
        return;
      }
    }

    setSubmitting(true);
    try {
      const project = await createAgencyProject({
        name: formState.name.trim(),
        clientId: formState.clientId || undefined,
        clientName: formState.clientId ? undefined : formState.clientName.trim() || undefined,
        projectType: formState.projectType,
        goal: formState.goal.trim(),
        priorityAgency: formState.priorityAgency,
        scopePurchased: formState.scopePurchased,
        websiteUrl: formState.websiteUrl.trim(),
        competitorUrls,
        uploadedFiles,
        manualNotes: formState.manualNotes.trim(),
        hasMaterialsToAttach: formState.hasMaterialsToAttach,
      });

      history.push(`/agency/projects/${encodeURIComponent(project.id)}/overview`);
    } catch (error) {
      setSubmitError(error?.message || "Impossibile creare il progetto Agency.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AgencyPageShell
      title="Nuovo progetto Agency"
      subtitle="Creazione operativa del progetto base prima di entrare nei moduli AI."
      breadcrumbs={[
        { label: "Dashboard", to: "/dashboard" },
        { label: "Agency", to: "/agency/projects" },
        { label: "Nuovo progetto" },
      ]}
    >
      <div className="d-flex justify-content-end mb-3">
        <Button as={Link} to="/agency/projects" variant="outline-secondary" size="sm">
          Torna alla lista
        </Button>
      </div>

      {submitError && (
        <Alert variant="danger" className="mb-3">
          {submitError}
        </Alert>
      )}

      <Form onSubmit={onSubmit}>
        <div className="row g-3">
          <div className="col-12 col-lg-6">
            <Form.Group>
              <Form.Label>Nome progetto</Form.Label>
              <Form.Control
                value={formState.name}
                onChange={(event) => setFormState((current) => ({ ...current, name: event.target.value }))}
                placeholder="Es. Funnel lead generation Q2"
                disabled={submitting}
                required
              />
            </Form.Group>
          </div>

          <div className="col-12 col-lg-6">
            <Form.Group>
              <Form.Label>Cliente esistente</Form.Label>
              <Form.Select
                value={formState.clientId}
                onChange={(event) => setFormState((current) => ({ ...current, clientId: event.target.value }))}
                disabled={submitting || clientsLoading}
              >
                <option value="">Nessun cliente collegato</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </Form.Select>
              {clientsLoading && <div className="small text-muted mt-1">Caricamento clienti...</div>}
              {clientsError && <div className="small text-danger mt-1">{clientsError}</div>}
            </Form.Group>
          </div>

          <div className="col-12 col-lg-6">
            <Form.Group>
              <Form.Label>Nome cliente libero</Form.Label>
              <Form.Control
                value={formState.clientName}
                onChange={(event) => setFormState((current) => ({ ...current, clientName: event.target.value }))}
                placeholder="Usato solo come riferimento, se non selezioni un cliente"
                disabled={submitting || Boolean(formState.clientId)}
              />
              <div className="small text-muted mt-1">
                Il CRM collega solo clienti esistenti; il nome libero resta nel brief/fonti.
              </div>
            </Form.Group>
          </div>

          <div className="col-12 col-lg-6">
            <Form.Group>
              <Form.Label>Tipo progetto</Form.Label>
              <Form.Select
                value={formState.projectType}
                onChange={(event) => setFormState((current) => ({ ...current, projectType: event.target.value }))}
                disabled={submitting}
              >
                {AGENCY_PROJECT_TYPE_OPTIONS.map((entry) => (
                  <option key={entry.key} value={entry.key}>
                    {entry.label}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
          </div>

          <div className="col-12 col-lg-6">
            <Form.Group>
              <Form.Label>Priorita</Form.Label>
              <Form.Select
                value={formState.priorityAgency}
                onChange={(event) => setFormState((current) => ({ ...current, priorityAgency: event.target.value }))}
                disabled={submitting}
              >
                {AGENCY_PROJECT_PRIORITY_OPTIONS.map((entry) => (
                  <option key={entry.value} value={entry.value}>
                    {entry.label}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
          </div>

          <div className="col-12">
            <Form.Group>
              <Form.Label>Obiettivo progetto</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                value={formState.goal}
                onChange={(event) => setFormState((current) => ({ ...current, goal: event.target.value }))}
                placeholder="Es. Generare lead qualificati con funnel e campagne coordinate."
                disabled={submitting}
                required
              />
            </Form.Group>
          </div>

          <div className="col-12 col-lg-6">
            <Form.Group>
              <Form.Label>Website URL</Form.Label>
              <Form.Control
                value={formState.websiteUrl}
                onChange={(event) => setFormState((current) => ({ ...current, websiteUrl: event.target.value }))}
                placeholder="https://www.cliente.it"
                disabled={submitting}
              />
            </Form.Group>
          </div>

          <div className="col-12 col-lg-6">
            <Form.Group>
              <Form.Label>Competitor URL opzionali</Form.Label>
              <Form.Control
                as="textarea"
                rows={2}
                value={formState.competitorUrlsText}
                onChange={(event) => setFormState((current) => ({ ...current, competitorUrlsText: event.target.value }))}
                placeholder="Uno per riga oppure separati da virgola"
                disabled={submitting}
              />
            </Form.Group>
          </div>

          <div className="col-12">
            <Form.Group>
              <Form.Label>Note iniziali / brief grezzo</Form.Label>
              <Form.Control
                as="textarea"
                rows={4}
                value={formState.manualNotes}
                onChange={(event) => setFormState((current) => ({ ...current, manualNotes: event.target.value }))}
                placeholder="Appunti call, richiesta cliente, vincoli, informazioni su offerta e target."
                disabled={submitting}
              />
            </Form.Group>
          </div>

          <div className="col-12">
            <Form.Label className="mb-2">Scope acquistato</Form.Label>
            <div className="row g-2">
              {AGENCY_PROJECT_SCOPE_OPTIONS.map((entry) => (
                <div key={entry.key} className="col-12 col-md-6 col-xl-4">
                  <Form.Check
                    id={`agency-scope-${entry.key}`}
                    type="checkbox"
                    label={entry.label}
                    checked={Boolean(formState.scopePurchased[entry.key])}
                    onChange={() => onScopeToggle(entry.key)}
                    disabled={submitting}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="col-12">
            <Form.Check
              id="agency-has-materials"
              type="checkbox"
              label="Ho materiale da allegare"
              checked={formState.hasMaterialsToAttach}
              onChange={(event) => setFormState((current) => ({ ...current, hasMaterialsToAttach: event.target.checked }))}
              disabled={submitting}
            />
          </div>

          {formState.hasMaterialsToAttach && (
            <div className="col-12">
              <div className="border rounded-3 p-3">
                <div className="fw-semibold small mb-2">Metadata file (placeholder, nessun parsing/OCR)</div>
                <div className="row g-2">
                  <div className="col-12 col-md-4">
                    <Form.Control
                      value={formState.fileName}
                      onChange={(event) => setFormState((current) => ({ ...current, fileName: event.target.value }))}
                      placeholder="Nome file, es. brand-deck.pdf"
                      disabled={submitting}
                    />
                  </div>
                  <div className="col-12 col-md-3">
                    <Form.Control
                      value={formState.fileType}
                      onChange={(event) => setFormState((current) => ({ ...current, fileType: event.target.value }))}
                      placeholder="Tipo, es. PDF"
                      disabled={submitting}
                    />
                  </div>
                  <div className="col-12 col-md-5">
                    <Form.Control
                      value={formState.fileNotes}
                      onChange={(event) => setFormState((current) => ({ ...current, fileNotes: event.target.value }))}
                      placeholder="Note contenuto"
                      disabled={submitting}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {SOURCE_REQUIRED_PROJECT_TYPES.has(formState.projectType)
            && !formState.websiteUrl.trim()
            && !formState.manualNotes.trim()
            && !formState.fileName.trim() && (
              <div className="col-12">
                <Alert variant="warning" className="mb-0">
                  Il progetto verra creato, ma le bozze saranno basate su dati incompleti finche non aggiungi URL, brief o materiali.
                </Alert>
              </div>
            )}

          <div className="col-12">
            <div className="d-flex flex-wrap gap-2 justify-content-end">
              <Button type="button" variant="outline-secondary" onClick={() => history.push("/agency/projects")} disabled={submitting}>
                Annulla
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? (
                  <>
                    <Spinner animation="border" size="sm" className="me-2" />
                    Creazione...
                  </>
                ) : (
                  "Crea progetto"
                )}
              </Button>
            </div>
          </div>
        </div>
      </Form>
    </AgencyPageShell>
  );
};

export default AgencyProjectNewPage;
