// lossPrevention.js - CCTV Loss Prevention & Anti-Theft Anomaly Surveillance Engine
// Detects retail shrinkage threats: unscanned concealment, planogram breaches, and loitering.
// Features active threat alerts, simulated security siren, and guard dispatch integration.

import { soundEffects } from '../utils/soundEffects.js';

export class LossPreventionModule {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    this.onTelemetryEvent = options.onTelemetryEvent || null;

    this.incidents = [
      {
        id: 'INC-2026-091',
        time: '19:42:15',
        camId: 'cam-perfume',
        camName: 'CAM 02 · Aisle 3 (Luxury Fragrance)',
        type: 'Unscanned Item Concealment',
        severity: 'CRITICAL',
        item: 'Luxury Cologne Spray ($165.00)',
        sku: 'SKU-PRF-402',
        confidence: 0.97,
        status: 'Active Alert',
        guardDispatched: false,
        details: 'Shopper #101 concealed item in personal backpack without POS scan.'
      },
      {
        id: 'INC-2026-088',
        time: '18:15:40',
        camId: 'cam-dairy',
        camName: 'CAM 04 · Aisle 4 (Beverages)',
        type: 'Planogram Shelf Misplacement',
        severity: 'WARNING',
        item: 'Pickle Glass Jar on Beverage Shelf',
        sku: 'SKU-PCK-301',
        confidence: 0.94,
        status: 'Resolved',
        guardDispatched: true,
        details: 'Glass pickle container placed in soda can bay tier 2. Restocked.'
      },
      {
        id: 'INC-2026-084',
        time: '16:04:22',
        camId: 'cam-traffic',
        camName: 'CAM 14 · Overhead Shopper Trajectory',
        type: 'Suspicious High-Dwell Loitering',
        severity: 'HIGH',
        item: 'Customer #104 (Dwell 4m 50s)',
        sku: 'PERSON-604',
        confidence: 0.96,
        status: 'Resolved',
        guardDispatched: true,
        details: 'Shopper remained stationary in blind spot for >4.5 minutes. Staff intervened.'
      }
    ];

    this.init();
  }

  init() {
    this.render();
  }

  triggerSimulatedAnomaly(type) {
    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0];
    let newIncident = null;

    if (type === 'concealment') {
      newIncident = {
        id: `INC-2026-${Math.floor(100 + Math.random() * 900)}`,
        time: timeStr,
        camId: 'cam-perfume',
        camName: 'CAM 02 · Aisle 3 (Luxury Fragrance)',
        type: '🚨 Unscanned Concealment Detected',
        severity: 'CRITICAL',
        item: 'Luxury Eau de Parfum Spray ($145.00)',
        sku: 'SKU-PRF-401',
        confidence: 0.98,
        status: 'Active Alert',
        guardDispatched: false,
        details: 'Bounding box motion tracking detected rapid shelf grab and bag insertion.'
      };
      soundEffects.playWarningAlert();
    } else if (type === 'misplacement') {
      newIncident = {
        id: `INC-2026-${Math.floor(100 + Math.random() * 900)}`,
        time: timeStr,
        camId: 'cam-cereal',
        camName: 'CAM 07 · Aisle 7 (Breakfast Cereals)',
        type: '⚠️ Planogram Misplacement Breach',
        severity: 'WARNING',
        item: 'Herbal Shampoo Bottle on Cereal Shelf',
        sku: 'SKU-SHM-501',
        confidence: 0.95,
        status: 'Active Alert',
        guardDispatched: false,
        details: 'Non-edible cosmetic placed on edible cereal shelf tier 3.'
      };
      soundEffects.playDetectChime();
    } else if (type === 'dwell') {
      newIncident = {
        id: `INC-2026-${Math.floor(100 + Math.random() * 900)}`,
        time: timeStr,
        camId: 'cam-perfume',
        camName: 'CAM 02 · Aisle 3 (Luxury Fragrance)',
        type: '⏱️ Prolonged Luxury Zone Dwell',
        severity: 'HIGH',
        item: 'Shopper Loitering in High-Value Bay',
        sku: 'PERSON-608',
        confidence: 0.94,
        status: 'Active Alert',
        guardDispatched: false,
        details: 'Customer dwell in fragrance aisle reached 5 minutes without transaction.'
      };
      soundEffects.playWarningAlert();
    }

    if (newIncident) {
      this.incidents.unshift(newIncident);
      if (this.incidents.length > 20) this.incidents.pop();

      if (this.onTelemetryEvent) {
        this.onTelemetryEvent({
          source: 'LOSS_PREVENTION_AI',
          type: 'SECURITY_ANOMALY_TRIGGER',
          message: `[${newIncident.severity}] ${newIncident.type} at ${newIncident.camName} (${newIncident.item})`,
          data: newIncident
        });
      }

      this.render();
    }
  }

  dispatchGuard(id) {
    soundEffects.playClick();
    const inc = this.incidents.find(i => i.id === id);
    if (inc) {
      inc.guardDispatched = true;
      inc.status = 'Guard Dispatched';
      this.render();

      if (this.onTelemetryEvent) {
        this.onTelemetryEvent({
          source: 'SURVEILLANCE_DISPATCH',
          type: 'GUARD_ASSIGNED',
          message: `Security Officer assigned to investigate ${inc.id} at ${inc.camName}.`
        });
      }
    }
  }

  resolveIncident(id) {
    soundEffects.playClick();
    const inc = this.incidents.find(i => i.id === id);
    if (inc) {
      inc.status = 'Resolved';
      this.render();
    }
  }

  render() {
    if (!this.container) return;

    const activeCount = this.incidents.filter(i => i.status !== 'Resolved').length;
    const criticalCount = this.incidents.filter(i => i.severity === 'CRITICAL' && i.status !== 'Resolved').length;

    this.container.innerHTML = `
      <div class="security-workspace">
        <!-- Top Security KPI Grid -->
        <div class="metrics-grid-4">
          <div class="metric-card ${criticalCount > 0 ? 'border-critical' : ''}">
            <div class="metric-header">
              <span class="m-title">Active Security Alerts</span>
              <span class="m-icon ${criticalCount > 0 ? 'text-red pulse-icon' : 'text-cyan'}">🚨</span>
            </div>
            <div class="m-value font-mono ${criticalCount > 0 ? 'accent-red' : 'text-cyan'}">${activeCount} Anomalies</div>
            <div class="m-sub ${criticalCount > 0 ? 'text-red font-bold' : 'text-emerald'}">
              ${criticalCount > 0 ? `⚠️ ${criticalCount} Critical Threats Active` : 'All Feeds Monitored'}
            </div>
          </div>

          <div class="metric-card">
            <div class="metric-header">
              <span class="m-title">Prevented Shrinkage Value</span>
              <span class="m-icon text-emerald">🛡️</span>
            </div>
            <div class="m-value font-mono text-emerald">$2,480.00</div>
            <div class="m-sub text-cyan">4 Theft Attempts Intercepted</div>
          </div>

          <div class="metric-card">
            <div class="metric-header">
              <span class="m-title">Planogram Integrity</span>
              <span class="m-icon text-purple">📐</span>
            </div>
            <div class="m-value font-mono text-purple">96.8% Compliant</div>
            <div class="m-sub text-emerald">Shelf Misplacements Flagged</div>
          </div>

          <div class="metric-card">
            <div class="metric-header">
              <span class="m-title">AI Video Anomaly Model</span>
              <span class="m-icon text-amber">👁️</span>
            </div>
            <div class="m-value font-mono text-amber">YOLOv11-Guard</div>
            <div class="m-sub text-emerald">Zero-Latency Edge Inference</div>
          </div>
        </div>

        <!-- Anomaly Simulation Trigger Strip -->
        <div class="security-sim-bar mt-4">
          <div class="sim-bar-title-group">
            <span class="hud-tag">LIVE SIMULATOR</span>
            <span class="sim-title">Test Surveillance &amp; Loss Prevention AI:</span>
          </div>
          <div class="sim-bar-buttons">
            <button type="button" class="btn btn-danger btn-sm" id="btn-sim-theft" title="Simulate a customer attempting to conceal an unscanned item">
              🚨 Simulate Theft Concealment
            </button>
            <button type="button" class="btn btn-warning btn-sm" id="btn-sim-misplace" title="Simulate an item placed on the wrong shelf">
              ⚠️ Simulate Planogram Breach
            </button>
            <button type="button" class="btn btn-purple btn-sm" id="btn-sim-dwell" title="Simulate prolonged customer dwell in luxury section">
              ⏱️ Simulate Suspicious Dwell
            </button>
            <button type="button" class="btn btn-secondary btn-sm" id="btn-sound-siren" title="Sound store emergency audio alarm">
              🔊 Test Siren Alert
            </button>
          </div>
        </div>

        <!-- Active Security Incidents Table -->
        <div class="data-card mt-4">
          <div class="card-title-bar">
            <div class="bar-left">
              <h3 class="card-main-title">🛡️ Real-Time CCTV Loss Prevention &amp; Shrinkage Log</h3>
              <span class="card-subtitle">Edge Computer Vision anomaly detection, temporal track analysis, and guard dispatch queue</span>
            </div>
            <div class="bar-right">
              <button class="btn btn-outline btn-xs" id="btn-export-security-log">
                📄 Export Forensics Dossier
              </button>
            </div>
          </div>

          <table class="inventory-table font-mono mt-3">
            <thead>
              <tr>
                <th>Incident Ref</th>
                <th>Time &amp; Feed</th>
                <th>Anomaly Class</th>
                <th>Threat Level</th>
                <th>Detected Object / SKU</th>
                <th>AI Confidence</th>
                <th>Security Action</th>
              </tr>
            </thead>
            <tbody>
              ${this.incidents.map(inc => `
                <tr class="${inc.severity === 'CRITICAL' && inc.status !== 'Resolved' ? 'row-critical-alert' : ''}">
                  <td>
                    <strong>${inc.id}</strong><br>
                    <span class="text-xs ${inc.status === 'Resolved' ? 'text-emerald' : inc.guardDispatched ? 'text-amber' : 'text-red'} font-bold">
                      ● ${inc.status}
                    </span>
                  </td>
                  <td>
                    <span>${inc.time}</span><br>
                    <small class="text-dim">${inc.camName}</small>
                  </td>
                  <td>
                    <strong>${inc.type}</strong><br>
                    <span class="text-xs text-dim">${inc.details}</span>
                  </td>
                  <td>
                    <span class="badge ${inc.severity === 'CRITICAL' ? 'badge-critical' : inc.severity === 'HIGH' ? 'badge-low' : 'badge-normal'}">
                      ${inc.severity}
                    </span>
                  </td>
                  <td>
                    <strong>${inc.item}</strong><br>
                    <span class="text-xs text-cyan">${inc.sku}</span>
                  </td>
                  <td>
                    <span class="accent-cyan font-bold">${Math.round(inc.confidence * 100)}%</span>
                  </td>
                  <td>
                    <div style="display:flex; gap:6px;">
                      ${!inc.guardDispatched && inc.status !== 'Resolved' ? `
                        <button type="button" class="btn btn-warning btn-xs btn-dispatch-guard" data-id="${inc.id}">
                          👮 Dispatch
                        </button>
                      ` : ''}
                      ${inc.status !== 'Resolved' ? `
                        <button type="button" class="btn btn-outline btn-xs btn-resolve-incident" data-id="${inc.id}">
                          ✓ Resolve
                        </button>
                      ` : `
                        <span class="text-emerald text-xs font-bold">✓ Closed</span>
                      `}
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  bindEvents() {
    const btnTheft = this.container.querySelector('#btn-sim-theft');
    const btnMisplace = this.container.querySelector('#btn-sim-misplace');
    const btnDwell = this.container.querySelector('#btn-sim-dwell');
    const btnSiren = this.container.querySelector('#btn-sound-siren');
    const btnExport = this.container.querySelector('#btn-export-security-log');

    if (btnTheft) btnTheft.addEventListener('click', () => this.triggerSimulatedAnomaly('concealment'));
    if (btnMisplace) btnMisplace.addEventListener('click', () => this.triggerSimulatedAnomaly('misplacement'));
    if (btnDwell) btnDwell.addEventListener('click', () => this.triggerSimulatedAnomaly('dwell'));

    if (btnSiren) {
      btnSiren.addEventListener('click', () => {
        soundEffects.playWarningAlert();
        alert('🚨 STORE SECURITY KLAXON ACTIVE: Audible siren pulse transmitted across CCTV speaker matrix.');
      });
    }

    if (btnExport) {
      btnExport.addEventListener('click', () => {
        soundEffects.playClick();
        const csvRows = [
          ['Incident ID', 'Time', 'Camera Feed', 'Anomaly Type', 'Severity', 'Target Item', 'Confidence', 'Status', 'Details'].join(',')
        ];

        this.incidents.forEach(inc => {
          csvRows.push([
            inc.id,
            inc.time,
            `"${inc.camName}"`,
            `"${inc.type}"`,
            inc.severity,
            `"${inc.item}"`,
            inc.confidence,
            inc.status,
            `"${inc.details}"`
          ].join(','));
        });

        const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `security_loss_prevention_dossier_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      });
    }

    this.container.querySelectorAll('.btn-dispatch-guard').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        this.dispatchGuard(id);
      });
    });

    this.container.querySelectorAll('.btn-resolve-incident').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        this.resolveIncident(id);
      });
    });
  }
}
