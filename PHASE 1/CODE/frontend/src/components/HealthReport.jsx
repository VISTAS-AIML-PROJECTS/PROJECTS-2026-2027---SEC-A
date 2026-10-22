import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import axios from "axios";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Area, AreaChart, CartesianGrid
} from "recharts";
import {
  FileText, Download, MapPin, Calendar, Wind as WindIcon, Thermometer, Droplets,
  HeartPulse, ShieldAlert, Sparkles, Cloud, CheckCircle2, AlertTriangle, Brain
} from "lucide-react";
import { useTheme } from "../theme";
import { useAqi } from "../aqiContext";
import { Card, CardHeader, Badge, Gauge, getColor, AQI_COLORS, RISK_COLORS, SectionTitle, SkeletonCard, InsightItem } from "./ui";

const API = "http://localhost:8000";
const CITIES = ["Delhi", "Mumbai", "Bangalore", "Kolkata", "Chennai"];

const OCCUPATIONS = [
  "Other", "Office Employee", "Student", "Traffic Police",
  "Construction Worker", "Factory Worker", "Delivery Executive",
  "Farmer", "Driver", "Shopkeeper",
];

function formatDate(iso) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

export default function HealthReport() {
  const { resolvedTheme } = useTheme();
  const { selectedCity, setSelectedCity, currentAqi, selectedData } = useAqi();
  const [form, setForm] = useState({ city: selectedCity, age: 35, gender: "Male", asthma: false, pregnancy: false, occupation: "Other", outdoor_hours: 3 });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [history, setHistory] = useState([]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const setBool = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value === "Yes" }));
  const setNum = (k) => (e) => setForm((f) => ({ ...f, [k]: +e.target.value }));

  useEffect(() => {
    setForm((f) => ({ ...f, city: selectedCity }));
    setResult(null);
  }, [selectedCity]);

  const submit = async () => {
    setLoading(true); setError("");
    try {
      const { data } = await axios.post(`${API}/health-report`, form);
      setResult({ ...data, aqi: currentAqi, aqi_bucket: selectedData.aqi_bucket });
      setHistory((h) => [{ ...form, aqi: currentAqi, health_score: data.health_score, risk_level: data.risk_level, generatedAt: new Date().toISOString() }, ...h].slice(0, 5));
    } catch (e) {
      setError(e.response?.data?.detail || "API error. Is the backend running?");
    } finally {
      setLoading(false);
    }
  };

  const forecastData = result?.seven_day_outlook?.map((d) => ({
    date: formatDate(d.date),
    aqi: d.aqi,
    risk: d.risk_score,
  })) || [];

  const aqiColor = getColor(AQI_COLORS, result?.aqi_bucket);
  const riskColor = getColor(RISK_COLORS, result?.risk_level);

  return (
    <div className="report-page">
      {/* ── Generator panel ── */}
      <Card className="report-generator">
        <CardHeader
          icon="FileText"
          title="Generate Health Report"
          subtitle="Get a comprehensive, AI-personalized health report"
        />
        <div className="form-grid">
          <div className="form-group">
            <label>City</label>
            <select value={form.city} onChange={(e) => setSelectedCity(e.target.value)}>
              {CITIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Age</label>
            <input type="number" value={form.age} onChange={setNum("age")} min={1} max={120} />
          </div>
          <div className="form-group">
            <label>Gender</label>
            <select value={form.gender} onChange={set("gender")}>
              {["Male", "Female", "Other"].map((g) => <option key={g}>{g}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Occupation</label>
            <select value={form.occupation} onChange={set("occupation")}>
              {OCCUPATIONS.map((o) => <option key={o}>{o}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Outdoor Hours / Day</label>
            <input type="number" value={form.outdoor_hours} onChange={setNum("outdoor_hours")} min={0} max={24} step={0.5} />
          </div>
          <div className="form-group">
            <label>Asthma</label>
            <select value={form.asthma ? "Yes" : "No"} onChange={setBool("asthma")}>
              <option>No</option><option>Yes</option>
            </select>
          </div>
          <div className="form-group">
            <label>Pregnancy</label>
            <select value={form.pregnancy ? "Yes" : "No"} onChange={setBool("pregnancy")}>
              <option>No</option><option>Yes</option>
            </select>
          </div>
        </div>
        <div className="report-actions">
          <button className="btn-primary" onClick={submit} disabled={loading}>
            {loading ? "Generating…" : "Generate Report"}
          </button>
          {result && (
            <button className="btn-secondary" onClick={() => window.print()}>
              <Download size={16} /> Download Report
            </button>
          )}
        </div>
        {error && <p className="error">{error}</p>}
      </Card>

      {loading && (
        <div className="skeleton-grid">
          <SkeletonCard /><SkeletonCard /><SkeletonCard />
        </div>
      )}

      {result && (
        <motion.div
          className="report-document"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* ── Report header ── */}
          <div className="report-header">
            <div className="report-header-brand">
              <span className="report-logo"><FileText size={22} /></span>
              <div>
                <h2>Personal Health Report</h2>
                <p>Generated by PureBreath-AI · Explainable Intelligence</p>
              </div>
            </div>
            <div className="report-header-meta">
              <span><MapPin size={14} /> {result.city}</span>
              <span><Calendar size={14} /> {new Date().toLocaleDateString()}</span>
            </div>
          </div>

          {/* ── Emergency banner ── */}
          {result.is_emergency && (
            <motion.div
              className="emergency-banner"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <AlertTriangle size={22} />
              <div>
                <strong>Emergency Health Warning</strong>
                <p>Stay indoors, avoid all outdoor activity, and seek medical advice immediately.</p>
              </div>
            </motion.div>
          )}

          {/* ── Summary hero ── */}
          <div className="report-summary">
            <Card className="report-hero">
              <div className="report-hero-gauges">
                <Gauge value={result.health_score} label="Health Score" color={{ main: result.health_score >= 60 ? "#10b981" : result.health_score >= 40 ? "#f59e0b" : "#ef4444", text: getColor(RISK_COLORS, result.risk_level).text }} />
                <Gauge value={result.risk_score} label="Risk Score" color={{ main: riskColor.main, text: riskColor.text }} />
              </div>
              <div className="report-hero-info">
                <div className="report-aqi">
                  <span className="report-aqi-value" style={{ color: aqiColor.text }}>{result.aqi}</span>
                  <Badge label={result.aqi_bucket} color={aqiColor} />
                </div>
                <div className="report-hero-row">
                  <span>Overall Risk</span>
                  <Badge label={result.risk_level} color={riskColor} />
                </div>
                <div className="report-hero-row">
                  <span>Air Quality</span>
                  <span className="hero-value">{result.aqi_bucket}</span>
                </div>
              </div>
            </Card>

            {/* AI summary */}
            <Card className="report-ai-summary">
              <CardHeader icon="Brain" title="AI Health Summary" subtitle="Natural language risk assessment" />
              <p className="ai-summary-text">{result.ai_summary}</p>
            </Card>
          </div>

          {/* ── Charts row ── */}
          <div className="report-grid-2">
            <Card>
              <CardHeader icon="Activity" title="7-Day AQI Forecast" />
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={forecastData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="aqiGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
                  <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
                  <Tooltip contentStyle={{ background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: 12, color: "var(--text)" }} />
                  <Area type="monotone" dataKey="aqi" stroke="#3b82f6" strokeWidth={2.5} fill="url(#aqiGrad)" name="AQI" />
                </AreaChart>
              </ResponsiveContainer>
            </Card>

            <Card>
              <CardHeader icon="HeartPulse" title="Risk Trend" subtitle="Daily risk score" />
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={forecastData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
                  <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)" }} domain={[0, 100]} />
                  <Tooltip contentStyle={{ background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: 12, color: "var(--text)" }} />
                  <Line type="monotone" dataKey="risk" stroke="#10b981" strokeWidth={2.5} dot={{ r: 4 }} name="Risk" />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          </div>

          {/* ── Conditions + Contributors ── */}
          <div className="report-grid-2">
            <Card>
              <CardHeader icon="Cloud" title="Current Weather" />
              <div className="weather-grid">
                {result.conditions && Object.entries(result.conditions).map(([k, v]) => (
                  <div className="weather-item" key={k}>
                    <span className="weather-value">{typeof v === "number" ? v.toFixed(1) : v}</span>
                    <span className="weather-label">{k.replace(/_/g, " ")}</span>
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <CardHeader icon="Sparkles" title="Top Contributors" subtitle="Why the AI reached this conclusion" />
              <ul className="contributor-list">
                {result.explainability?.map((r, i) => (
                  <li key={i}>
                    <span className="contributor-num">{i + 1}</span>
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          {/* ── Recommendations ── */}
          <Card>
            <CardHeader icon="CheckCircle2" title="Personalized Recommendations" />
            <div className="recommendation-list">
              {result.recommendations?.map((r, i) => {
                const colors = { High: "#ef4444", Medium: "#f59e0b", Low: "#10b981" };
                const color = { main: colors[r.priority] || "#3b82f6", soft: `${colors[r.priority] || "#3b82f6"}22`, text: colors[r.priority] || "#1d4ed8" };
                return <InsightItem key={i} text={r.text} priority={r.priority} color={color} />;
              })}
            </div>
          </Card>

          {/* ── 7-day outlook table ── */}
          <Card>
            <CardHeader icon="Calendar" title="7-Day Health Outlook" />
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th><th>AQI</th><th>Air Quality</th><th>Risk</th><th>Tip</th>
                  </tr>
                </thead>
                <tbody>
                  {result.seven_day_outlook?.map((d, i) => (
                    <tr key={i}>
                      <td>{formatDate(d.date)}</td>
                      <td><strong>{d.aqi}</strong></td>
                      <td><Badge label={d.aqi_bucket} color={getColor(AQI_COLORS, d.aqi_bucket)} size="sm" /></td>
                      <td><Badge label={d.risk_level} color={getColor(RISK_COLORS, d.risk_level)} size="sm" /></td>
                      <td className="tip-cell">{d.tip}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
