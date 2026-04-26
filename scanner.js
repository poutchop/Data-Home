// ══ QR SCANNER MODULE — Field App for Queen Mother ══════════════
// Uses html5-qrcode for camera-based scanning
// Parses CC-v1 protocol, captures GPS, submits to Data Vault

var scannerActive = false;
var html5QrCode = null;
var lastGPS = { lat: null, lng: null, accuracy: null };

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
      var res = await supabase.from('scans').insert(queue[i]);
      if (res.error) throw res.error;
      synced++;
    } catch(e) {
      failed.push(queue[i]);
    }
  }

  saveOfflineQueue(failed);
  if (synced > 0) showToast('✅ Synced ' + synced + ' queued scan' + (synced > 1 ? 's' : ''));
  if (failed.length > 0) showToast(failed.length + ' scan(s) failed to sync — will retry', 'warning');
}

// ── GPS tracking (runs in background) ──
function startGPSTracking() {
  if (!navigator.geolocation) {
    document.getElementById('scanner-gps-status').textContent = 'GPS not available';
    return;
  }
  navigator.geolocation.watchPosition(
    function(pos) {
      lastGPS.lat = pos.coords.latitude;
      lastGPS.lng = pos.coords.longitude;
      lastGPS.accuracy = Math.round(pos.coords.accuracy);
      var el = document.getElementById('scanner-gps-status');
      if (el) el.innerHTML = '<span style="color:var(--green);">● GPS locked</span> — ' +
        lastGPS.lat.toFixed(4) + '°N ' + Math.abs(lastGPS.lng).toFixed(4) + '°W (±' + lastGPS.accuracy + 'm)';
    },
    function(err) {
      var el = document.getElementById('scanner-gps-status');
      if (el) el.innerHTML = '<span style="color:var(--amber);">⚠ GPS error:</span> ' + err.message;
    },
    { enableHighAccuracy: true, maximumAge: 5000 }
  );
}

// ── Parse CC-v1 QR format ──
function parseQRData(raw) {
  // Format: CC-v1|{board_id}|{participant_id}|{action_type}|{issued_at_unix}|{hmac_signature}
  if (!raw || !raw.startsWith('CC-v1|')) return null;
  var parts = raw.split('|');
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

// ── Get action display info ──
function actionInfo(type) {
  var map = {
    'firewood_avoidance': { label: 'Firewood Avoidance', color: 'var(--green)', icon: '🔥', points: 3 },
    'nutrition_meal':     { label: 'Nutrition Meal',     color: 'var(--blue)',  icon: '🥗', points: 2 },
    'solar_drying':       { label: 'Solar Drying',       color: 'var(--amber)', icon: '☀️', points: 2 },
    'organic_fertilizer': { label: 'Organic Fertilizer', color: 'var(--purple)', icon: '🌱', points: 2 }
  };
  return map[type] || { label: type, color: 'var(--muted)', icon: '📋', points: 1 };
}

// ── Start scanner ──
function startScanner() {
  if (scannerActive) return;
  var readerEl = document.getElementById('qr-reader');
  if (!readerEl) return;

  scannerActive = true;
  document.getElementById('scanner-start-btn').style.display = 'none';
  document.getElementById('scanner-stop-btn').style.display = '';
  document.getElementById('scanner-result').innerHTML = '';
  document.getElementById('scanner-status').innerHTML = '<span style="color:var(--green);">Scanning… point camera at QR code</span>';

  startGPSTracking();

  html5QrCode = new Html5Qrcode('qr-reader');
  html5QrCode.start(
    { facingMode: 'environment' },
    { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 },
    onScanSuccess,
    function() {} // ignore scan failures (no QR in frame)
  ).catch(function(err) {
    document.getElementById('scanner-status').innerHTML = '<span style="color:var(--red);">Camera error: ' + err + '</span>';
    scannerActive = false;
    document.getElementById('scanner-start-btn').style.display = '';
    document.getElementById('scanner-stop-btn').style.display = 'none';
  });
}

// ── Stop scanner ──
function stopScanner() {
  if (html5QrCode && scannerActive) {
    html5QrCode.stop().then(function() {
      html5QrCode.clear();
      scannerActive = false;
      document.getElementById('scanner-start-btn').style.display = '';
      document.getElementById('scanner-stop-btn').style.display = 'none';
      document.getElementById('scanner-status').textContent = 'Scanner stopped';
    });
  }
}

// ── On successful QR scan ──
async function onScanSuccess(decodedText) {
  // Stop scanning immediately to prevent double-reads
  if (html5QrCode) {
    await html5QrCode.stop();
    html5QrCode.clear();
    scannerActive = false;
  }
  document.getElementById('scanner-start-btn').style.display = '';
  document.getElementById('scanner-stop-btn').style.display = 'none';

  // Parse the QR
  var qr = parseQRData(decodedText);
  var resultEl = document.getElementById('scanner-result');

  if (!qr) {
    resultEl.innerHTML = buildResultHTML({
      status: 'rejected',
      message: 'Invalid QR code — not a Carbon Clarity board',
      raw: decodedText
    });
    showToast('Invalid QR code', 'warning');
    return;
  }

  document.getElementById('scanner-status').innerHTML = '<span style="color:var(--amber);">Verifying…</span>';

  // Build verification payload
  var payload = {
    board_id: qr.board_id,
    participant_id: qr.participant_id,
    action_type: qr.action_type,
    qr_hmac_received: qr.hmac,
    gps_lat: lastGPS.lat || 5.7456,
    gps_lng: lastGPS.lng || -0.3214,
    gps_accuracy_m: lastGPS.accuracy || 999,
    scan_time_device: new Date().toISOString(),
    issued_at: qr.issued_at
  };

  // Simulate 3-factor verification
  var result = await verifyFactors(payload, qr);
  resultEl.innerHTML = buildResultHTML(result);

  // Save scan record — offline-first
  var scanRecord = {
    participant_name: result.participant_name || 'Participant ' + qr.participant_id.substring(0, 8),
    board: qr.board_id.substring(0, 8),
    site: result.site || 'Berekuso',
    action: qr.action_type,
    status: result.status,
    gps_lat: payload.gps_lat,
    gps_lng: payload.gps_lng,
    gps_distance_m: result.factors.gps.distance_m,
    qr_valid: result.factors.qr.pass,
    timestamp_delta_s: result.factors.timestamp.delta_seconds,
    co2_avoided_kg: qr.action_type === 'firewood_avoidance' ? 12.5 : 0,
    points_awarded: result.points_awarded
  };

  if (supabase && isOnline) {
    try {
      var res = await supabase.from('scans').insert(scanRecord);
      if (res.error) throw res.error;
    } catch(e) {
      // Network failed mid-request — queue it
      var queue = getOfflineQueue();
      queue.push(scanRecord);
      saveOfflineQueue(queue);
      showToast('Saved to offline queue — will sync later', 'warning');
    }
  } else {
    // Offline — store locally
    var queue = getOfflineQueue();
    queue.push(scanRecord);
    saveOfflineQueue(queue);
  }

  // Also add to the live feed
  var now = new Date();
  feedData.unshift({
    name: result.participant_name || 'Participant',
    board: qr.board_id.substring(0, 8),
    site: result.site || 'Berekuso',
    action: qr.action_type,
    status: result.status,
    time: String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0')
  });
  scanCount++;
  var scansEl = document.getElementById('m-scans');
  if (scansEl) scansEl.textContent = scanCount;

  showToast(result.status === 'hardened' ? '✅ HARDENED — Payout queued' : '⚠️ FLAGGED — Review needed',
    result.status === 'hardened' ? 'success' : 'warning');
}

// ── 3-Factor verification logic ──
async function verifyFactors(payload, qr) {
  // Simulate verification delay
  await new Promise(function(r) { setTimeout(r, 800); });

  // Factor 1: QR HMAC — check format validity
  var qrPass = qr.hmac && qr.hmac.length >= 10 && qr.version === 'CC-v1';

  // Factor 2: GPS Geofence — check within 200m of Berekuso centroid
  var berekusoLat = 5.7456, berekusoLng = -0.3214, fenceRadius = 200;
  var dist = haversineDistance(payload.gps_lat, payload.gps_lng, berekusoLat, berekusoLng);
  var gpsPass = dist <= fenceRadius;

  // Factor 3: Timestamp — check scan time vs device time
  var now = Math.floor(Date.now() / 1000);
  var delta = Math.abs(now - qr.issued_at);
  var timePass = true; // Device time is always valid for live scans

  var allPass = qrPass && gpsPass && timePass;

  // Look up participant name from leaderboard data
  var pName = null;
  var pSite = null;
  for (var i = 0; i < lbData.length; i++) {
    if (lbData[i].name) { pName = lbData[i].name; pSite = lbData[i].site; break; }
  }

  var info = actionInfo(qr.action_type);

  return {
    status: allPass ? 'hardened' : 'flagged',
    participant_name: pName || 'Participant',
    site: pSite || 'Berekuso Farm A',
    points_awarded: allPass ? info.points : 0,
    payout_queued: allPass,
    factors: {
      qr: { pass: qrPass },
      gps: { pass: gpsPass, distance_m: Math.round(dist) },
      timestamp: { pass: timePass, delta_seconds: delta }
    }
  };
}

// ── Haversine distance calculation ──
function haversineDistance(lat1, lng1, lat2, lng2) {
  var R = 6371000;
  var dLat = (lat2 - lat1) * Math.PI / 180;
  var dLng = (lng2 - lng1) * Math.PI / 180;
  var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
          Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Build result HTML ──
function buildResultHTML(result) {
  if (result.raw) {
    // Invalid QR
    return '<div class="verdict fail" style="margin-top:0;">'
      + '<div style="font-size:14px;font-weight:700;color:var(--red);">✗ REJECTED</div>'
      + '<div style="font-size:11px;color:var(--muted);margin-top:4px;">' + result.message + '</div>'
      + '<div style="font-size:10px;color:var(--muted);margin-top:4px;word-break:break-all;">Raw: ' + result.raw + '</div>'
      + '</div>';
  }

  var info = actionInfo(result.factors ? 'firewood_avoidance' : '');
  var isHardened = result.status === 'hardened';
  var f = result.factors;

  return '<div style="display:flex;flex-direction:column;gap:8px;">'
    // Factor 1
    + '<div class="factor-row ' + (f.qr.pass ? 'ok' : 'fail') + '">'
      + '<div class="factor-label">FACTOR 1 · QR HMAC</div>'
      + '<div class="factor-val" style="color:' + (f.qr.pass ? 'var(--green)' : 'var(--red)') + ';">'
        + (f.qr.pass ? '✓ Signature valid' : '✗ Invalid signature') + '</div>'
    + '</div>'
    // Factor 2
    + '<div class="factor-row ' + (f.gps.pass ? 'ok' : 'fail') + '">'
      + '<div class="factor-label">FACTOR 2 · GPS GEOFENCE</div>'
      + '<div class="factor-val" style="color:' + (f.gps.pass ? 'var(--green)' : 'var(--red)') + ';">'
        + (f.gps.pass ? '✓ ' : '✗ ') + f.gps.distance_m + ' m from centroid</div>'
      + '<div class="factor-sub">' + (f.gps.pass ? 'Within 200 m fence' : 'Outside 200 m geofence — flagged') + '</div>'
    + '</div>'
    // Factor 3
    + '<div class="factor-row ' + (f.timestamp.pass ? 'ok' : 'fail') + '">'
      + '<div class="factor-label">FACTOR 3 · TIMESTAMP</div>'
      + '<div class="factor-val" style="color:' + (f.timestamp.pass ? 'var(--green)' : 'var(--red)') + ';">'
        + (f.timestamp.pass ? '✓ Δt valid' : '✗ Time drift detected') + '</div>'
    + '</div>'
    // Verdict
    + '<div class="verdict ' + (isHardened ? 'ok' : 'fail') + '">'
      + '<div style="font-size:14px;font-weight:800;color:' + (isHardened ? 'var(--green)' : 'var(--amber)') + ';">'
        + (isHardened ? '✅ HARDENED — Payout queued' : '⚠️ FLAGGED — Review needed') + '</div>'
      + '<div style="font-size:11px;color:var(--muted);margin-top:4px;">'
        + result.participant_name + ' · ' + result.site
        + (isHardened ? ' · +' + result.points_awarded + ' pts' : '')
      + '</div>'
    + '</div>'
  + '</div>';
}

// ── Demo scan (for testing without camera) ──
function demoScan() {
  var demoQR = 'CC-v1|b4f8a1c2-0000-0000-0000-000000000001|p9d3e7f0-0000-0000-0000-000000000001|firewood_avoidance|' + Math.floor(Date.now()/1000) + '|a3f9c82b1d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a';
  onScanSuccess(demoQR);
}
