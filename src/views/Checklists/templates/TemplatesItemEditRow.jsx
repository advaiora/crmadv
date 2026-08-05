import React from 'react';
import { Save } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Textarea } from '../../../components/ui/textarea';

// La faccia "in modifica" di una riga dell'elenco step.
//
// Riceve sia `editingItem` (la bozza che si sta modificando) sia `item` (lo
// step come sta sul server): servono tutti e due, vedi il menu assegnatario.
const TemplatesItemEditRow = ({
  item,
  editingItem,
  onEditingItemChange,
  assignableUsers,
  onSaveItem,
  savingItem,
}) => (
  <div className="space-y-2">
    <Input
      value={editingItem.title}
      onChange={(event) => onEditingItemChange((current) => ({ ...current, title: event.target.value }))}
    />
    <Textarea
      rows={2}
      value={editingItem.description || ''}
      onChange={(event) =>
        onEditingItemChange((current) => ({ ...current, description: event.target.value }))
      }
    />
    <label className="flex items-center gap-2 text-sm checklists-checkbox-label">
      <input
        type="checkbox"
        checked={Boolean(editingItem.isRequired)}
        onChange={(event) =>
          onEditingItemChange((current) => ({ ...current, isRequired: event.target.checked }))
        }
        className="checklists-checkbox"
      />
      Step obbligatorio
    </label>
    <label className="flex items-center gap-2 text-sm checklists-checkbox-label">
      <input
        type="checkbox"
        checked={Boolean(editingItem.requiresEvidenceSnapshot)}
        onChange={(event) =>
          onEditingItemChange((current) => ({
            ...current,
            requiresEvidenceSnapshot: event.target.checked,
          }))
        }
        className="checklists-checkbox"
      />
      Richiede evidenza (nota/link)
    </label>
    <label className="flex items-center gap-2 text-sm checklists-checkbox-label">
      <input
        type="checkbox"
        checked={Boolean(editingItem.isCriticalSnapshot)}
        onChange={(event) =>
          onEditingItemChange((current) => ({
            ...current,
            isCriticalSnapshot: event.target.checked,
          }))
        }
        className="checklists-checkbox"
      />
      Step critico
    </label>
    <div className="space-y-1">
      <p className="mb-0 text-xs text-textMuted">Assegnatario default</p>
      <select
        className="form-select"
        value={editingItem.defaultAssignedToUserId || ''}
        onChange={(event) =>
          onEditingItemChange((current) => ({
            ...current,
            defaultAssignedToUserId: event.target.value,
          }))
        }
      >
        <option value="">Nessun assegnatario</option>
        {assignableUsers.map((user) => (
          <option key={user.userId} value={user.userId}>
            {user.name}
          </option>
        ))}
        {/* Chi era assegnato ma non e' piu' assegnabile (utente disattivato)
            resta scelto, con una voce fatta apposta. Il nome si legge da `item`,
            cioe' dallo step come sta sul server: `editingItem` quel nome non ce
            l'ha, quindi prenderlo da li' lascerebbe la voce senza etichetta. */}
        {editingItem.defaultAssignedToUserId
          && !assignableUsers.some(
            (user) => user.userId === editingItem.defaultAssignedToUserId,
          ) ? (
            <option value={editingItem.defaultAssignedToUserId}>
              {item.defaultAssignedToUserName || 'Utente disattivato'}
            </option>
          ) : null}
      </select>
    </div>
    <div className="flex items-center gap-2">
      <Button
        type="button"
        size="sm"
        onClick={() => void onSaveItem()}
        disabled={savingItem}
      >
        <Save className="h-4 w-4" />
        Salva
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={() => onEditingItemChange(null)}>
        Annulla
      </Button>
    </div>
  </div>
);

export default TemplatesItemEditRow;
