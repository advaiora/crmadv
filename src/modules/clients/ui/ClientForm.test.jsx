import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ClientForm from './ClientForm';
import { mapClientToFormValues } from './clientFormValues';

const listCustomFields = vi.fn();
const createCustomField = vi.fn();

vi.mock('../../customFields/api/customFieldsApi', () => ({
  listCustomFields: (...args) => listCustomFields(...args),
  createCustomField: (...args) => createCustomField(...args),
  updateCustomField: vi.fn(),
}));

const campoSettore = {
  id: 'cf1',
  key: 'settore',
  label: 'Settore merceologico',
  type: 'text',
  required: false,
  active: true,
};

// Ogni gruppo del form ha il suo `controlId`, quindi l'etichetta e' legata al
// campo e si cerca per etichetta — come farebbe chi usa uno screen reader.
const campoNome = () => screen.getByLabelText('Nome e cognome');

describe('ClientForm — campi personalizzati', () => {
  beforeEach(() => {
    listCustomFields.mockReset().mockResolvedValue({ definitions: [] });
    createCustomField.mockReset().mockResolvedValue({ definition: campoSettore });
  });

  it('senza il permesso di modifica e senza campi, la sezione non compare', async () => {
    render(<ClientForm onSubmit={vi.fn()} onCancel={vi.fn()} />);
    await waitFor(() => expect(listCustomFields).toHaveBeenCalledWith('client'));
    expect(screen.queryByText('Sezione 7 - Campi personalizzati')).not.toBeInTheDocument();
  });

  it('mostra i campi personalizzati gia' + "'" + ' definiti, saltando quelli nascosti', async () => {
    listCustomFields.mockResolvedValue({
      definitions: [campoSettore, { ...campoSettore, id: 'cf2', key: 'vecchio', label: 'Campo nascosto', active: false }],
    });
    render(<ClientForm onSubmit={vi.fn()} onCancel={vi.fn()} />);

    expect(await screen.findByLabelText('Settore merceologico')).toBeInTheDocument();
    expect(screen.queryByLabelText('Campo nascosto')).not.toBeInTheDocument();
  });

  it('crea un campo senza uscire dal percorso, non perde i dati e lo rende subito compilabile', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<ClientForm submitLabel="Crea cliente" onSubmit={onSubmit} onCancel={vi.fn()} canCreateCustomFields />);

    // Si comincia a registrare il cliente.
    const ingresso = await screen.findByRole('button', { name: /Aggiungi campo personalizzato/ });
    fireEvent.change(campoNome(), { target: { value: 'Trattoria Da Beppe' } });

    // Il campo che manca si crea da qui, senza lasciare la pagina.
    listCustomFields.mockResolvedValue({ definitions: [campoSettore] });
    fireEvent.click(ingresso);
    fireEvent.change(await screen.findByLabelText('Etichetta'), { target: { value: 'Settore merceologico' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salva' }));

    await waitFor(() => expect(createCustomField).toHaveBeenCalledTimes(1));

    // Il campo nuovo e' subito li', e il cliente in corso non si e' perso.
    const nuovoCampo = await screen.findByLabelText('Settore merceologico');
    expect(campoNome()).toHaveValue('Trattoria Da Beppe');
    expect(screen.queryByText('Nuovo campo personalizzato')).not.toBeInTheDocument();

    // Ed e' compilabile: il valore arriva nel salvataggio del cliente.
    fireEvent.change(nuovoCampo, { target: { value: 'Ristorazione' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crea cliente' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      name: 'Trattoria Da Beppe',
      customFields: { settore: 'Ristorazione' },
    });
  });

  it('un campo personalizzato obbligatorio e vuoto ferma il salvataggio', async () => {
    listCustomFields.mockResolvedValue({ definitions: [{ ...campoSettore, required: true }] });
    const onSubmit = vi.fn();
    render(<ClientForm submitLabel="Crea cliente" onSubmit={onSubmit} onCancel={vi.fn()} />);

    await screen.findByLabelText(/Settore merceologico/);
    fireEvent.change(campoNome(), { target: { value: 'Trattoria Da Beppe' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crea cliente' }));

    expect(await screen.findByText('Questo campo è obbligatorio.')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe('ClientForm — PEC, SDI, sito web e referente', () => {
  beforeEach(() => {
    listCustomFields.mockReset().mockResolvedValue({ definitions: [] });
    createCustomField.mockReset();
  });

  const rendiForm = (props = {}) =>
    render(<ClientForm submitLabel="Crea cliente" onSubmit={vi.fn()} onCancel={vi.fn()} {...props} />);

  it('i quattro campi si raggiungono dalla loro etichetta', async () => {
    rendiForm();
    await waitFor(() => expect(listCustomFields).toHaveBeenCalled());

    expect(screen.getByLabelText('PEC')).toBeInTheDocument();
    expect(screen.getByLabelText('Codice destinatario SDI')).toBeInTheDocument();
    expect(screen.getByLabelText('Sito web')).toBeInTheDocument();
    expect(screen.getByLabelText('Referente')).toBeInTheDocument();
  });

  it('quello che si scrive nei quattro campi arriva nel salvataggio', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    rendiForm({ onSubmit });
    await waitFor(() => expect(listCustomFields).toHaveBeenCalled());

    fireEvent.change(campoNome(), { target: { value: 'Trattoria Da Beppe' } });
    fireEvent.change(screen.getByLabelText('PEC'), { target: { value: 'beppe@pec.it' } });
    fireEvent.change(screen.getByLabelText('Codice destinatario SDI'), { target: { value: 'abc1234' } });
    fireEvent.change(screen.getByLabelText('Sito web'), { target: { value: 'www.dabeppe.it' } });
    fireEvent.change(screen.getByLabelText('Referente'), { target: { value: 'Giuseppe Rossi' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crea cliente' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      pecEmail: 'beppe@pec.it',
      sdiCode: 'ABC1234',
      website: 'www.dabeppe.it',
      contactPerson: 'Giuseppe Rossi',
    });
  });

  it('un cliente esistente si riapre coi quattro campi gia compilati', async () => {
    rendiForm({
      initialValues: mapClientToFormValues({
        name: 'Trattoria Da Beppe',
        pecEmail: 'beppe@pec.it',
        sdiCode: 'ABC1234',
        website: 'www.dabeppe.it',
        contactPerson: 'Giuseppe Rossi',
      }),
    });
    await waitFor(() => expect(listCustomFields).toHaveBeenCalled());

    expect(screen.getByLabelText('PEC')).toHaveValue('beppe@pec.it');
    expect(screen.getByLabelText('Codice destinatario SDI')).toHaveValue('ABC1234');
    expect(screen.getByLabelText('Sito web')).toHaveValue('www.dabeppe.it');
    expect(screen.getByLabelText('Referente')).toHaveValue('Giuseppe Rossi');
  });

  it('una PEC malformata ferma il salvataggio e lo dice sul campo giusto', async () => {
    const onSubmit = vi.fn();
    rendiForm({ onSubmit });
    await waitFor(() => expect(listCustomFields).toHaveBeenCalled());

    fireEvent.change(campoNome(), { target: { value: 'Trattoria Da Beppe' } });
    fireEvent.change(screen.getByLabelText('PEC'), { target: { value: 'non-una-pec' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crea cliente' }));

    expect(await screen.findByText('Inserisci un indirizzo PEC valido.')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('senza PEC ne codice SDI avvisa che non si potra fatturare', async () => {
    rendiForm();
    await waitFor(() => expect(listCustomFields).toHaveBeenCalled());

    const avviso = 'Per la fatturazione elettronica serve almeno uno fra PEC e codice destinatario SDI.';
    expect(screen.getByText(avviso)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Codice destinatario SDI'), { target: { value: 'ABC1234' } });
    expect(screen.queryByText(avviso)).not.toBeInTheDocument();
  });
});
