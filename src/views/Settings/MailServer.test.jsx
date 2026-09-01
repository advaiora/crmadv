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
  provaServerMail,
  salvaImpostazioniMail,
} from '../../modules/mail/api/mailApi';
import { ETICHETTA_RETE_INTERNA } from './mailServerReteInterna';

const IMPOSTAZIONI_SALVATE = {
  configurata: true,
  origineInUso: 'database',
  passwordSalvata: true,
  attivo: true,
  server: 'mail.esempio.it',
  porta: 587,
  connessioneSicura: false,
  retePrivataConsentita: false,
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

// Il caso del §7.7 punto 9. Il confronto campo per campo ha il suo test
// accanto (mailServerModifiche.test.js): qui interessa solo che la pagina lo
// usi davvero, e che senza modifiche non dica niente di nuovo.
describe('avviso: la prova collauda la configurazione salvata', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('appena aperta la pagina non compare nessun avviso', async () => {
    leggiImpostazioniMail.mockResolvedValue({ impostazioni: IMPOSTAZIONI_SALVATE });

    render(<MailServerPage />);

    await screen.findByRole('button', { name: /prova connessione/i });
    expect(screen.queryByText(/Hai modifiche non salvate/i)).not.toBeInTheDocument();
  });

  it('correggendo la porta senza salvare avvisa che la prova riguarda il salvato', async () => {
    leggiImpostazioniMail.mockResolvedValue({ impostazioni: IMPOSTAZIONI_SALVATE });

    render(<MailServerPage />);

    const porta = await screen.findByLabelText('Porta');
    fireEvent.change(porta, { target: { value: '465' } });

    await screen.findByText(/Hai modifiche non salvate/i);

    // La frase deve dire di quale configurazione parla l'esito: senza
    // "salvata" l'avviso non chiude il malinteso del §7.7 punto 9.
    const avviso = document.getElementById('mail-modifiche-pendenti');
    expect(avviso).toHaveTextContent(/configurazione salvata/i);
  });

  it('il pulsante «Prova connessione» resta premibile: l\'avviso non lo spegne', async () => {
    // Opzione B, decisa dal consiglio l'1/9/2026: si avvisa, non si blocca.
    // Chi vuole sapere se il server salvato risponde ancora deve poterlo fare
    // anche con la maschera sporca.
    leggiImpostazioniMail.mockResolvedValue({ impostazioni: IMPOSTAZIONI_SALVATE });

    render(<MailServerPage />);

    const porta = await screen.findByLabelText('Porta');
    fireEvent.change(porta, { target: { value: '465' } });

    const prova = await screen.findByRole('button', { name: /prova connessione/i });
    expect(prova).toBeEnabled();
    expect(prova).toHaveAttribute('aria-describedby', 'mail-modifiche-pendenti');
  });

  it('salvando, l\'avviso sparisce', async () => {
    leggiImpostazioniMail.mockResolvedValue({ impostazioni: IMPOSTAZIONI_SALVATE });
    salvaImpostazioniMail.mockResolvedValue({
      impostazioni: { ...IMPOSTAZIONI_SALVATE, porta: 465 },
    });

    render(<MailServerPage />);

    const porta = await screen.findByLabelText('Porta');
    fireEvent.change(porta, { target: { value: '465' } });
    expect(await screen.findByText(/Hai modifiche non salvate/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /salva impostazioni/i }));

    await waitFor(() =>
      expect(screen.queryByText(/Hai modifiche non salvate/i)).not.toBeInTheDocument(),
    );
  });

  it('senza niente di salvato resta il solo avviso di prima', async () => {
    // Il caso «non c'e' ancora niente» ha gia' il suo avviso e il pulsante
    // spento: due frasi sullo stesso posto direbbero la stessa cosa due volte.
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

    const porta = await screen.findByLabelText('Porta');
    fireEvent.change(porta, { target: { value: '465' } });

    expect(
      screen.getByText(/Salva le impostazioni per poter provare la connessione/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Hai modifiche non salvate/i)).not.toBeInTheDocument();
  });
});

// L'interruttore che autorizza la prova verso la rete interna dell'agenzia
// (§7.7 punto 7, opzione B). Il comportamento del server e' di CRM-28 e ha i
// suoi test la': qui interessa cosa vede e cosa manda la maschera.
describe('interruttore: il server di posta e\' nella rete interna', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('compare spento, con l\'etichetta decisa sull\'interazione di CRM-26', async () => {
    leggiImpostazioniMail.mockResolvedValue({ impostazioni: IMPOSTAZIONI_SALVATE });

    render(<MailServerPage />);

    const interruttore = await screen.findByLabelText(ETICHETTA_RETE_INTERNA);
    expect(interruttore).not.toBeChecked();
  });

  it('si accende leggendo quello che e\' salvato', async () => {
    leggiImpostazioniMail.mockResolvedValue({
      impostazioni: { ...IMPOSTAZIONI_SALVATE, retePrivataConsentita: true },
    });

    render(<MailServerPage />);

    expect(await screen.findByLabelText(ETICHETTA_RETE_INTERNA)).toBeChecked();
  });

  // ⚠️ Il test che vale piu' di tutti gli altri messi insieme. Nel corpo di
  // PUT /mail il campo e' `.default(false)`, non `.optional()`: ometterlo non
  // conserva il valore salvato, lo SPEGNE. E' la regola opposta a quella di
  // `password`, che sta nello stesso corpo due righe piu' sotto.
  it('lo manda al server anche quando e\' spento', async () => {
    leggiImpostazioniMail.mockResolvedValue({ impostazioni: IMPOSTAZIONI_SALVATE });
    salvaImpostazioniMail.mockResolvedValue({ impostazioni: IMPOSTAZIONI_SALVATE });

    render(<MailServerPage />);
    fireEvent.click(await screen.findByRole('button', { name: /salva impostazioni/i }));

    await waitFor(() => expect(salvaImpostazioniMail).toHaveBeenCalledTimes(1));

    const inviato = salvaImpostazioniMail.mock.calls[0][0];
    expect('retePrivataConsentita' in inviato).toBe(true);
    expect(inviato.retePrivataConsentita).toBe(false);
  });

  it('acceso e salvato, arriva al server come acceso', async () => {
    leggiImpostazioniMail.mockResolvedValue({ impostazioni: IMPOSTAZIONI_SALVATE });
    salvaImpostazioniMail.mockResolvedValue({
      impostazioni: { ...IMPOSTAZIONI_SALVATE, retePrivataConsentita: true },
    });

    render(<MailServerPage />);
    fireEvent.click(await screen.findByLabelText(ETICHETTA_RETE_INTERNA));
    fireEvent.click(screen.getByRole('button', { name: /salva impostazioni/i }));

    await waitFor(() => expect(salvaImpostazioniMail).toHaveBeenCalledTimes(1));
    expect(salvaImpostazioniMail.mock.calls[0][0].retePrivataConsentita).toBe(true);
  });

  // Il raccordo col fatto n.1 del compito: la prova gira sul server e collauda
  // il salvato. Chi spunta e preme subito deve leggere che non e' ancora
  // valido, altrimenti conclude che l'autorizzazione non funzioni.
  it('spuntato e non salvato, la pagina avvisa che la prova riguarda il salvato', async () => {
    leggiImpostazioniMail.mockResolvedValue({ impostazioni: IMPOSTAZIONI_SALVATE });

    render(<MailServerPage />);
    fireEvent.click(await screen.findByLabelText(ETICHETTA_RETE_INTERNA));

    expect(await screen.findByText(/Hai modifiche non salvate/i)).toBeInTheDocument();
  });

  it('sul rifiuto per rete privata l\'esito rimanda all\'interruttore', async () => {
    leggiImpostazioniMail.mockResolvedValue({ impostazioni: IMPOSTAZIONI_SALVATE });
    provaServerMail.mockResolvedValue({
      riuscita: false,
      origine: 'database',
      server: 'mail.interno.lan',
      motivo: 'rete_privata',
      errore:
        "L'indirizzo del server di posta è dentro una rete privata. La prova non è stata eseguita: nessuna connessione è stata aperta.",
    });

    render(<MailServerPage />);
    fireEvent.click(await screen.findByRole('button', { name: /prova connessione/i }));

    // Il messaggio del server resta intero, e la frase nostra gli si aggiunge
    // in coda: sono due cose diverse, il cosa e il come si rimedia.
    const avviso = (await screen.findByText(/dentro una rete privata/i)).closest('.alert');
    expect(avviso).toHaveTextContent(ETICHETTA_RETE_INTERNA);
    expect(avviso).toHaveTextContent(/salva/i);
  });

  it('su un rifiuto qualunque non nomina l\'interruttore', async () => {
    leggiImpostazioniMail.mockResolvedValue({ impostazioni: IMPOSTAZIONI_SALVATE });
    provaServerMail.mockResolvedValue({
      riuscita: false,
      origine: 'database',
      server: 'mail.esempio.it',
      errore: 'Il server ha rifiutato le credenziali.',
    });

    render(<MailServerPage />);
    fireEvent.click(await screen.findByRole('button', { name: /prova connessione/i }));

    const avviso = (await screen.findByText(/rifiutato le credenziali/i)).closest('.alert');
    expect(avviso).not.toHaveTextContent(ETICHETTA_RETE_INTERNA);
  });
});
