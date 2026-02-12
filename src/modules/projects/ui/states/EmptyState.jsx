import React from 'react';
import { Card } from 'react-bootstrap';

const EmptyState = ({ title = 'Nessun progetto trovato', description }) => {
    return (
        <Card className="card-border">
            <Card.Body className="py-4 text-center">
                <h6 className="mb-2">{title}</h6>
                {description && <p className="text-muted mb-0">{description}</p>}
            </Card.Body>
        </Card>
    );
};

export default EmptyState;
