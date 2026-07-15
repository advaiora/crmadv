import React from "react";
import { BookOpen, FileText, Folder, Paperclip, Tag, User, X } from "react-feather";
import { Spinner } from "react-bootstrap";
import { attachmentIconKey, attachmentTypeLabel, formatAttachmentSize } from "./chatShared";

// Allegati della chat (Fase 3a), condivisi tra il popup globale e la scheda Chat
// del progetto: chip in composizione, chip dentro la bolla e selettore di elementi
// CRM. Solo token del tema (vedi ai-chat-widget.css), nessun colore a mano.

const ICONS = {
  file: FileText,
  project: Folder,
  client: User,
  source: BookOpen,
  quote: Tag,
};

const AttachmentIcon = ({ attachment, size = 13 }) => {
  const Icon = ICONS[attachmentIconKey(attachment)] || Paperclip;
  return <Icon size={size} />;
};

// Un chip di allegato. Con onRemove e' quello del composer (togliibile); senza,
// e' quello mostrato dentro la bolla del messaggio inviato.
export const AttachmentChip = ({ attachment, onRemove, busy = false }) => (
  <span className="ai-chat-attachment" title={`${attachmentTypeLabel(attachment)}: ${attachment.label}`}>
    <AttachmentIcon attachment={attachment} />
    <span className="ai-chat-attachment-label">{attachment.label}</span>
    {formatAttachmentSize(attachment) && (
      <span className="ai-chat-attachment-meta">{formatAttachmentSize(attachment)}</span>
    )}
    {onRemove && (
      <button
        type="button"
        className="ai-chat-attachment-remove"
        aria-label={`Togli allegato ${attachment.label}`}
        onClick={() => onRemove(attachment)}
        disabled={busy}
      >
        <X size={12} />
      </button>
    )}
  </span>
);

// Riga di chip. Usata sopra il composer e dentro la bolla.
export const AttachmentChips = ({ attachments, onRemove, busy = false, className = "" }) => {
  if (!Array.isArray(attachments) || attachments.length === 0) {
    return null;
  }
  return (
    <div className={`ai-chat-attachments ${className}`}>
      {attachments.map((attachment) => (
        <AttachmentChip key={attachment.id} attachment={attachment} onRemove={onRemove} busy={busy} />
      ))}
    </div>
  );
};

// Selettore degli elementi CRM da allegare. Progetti e clienti arrivano gia'
// filtrati per la visibilita' dell'utente (stessa lista del selettore d'ambito),
// quindi qui non serve altro controllo: il server rifiuta comunque cio' che non
// e' visibile. Fonti e preventivi si allegano dalle loro pagine, con "Chiedi all'AI".
export const AttachEntityPanel = ({ projects, clients, onPick, onClose, busy = false }) => {
  const [kind, setKind] = React.useState("project");
  const [query, setQuery] = React.useState("");

  const items = kind === "client" ? clients : projects;
  const normalized = query.trim().toLowerCase();
  const filtered = normalized
    ? items.filter((item) => String(item.name || "").toLowerCase().includes(normalized))
    : items;

  return (
    <div className="ai-chat-attach-panel">
      <div className="ai-chat-attach-head">
        <div className="ai-chat-attach-kinds" role="tablist" aria-label="Tipo di elemento">
          {[
            { key: "project", label: "Progetti" },
            { key: "client", label: "Clienti" },
          ].map((option) => (
            <button
              key={option.key}
              type="button"
              role="tab"
              aria-selected={kind === option.key}
              className={`ai-chat-attach-kind ${kind === option.key ? "is-active" : ""}`}
              onClick={() => setKind(option.key)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <button type="button" className="ai-chat-close" aria-label="Chiudi selettore" onClick={onClose}>
          <X size={15} />
        </button>
      </div>

      <input
        type="text"
        className="ai-chat-search-input ai-chat-attach-search"
        placeholder={kind === "client" ? "Cerca un cliente…" : "Cerca un progetto…"}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        aria-label="Cerca un elemento da allegare"
      />

      <div className="ai-chat-attach-list">
        {busy ? (
          <div className="ai-chat-centered">
            <Spinner animation="border" size="sm" role="status" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="ai-chat-empty">Nessun elemento trovato.</div>
        ) : (
          filtered.map((item) => (
            <button
              key={item.id}
              type="button"
              className="ai-chat-attach-row"
              onClick={() => onPick({ entityType: kind, entityId: item.id, name: item.name })}
            >
              {kind === "client" ? <User size={14} /> : <Folder size={14} />}
              <span className="ai-chat-attach-name">{item.name}</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
};
