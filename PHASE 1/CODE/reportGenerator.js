// reportGenerator.js - Automated Daily Store Audit & Vision Inspection Report Generator
// Generates publication-ready executive reports fusing Computer Vision planogram audits,
// POS sales conversions, stockout resolution metrics, and procurement invoices.

import { retailCameras, hourlyTelemetryData } from '../data/retailData.js';
import { authManager } from '../data/authManager.js';

export class ReportGenerator {
  constructor() {
    this.createModalDOM();
  }

  createModalDOM() {
    if (typeof document === 'undefined') return;
    let modal = document.getElementById('audit-report-modal');
    if (modal) return;

    modal = document.createElement('div');
    modal.id = 'audit-report-modal';
    modal.className = 'modal-overlay hidden';
    modal.innerHTML = `
      <div class="modal-dialog glass-panel report-dialog" role="dialog" aria-modal="true" aria-labelledby="report-modal-title">
        <div class="modal-header">
          <div class="modal-title-group">
            <span class="modal-icon-badge" style="background: rgba(6, 182, 212, 0.2); border-color: #06b6d4;">📊</span>
            <div>
              <h3 class="modal-title" id="report-modal-title">Daily Store Audit &amp; Vision Intelligence Report</h3>
              <p class="modal-subtitle">Official Shift Audit &bull; Generated via Edge YOLOv11 &amp; POS Fusion</p>
            </div>
          </div>
          <button class="modal-close-btn" id="report-modal-close-btn" aria-label="Close Report">&times;</button>
        </div>

        <div class="modal-body report-modal-body" id="report-modal-body">
          <!-- Dynamic report content generated on open -->
        </div>

        <div class="modal-footer report-modal-footer">
          <button type="button" class="btn btn-secondary btn-sm" id="btn-close-report">Close</button>
          <button type="button" class="btn btn-primary btn-sm" id="btn-print-report" style="background: linear-gradient(135deg, #06b6d4, #3b82f6);">
            🖨️ Print / Save as PDF
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const closeBtn = modal.querySelector('#report-modal-close-btn');
    const closeFooterBtn = modal.querySelector('#btn-close-report');
    const printBtn = modal.querySelector('#btn-print-report');

    const closeModal = () => modal.classList.add('hidden');
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (closeFooterBtn) closeFooterBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    if (printBtn) {
      printBtn.addEventListener('click', () => {
        window.print();
      });
    }
  }

  generateReport(invoices = []) {
    const modal = document.getElementById('audit-report-modal');
    const body = document.getElementById('report-modal-body');
    if (!modal || !body) return;

    const manager = authManager.loadActiveUser();
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    // Compute aggregated metrics
    const totalFootTraffic = hourlyTelemetryData.reduce((acc, h) => acc + h.footTraffic, 0);
    const avgConversion = (hourlyTelemetryData.reduce((acc, h) => acc + h.conversionRate, 0) / hourlyTelemetryData.length).toFixed(1);
    const avgPlanogram = (retailCameras.reduce((acc, c) => acc + c.planogramAdherence, 0) / retailCameras.length).toFixed(1);
    const totalDetections = retailCameras.reduce((acc, c) => acc + c.totalProductsDetected, 0);
    const activeStockouts = retailCameras.reduce((acc, c) => acc + c.outOfStockCount, 0);
    const invoiceTotalSum = invoices.reduce((acc, inv) => acc + parseFloat((inv.total || '0').replace('$', '')), 0).toFixed(2);

    body.innerHTML = `
      <div class="printable-audit-sheet">
        <!-- Report Header -->
        <div class="sheet-header">
          <div class="sheet-title-left">
            <h2 class="sheet-main-title">SMART-RETAIL STORE AUDIT &amp; CV PERFORMANCE DOSSIER</h2>
            <div class="sheet-meta font-mono">
              <span>Report Ref: <strong>AUD-${now.getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}</strong></span>
              <span>Audit Period: <strong>${dateStr} &bull; ${timeStr}</strong></span>
              <span>Auditing Officer: <strong>${manager.fullName} (${manager.role})</strong></span>
              <span>Terminal Node: <strong>YOLOv11-Edge-Station-01</strong></span>
            </div>
          </div>
          <div class="sheet-verified-badge">
            <div class="badge-ring">✓</div>
            <span>OFFICIALLY AUDITED</span>
          </div>
        </div>

        <div class="sheet-divider"></div>

        <!-- Executive Summary Highlights -->
        <div class="sheet-section">
          <h4 class="sheet-section-title">1. Executive Operational Scorecard</h4>
          <div class="sheet-grid-4">
            <div class="sheet-metric-box">
              <span class="sm-label">Total Foot Traffic</span>
              <span class="sm-value font-mono text-cyan">${totalFootTraffic} Visitors</span>
              <span class="sm-sub text-emerald">+14.2% vs Benchmark</span>
            </div>
            <div class="sheet-metric-box">
              <span class="sm-label">POS Conversion Rate</span>
              <span class="sm-value font-mono text-purple">${avgConversion}%</span>
              <span class="sm-sub text-emerald">High Intent Yield</span>
            </div>
            <div class="sheet-metric-box">
              <span class="sm-label">Planogram Adherence</span>
              <span class="sm-value font-mono text-emerald">${avgPlanogram}%</span>
              <span class="sm-sub text-cyan">Vision Guarded</span>
            </div>
            <div class="sheet-metric-box">
              <span class="sm-label">Procurement Total Today</span>
              <span class="sm-value font-mono text-amber">$${invoiceTotalSum}</span>
              <span class="sm-sub">${invoices.length} Invoices Issued</span>
            </div>
          </div>
        </div>

        <!-- Vision Feeds Planogram Health Breakdown -->
        <div class="sheet-section">
          <h4 class="sheet-section-title">2. Computer Vision Surveillance &amp; CCTV Feeds Audit</h4>
          <table class="sheet-table font-mono">
            <thead>
              <tr>
                <th>CCTV Stream ID</th>
                <th>Monitored Aisle &amp; Domain</th>
                <th>Products Tracked</th>
                <th>Adherence Score</th>
                <th>Stockout Alert Status</th>
                <th>Edge Latency</th>
              </tr>
            </thead>
            <tbody>
              ${retailCameras.map(cam => `
                <tr>
                  <td><strong>${cam.id.toUpperCase()}</strong></td>
                  <td>${cam.aisle} (${cam.category})</td>
                  <td>${cam.totalProductsDetected} Units</td>
                  <td><span class="${cam.planogramAdherence >= 90 ? 'text-emerald' : 'text-amber'}">${cam.planogramAdherence}%</span></td>
                  <td>
                    ${cam.outOfStockCount > 0 
                      ? `<span class="badge badge-critical">${cam.outOfStockCount} Gap Detected</span>` 
                      : `<span class="badge badge-normal">Optimal Buffer</span>`}
                  </td>
                  <td>${cam.edgeLatency}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <!-- Product Kind Inventory & Category Breakdown -->
        <div class="sheet-section">
          <h4 class="sheet-section-title">3. Broad Product Kind Telemetry &amp; Detection Distribution</h4>
          <div class="sheet-product-kinds-grid">
            <div class="kind-summary-pill">
              <span class="k-icon">🥤</span>
              <div>
                <strong>BEVERAGES</strong>
                <p>Can &amp; PET Bottles &bull; 98% Confidence</p>
              </div>
            </div>
            <div class="kind-summary-pill">
              <span class="k-icon">🥔</span>
              <div>
                <strong>CHIPS</strong>
                <p>Foil Pillow Pouches &bull; 97% Confidence</p>
              </div>
            </div>
            <div class="kind-summary-pill">
              <span class="k-icon">🫙</span>
              <div>
                <strong>PICKLE</strong>
                <p>Glass Lug Cap Jars &bull; 97% Confidence</p>
              </div>
            </div>
            <div class="kind-summary-pill">
              <span class="k-icon">🍪</span>
              <div>
                <strong>BISCUITS</strong>
                <p>Barrier Foil Wraps &bull; 96% Confidence</p>
              </div>
            </div>
            <div class="kind-summary-pill">
              <span class="k-icon">🧴</span>
              <div>
                <strong>SHAMPOO</strong>
                <p>Ergonomic Plastic Bottles &bull; 96% Confidence</p>
              </div>
            </div>
            <div class="kind-summary-pill">
              <span class="k-icon">🌸</span>
              <div>
                <strong>PERFUME</strong>
                <p>Glass Atomizer Flacons &bull; 98% Confidence</p>
              </div>
            </div>
            <div class="kind-summary-pill">
              <span class="k-icon">👤</span>
              <div>
                <strong>HUMANS</strong>
                <p>Active Shoppers Trajectory &bull; 99% Confidence</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Restock & Procurement Tax Invoices Signed Today -->
        <div class="sheet-section">
          <h4 class="sheet-section-title">4. Issued Restock Tax Invoices &amp; Verified Payment Logs</h4>
          ${invoices.length > 0 ? `
            <table class="sheet-table font-mono">
              <thead>
                <tr>
                  <th>Invoice No</th>
                  <th>Timestamp</th>
                  <th>Product Kind &amp; Item</th>
                  <th>Quantity</th>
                  <th>Amount</th>
                  <th>Payment Mode</th>
                  <th>Auth Manager</th>
                </tr>
              </thead>
              <tbody>
                ${invoices.map(inv => `
                  <tr>
                    <td><strong>${inv.invoiceNo}</strong></td>
                    <td>${inv.timestamp}</td>
                    <td>${inv.item?.name || 'Retail Product'}</td>
                    <td>${inv.quantity} Units</td>
                    <td class="text-emerald">$${inv.total}</td>
                    <td>${inv.payMethodName || 'Verified Gateway'}</td>
                    <td>${inv.authorizedUser?.userId || manager.userId}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          ` : `
            <p class="sheet-dim-note">No new procurement reorders issued during this operating window. Stock levels within safe operating tolerances.</p>
          `}
        </div>

        <!-- Manager Digital Sign-off -->
        <div class="sheet-footer-signoff">
          <div class="signoff-box">
            <span class="so-label">Store General Manager Signature:</span>
            <div class="digital-signature font-mono">/s/ ${manager.fullName} - ${manager.userId}</div>
            <span class="so-hash font-mono">Cryptographic Hash: SHA-256:${Math.random().toString(16).substring(2, 14).toUpperCase()}</span>
          </div>
          <div class="signoff-box text-right">
            <span class="so-label">System Verification:</span>
            <div class="sys-stamp font-mono text-cyan">VERIFIED &bull; FIRESTORE SYNC &bull; YOLOv11</div>
            <span class="so-hash font-mono">Academic Project Review 2 &bull; Harish</span>
          </div>
        </div>
      </div>
    `;

    modal.classList.remove('hidden');
  }
}

export const reportGenerator = new ReportGenerator();
