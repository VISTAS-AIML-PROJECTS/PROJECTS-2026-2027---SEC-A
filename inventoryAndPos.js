// inventoryAndPos.js - Real-time Shelf Inventory & POS Fusion Analytics
// Project: CV-Based Sales Analytics Engine | Presenter: Harish

import { inventoryCatalog, hourlyTelemetryData } from '../data/retailData.js';

export class InventoryAndPosModule {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    this.catalog = [...inventoryCatalog];
    this.onTelemetryEvent = options.onTelemetryEvent || null;
    this.onStockChange = options.onStockChange || null;
    this.onOpenRestock = options.onOpenRestock || null;
    this.init();
  }

  init() {
    this.render();
    this.bindEvents();
  }

  render() {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="inventory-pos-workspace">
        <!-- Metric Cards Bar -->
        <div class="metrics-grid-4">
          <div class="metric-card">
            <div class="metric-header">
              <span class="m-title">Total Shelf SKUs</span>
              <span class="m-icon">📦</span>
            </div>
            <div class="m-value font-mono">8 Monitored</div>
            <div class="m-sub text-emerald">100% Edge Coverage</div>
          </div>

          <div class="metric-card">
            <div class="metric-header">
              <span class="m-title">Stockout Alerts</span>
              <span class="m-icon text-rose">⚠️</span>
            </div>
            <div class="m-value font-mono text-rose" id="metric-stockout-count">
              ${this.catalog.filter(i => i.status === 'critical').length} Urgent Gap
            </div>
            <div class="m-sub text-rose" id="metric-stockout-sub">Honey Nut Cheerios (Aisle 7)</div>
          </div>

          <div class="metric-card">
            <div class="metric-header">
              <span class="m-title">Average Dwell Time</span>
              <span class="m-icon text-cyan">⏱️</span>
            </div>
            <div class="m-value font-mono text-cyan">3.6 Minutes</div>
            <div class="m-sub text-emerald">+18% vs Store Benchmark</div>
          </div>

          <div class="metric-card">
            <div class="metric-header">
              <span class="m-title">POS Conversion Rate</span>
              <span class="m-icon text-purple">💳</span>
            </div>
            <div class="m-value font-mono text-purple">73.9%</div>
            <div class="m-sub text-emerald">Dwell-to-Purchase Ratio</div>
          </div>
        </div>

        <!-- Section 1: Live Shelf Stock & Planogram Health Table -->
        <div class="data-card mb-4">
          <div class="card-title-bar">
            <div class="bar-left">
              <h3 class="card-main-title">📦 Live Shelf Stock &amp; Planogram Compliance</h3>
              <span class="card-subtitle">Real-time inventory levels inferred via YOLOv5 bounding boxes and synced to Firebase</span>
            </div>
            <div class="bar-right">
              <button class="btn btn-primary btn-sm" id="btn-simulate-pickup">
                🛒 Simulate Customer Pickup
              </button>
              <button class="btn btn-warning btn-sm" id="btn-simulate-restock">
                ⚡ Restock Supplier Order
              </button>
            </div>
          </div>

          <div class="table-responsive-wrapper">
            <table class="inventory-table">
              <thead>
                <tr>
                  <th>Product &amp; SKU</th>
                  <th>Shelf Location</th>
                  <th>Visual Stock Level</th>
                  <th>Safety Threshold</th>
                  <th>POS Velocity</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody id="inventory-table-body">
                ${this.renderTableRowsHTML()}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Section 2: Video Analytics & POS Sales Fusion -->
        <div class="data-card">
          <div class="card-title-bar">
            <div class="bar-left">
              <h3 class="card-main-title">📈 Video Analytics Fused with Sales History (Cloud Firestore)</h3>
              <span class="card-subtitle">Correlating visual customer footfall &amp; dwell time with actual checkout revenue</span>
            </div>
            <div class="bar-right">
              <span class="badge badge-normal font-mono">Sync Interval: 1.0s</span>
            </div>
          </div>

          <!-- Fusion Chart Visualization (SVG Interactive Chart) -->
          <div class="chart-container">
            <div class="chart-legend">
              <div class="legend-item"><span class="legend-dot" style="background:#06b6d4"></span> In-Store Foot Traffic (Shoppers)</div>
              <div class="legend-item"><span class="legend-dot" style="background:#10b981"></span> POS Sales Transactions (Units)</div>
              <div class="legend-item"><span class="legend-dot" style="background:#a855f7"></span> Shelf Stock Detections</div>
            </div>

            <div class="svg-chart-wrapper">
              <svg viewBox="0 0 900 240" class="fusion-svg-chart">
                <defs>
                  <linearGradient id="gradCyan" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="#06b6d4" stop-opacity="0.35"/>
                    <stop offset="100%" stop-color="#06b6d4" stop-opacity="0.0"/>
                  </linearGradient>
                  <linearGradient id="gradGreen" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="#10b981" stop-opacity="0.4"/>
                    <stop offset="100%" stop-color="#10b981" stop-opacity="0.0"/>
                  </linearGradient>
                </defs>

                <!-- Grid Lines -->
                <line x1="50" y1="30" x2="860" y2="30" stroke="rgba(255,255,255,0.08)" stroke-dasharray="3,3" />
                <line x1="50" y1="80" x2="860" y2="80" stroke="rgba(255,255,255,0.08)" stroke-dasharray="3,3" />
                <line x1="50" y1="130" x2="860" y2="130" stroke="rgba(255,255,255,0.08)" stroke-dasharray="3,3" />
                <line x1="50" y1="180" x2="860" y2="180" stroke="rgba(255,255,255,0.08)" stroke-dasharray="3,3" />

                <!-- Foot Traffic Area & Line -->
                <polygon points="
                  50,210
                  50,185 130,160 210,135 290,100 370,65 450,72 530,110 610,100 690,55 770,35 850,50
                  850,210
                " fill="url(#gradCyan)" />

                <polyline points="
                  50,185 130,160 210,135 290,100 370,65 450,72 530,110 610,100 690,55 770,35 850,50
                " fill="none" stroke="#06b6d4" stroke-width="3" />

                <!-- POS Sales Line -->
                <polyline points="
                  50,192 130,178 210,155 290,130 370,105 450,112 530,140 610,134 690,95 770,75 850,90
                " fill="none" stroke="#10b981" stroke-width="2.5" />

                <!-- Data Points & Labels -->
                ${hourlyTelemetryData.map((d, i) => {
                  const cx = 50 + (i * 80);
                  return `
                    <circle cx="${cx}" cy="${210 - (d.footTraffic * 0.95)}" r="4" fill="#06b6d4" stroke="#ffffff" stroke-width="1.5" />
                    <circle cx="${cx}" cy="${210 - (d.posSalesQty * 0.95)}" r="3" fill="#10b981" stroke="#ffffff" stroke-width="1" />
                    <text x="${cx}" y="230" fill="#94a3b8" font-size="10" font-family="'JetBrains Mono', monospace" text-anchor="middle">${d.time.split(' ')[0]}</text>
                  `;
                }).join('')}
              </svg>
            </div>

            <!-- Chart Summary Cards -->
            <div class="chart-summary-grid">
              <div class="summary-box">
                <span class="s-label">Peak Foot Traffic Window</span>
                <span class="s-val text-cyan">17:00 – 18:00 (182 Shoppers/hr)</span>
              </div>
              <div class="summary-box">
                <span class="s-label">Hourly Sales Revenue Peak</span>
                <span class="s-val text-emerald">$1,342.00 / hr</span>
              </div>
              <div class="summary-box">
                <span class="s-label">Visual vs Register Shrinkage Delta</span>
                <span class="s-val text-purple">&lt; 0.5% (Optimal)</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  renderTableRowsHTML() {
    return this.catalog.map(item => {
      const pct = Math.min(100, Math.round((item.currentStock / item.maxCapacity) * 100));
      const isCritical = item.status === 'critical';
      const isLow = item.status === 'low';

      let statusBadge = `<span class="badge badge-normal">Healthy</span>`;
      let barColor = '#10b981';

      if (isCritical) {
        statusBadge = `<span class="badge badge-critical">Critical Gap</span>`;
        barColor = '#ef4444';
      } else if (isLow) {
        statusBadge = `<span class="badge badge-low">Low Stock</span>`;
        barColor = '#f59e0b';
      }

      return `
        <tr data-sku="${item.sku}">
          <td>
            <div class="prod-cell">
              <strong class="prod-name">${item.name}</strong>
              <span class="prod-sku font-mono">${item.sku} &bull; ${item.category}</span>
            </div>
          </td>
          <td class="font-mono">${item.shelfId}</td>
          <td>
            <div class="stock-bar-wrapper">
              <div class="stock-meta-row">
                <span class="stock-qty-text font-bold ${isCritical ? 'text-critical' : isLow ? 'text-warning' : 'text-emerald'}">
                  ${item.currentStock} / ${item.maxCapacity} units
                </span>
                <span class="stock-pct-text">${pct}%</span>
              </div>
              <div class="stock-track">
                <div class="stock-fill" style="width: ${pct}%; background: ${barColor};"></div>
              </div>
            </div>
          </td>
          <td class="font-mono">${item.minThreshold} units</td>
          <td class="font-mono text-cyan">${item.posVelocityDay} / day</td>
          <td>${statusBadge}</td>
          <td>
            <button class="btn ${isCritical ? 'btn-danger' : isLow ? 'btn-warning' : 'btn-outline'} btn-xs btn-reorder-action" data-sku="${item.sku}">
              ${isCritical ? '⚡ Restock &amp; Pay' : isLow ? '📦 Restock &amp; Pay' : 'Restock Order'}
            </button>
          </td>
        </tr>
      `;
    }).join('');
  }

  bindEvents() {
    const btnPickup = document.getElementById('btn-simulate-pickup');
    if (btnPickup) {
      btnPickup.addEventListener('click', () => {
        this.simulateCustomerPickup();
      });
    }

    const btnRestock = document.getElementById('btn-simulate-restock');
    if (btnRestock) {
      btnRestock.addEventListener('click', () => {
        // Open restock modal for the first item needing stock
        const target = this.catalog.find(i => i.status === 'critical') || 
                       this.catalog.find(i => i.status === 'low') || 
                       this.catalog[0];
        if (this.onOpenRestock) {
          this.onOpenRestock(target);
        }
      });
    }

    // Action button clicks on each table row
    this.container.addEventListener('click', (e) => {
      const btn = e.target.closest('.btn-reorder-action');
      if (btn) {
        const sku = btn.getAttribute('data-sku');
        const item = this.catalog.find(i => i.sku === sku);
        if (item && this.onOpenRestock) {
          this.onOpenRestock(item);
        }
      }
    });
  }

  simulateCustomerPickup() {
    const availableItems = this.catalog.filter(i => i.currentStock > 0);
    if (availableItems.length === 0) return;

    const target = availableItems[Math.floor(Math.random() * availableItems.length)];
    target.currentStock -= 1;

    if (target.currentStock === 0) {
      target.status = 'critical';
    } else if (target.currentStock <= target.minThreshold) {
      target.status = 'low';
    }

    this.updateTable();

    if (this.onTelemetryEvent) {
      this.onTelemetryEvent({
        source: 'EDGE_YOLOV5',
        type: 'CUSTOMER_PICKUP',
        message: `Visual shelf decrement: Shopper removed 1 unit of ${target.name} (${target.sku})`,
        data: { sku: target.sku, remaining: target.currentStock, shelf: target.shelfId }
      });
    }

    if (this.onStockChange) {
      this.onStockChange(target);
    }
  }

  applyRestockedItem(restockedItem, quantity) {
    const found = this.catalog.find(i => i.sku === restockedItem.sku);
    if (found) {
      found.currentStock = Math.min(found.maxCapacity, (found.currentStock || 0) + quantity);
      found.status = 'normal';
      this.updateTable();
    }
  }

  applyCustomerPurchase(sku, quantity = 1) {
    const found = this.catalog.find(i => i.sku === sku);
    if (found) {
      found.currentStock = Math.max(0, (found.currentStock || 0) - quantity);
      if (found.currentStock === 0) {
        found.status = 'critical';
      } else if (found.currentStock <= found.minThreshold) {
        found.status = 'low';
      }
      this.updateTable();
      if (this.onStockChange) {
        this.onStockChange(found);
      }
    }
  }

  updateTable() {
    const tbody = document.getElementById('inventory-table-body');
    if (tbody) {
      tbody.innerHTML = this.renderTableRowsHTML();
    }

    const stockoutCountEl = document.getElementById('metric-stockout-count');
    const stockoutSubEl = document.getElementById('metric-stockout-sub');
    if (stockoutCountEl) {
      const count = this.catalog.filter(i => i.status === 'critical').length;
      stockoutCountEl.textContent = `${count} Urgent Gap`;
      stockoutCountEl.className = `m-value font-mono ${count > 0 ? 'text-rose' : 'text-emerald'}`;
      if (stockoutSubEl) {
        stockoutSubEl.textContent = count > 0 ? 'Honey Nut Cheerios (Aisle 7)' : 'All Shelves Fully Stocked';
        stockoutSubEl.className = count > 0 ? 'm-sub text-rose' : 'm-sub text-emerald';
      }
    }
  }
}
