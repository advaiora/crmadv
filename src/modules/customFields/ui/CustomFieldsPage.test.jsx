import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import CustomFieldsPage from './CustomFieldsPage';

const listCustomFields = vi.fn();
const createCustomField = vi.fn();
const updateCustomField = vi.fn();
const deleteCustomField = vi.fn();
const reorderCustomFields = vi.fn();

vi.mock('../api/customFieldsApi', () => ({
  listCustomFields: (...args) => listCustomFields(...args),
  createCustomField: (...args) => createCustomField(...args),
  updateCustomField: (...args) => updateCustomField(...args),
  deleteCustomField: (...args) => deleteCustomField(...args),
  reorderCustomFields: (...args) => reorderCustomFields(...args),
}));

const settore = {
  id: 'cf1',
  key: 'settore',
  label: 'Settore merceologico',
  type: 'select',
  required: true,
  active: true,
  options: [{ value: 'ristorazione', label: 'Ristorazione' }],
};

describe('CustomFieldsPage', () => {
  beforeEach(() => {
    listCustomFields.mockReset().mockResolvedValue({ definitions: [settore] });
    createCustomField.mockReset().mockResolvedValue({ definition: { id: 'cf2' } });
    updateCustomField.mockReset().mockResolvedValue({ definition: settore });
    deleteCustomField.mockReset().mockResolvedValue({});
    reorderCustomFields.mockReset().mockResolvedValue({});
  });

  it('elenca i campi con etichetta, chiave e tipo in italiano', async () => {
    render(<CustomFieldsPage />);

    expect(await screen.findByText('Settore merceologico')).toBeInTheDocument();
    expect(screen.getByText('settore')).toBeInTheDocument();
    expect(screen.getByText('Elenco a tendina')).toBeInTheDocument();
    expect(screen.getAllByText('Obbligatorio').length).toBeGreaterThan(1); // intestazione + badge
    expect(screen.getByText('Attivo')).toBeInTheDocument();
  });

  it('quando non c\'e\' niente lo dice invece di mostrare una tabella vuota', async () => {
    listCustomFields.mockResolvedValue({ definitions: [] });
    render(<CustomFieldsPage />);
    expect(await screen.findByText(/Nessun campo personalizzato/)).toBeInTheDocument();
  });

  it('«Nuovo campo» apre la modale in creazione', async () => {
    render(<CustomFieldsPage />);
    fireEvent.click(await screen.findByRole('button', { name: /Nuovo campo/ }));

    expect(await screen.findByText('Nuovo campo personalizzato')).toBeInTheDocument();
    expect(screen.getByLabelText('Etichetta')).toHaveValue('');
  });

  it('la matita apre la modale gia\' riempita, e il salvataggio ricarica l\'elenco', async () => {
    render(<CustomFieldsPage />);
    await screen.findByText('Settore merceologico');
    const [modifica] = screen.getAllByRole('button').filter((button) => button.className.includes('btn-outline-secondary') && button.querySelector('svg'));

    // La matita e' il primo pulsante di modifica della riga (dopo le frecce di ordine).
    fireEvent.click(screen.getAllByRole('row')[1].querySelectorAll('button')[2]);
    expect(await screen.findByText('Modifica campo')).toBeInTheDocument();
    expect(screen.getByLabelText('Etichetta')).toHaveValue('Settore merceologico');
    expect(screen.getByLabelText('Opzioni (una per riga; «valore | etichetta»)')).toHaveValue('ristorazione | Ristorazione');
    expect(modifica).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Salva' }));
    await waitFor(() => expect(updateCustomField).toHaveBeenCalledWith('cf1', expect.objectContaining({ label: 'Settore merceologico' })));
    await waitFor(() => expect(listCustomFields).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByText('Modifica campo')).not.toBeInTheDocument());
  });

  it('l\'eliminazione chiede conferma e poi ricarica', async () => {
    render(<CustomFieldsPage />);
    await screen.findByText('Settore merceologico');
    fireEvent.click(screen.getAllByRole('row')[1].querySelectorAll('button')[3]);

    expect(await screen.findByText('Elimina campo')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Elimina' }));

    await waitFor(() => expect(deleteCustomField).toHaveBeenCalledWith('cf1'));
    await waitFor(() => expect(listCustomFields).toHaveBeenCalledTimes(2));
  });

  it('se l\'elenco non arriva lo dice invece di restare vuota', async () => {
    listCustomFields.mockRejectedValue(new Error('Sessione non disponibile.'));
    render(<CustomFieldsPage />);
    expect(await screen.findByText('Sessione non disponibile.')).toBeInTheDocument();
  });
});
