import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import CustomFieldDraftModal from './CustomFieldDraftModal';

const createCustomField = vi.fn();
const updateCustomField = vi.fn();

vi.mock('../api/customFieldsApi', () => ({
  createCustomField: (...args) => createCustomField(...args),
  updateCustomField: (...args) => updateCustomField(...args),
}));

const scriviEtichetta = (testo) => {
  fireEvent.change(screen.getByLabelText('Etichetta'), { target: { value: testo } });
};

const salva = () => fireEvent.click(screen.getByRole('button', { name: 'Salva' }));

describe('CustomFieldDraftModal', () => {
  beforeEach(() => {
    createCustomField.mockReset().mockResolvedValue({ definition: { id: 'f9', key: 'settore' } });
    updateCustomField.mockReset().mockResolvedValue({ definition: { id: 'f1', key: 'settore' } });
  });

  it('non mostra niente quando e\' chiusa', () => {
    render(<CustomFieldDraftModal show={false} onHide={vi.fn()} onSaved={vi.fn()} />);
    expect(screen.queryByText('Nuovo campo personalizzato')).not.toBeInTheDocument();
  });

  it('propone tutti e sei i tipi di campo', () => {
    render(<CustomFieldDraftModal show onHide={vi.fn()} onSaved={vi.fn()} />);
    const opzioni = Array.from(screen.getByLabelText('Tipo').options).map((option) => option.textContent);
    expect(opzioni).toEqual(['Testo breve', 'Testo lungo', 'Numero', 'Data', 'Sì / No', 'Elenco a tendina']);
  });

  it('mostra l\'anteprima della chiave tecnica mentre si scrive l\'etichetta', () => {
    render(<CustomFieldDraftModal show onHide={vi.fn()} onSaved={vi.fn()} />);
    scriviEtichetta('Settore merceologico');
    expect(screen.getByText('settore_merceologico')).toBeInTheDocument();
  });

  it('senza etichetta non chiama l\'API e spiega perche\'', async () => {
    render(<CustomFieldDraftModal show onHide={vi.fn()} onSaved={vi.fn()} />);
    salva();
    expect(await screen.findByText('Etichetta obbligatoria')).toBeInTheDocument();
    expect(createCustomField).not.toHaveBeenCalled();
  });

  it('un elenco a tendina senza opzioni non parte', async () => {
    render(<CustomFieldDraftModal show onHide={vi.fn()} onSaved={vi.fn()} />);
    scriviEtichetta('Fonte del contatto');
    fireEvent.change(screen.getByLabelText('Tipo'), { target: { value: 'select' } });
    salva();
    expect(await screen.findByText(/almeno un'opzione/)).toBeInTheDocument();
    expect(createCustomField).not.toHaveBeenCalled();
  });

  it('crea il campo e avvisa chi l\'ha aperta', async () => {
    const onSaved = vi.fn();
    render(<CustomFieldDraftModal show onHide={vi.fn()} onSaved={onSaved} />);
    scriviEtichetta('Settore merceologico');
    fireEvent.click(screen.getByLabelText('Campo obbligatorio'));
    salva();

    await waitFor(() => expect(createCustomField).toHaveBeenCalledTimes(1));
    expect(createCustomField).toHaveBeenCalledWith({
      label: 'Settore merceologico',
      type: 'text',
      required: true,
      active: true,
    });
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith({ id: 'f9', key: 'settore' }, { isEditing: false }));
  });

  it('in modifica riempie la bozza e non rimanda la chiave', async () => {
    const onSaved = vi.fn();
    render(
      <CustomFieldDraftModal
        show
        field={{ id: 'f1', label: 'Settore', key: 'settore', type: 'text', required: false, active: true }}
        onHide={vi.fn()}
        onSaved={onSaved}
      />,
    );

    expect(screen.getByText('Modifica campo')).toBeInTheDocument();
    expect(screen.getByLabelText('Etichetta')).toHaveValue('Settore');
    scriviEtichetta('Settore merceologico');
    salva();

    await waitFor(() => expect(updateCustomField).toHaveBeenCalledTimes(1));
    const [id, payload] = updateCustomField.mock.calls[0];
    expect(id).toBe('f1');
    expect(payload).not.toHaveProperty('key');
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(expect.anything(), { isEditing: true }));
  });

  it('mostra l\'errore del server senza chiudere la modale', async () => {
    createCustomField.mockRejectedValue(new Error('Chiave già in uso'));
    const onSaved = vi.fn();
    render(<CustomFieldDraftModal show onHide={vi.fn()} onSaved={onSaved} />);
    scriviEtichetta('Settore');
    salva();

    expect(await screen.findByText('Chiave già in uso')).toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();
  });
});
