import React, { useEffect, useMemo, useRef } from 'react';
import { Nav } from 'react-bootstrap';
import SimpleBar from 'simplebar-react';
import { connect } from 'react-redux';
import { toggleCollapsedNav } from '../../redux/action/Theme';
import { NavLink, useLocation } from 'react-router-dom';
import SidebarHeader from './SidebarHeader';
import { SidebarMenu } from './SidebarMenu';
import classNames from 'classnames';
import { useWindowWidth } from '@react-hook/window-size';
import { useWorkspaceAccess } from '../../hooks/useWorkspaceAccess';
import { filterMenuEntries, hasActivePath, isExternalPath, isPathActive, resolveMenuLinkPath } from './menuUtils';

const Sidebar = ({ navCollapsed, toggleCollapsedNav }) => {

    const menuPanelRef = useRef(null);

    const windowWidth = useWindowWidth();
    const location = useLocation();
    const { access } = useWorkspaceAccess();

    const menuGroups = useMemo(
        () =>
            SidebarMenu.filter((group) => group.group !== 'Documentation')
                .map((group) => ({
                    ...group,
                    contents: filterMenuEntries(group.contents, access),
                }))
                .filter((group) => group.contents.length > 0),
        [access]
    );

    useEffect(() => {
        if (windowWidth > 1199 || !navCollapsed) {
            return undefined;
        }

        const closeOnEscape = (event) => {
            if (event.key === 'Escape') {
                toggleCollapsedNav(false);
            }
        };

        window.addEventListener('keydown', closeOnEscape);
        return () => window.removeEventListener('keydown', closeOnEscape);
    }, [navCollapsed, toggleCollapsedNav, windowWidth]);

    // Desktop: quando il menu è aperto in modalità "fissa" (pieno), un click in
    // qualunque punto FUORI dal menu lo richiude (torna alla barra mini). Prima
    // si poteva chiudere solo dal pulsante in alto a destra.
    useEffect(() => {
        if (windowWidth <= 1199 || navCollapsed) {
            return undefined;
        }

        const handlePointerDown = (event) => {
            const panel = menuPanelRef.current;
            if (panel && !panel.contains(event.target)) {
                toggleCollapsedNav(true);
            }
        };

        document.addEventListener('pointerdown', handlePointerDown);
        return () => document.removeEventListener('pointerdown', handlePointerDown);
    }, [navCollapsed, toggleCollapsedNav, windowWidth]);

    useEffect(() => {
        const panel = menuPanelRef.current;
        if (!panel || windowWidth > 1199 || !navCollapsed) {
            return undefined;
        }

        let startX = 0;
        let startY = 0;

        const onTouchStart = (event) => {
            const touch = event.touches?.[0];
            if (!touch) {
                return;
            }

            startX = touch.clientX;
            startY = touch.clientY;
        };

        const onTouchEnd = (event) => {
            const touch = event.changedTouches?.[0];
            if (!touch) {
                return;
            }

            const deltaX = touch.clientX - startX;
            const deltaY = touch.clientY - startY;

            if (deltaX < -64 && Math.abs(deltaY) < 48) {
                toggleCollapsedNav(false);
            }
        };

        panel.addEventListener('touchstart', onTouchStart, { passive: true });
        panel.addEventListener('touchend', onTouchEnd, { passive: true });

        return () => {
            panel.removeEventListener('touchstart', onTouchStart);
            panel.removeEventListener('touchend', onTouchEnd);
        };
    }, [navCollapsed, toggleCollapsedNav, windowWidth]);

    const handleLeafClick = () => {
        if (windowWidth <= 1199) {
            toggleCollapsedNav(false);
        }
    };

    const backDropToggle = () => {
        toggleCollapsedNav(!navCollapsed);
    };

    return (
        <>
            <div className="hk-menu" ref={menuPanelRef}>
                {/* Brand */}
                <SidebarHeader />
                {/* Main Menu */}
                <SimpleBar className="nicescroll-bar">
                    <div className="menu-content-wrap">
                        {menuGroups.map((routes, index) => (
                            <React.Fragment key={index}>
                                <div className="menu-group" >
                                    {routes.group && <div className="nav-header" >
                                        <span>{routes.group}</span>
                                    </div>}
                                    {/* Ogni modulo è una singola voce: le sottosezioni sono
                                        ora tab in cima alla pagina (ModuleTabs), non più nel
                                        menu a tendina. La voce resta attiva anche sui suoi
                                        sotto-percorsi (via hasActivePath sulle childrens). */}
                                    {routes.contents.map((menus, idx) => (
                                        <Nav bsPrefix="navbar-nav" className="flex-column" key={idx}>
                                            <Nav.Item className={classNames({ active: isPathActive(location.pathname, menus.path) || hasActivePath(menus.childrens, location.pathname) })}>
                                                {
                                                    isExternalPath(menus.path)
                                                        ?
                                                        <a className="nav-link" href={menus.path} target="_blank" rel="noreferrer" >
                                                            <span className="nav-icon-wrap">
                                                                <span className="svg-icon">
                                                                    {menus.icon}
                                                                </span>
                                                            </span>
                                                            <span className="nav-link-text">{menus.name}</span>
                                                            {menus.badge && menus.badge}
                                                        </a>
                                                        :
                                                        <Nav.Link as={NavLink} activeClassName="active" to={resolveMenuLinkPath(menus)} onClick={handleLeafClick} >
                                                            <span className={classNames("nav-icon-wrap", { "position-relative": menus.iconBadge })}>
                                                                {menus.iconBadge && menus.iconBadge}
                                                                <span className="svg-icon">
                                                                    {menus.icon}
                                                                </span>
                                                            </span>
                                                            <span className={classNames("nav-link-text", { "position-relative": menus.badgeIndicator })}>
                                                                {menus.name}
                                                                {menus.badgeIndicator && menus.badgeIndicator}
                                                            </span>
                                                            {menus.badge && menus.badge}
                                                        </Nav.Link>
                                                }
                                            </Nav.Item>
                                        </Nav>
                                    ))}
                                </div>
                                <div className="menu-gap" />
                            </React.Fragment>
                        ))}
                    </div>
                </SimpleBar>
                {/* /Main Menu */}
            </div >
            <div onClick={backDropToggle} className="hk-menu-backdrop" />
        </>
    )
}

const mapStateToProps = ({ theme }) => {
    const { navCollapsed } = theme;
    return { navCollapsed }
};

export default connect(mapStateToProps, { toggleCollapsedNav })(Sidebar);
