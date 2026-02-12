import React from 'react';
import { Spinner } from 'react-bootstrap';

const LoadingState = ({ message = 'Caricamento in corso...' }) => {
    return (
        <div className="d-flex align-items-center py-4">
            <Spinner animation="border" size="sm" className="me-2" role="status" />
            <span>{message}</span>
        </div>
    );
};

export default LoadingState;
