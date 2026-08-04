import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Row } from 'react-bootstrap';
import AdsGenerationActionsBar from './AdsGenerationActionsBar';
import AdsInputCompletenessBanner from './AdsInputCompletenessBanner';
import AdsCampaignsCard from './AdsCampaignsCard';
import AdsInputQualityPanel from './AdsInputQualityPanel';
import AdsSettingsCard from './AdsSettingsCard';
import AdsOutputPanels from './AdsOutputPanels';
import { EMPTY_ADS_PROJECT_DRAFT } from './adsPageConstants';

// I riquadri specifici della pagina Ads: componenti di sola presentazione.

const azioni = () => ({
  onGenerateGoogle: vi.fn(),
  onGenerateMeta: vi.fn(),
  onGenerateOperational: vi.fn(),
  onRegenerateAll: vi.fn(),
  onGenerateAsset: vi.fn(),
  onReload: vi.fn(),
  onSave: vi.fn(),
});

describe('AdsGenerationActionsBar', () => {
  it('senza generazioni lo dice, e mostra il salvataggio solo se c\'e\'', () => {
    const { rerender } = render(<AdsGenerationActionsBar {...azioni()} />);
    expect(screen.getByText('Nessuna generazione registrata.')).toBeInTheDocument();
    expect(screen.queryByText(/Ultimo salvataggio/)).not.toBeInTheDocument();

    rerender(<AdsGenerationActionsBar {...azioni()} lastGeneratedAt="2026-08-04T09:00:00.000Z" lastUpdatedAt="2026-08-04T09:30:00.000Z" />);
    expect(screen.getByText(/Ultima generazione: 04\/08\/2026/)).toBeInTheDocument();
    expect(screen.getByText(/Ultimo salvataggio: 04\/08\/2026/)).toBeInTheDocument();
  });

  it('mostra le quattro azioni di bozza base in chiaro', () => {
    render(<AdsGenerationActionsBar {...azioni()} />);

    ['Genera Google Ads', 'Genera Meta Ads', 'Genera checklist', 'Rigenerazione controllata'].forEach((etichetta) => {
      expect(screen.getByRole('button', { name: etichetta })).toBeInTheDocument();
    });
  });

  it('i sei asset AI si rigenerano uno a uno e inoltrano la chiave', () => {
    const props = azioni();
    render(<AdsGenerationActionsBar {...props} />);

    ['Headline', 'Primary text', 'Keyword', 'Angoli creativi', 'Angolo offerta', 'Sitelink/callout'].forEach((etichetta) => {
      expect(screen.getByRole('button', { name: etichetta })).toBeInTheDocument();
    });

    screen.getByRole('button', { name: 'Keyword' }).click();
    expect(props.onGenerateAsset).toHaveBeenCalledWith('keywords');
  });

  it('con AI non configurata blocca gli asset ma non le bozze base', () => {
    render(<AdsGenerationActionsBar {...azioni()} aiUnavailable />);

    expect(screen.getByRole('button', { name: 'Headline' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Genera Google Ads' })).not.toBeDisabled();
  });

  it('mentre un asset genera, quello mostra l\'attesa e gli altri sono bloccati', () => {
    render(<AdsGenerationActionsBar {...azioni()} generatingAssetKey="headlines" />);

    expect(screen.getByRole('button', { name: 'Rigenerazione...' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Keyword' })).toBeDisabled();
  });

  it('durante il salvataggio blocca sia Salva sia Ricarica', () => {
    render(<AdsGenerationActionsBar {...azioni()} saving />);

    expect(screen.getByRole('button', { name: 'Salvataggio...' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Ricarica' })).toBeDisabled();
  });
});

describe('AdsInputCompletenessBanner', () => {
  it('a input completi usa il tono positivo e non elenca niente', () => {
    const { container } = render(<AdsInputCompletenessBanner tone="success" label="completo" missing={[]} />);

    expect(container.querySelector('.alert-success')).not.toBeNull();
    expect(screen.queryByText(/Mancano o sono deboli/)).not.toBeInTheDocument();
  });

  it('a input parziali cambia tono ed elenca cosa manca', () => {
    const { container } = render(<AdsInputCompletenessBanner tone="warning" label="input parziali" missing={['tracking', 'CTA']} />);

    expect(container.querySelector('.alert-warning')).not.toBeNull();
    expect(screen.getByText(/Mancano o sono deboli: tracking, CTA/)).toBeInTheDocument();
  });
});

describe('AdsCampaignsCard', () => {
  const props = () => ({
    draft: EMPTY_ADS_PROJECT_DRAFT,
    onDraftChange: vi.fn(),
    onAddAdsProject: vi.fn(),
    adsProjects: [],
    webProjects: [{ id: 'web_1', name: 'Landing consulenza' }],
    onUpdateStatus: vi.fn(),
    onOpenCampaign: vi.fn(),
  });

  it('senza campagne mostra lo stato vuoto', () => {
    render(<AdsCampaignsCard {...props()} />);

    expect(screen.getByText('Nessuna campagna creata.')).toBeInTheDocument();
  });

  it('elenca le landing disponibili nel menu, con la voce "nessuna"', () => {
    render(<AdsCampaignsCard {...props()} />);

    expect(screen.getByRole('option', { name: 'Nessuna landing' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Landing consulenza' })).toBeInTheDocument();
  });

  it('nella riga mostra il NOME della landing collegata, non il suo codice', () => {
    render(<AdsCampaignsCard {...props()} adsProjects={[
      { id: 'ads_1', name: 'Search brand', channel: 'google', campaignType: 'search', goal: 'Lead', linkedWebProjectId: 'web_1', status: 'draft' },
    ]} />);

    expect(screen.getByText(/landing: Landing consulenza/)).toBeInTheDocument();
  });

  it('se la landing collegata non esiste piu\', ripiega sul codice invece di sparire', () => {
    render(<AdsCampaignsCard {...props()} webProjects={[]} adsProjects={[
      { id: 'ads_1', name: 'Search brand', channel: 'google', goal: '', linkedWebProjectId: 'web_sparita', status: 'draft' },
    ]} />);

    expect(screen.getByText(/landing: web_sparita/)).toBeInTheDocument();
  });

  it('senza landing collegata non mostra la parte "landing:"', () => {
    render(<AdsCampaignsCard {...props()} adsProjects={[
      { id: 'ads_1', name: 'Search brand', channel: 'google', goal: '', linkedWebProjectId: '', status: 'draft' },
    ]} />);

    expect(screen.queryByText(/landing:/)).not.toBeInTheDocument();
    expect(screen.getByText(/Goal da completare/)).toBeInTheDocument();
  });

  it('passa al padre la campagna su cui si e\' cliccato', () => {
    const p = props();
    const campagna = { id: 'ads_1', name: 'Search brand', channel: 'google', goal: 'Lead', linkedWebProjectId: '', status: 'draft' };
    render(<AdsCampaignsCard {...p} adsProjects={[campagna]} />);

    screen.getByRole('button', { name: 'Apri/Genera' }).click();

    expect(p.onOpenCampaign).toHaveBeenCalledWith(campagna);
  });
});

describe('AdsInputQualityPanel', () => {
  const input = {
    projectType: { label: 'Solo Ads' },
    contextSummary: 'Contesto',
    discovery: { sections: { target: 'PMI edili', offer: 'Consulenza' } },
    activeModules: [{ label: 'Ads', active: true }, { label: 'Web', active: false }],
  };

  it('mostra i requisiti e solo i moduli attivi', () => {
    render(<AdsInputQualityPanel input={input} linkedLanding="landing | Raccogliere richieste" />);

    expect(screen.getByText(/PMI edili/)).toBeInTheDocument();
    expect(screen.getByText(/landing \| Raccogliere richieste/)).toBeInTheDocument();

    // "Web" e' fra i moduli ma non e' attivo: non deve comparire nella riga.
    const rigaModuli = screen.getByText('Moduli attivi:').closest('div');
    expect(rigaModuli).toHaveTextContent('Moduli attivi: Ads');
    expect(rigaModuli).not.toHaveTextContent('Web');
  });

  it('NON chiude con un riquadro di giudizio (a differenza della pagina Web)', () => {
    const { container } = render(<AdsInputQualityPanel input={input} linkedLanding="Nessun output Web persistito" />);

    expect(container.querySelector('.alert')).toBeNull();
  });
});

describe('AdsSettingsCard', () => {
  const output = {
    channelScope: 'both',
    campaignGoal: 'lead_generation',
    targetingSummary: 'PMI Piemonte',
    offerAngle: 'Canone mensile',
  };

  it('mostra i campi per etichetta, con i valori correnti', () => {
    render(<AdsSettingsCard output={output} onFieldChange={vi.fn()} ctaPrimary="Prenota call" linkedLanding="landing | Goal" />);

    expect(screen.getByLabelText('Canale')).toHaveValue('both');
    expect(screen.getByLabelText('Obiettivo campagna')).toHaveValue('lead_generation');
    expect(screen.getByLabelText('Sintesi targeting')).toHaveValue('PMI Piemonte');
    expect(screen.getByLabelText('Angolo offerta')).toHaveValue('Canone mensile');
  });

  it('CTA e landing arrivano dal modulo Web e non si modificano qui', () => {
    render(<AdsSettingsCard output={output} onFieldChange={vi.fn()} ctaPrimary="Prenota call" linkedLanding="landing | Goal" />);

    expect(screen.getByLabelText('CTA principale')).toHaveAttribute('readonly');
    expect(screen.getByLabelText('Landing collegata')).toHaveAttribute('readonly');
  });

  it('senza CTA dal Web mostra l\'etichetta di completamento invece del vuoto', () => {
    render(<AdsSettingsCard output={output} onFieldChange={vi.fn()} ctaPrimary="" linkedLanding="Nessun output Web persistito" />);

    expect(screen.getByLabelText('CTA principale')).toHaveValue('Da completare');
  });
});

describe('AdsOutputPanels', () => {
  const outputVuoto = {
    channelScope: 'both',
    campaignGoal: 'lead_generation',
    notes: '',
    adCopyBlocks: { google: [], meta: [] },
    googleAds: { campaignType: '', campaignStructure: '', adGroups: [], keywordSeeds: [], negativeSeeds: [], extensionsIdeas: [], rsaIdeas: [], landingRecommendation: '' },
    metaAds: { campaignAngle: '', audienceIdeas: [], creativeAngles: [], hooks: [], primaryTexts: [], headlines: [], ctaIdeas: [], assetRequests: [] },
    messageHooks: [],
    launchChecklist: [],
    assetRequests: [],
  };
  const input = {
    alerts: [{ id: 'a' }, { id: 'b' }],
    opportunities: [{ id: 'o' }],
    web: { available: false, landingRecommendationBase: '' },
  };

  const monta = (output = outputVuoto) => render(
    <Row>
      <AdsOutputPanels output={output} input={input} completenessLabel="input parziali" onFieldChange={vi.fn()} />
    </Row>,
  );

  it('a output vuoto mostra i sei riquadri con i loro stati vuoti', () => {
    monta();

    expect(screen.getByText('Google Ads')).toBeInTheDocument();
    expect(screen.getByText('Meta Ads')).toBeInTheDocument();
    expect(screen.getByText('Ad group non ancora definiti.')).toBeInTheDocument();
    expect(screen.getByText('RSA ideas non ancora disponibili.')).toBeInTheDocument();
    expect(screen.getByText('Checklist launch non ancora disponibile.')).toBeInTheDocument();
    expect(screen.getByText('Nessuna richiesta asset ancora generata.')).toBeInTheDocument();
    expect(screen.getByText('Nessun hook messaggio ancora generato.')).toBeInTheDocument();
  });

  it('traduce canale e obiettivo in etichette leggibili', () => {
    monta();

    expect(screen.getByText('Google + Meta')).toBeInTheDocument();
    expect(screen.getByText('Lead generation')).toBeInTheDocument();
  });

  it('riporta il conteggio di alert e opportunita e lo stato del modulo Web', () => {
    monta();

    // getByText coglie il <strong>: il numero sta accanto, nella riga.
    expect(screen.getByText('Alert disponibili:').closest('div')).toHaveTextContent('Alert disponibili: 2');
    expect(screen.getByText('Opportunita disponibili:').closest('div')).toHaveTextContent('Opportunita disponibili: 1');
    expect(screen.getByText('Output Web disponibile:').closest('div')).toHaveTextContent('Output Web disponibile: No');
  });

  it('a output pieno mostra ad group, RSA e checklist', () => {
    monta({
      ...outputVuoto,
      googleAds: {
        ...outputVuoto.googleAds,
        campaignType: 'search',
        adGroups: [{ name: 'Brand', intent: 'Intercettare il marchio', keywords: ['kw1'] }],
        rsaIdeas: [{ headlines: ['H1'], descriptions: ['D1'] }],
      },
      launchChecklist: [{ key: 'pixel', label: 'Verifica pixel', channel: 'meta', status: 'da fare' }],
    });

    expect(screen.getByText('Brand')).toBeInTheDocument();
    expect(screen.getByText('Intercettare il marchio')).toBeInTheDocument();
    expect(screen.getByText('RSA Idea 1')).toBeInTheDocument();
    expect(screen.getByText('Verifica pixel')).toBeInTheDocument();
  });

  it('le note del modulo si trovano per etichetta e riportano il valore corrente', () => {
    monta({ ...outputVuoto, notes: 'Chiedere le foto al cliente' });

    expect(screen.getByLabelText('Note modulo Ads')).toHaveValue('Chiedere le foto al cliente');
  });
});
