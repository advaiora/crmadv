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

// The main provider component
export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState("light"); // Default to light

  // On mount, apply the user's saved choice. Without a saved choice the
  // default is light (scelta di progetto: "entrambe, default chiaro").
  useEffect(() => {
    const storedTheme = localStorage.getItem("theme");
    if (storedTheme === "dark" || storedTheme === "light") {
      setTheme(storedTheme);
    }
  }, []);

  // Whenever the theme changes, update localStorage and the <html> tag
  useEffect(() => {
    if (theme === "dark") {
      document.documentElement.setAttribute("data-bs-theme", "dark");
    } else {
      document.documentElement.setAttribute("data-bs-theme", "light");
    }
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prevTheme) => (prevTheme === "light" ? "dark" : "light"));
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}