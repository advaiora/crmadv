import React, { useCallback, useEffect, useMemo, useState } from 'react';
import SimpleBar from 'simplebar-react';
import { AlignLeft, Bell, Globe, LogOut, Settings } from 'react-feather';
import { Button, Container, Dropdown, Nav, Navbar } from 'react-bootstrap';
import { connect } from 'react-redux';
import { Link, useHistory, useLocation } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import HkBadge from '../../components/@hk-badge/@hk-badge';
import { toggleCollapsedNav } from '../../redux/action/Theme';
import { ThemeSwitcher } from '../../utils/theme-provider/theme-switcher';
import { fetchWorkspaceAccess, hasModuleEnabled, hasPermission, isPlatformAdmin } from '../../utils/workspaceAccess';
import { apiPost } from '../../utils/apiClient';
import { useSession } from '../../hooks/useSession';
import { resetGoogleIdentitySession } from '../../utils/googleIdentity';
import { readUserAvatar, USER_PROFILE_PREFS_CHANGED_EVENT } from '../../lib/userProfilePrefs';
import { PROFILE_UPDATED_EVENT } from '../../lib/profileEvents';
import { CommandPaletteTrigger } from '../../components/command-palette/CommandPalette';
import { AiChatTrigger } from '../../views/Agency/chat/AiChatWidget';
import { MESSAGING_MODULE_KEY, MESSAGING_PERMISSIONS } from '../../modules/messaging/ui/constants';
import { MESSAGING_NOTIFICATIONS_CONTAINER_ID, useMessagingUnreadPoll } from './useMessagingUnreadPoll';
import { buildInitials, formatActivityTime, prettifyAction, resolveMobilePageTitle } from './topNavFormatters';
import 'react-toastify/dist/ReactToastify.css';

const TopNav = ({ navCollapsed, toggleCollapsedNav }) => {
    const history = useHistory();
    const location = useLocation();
    const { logout, session } = useSession();
    const [navbarData, setNavbarData] = useState(null);
    const [loadingNavbarData, setLoadingNavbarData] = useState(false);
    const [navbarDataError, setNavbarDataError] = useState('');
    const [userAvatarUrl, setUserAvatarUrl] = useState('');

    const loadNavbarData = useCallback(async () => {
        setLoadingNavbarData(true);
        setNavbarDataError('');

        try {
            const data = await fetchWorkspaceAccess();
            setNavbarData(data);
        } catch (error) {
            setNavbarData(null);
            setNavbarDataError(error?.message || 'Errore durante il caricamento della navbar.');
        } finally {
            setLoadingNavbarData(false);
        }
    }, []);

    useEffect(() => {
        void loadNavbarData();
    }, [loadNavbarData]);

    useEffect(() => {
        const handleProfileUpdated = () => {
            void loadNavbarData();
        };

        window.addEventListener(PROFILE_UPDATED_EVENT, handleProfileUpdated);
        return () => {
            window.removeEventListener(PROFILE_UPDATED_EVENT, handleProfileUpdated);
        };
    }, [loadNavbarData]);

    const handleSignOut = async (event) => {
        event.preventDefault();
        try {
            await apiPost('/auth/logout');
        } catch (_error) {
            // Logout is best effort for stateless JWT sessions.
        }
        resetGoogleIdentitySession();
        logout();
        setNavbarData(null);
        setNavbarDataError('');
        resetMessagingUnread();
        history.push('/login');
    };

    const recentActivity = navbarData?.recentActivity || [];
    const roles = navbarData?.roles || [];
    const permissions = navbarData?.permissions || [];
    const user = navbarData?.user;
    const workspace = navbarData?.workspace;
    const branding = navbarData?.branding;
    const canManageBranding = permissions.includes('branding.manage');
    // Super Admin di piattaforma: non e' un permesso RBAC ma un flag di identita'
    // sull'utente, quindi si legge con isPlatformAdmin e non da `permissions`.
    const canUsePlatformConsole = isPlatformAdmin(navbarData);
    const canViewMessaging = hasModuleEnabled(navbarData, MESSAGING_MODULE_KEY)
        && hasPermission(navbarData, MESSAGING_PERMISSIONS.view);
    const onMessagingPage = location.pathname.startsWith('/apps/email');
    const activityNotificationCount = recentActivity.length;
    // I messaggi non letti hanno il loro badge sul pulsante Chat (AiChatTrigger):
    // la campana conta SOLO le attività, così lo stesso numero non compare due volte.
    const notificationCount = activityNotificationCount;
    const userDisplayName = user?.name || user?.email || session?.userEmail || 'Utente';
    const userEmail = user?.email || session?.userEmail || '-';
    const workspaceName = branding?.companyName || session?.workspaceBranding?.companyName || workspace?.name || 'Workspace';
    const userInitials = useMemo(() => buildInitials(userDisplayName), [userDisplayName]);
    const avatarUserId = user?.id || session?.userId || '';
    const mobilePageTitle = useMemo(() => resolveMobilePageTitle(location.pathname), [location.pathname]);

    const handleNavigateToMessaging = useCallback(() => history.push('/apps/email'), [history]);
    const { unreadCount: messagingUnreadCount, resetAll: resetMessagingUnread } = useMessagingUnreadPoll({
        enabled: Boolean(session?.accessToken) && canViewMessaging,
        onMessagingPage,
        onNavigateToMessaging: handleNavigateToMessaging,
    });

    useEffect(() => {
        if (!avatarUserId) {
            setUserAvatarUrl('');
            return;
        }

        const syncAvatar = () => {
            setUserAvatarUrl(readUserAvatar(avatarUserId));
        };

        syncAvatar();
        window.addEventListener(USER_PROFILE_PREFS_CHANGED_EVENT, syncAvatar);
        window.addEventListener('storage', syncAvatar);

        return () => {
            window.removeEventListener(USER_PROFILE_PREFS_CHANGED_EVENT, syncAvatar);
            window.removeEventListener('storage', syncAvatar);
        };
    }, [avatarUserId]);

    return (
        <>
            <Navbar expand="xl" className="hk-navbar navbar-light fixed-top app-topnav">
                <Container fluid>
                <div className="nav-start-wrap">
                    <Button
                        variant="flush-dark"
                        onClick={() => toggleCollapsedNav(!navCollapsed)}
                        className="btn-icon btn-rounded flush-soft-hover navbar-toggle d-xl-none topnav-action-btn"
                        aria-label="Apri navigazione"
                    >
                        <span className="icon">
                            <span className="feather-icon"><AlignLeft /></span>
                        </span>
                    </Button>

                    <div className="app-topnav-mobile-title d-sm-none" title={mobilePageTitle}>
                        {mobilePageTitle}
                    </div>

                    <div className="app-topnav-workspace d-none d-sm-flex">
                        <span className="app-topnav-workspace-label">Workspace</span>
                        <span className="app-topnav-workspace-name" title={workspaceName}>
                            {workspaceName}
                        </span>
                    </div>
                </div>

                <div className="nav-end-wrap">
                    <Nav className="navbar-nav flex-row align-items-center">
                        <Nav.Item className="app-topnav-search-item d-none d-sm-flex">
                            <CommandPaletteTrigger />
                        </Nav.Item>

                        <Nav.Item className="ms-2 app-topnav-chat-item">
                            <AiChatTrigger unreadCount={messagingUnreadCount} />
                        </Nav.Item>

                        <Nav.Item className="ms-2 app-topnav-theme-item">
                            <ThemeSwitcher />
                        </Nav.Item>

                        {canManageBranding && (
                            <Nav.Item className="app-topnav-settings-item">
                                <Button
                                    as={Link}
                                    to="/pages/workspace-branding"
                                    variant="flush-dark"
                                    className="btn-icon btn-rounded flush-soft-hover topnav-action-btn"
                                    title="Branding workspace"
                                    aria-label="Apri branding workspace"
                                >
                                    <span className="icon">
                                        <span className="feather-icon"><Settings /></span>
                                    </span>
                                </Button>
                            </Nav.Item>
                        )}

                        {/* Piattaforma: unica area FUORI da ogni workspace, visibile ai soli
                            Super Admin. Sta qui e non nella sidebar perche' si usa di rado —
                            spostata il 5/8/2026. Resta cercabile da Ctrl+K (vedi SidebarMenu.jsx).
                            ⚠️ NON aggiungere qui la classe `app-topnav-settings-item` che ha il
                            pulsante Branding qui sopra: quella classe nasconde l'elemento sotto i
                            576px (globals.css). Sul pulsante Branding va bene, perche' e' una
                            scorciatoia a una pagina che resta comunque nel menu; qui invece questo
                            e' l'UNICO ingresso all'area, e nasconderlo la renderebbe irraggiungibile
                            da telefono (la voce non e' piu' in sidebar, e Ctrl+K sotto i 576px e'
                            a sua volta nascosto). */}
                        {canUsePlatformConsole && (
                            <Nav.Item>
                                <Button
                                    as={Link}
                                    to="/settings/platform-console"
                                    variant="flush-dark"
                                    className="btn-icon btn-rounded flush-soft-hover topnav-action-btn"
                                    title="Piattaforma — workspace e consumi AI"
                                    aria-label="Apri Piattaforma — workspace e consumi AI"
                                >
                                    <span className="icon">
                                        <span className="feather-icon"><Globe /></span>
                                    </span>
                                </Button>
                            </Nav.Item>
                        )}

                        <Nav.Item>
                            <Dropdown
                                className="dropdown-notifications"
                                onToggle={(show) => {
                                    if (show) {
                                        void loadNavbarData();
                                    }
                                }}
                            >
                                <Dropdown.Toggle
                                    variant="flush-dark"
                                    className="btn-icon btn-rounded flush-soft-hover no-caret topnav-action-btn"
                                    aria-label="Apri notifiche"
                                >
                                    <span className="icon">
                                        <span className="position-relative">
                                            <span className="feather-icon"><Bell /></span>
                                            {notificationCount > 0 && (
                                                <HkBadge bg="success" indicator className="position-top-end-overflow-1" />
                                            )}
                                        </span>
                                    </span>
                                </Dropdown.Toggle>
                                <Dropdown.Menu align="end" className="p-0">
                                    <Dropdown.Header className="px-4 fs-6">
                                        Notifiche
                                        <Button
                                            variant="flush-dark"
                                            className="btn-icon btn-rounded flush-soft-hover topnav-action-btn"
                                            onClick={() => void loadNavbarData()}
                                        >
                                            <span className="icon">
                                                <span className="feather-icon"><Settings /></span>
                                            </span>
                                        </Button>
                                    </Dropdown.Header>
                                    <SimpleBar className="dropdown-body p-2">
                                        {canViewMessaging && (
                                            <Dropdown.Item as={Link} to="/apps/email">
                                                <div className="media">
                                                    <div className="media-head">
                                                        <div className="avatar avatar-icon avatar-sm avatar-soft-light avatar-rounded">
                                                            <span className="initial-wrap">
                                                                <span className="feather-icon"><Bell /></span>
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className="media-body">
                                                        <div>
                                                            <div className="notifications-text">Messaggi interni</div>
                                                            <div className="notifications-info">
                                                                {messagingUnreadCount > 0 ? (
                                                                    <HkBadge bg="danger" soft>{messagingUnreadCount} non letti</HkBadge>
                                                                ) : (
                                                                    <div className="notifications-time">Nessun messaggio non letto</div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </Dropdown.Item>
                                        )}
                                        {loadingNavbarData && (
                                            <div className="px-2 py-3 fs-7 text-muted">Caricamento notifiche...</div>
                                        )}
                                        {!loadingNavbarData && navbarDataError && (
                                            <div className="px-2 py-3 fs-7 text-danger">{navbarDataError}</div>
                                        )}
                                        {!loadingNavbarData && !navbarDataError && recentActivity.length === 0 && !canViewMessaging && (
                                            <div className="px-2 py-3 fs-7 text-muted">Nessuna attivita recente.</div>
                                        )}
                                        {!loadingNavbarData && !navbarDataError && recentActivity.map((item) => {
                                            const actorName = item?.actor?.name || item?.actor?.email;
                                            const notificationText = actorName
                                                ? `${prettifyAction(item.action)} - ${actorName}`
                                                : prettifyAction(item.action);

                                            return (
                                                <Dropdown.Item key={item.id}>
                                                    <div className="media">
                                                        <div className="media-head">
                                                            <div className="avatar avatar-icon avatar-sm avatar-soft-light avatar-rounded">
                                                                <span className="initial-wrap">
                                                                    <span className="feather-icon"><Bell /></span>
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <div className="media-body">
                                                            <div>
                                                                <div className="notifications-text">{notificationText}</div>
                                                                <div className="notifications-info">
                                                                    {item.entityType && (
                                                                        <HkBadge bg="secondary" soft>{item.entityType}</HkBadge>
                                                                    )}
                                                                    <div className="notifications-time">{formatActivityTime(item.createdAt)}</div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </Dropdown.Item>
                                            );
                                        })}
                                    </SimpleBar>
                                    <div className="dropdown-footer">
                                        <Link to="/pages/profile">
                                            <u>Apri profilo</u>
                                        </Link>
                                    </div>
                                </Dropdown.Menu>
                            </Dropdown>
                        </Nav.Item>

                        <Nav.Item>
                            <Dropdown className="ps-2">
                                <Dropdown.Toggle
                                    variant="flush-dark"
                                    className="no-caret btn-icon btn-rounded flush-soft-hover app-topnav-avatar-trigger"
                                    aria-label="Apri menu utente"
                                >
                                    {userAvatarUrl ? (
                                        <span className="app-topnav-avatar p-0 overflow-hidden">
                                            <img
                                                src={userAvatarUrl}
                                                alt="Avatar utente"
                                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                            />
                                        </span>
                                    ) : (
                                        <span className="app-topnav-avatar">{userInitials}</span>
                                    )}
                                </Dropdown.Toggle>
                                <Dropdown.Menu align="end" className="app-topnav-user-menu">
                                    <div className="p-3">
                                        <div className="d-flex align-items-start gap-2">
                                            {userAvatarUrl ? (
                                                <span className="app-topnav-avatar app-topnav-avatar-lg p-0 overflow-hidden">
                                                    <img
                                                        src={userAvatarUrl}
                                                        alt="Avatar utente"
                                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                    />
                                                </span>
                                            ) : (
                                                <span className="app-topnav-avatar app-topnav-avatar-lg">{userInitials}</span>
                                            )}
                                            <div>
                                                <span className="d-block fw-medium app-topnav-user-name">{userDisplayName}</span>
                                                <div className="fs-7 app-topnav-user-email">{userEmail}</div>
                                                <div className="fs-8 app-topnav-user-workspace">{workspaceName}</div>
                                            </div>
                                        </div>
                                        <div className="app-topnav-user-meta mt-2">
                                            <span>Ruoli: {roles.length}</span>
                                            <span>Permessi: {permissions.length}</span>
                                        </div>
                                    </div>
                                    <Dropdown.Divider as="div" />
                                    <Dropdown.Item as={Link} to="/pages/profile">Profilo</Dropdown.Item>
                                    <Dropdown.Item as={Link} to="/pages/account">Account</Dropdown.Item>
                                    {canManageBranding && (
                                        <Dropdown.Item as={Link} to="/pages/workspace-branding">
                                            Branding Workspace
                                        </Dropdown.Item>
                                    )}
                                    <Dropdown.Divider as="div" />
                                    <Dropdown.Item onClick={handleSignOut}>
                                        <span className="dropdown-icon feather-icon">
                                            <LogOut />
                                        </span>
                                        <span>Esci</span>
                                    </Dropdown.Item>
                                </Dropdown.Menu>
                            </Dropdown>
                        </Nav.Item>
                    </Nav>
                </div>
                </Container>
            </Navbar>
            <ToastContainer
                containerId={MESSAGING_NOTIFICATIONS_CONTAINER_ID}
                position="bottom-right"
                theme="light"
                newestOnTop
                closeOnClick
                pauseOnFocusLoss
                pauseOnHover
                limit={4}
            />
        </>
    );
};

const mapStateToProps = ({ theme }) => {
    const { navCollapsed } = theme;
    return { navCollapsed };
};

export default connect(mapStateToProps, { toggleCollapsedNav })(TopNav);
