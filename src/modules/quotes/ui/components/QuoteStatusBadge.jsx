import React from 'react';
import { Badge } from 'react-bootstrap';

const STATUS_VARIANTS = {
  DRAFT: { label: 'Bozza', bg: 'secondary' },
  SENT: { label: 'Inviato', bg: 'info' },
  ACCEPTED: { label: 'Accettato', bg: 'success' },
  REJECTED: { label: 'Rifiutato', bg: 'danger' },
  EXPIRED: { label: 'Scaduto', bg: 'secondary' },
};

const QuoteStatusBadge = ({ status }) => {
  const config = STATUS_VARIANTS[status] || { label: status || '-', bg: 'secondary' };

  return (
    <Badge bg={config.bg} className="text-uppercase quote-status-badge">
      {config.label}
    </Badge>
  );
};

export default QuoteStatusBadge;
