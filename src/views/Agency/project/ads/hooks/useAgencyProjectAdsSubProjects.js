import React from "react";
import { EMPTY_ADS_PROJECT_DRAFT } from "../adsPageConstants";

// Le campagne del progetto ("sub-progetti Ads"): bozza del form di creazione,
// aggiunta, cambio di stato e uso di una campagna come contesto corrente.
export const useAgencyProjectAdsSubProjects = ({
  setAdsState,
  setSaveError,
  setRuntimeMessage,
}) => {
  const [adsProjectDraft, setAdsProjectDraft] = React.useState(EMPTY_ADS_PROJECT_DRAFT);

  const addAdsProject = () => {
    if (!adsProjectDraft.name.trim()) {
      setSaveError("Inserisci un nome campagna/sub-progetto Ads.");
      return;
    }

    const nextProject = {
      id: `ads_${Date.now()}`,
      channel: adsProjectDraft.channel,
      campaignType: adsProjectDraft.campaignType.trim(),
      name: adsProjectDraft.name.trim(),
      goal: adsProjectDraft.goal.trim(),
      linkedWebProjectId: adsProjectDraft.linkedWebProjectId,
      status: "draft",
      sourceRefs: [],
      adsOutput: {},
    };

    setAdsState((current) => ({
      ...current,
      output: {
        ...current.output,
        adsProjects: [...(current.output.adsProjects || []), nextProject],
      },
    }));
    setAdsProjectDraft(EMPTY_ADS_PROJECT_DRAFT);
    setSaveError("");
  };

  const updateAdsProjectStatus = (projectItemId, status) => {
    setAdsState((current) => ({
      ...current,
      output: {
        ...current.output,
        adsProjects: (current.output.adsProjects || []).map((entry) => (
          entry.id === projectItemId ? { ...entry, status } : entry
        )),
      },
    }));
  };

  const generateForAdsProject = (projectItem) => {
    setAdsState((current) => ({
      ...current,
      output: {
        ...current.output,
        channelScope: projectItem.channel,
        // Riprodotto identico all'originale: i due rami del ternario tornano
        // lo stesso valore, quindi l'obiettivo campagna non cambia mai.
        // Sembra un refuso (la riga sotto fa la cosa analoga per davvero), ma
        // correggerlo qui cambierebbe comportamento dentro una spezzatura:
        // e' annotato nella roadmap, sotto la V7.
        campaignGoal: projectItem.goal ? current.output.campaignGoal : current.output.campaignGoal,
        offerAngle: projectItem.goal || current.output.offerAngle,
      },
    }));
    setRuntimeMessage(`Campagna "${projectItem.name}" impostata come contesto Ads corrente. Ora puoi generare Google, Meta o checklist.`);
  };

  return {
    adsProjectDraft,
    setAdsProjectDraft,
    addAdsProject,
    updateAdsProjectStatus,
    generateForAdsProject,
  };
};

export default useAgencyProjectAdsSubProjects;
