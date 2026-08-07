import React from "react";
import { Card } from "react-bootstrap";
import { TEAM_ROLES } from "./settingsPageConstants";

// Catalogo di sola lettura: i ruoli del team e di cosa rispondono.
const SettingsTeamRolesCard = () => (
  <Card className="card-border h-100">
    <Card.Body>
      <h6 className="mb-3">Ruoli team</h6>
      <div className="d-flex flex-column gap-2">
        {TEAM_ROLES.map((entry) => (
          <div key={entry.key} className="border rounded-3 p-2">
            <div className="small fw-semibold">{entry.label}</div>
            <div className="small text-muted">{entry.owner}</div>
          </div>
        ))}
      </div>
    </Card.Body>
  </Card>
);

export default SettingsTeamRolesCard;
