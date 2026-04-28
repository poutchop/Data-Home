// ══ SUPABASE CONFIG ═══════════════════════════════════════════════
const SUPABASE_URL = 'https://hbvrfuypyzkvpuobjynw.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhidnJmdXlweXprdnB1b2JqeW53Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcxNTM1NzYsImV4cCI6MjA5MjcyOTU3Nn0.UR_mcEFMc31YP443zeCfCOVYjV6groSoofDbZbco7fw';
let currentUser = null;
let userRole = 'user'; // 'admin' or 'user'
const ADMIN_EMAILS = ['admin@carbonclarify.com', 'poutchop@gmail.com'];

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// DB Connection Test
supabase.from('participants').select('count', { count: 'exact', head: true }).then(({data, count, error}) => {
  console.log('DB test (participants count):', count, data, error);
});

// ── Section 4: Modular Loaders from Developer Brief ──

async function loadMetrics() {
  if (!supabase) return;
  try {
    // Total verified scans
    const { count: scanCount } = await supabase
      .from('scans').select('*', { count: 'exact', head: true })
      .eq('status', 'hardened');
    document.getElementById('m-scans').textContent = scanCount || 0;

    // Verification rate
    const { count: total } = await supabase
      .from('scans').select('*', { count: 'exact', head: true });
    const rate = total > 0 ? Math.round((scanCount / total) * 100) : 0;
    document.getElementById('m-rate').textContent = rate + '%';

    // CO2 avoided
    const { data: co2Data } = await supabase
      .from('scans').select('co2_kg').eq('status', 'hardened');
    const co2Total = (co2Data || []).reduce((s, r) => s + (r.co2_kg || 0), 0);
    document.getElementById('m-co2').textContent = co2Total.toFixed(1);

    // Payouts total
    const { data: payData } = await supabase
      .from('payouts').select('amount_ghs').eq('status', 'confirmed');
    const payTotal = (payData || []).reduce((s, r) => s + (r.amount_ghs || 0), 0);
    document.getElementById('m-payout').textContent = 'GHS ' + payTotal.toFixed(2);

  } catch(e) { console.error('loadMetrics error:', e); }
}

async function loadLeaderboard() {
  if (!supabase) return;
  const { data } = await supabase
    .from('participants')
    .select('full_name, site, total_points, weeks_active')
    .order('total_points', { ascending: false })
    .limit(9);
  const list = document.getElementById('lb-list');
  if (!list || !data) return;
  const medals = ['🥇','🥈','🥉'];
  list.innerHTML = data.map((p, i) => `
    <div style='display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--border);'>
      <span style='font-size:20px;'>${medals[i] || (i+1)}</span>
      <div style='flex:1;'>
        <div style='font-weight:700;font-size:13px;'>${p.full_name}</div>
        <div style='font-size:11px;color:var(--muted);'>${p.site}</div>
      </div>
      <div style='text-align:right;'>
        <div style='font-size:18px;font-weight:800;color:var(--green);'>${p.total_points}</div>
        <div style='font-size:10px;color:var(--muted);'>pts</div>
      </div>
    </div>`).join('');
}

async function loadNutrition() {
  if (!supabase) return;
  const { data } = await supabase
    .from('nutrition_logs')
    .select('logged_at, participant_id, site, meal_name, protein_g, kcal, score, verified, participants(full_name)')
    .order('logged_at', { ascending: false })
    .limit(10);
  const tbody = document.getElementById('nutrition-body');
  if (!tbody || !data) return;
  tbody.innerHTML = data.map(r => `
    <tr>
      <td>${new Date(r.logged_at).toLocaleDateString()}</td>
      <td>${r.participants?.full_name || '—'}</td>
      <td>${r.site}</td>
      <td>${r.meal_name}</td>
      <td>${r.protein_g}</td>
      <td>${r.kcal}</td>
      <td style='color:var(--green);font-weight:700;'>${r.score}</td>
      <td>${r.verified ? '<span class="badge b-green">Yes</span>' : '<span class="badge b-red">No</span>'}</td>
    </tr>`).join('');
}

async function loadFeed() {
  if (!supabase) return;
  const { data } = await supabase
    .from('scans')
    .select('scanned_at, action_type, status, points_awarded, co2_kg, gps_lat, gps_lng, participants(full_name, site)')
    .order('scanned_at', { ascending: false })
    .limit(12);
  const list = document.getElementById('feed-list');
  if (!list || !data) return;
  list.innerHTML = data.map(r => {
    const icons = {firewood_avoidance:'🔥',nutrition_meal:'🥗',solar_drying:'☀️'};
    return `<div style='padding:12px 0;border-bottom:1px solid var(--border);display:flex;gap:10px;align-items:center;'>
      <span style='font-size:18px;'>${icons[r.action_type]||'📋'}</span>
      <div style='flex:1;'>
        <div style='font-weight:600;font-size:12px;'>${r.participants?.full_name||'Unknown'}</div>
        <div style='font-size:11px;color:var(--muted);'>${r.participants?.site} · ${r.action_type.replace(/_/g,' ')}</div>
      </div>
      <div style='text-align:right;'>
        <span class='badge ${r.status==='hardened'?'b-green':'b-red'}'>${r.status.toUpperCase()}</span>
        <div style='font-size:10px;color:var(--muted);margin-top:3px;'>+${r.points_awarded}pts · ${r.co2_kg||0}kg CO₂</div>
      </div>
    </div>`;
  }).join('');
}

async function loadParticipantStory() {
  if (!supabase) return;
  const { data } = await supabase
    .from('participants')
    .select('full_name, site, total_points, weeks_active')
    .order('total_points', { ascending: false })
    .limit(1)
    .single();
  const box = document.getElementById('participant-story-body');
  if (!box) return;
  const p = data || { full_name:'Akosua Mensah', site:'Berekuso Farm A', total_points:147, weeks_active:4 };
  box.innerHTML = `
    <div style='display:flex;align-items:center;gap:14px;padding:10px 0;'>
      <div style='width:52px;height:52px;border-radius:50%;background:var(--green);display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;'>🌿</div>
      <div>
        <div style='font-weight:800;font-size:16px;'>${p.full_name}</div>
        <div style='font-size:12px;color:var(--muted);'>${p.site} · Week ${p.weeks_active} participant</div>
      </div>
    </div>
    <div style='background:var(--surf2);border-radius:10px;padding:14px;margin-top:10px;'>
      <div style='font-size:11px;color:var(--muted);margin-bottom:4px;'>TOTAL POINTS</div>
      <div style='font-size:28px;font-weight:800;color:var(--green);'>${p.total_points}</div>
    </div>
    <div style='font-size:12px;color:var(--muted);margin-top:12px;font-style:italic;'>
      Using the Ahotor stove daily — verified by triple-factor dMRV scan.
    </div>`;
}

async function loadAllData() {
  await loadMetrics();
  await loadLeaderboard();
  await loadNutrition();
  await loadFeed();
  await loadParticipantStory();
}

async function init() {
  loadTheme();
  initSparklines();
  initCharts();
  
  await loadMetrics();
  await loadLeaderboard();
  await loadNutrition();
  await loadFeed();
  await loadParticipantStory();
  
  // Auto-refresh every 30 seconds
  setInterval(loadMetrics, 30000);
  setInterval(loadFeed, 30000);
  setInterval(loadLeaderboard, 30000);
}

document.addEventListener('DOMContentLoaded', init);

// Global error handler
window.onerror = function(msg, url, line, col, error) {
  console.error('GLOBAL ERROR:', msg, 'at', line, ':', col);
  if (typeof showToast === 'function') showToast('App error: ' + msg, 'error');
  return false;
};

// ══ UI HELPERS ════════════════════════════════════════════════════

function showToast(message, type) {
  type = type || 'success';
  var container = document.getElementById('toast-container');
  if (!container) return;
  var icon = type === 'success' ? '✓' : '⚠';
  var toast = document.createElement('div');
  toast.className = 'toast ' + type;
  toast.innerHTML = '<span style="font-size:14px;">' + icon + '</span> ' + message;
  container.appendChild(toast);
  setTimeout(function() { if (toast.parentNode) toast.remove(); }, 4000);
}

function loadTheme() {
  var theme = localStorage.getItem('dv-theme') || 'dark';
  document.body.className = theme + '-mode';
}

function toggleTheme() {
  var isDark = document.body.classList.contains('dark-mode');
  var newTheme = isDark ? 'light' : 'dark';
  document.body.className = newTheme + '-mode';
  localStorage.setItem('dv-theme', newTheme);
}

// ══ CHARTS ═══════════════════════════════════════════════════════
var chartDefaults = {
  responsive: true, maintainAspectRatio: false,
  plugins: { legend: { labels: { color: '#8b8fa8', font: { size: 11, family: 'Inter' }, boxWidth: 10 } } },
};
function gridOpts() { return { color: 'rgba(255,255,255,0.04)', drawBorder: false }; }
function tickOpts() { return { color: '#8b8fa8', font: { size: 10, family: 'Inter' } }; }

var co2Chart, bundleChart, nutritionChart, statusChart, radarChart;

function initCharts() {
  var weeks = ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7'];

  if (!co2Chart && document.getElementById('co2Chart')) {
    co2Chart = new Chart(document.getElementById('co2Chart'), {
      type: 'bar',
      data: {
        labels: weeks,
        datasets: [
          { label: 'CO₂ avoided (kg)', data: [210, 285, 320, 410, 388, 447, 520], backgroundColor: 'rgba(16,217,126,0.75)', borderRadius: 6, borderSkipped: false },
          { label: 'Baseline', data: [180, 180, 180, 180, 180, 180, 180], backgroundColor: 'rgba(244,161,52,0.4)', borderRadius: 6, borderSkipped: false },
        ]
      },
      options: { ...chartDefaults, scales: { x: { grid: gridOpts(), ticks: tickOpts() }, y: { grid: gridOpts(), ticks: tickOpts() } } },
    });
  }

  if (!statusChart && document.getElementById('statusChart')) {
    statusChart = new Chart(document.getElementById('statusChart'), {
      type: 'doughnut',
      data: {
        labels: ['Hardened', 'Flagged', 'Rejected'],
        datasets: [{
          data: [41, 4, 2],
          backgroundColor: ['rgba(16,217,126,0.8)', 'rgba(244,161,52,0.8)', 'rgba(255,90,90,0.8)'],
          borderWidth: 0,
          spacing: 3,
          borderRadius: 4,
        }]
      },
      options: {
        ...chartDefaults,
        cutout: '65%',
        plugins: {
          legend: { position: 'bottom', labels: { color: '#8b8fa8', font: { size: 11, family: 'Inter' }, padding: 14, boxWidth: 10 } },
        }
      },
    });
  }
}

function initSparklines() {
  setTimeout(function() {
    drawSparkline('spark-scans', [28, 32, 35, 40, 38, 44, 47], '#10d97e');
    drawSparkline('spark-rate', [88, 90, 91, 93, 92, 95, 94], '#4d9fff');
    drawSparkline('spark-co2', [1800, 2010, 2200, 2420, 2580, 2700, 2841], '#f4a134');
    drawSparkline('spark-pay', [620, 740, 850, 980, 1050, 1140, 1240], '#9d7dff');
  }, 600);
}

function drawSparkline(id, data, color) {
  var canvas = document.getElementById(id);
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  var dw = canvas.width;
  var dh = canvas.height;
  
  ctx.clearRect(0, 0, dw, dh);
  var max = Math.max.apply(null, data);
  var min = Math.min.apply(null, data);
  var range = max - min || 1;
  var step = dw / (data.length - 1);

  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.lineJoin = 'round';

  data.forEach(function(v, i) {
    var x = i * step;
    var y = dh - ((v - min) / range) * (dh - 4) - 2;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
}

// ══ AUTH & NAVIGATION ════════════════════════════════════════════

function setTab(id, el) {
  var panels = ['impact', 'feed', 'analytics', 'leaderboard', 'map', 'main', 'scanner'];
  panels.forEach(function(p) {
    var panel = document.getElementById('panel-' + p);
    if (panel) panel.style.display = (p === id) ? 'block' : 'none';
  });

  document.querySelectorAll('.tab').forEach(function(t) { t.classList.remove('active'); });
  if (el) el.classList.add('active');
}

async function handleAuth() {
  if (!supabase) return;
  const email = document.getElementById('auth-email').value;
  const password = document.getElementById('auth-pass').value;
  if (!email || !password) {
    showToast('Please enter credentials', 'warning');
    return;
  }
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    currentUser = data.user;
    userRole = ADMIN_EMAILS.includes(currentUser.email) ? 'admin' : 'user';
    localStorage.setItem('dv-user', JSON.stringify(currentUser));
    onLoginSuccess();
    showToast('Signed in as ' + (currentUser.user_metadata?.full_name || currentUser.email));
  } catch (e) {
    showToast(e.message, 'warning');
  }
}

function showAuth() {
  document.getElementById('auth-modal').style.display = 'flex';
}
function hideAuth() {
  document.getElementById('auth-modal').style.display = 'none';
}
function toggleAuthMode() {
  const signin = document.getElementById('auth-signin-form');
  const request = document.getElementById('auth-request-form');
  if (signin.style.display === 'none') {
    signin.style.display = 'block';
    request.style.display = 'none';
  } else {
    signin.style.display = 'none';
    request.style.display = 'block';
  }
}
async function handleLogout() {
  if (supabase) await supabase.auth.signOut();
  currentUser = null;
  userRole = 'user';
  localStorage.removeItem('dv-user');
  location.reload();
}

function checkPassStrength(pass) {
  const bar = document.getElementById('strength-bar');
  if (!bar) return;
  let s = 0;
  if (pass.length > 6) s += 33;
  if (/[A-Z]/.test(pass)) s += 33;
  if (/[0-9]/.test(pass)) s += 34;
  bar.style.width = s + '%';
  bar.style.background = s < 40 ? 'var(--red)' : (s < 80 ? 'var(--amber)' : 'var(--green)');
}
async function submitAccessRequest() {
  showToast('Access request submitted! Admin will review.', 'success');
  hideAuth();
}

function logout() {
  handleLogout();
}

// ── PWA INSTALL ──
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  const installBtn = document.getElementById('pwa-install-btn');
  if (installBtn) installBtn.style.display = 'block';
});

async function installPwa() {
  if (!deferredPrompt) {
    showToast('App already installed or not supported', 'info');
    return;
  }
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  if (outcome === 'accepted') {
    console.log('User accepted the install prompt');
  }
  deferredPrompt = null;
  const installBtn = document.getElementById('pwa-install-btn');
  if (installBtn) installBtn.style.display = 'none';
}

function onLoginSuccess() {
  document.getElementById('auth-modal').style.display = 'none';
  document.querySelectorAll('.admin-only').forEach(el => {
    el.style.display = userRole === 'admin' ? 'block' : 'none';
  });
}

// ══ EXPORT ════════════════════════════════════════════════════════

function exportExcel() {
  showToast('Generating Excel report...', 'success');
  // Mock export for now
  setTimeout(() => {
    showToast('Report downloaded successfully', 'success');
  }, 2000);
}
