import React from 'react';
import { Card, Col, Placeholder, Row } from 'react-bootstrap';

const hasOwn = (value, key) => Boolean(value) && Object.prototype.hasOwnProperty.call(value, key);

const formatCurrencyValue = (value) => {
    if (value === null || value === undefined || value === '') {
        return '-';
    }

    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) {
        return String(value);
    }

    return new Intl.NumberFormat('it-IT', {
        style: 'currency',
        currency: 'EUR',
    }).format(numericValue);
};

const formatDateValue = (value) => {
    if (!value) {
        return '-';
    }

    const parsedDate = new Date(value);
    if (Number.isNaN(parsedDate.getTime())) {
        return String(value);
    }

    return new Intl.DateTimeFormat('it-IT').format(parsedDate);
};

const resolveText = (value) => (value === null || value === undefined || value === '' ? '-' : String(value));

const resolveClientNames = (project) => {
    if (Array.isArray(project?.clientNames) && project.clientNames.length > 0) {
        return project.clientNames.join(', ');
    }

    if (Array.isArray(project?.clients) && project.clients.length > 0) {
        return project.clients.map((client) => client?.name).filter(Boolean).join(', ');
    }

    return project?.clientName || project?.client?.name || project?.clientId || '-';
};

const ProjectDetailsCard = ({ project, loading }) => {
    const detailRows = [
        {
            key: 'description',
            label: 'Descrizione',
            value: resolveText(project?.description),
            visible: hasOwn(project, 'description'),
        },
        {
            key: 'client',
            label: 'Clienti',
            value: resolveText(resolveClientNames(project)),
            visible:
                hasOwn(project, 'clientNames')
                || hasOwn(project, 'clients')
                || hasOwn(project, 'clientName')
                || hasOwn(project, 'clientId')
                || hasOwn(project, 'client'),
        },
        {
            key: 'value',
            label: 'Valore',
            value: formatCurrencyValue(project?.value),
            visible: hasOwn(project, 'value'),
        },
        {
            key: 'dueDate',
            label: 'Scadenza',
            value: formatDateValue(project?.dueDate),
            visible: hasOwn(project, 'dueDate'),
        },
        {
            key: 'owner',
            label: 'Owner',
            value: resolveText(
                project?.ownerName
                || project?.owner?.name
                || project?.ownerId,
            ),
            visible:
                hasOwn(project, 'ownerName')
                || hasOwn(project, 'ownerId')
                || hasOwn(project, 'owner'),
        },
    ].filter((row) => row.visible);

    return (
        <Card className="card-border mb-3">
            <Card.Header className="bg-transparent">
                <h6 className="mb-0">Dati</h6>
            </Card.Header>
            <Card.Body>
                {loading ? (
                    <Placeholder as="div" animation="glow">
                        <Placeholder xs={12} className="mb-2" />
                        <Placeholder xs={10} className="mb-2" />
                        <Placeholder xs={8} />
                    </Placeholder>
                ) : (
                    <Row className="g-3">
                        {detailRows.length === 0 && (
                            <Col xs={12}>
                                <span className="text-muted">Nessun dato disponibile.</span>
                            </Col>
                        )}

                        {detailRows.map((detailRow) => (
                            <Col xs={12} md={6} key={detailRow.key}>
                                <div className="small text-muted">{detailRow.label}</div>
                                <div>{detailRow.value}</div>
                            </Col>
                        ))}
                    </Row>
                )}
            </Card.Body>
        </Card>
    );
};

export default ProjectDetailsCard;
