import React from "react";
import { Col } from "react-bootstrap";
import { readableValue } from "../agencyProjectUx";

// I quattro riquadri di output della pagina Web: struttura, copy, wireframe e
// preview. Restituisce le colonne nude, da mettere dentro la Row del padre.
const WebGenerationOutputPanels = ({ output }) => (
  <>
    <Col lg={6}>
      <div className="agency-output-panel">
        <h6 className="mb-2">Struttura Pagina</h6>
        <div className="agency-record-list">
          {output.sectionPlan.map((section) => (
            <div key={section.key} className="agency-record-row">
              <div className="fw-semibold small">{section.title}</div>
              <div className="small text-muted">{readableValue(section.objective)}</div>
            </div>
          ))}
          {output.sectionPlan.length === 0 && (
            <div className="agency-empty-state small">Nessuna struttura generata. Crea una bozza base o usa AI quando configurata.</div>
          )}
        </div>
      </div>
    </Col>

    <Col lg={6}>
      <div className="agency-output-panel">
        <h6 className="mb-2">Copy Base</h6>
        <div className="agency-output-feature mb-2">
          <div className="agency-output-feature-title">{readableValue(output.copyBlocks.headline, "Headline da generare")}</div>
          <div className="agency-output-feature-body">{readableValue(output.copyBlocks.subheadline, "Subheadline da generare")}</div>
        </div>
        <div className="small mb-2"><strong>Intro:</strong> {readableValue(output.copyBlocks.intro)}</div>
        <div className="small mb-2"><strong>Benefici:</strong> {readableValue(output.copyBlocks.benefits)}</div>
        <div className="small"><strong>CTA:</strong> {readableValue(output.ctaSet.primary)}</div>
      </div>
    </Col>

    <Col lg={6}>
      <div className="agency-output-panel">
        <h6 className="mb-2">Wireframe</h6>
        {output.wireframe.blocks.length > 0 ? (
          <pre className="small mb-0" style={{ whiteSpace: "pre-wrap" }}>
            {output.wireframe.blocks.join("\n")}
          </pre>
        ) : (
          <div className="agency-empty-state small">Wireframe non ancora generato.</div>
        )}
      </div>
    </Col>

    <Col lg={6}>
      <div className="agency-output-panel">
        <h6 className="mb-2">Preview</h6>
        {output.previewHtmlBase ? (
          <div className="border rounded-3 p-3 agency-tile">
            {/* La preview e' HTML costruito dai builder del progetto (o dall'AI
                sullo stesso schema): si inietta perche' e' proprio quello che
                si deve poter guardare. */}
            <div className="small" dangerouslySetInnerHTML={{ __html: output.previewHtmlBase }} />
          </div>
        ) : (
          <div className="agency-empty-state small">Preview base non ancora generata.</div>
        )}
      </div>
    </Col>
  </>
);

export default WebGenerationOutputPanels;
