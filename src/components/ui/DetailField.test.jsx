// Test di render di DetailField — primo smoke test di un componente del progetto.
// Componente foglia senza dipendenze: si monta senza provider ne' router.
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import DetailField from './DetailField';

const IconaFinta = ({ size }) => <svg data-testid="icona-campo" width={size} />;

describe('DetailField', () => {
  it('rende etichetta e valore', () => {
    render(<DetailField label="Email">info@advaiora.com</DetailField>);
    expect(screen.getByText('Email')).toBeInTheDocument();
    expect(screen.getByText('info@advaiora.com')).toBeInTheDocument();
  });

  it('di default non occupa tutta la riga', () => {
    const { container } = render(<DetailField label="Telefono">123</DetailField>);
    expect(container.firstChild).toHaveClass('ui-detail-field');
    expect(container.firstChild).not.toHaveClass('ui-detail-field--full');
  });

  it('con fullWidth aggiunge la classe --full', () => {
    const { container } = render(
      <DetailField label="Note" fullWidth>
        testo lungo
      </DetailField>,
    );
    expect(container.firstChild).toHaveClass('ui-detail-field--full');
  });

  it('rende l\'icona quando fornita, con la taglia fissa 14', () => {
    render(
      <DetailField icon={IconaFinta} label="Sito">
        example.com
      </DetailField>,
    );
    expect(screen.getByTestId('icona-campo')).toHaveAttribute('width', '14');
  });

  it('senza icona non rende nessun elemento icona', () => {
    render(<DetailField label="Sito">example.com</DetailField>);
    expect(screen.queryByTestId('icona-campo')).not.toBeInTheDocument();
  });
});
