import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Button, Card, Col, Form, Modal, Row, Spinner, Table } from 'react-bootstrap';
import { Plus, Pencil, Play, Pause, Trash2 } from 'lucide-react';
import { toast } from 'react-toastify';
import {
  activateAdminWorkspace,
  createAdminWorkspace,
  demotePlatformAdmin,
  listAdminWorkspaces,
  listPlatformAdmins,
  promotePlatformAdmin,
  searchAdminUsers,
  suspendAdminWorkspace,
  updateAdminWorkspace,
} from '../../../modules/admin/api/adminApi';

const formatDate = (value) => {
  if (!value) {
    return '—';
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('it-IT');
};

const getErrorMessage = (error, fallback) => error?.message || fallback;

// Pannello "Gestione workspace & accessi" della Console piattaforma:
// creazione/rinomina/sospensione dei workspace + gestione dei Super Admin di piattaforma.
const PlatformWorkspacesPanel = ({ currentUserId }) => {
  const [workspaces, setWorkspaces] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [newName, setNewName] = useState('');
  const [newSlug, setNewSlug] = useState('');
  const [creating, setCreating] = useState(false);

  const [editingWorkspace, setEditingWorkspace] = useState(null);
  const [savingWorkspace, setSavingWorkspace] = useState(false);
  const [busyWorkspaceId, setBusyWorkspaceId] = useState('');

  const [userQuery, setUserQuery] = useState('');
  const [userResults, setUserResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [busyAdminId, setBusyAdminId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [workspacesResult, adminsResult] = await Promise.all([
        listAdminWorkspaces(),
        listPlatformAdmins(),
      ]);
      setWorkspaces(workspacesResult?.workspaces ?? []);
      setAdmins(adminsResult?.admins ?? []);
    } catch (error) {
      setLoadError(getErrorMessage(error, 'Impossibile caricare i dati della console.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCreateWorkspace = async (event) => {
    event.preventDefault();
    if (!newName.trim()) {
      toast.error('Nome workspace obbligatorio');
      return;
    }
    setCreating(true);
    try {
      await createAdminWorkspace({ name: newName.trim(), slug: newSlug.trim() || undefined });
      setNewName('');
      setNewSlug('');
      await load();
      toast.success('Workspace creato');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Errore creazione workspace'));
    } finally {
      setCreating(false);
    }
  };

  const handleSaveWorkspace = async () => {
    if (!editingWorkspace?.id) {
      return;
    }
    if (!editingWorkspace.name.trim()) {
      toast.error('Nome workspace obbligatorio');
      return;
    }
    setSavingWorkspace(true);
    try {
      await updateAdminWorkspace(editingWorkspace.id, {
        name: editingWorkspace.name.trim(),
        slug: editingWorkspace.slug.trim(),
      });
      setEditingWorkspace(null);
      await load();
      toast.success('Workspace aggiornato');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Errore salvataggio workspace'));
    } finally {
      setSavingWorkspace(false);
    }
  };

  const handleToggleSuspend = async (workspace) => {
    setBusyWorkspaceId(workspace.id);
    try {
      if (workspace.status === 'SUSPENDED') {
        await activateAdminWorkspace(workspace.id);
        toast.success('Workspace riattivato');
      } else {
        await suspendAdminWorkspace(workspace.id);
        toast.success('Workspace sospeso');
      }
      await load();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Errore aggiornamento stato'));
    } finally {
      setBusyWorkspaceId('');
    }
  };

  const handleSearchUsers = async (event) => {
    event.preventDefault();
    setSearching(true);
    try {
      const result = await searchAdminUsers(userQuery.trim());
      setUserResults(result?.users ?? []);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Errore ricerca utenti'));
    } finally {
      setSearching(false);
    }
  };

  const handlePromote = async (userId) => {
    setBusyAdminId(userId);
    try {
      await promotePlatformAdmin(userId);
      await load();
      setUserResults((current) =>
        current.map((user) => (user.id === userId ? { ...user, isPlatformAdmin: true } : user)),
      );
      toast.success('Super Admin di piattaforma aggiunto');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Errore promozione'));
    } finally {
      setBusyAdminId('');
    }
  };

  const handleDemote = async (userId) => {
    setBusyAdminId(userId);
    try {
      await demotePlatformAdmin(userId);
      await load();
      toast.success('Super Admin di piattaforma rimosso');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Errore rimozione'));
    } finally {
      setBusyAdminId('');
    }
  };

  const adminIds = useMemo(() => new Set(admins.map((admin) => admin.id)), [admins]);

  return (
    <>
      {loadError && (
        <Alert variant="danger" onClose={() => setLoadError('')} dismissible>
          {loadError}
        </Alert>
      )}

      <Card className="card-border mb-4">
        <Card.Header className="bg-transparent">
          <h6 className="mb-0">Nuovo workspace</h6>
        </Card.Header>
        <Card.Body>
          <Form onSubmit={handleCreateWorkspace}>
            <Row className="g-2 align-items-end">
              <Col md={5}>
                <Form.Group>
                  <Form.Label>Nome</Form.Label>
                  <Form.Control
                    value={newName}
                    onChange={(event) => setNewName(event.target.value)}
                    placeholder="Es. Studio Rossi"
                    disabled={creating}
                  />
                </Form.Group>
              </Col>
              <Col md={5}>
                <Form.Group>
                  <Form.Label>
                    Slug <span className="text-muted small">(opzionale, generato dal nome)</span>
                  </Form.Label>
                  <Form.Control
                    value={newSlug}
                    onChange={(event) => setNewSlug(event.target.value)}
                    placeholder="studio-rossi"
                    disabled={creating}
                  />
                </Form.Group>
              </Col>
              <Col md={2}>
                <Button
                  type="submit"
                  variant="primary"
                  className="w-100 d-inline-flex align-items-center justify-content-center gap-2"
                  disabled={creating}
                >
                  <Plus size={16} />
                  Crea
                </Button>
              </Col>
            </Row>
          </Form>
        </Card.Body>
      </Card>

      <Card className="card-border mb-4">
        <Card.Header className="bg-transparent d-flex justify-content-between align-items-center">
          <h6 className="mb-0">Workspace</h6>
          <Badge bg="light" text="dark">{workspaces.length}</Badge>
        </Card.Header>
        <Card.Body className="p-0">
          {loading ? (
            <div className="p-4 d-flex justify-content-center">
              <Spinner animation="border" size="sm" role="status" />
            </div>
          ) : workspaces.length === 0 ? (
            <div className="p-4 text-muted">Nessun workspace presente.</div>
          ) : (
            <Table responsive hover className="mb-0 align-middle">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Slug</th>
                  <th>Stato</th>
                  <th className="text-end">Membri</th>
                  <th className="text-end">Progetti</th>
                  <th>Creato</th>
                  <th className="text-end">Azioni</th>
                </tr>
              </thead>
              <tbody>
                {workspaces.map((workspace) => {
                  const suspended = workspace.status === 'SUSPENDED';
                  const busy = busyWorkspaceId === workspace.id;
                  return (
                    <tr key={workspace.id}>
                      <td className="fw-semibold">{workspace.name}</td>
                      <td className="text-muted">{workspace.slug}</td>
                      <td>
                        <Badge bg={suspended ? 'secondary' : 'success'}>
                          {suspended ? 'Sospeso' : 'Attivo'}
                        </Badge>
                      </td>
                      <td className="text-end">{workspace._count?.memberships ?? 0}</td>
                      <td className="text-end">{workspace._count?.projects ?? 0}</td>
                      <td className="text-muted">{formatDate(workspace.createdAt)}</td>
                      <td>
                        <div className="d-flex justify-content-end gap-1">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline-secondary"
                            onClick={() =>
                              setEditingWorkspace({
                                id: workspace.id,
                                name: workspace.name,
                                slug: workspace.slug,
                              })
                            }
                            disabled={busy}
                          >
                            <Pencil size={14} />
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant={suspended ? 'outline-success' : 'outline-warning'}
                            onClick={() => void handleToggleSuspend(workspace)}
                            disabled={busy}
                          >
                            {suspended ? <Play size={14} /> : <Pause size={14} />}
                            <span className="ms-1">{suspended ? 'Riattiva' : 'Sospendi'}</span>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </Card.Body>
      </Card>

      <Card className="card-border mb-4">
        <Card.Header className="bg-transparent d-flex justify-content-between align-items-center">
          <h6 className="mb-0">Super Admin di piattaforma</h6>
          <Badge bg="light" text="dark">{admins.length}</Badge>
        </Card.Header>
        <Card.Body>
          {admins.length === 0 ? (
            <div className="text-muted mb-3">Nessun Super Admin di piattaforma.</div>
          ) : (
            <Table responsive hover className="mb-3 align-middle">
              <thead>
                <tr>
                  <th>Utente</th>
                  <th>Email</th>
                  <th className="text-end">Azioni</th>
                </tr>
              </thead>
              <tbody>
                {admins.map((admin) => {
                  const isSelf = admin.id === currentUserId;
                  return (
                    <tr key={admin.id}>
                      <td className="fw-semibold">
                        {admin.name || '—'}
                        {isSelf && (
                          <Badge bg="light" text="dark" className="ms-2">
                            Tu
                          </Badge>
                        )}
                      </td>
                      <td className="text-muted">{admin.email}</td>
                      <td>
                        <div className="d-flex justify-content-end">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline-danger"
                            onClick={() => void handleDemote(admin.id)}
                            disabled={isSelf || busyAdminId === admin.id}
                            title={isSelf ? 'Non puoi rimuovere te stesso' : 'Rimuovi'}
                          >
                            <Trash2 size={14} />
                            <span className="ms-1">Rimuovi</span>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}

          <div className="border-top pt-3">
            <div className="small text-muted mb-2">Promuovi un utente esistente</div>
            <Form onSubmit={handleSearchUsers}>
              <Row className="g-2 align-items-end">
                <Col md={9}>
                  <Form.Control
                    value={userQuery}
                    onChange={(event) => setUserQuery(event.target.value)}
                    placeholder="Cerca per email o nome"
                    disabled={searching}
                  />
                </Col>
                <Col md={3}>
                  <Button type="submit" variant="outline-primary" className="w-100" disabled={searching}>
                    {searching ? 'Ricerca…' : 'Cerca'}
                  </Button>
                </Col>
              </Row>
            </Form>

            {userResults.length > 0 && (
              <Table responsive hover className="mt-3 mb-0 align-middle">
                <tbody>
                  {userResults.map((user) => {
                    const alreadyAdmin = user.isPlatformAdmin || adminIds.has(user.id);
                    return (
                      <tr key={user.id}>
                        <td className="fw-semibold">{user.name || '—'}</td>
                        <td className="text-muted">{user.email}</td>
                        <td>
                          <div className="d-flex justify-content-end">
                            {alreadyAdmin ? (
                              <Badge bg="success">Già admin</Badge>
                            ) : (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline-primary"
                                onClick={() => void handlePromote(user.id)}
                                disabled={busyAdminId === user.id}
                              >
                                <Plus size={14} />
                                <span className="ms-1">Promuovi</span>
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            )}
          </div>
        </Card.Body>
      </Card>

      <Modal show={Boolean(editingWorkspace)} onHide={() => setEditingWorkspace(null)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Modifica workspace</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group className="mb-3">
            <Form.Label>Nome</Form.Label>
            <Form.Control
              value={editingWorkspace?.name || ''}
              onChange={(event) =>
                setEditingWorkspace((current) => ({ ...(current || {}), name: event.target.value }))
              }
              autoFocus
            />
          </Form.Group>
          <Form.Group>
            <Form.Label>Slug</Form.Label>
            <Form.Control
              value={editingWorkspace?.slug || ''}
              onChange={(event) =>
                setEditingWorkspace((current) => ({ ...(current || {}), slug: event.target.value }))
              }
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setEditingWorkspace(null)}>
            Annulla
          </Button>
          <Button variant="primary" onClick={() => void handleSaveWorkspace()} disabled={savingWorkspace}>
            {savingWorkspace ? 'Salvataggio…' : 'Salva'}
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default PlatformWorkspacesPanel;
