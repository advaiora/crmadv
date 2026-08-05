import React from 'react';
import { Link } from 'react-router-dom';
import { LayoutList, ShieldCheck, Sparkles } from 'lucide-react';
import ModulePermissionGate from '../../components/guards/ModulePermissionGate';
import TemplatesListCard from './templates/TemplatesListCard';
import TemplatesDetailCard from './templates/TemplatesDetailCard';
import { useChecklistTemplatesPage } from './templates/hooks/useChecklistTemplatesPage';
import '../../styles/css/checklists-ui.css';

// Esportata anche col nome, oltre che montata dal gate qui sotto: cosi' il test
// del cablaggio puo' montarla con un `access` finto senza passare dai permessi.
export const ChecklistTemplatesContent = ({ access }) => {
  const page = useChecklistTemplatesPage(access);

  return (
    <div className="container-fluid py-4 checklists-shell page-flat">
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
            <span>{page.visibleTemplates.length} memo</span>
          </div>
          <div className="checklists-stat-chip">
            <ShieldCheck size={14} />
            <span>{page.totalVisibleItems} step totali</span>
          </div>
        </div>
      </div>

      <div className="flat-cols grid gap-4 xl:gap-6 xl:grid-cols-[340px,1fr] checklists-grid">
        <TemplatesListCard
          templateSearch={page.templateSearch}
          onSearchChange={page.setTemplateSearch}
          showArchivedTemplates={page.showArchivedTemplates}
          onToggleArchived={() => page.setShowArchivedTemplates((current) => !current)}
          loading={page.templatesQuery.loading}
          error={page.templatesQuery.error}
          visibleTemplates={page.visibleTemplates}
          selectedTemplateId={page.selectedTemplateId}
          onSelectTemplate={page.setSelectedTemplateId}
          canCreateTemplate={page.canCreateTemplate}
          newTemplateName={page.newTemplateName}
          onNewTemplateNameChange={page.setNewTemplateName}
          newTemplateDescription={page.newTemplateDescription}
          onNewTemplateDescriptionChange={page.setNewTemplateDescription}
          onCreateTemplate={page.handleCreateTemplate}
          creating={page.createTemplateMutation.loading}
        />

        <TemplatesDetailCard
          selectedTemplateId={page.selectedTemplateId}
          loading={page.selectedTemplateQuery.loading}
          error={page.selectedTemplateQuery.error}
          template={page.selectedTemplateQuery.data}
          canManageTemplates={page.canManageTemplates}
          canDeleteTemplate={page.canDeleteTemplate}
          editingTemplateName={page.editingTemplateName}
          onEditingTemplateNameChange={page.setEditingTemplateName}
          editingTemplateDescription={page.editingTemplateDescription}
          onEditingTemplateDescriptionChange={page.setEditingTemplateDescription}
          onUpdateTemplate={page.handleUpdateTemplate}
          updatingTemplate={page.updateTemplateMutation.loading}
          onArchiveTemplate={page.handleArchiveTemplate}
          archivingTemplate={page.archiveTemplateMutation.loading}
          onDeleteTemplatePermanently={page.handleDeleteTemplatePermanently}
          deletingTemplate={page.deleteTemplatePermanentlyMutation.loading}
          itemsListProps={{
            editingItem: page.editingItem,
            onEditingItemChange: page.setEditingItem,
            assignableUsers: page.assignableUsers,
            canManageTemplates: page.canManageTemplates,
            canDeleteTemplate: page.canDeleteTemplate,
            onSaveItem: page.handleSaveItem,
            onDeleteItem: page.handleDeleteItem,
            onReorderItem: page.handleReorderItem,
            savingItem: page.updateItemMutation.loading,
            deletingItem: page.deleteItemMutation.loading,
            reordering: page.reorderItemsMutation.loading,
          }}
          newItemFormProps={{
            title: page.newItemTitle,
            onTitleChange: page.setNewItemTitle,
            description: page.newItemDescription,
            onDescriptionChange: page.setNewItemDescription,
            required: page.newItemRequired,
            onRequiredChange: page.setNewItemRequired,
            requiresEvidence: page.newItemRequiresEvidence,
            onRequiresEvidenceChange: page.setNewItemRequiresEvidence,
            critical: page.newItemCritical,
            onCriticalChange: page.setNewItemCritical,
            defaultAssignedToUserId: page.newItemDefaultAssignedToUserId,
            onDefaultAssignedToUserIdChange: page.setNewItemDefaultAssignedToUserId,
            assignableUsers: page.assignableUsers,
            onSubmit: page.handleCreateItem,
            creating: page.createItemMutation.loading,
          }}
        />
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
