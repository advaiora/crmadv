import React from "react";
import { Card } from "react-bootstrap";
import { AGENCY_PROJECT_TYPE_OPTIONS } from "../../../modules/agency-os/projects/agencyProjectsModel";

// Catalogo di sola lettura: i tipi di progetto disponibili.
const SettingsProjectTypesCard = () => (
  <Card className="card-border h-100">
    <Card.Body>
      <h6 className="mb-3">Project types disponibili</h6>
      <div className="d-flex flex-column gap-2">
        {AGENCY_PROJECT_TYPE_OPTIONS.map((entry) => (
          <div key={entry.key} className="border rounded-3 p-2">
            <div className="small fw-semibold">{entry.label}</div>
            <div className="small text-muted">{entry.key} | {entry.description}</div>
          </div>
        ))}
      </div>
    </Card.Body>
  </Card>
);

export default SettingsProjectTypesCard;
