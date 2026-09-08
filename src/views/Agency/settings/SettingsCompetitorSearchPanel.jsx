import React from "react";
import { Col, Form, Row } from "react-bootstrap";
import { SEARCH_PROVIDER_OPTIONS, SEARCH_PROVIDER_TO_AI_PROVIDER } from "./settingsPageConstants";

// Riquadro "Ricerca competitor": interruttore, provider e modello della ricerca
// online.
//
// La ricerca competitor era l'unica funzione AI del CRM con il provider cablato
// nel codice (sempre OpenAI). Ora ha gli stessi due provider di prima classe del
// resto del CRM, ciascuno con i propri modelli: il menu dei modelli si filtra
// sul provider scelto, cosi' non si puo' salvare un modello Claude su OpenAI
// (che tornerebbe indietro come errore, sembrando una chiave sbagliata).
const SettingsCompetitorSearchPanel = ({
  form,
  canManage,
  storageReady,
  availableModels = [],
  providerHasKey = {},
  onFieldChange,
}) => {
  const aiProvider = SEARCH_PROVIDER_TO_AI_PROVIDER[form.competitorSearchProvider] || null;
  const modelOptions = aiProvider
    ? availableModels.filter((option) => option.provider === aiProvider)
    : [];
  const keyMissing = Boolean(aiProvider) && providerHasKey[aiProvider] === false;

  // Cambiare provider azzera il modello se non e' piu' del provider giusto:
  // meglio tornare a "predefinito" che lasciare a video una scelta che il
  // server rifiuterebbe al salvataggio.
  const handleProviderChange = (value) => {
    onFieldChange("competitorSearchProvider", value);
    const nextAiProvider = SEARCH_PROVIDER_TO_AI_PROVIDER[value] || null;
    const selected = availableModels.find((option) => option.id === form.competitorSearchModel);
    if (form.competitorSearchModel && (!nextAiProvider || selected?.provider !== nextAiProvider)) {
      onFieldChange("competitorSearchModel", "");
    }
  };

  return (
    <div className="border rounded-3 p-3">
      <h6 className="mb-3">Ricerca competitor</h6>
      <Row className="g-3">
        <Col md={4}>
          <Form.Check
            type="switch"
            id="agency-competitor-enabled"
            label="Abilita ricerca competitor online"
            checked={form.competitorSearchEnabled}
            disabled={!canManage || !storageReady}
            onChange={(event) => onFieldChange("competitorSearchEnabled", event.target.checked)}
          />
        </Col>
        <Col md={4}>
          <Form.Group controlId="agency-competitor-provider">
            <Form.Label>Provider ricerca</Form.Label>
            <Form.Select
              value={form.competitorSearchProvider}
              disabled={!canManage || !storageReady}
              onChange={(event) => handleProviderChange(event.target.value)}
            >
              {SEARCH_PROVIDER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </Form.Select>
            <Form.Text>
              OpenAI e Anthropic (Claude) cercano competitor reali online. Se il provider non risponde, non vengono creati competitor finti.
            </Form.Text>
          </Form.Group>
        </Col>
        <Col md={4}>
          <Form.Group controlId="agency-competitor-model">
            <Form.Label>Modello ricerca</Form.Label>
            <Form.Select
              value={form.competitorSearchModel}
              disabled={!canManage || !storageReady || modelOptions.length === 0}
              onChange={(event) => onFieldChange("competitorSearchModel", event.target.value)}
            >
              <option value="">Come il modello preferito</option>
              {modelOptions.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </Form.Select>
            <Form.Text>
              {aiProvider
                ? keyMissing
                  ? `Manca la chiave ${aiProvider === "anthropic" ? "Anthropic" : "OpenAI"}: senza chiave la ricerca resta non configurata.`
                  : "Lascia “Come il modello preferito” per seguire la scelta generale, se e del provider giusto."
                : "Scegli prima un provider di ricerca con un motore disponibile."}
            </Form.Text>
          </Form.Group>
        </Col>
      </Row>
    </div>
  );
};

export default SettingsCompetitorSearchPanel;
