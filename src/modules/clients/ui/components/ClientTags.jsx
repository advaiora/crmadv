import React from "react";
import { Button } from "react-bootstrap";
import { getTagBadgeStyle } from "../helpers";

// Tag di una riga cliente. Memoizzato: non si ri-renderizza all'apertura di una
// linguetta finche' le sue props (client stabile, onEditTags stabile) non cambiano.
const ClientTags = React.memo(function ClientTags({ client, maxVisible = 3, canEdit = false, onEditTags }) {
  const tags = Array.isArray(client?.tags) ? client.tags.filter(Boolean) : [];
  const visibleTags = tags.slice(0, maxVisible);
  const remainingCount = tags.length - visibleTags.length;

  return (
    <div className="clients-tags clients-list-tags">
      {visibleTags.length === 0 && <span className="text-muted small">Nessun tag</span>}
      {visibleTags.map((tag) => (
        <span key={`${client.id}-${tag}`} className="badge clients-tag-badge" style={getTagBadgeStyle(tag)}>
          {tag}
        </span>
      ))}
      {remainingCount > 0 && <span className="badge bg-light text-muted border">+{remainingCount}</span>}
      {canEdit && (
        <Button
          type="button"
          size="sm"
          variant="outline-secondary"
          className="clients-tag-edit-btn"
          onClick={() => onEditTags(client)}
        >
          Modifica tag
        </Button>
      )}
    </div>
  );
});

export default ClientTags;
