import React from 'react';
import { Briefcase, ClipboardCheck, FileText, Users } from 'lucide-react';
import KpiCard from './KpiCard';

const KpisWidget = ({ data, loading = false }) => {
  const kpis = data || {
    clientsActive: 0,
    projectsActive: 0,
    quotesSent30d: 0,
    checklistOpenItems: 0,
  };

  return (
    <div className="flat-cols-tight grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6 xl:grid-cols-4">
      <KpiCard
        title="Clienti attivi"
        value={kpis.clientsActive}
        helper="Clienti attivi nel workspace"
        icon={Users}
        loading={loading}
      />
      <KpiCard
        title="Progetti attivi"
        value={kpis.projectsActive}
        helper="Progetti in stage aperti"
        icon={Briefcase}
        loading={loading}
      />
      <KpiCard
        title="Preventivi inviati (30g)"
        value={kpis.quotesSent30d}
        helper="Spediti negli ultimi 30 giorni"
        icon={FileText}
        loading={loading}
      />
      <KpiCard
        title="Task checklist aperti"
        value={kpis.checklistOpenItems}
        helper="Task obbligatori ancora aperti"
        icon={ClipboardCheck}
        loading={loading}
      />
    </div>
  );
};

export default KpisWidget;
