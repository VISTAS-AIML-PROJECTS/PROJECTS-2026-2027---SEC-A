// restockModal.js - Restock Purchase Order, User Registration & Secure Payment Gateway
// Features: Quantity selection, Payment Methods (Card, GPay, Net Banking),
// User Registration / Account Creation, and Tax Invoice Generation.

import { authManager } from '../data/authManager.js';

export class RestockModal {
  constructor(options = {}) {
    this.onSuccess = options.onSuccess || null;
    this.onTelemetryEvent = options.onTelemetryEvent || null;
    this.onOpenInvoice = options.onOpenInvoice || null;
    this.currentItem = null;
    this.quantity = 25;
    this.selectedPaymentMethod = 'card';
    this.authMode = 'login'; // 'login' or 'register'
    this.lastIssuedInvoiceData = null;
    this.init();
  }

  init() {
    this.createModalDOM();
    this.bindEvents();
  }

  createModalDOM() {
    let modalEl = document.getElementById('restock-modal-overlay');
    if (modalEl) return;

    modalEl = document.createElement('div');
    modalEl.id = 'restock-modal-overlay';
    modalEl.className = 'modal-overlay hidden';
    modalEl.innerHTML = `
      <div class="modal-dialog glass-panel" role="dialog" aria-modal="true" aria-labelledby="modal-restock-title">
        <!-- Modal Header -->
        <div class="modal-header">
          <div class="modal-title-group">
            <span class="modal-icon-badge">📦</span>
            <div>
              <h3 class="modal-title" id="modal-restock-title">Procurement Restock &amp; Tax Invoice Gateway</h3>
              <p class="modal-subtitle">Direct Supplier Replenishment &bull; YOLOv11 Inventory Ingest</p>
            </div>
          </div>
          <button class="modal-close-btn" id="modal-close-btn" aria-label="Close Modal">&times;</button>
        </div>

        <!-- Modal Body Content -->
        <div class="modal-body" id="modal-body-container">
          <!-- Dynamically populated via open(item) -->
        </div>
      </div>
    `;

    document.body.appendChild(modalEl);
  }

  open(item) {
    this.currentItem = item;
    this.quantity = item.reorderQty || 25;
    this.selectedPaymentMethod = 'card';
    this.authMode = 'login';

    const overlay = document.getElementById('restock-modal-overlay');
    const body = document.getElementById('modal-body-container');
    if (!overlay || !body) return;

    this.renderForm(body);
    overlay.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  close() {
    const overlay = document.getElementById('restock-modal-overlay');
    if (overlay) {
      overlay.classList.add('hidden');
    }
    document.body.style.overflow = '';
  }

  renderForm(container) {
    const item = this.currentItem;
    const unitPrice = item.unitPrice || 4.50;
    const subtotal = (unitPrice * this.quantity).toFixed(2);
    const tax = (subtotal * 0.05).toFixed(2);
    const grandTotal = (parseFloat(subtotal) + parseFloat(tax)).toFixed(2);
    const activeUser = authManager.loadActiveUser();

    container.innerHTML = `
      <form id="restock-purchase-form" class="restock-form">
        <!-- 1. Product Summary & Quantity Selector -->
        <div class="modal-section-card">
          <div class="item-summary-row">
            <div class="item-meta">
              <span class="badge ${item.status === 'critical' ? 'badge-critical' : 'badge-low'}">
                ${item.status === 'critical' ? 'CRITICAL STOCKOUT GAP' : 'DEPLETION REFILL'}
              </span>
              <h4 class="modal-item-name">${item.name}</h4>
              <span class="modal-item-sku font-mono">${item.sku} &bull; ${item.shelfId || item.category}</span>
              <span class="modal-supplier text-dim">Supplier: <strong>${item.supplier || 'Direct Fast-Moving Consumer Goods Supply'}</strong></span>
            </div>
            <div class="unit-price-box">
              <span class="u-label">Unit Cost</span>
              <span class="u-price font-mono">$${unitPrice.toFixed(2)}</span>
            </div>
          </div>

          <!-- Quantity Stepper -->
          <div class="quantity-selector-box">
            <label class="q-label" for="qty-input">Select Restock Units:</label>
            <div class="qty-stepper">
              <button type="button" class="btn-qty-step" id="qty-minus" aria-label="Decrease quantity">&minus;</button>
              <input type="number" id="qty-input" class="qty-input font-mono" min="5" max="250" value="${this.quantity}" required />
              <button type="button" class="btn-qty-step" id="qty-plus" aria-label="Increase quantity">+</button>
            </div>
            <div class="quick-qty-pills">
              <button type="button" class="qty-pill-btn" data-val="15">+15</button>
              <button type="button" class="qty-pill-btn" data-val="25">+25</button>
              <button type="button" class="qty-pill-btn" data-val="50">+50</button>
              <button type="button" class="qty-pill-btn" data-val="100">+100</button>
            </div>
          </div>

          <!-- Cost Summary -->
          <div class="cost-summary-bar font-mono">
            <div class="cost-col">
              <span class="c-label">Subtotal</span>
              <span class="c-val" id="summary-subtotal">$${subtotal}</span>
            </div>
            <div class="cost-col">
              <span class="c-label">GST / Tax (5%)</span>
              <span class="c-val" id="summary-tax">$${tax}</span>
            </div>
            <div class="cost-col total-col">
              <span class="c-label">Invoice Grand Total</span>
              <span class="c-val text-cyan" id="summary-total">$${grandTotal}</span>
            </div>
          </div>
        </div>

        <!-- 2. Payment Method Selection (Card / GPay / Net Banking) -->
        <div class="modal-section-card">
          <label class="section-badge-label">SELECT PAYMENT METHOD</label>
          <div class="payment-tabs-row" role="radiogroup">
            <label class="payment-tab-option ${this.selectedPaymentMethod === 'card' ? 'selected' : ''}">
              <input type="radio" name="payment_method" value="card" ${this.selectedPaymentMethod === 'card' ? 'checked' : ''} />
              <span class="pay-icon">💳</span>
              <span class="pay-title">Card</span>
              <span class="pay-sub">Credit / Debit</span>
            </label>

            <label class="payment-tab-option ${this.selectedPaymentMethod === 'gpay' ? 'selected' : ''}">
              <input type="radio" name="payment_method" value="gpay" ${this.selectedPaymentMethod === 'gpay' ? 'checked' : ''} />
              <span class="pay-icon">📱</span>
              <span class="pay-title">GPay (UPI)</span>
              <span class="pay-sub">Google Pay</span>
            </label>

            <label class="payment-tab-option ${this.selectedPaymentMethod === 'netbanking' ? 'selected' : ''}">
              <input type="radio" name="payment_method" value="netbanking" ${this.selectedPaymentMethod === 'netbanking' ? 'checked' : ''} />
              <span class="pay-icon">🏦</span>
              <span class="pay-title">Net Banking</span>
              <span class="pay-sub">All Banks</span>
            </label>
          </div>

          <!-- Dynamic Payment Details Form -->
          <div id="payment-fields-container" class="payment-fields-wrapper">
            ${this.renderPaymentMethodFields()}
          </div>
        </div>

        <!-- 3. Mandatory User ID & Password / User Registration Section -->
        <div class="modal-section-card auth-section-card">
          <div class="auth-header">
            <div class="auth-header-left">
              <span class="lock-icon">🔒</span>
              <div>
                <h5 class="auth-title">Store Manager Authorization</h5>
                <p class="auth-sub">Enter credentials or create a new User ID &amp; Password for invoice signing.</p>
              </div>
            </div>

            <!-- Mode Switcher Tabs (Login vs Register) -->
            <div class="auth-mode-switch">
              <button type="button" class="mode-tab-btn ${this.authMode === 'login' ? 'active' : ''}" id="btn-mode-login">
                Existing Login
              </button>
              <button type="button" class="mode-tab-btn ${this.authMode === 'register' ? 'active' : ''}" id="btn-mode-register">
                + Create New User
              </button>
            </div>
          </div>

          <div id="auth-form-fields-container">
            ${this.renderAuthFields(activeUser)}
          </div>

          <div id="auth-error-msg" class="auth-error-box hidden"></div>
        </div>

        <!-- Modal Action Footer -->
        <div class="modal-actions-bar">
          <button type="button" class="btn btn-secondary" id="modal-cancel-btn">Cancel</button>
          <button type="submit" class="btn btn-primary btn-submit-pay" id="modal-submit-pay-btn">
            <span id="btn-pay-text">Authorize &amp; Pay $<span id="btn-pay-amount">${grandTotal}</span></span>
          </button>
        </div>
      </form>
    `;

    this.bindFormDynamicEvents();
  }

  renderAuthFields(activeUser) {
    if (this.authMode === 'register') {
      return `
        <div class="auth-register-grid">
          <div class="form-group">
            <label class="form-label" for="reg-userid">New User ID <span class="required">*</span></label>
            <input type="text" id="reg-userid" class="form-control font-mono" placeholder="e.g. harish_ops" required />
          </div>
          <div class="form-group">
            <label class="form-label" for="reg-fullname">Full Name <span class="required">*</span></label>
            <input type="text" id="reg-fullname" class="form-control" placeholder="e.g. Harish Kumar" required />
          </div>
          <div class="form-group">
            <label class="form-label" for="reg-password">Create Password <span class="required">*</span></label>
            <input type="password" id="reg-password" class="form-control" placeholder="Min 4 characters" minlength="4" required />
          </div>
          <div class="form-group">
            <label class="form-label" for="reg-role">Designation / Role</label>
            <input type="text" id="reg-role" class="form-control" placeholder="e.g. Store Operations Lead" value="Store Operations Manager" />
          </div>
        </div>
      `;
    }

    // Default: Login Form
    return `
      <div class="auth-inputs-grid">
        <div class="form-group">
          <label for="auth-userid" class="form-label">User ID / Manager ID <span class="required">*</span></label>
          <input 
            type="text" 
            id="auth-userid" 
            class="form-control font-mono" 
            placeholder="e.g. harish_manager" 
            required 
            autocomplete="username" 
            value="${activeUser ? activeUser.userId : 'harish_manager'}"
          />
        </div>

        <div class="form-group">
          <label for="auth-password" class="form-label">Manager Password <span class="required">*</span></label>
          <input 
            type="password" 
            id="auth-password" 
            class="form-control" 
            placeholder="Enter password" 
            required 
            autocomplete="current-password" 
            value="${activeUser ? activeUser.password : 'password123'}"
          />
        </div>
      </div>
    `;
  }

  renderPaymentMethodFields() {
    if (this.selectedPaymentMethod === 'card') {
      return `
        <div class="pay-method-panel" id="panel-card">
          <div class="form-group mb-2">
            <label class="form-label">Card Number</label>
            <input type="text" class="form-control font-mono" placeholder="4532 &bull;&bull;&bull;&bull; &bull;&bull;&bull;&bull; 8921" maxlength="19" value="4532 8820 9144 8921" required />
          </div>
          <div class="grid-2-col">
            <div class="form-group">
              <label class="form-label">Expiry (MM/YY)</label>
              <input type="text" class="form-control font-mono" placeholder="MM/YY" maxlength="5" value="08/28" required />
            </div>
            <div class="form-group">
              <label class="form-label">CVV Code</label>
              <input type="password" class="form-control font-mono" placeholder="&bull;&bull;&bull;" maxlength="4" value="784" required />
            </div>
          </div>
          <div class="form-group mt-2">
            <label class="form-label">Cardholder Name</label>
            <input type="text" class="form-control" placeholder="Name on card" value="HARISH - STORE OPS" required />
          </div>
        </div>
      `;
    }

    if (this.selectedPaymentMethod === 'gpay') {
      return `
        <div class="pay-method-panel" id="panel-gpay">
          <div class="form-group mb-2">
            <label class="form-label">Google Pay UPI ID / VPA</label>
            <div class="input-with-badge">
              <input type="text" class="form-control font-mono" placeholder="e.g. retailops@okhdfcbank" value="harish.retail@okaxis" required />
              <span class="upi-verify-badge">VERIFIED</span>
            </div>
          </div>
          <div class="gpay-qr-hint">
            <span class="qr-icon">📱</span>
            <span>A payment verification prompt will be sent to your Google Pay app upon authorization.</span>
          </div>
        </div>
      `;
    }

    if (this.selectedPaymentMethod === 'netbanking') {
      return `
        <div class="pay-method-panel" id="panel-netbanking">
          <div class="form-group mb-2">
            <label class="form-label">Select Net Banking Bank</label>
            <select class="form-control custom-select-styled" required>
              <option value="HDFC">HDFC Bank Corporate Banking</option>
              <option value="SBI">State Bank of India (SBI)</option>
              <option value="ICICI">ICICI Bank Corporate Portal</option>
              <option value="AXIS">Axis Bank Corporate</option>
              <option value="KOTAK">Kotak Mahindra Bank</option>
              <option value="PNB">Punjab National Bank</option>
            </select>
          </div>
          <p class="netbanking-caption">Secure corporate token &amp; dual-signature redirection enabled.</p>
        </div>
      `;
    }

    return '';
  }

  bindFormDynamicEvents() {
    const qtyInput = document.getElementById('qty-input');
    const qtyMinus = document.getElementById('qty-minus');
    const qtyPlus = document.getElementById('qty-plus');

    const updateTotals = (newQty) => {
      this.quantity = Math.max(1, Math.min(500, newQty));
      if (qtyInput) qtyInput.value = this.quantity;

      const unitPrice = this.currentItem.unitPrice || 4.50;
      const sub = (unitPrice * this.quantity).toFixed(2);
      const tax = (sub * 0.05).toFixed(2);
      const tot = (parseFloat(sub) + parseFloat(tax)).toFixed(2);

      const subEl = document.getElementById('summary-subtotal');
      const taxEl = document.getElementById('summary-tax');
      const totEl = document.getElementById('summary-total');
      const btnAmt = document.getElementById('btn-pay-amount');

      if (subEl) subEl.textContent = `$${sub}`;
      if (taxEl) taxEl.textContent = `$${tax}`;
      if (totEl) totEl.textContent = `$${tot}`;
      if (btnAmt) btnAmt.textContent = tot;
    };

    if (qtyMinus) qtyMinus.addEventListener('click', () => updateTotals(this.quantity - 5));
    if (qtyPlus) qtyPlus.addEventListener('click', () => updateTotals(this.quantity + 5));
    if (qtyInput) {
      qtyInput.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        if (!isNaN(val)) updateTotals(val);
      });
    }

    // Quick pills
    document.querySelectorAll('.qty-pill-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const add = parseInt(btn.getAttribute('data-val'), 10);
        updateTotals(this.quantity + add);
      });
    });

    // Payment method tabs
    document.querySelectorAll('input[name="payment_method"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        this.selectedPaymentMethod = e.target.value;
        document.querySelectorAll('.payment-tab-option').forEach(t => t.classList.remove('selected'));
        e.target.closest('.payment-tab-option').classList.add('selected');

        const fieldsContainer = document.getElementById('payment-fields-container');
        if (fieldsContainer) {
          fieldsContainer.innerHTML = this.renderPaymentMethodFields();
        }
      });
    });

    // Auth mode toggle (Login vs Register)
    const btnLogin = document.getElementById('btn-mode-login');
    const btnRegister = document.getElementById('btn-mode-register');
    const authContainer = document.getElementById('auth-form-fields-container');

    if (btnLogin && btnRegister) {
      btnLogin.addEventListener('click', () => {
        this.authMode = 'login';
        btnLogin.classList.add('active');
        btnRegister.classList.remove('active');
        if (authContainer) authContainer.innerHTML = this.renderAuthFields(authManager.loadActiveUser());
      });

      btnRegister.addEventListener('click', () => {
        this.authMode = 'register';
        btnRegister.classList.add('active');
        btnLogin.classList.remove('active');
        if (authContainer) authContainer.innerHTML = this.renderAuthFields();
      });
    }

    // Form submission
    const form = document.getElementById('restock-purchase-form');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handlePaymentSubmission();
      });
    }

    const cancelBtn = document.getElementById('modal-cancel-btn');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => this.close());
    }
  }

  handlePaymentSubmission() {
    const errorBox = document.getElementById('auth-error-msg');
    let authenticatedUser = null;

    if (this.authMode === 'register') {
      const regId = document.getElementById('reg-userid');
      const regName = document.getElementById('reg-fullname');
      const regPass = document.getElementById('reg-password');
      const regRole = document.getElementById('reg-role');

      const userId = regId ? regId.value.trim() : '';
      const fullName = regName ? regName.value.trim() : '';
      const password = regPass ? regPass.value.trim() : '';
      const role = regRole ? regRole.value.trim() : 'Store Operations Manager';

      const regResult = authManager.registerUser({ userId, password, fullName, role });
      if (!regResult.success) {
        if (errorBox) {
          errorBox.textContent = `⚠️ ${regResult.message}`;
          errorBox.classList.remove('hidden');
        }
        return;
      }
      authenticatedUser = regResult.user;
    } else {
      const userIdInput = document.getElementById('auth-userid');
      const passInput = document.getElementById('auth-password');
      const userId = userIdInput ? userIdInput.value.trim() : '';
      const password = passInput ? passInput.value.trim() : '';

      const authResult = authManager.authenticate(userId, password);
      if (!authResult.success) {
        if (errorBox) {
          errorBox.textContent = `⚠️ ${authResult.message}`;
          errorBox.classList.remove('hidden');
        }
        return;
      }
      authenticatedUser = authResult.user;
    }

    if (errorBox) errorBox.classList.add('hidden');

    // Show processing indicator
    const submitBtn = document.getElementById('modal-submit-pay-btn');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `
        <span class="btn-spinner"></span>
        <span>Processing ${this.selectedPaymentMethod.toUpperCase()} &amp; Generating Tax Invoice...</span>
      `;
    }

    setTimeout(() => {
      this.renderReceipt(authenticatedUser);
    }, 800);
  }

  renderReceipt(authorizedUser) {
    const container = document.getElementById('modal-body-container');
    if (!container) return;

    const item = this.currentItem;
    const poNumber = `PO-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    const invoiceNo = `INV-2026-${Math.floor(10000 + Math.random() * 90000)}`;
    const unitPrice = item.unitPrice || 4.50;
    const total = (unitPrice * this.quantity * 1.05).toFixed(2);
    const now = new Date().toLocaleString();

    let payMethodName = 'Credit / Debit Card (Ending in 8921)';
    if (this.selectedPaymentMethod === 'gpay') payMethodName = 'Google Pay (UPI: harish.retail@okaxis)';
    if (this.selectedPaymentMethod === 'netbanking') payMethodName = 'HDFC Corporate Net Banking';

    this.lastIssuedInvoiceData = {
      invoiceNo,
      poNumber,
      item,
      quantity: this.quantity,
      total,
      payMethodName,
      authorizedUser,
      timestamp: now
    };

    container.innerHTML = `
      <div class="receipt-success-card">
        <div class="receipt-icon-ring">
          <span class="check-icon">✓</span>
        </div>
        <h3 class="receipt-title">Payment Authorized &amp; Stock Allocated!</h3>
        <p class="receipt-sub">Tax invoice issued for official procurement accounting.</p>

        <div class="receipt-details-box font-mono">
          <div class="receipt-row">
            <span class="r-label">Tax Invoice No:</span>
            <span class="r-val text-cyan font-bold">${invoiceNo}</span>
          </div>
          <div class="receipt-row">
            <span class="r-label">Purchase Order:</span>
            <span class="r-val font-bold">${poNumber}</span>
          </div>
          <div class="receipt-row">
            <span class="r-label">Product Restocked:</span>
            <span class="r-val text-white font-bold">${item.name}</span>
          </div>
          <div class="receipt-row">
            <span class="r-label">Quantity Ordered:</span>
            <span class="r-val text-emerald font-bold">+${this.quantity} units</span>
          </div>
          <div class="receipt-row">
            <span class="r-label">Total Amount Paid:</span>
            <span class="r-val text-emerald font-bold">$${total}</span>
          </div>
          <div class="receipt-row">
            <span class="r-label">Payment Method:</span>
            <span class="r-val">${payMethodName}</span>
          </div>
          <div class="receipt-row">
            <span class="r-label">Authorized Manager:</span>
            <span class="r-val text-purple font-bold">${authorizedUser.fullName || authorizedUser.userId} (${authorizedUser.userId})</span>
          </div>
        </div>

        <div class="receipt-footer-actions-grid">
          <button type="button" class="btn btn-secondary" id="btn-view-invoice-now">
            📄 View &amp; Print Tax Invoice
          </button>
          <button type="button" class="btn btn-primary" id="btn-finish-receipt">
            ✓ Apply Restock to Live Shelves
          </button>
        </div>
      </div>
    `;

    // Hook View Invoice button
    const invoiceBtn = document.getElementById('btn-view-invoice-now');
    if (invoiceBtn) {
      invoiceBtn.addEventListener('click', () => {
        if (this.onOpenInvoice) {
          this.onOpenInvoice(this.lastIssuedInvoiceData);
        }
      });
    }

    // Hook finish button
    const finishBtn = document.getElementById('btn-finish-receipt');
    if (finishBtn) {
      finishBtn.addEventListener('click', () => {
        item.currentStock = Math.min(item.maxCapacity || 30, (item.currentStock || 0) + this.quantity);
        item.status = 'normal';

        if (this.onSuccess) {
          this.onSuccess({
            item,
            quantity: this.quantity,
            total,
            poNumber,
            invoiceNo,
            authorizedUser,
            payMethodName
          });
        }

        if (this.onTelemetryEvent) {
          this.onTelemetryEvent({
            source: 'RESTOCK_GATEWAY',
            type: 'PAYMENT_AUTHORIZED',
            message: `Invoice #${invoiceNo} / PO #${poNumber} authorized by ${authorizedUser.userId}. Ingested +${this.quantity} units into YOLOv11 inventory.`,
            data: { invoiceNo, poNumber, sku: item.sku, qty: this.quantity, total }
          });
        }

        this.close();
      });
    }
  }

  bindEvents() {
    const overlay = document.getElementById('restock-modal-overlay');
    const closeBtn = document.getElementById('modal-close-btn');

    if (closeBtn) closeBtn.addEventListener('click', () => this.close());
    if (overlay) {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) this.close();
      });
    }
  }
}
