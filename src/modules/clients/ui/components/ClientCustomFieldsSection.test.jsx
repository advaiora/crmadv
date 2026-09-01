import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ClientCustomFieldsSection from './ClientCustomFieldsSection';
import { customFieldErrorKey } from '../clientCustomFields';

const createCustomField = vi.fn();

vi.mock('../../../customFields/api/customFieldsApi', () => ({
  createCustomField: (...args) => createCustomField(...args),
  updateCustomField: vi.fn(),
}));

const definizioni = [
  { id: '1', key: 'settore', label: 'Settore merceologico', type: 'text', required: true },
  { id: '2', key: 'note_interne', label: 'Note interne', type: 'textarea' },
  { id: '3', key: 'dipendenti', label: 'Dipendenti', type: 'number' },
  { id: '4', key: 'primo_contatto', label: 'Primo contatto', type: 'date' },
  { id: '5', key: 'fatturazione', label: 'Fattura elettronica', type: 'boolean' },
  {
    id: '6',
    key: 'fonte',
    label: 'Fonte del contatto',
    type: 'select',
    options: [{ value: 'passaparola', label: 'Passaparola' }],
  },
];

const ingresso = () => screen.queryByRole('button', { name: /Aggiungi campo personalizzato/ });

describe('ClientCustomFieldsSection', () => {
  beforeEach(() => {
    createCustomField.mockReset().mockResolvedValue({ definition: { id: '9', key: 'settore' } });
  });

  it('non disegna niente se non ci sono campi e non si possono creare', () => {
    const { container } = render(
      <ClientCustomFieldsSection definitions={[]} onChange={vi.fn()} canCreate={false} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('mostra l\'ingresso anche quando non esiste ancora nessun campo', () => {
    render(<ClientCustomFieldsSection definitions={[]} onChange={vi.fn()} canCreate />);
    expect(screen.getByText('Sezione 7 - Campi personalizzati')).toBeInTheDocument();
    expect(screen.getByText(/Nessun campo personalizzato/)).toBeInTheDocument();
    expect(ingresso()).toBeInTheDocument();
  });

  it('senza il permesso di modifica l\'ingresso non compare', () => {
    render(<ClientCustomFieldsSection definitions={definizioni} onChange={vi.fn()} canCreate={false} />);
    expect(screen.getByLabelText(/Settore merceologico/)).toBeInTheDocument();
    expect(ingresso()).not.toBeInTheDocument();
  });

  it('disegna tutti e sei i tipi di campo', () => {
    render(
      <ClientCustomFieldsSection
        definitions={definizioni}
        values={{ fatturazione: true }}
        onChange={vi.fn()}
        canCreate
      />,
    );

    expect(screen.getByLabelText(/Settore merceologico/).tagName).toBe('INPUT');
    expect(screen.getByLabelText('Note interne').tagName).toBe('TEXTAREA');
    expect(screen.getByLabelText('Dipendenti')).toHaveAttribute('type', 'number');
    expect(screen.getByLabelText('Primo contatto')).toHaveAttribute('type', 'date');
    expect(screen.getByLabelText('Sì')).toHaveAttribute('type', 'checkbox');
    expect(screen.getByRole('option', { name: 'Passaparola' })).toBeInTheDocument();
  });

  it('segna con l\'asterisco gli obbligatori e mostra il loro errore', () => {
    render(
      <ClientCustomFieldsSection
        definitions={definizioni}
        errors={{ [customFieldErrorKey('settore')]: 'Questo campo è obbligatorio.' }}
        onChange={vi.fn()}
        canCreate
      />,
    );
    expect(screen.getByText('*')).toBeInTheDocument();
    expect(screen.getByText('Questo campo è obbligatorio.')).toBeInTheDocument();
  });

  it('riporta a chi lo ospita il valore digitato', () => {
    const onChange = vi.fn();
    render(<ClientCustomFieldsSection definitions={definizioni} onChange={onChange} canCreate />);
    fireEvent.change(screen.getByLabelText(/Settore merceologico/), { target: { value: 'Ristorazione' } });
    expect(onChange).toHaveBeenCalledWith('settore', 'Ristorazione');
  });

  it('crea un campo dalla modale e avvisa chi lo ospita, senza toccare i valori in corso', async () => {
    const onFieldCreated = vi.fn().mockResolvedValue(undefined);
    render(
      <ClientCustomFieldsSection
        definitions={[]}
        values={{}}
        onChange={vi.fn()}
        canCreate
        onFieldCreated={onFieldCreated}
      />,
    );

    fireEvent.click(ingresso());
    expect(await screen.findByText('Nuovo campo personalizzato')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Etichetta'), { target: { value: 'Settore merceologico' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salva' }));

    await waitFor(() => expect(createCustomField).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(onFieldCreated).toHaveBeenCalledTimes(1));
  });

  it('mentre il form salva, l\'ingresso e\' spento', () => {
    render(<ClientCustomFieldsSection definitions={[]} onChange={vi.fn()} canCreate disabled />);
    expect(ingresso()).toBeDisabled();
  });
});
