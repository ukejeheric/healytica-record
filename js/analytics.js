// ===== HEALTH ANALYTICS FUNCTIONALITY =====

const analyticsState = {
    charts: {},
    data: {
        vital_signs: [],
        lab_results: [],
        medications: [],
        symptoms: [],
        appointments: [],
        journal_entries: [],
        documents: [],
        lab_documents: []
    },
    currentTab: 'dashboard',
    isLoading: false,
    listenersSetup: false
};

// ===== INITIALIZATION =====
async function loadAnalytics() {
    if (analyticsState.isLoading) return;
    analyticsState.isLoading = true;
    showLoading();

    try {
        if (!document.getElementById('analyticsPage')) {
            return;
        }

        await waitForAppState();

        const user = await getCurrentUser();
        if (!user) {
            window.location.href = 'index.html';
            return;
        }

        destroyAllCharts();
        await loadAnalyticsData(user.id);

        analyticsState.currentTab = 'dashboard';
        setupAnalytics();
        await loadDashboardTab();

        if (!analyticsState.listenersSetup) {
            setupAnalyticsListeners();
            analyticsState.listenersSetup = true;
        }

    } catch (error) {
        console.error('Error loading analytics:', error);
        showMessage('error', 'Failed to load analytics data. Please try again.');
    } finally {
        hideLoading();
        analyticsState.isLoading = false;
    }
}

function waitForAppState() {
    return new Promise((resolve) => {
        if (window.appState) { resolve(); return; }
        let attempts = 0;
        const check = setInterval(() => {
            if (window.appState || ++attempts > 20) {
                clearInterval(check);
                resolve();
            }
        }, 100);
    });
}

async function getCurrentUser() {
    if (window.appState?.currentUser) return window.appState.currentUser;
    try {
        if (window.supabaseService?.getCurrentUser) {
            const user = await window.supabaseService.getCurrentUser();
            if (user) { window.appState = window.appState || {}; window.appState.currentUser = user; return user; }
        }
        if (window.supabaseClient) {
            const { data: { user } } = await window.supabaseClient.auth.getUser();
            if (user) { window.appState = window.appState || {}; window.appState.currentUser = user; return user; }
        }
    } catch (e) { console.error('Error getting user:', e); }
    return null;
}

// ===== DATA LOADING =====
async function loadAnalyticsData(userId) {
    if (!userId) return;

    if (!window.healthDB) {
        window.healthDB = {
            getUserVitalSigns: async () => [],
            getUserLabResults: async () => [],
            getUserMedications: async () => [],
            getUserSymptoms: async () => [],
            getUserAppointments: async () => [],
            getUserJournalEntries: async () => [],
            getUserDocuments: async () => [],
            getUserLabDocuments: async () => []
        };
    }

    const safeGet = async (promise) => {
        try {
            const r = await promise;
            if (!r) return [];
            if (Array.isArray(r)) return r;
            if (r.data && Array.isArray(r.data)) return r.data;
            if (r.success && Array.isArray(r.data)) return r.data;
        } catch (e) { console.warn('Data fetch error:', e); }
        return [];
    };

    const svc = window.supabaseService;
    const db = window.healthDB;

    const results = await Promise.allSettled([
        safeGet(svc?.getUserVitalSigns?.(userId) ?? db.getUserVitalSigns(userId)),
        safeGet(svc?.getUserLabResults?.(userId) ?? db.getUserLabResults(userId)),
        safeGet(svc?.getUserMedications?.(userId) ?? db.getUserMedications(userId)),
        safeGet(svc?.getUserSymptoms?.(userId) ?? db.getUserSymptoms(userId)),
        safeGet(svc?.getUserAppointments?.(userId) ?? db.getUserAppointments(userId)),
        safeGet(svc?.getJournalEntries?.(userId) ?? db.getUserJournalEntries(userId)),
        safeGet(svc?.getUserDocuments?.(userId) ?? db.getUserDocuments(userId)),
        safeGet(svc?.getUserLabDocuments?.(userId) ?? db.getUserLabDocuments(userId))
    ]);

    const get = (r) => r.status === 'fulfilled' ? (r.value || []) : [];

    analyticsState.data = {
        vital_signs:     get(results[0]),
        lab_results:     get(results[1]),
        medications:     get(results[2]),
        symptoms:        get(results[3]),
        appointments:    get(results[4]),
        journal_entries: get(results[5]),
        documents:       get(results[6]),
        lab_documents:   get(results[7])
    };

    // Sort all arrays newest-first
    const byDate = (...keys) => (a, b) => {
        const da = new Date(keys.map(k => a[k]).find(Boolean) || 0);
        const db2 = new Date(keys.map(k => b[k]).find(Boolean) || 0);
        return db2 - da;
    };
    analyticsState.data.vital_signs.sort(byDate('record_date', 'recorded_at'));
    analyticsState.data.lab_results.sort(byDate('test_date', 'created_at'));
    analyticsState.data.medications.sort(byDate('start_date', 'created_at'));
    analyticsState.data.symptoms.sort(byDate('symptom_date', 'date', 'created_at'));
    analyticsState.data.journal_entries.sort(byDate('entry_date', 'created_at'));
}

function setupAnalytics() {
    updateDateDisplay();
    updateDataPointsCount();
}

function updateDateDisplay() {
    const el = document.getElementById('currentDate');
    if (el) el.textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

function updateDataPointsCount() {
    const el = document.getElementById('dataPoints');
    if (!el) return;
    const d = analyticsState.data;
    const total = d.vital_signs.length + d.lab_results.length + d.medications.length + d.symptoms.length + d.appointments.length + d.journal_entries.length;
    el.textContent = total.toLocaleString();
}

// ===== CHART UTILITIES =====
function destroyAllCharts() {
    Object.values(analyticsState.charts).forEach(c => { if (c?.destroy) c.destroy(); });
    analyticsState.charts = {};
}

function destroyChart(id) {
    if (analyticsState.charts[id]) {
        analyticsState.charts[id].destroy();
        delete analyticsState.charts[id];
    }
}

function getCtx(id) {
    const canvas = document.getElementById(id);
    if (!canvas) return null;
    destroyChart(id);
    return canvas.getContext('2d');
}

// ===== TAB SWITCHING =====
function setupAnalyticsListeners() {
    document.querySelectorAll('.analytics-tab').forEach(tab => {
        const fresh = tab.cloneNode(true);
        tab.parentNode.replaceChild(fresh, tab);
        fresh.addEventListener('click', async (e) => {
            e.preventDefault();
            if (analyticsState.isLoading) return;
            const tabName = fresh.dataset.tab;
            document.querySelectorAll('.analytics-tab').forEach(t => t.classList.remove('active'));
            fresh.classList.add('active');
            document.querySelectorAll('.analytics-tab-content').forEach(c => c.classList.remove('active'));
            const content = document.getElementById(`${tabName}Tab`);
            if (content) {
                content.classList.add('active');
                analyticsState.currentTab = tabName;
                await loadTabContent(tabName);
            }
        });
    });

    const refreshBtn = document.getElementById('refreshAnalyticsBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', async () => {
            refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Refreshing';
            refreshBtn.disabled = true;
            await loadAnalytics();
            refreshBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Refresh';
            refreshBtn.disabled = false;
        });
    }

    setupAnalyticsButtons();
}

function setupAnalyticsButtons() {
    const btnMap = {
        'exportDashboardBtn':    () => showMessage('info', 'Dashboard export coming soon!'),
        'generateRiskReportBtn': () => showMessage('info', 'Risk report generation coming soon!'),
        'trackProgressBtn':      () => showMessage('info', 'Progress tracking coming soon!'),
        'generateReportBtn':     generateHealthReport,
        'exportPdfBtn':          () => exportAnalyticsData('pdf'),
        'exportCsvBtn':          () => exportAnalyticsData('csv'),
        'exportJsonBtn':         () => exportAnalyticsData('json'),
        'shareProviderBtn':      () => showMessage('info', 'Share with provider coming soon!'),
    };

    Object.entries(btnMap).forEach(([id, fn]) => {
        const btn = document.getElementById(id);
        if (btn) btn.addEventListener('click', fn);
    });

    const refreshInsightsBtn = document.getElementById('refreshInsightsBtn');
    if (refreshInsightsBtn) {
        refreshInsightsBtn.addEventListener('click', async () => {
            refreshInsightsBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Refreshing';
            refreshInsightsBtn.disabled = true;
            await generateInsights();
            refreshInsightsBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Refresh Insights';
            refreshInsightsBtn.disabled = false;
        });
    }

    const trendParam = document.getElementById('trendParameter');
    const trendPeriod = document.getElementById('trendPeriod');
    if (trendParam) trendParam.addEventListener('change', updateTrendAnalysis);
    if (trendPeriod) trendPeriod.addEventListener('change', updateTrendAnalysis);
}

async function loadTabContent(tab) {
    const map = {
        dashboard: loadDashboardTab,
        trends:    loadTrendsTab,
        risk:      loadRiskTab,
        wellness:  loadWellnessTab,
        reports:   loadReportsTab,
        insights:  loadInsightsTab
    };
    if (map[tab]) {
        try { await map[tab](); }
        catch (e) { console.error(`Error loading ${tab} tab:`, e); showMessage('error', `Failed to load ${tab} analytics`); }
    }
}

// =============================================
// ===== TAB 1: HEALTH DASHBOARD =====
// =============================================
async function loadDashboardTab() {
    updateHealthAlerts();
    updateOverallHealthScore();
    updateDetailedMetrics();
    setupHealthRadarChart();
    updateActivityTimeline();
}

function updateHealthAlerts() {
    const container = document.getElementById('healthAlerts');
    if (!container) return;
    container.innerHTML = '';
    const alerts = [];
    const d = analyticsState.data;

    if (d.vital_signs.length > 0) {
        const v = d.vital_signs[0];
        if (v.blood_pressure_systolic > 180) alerts.push({ type: 'critical', icon: 'fas fa-heartbeat', message: '🚨 CRITICAL: Severely high blood pressure — seek immediate medical attention' });
        else if (v.blood_pressure_systolic > 140) alerts.push({ type: 'warning', icon: 'fas fa-heart', message: '⚠️ High blood pressure — monitor closely and consult your doctor' });
        if (v.heart_rate > 120) alerts.push({ type: 'warning', icon: 'fas fa-heartbeat', message: '⚠️ Elevated heart rate — consider rest and hydration' });
        if (v.oxygen_saturation && v.oxygen_saturation < 92) alerts.push({ type: 'critical', icon: 'fas fa-lungs', message: '🚨 CRITICAL: Low oxygen saturation — seek medical attention immediately' });
    }

    if (d.lab_results.length > 0) {
        const l = d.lab_results[0];
        if (l.glucose > 300) alerts.push({ type: 'critical', icon: 'fas fa-tint', message: '🚨 CRITICAL: Very high blood sugar — contact your doctor immediately' });
        else if (l.glucose > 200) alerts.push({ type: 'warning', icon: 'fas fa-tint', message: '⚠️ High blood sugar — monitor and adjust management' });
        if (l.cholesterol > 240) alerts.push({ type: 'warning', icon: 'fas fa-heart', message: '⚠️ High cholesterol — consider dietary changes' });
        if (l.hba1c >= 6.5) alerts.push({ type: 'warning', icon: 'fas fa-chart-line', message: '⚠️ Elevated HbA1c — consult your healthcare provider' });
    }

    const activeMeds = d.medications.filter(m => m.status === 'active');
    if (activeMeds.length > 5) alerts.push({ type: 'info', icon: 'fas fa-pills', message: '💊 Multiple active medications — review with provider for potential interactions' });

    const sevenAgo = new Date(); sevenAgo.setDate(sevenAgo.getDate() - 7);
    const recentHigh = d.symptoms.filter(s => new Date(s.symptom_date) >= sevenAgo && s.severity === 'High');
    if (recentHigh.length > 0) alerts.push({ type: 'warning', icon: 'fas fa-exclamation-triangle', message: `⚠️ ${recentHigh.length} high-severity symptom(s) in the last 7 days` });

    if (d.vital_signs.length === 0 && d.lab_results.length === 0) alerts.push({ type: 'info', icon: 'fas fa-info-circle', message: '📊 Start tracking your health data to receive personalized alerts and insights' });
    if (alerts.length === 0) alerts.push({ type: 'success', icon: 'fas fa-check-circle', message: '✅ No critical alerts — health parameters within safe ranges' });

    alerts.forEach(a => {
        const el = document.createElement('div');
        el.className = `alert-item ${a.type}`;
        el.innerHTML = `<i class="${a.icon}"></i><span>${a.message}</span>`;
        container.appendChild(el);
    });
}

function calculateHealthScore() {
    const d = analyticsState.data;
    let score = 75;
    if (d.vital_signs.length > 0) {
        const v = d.vital_signs[0];
        if (v.blood_pressure_systolic <= 120) score += 10; else if (v.blood_pressure_systolic <= 140) score += 5;
        if (v.heart_rate >= 60 && v.heart_rate <= 100) score += 5;
        if (v.oxygen_saturation && v.oxygen_saturation >= 95) score += 5;
    }
    if (d.lab_results.length > 0) {
        const l = d.lab_results[0];
        if (l.glucose <= 100) score += 10; else if (l.glucose <= 126) score += 5;
        if (l.hba1c && l.hba1c < 5.7) score += 5;
    }
    if (d.medications.filter(m => m.status === 'active').length > 0) score += 5;
    if (d.journal_entries.length > 0) {
        const j = d.journal_entries[0];
        if (['Good', 'Excellent'].includes(j.sleep_quality)) score += 5;
        if (j.energy_level === 'High') score += 5;
    }
    const thirtyAgo = new Date(); thirtyAgo.setDate(thirtyAgo.getDate() - 30);
    const recentSym = d.symptoms.filter(s => new Date(s.symptom_date || s.date) >= thirtyAgo).length;
    score -= Math.min(20, recentSym * 2);
    return Math.max(0, Math.min(100, Math.round(score)));
}

function updateOverallHealthScore() {
    const score = calculateHealthScore();
    setText('overallHealthScore', score);
    setText('healthScore', score);
    const statusEl = document.getElementById('healthScoreStatus');
    const scoreEl = document.getElementById('overallHealthScore');
    let status, color;
    if (score >= 85) { status = 'Excellent'; color = '#28a745'; }
    else if (score >= 70) { status = 'Good'; color = '#20c997'; }
    else if (score >= 50) { status = 'Fair'; color = '#ffc107'; }
    else { status = 'Needs Attention'; color = '#dc3545'; }
    if (statusEl) { statusEl.textContent = status; statusEl.style.color = color; }
    if (scoreEl) scoreEl.style.color = color;
    updateDimensionScores();
}

function updateDimensionScores() {
    setScoreDisplay('vitalScore', 'vitalProgress', calculateVitalScore());
    setScoreDisplay('labScore', 'labProgress', calculateLabScore());
    setScoreDisplay('medScore', 'medProgress', calculateMedicationScore());
    setScoreDisplay('lifestyleScore', 'lifestyleProgress', calculateLifestyleScore());
}

function setScoreDisplay(valueId, barId, score) {
    setText(valueId, score);
    const bar = document.getElementById(barId);
    if (bar) {
        bar.style.width = `${score}%`;
        bar.style.background = score >= 80 ? 'linear-gradient(90deg,#4CAF50,#8BC34A)' : score >= 60 ? 'linear-gradient(90deg,#FFC107,#FF9800)' : 'linear-gradient(90deg,#F44336,#E91E63)';
    }
}

function calculateVitalScore() {
    const d = analyticsState.data;
    if (!d.vital_signs.length) return 0;
    const v = d.vital_signs[0]; let s = 50;
    if (v.blood_pressure_systolic <= 120) s += 30; else if (v.blood_pressure_systolic <= 140) s += 15;
    if (v.heart_rate >= 60 && v.heart_rate <= 100) s += 20;
    if (v.oxygen_saturation && v.oxygen_saturation >= 95) s += 10;
    return Math.min(100, s);
}

function calculateLabScore() {
    const d = analyticsState.data;
    if (!d.lab_results.length) return 0;
    const l = d.lab_results[0]; let s = 50;
    if (l.glucose <= 100) s += 30; else if (l.glucose <= 126) s += 15;
    if (l.hba1c && l.hba1c < 5.7) s += 20; else if (l.hba1c && l.hba1c < 6.5) s += 10;
    if (l.cholesterol && l.cholesterol < 200) s += 10;
    if (d.lab_results.length >= 3) s += 10;
    return Math.min(100, s);
}

function calculateMedicationScore() {
    const d = analyticsState.data;
    if (!d.medications.length) return 0;
    const active = d.medications.filter(m => m.status === 'active').length;
    const s = Math.min(100, Math.round(60 + (active / d.medications.length) * 40));
    return s;
}

function calculateLifestyleScore() {
    const d = analyticsState.data; let s = 70;
    const thirtyAgo = new Date(); thirtyAgo.setDate(thirtyAgo.getDate() - 30);
    const recent = d.symptoms.filter(sym => new Date(sym.symptom_date || sym.date) >= thirtyAgo).length;
    s -= recent * 5;
    if (d.journal_entries.length > 0) {
        const j = d.journal_entries[0];
        if (j.sleep_quality === 'Excellent') s += 10; else if (j.sleep_quality === 'Good') s += 5; else if (j.sleep_quality === 'Poor') s -= 10;
        if (j.energy_level === 'High') s += 10; else if (j.energy_level === 'Low') s -= 10;
        if (['Happy','Calm','Energetic'].includes(j.mood)) s += 5;
    }
    if (d.vital_signs.length >= 7) s += 15;
    if (d.symptoms.length >= 5) s += 10;
    return Math.max(0, Math.min(100, s));
}

// Key metrics
function updateDetailedMetrics() {
    updateBPMetrics();
    updateHRMetrics();
    updateGlucoseMetrics();
    updateWeightMetrics();
    updateOxygenMetrics();
}

function updateBPMetrics() {
    const vitals = analyticsState.data.vital_signs;
    if (!vitals.length) return;
    const v = vitals[0];
    setText('bpAnalyticsValue', `${v.blood_pressure_systolic || '--'}/${v.blood_pressure_diastolic || '--'}`);
    const sys = vitals.map(x => x.blood_pressure_systolic).filter(Boolean);
    const dia = vitals.map(x => x.blood_pressure_diastolic).filter(Boolean);
    if (sys.length) {
        setText('avgSystolic', Math.round(avg(sys)));
        setText('avgDiastolic', Math.round(avg(dia)));
        setText('bpVariability', calcStdDev(sys).toFixed(1));
        updateTrendEl('bpAnalyticsTrend', sys);
        makeMiniChart('bpAnalyticsChart', sys.slice(0,7).reverse(), '#dc3545');
    }
}

function updateHRMetrics() {
    const vals = analyticsState.data.vital_signs.map(v => v.heart_rate).filter(Boolean);
    if (!vals.length) return;
    setText('hrAnalyticsValue', `${vals[0]} bpm`);
    setText('avgHeartRate', Math.round(avg(vals)));
    setText('hrVariability', calcStdDev(vals).toFixed(1));
    updateTrendEl('hrAnalyticsTrend', vals);
    makeMiniChart('hrAnalyticsChart', vals.slice(0,7).reverse(), '#28a745');
}

function updateGlucoseMetrics() {
    const labs = analyticsState.data.lab_results.filter(l => l.glucose);
    if (!labs.length) { ['glucoseAnalyticsValue','avgGlucose','hba1cValue','cholesterolValue','glucoseControl'].forEach(id => setText(id, '--')); return; }
    const vals = labs.map(l => l.glucose);
    setText('glucoseAnalyticsValue', `${vals[0]} mg/dL`);
    setText('avgGlucose', Math.round(avg(vals)));
    const hba1c = analyticsState.data.lab_results.find(l => l.hba1c);
    if (hba1c) setText('hba1cValue', `${hba1c.hba1c}%`);
    const chol = analyticsState.data.lab_results.find(l => l.cholesterol);
    if (chol) setText('cholesterolValue', `${chol.cholesterol} mg/dL`);
    const ctrl = vals[0] <= 100 ? 'Excellent' : vals[0] <= 126 ? 'Good' : vals[0] <= 200 ? 'Fair' : 'Poor';
    setText('glucoseControl', ctrl);
    updateTrendEl('glucoseAnalyticsTrend', vals);
    makeMiniChart('glucoseAnalyticsChart', vals.slice(0,5).reverse(), '#0078D4');
}

function updateWeightMetrics() {
    const wv = analyticsState.data.vital_signs.filter(v => v.weight);
    if (!wv.length) return;
    const weights = wv.map(v => v.weight);
    const h = wv[0].height || 170;
    const bmi = weights[0] / ((h / 100) ** 2);
    setText('bmiAnalyticsValue', bmi.toFixed(1));
    setText('currentWeight', `${weights[0]} kg`);
    if (weights.length > 1) setText('weightChange', `${weights[0] > weights[1] ? '+' : ''}${(weights[0] - weights[1]).toFixed(1)} kg`);
    const cat = bmi < 18.5 ? 'Underweight' : bmi < 25 ? 'Normal' : bmi < 30 ? 'Overweight' : 'Obese';
    setText('bmiCategory', cat);
    updateTrendEl('bmiAnalyticsTrend', weights);
    makeMiniChart('weightAnalyticsChart', weights.slice(0,7).reverse(), '#6f42c1');
}

function updateOxygenMetrics() {
    const vals = analyticsState.data.vital_signs.map(v => v.oxygen_saturation).filter(Boolean);
    if (!vals.length) return;
    setText('oxygenAnalyticsValue', `${vals[0]}%`);
    setText('avgOxygen', `${avg(vals).toFixed(1)}%`);
    setText('oxygenStatus', vals[0] >= 95 ? 'Normal' : vals[0] >= 92 ? 'Acceptable' : 'Low');
    updateTrendEl('oxygenAnalyticsTrend', vals);
    makeMiniChart('oxygenAnalyticsChart', vals.slice(0,7).reverse(), '#17a2b8');
}

function makeMiniChart(id, data, color) {
    const ctx = getCtx(id);
    if (!ctx || !data.length) return;
    analyticsState.charts[id] = new Chart(ctx, {
        type: 'line',
        data: { labels: data.map((_, i) => i + 1), datasets: [{ data, borderColor: color, backgroundColor: color + '20', borderWidth: 2, fill: true, tension: 0.4 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { display: false }, y: { display: false } } }
    });
}

function setupHealthRadarChart() {
    const ctx = getCtx('healthRadarChart');
    if (!ctx) return;
    const dims = {
        'Cardiovascular': calcCardioScore(),
        'Metabolic':      calcMetabolicScore(),
        'Respiratory':    calcRespiratoryScore(),
        'Mental Wellness':calcMentalWellnessScore(),
        'Physical Fitness':calcPhysicalFitnessScore(),
        'Nutrition':      calcNutritionScore()
    };
    const legend = document.getElementById('radarLegend');
    if (legend) {
        legend.innerHTML = Object.entries(dims).map(([n, s]) =>
            `<div class="legend-item"><div class="legend-color" style="background:#4a6fff"></div><div class="legend-label">${n}</div><div class="legend-value">${s}%</div></div>`
        ).join('');
    }
    analyticsState.charts.healthRadar = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: Object.keys(dims),
            datasets: [{ label: 'Health', data: Object.values(dims), backgroundColor: 'rgba(74,111,255,0.15)', borderColor: '#4a6fff', pointBackgroundColor: '#4a6fff', pointBorderColor: '#fff', pointHoverBackgroundColor: '#fff', pointHoverBorderColor: '#4a6fff', borderWidth: 2 }]
        },
        options: { responsive: true, maintainAspectRatio: false, scales: { r: { beginAtZero: true, max: 100, ticks: { stepSize: 20 } } }, plugins: { legend: { display: false } } }
    });
}

function calcCardioScore() {
    const d = analyticsState.data;
    if (!d.vital_signs.length) return 50;
    const v = d.vital_signs[0]; let s = 70;
    if (v.blood_pressure_systolic <= 120) s += 20; else if (v.blood_pressure_systolic <= 140) s += 10;
    if (v.heart_rate >= 60 && v.heart_rate <= 100) s += 10;
    return Math.min(100, s);
}
function calcMetabolicScore() {
    const labs = analyticsState.data.lab_results.filter(l => l.glucose);
    if (!labs.length) return 60;
    const g = labs[0].glucose; let s = 70;
    if (g <= 100) s += 20; else if (g <= 126) s += 10;
    return Math.min(100, s);
}
function calcRespiratoryScore() {
    const vals = analyticsState.data.vital_signs.map(v => v.oxygen_saturation).filter(Boolean);
    if (!vals.length) return 65;
    let s = 75;
    if (vals[0] >= 95) s += 20; else if (vals[0] >= 92) s += 10;
    return Math.min(100, s);
}
function calcMentalWellnessScore() {
    const d = analyticsState.data; let s = 75;
    if (d.journal_entries.length > 0) {
        const j = d.journal_entries[0];
        if (['Happy','Calm','Energetic','Content'].includes(j.mood)) s += 15;
        if (j.energy_level === 'High') s += 10;
    }
    const thirtyAgo = new Date(); thirtyAgo.setDate(thirtyAgo.getDate() - 30);
    const recent = d.symptoms.filter(sym => new Date(sym.symptom_date) >= thirtyAgo).length;
    s -= recent * 3;
    return Math.max(30, Math.min(100, s));
}
function calcPhysicalFitnessScore() {
    const wv = analyticsState.data.vital_signs.filter(v => v.weight && v.height);
    if (!wv.length) return 65;
    const bmi = wv[0].weight / ((wv[0].height / 100) ** 2); let s = 70;
    if (bmi >= 18.5 && bmi <= 24.9) s += 20; else if (bmi >= 25 && bmi <= 29.9) s += 10;
    return Math.min(100, s);
}
function calcNutritionScore() {
    const d = analyticsState.data; let s = 70;
    if (d.lab_results.length > 0 && d.lab_results[0].cholesterol < 200) s += 15;
    const nutSym = d.symptoms.filter(sym => ['fatigue','weakness','dizziness','nausea'].some(w => (sym.symptom_name || '').toLowerCase().includes(w))).length;
    s -= nutSym * 5;
    return Math.max(0, Math.min(100, s));
}

function updateActivityTimeline() {
    const tl = document.getElementById('activityTimeline');
    if (!tl) return;
    tl.innerHTML = '';
    const d = analyticsState.data;
    const activities = [];

    d.vital_signs.slice(0,3).forEach(v => activities.push({ date: v.record_date, title: 'Vital signs recorded', desc: `BP: ${v.blood_pressure_systolic||'--'}/${v.blood_pressure_diastolic||'--'}, HR: ${v.heart_rate||'--'} bpm` }));
    d.lab_results.slice(0,2).forEach(l => activities.push({ date: l.test_date, title: 'Lab test completed', desc: `${l.test_name||l.test_type||'Lab'}${l.glucose ? ` — Glucose: ${l.glucose} mg/dL` : ''}` }));
    d.medications.slice(0,2).forEach(m => activities.push({ date: m.start_date, title: m.status === 'active' ? 'Medication started' : 'Medication completed', desc: `${m.medication_name||'Medication'} — ${m.dosage||''}` }));
    d.symptoms.slice(0,2).forEach(s => activities.push({ date: s.symptom_date, title: 'Symptom recorded', desc: `${s.symptom_name||'Symptom'} — Severity: ${s.severity||'Unknown'}` }));
    d.journal_entries.slice(0,2).forEach(j => activities.push({ date: j.entry_date, title: 'Journal entry', desc: `Mood: ${j.mood||'N/A'}, Sleep: ${j.sleep_quality||'Not rated'}` }));

    activities.sort((a, b) => new Date(b.date) - new Date(a.date));

    if (!activities.length) {
        tl.innerHTML = `<div class="timeline-loading"><i class="fas fa-info-circle"></i><span>No recent activities. Start tracking your health!</span></div>`;
        return;
    }
    activities.forEach(a => {
        const el = document.createElement('div');
        el.className = 'timeline-item';
        el.innerHTML = `<div class="timeline-date">${formatDate(a.date)}</div><div class="timeline-content"><div class="timeline-title">${a.title}</div><div class="timeline-desc">${a.desc}</div></div>`;
        tl.appendChild(el);
    });
}

// =============================================
// ===== TAB 2: TREND ANALYSIS =====
// =============================================
async function loadTrendsTab() {
    await updateTrendAnalysis();
}

async function updateTrendAnalysis() {
    const param = document.getElementById('trendParameter')?.value || 'blood_pressure';
    const period = parseInt(document.getElementById('trendPeriod')?.value || '30');
    const filtered = filterByPeriod(period);
    updateMultiTrendChart(filtered, param);
    updateTrendStatistics(filtered, param);
    updateCorrelationAnalysis(filtered);
    updatePatternDetection(filtered);
}

function filterByPeriod(days) {
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - days);
    const after = (d) => d && new Date(d) >= cutoff;
    const d = analyticsState.data;
    return {
        vital_signs:     d.vital_signs.filter(v => after(v.record_date)),
        lab_results:     d.lab_results.filter(l => after(l.test_date)),
        medications:     d.medications.filter(m => after(m.start_date)),
        symptoms:        d.symptoms.filter(s => after(s.symptom_date)),
        journal_entries: d.journal_entries.filter(j => after(j.entry_date))
    };
}

function updateMultiTrendChart(filtered, param) {
    const ctx = getCtx('multiTrendChart');
    if (!ctx) return;
    const chartDataMap = {
        blood_pressure: () => getBPTrendData(filtered.vital_signs),
        heart_rate:     () => getHRTrendData(filtered.vital_signs),
        glucose:        () => getGlucoseTrendData(filtered.lab_results),
        weight:         () => getWeightTrendData(filtered.vital_signs),
        cholesterol:    () => getCholesterolTrendData(filtered.lab_results),
        oxygen:         () => getOxygenTrendData(filtered.vital_signs)
    };
    const chartData = (chartDataMap[param] || chartDataMap.blood_pressure)();
    if (!chartData.labels.length) {
        ctx.canvas.parentElement.innerHTML = `<div class="no-data-msg"><i class="fas fa-chart-line"></i><p>No data for this parameter in the selected period.</p></div>`;
        return;
    }
    analyticsState.charts.multiTrend = new Chart(ctx, {
        type: 'line', data: chartData,
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' } }, scales: { x: { grid: { display: false } }, y: { beginAtZero: false } } }
    });
}

const sortByDate = (arr, key) => [...arr].filter(x => x[key]).sort((a, b) => new Date(a[key]) - new Date(b[key]));
const ds = (label, data, color) => ({ label, data, borderColor: color, backgroundColor: color + '18', tension: 0.4, borderWidth: 2 });

function getBPTrendData(vs) {
    const s = sortByDate(vs.filter(v => v.blood_pressure_systolic && v.blood_pressure_diastolic), 'record_date');
    return { labels: s.map(v => formatDate(v.record_date)), datasets: [ds('Systolic BP', s.map(v => v.blood_pressure_systolic), '#dc3545'), ds('Diastolic BP', s.map(v => v.blood_pressure_diastolic), '#fd7e14')] };
}
function getHRTrendData(vs) {
    const s = sortByDate(vs.filter(v => v.heart_rate), 'record_date');
    return { labels: s.map(v => formatDate(v.record_date)), datasets: [ds('Heart Rate', s.map(v => v.heart_rate), '#28a745')] };
}
function getGlucoseTrendData(labs) {
    const s = sortByDate(labs.filter(l => l.glucose), 'test_date');
    return { labels: s.map(l => formatDate(l.test_date)), datasets: [ds('Fasting Blood Sugar', s.map(l => l.glucose), '#0078D4')] };
}
function getWeightTrendData(vs) {
    const s = sortByDate(vs.filter(v => v.weight), 'record_date');
    return { labels: s.map(v => formatDate(v.record_date)), datasets: [ds('Weight (kg)', s.map(v => v.weight), '#6f42c1')] };
}
function getCholesterolTrendData(labs) {
    const s = sortByDate(labs.filter(l => l.cholesterol), 'test_date');
    return { labels: s.map(l => formatDate(l.test_date)), datasets: [ds('Total Cholesterol', s.map(l => l.cholesterol), '#20c997')] };
}
function getOxygenTrendData(vs) {
    const s = sortByDate(vs.filter(v => v.oxygen_saturation), 'record_date');
    return { labels: s.map(v => formatDate(v.record_date)), datasets: [ds('O₂ Saturation (%)', s.map(v => v.oxygen_saturation), '#17a2b8')] };
}

function updateTrendStatistics(filtered, param) {
    const valMap = {
        blood_pressure: filtered.vital_signs.map(v => v.blood_pressure_systolic).filter(Boolean),
        heart_rate:     filtered.vital_signs.map(v => v.heart_rate).filter(Boolean),
        glucose:        filtered.lab_results.map(l => l.glucose).filter(Boolean),
        weight:         filtered.vital_signs.map(v => v.weight).filter(Boolean),
        cholesterol:    filtered.lab_results.map(l => l.cholesterol).filter(Boolean),
        oxygen:         filtered.vital_signs.map(v => v.oxygen_saturation).filter(Boolean)
    };
    const vals = valMap[param] || [];
    setText('trendDataPoints', vals.length);
    setText('trendLastUpdated', new Date().toLocaleDateString());

    if (vals.length >= 2) {
        const mean = avg(vals);
        const sorted = [...vals].sort((a, b) => a - b);
        const median = sorted[Math.floor(sorted.length / 2)];
        const stdDev = calcStdDev(vals);
        const trend = vals[vals.length - 1] - vals[0];
        const dir = Math.abs(trend) < 0.1 ? 'Stable' : trend > 0 ? 'Increasing' : 'Decreasing';
        setText('trendDirection', dir);
        setText('correlationStrength', vals.length >= 5 ? 'Strong' : vals.length >= 3 ? 'Moderate' : 'Low');
        setText('statMean', mean.toFixed(1));
        setText('statMedian', median.toFixed(1));
        setText('statStdDev', stdDev.toFixed(1));
        setText('statRange', `${Math.min(...vals).toFixed(1)} – ${Math.max(...vals).toFixed(1)}`);
    } else {
        ['trendDirection','correlationStrength','statMean','statMedian','statStdDev','statRange'].forEach(id => setText(id, '--'));
    }
}

function updateCorrelationAnalysis(filtered) {
    const container = document.getElementById('correlationInsights');
    if (container) {
        const insights = [];
        if (filtered.vital_signs.length >= 3 && filtered.lab_results.length >= 2) insights.push({ icon: 'fas fa-heart', text: 'Blood pressure and stress levels often show correlation' });
        if (filtered.vital_signs.filter(v => v.weight).length >= 3) insights.push({ icon: 'fas fa-weight', text: 'Weight changes can affect blood pressure and glucose levels' });
        if (filtered.symptoms.length >= 3) insights.push({ icon: 'fas fa-thermometer', text: 'Symptoms often correlate with vital sign variations' });
        if (filtered.journal_entries.length >= 3) insights.push({ icon: 'fas fa-feather-alt', text: 'Mood and sleep quality can impact physical health metrics' });
        if (!insights.length) insights.push({ icon: 'fas fa-chart-line', text: 'Track more data to discover correlations between health parameters' });
        container.innerHTML = insights.map(i => `<div class="insight-item"><i class="${i.icon}"></i><span>${i.text}</span></div>`).join('');
    }

    const ctx = getCtx('correlationChart');
    if (!ctx) return;
    analyticsState.charts.correlation = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Blood Pressure', 'Heart Rate', 'Glucose', 'Weight', 'Oxygen'],
            datasets: [{ label: 'Correlation Strength', data: [0.82, 0.65, 0.58, 0.41, 0.25], backgroundColor: ['rgba(220,53,69,0.8)','rgba(40,167,69,0.8)','rgba(0,120,212,0.8)','rgba(111,66,193,0.8)','rgba(23,162,184,0.8)'] }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, max: 1, title: { display: true, text: 'Strength (0–1)' } } } }
    });
}

function updatePatternDetection(filtered) {
    const setText2 = (id, html) => { const el = document.getElementById(id); if (el) el.innerHTML = html; };
    setText2('seasonalPatterns', filtered.symptoms.length >= 5
        ? '<p>Based on your symptom tracking, monitor for seasonal variations and consider tracking more frequently during season changes.</p>'
        : '<p>Track symptoms regularly to identify seasonal patterns. Some conditions may worsen during specific seasons.</p>');
    setText2('timePatterns', filtered.vital_signs.length >= 7
        ? '<p>Regular vital signs tracking shows consistent patterns. Consider measuring at the same time each day for better comparison.</p>'
        : '<p>Consistent timing improves trend analysis. Try to record measurements at similar times each day.</p>');
    const enough = filtered.vital_signs.length >= 3 && (filtered.lab_results.length >= 2 || filtered.symptoms.length >= 3);
    setText2('relationshipPatterns', enough
        ? '<p>Your data shows potential relationships between health parameters. Continue tracking to identify specific patterns and triggers.</p>'
        : '<p>Track multiple health parameters to discover relationships. Patterns emerge when combining symptoms, vitals, and lab results.</p>');
}

// =============================================
// ===== TAB 3: RISK ASSESSMENT =====
// =============================================
async function loadRiskTab() {
    const riskScore = calculateOverallRiskScore();
    updateRiskLevel(riskScore);
    updateRiskFactors();
    setupRiskGaugeChart(riskScore);
    updateRiskCategories();
    generateActionPlan();
}

function calculateOverallRiskScore() {
    const items = [calcCVRisk(), calcDiabetesRisk(), calcHypertensionRisk(), calcObesityRisk(), calcRespiratoryRisk()];
    const total = items.reduce((s, i) => s + i.score, 0);
    const max   = items.reduce((s, i) => s + i.max, 0);
    return Math.min(100, Math.round(max > 0 ? (total / max) * 100 : 0));
}

function calcCVRisk() {
    const d = analyticsState.data; let s = 0; const max = 20;
    if (d.vital_signs.length) {
        const v = d.vital_signs[0];
        if (v.blood_pressure_systolic > 180) s += 10; else if (v.blood_pressure_systolic > 160) s += 7; else if (v.blood_pressure_systolic > 140) s += 5; else if (v.blood_pressure_systolic > 130) s += 3; else s += 1;
        if (v.heart_rate > 120) s += 5; else if (v.heart_rate > 100) s += 3; else s += 1;
    }
    if (d.lab_results.length && d.lab_results[0].cholesterol > 240) s += 5;
    return { score: Math.min(s, max), max };
}
function calcDiabetesRisk() {
    const d = analyticsState.data; let s = 0; const max = 15;
    const gLabs = d.lab_results.filter(l => l.glucose);
    if (gLabs.length) {
        const g = gLabs[0].glucose;
        if (g > 200) s += 10; else if (g > 126) s += 7; else if (g > 100) s += 4; else s += 1;
    }
    const hLabs = d.lab_results.filter(l => l.hba1c);
    if (hLabs.length) { if (hLabs[0].hba1c >= 6.5) s += 5; else if (hLabs[0].hba1c >= 5.7) s += 3; }
    return { score: Math.min(s, max), max };
}
function calcHypertensionRisk() {
    const d = analyticsState.data; let s = 0; const max = 15;
    if (d.vital_signs.length) {
        const v = d.vital_signs[0];
        if (v.blood_pressure_systolic > 180 || v.blood_pressure_diastolic > 120) s += 10;
        else if (v.blood_pressure_systolic > 160 || v.blood_pressure_diastolic > 100) s += 7;
        else if (v.blood_pressure_systolic > 140 || v.blood_pressure_diastolic > 90) s += 5;
        else if (v.blood_pressure_systolic > 130 || v.blood_pressure_diastolic > 85) s += 3;
        else s += 1;
    }
    return { score: Math.min(s, max), max };
}
function calcObesityRisk() {
    const wv = analyticsState.data.vital_signs.filter(v => v.weight && v.height); let s = 0; const max = 10;
    if (wv.length) {
        const bmi = wv[0].weight / ((wv[0].height / 100) ** 2);
        if (bmi >= 35) s += 8; else if (bmi >= 30) s += 6; else if (bmi >= 25) s += 4; else if (bmi >= 18.5) s += 1; else s += 2;
    }
    return { score: Math.min(s, max), max };
}
function calcRespiratoryRisk() {
    const d = analyticsState.data; let s = 0; const max = 10;
    const oVals = d.vital_signs.map(v => v.oxygen_saturation).filter(Boolean);
    if (oVals.length) {
        if (oVals[0] < 88) s += 8; else if (oVals[0] < 92) s += 5; else if (oVals[0] < 95) s += 2; else s += 1;
    }
    const respSym = d.symptoms.filter(sym => ['cough','breath','wheeze','chest'].some(w => (sym.symptom_name||'').toLowerCase().includes(w))).length;
    s += Math.min(2, respSym);
    return { score: Math.min(s, max), max };
}

function updateRiskLevel(score) {
    const level = score <= 25 ? 'LOW RISK' : score <= 50 ? 'MODERATE RISK' : score <= 75 ? 'HIGH RISK' : 'VERY HIGH RISK';
    const desc  = score <= 25 ? 'Excellent health with minimal risks. Continue maintaining your healthy lifestyle.' : score <= 50 ? 'Manageable risks with some areas for improvement. Regular monitoring recommended.' : score <= 75 ? 'Significant risks requiring attention. Consider consulting healthcare professionals.' : 'Critical risks detected. Urgent medical consultation recommended.';
    const color = getRiskColor(score);
    const lEl = document.getElementById('riskLevel');
    const dEl = document.getElementById('riskDescription');
    if (lEl) { lEl.textContent = level; lEl.style.color = color; }
    if (dEl) dEl.textContent = desc;
}

function updateRiskFactors() {
    const list = document.getElementById('riskFactorsList');
    if (!list) return;
    const d = analyticsState.data;
    const factors = [];
    if (d.vital_signs.length) {
        const v = d.vital_signs[0];
        if (v.blood_pressure_systolic > 140) factors.push('Elevated blood pressure');
        if (v.heart_rate > 100) factors.push('Elevated resting heart rate');
        if (v.oxygen_saturation && v.oxygen_saturation < 92) factors.push('Low oxygen saturation');
    }
    const gLabs = d.lab_results.filter(l => l.glucose);
    if (gLabs.length && gLabs[0].glucose > 126) factors.push('Elevated blood sugar levels');
    const wv = d.vital_signs.filter(v => v.weight && v.height);
    if (wv.length) {
        const bmi = wv[0].weight / ((wv[0].height / 100) ** 2);
        if (bmi >= 30) factors.push('Obesity (BMI ≥ 30)'); else if (bmi >= 25) factors.push('Overweight (BMI ≥ 25)');
    }
    if (d.medications.length > 3) factors.push('Multiple medications (potential interactions)');
    if (d.symptoms.filter(s => s.severity === 'High').length > 0) factors.push(`${d.symptoms.filter(s => s.severity === 'High').length} high-severity symptom(s) recorded`);
    if (!factors.length) factors.push('No significant risk factors identified');
    list.innerHTML = factors.map(f => `<li>${f}</li>`).join('');
}

function setupRiskGaugeChart(score) {
    const ctx = getCtx('riskGaugeChart');
    if (!ctx) return;
    analyticsState.charts.riskGauge = new Chart(ctx, {
        type: 'doughnut',
        data: { datasets: [{ data: [score, 100 - score], backgroundColor: [getRiskColor(score), '#f0f2f5'], borderWidth: 0 }] },
        options: { responsive: true, maintainAspectRatio: false, cutout: '78%', plugins: { legend: { display: false }, tooltip: { enabled: false } } }
    });
}

function getRiskColor(s) { return s <= 25 ? '#28a745' : s <= 50 ? '#ffc107' : s <= 75 ? '#fd7e14' : '#dc3545'; }

function updateRiskCategory(prefix, riskData) {
    const pct = Math.round((riskData.score / riskData.max) * 100);
    const color = getRiskColor(pct);
    const label = pct <= 25 ? 'Low' : pct <= 50 ? 'Moderate' : pct <= 75 ? 'High' : 'Very High';
    const scoreEl = document.getElementById(`${prefix}RiskScore`);
    const factorsEl = document.getElementById(`${prefix}RiskFactors`);
    const statusEl = document.getElementById(`${prefix}RiskStatus`);
    if (scoreEl) { scoreEl.textContent = `${pct}%`; scoreEl.style.color = color; }
    if (factorsEl) factorsEl.innerHTML = riskData.score > 0 ? `<p>${riskData.score} risk points identified from your data.</p>` : '<p>No significant risk factors detected.</p>';
    if (statusEl) { statusEl.textContent = label; statusEl.style.color = color; }
}

function updateRiskCategories() {
    updateRiskCategory('cv', calcCVRisk());
    updateRiskCategory('diabetes', calcDiabetesRisk());
    updateRiskCategory('hypertension', calcHypertensionRisk());
    updateRiskCategory('obesity', calcObesityRisk());
    updateRiskCategory('respiratory', calcRespiratoryRisk());

    // Mental health risk
    const d = analyticsState.data; let mS = 0;
    if (d.journal_entries.length) {
        const j = d.journal_entries[0];
        if (['Sad','Anxious','Stressed','Depressed'].includes(j.mood)) mS += 5;
        if (j.sleep_quality === 'Poor') mS += 3;
        if (j.energy_level === 'Low') mS += 2;
    }
    const mentalSym = d.symptoms.filter(s => ['anxiety','depress','stress','mood'].some(w => (s.symptom_name||'').toLowerCase().includes(w))).length;
    mS += mentalSym * 2;
    updateRiskCategory('mental', { score: Math.min(mS, 10), max: 10 });

    // Kidney health
    let kS = 0;
    const gLabs = d.lab_results.filter(l => l.glucose);
    if (gLabs.length && gLabs[0].glucose > 126) kS += 6;
    if (d.vital_signs.length && d.vital_signs[0].blood_pressure_systolic > 140) kS += 4;
    updateRiskCategory('kidney', { score: Math.min(kS, 10), max: 10 });
}

function generateActionPlan() {
    const container = document.getElementById('actionPlanContainer');
    if (!container) return;
    const actions = [];
    if (calcCVRisk().score > 5)          actions.push({ icon: 'fas fa-heart', title: 'Cardiovascular Health', items: ['Monitor blood pressure twice weekly','30 min cardio exercise, 5 days/week','Follow heart-healthy (Mediterranean) diet','Reduce sodium intake to <1500 mg daily'] });
    if (calcDiabetesRisk().score > 5)    actions.push({ icon: 'fas fa-tint', title: 'Blood Sugar Management', items: ['Regular glucose monitoring','Consistent carbohydrate intake','Target 5–10% weight loss if overweight','Quarterly diabetes specialist review'] });
    if (calcHypertensionRisk().score > 5) actions.push({ icon: 'fas fa-heartbeat', title: 'Blood Pressure Control', items: ['Weekly home BP monitoring','Strict medication adherence','Stress management techniques','Limit alcohol to ≤1 drink daily'] });
    if (calcObesityRisk().score > 3)     actions.push({ icon: 'fas fa-weight', title: 'Weight Management', items: ['500–750 calorie daily deficit','Strength training 2–3× per week','Portion control and meal tracking','Weekly weigh-ins'] });
    if (calcRespiratoryRisk().score > 3) actions.push({ icon: 'fas fa-lungs', title: 'Respiratory Health', items: ['Monitor SpO₂ when symptomatic','Practice deep breathing exercises daily','Avoid smoking and secondhand smoke','Consider pulmonary function test'] });
    actions.push({ icon: 'fas fa-spa', title: 'General Wellness', items: ['7–9 hours of quality sleep nightly','Daily mindfulness practice (10 min)','Regular social connection','Annual comprehensive check-up'] });

    container.innerHTML = actions.map(a => `
        <div class="action-card">
            <div class="action-header">
                <div class="action-icon"><i class="${a.icon}"></i></div>
                <h4>${a.title}</h4>
            </div>
            <ul class="action-items">${a.items.map(i => `<li>${i}</li>`).join('')}</ul>
        </div>`).join('');
}

// =============================================
// ===== TAB 4: WELLNESS SCORE =====
// =============================================
async function loadWellnessTab() {
    setupWellnessEvolutionChart();
    updateWellnessDimensions();
    updateSleepAndMoodAnalysis();
    setupWellnessGoals();
}

function setupWellnessEvolutionChart() {
    const entries = [...analyticsState.data.journal_entries]
        .filter(e => e.entry_date)
        .sort((a, b) => new Date(a.entry_date) - new Date(b.entry_date));

    const canvas = document.getElementById('wellnessEvolutionChart');
    if (!canvas) return;
    const parent = canvas.parentElement;

    if (!entries.length) {
        parent.innerHTML = `<div class="no-data-msg"><i class="fas fa-chart-line"></i><p>Start adding journal entries to see your wellness evolution</p></div>`;
        return;
    }

    const scores = entries.map(e => {
        let s = 50;
        if (e.sleep_quality === 'Excellent') s += 20; else if (e.sleep_quality === 'Good') s += 10; else if (e.sleep_quality === 'Poor') s -= 10;
        if (e.energy_level === 'High') s += 15; else if (e.energy_level === 'Low') s -= 15;
        if (['Happy','Calm','Energetic'].includes(e.mood)) s += 15; else if (['Sad','Anxious','Stressed'].includes(e.mood)) s -= 15;
        if (e.health_rating) s += (e.health_rating - 5) * 5;
        return Math.max(0, Math.min(100, s));
    });

    destroyChart('wellnessEvolutionChart');
    const ctx = canvas.getContext('2d');
    analyticsState.charts.wellnessEvolution = new Chart(ctx, {
        type: 'line',
        data: { labels: entries.map(e => formatDate(e.entry_date)), datasets: [{ label: 'Wellness Score', data: scores, borderColor: '#1e3c72', backgroundColor: 'rgba(30,60,114,0.1)', borderWidth: 3, fill: true, tension: 0.4 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { min: 0, max: 100, title: { display: true, text: 'Score' } } } }
    });
}

function calcPhysicalHealth() {
    let s = 70;
    const d = analyticsState.data;
    if (d.vital_signs.length) {
        const v = d.vital_signs[0];
        if (v.blood_pressure_systolic <= 120) s += 10;
        if (v.heart_rate >= 60 && v.heart_rate <= 100) s += 10;
        if (v.oxygen_saturation && v.oxygen_saturation >= 95) s += 10;
    }
    const sevenAgo = new Date(); sevenAgo.setDate(sevenAgo.getDate() - 7);
    s -= d.symptoms.filter(sym => new Date(sym.symptom_date) >= sevenAgo).length * 5;
    return Math.max(0, Math.min(100, s));
}
function calcSleepScore() {
    let s = 75;
    if (analyticsState.data.journal_entries.length) {
        const j = analyticsState.data.journal_entries[0];
        if (j.sleep_quality === 'Excellent') s += 20; else if (j.sleep_quality === 'Good') s += 10; else if (j.sleep_quality === 'Fair') s += 5; else if (j.sleep_quality === 'Poor') s -= 15;
    }
    return Math.max(0, Math.min(100, s));
}
function calcStressScore() {
    let s = 70;
    const stressSym = analyticsState.data.symptoms.filter(sym => ['stress','anxiety','tension','headache'].some(w => (sym.symptom_name||'').toLowerCase().includes(w))).length;
    s -= stressSym * 5;
    if (analyticsState.data.journal_entries.length) {
        const j = analyticsState.data.journal_entries[0];
        if (['Stressed','Anxious'].includes(j.mood)) s -= 10;
    }
    return Math.max(0, Math.min(100, s));
}
function calcFitnessScore() {
    let s = 65;
    const wv = analyticsState.data.vital_signs.filter(v => v.weight && v.height);
    if (wv.length) {
        const bmi = wv[0].weight / ((wv[0].height / 100) ** 2);
        if (bmi >= 18.5 && bmi <= 24.9) s += 20; else if (bmi >= 25 && bmi <= 29.9) s += 10;
    }
    return Math.min(100, s);
}
function calcNutritionW() {
    let s = 70;
    if (analyticsState.data.lab_results.length) {
        const l = analyticsState.data.lab_results[0];
        if (l.glucose && l.glucose <= 100) s += 15;
        if (l.cholesterol && l.cholesterol < 200) s += 15;
    }
    return Math.min(100, s);
}

function updateWellnessDimensions() {
    const dims = [
        ['physicalHealth', calcPhysicalHealth()],
        ['mentalWellness', calcMentalWellnessScore()],
        ['nutrition',      calcNutritionW()],
        ['fitness',        calcFitnessScore()],
        ['sleep',          calcSleepScore()],
        ['stress',         calcStressScore()]
    ];
    dims.forEach(([id, score]) => {
        setText(`${id}Score`, `${score}%`);
        const bar = document.getElementById(`${id}Progress`);
        if (bar) { bar.style.width = `${score}%`; bar.style.background = score >= 80 ? 'linear-gradient(90deg,#4CAF50,#8BC34A)' : score >= 60 ? 'linear-gradient(90deg,#FFC107,#FF9800)' : 'linear-gradient(90deg,#F44336,#E91E63)'; }
    });
    updateDimensionTips();
}

function updateDimensionTips() {
    const tips = {
        physicalHealthTips: '• Regular exercise improves cardiovascular health<br>• Annual check-ups help detect issues early<br>• Stay hydrated and maintain balanced nutrition',
        mentalWellnessTips: '• Practice mindfulness and meditation daily<br>• Maintain social connections<br>• Seek professional support when needed',
        nutritionTips:      '• Aim for 5+ servings of fruits/vegetables daily<br>• Limit processed foods and added sugars<br>• Stay adequately hydrated',
        fitnessTips:        '• 150 minutes of moderate exercise weekly<br>• Include strength training 2–3×/week<br>• Stay active throughout the day',
        sleepTips:          '• Aim for 7–9 hours of quality sleep<br>• Maintain consistent sleep schedule<br>• Create a relaxing bedtime routine',
        stressTips:         '• Practice deep breathing exercises<br>• Take regular breaks during work<br>• Engage in hobbies and leisure activities'
    };
    Object.entries(tips).forEach(([id, html]) => { const el = document.getElementById(id); if (el) el.innerHTML = html; });
}

function updateSleepAndMoodAnalysis() {
    const entries = analyticsState.data.journal_entries;
    const sleepEl = document.getElementById('sleepAnalysis');
    const moodEl = document.getElementById('moodAnalysis');

    if (!entries.length) {
        if (sleepEl) sleepEl.innerHTML = '<p>Add journal entries to see sleep analysis.</p>';
        if (moodEl) moodEl.innerHTML = '<p>Add journal entries to see mood analysis.</p>';
        return;
    }

    const sleepCounts = { Excellent: 0, Good: 0, Fair: 0, Poor: 0 };
    const moodCounts = {};
    entries.forEach(e => {
        if (e.sleep_quality && sleepCounts.hasOwnProperty(e.sleep_quality)) sleepCounts[e.sleep_quality]++;
        if (e.mood) moodCounts[e.mood] = (moodCounts[e.mood] || 0) + 1;
    });

    if (sleepEl) {
        const best = Object.entries(sleepCounts).reduce((a, b) => a[1] >= b[1] ? a : b)[0];
        sleepEl.innerHTML = `<p><strong>Most Common:</strong> ${best}</p>` +
            Object.entries(sleepCounts).map(([q, c]) => `<div class="dist-item"><span class="dist-label">${q}</span><div class="dist-bar-wrap"><div class="dist-bar" style="width:${entries.length ? (c/entries.length*100).toFixed(0) : 0}%;background:#1e3c72"></div><span class="dist-count">${c}</span></div></div>`).join('');
    }
    if (moodEl && Object.keys(moodCounts).length) {
        const top = Object.entries(moodCounts).reduce((a, b) => a[1] > b[1] ? a : b)[0];
        moodEl.innerHTML = `<p><strong>Most Common Mood:</strong> ${top}</p><p><strong>Total Entries:</strong> ${Object.values(moodCounts).reduce((a,b)=>a+b,0)}</p>` +
            Object.entries(moodCounts).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([m, c]) => `<div class="dist-item"><span class="dist-label">${m}</span><div class="dist-bar-wrap"><div class="dist-bar" style="width:${entries.length?(c/entries.length*100).toFixed(0):0}%;background:#764ba2"></div><span class="dist-count">${c}</span></div></div>`).join('');
    } else if (moodEl) {
        moodEl.innerHTML = '<p>No mood data in journal entries yet.</p>';
    }
}

function setupWellnessGoals() {
    const container = document.getElementById('wellnessGoalsContainer');
    if (!container) return;
    const goals = [
        { title: 'Physical Activity',    icon: 'fas fa-running', current: calcPhysicalHealth(), target: 90, actions: ['10,000 steps daily', 'Strength training 2×/week', 'Active weekends'] },
        { title: 'Sleep Quality',        icon: 'fas fa-bed',     current: calcSleepScore(),     target: 90, actions: ['Consistent bedtime', 'Screen-free hour before bed', 'Relaxing bedtime routine'] },
        { title: 'Stress Management',    icon: 'fas fa-spa',     current: calcStressScore(),    target: 85, actions: ['Daily mindfulness practice', 'Regular breaks during work', 'Hobby time weekly'] },
        { title: 'Nutritional Balance',  icon: 'fas fa-apple-alt',current: calcNutritionW(),   target: 85, actions: ['5+ fruit/veg servings daily', 'Limit processed foods', 'Track daily water intake'] }
    ];
    container.innerHTML = goals.map(g => {
        const pct = Math.min(100, (g.current / g.target) * 100);
        return `<div class="goal-card">
            <div class="goal-header">
                <div class="goal-icon"><i class="${g.icon}"></i></div>
                <div class="goal-info"><h4>${g.title}</h4><span class="goal-pct">${g.current}% / Target: ${g.target}%</span></div>
            </div>
            <div class="goal-progress-wrap"><div class="goal-progress-bar" style="width:${pct}%;background:${pct>=100?'#28a745':pct>=70?'#ffc107':'#dc3545'}"></div></div>
            <ul class="goal-actions">${g.actions.map(a => `<li>${a}</li>`).join('')}</ul>
        </div>`;
    }).join('');
}

// =============================================
// ===== TAB 5: REPORTS =====
// =============================================
async function loadReportsTab() {
    const end = new Date(), start = new Date();
    start.setDate(start.getDate() - 30);
    const sEl = document.getElementById('reportStartDate');
    const eEl = document.getElementById('reportEndDate');
    if (sEl && !sEl.value) sEl.value = start.toISOString().split('T')[0];
    if (eEl && !eEl.value) eEl.value = end.toISOString().split('T')[0];
}

function generateHealthReport() {
    const type  = document.getElementById('reportType')?.value || 'summary';
    const start = document.getElementById('reportStartDate')?.value;
    const end   = document.getElementById('reportEndDate')?.value;
    if (!start || !end) { showMessage('error', 'Please select both start and end dates'); return; }

    const d = analyticsState.data;
    const inRange = (date) => date && new Date(date) >= new Date(start) && new Date(date) <= new Date(end);
    const filtered = {
        vital_signs:     d.vital_signs.filter(v => inRange(v.record_date)),
        lab_results:     d.lab_results.filter(l => inRange(l.test_date)),
        medications:     d.medications.filter(m => inRange(m.start_date)),
        symptoms:        d.symptoms.filter(s => inRange(s.symptom_date)),
        journal_entries: d.journal_entries.filter(j => inRange(j.entry_date))
    };

    const generators = { summary: genSummaryReport, vitals: genVitalsReport, labs: genLabReport, medications: genMedReport, symptoms: genSymptomReport, wellness: genWellnessReport };
    const html = (generators[type] || generators.summary)(filtered, start, end);

    const el = document.getElementById('reportContent');
    if (el) { el.innerHTML = html; el.scrollIntoView({ behavior: 'smooth' }); }
    showMessage('success', 'Report generated successfully!');
}

function reportHeader(title, start, end) {
    return `<div class="rpt-header"><h3>${title}</h3><p class="rpt-period">${formatDate(start)} — ${formatDate(end)}</p></div>`;
}
function rptStat(label, value) { return `<div class="rpt-stat-item"><span class="rpt-stat-label">${label}</span><span class="rpt-stat-value">${value}</span></div>`; }

function genSummaryReport(f, start, end) {
    const sys = f.vital_signs.map(v => v.blood_pressure_systolic).filter(Boolean);
    const dia = f.vital_signs.map(v => v.blood_pressure_diastolic).filter(Boolean);
    const hr  = f.vital_signs.map(v => v.heart_rate).filter(Boolean);
    const glu = f.lab_results.map(l => l.glucose).filter(Boolean);
    const hba = f.lab_results.map(l => l.hba1c).filter(Boolean);
    const chol= f.lab_results.map(l => l.cholesterol).filter(Boolean);
    const score = (() => {
        let s = 75;
        if (f.vital_signs.length) { const v = f.vital_signs[0]; if (v.blood_pressure_systolic <= 120) s += 10; if (v.heart_rate >= 60 && v.heart_rate <= 100) s += 5; }
        if (f.journal_entries.length) { const j = f.journal_entries[0]; if (['Good','Excellent'].includes(j.sleep_quality)) s += 5; if (j.energy_level === 'High') s += 5; }
        return Math.max(0, Math.min(100, s));
    })();
    const scoreColor = score >= 85 ? '#28a745' : score >= 70 ? '#20c997' : score >= 50 ? '#ffc107' : '#dc3545';
    const recs = [];
    if (!f.vital_signs.length) recs.push('Start tracking vital signs regularly');
    if (!f.lab_results.length) recs.push('Schedule regular lab tests');
    if (!f.journal_entries.length) recs.push('Keep a daily health journal');
    if (glu.length && glu[0] > 126) recs.push('Monitor blood glucose and maintain a balanced diet');
    if (sys.length && sys[0] > 140) recs.push('Monitor blood pressure and reduce sodium intake');
    if (!recs.length) recs.push('Continue your current health maintenance routine');

    return `${reportHeader('Comprehensive Health Summary', start, end)}
    <div class="rpt-grid">
        <div class="rpt-section"><h4><i class="fas fa-heartbeat"></i> Vital Signs</h4>${rptStat('Blood Pressure', sys.length&&dia.length ? `${Math.round(avg(sys))}/${Math.round(avg(dia))} mmHg (avg)` : 'No data')}${rptStat('Heart Rate', hr.length ? `${Math.round(avg(hr))} bpm (avg)` : 'No data')}${rptStat('Readings', f.vital_signs.length)}</div>
        <div class="rpt-section"><h4><i class="fas fa-flask"></i> Lab Results</h4>${rptStat('Glucose (avg)', glu.length ? `${Math.round(avg(glu))} mg/dL` : 'No data')}${rptStat('HbA1c (avg)', hba.length ? `${avg(hba).toFixed(1)}%` : 'No data')}${rptStat('Cholesterol (avg)', chol.length ? `${Math.round(avg(chol))} mg/dL` : 'No data')}</div>
    </div>
    <div class="rpt-section rpt-score-section"><h4><i class="fas fa-chart-line"></i> Period Health Score</h4><div class="rpt-score-wrap"><div class="rpt-score-circle" style="background:${scoreColor}">${score}<span>/100</span></div><div class="rpt-score-desc">${score >= 85 ? 'Excellent — keep it up!' : score >= 70 ? 'Good — maintain your habits.' : score >= 50 ? 'Fair — consider lifestyle improvements.' : 'Needs attention — consult a healthcare provider.'}</div></div></div>
    <div class="rpt-section"><h4><i class="fas fa-stethoscope"></i> Recommendations</h4><ul class="rpt-recs">${recs.map(r => `<li>${r}</li>`).join('')}</ul></div>`;
}

function genVitalsReport(f, start, end) {
    if (!f.vital_signs.length) return `${reportHeader('Vital Signs Report', start, end)}<div class="rpt-empty"><i class="fas fa-heartbeat"></i><p>No vital signs recorded in the selected period.</p></div>`;
    return `${reportHeader('Vital Signs Report', start, end)}
    <div class="rpt-table-wrap"><table class="rpt-table"><thead><tr><th>Date</th><th>Blood Pressure</th><th>Heart Rate</th><th>Temperature</th><th>O₂ Sat</th><th>Weight</th></tr></thead>
    <tbody>${f.vital_signs.map(v => `<tr><td>${formatDate(v.record_date)}</td><td>${v.blood_pressure_systolic||'--'}/${v.blood_pressure_diastolic||'--'}</td><td>${v.heart_rate ? v.heart_rate+' bpm' : 'N/A'}</td><td>${v.temperature ? v.temperature+'°C' : 'N/A'}</td><td>${v.oxygen_saturation ? v.oxygen_saturation+'%' : 'N/A'}</td><td>${v.weight ? v.weight+' kg' : 'N/A'}</td></tr>`).join('')}</tbody></table></div>`;
}

function genLabReport(f, start, end) {
    if (!f.lab_results.length) return `${reportHeader('Lab Results Report', start, end)}<div class="rpt-empty"><i class="fas fa-flask"></i><p>No lab results recorded in the selected period.</p></div>`;
    return `${reportHeader('Lab Results Report', start, end)}
    <div class="rpt-table-wrap"><table class="rpt-table"><thead><tr><th>Test Name</th><th>Date</th><th>Glucose (mg/dL)</th><th>HbA1c (%)</th><th>Cholesterol (mg/dL)</th><th>Notes</th></tr></thead>
    <tbody>${f.lab_results.map(l => `<tr><td>${l.test_name||l.test_type||'Lab Test'}</td><td>${formatDate(l.test_date)}</td><td>${l.glucose||'N/A'}</td><td>${l.hba1c||'N/A'}</td><td>${l.cholesterol||'N/A'}</td><td>${l.notes||'—'}</td></tr>`).join('')}</tbody></table></div>`;
}

function genMedReport(f, start, end) {
    if (!f.medications.length) return `${reportHeader('Medication Report', start, end)}<div class="rpt-empty"><i class="fas fa-pills"></i><p>No medications recorded in the selected period.</p></div>`;
    const active = f.medications.filter(m => m.status === 'active');
    const adherence = Math.round(((active.length + f.medications.filter(m=>m.status==='completed').length) / f.medications.length) * 100);
    return `${reportHeader('Medication Report', start, end)}
    <div class="rpt-adherence"><strong>Adherence Rate: ${adherence}%</strong><div class="rpt-progress"><div class="rpt-progress-bar" style="width:${adherence}%;background:${adherence>=80?'#28a745':adherence>=60?'#ffc107':'#dc3545'}"></div></div></div>
    <div class="rpt-table-wrap"><table class="rpt-table"><thead><tr><th>Medication</th><th>Dosage</th><th>Frequency</th><th>Start Date</th><th>Status</th></tr></thead>
    <tbody>${f.medications.map(m => `<tr><td>${m.medication_name||'Unknown'}</td><td>${m.dosage||'N/A'}</td><td>${m.frequency||'N/A'}</td><td>${formatDate(m.start_date)}</td><td><span class="rpt-badge ${m.status}">${m.status||'N/A'}</span></td></tr>`).join('')}</tbody></table></div>`;
}

function genSymptomReport(f, start, end) {
    if (!f.symptoms.length) return `${reportHeader('Symptom Analysis Report', start, end)}<div class="rpt-empty"><i class="fas fa-thermometer"></i><p>No symptoms recorded in the selected period.</p></div>`;
    const groups = {};
    f.symptoms.forEach(s => { const n = s.symptom_name||'Unknown'; if (!groups[n]) groups[n] = []; groups[n].push(s); });
    const sevMap = { Low: 1, Moderate: 2, High: 3 };
    return `${reportHeader('Symptom Analysis Report', start, end)}
    ${rptStat('Total Symptoms', f.symptoms.length)}${rptStat('Unique Symptoms', Object.keys(groups).length)}${rptStat('High Severity', f.symptoms.filter(s=>s.severity==='High').length)}
    <div class="rpt-table-wrap"><table class="rpt-table"><thead><tr><th>Symptom</th><th>Frequency</th><th>Avg Severity</th><th>Most Recent</th></tr></thead>
    <tbody>${Object.entries(groups).map(([name, syms]) => {
        const avgSev = avg(syms.map(s=>sevMap[s.severity]||2));
        const label  = avgSev >= 2.5 ? 'High' : avgSev >= 1.5 ? 'Moderate' : 'Low';
        const latest = syms.sort((a,b)=>new Date(b.symptom_date)-new Date(a.symptom_date))[0];
        return `<tr><td>${name}</td><td>${syms.length}</td><td><span class="sev-badge ${label.toLowerCase()}">${label}</span></td><td>${formatDate(latest.symptom_date)}</td></tr>`;
    }).join('')}</tbody></table></div>`;
}

function genWellnessReport(f, start, end) {
    if (!f.journal_entries.length) return `${reportHeader('Wellness Report', start, end)}<div class="rpt-empty"><i class="fas fa-spa"></i><p>No journal entries recorded in the selected period.</p></div>`;
    const sleepC = { Excellent:0,Good:0,Fair:0,Poor:0 };
    const moodC  = {};
    let ratingSum = 0, ratingCt = 0;
    f.journal_entries.forEach(j => {
        if (j.sleep_quality && sleepC.hasOwnProperty(j.sleep_quality)) sleepC[j.sleep_quality]++;
        if (j.mood) moodC[j.mood] = (moodC[j.mood]||0) + 1;
        if (j.health_rating) { ratingSum += j.health_rating; ratingCt++; }
    });
    const topMood = Object.keys(moodC).length ? Object.entries(moodC).reduce((a,b)=>a[1]>b[1]?a:b)[0] : 'N/A';
    return `${reportHeader('Wellness Report', start, end)}
    <div class="rpt-grid">${rptStat('Total Entries', f.journal_entries.length)}${rptStat('Avg Health Rating', ratingCt ? `${(ratingSum/ratingCt).toFixed(1)}/10` : 'N/A')}${rptStat('Most Common Mood', topMood)}${rptStat('Good/Excellent Sleep', sleepC.Excellent+sleepC.Good)}</div>
    <div class="rpt-section"><h4>Sleep Quality Distribution</h4>${Object.entries(sleepC).map(([q,c])=>`<div class="dist-item"><span class="dist-label">${q}</span><div class="dist-bar-wrap"><div class="dist-bar" style="width:${f.journal_entries.length?(c/f.journal_entries.length*100).toFixed(0):0}%;background:#1e3c72"></div><span class="dist-count">${c}</span></div></div>`).join('')}</div>`;
}

// =============================================
// ===== TAB 6: AI INSIGHTS =====
// =============================================
async function loadInsightsTab() {
    await generateInsights();
    updateDataCompleteness();
}

async function generateInsights() {
    const container = document.getElementById('insightsContainer');
    if (container) container.innerHTML = `<div class="insight-loading"><i class="fas fa-brain fa-spin"></i><p>Analyzing your health data to generate insights...</p></div>`;
    const insights = buildInsights();
    displayInsights(insights);
}

function buildInsights() {
    const d = analyticsState.data;
    const insights = [];
    const score = calculateHealthScore();
    const scoreColor = score >= 85 ? '#28a745' : score >= 70 ? '#20c997' : score >= 50 ? '#ffc107' : '#dc3545';

    // Overall
    insights.push({ type: score >= 70 ? 'success' : 'warning', title: 'Overall Health Assessment', icon: 'fas fa-heartbeat', bullets: [`Health Score: <strong>${score}/100</strong>`, score >= 85 ? 'Excellent status — continue your healthy lifestyle!' : score >= 70 ? 'Good status — maintain current habits and monitor key metrics.' : score >= 50 ? 'Fair status — lifestyle improvements recommended.' : 'Needs attention — consult a healthcare provider soon.'] });

    // Vital signs
    if (d.vital_signs.length >= 2) {
        const v = d.vital_signs[0];
        const sys = d.vital_signs.map(x => x.blood_pressure_systolic).filter(Boolean);
        const trend = sys.length >= 2 ? (sys[0] > sys[1] ? 'increasing ↑' : sys[0] < sys[1] ? 'improving ↓' : 'stable →') : 'stable';
        const bullets = [`Latest BP: <strong>${v.blood_pressure_systolic||'--'}/${v.blood_pressure_diastolic||'--'} mmHg</strong>`, `Blood pressure trend: <strong>${trend}</strong>`];
        if (v.blood_pressure_systolic > 140) bullets.push('⚠️ Elevated BP — reduce sodium, manage stress, consult provider.');
        if (v.heart_rate > 100) bullets.push('⚠️ Elevated resting HR — ensure adequate hydration and rest.');
        if (v.oxygen_saturation && v.oxygen_saturation < 95) bullets.push('⚠️ SpO₂ below optimal — practice deep breathing, see provider if persistent.');
        insights.push({ type: v.blood_pressure_systolic > 140 ? 'warning' : 'info', title: 'Vital Signs Analysis', icon: 'fas fa-heartbeat', bullets });
    }

    // Lab results
    if (d.lab_results.length > 0) {
        const l = d.lab_results[0];
        const bullets = [];
        if (l.glucose) bullets.push(`Glucose: <strong>${l.glucose} mg/dL</strong> — ${l.glucose <= 100 ? 'Normal ✅' : l.glucose <= 126 ? 'Pre-diabetes range ⚠️' : 'Elevated — monitor closely ⚠️'}`);
        if (l.hba1c) bullets.push(`HbA1c: <strong>${l.hba1c}%</strong> — ${l.hba1c < 5.7 ? 'Normal ✅' : l.hba1c < 6.5 ? 'Pre-diabetes range ⚠️' : 'Diabetes range 🚨'}`);
        if (l.cholesterol) bullets.push(`Cholesterol: <strong>${l.cholesterol} mg/dL</strong> — ${l.cholesterol < 200 ? 'Desirable ✅' : l.cholesterol < 240 ? 'Borderline ⚠️' : 'High ⚠️'}`);
        if (!bullets.length) bullets.push('Continue with regular lab testing as recommended by your provider.');
        const bad = (l.glucose > 126) || (l.hba1c && l.hba1c >= 6.5) || (l.cholesterol > 240);
        insights.push({ type: bad ? 'warning' : 'success', title: 'Lab Results Analysis', icon: 'fas fa-flask', bullets });
    }

    // Symptoms
    if (d.symptoms.length > 0) {
        const thirtyAgo = new Date(); thirtyAgo.setDate(thirtyAgo.getDate() - 30);
        const recent = d.symptoms.filter(s => new Date(s.symptom_date) >= thirtyAgo);
        const high   = recent.filter(s => s.severity === 'High');
        const bullets = [`${recent.length} symptom(s) recorded in the last 30 days.`];
        if (high.length) bullets.push(`⚠️ ${high.length} high-severity symptom(s) — seek medical attention if persistent.`);
        const names = {};
        recent.forEach(s => { if (s.symptom_name) names[s.symptom_name] = (names[s.symptom_name]||0)+1; });
        const frequent = Object.entries(names).filter(([,c])=>c>=2).map(([n])=>n);
        if (frequent.length) bullets.push(`Frequent symptoms: <strong>${frequent.join(', ')}</strong> — discuss with your healthcare provider.`);
        insights.push({ type: high.length > 0 ? 'warning' : 'info', title: 'Symptom Pattern Analysis', icon: 'fas fa-thermometer', bullets });
    }

    // Medications
    if (d.medications.length > 0) {
        const active = d.medications.filter(m => m.status === 'active');
        const adherence = Math.round((active.length / d.medications.length) * 100);
        insights.push({ type: adherence >= 80 ? 'success' : 'warning', title: 'Medication Adherence', icon: 'fas fa-pills', bullets: [`Adherence rate: <strong>${adherence}%</strong>`, adherence >= 80 ? 'Excellent — keep it up!' : 'Consider setting reminders to improve consistency.', active.length > 3 ? `Taking ${active.length} active medications — periodic review recommended.` : null].filter(Boolean) });
    }

    // Wellness
    if (d.journal_entries.length >= 3) {
        const j = d.journal_entries[0];
        const bullets = [];
        if (j.sleep_quality) bullets.push(`Latest sleep quality: <strong>${j.sleep_quality}</strong>${j.sleep_quality==='Poor' ? ' — improve your sleep hygiene.' : ' ✅'}`);
        if (j.energy_level) bullets.push(`Energy level: <strong>${j.energy_level}</strong>${j.energy_level==='Low' ? ' — consider dietary adjustments and regular exercise.' : ' ✅'}`);
        if (j.mood) bullets.push(`Mood: <strong>${j.mood}</strong>${['Sad','Anxious','Stressed'].includes(j.mood) ? ' — consider stress-management techniques.' : ' ✅'}`);
        if (bullets.length) insights.push({ type: j.sleep_quality==='Poor'||j.energy_level==='Low' ? 'warning' : 'info', title: 'Wellness & Lifestyle Insights', icon: 'fas fa-spa', bullets });
    }

    // Personalized tip
    insights.push({ type: 'info', title: 'General Wellness Tips', icon: 'fas fa-lightbulb', bullets: ['7–9 hours of quality sleep each night', '150 minutes moderate exercise per week', 'Stay hydrated (8+ glasses of water daily)', 'Schedule an annual comprehensive health check-up'] });

    return insights;
}

function displayInsights(insights) {
    const container = document.getElementById('insightsContainer');
    if (!container) return;
    const typeIcon = { success: 'fas fa-check-circle', warning: 'fas fa-exclamation-triangle', info: 'fas fa-info-circle' };
    container.innerHTML = `
        <div class="insights-intro"><h3><i class="fas fa-lightbulb"></i> AI-Generated Health Insights</h3><p>${insights.length} personalized insights based on your health data</p></div>
        <div class="insights-list">${insights.map(ins => `
            <div class="insight-card insight-${ins.type}">
                <div class="insight-card-header">
                    <div class="insight-card-icon ${ins.type}"><i class="${ins.icon}"></i></div>
                    <div class="insight-card-title">${ins.title}</div>
                    <i class="${typeIcon[ins.type]} insight-badge-icon insight-${ins.type}-color"></i>
                </div>
                <ul class="insight-bullets">${ins.bullets.map(b => `<li>${b}</li>`).join('')}</ul>
            </div>`).join('')}
        </div>`;
}

function updateDataCompleteness() {
    const d = analyticsState.data;
    const categories = [
        { id: 'vitalSigns',  label: 'Vital Signs',     count: d.vital_signs.length,     target: 10 },
        { id: 'labResults',  label: 'Lab Results',      count: d.lab_results.length,     target: 5  },
        { id: 'medications', label: 'Medications',      count: d.medications.length,     target: 5  },
        { id: 'symptoms',    label: 'Symptoms',         count: d.symptoms.length,        target: 10 },
        { id: 'journal',     label: 'Journal Entries',  count: d.journal_entries.length, target: 10 }
    ];

    categories.forEach(c => {
        const pct = Math.min(100, Math.round((c.count / c.target) * 100));
        const bar = document.getElementById(`${c.id}Progress`);
        const pctEl = document.getElementById(`${c.id}Percentage`);
        if (bar) { bar.style.width = `${pct}%`; bar.style.background = pct >= 80 ? '#28a745' : pct >= 50 ? '#ffc107' : '#dc3545'; }
        if (pctEl) pctEl.textContent = `${pct}%`;
    });

    // Donut chart
    const ctx = getCtx('dataCompletenessChart');
    if (!ctx) return;
    const total = categories.reduce((s, c) => s + c.count, 0);
    analyticsState.charts.dataCompleteness = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: categories.map(c => c.label),
            datasets: [{ data: categories.map(c => Math.max(c.count, 0.1)), backgroundColor: ['#1e3c72','#2a5298','#4a6fff','#764ba2','#17a2b8'], borderWidth: 2, borderColor: '#fff' }]
        },
        options: { responsive: true, maintainAspectRatio: false, cutout: '65%', plugins: { legend: { position: 'bottom', labels: { font: { size: 11 } } } } }
    });
}

// =============================================
// ===== EXPORT =====
// =============================================
async function exportAnalyticsData(format) {
    const user = window.appState?.currentUser;
    const d = analyticsState.data;
    const userData = { user, ...d, generated: new Date().toISOString() };
    let data, filename, mime;

    if (format === 'pdf') { showMessage('info', 'PDF export requires a PDF library. Export as CSV or JSON instead.'); return; }
    if (format === 'csv') {
        let csv = 'Health Data Export\n\n';
        csv += `User Email,${user?.email||''}\n\n`;
        csv += 'Vital Signs\nDate,Systolic,Diastolic,Heart Rate,Temperature,Oxygen,Weight,Height\n';
        d.vital_signs.forEach(v => csv += `${v.record_date||''},${v.blood_pressure_systolic||''},${v.blood_pressure_diastolic||''},${v.heart_rate||''},${v.temperature||''},${v.oxygen_saturation||''},${v.weight||''},${v.height||''}\n`);
        csv += '\nLab Results\nDate,Test Name,Glucose,HbA1c,Cholesterol\n';
        d.lab_results.forEach(l => csv += `${l.test_date||''},${l.test_name||''},${l.glucose||''},${l.hba1c||''},${l.cholesterol||''}\n`);
        csv += '\nMedications\nName,Dosage,Frequency,Start,Status\n';
        d.medications.forEach(m => csv += `${m.medication_name||''},${m.dosage||''},${m.frequency||''},${m.start_date||''},${m.status||''}\n`);
        data = csv; filename = `health-data-${new Date().toISOString().split('T')[0]}.csv`; mime = 'text/csv';
    } else {
        data = JSON.stringify(userData, null, 2); filename = `health-data-${new Date().toISOString().split('T')[0]}.json`; mime = 'application/json';
    }

    const blob = new Blob([data], { type: mime });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement('a'), { href: url, download: filename });
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    showMessage('success', `Exported as ${format.toUpperCase()} successfully!`);
}

// =============================================
// ===== UTILITY HELPERS =====
// =============================================
function avg(arr) { return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0; }
function calcStdDev(vals) {
    if (vals.length < 2) return 0;
    const mean = avg(vals);
    return Math.sqrt(vals.map(v => (v - mean) ** 2).reduce((a, b) => a + b, 0) / vals.length);
}
function setText(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }
function updateTrendEl(id, vals) {
    const el = document.getElementById(id); if (!el || vals.length < 2) return;
    const diff = vals[0] - vals[1];
    el.textContent = Math.abs(diff) < 0.1 ? '→' : diff > 0 ? '📈' : '📉';
    el.style.color = Math.abs(diff) < 0.1 ? '#6c757d' : diff > 0 ? '#dc3545' : '#28a745';
}
function formatDate(str) {
    if (!str) return 'N/A';
    try { return new Date(str).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }); }
    catch { return 'Invalid date'; }
}
function showLoading() { const el = document.getElementById('loading'); if (el) el.style.display = 'flex'; }
function hideLoading() { const el = document.getElementById('loading'); if (el) el.style.display = 'none'; }
function showMessage(type, message) {
    const container = document.getElementById('messages');
    if (!container) return;
    const el = document.createElement('div');
    el.className = `message ${type}`;
    const icons = { success: 'check-circle', error: 'exclamation-circle', warning: 'exclamation-triangle', info: 'info-circle' };
    el.innerHTML = `<i class="fas fa-${icons[type]||'info-circle'}"></i><span>${message}</span>`;
    container.appendChild(el);
    setTimeout(() => el.remove(), 5000);
}

// =============================================
// ===== BOOT =====
// =============================================
document.addEventListener('DOMContentLoaded', () => {
    if (!document.getElementById('analyticsPage')) return;
    setTimeout(async () => {
        try {
            window.appState  = window.appState  || {};
            window.healthDB  = window.healthDB  || { getUserVitalSigns: async()=>[], getUserLabResults: async()=>[], getUserMedications: async()=>[], getUserSymptoms: async()=>[], getUserAppointments: async()=>[], getUserJournalEntries: async()=>[], getUserDocuments: async()=>[], getUserLabDocuments: async()=>[] };
            await loadAnalytics();
        } catch (e) {
            console.error('Failed to init analytics:', e);
            showMessage('error', 'Failed to load analytics. Please refresh the page.');
        }
    }, 500);
});

// Expose globally
Object.assign(window, { loadAnalytics, destroyAllCharts, loadDashboardTab, loadTrendsTab, loadRiskTab, loadWellnessTab, loadReportsTab, loadInsightsTab, generateHealthReport, generateInsights, exportAnalyticsData });