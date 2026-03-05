import React, { useState } from 'react';
import {
  Button as BsButton,
  Card as BsCard,
  Dropdown,
  Form,
  Modal,
  OverlayTrigger,
  Pagination,
  Popover,
  Table,
} from 'react-bootstrap';
import { Badge as UiBadge } from '../../components/ui/badge';
import { Button as UiButton } from '../../components/ui/button';
import {
  Card as UiCard,
  CardContent as UiCardContent,
  CardDescription as UiCardDescription,
  CardHeader as UiCardHeader,
  CardTitle as UiCardTitle,
} from '../../components/ui/card';
import { Input as UiInput } from '../../components/ui/input';
import { Select as UiSelect } from '../../components/ui/select';
import { Textarea as UiTextarea } from '../../components/ui/textarea';

const ThemePreviewPage = () => {
  const [showModal, setShowModal] = useState(false);

  return (
    <div className="container-fluid py-4">
      <div className="hk-pg-header pb-3">
        <h1 className="pg-title mb-1">Theme Preview</h1>
        <p className="text-muted mb-0">
          Verifica rapida di superfici, bordi, hover e componenti in light/dark.
        </p>
      </div>

      <div className="row g-3">
        <div className="col-12 col-xl-8">
          <UiCard>
            <UiCardHeader>
              <UiCardTitle>shadcn Inputs & Buttons</UiCardTitle>
              <UiCardDescription>
                Input, select, textarea, badge e stati hover/focus con token semantici.
              </UiCardDescription>
            </UiCardHeader>
            <UiCardContent className="space-y-3">
              <div className="row g-2">
                <div className="col-md-6">
                  <UiInput placeholder="Nome cliente" />
                </div>
                <div className="col-md-6">
                  <UiSelect defaultValue="">
                    <option value="" disabled>
                      Seleziona stato
                    </option>
                    <option value="new">Nuovo</option>
                    <option value="active">Attivo</option>
                  </UiSelect>
                </div>
              </div>
              <UiTextarea placeholder="Note operative..." rows={3} />
              <div className="d-flex flex-wrap gap-2">
                <UiButton>Primary</UiButton>
                <UiButton variant="secondary">Secondary</UiButton>
                <UiButton variant="outline">Outline</UiButton>
                <UiButton variant="ghost">Ghost</UiButton>
                <UiBadge variant="secondary">Badge</UiBadge>
              </div>
            </UiCardContent>
          </UiCard>

          <BsCard className="card-border mt-3">
            <BsCard.Header className="d-flex justify-content-between align-items-center">
              <span>Bootstrap Table / Dropdown / Popover</span>
              <Dropdown align="end">
                <Dropdown.Toggle variant="outline-secondary" size="sm">
                  Azioni
                </Dropdown.Toggle>
                <Dropdown.Menu>
                  <Dropdown.Item>Nuovo elemento</Dropdown.Item>
                  <Dropdown.Item>Modifica</Dropdown.Item>
                  <Dropdown.Divider />
                  <Dropdown.Item className="text-danger">Elimina</Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown>
            </BsCard.Header>
            <BsCard.Body>
              <Table responsive hover className="mb-3">
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Pipeline</th>
                    <th>Owner</th>
                    <th className="text-end">Valore</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Studio Nova</td>
                    <td>Proposal</td>
                    <td>Mario</td>
                    <td className="text-end">EUR 4,200</td>
                  </tr>
                  <tr>
                    <td>Acme SRL</td>
                    <td>Delivery</td>
                    <td>Sara</td>
                    <td className="text-end">EUR 9,800</td>
                  </tr>
                </tbody>
              </Table>

              <div className="d-flex flex-wrap justify-content-between gap-2">
                <OverlayTrigger
                  placement="right"
                  overlay={(
                    <Popover id="theme-preview-popover">
                      <Popover.Header as="h3">Popover</Popover.Header>
                      <Popover.Body>
                        Superficie elevata e bordo devono restare neutrali in dark.
                      </Popover.Body>
                    </Popover>
                  )}
                >
                  <BsButton variant="outline-primary">Apri popover</BsButton>
                </OverlayTrigger>

                <Pagination className="mb-0">
                  <Pagination.Prev />
                  <Pagination.Item active>{1}</Pagination.Item>
                  <Pagination.Item>{2}</Pagination.Item>
                  <Pagination.Next />
                </Pagination>
              </div>
            </BsCard.Body>
          </BsCard>
        </div>

        <div className="col-12 col-xl-4">
          <BsCard className="card-border h-100">
            <BsCard.Header>Sidebar + Dialog Preview</BsCard.Header>
            <BsCard.Body>
              <div className="list-group mb-3">
                <button type="button" className="list-group-item list-group-item-action active">
                  Dashboard
                </button>
                <button type="button" className="list-group-item list-group-item-action">
                  Progetti
                </button>
                <button type="button" className="list-group-item list-group-item-action">
                  Clienti
                </button>
              </div>

              <Form.Group className="mb-3">
                <Form.Label>Ricerca</Form.Label>
                <Form.Control placeholder="Cerca..." />
              </Form.Group>

              <div className="d-flex gap-2">
                <BsButton variant="primary" onClick={() => setShowModal(true)}>
                  Apri dialog
                </BsButton>
                <BsButton variant="outline-secondary">Secondaria</BsButton>
              </div>
            </BsCard.Body>
          </BsCard>
        </div>
      </div>

      <Modal show={showModal} onHide={() => setShowModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Dialog Preview</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          Questo dialog verifica surface elevata, border, testo e focus ring in dark neutral.
        </Modal.Body>
        <Modal.Footer>
          <BsButton variant="outline-secondary" onClick={() => setShowModal(false)}>
            Chiudi
          </BsButton>
          <BsButton variant="primary" onClick={() => setShowModal(false)}>
            Conferma
          </BsButton>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default ThemePreviewPage;

