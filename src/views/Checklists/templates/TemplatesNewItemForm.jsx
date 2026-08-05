import React from 'react';
import { Loader2, Plus } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Textarea } from '../../../components/ui/textarea';

// Form in fondo al memo per aggiungere uno step.
const TemplatesNewItemForm = ({
  title,
  onTitleChange,
  description,
  onDescriptionChange,
  required,
  onRequiredChange,
  requiresEvidence,
  onRequiresEvidenceChange,
  critical,
  onCriticalChange,
  defaultAssignedToUserId,
  onDefaultAssignedToUserIdChange,
  assignableUsers,
  onSubmit,
  creating,
}) => (
  <form className="space-y-2 rounded-md border border-dashed border-cardBorder p-3 checklists-editor-box" onSubmit={onSubmit}>
    <p className="mb-0 text-xs font-semibold uppercase tracking-wide text-textMuted">Nuovo step</p>
    <Input
      value={title}
      onChange={(event) => onTitleChange(event.target.value)}
      placeholder="Titolo step"
      disabled={creating}
    />
    <Textarea
      rows={2}
      value={description}
      onChange={(event) => onDescriptionChange(event.target.value)}
      placeholder="Descrizione (opzionale)"
      disabled={creating}
    />
    <label className="flex items-center gap-2 text-sm checklists-checkbox-label">
      <input
        type="checkbox"
        checked={required}
        onChange={(event) => onRequiredChange(event.target.checked)}
        disabled={creating}
        className="checklists-checkbox"
      />
      Step obbligatorio
    </label>
    <label className="flex items-center gap-2 text-sm checklists-checkbox-label">
      <input
        type="checkbox"
        checked={requiresEvidence}
        onChange={(event) => onRequiresEvidenceChange(event.target.checked)}
        disabled={creating}
        className="checklists-checkbox"
      />
      Richiede evidenza (nota/link)
    </label>
    <label className="flex items-center gap-2 text-sm checklists-checkbox-label">
      <input
        type="checkbox"
        checked={critical}
        onChange={(event) => onCriticalChange(event.target.checked)}
        disabled={creating}
        className="checklists-checkbox"
      />
      Step critico
    </label>
    <div className="space-y-1">
      <p className="mb-0 text-xs text-textMuted">Assegnatario default</p>
      <select
        className="form-select"
        value={defaultAssignedToUserId}
        onChange={(event) => onDefaultAssignedToUserIdChange(event.target.value)}
        disabled={creating}
      >
        <option value="">Nessun assegnatario</option>
        {assignableUsers.map((user) => (
          <option key={user.userId} value={user.userId}>
            {user.name}
          </option>
        ))}
      </select>
    </div>
    <Button type="submit" variant="outline" disabled={creating}>
      {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
      Aggiungi step
    </Button>
  </form>
);

export default TemplatesNewItemForm;
