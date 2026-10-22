import { motion } from "framer-motion";
import { Sun, Moon, Monitor, Bell, Search, Menu, Wind as Logo, Sparkles } from "lucide-react";
import { useTheme } from "../theme";

const THEME_OPTIONS = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

export default function Header({ title, subtitle, onMenuClick }) {
  const { theme, resolvedTheme, setTheme } = useTheme();

  return (
    <motion.header
      className="app-header"
      initial={{ y: -60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      <div className="header-left">
        <button className="mobile-menu-btn" onClick={onMenuClick} aria-label="Menu">
          <Menu size={22} />
        </button>
        <div className="header-title-wrap">
          <h1 className="header-title">{title}</h1>
          {subtitle && <p className="header-subtitle">{subtitle}</p>}
        </div>
      </div>

      <div className="header-right">
        <div className="header-health-status">
          <span className={`status-dot ${resolvedTheme}`} />
          <span className="status-text">
            <Sparkles size={14} /> AI Engine Online
          </span>
        </div>

        <button className="icon-btn" aria-label="Search">
          <Search size={20} />
        </button>
        <button className="icon-btn relative" aria-label="Notifications">
          <Bell size={20} />
          <span className="icon-badge" />
        </button>

        <div className="theme-toggle" role="group" aria-label="Theme">
          {THEME_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const active = theme === opt.value;
            return (
              <button
                key={opt.value}
                className={`theme-option ${active ? "active" : ""}`}
                onClick={() => setTheme(opt.value)}
                title={`${opt.label} theme`}
                aria-pressed={active}
              >
                <Icon size={16} />
              </button>
            );
          })}
        </div>

        <div className="header-avatar" title="Profile">
          <span>PB</span>
        </div>
      </div>
    </motion.header>
  );
}
