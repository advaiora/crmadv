import React from "react";
import { Alert, Button, Col, Row, Spinner } from "react-bootstrap";
import { Link, useParams } from "react-router-dom";
import ProjectAiSourcesPanel from "../../../modules/sources/ui/ProjectAiSourcesPanel";
import AgencyProjectPageTemplate from "./AgencyProjectPageTemplate";
import AgencyNextActionStrip from "./shared/AgencyNextActionStrip";
import AgencyWorkflowSteps from "./shared/AgencyWorkflowSteps";
import AssetsActionsBar from "./assets/AssetsActionsBar";
import AssetsCompetitorsCard from "./assets/AssetsCompetitorsCard";
import AssetsFilesCard from "./assets/AssetsFilesCard";
import AssetsNotesCard from "./assets/AssetsNotesCard";
import AssetsSourceStatusAlert from "./assets/AssetsSourceStatusAlert";
import AssetsUrlsCard from "./assets/AssetsUrlsCard";
import { useAgencyProjectAssets } from "./assets/hooks/useAgencyProjectAssets";
import { ASSETS_WORKFLOW_STEPS } from "./assets/assetsPageConstants";

// Il passo successivo suggerito nella striscia in cima. A differenza delle due
// pagine sorelle qui i rami sono due, non tre: o le fonti bastano, o no.
const buildNextAction = (status) => (
  status === "ready"
    ? "Rigenera il Brief o passa a Contenuti Web / Campagne ADS con fonti aggiornate."
    : "Completa almeno URL principale, note iniziali e un materiale o competitor confermato."
);

const AgencyProjectAssetsPage = () => {
  const { projectId } = useParams();
  const assets = useAgencyProjectAssets(projectId);

  if (assets.loading || !assets.sources) {
    return (
      <AgencyProjectPageTemplate
        title="Fonti"
        subtitle="URL, brief e materiali usati dai moduli AI del progetto."
        dataMeta={assets.dataMeta}
      >
        <p className="mb-0 text-muted small">Caricamento fonti progetto...</p>
      </AgencyProjectPageTemplate>
    );
  }

  const { sources, status } = assets;

  return (
    <AgencyProjectPageTemplate
      title="Fonti"
      subtitle="URL, note, file e competitor usati come base dai moduli AI del progetto."
      dataMeta={assets.dataMeta}
    >
      <AssetsActionsBar
        status={status}
        summary={sources.sourceSummary}
        loading={assets.loading}
        saving={assets.saving}
        onReload={assets.loadSources}
        onSave={assets.handleSave}
      />

      <AssetsSourceStatusAlert status={status} />

      {/* Questi due non passano dal pannello condiviso `shared/AgencyStatusAlerts`:
          li' l'errore viene prima dell'informazione, qui e' il contrario, e
          possono comparire insieme. Uniformare le tre pagine sorelle e' una
          decisione annotata in roadmap, sotto la V7, non roba da fare dentro
          un giro di riordino. */}
      {assets.message && <Alert variant="info" role="status">{assets.message}</Alert>}
      {assets.error && <Alert variant="warning" role="alert">{assets.error}</Alert>}

      <AgencyWorkflowSteps steps={ASSETS_WORKFLOW_STEPS} />

      <Row className="g-3">
        <Col lg={12}>
          <AgencyNextActionStrip message={buildNextAction(status)} className="agency-action-strip">
            <Button size="sm" variant="outline-primary" onClick={assets.addUrlSource}>
              Aggiungi URL
            </Button>
            <Button size="sm" variant="outline-primary" onClick={assets.runCompetitorSearch} disabled={assets.searching}>
              {assets.searching
                ? <><Spinner animation="border" size="sm" className="me-2" />Ricerca...</>
                : <><i className="bi bi-stars me-1" aria-hidden="true" />Cerca competitor</>}
            </Button>
            <Button as={Link} to={`/agency/projects/${encodeURIComponent(projectId)}/discovery`} size="sm" variant="primary">
              Apri il Brief
            </Button>
          </AgencyNextActionStrip>
        </Col>

        <Col lg={12}>
          <ProjectAiSourcesPanel projectId={projectId} />
        </Col>

        <Col lg={6}>
          <AssetsUrlsCard
            urls={sources.urls}
            primaryWebsiteUrl={sources.primaryWebsiteUrl}
            websiteUrl={sources.websiteUrl}
            onAddUrl={assets.addUrlSource}
            onUpdateUrl={assets.updateUrlSource}
            onRemoveUrl={assets.removeUrlSource}
            onSetPrimaryUrl={assets.setPrimaryUrlSource}
            competitorUrlsText={assets.competitorUrlsText}
            onCompetitorUrlsTextChange={assets.setCompetitorUrlsText}
          />
        </Col>

        <Col lg={6}>
          <AssetsNotesCard
            notes={sources.manualNotes}
            onNotesChange={(value) => assets.updateSourceField("manualNotes", value)}
          />
        </Col>

        <Col lg={12}>
          <AssetsFilesCard
            getRootProps={assets.getRootProps}
            getInputProps={assets.getInputProps}
            isDragActive={assets.isDragActive}
            uploadQueue={assets.uploadQueue}
            uploading={assets.uploading}
            onUploadQueuedFiles={assets.uploadQueuedFiles}
            onClearQueue={assets.clearUploadQueue}
            fileDraft={assets.fileDraft}
            onFileDraftChange={(field, value) => assets.setFileDraft((current) => ({ ...current, [field]: value }))}
            onAddFileMetadata={assets.addFileMetadata}
            uploadedFiles={assets.uploadedFiles}
            fileActionId={assets.fileActionId}
            onUpdateFileMetadata={assets.updateFileMetadata}
            onOpenOrDownloadFile={assets.openOrDownloadFile}
            onRemoveFile={assets.removeFile}
          />
        </Col>

        <Col lg={12}>
          <AssetsCompetitorsCard
            competitors={assets.competitorRoster}
            searchResult={assets.competitorSearch}
            suggestions={assets.competitorSearchSuggestions}
            searching={assets.searching}
            onRunSearch={assets.runCompetitorSearch}
            onConfirmSuggestion={assets.addSuggestedCompetitor}
            draft={assets.competitorDraft}
            onDraftChange={(field, value) => assets.setCompetitorDraft((current) => ({ ...current, [field]: value }))}
            onAddManual={assets.addManualCompetitor}
            onUpdateStatus={assets.updateCompetitorStatus}
            onRemove={assets.removeCompetitor}
          />
        </Col>
      </Row>
    </AgencyProjectPageTemplate>
  );
};

export default AgencyProjectAssetsPage;
