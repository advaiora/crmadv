import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useChecklistTemplatesPage } from './templates/hooks/useChecklistTemplatesPage';
import { ChecklistTemplatesContent } from './ChecklistTemplates';

// Come nelle pagine sorelle: la pagina assembla l'hook radice e i due riquadri,
// e qui si verifica proprio l'assemblaggio. Si finge l'hook, gia' coperto dal
// suo test.
vi.mock('./templates/hooks/useChecklistTemplatesPage', () => ({
  useChecklistTemplatesPage: vi.fn(),
}));

const memo = (overrides = {}) => ({
  id: 't1',
  name: 'Onboarding',
  description: 'Primi passi',
  isArchived: false,
  itemsCount: 2,
  ...overrides,
});

const dettaglio = (overrides = {}) => ({
  ...memo(),
  items: [
    { id: 'i1', title: 'Primo step', description: '', isRequired: true, requiresEvidenceSnapshot: false, isCriticalSnapshot: false },
  ],
  ...overrides,
});

const statoHook = (overrides = {}) => ({
  canManageTemplates: true,
  canCreateTemplate: true,
  canDeleteTemplate: true,
  templatesQuery: { data: [memo()], loading: false, error: null, refetch: vi.fn() },
  assignableUsersQuery: { data: [], loading: false, error: null, refetch: vi.fn() },
  selectedTemplateQuery: { data: dettaglio(), loading: false, error: null, refetch: vi.fn() },
  selectedTemplateId: 't1',
  setSelectedTemplateId: vi.fn(),
  templateSearch: '',
  setTemplateSearch: vi.fn(),
  showArchivedTemplates: false,
  setShowArchivedTemplates: vi.fn(),
  templates: [memo()],
  assignableUsers: [{ userId: 'u1', name: 'Giulia' }],
  visibleTemplates: [memo()],
  totalVisibleItems: 2,
  createTemplateMutation: { loading: false },
  updateTemplateMutation: { loading: false },
  archiveTemplateMutation: { loading: false },
  deleteTemplatePermanentlyMutation: { loading: false },
  newTemplateName: '',
  setNewTemplateName: vi.fn(),
  newTemplateDescription: '',
  setNewTemplateDescription: vi.fn(),
  editingTemplateName: 'Onboarding',
  setEditingTemplateName: vi.fn(),
  editingTemplateDescription: 'Primi passi',
  setEditingTemplateDescription: vi.fn(),
  handleCreateTemplate: vi.fn((event) => event.preventDefault()),
  handleUpdateTemplate: vi.fn(),
  handleArchiveTemplate: vi.fn(),
  handleDeleteTemplatePermanently: vi.fn(),
  createItemMutation: { loading: false },
  updateItemMutation: { loading: false },
  deleteItemMutation: { loading: false },
  reorderItemsMutation: { loading: false },
  newItemTitle: '',
  setNewItemTitle: vi.fn(),
  newItemDescription: '',
  setNewItemDescription: vi.fn(),
  newItemRequired: true,
  setNewItemRequired: vi.fn(),
  newItemRequiresEvidence: false,
  setNewItemRequiresEvidence: vi.fn(),
  newItemCritical: false,
  setNewItemCritical: vi.fn(),
  newItemDefaultAssignedToUserId: '',
  setNewItemDefaultAssignedToUserId: vi.fn(),
  editingItem: null,
  setEditingItem: vi.fn(),
  handleCreateItem: vi.fn((event) => event.preventDefault()),
  handleSaveItem: vi.fn(),
  handleDeleteItem: vi.fn(),
  handleReorderItem: vi.fn(),
  ...overrides,
});

const montaPagina = () => render(
  <MemoryRouter>
    <ChecklistTemplatesContent access={{ permissions: ['checklists.manage_templates'] }} />
  </MemoryRouter>,
);

// "1 memo" compare due volte: nel riquadro dei conteggi in cima e nella
// didascalia della lista. Qui interessa quello in cima, quindi si legge da li'.
const conteggiInCima = (container) => (
  [...container.querySelectorAll('.checklists-stat-chip')].map((chip) => chip.textContent)
);

beforeEach(() => {
  vi.clearAllMocks();
  useChecklistTemplatesPage.mockReturnValue(statoHook());
});

describe('ChecklistTemplatesContent', () => {
  it('mostra intestazione, conteggi e le due colonne', () => {
    const { container } = montaPagina();

    expect(screen.getByRole('heading', { name: /Memo Operativi/ })).toBeInTheDocument();
    expect(conteggiInCima(container)).toEqual(['1 memo', '2 step totali']);
    expect(screen.getByRole('heading', { name: 'Memo' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Dettaglio Memo' })).toBeInTheDocument();
  });

  // I conteggi in cima leggono i DERIVATI, non l'elenco grezzo: se si
  // scollegassero mostrerebbero i memo archiviati anche a filtro spento.
  it('i conteggi in cima seguono l elenco filtrato', () => {
    useChecklistTemplatesPage.mockReturnValue(statoHook({
      templates: [memo(), memo({ id: 't2' }), memo({ id: 't3' })],
      visibleTemplates: [memo(), memo({ id: 't2' })],
      totalVisibleItems: 7,
    }));
    const { container } = montaPagina();

    // Tre memo in tutto, due visibili: in cima si leggono i due, non i tre.
    expect(conteggiInCima(container)).toEqual(['2 memo', '7 step totali']);
  });

  // I collegamenti che seguono fallirebbero in silenzio se un nome cambiasse:
  // la pagina si disegnerebbe lo stesso, solo senza fare piu' niente.
  it('ricerca e filtro archiviati sono collegati', () => {
    const stato = statoHook();
    useChecklistTemplatesPage.mockReturnValue(stato);
    montaPagina();

    fireEvent.change(screen.getByPlaceholderText('Cerca memo...'), { target: { value: 'onb' } });
    screen.getByRole('button', { name: /Mostra archiviati/ }).click();

    expect(stato.setTemplateSearch).toHaveBeenCalledWith('onb');
    expect(stato.setShowArchivedTemplates).toHaveBeenCalledTimes(1);
  });

  it('scegliere un memo dalla lista e collegato', () => {
    const stato = statoHook();
    useChecklistTemplatesPage.mockReturnValue(stato);
    montaPagina();

    screen.getByText('Onboarding').closest('button').click();

    expect(stato.setSelectedTemplateId).toHaveBeenCalledWith('t1');
  });

  it('creazione memo, salvataggio memo e archiviazione sono collegati', () => {
    const stato = statoHook();
    useChecklistTemplatesPage.mockReturnValue(stato);
    montaPagina();

    fireEvent.submit(screen.getByRole('button', { name: /Crea memo/ }).closest('form'));
    screen.getByRole('button', { name: /Salva memo/ }).click();
    screen.getByRole('button', { name: /Archivia/ }).click();

    expect(stato.handleCreateTemplate).toHaveBeenCalledTimes(1);
    expect(stato.handleUpdateTemplate).toHaveBeenCalledTimes(1);
    expect(stato.handleArchiveTemplate).toHaveBeenCalledTimes(1);
  });

  // Su un memo archiviato il comando cambia: non piu' "Archivia" ma
  // "Elimina definitivamente".
  it('su un memo archiviato compare l eliminazione definitiva al posto dell archiviazione', () => {
    const stato = statoHook({
      selectedTemplateQuery: { data: dettaglio({ isArchived: true }), loading: false, error: null, refetch: vi.fn() },
    });
    useChecklistTemplatesPage.mockReturnValue(stato);
    montaPagina();

    expect(screen.queryByRole('button', { name: /^Archivia/ })).not.toBeInTheDocument();
    screen.getByRole('button', { name: /Elimina definitivamente/ }).click();

    expect(stato.handleDeleteTemplatePermanently).toHaveBeenCalledTimes(1);
  });

  it('le azioni sugli step arrivano all elenco', () => {
    const stato = statoHook();
    useChecklistTemplatesPage.mockReturnValue(stato);
    montaPagina();

    screen.getByRole('button', { name: 'Sposta step giu' }).click();
    screen.getByRole('button', { name: 'Elimina step' }).click();
    fireEvent.submit(screen.getByRole('button', { name: /Aggiungi step/ }).closest('form'));

    expect(stato.handleReorderItem).toHaveBeenCalledWith('i1', 1);
    expect(stato.handleDeleteItem).toHaveBeenCalledWith('i1');
    expect(stato.handleCreateItem).toHaveBeenCalledTimes(1);
  });

  it('le persone assegnabili arrivano al form del nuovo step', () => {
    montaPagina();

    expect(screen.getByRole('option', { name: 'Giulia' })).toBeInTheDocument();
  });

  it('senza memo scelto invita a sceglierne uno', () => {
    useChecklistTemplatesPage.mockReturnValue(statoHook({
      selectedTemplateId: '',
      selectedTemplateQuery: { data: null, loading: false, error: null, refetch: vi.fn() },
    }));
    montaPagina();

    expect(screen.getByText(/Seleziona un memo per visualizzare/)).toBeInTheDocument();
  });

  it('in sola lettura spariscono i form e i comandi di modifica', () => {
    useChecklistTemplatesPage.mockReturnValue(statoHook({
      canManageTemplates: false,
      canCreateTemplate: false,
      canDeleteTemplate: false,
    }));
    montaPagina();

    expect(screen.queryByRole('button', { name: /Crea memo/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Salva memo/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Aggiungi step/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Modifica step' })).not.toBeInTheDocument();
    // Il campo del nome NON sparisce: resta in pagina, spento. E' il
    // comportamento dell'originale — il memo si legge, non si tocca.
    expect(screen.getByPlaceholderText('Nome memo')).toBeDisabled();
    expect(screen.getByText('Primo step')).toBeInTheDocument();
  });
});
