import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import { useAqi } from "../aqiContext";
import {
  HeartPulse, ShieldAlert, MapPin, Clock, ChevronDown, AlertCircle, Sparkles, Brain,
} from "lucide-react";

const API = "http://localhost:8000";
const CITIES = ["Delhi", "Mumbai", "Bangalore", "Kolkata", "Chennai"];
const OCCUPATIONS = [
  "Other", "Office Employee", "Student", "Traffic Police",
  "Construction Worker", "Factory Worker", "Delivery Executive",
  "Farmer", "Driver", "Shopkeeper",
];
const GENDERS = ["Male", "Female", "Other"];

const AQI_PALETTE = {
  Good: { t: "#059669", s: "rgba(16,185,129,0.12)", b: "rgba(16,185,129,0.3)" },
  Satisfactory: { t: "#2563eb", s: "rgba(59,130,246,0.12)", b: "rgba(59,130,246,0.3)" },
  Moderate: { t: "#d97706", s: "rgba(245,158,11,0.12)", b: "rgba(245,158,11,0.3)" },
  Poor: { t: "#ea580c", s: "rgba(249,115,22,0.12)", b: "rgba(249,115,22,0.3)" },
  "Very Poor": { t: "#dc2626", s: "rgba(239,68,68,0.12)", b: "rgba(239,68,68,0.3)" },
  Severe: { t: "#7c3aed", s: "rgba(139,92,246,0.12)", b: "rgba(139,92,246,0.3)" },
};
const RISK_PALETTE = {
  Low: { t: "#059669", s: "rgba(16,185,129,0.12)", b: "rgba(16,185,129,0.3)" },
  Moderate: { t: "#d97706", s: "rgba(245,158,11,0.12)", b: "rgba(245,158,11,0.3)" },
  High: { t: "#ea580c", s: "rgba(249,115,22,0.12)", b: "rgba(249,115,22,0.3)" },
  "Very High": { t: "#dc2626", s: "rgba(239,68,68,0.12)", b: "rgba(239,68,68,0.3)" },
  Hazardous: { t: "#7c3aed", s: "rgba(139,92,246,0.12)", b: "rgba(139,92,246,0.3)" },
};
const ALERT_S = {
  info:    { bg: "rgba(59,130,246,0.1)", border: "rgba(59,130,246,0.3)", fg: "#2563eb" },
  warning: { bg: "rgba(245,158,11,0.1)", border: "rgba(245,158,11,0.3)", fg: "#d97706" },
  danger:  { bg: "rgba(239,68,68,0.1)",  border: "rgba(239,68,68,0.3)",  fg: "#dc2626" },
};
const PRI_FG = { High: "#ef4444", Medium: "#f59e0b", Low: "#10b981" };
const PRI_BG = { High: "rgba(239,68,68,0.1)", Medium: "rgba(245,158,11,0.1)", Low: "rgba(16,185,129,0.1)" };

function Badge({ label, pal }) {
  if (!pal) return null;
  return (
    <span style={{
      display: "inline-block", padding: "4px 12px", borderRadius: 99,
      fontWeight: 600, fontSize: 12, background: pal.s, color: pal.t, border: `1px solid ${pal.b}`,
    }}>
      {label}
    </span>
  );
}

function Gauge({ score, label, invert = false }) {
  const pct = score / 100;
  const color = invert
    ? (score < 20 ? "#10b981" : score < 40 ? "#f59e0b" : score < 60 ? "#f97316" : score < 80 ? "#ef4444" : "#8b5cf6")
    : (score >= 80 ? "#10b981" : score >= 60 ? "#f59e0b" : score >= 40 ? "#f97316" : score >= 20 ? "#ef4444" : "#8b5cf6");
  return (
    <div style={{ textAlign: "center" }}>
      <svg width="140" height="84" viewBox="0 0 160 90">
        <path d="M10 80 A70 70 0 0 1 150 80" fill="none" stroke="var(--gauge-track)" strokeWidth="14" strokeLinecap="round" />
        <path d="M10 80 A70 70 0 0 1 150 80" fill="none" stroke={color} strokeWidth="14"
          strokeLinecap="round" strokeDasharray={`${pct * 220} 220`} />
        <text x="80" y="72" textAnchor="middle" fontSize="22" fontWeight="800" fill="var(--text-heading)">{score}</text>
        <text x="80" y="85" textAnchor="middle" fontSize="9" fill="var(--text-muted)">{label}</text>
      </svg>
    </div>
  );
}

function Collapsible({ title, icon: Icon, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="collapsible-section">
      <div className="collapsible-header" onClick={() => setOpen(o => !o)}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {Icon && <span style={{ color: "var(--accent)" }}><Icon size={16} /></span>}
          <h3>{title}</h3>
        </div>
        <ChevronDown size={16} className={`collapsible-chevron ${open ? "open" : ""}`} />
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeInOut" }}
            style={{ overflow: "hidden" }}
          >
            <div className="collapsible-body">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function HealthRiskForm() {
  const { selectedCity: city, setSelectedCity: setCity, currentAqi, selectedData } = useAqi();
  const [age, setAge]               = useState(35);
  const [gender, setGender]         = useState("Male");
  const [asthma, setAsthma]         = useState(false);
  const [pregnancy, setPregnancy]   = useState(false);
  const [occupation, setOccupation] = useState("Other");
  const [outdoorHours, setOutdoorHours] = useState(3);
  const [result, setResult]         = useState(null);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState("");

  useEffect(() => {
    setResult(null);
  }, [city]);

  const submit = async () => {
    setLoading(true); setError(""); setResult(null);
    try {
      const { data } = await axios.post(`${API}/health-report`, {
        city, age, gender, asthma, pregnancy, occupation, outdoor_hours: outdoorHours,
      });
      setResult({ ...data, aqi: currentAqi, aqi_bucket: selectedData.aqi_bucket });
    } catch (e) {
      setError(e.response?.data?.detail || "API error. Is the backend running?");
    } finally {
      setLoading(false);
    }
  };

  const aqiPal = result ? (AQI_PALETTE[result.aqi_bucket] || null) : null;
  const riskPal = result ? (RISK_PALETTE[result.risk_level] || null) : null;

  return (
    <>
      {/* ── Input form ── */}
      <div className="card">
        <div className="card-header">
          <div className="card-header-left">
            <span className="card-icon"><HeartPulse size={18} /></span>
            <div>
              <div className="card-title">AI Health Risk Advisor</div>
              <div className="card-subtitle">Personalised risk assessment based on your profile &amp; current AQI</div>
            </div>
          </div>
        </div>

        {/* City chips */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.4px", textTransform: "uppercase", marginBottom: 8 }}>City</div>
          <div className="city-strip">
            {CITIES.map(c => (
              <button key={c} className={`city-chip ${city === c ? "active" : ""}`} onClick={() => setCity(c)}>{c}</button>
            ))}
          </div>
        </div>

        <div className="form-grid">
          <div className="form-group">
            <label>Age</label>
            <input type="number" value={age} onChange={e => setAge(+e.target.value)} min={1} max={120} />
          </div>
          <div className="form-group">
            <label>Gender</label>
            <select value={gender} onChange={e => setGender(e.target.value)}>
              {GENDERS.map(g => <option key={g}>{g}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Occupation</label>
            <select value={occupation} onChange={e => setOccupation(e.target.value)}>
              {OCCUPATIONS.map(o => <option key={o}>{o}</option>)}
            </select>
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

        <button className="btn-primary" onClick={submit} disabled={loading}>
          {loading ? (
            <><span className="loading-spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />Analyzing Risk Profile…</>
          ) : (
            <><HeartPulse size={16} />Assess Health Risk</>
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
        <div className="loading-state card" style={{ marginTop: 16 }}>
          <div className="loading-spinner" />
          <p style={{ fontWeight: 500, color: "var(--text-heading)", marginTop: 8 }}>
            AI Health Risk Model Assessing Vulnerability…
          </p>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
            Correlating {city} pollutant telemetry with biometric indicators &amp; clinical thresholds
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
            <HeartPulse size={26} />
          </div>
          <div className="empty-preview-title">AI Personalized Health Risk Advisor</div>
          <p className="empty-preview-desc">
            Enter your demographic profile and medical predispositions above to receive a personalized, explainable air quality risk assessment and medical action plan.
          </p>
          <div className="preview-features-grid">
            <div className="preview-feature-item">
              <Sparkles size={18} className="pfi-icon" />
              <div className="pfi-title">Biometric Health Gauges</div>
              <div className="pfi-text">Dual health score (0-100) and risk score calibrated to your vulnerability</div>
            </div>
            <div className="preview-feature-item">
              <ShieldAlert size={18} className="pfi-icon" />
              <div className="pfi-title">Clinical Alerts</div>
              <div className="pfi-text">Proactive warnings for asthma, respiratory stress, and emergency states</div>
            </div>
            <div className="preview-feature-item">
              <Clock size={18} className="pfi-icon" />
              <div className="pfi-title">Outdoor Safe Windows</div>
              <div className="pfi-text">Calculated safe outdoor durations and exercise advisories for today</div>
            </div>
            <div className="preview-feature-item">
              <Brain size={18} className="pfi-icon" />
              <div className="pfi-title">Explainable AI (XAI)</div>
              <div className="pfi-text">SHAP-driven transparent reasoning detailing why the AI reached this conclusion</div>
            </div>
          </div>
        </motion.div>
      )}

      {/* ── Results ── */}
      {result && (
        <motion.div
          style={{ display: "flex", flexDirection: "column", gap: 4 }}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          {/* Emergency warning */}
          {result.is_emergency && (
            <div style={{
              display: "flex", gap: 14, alignItems: "flex-start",
              padding: "16px 18px", borderRadius: 12,
              background: "rgba(239,68,68,0.08)", border: "1.5px solid rgba(239,68,68,0.35)",
              marginBottom: 4,
            }}>
              <ShieldAlert size={24} color="#dc2626" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <div style={{ fontWeight: 700, color: "#dc2626", marginBottom: 4 }}>Emergency Health Warning</div>
                <div style={{ fontSize: 13, color: "#dc2626", lineHeight: 1.6 }}>
                  Current air quality is Severe or you belong to a high-risk group.
                  Stay indoors, avoid all outdoor activity, and seek medical advice immediately if you experience breathing difficulty.
                </div>
              </div>
            </div>
          )}

          {/* Gauges + AQI hero */}
          <div className="card">
            <div style={{ display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap", justifyContent: "space-between" }}>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Gauge score={result.health_score} label="Health Score / 100" invert={false} />
                <Gauge score={result.risk_score}   label="Risk Score / 100"   invert={true} />
              </div>
              <div style={{ flex: 1, minWidth: 160 }}>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>City — Current AQI</div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  <span style={{ fontSize: 40, fontWeight: 800, fontFamily: "var(--font-display)", lineHeight: 1, color: aqiPal?.t || "var(--text-heading)" }}>
                    {result.aqi}
                  </span>
                  <Badge label={result.aqi_bucket} pal={aqiPal} />
                </div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Overall Risk Level</div>
                <Badge label={result.risk_level} pal={riskPal} />
              </div>
            </div>
          </div>

          {/* Alerts */}
          {result.alerts.length > 0 && (
            <Collapsible title="High-Risk Alerts" icon={ShieldAlert}>
              {result.alerts.map((a, i) => {
                const s = ALERT_S[a.level] || ALERT_S.info;
                return (
                  <div key={i} style={{
                    background: s.bg, border: `1px solid ${s.border}`,
                    borderRadius: 10, padding: "10px 14px", marginBottom: 8,
                    display: "flex", gap: 10, alignItems: "flex-start",
                    fontSize: 13, color: s.fg,
                  }}>
                    <span>{a.icon}</span>
                    <span>{a.text}</span>
                  </div>
                );
              })}
            </Collapsible>
          )}

          {/* AI Summary */}
          <Collapsible title="AI Risk Summary" icon={Brain}>
            <p className="ai-summary-text">{result.ai_summary}</p>
          </Collapsible>

          {/* Health effects */}
          <Collapsible title="Health Effects" icon={HeartPulse}>
            {result.health_effects.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--text-muted)" }}>No significant health effects expected at current AQI.</p>
            ) : (
              <div className="grid-auto" style={{ gap: 10 }}>
                {result.health_effects.map((e, i) => (
                  <div key={i} style={{
                    background: "var(--bg-surface-3)", border: "1px solid var(--border)",
                    borderRadius: 10, padding: "12px 14px",
                    display: "flex", gap: 10, alignItems: "flex-start",
                  }}>
                    <span style={{ fontSize: 20 }}>{e.icon}</span>
                    <div>
                      <div style={{ fontSize: 13, color: "var(--text-heading)", fontWeight: 500 }}>{e.effect}</div>
                      <div style={{
                        fontSize: 11, marginTop: 3, fontWeight: 700,
                        color: e.term === "Long-term" ? "#8b5cf6" : "#f97316",
                      }}>{e.term}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Collapsible>

          {/* Recommendations */}
          <Collapsible title="Personalised Recommendations" icon={Sparkles}>
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {result.recommendations.map((r, i) => (
                <li key={i} style={{
                  display: "flex", gap: 10, alignItems: "flex-start",
                  padding: "10px 0", borderBottom: "1px solid var(--border)", fontSize: 13,
                }}>
                  <span style={{ fontSize: 18 }}>{r.icon}</span>
                  <div style={{ flex: 1, color: "var(--text)", lineHeight: 1.6 }}>{r.text}</div>
                  <span style={{
                    fontSize: 10, fontWeight: 700, whiteSpace: "nowrap",
                    padding: "2px 8px", borderRadius: 99,
                    color: PRI_FG[r.priority] || "var(--text-muted)",
                    background: PRI_BG[r.priority] || "var(--bg-surface-3)",
                    alignSelf: "flex-start", marginTop: 2,
                  }}>{r.priority}</span>
                </li>
              ))}
            </ul>
          </Collapsible>

          {/* Daily advice */}
          <Collapsible title="Daily Exposure Advice" icon={Clock}>
            <div className="grid-3" style={{ gap: 10, marginBottom: 14 }}>
              <div className="stat-tile">
                <div className="value">{result.daily_advice.safe_outdoor_hours}h</div>
                <div className="label">Safe Outdoor Duration</div>
              </div>
              <div className="stat-tile" style={{
                background: result.daily_advice.outdoor_exercise_safe ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)",
                borderColor: result.daily_advice.outdoor_exercise_safe ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)",
              }}>
                <div className="value" style={{
                  color: result.daily_advice.outdoor_exercise_safe ? "#059669" : "#dc2626",
                  fontSize: "1.1rem",
                }}>
                  {result.daily_advice.outdoor_exercise_safe ? "✅ Safe" : "❌ Unsafe"}
                </div>
                <div className="label">Outdoor Exercise</div>
              </div>
              <div className="stat-tile" style={{ background: "rgba(245,158,11,0.1)", borderColor: "rgba(245,158,11,0.3)" }}>
                <div className="value" style={{ color: "#d97706", fontSize: "0.9rem", fontFamily: "var(--font-sans)" }}>
                  {result.daily_advice.best_time}
                </div>
                <div className="label">Best Time Outside</div>
              </div>
            </div>
            {result.daily_advice.activities_to_avoid[0] !== "No specific restrictions today." && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.4px" }}>
                  Activities to Avoid
                </div>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {result.daily_advice.activities_to_avoid.map((a, i) => (
                    <li key={i} style={{ fontSize: 13, color: "var(--text)", marginBottom: 4, lineHeight: 1.5 }}>{a}</li>
                  ))}
                </ul>
              </div>
            )}
          </Collapsible>

          {/* 7-day outlook */}
          <Collapsible title="7-Day Health Outlook" icon={MapPin}>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th><th>AQI</th><th>Category</th><th>Risk</th><th>Tip</th>
                  </tr>
                </thead>
                <tbody>
                  {result.seven_day_outlook.map((d, i) => (
                    <tr key={i}>
                      <td style={{ whiteSpace: "nowrap" }}>
                        {d.date}
                        {i === 0 && (
                          <span style={{
                            marginLeft: 6, fontSize: 10,
                            background: "var(--accent-soft)", color: "var(--accent)",
                            padding: "1px 7px", borderRadius: 8,
                          }}>Today</span>
                        )}
                      </td>
                      <td><strong>{d.aqi}</strong></td>
                      <td>
                        <Badge label={d.aqi_bucket} pal={AQI_PALETTE[d.aqi_bucket]} />
                      </td>
                      <td>
                        <Badge label={d.risk_level} pal={RISK_PALETTE[d.risk_level]} />
                      </td>
                      <td className="tip-cell">{d.tip}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Collapsible>

          {/* Explainability */}
          <Collapsible title="Why did the AI reach this conclusion?" icon={Brain} defaultOpen={false}>
            <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none" }}>
              {result.explainability.map((reason, i) => (
                <li key={i} style={{
                  display: "flex", gap: 10, alignItems: "flex-start",
                  padding: "8px 0", borderBottom: "1px solid var(--border)",
                  fontSize: 13, color: "var(--text)", lineHeight: 1.5,
                }}>
                  <span style={{
                    width: 22, height: 22, borderRadius: "50%",
                    background: "var(--accent-soft)", color: "var(--accent)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 11, fontWeight: 700, flexShrink: 0,
                  }}>{i + 1}</span>
                  {reason}
                </li>
              ))}
            </ul>
          </Collapsible>
        </motion.div>
      )}
    </>
  );
}
