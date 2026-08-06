import React, { useMemo, useState } from 'react';
import { Button, Offcanvas } from 'react-bootstrap';
import { Home, MessageSquare, MoreHorizontal, Shield, Users } from 'react-feather';
import { NavLink, useLocation } from 'react-router-dom';
import { useWorkspaceAccess } from '../../hooks/useWorkspaceAccess';
import { hasModuleEnabled, hasPermission } from '../../utils/workspaceAccess';

const canAccessItem = (access, item) => {
    if (item.requiredModule && !hasModuleEnabled(access, item.requiredModule)) {
        return false;
    }

    if (item.requiredPermission && !hasPermission(access, item.requiredPermission)) {
        return false;
    }

    return true;
};

const PRIMARY_ITEMS = [
    {
        key: 'dashboard',
        label: 'Dashboard',
        path: '/dashboard',
        icon: Home,
        requiredModule: 'dashboard',
        requiredPermission: 'dashboard.view',
    },
    {
        key: 'clients',
        label: 'Clienti',
        path: '/apps/clients',
        icon: Users,
        requiredModule: 'clients',
        requiredPermission: 'clients.view',
    },
    {
        key: 'projects',
        label: 'Pipeline',
        path: '/projects',
        icon: Shield,
        requiredModule: 'projects',
        requiredPermission: 'projects.view',
    },
    {
        key: 'messages',
        label: 'Messaggi',
        path: '/apps/email',
        icon: MessageSquare,
        requiredModule: 'messages',
        requiredPermission: 'messages.view',
    },
];

const MORE_ITEMS = [
    {
        key: 'team',
        label: 'Team',
        path: '/apps/team',
        requiredModule: 'team',
        requiredPermission: 'team.view',
    },
    {
        key: 'quotes',
        label: 'Preventivi',
        path: '/apps/quotes',
        requiredModule: 'quotes',
        requiredPermission: 'quotes.view',
    },
    {
        key: 'web-assets',
        label: 'Web Assets',
        path: '/apps/web-assets',
        requiredModule: 'web',
        requiredPermission: 'web.view',
    },
    {
        key: 'vault',
        label: 'Vault',
        path: '/apps/vault',
        requiredModule: 'vault',
        requiredPermission: 'vault.view_list',
    },
    {
        key: 'calendar',
        label: 'Calendario',
        path: '/apps/calendar',
        requiredModule: 'calendar',
        requiredPermission: 'calendar.view',
    },
    {
        key: 'audit',
        label: 'Audit',
        path: '/audit',
        requiredModule: 'audit',
        requiredPermission: 'audit.view',
    },
    {
        key: 'profile',
        label: 'Profilo',
        path: '/pages/profile',
    },
];

const MobileBottomNav = () => {
    const location = useLocation();
    const { access } = useWorkspaceAccess();
    const [showMoreSheet, setShowMoreSheet] = useState(false);

    const primaryItems = useMemo(
        () => PRIMARY_ITEMS.filter((item) => canAccessItem(access, item)),
        [access],
    );

    const moreItems = useMemo(
        () => MORE_ITEMS.filter((item) => canAccessItem(access, item)),
        [access],
    );

    if (primaryItems.length === 0) {
        return null;
    }

    return (
        <>
            <nav className="app-mobile-bottom-nav d-xl-none" aria-label="Navigazione mobile principale">
                {primaryItems.map((item) => {
                    const Icon = item.icon;
                    return (
                        <NavLink
                            key={item.key}
                            to={item.path}
                            className="app-mobile-bottom-nav-link"
                            activeClassName="is-active"
                        >
                            <Icon size={16} />
                            <span>{item.label}</span>
                        </NavLink>
                    );
                })}
                <Button
                    type="button"
                    variant="link"
                    className="app-mobile-bottom-nav-link app-mobile-bottom-nav-more"
                    onClick={() => setShowMoreSheet(true)}
                    aria-label="Apri altre sezioni"
                >
                    <MoreHorizontal size={16} />
                    <span>More</span>
                </Button>
            </nav>

            <Offcanvas
                show={showMoreSheet}
                onHide={() => setShowMoreSheet(false)}
                placement="bottom"
                className="app-mobile-more-sheet d-xl-none"
            >
                <Offcanvas.Header closeButton>
                    <Offcanvas.Title>Altri moduli</Offcanvas.Title>
                </Offcanvas.Header>
                <Offcanvas.Body>
                    <div className="app-mobile-more-list">
                        {moreItems.map((item) => {
                            const isActive = location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);
                            return (
                                <NavLink
                                    key={item.key}
                                    to={item.path}
                                    className={`app-mobile-more-link ${isActive ? 'is-active' : ''}`}
                                    onClick={() => setShowMoreSheet(false)}
                                >
                                    <span>{item.label}</span>
                                </NavLink>
                            );
                        })}
                    </div>
                </Offcanvas.Body>
            </Offcanvas>
        </>
    );
};

export default MobileBottomNav;
