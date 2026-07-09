import React, { useMemo } from 'react';
import { Nav } from 'react-bootstrap';
import { NavLink, useLocation } from 'react-router-dom';
import { useWorkspaceAccess } from '../../hooks/useWorkspaceAccess';
import { SidebarMenu } from '../Sidebar/SidebarMenu';
import {
  buildChildIsActive,
  filterMenuEntries,
  findActiveModuleWithTabs,
  isExternalPath,
} from '../Sidebar/menuUtils';

// Barra di sottoschede in cima al modulo corrente: sostituisce le sottosezioni
// che prima comparivano nel menu a tendina della sidebar. Riusa le rotte già
// esistenti (nessuna pagina spostata) e la stessa logica di attivazione/permessi
// della sidebar. Non mostra nulla se il modulo ha una sola sottoscheda (o nessuna).
const ModuleTabs = () => {
  const location = useLocation();
  const { access } = useWorkspaceAccess();

  const tabs = useMemo(() => {
    const groups = SidebarMenu
      .map((group) => ({ ...group, contents: filterMenuEntries(group.contents, access) }))
      .filter((group) => group.contents.length > 0);

    const activeModule = findActiveModuleWithTabs(groups, location.pathname);
    if (!activeModule || !Array.isArray(activeModule.childrens)) {
      return [];
    }

    // Solo sottoschede interne (niente link esterni) con percorso valido.
    const usable = activeModule.childrens.filter((child) => child.path && !isExternalPath(child.path));

    // Una sola sottoscheda = nessuna barra (la voce principale della sidebar basta).
    return usable.length >= 2 ? usable : [];
  }, [access, location.pathname]);

  if (tabs.length === 0) {
    return null;
  }

  return (
    <div className="module-tabs-bar container-fluid">
      <Nav variant="pills" className="module-tabs-nav flex-nowrap gap-2">
        {tabs.map((tab) => (
          <Nav.Item key={tab.path}>
            <Nav.Link
              as={NavLink}
              to={tab.path}
              isActive={buildChildIsActive(tab.path, tabs)}
              className="text-nowrap"
            >
              {tab.name}
            </Nav.Link>
          </Nav.Item>
        ))}
      </Nav>
    </div>
  );
};

export default ModuleTabs;
