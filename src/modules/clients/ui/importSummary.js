// Lettura del riepilogo che l'import clienti restituisce: dai numeri grezzi del
// backend alle frasi che la schermata mostra. Sta qui, fuori dall'hook e fuori
// dal modal, perche' e' logica pura e come tale si prova da sola.
//
// ⚠️ Le due liste che il backend manda sono tagliate a 100 elementi mentre i
// conteggi continuano a salire (`buildImportPreviewRows` in import-preview.ts,
// e `MAX_IMPORT_ERRORS` in service.ts). La differenza va detta a schermo:
// un'anteprima che elenca 100 righe su 4.000 e tace mente per omissione.

// Quanti errori entrano nel riquadro d'esito a import fatto. E' un riassunto,
// non l'elenco: l'elenco per esteso si vede prima di confermare, nell'anteprima.
export const MAX_OUTCOME_ERRORS = 5;

const toCount = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : 0;
};

const toList = (value) => (Array.isArray(value) ? value : []);

// «1 riga» / «12 righe»: il plurale italiano non si ottiene aggiungendo una "s".
export const formatRowCount = (count) => (count === 1 ? '1 riga' : `${count} righe`);

/**
 * Normalizza il riepilogo della prova senza salvare in cio' che l'anteprima
 * deve mostrare. Regge anche una risposta monca (backend piu' vecchio, campo
 * mancante): tutto scende a zero e a elenco vuoto, senza mai sbagliare per
 * eccesso — e' il verso giusto in cui sbagliare, qui.
 */
export const buildImportPreview = (summary) => {
    const data = summary || {};
    const validRows = toCount(data.validRows);
    const failedRows = toCount(data.failedRows);
    const rows = toList(data.previewRows);
    const errors = toList(data.errors);

    return {
        totalRows: toCount(data.totalRows),
        validRows,
        failedRows,
        rows,
        errors,
        // Quante restano fuori dai due elenchi. Si ricava dalla lunghezza vera
        // delle liste e non dal tetto: se il backend cambia tetto, il conto qui
        // resta giusto da solo.
        hiddenRows: Math.max(validRows - rows.length, 0),
        hiddenErrors: Math.max(failedRows - errors.length, 0),
    };
};

/** La frase in cima all'anteprima: cosa succede se si conferma. */
export const describeImportPreview = (preview) => {
    if (preview.validRows === 0) {
        return 'Nessuna riga di questo file può entrare: correggilo e ricaricalo.';
    }

    const entrano = `Entrano ${formatRowCount(preview.validRows)} su ${preview.totalRows}.`;
    if (preview.failedRows === 0) {
        return `${entrano} Nessuna riga viene scartata.`;
    }

    const scartate =
        preview.failedRows === 1 ? '1 riga viene scartata' : `${preview.failedRows} righe vengono scartate`;

    return `${entrano} ${scartate}.`;
};

/** Il riquadro d'esito a import fatto: quanti clienti sono entrati davvero. */
export const buildImportOutcome = (summary) => {
    const data = summary || {};
    const createdRows = toCount(data.createdRows);
    const failedRows = toCount(data.failedRows);
    const totalRows = toCount(data.totalRows);
    const errors = toList(data.errors).slice(0, MAX_OUTCOME_ERRORS);

    return {
        variant: failedRows > 0 ? 'warning' : 'success',
        text: `Import completato: ${createdRows} creati, ${failedRows} falliti su ${totalRows} righe.`,
        errors,
        hiddenErrors: Math.max(failedRows - errors.length, 0),
    };
};
