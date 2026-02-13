import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Col, Form, Row } from 'react-bootstrap';

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
        clientId: '',
    });
    const [localError, setLocalError] = useState('');

    const supportSet = useMemo(() => new Set(supportedFields), [supportedFields]);

    useEffect(() => {
        setFormState({
            name: project?.name || '',
            value: project?.value ?? '',
            dueDate: toDateInputValue(project?.dueDate),
            description: project?.description || '',
            ownerId: project?.ownerId || '',
            clientId: project?.clientId || '',
        });
        setLocalError('');
    }, [project]);

    const handleChange = (fieldName) => (event) => {
        const nextValue = event.target.value;
        setFormState((current) => ({
            ...current,
            [fieldName]: nextValue,
        }));
    };

    const includeField = (fieldName) => supportSet.has(fieldName) && hasOwn(project, fieldName);

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

        if (includeField('clientId')) {
            const normalizedClientId = normalizeEmpty(formState.clientId);
            const currentClientId = normalizeEmpty(project?.clientId || '');
            if (normalizedClientId !== currentClientId) {
                patch.clientId = normalizedClientId;
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

                        {includeField('clientId') && (
                            <Col xs={12} md={6}>
                                <Form.Group>
                                    <Form.Label>Client ID</Form.Label>
                                    <Form.Control
                                        value={formState.clientId}
                                        onChange={handleChange('clientId')}
                                        disabled={submitting}
                                    />
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
