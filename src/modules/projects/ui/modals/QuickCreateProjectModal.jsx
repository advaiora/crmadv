import React, { useEffect, useState } from 'react';
import { Alert, Button, Form, Modal } from 'react-bootstrap';
import { listClients } from '../../../clients/ui/clientApi';

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
    const [description, setDescription] = useState('');
    const [value, setValue] = useState('');
    const [dueDate, setDueDate] = useState('');
    const [clientIds, setClientIds] = useState([]);
    const [localError, setLocalError] = useState('');
    const [clientSearch, setClientSearch] = useState('');
    const [clients, setClients] = useState([]);
    const [clientsLoading, setClientsLoading] = useState(false);
    const [clientsError, setClientsError] = useState('');

    useEffect(() => {
        if (!show) {
            return;
        }

        setName(initialValues?.name ?? '');
        setDescription(initialValues?.description ?? '');
        setValue(initialValues?.value ?? '');
        setDueDate(initialValues?.dueDate ?? '');
        setClientIds(Array.isArray(initialValues?.clientIds)
            ? initialValues.clientIds.map((clientId) => String(clientId))
            : (initialValues?.clientId ? [String(initialValues.clientId)] : []));
        setClientSearch('');
        setLocalError('');
    }, [initialValues?.clientId, initialValues?.clientIds, initialValues?.description, initialValues?.dueDate, initialValues?.name, initialValues?.value, show]);

    useEffect(() => {
        if (!show) {
            return undefined;
        }

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
    }, [clientSearch, show]);

    const onFormSubmit = (event) => {
        event.preventDefault();

        const normalizedName = name.trim();
        const normalizedDescription = description.trim();
        const normalizedValue = value.trim();
        const normalizedDueDate = dueDate.trim();
        const normalizedClientIds = Array.from(
            new Set(
                clientIds
                    .map((clientId) => String(clientId).trim())
                    .filter(Boolean),
            ),
        );
        const numericValue = normalizedValue ? Number(normalizedValue) : undefined;

        if (!normalizedName) {
            setLocalError('Il nome del progetto e obbligatorio.');
            return;
        }

        if (normalizedValue && !Number.isFinite(numericValue)) {
            setLocalError('Il valore deve essere numerico.');
            return;
        }

        setLocalError('');

        if (typeof onSubmit === 'function') {
            const selectedClientSet = new Set(normalizedClientIds);
            const selectedClients = clients.filter((client) => selectedClientSet.has(String(client.id)));
            const primaryClient = selectedClients[0] ?? null;

            onSubmit({
                name: normalizedName,
                description: normalizedDescription || undefined,
                value: numericValue,
                dueDate: normalizedDueDate || undefined,
                clientIds: normalizedClientIds,
                clientId: primaryClient?.id || undefined,
                clientName: primaryClient?.name || null,
                clients: selectedClients,
                categoryId,
                stageId: defaultStageId,
            });
        }
    };

    return (
        <Modal
            show={show}
            onHide={onHide}
            centered
            backdrop={submitting ? 'static' : true}
            className="projects-quick-create-modal"
        >
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

                    <Form.Group className="mb-3">
                        <Form.Label>Descrizione (opzionale)</Form.Label>
                        <Form.Control
                            value={description}
                            onChange={(event) => setDescription(event.target.value)}
                            as="textarea"
                            rows={3}
                            placeholder="Dettagli progetto, obiettivi, note..."
                            disabled={submitting}
                        />
                    </Form.Group>

                    <Form.Group className="mb-3">
                        <Form.Label>Valore (opzionale)</Form.Label>
                        <Form.Control
                            value={value}
                            onChange={(event) => setValue(event.target.value)}
                            type="number"
                            step="0.01"
                            placeholder="Es. 1500"
                            disabled={submitting}
                        />
                    </Form.Group>

                    <Form.Group className="mb-3">
                        <Form.Label>Scadenza (opzionale)</Form.Label>
                        <Form.Control
                            value={dueDate}
                            onChange={(event) => setDueDate(event.target.value)}
                            type="date"
                            disabled={submitting}
                        />
                    </Form.Group>

                    <Form.Group className="mb-0">
                        <Form.Label>Clienti (opzionale)</Form.Label>
                        <Form.Control
                            className="mb-2"
                            value={clientSearch}
                            onChange={(event) => setClientSearch(event.target.value)}
                            placeholder="Cerca cliente per nome o email"
                            disabled={submitting || clientsLoading}
                        />
                        <Form.Select
                            value={clientIds}
                            onChange={(event) => {
                                const selectedValues = Array.from(event.target.selectedOptions).map((option) => option.value);
                                setClientIds(selectedValues);
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
                            {clientIds
                                .filter((selectedClientId) => !clients.some((client) => String(client.id) === String(selectedClientId)))
                                .map((selectedClientId) => (
                                    <option key={`missing-${selectedClientId}`} value={selectedClientId}>
                                        Cliente non trovato ({selectedClientId})
                                    </option>
                                ))}
                        </Form.Select>
                        <div className="small text-muted mt-1">
                            Tieni premuto Ctrl/Cmd per selezionare piu clienti.
                        </div>
                        {clientsLoading && (
                            <div className="small text-muted mt-1">Caricamento clienti...</div>
                        )}
                        {clientsError && (
                            <div className="small text-danger mt-1">{clientsError}</div>
                        )}
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

