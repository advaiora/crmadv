// Valori del form cliente: stato iniziale, lettura di un cliente esistente e
// normalizzazione dei campi opzionali prima del salvataggio.
// Estratto da ClientForm.jsx (sopra soglia) — sono funzioni pure, testabili da sole.

export const createDefaultFormValues = () => ({
    type: 'person',
    name: '',
    email: '',
    phone: '',
    pecEmail: '',
    website: '',
    contactPerson: '',
    vatNumber: '',
    taxCode: '',
    sdiCode: '',
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
        pecEmail: client.pecEmail || '',
        website: client.website || '',
        contactPerson: client.contactPerson || '',
        vatNumber: client.vatNumber || '',
        taxCode: client.taxCode || '',
        sdiCode: client.sdiCode || '',
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

export const normalizeOptional = (value) => {
    if (typeof value !== 'string') {
        return null;
    }

    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
};

/** Il corpo della richiesta di creazione/modifica, a partire dai valori a schermo. */
export const buildClientPayload = (formValues) => ({
    type: formValues.type,
    name: formValues.name.trim(),
    email: normalizeOptional(formValues.email)?.toLowerCase() || null,
    phone: normalizeOptional(formValues.phone),
    pecEmail: normalizeOptional(formValues.pecEmail)?.toLowerCase() || null,
    website: normalizeOptional(formValues.website),
    contactPerson: normalizeOptional(formValues.contactPerson),
    vatNumber: normalizeOptional(formValues.vatNumber),
    taxCode: normalizeOptional(formValues.taxCode),
    sdiCode: normalizeOptional(formValues.sdiCode)?.toUpperCase() || null,
    notes: normalizeOptional(formValues.notes),
    tags: formValues.tags,
    address: {
        street: normalizeOptional(formValues.address.street),
        city: normalizeOptional(formValues.address.city),
        zip: normalizeOptional(formValues.address.zip),
        province: normalizeOptional(formValues.address.province),
        country: normalizeOptional(formValues.address.country),
    },
    customFields: formValues.customFields || {},
});
