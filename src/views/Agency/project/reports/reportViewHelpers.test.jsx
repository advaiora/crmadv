import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { renderStringList } from './reportViewHelpers';

// La cosa che questi test presidiano davvero e' `blockClassName`: e' l'unico
// aggancio del foglio di stampa del report cliente (.agency-client-report-block).
// Se salta, i riquadri perdono il bordo SOLO su carta e in PDF — cioe' in un
// output che durante lo sviluppo nessuno guarda, e che e' proprio quello per cui
// la vista cliente esiste.

describe('renderStringList', () => {
  it('mostra una voce per ogni frase', () => {
    render(<div>{renderStringList(['Landing pubblicata', 'Tracking attivo'], 'Niente')}</div>);

    expect(screen.getByText('Landing pubblicata')).toBeInTheDocument();
    expect(screen.getByText('Tracking attivo')).toBeInTheDocument();
  });

  it('con la lista vuota mostra il testo di ripiego', () => {
    render(<div>{renderStringList([], 'Nessuna attivita da mostrare.')}</div>);

    expect(screen.getByText('Nessuna attivita da mostrare.')).toBeInTheDocument();
  });

  it('non esplode se al posto della lista arriva altro', () => {
    render(<div>{renderStringList(undefined, 'Niente')}</div>);

    expect(screen.getByText('Niente')).toBeInTheDocument();
  });

  it('applica la classe di stampa quando gliela si passa', () => {
    render(<div>{renderStringList(['Voce'], 'Niente', 'agency-client-report-block')}</div>);

    expect(screen.getByText('Voce')).toHaveClass('agency-client-report-block');
  });

  it('senza classe di stampa i blocchi restano puliti', () => {
    // La vista tecnica non stampa: non deve trascinarsi dietro la classe ne'
    // uno spazio in coda alla lista di classi.
    render(<div>{renderStringList(['Voce'], 'Niente')}</div>);

    const blocco = screen.getByText('Voce');
    expect(blocco).not.toHaveClass('agency-client-report-block');
    expect(blocco.getAttribute('class')).toBe('border rounded-3 p-2 small');
  });
});
