import { Button, Card, Col, Form, ListGroup, Row } from "react-bootstrap";
import { Pencil, Plus, Trash2 } from "lucide-react";

// Colonna "Categorie" delle Impostazioni Pipeline, estratta da
// src/views/Projects/ProjectPipelineSettings.jsx (fase 2 riordino frontend).
// Componente controllato: non conosce le mutazioni, riceve i dati e richiama
// il genitore. La riga e' cliccabile (regola UX del progetto) e resta
// raggiungibile da tastiera con Invio o Barra spaziatrice.
const CategoriesPanel = ({
  categories,
  selectedCategoryId,
  onSelectCategory,
  newCategoryName,
  onNewCategoryNameChange,
  onCreateCategory,
  onEditCategory,
  onDeleteCategory,
  creating,
}) => (
  <Card className="card-border h-100">
    <Card.Header className="bg-transparent d-flex justify-content-between align-items-center">
      <h6 className="mb-0">Categorie</h6>
    </Card.Header>
    <Card.Body>
      <ListGroup variant="flush">
        {categories.map((category) => (
          <ListGroup.Item
            key={category.id}
            as="div"
            role="button"
            tabIndex={0}
            active={category.id === selectedCategoryId}
            onClick={() => onSelectCategory(category.id)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSelectCategory(category.id);
              }
            }}
            className="list-group-item-action d-flex justify-content-between align-items-center gap-2"
          >
            <span>{category.name}</span>
            <span className="d-flex align-items-center gap-1">
              <Button
                type="button"
                size="sm"
                aria-label={`Rinomina ${category.name}`}
                variant={category.id === selectedCategoryId ? "light" : "outline-secondary"}
                onClick={(event) => {
                  event.stopPropagation();
                  onEditCategory({ id: category.id, name: category.name });
                }}
              >
                <Pencil size={13} />
              </Button>
              <Button
                type="button"
                size="sm"
                aria-label={`Elimina ${category.name}`}
                variant={category.id === selectedCategoryId ? "light" : "outline-danger"}
                onClick={(event) => {
                  event.stopPropagation();
                  onDeleteCategory(category);
                }}
              >
                <Trash2 size={13} />
              </Button>
            </span>
          </ListGroup.Item>
        ))}
      </ListGroup>

      <CategoryNameForm
        className="mt-3"
        controlId="pipeline-new-category"
        label="Nuova categoria"
        value={newCategoryName}
        onChange={onNewCategoryNameChange}
        onSubmit={onCreateCategory}
        creating={creating}
      />
    </Card.Body>
  </Card>
);

// Stesso modulo "crea categoria" in due posti: dentro il pannello e nella
// scheda che compare quando di categorie non ce n'e' nessuna. La differenza
// e' solo l'impaginazione, quindi vive qui una volta sola.
export const CategoryNameForm = ({ className, controlId, label, value, onChange, onSubmit, creating, wide = false }) => {
  const field = (
    <Form.Group className={label ? "mb-2" : undefined} controlId={controlId}>
      {label && <Form.Label className="small text-muted mb-1">{label}</Form.Label>}
      <Form.Control
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Nome categoria"
        aria-label={label ? undefined : "Nome categoria"}
        disabled={creating}
      />
    </Form.Group>
  );

  const submit = (
    <Button
      type="submit"
      variant="primary"
      size={wide ? undefined : "sm"}
      className={`d-inline-flex align-items-center gap-2 justify-content-center${wide ? " w-100" : ""}`}
      disabled={creating}
    >
      <Plus size={14} />
      Categoria
    </Button>
  );

  if (wide) {
    return (
      <Form className={className} onSubmit={onSubmit}>
        <Row className="g-2">
          <Col md={8}>{field}</Col>
          <Col md={4}>{submit}</Col>
        </Row>
      </Form>
    );
  }

  return (
    <Form className={className} onSubmit={onSubmit}>
      {field}
      {submit}
    </Form>
  );
};

export default CategoriesPanel;
