import React, { useCallback, useEffect, useMemo, useState } from 'react';
import SimpleBar from 'simplebar-react';
import { AlignLeft, Bell, LogOut, Settings } from 'react-feather';
import { Button, Container, Dropdown, Nav, Navbar } from 'react-bootstrap';
import { connect } from 'react-redux';
import { Link, useHistory } from 'react-router-dom';
import HkBadge from '../../components/@hk-badge/@hk-badge';
import { toggleCollapsedNav } from '../../redux/action/Theme';
import { ThemeSwitcher } from '../../utils/theme-provider/theme-switcher';
import { fetchWorkspaceAccess } from '../../utils/workspaceAccess';
import { apiPost } from '../../utils/apiClient';
import { useSession } from '../../hooks/useSession';
import { resetGoogleIdentitySession } from '../../utils/googleIdentity';
import { readUserAvatar, USER_PROFILE_PREFS_CHANGED_EVENT } from '../../lib/userProfilePrefs';
import { PROFILE_UPDATED_EVENT } from '../../lib/profileEvents';

const ACTION_LABELS = {
    'me.view': 'Profilo e permessi visualizzati',
    'quotes.email.send': 'Email preventivo inviata',
    'quotes.email.resend': 'Email preventivo reinviata',
    'quotes.create': 'Preventivo creato',
    'quotes.update': 'Preventivo aggiornato',
    'quotes.delete': 'Preventivo eliminato',
    'clients.create': 'Cliente creato',
    'clients.update': 'Cliente aggiornato',
    'clients.delete': 'Cliente eliminato',
    'roles.assign': 'Ruolo assegnato',
    'roles.update': 'Ruolo aggiornato',
    'roles.create': 'Ruolo creato',
    'roles.delete': 'Ruolo eliminato',
    'modules.enable': 'Modulo attivato',
    'modules.disable': 'Modulo disattivato',
    'branding.update': 'Branding workspace aggiornato',
};

const prettifyAction = (action) => {
    if (!action || typeof action !== 'string') {
        return 'Attivita registrata';
    }

    return ACTION_LABELS[action] || action.replaceAll('.', ' ');
};

const formatActivityTime = (isoDate) => {
    if (!isoDate) {
        return '';
    }

    const parsedDate = new Date(isoDate);
    if (Number.isNaN(parsedDate.getTime())) {
        return '';
    }

    return parsedDate.toLocaleString('it-IT', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
};

const buildInitials = (value) => {
    if (!value || typeof value !== 'string') {
        return 'U';
    }

    const words = value
        .trim()
        .split(' ')
        .filter(Boolean);

    if (words.length === 0) {
        return 'U';
    }

    if (words.length === 1) {
        return words[0].slice(0, 2).toUpperCase();
    }

    return `${words[0][0]}${words[1][0]}`.toUpperCase();
};

const TopNav = ({ navCollapsed, toggleCollapsedNav }) => {
    const history = useHistory();
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
        history.push('/login');
    };

    const recentActivity = navbarData?.recentActivity || [];
    const roles = navbarData?.roles || [];
    const permissions = navbarData?.permissions || [];
    const user = navbarData?.user;
    const workspace = navbarData?.workspace;
    const branding = navbarData?.branding;
    const canManageBranding = permissions.includes('branding.manage');

    const notificationCount = recentActivity.length;
    const userDisplayName = user?.name || user?.email || session?.userEmail || 'Utente';
    const userEmail = user?.email || session?.userEmail || '-';
    const workspaceName = branding?.companyName || session?.workspaceBranding?.companyName || workspace?.name || 'Workspace';
    const userInitials = useMemo(() => buildInitials(userDisplayName), [userDisplayName]);
    const avatarUserId = user?.id || session?.userId || '';

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
        <Navbar expand="xl" className="hk-navbar navbar-light fixed-top app-topnav">
            <Container fluid>
                <div className="nav-start-wrap">
                    <Button
                        variant="flush-dark"
                        onClick={() => toggleCollapsedNav(!navCollapsed)}
                        className="btn-icon btn-rounded flush-soft-hover navbar-toggle d-xl-none topnav-action-btn"
                    >
                        <span className="icon">
                            <span className="feather-icon"><AlignLeft /></span>
                        </span>
                    </Button>

                    <div className="app-topnav-workspace d-none d-sm-flex">
                        <span className="app-topnav-workspace-label">Workspace</span>
                        <span className="app-topnav-workspace-name" title={workspaceName}>
                            {workspaceName}
                        </span>
                    </div>
                </div>

                <div className="nav-end-wrap">
                    <Nav className="navbar-nav flex-row">
                        <Nav.Item className="ms-2">
                            <ThemeSwitcher />
                        </Nav.Item>

                        {canManageBranding && (
                            <Nav.Item>
                                <Button
                                    as={Link}
                                    to="/pages/workspace-branding"
                                    variant="flush-dark"
                                    className="btn-icon btn-rounded flush-soft-hover topnav-action-btn"
                                    title="Branding workspace"
                                >
                                    <span className="icon">
                                        <span className="feather-icon"><Settings /></span>
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
                                        {loadingNavbarData && (
                                            <div className="px-2 py-3 fs-7 text-muted">Caricamento notifiche...</div>
                                        )}
                                        {!loadingNavbarData && navbarDataError && (
                                            <div className="px-2 py-3 fs-7 text-danger">{navbarDataError}</div>
                                        )}
                                        {!loadingNavbarData && !navbarDataError && recentActivity.length === 0 && (
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
    );
};

const mapStateToProps = ({ theme }) => {
    const { navCollapsed } = theme;
    return { navCollapsed };
};

export default connect(mapStateToProps, { toggleCollapsedNav })(TopNav);
