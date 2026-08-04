import React from "react";
import { readableValue } from "../agencyProjectUx";

// I quattro modi in cui i riquadri di output della pagina Ads mostrano una
// lista: voci semplici, checklist di lancio, ad group Google e idee RSA.
// Ognuno ha il proprio stato vuoto, perche' dice all'utente cosa manca.

export const AdsSimpleList = ({ items, emptyLabel }) => {
  if (!Array.isArray(items) || items.length === 0) {
    return <p className="small text-muted mb-0">{emptyLabel}</p>;
  }

  return (
    <div className="d-flex flex-column gap-2">
      {items.map((item, index) => (
        <div key={`${String(item)}-${index}`} className="border rounded-3 p-2 small">
          {item}
        </div>
      ))}
    </div>
  );
};

export const AdsLaunchChecklist = ({ items }) => {
  if (!Array.isArray(items) || items.length === 0) {
    return <p className="small text-muted mb-0">Checklist launch non ancora disponibile.</p>;
  }

  return (
    <div className="d-flex flex-column gap-2">
      {items.map((item) => (
        <div key={item.key} className="border rounded-3 p-2">
          <div className="small fw-semibold">{item.label}</div>
          <div className="small text-muted">
            Canale: {readableValue(item.channel, "condiviso")} | Stato: {readableValue(item.status, "da fare")}
          </div>
        </div>
      ))}
    </div>
  );
};

export const AdsAdGroups = ({ items }) => {
  if (!Array.isArray(items) || items.length === 0) {
    return <p className="small text-muted mb-0">Ad group non ancora definiti.</p>;
  }

  return (
    <div className="d-flex flex-column gap-2">
      {items.map((item) => (
        <div key={item.name} className="border rounded-3 p-2">
          <div className="small fw-semibold">{item.name}</div>
          <div className="small text-muted mb-1">{readableValue(item.intent, "Intent da completare")}</div>
          <div className="small">
            <strong>Keyword:</strong> {readableValue(item.keywords)}
          </div>
        </div>
      ))}
    </div>
  );
};

export const AdsRsaIdeas = ({ items }) => {
  if (!Array.isArray(items) || items.length === 0) {
    return <p className="small text-muted mb-0">RSA ideas non ancora disponibili.</p>;
  }

  return (
    <div className="d-flex flex-column gap-2">
      {items.map((item, index) => (
        <div key={`rsa-${index}`} className="border rounded-3 p-2">
          <div className="small fw-semibold mb-1">RSA Idea {index + 1}</div>
          <div className="small mb-1">
            <strong>Headline:</strong> {readableValue(item.headlines)}
          </div>
          <div className="small">
            <strong>Description:</strong> {readableValue(item.descriptions)}
          </div>
        </div>
      ))}
    </div>
  );
};
