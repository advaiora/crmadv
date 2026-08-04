import React from "react";
import { Card, Col, Form, Row } from "react-bootstrap";
import { readableValue } from "../agencyProjectUx";
import { AGENCY_ADS_CAMPAIGN_GOALS, AGENCY_ADS_CHANNEL_SCOPES } from "../../../../modules/agency-os/ads/agencyAdsV1Model";
import { CAMPAIGN_GOAL_LABELS, CHANNEL_SCOPE_LABELS } from "./adsPageConstants";

// Card "Impostazioni campagna": cosa guida le generazioni. Due campi sono di
// sola lettura perche' arrivano dal modulo Web (CTA e landing collegata): si
// mostrano qui perche' servono a decidere, ma si cambiano di la'.
const AdsSettingsCard = ({ output, onFieldChange, ctaPrimary, linkedLanding }) => (
  <Card className="card-border h-100">
    <Card.Body>
      <h6 className="mb-3">Impostazioni campagna</h6>
      <Row className="g-2">
        <Col md={4}>
          <Form.Group controlId="ads-channel-scope">
            <Form.Label className="small mb-1">Canale</Form.Label>
            <Form.Select
              value={output.channelScope}
              onChange={(event) => onFieldChange("channelScope", event.target.value)}
            >
              {AGENCY_ADS_CHANNEL_SCOPES.map((entry) => (
                <option key={entry} value={entry}>{CHANNEL_SCOPE_LABELS[entry] || entry}</option>
              ))}
            </Form.Select>
          </Form.Group>
        </Col>
        <Col md={4}>
          <Form.Group controlId="ads-campaign-goal">
            <Form.Label className="small mb-1">Obiettivo campagna</Form.Label>
            <Form.Select
              value={output.campaignGoal}
              onChange={(event) => onFieldChange("campaignGoal", event.target.value)}
            >
              {AGENCY_ADS_CAMPAIGN_GOALS.map((entry) => (
                <option key={entry} value={entry}>{CAMPAIGN_GOAL_LABELS[entry] || entry}</option>
              ))}
            </Form.Select>
          </Form.Group>
        </Col>
        <Col md={4}>
          <Form.Group controlId="ads-cta-primary">
            <Form.Label className="small mb-1">CTA principale</Form.Label>
            <Form.Control value={readableValue(ctaPrimary)} readOnly plaintext={false} />
          </Form.Group>
        </Col>
        <Col md={6}>
          <Form.Group controlId="ads-targeting-summary">
            <Form.Label className="small mb-1">Sintesi targeting</Form.Label>
            <Form.Control
              value={output.targetingSummary}
              onChange={(event) => onFieldChange("targetingSummary", event.target.value)}
              placeholder="Segmenti, geo, interessi, intent"
            />
          </Form.Group>
        </Col>
        <Col md={6}>
          <Form.Group controlId="ads-offer-angle">
            <Form.Label className="small mb-1">Angolo offerta</Form.Label>
            <Form.Control
              value={output.offerAngle}
              onChange={(event) => onFieldChange("offerAngle", event.target.value)}
              placeholder="Taglio dell'offerta per Ads"
            />
          </Form.Group>
        </Col>
        <Col md={12}>
          <Form.Group controlId="ads-linked-landing">
            <Form.Label className="small mb-1">Landing collegata</Form.Label>
            <Form.Control value={linkedLanding} readOnly plaintext={false} />
          </Form.Group>
        </Col>
      </Row>
    </Card.Body>
  </Card>
);

export default AdsSettingsCard;
