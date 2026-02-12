import React from 'react';
import { Alert, Button } from 'react-bootstrap';

const ErrorState = ({ title = 'Errore nel caricamento dati', message, onRetry }) => {
    return (
        <Alert variant="danger" className="d-flex justify-content-between align-items-center gap-3 mb-0">
            <div>
                <div className="fw-semibold">{title}</div>
                {message && <div className="small">{message}</div>}
            </div>
            {typeof onRetry === 'function' && (
                <Button variant="outline-danger" size="sm" onClick={() => void onRetry()}>
                    Riprova
                </Button>
            )}
        </Alert>
    );
};

export default ErrorState;
