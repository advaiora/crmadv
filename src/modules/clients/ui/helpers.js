const DATE_TIME_FORMAT = {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
};

const TAG_COLOR_PALETTE = [
    { backgroundColor: '#1E40AF', borderColor: '#60A5FA', color: '#EFF6FF' },
    { backgroundColor: '#166534', borderColor: '#4ADE80', color: '#F0FDF4' },
    { backgroundColor: '#B45309', borderColor: '#F59E0B', color: '#FFFBEB' },
    { backgroundColor: '#B91C1C', borderColor: '#F87171', color: '#FEF2F2' },
    { backgroundColor: '#0E7490', borderColor: '#22D3EE', color: '#ECFEFF' },
    { backgroundColor: '#6D28D9', borderColor: '#A78BFA', color: '#F5F3FF' },
    { backgroundColor: '#9D174D', borderColor: '#F472B6', color: '#FDF2F8' },
    { backgroundColor: '#0F766E', borderColor: '#2DD4BF', color: '#F0FDFA' },
    { backgroundColor: '#C2410C', borderColor: '#FB923C', color: '#FFF7ED' },
    { backgroundColor: '#5B21B6', borderColor: '#C084FC', color: '#FAF5FF' },
];

export const getClientTypeLabel = (type) => (type === 'company' ? 'Azienda' : 'Persona');

export const getClientNameLabel = (type) =>
    type === 'company' ? 'Ragione sociale' : 'Nome e cognome';

export const getInitials = (value) => {
    if (!value || typeof value !== 'string') {
        return 'CL';
    }

    const words = value
        .trim()
        .split(/\s+/)
        .filter(Boolean);

    if (words.length === 0) {
        return 'CL';
    }

    if (words.length === 1) {
        return words[0].slice(0, 2).toUpperCase();
    }

    return `${words[0][0]}${words[1][0]}`.toUpperCase();
};

export const formatDateTime = (value) => {
    if (!value) {
        return '-';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return '-';
    }

    return date.toLocaleString('it-IT', DATE_TIME_FORMAT);
};

const getRoundedDifference = (value) => Math.round(value * 10) / 10;

export const formatRelativeTime = (value) => {
    if (!value) {
        return '-';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return '-';
    }

    const diffMs = date.getTime() - Date.now();
    const diffMinutes = diffMs / (1000 * 60);
    const formatter = new Intl.RelativeTimeFormat('it-IT', { numeric: 'auto' });

    if (Math.abs(diffMinutes) < 60) {
        return formatter.format(Math.round(diffMinutes), 'minute');
    }

    const diffHours = diffMinutes / 60;
    if (Math.abs(diffHours) < 24) {
        return formatter.format(Math.round(diffHours), 'hour');
    }

    const diffDays = diffHours / 24;
    if (Math.abs(diffDays) < 30) {
        return formatter.format(Math.round(diffDays), 'day');
    }

    const diffMonths = diffDays / 30;
    if (Math.abs(diffMonths) < 12) {
        return formatter.format(getRoundedDifference(diffMonths), 'month');
    }

    const diffYears = diffDays / 365;
    return formatter.format(getRoundedDifference(diffYears), 'year');
};

export const formatAddress = (address) => {
    if (!address) {
        return null;
    }

    const values = [address.street, address.city, address.province, address.zip, address.country]
        .map((entry) => (typeof entry === 'string' ? entry.trim() : entry))
        .filter(Boolean);

    return values.length > 0 ? values.join(', ') : null;
};

export const hasContactValue = (value) => typeof value === 'string' && value.trim().length > 0;

export const hasTag = (tags, tagValue) =>
    Array.isArray(tags) && tags.some((tag) => tag.toLowerCase() === tagValue.toLowerCase());

const getTagHash = (value) => {
    if (!value || typeof value !== 'string') {
        return 0;
    }

    return Array.from(value).reduce((accumulator, char) => {
        const next = ((accumulator << 5) - accumulator) + char.charCodeAt(0);
        return next | 0;
    }, 0);
};

export const getTagBadgeStyle = (tagValue) => {
    const hash = Math.abs(getTagHash(tagValue));
    const paletteItem = TAG_COLOR_PALETTE[hash % TAG_COLOR_PALETTE.length];

    return {
        backgroundColor: paletteItem.backgroundColor,
        borderColor: paletteItem.borderColor,
        color: paletteItem.color,
    };
};
