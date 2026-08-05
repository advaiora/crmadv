import React from 'react';
import { ChevronDown, ChevronUp, Pencil, Trash2 } from 'lucide-react';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import TemplatesItemEditRow from './TemplatesItemEditRow';

// L'elenco degli step del memo aperto. Ogni riga ha due facce: quella di
// lettura, qui sotto, e quella in modifica, in TemplatesItemEditRow.
//
// I bottoni "sposta" ed "elimina" si spengono su TUTTE le righe mentre una
// qualsiasi operazione e' in corso, non solo su quella toccata: e' il
// comportamento attuale, perche' gli stati di caricamento sono uno per tipo di
// azione e non uno per riga.
const TemplatesItemsList = ({
  items,
  editingItem,
  onEditingItemChange,
  assignableUsers,
  canManageTemplates,
  canDeleteTemplate,
  onSaveItem,
  onDeleteItem,
  onReorderItem,
  savingItem,
  deletingItem,
  reordering,
}) => (
  <>
    {items.length === 0 && (
      <p className="rounded-md border border-dashed border-cardBorder px-3 py-2 text-sm text-textMuted">
        Nessuno step presente in questo memo.
      </p>
    )}

    {items.map((item) => (
      <div key={item.id} className="rounded-md border border-cardBorder p-3 checklists-item-row">
        {editingItem?.id === item.id ? (
          <TemplatesItemEditRow
            item={item}
            editingItem={editingItem}
            onEditingItemChange={onEditingItemChange}
            assignableUsers={assignableUsers}
            onSaveItem={onSaveItem}
            savingItem={savingItem}
          />
        ) : (
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="mb-1 text-sm font-medium text-text">{item.title}</p>
              {item.description && <p className="mb-1 text-xs text-textMuted">{item.description}</p>}
              <div className="flex flex-wrap gap-2">
                <Badge variant={item.isRequired ? 'warning' : 'outline'}>
                  {item.isRequired ? 'Obbligatorio' : 'Facoltativo'}
                </Badge>
                {item.requiresEvidenceSnapshot && <Badge variant="secondary">Evidenza richiesta</Badge>}
                {item.isCriticalSnapshot && <Badge variant="destructive">Critico</Badge>}
                {item.defaultAssignedToUserName && (
                  <Badge variant="outline">
                    Assegnatario default: {item.defaultAssignedToUserName}
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1">
              {canManageTemplates && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 px-2 text-text hover:bg-hover"
                    title="Sposta su"
                    aria-label="Sposta step su"
                    onClick={() => void onReorderItem(item.id, -1)}
                    disabled={reordering}
                  >
                    <ChevronUp className="h-4 w-4" />
                    <span>Su</span>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 px-2 text-text hover:bg-hover"
                    title="Sposta giu"
                    aria-label="Sposta step giu"
                    onClick={() => void onReorderItem(item.id, 1)}
                    disabled={reordering}
                  >
                    <ChevronDown className="h-4 w-4" />
                    <span>Giu</span>
                  </Button>
                </>
              )}
              {canManageTemplates && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 px-2 text-text hover:bg-hover"
                  title="Modifica step"
                  aria-label="Modifica step"
                  onClick={() =>
                    onEditingItemChange({
                      id: item.id,
                      title: item.title,
                      description: item.description || '',
                      isRequired: item.isRequired,
                      requiresEvidenceSnapshot: item.requiresEvidenceSnapshot,
                      isCriticalSnapshot: item.isCriticalSnapshot,
                      defaultAssignedToUserId: item.defaultAssignedToUserId || '',
                    })
                  }
                >
                  <Pencil className="h-4 w-4" />
                  <span>Modifica</span>
                </Button>
              )}
              {canDeleteTemplate && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 px-2 text-destructive hover:bg-destructive/10"
                  title="Elimina step"
                  aria-label="Elimina step"
                  onClick={() => void onDeleteItem(item.id)}
                  disabled={deletingItem}
                >
                  <Trash2 className="h-4 w-4" />
                  <span>Elimina</span>
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    ))}
  </>
);

export default TemplatesItemsList;
