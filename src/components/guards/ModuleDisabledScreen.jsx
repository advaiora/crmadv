import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button, Card } from 'react-bootstrap';
import { Link } from 'react-router-dom';

const ModuleDisabledScreen = ({ moduleName = 'questo modulo' }) => {
    return (
        <Card className="card-border">
            <Card.Body className="py-5 text-center">
                <span
                    className="d-inline-flex align-items-center justify-content-center mb-3 rounded-circle bg-light text-warning"
                    style={{ width: 52, height: 52 }}
                >
                    <AlertTriangle size={22} />
                </span>
                <h5 className="mb-2">Modulo disabilitato</h5>
                <p className="mb-4 text-muted">Il modulo {moduleName} non e attivo per questo workspace.</p>
                <Button as={Link} to="/dashboard" variant="outline-secondary">
                    Torna alla dashboard
                </Button>
            </Card.Body>
        </Card>
    );
};

export default ModuleDisabledScreen;
