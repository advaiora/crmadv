import React from 'react';
import { Card, Col, Form, InputGroup, Row } from 'react-bootstrap';
import { FileText, Landmark, MailCheck, ReceiptText } from 'lucide-react';

// Il codice destinatario SDI e' lungo 7 caratteri (6 per la Pubblica Amministrazione).
const SDI_CODE_LENGTH = 7;

/**
 * Sezione 3 del form cliente: i dati con cui si fattura.
 * PEC e codice destinatario SDI stanno qui, e non fra i contatti, perche' sono
 * le due strade alternative della fatturazione elettronica: senza almeno una
 * delle due al cliente non si puo' emettere fattura.
 */
const ClientFiscalSection = ({ values, errors, pecErrorMessage, onFieldChange, onPecBlur, loading = false }) => {
    // Le chiavi si leggono con la guardia: un `initialValues` costruito a mano
    // (senza passare da mapClientToFormValues) lascerebbe il campo indefinito, e
    // qui diventerebbe una pagina bianca invece di un campo vuoto.
    const missingBillingChannel = !(values.pecEmail || '').trim() && !(values.sdiCode || '').trim();

    return (
        <Card className="clients-form-section card-border mb-3">
            <Card.Header className="clients-form-section-header py-3">
                <h6 className="mb-0">Sezione 3 - Dati fiscali</h6>
            </Card.Header>
            <Card.Body>
                <Row className="g-3">
                    <Col md={6}>
                        <Form.Group controlId="clients-vat-number">
                            <Form.Label>P.IVA</Form.Label>
                            <InputGroup>
                                <InputGroup.Text>
                                    <ReceiptText size={15} />
                                </InputGroup.Text>
                                <Form.Control
                                    value={values.vatNumber}
                                    onChange={(event) => onFieldChange('vatNumber', event.target.value)}
                                    isInvalid={Boolean(errors.vatNumber)}
                                    disabled={loading}
                                />
                            </InputGroup>
                            <Form.Control.Feedback type="invalid" className={errors.vatNumber ? 'd-block' : ''}>
                                {errors.vatNumber}
                            </Form.Control.Feedback>
                        </Form.Group>
                    </Col>
                    <Col md={6}>
                        <Form.Group controlId="clients-tax-code">
                            <Form.Label>Codice fiscale</Form.Label>
                            <InputGroup>
                                <InputGroup.Text>
                                    <FileText size={15} />
                                </InputGroup.Text>
                                <Form.Control
                                    value={values.taxCode}
                                    onChange={(event) => onFieldChange('taxCode', event.target.value)}
                                    isInvalid={Boolean(errors.taxCode)}
                                    disabled={loading}
                                />
                            </InputGroup>
                            <Form.Control.Feedback type="invalid" className={errors.taxCode ? 'd-block' : ''}>
                                {errors.taxCode}
                            </Form.Control.Feedback>
                        </Form.Group>
                    </Col>
                    <Col md={6}>
                        <Form.Group controlId="clients-pec-email">
                            <Form.Label>PEC</Form.Label>
                            <InputGroup>
                                <InputGroup.Text>
                                    <MailCheck size={15} />
                                </InputGroup.Text>
                                <Form.Control
                                    type="email"
                                    value={values.pecEmail}
                                    onChange={(event) => onFieldChange('pecEmail', event.target.value)}
                                    onBlur={onPecBlur}
                                    isInvalid={Boolean(pecErrorMessage)}
                                    disabled={loading}
                                    placeholder="azienda@pec.it"
                                />
                            </InputGroup>
                            <Form.Control.Feedback type="invalid" className={pecErrorMessage ? 'd-block' : ''}>
                                {pecErrorMessage}
                            </Form.Control.Feedback>
                        </Form.Group>
                    </Col>
                    <Col md={6}>
                        <Form.Group controlId="clients-sdi-code">
                            <Form.Label>Codice destinatario SDI</Form.Label>
                            <InputGroup>
                                <InputGroup.Text>
                                    <Landmark size={15} />
                                </InputGroup.Text>
                                <Form.Control
                                    value={values.sdiCode}
                                    // Maiuscolo mentre si scrive, non di nascosto al salvataggio:
                                    // il codice si salva comunque maiuscolo, e chi lo rilegge deve
                                    // vedere fin da subito la stessa cosa che finira' in fattura.
                                    onChange={(event) => onFieldChange('sdiCode', event.target.value.toUpperCase())}
                                    isInvalid={Boolean(errors.sdiCode)}
                                    disabled={loading}
                                    maxLength={SDI_CODE_LENGTH}
                                    placeholder="7 caratteri"
                                />
                            </InputGroup>
                            <Form.Control.Feedback type="invalid" className={errors.sdiCode ? 'd-block' : ''}>
                                {errors.sdiCode}
                            </Form.Control.Feedback>
                        </Form.Group>
                    </Col>
                </Row>
                {missingBillingChannel && (
                    <Form.Text className="text-muted d-block mt-3">
                        Per la fatturazione elettronica serve almeno uno fra PEC e codice destinatario SDI.
                    </Form.Text>
                )}
            </Card.Body>
        </Card>
    );
};

export default ClientFiscalSection;
