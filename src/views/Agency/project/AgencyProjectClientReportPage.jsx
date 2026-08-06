import React from "react";
import { useLocation, useParams } from "react-router-dom";
import ClientReportView from "./reports/ClientReportView";
import TechnicalReportView from "./reports/TechnicalReportView";
import { isTechnicalView } from "./reports/reportViewMode";

// Scheda "Report". Dal 6/8/2026 tiene due viste sullo STESSO percorso:
//  - la vista generale, quella scritta per il cliente (nessun parametro);
//  - la vista tecnica (era la scheda separata "Reports tecnici"), dietro `?vista=tecnica`.
//
// ⚠️ Il percorso resta uno solo di proposito: e' quello che tiene ACCESA la scheda
// "Report" in cima anche mentre si guarda la vista tecnica, senza dover toccare
// AgencyProjectPageTemplate. Il perche' per esteso sta in reports/reportViewMode.js.
const AgencyProjectClientReportPage = () => {
  const { projectId } = useParams();
  const location = useLocation();

  return isTechnicalView(location.search)
    ? <TechnicalReportView projectId={projectId} />
    : <ClientReportView projectId={projectId} />;
};

export default AgencyProjectClientReportPage;
