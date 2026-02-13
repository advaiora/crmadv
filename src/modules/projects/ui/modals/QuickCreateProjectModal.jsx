import React, { useEffect, useState } from 'react';
import { Alert, Button, Form, Modal } from 'react-bootstrap';

const QuickCreateProjectModal = ({
    show,
    onHide,
    onSubmit,
    submitting,
    submitError,
    categoryId,
    defaultStageId,
    initialValues,
}) => {
    const [name, setName] = useState('');
    const [clientId, setClientId] = useState('');
    const [localError, setLocalError] = useState('');

    useEffect(() => {
        if (!show) {
            return;
        }

        setName(initialValues?.name || '');
        setClientId(initialValues?.clientId || '');
        setLocalError('');
    }, [initialValues?.clientId, initialValues?.name, show]);

    const onFormSubmit = (event) => {
        event.preventDefault();

        const normalizedName = name.trim();
        const normalizedClientId = clientId.trim();

        if (!normalizedName) {
            setLocalError('Il nome del progetto è obbligatorio.');
            return;
        }

        setLocalError('');

        if (typeof onSubmit === 'function') {
            onSubmit({
                name: normalizedName,
                clientId: normalizedClientId || undefined,
                categoryId,
                stageId: defaultStageId,
            });
        }
    };

    return (
        <Modal show={show} onHide={onHide} centered backdrop={submitting ? 'static' : true}>
            <Form onSubmit={onFormSubmit}>
                <Modal.Header closeButton={!submitting}>
                    <Modal.Title>Nuovo progetto rapido</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {(localError || submitError) && (
                        <Alert variant="danger" className="py-2 px-3">
                            {localError || submitError}
                        </Alert>
                    )}

                    <Form.Group className="mb-3">
                        <Form.Label>Nome progetto</Form.Label>
                        <Form.Control
                            value={name}
                            onChange={(event) => setName(event.target.value)}
                            placeholder="Es. Restyling sito ACME"
                            disabled={submitting}
                            autoFocus
                            required
                        />
                    </Form.Group>

                    <Form.Group className="mb-0">
                        <Form.Label>Client ID (opzionale)</Form.Label>
                        <Form.Control
                            value={clientId}
                            onChange={(event) => setClientId(event.target.value)}
                            placeholder="Step successivo: picker clienti"
                            disabled={submitting}
                        />
                    </Form.Group>

                    <input type="hidden" value={categoryId} readOnly />
                    <input type="hidden" value={defaultStageId} readOnly />
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="outline-secondary" onClick={onHide} disabled={submitting}>
                        Annulla
                    </Button>
                    <Button type="submit" variant="primary" disabled={submitting}>
                        {submitting ? 'Creazione...' : 'Crea'}
                    </Button>
                </Modal.Footer>
            </Form>
        </Modal>
    );
};

export default QuickCreateProjectModal;

