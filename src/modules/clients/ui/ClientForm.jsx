import React, { useEffect, useMemo, useState } from 'react';
import { Button, Card, Col, Form, InputGroup, Row } from 'react-bootstrap';
import {
    Building2,
    FileText,
    Flag,
    Hash,
    Mail,
    Map,
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
import { getClientNameLabel, getTagBadgeStyle, hasTag } from './helpers';
import { validateAndNormalizePhone } from '../../../../core/utils/phone';
import { customFieldErrorKey, useClientCustomFields, validateRequiredCustomFields } from './clientCustomFields';
import ClientCustomFieldsSection from './components/ClientCustomFieldsSection';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_ERROR_MESSAGE = 'Inserisci una email valida.';
const PHONE_ERROR_MESSAGE = 'Inserisci un numero di telefono valido.';

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
    customFields: {},
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
        customFields: client.customFields && typeof client.customFields === 'object' ? client.customFields : {},
    };
};

const normalizeOptional = (value) => {
    if (typeof value !== 'string') {
        return null;
    }

    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
};

const validateForm = (values, phoneValidationResult) => {
    const errors = {};

    if (!values.name.trim()) {
        errors.name = 'Questo campo e obbligatorio.';
    }

    const email = values.email.trim().toLowerCase();
    if (email && !EMAIL_REGEX.test(email)) {
        errors.email = EMAIL_ERROR_MESSAGE;
    }

    const phone = values.phone.trim();
    if (phone && !phoneValidationResult.isValid) {
        errors.phone = PHONE_ERROR_MESSAGE;
    }

    return errors;
};

const ClientForm = ({
    initialValues,
    submitLabel = 'Salva',
    onSubmit,
    onCancel,
    loading = false,
    canCreateCustomFields = false,
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
    const [emailTouched, setEmailTouched] = useState(false);
    const [phoneTouched, setPhoneTouched] = useState(false);
    const [submitAttempted, setSubmitAttempted] = useState(false);
    const { definitions: customDefs, reload: reloadCustomDefs } = useClientCustomFields();

    const updateCustomField = (key, value) => {
        setFormValues((prev) => ({
            ...prev,
            customFields: { ...(prev.customFields || {}), [key]: value },
        }));
        setErrors((prev) => {
            if (!prev[customFieldErrorKey(key)]) {
                return prev;
            }
            const next = { ...prev };
            delete next[customFieldErrorKey(key)];
            return next;
        });
    };

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
        setErrors({});
        setEmailTouched(false);
        setPhoneTouched(false);
        setSubmitAttempted(false);
    }, [initialValues]);

    const nameLabel = useMemo(() => getClientNameLabel(formValues.type), [formValues.type]);
    const trimmedEmail = formValues.email.trim().toLowerCase();
    const liveEmailError = trimmedEmail && !EMAIL_REGEX.test(trimmedEmail)
        ? EMAIL_ERROR_MESSAGE
        : '';
    const shouldShowEmailError = Boolean(liveEmailError) && (emailTouched || submitAttempted);
    const emailErrorMessage = errors.email || (shouldShowEmailError ? liveEmailError : '');
    const trimmedPhone = formValues.phone.trim();
    const phoneValidation = useMemo(() => {
        if (!trimmedPhone) {
            return { isValid: false };
        }

        return validateAndNormalizePhone(trimmedPhone, formValues.address.country);
    }, [trimmedPhone, formValues.address.country]);
    const livePhoneError = trimmedPhone && !phoneValidation.isValid
        ? PHONE_ERROR_MESSAGE
        : '';
    const shouldShowPhoneError = Boolean(livePhoneError) && (phoneTouched || submitAttempted);
    const phoneErrorMessage = errors.phone || (shouldShowPhoneError ? livePhoneError : '');
    const shouldShowPhonePreview = Boolean(trimmedPhone) && phoneValidation.isValid;

    const updateField = (field, value) => {
        setFormValues((prev) => ({
            ...prev,
            [field]: value,
        }));

        if (field === 'phone') {
            setSubmitAttempted(false);
        }
        if (field === 'email') {
            setSubmitAttempted(false);
        }

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

        if (field === 'country' && errors.phone) {
            setErrors((prev) => {
                const next = { ...prev };
                delete next.phone;
                return next;
            });
            setSubmitAttempted(false);
        }
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
        setSubmitAttempted(true);

        const validationErrors = validateForm(formValues, phoneValidation);

        const currentCustom = formValues.customFields || {};
        Object.assign(validationErrors, validateRequiredCustomFields(customDefs, currentCustom));

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
            customFields: currentCustom,
        };

        await onSubmit(payload);
    };

    return (
        <Form onSubmit={handleSubmit} className="clients-form">
            <Card className="clients-form-section card-border mb-3">
                <Card.Header className="clients-form-section-header py-3">
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
                                        className="d-inline-flex align-items-center gap-2 clients-type-toggle-btn"
                                        onClick={() => updateField('type', 'person')}
                                        disabled={loading}
                                    >
                                        <User size={15} />
                                        Persona
                                    </Button>
                                    <Button
                                        type="button"
                                        variant={formValues.type === 'company' ? 'primary' : 'outline-secondary'}
                                        className="d-inline-flex align-items-center gap-2 clients-type-toggle-btn"
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

            <Card className="clients-form-section card-border mb-3">
                <Card.Header className="clients-form-section-header py-3">
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
                                        onBlur={() => setEmailTouched(true)}
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
                            <Form.Group>
                                <Form.Label>Telefono</Form.Label>
                                <InputGroup>
                                    <InputGroup.Text>
                                        <Phone size={15} />
                                    </InputGroup.Text>
                                    <Form.Control
                                        value={formValues.phone}
                                        onChange={(event) => updateField('phone', event.target.value)}
                                        onBlur={() => setPhoneTouched(true)}
                                        isInvalid={Boolean(phoneErrorMessage)}
                                        disabled={loading}
                                        placeholder="+39 ..."
                                    />
                                </InputGroup>
                                <Form.Control.Feedback type="invalid" className={phoneErrorMessage ? 'd-block' : ''}>
                                    {phoneErrorMessage}
                                </Form.Control.Feedback>
                                {shouldShowPhonePreview && (
                                    <Form.Text className="text-muted d-block mt-1">
                                        Verra salvato come: {phoneValidation.e164}
                                    </Form.Text>
                                )}
                            </Form.Group>
                        </Col>
                    </Row>
                </Card.Body>
            </Card>

            <Card className="clients-form-section card-border mb-3">
                <Card.Header className="clients-form-section-header py-3">
                    <h6 className="mb-0">Sezione 3 - Dati fiscali</h6>
                </Card.Header>
                <Card.Body>
                    <Row className="g-3">
                        <Col md={6}>
                            <Form.Group>
                                <Form.Label>P.IVA</Form.Label>
                                <InputGroup>
                                    <InputGroup.Text>
                                        <ReceiptText size={15} />
                                    </InputGroup.Text>
                                    <Form.Control
                                        value={formValues.vatNumber}
                                        onChange={(event) => updateField('vatNumber', event.target.value)}
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
                            <Form.Group>
                                <Form.Label>Codice fiscale</Form.Label>
                                <InputGroup>
                                    <InputGroup.Text>
                                        <FileText size={15} />
                                    </InputGroup.Text>
                                    <Form.Control
                                        value={formValues.taxCode}
                                        onChange={(event) => updateField('taxCode', event.target.value)}
                                        isInvalid={Boolean(errors.taxCode)}
                                        disabled={loading}
                                    />
                                </InputGroup>
                                <Form.Control.Feedback type="invalid" className={errors.taxCode ? 'd-block' : ''}>
                                    {errors.taxCode}
                                </Form.Control.Feedback>
                            </Form.Group>
                        </Col>
                    </Row>
                </Card.Body>
            </Card>

            <Card className="clients-form-section card-border mb-3">
                <Card.Header className="clients-form-section-header py-3">
                    <h6 className="mb-0">Sezione 4 - Indirizzo</h6>
                </Card.Header>
                <Card.Body>
                    <Row className="g-3">
                        <Col md={8}>
                            <Form.Group>
                                <Form.Label>Via</Form.Label>
                                <InputGroup>
                                    <InputGroup.Text>
                                        <MapPin size={15} />
                                    </InputGroup.Text>
                                    <Form.Control
                                        value={formValues.address.street}
                                        onChange={(event) => updateAddressField('street', event.target.value)}
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
                            <Form.Group>
                                <Form.Label>CAP</Form.Label>
                                <InputGroup>
                                    <InputGroup.Text>
                                        <Hash size={15} />
                                    </InputGroup.Text>
                                    <Form.Control
                                        value={formValues.address.zip}
                                        onChange={(event) => updateAddressField('zip', event.target.value)}
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
                            <Form.Group>
                                <Form.Label>Citta</Form.Label>
                                <InputGroup>
                                    <InputGroup.Text>
                                        <Building2 size={15} />
                                    </InputGroup.Text>
                                    <Form.Control
                                        value={formValues.address.city}
                                        onChange={(event) => updateAddressField('city', event.target.value)}
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
                            <Form.Group>
                                <Form.Label>Provincia</Form.Label>
                                <InputGroup>
                                    <InputGroup.Text>
                                        <Map size={15} />
                                    </InputGroup.Text>
                                    <Form.Control
                                        value={formValues.address.province}
                                        onChange={(event) => updateAddressField('province', event.target.value)}
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
                            <Form.Group>
                                <Form.Label>Paese</Form.Label>
                                <InputGroup>
                                    <InputGroup.Text>
                                        <Flag size={15} />
                                    </InputGroup.Text>
                                    <Form.Control
                                        value={formValues.address.country}
                                        onChange={(event) => updateAddressField('country', event.target.value)}
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

            <Card className="clients-form-section card-border mb-3">
                <Card.Header className="clients-form-section-header py-3">
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

            <Card className="clients-form-section card-border mb-3">
                <Card.Header className="clients-form-section-header py-3">
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

            <ClientCustomFieldsSection
                definitions={customDefs}
                values={formValues.customFields}
                errors={errors}
                onChange={updateCustomField}
                disabled={loading}
                canCreate={canCreateCustomFields}
                onFieldCreated={reloadCustomDefs}
            />

            <div className="clients-form-actions d-flex flex-wrap align-items-center gap-2">
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
