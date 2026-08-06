import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AlertsOperativeList from './AlertsOperativeList';
import DiagnosisPanel from './DiagnosisPanel';
import { isBlockingAlert } from './alertsConstants';

// Copre la scheda "Da risolvere" nata il 5/8/2026 dalla fusione fra la vecchia
// scheda Alert e la vecchia scheda Diagnosis. Il rischio che questi test
// presidiano e' la fusione stessa: che una delle due meta' sparisca in silenzio.

const renderConRouter = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe('isBlockingAlert', () => {
  it('considera bloccante un alert critico per gravita', () => {
    expect(isBlockingAlert({ severity: 'critical' })).toBe(true);
  });

  it('considera bloccante un alert critico per priorita', () => {
    // I due campi arrivano da generatori diversi: guardarne uno solo
    // lascerebbe fuori meta' dei bloccanti.
    expect(isBlockingAlert({ priority: 'critical' })).toBe(true);
  });

  it('non considera bloccante un alert di gravita normale', () => {
    expect(isBlockingAlert({ severity: 'medium', priority: 'low' })).toBe(false);
  });

  it('non esplode se l\'alert manca o e\' vuoto', () => {
    expect(isBlockingAlert(undefined)).toBe(false);
    expect(isBlockingAlert({})).toBe(false);
  });
});

describe('AlertsOperativeList', () => {
  const alerts = [
    { id: 'a1', title: 'Target non definito', severity: 'critical', status: 'open', reason: 'Manca il target.' },
    { id: 'a2', title: 'Tracking incompleto', severity: 'medium', status: 'todo' },
  ];

  it('separa i bloccanti dalle altre segnalazioni', () => {
    renderConRouter(<AlertsOperativeList alerts={alerts} projectId="p1" loading={false} />);

    expect(screen.getByText('Da risolvere prima di generare o consegnare')).toBeInTheDocument();
    expect(screen.getByText('Le altre segnalazioni')).toBeInTheDocument();
    expect(screen.getByText('Target non definito')).toBeInTheDocument();
    expect(screen.getByText('Tracking incompleto')).toBeInTheDocument();
  });

  it('quando non c\'e\' niente da risolvere lo dice e offre il Brief', () => {
    renderConRouter(<AlertsOperativeList alerts={[]} projectId="p1" loading={false} />);

    expect(screen.getByText('Niente da risolvere')).toBeInTheDocument();
    // react-bootstrap rende `Button as={Link}` come <a role="button">: si cerca
    // per ruolo bottone, non per ruolo link.
    expect(screen.getByRole('button', { name: 'Controlla il Brief' })).toBeInTheDocument();
  });

  it('mentre carica non mostra lo stato vuoto', () => {
    // Senza questa distinzione, all'apertura comparirebbe "niente da risolvere"
    // un istante prima che i dati arrivino.
    renderConRouter(<AlertsOperativeList alerts={[]} projectId="p1" loading />);

    expect(screen.queryByText('Niente da risolvere')).not.toBeInTheDocument();
  });
});

describe('DiagnosisPanel', () => {
  const diagnosis = {
    output: {
      diagnosisSummary: 'Il progetto non ha ancora un target definito.',
      criticalFindings: [{ key: 'k1', title: 'Target assente', summary: 'Nessun target.', priority: 'high', module: 'discovery', category: 'input' }],
      gapAnalysis: [],
      sourceSummary: { hasDiscovery: true, hasWeb: false },
    },
    input: { projectName: 'Progetto Demo' },
  };

  it('mostra sintesi, criticita e i pulsanti di rigenerazione e salvataggio', () => {
    renderConRouter(
      <DiagnosisPanel diagnosis={diagnosis} loading={false} busy={false} message="" error="" />,
    );

    expect(screen.getByText('Il progetto non ha ancora un target definito.')).toBeInTheDocument();
    expect(screen.getByText('Target assente')).toBeInTheDocument();
    // Rigenera e salva sono sopravvissuti alla fusione: la riorganizzazione
    // sposta i contenuti, non toglie funzioni.
    expect(screen.getByRole('button', { name: 'Rigenera analisi' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Salva analisi' })).toBeInTheDocument();
  });

  it('mostra le voci presenti e quelle da completare col vocabolario nuovo', () => {
    renderConRouter(
      <DiagnosisPanel diagnosis={diagnosis} loading={false} busy={false} message="" error="" />,
    );

    expect(screen.getByText('Brief: presente')).toBeInTheDocument();
    expect(screen.getByText('Contenuti Web: da completare')).toBeInTheDocument();
  });

  it('durante il caricamento non mostra i riquadri', () => {
    renderConRouter(<DiagnosisPanel diagnosis={null} loading busy={false} message="" error="" />);

    expect(screen.getByText(/Caricamento dell'analisi/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Salva analisi' })).not.toBeInTheDocument();
  });
});
