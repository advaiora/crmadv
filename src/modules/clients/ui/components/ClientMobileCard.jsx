import React from "react";
import { ChevronRight } from "lucide-react";
import ClientActionsMenu from "./ClientActionsMenu";
import ClientAvatar from "./ClientAvatar";
import ClientRowDetails from "./ClientRowDetails";
import ClientTags from "./ClientTags";
import ClientTypeBadge from "./ClientTypeBadge";
import CollapsibleSection from "../../../../components/ui/CollapsibleSection";
import { rowActivationProps } from "../../../../utils/rowActivation";
import { askAiRowProps } from "../../../../views/Agency/chat/askAi";

// Card mobile completa, memoizzata (stessa logica di ClientGridRow: le callback
// del genitore devono restare stabili, o la memo smette di funzionare).
// Nota: l'id della linguetta ha il suffisso -m- per non collidere con la riga
// desktop nello stesso DOM (aria-controls univoco).
const ClientMobileCard = React.memo(function ClientMobileCard({
  client,
  isExpanded,
  canEdit,
  canDelete,
  onToggle,
  onOpen,
  onEdit,
  onDelete,
  onEditTags,
}) {
  const detailId = `client-detail-m-${client.id}`;
  return (
    <div
      className="clients-mobile-card clients-row-clickable"
      aria-label={`Apri scheda di ${client.name}`}
      {...askAiRowProps("client", client)}
      {...rowActivationProps(() => onOpen(client))}
    >
      <div className="d-flex justify-content-between align-items-start gap-2">
        <div className="d-flex align-items-center gap-2">
          <ClientAvatar name={client.name} type={client.type} size="sm" />
          <div>
            <div className="fw-semibold">{client.name}</div>
            <div className="text-muted clients-mobile-meta">{client.email || "Email non impostata"}</div>
          </div>
        </div>
        <div className="d-flex align-items-center gap-1">
          <button
            type="button"
            className="clients-row-disclosure"
            onClick={() => onToggle(client.id)}
            aria-expanded={isExpanded}
            aria-controls={detailId}
            aria-label={isExpanded ? `Nascondi dettagli di ${client.name}` : `Mostra dettagli di ${client.name}`}
          >
            <ChevronRight size={16} />
          </button>
          <ClientActionsMenu
            client={client}
            canEdit={canEdit}
            canDelete={canDelete}
            onOpen={onOpen}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        </div>
      </div>
      <div className="d-flex justify-content-between align-items-center mt-3">
        <ClientTypeBadge type={client.type} />
        <div className="clients-mobile-tags">
          <ClientTags client={client} maxVisible={2} canEdit={canEdit} onEditTags={onEditTags} />
        </div>
      </div>
      <div className="text-muted clients-mobile-meta mt-2">{client.phone || "Telefono non impostato"}</div>
      <CollapsibleSection open={isExpanded} id={detailId} className="clients-mobile-detail">
        <ClientRowDetails client={client} />
      </CollapsibleSection>
    </div>
  );
});

export default ClientMobileCard;
