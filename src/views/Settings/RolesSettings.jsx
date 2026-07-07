import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Badge, Button, Card, Form, Spinner } from 'react-bootstrap';
import { useWorkspaceAccess } from '../../hooks/useWorkspaceAccess';
import { hasPermission } from '../../utils/workspaceAccess';
import {
  createWorkspaceRole,
  deleteWorkspaceRole,
  getRolesCatalog,
  listWorkspaceRoles,
  updateWorkspaceRole,
} from '../../modules/roles/api/rolesApi';
import './RolesSettings.css';

const MANAGE_PERMISSION = 'roles.manage';

// Checkbox "tutto il modulo" con stato indeterminato (parziale) gestito via ref.
const ModuleToggle = ({ checked, indeterminate, disabled, onChange, label }) => {
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = indeterminate;
    }
  }, [indeterminate]);

  return (
    <Form.Check
      type="checkbox"
      ref={ref}
      checked={checked}
      disabled={disabled}
      onChange={onChange}
      label={label}
      className="fw-semibold mb-0"
    />
  );
};

const RolesSettings = () => {
  const { access } = useWorkspaceAccess();
  const canManage = hasPermission(access, MANAGE_PERMISSION);

  const [roles, setRoles] = useState([]);
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  // null = niente selezionato; 'new' = bozza nuovo ruolo; altrimenti roleId.
  const [selection, setSelection] = useState(null);
  const [draftName, setDraftName] = useState('');
  const [draftPermissions, setDraftPermissions] = useState(() => new Set());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [flash, setFlash] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [rolesResult, catalogResult] = await Promise.all([
        listWorkspaceRoles(),
        getRolesCatalog(),
      ]);
      setRoles(rolesResult?.roles ?? []);
      setModules(catalogResult?.modules ?? []);
    } catch (error) {
      setLoadError(error?.message || 'Impossibile caricare ruoli e permessi.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedRole = useMemo(
    () => (selection && selection !== 'new' ? roles.find((role) => role.id === selection) : null),
    [selection, roles],
  );

  const isDraft = selection === 'new';
  const isSystemRole = Boolean(selectedRole?.isSystem);
  const isEditable = canManage && (isDraft || (selectedRole && !isSystemRole));

  // Popola il form quando cambia la selezione.
  useEffect(() => {
    setFormError('');
    if (isDraft) {
      setDraftName('');
      setDraftPermissions(new Set());
      return;
    }
    if (selectedRole) {
      setDraftName(selectedRole.name);
      setDraftPermissions(new Set(selectedRole.permissions || []));
    }
  }, [selection, selectedRole, isDraft]);

  const allCatalogKeys = useMemo(
    () => modules.flatMap((module) => module.permissions.map((permission) => permission.key)),
    [modules],
  );

  const togglePermission = (key) => {
    setDraftPermissions((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const toggleModule = (module) => {
    const keys = module.permissions.map((permission) => permission.key);
    const allSelected = keys.every((key) => draftPermissions.has(key));
    setDraftPermissions((current) => {
      const next = new Set(current);
      if (allSelected) {
        keys.forEach((key) => next.delete(key));
      } else {
        keys.forEach((key) => next.add(key));
      }
      return next;
    });
  };

  const onSave = async () => {
    const name = draftName.trim();
    if (!name) {
      setFormError('Il nome del ruolo è obbligatorio.');
      return;
    }
    const permissions = allCatalogKeys.filter((key) => draftPermissions.has(key));

    setSaving(true);
    setFormError('');
    setFlash('');
    try {
      if (isDraft) {
        const result = await createWorkspaceRole({ name, permissions });
        await load();
        setSelection(result?.role?.id ?? null);
        setFlash(`Ruolo "${name}" creato.`);
      } else if (selectedRole) {
        await updateWorkspaceRole(selectedRole.id, { name, permissions });
        await load();
        setFlash(`Ruolo "${name}" aggiornato.`);
      }
    } catch (error) {
      setFormError(error?.message || 'Salvataggio non riuscito.');
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async () => {
    if (!selectedRole) {
      return;
    }
    if (!window.confirm(`Eliminare il ruolo "${selectedRole.name}"? L'operazione non è reversibile.`)) {
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      await deleteWorkspaceRole(selectedRole.id);
      setSelection(null);
      await load();
      setFlash(`Ruolo "${selectedRole.name}" eliminato.`);
    } catch (error) {
      setFormError(error?.message || 'Eliminazione non riuscita.');
    } finally {
      setSaving(false);
    }
  };

  const selectedPermissionCount = draftPermissions.size;

  return (
    <div className="container-fluid py-4">
      <div className="hk-pg-header pb-3 d-flex flex-wrap justify-content-between align-items-end gap-2">
        <div>
          <h1 className="pg-title mb-1">Ruoli e permessi</h1>
          <p className="text-muted mb-0">
            Definisci ruoli su misura scegliendo i permessi modulo per modulo. I ruoli di
            sistema sono in sola lettura.
          </p>
        </div>
        {canManage && (
          <Button
            variant="primary"
            size="sm"
            onClick={() => setSelection('new')}
            disabled={loading}
          >
            Nuovo ruolo
          </Button>
        )}
      </div>

      {flash && (
        <Alert variant="success" className="py-2" dismissible onClose={() => setFlash('')}>
          {flash}
        </Alert>
      )}
      {loadError && <Alert variant="danger" className="py-2">{loadError}</Alert>}

      {loading ? (
        <div className="d-flex align-items-center gap-2 text-muted py-5 justify-content-center">
          <Spinner animation="border" size="sm" /> Caricamento…
        </div>
      ) : (
        <div className="roles-layout">
          {/* Colonna elenco ruoli */}
          <div>
            {roles.map((role) => (
              <button
                type="button"
                key={role.id}
                className={`roles-list-item${selection === role.id ? ' is-active' : ''}`}
                onClick={() => setSelection(role.id)}
              >
                <span className="d-flex align-items-center justify-content-between gap-2">
                  <span className="fw-semibold text-truncate">{role.name}</span>
                  {role.isSystem && (
                    <Badge bg="light" text="dark" className="border">Sistema</Badge>
                  )}
                </span>
                <span className="small text-muted">
                  {(role.permissions?.length ?? 0)} permessi
                </span>
              </button>
            ))}
            {roles.length === 0 && (
              <p className="text-muted small mb-0">Nessun ruolo presente.</p>
            )}
          </div>

          {/* Colonna editor */}
          <Card className="card-border">
            <Card.Body>
              {!selection ? (
                <p className="text-muted mb-0">
                  Seleziona un ruolo per vederne i permessi{canManage ? ', o crea un nuovo ruolo' : ''}.
                </p>
              ) : (
                <>
                  <div className="d-flex flex-wrap justify-content-between align-items-end gap-2 mb-3">
                    <Form.Group className="flex-grow-1" style={{ maxWidth: '380px' }}>
                      <Form.Label className="small text-muted mb-1">Nome ruolo</Form.Label>
                      <Form.Control
                        type="text"
                        value={draftName}
                        maxLength={50}
                        disabled={!isEditable || saving}
                        onChange={(event) => setDraftName(event.target.value)}
                        placeholder="Es. Reparto Grafica"
                      />
                    </Form.Group>
                    <div className="small text-muted pb-2">
                      {selectedPermissionCount} permessi selezionati
                    </div>
                  </div>

                  {isSystemRole && (
                    <Alert variant="secondary" className="py-2 small">
                      Questo è un ruolo di sistema: i suoi permessi non sono modificabili.
                    </Alert>
                  )}
                  {formError && <Alert variant="danger" className="py-2">{formError}</Alert>}

                  {modules.map((module) => {
                    const keys = module.permissions.map((permission) => permission.key);
                    const selectedInModule = keys.filter((key) => draftPermissions.has(key)).length;
                    const allSelected = selectedInModule === keys.length && keys.length > 0;
                    const partiallySelected = selectedInModule > 0 && !allSelected;

                    return (
                      <div className="roles-perm-module" key={module.key}>
                        <div className="roles-perm-module-head">
                          <ModuleToggle
                            checked={allSelected}
                            indeterminate={partiallySelected}
                            disabled={!isEditable || saving}
                            onChange={() => toggleModule(module)}
                            label={module.name}
                          />
                          <span className="small text-muted">
                            {selectedInModule}/{keys.length}
                          </span>
                        </div>
                        <div className="roles-perm-grid">
                          {module.permissions.map((permission) => (
                            <Form.Check
                              key={permission.key}
                              type="checkbox"
                              id={`perm-${permission.key}`}
                              checked={draftPermissions.has(permission.key)}
                              disabled={!isEditable || saving}
                              onChange={() => togglePermission(permission.key)}
                              label={
                                <span>
                                  {permission.description}
                                  <span className="d-block text-muted" style={{ fontSize: '0.72rem' }}>
                                    {permission.key}
                                  </span>
                                </span>
                              }
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })}

                  {isEditable && (
                    <div className="d-flex flex-wrap gap-2 mt-3">
                      <Button variant="primary" onClick={onSave} disabled={saving}>
                        {saving ? 'Salvataggio…' : isDraft ? 'Crea ruolo' : 'Salva modifiche'}
                      </Button>
                      <Button
                        variant="outline-secondary"
                        onClick={() => setSelection(null)}
                        disabled={saving}
                      >
                        Annulla
                      </Button>
                      {!isDraft && selectedRole && (
                        <Button
                          variant="outline-danger"
                          className="ms-auto"
                          onClick={onDelete}
                          disabled={saving}
                        >
                          Elimina ruolo
                        </Button>
                      )}
                    </div>
                  )}
                </>
              )}
            </Card.Body>
          </Card>
        </div>
      )}
    </div>
  );
};

export default RolesSettings;
