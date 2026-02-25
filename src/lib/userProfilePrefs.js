const USER_PROFILE_PREFS_STORAGE_KEY = 'advaiora.user-profile-prefs';
export const USER_PROFILE_PREFS_CHANGED_EVENT = 'advaiora:user-profile-prefs-changed';

const isBrowser = () => typeof window !== 'undefined';

const notifyPrefsChanged = () => {
  if (!isBrowser()) {
    return;
  }

  window.dispatchEvent(new Event(USER_PROFILE_PREFS_CHANGED_EVENT));
};

const readRawPrefs = () => {
  if (!isBrowser()) {
    return {};
  }

  const rawValue = localStorage.getItem(USER_PROFILE_PREFS_STORAGE_KEY);
  if (!rawValue) {
    return {};
  }

  try {
    const parsed = JSON.parse(rawValue);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (_error) {
    localStorage.removeItem(USER_PROFILE_PREFS_STORAGE_KEY);
    return {};
  }
};

const writeRawPrefs = (nextPrefs) => {
  if (!isBrowser()) {
    return;
  }

  localStorage.setItem(USER_PROFILE_PREFS_STORAGE_KEY, JSON.stringify(nextPrefs));
  notifyPrefsChanged();
};

const normalizeDataImage = (value) => {
  if (typeof value !== 'string') {
    return '';
  }

  const normalized = value.trim();
  if (!normalized) {
    return '';
  }

  return normalized.startsWith('data:image/') ? normalized : '';
};

const normalizeHttpImageUrl = (value) => {
  if (typeof value !== 'string') {
    return '';
  }

  const normalized = value.trim();
  if (!normalized) {
    return '';
  }

  try {
    const parsed = new URL(normalized);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return '';
    }

    return parsed.toString();
  } catch (_error) {
    return '';
  }
};

export const normalizeUserAvatarValue = (value) => {
  const dataImage = normalizeDataImage(value);
  if (dataImage) {
    return dataImage;
  }

  return normalizeHttpImageUrl(value);
};

const normalizeUserId = (value) => {
  if (typeof value !== 'string') {
    return '';
  }

  const normalized = value.trim();
  return normalized || '';
};

export const readUserAvatar = (userId) => {
  const normalizedUserId = normalizeUserId(userId);
  if (!normalizedUserId) {
    return '';
  }

  const allPrefs = readRawPrefs();
  const userPrefs = allPrefs[normalizedUserId];
  if (!userPrefs || typeof userPrefs !== 'object') {
    return '';
  }

  return normalizeUserAvatarValue(userPrefs.avatarDataUrl);
};

export const writeUserAvatar = (userId, avatarDataUrl) => {
  const normalizedUserId = normalizeUserId(userId);
  const normalizedAvatar = normalizeUserAvatarValue(avatarDataUrl);

  if (!normalizedUserId || !normalizedAvatar) {
    return false;
  }

  const allPrefs = readRawPrefs();
  allPrefs[normalizedUserId] = {
    ...(allPrefs[normalizedUserId] && typeof allPrefs[normalizedUserId] === 'object'
      ? allPrefs[normalizedUserId]
      : {}),
    avatarDataUrl: normalizedAvatar,
    updatedAt: new Date().toISOString(),
  };

  writeRawPrefs(allPrefs);
  return true;
};

export const removeUserAvatar = (userId) => {
  const normalizedUserId = normalizeUserId(userId);
  if (!normalizedUserId) {
    return false;
  }

  const allPrefs = readRawPrefs();
  if (!allPrefs[normalizedUserId]) {
    return false;
  }

  delete allPrefs[normalizedUserId];
  writeRawPrefs(allPrefs);
  return true;
};
