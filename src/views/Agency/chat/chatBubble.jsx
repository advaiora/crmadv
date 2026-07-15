import React from "react";
import { Badge } from "react-bootstrap";
import { authorLabel, formatTime } from "./chatShared";
import { AttachmentChips } from "./chatAttachments";

// Bolla di conversazione condivisa (Fase 1/2), riusata sia dalla scheda Chat del
// progetto sia dal popup di Chat globale, cosi' le bolle restano identiche ovunque.
// Le utility (formatTime, authorLabel, mentionsAi) stanno in ./chatShared.

// Una bolla di conversazione. I messaggi propri a destra; quelli degli altri
// (utenti o AI) a sinistra, con l'autore mostrato sopra. Gli allegati (Fase 3a)
// stanno sotto al testo, dentro la bolla. Le fonti citate (RAG) dell'assistente
// sono in un dettaglio richiudibile sotto la risposta.
const ChatBubble = ({ message, currentUserId }) => {
  const isAssistant = message.role === "assistant";
  const isMine = !isAssistant && Boolean(message.author?.id) && message.author.id === currentUserId;
  const citations = Array.isArray(message.citations) ? message.citations : [];
  const attachments = Array.isArray(message.attachments) ? message.attachments : [];
  const label = isMine ? "Tu" : authorLabel(message);

  return (
    <div className={`d-flex mb-3 ${isMine ? "justify-content-end" : "justify-content-start"}`}>
      <div style={{ maxWidth: "80%" }}>
        <div className={`small text-muted mb-1 ${isMine ? "text-end" : ""}`}>
          {isAssistant ? "🤖 " : ""}
          {label}
        </div>
        <div
          className={`rounded-3 px-3 py-2 ${isMine ? "bg-primary text-white" : "bg-body-secondary border"}`}
          style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}
        >
          {message.content}
          {attachments.length > 0 && (
            <AttachmentChips attachments={attachments} className={isMine ? "is-on-primary" : ""} />
          )}
        </div>
        <div className={`small text-muted mt-1 ${isMine ? "text-end" : ""}`}>{formatTime(message.createdAt)}</div>
        {isAssistant && citations.length > 0 && (
          <details className="small mt-1">
            <summary className="text-muted" style={{ cursor: "pointer" }}>
              Fonti citate ({citations.length})
            </summary>
            <div className="mt-2 d-flex flex-column gap-2">
              {citations.map((citation, index) => (
                <div key={`${citation.sourceId}-${index}`} className="border rounded-2 p-2 bg-body">
                  <div className="d-flex align-items-center gap-2 mb-1">
                    <Badge bg="light" text="dark" className="border">
                      [{index + 1}] {citation.sourceTitle}
                    </Badge>
                    {typeof citation.score === "number" && (
                      <span className="text-muted">rilevanza {Math.round(citation.score * 100)}%</span>
                    )}
                  </div>
                  <div className="text-muted">{citation.excerpt}</div>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>
    </div>
  );
};

export default ChatBubble;
