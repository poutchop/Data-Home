// ══ EXCEL EXPORT ════════════════════════════════════════════════
async function exportExcel() {
  showToast('Generating Excel report…');

  let scansData = feedData || [];
  let participantsData = lbData || [];
  let nutritionData = nutritionRows || [];

  if (window.sb) {
    try {
      const [s, p, n] = await Promise.all([
        window.sb.from('scans').select('*').order('created_at', { ascending: false }).limit(500),
        window.sb.from('participants').select('*').order('total_points', { ascending: false }),
        window.sb.from('nutrition_logs').select('*').order('created_at', { ascending: false }).limit(200)
      ]);
      if (s.data?.length) scansData = s.data;
      if (p.data?.length) participantsData = p.data;
      if (n.data?.length) nutritionData = n.data;
    } catch(e) {
      console.warn('Excel export using cached data', e);
    }
  }

  const sheet1 = [['Date', 'Time', 'Participant', 'Board', 'Site', 'Action', 'Status', 'GPS Lat', 'GPS Lng', 'GPS Distance (m)', 'QR Valid', 'CO₂ Avoided (kg)', 'Points']];
  scansData.forEach(s => {
    const dt = s.created_at ? new Date(s.created_at) : new Date();
    sheet1.push([
      dt.toISOString().split('T')[0], s.time || dt.toTimeString().substring(0,5),
      s.participant_name || s.name || '', s.board || '', s.site || '',
      (s.action || '').replace(/_/g, ' '), s.status || '',
      s.gps_lat || '', s.gps_lng || '', s.gps_distance_m || '',
      s.qr_valid !== undefined ? (s.qr_valid ? 'Yes' : 'No') : '',
      s.co2_avoided_kg || '', s.points_awarded || s.pts || ''
    ]);
  });

  const sheet2 = [['Name', 'Board', 'Site', 'Total Points', 'Payout Balance (GHS)', 'MoMo Number']];
  participantsData.forEach(p => {
    sheet2.push([p.name || '', p.board || '', p.site || '', p.total_points || p.pts || '', p.payout_balance || p.pay || '', p.momo_number || '']);
  });

  const sheet3 = [['Date', 'Participant', 'Site', 'Meal', 'Protein (g)', 'Kcal', 'Score', 'Verified']];
  nutritionData.forEach(n => {
    sheet3.push([n.log_date || n.date || '', n.participant_name || n.name || '', n.site || '', n.meal || '', n.protein_g || n.protein || '', n.kcal || '', n.score || '', n.verified ? 'Yes' : 'No']);
  });

  const totalScans = scansData.length;
  const hardened = scansData.filter(s => s.status === 'hardened').length;
  const flagged = scansData.filter(s => s.status === 'flagged').length;
  const totalCO2 = scansData.reduce((sum, s) => sum + (parseFloat(s.co2_avoided_kg) || 0), 0);
  const totalPoints = participantsData.reduce((sum, p) => sum + (p.total_points || p.pts || 0), 0);

  const sheet4 = [
    ['Carbon Clarity Data Vault — Weekly Report'],
    ['Generated', new Date().toISOString()],
    ['Pilot', 'Berekuso · Ashesi University'],
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
    ['Berekuso Farm A', participantsData.filter(p=>(p.site||'').includes('Farm A')).length, scansData.filter(s=>(s.site||'').includes('Farm A')).length],
    ['Berekuso Farm B', participantsData.filter(p=>(p.site||'').includes('Farm B')).length, scansData.filter(s=>(s.site||'').includes('Farm B')).length],
    ['Taanso Co-op W', participantsData.filter(p=>(p.site||'').includes('Co-op')).length, scansData.filter(s=>(s.site||'').includes('Co-op')).length],
  ];

  let xml = '<?xml version="1.0"?>\n<?mso-application progid="Excel.Sheet"?>\n';
  xml += '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">\n';

  function addSheet(name, data) {
    xml += '<Worksheet ss:Name="' + name + '"><Table>\n';
    data.forEach(row => {
      xml += '<Row>';
      row.forEach(cell => {
        const type = typeof cell === 'number' ? 'Number' : 'String';
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

  const blob = new Blob([xml], { type: 'application/vnd.ms-excel' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'CarbonClarity_DataVault_' + new Date().toISOString().split('T')[0] + '.xls';
  a.click();
  URL.revokeObjectURL(a.href);
  showToast('✅ Excel report downloaded — 4 sheets');
}

// ══ CHARTS & ANALYTICS ═══════════════════════════════════════════
const chartDefaults = {
  responsive: true, maintainAspectRatio: false,
  plugins: { legend: { labels: { color: '#8b8fa8', font: { size: 11, family: 'Inter' }, boxWidth: 10 } } },
};
function gridOpts() { return { color: 'rgba(255,255,255,0.04)', drawBorder: false }; }
function tickOpts() { return { color: '#8b8fa8', font: { size: 10, family: 'Inter' } }; }

let co2Chart, bundleChart, nutritionChart, statusChart, radarChart;

function initCharts() {
  if (typeof Chart === 'undefined') {
    console.warn('Chart.js not loaded yet');
    return;
  }
  const weeks = ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7'];

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

  let chartLabels = weeks;
  let chartData = [62, 65, 70, 71, 74, 76, 78];
  
  if (typeof nutritionRows !== 'undefined' && nutritionRows.length > 0) {
    const dates = {};
    nutritionRows.forEach(r => {
      if (!dates[r.date]) dates[r.date] = { sum: 0, count: 0 };
      dates[r.date].sum += r.score;
      dates[r.date].count++;
    });
    const sortedDates = Object.keys(dates).sort().slice(-7);
    if (sortedDates.length > 0) {
      chartLabels = sortedDates;
      chartData = sortedDates.map(d => Math.round(dates[d].sum / dates[d].count));
    }
  }

  if (!nutritionChart && document.getElementById('nutritionChart')) {
    nutritionChart = new Chart(document.getElementById('nutritionChart'), {
      type: 'line',
      data: {
        labels: chartLabels,
        datasets: [
          { label: 'Nutrition avg score', data: chartData, borderColor: '#4d9fff', backgroundColor: 'rgba(77,159,255,0.1)', borderWidth: 2, pointRadius: 4, pointBackgroundColor: '#4d9fff', fill: true, tension: .35 },
          { label: 'Target (80)', data: chartLabels.map(()=>80), borderColor: '#9d7dff', borderWidth: 1.5, borderDash: [4, 4], pointRadius: 0, fill: false },
        ]
      },
      options: { ...chartDefaults, scales: { x: { grid: gridOpts(), ticks: tickOpts() }, y: { grid: gridOpts(), ticks: tickOpts(), min: 40, max: 100 } } },
    });
  } else if (nutritionChart) {
    nutritionChart.data.labels = chartLabels;
    nutritionChart.data.datasets[0].data = chartData;
    nutritionChart.data.datasets[1].data = chartLabels.map(()=>80);
    nutritionChart.update();
  }

  if (!statusChart && document.getElementById('statusChart')) {
    statusChart = new Chart(document.getElementById('statusChart'), {
      type: 'doughnut',
      data: {
        labels: ['Hardened', 'Flagged', 'Rejected'],
        datasets: [{
          data: [41, 4, 2],
          backgroundColor: ['rgba(16,217,126,0.8)', 'rgba(244,161,52,0.8)', 'rgba(255,90,90,0.8)'],
          borderWidth: 0, spacing: 3, borderRadius: 4,
        }]
      },
      options: {
        ...chartDefaults, cutout: '65%',
        plugins: { legend: { position: 'bottom', labels: { color: '#8b8fa8', font: { size: 11, family: 'Inter' }, padding: 14, boxWidth: 10 } } }
      },
    });
  }

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
