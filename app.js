// ══ SUPABASE CONFIG ═══════════════════════════════════════════════
const SUPABASE_URL = 'https://hbvrfuypyzkvpuobjynw.supabase.co';
const SUPABASE_KEY = '';  // Paste your Supabase anon key here (starts with eyJ...)
let supabase = null;
let currentUser = null;
let userRole = 'user'; // 'admin' or 'user'

// Admin emails — add your email here to get admin access
const ADMIN_EMAILS = ['admin@carbonclarify.com', 'poutchop@gmail.com'];

if (SUPABASE_URL && SUPABASE_KEY && window.supabase) {
  supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
}

// ══ MOCK DATA ═══════════════════════════════════════════════════
var feedData = [
  {name:'Akosua Mensah', board:'014', site:'Farm A', action:'firewood_avoidance', status:'hardened', time:'09:42'},
  {name:'Abena Owusu',   board:'007', site:'Farm B', action:'nutrition_meal',    status:'hardened', time:'09:38'},
  {name:'Efua Darko',    board:'021', site:'Co-op W',action:'firewood_avoidance', status:'flagged',  time:'09:31'},
  {name:'Ama Asante',    board:'003', site:'Farm A', action:'firewood_avoidance', status:'hardened', time:'09:27'},
  {name:'Adwoa Boateng', board:'019', site:'Farm B', action:'nutrition_meal',    status:'hardened', time:'09:19'},
  {name:'Yaa Frimpong',  board:'011', site:'Co-op W',action:'firewood_avoidance', status:'rejected', time:'09:15'},
  {name:'Akua Nkrumah',  board:'006', site:'Farm A', action:'nutrition_meal',    status:'hardened', time:'09:08'},
  {name:'Serwa Adjei',   board:'002', site:'Farm A', action:'solar_drying',      status:'hardened', time:'09:01'},
  {name:'Araba Quaye',   board:'017', site:'Farm B', action:'nutrition_meal',    status:'hardened', time:'08:55'},
  {name:'Akosua Mensah', board:'014', site:'Farm A', action:'firewood_avoidance', status:'hardened', time:'08:48'},
];

var lbData = [
  {name:'Akosua Mensah', site:'Farm A', pts:142, pct:100, pay:'11.83', rank:1},
  {name:'Ama Asante',    site:'Farm A', pts:138, pct:97,  pay:'11.50', rank:2},
  {name:'Abena Owusu',   site:'Farm B', pts:131, pct:92,  pay:'10.92', rank:3},
  {name:'Adwoa Boateng', site:'Farm B', pts:119, pct:84,  pay:'9.92',  rank:4},
  {name:'Akua Nkrumah',  site:'Farm A', pts:107, pct:75,  pay:'8.92',  rank:5},
  {name:'Yaa Frimpong',  site:'Co-op W',pts:98,  pct:69,  pay:'8.17',  rank:6},
];

var nutritionRows = [
  {date:'2026-04-15',name:'Akosua Mensah',site:'Farm A',meal:'Bean stew with greens',protein:28,kcal:480,score:82,verified:true},
  {date:'2026-04-15',name:'Abena Owusu',  site:'Farm B',meal:'Kontomire with yam',   protein:22,kcal:410,score:74,verified:true},
  {date:'2026-04-14',name:'Akosua Mensah',site:'Farm A',meal:'Groundnut soup + rice', protein:31,kcal:520,score:86,verified:true},
  {date:'2026-04-14',name:'Ama Asante',   site:'Farm A',meal:'Egg with tomato sauce', protein:18,kcal:360,score:68,verified:false},
  {date:'2026-04-13',name:'Abena Owusu',  site:'Farm B',meal:'Bean stew',             protein:25,kcal:440,score:78,verified:true},
];

// ══ ANIMATED COUNTER ═════════════════════════════════════════════
function animateCounter(el, target, duration) {
  if (!el) return;
  var start = 0;
  var startTime = null;
  var text = el.textContent;
  var prefix = text.match(/^[^\d]*/)[0] || '';
  var suffix = text.match(/[^\d]*$/)[0] || '';
  var hasComma = target >= 1000;

  function step(ts) {
    if (!startTime) startTime = ts;
    var progress = Math.min((ts - startTime) / duration, 1);
    var eased = 1 - Math.pow(1 - progress, 3);
    var current = Math.floor(eased * target);
    el.textContent = prefix + (hasComma ? current.toLocaleString() : current) + suffix;
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function initCounters() {
  animateCounter(document.getElementById('m-scans'), 47, 1200);
  var rateEl = document.querySelector('.metric:nth-child(2) .metric-value');
  if (rateEl) { rateEl.textContent = '0%'; animateCounter(rateEl, 94, 1500); setTimeout(function(){ rateEl.textContent = '94%'; }, 1600); }
}

// ══ TOAST SYSTEM ═════════════════════════════════════════════════
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

// ══ RENDER FEED ═════════════════════════════════════════════════
var feedFilter = '';

function renderFeed() {
  var el = document.getElementById('feed-list');
  if (!el) return;
  var filtered = feedData;
  if (feedFilter) {
    var q = feedFilter.toLowerCase();
    filtered = feedData.filter(function(f) {
      return f.name.toLowerCase().includes(q) || f.site.toLowerCase().includes(q) || f.action.toLowerCase().includes(q) || f.status.toLowerCase().includes(q);
    });
  }
  el.innerHTML = filtered.slice(0, 12).map(function(f, i) {
    var dotCls = f.status === 'hardened' ? 'fd-green' : f.status === 'flagged' ? 'fd-amber' : 'fd-red';
    var badgeCls = f.status === 'hardened' ? 'b-green' : f.status === 'flagged' ? 'b-amber' : 'b-red';
    var action = f.action.replace(/_/g, ' ');
    return '<div class="feed-item" style="animation-delay:' + (i * 0.05) + 's">'
      + '<div class="feed-dot ' + dotCls + '"></div>'
      + '<div style="flex:1;min-width:0;">'
        + '<div class="feed-name">' + f.name + ' <span style="color:var(--muted);font-weight:400;font-size:11px;">#' + f.board + '</span>'
          + ' <span class="badge ' + badgeCls + '">' + f.status + '</span>'
          + ' <span class="badge b-blue">' + action + '</span>'
        + '</div>'
        + '<div class="feed-meta">' + f.site + ' · GPS: 5.7456°N 0.3214°W · Δt 4s</div>'
        + '<div class="feed-factors">'
          + '<div class="ff" style="background:' + (f.status !== 'rejected' ? 'var(--green)' : 'var(--red)') + ';" title="QR"></div>'
          + '<div class="ff" style="background:' + (f.status === 'hardened' ? 'var(--green)' : f.status === 'flagged' ? 'var(--amber)' : 'var(--red)') + ';" title="GPS"></div>'
          + '<div class="ff" style="background:var(--green);" title="Time"></div>'
        + '</div>'
      + '</div>'
      + '<div class="feed-time">' + f.time + '</div>'
    + '</div>';
  }).join('');
}

// ══ RENDER LEADERBOARD ══════════════════════════════════════════
function renderLeaderboard() {
  var el = document.getElementById('lb-list');
  if (!el) return;
  var medals = ['#f4c430', '#c0c0c0', '#cd7f32'];
  el.innerHTML = lbData.map(function(p) {
    var mc = medals[p.rank - 1] || 'var(--muted)';
    var textC = p.rank <= 3 ? '#111' : 'var(--muted)';
    return '<div class="lb-row">'
      + '<div class="lb-rank" style="background:' + mc + ';color:' + textC + '">' + p.rank + '</div>'
      + '<div class="lb-name">'
        + '<div class="n">' + p.name + '</div>'
        + '<div class="s">' + p.site + '</div>'
        + '<div class="lb-bar-track"><div class="lb-bar-fill" style="width:' + p.pct + '%"></div></div>'
      + '</div>'
      + '<div style="text-align:right;">'
        + '<div class="lb-pts">' + p.pts + '</div>'
        + '<div style="font-size:10px;color:var(--muted);">pts</div>'
      + '</div>'
    + '</div>';
  }).join('');
}

// ══ RENDER NUTRITION TABLE ═══════════════════════════════════════
function renderNutrition() {
  var tbody = document.getElementById('nutrition-body');
  if (!tbody) return;
  tbody.innerHTML = nutritionRows.map(function(r) {
    var sc = r.score >= 80 ? 'var(--green)' : r.score >= 70 ? 'var(--blue)' : 'var(--amber)';
    return '<tr>'
      + '<td style="color:var(--muted)">' + r.date + '</td>'
      + '<td style="font-weight:500">' + r.name + '</td>'
      + '<td>' + r.site + '</td>'
      + '<td>' + r.meal + '</td>'
      + '<td>' + r.protein + '</td>'
      + '<td>' + r.kcal + '</td>'
      + '<td style="color:' + sc + ';font-weight:700">' + r.score + '</td>'
      + '<td><span class="badge ' + (r.verified ? 'b-green' : 'b-amber') + '">' + (r.verified ? 'Verified' : 'Pending') + '</span></td>'
    + '</tr>';
  }).join('');
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

  if (!bundleChart && document.getElementById('bundleChart')) {
    bundleChart = new Chart(document.getElementById('bundleChart'), {
      type: 'line',
      data: {
        labels: weeks,
        datasets: [{
          label: 'Bundles saved', data: [14, 19, 21, 27, 26, 30, 35],
          borderColor: '#f4a134', backgroundColor: 'rgba(244,161,52,0.1)',
          borderWidth: 2, pointRadius: 4, pointBackgroundColor: '#f4a134', fill: true, tension: .35,
        }]
      },
      options: { ...chartDefaults, scales: { x: { grid: gridOpts(), ticks: tickOpts() }, y: { grid: gridOpts(), ticks: tickOpts() } } },
    });
  }

  if (!nutritionChart && document.getElementById('nutritionChart')) {
    nutritionChart = new Chart(document.getElementById('nutritionChart'), {
      type: 'line',
      data: {
        labels: weeks,
        datasets: [
          { label: 'Nutrition score', data: [62, 65, 70, 71, 74, 76, 78], borderColor: '#4d9fff', backgroundColor: 'rgba(77,159,255,0.1)', borderWidth: 2, pointRadius: 4, pointBackgroundColor: '#4d9fff', fill: true, tension: .35 },
          { label: 'Target (80)', data: [80, 80, 80, 80, 80, 80, 80], borderColor: '#9d7dff', borderWidth: 1.5, borderDash: [4, 4], pointRadius: 0, fill: false },
        ]
      },
      options: { ...chartDefaults, scales: { x: { grid: gridOpts(), ticks: tickOpts() }, y: { grid: gridOpts(), ticks: tickOpts(), min: 40, max: 100 } } },
    });
  }

  // Doughnut — scan status breakdown
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

  // Radar — site comparison
  if (!radarChart && document.getElementById('radarChart')) {
    radarChart = new Chart(document.getElementById('radarChart'), {
      type: 'radar',
      data: {
        labels: ['CO₂ Saved', 'Scans', 'Nutrition', 'Participation', 'Consistency'],
        datasets: [
          { label: 'Farm A', data: [90, 85, 82, 95, 88], borderColor: 'rgba(16,217,126,0.8)', backgroundColor: 'rgba(16,217,126,0.1)', borderWidth: 2, pointRadius: 3 },
          { label: 'Farm B', data: [75, 70, 74, 80, 72], borderColor: 'rgba(77,159,255,0.8)', backgroundColor: 'rgba(77,159,255,0.1)', borderWidth: 2, pointRadius: 3 },
          { label: 'Co-op W', data: [60, 55, 73, 65, 58], borderColor: 'rgba(244,161,52,0.8)', backgroundColor: 'rgba(244,161,52,0.1)', borderWidth: 2, pointRadius: 3 },
        ]
      },
      options: {
        ...chartDefaults,
        scales: {
          r: {
            grid: { color: 'rgba(255,255,255,0.06)' },
            angleLines: { color: 'rgba(255,255,255,0.06)' },
            ticks: { display: false },
            pointLabels: { color: '#8b8fa8', font: { size: 10, family: 'Inter' } },
            min: 0, max: 100,
          }
        }
      },
    });
  }
}

// ══ SPARKLINES ═══════════════════════════════════════════════════
function drawSparkline(canvasId, data, color) {
  var canvas = document.getElementById(canvasId);
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  var w = canvas.width = canvas.offsetWidth * 2;
  var h = canvas.height = canvas.offsetHeight * 2;
  ctx.scale(2, 2);
  var dw = canvas.offsetWidth;
  var dh = canvas.offsetHeight;

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

  // Fill
  ctx.lineTo((data.length - 1) * step, dh);
  ctx.lineTo(0, dh);
  ctx.closePath();
  var grad = ctx.createLinearGradient(0, 0, 0, dh);
  grad.addColorStop(0, color.replace(')', ',0.15)').replace('rgb', 'rgba'));
  grad.addColorStop(1, 'transparent');
  ctx.fillStyle = grad;
  ctx.fill();
}

function initSparklines() {
  setTimeout(function() {
    drawSparkline('spark-scans', [28, 32, 35, 40, 38, 44, 47], '#10d97e');
    drawSparkline('spark-rate', [88, 90, 91, 93, 92, 95, 94], '#4d9fff');
    drawSparkline('spark-co2', [1800, 2010, 2200, 2420, 2580, 2700, 2841], '#f4a134');
    drawSparkline('spark-pay', [620, 740, 850, 980, 1050, 1140, 1240], '#9d7dff');
  }, 600);
}

// ══ VERIFIER ════════════════════════════════════════════════════
function updateVerifier() {
  var gpsFail = document.getElementById('gps-fail-cb').checked;
  var vf2 = document.getElementById('vf2');
  var vf2val = document.getElementById('vf2-val');
  var verdict = document.getElementById('verdict');
  if (gpsFail) {
    vf2.className = 'factor-row fail';
    vf2val.style.color = 'var(--red)';
    vf2val.textContent = '✗ 4,823 m — outside 200 m fence';
    verdict.className = 'verdict fail';
    verdict.innerHTML = '<div style="font-size:12px;font-weight:700;color:var(--amber);">FLAGGED — Payout blocked</div><div style="font-size:10px;color:var(--muted);margin-top:3px;">GPS outside geofence · flagged for Queen Mother review</div>';
  } else {
    vf2.className = 'factor-row ok';
    vf2val.style.color = 'var(--green)';
    vf2val.textContent = '✓ 84 m from centroid';
    verdict.className = 'verdict ok';
    verdict.innerHTML = '<div style="font-size:12px;font-weight:700;color:var(--green);">HARDENED — Payout queued</div><div style="font-size:10px;color:var(--muted);margin-top:3px;">scan_id: scn_8af4b · GHS 0.25 → MTN ****7731</div>';
  }
}

function runVerifier() {
  var btn = document.querySelector('.run-btn');
  btn.textContent = 'Verifying…';
  btn.disabled = true;
  setTimeout(function() {
    updateVerifier();
    btn.textContent = 'Run verification →';
    btn.disabled = false;
    showToast('Verification complete');
  }, 900);
}

// ══ CSV EXPORT ═══════════════════════════════════════════════════
function exportCsv() {
  var headers = ['date', 'participant', 'site', 'meal', 'protein_g', 'kcal', 'nutrition_score', 'researcher_verified'];
  var rows = nutritionRows.map(function(r) {
    return [r.date, r.name, r.site, '"' + r.meal + '"', r.protein, r.kcal, r.score, r.verified].join(',');
  });
  var csv = [headers.join(',')].concat(rows).join('\n');
  var blob = new Blob([csv], { type: 'text/csv' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'carbon_clarity_nutrition.csv';
  a.click();
  URL.revokeObjectURL(a.href);
  showToast('CSV exported successfully');
}

// ══ TABS ═════════════════════════════════════════════════════════
var panels = ['feed', 'analytics', 'leaderboard', 'provost'];
function setTab(id, el) {
  panels.forEach(function(p) {
    var panel = document.getElementById('panel-' + p);
    if (panel) panel.style.display = p === id ? '' : 'none';
  });
  document.querySelectorAll('.tab').forEach(function(t) { t.classList.remove('active'); });
  el.classList.add('active');
  if (id === 'analytics' || id === 'provost') setTimeout(initCharts, 80);
}

// ══ THEME ════════════════════════════════════════════════════════
function toggleTheme() {
  document.body.classList.toggle('light');
  var isLight = document.body.classList.contains('light');
  localStorage.setItem('dv-theme', isLight ? 'light' : 'dark');
  showToast(isLight ? 'Light mode enabled' : 'Dark mode enabled');
}

function loadTheme() {
  var saved = localStorage.getItem('dv-theme');
  if (saved === 'light') document.body.classList.add('light');
}

// ══ AUTH WALL — blocks all content until login ═══════════════════
function showAuth() {
  var m = document.getElementById('auth-modal');
  if (m) m.classList.add('active');
}
function hideAuth() {
  var m = document.getElementById('auth-modal');
  if (m) m.classList.remove('active');
}
function toggleAuthMode() {
  var title = document.getElementById('auth-title');
  var btn = document.getElementById('auth-submit');
  var toggle = document.getElementById('auth-toggle-text');
  if (title.textContent === 'Sign In') {
    title.textContent = 'Create Account';
    btn.textContent = 'Sign Up';
    toggle.innerHTML = 'Already have an account? <a onclick="toggleAuthMode()">Sign in</a>';
  } else {
    title.textContent = 'Sign In';
    btn.textContent = 'Sign In';
    toggle.innerHTML = 'Need an account? <a onclick="toggleAuthMode()">Sign up</a>';
  }
}

async function handleAuth() {
  var email = document.getElementById('auth-email').value;
  var pass = document.getElementById('auth-pass').value;
  if (!email || !pass) return showToast('Please fill all fields', 'warning');

  if (supabase) {
    var isSignUp = document.getElementById('auth-title').textContent === 'Create Account';
    try {
      var result;
      if (isSignUp) {
        result = await supabase.auth.signUp({ email: email, password: pass });
      } else {
        result = await supabase.auth.signInWithPassword({ email: email, password: pass });
      }
      if (result.error) throw result.error;
      currentUser = result.data.user;
      hideAuth();
      onLoginSuccess();
    } catch (e) {
      showToast(e.message || 'Auth error', 'warning');
    }
  } else {
    // Demo mode — still requires login
    currentUser = { email: email, id: 'demo_' + Date.now() };
    localStorage.setItem('dv-user', JSON.stringify(currentUser));
    hideAuth();
    onLoginSuccess();
  }
}

function onLoginSuccess() {
  // Check if admin
  userRole = ADMIN_EMAILS.includes((currentUser.email || '').toLowerCase()) ? 'admin' : 'user';
  updateAuthUI();
  unlockDashboard();
  showToast('Welcome, ' + (currentUser.email || 'User').split('@')[0] + '!' + (userRole === 'admin' ? ' (Admin)' : ''));
}

function unlockDashboard() {
  // Show the main content
  document.getElementById('app-content').style.display = '';
  // Show/hide admin elements
  var adminEls = document.querySelectorAll('.admin-only');
  adminEls.forEach(function(el) {
    el.style.display = userRole === 'admin' ? '' : 'none';
  });
  // Hide provost tab for non-admins
  var provostTab = document.querySelector('[data-tab="provost"]');
  if (provostTab) provostTab.style.display = userRole === 'admin' ? '' : 'none';
  // Render everything
  renderFeed();
  renderLeaderboard();
  renderNutrition();
  initCounters();
  initSparklines();
}

function lockDashboard() {
  document.getElementById('app-content').style.display = 'none';
  showAuth();
}

function updateAuthUI() {
  var avatar = document.getElementById('user-avatar');
  var authBtn = document.getElementById('auth-btn');
  var roleLabel = document.getElementById('role-label');
  if (currentUser) {
    var initial = (currentUser.email || 'U')[0].toUpperCase();
    if (avatar) { avatar.textContent = initial; avatar.style.display = 'flex'; }
    if (authBtn) authBtn.style.display = 'none';
    if (roleLabel) {
      roleLabel.textContent = userRole === 'admin' ? 'Admin' : 'User';
      roleLabel.style.display = '';
      roleLabel.style.color = userRole === 'admin' ? 'var(--amber)' : 'var(--green)';
    }
  } else {
    if (avatar) avatar.style.display = 'none';
    if (authBtn) authBtn.style.display = '';
    if (roleLabel) roleLabel.style.display = 'none';
  }
}

async function handleLogout() {
  if (supabase) await supabase.auth.signOut();
  currentUser = null;
  userRole = 'user';
  localStorage.removeItem('dv-user');
  updateAuthUI();
  lockDashboard();
  showToast('Signed out');
}

// ══ FEED SEARCH ═════════════════════════════════════════════════
function onFeedSearch(e) {
  feedFilter = e.target.value;
  renderFeed();
}

// ══ LIVE FEED SIMULATION ════════════════════════════════════════
var extraNames = ['Efua Darko', 'Serwa Adjei', 'Araba Quaye', 'Adwoa Mensah', 'Aba Koomson'];
var extraActions = ['firewood_avoidance', 'nutrition_meal', 'solar_drying'];
var scanCount = 47;

function addNewScan() {
  var now = new Date();
  var hh = String(now.getHours()).padStart(2, '0');
  var mm = String(now.getMinutes()).padStart(2, '0');
  var newScan = {
    name: extraNames[Math.floor(Math.random() * extraNames.length)],
    board: String(Math.floor(Math.random() * 30) + 1).padStart(3, '0'),
    site: ['Farm A', 'Farm B', 'Co-op W'][Math.floor(Math.random() * 3)],
    action: extraActions[Math.floor(Math.random() * extraActions.length)],
    status: Math.random() > 0.12 ? 'hardened' : 'flagged',
    time: hh + ':' + mm,
  };
  feedData.unshift(newScan);
  scanCount++;
  var scansEl = document.getElementById('m-scans');
  if (scansEl) scansEl.textContent = scanCount;
  if (document.getElementById('panel-feed').style.display !== 'none') renderFeed();
  showToast(newScan.name + ' — ' + newScan.action.replace(/_/g, ' '));
}

// ══ INIT — Auth wall on startup ══════════════════════════════════
loadTheme();

// Check for existing session
(async function initApp() {
  var restored = false;

  // Try Supabase session first
  if (supabase) {
    try {
      var session = await supabase.auth.getSession();
      if (session.data.session) {
        currentUser = session.data.session.user;
        restored = true;
      }
    } catch(e) {}
  }

  // Try demo session from localStorage
  if (!restored) {
    var saved = localStorage.getItem('dv-user');
    if (saved) {
      try {
        currentUser = JSON.parse(saved);
        restored = true;
      } catch(e) {}
    }
  }

  if (restored && currentUser) {
    onLoginSuccess();
  } else {
    lockDashboard();
  }

  setInterval(addNewScan, 8000);
})();
