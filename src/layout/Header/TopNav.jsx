import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import SimpleBar from 'simplebar-react';
import { AlignLeft, Bell, LogOut, Settings } from 'react-feather';
import { Button, Container, Dropdown, Nav, Navbar } from 'react-bootstrap';
import { connect } from 'react-redux';
import { Link, useHistory, useLocation } from 'react-router-dom';
import { ToastContainer, toast } from 'react-toastify';
import HkBadge from '../../components/@hk-badge/@hk-badge';
import { toggleCollapsedNav } from '../../redux/action/Theme';
import { ThemeSwitcher } from '../../utils/theme-provider/theme-switcher';
import { fetchWorkspaceAccess, hasModuleEnabled, hasPermission } from '../../utils/workspaceAccess';
import { apiPost } from '../../utils/apiClient';
import { useSession } from '../../hooks/useSession';
import { resetGoogleIdentitySession } from '../../utils/googleIdentity';
import { readUserAvatar, USER_PROFILE_PREFS_CHANGED_EVENT } from '../../lib/userProfilePrefs';
import { PROFILE_UPDATED_EVENT } from '../../lib/profileEvents';
import { listMessagingUsers } from '../../modules/messaging/api/messagingApi';
import { MESSAGING_MODULE_KEY, MESSAGING_PERMISSIONS } from '../../modules/messaging/ui/constants';
import 'react-toastify/dist/ReactToastify.css';

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
    'vault.create': 'Segreto Vault creato',
    'vault.edit': 'Segreto Vault aggiornato',
    'vault.delete': 'Segreto Vault eliminato',
    'vault.reveal': 'Segreto Vault visualizzato',
    'vault.reveal_denied': 'Reveal Vault negato',
    'roles.assign': 'Ruolo assegnato',
    'roles.update': 'Ruolo aggiornato',
    'roles.create': 'Ruolo creato',
    'roles.delete': 'Ruolo eliminato',
    'modules.enable': 'Modulo attivato',
    'modules.disable': 'Modulo disattivato',
    'branding.update': 'Branding workspace aggiornato',
};

const MESSAGING_POLL_INTERVAL_MS = 2000;
const MESSAGING_NOTIFICATIONS_CONTAINER_ID = 'workspace-messaging-notifications';

const normalizeUnreadCount = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
};

const truncateText = (value, maxLength = 80) => {
    if (!value || typeof value !== 'string') {
        return '';
    }

    const normalized = value.trim();
    if (normalized.length <= maxLength) {
        return normalized;
    }

    return `${normalized.slice(0, Math.max(0, maxLength - 3))}...`;
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
    const location = useLocation();
    const { logout, session } = useSession();
    const [navbarData, setNavbarData] = useState(null);
    const [loadingNavbarData, setLoadingNavbarData] = useState(false);
    const [navbarDataError, setNavbarDataError] = useState('');
    const [userAvatarUrl, setUserAvatarUrl] = useState('');
    const [messagingUnreadCount, setMessagingUnreadCount] = useState(0);
    const [messagingPollingBlocked, setMessagingPollingBlocked] = useState(false);
    const unreadByUserRef = useRef(new Map());
    const hasMessagingBaselineRef = useRef(false);

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
        setMessagingUnreadCount(0);
        setMessagingPollingBlocked(false);
        unreadByUserRef.current = new Map();
        hasMessagingBaselineRef.current = false;
        history.push('/login');
    };

    const recentActivity = navbarData?.recentActivity || [];
    const roles = navbarData?.roles || [];
    const permissions = navbarData?.permissions || [];
    const user = navbarData?.user;
    const workspace = navbarData?.workspace;
    const branding = navbarData?.branding;
    const canManageBranding = permissions.includes('branding.manage');
    const canViewMessaging = hasModuleEnabled(navbarData, MESSAGING_MODULE_KEY)
        && hasPermission(navbarData, MESSAGING_PERMISSIONS.view);
    const onMessagingPage = location.pathname.startsWith('/apps/email');
    const activityNotificationCount = recentActivity.length;
    const notificationCount = activityNotificationCount + messagingUnreadCount;
    const userDisplayName = user?.name || user?.email || session?.userEmail || 'Utente';
    const userEmail = user?.email || session?.userEmail || '-';
    const workspaceName = branding?.companyName || session?.workspaceBranding?.companyName || workspace?.name || 'Workspace';
    const userInitials = useMemo(() => buildInitials(userDisplayName), [userDisplayName]);
    const avatarUserId = user?.id || session?.userId || '';

    const pollMessagingUnread = useCallback(async () => {
        if (!session?.accessToken || !canViewMessaging || messagingPollingBlocked) {
            return;
        }

        try {
            const result = await listMessagingUsers({ limit: 80 });
            const contacts = Array.isArray(result?.items) ? result.items : [];

            const nextUnreadByUser = new Map();
            let nextUnreadCount = 0;

            contacts.forEach((contact) => {
                const unreadCount = normalizeUnreadCount(contact?.unreadCount);
                nextUnreadCount += unreadCount;
                nextUnreadByUser.set(contact.userId, {
                    ...contact,
                    unreadCount,
                });
            });

            if (hasMessagingBaselineRef.current && !onMessagingPage) {
                contacts.forEach((contact) => {
                    const previousUnreadCount = normalizeUnreadCount(
                        unreadByUserRef.current.get(contact.userId)?.unreadCount,
                    );
                    const currentUnreadCount = normalizeUnreadCount(contact?.unreadCount);
                    const unreadDelta = currentUnreadCount - previousUnreadCount;

                    if (unreadDelta <= 0) {
                        return;
                    }

                    const senderName = contact?.name || contact?.email || 'utente';
                    const preview = truncateText(contact?.lastMessagePreview, 72);
                    const toastMessage = unreadDelta > 1
                        ? `${senderName} ti ha inviato ${unreadDelta} nuovi messaggi.`
                        : `Nuovo messaggio da ${senderName}${preview ? `: ${preview}` : ''}`;

                    toast.info(toastMessage, {
                        containerId: MESSAGING_NOTIFICATIONS_CONTAINER_ID,
                        autoClose: 5000,
                        onClick: () => history.push('/apps/email'),
                    });
                });
            }

            unreadByUserRef.current = nextUnreadByUser;
            hasMessagingBaselineRef.current = true;
            setMessagingUnreadCount(nextUnreadCount);
        } catch (error) {
            if (Number(error?.status) === 401) {
                return;
            }

            if (Number(error?.status) === 403 || Number(error?.status) === 404) {
                setMessagingPollingBlocked(true);
                setMessagingUnreadCount(0);
                unreadByUserRef.current = new Map();
                hasMessagingBaselineRef.current = false;
            }
        }
    }, [
        canViewMessaging,
        history,
        messagingPollingBlocked,
        onMessagingPage,
        session?.accessToken,
    ]);

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

    useEffect(() => {
        if (!session?.accessToken || !canViewMessaging || messagingPollingBlocked) {
            setMessagingUnreadCount(0);
            unreadByUserRef.current = new Map();
            hasMessagingBaselineRef.current = false;
            return undefined;
        }

        let timeoutId;
        let cancelled = false;

        const runPollingCycle = async () => {
            if (cancelled) {
                return;
            }

            await pollMessagingUnread();

            if (cancelled) {
                return;
            }

            timeoutId = window.setTimeout(runPollingCycle, MESSAGING_POLL_INTERVAL_MS);
        };

        void runPollingCycle();

        return () => {
            cancelled = true;
            if (timeoutId) {
                window.clearTimeout(timeoutId);
            }
        };
    }, [canViewMessaging, messagingPollingBlocked, pollMessagingUnread, session?.accessToken]);

    useEffect(() => {
        if (typeof document === 'undefined') {
            return undefined;
        }

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                void pollMessagingUnread();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [pollMessagingUnread]);

    return (
        <>
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
