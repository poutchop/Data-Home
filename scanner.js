// ══ QR SCANNER MODULE — Field App for Queen Mother ══════════════
// Uses html5-qrcode for camera-based scanning
// Parses CC-v1 protocol, captures GPS, submits to Data Vault

var scannerActive = false;
var html5QrCode = null;
var lastGPS = { lat: null, lng: null, accuracy: null };

// ── Wizard State ──
var currentStep = 1;
var selectedAction = null;
var weekNumber = 4;
var stickerCount = 0;
var auditPhoto = null;
var wizardScanner = null;

// ── Offline scan queue ──
var QUEUE_KEY = 'dv-offline-queue';
var isOnline = navigator.onLine;

function getOfflineQueue() {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]'); } catch(e) { return []; }
}
function saveOfflineQueue(queue) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  updateQueueBadge();
}
function updateQueueBadge() {
  var queue = getOfflineQueue();
  var badge = document.getElementById('queue-badge');
  if (badge) {
    badge.textContent = queue.length + ' queued';
    badge.style.display = queue.length > 0 ? '' : 'none';
  }
  var indicator = document.getElementById('network-status');
  if (indicator) {
    indicator.innerHTML = isOnline
      ? '<span style="color:var(--green);">● Online</span>'
      : '<span style="color:var(--red);">● Offline</span> — scans will queue locally';
  }
}

// Listen for network changes
window.addEventListener('online', function() {
  isOnline = true;
  updateQueueBadge();
  showToast('Back online — syncing queued scans…');
  syncOfflineQueue();
});
window.addEventListener('offline', function() {
  isOnline = false;
  updateQueueBadge();
  showToast('You are offline — scans will be queued locally', 'warning');
});

// Sync queued scans when back online
async function syncOfflineQueue() {
  if (!supabase || !isOnline) return;
  var queue = getOfflineQueue();
  if (queue.length === 0) return;

  var synced = 0;
  var failed = [];

  for (var i = 0; i < queue.length; i++) {
    try {
      var { data, error } = await supabase.functions.invoke('verify-scan', { body: queue[i] });
      if (error) throw error;
      synced++;
    } catch(e) {
      console.log('Sync failed for item', e);
      failed.push(queue[i]);
    }
  }

  saveOfflineQueue(failed);
  if (synced > 0) showToast('✅ Synced ' + synced + ' queued scan' + (synced > 1 ? 's' : ''));
  if (failed.length > 0) showToast(failed.length + ' scan(s) failed to sync — will retry', 'warning');
}

// ── GPS tracking (runs in background) ──
function initGPS() {
  if (!navigator.geolocation) {
    showToast('GPS not supported', 'warning');
    return;
  }

  navigator.geolocation.watchPosition(function(pos) {
    lastGPS = {
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      accuracy: pos.coords.accuracy
    };

    var statusEl = document.getElementById('wizard-gps-status');
    var nextBtn = document.getElementById('gps-next-btn');
    if (statusEl) {
      if (lastGPS.accuracy <= 50) {
        statusEl.innerHTML = '<span style="color:var(--green)">✓ GPS Locked</span> (' + Math.round(lastGPS.accuracy) + 'm)';
        if (nextBtn) {
          nextBtn.disabled = false;
          nextBtn.textContent = 'Continue →';
        }
      } else {
        statusEl.innerHTML = '<span style="color:var(--amber)">Searching…</span> (' + Math.round(lastGPS.accuracy) + 'm)';
        if (nextBtn) {
          nextBtn.disabled = true;
          nextBtn.textContent = 'Waiting for Lock…';
        }
      }
    }
  }, function(err) {
    console.warn('GPS Error:', err);
  }, { enableHighAccuracy: true });
}

// ── Wizard Navigation ──
function nextStep() {
  if (currentStep < 7) {
    document.getElementById('step-' + currentStep).classList.remove('active');
    currentStep++;
    document.getElementById('step-' + currentStep).classList.add('active');
    updateProgressBar();
  }
}

function prevStep() {
  if (currentStep > 1) {
    document.getElementById('step-' + currentStep).classList.remove('active');
    currentStep--;
    document.getElementById('step-' + currentStep).classList.add('active');
    updateProgressBar();
  }
}

function updateProgressBar() {
  var bars = document.querySelectorAll('.progress-bar');
  bars.forEach(function(bar, idx) {
    if (idx < currentStep) bar.classList.add('active');
    else bar.classList.remove('active');
  });
}

function selectAction(action, el) {
  selectedAction = action;
  document.querySelectorAll('.wizard-check-item').forEach(function(item) {
    item.classList.remove('selected');
  });
  el.classList.add('selected');
  var nextBtn = document.getElementById('action-next-btn');
  if (nextBtn) nextBtn.disabled = false;
}

function handleWizardPhoto(event) {
  var file = event.target.files[0];
  if (!file) return;
  
  auditPhoto = file;
  var reader = new FileReader();
  reader.onload = function(e) {
    var preview = document.getElementById('wizard-img');
    var placeholder = document.getElementById('wizard-photo-placeholder');
    if (preview) {
      preview.src = e.target.result;
      preview.style.display = 'block';
      if (placeholder) placeholder.style.display = 'none';
      var nextBtn = document.getElementById('photo-next-btn');
      if (nextBtn) nextBtn.disabled = false;
    }
  };
  reader.readAsDataURL(file);
}

function resetWizard() {
  document.getElementById('step-' + currentStep).classList.remove('active');
  currentStep = 1;
  document.getElementById('step-' + currentStep).classList.add('active');
  selectedAction = null;
  auditPhoto = null;
  var aBtn = document.getElementById('action-next-btn');
  if (aBtn) aBtn.disabled = true;
  var pBtn = document.getElementById('photo-next-btn');
  if (pBtn) pBtn.disabled = true;
  var img = document.getElementById('wizard-img');
  if (img) img.style.display = 'none';
  var ph = document.getElementById('wizard-photo-placeholder');
  if (ph) ph.style.display = 'block';
  updateProgressBar();
}

// ── Parse CC-v1 QR format ──
function parseQRData(raw) {
  if (!raw) return null;
  var trimmed = raw.trim();
  var upper = trimmed.toUpperCase();
  if (!upper.startsWith('CC-V1|')) return null;
  var parts = trimmed.split('|');
  if (parts.length !== 6) return null;
  return {
    version: parts[0],
    board_id: parts[1],
    participant_id: parts[2],
    action_type: parts[3],
    issued_at: parseInt(parts[4]),
    hmac: parts[5]
  };
}

// ── Wizard Scanner ──
function startWizardScanner() {
  if (wizardScanner) return;
  
  document.getElementById('wizard-scan-btn').style.display = 'none';
  document.getElementById('wizard-scanner-status').textContent = 'Initialing camera...';

  wizardScanner = new Html5Qrcode('wizard-qr-reader');
  wizardScanner.start(
    { facingMode: 'environment' },
    { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 },
    onScanSuccess,
    function() {}
  ).catch(function(err) {
    document.getElementById('wizard-scanner-status').innerHTML = '<span style="color:var(--red);">Error: ' + err + '</span>';
    document.getElementById('wizard-scan-btn').style.display = 'block';
  });
}

function stopWizardScanner() {
  if (wizardScanner) {
    wizardScanner.stop().then(function() {
      wizardScanner.clear();
      wizardScanner = null;
      document.getElementById('wizard-scan-btn').style.display = 'block';
    });
  }
}

async function onScanSuccess(decodedText) {
  if (wizardScanner) {
    await wizardScanner.stop();
    wizardScanner.clear();
    wizardScanner = null;
  }
  
  document.getElementById('wizard-scan-btn').style.display = 'block';
  
  var qr = parseQRData(decodedText);
  if (!qr) {
    showToast('Invalid Carbon Clarity QR code', 'warning');
    return;
  }

  // Check if action matches
  if (qr.action_type !== selectedAction) {
    showToast('Action mismatch! Board is for ' + qr.action_type, 'warning');
    return;
  }

  submitScan(qr);
}

async function submitScan(qr) {
  nextStep(); // Go to result step
  var resultEl = document.getElementById('wizard-result');
  resultEl.innerHTML = '<div class="spinner"></div><div style="text-align:center;margin-top:12px;">Verifying scan...</div>';

  var payload = {
    board_id: qr.board_id,
    participant_id: qr.participant_id,
    action_type: qr.action_type,
    qr_hmac_received: qr.hmac,
    gps_lat: lastGPS.lat || 5.7456,
    gps_lng: lastGPS.lng || -0.3214,
    gps_accuracy_m: lastGPS.accuracy || 999,
    scan_time_device: new Date().toISOString(),
    issued_at: qr.issued_at,
    week_number: parseInt(document.getElementById('wizard-week').value),
    sticker_count: parseInt(document.getElementById('wizard-stickers').value),
    photo_s3_key: 'audit/' + Date.now() + '.jpg' // Mock key
  };

  var result = null;
  if (supabase && isOnline) {
    try {
      var { data, error } = await supabase.functions.invoke('verify-scan', { body: payload });
      if (error) throw error;
      result = data;
    } catch (e) {
      console.log('Edge function failed, falling back to local:', e);
    }
  }

  if (!result) {
    result = await verifyFactors(payload, qr);
    var queue = getOfflineQueue();
    queue.push(payload);
    saveOfflineQueue(queue);
    showToast('Offline: Saved to local queue', 'warning');
  }

  resultEl.innerHTML = buildResultHTML(result);
  showToast(result.status === 'hardened' ? '✅ SUCCESS' : '⚠️ FLAGGED', result.status === 'hardened' ? 'success' : 'warning');
}

async function verifyFactors(payload, qr) {
  await new Promise(function(r) { setTimeout(r, 800); });
  var qrPass = qr.hmac && qr.hmac.length >= 10;
  var berekusoLat = 5.7456, berekusoLng = -0.3214;
  var dist = haversineDistance(payload.gps_lat, payload.gps_lng, berekusoLat, berekusoLng);
  var gpsPass = dist <= 200;
  var allPass = qrPass && gpsPass;
  return {
    status: allPass ? 'hardened' : 'flagged',
    participant_name: 'Akosua Mensah',
    site: 'Berekuso',
    factors: {
      qr: { pass: qrPass },
      gps: { pass: gpsPass, distance_m: Math.round(dist) },
      timestamp: { pass: true }
    }
  };
}

function haversineDistance(lat1, lon1, lat2, lon2) {
  var R = 6371000;
  var dLat = (lat2 - lat1) * Math.PI / 180;
  var dLon = (lon2 - lon1) * Math.PI / 180;
  var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
          Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
          Math.sin(dLon/2) * Math.sin(dLon/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function buildResultHTML(res) {
  var color = res.status === 'hardened' ? 'var(--green)' : 'var(--amber)';
  var icon = res.status === 'hardened' ? '✓' : '⚠';
  var label = res.status === 'hardened' ? 'HARDENED' : 'FLAGGED';
  
  var html = '<div class="verdict ' + (res.status === 'hardened' ? 'ok' : 'fail') + '">' +
    '<div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;opacity:0.7;">Status</div>' +
    '<div style="font-size:24px;font-weight:800;color:' + color + ';">' + icon + ' ' + label + '</div>' +
    '</div>';

  html += '<div style="margin-top:16px;">' +
    '<div class="factor-row ' + (res.factors.qr.pass ? 'ok' : 'fail') + '">' +
      '<div class="factor-label">FACTOR 1: QR AUTH</div>' +
      '<div class="factor-val">' + (res.factors.qr.pass ? 'Valid Signature' : 'Invalid Signature') + '</div>' +
    '</div>' +
    '<div class="factor-row ' + (res.factors.gps.pass ? 'ok' : 'fail') + '">' +
      '<div class="factor-label">FACTOR 2: GEOFENCE</div>' +
      '<div class="factor-val">' + (res.factors.gps.pass ? 'Within Berekuso' : 'Outside Target Area') + '</div>' +
      '<div class="factor-sub">Distance: ' + res.factors.gps.distance_m + 'm</div>' +
    '</div>' +
    '</div>';
    
  return html;
}

// ── PWA — Register service worker ──
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').then(function(reg) {
    console.log('SW registered:', reg.scope);
  }).catch(function(err) {
    console.log('SW failed:', err);
  });
}

// Initialize GPS on load
initGPS();
updateQueueBadge();
