import React from 'react';
import { Card } from 'react-bootstrap';
import { formatCurrency } from '../helpers';

const QuoteTotalsSummary = ({
  subtotal = 0,
  taxTotal = 0,
  total = 0,
  taxRate,
  currency,
  compact = false,
}) => {
  return (
    <Card className="card-border quote-totals-summary">
      <Card.Body className={compact ? 'p-3' : 'p-4'}>
        <h6 className="mb-3">Riepilogo</h6>
        <div className="d-flex justify-content-between align-items-center mb-2">
          <span className="text-muted">Subtotale</span>
          <span className="fw-medium">{formatCurrency(subtotal, currency)}</span>
        </div>
        <div className="d-flex justify-content-between align-items-center mb-2">
          <span className="text-muted">IVA {taxRate !== null && taxRate !== undefined && taxRate !== '' ? `(${taxRate}%)` : ''}</span>
          <span className="fw-medium">{formatCurrency(taxTotal, currency)}</span>
        </div>
        <hr className="my-2" />
        <div className="d-flex justify-content-between align-items-center">
          <span className="fw-semibold">Totale</span>
          <span className="fw-semibold fs-5">{formatCurrency(total, currency)}</span>
        </div>
      </Card.Body>
    </Card>
  );
};

export default QuoteTotalsSummary;
