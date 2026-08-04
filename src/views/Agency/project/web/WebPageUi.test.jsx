import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Row } from 'react-bootstrap';
import WebGenerationActionsBar from './WebGenerationActionsBar';
import WebSubProjectsCard from './WebSubProjectsCard';
import WebPageSettingsCard from './WebPageSettingsCard';
import WebGenerationContractPanel from './WebGenerationContractPanel';
import WebGenerationOutputPanels from './WebGenerationOutputPanels';
import { EMPTY_WEB_PROJECT_DRAFT } from './webPageConstants';

// I cinque riquadri specifici della pagina Web. Sono componenti di sola
// presentazione: si verifica cosa mostrano e che i click arrivino al padre.

const azioniVuote = {
  onGenerateAi: vi.fn(),
  onGenerateBaseDraft: vi.fn(),
  onGenerateStructure: vi.fn(),
  onGenerateCopy: vi.fn(),
  onGenerateWireframe: vi.fn(),
  onGeneratePreview: vi.fn(),
  onReload: vi.fn(),
  onSave: vi.fn(),
};

describe('WebGenerationActionsBar', () => {
  it('senza generazioni lo dice, e mostra il salvataggio solo se c\'e\'', () => {
    const { rerender } = render(<WebGenerationActionsBar {...azioniVuote} />);
    expect(screen.getByText('Nessuna generazione registrata.')).toBeInTheDocument();
    expect(screen.queryByText(/Ultimo salvataggio/)).not.toBeInTheDocument();

    rerender(<WebGenerationActionsBar
      {...azioniVuote}
      lastGeneratedAt="2026-08-04T09:00:00.000Z"
      lastUpdatedAt="2026-08-04T09:30:00.000Z"
    />);
    expect(screen.getByText(/Ultima generazione: 2026-08-04/)).toBeInTheDocument();
    expect(screen.getByText(/Ultimo salvataggio: 2026-08-04/)).toBeInTheDocument();
  });

  it('con AI non configurata blocca "Genera con AI" e lo spiega nel titolo', () => {
    render(<WebGenerationActionsBar {...azioniVuote} aiUnavailable />);

    const bottone = screen.getByRole('button', { name: /Genera con AI/ });
    expect(bottone).toBeDisabled();
    expect(bottone).toHaveAttribute('title', 'AI non configurata lato server');
  });

  it('durante la generazione AI mostra l\'attesa', () => {
    render(<WebGenerationActionsBar {...azioniVuote} generatingAi />);

    expect(screen.getByRole('button', { name: 'Generazione AI...' })).toBeDisabled();
  });

  it('durante il salvataggio blocca sia "Salva" sia "Ricarica"', () => {
    render(<WebGenerationActionsBar {...azioniVuote} saving />);

    expect(screen.getByRole('button', { name: 'Salvataggio...' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Ricarica' })).toBeDisabled();
  });

  it('inoltra i click al padre, anche per le azioni avanzate', () => {
    const azioni = {
      ...azioniVuote,
      onGenerateBaseDraft: vi.fn(),
      onGenerateWireframe: vi.fn(),
      onSave: vi.fn(),
    };
    render(<WebGenerationActionsBar {...azioni} />);

    screen.getByRole('button', { name: 'Genera bozza base' }).click();
    screen.getByRole('button', { name: 'Wireframe' }).click();
    screen.getByRole('button', { name: 'Salva output Web' }).click();

    expect(azioni.onGenerateBaseDraft).toHaveBeenCalledTimes(1);
    expect(azioni.onGenerateWireframe).toHaveBeenCalledTimes(1);
    expect(azioni.onSave).toHaveBeenCalledTimes(1);
  });

  it('mostra la stima di costo solo quando l\'AI e\' configurata', () => {
    const stima = { minUsd: 0.01, maxUsd: 0.05, basis: 'estimate' };
    const { rerender } = render(<WebGenerationActionsBar {...azioniVuote} estimate={stima} aiConfigured={false} />);
    expect(screen.queryByRole('note')).not.toBeInTheDocument();

    rerender(<WebGenerationActionsBar {...azioniVuote} estimate={stima} aiConfigured />);
    expect(screen.getByRole('note')).toHaveTextContent('Costo stimato');
  });
});

describe('WebSubProjectsCard', () => {
  const props = {
    draft: EMPTY_WEB_PROJECT_DRAFT,
    onDraftChange: vi.fn(),
    onAddWebProject: vi.fn(),
    webProjects: [],
    onUpdateStatus: vi.fn(),
    onUseAsActive: vi.fn(),
    onGenerateAi: vi.fn(),
  };

  it('senza pagine mostra lo stato vuoto', () => {
    render(<WebSubProjectsCard {...props} />);

    expect(screen.getByText('Nessuna pagina creata.')).toBeInTheDocument();
  });

  it('elenca le pagine con i valori mancanti gia\' etichettati', () => {
    render(<WebSubProjectsCard {...props} webProjects={[
      { id: 'web_1', name: 'Landing consulenza', type: 'landing', goal: '', primaryCta: 'Prenota', status: 'draft' },
    ]} />);

    expect(screen.getByText('Landing consulenza')).toBeInTheDocument();
    expect(screen.getByText(/Goal da completare/)).toBeInTheDocument();
    expect(screen.getByText(/CTA: Prenota/)).toBeInTheDocument();
  });

  it('passa al padre la pagina su cui si e\' cliccato', () => {
    const onUseAsActive = vi.fn();
    const pagina = { id: 'web_1', name: 'Landing', type: 'landing', goal: 'Lead', primaryCta: 'Prenota', status: 'draft' };
    render(<WebSubProjectsCard {...props} webProjects={[pagina]} onUseAsActive={onUseAsActive} />);

    screen.getByRole('button', { name: 'Usa come pagina attiva' }).click();

    expect(onUseAsActive).toHaveBeenCalledWith(pagina);
  });

  it('con AI non configurata blocca solo il pulsante di generazione della riga', () => {
    render(<WebSubProjectsCard {...props} aiUnavailable webProjects={[
      { id: 'web_1', name: 'Landing', type: 'landing', goal: 'Lead', primaryCta: 'Prenota', status: 'draft' },
    ]} />);

    expect(screen.getByRole('button', { name: /Genera AI/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Crea pagina' })).not.toBeDisabled();
  });
});

describe('WebPageSettingsCard', () => {
  const output = {
    pageGoal: 'Generare richieste',
    pageType: 'landing',
    ctaSet: { primary: 'Prenota call' },
  };

  // I campi si cercano per etichetta: e' il modo che prova anche che label e
  // controllo siano davvero collegati (controlId sulla Form.Group), cosa che
  // serve a chi usa uno screen reader.
  it('mostra i valori correnti dei tre campi, cercati per etichetta', () => {
    render(<WebPageSettingsCard output={output} onFieldChange={vi.fn()} onGenerateBlock={vi.fn()} generatingBlockKey="" />);

    expect(screen.getByLabelText('Obiettivo pagina')).toHaveValue('Generare richieste');
    expect(screen.getByLabelText('Tipo pagina')).toHaveValue('landing');
    expect(screen.getByLabelText('CTA principale')).toHaveValue('Prenota call');
  });

  it('monta i sette pulsanti di rigenerazione per blocco', () => {
    render(<WebPageSettingsCard output={output} onFieldChange={vi.fn()} onGenerateBlock={vi.fn()} generatingBlockKey="" />);

    ['Hero', 'Benefici', 'FAQ', 'CTA', 'Trust', 'Wireframe', 'Struttura'].forEach((etichetta) => {
      expect(screen.getByRole('button', { name: new RegExp(`^${etichetta}$`) })).toBeInTheDocument();
    });
  });

  it('inoltra la chiave del blocco cliccato', () => {
    const onGenerateBlock = vi.fn();
    render(<WebPageSettingsCard output={output} onFieldChange={vi.fn()} onGenerateBlock={onGenerateBlock} generatingBlockKey="" />);

    screen.getByRole('button', { name: /^Hero$/ }).click();

    expect(onGenerateBlock).toHaveBeenCalledWith('hero');
  });
});

describe('WebGenerationContractPanel', () => {
  it('senza dati mancanti dichiara confidence alta', () => {
    render(<WebGenerationContractPanel aiConfigured missingLabels={[]} usedSources={['sito cliente']} />);

    expect(screen.getByText('alta')).toBeInTheDocument();
    expect(screen.getByText('AI disponibile')).toBeInTheDocument();
    expect(screen.getByText('sito cliente')).toBeInTheDocument();
    expect(screen.getByText('nessun blocco critico')).toBeInTheDocument();
  });

  it('scala la confidence col numero di dati mancanti', () => {
    const { rerender } = render(<WebGenerationContractPanel missingLabels={['a', 'b']} usedSources={[]} />);
    expect(screen.getByText('media')).toBeInTheDocument();

    rerender(<WebGenerationContractPanel missingLabels={['a', 'b', 'c']} usedSources={[]} />);
    expect(screen.getByText('bassa')).toBeInTheDocument();
  });

  it('senza AI configurata dichiara la bozza base, e segnala le fonti mancanti', () => {
    render(<WebGenerationContractPanel aiConfigured={false} missingLabels={[]} usedSources={[]} />);

    expect(screen.getByText('Bozza base dichiarata')).toBeInTheDocument();
    expect(screen.getByText('fonti mancanti')).toBeInTheDocument();
  });
});

describe('WebGenerationOutputPanels', () => {
  const outputVuoto = {
    sectionPlan: [],
    copyBlocks: {},
    ctaSet: { primary: '' },
    wireframe: { blocks: [] },
    previewHtmlBase: '',
  };

  it('a output vuoto mostra i quattro stati vuoti', () => {
    render(<Row><WebGenerationOutputPanels output={outputVuoto} /></Row>);

    expect(screen.getByText(/Nessuna struttura generata/)).toBeInTheDocument();
    expect(screen.getByText('Headline da generare')).toBeInTheDocument();
    expect(screen.getByText('Wireframe non ancora generato.')).toBeInTheDocument();
    expect(screen.getByText('Preview base non ancora generata.')).toBeInTheDocument();
  });

  it('a output pieno mostra sezioni, copy e wireframe', () => {
    render(<Row><WebGenerationOutputPanels output={{
      ...outputVuoto,
      sectionPlan: [{ key: 'hero', title: 'Hero', objective: 'Promessa chiara' }],
      copyBlocks: { headline: 'Titolo forte', subheadline: 'Sottotitolo', intro: 'Intro' },
      ctaSet: { primary: 'Prenota call' },
      wireframe: { blocks: ['Hero', 'Benefici'] },
    }} /></Row>);

    expect(screen.getByText('Hero', { selector: '.fw-semibold' })).toBeInTheDocument();
    expect(screen.getByText('Promessa chiara')).toBeInTheDocument();
    expect(screen.getByText('Titolo forte')).toBeInTheDocument();
    expect(screen.getByText(/Hero\s*\n?\s*Benefici/)).toBeInTheDocument();
  });

  it('la preview generata viene mostrata come HTML', () => {
    const { container } = render(<Row><WebGenerationOutputPanels output={{
      ...outputVuoto,
      previewHtmlBase: '<h1>Promessa</h1>',
    }} /></Row>);

    expect(container.querySelector('.agency-tile h1')).toHaveTextContent('Promessa');
  });
});
