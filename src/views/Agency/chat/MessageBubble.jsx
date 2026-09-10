import React from "react";
import { Spinner } from "react-bootstrap";
import { formatTime } from "./chatShared";
import { IconAttach } from "./chatIcons";
import { MessagingAttachmentList } from "./messagingAttachments";
import { uploadMessagingAttachment } from "../../../modules/messaging/api/messagingApi";

// Bolla della messaggistica 1-a-1 (estratta da MessagingPanel.jsx per gli allegati,
// CRMA-138). NON e' ChatBubble (quella della chat AI): li' servono il ruolo
// assistente, le citazioni RAG e l'etichetta dell'autore — cose che qui non
// esistono, e in una 1-a-1 l'autore e' ovvio. Inoltre `isMine` lo dice il server,
// non lo si deduce dall'id dell'autore.
//
// Allegare o togliere un file resta possibile solo sui PROPRI messaggi (il server
// lo impone comunque via senderUserId): il bottone "allega" e il tasto di rimozione
// sul chip sono una cortesia per non mostrare un'azione che verrebbe rifiutata,
// non la difesa vera.
const MessageBubble = ({ message, canAttach, onAttachmentsChanged }) => {
  const [uploading, setUploading] = React.useState(false);
  const [error, setError] = React.useState("");
  const fileInputRef = React.useRef(null);

  const canManageAttachments = Boolean(message.isMine) && canAttach;

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    // Azzerato subito: cosi' si puo' ricaricare lo stesso file una seconda volta.
    event.target.value = "";
    if (!file) {
      return;
    }
    setUploading(true);
    setError("");
    try {
      await uploadMessagingAttachment(message.id, file);
      await onAttachmentsChanged();
    } catch (uploadError) {
      // Il testo arriva gia' pronto dal server (limite di peso, tipo non ammesso,
      // sesto allegato): non si sostituisce con un messaggio generico.
      setError(uploadError?.message || "Caricamento dell'allegato non riuscito.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={`d-flex mb-2 ${message.isMine ? "justify-content-end" : "justify-content-start"}`}>
      <div className="ai-chat-msg-bubble-wrap">
        <div className={`rounded-3 px-3 py-2 ${message.isMine ? "ai-chat-bubble-mine" : "bg-body-secondary border"}`}>
          {message.body}
          <MessagingAttachmentList
            attachments={message.attachments}
            canRemove={canManageAttachments}
            onRemoved={onAttachmentsChanged}
            onError={setError}
            className={message.isMine ? "is-on-primary" : ""}
          />
        </div>

        <div className={`small text-muted mt-1 d-flex align-items-center gap-2 ${message.isMine ? "justify-content-end" : ""}`}>
          <span>{formatTime(message.createdAt)}</span>
          {canManageAttachments && (
            <>
              <input ref={fileInputRef} type="file" className="d-none" onChange={handleFileChange} />
              <button
                type="button"
                className="ai-chat-msg-attach-btn"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                title="Allega un file a questo messaggio"
                aria-label="Allega un file a questo messaggio"
              >
                {uploading ? <Spinner animation="border" size="sm" /> : <IconAttach size={12} />}
              </button>
            </>
          )}
        </div>

        {error && <div className="small text-danger mt-1">{error}</div>}
      </div>
    </div>
  );
};

export default MessageBubble;
