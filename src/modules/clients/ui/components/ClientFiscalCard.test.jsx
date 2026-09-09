import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import ClientFiscalCard from './ClientFiscalCard';

describe('ClientFiscalCard', () => {
    it('mostra PEC e codice destinatario SDI accanto ai dati fiscali di prima', () => {
        render(
            <ClientFiscalCard
                client={{
                    vatNumber: '01234567890',
                    taxCode: 'RSSGPP80A01H501U',
                    pecEmail: 'beppe@pec.it',
                    sdiCode: 'ABC1234',
                }}
            />,
        );

        expect(screen.getByText('PEC')).toBeInTheDocument();
        expect(screen.getByText('beppe@pec.it')).toBeInTheDocument();
        expect(screen.getByText('Codice destinatario SDI')).toBeInTheDocument();
        expect(screen.getByText('ABC1234')).toBeInTheDocument();
        expect(screen.getByText('01234567890')).toBeInTheDocument();
    });

    it('salta le righe vuote invece di mostrarle senza valore', () => {
        render(<ClientFiscalCard client={{ pecEmail: 'beppe@pec.it' }} />);

        expect(screen.getByText('PEC')).toBeInTheDocument();
        expect(screen.queryByText('P.IVA')).not.toBeInTheDocument();
        expect(screen.queryByText('Codice destinatario SDI')).not.toBeInTheDocument();
    });

    it('un cliente senza nessun dato fiscale lo dice, invece di mostrare una lista vuota', () => {
        render(<ClientFiscalCard client={{}} />);

        expect(screen.getByText('Non impostato')).toBeInTheDocument();
    });
});
