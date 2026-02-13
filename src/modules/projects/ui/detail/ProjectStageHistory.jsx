import React from 'react';
import { Alert, Button, Card, ListGroup, Spinner } from 'react-bootstrap';

const formatDateTime = (rawValue) => {
    if (!rawValue) {
        return 'Data non disponibile';
    }

    const parsed = new Date(rawValue);
    if (Number.isNaN(parsed.getTime())) {
        return String(rawValue);
    }

    return new Intl.DateTimeFormat('it-IT', {
        dateStyle: 'short',
        timeStyle: 'short',
    }).format(parsed);
};

const resolveFromStage = (item) => (
    item?.fromStageName
    || item?.fromStage?.name
    || item?.fromStageId
    || item?.previousStageId
    || '—'
);

const resolveToStage = (item) => (
    item?.toStageName
    || item?.toStage?.name
    || item?.toStageId
    || item?.stageId
    || '—'
);

const resolveActor = (item) => (
    item?.userName
    || item?.user?.name
    || item?.actorName
    || item?.actorUserId
    || '—'
);

const resolveTimestamp = (item) => (
    item?.createdAt
    || item?.at
    || item?.timestamp
    || item?.occurredAt
    || null
);

const ProjectStageHistory = ({
    history,
    loading,
    error,
    onRetry,
}) => {
    return (
        <Card className="card-border">
            <Card.Header className="bg-transparent">
                <h6 className="mb-0">Storico stage</h6>
            </Card.Header>
            <Card.Body>
                {loading && (
                    <div className="d-flex align-items-center gap-2">
                        <Spinner animation="border" size="sm" role="status" />
                        <span>Caricamento storico...</span>
                    </div>
                )}

                {!loading && error && (
                    <Alert variant="danger" className="d-flex justify-content-between align-items-center gap-2 mb-0">
                        <span>Errore caricamento storico.</span>
                        {typeof onRetry === 'function' && (
                            <Button variant="outline-danger" size="sm" onClick={() => void onRetry()}>
                                Riprova
                            </Button>
                        )}
                    </Alert>
                )}

                {!loading && !error && history === null && (
                    <span className="text-muted">Storico non disponibile (Step successivo)</span>
                )}

                {!loading && !error && Array.isArray(history) && history.length === 0 && (
                    <span className="text-muted">Nessun movimento stage registrato.</span>
                )}

                {!loading && !error && Array.isArray(history) && history.length > 0 && (
                    <ListGroup variant="flush">
                        {history.map((historyItem, index) => (
                            <ListGroup.Item key={historyItem?.id || `${index}-${resolveTimestamp(historyItem)}`}>
                                <div className="small text-muted mb-1">
                                    {formatDateTime(resolveTimestamp(historyItem))}
                                </div>
                                <div className="mb-1">
                                    <span className="fw-semibold">{resolveFromStage(historyItem)}</span>
                                    <span className="mx-2">-&gt;</span>
                                    <span className="fw-semibold">{resolveToStage(historyItem)}</span>
                                </div>
                                <div className="small text-muted">
                                    Utente: {resolveActor(historyItem)}
                                </div>
                            </ListGroup.Item>
                        ))}
                    </ListGroup>
                )}
            </Card.Body>
        </Card>
    );
};

export default ProjectStageHistory;
