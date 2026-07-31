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

// Riga desktop completa (griglia + linguetta), memoizzata: aprire/chiudere una
// riga NON ri-renderizza le altre 11 (props invariate) -> toggle quasi gratis.
// Le callback (onToggle, onOpen, ...) DEVONO restare stabili nel genitore
// (useCallback), altrimenti la memoizzazione smette di funzionare in silenzio.
const ClientGridRow = React.memo(function ClientGridRow({
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
  const detailId = `client-detail-${client.id}`;
  return (
    <>
      <div
        className={`clients-grid-row clients-row-clickable ${isExpanded ? "clients-row-expanded" : ""}`.trim()}
        aria-label={`Apri scheda di ${client.name}`}
        {...askAiRowProps("client", client)}
        {...rowActivationProps(() => onOpen(client), { role: "row" })}
      >
        <div className="clients-grid-cell clients-col-disclosure" role="cell">
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
        </div>
        <div className="clients-grid-cell" role="cell">
          <div className="clients-row-primary">
            <ClientAvatar name={client.name} type={client.type} />
            <div className="clients-row-name-wrap">
              <p className="clients-row-name">{client.name}</p>
            </div>
          </div>
        </div>
        <div className="clients-grid-cell" role="cell">
          <ClientTypeBadge type={client.type} />
        </div>
        <div className="clients-grid-cell clients-cell-email" role="cell">
          {client.email || <span className="text-muted">-</span>}
        </div>
        <div className="clients-grid-cell" role="cell">
          {client.phone || <span className="text-muted">-</span>}
        </div>
        <div className="clients-grid-cell" role="cell">
          <ClientTags client={client} maxVisible={3} canEdit={canEdit} onEditTags={onEditTags} />
        </div>
        <div className="clients-grid-cell clients-cell-actions" role="cell">
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
      <CollapsibleSection open={isExpanded} id={detailId}>
        <ClientRowDetails client={client} />
      </CollapsibleSection>
    </>
  );
});

export default ClientGridRow;
