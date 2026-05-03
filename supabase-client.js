// supabase-client.js
// Shared Supabase client instance with SafeStore to prevent auth deadlock and localStorage errors

const SUPABASE_URL = 'https://hbvrfuypyzkvpuobjynw.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhidnJmdXlweXprdnB1b2JqeW53Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcxNTM1NzYsImV4cCI6MjA5MjcyOTU3Nn0.UR_mcEFMc31YP443zeCfCOVYjV6groSoofDbZbco7fw';

// SafeStore wrapper to handle cases where localStorage is blocked
const SafeStore = {
  getItem: function(key) {
    try {
      return window.localStorage.getItem(key);
    } catch (e) {
      console.warn('localStorage access blocked, using memory fallback');
      return window.__safeStore ? window.__safeStore[key] : null;
    }
  },
  setItem: function(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch (e) {
      if (!window.__safeStore) window.__safeStore = {};
      window.__safeStore[key] = value;
    }
  },
  removeItem: function(key) {
    try {
      window.localStorage.removeItem(key);
    } catch (e) {
      if (window.__safeStore) delete window.__safeStore[key];
    }
  }
};

window.SafeStore = SafeStore;

// Single shared instance with lock: 'none' and custom storage
window.sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    storage: SafeStore,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce'
  }
});
