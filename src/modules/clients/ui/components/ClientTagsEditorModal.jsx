import { Alert, Button, Form, Modal } from "react-bootstrap";
import { CLIENTS_PRESET_TAGS } from "../constants";
import { getTagBadgeStyle, hasTag } from "../helpers";

// Modal "Modifica tag cliente". La logica sta nell'hook useClientTagsEditor:
// questo componente riceve l'oggetto `editor` restituito dall'hook e disegna.
const ClientTagsEditorModal = ({ editor }) => (
  <Modal show={Boolean(editor.client)} onHide={() => editor.close(false)} centered dialogClassName="clients-tags-modal">
    <Modal.Header closeButton={!editor.saving}>
      <Modal.Title>Modifica tag cliente</Modal.Title>
    </Modal.Header>
    <Modal.Body>
      <p className="mb-2 small text-muted">{editor.client ? `Cliente: ${editor.client.name}` : ""}</p>

      {editor.error && (
        <Alert variant="danger" className="py-2 px-3 mb-3">
          {editor.error}
        </Alert>
      )}

      <div className="clients-tags mb-3">
        {editor.tags.length === 0 && <span className="text-muted small">Nessun tag</span>}
        {editor.tags.map((tag) => (
          <span key={`modal-tag-${tag}`} className="badge clients-tag-badge" style={getTagBadgeStyle(tag)}>
            {tag}
            <button
              type="button"
              className="clients-tag-remove-btn"
              onClick={() => editor.removeTag(tag)}
              disabled={editor.saving}
              aria-label={`Rimuovi tag ${tag}`}
            >
              &times;
            </button>
          </span>
        ))}
      </div>

      <div className="clients-tag-presets mb-3">
        {CLIENTS_PRESET_TAGS.map((presetTag) => (
          <Button
            key={`modal-preset-${presetTag}`}
            type="button"
            variant={hasTag(editor.tags, presetTag) ? "primary" : "outline-secondary"}
            size="sm"
            className="clients-tag-preset-btn"
            onClick={() => editor.togglePreset(presetTag)}
            disabled={editor.saving}
          >
            {presetTag}
          </Button>
        ))}
      </div>

      <Form.Group>
        <Form.Label className="small mb-1">Aggiungi tag personalizzato</Form.Label>
        <div className="input-group input-group-sm">
          <Form.Control
            value={editor.draft}
            onChange={(event) => editor.setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter") {
                return;
              }

              event.preventDefault();
              editor.addCustomTag();
            }}
            placeholder="Nuovo tag"
            disabled={editor.saving}
          />
          <Button type="button" variant="outline-secondary" onClick={editor.addCustomTag} disabled={editor.saving || !editor.draft.trim()}>
            Aggiungi
          </Button>
        </div>
      </Form.Group>
    </Modal.Body>
    <Modal.Footer>
      <Button variant="outline-secondary" onClick={() => editor.close(false)} disabled={editor.saving}>
        Annulla
      </Button>
      <Button variant="primary" onClick={() => void editor.save()} disabled={editor.saving}>
        {editor.saving ? "Salvataggio..." : "Salva tag"}
      </Button>
    </Modal.Footer>
  </Modal>
);

export default ClientTagsEditorModal;
