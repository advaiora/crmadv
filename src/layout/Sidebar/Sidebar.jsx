import React, { useEffect, useMemo, useState } from 'react';
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
import { hasModuleEnabled, hasPermission } from '../../utils/workspaceAccess';

const isExternalPath = (path) => typeof path === 'string' && /^https?:\/\//i.test(path);

const isPathActive = (currentPath, targetPath) => {
    if (!targetPath || isExternalPath(targetPath)) {
        return false;
    }

    if (currentPath === targetPath) {
        return true;
    }

    return currentPath.startsWith(`${targetPath}/`);
};

const hasActivePath = (items, currentPath) => {
    if (!Array.isArray(items) || items.length === 0) {
        return false;
    }

    return items.some((item) => (
        isPathActive(currentPath, item.path) ||
        (Array.isArray(item.childrens) && hasActivePath(item.childrens, currentPath))
    ));
};

const getActiveMenuState = (groups, currentPath) => {
    for (const group of groups) {
        for (const menu of group.contents) {
            if (!Array.isArray(menu.childrens)) {
                continue;
            }

            const menuMatches = isPathActive(currentPath, menu.path) || hasActivePath(menu.childrens, currentPath);
            if (!menuMatches) {
                continue;
            }

            const subMenu = menu.childrens.find((item) => (
                Array.isArray(item.childrens) &&
                (isPathActive(currentPath, item.path) || hasActivePath(item.childrens, currentPath))
            ));

            return {
                menuName: menu.name,
                subMenuName: subMenu?.name,
            };
        }
    }

    return {
        menuName: undefined,
        subMenuName: undefined,
    };
};

const canRenderMenuEntry = (entry, access) => {
    if (entry.requiredModule && !hasModuleEnabled(access, entry.requiredModule)) {
        return false;
    }

    if (entry.requiredPermission && !hasPermission(access, entry.requiredPermission)) {
        return false;
    }

    return true;
};

const filterMenuEntries = (entries, access) => {
    if (!Array.isArray(entries) || entries.length === 0) {
        return [];
    }

    return entries.reduce((accumulator, entry) => {
        if (!canRenderMenuEntry(entry, access)) {
            return accumulator;
        }

        const nextEntry = { ...entry };
        if (Array.isArray(entry.childrens)) {
            const filteredChildren = filterMenuEntries(entry.childrens, access);
            if (filteredChildren.length === 0) {
                if (!entry.path) {
                    return accumulator;
                }

                delete nextEntry.childrens;
            } else {
                nextEntry.childrens = filteredChildren;
            }
        }

        accumulator.push(nextEntry);
        return accumulator;
    }, []);
};

const Sidebar = ({ navCollapsed, toggleCollapsedNav }) => {

    const [activeMenu, setActiveMenu] = useState();
    const [activeSubMenu, setActiveSubMenu] = useState();

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
        const { menuName, subMenuName } = getActiveMenuState(menuGroups, location.pathname);
        setActiveMenu(menuName);
        setActiveSubMenu(subMenuName);
    }, [location.pathname, menuGroups]);

    const handleLeafClick = () => {
        if (windowWidth <= 1199) {
            toggleCollapsedNav(false);
        }
    };

    const handleMenuToggle = (menuName) => {
        setActiveMenu((currentMenu) => (currentMenu === menuName ? undefined : menuName));
    };

    const handleSubMenuToggle = (subMenuName) => {
        setActiveSubMenu((currentSubMenu) => (currentSubMenu === subMenuName ? undefined : subMenuName));
    };

    const backDropToggle = () => {
        toggleCollapsedNav(!navCollapsed);
    };

    return (
        <>
            <div className="hk-menu">
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
                                    {routes.contents.map((menus, idx) => (
                                        <Nav bsPrefix="navbar-nav" className="flex-column" key={idx}>
                                            <Nav.Item className={classNames({ active: isPathActive(location.pathname, menus.path) || hasActivePath(menus.childrens, location.pathname) })}  >
                                                {
                                                    menus.childrens
                                                        ?
                                                        <>
                                                            <Nav.Link aria-expanded={activeMenu === menus.name ? "true" : "false"} onClick={() => handleMenuToggle(menus.name)} >
                                                                <span className={classNames("nav-icon-wrap", { "position-relative": menus.iconBadge })}>
                                                                    {menus.iconBadge && menus.iconBadge}
                                                                    <span className="svg-icon">
                                                                        {menus.icon}
                                                                    </span>
                                                                </span>
                                                                <span className={classNames("nav-link-text", { "position-relative": menus.badgeIndicator })} >
                                                                    {menus.name}
                                                                    {menus.badgeIndicator && menus.badgeIndicator}
                                                                </span>
                                                                {menus.badge && menus.badge}
                                                            </Nav.Link>

                                                            <ul id={menus.id} className={classNames("nav flex-column nav-children", { "collapse": activeMenu !== menus.name })}>
                                                                <li className="nav-item">
                                                                    <ul className="nav flex-column">
                                                                        {menus.childrens.map((subMenu, indx) => (
                                                                            subMenu.childrens
                                                                                ?
                                                                                <li className={classNames("nav-item", { active: isPathActive(location.pathname, subMenu.path) || hasActivePath(subMenu.childrens, location.pathname) })} key={indx} >
                                                                                    <Nav.Link href={`#${subMenu.id}`} className="nav-link" aria-expanded={activeSubMenu === subMenu.name ? "true" : "false"} onClick={(event) => {
                                                                                        event.preventDefault();
                                                                                        handleSubMenuToggle(subMenu.name);
                                                                                    }}>
                                                                                        <span className="nav-link-text">
                                                                                            {subMenu.name}
                                                                                        </span>
                                                                                    </Nav.Link>

                                                                                    {subMenu.childrens.map((childrenPath, i) => (
                                                                                        <ul id={subMenu.id} className={classNames("nav flex-column nav-children", { "collapse": activeSubMenu !== subMenu.name })} key={i}>
                                                                                            <li className="nav-item">
                                                                                                <ul className="nav flex-column">
                                                                                                    <li className="nav-item">
                                                                                                        <Nav.Link as={NavLink} to={childrenPath.path} onClick={handleLeafClick}>
                                                                                                            <span className="nav-link-text">
                                                                                                                {childrenPath.name}
                                                                                                            </span>
                                                                                                        </Nav.Link>
                                                                                                    </li>
                                                                                                </ul>
                                                                                            </li>
                                                                                        </ul>
                                                                                    ))}

                                                                                </li>
                                                                                :
                                                                                <li className="nav-item" key={indx}>
                                                                                    <Nav.Link as={NavLink} to={subMenu.path} onClick={handleLeafClick}>
                                                                                        <span className="nav-link-text">
                                                                                            {subMenu.name}
                                                                                        </span>
                                                                                    </Nav.Link>
                                                                                </li>
                                                                        ))}
                                                                    </ul>
                                                                </li>
                                                            </ul>
                                                        </>
                                                        :
                                                        <>
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
                                                                    <Nav.Link as={NavLink} exact={true} activeClassName="active" to={menus.path} onClick={handleLeafClick} >
                                                                        <span className="nav-icon-wrap">
                                                                            <span className="svg-icon">
                                                                                {menus.icon}
                                                                            </span>
                                                                        </span>
                                                                        <span className="nav-link-text">{menus.name}</span>
                                                                        {menus.badge && menus.badge}
                                                                    </Nav.Link>
                                                            }
                                                        </>
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
