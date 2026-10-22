import { motion } from "framer-motion";
import { lucideIcons } from "../icons";

// ── Color config for AQI buckets & risk levels ──────────────────────────────
export const AQI_COLORS = {
  Good: { main: "#10b981", soft: "rgba(16,185,129,0.14)", text: "#047857" },
  Satisfactory: { main: "#3b82f6", soft: "rgba(59,130,246,0.14)", text: "#1d4ed8" },
  Moderate: { main: "#f59e0b", soft: "rgba(245,158,11,0.16)", text: "#b45309" },
  Poor: { main: "#f97316", soft: "rgba(249,115,22,0.15)", text: "#c2410c" },
  "Very Poor": { main: "#ef4444", soft: "rgba(239,68,68,0.14)", text: "#b91c1c" },
  Severe: { main: "#8b5cf6", soft: "rgba(139,92,246,0.15)", text: "#7c3aed" },
};

export const RISK_COLORS = {
  Low: { main: "#10b981", soft: "rgba(16,185,129,0.14)", text: "#047857" },
  Moderate: { main: "#f59e0b", soft: "rgba(245,158,11,0.16)", text: "#b45309" },
  High: { main: "#f97316", soft: "rgba(249,115,22,0.15)", text: "#c2410c" },
  "Very High": { main: "#ef4444", soft: "rgba(239,68,68,0.14)", text: "#b91c1c" },
  Hazardous: { main: "#8b5cf6", soft: "rgba(139,92,246,0.15)", text: "#7c3aed" },
};

export const ALERT_COLORS = {
  Safe: { main: "#10b981", soft: "rgba(16,185,129,0.14)", text: "#047857" },
  Moderate: { main: "#f59e0b", soft: "rgba(245,158,11,0.16)", text: "#b45309" },
  High: { main: "#f97316", soft: "rgba(249,115,22,0.15)", text: "#c2410c" },
  Critical: { main: "#ef4444", soft: "rgba(239,68,68,0.14)", text: "#b91c1c" },
};

export function getColor(map, key) {
  return map[key?.replace(" ", "-").replace("_", " ")] || map[key] || { main: "#64748b", soft: "rgba(100,116,139,0.14)", text: "#475569" };
}

// ── Card ────────────────────────────────────────────────────────────────────
export function Card({ children, className = "", ...props }) {
  return (
    <motion.div
      whileHover={{ y: -3 }}
      transition={{ type: "spring", stiffness: 300, damping: 22 }}
      className={`card ${className}`}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export function CardHeader({ icon, title, subtitle, right }) {
  const Icon = icon ? lucideIcons[icon] : null;
  return (
    <div className="card-header">
      <div className="card-header-left">
        {Icon && (
          <span className="card-icon">
            <Icon size={18} />
          </span>
        )}
        <div>
          <h3 className="card-title">{title}</h3>
          {subtitle && <p className="card-subtitle">{subtitle}</p>}
        </div>
      </div>
      {right && <div className="card-header-right">{right}</div>}
    </div>
  );
}

// ── Badge ───────────────────────────────────────────────────────────────────
export function Badge({ label, color, icon: Icon, size = "md" }) {
  const c = color || { main: "#3b82f6", soft: "rgba(59,130,246,0.16)", text: "#1d4ed8" };
  return (
    <span className={`badge badge-${size}`} style={{ background: c.soft, color: c.text, border: `1px solid ${c.main}33` }}>
      {Icon && <Icon size={size === "sm" ? 12 : 14} />}
      {label}
    </span>
  );
}

// ── Stat Card with animated number ──────────────────────────────────────────
export function StatCard({ icon, label, value, unit, color, sub, delay = 0 }) {
  const Icon = icon ? lucideIcons[icon] : null;
  const c = color || { main: "#3b82f6", soft: "rgba(59,130,246,0.14)", text: "#1d4ed8" };
  return (
    <motion.div
      className="stat-card"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      whileHover={{ y: -4 }}
    >
      <div className="stat-card-top">
        <span className="stat-icon" style={{ background: c.soft, color: c.text }}>
          {Icon && <Icon size={20} />}
        </span>
        {sub && <span className="stat-sub">{sub}</span>}
      </div>
      <div className="stat-value" style={{ color: c.text }}>
        {value}
        {unit && <span className="stat-unit">{unit}</span>}
      </div>
      <div className="stat-label">{label}</div>
      <div className="stat-bar" style={{ background: `${c.main}22` }}>
        <motion.div
          className="stat-bar-fill"
          style={{ background: c.main }}
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(100, Math.max(0, parseFloat(value) || 0))}%` }}
          transition={{ delay: delay + 0.3, duration: 0.8, ease: "easeOut" }}
        />
      </div>
    </motion.div>
  );
}

// ── Circular Gauge ──────────────────────────────────────────────────────────
export function Gauge({ value, max = 100, label, color, size = 140, stroke = 12 }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (pct / 100) * circumference;
  const c = color || { main: "#3b82f6", text: "#1d4ed8" };
  return (
    <div className="gauge" style={{ width: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke="var(--gauge-track)" strokeWidth={stroke}
        />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke={c.main} strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dashoffset 1s ease" }}
        />
      </svg>
      <div className="gauge-center">
        <div className="gauge-value" style={{ color: c.text }}>{value}</div>
        {label && <div className="gauge-label">{label}</div>}
      </div>
    </div>
  );
}

// ── Progress Ring (small) ───────────────────────────────────────────────────
export function ProgressRing({ value, max = 100, size = 64, stroke = 6, color }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (pct / 100) * circumference;
  const c = color || { main: "#3b82f6", text: "#1d4ed8" };
  return (
    <div className="progress-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--gauge-track)" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke={c.main} strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={circumference}
          strokeDashoffset={offset} transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dashoffset 1s ease" }}
        />
      </svg>
      <div className="progress-ring-value" style={{ color: c.text }}>{value}</div>
    </div>
  );
}

// ── Section title ───────────────────────────────────────────────────────────
export function SectionTitle({ icon, title, subtitle }) {
  const Icon = icon ? lucideIcons[icon] : null;
  return (
    <div className="section-title">
      {Icon && (
        <span className="section-title-icon">
          <Icon size={18} />
        </span>
      )}
      <div>
        <h3>{title}</h3>
        {subtitle && <p>{subtitle}</p>}
      </div>
    </div>
  );
}

// ── Loading skeleton ────────────────────────────────────────────────────────
export function Skeleton({ className = "" }) {
  return <div className={`skeleton ${className}`} />;
}

export function SkeletonCard() {
  return (
    <div className="card skeleton-card">
      <Skeleton style={{ height: 20, width: "40%" }} />
      <Skeleton style={{ height: 40, width: "70%", marginTop: 16 }} />
      <Skeleton style={{ height: 14, width: "55%", marginTop: 12 }} />
      <Skeleton style={{ height: 14, width: "80%", marginTop: 8 }} />
    </div>
  );
}

// ── Insight / recommendation item ───────────────────────────────────────────
export function InsightItem({ icon, text, priority, color }) {
  const Icon = icon ? lucideIcons[icon] : null;
  const c = color || { main: "#3b82f6", soft: "rgba(59,130,246,0.14)", text: "#1d4ed8" };
  return (
    <div className="insight-item">
      <span className="insight-icon" style={{ background: c.soft, color: c.text }}>
        {Icon && <Icon size={16} />}
      </span>
      <div className="insight-text">{text}</div>
      {priority && (
        <span className={`priority priority-${priority.toLowerCase()}`}>{priority}</span>
      )}
    </div>
  );
}
