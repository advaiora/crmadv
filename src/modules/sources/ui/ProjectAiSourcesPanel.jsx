import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Badge, Button, Card, Form, Spinner } from 'react-bootstrap';
import { FileText, Link2, RefreshCw, Trash2, Upload } from 'lucide-react';
import {
  createProjectSource,
  deleteProjectSource,
  listProjectSources,
  refreshProjectSource,
  uploadProjectSourceFile,
} from '../api/sourcesApi';

const FILE_ACCEPT = '.pdf,.docx,.txt,.csv,.md';

// Pannello "Fonti indicizzabili per l'AI" (V4 — Modulo Fonti). Gestisce i record
// normalizzati ProjectSource (URL o testo con contenuto estratto), la base per la
// futura vettorizzazione/RAG. Vive dentro la pagina "Fonti e Materiali" del
// progetto, accanto alle sezioni esistenti (URL/file/competitor) che restano.

const STATUS_META = {
  ready: { variant: 'success', label: 'Pronta' },
  error: { variant: 'danger', label: 'Errore' },
  pending: { variant: 'secondary', label: 'In attesa' },
};

const TYPE_META = {
  url: { variant: 'secondary', label: 'URL' },
  text: { variant: 'info', label: 'Testo' },
  file: { variant: 'primary', label: 'File' },
};

const formatFileSize = (bytes) => {
  if (!bytes || bytes < 1024) {
    return `${bytes || 0} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(0)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const getErrorMessage = (error, fallback) => error?.message || fallback;

const ProjectAiSourcesPanel = ({ projectId }) => {
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [feedback, setFeedback] = useState('');

  const [type, setType] = useState('url');
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');
  const [title, setTitle] = useState('');
  const [file, setFile] = useState(null);
  const fileInputRef = useRef(null);
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState('');

  const load = useCallback(async () => {
    if (!projectId) {
      return;
    }
    setLoading(true);
    setLoadError('');
    try {
      const result = await listProjectSources(projectId);
      setSources(result?.items ?? []);
    } catch (error) {
      setLoadError(getErrorMessage(error, 'Impossibile caricare le fonti AI.'));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const resetForm = () => {
    setUrl('');
    setText('');
    setTitle('');
    setFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleAdd = async () => {
    setFeedback('');

    if (type === 'file') {
      if (!file) {
        setFeedback('Scegli un file da caricare.');
        return;
      }
      setAdding(true);
      try {
        const result = await uploadProjectSourceFile(projectId, file);
        const created = result?.source;
        if (created?.status === 'error') {
          setFeedback(`File caricato ma non letto: ${created.error || 'errore di estrazione'}.`);
        } else {
          setFeedback('File caricato e indicizzabile.');
        }
        resetForm();
        await load();
      } catch (error) {
        setFeedback(getErrorMessage(error, 'Caricamento del file non riuscito.'));
      } finally {
        setAdding(false);
      }
      return;
    }

    const payload =
      type === 'url'
        ? { type: 'url', url: url.trim(), ...(title.trim() ? { title: title.trim() } : {}) }
        : { type: 'text', content: text, ...(title.trim() ? { title: title.trim() } : {}) };

    if (type === 'url' && !payload.url) {
      setFeedback('Inserisci un URL.');
      return;
    }
    if (type === 'text' && !text.trim()) {
      setFeedback('Incolla del testo.');
      return;
    }

    setAdding(true);
    try {
      const result = await createProjectSource(projectId, payload);
      const created = result?.source;
      if (created?.status === 'error') {
        setFeedback(`Fonte aggiunta ma non scaricata: ${created.error || 'errore di estrazione'}.`);
      } else {
        setFeedback('Fonte aggiunta e indicizzabile.');
      }
      resetForm();
      await load();
    } catch (error) {
      setFeedback(getErrorMessage(error, 'Aggiunta della fonte non riuscita.'));
    } finally {
      setAdding(false);
    }
  };

  const handleRefresh = async (id) => {
    setBusyId(id);
    setFeedback('');
    try {
      await refreshProjectSource(id);
      await load();
    } catch (error) {
      setFeedback(getErrorMessage(error, 'Aggiornamento non riuscito.'));
    } finally {
      setBusyId('');
    }
  };

  const handleDelete = async (id) => {
    setBusyId(id);
    setFeedback('');
    try {
      await deleteProjectSource(id);
      setSources((current) => current.filter((source) => source.id !== id));
    } catch (error) {
      setFeedback(getErrorMessage(error, 'Eliminazione non riuscita.'));
    } finally {
      setBusyId('');
    }
  };

  return (
    <Card className="card-border">
      <Card.Body>
        <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
          <div>
            <h6 className="mb-1">Fonti indicizzabili per l&apos;AI</h6>
            <p className="small text-muted mb-0">
              URL e testi da cui l&apos;AI leggerà il contenuto (base per la futura
              ricerca semantica). Il testo viene estratto e salvato automaticamente.
            </p>
          </div>
          <Button size="sm" variant="outline-secondary" onClick={() => void load()} disabled={loading}>
            Ricarica
          </Button>
        </div>

        {loadError && <Alert variant="danger" className="py-2">{loadError}</Alert>}
        {feedback && (
          <Alert variant="info" className="py-2" role="status" onClose={() => setFeedback('')} dismissible>
            {feedback}
          </Alert>
        )}

        <div className="border rounded-3 p-3 mb-3">
          <div className="d-flex gap-2 mb-2" role="group" aria-label="Tipo di fonte">
            <Button
              size="sm"
              variant={type === 'url' ? 'primary' : 'outline-primary'}
              className="d-inline-flex align-items-center gap-1"
              onClick={() => setType('url')}
            >
              <Link2 size={14} /> URL
            </Button>
            <Button
              size="sm"
              variant={type === 'text' ? 'primary' : 'outline-primary'}
              className="d-inline-flex align-items-center gap-1"
              onClick={() => setType('text')}
            >
              <FileText size={14} /> Testo
            </Button>
            <Button
              size="sm"
              variant={type === 'file' ? 'primary' : 'outline-primary'}
              className="d-inline-flex align-items-center gap-1"
              onClick={() => setType('file')}
            >
              <Upload size={14} /> File
            </Button>
          </div>

          {type === 'url' && (
            <Form.Control
              size="sm"
              className="mb-2"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://www.cliente.it/pagina"
            />
          )}
          {type === 'text' && (
            <Form.Control
              as="textarea"
              rows={4}
              size="sm"
              className="mb-2"
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="Incolla qui il testo da usare come fonte (brief, appunti, contenuti…)"
            />
          )}
          {type === 'file' && (
            <>
              <Form.Control
                ref={fileInputRef}
                type="file"
                size="sm"
                className="mb-1"
                accept={FILE_ACCEPT}
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
              <p className="small text-muted mb-2">
                Formati ammessi: PDF, Word (.docx), testo (.txt, .csv, .md). Massimo 20MB.
                Viene estratto e indicizzato il testo del documento.
              </p>
            </>
          )}

          {type !== 'file' && (
            <Form.Control
              size="sm"
              className="mb-2"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Titolo (opzionale)"
            />
          )}

          <Button size="sm" variant="primary" onClick={() => void handleAdd()} disabled={adding}>
            {adding ? (
              <>
                <Spinner animation="border" size="sm" className="me-2" />
                {type === 'file' ? 'Caricamento…' : 'Aggiunta…'}
              </>
            ) : type === 'file' ? (
              'Carica file'
            ) : (
              'Aggiungi fonte'
            )}
          </Button>
        </div>

        {loading ? (
          <div className="p-3 d-flex justify-content-center">
            <Spinner animation="border" size="sm" role="status" />
          </div>
        ) : sources.length === 0 ? (
          <div className="agency-empty-state small">
            <strong>Nessuna fonte indicizzabile.</strong> Aggiungi un URL o del testo qui sopra.
          </div>
        ) : (
          <div className="d-flex flex-column gap-2">
            {sources.map((source) => {
              const meta = STATUS_META[source.status] || STATUS_META.pending;
              const typeMeta = TYPE_META[source.type] || TYPE_META.text;
              return (
                <div key={source.id} className="agency-record-row">
                  <div className="flex-grow-1">
                    <div className="d-flex align-items-center gap-2 mb-1">
                      <Badge bg={typeMeta.variant}>{typeMeta.label}</Badge>
                      <span className="fw-semibold small">{source.title}</span>
                      <Badge bg={meta.variant}>{meta.label}</Badge>
                    </div>
                    {source.url && (
                      <a className="small d-block text-truncate" href={source.url} target="_blank" rel="noreferrer">
                        {source.url}
                      </a>
                    )}
                    {source.type === 'file' && source.fileName && (
                      <div className="small text-muted text-truncate">
                        {source.fileName}
                        {source.fileSize ? ` · ${formatFileSize(source.fileSize)}` : ''}
                      </div>
                    )}
                    {source.status === 'error' ? (
                      <div className="small text-danger">{source.error}</div>
                    ) : (
                      <div className="small text-muted">
                        {source.contentChars} caratteri estratti
                        {source.contentPreview ? ` — ${source.contentPreview.slice(0, 120)}…` : ''}
                      </div>
                    )}
                  </div>
                  <div className="d-flex align-items-center gap-2">
                    {source.type === 'url' && (
                      <Button
                        size="sm"
                        variant="outline-secondary"
                        onClick={() => void handleRefresh(source.id)}
                        disabled={busyId === source.id}
                        title="Ri-scarica il contenuto"
                      >
                        <RefreshCw size={14} />
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline-danger"
                      onClick={() => void handleDelete(source.id)}
                      disabled={busyId === source.id}
                      title="Elimina"
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card.Body>
    </Card>
  );
};

export default ProjectAiSourcesPanel;
