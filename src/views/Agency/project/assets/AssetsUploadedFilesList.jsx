import React from "react";
import { Badge, Button, Form } from "react-bootstrap";
import { formatFileSize, getFriendlyParseStatus } from "./assetsFormatters";
import { FILE_STATUS_VARIANT } from "./assetsPageConstants";

// Gli stati di lettura in cui ha senso offrire il ripiego manuale: il testo
// non e' stato estratto, o lo e' stato solo in parte.
const PARSE_STATUSES_WITH_MANUAL_FALLBACK = ["failed", "unsupported", "not_parsed", "partial"];

// I materiali gia' registrati sul progetto.
//
// A differenza degli elenchi delle pagine sorelle qui c'e' un `role="list"`
// esplicito: le righe non sono solo informative, portano azioni e campi, e
// vanno annunciate come elenco a chi usa uno screen reader.
const AssetsUploadedFilesList = ({
  files,
  fileActionId,
  onUpdateMetadata,
  onOpenOrDownload,
  onRemove,
}) => {
  const elenco = files || [];

  return (
    <div className="d-flex flex-column gap-2" role="list" aria-label="File allegati al progetto">
      {elenco.map((file) => (
        <div key={file.id} className="agency-record-row" role="listitem">
          <div className="flex-grow-1">
            <div className="small fw-semibold">{file.name}</div>
            <div className="small text-muted">
              {file.mimeType || file.type || "tipo non specificato"} | {formatFileSize(file.size)} | {file.notes || "Nessuna nota"}
            </div>
            <div className="small text-muted mt-1">
              Stato lettura: {getFriendlyParseStatus(file)}
              {file.extractedTextLength ? ` | ${file.extractedTextLength} caratteri estratti` : ""}
              {file.parseError ? ` | ${file.parseError}` : ""}
            </div>
            {file.extractedTextPreview && (
              <details className="small mt-2">
                <summary className="text-muted">Anteprima testo estratto</summary>
                <div className="agency-tile border rounded-3 p-2 mt-1" style={{ whiteSpace: "pre-wrap" }}>
                  {file.extractedTextPreview.slice(0, 700)}
                  {file.extractedTextPreview.length > 700 ? "..." : ""}
                </div>
              </details>
            )}
            {PARSE_STATUSES_WITH_MANUAL_FALLBACK.includes(file.parseStatus) && (
              <details className="small mt-2">
                <summary className="text-muted">Aggiungi testo manuale da questo file</summary>
                {/* Scrivere del testo marca da solo il file come fonte utile:
                    la spunta sotto serve a marcarlo anche senza incollare
                    niente, o a togliere il segno. */}
                <Form.Control
                  as="textarea"
                  rows={4}
                  className="mt-2"
                  value={file.manualText || ""}
                  onChange={(event) => onUpdateMetadata(file.id, {
                    manualText: event.target.value,
                    markedUseful: Boolean(event.target.value.trim()),
                  })}
                  placeholder="Incolla qui testo, punti chiave o brief presenti nel file. Verranno usati come fonte manuale."
                />
                <Form.Check
                  className="mt-2"
                  checked={Boolean(file.markedUseful)}
                  onChange={(event) => onUpdateMetadata(file.id, { markedUseful: event.target.checked })}
                  label="Marca come fonte utile anche se il contenuto non e stato letto automaticamente"
                />
              </details>
            )}
          </div>
          <div className="d-flex align-items-center gap-2">
            <Badge bg={FILE_STATUS_VARIANT[file.parseStatus] || FILE_STATUS_VARIANT[file.status] || "secondary"}>
              {getFriendlyParseStatus(file)}
            </Badge>
            <Button
              size="sm"
              variant="outline-secondary"
              onClick={() => onOpenOrDownload(file, false)}
              disabled={!file.storagePath || fileActionId === `${file.id}:open`}
            >
              {fileActionId === `${file.id}:open` ? "Apertura..." : "Apri"}
            </Button>
            <Button
              size="sm"
              variant="outline-secondary"
              onClick={() => onOpenOrDownload(file, true)}
              disabled={!file.storagePath || fileActionId === `${file.id}:download`}
            >
              {fileActionId === `${file.id}:download` ? "Download..." : "Scarica"}
            </Button>
            <Button size="sm" variant="outline-danger" onClick={() => onRemove(file)}>
              Rimuovi
            </Button>
          </div>
        </div>
      ))}
      {elenco.length === 0 && (
        <div className="agency-empty-state small">
          <strong>Nessun file registrato.</strong> Carica file reali oppure registra un materiale senza upload.
        </div>
      )}
    </div>
  );
};

export default AssetsUploadedFilesList;
