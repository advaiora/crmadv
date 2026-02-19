import React, { useCallback, useEffect, useMemo, useState } from 'react';
import SimpleBar from 'simplebar-react';
import { AlignLeft, Bell, CheckSquare, CreditCard, Inbox, Search, Settings, Tag } from 'react-feather';
import { Button, Container, Dropdown, Form, InputGroup, Nav, Navbar } from 'react-bootstrap';
import { toggleCollapsedNav } from '../../redux/action/Theme';
import { connect } from 'react-redux';
import { Link, useHistory } from 'react-router-dom';
import classNames from 'classnames';
import { motion } from 'framer-motion';
import HkBadge from '../../components/@hk-badge/@hk-badge';
import { ThemeSwitcher } from '../../utils/theme-provider/theme-switcher';
import { fetchWorkspaceAccess } from '../../utils/workspaceAccess';
import { apiPost } from '../../utils/apiClient';
import { useSession } from '../../hooks/useSession';
import { resetGoogleIdentitySession } from '../../utils/googleIdentity';

// Images
import avatar3 from '../../assets/img/avatar3.jpg';
import avatar4 from '../../assets/img/avatar4.jpg';
import avatar12 from '../../assets/img/avatar12.jpg';

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
    const { logout } = useSession();
    const [showDropdown, setShowDropdown] = useState(false);
    const [searchValue, setSearchValue] = useState('');
    const [navbarData, setNavbarData] = useState(null);
    const [loadingNavbarData, setLoadingNavbarData] = useState(false);
    const [navbarDataError, setNavbarDataError] = useState('');

    const closeSearchInput = () => {
        setSearchValue('');
        setShowDropdown(false);
    };

    const pageVariants = {
        initial: {
            opacity: 0,
            y: 10,
        },
        open: {
            opacity: 1,
            y: 0,
        },
        close: {
            opacity: 0,
            y: 10,
        },
    };

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

    const notificationCount = recentActivity.length;
    const userDisplayName = user?.name || user?.email || 'Utente';
    const userEmail = user?.email || '-';
    const workspaceName = workspace?.name || 'Workspace';
    const userInitials = useMemo(() => buildInitials(userDisplayName), [userDisplayName]);

    return (
        <Navbar expand="xl" className="hk-navbar navbar-light fixed-top">
            <Container fluid>
                {/* Start Nav */}
                <div className="nav-start-wrap">
                    <Button
                        variant="flush-dark"
                        onClick={() => toggleCollapsedNav(!navCollapsed)}
                        className="btn-icon btn-rounded flush-soft-hover navbar-toggle d-xl-none"
                    >
                        <span className="icon">
                            <span className="feather-icon"><AlignLeft /></span>
                        </span>
                    </Button>
                    {/* Search */}
                    <Dropdown as={Form} className="navbar-search" show={showDropdown} autoClose="outside">
                        <Dropdown.Toggle as="div" className="no-caret bg-transparent">
                            <Button
                                variant="flush-dark"
                                className="btn-icon btn-rounded flush-soft-hover d-xl-none"
                                onClick={() => setShowDropdown(!showDropdown)}
                            >
                                <span className="icon">
                                    <span className="feather-icon"><Search /></span>
                                </span>
                            </Button>
                            <InputGroup className="d-xl-flex d-none">
                                <span className="input-affix-wrapper input-search affix-border">
                                    <Form.Control
                                        type="text"
                                        className="bg-transparent"
                                        data-navbar-search-close="false"
                                        placeholder="Search..."
                                        aria-label="Search"
                                        onFocus={() => setShowDropdown(true)}
                                        onBlur={() => setShowDropdown(false)}
                                        value={searchValue}
                                        onChange={(e) => setSearchValue(e.target.value)}
                                    />
                                    <span className="input-suffix" onClick={() => setSearchValue('')}>
                                        <span>/</span>
                                        <span className="btn-input-clear">
                                            <i className="bi bi-x-circle-fill" />
                                        </span>
                                        <span className="spinner-border spinner-border-sm input-loader text-primary" role="status">
                                            <span className="sr-only">Loading...</span>
                                        </span>
                                    </span>
                                </span>
                            </InputGroup>
                        </Dropdown.Toggle>
                        <Dropdown.Menu
                            as={motion.div}
                            initial="initial"
                            animate={showDropdown ? 'open' : 'close'}
                            variants={pageVariants}
                            transition={{ duration: 0.3 }}
                            className={classNames('p-0')}
                        >
                            {/* Mobile Search */}
                            <Dropdown.Item className="d-xl-none bg-transparent">
                                <InputGroup className="mobile-search">
                                    <span className="input-affix-wrapper input-search">
                                        <Form.Control
                                            type="text"
                                            placeholder="Search..."
                                            aria-label="Search"
                                            value={searchValue}
                                            onChange={(e) => setSearchValue(e.target.value)}
                                            onFocus={() => setShowDropdown(true)}
                                            autoFocus
                                        />
                                        <span className="input-suffix" onClick={closeSearchInput}>
                                            <span className="btn-input-clear">
                                                <i className="bi bi-x-circle-fill" />
                                            </span>
                                            <span className="spinner-border spinner-border-sm input-loader text-primary" role="status">
                                                <span className="sr-only">Loading...</span>
                                            </span>
                                        </span>
                                    </span>
                                </InputGroup>
                            </Dropdown.Item>
                            {/* /Mobile Search */}
                            <SimpleBar className="dropdown-body p-2">
                                <Dropdown.Header>Recent Search</Dropdown.Header>
                                <Dropdown.Item className="bg-transparent">
                                    <HkBadge bg="secondary" soft pill className="me-1">React</HkBadge>
                                    <HkBadge bg="secondary" soft pill className="me-1">Node JS</HkBadge>
                                    <HkBadge bg="secondary" soft pill>SCSS</HkBadge>
                                </Dropdown.Item>
                                <Dropdown.Divider as="div" />
                                <Dropdown.Header>Users</Dropdown.Header>
                                <Dropdown.Item as={Link} to="#">
                                    <div className="media align-items-center">
                                        <div className="media-head me-2">
                                            <div className="avatar avatar-xs avatar-rounded">
                                                <img src={avatar3} alt="user" className="avatar-img" />
                                            </div>
                                        </div>
                                        <div className="media-body">Sarah Jone</div>
                                    </div>
                                </Dropdown.Item>
                                <Dropdown.Item as={Link} to="#">
                                    <div className="media align-items-center">
                                        <div className="media-head me-2">
                                            <div className="avatar avatar-xs avatar-soft-primary avatar-rounded">
                                                <span className="initial-wrap">J</span>
                                            </div>
                                        </div>
                                        <div className="media-body">Joe Jackson</div>
                                    </div>
                                </Dropdown.Item>
                                <Dropdown.Item as={Link} to="#">
                                    <div className="media align-items-center">
                                        <div className="media-head me-2">
                                            <div className="avatar avatar-xs avatar-rounded">
                                                <img src={avatar4} alt="user" className="avatar-img" />
                                            </div>
                                        </div>
                                        <div className="media-body">Maria Richard</div>
                                    </div>
                                </Dropdown.Item>
                            </SimpleBar>
                            <div className="dropdown-footer d-xl-flex d-none">
                                <Link to="#">
                                    <u>Search all</u>
                                </Link>
                            </div>
                        </Dropdown.Menu>
                    </Dropdown>
                </div>
                {/* /Start Nav */}
                {/* End Nav */}
                <div className="nav-end-wrap">
                    <Nav className="navbar-nav flex-row">
                        <Nav.Item className="ms-2">
                            <ThemeSwitcher />
                        </Nav.Item>
                        <Nav.Item>
                            <Button variant="flush-dark" as={Link} to="/apps/email" className="btn-icon btn-rounded flush-soft-hover">
                                <span className="icon">
                                    <span className="position-relative">
                                        <span className="feather-icon"><Inbox /></span>
                                        {notificationCount > 0 && (
                                            <HkBadge bg="primary" soft pill size="sm" className="position-top-end-overflow-1">
                                                {notificationCount}
                                            </HkBadge>
                                        )}
                                    </span>
                                </span>
                            </Button>
                        </Nav.Item>
                        <Nav.Item>
                            <Dropdown
                                className="dropdown-notifications"
                                onToggle={(show) => {
                                    if (show) {
                                        void loadNavbarData();
                                    }
                                }}
                            >
                                <Dropdown.Toggle variant="flush-dark" className="btn-icon btn-rounded flush-soft-hover no-caret">
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
                                        Notifications
                                        <Button variant="flush-dark" className="btn-icon btn-rounded flush-soft-hover">
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
                                        <Link to="/apps/email">
                                            <u>Vai alla inbox</u>
                                        </Link>
                                    </div>
                                </Dropdown.Menu>
                            </Dropdown>
                        </Nav.Item>
                        <Nav.Item>
                            <Dropdown className="ps-2">
                                <Dropdown.Toggle as={Link} to="#" className="no-caret">
                                    <div className="avatar avatar-rounded avatar-xs">
                                        <img src={avatar12} alt="user" className="avatar-img" />
                                    </div>
                                </Dropdown.Toggle>
                                <Dropdown.Menu align="end">
                                    <div className="p-2">
                                        <div className="media">
                                            <div className="media-head me-2">
                                                <div className="avatar avatar-primary avatar-sm avatar-rounded">
                                                    <span className="initial-wrap">{userInitials}</span>
                                                </div>
                                            </div>
                                            <div className="media-body">
                                                <span className="d-block fw-medium text-dark">{userDisplayName}</span>
                                                <div className="fs-7">{userEmail}</div>
                                                <div className="fs-8 text-muted">{workspaceName}</div>
                                                <Link to="#" onClick={handleSignOut} className="d-block fs-8 link-secondary mt-1">
                                                    <u>Sign Out</u>
                                                </Link>
                                            </div>
                                        </div>
                                    </div>
                                    <Dropdown.Divider as="div" />
                                    <Dropdown.Item as={Link} to="/pages/profile">Profile</Dropdown.Item>
                                    <Dropdown.Item as={Link} to="/pages/account">Account</Dropdown.Item>
                                    <Dropdown.Item>
                                        <span className="me-2">Ruoli</span>
                                        <span className="badge badge-sm badge-soft-success">{roles.length}</span>
                                    </Dropdown.Item>
                                    <Dropdown.Item>
                                        <span className="me-2">Permessi</span>
                                        <span className="badge badge-sm badge-soft-pink">{permissions.length}</span>
                                    </Dropdown.Item>
                                    <Dropdown.Divider as="div" />
                                    <h6 className="dropdown-header">Manage Account</h6>
                                    <Dropdown.Item>
                                        <span className="dropdown-icon feather-icon">
                                            <CreditCard />
                                        </span>
                                        <span>Payment methods</span>
                                    </Dropdown.Item>
                                    <Dropdown.Item>
                                        <span className="dropdown-icon feather-icon">
                                            <CheckSquare />
                                        </span>
                                        <span>Subscriptions</span>
                                    </Dropdown.Item>
                                    <Dropdown.Item>
                                        <span className="dropdown-icon feather-icon">
                                            <Settings />
                                        </span>
                                        <span>Settings</span>
                                    </Dropdown.Item>
                                    <Dropdown.Divider as="div" />
                                    <Dropdown.Item>
                                        <span className="dropdown-icon feather-icon">
                                            <Tag />
                                        </span>
                                        <span>Raise a ticket</span>
                                    </Dropdown.Item>
                                    <Dropdown.Divider as="div" />
                                    <Dropdown.Item>Terms &amp; Conditions</Dropdown.Item>
                                    <Dropdown.Item>Help &amp; Support</Dropdown.Item>
                                </Dropdown.Menu>
                            </Dropdown>
                        </Nav.Item>
                    </Nav>
                </div>
                {/* /End Nav */}
            </Container>
        </Navbar>
    );
};

const mapStateToProps = ({ theme }) => {
    const { navCollapsed } = theme;
    return { navCollapsed };
};

export default connect(mapStateToProps, { toggleCollapsedNav })(TopNav);
