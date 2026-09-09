// Test della finestra «Password dimenticata» della schermata di accesso.
//
// Il test che conta davvero e' l'ultimo: il messaggio di esito non deve mai
// affermare che l'email e' partita. Il server risponde allo stesso modo a un
// indirizzo registrato e a uno inesistente, e una maschera piu' precisa della
// risposta rimetterebbe in piedi proprio il modo di scoprire chi ha un account.
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

vi.mock('../../../../utils/apiClient', () => ({
  apiPost: vi.fn(),
}));

import { apiPost } from '../../../../utils/apiClient';
import ForgotPasswordModal from './ForgotPasswordModal';

const monta = (props = {}) =>
  render(<ForgotPasswordModal show onHide={vi.fn()} {...props} />);

describe('Password dimenticata', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('manda l\'indirizzo normalizzato, senza intestazioni di sessione', async () => {
    apiPost.mockResolvedValue({ requested: true });

    monta();
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: '  Info@Advaiora.com ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Invia il link' }));

    await waitFor(() => expect(apiPost).toHaveBeenCalledWith(
      '/auth/password/reset/request',
      { email: 'info@advaiora.com' },
      { skipAuthHeaders: true },
    ));
  });

  // Indirizzo senza dominio di primo livello: il campo `type="email"` del browser
  // lo lascia passare, quindi il controllo che lo ferma e' il nostro. Una stringa
  // senza chiocciola non servirebbe a provare niente — la bloccherebbe il browser
  // prima ancora che parta l'invio.
  it('non chiama il server se l\'indirizzo non e\' valido', () => {
    monta();
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'info@advaiora' } });
    fireEvent.click(screen.getByRole('button', { name: 'Invia il link' }));

    expect(apiPost).not.toHaveBeenCalled();
    expect(screen.getByText('Email non valida')).toBeInTheDocument();
  });

  it('parte con l\'indirizzo gia\' scritto nella schermata di accesso', () => {
    monta({ defaultEmail: 'info@advaiora.com' });
    expect(screen.getByLabelText('Email')).toHaveValue('info@advaiora.com');
  });

  it('dopo l\'invio non promette nessuna email, e usa la formula condizionale', async () => {
    apiPost.mockResolvedValue({ requested: true });

    monta();
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'info@advaiora.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Invia il link' }));

    const esito = await screen.findByText(/Se l'indirizzo è registrato/i);
    expect(esito).toBeInTheDocument();
    expect(screen.queryByText(/ti abbiamo mandato|abbiamo inviato un/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Invia il link' })).not.toBeInTheDocument();
  });

  it('mostra l\'anteprima del messaggio quando il server la fornisce (solo in sviluppo)', async () => {
    apiPost.mockResolvedValue({ requested: true, previewUrl: 'https://ethereal.email/messaggio/1' });

    monta();
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'info@advaiora.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Invia il link' }));

    const link = await screen.findByRole('link', { name: /anteprima del messaggio/i });
    expect(link).toHaveAttribute('href', 'https://ethereal.email/messaggio/1');
  });

  it('riporta un errore del server senza inventare un esito positivo', async () => {
    apiPost.mockRejectedValue({ status: 429, message: 'Troppe richieste, riprova più tardi.' });

    monta();
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'info@advaiora.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Invia il link' }));

    expect(await screen.findByText('Troppe richieste, riprova più tardi.')).toBeInTheDocument();
    expect(screen.queryByText(/Se l'indirizzo è registrato/i)).not.toBeInTheDocument();
  });
});
