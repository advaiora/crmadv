import React from 'react';
import { Button, Card, Col, Form, Row } from 'react-bootstrap';
import { Building2, User } from 'lucide-react';

/** Sezione 1 del form cliente: tipo (persona/azienda) e nome. */
const ClientIdentitySection = ({ values, nameLabel, errors, onFieldChange, loading = false }) => (
    <Card className="clients-form-section card-border mb-3">
        <Card.Header className="clients-form-section-header py-3">
            <h6 className="mb-0">Sezione 1 - Identita</h6>
        </Card.Header>
        <Card.Body>
            <Row className="g-3">
                <Col xl={4} lg={5}>
                    {/* Non e' un campo di testo ma una coppia di bottoni: l'etichetta
                        descrive il gruppo, quindi qui serve un fieldset, non un controlId. */}
                    <Form.Group role="group" aria-labelledby="clients-type-label">
                        <Form.Label id="clients-type-label" as="div">Tipo cliente</Form.Label>
                        <div className="d-flex gap-2">
                            <Button
                                type="button"
                                variant={values.type === 'person' ? 'primary' : 'outline-secondary'}
                                className="d-inline-flex align-items-center gap-2 clients-type-toggle-btn"
                                onClick={() => onFieldChange('type', 'person')}
                                disabled={loading}
                                aria-pressed={values.type === 'person'}
                            >
                                <User size={15} />
                                Persona
                            </Button>
                            <Button
                                type="button"
                                variant={values.type === 'company' ? 'primary' : 'outline-secondary'}
                                className="d-inline-flex align-items-center gap-2 clients-type-toggle-btn"
                                onClick={() => onFieldChange('type', 'company')}
                                disabled={loading}
                                aria-pressed={values.type === 'company'}
                            >
                                <Building2 size={15} />
                                Azienda
                            </Button>
                        </div>
                    </Form.Group>
                </Col>
                <Col xl={8} lg={7}>
                    <Form.Group controlId="clients-name">
                        <Form.Label>{nameLabel}</Form.Label>
                        <Form.Control
                            value={values.name}
                            onChange={(event) => onFieldChange('name', event.target.value)}
                            isInvalid={Boolean(errors.name)}
                            disabled={loading}
                        />
                        <Form.Control.Feedback type="invalid">
                            {errors.name}
                        </Form.Control.Feedback>
                    </Form.Group>
                </Col>
            </Row>
        </Card.Body>
    </Card>
);

export default ClientIdentitySection;
