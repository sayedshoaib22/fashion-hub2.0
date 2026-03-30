// ui-utils.js - UI Helper Functions
const UIUtils = {
  loading: {
    show(message='Loading...') {
      if (document.getElementById('global-loader')) return;
      const loader = document.createElement('div');
      loader.id = 'global-loader';
      loader.innerHTML = `<div class="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm"><div class="bg-white rounded-2xl p-8 shadow-2xl flex flex-col items-center"><div class="w-16 h-16 border-4 border-[#FF6B35] border-t-transparent rounded-full animate-spin mb-4"></div><p class="text-gray-700 font-medium">${message}</p></div></div>`;
      document.body.appendChild(loader);
    },
    hide() { const l = document.getElementById('global-loader'); if (l) l.remove(); }
  },
  notification: {
    show(message, type='info', duration=3000) {
      const colors = { success:'bg-green-500', error:'bg-red-500', warning:'bg-yellow-500', info:'bg-blue-500' };
      const icons = { success:'✓', error:'✕', warning:'⚠', info:'ℹ' };
      const n = document.createElement('div');
      n.className = 'fixed top-4 right-4 z-[300] animate-fade-in';
      n.innerHTML = `<div class="${colors[type]} text-white px-6 py-4 rounded-lg shadow-2xl flex items-center gap-3 max-w-md"><span class="text-2xl">${icons[type]}</span><p class="font-medium">${message}</p><button onclick="this.parentElement.parentElement.remove()" class="ml-4 text-white/80 hover:text-white">✕</button></div>`;
      document.body.appendChild(n);
      if (duration > 0) setTimeout(() => { n.style.opacity='0'; n.style.transform='translateX(100%)'; setTimeout(()=>n.remove(),300); }, duration);
    },
    success(msg) { this.show(msg,'success'); },
    error(msg) { this.show(msg,'error',5000); },
    warning(msg) { this.show(msg,'warning'); },
    info(msg) { this.show(msg,'info'); }
  },
  formatCurrency(amount) { return new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(amount); },
  formatDate(date) { return new Date(date).toLocaleDateString('en-IN'); },
  debounce(func, wait) {
    let timeout;
    return function(...args) { clearTimeout(timeout); timeout = setTimeout(()=>func(...args), wait); };
  },
  isMobile() { return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent); },
  async copyToClipboard(text) {
    try { await navigator.clipboard.writeText(text); this.notification.success('Copied!'); return true; }
    catch { this.notification.error('Failed to copy'); return false; }
  }
};
if (typeof module !== 'undefined' && module.exports) module.exports = UIUtils;
window.UIUtils = UIUtils;
