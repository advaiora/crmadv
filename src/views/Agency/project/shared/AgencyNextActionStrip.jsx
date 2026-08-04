import React from "react";

// Striscia "Prossima azione": suggerisce il passo successivo e affianca i
// pulsanti che lo eseguono. I pulsanti li decide la pagina e arrivano come
// figli, perche' cambiano da modulo a modulo.
//
// `className` esiste perche' in Web e Ads la striscia sta da sola e si porta
// dietro il proprio margine, mentre nella pagina Fonti sta dentro una griglia
// che quel margine lo mette gia': lasciarlo raddoppierebbe lo spazio. Il
// valore predefinito e' quello di prima, quindi le due pagine non cambiano.
const AgencyNextActionStrip = ({ message, children, className = "agency-action-strip mb-3" }) => (
  <div className={className}>
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
