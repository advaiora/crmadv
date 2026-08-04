import React from "react";
import { Badge, Button, Card, Col, Form, Row } from "react-bootstrap";
import { getUrlTypeLabel } from "./assetsFormatters";
import { URL_TYPE_OPTIONS } from "./assetsPageConstants";

// Gli indirizzi registrati come fonti. Ogni riga e' un piccolo form di cinque
// campi, non una riga di sola lettura come nelle pagine sorelle Web e Ads.
//
// In fondo, dentro la stessa card, c'e' anche la casella dei competitor
// rapidi: sta qui perche' sono comunque indirizzi che si incollano, e da qui
// vengono salvati come competitor manuali confermati.
const AssetsUrlsCard = ({
  urls,
  primaryWebsiteUrl,
  websiteUrl,
  onAddUrl,
  onUpdateUrl,
  onRemoveUrl,
  onSetPrimaryUrl,
  competitorUrlsText,
  onCompetitorUrlsTextChange,
}) => {
  const elenco = urls || [];

  return (
    <Card className="card-border h-100">
      <Card.Body>
        <div className="d-flex justify-content-between align-items-start gap-2 mb-3">
          <div>
            <h6 className="mb-1">URL progetto</h6>
            <p className="small text-muted mb-0">Aggiungi sito, landing, pagine servizio e canali social usati come riferimento.</p>
          </div>
          <Button size="sm" variant="outline-primary" onClick={onAddUrl}>
            Aggiungi URL
          </Button>
        </div>

        {elenco.length === 0 && (
          <div className="agency-empty-state small">
            Nessun URL registrato. Aggiungi almeno il sito principale o una landing.
          </div>
        )}

        <div className="agency-record-list mb-3">
          {elenco.map((entry) => {
            const isPrimary = entry.url && (entry.url === primaryWebsiteUrl || entry.url === websiteUrl);
            return (
              <div key={entry.id} className="agency-record-row">
                <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
                  <Badge bg={isPrimary ? "primary" : "secondary"}>
                    {isPrimary ? "Sito principale" : getUrlTypeLabel(entry.type)}
                  </Badge>
                  <div className="d-flex gap-2">
                    <Button size="sm" variant="outline-primary" onClick={() => onSetPrimaryUrl(entry)}>
                      Imposta principale
                    </Button>
                    <Button size="sm" variant="outline-danger" onClick={() => onRemoveUrl(entry.id)}>
                      Rimuovi
                    </Button>
                  </div>
                </div>
                <Row className="g-2">
                  <Col md={5}>
                    <Form.Group controlId={`assets-url-address-${entry.id}`}>
                      <Form.Label className="small mb-1">URL</Form.Label>
                      <Form.Control
                        size="sm"
                        value={entry.url || ""}
                        onChange={(event) => onUpdateUrl(entry.id, { url: event.target.value })}
                        placeholder="https://www.cliente.it"
                      />
                    </Form.Group>
                  </Col>
                  <Col md={3}>
                    <Form.Group controlId={`assets-url-type-${entry.id}`}>
                      <Form.Label className="small mb-1">Tipo</Form.Label>
                      <Form.Select
                        size="sm"
                        value={entry.type || "other"}
                        onChange={(event) => onUpdateUrl(entry.id, {
                          type: event.target.value,
                          label: entry.label || getUrlTypeLabel(event.target.value),
                        })}
                      >
                        {URL_TYPE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </Form.Select>
                    </Form.Group>
                  </Col>
                  <Col md={4}>
                    <Form.Group controlId={`assets-url-label-${entry.id}`}>
                      <Form.Label className="small mb-1">Etichetta</Form.Label>
                      <Form.Control
                        size="sm"
                        value={entry.label || ""}
                        onChange={(event) => onUpdateUrl(entry.id, { label: event.target.value })}
                        placeholder={getUrlTypeLabel(entry.type)}
                      />
                    </Form.Group>
                  </Col>
                  <Col md={8}>
                    <Form.Group controlId={`assets-url-notes-${entry.id}`}>
                      <Form.Label className="small mb-1">Note URL</Form.Label>
                      <Form.Control
                        size="sm"
                        value={entry.notes || ""}
                        onChange={(event) => onUpdateUrl(entry.id, { notes: event.target.value })}
                        placeholder="Esempio: landing attuale, pagina servizio prioritaria, profilo social attivo."
                      />
                    </Form.Group>
                  </Col>
                  <Col md={4}>
                    <Form.Group controlId={`assets-url-status-${entry.id}`}>
                      <Form.Label className="small mb-1">Stato</Form.Label>
                      <Form.Select
                        size="sm"
                        value={entry.status || "active"}
                        onChange={(event) => onUpdateUrl(entry.id, { status: event.target.value })}
                      >
                        <option value="active">Registrato</option>
                        <option value="ignored">Non usare negli output</option>
                      </Form.Select>
                    </Form.Group>
                    <div className="small text-muted mt-1">
                      Link registrato come fonte. Non viene dichiarato come analizzato finche non attivi una lettura reale del contenuto.
                    </div>
                  </Col>
                </Row>
              </div>
            );
          })}
        </div>

        <Form.Group controlId="assets-competitor-urls">
          <Form.Label>Competitor URL rapidi</Form.Label>
          <Form.Control
            as="textarea"
            rows={5}
            value={competitorUrlsText}
            onChange={(event) => onCompetitorUrlsTextChange(event.target.value)}
            placeholder="Uno per riga oppure separati da virgola"
          />
          <div className="small text-muted mt-2">
            Verranno salvati come competitor manuali confermati.
          </div>
        </Form.Group>
      </Card.Body>
    </Card>
  );
};

export default AssetsUrlsCard;
