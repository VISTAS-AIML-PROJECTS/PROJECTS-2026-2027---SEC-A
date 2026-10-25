/**
 * SepsisGuard IoT Patient Early Warning Monitoring System
 * Main Frontend Application Controller
 * Styled & Structured for Clinical Sanctuary Design System
 */

import {
  state,
  initStore,
  subscribe,
  recordReading,
  acknowledgeAlert,
  getFilteredHistory,
  calculateStats,
  clearHistory,
} from './state.js';
import { ESP32Parser } from './parser.js';
import { SerialManager } from './serial.js';
import { TelemetryCharts } from './charts.js';
import { ReportsEngine } from './reports.js';

// --------------------------------------------------------------------------
// Application Initialization
// --------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  initStore();

  // Serial Parser Setup
  const parser = new ESP32Parser(
    (reading) => {
      recordReading(reading);
    },
    (rawLine) => {
      appendTerminalLine(rawLine);
    }
  );

  // Serial Manager Setup
  const serialManager = new SerialManager(parser, {
    onConnect: (info) => {
      state.connection.status = 'connected';
      updateConnectionUI(true, info);
      updateStatusBadge('connected');
    },
    onDisconnect: () => {
      state.connection.status = 'disconnected';
      updateConnectionUI(false);
    },
    onError: (err) => {
      console.error('Serial Error:', err);
      appendTerminalLine(`[ERROR: ${err.message || err}]`, true);
    },
    onStatusChange: (status) => {
      updateStatusBadge(status);
    },
  });

  // State Change Listener
  subscribe((event, payload, currentState) => {
    handleStateUpdate(event, payload, currentState);
  });

  // UI Setup
  initNavigation();
  initDashboardActions(serialManager);
  updateConnectionUI(false);
  updateStatusBadge('disconnected');
  initHistoryView();
  initReportsView();
  initAlertsView();
  initSettingsView(serialManager);
  initModals();

  // Initial UI Render
  renderDashboard(state);
  renderSparklines();
  renderTimeline(state.alertsHistory);

  // Live Clock
  setInterval(() => { updateLiveClock(); renderDashboard(state); }, 1000);
  updateLiveClock();
});

// --------------------------------------------------------------------------
// Navigation & Tab Switching
// --------------------------------------------------------------------------
function initNavigation() {
  const navLinks = document.querySelectorAll('.nav-link');
  const views = document.querySelectorAll('.tab-view');

  function switchTab(targetTab) {
    const tabName = targetTab.replace('#', '') || 'dashboard';

    views.forEach(v => {
      if (v.id === `tab-${tabName}`) {
        v.classList.remove('hidden');
      } else {
        v.classList.add('hidden');
      }
    });

    navLinks.forEach(link => {
      const isCurrent = link.dataset.tab === tabName;
      if (isCurrent) {
        link.className = 'nav-link flex items-center justify-between px-3 lg:px-4 py-3 rounded-2xl transition-all duration-150 bg-[#344b3a] text-white shadow-[0_4px_16px_rgba(0,0,0,0.3)] border border-[#486650]/60 font-semibold';
        // highlight icon
        const iconWrap = link.querySelector('.nav-icon-wrap');
        if (iconWrap) {
          iconWrap.className = 'nav-icon-wrap w-8 h-8 rounded-xl bg-[#e56b43] text-white flex items-center justify-center shrink-0 shadow-sm';
        }
      } else {
        link.className = 'nav-link flex items-center justify-between px-3 lg:px-4 py-3 rounded-2xl text-[#9cb1a2] hover:bg-[#253729] hover:text-white transition-colors duration-150 font-normal';
        const iconWrap = link.querySelector('.nav-icon-wrap');
        if (iconWrap) {
          iconWrap.className = 'nav-icon-wrap w-8 h-8 rounded-xl bg-transparent text-[#9cb1a2] flex items-center justify-center shrink-0';
        }
      }
    });

    const subhead = document.getElementById('top-subhead');
    if (subhead) {
      const titles = {
        dashboard: 'Continuous Biosensor Telemetry',
        history: 'Patient Telemetry Log & Charts',
        reports: 'Clinical Diagnostics & CSV Export',
        sensors: 'Transducer Specs & Device Health',
        alerts: 'Hardware Buzzer & Early Warning Audit',
        settings: 'UART, Gateway & Diagnostics',
      };
      subhead.textContent = titles[tabName] || 'Continuous Biosensor Telemetry';
    }

    if (tabName === 'history') {
      renderHistoryView();
    } else if (tabName === 'reports') {
      renderReportsView();
    } else if (tabName === 'alerts') {
      renderAlertsTable();
    }
  }

  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const target = link.getAttribute('href');
      history.pushState(null, '', target);
      switchTab(target);
    });
  });

  window.addEventListener('popstate', () => {
    switchTab(window.location.hash || '#dashboard');
  });

  // Initial route
  switchTab(window.location.hash || '#dashboard');
}

// --------------------------------------------------------------------------
// Dashboard & Telemetry Rendering
// --------------------------------------------------------------------------
function renderDashboard(currentState) {
  const c = currentState.current;
  const show = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };
  show('metric-temp', Number.isFinite(c.temperature) ? c.temperature.toFixed(2) : '--');
  show('badge-temp-status', Number.isFinite(c.temperature) ? 'Received from ESP32' : 'No data');
  show('metric-hr', Number.isFinite(c.heartRate) ? c.heartRate : '--');
  show('badge-hr-status', c.sensors.max30102 === 'ERROR' ? 'Sensor error' : c.sensors.max30102 === 'NO FINGER' ? 'No heartbeat' : Number.isFinite(c.heartRate) ? 'Firmware reported BPM' : 'No data');
  show('badge-hr-sub', 'Actual firmware value only');
  show('metric-angle', Number.isFinite(c.angle) ? c.angle.toFixed(1) : '--');
  show('badge-orient-status', Number.isFinite(c.angle) ? 'Received from ESP32' : 'No data');
  show('metric-motion-state', c.sensors.mpu6050);
  show('metric-ir', Number.isFinite(c.irValue) ? c.irValue : '--');
  show('metric-red', Number.isFinite(c.redValue) ? c.redValue : '--');
  show('metric-gyro', [c.gyroX, c.gyroY, c.gyroZ].every(Number.isFinite) ? `${c.gyroX}, ${c.gyroY}, ${c.gyroZ} rad/s` : 'Unavailable');
  show('metric-battery', Number.isFinite(c.batteryVoltage) ? `${c.batteryVoltage} V${Number.isFinite(c.batteryPercent) ? ` • ${c.batteryPercent}% estimated` : ''}` : 'Battery data unavailable');
  show('metric-alert', c.alert);
  show('metric-accel-text', [c.accelX,c.accelY,c.accelZ].every(Number.isFinite) ? `AX ${c.accelX} m/s² • AY ${c.accelY} m/s² • AZ ${c.accelZ} m/s²` : 'Unavailable');
  show('sidebar-buzzer-pill', c.buzzer === 'unknown' ? 'Buzzer unknown' : `Buzzer ${c.buzzer}`);
  show('buzzer-armed-badge', `Firmware buzzer: ${c.buzzer}`);
  const age = currentState.connection.lastUpdate ? Math.floor((Date.now() - Date.parse(currentState.connection.lastUpdate))/1000) : null;
  show('last-sync-time', age === null ? 'No data' : age > 10 ? `Stale • ${age}s ago` : `${age}s ago`);
  if (age > 10) {
    for (const id of ['badge-temp-status', 'badge-hr-status', 'badge-orient-status']) {
      const el = document.getElementById(id);
      if (el && el.textContent !== 'No data') el.textContent = 'Stale • last known';
    }
  }
  updateHeroStatusCard(currentState);
  updateSensorHealthPills(c);
  if (age > 10) for (const id of ['sensor-pill-tmp117','sensor-pill-max30102','sensor-pill-mpu6050']) {
    const el = document.getElementById(id);
    if (el && el.textContent === 'OK') el.textContent = 'STALE • last OK';
  }
}
function updateHeroStatusCard(s) {
  const danger = s.current.alert === 'DANGER';
  const status = document.getElementById('patient-status-text');
  const desc = document.getElementById('patient-status-desc');
  const banner = document.getElementById('alert-banner');
  // shortcut: assumes a telemetry block arrives within 10 seconds; tune after measuring the firmware cadence.
  const stale = s.connection.lastUpdate && Date.now() - Date.parse(s.connection.lastUpdate) > 10000;
  if (status) status.textContent = danger ? (stale || s.connection.status !== 'connected' ? 'STALE FIRMWARE ALERT' : 'FIRMWARE ALERT') : s.connection.status !== 'connected' ? 'MONITORING UNAVAILABLE' : !s.connection.lastUpdate ? 'NO TELEMETRY' : stale ? 'STALE TELEMETRY' : s.current.alert === 'NORMAL' ? 'FIRMWARE REPORTS NORMAL' : 'INSUFFICIENT DATA';
  if (desc) desc.textContent = danger ? `ESP32 last reported ALERT: DANGER${stale || s.connection.status !== 'connected' ? '; this report is stale.' : '.'} Research prototype; not a diagnosis.` : 'Status reflects serial data reported by the ESP32. No clinical diagnosis is made.';
  const dot = document.getElementById('status-indicator-dot');
  if (dot) dot.innerHTML = `<span class="relative inline-flex rounded-full h-5 w-5 ${danger ? 'bg-[#b5261d]' : stale || s.connection.status !== 'connected' ? 'bg-[#7e9282]' : 'bg-[#e5a643]'}"></span>`;
  if (banner) banner.classList.toggle('hidden', !danger);
  if (danger) {
    const set = (id, value) => { const el=document.getElementById(id); if(el) el.textContent=value; };
    set('alert-banner-reason','ESP32 reported ALERT: DANGER');
    set('alert-capsule-temp', Number.isFinite(s.current.temperature) ? `${s.current.temperature} °C` : '-- °C');
    set('alert-capsule-orient', Number.isFinite(s.current.angle) ? `${s.current.angle}°` : '--°');
  }
}
function updateSensorHealthPills(c) {
  for (const [id, value] of [['sensor-pill-tmp117',c.sensors.tmp117],['sensor-pill-max30102',c.sensors.max30102],['sensor-pill-mpu6050',c.sensors.mpu6050],['sensor-pill-ssd1306','Unreported'],['sensor-pill-buzzer',c.buzzer]]) { const el=document.getElementById(id); if(el) { el.textContent=value; el.className = value === 'OK' || value === 'ON' ? 'px-2.5 py-0.5 rounded-full bg-[#273d2d] text-[#86e2b4] text-[11px] font-semibold' : 'px-2.5 py-0.5 rounded-full bg-[#243529] text-[#9eb6a3] text-[11px] font-semibold'; } }
}
function renderSparklines() {
  const history = state.history;

  const tempVals = history.map(h => h.temperature);
  const hrVals = history.map(h => h.heartRate);
  const orientVals = history.map(h => h.angle);

  TelemetryCharts.renderSparkline(document.getElementById('sparkline-temp'), tempVals, {
    color: '#2d583b',
  });

  TelemetryCharts.renderSparkline(document.getElementById('sparkline-hr'), hrVals, {
    color: '#2d583b',
  });

  TelemetryCharts.renderSparkline(document.getElementById('sparkline-orient'), orientVals, {
    color: '#2d583b',
  });
}

function renderTimeline(alerts) {
  const container = document.getElementById('recent-activity-list');
  if (!container) return;

  if (!alerts || alerts.length === 0) {
    container.innerHTML = `
      <div class="p-4 rounded-2xl bg-[#435c4b]/30 text-center text-xs text-[#a7c0ad]">
        No firmware alerts recorded.
      </div>
    `;
    return;
  }

  container.innerHTML = alerts.slice(0, 5).map(a => {
    const isAck = a.acknowledged;
    const isBuzzerActive = a.hardwareBuzzer === 'ACTIVE';

    let icon = 'device_thermostat';
    if (a.event.includes('Orientation') || a.event.includes('Posture')) {
      icon = 'airline_seat_recline_extra';
    } else if (a.event.includes('Heart') || a.event.includes('Pulse')) {
      icon = 'favorite';
    } else if (a.event.includes('Node') || a.event.includes('Boot')) {
      icon = 'hub';
    }

    return `
      <div class="flex items-center justify-between p-3 rounded-2xl bg-[#435c4b]/50 hover:bg-[#435c4b] transition-colors border border-[#4f6c56]/40">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-xl bg-[#283b2e] flex items-center justify-center shrink-0 ${isBuzzerActive ? 'text-[#fca582]' : 'text-[#86e2b4]'}">
            <span class="material-symbols-outlined text-[18px]">${icon}</span>
          </div>
          <div class="flex flex-col">
            <span class="text-sm text-white font-semibold">${a.event}</span>
            <span class="text-xs text-[#b3ccb8]">Buzzer: ${a.hardwareBuzzer}  ${isAck ? 'Acknowledged (' + (a.audit || 'Staff') + ')' : 'Pending Review'}</span>
          </div>
        </div>
        <div class="flex flex-col items-end shrink-0">
          <span class="text-xs text-white font-medium">${a.displayTime}</span>
          ${!isAck ? `
            <button class="btn-activity-ack text-[11px] text-[#fca582] font-bold hover:underline" data-id="${a.id}">
              Acknowledge
            </button>
          ` : `
            <span class="text-[11px] text-[#86e2b4] font-semibold">Verified</span>
          `}
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.btn-activity-ack').forEach(btn => {
    btn.addEventListener('click', () => {
      acknowledgeAlert(btn.dataset.id, 'Clinical Staff 01');
      renderTimeline(state.alertsHistory);
      renderAlertsTable();
      renderDashboard(state);
    });
  });
}

// --------------------------------------------------------------------------
// Actions & Handlers
// --------------------------------------------------------------------------
function initDashboardActions(serialManager) {
  const connect = async () => {
    if (serialManager.isConnected) return serialManager.disconnect();
    try { await serialManager.connect(); } catch (err) { if (err.name !== 'NotFoundError') alert(`Serial connection: ${err.message}`); }
  };
  document.getElementById('btn-header-serial')?.addEventListener('click', connect);
  document.getElementById('btn-settings-connect')?.addEventListener('click', connect);
  document.getElementById('btn-settings-disconnect')?.addEventListener('click', () => serialManager.disconnect());
  document.getElementById('mute-buzzer-btn')?.remove();
  document.getElementById('btn-header-mute')?.remove();
  document.getElementById('btn-page-doctor')?.remove();
}
let currentHistoryMetric = 'temperature';
let currentHistoryWindow = 'all';

function initHistoryView() {
  document.querySelectorAll('.hist-metric-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.hist-metric-btn').forEach(b => {
        b.className = 'hist-metric-btn px-4 py-1.5 rounded-full text-xs font-semibold border border-[#486650]/60 text-[#b2ceba] hover:bg-[#2e4533] transition-colors';
      });
      btn.className = 'hist-metric-btn px-4 py-1.5 rounded-full text-xs font-semibold bg-[#e56b43] text-white shadow-sm';
      currentHistoryMetric = btn.dataset.metric;
      renderHistoryView();
    });
  });

  document.querySelectorAll('.hist-time-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.hist-time-btn').forEach(b => {
        b.className = 'hist-time-btn px-3 py-1.5 rounded-full text-xs font-semibold border border-[#486650]/60 text-[#b2ceba] hover:bg-[#2e4533] transition-colors';
      });
      btn.className = 'hist-time-btn px-3 py-1.5 rounded-full text-xs font-semibold bg-[#344b3a] text-white shadow-sm border border-[#52775b]';
      currentHistoryWindow = btn.dataset.window;
      renderHistoryView();
    });
  });
}

function renderHistoryView() {
  const filtered = getFilteredHistory(currentHistoryWindow);
  const container = document.getElementById('history-chart-container');
  const countEl = document.getElementById('hist-total-count');
  if (countEl) countEl.textContent = `${filtered.length} Stored Records`;

  const meta = {
    temperature: { label: 'TMP117 Temperature', unit: 'Â°C', setpoint: null },
    heartRate: { label: 'MAX30102 Heart Rate', unit: 'BPM', setpoint: null },
    orientation: { label: 'MPU6050 Orientation Angle', unit: 'Â°', setpoint: null },
    irValue: { label: 'MAX30102 IR sample', unit: 'counts', setpoint: null },
    redValue: { label: 'MAX30102 RED sample', unit: 'counts', setpoint: null },
  };

  const currentMeta = meta[currentHistoryMetric] || meta.temperature;
  TelemetryCharts.renderExpandedChart(
    container,
    filtered,
    currentHistoryMetric,
    currentMeta.label,
    currentMeta.unit,
    currentMeta.setpoint
  );

  // Render Table
  const tbody = document.getElementById('history-table-body');
  if (!tbody) return;

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-[#7e9584]">No records found for selected window.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.slice().reverse().slice(0, 50).map(r => `
    <tr class="hover:bg-[#435c4b]/30 transition-colors border-b border-[#3b5240]/40 text-sm">
      <td class="py-2.5 px-3 font-mono text-white">${r.displayTime}</td>
      <td class="py-2.5 px-3 font-semibold text-white">${r.temperature !== null ? r.temperature.toFixed(2) + ' Â°C' : '--'}</td>
      <td class="py-2.5 px-3 text-[#b9cebe]">${Number.isFinite(r.heartRate) ? r.heartRate + ' BPM' : '--'}</td>
      <td class="py-2.5 px-3 font-mono text-white">${r.orientation !== null ? r.orientation.toFixed(1) + ' Â°' : '--'}</td>
      <td class="py-2.5 px-3 text-[#86e2b4]">${r.sensors?.mpu6050 || 'unknown'}</td>
      <td class="py-2.5 px-3">
        <span class="px-2 py-0.5 rounded-full text-xs font-semibold ${r.buzzerState === 'ACTIVE' ? 'bg-[#e56b43]/30 text-[#fca582] border border-[#e56b43]/50' : 'bg-[#24382a] text-[#cfe9d6] border border-[#3b5440]'}">
          ${r.buzzerState || 'OFF'}
        </span>
      </td>
    </tr>
  `).join('');
}

// --------------------------------------------------------------------------
// Reports View
// --------------------------------------------------------------------------
function initReportsView() {
  const btnExport = document.getElementById('btn-report-export-csv');
  if (btnExport) {
    btnExport.addEventListener('click', () => {
      const type = document.getElementById('report-select-type')?.value || 'complete';
      const windowType = document.getElementById('report-select-window')?.value || 'all';
      const records = getFilteredHistory(windowType);
      ReportsEngine.exportToCSV(records, type);
    });
  }

  const btnPrint = document.getElementById('btn-report-print');
  if (btnPrint) {
    btnPrint.addEventListener('click', () => {
      window.print();
    });
  }

  document.getElementById('report-select-type')?.addEventListener('change', renderReportsView);
  document.getElementById('report-select-window')?.addEventListener('change', renderReportsView);
}

function renderReportsView() {
  const windowType = document.getElementById('report-select-window')?.value || 'all';
  const records = getFilteredHistory(windowType);
  const summary = ReportsEngine.generateSummary(records, state.alertsHistory);

  const elReadings = document.getElementById('rep-stat-readings');
  const elTempRange = document.getElementById('rep-stat-temp-range');
  const elTempAvg = document.getElementById('rep-stat-temp-avg');
  const elHrAvg = document.getElementById('rep-stat-hr-avg');
  const elOrientRange = document.getElementById('rep-stat-orient-range');
  const elAlerts = document.getElementById('rep-stat-alerts');

  if (elReadings) elReadings.textContent = summary.readingCount;
  if (elTempRange) elTempRange.textContent = summary.temp.count ? `${summary.temp.min.toFixed(2)} / ${summary.temp.max.toFixed(2)} °C` : 'No data';
  if (elTempAvg) elTempAvg.textContent = summary.temp.avg === null ? 'No data' : `${summary.temp.avg.toFixed(2)} °C`;
  if (elHrAvg) elHrAvg.textContent = summary.hr.avg === null ? 'No data' : `${summary.hr.avg.toFixed(1)} BPM`;
  if (elOrientRange) elOrientRange.textContent = summary.orient.count ? `${summary.orient.min.toFixed(1)}° / ${summary.orient.max.toFixed(1)}°` : 'No data';
  if (elAlerts) elAlerts.textContent = summary.buzzerActiveCount;

  // Preview table
  const tbody = document.getElementById('report-table-body');
  if (!tbody) return;

  tbody.innerHTML = records.length ? records.slice(-40).reverse().map(r => `
    <tr class="hover:bg-[#435c4b]/30 transition-colors border-b border-[#3b5240]/40 text-sm">
      <td class="py-2.5 px-3 font-mono text-white">${r.displayTime}</td>
      <td class="py-2.5 px-3 font-semibold text-white">${r.temperature !== null ? r.temperature.toFixed(2) + ' Â°C' : '--'}</td>
      <td class="py-2.5 px-3 text-[#b9cebe]">${Number.isFinite(r.heartRate) ? r.heartRate + ' BPM' : '--'}</td>
      <td class="py-2.5 px-3 font-mono text-white">${r.orientation !== null ? r.orientation.toFixed(1) + ' Â°' : '--'}</td>
      <td class="py-2.5 px-3 text-[#86e2b4]">${r.sensors?.mpu6050 || 'unknown'}</td>
      <td class="py-2.5 px-3 font-semibold ${r.buzzerState === 'ACTIVE' ? 'text-[#fca582]' : 'text-[#86e2b4]'}">
        ${r.buzzerState || 'OFF'}
      </td>
    </tr>
  `).join('') : '<tr><td colspan="6" class="p-6 text-center text-[#7e9584]">No telemetry in this period.</td></tr>';
}

// --------------------------------------------------------------------------
// Alerts View
// --------------------------------------------------------------------------
let currentAlertFilter = 'all';

function initAlertsView() {
  document.querySelectorAll('.alert-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.alert-filter-btn').forEach(b => {
        b.className = 'alert-filter-btn px-4 py-1.5 rounded-full text-xs font-semibold border border-[#486650]/60 text-[#b2ceba] hover:bg-[#2e4533] transition-colors';
      });
      btn.className = 'alert-filter-btn px-4 py-1.5 rounded-full text-xs font-semibold bg-[#e56b43] text-white shadow-sm';
      currentAlertFilter = btn.dataset.filter;
      renderAlertsTable();
    });
  });
}

function renderAlertsTable() {
  const tbody = document.getElementById('alerts-page-table-body');
  if (!tbody) return;

  let alerts = state.alertsHistory;
  if (currentAlertFilter === 'unacknowledged') {
    alerts = alerts.filter(a => !a.acknowledged);
  } else if (currentAlertFilter === 'acknowledged') {
    alerts = alerts.filter(a => a.acknowledged);
  }

  if (alerts.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-[#7e9584]">No early warning alerts matching filter.</td></tr>`;
    return;
  }

  tbody.innerHTML = alerts.map(a => `
    <tr class="hover:bg-[#435c4b]/30 transition-colors border-b border-[#3b5240]/40 text-sm">
      <td class="py-3 px-3 font-mono font-semibold text-white">${a.displayTime}</td>
      <td class="py-3 px-3 font-medium text-white">${a.event}</td>
      <td class="py-3 px-3">
        <span class="px-2.5 py-0.5 rounded-full text-xs uppercase font-semibold ${a.hardwareBuzzer === 'ACTIVE' ? 'bg-[#e56b43]/30 text-[#fca582] border border-[#e56b43]/60' : 'bg-[#24382a] text-[#cfe9d6] border border-[#3b5440]'}">
          ${a.hardwareBuzzer}
        </span>
      </td>
      <td class="py-3 px-3 font-mono text-white">${Number.isFinite(a.temperature) ? a.temperature.toFixed(2) + ' °C' : '--'}</td>
      <td class="py-3 px-3">
        <span class="text-xs font-semibold ${a.acknowledged ? 'text-[#86e2b4]' : 'text-[#fca582]'}">
          ${a.acknowledged ? 'Acknowledged (' + (a.audit || 'Staff') + ')' : 'Pending Review'}
        </span>
      </td>
      <td class="py-3 px-3 text-right">
        ${!a.acknowledged ? `
          <button class="btn-page-ack px-3.5 py-1.5 rounded-full bg-[#e56b43] hover:bg-[#d45d37] text-white text-xs font-semibold shadow-sm transition-all" data-id="${a.id}">
            Acknowledge
          </button>
        ` : `
          <span class="text-xs text-[#8da493]">Verified</span>
        `}
      </td>
    </tr>
  `).join('');

  tbody.querySelectorAll('.btn-page-ack').forEach(btn => {
    btn.addEventListener('click', () => {
      acknowledgeAlert(btn.dataset.id, 'Clinical Staff 01');
      renderAlertsTable();
      renderTimeline(state.alertsHistory);
      renderDashboard(state);
    });
  });
}

// --------------------------------------------------------------------------
// Settings View & Simulation
// --------------------------------------------------------------------------
function initSettingsView() {
  document.getElementById('btn-clear-history')?.addEventListener('click', () => {
    if (confirm('Clear stored telemetry history and firmware alerts?')) {
      clearHistory(); renderSparklines(); renderTimeline([]); renderHistoryView(); renderReportsView(); renderDashboard(state);
    }
  });
  document.getElementById('btn-clear-terminal')?.addEventListener('click', () => {
    const term = document.getElementById('raw-terminal');
    if (term) term.innerHTML = '<div class="text-[#8da493]">[Terminal buffer cleared.]</div>';
  });
}
function appendTerminalLine(line, isError = false) {
  const term = document.getElementById('raw-terminal');
  if (!term) return;

  const div = document.createElement('div');
  div.className = isError ? 'text-[#e56b43] font-bold' : 'text-[#c2e4ca]';
  div.textContent = line;
  term.appendChild(div);

  if (term.childNodes.length > 300) {
    term.removeChild(term.firstChild);
  }
  term.scrollTop = term.scrollHeight;
}

// --------------------------------------------------------------------------
// Sensor Details Modal
// --------------------------------------------------------------------------
function initModals() {
  const modal = document.getElementById('sensor-modal');
  const btnClose = document.getElementById('btn-close-modal');
  const btnDone = document.getElementById('btn-modal-done');

  function closeModal() {
    modal.classList.add('hidden');
  }

  if (btnClose) btnClose.addEventListener('click', closeModal);
  if (btnDone) btnDone.addEventListener('click', closeModal);
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
  }

  // Attach click listener to all sensor cards
  document.querySelectorAll('.sensor-card, .open-modal-btn').forEach(el => {
    el.addEventListener('click', () => {
      const sensorKey = el.dataset.sensor;
      openSensorModal(sensorKey);
    });
  });
}

function openSensorModal(sensorKey) {
  const modal = document.getElementById('sensor-modal');
  if (!modal) return;

  const titleEl = document.getElementById('modal-title');
  const valCurr = document.getElementById('modal-val-curr');
  const valAvg = document.getElementById('modal-val-avg');
  const valMin = document.getElementById('modal-val-min');
  const valMax = document.getElementById('modal-val-max');
  const specText = document.getElementById('modal-spec-text');
  const chartBox = document.getElementById('modal-chart-box');
  const tableBody = document.getElementById('modal-recent-table');

  const history = state.history;
  const current = state.current;

  let metricKey = 'temperature';
  let unit = 'Â°C';
  let setpoint = null;

  if (sensorKey === 'temperature') {
    if (titleEl) titleEl.textContent = 'TMP117 Clinical Temperature Diagnostics';
    const stats = calculateStats('temperature', history);
    if (valCurr) valCurr.textContent = current.temperature !== null ? `${current.temperature.toFixed(2)} Â°C` : '--';
    if (valAvg) valAvg.textContent = stats.avg === null ? 'No data' : `${stats.avg.toFixed(2)} °C`;
    if (valMin) valMin.textContent = stats.min === null ? 'No data' : `${stats.min.toFixed(2)} °C`;
    if (valMax) valMax.textContent = stats.max === null ? 'No data' : `${stats.max.toFixed(2)} °C`;
    metricKey = 'temperature';
    unit = 'Â°C';
    setpoint = null;
    if (specText) {
      specText.innerHTML = `
        <p><strong>Hardware Interface:</strong> I2C Bus (Address 0x48)  SDA GPIO6 (D4) / SCL GPIO7 (D5)</p>
        <p><strong>Clinical Precision:</strong> Â±0.1Â°C Accuracy (ASTM E1112 / ISO 80601)</p>
        <p>Firmware threshold: not verified.</p>
      `;
    }
  } else if (sensorKey === 'heartrate') {
    if (titleEl) titleEl.textContent = 'MAX30102 Photoplethysmography (PPG)';
    const stats = calculateStats('heartRate', history);
    if (valCurr) valCurr.textContent = Number.isFinite(current.heartRate) ? `${current.heartRate} BPM` : 'No data';
    if (valAvg) valAvg.textContent = stats.avg === null ? 'No data' : `${stats.avg} BPM`;
    if (valMin) valMin.textContent = stats.min === null ? 'No data' : `${stats.min} BPM`;
    if (valMax) valMax.textContent = stats.max === null ? 'No data' : `${stats.max} BPM`;
    metricKey = 'heartRate';
    unit = 'BPM';
    setpoint = null;
    if (specText) {
      specText.innerHTML = `
        <p><strong>Hardware Interface:</strong> I2C Bus (Address 0x57)  Optical Red/IR LED Transducer</p>
        <p><strong>Firmware status:</strong> ${current.sensors.max30102}</p>
        <p><strong>Clinical interpretation:</strong> Not provided</p>
      `;
    }
  } else if (sensorKey === 'orientation') {
    if (titleEl) titleEl.textContent = 'MPU6050 Patient Posture & Orientation';
    const stats = calculateStats('orientation', history);
    if (valCurr) valCurr.textContent = current.orientation !== null ? `${current.orientation.toFixed(1)} Â°` : '--';
    if (valAvg) valAvg.textContent = stats.avg === null ? 'No data' : `${stats.avg} °`;
    if (valMin) valMin.textContent = stats.min === null ? 'No data' : `${stats.min} °`;
    if (valMax) valMax.textContent = stats.max === null ? 'No data' : `${stats.max} °`;
    metricKey = 'orientation';
    unit = 'Â°';
    setpoint = null;
    if (specText) {
      specText.innerHTML = `
        <p><strong>Hardware Interface:</strong> I2C Bus (Address 0x68)  6-Axis Motion Transducer</p>
        <p><strong>Posture Angle:</strong> Range Â±180Â° Pitch / Roll Vector</p>
        <p>Angle value is displayed only when reported by firmware.</p>
      `;
    }
  } else if (sensorKey === 'motion') {
    if (titleEl) titleEl.textContent = 'MPU6050 6-Axis Inertial Measurement';
    if (valCurr) valCurr.textContent = current.accel.z !== null ? `${current.accel.z.toFixed(2)} g` : '--';
    if (valAvg) valAvg.textContent = 'Â±2g Scale';
    if (valMin) valMin.textContent = current.accel.x !== null ? `X: ${current.accel.x.toFixed(2)}` : '--';
    if (valMax) valMax.textContent = current.accel.y !== null ? `Y: ${current.accel.y.toFixed(2)}` : '--';
    metricKey = 'orientation';
    unit = 'Â°';
    setpoint = null;
    if (specText) {
      specText.innerHTML = `
        <p><strong>Accelerometer:</strong> 3-Axis Digital Accelerometer (Â±2g / Â±4g / Â±8g / Â±16g)</p>
        <p><strong>Gyroscope:</strong> 3-Axis Digital Gyroscope (Â±250 to Â±2000 Â°/sec)</p>
        <p><strong>Sampling Rate:</strong> 100Hz Internal DMP / 2000ms Serial Stream</p>
      `;
    }
  } else if (sensorKey === 'buzzer') {
    if (titleEl) titleEl.textContent = 'Hardware Buzzer & Early Warning Interlock';
    if (valCurr) valCurr.textContent = current.buzzerObject.state;
    if (valAvg) valAvg.textContent = 'Firmware reported state only';
    if (valMin) valMin.textContent = current.alert;
    if (valMax) valMax.textContent = state.activeAlert ? 'ACTIVE' : 'IDLE';
    metricKey = 'temperature';
    unit = 'Â°C';
    setpoint = null;
    if (specText) {
      specText.innerHTML = `
        <p>Hardware pin: not verified from firmware.</p>
        <p><strong>Firmware Logic:</strong> Alert state comes from firmware serial output.</p>
        <p><strong>Early Warning Support:</strong> Support tool only. Not a standalone medical diagnosis.</p>
      `;
    }
  }

  // Render chart inside modal
  TelemetryCharts.renderExpandedChart(chartBox, history.slice(-20), metricKey, titleEl.textContent, unit, setpoint);

  // Render recent 10 table
  if (tableBody) {
    tableBody.innerHTML = history.slice(-10).reverse().map(h => `
      <tr class="hover:bg-[#435c4b]/30">
        <td class="p-2 font-mono text-white">${h.displayTime}</td>
        <td class="p-2 font-semibold text-white">${h[metricKey] !== null && h[metricKey] !== undefined ? h[metricKey] + ' ' + unit : '--'}</td>
        <td class="p-2 text-[#cfe9d6]">${h.buzzerState}</td>
        <td class="p-2 font-semibold ${h.buzzerState === 'ACTIVE' ? 'text-[#fca582]' : 'text-[#86e2b4]'}">
          ${h.buzzerState === 'ACTIVE' ? 'FIRMWARE ALERT' : h.buzzerState === 'OFF' ? 'OFF' : 'UNKNOWN'}
        </td>
      </tr>
    `).join('');
  }

  modal.classList.remove('hidden');
}

// --------------------------------------------------------------------------
// UI State Updates
// --------------------------------------------------------------------------
function updateConnectionUI(isConnected, info = {}) {
  const btnHeader = document.getElementById('btn-header-serial');
  const btnHeaderText = document.getElementById('btn-header-serial-text');
  const dashConn = document.getElementById('dash-conn-status');
  const sideConn = document.getElementById('sidebar-conn-text');
  const sideMode = document.getElementById('sidebar-mode');
  const sidePing = document.getElementById('sidebar-ping');
  const sideDot = document.getElementById('sidebar-dot');

  if (isConnected) {
    if (btnHeader) {
      btnHeader.className = 'flex items-center gap-2 px-4 py-2 rounded-full bg-[#203124] text-[#7ad4a0] border border-[#374e3b] hover:bg-[#283e2d] transition-colors font-medium text-xs';
    }
    if (btnHeaderText) btnHeaderText.textContent = 'Disconnect';

    const desc = info.isSimulated ? 'ESP32: Simulated (115200 baud)' : 'ESP32: Connected (115200 baud)';
    if (dashConn) dashConn.textContent = desc;
    if (sideConn) sideConn.textContent = 'ESP32 • Connected';
    if (sideMode) sideMode.textContent = 'Physical serial';
    if (sidePing) sidePing.classList.remove('hidden');
    if (sideDot) sideDot.className = 'relative inline-flex rounded-full h-2 w-2 bg-[#4edea3]';
  } else {
    if (btnHeader) {
      btnHeader.className = 'flex items-center gap-2 px-4 py-2 rounded-full bg-[#243729] hover:bg-[#2e4433] text-[#d6e4d8] border border-[#374e3b] transition-colors font-medium text-xs';
    }
    if (btnHeaderText) btnHeaderText.textContent = 'Connect ESP32';

    if (dashConn) dashConn.textContent = 'ESP32: Disconnected (115200 baud)';
    if (sideConn) sideConn.textContent = 'ESP32 • Disconnected';
    if (sideMode) sideMode.textContent = 'Standby';
    if (sidePing) sidePing.classList.add('hidden');
    if (sideDot) sideDot.className = 'relative inline-flex rounded-full h-2 w-2 bg-[#718b77]';
  }
  renderDashboard(state);
}

function updateStatusBadge(status) {
  const badge = document.getElementById('header-status-text');
  if (!badge) return;
  if (status === 'connecting') {
    badge.textContent = 'Connecting...';
  } else if (status === 'connected') {
    badge.textContent = 'Serial connected • waiting for data';
  } else {
    badge.textContent = 'No serial device';
  }
}

function updateLiveClock() {
  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const headerClock = document.getElementById('header-clock');
  if (headerClock) headerClock.textContent = `${timeStr} - Local clock`;
}

function handleStateUpdate(event, payload, currentState) {
  renderDashboard(currentState);

  if (event === 'reading_recorded') {
    renderSparklines();
  } else if (event === 'alert_triggered' || event === 'alert_acknowledged' || event === 'alert_cleared') {
    renderTimeline(currentState.alertsHistory);
  }
}






