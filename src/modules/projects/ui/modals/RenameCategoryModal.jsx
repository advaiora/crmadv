import { Button, Form, Modal } from "react-bootstrap";

// Modal "Rinomina categoria" delle Impostazioni Pipeline. Controllato dal
// genitore: category e' l'oggetto in modifica (null = chiuso), onChange
// riceve il nuovo nome, il salvataggio resta nell'handler del genitore.
const RenameCategoryModal = ({ category, onChange, onCancel, onSave, saving }) => (
  <Modal show={Boolean(category)} onHide={onCancel} centered className="pipeline-modal">
    <Modal.Header closeButton>
      <Modal.Title>Rinomina categoria</Modal.Title>
    </Modal.Header>
    <Modal.Body>
      <Form.Control
        value={category?.name || ""}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Nome categoria"
        autoFocus
      />
    </Modal.Body>
    <Modal.Footer>
      <Button variant="outline-secondary" onClick={onCancel}>
        Annulla
      </Button>
      <Button variant="primary" onClick={onSave} disabled={saving}>
        {saving ? "Salvataggio..." : "Salva"}
      </Button>
    </Modal.Footer>
  </Modal>
);

export default RenameCategoryModal;
