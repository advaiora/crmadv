import {
  buildAgencyAdsOperationalOutputV1,
  buildAgencyGoogleAdsOutputV1,
  buildAgencyMetaAdsOutputV1,
} from "../../../../../modules/agency-os/ads/agencyAdsRules";
import {
  applyFullAdsRegeneration,
  applyGeneratedGoogleAds,
  applyGeneratedMetaAds,
  applyGeneratedOperationalPlan,
} from "../adsDraftReducers";

// Generazione della bozza base (rule-based, senza AI): Google, Meta, piano
// operativo e rigenerazione controllata di tutto.
export const useAgencyProjectAdsDraftGeneration = ({
  adsState,
  setAdsState,
  setSaveMessage,
  setSaveError,
  setRuntimeMessage,
}) => {
  const announce = (message) => {
    setRuntimeMessage(message);
    setSaveMessage("");
    setSaveError("");
  };

  // I due canali condividono lo stesso contesto: quel che l'utente ha scritto
  // a mano vince sull'output Web, che a sua volta vince sulla Discovery.
  const buildChannelInput = () => ({
    projectTypeKey: adsState.input.projectType.key,
    discovery: adsState.input.discovery.sections,
    contextSummary: adsState.input.contextSummary,
    offerSummary: adsState.output.offerAngle || adsState.input.web.offerSummary || adsState.input.discovery.sections.offer,
    targetSummary: adsState.output.targetingSummary || adsState.input.web.targetSummary || adsState.input.discovery.sections.target,
    ctaPrimary: adsState.input.web.ctaPrimary,
    web: adsState.input.web,
  });

  const buildGoogleOutput = () => buildAgencyGoogleAdsOutputV1({
    ...buildChannelInput(),
    scopePurchased: adsState.input.scopePurchased,
  });

  const buildMetaOutput = () => buildAgencyMetaAdsOutputV1(buildChannelInput());

  const handleGenerateGoogleAds = () => {
    if (!adsState) {
      return;
    }

    const hasExistingGoogleOutput = Boolean(adsState.output.googleAds.campaignType)
      || adsState.output.googleAds.adGroups.length > 0
      || adsState.output.googleAds.keywordSeeds.length > 0;
    if (hasExistingGoogleOutput) {
      const shouldProceed = window.confirm(
        "Sovrascrivere l'output Google Ads corrente con una nuova bozza base?",
      );
      if (!shouldProceed) {
        return;
      }
    }

    const generated = buildGoogleOutput();
    setAdsState((current) => applyGeneratedGoogleAds(current, generated));
    announce("Bozza Google Ads generata dai dati disponibili. Verifica target, offerta, CTA e tracking prima del setup.");
  };

  const handleGenerateMetaAds = () => {
    if (!adsState) {
      return;
    }

    const hasExistingMetaOutput = Boolean(adsState.output.metaAds.campaignAngle)
      || adsState.output.metaAds.primaryTexts.length > 0
      || adsState.output.metaAds.assetRequests.length > 0;
    if (hasExistingMetaOutput) {
      const shouldProceed = window.confirm(
        "Sovrascrivere l'output Meta Ads corrente con una nuova bozza base?",
      );
      if (!shouldProceed) {
        return;
      }
    }

    const generated = buildMetaOutput();
    setAdsState((current) => applyGeneratedMetaAds(current, generated));
    announce("Bozza Meta Ads generata dai dati disponibili. Verifica audience, offerta, creativita e tracking prima del setup.");
  };

  const handleGenerateOperationalPlan = () => {
    if (!adsState) {
      return;
    }

    const generated = buildAgencyAdsOperationalOutputV1({
      channelScope: adsState.output.channelScope,
      projectTypeKey: adsState.input.projectType.key,
      discovery: adsState.input.discovery.sections,
      web: adsState.input.web,
      googleAds: adsState.output.googleAds,
      metaAds: adsState.output.metaAds,
      ctaPrimary: adsState.input.web.ctaPrimary,
    });

    setAdsState((current) => applyGeneratedOperationalPlan(current, generated));
    announce("Checklist e richieste asset generate dai dati Ads correnti.");
  };

  // A differenza delle due generazioni per canale, qui la conferma si chiede
  // SEMPRE, anche a output vuoto: comportamento originale, lasciato tale.
  const handleRegeneratePlaceholder = () => {
    if (!adsState) {
      return;
    }

    const shouldProceed = window.confirm(
      "Rigenerare sovrascrivera Google Ads, Meta Ads, checklist e asset requests correnti. Continuare?",
    );
    if (!shouldProceed) {
      return;
    }

    const googleOutput = buildGoogleOutput();
    const metaOutput = buildMetaOutput();
    // Il piano operativo si costruisce sugli output APPENA generati, non su
    // quelli ancora nello stato: e' il motivo per cui non si riusa l'handler.
    const operationalOutput = buildAgencyAdsOperationalOutputV1({
      channelScope: adsState.output.channelScope,
      projectTypeKey: adsState.input.projectType.key,
      discovery: adsState.input.discovery.sections,
      web: adsState.input.web,
      googleAds: googleOutput.googleAds,
      metaAds: metaOutput.metaAds,
      ctaPrimary: adsState.input.web.ctaPrimary,
    });

    setAdsState((current) => applyFullAdsRegeneration(current, { googleOutput, metaOutput, operationalOutput }));
    announce("Output Ads rigenerato: Google, Meta, checklist e asset requests aggiornati.");
  };

  return {
    handleGenerateGoogleAds,
    handleGenerateMetaAds,
    handleGenerateOperationalPlan,
    handleRegeneratePlaceholder,
  };
};

export default useAgencyProjectAdsDraftGeneration;
