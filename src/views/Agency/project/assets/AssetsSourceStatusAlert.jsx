import React from "react";
import { Alert } from "react-bootstrap";

// L'avviso legato allo stato delle fonti. Resta un componente a se' invece di
// passare dal pannello condiviso `shared/AgencyStatusAlerts`: quello ha quattro
// caselle fisse (errore, conferma, informazione, avviso persistente) e nessuna
// e' "danger", mentre qui il caso "nessuna fonte" e' proprio rosso.
const AssetsSourceStatusAlert = ({ status }) => {
  if (status === "missing") {
    return (
      <Alert variant="danger">
        Nessuna fonte cliente reale registrata. Aggiungi almeno URL, note, file o competitor prima di usare gli output come base operativa.
      </Alert>
    );
  }

  if (status === "partial") {
    return (
      <Alert variant="warning">
        Fonti parziali: gli output saranno bozze basate sui dati disponibili.
      </Alert>
    );
  }

  return null;
};

export default AssetsSourceStatusAlert;
