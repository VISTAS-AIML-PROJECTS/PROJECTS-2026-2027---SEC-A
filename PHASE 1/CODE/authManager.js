// authManager.js - User ID, Password Creation & Authentication Management
// Handles user registration, credentials storage, and active session state

export class AuthManager {
  constructor() {
    this.storageKey = 'cv_retail_users';
    this.sessionKey = 'cv_retail_active_user';
    this.users = this.loadUsers();
    this.activeUser = this.loadActiveUser();
  }

  loadUsers() {
    try {
      const saved = localStorage.getItem(this.storageKey);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('Storage unavailable, using defaults', e);
      }
    }

    // Default registered store manager accounts
    return [
      {
        userId: 'harish_manager',
        password: 'password123',
        fullName: 'Harish (Store Lead)',
        role: 'Senior Store Operations Manager',
        branch: 'Branch #104 - Aisle Vision Hub',
        createdAt: '2026-10-01'
      },
      {
        userId: 'admin',
        password: 'admin123',
        fullName: 'Chief Operations Officer',
        role: 'Central Procurement Admin',
        branch: 'Regional HQ - North Division',
        createdAt: '2026-09-15'
      }
    ];
  }

  saveUsers() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.users));
    } catch (e) {
      console.warn('Failed saving users to localStorage', e);
    }
  }

  loadActiveUser() {
    try {
      const saved = localStorage.getItem(this.sessionKey);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('No active session found', e);
      }
    }
    // Default logged in user
    return this.users[0];
  }

  setActiveUser(user) {
    this.activeUser = user;
    try {
      localStorage.setItem(this.sessionKey, JSON.stringify(user));
    } catch (e) {}
  }

  registerUser({ userId, password, fullName, role, branch }) {
    const trimmedId = userId.trim().toLowerCase();
    const existing = this.users.find(u => u.userId.toLowerCase() === trimmedId);
    if (existing) {
      return { success: false, message: `User ID "${userId}" already exists. Please pick another ID.` };
    }

    if (!password || password.length < 4) {
      return { success: false, message: 'Password must be at least 4 characters long.' };
    }

    const newUser = {
      userId: trimmedId,
      password: password.trim(),
      fullName: fullName.trim() || trimmedId,
      role: role || 'Store Inventory Associate',
      branch: branch || 'Store #104 (Smart Retail)',
      createdAt: new Date().toISOString().split('T')[0]
    };

    this.users.push(newUser);
    this.saveUsers();
    this.setActiveUser(newUser);

    return { success: true, user: newUser, message: `User account "${trimmedId}" created successfully!` };
  }

  authenticate(userId, password) {
    const trimmedId = (userId || '').trim().toLowerCase();
    const user = this.users.find(u => u.userId.toLowerCase() === trimmedId);

    if (!user) {
      return { success: false, message: `User ID "${userId}" not found. Please check or register a new account.` };
    }

    if (user.password !== (password || '').trim()) {
      return { success: false, message: 'Invalid password. Please check your credentials.' };
    }

    this.setActiveUser(user);
    return { success: true, user };
  }

  getAllUsers() {
    return this.users;
  }
}

export const authManager = new AuthManager();
