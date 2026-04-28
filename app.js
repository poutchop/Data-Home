// ============================================================
// DATA VAULT — Carbon Clarity dMRV Platform
// app.js v3.0 — Clean rewrite (Adapted for Production)
// ============================================================

// == SUPABASE CONFIG ==
const SUPABASE_URL = 'https://hbvrfuypyzkvpuobjynw.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhidnJmdXlweXprdnB1b2JqeW53Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcxNTM1NzYsImV4cCI6MjA5MjcyOTU3Nn0.UR_mcEFMc31YP443zeCfCOVYjV6groSoofDbZbco7fw';
const ADMIN_EMAILS = ['admin@carbonclarify.com', 'poutchop@gmail.com'];

// Initialize Client (Made global for scanner.js)
var sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
window.sb = sb;

// ── Tab navigation ───────────────────────────────────────────
function setTab(id, el) {
  const panels = ['impact', 'feed', 'analytics', 'leaderboard', 'map', 'main', 'scanner'];
  panels.forEach(p => {
    const panel = document.getElementById('panel-' + p);
    if (panel) panel.style.display = (p === id) ? 'block' : 'none';
  });

  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  if (el) el.classList.add('active');
}

// ── Auth ─────────────────────────────────────────────────────
async function handleAuth(email, password) {
  // If no arguments provided, try to read from the login form
  if (!email || !password) {
    email = document.getElementById('login-email')?.value;
    password = document.getElementById('login-password')?.value;
  }
  
  if (!email || !password) {
    showToast('Please enter credentials', 'warning');
    return;
  }
  
  try {
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    
    const userRole = ADMIN_EMAILS.includes(data.user.email) ? 'admin' : 'user';
    onLoginSuccess(userRole);
    showToast('Signed in as ' + (data.user.user_metadata?.full_name || data.user.email));
  } catch (e) {
    showToast(e.message, 'warning');
  }
}

async function handleLogout() {
  await sb.auth.signOut();
  location.reload();
}

function onLoginSuccess(role) {
  document.getElementById('auth-modal').style.display = 'none';
  document.querySelectorAll('.secure-tab').forEach(el => el.style.display = 'block');
  document.querySelectorAll('.admin-only').forEach(el => {
    el.style.display = role === 'admin' ? 'block' : 'none';
  });
}

// ── Load all data ────────────────────────────────────────────
async function loadAll() {
  await loadMetrics();
  await loadLeaderboard();
  await loadNutrition();
  await loadFeed();
  await loadParticipantStory();
}

// ── Metric cards ─────────────────────────────────────────────
async function loadMetrics() {
  try {
    // Total hardened scans
    const { count: scanCount } = await sb
      .from('scans').select('*', { count: 'exact', head: true })
      .eq('status', 'hardened');

    // Total scans (for rate)
    const { count: totalCount } = await sb
      .from('scans').select('*', { count: 'exact', head: true });

    // CO2
    const { data: co2Data } = await sb
      .from('scans').select('co2_kg').eq('status', 'hardened');

    // Active participants
    const { count: partCount } = await sb
      .from('participants').select('*', { count: 'exact', head: true });

    // Payouts
    const { data: payData } = await sb
      .from('payouts').select('amount_ghs').eq('status', 'confirmed');

    const rate = totalCount > 0 ? Math.round((scanCount / totalCount) * 100) : 0;
    const co2 = (co2Data || []).reduce((s, r) => s + parseFloat(r.co2_kg || 0), 0);
    const paid = (payData || []).reduce((s, r) => s + parseFloat(r.amount_ghs || 0), 0);

    setText('m-scans', scanCount ?? 0);
    setText('m-rate', rate + '%');
    setText('m-co2', co2.toFixed(1));
    setText('m-participants', partCount ?? 0);
    setText('m-payout', 'GHS ' + paid.toFixed(2));

  } catch (err) {
    console.error('loadMetrics error:', err);
  }
}

// ── Leaderboard ───────────────────────────────────────────────
async function loadLeaderboard() {
  const { data } = await sb
    .from('participants')
    .select('full_name, site, total_points, weeks_active')
    .order('total_points', { ascending: false })
    .limit(9);

  const list = document.getElementById('lb-list');
  if (!list || !data) return;

  const medals = ['🥇', '🥈', '🥉'];
  list.innerHTML = data.map((p, i) => `
    <div style="display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--border);">
      <span style="font-size:20px;">${medals[i] || (i + 1)}</span>
      <div style="flex:1;">
        <div style="font-weight:700;font-size:13px;">${p.full_name}</div>
        <div style="font-size:11px;color:var(--muted);">${p.site} · Week ${p.weeks_active}</div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:18px;font-weight:800;color:var(--green);">${p.total_points}</div>
        <div style="font-size:10px;color:var(--muted);">pts</div>
      </div>
    </div>`).join('');
}

// ── Nutrition logs ────────────────────────────────────────────
async function loadNutrition() {
  const { data } = await sb
    .from('nutrition_logs')
    .select('*, participants(full_name)')
    .order('logged_at', { ascending: false })
    .limit(10);

  const tbody = document.getElementById('nutrition-body');
  if (!tbody || !data) return;

  tbody.innerHTML = data.map(r => `
    <tr>
      <td>${new Date(r.logged_at).toLocaleDateString()}</td>
      <td>${r.participants?.full_name || '—'}</td>
      <td>${r.site || '—'}</td>
      <td>${r.meal_name || '—'}</td>
      <td>${r.protein_g || '—'}</td>
      <td>${r.kcal || '—'}</td>
      <td style="color:var(--green);font-weight:700;">${r.score || '—'}</td>
      <td>${r.verified ? '<span class="badge b-green">Yes</span>' : '<span class="badge b-red">No</span>'}</td>
    </tr>`).join('');
}

// ── Hardening feed ────────────────────────────────────────────
async function loadFeed() {
  const { data } = await sb
    .from('scans')
    .select('*, participants(full_name, site)')
    .order('scanned_at', { ascending: false })
    .limit(12);

  const list = document.getElementById('feed-list');
  if (!list || !data) return;

  const icons = { firewood_avoidance: '🔥', nutrition_meal: '🥗', solar_drying: '☀️', organic_fertilizer: '🌿' };

  list.innerHTML = data.map(r => `
    <div style="padding:12px 0;border-bottom:1px solid var(--border);display:flex;gap:10px;align-items:center;">
      <span style="font-size:18px;">${icons[r.action_type] || '📋'}</span>
      <div style="flex:1;">
        <div style="font-weight:600;font-size:12px;">${r.participants?.full_name || 'Unknown'}</div>
        <div style="font-size:11px;color:var(--muted);">${r.participants?.site || '—'} · ${(r.action_type || '').replace(/_/g, ' ')}</div>
      </div>
      <div style="text-align:right;">
        <span class="badge ${r.status === 'hardened' ? 'b-green' : 'b-red'}">${(r.status || '').toUpperCase()}</span>
        <div style="font-size:10px;color:var(--muted);margin-top:3px;">+${r.points_awarded || 0}pts · ${r.co2_kg || 0}kg CO₂</div>
      </div>
    </div>`).join('');
}

// ── Participant spotlight ─────────────────────────────────────
async function loadParticipantStory() {
  const { data } = await sb
    .from('participants')
    .select('full_name, site, total_points, weeks_active')
    .order('total_points', { ascending: false })
    .limit(1)
    .single();

  const p = data || { full_name: 'Akosua Mensah', site: 'Berekuso Farm A', total_points: 147, weeks_active: 4 };
  const box = document.getElementById('participant-story-body');
  if (!box) return;

  box.innerHTML = `
    <div style="display:flex;align-items:center;gap:14px;padding:10px 0;">
      <div style="width:52px;height:52px;border-radius:50%;background:var(--green);display:flex;align-items:center;justify-content:center;font-size:24px;flex-shrink:0;">🌿</div>
      <div>
        <div style="font-weight:800;font-size:16px;">${p.full_name}</div>
        <div style="font-size:12px;color:var(--muted);">${p.site} · Week ${p.weeks_active} participant</div>
      </div>
    </div>
    <div style="background:var(--surf2);border-radius:10px;padding:14px;margin-top:10px;">
      <div style="font-size:11px;color:var(--muted);margin-bottom:4px;">TOTAL CLIMATE POINTS</div>
      <div style="font-size:32px;font-weight:800;color:var(--green);">${p.total_points}</div>
    </div>
    <div style="font-size:12px;color:var(--muted);margin-top:12px;font-style:italic;">
      Verified by triple-factor dMRV scan · Ahotor stove daily use
    </div>`;
}

// ── UI HELPERS ───────────────────────────────────────────────
function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span style="font-size:14px;">${type === 'success' ? '✓' : '⚠'}</span> ${message}`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

function showAuth() { document.getElementById('auth-modal').style.display = 'flex'; }
function hideAuth() { document.getElementById('auth-modal').style.display = 'none'; }
function toggleTheme() { document.body.classList.toggle('light-mode'); }

// ── IMPACT MAP ──────────────────────────────────────────────
function initImpactMap() {
  const mapEl = document.getElementById('impact-map');
  if (!mapEl) return;
  
  // Initialize map centered on Berekuso
  const map = L.map('impact-map').setView([5.7456, -0.3214], 14);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap'
  }).addTo(map);

  // Berekuso farm locations from developer brief
  L.marker([5.7456, -0.3214]).addTo(map).bindPopup('<b>Berekuso Farm A</b>');
  L.marker([5.7448, -0.3221]).addTo(map).bindPopup('<b>Berekuso Farm B</b>');
  L.marker([5.7444, -0.3228]).addTo(map).bindPopup('<b>Tomato Co-op West</b>');
  
  // Force resize check
  setTimeout(() => map.invalidateSize(), 500);
}

// ── PWA & INIT ────────────────────────────────────────────────
let deferredPrompt;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredPrompt = e; });
function installPwa() {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then(() => { deferredPrompt = null; });
  } else {
    showToast('To install: tap browser menu → "Add to Home Screen"', 'info');
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  // Theme load
  const theme = localStorage.getItem('dv-theme') || 'dark';
  document.body.className = theme + '-mode';

  // Auth check
  const { data: { session } } = await sb.auth.getSession();
  if (session) {
    const role = ADMIN_EMAILS.includes(session.user.email) ? 'admin' : 'user';
    onLoginSuccess(role);
  }

  // Live Load
  await loadAll();
  initImpactMap();
  
  // Refresh loop
  setInterval(loadMetrics, 30000);
  setInterval(loadFeed, 30000);
  setInterval(loadLeaderboard, 30000);
});
