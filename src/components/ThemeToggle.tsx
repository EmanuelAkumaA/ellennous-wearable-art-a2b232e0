import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

const THEME_KEY = "ellennous-theme";
type Theme = "light" | "dark";

const getInitial = (): Theme => {
  if (typeof window === "undefined") return "dark";
  const stored = localStorage.getItem(THEME_KEY) as Theme | null;
  if (stored === "light" || stored === "dark") return stored;
  return "dark";
};

export const ThemeToggle = () => {
  const [theme, setTheme] = useState<Theme>(getInitial);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  const toggle = () => setTheme((t) => (t === "dark" ? "light" : "dark"));
  const isDark = theme === "dark";

  return (
    <button
      onClick={toggle}
      aria-label={isDark ? "Ativar modo claro" : "Ativar modo escuro"}
      className="fixed top-5 right-5 z-50 group h-11 w-11 flex items-center justify-center rounded-full border border-primary/30 bg-background/70 backdrop-blur-md hover:border-primary-glow hover:shadow-glow transition-all duration-500"
    >
      <span className="absolute inset-0 rounded-full bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      <Sun
        className={`absolute h-5 w-5 text-primary-glow transition-all duration-500 ${
          isDark ? "scale-0 rotate-90 opacity-0" : "scale-100 rotate-0 opacity-100"
        }`}
        strokeWidth={1.8}
      />
      <Moon
        className={`absolute h-5 w-5 text-primary-glow transition-all duration-500 ${
          isDark ? "scale-100 rotate-0 opacity-100" : "scale-0 -rotate-90 opacity-0"
        }`}
        strokeWidth={1.8}
      />
    </button>
  );
};
