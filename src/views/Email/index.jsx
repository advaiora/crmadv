import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  Col,
  Form,
  ListGroup,
  Row,
  Spinner,
} from 'react-bootstrap';
import { ArrowLeft, MessageSquare, RefreshCw, SendHorizontal } from 'lucide-react';
import { useWindowWidth } from '@react-hook/window-size';
import MessagingModuleGate from '../../modules/messaging/ui/MessagingModuleGate';
import {
  MESSAGING_PERMISSIONS,
} from '../../modules/messaging/ui/constants';
import {
  listMessagingConversation,
  listMessagingUsers,
  markMessagingConversationRead,
  sendMessagingMessage,
} from '../../modules/messaging/api/messagingApi';
import { hasPermission } from '../../utils/workspaceAccess';
import '../../modules/messaging/ui/messaging-ui.css';

const CONTACTS_POLL_INTERVAL_MS = 2500;
const CONVERSATION_POLL_INTERVAL_MS = 1500;

const formatDateTime = (value) => {
  if (!value) {
    return '-';
  }

  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '-';
  }

  return new Intl.DateTimeFormat('it-IT', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(parsed);
};

const getErrorMessage = (error, fallback) => {
  const status = Number(error?.status);
  if (status === 403) {
    return 'Non hai i permessi necessari.';
  }
  if (status === 404) {
    return 'Utente non trovato nel workspace.';
  }

  return error?.message || fallback;
};

const InternalMessagingPage = () => {
  const windowWidth = useWindowWidth();
  const isMobile = windowWidth < 992;
  const [contacts, setContacts] = useState([]);
  const [contactsLoading, setContactsLoading] = useState(true);
  const [contactsError, setContactsError] = useState('');
  const [draftSearch, setDraftSearch] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const [selectedPeerId, setSelectedPeerId] = useState('');
  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState('');
  const [composerText, setComposerText] = useState('');
  const [sending, setSending] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  const [mobileView, setMobileView] = useState('list');

  const selectedPeer = useMemo(
    () => contacts.find((item) => item.userId === selectedPeerId) || null,
    [contacts, selectedPeerId],
  );

  const loadContacts = useCallback(async ({ silent = false } = {}) => {
    if (!silent) {
      setContactsLoading(true);
      setContactsError('');
    }

    try {
      const result = await listMessagingUsers({
        q: searchQuery || undefined,
        limit: 80,
      });
      const nextItems = Array.isArray(result?.items) ? result.items : [];
      setContacts(nextItems);
      setSelectedPeerId((current) => {
        if (!current && nextItems.length > 0) {
          return isMobile ? '' : nextItems[0].userId;
        }

        if (current && nextItems.some((item) => item.userId === current)) {
          return current;
        }

        return isMobile ? '' : (nextItems[0]?.userId || '');
      });
    } catch (error) {
      if (!silent) {
        setContacts([]);
        setSelectedPeerId('');
        setContactsError(getErrorMessage(error, 'Errore caricamento utenti workspace'));
      }
    } finally {
      if (!silent) {
        setContactsLoading(false);
      }
    }
  }, [isMobile, searchQuery]);

  const loadConversation = useCallback(async (peerUserId, { silent = false } = {}) => {
    if (!peerUserId) {
      setMessages([]);
      setMessagesError('');
      return;
    }

    if (!silent) {
      setMessagesLoading(true);
      setMessagesError('');
    }
    try {
      const result = await listMessagingConversation(peerUserId, { limit: 120 });
      setMessages(Array.isArray(result?.items) ? result.items : []);

      try {
        const readResult = await markMessagingConversationRead(peerUserId);
        if (Number(readResult?.updatedCount) > 0) {
          setRefreshTick((current) => current + 1);
        }
      } catch (_error) {
        // Mark as read failure should not block rendering.
      }
    } catch (error) {
      if (!silent) {
        setMessages([]);
        setMessagesError(getErrorMessage(error, 'Errore caricamento conversazione'));
      }
    } finally {
      if (!silent) {
        setMessagesLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadContacts();
  }, [loadContacts, refreshTick]);

  useEffect(() => {
    if (!selectedPeerId) {
      setMessages([]);
      return;
    }

    void loadConversation(selectedPeerId);
  }, [loadConversation, selectedPeerId]);

  useEffect(() => {
    if (!isMobile) {
      setMobileView('chat');
      return;
    }

    setMobileView(selectedPeerId ? 'chat' : 'list');
  }, [isMobile, selectedPeerId]);

  useEffect(() => {
    let timeoutId;
    let cancelled = false;

    const runPollingCycle = async () => {
      if (cancelled) {
        return;
      }

      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        await loadContacts({ silent: true });
      }

      if (cancelled) {
        return;
      }

      timeoutId = window.setTimeout(runPollingCycle, CONTACTS_POLL_INTERVAL_MS);
    };

    timeoutId = window.setTimeout(runPollingCycle, CONTACTS_POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [loadContacts]);

  useEffect(() => {
    if (!selectedPeerId) {
      return undefined;
    }

    let timeoutId;
    let cancelled = false;

    const runPollingCycle = async () => {
      if (cancelled) {
        return;
      }

      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        await loadConversation(selectedPeerId, { silent: true });
      }

      if (cancelled) {
        return;
      }

      timeoutId = window.setTimeout(runPollingCycle, CONVERSATION_POLL_INTERVAL_MS);
    };

    timeoutId = window.setTimeout(runPollingCycle, CONVERSATION_POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [loadConversation, selectedPeerId]);

  const handleSearchSubmit = (event) => {
    event.preventDefault();
    setSearchQuery(draftSearch.trim());
  };

  const handleSendMessage = async () => {
    if (!selectedPeerId || !composerText.trim()) {
      return;
    }

    setSending(true);
    setMessagesError('');
    try {
      await sendMessagingMessage(selectedPeerId, {
        body: composerText.trim(),
      });
      setComposerText('');
      await Promise.all([
        loadConversation(selectedPeerId),
        loadContacts(),
      ]);
    } catch (error) {
      setMessagesError(getErrorMessage(error, 'Invio messaggio non riuscito'));
    } finally {
      setSending(false);
    }
  };

  const handleComposerKeyDown = (event) => {
    if (event.key !== 'Enter' || event.shiftKey) {
      return;
    }

    event.preventDefault();
    if (sending || !selectedPeerId || !composerText.trim()) {
      return;
    }

    void handleSendMessage();
  };

  const showContactsColumn = !isMobile || mobileView === 'list';
  const showConversationColumn = !isMobile || mobileView === 'chat';

  return (
    <MessagingModuleGate requiredPermission={MESSAGING_PERMISSIONS.view}>
      {({ access }) => {
        const canSend = hasPermission(access, MESSAGING_PERMISSIONS.send);

        return (
          <div className="hk-pg-body messaging-page py-0">
            <div className="container-fluid">
              <Row className="g-3">
                {showContactsColumn && (
                <Col lg={4} xl={3}>
                  <Card className="card-border h-100">
                    <Card.Body>
                      <div className="d-flex justify-content-between align-items-center mb-3">
                        <div>
                          <h5 className="mb-0">Messaggi interni</h5>
                          <div className="small text-muted">
                            Utenti nel workspace
                          </div>
                        </div>
                        <Button
                          variant="outline-secondary"
                          size="sm"
                          onClick={() => {
                            setRefreshTick((current) => current + 1);
                          }}
                          disabled={contactsLoading}
                        >
                          <RefreshCw size={14} />
                        </Button>
                      </div>

                      <Form onSubmit={handleSearchSubmit} className="d-flex gap-2 mb-3">
                        <Form.Control
                          value={draftSearch}
                          onChange={(event) => setDraftSearch(event.target.value)}
                          placeholder="Cerca utente..."
                        />
                        <Button type="submit" variant="primary">
                          Cerca
                        </Button>
                      </Form>

                      {contactsError && (
                        <Alert variant="danger" className="py-2">
                          {contactsError}
                        </Alert>
                      )}

                      <ListGroup variant="flush">
                        {contactsLoading && (
                          <ListGroup.Item className="text-muted small">
                            <Spinner animation="border" size="sm" className="me-2" />
                            Caricamento utenti...
                          </ListGroup.Item>
                        )}
                        {!contactsLoading && contacts.length === 0 && (
                          <ListGroup.Item className="text-muted small">
                            Nessun utente disponibile.
                          </ListGroup.Item>
                        )}
                        {!contactsLoading && contacts.map((contact) => (
                          <ListGroup.Item
                            action
                            key={contact.userId}
                            active={selectedPeerId === contact.userId}
                            onClick={() => {
                              setSelectedPeerId(contact.userId);
                              if (isMobile) {
                                setMobileView('chat');
                              }
                            }}
                            className="py-2"
                          >
                            <div className="d-flex justify-content-between align-items-start gap-2">
                              <div>
                                <div className="fw-semibold">
                                  {contact.name || contact.email}
                                </div>
                                <div className="small opacity-75">
                                  {contact.email}
                                </div>
                                <div className="small opacity-75">
                                  {contact.lastMessagePreview || 'Nessun messaggio'}
                                </div>
                              </div>
                              <div className="text-end">
                                {contact.unreadCount > 0 && (
                                  <Badge pill bg={selectedPeerId === contact.userId ? 'light' : 'danger'}>
                                    {contact.unreadCount}
                                  </Badge>
                                )}
                                <div className="small opacity-75 mt-1">
                                  {formatDateTime(contact.lastMessageAt)}
                                </div>
                              </div>
                            </div>
                          </ListGroup.Item>
                        ))}
                      </ListGroup>
                    </Card.Body>
                  </Card>
                </Col>
                )}

                {showConversationColumn && (
                <Col lg={8} xl={9}>
                  <Card className="card-border h-100 messaging-conversation-card">
                    <Card.Header className="bg-transparent d-flex align-items-center justify-content-between">
                      <div className="d-flex align-items-start gap-2">
                        {isMobile && (
                          <Button
                            type="button"
                            variant="outline-secondary"
                            size="sm"
                            className="messaging-back-btn"
                            onClick={() => setMobileView('list')}
                            aria-label="Torna alla lista conversazioni"
                          >
                            <ArrowLeft size={15} />
                          </Button>
                        )}
                        <div>
                        <h5 className="mb-0 d-flex align-items-center gap-2">
                          <MessageSquare size={16} />
                          Conversazione
                        </h5>
                        <div className="small text-muted">
                          {selectedPeer
                            ? `${selectedPeer.name || selectedPeer.email} (${selectedPeer.email})`
                            : 'Seleziona un utente a sinistra'}
                        </div>
                        </div>
                      </div>
                    </Card.Header>
                    <Card.Body className="d-flex flex-column">
                      {messagesError && (
                        <Alert variant="danger" className="py-2">
                          {messagesError}
                        </Alert>
                      )}

                      <div
                        className="flex-grow-1 border rounded p-3 mb-3 messaging-scroll-area"
                        style={{ minHeight: 320, maxHeight: 520, overflowY: 'auto' }}
                      >
                        {!selectedPeerId && (
                          <div className="text-muted small">
                            Seleziona un utente per iniziare la conversazione.
                          </div>
                        )}
                        {selectedPeerId && messagesLoading && (
                          <div className="text-muted small">
                            <Spinner animation="border" size="sm" className="me-2" />
                            Caricamento messaggi...
                          </div>
                        )}
                        {selectedPeerId && !messagesLoading && messages.length === 0 && (
                          <div className="text-muted small">
                            Nessun messaggio. Inizia tu la conversazione.
                          </div>
                        )}
                        {!messagesLoading && messages.map((message) => (
                          <div
                            key={message.id}
                            className={`d-flex mb-2 ${message.isMine ? 'justify-content-end' : 'justify-content-start'}`}
                          >
                            <div
                              className={`px-3 py-2 rounded messaging-bubble ${message.isMine ? 'bg-primary text-[var(--hk-text-on-dark-bg)] messaging-bubble-mine' : 'bg-light'}`}
                              style={{ maxWidth: '72%', whiteSpace: 'pre-wrap' }}
                            >
                              <div className="small">{message.body}</div>
                              <div className={`small mt-1 ${message.isMine ? 'text-textMuted' : 'text-muted'}`}>
                                {formatDateTime(message.createdAt)}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="d-flex gap-2 align-items-end messaging-composer">
                        <Form.Control
                          as="textarea"
                          rows={2}
                          value={composerText}
                          onChange={(event) => setComposerText(event.target.value)}
                          onKeyDown={handleComposerKeyDown}
                          placeholder={selectedPeerId ? 'Scrivi un messaggio...' : 'Seleziona prima un utente'}
                          disabled={!selectedPeerId || !canSend || sending}
                        />
                        <Button
                          type="button"
                          variant="primary"
                          disabled={!selectedPeerId || !canSend || sending || !composerText.trim()}
                          onClick={() => void handleSendMessage()}
                        >
                          <SendHorizontal size={16} className="me-1" />
                          {sending ? 'Invio...' : 'Invia'}
                        </Button>
                      </div>
                      {!canSend && (
                        <div className="small text-muted mt-2">
                          Non puoi inviare messaggi con i permessi attuali.
                        </div>
                      )}
                    </Card.Body>
                  </Card>
                </Col>
                )}
              </Row>
            </div>
          </div>
        );
      }}
    </MessagingModuleGate>
  );
};

export default InternalMessagingPage;
