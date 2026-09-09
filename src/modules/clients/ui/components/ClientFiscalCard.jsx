import React from 'react';
import { Card } from 'react-bootstrap';
import { ReceiptText } from 'lucide-react';

// I dati con cui si fattura, nella scheda del cliente. Sta in un file suo
// perche' ClientDetail.jsx era arrivato a ridosso della soglia delle 500 righe:
// e' il blocco cresciuto con PEC e codice destinatario SDI, quindi e' quello
// che se ne va. Il ridisegno della pagina a schede resta V12: qui non si cambia
// l'aspetto, si sposta soltanto.
const RIGHE = [
    { chiave: 'vatNumber', etichetta: 'P.IVA' },
    { chiave: 'taxCode', etichetta: 'Codice fiscale' },
    { chiave: 'pecEmail', etichetta: 'PEC' },
    { chiave: 'sdiCode', etichetta: 'Codice destinatario SDI' },
];

const ClientFiscalCard = ({ client }) => {
    const compilate = RIGHE.filter(({ chiave }) => client?.[chiave]);

    return (
        <Card className="card-border mb-3">
            <Card.Header className="bg-transparent">
                <h6 className="mb-0 d-inline-flex align-items-center gap-2">
                    <ReceiptText size={15} />
                    Dati fiscali
                </h6>
            </Card.Header>
            <Card.Body>
                {compilate.length > 0 ? (
                    <ul className="clients-detail-list">
                        {compilate.map(({ chiave, etichetta }) => (
                            <li key={chiave}>
                                <span className="text-muted">{etichetta}</span>
                                <span>{client[chiave]}</span>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <div className="text-muted">Non impostato</div>
                )}
            </Card.Body>
        </Card>
    );
};

export default ClientFiscalCard;
