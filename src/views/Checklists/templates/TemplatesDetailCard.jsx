import React from 'react';
import { Loader2, Save, Trash2 } from 'lucide-react';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { Input } from '../../../components/ui/input';
import { Textarea } from '../../../components/ui/textarea';
import { getErrorMessage } from './templatesPureFunctions';
import TemplatesItemsList from './TemplatesItemsList';
import TemplatesNewItemForm from './TemplatesNewItemForm';

// Colonna di destra: il memo aperto. Ha quattro facce — nessun memo scelto,
// caricamento, errore, dettaglio — e quando c'e' il dettaglio monta al suo
// interno l'elenco degli step e il form per aggiungerne uno.
const TemplatesDetailCard = ({
  selectedTemplateId,
  loading,
  error,
  template,
  canManageTemplates,
  canDeleteTemplate,
  editingTemplateName,
  onEditingTemplateNameChange,
  editingTemplateDescription,
  onEditingTemplateDescriptionChange,
  onUpdateTemplate,
  updatingTemplate,
  onArchiveTemplate,
  archivingTemplate,
  onDeleteTemplatePermanently,
  deletingTemplate,
  itemsListProps,
  newItemFormProps,
}) => (
  <Card className="checklists-detail-card glass-sep">
    {!selectedTemplateId && (
      <CardContent className="pt-6">
        <p className="mb-0 text-sm text-textMuted">Seleziona un memo per visualizzare e modificare gli step.</p>
      </CardContent>
    )}

    {selectedTemplateId && loading && (
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 text-sm text-textMuted">
          <Loader2 className="h-4 w-4 animate-spin" />
          Caricamento dettaglio memo...
        </div>
      </CardContent>
    )}

    {selectedTemplateId && error && (
      <CardContent className="pt-6">
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {getErrorMessage(error)}
        </div>
      </CardContent>
    )}

    {template && (
      <>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base">Dettaglio Memo</CardTitle>
              <CardDescription>
                Configura gli step operativi che i dipendenti vedranno come promemoria.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {template.isArchived && <Badge variant="secondary">Archiviato</Badge>}
              {/* Un memo si archivia; solo quando e' gia' archiviato si puo'
                  eliminare per sempre. I due comandi non convivono mai. */}
              {canDeleteTemplate && (
                template.isArchived ? (
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => void onDeleteTemplatePermanently()}
                    disabled={deletingTemplate}
                  >
                    <Trash2 className="h-4 w-4" />
                    Elimina definitivamente
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => void onArchiveTemplate()}
                    disabled={archivingTemplate}
                  >
                    <Trash2 className="h-4 w-4" />
                    Archivia
                  </Button>
                )
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid gap-2 rounded-md border border-cardBorder p-3 checklists-editor-box">
            <Input
              value={editingTemplateName}
              onChange={(event) => onEditingTemplateNameChange(event.target.value)}
              placeholder="Nome memo"
              disabled={!canManageTemplates || updatingTemplate}
            />
            <Textarea
              value={editingTemplateDescription}
              onChange={(event) => onEditingTemplateDescriptionChange(event.target.value)}
              rows={3}
              placeholder="Descrizione memo"
              disabled={!canManageTemplates || updatingTemplate}
            />
            {canManageTemplates && (
              <Button
                type="button"
                variant="outline"
                onClick={() => void onUpdateTemplate()}
                disabled={updatingTemplate}
              >
                {updatingTemplate ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Salva memo
              </Button>
            )}
          </div>

          <div className="space-y-2">
            <div className="checklists-list-caption">
              <h5 className="mb-0 text-sm font-semibold text-text">Step Memo</h5>
              <span>{template.items.length} elementi</span>
            </div>
            <TemplatesItemsList items={template.items} {...itemsListProps} />
          </div>

          {canManageTemplates && <TemplatesNewItemForm {...newItemFormProps} />}
        </CardContent>
      </>
    )}
  </Card>
);

export default TemplatesDetailCard;
