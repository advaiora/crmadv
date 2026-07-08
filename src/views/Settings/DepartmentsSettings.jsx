import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Button, Card, Col, Form, Row, Spinner } from 'react-bootstrap';
import { useWorkspaceAccess } from '../../hooks/useWorkspaceAccess';
import { hasPermission } from '../../utils/workspaceAccess';
import { listTeamMembers } from '../../modules/team/api/teamApi';
import {
  assignDepartmentMembers,
  createDepartment,
  deleteDepartment,
  getDepartmentMembers,
  listDepartments,
  setDepartmentMemberRole,
  updateDepartment,
} from '../../modules/departments/api/departmentsApi';

const MANAGE_PERMISSION = 'departments.manage';
const ASSIGN_PERMISSION = 'departments.assign';

const sameSet = (a, b) => {
  if (a.size !== b.size) return false;
  for (const value of a) {
    if (!b.has(value)) return false;
  }
  return true;
};

const DepartmentsSettings = () => {
  const { access } = useWorkspaceAccess();
  const canManage = hasPermission(access, MANAGE_PERMISSION);
  const canAssign = hasPermission(access, ASSIGN_PERMISSION);

  const [departments, setDepartments] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [selection, setSelection] = useState(null); // null | 'new' | departmentId
  const [draftName, setDraftName] = useState('');
  const [draftDescription, setDraftDescription] = useState('');
  const [draftUserIds, setDraftUserIds] = useState(() => new Set());
  const [initialUserIds, setInitialUserIds] = useState(() => new Set());
  const [departmentMembers, setDepartmentMembers] = useState([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [flash, setFlash] = useState('');

  const activeMemberIds = useMemo(
    () => new Set(members.map((member) => member.userId)),
    [members],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [departmentsResult, membersResult] = await Promise.all([
        listDepartments(),
        listTeamMembers(),
      ]);
      setDepartments(departmentsResult?.departments ?? []);
      const activeMembers = (membersResult?.members ?? [])
        .filter((member) => member.status === 'ACTIVE' && member.userId)
        .map((member) => ({ userId: member.userId, name: member.name, email: member.email }));
      setMembers(activeMembers);
    } catch (error) {
      setLoadError(error?.message || 'Impossibile caricare i reparti.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedDepartment = useMemo(
    () =>
      selection && selection !== 'new'
        ? departments.find((department) => department.id === selection)
        : null,
    [selection, departments],
  );
  const isDraft = selection === 'new';

  // Popola il form quando cambia la selezione (e carica i membri del reparto).
  useEffect(() => {
    setFormError('');
    if (isDraft) {
      setDraftName('');
      setDraftDescription('');
      setDraftUserIds(new Set());
      setInitialUserIds(new Set());
      setDepartmentMembers([]);
      return;
    }
    if (!selectedDepartment) {
      return;
    }
    setDraftName(selectedDepartment.name);
    setDraftDescription(selectedDepartment.description || '');

    let cancelled = false;
    setMembersLoading(true);
    (async () => {
      try {
        const result = await getDepartmentMembers(selectedDepartment.id);
        if (cancelled) return;
        // Teniamo solo i membri ancora attivi del workspace.
        const ids = new Set(
          (result?.members ?? [])
            .map((member) => member.id)
            .filter((id) => activeMemberIds.has(id)),
        );
        setDraftUserIds(new Set(ids));
        setInitialUserIds(new Set(ids));
        setDepartmentMembers(result?.members ?? []);
      } catch (error) {
        if (!cancelled) setFormError(error?.message || 'Impossibile caricare i membri del reparto.');
      } finally {
        if (!cancelled) setMembersLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selection, selectedDepartment, isDraft, activeMemberIds]);

  const toggleUser = (userId) => {
    setDraftUserIds((current) => {
      const next = new Set(current);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  const membersChanged = !sameSet(draftUserIds, initialUserIds);

  const onSave = async () => {
    const name = draftName.trim();
    if (!name) {
      setFormError('Il nome del reparto è obbligatorio.');
      return;
    }
    const description = draftDescription.trim();

    setSaving(true);
    setFormError('');
    setFlash('');
    try {
      if (isDraft) {
        const result = await createDepartment({ name, description });
        const newId = result?.department?.id;
        if (canAssign && newId && draftUserIds.size > 0) {
          await assignDepartmentMembers(newId, [...draftUserIds]);
        }
        await load();
        setSelection(newId ?? null);
        setFlash(`Reparto "${name}" creato.`);
      } else if (selectedDepartment) {
        if (canManage) {
          await updateDepartment(selectedDepartment.id, { name, description });
        }
        if (canAssign && membersChanged) {
          await assignDepartmentMembers(selectedDepartment.id, [...draftUserIds]);
        }
        await load();
        const refreshed = await getDepartmentMembers(selectedDepartment.id);
        setDepartmentMembers(refreshed?.members ?? []);
        setFlash(`Reparto "${name}" aggiornato.`);
      }
    } catch (error) {
      setFormError(error?.message || 'Salvataggio non riuscito.');
    } finally {
      setSaving(false);
    }
  };

  const onToggleLead = async (userId, makeLead) => {
    if (!selectedDepartment) return;
    setFormError('');
    try {
      await setDepartmentMemberRole(selectedDepartment.id, userId, makeLead ? 'lead' : 'member');
      const refreshed = await getDepartmentMembers(selectedDepartment.id);
      setDepartmentMembers(refreshed?.members ?? []);
    } catch (error) {
      setFormError(error?.message || 'Aggiornamento grado non riuscito.');
    }
  };

  const onDelete = async () => {
    if (!selectedDepartment) return;
    if (!window.confirm(`Eliminare il reparto "${selectedDepartment.name}"? L'operazione non è reversibile.`)) {
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      await deleteDepartment(selectedDepartment.id);
      setSelection(null);
      await load();
      setFlash(`Reparto "${selectedDepartment.name}" eliminato.`);
    } catch (error) {
      setFormError(error?.message || 'Eliminazione non riuscita.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container-fluid py-4">
      <div className="hk-pg-header pb-3 d-flex flex-wrap justify-content-between align-items-end gap-2">
        <div>
          <h1 className="pg-title mb-1">Reparti</h1>
          <p className="text-muted mb-0">
            Organizza il workspace in reparti (es. Web, Marketing, Social, Grafica, Laboratorio) e
            assegna i membri.
          </p>
        </div>
        {canManage && (
          <Button variant="primary" size="sm" onClick={() => setSelection('new')} disabled={loading}>
            Nuovo reparto
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
        <Row className="g-3">
          <Col md={4}>
            {departments.map((department) => (
              <Card
                key={department.id}
                role="button"
                className={`card-border mb-2 ${selection === department.id ? 'border-primary' : ''}`}
                onClick={() => setSelection(department.id)}
              >
                <Card.Body className="py-2 px-3 d-flex justify-content-between align-items-center gap-2">
                  <span className="fw-semibold text-truncate">{department.name}</span>
                  <Badge bg="light" text="dark" className="border">{department.memberCount}</Badge>
                </Card.Body>
              </Card>
            ))}
            {departments.length === 0 && (
              <p className="text-muted small mb-0">Nessun reparto ancora. Creane uno per iniziare.</p>
            )}
          </Col>

          <Col md={8}>
            <Card className="card-border">
              <Card.Body>
                {!selection ? (
                  <p className="text-muted mb-0">
                    Seleziona un reparto{canManage ? ', o creane uno nuovo' : ''}.
                  </p>
                ) : (
                  <>
                    <Form.Group className="mb-3">
                      <Form.Label className="small text-muted mb-1">Nome reparto</Form.Label>
                      <Form.Control
                        type="text"
                        value={draftName}
                        maxLength={60}
                        disabled={!canManage || saving}
                        onChange={(event) => setDraftName(event.target.value)}
                        placeholder="Es. Grafica"
                      />
                    </Form.Group>
                    <Form.Group className="mb-3">
                      <Form.Label className="small text-muted mb-1">Descrizione (opzionale)</Form.Label>
                      <Form.Control
                        as="textarea"
                        rows={2}
                        value={draftDescription}
                        maxLength={280}
                        disabled={!canManage || saving}
                        onChange={(event) => setDraftDescription(event.target.value)}
                        placeholder="A cosa si occupa il reparto"
                      />
                    </Form.Group>

                    {formError && <Alert variant="danger" className="py-2">{formError}</Alert>}

                    <div className="mb-2 d-flex justify-content-between align-items-end">
                      <Form.Label className="small text-muted mb-0">Membri del reparto</Form.Label>
                      <span className="small text-muted">{draftUserIds.size} selezionati</span>
                    </div>
                    {!canAssign && (
                      <div className="small text-muted mb-2">
                        Non hai il permesso di modificare i membri (serve <code>departments.assign</code>).
                      </div>
                    )}
                    {membersLoading ? (
                      <div className="text-muted small py-2">
                        <Spinner animation="border" size="sm" className="me-2" />Caricamento membri…
                      </div>
                    ) : (
                      <div
                        className="border rounded p-2 mb-3"
                        style={{ maxHeight: '320px', overflowY: 'auto' }}
                      >
                        {members.length === 0 ? (
                          <p className="text-muted small mb-0">Nessun membro attivo nel workspace.</p>
                        ) : (
                          members.map((member) => (
                            <Form.Check
                              key={member.userId}
                              type="checkbox"
                              id={`dept-member-${member.userId}`}
                              checked={draftUserIds.has(member.userId)}
                              disabled={!canAssign || saving}
                              onChange={() => toggleUser(member.userId)}
                              label={
                                <span>
                                  {member.name || member.email}
                                  {member.name && (
                                    <span className="text-muted"> — {member.email}</span>
                                  )}
                                </span>
                              }
                            />
                          ))
                        )}
                      </div>
                    )}

                    {canManage && departmentMembers.length > 0 && (
                      <div className="mb-3">
                        <Form.Label className="small text-muted mb-1">Capi reparto</Form.Label>
                        <div className="small text-muted mb-2">
                          Un capo reparto vede tutti i progetti del reparto e ne gestisce gli accessi dei membri.
                        </div>
                        {departmentMembers.map((member) => (
                          <Form.Check
                            key={`lead-${member.id}`}
                            type="switch"
                            id={`lead-${member.id}`}
                            checked={member.role === 'lead'}
                            disabled={saving}
                            onChange={(event) => onToggleLead(member.id, event.target.checked)}
                            label={
                              <span>
                                {member.name || member.email}
                                {member.role === 'lead' && (
                                  <Badge bg="primary" className="ms-2">Capo</Badge>
                                )}
                              </span>
                            }
                          />
                        ))}
                      </div>
                    )}

                    {(canManage || canAssign) && (
                      <div className="d-flex flex-wrap gap-2">
                        <Button variant="primary" onClick={onSave} disabled={saving}>
                          {saving ? 'Salvataggio…' : isDraft ? 'Crea reparto' : 'Salva modifiche'}
                        </Button>
                        <Button
                          variant="outline-secondary"
                          onClick={() => setSelection(null)}
                          disabled={saving}
                        >
                          Annulla
                        </Button>
                        {!isDraft && selectedDepartment && canManage && (
                          <Button
                            variant="outline-danger"
                            className="ms-auto"
                            onClick={onDelete}
                            disabled={saving}
                          >
                            Elimina reparto
                          </Button>
                        )}
                      </div>
                    )}
                  </>
                )}
              </Card.Body>
            </Card>
          </Col>
        </Row>
      )}
    </div>
  );
};

export default DepartmentsSettings;
