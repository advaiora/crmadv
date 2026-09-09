import React from 'react';
import { Card, Form } from 'react-bootstrap';
import { StickyNote } from 'lucide-react';

/** Sezione 5 del form cliente: le note libere. */
const ClientNotesSection = ({ value, onChange, loading = false }) => (
    <Card className="clients-form-section card-border mb-3">
        <Card.Header className="clients-form-section-header py-3">
            <h6 className="mb-0 d-inline-flex align-items-center gap-2">
                <StickyNote size={15} />
                Sezione 5 - Note
            </h6>
        </Card.Header>
        <Card.Body>
            <Form.Group controlId="clients-notes">
                {/* Il titolo della sezione dice gia' "Note" a chi vede: l'etichetta
                    serve a chi usa uno screen reader, che il titolo non lo lega al campo. */}
                <Form.Label className="visually-hidden">Note</Form.Label>
                <Form.Control
                    as="textarea"
                    rows={4}
                    value={value}
                    onChange={(event) => onChange('notes', event.target.value)}
                    disabled={loading}
                    placeholder="Aggiungi note utili sul cliente"
                />
            </Form.Group>
        </Card.Body>
    </Card>
);

export default ClientNotesSection;
