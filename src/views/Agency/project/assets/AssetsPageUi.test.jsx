import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import AssetsActionsBar from './AssetsActionsBar';
import AssetsSourceStatusAlert from './AssetsSourceStatusAlert';
import AssetsNotesCard from './AssetsNotesCard';
import AssetsUrlsCard from './AssetsUrlsCard';
import AssetsUploadQueueList from './AssetsUploadQueueList';
import AssetsUploadedFilesList from './AssetsUploadedFilesList';
import AssetsCompetitorSuggestions from './AssetsCompetitorSuggestions';
import AssetsCompetitorsCard from './AssetsCompetitorsCard';

describe('AssetsActionsBar', () => {
  it('mostra il giudizio sulle fonti col colore che gli corrisponde', () => {
    render(<AssetsActionsBar status="ready" summary="Tutto registrato." onReload={vi.fn()} onSave={vi.fn()} />);

    expect(screen.getByText(/Fonti pronte/)).toBeInTheDocument();
    expect(screen.getByText('Tutto registrato.')).toBeInTheDocument();
  });

  it('mentre salva blocca il pulsante e lo dice', () => {
    render(<AssetsActionsBar status="partial" summary="" saving onReload={vi.fn()} onSave={vi.fn()} />);

    expect(screen.getByRole('button', { name: /Salvataggio/ })).toBeDisabled();
  });

  it('inoltra ricarica e salvataggio', () => {
    const onReload = vi.fn();
    const onSave = vi.fn();
    render(<AssetsActionsBar status="ready" summary="" onReload={onReload} onSave={onSave} />);

    screen.getByRole('button', { name: 'Ricarica' }).click();
    screen.getByRole('button', { name: 'Aggiorna fonti' }).click();

    expect(onReload).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledTimes(1);
  });
});

describe('AssetsSourceStatusAlert', () => {
  it('senza fonti e\' un avviso rosso, con fonti parziali e\' giallo', () => {
    const { container, rerender } = render(<AssetsSourceStatusAlert status="missing" />);
    expect(container.querySelector('.alert-danger')).toBeInTheDocument();

    rerender(<AssetsSourceStatusAlert status="partial" />);
    expect(container.querySelector('.alert-warning')).toBeInTheDocument();
  });

  it('a fonti pronte non mostra niente', () => {
    const { container } = render(<AssetsSourceStatusAlert status="ready" />);

    expect(container).toBeEmptyDOMElement();
  });
});

describe('AssetsNotesCard', () => {
  it('l\'etichetta e\' collegata alla casella e il testo arriva a chi lo riceve', () => {
    const onNotesChange = vi.fn();
    render(<AssetsNotesCard notes="Appunti" onNotesChange={onNotesChange} />);

    const casella = screen.getByLabelText('Brief grezzo / note');
    expect(casella).toHaveValue('Appunti');

    fireEvent.change(casella, { target: { value: 'Nuovi appunti' } });
    expect(onNotesChange).toHaveBeenCalledWith('Nuovi appunti');
  });
});

describe('AssetsUrlsCard', () => {
  const urls = [
    { id: 'url_1', url: 'https://cliente.it', type: 'website', label: 'Sito', status: 'active', notes: '' },
    { id: 'url_2', url: 'https://landing.it', type: 'landing', label: '', status: 'active', notes: '' },
  ];

  const monta = (overrides = {}) => render(
    <AssetsUrlsCard
      urls={urls}
      primaryWebsiteUrl="https://cliente.it"
      websiteUrl="https://cliente.it"
      onAddUrl={vi.fn()}
      onUpdateUrl={vi.fn()}
      onRemoveUrl={vi.fn()}
      onSetPrimaryUrl={vi.fn()}
      competitorUrlsText=""
      onCompetitorUrlsTextChange={vi.fn()}
      {...overrides}
    />,
  );

  it('segnala quale riga e\' il sito principale', () => {
    const { container } = monta();

    // Si cercano i badge, non un testo qualsiasi: "Sito principale" e
    // "Landing" compaiono anche fra le voci del menu a tendina del tipo.
    const badge = Array.from(container.querySelectorAll('.badge')).map((entry) => entry.textContent);
    expect(badge).toEqual(['Sito principale', 'Landing']);
  });

  it('senza indirizzi invita ad aggiungerne uno', () => {
    monta({ urls: [] });

    expect(screen.getByText(/Nessun URL registrato/)).toBeInTheDocument();
  });

  it('ogni riga ha le sue etichette collegate, distinte fra righe', () => {
    monta();

    // Due righe, due campi "URL": si distinguono per il valore, non per un id
    // ripetuto.
    const campi = screen.getAllByLabelText('URL');
    expect(campi).toHaveLength(2);
    expect(campi[0]).toHaveValue('https://cliente.it');
    expect(campi[1]).toHaveValue('https://landing.it');
  });

  it('cambiando il tipo propone l\'etichetta corrispondente se non c\'era', () => {
    const onUpdateUrl = vi.fn();
    monta({ onUpdateUrl });

    fireEvent.change(screen.getAllByLabelText('Tipo')[1], { target: { value: 'instagram' } });

    expect(onUpdateUrl).toHaveBeenCalledWith('url_2', { type: 'instagram', label: 'Instagram' });
  });

  it('la casella dei competitor rapidi e\' cablata anche se sta nella card degli URL', () => {
    const onCompetitorUrlsTextChange = vi.fn();
    monta({ onCompetitorUrlsTextChange });

    fireEvent.change(screen.getByLabelText('Competitor URL rapidi'), { target: { value: 'https://rivale.it' } });

    expect(onCompetitorUrlsTextChange).toHaveBeenCalledWith('https://rivale.it');
  });
});

describe('AssetsUploadQueueList', () => {
  it('a coda vuota non mostra niente', () => {
    const { container } = render(<AssetsUploadQueueList queue={[]} onUpload={vi.fn()} onClear={vi.fn()} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('mostra dimensione, stato e motivo dello scarto', () => {
    render(<AssetsUploadQueueList
      queue={[
        { id: 'q1', name: 'brief.pdf', size: 2048, status: 'queued', error: '' },
        { id: 'q2', name: 'enorme.pdf', size: 0, status: 'failed', error: 'Il file supera 20 MB.' },
      ]}
      onUpload={vi.fn()}
      onClear={vi.fn()}
    />);

    expect(screen.getByText('2.0 KB')).toBeInTheDocument();
    expect(screen.getByText('In coda')).toBeInTheDocument();
    expect(screen.getByText('Il file supera 20 MB.')).toBeInTheDocument();
  });

  it('con soli file scartati non si puo\' caricare niente', () => {
    render(<AssetsUploadQueueList
      queue={[{ id: 'q2', name: 'enorme.pdf', size: 0, status: 'failed', error: 'troppo grande' }]}
      onUpload={vi.fn()}
      onClear={vi.fn()}
    />);

    expect(screen.getByRole('button', { name: 'Carica file in coda' })).toBeDisabled();
  });

  it('mentre carica blocca sia il caricamento sia la pulizia', () => {
    render(<AssetsUploadQueueList
      queue={[{ id: 'q1', name: 'brief.pdf', size: 10, status: 'queued' }]}
      uploading
      onUpload={vi.fn()}
      onClear={vi.fn()}
    />);

    expect(screen.getByRole('button', { name: 'Pulisci coda' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Caricamento/ })).toBeDisabled();
  });
});

describe('AssetsUploadedFilesList', () => {
  const monta = (files) => render(
    <AssetsUploadedFilesList
      files={files}
      fileActionId=""
      onUpdateMetadata={vi.fn()}
      onOpenOrDownload={vi.fn()}
      onRemove={vi.fn()}
    />,
  );

  it('senza file lo dice', () => {
    monta([]);

    expect(screen.getByText(/Nessun file registrato/)).toBeInTheDocument();
  });

  it('e\' annunciato come elenco', () => {
    monta([{ id: 'f1', name: 'brief.pdf', size: 1024, parseStatus: 'parsed' }]);

    expect(screen.getByRole('list', { name: 'File allegati al progetto' })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
  });

  it('offre il testo manuale solo quando la lettura non e\' riuscita del tutto', () => {
    monta([{ id: 'f1', name: 'letto.pdf', parseStatus: 'parsed' }]);
    expect(screen.queryByText('Aggiungi testo manuale da questo file')).not.toBeInTheDocument();

    monta([{ id: 'f2', name: 'illeggibile.doc', parseStatus: 'unsupported' }]);
    expect(screen.getByText('Aggiungi testo manuale da questo file')).toBeInTheDocument();
  });

  it('scrivere testo manuale marca da solo il file come fonte utile', () => {
    const onUpdateMetadata = vi.fn();
    render(<AssetsUploadedFilesList
      files={[{ id: 'f1', name: 'illeggibile.doc', parseStatus: 'failed' }]}
      fileActionId=""
      onUpdateMetadata={onUpdateMetadata}
      onOpenOrDownload={vi.fn()}
      onRemove={vi.fn()}
    />);

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Punti chiave' } });

    expect(onUpdateMetadata).toHaveBeenCalledWith('f1', { manualText: 'Punti chiave', markedUseful: true });
  });

  it('un materiale senza file non si puo\' aprire ne\' scaricare', () => {
    monta([{ id: 'f1', name: 'Brochure di carta', status: 'metadata_only' }]);

    expect(screen.getByRole('button', { name: 'Apri' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Scarica' })).toBeDisabled();
  });

  it('taglia l\'anteprima lunga e lo segnala con i puntini', () => {
    monta([{ id: 'f1', name: 'lungo.txt', parseStatus: 'parsed', extractedTextPreview: 'a'.repeat(900) }]);

    expect(screen.getByText(/a{700}\.\.\./)).toBeInTheDocument();
  });
});

describe('AssetsCompetitorSuggestions', () => {
  it('senza suggerimenti non mostra niente', () => {
    const { container } = render(<AssetsCompetitorSuggestions suggestions={[]} onConfirm={vi.fn()} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('senza nome ricava il nome dal dominio e mostra l\'affidabilita\'', () => {
    render(<AssetsCompetitorSuggestions
      suggestions={[{ id: 's1', url: 'https://www.rivale.it', confidence: 0.82 }]}
      onConfirm={vi.fn()}
    />);

    expect(screen.getByText('rivale.it')).toBeInTheDocument();
    expect(screen.getByText(/82%/)).toBeInTheDocument();
  });

  it('conferma il suggerimento su cui si e\' cliccato', () => {
    const onConfirm = vi.fn();
    const suggerimento = { id: 's1', name: 'Rivale', url: 'https://rivale.it' };
    render(<AssetsCompetitorSuggestions suggestions={[suggerimento]} onConfirm={onConfirm} />);

    screen.getByRole('button', { name: 'Conferma' }).click();

    expect(onConfirm).toHaveBeenCalledWith(suggerimento);
  });
});

describe('AssetsCompetitorsCard', () => {
  const monta = (overrides = {}) => render(
    <AssetsCompetitorsCard
      competitors={[]}
      searchResult={null}
      suggestions={[]}
      onRunSearch={vi.fn()}
      onConfirmSuggestion={vi.fn()}
      draft={{ name: '', url: '', reason: '' }}
      onDraftChange={vi.fn()}
      onAddManual={vi.fn()}
      onUpdateStatus={vi.fn()}
      onRemove={vi.fn()}
      {...overrides}
    />,
  );

  it('senza competitor la tabella lo dice invece di restare vuota', () => {
    monta();

    expect(screen.getByText(/Nessun competitor strutturato/)).toBeInTheDocument();
  });

  it('mostra fonte e stato di ogni competitor', () => {
    monta({
      competitors: [{ id: 'c1', name: 'Rivale', url: 'https://rivale.it', source: 'ai_search', status: 'suggested' }],
    });

    expect(screen.getByText('Ricerca AI')).toBeInTheDocument();
    expect(screen.getByText('Suggerito')).toBeInTheDocument();
  });

  it('l\'esito della ricerca prende il colore che gli spetta', () => {
    const { container } = monta({ searchResult: { providerStatus: 'configured_error' } });

    expect(container.querySelector('.alert-danger')).toBeInTheDocument();
    expect(screen.getByText('Ricerca non riuscita.')).toBeInTheDocument();
  });

  it('mentre cerca blocca il pulsante', () => {
    monta({ searching: true });

    expect(screen.getByRole('button', { name: /Ricerca\.\.\./ })).toBeDisabled();
  });

  it('inoltra il cambio di stato e la rimozione con l\'identificativo giusto', () => {
    const onUpdateStatus = vi.fn();
    const onRemove = vi.fn();
    monta({
      competitors: [{ id: 'c1', name: 'Rivale', url: 'https://rivale.it', source: 'manual', status: 'confirmed' }],
      onUpdateStatus,
      onRemove,
    });

    screen.getByRole('button', { name: 'Rifiuta' }).click();
    screen.getByRole('button', { name: 'Rimuovi' }).click();

    expect(onUpdateStatus).toHaveBeenCalledWith('c1', 'rejected');
    expect(onRemove).toHaveBeenCalledWith('c1');
  });

  it('il form manuale inoltra i campi uno per uno', () => {
    const onDraftChange = vi.fn();
    monta({ onDraftChange });

    fireEvent.change(screen.getByPlaceholderText('https://competitor.it'), { target: { value: 'https://rivale.it' } });

    expect(onDraftChange).toHaveBeenCalledWith('url', 'https://rivale.it');
  });
});
