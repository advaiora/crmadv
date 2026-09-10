import React, { useEffect, useMemo } from 'react';
import { Alert, Badge, Button, Card, Col, Container, Row, Spinner } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { connect } from 'react-redux';
import { toggleCollapsedNav } from '../../../redux/action/Theme';
import { useWorkspaceAccess } from '../../../hooks/useWorkspaceAccess';
import { hasPermission } from '../../../utils/workspaceAccess';
import { useTheme } from '../../../utils/theme-provider/theme-provider';
import { initialsFromUser, resolveAvatarUrl } from './profileFormatters';
import ProfileAvatarCard from './ProfileAvatarCard';
import ProfileIdentityForm from './ProfileIdentityForm';
import ProfileChangePasswordCard from './ProfileChangePasswordCard';

const THEME_OPTIONS = [
    { value: 'light', label: 'Chiaro' },
    { value: 'dark', label: 'Scuro' },
    { value: 'system', label: 'Automatico' },
];

const pageCardStyle = {
    borderRadius: '18px',
};

const heroCardStyle = {
    borderRadius: '18px',
    border: '1px solid var(--hk-border-primary)',
    background: 'var(--hk-bg-primary)',
};

const Profile = ({ toggleCollapsedNav }) => {
    const { access, loading, error, reload } = useWorkspaceAccess();
    const { themePreference, setThemePreference } = useTheme();

    useEffect(() => {
        toggleCollapsedNav(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const { user, workspace, permissions } = useMemo(
        () => ({
            user: access?.user ?? null,
            workspace: access?.workspace ?? null,
            permissions: Array.isArray(access?.permissions) ? access.permissions : [],
        }),
        [access],
    );

    const canManageBranding = hasPermission({ permissions }, 'branding.manage');
    const avatarUrl = resolveAvatarUrl(user);

    // La Row resta montata anche durante un `reload()` in background (dopo un
    // salvataggio riuscito in una delle card sotto): se si smontasse a ogni giro
    // di `loading`, le card figlie perderebbero il proprio stato — compreso il
    // messaggio di conferma appena mostrato — invece di limitarsi a un lampeggio.
    // Lo spinner e l'errore bloccante restano per il SOLO primo caricamento,
    // quando non c'e' ancora niente da mostrare.
    const hasAccess = Boolean(access);

    return (
        <div className="hk-pg-body">
            <Container className="py-3 py-lg-4">
                <div className="hk-pg-header pt-5 pb-4">
                    <h1 className="pg-title">Profilo</h1>
                    <p className="mb-0">Gestisci i dati principali del tuo account.</p>
                </div>

                {loading && !hasAccess && (
                    <div className="d-flex align-items-center gap-2 text-muted py-4">
                        <Spinner animation="border" size="sm" />
                        Caricamento profilo...
                    </div>
                )}

                {!hasAccess && !loading && error && (
                    <Alert variant="danger" className="d-flex flex-wrap align-items-center justify-content-between gap-2">
                        <span>{error}</span>
                        <Button variant="outline-danger" size="sm" onClick={() => void reload()}>
                            Riprova
                        </Button>
                    </Alert>
                )}

                {hasAccess && (
                    <Row className="g-4">
                        {error && (
                            <Col lg={12}>
                                <Alert variant="danger" className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-0">
                                    <span>{error}</span>
                                    <Button variant="outline-danger" size="sm" onClick={() => void reload()}>
                                        Riprova
                                    </Button>
                                </Alert>
                            </Col>
                        )}

                        <Col lg={12}>
                            <Card className="card-border shadow-none" style={heroCardStyle}>
                                <Card.Body className="p-4 p-lg-5">
                                    <div className="d-flex flex-column flex-lg-row align-items-start justify-content-between gap-4">
                                        <div className="d-flex align-items-center gap-3 gap-lg-4">
                                            <div className="avatar avatar-xxl avatar-rounded overflow-hidden shadow-sm">
                                                {avatarUrl ? (
                                                    <img
                                                        src={avatarUrl}
                                                        alt="Avatar profilo"
                                                        className="avatar-img"
                                                        style={{ objectFit: 'cover' }}
                                                    />
                                                ) : (
                                                    <span className="initial-wrap fs-4">{initialsFromUser(user)}</span>
                                                )}
                                            </div>

                                            <div>
                                                <h3 className="mb-1">{user?.name || 'Utente'}</h3>
                                                <div className="text-muted mb-2">{user?.email || '-'}</div>
                                                <div className="d-flex flex-wrap gap-2">
                                                    <Badge bg="light" text="dark">Ruolo: {user?.role || '-'}</Badge>
                                                    <Badge bg="light" text="dark">Workspace: {workspace?.name || '-'}</Badge>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="d-flex flex-wrap gap-2">
                                            <Button as={Link} to="/pages/account" variant="primary" size="sm">
                                                Apri account
                                            </Button>
                                            {canManageBranding && (
                                                <Button as={Link} to="/pages/workspace-branding" variant="outline-primary" size="sm">
                                                    Branding workspace
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </Card.Body>
                            </Card>
                        </Col>

                        <Col lg={12}>
                            <Card className="card-border shadow-none" style={pageCardStyle}>
                                <Card.Body className="p-4">
                                    <h5 className="mb-1">Aspetto</h5>
                                    <p className="text-muted small mb-3">
                                        Scegli il tema dell&apos;interfaccia. La preferenza ti segue su tutti i dispositivi.
                                    </p>
                                    <div className="d-flex flex-wrap gap-2">
                                        {THEME_OPTIONS.map((option) => (
                                            <Button
                                                key={option.value}
                                                type="button"
                                                size="sm"
                                                variant={themePreference === option.value ? 'primary' : 'outline-secondary'}
                                                onClick={() => setThemePreference(option.value)}
                                            >
                                                {option.label}
                                            </Button>
                                        ))}
                                    </div>
                                </Card.Body>
                            </Card>
                        </Col>

                        <Col lg={7}>
                            <ProfileIdentityForm user={user} reload={reload} cardStyle={pageCardStyle} />
                        </Col>

                        <Col lg={5}>
                            <ProfileAvatarCard user={user} reload={reload} cardStyle={pageCardStyle} />
                        </Col>

                        <Col lg={7}>
                            <ProfileChangePasswordCard cardStyle={pageCardStyle} />
                        </Col>
                    </Row>
                )}
            </Container>
        </div>
    );
};

const mapStateToProps = ({ theme }) => {
    const { navCollapsed } = theme;
    return { navCollapsed };
};

export default connect(mapStateToProps, { toggleCollapsedNav })(Profile);
