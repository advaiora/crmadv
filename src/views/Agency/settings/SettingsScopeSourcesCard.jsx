import React from "react";
import { Badge, Card } from "react-bootstrap";
import { AGENCY_PROJECT_SCOPE_OPTIONS } from "../../../modules/agency-os/projects/agencyProjectsModel";

// Due cataloghi nella stessa card, come nell'originale: gli scope acquistabili
// e la spiegazione degli stati di qualita delle fonti.
const SettingsScopeSourcesCard = ({ isDev }) => (
  <Card className="card-border h-100">
    <Card.Body>
      <h6 className="mb-3">Scope acquistabile</h6>
      <div className="d-flex flex-wrap gap-2">
        {AGENCY_PROJECT_SCOPE_OPTIONS.map((entry) => (
          <Badge key={entry.key} bg="light" text="dark" className="border">
            {entry.label} ({entry.key})
          </Badge>
        ))}
      </div>
      <hr />
      <h6 className="mb-2">Qualita delle fonti</h6>
      <div className="small text-muted">
        Stati operativi: da completare, parziali, pronte. I moduli dichiarano quando lavorano su dati incompleti.
      </div>
      <div className="mt-2">
        <Badge bg={isDev ? "success" : "secondary"}>
          Dettagli tecnici sorgenti: {isDev ? "visibili in sviluppo" : "nascosti in produzione"}
        </Badge>
      </div>
    </Card.Body>
  </Card>
);

export default SettingsScopeSourcesCard;
