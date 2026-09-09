import React from 'react';
import { Card, Col, Form, InputGroup, Row } from 'react-bootstrap';
import { Building2, Flag, Hash, Map, MapPin } from 'lucide-react';

/** Sezione 4 del form cliente: l'indirizzo. */
const ClientAddressSection = ({ values, errors, onAddressFieldChange, loading = false }) => (
    <Card className="clients-form-section card-border mb-3">
        <Card.Header className="clients-form-section-header py-3">
            <h6 className="mb-0">Sezione 4 - Indirizzo</h6>
        </Card.Header>
        <Card.Body>
            <Row className="g-3">
                <Col md={8}>
                    <Form.Group controlId="clients-street">
                        <Form.Label>Via</Form.Label>
                        <InputGroup>
                            <InputGroup.Text>
                                <MapPin size={15} />
                            </InputGroup.Text>
                            <Form.Control
                                value={values.street}
                                onChange={(event) => onAddressFieldChange('street', event.target.value)}
                                isInvalid={Boolean(errors.street)}
                                disabled={loading}
                            />
                        </InputGroup>
                        <Form.Control.Feedback type="invalid" className={errors.street ? 'd-block' : ''}>
                            {errors.street}
                        </Form.Control.Feedback>
                    </Form.Group>
                </Col>
                <Col md={4}>
                    <Form.Group controlId="clients-zip">
                        <Form.Label>CAP</Form.Label>
                        <InputGroup>
                            <InputGroup.Text>
                                <Hash size={15} />
                            </InputGroup.Text>
                            <Form.Control
                                value={values.zip}
                                onChange={(event) => onAddressFieldChange('zip', event.target.value)}
                                isInvalid={Boolean(errors.zip)}
                                disabled={loading}
                            />
                        </InputGroup>
                        <Form.Control.Feedback type="invalid" className={errors.zip ? 'd-block' : ''}>
                            {errors.zip}
                        </Form.Control.Feedback>
                    </Form.Group>
                </Col>
                <Col md={4}>
                    <Form.Group controlId="clients-city">
                        <Form.Label>Citta</Form.Label>
                        <InputGroup>
                            <InputGroup.Text>
                                <Building2 size={15} />
                            </InputGroup.Text>
                            <Form.Control
                                value={values.city}
                                onChange={(event) => onAddressFieldChange('city', event.target.value)}
                                isInvalid={Boolean(errors.city)}
                                disabled={loading}
                            />
                        </InputGroup>
                        <Form.Control.Feedback type="invalid" className={errors.city ? 'd-block' : ''}>
                            {errors.city}
                        </Form.Control.Feedback>
                    </Form.Group>
                </Col>
                <Col md={4}>
                    <Form.Group controlId="clients-province">
                        <Form.Label>Provincia</Form.Label>
                        <InputGroup>
                            <InputGroup.Text>
                                <Map size={15} />
                            </InputGroup.Text>
                            <Form.Control
                                value={values.province}
                                onChange={(event) => onAddressFieldChange('province', event.target.value)}
                                isInvalid={Boolean(errors.province)}
                                disabled={loading}
                            />
                        </InputGroup>
                        <Form.Control.Feedback type="invalid" className={errors.province ? 'd-block' : ''}>
                            {errors.province}
                        </Form.Control.Feedback>
                    </Form.Group>
                </Col>
                <Col md={4}>
                    <Form.Group controlId="clients-country">
                        <Form.Label>Paese</Form.Label>
                        <InputGroup>
                            <InputGroup.Text>
                                <Flag size={15} />
                            </InputGroup.Text>
                            <Form.Control
                                value={values.country}
                                onChange={(event) => onAddressFieldChange('country', event.target.value)}
                                isInvalid={Boolean(errors.country)}
                                disabled={loading}
                                placeholder="ISO2 (es. IT)"
                            />
                        </InputGroup>
                        <Form.Control.Feedback type="invalid" className={errors.country ? 'd-block' : ''}>
                            {errors.country}
                        </Form.Control.Feedback>
                    </Form.Group>
                </Col>
            </Row>
        </Card.Body>
    </Card>
);

export default ClientAddressSection;
