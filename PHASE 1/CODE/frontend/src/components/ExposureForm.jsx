import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import axios from "axios";
import { useAqi } from "../aqiContext";
import {
  XAxis, YAxis, Tooltip, ResponsiveContainer,
  ReferenceLine, CartesianGrid, Area, AreaChart,
} from "recharts";
import { Activity, AlertTriangle, Clock, AlertCircle, Sparkles, ShieldAlert, TrendingUp } from "lucide-react";

const API = "http://localhost:8000";
const CITIES = ["Delhi", "Mumbai", "Bangalore", "Kolkata", "Chennai"];

const ALERT_PALETTE = {
  Safe:     { text: "#059669", soft: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.3)", bar: "#10b981" },
  Moderate: { text: "#d97706", soft: "rgba(245,158,11,0.12)",  border: "rgba(245,158,11,0.3)",  bar: "#f59e0b" },
  High:     { text: "#ea580c", soft: "rgba(249,115,22,0.12)",  border: "rgba(249,115,22,0.3)",  bar: "#f97316" },
  Critical: { text: "#dc2626", soft: "rgba(239,68,68,0.12)",   border: "rgba(239,68,68,0.3)",   bar: "#ef4444" },
};
const ap = (a) => ALERT_PALETTE[a] || ALERT_PALETTE.Safe;

function AlertBadge({ label }) {
  const p = ap(label);
  return (
    <span style={{
      padding: "3px 10px", borderRadius: 99, fontSize: 11, fontWeight: 700,
      background: p.soft, color: p.text, border: `1px solid ${p.border}`,
    }}>{label}</span>
  );
}

export default function ExposureForm() {
  const { selectedCity: city, setSelectedCity: setCity, currentAqi } = useAqi();
  const [age, setAge]                 = useState(35);
  const [asthma, setAsthma]           = useState(false);
  const [pregnancy, setPregnancy]     = useState(false);
  const [outdoorHours, setOutdoorHours] = useState(3);
  const [result, setResult]           = useState(null);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState("");

  const baseAqi = currentAqi;

  useEffect(() => {
    setResult(null);
  }, [city]);

  const submit = async () => {
    setLoading(true); setError(""); setResult(null);
    try {
      const { data } = await axios.post(`${API}/exposure`, {
        city, base_aqi: baseAqi,
        user: { age, asthma, pregnancy, occupation: "Other", outdoor_hours: outdoorHours },
      });
      setResult(data);
    } catch (e) {
      setError(e.response?.data?.detail || "API error.");
    } finally {
      setLoading(false);
    }
  };

  const maxDose = result
    ? Math.max(...result.daily_records.map((r) => r.daily_dose), 1)
    : 1;

  const chartData = result?.daily_records?.map((r, i) => ({
    day: `Day ${i + 1}`,
    dose: r.daily_dose,
    aqi: r.aqi,
  }));

  const alertPal = result ? ap(result.weekly_alert) : null;

  return (
    <>
      {/* ── Input form ── */}
      <div className="card">
        <div className="card-header">
          <div className="card-header-left">
            <span className="card-icon"><Activity size={18} /></span>
            <div>
              <div className="card-title">Cumulative Exposure Calculator</div>
              <div className="card-subtitle">7-day personal air quality exposure analysis</div>
            </div>
          </div>
        </div>

        {/* City chips */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.4px", textTransform: "uppercase", marginBottom: 8 }}>City</div>
          <div className="city-strip">
            {CITIES.map((c) => (
              <button key={c} className={`city-chip ${city === c ? "active" : ""}`} onClick={() => setCity(c)}>{c}</button>
            ))}
          </div>
        </div>

        <div className="form-grid">
          <div className="form-group">
            <label>Base AQI</label>
            <input type="number" value={baseAqi ?? ""} readOnly min={0} />
          </div>
          <div className="form-group">
            <label>Age</label>
            <input type="number" value={age} onChange={e => setAge(+e.target.value)} min={1} max={120} />
          </div>
          <div className="form-group">
            <label>Outdoor Hours / Day</label>
            <input type="number" value={outdoorHours} onChange={e => setOutdoorHours(+e.target.value)} min={0} max={24} step={0.5} />
          </div>
          <div className="form-group">
            <label>Asthma</label>
            <select value={asthma ? "Yes" : "No"} onChange={e => setAsthma(e.target.value === "Yes")}>
              <option>No</option><option>Yes</option>
            </select>
          </div>
          <div className="form-group">
            <label>Pregnancy</label>
            <select value={pregnancy ? "Yes" : "No"} onChange={e => setPregnancy(e.target.value === "Yes")}>
              <option>No</option><option>Yes</option>
            </select>
          </div>
        </div>

        <button className="btn-primary" onClick={submit} disabled={loading || currentAqi == null}>
          {loading ? (
            <><span className="loading-spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />Computing…</>
          ) : (
            <><Activity size={16} />Compute Exposure</>
          )}
        </button>

        {error && (
          <div className="error-state" style={{ marginTop: 16, padding: "16px 20px" }}>
            <AlertCircle size={22} color="#ef4444" />
            <p>{error}</p>
          </div>
        )}
      </div>

      {/* ── Loading state ── */}
      {loading && (
        <div className="loading-state card">
          <div className="loading-spinner" />
          <p style={{ fontWeight: 500, color: "var(--text-heading)", marginTop: 8 }}>
            Calculating 7-Day Cumulative Exposure…
          </p>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
            Integrating ambient air quality baseline for {city} with daily outdoor hours & biometric vulnerability
          </span>
        </div>
      )}

      {/* ── Empty preview state ── */}
      {!result && !loading && !error && (
        <motion.div
          className="empty-preview-card"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
        >
          <div className="empty-preview-icon">
            <Activity size={26} />
          </div>
          <div className="empty-preview-title">7-Day Cumulative Exposure Analytics</div>
          <p className="empty-preview-desc">
            Calculate your cumulative toxicological particulate burden based on daily outdoor exposure duration, ambient AQI baseline, and biological vulnerability weighting.
          </p>
          <div className="preview-features-grid">
            <div className="preview-feature-item">
              <Sparkles size={18} className="pfi-icon" />
              <div className="pfi-title">Dose Modeling</div>
              <div className="pfi-text">Mathematical integration of AQI and daily outdoor hours</div>
            </div>
            <div className="preview-feature-item">
              <ShieldAlert size={18} className="pfi-icon" />
              <div className="pfi-title">Vulnerability Factor</div>
              <div className="pfi-text">Biometric risk weighting for age, asthma, and pregnancy</div>
            </div>
            <div className="preview-feature-item">
              <TrendingUp size={18} className="pfi-icon" />
              <div className="pfi-title">Threshold Alerts</div>
              <div className="pfi-text">Clinical alert classification: Safe, Moderate, High, Critical</div>
            </div>
            <div className="preview-feature-item">
              <Clock size={18} className="pfi-icon" />
              <div className="pfi-title">Day-by-Day Timeline</div>
              <div className="pfi-text">Granular 7-day chronological breakdown with dosage bars</div>
            </div>
          </div>
        </motion.div>
      )}

      {/* ── Results ── */}
      {result && (
        <motion.div
          style={{ display: "flex", flexDirection: "column", gap: 20 }}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          {/* Summary stats */}
          <div className="grid-3">
            <div className="stat-tile">
              <div className="value">{Math.round(result.weekly_dose)}</div>
              <div className="label">Weekly Dose (AQI·hrs)</div>
            </div>
            <div className="stat-tile" style={{ borderColor: alertPal.border, background: alertPal.soft }}>
              <div className="value" style={{ color: alertPal.text }}>{result.weekly_alert}</div>
              <div className="label">Weekly Alert Level</div>
            </div>
            <div className="stat-tile">
              <div className="value">{result.vulnerability_w}</div>
              <div className="label">Vulnerability Weight</div>
            </div>
          </div>

          {/* Alert message */}
          <div style={{
            display: "flex", gap: 12, alignItems: "flex-start",
            padding: "14px 16px", borderRadius: 12,
            background: alertPal.soft, border: `1px solid ${alertPal.border}`,
          }}>
            <AlertTriangle size={18} color={alertPal.text} style={{ flexShrink: 0, marginTop: 2 }} />
            <p style={{ color: alertPal.text, fontSize: 13, lineHeight: 1.6 }}>{result.weekly_message}</p>
          </div>

          {/* Chart + timeline */}
          <div className="grid-2">
            {/* Area chart */}
            <div className="card">
              <div className="card-header">
                <div className="card-header-left">
                  <span className="card-icon"><Activity size={18} /></span>
                  <div>
                    <div className="card-title">Daily Dose Trend</div>
                    <div className="card-subtitle">7-day cumulative exposure pattern</div>
                  </div>
                </div>
              </div>
              <div style={{ width: "100%", height: 200 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="dose-grad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
                    <XAxis dataKey="day" tick={{ fontSize: 10, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 12 }}
                      itemStyle={{ color: "var(--text)" }}
                      labelStyle={{ color: "var(--text-heading)", fontWeight: 600 }}
                    />
                    <ReferenceLine y={400} stroke="#f59e0b" strokeDasharray="4 2" label={{ value: "Moderate", fontSize: 9, fill: "#f59e0b" }} />
                    <ReferenceLine y={700} stroke="#ef4444" strokeDasharray="4 2" label={{ value: "High", fontSize: 9, fill: "#ef4444" }} />
                    <Area type="monotone" dataKey="dose" stroke="#6366f1" strokeWidth={2.5} fill="url(#dose-grad)" dot={{ r: 3, fill: "#6366f1" }} name="Daily Dose" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Daily breakdown */}
            <div className="card">
              <div className="card-header">
                <div className="card-header-left">
                  <span className="card-icon"><Clock size={18} /></span>
                  <div>
                    <div className="card-title">Daily Breakdown</div>
                    <div className="card-subtitle">Per-day exposure details</div>
                  </div>
                </div>
              </div>
              <div className="exposure-timeline">
                {/* Header */}
                <div className="timeline-row header-row">
                  <div>Date</div>
                  <div>AQI</div>
                  <div>Dose</div>
                  <div>Alert</div>
                </div>
                {result.daily_records.map((r, i) => {
                  const dpct = Math.min((r.daily_dose / maxDose) * 100, 100);
                  return (
                    <motion.div
                      key={i}
                      className="timeline-row"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                    >
                      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{r.date}</div>
                      <div style={{ fontWeight: 700, color: "var(--text-heading)" }}>{r.aqi}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ flex: 1, height: 6, borderRadius: 4, background: "var(--bg-surface-3)", overflow: "hidden" }}>
                          <motion.div
                            className="timeline-dose-bar"
                            initial={{ width: 0 }}
                            animate={{ width: `${dpct}%` }}
                            transition={{ delay: i * 0.05 + 0.3, duration: 0.6, ease: "easeOut" }}
                          />
                        </div>
                        <span style={{ fontSize: 11, color: "var(--text-muted)", minWidth: 32 }}>{r.daily_dose}</span>
                      </div>
                      <AlertBadge label={r.daily_alert} />
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </>
  );
}
