import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import ClientRowDetails from './ClientRowDetails';

const cliente = {
  vatNumber: '01234567890',
  taxCode: 'RSSGPP80A01H501U',
  pecEmail: 'beppe@pec.it',
  sdiCode: 'ABC1234',
  website: 'www.dabeppe.it',
  contactPerson: 'Giuseppe Rossi',
};

describe('ClientRowDetails', () => {
  it('mostra i quattro campi nuovi con la loro etichetta italiana', () => {
    render(<ClientRowDetails client={cliente} />);

    expect(screen.getByText('PEC')).toBeInTheDocument();
    expect(screen.getByText('beppe@pec.it')).toBeInTheDocument();
    expect(screen.getByText('Codice destinatario SDI')).toBeInTheDocument();
    expect(screen.getByText('ABC1234')).toBeInTheDocument();
    expect(screen.getByText('Sito web')).toBeInTheDocument();
    expect(screen.getByText('www.dabeppe.it')).toBeInTheDocument();
    expect(screen.getByText('Referente')).toBeInTheDocument();
    expect(screen.getByText('Giuseppe Rossi')).toBeInTheDocument();
  });

  it('un cliente senza i campi nuovi li mostra vuoti, non rotti', () => {
    render(<ClientRowDetails client={{ vatNumber: '01234567890' }} />);

    expect(screen.getByText('PEC')).toBeInTheDocument();
    // Quattro campi nuovi vuoti + codice fiscale: CopyField scrive "Non impostato".
    expect(screen.getAllByText('Non impostato')).toHaveLength(5);
  });
});
