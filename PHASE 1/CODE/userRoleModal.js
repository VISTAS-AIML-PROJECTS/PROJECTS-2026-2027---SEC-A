// userRoleModal.js - Role-Based Access Control, Session & User Creation Modal
// Allows creating new User ID & passwords, switching manager roles, and managing security credentials.

import { authManager } from '../data/authManager.js';
import { soundEffects } from '../utils/soundEffects.js';

export class UserRoleModal {
  constructor(options = {}) {
    this.onUserChanged = options.onUserChanged || null;
    this.onTelemetryEvent = options.onTelemetryEvent || null;
    this.createModalDOM();
    this.bindEvents();
  }

  createModalDOM() {
    let modal = document.getElementById('user-role-modal');
    if (modal) return;

    modal = document.createElement('div');
    modal.id = 'user-role-modal';
    modal.className = 'modal-overlay hidden';
    modal.innerHTML = `
      <div class="modal-dialog glass-panel user-dialog" role="dialog" aria-modal="true" aria-labelledby="user-modal-title">
        <div class="modal-header">
          <div class="modal-title-group">
            <span class="modal-icon-badge" style="background: rgba(168, 85, 247, 0.2); border-color: #a855f7;">👤</span>
            <div>
              <h3 class="modal-title" id="user-modal-title">Manager Access &amp; User Credentials</h3>
              <p class="modal-subtitle">Switch active operator session or register a new store manager account</p>
            </div>
          </div>
          <button class="modal-close-btn" id="user-modal-close-btn" aria-label="Close Modal">&times;</button>
        </div>

        <div class="modal-body user-modal-body">
          <div class="user-modal-tabs">
            <button type="button" class="user-tab-btn active" data-tab="tab-user-switch">Switch Active User</button>
            <button type="button" class="user-tab-btn" data-tab="tab-user-create">➕ Create New User ID &amp; Password</button>
          </div>

          <!-- Section 1: Switch Existing User -->
          <div class="user-panel active" id="tab-user-switch">
            <div class="active-user-highlight-card">
              <div class="u-avatar">👤</div>
              <div class="u-info">
                <span class="u-label">CURRENTLY LOGGED IN:</span>
                <h4 class="u-name" id="modal-active-user-name">Harish (Store Lead)</h4>
                <div class="u-tags font-mono">
                  <span class="hud-tag" id="modal-active-user-id">harish_manager</span>
                  <span class="hud-tag protocol-tag" id="modal-active-user-role">Senior Store Operations Manager</span>
                </div>
              </div>
            </div>

            <div class="form-group mt-3">
              <label class="form-label" for="user-select-dropdown">Select Registered Operator Profile:</label>
              <select id="user-select-dropdown" class="custom-select form-input">
                <!-- Populated dynamically -->
              </select>
            </div>

            <div class="user-switch-actions mt-3">
              <button type="button" class="btn btn-primary btn-md" id="btn-confirm-switch-user" style="width: 100%; justify-content: center;">
                🔑 Switch Active Operator Session
              </button>
            </div>
          </div>

          <!-- Section 2: Create New User Account -->
          <div class="user-panel hidden" id="tab-user-create">
            <form id="form-create-new-user" class="user-create-form" onsubmit="return false;">
              <div class="form-row-2">
                <div class="form-group">
                  <label class="form-label" for="new-user-id">Create New User ID: *</label>
                  <input type="text" id="new-user-id" class="form-input font-mono" placeholder="e.g., manager_alex" required />
                  <span class="input-hint">Unique alphanumeric operator handle</span>
                </div>
                <div class="form-group">
                  <label class="form-label" for="new-user-password">Create Password: *</label>
                  <input type="password" id="new-user-password" class="form-input font-mono" placeholder="Min. 4 characters" required />
                  <span class="input-hint">Used for restock authorization</span>
                </div>
              </div>

              <div class="form-row-2">
                <div class="form-group">
                  <label class="form-label" for="new-user-name">Full Operator Name: *</label>
                  <input type="text" id="new-user-name" class="form-input" placeholder="e.g., Alex Carter" required />
                </div>
                <div class="form-group">
                  <label class="form-label" for="new-user-role">Store Role: *</label>
                  <select id="new-user-role" class="custom-select form-input">
                    <option value="Store General Manager">Senior Operations Manager (Full Access)</option>
                    <option value="Floor Inventory Supervisor">Floor Inventory Supervisor (Audit Only)</option>
                    <option value="Procurement Officer">Procurement &amp; Invoices Officer</option>
                    <option value="Surveillance Security Officer">Surveillance Security Officer (View Only)</option>
                  </select>
                </div>
              </div>

              <div class="form-group">
                <label class="form-label" for="new-user-branch">Assigned Branch / Location:</label>
                <input type="text" id="new-user-branch" class="form-input" value="Branch #104 - Aisle Vision Hub" />
              </div>

              <div class="alert-box-status hidden" id="user-create-feedback"></div>

              <div class="form-actions mt-3">
                <button type="submit" class="btn btn-purple btn-md" id="btn-submit-new-user" style="width: 100%; justify-content: center;">
                  ✅ Save &amp; Register Account
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
  }

  bindEvents() {
    const modal = document.getElementById('user-role-modal');
    const closeBtn = document.getElementById('user-modal-close-btn');

    const closeModal = () => modal.classList.add('hidden');
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    // Sub-tab toggling (Switch vs Create)
    const tabBtns = modal.querySelectorAll('.user-tab-btn');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const targetId = btn.getAttribute('data-tab');
        modal.querySelectorAll('.user-panel').forEach(p => {
          p.classList.add('hidden');
          p.classList.remove('active');
        });
        const targetPanel = modal.querySelector(`#${targetId}`);
        if (targetPanel) {
          targetPanel.classList.remove('hidden');
          targetPanel.classList.add('active');
        }
      });
    });

    // Switch User Button
    const btnSwitch = modal.querySelector('#btn-confirm-switch-user');
    const selectDropdown = modal.querySelector('#user-select-dropdown');
    if (btnSwitch && selectDropdown) {
      btnSwitch.addEventListener('click', () => {
        const chosenId = selectDropdown.value;
        const users = authManager.loadUsers();
        const found = users.find(u => u.userId === chosenId);
        if (found) {
          authManager.setActiveUser(found);
          soundEffects.playPaymentSuccess();
          this.refreshActiveUserDisplay();
          if (this.onUserChanged) this.onUserChanged(found);
          if (this.onTelemetryEvent) {
            this.onTelemetryEvent({
              source: 'AUTH_SECURITY',
              type: 'USER_SWITCH',
              message: `Operator session switched to: ${found.fullName} (${found.userId})`,
              data: found
            });
          }
          closeModal();
        }
      });
    }

    // Create New User Form
    const createForm = modal.querySelector('#form-create-new-user');
    if (createForm) {
      createForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const userId = document.getElementById('new-user-id').value;
        const password = document.getElementById('new-user-password').value;
        const fullName = document.getElementById('new-user-name').value;
        const role = document.getElementById('new-user-role').value;
        const branch = document.getElementById('new-user-branch').value;
        const feedback = document.getElementById('user-create-feedback');

        const res = authManager.registerUser({ userId, password, fullName, role, branch });
        if (feedback) {
          feedback.classList.remove('hidden');
          feedback.textContent = res.message;
          feedback.className = `alert-box-status ${res.success ? 'feedback-success' : 'feedback-error'}`;
        }

        if (res.success) {
          soundEffects.playPaymentSuccess();
          this.refreshUserDropdown();
          this.refreshActiveUserDisplay();
          if (this.onUserChanged) this.onUserChanged(res.user);
          if (this.onTelemetryEvent) {
            this.onTelemetryEvent({
              source: 'AUTH_SECURITY',
              type: 'USER_REGISTERED',
              message: `New store operator registered: ${res.user.fullName} [${res.user.userId}]`,
              data: res.user
            });
          }
          setTimeout(() => {
            closeModal();
          }, 1200);
        } else {
          soundEffects.playWarningAlert();
        }
      });
    }
  }

  refreshUserDropdown() {
    const dropdown = document.getElementById('user-select-dropdown');
    if (!dropdown) return;

    const users = authManager.loadUsers();
    const active = authManager.loadActiveUser();

    dropdown.innerHTML = users.map(u => `
      <option value="${u.userId}" ${u.userId === active.userId ? 'selected' : ''}>
        ${u.fullName} (${u.userId}) - ${u.role}
      </option>
    `).join('');
  }

  refreshActiveUserDisplay() {
    const active = authManager.loadActiveUser();
    const nameEl = document.getElementById('modal-active-user-name');
    const idEl = document.getElementById('modal-active-user-id');
    const roleEl = document.getElementById('modal-active-user-role');
    const hdrUserBadge = document.getElementById('hdr-user-badge');

    if (nameEl) nameEl.textContent = active.fullName;
    if (idEl) idEl.textContent = active.userId;
    if (roleEl) roleEl.textContent = active.role;
    if (hdrUserBadge) {
      hdrUserBadge.textContent = active.userId;
      hdrUserBadge.title = `Active Manager: ${active.fullName} (${active.role})`;
    }
  }

  open() {
    const modal = document.getElementById('user-role-modal');
    this.refreshUserDropdown();
    this.refreshActiveUserDisplay();
    const feedback = document.getElementById('user-create-feedback');
    if (feedback) feedback.classList.add('hidden');
    if (modal) modal.classList.remove('hidden');
  }
}
