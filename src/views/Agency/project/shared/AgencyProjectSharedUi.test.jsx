import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import AgencyWorkflowSteps from './AgencyWorkflowSteps';
import AgencyStatusAlerts from './AgencyStatusAlerts';
import AgencyNextActionStrip from './AgencyNextActionStrip';
import AgencyInputQualityPanel from './AgencyInputQualityPanel';
import AiBlockRegenerationButtons from './AiBlockRegenerationButtons';

// Un file solo per i cinque pezzi condivisi delle pagine di produzione del
// progetto: sono piccoli e si leggono meglio insieme.

describe('AgencyWorkflowSteps', () => {
  it('numera i passi nell\'ordine ricevuto', () => {
    render(<AgencyWorkflowSteps steps={[
      { title: 'Scegli pagina', description: 'Landing o sezione.' },
      { title: 'Verifica input', description: 'Target e offerta.' },
      { title: 'Genera blocchi', description: 'Con AI o bozza base.' },
    ]} />);

    expect(screen.getByText('Scegli pagina')).toBeInTheDocument();
    expect(screen.getByText('Target e offerta.')).toBeInTheDocument();
    expect(screen.getAllByText(/^[123]$/).map((el) => el.textContent)).toEqual(['1', '2', '3']);
  });
});

describe('AgencyStatusAlerts', () => {
  it('mostra i quattro messaggi nell\'ordine previsto', () => {
    const { container } = render(
      <AgencyStatusAlerts error="Errore" success="Salvato" info="Generato" warning="AI non configurata" />,
    );

    expect([...container.querySelectorAll('.alert')].map((el) => el.textContent)).toEqual([
      'Errore', 'Salvato', 'Generato', 'AI non configurata',
    ]);
    expect(screen.getByRole('alert')).toHaveTextContent('Errore');
  });

  it('senza messaggi non disegna niente', () => {
    const { container } = render(<AgencyStatusAlerts />);

    expect(container.querySelectorAll('.alert')).toHaveLength(0);
  });

  it('mostra solo i messaggi presenti', () => {
    const { container } = render(<AgencyStatusAlerts success="Salvato" />);

    expect(container.querySelectorAll('.alert')).toHaveLength(1);
    expect(screen.getByRole('status')).toHaveTextContent('Salvato');
  });
});

describe('AgencyNextActionStrip', () => {
  it('mostra il messaggio e i pulsanti passati come figli', () => {
    const azione = vi.fn();
    render(
      <AgencyNextActionStrip message="Crea la prima landing.">
        <button type="button" onClick={azione}>Genera struttura base</button>
      </AgencyNextActionStrip>,
    );

    expect(screen.getByText(/Crea la prima landing\./)).toBeInTheDocument();
    screen.getByRole('button', { name: 'Genera struttura base' }).click();
    expect(azione).toHaveBeenCalledTimes(1);
  });
});

describe('AgencyInputQualityPanel', () => {
  const campi = [
    { label: 'Target', value: 'PMI edili' },
    { label: 'Offerta', value: 'Consulenza a canone' },
  ];

  it('senza mancanti dichiara gli input completi e mostra il messaggio positivo', () => {
    const { container } = render(
      <AgencyInputQualityPanel
        title="Qualita input"
        subtitle="Dati usati prima della generazione."
        fields={campi}
        missingLabels={[]}
        completeMessage="La pagina ha le informazioni minime."
      />,
    );

    expect(screen.getByText('Input completi.')).toBeInTheDocument();
    expect(screen.getByText(/La pagina ha le informazioni minime\./)).toBeInTheDocument();
    expect(container.querySelector('.alert-success')).not.toBeNull();
  });

  it('con pochi mancanti passa al tono intermedio ed elenca cosa completare', () => {
    const { container } = render(
      <AgencyInputQualityPanel
        title="Qualita input"
        subtitle="Sottotitolo"
        fields={campi}
        missingLabels={['target', 'CTA primaria']}
        completeMessage="Tutto a posto."
      />,
    );

    expect(screen.getByText('Input parziali.')).toBeInTheDocument();
    expect(screen.getByText(/Completa: target, CTA primaria\./)).toBeInTheDocument();
    expect(container.querySelector('.alert-warning')).not.toBeNull();
  });

  it('con molti mancanti passa al tono di allarme', () => {
    const { container } = render(
      <AgencyInputQualityPanel
        title="Qualita input"
        subtitle="Sottotitolo"
        fields={campi}
        missingLabels={['a', 'b', 'c']}
        completeMessage="Tutto a posto."
      />,
    );

    expect(screen.getByText('Input da completare.')).toBeInTheDocument();
    expect(container.querySelector('.alert-danger')).not.toBeNull();
  });

  it('spazia tutte le righe tranne l\'ultima, che non lascia margine in fondo', () => {
    const { container } = render(
      <AgencyInputQualityPanel title="T" subtitle="S" fields={campi} missingLabels={[]} completeMessage="ok" />,
    );

    const righe = [...container.querySelectorAll('.agency-panel > .small')];
    expect(righe).toHaveLength(2);
    expect(righe[0]).toHaveClass('mb-2');
    expect(righe[1]).not.toHaveClass('mb-2');
  });
});

describe('AiBlockRegenerationButtons', () => {
  const blocchi = [
    { key: 'hero', label: 'Hero' },
    { key: 'faq', label: 'FAQ' },
  ];

  it('chiama onGenerate con la chiave del blocco cliccato', () => {
    const onGenerate = vi.fn();
    render(<AiBlockRegenerationButtons blocks={blocchi} generatingKey="" onGenerate={onGenerate} />);

    screen.getByRole('button', { name: /FAQ/ }).click();

    expect(onGenerate).toHaveBeenCalledWith('faq');
  });

  it('mentre un blocco genera, quello mostra l\'attesa e TUTTI sono bloccati', () => {
    render(<AiBlockRegenerationButtons blocks={blocchi} generatingKey="hero" onGenerate={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Rigenerazione...' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /FAQ/ })).toBeDisabled();
  });

  it('con disabled dall\'esterno (AI non configurata) blocca tutto', () => {
    render(<AiBlockRegenerationButtons blocks={blocchi} generatingKey="" onGenerate={vi.fn()} disabled />);

    screen.getAllByRole('button').forEach((bottone) => expect(bottone).toBeDisabled());
  });
});
