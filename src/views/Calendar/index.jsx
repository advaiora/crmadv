import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  ButtonGroup,
  Card,
  Col,
  Form,
  ListGroup,
  Modal,
  Row,
  Spinner,
} from 'react-bootstrap';
import { Link } from 'react-router-dom';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import moment from 'moment';
import { useWindowHeight } from '@react-hook/window-size';
import { ChevronDown, ChevronUp } from 'react-feather';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronLeft, faChevronRight } from '@fortawesome/free-solid-svg-icons';
import { connect } from 'react-redux';
import { toggleTopNav } from '../../redux/action/Theme';
import CalendarModuleGate from '../../modules/calendar/ui/CalendarModuleGate';
import { CALENDAR_PERMISSIONS } from '../../modules/calendar/ui/constants';
import {
  createCalendarEvent,
  deleteCalendarEvent,
  listCalendarEvents,
  updateCalendarEvent,
} from '../../modules/calendar/api/calendarApi';
import { hasPermission } from '../../utils/workspaceAccess';

const SOURCE_FILTERS = {
  custom: 'Eventi custom',
  project_due: 'Scadenze progetti',
  quote_issue_date: 'Emissione preventivi',
  quote_valid_until: 'Scadenza preventivi',
};

const EVENT_SOURCE_BADGE = {
  custom: 'Custom',
  project_due: 'Progetto',
  quote_issue_date: 'Preventivo',
  quote_valid_until: 'Preventivo',
};

const buildDefaultFormState = () => {
  const now = new Date();
  const plusHour = new Date(now.getTime() + 60 * 60 * 1000);

  return {
    title: '',
    description: '',
    location: '',
    category: '',
    color: '#0d6efd',
    allDay: false,
    startValue: toLocalDateTimeInput(now),
    endValue: toLocalDateTimeInput(plusHour),
  };
};

const normalizeHexColor = (value, fallback = '#0d6efd') => {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return /^#[0-9a-fA-F]{6}$/.test(normalized) ? normalized : fallback;
};

const toOptionalTrimmedString = (value) => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const toLocalDateInput = (value) => {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

const toLocalDateTimeInput = (value) => {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const parseFormDateValue = (value, { allDay, isEnd = false }) => {
  if (!value) {
    return null;
  }

  const raw = String(value).trim();
  if (!raw) {
    return null;
  }

  const parsed = allDay
    ? new Date(`${raw}${isEnd ? 'T23:59:59.999' : 'T00:00:00.000'}`)
    : new Date(raw);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Data non valida (${raw})`);
  }

  return parsed.toISOString();
};

const mapApiError = (error, fallback = 'Operazione non riuscita') => {
  const status = error?.status;
  if (status === 403) {
    return 'Non hai permessi';
  }
  if (status === 404) {
    return 'Evento non trovato';
  }
  if (status === 409) {
    return 'Operazione non valida per lo stato attuale';
  }

  if (status === 400) {
    const issues = error?.details?.issues;
    const formErrors = Array.isArray(issues?.formErrors) ? issues.formErrors : [];
    const fieldErrors = issues?.fieldErrors && typeof issues.fieldErrors === 'object'
      ? Object.values(issues.fieldErrors).flat().filter(Boolean)
      : [];
    const firstValidationError = [...formErrors, ...fieldErrors][0];
    if (firstValidationError) {
      return String(firstValidationError);
    }
  }

  return error?.message || fallback;
};

const Calendar = ({ topNavCollapsed, toggleTopNav }) => {
  const calendarRef = useRef(null);
  const visibleRangeRef = useRef({ start: null, end: null });

  const [dateLabel, setDateLabel] = useState(moment().format('MMMM YYYY'));
  const [currentView, setCurrentView] = useState('month');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [editingEventId, setEditingEventId] = useState(null);
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [eventModalMode, setEventModalMode] = useState('create');
  const [formState, setFormState] = useState(buildDefaultFormState());
  const [sourceFilters, setSourceFilters] = useState({
    custom: true,
    project_due: true,
    quote_issue_date: true,
    quote_valid_until: true,
  });

  const calendarHeight = useWindowHeight() - 180;

  const setFormPatch = (patch) => {
    setFormState((current) => ({
      ...current,
      ...patch,
    }));
  };

  const loadEvents = useCallback(async (start, end) => {
    setLoading(true);
    setError('');

    try {
      const response = await listCalendarEvents({
        start: start.toISOString(),
        end: end.toISOString(),
        includeDerived: true,
      });

      setEvents(Array.isArray(response?.items) ? response.items : []);
    } catch (loadError) {
      setError(mapApiError(loadError, 'Errore caricamento calendario'));
    } finally {
      setLoading(false);
    }
  }, []);

  const reloadVisibleRange = useCallback(async () => {
    const { start, end } = visibleRangeRef.current;
    if (start && end) {
      await loadEvents(start, end);
      return;
    }

    const calendarApi = calendarRef.current?.getApi?.();
    if (!calendarApi) {
      return;
    }

    const currentStart = calendarApi.view.currentStart;
    const currentEnd = calendarApi.view.currentEnd;
    if (!currentStart || !currentEnd) {
      return;
    }

    await loadEvents(currentStart, currentEnd);
  }, [loadEvents]);

  const filteredEvents = useMemo(() => {
    return events.filter((item) => sourceFilters[item.sourceType] !== false);
  }, [events, sourceFilters]);

  const upcomingEvents = useMemo(() => {
    const now = Date.now();

    return filteredEvents
      .filter((item) => new Date(item.start).getTime() >= now)
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
      .slice(0, 8);
  }, [filteredEvents]);

  const handleCalendarNavigation = (action) => {
    const calendarApi = calendarRef.current?.getApi?.();
    if (!calendarApi) {
      return;
    }

    if (action === 'prev') {
      calendarApi.prev();
    } else if (action === 'next') {
      calendarApi.next();
    } else {
      calendarApi.today();
    }
  };

  const handleViewChange = (view) => {
    const calendarApi = calendarRef.current?.getApi?.();
    if (!calendarApi) {
      return;
    }

    if (view === 'week') {
      calendarApi.changeView('timeGridWeek');
    } else if (view === 'day') {
      calendarApi.changeView('timeGridDay');
    } else if (view === 'list') {
      calendarApi.changeView('listWeek');
    } else {
      calendarApi.changeView('dayGridMonth');
    }

    setCurrentView(view);
  };

  const handleDatesSet = useCallback((dateInfo) => {
    visibleRangeRef.current = {
      start: dateInfo.start,
      end: dateInfo.end,
    };

    setDateLabel(moment(dateInfo.view.currentStart).format('MMMM YYYY'));
    void loadEvents(dateInfo.start, dateInfo.end);
  }, [loadEvents]);

  const handleEventClick = (clickInfo) => {
    clickInfo.jsEvent?.preventDefault?.();
    const eventId = clickInfo.event.id;
    const found = filteredEvents.find((item) => item.id === eventId);

    if (found) {
      setSelectedEvent(found);
    }
  };

  const openCreateEventModal = (selectedRange = null) => {
    const nextState = buildDefaultFormState();
    setSelectedEvent(null);
    setEditingEventId(null);

    if (selectedRange) {
      nextState.allDay = Boolean(selectedRange.allDay);
      nextState.startValue = selectedRange.allDay
        ? toLocalDateInput(selectedRange.start)
        : toLocalDateTimeInput(selectedRange.start);
      nextState.endValue = selectedRange.end
        ? (selectedRange.allDay
          ? toLocalDateInput(new Date(selectedRange.end.getTime() - 1))
          : toLocalDateTimeInput(selectedRange.end))
        : '';
    }

    setEventModalMode('create');
    setFormState(nextState);
    setEventModalOpen(true);
  };

  const openEditEventModal = (eventItem) => {
    if (!eventItem) {
      return;
    }

    setEditingEventId(eventItem.id);
    setEventModalMode('edit');
    setFormState({
      title: eventItem.title || '',
      description: eventItem.description || '',
      location: eventItem.location || '',
      category: eventItem.category || '',
      color: normalizeHexColor(eventItem.backgroundColor, '#0d6efd'),
      allDay: Boolean(eventItem.allDay),
      startValue: eventItem.allDay
        ? toLocalDateInput(eventItem.start)
        : toLocalDateTimeInput(eventItem.start),
      endValue: eventItem.end
        ? (eventItem.allDay ? toLocalDateInput(eventItem.end) : toLocalDateTimeInput(eventItem.end))
        : '',
    });
    setEventModalOpen(true);
  };

  const handleEventSelect = (selectionInfo, canCreate) => {
    if (!canCreate) {
      return;
    }

    openCreateEventModal({
      start: selectionInfo.start,
      end: selectionInfo.end,
      allDay: selectionInfo.allDay,
    });
  };

  const handleUpsertEvent = async () => {
    if (!editingEventId && eventModalMode === 'edit') {
      setError('Evento non trovato. Riapri il dettaglio e riprova.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const title = String(formState.title ?? '').trim();
      if (!title) {
        throw new Error('Inserisci un titolo evento.');
      }

      const payload = {
        title,
        description: toOptionalTrimmedString(formState.description),
        location: toOptionalTrimmedString(formState.location),
        category: toOptionalTrimmedString(formState.category),
        color: normalizeHexColor(formState.color, '#0d6efd'),
        allDay: Boolean(formState.allDay),
        startAt: parseFormDateValue(formState.startValue, { allDay: formState.allDay }),
        endAt: parseFormDateValue(formState.endValue, { allDay: formState.allDay, isEnd: true }),
      };

      if (!payload.startAt) {
        throw new Error('Inserisci una data di inizio valida.');
      }

      if (eventModalMode === 'create') {
        await createCalendarEvent(payload);
      } else {
        await updateCalendarEvent(editingEventId, payload);
      }

      setEventModalOpen(false);
      setEditingEventId(null);
      await reloadVisibleRange();
    } catch (submitError) {
      setError(mapApiError(submitError, 'Salvataggio evento non riuscito'));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSelectedEvent = async () => {
    if (!selectedEvent) {
      return;
    }

    const shouldDelete = window.confirm('Confermi eliminazione evento?');
    if (!shouldDelete) {
      return;
    }

    setSaving(true);
    setError('');

    try {
      await deleteCalendarEvent(selectedEvent.id);
      setSelectedEvent(null);
      await reloadVisibleRange();
    } catch (deleteError) {
      setError(mapApiError(deleteError, 'Eliminazione evento non riuscita'));
    } finally {
      setSaving(false);
    }
  };

  const handleDragOrResize = async (interactionInfo, canEdit) => {
    const eventId = interactionInfo.event.id;
    const current = events.find((item) => item.id === eventId);

    if (!current || !current.editable || !canEdit) {
      interactionInfo.revert();
      return;
    }

    setError('');

    try {
      await updateCalendarEvent(eventId, {
        startAt: interactionInfo.event.start?.toISOString(),
        endAt: interactionInfo.event.end ? interactionInfo.event.end.toISOString() : null,
        allDay: interactionInfo.event.allDay,
      });

      await reloadVisibleRange();
    } catch (updateError) {
      interactionInfo.revert();
      setError(mapApiError(updateError, 'Aggiornamento evento non riuscito'));
    }
  };

  const renderEventDetailsModal = (canEdit, canDelete) => {
    if (!selectedEvent) {
      return null;
    }

    return (
      <Modal show={Boolean(selectedEvent)} onHide={() => setSelectedEvent(null)} centered>
        <Modal.Header closeButton>
          <Modal.Title>{selectedEvent.title}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="d-flex align-items-center gap-2 mb-3">
            <Badge bg="light" text="dark">{EVENT_SOURCE_BADGE[selectedEvent.sourceType] || 'Evento'}</Badge>
            <Badge style={{ backgroundColor: selectedEvent.backgroundColor, color: selectedEvent.textColor }}>
              {selectedEvent.category || 'Generale'}
            </Badge>
          </div>

          <div className="small mb-2">
            <strong>Inizio:</strong> {moment(selectedEvent.start).format('DD/MM/YYYY HH:mm')}
          </div>
          <div className="small mb-2">
            <strong>Fine:</strong> {selectedEvent.end ? moment(selectedEvent.end).format('DD/MM/YYYY HH:mm') : '-'}
          </div>
          <div className="small mb-2">
            <strong>Luogo:</strong> {selectedEvent.location || '-'}
          </div>
          <div className="small mb-2">
            <strong>Descrizione:</strong> {selectedEvent.description || '-'}
          </div>
          {selectedEvent.url && (
            <div className="small mb-2">
              <strong>Collegamento:</strong>{' '}
              <Link to={selectedEvent.url} onClick={() => setSelectedEvent(null)}>
                Apri dettaglio
              </Link>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setSelectedEvent(null)}>
            Chiudi
          </Button>
          {selectedEvent.editable && canEdit && (
            <Button
              variant="outline-primary"
              onClick={() => {
                const eventToEdit = selectedEvent;
                setSelectedEvent(null);
                openEditEventModal(eventToEdit);
              }}
            >
              Modifica
            </Button>
          )}
          {selectedEvent.editable && canDelete && (
            <Button variant="danger" onClick={() => void handleDeleteSelectedEvent()} disabled={saving}>
              {saving ? 'Eliminazione...' : 'Elimina'}
            </Button>
          )}
        </Modal.Footer>
      </Modal>
    );
  };

  return (
    <CalendarModuleGate requiredPermission={CALENDAR_PERMISSIONS.view}>
      {({ access }) => {
        const canCreate = hasPermission(access, CALENDAR_PERMISSIONS.create);
        const canEdit = hasPermission(access, CALENDAR_PERMISSIONS.edit);
        const canDelete = hasPermission(access, CALENDAR_PERMISSIONS.delete);

        return (
          <>
            <div className="hk-pg-body py-0">
              <div className="container-fluid pt-3">
                <Row className="g-3">
                  <Col xl={3}>
                    <Card className="card-border h-100">
                      <Card.Body>
                        <div className="d-grid mb-3">
                          <Button onClick={() => openCreateEventModal()} disabled={!canCreate}>
                            Nuovo evento
                          </Button>
                        </div>

                        <div className="small fw-semibold text-uppercase text-muted mb-2">Filtri sorgente</div>
                        <div className="d-grid gap-1 mb-3">
                          {Object.entries(SOURCE_FILTERS).map(([key, label]) => (
                            <Form.Check
                              key={key}
                              id={`calendar-filter-${key}`}
                              type="checkbox"
                              label={label}
                              checked={sourceFilters[key] !== false}
                              onChange={(event) => {
                                const checked = event.target.checked;
                                setSourceFilters((current) => ({
                                  ...current,
                                  [key]: checked,
                                }));
                              }}
                            />
                          ))}
                        </div>

                        <div className="small fw-semibold text-uppercase text-muted mb-2">Prossimi eventi</div>
                        <ListGroup variant="flush">
                          {upcomingEvents.length === 0 && (
                            <ListGroup.Item className="px-0 text-muted small">Nessun evento imminente</ListGroup.Item>
                          )}

                          {upcomingEvents.map((item) => (
                            <ListGroup.Item
                              key={`upcoming-${item.id}`}
                              className="px-0 cursor-pointer"
                              action
                              onClick={() => setSelectedEvent(item)}
                            >
                              <div className="small fw-semibold">{item.title}</div>
                              <div className="small text-muted">{moment(item.start).format('DD/MM/YYYY HH:mm')}</div>
                            </ListGroup.Item>
                          ))}
                        </ListGroup>
                      </Card.Body>
                    </Card>
                  </Col>

                  <Col xl={9}>
                    <Card className="card-border">
                      <Card.Body>
                        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
                          <div className="d-flex align-items-center gap-2">
                            <Button variant="outline-light" onClick={() => handleCalendarNavigation('today')}>
                              Today
                            </Button>
                            <Button
                              variant="flush-dark"
                              className="btn-icon btn-rounded flush-soft-hover"
                              onClick={() => handleCalendarNavigation('prev')}
                            >
                              <span className="icon"><FontAwesomeIcon icon={faChevronLeft} size="sm" /></span>
                            </Button>
                            <Button
                              variant="flush-dark"
                              className="btn-icon btn-rounded flush-soft-hover"
                              onClick={() => handleCalendarNavigation('next')}
                            >
                              <span className="icon"><FontAwesomeIcon icon={faChevronRight} size="sm" /></span>
                            </Button>
                          </div>

                          <h4 className="mb-0 text-capitalize">{dateLabel}</h4>

                          <div className="d-flex align-items-center gap-2">
                            <ButtonGroup className="d-none d-md-flex">
                              <Button variant="outline-light" active={currentView === 'month'} onClick={() => handleViewChange('month')}>Month</Button>
                              <Button variant="outline-light" active={currentView === 'week'} onClick={() => handleViewChange('week')}>Week</Button>
                              <Button variant="outline-light" active={currentView === 'day'} onClick={() => handleViewChange('day')}>Day</Button>
                              <Button variant="outline-light" active={currentView === 'list'} onClick={() => handleViewChange('list')}>List</Button>
                            </ButtonGroup>

                            <Button
                              as="a"
                              variant="flush-dark"
                              className="btn-icon btn-rounded flush-soft-hover hk-navbar-togglable"
                              onClick={() => toggleTopNav(!topNavCollapsed)}
                            >
                              <span className="icon">
                                <span className="feather-icon">
                                  {topNavCollapsed ? <ChevronDown /> : <ChevronUp />}
                                </span>
                              </span>
                            </Button>
                          </div>
                        </div>

                        {error && <Alert variant="danger" className="py-2">{error}</Alert>}

                        {loading && (
                          <div className="d-flex align-items-center gap-2 text-muted small mb-2">
                            <Spinner animation="border" size="sm" />
                            Caricamento calendario...
                          </div>
                        )}

                        <FullCalendar
                          ref={calendarRef}
                          plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
                          initialView="dayGridMonth"
                          locale="it"
                          headerToolbar={false}
                          themeSystem="bootstrap"
                          height={Math.max(520, calendarHeight)}
                          editable={canEdit}
                          selectable={canCreate}
                          events={filteredEvents}
                          datesSet={handleDatesSet}
                          select={(selectionInfo) => handleEventSelect(selectionInfo, canCreate)}
                          eventClick={handleEventClick}
                          eventDrop={(info) => void handleDragOrResize(info, canEdit)}
                          eventResize={(info) => void handleDragOrResize(info, canEdit)}
                        />
                      </Card.Body>
                    </Card>
                  </Col>
                </Row>
              </div>
            </div>

            <Modal
              show={eventModalOpen}
              onHide={() => {
                setEventModalOpen(false);
                setEditingEventId(null);
              }}
              centered
            >
              <Modal.Header closeButton>
                <Modal.Title>{eventModalMode === 'create' ? 'Nuovo evento' : 'Modifica evento'}</Modal.Title>
              </Modal.Header>
              <Modal.Body>
                <Form>
                  <Form.Group className="mb-2">
                    <Form.Label>Titolo</Form.Label>
                    <Form.Control
                      value={formState.title}
                      onChange={(event) => setFormPatch({ title: event.target.value })}
                      maxLength={160}
                    />
                  </Form.Group>

                  <Row className="g-2 mb-2">
                    <Col md={6}>
                      <Form.Group>
                        <Form.Label>Inizio</Form.Label>
                        <Form.Control
                          type={formState.allDay ? 'date' : 'datetime-local'}
                          value={formState.startValue}
                          onChange={(event) => setFormPatch({ startValue: event.target.value })}
                        />
                      </Form.Group>
                    </Col>
                    <Col md={6}>
                      <Form.Group>
                        <Form.Label>Fine</Form.Label>
                        <Form.Control
                          type={formState.allDay ? 'date' : 'datetime-local'}
                          value={formState.endValue}
                          onChange={(event) => setFormPatch({ endValue: event.target.value })}
                        />
                      </Form.Group>
                    </Col>
                  </Row>

                  <Form.Check
                    className="mb-2"
                    type="checkbox"
                    id="calendar-event-all-day"
                    label="Intera giornata"
                    checked={formState.allDay}
                    onChange={(event) => {
                      const checked = event.target.checked;
                      setFormState((current) => ({
                        ...current,
                        allDay: checked,
                        startValue: checked
                          ? toLocalDateInput(current.startValue)
                          : toLocalDateTimeInput(current.startValue),
                        endValue: current.endValue
                          ? (checked ? toLocalDateInput(current.endValue) : toLocalDateTimeInput(current.endValue))
                          : '',
                      }));
                    }}
                  />

                  <Row className="g-2 mb-2">
                    <Col md={6}>
                      <Form.Group>
                        <Form.Label>Categoria</Form.Label>
                        <Form.Control
                          value={formState.category}
                          onChange={(event) => setFormPatch({ category: event.target.value })}
                          maxLength={60}
                        />
                      </Form.Group>
                    </Col>
                    <Col md={6}>
                      <Form.Group>
                        <Form.Label>Luogo</Form.Label>
                        <Form.Control
                          value={formState.location}
                          onChange={(event) => setFormPatch({ location: event.target.value })}
                          maxLength={160}
                        />
                      </Form.Group>
                    </Col>
                  </Row>

                  <Form.Group className="mb-2">
                    <Form.Label>Descrizione</Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={3}
                      value={formState.description}
                      onChange={(event) => setFormPatch({ description: event.target.value })}
                      maxLength={2000}
                    />
                  </Form.Group>

                  <Form.Group>
                    <Form.Label>Colore</Form.Label>
                    <Form.Control
                      type="color"
                      value={formState.color}
                      onChange={(event) => setFormPatch({ color: event.target.value })}
                    />
                  </Form.Group>
                </Form>
              </Modal.Body>
              <Modal.Footer>
                <Button
                  variant="outline-secondary"
                  onClick={() => {
                    setEventModalOpen(false);
                    setEditingEventId(null);
                  }}
                  disabled={saving}
                >
                  Annulla
                </Button>
                <Button onClick={() => void handleUpsertEvent()} disabled={saving}>
                  {saving ? 'Salvataggio...' : 'Salva'}
                </Button>
              </Modal.Footer>
            </Modal>

            {renderEventDetailsModal(canEdit, canDelete)}
          </>
        );
      }}
    </CalendarModuleGate>
  );
};

const mapStateToProps = ({ theme }) => {
  const { topNavCollapsed } = theme;
  return { topNavCollapsed };
};

export default connect(mapStateToProps, { toggleTopNav })(Calendar);
