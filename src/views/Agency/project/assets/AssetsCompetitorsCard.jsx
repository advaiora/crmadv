import React from "react";
import { Alert, Badge, Button, Card, Form, Spinner, Table } from "react-bootstrap";
import AssetsCompetitorSuggestions from "./AssetsCompetitorSuggestions";
import {
  getCompetitorSearchAlertTitle,
  getCompetitorSearchAlertVariant,
  getFriendlyCompetitorSearchMessage,
} from "./assetsCompetitorHelpers";
import {
  COMPETITOR_SOURCE_LABEL,
  COMPETITOR_STATUS_LABEL,
  COMPETITOR_STATUS_VARIANT,
} from "./assetsPageConstants";

// I competitor del progetto: ricerca online, suggerimenti da confermare, form
// manuale ed elenco di quelli acquisiti.
//
// E' l'unico elenco delle tre pagine sorelle fatto con una vera tabella: qui
// le colonne (fonte, stato) si confrontano fra righe, mentre negli altri
// elenchi ogni riga si legge per conto suo.
const AssetsCompetitorsCard = ({
  competitors,
  searchResult,
  suggestions,
  searching,
  onRunSearch,
  onConfirmSuggestion,
  draft,
  onDraftChange,
  onAddManual,
  onUpdateStatus,
  onRemove,
}) => {
  const elenco = competitors || [];

  return (
    <Card className="card-border">
      <Card.Body>
        <div className="d-flex justify-content-between align-items-start gap-2 mb-3">
          <div>
            <h6 className="mb-1">Competitor</h6>
            <p className="small text-muted mb-0">
              Aggiungi competitor manualmente oppure usa la ricerca automatica quando e attiva in Impostazioni Agency.
            </p>
          </div>
          <Button size="sm" variant="outline-primary" onClick={onRunSearch} disabled={searching}>
            {searching
              ? <><Spinner animation="border" size="sm" className="me-2" />Ricerca...</>
              : <><i className="bi bi-stars me-1" aria-hidden="true" />Cerca competitor</>}
          </Button>
        </div>

        {searchResult && (
          <Alert variant={getCompetitorSearchAlertVariant(searchResult)}>
            <strong>{getCompetitorSearchAlertTitle(searchResult)}</strong>{" "}
            {getFriendlyCompetitorSearchMessage(searchResult)}
          </Alert>
        )}

        <AssetsCompetitorSuggestions suggestions={suggestions} onConfirm={onConfirmSuggestion} />

        <div className="row g-2 mb-3">
          <div className="col-12 col-md-3">
            <Form.Control
              value={draft.name}
              onChange={(event) => onDraftChange("name", event.target.value)}
              placeholder="Nome competitor"
            />
          </div>
          <div className="col-12 col-md-4">
            <Form.Control
              value={draft.url}
              onChange={(event) => onDraftChange("url", event.target.value)}
              placeholder="https://competitor.it"
            />
          </div>
          <div className="col-12 col-md-4">
            <Form.Control
              value={draft.reason}
              onChange={(event) => onDraftChange("reason", event.target.value)}
              placeholder="Motivo / contesto"
            />
          </div>
          <div className="col-12 col-md-1 d-grid">
            <Button type="button" variant="outline-primary" onClick={onAddManual}>
              Aggiungi
            </Button>
          </div>
        </div>

        <Table responsive size="sm" className="mb-0 align-middle">
          <thead>
            <tr>
              <th>Nome</th>
              <th>URL</th>
              <th>Fonte</th>
              <th>Stato</th>
              <th>Azioni</th>
            </tr>
          </thead>
          <tbody>
            {elenco.map((competitor) => (
              <tr key={competitor.id}>
                <td>
                  <div className="fw-semibold small">{competitor.name}</div>
                  {competitor.reason && <div className="small text-muted">{competitor.reason}</div>}
                </td>
                <td className="small">{competitor.url}</td>
                <td>
                  <Badge bg={competitor.source === "manual" ? "secondary" : "warning"}>
                    {COMPETITOR_SOURCE_LABEL[competitor.source] || "Fonte esterna"}
                  </Badge>
                </td>
                <td>
                  <Badge bg={COMPETITOR_STATUS_VARIANT[competitor.status] || "secondary"}>
                    {COMPETITOR_STATUS_LABEL[competitor.status] || competitor.status}
                  </Badge>
                </td>
                <td>
                  <div className="d-flex gap-2">
                    <Button size="sm" variant="outline-success" onClick={() => onUpdateStatus(competitor.id, "confirmed")}>
                      Conferma
                    </Button>
                    <Button size="sm" variant="outline-secondary" onClick={() => onUpdateStatus(competitor.id, "rejected")}>
                      Rifiuta
                    </Button>
                    <Button size="sm" variant="outline-danger" onClick={() => onRemove(competitor.id)}>
                      Rimuovi
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {elenco.length === 0 && (
              <tr>
                <td colSpan={5} className="small text-muted">
                  Nessun competitor strutturato. Aggiungili manualmente o configura la ricerca online in Impostazioni Agency.
                </td>
              </tr>
            )}
          </tbody>
        </Table>
      </Card.Body>
    </Card>
  );
};

export default AssetsCompetitorsCard;
