import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import {
  archiveChecklistTemplate,
  createChecklistTemplate,
  createChecklistTemplateItem,
  deleteChecklistTemplateItem,
  deleteChecklistTemplatePermanently,
  getChecklistTemplate,
  listChecklistAssignableUsers,
  listChecklistTemplates,
  reorderChecklistTemplateItems,
  updateChecklistTemplate,
  updateChecklistTemplateItem,
} from '../../../../modules/checklists/api/checklists.api';
import { useChecklistTemplatesPage } from './useChecklistTemplatesPage';

// Si finge il confine col server (le chiamate grezze), NON gli hook di query:
// useChecklistQuery e useMutationAction girano davvero — sono gia' coperti dai
// loro test — cosi' qui si vede l'effetto vero che le azioni fanno sullo stato.
vi.mock('../../../../modules/checklists/api/checklists.api', () => ({
  isApiError: (error) => error?.name === 'ApiError',
  listChecklistTemplates: vi.fn(),
  getChecklistTemplate: vi.fn(),
  createChecklistTemplate: vi.fn(),
  updateChecklistTemplate: vi.fn(),
  archiveChecklistTemplate: vi.fn(),
  deleteChecklistTemplatePermanently: vi.fn(),
  createChecklistTemplateItem: vi.fn(),
  updateChecklistTemplateItem: vi.fn(),
  deleteChecklistTemplateItem: vi.fn(),
  reorderChecklistTemplateItems: vi.fn(),
  listChecklistAssignableUsers: vi.fn(),
  listProjectChecklistInstances: vi.fn(),
  createProjectChecklistInstance: vi.fn(),
  ensureProjectStageChecklistInstances: vi.fn(),
  completeChecklistInstanceItem: vi.fn(),
  listStageChecklistRules: vi.fn(),
  replaceStageChecklistRules: vi.fn(),
  updateChecklistItemState: vi.fn(),
  markChecklistItemNotApplicable: vi.fn(),
  resetChecklistItem: vi.fn(),
  assignChecklistItem: vi.fn(),
}));

vi.mock('react-toastify', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

const accessCompleto = { permissions: ['checklists.manage_templates'] };
const accessSolaLettura = { permissions: ['checklists.view'] };

const memo = (overrides = {}) => ({
  id: 't1',
  name: 'Onboarding',
  description: 'Primi passi',
  isArchived: false,
  itemsCount: 2,
  ...overrides,
});

const memoConStep = (overrides = {}) => ({
  ...memo(),
  items: [
    { id: 'i1', title: 'Primo step', isRequired: true },
    { id: 'i2', title: 'Secondo step', isRequired: false },
  ],
  ...overrides,
});

// Le azioni chiamano `refetch()` al loro interno, e quella promessa la scioglie
// un effetto: awaitarla dentro un act e' l'abbraccio mortale della nota #41.
// Si lancia l'azione senza aspettarla e si attende l'ESITO con waitFor.
const lancia = (azione) => {
  act(() => { void azione(); });
};

const evento = () => ({ preventDefault: vi.fn() });

const montaHook = async (access = accessCompleto) => {
  const risultato = renderHook(() => useChecklistTemplatesPage(access));
  await waitFor(() => expect(risultato.result.current.templatesQuery.loading).toBe(false));
  return risultato;
};

beforeEach(() => {
  vi.clearAllMocks();
  listChecklistTemplates.mockResolvedValue([memo()]);
  getChecklistTemplate.mockResolvedValue(memoConStep());
  listChecklistAssignableUsers.mockResolvedValue([{ id: 'u1', name: 'Giulia' }]);
  createChecklistTemplate.mockResolvedValue(memo({ id: 't9', name: 'Nuovo memo' }));
  updateChecklistTemplate.mockResolvedValue(memo());
  archiveChecklistTemplate.mockResolvedValue(memo({ isArchived: true }));
  deleteChecklistTemplatePermanently.mockResolvedValue({});
  createChecklistTemplateItem.mockResolvedValue({});
  updateChecklistTemplateItem.mockResolvedValue({});
  deleteChecklistTemplateItem.mockResolvedValue({});
  reorderChecklistTemplateItems.mockResolvedValue({});
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('permessi', () => {
  it('con il permesso di gestione si puo fare tutto', async () => {
    const { result } = await montaHook();

    expect(result.current.canManageTemplates).toBe(true);
    expect(result.current.canCreateTemplate).toBe(true);
    expect(result.current.canDeleteTemplate).toBe(true);
  });

  it('con la sola lettura non si gestisce niente', async () => {
    const { result } = await montaHook(accessSolaLettura);

    expect(result.current.canManageTemplates).toBe(false);
    expect(result.current.canCreateTemplate).toBe(false);
    expect(result.current.canDeleteTemplate).toBe(false);
  });

  // L'elenco delle persone assegnabili serve solo a chi puo' modificare gli
  // step: a chi guarda e basta non si chiede al server.
  it('in sola lettura non chiede le persone assegnabili', async () => {
    await montaHook(accessSolaLettura);

    expect(listChecklistAssignableUsers).not.toHaveBeenCalled();
  });
});

describe('caricamento e selezione', () => {
  it('carica i memo e apre il primo da solo', async () => {
    const { result } = await montaHook();

    await waitFor(() => expect(result.current.selectedTemplateId).toBe('t1'));
    expect(result.current.templates).toHaveLength(1);
    expect(result.current.totalVisibleItems).toBe(2);
  });

  it('gli archiviati restano fuori finche non si accende il filtro', async () => {
    listChecklistTemplates.mockResolvedValue([memo(), memo({ id: 't2', name: 'Chiusura', isArchived: true })]);
    const { result } = await montaHook();

    await waitFor(() => expect(result.current.visibleTemplates).toHaveLength(1));

    act(() => result.current.setShowArchivedTemplates(true));

    expect(result.current.visibleTemplates).toHaveLength(2);
  });

  it('la ricerca filtra l elenco visibile', async () => {
    listChecklistTemplates.mockResolvedValue([memo(), memo({ id: 't2', name: 'Chiusura progetto' })]);
    const { result } = await montaHook();
    await waitFor(() => expect(result.current.visibleTemplates).toHaveLength(2));

    act(() => result.current.setTemplateSearch('chiusura'));

    expect(result.current.visibleTemplates.map((t) => t.id)).toEqual(['t2']);
  });

  // Se il memo aperto sparisce dall'elenco visibile, la selezione si sposta sul
  // primo disponibile invece di restare appesa su un id che non c'e' piu'.
  it('se il memo aperto non e piu visibile si passa al primo', async () => {
    listChecklistTemplates.mockResolvedValue([memo(), memo({ id: 't2', name: 'Chiusura' })]);
    const { result } = await montaHook();
    await waitFor(() => expect(result.current.selectedTemplateId).toBe('t1'));

    act(() => result.current.setSelectedTemplateId('t2'));
    act(() => result.current.setTemplateSearch('onboarding'));

    await waitFor(() => expect(result.current.selectedTemplateId).toBe('t1'));
  });

  it('senza memo visibili la selezione si azzera', async () => {
    const { result } = await montaHook();
    await waitFor(() => expect(result.current.selectedTemplateId).toBe('t1'));

    act(() => result.current.setTemplateSearch('niente che esista'));

    await waitFor(() => expect(result.current.selectedTemplateId).toBe(''));
  });
});

describe('creazione di un memo', () => {
  it('senza nome non chiama il server', async () => {
    const { result } = await montaHook();

    lancia(() => result.current.handleCreateTemplate(evento()));

    expect(createChecklistTemplate).not.toHaveBeenCalled();
  });

  // Il finto server deve comportarsi da server: dopo la creazione la lista
  // ricaricata contiene il memo nuovo. Senza, l'effetto che tiene stabile la
  // selezione lo vedrebbe sparito e riporterebbe l'apertura sul primo memo —
  // ed e' esattamente quello che succederebbe anche in produzione.
  it('crea il memo, svuota il form e lo apre', async () => {
    const { result } = await montaHook();
    listChecklistTemplates.mockResolvedValue([memo(), memo({ id: 't9', name: 'Nuovo memo' })]);
    act(() => result.current.setNewTemplateName('  Nuovo memo  '));
    act(() => result.current.setNewTemplateDescription('Descrizione'));

    lancia(() => result.current.handleCreateTemplate(evento()));

    await waitFor(() => expect(createChecklistTemplate).toHaveBeenCalledWith({
      name: 'Nuovo memo',
      description: 'Descrizione',
    }));
    await waitFor(() => expect(result.current.newTemplateName).toBe(''));
    await waitFor(() => expect(result.current.selectedTemplateId).toBe('t9'));
  });

  it('una descrizione vuota non viene mandata affatto', async () => {
    const { result } = await montaHook();
    act(() => result.current.setNewTemplateName('Solo nome'));

    lancia(() => result.current.handleCreateTemplate(evento()));

    await waitFor(() => expect(createChecklistTemplate).toHaveBeenCalledWith({
      name: 'Solo nome',
      description: undefined,
    }));
  });

  // Col nome gia' in uso non si crea un doppione: si apre quello che c'e'.
  it('con un nome gia usato apre il memo esistente invece di crearne un altro', async () => {
    const { result } = await montaHook();
    act(() => result.current.setSelectedTemplateId(''));
    act(() => result.current.setNewTemplateName('  ONBOARDING '));

    lancia(() => result.current.handleCreateTemplate(evento()));

    expect(createChecklistTemplate).not.toHaveBeenCalled();
    await waitFor(() => expect(result.current.selectedTemplateId).toBe('t1'));
  });

  it('se il nome esiste su un memo archiviato accende anche il filtro', async () => {
    listChecklistTemplates.mockResolvedValue([memo({ id: 't2', name: 'Chiusura', isArchived: true })]);
    const { result } = await montaHook();
    act(() => result.current.setNewTemplateName('chiusura'));

    lancia(() => result.current.handleCreateTemplate(evento()));

    expect(createChecklistTemplate).not.toHaveBeenCalled();
    await waitFor(() => expect(result.current.showArchivedTemplates).toBe(true));
  });
});

describe('modifica di un memo', () => {
  it('la bozza parte dai valori del memo aperto', async () => {
    const { result } = await montaHook();

    await waitFor(() => expect(result.current.editingTemplateName).toBe('Onboarding'));
    expect(result.current.editingTemplateDescription).toBe('Primi passi');
  });

  it('salva nome e descrizione ripuliti dagli spazi', async () => {
    const { result } = await montaHook();
    await waitFor(() => expect(result.current.editingTemplateName).toBe('Onboarding'));
    act(() => result.current.setEditingTemplateName('  Onboarding rivisto '));

    lancia(() => result.current.handleUpdateTemplate());

    await waitFor(() => expect(updateChecklistTemplate).toHaveBeenCalledWith('t1', {
      name: 'Onboarding rivisto',
      description: 'Primi passi',
    }));
  });

  it('una descrizione svuotata viene mandata come null, non come stringa vuota', async () => {
    const { result } = await montaHook();
    await waitFor(() => expect(result.current.editingTemplateName).toBe('Onboarding'));
    act(() => result.current.setEditingTemplateDescription('   '));

    lancia(() => result.current.handleUpdateTemplate());

    await waitFor(() => expect(updateChecklistTemplate).toHaveBeenCalledWith('t1', {
      name: 'Onboarding',
      description: null,
    }));
  });

  it('senza nome non chiama il server', async () => {
    const { result } = await montaHook();
    await waitFor(() => expect(result.current.editingTemplateName).toBe('Onboarding'));
    act(() => result.current.setEditingTemplateName('  '));

    lancia(() => result.current.handleUpdateTemplate());

    expect(updateChecklistTemplate).not.toHaveBeenCalled();
  });

  // Rinominare un memo col proprio nome non deve risultare un duplicato di se
  // stesso, altrimenti non lo si potrebbe piu' salvare.
  it('tenere lo stesso nome non conta come duplicato', async () => {
    const { result } = await montaHook();
    await waitFor(() => expect(result.current.editingTemplateName).toBe('Onboarding'));

    lancia(() => result.current.handleUpdateTemplate());

    await waitFor(() => expect(updateChecklistTemplate).toHaveBeenCalled());
  });

  it('col nome di un altro memo non salva e apre quell altro', async () => {
    listChecklistTemplates.mockResolvedValue([memo(), memo({ id: 't2', name: 'Chiusura' })]);
    const { result } = await montaHook();
    await waitFor(() => expect(result.current.editingTemplateName).toBe('Onboarding'));
    act(() => result.current.setEditingTemplateName('Chiusura'));

    lancia(() => result.current.handleUpdateTemplate());

    expect(updateChecklistTemplate).not.toHaveBeenCalled();
    await waitFor(() => expect(result.current.selectedTemplateId).toBe('t2'));
  });
});

describe('archiviazione ed eliminazione', () => {
  it('archivia, accende il filtro e tiene aperto lo stesso memo', async () => {
    const { result } = await montaHook();
    await waitFor(() => expect(result.current.selectedTemplateId).toBe('t1'));

    lancia(() => result.current.handleArchiveTemplate());

    await waitFor(() => expect(archiveChecklistTemplate).toHaveBeenCalledWith('t1'));
    await waitFor(() => expect(result.current.showArchivedTemplates).toBe(true));
    expect(result.current.selectedTemplateId).toBe('t1');
  });

  // L'eliminazione definitiva vale solo sugli archiviati: su un memo attivo il
  // comando non deve nemmeno chiedere conferma.
  it('su un memo non archiviato non elimina e non chiede conferma', async () => {
    vi.stubGlobal('confirm', vi.fn(() => true));
    const { result } = await montaHook();
    await waitFor(() => expect(result.current.selectedTemplateQuery.data?.id).toBe('t1'));

    lancia(() => result.current.handleDeleteTemplatePermanently());

    expect(window.confirm).not.toHaveBeenCalled();
    expect(deleteChecklistTemplatePermanently).not.toHaveBeenCalled();
  });

  it('su un memo archiviato chiede conferma, e se si annulla non elimina', async () => {
    getChecklistTemplate.mockResolvedValue(memoConStep({ isArchived: true }));
    vi.stubGlobal('confirm', vi.fn(() => false));
    const { result } = await montaHook();
    await waitFor(() => expect(result.current.selectedTemplateQuery.data?.isArchived).toBe(true));

    lancia(() => result.current.handleDeleteTemplatePermanently());

    expect(window.confirm).toHaveBeenCalledTimes(1);
    expect(deleteChecklistTemplatePermanently).not.toHaveBeenCalled();
  });

  it('confermando elimina e azzera la selezione', async () => {
    getChecklistTemplate.mockResolvedValue(memoConStep({ isArchived: true }));
    vi.stubGlobal('confirm', vi.fn(() => true));
    const { result } = await montaHook();
    await waitFor(() => expect(result.current.selectedTemplateQuery.data?.isArchived).toBe(true));

    lancia(() => result.current.handleDeleteTemplatePermanently());

    await waitFor(() => expect(deleteChecklistTemplatePermanently).toHaveBeenCalledWith('t1'));
  });
});

describe('step del memo', () => {
  it('aggiunge uno step e riazzera il form ai valori di partenza', async () => {
    const { result } = await montaHook();
    await waitFor(() => expect(result.current.selectedTemplateQuery.data?.id).toBe('t1'));
    act(() => result.current.setNewItemTitle('  Nuovo step '));
    act(() => result.current.setNewItemRequired(false));
    act(() => result.current.setNewItemCritical(true));

    lancia(() => result.current.handleCreateItem(evento()));

    await waitFor(() => expect(createChecklistTemplateItem).toHaveBeenCalledWith('t1', {
      title: 'Nuovo step',
      description: undefined,
      isRequired: false,
      requiresEvidenceSnapshot: false,
      isCriticalSnapshot: true,
      defaultAssignedToUserId: null,
    }));
    // "Obbligatorio" torna acceso: e' il valore di partenza, non l'ultimo usato.
    await waitFor(() => expect(result.current.newItemRequired).toBe(true));
    expect(result.current.newItemTitle).toBe('');
    expect(result.current.newItemCritical).toBe(false);
  });

  it('senza titolo non aggiunge niente', async () => {
    const { result } = await montaHook();
    await waitFor(() => expect(result.current.selectedTemplateQuery.data?.id).toBe('t1'));

    lancia(() => result.current.handleCreateItem(evento()));

    expect(createChecklistTemplateItem).not.toHaveBeenCalled();
  });

  it('salva lo step in modifica e chiude la modifica', async () => {
    const { result } = await montaHook();
    await waitFor(() => expect(result.current.selectedTemplateQuery.data?.id).toBe('t1'));
    act(() => result.current.setEditingItem({ id: 'i1', title: ' Step rivisto ', isRequired: true }));

    lancia(() => result.current.handleSaveItem());

    await waitFor(() => expect(updateChecklistTemplateItem).toHaveBeenCalledWith('t1', 'i1', {
      title: 'Step rivisto',
      description: null,
      isRequired: true,
      requiresEvidenceSnapshot: false,
      isCriticalSnapshot: false,
      defaultAssignedToUserId: null,
    }));
    await waitFor(() => expect(result.current.editingItem).toBeNull());
  });

  it('senza titolo lo step in modifica non si salva', async () => {
    const { result } = await montaHook();
    await waitFor(() => expect(result.current.selectedTemplateQuery.data?.id).toBe('t1'));
    act(() => result.current.setEditingItem({ id: 'i1', title: '   ' }));

    lancia(() => result.current.handleSaveItem());

    expect(updateChecklistTemplateItem).not.toHaveBeenCalled();
    expect(result.current.editingItem).not.toBeNull();
  });

  it('elimina uno step', async () => {
    const { result } = await montaHook();
    await waitFor(() => expect(result.current.selectedTemplateQuery.data?.id).toBe('t1'));

    lancia(() => result.current.handleDeleteItem('i2'));

    await waitFor(() => expect(deleteChecklistTemplateItem).toHaveBeenCalledWith('t1', 'i2'));
  });

  it('sposta uno step e manda l elenco completo nel nuovo ordine', async () => {
    const { result } = await montaHook();
    await waitFor(() => expect(result.current.selectedTemplateQuery.data?.id).toBe('t1'));

    lancia(() => result.current.handleReorderItem('i1', 1));

    await waitFor(() => expect(reorderChecklistTemplateItems).toHaveBeenCalledWith('t1', ['i2', 'i1']));
  });

  it('ai bordi non chiama il server', async () => {
    const { result } = await montaHook();
    await waitFor(() => expect(result.current.selectedTemplateQuery.data?.id).toBe('t1'));

    lancia(() => result.current.handleReorderItem('i1', -1));
    lancia(() => result.current.handleReorderItem('i2', 1));

    expect(reorderChecklistTemplateItems).not.toHaveBeenCalled();
  });
});

describe('errori del server', () => {
  it('un salvataggio rifiutato non lascia lo stato a meta', async () => {
    const rifiuto = Object.assign(new Error('Nome gia usato'), { name: 'ApiError', code: 'DUPLICATE' });
    createChecklistTemplate.mockRejectedValue(rifiuto);
    const { result } = await montaHook();
    act(() => result.current.setNewTemplateName('Nuovo memo'));

    lancia(() => result.current.handleCreateTemplate(evento()));

    await waitFor(() => expect(createChecklistTemplate).toHaveBeenCalled());
    // Il nome digitato resta nel form: si e' rotto il salvataggio, non il testo.
    expect(result.current.newTemplateName).toBe('Nuovo memo');
  });
});
