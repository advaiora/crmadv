// Validazione lato client del form cliente.
// Estratta da ClientForm.jsx (sopra soglia): funzioni pure, testabili da sole.

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const EMAIL_ERROR_MESSAGE = 'Inserisci una email valida.';
export const PEC_ERROR_MESSAGE = 'Inserisci un indirizzo PEC valido.';
export const PHONE_ERROR_MESSAGE = 'Inserisci un numero di telefono valido.';
export const SDI_ERROR_MESSAGE =
    'Il codice destinatario SDI ha 7 caratteri (6 per la Pubblica Amministrazione).';

// Sette caratteri alfanumerici per le aziende, sei per la Pubblica Amministrazione.
// Il campo ne accetta al massimo 7, ma senza questo controllo un codice TRONCATO
// (tre caratteri, un incollaggio finito male) verrebbe salvato lo stesso: il guasto
// si scoprirebbe solo quando l'Agenzia delle Entrate scarta la fattura.
const SDI_CODE_REGEX = /^[A-Z0-9]{6,7}$/;

export const validateForm = (values, phoneValidationResult) => {
    const errors = {};

    if (!values.name.trim()) {
        errors.name = 'Questo campo e obbligatorio.';
    }

    const email = values.email.trim().toLowerCase();
    if (email && !EMAIL_REGEX.test(email)) {
        errors.email = EMAIL_ERROR_MESSAGE;
    }

    // La PEC e' un indirizzo di posta a tutti gli effetti: stessa forma, messaggio diverso
    // perche' chi sbaglia deve capire QUALE dei due campi email non va.
    const pecEmail = (values.pecEmail || '').trim().toLowerCase();
    if (pecEmail && !EMAIL_REGEX.test(pecEmail)) {
        errors.pecEmail = PEC_ERROR_MESSAGE;
    }

    const sdiCode = (values.sdiCode || '').trim().toUpperCase();
    if (sdiCode && !SDI_CODE_REGEX.test(sdiCode)) {
        errors.sdiCode = SDI_ERROR_MESSAGE;
    }

    const phone = values.phone.trim();
    if (phone && !phoneValidationResult.isValid) {
        errors.phone = PHONE_ERROR_MESSAGE;
    }

    return errors;
};
