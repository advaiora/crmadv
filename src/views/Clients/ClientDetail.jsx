import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Alert,
    Button,
    Card,
    Col,
    Modal,
    Placeholder,
    Row,
} from 'react-bootstrap';
import { Link, useHistory, useLocation, useParams } from 'react-router-dom';
import {
    ArrowLeft,
    FolderKanban,
    Mail,
    MapPin,
    Pencil,
    Phone,
    ReceiptText,
    StickyNote,
    Tag,
    Trash2,
    UserRound,
} from 'lucide-react';
import ClientsModuleGate from '../../modules/clients/ui/ClientsModuleGate';
import { deleteClient, getClient } from '../../modules/clients/ui/clientApi';
import { CLIENTS_PERMISSIONS } from '../../modules/clients/ui/constants';
import {
    ClientTypeBadge,
    CopyField,
    PageHeader,
} from '../../modules/clients/ui/components';
import {
    formatAddress,
    formatDateTime,
    getTagBadgeStyle,
    getClientNameLabel,
} from '../../modules/clients/ui/helpers';
import '../../modules/clients/ui/clients-ui.css';
import { hasPermission } from '../../utils/workspaceAccess';

const ClientDetail = () => {
    const history = useHistory();
    const location = useLocation();
    const { id } = useParams();

    const [client, setClient] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [flash, setFlash] = useState(() => location.state?.flash || '');
    const [copiedField, setCopiedField] = useState('');

    const listSearch = location.state?.fromListSearch || '';
    const listPath = useMemo(() => `/apps/clients${listSearch || ''}`, [listSearch]);

    useEffect(() => {
        if (!location.state?.flash) {
            return;
        }

        history.replace({
            pathname: location.pathname,
            search: location.search,
            state: {
                ...(location.state || {}),
                flash: undefined,
            },
        });
    }, [history, location.pathname, location.search, location.state]);

    const loadClient = useCallback(async () => {
        setLoading(true);
        setError('');

        try {
            const data = await getClient(id);
            setClient(data.client);
        } catch (loadError) {
            setError(loadError?.message || 'Errore durante il caricamento del cliente.');
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        void loadClient();
    }, [loadClient]);

    const handleDelete = async () => {
        if (!client || deleting) {
            return;
        }

        setDeleting(true);
        try {
            await deleteClient(client.id);
            history.push('/apps/clients');
        } catch (deleteError) {
            setError(deleteError?.message || 'Errore durante eliminazione cliente.');
        } finally {
            setDeleting(false);
        }
    };

    const copyQuickValue = async (value, fieldName) => {
        if (!value || !navigator?.clipboard) {
            return;
        }

        try {
            await navigator.clipboard.writeText(value);
            setCopiedField(fieldName);
            window.setTimeout(() => {
                setCopiedField((current) => (current === fieldName ? '' : current));
            }, 1200);
        } catch (_error) {
            // Ignore clipboard errors in UI shortcuts.
        }
    };

    const addressValue = formatAddress(client?.address);

    return (
        <ClientsModuleGate requiredPermission={CLIENTS_PERMISSIONS.view}>
            {({ access }) => {
                const canEdit = hasPermission(access, CLIENTS_PERMISSIONS.edit);
                const canDelete = hasPermission(access, CLIENTS_PERMISSIONS.delete);
                const nameLabel = getClientNameLabel(client?.type);
                const hasEmail = Boolean(client?.email);
                const hasPhone = Boolean(client?.phone);
                const associatedProjects = Array.isArray(client?.projects) ? client.projects : [];

                return (
                    <>
                        <div className="container-fluid clients-page-container">
                            <div className="clients-page-shell">
                            <PageHeader
                                icon={UserRound}
                                title={client?.name || 'Dettaglio cliente'}
                                subtitle="Panoramica anagrafica e contatti"
                                breadcrumbs={[
                                    { label: 'Clienti', to: listPath },
                                    { label: 'Dettaglio', active: true },
                                ]}
                                actions={(
                                    <>
                                        <Button as={Link} to={listPath} variant="outline-secondary" className="d-inline-flex align-items-center gap-2 clients-detail-utility-btn">
                                            <ArrowLeft size={15} />
                                            Torna alla lista
                                        </Button>
                                        <Button
                                            variant="outline-secondary"
                                            disabled={!hasEmail}
                                            className="d-inline-flex align-items-center gap-2 clients-detail-utility-btn"
                                            onClick={() => void copyQuickValue(client?.email, 'email')}
                                        >
                                            <Mail size={15} />
                                            {copiedField === 'email' ? 'Email copiata' : 'Copia email'}
                                        </Button>
                                        <Button
                                            variant="outline-secondary"
                                            disabled={!hasPhone}
                                            className="d-inline-flex align-items-center gap-2 clients-detail-utility-btn"
                                            onClick={() => void copyQuickValue(client?.phone, 'phone')}
                                        >
                                            <Phone size={15} />
                                            {copiedField === 'phone' ? 'Telefono copiato' : 'Copia telefono'}
                                        </Button>
                                        {canEdit && client && (
                                            <Button
                                                as={Link}
                                                to={{
                                                    pathname: `/apps/clients/${client.id}/edit`,
                                                    state: { fromListSearch: listSearch },
                                                }}
                                                className="d-inline-flex align-items-center gap-2"
                                            >
                                                <Pencil size={15} />
                                                Modifica
                                            </Button>
                                        )}
                                        {canDelete && client && (
                                            <Button variant="danger" onClick={() => setShowDeleteConfirm(true)} className="d-inline-flex align-items-center gap-2">
                                                <Trash2 size={15} />
                                                Elimina
                                            </Button>
                                        )}
                                    </>
                                )}
                            />

                            {flash && (
                                <Alert variant="success" dismissible onClose={() => setFlash('')}>
                                    {flash}
                                </Alert>
                            )}

                            {error && (
                                <Alert variant="danger">{error}</Alert>
                            )}

                            {loading && (
                                <Card className="card-border">
                                    <Card.Body>
                                        <Placeholder as="div" animation="glow">
                                            <Placeholder xs={12} className="mb-2" />
                                            <Placeholder xs={11} className="mb-2" />
                                            <Placeholder xs={10} />
                                        </Placeholder>
                                    </Card.Body>
                                </Card>
                            )}

                            {!loading && client && (
                                <div className="clients-page-grid">
                                    <div>
                                        <Card className="card-border mb-3">
                                            <Card.Header className="bg-transparent d-flex align-items-center justify-content-between">
                                                <h6 className="mb-0 d-inline-flex align-items-center gap-2">
                                                    <Mail size={15} />
                                                    Contatti
                                                </h6>
                                                <ClientTypeBadge type={client.type} />
                                            </Card.Header>
                                            <Card.Body>
                                                <CopyField
                                                    icon={Mail}
                                                    label="Email"
                                                    value={client.email}
                                                />
                                                <CopyField
                                                    icon={Phone}
                                                    label="Telefono"
                                                    value={client.phone}
                                                />
                                            </Card.Body>
                                        </Card>

                                        <Card className="card-border mb-3">
                                            <Card.Header className="bg-transparent">
                                                <h6 className="mb-0 d-inline-flex align-items-center gap-2">
                                                    <ReceiptText size={15} />
                                                    Dati fiscali
                                                </h6>
                                            </Card.Header>
                                            <Card.Body>
                                                {client.vatNumber || client.taxCode ? (
                                                    <ul className="clients-detail-list">
                                                        {client.vatNumber && (
                                                            <li>
                                                                <span className="text-muted">P.IVA</span>
                                                                <span>{client.vatNumber}</span>
                                                            </li>
                                                        )}
                                                        {client.taxCode && (
                                                            <li>
                                                                <span className="text-muted">Codice fiscale</span>
                                                                <span>{client.taxCode}</span>
                                                            </li>
                                                        )}
                                                    </ul>
                                                ) : (
                                                    <div className="text-muted">Non impostato</div>
                                                )}
                                            </Card.Body>
                                        </Card>

                                        <Card className="card-border mb-3">
                                            <Card.Header className="bg-transparent">
                                                <h6 className="mb-0 d-inline-flex align-items-center gap-2">
                                                    <MapPin size={15} />
                                                    Indirizzo
                                                </h6>
                                            </Card.Header>
                                            <Card.Body>
                                                {addressValue ? addressValue : <span className="text-muted">Non impostato</span>}
                                            </Card.Body>
                                        </Card>
                                    </div>

                                    <div>
                                        <Card className="card-border mb-3">
                                            <Card.Header className="bg-transparent">
                                                <h6 className="mb-0">Dettagli</h6>
                                            </Card.Header>
                                            <Card.Body>
                                                <ul className="clients-detail-list">
                                                    <li>
                                                        <span className="text-muted">{nameLabel}</span>
                                                        <span>{client.name}</span>
                                                    </li>
                                                    <li>
                                                        <span className="text-muted">Tipo</span>
                                                        <ClientTypeBadge type={client.type} />
                                                    </li>
                                                    <li>
                                                        <span className="text-muted">Creato il</span>
                                                        <span>{formatDateTime(client.createdAt)}</span>
                                                    </li>
                                                    <li>
                                                        <span className="text-muted">Aggiornato il</span>
                                                        <span>{formatDateTime(client.updatedAt)}</span>
                                                    </li>
                                                </ul>
                                            </Card.Body>
                                        </Card>

                                        <Card className="card-border mb-3">
                                            <Card.Header className="bg-transparent d-flex justify-content-between align-items-center">
                                                <h6 className="mb-0 d-inline-flex align-items-center gap-2">
                                                    <StickyNote size={15} />
                                                    Note
                                                </h6>
                                                {canEdit && (
                                                    <Button
                                                        as={Link}
                                                        to={{
                                                            pathname: `/apps/clients/${client.id}/edit`,
                                                            state: { fromListSearch: listSearch },
                                                        }}
                                                        variant="outline-secondary"
                                                        size="sm"
                                                    >
                                                        Modifica note
                                                    </Button>
                                                )}
                                            </Card.Header>
                                            <Card.Body>
                                                {client.notes ? client.notes : <span className="text-muted">Non impostato</span>}
                                            </Card.Body>
                                        </Card>

                                        <Card className="card-border">
                                            <Card.Header className="bg-transparent">
                                                <h6 className="mb-0 d-inline-flex align-items-center gap-2">
                                                    <Tag size={15} />
                                                    Tag
                                                </h6>
                                            </Card.Header>
                                            <Card.Body>
                                                {Array.isArray(client.tags) && client.tags.length > 0 ? (
                                                    <div className="clients-tags">
                                                        {client.tags.map((tagItem) => (
                                                            <span key={tagItem} className="badge clients-tag-badge" style={getTagBadgeStyle(tagItem)}>
                                                                {tagItem}
                                                            </span>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <span className="text-muted">Non impostato</span>
                                                )}
                                            </Card.Body>
                                        </Card>

                                        <Card className="card-border mt-3">
                                            <Card.Header className="bg-transparent">
                                                <h6 className="mb-0 d-inline-flex align-items-center gap-2">
                                                    <FolderKanban size={15} />
                                                    Progetti associati
                                                </h6>
                                            </Card.Header>
                                            <Card.Body>
                                                {associatedProjects.length > 0 ? (
                                                    <div className="d-flex flex-column gap-2">
                                                        {associatedProjects.map((project) => (
                                                            <div key={project.id} className="border rounded-3 p-2">
                                                                <div className="d-flex justify-content-between align-items-center gap-2">
                                                                    <Link to={`/projects/${project.id}`} className="fw-semibold text-decoration-none">
                                                                        {project.name}
                                                                    </Link>
                                                                    {project?.stage?.name && (
                                                                        <span className="badge bg-light text-dark border">
                                                                            {project.stage.name}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <div className="small text-muted mt-1">
                                                                    {project?.categoryName ? `Categoria: ${project.categoryName}` : 'Categoria non assegnata'}
                                                                    {' - '}
                                                                    Aggiornato: {formatDateTime(project.updatedAt)}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <span className="text-muted">Nessun progetto associato</span>
                                                )}
                                            </Card.Body>
                                        </Card>
                                    </div>
                                </div>
                            )}
                            </div>
                        </div>

                        <Modal show={showDeleteConfirm} onHide={() => setShowDeleteConfirm(false)} centered>
                            <Modal.Header closeButton>
                                <Modal.Title>Eliminare cliente?</Modal.Title>
                            </Modal.Header>
                            <Modal.Body>
                                Questa azione non puo essere annullata.
                            </Modal.Body>
                            <Modal.Footer>
                                <Button variant="outline-secondary" onClick={() => setShowDeleteConfirm(false)} disabled={deleting}>
                                    Annulla
                                </Button>
                                <Button variant="danger" onClick={() => void handleDelete()} disabled={deleting}>
                                    {deleting ? 'Eliminazione...' : 'Elimina'}
                                </Button>
                            </Modal.Footer>
                        </Modal>
                    </>
                );
            }}
        </ClientsModuleGate>
    );
};

export default ClientDetail;
