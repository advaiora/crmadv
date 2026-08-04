import React from "react";
import { Card, Form } from "react-bootstrap";

// Il brief grezzo: appunti di call, contesto, vincoli. E' testo libero e vale
// come fonte a tutti gli effetti, non e' un campo di servizio.
//
// Il titolo resta un `h6` come nell'originale, e la casella ci si collega con
// `aria-labelledby` invece che con una `Form.Label`: cosi' chi usa uno screen
// reader sa a cosa serve la casella, e l'aspetto non cambia di un pixel.
const AssetsNotesCard = ({ notes, onNotesChange }) => (
  <Card className="card-border h-100">
    <Card.Body>
      <h6 className="mb-3" id="assets-manual-notes-title">Brief grezzo / note</h6>
      <Form.Control
        as="textarea"
        rows={10}
        aria-labelledby="assets-manual-notes-title"
        value={notes || ""}
        onChange={(event) => onNotesChange(event.target.value)}
        placeholder="Appunti call, contesto cliente, vincoli, materiali ricevuti."
      />
    </Card.Body>
  </Card>
);

export default AssetsNotesCard;
