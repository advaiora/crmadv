import React from "react";
import { Col, Form } from "react-bootstrap";
import { readableValue } from "../agencyProjectUx";
import { AdsAdGroups, AdsLaunchChecklist, AdsRsaIdeas, AdsSimpleList } from "./AdsOutputRenderers";
import { CAMPAIGN_GOAL_LABELS, CHANNEL_SCOPE_LABELS } from "./adsPageConstants";

// I sei riquadri di output della pagina Ads. Restituisce le colonne nude, da
// mettere dentro la Row del padre.
const AdsOutputPanels = ({ output, input, completenessLabel, onFieldChange }) => (
  <>
    <Col lg={6}>
      <div className="agency-output-panel">
        <h6 className="mb-2">Google Ads</h6>
        <div className="small mb-2"><strong>Tipo campagna:</strong> {readableValue(output.googleAds.campaignType)}</div>
        <div className="small mb-2"><strong>Struttura:</strong> {readableValue(output.googleAds.campaignStructure)}</div>
        <div className="small mb-2"><strong>Keyword seed:</strong> {readableValue(output.googleAds.keywordSeeds)}</div>
        <div className="small mb-2"><strong>Negative seed:</strong> {readableValue(output.googleAds.negativeSeeds)}</div>
        <div className="small mb-2"><strong>Estensioni:</strong> {readableValue(output.googleAds.extensionsIdeas)}</div>
        <div className="small mb-3">
          <strong>Raccomandazione landing:</strong> {readableValue(output.googleAds.landingRecommendation || input.web.landingRecommendationBase)}
        </div>
        <h6 className="small mb-2">Ad Groups</h6>
        <AdsAdGroups items={output.googleAds.adGroups} />
        <div className="mt-3">
          <h6 className="small mb-2">RSA Ideas</h6>
          <AdsRsaIdeas items={output.googleAds.rsaIdeas} />
        </div>
      </div>
    </Col>

    <Col lg={6}>
      <div className="agency-output-panel">
        <h6 className="mb-2">Meta Ads</h6>
        <div className="small mb-2"><strong>Angolo campagna:</strong> {readableValue(output.metaAds.campaignAngle)}</div>
        <div className="small mb-2"><strong>Audience:</strong> {readableValue(output.metaAds.audienceIdeas)}</div>
        <div className="small mb-2"><strong>Angoli creativi:</strong> {readableValue(output.metaAds.creativeAngles)}</div>
        <div className="small mb-2"><strong>Hook:</strong> {readableValue(output.metaAds.hooks)}</div>
        <div className="small mb-2"><strong>Primary text:</strong> {readableValue(output.metaAds.primaryTexts)}</div>
        <div className="small mb-2"><strong>Headline:</strong> {readableValue(output.metaAds.headlines)}</div>
        <div className="small"><strong>CTA:</strong> {readableValue(output.metaAds.ctaIdeas)}</div>
      </div>
    </Col>

    <Col lg={6}>
      <div className="agency-output-panel">
        <h6 className="mb-2">Richieste asset</h6>
        <AdsSimpleList items={output.assetRequests} emptyLabel="Nessuna richiesta asset ancora generata." />
        <div className="mt-3">
          <h6 className="small mb-2">Asset Meta dedicati</h6>
          <AdsSimpleList items={output.metaAds.assetRequests} emptyLabel="Nessun asset Meta specifico ancora disponibile." />
        </div>
      </div>
    </Col>

    <Col lg={6}>
      <div className="agency-output-panel">
        <h6 className="mb-2">Checklist lancio</h6>
        <AdsLaunchChecklist items={output.launchChecklist} />
      </div>
    </Col>

    <Col lg={6}>
      <div className="agency-output-panel">
        <h6 className="mb-2">Hook messaggio</h6>
        <AdsSimpleList items={output.messageHooks} emptyLabel="Nessun hook messaggio ancora generato." />
        <div className="mt-3">
          <h6 className="small mb-2">Blocchi copy Ads</h6>
          <div className="small mb-2"><strong>Google:</strong></div>
          <AdsSimpleList items={output.adCopyBlocks.google} emptyLabel="Nessun blocco copy Google disponibile." />
          <div className="small mt-3 mb-2"><strong>Meta:</strong></div>
          <AdsSimpleList items={output.adCopyBlocks.meta} emptyLabel="Nessun blocco copy Meta disponibile." />
        </div>
      </div>
    </Col>

    <Col lg={6}>
      <div className="agency-output-panel">
        <h6 className="mb-2">Segnali operativi</h6>
        <div className="small mb-2"><strong>Canale attivo:</strong> {CHANNEL_SCOPE_LABELS[output.channelScope] || output.channelScope}</div>
        <div className="small mb-2"><strong>Goal campagna:</strong> {CAMPAIGN_GOAL_LABELS[output.campaignGoal] || output.campaignGoal}</div>
        <div className="small mb-2"><strong>Qualita input:</strong> {completenessLabel}</div>
        <div className="small mb-2"><strong>Alert disponibili:</strong> {input.alerts.length}</div>
        <div className="small mb-2"><strong>Opportunita disponibili:</strong> {input.opportunities.length}</div>
        <div className="small mb-3"><strong>Output Web disponibile:</strong> {input.web.available ? "Si" : "No"}</div>
        <Form.Group controlId="ads-notes">
          <Form.Label className="small mb-1">Note modulo Ads</Form.Label>
          <Form.Control
            as="textarea"
            rows={5}
            value={output.notes}
            onChange={(event) => onFieldChange("notes", event.target.value)}
            placeholder="Note operative per marketing, ads specialist o grafica."
          />
        </Form.Group>
      </div>
    </Col>
  </>
);

export default AdsOutputPanels;
