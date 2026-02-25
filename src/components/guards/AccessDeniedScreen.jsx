import React from 'react';
import { ShieldAlert } from 'lucide-react';
import { Button, Card } from 'react-bootstrap';
import { useHistory } from 'react-router-dom';

const AccessDeniedScreen = () => {
    const history = useHistory();

    return (
        <Card className="card-border">
            <Card.Body className="py-5 text-center">
                <span
                    className="d-inline-flex align-items-center justify-content-center mb-3 rounded-circle bg-light text-danger"
                    style={{ width: 52, height: 52 }}
                >
                    <ShieldAlert size={22} />
                </span>
                <h5 className="mb-2">Non hai permessi</h5>
                <p className="mb-4 text-muted">Il tuo ruolo non permette questa operazione in questo workspace.</p>
                <Button variant="outline-secondary" onClick={() => history.goBack()}>
                    Torna indietro
                </Button>
            </Card.Body>
        </Card>
    );
};

export default AccessDeniedScreen;
