import React from "react";
import { Button, Col, Row } from "react-bootstrap";
import { useParams } from "react-router-dom";
import AgencyProjectPageTemplate from "./AgencyProjectPageTemplate";
import AgencySourceReadinessPanel from "./AgencySourceReadinessPanel";
import AgencyNextActionStrip from "./shared/AgencyNextActionStrip";
import AgencyStatusAlerts from "./shared/AgencyStatusAlerts";
import AgencyWorkflowSteps from "./shared/AgencyWorkflowSteps";
import AdsCampaignsCard from "./ads/AdsCampaignsCard";
import AdsGenerationActionsBar from "./ads/AdsGenerationActionsBar";
import AdsInputCompletenessBanner from "./ads/AdsInputCompletenessBanner";
import AdsInputQualityPanel from "./ads/AdsInputQualityPanel";
import AdsOutputPanels from "./ads/AdsOutputPanels";
import AdsSettingsCard from "./ads/AdsSettingsCard";
import { useAgencyProjectAds } from "./ads/hooks/useAgencyProjectAds";
import { ADS_WORKFLOW_STEPS } from "./ads/adsPageConstants";

// Il passo successivo suggerito nella striscia in cima: prima si crea una
// campagna, poi si completano i dati, poi si generano gli asset o si salva.
const buildNextAction = (adsProjects, missingLabels) => {
  if (!adsProjects?.length) {
    return "Crea la prima campagna Ads collegata al progetto.";
  }
  if (missingLabels.length > 0) {
    return `Completa ${missingLabels.slice(0, 2).join(", ")} prima del setup.`;
  }
  return "Genera asset specifici o salva la campagna.";
};

const AgencyProjectAdsPage = () => {
  const { projectId } = useParams();
  const ads = useAgencyProjectAds(projectId);

  if (ads.loading || !ads.adsState) {
    return (
      <AgencyProjectPageTemplate
        title="Ads"
        subtitle="Workspace campagne per Google, Meta e checklist operative."
        dataMeta={ads.dataMeta}
      >
        <p className="mb-0 text-muted small">Caricamento modulo Ads...</p>
      </AgencyProjectPageTemplate>
    );
  }

  const { input, output, completeness, linkedLanding, aiEstimates } = ads;

  return (
    <AgencyProjectPageTemplate
      title="Ads"
      subtitle="Crea campagne collegate a landing, brief, target e offerta."
      dataMeta={ads.dataMeta}
    >
      <AgencySourceReadinessPanel readiness={ads.project?.sourceReadiness} />

      <AdsGenerationActionsBar
        lastGeneratedAt={output.lastGeneratedAt}
        lastUpdatedAt={ads.adsState.lastUpdatedAt}
        loading={ads.loading}
        saving={ads.saving}
        generatingAssetKey={ads.generatingAssetKey}
        aiUnavailable={ads.aiUnavailable}
        estimate={aiEstimates.byFunction["ads.generateAsset"]}
        aiConfigured={aiEstimates.aiConfigured}
        onGenerateGoogle={ads.handleGenerateGoogleAds}
        onGenerateMeta={ads.handleGenerateMetaAds}
        onGenerateOperational={ads.handleGenerateOperationalPlan}
        onRegenerateAll={ads.handleRegeneratePlaceholder}
        onGenerateAsset={ads.handleGenerateAdsAssetWithAi}
        onReload={ads.loadAds}
        onSave={ads.handleSave}
      />

      {/* Ads non ha l'avviso persistente "AI non configurata" che sta in cima
          alla pagina Web: qui la stessa informazione arriva come messaggio
          informativo quando si prova a rigenerare un asset. */}
      <AgencyStatusAlerts
        error={ads.saveError}
        success={ads.saveMessage}
        info={ads.runtimeMessage}
        warning=""
      />

      <AdsInputCompletenessBanner
        tone={completeness.tone}
        label={completeness.label}
        missing={completeness.missing}
      />

      <AgencyWorkflowSteps steps={ADS_WORKFLOW_STEPS} />

      <AgencyNextActionStrip message={buildNextAction(output.adsProjects, completeness.missing)}>
        <Button type="button" size="sm" variant="outline-primary" onClick={ads.handleGenerateOperationalPlan}>
          Genera checklist
        </Button>
        <Button type="button" size="sm" variant="primary" onClick={ads.handleSave} disabled={ads.saving}>
          {ads.saving ? "Salvataggio..." : "Salva Ads"}
        </Button>
      </AgencyNextActionStrip>

      <Row className="g-3">
        <Col lg={12}>
          <AdsCampaignsCard
            draft={ads.adsProjectDraft}
            onDraftChange={(field, value) => ads.setAdsProjectDraft((current) => ({ ...current, [field]: value }))}
            onAddAdsProject={ads.addAdsProject}
            adsProjects={output.adsProjects}
            webProjects={ads.webProjects}
            onUpdateStatus={ads.updateAdsProjectStatus}
            onOpenCampaign={ads.generateForAdsProject}
          />
        </Col>

        <Col lg={4}>
          <AdsInputQualityPanel input={input} linkedLanding={linkedLanding} />
        </Col>

        <Col lg={8}>
          <AdsSettingsCard
            output={output}
            onFieldChange={ads.setOutputField}
            ctaPrimary={input.web.ctaPrimary}
            linkedLanding={linkedLanding}
          />
        </Col>
      </Row>

      <Row className="g-3 mt-1">
        <AdsOutputPanels
          output={output}
          input={input}
          completenessLabel={completeness.label}
          onFieldChange={ads.setOutputField}
        />
      </Row>
    </AgencyProjectPageTemplate>
  );
};

export default AgencyProjectAdsPage;
