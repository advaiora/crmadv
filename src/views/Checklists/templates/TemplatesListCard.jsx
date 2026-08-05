import React from 'react';
import { Filter, Loader2, Plus, Search } from 'lucide-react';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { Input } from '../../../components/ui/input';
import { Textarea } from '../../../components/ui/textarea';
import { getErrorMessage } from './templatesPureFunctions';

// Colonna di sinistra: ricerca, filtro archiviati, elenco dei memo e form per
// crearne uno nuovo.
const TemplatesListCard = ({
  templateSearch,
  onSearchChange,
  showArchivedTemplates,
  onToggleArchived,
  loading,
  error,
  visibleTemplates,
  selectedTemplateId,
  onSelectTemplate,
  canCreateTemplate,
  newTemplateName,
  onNewTemplateNameChange,
  newTemplateDescription,
  onNewTemplateDescriptionChange,
  onCreateTemplate,
  creating,
}) => (
  <Card className="checklists-sidebar-card glass-sep">
    <CardHeader>
      <CardTitle className="text-base">Memo</CardTitle>
      <CardDescription>Catalogo memo operativi disponibili per il workspace.</CardDescription>
    </CardHeader>
    <CardContent className="space-y-3">
      <div className="checklists-filters">
        <div className="checklists-search">
          <Search size={14} className="checklists-search-icon" />
          <Input
            value={templateSearch}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Cerca memo..."
          />
        </div>
        <Button
          type="button"
          variant={showArchivedTemplates ? 'default' : 'outline'}
          size="sm"
          onClick={onToggleArchived}
          className="checklists-filter-btn"
        >
          <Filter className="h-4 w-4" />
          {showArchivedTemplates ? 'Nascondi archiviati' : 'Mostra archiviati'}
        </Button>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-textMuted">
          <Loader2 className="h-4 w-4 animate-spin" />
          Caricamento memo...
        </div>
      )}

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {getErrorMessage(error)}
        </div>
      )}

      {!loading && visibleTemplates.length > 0 && (
        <div className="space-y-2 checklists-template-list">
          <div className="checklists-list-caption">
            <span>{visibleTemplates.length} memo</span>
            <span>{showArchivedTemplates ? 'Archiviati inclusi' : 'Solo attivi'}</span>
          </div>
          {visibleTemplates.map((template) => (
            <button
              key={template.id}
              type="button"
              className={`w-full rounded-md border px-3 py-2 text-left transition checklists-template-item ${
                selectedTemplateId === template.id
                  ? 'is-active'
                  : 'border-cardBorder bg-card hover:bg-hover'
              }`}
              onClick={() => onSelectTemplate(template.id)}
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="font-medium text-sm text-text">{template.name}</span>
                <Badge variant={template.isArchived ? 'secondary' : 'outline'}>
                  {template.itemsCount} step
                </Badge>
              </div>
              <p className="mb-0 text-xs text-textMuted">
                {template.description || 'Nessuna descrizione'}
              </p>
            </button>
          ))}
        </div>
      )}

      {!loading && visibleTemplates.length === 0 && (
        <div className="rounded-md border border-dashed border-cardBorder px-3 py-3 text-sm text-textMuted">
          Nessun memo trovato con i filtri attuali.
        </div>
      )}

      {canCreateTemplate && (
        <form className="space-y-2 rounded-md border border-dashed border-cardBorder p-3 bg-card/80" onSubmit={onCreateTemplate}>
          <p className="mb-0 text-xs font-semibold uppercase tracking-wide text-textMuted">Nuovo memo</p>
          <Input
            value={newTemplateName}
            onChange={(event) => onNewTemplateNameChange(event.target.value)}
            placeholder="Nome memo"
            disabled={creating}
          />
          <Textarea
            value={newTemplateDescription}
            onChange={(event) => onNewTemplateDescriptionChange(event.target.value)}
            placeholder="Descrizione memo (opzionale)"
            rows={3}
            disabled={creating}
          />
          <Button
            type="submit"
            variant="outline"
            className="w-full"
            disabled={creating}
          >
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Crea memo
          </Button>
        </form>
      )}
    </CardContent>
  </Card>
);

export default TemplatesListCard;
