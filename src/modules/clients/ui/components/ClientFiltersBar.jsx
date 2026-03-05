import React, { useState } from 'react';
import { Badge, Button, Card, Col, Form, InputGroup, Offcanvas, Row } from 'react-bootstrap';
import { Filter, Search, X } from 'lucide-react';
import {
    CLIENTS_PAGE_SIZE_OPTIONS,
    CLIENTS_SORT_OPTIONS,
    CLIENTS_TYPE_OPTIONS,
} from '../constants';

const ClientFiltersBar = ({
    searchValue,
    typeValue,
    sortValue,
    pageSize,
    activeFilters = [],
    onSearchChange,
    onTypeChange,
    onSortChange,
    onPageSizeChange,
    onSubmit,
    onReset,
}) => {
    const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

    const FiltersFields = (
        <Row className="g-2 align-items-end">
            <Col md={4} lg={4} xl={2}>
                <Form.Group>
                    <Form.Label className="text-muted small mb-1">Tipo</Form.Label>
                    <Form.Select value={typeValue} onChange={(event) => onTypeChange(event.target.value)}>
                        {CLIENTS_TYPE_OPTIONS.map((option) => (
                            <option value={option.value} key={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </Form.Select>
                </Form.Group>
            </Col>
            <Col md={4} lg={4} xl={3}>
                <Form.Group>
                    <Form.Label className="text-muted small mb-1">Ordinamento</Form.Label>
                    <Form.Select value={sortValue} onChange={(event) => onSortChange(event.target.value)}>
                        {CLIENTS_SORT_OPTIONS.map((option) => (
                            <option value={option.value} key={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </Form.Select>
                </Form.Group>
            </Col>
            <Col md={4} lg={4} xl={2}>
                <Form.Group>
                    <Form.Label className="text-muted small mb-1">Righe</Form.Label>
                    <Form.Select
                        value={pageSize}
                        onChange={(event) => onPageSizeChange(Number(event.target.value))}
                    >
                        {CLIENTS_PAGE_SIZE_OPTIONS.map((option) => (
                            <option value={option} key={option}>
                                {option}
                            </option>
                        ))}
                    </Form.Select>
                </Form.Group>
            </Col>
            <Col xs={12} xl={2}>
                <div className="d-grid">
                    <Button
                        type="button"
                        variant="outline-secondary"
                        onClick={() => {
                            onReset();
                            setMobileFiltersOpen(false);
                        }}
                        className="d-inline-flex align-items-center justify-content-center gap-1"
                    >
                        <X size={14} />
                        <span>Reset</span>
                    </Button>
                </div>
            </Col>
        </Row>
    );

    return (
        <Card className="card-border mb-3 clients-toolbar-card">
            <Card.Body className="py-3">
                <Form onSubmit={onSubmit}>
                    <Row className="g-2 align-items-end">
                        <Col xs={12} xl={5}>
                            <Form.Group>
                                <Form.Label className="text-muted small mb-1">Ricerca</Form.Label>
                                <InputGroup>
                                    <InputGroup.Text>
                                        <Search size={15} />
                                    </InputGroup.Text>
                                    <Form.Control
                                        value={searchValue}
                                        onChange={(event) => onSearchChange(event.target.value)}
                                        placeholder="Cerca per nome, email, telefono..."
                                        aria-label="Cerca clienti"
                                    />
                                    <Button type="submit" variant="outline-primary">
                                        Cerca
                                    </Button>
                                </InputGroup>
                            </Form.Group>
                        </Col>

                        <Col xs={12} className="d-xl-none">
                            <div className="d-flex gap-2">
                                <Button
                                    type="button"
                                    variant="outline-secondary"
                                    className="flex-grow-1 d-inline-flex align-items-center justify-content-center gap-1"
                                    onClick={() => setMobileFiltersOpen(true)}
                                >
                                    <Filter size={14} />
                                    Filtra
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline-secondary"
                                    className="d-inline-flex align-items-center justify-content-center gap-1"
                                    onClick={onReset}
                                >
                                    <X size={14} />
                                    Reset
                                </Button>
                            </div>
                        </Col>

                        <Col className="d-none d-xl-block" xl={7}>
                            {FiltersFields}
                        </Col>
                    </Row>
                </Form>

                {activeFilters.length > 0 && (
                    <div className="mt-3 d-flex align-items-center flex-wrap gap-2">
                        <span className="text-muted small d-inline-flex align-items-center gap-1">
                            <Filter size={13} />
                            Filtri attivi:
                        </span>
                        {activeFilters.map((filter) => (
                            <Badge bg="light" text="dark" pill key={filter}>
                                {filter}
                            </Badge>
                        ))}
                    </div>
                )}
            </Card.Body>

            <Offcanvas
                show={mobileFiltersOpen}
                onHide={() => setMobileFiltersOpen(false)}
                placement="end"
                className="d-xl-none"
            >
                <Offcanvas.Header closeButton>
                    <Offcanvas.Title>Filtri clienti</Offcanvas.Title>
                </Offcanvas.Header>
                <Offcanvas.Body>
                    <Form>{FiltersFields}</Form>
                </Offcanvas.Body>
            </Offcanvas>
        </Card>
    );
};

export default ClientFiltersBar;
