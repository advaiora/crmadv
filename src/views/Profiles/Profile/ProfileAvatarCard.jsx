import React, { useEffect, useState } from 'react';
import { Button, Card, Form } from 'react-bootstrap';
import { ApiRequestError, apiPatch } from '../../../utils/apiClient';
import { normalizeUserAvatarValue, readUserAvatar, removeUserAvatar, writeUserAvatar } from '../../../lib/userProfilePrefs';
import { PROFILE_UPDATED_EVENT } from '../../../lib/profileEvents';
import { initialsFromUser } from './profileFormatters';

// Estratta da Profile/index.jsx (che sforava le 500 righe, CRMA-31): qui vive
// la gestione dell'immagine profilo (file locale o URL), separata dal modulo
// che modifica nome/email — sono due form indipendenti l'uno dall'altro.

const MAX_AVATAR_SIZE_BYTES = 2 * 1024 * 1024;
const AVATAR_MAX_DIMENSION = 256;

// Ridimensiona l'immagine a un quadrato max 256px e la restituisce come data URL
// JPEG leggero (poche decine di KB): così è persistibile sul server senza appesantire.
const resizeImageToDataUrl = (file, maxDimension = AVATAR_MAX_DIMENSION) =>
    new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('Impossibile leggere il file selezionato.'));
        reader.onload = () => {
            const image = new Image();
            image.onerror = () => reject(new Error('Immagine non valida.'));
            image.onload = () => {
                const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
                const width = Math.max(1, Math.round(image.width * scale));
                const height = Math.max(1, Math.round(image.height * scale));
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const context = canvas.getContext('2d');
                if (!context) {
                    reject(new Error('Elaborazione immagine non disponibile.'));
                    return;
                }
                context.drawImage(image, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', 0.85));
            };
            image.src = typeof reader.result === 'string' ? reader.result : '';
        };
        reader.readAsDataURL(file);
    });

const describeAvatarError = (avatarSaveError, fallback) => {
    if (avatarSaveError instanceof ApiRequestError) {
        return avatarSaveError.message || fallback;
    }
    return avatarSaveError?.message || fallback;
};

const ProfileAvatarCard = ({ user, reload, cardStyle }) => {
    const [avatarUrl, setAvatarUrl] = useState('');
    const [avatarUrlInput, setAvatarUrlInput] = useState('');
    const [avatarError, setAvatarError] = useState('');
    const [avatarBusy, setAvatarBusy] = useState(false);

    // Deps granulari apposta, non `[user]`: la Row del genitore resta montata
    // durante il `reload()` di QUALSIASI card (anche l'identità o la password),
    // quindi `user` cambia identità spesso. Se questo effetto si riagganciasse a
    // ogni cambio, riscriverebbe l'URL appena digitato e non ancora salvato ogni
    // volta che un'altra card completa un salvataggio. Deve risincronizzarsi solo
    // quando l'avatar VERO (sul server) e' cambiato.
    useEffect(() => {
        const currentAvatar = normalizeUserAvatarValue(user?.avatarUrl) || readUserAvatar(user?.id);
        setAvatarUrl(currentAvatar);
        setAvatarUrlInput(currentAvatar);
    }, [user?.id, user?.avatarUrl]);

    // Salva l'avatar sul server (persistente), poi aggiorna cache locale e stato UI.
    // value = data URL / URL http(s) per impostare, oppure null per rimuovere.
    const persistAvatar = async (value) => {
        if (!user?.id) {
            return;
        }
        await apiPatch('/auth/me', { avatarUrl: value ?? null });

        if (value) {
            writeUserAvatar(user.id, value);
        } else {
            removeUserAvatar(user.id);
        }
        setAvatarUrl(value || '');
        setAvatarUrlInput(value || '');
        window.dispatchEvent(new Event(PROFILE_UPDATED_EVENT));
        await reload();
    };

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
            const dataUrl = await resizeImageToDataUrl(file);
            if (!dataUrl) {
                throw new Error('Formato immagine non supportato.');
            }
            await persistAvatar(dataUrl);
        } catch (uploadError) {
            setAvatarError(describeAvatarError(uploadError, 'Errore durante il caricamento immagine.'));
        } finally {
            setAvatarBusy(false);
        }
    };

    const handleAvatarUrlSave = async () => {
        if (!user?.id) {
            return;
        }

        setAvatarError('');

        const normalizedUrl = normalizeUserAvatarValue(avatarUrlInput);
        if (!normalizedUrl) {
            setAvatarError('URL non valido. Usa un link http/https a un immagine.');
            return;
        }

        setAvatarBusy(true);
        try {
            await persistAvatar(normalizedUrl);
        } catch (saveError) {
            setAvatarError(describeAvatarError(saveError, 'Impossibile salvare l immagine profilo.'));
        } finally {
            setAvatarBusy(false);
        }
    };

    const handleAvatarRemove = async () => {
        if (!user?.id) {
            return;
        }

        setAvatarBusy(true);
        try {
            await persistAvatar(null);
            setAvatarError('');
        } catch (removeError) {
            setAvatarError(describeAvatarError(removeError, 'Impossibile rimuovere l immagine profilo.'));
        } finally {
            setAvatarBusy(false);
        }
    };

    return (
        <Card className="card-border shadow-none h-100" style={cardStyle}>
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
    );
};

export default ProfileAvatarCard;
