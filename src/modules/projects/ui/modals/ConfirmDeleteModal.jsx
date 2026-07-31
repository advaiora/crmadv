import { Button, Modal } from "react-bootstrap";

// Conferma di eliminazione delle Impostazioni Pipeline (categoria e stage:
// stessa struttura, cambiano titolo, testo e handler). Parametrico apposta.
const ConfirmDeleteModal = ({ show, title, message, onCancel, onConfirm, confirming }) => (
  <Modal show={show} onHide={onCancel} centered className="pipeline-modal">
    <Modal.Header closeButton>
      <Modal.Title>{title}</Modal.Title>
    </Modal.Header>
    <Modal.Body>{message}</Modal.Body>
    <Modal.Footer>
      <Button variant="outline-secondary" onClick={onCancel}>
        Annulla
      </Button>
      <Button variant="danger" onClick={onConfirm} disabled={confirming}>
        {confirming ? "Eliminazione..." : "Elimina"}
      </Button>
    </Modal.Footer>
  </Modal>
);

export default ConfirmDeleteModal;
