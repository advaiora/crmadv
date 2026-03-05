import React, { useEffect, useMemo, useState } from "react";
import { Alert, Badge, Button, Card, Col, Form, ListGroup, Modal, Row } from "react-bootstrap";
import { Plus, Pencil, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import { Link } from "react-router-dom";
import { ToastContainer, toast } from "react-toastify";
import ModulePermissionGate from "../../components/guards/ModulePermissionGate";
import { useChecklistTemplates } from "../../modules/checklists/hooks/useChecklistsQueries";
import {
  isApiError as isChecklistApiError,
  listStageChecklistRules,
  replaceStageChecklistRules,
} from "../../modules/checklists/api/checklists.api";
import { isApiError as isProjectApiError } from "../../modules/projects/api/projects.api";
import {
  useCreateCategory,
  useCreateStage,
  useDeleteCategory,
  useDeleteStage,
  usePipelineCategories,
  usePipelineStages,
  useReorderStages,
  useUpdateCategory,
  useUpdateStage,
} from "../../modules/projects/hooks/usePipelineSettingsQueries";
import { useSelectedPipelineCategoryId } from "../../modules/projects/hooks/useSelectedPipelineCategoryId";
import EmptyState from "../../modules/projects/ui/states/EmptyState";
import ErrorState from "../../modules/projects/ui/states/ErrorState";
import LoadingState from "../../modules/projects/ui/states/LoadingState";
import { hasPermission } from "../../utils/workspaceAccess";
import "../../styles/css/project-pipeline-settings.css";
import { readBrandingColor } from "../../lib/brandingColors";

const PIPELINE_SETTINGS_PERMISSION = "projects.edit"; // TODO: replace with a dedicated pipeline-manage permission when available.

const sortCategories = (categories) =>
  [...categories].sort((left, right) => {
    const leftOrder = Number(left?.sortOrder);
    const rightOrder = Number(right?.sortOrder);
    const safeLeftOrder = Number.isFinite(leftOrder) ? leftOrder : Number.MAX_SAFE_INTEGER;
    const safeRightOrder = Number.isFinite(rightOrder) ? rightOrder : Number.MAX_SAFE_INTEGER;

    if (safeLeftOrder !== safeRightOrder) {
      return safeLeftOrder - safeRightOrder;
    }

    return String(left?.name || "").localeCompare(String(right?.name || ""), "it");
  });

const sortStages = (stages) =>
  [...stages].sort((left, right) => {
    const leftOrder = Number(left?.sortOrder);
    const rightOrder = Number(right?.sortOrder);
    const safeLeftOrder = Number.isFinite(leftOrder) ? leftOrder : Number.MAX_SAFE_INTEGER;
    const safeRightOrder = Number.isFinite(rightOrder) ? rightOrder : Number.MAX_SAFE_INTEGER;

    if (safeLeftOrder !== safeRightOrder) {
      return safeLeftOrder - safeRightOrder;
    }

    return String(left?.name || "").localeCompare(String(right?.name || ""), "it");
  });

const getErrorMessage = (error) => {
  if (!error) {
    return "";
  }

  if (isProjectApiError(error) || isChecklistApiError(error)) {
    return `${error.message} (${error.code || error.status || "API_ERROR"})`;
  }

  return error?.message || "Errore inatteso";
};

const isInUseError = (error) => isProjectApiError(error) && (error.code === "IN_USE" || error.status === 409);

const isLastStageError = (error) => isProjectApiError(error) && (error.code === "LAST_STAGE_REQUIRED" || error.status === 400);

const normalizeStageRulesPayload = (payload) => {
  if (Array.isArray(payload?.items)) {
    return payload.items;
  }

  if (Array.isArray(payload)) {
    return payload;
  }

  return [];
};

const PipelineSettingsContent = ({ access }) => {
  const defaultStageColor = readBrandingColor("--bs-primary", "#0d6efd");
  const categoriesQuery = usePipelineCategories();
  const categories = useMemo(() => sortCategories(categoriesQuery.data || []), [categoriesQuery.data]);

  const { categoryId, setCategoryId } = useSelectedPipelineCategoryId(categories);
  const stagesQuery = usePipelineStages(categoryId);
  const checklistTemplatesQuery = useChecklistTemplates();

  const createCategoryMutation = useCreateCategory();
  const updateCategoryMutation = useUpdateCategory();
  const deleteCategoryMutation = useDeleteCategory();

  const createStageMutation = useCreateStage();
  const updateStageMutation = useUpdateStage();
  const deleteStageMutation = useDeleteStage();
  const reorderStagesMutation = useReorderStages();

  const [newCategoryName, setNewCategoryName] = useState("");
  const [editingCategory, setEditingCategory] = useState(null);
  const [deletingCategory, setDeletingCategory] = useState(null);

  const [showCreateStageForm, setShowCreateStageForm] = useState(false);
  const [newStageName, setNewStageName] = useState("");
  const [newStageIsClosed, setNewStageIsClosed] = useState(false);
  const [newStageColor, setNewStageColor] = useState(defaultStageColor);
  const [newStageIsGated, setNewStageIsGated] = useState(false);
  const [newStageGateTemplateId, setNewStageGateTemplateId] = useState("");
  const [newStageAutoCreateInstance, setNewStageAutoCreateInstance] = useState(true);

  const [editingStage, setEditingStage] = useState(null);
  const [deletingStage, setDeletingStage] = useState(null);
  const [localStages, setLocalStages] = useState([]);

  useEffect(() => {
    setLocalStages(sortStages(stagesQuery.data || []));
  }, [stagesQuery.data]);

  const activeChecklistTemplates = useMemo(
    () => (checklistTemplatesQuery.data || []).filter((template) => !template.isArchived),
    [checklistTemplatesQuery.data],
  );
  const checklistTemplateNameById = useMemo(
    () => new Map(activeChecklistTemplates.map((template) => [template.id, template.name])),
    [activeChecklistTemplates],
  );

  const selectedCategory = useMemo(() => categories.find((category) => category.id === categoryId) || null, [categories, categoryId]);
  const canManageStageChecklistRules = hasPermission(access, "checklists.manage_templates");
  const [stageRulesByStageId, setStageRulesByStageId] = useState({});

  useEffect(() => {
    let isMounted = true;

    if (!canManageStageChecklistRules) {
      setStageRulesByStageId({});
      return () => {
        isMounted = false;
      };
    }

    if (!categoryId || localStages.length === 0) {
      setStageRulesByStageId({});
      return () => {
        isMounted = false;
      };
    }

    const stageIds = localStages.map((stage) => stage.id);

    setStageRulesByStageId((current) => {
      const next = {};
      stageIds.forEach((stageId) => {
        const existing = current[stageId];
        next[stageId] = existing || {
          loading: true,
          saving: false,
          error: "",
          rules: [],
        };
      });
      return next;
    });

    Promise.all(
      stageIds.map(async (stageId) => {
        try {
          const payload = await listStageChecklistRules(categoryId, stageId);
          const items = normalizeStageRulesPayload(payload);
          if (!isMounted) {
            return;
          }

          setStageRulesByStageId((current) => ({
            ...current,
            [stageId]: {
              loading: false,
              saving: false,
              error: "",
              rules: items.map((rule) => ({
                checklistTemplateId: rule.checklistTemplateId,
                gateEnabled: rule.gateEnabled !== false,
              })),
            },
          }));
        } catch (error) {
          if (!isMounted) {
            return;
          }

          setStageRulesByStageId((current) => ({
            ...current,
            [stageId]: {
              loading: false,
              saving: false,
              error: getErrorMessage(error),
              rules: [],
            },
          }));
        }
      }),
    );

    return () => {
      isMounted = false;
    };
  }, [canManageStageChecklistRules, categoryId, localStages]);

  const updateStageRulesDraft = (stageId, updater) => {
    setStageRulesByStageId((current) => {
      const existing = current[stageId] || {
        loading: false,
        saving: false,
        error: "",
        rules: [],
      };

      return {
        ...current,
        [stageId]: updater(existing),
      };
    });
  };

  const handleToggleStageRuleTemplate = (stageId, templateId, checked) => {
    updateStageRulesDraft(stageId, (current) => {
      const hasRule = current.rules.some((rule) => rule.checklistTemplateId === templateId);
      if (checked && !hasRule) {
        return {
          ...current,
          error: "",
          rules: [
            ...current.rules,
            {
              checklistTemplateId: templateId,
              gateEnabled: true,
            },
          ],
        };
      }

      if (!checked && hasRule) {
        return {
          ...current,
          error: "",
          rules: current.rules.filter((rule) => rule.checklistTemplateId !== templateId),
        };
      }

      return current;
    });
  };

  const handleToggleStageRuleGate = (stageId, templateId, gateEnabled) => {
    updateStageRulesDraft(stageId, (current) => ({
      ...current,
      error: "",
      rules: current.rules.map((rule) =>
        rule.checklistTemplateId === templateId
          ? { ...rule, gateEnabled }
          : rule),
    }));
  };

  const handleSaveStageRules = async (stageId) => {
    if (!categoryId || !canManageStageChecklistRules) {
      return;
    }

    const draft = stageRulesByStageId[stageId] || {
      rules: [],
    };

    updateStageRulesDraft(stageId, (current) => ({
      ...current,
      saving: true,
      error: "",
    }));

    try {
      const payload = await replaceStageChecklistRules(categoryId, stageId, draft.rules);
      const items = normalizeStageRulesPayload(payload);

      updateStageRulesDraft(stageId, (current) => ({
        ...current,
        saving: false,
        error: "",
        rules: items.map((rule) => ({
          checklistTemplateId: rule.checklistTemplateId,
          gateEnabled: rule.gateEnabled !== false,
        })),
      }));

      toast.success("Regole checklist salvate");
    } catch (error) {
      updateStageRulesDraft(stageId, (current) => ({
        ...current,
        saving: false,
        error: getErrorMessage(error) || "Errore salvataggio regole checklist",
      }));
      toast.error(getErrorMessage(error) || "Errore salvataggio regole checklist");
    }
  };

  const handleCreateCategory = async (event) => {
    event.preventDefault();

    const normalizedName = newCategoryName.trim();
    if (!normalizedName) {
      toast.error("Nome categoria obbligatorio");
      return;
    }

    try {
      const createdCategory = await createCategoryMutation.mutate({
        name: normalizedName,
      });

      setNewCategoryName("");
      await categoriesQuery.refetch();
      setCategoryId(createdCategory?.id || "");
      toast.success("Categoria creata");
    } catch (error) {
      toast.error(getErrorMessage(error) || "Errore creazione categoria");
    }
  };

  const handleSaveCategoryRename = async () => {
    if (!editingCategory?.id) {
      return;
    }

    const normalizedName = String(editingCategory.name || "").trim();
    if (!normalizedName) {
      toast.error("Nome categoria obbligatorio");
      return;
    }

    try {
      await updateCategoryMutation.mutate(editingCategory.id, {
        name: normalizedName,
      });
      setEditingCategory(null);
      await categoriesQuery.refetch();
      toast.success("Salvato");
    } catch (error) {
      toast.error(getErrorMessage(error) || "Errore salvataggio categoria");
    }
  };

  const handleDeleteCategory = async () => {
    if (!deletingCategory?.id) {
      return;
    }

    try {
      await deleteCategoryMutation.mutate(deletingCategory.id);
      const deletedCategoryId = deletingCategory.id;
      setDeletingCategory(null);
      await categoriesQuery.refetch();
      if (deletedCategoryId === categoryId) {
        setCategoryId("");
      }
      toast.success("Categoria eliminata");
    } catch (error) {
      if (isInUseError(error)) {
        toast.error("Categoria in uso: elimina prima stage e progetti");
        return;
      }

      toast.error(getErrorMessage(error) || "Errore eliminazione categoria");
    }
  };

  const resetNewStageForm = () => {
    setNewStageName("");
    setNewStageIsClosed(false);
    setNewStageColor(defaultStageColor);
    setNewStageIsGated(false);
    setNewStageGateTemplateId("");
    setNewStageAutoCreateInstance(true);
  };

  const handleCreateStage = async (event) => {
    event.preventDefault();

    if (!categoryId) {
      toast.error("Seleziona una categoria");
      return;
    }

    const normalizedName = newStageName.trim();
    if (!normalizedName) {
      toast.error("Nome stage obbligatorio");
      return;
    }
    if (newStageIsGated && !newStageGateTemplateId) {
      toast.error("Seleziona un template checklist per il gate");
      return;
    }
    if (newStageIsGated && activeChecklistTemplates.length === 0) {
      toast.error("Nessun template checklist attivo disponibile");
      return;
    }

    try {
      await createStageMutation.mutate(categoryId, {
        name: normalizedName,
        isClosed: Boolean(newStageIsClosed),
        color: newStageColor || undefined,
        isGated: Boolean(newStageIsGated),
        gateChecklistTemplateId: newStageIsGated ? newStageGateTemplateId || null : null,
        autoCreateInstance: Boolean(newStageAutoCreateInstance),
        sortOrder: localStages.length,
      });
      resetNewStageForm();
      setShowCreateStageForm(false);
      await stagesQuery.refetch();
      toast.success("Stage creato");
    } catch (error) {
      toast.error(getErrorMessage(error) || "Errore creazione stage");
    }
  };

  const handleSaveStage = async () => {
    if (!editingStage?.id) {
      return;
    }

    const normalizedName = String(editingStage.name || "").trim();
    if (!normalizedName) {
      toast.error("Nome stage obbligatorio");
      return;
    }
    if (editingStage.isGated && !editingStage.gateChecklistTemplateId) {
      toast.error("Seleziona un template checklist per il gate");
      return;
    }

    try {
      await updateStageMutation.mutate(editingStage.id, {
        name: normalizedName,
        isClosed: Boolean(editingStage.isClosed),
        color: editingStage.color || null,
        isGated: Boolean(editingStage.isGated),
        gateChecklistTemplateId: editingStage.isGated ? editingStage.gateChecklistTemplateId || null : null,
        autoCreateInstance: Boolean(editingStage.autoCreateInstance),
      });
      setEditingStage(null);
      await stagesQuery.refetch();
      toast.success("Salvato");
    } catch (error) {
      toast.error(getErrorMessage(error) || "Errore salvataggio stage");
    }
  };

  const handleDeleteStage = async () => {
    if (!deletingStage?.id) {
      return;
    }

    if (localStages.length <= 1) {
      toast.error("Devi avere almeno uno stage nella categoria");
      setDeletingStage(null);
      return;
    }

    try {
      await deleteStageMutation.mutate(deletingStage.id);
      setDeletingStage(null);
      await stagesQuery.refetch();
      toast.success("Stage eliminato");
    } catch (error) {
      if (isInUseError(error)) {
        toast.error("Stage in uso: sposta prima i progetti");
        return;
      }

      if (isLastStageError(error)) {
        toast.error("Devi avere almeno uno stage nella categoria");
        return;
      }

      toast.error(getErrorMessage(error) || "Errore eliminazione stage");
    }
  };

  const handleMoveStage = async (index, direction) => {
    if (!categoryId || reorderStagesMutation.loading) {
      return;
    }

    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= localStages.length) {
      return;
    }

    const previousStages = [...localStages];
    const nextStages = [...localStages];
    const temp = nextStages[index];
    nextStages[index] = nextStages[targetIndex];
    nextStages[targetIndex] = temp;

    setLocalStages(nextStages);

    try {
      await reorderStagesMutation.mutate(
        categoryId,
        nextStages.map((stage) => stage.id),
      );
      toast.success("Salvato", { autoClose: 1300 });
      stagesQuery.refetch();
    } catch (_error) {
      setLocalStages(previousStages);
      toast.error("Errore salvataggio ordine");
    }
  };

  if (categoriesQuery.loading) {
    return <LoadingState message="Caricamento categorie pipeline..." />;
  }

  if (categoriesQuery.error) {
    return <ErrorState title="Errore categorie pipeline" message={getErrorMessage(categoriesQuery.error)} onRetry={categoriesQuery.refetch} />;
  }

  return (
    <>
      <div className="mb-3">
        <Link to="/projects" className="text-primary">
          &larr; Torna a Progetti
        </Link>
      </div>

      <div className="mb-3">
        <h3 className="mb-1">Impostazioni pipeline</h3>
      </div>

      {categories.length === 0 && (
        <Card className="card-border mb-3">
          <Card.Body>
            <EmptyState title="Nessuna categoria. Creane una per iniziare." description="Aggiungi una categoria pipeline per configurare gli stage." />

            <Form className="mt-3" onSubmit={handleCreateCategory}>
              <Row className="g-2">
                <Col md={8}>
                  <Form.Control
                    value={newCategoryName}
                    onChange={(event) => setNewCategoryName(event.target.value)}
                    placeholder="Nome categoria"
                    disabled={createCategoryMutation.loading}
                  />
                </Col>
                <Col md={4}>
                  <Button
                    type="submit"
                    variant="primary"
                    className="w-100 d-inline-flex align-items-center justify-content-center gap-2"
                    disabled={createCategoryMutation.loading}
                  >
                    <Plus size={14} />
                    Categoria
                  </Button>
                </Col>
              </Row>
            </Form>
          </Card.Body>
        </Card>
      )}

      {categories.length > 0 && (
        <Row className="g-3">
          <Col xl={4}>
            <Card className="card-border h-100">
              <Card.Header className="bg-transparent d-flex justify-content-between align-items-center">
                <h6 className="mb-0">Categorie</h6>
              </Card.Header>
              <Card.Body>
                <ListGroup variant="flush">
                  {categories.map((category) => (
                    <ListGroup.Item
                      key={category.id}
                      as="div"
                      role="button"
                      tabIndex={0}
                      active={category.id === categoryId}
                      onClick={() => setCategoryId(category.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setCategoryId(category.id);
                        }
                      }}
                      className="list-group-item-action d-flex justify-content-between align-items-center gap-2"
                    >
                      <span>{category.name}</span>
                      <span className="d-flex align-items-center gap-1">
                        <Button
                          type="button"
                          size="sm"
                          variant={category.id === categoryId ? "light" : "outline-secondary"}
                          onClick={(event) => {
                            event.stopPropagation();
                            setEditingCategory({
                              id: category.id,
                              name: category.name,
                            });
                          }}
                        >
                          <Pencil size={13} />
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant={category.id === categoryId ? "light" : "outline-danger"}
                          onClick={(event) => {
                            event.stopPropagation();
                            setDeletingCategory(category);
                          }}
                        >
                          <Trash2 size={13} />
                        </Button>
                      </span>
                    </ListGroup.Item>
                  ))}
                </ListGroup>

                <Form className="mt-3" onSubmit={handleCreateCategory}>
                  <Form.Group className="mb-2">
                    <Form.Label className="small text-muted mb-1">Nuova categoria</Form.Label>
                    <Form.Control
                      value={newCategoryName}
                      onChange={(event) => setNewCategoryName(event.target.value)}
                      placeholder="Nome categoria"
                      disabled={createCategoryMutation.loading}
                    />
                  </Form.Group>
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    className="d-inline-flex align-items-center gap-2"
                    disabled={createCategoryMutation.loading}
                  >
                    <Plus size={14} />
                    Categoria
                  </Button>
                </Form>
              </Card.Body>
            </Card>
          </Col>

          <Col xl={8}>
            <Card className="card-border">
              <Card.Header className="bg-transparent d-flex justify-content-between align-items-center gap-2 flex-wrap">
                <h6 className="mb-0">Stage {selectedCategory ? `- ${selectedCategory.name}` : ""}</h6>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  className="d-inline-flex align-items-center gap-2"
                  onClick={() => setShowCreateStageForm((current) => !current)}
                  disabled={!categoryId}
                >
                  <Plus size={14} />
                  Stage
                </Button>
              </Card.Header>
              <Card.Body>
                {showCreateStageForm && (
                  <Card className="card-border mb-3">
                    <Card.Body>
                      <Form onSubmit={handleCreateStage}>
                        <Row className="g-2">
                          <Col md={6}>
                            <Form.Group>
                              <Form.Label>Nome stage</Form.Label>
                              <Form.Control
                                value={newStageName}
                                onChange={(event) => setNewStageName(event.target.value)}
                                placeholder="Nome stage"
                                disabled={createStageMutation.loading}
                                required
                              />
                            </Form.Group>
                          </Col>
                          <Col md={3}>
                            <Form.Group>
                              <Form.Label>Colore</Form.Label>
                              <Form.Control
                                type="color"
                                value={newStageColor}
                                onChange={(event) => setNewStageColor(event.target.value)}
                                disabled={createStageMutation.loading}
                              />
                            </Form.Group>
                          </Col>
                          <Col md={3}>
                            <Form.Group className="h-100 d-flex align-items-end">
                              <Form.Check
                                type="switch"
                                id="stage-is-closed"
                                label="Chiuso"
                                checked={newStageIsClosed}
                                onChange={(event) => setNewStageIsClosed(event.target.checked)}
                                disabled={createStageMutation.loading}
                              />
                            </Form.Group>
                          </Col>
                          <Col md={4}>
                            <Form.Group className="h-100 d-flex align-items-end">
                              <Form.Check
                                type="switch"
                                id="stage-is-gated"
                                label="Checklist gate"
                                checked={newStageIsGated}
                                onChange={(event) => {
                                  setNewStageIsGated(event.target.checked);
                                  if (!event.target.checked) {
                                    setNewStageGateTemplateId("");
                                  }
                                }}
                                disabled={createStageMutation.loading}
                              />
                            </Form.Group>
                          </Col>
                          <Col md={4}>
                            <Form.Group>
                              <Form.Label>Template Gate</Form.Label>
                              <Form.Select
                                value={newStageGateTemplateId}
                                onChange={(event) => setNewStageGateTemplateId(event.target.value)}
                                disabled={!newStageIsGated || createStageMutation.loading}
                              >
                                <option value="">Seleziona template</option>
                                {activeChecklistTemplates.map((template) => (
                                  <option key={template.id} value={template.id}>
                                    {template.name}
                                  </option>
                                ))}
                              </Form.Select>
                            </Form.Group>
                          </Col>
                          <Col md={4}>
                            <Form.Group className="h-100 d-flex align-items-end">
                              <Form.Check
                                type="switch"
                                id="stage-autocreate-checklist"
                                label="Auto-create instance"
                                checked={newStageAutoCreateInstance}
                                onChange={(event) => setNewStageAutoCreateInstance(event.target.checked)}
                                disabled={!newStageIsGated || createStageMutation.loading}
                              />
                            </Form.Group>
                          </Col>
                        </Row>
                        {newStageIsGated && (
                          <Alert variant={activeChecklistTemplates.length > 0 ? "info" : "warning"} className="mt-3 mb-0 py-2">
                            {activeChecklistTemplates.length > 0
                              ? "Gate attivo: lo stage richiedera il completamento checklist prima del passaggio."
                              : "Per usare il gate, crea prima almeno un template checklist attivo."}
                          </Alert>
                        )}
                        <div className="d-flex justify-content-end gap-2 mt-3">
                          <Button
                            type="button"
                            variant="outline-secondary"
                            onClick={() => {
                              resetNewStageForm();
                              setShowCreateStageForm(false);
                            }}
                            disabled={createStageMutation.loading}
                          >
                            Annulla
                          </Button>
                          <Button type="submit" variant="primary" disabled={createStageMutation.loading}>
                            {createStageMutation.loading ? "Creazione..." : "Crea stage"}
                          </Button>
                        </div>
                      </Form>
                    </Card.Body>
                  </Card>
                )}

                {stagesQuery.loading && <LoadingState message="Caricamento stage..." />}

                {stagesQuery.error && <ErrorState title="Errore stage" message={getErrorMessage(stagesQuery.error)} onRetry={stagesQuery.refetch} />}

                {!stagesQuery.loading && !stagesQuery.error && localStages.length === 0 && (
                  <Alert variant="warning" className="mb-0 d-flex justify-content-between align-items-center">
                    <span>Questa categoria non ha stage, aggiungine uno.</span>
                    <Button type="button" variant="outline-warning" size="sm" onClick={() => setShowCreateStageForm(true)}>
                      Aggiungi stage
                    </Button>
                  </Alert>
                )}

                {!stagesQuery.loading && !stagesQuery.error && localStages.length > 0 && (
                  <ListGroup variant="flush">
                    {localStages.map((stage, index) => {
                      const stageRuleState = stageRulesByStageId[stage.id] || {
                        loading: false,
                        saving: false,
                        error: "",
                        rules: [],
                      };
                      const selectedRuleByTemplateId = new Map(
                        stageRuleState.rules.map((rule) => [rule.checklistTemplateId, rule]),
                      );

                      return (
                        <ListGroup.Item key={stage.id} className="d-flex flex-column gap-2">
                          <div className="d-flex justify-content-between align-items-center gap-2">
                            <div className="d-flex align-items-center gap-2">
                              {stage.color && (
                                <span
                                  style={{
                                    width: 10,
                                    height: 10,
                                    borderRadius: "50%",
                                    backgroundColor: stage.color,
                                    display: "inline-block",
                                  }}
                                />
                              )}
                              <span className="fw-semibold">{stage.name}</span>
                              {stage.isClosed && <Badge bg="secondary">Chiuso</Badge>}
                              {stage.isGated && <Badge bg="warning" text="dark">Gated</Badge>}
                              {stage.isGated && stage.gateChecklistTemplateId && (
                                <Badge bg="light" text="dark">
                                  Template: {checklistTemplateNameById.get(stage.gateChecklistTemplateId) || stage.gateChecklistTemplateId}
                                </Badge>
                              )}
                            </div>

                            <div className="d-flex align-items-center gap-1">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline-secondary"
                                disabled={index === 0 || reorderStagesMutation.loading}
                                onClick={() => void handleMoveStage(index, -1)}
                              >
                                <ChevronUp size={14} />
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline-secondary"
                                disabled={index === localStages.length - 1 || reorderStagesMutation.loading}
                                onClick={() => void handleMoveStage(index, 1)}
                              >
                                <ChevronDown size={14} />
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline-secondary"
                                onClick={() =>
                                  setEditingStage({
                                    id: stage.id,
                                    name: stage.name,
                                    isClosed: Boolean(stage.isClosed),
                                    color: stage.color || defaultStageColor,
                                    isGated: Boolean(stage.isGated),
                                    gateChecklistTemplateId: stage.gateChecklistTemplateId || "",
                                    autoCreateInstance: stage.autoCreateInstance !== false,
                                  })
                                }
                              >
                                <Pencil size={13} />
                              </Button>
                              <Button type="button" size="sm" variant="outline-danger" onClick={() => setDeletingStage(stage)}>
                                <Trash2 size={13} />
                              </Button>
                            </div>
                          </div>

                          <div className="border-top pt-2">
                            <div className="d-flex justify-content-between align-items-center gap-2 mb-2">
                              <span className="small text-muted">Checklist rules per stage</span>
                              {stageRuleState.saving && <span className="small text-muted">Salvataggio...</span>}
                            </div>

                            {!canManageStageChecklistRules && (
                              <div className="small text-muted">
                                Servono permessi `checklists.manage_templates` per modificare le regole.
                              </div>
                            )}

                            {canManageStageChecklistRules && stageRuleState.loading && (
                              <div className="small text-muted">Caricamento regole...</div>
                            )}

                            {canManageStageChecklistRules && !stageRuleState.loading && activeChecklistTemplates.length === 0 && (
                              <div className="small text-muted">Nessun template checklist attivo disponibile.</div>
                            )}

                            {canManageStageChecklistRules && !stageRuleState.loading && activeChecklistTemplates.length > 0 && (
                              <div className="d-flex flex-column gap-2">
                                {activeChecklistTemplates.map((template) => {
                                  const selectedRule = selectedRuleByTemplateId.get(template.id);
                                  const selected = Boolean(selectedRule);
                                  const gateEnabled = selectedRule?.gateEnabled !== false;

                                  return (
                                    <div key={`${stage.id}-${template.id}`} className="d-flex flex-wrap align-items-center justify-content-between gap-2">
                                      <Form.Check
                                        type="checkbox"
                                        id={`stage-rule-template-${stage.id}-${template.id}`}
                                        label={template.name}
                                        checked={selected}
                                        onChange={(event) =>
                                          handleToggleStageRuleTemplate(stage.id, template.id, event.target.checked)}
                                        disabled={stageRuleState.saving}
                                      />
                                      <Form.Check
                                        type="switch"
                                        id={`stage-rule-gate-${stage.id}-${template.id}`}
                                        label="Gate"
                                        checked={gateEnabled}
                                        disabled={!selected || stageRuleState.saving}
                                        onChange={(event) =>
                                          handleToggleStageRuleGate(stage.id, template.id, event.target.checked)}
                                      />
                                    </div>
                                  );
                                })}

                                {stageRuleState.error && (
                                  <Alert variant="danger" className="py-2 mb-0">
                                    {stageRuleState.error}
                                  </Alert>
                                )}

                                <div className="d-flex justify-content-end">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline-primary"
                                    disabled={stageRuleState.saving}
                                    onClick={() => void handleSaveStageRules(stage.id)}
                                  >
                                    Salva regole
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        </ListGroup.Item>
                      );
                    })}
                  </ListGroup>
                )}
              </Card.Body>
            </Card>
          </Col>
        </Row>
      )}

      <Modal show={Boolean(editingCategory)} onHide={() => setEditingCategory(null)} centered className="pipeline-modal">
        <Modal.Header closeButton>
          <Modal.Title>Rinomina categoria</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Control
            value={editingCategory?.name || ""}
            onChange={(event) =>
              setEditingCategory((current) => ({
                ...(current || {}),
                name: event.target.value,
              }))
            }
            placeholder="Nome categoria"
            autoFocus
          />
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setEditingCategory(null)}>
            Annulla
          </Button>
          <Button variant="primary" onClick={() => void handleSaveCategoryRename()} disabled={updateCategoryMutation.loading}>
            {updateCategoryMutation.loading ? "Salvataggio..." : "Salva"}
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal show={Boolean(deletingCategory)} onHide={() => setDeletingCategory(null)} centered className="pipeline-modal">
        <Modal.Header closeButton>
          <Modal.Title>Eliminare categoria?</Modal.Title>
        </Modal.Header>
        <Modal.Body>Questa azione puo fallire se la categoria e in uso.</Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setDeletingCategory(null)}>
            Annulla
          </Button>
          <Button variant="danger" onClick={() => void handleDeleteCategory()} disabled={deleteCategoryMutation.loading}>
            {deleteCategoryMutation.loading ? "Eliminazione..." : "Elimina"}
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal show={Boolean(editingStage)} onHide={() => setEditingStage(null)} centered className="pipeline-modal">
        <Modal.Header closeButton>
          <Modal.Title>Modifica stage</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group className="mb-3">
            <Form.Label>Nome stage</Form.Label>
            <Form.Control
              value={editingStage?.name || ""}
              onChange={(event) =>
                setEditingStage((current) => ({
                  ...(current || {}),
                  name: event.target.value,
                }))
              }
            />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Colore</Form.Label>
            <Form.Control
              type="color"
              value={editingStage?.color || defaultStageColor}
              onChange={(event) =>
                setEditingStage((current) => ({
                  ...(current || {}),
                  color: event.target.value,
                }))
              }
            />
          </Form.Group>
          <Form.Check
            type="switch"
            id="edit-stage-is-closed"
            label="Stage chiuso"
            checked={Boolean(editingStage?.isClosed)}
            onChange={(event) =>
              setEditingStage((current) => ({
                ...(current || {}),
                isClosed: event.target.checked,
              }))
            }
          />
          <Form.Check
            type="switch"
            id="edit-stage-is-gated"
            label="Checklist gate"
            className="mt-3"
            checked={Boolean(editingStage?.isGated)}
            onChange={(event) =>
              setEditingStage((current) => ({
                ...(current || {}),
                isGated: event.target.checked,
                ...(event.target.checked ? {} : { gateChecklistTemplateId: "" }),
              }))
            }
          />
          <Form.Group className="mt-3">
            <Form.Label>Template gate</Form.Label>
            <Form.Select
              value={editingStage?.gateChecklistTemplateId || ""}
              disabled={!editingStage?.isGated}
              onChange={(event) =>
                setEditingStage((current) => ({
                  ...(current || {}),
                  gateChecklistTemplateId: event.target.value,
                }))
              }
            >
              <option value="">Seleziona template</option>
              {activeChecklistTemplates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </Form.Select>
          </Form.Group>
          <Form.Check
            type="switch"
            id="edit-stage-auto-create"
            className="mt-3"
            label="Auto-create checklist instance"
            checked={Boolean(editingStage?.autoCreateInstance)}
            disabled={!editingStage?.isGated}
            onChange={(event) =>
              setEditingStage((current) => ({
                ...(current || {}),
                autoCreateInstance: event.target.checked,
              }))
            }
          />
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setEditingStage(null)}>
            Annulla
          </Button>
          <Button variant="primary" onClick={() => void handleSaveStage()} disabled={updateStageMutation.loading}>
            {updateStageMutation.loading ? "Salvataggio..." : "Salva"}
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal show={Boolean(deletingStage)} onHide={() => setDeletingStage(null)} centered className="pipeline-modal">
        <Modal.Header closeButton>
          <Modal.Title>Eliminare stage?</Modal.Title>
        </Modal.Header>
        <Modal.Body>Vuoi eliminare questo stage? Questa azione non e reversibile.</Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setDeletingStage(null)}>
            Annulla
          </Button>
          <Button variant="danger" onClick={() => void handleDeleteStage()} disabled={deleteStageMutation.loading}>
            {deleteStageMutation.loading ? "Eliminazione..." : "Elimina"}
          </Button>
        </Modal.Footer>
      </Modal>

      <ToastContainer position="bottom-right" theme="light" />
    </>
  );
};

const ProjectPipelineSettings = () => {
  return (
    <ModulePermissionGate requiredModule="projects" requiredPermission={PIPELINE_SETTINGS_PERMISSION} moduleName="Progetti">
      {({ access }) => (
        <div className="container-fluid py-4 pipeline-page">
          <PipelineSettingsContent access={access} />
        </div>
      )}
    </ModulePermissionGate>
  );
};

export default ProjectPipelineSettings;

