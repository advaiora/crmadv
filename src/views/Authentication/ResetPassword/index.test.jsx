// Test della pagina /reset-password, quella dove atterra chi ha cliccato il link
// ricevuto per email.
//
// Le due cose che valgono il test: il link viene controllato PRIMA di far
// digitare qualcosa (altrimenti si scopre che era scaduto dopo aver scelto e
// ripetuto una password), e a buon fine si finisce sulla schermata di accesso,
// perche' la conferma non apre nessuna sessione.
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../../utils/apiClient', () => ({
  apiPost: vi.fn(),
}));

vi.mock('../../../utils/theme-provider/theme-provider', () => ({
  useTheme: () => ({ theme: 'light' }),
}));

const replace = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useHistory: () => ({ replace }),
  };
});

import { apiPost } from '../../../utils/apiClient';
import ResetPassword from './index';

const montaCon = (search) =>
  render(
    <MemoryRouter initialEntries={[`/reset-password${search}`]}>
      <ResetPassword />
    </MemoryRouter>,
  );

describe('Pagina di recupero password', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('controlla il link all\'apertura, prima di mostrare la maschera', async () => {
    apiPost.mockResolvedValue({ valid: true });

    montaCon('?token=abc123');

    await waitFor(() => expect(apiPost).toHaveBeenCalledWith(
      '/auth/password/reset/check',
      { token: 'abc123' },
      { skipAuthHeaders: true },
    ));
    expect(await screen.findByLabelText('Password nuova')).toBeInTheDocument();
  });

  it('con un link scaduto non mostra nessun campo password', async () => {
    apiPost.mockResolvedValue({ valid: false });

    montaCon('?token=scaduto');

    expect(await screen.findByText(/non è più valido/i)).toBeInTheDocument();
    expect(screen.queryByLabelText('Password nuova')).not.toBeInTheDocument();
  });

  it('senza token nell\'indirizzo non chiama nemmeno il server', () => {
    montaCon('');

    expect(apiPost).not.toHaveBeenCalled();
    expect(screen.getByText(/non è più valido/i)).toBeInTheDocument();
  });

  it('distingue un guasto di verifica da un link scaduto', async () => {
    apiPost.mockRejectedValue({ status: 500, message: 'Servizio non raggiungibile' });

    montaCon('?token=abc123');

    expect(await screen.findByText('Servizio non raggiungibile')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Riprova' })).toBeInTheDocument();
  });

  it('manda token e password nuova, poi porta alla schermata di accesso', async () => {
    apiPost.mockResolvedValueOnce({ valid: true });

    montaCon('?token=abc123');
    const campoNuova = await screen.findByLabelText('Password nuova');

    apiPost.mockResolvedValueOnce({ reset: true });
    fireEvent.change(campoNuova, { target: { value: 'passwordnuova' } });
    fireEvent.change(screen.getByLabelText('Ripeti la password nuova'), {
      target: { value: 'passwordnuova' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Reimposta la password' }));

    await waitFor(() => expect(apiPost).toHaveBeenLastCalledWith(
      '/auth/password/reset/confirm',
      { token: 'abc123', newPassword: 'passwordnuova' },
      { skipAuthHeaders: true },
    ));
    expect(replace).toHaveBeenCalledWith({
      pathname: '/auth/login',
      state: { passwordReset: true },
    });
  });

  it('non manda niente se le due password non coincidono', async () => {
    apiPost.mockResolvedValueOnce({ valid: true });

    montaCon('?token=abc123');
    const campoNuova = await screen.findByLabelText('Password nuova');

    fireEvent.change(campoNuova, { target: { value: 'passwordnuova' } });
    fireEvent.change(screen.getByLabelText('Ripeti la password nuova'), {
      target: { value: 'altracosa' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Reimposta la password' }));

    expect(screen.getByText('Le due password non coincidono')).toBeInTheDocument();
    expect(apiPost).toHaveBeenCalledTimes(1);
  });

  it('se il token muore fra il controllo e la conferma torna allo stato di link non valido', async () => {
    apiPost.mockResolvedValueOnce({ valid: true });

    montaCon('?token=abc123');
    const campoNuova = await screen.findByLabelText('Password nuova');

    apiPost.mockRejectedValueOnce({ status: 400, code: 'INVALID_RESET_TOKEN' });
    fireEvent.change(campoNuova, { target: { value: 'passwordnuova' } });
    fireEvent.change(screen.getByLabelText('Ripeti la password nuova'), {
      target: { value: 'passwordnuova' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Reimposta la password' }));

    expect(await screen.findByText(/non è più valido/i)).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });
});
