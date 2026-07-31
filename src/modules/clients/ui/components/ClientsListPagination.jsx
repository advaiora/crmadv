import { Button, Col, Row } from "react-bootstrap";
import { ChevronLeft, ChevronRight } from "lucide-react";

// Pie' di pagina della lista clienti: totale, "Mostra altri" (mobile) e
// frecce pagina precedente/successiva (desktop). Presentazionale puro.
const ClientsListPagination = ({ pageInfo, totalPages, activePage, visibleCount, loading, onGoToPage }) => (
  <Row className="align-items-center mt-3 gy-2">
    <Col md={6}>
      <div className="text-muted small">
        Totale clienti: {pageInfo.totalItems}
        {typeof visibleCount === "number" && <span> - visibili in pagina: {visibleCount}</span>}
      </div>
    </Col>
    <Col md={6}>
      <div className="clients-pagination-wrap d-flex justify-content-md-end align-items-center">
        <Button
          variant="outline-secondary"
          size="sm"
          onClick={() => onGoToPage(activePage + 1)}
          disabled={!pageInfo.hasNextPage || loading}
          className="clients-pagination-more-btn d-md-none"
        >
          Mostra altri
        </Button>
        <Button
          variant="outline-secondary"
          size="sm"
          onClick={() => onGoToPage(activePage - 1)}
          disabled={!pageInfo.hasPrevPage || loading}
          className="clients-pagination-btn d-none d-md-inline-flex"
          aria-label="Pagina precedente"
        >
          <ChevronLeft size={15} />
        </Button>
        <span className="small clients-pagination-status d-none d-md-inline">
          Pagina {pageInfo.page} di {totalPages}
        </span>
        <Button
          variant="outline-secondary"
          size="sm"
          onClick={() => onGoToPage(activePage + 1)}
          disabled={!pageInfo.hasNextPage || loading}
          className="clients-pagination-btn d-none d-md-inline-flex"
          aria-label="Pagina successiva"
        >
          <ChevronRight size={15} />
        </Button>
      </div>
    </Col>
  </Row>
);

export default ClientsListPagination;
