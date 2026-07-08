import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Badge, Button, Card, Form, Spinner } from 'react-bootstrap';
import { listDepartments } from '../../../departments/api/departmentsApi';
import { listTeamMembers } from '../../../team/api/teamApi';
import {
    getProjectAccess,
    setProjectAccess,
    setProjectDepartments,
} from '../../api/projects.api';

// Pannello di gestione visibilità del progetto: reparti a cui appartiene e
// utenti che lo vedono. Si carica via un endpoint che richiede l'autorizzazione
// a gestire il progetto: se l'utente non può (403/404), il pannello si nasconde.
const ProjectAccessPanel = ({ projectId }) => {
    const [loading, setLoading] = useState(true);
    const [hidden, setHidden] = useState(false);
    const [error, setError] = useState('');
    const [flash, setFlash] = useState('');

    const [departments, setDepartments] = useState([]);
    const [members, setMembers] = useState([]);
    const [departmentIds, setDepartmentIds] = useState(() => new Set());
    const [userIds, setUserIds] = useState(() => new Set());
    const [savingDepts, setSavingDepts] = useState(false);
    const [savingUsers, setSavingUsers] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const access = await getProjectAccess(projectId);
            const [deptResult, teamResult] = await Promise.all([
                listDepartments(),
                listTeamMembers(),
            ]);
            setDepartments(deptResult?.departments ?? []);
            setMembers(
                (teamResult?.members ?? []).filter((m) => m.status === 'ACTIVE' && m.userId),
            );
            setDepartmentIds(new Set(access?.departmentIds ?? []));
            setUserIds(new Set(access?.userIds ?? []));
            setHidden(false);
        } catch (loadError) {
            if (loadError?.status === 403 || loadError?.status === 404) {
                setHidden(true);
                return;
            }
            setError(loadError?.message || 'Impossibile caricare gli accessi del progetto.');
        } finally {
            setLoading(false);
        }
    }, [projectId]);

    useEffect(() => {
        void load();
    }, [load]);

    const toggle = (setter) => (value) => {
        setter((current) => {
            const next = new Set(current);
            if (next.has(value)) {
                next.delete(value);
            } else {
                next.add(value);
            }
            return next;
        });
    };

    const saveDepartments = async () => {
        setSavingDepts(true);
        setError('');
        setFlash('');
        try {
            const result = await setProjectDepartments(projectId, [...departmentIds]);
            setDepartmentIds(new Set(result?.departmentIds ?? []));
            setFlash('Reparti del progetto aggiornati.');
        } catch (saveError) {
            setError(saveError?.message || 'Salvataggio reparti non riuscito.');
        } finally {
            setSavingDepts(false);
        }
    };

    const saveUsers = async () => {
        setSavingUsers(true);
        setError('');
        setFlash('');
        try {
            const result = await setProjectAccess(projectId, [...userIds]);
            setUserIds(new Set(result?.userIds ?? []));
            setFlash('Accessi al progetto aggiornati.');
        } catch (saveError) {
            setError(saveError?.message || 'Salvataggio accessi non riuscito.');
        } finally {
            setSavingUsers(false);
        }
    };

    if (hidden) {
        return null;
    }

    return (
        <Card className="card-border mt-3">
            <Card.Body>
                <h6 className="mb-1">Accessi &amp; Reparti</h6>
                <p className="text-muted small mb-3">
                    Chi non ha visibilità totale vede questo progetto solo se assegnato, o se è
                    capo di un reparto del progetto.
                </p>

                {loading ? (
                    <div className="text-muted small py-2">
                        <Spinner animation="border" size="sm" className="me-2" />Caricamento…
                    </div>
                ) : (
                    <>
                        {flash && (
                            <Alert variant="success" className="py-2" dismissible onClose={() => setFlash('')}>
                                {flash}
                            </Alert>
                        )}
                        {error && <Alert variant="danger" className="py-2">{error}</Alert>}

                        <div className="mb-4">
                            <div className="small text-muted mb-2">Reparti del progetto</div>
                            {departments.length === 0 ? (
                                <p className="text-muted small mb-2">Nessun reparto nel workspace.</p>
                            ) : (
                                <div className="d-flex flex-wrap gap-3 mb-2">
                                    {departments.map((department) => (
                                        <Form.Check
                                            key={department.id}
                                            type="checkbox"
                                            id={`proj-dept-${department.id}`}
                                            label={department.name}
                                            checked={departmentIds.has(department.id)}
                                            disabled={savingDepts}
                                            onChange={() => toggle(setDepartmentIds)(department.id)}
                                        />
                                    ))}
                                </div>
                            )}
                            <Button
                                size="sm"
                                variant="outline-primary"
                                onClick={saveDepartments}
                                disabled={savingDepts || departments.length === 0}
                            >
                                {savingDepts ? 'Salvataggio…' : 'Salva reparti'}
                            </Button>
                        </div>

                        <div>
                            <div className="small text-muted mb-2">
                                Chi vede questo progetto{' '}
                                <Badge bg="light" text="dark" className="border">{userIds.size}</Badge>
                            </div>
                            <div
                                className="border rounded p-2 mb-2"
                                style={{ maxHeight: '260px', overflowY: 'auto' }}
                            >
                                {members.length === 0 ? (
                                    <p className="text-muted small mb-0">Nessun membro attivo.</p>
                                ) : (
                                    members.map((member) => (
                                        <Form.Check
                                            key={member.userId}
                                            type="checkbox"
                                            id={`proj-user-${member.userId}`}
                                            checked={userIds.has(member.userId)}
                                            disabled={savingUsers}
                                            onChange={() => toggle(setUserIds)(member.userId)}
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
                            <Button
                                size="sm"
                                variant="outline-primary"
                                onClick={saveUsers}
                                disabled={savingUsers}
                            >
                                {savingUsers ? 'Salvataggio…' : 'Salva accessi'}
                            </Button>
                        </div>
                    </>
                )}
            </Card.Body>
        </Card>
    );
};

export default ProjectAccessPanel;
