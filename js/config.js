// config.js — Railway backend, no Firebase
const CONFIG = {
  api: {
    baseUrl: 'https://bakery-backend-production-dbeb.up.railway.app',
  },
  app: {
    name: 'Fashion Hub',
    version: '2.0.0',
    environment: 'production',
  },
  features: {
    enablePayments: false,
    enableStockNotifications: true,
    enableOrderTracking: true,
    enableAdminApproval: true,
  },
};
Object.freeze(CONFIG);
window.CONFIG = CONFIG;

// Stub so backend-secure.js doesn't break if accidentally loaded
window.getFirebaseConfig = () => ({});
