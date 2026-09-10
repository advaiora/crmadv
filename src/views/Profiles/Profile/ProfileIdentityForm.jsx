import React, { useEffect, useState } from 'react';
import { Alert, Button, Card, Col, Form, Row } from 'react-bootstrap';
import { ApiRequestError, apiPatch } from '../../../utils/apiClient';
import { readSession, writeSession } from '../../../lib/session';
import { PROFILE_UPDATED_EVENT } from '../../../lib/profileEvents';

// Estratta da Profile/index.jsx (che sforava le 500 righe, CRMA-31): il form di
// nome/email, separato dalla gestione dell'immagine e dal cambio password —
// tre form indipendenti, ognuno con il proprio esito e i propri errori.

const ProfileIdentityForm = ({ user, reload, cardStyle }) => {
    const [profileForm, setProfileForm] = useState({ name: '', email: '' });
    const [profileBusy, setProfileBusy] = useState(false);
    const [profileError, setProfileError] = useState('');
    const [profileSuccess, setProfileSuccess] = useState('');

    useEffect(() => {
        setProfileForm({
            name: user?.name || '',
            email: user?.email || '',
        });
    }, [user?.name, user?.email]);

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

    return (
        <Card className="card-border shadow-none h-100" style={cardStyle}>
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
    );
};

export default ProfileIdentityForm;
