import React from 'react';
import { Button, ButtonGroup } from 'react-bootstrap';
import { ChevronDown, ChevronUp } from 'react-feather';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronLeft, faChevronRight } from '@fortawesome/free-solid-svg-icons';

// Barra in cima alla griglia: oggi/precedente/successivo, il periodo che si sta
// guardando, le quattro viste e il tasto che apre e chiude la barra di sistema.
// Estratta da src/views/Calendar/index.jsx nel giro di spezzatura del 5/8/2026.
const CalendarToolbar = ({
  dateLabel,
  currentView,
  onNavigate,
  onViewChange,
  topNavCollapsed,
  onToggleTopNav,
}) => (
  <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
    <div className="d-flex align-items-center gap-2">
      <Button variant="outline-light" onClick={() => onNavigate('today')}>
        Today
      </Button>
      <Button
        variant="flush-dark"
        className="btn-icon btn-rounded flush-soft-hover"
        onClick={() => onNavigate('prev')}
      >
        <span className="icon"><FontAwesomeIcon icon={faChevronLeft} size="sm" /></span>
      </Button>
      <Button
        variant="flush-dark"
        className="btn-icon btn-rounded flush-soft-hover"
        onClick={() => onNavigate('next')}
      >
        <span className="icon"><FontAwesomeIcon icon={faChevronRight} size="sm" /></span>
      </Button>
    </div>

    <h4 className="mb-0 text-capitalize">{dateLabel}</h4>

    <div className="d-flex align-items-center gap-2">
      <ButtonGroup className="d-none d-md-flex">
        <Button variant="outline-light" active={currentView === 'month'} onClick={() => onViewChange('month')}>Month</Button>
        <Button variant="outline-light" active={currentView === 'week'} onClick={() => onViewChange('week')}>Week</Button>
        <Button variant="outline-light" active={currentView === 'day'} onClick={() => onViewChange('day')}>Day</Button>
        <Button variant="outline-light" active={currentView === 'list'} onClick={() => onViewChange('list')}>List</Button>
      </ButtonGroup>

      <Button
        as="a"
        variant="flush-dark"
        className="btn-icon btn-rounded flush-soft-hover hk-navbar-togglable"
        onClick={() => onToggleTopNav(!topNavCollapsed)}
      >
        <span className="icon">
          <span className="feather-icon">
            {topNavCollapsed ? <ChevronDown /> : <ChevronUp />}
          </span>
        </span>
      </Button>
    </div>
  </div>
);

export default CalendarToolbar;
