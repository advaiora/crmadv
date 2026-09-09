// Test della maschera «Cambia password» di Impostazioni Account.
//
// Copre la logica che il componente ha di suo, e in particolare la cosa che si
// vede solo dopo, quando e' troppo tardi: il TOKEN che torna nella risposta deve
// finire in sessione, altrimenti chi cambia la password si ritrova sloggiato
// alla richiesta successiva.
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

vi.mock('../../../utils/apiClient', () => ({
  apiPost: vi.fn(),
}));

const login = vi.fn();
const SESSIONE = {
  accessToken: 'token-vecchio',
  userId: 'utente-1',
  userEmail: 'info@advaiora.com',
  userRole: 'admin',
  workspaceId: 'ws-1',
};

vi.mock('../../../hooks/useSession', () => ({
  useSession: () => ({ session: SESSIONE, login, isAuthenticated: true, logout: vi.fn() }),
}));

import { apiPost } from '../../../utils/apiClient';
import ChangePasswordCard from './ChangePasswordCard';

const compila = ({ attuale = 'vecchiaPassword', nuova = 'passwordnuova', conferma = 'passwordnuova' } = {}) => {
  fireEvent.change(screen.getByLabelText('Password attuale'), { target: { value: attuale } });
  fireEvent.change(screen.getByLabelText('Password nuova'), { target: { value: nuova } });
  fireEvent.change(screen.getByLabelText('Ripeti la password nuova'), { target: { value: conferma } });
};

const invia = () => fireEvent.click(screen.getByRole('button', { name: 'Cambia password' }));

describe('Cambia password', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('manda al server solo la password attuale e quella nuova', async () => {
    apiPost.mockResolvedValue({ changed: true, otherSessionsRevoked: true, token: 'token-nuovo' });

    render(<ChangePasswordCard />);
    compila();
    invia();

    await waitFor(() => expect(apiPost).toHaveBeenCalledTimes(1));
    expect(apiPost).toHaveBeenCalledWith('/auth/password/change', {
      currentPassword: 'vecchiaPassword',
      newPassword: 'passwordnuova',
    });
  });

  it('rimpiazza in sessione il token vecchio con quello tornato dal server', async () => {
    apiPost.mockResolvedValue({ changed: true, otherSessionsRevoked: true, token: 'token-nuovo' });

    render(<ChangePasswordCard />);
    compila();
    invia();

    await waitFor(() => expect(login).toHaveBeenCalledTimes(1));
    expect(login).toHaveBeenCalledWith({ ...SESSIONE, accessToken: 'token-nuovo' });
  });

  it('a buon fine svuota i campi e dice che gli altri accessi sono stati chiusi', async () => {
    apiPost.mockResolvedValue({ changed: true, otherSessionsRevoked: true, token: 'token-nuovo' });

    render(<ChangePasswordCard />);
    compila();
    invia();

    expect(await screen.findByText(/gli altri accessi con la password vecchia sono stati chiusi/i))
      .toBeInTheDocument();
    expect(screen.getByLabelText('Password attuale')).toHaveValue('');
    expect(screen.getByLabelText('Password nuova')).toHaveValue('');
  });

  it('se il server non conferma la chiusura degli altri accessi, avverte invece di tacere', async () => {
    // Ramo oggi irraggiungibile (la rotta scrive sempre `true`), ma va tenuto
    // sotto test perche' e' il caso che il rilievo del Guardiano ha chiesto di
    // far parlare: se un domani tornasse `false`, l'utente non deve leggere un
    // "Password aggiornata." che gli fa credere chiuse sessioni rimaste aperte.
    apiPost.mockResolvedValue({ changed: true, otherSessionsRevoked: false, token: 'token-nuovo' });

    render(<ChangePasswordCard />);
    compila();
    invia();

    expect(await screen.findByText(/potrebbero essere ancora attivi/i)).toBeInTheDocument();
  });

  it('non chiama il server se le due password nuove non coincidono', () => {
    render(<ChangePasswordCard />);
    compila({ conferma: 'altracosa' });
    invia();

    expect(apiPost).not.toHaveBeenCalled();
    expect(screen.getByText('Le due password non coincidono')).toBeInTheDocument();
  });

  it('non chiama il server se la password nuova e\' sotto gli 8 caratteri', () => {
    render(<ChangePasswordCard />);
    compila({ nuova: 'corta', conferma: 'corta' });
    invia();

    expect(apiPost).not.toHaveBeenCalled();
    // Testo esatto: il testo d'aiuto sotto al campo dice a sua volta «Almeno 8 caratteri».
    expect(screen.getByText('La password deve avere almeno 8 caratteri')).toBeInTheDocument();
  });

  it('mostra distintamente la password attuale sbagliata', async () => {
    apiPost.mockRejectedValue({ status: 400, code: 'INVALID_CURRENT_PASSWORD' });

    render(<ChangePasswordCard />);
    compila();
    invia();

    expect(await screen.findByText('La password attuale non è corretta.')).toBeInTheDocument();
  });

  it('mostra distintamente la password uguale a quella di prima', async () => {
    apiPost.mockRejectedValue({ status: 400, code: 'PASSWORD_UNCHANGED' });

    render(<ChangePasswordCard />);
    compila();
    invia();

    expect(await screen.findByText(/diversa da quella attuale/i)).toBeInTheDocument();
  });

  it('a chi entra con Google propone il link per impostarne una, con la formula neutra', async () => {
    apiPost.mockRejectedValueOnce({ status: 409, code: 'PASSWORD_NOT_SET' });

    render(<ChangePasswordCard />);
    compila();
    invia();

    const bottone = await screen.findByRole('button', { name: 'Ricevi un link per impostarla' });

    apiPost.mockResolvedValueOnce({ requested: true });
    fireEvent.click(bottone);

    await waitFor(() => expect(apiPost).toHaveBeenCalledTimes(2));
    expect(apiPost).toHaveBeenLastCalledWith(
      '/auth/password/reset/request',
      { email: 'info@advaiora.com' },
      { skipAuthHeaders: true },
    );
    expect(await screen.findByText(/Se l'indirizzo è registrato/i)).toBeInTheDocument();
  });
});
