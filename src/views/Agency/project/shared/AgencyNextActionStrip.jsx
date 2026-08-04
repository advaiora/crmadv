import React from "react";

// Striscia "Prossima azione": suggerisce il passo successivo e affianca i
// pulsanti che lo eseguono. I pulsanti li decide la pagina e arrivano come
// figli, perche' cambiano da modulo a modulo.
const AgencyNextActionStrip = ({ message, children }) => (
  <div className="agency-action-strip mb-3">
    <div>
      <strong>Prossima azione:</strong>{" "}
      {message}
    </div>
    <div className="d-flex flex-wrap gap-2">
      {children}
    </div>
  </div>
);

export default AgencyNextActionStrip;
