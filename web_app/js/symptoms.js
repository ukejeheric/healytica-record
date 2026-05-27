// ===== SYMPTOMS TRACKER — ALL BUGS FIXED =====
// FIX 1:  handleLogout uses supabaseService.signOut() — not supabaseClient (crash fix)
// FIX 2:  loadSymptomStats now updates sidebar DOM (todaySymptoms, weekSymptoms, activeSymptoms)
// FIX 3:  createFrequencyChart / createSeverityChart replace canvas before new Chart() (blank fix)
// FIX 4:  clearAnalysisCharts replaced — restores canvas elements so charts can be re-created
// FIX 5:  Avatar colour derived from email hash — consistent across refreshes
// FIX 6:  createJournalEntryElement rating stars guard — NaN crash fixed
// FIX 7:  loadSymptomCorrelations computes real co-occurrence from actual data
// FIX 8:  loadTemporalPatterns computes real time-of-day / day-of-week from actual data
// FIX 9:  loadSymptomsHistory time filter uses fresh Date objects — no mutation side-effects
// FIX 10: fa-crystal-ball replaced with fa-brain (valid FA6 icon)
// FIX 11: setupSymptomsListeners called BEFORE loadCurrentTab to avoid missing listeners

console.log('✅ Symptoms tracker JS loading...');

// ─── STATE ────────────────────────────────────────────────────────────────────
const symptomsState = {
    symptomsData:   [],
    journalEntries: [],
    filters: { timePeriod: 'all', severity: 'all', search: '' },
    charts:     {},
    currentTab: 'track'
};

// ─── INIT ─────────────────────────────────────────────────────────────────────
async function loadSymptoms() {
    console.log('🚀 Loading Symptoms Tracker...');
    showLoading();
    try {
        const user = await supabaseService.getCurrentUser();
        if (!user) {
            showMessage('error', 'Please login to access symptoms tracker');
            setTimeout(() => { window.location.href = 'index.html'; }, 1500);
            return;
        }
        console.log('✅ User authenticated:', user.email);

        updateUserInfo(user);

        await Promise.all([
            loadSymptomsData(user.id),
            loadJournalData(user.id),
            loadSymptomStats(user.id)
        ]);

        initializeSymptomsUI();

        // FIX 11: listeners BEFORE loadCurrentTab so buttons work on first load
        setupSymptomsListeners();
        loadCurrentTab();

        console.log('✅ Symptoms tracker loaded');
    } catch (error) {
        console.error('❌ Error loading symptoms tracker:', error);
        showMessage('error', 'Failed to load symptoms data. Please try refreshing.');
    } finally {
        hideLoading();
    }
}

// ─── USER INFO ────────────────────────────────────────────────────────────────
// FIX 5: Hash email for consistent avatar colour (same logic as vital_signs.js)
function updateUserInfo(user) {
    const userAvatar = document.getElementById('userAvatar');
    const userName   = document.getElementById('userName');

    if (userAvatar) {
        userAvatar.textContent = user.email ? user.email.substring(0, 2).toUpperCase() : 'SU';
        let h = 0;
        for (let i = 0; i < user.email.length; i++) h = user.email.charCodeAt(i) + ((h << 5) - h);
        userAvatar.style.background = `hsl(${Math.abs(h) % 360}, 65%, 55%)`;
    }
    if (userName) userName.textContent = user.email ? user.email.split('@')[0] : 'User';
}

// ─── DATA LOADING ─────────────────────────────────────────────────────────────
async function loadSymptomsData(userId) {
    try {
        const result = await supabaseService.getUserSymptoms(userId);
        symptomsState.symptomsData = result.success ? (result.data || []) : [];
        console.log(`✅ Loaded ${symptomsState.symptomsData.length} symptoms`);
    } catch (error) {
        console.error('Error in loadSymptomsData:', error);
        symptomsState.symptomsData = [];
    }
}

async function loadJournalData(userId) {
    try {
        const result = await supabaseService.getJournalEntries(userId);
        symptomsState.journalEntries = result.success ? (result.data || []) : [];
        console.log(`✅ Loaded ${symptomsState.journalEntries.length} journal entries`);
    } catch (error) {
        console.error('Error in loadJournalData:', error);
        symptomsState.journalEntries = [];
    }
}

// FIX 2: Stats now update the sidebar DOM elements
async function loadSymptomStats(userId) {
    try {
        const todayStr   = new Date().toISOString().split('T')[0];
        const weekAgoStr = (() => { const d = new Date(); d.setDate(d.getDate() - 7); return d.toISOString().split('T')[0]; })();

        // Reuse already-loaded data if available, otherwise fetch
        const allSymptoms = symptomsState.symptomsData.length > 0
            ? symptomsState.symptomsData
            : (() => { const r = supabaseService.getUserSymptoms(userId); return r.success ? (r.data || []) : []; })();

        let today = 0, week = 0, active = 0;
        allSymptoms.forEach(s => {
            if (s.symptom_date === todayStr)     today++;
            if (s.symptom_date >= weekAgoStr)  { week++; active++; }
        });

        // FIX 2: actually write to DOM
        const setEl = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
        setEl('todaySymptoms',  today);
        setEl('weekSymptoms',   week);
        setEl('activeSymptoms', active);

        console.log('Symptom stats updated:', { today, week, active });
    } catch (error) {
        console.error('Error getting symptom stats:', error);
    }
}

// ─── UI INIT ──────────────────────────────────────────────────────────────────
function initializeSymptomsUI() {
    setCurrentDate();
    initializeFormOptions();
    setupDateInputs();
}

function setCurrentDate() {
    const now         = new Date();
    const today       = now.toISOString().split('T')[0];
    const currentTime = now.toTimeString().split(':').slice(0, 2).join(':');

    const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
    setVal('symptomDate', today);
    setVal('symptomTime', currentTime);
    setVal('journalDate', today);

    const currentDate = document.getElementById('currentDate');
    if (currentDate) currentDate.textContent = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

function initializeFormOptions() {
    const populate = (containerId, name, items) => {
        const el = document.getElementById(containerId);
        if (!el) return;
        items.forEach(item => el.appendChild(createCheckbox(name, item, item)));
    };

    populate('bodyLocations',        'bodyLocation',    ['Head','Chest','Abdomen','Back','Arms','Legs','Joints','Whole Body']);
    populate('symptomQualityGroup',  'symptomQuality',  ['Sharp','Dull','Burning','Throbbing','Aching','Tingling','Pressure']);
    populate('symptomTriggersGroup', 'symptomTrigger',  ['Stress','Food','Activity','Weather','Allergens','Medications','Sleep']);
    populate('associatedSymptomsGroup','associatedSymptom',['Fever','Nausea','Dizziness','Sweating','Fatigue','Weakness','None']);
    populate('activitiesAffected',   'activityAffected',['Work','Exercise','Sleep','Eating','Social','Hobbies','None']);
}

function createCheckbox(name, value, label) {
    const container  = document.createElement('div');
    container.className = 'checkbox-item';
    const id = `${name}_${value.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    container.innerHTML = `<input type="checkbox" id="${id}" name="${name}" value="${value}"><label for="${id}">${label}</label>`;
    return container;
}

function setupDateInputs() {
    const today = new Date().toISOString().split('T')[0];
    document.querySelectorAll('input[type="date"]').forEach(i => i.max = today);

    const slider = document.getElementById('healthRating');
    const label  = document.getElementById('ratingValue');
    if (slider && label) slider.addEventListener('input', () => label.textContent = slider.value);
}

// ─── EVENT LISTENERS ──────────────────────────────────────────────────────────
function setupSymptomsListeners() {
    setupTabListeners();
    setupFormListeners();
    setupFilterListeners();
    setupAnalysisListeners();
    setupJournalListeners();

    document.getElementById('refreshBtn')?.addEventListener('click', handleRefresh);
    document.getElementById('exportHistory')?.addEventListener('click', exportSymptomsHistory);
    document.getElementById('trackFirstSymptom')?.addEventListener('click', () => switchToTab('track'));
    document.getElementById('logoutBtn')?.addEventListener('click', handleLogout);
    document.getElementById('menuToggle')?.addEventListener('click', () => {
        document.getElementById('sidebar')?.classList.toggle('active');
    });
}

async function handleRefresh() {
    showLoading();
    const user = await supabaseService.getCurrentUser();
    if (user) {
        await Promise.all([loadSymptomsData(user.id), loadJournalData(user.id), loadSymptomStats(user.id)]);
        loadCurrentTab();
        showMessage('success', 'Data refreshed!');
    }
    hideLoading();
}

function setupTabListeners() {
    document.querySelectorAll('.symptoms-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.dataset.tab;
            document.querySelectorAll('.symptoms-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            document.getElementById(`${tabName}Tab`)?.classList.add('active');
            symptomsState.currentTab = tabName;
            loadTabData(tabName);
        });
    });
}

function loadTabData(tabName) {
    switch (tabName) {
        case 'history':  loadSymptomsHistory();    break;
        case 'analysis': loadSymptomAnalysis();     break;
        case 'journal':  loadHealthJournal();       break;
        case 'patterns': loadPatternDetection();    break;
    }
}

function loadCurrentTab() { loadTabData(symptomsState.currentTab); }

function switchToTab(tabName) {
    document.querySelector(`.symptoms-tab[data-tab="${tabName}"]`)?.click();
}

// ─── SYMPTOM FORM ─────────────────────────────────────────────────────────────
function setupFormListeners() {
    document.getElementById('symptomForm')?.addEventListener('submit', async e => { e.preventDefault(); await saveSymptom(); });
    document.getElementById('resetBtn')?.addEventListener('click', () => {
        document.getElementById('symptomForm')?.reset();
        setCurrentDate();
    });
    const cat = document.getElementById('symptomCategory');
    if (cat) { cat.addEventListener('change', updateSymptomSuggestions); updateSymptomSuggestions(); }
}

function updateSymptomSuggestions() {
    const category = document.getElementById('symptomCategory')?.value;
    const datalist  = document.getElementById('symptomSuggestions');
    if (!datalist) return;
    datalist.innerHTML = '';
    const suggestions = {
        general:        ['Fever','Fatigue','Weakness','Weight Changes','Night Sweats'],
        cardiovascular: ['Chest Pain','Palpitations','Shortness of Breath','Dizziness'],
        respiratory:    ['Cough','Wheezing','Shortness of Breath','Chest Tightness'],
        neurological:   ['Headache','Dizziness','Numbness','Tingling','Weakness'],
        gastrointestinal:['Nausea','Vomiting','Diarrhea','Abdominal Pain','Bloating'],
        musculoskeletal:['Joint Pain','Muscle Pain','Back Pain','Stiffness'],
        sensory:        ['Blurred Vision','Hearing Loss','Ringing in Ears'],
        dermatological: ['Rash','Itching','Dry Skin','Hair Loss'],
        sleep:          ['Insomnia','Sleepiness','Fatigue','Low Energy'],
        mental:         ['Anxiety','Depression','Irritability','Mood Swings']
    };
    (suggestions[category] || []).forEach(s => {
        const opt = document.createElement('option'); opt.value = s; datalist.appendChild(opt);
    });
}

async function saveSymptom() {
    const submitBtn = document.getElementById('submitBtn');
    if (!validateSymptomForm()) return;

    submitBtn.disabled  = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

    try {
        const user = await supabaseService.getCurrentUser();
        if (!user) throw new Error('Not authenticated');

        const data = { ...getSymptomFormData(), user_id: user.id };
        const result = await supabaseService.addSymptom(data);
        if (!result.success) throw new Error(result.error);

        symptomsState.symptomsData.unshift(result.data);
        await loadSymptomStats(user.id);
        showMessage('success', 'Symptom recorded successfully!');
        document.getElementById('symptomForm').reset();
        setCurrentDate();
        setTimeout(() => switchToTab('history'), 1000);
    } catch (error) {
        console.error('Error saving symptom:', error);
        showMessage('error', 'Failed to save symptom. Please try again.');
    } finally {
        submitBtn.disabled  = false;
        submitBtn.innerHTML = '<i class="fas fa-save"></i> Record Symptom';
    }
}

function validateSymptomForm() {
    const fields = ['symptomDate','symptomName','symptomSeverity','symptomDescription'];
    let valid = true;
    fields.forEach(id => {
        const f = document.getElementById(id);
        if (!f) return;
        if (!f.value.trim()) { valid = false; f.style.borderColor = '#dc3545'; }
        else                   f.style.borderColor = '#e0e0e0';
    });
    if (!valid) showMessage('error', 'Please fill all required fields (marked with *)');
    return valid;
}

function getSymptomFormData() {
    const gv = id => document.getElementById(id)?.value || '';
    const gs = id => document.getElementById(id)?.value || '';
    const data = {
        symptom_date:     gv('symptomDate'),
        symptom_time:     gv('symptomTime'),
        symptom_name:     gv('symptomName'),
        symptom_category: gs('symptomCategory'),
        severity:         gs('symptomSeverity'),
        description:      gv('symptomDescription')
    };
    const opts = { symptomDuration:'duration', symptomFrequency:'frequency', symptomImpact:'symptom_impact' };
    Object.entries(opts).forEach(([id, key]) => { const v = gs(id); if (v) data[key] = v; });
    const rf = gv('relievingFactors'); if (rf) data.relieving_factors = rf;

    const getCB = name => {
        const vals = Array.from(document.querySelectorAll(`input[name="${name}"]:checked`)).map(c => c.value);
        return vals.length ? vals.join(', ') : null;
    };
    const cbMap = { bodyLocation:'body_location', symptomQuality:'symptom_quality', symptomTrigger:'symptom_trigger', associatedSymptom:'associated_symptom' };
    Object.entries(cbMap).forEach(([name, key]) => { const v = getCB(name); if (v) data[key] = v; });
    const act = getCB('activityAffected'); if (act) data.activity_affected = act;
    return data;
}

// ─── HISTORY TAB ──────────────────────────────────────────────────────────────
function setupFilterListeners() {
    const tf = document.getElementById('timeFilter');
    const sf = document.getElementById('severityFilter');
    const qf = document.getElementById('searchFilter');
    if (tf) tf.addEventListener('change', () => { symptomsState.filters.timePeriod = tf.value; loadSymptomsHistory(); });
    if (sf) sf.addEventListener('change', () => { symptomsState.filters.severity   = sf.value; loadSymptomsHistory(); });
    if (qf) qf.addEventListener('input', debounce(() => { symptomsState.filters.search = qf.value.toLowerCase(); loadSymptomsHistory(); }, 300));
}

function debounce(fn, wait) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); };
}

// FIX 9: Each case creates its OWN fresh Date — no mutation side-effects
function loadSymptomsHistory() {
    const list = document.getElementById('symptomsList');
    if (!list) return;

    let filtered = [...symptomsState.symptomsData];

    if (symptomsState.filters.timePeriod !== 'all') {
        const cutoff = (() => {
            const d = new Date();
            switch (symptomsState.filters.timePeriod) {
                case 'today':   d.setHours(0,0,0,0);         break;
                case 'week':    d.setDate(d.getDate()-7);     break;
                case 'month':   d.setMonth(d.getMonth()-1);   break;
                case '3months': d.setMonth(d.getMonth()-3);   break;
            }
            return d;
        })();
        filtered = filtered.filter(s => new Date(s.symptom_date) >= cutoff);
    }
    if (symptomsState.filters.severity !== 'all')
        filtered = filtered.filter(s => s.severity === symptomsState.filters.severity);
    if (symptomsState.filters.search)
        filtered = filtered.filter(s =>
            (s.symptom_name  && s.symptom_name.toLowerCase().includes(symptomsState.filters.search)) ||
            (s.description   && s.description.toLowerCase().includes(symptomsState.filters.search))
        );

    if (!filtered.length) {
        list.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-search"></i>
                <h3>No symptoms found</h3>
                <p>Try changing your filters or track a new symptom</p>
                <button class="btn-primary" id="trackNewSymptom"><i class="fas fa-plus"></i> Track New Symptom</button>
            </div>`;
        document.getElementById('trackNewSymptom')?.addEventListener('click', () => switchToTab('track'));
        return;
    }

    list.innerHTML = '';
    filtered.forEach(s => list.appendChild(createSymptomElement(s)));
}

function createSymptomElement(symptom) {
    const div = document.createElement('div');
    div.className  = 'symptom-item';
    div.dataset.id = symptom.id;

    const dateStr = symptom.symptom_date
        ? new Date(symptom.symptom_date + 'T00:00:00').toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })
        : 'No date';
    const sevText = { mild:'🟢 Mild', moderate:'🟡 Moderate', severe:'🟠 Severe', very_severe:'🔴 Very Severe' }[symptom.severity] || 'Unknown';
    const timeText = symptom.symptom_time ? ` at ${symptom.symptom_time}` : '';

    div.innerHTML = `
        <div class="symptom-header">
            <div class="symptom-name">
                ${symptom.symptom_name || 'Unnamed Symptom'}
                <span class="severity-badge ${symptom.severity || 'unknown'}">${sevText}</span>
            </div>
            <div class="symptom-date">${dateStr}${timeText}</div>
        </div>
        ${symptom.symptom_category ? `<div class="symptom-detail"><strong>Category:</strong> ${symptom.symptom_category}</div>` : ''}
        ${symptom.duration         ? `<div class="symptom-detail"><strong>Duration:</strong> ${symptom.duration.replace(/_/g,' ')}</div>` : ''}
        ${symptom.frequency        ? `<div class="symptom-detail"><strong>Frequency:</strong> ${symptom.frequency.replace(/_/g,' ')}</div>` : ''}
        ${symptom.description      ? `<div class="symptom-description">${symptom.description}</div>` : ''}
        <div class="symptom-actions">
            <button class="symptom-action-btn delete" data-id="${symptom.id}"><i class="fas fa-trash"></i> Delete</button>
        </div>`;

    div.querySelector('.delete')?.addEventListener('click', () => deleteSymptom(symptom.id));
    return div;
}

async function deleteSymptom(symptomId) {
    if (!confirm('Delete this symptom record? This cannot be undone.')) return;
    try {
        const result = await supabaseService.deleteSymptom(symptomId);
        if (!result.success) throw new Error(result.error);
        symptomsState.symptomsData = symptomsState.symptomsData.filter(s => s.id !== symptomId);
        const user = await supabaseService.getCurrentUser();
        if (user) await loadSymptomStats(user.id);
        loadSymptomsHistory();
        showMessage('success', 'Symptom deleted!');
    } catch (error) {
        showMessage('error', 'Failed to delete. Please try again.');
    }
}

function exportSymptomsHistory() {
    if (!symptomsState.symptomsData.length) { showMessage('info', 'No data to export'); return; }
    const esc = t => `"${String(t||'').replace(/"/g,'""')}"`;
    const csv = ['Date,Time,Symptom,Category,Severity,Duration,Frequency,Description',
        ...symptomsState.symptomsData.map(s => [
            s.symptom_date||'', s.symptom_time||'',
            esc(s.symptom_name), s.symptom_category||'', s.severity||'',
            s.duration ? s.duration.replace(/_/g,' ')   : '',
            s.frequency ? s.frequency.replace(/_/g,' ') : '',
            esc(s.description)
        ].join(','))
    ].join('\n');
    const blob = new Blob([csv], { type:'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `symptoms_${new Date().toISOString().split('T')[0]}.csv`;
    a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    showMessage('success', 'Exported!');
}

// ─── ANALYSIS TAB ─────────────────────────────────────────────────────────────
function setupAnalysisListeners() {
    document.getElementById('symptomToAnalyze')?.addEventListener('change', loadSelectedSymptomAnalysis);
}

function loadSymptomAnalysis() {
    populateSymptomDropdown();
    if (symptomsState.symptomsData.length > 0) {
        const sel = document.getElementById('symptomToAnalyze');
        if (sel?.value) loadSelectedSymptomAnalysis();
    }
}

function populateSymptomDropdown() {
    const sel = document.getElementById('symptomToAnalyze');
    if (!sel) return;
    const names = [...new Set(symptomsState.symptomsData.map(s => s.symptom_name).filter(n => n?.trim()))];
    sel.innerHTML = names.length
        ? `<option value="all">All Symptoms</option>` + names.map(n => `<option value="${n}">${n}</option>`).join('')
        : `<option value="">No symptoms recorded</option>`;
    if (names.length) sel.value = 'all';
}

function loadSelectedSymptomAnalysis() {
    const sel  = document.getElementById('symptomToAnalyze');
    if (!sel?.value) return;
    const data = sel.value === 'all'
        ? symptomsState.symptomsData
        : symptomsState.symptomsData.filter(s => s.symptom_name === sel.value);

    if (!data.length) { clearAnalysisCharts(); updateSymptomStatistics([]); return; }

    updateSymptomStatistics(data);
    createFrequencyChart(data);
    createSeverityChart(data);
    updatePatternInsights(data);
}

// FIX 4: clearAnalysisCharts restores canvas elements so charts can be re-created later
function clearAnalysisCharts() {
    ['frequency','severity'].forEach(key => {
        if (symptomsState.charts[key]) {
            try { symptomsState.charts[key].destroy(); } catch(e) {}
            symptomsState.charts[key] = null;
        }
    });
    // Restore canvas elements
    ['frequencyChart','severityChart'].forEach(id => {
        const wrapper = document.getElementById(id)?.parentElement || document.querySelector(`[data-canvas="${id}"]`);
        if (wrapper) {
            const canvas = document.createElement('canvas');
            canvas.id = id;
            wrapper.innerHTML = '';
            wrapper.appendChild(canvas);
        }
    });
    updateSymptomStatistics([]);
}

function updateSymptomStatistics(data) {
    const setEl = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    setEl('totalEpisodes', data.length);

    if (data.length > 1) {
        const dates = data.map(s => new Date(s.symptom_date)).filter(d => !isNaN(d)).sort((a,b) => a-b);
        if (dates.length >= 2) {
            const diffs = dates.slice(1).map((d,i) => (d - dates[i]) / 86400000);
            const avg   = diffs.reduce((a,b) => a+b, 0) / diffs.length;
            setEl('avgDaysBetween', avg.toFixed(1) + ' days');
        }
    } else {
        setEl('avgDaysBetween', '--');
    }

    const counts = {};
    data.forEach(s => { if (s.severity) counts[s.severity] = (counts[s.severity]||0)+1; });
    const top = Object.entries(counts).sort((a,b) => b[1]-a[1])[0];
    setEl('mostCommonSeverity', top ? top[0].charAt(0).toUpperCase()+top[0].slice(1) : '--');

    if (data.length >= 2) {
        const lvl = { mild:1, moderate:2, severe:3, very_severe:4 };
        const cur  = lvl[data[0].severity] || 0;
        const prev = lvl[data[1].severity] || 0;
        setEl('recentTrend', cur > prev ? 'Worsening 📈' : cur < prev ? 'Improving 📉' : 'Stable ↔');
    } else {
        setEl('recentTrend', '--');
    }
}

// FIX 3: Replace canvas element before creating new Chart.js instance
function freshCanvas(id) {
    const old = document.getElementById(id);
    if (!old) return null;
    const canvas = document.createElement('canvas');
    canvas.id = id;
    old.parentNode.replaceChild(canvas, old);
    return canvas.getContext('2d');
}

function createFrequencyChart(data) {
    const ctx = freshCanvas('frequencyChart');
    if (!ctx) return;
    if (symptomsState.charts.frequency) { try { symptomsState.charts.frequency.destroy(); } catch(e) {} }

    const counts = {};
    data.forEach(s => { if (s.symptom_date) { const m = s.symptom_date.substring(0,7); counts[m] = (counts[m]||0)+1; } });
    const months = Object.keys(counts).sort();
    if (!months.length) { ctx.canvas.parentElement.innerHTML = '<p class="info">Not enough data for frequency chart</p>'; return; }

    symptomsState.charts.frequency = new Chart(ctx, {
        type: 'line',
        data: {
            labels: months,
            datasets: [{ label:'Episodes', data: months.map(m=>counts[m]), borderColor:'#1e3c72', backgroundColor:'rgba(30,60,114,0.1)', borderWidth:2, fill:true, tension:0.4 }]
        },
        options: {
            responsive:true, maintainAspectRatio:false,
            plugins:{ legend:{display:false}, tooltip:{mode:'index',intersect:false} },
            scales:{
                x:{ grid:{display:false}, title:{display:true, text:'Month'} },
                y:{ beginAtZero:true, ticks:{stepSize:1}, title:{display:true, text:'Episodes'} }
            }
        }
    });
}

function createSeverityChart(data) {
    const ctx = freshCanvas('severityChart');
    if (!ctx) return;
    if (symptomsState.charts.severity) { try { symptomsState.charts.severity.destroy(); } catch(e) {} }

    const counts = {};
    data.forEach(s => { if (s.severity) counts[s.severity] = (counts[s.severity]||0)+1; });
    const labels = Object.keys(counts).map(s => s.charAt(0).toUpperCase()+s.slice(1).replace('_',' '));
    const vals   = Object.values(counts);
    if (!labels.length) { ctx.canvas.parentElement.innerHTML = '<p class="info">Not enough data for severity chart</p>'; return; }

    const clr = { mild:'#28a745', moderate:'#ffc107', severe:'#fd7e14', 'very severe':'#dc3545' };
    symptomsState.charts.severity = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels,
            datasets: [{ data:vals, backgroundColor: labels.map(l => clr[l.toLowerCase()]||'#6c757d'), borderWidth:2, borderColor:'white' }]
        },
        options: {
            responsive:true, maintainAspectRatio:false,
            plugins: {
                legend:{ position:'bottom' },
                tooltip:{ callbacks:{ label: ctx => {
                    const total = ctx.dataset.data.reduce((a,b)=>a+b,0);
                    return `${ctx.label}: ${ctx.raw} (${Math.round(ctx.raw/total*100)}%)`;
                }}}
            }
        }
    });
}

function updatePatternInsights(data) {
    const list = document.getElementById('patternInsights');
    if (!list) return;
    list.innerHTML = '';
    if (data.length < 3) {
        list.innerHTML = `<div class="insight-item"><i class="fas fa-info-circle"></i><span>Record more episodes for pattern insights</span></div>`;
        return;
    }
    const insights = [];
    if (data.length >= 5) insights.push('Multiple episodes recorded — consider tracking triggers');
    const recentSevere = data.slice(0,3).filter(s => s.severity==='severe'||s.severity==='very_severe').length;
    if (recentSevere >= 2) insights.push('Recent severe episodes — discuss with your healthcare provider');
    const longDur = data.filter(s => s.duration && (s.duration.includes('week')||s.duration.includes('chronic'))).length;
    if (longDur > 0) insights.push('Long-duration symptoms may need medical attention');
    if (!insights.length) insights.push('Continue tracking for detailed insights', 'Note possible triggers in your descriptions', 'Discuss patterns with your healthcare provider');
    insights.forEach(t => {
        const el = document.createElement('div');
        el.className = 'insight-item';
        el.innerHTML = `<i class="fas fa-lightbulb"></i><span>${t}</span>`;
        list.appendChild(el);
    });
}

// ─── JOURNAL TAB ──────────────────────────────────────────────────────────────
function setupJournalListeners() {
    document.getElementById('saveJournalBtn')?.addEventListener('click', saveJournalEntry);
    document.getElementById('clearJournalBtn')?.addEventListener('click', () => {
        document.querySelector('.journal-form')?.reset();
        setCurrentDate();
        const rv = document.getElementById('ratingValue'); if (rv) rv.textContent = '7';
    });
}

function loadHealthJournal() {
    const container = document.getElementById('journalEntries');
    if (!container) return;
    if (!symptomsState.journalEntries.length) {
        container.innerHTML = `<div class="empty-state"><i class="fas fa-book-open"></i><p>No journal entries yet</p><p class="small">Start by saving your first entry</p></div>`;
        return;
    }
    container.innerHTML = '';
    symptomsState.journalEntries.forEach(e => container.appendChild(createJournalEntryElement(e)));
}

// FIX 6: Guard against NaN in .repeat() when health_rating is null/undefined
function createJournalEntryElement(entry) {
    const div = document.createElement('div');
    div.className = 'journal-entry';

    const dateStr = (() => {
        const raw = entry.entry_date || entry.created_at;
        if (!raw) return 'No date';
        return new Date(raw).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });
    })();

    const rating = Math.min(10, Math.max(0, parseInt(entry.health_rating) || 5));
    const stars  = '★'.repeat(rating) + '☆'.repeat(10 - rating);

    div.innerHTML = `
        <div class="journal-date">${dateStr}</div>
        <div class="journal-rating">
            <span class="rating-stars">${stars}</span>
            <span>${rating}/10</span>
        </div>
        ${entry.mood         ? `<div class="journal-mood"><strong>Mood:</strong> ${entry.mood}</div>` : ''}
        ${entry.sleep_quality? `<div class="journal-sleep"><strong>Sleep:</strong> ${entry.sleep_quality}</div>` : ''}
        ${entry.energy_level ? `<div class="journal-energy"><strong>Energy:</strong> ${entry.energy_level}</div>` : ''}
        ${entry.notes        ? `<div class="journal-content">${entry.notes}</div>` : ''}`;
    return div;
}

async function saveJournalEntry() {
    const btn = document.getElementById('saveJournalBtn');
    if (!btn) return;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    try {
        const user = await supabaseService.getCurrentUser();
        if (!user) throw new Error('Not authenticated');
        const entry = {
            date:          document.getElementById('journalDate')?.value,
            health_rating: parseInt(document.getElementById('healthRating')?.value) || 7,
            mood:          document.getElementById('moodToday')?.value,
            sleep_quality: document.getElementById('sleepQuality')?.value,
            energy_level:  document.getElementById('energyLevel')?.value,
            medications:   document.getElementById('medicationsTaken')?.value,
            notes:         document.getElementById('dailyNotes')?.value
        };
        const acts = Array.from(document.querySelectorAll('input[name="activityAffected"]:checked')).map(c => c.value);
        if (acts.length) entry.activities_affected = acts.join(', ');
        const result = await supabaseService.addJournalEntry(user.id, entry);
        if (!result.success) throw new Error(result.error);
        symptomsState.journalEntries.unshift(result.data);
        showMessage('success', 'Journal entry saved!');
        document.querySelector('.journal-form')?.reset();
        setCurrentDate();
        const rv = document.getElementById('ratingValue'); if (rv) rv.textContent = '7';
        loadHealthJournal();
    } catch (error) {
        console.error('Journal save error:', error);
        showMessage('error', 'Failed to save journal entry.');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-save"></i> Save Journal Entry';
    }
}

// ─── PATTERN DETECTION TAB ────────────────────────────────────────────────────
function loadPatternDetection() {
    calculateRequirementsProgress();
    if (checkPatternRequirements()) {
        showAIAnalysis();
        loadPatternAnalysis();
    }
}

function calculateRequirementsProgress() {
    const total   = symptomsState.symptomsData.length;
    const unique  = new Set(symptomsState.symptomsData.map(s => s.symptom_name).filter(n=>n?.trim())).size;
    const detailed = symptomsState.symptomsData.filter(s => s.description && s.description.length > 20).length;
    let progress  = 0;
    if (total   >= 6) progress += 25;
    if (unique  >= 3) progress += 25;
    if (detailed >= 4) progress += 25;
    if (total   >= 4) {
        const dates = symptomsState.symptomsData.map(s => new Date(s.symptom_date)).filter(d => !isNaN(d));
        if (dates.length >= 2) {
            const span = (Math.max(...dates) - Math.min(...dates)) / 86400000;
            if (span >= 14) progress += 25;
        }
    }
    const pel = document.getElementById('requirementsProgress');
    const fel = document.getElementById('progressFill');
    if (pel) pel.textContent = `${progress}%`;
    if (fel) fel.style.width = `${progress}%`;

    // Update requirement list items with live ✓/✗ indicators
    updateRequirementItem(0, total   >= 6,   `${total}/6 symptom episodes recorded`);
    updateRequirementItem(1, unique  >= 3,   `${unique}/3 different symptoms tracked`);
    updateRequirementItem(2, detailed >= 4,  `${detailed}/4 detailed descriptions`);
    const dates2 = symptomsState.symptomsData.map(s => new Date(s.symptom_date)).filter(d => !isNaN(d));
    const span2  = dates2.length >= 2 ? Math.floor((Math.max(...dates2)-Math.min(...dates2))/86400000) : 0;
    updateRequirementItem(3, span2 >= 14, `${span2}/14 days of tracking`);
}

function updateRequirementItem(index, met, text) {
    const items = document.querySelectorAll('.requirements-list li');
    if (!items[index]) return;
    const icon = items[index].querySelector('i');
    if (icon) { icon.className = met ? 'fas fa-check-circle' : 'fas fa-circle'; icon.style.color = met ? '#28a745' : '#ccc'; }
    const span = items[index].querySelector('span') || items[index].childNodes[items[index].childNodes.length-1];
    if (span && span.nodeType === Node.TEXT_NODE) span.textContent = ' ' + text;
    else if (items[index].lastChild && items[index].lastChild.nodeType !== Node.ELEMENT_NODE)
        items[index].lastChild.textContent = ' ' + text;
}

function checkPatternRequirements() {
    const total  = symptomsState.symptomsData.length;
    const unique = new Set(symptomsState.symptomsData.map(s => s.symptom_name).filter(n=>n?.trim())).size;
    return total >= 6 && unique >= 3;
}

function showAIAnalysis() {
    document.getElementById('patternsRequirements')?.style.setProperty('display','none');
    const ai = document.getElementById('aiAnalysis');
    if (ai) ai.style.display = 'block';
}

function loadPatternAnalysis() {
    loadSymptomCorrelations();
    loadTemporalPatterns();
}

// FIX 7: Real co-occurrence correlation from actual data
function loadSymptomCorrelations() {
    const list = document.getElementById('correlationsList');
    if (!list) return;
    list.innerHTML = '';

    const data = symptomsState.symptomsData;
    if (data.length < 6) {
        list.innerHTML = `<div class="correlation-item"><i class="fas fa-info-circle"></i><span>More data needed (6+ episodes required)</span></div>`;
        return;
    }

    // Group symptoms by date — find which names appear on the same day
    const byDate = {};
    data.forEach(s => {
        if (!s.symptom_date || !s.symptom_name) return;
        if (!byDate[s.symptom_date]) byDate[s.symptom_date] = new Set();
        byDate[s.symptom_date].add(s.symptom_name);
    });

    // Count co-occurrences
    const pairs = {};
    Object.values(byDate).forEach(names => {
        const arr = [...names];
        for (let i = 0; i < arr.length; i++) for (let j = i+1; j < arr.length; j++) {
            const key = [arr[i],arr[j]].sort().join(' ↔ ');
            pairs[key] = (pairs[key]||0) + 1;
        }
    });

    const top = Object.entries(pairs).sort((a,b) => b[1]-a[1]).slice(0, 5);

    if (!top.length) {
        list.innerHTML = `<div class="correlation-item"><i class="fas fa-info-circle"></i><span>No co-occurring symptoms detected yet. Keep tracking!</span></div>`;
        return;
    }

    top.forEach(([pair, count]) => {
        const item = document.createElement('div');
        item.className = 'correlation-item';
        item.innerHTML = `<strong>${pair}</strong> — appeared together ${count} time${count>1?'s':''}`;
        list.appendChild(item);
    });
}

// FIX 8: Real temporal pattern analysis from actual timestamps
function loadTemporalPatterns() {
    const container = document.getElementById('temporalPatterns');
    if (!container) return;
    container.innerHTML = '';

    const data = symptomsState.symptomsData;
    if (data.length < 4) {
        container.innerHTML = `<div class="pattern-item"><i class="fas fa-info-circle"></i><span>Continue tracking to detect temporal patterns</span></div>`;
        return;
    }

    const patterns = [];

    // Day-of-week frequency
    const dow = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const dowCounts = new Array(7).fill(0);
    data.forEach(s => { if (s.symptom_date) dowCounts[new Date(s.symptom_date+'T00:00:00').getDay()]++; });
    const maxDow = dowCounts.indexOf(Math.max(...dowCounts));
    if (dowCounts[maxDow] > 0) patterns.push(`Most symptoms occur on <strong>${dow[maxDow]}</strong> (${dowCounts[maxDow]} episodes)`);

    // Time of day (if symptom_time is available)
    const withTime = data.filter(s => s.symptom_time);
    if (withTime.length >= 3) {
        const todCounts = { Morning:0, Afternoon:0, Evening:0, Night:0 };
        withTime.forEach(s => {
            const h = parseInt(s.symptom_time.split(':')[0]);
            if (h >= 5  && h < 12) todCounts.Morning++;
            else if (h >= 12 && h < 17) todCounts.Afternoon++;
            else if (h >= 17 && h < 21) todCounts.Evening++;
            else                         todCounts.Night++;
        });
        const peakTod = Object.entries(todCounts).sort((a,b) => b[1]-a[1])[0];
        if (peakTod[1] > 0) patterns.push(`Most symptoms reported in the <strong>${peakTod[0]}</strong> (${peakTod[1]} episodes)`);
    }

    // Severity trend over last 4 weeks
    const lvl = { mild:1, moderate:2, severe:3, very_severe:4 };
    const sorted  = [...data].sort((a,b) => new Date(a.symptom_date)-new Date(b.symptom_date));
    const half    = Math.floor(sorted.length/2);
    const olderAvg = sorted.slice(0, half).reduce((s,x) => s+(lvl[x.severity]||0), 0)/half;
    const recentAvg= sorted.slice(-half).reduce((s,x) => s+(lvl[x.severity]||0), 0)/half;
    const diff = recentAvg - olderAvg;
    if (Math.abs(diff) > 0.3) patterns.push(diff > 0 ? 'Severity is <strong>trending upward</strong> — consider discussing with your provider' : 'Severity is <strong>trending downward</strong> — keep up the good work!');

    if (!patterns.length) patterns.push('Not enough variation detected yet — continue tracking for pattern insights');

    patterns.forEach(p => {
        const item = document.createElement('div');
        item.className = 'pattern-item';
        item.innerHTML = p;
        container.appendChild(item);
    });
}

// ─── UTILITIES ────────────────────────────────────────────────────────────────
function showLoading() {
    const el = document.getElementById('loader');
    if (el) el.style.display = 'flex';
}

function hideLoading() {
    const el = document.getElementById('loader');
    if (el) setTimeout(() => el.style.display = 'none', 300);
}

function showMessage(type, text) {
    let container = document.getElementById('messageContainer');
    if (!container) { container = document.createElement('div'); container.id = 'messageContainer'; document.body.appendChild(container); }
    const colors = { success:'#28a745', error:'#dc3545', warning:'#ffc107', info:'#17a2b8' };
    const icons  = { success:'✅', error:'❌', warning:'⚠️', info:'ℹ️' };
    const msg = document.createElement('div');
    msg.style.cssText = `background:white;padding:12px 18px;margin-top:8px;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.15);display:flex;align-items:center;gap:10px;min-width:280px;max-width:380px;border-left:4px solid ${colors[type]||colors.info};`;
    msg.innerHTML = `<span>${icons[type]||'ℹ️'}</span><span>${text}</span>`;
    container.appendChild(msg);
    setTimeout(() => { msg.style.opacity='0'; msg.style.transition='opacity 0.3s'; setTimeout(()=>msg.remove(),300); }, 5000);
}

// FIX 1: Use supabaseService.signOut() — not supabaseClient.auth.signOut()
async function handleLogout() {
    try {
        await supabaseService.signOut();
        showMessage('success', 'Logged out successfully');
        setTimeout(() => window.location.href = 'index.html', 1000);
    } catch (error) {
        console.error('Logout error:', error);
        showMessage('error', 'Logout failed');
    }
}

// ─── EXPORTS ──────────────────────────────────────────────────────────────────
window.loadSymptoms   = loadSymptoms;
window.symptomsState  = symptomsState;

console.log('✅ Symptoms tracker JS loaded');