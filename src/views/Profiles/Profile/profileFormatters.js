import { normalizeUserAvatarValue, readUserAvatar } from '../../../lib/userProfilePrefs';

// Condivise fra index.jsx (la testata) e ProfileAvatarCard.jsx (la gestione):
// entrambe devono mostrare lo stesso avatar con la stessa regola di risoluzione.

export const initialsFromUser = (user) => {
    const displayName = user?.name?.trim();
    if (displayName) {
        const parts = displayName.split(/\s+/).filter(Boolean);
        return parts.slice(0, 2).map((part) => part[0].toUpperCase()).join('');
    }

    const fallback = user?.email?.trim();
    return fallback ? fallback.slice(0, 2).toUpperCase() : 'U';
};

// Sorgente di verita': il valore salvato sul server; fallback alla cache locale.
export const resolveAvatarUrl = (user) => {
    if (!user?.id) {
        return '';
    }

    return normalizeUserAvatarValue(user.avatarUrl) || readUserAvatar(user.id);
};
