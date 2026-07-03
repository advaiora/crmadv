import React, { useEffect, useState } from 'react';
import classNames from 'classnames';
import { connect } from 'react-redux';
import { useRouteMatch } from 'react-router-dom';
import { toggleCollapsedNav } from '../../../redux/action/Theme';
import GlassPointer from '../../../components/effects/GlassPointer';
import CommandPalette from '../../../components/command-palette/CommandPalette';
import PageFooter from '../../Footer/PageFooter';
import TopNav from '../../Header/TopNav';
import MobileBottomNav from '../../Mobile/MobileBottomNav';
import Sidebar from '../../Sidebar/Sidebar';
import { useWindowWidth } from '@react-hook/window-size';

const LayoutClassic = ({ children, navCollapsed, topNavCollapsed, toggleCollapsedNav }) => {

    const [dataHover, setDataHover] = useState(navCollapsed);
    const appRoutes = useRouteMatch('/apps/');
    const errro404Route = useRouteMatch('/error-404');
    const windowWidth = useWindowWidth();

    useEffect(() => {
        if (appRoutes && windowWidth >= 1200) {
            toggleCollapsedNav(true);
        }

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [windowWidth, appRoutes])

    useEffect(() => {
        if (windowWidth < 1200) {
            toggleCollapsedNav(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [windowWidth]);

    useEffect(() => {
        setTimeout(() => {
            setDataHover(navCollapsed);
        }, 250);
    }, [navCollapsed]);


    return (
        <div
            className={classNames("hk-wrapper", { "hk-pg-auth": errro404Route })}
            data-layout="vertical"
            data-layout-style={navCollapsed ? "collapsed" : "default"}
            data-navbar-style={topNavCollapsed ? "collapsed" : ""}
            data-menu="light"
            data-footer="simple"
            data-hover={dataHover ? "active" : ""}
        >
            {/* Riflesso vetro reattivo al mouse su bordi e separatori */}
            <GlassPointer />
            {/* Ricerca globale / navigazione (Cmd/Ctrl+K) */}
            <CommandPalette />
            {/* Top Navbar */}
            <TopNav />
            {/* Vertical Nav */}
            <Sidebar />
            <div className={classNames("hk-pg-wrapper app-shell-content", { "app-shell-no-footer-gap": appRoutes })}>
                {children}
                {!appRoutes && <PageFooter />}
            </div>
            <MobileBottomNav />
        </div>
    )
}

const mapStateToProps = ({ theme }) => {
    const { navCollapsed, topNavCollapsed } = theme;
    return { navCollapsed, topNavCollapsed }
};

export default connect(mapStateToProps, { toggleCollapsedNav })(LayoutClassic)
