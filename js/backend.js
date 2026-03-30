// backend.js — connects to local backend (for testing) or Railway
const API = 'http://localhost:3000';

async function apiCall(method, path, body) {
  try {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(API + path, opts);
    const data = await res.json();
    return data;
  } catch (err) {
    console.error('API error:', err);
    return { success: false, message: err.message || 'Network error' };
  }
}

// ── LOCAL STORAGE HELPERS ─────────────────────────────────────────────────────
function lsGet(key, fallback = null) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}
function lsSet(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch { } }

// ── AUTH (local, no Firebase) ─────────────────────────────────────────────────
const auth = {
  registerUser(name, email, password) {
    const users = lsGet('fh_users', []);
    if (users.find(u => u.email === email)) return { success: false, message: 'Email already registered' };
    if (password.length < 6) return { success: false, message: 'Password must be 6+ chars' };
    const user = { id: Date.now(), name, email, password, createdAt: new Date().toISOString() };
    users.push(user);
    lsSet('fh_users', users);
    return { success: true, user };
  },
  loginUser(email, password) {
    const users = lsGet('fh_users', []);
    const user = users.find(u => u.email === email && u.password === password);
    if (!user) return { success: false, message: 'Invalid email or password' };
    return { success: true, user };
  },
};

// ── ADMIN AUTH (local SQLite-style via localStorage) ──────────────────────────
const adminAuth = {
  getAll() { return lsGet('fh_admins', [{ id: 1, username: 'admin', password: 'admin123', role: 'admin', isMain: true, status: 'approved', createdAt: new Date().toISOString() }]); },
  save(admins) { lsSet('fh_admins', admins); },

  login(username, password) {
    const admins = this.getAll();
    const admin = admins.find(a => a.username === username && a.password === password);
    if (!admin) return { success: false, message: 'Invalid credentials' };
    if (admin.status === 'pending') return { success: false, message: 'Account pending approval' };
    if (admin.status === 'rejected') return { success: false, message: 'Account rejected' };
    return { success: true, admin };
  },

  register(username, password) {
    const admins = this.getAll();
    if (admins.find(a => a.username === username)) return { success: false, message: 'Username already taken' };
    const newAdmin = { id: Date.now(), username, password, role: 'admin', isMain: false, status: 'pending', createdAt: new Date().toISOString() };
    admins.push(newAdmin);
    this.save(admins);
    return { success: true, message: 'Request submitted. Awaiting main admin approval.' };
  },

  updateStatus(id, status) {
    const admins = this.getAll();
    const idx = admins.findIndex(a => a.id === id);
    if (idx < 0) return { success: false };
    admins[idx].status = status;
    this.save(admins);
    return { success: true };
  },

  remove(id) {
    const admins = this.getAll().filter(a => a.id !== id);
    this.save(admins);
    return { success: true };
  },

  getPending() {
    return { success: true, admins: this.getAll().filter(a => a.status === 'pending') };
  }
};

// ── ORDERS (localStorage as SQLite substitute) ────────────────────────────────
const orders = {
  getAll() { return lsGet('fh_orders', []); },
  save(orders) { lsSet('fh_orders', orders); },

  create(payload) {
    const all = this.getAll();
    const ts = Date.now().toString(36).toUpperCase();
    const orderCode = `ORD-${new Date().getFullYear()}-${ts}-${Math.floor(1000 + Math.random() * 9000)}`;
    const total = payload.items.reduce((s, i) => s + i.price * i.quantity, 0);
    const order = {
      id: orderCode, orderCode,
      date: new Date().toISOString(),
      status: 'Order Placed',
      location: '',
      branch: payload.branch,
      items: payload.items,
      customer: payload.customer || { name: 'Guest', email: 'guest@example.com' },
      total,
      paymentMethod: payload.paymentMethod || 'COD',
      paymentStatus: payload.paymentStatus || 'Pending',
      discount: payload.discount || 0,
      finalTotal: payload.finalTotal || total,
      razorpayOrderId: payload.razorpayOrderId || null,
      razorpayPaymentId: payload.razorpayPaymentId || null,
    };
    all.unshift(order);
    this.save(all);
    return { success: true, order };
  },

  updateStatus(id, status, location) {
    const all = this.getAll();
    const o = all.find(x => x.id === id || x.orderCode === id);
    if (!o) return { success: false };
    o.status = status;
    if (location !== undefined) o.location = location;
    this.save(all);
    return { success: true };
  },

  track(id) {
    const order = this.getAll().find(x => x.id === id || x.orderCode === id);
    return order ? { success: true, order } : { success: false, message: 'Order not found' };
  }
};

// ── PRODUCTS (localStorage + defaults) ───────────────────────────────────────
const products = {
  getAll() { return lsGet('fh_products', null); },
  save(p) { lsSet('fh_products', p); },
  updatePrice(id, price) {
    const ps = this.getAll();
    if (!ps) return { success: false };
    const p = ps.find(x => String(x.id) === String(id));
    if (!p) return { success: false };
    p.price = price; p.displayPrice = `₹${price.toLocaleString()}`;
    this.save(ps);
    return { success: true };
  },
  reduceStock(id, size, qty) {
    const ps = this.getAll();
    if (!ps) return { success: false };
    const p = ps.find(x => String(x.id) === String(id));
    if (p && p.sizes && p.sizes[size]) {
      p.sizes[size].stock = Math.max(0, p.sizes[size].stock - qty);
      this.save(ps);
    }
    return { success: true };
  }
};

// ── PUBLIC BACKEND OBJECT ─────────────────────────────────────────────────────
window.backend = {
  // Auth
  registerUser: (n, e, p) => auth.registerUser(n, e, p),
  loginUser: (e, p) => auth.loginUser(e, p),

  // Admin
  adminLogin: (u, p) => adminAuth.login(u, p),
  registerAdmin: (u, p) => adminAuth.register(u, p),
  getAdmins: () => ({ success: true, admins: adminAuth.getAll() }),
  updateAdminStatus: (id, status) => adminAuth.updateStatus(id, status),
  removeAdmin: (id) => adminAuth.remove(id),
  listPendingAdmins: () => adminAuth.getPending(),

  // Orders
  createOrder: (payload) => orders.create(payload),
  getOrders: () => ({ success: true, orders: orders.getAll() }),
  updateOrderStatus: (id, status, loc) => orders.updateStatus(id, status, loc),
  trackOrder: (id) => orders.track(id),

  // Products
  getProducts: () => {
    const p = products.getAll();
    return p ? { success: true, products: p } : { success: false, products: [] };
  },
  saveProducts: (ps) => { products.save(ps); return { success: true }; },
  updateProductPrice: (id, price) => products.updatePrice(id, price),
  reduceStock: (id, size, qty) => products.reduceStock(id, size, qty),
  addStockNotification: () => ({ success: true }),

  // Health check (Railway backend)
  async checkHealth() {
    return apiCall('GET', '/health');
  },

  // Razorpay integration
  async getRazorpayConfig() {
    return apiCall('GET', '/api/config');
  },

  async createRazorpayOrder(amount) {
    return apiCall('POST', '/api/create-order', { amount });
  },

  async verifyRazorpayPayment(orderId, paymentId, signature) {
    return apiCall('POST', '/api/verify-payment', { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature });
  }
};