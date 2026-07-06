// app/components/theme-provider.jsx
"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { apiPatch } from "../apiClient";
import { readSession } from "../../lib/session";
import {
  THEME_PREFERENCE_CHANGED_EVENT,
  THEME_PREFERENCE_STORAGE_KEY,
  isValidThemePreference,
} from "./themePreferenceEvents";

// Create the context
const ThemeContext = createContext();

// Helper hook to use the context
export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}

// Legge la preferenza del sistema operativo (chiaro/scuro).
const getSystemTheme = () =>
  typeof window !== "undefined" &&
  window.matchMedia &&
  window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";

// Preferenza iniziale: chiave nuova → chiave legacy "theme" (migrazione) → "system".
const readInitialPreference = () => {
  if (typeof window === "undefined") {
    return "system";
  }
  const stored = window.localStorage.getItem(THEME_PREFERENCE_STORAGE_KEY);
  if (isValidThemePreference(stored)) {
    return stored;
  }
  const legacy = window.localStorage.getItem("theme");
  if (legacy === "light" || legacy === "dark") {
    return legacy;
  }
  return "system";
};

// Salva la preferenza sul server (solo se loggati), senza bloccare la UI.
const persistPreferenceToServer = (preference) => {
  if (!readSession()?.accessToken) {
    return;
  }
  apiPatch("/auth/me", { themePreference: preference }).catch(() => {});
};

// The main provider component
export function ThemeProvider({ children }) {
  const [themePreference, setThemePreferenceState] = useState(readInitialPreference);
  const [systemTheme, setSystemTheme] = useState(getSystemTheme);

  // Tema effettivo: derivato (nessun setState in effetto). Con "system" segue l'OS.
  const theme = themePreference === "system" ? systemTheme : themePreference;

  // Applica il tema effettivo al tag <html>.
  useEffect(() => {
    document.documentElement.setAttribute("data-bs-theme", theme === "dark" ? "dark" : "light");
  }, [theme]);

  // Ascolta i cambi di tema del sistema operativo (aggiorna solo quando serve).
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) {
      return undefined;
    }
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleSystemChange = (event) => setSystemTheme(event.matches ? "dark" : "light");
    mediaQuery.addEventListener("change", handleSystemChange);
    return () => mediaQuery.removeEventListener("change", handleSystemChange);
  }, []);

  // Sincronizzazione server → client: quando /auth/me scrive la preferenza in
  // localStorage e notifica, la applichiamo qui (senza riscriverla sul server).
  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }
    const syncFromStorage = () => {
      const stored = window.localStorage.getItem(THEME_PREFERENCE_STORAGE_KEY);
      if (isValidThemePreference(stored)) {
        setThemePreferenceState(stored);
      }
    };
    window.addEventListener(THEME_PREFERENCE_CHANGED_EVENT, syncFromStorage);
    window.addEventListener("storage", syncFromStorage);
    return () => {
      window.removeEventListener(THEME_PREFERENCE_CHANGED_EVENT, syncFromStorage);
      window.removeEventListener("storage", syncFromStorage);
    };
  }, []);

  // Scelta esplicita dell'utente: applica, salva in locale e sul server.
  const setThemePreference = useCallback((preference) => {
    if (!isValidThemePreference(preference)) {
      return;
    }
    setThemePreferenceState(preference);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(THEME_PREFERENCE_STORAGE_KEY, preference);
    }
    persistPreferenceToServer(preference);
  }, []);

  // Interruttore chiaro/scuro della barra superiore: fissa una scelta esplicita.
  const toggleTheme = useCallback(() => {
    setThemePreference(theme === "light" ? "dark" : "light");
  }, [theme, setThemePreference]);

  return (
    <ThemeContext.Provider value={{ theme, themePreference, setThemePreference, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
