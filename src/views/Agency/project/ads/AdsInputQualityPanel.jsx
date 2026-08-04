import React from "react";
import { readableValue } from "../agencyProjectUx";

// Pannello "Qualita input" della pagina Ads: i requisiti minimi prima del
// setup delle campagne.
//
// Nota: NON usa il pannello condiviso `shared/AgencyInputQualityPanel` (che
// usa la pagina Web) perche' quello chiude con un riquadro di giudizio che
// qui non c'e', e aggiungerlo cambierebbe la resa. Se le tre pagine sorelle
// vadano uniformate e' una decisione annotata nella roadmap, sotto la V7.
const AdsInputQualityPanel = ({ input, linkedLanding }) => (
  <div className="agency-panel h-100">
    <h6 className="agency-panel-title">Qualita input</h6>
    <p className="agency-panel-subtitle">Requisiti minimi prima del setup.</p>
    <div className="small mb-2"><strong>Tipo progetto:</strong> {input.projectType.label}</div>
    <div className="small mb-2"><strong>Contesto:</strong> {readableValue(input.contextSummary)}</div>
    <div className="small mb-2"><strong>Target:</strong> {readableValue(input.discovery.sections.target)}</div>
    <div className="small mb-2"><strong>Offerta:</strong> {readableValue(input.discovery.sections.offer)}</div>
    <div className="small mb-2">
      <strong>Moduli attivi:</strong> {readableValue(input.activeModules.filter((item) => item.active).map((item) => item.label))}
    </div>
    <div className="small"><strong>Landing/Web:</strong> {linkedLanding}</div>
  </div>
);

export default AdsInputQualityPanel;
