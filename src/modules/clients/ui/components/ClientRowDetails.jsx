import React from 'react';
import { FileText, Hash, MapPin, Receipt } from 'lucide-react';
import CopyField from './CopyField';
import { formatAddress } from '../helpers';

// Campo etichetta/valore semplice per i dati non "copiabili" (indirizzo, note).
const DetailField = ({ icon: Icon, label, fullWidth = false, children }) => (
  <div className={`clients-detail-field ${fullWidth ? "clients-detail-field--full" : ""}`.trim()}>
    <div className="clients-detail-field-label">
      {Icon && <Icon size={14} />}
      <span>{label}</span>
    </div>
    <div className="clients-detail-field-value">{children}</div>
  </div>
);

const emptyValue = <span className="text-muted">—</span>;

/**
 * Contenuto della "linguetta" di una riga cliente: i campi secondari/occasionali
 * (dati fiscali, indirizzo, note) che restano nascosti finche' non servono.
 * I dati primari (nome, tipo, email, telefono, tag) restano nella riga densa.
 */
const ClientRowDetails = ({ client }) => {
  const address = formatAddress(client?.address);
  const notes = typeof client?.notes === 'string' ? client.notes.trim() : '';

  return (
    <div className="clients-row-detail-grid">
      <CopyField icon={Receipt} label="P.IVA" value={client?.vatNumber || ''} />
      <CopyField icon={Hash} label="Codice fiscale" value={client?.taxCode || ''} />
      <DetailField icon={MapPin} label="Indirizzo" fullWidth>
        {address || emptyValue}
      </DetailField>
      <DetailField icon={FileText} label="Note" fullWidth>
        {notes ? <span className="clients-detail-notes">{notes}</span> : emptyValue}
      </DetailField>
    </div>
  );
};

// Memoizzato: il contenuto della linguetta dipende solo da `client` (stabile),
// quindi non si ri-renderizza quando si apre/chiude un'altra riga.
export default React.memo(ClientRowDetails);
