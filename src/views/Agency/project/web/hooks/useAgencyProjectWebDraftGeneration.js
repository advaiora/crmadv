import {
  buildAgencyWebOutputV1,
  buildAgencyWebCopyBlocksV1,
  buildAgencyWebPreviewHtmlBaseV1,
  buildAgencyWebSectionPlanV1,
  buildAgencyWebWireframeV1,
} from "../../../../../modules/agency-os/web/agencyWebRules";
import {
  applyGeneratedCopy,
  applyGeneratedPreview,
  applyGeneratedStructure,
  applyGeneratedWireframe,
  applyRegeneratedOutput,
} from "../webDraftReducers";

// Generazione della bozza base (rule-based, senza AI): struttura, copy,
// wireframe, preview e rigenerazione completa. Ogni azione costruisce il pezzo
// coi builder condivisi e lo applica con il riduttore puro corrispondente.
export const useAgencyProjectWebDraftGeneration = ({
  webState,
  setWebState,
  setSaveMessage,
  setSaveError,
  setGenerationMessage,
}) => {
  // Ogni generazione azzera i messaggi di salvataggio: quello che si legge a
  // video deve riferirsi all'ultima azione fatta, non alla precedente.
  const announce = (message) => {
    setGenerationMessage(message);
    setSaveMessage("");
    setSaveError("");
  };

  const handleGenerateStructure = () => {
    if (!webState) {
      return;
    }

    const generatedSections = buildAgencyWebSectionPlanV1({
      projectTypeKey: webState.input.projectType.key,
      scopePurchased: webState.input.scopePurchased,
      targetSummary: webState.output.targetSummary || webState.input.discovery.sections.target,
      offerSummary: webState.output.offerSummary || webState.input.discovery.sections.offer,
      ctaPrimary: webState.output.ctaSet.primary,
      pageType: webState.output.pageType,
    });

    setWebState((current) => applyGeneratedStructure(current, generatedSections));
    announce("Struttura pagina generata come bozza base. Verifica fonti, target e offerta prima di usarla con il cliente.");
  };

  const handleGenerateCopy = () => {
    if (!webState) {
      return;
    }

    const generatedCopy = buildAgencyWebCopyBlocksV1({
      projectTypeKey: webState.input.projectType.key,
      pageGoal: webState.output.pageGoal || webState.input.discovery.sections.projectGoal,
      targetSummary: webState.output.targetSummary || webState.input.discovery.sections.target,
      offerSummary: webState.output.offerSummary || webState.input.discovery.sections.offer,
      valueProp: webState.output.valueProp,
      ctaPrimary: webState.output.ctaSet.primary,
      discovery: webState.input.discovery.sections,
    });

    setWebState((current) => applyGeneratedCopy(current, generatedCopy));
    announce("Copy base generato dai dati disponibili. Completa Discovery e Fonti per renderlo piu specifico.");
  };

  const handleGenerateWireframe = () => {
    if (!webState) {
      return;
    }

    const wireframe = buildAgencyWebWireframeV1({
      sectionPlan: webState.output.sectionPlan,
      copyBlocks: webState.output.copyBlocks,
      ctaSet: webState.output.ctaSet,
    });

    setWebState((current) => applyGeneratedWireframe(current, wireframe));
    announce("Wireframe testuale generato dal section plan corrente.");
  };

  const handleGeneratePreview = () => {
    if (!webState) {
      return;
    }

    const previewHtmlBase = buildAgencyWebPreviewHtmlBaseV1({
      sectionPlan: webState.output.sectionPlan,
      copyBlocks: webState.output.copyBlocks,
      ctaSet: webState.output.ctaSet,
      faqItems: webState.output.faqItems,
      trustElements: webState.output.trustElements,
    });

    setWebState((current) => applyGeneratedPreview(current, previewHtmlBase));
    announce("Preview base generata dal contenuto corrente.");
  };

  const handleRegenerateAll = () => {
    if (!webState) {
      return;
    }

    // La rigenerazione completa sovrascrive tutto: se c'e' gia' del lavoro
    // fatto si chiede conferma prima di buttarlo.
    const hasGeneratedOutput = webState.output.sectionPlan.length > 0
      || Boolean(webState.output.copyBlocks.headline)
      || Boolean(webState.output.previewHtmlBase);
    if (hasGeneratedOutput) {
      const shouldProceed = window.confirm(
        "Rigenerare sovrascrivera struttura/copy/wireframe/preview correnti. Continuare?",
      );
      if (!shouldProceed) {
        return;
      }
    }

    const generatedOutput = buildAgencyWebOutputV1({
      projectTypeKey: webState.input.projectType.key,
      scopePurchased: webState.input.scopePurchased,
      pageType: webState.output.pageType,
      pageGoal: webState.output.pageGoal || webState.input.discovery.sections.projectGoal || webState.input.contextSummary,
      targetSummary: webState.output.targetSummary || webState.input.discovery.sections.target,
      offerSummary: webState.output.offerSummary || webState.input.discovery.sections.offer,
      valueProp: webState.output.valueProp,
      ctaPrimary: webState.output.ctaSet.primary,
      discovery: webState.input.discovery.sections,
    });

    setWebState((current) => applyRegeneratedOutput(current, generatedOutput));
    announce("Bozza Web rigenerata: struttura, copy, wireframe e preview sono stati aggiornati dai dati disponibili.");
  };

  return {
    handleGenerateStructure,
    handleGenerateCopy,
    handleGenerateWireframe,
    handleGeneratePreview,
    handleRegenerateAll,
  };
};

export default useAgencyProjectWebDraftGeneration;
