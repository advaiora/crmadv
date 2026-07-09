import React, { useState } from 'react';
import { Alert, Nav, Spinner } from 'react-bootstrap';
import { ShieldCheck, Building2, Activity } from 'lucide-react';
import { ToastContainer } from 'react-toastify';
import { useWorkspaceAccess } from '../../hooks/useWorkspaceAccess';
import { isPlatformAdmin } from '../../utils/workspaceAccess';
import PlatformWorkspacesPanel from './platform/PlatformWorkspacesPanel';
import PlatformAiUsagePanel from './platform/PlatformAiUsagePanel';

const TABS = {
  workspaces: 'workspaces',
  ai: 'ai',
};

// Guscio della Console piattaforma: intestazione + navigazione a due sotto-pagine
// (Gestione workspace & accessi / Consumi & costi AI). Ogni pannello carica i
// propri dati in autonomia, così la console resta leggera e non troppo densa.
const PlatformConsole = () => {
  const { access, loading: accessLoading } = useWorkspaceAccess();
  const canUseConsole = isPlatformAdmin(access);
  const currentUserId = access?.user?.id || null;

  const [activeTab, setActiveTab] = useState(TABS.workspaces);

  if (accessLoading) {
    return (
      <div className="container-fluid py-4 d-flex justify-content-center">
        <Spinner animation="border" role="status" />
      </div>
    );
  }

  if (!canUseConsole) {
    return (
      <div className="container-fluid py-4">
        <Alert variant="warning" className="mb-0">
          Questa area è riservata ai Super Admin di piattaforma.
        </Alert>
      </div>
    );
  }

  return (
    <div className="container-fluid py-4">
      <div className="mb-4">
        <h3 className="mb-1 d-flex align-items-center gap-2">
          <ShieldCheck size={22} />
          Console piattaforma
        </h3>
        <p className="text-muted mb-0">
          Gestione globale dei workspace e monitoraggio dei consumi AI, al di sopra dei singoli workspace.
        </p>
      </div>

      <Nav variant="pills" className="mb-4 gap-2" activeKey={activeTab}>
        <Nav.Item>
          <Nav.Link
            eventKey={TABS.workspaces}
            onClick={() => setActiveTab(TABS.workspaces)}
            className="d-inline-flex align-items-center gap-2"
          >
            <Building2 size={16} />
            Gestione workspace &amp; accessi
          </Nav.Link>
        </Nav.Item>
        <Nav.Item>
          <Nav.Link
            eventKey={TABS.ai}
            onClick={() => setActiveTab(TABS.ai)}
            className="d-inline-flex align-items-center gap-2"
          >
            <Activity size={16} />
            Consumi &amp; costi AI
          </Nav.Link>
        </Nav.Item>
      </Nav>

      {activeTab === TABS.workspaces ? (
        <PlatformWorkspacesPanel currentUserId={currentUserId} />
      ) : (
        <PlatformAiUsagePanel />
      )}

      <ToastContainer position="bottom-right" theme="light" />
    </div>
  );
};

export default PlatformConsole;
