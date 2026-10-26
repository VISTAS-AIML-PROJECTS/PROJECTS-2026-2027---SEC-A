import { retailCameras, inventoryCatalog } from './data/retailData.js';
import { VisionFeedEngine } from './components/visionFeed.js';
import { RestockModal } from './components/restockModal.js';
import { InvoiceModal } from './components/invoiceModal.js';
import { InventoryAndPosModule } from './components/inventoryAndPos.js';
import { VivaGuideModule } from './components/vivaGuide.js';
import { AnalyticsDashboardModule } from './components/analyticsDashboard.js';
import { InvoicesTabModule } from './components/invoicesTab.js';
import { UserRoleModal } from './components/userRoleModal.js';
import { SelfCheckoutModule } from './components/selfCheckout.js';
import { LossPreventionModule } from './components/lossPrevention.js';
import { reportGenerator } from './utils/reportGenerator.js';
import { soundEffects } from './utils/soundEffects.js';
import { authManager } from './data/authManager.js';

class RetailApp {
  constructor() {
    this.telemetryLogs = [];
    this.activeTab = 'tab-vision';
    this.init();
  }

  init() {
    this.bindNavigation();
    this.bindDrawer();
    this.initModules();
    this.startPeriodicTelemetryHeartbeat();
    this.updateUserBadge();

    // Initial log
    this.logTelemetry({
      source: 'SYNC_FIREBASE',
      type: 'INIT_CONNECTED',
      message: 'Firebase MCP server handshake established. YOLOv11 Edge streams synced to Firestore /retail_telemetry.',
      data: { status: 'ONLINE', latencyMs: 14 }
    });
  }

  initModules() {
    // 1. Tax Invoice Modal
    this.invoiceModal = new InvoiceModal({
      onTelemetryEvent: (event) => this.logTelemetry(event)
    });

    // 2. Role-Based Access Control Modal
    this.userRoleModal = new UserRoleModal({
      onUserChanged: (user) => {
        this.updateUserBadge();
        this.logTelemetry({
          source: 'AUTH_GATEWAY',
          type: 'USER_SWITCH',
          message: `Active operator authenticated as: ${user.fullName} [${user.role}] (${user.branch})`
        });
      }
    });

    // 3. Restock & Secure Payment Gateway Modal
    this.restockModal = new RestockModal({
      onTelemetryEvent: (event) => this.logTelemetry(event),
      onOpenInvoice: (invoiceData) => {
        this.invoiceModal.open(invoiceData);
        if (this.invoicesTab) this.invoicesTab.render();
      },
      onSuccess: (data) => {
        soundEffects.playPaymentSuccess();
        // Apply restock in inventory table
        this.inventoryPos.applyRestockedItem(data.item, data.quantity);
        this.updateUserBadge();
        if (this.invoicesTab) this.invoicesTab.render();
        if (this.analyticsDashboard) this.analyticsDashboard.render();

        // Update camera detection box if present
        retailCameras.forEach(cam => {
          const hit = cam.boundingBoxes.find(b => b.sku === data.item.sku);
          if (hit) {
            hit.stock = Math.min(25, (hit.stock || 0) + data.quantity);
            hit.status = 'normal';
            if (hit.label.includes('OUT OF STOCK')) {
              hit.label = `${data.item.name} (${hit.stock} units)`;
              cam.outOfStockCount = Math.max(0, cam.outOfStockCount - 1);
            }
          }
        });

        // Trigger redraw on vision overlay
        if (this.visionFeed) {
          this.visionFeed.drawOverlays();
          const statStockouts = document.getElementById('stat-stockouts');
          if (statStockouts) {
            statStockouts.textContent = this.visionFeed.currentCam.outOfStockCount;
            statStockouts.className = `stat-num ${this.visionFeed.currentCam.outOfStockCount > 0 ? 'accent-amber' : 'accent-emerald'}`;
          }
        }
      }
    });

    // 4. Vision Feed Engine
    this.visionFeed = new VisionFeedEngine('vision-feed-root', {
      cameras: retailCameras,
      onSelectBox: (box) => {
        this.logTelemetry({
          source: 'EDGE_YOLOV5',
          type: 'BOX_INSPECTED',
          message: `Inspector focused on SKU: ${box.sku} (${box.label}) - Conf: ${Math.round(box.conf * 100)}%`,
          data: box
        });
      },
      onTelemetryEvent: (event) => this.logTelemetry(event),
      onOpenRestock: (item) => this.restockModal.open(item)
    });

    // 5. Shelf Stock & POS Fusion
    this.inventoryPos = new InventoryAndPosModule('inventory-pos-root', {
      onTelemetryEvent: (event) => this.logTelemetry(event),
      onOpenRestock: (item) => this.restockModal.open(item),
      onStockChange: (item) => {
        if (item.status === 'critical') {
          this.logTelemetry({
            source: 'EDGE_YOLOV5',
            type: 'STOCKOUT_TRIGGER',
            message: `CRITICAL ALERT: Stockout detected at ${item.shelfId} for SKU: ${item.sku}`,
            data: item
          });
        }
        if (this.analyticsDashboard) this.analyticsDashboard.render();
      }
    });

    // 6. Customer Smart Self-Checkout (SCO) Kiosk Terminal
    this.selfCheckout = new SelfCheckoutModule('checkout-root', {
      onTelemetryEvent: (e) => this.logTelemetry(e),
      onPurchaseComplete: (order) => {
        // Decrement store shelf stock for each item bought
        order.items.forEach(item => {
          this.inventoryPos.applyCustomerPurchase(item.sku, item.quantity);
        });
        if (this.analyticsDashboard) this.analyticsDashboard.render();
      }
    });

    // 7. CCTV Loss Prevention & Anti-Theft Surveillance Engine
    this.lossPrevention = new LossPreventionModule('security-root', {
      onTelemetryEvent: (e) => this.logTelemetry(e)
    });

    // 8. Store Analytics & Heatmaps Module
    this.analyticsDashboard = new AnalyticsDashboardModule('analytics-root', {
      cameras: retailCameras,
      onOpenRestock: (item) => this.restockModal.open(item),
      onTelemetryEvent: (e) => this.logTelemetry(e)
    });

    // 9. Tax Invoices & Procurement Records Archive
    this.invoicesTab = new InvoicesTabModule('invoices-root', {
      invoiceModal: this.invoiceModal,
      onOpenRestock: () => this.restockModal.open(this.inventoryPos.stockItems[0] || inventoryCatalog[0]),
      onTelemetryEvent: (e) => this.logTelemetry(e)
    });

    // 10. Viva Guide & Academic Presentation
    this.vivaGuide = new VivaGuideModule('viva-guide-root');

    // Header Quick Buttons
    const btnQuickPickup = document.getElementById('hdr-btn-pickup');
    if (btnQuickPickup) {
      btnQuickPickup.addEventListener('click', () => {
        soundEffects.playClick();
        this.inventoryPos.simulateCustomerPickup();
        const tabBtn = document.querySelector('[data-tab="tab-inventory"]');
        if (tabBtn) tabBtn.click();
      });
    }

    const btnQuickViva = document.getElementById('hdr-btn-viva');
    if (btnQuickViva) {
      btnQuickViva.addEventListener('click', () => {
        soundEffects.playClick();
        const tabBtn = document.querySelector('[data-tab="tab-viva"]');
        if (tabBtn) tabBtn.click();
      });
    }

    const btnQuickSco = document.getElementById('hdr-btn-sco');
    if (btnQuickSco) {
      btnQuickSco.addEventListener('click', () => {
        soundEffects.playClick();
        const tabBtn = document.querySelector('[data-tab="tab-checkout"]');
        if (tabBtn) tabBtn.click();
      });
    }

    // Header Sound Effects Toggle Button
    const btnSound = document.getElementById('hdr-btn-sound');
    if (btnSound) {
      btnSound.addEventListener('click', () => {
        const isEnabled = soundEffects.toggle();
        btnSound.textContent = isEnabled ? '🔊 Sound: ON' : '🔇 Sound: OFF';
        btnSound.classList.toggle('btn-primary', isEnabled);
        btnSound.classList.toggle('btn-secondary', !isEnabled);
        if (isEnabled) soundEffects.playDetectChime();
      });
    }

    // Header Daily Store Report Generator Button
    const btnReport = document.getElementById('hdr-btn-report');
    if (btnReport) {
      btnReport.addEventListener('click', () => {
        soundEffects.playClick();
        reportGenerator.generateReport(
          retailCameras,
          this.inventoryPos.stockItems,
          this.invoiceModal.getInvoiceHistory()
        );
      });
    }

    // Manager User Pill Click to Switch or Register Profile
    const userPill = document.getElementById('hdr-user-pill');
    if (userPill) {
      userPill.addEventListener('click', () => {
        soundEffects.playClick();
        this.userRoleModal.open();
      });
    }
  }

  updateUserBadge() {
    const userBadge = document.getElementById('hdr-user-badge');
    const active = authManager.loadActiveUser();
    if (userBadge && active) {
      userBadge.textContent = active.userId;
      userBadge.title = `Active Operator: ${active.fullName} (${active.role}) - Click to Switch or Register`;
    }
  }

  bindNavigation() {
    const tabButtons = document.querySelectorAll('.nav-tab-btn');
    tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        soundEffects.playClick();
        const targetTabId = btn.getAttribute('data-tab');
        if (!targetTabId) return;

        // Update active buttons
        tabButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Update active panels
        document.querySelectorAll('.tab-content-panel').forEach(p => p.classList.remove('active'));
        const targetPanel = document.getElementById(targetTabId);
        if (targetPanel) {
          targetPanel.classList.add('active');
        }

        this.activeTab = targetTabId;

        // Trigger redraws based on tab
        if (targetTabId === 'tab-vision' && this.visionFeed) {
          setTimeout(() => {
            this.visionFeed.drawOverlays();
          }, 100);
        } else if (targetTabId === 'tab-checkout' && this.selfCheckout) {
          this.selfCheckout.render();
        } else if (targetTabId === 'tab-security' && this.lossPrevention) {
          this.lossPrevention.render();
        } else if (targetTabId === 'tab-analytics' && this.analyticsDashboard) {
          setTimeout(() => {
            this.analyticsDashboard.render();
          }, 50);
        } else if (targetTabId === 'tab-invoices' && this.invoicesTab) {
          this.invoicesTab.render();
        }

        this.logTelemetry({
          source: 'DASHBOARD_UI',
          type: 'TAB_NAVIGATE',
          message: `Manager navigated to view: ${btn.textContent.trim()}`
        });
      });
    });
  }

  bindDrawer() {
    const drawer = document.getElementById('telemetry-drawer');
    const header = document.getElementById('drawer-header');
    if (drawer && header) {
      header.addEventListener('click', () => {
        drawer.classList.toggle('collapsed');
      });
    }
  }

  logTelemetry(event) {
    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0] + '.' + String(now.getMilliseconds()).padStart(3, '0');
    const entry = {
      timestamp: timeStr,
      source: event.source || 'EDGE_YOLOV5',
      type: event.type || 'INFO',
      message: event.message || '',
      data: event.data || null
    };

    this.telemetryLogs.unshift(entry);
    if (this.telemetryLogs.length > 50) {
      this.telemetryLogs.pop();
    }

    this.renderTelemetryLogs();
  }

  renderTelemetryLogs() {
    const container = document.getElementById('drawer-log-list');
    if (!container) return;

    container.innerHTML = this.telemetryLogs.slice(0, 15).map(log => `
      <div class="telemetry-log-line">
        <span class="log-time">${log.timestamp}</span>
        <span class="log-source ${log.source}">${log.source}</span>
        <span class="log-msg">${log.message}</span>
      </div>
    `).join('');
  }

  startPeriodicTelemetryHeartbeat() {
    setInterval(() => {
      const actions = [
        {
          source: 'EDGE_YOLOV5',
          message: 'Frame batch analyzed (30 frames). Temporal persistence filter: 0 false positives.'
        },
        {
          source: 'SYNC_FIREBASE',
          message: 'Pushed inventory diff to Firestore: 8 items in sync. RTT latency: 15ms.'
        },
        {
          source: 'EDGE_YOLOV5',
          message: 'CAM 14 (Overhead): 4 active shopper trajectories tracked. Average dwell: 3.6m.'
        }
      ];

      const chosen = actions[Math.floor(Math.random() * actions.length)];
      this.logTelemetry(chosen);
    }, 12000);
  }
}

// Bootstrap on DOM Ready
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    window.app = new RetailApp();
  });
}
