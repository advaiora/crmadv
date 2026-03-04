import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Button, Card, Col, Form, Modal, Row, Spinner, Table } from 'react-bootstrap';
import { Check, Copy, Eye, EyeOff, Lock, Pencil, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import {
    createVaultItem,
    deleteVaultItem,
    getVaultStatus,
    listVaultClients,
    listVaultItems,
    lockVaultWorkspace,
    revealVaultItem,
    setupVaultWorkspacePassword,
    unlockVaultWorkspace,
    updateVaultItem,
} from '../../modules/vault/api/vaultApi';
import VaultModuleGate from '../../modules/vault/ui/VaultModuleGate';
import { VAULT_PERMISSIONS } from '../../modules/vault/ui/constants';
import '../../modules/vault/ui/vault-ui.css';
import { hasPermission } from '../../utils/workspaceAccess';

const EMPTY_FORM = { clientId: '', name: '', username: '', url: '', tagsText: '', password: '', notes: '' };
const EMPTY_REVEAL = { open: false, item: null, secret: null, visible: false, expiresAt: 0, copied: false };

const normalizeTags = (rawValue) => {
    const set = new Set((rawValue || '').split(',').map((entry) => entry.trim()).filter(Boolean));
    return [...set];
};

const maskValue = (value) => {
    if (!value || typeof value !== 'string') return '********';
    return '*'.repeat(Math.max(8, Math.min(32, value.length)));
};

const isVaultLockedError = (error) => error?.code === 'VAULT_LOCKED' || error?.status === 423;

const getErrorMessage = (error, fallback = 'Operazione non riuscita.') => {
    if (isVaultLockedError(error)) return 'Vault bloccato. Sblocca il workspace per continuare.';
    if (error?.status === 401) return 'Sessione non valida.';
    if (error?.status === 403) return 'Permesso negato.';
    if (error?.status === 404) return 'Risorsa non trovata.';
    if (error?.status === 409) return 'Configurazione gia presente.';
    if (error?.status === 429) return 'Troppi tentativi, riprova tra poco.';
    return error?.message || fallback;
};

const copyText = async (value) => {
    if (!value || !navigator?.clipboard) return false;
    try {
        await navigator.clipboard.writeText(value);
        return true;
    } catch {
        return false;
    }
};

const VaultWorkspace = ({ access }) => {
    const [items, setItems] = useState([]);
    const [clients, setClients] = useState([]);
    const [clientsLoading, setClientsLoading] = useState(false);
    const [clientsError, setClientsError] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [flash, setFlash] = useState({ type: '', text: '' });

    const [statusLoading, setStatusLoading] = useState(true);
    const [vaultExists, setVaultExists] = useState(false);
    const [vaultUnlocked, setVaultUnlocked] = useState(false);
    const [vaultGateError, setVaultGateError] = useState('');
    const [vaultGateBusy, setVaultGateBusy] = useState(false);
    const [vaultPassword, setVaultPassword] = useState('');
    const [vaultConfirmPassword, setVaultConfirmPassword] = useState('');

    const [formOpen, setFormOpen] = useState(false);
    const [formMode, setFormMode] = useState('create');
    const [editingItem, setEditingItem] = useState(null);
    const [form, setForm] = useState(EMPTY_FORM);
    const [formError, setFormError] = useState('');
    const [saving, setSaving] = useState(false);
    const [deletingId, setDeletingId] = useState('');
    const [revealingId, setRevealingId] = useState('');
    const [reveal, setReveal] = useState(EMPTY_REVEAL);

    const canCreate = hasPermission(access, VAULT_PERMISSIONS.create);
    const canEdit = hasPermission(access, VAULT_PERMISSIONS.edit);
    const canDelete = hasPermission(access, VAULT_PERMISSIONS.delete);
    const canReveal = hasPermission(access, VAULT_PERMISSIONS.reveal);
    const canManageSettings = hasPermission(access, VAULT_PERMISSIONS.manageSettings);

    const closeReveal = useCallback(() => setReveal(EMPTY_REVEAL), []);

    const loadStatus = useCallback(async () => {
        setStatusLoading(true);
        setVaultGateError('');
        try {
            const status = await getVaultStatus();
            setVaultExists(Boolean(status?.exists));
            setVaultUnlocked(Boolean(status?.unlocked));
        } catch (statusError) {
            setVaultExists(false);
            setVaultUnlocked(false);
            setVaultGateError(getErrorMessage(statusError, 'Impossibile verificare lo stato del Vault.'));
        } finally {
            setStatusLoading(false);
        }
    }, []);

    const loadItems = useCallback(async () => {
        if (!vaultUnlocked) {
            setItems([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        setError('');
        try {
            const data = await listVaultItems({ limit: 50 });
            setItems(Array.isArray(data?.items) ? data.items : []);
        } catch (loadError) {
            if (isVaultLockedError(loadError)) {
                setVaultUnlocked(false);
                return;
            }
            setError(getErrorMessage(loadError, 'Errore caricamento Vault.'));
        } finally {
            setLoading(false);
        }
    }, [vaultUnlocked]);

    const loadClients = useCallback(async () => {
        if (!vaultUnlocked) {
            setClients([]);
            setClientsError('');
            setClientsLoading(false);
            return;
        }

        setClientsLoading(true);
        setClientsError('');
        try {
            const data = await listVaultClients({ limit: 200 });
            setClients(Array.isArray(data?.items) ? data.items : []);
        } catch (loadError) {
            if (isVaultLockedError(loadError)) {
                setVaultUnlocked(false);
                return;
            }
            setClientsError(getErrorMessage(loadError, 'Errore caricamento clienti.'));
        } finally {
            setClientsLoading(false);
        }
    }, [vaultUnlocked]);

    useEffect(() => {
        void loadStatus();
    }, [loadStatus]);

    useEffect(() => {
        void loadItems();
    }, [loadItems]);

    useEffect(() => {
        void loadClients();
    }, [loadClients]);

    useEffect(() => {
        if (!reveal.open || !reveal.visible || !reveal.expiresAt) return undefined;
        const remainingMs = reveal.expiresAt - Date.now();
        if (remainingMs <= 0) {
            closeReveal();
            return undefined;
        }
        const timeoutId = window.setTimeout(() => {
            closeReveal();
            setFlash({ type: 'info', text: 'Segreto nascosto automaticamente.' });
        }, remainingMs);
        return () => window.clearTimeout(timeoutId);
    }, [closeReveal, reveal.expiresAt, reveal.open, reveal.visible]);

    const openCreate = () => {
        setFormMode('create');
        setEditingItem(null);
        setForm(EMPTY_FORM);
        setFormError('');
        setFormOpen(true);
    };

    const openEdit = (item) => {
        setFormMode('edit');
        setEditingItem(item);
        setForm({
            clientId: item.clientId || '',
            name: item.name || '',
            username: item.username || '',
            url: item.url || '',
            tagsText: Array.isArray(item.tags) ? item.tags.join(', ') : '',
            password: '',
            notes: '',
        });
        setFormError('');
        setFormOpen(true);
    };

    const onSave = async (event) => {
        event.preventDefault();
        if (!form.name.trim()) {
            setFormError('Il nome e obbligatorio.');
            return;
        }

        const payload = {
            clientId: form.clientId || null,
            name: form.name.trim(),
            username: form.username.trim() || null,
            url: form.url.trim() || null,
            tags: normalizeTags(form.tagsText),
            ...(formMode === 'create' || form.password.trim()
                ? { password: form.password.trim(), notes: form.notes.trim() || null }
                : {}),
        };

        if (formMode === 'create' && !payload.password) {
            setFormError('Password obbligatoria in creazione.');
            return;
        }

        setSaving(true);
        setFormError('');
        try {
            if (formMode === 'create') {
                await createVaultItem(payload);
                setFlash({ type: 'success', text: 'Elemento creato.' });
            } else {
                await updateVaultItem(editingItem.id, payload);
                setFlash({ type: 'success', text: 'Elemento aggiornato.' });
            }
            setFormOpen(false);
            setForm(EMPTY_FORM);
            await loadItems();
        } catch (saveError) {
            if (isVaultLockedError(saveError)) {
                setVaultUnlocked(false);
                setFormOpen(false);
                return;
            }
            setFormError(getErrorMessage(saveError));
        } finally {
            setSaving(false);
        }
    };

    const onDelete = async (item) => {
        if (!window.confirm(`Eliminare "${item.name}"?`)) return;
        setDeletingId(item.id);
        try {
            await deleteVaultItem(item.id);
            setFlash({ type: 'success', text: 'Elemento eliminato.' });
            await loadItems();
        } catch (deleteError) {
            if (isVaultLockedError(deleteError)) {
                setVaultUnlocked(false);
                return;
            }
            setFlash({ type: 'danger', text: getErrorMessage(deleteError, 'Eliminazione non riuscita.') });
        } finally {
            setDeletingId('');
        }
    };

    const onReveal = async (item) => {
        setRevealingId(item.id);
        try {
            const result = await revealVaultItem(item.id);
            setReveal({
                open: true,
                item,
                secret: result?.secret || null,
                visible: false,
                expiresAt: 0,
                copied: false,
            });
        } catch (revealError) {
            if (isVaultLockedError(revealError)) {
                setVaultUnlocked(false);
                return;
            }
            setFlash({ type: 'danger', text: getErrorMessage(revealError, 'Reveal non riuscito.') });
        } finally {
            setRevealingId('');
        }
    };

    const onVaultGateSubmit = async (event) => {
        event.preventDefault();
        if (!vaultPassword.trim()) {
            setVaultGateError('Inserisci la password Vault.');
            return;
        }

        if (!vaultExists) {
            if (!canManageSettings) {
                setVaultGateError('Non hai i permessi per configurare la password Vault. Contatta un admin workspace.');
                return;
            }

            if (vaultPassword.trim().length < 8) {
                setVaultGateError('La password Vault deve avere almeno 8 caratteri.');
                return;
            }

            if (vaultPassword !== vaultConfirmPassword) {
                setVaultGateError('Le password non coincidono.');
                return;
            }
        }

        setVaultGateBusy(true);
        setVaultGateError('');

        try {
            if (!vaultExists) {
                await setupVaultWorkspacePassword(vaultPassword);
                setVaultExists(true);
            } else {
                await unlockVaultWorkspace(vaultPassword);
            }

            setVaultUnlocked(true);
            setVaultPassword('');
            setVaultConfirmPassword('');
            await loadItems();
        } catch (unlockError) {
            setVaultGateError(getErrorMessage(unlockError, 'Sblocco Vault non riuscito.'));
        } finally {
            setVaultGateBusy(false);
        }
    };

    const onLockVault = async () => {
        try {
            await lockVaultWorkspace();
        } catch {
            // best effort
        }

        closeReveal();
        setVaultUnlocked(false);
        setVaultPassword('');
        setVaultConfirmPassword('');
    };

    const tagsPreview = useMemo(() => normalizeTags(form.tagsText), [form.tagsText]);

    if (statusLoading) {
        return (
            <div className="container-fluid pt-4 d-flex align-items-center text-muted">
                <Spinner animation="border" size="sm" className="me-2" />
                Verifica stato Vault workspace...
            </div>
        );
    }

    if (!vaultUnlocked) {
        return (
            <div className="container-fluid pt-4">
                <Row className="justify-content-center">
                    <Col md={7} lg={6}>
                        <Card className="card-border shadow-sm">
                            <Card.Body className="p-4">
                                <div className="d-flex align-items-center mb-3">
                                    <ShieldCheck size={18} className="me-2" />
                                    <h5 className="mb-0">Vault Workspace Password</h5>
                                </div>
                                <p className="text-muted mb-3">
                                    {vaultExists
                                        ? 'Il Vault e bloccato. Inserisci la password workspace per accedere ai dati.'
                                        : 'Il Vault non e ancora configurato. Crea la password condivisa del workspace.'}
                                </p>
                                {!vaultExists && !canManageSettings && (
                                    <Alert variant="warning" className="py-2">
                                        Solo un utente con permesso di gestione Vault puo configurare la password iniziale.
                                        Contatta un admin del workspace.
                                    </Alert>
                                )}
                                {vaultGateError && <Alert variant="danger" className="py-2">{vaultGateError}</Alert>}
                                <Form onSubmit={onVaultGateSubmit}>
                                    <Form.Label>Password Vault Workspace</Form.Label>
                                    <Form.Control
                                        type="password"
                                        autoComplete="current-password"
                                        value={vaultPassword}
                                        onChange={(event) => setVaultPassword(event.target.value)}
                                        disabled={vaultGateBusy}
                                    />
                                    {!vaultExists && (
                                        <>
                                            <Form.Label className="mt-3">Conferma password</Form.Label>
                                            <Form.Control
                                                type="password"
                                                autoComplete="new-password"
                                                value={vaultConfirmPassword}
                                                onChange={(event) => setVaultConfirmPassword(event.target.value)}
                                                disabled={vaultGateBusy}
                                            />
                                        </>
                                    )}
                                    <div className="d-flex justify-content-between align-items-center mt-3">
                                        <Button type="button" variant="outline-secondary" onClick={() => void loadStatus()} disabled={vaultGateBusy}>Ricarica</Button>
                                        <Button type="submit" disabled={vaultGateBusy}>
                                            {vaultGateBusy ? 'Attendere...' : vaultExists ? 'Sblocca Vault' : 'Crea e sblocca'}
                                        </Button>
                                    </div>
                                </Form>
                            </Card.Body>
                        </Card>
                    </Col>
                </Row>
            </div>
        );
    }

    return (
        <div className="container-fluid">
            <div className="vault-page-shell pt-3">
                <div className="d-flex justify-content-between align-items-start gap-2 flex-wrap mb-3">
                    <div>
                        <h3 className="mb-1">Vault</h3>
                        <p className="text-muted mb-0">Lista metadata separata dal reveal dei segreti.</p>
                    </div>
                    <div className="d-flex gap-2">
                        <Button variant="outline-secondary" onClick={() => void onLockVault()}><Lock size={15} className="me-1" />Blocca</Button>
                        {canCreate && <Button onClick={openCreate}><Plus size={15} className="me-1" />Nuovo</Button>}
                    </div>
                </div>

                {flash.text && (
                    <Alert variant={flash.type === 'danger' ? 'danger' : flash.type === 'info' ? 'info' : 'success'} onClose={() => setFlash({ type: '', text: '' })} dismissible>
                        {flash.text}
                    </Alert>
                )}

                {error && (
                    <Alert variant="danger" className="d-flex justify-content-between align-items-center gap-2">
                        <span>{error}</span>
                        <Button variant="outline-danger" size="sm" onClick={() => void loadItems()}>Riprova</Button>
                    </Alert>
                )}

                <Card className="card-border mb-3"><Card.Body className="py-2"><Table responsive hover className="mb-0 align-middle"><thead><tr><th>Nome</th><th>Cliente</th><th>Username</th><th>URL</th><th>Tag</th><th>Aggiornato</th><th className="text-end">Azioni</th></tr></thead><tbody>
                    {loading && <tr><td colSpan={7} className="text-center py-4 text-muted"><Spinner animation="border" size="sm" className="me-2" />Caricamento...</td></tr>}
                    {!loading && items.length === 0 && <tr><td colSpan={7} className="text-center py-4 text-muted">Nessun elemento trovato.</td></tr>}
                    {!loading && items.map((item) => (
                        <tr key={item.id}>
                            <td className="fw-semibold">{item.name}</td>
                            <td>
                                {item.client ? (
                                    <>
                                        <div className="fw-semibold">{item.client.name}</div>
                                        <div className="text-muted small">{item.client.email || '-'}</div>
                                    </>
                                ) : (
                                    <span className="text-muted small">-</span>
                                )}
                            </td>
                            <td>{item.username || '-'}</td><td>{item.url ? <a href={item.url} target="_blank" rel="noreferrer">{item.url}</a> : '-'}</td>
                            <td>{Array.isArray(item.tags) && item.tags.length > 0 ? <div className="vault-tags">{item.tags.map((entry) => <Badge key={`${item.id}-${entry}`} bg="light" text="dark">{entry}</Badge>)}</div> : <span className="text-muted small">-</span>}</td>
                            <td>{item.updatedAt ? new Date(item.updatedAt).toLocaleString('it-IT') : '-'}</td>
                            <td><div className="vault-actions">
                                {canReveal && <Button size="sm" variant="outline-primary" onClick={() => void onReveal(item)} disabled={revealingId === item.id}><Eye size={14} className="me-1" />{revealingId === item.id ? 'Attendere...' : 'Reveal'}</Button>}
                                <Button size="sm" variant="outline-secondary" onClick={() => void copyText(item?.username || item?.url || item?.name)}><Copy size={14} className="me-1" />Copy</Button>
                                {canEdit && <Button size="sm" variant="outline-warning" onClick={() => openEdit(item)}><Pencil size={14} className="me-1" />Edit</Button>}
                                {canDelete && <Button size="sm" variant="outline-danger" onClick={() => void onDelete(item)} disabled={deletingId === item.id}><Trash2 size={14} className="me-1" />{deletingId === item.id ? '...' : 'Delete'}</Button>}
                            </div></td>
                        </tr>
                    ))}
                </tbody></Table></Card.Body></Card>
            </div>
            <Modal show={formOpen} onHide={() => !saving && setFormOpen(false)} centered size="lg"><Modal.Header closeButton><Modal.Title>{formMode === 'create' ? 'Nuovo segreto' : 'Modifica segreto'}</Modal.Title></Modal.Header><Form onSubmit={onSave}><Modal.Body><Row className="g-3">
                <Col md={12}><Form.Label>Nome *</Form.Label><Form.Control value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required /></Col>
                <Col md={12}>
                    <Form.Label>Cliente</Form.Label>
                    <Form.Select
                        value={form.clientId || ''}
                        onChange={(event) => setForm((current) => ({ ...current, clientId: event.target.value }))}
                        disabled={clientsLoading}
                    >
                        <option value="">Nessun cliente</option>
                        {Array.isArray(clients) && clients.map((client) => (
                            <option key={client.id} value={client.id}>
                                {client.name}{client.email ? ` (${client.email})` : ''}
                            </option>
                        ))}
                    </Form.Select>
                    {clientsLoading && <div className="text-muted small mt-1">Caricamento clienti...</div>}
                    {clientsError && <div className="text-danger small mt-1">{clientsError}</div>}
                </Col>
                <Col md={6}><Form.Label>Username</Form.Label><Form.Control value={form.username} onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))} /></Col>
                <Col md={6}><Form.Label>URL</Form.Label><Form.Control value={form.url} onChange={(event) => setForm((current) => ({ ...current, url: event.target.value }))} placeholder="https://..." /></Col>
                <Col md={12}><Form.Label>Tag</Form.Label><Form.Control value={form.tagsText} onChange={(event) => setForm((current) => ({ ...current, tagsText: event.target.value }))} placeholder="tag1, tag2" />{tagsPreview.length > 0 && <div className="vault-tags mt-2">{tagsPreview.map((entry) => <Badge key={`preview-${entry}`} bg="light" text="dark">{entry}</Badge>)}</div>}</Col>
                <Col md={12}><hr className="my-0" /></Col>
                <Col md={12}><Form.Label>{formMode === 'create' ? 'Password *' : 'Imposta nuova password'}</Form.Label><Form.Control type="password" autoComplete="new-password" value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} placeholder={formMode === 'edit' ? 'Lascia vuoto per non cambiare il segreto' : ''} /></Col>
                <Col md={12}><Form.Label>Note segrete (opzionale)</Form.Label><Form.Control as="textarea" rows={3} value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} /></Col>
            </Row>{formError && <Alert variant="danger" className="mt-3 mb-0 py-2">{formError}</Alert>}</Modal.Body><Modal.Footer><Button type="button" variant="outline-secondary" disabled={saving} onClick={() => setFormOpen(false)}>Annulla</Button><Button type="submit" disabled={saving}>{saving ? 'Salvataggio...' : 'Salva'}</Button></Modal.Footer></Form></Modal>

            <Modal show={reveal.open} onHide={closeReveal} centered><Modal.Header closeButton><Modal.Title>Reveal</Modal.Title></Modal.Header><Modal.Body>
                <div className="small text-muted mb-1">Voce</div><div className="fw-semibold mb-3">{reveal?.item?.name || '-'}</div>
                <div className="small text-muted mb-1">Password</div><div className="vault-secret-preview mb-3">{reveal.visible ? (reveal?.secret?.password || '-') : maskValue(reveal?.secret?.password)}</div>
                <div className="small text-muted mb-1">Note</div><div className="vault-secret-preview">{reveal.visible ? (reveal?.secret?.notes || '-') : maskValue(reveal?.secret?.notes || '')}</div>
                {!reveal.visible && <Alert variant="warning" className="py-2 mt-3 mb-0">Segreto mascherato di default. Usa Mostra per 15s.</Alert>}
            </Modal.Body><Modal.Footer>
                {!reveal.visible ? (
                    <Button onClick={() => setReveal((current) => ({ ...current, visible: true, expiresAt: Date.now() + 15000, copied: false }))}><Eye size={14} className="me-1" />Mostra per 15s</Button>
                ) : (
                    <>
                        <Button variant="outline-secondary" onClick={async () => {
                            const ok = await copyText(reveal?.secret?.password || '');
                            if (!ok) {
                                setFlash({ type: 'danger', text: 'Clipboard non disponibile.' });
                                return;
                            }
                            setReveal((current) => ({ ...current, copied: true }));
                        }}>{reveal.copied ? <><Check size={14} className="me-1" />Copiato</> : <><Copy size={14} className="me-1" />Copia password</>}</Button>
                        <Button variant="outline-danger" onClick={closeReveal}><EyeOff size={14} className="me-1" />Nascondi ora</Button>
                    </>
                )}
            </Modal.Footer></Modal>
        </div>
    );
};

const VaultPage = () => (
    <VaultModuleGate requiredPermission={VAULT_PERMISSIONS.viewList}>
        {({ access }) => <VaultWorkspace access={access} />}
    </VaultModuleGate>
);

export default VaultPage;
