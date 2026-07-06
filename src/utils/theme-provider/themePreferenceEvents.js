// Chiave localStorage e evento per la preferenza tema (chiaro/scuro/automatico).
// Modulo senza React, così può essere importato ovunque (anche fuori dai componenti)
// senza creare dipendenze circolari con il ThemeProvider.

export const THEME_PREFERENCE_STORAGE_KEY = 'themePreference';
export const THEME_PREFERENCE_CHANGED_EVENT = 'advaiora:theme-preference-changed';

export const isValidThemePreference = (value) =>
  value === 'light' || value === 'dark' || value === 'system';

// Applica la preferenza arrivata dal server (localStorage + notifica), SENZA
// riscriverla sul server: è una sincronizzazione server → client.
export const applyServerThemePreference = (value) => {
  if (typeof window === 'undefined' || !isValidThemePreference(value)) {
    return;
  }
  const current = window.localStorage.getItem(THEME_PREFERENCE_STORAGE_KEY);
  if (current === value) {
    return;
  }
  window.localStorage.setItem(THEME_PREFERENCE_STORAGE_KEY, value);
  window.dispatchEvent(new Event(THEME_PREFERENCE_CHANGED_EVENT));
};
