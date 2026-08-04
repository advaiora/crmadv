import React from "react";
import { EMPTY_WEB_PROJECT_DRAFT } from "../webPageConstants";

// Le landing e pagine del progetto ("sub-progetti Web"): bozza del form di
// creazione, aggiunta, cambio di stato e uso di una pagina come contesto
// corrente per le generazioni successive.
export const useAgencyProjectWebSubProjects = ({
  setWebState,
  setOutputField,
  setSaveError,
  setGenerationMessage,
}) => {
  const [webProjectDraft, setWebProjectDraft] = React.useState(EMPTY_WEB_PROJECT_DRAFT);

  const addWebProject = () => {
    if (!webProjectDraft.name.trim()) {
      setSaveError("Inserisci un nome sub-progetto Web.");
      return;
    }

    const nextProject = {
      id: `web_${Date.now()}`,
      type: webProjectDraft.type,
      name: webProjectDraft.name.trim(),
      goal: webProjectDraft.goal.trim(),
      target: webProjectDraft.target.trim(),
      primaryCta: webProjectDraft.primaryCta.trim(),
      status: "draft",
      sourceRefs: [],
      webOutput: {},
    };

    setWebState((current) => ({
      ...current,
      output: {
        ...current.output,
        webProjects: [...(current.output.webProjects || []), nextProject],
      },
    }));
    setWebProjectDraft(EMPTY_WEB_PROJECT_DRAFT);
    setSaveError("");
  };

  const updateWebProjectStatus = (projectItemId, status) => {
    setWebState((current) => ({
      ...current,
      output: {
        ...current.output,
        webProjects: (current.output.webProjects || []).map((entry) => (
          entry.id === projectItemId ? { ...entry, status } : entry
        )),
      },
    }));
  };

  const generateForWebProject = (projectItem) => {
    setOutputField("pageType", projectItem.type === "ecommerce_page" ? "ecommerce_lite" : projectItem.type);
    setWebState((current) => ({
      ...current,
      output: {
        ...current.output,
        pageGoal: projectItem.goal || current.output.pageGoal,
        targetSummary: projectItem.target || current.output.targetSummary,
        ctaSet: {
          ...current.output.ctaSet,
          primary: projectItem.primaryCta || current.output.ctaSet.primary,
        },
      },
    }));
    setGenerationMessage(`Sub-progetto "${projectItem.name}" impostato come contesto Web corrente. Ora puoi rigenerare struttura/copy.`);
  };

  return {
    webProjectDraft,
    setWebProjectDraft,
    addWebProject,
    updateWebProjectStatus,
    generateForWebProject,
  };
};

export default useAgencyProjectWebSubProjects;
