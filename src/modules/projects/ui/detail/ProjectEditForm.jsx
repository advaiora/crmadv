import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Col, Form, Row } from 'react-bootstrap';
import { listClients } from '../../../clients/ui/clientApi';

const hasOwn = (value, key) => Boolean(value) && Object.prototype.hasOwnProperty.call(value, key);

const toDateInputValue = (rawValue) => {
    if (!rawValue) {
        return '';
    }

    const parsedDate = new Date(rawValue);
    if (Number.isNaN(parsedDate.getTime())) {
        return '';
    }

    return parsedDate.toISOString().slice(0, 10);
};

const normalizeEmpty = (value) => {
    if (typeof value !== 'string') {
        return value;
    }

    const trimmed = value.trim();
    return trimmed === '' ? null : trimmed;
};

const normalizeNumericOrNull = (value) => {
    if (value === '') {
        return null;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : value;
};

const normalizeClientIds = (value) => Array.from(
    new Set((Array.isArray(value) ? value : [])
        .map((clientId) => String(clientId).trim())
        .filter(Boolean)),
);

const areSameStringArrays = (left, right) => {
    if (left.length !== right.length) {
        return false;
    }

    const sortedLeft = [...left].sort();
    const sortedRight = [...right].sort();
    return sortedLeft.every((item, index) => item === sortedRight[index]);
};

const ProjectEditForm = ({
    project,
    submitting,
    errorMessage,
    onSubmit,
    onCancel,
    supportedFields = ['name'],
}) => {
    const [formState, setFormState] = useState({
        name: '',
        value: '',
        dueDate: '',
        description: '',
        ownerId: '',
        clientIds: [],
    });
    const [localError, setLocalError] = useState('');
    const [clientSearch, setClientSearch] = useState('');
    const [clients, setClients] = useState([]);
    const [clientsLoading, setClientsLoading] = useState(false);
    const [clientsError, setClientsError] = useState('');

    const supportSet = useMemo(() => new Set(supportedFields), [supportedFields]);

    useEffect(() => {
        setFormState({
            name: project?.name || '',
            value: project?.value ?? '',
            dueDate: toDateInputValue(project?.dueDate),
            description: project?.description || '',
            ownerId: project?.ownerId || '',
            clientIds: normalizeClientIds(
                Array.isArray(project?.clientIds)
                    ? project.clientIds
                    : (project?.clientId ? [project.clientId] : []),
            ),
        });
        setClientSearch('');
        setLocalError('');
    }, [project]);

    useEffect(() => {
        const normalizedSearch = clientSearch.trim();
        let mounted = true;

        setClientsLoading(true);
        setClientsError('');

        const timeoutId = window.setTimeout(() => {
            listClients({
                page: 1,
                pageSize: 100,
                sort: 'name',
                query: normalizedSearch || undefined,
            })
                .then((result) => {
                    if (!mounted) {
                        return;
                    }

                    const items = Array.isArray(result?.items) ? result.items : [];
                    setClients(items);
                })
                .catch((error) => {
                    if (!mounted) {
                        return;
                    }

                    setClients([]);
                    setClientsError(error?.message || 'Impossibile caricare i clienti.');
                })
                .finally(() => {
                    if (!mounted) {
                        return;
                    }

                    setClientsLoading(false);
                });
        }, 250);

        return () => {
            mounted = false;
            window.clearTimeout(timeoutId);
        };
    }, [clientSearch]);

    const handleChange = (fieldName) => (event) => {
        const nextValue = event.target.value;
        setFormState((current) => ({
            ...current,
            [fieldName]: nextValue,
        }));
    };

    const includeField = (fieldName) => {
        if (fieldName === 'clientIds') {
            return supportSet.has(fieldName) && (hasOwn(project, 'clientIds') || hasOwn(project, 'clientId'));
        }

        return supportSet.has(fieldName) && hasOwn(project, fieldName);
    };

    const handleSubmit = (event) => {
        event.preventDefault();

        const normalizedName = (formState.name || '').trim();
        if (!normalizedName) {
            setLocalError('Il nome del progetto e obbligatorio.');
            return;
        }

        const patch = {};

        if (supportSet.has('name') && normalizedName !== (project?.name || '')) {
            patch.name = normalizedName;
        }

        if (includeField('value') && normalizeNumericOrNull(formState.value) !== (project?.value ?? null)) {
            patch.value = normalizeNumericOrNull(formState.value);
        }

        if (includeField('dueDate')) {
            const normalizedDueDate = normalizeEmpty(formState.dueDate);
            const currentDueDate = normalizeEmpty(toDateInputValue(project?.dueDate));
            if (normalizedDueDate !== currentDueDate) {
                patch.dueDate = normalizedDueDate;
            }
        }

        if (includeField('description')) {
            const normalizedDescription = normalizeEmpty(formState.description);
            const currentDescription = normalizeEmpty(project?.description || '');
            if (normalizedDescription !== currentDescription) {
                patch.description = normalizedDescription;
            }
        }

        if (includeField('ownerId')) {
            const normalizedOwnerId = normalizeEmpty(formState.ownerId);
            const currentOwnerId = normalizeEmpty(project?.ownerId || '');
            if (normalizedOwnerId !== currentOwnerId) {
                patch.ownerId = normalizedOwnerId;
            }
        }

        if (includeField('clientIds')) {
            const normalizedClientIds = normalizeClientIds(formState.clientIds);
            const currentClientIds = normalizeClientIds(
                Array.isArray(project?.clientIds)
                    ? project.clientIds
                    : (project?.clientId ? [project.clientId] : []),
            );

            if (!areSameStringArrays(normalizedClientIds, currentClientIds)) {
                patch.clientIds = normalizedClientIds;
            }
        }

        if (Object.keys(patch).length === 0) {
            setLocalError('Nessuna modifica da salvare.');
            return;
        }

        setLocalError('');
        if (typeof onSubmit === 'function') {
            onSubmit(patch);
        }
    };

    return (
        <Card className="card-border mb-3">
            <Card.Header className="bg-transparent d-flex justify-content-between align-items-center">
                <h6 className="mb-0">Modifica progetto</h6>
            </Card.Header>
            <Card.Body>
                {(localError || errorMessage) && (
                    <Alert variant="danger" className="py-2 px-3">
                        {localError || errorMessage}
                    </Alert>
                )}

                <Form onSubmit={handleSubmit}>
                    <Row className="g-3">
                        <Col xs={12} md={6}>
                            <Form.Group>
                                <Form.Label>Nome</Form.Label>
                                <Form.Control
                                    value={formState.name}
                                    onChange={handleChange('name')}
                                    disabled={submitting}
                                    required
                                />
                            </Form.Group>
                        </Col>

                        {includeField('value') && (
                            <Col xs={12} md={6}>
                                <Form.Group>
                                    <Form.Label>Valore</Form.Label>
                                    <Form.Control
                                        value={formState.value}
                                        onChange={handleChange('value')}
                                        type="number"
                                        step="0.01"
                                        disabled={submitting}
                                    />
                                </Form.Group>
                            </Col>
                        )}

                        {includeField('dueDate') && (
                            <Col xs={12} md={6}>
                                <Form.Group>
                                    <Form.Label>Scadenza</Form.Label>
                                    <Form.Control
                                        value={formState.dueDate}
                                        onChange={handleChange('dueDate')}
                                        type="date"
                                        disabled={submitting}
                                    />
                                </Form.Group>
                            </Col>
                        )}

                        {includeField('description') && (
                            <Col xs={12}>
                                <Form.Group>
                                    <Form.Label>Descrizione</Form.Label>
                                    <Form.Control
                                        value={formState.description}
                                        onChange={handleChange('description')}
                                        as="textarea"
                                        rows={3}
                                        disabled={submitting}
                                    />
                                </Form.Group>
                            </Col>
                        )}

                        {includeField('ownerId') && (
                            <Col xs={12} md={6}>
                                <Form.Group>
                                    <Form.Label>Owner ID</Form.Label>
                                    <Form.Control
                                        value={formState.ownerId}
                                        onChange={handleChange('ownerId')}
                                        disabled={submitting}
                                    />
                                </Form.Group>
                            </Col>
                        )}

                        {includeField('clientIds') && (
                            <Col xs={12}>
                                <Form.Group>
                                    <Form.Label>Clienti</Form.Label>
                                    <Form.Control
                                        className="mb-2"
                                        value={clientSearch}
                                        onChange={(event) => setClientSearch(event.target.value)}
                                        placeholder="Cerca cliente per nome o email"
                                        disabled={submitting || clientsLoading}
                                    />
                                    <Form.Select
                                        value={formState.clientIds}
                                        onChange={(event) => {
                                            const selectedValues = Array.from(event.target.selectedOptions).map((option) => option.value);
                                            setFormState((current) => ({
                                                ...current,
                                                clientIds: selectedValues,
                                            }));
                                        }}
                                        multiple
                                        disabled={submitting || clientsLoading}
                                    >
                                        {clients.map((client) => (
                                            <option key={client.id} value={client.id}>
                                                {client.name}
                                                {client.email ? ` - ${client.email}` : ''}
                                            </option>
                                        ))}
                                        {formState.clientIds
                                            .filter((clientId) => !clients.some((client) => String(client.id) === String(clientId)))
                                            .map((clientId) => (
                                                <option key={`missing-${clientId}`} value={clientId}>
                                                    Cliente non trovato ({clientId})
                                                </option>
                                            ))}
                                    </Form.Select>
                                    <div className="small text-muted mt-1">Tieni premuto Ctrl/Cmd per selezionare piu clienti.</div>
                                    {clientsLoading && (
                                        <div className="small text-muted mt-1">Caricamento clienti...</div>
                                    )}
                                    {clientsError && (
                                        <div className="small text-danger mt-1">{clientsError}</div>
                                    )}
                                </Form.Group>
                            </Col>
                        )}
                    </Row>

                    <div className="d-flex justify-content-end gap-2 mt-3">
                        <Button
                            type="button"
                            variant="outline-secondary"
                            onClick={onCancel}
                            disabled={submitting}
                        >
                            Annulla
                        </Button>
                        <Button type="submit" variant="primary" disabled={submitting}>
                            {submitting ? 'Salvataggio...' : 'Salva'}
                        </Button>
                    </div>
                </Form>
            </Card.Body>
        </Card>
    );
};

export default ProjectEditForm;
