import React from 'react';

/**
 * Campo etichetta/valore per il contenuto di una linguetta (riga espandibile).
 * Usa le classi generiche `ui-detail-field*` (globals.css).
 *
 * Props:
 * - icon: componente icona (opzionale)
 * - label: string
 * - fullWidth: boolean (occupa tutta la riga della griglia)
 * - children: il valore (o placeholder)
 */
const DetailField = ({ icon: Icon, label, fullWidth = false, children }) => (
  <div className={`ui-detail-field ${fullWidth ? 'ui-detail-field--full' : ''}`.trim()}>
    <div className="ui-detail-field-label">
      {Icon && <Icon size={14} />}
      <span>{label}</span>
    </div>
    <div className="ui-detail-field-value">{children}</div>
  </div>
);

export default DetailField;
