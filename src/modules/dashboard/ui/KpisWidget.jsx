import React from 'react';
import { Briefcase, ClipboardCheck, FileText, Users } from 'lucide-react';
import KpiCard from './KpiCard';

// Elenco chiuso: una chiave in piu' in `data` viene ignorata in silenzio, non aggiunge una card.
const KPI_DEFINITIONS = [
  {
    key: 'clientsActive',
    title: 'Clienti attivi',
    helper: 'Clienti attivi nel workspace',
    icon: Users,
  },
  {
    key: 'projectsActive',
    title: 'Progetti attivi',
    helper: 'Progetti in stage aperti',
    icon: Briefcase,
  },
  {
    key: 'quotesSent30d',
    title: 'Preventivi inviati (30g)',
    helper: 'Spediti negli ultimi 30 giorni',
    icon: FileText,
  },
  {
    key: 'checklistOpenItems',
    title: 'Task checklist aperti',
    helper: 'Task obbligatori ancora aperti',
    icon: ClipboardCheck,
  },
];

const KpisWidget = ({ data, loading = false }) => {
  const kpis = data || {};
  // In caricamento non si conosce ancora quali moduli sono attivi: si mostrano tutti gli
  // scheletri, e solo a dati arrivati si nasconde la card di un modulo spento.
  const visibleKpis = loading
    ? KPI_DEFINITIONS
    : KPI_DEFINITIONS.filter((definition) => Object.prototype.hasOwnProperty.call(kpis, definition.key));

  if (visibleKpis.length === 0) {
    return null;
  }

  return (
    <div className="flat-cols-tight grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6 xl:grid-cols-4">
      {visibleKpis.map(({ key, title, helper, icon }) => (
        <KpiCard
          key={key}
          title={title}
          value={kpis[key]}
          helper={helper}
          icon={icon}
          loading={loading}
        />
      ))}
    </div>
  );
};

export default KpisWidget;
