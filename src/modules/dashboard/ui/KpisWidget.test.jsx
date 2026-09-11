// CRMA-129 - KpisWidget deve disegnare solo le card i cui KPI sono davvero presenti in
// `data` (il backend di CRMA-122 omette la chiave se il modulo e' spento, invece di
// restituire zero), senza pero' perdere gli scheletri mentre i dati stanno ancora arrivando.
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import KpisWidget from './KpisWidget';

describe('KpisWidget', () => {
  it('con tutte le chiavi presenti disegna le quattro card', () => {
    render(
      <KpisWidget
        data={{
          clientsActive: 3,
          projectsActive: 5,
          quotesSent30d: 2,
          checklistOpenItems: 1,
        }}
      />,
    );
    expect(screen.getByText('Clienti attivi')).toBeInTheDocument();
    expect(screen.getByText('Progetti attivi')).toBeInTheDocument();
    expect(screen.getByText('Preventivi inviati (30g)')).toBeInTheDocument();
    expect(screen.getByText('Task checklist aperti')).toBeInTheDocument();
  });

  it('con un valore a zero ma chiave presente disegna comunque la card (modulo acceso, zero dati)', () => {
    render(
      <KpisWidget
        data={{
          clientsActive: 0,
          projectsActive: 0,
          quotesSent30d: 0,
          checklistOpenItems: 0,
        }}
      />,
    );
    expect(screen.getByText('Clienti attivi')).toBeInTheDocument();
    expect(screen.getByText('Progetti attivi')).toBeInTheDocument();
    expect(screen.getAllByText('0')).toHaveLength(4);
  });

  it('con un modulo spento (chiave assente da data) non disegna la sua card', () => {
    render(
      <KpisWidget
        data={{
          clientsActive: 3,
          quotesSent30d: 2,
          checklistOpenItems: 1,
        }}
      />,
    );
    expect(screen.getByText('Clienti attivi')).toBeInTheDocument();
    expect(screen.queryByText('Progetti attivi')).not.toBeInTheDocument();
  });

  it('mentre carica (data assente) mostra comunque tutti gli scheletri', () => {
    render(<KpisWidget data={null} loading />);
    expect(screen.getByText('Clienti attivi')).toBeInTheDocument();
    expect(screen.getByText('Progetti attivi')).toBeInTheDocument();
    expect(screen.getByText('Preventivi inviati (30g)')).toBeInTheDocument();
    expect(screen.getByText('Task checklist aperti')).toBeInTheDocument();
  });

  it('senza nessun KPI presente non disegna il contenitore', () => {
    const { container } = render(<KpisWidget data={{}} />);
    expect(container.firstChild).toBeNull();
  });
});
