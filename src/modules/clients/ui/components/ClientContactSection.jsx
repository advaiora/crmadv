import React from 'react';
import { Card, Col, Form, InputGroup, Row } from 'react-bootstrap';
import { Contact, Globe, Mail, Phone } from 'lucide-react';

/** Sezione 2 del form cliente: come si raggiunge, e con chi si parla. */
const ClientContactSection = ({
    values,
    errors,
    emailErrorMessage,
    phoneErrorMessage,
    phonePreview = '',
    onFieldChange,
    onEmailBlur,
    onPhoneBlur,
    loading = false,
}) => (
    <Card className="clients-form-section card-border mb-3">
        <Card.Header className="clients-form-section-header py-3">
            <h6 className="mb-0">Sezione 2 - Contatti</h6>
        </Card.Header>
        <Card.Body>
            <Row className="g-3">
                <Col md={6}>
                    <Form.Group controlId="clients-email">
                        <Form.Label>Email</Form.Label>
                        <InputGroup>
                            <InputGroup.Text>
                                <Mail size={15} />
                            </InputGroup.Text>
                            <Form.Control
                                type="email"
                                value={values.email}
                                onChange={(event) => onFieldChange('email', event.target.value)}
                                onBlur={onEmailBlur}
                                isInvalid={Boolean(emailErrorMessage)}
                                disabled={loading}
                                placeholder="nome@azienda.it"
                            />
                        </InputGroup>
                        <Form.Control.Feedback type="invalid" className={emailErrorMessage ? 'd-block' : ''}>
                            {emailErrorMessage}
                        </Form.Control.Feedback>
                    </Form.Group>
                </Col>
                <Col md={6}>
                    <Form.Group controlId="clients-phone">
                        <Form.Label>Telefono</Form.Label>
                        <InputGroup>
                            <InputGroup.Text>
                                <Phone size={15} />
                            </InputGroup.Text>
                            <Form.Control
                                value={values.phone}
                                onChange={(event) => onFieldChange('phone', event.target.value)}
                                onBlur={onPhoneBlur}
                                isInvalid={Boolean(phoneErrorMessage)}
                                disabled={loading}
                                placeholder="+39 ..."
                            />
                        </InputGroup>
                        <Form.Control.Feedback type="invalid" className={phoneErrorMessage ? 'd-block' : ''}>
                            {phoneErrorMessage}
                        </Form.Control.Feedback>
                        {phonePreview && (
                            <Form.Text className="text-muted d-block mt-1">
                                Verra salvato come: {phonePreview}
                            </Form.Text>
                        )}
                    </Form.Group>
                </Col>
                <Col md={6}>
                    <Form.Group controlId="clients-contact-person">
                        <Form.Label>Referente</Form.Label>
                        <InputGroup>
                            <InputGroup.Text>
                                <Contact size={15} />
                            </InputGroup.Text>
                            <Form.Control
                                value={values.contactPerson}
                                onChange={(event) => onFieldChange('contactPerson', event.target.value)}
                                isInvalid={Boolean(errors.contactPerson)}
                                disabled={loading}
                                placeholder="La persona con cui si parla"
                            />
                        </InputGroup>
                        <Form.Control.Feedback type="invalid" className={errors.contactPerson ? 'd-block' : ''}>
                            {errors.contactPerson}
                        </Form.Control.Feedback>
                    </Form.Group>
                </Col>
                <Col md={6}>
                    <Form.Group controlId="clients-website">
                        <Form.Label>Sito web</Form.Label>
                        <InputGroup>
                            <InputGroup.Text>
                                <Globe size={15} />
                            </InputGroup.Text>
                            <Form.Control
                                value={values.website}
                                onChange={(event) => onFieldChange('website', event.target.value)}
                                isInvalid={Boolean(errors.website)}
                                disabled={loading}
                                placeholder="www.azienda.it"
                            />
                        </InputGroup>
                        <Form.Control.Feedback type="invalid" className={errors.website ? 'd-block' : ''}>
                            {errors.website}
                        </Form.Control.Feedback>
                    </Form.Group>
                </Col>
            </Row>
        </Card.Body>
    </Card>
);

export default ClientContactSection;
