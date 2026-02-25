import React, { useMemo } from 'react';
import { Alert, Button, Card, Form, Table } from 'react-bootstrap';

const TemplatePicker = ({
  templates,
  selectedTemplateId,
  onSelectTemplate,
  onApplyTemplate,
  loading = false,
  error,
  disabled = false,
}) => {
  const safeTemplates = Array.isArray(templates) ? templates : [];

  const selectedTemplate = useMemo(() => {
    return safeTemplates.find((template) => template.id === selectedTemplateId) || null;
  }, [safeTemplates, selectedTemplateId]);

  return (
    <div>
      <Form.Group className="mb-3">
        <Form.Label>Template (opzionale)</Form.Label>
        <Form.Select
          value={selectedTemplateId || ''}
          onChange={(event) => onSelectTemplate(event.target.value || null)}
          disabled={disabled || loading}
        >
          <option value="">Nessun template</option>
          {safeTemplates.map((template) => (
            <option key={template.id} value={template.id}>
              {template.name}
            </option>
          ))}
        </Form.Select>
      </Form.Group>

      {error && (
        <Alert variant="danger" className="py-2 px-3">
          {error}
        </Alert>
      )}

      {selectedTemplate && (
        <Card className="card-border">
          <Card.Body>
            <div className="d-flex justify-content-between align-items-start gap-3 mb-2">
              <div>
                <h6 className="mb-1">{selectedTemplate.name}</h6>
                {selectedTemplate.description && (
                  <p className="mb-0 text-muted small">{selectedTemplate.description}</p>
                )}
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline-primary"
                onClick={() => onApplyTemplate(selectedTemplate)}
                disabled={disabled}
              >
                Applica template
              </Button>
            </div>

            <div className="small text-muted mb-2">Righe predefinite: {selectedTemplate.items?.length || 0}</div>

            {Array.isArray(selectedTemplate.items) && selectedTemplate.items.length > 0 && (
              <div className="table-responsive">
                <Table size="sm" bordered className="mb-2 quote-items-table">
                  <thead>
                    <tr>
                      <th>Descrizione</th>
                      <th className="text-end">Qta</th>
                      <th className="text-end quote-money-cell">Prezzo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedTemplate.items.map((item) => (
                      <tr key={item.id || `${item.position}-${item.title}`}>
                        <td>{item.title}</td>
                        <td className="text-end">{item.quantity}</td>
                        <td className="text-end quote-money-cell">{item.unitPrice}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            )}

            {selectedTemplate.defaultNotes && (
              <div className="small text-muted">
                <strong>Note default:</strong> {selectedTemplate.defaultNotes}
              </div>
            )}
          </Card.Body>
        </Card>
      )}
    </div>
  );
};

export default TemplatePicker;
