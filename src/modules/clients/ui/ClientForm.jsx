import React, { useEffect, useMemo, useState } from 'react';
import { Button, Form } from 'react-bootstrap';
import { getClientNameLabel, hasTag } from './helpers';
import { validateAndNormalizePhone } from '../../../../core/utils/phone';
import { customFieldErrorKey, useClientCustomFields, validateRequiredCustomFields } from './clientCustomFields';
import { buildClientPayload, createDefaultFormValues } from './clientFormValues';
import {
    EMAIL_ERROR_MESSAGE,
    EMAIL_REGEX,
    PEC_ERROR_MESSAGE,
    PHONE_ERROR_MESSAGE,
    validateForm,
} from './clientFormValidation';
import ClientCustomFieldsSection from './components/ClientCustomFieldsSection';
import ClientIdentitySection from './components/ClientIdentitySection';
import ClientContactSection from './components/ClientContactSection';
import ClientFiscalSection from './components/ClientFiscalSection';
import ClientAddressSection from './components/ClientAddressSection';
import ClientNotesSection from './components/ClientNotesSection';
import ClientTagsSection from './components/ClientTagsSection';

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
    const [errors, setErrors] = useState({});
    const [emailTouched, setEmailTouched] = useState(false);
    const [pecTouched, setPecTouched] = useState(false);
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
        setPecTouched(false);
        setPhoneTouched(false);
        setSubmitAttempted(false);
    }, [initialValues]);

    const nameLabel = useMemo(() => getClientNameLabel(formValues.type), [formValues.type]);

    const trimmedEmail = formValues.email.trim().toLowerCase();
    const liveEmailError = trimmedEmail && !EMAIL_REGEX.test(trimmedEmail) ? EMAIL_ERROR_MESSAGE : '';
    const shouldShowEmailError = Boolean(liveEmailError) && (emailTouched || submitAttempted);
    const emailErrorMessage = errors.email || (shouldShowEmailError ? liveEmailError : '');

    const trimmedPec = (formValues.pecEmail || '').trim().toLowerCase();
    const livePecError = trimmedPec && !EMAIL_REGEX.test(trimmedPec) ? PEC_ERROR_MESSAGE : '';
    const shouldShowPecError = Boolean(livePecError) && (pecTouched || submitAttempted);
    const pecErrorMessage = errors.pecEmail || (shouldShowPecError ? livePecError : '');

    const trimmedPhone = formValues.phone.trim();
    const phoneValidation = useMemo(() => {
        if (!trimmedPhone) {
            return { isValid: false };
        }

        return validateAndNormalizePhone(trimmedPhone, formValues.address.country);
    }, [trimmedPhone, formValues.address.country]);
    const livePhoneError = trimmedPhone && !phoneValidation.isValid ? PHONE_ERROR_MESSAGE : '';
    const shouldShowPhoneError = Boolean(livePhoneError) && (phoneTouched || submitAttempted);
    const phoneErrorMessage = errors.phone || (shouldShowPhoneError ? livePhoneError : '');
    const phonePreview = trimmedPhone && phoneValidation.isValid ? phoneValidation.e164 : '';

    const updateField = (field, value) => {
        setFormValues((prev) => ({
            ...prev,
            [field]: value,
        }));

        if (field === 'phone' || field === 'email' || field === 'pecEmail') {
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

    const addTag = (tagValue) => {
        setFormValues((prev) => (hasTag(prev.tags, tagValue)
            ? prev
            : { ...prev, tags: [...prev.tags, tagValue] }));
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

        await onSubmit(buildClientPayload(formValues));
    };

    return (
        // `noValidate` spegne la validazione nativa del browser: i campi email e PEC
        // sono `type="email"` (per la tastiera giusta sul telefono), e senza questo il
        // browser bloccherebbe l'invio mostrando il proprio fumetto nella SUA lingua,
        // prima ancora che `handleSubmit` parta — i nostri messaggi in italiano, sotto
        // il campo giusto, non si vedrebbero mai.
        <Form onSubmit={handleSubmit} className="clients-form" noValidate>
            <ClientIdentitySection
                values={formValues}
                nameLabel={nameLabel}
                errors={errors}
                onFieldChange={updateField}
                loading={loading}
            />

            <ClientContactSection
                values={formValues}
                errors={errors}
                emailErrorMessage={emailErrorMessage}
                phoneErrorMessage={phoneErrorMessage}
                phonePreview={phonePreview}
                onFieldChange={updateField}
                onEmailBlur={() => setEmailTouched(true)}
                onPhoneBlur={() => setPhoneTouched(true)}
                loading={loading}
            />

            <ClientFiscalSection
                values={formValues}
                errors={errors}
                pecErrorMessage={pecErrorMessage}
                onFieldChange={updateField}
                onPecBlur={() => setPecTouched(true)}
                loading={loading}
            />

            <ClientAddressSection
                values={formValues.address}
                errors={errors}
                onAddressFieldChange={updateAddressField}
                loading={loading}
            />

            <ClientNotesSection value={formValues.notes} onChange={updateField} loading={loading} />

            <ClientTagsSection
                tags={formValues.tags}
                onAddTag={addTag}
                onTogglePresetTag={togglePresetTag}
                onRemoveTag={removeTag}
                loading={loading}
            />

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
