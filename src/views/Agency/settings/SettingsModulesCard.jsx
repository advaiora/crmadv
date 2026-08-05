import React from "react";
import { Badge, Card } from "react-bootstrap";
import { MODULES } from "./settingsPageConstants";

// Catalogo di sola lettura: i moduli Agency attivi.
const SettingsModulesCard = () => (
  <Card className="card-border h-100">
    <Card.Body>
      <h6 className="mb-3">Moduli Agency attivi</h6>
      <div className="d-flex flex-wrap gap-2 mb-3">
        {MODULES.map((entry) => (
          <Badge key={entry} bg="light" text="dark" className="border">
            {entry}
          </Badge>
        ))}
      </div>
      <div className="alert alert-info py-2 mb-0">
        Cataloghi consultabili. Le funzioni AI e ricerca sono gestibili dal backend CRM solo da Superadmin.
      </div>
    </Card.Body>
  </Card>
);

export default SettingsModulesCard;
