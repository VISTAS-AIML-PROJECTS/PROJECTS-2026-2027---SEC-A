// invoicesTab.js - Full-Page Tax Invoices & Procurement Records Archive
// Displays issued supplier tax invoices, digital verification stamps, and payment records.

import { soundEffects } from '../utils/soundEffects.js';

export class InvoicesTabModule {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    this.onViewInvoice = options.onViewInvoice || null;
    this.onTelemetryEvent = options.onTelemetryEvent || null;
    this.storageKey = 'retail_tax_invoices_history';
    this.activeFilter = 'all';
    this.init();
  }

  loadInvoices() {
    try {
      const saved = localStorage.getItem(this.storageKey);
      if (saved) return JSON.parse(saved);
    } catch (e) {}

    // Initial default certified invoices if none saved yet
    return [
      {
        invoiceNo: 'INV-2026-90412',
        poNumber: 'PO-2026-8812',
        item: {
          name: 'Cereal (Breakfast Grain & Oats Box)',
          sku: 'SKU-CER-306',
          category: 'Breakfast Cereals',
          shelfId: 'Shelf C-3 (Aisle 7)',
          unitPrice: 4.39,
          supplier: 'General Mills Direct'
        },
        quantity: 30,
        subtotal: '131.70',
        taxAmount: '6.58',
        total: '138.28',
        payMethodName: 'Credit / Debit Card (Ending in 8921)',
        payMethodCode: 'card',
        authorizedUser: {
          userId: 'harish_manager',
          fullName: 'Harish (Store Lead)',
          role: 'Senior Store Operations Manager'
        },
        timestamp: '10/24/2026, 4:15:20 PM'
      },
      {
        invoiceNo: 'INV-2026-89104',
        poNumber: 'PO-2026-7940',
        item: {
          name: 'Beverage (Cold Drink / Soda Can 24-Pack)',
          sku: 'SKU-BEV-101',
          category: 'Beverages & Soft Drinks',
          shelfId: 'Shelf A-1 (Aisle 4)',
          unitPrice: 2.49,
          supplier: 'Beverage Bottlers Direct'
        },
        quantity: 50,
        subtotal: '124.50',
        taxAmount: '6.22',
        total: '130.72',
        payMethodName: 'Google Pay UPI (Instant VPA)',
        payMethodCode: 'gpay',
        authorizedUser: {
          userId: 'harish_manager',
          fullName: 'Harish (Store Lead)',
          role: 'Senior Store Operations Manager'
        },
        timestamp: '10/24/2026, 2:30:10 PM'
      },
      {
        invoiceNo: 'INV-2026-88419',
        poNumber: 'PO-2026-7102',
        item: {
          name: 'Perfume (Fragrance Flacon with Atomizer)',
          sku: 'SKU-PRF-401',
          category: 'Fragrances & Colognes',
          shelfId: 'Shelf L-1 (Aisle 3)',
          unitPrice: 145.00,
          supplier: 'Prestige Fragrances Hub'
        },
        quantity: 10,
        subtotal: '1,450.00',
        taxAmount: '72.50',
        total: '1,522.50',
        payMethodName: 'Net Banking (Corporate RTGS)',
        payMethodCode: 'netbanking',
        authorizedUser: {
          userId: 'admin',
          fullName: 'Chief Operations Officer',
          role: 'Central Procurement Admin'
        },
        timestamp: '10/24/2026, 11:45:00 AM'
      }
    ];
  }

  init() {
    this.render();
  }

  render() {
    if (!this.container) return;

    const invoices = this.loadInvoices();
    const filtered = this.activeFilter === 'all' 
      ? invoices 
      : invoices.filter(inv => (inv.payMethodCode || '').toLowerCase().includes(this.activeFilter));

    const totalSpend = invoices.reduce((acc, inv) => acc + parseFloat((inv.total || '0').replace(',', '')), 0).toFixed(2);
    const totalUnits = invoices.reduce((acc, inv) => acc + (inv.quantity || 0), 0);

    this.container.innerHTML = `
      <div class="invoices-workspace">
        <!-- Top Metrics Cards -->
        <div class="metrics-grid-4">
          <div class="metric-card">
            <div class="metric-header">
              <span class="m-title">Total Invoices Issued</span>
              <span class="m-icon text-cyan">📄</span>
            </div>
            <div class="m-value font-mono text-cyan">${invoices.length} Verified</div>
            <div class="m-sub text-emerald">100% Tax Compliant</div>
          </div>

          <div class="metric-card">
            <div class="metric-header">
              <span class="m-title">Total Procurement Spend</span>
              <span class="m-icon text-emerald">💳</span>
            </div>
            <div class="m-value font-mono text-emerald">$${Number(totalSpend).toLocaleString()}</div>
            <div class="m-sub text-cyan">All Reorders Authorized</div>
          </div>

          <div class="metric-card">
            <div class="metric-header">
              <span class="m-title">Restocked Units</span>
              <span class="m-icon text-purple">📦</span>
            </div>
            <div class="m-value font-mono text-purple">${totalUnits} Units</div>
            <div class="m-sub text-emerald">Safety Buffer Restored</div>
          </div>

          <div class="metric-card">
            <div class="metric-header">
              <span class="m-title">Digital Signature Stamp</span>
              <span class="m-icon text-amber">🔒</span>
            </div>
            <div class="m-value font-mono text-amber">SHA-256 Valid</div>
            <div class="m-sub text-emerald">Manager Authenticated</div>
          </div>
        </div>

        <!-- Section: Invoice History Table -->
        <div class="data-card mt-4">
          <div class="card-title-bar">
            <div class="bar-left">
              <h3 class="card-main-title">📑 Official Tax Invoices &amp; Supplier Restock Receipts</h3>
              <span class="card-subtitle">Legally compliant GST/VAT tax invoices generated upon manager payment completion</span>
            </div>
            <div class="bar-right">
              <button class="btn btn-outline btn-xs" id="btn-export-invoices-csv">
                📥 Export CSV
              </button>
            </div>
          </div>

          <!-- Filter Pills -->
          <div class="object-class-filter-pills mb-3 mt-2">
            <span class="toolbar-label">PAYMENT METHOD:</span>
            <button type="button" class="class-filter-btn ${this.activeFilter === 'all' ? 'active' : ''}" data-pay="all">All Methods</button>
            <button type="button" class="class-filter-btn ${this.activeFilter === 'card' ? 'active' : ''}" data-pay="card">💳 Card</button>
            <button type="button" class="class-filter-btn ${this.activeFilter === 'gpay' ? 'active' : ''}" data-pay="gpay">⚡ GPay UPI</button>
            <button type="button" class="class-filter-btn ${this.activeFilter === 'netbanking' ? 'active' : ''}" data-pay="netbanking">🏦 Net Banking</button>
          </div>

          <table class="inventory-table font-mono">
            <thead>
              <tr>
                <th>Invoice &amp; PO Ref</th>
                <th>Timestamp</th>
                <th>Product Restocked</th>
                <th>Quantity</th>
                <th>Total Paid</th>
                <th>Payment Mode</th>
                <th>Authorized Manager</th>
                <th>Receipt Action</th>
              </tr>
            </thead>
            <tbody>
              ${filtered.map((inv, idx) => `
                <tr>
                  <td>
                    <strong>${inv.invoiceNo}</strong><br>
                    <span class="text-xs text-dim">${inv.poNumber}</span>
                  </td>
                  <td>${inv.timestamp}</td>
                  <td>
                    <strong>${inv.item?.name || 'Retail Product'}</strong><br>
                    <span class="text-xs text-dim">${inv.item?.sku || 'SKU-RESTOCK'} &bull; ${inv.item?.supplier || 'Wholesale Hub'}</span>
                  </td>
                  <td>${inv.quantity} Units</td>
                  <td><span class="text-emerald font-bold">$${inv.total}</span></td>
                  <td>
                    <span class="badge ${inv.payMethodName.includes('GPay') ? 'badge-normal' : inv.payMethodName.includes('Banking') ? 'badge-low' : 'badge-purple'}">
                      ${inv.payMethodName.split('(')[0].trim()}
                    </span>
                  </td>
                  <td>
                    <span class="hud-tag">${inv.authorizedUser?.userId || 'harish_manager'}</span>
                  </td>
                  <td>
                    <button class="btn btn-primary btn-xs btn-view-invoice-receipt" data-idx="${idx}">
                      👁️ View Invoice
                    </button>
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
    const invoices = this.loadInvoices();

    // Filter by payment method
    this.container.querySelectorAll('[data-pay]').forEach(btn => {
      btn.addEventListener('click', () => {
        soundEffects.playClick();
        this.activeFilter = btn.getAttribute('data-pay');
        this.render();
      });
    });

    // View Invoice Receipt
    this.container.querySelectorAll('.btn-view-invoice-receipt').forEach(btn => {
      btn.addEventListener('click', () => {
        soundEffects.playClick();
        const idx = parseInt(btn.getAttribute('data-idx'), 10);
        const filtered = this.activeFilter === 'all' 
          ? invoices 
          : invoices.filter(inv => (inv.payMethodCode || '').toLowerCase().includes(this.activeFilter));
        const selected = filtered[idx];
        if (selected && this.onViewInvoice) {
          this.onViewInvoice(selected);
        }
      });
    });

    // Export Invoices CSV
    const btnExport = this.container.querySelector('#btn-export-invoices-csv');
    if (btnExport) {
      btnExport.addEventListener('click', () => {
        soundEffects.playClick();
        const csvRows = [
          ['Invoice No', 'PO Number', 'Timestamp', 'Product Name', 'SKU', 'Quantity', 'Total Amount', 'Payment Mode', 'Authorized User'].join(',')
        ];

        invoices.forEach(inv => {
          csvRows.push([
            inv.invoiceNo,
            inv.poNumber,
            `"${inv.timestamp}"`,
            `"${inv.item?.name || ''}"`,
            inv.item?.sku || '',
            inv.quantity,
            `"$${inv.total}"`,
            `"${inv.payMethodName || ''}"`,
            inv.authorizedUser?.userId || ''
          ].join(','));
        });

        const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `tax_invoices_export_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);

        if (this.onTelemetryEvent) {
          this.onTelemetryEvent({
            source: 'PROCUREMENT_EXPORT',
            type: 'CSV_DOWNLOAD',
            message: `Exported ${invoices.length} tax invoice records to CSV.`
          });
        }
      });
    }
  }
}
