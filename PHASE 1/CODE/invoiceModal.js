// invoiceModal.js - Official Tax Invoice & Procurement Receipt Viewer
// Generates itemized tax invoices with printable PDF export and persistent archive

export class InvoiceModal {
  constructor(options = {}) {
    this.onTelemetryEvent = options.onTelemetryEvent || null;
    this.storageKey = 'cv_retail_invoices';
    this.currentInvoice = null;
    this.init();
  }

  init() {
    this.createModalDOM();
    this.bindEvents();
  }

  createModalDOM() {
    let modalEl = document.getElementById('invoice-modal-overlay');
    if (modalEl) return;

    modalEl = document.createElement('div');
    modalEl.id = 'invoice-modal-overlay';
    modalEl.className = 'modal-overlay hidden';
    modalEl.innerHTML = `
      <div class="modal-dialog invoice-dialog glass-panel" role="dialog" aria-modal="true" aria-labelledby="invoice-modal-title">
        <div class="modal-header">
          <div class="modal-title-group">
            <span class="modal-icon-badge">📄</span>
            <div>
              <h3 class="modal-title" id="invoice-modal-title">Official Tax Invoice &amp; Procurement Receipt</h3>
              <p class="modal-subtitle">Commercial Purchase Order &bull; GST / Sales Tax Compliant</p>
            </div>
          </div>
          <div class="invoice-header-actions">
            <button class="btn btn-primary btn-sm" id="btn-print-invoice" title="Print or save as PDF">
              🖨️ Print / Save PDF
            </button>
            <button class="modal-close-btn" id="invoice-modal-close" aria-label="Close Modal">&times;</button>
          </div>
        </div>

        <div class="modal-body invoice-printable-body" id="invoice-body-container">
          <!-- Populated dynamically via open(invoiceData) -->
        </div>
      </div>
    `;

    document.body.appendChild(modalEl);
  }

  open(invoiceData) {
    this.currentInvoice = invoiceData;
    this.saveInvoiceToArchive(invoiceData);

    const overlay = document.getElementById('invoice-modal-overlay');
    const body = document.getElementById('invoice-body-container');
    if (!overlay || !body) return;

    this.renderInvoiceHTML(body, invoiceData);
    overlay.classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    if (this.onTelemetryEvent) {
      this.onTelemetryEvent({
        source: 'INVOICE_ENGINE',
        type: 'INVOICE_GENERATED',
        message: `Tax Invoice #${invoiceData.invoiceNo} issued for SKU: ${invoiceData.item.sku} ($${invoiceData.total})`,
        data: { invoiceNo: invoiceData.invoiceNo, total: invoiceData.total }
      });
    }
  }

  close() {
    const overlay = document.getElementById('invoice-modal-overlay');
    if (overlay) {
      overlay.classList.add('hidden');
    }
    document.body.style.overflow = '';
  }

  saveInvoiceToArchive(inv) {
    try {
      const history = this.getInvoiceHistory();
      // Avoid duplicate by invoiceNo
      const exists = history.find(i => i.invoiceNo === inv.invoiceNo);
      if (!exists) {
        history.unshift(inv);
        localStorage.setItem(this.storageKey, JSON.stringify(history.slice(0, 30)));
      }
    } catch (e) {
      console.warn('Failed saving invoice archive', e);
    }
  }

  getInvoiceHistory() {
    try {
      const saved = localStorage.getItem(this.storageKey);
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return [];
  }

  renderInvoiceHTML(container, data) {
    const { invoiceNo, poNumber, item, quantity, total, payMethodName, authorizedUser, timestamp } = data;
    const unitPrice = item.unitPrice || 4.50;
    const subtotal = (unitPrice * quantity).toFixed(2);
    const cgst = (subtotal * 0.025).toFixed(2);
    const sgst = (subtotal * 0.025).toFixed(2);
    const grandTotal = total || (parseFloat(subtotal) + parseFloat(cgst) + parseFloat(sgst)).toFixed(2);

    // HSN code mock based on category
    const hsnCode = item.category && item.category.includes('Dairy') ? '0401 20 00' : '1904 10 90';
    const txnRef = `TXN-${Math.floor(10000000 + Math.random() * 90000000)}`;

    container.innerHTML = `
      <div class="tax-invoice-sheet" id="tax-invoice-print-area">
        <!-- Invoice Header -->
        <div class="inv-sheet-top">
          <div class="inv-brand-col">
            <div class="inv-logo-mark">⚡ SMART RETAIL CV-ANALYTICS</div>
            <h2 class="inv-company-name">Smart Store Operations &amp; Supply Chain Hub</h2>
            <p class="inv-company-addr">
              Aisle Vision Terminal #104 &bull; Central Retail Concourse<br/>
              GSTIN: <strong class="font-mono">33AAACR1245Q1ZS</strong> &bull; PAN: <strong class="font-mono">AAACR1245Q</strong><br/>
              Support: ops-procurement@smartretail.internal
            </p>
          </div>
          <div class="inv-meta-col font-mono">
            <div class="inv-title-badge">TAX INVOICE</div>
            <div class="inv-meta-row">
              <span class="im-label">Invoice No:</span>
              <span class="im-val text-cyan font-bold">${invoiceNo}</span>
            </div>
            <div class="inv-meta-row">
              <span class="im-label">Date &amp; Time:</span>
              <span class="im-val">${timestamp || new Date().toLocaleString()}</span>
            </div>
            <div class="inv-meta-row">
              <span class="im-label">Purchase Order:</span>
              <span class="im-val font-bold">${poNumber}</span>
            </div>
            <div class="inv-meta-row">
              <span class="im-label">Payment Status:</span>
              <span class="im-val text-emerald font-bold">PAID (AUTHORIZED)</span>
            </div>
          </div>
        </div>

        <hr class="inv-divider" />

        <!-- Parties Details Grid -->
        <div class="inv-parties-grid">
          <div class="inv-party-box">
            <span class="party-label">BILLED TO (AUTHORIZED MANAGER):</span>
            <h4 class="party-name">${authorizedUser.fullName || authorizedUser.userId || authorizedUser}</h4>
            <p class="party-details font-mono">
              User ID: <strong>${authorizedUser.userId || authorizedUser}</strong><br/>
              Role: ${authorizedUser.role || 'Senior Store Operations Manager'}<br/>
              Branch: ${authorizedUser.branch || 'Store #104 (Smart Retail)'}<br/>
              Authorization: <strong>256-Bit Credential Verified</strong>
            </p>
          </div>

          <div class="inv-party-box">
            <span class="party-label">SUPPLIER &amp; DISTRIBUTION HUB:</span>
            <h4 class="party-name">${item.supplier || 'Direct Fast-Moving Consumer Goods (FMCG) Supply'}</h4>
            <p class="party-details font-mono">
              Vendor Code: <strong>VND-MILLS-841</strong><br/>
              Shelf Placement: <strong>${item.shelfId || item.category}</strong><br/>
              Delivery SLA: <strong>Next Morning 08:00 AM (Priority Reorder)</strong><br/>
              State Code: <strong>33 (Tamil Nadu / Central Store)</strong>
            </p>
          </div>
        </div>

        <!-- Line Items Table -->
        <div class="inv-table-wrapper">
          <table class="inv-table">
            <thead>
              <tr>
                <th>#</th>
                <th>SKU Code</th>
                <th>Product Description</th>
                <th>HSN Code</th>
                <th>Qty</th>
                <th>Unit Cost</th>
                <th>Taxable Value</th>
                <th>CGST (2.5%)</th>
                <th>SGST (2.5%)</th>
                <th>Total ($)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td class="font-mono">1</td>
                <td class="font-mono text-cyan">${item.sku}</td>
                <td>
                  <strong>${item.name}</strong>
                  <div class="text-dim text-xs">${item.category} &bull; Visual YOLOv11 Shelf Monitored</div>
                </td>
                <td class="font-mono text-dim">${hsnCode}</td>
                <td class="font-mono font-bold">${quantity} units</td>
                <td class="font-mono">$${unitPrice.toFixed(2)}</td>
                <td class="font-mono font-bold">$${subtotal}</td>
                <td class="font-mono text-dim">$${cgst}</td>
                <td class="font-mono text-dim">$${sgst}</td>
                <td class="font-mono font-bold text-emerald">$${grandTotal}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Totals & Payment Summary -->
        <div class="inv-bottom-grid">
          <div class="inv-payment-info font-mono">
            <div class="pay-info-title">PAYMENT RECONCILIATION</div>
            <div class="p-row">
              <span>Payment Mode:</span>
              <strong class="text-white">${payMethodName}</strong>
            </div>
            <div class="p-row">
              <span>Transaction Ref:</span>
              <strong class="text-cyan">${txnRef}</strong>
            </div>
            <div class="p-row">
              <span>CV Detection Sync:</span>
              <span class="text-emerald">YOLOv11 Edge Live Ingest Verified</span>
            </div>
            <p class="p-caption text-dim">
              This invoice is computer-generated upon successful store manager credential authentication. No physical signature is required.
            </p>
          </div>

          <div class="inv-totals-box font-mono">
            <div class="tot-row">
              <span>Taxable Subtotal:</span>
              <strong>$${subtotal}</strong>
            </div>
            <div class="tot-row">
              <span>Central GST (CGST 2.5%):</span>
              <strong>$${cgst}</strong>
            </div>
            <div class="tot-row">
              <span>State GST (SGST 2.5%):</span>
              <strong>$${sgst}</strong>
            </div>
            <div class="tot-row total-highlight">
              <span>Total Invoice Amount:</span>
              <strong class="text-emerald text-lg font-bold">$${grandTotal}</strong>
            </div>
          </div>
        </div>

        <!-- Digital Seal & Footer -->
        <div class="inv-seal-footer">
          <div class="digital-seal font-mono">
            <span class="seal-icon">🛡️</span>
            <div>
              <strong>DIGITALLY AUTHENTICATED BY STORE OPS</strong><br/>
              User ID: ${authorizedUser.userId || authorizedUser} &bull; Timestamp: ${timestamp || new Date().toISOString()}
            </div>
          </div>
          <div class="inv-page-num font-mono text-dim">
            Page 1 of 1 &bull; Powered by YOLOv11 Edge Analytics
          </div>
        </div>
      </div>
    `;
  }

  bindEvents() {
    const overlay = document.getElementById('invoice-modal-overlay');
    const closeBtn = document.getElementById('invoice-modal-close');
    const printBtn = document.getElementById('btn-print-invoice');

    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.close());
    }

    if (printBtn) {
      printBtn.addEventListener('click', () => {
        window.print();
      });
    }

    if (overlay) {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          this.close();
        }
      });
    }
  }
}
