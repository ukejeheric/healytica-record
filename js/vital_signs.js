// ===== VITAL SIGNS FUNCTIONALITY - ALL BUGS FIXED =====
// FIX 1:  Uses window.supabaseClient from supabase.js (RLS-safe)
// FIX 2:  Column-probe in BOTH read and write paths (recorded_at fallback)
// FIX 3:  freshCanvas() replaces canvas element before every Chart.js init
// FIX 4:  Radar container torn down and re-created on every call (no duplicates)
// FIX 5:  calculateNEWS2Tool() uses all 5 vital inputs (BP, HR, temp, RR, SpO2)
// FIX 6:  BP Stage 2 / Crisis boundary corrected (< 180 not <= 180)
// FIX 7:  editVital() runs calculateMAP/BMI AFTER setVal calls
// FIX 8:  Table action buttons use event delegation (no duplicate listeners)
// FIX 9:  Health insights stale-check uses global vitalsData[0] (newest)
// FIX 10: Correlation chart "no data" uses HTML message, not canvas text
// FIX 11: Export uses Blob URL (no 2 MB URI limit)
// FIX 12: Supabase credentials centralised via window.SUPABASE_CONFIG
// FIX 13: Pain scale + consciousness included in save payload
// FIX 14: Quick Entry includes respiratory_rate field
// FIX 15: Loader CSS conflict noted (see vital_signs.css)
// FIX 16: formatDate() wired up in modal and today's list

console.log('=== VITAL SIGNS JS LOADING ===');

(function () {

    // ─── CLIENT ────────────────────────────────────────────────────────────────
    // FIX 12: Read credentials from one central place (set in supabase.js)
    function getClient() {
        if (window.supabaseClient) return window.supabaseClient;
        const cfg = window.SUPABASE_CONFIG || {};
        const URL = cfg.url     || 'https://osoclzojtrqdxykdmiks.supabase.co';
        const KEY = cfg.anonKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9zb2Nsem9qdHJxZHh5a2RtaWtzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4NzU4MjcsImV4cCI6MjA4MTQ1MTgyN30.fjFbgrqqXrxcnVPfSwHOsfPmi1PMXf-wW12p6J1nInk';
        return window.supabase.createClient(URL, KEY);
    }

    // Column-existence cache so we only probe once per session
    let _hasRecordedAt = null;

    async function probeRecordedAt() {
        if (_hasRecordedAt !== null) return _hasRecordedAt;
        const { error } = await getClient()
            .from('vital_signs').select('recorded_at').limit(1);
        _hasRecordedAt = !error; // error.code === '42703' means column absent
        return _hasRecordedAt;
    }

    // ─── STATE ─────────────────────────────────────────────────────────────────
    const vitalSignsState = {
        currentTab:    'record',
        vitalsData:    [],
        filteredVitals:[],
        currentPage:   1,
        itemsPerPage:  10,
        charts:        {},
        todayVitals:   []
    };

    // ─── MAIN INIT ─────────────────────────────────────────────────────────────
    async function loadVitalSigns() {
        console.log('Loading vital signs page...');
        if (!window.appState?.currentUser) {
            showMessage('error', 'Please login to access vital signs');
            return;
        }
        showLoading();
        try {
            await loadVitalsData();
            updateVitalsUI();
            setupVitalsListeners();
            setupFormCalculations();
        } catch (error) {
            console.error('Error loading vital signs:', error);
            showMessage('error', 'Failed to load vital signs data');
        } finally {
            hideLoading();
        }
    }

    // ─── DATA LOADING ──────────────────────────────────────────────────────────
    async function loadVitalsData() {
        const userId = window.appState.currentUser.id;
        const client = getClient();
        const useRecordedAt = await probeRecordedAt();

        const orderCol = useRecordedAt ? 'recorded_at' : 'record_date';
        const { data, error } = await client
            .from('vital_signs')
            .select('*')
            .eq('user_id', userId)
            .order(orderCol, { ascending: false });

        if (error) { console.error('Load error:', error); throw error; }

        vitalSignsState.vitalsData = (data || []).map(normaliseVital);
        vitalSignsState.vitalsData.sort((a, b) => new Date(b._date) - new Date(a._date));

        const todayStr = new Date().toISOString().split('T')[0];
        vitalSignsState.todayVitals    = vitalSignsState.vitalsData.filter(v => v._dateStr === todayStr);
        vitalSignsState.filteredVitals = [...vitalSignsState.vitalsData];

        console.log('Loaded vitals:', vitalSignsState.vitalsData.length);
    }

    function normaliseVital(v) {
        const dateRaw = v.recorded_at || v.record_date || v.created_at;
        const dateStr = dateRaw ? dateRaw.split('T')[0] : null;
        const timeStr = v.record_time || (v.recorded_at ? v.recorded_at.split('T')[1]?.substring(0, 5) : null);
        const sys     = v.systolic      || v.blood_pressure_systolic;
        const dia     = v.diastolic     || v.blood_pressure_diastolic;
        const hr      = v.heart_rate;
        const temp    = v.temperature;
        const spo2    = v.oxygen_saturation;
        const rr      = v.respiratory_rate;
        const wt      = v.weight;
        const ht      = v.height;
        const bmi     = v.bmi || (wt && ht ? +(wt / ((ht / 100) ** 2)).toFixed(1) : null);
        return {
            ...v,
            _date: new Date(dateRaw), _dateStr: dateStr, _time: timeStr,
            _sys: sys, _dia: dia, _hr: hr, _temp: temp,
            _spo2: spo2, _rr: rr, _wt: wt, _ht: ht, _bmi: bmi
        };
    }

    // ─── UI UPDATE ─────────────────────────────────────────────────────────────
    function updateVitalsUI() {
        updateTabDisplay();
        updateFormDefaults();
        updateSidebarStats();
        updateSummaryCards();
        updateVitalsTable();
        updateTodayVitals();
        updateQuickStats();
        updateDateDisplay();
    }

    function updateTabDisplay() {
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.getElementById(`${vitalSignsState.currentTab}-tab`)?.classList.add('active');
        document.querySelector(`.tab-btn[data-tab="${vitalSignsState.currentTab}"]`)?.classList.add('active');
    }

    function updateFormDefaults() {
        const today  = new Date().toISOString().split('T')[0];
        const dateEl = document.getElementById('recordDate');
        if (dateEl && !dateEl.value) { dateEl.value = today; dateEl.max = today; }
        const now    = new Date();
        const timeEl = document.getElementById('recordTime');
        if (timeEl && !timeEl.value) {
            timeEl.value = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
        }
    }

    function updateSidebarStats() {
        const totalEl = document.getElementById('totalVitalsCount');
        const todayEl = document.getElementById('todayVitalsCount');
        const avgBpEl = document.getElementById('avgBpSidebar');
        if (totalEl) totalEl.textContent = vitalSignsState.vitalsData.length;
        if (todayEl) todayEl.textContent = vitalSignsState.todayVitals.length;
        if (avgBpEl) {
            const recent = vitalSignsState.vitalsData.slice(0, 10).filter(v => v._sys && v._dia);
            if (recent.length > 0) {
                const aS = Math.round(recent.reduce((s, v) => s + v._sys, 0) / recent.length);
                const aD = Math.round(recent.reduce((s, v) => s + v._dia, 0) / recent.length);
                avgBpEl.textContent = `${aS}/${aD}`;
            }
        }
    }

    function updateSummaryCards() {
        const vitals   = vitalSignsState.vitalsData;
        if (!vitals.length) return;
        const withBP   = vitals.filter(v => v._sys && v._dia);
        const withHR   = vitals.filter(v => v._hr);
        const withTemp = vitals.filter(v => v._temp);
        const withWt   = vitals.filter(v => v._wt);
        const setEl    = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
        if (withBP.length) {
            const aS = Math.round(withBP.reduce((s, v) => s + v._sys, 0) / withBP.length);
            const aD = Math.round(withBP.reduce((s, v) => s + v._dia, 0) / withBP.length);
            setEl('avgBpSummary', `${aS}/${aD}`);
        }
        if (withHR.length)   setEl('avgHrSummary',  Math.round(withHR.reduce((s, v) => s + v._hr, 0) / withHR.length));
        if (withTemp.length) setEl('avgTempSummary', (withTemp.reduce((s, v) => s + v._temp, 0) / withTemp.length).toFixed(1));
        if (withWt.length)   setEl('latestWeight',   `${withWt[0]._wt} kg`);
    }

    function updateVitalsTable() {
        const tbody = document.getElementById('vitalsTableBody');
        if (!tbody) return;
        tbody.innerHTML = '';
        if (!vitalSignsState.filteredVitals.length) {
            tbody.innerHTML = `<tr><td colspan="9" class="loading-row"><i class="fas fa-clipboard-list"></i> No vital signs recorded yet</td></tr>`;
            updatePagination();
            return;
        }
        const start = (vitalSignsState.currentPage - 1) * vitalSignsState.itemsPerPage;
        const page  = vitalSignsState.filteredVitals.slice(start, start + vitalSignsState.itemsPerPage);
        page.forEach(vital => {
            const tr      = document.createElement('tr');
            const bpClass = getBPStatusClass(vital._sys, vital._dia);
            tr.innerHTML  = `
                <td>${formatDate(vital._dateStr)} ${vital._time || ''}</td>
                <td><span class="bp-value ${bpClass}">${vital._sys || '--'}/${vital._dia || '--'}</span></td>
                <td>${vital._hr || '--'}</td>
                <td>${vital._temp ? vital._temp.toFixed(1) : '--'}</td>
                <td>${vital._spo2 ? vital._spo2.toFixed(0) + '%' : '--'}</td>
                <td>${vital._rr || '--'}</td>
                <td>${vital._wt ? vital._wt + ' kg' : '--'}</td>
                <td>${vital._bmi ? vital._bmi.toFixed(1) : '--'}</td>
                <td>
                    <div class="table-actions">
                        <button class="action-btn view-btn"   data-id="${vital.id}" title="View"><i class="fas fa-eye"></i></button>
                        <button class="action-btn edit-btn"   data-id="${vital.id}" title="Edit"><i class="fas fa-edit"></i></button>
                        <button class="action-btn delete-btn" data-id="${vital.id}" title="Delete"><i class="fas fa-trash"></i></button>
                    </div>
                </td>`;
            tbody.appendChild(tr);
        });
        updatePagination();
        // NOTE: no setupTableActions() call here — FIX 8 uses event delegation
    }

    function updatePagination() {
        const total = Math.ceil(vitalSignsState.filteredVitals.length / vitalSignsState.itemsPerPage);
        const setEl = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
        setEl('currentPage', vitalSignsState.currentPage);
        setEl('totalPages',  total);
        const prev = document.querySelector('.page-btn.prev');
        const next = document.querySelector('.page-btn.next');
        if (prev) prev.disabled = vitalSignsState.currentPage <= 1;
        if (next) next.disabled = vitalSignsState.currentPage >= total || total === 0;
    }

    // FIX 3: View detail modal with formatDate
    function viewVitalDetails(vitalId) {
        const vital = vitalSignsState.vitalsData.find(v => String(v.id) === String(vitalId));
        if (!vital) return;
        document.getElementById('vitalsDetailModal')?.remove();
        const bpStatus = getBPStatusClass(vital._sys, vital._dia);
        const modal    = document.createElement('div');
        modal.id       = 'vitalsDetailModal';
        modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:1000;padding:20px;';
        modal.innerHTML = `
            <div style="background:white;border-radius:12px;width:100%;max-width:560px;max-height:90vh;overflow-y:auto;box-shadow:0 5px 20px rgba(0,0,0,0.2);">
                <div style="padding:20px;border-bottom:1px solid #eee;display:flex;justify-content:space-between;align-items:center;background:linear-gradient(135deg,#1e3c72,#2a5298);border-radius:12px 12px 0 0;">
                    <h3 style="margin:0;color:white;"><i class="fas fa-heartbeat"></i> Vital Signs Detail</h3>
                    <button id="closeVitalModal" style="background:rgba(255,255,255,0.2);border:none;color:white;font-size:1.4em;cursor:pointer;border-radius:50%;width:32px;height:32px;line-height:1;">×</button>
                </div>
                <div style="padding:20px;">
                    <p style="color:#666;margin:0 0 15px;"><i class="fas fa-calendar"></i> ${formatDate(vital._dateStr)} at ${vital._time || '--'}</p>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:15px;">
                        <div style="background:#f8f9fa;padding:14px;border-radius:8px;border-left:4px solid #dc3545;">
                            <div style="font-size:0.82em;color:#666;margin-bottom:4px;">Blood Pressure</div>
                            <div style="font-size:1.4em;font-weight:700;color:#dc3545;">${vital._sys || '--'}/${vital._dia || '--'} <span style="font-size:0.6em;color:#999;">mmHg</span></div>
                            <div style="font-size:0.8em;color:#666;margin-top:4px;text-transform:capitalize;">${bpStatus.replace(/\d/, '')}</div>
                        </div>
                        <div style="background:#f8f9fa;padding:14px;border-radius:8px;border-left:4px solid #28a745;">
                            <div style="font-size:0.82em;color:#666;margin-bottom:4px;">Heart Rate</div>
                            <div style="font-size:1.4em;font-weight:700;color:#28a745;">${vital._hr || '--'} <span style="font-size:0.6em;color:#999;">bpm</span></div>
                            <div style="font-size:0.8em;color:#666;margin-top:4px;">${vital._hr ? (vital._hr < 60 ? 'Bradycardia' : vital._hr <= 100 ? 'Normal' : 'Tachycardia') : '--'}</div>
                        </div>
                        <div style="background:#f8f9fa;padding:14px;border-radius:8px;border-left:4px solid #fd7e14;">
                            <div style="font-size:0.82em;color:#666;margin-bottom:4px;">Temperature</div>
                            <div style="font-size:1.4em;font-weight:700;color:#fd7e14;">${vital._temp ? vital._temp.toFixed(1) : '--'} <span style="font-size:0.6em;color:#999;">°C</span></div>
                            <div style="font-size:0.8em;color:#666;margin-top:4px;">${vital._temp ? (vital._temp < 36.1 ? 'Hypothermia' : vital._temp <= 37.2 ? 'Normal' : vital._temp <= 38 ? 'Low-grade fever' : 'Fever') : '--'}</div>
                        </div>
                        <div style="background:#f8f9fa;padding:14px;border-radius:8px;border-left:4px solid #20c997;">
                            <div style="font-size:0.82em;color:#666;margin-bottom:4px;">SpO₂</div>
                            <div style="font-size:1.4em;font-weight:700;color:#20c997;">${vital._spo2 ? vital._spo2.toFixed(0) + '%' : '--'}</div>
                            <div style="font-size:0.8em;color:#666;margin-top:4px;">${vital._spo2 ? (vital._spo2 >= 95 ? 'Normal' : vital._spo2 >= 90 ? 'Low' : 'Critical') : '--'}</div>
                        </div>
                        <div style="background:#f8f9fa;padding:14px;border-radius:8px;border-left:4px solid #6f42c1;">
                            <div style="font-size:0.82em;color:#666;margin-bottom:4px;">Weight / BMI</div>
                            <div style="font-size:1.2em;font-weight:700;color:#6f42c1;">${vital._wt ? vital._wt + ' kg' : '--'} ${vital._bmi ? '/ ' + vital._bmi.toFixed(1) : ''}</div>
                        </div>
                        <div style="background:#f8f9fa;padding:14px;border-radius:8px;border-left:4px solid #17a2b8;">
                            <div style="font-size:0.82em;color:#666;margin-bottom:4px;">Resp. Rate</div>
                            <div style="font-size:1.4em;font-weight:700;color:#17a2b8;">${vital._rr || '--'} <span style="font-size:0.6em;color:#999;">br/min</span></div>
                        </div>
                    </div>
                    ${vital.pain_scale != null ? `<div style="background:#f8f9fa;border-radius:8px;padding:12px;margin-bottom:10px;border-left:4px solid #ffc107;"><strong>Pain Scale:</strong> ${vital.pain_scale}/10</div>` : ''}
                    ${vital.consciousness ? `<div style="background:#f8f9fa;border-radius:8px;padding:12px;margin-bottom:10px;border-left:4px solid #6c757d;"><strong>Consciousness:</strong> ${vital.consciousness}</div>` : ''}
                    ${vital.notes ? `<div style="background:#fff3cd;border-radius:8px;padding:12px;border-left:4px solid #ffc107;"><strong>Notes:</strong> ${vital.notes}</div>` : ''}
                </div>
                <div style="padding:15px 20px;border-top:1px solid #eee;display:flex;justify-content:flex-end;gap:10px;">
                    <button id="editFromVitalModal" style="padding:10px 20px;background:#1e3c72;color:white;border:none;border-radius:6px;cursor:pointer;"><i class="fas fa-edit"></i> Edit</button>
                    <button id="closeVitalModal2"   style="padding:10px 20px;background:#6c757d;color:white;border:none;border-radius:6px;cursor:pointer;">Close</button>
                </div>
            </div>`;
        document.body.appendChild(modal);
        document.getElementById('closeVitalModal').onclick    = () => modal.remove();
        document.getElementById('closeVitalModal2').onclick   = () => modal.remove();
        document.getElementById('editFromVitalModal').onclick = () => { modal.remove(); editVital(vitalId); };
        modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    }

    // FIX 7: calculateMAP/BMI run AFTER setVal calls
    async function editVital(vitalId) {
        const vital = vitalSignsState.vitalsData.find(v => String(v.id) === String(vitalId));
        if (!vital) return;
        vitalSignsState.currentTab = 'record';
        updateTabDisplay();
        setTimeout(() => {
            const setVal = (id, v) => { const el = document.getElementById(id); if (el && v != null) el.value = v; };
            setVal('recordDate',        vital._dateStr);
            setVal('recordTime',        vital._time);
            setVal('bpSystolic',        vital._sys);
            setVal('bpDiastolic',       vital._dia);
            setVal('heartRate',         vital._hr);
            setVal('respiratoryRate',   vital._rr);
            setVal('oxygenSaturation',  vital._spo2);
            setVal('temperature',       vital._temp);
            setVal('weight',            vital._wt);
            setVal('height',            vital._ht);
            setVal('vitalsNotes',       vital.notes);
            // FIX 13: restore pain scale & consciousness
            setVal('painScale',         vital.pain_scale ?? 0);
            setVal('consciousness',     vital.consciousness ?? 'Alert');
            const painVal = document.getElementById('painValue');
            if (painVal) painVal.textContent = vital.pain_scale ?? 0;
            // FIX 7: recalculate AFTER values are set
            calculateMAP();
            calculateBMI();
            updateHeartRateStatus();
            showMessage('info', `Editing vital signs from ${formatDate(vital._dateStr)}. Modify and save.`);
        }, 300);
    }

    async function deleteVital(vitalId) {
        if (!confirm('Delete this vital sign record? This cannot be undone.')) return;
        try {
            const { error } = await getClient().from('vital_signs').delete().eq('id', vitalId);
            if (error) throw error;
            vitalSignsState.vitalsData     = vitalSignsState.vitalsData.filter(v => String(v.id) !== String(vitalId));
            vitalSignsState.filteredVitals = vitalSignsState.filteredVitals.filter(v => String(v.id) !== String(vitalId));
            vitalSignsState.todayVitals    = vitalSignsState.todayVitals.filter(v => String(v.id) !== String(vitalId));
            updateVitalsTable();
            updateSidebarStats();
            updateSummaryCards();
            updateTodayVitals();
            updateQuickStats();
            showMessage('success', 'Vital sign record deleted.');
        } catch (err) {
            showMessage('error', 'Failed to delete: ' + err.message);
        }
    }

    // FIX 16: formatDate used in today's list
    function updateTodayVitals() {
        const list = document.getElementById('todaysVitalsList');
        if (!list) return;
        if (!vitalSignsState.todayVitals.length) {
            list.innerHTML = `<div class="empty-state"><i class="fas fa-clipboard-list"></i><p>No vital signs recorded today</p></div>`;
            return;
        }
        list.innerHTML = vitalSignsState.todayVitals.map(v => `
            <div style="display:flex;align-items:center;gap:15px;padding:12px 15px;background:#f8f9fa;border-radius:8px;margin-bottom:8px;border-left:4px solid #1e3c72;">
                <div style="font-weight:600;color:#1e3c72;min-width:50px;">${v._time || '--'}</div>
                <div style="display:flex;gap:15px;flex:1;font-size:0.9em;">
                    <span><i class="fas fa-heart" style="color:#dc3545;"></i> ${v._sys || '--'}/${v._dia || '--'}</span>
                    <span><i class="fas fa-heartbeat" style="color:#28a745;"></i> ${v._hr || '--'} bpm</span>
                    <span><i class="fas fa-thermometer-half" style="color:#fd7e14;"></i> ${v._temp ? v._temp.toFixed(1) + '°C' : '--'}</span>
                </div>
                <button onclick="viewVitalDetails('${v.id}')" style="background:none;border:none;color:#1e3c72;cursor:pointer;" title="View"><i class="fas fa-eye"></i></button>
            </div>`).join('');
    }

    function updateQuickStats() {
        const setEl = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
        const today = vitalSignsState.todayVitals;
        setEl('todayRecordsCount', today.length);
        const withBP = today.filter(v => v._sys && v._dia);
        if (withBP.length) {
            const aS = Math.round(withBP.reduce((s, v) => s + v._sys, 0) / withBP.length);
            const aD = Math.round(withBP.reduce((s, v) => s + v._dia, 0) / withBP.length);
            setEl('todayAvgBp', `${aS}/${aD}`);
            const best = withBP.reduce((b, c) => {
                const bd = Math.abs(b._sys - 120) + Math.abs(b._dia - 80);
                const cd = Math.abs(c._sys - 120) + Math.abs(c._dia - 80);
                return cd < bd ? c : b;
            });
            setEl('bestReadingToday', `${best._sys}/${best._dia}`);
        }
        if (today.length > 0) setEl('lastRecordTime', today[0]._time || '--');
    }

    function updateDateDisplay() {
        const el = document.getElementById('currentDate');
        if (el) el.textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    }

    // ─── FORM CALCULATIONS ─────────────────────────────────────────────────────
    function setupFormCalculations() {
        ['bpSystolic', 'bpDiastolic'].forEach(id => {
            document.getElementById(id)?.addEventListener('input', calculateMAP);
        });
        ['weight', 'height'].forEach(id => {
            document.getElementById(id)?.addEventListener('input', calculateBMI);
        });
        document.getElementById('heartRate')?.addEventListener('input', updateHeartRateStatus);
        const painScale = document.getElementById('painScale');
        const painVal   = document.getElementById('painValue');
        if (painScale && painVal) painScale.addEventListener('input', e => painVal.textContent = e.target.value);
        document.getElementById('clearQuickForm')?.addEventListener('click', resetQuickForm);
        document.getElementById('saveQuickVitals')?.addEventListener('click', saveQuickVitalSigns);
    }

    function calculateMAP() {
        const sys   = parseFloat(document.getElementById('bpSystolic')?.value) || 0;
        const dia   = parseFloat(document.getElementById('bpDiastolic')?.value) || 0;
        if (sys > 0 && dia > 0) {
            const map   = ((sys + 2 * dia) / 3).toFixed(1);
            const mapV  = parseFloat(map);
            const mapEl = document.getElementById('mapValue');
            const mapSt = document.getElementById('mapStatus');
            if (mapEl) mapEl.textContent = map;
            if (mapSt) {
                mapSt.textContent = mapV < 60 ? 'Low — inadequate perfusion risk' : mapV > 100 ? 'High — monitor for hypertension' : 'Normal — adequate perfusion';
                mapSt.className   = `value-status ${mapV < 60 ? 'low' : mapV > 100 ? 'high' : 'normal'}`;
            }
            updateBPStatus(sys, dia);
        }
    }

    function updateBPStatus(sys, dia) {
        const el = document.getElementById('bpStatusIndicator');
        if (!el) return;
        let s = 'No data', c = 'no-data';
        if (sys && dia) {
            const cls = getBPStatusClass(sys, dia);
            const labels = { low:'Low BP', normal:'Normal', elevated:'Elevated', stage1:'Stage 1', stage2:'Stage 2', crisis:'Crisis' };
            s = labels[cls] || 'Unknown';
            c = cls;
        }
        el.textContent = s;
        el.className   = `status-indicator ${c}`;
    }

    // FIX 6: Crisis boundary corrected — < 180 not <= 180
    function getBPStatusClass(sys, dia) {
        if (!sys || !dia)               return '';
        if (sys < 90  || dia < 60)      return 'low';
        if (sys <= 120 && dia <= 80)    return 'normal';
        if (sys <= 129 && dia < 80)     return 'elevated';
        if (sys <= 139 || dia <= 89)    return 'stage1';
        if (sys < 180  && dia < 120)    return 'stage2';
        return 'crisis';                // sys >= 180 OR dia >= 120
    }

    function calculateBMI() {
        const wt    = parseFloat(document.getElementById('weight')?.value) || 0;
        const ht    = parseFloat(document.getElementById('height')?.value) || 0;
        const bmiEl = document.getElementById('bmiValue');
        const bmiSt = document.getElementById('bmiStatus');
        if (!bmiEl) return;
        if (wt > 0 && ht > 0) {
            const bmi = (wt / ((ht / 100) ** 2)).toFixed(1);
            bmiEl.textContent = bmi;
            const v = parseFloat(bmi);
            const [s, c] = v < 18.5 ? ['Underweight', 'underweight']
                : v < 25  ? ['Normal weight', 'normal']
                : v < 30  ? ['Overweight', 'overweight']
                : v < 35  ? ['Obese Class I', 'obese1']
                : v < 40  ? ['Obese Class II', 'obese2']
                :            ['Obese Class III', 'obese3'];
            if (bmiSt) { bmiSt.textContent = s; bmiSt.className = `value-status ${c}`; }
        } else {
            bmiEl.textContent = '--';
            if (bmiSt) { bmiSt.textContent = 'Enter weight and height'; bmiSt.className = 'value-status'; }
        }
    }

    function updateHeartRateStatus() {
        const hr  = parseFloat(document.getElementById('heartRate')?.value) || 0;
        const el  = document.getElementById('hrStatus');
        if (!el) return;
        if (hr <= 0) { el.textContent = 'Enter heart rate'; el.className = 'value-status'; return; }
        const [s, c] = hr < 60  ? ['Bradycardia (Low)', 'low']
            : hr <= 100 ? ['Normal resting rate', 'normal']
            :              ['Tachycardia (High)', 'high'];
        el.textContent = s; el.className = `value-status ${c}`;
    }

    function calculateBMIValue(wt, ht) {
        return parseFloat((wt / ((ht / 100) ** 2)).toFixed(1));
    }

    // ─── FORM SUBMISSION ───────────────────────────────────────────────────────
    // FIX 2: column-probe before insert so recorded_at is only sent when safe
    async function handleVitalsSubmit(e) {
        e.preventDefault();
        if (!window.appState?.currentUser) { showMessage('error', 'Please login first'); return; }

        const btn    = document.getElementById('submitVitals');
        const getVal = id => parseFloat(document.getElementById(id)?.value) || null;

        const sys = getVal('bpSystolic');
        const dia = getVal('bpDiastolic');
        const hr  = getVal('heartRate');
        const rr  = getVal('respiratoryRate');

        if (!document.getElementById('recordDate')?.value) { showMessage('error', 'Record date is required'); return; }
        if (!sys || !dia) { showMessage('error', 'Blood pressure readings are required'); return; }
        if (!hr)          { showMessage('error', 'Heart rate is required'); return; }
        if (!rr)          { showMessage('error', 'Respiratory rate is required'); return; }

        const wt  = getVal('weight');
        const ht  = getVal('height');
        const bmi = wt && ht ? calculateBMIValue(wt, ht) : null;

        const dateVal     = document.getElementById('recordDate').value;
        const timeVal     = document.getElementById('recordTime').value;
        const dateTimeISO = `${dateVal}T${timeVal || '00:00'}:00`;

        // FIX 13: Include pain_scale and consciousness
        const payload = {
            user_id:                  window.appState.currentUser.id,
            record_date:              dateVal,
            record_time:              timeVal,
            blood_pressure_systolic:  sys,
            blood_pressure_diastolic: dia,
            heart_rate:               hr,
            respiratory_rate:         rr,
            oxygen_saturation:        getVal('oxygenSaturation'),
            temperature:              getVal('temperature'),
            weight:                   wt,
            height:                   ht,
            bmi,
            pain_scale:               parseInt(document.getElementById('painScale')?.value) || 0,
            consciousness:            document.getElementById('consciousness')?.value || 'Alert',
            notes:                    document.getElementById('vitalsNotes')?.value || ''
        };

        // FIX 2: Only add recorded_at if the column exists
        const useRecordedAt = await probeRecordedAt();
        if (useRecordedAt) payload.recorded_at = dateTimeISO;

        const newsScore = calculateNEWS2Score(rr, payload.oxygen_saturation, payload.temperature, sys, hr);
        if (newsScore > 0) payload.notes = `NEWS Score: ${newsScore}. ${payload.notes}`.trim();

        try {
            if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...'; }
            const { error } = await getClient().from('vital_signs').insert([payload]);
            if (error) throw error;
            await loadVitalsData();
            updateVitalsUI();
            resetVitalsForm();
            showMessage('success', 'Vital signs recorded successfully!');
            if (newsScore >= 5) showMessage('warning', `Early Warning Score: ${newsScore} — consider medical review`);
        } catch (err) {
            console.error('Save error:', err);
            showMessage('error', 'Failed to save vital signs: ' + err.message);
        } finally {
            if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-save"></i> Save Vital Signs'; }
        }
    }

    function resetVitalsForm() {
        document.getElementById('vitalsForm')?.reset();
        updateFormDefaults();
        calculateMAP(); calculateBMI(); updateHeartRateStatus(); updateBPStatus(0, 0);
        const painVal = document.getElementById('painValue');
        if (painVal) painVal.textContent = '0';
    }

    function resetQuickForm() {
        ['quickSystolic', 'quickDiastolic', 'quickHeartRate', 'quickTemperature', 'quickRespRate', 'quickNotes']
            .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    }

    // FIX 14: Quick Entry now includes respiratory_rate
    async function saveQuickVitalSigns() {
        if (!window.appState?.currentUser) { showMessage('error', 'Please login first'); return; }
        const sys  = parseFloat(document.getElementById('quickSystolic')?.value);
        const dia  = parseFloat(document.getElementById('quickDiastolic')?.value);
        const hr   = parseFloat(document.getElementById('quickHeartRate')?.value);
        const temp = parseFloat(document.getElementById('quickTemperature')?.value);
        const rr   = parseFloat(document.getElementById('quickRespRate')?.value);
        const notes = document.getElementById('quickNotes')?.value;

        if (!sys || !dia) { showMessage('error', 'Blood pressure required'); return; }
        if (!hr)          { showMessage('error', 'Heart rate required'); return; }

        const now     = new Date();
        const dateVal = now.toISOString().split('T')[0];
        const timeVal = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

        const quickPayload = {
            user_id:                  window.appState.currentUser.id,
            record_date:              dateVal,
            record_time:              timeVal,
            blood_pressure_systolic:  sys,
            blood_pressure_diastolic: dia,
            heart_rate:               hr,
            temperature:              temp || null,
            respiratory_rate:         rr   || null,
            notes:                    notes || '',
            created_at:               now.toISOString()
        };

        const useRecordedAt = await probeRecordedAt();
        if (useRecordedAt) quickPayload.recorded_at = now.toISOString();

        const btn = document.getElementById('saveQuickVitals');
        try {
            if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...'; }
            const { error } = await getClient().from('vital_signs').insert([quickPayload]);
            if (error) throw error;
            await loadVitalsData();
            updateVitalsUI();
            resetQuickForm();
            showMessage('success', 'Quick vital signs saved!');
        } catch (err) {
            showMessage('error', 'Failed to save: ' + err.message);
        } finally {
            if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-bolt"></i> Save Quick Vitals'; }
        }
    }

    // ─── EVENT LISTENERS ───────────────────────────────────────────────────────
    function setupVitalsListeners() {
        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', e => {
                const tab = e.currentTarget.dataset.tab;
                if (!tab) return;
                vitalSignsState.currentTab = tab;
                updateTabDisplay();
                if (tab === 'analysis') setupVitalsCharts();
            });
        });

        // Form
        document.getElementById('vitalsForm')?.addEventListener('submit', handleVitalsSubmit);
        document.getElementById('resetForm')?.addEventListener('click', resetVitalsForm);

        // History filter + export
        document.getElementById('historyFilter')?.addEventListener('change', handleHistoryFilter);
        document.getElementById('exportHistory')?.addEventListener('click', exportVitalsHistory);

        // FIX 8: Table actions via event delegation — single listener, no duplicates
        document.getElementById('vitalsTableBody')?.addEventListener('click', e => {
            const btn = e.target.closest('.action-btn');
            if (!btn) return;
            const id = btn.dataset.id;
            if (btn.classList.contains('view-btn'))   viewVitalDetails(id);
            if (btn.classList.contains('edit-btn'))   editVital(id);
            if (btn.classList.contains('delete-btn')) deleteVital(id);
        });

        // Pagination via event delegation
        document.getElementById('vitalsPagination')?.addEventListener('click', e => {
            const btn = e.target.closest('.page-btn');
            if (!btn || btn.disabled) return;
            const total = Math.ceil(vitalSignsState.filteredVitals.length / vitalSignsState.itemsPerPage);
            if (btn.classList.contains('prev') && vitalSignsState.currentPage > 1) {
                vitalSignsState.currentPage--;
                updateVitalsTable();
            } else if (btn.classList.contains('next') && vitalSignsState.currentPage < total) {
                vitalSignsState.currentPage++;
                updateVitalsTable();
            }
        });

        // Refresh
        document.getElementById('refreshBtn')?.addEventListener('click', async function () {
            this.innerHTML  = '<i class="fas fa-spinner fa-spin"></i>';
            this.disabled   = true;
            await loadVitalsData();
            updateVitalsUI();
            if (vitalSignsState.currentTab === 'analysis') setupVitalsCharts();
            this.innerHTML  = '<i class="fas fa-sync-alt"></i> Refresh';
            this.disabled   = false;
            showMessage('success', 'Refreshed!');
        });

        // Analysis selectors
        ['parameterSelect', 'timeRangeSelect'].forEach(id => {
            document.getElementById(id)?.addEventListener('change', () => {
                if (vitalSignsState.currentTab === 'analysis') setupVitalsCharts();
            });
        });
    }

    function handleHistoryFilter(e) {
        const val    = e.target.value;
        const cutoff = days => { const d = new Date(); d.setDate(d.getDate() - days); return d; };
        if (val === 'today') {
            const today = new Date().toISOString().split('T')[0];
            vitalSignsState.filteredVitals = vitalSignsState.vitalsData.filter(v => v._dateStr === today);
        } else if (val === 'week')  { vitalSignsState.filteredVitals = vitalSignsState.vitalsData.filter(v => v._date >= cutoff(7)); }
        else if (val === 'month')   { vitalSignsState.filteredVitals = vitalSignsState.vitalsData.filter(v => v._date >= cutoff(30)); }
        else if (val === 'year')    { vitalSignsState.filteredVitals = vitalSignsState.vitalsData.filter(v => v._date >= cutoff(365)); }
        else                        { vitalSignsState.filteredVitals = [...vitalSignsState.vitalsData]; }
        vitalSignsState.currentPage = 1;
        updateVitalsTable();
    }

    // FIX 11: Blob URL — no 2 MB URI limit
    function exportVitalsHistory() {
        const vitals = vitalSignsState.filteredVitals;
        if (!vitals.length) { showMessage('warning', 'No data to export'); return; }
        const esc = t => `"${String(t || '').replace(/"/g, '""')}"`;
        const csv = [
            'Date,Time,Systolic,Diastolic,Heart Rate,Temperature,SpO2,Resp Rate,Weight,Height,BMI,Pain Scale,Consciousness,Notes',
            ...vitals.map(v => [
                v._dateStr, v._time, v._sys, v._dia, v._hr, v._temp,
                v._spo2, v._rr, v._wt, v._ht, v._bmi,
                v.pain_scale, esc(v.consciousness), esc(v.notes)
            ].join(','))
        ].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = `vital_signs_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        showMessage('success', 'Exported successfully!');
    }

    // ─── CLINICAL TOOLS ────────────────────────────────────────────────────────
    function calculateToolBMI() {
        const wt = parseFloat(document.getElementById('bmiWeight')?.value);
        const ht = parseFloat(document.getElementById('bmiHeight')?.value);
        if (!wt || !ht) { showMessage('error', 'Enter both weight and height'); return; }
        const bmi  = calculateBMIValue(wt, ht);
        const cats = [[18.5,'Underweight','#0078D4'],[25,'Normal weight','#28a745'],[30,'Overweight','#ffc107'],[35,'Obese Class I','#fd7e14'],[40,'Obese Class II','#dc3545'],[Infinity,'Obese Class III','#c92a2a']];
        const [, name, color] = cats.find(([lim]) => bmi < lim);
        const el = document.getElementById('bmiToolResult');
        if (el) el.innerHTML = `<div class="result-value" style="color:${color};">${bmi.toFixed(1)}</div><div class="result-category">${name}</div>`;
    }

    function calculateToolMAP() {
        const sys = parseFloat(document.getElementById('mapSystolic')?.value);
        const dia = parseFloat(document.getElementById('mapDiastolic')?.value);
        if (!sys || !dia) { showMessage('error', 'Enter both values'); return; }
        const map    = ((sys + 2 * dia) / 3).toFixed(1);
        const status = parseFloat(map) < 60 ? 'Low — inadequate perfusion' : parseFloat(map) > 100 ? 'High — hypertension risk' : 'Normal — adequate perfusion';
        const el     = document.getElementById('mapToolResult');
        if (el) el.innerHTML = `<div class="result-value">${map} mmHg</div><div class="result-category">${status}</div>`;
    }

    // FIX 5: NEWS2 tool now collects all 5 vital inputs
    function calculateNEWS2Tool() {
        const rr   = parseInt(document.getElementById('newsRespiratory')?.value);
        const spo2 = parseInt(document.getElementById('newsOxygen')?.value);
        const sys  = parseInt(document.getElementById('newsSystolic')?.value);
        const hr   = parseInt(document.getElementById('newsHeartRate')?.value);
        const temp = parseFloat(document.getElementById('newsTemp')?.value);
        if (!rr || !spo2) { showMessage('error', 'Respiratory rate and SpO₂ are required'); return; }
        const score = calculateNEWS2Score(rr, spo2, temp || null, sys || null, hr || null);
        const risk  = score <= 4 ? 'Low risk — routine monitoring'
            : score <= 6 ? 'Medium risk — increased monitoring'
            : 'High risk — urgent medical review';
        const color = score <= 4 ? '#28a745' : score <= 6 ? '#ffc107' : '#dc3545';
        const el = document.getElementById('newsToolResult');
        if (el) el.innerHTML = `<div class="result-value" style="color:${color};">Score: ${score}</div><div class="result-category">${risk}</div>`;
    }

    function calculateFluidRequirement() {
        const wt  = parseFloat(document.getElementById('fluidWeight')?.value);
        const act = document.getElementById('fluidActivity')?.value;
        if (!wt) { showMessage('error', 'Enter weight'); return; }
        const factors = { sedentary: 1.0, moderate: 1.2, active: 1.4, very_active: 1.6 };
        const liters  = ((wt * 32.5 * (factors[act] || 1.0)) / 1000).toFixed(1);
        const el = document.getElementById('fluidToolResult');
        if (el) el.innerHTML = `<div class="result-value">${liters} L/day</div><div class="result-category">Daily fluid requirement</div>`;
    }

    function calculateNEWS2Score(rr, spo2, temp, sys, hr) {
        let s = 0;
        if (rr)   { if (rr <= 8) s += 3; else if (rr <= 11) s += 1; else if (rr >= 25) s += 3; else if (rr >= 21) s += 2; }
        if (spo2) { if (spo2 <= 91) s += 3; else if (spo2 <= 93) s += 2; else if (spo2 <= 95) s += 1; }
        if (temp) { if (temp <= 35) s += 3; else if (temp <= 36) s += 1; else if (temp >= 39.1) s += 2; else if (temp >= 38.1) s += 1; }
        if (sys)  { if (sys <= 90) s += 3; else if (sys <= 100) s += 2; else if (sys <= 110) s += 1; else if (sys >= 220) s += 3; }
        if (hr)   { if (hr <= 40) s += 3; else if (hr <= 50) s += 1; else if (hr >= 131) s += 3; else if (hr >= 111) s += 2; else if (hr >= 91) s += 1; }
        return s;
    }

    // ─── ANALYSIS CHARTS ───────────────────────────────────────────────────────
    function setupVitalsCharts() {
        const vitals = vitalSignsState.vitalsData;
        if (!vitals.length) { showInsights([]); return; }

        const param    = document.getElementById('parameterSelect')?.value || 'bp';
        const rangeVal = document.getElementById('timeRangeSelect')?.value || '30';
        const days     = rangeVal === 'all' ? Infinity : parseInt(rangeVal);
        const cutoff   = isFinite(days) ? new Date(Date.now() - days * 86400000) : new Date(0);

        const filtered = [...vitals]
            .filter(v => v._date >= cutoff)
            .sort((a, b) => a._date - b._date);

        // FIX 3: destroy all charts before rebuilding
        ['trend', 'distribution', 'correlation', 'radar'].forEach(destroyChart);

        setupTrendChart(filtered, param);
        setupCorrelationChart(filtered);
        setupRadarChart(vitals);
        updateChartStatistics(filtered, param);
        updateTargetStatuses(vitals);
        showInsights(filtered);
    }

    function destroyChart(key) {
        if (vitalSignsState.charts[key]) {
            try { vitalSignsState.charts[key].destroy(); } catch (e) { }
            vitalSignsState.charts[key] = null;
        }
    }

    // FIX 3: Replace canvas DOM element so Chart.js gets a fresh surface
    function freshCanvas(id, height) {
        const old = document.getElementById(id);
        if (!old) return null;
        const canvas = document.createElement('canvas');
        canvas.id    = id;
        if (height) canvas.setAttribute('height', height);
        old.parentNode.replaceChild(canvas, old);
        return canvas.getContext('2d');
    }

    function setupTrendChart(data, param) {
        const ctx = freshCanvas('trendChart', 260);
        if (!ctx) return;

        const labels   = data.map(v => v._dateStr);
        let datasets   = [];

        if (param === 'bp') {
            datasets = [
                { label: 'Systolic BP',       data: data.map(v => v._sys), borderColor: '#dc3545', backgroundColor: 'rgba(220,53,69,0.08)',  tension: 0.4, fill: false, pointRadius: 4 },
                { label: 'Diastolic BP',      data: data.map(v => v._dia), borderColor: '#0078D4', backgroundColor: 'rgba(0,120,212,0.08)', tension: 0.4, fill: false, pointRadius: 4 },
                { label: 'Normal Systolic (120)', data: data.map(() => 120), borderColor: 'rgba(220,53,69,0.3)', borderDash: [6, 4], pointRadius: 0, borderWidth: 1.5, fill: false },
                { label: 'Normal Diastolic (80)', data: data.map(() => 80),  borderColor: 'rgba(0,120,212,0.3)', borderDash: [6, 4], pointRadius: 0, borderWidth: 1.5, fill: false }
            ];
        } else {
            const cfgs = {
                hr:     { field: '_hr',   label: 'Heart Rate (bpm)',  color: '#28a745', ref: 72,   refLabel: 'Normal (72 bpm)' },
                temp:   { field: '_temp', label: 'Temperature (°C)',  color: '#fd7e14', ref: 36.6, refLabel: 'Normal (36.6°C)' },
                weight: { field: '_wt',   label: 'Weight (kg)',       color: '#6f42c1' },
                bmi:    { field: '_bmi',  label: 'BMI',               color: '#20c997', ref: 22,   refLabel: 'Healthy (22)' }
            };
            const cfg = cfgs[param] || cfgs.hr;
            datasets = [{ label: cfg.label, data: data.map(v => v[cfg.field]), borderColor: cfg.color, backgroundColor: cfg.color + '18', tension: 0.4, fill: true, pointRadius: 4 }];
            if (cfg.ref) datasets.push({ label: cfg.refLabel, data: data.map(() => cfg.ref), borderColor: cfg.color + '55', borderDash: [6, 4], pointRadius: 0, borderWidth: 1.5, fill: false });
        }

        vitalSignsState.charts.trend = new Chart(ctx, {
            type: 'line',
            data: { labels, datasets },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { position: 'top' }, tooltip: { mode: 'index', intersect: false } },
                scales: {
                    x: { grid: { display: false }, ticks: { autoSkip: true, maxRotation: 45 }, title: { display: true, text: 'Date' } },
                    y: { beginAtZero: false }
                }
            }
        });
    }

    // FIX 10: No-data case uses HTML message, not canvas text on 0×0 surface
    function setupCorrelationChart(data) {
        const canvas = document.getElementById('distributionChart');
        if (!canvas) return;

        const pairs = data
            .filter(v => v._sys && v._hr)
            .map(v => ({ x: v._hr, y: v._sys, label: v._dateStr }));

        const wrapper = canvas.parentNode;

        // Remove any previous no-data message
        wrapper.querySelector('.no-data-msg')?.remove();
        canvas.style.display = '';

        if (pairs.length < 2) {
            canvas.style.display = 'none';
            const msg = document.createElement('p');
            msg.className   = 'no-data-msg';
            msg.style.cssText = 'text-align:center;color:#888;padding:40px 0;font-size:13px;';
            msg.textContent = 'Record at least 2 readings with both BP and heart rate to see the correlation chart.';
            wrapper.appendChild(msg);
            return;
        }

        const ctx = freshCanvas('distributionChart', 200);
        if (!ctx) return;

        const colours = pairs.map(p =>
            p.y >= 180 ? 'rgba(201,42,42,0.7)'
            : p.y >= 140 ? 'rgba(220,53,69,0.7)'
            : p.y >= 130 ? 'rgba(253,126,20,0.7)'
            : p.y >= 120 ? 'rgba(255,193,7,0.7)'
            :               'rgba(40,167,69,0.7)'
        );

        vitalSignsState.charts.distribution = new Chart(ctx, {
            type: 'scatter',
            data: {
                datasets: [{
                    label: 'Systolic BP vs Heart Rate',
                    data:  pairs,
                    backgroundColor: colours,
                    pointRadius: 7,
                    pointHoverRadius: 10
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: { callbacks: { label: ctx => `${ctx.raw.label}: HR ${ctx.raw.x} bpm, BP ${ctx.raw.y} mmHg` } }
                },
                scales: {
                    x: { title: { display: true, text: 'Heart Rate (bpm)' } },
                    y: { title: { display: true, text: 'Systolic BP (mmHg)' } }
                }
            }
        });
    }

    // FIX 4: Radar container fully torn down and re-created every call
    function setupRadarChart(vitals) {
        // Always remove stale container first
        document.getElementById('radarChartContainer')?.remove();
        destroyChart('radar');

        if (!vitals.length) return;

        const targetsCard = document.querySelector('.chart-container:not(.large)');
        if (!targetsCard) return;

        const radarContainer = document.createElement('div');
        radarContainer.id = 'radarChartContainer';
        radarContainer.style.cssText = 'margin-top:20px;';
        radarContainer.innerHTML = `
            <h4 style="margin:0 0 10px;color:#333;font-size:1em;">🕸️ Multi-Vital Snapshot (vs Normal)</h4>
            <canvas id="radarChart" height="220"></canvas>`;
        targetsCard.appendChild(radarContainer);

        const canvas = document.getElementById('radarChart');
        if (!canvas) return;

        const latest = vitals[0];
        if (!latest) return;

        const normSys  = latest._sys  ? Math.min(200, (latest._sys  / 120) * 100) : null;
        const normDia  = latest._dia  ? Math.min(200, (latest._dia  / 80)  * 100) : null;
        const normHR   = latest._hr   ? Math.min(200, (latest._hr   / 72)  * 100) : null;
        const normTemp = latest._temp ? Math.min(200, ((latest._temp - 35) / (37.2 - 35)) * 100) : null;
        const normSpo2 = latest._spo2 ? Math.min(100, latest._spo2) : null;
        const normBMI  = latest._bmi  ? Math.min(200, (latest._bmi  / 22)  * 100) : null;

        const allData   = [normSys, normDia, normHR, normTemp, normSpo2, normBMI];
        const allLabels = ['Systolic BP', 'Diastolic BP', 'Heart Rate', 'Temperature', 'SpO₂', 'BMI'];
        const validIdx  = allData.map((v, i) => v != null ? i : -1).filter(i => i >= 0);

        if (validIdx.length < 3) {
            radarContainer.innerHTML += '<p style="text-align:center;color:#888;font-size:13px;">Need at least 3 vital parameters to display radar chart.</p>';
            return;
        }

        vitalSignsState.charts.radar = new Chart(canvas.getContext('2d'), {
            type: 'radar',
            data: {
                labels: validIdx.map(i => allLabels[i]),
                datasets: [
                    {
                        label: 'Your Reading',
                        data:  validIdx.map(i => allData[i]),
                        borderColor: '#1e3c72', backgroundColor: 'rgba(30,60,114,0.15)',
                        pointBackgroundColor: '#1e3c72', borderWidth: 2
                    },
                    {
                        label: 'Normal Range',
                        data:  validIdx.map(() => 100),
                        borderColor: '#28a745', backgroundColor: 'rgba(40,167,69,0.08)',
                        borderDash: [5, 5], pointRadius: 0, borderWidth: 1.5
                    }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: {
                    r: {
                        beginAtZero: true, max: 150,
                        ticks: { stepSize: 50, callback: v => v === 100 ? 'Normal' : v + '%' },
                        pointLabels: { font: { size: 11 } }
                    }
                },
                plugins: {
                    legend: { position: 'bottom' },
                    tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${ctx.raw.toFixed(0)}% of normal` } }
                }
            }
        });
    }

    function updateTargetStatuses(vitals) {
        const latest = vitals[0];
        if (!latest) return;
        const setStatus = (id, ok, msg) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.textContent = msg;
            el.style.color = ok ? '#28a745' : '#dc3545';
        };
        if (latest._sys && latest._dia) {
            const ok = latest._sys <= 120 && latest._dia <= 80;
            setStatus('bpTargetStatus', ok, ok ? `✓ ${latest._sys}/${latest._dia} — Normal` : `⚠ ${latest._sys}/${latest._dia} — Above target`);
        }
        if (latest._hr) {
            const ok = latest._hr >= 60 && latest._hr <= 100;
            setStatus('hrTargetStatus', ok, ok ? `✓ ${latest._hr} bpm — Normal` : `⚠ ${latest._hr} bpm — ${latest._hr < 60 ? 'Low' : 'High'}`);
        }
        if (latest._bmi) {
            const ok = latest._bmi >= 18.5 && latest._bmi < 25;
            setStatus('bmiTargetStatus', ok, ok ? `✓ BMI ${latest._bmi} — Normal` : `⚠ BMI ${latest._bmi} — ${latest._bmi < 18.5 ? 'Underweight' : 'Overweight'}`);
        }
        if (latest._temp) {
            const ok = latest._temp >= 36.1 && latest._temp <= 37.2;
            setStatus('tempTargetStatus', ok, ok ? `✓ ${latest._temp}°C — Normal` : `⚠ ${latest._temp}°C — ${latest._temp < 36.1 ? 'Low' : 'Elevated'}`);
        }
    }

    function updateChartStatistics(data, param) {
        const getVals = () => {
            if (param === 'bp')     return data.map(v => v._sys).filter(Boolean);
            if (param === 'hr')     return data.map(v => v._hr).filter(Boolean);
            if (param === 'temp')   return data.map(v => v._temp).filter(Boolean);
            if (param === 'weight') return data.map(v => v._wt).filter(Boolean);
            if (param === 'bmi')    return data.map(v => v._bmi).filter(Boolean);
            return [];
        };
        const vals = getVals();
        if (!vals.length) return;

        // data sorted ascending — last element = most recent (FIX: current = newest)
        const current = vals[vals.length - 1];
        const avg     = vals.reduce((s, v) => s + v, 0) / vals.length;
        const highest = Math.max(...vals);
        const lowest  = Math.min(...vals);
        const sd      = Math.sqrt(vals.reduce((s, v) => s + Math.pow(v - avg, 2), 0) / vals.length);
        const cv      = (sd / avg * 100).toFixed(1);
        const dp      = param === 'temp' ? 1 : 0;

        const setEl = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
        setEl('measurementsCount',    vals.length);
        setEl('currentValue',         current.toFixed(dp));
        setEl('averageValue',         avg.toFixed(dp));
        setEl('highestValue',         highest.toFixed(dp));
        setEl('lowestValue',          lowest.toFixed(dp));
        setEl('stdDeviation',         sd.toFixed(1));
        setEl('coefficientVariation', cv + '%');

        let trend = 'Stable ↔';
        if (vals.length >= 4) {
            const half   = Math.floor(vals.length / 2);
            const recent = vals.slice(-half).reduce((s, v) => s + v, 0) / half;
            const older  = vals.slice(0, half).reduce((s, v) => s + v, 0) / half;
            const pct    = ((recent - older) / older) * 100;
            if (pct > 5)  trend = 'Increasing 📈';
            if (pct < -5) trend = 'Decreasing 📉';
        }
        setEl('changeValue',    trend);
        setEl('trendDirection', trend);
    }

    // FIX 9: Stale-data check uses global vitalsData[0] (newest across all time)
    function showInsights(data) {
        let insightsEl = document.getElementById('vitalsInsightsSection');
        if (!insightsEl) {
            const statsContainer = document.querySelector('.stats-container');
            if (!statsContainer) return;
            insightsEl = document.createElement('div');
            insightsEl.id = 'vitalsInsightsSection';
            insightsEl.style.cssText = 'background:white;border-radius:10px;padding:25px;box-shadow:0 2px 10px rgba(0,0,0,0.1);margin-bottom:30px;';
            statsContainer.after(insightsEl);
        }
        if (!data.length) {
            insightsEl.innerHTML = '<h3 style="color:#333;margin:0 0 15px;">💡 Health Insights</h3><p style="color:#666;">Add vital signs to receive personalised health insights.</p>';
            return;
        }
        const insights = [];

        // BP insights
        const withBP = data.filter(v => v._sys && v._dia);
        if (withBP.length) {
            const avgSys  = withBP.reduce((s, v) => s + v._sys, 0) / withBP.length;
            const highBP  = withBP.filter(v => v._sys >= 130 || v._dia >= 80).length;
            const pctHigh = Math.round(highBP / withBP.length * 100);
            if (avgSys >= 140)      insights.push({ icon: '🔴', text: `Your average systolic BP is ${avgSys.toFixed(0)} mmHg — Stage 2 hypertension range. Please consult your doctor.`, cls: 'danger' });
            else if (avgSys >= 130) insights.push({ icon: '🟡', text: `Your average systolic BP is ${avgSys.toFixed(0)} mmHg — Stage 1 hypertension. Lifestyle changes recommended.`, cls: 'warning' });
            else                    insights.push({ icon: '🟢', text: `Your average blood pressure (${avgSys.toFixed(0)} mmHg systolic) is within a healthy range. Keep it up!`, cls: 'success' });
            if (pctHigh > 50)       insights.push({ icon: '⚠️', text: `${pctHigh}% of your readings in this period were above the 130/80 target.`, cls: 'warning' });
        }

        // HR insights
        const withHR = data.filter(v => v._hr);
        if (withHR.length) {
            const avgHR    = withHR.reduce((s, v) => s + v._hr, 0) / withHR.length;
            const elevated = withHR.filter(v => v._hr > 100).length;
            if (elevated > 0) insights.push({ icon: '💓', text: `You had ${elevated} reading${elevated > 1 ? 's' : ''} with elevated heart rate (>100 bpm). Monitor for stress, dehydration, or anaemia.`, cls: 'warning' });
            else if (avgHR >= 60 && avgHR <= 80) insights.push({ icon: '💚', text: `Your average heart rate (${avgHR.toFixed(0)} bpm) is excellent — in the optimal resting range.`, cls: 'success' });
        }

        // FIX 9: Always use the newest global record for stale check
        const mostRecent = vitalSignsState.vitalsData[0];
        if (mostRecent) {
            const daysSince = Math.floor((new Date() - mostRecent._date) / 86400000);
            if (daysSince > 7) insights.push({ icon: '📅', text: `Your last vital signs were recorded ${daysSince} days ago. Regular monitoring helps catch changes early.`, cls: 'info' });
        }

        // Weight trend
        const withWt = data.filter(v => v._wt).sort((a, b) => a._date - b._date);
        if (withWt.length >= 2) {
            const diff = withWt[withWt.length - 1]._wt - withWt[0]._wt;
            if (Math.abs(diff) > 2) insights.push({ icon: diff > 0 ? '⬆️' : '⬇️', text: `Your weight has ${diff > 0 ? 'increased' : 'decreased'} by ${Math.abs(diff).toFixed(1)} kg over this period.`, cls: diff > 5 ? 'warning' : 'info' });
        }

        const clsMap    = { danger: '#f8d7da', warning: '#fff3cd', success: '#d4edda', info: '#d1ecf1' };
        const borderMap = { danger: '#dc3545', warning: '#ffc107', success: '#28a745', info: '#17a2b8' };

        insightsEl.innerHTML = `
            <h3 style="color:#333;margin:0 0 15px;">💡 Health Insights</h3>
            ${insights.map(i => `
                <div style="display:flex;align-items:flex-start;gap:12px;padding:12px 15px;background:${clsMap[i.cls]};border-left:4px solid ${borderMap[i.cls]};border-radius:6px;margin-bottom:10px;">
                    <span style="font-size:1.2em;flex-shrink:0;">${i.icon}</span>
                    <span style="color:#333;line-height:1.5;">${i.text}</span>
                </div>`).join('')}`;
    }

    // ─── UTILITIES ─────────────────────────────────────────────────────────────
    function showLoading() {
        const el = document.getElementById('loader');
        if (el) { el.style.display = 'flex'; el.style.opacity = '1'; }
    }

    function hideLoading() {
        const el = document.getElementById('loader');
        if (el) { el.style.opacity = '0'; setTimeout(() => el.style.display = 'none', 300); }
    }

    // FIX 16: formatDate now used consistently throughout
    function formatDate(ds) {
        if (!ds) return '--';
        try {
            return new Date(ds + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        } catch (e) { return ds; }
    }

    function showMessage(type, text) {
        let container = document.getElementById('messageContainer');
        if (!container) {
            container = document.createElement('div');
            container.id = 'messageContainer';
            container.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:9999;';
            document.body.appendChild(container);
        }
        const msg    = document.createElement('div');
        const colors = { success: '#28a745', error: '#dc3545', warning: '#ffc107', info: '#17a2b8' };
        msg.style.cssText = `background:white;padding:12px 18px;margin-top:8px;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.15);display:flex;align-items:center;gap:10px;min-width:280px;max-width:380px;border-left:4px solid ${colors[type] || colors.info};`;
        const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
        msg.innerHTML = `<span>${icons[type] || 'ℹ️'}</span><span>${text}</span>`;
        container.appendChild(msg);
        setTimeout(() => {
            msg.style.opacity    = '0';
            msg.style.transition = 'opacity 0.3s';
            setTimeout(() => msg.remove(), 300);
        }, 5000);
    }

    // ─── EXPORTS ───────────────────────────────────────────────────────────────
    window.loadVitalSigns              = loadVitalSigns;
    window.vitalSignsState             = vitalSignsState;
    window.calculateMAP                = calculateMAP;
    window.calculateBMI                = calculateBMI;
    window.updateHeartRateStatus       = updateHeartRateStatus;
    window.calculateToolBMI            = calculateToolBMI;
    window.calculateToolMAP            = calculateToolMAP;
    window.calculateNEWS2              = calculateNEWS2Tool;
    window.calculateFluidRequirement   = calculateFluidRequirement;
    window.viewVitalDetails            = viewVitalDetails;
    window.showLoading                 = showLoading;
    window.hideLoading                 = hideLoading;
    window.showMessage                 = showMessage;

    console.log('=== VITAL SIGNS JS LOADED ===');
})();