// analyticsDashboard.js - Store Analytics, Canvas Visualizations, Heatmaps & Predictive Forecasting
// Merges computer vision spatial dwell data with POS sales velocity and inventory forecasts.

import { hourlyTelemetryData, retailCameras } from '../data/retailData.js';
import { soundEffects } from '../utils/soundEffects.js';

export class AnalyticsDashboardModule {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    this.onOpenRestock = options.onOpenRestock || null;
    this.onTelemetryEvent = options.onTelemetryEvent || null;
    this.activeTimeframe = 'today';
    this.init();
  }

  init() {
    this.render();
    this.initCanvasChart();
    this.bindEvents();
  }

  render() {
    if (!this.container) return;

    const totalVisitors = hourlyTelemetryData.reduce((acc, h) => acc + h.footTraffic, 0);
    const totalRevenue = hourlyTelemetryData.reduce((acc, h) => acc + parseFloat(h.revenue.replace('$', '').replace(',', '')), 0).toFixed(2);
    const avgConversion = (hourlyTelemetryData.reduce((acc, h) => acc + h.conversionRate, 0) / hourlyTelemetryData.length).toFixed(1);
    const avgDwell = (hourlyTelemetryData.reduce((acc, h) => acc + h.dwellMin, 0) / hourlyTelemetryData.length).toFixed(1);

    this.container.innerHTML = `
      <div class="analytics-workspace">
        <!-- Top Executive KPI Ribbon -->
        <div class="metrics-grid-4">
          <div class="metric-card">
            <div class="metric-header">
              <span class="m-title">Total Footfall Today</span>
              <span class="m-icon text-cyan">👥</span>
            </div>
            <div class="m-value font-mono text-cyan">${totalVisitors} Shoppers</div>
            <div class="m-sub text-emerald">+12.4% vs Yesterday</div>
          </div>

          <div class="metric-card">
            <div class="metric-header">
              <span class="m-title">POS Store Revenue</span>
              <span class="m-icon text-emerald">💰</span>
            </div>
            <div class="m-value font-mono text-emerald">$${Number(totalRevenue).toLocaleString()}</div>
            <div class="m-sub text-emerald">YOLOv11 Dwell Correlated</div>
          </div>

          <div class="metric-card">
            <div class="metric-header">
              <span class="m-title">Conversion Yield</span>
              <span class="m-icon text-purple">📈</span>
            </div>
            <div class="m-value font-mono text-purple">${avgConversion}%</div>
            <div class="m-sub text-cyan">Dwell &ge; 2.5 min = 84% Buy</div>
          </div>

          <div class="metric-card">
            <div class="metric-header">
              <span class="m-title">Average Aisle Dwell</span>
              <span class="m-icon text-amber">⏱️</span>
            </div>
            <div class="m-value font-mono text-amber">${avgDwell} Minutes</div>
            <div class="m-sub text-emerald">Engaged Browsing</div>
          </div>
        </div>

        <!-- Section 1: Interactive Footfall vs Sales Canvas Chart -->
        <div class="data-card mb-4 mt-4">
          <div class="card-title-bar">
            <div class="bar-left">
              <h3 class="card-main-title">📈 Real-Time Footfall vs. POS Sales &amp; Conversion Velocity</h3>
              <span class="card-subtitle">Synthesizes overhead camera trajectory vectors with cash register POS timestamps</span>
            </div>
            <div class="bar-right">
              <span class="hud-tag protocol-tag">Live 60 FPS Canvas</span>
              <span class="hud-tag">Hourly Interval</span>
            </div>
          </div>

          <div class="chart-canvas-container">
            <canvas id="traffic-sales-canvas" height="280"></canvas>
            <div class="chart-legend-row font-mono">
              <span class="legend-item"><span class="legend-color-dot" style="background: #06b6d4;"></span> Shopper Foot Traffic (Visitors)</span>
              <span class="legend-item"><span class="legend-color-dot" style="background: #10b981;"></span> POS Sales Qty (Units)</span>
              <span class="legend-item"><span class="legend-color-dot" style="background: #d946ef;"></span> Conversion Rate %</span>
            </div>
          </div>
        </div>

        <!-- Section 2: Product Kinds Revenue & Predictive Runout Hours -->
        <div class="analytics-split-grid">
          <!-- Left: Revenue by Product Kind -->
          <div class="data-card">
            <div class="card-title-bar">
              <div class="bar-left">
                <h3 class="card-main-title">🏷️ Revenue Contribution by Broad Product Kind</h3>
                <span class="card-subtitle">Real-time classification breakdown inferred from shelf presence &amp; POS</span>
              </div>
            </div>

            <div class="product-kind-share-list">
              <div class="kind-share-row">
                <div class="kind-share-head">
                  <span class="kind-title">🥤 Beverage (Cold Drinks &amp; Juice)</span>
                  <span class="kind-amount font-mono text-cyan">$1,840.50 (28.4%)</span>
                </div>
                <div class="progress-track"><div class="progress-fill" style="width: 28.4%; background: #06b6d4;"></div></div>
              </div>

              <div class="kind-share-row">
                <div class="kind-share-head">
                  <span class="kind-title">🥔 Chips (Potato Crisps &amp; Snacks)</span>
                  <span class="kind-amount font-mono text-emerald">$1,215.00 (18.8%)</span>
                </div>
                <div class="progress-track"><div class="progress-fill" style="width: 18.8%; background: #10b981;"></div></div>
              </div>

              <div class="kind-share-row">
                <div class="kind-share-head">
                  <span class="kind-title">🫙 Pickle (Preserved Glass Jars)</span>
                  <span class="kind-amount font-mono text-amber">$940.20 (14.5%)</span>
                </div>
                <div class="progress-track"><div class="progress-fill" style="width: 14.5%; background: #f59e0b;"></div></div>
              </div>

              <div class="kind-share-row">
                <div class="kind-share-head">
                  <span class="kind-title">🍪 Biscuits (Cookies &amp; Baked Snacks)</span>
                  <span class="kind-amount font-mono text-purple">$890.00 (13.7%)</span>
                </div>
                <div class="progress-track"><div class="progress-fill" style="width: 13.7%; background: #8b5cf6;"></div></div>
              </div>

              <div class="kind-share-row">
                <div class="kind-share-head">
                  <span class="kind-title">🌸 Perfume (Luxury Fragrance Sprays)</span>
                  <span class="kind-amount font-mono text-fuchsia">$830.00 (12.9%)</span>
                </div>
                <div class="progress-track"><div class="progress-fill" style="width: 12.9%; background: #d946ef;"></div></div>
              </div>

              <div class="kind-share-row">
                <div class="kind-share-head">
                  <span class="kind-title">🧴 Shampoo (Haircare &amp; Cleansers)</span>
                  <span class="kind-amount font-mono text-blue">$760.30 (11.7%)</span>
                </div>
                <div class="progress-track"><div class="progress-fill" style="width: 11.7%; background: #3b82f6;"></div></div>
              </div>
            </div>
          </div>

          <!-- Right: Predictive Runout & Restock Urgency Forecast -->
          <div class="data-card">
            <div class="card-title-bar">
              <div class="bar-left">
                <h3 class="card-main-title">⏱️ Predictive Shelf Depletion &amp; Runout Timeline</h3>
                <span class="card-subtitle">Calculated via Vision Dwell + POS depletion rates</span>
              </div>
            </div>

            <table class="inventory-table font-mono">
              <thead>
                <tr>
                  <th>Product Kind &amp; SKU</th>
                  <th>Stock</th>
                  <th>Velocity</th>
                  <th>Runout In</th>
                  <th>Urgency</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>🥣 Cereal (Gap C-3)</strong><br><span class="text-xs text-dim">SKU-CER-306</span></td>
                  <td><span class="text-rose font-bold">0 units</span></td>
                  <td>14.2 / hr</td>
                  <td><span class="text-rose font-bold">0.0 hrs</span></td>
                  <td><span class="badge badge-critical">IMMEDIATE</span></td>
                  <td>
                    <button class="btn btn-danger btn-xs btn-analytics-reorder" data-sku="SKU-CER-306" data-name="Cereal (Breakfast Oats Box)" data-price="4.39">Reorder</button>
                  </td>
                </tr>

                <tr>
                  <td><strong>🥤 Beverage (Plant Milk)</strong><br><span class="text-xs text-dim">SKU-DRY-108</span></td>
                  <td><span class="text-amber font-bold">3 units</span></td>
                  <td>9.8 / hr</td>
                  <td><span class="text-amber font-bold">1.8 hrs</span></td>
                  <td><span class="badge badge-low">URGENT</span></td>
                  <td>
                    <button class="btn btn-warning btn-xs btn-analytics-reorder" data-sku="SKU-DRY-108" data-name="Beverage (Plant Milk Carton)" data-price="4.99">Reorder</button>
                  </td>
                </tr>

                <tr>
                  <td><strong>🌸 Perfume (Luxury Eau)</strong><br><span class="text-xs text-dim">SKU-PRF-403</span></td>
                  <td><span class="text-amber font-bold">3 units</span></td>
                  <td>2.1 / hr</td>
                  <td><span class="text-amber font-bold">3.2 hrs</span></td>
                  <td><span class="badge badge-low">MODERATE</span></td>
                  <td>
                    <button class="btn btn-warning btn-xs btn-analytics-reorder" data-sku="SKU-PRF-403" data-name="Perfume (Fragrance Cologne)" data-price="98.00">Reorder</button>
                  </td>
                </tr>

                <tr>
                  <td><strong>🥔 Chips (Potato Snack)</strong><br><span class="text-xs text-dim">SKU-CHP-201</span></td>
                  <td><span class="text-emerald font-bold">18 units</span></td>
                  <td>5.4 / hr</td>
                  <td><span class="text-emerald font-bold">8.6 hrs</span></td>
                  <td><span class="badge badge-normal">OPTIMAL</span></td>
                  <td>
                    <button class="btn btn-secondary btn-xs btn-analytics-reorder" data-sku="SKU-CHP-201" data-name="Chips (Foil Pillow Pouch)" data-price="3.49">Reorder</button>
                  </td>
                </tr>

                <tr>
                  <td><strong>🫙 Pickle (Preserved Jar)</strong><br><span class="text-xs text-dim">SKU-PCK-301</span></td>
                  <td><span class="text-emerald font-bold">14 units</span></td>
                  <td>3.1 / hr</td>
                  <td><span class="text-emerald font-bold">11.2 hrs</span></td>
                  <td><span class="badge badge-normal">SAFE</span></td>
                  <td>
                    <button class="btn btn-secondary btn-xs btn-analytics-reorder" data-sku="SKU-PCK-301" data-name="Pickle (Glass Lug Cap Jar)" data-price="4.99">Reorder</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Section 3: Spatial Heatmap Intensity Matrix Across Aisles -->
        <div class="data-card mt-4">
          <div class="card-title-bar">
            <div class="bar-left">
              <h3 class="card-main-title">🔥 In-Store Aisle Heatmap &amp; Thermal Footfall Matrix</h3>
              <span class="card-subtitle">Visualizes customer congestion, velocity bottlenecks, and high-interest merchandising nodes</span>
            </div>
          </div>

          <div class="heatmap-nodes-grid">
            <div class="heatmap-node-box">
              <div class="node-header">
                <span class="node-title">Aisle 3 &bull; Luxury Fragrances</span>
                <span class="node-badge" style="background: rgba(217, 70, 239, 0.2); color: #f0abfc;">96% Dwell Intensity</span>
              </div>
              <div class="node-visual" style="background: radial-gradient(circle at 50% 50%, rgba(217, 70, 239, 0.6) 0%, rgba(217, 70, 239, 0.1) 60%, transparent 100%);">
                <span class="node-metric">3.8 min Avg Dwell</span>
                <span class="node-sub">High Sampling Velocity</span>
              </div>
            </div>

            <div class="heatmap-node-box">
              <div class="node-header">
                <span class="node-title">Aisle 4 &bull; Dairy &amp; Beverages</span>
                <span class="node-badge" style="background: rgba(6, 182, 212, 0.2); color: #67e8f9;">88% Dwell Intensity</span>
              </div>
              <div class="node-visual" style="background: radial-gradient(circle at 50% 50%, rgba(6, 182, 212, 0.6) 0%, rgba(6, 182, 212, 0.1) 60%, transparent 100%);">
                <span class="node-metric">2.4 min Avg Dwell</span>
                <span class="node-sub">High Grab-and-Go</span>
              </div>
            </div>

            <div class="heatmap-node-box">
              <div class="node-header">
                <span class="node-title">Aisle 7 &bull; Groceries &amp; Snacks</span>
                <span class="node-badge" style="background: rgba(16, 185, 129, 0.2); color: #6ee7b7;">92% Dwell Intensity</span>
              </div>
              <div class="node-visual" style="background: radial-gradient(circle at 50% 50%, rgba(16, 185, 129, 0.6) 0%, rgba(16, 185, 129, 0.1) 60%, transparent 100%);">
                <span class="node-metric">4.2 min Avg Dwell</span>
                <span class="node-sub">Unmet Stockout Demand</span>
              </div>
            </div>

            <div class="heatmap-node-box">
              <div class="node-header">
                <span class="node-title">Concourse &bull; Central Pathway</span>
                <span class="node-badge" style="background: rgba(59, 130, 246, 0.2); color: #93c5fd;">65% Dwell Intensity</span>
              </div>
              <div class="node-visual" style="background: radial-gradient(circle at 50% 50%, rgba(59, 130, 246, 0.5) 0%, rgba(59, 130, 246, 0.08) 60%, transparent 100%);">
                <span class="node-metric">1.2 min Avg Dwell</span>
                <span class="node-sub">Continuous Flow Node</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  initCanvasChart() {
    const canvas = document.getElementById('traffic-sales-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const updateSize = () => {
      const rect = canvas.parentElement.getBoundingClientRect();
      canvas.width = rect.width || 800;
      canvas.height = 260;
      this.drawChart(ctx, canvas.width, canvas.height);
    };

    setTimeout(updateSize, 100);
    window.addEventListener('resize', updateSize);
  }

  drawChart(ctx, w, h) {
    ctx.clearRect(0, 0, w, h);

    const padLeft = 60;
    const padRight = 30;
    const padTop = 30;
    const padBottom = 40;

    const chartW = w - padLeft - padRight;
    const chartH = h - padTop - padBottom;

    const data = hourlyTelemetryData;
    const maxTraffic = 200;

    // Draw horizontal grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = padTop + (chartH / 4) * i;
      ctx.beginPath();
      ctx.moveTo(padLeft, y);
      ctx.lineTo(w - padRight, y);
      ctx.stroke();

      const labelVal = Math.round(maxTraffic - (maxTraffic / 4) * i);
      ctx.fillStyle = '#64748b';
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.textAlign = 'right';
      ctx.fillText(labelVal, padLeft - 10, y + 4);
    }

    const stepX = chartW / (data.length - 1);

    // 1. Draw Foot Traffic Area & Line (Cyan)
    ctx.save();
    ctx.beginPath();
    data.forEach((d, idx) => {
      const x = padLeft + idx * stepX;
      const y = padTop + chartH * (1 - d.footTraffic / maxTraffic);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.lineTo(padLeft + (data.length - 1) * stepX, padTop + chartH);
    ctx.lineTo(padLeft, padTop + chartH);
    ctx.closePath();

    const gradCyan = ctx.createLinearGradient(0, padTop, 0, padTop + chartH);
    gradCyan.addColorStop(0, 'rgba(6, 182, 212, 0.25)');
    gradCyan.addColorStop(1, 'rgba(6, 182, 212, 0.0)');
    ctx.fillStyle = gradCyan;
    ctx.fill();

    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    data.forEach((d, idx) => {
      const x = padLeft + idx * stepX;
      const y = padTop + chartH * (1 - d.footTraffic / maxTraffic);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Draw points
    data.forEach((d, idx) => {
      const x = padLeft + idx * stepX;
      const y = padTop + chartH * (1 - d.footTraffic / maxTraffic);
      ctx.fillStyle = '#06b6d4';
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();

    // 2. Draw POS Sales Line (Emerald)
    ctx.save();
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 2;
    ctx.beginPath();
    data.forEach((d, idx) => {
      const x = padLeft + idx * stepX;
      const y = padTop + chartH * (1 - (d.posSalesQty * 1.3) / maxTraffic);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Points
    data.forEach((d, idx) => {
      const x = padLeft + idx * stepX;
      const y = padTop + chartH * (1 - (d.posSalesQty * 1.3) / maxTraffic);
      ctx.fillStyle = '#10b981';
      ctx.beginPath();
      ctx.arc(x, y, 3.5, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();

    // X-Axis Time Labels
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    data.forEach((d, idx) => {
      const x = padLeft + idx * stepX;
      const label = d.time.replace(' (Peak)', '*').replace(' (Current)', '');
      ctx.fillText(label, x, h - padBottom + 20);
    });
  }

  bindEvents() {
    // Reorder buttons in forecast table
    this.container.querySelectorAll('.btn-analytics-reorder').forEach(btn => {
      btn.addEventListener('click', () => {
        soundEffects.playClick();
        const sku = btn.getAttribute('data-sku');
        const name = btn.getAttribute('data-name');
        const price = parseFloat(btn.getAttribute('data-price')) || 4.99;

        const itemObj = {
          sku,
          name,
          category: 'Retail Inventory Restock',
          shelfId: 'Central Warehouse Reserve',
          currentStock: 0,
          unitPrice: price,
          reorderQty: 25,
          status: 'critical',
          supplier: 'Automated Procurement Network'
        };

        if (this.onOpenRestock) {
          this.onOpenRestock(itemObj);
        }
      });
    });
  }
}
