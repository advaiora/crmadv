import { Button, Modal } from "react-bootstrap";
import { describeImportPreview, formatRowCount } from "../importSummary";
import { getClientTypeLabel } from "../helpers";

// Anteprima dell'import clienti: cosa entrerebbe e cosa no, prima di salvare.
// Il componente non chiama niente e non possiede niente — riceve l'anteprima
// gia' pronta dall'hook useClientsCsvTransfer e disegna. Il bottone che salva e'
// uno solo, ed e' qui: e' il motivo per cui questo file resta corto.
//
// Due elenchi densi invece di due tabelle arieggiate: un elenco di scarti si
// legge tutto d'un fiato, mentre una tabella costringe a scorrere per contare.

const ClientsImportPreviewModal = ({ preview, importing, onCancel, onConfirm }) => {
  if (!preview) {
    return null;
  }

  const nothingToImport = preview.validRows === 0;

  return (
    <Modal
      show
      onHide={onCancel}
      centered
      size="lg"
      // A import avviato la finestra non si chiude piu' cliccando fuori: la
      // scrittura e' gia' partita, e sparire lascerebbe l'esito senza padrone.
      backdrop={importing ? "static" : true}
      aria-labelledby="clients-import-preview-title"
    >
      <Modal.Header closeButton={!importing}>
        <Modal.Title id="clients-import-preview-title">Anteprima importazione</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p className="mb-1">{describeImportPreview(preview)}</p>
        <p className="text-muted small mb-4">
          Niente è ancora stato salvato: i clienti entrano solo quando confermi.
        </p>

        {preview.errors.length > 0 && (
          <section className="clients-import-preview-section">
            <h3 className="clients-import-preview-title">
              Righe scartate ({preview.failedRows})
            </h3>
            <div className="clients-import-preview-list">
              {preview.errors.map((entry) => (
                <div className="clients-import-preview-row clients-import-preview-row-error" key={`scarto-${entry.row}-${entry.message}`}>
                  <span className="clients-import-preview-number">Riga {entry.row}</span>
                  <span>{entry.message}</span>
                </div>
              ))}
              {preview.hiddenErrors > 0 && (
                <p className="clients-import-preview-more mb-0">
                  e altre {formatRowCount(preview.hiddenErrors)} con errori, non elencate.
                </p>
              )}
            </div>
          </section>
        )}

        {preview.rows.length > 0 && (
          <section className="clients-import-preview-section">
            <h3 className="clients-import-preview-title">Righe che entrano ({preview.validRows})</h3>
            <div className="clients-import-preview-list">
              {preview.rows.map((entry) => (
                <div className="clients-import-preview-row clients-import-preview-row-valid" key={`riga-${entry.row}`}>
                  <span>{entry.name}</span>
                  <span className="clients-import-preview-secondary">{getClientTypeLabel(entry.type)}</span>
                  <span className="clients-import-preview-secondary">{entry.email || "—"}</span>
                  <span className="clients-import-preview-secondary">{entry.phone || "—"}</span>
                </div>
              ))}
              {preview.hiddenRows > 0 && (
                <p className="clients-import-preview-more mb-0">
                  e altre {formatRowCount(preview.hiddenRows)}, non elencate.
                </p>
              )}
            </div>
          </section>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline-secondary" onClick={onCancel} disabled={importing}>
          Annulla
        </Button>
        <Button variant="primary" onClick={() => void onConfirm()} disabled={importing || nothingToImport}>
          {importing ? "Importazione..." : `Conferma e importa ${formatRowCount(preview.validRows)}`}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default ClientsImportPreviewModal;
