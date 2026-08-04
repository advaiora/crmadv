import { readableValue } from "../agencyProjectUx";

// Elenca, in ordine di presentazione, i dati che mancano prima di poter
// generare una pagina Web coerente. La lista alimenta sia il pannello
// "Qualita input" sia il banner "Prossima azione" sia il contratto di
// generazione: sta in un posto solo perche' i tre punti restino d'accordo.
export const buildWebMissingInputs = (input, output, sourceReadiness) => {
  const missing = [];
  if (!readableValue(input?.discovery?.sections?.target, "")) missing.push("target");
  if (!readableValue(input?.discovery?.sections?.offer, "")) missing.push("offerta");
  if (!readableValue(output?.ctaSet?.primary, "")) missing.push("CTA primaria");
  if (!readableValue(input?.discovery?.sections?.brandCommunication, "")) missing.push("differenzianti/USP");
  if (!readableValue(input?.discovery?.sections?.availableMaterials, "")) missing.push("prove o materiali");
  if (sourceReadiness?.status !== "ready") missing.push("fonti progetto complete");
  return missing;
};

export default buildWebMissingInputs;
