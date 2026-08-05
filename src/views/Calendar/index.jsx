import React from 'react';
import { Card, Col, Row } from 'react-bootstrap';
import { connect } from 'react-redux';
import { toggleTopNav } from '../../redux/action/Theme';
import CalendarModuleGate from '../../modules/calendar/ui/CalendarModuleGate';
import { CALENDAR_PERMISSIONS } from '../../modules/calendar/ui/constants';
import { hasPermission } from '../../utils/workspaceAccess';
import { useCalendarBoard } from './board/hooks/useCalendarBoard';
import CalendarFiltersPanel from './board/CalendarFiltersPanel';
import CalendarToolbar from './board/CalendarToolbar';
import CalendarGrid from './board/CalendarGrid';
import CalendarEventFormModal from './board/CalendarEventFormModal';
import CalendarEventDetailsModal from './board/CalendarEventDetailsModal';

// Pagina Calendario. Tutta la logica sta in `useCalendarBoard`; qui restano il
// gate dei permessi, la composizione dei cinque pezzi e lo stato Redux della
// barra di sistema.
//
// L'hook si chiama FUORI dal gate — dentro sarebbe un hook condizionato — e
// resta cieco ai permessi: i tre `can*` si calcolano qui e si passano ai pezzi
// che li usano, esattamente come faceva il file unico.
//
// Esportata anche col nome, oltre che collegata a Redux qui sotto: cosi' il
// test del cablaggio la monta senza tirarsi dietro lo store.
export const CalendarPage = ({ topNavCollapsed, toggleTopNav }) => {
  const board = useCalendarBoard();

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
                    <CalendarFiltersPanel
                      canCreate={canCreate}
                      onCreateEvent={board.openCreateEventModal}
                      sourceFilters={board.sourceFilters}
                      onToggleSourceFilter={board.toggleSourceFilter}
                      upcomingEvents={board.upcomingEvents}
                      onSelectEvent={board.setSelectedEvent}
                    />
                  </Col>

                  <Col xl={9}>
                    <Card className="card-border">
                      <Card.Body>
                        <CalendarToolbar
                          dateLabel={board.dateLabel}
                          currentView={board.currentView}
                          onNavigate={board.handleCalendarNavigation}
                          onViewChange={board.handleViewChange}
                          topNavCollapsed={topNavCollapsed}
                          onToggleTopNav={toggleTopNav}
                        />

                        <CalendarGrid
                          error={board.error}
                          loading={board.loading}
                          calendarRef={board.calendarRef}
                          calendarHeight={board.calendarHeight}
                          events={board.filteredEvents}
                          canCreate={canCreate}
                          canEdit={canEdit}
                          onDatesSet={board.handleDatesSet}
                          onSelectRange={board.handleEventSelect}
                          onEventClick={board.handleEventClick}
                          onDragOrResize={board.handleDragOrResize}
                        />
                      </Card.Body>
                    </Card>
                  </Col>
                </Row>
              </div>
            </div>

            <CalendarEventFormModal
              open={board.eventModalOpen}
              mode={board.eventModalMode}
              formState={board.formState}
              onPatch={board.setFormPatch}
              onAllDayChange={board.setAllDay}
              onClose={board.closeEventModal}
              onSubmit={board.handleUpsertEvent}
              saving={board.saving}
            />

            <CalendarEventDetailsModal
              event={board.selectedEvent}
              onClose={() => board.setSelectedEvent(null)}
              // L'evento arriva come argomento, non letto dallo stato che si sta
              // azzerando: cosi' l'ordine chiudi-poi-apri non puo' perderlo.
              onEdit={(eventToEdit) => {
                board.setSelectedEvent(null);
                board.openEditEventModal(eventToEdit);
              }}
              onDelete={board.handleDeleteSelectedEvent}
              canEdit={canEdit}
              canDelete={canDelete}
              saving={board.saving}
            />
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

export default connect(mapStateToProps, { toggleTopNav })(CalendarPage);
