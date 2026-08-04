import React from "react";

// Banner introduttivo a passi numerati, in cima alle pagine di produzione del
// progetto (Web, Ads, Assets): stessa impalcatura, cambiano solo i testi.
const AgencyWorkflowSteps = ({ steps }) => (
  <div className="agency-workflow-steps">
    {steps.map((step, index) => (
      <div key={step.title} className="agency-workflow-step">
        <div className="small fw-semibold">
          <span className="agency-workflow-step-number">{index + 1}</span>{step.title}
        </div>
        <div className="small text-muted mt-1">{step.description}</div>
      </div>
    ))}
  </div>
);

export default AgencyWorkflowSteps;
