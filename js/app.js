// app.js — Fashion Hub (SQLite backend, with Razorpay payments)

let customSizeTimeout = null;
let searchTimeout = null;

const state = {
  cart: [], wishlist: [], isCartOpen: false, isWishlistOpen: false,
  user: null, selectedCategory: null, currentProduct: null,
  authModalOpen: false, authMode: 'login', adminAuthMode: 'login',
  searchQuery: '', view: 'home',
  isAdminLoggedIn: false, adminUser: null,
  adminOrders: [], adminUsers: [],
  products: [],
  checkoutModalOpen: false, lastOrder: null,
  activeDropdown: null, mobileMenuOpen: false,
  currentSlide: 0, sidebarOpen: false,
  activeSubFilter: null, categoryModalOpen: false, categoryModalData: null,
  details: { size: 'M', color: 'Black', zoom: false, currentPrice: 0, currentImage: null },
  otpModalOpen: false, otpValue: '', otpTimer: 60, generatedOTP: null, pendingUser: null,
  compareList: [], compareModalOpen: false,
  reviewModalOpen: false, reviewProduct: null, reviews: {},
  recentlyViewed: [],
  couponCode: '', appliedCoupon: null,
  notificationsOpen: false,
  notifications: [
    { id: 1, type: 'promo', message: '🎉 New arrivals! Up to 50% off on Men\'s Collection', time: '2 min ago', read: false },
    { id: 2, type: 'offer', message: '🏷️ Use code FASHION20 for 20% off', time: '3 hours ago', read: true },
  ],
  filterPrice: { min: 0, max: 10000 }, sortBy: 'default',
  activeTab: 'orders',
  orderSearch: '', productSearch: '',
  profileModalOpen: false, addressModalOpen: false, savedAddresses: [],
  returnModalOpen: false, returnOrder: null,
  darkMode: false, chatOpen: false, chatMessages: [],
  quickViewProduct: null, quickViewOpen: false,
  analyticsView: 'orders', dateFilter: 'all',
  priceRangeActive: false,
};

// ── INIT ──────────────────────────────────────────────────────────────────────
function initApp() {
  const keys = [
    ['fashionHubCart', 'cart', []],
    ['fashionHubWishlist', 'wishlist', []],
    ['sleepSoundOrders', 'adminOrders', []],
    ['fashionHubReviews', 'reviews', {}],
    ['fashionHubAddresses', 'savedAddresses', []],
    ['fashionHubRecentlyViewed', 'recentlyViewed', []],
  ];
  keys.forEach(([ls, st, fb]) => {
    try { const v = localStorage.getItem(ls); if (v) state[st] = JSON.parse(v); }
    catch { state[st] = fb; }
  });

  const dm = localStorage.getItem('fashionHubDarkMode');
  if (dm === 'true') { state.darkMode = true; document.documentElement.classList.add('dark'); }

  // Load products from backend
  const stored = backend.getProducts();
  if (stored.success && stored.products.length > 0) {
    state.products = stored.products;
    stored.products.forEach(fp => {
      const ei = PRODUCTS.findIndex(p => String(p.id) === String(fp.id));
      if (ei >= 0) PRODUCTS[ei] = { ...PRODUCTS[ei], ...fp };
      else PRODUCTS.push(fp);
    });
    window.PRODUCTS = PRODUCTS;
  } else {
    // First run: seed SQLite from defaults
    backend.saveProducts(PRODUCTS);
    state.products = PRODUCTS;
  }

  // Load orders
  const ord = backend.getOrders();
  if (ord.success) state.adminOrders = ord.orders;

  render();
}

function saveCart() { localStorage.setItem('fashionHubCart', JSON.stringify(state.cart)); }
function saveWishlist() { localStorage.setItem('fashionHubWishlist', JSON.stringify(state.wishlist)); }
function saveOrders() { localStorage.setItem('sleepSoundOrders', JSON.stringify(state.adminOrders)); }
function saveReviews() { localStorage.setItem('fashionHubReviews', JSON.stringify(state.reviews)); }
function saveAddresses() { localStorage.setItem('fashionHubAddresses', JSON.stringify(state.savedAddresses)); }

function saveRecentlyViewed(product) {
  state.recentlyViewed = state.recentlyViewed.filter(p => p.id !== product.id);
  state.recentlyViewed.unshift({ id: product.id, name: product.name, image: product.image, price: product.price, displayPrice: product.displayPrice });
  if (state.recentlyViewed.length > 8) state.recentlyViewed = state.recentlyViewed.slice(0, 8);
  localStorage.setItem('fashionHubRecentlyViewed', JSON.stringify(state.recentlyViewed));
}

// ── COUPONS ───────────────────────────────────────────────────────────────────
const COUPONS = {
  'FASHION20': { type: 'percent', value: 20, minOrder: 500, desc: '20% OFF on orders above ₹500' },
  'FLAT100': { type: 'flat', value: 100, minOrder: 300, desc: '₹100 OFF on orders above ₹300' },
  'WELCOME50': { type: 'percent', value: 50, minOrder: 0, maxDiscount: 250, desc: '50% OFF (max ₹250)' },
};
function applyCoupon() {
  const code = state.couponCode.trim().toUpperCase();
  const coupon = COUPONS[code];
  const total = state.cart.reduce((s, i) => s + i.price * i.quantity, 0);
  if (!coupon) { UIUtils.notification.error('Invalid coupon code'); return; }
  if (total < coupon.minOrder) { UIUtils.notification.error(`Min order ₹${coupon.minOrder} required`); return; }
  state.appliedCoupon = { code, ...coupon };
  UIUtils.notification.success(`Coupon "${code}" applied!`);
  render();
}
function removeCoupon() { state.appliedCoupon = null; state.couponCode = ''; render(); }
function getDiscount(total) {
  if (!state.appliedCoupon) return 0;
  const c = state.appliedCoupon;
  if (c.type === 'percent') { const d = Math.round(total * c.value / 100); return c.maxDiscount ? Math.min(d, c.maxDiscount) : d; }
  if (c.type === 'flat') return Math.min(c.value, total);
  return 0;
}

// ── APP CONTROLLER ────────────────────────────────────────────────────────────
const app = {
  goHome() {
    state.selectedCategory = null; state.currentProduct = null; state.sidebarOpen = false;
    state.activeSubFilter = null; state.searchQuery = ''; state.view = 'home';
    state.sortBy = 'default'; state.priceRangeActive = false;
    window.scrollTo({ top: 0, behavior: 'smooth' }); render();
  },
  selectCategory(category) {
    state.activeDropdown = null;
    if (CATEGORY_MODAL_DATA[category]) {
      state.categoryModalOpen = true; state.categoryModalData = CATEGORY_MODAL_DATA[category];
    } else {
      state.selectedCategory = category; state.currentProduct = null; state.mobileMenuOpen = false;
      state.sidebarOpen = false; state.activeSubFilter = null; state.categoryModalOpen = false;
      state.searchQuery = ''; state.view = 'home'; state.sortBy = 'default';
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    render();
  },
  closeCategoryModal() { state.categoryModalOpen = false; state.categoryModalData = null; render(); },
  selectSubCategory(category) {
    state.selectedCategory = category; state.currentProduct = null; state.categoryModalOpen = false;
    state.categoryModalData = null; state.activeDropdown = null; state.mobileMenuOpen = false;
    state.sidebarOpen = false; state.activeSubFilter = null; state.searchQuery = '';
    state.view = 'home'; window.scrollTo({ top: 0, behavior: 'smooth' }); render();
  },
  selectProductById(productId) {
    const all = state.products.length > 0 ? state.products : PRODUCTS;
    const product = all.find(p => String(p.id) === String(productId));
    if (product) this.selectProduct(product);
  },
  selectProduct(product) {
    state.currentProduct = product;
    state.view = 'home';
    const firstSize = product.sizes ? Object.keys(product.sizes)[0] : 'M';
    const firstColor = product.colors?.[0] || 'Black';
    state.details = { size: firstSize, color: firstColor, zoom: false, currentPrice: product.price, currentImage: product.image };
    this.calculatePrice();
    saveRecentlyViewed(product);
    window.scrollTo({ top: 0, behavior: 'smooth' }); render();
  },
  goToTracking() {
    state.view = 'tracking'; state.currentProduct = null; state.selectedCategory = null;
    state.mobileMenuOpen = false; window.scrollTo({ top: 0, behavior: 'smooth' }); render();
  },
  async trackOrder() {
    const idInput = document.getElementById('trackInput');
    const resultDiv = document.getElementById('trackResult');
    const id = idInput.value.trim();
    if (!id) { alert('Please enter an Order ID'); return; }
    resultDiv.innerHTML = `<div class="mt-8 text-center text-gray-500">Searching…</div>`;
    const res = backend.trackOrder(id);
    if (!res.success || !res.order) {
      resultDiv.innerHTML = `<div class='mt-8 text-center py-8 bg-red-50 rounded-xl border border-red-100'><div class="text-red-500 font-bold">Order Not Found</div><p class="text-sm text-red-400">Check the Order ID and try again.</p></div>`; return;
    }
    const order = res.order;
    const steps = ['Order Placed', 'In Hub', 'Packing', 'Given to Rider', 'Out for Delivery', 'Delivered'];
    const stepIdx = steps.indexOf(order.status);
    resultDiv.innerHTML = `
      <div class='mt-8 text-left border-t border-gray-100 pt-8'>
        <div class='flex flex-col md:flex-row justify-between items-start mb-8 gap-4'>
          <div><h3 class='text-xl font-bold text-gray-900'>Order #${order.orderCode || order.id}</h3><p class='text-sm text-gray-500'>Placed on ${new Date(order.date).toLocaleDateString()}</p></div>
          <div class='text-right'><div class='text-lg font-bold text-[#FF6B35]'>₹${Number(order.total).toLocaleString()}</div><div class='text-sm text-gray-600'>Branch: ${order.branch}</div></div>
        </div>
        <div class='relative px-4'>
          <div class='absolute left-8 top-0 bottom-0 w-0.5 bg-gray-200'></div>
          <div class='space-y-8'>
            ${steps.map((step, idx) => {
      const completed = idx <= stepIdx; const current = idx === stepIdx;
      return `<div class='relative flex items-center gap-6'><div class='w-16 flex justify-center z-10'><div class='w-8 h-8 rounded-full flex items-center justify-center border-2 bg-white ${completed ? 'border-green-500 text-green-500' : 'border-gray-300 text-gray-300'} ${current ? 'ring-4 ring-green-100' : ''}'>${completed ? '✓' : `<span class="text-xs">${idx + 1}</span>`}</div></div><div class='${completed ? 'text-gray-900 font-bold' : 'text-gray-400'}'>${step}${current ? '<span class="ml-2 text-xs bg-orange-100 text-[#FF6B35] px-2 py-0.5 rounded-full">Current</span>' : ''}</div></div>`;
    }).join('')}
          </div>
        </div>
        <div class='mt-8 bg-gray-50 p-6 rounded-xl border border-gray-100'>
          <h4 class='font-bold text-sm text-gray-900 uppercase mb-4'>Order Items</h4>
          ${order.items.map(i => `<div class='flex justify-between items-center text-sm mb-2'><div class="flex items-center gap-3"><div class="w-10 h-10 rounded bg-gray-200 overflow-hidden"><img src="${i.image}" class="w-full h-full object-cover"></div><div><div class="font-medium">${i.name}</div><div class="text-xs text-gray-500">Qty: ${i.quantity}</div></div></div><span class="font-bold">₹${(i.price * i.quantity).toLocaleString()}</span></div>`).join('')}
        </div>
        <div class="mt-4"><button onclick="app.downloadInvoice('${order.orderCode || order.id}')" class="w-full py-2 bg-gray-900 text-white rounded-lg text-sm font-bold">Download Invoice</button></div>
      </div>`;
  },
  goToAdmin() {
    state.view = state.isAdminLoggedIn ? 'admin' : 'adminLogin';
    state.currentProduct = null; state.selectedCategory = null; state.mobileMenuOpen = false;
    state.isCartOpen = false; state.authModalOpen = false; state.checkoutModalOpen = false;
    state.categoryModalOpen = false; state.activeDropdown = null;
    window.scrollTo({ top: 0, behavior: 'smooth' }); render();
  },
  handleSearch(value) {
    state.searchQuery = value;
    if (searchTimeout) clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      if (state.currentProduct) state.currentProduct = null;
      if (state.view !== 'home') state.view = 'home';
      render();
    }, 150);
  },
  toggleCart(isOpen) { state.isCartOpen = isOpen; if (isOpen) state.isWishlistOpen = false; render(); },
  toggleWishlist(isOpen) { state.isWishlistOpen = isOpen; if (isOpen) state.isCartOpen = false; render(); },
  toggleAuth(isOpen, mode = 'login') {
    state.authModalOpen = isOpen; state.authMode = mode;
    if (isOpen) { state.isCartOpen = false; state.mobileMenuOpen = false; state.activeDropdown = null; }
    render();
  },
  toggleAdminAuthMode(mode) { state.adminAuthMode = mode; render(); },
  toggleMobileMenu() { state.mobileMenuOpen = !state.mobileMenuOpen; render(); },
  setDropdown(category) { state.activeDropdown = state.activeDropdown === category ? null : category; render(); },
  setSidebarOpen(isOpen) { state.sidebarOpen = isOpen; render(); },
  setSubFilter(filter) { state.activeSubFilter = state.activeSubFilter === filter ? null : filter; render(); },
  setSlide(index) { state.currentSlide = index; render(); },
  toggleCheckoutModal(isOpen) { state.checkoutModalOpen = isOpen; if (isOpen) state.isCartOpen = false; render(); },
  setSortBy(val) { state.sortBy = val; render(); },
  setDateFilter(val) { state.dateFilter = val; render(); },

  // Wishlist
  toggleWishlistItem(product) {
    const idx = state.wishlist.findIndex(p => p.id === product.id);
    if (idx >= 0) { state.wishlist.splice(idx, 1); UIUtils.notification.info('Removed from wishlist'); }
    else { state.wishlist.push(product); UIUtils.notification.success('Added to wishlist! ❤️'); }
    saveWishlist(); render();
  },
  isInWishlist(productId) { return state.wishlist.some(p => p.id === productId); },
  moveToCart(product) { this.addToCart(product); state.wishlist = state.wishlist.filter(p => p.id !== product.id); saveWishlist(); render(); },
  removeFromWishlist(productId) { state.wishlist = state.wishlist.filter(p => p.id !== productId); saveWishlist(); render(); },

  // Compare
  toggleCompare(product) {
    const idx = state.compareList.findIndex(p => p.id === product.id);
    if (idx >= 0) state.compareList.splice(idx, 1);
    else if (state.compareList.length < 3) { state.compareList.push(product); UIUtils.notification.info('Added to compare'); }
    else UIUtils.notification.warning('Max 3 products');
    render();
  },
  openCompare() { if (state.compareList.length < 2) { UIUtils.notification.warning('Select 2+ products'); return; } state.compareModalOpen = true; render(); },
  closeCompare() { state.compareModalOpen = false; render(); },
  clearCompare() { state.compareList = []; render(); },

  // Quick View
  openQuickView(product) { state.quickViewProduct = product; state.quickViewOpen = true; render(); },
  closeQuickView() { state.quickViewOpen = false; state.quickViewProduct = null; render(); },

  // Notifications
  toggleNotifications() { state.notificationsOpen = !state.notificationsOpen; render(); },
  markAllRead() { state.notifications.forEach(n => n.read = true); render(); },
  clearNotification(id) { state.notifications = state.notifications.filter(n => n.id !== id); render(); },

  // Dark Mode
  toggleDarkMode() {
    state.darkMode = !state.darkMode;
    document.documentElement.classList.toggle('dark', state.darkMode);
    localStorage.setItem('fashionHubDarkMode', state.darkMode);
    render();
  },

  // Reviews
  openReviewModal(product) { state.reviewProduct = product; state.reviewModalOpen = true; render(); },
  closeReviewModal() { state.reviewModalOpen = false; state.reviewProduct = null; render(); },
  submitReview(e) {
    e.preventDefault();
    const form = e.target;
    const productId = state.reviewProduct.id;
    if (!state.reviews[productId]) state.reviews[productId] = [];
    state.reviews[productId].unshift({
      id: Date.now(), rating: parseInt(form.rating.value),
      title: form.title.value.trim(), comment: form.comment.value.trim(),
      user: state.user ? state.user.name : 'Anonymous',
      date: new Date().toLocaleDateString(), verified: !!state.user,
    });
    saveReviews(); this.closeReviewModal(); UIUtils.notification.success('Review submitted! 🙏'); render();
  },
  getAvgRating(productId) {
    const r = state.reviews[productId];
    if (!r || !r.length) return 0;
    return (r.reduce((s, x) => s + x.rating, 0) / r.length).toFixed(1);
  },

  // Profile
  openProfile() { state.profileModalOpen = true; render(); },
  closeProfile() { state.profileModalOpen = false; render(); },
  openAddressModal() { state.addressModalOpen = true; render(); },
  closeAddressModal() { state.addressModalOpen = false; render(); },
  saveAddress(e) {
    e.preventDefault();
    const form = e.target;
    const addr = { id: Date.now(), name: form.name.value, phone: form.phone.value, line1: form.line1.value, city: form.city.value, state: form.addrState.value, pincode: form.pincode.value, isDefault: state.savedAddresses.length === 0 };
    state.savedAddresses.push(addr); saveAddresses(); this.closeAddressModal(); UIUtils.notification.success('Address saved!'); render();
  },
  setDefaultAddress(id) { state.savedAddresses.forEach(a => a.isDefault = a.id === id); saveAddresses(); render(); },
  deleteAddress(id) { state.savedAddresses = state.savedAddresses.filter(a => a.id !== id); saveAddresses(); render(); },

  // Return
  openReturnModal(orderId) { state.returnOrder = state.adminOrders.find(o => o.id === orderId || o.orderCode === orderId); state.returnModalOpen = true; render(); },
  closeReturnModal() { state.returnModalOpen = false; state.returnOrder = null; render(); },
  submitReturn(e) { e.preventDefault(); UIUtils.notification.success('Return request submitted!'); this.closeReturnModal(); },

  // Invoice
  downloadInvoice(orderId) {
    const order = state.adminOrders.find(o => o.id === orderId || o.orderCode === orderId);
    if (!order) { alert('Order not found'); return; }
    const w = window.open('', '_blank');
    w.document.write(generateInvoiceHTML(order)); w.document.close();
    setTimeout(() => w.print(), 500);
  },

  // Chat
  toggleChat() { state.chatOpen = !state.chatOpen; render(); },
  sendChatMessage(msg) {
    if (!msg.trim()) return;
    state.chatMessages.push({ id: Date.now(), text: msg, from: 'user', time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) });
    render();
    setTimeout(() => {
      const responses = ['Hi! How can I help?', 'Sure, I can help with that!', 'Our return policy allows returns within 7 days.', 'Free shipping on orders above ₹999!'];
      state.chatMessages.push({ id: Date.now() + 1, text: responses[Math.floor(Math.random() * responses.length)], from: 'support', time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) });
      render();
    }, 1200);
  },

  // Auth (no Firebase, no OTP)
  registerUser(e) {
    e.preventDefault();
    const name = e.target.name.value, email = e.target.email.value;
    const pass = e.target.password.value, confirm = e.target.confirmPassword.value;
    if (pass !== confirm) return alert('Passwords do not match');
    const res = backend.registerUser(name, email, pass);
    if (!res.success) return alert(res.message);
    state.user = res.user; state.authModalOpen = false;
    UIUtils.notification.success(`Welcome, ${name}! 🎉`); render();
  },
  login(e) {
    e.preventDefault();
    const email = e.target.email.value, pass = e.target.password.value;
    const res = backend.loginUser(email, pass);
    if (!res.success) return alert(res.message);
    state.user = res.user; state.authModalOpen = false;
    UIUtils.notification.success(`Welcome back, ${res.user.name}! 👋`); render();
  },
  logout() {
    state.user = null; state.isAdminLoggedIn = false; state.adminUser = null;
    if (state.view === 'admin') state.view = 'home';
    UIUtils.notification.info('Logged out'); render();
  },

  // Admin Auth
  adminLogin(e) {
    e.preventDefault();
    const username = e.target.username.value.trim(), password = e.target.password.value.trim();
    const res = backend.adminLogin(username, password);
    if (!res.success) { alert(res.message); return; }
    state.adminUser = res.admin; state.isAdminLoggedIn = true;
    this.loadAdminsFromBackend();
    this.loadOrdersFromBackend();
    this.goToAdmin();
  },
  async registerAdmin(e) {
    e.preventDefault();
    const form = e.target;
    const username = form.username.value.trim(), pass = form.password.value.trim(), confirm = form.confirmPassword.value.trim();
    if (pass !== confirm) { alert('Passwords do not match'); return; }
    const res = backend.registerAdmin(username, pass);
    if (!res.success) { alert(res.message); return; }
    alert(res.message); state.adminAuthMode = 'login'; render();
  },
  loadAdminsFromBackend() { const res = backend.getAdmins(); state.adminUsers = res.success ? res.admins : []; render(); },
  loadOrdersFromBackend() { const res = backend.getOrders(); state.adminOrders = res.success ? res.orders : []; render(); },
  refreshAllData() {
    this.loadAdminsFromBackend(); this.loadOrdersFromBackend();
    const ps = backend.getProducts();
    if (ps.success) { state.products = ps.products; window.PRODUCTS = ps.products; }
    UIUtils.notification.success('Data refreshed!'); render();
  },
  approveAdmin(id) {
    if (!confirm('Approve this admin?')) return;
    backend.updateAdminStatus(id, 'approved'); this.loadAdminsFromBackend();
    UIUtils.notification.success('Admin approved!');
    loadPendingAdmins();
  },
  rejectAdmin(id) {
    if (!confirm('Reject?')) return;
    backend.updateAdminStatus(id, 'rejected'); this.loadAdminsFromBackend(); loadPendingAdmins();
  },
  removeAdmin(id) {
    const adm = state.adminUsers.find(a => a.id === id);
    if (!adm) return;
    if (adm.isMain) { alert('Cannot remove main admin.'); return; }
    if (!confirm('Remove this admin?')) return;
    backend.removeAdmin(id); this.loadAdminsFromBackend();
  },
  setAdminTab(tab) { state.activeTab = tab; render(); },

  // Cart
  addToCart(product, options = {}) {
    const sel = { selectedSize: options.selectedSize || 'M', selectedColor: options.selectedColor || product.colors?.[0] || 'Black' };
    const existing = state.cart.find(i => i.id === product.id && (i.selectedSize || 'M') === sel.selectedSize && (i.selectedColor || 'Black') === sel.selectedColor);
    if (existing) { existing.quantity += 1; if (typeof options.price === 'number') existing.price = options.price; }
    else state.cart.push({ ...product, quantity: 1, ...sel, ...options });
    saveCart(); state.isCartOpen = true;
    UIUtils.notification.success('Added to cart! 🛒'); render();
  },
  removeFromCart(index) { state.cart.splice(index, 1); saveCart(); render(); },
  updateQuantity(index, delta) { const item = state.cart[index]; if (item) { item.quantity = Math.max(1, item.quantity + delta); saveCart(); } render(); },
  addToCartById(productId) {
    const all = state.products.length > 0 ? state.products : PRODUCTS;
    const product = all.find(p => String(p.id) === String(productId));
    if (product) this.addToCart(product);
  },
  addToCartCurrent() {
    const { size, color, currentPrice } = state.details;
    this.addToCart({ ...state.currentProduct, price: currentPrice }, { selectedSize: size, selectedColor: color, price: currentPrice });
  },

  // Checkout (with Razorpay support)
  async confirmOrder(e) {
    e.preventDefault();
    const branch = e.target.branch.value;
    const paymentMethod = e.target.paymentMethod.value;
    if (!branch) { alert('Please select a branch'); return; }
    if (!state.cart.length) { alert('Cart is empty'); return; }
    const subtotal = state.cart.reduce((s, i) => s + i.price * i.quantity, 0);
    const discount = getDiscount(subtotal);
    const finalTotal = subtotal - discount;

    if (paymentMethod === 'Razorpay') {
      // Handle Razorpay payment
      await this.handleRazorpayPayment(branch, finalTotal, discount);
    } else {
      // COD order
      const payload = {
        branch, items: state.cart,
        customer: state.user || { name: 'Guest', email: 'guest@example.com' },
        paymentMethod: 'COD', paymentStatus: 'Pending',
        discount, finalTotal,
      };
      const res = backend.createOrder(payload);
      if (!res.success) { alert(res.message || 'Failed to place order'); return; }
      this.completeOrder(res.order);
    }
  },

  async handleRazorpayPayment(branch, finalTotal, discount) {
    try {
      // Get Razorpay config
      const configRes = await backend.getRazorpayConfig();
      if (!configRes.success) {
        alert('Payment configuration error. Please try again.');
        return;
      }

      // Create Razorpay order
      const orderRes = await backend.createRazorpayOrder(finalTotal);
      if (!orderRes.success) {
        alert('Failed to create payment order. Please try again.');
        return;
      }

      const options = {
        key: configRes.razorpayKeyId,
        amount: orderRes.amount,
        currency: orderRes.currency,
        name: 'Fashion Hub',
        description: 'Order Payment',
        order_id: orderRes.id,
        handler: async (response) => {
          // Verify payment
          const verifyRes = await backend.verifyRazorpayPayment(
            response.razorpay_order_id,
            response.razorpay_payment_id,
            response.razorpay_signature
          );

          if (verifyRes.success) {
            // Create order with paid status
            const payload = {
              branch, items: state.cart,
              customer: state.user || { name: 'Guest', email: 'guest@example.com' },
              paymentMethod: 'Razorpay', paymentStatus: 'Paid',
              discount, finalTotal,
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
            };
            const res = backend.createOrder(payload);
            if (res.success) {
              this.completeOrder(res.order);
            } else {
              alert('Order creation failed after payment. Please contact support.');
            }
          } else {
            alert('Payment verification failed. Please contact support.');
          }
        },
        prefill: {
          name: state.user?.name || '',
          email: state.user?.email || '',
          contact: '',
        },
        theme: {
          color: '#FF6B35',
        },
      };

      const rzp = new Razorpay(options);
      rzp.on('payment.failed', (response) => {
        alert('Payment failed. Please try again.');
        console.error('Payment failed:', response.error);
      });
      rzp.open();

    } catch (error) {
      console.error('Razorpay error:', error);
      alert('Payment failed. Please try again.');
    }
  },

  completeOrder(order) {
    // reduce stock
    state.cart.forEach(item => { if (item.selectedSize) backend.reduceStock(item.id, item.selectedSize, item.quantity); });
    state.adminOrders.unshift(order);
    state.cart = []; state.appliedCoupon = null; state.couponCode = '';
    saveCart(); saveOrders();
    state.checkoutModalOpen = false; state.lastOrder = order;
    render();
    setTimeout(() => { UIUtils.notification.success(`Order Placed! ID: ${order.orderCode}`); this.goToTracking(); }, 300);
  },

  // Admin order actions
  updateOrderStatus(orderId, newStatus) {
    backend.updateOrderStatus(orderId, newStatus);
    const order = state.adminOrders.find(o => o.id === orderId || o.orderCode === orderId);
    if (order) { order.status = newStatus; saveOrders(); }
    render();
  },
  updateOrderStatusWithLocation(orderId, newStatus, location) {
    backend.updateOrderStatus(orderId, newStatus, location);
    const order = state.adminOrders.find(o => o.id === orderId || o.orderCode === orderId);
    if (order) { order.status = newStatus; if (location) order.location = location; saveOrders(); }
  },
  savePrice(productId, newPrice) {
    if (!state.adminUser) { alert('Not logged in as admin'); return; }
    const price = parseInt(newPrice);
    if (isNaN(price) || price <= 0) { alert('Invalid price'); return; }
    const res = backend.updateProductPrice(productId, price);
    if (!res.success) { alert('Failed to update price'); return; }
    const prod = PRODUCTS.find(p => String(p.id) === String(productId));
    if (prod) { prod.price = price; prod.displayPrice = `₹${price.toLocaleString()}`; }
    const sp = state.products.find(p => String(p.id) === String(productId));
    if (sp) { sp.price = price; sp.displayPrice = `₹${price.toLocaleString()}`; }
    UIUtils.notification.success('Price updated!'); render();
  },
  exportOrders() {
    const csv = ['Order ID,Customer,Email,Branch,Total,Status,Payment,Date'];
    state.adminOrders.forEach(o => csv.push(`"${o.id}","${o.customer.name}","${o.customer.email}","${o.branch}","₹${o.total}","${o.status}","${o.paymentMethod || 'N/A'}","${new Date(o.date).toLocaleDateString()}"`));
    const blob = new Blob([csv.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `orders_${Date.now()}.csv`; a.click();
    UIUtils.notification.success('Orders exported!');
  },

  // Product detail
  updateDetail(key, value) { state.details[key] = value; this.calculatePrice(); render(); },
  calculatePrice() {
    const product = state.currentProduct; if (!product) return;
    let basePrice = product.price;
    const fp = state.products.find(p => String(p.id) === String(product.id));
    if (fp) basePrice = fp.price;
    const { size } = state.details;
    let finalPrice = basePrice;
    if (product.sizes?.[size]?.price) finalPrice = product.sizes[size].price;
    state.details.currentPrice = Math.round(finalPrice);
  },
};

// ── INVOICE ───────────────────────────────────────────────────────────────────
function generateInvoiceHTML(order) {
  return `<!DOCTYPE html><html><head><title>Invoice #${order.id}</title><style>body{font-family:Arial,sans-serif;max-width:800px;margin:0 auto;padding:20px;color:#333}h1{color:#FF6B35}.items{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#f5f5f5}.total{text-align:right;margin-top:20px;font-size:1.2em}</style></head><body><div style="display:flex;justify-content:space-between;margin-bottom:30px"><div><h1>FASHION HUB</h1><p>Tax Invoice</p></div><div><p><strong>Invoice #:</strong> ${order.id}</p><p><strong>Date:</strong> ${new Date(order.date).toLocaleDateString()}</p></div></div><p><strong>Bill To:</strong> ${order.customer.name} — ${order.customer.email}</p><p>Branch: ${order.branch}</p><br><table class="items"><thead><tr><th>Product</th><th>Size</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead><tbody>${order.items.map(i => `<tr><td>${i.name}</td><td>${i.selectedSize || '-'}</td><td>${i.quantity}</td><td>₹${i.price.toLocaleString()}</td><td>₹${(i.price * i.quantity).toLocaleString()}</td></tr>`).join('')}</tbody></table><div class="total"><p><strong>Total: ₹${order.total.toLocaleString()}</strong></p><p>Payment: ${order.paymentMethod || 'COD'} (${order.paymentStatus || 'Pending'})</p></div><p style="text-align:center;color:#666;margin-top:30px">Thank you for shopping with Fashion Hub!</p></body></html>`;
}

// ── RENDER FUNCTIONS ──────────────────────────────────────────────────────────
function renderHeader() {
  const cartCount = state.cart.reduce((a, b) => a + b.quantity, 0);
  const wishlistCount = state.wishlist.length;
  const unreadNotifs = state.notifications.filter(n => !n.read).length;
  return `
  <header class="sticky top-0 z-50 bg-white shadow-sm">
    <div class="border-b border-gray-100">
      <div class="max-w-7xl mx-auto px-4 md:px-6">
        <div class="flex items-center justify-between h-16">
          <div class="flex items-center cursor-pointer group" onclick="app.goHome()">
            <div class="w-10 h-10 mr-2 text-[#FF6B35]">${ICONS.logoMoon}</div>
            <div class="flex flex-col">
              <span class="text-xl font-bold text-gray-900 tracking-tight leading-none group-hover:text-[#FF6B35] transition-colors">FASHION HUB</span>
              <span class="text-[10px] text-gray-500 font-medium tracking-widest uppercase">Your Style Destination</span>
            </div>
          </div>
          <div class="hidden md:flex flex-1 max-w-xl mx-8">
            <div class="relative w-full">
              <input type="text" value="${state.searchQuery}" oninput="app.handleSearch(this.value)" placeholder="Search products…" class="w-full bg-gray-50 rounded-full pl-5 pr-12 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6B35] border border-gray-200" />
              <button class="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">${ICONS.search}</button>
            </div>
          </div>
          <div class="flex items-center space-x-3 md:space-x-4">
            <button onclick="app.toggleDarkMode()" class="hidden md:flex items-center justify-center w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600">${state.darkMode ? '☀️' : '🌙'}</button>
            <div class="relative">
              <button onclick="app.toggleNotifications()" class="relative flex items-center text-gray-700 hover:text-[#FF6B35] p-1">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                ${unreadNotifs > 0 ? `<span class="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold min-w-[16px] h-4 flex items-center justify-center rounded-full">${unreadNotifs}</span>` : ''}
              </button>
              ${state.notificationsOpen ? renderNotificationsDropdown() : ''}
            </div>
            <button onclick="app.toggleWishlist(true)" class="relative flex items-center text-gray-700 hover:text-[#FF6B35] p-1">
              <svg class="w-6 h-6" fill="${wishlistCount > 0 ? '#FF6B35' : 'none'}" stroke="${wishlistCount > 0 ? '#FF6B35' : 'currentColor'}" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
              ${wishlistCount > 0 ? `<span class="absolute -top-1 -right-1 bg-pink-500 text-white text-[10px] font-bold min-w-[16px] h-4 flex items-center justify-center rounded-full">${wishlistCount}</span>` : ''}
            </button>
            ${state.user ? `
              <div class="flex items-center gap-2">
                <button onclick="app.openProfile()" class="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-[#FF6B35]">
                  <div class="w-8 h-8 bg-[#FF6B35] text-white rounded-full flex items-center justify-center font-bold text-xs">${state.user.name[0].toUpperCase()}</div>
                  <span class="hidden md:block">Hi, ${state.user.name.split(' ')[0]}</span>
                </button>
                <button onclick="app.logout()" class="text-xs text-red-400 hover:text-red-600 font-medium hidden md:block">Logout</button>
              </div>
            ` : `<button onclick="app.toggleAuth(true)" class="text-sm text-gray-700 hover:text-[#FF6B35] font-medium">Login</button>`}
            <button onclick="app.toggleCart(true)" class="relative flex items-center text-gray-700 hover:text-[#FF6B35] p-1">
              ${ICONS.cart}
              ${cartCount > 0 ? `<span class="absolute -top-1 -right-1 bg-[#FF6B35] text-white text-[10px] font-bold min-w-[18px] h-[18px] flex items-center justify-center rounded-full border border-white">${cartCount}</span>` : ''}
            </button>
            <button onclick="app.toggleMobileMenu()" class="md:hidden text-gray-700">${ICONS.menu}</button>
          </div>
        </div>
      </div>
    </div>
    <div class="bg-white border-b border-gray-100 hidden md:block">
      <div class="max-w-7xl mx-auto px-4 md:px-6">
        <nav class="flex items-center space-x-1">
          <button onclick="app.goHome()" class="px-4 py-3 text-sm font-medium text-gray-700 hover:text-[#FF6B35] hover:bg-orange-50 rounded">All</button>
          ${NAV_ITEMS.map(item => `
            <div class="relative group">
              <button onclick="app.setDropdown('${item.category}')" class="px-4 py-3 text-sm font-medium rounded flex items-center gap-1 ${state.activeDropdown === item.category ? 'text-[#FF6B35] bg-orange-50' : 'text-gray-700 hover:text-[#FF6B35] hover:bg-orange-50'}">
                ${item.label}<span class="transform transition-transform ${state.activeDropdown === item.category ? 'rotate-180' : ''}">${ICONS.chevronDown}</span>
              </button>
              ${state.activeDropdown === item.category ? `
                <div class="absolute top-full left-0 bg-white shadow-xl border border-gray-200 rounded-b-lg z-50 w-[700px]" style="top:calc(100% - 1px)">
                  <div class="p-6 grid grid-cols-12 gap-6">
                    <div class="col-span-8 grid grid-cols-3 gap-4">
                      ${item.subItems.map(sub => `<div><h4 class="font-bold text-gray-900 mb-3 text-xs uppercase tracking-wider border-b border-gray-100 pb-2">${sub.label}</h4><ul class="space-y-2">${sub.items.map(link => `<li><button onclick="app.selectCategory('${item.category}')" class="text-sm text-gray-600 hover:text-[#FF6B35] text-left">${link}</button></li>`).join('')}</ul></div>`).join('')}
                    </div>
                    <div class="col-span-4">${item.image ? `<div class="rounded-lg overflow-hidden h-full cursor-pointer" onclick="app.selectCategory('${item.category}')"><img src="${item.image}" class="w-full h-full object-cover hover:scale-105 transition-transform" /></div>` : ''}</div>
                  </div>
                </div>
              ` : ''}
            </div>
          `).join('')}
          ${state.compareList.length > 0 ? `<button onclick="app.openCompare()" class="ml-auto px-4 py-2 bg-blue-50 text-blue-700 rounded-lg text-sm font-bold">Compare (${state.compareList.length})</button>` : ''}
        </nav>
      </div>
    </div>
    <div class="md:hidden border-b border-gray-100 p-3 bg-white">
      <div class="relative"><input type="text" value="${state.searchQuery}" oninput="app.handleSearch(this.value)" placeholder="Search…" class="w-full bg-gray-50 rounded-lg pl-4 pr-10 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#FF6B35]" /><span class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">${ICONS.search}</span></div>
    </div>
    ${state.mobileMenuOpen ? `
      <div class="md:hidden bg-white border-b border-gray-200 absolute w-full z-40 shadow-lg animate-fade-in">
        <nav class="p-4 space-y-2">
          <button onclick="app.goHome();app.toggleMobileMenu()" class="block w-full text-left px-4 py-3 text-gray-700 font-medium hover:bg-orange-50 rounded">Home</button>
          ${NAV_ITEMS.map(item => `<button onclick="app.selectCategory('${item.category}');app.toggleMobileMenu()" class="block w-full text-left px-4 py-3 text-gray-700 font-medium hover:bg-orange-50 rounded">${item.label}</button>`).join('')}
          <button onclick="app.toggleDarkMode()" class="block w-full text-left px-4 py-3 text-gray-700 font-medium hover:bg-orange-50 rounded">${state.darkMode ? '☀️ Light Mode' : '🌙 Dark Mode'}</button>
          ${state.user ? `<button onclick="app.logout()" class="block w-full text-left px-4 py-3 text-red-500 font-medium hover:bg-red-50 rounded">Logout</button>` : `<button onclick="app.toggleAuth(true)" class="block w-full text-left px-4 py-3 text-[#FF6B35] font-bold hover:bg-orange-50 rounded">Login / Register</button>`}
        </nav>
      </div>
    ` : ''}
  </header>`;
}

function renderNotificationsDropdown() {
  return `<div class="absolute top-full right-0 mt-2 w-80 bg-white rounded-xl shadow-2xl border border-gray-100 z-50 animate-fade-in">
    <div class="p-4 border-b border-gray-100 flex justify-between items-center"><span class="font-bold text-gray-900">Notifications</span><button onclick="app.markAllRead()" class="text-xs text-[#FF6B35] hover:underline">Mark all read</button></div>
    <div class="max-h-72 overflow-y-auto">${state.notifications.length === 0 ? '<p class="p-4 text-sm text-gray-500 text-center">No notifications</p>' : state.notifications.map(n => `<div class="p-4 border-b border-gray-50 hover:bg-gray-50 flex gap-3 ${n.read ? 'opacity-60' : ''}"><div class="flex-1"><p class="text-sm text-gray-800">${n.message}</p><p class="text-xs text-gray-400 mt-1">${n.time}</p></div><button onclick="app.clearNotification(${n.id})" class="text-gray-300 hover:text-red-500 text-xs">✕</button></div>`).join('')}</div>
  </div>`;
}

function renderHero() {
  return `<section class="relative w-full h-[500px] md:h-[600px] overflow-hidden bg-gray-900">
    ${SLIDES.map((slide, index) => `
      <div class="absolute inset-0 transition-opacity duration-1000 ${index === state.currentSlide ? 'opacity-100 z-10' : 'opacity-0 z-0'}">
        <img src="${slide.image}" class="w-full h-full object-cover opacity-70" />
        <div class="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent"></div>
        <div class="absolute inset-0 flex items-center">
          <div class="max-w-7xl mx-auto px-4 md:px-6 w-full">
            <div class="max-w-2xl">
              ${slide.offer ? `<div class="inline-block bg-[#FF6B35] text-white px-4 py-1.5 rounded-full text-sm font-bold mb-6">${slide.offer}</div>` : ''}
              <h1 class="text-4xl md:text-6xl font-bold text-white mb-6 leading-tight">${slide.title}</h1>
              <p class="text-lg text-gray-200 mb-8 max-w-lg">${slide.subtitle}</p>
              <button onclick="app.selectCategory('${slide.category}')" class="bg-[#FF6B35] text-white px-8 py-4 rounded-full font-bold text-lg hover:bg-[#e55a2b] transition-all shadow-lg">${slide.cta}</button>
            </div>
          </div>
        </div>
      </div>
    `).join('')}
    <div class="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex space-x-3 z-20">
      ${SLIDES.map((_, i) => `<button onclick="app.setSlide(${i})" class="h-1.5 rounded-full transition-all ${i === state.currentSlide ? 'bg-[#FF6B35] w-8' : 'bg-white/30 w-4'}"></button>`).join('')}
    </div>
  </section>`;
}

function renderCategoryCards() {
  const cats = [
    { name: 'Men', category: 'Men', image: 'https://images.unsplash.com/photo-1490114538077-0a7f8cb49891?auto=format&fit=crop&q=80&w=400' },
    { name: 'Women', category: 'Women', image: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&q=80&w=400' },
    { name: 'Kids', category: 'Kids', image: 'https://images.unsplash.com/photo-1503944583220-79d8926ad5e2?auto=format&fit=crop&q=80&w=400' },
    { name: 'Footwear', category: 'Footwear', image: 'https://images.unsplash.com/photo-1460353581641-37baddab0fa2?auto=format&fit=crop&q=80&w=400' },
    { name: 'Accessories', category: 'Accessories', image: 'https://images.unsplash.com/photo-1492707892479-7bc8d5a4ee93?auto=format&fit=crop&q=80&w=400' },
    { name: 'New Arrivals', category: 'Men', image: 'https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?auto=format&fit=crop&q=80&w=400' }
  ];
  return `<section class="py-16 bg-white"><div class="max-w-7xl mx-auto px-4 md:px-6">
    <h2 class="text-2xl md:text-3xl font-bold mb-10 text-center text-gray-900">Shop By Category</h2>
    <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 md:gap-8">
      ${cats.map(cat => `<div onclick="app.selectCategory('${cat.category}')" class="group cursor-pointer">
        <div class="relative aspect-square bg-gray-100 rounded-2xl overflow-hidden shadow-sm group-hover:shadow-xl transition-all mb-4">
          <img src="${cat.image}" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" loading="lazy" />
        </div>
        <h3 class="text-sm md:text-base font-semibold text-gray-900 text-center group-hover:text-[#FF6B35] transition-colors">${cat.name}</h3>
      </div>`).join('')}
    </div>
  </div></section>`;
}

function renderBadges() {
  return `<div class="bg-gray-50 py-12 border-y border-gray-100"><div class="max-w-7xl mx-auto px-4 md:px-6 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
    ${[{ icon: '↩️', title: 'Easy Returns', sub: '7 days return policy' }, { icon: '🚚', title: 'Free Delivery', sub: 'On orders above ₹999' }, { icon: '✅', title: '100% Authentic', sub: 'Quality guaranteed' }, { icon: '📦', title: 'Cash on Delivery', sub: 'Pay when you receive' }].map(b => `<div class="flex flex-col items-center group"><div class="text-3xl mb-4">${b.icon}</div><h4 class="font-bold text-gray-900 mb-1">${b.title}</h4><p class="text-sm text-gray-500">${b.sub}</p></div>`).join('')}
  </div></div>`;
}

function renderProductList() {
  const searchLower = state.searchQuery.toLowerCase();
  const products = state.products.length > 0 ? state.products : PRODUCTS;
  let filtered = products.filter(p => {
    if (searchLower && !p.name.toLowerCase().includes(searchLower) && !p.category.toLowerCase().includes(searchLower)) return false;
    if (state.selectedCategory && p.category !== state.selectedCategory) return false;
    if (state.activeSubFilter && p.subCategory !== state.activeSubFilter) return false;
    if (state.priceRangeActive && (p.price < state.filterPrice.min || p.price > state.filterPrice.max)) return false;
    return true;
  });
  if (state.sortBy === 'price_asc') filtered = [...filtered].sort((a, b) => a.price - b.price);
  else if (state.sortBy === 'price_desc') filtered = [...filtered].sort((a, b) => b.price - a.price);
  else if (state.sortBy === 'name_asc') filtered = [...filtered].sort((a, b) => a.name.localeCompare(b.name));
  const currentNav = NAV_ITEMS.find(n => n.category === state.selectedCategory);
  return `<section class="bg-gray-50 py-12 min-h-screen"><div class="max-w-7xl mx-auto px-4 md:px-6">
    <div class="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
      <div>
        <h2 class="text-3xl font-bold text-gray-900 mb-2">${state.searchQuery ? `Results for "${state.searchQuery}"` : state.selectedCategory ? `${state.selectedCategory} Collection` : 'Our Bestsellers'}</h2>
        <p class="text-gray-500">${filtered.length} Products</p>
      </div>
      <div class="flex items-center gap-3">
        <select onchange="app.setSortBy(this.value)" class="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-[#FF6B35] outline-none bg-white">
          <option value="default">Sort: Default</option>
          <option value="price_asc">Price: Low to High</option>
          <option value="price_desc">Price: High to Low</option>
          <option value="name_asc">Name: A–Z</option>
        </select>
      </div>
    </div>
    <div class="flex flex-col md:flex-row gap-8">
      ${state.selectedCategory ? `<aside class="md:w-64 flex-shrink-0"><div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sticky top-24">
        <div class="flex justify-between items-center mb-6"><h3 class="font-bold text-gray-900">Filters</h3><button onclick="app.setSortBy('default');state.priceRangeActive=false;render()" class="text-xs text-[#FF6B35]">Clear</button></div>
        <div class="mb-6"><h4 class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Price Range</h4>
          ${[{ label: 'Under ₹500', min: 0, max: 500 }, { label: '₹500–₹1000', min: 500, max: 1000 }, { label: '₹1000–₹2000', min: 1000, max: 2000 }, { label: 'Above ₹2000', min: 2000, max: 100000 }].map(r => `<button onclick="state.filterPrice={min:${r.min},max:${r.max}};state.priceRangeActive=true;render()" class="text-sm text-left w-full flex items-center gap-2 px-2 py-1 rounded hover:bg-orange-50 mb-1"><div class="w-4 h-4 rounded border flex items-center justify-center ${state.priceRangeActive && state.filterPrice.min === r.min ? 'bg-[#FF6B35] border-[#FF6B35]' : 'border-gray-300'}"></div><span class="text-gray-600">${r.label}</span></button>`).join('')}
        </div>
        ${currentNav ? currentNav.subItems.map(group => `<div class="mb-4"><h4 class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">${group.label}</h4><ul class="space-y-1">${group.items.map(item => `<li><button onclick="app.setSubFilter('${item}')" class="text-sm text-left w-full flex items-center gap-2 px-2 py-1 rounded hover:bg-orange-50"><div class="w-4 h-4 rounded border flex items-center justify-center ${state.activeSubFilter === item ? 'bg-[#FF6B35] border-[#FF6B35]' : 'border-gray-300'}"></div><span class="text-gray-600">${item}</span></button></li>`).join('')}</ul></div>`).join('') : ''}
      </div></aside>` : ''}
      <div class="flex-1">
        ${filtered.length === 0 ? `<div class="text-center py-24 bg-white rounded-2xl border border-dashed border-gray-200"><p class="text-lg font-medium text-gray-900">No products found.</p><button onclick="app.goHome()" class="text-[#FF6B35] hover:underline mt-4 block">Clear filters</button></div>` : `
        <div class="grid grid-cols-1 sm:grid-cols-2 ${state.selectedCategory ? 'lg:grid-cols-3' : 'lg:grid-cols-4'} gap-6">
          ${filtered.map(product => {
    const discount = product.originalPrice ? Math.round((1 - product.price / parseInt(product.originalPrice.replace(/[₹,]/g, ''))) * 100) : 0;
    const avgRating = app.getAvgRating(product.id);
    const inWishlist = app.isInWishlist(product.id);
    const inCompare = state.compareList.some(p => p.id === product.id);
    return `<div class="group bg-white rounded-2xl overflow-hidden border border-gray-100 hover:shadow-xl transition-all duration-300 flex flex-col transform hover:-translate-y-1 relative">
              <div class="relative aspect-[4/3] bg-gray-100 overflow-hidden cursor-pointer" onclick="app.selectProductById(${product.id})">
                <img src="${product.image}" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" loading="lazy" />
                ${product.badge ? `<div class="absolute top-3 left-3 bg-[#FF6B35] text-white px-3 py-1 rounded-full text-xs font-bold">${product.badge}</div>` : ''}
                ${discount > 0 ? `<div class="absolute top-3 right-3 bg-green-500 text-white px-2 py-1 rounded-full text-xs font-bold">-${discount}%</div>` : ''}
                <div class="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/60 to-transparent translate-y-full group-hover:translate-y-0 transition-transform duration-300 flex gap-2 justify-center">
                  <button onclick="event.stopPropagation();app.addToCartById(${product.id})" class="bg-[#FF6B35] text-white font-bold py-2 px-4 rounded-full text-xs">Add to Cart</button>
                  <button onclick="event.stopPropagation();app.openQuickView(${JSON.stringify(product).replace(/"/g, '&quot;')})" class="bg-white text-gray-800 font-bold py-2 px-3 rounded-full text-xs">Quick View</button>
                </div>
                <button onclick="event.stopPropagation();app.toggleWishlistItem(${JSON.stringify(product).replace(/"/g, '&quot;')})" class="absolute top-3 right-3 w-8 h-8 bg-white/90 rounded-full flex items-center justify-center shadow opacity-0 group-hover:opacity-100 ${discount > 0 ? 'hidden' : ''}">
                  <svg class="w-4 h-4" fill="${inWishlist ? '#FF6B35' : 'none'}" stroke="${inWishlist ? '#FF6B35' : 'currentColor'}" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
                </button>
              </div>
              <div class="p-5 flex-1 flex flex-col cursor-pointer" onclick="app.selectProductById(${product.id})">
                <div class="text-xs text-[#FF6B35] mb-1 font-bold uppercase">${product.subCategory || product.category}</div>
                <h3 class="font-bold text-gray-900 mb-1 line-clamp-2 text-base group-hover:text-[#FF6B35]">${product.name}</h3>
                ${avgRating > 0 ? `<div class="flex items-center gap-1 mb-2"><span class="text-yellow-400 text-sm">★</span><span class="text-xs text-gray-500">${avgRating} (${(state.reviews[product.id] || []).length})</span></div>` : ''}
                <p class="text-sm text-gray-500 mb-3 line-clamp-2 flex-1">${product.description}</p>
                <div class="flex items-center justify-between pt-3 border-t border-gray-50 mt-auto">
                  <div><span class="text-xl font-bold text-gray-900">${product.displayPrice}</span>${product.originalPrice ? `<span class="text-xs text-gray-400 line-through ml-1">${product.originalPrice}</span>` : ''}</div>
                  <button onclick="event.stopPropagation();app.toggleCompare(${JSON.stringify(product).replace(/"/g, '&quot;')})" class="text-xs px-2 py-1 rounded border ${inCompare ? 'bg-blue-100 text-blue-700 border-blue-300' : 'border-gray-200 text-gray-500 hover:border-blue-300'}">${inCompare ? '✓ Compare' : '+ Compare'}</button>
                </div>
              </div>
            </div>`;
  }).join('')}
        </div>`}
      </div>
    </div>
  </div></section>`;
}

function renderProductDetails() {
  const product = state.currentProduct;
  if (!product) return '';
  const { details } = state;
  const currentImage = details.currentImage || product.image;
  const currentPrice = details.currentPrice || product.price;
  const galleryImages = product.images?.length > 0 ? product.images : [product.image];
  const inWishlist = app.isInWishlist(product.id);
  const productReviews = state.reviews[product.id] || [];
  const avgRating = app.getAvgRating(product.id);
  const sizes = (product.subCategory || '').toLowerCase().includes('jean') || (product.subCategory || '').toLowerCase().includes('pant') || (product.subCategory || '').toLowerCase().includes('trouser')
    ? ['28', '30', '32', '34', '36', '38'] : ['S', 'M', 'L', 'XL', 'XXL'];
  return `<section class="bg-white py-8 md:py-12 animate-fade-in min-h-screen"><div class="max-w-7xl mx-auto px-4 md:px-6">
    <nav class="flex items-center gap-2 text-sm text-gray-500 mb-6">
      <button onclick="app.goHome()" class="hover:text-[#FF6B35]">Home</button><span>/</span>
      <button onclick="app.selectCategory('${product.category}')" class="hover:text-[#FF6B35]">${product.category}</button><span>/</span>
      <span class="text-gray-900 font-medium">${product.name}</span>
    </nav>
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-16">
      <div class="sticky top-24">
        <div class="aspect-square bg-gray-100 rounded-3xl overflow-hidden mb-4 cursor-zoom-in" onclick="app.updateDetail('zoom',true)">
          <img src="${currentImage}" class="w-full h-full object-cover" />
          ${product.badge ? `<div class="absolute top-6 left-6 bg-[#FF6B35] text-white px-4 py-2 rounded-full text-sm font-bold">${product.badge}</div>` : ''}
        </div>
        <div class="flex gap-3 overflow-x-auto pb-2">
          ${galleryImages.map(img => `<button onclick="app.updateDetail('currentImage','${img}')" class="w-20 h-20 flex-shrink-0 rounded-xl overflow-hidden border-2 ${currentImage === img ? 'border-[#FF6B35]' : 'border-transparent hover:border-gray-300'}"><img src="${img}" class="w-full h-full object-cover" /></button>`).join('')}
        </div>
      </div>
      <div>
        <div class="text-sm text-[#FF6B35] font-bold uppercase mb-2">${product.category} • ${product.subCategory || ''}</div>
        <h1 class="text-3xl md:text-5xl font-bold text-gray-900 mb-3 leading-tight">${product.name}</h1>
        ${avgRating > 0 ? `<div class="flex items-center gap-3 mb-4"><div class="flex">${[1, 2, 3, 4, 5].map(s => `<span class="${s <= Math.round(avgRating) ? 'text-yellow-400' : 'text-gray-300'}">★</span>`).join('')}</div><span class="font-bold">${avgRating}</span><span class="text-gray-500 text-sm">(${productReviews.length} reviews)</span></div>` : ''}
        <div class="mb-8 p-6 bg-gray-50 rounded-2xl border border-gray-100">
          <div class="flex items-end gap-4 mb-2">
            <span class="text-4xl font-bold text-gray-900">₹${currentPrice.toLocaleString()}</span>
            ${product.originalPrice ? `<span class="text-xl text-gray-400 line-through mb-1">${product.originalPrice}</span>` : ''}
          </div>
          <p class="text-xs text-gray-400 uppercase tracking-wide">Inclusive of all taxes • Free shipping</p>
        </div>
        <div class="space-y-8">
          <div>
            <h3 class="text-sm font-bold text-gray-900 mb-3 uppercase tracking-wider">Choose Size</h3>
            <div class="flex flex-wrap gap-3">
              ${sizes.map(s => {
    const sizeData = product.sizes?.[s];
    const stock = sizeData ? sizeData.stock : 0;
    const isOOS = sizeData && stock <= 0;
    return `<button onclick="${isOOS ? '' : ` app.updateDetail('size','${s}')`}" class="px-6 py-3 border rounded-xl font-medium transition-all ${isOOS ? 'opacity-40 cursor-not-allowed border-gray-200 line-through' : details.size === s ? 'border-[#FF6B35] bg-orange-50 text-[#FF6B35] ring-1 ring-[#FF6B35]' : 'border-gray-200 text-gray-600 hover:border-[#FF6B35]'}" ${isOOS ? 'disabled' : ''}>${s}${!isOOS && stock > 0 && stock < 10 ? `<span class="block text-[10px] text-orange-500">${stock} left</span>` : ''}</button>`;
  }).join('')}
            </div>
          </div>
          <div>
            <h3 class="text-sm font-bold text-gray-900 mb-3 uppercase tracking-wider">Choose Color</h3>
            <div class="flex flex-wrap gap-3">
              ${(product.colors || ['Black', 'White']).map(color => {
    const colorMap = { Black: '#000', White: '#FFF', Navy: '#001F3F', Gray: '#808080', Blue: '#0074D9', Red: '#FF4136', Green: '#2ECC40', Beige: '#F5F5DC', Brown: '#8B4513', Pink: '#FF69B4' };
    return `<button onclick="app.updateDetail('color','${color}')" class="flex items-center gap-2 px-4 py-3 border rounded-xl font-medium transition-all ${details.color === color ? 'border-[#FF6B35] bg-orange-50 text-[#FF6B35]' : 'border-gray-200 text-gray-600 hover:border-[#FF6B35]'}"><span class="w-6 h-6 rounded-full border-2 ${color === 'White' ? 'border-gray-300' : 'border-gray-200'}" style="background-color:${colorMap[color] || '#000'}"></span>${color}</button>`;
  }).join('')}
            </div>
          </div>
        </div>
        <div class="mt-10 pt-8 border-t border-gray-100 flex gap-4">
          <button onclick="app.addToCartCurrent()" class="flex-1 bg-[#FF6B35] text-white py-4 rounded-xl font-bold text-lg hover:bg-[#e55a2b] shadow-lg">Add to Cart — ₹${currentPrice.toLocaleString()}</button>
          <button onclick="app.toggleWishlistItem(${JSON.stringify(product).replace(/"/g, '&quot;')})" class="px-6 py-4 border-2 rounded-xl ${inWishlist ? 'border-[#FF6B35] text-[#FF6B35] bg-orange-50' : 'border-gray-200 hover:border-[#FF6B35] text-gray-400'}">
            <svg class="w-6 h-6" fill="${inWishlist ? 'currentColor' : 'none'}" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>
          </button>
        </div>
        ${product.features?.length > 0 ? `<div class="mt-8 grid grid-cols-2 gap-4">${product.features.map(f => `<div class="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-100"><span class="text-green-500">✓</span><span class="text-sm font-medium text-gray-700">${f}</span></div>`).join('')}</div>` : ''}
        <div class="mt-8"><h3 class="text-lg font-bold text-gray-900 mb-3">Description</h3><p class="text-gray-600 leading-relaxed">${product.description}</p></div>
      </div>
    </div>
    <div id="reviews-section" class="mt-16 pt-8 border-t border-gray-100">
      <div class="flex justify-between items-center mb-8">
        <h2 class="text-2xl font-bold text-gray-900">Customer Reviews</h2>
        <button onclick="app.openReviewModal(state.currentProduct)" class="px-6 py-3 bg-[#FF6B35] text-white rounded-xl font-bold hover:bg-[#e55a2b]">Write a Review</button>
      </div>
      ${productReviews.length === 0 ? `<div class="text-center py-12 bg-gray-50 rounded-2xl"><p class="text-gray-500 mb-4">No reviews yet.</p><button onclick="app.openReviewModal(state.currentProduct)" class="text-[#FF6B35] font-bold">Write first review</button></div>` : `<div class="grid md:grid-cols-2 gap-6">${productReviews.map(r => `<div class="bg-gray-50 p-6 rounded-2xl"><div class="flex justify-between mb-3"><div><div class="flex gap-0.5 mb-1">${[1, 2, 3, 4, 5].map(s => `<span class="${s <= r.rating ? 'text-yellow-400' : 'text-gray-300'}">★</span>`).join('')}</div><h4 class="font-bold text-gray-900">${r.title}</h4></div>${r.verified ? '<span class="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">✓ Verified</span>' : ''}</div><p class="text-gray-600 text-sm">${r.comment}</p><div class="mt-3 text-xs text-gray-400">👤 ${r.user} • ${r.date}</div></div>`).join('')}</div>`}
    </div>
  </div>
  ${details.zoom ? `<div class="fixed inset-0 z-[100] bg-white flex items-center justify-center p-4 cursor-zoom-out animate-fade-in" onclick="app.updateDetail('zoom',false)"><img src="${currentImage}" class="max-w-full max-h-full object-contain shadow-2xl" /></div>` : ''}
  </section>`;
}

function renderCartDrawer() {
  const subtotal = state.cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const discount = getDiscount(subtotal);
  const total = subtotal - discount;
  return `<div class="fixed inset-0 z-[60] transition-opacity duration-300 ${state.isCartOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}">
    <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" onclick="app.toggleCart(false)"></div>
    <div class="absolute inset-y-0 right-0 w-full md:w-[450px] bg-white shadow-2xl transform transition-transform duration-300 flex flex-col ${state.isCartOpen ? 'translate-x-0' : 'translate-x-full'}">
      <div class="p-6 border-b border-gray-100 flex justify-between items-center">
        <div><h2 class="text-xl font-bold text-gray-900">Your Cart</h2><p class="text-sm text-gray-500">${state.cart.reduce((a, b) => a + b.quantity, 0)} items</p></div>
        <button onclick="app.toggleCart(false)" class="p-2 hover:bg-gray-100 rounded-full text-gray-500">${ICONS.close}</button>
      </div>
      <div class="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50">
        ${state.cart.length === 0 ? `<div class="flex flex-col items-center justify-center h-full text-center text-gray-500">${ICONS.emptyCart}<p class="text-xl font-bold mb-2 text-gray-900">Cart is empty</p><button onclick="app.toggleCart(false)" class="px-8 py-3 bg-[#FF6B35] text-white rounded-full font-bold mt-4">Start Shopping</button></div>` :
      state.cart.map((item, index) => `<div class="flex gap-4 p-4 bg-white rounded-xl shadow-sm border border-gray-100 animate-fade-in">
          <div class="w-24 h-24 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0"><img src="${item.image}" class="w-full h-full object-cover" /></div>
          <div class="flex-1 flex flex-col justify-between">
            <div class="flex justify-between items-start"><h3 class="font-bold text-gray-900 line-clamp-1">${item.name}</h3><button onclick="app.removeFromCart(${index})" class="text-gray-400 hover:text-red-500"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg></button></div>
            ${item.selectedSize || item.selectedColor ? `<div class="text-xs bg-gray-100 inline-flex items-center px-2 py-1 rounded text-gray-600 mb-2">${item.selectedSize ? `Size: ${item.selectedSize}` : ''}${item.selectedSize && item.selectedColor ? ' • ' : ''}${item.selectedColor ? item.selectedColor : ''}</div>` : ''}
            <div class="flex justify-between items-end">
              <div class="flex items-center border border-gray-200 rounded-lg bg-gray-50">
                <button onclick="app.updateQuantity(${index},-1)" class="px-3 py-1 text-gray-600 hover:bg-white rounded-l-lg">-</button>
                <span class="px-2 text-sm font-medium min-w-[1.5rem] text-center">${item.quantity}</span>
                <button onclick="app.updateQuantity(${index},1)" class="px-3 py-1 text-gray-600 hover:bg-white rounded-r-lg">+</button>
              </div>
              <p class="font-bold text-gray-900">₹${(item.price * item.quantity).toLocaleString()}</p>
            </div>
          </div>
        </div>`).join('')}
      </div>
      ${state.cart.length > 0 ? `<div class="p-6 bg-white border-t border-gray-100">
        <div class="mb-4">
          ${state.appliedCoupon ? `<div class="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg px-3 py-2"><div><span class="text-xs font-bold text-green-700">🏷️ ${state.appliedCoupon.code}</span><span class="text-xs text-green-600 ml-2">-₹${discount.toLocaleString()} saved!</span></div><button onclick="removeCoupon()" class="text-red-400 hover:text-red-600 text-xs font-bold">Remove</button></div>` : `<div class="flex gap-2"><input type="text" placeholder="Coupon code" value="${state.couponCode}" oninput="state.couponCode=this.value" class="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-[#FF6B35] outline-none" /><button onclick="applyCoupon()" class="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-bold">Apply</button></div><p class="text-xs text-gray-400 mt-1">Try: FASHION20, FLAT100, WELCOME50</p>`}
        </div>
        <div class="space-y-2 mb-4">
          <div class="flex justify-between text-gray-500 text-sm"><span>Subtotal</span><span>₹${subtotal.toLocaleString()}</span></div>
          ${discount > 0 ? `<div class="flex justify-between text-sm text-green-600"><span>Discount</span><span>-₹${discount.toLocaleString()}</span></div>` : ''}
          <div class="flex justify-between text-gray-500 text-sm"><span>Delivery</span><span class="text-green-600 text-xs">Free</span></div>
          <div class="flex justify-between text-xl font-bold text-gray-900 pt-3 border-t border-dashed border-gray-200"><span>Total</span><span>₹${total.toLocaleString()}</span></div>
        </div>
        <button onclick="app.toggleCheckoutModal(true)" class="w-full py-4 bg-[#FF6B35] text-white font-bold rounded-xl hover:bg-[#e55a2b] shadow-lg">Proceed to Checkout</button>
      </div>` : ''}
    </div>
  </div>`;
}

function renderWishlistDrawer() {
  return `<div class="fixed inset-0 z-[60] transition-opacity duration-300 ${state.isWishlistOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}">
    <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" onclick="app.toggleWishlist(false)"></div>
    <div class="absolute inset-y-0 right-0 w-full md:w-[420px] bg-white shadow-2xl transform transition-transform duration-300 flex flex-col ${state.isWishlistOpen ? 'translate-x-0' : 'translate-x-full'}">
      <div class="p-6 border-b border-gray-100 flex justify-between items-center"><div><h2 class="text-xl font-bold text-gray-900">Wishlist</h2><p class="text-sm text-gray-500">${state.wishlist.length} items</p></div><button onclick="app.toggleWishlist(false)" class="p-2 hover:bg-gray-100 rounded-full text-gray-500">${ICONS.close}</button></div>
      <div class="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50">
        ${state.wishlist.length === 0 ? `<div class="flex flex-col items-center justify-center h-full text-center text-gray-500"><p class="font-bold text-gray-900 mb-2">Wishlist is empty</p><button onclick="app.toggleWishlist(false)" class="px-6 py-2 bg-[#FF6B35] text-white rounded-full font-bold mt-4">Start Shopping</button></div>` :
      state.wishlist.map(item => `<div class="flex gap-4 p-4 bg-white rounded-xl shadow-sm border border-gray-100"><div class="w-20 h-20 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0 cursor-pointer" onclick="app.selectProductById(${item.id});app.toggleWishlist(false)"><img src="${item.image}" class="w-full h-full object-cover" /></div><div class="flex-1"><h3 class="font-bold text-gray-900 text-sm line-clamp-2 cursor-pointer hover:text-[#FF6B35]" onclick="app.selectProductById(${item.id});app.toggleWishlist(false)">${item.name}</h3><p class="font-bold text-gray-900 mt-1">${item.displayPrice || '₹' + item.price}</p><div class="flex gap-2 mt-3"><button onclick="app.moveToCart(${JSON.stringify(item).replace(/"/g, '&quot;')})" class="flex-1 py-1.5 bg-[#FF6B35] text-white text-xs font-bold rounded-lg">Move to Cart</button><button onclick="app.removeFromWishlist(${item.id})" class="p-1.5 text-red-400 border border-red-200 rounded-lg hover:bg-red-50">${ICONS.close}</button></div></div></div>`).join('')}
      </div>
    </div>
  </div>`;
}

function renderCheckoutModal() {
  if (!state.checkoutModalOpen) return '';
  const subtotal = state.cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const discount = getDiscount(subtotal);
  const total = subtotal - discount;
  return `<div class="fixed inset-0 z-[100] flex items-center justify-center p-4">
    <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" onclick="app.toggleCheckoutModal(false)"></div>
    <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-fade-in">
      <div class="p-6 border-b border-gray-100 flex justify-between items-center"><h3 class="text-xl font-bold text-gray-900">Checkout</h3><button onclick="app.toggleCheckoutModal(false)" class="text-gray-400 hover:text-gray-600">${ICONS.close}</button></div>
      <form onsubmit="app.confirmOrder(event)" class="p-6 space-y-5">
        <div class="bg-gray-50 p-4 rounded-lg border border-gray-100 text-sm text-gray-700">
          <p class="font-bold mb-1">Customer</p>
          <p>${state.user ? state.user.name : 'Guest User'}</p>
          <p class="text-gray-500">${state.user ? state.user.email : 'guest@example.com'}</p>
        </div>
        <div>
          <label class="block text-sm font-bold text-gray-700 mb-2">Select Branch</label>
          <select name="branch" required class="w-full appearance-none px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6B35] outline-none bg-white">
            <option value="">-- Choose Branch --</option>
            ${BRANCHES.map(b => `<option value="${b}">${b}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="block text-sm font-bold text-gray-700 mb-2">Payment Method</label>
          <div class="space-y-2">
            <label class="flex items-center p-3 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
              <input type="radio" name="paymentMethod" value="COD" checked class="mr-3">
              <div class="flex items-center gap-2">
                <span>💵</span>
                <div>
                  <div class="font-medium text-gray-900">Cash on Delivery</div>
                  <div class="text-xs text-gray-500">Pay when you receive your order</div>
                </div>
              </div>
            </label>
            <label class="flex items-center p-3 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
              <input type="radio" name="paymentMethod" value="Razorpay" class="mr-3">
              <div class="flex items-center gap-2">
                <span>💳</span>
                <div>
                  <div class="font-medium text-gray-900">Online Payment</div>
                  <div class="text-xs text-gray-500">Pay securely with card, UPI, wallet</div>
                </div>
              </div>
            </label>
          </div>
        </div>
        ${discount > 0 ? `<div class="flex justify-between text-sm text-green-600 bg-green-50 rounded-lg p-3"><span>Coupon Discount</span><span>-₹${discount.toLocaleString()}</span></div>` : ''}
        <div class="flex justify-between items-center pt-4 border-t border-dashed border-gray-200"><span class="text-gray-600 font-medium">Total</span><span class="text-2xl font-bold text-gray-900">₹${total.toLocaleString()}</span></div>
        <button type="submit" class="w-full py-4 bg-[#FF6B35] text-white font-bold rounded-lg hover:bg-[#e55a2b] shadow-md">Place Order</button>
      </form>
    </div>
  </div>`;
}

function renderTrackingPage() {
  return `<section class="min-h-screen bg-gray-50 py-12 px-4 animate-fade-in"><div class="max-w-3xl mx-auto">
    <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
      <h2 class="text-3xl font-bold text-gray-900 mb-4">Track Your Order</h2>
      <p class="text-gray-500 mb-6">Enter your Order ID to check status.</p>
      <div class="flex gap-2 max-w-md mx-auto">
        <input type="text" id="trackInput" placeholder="e.g. ORD-2025-ABC-1234" class="flex-1 border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-[#FF6B35] outline-none" onkeypress="if(event.key==='Enter')app.trackOrder()" />
        <button onclick="app.trackOrder()" class="bg-[#FF6B35] text-white px-6 py-3 rounded-lg font-bold hover:bg-[#e55a2b]">Track</button>
      </div>
      <div id="trackResult"></div>
    </div>
  </div></section>`;
}

function renderAdminLogin() {
  const isLogin = state.adminAuthMode === 'login';
  return `<div class="min-h-screen bg-gray-100 flex items-center justify-center px-4">
    <div class="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md animate-fade-in">
      <div class="text-center mb-8">
        <div class="w-16 h-16 bg-gray-900 text-[#FF6B35] rounded-full mx-auto flex items-center justify-center mb-4">${ICONS.logoMoon}</div>
        <h2 class="text-2xl font-bold text-gray-900">Admin Portal</h2>
        <p class="text-gray-500 text-sm">${isLogin ? 'Authorized personnel only' : 'Request Admin Access'}</p>
      </div>
      <form onsubmit="${isLogin ? 'app.adminLogin(event)' : 'app.registerAdmin(event)'}" class="space-y-4">
        <div><label class="block text-sm font-bold text-gray-700 mb-1">Username</label><input type="text" name="username" class="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-[#FF6B35] outline-none" required /></div>
        <div><label class="block text-sm font-bold text-gray-700 mb-1">Password</label><input type="password" name="password" class="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-[#FF6B35] outline-none" required /></div>
        ${!isLogin ? `<div><label class="block text-sm font-bold text-gray-700 mb-1">Confirm Password</label><input type="password" name="confirmPassword" class="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-[#FF6B35] outline-none" required /></div>` : ''}
        <button type="submit" class="w-full bg-[#FF6B35] text-white py-3 rounded-lg font-bold hover:bg-[#e55a2b] shadow-lg">${isLogin ? 'Login' : 'Submit Request'}</button>
      </form>
      <div class="mt-6 text-center text-sm">
        ${isLogin ? `<p class="text-gray-500">No account? <button onclick="app.toggleAdminAuthMode('register')" class="text-[#FF6B35] font-bold">Apply for Access</button></p>` : `<p class="text-gray-500">Have account? <button onclick="app.toggleAdminAuthMode('login')" class="text-[#FF6B35] font-bold">Login</button></p>`}
        <div class="mt-4 pt-4 border-t border-gray-100"><button onclick="app.goHome()" class="text-gray-500 hover:text-gray-900">← Back to Store</button></div>
      </div>
      <div class="mt-4 p-3 bg-gray-50 rounded-lg text-xs text-gray-500 text-center">Default: <strong>admin</strong> / <strong>admin123</strong></div>
    </div>
  </div>`;
}

function renderAdminDashboard() {
  const totalOrders = state.adminOrders.length;
  const totalSales = state.adminOrders.reduce((acc, o) => acc + (o.total || 0), 0);
  const isMain = state.adminUser?.isMain;
  const pendingOrders = state.adminOrders.filter(o => o.status === 'Order Placed').length;
  const deliveredOrders = state.adminOrders.filter(o => o.status === 'Delivered').length;
  let filteredOrders = state.adminOrders;
  if (state.dateFilter !== 'all') {
    const ranges = { today: 86400000, week: 604800000, month: 2592000000 };
    filteredOrders = filteredOrders.filter(o => Date.now() - new Date(o.date).getTime() < ranges[state.dateFilter]);
  }
  if (state.orderSearch) {
    const s = state.orderSearch.toLowerCase();
    filteredOrders = filteredOrders.filter(o => o.id.toLowerCase().includes(s) || o.customer.name.toLowerCase().includes(s) || o.branch.toLowerCase().includes(s));
  }
  const tabs = [{ id: 'orders', label: '📦 Orders', badge: totalOrders }, { id: 'products', label: '👕 Products', badge: PRODUCTS.length }, { id: 'admins', label: '👥 Admins', badge: (state.adminUsers || []).length }, { id: 'analytics', label: '📊 Analytics', badge: null }];

  return `<div class="min-h-screen bg-gray-100 flex font-sans">
    <aside class="w-64 bg-gray-900 text-white flex-shrink-0 hidden md:flex flex-col">
      <div class="p-6 border-b border-gray-800 flex items-center gap-3"><div class="w-8 h-8 text-[#FF6B35]">${ICONS.logoMoon}</div><span class="font-bold text-lg">Admin Panel</span></div>
      <nav class="flex-1 p-4 space-y-1">
        ${tabs.map(t => `<button onclick="app.setAdminTab('${t.id}')" class="w-full text-left px-4 py-3 rounded flex items-center justify-between transition-colors ${state.activeTab === t.id ? 'bg-[#FF6B35] text-white font-medium' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}">${t.label}${t.badge !== null ? `<span class="text-xs bg-white/20 px-2 py-0.5 rounded-full">${t.badge}</span>` : ''}</button>`).join('')}
        <button onclick="app.goHome()" class="w-full text-left px-4 py-3 rounded text-gray-400 hover:bg-gray-800 hover:text-white mt-4">🏪 View Store</button>
        <button onclick="app.logout()" class="w-full text-left px-4 py-3 rounded text-gray-400 hover:bg-gray-800 hover:text-white">🚪 Logout</button>
      </nav>
      <div class="p-4 border-t border-gray-800 text-sm"><div class="flex items-center gap-3"><div class="w-8 h-8 bg-[#FF6B35] rounded-full flex items-center justify-center font-bold">${state.adminUser?.username[0].toUpperCase() || 'A'}</div><div><div class="text-white font-medium">${state.adminUser?.username || 'Admin'}</div><div class="text-gray-400 text-xs">${isMain ? 'Main Admin' : 'Admin'}</div></div></div></div>
    </aside>
    <main class="flex-1 overflow-y-auto">
      <header class="bg-white border-b border-gray-200 p-6 flex justify-between items-center sticky top-0 z-20">
        <div class="flex items-center gap-4"><h1 class="text-2xl font-bold text-gray-900">${tabs.find(t => t.id === state.activeTab)?.label || 'Dashboard'}</h1><button onclick="app.refreshAllData()" class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">🔄 Refresh</button></div>
        <div class="flex items-center gap-3">${state.activeTab === 'orders' ? `<button onclick="app.exportOrders()" class="px-4 py-2 text-sm bg-green-600 text-white rounded-lg font-bold hover:bg-green-700">📤 Export CSV</button>` : ''}<div class="md:hidden"><button onclick="app.logout()" class="text-sm text-red-500 font-bold">Logout</button></div></div>
      </header>
      <div class="p-6 md:p-8 space-y-8">
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div class="bg-white p-5 rounded-xl shadow-sm border border-gray-200"><p class="text-xs text-gray-500 font-bold uppercase mb-2">Total Sales</p><p class="text-2xl font-bold text-gray-900">₹${totalSales.toLocaleString()}</p></div>
          <div class="bg-white p-5 rounded-xl shadow-sm border border-gray-200"><p class="text-xs text-gray-500 font-bold uppercase mb-2">Total Orders</p><p class="text-2xl font-bold text-gray-900">${totalOrders}</p><p class="text-xs text-orange-600 mt-1">${pendingOrders} pending</p></div>
          <div class="bg-white p-5 rounded-xl shadow-sm border border-gray-200"><p class="text-xs text-gray-500 font-bold uppercase mb-2">Delivered</p><p class="text-2xl font-bold text-green-600">${deliveredOrders}</p><p class="text-xs text-gray-400">${totalOrders ? Math.round(deliveredOrders / totalOrders * 100) : 0}% success</p></div>
          <div class="bg-white p-5 rounded-xl shadow-sm border border-gray-200"><p class="text-xs text-gray-500 font-bold uppercase mb-2">Products</p><p class="text-2xl font-bold text-blue-600">${PRODUCTS.length}</p></div>
        </div>
        ${state.activeTab === 'orders' ? renderAdminOrders(filteredOrders) : ''}
        ${state.activeTab === 'products' ? renderAdminProducts() : ''}
        ${state.activeTab === 'admins' ? renderAdminUsers(state.adminUsers || [], isMain) : ''}
        ${state.activeTab === 'analytics' ? renderAdminAnalytics(totalSales, totalOrders) : ''}
      </div>
    </main>
  </div>`;
}

function renderAdminOrders(orders) {
  return `<div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
    <div class="p-6 border-b border-gray-100 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
      <h3 class="font-bold text-lg text-gray-900">Orders (${orders.length})</h3>
      <div class="flex gap-3 flex-wrap">
        <input type="text" placeholder="Search orders…" oninput="state.orderSearch=this.value;render()" value="${state.orderSearch}" class="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-[#FF6B35] outline-none" />
        <select onchange="app.setDateFilter(this.value)" class="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-[#FF6B35] outline-none bg-white">
          <option value="all" ${state.dateFilter === 'all' ? 'selected' : ''}>All Time</option>
          <option value="today" ${state.dateFilter === 'today' ? 'selected' : ''}>Today</option>
          <option value="week" ${state.dateFilter === 'week' ? 'selected' : ''}>This Week</option>
          <option value="month" ${state.dateFilter === 'month' ? 'selected' : ''}>This Month</option>
        </select>
      </div>
    </div>
    <div class="overflow-x-auto">
      <table class="w-full text-left">
        <thead class="bg-gray-50 text-xs text-gray-500 uppercase"><tr><th class="px-4 py-4">Order ID</th><th class="px-4 py-4">Customer</th><th class="px-4 py-4">Branch</th><th class="px-4 py-4">Total</th><th class="px-4 py-4">Status</th><th class="px-4 py-4">Update</th><th class="px-4 py-4">Location</th><th class="px-4 py-4">Actions</th></tr></thead>
        <tbody class="divide-y divide-gray-100 text-sm">
          ${orders.length === 0 ? `<tr><td colspan="8" class="px-6 py-12 text-center text-gray-400">No orders found</td></tr>` :
      orders.map(order => `<tr class="hover:bg-gray-50">
            <td class="px-4 py-4 font-medium text-xs text-[#FF6B35]">${order.id}</td>
            <td class="px-4 py-4"><div class="font-medium text-gray-900">${order.customer.name}</div><div class="text-gray-500 text-xs">${order.customer.email}</div></td>
            <td class="px-4 py-4 text-sm">${order.branch}</td>
            <td class="px-4 py-4 font-bold">₹${(order.total || 0).toLocaleString()}</td>
            <td class="px-4 py-4"><span class="px-2 py-1 rounded text-xs font-bold ${order.status === 'Delivered' ? 'bg-green-100 text-green-700' : order.status === 'Out for Delivery' ? 'bg-blue-100 text-blue-700' : order.status === 'Packing' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-700'}">${order.status}</span></td>
            <td class="px-4 py-4"><select onchange="app.updateOrderStatus('${order.id}',this.value)" class="border border-gray-300 rounded text-xs p-1 bg-white"><option value="Order Placed" ${order.status === 'Order Placed' ? 'selected' : ''}>Order Placed</option><option value="In Hub" ${order.status === 'In Hub' ? 'selected' : ''}>In Hub</option><option value="Packing" ${order.status === 'Packing' ? 'selected' : ''}>Packing</option><option value="Given to Rider" ${order.status === 'Given to Rider' ? 'selected' : ''}>Given to Rider</option><option value="Out for Delivery" ${order.status === 'Out for Delivery' ? 'selected' : ''}>Out for Delivery</option><option value="Delivered" ${order.status === 'Delivered' ? 'selected' : ''}>Delivered</option></select></td>
            <td class="px-4 py-4"><input type="text" value="${order.location || ''}" onchange="app.updateOrderStatusWithLocation('${order.id}','${order.status}',this.value)" class="border border-gray-300 rounded px-2 py-1 text-xs w-28" placeholder="Location" /></td>
            <td class="px-4 py-4"><button onclick="app.downloadInvoice('${order.id}')" class="text-xs bg-gray-800 text-white px-2 py-1 rounded hover:bg-black">Invoice</button></td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
  </div>`;
}

function renderAdminProducts() {
  const searchLower = state.productSearch.toLowerCase();
  const filtered = PRODUCTS.filter(p => !searchLower || p.name.toLowerCase().includes(searchLower) || p.category.toLowerCase().includes(searchLower));
  return `<div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
    <div class="p-6 border-b border-gray-100 flex justify-between items-center">
      <h3 class="font-bold text-lg text-gray-900">Products & Pricing</h3>
      <input type="text" placeholder="Search products…" oninput="state.productSearch=this.value;render()" value="${state.productSearch}" class="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-[#FF6B35] outline-none" />
    </div>
    <div class="overflow-x-auto max-h-[600px] overflow-y-auto">
      <table class="w-full text-left">
        <thead class="bg-gray-50 text-xs text-gray-500 uppercase sticky top-0"><tr><th class="px-6 py-4">Product</th><th class="px-6 py-4">Category</th><th class="px-6 py-4">Stock</th><th class="px-6 py-4">Price</th><th class="px-6 py-4">Update Price</th></tr></thead>
        <tbody class="divide-y divide-gray-100 text-sm">
          ${filtered.map(p => {
    const totalStock = p.sizes ? Object.values(p.sizes).reduce((s, sz) => s + (sz.stock || 0), 0) : 0;
    const lowStock = p.sizes ? Object.entries(p.sizes).filter(([, sz]) => sz.stock > 0 && sz.stock < 10) : [];
    return `<tr class="hover:bg-gray-50">
              <td class="px-6 py-4"><div class="flex items-center gap-3"><img src="${p.image}" class="w-10 h-10 rounded-lg object-cover" /><div><div class="font-medium text-gray-900">${p.name}</div>${p.badge ? `<span class="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded">${p.badge}</span>` : ''}</div></div></td>
              <td class="px-6 py-4 text-gray-500">${p.category}</td>
              <td class="px-6 py-4"><span class="${totalStock < 20 ? 'text-red-600' : 'text-green-600'} font-bold text-xs">${totalStock} units</span>${lowStock.length > 0 ? `<div class="text-orange-500 text-xs">⚠ Low: ${lowStock.map(([s]) => s).join(', ')}</div>` : ''}</td>
              <td class="px-6 py-4 font-bold text-gray-900">₹${p.price.toLocaleString()}</td>
              <td class="px-6 py-4"><div class="flex items-center gap-2"><input type="number" id="price-${p.id}" value="${p.price}" min="1" class="w-24 border border-gray-300 rounded px-2 py-1 text-sm focus:ring-1 focus:ring-[#FF6B35] outline-none" /><button onclick="app.savePrice(${p.id},document.getElementById('price-${p.id}').value)" class="bg-gray-900 text-white px-3 py-1 rounded text-xs hover:bg-black">Save</button></div></td>
            </tr>`;
  }).join('')}
        </tbody>
      </table>
    </div>
  </div>`;
}

function renderAdminUsers(allAdmins, isMain) {
  const pending = allAdmins.filter(a => a.status === 'pending');
  return `<div class="space-y-6">
    ${isMain && pending.length > 0 ? `<div class="bg-white rounded-xl shadow-sm border border-red-200 overflow-hidden">
      <div class="p-6 border-b border-red-100 bg-red-50"><h3 class="font-bold text-lg text-red-900">Pending Approvals (${pending.length})</h3></div>
      <div class="p-6"><table class="w-full text-left"><thead class="text-xs text-gray-500 uppercase bg-gray-50"><tr><th class="px-4 py-3">Username</th><th class="px-4 py-3">Requested</th><th class="px-4 py-3">Actions</th></tr></thead><tbody class="divide-y divide-gray-100 text-sm">${pending.map(a => `<tr><td class="px-4 py-4 font-bold">${a.username}</td><td class="px-4 py-4 text-gray-500">${new Date(a.createdAt).toLocaleDateString()}</td><td class="px-4 py-4 flex gap-2"><button onclick="app.approveAdmin(${a.id})" class="bg-green-600 text-white px-3 py-1.5 rounded text-xs font-bold">Approve</button><button onclick="app.rejectAdmin(${a.id})" class="bg-red-600 text-white px-3 py-1.5 rounded text-xs font-bold">Reject</button></td></tr>`).join('')}</tbody></table></div>
    </div>` : ''}
    <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div class="p-6 border-b border-gray-100 flex justify-between items-center"><h3 class="font-bold text-lg text-gray-900">All Admins</h3><span class="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded">Total: ${allAdmins.length}</span></div>
      <div class="overflow-x-auto"><table class="w-full text-left"><thead class="bg-gray-50 text-xs text-gray-500 uppercase"><tr><th class="px-6 py-4">Username</th><th class="px-6 py-4">Role</th><th class="px-6 py-4">Status</th><th class="px-6 py-4">Action</th></tr></thead><tbody class="divide-y divide-gray-100 text-sm">
        ${allAdmins.map(admin => {
    const isSelf = state.adminUser?.id === admin.id;
    return `<tr><td class="px-6 py-4 font-bold text-gray-900 flex items-center gap-2">${admin.username}${admin.isMain ? '<span class="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Main</span>' : ''}${isSelf ? '<span class="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full">You</span>' : ''}</td><td class="px-6 py-4 text-gray-500">${admin.role || 'Admin'}</td><td class="px-6 py-4"><span class="px-2 py-1 rounded text-xs font-bold ${admin.status === 'approved' ? 'bg-green-100 text-green-700' : admin.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}">${admin.status}</span></td><td class="px-6 py-4">${admin.isMain ? '<span class="text-gray-400 text-xs">Protected</span>' : `<button onclick="app.removeAdmin(${admin.id})" class="text-red-600 hover:text-red-800 text-xs font-bold border border-red-200 px-3 py-1 rounded">Remove</button>`}</td></tr>`;
  }).join('')}
      </tbody></table></div>
    </div>
  </div>`;
}

function renderAdminAnalytics(totalSales, totalOrders) {
  const statusCounts = {};
  state.adminOrders.forEach(o => { statusCounts[o.status] = (statusCounts[o.status] || 0) + 1; });
  const branchStats = {};
  BRANCHES.forEach(b => branchStats[b] = { count: 0, sales: 0 });
  state.adminOrders.forEach(o => { if (branchStats[o.branch]) { branchStats[o.branch].count++; branchStats[o.branch].sales += o.total || 0; } });
  return `<div class="space-y-6">
    <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 class="font-bold text-lg text-gray-900 mb-4">Sales by Branch</h3>
      ${BRANCHES.map(b => { const pct = totalSales ? Math.round(branchStats[b].sales / totalSales * 100) : 0; return `<div class="mb-4"><div class="flex justify-between text-sm mb-1"><span class="font-medium text-gray-700">${b}</span><span class="font-bold">₹${branchStats[b].sales.toLocaleString()} <span class="text-gray-400 font-normal">(${branchStats[b].count})</span></span></div><div class="w-full bg-gray-100 rounded-full h-2"><div class="bg-[#FF6B35] h-2 rounded-full" style="width:${pct}%"></div></div></div>`; }).join('')}
    </div>
    <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 class="font-bold text-lg text-gray-900 mb-4">Order Status</h3>
      ${Object.entries(statusCounts).map(([s, c]) => `<div class="flex justify-between items-center mb-3"><span class="text-sm text-gray-600">${s}</span><div class="flex items-center gap-2"><div class="w-24 bg-gray-100 rounded-full h-2"><div class="bg-[#FF6B35] h-2 rounded-full" style="width:${totalOrders ? c / totalOrders * 100 : 0}%"></div></div><span class="text-sm font-bold w-8 text-right">${c}</span></div></div>`).join('')}
      <div class="mt-4 pt-4 border-t border-gray-100 flex justify-between text-sm"><span class="text-gray-500">Avg Order Value</span><span class="font-bold">₹${totalOrders ? Math.round(totalSales / totalOrders).toLocaleString() : 0}</span></div>
    </div>
  </div>`;
}

// Modals
function renderAuthModal() {
  if (!state.authModalOpen) return '';
  const isLogin = state.authMode === 'login';
  return `<div class="fixed inset-0 z-[100] flex items-center justify-center p-4">
    <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" onclick="app.toggleAuth(false)"></div>
    <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in">
      <div class="p-8">
        <div class="flex justify-between items-center mb-6"><div><h3 class="text-2xl font-bold text-gray-900">${isLogin ? 'Welcome Back' : 'Create Account'}</h3><p class="text-sm text-gray-500 mt-1">${isLogin ? 'Sign in to continue' : 'Register to start shopping'}</p></div><button onclick="app.toggleAuth(false)" class="text-gray-400 hover:text-gray-600 p-2">${ICONS.close}</button></div>
        <form onsubmit="${isLogin ? 'app.login(event)' : 'app.registerUser(event)'}" class="space-y-5">
          ${!isLogin ? `<div><label class="block text-sm font-bold text-gray-700 mb-1">Full Name</label><input type="text" name="name" required class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6B35] outline-none" /></div>` : ''}
          <div><label class="block text-sm font-bold text-gray-700 mb-1">Email</label><input type="email" name="email" required class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6B35] outline-none" /></div>
          <div><label class="block text-sm font-bold text-gray-700 mb-1">Password</label><input type="password" name="password" required class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6B35] outline-none" /></div>
          ${!isLogin ? `<div><label class="block text-sm font-bold text-gray-700 mb-1">Confirm Password</label><input type="password" name="confirmPassword" required class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6B35] outline-none" /></div>` : ''}
          <button type="submit" class="w-full py-4 bg-[#FF6B35] text-white font-bold rounded-lg hover:bg-[#e55a2b] shadow-md">${isLogin ? 'Sign In' : 'Register'}</button>
        </form>
        <div class="mt-6 text-center pt-6 border-t border-gray-100"><p class="text-sm text-gray-600">${isLogin ? "Don't have account?" : 'Already have account?'} <button onclick="app.toggleAuth(true,'${isLogin ? 'register' : 'login'}')" class="text-[#FF6B35] font-bold">${isLogin ? 'Create Account' : 'Login'}</button></p></div>
      </div>
    </div>
  </div>`;
}

function renderCompareModal() {
  if (!state.compareModalOpen) return '';
  const prods = state.compareList;
  return `<div class="fixed inset-0 z-[100] flex items-start justify-center p-4 pt-16 overflow-y-auto">
    <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" onclick="app.closeCompare()"></div>
    <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl animate-fade-in">
      <div class="p-6 border-b border-gray-100 flex justify-between items-center"><h3 class="text-xl font-bold">Compare Products</h3><div class="flex gap-3"><button onclick="app.clearCompare();app.closeCompare()" class="text-sm text-red-500">Clear All</button><button onclick="app.closeCompare()" class="text-gray-400">${ICONS.close}</button></div></div>
      <div class="overflow-x-auto"><table class="w-full"><thead><tr><td class="p-4 font-bold text-gray-500 text-sm w-32">Feature</td>${prods.map(p => `<td class="p-4 text-center"><div class="w-24 h-24 mx-auto rounded-xl overflow-hidden mb-2"><img src="${p.image}" class="w-full h-full object-cover" /></div><p class="font-bold text-gray-900 text-sm">${p.name}</p></td>`).join('')}</tr></thead>
      <tbody class="divide-y divide-gray-100">
        <tr class="bg-gray-50"><td class="p-4 text-sm font-bold text-gray-500">Price</td>${prods.map(p => `<td class="p-4 text-center text-xl font-bold text-[#FF6B35]">${p.displayPrice}</td>`).join('')}</tr>
        <tr><td class="p-4 text-sm font-bold text-gray-500">Category</td>${prods.map(p => `<td class="p-4 text-center text-sm">${p.category}</td>`).join('')}</tr>
        <tr class="bg-gray-50"><td class="p-4 text-sm font-bold text-gray-500">Colors</td>${prods.map(p => `<td class="p-4 text-center">${(p.colors || []).map(c => `<span class="inline-block text-xs bg-gray-100 rounded px-2 py-0.5 mr-1">${c}</span>`).join('')}</td>`).join('')}</tr>
        <tr><td class="p-4 text-sm font-bold text-gray-500">Rating</td>${prods.map(p => { const r = app.getAvgRating(p.id); return `<td class="p-4 text-center">${r > 0 ? `<span class="text-yellow-400">★</span> <span class="font-bold">${r}</span>` : '—'}</td>` }).join('')}</tr>
        <tr class="bg-gray-50"><td class="p-4"></td>${prods.map(p => `<td class="p-4 text-center"><button onclick="app.addToCartById(${p.id});app.closeCompare();" class="w-full py-2 bg-[#FF6B35] text-white rounded-lg text-sm font-bold">Add to Cart</button></td>`).join('')}</tr>
      </tbody></table></div>
    </div>
  </div>`;
}

function renderReviewModal() {
  if (!state.reviewModalOpen || !state.reviewProduct) return '';
  return `<div class="fixed inset-0 z-[100] flex items-center justify-center p-4">
    <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" onclick="app.closeReviewModal()"></div>
    <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-md animate-fade-in">
      <div class="p-6 border-b border-gray-100 flex justify-between items-center"><h3 class="text-xl font-bold">Write a Review</h3><button onclick="app.closeReviewModal()" class="text-gray-400">${ICONS.close}</button></div>
      <form onsubmit="app.submitReview(event)" class="p-6 space-y-4">
        <div><label class="block text-sm font-bold text-gray-700 mb-2">Rating</label><select name="rating" required class="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-[#FF6B35] outline-none bg-white"><option value="5">⭐⭐⭐⭐⭐ Excellent</option><option value="4">⭐⭐⭐⭐ Good</option><option value="3">⭐⭐⭐ Average</option><option value="2">⭐⭐ Poor</option><option value="1">⭐ Terrible</option></select></div>
        <div><label class="block text-sm font-bold text-gray-700 mb-2">Title</label><input type="text" name="title" required class="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-[#FF6B35] outline-none" /></div>
        <div><label class="block text-sm font-bold text-gray-700 mb-2">Review</label><textarea name="comment" required rows="4" class="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-[#FF6B35] outline-none resize-none"></textarea></div>
        <button type="submit" class="w-full py-3 bg-[#FF6B35] text-white font-bold rounded-lg hover:bg-[#e55a2b]">Submit Review</button>
      </form>
    </div>
  </div>`;
}

function renderProfileModal() {
  if (!state.profileModalOpen || !state.user) return '';
  const userOrders = state.adminOrders.filter(o => o.customer.email === state.user.email);
  return `<div class="fixed inset-0 z-[100] flex items-center justify-center p-4">
    <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" onclick="app.closeProfile()"></div>
    <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-fade-in max-h-[90vh] overflow-y-auto">
      <div class="p-6 border-b border-gray-100 flex justify-between items-center"><h3 class="text-xl font-bold">My Profile</h3><button onclick="app.closeProfile()" class="text-gray-400">${ICONS.close}</button></div>
      <div class="p-6">
        <div class="flex items-center gap-4 mb-6"><div class="w-16 h-16 bg-[#FF6B35] text-white rounded-full flex items-center justify-center text-2xl font-bold">${state.user.name[0].toUpperCase()}</div><div><h2 class="text-xl font-bold">${state.user.name}</h2><p class="text-gray-500">${state.user.email}</p></div></div>
        <div class="mb-6"><h3 class="font-bold text-gray-900 mb-3">Order History (${userOrders.length})</h3>${userOrders.length === 0 ? '<p class="text-sm text-gray-500 bg-gray-50 p-4 rounded-lg">No orders yet.</p>' : `<div class="space-y-3 max-h-48 overflow-y-auto">${userOrders.map(o => `<div class="flex justify-between items-center p-3 bg-gray-50 rounded-lg text-sm"><div><div class="font-medium">#${o.id}</div><div class="text-gray-500 text-xs">${new Date(o.date).toLocaleDateString()}</div></div><div class="text-right"><div class="font-bold">₹${(o.total || 0).toLocaleString()}</div><span class="text-xs px-2 py-0.5 rounded-full ${o.status === 'Delivered' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-600'}">${o.status}</span></div></div>`).join('')}</div>`}</div>
        <button onclick="app.logout();app.closeProfile();" class="w-full mt-6 py-3 border border-red-200 text-red-600 rounded-lg font-bold hover:bg-red-50">Logout</button>
      </div>
    </div>
  </div>`;
}

function renderAddressModal() {
  if (!state.addressModalOpen) return '';
  return `<div class="fixed inset-0 z-[110] flex items-center justify-center p-4">
    <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" onclick="app.closeAddressModal()"></div>
    <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-md animate-fade-in">
      <div class="p-6 border-b border-gray-100 flex justify-between items-center"><h3 class="text-xl font-bold">Add Address</h3><button onclick="app.closeAddressModal()" class="text-gray-400">${ICONS.close}</button></div>
      <form onsubmit="app.saveAddress(event)" class="p-6 space-y-4">
        <div class="grid grid-cols-2 gap-4"><div><label class="block text-sm font-bold text-gray-700 mb-1">Name</label><input type="text" name="name" required class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#FF6B35] outline-none" /></div><div><label class="block text-sm font-bold text-gray-700 mb-1">Phone</label><input type="tel" name="phone" required class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#FF6B35] outline-none" /></div></div>
        <div><label class="block text-sm font-bold text-gray-700 mb-1">Address</label><input type="text" name="line1" required class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#FF6B35] outline-none" /></div>
        <div class="grid grid-cols-3 gap-3"><div><label class="block text-sm font-bold text-gray-700 mb-1">City</label><input type="text" name="city" required class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#FF6B35] outline-none" /></div><div><label class="block text-sm font-bold text-gray-700 mb-1">State</label><input type="text" name="addrState" required class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#FF6B35] outline-none" /></div><div><label class="block text-sm font-bold text-gray-700 mb-1">Pincode</label><input type="text" name="pincode" required class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#FF6B35] outline-none" /></div></div>
        <button type="submit" class="w-full py-3 bg-[#FF6B35] text-white font-bold rounded-lg hover:bg-[#e55a2b]">Save Address</button>
      </form>
    </div>
  </div>`;
}

function renderQuickViewModal() {
  if (!state.quickViewOpen || !state.quickViewProduct) return '';
  const p = state.quickViewProduct;
  return `<div class="fixed inset-0 z-[100] flex items-center justify-center p-4">
    <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" onclick="app.closeQuickView()"></div>
    <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-fade-in">
      <button onclick="app.closeQuickView()" class="absolute top-4 right-4 z-10 p-2 bg-white rounded-full shadow text-gray-500">${ICONS.close}</button>
      <div class="grid grid-cols-2">
        <div class="aspect-square bg-gray-100 overflow-hidden"><img src="${p.image}" class="w-full h-full object-cover" /></div>
        <div class="p-6 flex flex-col"><div class="text-xs text-[#FF6B35] font-bold uppercase mb-1">${p.category}</div><h3 class="text-xl font-bold text-gray-900 mb-2">${p.name}</h3><div class="text-2xl font-bold text-gray-900 mb-3">${p.displayPrice}</div><p class="text-sm text-gray-500 mb-4 flex-1">${p.description}</p><div class="space-y-3"><button onclick="app.addToCartById(${p.id});app.closeQuickView();" class="w-full py-3 bg-[#FF6B35] text-white rounded-xl font-bold hover:bg-[#e55a2b]">Add to Cart</button><button onclick="app.selectProductById(${p.id});app.closeQuickView();" class="w-full py-2 border border-gray-200 rounded-xl text-sm font-medium hover:border-[#FF6B35]">View Full Details</button></div></div>
      </div>
    </div>
  </div>`;
}

function renderCategoryModal() {
  if (!state.categoryModalOpen || !state.categoryModalData) return '';
  const m = state.categoryModalData;
  return `<div class="fixed inset-0 z-[90] flex justify-end">
    <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" onclick="app.closeCategoryModal()"></div>
    <div class="relative bg-white w-full max-w-2xl h-full overflow-y-auto shadow-2xl animate-fade-in">
      <div class="sticky top-0 bg-white border-b border-gray-100 px-6 py-5 flex justify-between items-center z-10"><div><h2 class="text-xl font-bold mb-1">${m.title}</h2><div class="h-1 bg-[#FF6B35] w-12 rounded-full"></div></div><button onclick="app.closeCategoryModal()" class="p-2 hover:bg-gray-100 rounded-full">${ICONS.close}</button></div>
      <div class="p-6"><div class="grid grid-cols-2 md:grid-cols-3 gap-6">${m.items.map(item => `<div onclick="app.selectSubCategory('${item.category}')" class="group cursor-pointer"><div class="aspect-square bg-gray-100 rounded-2xl overflow-hidden mb-3 group-hover:shadow-lg transition-all border border-gray-100 group-hover:border-[#FF6B35]"><img src="${item.image}" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" /></div><p class="text-sm font-semibold text-gray-700 text-center group-hover:text-[#FF6B35]">${item.name}</p></div>`).join('')}</div></div>
    </div>
  </div>`;
}

function renderReturnModal() {
  if (!state.returnModalOpen || !state.returnOrder) return '';
  return `<div class="fixed inset-0 z-[100] flex items-center justify-center p-4">
    <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" onclick="app.closeReturnModal()"></div>
    <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-md animate-fade-in">
      <div class="p-6 border-b border-gray-100 flex justify-between items-center"><h3 class="text-xl font-bold">Return Request</h3><button onclick="app.closeReturnModal()" class="text-gray-400">${ICONS.close}</button></div>
      <form onsubmit="app.submitReturn(event)" class="p-6 space-y-4">
        <p class="text-sm text-gray-600">Order: <strong>#${state.returnOrder.id}</strong></p>
        <div><label class="block text-sm font-bold text-gray-700 mb-2">Reason</label><select name="reason" required class="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-[#FF6B35] outline-none bg-white"><option value="">Select reason…</option><option>Wrong size</option><option>Wrong product</option><option>Defective product</option><option>Changed my mind</option></select></div>
        <div><label class="block text-sm font-bold text-gray-700 mb-2">Comments</label><textarea name="comments" rows="3" class="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-[#FF6B35] outline-none resize-none"></textarea></div>
        <button type="submit" class="w-full py-3 bg-[#FF6B35] text-white font-bold rounded-lg hover:bg-[#e55a2b]">Submit Return</button>
      </form>
    </div>
  </div>`;
}

function renderChatWidget() {
  return `<div class="fixed bottom-6 right-6 z-50">
    ${state.chatOpen ? `<div class="mb-4 w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden animate-fade-in">
      <div class="bg-gray-900 p-4 flex justify-between items-center"><div class="flex items-center gap-3"><div class="w-8 h-8 bg-[#FF6B35] rounded-full flex items-center justify-center text-white font-bold text-sm">FH</div><div><p class="text-white font-bold text-sm">Fashion Hub Support</p><p class="text-gray-400 text-xs">Usually replies instantly</p></div></div><button onclick="app.toggleChat()" class="text-gray-400 hover:text-white">${ICONS.close}</button></div>
      <div class="h-64 overflow-y-auto p-4 space-y-3 bg-gray-50" id="chat-messages">${state.chatMessages.length === 0 ? '<p class="text-xs text-gray-400 text-center mt-8">👋 Hi! How can we help?</p>' : state.chatMessages.map(m => `<div class="flex ${m.from === 'user' ? 'justify-end' : 'justify-start'}"><div class="max-w-[70%] px-4 py-2 rounded-2xl text-sm ${m.from === 'user' ? 'bg-[#FF6B35] text-white rounded-br-sm' : 'bg-white text-gray-800 border border-gray-100 rounded-bl-sm shadow-sm'}">${m.text}<div class="text-[10px] ${m.from === 'user' ? 'text-orange-200' : 'text-gray-400'} mt-1">${m.time}</div></div></div>`).join('')}</div>
      <div class="p-3 border-t border-gray-100 bg-white flex gap-2"><input type="text" id="chat-input" placeholder="Type a message…" class="flex-1 border border-gray-200 rounded-full px-4 py-2 text-sm focus:ring-1 focus:ring-[#FF6B35] outline-none" onkeypress="if(event.key==='Enter'){app.sendChatMessage(document.getElementById('chat-input').value);document.getElementById('chat-input').value='';}" /><button onclick="const i=document.getElementById('chat-input');app.sendChatMessage(i.value);i.value='';" class="w-9 h-9 bg-[#FF6B35] rounded-full flex items-center justify-center text-white">→</button></div>
    </div>` : ''}
    <button onclick="app.toggleChat()" class="w-14 h-14 bg-[#FF6B35] rounded-full shadow-2xl flex items-center justify-center text-white hover:bg-[#e55a2b] hover:scale-110 transition-all">
      ${state.chatOpen ? ICONS.close : '<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 3H3v13h5l3 5 3-5h7V3z" /></svg>'}
    </button>
  </div>`;
}

function renderRecentlyViewed() {
  if (state.recentlyViewed.length === 0) return '';
  return `<section class="py-12 bg-gray-50"><div class="max-w-7xl mx-auto px-4 md:px-6">
    <h2 class="text-2xl font-bold mb-8 text-gray-900">Recently Viewed</h2>
    <div class="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
      ${state.recentlyViewed.map(p => `<div onclick="app.selectProductById(${p.id})" class="flex-shrink-0 w-40 cursor-pointer group"><div class="w-40 h-40 bg-gray-100 rounded-xl overflow-hidden mb-2 group-hover:shadow-lg transition-all"><img src="${p.image}" class="w-full h-full object-cover group-hover:scale-110 transition-transform" loading="lazy" /></div><p class="text-xs font-medium text-gray-800 line-clamp-2 group-hover:text-[#FF6B35]">${p.name}</p><p class="text-sm font-bold text-gray-900 mt-1">${p.displayPrice || '₹' + p.price}</p></div>`).join('')}
    </div>
  </div></section>`;
}

function renderFooter() {
  return `<footer class="bg-gray-900 text-gray-400 py-16 border-t border-gray-800"><div class="max-w-7xl mx-auto px-4 md:px-6">
    <div class="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
      <div><div class="flex items-center gap-2 mb-6"><div class="w-8 h-8 text-white">${ICONS.logoMoon}</div><span class="text-xl font-bold text-white">FASHION HUB</span></div><p class="text-sm leading-relaxed">India's most trusted fashion destination.</p></div>
      <div><h4 class="text-white font-bold mb-6">Shop</h4><ul class="space-y-3 text-sm">${['Men\'s Fashion', 'Women\'s Fashion', 'Kids Collection', 'Footwear', 'Accessories'].map(i => `<li><a href="#" class="hover:text-[#FF6B35]">${i}</a></li>`).join('')}</ul></div>
      <div><h4 class="text-white font-bold mb-6">Support</h4><ul class="space-y-3 text-sm">${['Track Order', 'Return Policy', 'FAQs', 'Size Guide', 'Contact Us'].map(i => `<li><a href="#" class="hover:text-[#FF6B35]">${i}</a></li>`).join('')}</ul></div>
      <div><h4 class="text-white font-bold mb-6">Newsletter</h4><p class="text-sm mb-4">Subscribe for exclusive deals.</p><div class="flex gap-2"><input type="email" placeholder="Email" class="bg-gray-800 rounded-lg px-4 py-2 text-white w-full focus:ring-1 focus:ring-[#FF6B35] outline-none" /><button class="bg-[#FF6B35] text-white px-4 py-2 rounded-lg font-bold hover:bg-[#e55a2b]">Go</button></div><div class="mt-6"><p class="text-xs text-gray-500 mb-2">We Accept</p><div class="flex gap-2"><span class="text-xs bg-gray-800 px-3 py-1 rounded">💵 COD</span><span class="text-xs bg-gray-800 px-3 py-1 rounded">🏧 Bank Transfer</span></div></div></div>
    </div>
    <div class="border-t border-gray-800 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-sm"><p>&copy; ${new Date().getFullYear()} Fashion Hub. All rights reserved.</p><div class="flex gap-6"><a href="#" class="hover:text-[#FF6B35]">Privacy Policy</a><a href="#" class="hover:text-[#FF6B35]">Terms</a><a href="#" class="hover:text-[#FF6B35]">Shipping</a></div></div>
  </div></footer>`;
}

// ── MAIN RENDER ───────────────────────────────────────────────────────────────
const root = document.getElementById('root');
let intervalId = null;

function render() {
  if (state.currentProduct || state.selectedCategory || state.searchQuery || state.view !== 'home' || state.authModalOpen) {
    if (intervalId) { clearInterval(intervalId); intervalId = null; }
  } else {
    if (!intervalId) intervalId = setInterval(() => { state.currentSlide = (state.currentSlide + 1) % SLIDES.length; render(); }, 6000);
  }

  if (state.view === 'adminLogin') { root.innerHTML = renderAdminLogin(); return; }
  if (state.view === 'admin') {
    root.innerHTML = renderAdminDashboard();
    if (!state.adminUsers.length) app.loadAdminsFromBackend();
    if (!state.adminOrders.length) app.loadOrdersFromBackend();
    return;
  }

  let mainContent = '';
  if (state.view === 'tracking') {
    mainContent = renderTrackingPage();
  } else if (state.currentProduct) {
    mainContent = renderProductDetails();
  } else {
    const isHome = !state.selectedCategory && !state.searchQuery;
    mainContent = `${isHome ? renderHero() : ''}${isHome ? renderCategoryCards() : ''}${isHome ? renderBadges() : ''}${renderProductList()}${isHome && state.recentlyViewed.length > 0 ? renderRecentlyViewed() : ''}`;
  }

  root.innerHTML = `
    ${renderHeader()}
    <main>${mainContent}</main>
    ${state.view !== 'admin' && state.view !== 'adminLogin' ? renderFooter() : ''}
    ${renderCartDrawer()}
    ${renderWishlistDrawer()}
    ${renderCheckoutModal()}
    ${renderAuthModal()}
    ${renderCompareModal()}
    ${renderReviewModal()}
    ${renderProfileModal()}
    ${renderAddressModal()}
    ${renderReturnModal()}
    ${renderQuickViewModal()}
    ${renderCategoryModal()}
    ${renderChatWidget()}
  `;

  const chatDiv = document.getElementById('chat-messages');
  if (chatDiv) chatDiv.scrollTop = chatDiv.scrollHeight;
}

function loadPendingAdmins() { /* handled inside renderAdminUsers */ }

window.app = app;
window.PRODUCTS = PRODUCTS;
window.applyCoupon = applyCoupon;
window.removeCoupon = removeCoupon;

initApp();
