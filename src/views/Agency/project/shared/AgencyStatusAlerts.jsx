import React from "react";

// I messaggi di stato delle pagine di produzione del progetto, sempre nello
// stesso ordine: errore, conferma, informazione e infine l'avviso persistente
// (tipicamente "AI non configurata"), che resta a video finche' la condizione
// non cambia. Ogni messaggio assente non renderizza niente.
const AgencyStatusAlerts = ({ error, success, info, warning }) => (
  <>
    {error && (
      <div className="alert alert-warning py-2 mb-3" role="alert">{error}</div>
    )}
    {success && (
      <div className="alert alert-success py-2 mb-3" role="status">{success}</div>
    )}
    {info && (
      <div className="alert alert-info py-2 mb-3" role="status">{info}</div>
    )}
    {warning && (
      <div className="alert alert-warning py-2 mb-3">{warning}</div>
    )}
  </>
);

export default AgencyStatusAlerts;
