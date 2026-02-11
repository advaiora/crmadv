import React, { useState } from 'react';
import { Button, Dropdown, Modal } from 'react-bootstrap';
import { Eye, MoreVertical, Pencil, Trash2 } from 'lucide-react';

const CLIENTS_ACTIONS_POPPER_CONFIG = {
    strategy: 'fixed',
    modifiers: [
        {
            name: 'computeStyles',
            options: {
                adaptive: false,
            },
        },
    ],
};

const ClientActionsMenu = ({
    client,
    canEdit = false,
    canDelete = false,
    onOpen,
    onEdit,
    onDelete,
    disabled = false,
}) => {
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState('');

    const handleDelete = async () => {
        if (!onDelete || !client || deleting) {
            return;
        }

        setDeleting(true);
        setDeleteError('');
        try {
            await onDelete(client);
            setShowDeleteConfirm(false);
        } catch (error) {
            setDeleteError(error?.message || 'Errore durante eliminazione.');
        } finally {
            setDeleting(false);
        }
    };

    return (
        <>
            <Dropdown align="end" className="clients-actions-dropdown">
                <Dropdown.Toggle
                    variant="flush-dark"
                    className="btn-icon btn-rounded flush-soft-hover no-caret"
                    disabled={disabled}
                    aria-label={`Azioni cliente ${client?.name || ''}`}
                >
                    <span className="icon">
                        <MoreVertical size={16} />
                    </span>
                </Dropdown.Toggle>
                <Dropdown.Menu
                    className="clients-actions-menu"
                    renderOnMount
                    popperConfig={CLIENTS_ACTIONS_POPPER_CONFIG}
                >
                    <Dropdown.Item
                        onClick={() => onOpen?.(client)}
                        className="d-flex align-items-center gap-2"
                    >
                        <Eye size={15} />
                        <span>Apri</span>
                    </Dropdown.Item>
                    {canEdit && (
                        <Dropdown.Item
                            onClick={() => onEdit?.(client)}
                            className="d-flex align-items-center gap-2"
                        >
                            <Pencil size={15} />
                            <span>Modifica</span>
                        </Dropdown.Item>
                    )}
                    {canDelete && (
                        <Dropdown.Item
                            onClick={() => setShowDeleteConfirm(true)}
                            className="d-flex align-items-center gap-2 text-danger"
                        >
                            <Trash2 size={15} />
                            <span>Elimina</span>
                        </Dropdown.Item>
                    )}
                </Dropdown.Menu>
            </Dropdown>

            <Modal
                show={showDeleteConfirm}
                onHide={() => setShowDeleteConfirm(false)}
                centered
                aria-labelledby="delete-client-dialog-title"
            >
                <Modal.Header closeButton>
                    <Modal.Title id="delete-client-dialog-title">Eliminare cliente?</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    Questa azione non puo essere annullata.
                    {client?.name ? ` Cliente: ${client.name}.` : ''}
                    {deleteError && (
                        <div className="text-danger small mt-2">{deleteError}</div>
                    )}
                </Modal.Body>
                <Modal.Footer>
                    <Button
                        variant="outline-secondary"
                        onClick={() => setShowDeleteConfirm(false)}
                        disabled={deleting}
                    >
                        Annulla
                    </Button>
                    <Button variant="danger" onClick={() => void handleDelete()} disabled={deleting}>
                        {deleting ? 'Eliminazione...' : 'Elimina'}
                    </Button>
                </Modal.Footer>
            </Modal>
        </>
    );
};

export default ClientActionsMenu;
