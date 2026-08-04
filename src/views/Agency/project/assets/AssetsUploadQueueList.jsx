import React from "react";
import { Badge, Button, Spinner } from "react-bootstrap";
import { formatFileSize, getFriendlyFileStatus } from "./assetsFormatters";
import { FILE_STATUS_VARIANT } from "./assetsPageConstants";

// La coda: i file trascinati che non sono ancora stati caricati, piu' quelli
// scartati dal riquadro con il motivo. Non compare finche' la coda e' vuota.
//
// "Carica file in coda" resta spento se nella coda ci sono solo file scartati:
// non c'e' niente da mandare al server.
const AssetsUploadQueueList = ({ queue, uploading, onUpload, onClear }) => {
  if (!queue?.length) {
    return null;
  }

  return (
    <div className="border rounded-3 p-2 mb-3">
      <div className="d-flex justify-content-between align-items-center gap-2 mb-2">
        <div className="small fw-semibold">File in coda</div>
        <div className="d-flex gap-2">
          <Button size="sm" variant="outline-secondary" onClick={onClear} disabled={uploading}>
            Pulisci coda
          </Button>
          <Button
            size="sm"
            variant="outline-primary"
            onClick={onUpload}
            disabled={uploading || !queue.some((entry) => entry.status === "queued")}
          >
            {uploading ? <><Spinner animation="border" size="sm" className="me-2" />Caricamento...</> : "Carica file in coda"}
          </Button>
        </div>
      </div>
      <div className="d-flex flex-column gap-2">
        {queue.map((entry) => (
          <div key={entry.id} className="d-flex justify-content-between align-items-start gap-2 border rounded-3 p-2">
            <div>
              <div className="small fw-semibold">{entry.name}</div>
              <div className="small text-muted">{formatFileSize(entry.size)}</div>
              {entry.error && <div className="small text-danger">{entry.error}</div>}
            </div>
            <Badge bg={FILE_STATUS_VARIANT[entry.status] || "secondary"}>
              {getFriendlyFileStatus(entry.status)}
            </Badge>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AssetsUploadQueueList;
