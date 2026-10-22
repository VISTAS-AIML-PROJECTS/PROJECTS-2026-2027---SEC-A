import { motion } from "framer-motion";
import {
  LayoutDashboard, Wind, Activity, HeartPulse, FileText,
  ChevronLeft, ChevronRight, Wind as Logo, PanelLeftClose, PanelLeftOpen,
} from "lucide-react";

const NAV_ITEMS = [
  { id: 0, label: "Dashboard",     icon: LayoutDashboard },
  { id: 1, label: "Predict AQI",   icon: Wind },
  { id: 2, label: "Exposure",      icon: Activity },
  { id: 3, label: "Health Risk",   icon: HeartPulse },
  { id: 4, label: "Health Report", icon: FileText },
];

export default function Sidebar({ active, onSelect, collapsed, onToggle, mobileOpen }) {
  return (
    <aside className={`sidebar ${collapsed ? "collapsed" : ""} ${mobileOpen ? "mobile-open" : ""}`}>
      {/* Brand */}
      <div className="sidebar-brand">
        <span className="sidebar-logo">
          <Logo size={18} />
        </span>
        {!collapsed && (
          <motion.div
            className="sidebar-brand-text"
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1, duration: 0.25 }}
          >
            <span className="brand-name">PureBreath</span>
            <span className="brand-sub">AI Health Intelligence</span>
          </motion.div>
        )}
      </div>

      {/* Nav label */}
      <div className="sidebar-section-label">Navigation</div>

      {/* Nav items */}
      <nav className="sidebar-nav">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = active === item.id;
          return (
            <motion.button
              key={item.id}
              className={`sidebar-item ${isActive ? "active" : ""}`}
              onClick={() => onSelect(item.id)}
              whileHover={{ x: collapsed ? 0 : 3 }}
              whileTap={{ scale: 0.97 }}
              title={collapsed ? item.label : undefined}
            >
              <span className="sidebar-item-icon">
                <Icon size={18} />
              </span>
              {!collapsed && (
                <span className="sidebar-item-label">{item.label}</span>
              )}
              {isActive && <span className="sidebar-active-indicator" />}
            </motion.button>
          );
        })}
      </nav>

      {/* Footer / toggle */}
      <div className="sidebar-footer">
        <button className="sidebar-toggle" onClick={onToggle} title={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
          {collapsed
            ? <PanelLeftOpen size={16} />
            : <><PanelLeftClose size={16} /><span className="sidebar-toggle-label">Collapse</span></>
          }
        </button>
      </div>
    </aside>
  );
}
