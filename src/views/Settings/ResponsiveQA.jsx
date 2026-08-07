import React from 'react';
import { Card } from 'react-bootstrap';
import { Link } from 'react-router-dom';

const QA_LINKS = [
    { label: 'Dashboard', path: '/dashboard' },
    { label: 'Clienti', path: '/apps/clients' },
    { label: 'Progetti', path: '/projects' },
    { label: 'Messaggi', path: '/apps/email' },
    { label: 'Preventivi', path: '/apps/quotes' },
    { label: 'Siti in gestione', path: '/apps/web-assets' },
    { label: 'Credenziali', path: '/apps/vault' },
    { label: 'Team', path: '/apps/team' },
    { label: 'Calendario', path: '/apps/calendar' },
    { label: 'Audit', path: '/audit' },
];

const ResponsiveQAPage = () => {
    const isDev = Boolean(import.meta.env.DEV);

    return (
        <div className="container-fluid py-4">
            <Card className="card-border">
                <Card.Body>
                    <h4 className="mb-2">Responsive QA</h4>
                    <p className="text-muted mb-3">
                        Verifica veloce ai breakpoint 320 / 375 / 768 / 1024.
                    </p>

                    {!isDev && (
                        <div className="alert alert-warning py-2 mb-3">
                            Pagina QA pensata per ambiente di sviluppo.
                        </div>
                    )}

                    <div className="d-grid gap-2">
                        {QA_LINKS.map((entry) => (
                            <Link key={entry.path} to={entry.path} className="btn btn-outline-secondary text-start">
                                {entry.label}
                            </Link>
                        ))}
                    </div>
                </Card.Body>
            </Card>
        </div>
    );
};

export default ResponsiveQAPage;
