import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Button, Card, Col, Container, Form, Row, Spinner } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { connect } from 'react-redux';
import { toggleCollapsedNav } from '../../../redux/action/Theme';
import { useWorkspaceAccess } from '../../../hooks/useWorkspaceAccess';
import { hasPermission } from '../../../utils/workspaceAccess';
import { normalizeUserAvatarValue, readUserAvatar, removeUserAvatar, writeUserAvatar } from '../../../lib/userProfilePrefs';
import { ApiRequestError, apiPatch } from '../../../utils/apiClient';
import { readSession, writeSession } from '../../../lib/session';
import { PROFILE_UPDATED_EVENT } from '../../../lib/profileEvents';

const MAX_AVATAR_SIZE_BYTES = 2 * 1024 * 1024;

const initialsFromUser = (user) => {
  const displayName = user?.name?.trim();
  if (displayName) {
    const parts = displayName.split(/\s+/).filter(Boolean);
    return parts.slice(0, 2).map((part) => part[0].toUpperCase()).join('');
  }

  const fallback = user?.email?.trim();
  return fallback ? fallback.slice(0, 2).toUpperCase() : 'U';
};

const fileToDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(new Error('Impossibile leggere il file selezionato.'));
    reader.readAsDataURL(file);
  });

const Profile = ({ toggleCollapsedNav }) => {
  const { access, loading, error, reload } = useWorkspaceAccess();
  const [avatarUrl, setAvatarUrl] = useState('');
  const [avatarUrlInput, setAvatarUrlInput] = useState('');
  const [avatarError, setAvatarError] = useState('');
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [profileForm, setProfileForm] = useState({ name: '', email: '' });
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');

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

  useEffect(() => {
    const userId = user?.id;
    if (!userId) {
      setAvatarUrl('');
      setAvatarUrlInput('');
      return;
    }

    const currentAvatar = readUserAvatar(userId);
    setAvatarUrl(currentAvatar);
    setAvatarUrlInput(currentAvatar);
  }, [user?.id]);

  useEffect(() => {
    setProfileForm({
      name: user?.name || '',
      email: user?.email || '',
    });
  }, [user?.name, user?.email]);

  const canManageBranding = hasPermission({ permissions }, 'branding.manage');

  const handleAvatarChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file || !user?.id) {
      return;
    }

    setAvatarError('');

    if (!file.type.startsWith('image/')) {
      setAvatarError('Seleziona un file immagine valido.');
      return;
    }

    if (file.size > MAX_AVATAR_SIZE_BYTES) {
      setAvatarError('Immagine troppo grande. Limite massimo 2MB.');
      return;
    }

    setAvatarBusy(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      if (!dataUrl) {
        throw new Error('Formato immagine non supportato.');
      }

      const saved = writeUserAvatar(user.id, dataUrl);
      if (!saved) {
        throw new Error('Impossibile salvare l immagine profilo.');
      }

      setAvatarUrl(dataUrl);
      setAvatarUrlInput(dataUrl);
    } catch (uploadError) {
      setAvatarError(uploadError?.message || 'Errore durante il caricamento immagine.');
    } finally {
      setAvatarBusy(false);
    }
  };

  const handleAvatarUrlSave = () => {
    if (!user?.id) {
      return;
    }

    setAvatarError('');

    const normalizedUrl = normalizeUserAvatarValue(avatarUrlInput);
    if (!normalizedUrl) {
      setAvatarError('URL non valido. Usa un link http/https a un immagine.');
      return;
    }

    const saved = writeUserAvatar(user.id, normalizedUrl);
    if (!saved) {
      setAvatarError('Impossibile salvare l immagine profilo.');
      return;
    }

    setAvatarUrl(normalizedUrl);
    setAvatarUrlInput(normalizedUrl);
  };

  const handleAvatarRemove = () => {
    if (!user?.id) {
      return;
    }

    removeUserAvatar(user.id);
    setAvatarUrl('');
    setAvatarUrlInput('');
    setAvatarError('');
  };

  const handleProfileFieldChange = (field) => (event) => {
    const nextValue = event.target.value;
    setProfileForm((current) => ({ ...current, [field]: nextValue }));
  };

  const handleProfileSave = async (event) => {
    event.preventDefault();

    if (!user?.id) {
      return;
    }

    setProfileError('');
    setProfileSuccess('');

    const normalizedName = profileForm.name.trim();
    const normalizedEmail = profileForm.email.trim().toLowerCase();
    const currentName = (user?.name || '').trim();
    const currentEmail = (user?.email || '').trim().toLowerCase();

    if (!normalizedEmail) {
      setProfileError('Email obbligatoria.');
      return;
    }

    if (normalizedName === currentName && normalizedEmail === currentEmail) {
      setProfileSuccess('Nessuna modifica da salvare.');
      return;
    }

    setProfileBusy(true);
    try {
      const result = await apiPatch('/auth/me', {
        name: normalizedName || null,
        email: normalizedEmail,
      });

      const updatedUser = result?.user;
      if (!updatedUser) {
        throw new Error('Risposta profilo non valida.');
      }

      setProfileForm({
        name: updatedUser.name || '',
        email: updatedUser.email || '',
      });

      const session = readSession();
      if (session) {
        writeSession({
          ...session,
          ...(result?.token ? { accessToken: result.token } : {}),
          userEmail: updatedUser.email || session.userEmail,
        });
      }

      setProfileSuccess('Profilo aggiornato con successo.');
      await reload();
      window.dispatchEvent(new Event(PROFILE_UPDATED_EVENT));
    } catch (saveError) {
      if (saveError instanceof ApiRequestError) {
        setProfileError(saveError.message || 'Errore durante il salvataggio profilo.');
      } else {
        setProfileError('Errore durante il salvataggio profilo.');
      }
    } finally {
      setProfileBusy(false);
    }
  };

  const pageCardStyle = {
    borderRadius: '18px',
  };

  const heroCardStyle = {
    borderRadius: '18px',
    border: '1px solid var(--hk-border-primary)',
    background: 'var(--hk-bg-primary)',
  };

  return (
    <div className="hk-pg-body">
      <Container className="py-3 py-lg-4">
        <div className="hk-pg-header pt-5 pb-4">
          <h1 className="pg-title">Profilo</h1>
          <p className="mb-0">Gestisci i dati principali del tuo account.</p>
        </div>

        {loading && (
          <div className="d-flex align-items-center gap-2 text-muted py-4">
            <Spinner animation="border" size="sm" />
            Caricamento profilo...
          </div>
        )}

        {!loading && error && (
          <Alert variant="danger" className="d-flex flex-wrap align-items-center justify-content-between gap-2">
            <span>{error}</span>
            <Button variant="outline-danger" size="sm" onClick={() => void reload()}>
              Riprova
            </Button>
          </Alert>
        )}

        {!loading && !error && (
          <Row className="g-4">
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

            <Col lg={7}>
              <Card className="card-border shadow-none h-100" style={pageCardStyle}>
                <Card.Body className="p-4">
                  <h5 className="mb-3">Modifica profilo</h5>

                  {profileError && (
                    <Alert variant="danger" className="py-2">
                      {profileError}
                    </Alert>
                  )}
                  {profileSuccess && (
                    <Alert variant="success" className="py-2">
                      {profileSuccess}
                    </Alert>
                  )}

                  <Form onSubmit={handleProfileSave}>
                    <Row className="g-3">
                      <Col md={12}>
                        <Form.Group controlId="profileName">
                          <Form.Label>Nome completo</Form.Label>
                          <Form.Control
                            type="text"
                            placeholder="Inserisci il tuo nome"
                            value={profileForm.name}
                            onChange={handleProfileFieldChange('name')}
                            disabled={profileBusy}
                          />
                        </Form.Group>
                      </Col>
                      <Col md={12}>
                        <Form.Group controlId="profileEmail">
                          <Form.Label>Email</Form.Label>
                          <Form.Control
                            type="email"
                            placeholder="nome@dominio.com"
                            value={profileForm.email}
                            onChange={handleProfileFieldChange('email')}
                            disabled={profileBusy}
                            required
                          />
                        </Form.Group>
                      </Col>
                    </Row>

                    <div className="mt-4 d-flex gap-2">
                      <Button type="submit" variant="primary" disabled={profileBusy}>
                        {profileBusy ? 'Salvataggio...' : 'Salva modifiche'}
                      </Button>
                      <Button
                        type="button"
                        variant="outline-light"
                        disabled={profileBusy}
                        onClick={() =>
                          setProfileForm({
                            name: user?.name || '',
                            email: user?.email || '',
                          })
                        }
                      >
                        Ripristina
                      </Button>
                    </div>
                  </Form>
                </Card.Body>
              </Card>
            </Col>

            <Col lg={5}>
              <Card className="card-border shadow-none h-100" style={pageCardStyle}>
                <Card.Body className="p-4">
                  <h5 className="mb-3">Immagine profilo</h5>

                  <div className="d-flex align-items-center gap-3 mb-4">
                    <div className="avatar avatar-xl avatar-rounded overflow-hidden">
                      {avatarUrl ? (
                        <img
                          src={avatarUrl}
                          alt="Avatar profilo"
                          className="avatar-img"
                          style={{ objectFit: 'cover' }}
                        />
                      ) : (
                        <span className="initial-wrap">{initialsFromUser(user)}</span>
                      )}
                    </div>
                    <div className="small text-muted">
                      Usa un file locale o un URL pubblico.
                    </div>
                  </div>

                  <Form.Group className="mb-3" controlId="profileAvatarUpload">
                    <Form.Label>Carica file</Form.Label>
                    <Form.Control
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarChange}
                      disabled={avatarBusy}
                    />
                    <Form.Text muted>JPG, PNG o WEBP. Massimo 2MB.</Form.Text>
                  </Form.Group>

                  <Form.Group className="mb-3" controlId="profileAvatarUrl">
                    <Form.Label>URL immagine</Form.Label>
                    <div className="d-flex gap-2">
                      <Form.Control
                        type="url"
                        placeholder="https://..."
                        value={avatarUrlInput}
                        onChange={(event) => setAvatarUrlInput(event.target.value)}
                        disabled={avatarBusy}
                      />
                      <Button
                        type="button"
                        variant="outline-primary"
                        size="sm"
                        onClick={handleAvatarUrlSave}
                        disabled={avatarBusy || !avatarUrlInput.trim()}
                      >
                        Salva URL
                      </Button>
                    </div>
                    <Form.Text muted>Accetta URL `http/https`.</Form.Text>
                  </Form.Group>

                  {avatarError && (
                    <div className="small text-danger mb-3">{avatarError}</div>
                  )}

                  <Button
                    type="button"
                    variant="outline-light"
                    size="sm"
                    onClick={handleAvatarRemove}
                    disabled={!avatarUrl || avatarBusy}
                  >
                    Rimuovi immagine
                  </Button>
                </Card.Body>
              </Card>
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
