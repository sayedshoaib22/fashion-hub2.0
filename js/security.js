// security.js - Simple Security Functions
const Security = {
  async hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password + 'fashion_hub_secret_salt');
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
  },
  async verifyPassword(password, savedHash) {
    return await this.hashPassword(password) === savedHash;
  },
  sanitizeInput(text) {
    if (typeof text !== 'string') return text;
    return text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#x27;');
  },
  isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  },
  rateLimiter: {
    attempts: new Map(),
    checkLimit(username) {
      const now = Date.now();
      const recent = (this.attempts.get(username)||[]).filter(t => now-t < 900000);
      if (recent.length >= 5) return { allowed: false, message: 'Too many attempts. Wait 15 minutes.' };
      return { allowed: true };
    },
    recordAttempt(username) {
      const a = this.attempts.get(username)||[];
      a.push(Date.now()); this.attempts.set(username, a);
    },
    reset(username) { this.attempts.delete(username); }
  },
  createSession(userId, userData) {
    const session = { userId, userData, createdAt: Date.now(), expiresAt: Date.now() + 3600000 };
    sessionStorage.setItem('userSession', JSON.stringify(session));
    return session;
  },
  getSession() {
    const data = sessionStorage.getItem('userSession');
    if (!data) return null;
    const session = JSON.parse(data);
    if (Date.now() > session.expiresAt) { this.clearSession(); return null; }
    return session;
  },
  clearSession() { sessionStorage.removeItem('userSession'); },
  auditLog: { logs: [], log(action, details) { this.logs.push({ time: new Date().toISOString(), action, details }); } }
};
window.Security = Security;
