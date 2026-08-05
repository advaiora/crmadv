import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ApiError } from '../../../modules/projects/api/projects.api';
import TemplatesListCard from './TemplatesListCard';
import TemplatesItemsList from './TemplatesItemsList';
import TemplatesNewItemForm from './TemplatesNewItemForm';

const memo = (overrides = {}) => ({
  id: 't1',
  name: 'Onboarding',
  description: 'Primi passi',
  isArchived: false,
  itemsCount: 3,
  ...overrides,
});

const propsLista = (overrides = {}) => ({
  templateSearch: '',
  onSearchChange: vi.fn(),
  showArchivedTemplates: false,
  onToggleArchived: vi.fn(),
  loading: false,
  error: null,
  visibleTemplates: [memo()],
  selectedTemplateId: 't1',
  onSelectTemplate: vi.fn(),
  canCreateTemplate: true,
  newTemplateName: '',
  onNewTemplateNameChange: vi.fn(),
  newTemplateDescription: '',
  onNewTemplateDescriptionChange: vi.fn(),
  onCreateTemplate: vi.fn((event) => event.preventDefault()),
  creating: false,
  ...overrides,
});

describe('TemplatesListCard', () => {
  it('elenca i memo col conteggio degli step', () => {
    render(<TemplatesListCard {...propsLista()} />);

    expect(screen.getByText('Onboarding')).toBeInTheDocument();
    expect(screen.getByText('3 step')).toBeInTheDocument();
    expect(screen.getByText('Primi passi')).toBeInTheDocument();
  });

  it('un memo senza descrizione lo dichiara invece di lasciare il vuoto', () => {
    render(<TemplatesListCard {...propsLista({ visibleTemplates: [memo({ description: null })] })} />);

    expect(screen.getByText('Nessuna descrizione')).toBeInTheDocument();
  });

  it('mentre carica lo dice e non mostra l elenco vuoto', () => {
    render(<TemplatesListCard {...propsLista({ loading: true, visibleTemplates: [] })} />);

    expect(screen.getByText('Caricamento memo...')).toBeInTheDocument();
    expect(screen.queryByText(/Nessun memo trovato/)).not.toBeInTheDocument();
  });

  it('finito il caricamento, senza memo lo dice', () => {
    render(<TemplatesListCard {...propsLista({ visibleTemplates: [] })} />);

    expect(screen.getByText(/Nessun memo trovato con i filtri attuali/)).toBeInTheDocument();
  });

  it('un errore del server viene mostrato leggibile', () => {
    render(<TemplatesListCard {...propsLista({
      error: new ApiError('Elenco non disponibile', { code: 'SERVER_ERROR' }),
    })} />);

    expect(screen.getByText('Elenco non disponibile (SERVER_ERROR)')).toBeInTheDocument();
  });

  it('la didascalia dice se gli archiviati sono inclusi', () => {
    const { rerender } = render(<TemplatesListCard {...propsLista()} />);
    expect(screen.getByText('Solo attivi')).toBeInTheDocument();

    rerender(<TemplatesListCard {...propsLista({ showArchivedTemplates: true })} />);
    expect(screen.getByText('Archiviati inclusi')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Nascondi archiviati/ })).toBeInTheDocument();
  });

  it('inoltra ricerca, filtro e scelta del memo', () => {
    const props = propsLista();
    render(<TemplatesListCard {...props} />);

    fireEvent.change(screen.getByPlaceholderText('Cerca memo...'), { target: { value: 'onb' } });
    screen.getByRole('button', { name: /Mostra archiviati/ }).click();
    screen.getByText('Onboarding').closest('button').click();

    expect(props.onSearchChange).toHaveBeenCalledWith('onb');
    expect(props.onToggleArchived).toHaveBeenCalledTimes(1);
    expect(props.onSelectTemplate).toHaveBeenCalledWith('t1');
  });

  // Il form di creazione compare solo a chi ha il permesso: senza, la colonna
  // resta di sola consultazione.
  it('senza permesso di creazione il form non c e', () => {
    render(<TemplatesListCard {...propsLista({ canCreateTemplate: false })} />);

    expect(screen.queryByPlaceholderText('Nome memo')).not.toBeInTheDocument();
  });

  it('mentre crea blocca i campi e il bottone', () => {
    render(<TemplatesListCard {...propsLista({ creating: true })} />);

    expect(screen.getByPlaceholderText('Nome memo')).toBeDisabled();
    expect(screen.getByRole('button', { name: /Crea memo/ })).toBeDisabled();
  });
});

const step = (overrides = {}) => ({
  id: 'i1',
  title: 'Primo step',
  description: 'Descrizione step',
  isRequired: true,
  requiresEvidenceSnapshot: false,
  isCriticalSnapshot: false,
  defaultAssignedToUserId: null,
  defaultAssignedToUserName: null,
  ...overrides,
});

const propsStep = (overrides = {}) => ({
  items: [step()],
  editingItem: null,
  onEditingItemChange: vi.fn(),
  assignableUsers: [{ userId: 'u1', name: 'Giulia' }],
  canManageTemplates: true,
  canDeleteTemplate: true,
  onSaveItem: vi.fn(),
  onDeleteItem: vi.fn(),
  onReorderItem: vi.fn(),
  savingItem: false,
  deletingItem: false,
  reordering: false,
  ...overrides,
});

describe('TemplatesItemsList', () => {
  it('senza step lo dice', () => {
    render(<TemplatesItemsList {...propsStep({ items: [] })} />);

    expect(screen.getByText('Nessuno step presente in questo memo.')).toBeInTheDocument();
  });

  it('mostra i contrassegni dello step', () => {
    render(<TemplatesItemsList {...propsStep({
      items: [step({ requiresEvidenceSnapshot: true, isCriticalSnapshot: true, defaultAssignedToUserName: 'Giulia' })],
    })} />);

    expect(screen.getByText('Obbligatorio')).toBeInTheDocument();
    expect(screen.getByText('Evidenza richiesta')).toBeInTheDocument();
    expect(screen.getByText('Critico')).toBeInTheDocument();
    expect(screen.getByText('Assegnatario default: Giulia')).toBeInTheDocument();
  });

  it('uno step non obbligatorio si dichiara facoltativo', () => {
    render(<TemplatesItemsList {...propsStep({ items: [step({ isRequired: false })] })} />);

    expect(screen.getByText('Facoltativo')).toBeInTheDocument();
  });

  it('senza permessi non compare nessun comando', () => {
    render(<TemplatesItemsList {...propsStep({ canManageTemplates: false, canDeleteTemplate: false })} />);

    expect(screen.queryByRole('button', { name: 'Sposta step su' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Modifica step' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Elimina step' })).not.toBeInTheDocument();
  });

  it('inoltra spostamenti ed eliminazione', () => {
    const props = propsStep();
    render(<TemplatesItemsList {...props} />);

    screen.getByRole('button', { name: 'Sposta step su' }).click();
    screen.getByRole('button', { name: 'Sposta step giu' }).click();
    screen.getByRole('button', { name: 'Elimina step' }).click();

    expect(props.onReorderItem).toHaveBeenNthCalledWith(1, 'i1', -1);
    expect(props.onReorderItem).toHaveBeenNthCalledWith(2, 'i1', 1);
    expect(props.onDeleteItem).toHaveBeenCalledWith('i1');
  });

  // "Modifica" non modifica niente: apre la riga in modifica copiandoci dentro
  // i valori dello step, normalizzati per i campi di testo.
  it('modifica apre la riga copiandoci i valori dello step', () => {
    const props = propsStep({ items: [step({ description: null, defaultAssignedToUserId: null })] });
    render(<TemplatesItemsList {...props} />);

    screen.getByRole('button', { name: 'Modifica step' }).click();

    expect(props.onEditingItemChange).toHaveBeenCalledWith({
      id: 'i1',
      title: 'Primo step',
      description: '',
      isRequired: true,
      requiresEvidenceSnapshot: false,
      isCriticalSnapshot: false,
      defaultAssignedToUserId: '',
    });
  });

  it('la riga in modifica mostra il form al posto della lettura', () => {
    render(<TemplatesItemsList {...propsStep({
      editingItem: { id: 'i1', title: 'Primo step', description: '', isRequired: true },
    })} />);

    expect(screen.getByRole('button', { name: /Salva/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Annulla' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Modifica step' })).not.toBeInTheDocument();
  });

  it('annulla chiude la modifica', () => {
    const props = propsStep({ editingItem: { id: 'i1', title: 'Primo step' } });
    render(<TemplatesItemsList {...props} />);

    screen.getByRole('button', { name: 'Annulla' }).click();

    expect(props.onEditingItemChange).toHaveBeenCalledWith(null);
  });

  it('il menu assegnatario elenca le persone assegnabili', () => {
    render(<TemplatesItemsList {...propsStep({
      editingItem: { id: 'i1', title: 'Primo step', defaultAssignedToUserId: 'u1' },
    })} />);

    expect(screen.getByRole('option', { name: 'Giulia' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Nessun assegnatario' })).toBeInTheDocument();
  });

  // Chi era assegnato ma non e' piu' assegnabile deve restare scelto, con il
  // nome che sta sullo step del server: `editingItem` quel nome non ce l'ha.
  it('un assegnatario non piu disponibile resta scelto col suo nome', () => {
    render(<TemplatesItemsList {...propsStep({
      items: [step({ defaultAssignedToUserId: 'u9', defaultAssignedToUserName: 'Marco (disattivato)' })],
      editingItem: { id: 'i1', title: 'Primo step', defaultAssignedToUserId: 'u9' },
    })} />);

    expect(screen.getByRole('option', { name: 'Marco (disattivato)' })).toBeInTheDocument();
  });

  it('senza nome sullo step la voce di riserva lo dichiara comunque', () => {
    render(<TemplatesItemsList {...propsStep({
      items: [step({ defaultAssignedToUserId: 'u9', defaultAssignedToUserName: null })],
      editingItem: { id: 'i1', title: 'Primo step', defaultAssignedToUserId: 'u9' },
    })} />);

    expect(screen.getByRole('option', { name: 'Utente disattivato' })).toBeInTheDocument();
  });

  // Gli stati di caricamento sono uno per tipo di azione, non uno per riga:
  // mentre una si sposta, si spengono i comandi di tutte.
  it('mentre un riordino e in corso i comandi si spengono su tutte le righe', () => {
    render(<TemplatesItemsList {...propsStep({
      items: [step(), step({ id: 'i2', title: 'Secondo step' })],
      reordering: true,
    })} />);

    screen.getAllByRole('button', { name: 'Sposta step su' }).forEach((bottone) => {
      expect(bottone).toBeDisabled();
    });
  });
});

const propsNuovoStep = (overrides = {}) => ({
  title: '',
  onTitleChange: vi.fn(),
  description: '',
  onDescriptionChange: vi.fn(),
  required: true,
  onRequiredChange: vi.fn(),
  requiresEvidence: false,
  onRequiresEvidenceChange: vi.fn(),
  critical: false,
  onCriticalChange: vi.fn(),
  defaultAssignedToUserId: '',
  onDefaultAssignedToUserIdChange: vi.fn(),
  assignableUsers: [{ userId: 'u1', name: 'Giulia' }],
  onSubmit: vi.fn((event) => event.preventDefault()),
  creating: false,
  ...overrides,
});

describe('TemplatesNewItemForm', () => {
  it('parte con lo step obbligatorio acceso', () => {
    render(<TemplatesNewItemForm {...propsNuovoStep()} />);

    expect(screen.getByLabelText('Step obbligatorio')).toBeChecked();
    expect(screen.getByLabelText('Richiede evidenza (nota/link)')).not.toBeChecked();
    expect(screen.getByLabelText('Step critico')).not.toBeChecked();
  });

  it('inoltra titolo e contrassegni', () => {
    const props = propsNuovoStep();
    render(<TemplatesNewItemForm {...props} />);

    fireEvent.change(screen.getByPlaceholderText('Titolo step'), { target: { value: 'Nuovo' } });
    screen.getByLabelText('Step critico').click();
    screen.getByLabelText('Step obbligatorio').click();

    expect(props.onTitleChange).toHaveBeenCalledWith('Nuovo');
    expect(props.onCriticalChange).toHaveBeenCalledWith(true);
    expect(props.onRequiredChange).toHaveBeenCalledWith(false);
  });

  it('inoltra la scelta dell assegnatario', () => {
    const props = propsNuovoStep();
    render(<TemplatesNewItemForm {...props} />);

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'u1' } });

    expect(props.onDefaultAssignedToUserIdChange).toHaveBeenCalledWith('u1');
  });

  it('mentre aggiunge blocca tutto il form', () => {
    render(<TemplatesNewItemForm {...propsNuovoStep({ creating: true })} />);

    expect(screen.getByPlaceholderText('Titolo step')).toBeDisabled();
    expect(screen.getByLabelText('Step obbligatorio')).toBeDisabled();
    expect(screen.getByRole('combobox')).toBeDisabled();
    expect(screen.getByRole('button', { name: /Aggiungi step/ })).toBeDisabled();
  });
});
