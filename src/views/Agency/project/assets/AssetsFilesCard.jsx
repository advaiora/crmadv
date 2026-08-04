import React from "react";
import { Button, Card, Form } from "react-bootstrap";
import AssetsUploadQueueList from "./AssetsUploadQueueList";
import AssetsUploadedFilesList from "./AssetsUploadedFilesList";
import { ALLOWED_EXTENSIONS_TEXT } from "./assetsPageConstants";

// I materiali del progetto: il riquadro dove si trascinano i file, la coda,
// il form per registrare un materiale che NON si carica (una brochure di
// carta, un file che sta altrove) e l'elenco di quel che c'e' gia'.
const AssetsFilesCard = ({
  getRootProps,
  getInputProps,
  isDragActive,
  uploadQueue,
  uploading,
  onUploadQueuedFiles,
  onClearQueue,
  fileDraft,
  onFileDraftChange,
  onAddFileMetadata,
  uploadedFiles,
  fileActionId,
  onUpdateFileMetadata,
  onOpenOrDownloadFile,
  onRemoveFile,
}) => (
  <Card className="card-border">
    <Card.Body>
      <div className="d-flex justify-content-between align-items-start gap-2 mb-3">
        <div>
          <h6 className="mb-1">File progetto</h6>
          <p className="small text-muted mb-0">
            Trascina uno o piu file. TXT, CSV, PDF e DOCX vengono letti quando il testo e estraibile; immagini, XLSX e DOC restano allegati consultabili.
          </p>
        </div>
      </div>

      <div
        {...getRootProps({
          className: `border rounded-3 p-4 text-center mb-3 ${isDragActive ? "border-primary agency-tile-accent" : "agency-tile"}`,
        })}
        style={{ cursor: "pointer" }}
      >
        <input {...getInputProps()} />
        <div className="fw-semibold">
          {isDragActive ? "Rilascia i file qui" : "Trascina qui i file o clicca per selezionarli"}
        </div>
        <div className="small text-muted mt-1">
          Formati: {ALLOWED_EXTENSIONS_TEXT}. Dimensione massima: 20 MB per file.
        </div>
      </div>

      <AssetsUploadQueueList
        queue={uploadQueue}
        uploading={uploading}
        onUpload={onUploadQueuedFiles}
        onClear={onClearQueue}
      />

      <div className="row g-2 mb-3">
        <div className="col-12 col-md-4">
          <Form.Group controlId="assets-file-draft-name">
            <Form.Label className="small mb-1">Nome materiale senza upload</Form.Label>
            <Form.Control
              value={fileDraft.name}
              onChange={(event) => onFileDraftChange("name", event.target.value)}
              placeholder="Nome materiale senza upload"
            />
          </Form.Group>
        </div>
        <div className="col-12 col-md-3">
          <Form.Group controlId="assets-file-draft-type">
            <Form.Label className="small mb-1">Tipo materiale</Form.Label>
            <Form.Control
              value={fileDraft.type}
              onChange={(event) => onFileDraftChange("type", event.target.value)}
              placeholder="Tipo, es. PDF/DOCX"
            />
          </Form.Group>
        </div>
        <div className="col-12 col-md-4">
          <Form.Group controlId="assets-file-draft-notes">
            <Form.Label className="small mb-1">Note contenuto</Form.Label>
            <Form.Control
              value={fileDraft.notes}
              onChange={(event) => onFileDraftChange("notes", event.target.value)}
              placeholder="Note contenuto"
            />
          </Form.Group>
        </div>
        <div className="col-12 col-md-1 d-grid align-items-end">
          <Button type="button" variant="outline-secondary" onClick={onAddFileMetadata}>
            Registra
          </Button>
        </div>
      </div>

      <AssetsUploadedFilesList
        files={uploadedFiles}
        fileActionId={fileActionId}
        onUpdateMetadata={onUpdateFileMetadata}
        onOpenOrDownload={onOpenOrDownloadFile}
        onRemove={onRemoveFile}
      />
    </Card.Body>
  </Card>
);

export default AssetsFilesCard;
