import React from "react";
import { getInputQualityTone } from "../agencyProjectUx";

// Pannello "Qualita input": elenca i dati che verranno usati dalla generazione
// e chiude con un giudizio complessivo (completi / parziali / da completare).
// I valori arrivano gia' formattati dalla pagina: qui si fa solo il layout,
// perche' quali campi contino e come si leggano cambia da modulo a modulo.
const AgencyInputQualityPanel = ({ title, subtitle, fields, missingLabels, completeMessage }) => {
  const missing = missingLabels || [];
  const tone = getInputQualityTone(missing.length);

  return (
    <div className="agency-panel h-100">
      <h6 className="agency-panel-title">{title}</h6>
      <p className="agency-panel-subtitle">{subtitle}</p>
      {fields.map((field, index) => (
        <div key={field.label} className={index === fields.length - 1 ? "small" : "small mb-2"}>
          <strong>{field.label}:</strong> {field.value}
        </div>
      ))}
      <div className={`alert alert-${tone.variant} py-2 mt-3 mb-0`}>
        <strong>{tone.label}.</strong>{" "}
        {missing.length > 0 ? `Completa: ${missing.join(", ")}.` : completeMessage}
      </div>
    </div>
  );
};

export default AgencyInputQualityPanel;
