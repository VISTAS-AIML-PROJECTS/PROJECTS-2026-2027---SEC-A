import { createContext, useContext, useEffect, useState, useCallback } from "react";

const THEME_KEY = "purebreath-theme";

function getSystemTheme() {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

const ThemeContext = createContext({ theme: "system", resolvedTheme: "light", setTheme: () => {} });

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    try {
      return localStorage.getItem(THEME_KEY) || "system";
    } catch {
      return "system";
    }
  });
  const [systemTheme, setSystemTheme] = useState(getSystemTheme);

  useEffect(() => {
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e) => setSystemTheme(e.matches ? "dark" : "light");
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  const resolvedTheme = theme === "system" ? systemTheme : theme;

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-theme", resolvedTheme);
    root.classList.remove("theme-transition");
    // Force reflow then add transition class for smooth animation
    void root.offsetWidth;
    root.classList.add("theme-transition");
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* ignore */
    }
  }, [theme, resolvedTheme]);

  const setTheme = useCallback((t) => setThemeState(t), []);

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
