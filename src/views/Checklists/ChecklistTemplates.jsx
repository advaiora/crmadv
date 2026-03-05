import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronUp, Filter, LayoutList, Loader2, Pencil, Plus, Save, Search, ShieldCheck, Sparkles, Trash2 } from 'lucide-react';
import { toast } from 'react-toastify';
import ModulePermissionGate from '../../components/guards/ModulePermissionGate';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { isApiError } from '../../modules/checklists/api/checklists.api';
import {
  useArchiveChecklistTemplate,
  useChecklistAssignableUsers,
  useChecklistTemplate,
  useChecklistTemplates,
  useCreateChecklistTemplate,
  useCreateChecklistTemplateItem,
  useDeleteChecklistTemplatePermanently,
  useDeleteChecklistTemplateItem,
  useReorderChecklistTemplateItems,
  useUpdateChecklistTemplate,
  useUpdateChecklistTemplateItem,
} from '../../modules/checklists/hooks/useChecklistsQueries';
import { hasPermission } from '../../utils/workspaceAccess';
import '../../styles/css/checklists-ui.css';

const getErrorMessage = (error) => {
  if (!error) {
    return 'Errore inatteso';
  }
  if (isApiError(error)) {
    return `${error.message} (${error.code || error.status || 'API_ERROR'})`;
  }
  return error?.message || 'Errore inatteso';
};

const normalizeTemplateName = (value) => String(value || '').trim().toLowerCase();

const ChecklistTemplatesContent = ({ access }) => {
  const canManageTemplates = hasPermission(access, 'checklists.manage_templates')
    || hasPermission(access, 'checklists.edit');
  const canCreateTemplate = canManageTemplates || hasPermission(access, 'checklists.create');
  const canDeleteTemplate = canManageTemplates || hasPermission(access, 'checklists.delete');

  const templatesQuery = useChecklistTemplates();
  const assignableUsersQuery = useChecklistAssignableUsers({ enabled: canManageTemplates });
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const selectedTemplateQuery = useChecklistTemplate(selectedTemplateId);

  const createTemplateMutation = useCreateChecklistTemplate();
  const updateTemplateMutation = useUpdateChecklistTemplate();
  const archiveTemplateMutation = useArchiveChecklistTemplate();
  const deleteTemplatePermanentlyMutation = useDeleteChecklistTemplatePermanently();
  const createItemMutation = useCreateChecklistTemplateItem();
  const updateItemMutation = useUpdateChecklistTemplateItem();
  const deleteItemMutation = useDeleteChecklistTemplateItem();
  const reorderItemsMutation = useReorderChecklistTemplateItems();

  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateDescription, setNewTemplateDescription] = useState('');
  const [editingTemplateName, setEditingTemplateName] = useState('');
  const [editingTemplateDescription, setEditingTemplateDescription] = useState('');

  const [newItemTitle, setNewItemTitle] = useState('');
  const [newItemDescription, setNewItemDescription] = useState('');
  const [newItemRequired, setNewItemRequired] = useState(true);
  const [newItemRequiresEvidence, setNewItemRequiresEvidence] = useState(false);
  const [newItemCritical, setNewItemCritical] = useState(false);
  const [newItemDefaultAssignedToUserId, setNewItemDefaultAssignedToUserId] = useState('');

  const [editingItem, setEditingItem] = useState(null);
  const [templateSearch, setTemplateSearch] = useState('');
  const [showArchivedTemplates, setShowArchivedTemplates] = useState(false);

  const templates = useMemo(() => templatesQuery.data || [], [templatesQuery.data]);
  const assignableUsers = useMemo(
    () => (Array.isArray(assignableUsersQuery.data) ? assignableUsersQuery.data : []),
    [assignableUsersQuery.data],
  );
  const visibleTemplates = useMemo(() => {
    const normalizedSearch = templateSearch.trim().toLowerCase();

    return templates.filter((template) => {
      if (!showArchivedTemplates && template.isArchived) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      return `${template.name} ${template.description || ''}`.toLowerCase().includes(normalizedSearch);
    });
  }, [showArchivedTemplates, templateSearch, templates]);
  const totalVisibleItems = useMemo(
    () => visibleTemplates.reduce((acc, template) => acc + (template.itemsCount || 0), 0),
    [visibleTemplates],
  );

  React.useEffect(() => {
    // Keep selection stable and avoid ping-pong when only archived templates exist.
    const selectableTemplates = showArchivedTemplates ? templates : visibleTemplates;

    if (selectableTemplates.length === 0) {
      if (selectedTemplateId) {
        setSelectedTemplateId('');
      }
      return;
    }

    const isSelectedVisible = selectableTemplates.some((template) => template.id === selectedTemplateId);
    if (!isSelectedVisible) {
      setSelectedTemplateId(selectableTemplates[0].id);
    }
  }, [selectedTemplateId, showArchivedTemplates, templates, visibleTemplates]);

  React.useEffect(() => {
    if (!selectedTemplateQuery.data) {
      return;
    }

    setEditingTemplateName(selectedTemplateQuery.data.name || '');
    setEditingTemplateDescription(selectedTemplateQuery.data.description || '');
  }, [selectedTemplateQuery.data?.id]);

  const handleCreateTemplate = async (event) => {
    event.preventDefault();
    const name = newTemplateName.trim();
    if (!name) {
      toast.error('Nome memo obbligatorio');
      return;
    }

    const duplicateTemplate = templates.find(
      (template) => normalizeTemplateName(template.name) === normalizeTemplateName(name),
    );
    if (duplicateTemplate) {
      setSelectedTemplateId(duplicateTemplate.id);
      if (duplicateTemplate.isArchived) {
        setShowArchivedTemplates(true);
        toast.error('Esiste gia un memo archiviato con questo nome');
      } else {
        toast.info('Esiste gia un memo con questo nome');
      }
      return;
    }

    try {
      const created = await createTemplateMutation.mutate({
        name,
        description: newTemplateDescription.trim() || undefined,
      });
      setNewTemplateName('');
      setNewTemplateDescription('');
      await templatesQuery.refetch();
      setSelectedTemplateId(created.id);
      toast.success('Memo creato');
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleUpdateTemplate = async () => {
    if (!selectedTemplateQuery.data?.id) {
      return;
    }

    const nextName = editingTemplateName.trim();
    if (!nextName) {
      toast.error('Nome memo obbligatorio');
      return;
    }

    const duplicateTemplate = templates.find(
      (template) =>
        template.id !== selectedTemplateQuery.data.id &&
        normalizeTemplateName(template.name) === normalizeTemplateName(nextName),
    );
    if (duplicateTemplate) {
      setSelectedTemplateId(duplicateTemplate.id);
      if (duplicateTemplate.isArchived) {
        setShowArchivedTemplates(true);
        toast.error('Nome gia usato da un memo archiviato');
      } else {
        toast.error('Nome gia usato da un altro memo');
      }
      return;
    }

    try {
      await updateTemplateMutation.mutate(selectedTemplateQuery.data.id, {
        name: nextName,
        description: editingTemplateDescription.trim() || null,
      });
      await templatesQuery.refetch();
      await selectedTemplateQuery.refetch();
      toast.success('Memo aggiornato');
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleArchiveTemplate = async () => {
    if (!selectedTemplateQuery.data?.id) {
      return;
    }

    const archivedTemplateId = selectedTemplateQuery.data.id;

    try {
      await archiveTemplateMutation.mutate(archivedTemplateId);
      await templatesQuery.refetch();
      setShowArchivedTemplates(true);
      setSelectedTemplateId(archivedTemplateId);
      await selectedTemplateQuery.refetch();
      toast.success('Memo archiviato');
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleDeleteTemplatePermanently = async () => {
    if (!selectedTemplateQuery.data?.id || !selectedTemplateQuery.data.isArchived) {
      return;
    }

    const confirmed = window.confirm(
      'Questa azione elimina definitivamente il memo archiviato. Vuoi continuare?',
    );
    if (!confirmed) {
      return;
    }

    try {
      await deleteTemplatePermanentlyMutation.mutate(selectedTemplateQuery.data.id);
      await templatesQuery.refetch();
      setSelectedTemplateId('');
      toast.success('Memo eliminato definitivamente');
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleCreateItem = async (event) => {
    event.preventDefault();
    if (!selectedTemplateQuery.data?.id) {
      return;
    }

    const title = newItemTitle.trim();
    if (!title) {
      toast.error('Titolo step obbligatorio');
      return;
    }

    try {
      await createItemMutation.mutate(selectedTemplateQuery.data.id, {
        title,
        description: newItemDescription.trim() || undefined,
        isRequired: newItemRequired,
        requiresEvidenceSnapshot: newItemRequiresEvidence,
        isCriticalSnapshot: newItemCritical,
        defaultAssignedToUserId: newItemDefaultAssignedToUserId || null,
      });
      setNewItemTitle('');
      setNewItemDescription('');
      setNewItemRequired(true);
      setNewItemRequiresEvidence(false);
      setNewItemCritical(false);
      setNewItemDefaultAssignedToUserId('');
      await selectedTemplateQuery.refetch();
      await templatesQuery.refetch();
      toast.success('Step aggiunto');
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleSaveItem = async () => {
    if (!selectedTemplateQuery.data?.id || !editingItem?.id) {
      return;
    }

    const normalizedTitle = String(editingItem.title || '').trim();
    if (!normalizedTitle) {
      toast.error('Titolo step obbligatorio');
      return;
    }

    try {
      await updateItemMutation.mutate(selectedTemplateQuery.data.id, editingItem.id, {
        title: normalizedTitle,
        description: editingItem.description?.trim() || null,
        isRequired: Boolean(editingItem.isRequired),
        requiresEvidenceSnapshot: Boolean(editingItem.requiresEvidenceSnapshot),
        isCriticalSnapshot: Boolean(editingItem.isCriticalSnapshot),
        defaultAssignedToUserId: editingItem.defaultAssignedToUserId || null,
      });
      setEditingItem(null);
      await selectedTemplateQuery.refetch();
      await templatesQuery.refetch();
      toast.success('Step aggiornato');
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleDeleteItem = async (itemId) => {
    if (!selectedTemplateQuery.data?.id) {
      return;
    }

    try {
      await deleteItemMutation.mutate(selectedTemplateQuery.data.id, itemId);
      await selectedTemplateQuery.refetch();
      await templatesQuery.refetch();
      toast.success('Step eliminato');
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleReorderItem = async (itemId, direction) => {
    if (!selectedTemplateQuery.data?.id || reorderItemsMutation.loading) {
      return;
    }

    const items = selectedTemplateQuery.data.items || [];
    const currentIndex = items.findIndex((item) => item.id === itemId);
    if (currentIndex < 0) {
      return;
    }

    const targetIndex = currentIndex + direction;
    if (targetIndex < 0 || targetIndex >= items.length) {
      return;
    }

    const orderedIds = items.map((item) => item.id);
    const temp = orderedIds[currentIndex];
    orderedIds[currentIndex] = orderedIds[targetIndex];
    orderedIds[targetIndex] = temp;

    try {
      await reorderItemsMutation.mutate(selectedTemplateQuery.data.id, orderedIds);
      await selectedTemplateQuery.refetch();
      toast.success('Ordine step aggiornato');
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <div className="container-fluid py-4 checklists-shell">
      <div className="mb-3">
        <Link to="/projects" className="text-textMuted hover:text-text">
          &larr; Torna a Progetti
        </Link>
      </div>

      <div className="checklists-hero mb-4">
        <div className="checklists-hero-title">
          <h3 className="mb-1 flex items-center gap-2">
            <Sparkles size={18} className="text-textMuted" />
            Memo Operativi
          </h3>
          <p className="text-muted mb-0">
            Libreria memo con tutti gli step necessari per eseguire operazioni in modo standard.
          </p>
        </div>

        <div className="checklists-hero-stats">
          <div className="checklists-stat-chip">
            <LayoutList size={14} />
            <span>{visibleTemplates.length} memo</span>
          </div>
          <div className="checklists-stat-chip">
            <ShieldCheck size={14} />
            <span>{totalVisibleItems} step totali</span>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[340px,1fr] checklists-grid">
        <Card className="checklists-sidebar-card">
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
                  onChange={(event) => setTemplateSearch(event.target.value)}
                  placeholder="Cerca memo..."
                />
              </div>
              <Button
                type="button"
                variant={showArchivedTemplates ? 'default' : 'outline'}
                size="sm"
                onClick={() => setShowArchivedTemplates((current) => !current)}
                className="checklists-filter-btn"
              >
                <Filter className="h-4 w-4" />
                {showArchivedTemplates ? 'Nascondi archiviati' : 'Mostra archiviati'}
              </Button>
            </div>

            {templatesQuery.loading && (
              <div className="flex items-center gap-2 text-sm text-textMuted">
                <Loader2 className="h-4 w-4 animate-spin" />
                Caricamento memo...
              </div>
            )}

            {templatesQuery.error && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                {getErrorMessage(templatesQuery.error)}
              </div>
            )}

            {!templatesQuery.loading && visibleTemplates.length > 0 && (
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
                    onClick={() => setSelectedTemplateId(template.id)}
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

            {!templatesQuery.loading && visibleTemplates.length === 0 && (
              <div className="rounded-md border border-dashed border-cardBorder px-3 py-3 text-sm text-textMuted">
                Nessun memo trovato con i filtri attuali.
              </div>
            )}

            {canCreateTemplate && (
              <form className="space-y-2 rounded-md border border-dashed border-cardBorder p-3 bg-card/80" onSubmit={handleCreateTemplate}>
                <p className="mb-0 text-xs font-semibold uppercase tracking-wide text-textMuted">Nuovo memo</p>
                <Input
                  value={newTemplateName}
                  onChange={(event) => setNewTemplateName(event.target.value)}
                  placeholder="Nome memo"
                  disabled={createTemplateMutation.loading}
                />
                <Textarea
                  value={newTemplateDescription}
                  onChange={(event) => setNewTemplateDescription(event.target.value)}
                  placeholder="Descrizione memo (opzionale)"
                  rows={3}
                  disabled={createTemplateMutation.loading}
                />
                <Button
                  type="submit"
                  variant="outline"
                  className="w-full"
                  disabled={createTemplateMutation.loading}
                >
                  {createTemplateMutation.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Crea memo
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        <Card className="checklists-detail-card">
          {!selectedTemplateId && (
            <CardContent className="pt-6">
              <p className="mb-0 text-sm text-textMuted">Seleziona un memo per visualizzare e modificare gli step.</p>
            </CardContent>
          )}

          {selectedTemplateId && selectedTemplateQuery.loading && (
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-sm text-textMuted">
                <Loader2 className="h-4 w-4 animate-spin" />
                Caricamento dettaglio memo...
              </div>
            </CardContent>
          )}

          {selectedTemplateId && selectedTemplateQuery.error && (
            <CardContent className="pt-6">
              <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                {getErrorMessage(selectedTemplateQuery.error)}
              </div>
            </CardContent>
          )}

          {selectedTemplateQuery.data && (
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
                    {selectedTemplateQuery.data.isArchived && <Badge variant="secondary">Archiviato</Badge>}
                    {canDeleteTemplate && (
                      selectedTemplateQuery.data.isArchived ? (
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() => void handleDeleteTemplatePermanently()}
                          disabled={deleteTemplatePermanentlyMutation.loading}
                        >
                          <Trash2 className="h-4 w-4" />
                          Elimina definitivamente
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() => void handleArchiveTemplate()}
                          disabled={archiveTemplateMutation.loading}
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
                    onChange={(event) => setEditingTemplateName(event.target.value)}
                    placeholder="Nome memo"
                    disabled={!canManageTemplates || updateTemplateMutation.loading}
                  />
                  <Textarea
                    value={editingTemplateDescription}
                    onChange={(event) => setEditingTemplateDescription(event.target.value)}
                    rows={3}
                    placeholder="Descrizione memo"
                    disabled={!canManageTemplates || updateTemplateMutation.loading}
                  />
                  {canManageTemplates && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void handleUpdateTemplate()}
                      disabled={updateTemplateMutation.loading}
                    >
                      {updateTemplateMutation.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      Salva memo
                    </Button>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="checklists-list-caption">
                    <h5 className="mb-0 text-sm font-semibold text-text">Step Memo</h5>
                    <span>{selectedTemplateQuery.data.items.length} elementi</span>
                  </div>
                  {selectedTemplateQuery.data.items.length === 0 && (
                    <p className="rounded-md border border-dashed border-cardBorder px-3 py-2 text-sm text-textMuted">
                      Nessuno step presente in questo memo.
                    </p>
                  )}

                  {selectedTemplateQuery.data.items.map((item) => {
                    const isEditingItem = editingItem?.id === item.id;
                    return (
                      <div key={item.id} className="rounded-md border border-cardBorder p-3 checklists-item-row">
                        {isEditingItem ? (
                          <div className="space-y-2">
                            <Input
                              value={editingItem.title}
                              onChange={(event) => setEditingItem((current) => ({ ...current, title: event.target.value }))}
                            />
                            <Textarea
                              rows={2}
                              value={editingItem.description || ''}
                              onChange={(event) =>
                                setEditingItem((current) => ({ ...current, description: event.target.value }))
                              }
                            />
                            <label className="flex items-center gap-2 text-sm checklists-checkbox-label">
                              <input
                                type="checkbox"
                                checked={Boolean(editingItem.isRequired)}
                                onChange={(event) =>
                                  setEditingItem((current) => ({ ...current, isRequired: event.target.checked }))
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
                                  setEditingItem((current) => ({
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
                                  setEditingItem((current) => ({
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
                                  setEditingItem((current) => ({
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
                                onClick={() => void handleSaveItem()}
                                disabled={updateItemMutation.loading}
                              >
                                <Save className="h-4 w-4" />
                                Salva
                              </Button>
                              <Button type="button" size="sm" variant="ghost" onClick={() => setEditingItem(null)}>
                                Annulla
                              </Button>
                            </div>
                          </div>
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
                                    onClick={() => void handleReorderItem(item.id, -1)}
                                    disabled={reorderItemsMutation.loading}
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
                                    onClick={() => void handleReorderItem(item.id, 1)}
                                    disabled={reorderItemsMutation.loading}
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
                                    setEditingItem({
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
                                  onClick={() => void handleDeleteItem(item.id)}
                                  disabled={deleteItemMutation.loading}
                                >
                                  <Trash2 className="h-4 w-4" />
                                  <span>Elimina</span>
                                </Button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {canManageTemplates && (
                  <form className="space-y-2 rounded-md border border-dashed border-cardBorder p-3 checklists-editor-box" onSubmit={handleCreateItem}>
                    <p className="mb-0 text-xs font-semibold uppercase tracking-wide text-textMuted">Nuovo step</p>
                    <Input
                      value={newItemTitle}
                      onChange={(event) => setNewItemTitle(event.target.value)}
                      placeholder="Titolo step"
                      disabled={createItemMutation.loading}
                    />
                    <Textarea
                      rows={2}
                      value={newItemDescription}
                      onChange={(event) => setNewItemDescription(event.target.value)}
                      placeholder="Descrizione (opzionale)"
                      disabled={createItemMutation.loading}
                    />
                    <label className="flex items-center gap-2 text-sm checklists-checkbox-label">
                      <input
                        type="checkbox"
                        checked={newItemRequired}
                        onChange={(event) => setNewItemRequired(event.target.checked)}
                        disabled={createItemMutation.loading}
                        className="checklists-checkbox"
                      />
                      Step obbligatorio
                    </label>
                    <label className="flex items-center gap-2 text-sm checklists-checkbox-label">
                      <input
                        type="checkbox"
                        checked={newItemRequiresEvidence}
                        onChange={(event) => setNewItemRequiresEvidence(event.target.checked)}
                        disabled={createItemMutation.loading}
                        className="checklists-checkbox"
                      />
                      Richiede evidenza (nota/link)
                    </label>
                    <label className="flex items-center gap-2 text-sm checklists-checkbox-label">
                      <input
                        type="checkbox"
                        checked={newItemCritical}
                        onChange={(event) => setNewItemCritical(event.target.checked)}
                        disabled={createItemMutation.loading}
                        className="checklists-checkbox"
                      />
                      Step critico
                    </label>
                    <div className="space-y-1">
                      <p className="mb-0 text-xs text-textMuted">Assegnatario default</p>
                      <select
                        className="form-select"
                        value={newItemDefaultAssignedToUserId}
                        onChange={(event) => setNewItemDefaultAssignedToUserId(event.target.value)}
                        disabled={createItemMutation.loading}
                      >
                        <option value="">Nessun assegnatario</option>
                        {assignableUsers.map((user) => (
                          <option key={user.userId} value={user.userId}>
                            {user.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <Button type="submit" variant="outline" disabled={createItemMutation.loading}>
                      {createItemMutation.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                      Aggiungi step
                    </Button>
                  </form>
                )}
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  );
};

const ChecklistTemplatesPage = () => {
  return (
    <ModulePermissionGate requiredModule="checklists" requiredPermission="checklists.view" moduleName="Checklist">
      {({ access }) => <ChecklistTemplatesContent access={access} />}
    </ModulePermissionGate>
  );
};

export default ChecklistTemplatesPage;
