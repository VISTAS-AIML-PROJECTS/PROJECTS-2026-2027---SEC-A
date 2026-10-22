import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import axios from "axios";
import { useAqi } from "../aqiContext";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { Wind, Thermometer, Droplets, Brain, Zap, TrendingUp, AlertCircle, RefreshCw } from "lucide-react";

const API = "http://localhost:8000";
const CITIES = ["Delhi", "Mumbai", "Bangalore", "Kolkata", "Chennai"];

const AQI_PALETTE = {
  Good:         { text: "#059669", bar: "#10b981", grad: "#10b981" },
  Satisfactory: { text: "#2563eb", bar: "#3b82f6", grad: "#3b82f6" },
  Moderate:     { text: "#d97706", bar: "#f59e0b", grad: "#f59e0b" },
  Poor:         { text: "#ea580c", bar: "#f97316", grad: "#f97316" },
  "Very Poor":  { text: "#dc2626", bar: "#ef4444", grad: "#ef4444" },
  Severe:       { text: "#7c3aed", bar: "#8b5cf6", grad: "#8b5cf6" },
};
const fp = (b) => AQI_PALETTE[b] || { text: "#6366f1", bar: "#6366f1", grad: "#6366f1" };

const CONDITION_LABELS = {
  "PM2.5": "PM2.5 (µg/m³)", PM10: "PM10 (µg/m³)",
  NO2: "NO₂ (µg/m³)", SO2: "SO₂ (µg/m³)",
  CO: "CO (mg/m³)", O3: "O₃ (µg/m³)",
  temp_mean_c: "Temperature (°C)", precipitation_mm: "Precipitation (mm)",
};

const CONDITION_ICONS = {
  "PM2.5": Wind, PM10: Wind, NO2: Wind, SO2: Wind, CO: Wind, O3: Wind,
  temp_mean_c: Thermometer, precipitation_mm: Droplets,
};

function AqiBadge({ bucket }) {
  const cls = bucket?.replace(" ", "-") || "";
  return <span className={`aqi-badge ${cls}`}>{bucket}</span>;
}

function formatDay(iso) {
  const d = new Date(iso + "T00:00:00");
  const day = d.toLocaleDateString("en-IN", { weekday: "short" });
  const date = d.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
  return { day, date };
}

export default function PredictForm() {
  const { selectedCity: city, setSelectedCity: setCity, selectedData, currentAqi } = useAqi();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const fetch = async () => {
      setLoading(true); setError(""); setData(null);
      try {
        const res = await axios.get(`${API}/auto-predict/${city}`);
        if (!cancelled) setData(res.data);
      } catch (e) {
        if (!cancelled) setError(e.response?.data?.detail || "Backend unreachable. Is the server running?");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetch();
    return () => { cancelled = true; };
  }, [city]);

  const currentBucket = selectedData?.aqi_bucket;
  const pal = fp(currentBucket || data?.aqi_bucket);
  const maxShap = data ? Math.max(...data.top5_shap_features.map((f) => Math.abs(f.shap_value))) : 1;

  const forecastChart = data?.forecast.map((f) => ({
    date: formatDay(f.date).day,
    aqi: f.aqi,
    bucket: f.aqi_bucket,
  }));

  return (
    <>
      {/* ── City selector ── */}
      <div className="card" style={{ padding: "16px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.4px" }}>
            Select City
          </span>
          <div className="city-strip">
            {CITIES.map((c) => (
              <button key={c} className={`city-chip ${city === c ? "active" : ""}`} onClick={() => setCity(c)}>{c}</button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Loading ── */}
      {loading && (
        <div className="loading-state card">
          <div className="loading-spinner" />
          <p style={{ fontWeight: 500, color: "var(--text-heading)", marginTop: 8 }}>Forecasting air quality for {city}…</p>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Running SHAP explainability & counterfactual reduction models</span>
        </div>
      )}

      {/* ── Error ── */}
      {error && (
        <div className="error-state card">
          <AlertCircle size={36} color="#ef4444" />
          <p style={{ fontWeight: 600, color: "var(--text-heading)", marginTop: 4 }}>Forecast Unavailable</p>
          <p>{error}</p>
          <button className="btn-secondary" style={{ marginTop: 10 }} onClick={() => setCity(c => `${c}`)}>
            <RefreshCw size={14} /> Retry Forecast
          </button>
        </div>
      )}

      {data && (
        <motion.div
          style={{ display: "flex", flexDirection: "column", gap: 20 }}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          {/* ── AQI Hero ── */}
          <div className="card">
            <div className="aqi-hero">
              <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 500 }}>
                Current AQI · {city}
              </div>
              <motion.div
                className={`aqi-hero-value text-${data.aqi_bucket?.replace(" ", "-")}`}
                initial={{ scale: 0.7, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 18 }}
              >
                {currentAqi}
              </motion.div>
              <AqiBadge bucket={currentBucket} />
              <div className="aqi-hero-note">
                Sourced from Dashboard · updates when the selected city changes
              </div>
            </div>
          </div>

          {/* ── Conditions & Forecast row ── */}
          <div className="grid-2">
            {/* Environmental conditions */}
            <div className="card">
              <div className="card-header">
                <div className="card-header-left">
                  <span className="card-icon"><Thermometer size={18} /></span>
                  <div>
                    <div className="card-title">Environmental Conditions</div>
                    <div className="card-subtitle">Current pollutant levels</div>
                  </div>
                </div>
              </div>
              <div className="grid-2" style={{ gap: 10 }}>
                {Object.entries(data.conditions).map(([k, v]) => {
                  const Icon = CONDITION_ICONS[k] || Wind;
                  return (
                    <div key={k} style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "10px 12px", borderRadius: 10,
                      background: "var(--bg-surface-2)", border: "1px solid var(--border)",
                    }}>
                      <span style={{ color: "var(--accent)", flexShrink: 0 }}><Icon size={15} /></span>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-heading)" }}>
                          {typeof v === "number" ? v.toFixed(1) : v}
                        </div>
                        <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{CONDITION_LABELS[k] ?? k}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 7-day forecast mini badges */}
            <div className="card">
              <div className="card-header">
                <div className="card-header-left">
                  <span className="card-icon"><TrendingUp size={18} /></span>
                  <div>
                    <div className="card-title">7-Day Forecast</div>
                    <div className="card-subtitle">Predicted AQI trend</div>
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, marginBottom: 16, overflowX: "auto" }}>
                {data.forecast.map((f, i) => {
                  const { day, date } = formatDay(f.date);
                  return (
                    <div key={f.date} className={`forecast-day-badge ${i === 0 ? "today" : ""}`}>
                      <div className="fdb-day">{i === 0 ? "Today" : day}</div>
                      <div className="fdb-date">{date}</div>
                      <div className={`fdb-aqi text-${f.aqi_bucket?.replace(" ", "-")}`}>{f.aqi}</div>
                      <AqiBadge bucket={f.aqi_bucket} />
                    </div>
                  );
                })}
              </div>
              <div style={{ width: "100%", height: 120 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={forecastChart} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="aqi-grad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={pal.grad} stopOpacity={0.35} />
                        <stop offset="95%" stopColor={pal.grad} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 12 }}
                      itemStyle={{ color: "var(--text)" }}
                      labelStyle={{ color: "var(--text-heading)", fontWeight: 600 }}
                      formatter={(val, _n, p) => [`${val} (${p.payload.bucket})`, "AQI"]}
                    />
                    <Area type="monotone" dataKey="aqi" stroke={pal.grad} strokeWidth={2.5} fill="url(#aqi-grad)" dot={{ r: 3, fill: pal.grad }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* ── SHAP + Counterfactual row ── */}
          <div className="grid-2">
            {/* SHAP */}
            <div className="card">
              <div className="card-header">
                <div className="card-header-left">
                  <span className="card-icon"><Brain size={18} /></span>
                  <div>
                    <div className="card-title">Top-5 SHAP Features</div>
                    <div className="card-subtitle">
                      <span style={{ color: "#ef4444" }}>Red</span> = raises AQI &nbsp;|&nbsp;
                      <span style={{ color: "#10b981" }}>Green</span> = lowers AQI
                    </div>
                  </div>
                </div>
              </div>
              {data.top5_shap_features.map((f) => {
                const pct = Math.min((Math.abs(f.shap_value) / maxShap) * 100, 100);
                const color = f.shap_value >= 0 ? "#ef4444" : "#10b981";
                return (
                  <div className="shap-bar" key={f.feature}>
                    <span className="feat-name">{f.feature}</span>
                    <div className="bar-track">
                      <motion.div
                        className="bar-fill"
                        style={{ background: color }}
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                      />
                    </div>
                    <span className="shap-val" style={{ color }}>
                      {f.shap_value > 0 ? "+" : ""}{f.shap_value.toFixed(3)}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Counterfactual */}
            <div className="card">
              <div className="card-header">
                <div className="card-header-left">
                  <span className="card-icon"><Zap size={18} /></span>
                  <div>
                    <div className="card-title">Counterfactual Scenario</div>
                    <div className="card-subtitle">What if top pollutants were reduced 20%?</div>
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 20, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Current AQI</div>
                  <div style={{ fontSize: 32, fontWeight: 800, color: pal.text, fontFamily: "var(--font-display)" }}>
                    {currentAqi}
                  </div>
                  <AqiBadge bucket={currentBucket} />
                </div>
                <motion.div
                  style={{ fontSize: 28, color: "var(--text-muted)" }}
                  animate={{ x: [0, 4, 0] }}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                >→</motion.div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Counterfactual AQI</div>
                  <div style={{ fontSize: 32, fontWeight: 800, color: "#10b981", fontFamily: "var(--font-display)" }}>
                    {data.counterfactual.counterfactual_aqi}
                  </div>
                  <AqiBadge bucket={data.counterfactual.cf_bucket} />
                </div>
                <div style={{
                  padding: "6px 14px", borderRadius: 99,
                  background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.3)",
                  color: "#059669", fontSize: 13, fontWeight: 700,
                }}>
                  ↓ {data.counterfactual.aqi_reduction} AQI
                </div>
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.4px" }}>
                Recommendations
              </div>
              <ul className="rec-list">
                {data.counterfactual.recommendations.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          </div>
        </motion.div>
      )}
    </>
  );
}
