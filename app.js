// ══ SUPABASE CONFIG ═══════════════════════════════════════════════
const SUPABASE_URL = 'https://hbvrfuypyzkvpuobjynw.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhidnJmdXlweXprdnB1b2JqeW53Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcxNTM1NzYsImV4cCI6MjA5MjcyOTU3Nn0.UR_mcEFMc31YP443zeCfCOVYjV6groSoofDbZbco7fw';
let supabase = null;
let currentUser = null;
let userRole = 'user'; // 'admin' or 'user'

// Admin emails — add your email here to get admin access
const ADMIN_EMAILS = ['admin@carbonclarify.com', 'poutchop@gmail.com'];

if (SUPABASE_URL && SUPABASE_KEY && window.supabase) {
  supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
}

// ══ FALLBACK DATA (used when Supabase is unreachable) ═══════════
var feedData = [];
var lbData = [];
var nutritionRows = [];
var scanCount = 0;
var dataLoaded = false;

var FALLBACK_FEED = [
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

var FALLBACK_LB = [
  {name:'Akosua Mensah', site:'Farm A', pts:142, pct:100, pay:'11.83', rank:1},
  {name:'Ama Asante',    site:'Farm A', pts:138, pct:97,  pay:'11.50', rank:2},
  {name:'Abena Owusu',   site:'Farm B', pts:131, pct:92,  pay:'10.92', rank:3},
  {name:'Adwoa Boateng', site:'Farm B', pts:119, pct:84,  pay:'9.92',  rank:4},
  {name:'Akua Nkrumah',  site:'Farm A', pts:107, pct:75,  pay:'8.92',  rank:5},
  {name:'Yaa Frimpong',  site:'Co-op W',pts:98,  pct:69,  pay:'8.17',  rank:6},
];

var FALLBACK_NUTRITION = [
  {date:'2026-04-15',name:'Akosua Mensah',site:'Farm A',meal:'Bean stew with greens',protein:28,kcal:480,score:82,verified:true},
  {date:'2026-04-15',name:'Abena Owusu',  site:'Farm B',meal:'Kontomire with yam',   protein:22,kcal:410,score:74,verified:true},
  {date:'2026-04-14',name:'Akosua Mensah',site:'Farm A',meal:'Groundnut soup + rice', protein:31,kcal:520,score:86,verified:true},
  {date:'2026-04-14',name:'Ama Asante',   site:'Farm A',meal:'Egg with tomato sauce', protein:18,kcal:360,score:68,verified:false},
  {date:'2026-04-13',name:'Abena Owusu',  site:'Farm B',meal:'Bean stew',             protein:25,kcal:440,score:78,verified:true},
];

function demoScan() {
  var btn = document.getElementById('scanner-start-btn');
  if (btn) btn.disabled = true;
  document.getElementById('scanner-result').innerHTML = '<div style="text-align:center;padding:30px 0;"><div class="spinner"></div><div style="font-size:11px;color:var(--muted);margin-top:10px;">Simulating scan...</div></div>';
  setTimeout(function() {
    addNewScan();
    if (btn) btn.disabled = false;
  }, 1200);
}

// ══ PARTICIPANT STORY ═══════════════════════════════════════════
async function loadParticipantStory() {
  var body = document.getElementById('participant-story-body');
  if (!body) return;

  if (!supabase) {
    body.innerHTML = '<div style="font-size:12px;color:var(--muted);">Supabase not connected. Offline mode.</div>';
    return;
  }

  try {
    // Fetch the top participant
    var res = await supabase.from('participants').select('*').order('total_points', { ascending: false }).limit(1);
    if (!res.data || res.data.length === 0) throw new Error('No participant data');
    var p = res.data[0];

    // Fetch total CO2 for this participant
    var co2Res = await supabase.from('scans').select('co2_avoided_kg').eq('participant_id', p.id).eq('status', 'hardened');
    var totalCO2 = 0;
    if (co2Res.data) {
      totalCO2 = co2Res.data.reduce(function(sum, row) { return sum + (parseFloat(row.co2_avoided_kg) || 0); }, 0);
    }

    body.innerHTML = `
      <div style="width:64px;height:64px;border-radius:50%;background:var(--gdim);border:2px solid var(--green);margin:0 auto 16px;display:flex;align-items:center;justify-content:center;font-size:24px;color:var(--green);font-weight:800;">
        ${(p.name || 'U').charAt(0)}
      </div>
      <div style="font-size:18px;font-weight:800;margin-bottom:4px;">${p.name}</div>
      <div style="font-size:12px;color:var(--muted);margin-bottom:20px;">${p.site} · Board #${p.board}</div>
      
      <div style="display:flex;justify-content:center;gap:12px;margin-bottom:24px;">
        <div style="background:var(--surf2);padding:10px 16px;border-radius:10px;text-align:center;">
          <div style="font-size:10px;color:var(--muted);text-transform:uppercase;">Total Points</div>
          <div style="font-size:18px;font-weight:800;color:var(--gold);">${p.total_points}</div>
        </div>
        <div style="background:var(--surf2);padding:10px 16px;border-radius:10px;text-align:center;">
          <div style="font-size:10px;color:var(--muted);text-transform:uppercase;">CO₂ Avoided</div>
          <div style="font-size:18px;font-weight:800;color:var(--green);">${totalCO2.toFixed(1)} kg</div>
        </div>
      </div>
      
      <p style="font-size:13px;line-height:1.6;color:var(--text);background:rgba(255,255,255,0.03);padding:16px;border-radius:12px;border:1px solid var(--border);">
        By consistently avoiding firewood and utilizing solar drying techniques, <b>${p.name}</b> has emerged as a climate champion in the ${p.site} community. Her verified actions have directly contributed to cleaner air and local reforestation efforts, earning her automated MoMo payouts.
      </p>
    `;

  } catch (e) {
    console.error('Participant story error:', e);
    body.innerHTML = '<div style="font-size:12px;color:var(--muted);">Failed to load participant story.</div>';
  }
}

// ══ INIT ════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', function() {
  loadTheme();
  initSparklines();
  // We don't call updateAuthUI or showAuth immediately here,
  // we let the user explore the Impact Wall.
  var savedUser = localStorage.getItem('dv-user');
  if (savedUser) {
    try {
      currentUser = JSON.parse(savedUser);
      onLoginSuccess();
    } catch(e) {
      lockDashboard();
    }
  } else {
    lockDashboard();
  }
});

// ══ LOADING / ERROR HELPERS ══════════════════════════════════════
function showLoading(elId) {
  var el = document.getElementById(elId);
  if (el) el.innerHTML = '<div style="text-align:center;padding:30px;"><div class="spinner"></div><div style="font-size:11px;color:var(--muted);margin-top:8px;">Loading…</div></div>';
}
function showError(elId, msg) {
  var el = document.getElementById(elId);
  if (el) el.innerHTML = '<div style="text-align:center;padding:30px;"><div style="font-size:24px;margin-bottom:6px;">⚠️</div><div style="font-size:12px;color:var(--amber);">' + msg + '</div><button class="run-btn" style="margin-top:10px;" onclick="loadAllData()">↻ Retry</button></div>';
}

// ══ LIVE DATA LOADING FROM SUPABASE ══════════════════════════════
async function loadAllData() {
  if (!supabase) {
    feedData = FALLBACK_FEED.slice();
    lbData = FALLBACK_LB.slice();
    nutritionRows = FALLBACK_NUTRITION.slice();
    scanCount = feedData.length;
    renderAll();
    return;
  }

  // Show spinners
  showLoading('feed-list');
  showLoading('lb-list');
  showLoading('nutrition-body');

  var attempts = 0;
  var maxAttempts = 3;
  while (attempts < maxAttempts) {
    try {
      attempts++;
      // #2 — Live metric cards from Supabase
      var [scansRes, participantsRes, nutritionRes] = await Promise.all([
        supabase.from('scans').select('*').order('created_at', { ascending: false }).limit(100),
        supabase.from('participants').select('*').order('total_points', { ascending: false }),
        supabase.from('nutrition_logs').select('*').order('created_at', { ascending: false }).limit(50)
      ]);

    // Process scans
    if (scansRes.data && scansRes.data.length > 0) {
      feedData = scansRes.data.map(function(s) {
        var dt = new Date(s.created_at);
        return {
          name: s.participant_name, board: s.board, site: s.site,
          action: s.action, status: s.status,
          time: String(dt.getHours()).padStart(2,'0') + ':' + String(dt.getMinutes()).padStart(2,'0'),
          gps_lat: s.gps_lat, gps_lng: s.gps_lng, co2_avoided_kg: s.co2_avoided_kg
        };
      });
    } else {
      feedData = FALLBACK_FEED.slice();
    }
    scanCount = feedData.length;

    // #6 — Live leaderboard from participants table
    if (participantsRes.data && participantsRes.data.length > 0) {
      var maxPts = participantsRes.data[0].total_points || 1;
      lbData = participantsRes.data.map(function(p, i) {
        return {
          name: p.name, site: p.site, board: p.board,
          pts: p.total_points, pct: Math.round((p.total_points / maxPts) * 100),
          pay: p.payout_balance ? parseFloat(p.payout_balance).toFixed(2) : '0.00',
          rank: i + 1
        };
      });
    } else {
      lbData = FALLBACK_LB.slice();
    }

    // #4 — Live nutrition from nutrition_logs table
    if (nutritionRes.data && nutritionRes.data.length > 0) {
      nutritionRows = nutritionRes.data.map(function(n) {
        return {
          date: n.log_date || n.created_at.split('T')[0],
          name: n.participant_name, site: n.site, meal: n.meal,
          protein: n.protein_g, kcal: n.kcal, score: n.score, verified: n.verified
        };
      });
    } else {
      nutritionRows = FALLBACK_NUTRITION.slice();
    }

    dataLoaded = true;
    updateMetricCards();
    loadParticipantStory();
    renderAll();

    // #3 — Subscribe to Supabase Realtime
    subscribeRealtime();

      break; // Successfully loaded
    } catch(e) {
      if (attempts < maxAttempts) {
        console.warn('Network timeout, retrying data load... (' + attempts + '/' + maxAttempts + ')');
        await new Promise(function(resolve) { setTimeout(resolve, 1500); });
      } else {
        console.error('Data load error after retries:', e);
        feedData = FALLBACK_FEED.slice();
        lbData = FALLBACK_LB.slice();
        nutritionRows = FALLBACK_NUTRITION.slice();
        scanCount = feedData.length;
        renderAll();
        showToast('Using offline data — Supabase unreachable', 'warning');
      }
    }
  }
}

function renderAll() {
  renderFeed();
  renderLeaderboard();
  renderNutrition();
  initCounters();
  initSparklines();
}

// #2 — Update metric cards with live Supabase data
async function updateMetricCards() {
  if (!supabase) {
    // Fallback if no supabase
    var hardened = feedData.filter(function(s) { return s.status === 'hardened'; }).length;
    var total = feedData.length;
    var rate = total > 0 ? Math.round(hardened / total * 100) : 0;
    var co2 = feedData.reduce(function(sum, s) { return sum + (parseFloat(s.co2_avoided_kg) || 0); }, 0);
    var totalPayouts = lbData.reduce(function(sum, p) { return sum + (parseFloat(p.pay) || 0); }, 0);
    
    animateCounter(document.getElementById('m-scans'), total, 800);
    var rateEl = document.querySelector('.metric:nth-child(2) .metric-value');
    if (rateEl) { rateEl.textContent = rate + '%'; }
    var co2El = document.querySelector('.metric:nth-child(3) .metric-value');
    if (co2El) animateCounter(co2El, Math.round(co2) || 2841, 1000);
    var ptsEl = document.querySelector('.metric:nth-child(3) .metric-sub');
    if (ptsEl) ptsEl.textContent = lbData.length + ' active participants';
    var payEl = document.querySelector('.metric:nth-child(4) .metric-value');
    if (payEl) animateCounter(payEl, Math.round(totalPayouts) || 1240, 1000);
    return;
  }

  try {
    const [scansRes, hardenedRes, co2Res, payoutsRes] = await Promise.all([
      supabase.from('scans').select('*', { count: 'exact', head: true }),
      supabase.from('scans').select('*', { count: 'exact', head: true }).eq('status', 'hardened'),
      supabase.from('scans').select('co2_avoided_kg').eq('status', 'hardened'),
      supabase.from('participants').select('payout_balance')
    ]);

    const totalScans = scansRes.count || 0;
    const hardenedScans = hardenedRes.count || 0;
    const verificationRate = totalScans > 0 ? Math.round((hardenedScans / totalScans) * 100) : 0;
    
    const totalCO2 = co2Res.data ? co2Res.data.reduce((sum, row) => sum + (parseFloat(row.co2_avoided_kg) || 0), 0) : 0;
    const totalPayouts = payoutsRes.data ? payoutsRes.data.reduce((sum, row) => sum + (parseFloat(row.payout_balance) || 0), 0) : 0;

    animateCounter(document.getElementById('m-scans'), totalScans, 800);
    var rateEl = document.querySelector('.metric:nth-child(2) .metric-value');
    if (rateEl) { rateEl.textContent = verificationRate + '%'; }
    var co2El = document.querySelector('.metric:nth-child(3) .metric-value');
    if (co2El) animateCounter(co2El, Math.round(totalCO2), 1000);
    var ptsEl = document.querySelector('.metric:nth-child(3) .metric-sub');
    if (ptsEl) ptsEl.textContent = (payoutsRes.data ? payoutsRes.data.length : 0) + ' active participants';
    var payEl = document.querySelector('.metric:nth-child(4) .metric-value');
    if (payEl) animateCounter(payEl, Math.round(totalPayouts), 1000);

  } catch(e) {
    console.error('Error fetching live metrics', e);
  }
}

// #3 — Supabase Realtime subscription
function subscribeRealtime() {
  if (!supabase) return;
  supabase.channel('scans-realtime')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'scans' }, function(payload) {
      var s = payload.new;
      var dt = new Date(s.created_at);
      var newScan = {
        name: s.participant_name, board: s.board, site: s.site,
        action: s.action, status: s.status,
        time: String(dt.getHours()).padStart(2,'0') + ':' + String(dt.getMinutes()).padStart(2,'0'),
        gps_lat: s.gps_lat, gps_lng: s.gps_lng, co2_avoided_kg: s.co2_avoided_kg
      };
      feedData.unshift(newScan);
      scanCount++;
      renderFeed();
      updateMetricCards();
      showToast(s.participant_name + ' — ' + (s.action || '').replace(/_/g, ' '));
    })
    .subscribe();
}

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
  if (dataLoaded) {
    updateMetricCards();
  } else {
    animateCounter(document.getElementById('m-scans'), scanCount || 47, 1200);
    var rateEl = document.querySelector('.metric:nth-child(2) .metric-value');
    if (rateEl) { rateEl.textContent = '0%'; animateCounter(rateEl, 94, 1500); setTimeout(function(){ rateEl.textContent = '94%'; }, 1600); }
  }
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

  // Calculate daily nutrition averages from real data
  var dates = {};
  nutritionRows.forEach(function(r) {
    if (!dates[r.date]) dates[r.date] = { sum: 0, count: 0 };
    dates[r.date].sum += r.score;
    dates[r.date].count++;
  });
  var sortedDates = Object.keys(dates).sort().slice(-7);
  var chartLabels = sortedDates.length > 0 ? sortedDates : weeks;
  var chartData = sortedDates.length > 0 ? sortedDates.map(function(d) { return Math.round(dates[d].sum / dates[d].count); }) : [62, 65, 70, 71, 74, 76, 78];

  if (!nutritionChart && document.getElementById('nutritionChart')) {
    nutritionChart = new Chart(document.getElementById('nutritionChart'), {
      type: 'line',
      data: {
        labels: chartLabels,
        datasets: [
          { label: 'Nutrition avg score', data: chartData, borderColor: '#4d9fff', backgroundColor: 'rgba(77,159,255,0.1)', borderWidth: 2, pointRadius: 4, pointBackgroundColor: '#4d9fff', fill: true, tension: .35 },
          { label: 'Target (80)', data: chartLabels.map(function(){ return 80; }), borderColor: '#9d7dff', borderWidth: 1.5, borderDash: [4, 4], pointRadius: 0, fill: false },
        ]
      },
      options: { ...chartDefaults, scales: { x: { grid: gridOpts(), ticks: tickOpts() }, y: { grid: gridOpts(), ticks: tickOpts(), min: 40, max: 100 } } },
    });
  } else if (nutritionChart) {
    nutritionChart.data.labels = chartLabels;
    nutritionChart.data.datasets[0].data = chartData;
    nutritionChart.data.datasets[1].data = chartLabels.map(function(){ return 80; });
    nutritionChart.update();
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


// ══ EXCEL EXPORT — 4-sheet workbook for Provost/GAC ══════════════
async function exportExcel() {
  showToast('Generating Excel report…');

  // Fetch live data from Supabase if available
  var scansData = feedData;
  var participantsData = lbData;
  var nutritionData = nutritionRows;

  if (supabase) {
    try {
      var s = await supabase.from('scans').select('*').order('created_at', { ascending: false }).limit(500);
      if (s.data && s.data.length > 0) scansData = s.data;
      var p = await supabase.from('participants').select('*').order('total_points', { ascending: false });
      if (p.data && p.data.length > 0) participantsData = p.data;
      var n = await supabase.from('nutrition_logs').select('*').order('created_at', { ascending: false }).limit(200);
      if (n.data && n.data.length > 0) nutritionData = n.data;
    } catch(e) {}
  }

  // Sheet 1: Scans Audit Log
  var sheet1 = [['Date', 'Time', 'Participant', 'Board', 'Site', 'Action', 'Status', 'GPS Lat', 'GPS Lng', 'GPS Distance (m)', 'QR Valid', 'CO₂ Avoided (kg)', 'Points']];
  scansData.forEach(function(s) {
    var dt = s.created_at ? new Date(s.created_at) : new Date();
    sheet1.push([
      dt.toISOString().split('T')[0], s.time || dt.toTimeString().substring(0,5),
      s.participant_name || s.name || '', s.board || '', s.site || '',
      (s.action || '').replace(/_/g, ' '), s.status || '',
      s.gps_lat || '', s.gps_lng || '', s.gps_distance_m || '',
      s.qr_valid !== undefined ? (s.qr_valid ? 'Yes' : 'No') : '',
      s.co2_avoided_kg || '', s.points_awarded || s.pts || ''
    ]);
  });

  // Sheet 2: Participants
  var sheet2 = [['Name', 'Board', 'Site', 'Total Points', 'Payout Balance (GHS)', 'MoMo Number']];
  participantsData.forEach(function(p) {
    sheet2.push([p.name || '', p.board || '', p.site || '', p.total_points || p.pts || '', p.payout_balance || p.pay || '', p.momo_number || '']);
  });

  // Sheet 3: Nutrition Logs
  var sheet3 = [['Date', 'Participant', 'Site', 'Meal', 'Protein (g)', 'Kcal', 'Score', 'Verified']];
  nutritionData.forEach(function(n) {
    sheet3.push([n.log_date || n.date || '', n.participant_name || n.name || '', n.site || '', n.meal || '', n.protein_g || n.protein || '', n.kcal || '', n.score || '', n.verified ? 'Yes' : 'No']);
  });

  // Sheet 4: Weekly Summary
  var totalScans = scansData.length;
  var hardened = scansData.filter(function(s) { return s.status === 'hardened'; }).length;
  var flagged = scansData.filter(function(s) { return s.status === 'flagged'; }).length;
  var totalCO2 = scansData.reduce(function(sum, s) { return sum + (parseFloat(s.co2_avoided_kg) || 0); }, 0);
  var totalPoints = participantsData.reduce(function(sum, p) { return sum + (p.total_points || p.pts || 0); }, 0);

  var sheet4 = [
    ['Carbon Clarity Data Vault — Weekly Report'],
    ['Generated', new Date().toISOString()],
    ['Pilot', 'Berekuso · Ashesi University · Week 4'],
    [''],
    ['METRIC', 'VALUE'],
    ['Total Scans', totalScans],
    ['Hardened', hardened],
    ['Flagged', flagged],
    ['Verification Rate', totalScans > 0 ? Math.round(hardened / totalScans * 100) + '%' : 'N/A'],
    ['CO₂ Avoided (kg)', totalCO2.toFixed(1)],
    ['Active Participants', participantsData.length],
    ['Total Points Issued', totalPoints],
    [''],
    ['SITE BREAKDOWN', 'Participants', 'Scans'],
    ['Berekuso Farm A', participantsData.filter(function(p){return (p.site||'').includes('Farm A');}).length, scansData.filter(function(s){return (s.site||'').includes('Farm A');}).length],
    ['Berekuso Farm B', participantsData.filter(function(p){return (p.site||'').includes('Farm B');}).length, scansData.filter(function(s){return (s.site||'').includes('Farm B');}).length],
    ['Taanso Co-op W', participantsData.filter(function(p){return (p.site||'').includes('Co-op');}).length, scansData.filter(function(s){return (s.site||'').includes('Co-op');}).length],
  ];

  // Build Excel XML (works without SheetJS library)
  var xml = '<?xml version="1.0"?>\n<?mso-application progid="Excel.Sheet"?>\n';
  xml += '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">\n';

  function addSheet(name, data) {
    xml += '<Worksheet ss:Name="' + name + '"><Table>\n';
    data.forEach(function(row, ri) {
      xml += '<Row>';
      row.forEach(function(cell) {
        var type = typeof cell === 'number' ? 'Number' : 'String';
        xml += '<Cell><Data ss:Type="' + type + '">' + (cell !== null && cell !== undefined ? String(cell).replace(/&/g,'&amp;').replace(/</g,'&lt;') : '') + '</Data></Cell>';
      });
      xml += '</Row>\n';
    });
    xml += '</Table></Worksheet>\n';
  }

  addSheet('Scans Audit Log', sheet1);
  addSheet('Participants', sheet2);
  addSheet('Nutrition Logs', sheet3);
  addSheet('Weekly Summary', sheet4);
  xml += '</Workbook>';

  var blob = new Blob([xml], { type: 'application/vnd.ms-excel' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  var today = new Date().toISOString().split('T')[0];
  a.download = 'CarbonClarity_DataVault_' + today + '.xls';
  a.click();
  URL.revokeObjectURL(a.href);
  showToast('✅ Excel report downloaded — 4 sheets');
}

// ══ MAP VIEW — Leaflet with geofences ════════════════════════════
var scanMap = null;
var mapMarkers = [];

// Site locations (Berekuso area)
var SITES = {
  'Farm A': { lat: 5.7456, lng: -0.3214, color: '#10d97e', label: 'Berekuso Farm A' },
  'Farm B': { lat: 5.7480, lng: -0.3180, color: '#4d9fff', label: 'Berekuso Farm B' },
  'Co-op W':{ lat: 5.7430, lng: -0.3250, color: '#f4a134', label: 'Taanso Co-op W' }
};
var GEOFENCE_RADIUS = 200; // meters

function initMap() {
  var mapEl = document.getElementById('scan-map');
  if (!mapEl) return;

  if (scanMap) {
    scanMap.invalidateSize();
    return;
  }

  scanMap = L.map('scan-map', {
    center: [5.7456, -0.3214],
    zoom: 15,
    zoomControl: true
  });

  // Dark tile layer
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '© OpenStreetMap © CARTO',
    maxZoom: 19
  }).addTo(scanMap);

  // Add geofence circles and site markers
  Object.keys(SITES).forEach(function(key) {
    var s = SITES[key];

    // 200m geofence circle
    L.circle([s.lat, s.lng], {
      radius: GEOFENCE_RADIUS,
      color: s.color,
      fillColor: s.color,
      fillOpacity: 0.08,
      weight: 1.5,
      dashArray: '6 4'
    }).addTo(scanMap);

    // Site center marker
    L.circleMarker([s.lat, s.lng], {
      radius: 8,
      color: s.color,
      fillColor: s.color,
      fillOpacity: 0.9,
      weight: 2
    }).bindPopup('<b>' + s.label + '</b><br>200m geofence').addTo(scanMap);
  });

  // Plot scan locations
  plotScans();
}

function plotScans() {
  if (!scanMap) return;

  // Clear old markers
  mapMarkers.forEach(function(m) { scanMap.removeLayer(m); });
  mapMarkers = [];

  // Count by site
  var counts = { 'Farm A': 0, 'Farm B': 0, 'Co-op W': 0 };

  feedData.forEach(function(scan, i) {
    var site = SITES[scan.site] || SITES['Farm A'];
    // Use real GPS coordinates if available, fallback to jitter around site
    var jitterLat = (Math.random() - 0.5) * 0.003;
    var jitterLng = (Math.random() - 0.5) * 0.003;
    var lat = scan.gps_lat ? parseFloat(scan.gps_lat) : (site.lat + jitterLat);
    var lng = scan.gps_lng ? parseFloat(scan.gps_lng) : (site.lng + jitterLng);

    var isHardened = scan.status === 'hardened';
    var markerColor = isHardened ? '#10d97e' : scan.status === 'flagged' ? '#f4a134' : '#ff5a5a';

    var marker = L.circleMarker([lat, lng], {
      radius: 5,
      color: markerColor,
      fillColor: markerColor,
      fillOpacity: 0.7,
      weight: 1
    }).bindPopup(
      '<b>' + scan.name + '</b> #' + scan.board + '<br>' +
      '<span style="color:' + markerColor + ';">' + scan.status + '</span> · ' +
      (scan.action || '').replace(/_/g, ' ') + '<br>' +
      scan.site + ' · ' + (scan.time || '')
    );
    marker.addTo(scanMap);
    mapMarkers.push(marker);

    if (counts[scan.site] !== undefined) counts[scan.site]++;
  });

  // Update counters
  var fa = document.getElementById('map-farm-a');
  var fb = document.getElementById('map-farm-b');
  var cw = document.getElementById('map-coop-w');
  if (fa) fa.textContent = counts['Farm A'];
  if (fb) fb.textContent = counts['Farm B'];
  if (cw) cw.textContent = counts['Co-op W'];
}

// ══ TABS ═════════════════════════════════════════════════════════
var panels = ['impact', 'feed', 'analytics', 'leaderboard', 'map', 'provost', 'scanner'];
function setTab(id, el) {
  function switchTab() {
    panels.forEach(function(p) {
      var panel = document.getElementById('panel-' + p);
      if (panel) panel.style.display = p === id ? '' : 'none';
    });
    document.querySelectorAll('.tab').forEach(function(t) { t.classList.remove('active'); });
    el.classList.add('active');
    if (id === 'analytics' || id === 'provost') setTimeout(initCharts, 80);
    if (id === 'map') setTimeout(initMap, 100);
  }

  if (document.startViewTransition) {
    document.startViewTransition(switchTab);
  } else {
    switchTab();
  }
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
  var secureTabs = document.querySelectorAll('.secure-tab');
  secureTabs.forEach(function(el) { el.style.display = ''; });

  var adminEls = document.querySelectorAll('.admin-only');
  adminEls.forEach(function(el) {
    el.style.display = userRole === 'admin' ? '' : 'none';
  });

  var adminTabs = document.querySelectorAll('[data-tab="provost"],[data-tab="scanner"]');
  adminTabs.forEach(function(el) {
    el.style.display = userRole === 'admin' ? '' : 'none';
  });

  loadAllData();
}

function lockDashboard() {
  var secureTabs = document.querySelectorAll('.secure-tab');
  secureTabs.forEach(function(el) { el.style.display = 'none'; });
  var impactTab = document.querySelector('.tab[onclick*="impact"]');
  if (impactTab) setTab('impact', impactTab);
  
  loadAllData(); // Load public data for Impact Wall
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
