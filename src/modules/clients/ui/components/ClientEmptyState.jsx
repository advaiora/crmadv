import React from 'react';
import { Button, Card } from 'react-bootstrap';
import { SearchX, Users } from 'lucide-react';

const ClientEmptyState = ({
    mode = 'empty',
    query = '',
    canCreate = false,
    onCreate,
    onReset,
}) => {
    const isSearch = mode === 'search';
    const Icon = isSearch ? SearchX : Users;

    return (
        <Card className="card-border clients-empty-state">
            <Card.Body className="text-center py-5">
                <div className="clients-empty-icon mb-3">
                    <Icon size={24} />
                </div>
                <h5 className="mb-2">
                    {isSearch ? 'Nessun risultato trovato' : 'Ancora nessun cliente'}
                </h5>
                <p className="text-muted mb-3">
                    {isSearch
                        ? `Nessun risultato per "${query}". Prova a cambiare i filtri.`
                        : 'Inizia creando la prima anagrafica cliente per questo workspace.'}
                </p>
                <div className="d-flex flex-wrap justify-content-center gap-2">
                    {isSearch && (
                        <Button variant="outline-secondary" onClick={onReset}>
                            Reset filtri
                        </Button>
                    )}
                    {!isSearch && canCreate && (
                        <Button onClick={onCreate}>
                            Crea primo cliente
                        </Button>
                    )}
                </div>
            </Card.Body>
        </Card>
    );
};

export default ClientEmptyState;
