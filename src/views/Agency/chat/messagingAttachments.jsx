import React from "react";
import { Download, FileText, X } from "lucide-react";
import { Spinner } from "react-bootstrap";
import { attachmentTypeLabel, formatAttachmentSize } from "./chatShared";
import { deleteMessagingAttachment, downloadMessagingAttachment } from "../../../modules/messaging/api/messagingApi";

// Allegati dei Messaggi (A1 punto 8a-bis). NON e' chatAttachments.jsx: quella e'
// degli allegati della Chat AI (con gli elementi CRM ed entita' oltre ai file);
// qui sono sempre e solo file, e cancellare/scaricare passano dal servizio dei
// Messaggi, non da quello della Chat AI. Il chip riusa pero' le stesse classi CSS
// (.ai-chat-attachment*), gia' a token.

const MessagingAttachmentChip = ({ attachment, canRemove, onRemoved, onError }) => {
  const [downloading, setDownloading] = React.useState(false);
  const [removing, setRemoving] = React.useState(false);

  const handleDownload = async () => {
    if (downloading) {
      return;
    }
    setDownloading(true);
    try {
      await downloadMessagingAttachment(attachment);
    } catch (error) {
      onError(error?.message || "Scaricamento dell'allegato non riuscito.");
    } finally {
      setDownloading(false);
    }
  };

  const handleRemove = async () => {
    if (removing) {
      return;
    }
    setRemoving(true);
    try {
      await deleteMessagingAttachment(attachment.id);
      await onRemoved();
    } catch (error) {
      onError(error?.message || "Rimozione dell'allegato non riuscita.");
      setRemoving(false);
    }
  };

  return (
    <span className="ai-chat-attachment" title={`${attachmentTypeLabel(attachment)}: ${attachment.label}`}>
      <FileText size={13} />
      <span className="ai-chat-attachment-label">{attachment.label}</span>
      {formatAttachmentSize(attachment) && (
        <span className="ai-chat-attachment-meta">{formatAttachmentSize(attachment)}</span>
      )}
      <button
        type="button"
        className="ai-chat-attachment-open"
        aria-label={`Scarica l'originale di ${attachment.label}`}
        onClick={handleDownload}
        disabled={downloading}
      >
        {downloading ? <Spinner animation="border" size="sm" /> : <Download size={12} />}
      </button>
      {canRemove && (
        <button
          type="button"
          className="ai-chat-attachment-remove"
          aria-label={`Togli allegato ${attachment.label}`}
          onClick={handleRemove}
          disabled={removing}
        >
          <X size={12} />
        </button>
      )}
    </span>
  );
};

// Elenco degli allegati sotto una bolla. `canRemove` vale solo per i messaggi
// propri (lo decide chi chiama, MessageBubble): il server rifiuta comunque la
// cancellazione su un messaggio altrui, questo e' solo il bottone in piu' o in meno.
export const MessagingAttachmentList = ({ attachments, canRemove, onRemoved, onError, className = "" }) => {
  if (!Array.isArray(attachments) || attachments.length === 0) {
    return null;
  }
  return (
    <div className={`ai-chat-attachments ${className}`}>
      {attachments.map((attachment) => (
        <MessagingAttachmentChip
          key={attachment.id}
          attachment={attachment}
          canRemove={canRemove}
          onRemoved={onRemoved}
          onError={onError}
        />
      ))}
    </div>
  );
};
