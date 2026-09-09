import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ClientNew from './ClientNew';

// La pagina «Nuovo cliente» e' il percorso da cui CRM-51 vuole che si possa
// creare un campo personalizzato. Qui si verifica proprio l'innesto: che
// l'ingresso arrivi fino a questa pagina, e solo a chi puo' usarlo.

const useWorkspaceAccess = vi.fn();
vi.mock('../../hooks/useWorkspaceAccess', () => ({
  useWorkspaceAccess: (...args) => useWorkspaceAccess(...args),
}));

const listCustomFields = vi.fn();
vi.mock('../../modules/customFields/api/customFieldsApi', () => ({
  listCustomFields: (...args) => listCustomFields(...args),
  createCustomField: vi.fn(),
  updateCustomField: vi.fn(),
}));

const accesso = (permessi) => ({
  access: { enabledModules: ['clients'], permissions: permessi },
  loading: false,
  error: null,
  reload: vi.fn(),
});

const disegna = () =>
  render(
    <MemoryRouter>
      <ClientNew />
    </MemoryRouter>,
  );

const ingresso = () => screen.queryByRole('button', { name: /Aggiungi campo personalizzato/ });

describe('ClientNew — ingresso ai campi personalizzati', () => {
  beforeEach(() => {
    useWorkspaceAccess.mockReset();
    listCustomFields.mockReset().mockResolvedValue({ definitions: [] });
  });

  it("chi puo' registrare e modificare trova l'ingresso senza uscire dalla pagina", async () => {
    useWorkspaceAccess.mockReturnValue(accesso(['clients.view', 'clients.create', 'clients.edit']));
    disegna();

    expect(await screen.findByText('Nuovo cliente')).toBeInTheDocument();
    await waitFor(() => expect(ingresso()).toBeInTheDocument());
  });

  it("chi puo' solo registrare non vede l'ingresso: creare una definizione chiede clients.edit", async () => {
    useWorkspaceAccess.mockReturnValue(accesso(['clients.view', 'clients.create']));
    disegna();

    expect(await screen.findByText('Nuovo cliente')).toBeInTheDocument();
    await waitFor(() => expect(listCustomFields).toHaveBeenCalledWith('client'));
    expect(ingresso()).not.toBeInTheDocument();
  });

  it('senza il permesso di registrare la pagina resta chiusa, ingresso compreso', () => {
    useWorkspaceAccess.mockReturnValue(accesso(['clients.view']));
    disegna();

    expect(screen.getByText(/Non hai i permessi necessari/)).toBeInTheDocument();
    expect(screen.queryByText('Nuovo cliente')).not.toBeInTheDocument();
    expect(ingresso()).not.toBeInTheDocument();
  });
});
