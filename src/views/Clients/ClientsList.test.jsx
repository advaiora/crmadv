// Test della pagina "Clienti", limitato ai tre pezzi di collegamento che vivono
// solo qui e che nessun altro test guarda: quali file si possono scegliere,
// che cosa succede quando se ne sceglie uno, e la riga di onesta' del riquadro
// d'esito. Il resto della pagina (elenco, filtri, tag) ha gia' i suoi test.
//
// Il punto piu' delicato e' il primo: «un .xlsx si puo' scegliere» e' un
// criterio di questo lavoro, e senza questo test poggerebbe su una stringa che
// si puo' accorciare per sbaglio senza rompere niente e senza fare rumore.
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ClientsList from './ClientsList';

vi.mock('../../modules/clients/ui/clientApi', () => ({
  listClients: vi.fn(),
  deleteClient: vi.fn(),
  importClients: vi.fn(),
  exportClients: vi.fn(),
}));

// Il cancello dei permessi ha un test suo. Qui lo si lascia passare, dando i
// permessi che servono al pulsante "Importa" per non nascere disabilitato.
vi.mock('../../modules/clients/ui/ClientsModuleGate', () => ({
  default: ({ children }) => {
    const access = {
      enabledModules: ['clients'],
      permissions: ['clients.view', 'clients.create', 'clients.edit', 'clients.delete'],
    };
    return typeof children === 'function' ? children({ access, reload: () => {} }) : children;
  },
}));

import { importClients, listClients } from '../../modules/clients/ui/clientApi';

// jsdom non implementa matchMedia, e l'Offcanvas di react-bootstrap (i filtri su
// schermo stretto) lo chiama senza guardia: senza questo stub la pagina non
// arriva nemmeno a renderizzare. Nessuna media query attiva = schermo largo.
if (typeof window.matchMedia !== 'function') {
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  });
}

const ELENCO_VUOTO = {
  items: [],
  pageInfo: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0, hasNextPage: false, hasPrevPage: false },
};

const MIME_EXCEL = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const renderPagina = () => render(<ClientsList />, { wrapper: MemoryRouter });

const campoFile = () => screen.getByLabelText('Scegli il file CSV o Excel da importare');

const scegliFile = (nome = 'clienti.xlsx') => {
  const input = campoFile();
  fireEvent.change(input, { target: { files: [new File(['nome,email'], nome, { type: MIME_EXCEL })] } });
  return input;
};

// Due prove per una riga sola, perche' di quella riga contano due cose: che
// ci sia, e che stia PRIMA dell'uscita anticipata. In jsdom assegnare 'files'
// non tocca 'value', quindi leggere 'input.value' passerebbe anche senza
// l'azzeramento: si osserva l'assegnazione, non il risultato.
const spiaSuValore = (input) => {
  const assegnazioni = vi.fn();
  Object.defineProperty(input, 'value', {
    configurable: true,
    get: () => '',
    set: assegnazioni,
  });
  return assegnazioni;
};

describe('Pagina Clienti — scelta del file da importare', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listClients.mockResolvedValue(ELENCO_VUOTO);
  });

  it('lascia scegliere un Excel, non solo un CSV', async () => {
    renderPagina();

    const accept = (await waitFor(campoFile)).getAttribute('accept');
    expect(accept).toContain('.csv');
    expect(accept).toContain('.xlsx');
    // L'estensione da sola non basta: senza il tipo MIME per esteso, Windows
    // nasconde gli .xlsx nella finestra di scelta del file.
    expect(accept).toContain(MIME_EXCEL);
  });

  it('scegliendo un file apre l\'anteprima e non salva niente', async () => {
    importClients.mockResolvedValue({
      summary: { totalRows: 3, validRows: 2, failedRows: 1, previewRows: [], errors: [] },
    });

    renderPagina();
    await waitFor(campoFile);
    scegliFile();

    expect(await screen.findByText('Anteprima importazione')).toBeInTheDocument();
    // Una sola chiamata, e in prova senza salvare: la scrittura avviene solo
    // confermando dal modal.
    expect(importClients).toHaveBeenCalledTimes(1);
    expect(importClients.mock.calls[0][1]).toEqual({ dryRun: true });
  });

  it('svuota il campo file, cosi\' lo stesso file si puo\' riscegliere', async () => {
    importClients.mockResolvedValue({
      summary: { totalRows: 1, validRows: 1, failedRows: 0, previewRows: [], errors: [] },
    });

    renderPagina();
    const input = await waitFor(campoFile);
    const assegnazioni = spiaSuValore(input);
    scegliFile();

    await waitFor(() => expect(assegnazioni).toHaveBeenCalledWith(''));
  });

  it('svuota il campo file anche quando non si sceglie niente', async () => {
    renderPagina();
    const input = await waitFor(campoFile);
    const assegnazioni = spiaSuValore(input);
    fireEvent.change(input, { target: { files: [] } });

    // Se l'azzeramento scivolasse sotto l'uscita anticipata, chi apre la
    // finestra e annulla si ritroverebbe l'input ancora carico del file di
    // prima, e riscegliere quello stesso file non farebbe piu' niente.
    await waitFor(() => expect(assegnazioni).toHaveBeenCalledWith(''));
    expect(importClients).not.toHaveBeenCalled();
  });

  it('a import fatto dice quante righe con errori non sta elencando', async () => {
    const errori = Array.from({ length: 8 }, (_, indice) => ({
      row: indice + 1,
      message: 'email non valida',
    }));
    importClients
      .mockResolvedValueOnce({
        summary: { totalRows: 10, validRows: 2, failedRows: 8, previewRows: [], errors: errori },
      })
      .mockResolvedValueOnce({
        summary: { totalRows: 10, createdRows: 2, validRows: 2, failedRows: 8, errors: errori },
      });

    renderPagina();
    await waitFor(campoFile);
    scegliFile('clienti.csv');

    fireEvent.click(await screen.findByRole('button', { name: /Conferma e importa/i }));

    // Il riquadro d'esito ne elenca 5: le altre 3 vanno dette, o l'utente conta
    // quelle che vede e crede che siano tutte.
    expect(
      await screen.findByText('e altre 3 righe con errori, non elencate.'),
    ).toBeInTheDocument();
  });
});
