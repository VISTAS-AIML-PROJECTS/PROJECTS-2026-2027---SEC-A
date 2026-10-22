import { useAqi } from "../aqiContext";
import { motion } from "framer-motion";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, Legend,
} from "recharts";
import { TrendingDown, Cpu, MapPin, AlertCircle, RefreshCw } from "lucide-react";

const AQI_PALETTE = {
  Good:         { text: "#059669", bar: "#10b981", soft: "rgba(16,185,129,0.12)" },
  Satisfactory: { text: "#2563eb", bar: "#3b82f6", soft: "rgba(59,130,246,0.12)" },
  Moderate:     { text: "#d97706", bar: "#f59e0b", soft: "rgba(245,158,11,0.12)" },
  Poor:         { text: "#ea580c", bar: "#f97316", soft: "rgba(249,115,22,0.12)" },
  "Very Poor":  { text: "#dc2626", bar: "#ef4444", soft: "rgba(239,68,68,0.12)" },
  Severe:       { text: "#7c3aed", bar: "#8b5cf6", soft: "rgba(139,92,246,0.12)" },
};
const fallback = { text: "#4b5675", bar: "#6366f1", soft: "rgba(99,102,241,0.12)" };

function getPalette(bucket) { return AQI_PALETTE[bucket] || fallback; }

function AqiBadge({ bucket }) {
  const cls = bucket?.replace(" ", "-") || "";
  return <span className={`aqi-badge ${cls}`}>{bucket}</span>;
}

const CARD_VARIANTS = {
  hidden: { opacity: 0, y: 20 },
  visible: (i) => ({ opacity: 1, y: 0, transition: { delay: i * 0.07, duration: 0.4 } }),
};

export default function Dashboard() {
  const { data, error, loadData, selectedCity: selected, setSelectedCity: setSelected } = useAqi();

  if (error) return (
    <div className="error-state card">
      <AlertCircle size={38} color="#ef4444" />
      <p style={{ fontWeight: 600, color: "var(--text-heading)", marginTop: 4 }}>Connection Error</p>
      <p>{error}</p>
      <button className="btn-secondary" style={{ marginTop: 12 }} onClick={loadData}>
        <RefreshCw size={14} /> Retry Connection
      </button>
    </div>
  );
  if (!data) return (
    <div className="loading-state card">
      <div className="loading-spinner" />
      <p style={{ fontWeight: 500, color: "var(--text-heading)", marginTop: 8 }}>Loading city air quality intelligence…</p>
      <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Connecting to PureBreath AI backend</span>
    </div>
  );

  const cities = Object.entries(data.cities);
  const xai = data.xai_summary;
  const selectedData = selected ? data.cities[selected] : null;

  const barData = cities.map(([city, d]) => ({
    city,
    AQI: d.aqi,
    "Risk Score": d.mean_risk_score,
    bucket: d.aqi_bucket,
  }));

  const radarData = cities.map(([city, d]) => ({
    city,
    AQI: Math.min(d.aqi / 5, 100),
    Risk: d.mean_risk_score,
    "Wkly Dose": Math.min((d.mean_weekly_dose || 0) / 50, 100),
  }));

  return (
    <>
      {/* ── City Selector ── */}
      <div className="city-strip">
        {cities.map(([city], i) => (
          <motion.button
            key={city}
            className={`city-chip ${selected === city ? "active" : ""}`}
            onClick={() => setSelected(city)}
            custom={i}
            variants={CARD_VARIANTS}
            initial="hidden"
            animate="visible"
          >
            <MapPin size={12} style={{ display: "inline", marginRight: 4 }} />
            {city}
          </motion.button>
        ))}
      </div>

      {/* ── City AQI Cards ── */}
      <div className="grid-auto">
        {cities.map(([city, d], i) => {
          const p = getPalette(d.aqi_bucket);
          return (
            <motion.div
              key={city}
              className={`city-card ${selected === city ? "selected" : ""}`}
              onClick={() => setSelected(city)}
              custom={i}
              variants={CARD_VARIANTS}
              initial="hidden"
              animate="visible"
              whileHover={{ y: -4 }}
            >
              <div className="city-name">{city}</div>
              <div className={`aqi-val text-${d.aqi_bucket?.replace(" ", "-")}`}>{d.aqi}</div>
              <AqiBadge bucket={d.aqi_bucket} />
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>
                Avg risk: <strong style={{ color: "var(--text-heading)" }}>{d.mean_risk_score}</strong>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* ── Selected city detail ── */}
      {selectedData && (
        <motion.div
          className="card"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          key={selected}
          transition={{ duration: 0.35 }}
        >
          <div className="card-header">
            <div className="card-header-left">
              <span className="card-icon"><MapPin size={18} /></span>
              <div>
                <div className="card-title">{selected} — Overview</div>
              </div>
            </div>
            <AqiBadge bucket={selectedData.aqi_bucket} />
          </div>
          <div className="grid-3">
            <div className="stat-tile">
              <div className={`value text-${selectedData.aqi_bucket?.replace(" ", "-")}`}>
                {selectedData.aqi}
              </div>
              <div className="label">Current AQI</div>
            </div>
            <div className="stat-tile">
              <div className="value">{selectedData.mean_risk_score}</div>
              <div className="label">Mean Risk Score</div>
            </div>
            <div className="stat-tile">
              <div className="value">{Math.round(selectedData.mean_weekly_dose || 0)}</div>
              <div className="label">Mean Weekly Dose</div>
            </div>
          </div>
        </motion.div>
      )}

      {/* ── Charts row ── */}
      <div className="grid-2">
        {/* AQI bar chart */}
        <motion.div className="card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <div className="card-header">
            <div className="card-header-left">
              <span className="card-icon"><TrendingDown size={18} /></span>
              <div>
                <div className="card-title">AQI vs Risk Score</div>
                <div className="card-subtitle">Comparison across cities</div>
              </div>
            </div>
          </div>
          <div style={{ width: "100%", height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 4, right: 12, left: -16, bottom: 0 }}>
                <XAxis dataKey="city" tick={{ fontSize: 11, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="left" tick={{ fontSize: 10, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tick={{ fontSize: 10, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 12 }}
                  itemStyle={{ color: "var(--text)" }}
                  labelStyle={{ color: "var(--text-heading)", fontWeight: 600 }}
                  cursor={{ fill: "var(--accent-soft)" }}
                />
                <Bar yAxisId="left" dataKey="AQI" radius={[5, 5, 0, 0]}>
                  {barData.map((e) => (
                    <Cell key={e.city} fill={getPalette(e.bucket).bar} />
                  ))}
                </Bar>
                <Bar yAxisId="right" dataKey="Risk Score" fill="var(--accent)" radius={[5, 5, 0, 0]} opacity={0.7} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Radar */}
        <motion.div className="card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }}>
          <div className="card-header">
            <div className="card-header-left">
              <span className="card-icon"><Cpu size={18} /></span>
              <div>
                <div className="card-title">Multi-Metric Radar</div>
                <div className="card-subtitle">Normalised city comparison</div>
              </div>
            </div>
          </div>
          <div style={{ width: "100%", height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData}>
                <PolarGrid stroke="var(--chart-grid)" />
                <PolarAngleAxis dataKey="city" tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
                <Radar name="AQI (norm)" dataKey="AQI" stroke="#6366f1" fill="#6366f1" fillOpacity={0.2} />
                <Radar name="Risk" dataKey="Risk" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.15} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 12 }}
                  itemStyle={{ color: "var(--text)" }}
                  labelStyle={{ color: "var(--text-heading)", fontWeight: 600 }}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      {/* ── XAI Summary ── */}
      <motion.div className="card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <div className="card-header">
          <div className="card-header-left">
            <span className="card-icon"><Cpu size={18} /></span>
            <div>
              <div className="card-title">XAI Summary — SHAP &amp; Counterfactuals</div>
              <div className="card-subtitle">Explainability metrics across the dataset</div>
            </div>
          </div>
        </div>
        <div className="grid-3" style={{ marginBottom: 20 }}>
          <div className="stat-tile">
            <div className="value">{xai.cf_samples_improved}<span style={{ fontSize: 14, fontWeight: 500, opacity: 0.5 }}>/{xai.n_samples}</span></div>
            <div className="label">Samples Improved</div>
          </div>
          <div className="stat-tile">
            <div className="value" style={{ color: "#059669" }}>↓{xai.cf_mean_aqi_reduction}</div>
            <div className="label">Mean AQI Reduction</div>
          </div>
          <div className="stat-tile">
            <div className="value">{xai.cf_bucket_changes}</div>
            <div className="label">Bucket Category Shifts</div>
          </div>
        </div>

        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.5px" }}>
          Top-5 Global SHAP Features
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {xai.top5_global_features.map((f, i) => (
            <div key={f} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{
                width: 22, height: 22, borderRadius: "50%",
                background: "var(--accent-soft)", color: "var(--accent)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, fontWeight: 700, flexShrink: 0,
              }}>#{i + 1}</span>
              <span style={{
                background: "var(--accent-soft)", color: "var(--accent)",
                padding: "4px 12px", borderRadius: 99, fontSize: 12, fontWeight: 600,
                border: "1px solid var(--accent-border)",
              }}>{f}</span>
            </div>
          ))}
        </div>
      </motion.div>
    </>
  );
}
