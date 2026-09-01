import React, { useState } from 'react';
import { Button, Card, Col, Form, Row } from 'react-bootstrap';
import { Plus } from 'lucide-react';
import CustomFieldDraftModal from '../../../customFields/ui/CustomFieldDraftModal';
import { customFieldErrorKey } from '../clientCustomFields';

// Sezione 7 della scheda cliente: i campi personalizzati definiti dall'agenzia,
// piu' l'ingresso per crearne uno senza uscire dalla registrazione in corso.
const ClientCustomFieldsSection = ({
    definitions = [],
    values = {},
    errors = {},
    onChange,
    disabled = false,
    canCreate = false,
    onFieldCreated,
}) => {
    const [modalOpen, setModalOpen] = useState(false);

    // Chi non ha ancora nessun campo e non puo' crearne non ha niente da vedere.
    if (definitions.length === 0 && !canCreate) {
        return null;
    }

    const handleSaved = async () => {
        setModalOpen(false);
        await onFieldCreated?.();
    };

    const renderField = (definition) => {
        const rawValue = values?.[definition.key];
        const fieldError = errors[customFieldErrorKey(definition.key)];
        const label = (
            <Form.Label>
                {definition.label}
                {definition.required && <span className="text-danger ms-1">*</span>}
            </Form.Label>
        );

        if (definition.type === 'boolean') {
            return (
                <Col md={6} key={definition.id}>
                    <Form.Group>
                        {label}
                        <Form.Check
                            type="switch"
                            id={`cf-${definition.key}`}
                            label={rawValue ? 'Sì' : 'No'}
                            checked={Boolean(rawValue)}
                            onChange={(event) => onChange(definition.key, event.target.checked)}
                            disabled={disabled}
                        />
                    </Form.Group>
                </Col>
            );
        }

        return (
            <Col md={6} key={definition.id}>
                <Form.Group controlId={`cf-${definition.key}`}>
                    {label}
                    {definition.type === 'select' ? (
                        <Form.Select
                            value={rawValue ?? ''}
                            onChange={(event) => onChange(definition.key, event.target.value)}
                            isInvalid={Boolean(fieldError)}
                            disabled={disabled}
                        >
                            <option value="">— Seleziona —</option>
                            {(definition.options || []).map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label || option.value}
                                </option>
                            ))}
                        </Form.Select>
                    ) : definition.type === 'textarea' ? (
                        <Form.Control
                            as="textarea"
                            rows={3}
                            value={rawValue ?? ''}
                            onChange={(event) => onChange(definition.key, event.target.value)}
                            isInvalid={Boolean(fieldError)}
                            disabled={disabled}
                        />
                    ) : (
                        <Form.Control
                            type={definition.type === 'number' ? 'number' : definition.type === 'date' ? 'date' : 'text'}
                            value={rawValue ?? ''}
                            onChange={(event) => onChange(definition.key, event.target.value)}
                            isInvalid={Boolean(fieldError)}
                            disabled={disabled}
                        />
                    )}
                    <Form.Control.Feedback type="invalid" className={fieldError ? 'd-block' : ''}>
                        {fieldError}
                    </Form.Control.Feedback>
                </Form.Group>
            </Col>
        );
    };

    return (
        <>
            <Card className="clients-form-section card-border mb-3">
                <Card.Header className="clients-form-section-header py-3">
                    <h6 className="mb-0">Sezione 7 - Campi personalizzati</h6>
                </Card.Header>
                <Card.Body>
                    {definitions.length > 0 ? (
                        <Row className="g-3">{definitions.map(renderField)}</Row>
                    ) : (
                        <p className="text-muted small mb-0">
                            Nessun campo personalizzato. Aggiungine uno se ti serve un dato che qui non c&apos;è.
                        </p>
                    )}

                    {canCreate && (
                        <div className={definitions.length > 0 ? 'mt-3' : 'mt-2'}>
                            <Button
                                type="button"
                                variant="link"
                                className="p-0 d-inline-flex align-items-center gap-1 text-decoration-none"
                                onClick={() => setModalOpen(true)}
                                disabled={disabled}
                            >
                                <Plus size={15} />
                                Aggiungi campo personalizzato
                            </Button>
                        </div>
                    )}
                </Card.Body>
            </Card>

            {canCreate && (
                <CustomFieldDraftModal
                    show={modalOpen}
                    onHide={() => setModalOpen(false)}
                    onSaved={handleSaved}
                />
            )}
        </>
    );
};

export default ClientCustomFieldsSection;
