// Test della pagina "Server di posta". Copre la logica che la pagina ha di
// suo — non il rendering di Bootstrap: che cosa manda al server quando si
// salva, e che cosa dice a chi legge sullo stato in cui si trova la posta.
//
// La regola piu' delicata e' quella del campo password: lasciato vuoto NON
// deve arrivare al server, o cancellerebbe la password gia' salvata. E' la
// stessa regola coperta lato backend in mail.service.test.ts; qui si verifica
// che sia rispettata anche dalla parte che compone la richiesta.
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import MailServerPage from './MailServer';

vi.mock('../../modules/mail/api/mailApi', () => ({
  leggiImpostazioniMail: vi.fn(),
  salvaImpostazioniMail: vi.fn(),
  provaServerMail: vi.fn(),
  eliminaImpostazioniMail: vi.fn(),
}));

// Il cancello dei permessi ha un test suo: qui interessa il contenuto, quindi
// lo si lascia passare sempre.
vi.mock('../../components/guards/ModulePermissionGate', () => ({
  default: ({ children }) => <>{children}</>,
}));

import {
  leggiImpostazioniMail,
  salvaImpostazioniMail,
} from '../../modules/mail/api/mailApi';

const IMPOSTAZIONI_SALVATE = {
  configurata: true,
  origineInUso: 'database',
  passwordSalvata: true,
  attivo: true,
  server: 'mail.esempio.it',
  porta: 587,
  connessioneSicura: false,
  utente: 'noreply@esempio.it',
  mittente: 'Studio <noreply@esempio.it>',
  aggiornatoIl: '2026-08-18T10:00:00.000Z',
};

describe('Server di posta', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('dice che sta spedendo con le variabili d\'ambiente se non c\'e\' nulla di salvato', async () => {
    leggiImpostazioniMail.mockResolvedValue({
      impostazioni: {
        ...IMPOSTAZIONI_SALVATE,
        configurata: false,
        origineInUso: 'env',
        passwordSalvata: false,
        aggiornatoIl: null,
      },
    });

    render(<MailServerPage />);

    expect(await screen.findByText(/file \.env/i)).toBeInTheDocument();
  });

  it('avverte quando non c\'e\' nessun server di posta', async () => {
    leggiImpostazioniMail.mockResolvedValue({
      impostazioni: {
        ...IMPOSTAZIONI_SALVATE,
        configurata: false,
        origineInUso: 'nessuna',
        passwordSalvata: false,
        server: '',
        mittente: '',
        aggiornatoIl: null,
      },
    });

    render(<MailServerPage />);

    expect(
      await screen.findByText(/Nessun server di posta configurato/i),
    ).toBeInTheDocument();
  });

  // I due casi della configurazione IN PAUSA. Contano perche' l'origine in uso
  // diventa 'env' o 'nessuna' esattamente come quando non c'e' niente di
  // salvato: senza distinguerli, la pagina direbbe "nessun server configurato"
  // a chi ha una configurazione piena e giusta, solo spenta apposta.
  it('con la configurazione in pausa e nessun ripiego dice che e\' in pausa, non che manca', async () => {
    leggiImpostazioniMail.mockResolvedValue({
      impostazioni: {
        ...IMPOSTAZIONI_SALVATE,
        origineInUso: 'nessuna',
        attivo: false,
      },
    });

    render(<MailServerPage />);

    // Non basta cercare "in pausa": lo dice anche il badge in fondo alla
    // pagina. Serve una frase che possa venire solo dall'avviso in cima.
    expect(await screen.findByText(/I parametri sono salvati e intatti/i)).toBeInTheDocument();
    expect(screen.queryByText(/Nessun server di posta configurato/i)).not.toBeInTheDocument();
  });

  it('con la configurazione in pausa e il ripiego attivo dice di riaccendere l\'interruttore', async () => {
    leggiImpostazioniMail.mockResolvedValue({
      impostazioni: {
        ...IMPOSTAZIONI_SALVATE,
        origineInUso: 'env',
        attivo: false,
      },
    });

    render(<MailServerPage />);

    expect(await screen.findByText(/riaccendi/i)).toBeInTheDocument();
    // Con l'interruttore spento, salvare NON basta: la promessa "quello che
    // salvi qui prende il posto di quelli" sarebbe falsa.
    expect(screen.queryByText(/prende il posto di quelli/i)).not.toBeInTheDocument();
  });

  it('non permette di provare la connessione finche\' non si e\' salvato', async () => {
    leggiImpostazioniMail.mockResolvedValue({
      impostazioni: {
        ...IMPOSTAZIONI_SALVATE,
        configurata: false,
        origineInUso: 'env',
        passwordSalvata: false,
        aggiornatoIl: null,
      },
    });

    render(<MailServerPage />);

    expect(await screen.findByRole('button', { name: /prova connessione/i })).toBeDisabled();
  });

  it('mostra che una password e\' gia\' salvata senza mostrarne il valore', async () => {
    leggiImpostazioniMail.mockResolvedValue({ impostazioni: IMPOSTAZIONI_SALVATE });

    render(<MailServerPage />);

    const campoPassword = await screen.findByLabelText('Password');
    expect(campoPassword).toHaveValue('');
    expect(campoPassword.getAttribute('placeholder')).toMatch(/gi.\s*salvata/i);
  });

  it('salvando senza toccare la password NON manda il campo al server', async () => {
    leggiImpostazioniMail.mockResolvedValue({ impostazioni: IMPOSTAZIONI_SALVATE });
    salvaImpostazioniMail.mockResolvedValue({ impostazioni: IMPOSTAZIONI_SALVATE });

    render(<MailServerPage />);
    const salva = await screen.findByRole('button', { name: /salva impostazioni/i });
    fireEvent.click(salva);

    await waitFor(() => expect(salvaImpostazioniMail).toHaveBeenCalledTimes(1));

    const inviato = salvaImpostazioniMail.mock.calls[0][0];
    expect('password' in inviato).toBe(false);
    expect(inviato.server).toBe('mail.esempio.it');
    expect(inviato.porta).toBe(587);
  });
});
