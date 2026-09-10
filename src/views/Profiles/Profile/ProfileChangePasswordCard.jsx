import React, { useState } from 'react';
import { Alert, Button, Card, Form } from 'react-bootstrap';
import { ApiRequestError, apiPost } from '../../../utils/apiClient';

// CRMA-31 (A1 punto 8b): il backend del cambio password esiste da CRMA-25
// (`POST /auth/password/change`, server/modules/password/) ma nessun
// componente lo chiamava — «Modifica Profilo» dichiarava che non si poteva
// fare. Qui nasce il form, accanto a nome/email e immagine in Profile/index.jsx.
//
// Allineata a server/auth/password-policy.ts (MIN_PASSWORD_LENGTH); se cambia
// li', va cambiata anche qui.
const MIN_NEW_PASSWORD_LENGTH = 8;

const initialFormState = { currentPassword: '', newPassword: '', confirmPassword: '' };

const ProfileChangePasswordCard = ({ cardStyle }) => {
    const [form, setForm] = useState(initialFormState);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const handleFieldChange = (field) => (event) => {
        const nextValue = event.target.value;
        setForm((current) => ({ ...current, [field]: nextValue }));
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setError('');
        setSuccess('');

        if (form.newPassword.length < MIN_NEW_PASSWORD_LENGTH) {
            setError(`La nuova password deve avere almeno ${MIN_NEW_PASSWORD_LENGTH} caratteri.`);
            return;
        }

        if (form.newPassword !== form.confirmPassword) {
            setError('La conferma non coincide con la nuova password.');
            return;
        }

        setBusy(true);
        try {
            // Il server risponde gia' in italiano e distingue i tre casi (password
            // attuale sbagliata, account Google senza password locale, nuova
            // uguale alla vecchia): il messaggio si mostra cosi' com'e', senza
            // riscriverlo qui — vedi password.service.ts per il dettaglio.
            await apiPost('/auth/password/change', {
                currentPassword: form.currentPassword,
                newPassword: form.newPassword,
            });
            setForm(initialFormState);
            // Il server non revoca le sessioni gia' aperte (nessuna denylist sui
            // JWT): va detto, altrimenti chi cambia password per un accesso
            // sospetto crede di aver chiuso fuori chi lo aveva rubato.
            setSuccess('Password aggiornata. Le sessioni già aperte restano attive.');
        } catch (saveError) {
            if (saveError instanceof ApiRequestError) {
                setError(saveError.message || 'Errore durante il cambio password.');
            } else {
                setError('Errore durante il cambio password.');
            }
        } finally {
            setBusy(false);
        }
    };

    return (
        <Card className="card-border shadow-none h-100" style={cardStyle}>
            <Card.Body className="p-4">
                <h5 className="mb-3">Cambia password</h5>

                {error && (
                    <Alert variant="danger" className="py-2">
                        {error}
                    </Alert>
                )}
                {success && (
                    <Alert variant="success" className="py-2">
                        {success}
                    </Alert>
                )}

                <Form onSubmit={handleSubmit}>
                    <Form.Group className="mb-3" controlId="profileCurrentPassword">
                        <Form.Label>Password attuale</Form.Label>
                        <Form.Control
                            type="password"
                            value={form.currentPassword}
                            onChange={handleFieldChange('currentPassword')}
                            disabled={busy}
                            autoComplete="current-password"
                            required
                        />
                    </Form.Group>

                    <Form.Group className="mb-3" controlId="profileNewPassword">
                        <Form.Label>Nuova password</Form.Label>
                        <Form.Control
                            type="password"
                            value={form.newPassword}
                            onChange={handleFieldChange('newPassword')}
                            disabled={busy}
                            autoComplete="new-password"
                            minLength={MIN_NEW_PASSWORD_LENGTH}
                            required
                        />
                        <Form.Text muted>Almeno {MIN_NEW_PASSWORD_LENGTH} caratteri.</Form.Text>
                    </Form.Group>

                    <Form.Group className="mb-3" controlId="profileConfirmPassword">
                        <Form.Label>Conferma nuova password</Form.Label>
                        <Form.Control
                            type="password"
                            value={form.confirmPassword}
                            onChange={handleFieldChange('confirmPassword')}
                            disabled={busy}
                            autoComplete="new-password"
                            required
                        />
                    </Form.Group>

                    <Button type="submit" variant="primary" disabled={busy}>
                        {busy ? 'Salvataggio...' : 'Cambia password'}
                    </Button>
                </Form>
            </Card.Body>
        </Card>
    );
};

export default ProfileChangePasswordCard;
