import React from "react";
import { Button, Col, Row } from "react-bootstrap";
import { useParams } from "react-router-dom";
import AgencyProjectPageTemplate from "./AgencyProjectPageTemplate";
import AgencySourceReadinessPanel from "./AgencySourceReadinessPanel";
import { readableValue } from "./agencyProjectUx";
import AgencyInputQualityPanel from "./shared/AgencyInputQualityPanel";
import AgencyNextActionStrip from "./shared/AgencyNextActionStrip";
import AgencyStatusAlerts from "./shared/AgencyStatusAlerts";
import AgencyWorkflowSteps from "./shared/AgencyWorkflowSteps";
import WebGenerationActionsBar from "./web/WebGenerationActionsBar";
import WebGenerationContractPanel from "./web/WebGenerationContractPanel";
import WebGenerationOutputPanels from "./web/WebGenerationOutputPanels";
import WebPageSettingsCard from "./web/WebPageSettingsCard";
import WebSubProjectsCard from "./web/WebSubProjectsCard";
import { useAgencyProjectWeb } from "./web/hooks/useAgencyProjectWeb";
import { WEB_WORKFLOW_STEPS } from "./web/webPageConstants";

const AI_NOT_CONFIGURED_WARNING = "AI non configurata lato server. Puoi generare una bozza base, ma gli output saranno meno specifici.";

// Il passo successivo suggerito nella striscia in cima: prima si crea una
// pagina, poi si completano i dati, poi si rigenera o si salva.
const buildNextAction = (webProjects, missingInputs) => {
  if (!webProjects?.length) {
    return "Crea la prima landing o pagina da lavorare.";
  }
  if (missingInputs.length > 0) {
    return `Completa ${missingInputs.slice(0, 2).join(", ")} prima di consegnare.`;
  }
  return "Rigenera il blocco piu importante o salva l'output Web.";
};

const buildInputQualityFields = (input, output, usedSources) => [
  { label: "Tipo progetto", value: input.projectType.label },
  { label: "Contesto", value: readableValue(input.contextSummary) },
  { label: "Target", value: readableValue(input.discovery.sections.target) },
  { label: "Offerta", value: readableValue(input.discovery.sections.offer) },
  { label: "CTA", value: readableValue(output.ctaSet.primary, "CTA da completare") },
  {
    label: "Fonti usate",
    value: usedSources.length > 0 ? usedSources.join(", ") : "nessuna fonte cliente reale",
  },
];

const AgencyProjectWebPage = () => {
  const { projectId } = useParams();
  const web = useAgencyProjectWeb(projectId);

  if (web.loading || !web.webState) {
    return (
      <AgencyProjectPageTemplate
        title="Web"
        subtitle="Workspace per creare landing e pagine collegate a fonti, Brief e obiettivi progetto."
        dataMeta={web.dataMeta}
      >
        <p className="mb-0 text-muted small">Caricamento modulo Web...</p>
      </AgencyProjectPageTemplate>
    );
  }

  const { input, output, webMissingInputs, usedSources, aiEstimates } = web;

  return (
    <AgencyProjectPageTemplate
      title="Web"
      subtitle="Scegli una pagina, controlla la qualita input, genera una bozza e rivedi preview e copy."
      dataMeta={web.dataMeta}
    >
      <AgencySourceReadinessPanel readiness={web.project?.sourceReadiness} />

      <WebGenerationActionsBar
        lastGeneratedAt={output.lastGeneratedAt}
        lastUpdatedAt={web.webState.lastUpdatedAt}
        estimate={aiEstimates.byFunction["web.generateProject"]}
        aiConfigured={aiEstimates.aiConfigured}
        aiUnavailable={web.aiUnavailable}
        generatingAi={web.generatingAi}
        loading={web.loading}
        saving={web.saving}
        onGenerateAi={web.handleGenerateWithAi}
        onGenerateBaseDraft={web.handleRegenerateAll}
        onGenerateStructure={web.handleGenerateStructure}
        onGenerateCopy={web.handleGenerateCopy}
        onGenerateWireframe={web.handleGenerateWireframe}
        onGeneratePreview={web.handleGeneratePreview}
        onReload={web.loadWeb}
        onSave={web.handleSave}
      />

      <AgencyStatusAlerts
        error={web.saveError}
        success={web.saveMessage}
        info={web.generationMessage}
        warning={web.aiUnavailable ? AI_NOT_CONFIGURED_WARNING : ""}
      />

      <AgencyWorkflowSteps steps={WEB_WORKFLOW_STEPS} />

      <AgencyNextActionStrip message={buildNextAction(output.webProjects, webMissingInputs)}>
        <Button type="button" size="sm" variant="outline-primary" onClick={web.handleGenerateStructure}>
          Genera struttura base
        </Button>
        <Button type="button" size="sm" variant="primary" onClick={web.handleSave} disabled={web.saving}>
          {web.saving ? "Salvataggio..." : "Salva Web"}
        </Button>
      </AgencyNextActionStrip>

      <Row className="g-3">
        <Col lg={12}>
          <WebSubProjectsCard
            draft={web.webProjectDraft}
            onDraftChange={(field, value) => web.setWebProjectDraft((current) => ({ ...current, [field]: value }))}
            onAddWebProject={web.addWebProject}
            webProjects={output.webProjects}
            onUpdateStatus={web.updateWebProjectStatus}
            onUseAsActive={web.generateForWebProject}
            onGenerateAi={web.handleGenerateWithAi}
            generatingAi={web.generatingAi}
            aiUnavailable={web.aiUnavailable}
          />
        </Col>

        <Col lg={4}>
          <AgencyInputQualityPanel
            title="Qualita input"
            subtitle="Dati usati prima della generazione."
            fields={buildInputQualityFields(input, output, usedSources)}
            missingLabels={webMissingInputs}
            completeMessage="La pagina ha le informazioni minime per una generazione coerente."
          />
        </Col>

        <Col lg={8}>
          <WebPageSettingsCard
            output={output}
            onFieldChange={web.setOutputField}
            estimate={aiEstimates.byFunction["web.generateBlock"]}
            aiConfigured={aiEstimates.aiConfigured}
            generatingBlockKey={web.generatingBlockKey}
            aiBusy={web.generatingAi || web.aiUnavailable}
            onGenerateBlock={web.handleGenerateBlockWithAi}
          />
        </Col>
      </Row>

      <Row className="g-3 mt-1">
        <Col lg={12}>
          <WebGenerationContractPanel
            aiConfigured={web.aiStatus?.configured}
            missingLabels={webMissingInputs}
            usedSources={usedSources}
          />
        </Col>

        <WebGenerationOutputPanels output={output} />
      </Row>
    </AgencyProjectPageTemplate>
  );
};

export default AgencyProjectWebPage;
