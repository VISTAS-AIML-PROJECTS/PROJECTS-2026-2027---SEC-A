// selfCheckout.js - Smart Customer Self-Checkout (SCO) AI Billing Terminal
// Enables shoppers to purchase items detected by YOLOv11 Computer Vision feeds or Barcode scans.
// Decrements retail inventory, updates store revenue analytics, and prints customer sales tax receipts.

import { inventoryCatalog } from '../data/retailData.js';
import { soundEffects } from '../utils/soundEffects.js';

export class SelfCheckoutModule {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    this.onPurchaseComplete = options.onPurchaseComplete || null;
    this.onTelemetryEvent = options.onTelemetryEvent || null;
    this.onOpenRestock = options.onOpenRestock || null;

    this.cart = [];
    this.activePaymentMethod = 'upi'; // 'upi', 'card', 'cash'
    this.paymentProcessing = false;
    this.appliedPromo = null;

    // Default quick-shelf items available for direct ring-up
    this.availableItems = [
      { id: 'sco-1', name: 'Cold Beverage Can (Soda)', kind: 'Beverage', badge: '🥤 BEVERAGE', price: 2.49, taxRate: 0.05, sku: 'SKU-BEV-101', icon: '🥤' },
      { id: 'sco-2', name: 'Crispy Potato Chips Pouch', kind: 'Chips', badge: '🥔 CHIPS', price: 1.99, taxRate: 0.05, sku: 'SKU-CHP-201', icon: '🥔' },
      { id: 'sco-3', name: 'Spicy Mango Pickle Jar', kind: 'Pickle', badge: '🫙 PICKLE', price: 4.89, taxRate: 0.05, sku: 'SKU-PCK-301', icon: '🫙' },
      { id: 'sco-4', name: 'Butter Cookies Biscuit Roll', kind: 'Biscuits', badge: '🍪 BISCUITS', price: 2.29, taxRate: 0.05, sku: 'SKU-BSC-401', icon: '🍪' },
      { id: 'sco-5', name: 'Herbal Shampoo Bottle (400ml)', kind: 'Shampoo', badge: '🧴 SHAMPOO', price: 8.49, taxRate: 0.18, sku: 'SKU-SHM-501', icon: '🧴' },
      { id: 'sco-6', name: 'Luxury Eau de Parfum Spray', kind: 'Perfume', badge: '🌸 PERFUME', price: 145.00, taxRate: 0.18, sku: 'SKU-PRF-401', icon: '🌸' }
    ];

    this.init();
  }

  init() {
    this.render();
  }

  addItemFromDetection(detectedBox) {
    if (!detectedBox) return;
    const kind = (detectedBox.kind || detectedBox.label || '').toLowerCase();
    let matched = this.availableItems.find(item => 
      item.kind.toLowerCase() === kind || kind.includes(item.kind.toLowerCase())
    );

    if (!matched) {
      matched = {
        id: `sco-det-${Date.now()}`,
        name: detectedBox.label || 'Camera Detected Item',
        kind: detectedBox.kind || 'Retail Product',
        badge: detectedBox.badge || '🏷️ PRODUCT',
        price: parseFloat((detectedBox.price || '$4.99').replace(/[^0-9.]/g, '')) || 4.99,
        taxRate: detectedBox.objectType === 'PERFUME_COSMETICS' ? 0.18 : 0.05,
        sku: detectedBox.sku || `SKU-DET-${Math.floor(1000 + Math.random() * 9000)}`,
        icon: detectedBox.badge ? detectedBox.badge.split(' ')[0] : '📦'
      };
    }

    this.addToCart(matched);
    soundEffects.playDetectChime();

    if (this.onTelemetryEvent) {
      this.onTelemetryEvent({
        source: 'SELF_CHECKOUT_AI',
        type: 'VISION_CART_INGEST',
        message: `YOLOv11 Camera feed auto-added "${matched.name}" ($${matched.price.toFixed(2)}) to Self-Checkout Cart.`,
        data: matched
      });
    }
  }

  addToCart(item) {
    const existing = this.cart.find(c => c.sku === item.sku);
    if (existing) {
      existing.quantity += 1;
    } else {
      this.cart.push({
        ...item,
        quantity: 1
      });
    }
    soundEffects.playClick();
    this.render();
  }

  updateQuantity(sku, delta) {
    soundEffects.playClick();
    const item = this.cart.find(c => c.sku === sku);
    if (!item) return;

    item.quantity += delta;
    if (item.quantity <= 0) {
      this.cart = this.cart.filter(c => c.sku !== sku);
    }
    this.render();
  }

  clearCart() {
    soundEffects.playClick();
    this.cart = [];
    this.appliedPromo = null;
    this.render();
  }

  calculateTotals() {
    let subtotal = 0;
    let totalTax = 0;

    for (const item of this.cart) {
      const itemSubtotal = item.price * item.quantity;
      subtotal += itemSubtotal;
      totalTax += itemSubtotal * item.taxRate;
    }

    let discount = 0;
    if (this.appliedPromo === 'SMART10') {
      discount = subtotal * 0.10;
    }

    const total = Math.max(0, subtotal - discount + totalTax);

    return {
      subtotal: subtotal.toFixed(2),
      discount: discount.toFixed(2),
      tax: totalTax.toFixed(2),
      total: total.toFixed(2),
      itemCount: this.cart.reduce((sum, item) => sum + item.quantity, 0)
    };
  }

  render() {
    if (!this.container) return;

    const totals = this.calculateTotals();

    this.container.innerHTML = `
      <div class="self-checkout-layout">
        <!-- Left Side: Interactive Digital Catalog & Fast Scanner Grid -->
        <div class="sco-catalog-section">
          <div class="sco-banner-card">
            <div class="sco-banner-title">
              <span class="pulsing-radar-badge"><span class="radar-dot"></span> SMART-CART AI CHECKOUT</span>
              <h2>Autonomous Self-Checkout (SCO) Kiosk</h2>
              <p>Customers ring up purchases via <strong>YOLOv11 Vision Ingest</strong>, <strong>Fast Barcode Reader</strong>, or <strong>Touch Terminal</strong>. Instant GST receipt with UPI &amp; Card settlement.</p>
            </div>
            <div class="sco-banner-actions">
              <button type="button" class="btn btn-primary btn-sm" id="btn-sco-sync-vision" title="Ring up the product currently detected by the active camera feed">
                📹 Ingest Last Detected CCTV Product
              </button>
              <button type="button" class="btn btn-outline btn-sm" id="btn-sco-barcode-sim" title="Scan retail barcode from package">
                🔍 Scan Barcode
              </button>
            </div>
          </div>

          <!-- Barcode Quick Input Simulator Bar -->
          <div class="sco-barcode-bar" id="sco-barcode-wrapper" style="display:none;">
            <div class="barcode-input-group">
              <span class="barcode-icon">▮▎█▌</span>
              <input type="text" id="sco-barcode-input" class="custom-input font-mono" placeholder="Scan or enter retail UPC / EAN (e.g. 8901030382910, SKU-BEV-101, SKU-PRF-401)..." />
              <button type="button" class="btn btn-cyan btn-sm" id="btn-sco-barcode-submit">Read SKU</button>
              <button type="button" class="btn btn-outline btn-sm" id="btn-sco-barcode-close">&times;</button>
            </div>
          </div>

          <!-- Fast Touch Product Grid -->
          <div class="sco-grid-header">
            <span class="toolbar-label">TOUCH CATALOG &bull; BROAD PRODUCT KINDS:</span>
            <span class="text-xs text-dim">Tap any product to add to cart</span>
          </div>

          <div class="sco-products-grid">
            ${this.availableItems.map(item => `
              <div class="sco-product-card" data-sku="${item.sku}">
                <div class="sco-card-top">
                  <span class="sco-prod-icon">${item.icon}</span>
                  <span class="badge ${item.taxRate === 0.18 ? 'badge-purple' : 'badge-normal'}">${Math.round(item.taxRate * 100)}% GST</span>
                </div>
                <div class="sco-card-body">
                  <div class="sco-prod-badge">${item.badge}</div>
                  <h4 class="sco-prod-name">${item.name}</h4>
                  <div class="sco-prod-sku font-mono">${item.sku}</div>
                </div>
                <div class="sco-card-footer">
                  <span class="sco-prod-price font-mono font-bold text-cyan">$${item.price.toFixed(2)}</span>
                  <button type="button" class="btn btn-primary btn-xs btn-add-sco-item" data-sku="${item.sku}">
                    + Add to Cart
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Right Side: Live Smart-Cart Ledger & Payment Engine -->
        <div class="sco-cart-section">
          <div class="sco-cart-card">
            <div class="sco-cart-header">
              <div class="cart-title-row">
                <span class="cart-icon">🛒</span>
                <h3>Customer Cart (<span id="cart-item-count">${totals.itemCount}</span> items)</h3>
              </div>
              ${this.cart.length > 0 ? `
                <button type="button" class="btn btn-outline btn-xs" id="btn-sco-clear-cart" title="Clear all items from customer cart">
                  🗑️ Clear
                </button>
              ` : ''}
            </div>

            <!-- Cart Items Scroll List -->
            <div class="sco-cart-items-list">
              ${this.cart.length === 0 ? `
                <div class="sco-cart-empty">
                  <div class="empty-cart-icon">🛒</div>
                  <h4>Cart is Empty</h4>
                  <p>Hold a product up to your webcam, click <strong>"Ingest Last Detected CCTV Product"</strong>, or tap any product tile on the left.</p>
                </div>
              ` : `
                <table class="sco-cart-table">
                  <tbody>
                    ${this.cart.map(item => `
                      <tr class="cart-row">
                        <td class="cart-col-icon">${item.icon}</td>
                        <td class="cart-col-desc">
                          <strong class="cart-item-name">${item.name}</strong>
                          <div class="cart-item-meta font-mono text-dim">
                            ${item.sku} &bull; $${item.price.toFixed(2)} ea
                          </div>
                        </td>
                        <td class="cart-col-qty">
                          <div class="qty-stepper-sm">
                            <button type="button" class="btn-step-sm btn-sco-minus" data-sku="${item.sku}">&minus;</button>
                            <span class="qty-num-sm font-mono">${item.quantity}</span>
                            <button type="button" class="btn-step-sm btn-sco-plus" data-sku="${item.sku}">&#43;</button>
                          </div>
                        </td>
                        <td class="cart-col-total font-mono text-right">
                          $${(item.price * item.quantity).toFixed(2)}
                        </td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              `}
            </div>

            <!-- Promo Code Row -->
            ${this.cart.length > 0 ? `
              <div class="sco-promo-row">
                <input type="text" id="sco-promo-input" class="custom-input font-mono text-xs" placeholder="Promo code (Try SMART10)" value="${this.appliedPromo || ''}" ${this.appliedPromo ? 'disabled' : ''} />
                <button type="button" class="btn btn-outline btn-xs" id="btn-apply-promo">
                  ${this.appliedPromo ? '✓ Applied' : 'Apply'}
                </button>
              </div>
            ` : ''}

            <!-- Subtotals Ledger -->
            <div class="sco-cart-ledger font-mono">
              <div class="ledger-row">
                <span>Subtotal:</span>
                <span>$${totals.subtotal}</span>
              </div>
              ${parseFloat(totals.discount) > 0 ? `
                <div class="ledger-row text-emerald">
                  <span>SmartStore Promo (-10%):</span>
                  <span>-$${totals.discount}</span>
                </div>
              ` : ''}
              <div class="ledger-row">
                <span>Est. Sales Tax / GST:</span>
                <span>+$${totals.tax}</span>
              </div>
              <div class="ledger-row total-row">
                <span>Grand Total:</span>
                <span class="accent-cyan text-lg">$${totals.total}</span>
              </div>
            </div>

            <!-- Payment Method Selector -->
            ${this.cart.length > 0 ? `
              <div class="sco-payment-methods-wrapper">
                <span class="toolbar-label">SELECT PAYMENT MODE:</span>
                <div class="sco-pay-pills">
                  <label class="sco-pay-pill ${this.activePaymentMethod === 'upi' ? 'active' : ''}">
                    <input type="radio" name="sco-pay" value="upi" ${this.activePaymentMethod === 'upi' ? 'checked' : ''} />
                    <span>⚡ UPI QR Code</span>
                  </label>
                  <label class="sco-pay-pill ${this.activePaymentMethod === 'card' ? 'active' : ''}">
                    <input type="radio" name="sco-pay" value="card" ${this.activePaymentMethod === 'card' ? 'checked' : ''} />
                    <span>💳 Chip &amp; Tap Card</span>
                  </label>
                  <label class="sco-pay-pill ${this.activePaymentMethod === 'cash' ? 'active' : ''}">
                    <input type="radio" name="sco-pay" value="cash" ${this.activePaymentMethod === 'cash' ? 'checked' : ''} />
                    <span>💵 Smart Cash POS</span>
                  </label>
                </div>
              </div>

              <!-- Complete Checkout Button -->
              <button type="button" class="btn btn-primary btn-lg btn-block mt-3" id="btn-sco-pay-now">
                💳 Pay $${totals.total} &amp; Print Tax Receipt
              </button>
            ` : ''}
          </div>
        </div>
      </div>

      <!-- Payment & Customer Tax Sales Receipt Modal -->
      <div id="sco-receipt-modal" class="modal-overlay hidden">
        <div class="modal-dialog glass-panel sco-receipt-dialog">
          <div class="modal-header">
            <div class="modal-title-group">
              <span class="modal-icon-badge" style="background: rgba(16, 185, 129, 0.2); border-color: #10b981;">🧾</span>
              <div>
                <h3 class="modal-title">Official Customer Tax Sales Receipt</h3>
                <p class="modal-subtitle font-mono">Smart-Retail Automated POS Settlement &bull; GST Valid</p>
              </div>
            </div>
            <button type="button" class="modal-close-btn" id="btn-close-sco-receipt">&times;</button>
          </div>

          <div class="modal-body" id="sco-receipt-content">
            <!-- Receipt rendered on checkout completion -->
          </div>

          <div class="modal-footer">
            <button type="button" class="btn btn-outline" id="btn-print-sco-receipt">
              🖨️ Print Sales Receipt
            </button>
            <button type="button" class="btn btn-primary" id="btn-finish-sco-receipt">
              ✓ Start New Customer Session
            </button>
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  bindEvents() {
    // Add product button click
    this.container.querySelectorAll('.btn-add-sco-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const sku = btn.getAttribute('data-sku');
        const item = this.availableItems.find(i => i.sku === sku);
        if (item) this.addToCart(item);
      });
    });

    // Stepper plus/minus
    this.container.querySelectorAll('.btn-sco-plus').forEach(btn => {
      btn.addEventListener('click', () => {
        this.updateQuantity(btn.getAttribute('data-sku'), 1);
      });
    });

    this.container.querySelectorAll('.btn-sco-minus').forEach(btn => {
      btn.addEventListener('click', () => {
        this.updateQuantity(btn.getAttribute('data-sku'), -1);
      });
    });

    // Clear Cart
    const btnClear = this.container.querySelector('#btn-sco-clear-cart');
    if (btnClear) {
      btnClear.addEventListener('click', () => this.clearCart());
    }

    // Toggle Barcode Scanner wrapper
    const btnBarcodeSim = this.container.querySelector('#btn-sco-barcode-sim');
    const barcodeWrapper = this.container.querySelector('#sco-barcode-wrapper');
    const btnBarcodeClose = this.container.querySelector('#btn-sco-barcode-close');
    const barcodeInput = this.container.querySelector('#sco-barcode-input');
    const btnBarcodeSubmit = this.container.querySelector('#btn-sco-barcode-submit');

    if (btnBarcodeSim && barcodeWrapper) {
      btnBarcodeSim.addEventListener('click', () => {
        soundEffects.playClick();
        barcodeWrapper.style.display = barcodeWrapper.style.display === 'none' ? 'block' : 'none';
        if (barcodeInput && barcodeWrapper.style.display === 'block') {
          barcodeInput.focus();
        }
      });
    }

    if (btnBarcodeClose && barcodeWrapper) {
      btnBarcodeClose.addEventListener('click', () => {
        barcodeWrapper.style.display = 'none';
      });
    }

    const processBarcode = () => {
      if (!barcodeInput) return;
      const query = barcodeInput.value.trim().toLowerCase();
      if (!query) return;

      const found = this.availableItems.find(i => 
        i.sku.toLowerCase().includes(query) || 
        i.name.toLowerCase().includes(query) ||
        i.kind.toLowerCase().includes(query)
      ) || this.availableItems[Math.floor(Math.random() * this.availableItems.length)];

      this.addToCart(found);
      soundEffects.playDetectChime();
      barcodeInput.value = '';
      if (barcodeWrapper) barcodeWrapper.style.display = 'none';
    };

    if (btnBarcodeSubmit) {
      btnBarcodeSubmit.addEventListener('click', processBarcode);
    }
    if (barcodeInput) {
      barcodeInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') processBarcode();
      });
    }

    // Vision Ingest Button: pull latest detected object from window.app.visionFeed
    const btnSyncVision = this.container.querySelector('#btn-sco-sync-vision');
    if (btnSyncVision) {
      btnSyncVision.addEventListener('click', () => {
        soundEffects.playClick();
        if (window.app && window.app.visionFeed) {
          const currentCam = window.app.visionFeed.currentCam;
          const topBox = (window.app.visionFeed.realtimeWebcamDetections && window.app.visionFeed.realtimeWebcamDetections[0]) ||
                         (window.app.visionFeed.selectedBox) ||
                         (currentCam && currentCam.boundingBoxes[0]);
          if (topBox) {
            this.addItemFromDetection(topBox);
          } else {
            this.addToCart(this.availableItems[0]);
          }
        } else {
          this.addToCart(this.availableItems[0]);
        }
      });
    }

    // Promo code apply
    const btnPromo = this.container.querySelector('#btn-apply-promo');
    const promoInput = this.container.querySelector('#sco-promo-input');
    if (btnPromo && promoInput) {
      btnPromo.addEventListener('click', () => {
        soundEffects.playClick();
        if (promoInput.value.trim().toUpperCase() === 'SMART10') {
          this.appliedPromo = 'SMART10';
          this.render();
        } else {
          alert('Invalid promo code. Try "SMART10" for 10% instant discount!');
        }
      });
    }

    // Payment method selector
    this.container.querySelectorAll('input[name="sco-pay"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        soundEffects.playClick();
        this.activePaymentMethod = e.target.value;
        this.render();
      });
    });

    // Checkout & Print Receipt Button
    const btnPayNow = this.container.querySelector('#btn-sco-pay-now');
    if (btnPayNow) {
      btnPayNow.addEventListener('click', () => this.handleCheckout());
    }

    // Receipt Modal Close / Finish / Print
    const btnCloseReceipt = this.container.querySelector('#btn-close-sco-receipt');
    const btnFinishReceipt = this.container.querySelector('#btn-finish-sco-receipt');
    const btnPrintReceipt = this.container.querySelector('#btn-print-sco-receipt');
    const receiptModal = this.container.querySelector('#sco-receipt-modal');

    if (btnCloseReceipt && receiptModal) {
      btnCloseReceipt.addEventListener('click', () => {
        receiptModal.classList.add('hidden');
        this.clearCart();
      });
    }

    if (btnFinishReceipt && receiptModal) {
      btnFinishReceipt.addEventListener('click', () => {
        soundEffects.playClick();
        receiptModal.classList.add('hidden');
        this.clearCart();
      });
    }

    if (btnPrintReceipt) {
      btnPrintReceipt.addEventListener('click', () => {
        window.print();
      });
    }
  }

  handleCheckout() {
    if (this.cart.length === 0) return;

    soundEffects.playPaymentSuccess();
    const totals = this.calculateTotals();
    const orderNo = `ORD-${Date.now().toString().slice(-6)}`;
    const authCode = `AUTH-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const timestamp = new Date().toLocaleString();

    let payLabel = 'UPI Fast QR (VPA: smartretail@hdfc)';
    if (this.activePaymentMethod === 'card') payLabel = 'Visa / Mastercard Chip & Tap';
    else if (this.activePaymentMethod === 'cash') payLabel = 'Cash Terminal Deposit';

    // Render receipt into modal
    const receiptContent = this.container.querySelector('#sco-receipt-content');
    if (receiptContent) {
      receiptContent.innerHTML = `
        <div class="thermal-receipt font-mono">
          <div class="receipt-header text-center">
            <h2 class="receipt-store-title">SMART-RETAIL STORE #104</h2>
            <p class="receipt-store-sub">Autonomous Computer Vision &bull; Powered by YOLOv11</p>
            <p class="receipt-meta">GSTIN: 29AABCU9603R1ZM | CIN: U74999KA2026PTC109281</p>
            <div class="receipt-divider">================================</div>
            <div class="receipt-order-meta">
              <span>Receipt No: <strong>${orderNo}</strong></span>
              <span>Date: ${timestamp}</span>
              <span>Terminal: SCO-KIOSK-01</span>
              <span>Auth: ${authCode}</span>
            </div>
            <div class="receipt-divider">--------------------------------</div>
          </div>

          <table class="receipt-table">
            <thead>
              <tr>
                <th class="text-left">ITEM</th>
                <th class="text-center">QTY</th>
                <th class="text-right">PRICE</th>
                <th class="text-right">TOTAL</th>
              </tr>
            </thead>
            <tbody>
              ${this.cart.map(item => `
                <tr>
                  <td class="text-left">
                    ${item.name}<br>
                    <small class="text-dim">${item.sku} (${Math.round(item.taxRate * 100)}% GST)</small>
                  </td>
                  <td class="text-center">${item.quantity}</td>
                  <td class="text-right">$${item.price.toFixed(2)}</td>
                  <td class="text-right font-bold">$${(item.price * item.quantity).toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="receipt-divider">--------------------------------</div>
          
          <div class="receipt-totals-block">
            <div class="r-row"><span>SUBTOTAL:</span><span>$${totals.subtotal}</span></div>
            ${parseFloat(totals.discount) > 0 ? `<div class="r-row text-emerald"><span>PROMO DISCOUNT:</span><span>-$${totals.discount}</span></div>` : ''}
            <div class="r-row"><span>EST. GST / VAT:</span><span>$${totals.tax}</span></div>
            <div class="r-row r-grand-total"><span>GRAND TOTAL:</span><span>$${totals.total}</span></div>
            <div class="r-row"><span>PAYMENT METHOD:</span><span>${payLabel}</span></div>
            <div class="r-row"><span>TRANSACTION STATUS:</span><span class="text-emerald font-bold">APPROVED &bull; SETTLED</span></div>
          </div>

          <div class="receipt-divider">================================</div>
          <div class="receipt-footer text-center">
            <div class="receipt-qr-stamp font-mono">
              [QR: VERIFIED-TAX-RECEIPT-${orderNo}]
            </div>
            <p>Thank you for shopping at Smart-Retail!</p>
            <p class="text-xs text-dim">Computer Vision AI verified items. Keep receipt for returns within 14 days.</p>
          </div>
        </div>
      `;
    }

    const modal = this.container.querySelector('#sco-receipt-modal');
    if (modal) modal.classList.remove('hidden');

    // Notify listeners to decrement inventory and increment sales analytics
    if (this.onPurchaseComplete) {
      this.onPurchaseComplete({
        orderNo,
        items: [...this.cart],
        totals,
        payMethod: payLabel,
        timestamp
      });
    }

    if (this.onTelemetryEvent) {
      this.onTelemetryEvent({
        source: 'SELF_CHECKOUT_AI',
        type: 'CUSTOMER_PURCHASE_COMPLETED',
        message: `Self-Checkout Order ${orderNo} Settled: $${totals.total} via ${payLabel} (${totals.itemCount} units).`,
        data: { orderNo, totals, items: this.cart }
      });
    }
  }
}
