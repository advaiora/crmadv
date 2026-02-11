import React, { useEffect, useMemo, useState } from 'react';
import { Accordion, Button, Card, Col, Form, InputGroup, Row } from 'react-bootstrap';
import {
    Building2,
    Mail,
    MapPin,
    Phone,
    Plus,
    ReceiptText,
    StickyNote,
    Tag,
    User,
    X,
} from 'lucide-react';
import { CLIENTS_PRESET_TAGS } from './constants';
import { getClientNameLabel, getTagBadgeStyle } from './helpers';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const createDefaultFormValues = () => ({
    type: 'person',
    name: '',
    email: '',
    phone: '',
    vatNumber: '',
    taxCode: '',
    address: {
        street: '',
        city: '',
        zip: '',
        province: '',
        country: '',
    },
    notes: '',
    tags: [],
});

export const mapClientToFormValues = (client) => {
    if (!client) {
        return createDefaultFormValues();
    }

    return {
        type: client.type || 'person',
        name: client.name || '',
        email: client.email || '',
        phone: client.phone || '',
        vatNumber: client.vatNumber || '',
        taxCode: client.taxCode || '',
        address: {
            street: client.address?.street || '',
            city: client.address?.city || '',
            zip: client.address?.zip || '',
            province: client.address?.province || '',
            country: client.address?.country || '',
        },
        notes: client.notes || '',
        tags: Array.isArray(client.tags) ? client.tags.filter(Boolean) : [],
    };
};

const normalizeOptional = (value) => {
    if (typeof value !== 'string') {
        return null;
    }

    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
};

const validateForm = (values) => {
    const errors = {};

    if (!values.name.trim()) {
        errors.name = 'Questo campo e obbligatorio.';
    }

    const email = values.email.trim().toLowerCase();
    if (email && !EMAIL_REGEX.test(email)) {
        errors.email = 'Inserisci una email valida.';
    }

    return errors;
};

const hasTag = (tags, tagValue) => tags.some((tag) => tag.toLowerCase() === tagValue.toLowerCase());

const ClientForm = ({
    initialValues,
    submitLabel = 'Salva',
    onSubmit,
    onCancel,
    loading = false,
}) => {
    const [formValues, setFormValues] = useState(() => ({
        ...createDefaultFormValues(),
        ...(initialValues || {}),
        address: {
            ...createDefaultFormValues().address,
            ...(initialValues?.address || {}),
        },
    }));
    const [tagInput, setTagInput] = useState('');
    const [errors, setErrors] = useState({});

    useEffect(() => {
        if (!initialValues) {
            return;
        }

        setFormValues({
            ...createDefaultFormValues(),
            ...initialValues,
            address: {
                ...createDefaultFormValues().address,
                ...(initialValues.address || {}),
            },
        });
    }, [initialValues]);

    const nameLabel = useMemo(() => getClientNameLabel(formValues.type), [formValues.type]);

    const updateField = (field, value) => {
        setFormValues((prev) => ({
            ...prev,
            [field]: value,
        }));

        if (errors[field]) {
            setErrors((prev) => {
                const next = { ...prev };
                delete next[field];
                return next;
            });
        }
    };

    const updateAddressField = (field, value) => {
        setFormValues((prev) => ({
            ...prev,
            address: {
                ...prev.address,
                [field]: value,
            },
        }));
    };

    const addTag = (tagValue = tagInput) => {
        const normalized = tagValue.trim();
        if (!normalized) {
            return;
        }

        setFormValues((prev) => {
            if (hasTag(prev.tags, normalized)) {
                return prev;
            }

            return {
                ...prev,
                tags: [...prev.tags, normalized],
            };
        });
        setTagInput('');
    };

    const togglePresetTag = (tagValue) => {
        setFormValues((prev) => {
            if (hasTag(prev.tags, tagValue)) {
                return {
                    ...prev,
                    tags: prev.tags.filter((tag) => tag.toLowerCase() !== tagValue.toLowerCase()),
                };
            }

            return {
                ...prev,
                tags: [...prev.tags, tagValue],
            };
        });
    };

    const removeTag = (tagToRemove) => {
        setFormValues((prev) => ({
            ...prev,
            tags: prev.tags.filter((tag) => tag !== tagToRemove),
        }));
    };

    const handleSubmit = async (event) => {
        event.preventDefault();

        const validationErrors = validateForm(formValues);
        setErrors(validationErrors);
        if (Object.keys(validationErrors).length > 0) {
            return;
        }

        const payload = {
            type: formValues.type,
            name: formValues.name.trim(),
            email: normalizeOptional(formValues.email)?.toLowerCase() || null,
            phone: normalizeOptional(formValues.phone),
            vatNumber: normalizeOptional(formValues.vatNumber),
            taxCode: normalizeOptional(formValues.taxCode),
            notes: normalizeOptional(formValues.notes),
            tags: formValues.tags,
            address: {
                street: normalizeOptional(formValues.address.street),
                city: normalizeOptional(formValues.address.city),
                zip: normalizeOptional(formValues.address.zip),
                province: normalizeOptional(formValues.address.province),
                country: normalizeOptional(formValues.address.country),
            },
        };

        await onSubmit(payload);
    };

    return (
        <Form onSubmit={handleSubmit}>
            <Card className="card-border mb-3">
                <Card.Header className="bg-transparent py-3">
                    <h6 className="mb-0">Sezione 1 - Identita</h6>
                </Card.Header>
                <Card.Body>
                    <Row className="g-3">
                        <Col xl={4} lg={5}>
                            <Form.Group>
                                <Form.Label>Tipo cliente</Form.Label>
                                <div className="d-flex gap-2">
                                    <Button
                                        type="button"
                                        variant={formValues.type === 'person' ? 'primary' : 'outline-secondary'}
                                        className="d-inline-flex align-items-center gap-2"
                                        onClick={() => updateField('type', 'person')}
                                        disabled={loading}
                                    >
                                        <User size={15} />
                                        Persona
                                    </Button>
                                    <Button
                                        type="button"
                                        variant={formValues.type === 'company' ? 'primary' : 'outline-secondary'}
                                        className="d-inline-flex align-items-center gap-2"
                                        onClick={() => updateField('type', 'company')}
                                        disabled={loading}
                                    >
                                        <Building2 size={15} />
                                        Azienda
                                    </Button>
                                </div>
                            </Form.Group>
                        </Col>
                        <Col xl={8} lg={7}>
                            <Form.Group>
                                <Form.Label>{nameLabel}</Form.Label>
                                <Form.Control
                                    value={formValues.name}
                                    onChange={(event) => updateField('name', event.target.value)}
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

            <Card className="card-border mb-3">
                <Card.Header className="bg-transparent py-3">
                    <h6 className="mb-0">Sezione 2 - Contatti</h6>
                </Card.Header>
                <Card.Body>
                    <Row className="g-3">
                        <Col md={6}>
                            <Form.Group>
                                <Form.Label>Email</Form.Label>
                                <InputGroup>
                                    <InputGroup.Text>
                                        <Mail size={15} />
                                    </InputGroup.Text>
                                    <Form.Control
                                        type="email"
                                        value={formValues.email}
                                        onChange={(event) => updateField('email', event.target.value)}
                                        isInvalid={Boolean(errors.email)}
                                        disabled={loading}
                                        placeholder="nome@azienda.it"
                                    />
                                </InputGroup>
                                <Form.Control.Feedback type="invalid" className={errors.email ? 'd-block' : ''}>
                                    {errors.email}
                                </Form.Control.Feedback>
                            </Form.Group>
                        </Col>
                        <Col md={6}>
                            <Form.Group>
                                <Form.Label>Telefono</Form.Label>
                                <InputGroup>
                                    <InputGroup.Text>
                                        <Phone size={15} />
                                    </InputGroup.Text>
                                    <Form.Control
                                        value={formValues.phone}
                                        onChange={(event) => updateField('phone', event.target.value)}
                                        disabled={loading}
                                        placeholder="+39 ..."
                                    />
                                </InputGroup>
                            </Form.Group>
                        </Col>
                    </Row>
                </Card.Body>
            </Card>

            <Accordion defaultActiveKey={['fiscal', 'address']} alwaysOpen className="mb-3">
                <Accordion.Item eventKey="fiscal" className="card-border mb-3 overflow-hidden">
                    <Accordion.Header>
                        <span className="d-inline-flex align-items-center gap-2">
                            <ReceiptText size={16} />
                            Sezione 3 - Dati fiscali
                        </span>
                    </Accordion.Header>
                    <Accordion.Body>
                        <Row className="g-3">
                            <Col md={6}>
                                <Form.Group>
                                    <Form.Label>P.IVA</Form.Label>
                                    <Form.Control
                                        value={formValues.vatNumber}
                                        onChange={(event) => updateField('vatNumber', event.target.value)}
                                        disabled={loading}
                                    />
                                </Form.Group>
                            </Col>
                            <Col md={6}>
                                <Form.Group>
                                    <Form.Label>Codice fiscale</Form.Label>
                                    <Form.Control
                                        value={formValues.taxCode}
                                        onChange={(event) => updateField('taxCode', event.target.value)}
                                        disabled={loading}
                                    />
                                </Form.Group>
                            </Col>
                        </Row>
                    </Accordion.Body>
                </Accordion.Item>

                <Accordion.Item eventKey="address" className="card-border mb-3 overflow-hidden">
                    <Accordion.Header>
                        <span className="d-inline-flex align-items-center gap-2">
                            <MapPin size={16} />
                            Sezione 4 - Indirizzo
                        </span>
                    </Accordion.Header>
                    <Accordion.Body>
                        <Row className="g-3">
                            <Col md={8}>
                                <Form.Group>
                                    <Form.Label>Via</Form.Label>
                                    <Form.Control
                                        value={formValues.address.street}
                                        onChange={(event) => updateAddressField('street', event.target.value)}
                                        disabled={loading}
                                    />
                                </Form.Group>
                            </Col>
                            <Col md={4}>
                                <Form.Group>
                                    <Form.Label>CAP</Form.Label>
                                    <Form.Control
                                        value={formValues.address.zip}
                                        onChange={(event) => updateAddressField('zip', event.target.value)}
                                        disabled={loading}
                                    />
                                </Form.Group>
                            </Col>
                            <Col md={4}>
                                <Form.Group>
                                    <Form.Label>Citta</Form.Label>
                                    <Form.Control
                                        value={formValues.address.city}
                                        onChange={(event) => updateAddressField('city', event.target.value)}
                                        disabled={loading}
                                    />
                                </Form.Group>
                            </Col>
                            <Col md={4}>
                                <Form.Group>
                                    <Form.Label>Provincia</Form.Label>
                                    <Form.Control
                                        value={formValues.address.province}
                                        onChange={(event) => updateAddressField('province', event.target.value)}
                                        disabled={loading}
                                    />
                                </Form.Group>
                            </Col>
                            <Col md={4}>
                                <Form.Group>
                                    <Form.Label>Paese</Form.Label>
                                    <Form.Control
                                        value={formValues.address.country}
                                        onChange={(event) => updateAddressField('country', event.target.value)}
                                        disabled={loading}
                                    />
                                </Form.Group>
                            </Col>
                        </Row>
                    </Accordion.Body>
                </Accordion.Item>
            </Accordion>

            <Card className="card-border mb-3">
                <Card.Header className="bg-transparent py-3">
                    <h6 className="mb-0 d-inline-flex align-items-center gap-2">
                        <StickyNote size={15} />
                        Sezione 5 - Note
                    </h6>
                </Card.Header>
                <Card.Body>
                    <Form.Group>
                        <Form.Control
                            as="textarea"
                            rows={4}
                            value={formValues.notes}
                            onChange={(event) => updateField('notes', event.target.value)}
                            disabled={loading}
                            placeholder="Aggiungi note utili sul cliente"
                        />
                    </Form.Group>
                </Card.Body>
            </Card>

            <Card className="card-border mb-3">
                <Card.Header className="bg-transparent py-3">
                    <h6 className="mb-0 d-inline-flex align-items-center gap-2">
                        <Tag size={15} />
                        Sezione 6 - Tag
                    </h6>
                </Card.Header>
                <Card.Body>
                    <div className="mb-3">
                        <Form.Label className="text-muted small mb-2 d-block">Tag suggeriti</Form.Label>
                        <div className="clients-tag-presets">
                            {CLIENTS_PRESET_TAGS.map((presetTag) => {
                                const selected = hasTag(formValues.tags, presetTag);
                                const tagStyle = getTagBadgeStyle(presetTag);
                                const presetStyle = {
                                    backgroundColor: tagStyle.backgroundColor,
                                    borderColor: tagStyle.borderColor,
                                    color: tagStyle.color,
                                    opacity: selected ? 1 : 0.85,
                                };

                                return (
                                    <Button
                                        key={presetTag}
                                        type="button"
                                        size="sm"
                                        variant="light"
                                        className="clients-tag-preset-btn"
                                        style={presetStyle}
                                        onClick={() => togglePresetTag(presetTag)}
                                        disabled={loading}
                                    >
                                        {presetTag}
                                    </Button>
                                );
                            })}
                        </div>
                    </div>

                    <InputGroup className="mb-3">
                        <Form.Control
                            value={tagInput}
                            onChange={(event) => setTagInput(event.target.value)}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                    event.preventDefault();
                                    addTag();
                                }
                            }}
                            placeholder="Aggiungi tag"
                            disabled={loading}
                        />
                        <Button type="button" variant="outline-secondary" onClick={addTag} disabled={loading}>
                            <span className="d-inline-flex align-items-center gap-1">
                                <Plus size={14} />
                                Aggiungi
                            </span>
                        </Button>
                    </InputGroup>
                    {formValues.tags.length > 0 ? (
                        <div className="clients-tags">
                            {formValues.tags.map((tag) => (
                                <span
                                    key={tag}
                                    className="badge d-inline-flex align-items-center gap-1 clients-tag-badge"
                                    style={getTagBadgeStyle(tag)}
                                >
                                    <span>{tag}</span>
                                    <button
                                        type="button"
                                        className="btn btn-link p-0 text-reset"
                                        onClick={() => removeTag(tag)}
                                        aria-label={`Rimuovi tag ${tag}`}
                                    >
                                        <X size={12} />
                                    </button>
                                </span>
                            ))}
                        </div>
                    ) : (
                        <div className="text-muted small">Nessun tag inserito.</div>
                    )}
                </Card.Body>
            </Card>

            <div className="d-flex flex-wrap align-items-center gap-2">
                <Button type="submit" disabled={loading}>
                    {loading ? 'Salvataggio...' : submitLabel}
                </Button>
                <Button type="button" variant="outline-secondary" onClick={onCancel} disabled={loading}>
                    Annulla
                </Button>
            </div>
        </Form>
    );
};

export default ClientForm;
