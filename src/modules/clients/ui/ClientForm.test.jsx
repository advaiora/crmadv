import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ClientForm from './ClientForm';

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

// Il form non collega tutte le etichette ai campi: il nome si trova risalendo
// dalla sua etichetta al gruppo che lo contiene.
const campoNome = () => screen.getByText('Nome e cognome').parentElement.querySelector('input');

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
