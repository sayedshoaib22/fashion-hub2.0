// --- STATE MANAGEMENT ---
let customSizeTimeout = null;
let searchTimeout = null;

const state = {
    cart: [],
    wishlist: [],
    isCartOpen: false,
    isWishlistOpen: false,
    user: null,
    selectedCategory: null,
    currentProduct: null,
    authModalOpen: false,
    authMode: 'login',
    adminAuthMode: 'login',
    searchQuery: "",
    view: 'home',
    isAdminLoggedIn: false,
    adminUser: null,
    adminOrders: [],
    adminUsers: [],
    products: [],
    checkoutModalOpen: false,
    lastOrder: null,
    activeDropdown: null,
    mobileMenuOpen: false,
    currentSlide: 0,
    sidebarOpen: false,
    activeSubFilter: null,
    categoryModalOpen: false,
    categoryModalData: null,
    details: { size: 'M', color: 'Black', zoom: false, currentPrice: 0, currentImage: null },
    otpModalOpen: false,
    otpValue: '',
    otpTimer: 60,
    generatedOTP: null,
    pendingUser: null,
    paymentModalOpen: false,
    selectedPaymentMethod: null,
    paymentOTP: null,
    selectedBranch: null,
    upiPaymentModalOpen: false,
    currentTransaction: null,
    paymentCheckInterval: null,
    cardPaymentModalOpen: false,
    // NEW FEATURES
    compareList: [],
    compareModalOpen: false,
    reviewModalOpen: false,
    reviewProduct: null,
    reviews: {},
    recentlyViewed: [],
    couponCode: '',
    appliedCoupon: null,
    notificationsOpen: false,
    notifications: [],
    filterPrice: { min: 0, max: 10000 },
    sortBy: 'default',
    activeTab: 'orders', // admin tabs
    stockAlerts: [],
    orderSearch: '',
    productSearch: '',
    profileModalOpen: false,
    addressModalOpen: false,
    savedAddresses: [],
    returnModalOpen: false,
    returnOrder: null,
    invoiceOrder: null,
    darkMode: false,
    chatOpen: false,
    chatMessages: [],
    productZoomLevel: 1,
    quickViewProduct: null,
    quickViewOpen: false,
    bulkSelected: [],
    analyticsView: 'orders',
    dateFilter: 'all',
    priceRangeActive: false,
};

// --- INITIALIZATION ---
function initApp() {
    const savedCart = localStorage.getItem('fashionHubCart');
    if (savedCart) { try { state.cart = JSON.parse(savedCart); } catch (e) { state.cart = []; } }

    const savedWishlist = localStorage.getItem('fashionHubWishlist');
    if (savedWishlist) { try { state.wishlist = JSON.parse(savedWishlist); } catch (e) { state.wishlist = []; } }

    const savedOrders = localStorage.getItem('sleepSoundOrders');
    if (savedOrders) { try { state.adminOrders = JSON.parse(savedOrders); } catch (e) { state.adminOrders = []; } }

    const savedReviews = localStorage.getItem('fashionHubReviews');
    if (savedReviews) { try { state.reviews = JSON.parse(savedReviews); } catch (e) { state.reviews = {}; } }

    const savedAddresses = localStorage.getItem('fashionHubAddresses');
    if (savedAddresses) { try { state.savedAddresses = JSON.parse(savedAddresses); } catch (e) { state.savedAddresses = []; } }

    const savedRecentlyViewed = localStorage.getItem('fashionHubRecentlyViewed');
    if (savedRecentlyViewed) { try { state.recentlyViewed = JSON.parse(savedRecentlyViewed); } catch (e) { state.recentlyViewed = []; } }

    const savedDarkMode = localStorage.getItem('fashionHubDarkMode');
    if (savedDarkMode === 'true') { state.darkMode = true; document.documentElement.classList.add('dark'); }

    if (!localStorage.getItem('sleepSoundUsers')) localStorage.setItem('sleepSoundUsers', JSON.stringify([]));
    state.adminUsers = [];

    // Add welcome notification
    state.notifications = [
        { id: 1, type: 'promo', message: '🎉 New arrivals! Up to 50% off on Men\'s Collection', time: '2 min ago', read: false },
        { id: 2, type: 'order', message: '📦 Your last order has been delivered', time: '1 hour ago', read: false },
        { id: 3, type: 'offer', message: '🏷️ Use code FASHION20 for 20% off your next order', time: '3 hours ago', read: true },
    ];

    render();

    if (window.backend && typeof app.loadAdminsFromFirebase === 'function') app.loadAdminsFromFirebase();

    if (window.backend && window.firebase) {
        initializeProductsFromFirestore();
        if (app.loadProductsFromFirebase) app.loadProductsFromFirebase();
        if (app.startProductListener) app.startProductListener();
    }
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

function updateCustomSize(key, value) {
    if (customSizeTimeout) clearTimeout(customSizeTimeout);
    state.details[key] = value;
    customSizeTimeout = setTimeout(() => { app.calculatePrice(); render(); customSizeTimeout = null; }, 500);
}

// --- COUPONS ---
const COUPONS = {
    'FASHION20': { type: 'percent', value: 20, minOrder: 500, desc: '20% OFF on orders above ₹500' },
    'FLAT100': { type: 'flat', value: 100, minOrder: 300, desc: '₹100 OFF on orders above ₹300' },
    'WELCOME50': { type: 'percent', value: 50, minOrder: 0, maxDiscount: 250, desc: '50% OFF (max ₹250) for new users' },
    'FREESHIP': { type: 'shipping', value: 0, minOrder: 0, desc: 'Free Shipping on this order' },
};

function applyCoupon() {
    const code = state.couponCode.trim().toUpperCase();
    const coupon = COUPONS[code];
    const total = state.cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

    if (!coupon) { UIUtils && UIUtils.notification.error('Invalid coupon code'); return; }
    if (total < coupon.minOrder) { UIUtils && UIUtils.notification.error(`Minimum order ₹${coupon.minOrder} required`); return; }

    state.appliedCoupon = { code, ...coupon };
    UIUtils && UIUtils.notification.success(`Coupon "${code}" applied! ${coupon.desc}`);
    render();
}

function removeCoupon() { state.appliedCoupon = null; state.couponCode = ''; render(); }

function getDiscount(total) {
    if (!state.appliedCoupon) return 0;
    const c = state.appliedCoupon;
    if (c.type === 'percent') {
        const disc = Math.round(total * c.value / 100);
        return c.maxDiscount ? Math.min(disc, c.maxDiscount) : disc;
    }
    if (c.type === 'flat') return Math.min(c.value, total);
    return 0;
}

// --- CONTROLLERS ---
const app = {
    goHome: () => {
        state.selectedCategory = null; state.currentProduct = null; state.sidebarOpen = false;
        state.activeSubFilter = null; state.searchQuery = ""; state.view = 'home';
        state.sortBy = 'default'; state.priceRangeActive = false;
        window.scrollTo({ top: 0, behavior: 'smooth' }); render();
    },
    selectCategory: (category) => {
        state.activeDropdown = null;
        if (CATEGORY_MODAL_DATA[category]) {
            state.categoryModalOpen = true; state.categoryModalData = CATEGORY_MODAL_DATA[category];
        } else {
            state.selectedCategory = category; state.currentProduct = null; state.mobileMenuOpen = false;
            state.sidebarOpen = false; state.activeSubFilter = null; state.categoryModalOpen = false;
            state.searchQuery = ""; state.view = 'home'; state.sortBy = 'default';
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
        render();
    },
    closeCategoryModal: () => { state.categoryModalOpen = false; state.categoryModalData = null; render(); },
    selectSubCategory: (category) => {
        state.selectedCategory = category; state.currentProduct = null; state.categoryModalOpen = false;
        state.categoryModalData = null; state.activeDropdown = null; state.mobileMenuOpen = false;
        state.sidebarOpen = false; state.activeSubFilter = null; state.searchQuery = "";
        state.view = 'home'; window.scrollTo({ top: 0, behavior: 'smooth' }); render();
    },
    selectProductById: (productId) => {
        const normalizedId = String(productId);
        let product = null;
        if (state.products && state.products.length > 0) product = state.products.find(p => String(p.id) === normalizedId);
        if (!product && PRODUCTS && PRODUCTS.length > 0) product = PRODUCTS.find(p => String(p.id) === normalizedId);
        if (product) app.selectProduct(product);
    },
    selectProduct: (product) => {
        let latestProduct = product;
        if (state.products && state.products.length > 0) {
            const fp = state.products.find(p => String(p.id) === String(product.id));
            if (fp) latestProduct = { ...product, ...fp, images: fp.images || product.images || [product.image], features: fp.features || product.features || [], description: fp.description || product.description, displayPrice: fp.displayPrice || `₹${fp.price.toLocaleString()}` };
        }
        state.currentProduct = latestProduct;
        state.view = 'home';
        const firstSize = latestProduct.sizes ? Object.keys(latestProduct.sizes)[0] : 'M';
        const firstColor = latestProduct.colors && latestProduct.colors[0] ? latestProduct.colors[0] : 'Black';
        state.details = { size: firstSize, color: firstColor, zoom: false, currentPrice: latestProduct.price, currentImage: latestProduct.image };
        app.calculatePrice();
        saveRecentlyViewed(latestProduct);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        render();
    },
    goToTracking: () => { state.view = 'tracking'; state.currentProduct = null; state.selectedCategory = null; state.mobileMenuOpen = false; window.scrollTo({ top: 0, behavior: 'smooth' }); render(); },
    trackOrder: async () => {
        const idInput = document.getElementById('trackInput');
        const resultDiv = document.getElementById('trackResult');
        const id = idInput.value.trim();
        if (!id) { alert('Please enter an Order ID'); return; }
        resultDiv.innerHTML = `<div class="mt-8 text-center text-gray-500 text-sm">Checking your order status...</div>`;
        const res = await backend.trackOrder(id);
        if (!res.success || !res.order) {
            resultDiv.innerHTML = `<div class='mt-8 text-center py-8 bg-red-50 rounded-xl border border-red-100'><div class="text-red-500 font-bold mb-1">Order Not Found</div><p class="text-sm text-red-400">Please check the Order ID and try again.</p></div>`;
            return;
        }
        const order = res.order;
        const steps = ['Order Placed', 'In Hub', 'Packing', 'Given to Rider', 'Out for Delivery', 'Delivered'];
        const stepIdx = steps.indexOf(order.status);
        resultDiv.innerHTML = `
            <div class='mt-8 text-left border-t border-gray-100 pt-8'>
                <div class='flex flex-col md:flex-row justify-between items-start mb-8 gap-4'>
                    <div><h3 class='text-xl font-bold text-gray-900'>Order #${order.orderCode || order.id}</h3><p class='text-sm text-gray-500'>Placed on ${new Date(order.date).toLocaleDateString()}</p></div>
                    <div class='text-left md:text-right'><div class='text-lg font-bold text-[#FF6B35]'>₹${Number(order.total).toLocaleString()}</div><div class='text-sm text-gray-600'>Branch: ${order.branch}</div></div>
                </div>
                <div class='relative px-4 md:px-0'>
                    <div class='absolute left-8 md:left-8 top-0 bottom-0 w-0.5 bg-gray-200'></div>
                    <div class='space-y-8'>
                        ${steps.map((step, idx) => {
                            const completed = idx <= stepIdx; const current = idx === stepIdx;
                            return `<div class='relative flex items-center gap-6'><div class='w-16 flex justify-center z-10'><div class='w-8 h-8 rounded-full flex items-center justify-center border-2 bg-white ${completed ? 'border-green-500 text-green-500' : 'border-gray-300 text-gray-300'} ${current ? 'ring-4 ring-green-100' : ''}'>${completed ? '✓' : `<span class="text-xs font-bold">${idx + 1}</span>`}</div></div><div class='${completed ? 'text-gray-900 font-bold' : 'text-gray-400'}'>${step}${current ? '<span class="ml-2 text-xs bg-orange-100 text-[#FF6B35] px-2 py-0.5 rounded-full">Current Status</span>' : ''}</div></div>`;
                        }).join('')}
                    </div>
                </div>
                <div class='mt-8 bg-gray-50 p-6 rounded-xl border border-gray-100'>
                    <h4 class='font-bold text-sm text-gray-900 uppercase tracking-wider mb-4'>Order Items</h4>
                    <div class="space-y-3">
                        ${order.items.map(i => `<div class='flex justify-between items-center text-sm'><div class="flex items-center gap-3"><div class="w-10 h-10 rounded bg-gray-200 overflow-hidden"><img src="${i.image}" class="w-full h-full object-cover"></div><div><div class="font-medium text-gray-900">${i.name}</div><div class="text-xs text-gray-500">Qty: ${i.quantity}${i.selectedSize ? ` • Size: ${i.selectedSize}` : ''}${i.selectedColor ? ` • ${i.selectedColor}` : ''}</div></div></div><span class="font-bold text-gray-900">₹${(i.price * i.quantity).toLocaleString()}</span></div>`).join('')}
                    </div>
                </div>
                <div class="mt-4 flex gap-3">
                    <button onclick="app.downloadInvoice('${order.orderCode || order.id}')" class="flex-1 py-2 bg-gray-900 text-white rounded-lg text-sm font-bold hover:bg-black">Download Invoice</button>
                    ${order.status !== 'Delivered' ? '' : `<button onclick="app.openReturnModal('${order.orderCode || order.id}')" class="flex-1 py-2 border border-red-300 text-red-600 rounded-lg text-sm font-bold hover:bg-red-50">Request Return</button>`}
                </div>
            </div>`;
    },
    goToAdmin: () => {
        state.view = state.isAdminLoggedIn ? 'admin' : 'adminLogin';
        state.currentProduct = null; state.selectedCategory = null; state.mobileMenuOpen = false;
        state.isCartOpen = false; state.authModalOpen = false; state.checkoutModalOpen = false;
        state.categoryModalOpen = false; state.activeDropdown = null;
        window.scrollTo({ top: 0, behavior: 'smooth' }); render();
    },
    handleSearch: (value) => {
        state.searchQuery = value;
        if (searchTimeout) clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            if (state.currentProduct) state.currentProduct = null;
            if (state.view !== 'home') state.view = 'home';
            render();
        }, 150);
    },
    toggleCart: (isOpen) => { state.isCartOpen = isOpen; if (isOpen) state.isWishlistOpen = false; render(); },
    toggleWishlist: (isOpen) => { state.isWishlistOpen = isOpen; if (isOpen) state.isCartOpen = false; render(); },
    toggleAuth: (isOpen, mode = 'login') => {
        state.authModalOpen = isOpen; state.authMode = mode;
        if (isOpen) { state.isCartOpen = false; state.mobileMenuOpen = false; state.activeDropdown = null; state.categoryModalOpen = false; state.checkoutModalOpen = false; state.sidebarOpen = false; }
        render();
    },
    toggleAdminAuthMode: (mode) => { state.adminAuthMode = mode; render(); },
    toggleMobileMenu: () => { state.mobileMenuOpen = !state.mobileMenuOpen; render(); },
    setDropdown: (category) => { state.activeDropdown = state.activeDropdown === category ? null : category; render(); },
    closeDropdown: () => { state.activeDropdown = null; render(); },
    setSidebarOpen: (isOpen) => { state.sidebarOpen = isOpen; render(); },
    setSubFilter: (filter) => { state.activeSubFilter = state.activeSubFilter === filter ? null : filter; render(); },
    setSlide: (index) => { state.currentSlide = index; render(); },
    toggleCheckoutModal: (isOpen) => { state.checkoutModalOpen = isOpen; if (isOpen) state.isCartOpen = false; render(); },
    setSortBy: (val) => { state.sortBy = val; render(); },
    setDateFilter: (val) => { state.dateFilter = val; render(); },

    // --- WISHLIST ---
    toggleWishlistItem: (product) => {
        const idx = state.wishlist.findIndex(p => p.id === product.id);
        if (idx >= 0) { state.wishlist.splice(idx, 1); UIUtils && UIUtils.notification.info('Removed from wishlist'); }
        else { state.wishlist.push(product); UIUtils && UIUtils.notification.success('Added to wishlist! ❤️'); }
        saveWishlist(); render();
    },
    isInWishlist: (productId) => state.wishlist.some(p => p.id === productId),
    moveToCart: (product) => {
        app.addToCart(product);
        state.wishlist = state.wishlist.filter(p => p.id !== product.id);
        saveWishlist(); render();
    },
    removeFromWishlist: (productId) => { state.wishlist = state.wishlist.filter(p => p.id !== productId); saveWishlist(); render(); },

    // --- COMPARE ---
    toggleCompare: (product) => {
        const idx = state.compareList.findIndex(p => p.id === product.id);
        if (idx >= 0) { state.compareList.splice(idx, 1); }
        else if (state.compareList.length < 3) { state.compareList.push(product); UIUtils && UIUtils.notification.info('Added to compare'); }
        else { UIUtils && UIUtils.notification.warning('Max 3 products can be compared'); }
        render();
    },
    openCompare: () => { if (state.compareList.length < 2) { UIUtils && UIUtils.notification.warning('Select at least 2 products to compare'); return; } state.compareModalOpen = true; render(); },
    closeCompare: () => { state.compareModalOpen = false; render(); },
    clearCompare: () => { state.compareList = []; render(); },

    // --- QUICK VIEW ---
    openQuickView: (product) => { state.quickViewProduct = product; state.quickViewOpen = true; render(); },
    closeQuickView: () => { state.quickViewOpen = false; state.quickViewProduct = null; render(); },

    // --- NOTIFICATIONS ---
    toggleNotifications: () => { state.notificationsOpen = !state.notificationsOpen; render(); },
    markAllRead: () => { state.notifications.forEach(n => n.read = true); render(); },
    clearNotification: (id) => { state.notifications = state.notifications.filter(n => n.id !== id); render(); },

    // --- DARK MODE ---
    toggleDarkMode: () => {
        state.darkMode = !state.darkMode;
        document.documentElement.classList.toggle('dark', state.darkMode);
        localStorage.setItem('fashionHubDarkMode', state.darkMode);
        render();
    },

    // --- REVIEWS ---
    openReviewModal: (product) => { state.reviewProduct = product; state.reviewModalOpen = true; render(); },
    closeReviewModal: () => { state.reviewModalOpen = false; state.reviewProduct = null; render(); },
    submitReview: (e) => {
        e.preventDefault();
        const form = e.target;
        const rating = parseInt(form.rating.value);
        const title = form.title.value.trim();
        const comment = form.comment.value.trim();
        const productId = state.reviewProduct.id;
        if (!state.reviews[productId]) state.reviews[productId] = [];
        state.reviews[productId].unshift({ id: Date.now(), rating, title, comment, user: state.user ? state.user.name : 'Anonymous', date: new Date().toLocaleDateString(), verified: !!state.user });
        saveReviews();
        app.closeReviewModal();
        UIUtils && UIUtils.notification.success('Review submitted! Thank you 🙏');
        render();
    },
    getAvgRating: (productId) => {
        const reviews = state.reviews[productId];
        if (!reviews || !reviews.length) return 0;
        return (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1);
    },

    // --- PROFILE ---
    openProfile: () => { state.profileModalOpen = true; render(); },
    closeProfile: () => { state.profileModalOpen = false; render(); },
    openAddressModal: () => { state.addressModalOpen = true; render(); },
    closeAddressModal: () => { state.addressModalOpen = false; render(); },
    saveAddress: (e) => {
        e.preventDefault();
        const form = e.target;
        const addr = { id: Date.now(), name: form.name.value, phone: form.phone.value, line1: form.line1.value, city: form.city.value, state: form.addrState.value, pincode: form.pincode.value, isDefault: state.savedAddresses.length === 0 };
        state.savedAddresses.push(addr);
        saveAddresses();
        app.closeAddressModal();
        UIUtils && UIUtils.notification.success('Address saved!');
        render();
    },
    setDefaultAddress: (id) => { state.savedAddresses.forEach(a => a.isDefault = a.id === id); saveAddresses(); render(); },
    deleteAddress: (id) => { state.savedAddresses = state.savedAddresses.filter(a => a.id !== id); saveAddresses(); render(); },

    // --- RETURN ---
    openReturnModal: (orderId) => { state.returnOrder = state.adminOrders.find(o => o.id === orderId || o.orderCode === orderId); state.returnModalOpen = true; render(); },
    closeReturnModal: () => { state.returnModalOpen = false; state.returnOrder = null; render(); },
    submitReturn: (e) => {
        e.preventDefault();
        UIUtils && UIUtils.notification.success('Return request submitted! We\'ll process it within 3-5 days.');
        app.closeReturnModal();
    },

    // --- INVOICE ---
    downloadInvoice: (orderId) => {
        const order = state.adminOrders.find(o => o.id === orderId || o.orderCode === orderId);
        if (!order) { alert('Order not found'); return; }
        const w = window.open('', '_blank');
        w.document.write(generateInvoiceHTML(order));
        w.document.close();
        setTimeout(() => { w.print(); }, 500);
    },

    // --- CHAT ---
    toggleChat: () => { state.chatOpen = !state.chatOpen; render(); },
    sendChatMessage: (msg) => {
        if (!msg.trim()) return;
        state.chatMessages.push({ id: Date.now(), text: msg, from: 'user', time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) });
        render();
        setTimeout(() => {
            const responses = ['Hi! How can I help you today?', 'Sure, I can help you with that!', 'Please allow 24 hours for our team to respond to complex queries.', 'You can track your order using the Order ID sent to your email.', 'Our return policy allows returns within 7 days of delivery.', 'Free shipping on orders above ₹999!'];
            state.chatMessages.push({ id: Date.now() + 1, text: responses[Math.floor(Math.random() * responses.length)], from: 'support', time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) });
            render();
        }, 1200);
    },

    // --- AUTH ---
    registerUser: (e) => {
        e.preventDefault();
        const name = e.target.name.value; const email = e.target.email.value;
        const pass = e.target.password.value; const confirm = e.target.confirmPassword.value;
        if (pass !== confirm) return alert("Passwords do not match");
        if (pass.length < 6) return alert("Password must be at least 6 characters");
        const users = JSON.parse(localStorage.getItem('sleepSoundUsers'));
        if (users.find(u => u.email === email)) return alert("Email already registered");
        const newUser = { id: Date.now(), name, email, password: pass, createdAt: new Date().toISOString() };
        users.push(newUser);
        localStorage.setItem('sleepSoundUsers', JSON.stringify(users));
        state.user = newUser; state.authModalOpen = false;
        UIUtils && UIUtils.notification.success(`Welcome, ${name}! 🎉`);
        render();
    },
    login: (e) => {
        e.preventDefault();
        const email = e.target.email.value; const pass = e.target.password.value;
        const users = JSON.parse(localStorage.getItem('sleepSoundUsers'));
        const user = users.find(u => u.email === email && u.password === pass);
        if (user) {
            state.generatedOTP = Math.floor(100000 + Math.random() * 900000).toString();
            state.pendingUser = user; state.authModalOpen = false; state.otpModalOpen = true; state.otpTimer = 60;
            console.log('Demo OTP:', state.generatedOTP);
            alert('Demo OTP: ' + state.generatedOTP);
            const interval = setInterval(() => { state.otpTimer--; if (state.otpTimer <= 0) { clearInterval(interval); state.otpModalOpen = false; state.generatedOTP = null; } render(); }, 1000);
        } else { alert("Invalid Email or Password"); }
        render();
    },
    verifyOTP: () => {
        if (state.otpValue === state.generatedOTP) {
            state.user = state.pendingUser; state.otpModalOpen = false; state.otpValue = ''; state.generatedOTP = null; state.pendingUser = null;
            UIUtils && UIUtils.notification.success(`Welcome back, ${state.user.name}! 👋`);
        } else { alert('Invalid OTP'); }
        render();
    },
    updateOTP: (value) => { state.otpValue = value; render(); },
    logout: () => {
        state.user = null; state.isAdminLoggedIn = false; state.adminUser = null;
        if (state.view === 'admin') state.view = 'home';
        UIUtils && UIUtils.notification.info('Logged out successfully');
        render();
    },

    // --- ADMIN AUTH ---
    adminLogin: async (e) => {
        e.preventDefault();
        const username = e.target.username.value.trim(); const password = e.target.password.value.trim();
        const res = await backend.adminLogin(username, password);
        if (!res.success) { alert(res.message); return; }
        state.adminUser = res.admin; state.isAdminLoggedIn = true;
        await app.loadAdminsFromFirebase();
        app.goToAdmin();
        if (state.adminUser && state.adminUser.isMain) loadPendingAdmins();
    },
    registerAdmin: async (e) => {
        e.preventDefault();
        const form = e.target; const submitBtn = form.querySelector('button[type="submit"]');
        const username = form.username.value.trim(); const pass = form.password.value.trim();
        const confirm = form.confirmPassword && form.confirmPassword.value.trim();
        if (pass !== confirm) { alert("Passwords do not match"); return; }
        if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Submitting...'; }
        try {
            const res = await backend.registerAdmin(username, pass);
            if (!res.success) { alert(res.message || 'Failed to request admin access'); if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Submit Request'; } return; }
            alert(res.message); state.adminAuthMode = 'login';
            if (app.loadAdminsFromFirebase) await app.loadAdminsFromFirebase();
            if (state.adminUser && state.adminUser.isMain && typeof loadPendingAdmins === 'function') await loadPendingAdmins();
            render();
        } catch (error) { alert('An error occurred. Please try again.'); if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Submit Request'; } }
    },
    loadAdminsFromFirebase: async function () { const res = await backend.getAdmins(); state.adminUsers = res.success ? res.admins : []; if (typeof render === "function") render(); },
    loadOrdersFromFirebase: async function () { const res = await backend.getOrders(); state.adminOrders = res.success ? res.orders : []; if (typeof saveOrders === 'function') saveOrders(); if (typeof render === "function") render(); },
    loadProductsFromFirebase: async function () {
        const res = await backend.getProducts();
        if (res.success) {
            state.products = res.products;
            if (res.products && res.products.length > 0) {
                res.products.forEach(fp => {
                    const ei = PRODUCTS.findIndex(p => p.id === fp.id);
                    if (ei >= 0) PRODUCTS[ei] = { ...PRODUCTS[ei], ...fp, displayPrice: fp.displayPrice || `₹${fp.price.toLocaleString()}` };
                    else PRODUCTS.push({ ...fp, displayPrice: fp.displayPrice || `₹${fp.price.toLocaleString()}` });
                });
                window.PRODUCTS = PRODUCTS;
            }
        } else { state.products = []; }
        if (typeof render === "function") render();
    },
    startProductListener: function () {
        if (!backend.listenToProducts) return;
        if (productsListenerUnsubscribe) productsListenerUnsubscribe();
        productsListenerUnsubscribe = backend.listenToProducts((products) => {
            state.products = products;
            if (products && products.length > 0) {
                products.forEach(fp => {
                    const ei = PRODUCTS.findIndex(p => String(p.id) === String(fp.id) || p.id === fp.id);
                    if (ei >= 0) PRODUCTS[ei] = { ...PRODUCTS[ei], ...fp, displayPrice: fp.displayPrice || `₹${fp.price.toLocaleString()}` };
                    else PRODUCTS.push({ ...fp, displayPrice: fp.displayPrice || `₹${fp.price.toLocaleString()}` });
                });
                window.PRODUCTS = PRODUCTS;
                if (state.currentProduct) {
                    const up = products.find(p => String(p.id) === String(state.currentProduct.id));
                    if (up) { state.currentProduct = { ...state.currentProduct, ...up, images: up.images || state.currentProduct.images || [state.currentProduct.image], features: up.features || state.currentProduct.features || [], description: up.description || state.currentProduct.description, displayPrice: up.displayPrice || `₹${up.price.toLocaleString()}` }; app.calculatePrice(); }
                }
                if (typeof render === "function") render();
            }
        });
    },
    refreshAllData: async function () {
        if (app.loadAdminsFromFirebase) await app.loadAdminsFromFirebase();
        if (app.loadOrdersFromFirebase) await app.loadOrdersFromFirebase();
        if (app.loadProductsFromFirebase) await app.loadProductsFromFirebase();
        if (state.adminUser && state.adminUser.isMain && typeof loadPendingAdmins === 'function') await loadPendingAdmins();
        UIUtils && UIUtils.notification.success('Data refreshed!');
        if (typeof render === "function") render();
    },
    approveAdmin: async function (id) {
        if (!confirm("Approve this admin?")) return;
        const res = await backend.updateAdminStatus(id, "approved");
        if (!res.success) { alert(res.message || "Failed to update status"); return; }
        await loadPendingAdmins(); await app.loadAdminsFromFirebase();
        UIUtils && UIUtils.notification.success('Admin approved!');
    },
    rejectAdmin: async function (id) {
        if (!confirm("Reject this admin?")) return;
        const res = await backend.updateAdminStatus(id, "rejected");
        if (!res.success) { alert(res.message || "Failed to update status"); return; }
        await loadPendingAdmins(); await app.loadAdminsFromFirebase();
    },
    removeAdmin: (id) => {
        if (!confirm("Are you sure you want to permanently remove this admin account?")) return;
        const adminToDelete = state.adminUsers.find(a => a.id === id);
        if (!adminToDelete) return;
        if (adminToDelete.username === 'admin' || adminToDelete.isMain) { alert("Security Alert: The Main Admin account cannot be removed."); return; }
        alert("Admin removal requires Firestore delete operation.");
        if (state.adminUser && state.adminUser.id === id) { alert("You have removed your own account. Logging out."); app.logout(); }
        else app.loadAdminsFromFirebase();
    },
    setAdminTab: (tab) => { state.activeTab = tab; render(); },
    setAnalyticsView: (view) => { state.analyticsView = view; render(); },

    // --- CART ---
    addToCart: (product, options = {}) => {
        const normalized = { selectedSize: options.selectedSize || 'M', selectedColor: options.selectedColor || (product.colors && product.colors[0]) || 'Black' };
        const existing = state.cart.find(item => item.id === product.id && (item.selectedSize || 'M') === normalized.selectedSize && (item.selectedColor || 'Black') === normalized.selectedColor);
        if (existing) { existing.quantity += 1; if (typeof options.price === 'number') existing.price = options.price; }
        else state.cart.push({ ...product, quantity: 1, ...normalized, ...options });
        saveCart(); state.isCartOpen = true;
        UIUtils && UIUtils.notification.success('Added to cart! 🛒');
        render();
    },
    removeFromCart: (index) => { state.cart.splice(index, 1); saveCart(); render(); },
    updateQuantity: (index, delta) => { const item = state.cart[index]; if (item) { item.quantity = Math.max(1, item.quantity + delta); saveCart(); } render(); },
    addToCartById: (productId) => {
        const products = state.products && state.products.length > 0 ? state.products : PRODUCTS;
        const product = products.find(p => String(p.id) === String(productId));
        if (product) app.addToCart(product);
    },
    addToCartCurrent: () => {
        const { size, color, currentPrice } = state.details;
        app.addToCart({ ...state.currentProduct, price: currentPrice }, { selectedSize: size, selectedColor: color, price: currentPrice });
    },

    // --- CHECKOUT ---
    confirmOrder: async (e) => {
        e.preventDefault();
        const branch = e.target.branch.value;
        if (!branch) { alert('Please select a branch'); return; }
        if (!state.cart || !state.cart.length) { alert('Your cart is empty'); return; }
        state.selectedBranch = branch; state.checkoutModalOpen = false; state.paymentModalOpen = true; render();
    },
    selectPaymentMethod: (method) => { state.selectedPaymentMethod = method; render(); },
    processPayment: async () => {
        if (!state.selectedPaymentMethod) { alert('Please select a payment method'); return; }
        const total = state.cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
        if (state.selectedPaymentMethod === 'COD') { await app.completeOrder('COD', 'Pending', null); return; }
        if (state.selectedPaymentMethod === 'UPI') { state.upiPaymentModalOpen = true; state.paymentModalOpen = false; render(); setTimeout(() => app.generateUPIQR(total), 100); return; }
        if (state.selectedPaymentMethod === 'Card') { state.cardPaymentModalOpen = true; state.paymentModalOpen = false; render(); return; }
    },
    generateUPIQR: (amount) => {
        const transactionId = 'TXN' + Date.now();
        const upiString = `upi://pay?pa=${UPI_CONFIG.upiId}&pn=${encodeURIComponent(UPI_CONFIG.merchantName)}&am=${amount}&cu=INR&tn=${encodeURIComponent('Order Payment')}&tr=${transactionId}`;
        state.currentTransaction = { id: transactionId, amount, upiString, timestamp: Date.now() };
        const qrContainer = document.getElementById('upi-qr-code');
        if (qrContainer && typeof QRCode !== 'undefined') { qrContainer.innerHTML = ''; new QRCode(qrContainer, { text: upiString, width: 200, height: 200, colorDark: '#000000', colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel.H }); }
    },
    openUPIApp: () => { if (state.currentTransaction) { window.location.href = state.currentTransaction.upiString; app.startPaymentStatusCheck(); } },
    copyUPIId: () => { navigator.clipboard.writeText(UPI_CONFIG.upiId).then(() => { UIUtils && UIUtils.notification.success('UPI ID copied! 📋'); }); },
    startPaymentStatusCheck: () => { state.paymentCheckInterval = setInterval(() => {}, 3000); },
    confirmPaymentManually: async () => {
        if (!state.currentTransaction) return;
        const transactionId = prompt('Enter Transaction ID from your UPI app:');
        if (!transactionId) return;
        await app.completeOrder('UPI', 'Paid', transactionId);
        if (state.paymentCheckInterval) clearInterval(state.paymentCheckInterval);
        state.upiPaymentModalOpen = false; state.currentTransaction = null;
    },
    processCardPayment: async () => {
        const cardNumber = document.getElementById('card-number')?.value;
        const cardName = document.getElementById('card-name')?.value;
        const cardExpiry = document.getElementById('card-expiry')?.value;
        const cardCVV = document.getElementById('card-cvv')?.value;
        if (!cardNumber || !cardName || !cardExpiry || !cardCVV) { alert('Please fill all card details'); return; }
        if (cardNumber.replace(/\s/g, '').length !== 16) { alert('Invalid card number'); return; }
        if (cardCVV.length !== 3) { alert('Invalid CVV'); return; }
        await new Promise(resolve => setTimeout(resolve, 1500));
        await app.completeOrder('Card', 'Paid', 'CARD' + Date.now());
        state.cardPaymentModalOpen = false;
    },
    completeOrder: async (paymentMethod, paymentStatus, paymentId) => {
        const total = state.cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
        const discount = getDiscount(total);
        const finalTotal = total - discount;
        const payload = {
            branch: state.selectedBranch, items: state.cart,
            customer: state.user || { name: 'Guest', email: 'guest@example.com' },
            paymentMethod, paymentStatus, paymentId, discount, finalTotal
        };
        const res = await backend.createOrder(payload);
        if (!res.success) { alert(res.message || 'Failed to place order'); return; }
        for (const item of state.cart) { if (item.selectedSize) await backend.reduceStock(item.id, item.selectedSize, item.quantity); }
        const newOrder = res.order;
        if (!state.adminOrders) state.adminOrders = [];
        state.adminOrders.unshift(newOrder);
        state.cart = []; state.appliedCoupon = null; state.couponCode = '';
        if (typeof saveCart === 'function') saveCart();
        state.paymentModalOpen = false; state.selectedPaymentMethod = null; state.lastOrder = newOrder;
        if (typeof render === 'function') render();
        setTimeout(() => { UIUtils && UIUtils.notification.success(`Order Placed! ID: ${newOrder.orderCode || newOrder.id}`); if (app && typeof app.goToTracking === 'function') app.goToTracking(); }, 300);
    },

    // --- ADMIN ACTIONS ---
    updateOrderStatus: async (orderId, newStatus) => {
        const res = await backend.updateOrderStatus(orderId, newStatus);
        if (res.success) { const order = state.adminOrders.find(o => o.id === orderId || o.orderCode === orderId); if (order) { order.status = newStatus; saveOrders(); } render(); }
        else alert('Failed to update order status');
    },
    updateOrderStatusWithLocation: async (orderId, newStatus, location) => {
        const res = await backend.updateOrderStatus(orderId, newStatus, location);
        if (res.success) { const order = state.adminOrders.find(o => o.id === orderId || o.orderCode === orderId); if (order) { order.status = newStatus; if (location) order.location = location; saveOrders(); } render(); }
    },
    requestNotifyStock: async (productId, size) => {
        const email = state.user ? state.user.email : prompt('Enter your email:');
        if (!email) return;
        const res = await backend.addStockNotification(productId, size, email);
        if (res.success) UIUtils && UIUtils.notification.success('You will be notified when back in stock!');
    },
    savePrice: async (productId, newPrice) => {
        if (!state.adminUser) { alert("Permission denied. Please log in as an admin."); return; }
        const isMainAdmin = state.adminUser.isMain === true; const isApprovedAdmin = state.adminUser.status === "approved";
        if (!isMainAdmin && !isApprovedAdmin) { alert("Permission denied."); return; }
        const newPriceNum = parseInt(newPrice);
        if (isNaN(newPriceNum) || newPriceNum <= 0) { alert("Please enter a valid price."); return; }
        const res = await backend.updateProductPrice(productId, newPriceNum);
        if (!res.success) { alert(res.message || "Failed to update product price."); return; }
        const prod = PRODUCTS.find(p => p.id === parseInt(productId));
        if (prod) { prod.price = newPriceNum; prod.displayPrice = "₹" + newPriceNum.toLocaleString(); }
        UIUtils && UIUtils.notification.success("Price updated successfully!");
        render();
    },
    exportOrders: () => {
        const csv = ['Order ID,Customer,Email,Branch,Total,Status,Payment,Date'];
        state.adminOrders.forEach(o => {
            csv.push(`"${o.id}","${o.customer.name}","${o.customer.email}","${o.branch}","₹${o.total}","${o.status}","${o.paymentMethod || 'N/A'}","${new Date(o.date).toLocaleDateString()}"`);
        });
        const blob = new Blob([csv.join('\n')], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `orders_${Date.now()}.csv`; a.click();
        UIUtils && UIUtils.notification.success('Orders exported!');
    },

    // --- PRODUCT DETAILS ---
    updateDetail: (key, value) => { state.details[key] = value; app.calculatePrice(); render(); },
    calculatePrice: () => {
        const product = state.currentProduct; if (!product) return;
        let basePrice = product.price;
        if (state.products && state.products.length > 0) { const fp = state.products.find(p => String(p.id) === String(product.id)); if (fp && fp.price) { basePrice = fp.price; state.currentProduct.price = basePrice; } }
        let finalPrice = basePrice;
        const { size } = state.details;
        if (product.sizes && product.sizes[size] && product.sizes[size].price) finalPrice = product.sizes[size].price;
        state.details.currentPrice = Math.round(finalPrice);
    },
};

// --- INVOICE GENERATOR ---
function generateInvoiceHTML(order) {
    return `<!DOCTYPE html><html><head><title>Invoice #${order.id}</title><style>body{font-family:Arial,sans-serif;max-width:800px;margin:0 auto;padding:20px;color:#333}h1{color:#FF6B35}.header{display:flex;justify-content:space-between;margin-bottom:30px}.items{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#f5f5f5}.total{text-align:right;margin-top:20px;font-size:1.2em}</style></head><body><div class="header"><div><h1>FASHION HUB</h1><p>Tax Invoice</p></div><div><p><strong>Invoice #:</strong> ${order.id}</p><p><strong>Date:</strong> ${new Date(order.date).toLocaleDateString()}</p></div></div><div><p><strong>Bill To:</strong> ${order.customer.name}</p><p>${order.customer.email}</p><p>Branch: ${order.branch}</p></div><br><table class="items"><thead><tr><th>Product</th><th>Size</th><th>Color</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead><tbody>${order.items.map(i => `<tr><td>${i.name}</td><td>${i.selectedSize || '-'}</td><td>${i.selectedColor || '-'}</td><td>${i.quantity}</td><td>₹${i.price.toLocaleString()}</td><td>₹${(i.price * i.quantity).toLocaleString()}</td></tr>`).join('')}</tbody></table><div class="total"><p><strong>Total: ₹${order.total.toLocaleString()}</strong></p><p>Payment: ${order.paymentMethod || 'N/A'} (${order.paymentStatus || 'N/A'})</p></div><br><p style="text-align:center;color:#666">Thank you for shopping with Fashion Hub!</p></body></html>`;
}

// =====================
// RENDER HELPERS
// =====================
function renderHeader() {
    const cartCount = state.cart.reduce((a, b) => a + b.quantity, 0);
    const wishlistCount = state.wishlist.length;
    const unreadNotifs = state.notifications.filter(n => !n.read).length;

    return `
    <header class="sticky top-0 z-50 bg-white shadow-sm font-sans">
        <div class="border-b border-gray-100">
            <div class="max-w-7xl mx-auto px-4 md:px-6">
                <div class="flex items-center justify-between h-16">
                    <div class="flex items-center cursor-pointer group" onclick="app.goHome()">
                        <div class="w-10 h-10 mr-2 group-hover:scale-110 transition-transform duration-300">${ICONS.logoMoon}</div>
                        <div class="flex flex-col">
                            <span class="text-xl font-bold text-gray-900 tracking-tight leading-none group-hover:text-[#FF6B35] transition-colors">FASHION HUB</span>
                            <span class="text-[10px] text-gray-500 font-medium tracking-widest uppercase">Your Style Destination</span>
                        </div>
                    </div>
                    <div class="hidden md:flex flex-1 max-w-xl mx-8">
                        <div class="relative w-full">
                            <input type="text" value="${state.searchQuery}" oninput="app.handleSearch(this.value)" placeholder="Search products, categories..." class="w-full bg-gray-50 text-gray-900 rounded-full pl-5 pr-12 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6B35] focus:bg-white border border-gray-200 transition-all shadow-sm" />
                            <button class="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#FF6B35]">${ICONS.search}</button>
                        </div>
                    </div>
                    <div class="flex items-center space-x-3 md:space-x-4">
                        <!-- Dark Mode -->
                        <button onclick="app.toggleDarkMode()" title="Toggle dark mode" class="hidden md:flex items-center justify-center w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors text-gray-600">
                            ${state.darkMode ? '☀️' : '🌙'}
                        </button>
                        <!-- Notifications -->
                        <div class="relative">
                            <button onclick="app.toggleNotifications()" class="relative flex items-center text-gray-700 hover:text-[#FF6B35] transition-colors p-1">
                                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                                ${unreadNotifs > 0 ? `<span class="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold min-w-[16px] h-4 flex items-center justify-center rounded-full">${unreadNotifs}</span>` : ''}
                            </button>
                            ${state.notificationsOpen ? renderNotificationsDropdown() : ''}
                        </div>
                        <!-- Wishlist -->
                        <button onclick="app.toggleWishlist(true)" class="relative flex items-center text-gray-700 hover:text-[#FF6B35] transition-colors p-1">
                            <svg class="w-6 h-6" fill="${wishlistCount > 0 ? '#FF6B35' : 'none'}" stroke="${wishlistCount > 0 ? '#FF6B35' : 'currentColor'}" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
                            ${wishlistCount > 0 ? `<span class="absolute -top-1 -right-1 bg-pink-500 text-white text-[10px] font-bold min-w-[16px] h-4 flex items-center justify-center rounded-full">${wishlistCount}</span>` : ''}
                        </button>
                        ${state.user ? `
                            <div class="flex items-center gap-2">
                                <button onclick="app.openProfile()" class="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-[#FF6B35] transition-colors">
                                    <div class="w-8 h-8 bg-[#FF6B35] text-white rounded-full flex items-center justify-center font-bold text-xs">${state.user.name[0].toUpperCase()}</div>
                                    <span class="hidden md:block">Hi, ${state.user.name.split(' ')[0]}</span>
                                </button>
                                <button onclick="app.logout()" class="text-xs text-red-400 hover:text-red-600 font-medium hidden md:block">Logout</button>
                            </div>
                        ` : `
                            <button onclick="app.toggleAuth(true)" class="text-sm text-gray-700 hover:text-[#FF6B35] font-medium transition-colors">Login</button>
                        `}
                        <button onclick="app.toggleCart(true)" class="relative flex items-center text-gray-700 hover:text-[#FF6B35] transition-colors p-1">
                            ${ICONS.cart}
                            ${cartCount > 0 ? `<span class="absolute -top-1 -right-1 bg-[#FF6B35] text-white text-[10px] font-bold min-w-[18px] h-[18px] flex items-center justify-center rounded-full shadow-sm border border-white animate-fade-in">${cartCount}</span>` : ''}
                        </button>
                        <button onclick="app.toggleMobileMenu()" class="md:hidden text-gray-700">${ICONS.menu}</button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Mega Menu -->
        <div class="bg-white border-b border-gray-100 hidden md:block relative">
            <div class="max-w-7xl mx-auto px-4 md:px-6">
                <nav class="flex items-center space-x-1">
                    <button onclick="app.goHome()" class="px-4 py-3 text-sm font-medium text-gray-700 hover:text-[#FF6B35] hover:bg-orange-50 rounded transition-colors">All</button>
                    ${NAV_ITEMS.map(item => `
                        <div class="relative group">
                            <button onclick="app.setDropdown('${item.category}')" class="px-4 py-3 text-sm font-medium rounded transition-colors flex items-center gap-1 ${state.activeDropdown === item.category ? 'text-[#FF6B35] bg-orange-50' : 'text-gray-700 hover:text-[#FF6B35] hover:bg-orange-50'}">
                                ${item.label}<span class="transform transition-transform ${state.activeDropdown === item.category ? 'rotate-180' : ''}">${ICONS.chevronDown}</span>
                            </button>
                            ${state.activeDropdown === item.category ? `
                                <div class="absolute top-full left-0 bg-white shadow-xl border border-gray-200 rounded-b-lg z-50 w-[800px] animate-fade-in" style="top: calc(100% - 1px);">
                                    <div class="p-6 grid grid-cols-12 gap-6">
                                        <div class="col-span-8 grid grid-cols-3 gap-6">
                                            ${item.subItems.map(sub => `<div><h4 class="font-bold text-gray-900 mb-3 text-xs uppercase tracking-wider border-b border-gray-100 pb-2">${sub.label}</h4><ul class="space-y-2">${sub.items.map(link => `<li><button onclick="app.selectCategory('${item.category}')" class="text-sm text-gray-600 hover:text-[#FF6B35] text-left w-full hover:translate-x-1 transition-transform">${link}</button></li>`).join('')}</ul></div>`).join('')}
                                        </div>
                                        <div class="col-span-4">${item.image ? `<div class="rounded-lg overflow-hidden h-full bg-gray-50 group cursor-pointer shadow-inner relative" onclick="app.selectCategory('${item.category}')"><img src="${item.image}" alt="${item.category}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 opacity-90 group-hover:opacity-100" /><div class="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/10 transition-colors"><span class="bg-white/90 backdrop-blur-sm px-4 py-2 rounded text-xs font-bold uppercase tracking-widest shadow-lg">Shop ${item.category}</span></div></div>` : ''}</div>
                                    </div>
                                </div>
                            ` : ''}
                        </div>
                    `).join('')}
                    ${state.compareList.length > 0 ? `<button onclick="app.openCompare()" class="ml-auto px-4 py-2 bg-blue-50 text-blue-700 rounded-lg text-sm font-bold hover:bg-blue-100 flex items-center gap-2"><span>Compare (${state.compareList.length})</span></button>` : ''}
                    <button class="px-4 py-3 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors ${state.compareList.length > 0 ? '' : 'ml-auto'}">Offers</button>
                </nav>
            </div>
        </div>

        <!-- Mobile Search -->
        <div class="md:hidden border-b border-gray-100 p-3 bg-white">
            <div class="relative w-full">
                <input type="text" value="${state.searchQuery}" oninput="app.handleSearch(this.value)" placeholder="Search..." class="w-full bg-gray-50 rounded-lg pl-4 pr-10 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#FF6B35]" />
                <span class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">${ICONS.search}</span>
            </div>
        </div>

        ${state.mobileMenuOpen ? `
            <div class="md:hidden bg-white border-b border-gray-200 max-h-[80vh] overflow-y-auto animate-fade-in absolute w-full z-40 shadow-lg">
                <nav class="p-4 space-y-2">
                    <button onclick="app.goHome(); app.toggleMobileMenu()" class="block w-full text-left px-4 py-3 text-gray-700 font-medium hover:bg-orange-50 rounded">Home</button>
                    ${NAV_ITEMS.map(item => `<button onclick="app.selectCategory('${item.category}'); app.toggleMobileMenu()" class="block w-full text-left px-4 py-3 text-gray-700 font-medium hover:bg-orange-50 rounded">${item.label}</button>`).join('')}
                    <button onclick="app.toggleDarkMode()" class="block w-full text-left px-4 py-3 text-gray-700 font-medium hover:bg-orange-50 rounded">${state.darkMode ? '☀️ Light Mode' : '🌙 Dark Mode'}</button>
                    ${state.user ? `<button onclick="app.logout()" class="block w-full text-left px-4 py-3 text-red-500 font-medium hover:bg-red-50 rounded">Logout</button>` : `<button onclick="app.toggleAuth(true)" class="block w-full text-left px-4 py-3 text-[#FF6B35] font-bold hover:bg-orange-50 rounded">Login / Register</button>`}
                </nav>
            </div>
        ` : ''}
    </header>`;
}

function renderNotificationsDropdown() {
    return `
    <div class="absolute top-full right-0 mt-2 w-80 bg-white rounded-xl shadow-2xl border border-gray-100 z-50 animate-fade-in overflow-hidden">
        <div class="p-4 border-b border-gray-100 flex justify-between items-center">
            <span class="font-bold text-gray-900">Notifications</span>
            <button onclick="app.markAllRead()" class="text-xs text-[#FF6B35] hover:underline">Mark all read</button>
        </div>
        <div class="max-h-72 overflow-y-auto">
            ${state.notifications.length === 0 ? '<p class="p-4 text-sm text-gray-500 text-center">No notifications</p>' :
            state.notifications.map(n => `
                <div class="p-4 border-b border-gray-50 hover:bg-gray-50 flex gap-3 ${n.read ? 'opacity-60' : ''}">
                    <div class="flex-1"><p class="text-sm text-gray-800">${n.message}</p><p class="text-xs text-gray-400 mt-1">${n.time}</p></div>
                    <button onclick="app.clearNotification(${n.id})" class="text-gray-300 hover:text-red-500 text-xs">✕</button>
                </div>
            `).join('')}
        </div>
    </div>`;
}

function renderHero() {
    return `
    <section class="relative w-full h-[500px] md:h-[600px] overflow-hidden bg-gray-900 group">
        ${SLIDES.map((slide, index) => `
            <div class="absolute inset-0 transition-opacity duration-1000 ease-in-out ${index === state.currentSlide ? 'opacity-100 z-10' : 'opacity-0 z-0'}">
                <img src="${slide.image}" alt="${slide.title}" class="w-full h-full object-cover opacity-70 transform ${index === state.currentSlide ? 'scale-100' : 'scale-110'} transition-transform duration-[10000ms]" />
                <div class="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent"></div>
                <div class="absolute inset-0 flex items-center">
                    <div class="max-w-7xl mx-auto px-4 md:px-6 w-full">
                        <div class="max-w-2xl animate-fade-in">
                            ${slide.offer ? `<div class="inline-block bg-[#FF6B35] text-white px-4 py-1.5 rounded-full text-sm font-bold mb-6 shadow-lg">${slide.offer}</div>` : ''}
                            <h1 class="text-4xl md:text-6xl font-bold text-white mb-6 leading-tight drop-shadow-md tracking-tight">${slide.title}</h1>
                            <p class="text-lg md:text-xl text-gray-200 mb-8 max-w-lg leading-relaxed font-light">${slide.subtitle}</p>
                            <button onclick="app.selectCategory('${slide.category}')" class="bg-[#FF6B35] text-white px-8 py-4 rounded-full font-bold text-lg hover:bg-[#e55a2b] transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-1 hover:scale-105 active:scale-95">${slide.cta}</button>
                        </div>
                    </div>
                </div>
            </div>
        `).join('')}
        <div class="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex space-x-3 z-20">
            ${SLIDES.map((_, index) => `<button onclick="app.setSlide(${index})" class="h-1.5 rounded-full transition-all duration-300 ${index === state.currentSlide ? 'bg-[#FF6B35] w-8' : 'bg-white/30 w-4 hover:bg-white'}"></button>`).join('')}
        </div>
    </section>`;
}

function renderCategoryCards() {
    const categories = [
        { name: 'Men', category: 'Men', image: 'https://images.unsplash.com/photo-1490114538077-0a7f8cb49891?auto=format&fit=crop&q=80&w=400' },
        { name: 'Women', category: 'Women', image: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&q=80&w=400' },
        { name: 'Kids', category: 'Kids', image: 'https://images.unsplash.com/photo-1503944583220-79d8926ad5e2?auto=format&fit=crop&q=80&w=400' },
        { name: 'Footwear', category: 'Footwear', image: 'https://images.unsplash.com/photo-1460353581641-37baddab0fa2?auto=format&fit=crop&q=80&w=400' },
        { name: 'Accessories', category: 'Accessories', image: 'https://images.unsplash.com/photo-1492707892479-7bc8d5a4ee93?auto=format&fit=crop&q=80&w=400' },
        { name: 'New Arrivals', category: 'Men', image: 'https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?auto=format&fit=crop&q=80&w=400' }
    ];
    return `
    <section class="py-16 bg-white">
        <div class="max-w-7xl mx-auto px-4 md:px-6">
            <h2 class="text-2xl md:text-3xl font-bold mb-10 text-center text-gray-900 tracking-tight">Shop By Category</h2>
            <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 md:gap-8">
                ${categories.map(cat => `
                    <div onclick="app.selectCategory('${cat.category}')" class="group cursor-pointer">
                        <div class="relative aspect-square bg-gray-100 rounded-2xl overflow-hidden shadow-sm group-hover:shadow-xl transition-all duration-300 mb-4 border border-gray-100">
                            <img src="${cat.image}" alt="${cat.name}" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" loading="lazy" />
                        </div>
                        <h3 class="text-sm md:text-base font-semibold text-gray-900 text-center group-hover:text-[#FF6B35] transition-colors">${cat.name}</h3>
                    </div>
                `).join('')}
            </div>
        </div>
    </section>`;
}

function renderRecentlyViewed() {
    if (state.recentlyViewed.length === 0) return '';
    return `
    <section class="py-12 bg-gray-50">
        <div class="max-w-7xl mx-auto px-4 md:px-6">
            <h2 class="text-2xl font-bold mb-8 text-gray-900">Recently Viewed</h2>
            <div class="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
                ${state.recentlyViewed.map(p => `
                    <div onclick="app.selectProductById(${p.id})" class="flex-shrink-0 w-40 cursor-pointer group">
                        <div class="w-40 h-40 bg-gray-100 rounded-xl overflow-hidden mb-2 group-hover:shadow-lg transition-all">
                            <img src="${p.image}" class="w-full h-full object-cover group-hover:scale-110 transition-transform" loading="lazy" />
                        </div>
                        <p class="text-xs font-medium text-gray-800 line-clamp-2 group-hover:text-[#FF6B35]">${p.name}</p>
                        <p class="text-sm font-bold text-gray-900 mt-1">${p.displayPrice || '₹' + p.price}</p>
                    </div>
                `).join('')}
            </div>
        </div>
    </section>`;
}

function renderProductList() {
    const currentNav = NAV_ITEMS.find(n => n.category === state.selectedCategory);
    const searchLower = state.searchQuery.toLowerCase();
    const products = state.products && state.products.length > 0 ? state.products : PRODUCTS;

    let filteredProducts = products.filter(p => {
        if (searchLower) { if (!p.name.toLowerCase().includes(searchLower) && !p.category.toLowerCase().includes(searchLower) && !(p.subCategory && p.subCategory.toLowerCase().includes(searchLower))) return false; }
        if (state.selectedCategory && p.category !== state.selectedCategory) return false;
        if (state.activeSubFilter && p.subCategory !== state.activeSubFilter) return false;
        if (state.priceRangeActive && (p.price < state.filterPrice.min || p.price > state.filterPrice.max)) return false;
        return true;
    });

    // Sorting
    if (state.sortBy === 'price_asc') filteredProducts = [...filteredProducts].sort((a, b) => a.price - b.price);
    else if (state.sortBy === 'price_desc') filteredProducts = [...filteredProducts].sort((a, b) => b.price - a.price);
    else if (state.sortBy === 'name_asc') filteredProducts = [...filteredProducts].sort((a, b) => a.name.localeCompare(b.name));
    else if (state.sortBy === 'rating') filteredProducts = [...filteredProducts].sort((a, b) => parseFloat(app.getAvgRating(b.id)) - parseFloat(app.getAvgRating(a.id)));

    return `
    <section id="products" class="bg-gray-50 py-12 md:py-16 min-h-screen">
        <div class="max-w-7xl mx-auto px-4 md:px-6">
            <div class="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
                <div>
                    <h2 class="text-3xl font-bold text-gray-900 mb-2 tracking-tight">${state.searchQuery ? `Search Results for "${state.searchQuery}"` : (state.selectedCategory ? `${state.selectedCategory} Collection` : 'Our Bestsellers')}</h2>
                    <p class="text-gray-500">${filteredProducts.length} Products Found</p>
                </div>
                <div class="flex items-center gap-3">
                    <select onchange="app.setSortBy(this.value)" class="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-[#FF6B35] outline-none bg-white">
                        <option value="default" ${state.sortBy === 'default' ? 'selected' : ''}>Sort: Default</option>
                        <option value="price_asc" ${state.sortBy === 'price_asc' ? 'selected' : ''}>Price: Low to High</option>
                        <option value="price_desc" ${state.sortBy === 'price_desc' ? 'selected' : ''}>Price: High to Low</option>
                        <option value="name_asc" ${state.sortBy === 'name_asc' ? 'selected' : ''}>Name: A to Z</option>
                        <option value="rating" ${state.sortBy === 'rating' ? 'selected' : ''}>Top Rated</option>
                    </select>
                    ${state.selectedCategory ? `<button onclick="app.setSidebarOpen(!state.sidebarOpen)" class="md:hidden flex items-center gap-2 bg-white px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium">${ICONS.filter} Filters</button>` : ''}
                </div>
            </div>

            <div class="flex flex-col md:flex-row gap-8">
                ${state.selectedCategory ? `
                    <aside class="md:w-64 flex-shrink-0 ${state.sidebarOpen ? 'block' : 'hidden md:block'} animate-fade-in">
                        <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sticky top-24">
                            <div class="flex justify-between items-center mb-6">
                                <h3 class="font-bold text-gray-900">Filters</h3>
                                <button onclick="app.selectCategory(''); state.priceRangeActive = false;" class="text-xs text-[#FF6B35] hover:underline font-medium">Clear All</button>
                            </div>
                            <!-- Price Range Filter -->
                            <div class="mb-6">
                                <h4 class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Price Range</h4>
                                <div class="space-y-2">
                                    ${[{label:'Under ₹500',min:0,max:500},{label:'₹500-₹1000',min:500,max:1000},{label:'₹1000-₹2000',min:1000,max:2000},{label:'Above ₹2000',min:2000,max:100000}].map(r => `
                                        <button onclick="state.filterPrice={min:${r.min},max:${r.max}};state.priceRangeActive=true;render()" class="text-sm text-left w-full flex items-center gap-2 group px-2 py-1 rounded hover:bg-orange-50 transition-colors">
                                            <div class="w-4 h-4 rounded border flex items-center justify-center transition-colors ${state.priceRangeActive && state.filterPrice.min === r.min ? 'bg-[#FF6B35] border-[#FF6B35]' : 'border-gray-300 group-hover:border-[#FF6B35]'}">
                                                ${state.priceRangeActive && state.filterPrice.min === r.min ? ICONS.check : ''}
                                            </div>
                                            <span class="text-gray-600">${r.label}</span>
                                        </button>
                                    `).join('')}
                                </div>
                            </div>
                            ${currentNav ? `
                                <div class="space-y-6">
                                    ${currentNav.subItems.map(group => `
                                        <div>
                                            <h4 class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">${group.label}</h4>
                                            <ul class="space-y-2">
                                                ${group.items.map(item => `<li><button onclick="app.setSubFilter('${item}')" class="text-sm text-left w-full flex items-center gap-2 transition-all group px-2 py-1 rounded hover:bg-orange-50"><div class="w-4 h-4 rounded border flex items-center justify-center transition-colors ${state.activeSubFilter === item ? 'bg-[#FF6B35] border-[#FF6B35]' : 'border-gray-300 group-hover:border-[#FF6B35]'}">${state.activeSubFilter === item ? ICONS.check : ''}</div><span class="text-gray-600 group-hover:text-gray-900">${item}</span></button></li>`).join('')}
                                            </ul>
                                        </div>
                                    `).join('')}
                                </div>
                            ` : ''}
                        </div>
                    </aside>
                ` : ''}
                <div class="flex-1">
                    ${filteredProducts.length === 0 ? `
                        <div class="text-center py-24 bg-white rounded-2xl border border-dashed border-gray-200">
                            <p class="text-gray-900 text-lg font-medium">No products found.</p>
                            <p class="text-gray-500 mb-6">Try adjusting your search or filters.</p>
                            <button onclick="app.goHome()" class="text-[#FF6B35] hover:underline font-medium">Clear all filters</button>
                        </div>
                    ` : `
                        <div class="grid grid-cols-1 sm:grid-cols-2 ${state.selectedCategory ? 'lg:grid-cols-3' : 'lg:grid-cols-4'} gap-6">
                            ${filteredProducts.map(product => {
                                const discount = product.originalPrice ? Math.round((1 - product.price / parseInt(product.originalPrice.replace(/[₹,]/g, ''))) * 100) : 0;
                                const avgRating = app.getAvgRating(product.id);
                                const reviewCount = (state.reviews[product.id] || []).length;
                                const inWishlist = app.isInWishlist(product.id);
                                const inCompare = state.compareList.some(p => p.id === product.id);
                                return `
                                <div class="group bg-white rounded-2xl overflow-hidden border border-gray-100 hover:shadow-xl transition-all duration-300 flex flex-col h-full transform hover:-translate-y-1 relative">
                                    <div class="relative aspect-[4/3] bg-gray-100 overflow-hidden cursor-pointer" onclick="app.selectProductById(${product.id})">
                                        <img src="${product.image}" alt="${product.name}" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" loading="lazy" />
                                        ${product.badge ? `<div class="absolute top-3 left-3 bg-[#FF6B35] text-white px-3 py-1 rounded-full text-xs font-bold z-10 shadow-sm">${product.badge}</div>` : ''}
                                        ${discount > 0 ? `<div class="absolute top-3 right-3 bg-green-500 text-white px-2 py-1 rounded-full text-xs font-bold z-10">-${discount}%</div>` : ''}
                                        <!-- Hover Actions -->
                                        <div class="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/60 to-transparent translate-y-full group-hover:translate-y-0 transition-transform duration-300 flex gap-2 justify-center">
                                            <button onclick="event.stopPropagation(); app.addToCartById(${product.id})" class="bg-[#FF6B35] text-white font-bold py-2 px-4 rounded-full hover:bg-[#e55a2b] transition-colors shadow-lg text-xs">Add to Cart</button>
                                            <button onclick="event.stopPropagation(); app.openQuickView(${JSON.stringify(product).replace(/"/g, '&quot;')})" class="bg-white text-gray-800 font-bold py-2 px-3 rounded-full hover:bg-gray-100 transition-colors shadow-lg text-xs">Quick View</button>
                                        </div>
                                        <!-- Wishlist btn -->
                                        <button onclick="event.stopPropagation(); app.toggleWishlistItem(${JSON.stringify(product).replace(/"/g, '&quot;')})" class="absolute top-3 right-3 w-8 h-8 bg-white/90 rounded-full flex items-center justify-center shadow transition-all hover:scale-110 opacity-0 group-hover:opacity-100 ${discount > 0 ? 'hidden' : ''}">
                                            <svg class="w-4 h-4" fill="${inWishlist ? '#FF6B35' : 'none'}" stroke="${inWishlist ? '#FF6B35' : 'currentColor'}" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
                                        </button>
                                    </div>
                                    <div class="p-5 flex-1 flex flex-col cursor-pointer" onclick="app.selectProductById(${product.id})">
                                        <div class="text-xs text-[#FF6B35] mb-1 font-bold uppercase tracking-wider">${product.subCategory || product.category}</div>
                                        <h3 class="font-bold text-gray-900 mb-1 line-clamp-2 text-base group-hover:text-[#FF6B35] transition-colors">${product.name}</h3>
                                        ${avgRating > 0 ? `<div class="flex items-center gap-1 mb-2"><div class="flex">${[1,2,3,4,5].map(s => `<span class="text-${s <= Math.round(avgRating) ? 'yellow' : 'gray'}-400 text-sm">★</span>`).join('')}</div><span class="text-xs text-gray-500">${avgRating} (${reviewCount})</span></div>` : ''}
                                        <p class="text-sm text-gray-500 mb-3 line-clamp-2 flex-1 leading-relaxed">${product.description}</p>
                                        <div class="flex items-center justify-between pt-3 border-t border-gray-50 mt-auto">
                                            <div class="flex flex-col">
                                                <span class="text-xl font-bold text-gray-900">${product.displayPrice}</span>
                                                ${product.originalPrice ? `<span class="text-xs text-gray-400 line-through">${product.originalPrice}</span>` : ''}
                                            </div>
                                            <button onclick="event.stopPropagation(); app.toggleCompare(${JSON.stringify(product).replace(/"/g, '&quot;')})" class="text-xs px-2 py-1 rounded border transition-colors ${inCompare ? 'bg-blue-100 text-blue-700 border-blue-300' : 'border-gray-200 text-gray-500 hover:border-blue-300 hover:text-blue-600'}">
                                                ${inCompare ? '✓ Compare' : '+ Compare'}
                                            </button>
                                        </div>
                                    </div>
                                </div>`;
                            }).join('')}
                        </div>
                    `}
                </div>
            </div>
        </div>
    </section>`;
}

function renderProductDetails() {
    const product = state.currentProduct;
    if (!product) return '<section class="bg-white py-8"><div class="max-w-7xl mx-auto px-4"><p>Product not found</p></div></section>';
    const details = state.details;
    const currentImage = details.currentImage || product.image;
    const currentPrice = details.currentPrice || product.price || 0;
    const originalPriceNum = product.originalPrice ? parseInt(product.originalPrice.replace(/[₹,]/g, '')) : 0;
    const basePrice = product.price || 1;
    const savings = Math.max(0, (originalPriceNum * (currentPrice / basePrice)) - currentPrice);
    const scaledOriginalPrice = originalPriceNum ? Math.round(originalPriceNum * (currentPrice / basePrice)) : 0;
    const discount = scaledOriginalPrice ? Math.round((1 - currentPrice / scaledOriginalPrice) * 100) : 0;
    const galleryImages = product.images && product.images.length > 0 ? product.images : [product.image];
    const inWishlist = app.isInWishlist(product.id);
    const productReviews = state.reviews[product.id] || [];
    const avgRating = app.getAvgRating(product.id);

    let sizes = ['S', 'M', 'L', 'XL', 'XXL'];
    if (product.subCategory && (product.subCategory.toLowerCase().includes('jean') || product.subCategory.toLowerCase().includes('trouser') || product.subCategory.toLowerCase().includes('pant'))) {
        sizes = ['28', '30', '32', '34', '36', '38'];
    }

    return `
    <section class="bg-white py-8 md:py-12 animate-fade-in min-h-screen">
        <div class="max-w-7xl mx-auto px-4 md:px-6">
            <!-- Breadcrumb -->
            <nav class="flex items-center gap-2 text-sm text-gray-500 mb-6">
                <button onclick="app.goHome()" class="hover:text-[#FF6B35]">Home</button>
                <span>/</span>
                <button onclick="app.selectCategory('${product.category}')" class="hover:text-[#FF6B35]">${product.category}</button>
                <span>/</span>
                <span class="text-gray-900 font-medium">${product.name}</span>
            </nav>

            <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-16">
                <!-- Image Section -->
                <div class="relative">
                    <div class="sticky top-24">
                        <div class="relative aspect-square bg-gray-100 rounded-3xl overflow-hidden mb-4 cursor-zoom-in group shadow-sm border border-gray-100" onclick="app.updateDetail('zoom', true)">
                            <img src="${currentImage}" alt="${product.name}" class="w-full h-full object-cover transition-transform duration-700" />
                            ${product.badge ? `<div class="absolute top-6 left-6 bg-[#FF6B35] text-white px-4 py-2 rounded-full text-sm font-bold shadow-md">${product.badge}</div>` : ''}
                        </div>
                        <div class="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                            ${galleryImages.map(img => `<button onclick="app.updateDetail('currentImage', '${img}')" class="relative w-20 h-20 flex-shrink-0 rounded-xl overflow-hidden border-2 transition-all ${currentImage === img ? 'border-[#FF6B35] ring-2 ring-[#FF6B35]/20' : 'border-transparent hover:border-gray-300'}"><img src="${img}" class="w-full h-full object-cover" /></button>`).join('')}
                        </div>
                    </div>
                </div>

                <!-- Details Section -->
                <div>
                    <div class="text-sm text-[#FF6B35] font-bold tracking-widest uppercase mb-2">${product.category} • ${product.subCategory || 'General'}</div>
                    <h1 class="text-3xl md:text-5xl font-bold text-gray-900 mb-3 tracking-tight leading-tight">${product.name}</h1>
                    
                    <!-- Rating Summary -->
                    ${avgRating > 0 ? `
                        <div class="flex items-center gap-3 mb-4">
                            <div class="flex">${[1,2,3,4,5].map(s => `<span class="text-${s <= Math.round(avgRating) ? 'yellow' : 'gray'}-400 text-xl">★</span>`).join('')}</div>
                            <span class="font-bold text-gray-900">${avgRating}</span>
                            <span class="text-gray-500 text-sm">(${productReviews.length} reviews)</span>
                            <button onclick="document.getElementById('reviews-section').scrollIntoView({behavior:'smooth'})" class="text-[#FF6B35] text-sm hover:underline">See all</button>
                        </div>
                    ` : ''}

                    <div class="mb-8 p-6 bg-gray-50 rounded-2xl border border-gray-100">
                        <div class="flex items-end gap-4 mb-2">
                            <span class="text-4xl font-bold text-gray-900">₹${currentPrice.toLocaleString()}</span>
                            ${scaledOriginalPrice > 0 ? `<span class="text-xl text-gray-400 line-through mb-1 font-medium">₹${scaledOriginalPrice.toLocaleString()}</span><span class="mb-1 bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-bold">${discount}% OFF</span>` : ''}
                        </div>
                        ${savings > 0 ? `<p class="text-green-600 font-semibold text-sm">You save ₹${Math.round(savings).toLocaleString()} today!</p>` : ''}
                        <p class="text-xs text-gray-400 mt-2 uppercase tracking-wide">Inclusive of all taxes & free shipping</p>
                    </div>

                    <div class="space-y-8">
                        <div>
                            <h3 class="text-sm font-bold text-gray-900 mb-3 uppercase tracking-wider">1. Choose Size</h3>
                            <div class="flex flex-wrap gap-3">
                                ${sizes.map(s => {
                                    const sizeData = product.sizes && product.sizes[s];
                                    const stock = sizeData ? sizeData.stock : 0;
                                    const isOOS = stock <= 0;
                                    return `<button onclick="${isOOS ? '' : `app.updateDetail('size', '${s}')`}" class="px-6 py-3 border rounded-xl font-medium transition-all duration-200 ${isOOS ? 'opacity-40 cursor-not-allowed border-gray-200 line-through' : details.size === s ? 'border-[#FF6B35] bg-orange-50 text-[#FF6B35] shadow-sm ring-1 ring-[#FF6B35]' : 'border-gray-200 text-gray-600 hover:border-[#FF6B35] hover:text-[#FF6B35]'}" ${isOOS ? 'disabled' : ''}>${s}${isOOS ? '' : stock < 10 && stock > 0 ? `<span class="block text-[10px] text-orange-500">${stock} left</span>` : ''}</button>`;
                                }).join('')}
                            </div>
                        </div>
                        <div>
                            <h3 class="text-sm font-bold text-gray-900 mb-3 uppercase tracking-wider">2. Choose Color</h3>
                            <div class="flex flex-wrap gap-3">
                                ${(product.colors || ['Black', 'White', 'Navy', 'Gray']).map(color => {
                                    const colorMap = { 'Black': '#000000', 'White': '#FFFFFF', 'Navy': '#001F3F', 'Gray': '#808080', 'Blue': '#0074D9', 'Red': '#FF4136', 'Green': '#2ECC40', 'Beige': '#F5F5DC', 'Brown': '#8B4513', 'Pink': '#FF69B4' };
                                    return `<button onclick="app.updateDetail('color', '${color}')" class="flex items-center gap-2 px-4 py-3 border rounded-xl font-medium transition-all ${details.color === color ? 'border-[#FF6B35] bg-orange-50 text-[#FF6B35] shadow-sm ring-1 ring-[#FF6B35]' : 'border-gray-200 text-gray-600 hover:border-[#FF6B35]'}"><span class="w-6 h-6 rounded-full border-2 ${color === 'White' ? 'border-gray-300' : 'border-gray-200'}" style="background-color: ${colorMap[color] || '#000'};"></span>${color}</button>`;
                                }).join('')}
                            </div>
                        </div>
                    </div>

                    <div class="mt-10 pt-8 border-t border-gray-100 flex gap-4 sticky bottom-0 bg-white/95 backdrop-blur py-4 md:static md:bg-transparent md:py-0 z-20">
                        <button onclick="app.addToCartCurrent()" class="flex-1 bg-[#FF6B35] text-white py-4 rounded-xl font-bold text-lg hover:bg-[#e55a2b] transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]">
                            Add to Cart — ₹${currentPrice.toLocaleString()}
                        </button>
                        <button onclick="app.toggleWishlistItem(${JSON.stringify(product).replace(/"/g, '&quot;')})" class="px-6 py-4 border-2 rounded-xl transition-colors ${inWishlist ? 'border-[#FF6B35] text-[#FF6B35] bg-orange-50' : 'border-gray-200 hover:border-[#FF6B35] hover:text-[#FF6B35] text-gray-400'}">
                            <svg class="w-6 h-6" fill="${inWishlist ? 'currentColor' : 'none'}" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
                        </button>
                    </div>

                    <!-- Features Grid -->
                    <div class="mt-8 grid grid-cols-2 gap-4">
                        ${product.features.map(feature => `<div class="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-100"><div class="w-8 h-8 rounded-full bg-white flex items-center justify-center text-green-500 shadow-sm border border-gray-100">${ICONS.feature}</div><span class="text-sm font-medium text-gray-700">${feature}</span></div>`).join('')}
                    </div>

                    <!-- Description -->
                    <div class="mt-8">
                        <h3 class="text-lg font-bold text-gray-900 mb-3">Description</h3>
                        <p class="text-gray-600 leading-relaxed text-lg font-light">${product.description}</p>
                    </div>

                    <!-- Share Buttons -->
                    <div class="mt-6 pt-6 border-t border-gray-100">
                        <p class="text-sm text-gray-500 mb-3 font-medium">Share this product:</p>
                        <div class="flex gap-3">
                            <button onclick="navigator.clipboard.writeText(window.location.href).then(()=>UIUtils.notification.success('Link copied!'))" class="px-4 py-2 bg-gray-100 rounded-lg text-sm hover:bg-gray-200 transition-colors">🔗 Copy Link</button>
                            <a href="https://wa.me/?text=${encodeURIComponent(product.name + ' - ' + window.location.href)}" target="_blank" class="px-4 py-2 bg-green-100 text-green-700 rounded-lg text-sm hover:bg-green-200 transition-colors">WhatsApp</a>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Reviews Section -->
            <div id="reviews-section" class="mt-16 pt-8 border-t border-gray-100">
                <div class="flex justify-between items-center mb-8">
                    <h2 class="text-2xl font-bold text-gray-900">Customer Reviews</h2>
                    <button onclick="app.openReviewModal(state.currentProduct)" class="px-6 py-3 bg-[#FF6B35] text-white rounded-xl font-bold hover:bg-[#e55a2b] transition-colors">Write a Review</button>
                </div>
                ${productReviews.length === 0 ? `
                    <div class="text-center py-12 bg-gray-50 rounded-2xl">
                        <p class="text-gray-500 mb-4">No reviews yet. Be the first to review!</p>
                        <button onclick="app.openReviewModal(state.currentProduct)" class="text-[#FF6B35] font-bold hover:underline">Write a Review</button>
                    </div>
                ` : `
                    <div class="grid md:grid-cols-2 gap-6">
                        ${productReviews.map(review => `
                            <div class="bg-gray-50 p-6 rounded-2xl border border-gray-100">
                                <div class="flex justify-between items-start mb-3">
                                    <div>
                                        <div class="flex gap-0.5 mb-1">${[1,2,3,4,5].map(s => `<span class="text-${s <= review.rating ? 'yellow' : 'gray'}-400">★</span>`).join('')}</div>
                                        <h4 class="font-bold text-gray-900">${review.title}</h4>
                                    </div>
                                    ${review.verified ? '<span class="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">✓ Verified</span>' : ''}
                                </div>
                                <p class="text-gray-600 text-sm leading-relaxed">${review.comment}</p>
                                <div class="mt-3 flex items-center gap-2 text-xs text-gray-400">
                                    <span>👤 ${review.user}</span>
                                    <span>•</span>
                                    <span>${review.date}</span>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                `}
            </div>
        </div>
        ${details.zoom ? `<div class="fixed inset-0 z-[100] bg-white flex items-center justify-center p-4 cursor-zoom-out animate-fade-in" onclick="app.updateDetail('zoom', false)"><img src="${currentImage}" alt="${product.name}" class="max-w-full max-h-full object-contain shadow-2xl" /><button class="absolute top-6 right-6 p-2 bg-gray-100 rounded-full hover:bg-gray-200">${ICONS.zoomOut}</button></div>` : ''}
    </section>`;
}

function renderWishlistDrawer() {
    return `
    <div class="fixed inset-0 z-[60] transition-opacity duration-300 ${state.isWishlistOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}">
        <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" onclick="app.toggleWishlist(false)"></div>
        <div class="absolute inset-y-0 right-0 w-full md:w-[420px] bg-white shadow-2xl transform transition-transform duration-300 flex flex-col ${state.isWishlistOpen ? 'translate-x-0' : 'translate-x-full'}">
            <div class="p-6 border-b border-gray-100 flex justify-between items-center">
                <div><h2 class="text-xl font-bold text-gray-900">Wishlist</h2><p class="text-sm text-gray-500">${state.wishlist.length} items</p></div>
                <button onclick="app.toggleWishlist(false)" class="p-2 hover:bg-gray-100 rounded-full text-gray-500">${ICONS.close}</button>
            </div>
            <div class="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50">
                ${state.wishlist.length === 0 ? `
                    <div class="flex flex-col items-center justify-center h-full text-center text-gray-500">
                        <svg class="w-16 h-16 text-gray-200 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
                        <p class="font-bold text-gray-900 mb-2">Your wishlist is empty</p>
                        <button onclick="app.toggleWishlist(false)" class="px-6 py-2 bg-[#FF6B35] text-white rounded-full font-bold hover:bg-[#e55a2b] mt-4">Start Shopping</button>
                    </div>
                ` : state.wishlist.map(item => `
                    <div class="flex gap-4 p-4 bg-white rounded-xl shadow-sm border border-gray-100">
                        <div class="w-20 h-20 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0 cursor-pointer" onclick="app.selectProductById(${item.id}); app.toggleWishlist(false)">
                            <img src="${item.image}" class="w-full h-full object-cover" />
                        </div>
                        <div class="flex-1">
                            <h3 class="font-bold text-gray-900 text-sm line-clamp-2 cursor-pointer hover:text-[#FF6B35]" onclick="app.selectProductById(${item.id}); app.toggleWishlist(false)">${item.name}</h3>
                            <p class="font-bold text-gray-900 mt-1">${item.displayPrice || '₹' + item.price}</p>
                            <div class="flex gap-2 mt-3">
                                <button onclick="app.moveToCart(${JSON.stringify(item).replace(/"/g, '&quot;')})" class="flex-1 py-1.5 bg-[#FF6B35] text-white text-xs font-bold rounded-lg hover:bg-[#e55a2b]">Move to Cart</button>
                                <button onclick="app.removeFromWishlist(${item.id})" class="p-1.5 text-red-400 hover:text-red-600 border border-red-200 rounded-lg hover:bg-red-50">${ICONS.close}</button>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    </div>`;
}

function renderCartDrawer() {
    const subtotal = state.cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const discount = getDiscount(subtotal);
    const total = subtotal - discount;
    return `
    <div class="fixed inset-0 z-[60] transition-opacity duration-300 ${state.isCartOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}">
        <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" onclick="app.toggleCart(false)"></div>
        <div class="absolute inset-y-0 right-0 w-full md:w-[450px] bg-white shadow-2xl transform transition-transform duration-300 flex flex-col ${state.isCartOpen ? 'translate-x-0' : 'translate-x-full'}">
            <div class="p-6 border-b border-gray-100 flex justify-between items-center bg-white z-10">
                <div><h2 class="text-xl font-bold text-gray-900">Your Cart</h2><p class="text-sm text-gray-500">${state.cart.reduce((a, b) => a + b.quantity, 0)} items</p></div>
                <button onclick="app.toggleCart(false)" class="p-2 hover:bg-gray-100 rounded-full text-gray-500">${ICONS.close}</button>
            </div>
            <div class="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50">
                ${state.cart.length === 0 ? `
                    <div class="flex flex-col items-center justify-center h-full text-center text-gray-500">
                        ${ICONS.emptyCart}
                        <p class="text-xl font-bold mb-2 text-gray-900">Your cart is empty</p>
                        <p class="text-sm mb-8 text-gray-500">Discover our premium collection.</p>
                        <button onclick="app.toggleCart(false)" class="px-8 py-3 bg-[#FF6B35] text-white rounded-full font-bold hover:bg-[#e55a2b]">Start Shopping</button>
                    </div>
                ` : state.cart.map((item, index) => `
                    <div class="flex gap-4 p-4 bg-white rounded-xl shadow-sm border border-gray-100 animate-fade-in">
                        <div class="w-24 h-24 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0 border border-gray-100">
                            <img src="${item.image}" alt="${item.name}" class="w-full h-full object-cover" />
                        </div>
                        <div class="flex-1 flex flex-col justify-between">
                            <div>
                                <div class="flex justify-between items-start">
                                    <h3 class="font-bold text-gray-900 mb-1 leading-tight line-clamp-1">${item.name}</h3>
                                    <button onclick="app.removeFromCart(${index})" class="text-gray-400 hover:text-red-500 transition-colors p-1 -mt-1 -mr-1"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg></button>
                                </div>
                                ${item.selectedSize || item.selectedColor ? `<div class="text-[10px] bg-gray-100 inline-flex items-center px-2 py-1 rounded text-gray-600 mb-2 border border-gray-200">${item.selectedSize ? `Size: ${item.selectedSize}` : ''}${item.selectedSize && item.selectedColor ? ' • ' : ''}${item.selectedColor ? `Color: ${item.selectedColor}` : ''}</div>` : ''}
                            </div>
                            <div class="flex justify-between items-end">
                                <div class="flex items-center border border-gray-200 rounded-lg bg-gray-50">
                                    <button onclick="app.updateQuantity(${index}, -1)" class="px-3 py-1 text-gray-600 hover:bg-white rounded-l-lg" ${item.quantity <= 1 ? 'disabled' : ''}>-</button>
                                    <span class="px-2 text-sm font-medium min-w-[1.5rem] text-center">${item.quantity}</span>
                                    <button onclick="app.updateQuantity(${index}, 1)" class="px-3 py-1 text-gray-600 hover:bg-white rounded-r-lg">+</button>
                                </div>
                                <p class="font-bold text-gray-900 text-lg">₹${(item.price * item.quantity).toLocaleString()}</p>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
            ${state.cart.length > 0 ? `
                <div class="p-6 bg-white border-t border-gray-100 shadow-[0_-4px_20px_-5px_rgba(0,0,0,0.1)] z-10">
                    <!-- Coupon -->
                    <div class="mb-4">
                        ${state.appliedCoupon ? `
                            <div class="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                                <div><span class="text-xs font-bold text-green-700">🏷️ ${state.appliedCoupon.code}</span><span class="text-xs text-green-600 ml-2">- ₹${discount.toLocaleString()} saved!</span></div>
                                <button onclick="removeCoupon()" class="text-red-400 hover:text-red-600 text-xs font-bold">Remove</button>
                            </div>
                        ` : `
                            <div class="flex gap-2">
                                <input type="text" placeholder="Coupon code" value="${state.couponCode}" oninput="state.couponCode=this.value" class="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-[#FF6B35] outline-none" />
                                <button onclick="applyCoupon()" class="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-bold hover:bg-black">Apply</button>
                            </div>
                            <p class="text-xs text-gray-400 mt-1">Try: FASHION20, FLAT100, WELCOME50</p>
                        `}
                    </div>
                    <div class="space-y-2 mb-4">
                        <div class="flex justify-between text-gray-500 text-sm"><span>Subtotal</span><span>₹${subtotal.toLocaleString()}</span></div>
                        ${discount > 0 ? `<div class="flex justify-between text-sm text-green-600"><span>Discount (${state.appliedCoupon.code})</span><span>-₹${discount.toLocaleString()}</span></div>` : ''}
                        <div class="flex justify-between text-gray-500 text-sm"><span>Delivery</span><span class="text-green-600 font-medium bg-green-50 px-2 py-0.5 rounded text-xs">Free</span></div>
                        <div class="flex justify-between text-xl font-bold text-gray-900 pt-3 border-t border-dashed border-gray-200"><span>Total</span><span>₹${total.toLocaleString()}</span></div>
                    </div>
                    <button onclick="app.toggleCheckoutModal(true)" class="w-full py-4 bg-[#FF6B35] text-white font-bold rounded-xl hover:bg-[#e55a2b] transition-all shadow-lg">Proceed to Checkout</button>
                </div>
            ` : ''}
        </div>
    </div>`;
}

function renderCheckoutModal() {
    if (!state.checkoutModalOpen) return '';
    const subtotal = state.cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const discount = getDiscount(subtotal);
    const total = subtotal - discount;
    const defaultAddr = state.savedAddresses.find(a => a.isDefault);
    return `
    <div class="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" onclick="app.toggleCheckoutModal(false)"></div>
        <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-fade-in">
            <div class="p-6 border-b border-gray-100 flex justify-between items-center">
                <h3 class="text-xl font-bold text-gray-900">Secure Checkout</h3>
                <button onclick="app.toggleCheckoutModal(false)" class="text-gray-400 hover:text-gray-600">${ICONS.close}</button>
            </div>
            <form onsubmit="app.confirmOrder(event)" class="p-6 space-y-5">
                <div class="bg-gray-50 p-4 rounded-lg border border-gray-100 text-sm text-gray-700">
                    <p class="font-bold mb-1">Customer Details</p>
                    <p>${state.user ? state.user.name : 'Guest User'}</p>
                    <p class="text-gray-500">${state.user ? state.user.email : 'guest@example.com'}</p>
                </div>
                ${defaultAddr ? `
                    <div class="bg-blue-50 p-4 rounded-lg border border-blue-100 text-sm">
                        <p class="font-bold text-blue-900 mb-1">Delivery Address</p>
                        <p class="text-blue-800">${defaultAddr.line1}, ${defaultAddr.city}, ${defaultAddr.state} - ${defaultAddr.pincode}</p>
                        <button type="button" onclick="app.openAddressModal()" class="text-[#FF6B35] text-xs hover:underline mt-1">Change Address</button>
                    </div>
                ` : `
                    <div class="bg-yellow-50 p-4 rounded-lg border border-yellow-100 text-sm">
                        <p class="text-yellow-700">No address saved. <button type="button" onclick="app.openAddressModal()" class="font-bold hover:underline">Add address</button></p>
                    </div>
                `}
                <div>
                    <label class="block text-sm font-bold text-gray-700 mb-2">Select Nearest Branch</label>
                    <div class="relative">
                        <select name="branch" required class="w-full appearance-none px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6B35] focus:border-transparent outline-none bg-white text-gray-700">
                            <option value="">-- Choose Branch --</option>
                            ${BRANCHES.map(b => `<option value="${b}">${b}</option>`).join('')}
                        </select>
                        <div class="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-gray-500">${ICONS.chevronDown}</div>
                    </div>
                </div>
                ${discount > 0 ? `<div class="flex justify-between text-sm text-green-600 bg-green-50 rounded-lg p-3"><span>Coupon Discount (${state.appliedCoupon.code})</span><span>-₹${discount.toLocaleString()}</span></div>` : ''}
                <div class="flex justify-between items-center pt-4 border-t border-dashed border-gray-200">
                    <span class="text-gray-600 font-medium">Total Amount</span>
                    <span class="text-2xl font-bold text-gray-900">₹${total.toLocaleString()}</span>
                </div>
                <button type="submit" class="w-full py-4 bg-[#FF6B35] text-white font-bold rounded-lg hover:bg-[#e55a2b] transition-all shadow-md flex justify-center items-center gap-2">Confirm Order ${ICONS.check}</button>
            </form>
        </div>
    </div>`;
}

function renderTrackingPage() {
    return `
    <section class="min-h-screen bg-gray-50 py-12 px-4 md:px-6 animate-fade-in">
        <div class="max-w-3xl mx-auto">
            <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 mb-8 text-center">
                <h2 class="text-3xl font-bold text-gray-900 mb-4">Track Your Order</h2>
                <p class="text-gray-500 mb-6">Enter your Order ID to check current status.</p>
                <div class="flex gap-2 max-w-md mx-auto">
                    <input type="text" id="trackInput" placeholder="e.g. ORD-2025-ABC-1234" class="flex-1 border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-[#FF6B35] outline-none" onkeypress="if(event.key === 'Enter') app.trackOrder()" />
                    <button onclick="app.trackOrder()" class="bg-[#FF6B35] text-white px-6 py-3 rounded-lg font-bold hover:bg-[#e55a2b]">Track</button>
                </div>
                <div id="trackResult"></div>
            </div>
        </div>
    </section>`;
}

function renderAdminLogin() {
    const isLogin = state.adminAuthMode === 'login';
    return `
    <div class="min-h-screen bg-gray-100 flex items-center justify-center px-4">
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
                ${isLogin ? `<p class="text-gray-500">Don't have an account? <button onclick="app.toggleAdminAuthMode('register')" class="text-[#FF6B35] font-bold hover:underline">Apply for Access</button></p>` : `<p class="text-gray-500">Already have an account? <button onclick="app.toggleAdminAuthMode('login')" class="text-[#FF6B35] font-bold hover:underline">Login</button></p>`}
                <div class="mt-4 pt-4 border-t border-gray-100"><button onclick="app.goHome()" class="text-gray-500 hover:text-gray-900">Back to Store</button></div>
            </div>
        </div>
    </div>`;
}

function renderAdminDashboard() {
    const totalOrders = state.adminOrders.length;
    const totalSales = state.adminOrders.reduce((acc, o) => acc + o.total, 0);
    const isMain = state.adminUser && state.adminUser.isMain;
    const allAdmins = state.adminUsers || [];
    const pendingOrders = state.adminOrders.filter(o => o.status === 'Order Placed').length;
    const deliveredOrders = state.adminOrders.filter(o => o.status === 'Delivered').length;
    const paidOrders = state.adminOrders.filter(o => o.paymentStatus === 'Paid');
    const paidTotal = paidOrders.reduce((s, o) => s + o.total, 0);

    // Date filter
    let filteredOrders = state.adminOrders;
    if (state.dateFilter !== 'all') {
        const now = Date.now();
        const ranges = { today: 86400000, week: 604800000, month: 2592000000 };
        filteredOrders = state.adminOrders.filter(o => now - new Date(o.date).getTime() < ranges[state.dateFilter]);
    }

    // Search filter
    if (state.orderSearch) {
        const s = state.orderSearch.toLowerCase();
        filteredOrders = filteredOrders.filter(o => o.id.toLowerCase().includes(s) || o.customer.name.toLowerCase().includes(s) || o.customer.email.toLowerCase().includes(s) || o.branch.toLowerCase().includes(s));
    }

    const branchStats = {};
    BRANCHES.forEach(b => branchStats[b] = { count: 0, sales: 0 });
    state.adminOrders.forEach(o => { if (branchStats[o.branch]) { branchStats[o.branch].count++; branchStats[o.branch].sales += o.total; } });

    const tabs = [
        { id: 'orders', label: '📦 Orders', badge: totalOrders },
        { id: 'products', label: '👕 Products', badge: PRODUCTS.length },
        { id: 'admins', label: '👥 Admins', badge: allAdmins.length },
        { id: 'analytics', label: '📊 Analytics', badge: null },
    ];

    return `
    <div class="min-h-screen bg-gray-100 flex font-sans">
        <aside class="w-64 bg-gray-900 text-white flex-shrink-0 hidden md:flex flex-col">
            <div class="p-6 border-b border-gray-800 flex items-center gap-3">
                <div class="w-8 h-8 text-[#FF6B35]">${ICONS.logoMoon}</div>
                <span class="font-bold text-lg">Admin Panel</span>
            </div>
            <nav class="flex-1 p-4 space-y-1">
                ${tabs.map(t => `<button onclick="app.setAdminTab('${t.id}')" class="w-full text-left px-4 py-3 rounded flex items-center justify-between transition-colors ${state.activeTab === t.id ? 'bg-[#FF6B35] text-white font-medium' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}">${t.label}${t.badge !== null ? `<span class="text-xs bg-white/20 px-2 py-0.5 rounded-full">${t.badge}</span>` : ''}</button>`).join('')}
                <button onclick="app.goHome()" class="w-full text-left px-4 py-3 rounded text-gray-400 hover:bg-gray-800 hover:text-white transition-colors mt-4">🏪 View Store</button>
                <button onclick="app.logout()" class="w-full text-left px-4 py-3 rounded text-gray-400 hover:bg-gray-800 hover:text-white transition-colors">🚪 Logout</button>
            </nav>
            <div class="p-4 border-t border-gray-800">
                <div class="flex items-center gap-3 text-sm">
                    <div class="w-8 h-8 bg-[#FF6B35] rounded-full flex items-center justify-center font-bold">${state.adminUser ? state.adminUser.username[0].toUpperCase() : 'A'}</div>
                    <div><div class="text-white font-medium">${state.adminUser ? state.adminUser.username : 'Admin'}</div><div class="text-gray-400 text-xs">${isMain ? 'Main Admin' : 'Admin'}</div></div>
                </div>
            </div>
        </aside>

        <main class="flex-1 overflow-y-auto">
            <header class="bg-white border-b border-gray-200 p-6 flex justify-between items-center sticky top-0 z-20">
                <div class="flex items-center gap-4">
                    <h1 class="text-2xl font-bold text-gray-900">${tabs.find(t => t.id === state.activeTab)?.label || 'Dashboard'}</h1>
                    <button onclick="app.refreshAllData()" class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">🔄 Refresh</button>
                </div>
                <div class="flex items-center gap-3">
                    ${state.activeTab === 'orders' ? `<button onclick="app.exportOrders()" class="px-4 py-2 text-sm bg-green-600 text-white rounded-lg font-bold hover:bg-green-700">📤 Export CSV</button>` : ''}
                    <div class="md:hidden"><button onclick="app.logout()" class="text-sm text-red-500 font-bold">Logout</button></div>
                </div>
            </header>

            <div class="p-6 md:p-8 space-y-8">
                <!-- Stats Cards -->
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div class="bg-white p-5 rounded-xl shadow-sm border border-gray-200"><p class="text-xs text-gray-500 font-bold uppercase mb-2">Total Sales</p><p class="text-2xl font-bold text-gray-900">₹${totalSales.toLocaleString()}</p><p class="text-xs text-green-600 mt-1">↑ All time</p></div>
                    <div class="bg-white p-5 rounded-xl shadow-sm border border-gray-200"><p class="text-xs text-gray-500 font-bold uppercase mb-2">Total Orders</p><p class="text-2xl font-bold text-gray-900">${totalOrders}</p><p class="text-xs text-orange-600 mt-1">${pendingOrders} pending</p></div>
                    <div class="bg-white p-5 rounded-xl shadow-sm border border-gray-200"><p class="text-xs text-gray-500 font-bold uppercase mb-2">Delivered</p><p class="text-2xl font-bold text-green-600">${deliveredOrders}</p><p class="text-xs text-gray-400 mt-1">${totalOrders ? Math.round(deliveredOrders/totalOrders*100) : 0}% success</p></div>
                    <div class="bg-white p-5 rounded-xl shadow-sm border border-gray-200"><p class="text-xs text-gray-500 font-bold uppercase mb-2">Paid Revenue</p><p class="text-2xl font-bold text-blue-600">₹${paidTotal.toLocaleString()}</p><p class="text-xs text-gray-400 mt-1">${paidOrders.length} paid orders</p></div>
                </div>

                <!-- TAB CONTENT -->
                ${state.activeTab === 'orders' ? renderAdminOrders(filteredOrders) : ''}
                ${state.activeTab === 'products' ? renderAdminProducts() : ''}
                ${state.activeTab === 'admins' ? renderAdminUsers(allAdmins, isMain) : ''}
                ${state.activeTab === 'analytics' ? renderAdminAnalytics(branchStats, totalSales, totalOrders) : ''}
            </div>
        </main>
    </div>`;
}

function renderAdminOrders(orders) {
    return `
    <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div class="p-6 border-b border-gray-100">
            <div class="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                <h3 class="font-bold text-lg text-gray-900">Orders (${orders.length})</h3>
                <div class="flex gap-3 flex-wrap">
                    <input type="text" placeholder="Search orders..." oninput="state.orderSearch=this.value;render()" value="${state.orderSearch}" class="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-[#FF6B35] outline-none" />
                    <select onchange="app.setDateFilter(this.value)" class="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-[#FF6B35] outline-none bg-white">
                        <option value="all" ${state.dateFilter==='all'?'selected':''}>All Time</option>
                        <option value="today" ${state.dateFilter==='today'?'selected':''}>Today</option>
                        <option value="week" ${state.dateFilter==='week'?'selected':''}>This Week</option>
                        <option value="month" ${state.dateFilter==='month'?'selected':''}>This Month</option>
                    </select>
                </div>
            </div>
        </div>
        <div class="overflow-x-auto">
            <table class="w-full text-left">
                <thead class="bg-gray-50 text-xs text-gray-500 uppercase">
                    <tr><th class="px-6 py-4">Order ID</th><th class="px-6 py-4">Customer</th><th class="px-6 py-4">Branch</th><th class="px-6 py-4">Total</th><th class="px-6 py-4">Status</th><th class="px-6 py-4">Update</th><th class="px-6 py-4">Location</th><th class="px-6 py-4">Payment</th><th class="px-6 py-4">Actions</th></tr>
                </thead>
                <tbody class="divide-y divide-gray-100 text-sm">
                    ${orders.length === 0 ? `<tr><td colspan="9" class="px-6 py-12 text-center text-gray-400">No orders found</td></tr>` : orders.map(order => `
                        <tr class="hover:bg-gray-50">
                            <td class="px-6 py-4 font-medium text-xs">${order.id}</td>
                            <td class="px-6 py-4"><div class="font-medium text-gray-900">${order.customer.name}</div><div class="text-gray-500 text-xs">${order.customer.email}</div></td>
                            <td class="px-6 py-4 text-sm">${order.branch}</td>
                            <td class="px-6 py-4 font-bold">₹${order.total.toLocaleString()}</td>
                            <td class="px-6 py-4"><span class="px-2 py-1 rounded text-xs font-bold ${order.status === 'Delivered' ? 'bg-green-100 text-green-700' : order.status === 'Out for Delivery' ? 'bg-blue-100 text-blue-700' : order.status === 'Packing' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-700'}">${order.status}</span></td>
                            <td class="px-6 py-4"><select onchange="app.updateOrderStatus('${order.id}', this.value)" class="border border-gray-300 rounded text-xs p-1 bg-white"><option value="Order Placed" ${order.status==='Order Placed'?'selected':''}>Order Placed</option><option value="In Hub" ${order.status==='In Hub'?'selected':''}>In Hub</option><option value="Packing" ${order.status==='Packing'?'selected':''}>Packing</option><option value="Given to Rider" ${order.status==='Given to Rider'?'selected':''}>Given to Rider</option><option value="Out for Delivery" ${order.status==='Out for Delivery'?'selected':''}>Out for Delivery</option><option value="Delivered" ${order.status==='Delivered'?'selected':''}>Delivered</option></select></td>
                            <td class="px-6 py-4"><input type="text" value="${order.location || ''}" onchange="app.updateOrderStatusWithLocation('${order.id}', '${order.status}', this.value)" class="border border-gray-300 rounded px-2 py-1 text-xs w-32" placeholder="Location" /></td>
                            <td class="px-6 py-4"><div class="text-xs"><div class="font-bold">${order.paymentMethod || 'N/A'}</div><div class="${order.paymentStatus === 'Paid' ? 'text-green-600' : 'text-orange-600'}">${order.paymentStatus || 'N/A'}</div></div></td>
                            <td class="px-6 py-4"><button onclick="app.downloadInvoice('${order.id}')" class="text-xs bg-gray-800 text-white px-2 py-1 rounded hover:bg-black">Invoice</button></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    </div>`;
}

function renderAdminProducts() {
    const searchLower = state.productSearch.toLowerCase();
    const filtered = PRODUCTS.filter(p => !searchLower || p.name.toLowerCase().includes(searchLower) || p.category.toLowerCase().includes(searchLower));
    return `
    <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div class="p-6 border-b border-gray-100 flex justify-between items-center">
            <h3 class="font-bold text-lg text-gray-900">Product Price Management</h3>
            <input type="text" placeholder="Search products..." oninput="state.productSearch=this.value;render()" value="${state.productSearch}" class="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-[#FF6B35] outline-none" />
        </div>
        <div class="overflow-x-auto max-h-[600px] overflow-y-auto">
            <table class="w-full text-left">
                <thead class="bg-gray-50 text-xs text-gray-500 uppercase sticky top-0">
                    <tr><th class="px-6 py-4">Product</th><th class="px-6 py-4">Category</th><th class="px-6 py-4">Stock Overview</th><th class="px-6 py-4">Current Price</th><th class="px-6 py-4">Update Price</th></tr>
                </thead>
                <tbody class="divide-y divide-gray-100 text-sm">
                    ${filtered.map(p => {
                        const totalStock = p.sizes ? Object.values(p.sizes).reduce((s, sz) => s + (sz.stock || 0), 0) : 0;
                        const lowStock = p.sizes ? Object.entries(p.sizes).filter(([,sz]) => sz.stock > 0 && sz.stock < 10) : [];
                        return `
                        <tr class="hover:bg-gray-50">
                            <td class="px-6 py-4">
                                <div class="flex items-center gap-3">
                                    <img src="${p.image}" class="w-10 h-10 rounded-lg object-cover" />
                                    <div><div class="font-medium text-gray-900">${p.name}</div>${p.badge ? `<span class="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded">${p.badge}</span>` : ''}</div>
                                </div>
                            </td>
                            <td class="px-6 py-4 text-gray-500">${p.category}</td>
                            <td class="px-6 py-4">
                                <div class="text-xs"><span class="${totalStock < 20 ? 'text-red-600' : 'text-green-600'} font-bold">${totalStock} units</span>${lowStock.length > 0 ? `<div class="text-orange-500 mt-1">⚠ Low: ${lowStock.map(([s]) => s).join(', ')}</div>` : ''}</div>
                            </td>
                            <td class="px-6 py-4 font-bold text-gray-900">₹${p.price.toLocaleString()}</td>
                            <td class="px-6 py-4">
                                <div class="flex items-center gap-2">
                                    <input type="number" id="price-${p.id}" value="${p.price}" min="1" class="w-24 border border-gray-300 rounded px-2 py-1 text-sm focus:ring-1 focus:ring-[#FF6B35] outline-none" />
                                    <button onclick="app.savePrice(${p.id}, document.getElementById('price-${p.id}').value)" class="bg-gray-900 text-white px-3 py-1 rounded text-xs hover:bg-black">Save</button>
                                </div>
                            </td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>
        </div>
    </div>`;
}

function renderAdminUsers(allAdmins, isMain) {
    return `
    <div class="space-y-6">
        ${isMain ? `
            <div class="bg-white rounded-xl shadow-sm border border-red-200 overflow-hidden">
                <div class="p-6 border-b border-red-100 bg-red-50"><h3 class="font-bold text-lg text-red-900">Pending Admin Approvals</h3></div>
                <div id="pendingAdminsList" class="p-6 text-sm text-gray-500">Loading...</div>
            </div>
        ` : ''}
        <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div class="p-6 border-b border-gray-100 flex justify-between items-center">
                <h3 class="font-bold text-lg text-gray-900">All Admins</h3>
                <span class="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded">Total: ${allAdmins.length}</span>
            </div>
            <div class="overflow-x-auto">
                <table class="w-full text-left">
                    <thead class="bg-gray-50 text-xs text-gray-500 uppercase"><tr><th class="px-6 py-4">Username</th><th class="px-6 py-4">Role</th><th class="px-6 py-4">Status</th><th class="px-6 py-4">Action</th></tr></thead>
                    <tbody class="divide-y divide-gray-100 text-sm">
                        ${allAdmins.map(admin => {
                            const isMainAdmin = admin.username === 'admin' || admin.isMain;
                            const isSelf = state.adminUser && state.adminUser.id === admin.id;
                            return `<tr><td class="px-6 py-4 font-bold text-gray-900 flex items-center gap-2">${admin.username}${isMainAdmin ? '<span class="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Main</span>' : ''}${isSelf ? '<span class="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full">You</span>' : ''}</td><td class="px-6 py-4 text-gray-500">${admin.role || 'Admin'}</td><td class="px-6 py-4"><span class="px-2 py-1 rounded text-xs font-bold ${admin.status === 'approved' ? 'bg-green-100 text-green-700' : admin.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}">${admin.status}</span></td><td class="px-6 py-4">${isMainAdmin ? '<span class="text-gray-400 text-xs italic">Protected</span>' : `<button onclick="app.removeAdmin(${admin.id})" class="text-red-600 hover:text-red-800 text-xs font-bold border border-red-200 px-3 py-1 rounded">Remove</button>`}</td></tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    </div>`;
}

function renderAdminAnalytics(branchStats, totalSales, totalOrders) {
    const statusCounts = {};
    state.adminOrders.forEach(o => { statusCounts[o.status] = (statusCounts[o.status] || 0) + 1; });
    const paymentMethods = {};
    state.adminOrders.forEach(o => { if (o.paymentMethod) paymentMethods[o.paymentMethod] = (paymentMethods[o.paymentMethod] || 0) + 1; });

    return `
    <div class="space-y-6">
        <!-- Branch Stats -->
        <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div class="p-6 border-b border-gray-100"><h3 class="font-bold text-lg text-gray-900">Sales by Branch</h3></div>
            <div class="p-6">
                ${BRANCHES.map(b => {
                    const pct = totalSales ? Math.round(branchStats[b].sales / totalSales * 100) : 0;
                    return `<div class="mb-4"><div class="flex justify-between text-sm mb-1"><span class="font-medium text-gray-700">${b}</span><span class="font-bold text-gray-900">₹${branchStats[b].sales.toLocaleString()} <span class="text-gray-400 font-normal">(${branchStats[b].count} orders)</span></span></div><div class="w-full bg-gray-100 rounded-full h-2"><div class="bg-[#FF6B35] h-2 rounded-full transition-all" style="width: ${pct}%"></div></div></div>`;
                }).join('')}
            </div>
        </div>

        <!-- Order Status Distribution -->
        <div class="grid md:grid-cols-2 gap-6">
            <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 class="font-bold text-lg text-gray-900 mb-4">Order Status</h3>
                ${Object.entries(statusCounts).map(([status, count]) => `
                    <div class="flex justify-between items-center mb-3">
                        <span class="text-sm text-gray-600">${status}</span>
                        <div class="flex items-center gap-2"><div class="w-24 bg-gray-100 rounded-full h-2"><div class="bg-[#FF6B35] h-2 rounded-full" style="width:${totalOrders ? count/totalOrders*100 : 0}%"></div></div><span class="text-sm font-bold text-gray-900 w-8 text-right">${count}</span></div>
                    </div>
                `).join('')}
            </div>
            <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 class="font-bold text-lg text-gray-900 mb-4">Payment Methods</h3>
                ${Object.entries(paymentMethods).map(([method, count]) => `
                    <div class="flex justify-between items-center mb-3">
                        <span class="text-sm text-gray-600">${method}</span>
                        <div class="flex items-center gap-2"><div class="w-24 bg-gray-100 rounded-full h-2"><div class="bg-blue-500 h-2 rounded-full" style="width:${totalOrders ? count/totalOrders*100 : 0}%"></div></div><span class="text-sm font-bold text-gray-900 w-8 text-right">${count}</span></div>
                    </div>
                `).join('')}
                <div class="mt-4 pt-4 border-t border-gray-100"><div class="flex justify-between text-sm"><span class="text-gray-500">Avg Order Value</span><span class="font-bold text-gray-900">₹${totalOrders ? Math.round(totalSales/totalOrders).toLocaleString() : 0}</span></div></div>
            </div>
        </div>
    </div>`;
}

function renderCompareModal() {
    if (!state.compareModalOpen) return '';
    const products = state.compareList;
    const allKeys = ['price', 'category', 'subCategory', 'description'];
    return `
    <div class="fixed inset-0 z-[100] flex items-start justify-center p-4 pt-16 overflow-y-auto">
        <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" onclick="app.closeCompare()"></div>
        <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-5xl animate-fade-in">
            <div class="p-6 border-b border-gray-100 flex justify-between items-center">
                <h3 class="text-xl font-bold text-gray-900">Compare Products</h3>
                <div class="flex gap-3"><button onclick="app.clearCompare(); app.closeCompare()" class="text-sm text-red-500 hover:underline">Clear All</button><button onclick="app.closeCompare()" class="text-gray-400 hover:text-gray-600">${ICONS.close}</button></div>
            </div>
            <div class="overflow-x-auto">
                <table class="w-full">
                    <thead><tr><td class="p-4 font-bold text-gray-500 text-sm uppercase w-32">Feature</td>${products.map(p => `<td class="p-4 text-center"><div class="w-24 h-24 mx-auto rounded-xl overflow-hidden mb-2"><img src="${p.image}" class="w-full h-full object-cover" /></div><p class="font-bold text-gray-900 text-sm">${p.name}</p></td>`).join('')}</tr></thead>
                    <tbody class="divide-y divide-gray-100">
                        <tr class="bg-gray-50"><td class="p-4 text-sm font-bold text-gray-500">Price</td>${products.map(p => `<td class="p-4 text-center text-xl font-bold text-[#FF6B35]">${p.displayPrice}</td>`).join('')}</tr>
                        <tr><td class="p-4 text-sm font-bold text-gray-500">Category</td>${products.map(p => `<td class="p-4 text-center text-sm text-gray-700">${p.category}</td>`).join('')}</tr>
                        <tr class="bg-gray-50"><td class="p-4 text-sm font-bold text-gray-500">Sub Category</td>${products.map(p => `<td class="p-4 text-center text-sm text-gray-700">${p.subCategory || '-'}</td>`).join('')}</tr>
                        <tr><td class="p-4 text-sm font-bold text-gray-500">Colors</td>${products.map(p => `<td class="p-4 text-center">${(p.colors || []).map(c => `<span class="inline-block text-xs bg-gray-100 rounded px-2 py-0.5 mr-1">${c}</span>`).join('')}</td>`).join('')}</tr>
                        <tr class="bg-gray-50"><td class="p-4 text-sm font-bold text-gray-500">Rating</td>${products.map(p => { const r = app.getAvgRating(p.id); return `<td class="p-4 text-center">${r > 0 ? `<span class="text-yellow-400">★</span> <span class="font-bold">${r}</span>` : '<span class="text-gray-400">No reviews</span>'}</td>`; }).join('')}</tr>
                        <tr><td class="p-4 text-sm font-bold text-gray-500">Features</td>${products.map(p => `<td class="p-4 text-center text-xs text-gray-600">${(p.features || []).map(f => `<div class="mb-1">✓ ${f}</div>`).join('')}</td>`).join('')}</tr>
                        <tr class="bg-gray-50"><td class="p-4"></td>${products.map(p => `<td class="p-4 text-center"><button onclick="app.addToCartById(${p.id}); app.closeCompare();" class="w-full py-2 bg-[#FF6B35] text-white rounded-lg text-sm font-bold hover:bg-[#e55a2b]">Add to Cart</button></td>`).join('')}</tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>`;
}

function renderReviewModal() {
    if (!state.reviewModalOpen || !state.reviewProduct) return '';
    return `
    <div class="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" onclick="app.closeReviewModal()"></div>
        <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-md animate-fade-in">
            <div class="p-6 border-b border-gray-100 flex justify-between items-center">
                <h3 class="text-xl font-bold text-gray-900">Write a Review</h3>
                <button onclick="app.closeReviewModal()" class="text-gray-400 hover:text-gray-600">${ICONS.close}</button>
            </div>
            <form onsubmit="app.submitReview(event)" class="p-6 space-y-4">
                <div>
                    <label class="block text-sm font-bold text-gray-700 mb-2">Rating</label>
                    <select name="rating" required class="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-[#FF6B35] outline-none bg-white">
                        <option value="5">⭐⭐⭐⭐⭐ Excellent</option>
                        <option value="4">⭐⭐⭐⭐ Good</option>
                        <option value="3">⭐⭐⭐ Average</option>
                        <option value="2">⭐⭐ Poor</option>
                        <option value="1">⭐ Terrible</option>
                    </select>
                </div>
                <div><label class="block text-sm font-bold text-gray-700 mb-2">Review Title</label><input type="text" name="title" required placeholder="Summarize your experience" class="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-[#FF6B35] outline-none" /></div>
                <div><label class="block text-sm font-bold text-gray-700 mb-2">Your Review</label><textarea name="comment" required rows="4" placeholder="Share your experience with this product..." class="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-[#FF6B35] outline-none resize-none"></textarea></div>
                <button type="submit" class="w-full py-3 bg-[#FF6B35] text-white font-bold rounded-lg hover:bg-[#e55a2b]">Submit Review</button>
            </form>
        </div>
    </div>`;
}

function renderProfileModal() {
    if (!state.profileModalOpen || !state.user) return '';
    const userOrders = state.adminOrders.filter(o => o.customer.email === state.user.email);
    return `
    <div class="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" onclick="app.closeProfile()"></div>
        <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-fade-in max-h-[90vh] overflow-y-auto">
            <div class="p-6 border-b border-gray-100 flex justify-between items-center">
                <h3 class="text-xl font-bold text-gray-900">My Profile</h3>
                <button onclick="app.closeProfile()" class="text-gray-400 hover:text-gray-600">${ICONS.close}</button>
            </div>
            <div class="p-6">
                <div class="flex items-center gap-4 mb-6">
                    <div class="w-16 h-16 bg-[#FF6B35] text-white rounded-full flex items-center justify-center text-2xl font-bold">${state.user.name[0].toUpperCase()}</div>
                    <div><h2 class="text-xl font-bold text-gray-900">${state.user.name}</h2><p class="text-gray-500">${state.user.email}</p><p class="text-xs text-gray-400 mt-1">Member since ${new Date(state.user.createdAt || Date.now()).toLocaleDateString()}</p></div>
                </div>
                <!-- Order History -->
                <div class="mb-6">
                    <h3 class="font-bold text-gray-900 mb-3">Order History (${userOrders.length})</h3>
                    ${userOrders.length === 0 ? '<p class="text-sm text-gray-500 bg-gray-50 p-4 rounded-lg">No orders yet. Start shopping!</p>' : `
                        <div class="space-y-3 max-h-48 overflow-y-auto">
                            ${userOrders.map(o => `
                                <div class="flex justify-between items-center p-3 bg-gray-50 rounded-lg border border-gray-100 text-sm">
                                    <div><div class="font-medium text-gray-900">#${o.id}</div><div class="text-gray-500 text-xs">${new Date(o.date).toLocaleDateString()}</div></div>
                                    <div class="text-right"><div class="font-bold text-gray-900">₹${o.total.toLocaleString()}</div><span class="text-xs px-2 py-0.5 rounded-full ${o.status === 'Delivered' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-600'}">${o.status}</span></div>
                                </div>
                            `).join('')}
                        </div>
                    `}
                </div>
                <!-- Saved Addresses -->
                <div>
                    <div class="flex justify-between items-center mb-3">
                        <h3 class="font-bold text-gray-900">Saved Addresses</h3>
                        <button onclick="app.openAddressModal()" class="text-sm text-[#FF6B35] font-bold hover:underline">+ Add</button>
                    </div>
                    ${state.savedAddresses.length === 0 ? '<p class="text-sm text-gray-500 bg-gray-50 p-4 rounded-lg">No addresses saved.</p>' : `
                        <div class="space-y-3">
                            ${state.savedAddresses.map(addr => `
                                <div class="p-3 bg-gray-50 rounded-lg border ${addr.isDefault ? 'border-[#FF6B35]' : 'border-gray-100'} text-sm">
                                    <div class="flex justify-between items-start">
                                        <div><p class="font-medium text-gray-900">${addr.name} • ${addr.phone}</p><p class="text-gray-500 text-xs">${addr.line1}, ${addr.city}, ${addr.state} ${addr.pincode}</p></div>
                                        <div class="flex gap-2">${!addr.isDefault ? `<button onclick="app.setDefaultAddress(${addr.id})" class="text-xs text-blue-600 hover:underline">Default</button>` : '<span class="text-xs text-[#FF6B35] font-bold">Default</span>'}<button onclick="app.deleteAddress(${addr.id})" class="text-xs text-red-500 hover:underline">Delete</button></div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    `}
                </div>
                <button onclick="app.logout(); app.closeProfile();" class="w-full mt-6 py-3 border border-red-200 text-red-600 rounded-lg font-bold hover:bg-red-50">Logout</button>
            </div>
        </div>
    </div>`;
}

function renderAddressModal() {
    if (!state.addressModalOpen) return '';
    return `
    <div class="fixed inset-0 z-[110] flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" onclick="app.closeAddressModal()"></div>
        <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-md animate-fade-in">
            <div class="p-6 border-b border-gray-100 flex justify-between items-center">
                <h3 class="text-xl font-bold text-gray-900">Add New Address</h3>
                <button onclick="app.closeAddressModal()" class="text-gray-400 hover:text-gray-600">${ICONS.close}</button>
            </div>
            <form onsubmit="app.saveAddress(event)" class="p-6 space-y-4">
                <div class="grid grid-cols-2 gap-4">
                    <div><label class="block text-sm font-bold text-gray-700 mb-1">Full Name</label><input type="text" name="name" required class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#FF6B35] outline-none" /></div>
                    <div><label class="block text-sm font-bold text-gray-700 mb-1">Phone</label><input type="tel" name="phone" required class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#FF6B35] outline-none" /></div>
                </div>
                <div><label class="block text-sm font-bold text-gray-700 mb-1">Address Line</label><input type="text" name="line1" required placeholder="House no, Street, Area" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#FF6B35] outline-none" /></div>
                <div class="grid grid-cols-3 gap-3">
                    <div><label class="block text-sm font-bold text-gray-700 mb-1">City</label><input type="text" name="city" required class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#FF6B35] outline-none" /></div>
                    <div><label class="block text-sm font-bold text-gray-700 mb-1">State</label><input type="text" name="addrState" required class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#FF6B35] outline-none" /></div>
                    <div><label class="block text-sm font-bold text-gray-700 mb-1">Pincode</label><input type="text" name="pincode" required class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#FF6B35] outline-none" /></div>
                </div>
                <button type="submit" class="w-full py-3 bg-[#FF6B35] text-white font-bold rounded-lg hover:bg-[#e55a2b]">Save Address</button>
            </form>
        </div>
    </div>`;
}

function renderReturnModal() {
    if (!state.returnModalOpen || !state.returnOrder) return '';
    return `
    <div class="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" onclick="app.closeReturnModal()"></div>
        <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-md animate-fade-in">
            <div class="p-6 border-b border-gray-100 flex justify-between items-center">
                <h3 class="text-xl font-bold text-gray-900">Return Request</h3>
                <button onclick="app.closeReturnModal()" class="text-gray-400 hover:text-gray-600">${ICONS.close}</button>
            </div>
            <form onsubmit="app.submitReturn(event)" class="p-6 space-y-4">
                <p class="text-sm text-gray-600">Order: <strong>#${state.returnOrder.id}</strong></p>
                <div>
                    <label class="block text-sm font-bold text-gray-700 mb-2">Return Reason</label>
                    <select name="reason" required class="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-[#FF6B35] outline-none bg-white">
                        <option value="">Select reason...</option>
                        <option>Wrong size</option><option>Wrong product delivered</option><option>Defective/damaged product</option><option>Product not as described</option><option>Changed my mind</option>
                    </select>
                </div>
                <div><label class="block text-sm font-bold text-gray-700 mb-2">Additional Comments</label><textarea name="comments" rows="3" class="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-[#FF6B35] outline-none resize-none" placeholder="Describe the issue..."></textarea></div>
                <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-xs text-yellow-800">Return requests are processed within 3-5 business days. Refund will be credited within 7-10 days.</div>
                <button type="submit" class="w-full py-3 bg-[#FF6B35] text-white font-bold rounded-lg hover:bg-[#e55a2b]">Submit Return Request</button>
            </form>
        </div>
    </div>`;
}

function renderQuickViewModal() {
    if (!state.quickViewOpen || !state.quickViewProduct) return '';
    const p = state.quickViewProduct;
    return `
    <div class="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" onclick="app.closeQuickView()"></div>
        <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-fade-in">
            <button onclick="app.closeQuickView()" class="absolute top-4 right-4 z-10 p-2 bg-white rounded-full shadow text-gray-500 hover:text-gray-900">${ICONS.close}</button>
            <div class="grid grid-cols-2">
                <div class="aspect-square bg-gray-100 overflow-hidden"><img src="${p.image}" alt="${p.name}" class="w-full h-full object-cover" /></div>
                <div class="p-6 flex flex-col">
                    <div class="text-xs text-[#FF6B35] font-bold uppercase mb-1">${p.category}</div>
                    <h3 class="text-xl font-bold text-gray-900 mb-2">${p.name}</h3>
                    <div class="text-2xl font-bold text-gray-900 mb-3">${p.displayPrice}</div>
                    <p class="text-sm text-gray-500 mb-4 flex-1">${p.description}</p>
                    <div class="space-y-3">
                        <button onclick="app.addToCartById(${p.id}); app.closeQuickView();" class="w-full py-3 bg-[#FF6B35] text-white rounded-xl font-bold hover:bg-[#e55a2b]">Add to Cart</button>
                        <button onclick="app.selectProductById(${p.id}); app.closeQuickView();" class="w-full py-2 border border-gray-200 rounded-xl text-sm font-medium hover:border-[#FF6B35] hover:text-[#FF6B35]">View Full Details</button>
                    </div>
                </div>
            </div>
        </div>
    </div>`;
}

function renderChatWidget() {
    return `
    <div class="fixed bottom-6 right-6 z-50">
        ${state.chatOpen ? `
            <div class="mb-4 w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden animate-fade-in">
                <div class="bg-gray-900 p-4 flex justify-between items-center">
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 bg-[#FF6B35] rounded-full flex items-center justify-center text-white font-bold text-sm">FH</div>
                        <div><p class="text-white font-bold text-sm">Fashion Hub Support</p><p class="text-gray-400 text-xs">Usually replies instantly</p></div>
                    </div>
                    <button onclick="app.toggleChat()" class="text-gray-400 hover:text-white">${ICONS.close}</button>
                </div>
                <div class="h-64 overflow-y-auto p-4 space-y-3 bg-gray-50" id="chat-messages">
                    ${state.chatMessages.length === 0 ? '<p class="text-xs text-gray-400 text-center mt-8">👋 Hi! How can we help you today?</p>' : state.chatMessages.map(m => `<div class="flex ${m.from === 'user' ? 'justify-end' : 'justify-start'}"><div class="max-w-[70%] px-4 py-2 rounded-2xl text-sm ${m.from === 'user' ? 'bg-[#FF6B35] text-white rounded-br-sm' : 'bg-white text-gray-800 border border-gray-100 rounded-bl-sm shadow-sm'}">${m.text}<div class="text-[10px] ${m.from === 'user' ? 'text-orange-200' : 'text-gray-400'} mt-1">${m.time}</div></div></div>`).join('')}
                </div>
                <div class="p-3 border-t border-gray-100 bg-white flex gap-2">
                    <input type="text" id="chat-input" placeholder="Type a message..." class="flex-1 border border-gray-200 rounded-full px-4 py-2 text-sm focus:ring-1 focus:ring-[#FF6B35] outline-none" onkeypress="if(event.key==='Enter'){app.sendChatMessage(document.getElementById('chat-input').value);document.getElementById('chat-input').value='';}" />
                    <button onclick="const i=document.getElementById('chat-input');app.sendChatMessage(i.value);i.value='';" class="w-9 h-9 bg-[#FF6B35] rounded-full flex items-center justify-center text-white hover:bg-[#e55a2b]">→</button>
                </div>
            </div>
        ` : ''}
        <button onclick="app.toggleChat()" class="w-14 h-14 bg-[#FF6B35] rounded-full shadow-2xl flex items-center justify-center text-white hover:bg-[#e55a2b] transition-all hover:scale-110 active:scale-95">
            ${state.chatOpen ? ICONS.close : '<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 3H3v13h5l3 5 3-5h7V3z" /></svg>'}
        </button>
    </div>`;
}

function renderAuthModal() {
    if (!state.authModalOpen) return '';
    const isLogin = state.authMode === 'login';
    return `
    <div class="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" onclick="app.toggleAuth(false)"></div>
        <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in">
            <div class="p-8">
                <div class="flex justify-between items-center mb-6">
                    <div><h3 class="text-2xl font-bold text-gray-900">${isLogin ? 'Welcome Back' : 'Create Account'}</h3><p class="text-sm text-gray-500 mt-1">${isLogin ? 'Sign in to your account' : 'Register to start shopping.'}</p></div>
                    <button onclick="app.toggleAuth(false)" class="text-gray-400 hover:text-gray-600 p-2">${ICONS.close}</button>
                </div>
                <form onsubmit="${isLogin ? 'app.login(event)' : 'app.registerUser(event)'}" class="space-y-5">
                    ${!isLogin ? `<div><label class="block text-sm font-bold text-gray-700 mb-1">Full Name</label><input type="text" name="name" required class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6B35] focus:border-transparent outline-none" placeholder="John Doe" /></div>` : ''}
                    <div><label class="block text-sm font-bold text-gray-700 mb-1">Email Address</label><input type="email" name="email" required class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6B35] focus:border-transparent outline-none" placeholder="user@example.com" /></div>
                    <div><label class="block text-sm font-bold text-gray-700 mb-1">Password</label><input type="password" name="password" required class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6B35] focus:border-transparent outline-none" placeholder="••••••••" /></div>
                    ${!isLogin ? `<div><label class="block text-sm font-bold text-gray-700 mb-1">Confirm Password</label><input type="password" name="confirmPassword" required class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6B35] focus:border-transparent outline-none" placeholder="••••••••" /></div>` : ''}
                    <button type="submit" class="w-full py-4 bg-[#FF6B35] text-white font-bold rounded-lg hover:bg-[#e55a2b] transition-all shadow-md">${isLogin ? 'Sign In' : 'Register'}</button>
                </form>
                <div class="mt-6 text-center pt-6 border-t border-gray-100">
                    <p class="text-sm text-gray-600">${isLogin ? "Don't have an account?" : "Already have an account?"} <button onclick="app.toggleAuth(true, '${isLogin ? 'register' : 'login'}')" class="text-[#FF6B35] font-bold hover:underline">${isLogin ? 'Create Account' : 'Login'}</button></p>
                </div>
            </div>
        </div>
    </div>`;
}

function renderOTPModal() {
    if (!state.otpModalOpen) return '';
    return `
    <div class="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/60 backdrop-blur-sm"></div>
        <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 animate-fade-in">
            <h3 class="text-2xl font-bold text-gray-900 mb-2">Verify OTP</h3>
            <p class="text-sm text-gray-500 mb-6">Enter the 6-digit code sent to your email</p>
            <input type="text" maxlength="6" value="${state.otpValue}" oninput="app.updateOTP(this.value)" class="w-full px-4 py-3 border-2 border-gray-300 rounded-lg text-center text-2xl font-bold tracking-widest focus:ring-2 focus:ring-[#FF6B35] outline-none mb-4" placeholder="000000" />
            <div class="text-center mb-6"><span class="text-lg font-bold text-[#FF6B35]">${state.otpTimer}s</span></div>
            <button onclick="app.verifyOTP()" class="w-full py-3 bg-[#FF6B35] text-white font-bold rounded-lg hover:bg-[#e55a2b] mb-3">Verify OTP</button>
            <button onclick="state.otpModalOpen = false; render();" class="w-full py-3 border border-gray-300 rounded-lg">Cancel</button>
        </div>
    </div>`;
}

function renderPaymentModal() {
    if (!state.paymentModalOpen) return '';
    const subtotal = state.cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const discount = getDiscount(subtotal);
    const total = subtotal - discount;
    return `
    <div class="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" onclick="state.paymentModalOpen=false;render();"></div>
        <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in">
            <div class="p-6 border-b border-gray-100"><h3 class="text-xl font-bold text-gray-900">Select Payment Method</h3><p class="text-sm text-gray-500 mt-1">Total: ₹${total.toLocaleString()}</p></div>
            <div class="p-6 space-y-3">
                ${[{method:'UPI',title:'UPI Payment',desc:'Google Pay, PhonePe, Paytm',icon:'📱'},{method:'Card',title:'Credit/Debit Card',desc:'Visa, Mastercard, Rupay',icon:'💳'},{method:'COD',title:'Cash on Delivery',desc:'Pay when you receive',icon:'💵'}].map(({method,title,desc,icon}) => `
                    <button onclick="app.selectPaymentMethod('${method}')" class="w-full p-4 border-2 rounded-xl text-left transition-all ${state.selectedPaymentMethod === method ? 'border-[#FF6B35] bg-orange-50' : 'border-gray-200 hover:border-[#FF6B35]'}">
                        <div class="flex items-center justify-between">
                            <div class="flex items-center gap-3"><span class="text-2xl">${icon}</span><div><div class="font-bold text-gray-900">${title}</div><div class="text-xs text-gray-500">${desc}</div></div></div>
                            ${state.selectedPaymentMethod === method ? '<div class="w-6 h-6 bg-[#FF6B35] rounded-full flex items-center justify-center text-white text-xs">✓</div>' : ''}
                        </div>
                    </button>
                `).join('')}
            </div>
            <div class="p-6 border-t border-gray-100"><button onclick="app.processPayment()" class="w-full py-3 bg-[#FF6B35] text-white font-bold rounded-lg hover:bg-[#e55a2b]">Proceed to Pay ₹${total.toLocaleString()}</button></div>
        </div>
    </div>`;
}

function renderUPIPaymentModal() {
    if (!state.upiPaymentModalOpen) return '';
    const total = state.cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    return `
    <div class="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/60 backdrop-blur-sm"></div>
        <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-fade-in">
            <div class="p-6 border-b border-gray-100 flex justify-between items-center">
                <div><h3 class="text-xl font-bold text-gray-900">UPI Payment</h3><p class="text-sm text-gray-500 mt-1">Amount: ₹${total.toLocaleString()}</p></div>
                <button onclick="state.upiPaymentModalOpen=false;render();" class="text-gray-400 hover:text-gray-600">${ICONS.close}</button>
            </div>
            <div class="p-6 space-y-6">
                <div class="flex flex-col items-center"><div class="bg-white p-4 rounded-xl border-2 border-gray-200 mb-4"><div id="upi-qr-code"></div></div><p class="text-sm text-gray-600 text-center">Scan QR code with any UPI app</p></div>
                <div class="grid grid-cols-4 gap-3">${[{n:'GPay',g:'from-green-400 to-green-600'},{n:'PhonePe',g:'from-purple-500 to-purple-700'},{n:'Paytm',g:'from-blue-400 to-blue-600'},{n:'BHIM',g:'from-orange-400 to-red-500'}].map(a => `<button onclick="app.openUPIApp()" class="flex flex-col items-center gap-2 p-3 rounded-lg hover:bg-gray-50"><div class="w-12 h-12 bg-gradient-to-br ${a.g} rounded-full flex items-center justify-center text-white font-bold text-xs">${a.n}</div><span class="text-xs text-gray-600">${a.n}</span></button>`).join('')}</div>
                <div class="bg-gray-50 p-4 rounded-lg"><p class="text-xs text-gray-500 mb-2">Or pay directly to UPI ID:</p><div class="flex items-center gap-2"><input type="text" value="${UPI_CONFIG.upiId}" readonly class="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-mono" /><button onclick="app.copyUPIId()" class="px-4 py-2 bg-[#FF6B35] text-white rounded-lg text-sm font-bold hover:bg-[#e55a2b]">Copy</button></div></div>
                <div class="border-t border-gray-200 pt-4"><button onclick="app.confirmPaymentManually()" class="w-full py-3 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700">I Have Paid — Confirm Order</button></div>
            </div>
        </div>
    </div>`;
}

function renderCardPaymentModal() {
    if (!state.cardPaymentModalOpen) return '';
    const total = state.cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    return `
    <div class="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/60 backdrop-blur-sm"></div>
        <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in">
            <div class="p-6 border-b border-gray-100 flex justify-between items-center">
                <div><h3 class="text-xl font-bold text-gray-900">Card Payment</h3><p class="text-sm text-gray-500 mt-1">Amount: ₹${total.toLocaleString()}</p></div>
                <button onclick="state.cardPaymentModalOpen=false;render();" class="text-gray-400 hover:text-gray-600">${ICONS.close}</button>
            </div>
            <div class="p-6 space-y-4">
                <div><label class="block text-sm font-bold text-gray-700 mb-2">Card Number</label><input type="text" id="card-number" maxlength="19" placeholder="1234 5678 9012 3456" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:border-[#FF6B35] focus:ring-1 focus:ring-[#FF6B35] outline-none" oninput="this.value=this.value.replace(/\s/g,'').replace(/(\d{4})/g,'$1 ').trim()" /></div>
                <div><label class="block text-sm font-bold text-gray-700 mb-2">Cardholder Name</label><input type="text" id="card-name" placeholder="JOHN DOE" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:border-[#FF6B35] focus:ring-1 focus:ring-[#FF6B35] outline-none uppercase" /></div>
                <div class="grid grid-cols-2 gap-4">
                    <div><label class="block text-sm font-bold text-gray-700 mb-2">Expiry</label><input type="text" id="card-expiry" maxlength="5" placeholder="MM/YY" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:border-[#FF6B35] focus:ring-1 focus:ring-[#FF6B35] outline-none" oninput="this.value=this.value.replace(/\D/g,'').replace(/(\d{2})(\d)/,'$1/$2').substr(0,5)" /></div>
                    <div><label class="block text-sm font-bold text-gray-700 mb-2">CVV</label><input type="password" id="card-cvv" maxlength="3" placeholder="123" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:border-[#FF6B35] focus:ring-1 focus:ring-[#FF6B35] outline-none" oninput="this.value=this.value.replace(/\D/g,'')" /></div>
                </div>
                <div class="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 p-3 rounded-lg">${ICONS.lock} <span>Your card details are secure and encrypted</span></div>
                <button onclick="app.processCardPayment()" class="w-full py-3 bg-[#FF6B35] text-white font-bold rounded-lg hover:bg-[#e55a2b]">Pay ₹${total.toLocaleString()}</button>
            </div>
        </div>
    </div>`;
}

function renderCategoryModal() {
    if (!state.categoryModalOpen || !state.categoryModalData) return '';
    const modalData = state.categoryModalData;
    return `
    <div class="fixed inset-0 z-[90] flex justify-end">
        <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" onclick="app.closeCategoryModal()"></div>
        <div class="relative bg-white w-full max-w-2xl h-full overflow-y-auto shadow-2xl animate-fade-in">
            <div class="sticky top-0 bg-white border-b border-gray-100 px-6 py-5 flex justify-between items-center z-10">
                <div><h2 class="text-xl font-bold text-gray-900 mb-1">${modalData.title}</h2><div class="h-1 bg-[#FF6B35] w-12 rounded-full"></div></div>
                <button onclick="app.closeCategoryModal()" class="p-2 hover:bg-gray-100 rounded-full text-gray-500">${ICONS.close}</button>
            </div>
            <div class="p-6"><div class="grid grid-cols-2 md:grid-cols-3 gap-6">${modalData.items.map(item => `<div onclick="app.selectSubCategory('${item.category}')" class="group cursor-pointer"><div class="relative aspect-square bg-gray-100 rounded-2xl overflow-hidden mb-3 group-hover:shadow-lg transition-all border border-gray-100 group-hover:border-[#FF6B35]"><img src="${item.image}" alt="${item.name}" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" /></div><p class="text-sm font-semibold text-gray-700 text-center group-hover:text-[#FF6B35] transition-colors">${item.name}</p></div>`).join('')}</div></div>
        </div>
    </div>`;
}

function renderFooter() {
    return `
    <footer class="bg-gray-900 text-gray-400 py-16 border-t border-gray-800">
        <div class="max-w-7xl mx-auto px-4 md:px-6">
            <div class="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
                <div>
                    <div class="flex items-center gap-2 mb-6"><div class="w-8 h-8 text-white">${ICONS.logoMoon}</div><span class="text-xl font-bold text-white">FASHION HUB</span></div>
                    <p class="text-sm leading-relaxed mb-6">Experience the perfect blend of style and comfort. India's most trusted fashion destination since 2010.</p>
                    <div class="flex gap-4"><a href="#" class="w-8 h-8 bg-gray-800 rounded-full flex items-center justify-center hover:bg-[#FF6B35] hover:text-white transition-colors text-xs">fb</a><a href="#" class="w-8 h-8 bg-gray-800 rounded-full flex items-center justify-center hover:bg-[#FF6B35] hover:text-white transition-colors text-xs">in</a><a href="#" class="w-8 h-8 bg-gray-800 rounded-full flex items-center justify-center hover:bg-[#FF6B35] hover:text-white transition-colors text-xs">tw</a></div>
                </div>
                <div><h4 class="text-white font-bold mb-6">Shop</h4><ul class="space-y-3 text-sm">${['Men\'s Fashion','Women\'s Fashion','Kids Collection','Accessories','Footwear'].map(i => `<li><a href="#" class="hover:text-[#FF6B35] transition-colors">${i}</a></li>`).join('')}</ul></div>
                <div><h4 class="text-white font-bold mb-6">Support</h4><ul class="space-y-3 text-sm">${['Contact Us','Return Policy','Track Order','FAQs','Size Guide'].map(i => `<li><a href="#" class="hover:text-[#FF6B35] transition-colors">${i}</a></li>`).join('')}</ul></div>
                <div><h4 class="text-white font-bold mb-6">Newsletter</h4><p class="text-sm mb-4">Subscribe for exclusive offers and updates.</p><div class="flex gap-2"><input type="email" placeholder="Email Address" class="bg-gray-800 border-none rounded-lg px-4 py-2 text-white w-full focus:ring-1 focus:ring-[#FF6B35] focus:outline-none" /><button class="bg-[#FF6B35] text-white px-4 py-2 rounded-lg font-bold hover:bg-[#e55a2b]">Go</button></div>
                <!-- Payment Methods -->
                <div class="mt-6"><p class="text-xs text-gray-500 mb-2 uppercase tracking-wider">We Accept</p><div class="flex gap-2 flex-wrap">${['💳 Visa','💳 Mastercard','📱 UPI','💵 COD'].map(m => `<span class="text-xs bg-gray-800 px-3 py-1 rounded">${m}</span>`).join('')}</div></div></div>
            </div>
            <div class="border-t border-gray-800 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-sm">
                <p>&copy; 2024 Fashion Hub. All rights reserved.</p>
                <div class="flex gap-6"><a href="#" class="hover:text-[#FF6B35]">Privacy Policy</a><a href="#" class="hover:text-[#FF6B35]">Terms of Service</a><a href="#" class="hover:text-[#FF6B35]">Shipping Policy</a></div>
            </div>
        </div>
    </footer>`;
}

function renderBadges() {
    return `
    <div class="bg-gray-50 py-12 border-y border-gray-100">
        <div class="max-w-7xl mx-auto px-4 md:px-6 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            ${[{icon:'↩️',title:'Easy Returns',sub:'7 days return policy'},{icon:'🚚',title:'Free Delivery',sub:'On orders above ₹999'},{icon:'✅',title:'100% Authentic',sub:'Quality assured products'},{icon:'📱',title:'No Cost EMI',sub:'Easy monthly payments'}].map(b => `<div class="flex flex-col items-center group"><div class="text-3xl mb-4 group-hover:scale-110 transition-transform">${b.icon}</div><h4 class="font-bold text-gray-900 mb-1">${b.title}</h4><p class="text-sm text-gray-500">${b.sub}</p></div>`).join('')}
        </div>
    </div>`;
}

// MAIN RENDER
const root = document.getElementById('root');
let intervalId = null;

function render() {
    if (state.currentProduct || state.selectedCategory || state.searchQuery || state.view !== 'home' || state.authModalOpen) {
        if (intervalId) { clearInterval(intervalId); intervalId = null; }
    } else {
        if (!intervalId) { intervalId = setInterval(() => { state.currentSlide = (state.currentSlide + 1) % SLIDES.length; render(); }, 6000); }
    }

    if (state.view === 'adminLogin') { root.innerHTML = renderAdminLogin(); return; }

    if (state.view === 'admin') {
        root.innerHTML = renderAdminDashboard();
        if (state.adminUsers.length === 0 && window.backend) app.loadAdminsFromFirebase();
        if (state.adminUser && state.adminUser.isMain) setTimeout(() => loadPendingAdmins(), 100);
        return;
    }

    let mainContent = '';
    if (state.view === 'tracking') {
        mainContent = renderTrackingPage();
    } else if (state.currentProduct) {
        mainContent = renderProductDetails();
    } else {
        const isHome = !state.selectedCategory && !state.searchQuery;
        mainContent = `
            ${isHome ? renderHero() : ''}
            ${isHome ? renderCategoryCards() : ''}
            ${isHome ? renderBadges() : ''}
            ${renderProductList()}
            ${isHome && state.recentlyViewed.length > 0 ? renderRecentlyViewed() : ''}
        `;
    }

    root.innerHTML = `
        ${renderHeader()}
        <main>${mainContent}</main>
        ${(!state.currentProduct && state.view === 'home') ? renderFooter() : (state.view !== 'admin' && state.view !== 'adminLogin' ? renderFooter() : '')}
        ${renderCartDrawer()}
        ${renderWishlistDrawer()}
        ${renderCheckoutModal()}
        ${renderAuthModal()}
        ${renderOTPModal()}
        ${renderPaymentModal()}
        ${renderUPIPaymentModal()}
        ${renderCardPaymentModal()}
        ${renderCategoryModal()}
        ${renderCompareModal()}
        ${renderReviewModal()}
        ${renderProfileModal()}
        ${renderAddressModal()}
        ${renderReturnModal()}
        ${renderQuickViewModal()}
        ${renderChatWidget()}
    `;

    // Scroll chat to bottom
    const chatDiv = document.getElementById('chat-messages');
    if (chatDiv) chatDiv.scrollTop = chatDiv.scrollHeight;
}

// Firebase
let productsListenerUnsubscribe = null;

async function initializeProductsFromFirestore() {
    if (!window.backend) return;
    try {
        const res = await backend.getProducts();
        if (res.success && res.products && res.products.length > 0) {
            res.products.forEach(fp => {
                const ei = PRODUCTS.findIndex(p => p.id === fp.id);
                if (ei >= 0) PRODUCTS[ei] = { ...PRODUCTS[ei], ...fp, displayPrice: fp.displayPrice || `₹${fp.price.toLocaleString()}` };
                else PRODUCTS.push({ ...fp, displayPrice: fp.displayPrice || `₹${fp.price.toLocaleString()}` });
            });
            window.PRODUCTS = PRODUCTS;
            if (typeof render === "function") render();
        } else {
            if (PRODUCTS && PRODUCTS.length > 0) await backend.syncProductsToFirestore(PRODUCTS);
        }
    } catch (error) { console.error("Error initializing products:", error); }
    setupRealtimeProductListener();
}

function setupRealtimeProductListener() {
    if (!window.firebase || !window.backend) return;
    const db = firebase.firestore();
    if (productsListenerUnsubscribe) productsListenerUnsubscribe();
    productsListenerUnsubscribe = db.collection("products").onSnapshot(snapshot => {
        const updatedProducts = [];
        snapshot.forEach(doc => { const data = doc.data(); updatedProducts.push({ ...data, id: parseInt(doc.id) || parseInt(data.id) || doc.id }); });
        state.products = updatedProducts;
        if (updatedProducts.length > 0) {
            updatedProducts.forEach(fp => {
                const ei = PRODUCTS.findIndex(p => String(p.id) === String(fp.id));
                if (ei >= 0) PRODUCTS[ei] = { ...PRODUCTS[ei], ...fp, displayPrice: fp.displayPrice || `₹${fp.price.toLocaleString()}` };
                else PRODUCTS.push({ ...fp, displayPrice: fp.displayPrice || `₹${fp.price.toLocaleString()}` });
            });
            window.PRODUCTS = PRODUCTS;
            if (state.currentProduct) {
                const up = updatedProducts.find(p => String(p.id) === String(state.currentProduct.id));
                if (up) { state.currentProduct = { ...state.currentProduct, ...up, images: up.images || state.currentProduct.images, features: up.features || state.currentProduct.features, displayPrice: up.displayPrice || `₹${up.price.toLocaleString()}` }; app.calculatePrice(); }
            }
            if (typeof render === "function") render();
        }
    }, error => console.error("Products listener error:", error));
}

window.app = app;
window.PRODUCTS = PRODUCTS;
window.applyCoupon = applyCoupon;
window.removeCoupon = removeCoupon;

initApp();

// Admin pending admins loader
async function loadPendingAdmins() {
    const container = document.getElementById("pendingAdminsList");
    if (!container) return;
    const res = await backend.listPendingAdmins();
    if (!res.success) { container.innerHTML = '<p class="p-6 text-gray-500 text-sm">Failed to load.</p>'; return; }
    if (!res.admins || res.admins.length === 0) { container.innerHTML = '<div class="p-6 text-center text-gray-500 text-sm">No pending requests.</div>'; return; }
    container.innerHTML = `<table class="w-full text-left"><thead class="bg-gray-50 text-xs text-gray-500 uppercase"><tr><th class="px-6 py-4">Username</th><th class="px-6 py-4">Request Date</th><th class="px-6 py-4">Actions</th></tr></thead><tbody class="divide-y divide-gray-100 text-sm">${res.admins.map(a => { const d = a.createdAt ? (a.createdAt.toDate ? a.createdAt.toDate().toLocaleDateString() : new Date(a.createdAt).toLocaleDateString()) : 'N/A'; return `<tr><td class="px-6 py-4 font-bold text-gray-900">${a.username}</td><td class="px-6 py-4 text-gray-500">${d}</td><td class="px-6 py-4 flex gap-2"><button onclick="app.approveAdmin('${a.id}')" class="bg-green-600 text-white px-3 py-1.5 rounded text-xs font-bold hover:bg-green-700">Approve</button><button onclick="app.rejectAdmin('${a.id}')" class="bg-red-600 text-white px-3 py-1.5 rounded text-xs font-bold hover:bg-red-700">Reject</button></td></tr>`; }).join('')}</tbody></table>`;
}
