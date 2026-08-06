import React from "react";

// Elenco di frasi (attivita' svolte, prossimi passi, highlight...) reso come blocchi
// leggibili, con un ripiego quando l'elenco e' vuoto.
//
// `blockClassName` serve alla sola vista cliente: il suo foglio di stile per la
// stampa aggancia i blocchi per classe (`agency-client-report-block`) per dargli un
// bordo visibile su carta. La vista tecnica non stampa e non ne ha bisogno — era
// l'unica differenza fra le due copie di questa funzione prima della fusione.
export const renderStringList = (items, emptyLabel, blockClassName = "") => {
  if (!Array.isArray(items) || items.length === 0) {
    return <p className="mb-0 small text-muted">{emptyLabel}</p>;
  }

  return (
    <div className="d-flex flex-column gap-2">
      {items.map((entry, index) => (
        <div
          key={`${entry}-${index}`}
          className={`border rounded-3 p-2 small ${blockClassName}`.trim()}
        >
          {entry}
        </div>
      ))}
    </div>
  );
};
