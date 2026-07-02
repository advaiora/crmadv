// app/components/theme-provider.jsx
"use client";

import { createContext, useContext, useState, useEffect } from "react";

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

// The main provider component
export function ThemeProvider({ children }) {
  // Default: segue il tema di sistema. Se l'utente ha scelto esplicitamente
  // un tema (salvato in localStorage), quella scelta ha la precedenza.
  const [theme, setTheme] = useState(() => {
    if (typeof window === "undefined") {
      return "light";
    }
    const storedTheme = localStorage.getItem("theme");
    return storedTheme === "dark" || storedTheme === "light" ? storedTheme : getSystemTheme();
  });

  // Applica il tema al tag <html>.
  useEffect(() => {
    document.documentElement.setAttribute("data-bs-theme", theme === "dark" ? "dark" : "light");
  }, [theme]);

  // Finché l'utente non ha una preferenza salvata, segue i cambi di tema del sistema.
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) {
      return undefined;
    }
    const storedTheme = localStorage.getItem("theme");
    if (storedTheme === "dark" || storedTheme === "light") {
      return undefined; // scelta esplicita: non seguire più il sistema
    }
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleSystemChange = (event) => setTheme(event.matches ? "dark" : "light");
    mediaQuery.addEventListener("change", handleSystemChange);
    return () => mediaQuery.removeEventListener("change", handleSystemChange);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prevTheme) => {
      const nextTheme = prevTheme === "light" ? "dark" : "light";
      localStorage.setItem("theme", nextTheme); // scelta esplicita dell'utente: la salviamo
      return nextTheme;
    });
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}