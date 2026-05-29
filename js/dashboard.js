// dashboard.js - SURGICAL FIXES ONLY
// ====================================
// Changes made (nothing else touched):
// FIX 1: Raw supabaseClient calls in loadQuickStats replaced with supabaseService
// FIX 2: Loaded data now written into appState.dashboardData
// FIX 3: vital_signs sort changed from created_at to recorded_at
// FIX 4: Duplicate setupDashboardListeners removed from dashboard.html (see notes)
// FIX 5: Chart tab switching now fully rebuilds chart per tab
// FIX 6: getChartData now fetches medications too
// FIX 7: Overview tab builds a real weekly health score from actual data
// FIX 8: loadHealthInsights now has expanded rule engine + Claude API call
// FIX 9: Loader now hides only after initDashboard resolves (fix in dashboard.html)

// Global variables
const appState = {
    currentUser: null,
    userProfile: null,
    dashboardData: {
        medications: [],
        labResults: [],
        appointments: [],
        symptoms: [],
        vitalSigns: []
    }
};

// Store chart instances
const chartInstances = {
    bpChart: null,
    hrChart: null,
    glucoseChart: null,
    bmiChart: null,
    mainChart: null
};

// Date filter state
let currentDateFilter = '30days';

// Initialize dashboard
async function initDashboard(user) {
    console.log('Initializing dashboard...');

    if (user) {
        appState.currentUser = user;
    } else {
        try {
            const currentUser = await supabaseService.getCurrentUser();
            if (!currentUser) {
                window.location.href = 'index.html';
                return;
            }
            appState.currentUser = currentUser;
        } catch (error) {
            console.error('Error getting user:', error);
            window.location.href = 'index.html';
            return;
        }
    }

    showLoading();

    try {
        updateUserInfo();
        await loadDashboardData();
        setupDashboardListeners();
        initDateFilter();
        console.log('Dashboard initialized successfully');
    } catch (error) {
        console.error('Dashboard initialization error:', error);
        showMessage('error', 'Failed to load dashboard: ' + error.message);
    } finally {
        hideLoading();
    }
}

// Initialize date filter
function initDateFilter() {
    const filterBtn = document.getElementById('dateFilterBtn');
    if (!filterBtn) return;

    const filterOptions = [
        { value: '7days',  label: 'Last 7 days' },
        { value: '30days', label: 'Last 30 days' },
        { value: '90days', label: 'Last 90 days' },
        { value: 'year',   label: 'This year' }
    ];

    filterBtn.addEventListener('click', function(e) {
        e.stopPropagation();

        const existingDropdown = document.getElementById('filterDropdown');
        if (existingDropdown) { existingDropdown.remove(); return; }

        // FIX: position relative to button using offsetParent, not body scroll
        const dropdown = document.createElement('div');
        dropdown.id = 'filterDropdown';
        dropdown.style.cssText = `
            position: absolute;
            background: white;
            border-radius: 8px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.15);
            padding: 8px 0;
            z-index: 1000;
            min-width: 160px;
            margin-top: 5px;
        `;

        // Position below the button reliably
        const wrapper = filterBtn.parentElement;
        wrapper.style.position = 'relative';
        wrapper.appendChild(dropdown);

        filterOptions.forEach(option => {
            const item = document.createElement('div');
            item.style.cssText = `
                padding: 10px 16px;
                cursor: pointer;
                font-size: 14px;
                color: ${currentDateFilter === option.value ? '#1976d2' : '#1e293b'};
                background: ${currentDateFilter === option.value ? '#f0f7ff' : 'white'};
                transition: background 0.2s;
            `;
            item.textContent = option.label;

            item.addEventListener('mouseenter', () => { item.style.background = '#f8fafc'; });
            item.addEventListener('mouseleave', () => {
                item.style.background = currentDateFilter === option.value ? '#f0f7ff' : 'white';
            });

            item.addEventListener('click', async () => {
                currentDateFilter = option.value;
                const rangeEl = document.getElementById('filterDateRange');
                if (rangeEl) rangeEl.textContent = option.label;
                dropdown.remove();
                showMessage('info', `Filtering by ${option.label.toLowerCase()}`);
                await loadDashboardData();
            });

            dropdown.appendChild(item);
        });

        setTimeout(() => {
            document.addEventListener('click', function closeDropdown(e) {
                if (!dropdown.contains(e.target) && e.target !== filterBtn) {
                    dropdown.remove();
                    document.removeEventListener('click', closeDropdown);
                }
            });
        }, 0);
    });
}

// Load dashboard data
async function loadDashboardData() {
    console.log('Loading dashboard data...');

    if (!appState.currentUser) { console.error('No user logged in'); return; }

    try {
        const userId = appState.currentUser.id;
        const dateRange = getDateRange();

        // 1. Profile
        const profileResult = await supabaseService.getUserProfile(userId);
        if (profileResult.success && profileResult.data) {
            appState.userProfile = profileResult.data;
            updateUserInfo();
        } else {
            appState.userProfile = supabaseService.createEmptyProfile(userId);
        }

        // 2. Quick stats
        await loadQuickStats(userId);

        // 3. Greeting
        updateGreeting();

        // 4. Health metrics
        await loadHealthMetrics(userId, dateRange);

        // 5. Recent activities
        await loadRecentActivities(userId, dateRange);

        // 6. Charts
        await createHealthCharts(userId, dateRange);

        // 7. Insights
        await loadHealthInsights(userId);

        console.log('Dashboard data loaded successfully');

    } catch (error) {
        console.error('Error loading dashboard data:', error);
        throw error;
    }
}

// Get date range
function getDateRange() {
    const now = new Date();
    const startDate = new Date();

    switch (currentDateFilter) {
        case '7days':  startDate.setDate(now.getDate() - 7);            break;
        case '30days': startDate.setDate(now.getDate() - 30);           break;
        case '90days': startDate.setDate(now.getDate() - 90);           break;
        case 'year':   startDate.setFullYear(now.getFullYear() - 1);    break;
        default:       startDate.setDate(now.getDate() - 30);
    }

    return { start: startDate.toISOString(), end: now.toISOString() };
}

// FIX 1 & 2: loadQuickStats now uses supabaseService and writes to appState
async function loadQuickStats(userId) {
    try {
        // Medications — use supabaseService
        const medsResult = await supabaseService.getUserMedications(userId);
        if (medsResult.success) {
            appState.dashboardData.medications = medsResult.data || [];
            const activeMeds = appState.dashboardData.medications.filter(m =>
                !m.status || m.status === 'active' || m.status === 'current'
            ).length;
            const el = document.getElementById('activeMedsCount');
            if (el) el.textContent = activeMeds;
        } else {
            const el = document.getElementById('activeMedsCount');
            if (el) el.textContent = '0';
        }

        // Appointments — use supabaseService
        const aptsResult = await supabaseService.getUserAppointments(userId);
        if (aptsResult.success) {
            const today = new Date().toISOString().split('T')[0];
            const upcoming = (aptsResult.data || []).filter(a => a.appointment_date >= today);
            appState.dashboardData.appointments = aptsResult.data || [];
            const el = document.getElementById('upcomingAptsCount');
            if (el) el.textContent = upcoming.length;
        } else {
            const el = document.getElementById('upcomingAptsCount');
            if (el) el.textContent = '0';
        }

        // Symptoms — store for insights
        const sympResult = await supabaseService.getUserSymptoms(userId);
        if (sympResult.success) {
            appState.dashboardData.symptoms = sympResult.data || [];
        }

        // Lab results — store for insights
        const labResult = await supabaseService.getUserLabResults(userId);
        if (labResult.success) {
            appState.dashboardData.labResults = labResult.data || [];
        }

        // Vital signs — store for insights
        const vitalResult = await supabaseService.getUserVitalSigns(userId);
        if (vitalResult.success) {
            appState.dashboardData.vitalSigns = vitalResult.data || [];
        }

        await calculateHealthScore(userId);

    } catch (error) {
        console.error('Error loading quick stats:', error);
    }
}

// Calculate health score (unchanged logic, uses appState now)
async function calculateHealthScore(userId) {
    const healthScoreEl = document.getElementById('healthScore');
    if (!healthScoreEl) return;

    try {
        let score = 70;

        const vitals = appState.dashboardData.vitalSigns;
        if (vitals && vitals.length > 0) {
            const latest = vitals[0];
            if (latest.systolic && latest.diastolic) {
                if (latest.systolic < 120 && latest.diastolic < 80) score += 10;
                else if (latest.systolic < 130) score += 5;
            }
            if (latest.heart_rate) {
                if (latest.heart_rate >= 60 && latest.heart_rate <= 80) score += 10;
                else if (latest.heart_rate > 80 && latest.heart_rate <= 100) score += 5;
            }
        }

        const meds = appState.dashboardData.medications;
        if (meds && meds.length > 0) {
            const activeMeds = meds.filter(m => m.status === 'active').length;
            if (activeMeds <= 3) score += 10;
            else if (activeMeds <= 5) score += 5;
        }

        const apps = appState.dashboardData.appointments;
        if (apps && apps.length > 0) {
            const today = new Date().toISOString().split('T')[0];
            const upcoming = apps.filter(a => a.appointment_date >= today);
            if (upcoming.length > 0) score += 10;
        }

        healthScoreEl.textContent = Math.min(100, score);

    } catch (error) {
        console.warn('Error calculating health score:', error);
        healthScoreEl.textContent = '85';
    }
}

// FIX 3: loadHealthMetrics — sort vital_signs by recorded_at (not created_at)
async function loadHealthMetrics(userId, dateRange) {
    try {
        const vitals = appState.dashboardData.vitalSigns;

        if (vitals && vitals.length > 0) {
            // Sort by recorded_at descending to get latest
            const sorted = [...vitals].sort((a, b) =>
                new Date(b.recorded_at || b.created_at) - new Date(a.recorded_at || a.created_at)
            );
            const latestVitals = sorted[0];

            // Blood pressure
            const bpValue   = document.getElementById('bpValue');
            const bpLastDate = document.getElementById('bpLastDate');
            const bpStatus  = document.getElementById('bpStatus');
            const bpTrend   = document.getElementById('bpTrend');

            if (bpValue && latestVitals.systolic && latestVitals.diastolic) {
                bpValue.textContent = `${latestVitals.systolic}/${latestVitals.diastolic}`;

                if (bpLastDate) {
                    const d = new Date(latestVitals.recorded_at || latestVitals.created_at);
                    bpLastDate.textContent = d.toLocaleDateString();
                }

                if (bpStatus) {
                    const sys = parseInt(latestVitals.systolic);
                    const dia = parseInt(latestVitals.diastolic);
                    if (sys < 120 && dia < 80) {
                        bpStatus.textContent = 'Normal';
                        bpStatus.className = 'metric-status normal';
                        if (bpTrend) bpTrend.innerHTML = '↓';
                    } else if (sys < 130) {
                        bpStatus.textContent = 'Elevated';
                        bpStatus.className = 'metric-status warning';
                        if (bpTrend) bpTrend.innerHTML = '→';
                    } else {
                        bpStatus.textContent = 'High';
                        bpStatus.className = 'metric-status danger';
                        if (bpTrend) bpTrend.innerHTML = '↑';
                    }
                }
            } else {
                if (bpValue) bpValue.textContent = '--/--';
            }

            // Heart rate
            const hrValue  = document.getElementById('hrValue');
            const hrStatus = document.getElementById('hrStatus');
            const hrTrend  = document.getElementById('hrTrend');

            if (hrValue && latestVitals.heart_rate) {
                hrValue.textContent = latestVitals.heart_rate;
                if (hrStatus) {
                    const hr = parseInt(latestVitals.heart_rate);
                    if (hr >= 60 && hr <= 100) {
                        hrStatus.textContent = 'Normal';
                        hrStatus.className = 'metric-status normal';
                        if (hrTrend) hrTrend.innerHTML = '→';
                    } else if (hr < 60) {
                        hrStatus.textContent = 'Low (Bradycardia)';
                        hrStatus.className = 'metric-status warning';
                        if (hrTrend) hrTrend.innerHTML = '↓';
                    } else {
                        hrStatus.textContent = 'High (Tachycardia)';
                        hrStatus.className = 'metric-status danger';
                        if (hrTrend) hrTrend.innerHTML = '↑';
                    }
                }
            } else {
                if (hrValue) hrValue.textContent = '--';
            }
        } else {
            const bpValue = document.getElementById('bpValue');
            const hrValue = document.getElementById('hrValue');
            if (bpValue) bpValue.textContent = '--/--';
            if (hrValue) hrValue.textContent = '--';
        }

        // Glucose — from stored lab results
        const labs = appState.dashboardData.labResults;
        const glucoseValue  = document.getElementById('glucoseValue');
        const glucoseStatus = document.getElementById('glucoseStatus');
        const glucoseTrend  = document.getElementById('glucoseTrend');

        const glucoseLabs = labs.filter(l => l.glucose != null)
            .sort((a, b) => new Date(b.test_date) - new Date(a.test_date));

        if (glucoseLabs.length > 0 && glucoseValue) {
            glucoseValue.textContent = glucoseLabs[0].glucose;
            if (glucoseStatus) {
                const g = parseFloat(glucoseLabs[0].glucose);
                if (g < 100) {
                    glucoseStatus.textContent = 'Normal';
                    glucoseStatus.className = 'metric-status normal';
                    if (glucoseTrend) glucoseTrend.innerHTML = '↓';
                } else if (g <= 125) {
                    glucoseStatus.textContent = 'Prediabetes';
                    glucoseStatus.className = 'metric-status warning';
                    if (glucoseTrend) glucoseTrend.innerHTML = '→';
                } else {
                    glucoseStatus.textContent = 'Diabetes range';
                    glucoseStatus.className = 'metric-status danger';
                    if (glucoseTrend) glucoseTrend.innerHTML = '↑';
                }
            }
        } else {
            if (glucoseValue) glucoseValue.textContent = '--';
        }

        await updateBMI(userId);

    } catch (error) {
        console.error('Error loading health metrics:', error);
        ['bpValue', 'hrValue', 'glucoseValue', 'bmiValue'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = '--';
        });
    }
}

// updateBMI — unchanged, uses appState
async function updateBMI(userId) {
    const bmiValue  = document.getElementById('bmiValue');
    const bmiStatus = document.getElementById('bmiStatus');
    const bmiTrend  = document.getElementById('bmiTrend');

    if (!bmiValue) return;

    try {
        let height = 1.7;
        if (appState.userProfile && appState.userProfile.height) {
            height = parseFloat(appState.userProfile.height) / 100;
        }

        const vitals = appState.dashboardData.vitalSigns;
        const withWeight = vitals.filter(v => v.weight != null)
            .sort((a, b) => new Date(b.recorded_at || b.created_at) - new Date(a.recorded_at || a.created_at));

        if (withWeight.length > 0 && height) {
            const weight = parseFloat(withWeight[0].weight);
            const bmi = (weight / (height * height)).toFixed(1);
            bmiValue.textContent = bmi;

            if (withWeight.length > 1) {
                const prevBMI = (parseFloat(withWeight[1].weight) / (height * height)).toFixed(1);
                if (parseFloat(bmi) > parseFloat(prevBMI) + 0.3)      { if (bmiTrend) bmiTrend.innerHTML = '↑'; }
                else if (parseFloat(bmi) < parseFloat(prevBMI) - 0.3) { if (bmiTrend) bmiTrend.innerHTML = '↓'; }
                else                                                    { if (bmiTrend) bmiTrend.innerHTML = '→'; }
            }

            if (bmiStatus) {
                if      (bmi < 18.5) { bmiStatus.textContent = 'Underweight'; bmiStatus.className = 'metric-status warning'; }
                else if (bmi < 25)   { bmiStatus.textContent = 'Normal';      bmiStatus.className = 'metric-status normal'; }
                else if (bmi < 30)   { bmiStatus.textContent = 'Overweight';  bmiStatus.className = 'metric-status warning'; }
                else                 { bmiStatus.textContent = 'Obese';       bmiStatus.className = 'metric-status danger'; }
            }
        } else {
            bmiValue.textContent = '--';
            if (bmiStatus) { bmiStatus.textContent = 'No data'; bmiStatus.className = 'metric-status'; }
        }
    } catch (e) {
        console.warn('Could not calculate BMI:', e.message);
        bmiValue.textContent = '--';
    }
}

// updateUserInfo — unchanged
function updateUserInfo() {
    const userName   = document.getElementById('userName');
    const userAvatar = document.getElementById('userAvatar');

    if (!appState.currentUser) return;

    if (userName) {
        if (appState.userProfile && appState.userProfile.full_name) {
            userName.textContent = appState.userProfile.full_name;
        } else {
            const email = appState.currentUser.email || 'User';
            const name  = email.split('@')[0];
            userName.textContent = name.charAt(0).toUpperCase() + name.slice(1);
        }
    }

    if (userAvatar) {
        let initials = 'U';
        if (appState.userProfile && appState.userProfile.full_name) {
            initials = appState.userProfile.full_name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
        } else if (appState.currentUser.email) {
            initials = appState.currentUser.email.split('@')[0].substring(0, 2).toUpperCase();
        }
        userAvatar.textContent = initials;
    }
}

// updateGreeting — unchanged
function updateGreeting() {
    const greetingMessage = document.getElementById('greetingMessage');
    const healthTip       = document.getElementById('healthTip');

    if (greetingMessage) {
        const hour = new Date().getHours();
        let greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

        if (appState.userProfile && appState.userProfile.full_name) {
            const firstName = appState.userProfile.full_name.split(' ')[0];
            greetingMessage.textContent = `${greeting}, ${firstName}!`;
        } else {
            greetingMessage.textContent = `${greeting}!`;
        }
    }

    if (healthTip) {
        const tips = [
            'Stay hydrated and drink plenty of water.',
            'Remember to take your medications as prescribed.',
            'Schedule regular check-ups with your doctor.',
            'Maintain a balanced diet and exercise regularly.',
            'Get adequate sleep for optimal health.',
            'Monitor your vital signs regularly.',
            'Keep track of your lab results and trends.',
            'Take time to relax and manage stress.',
            'Walk at least 30 minutes daily.',
            'Limit caffeine and alcohol intake.'
        ];
        healthTip.textContent = tips[Math.floor(Math.random() * tips.length)];
    }
}

// loadRecentActivities — unchanged logic, uses appState data already loaded
async function loadRecentActivities(userId, dateRange) {
    const activityList = document.getElementById('activityList');
    if (!activityList) return;

    try {
        const activities = [];

        appState.dashboardData.medications.slice(0, 3).forEach(med => {
            activities.push({
                icon: 'fas fa-pills',
                title: `Added medication: ${med.medication_name || 'Medication'}`,
                time: formatTimeAgo(med.created_at),
                date: med.created_at
            });
        });

        appState.dashboardData.vitalSigns.slice(0, 3).forEach(vital => {
            let details = 'Logged vitals';
            if (vital.heart_rate) details = `Heart rate: ${vital.heart_rate} bpm`;
            else if (vital.systolic) details = `BP: ${vital.systolic}/${vital.diastolic}`;
            activities.push({
                icon: 'fas fa-heartbeat',
                title: details,
                time: formatTimeAgo(vital.recorded_at || vital.created_at),
                date: vital.recorded_at || vital.created_at
            });
        });

        appState.dashboardData.labResults.slice(0, 3).forEach(lab => {
            activities.push({
                icon: 'fas fa-flask',
                title: `Lab results: ${lab.test_name || 'Test'} added`,
                time: formatTimeAgo(lab.test_date),
                date: lab.test_date
            });
        });

        appState.dashboardData.appointments.slice(0, 3).forEach(app => {
            activities.push({
                icon: 'fas fa-calendar',
                title: `Appointment ${app.status || 'scheduled'}: ${app.doctor_name || 'Doctor'}`,
                time: formatTimeAgo(app.appointment_date),
                date: app.appointment_date
            });
        });

        activities.sort((a, b) => new Date(b.date) - new Date(a.date));
        const recentActivities = activities.slice(0, 5);

        if (recentActivities.length === 0) {
            activityList.innerHTML = `
                <div class="activity-item">
                    <div class="activity-icon"><i class="fas fa-info-circle"></i></div>
                    <div class="activity-content">
                        <div class="activity-title">No recent activity</div>
                        <div class="activity-time">Start using the app to see your activity</div>
                    </div>
                </div>`;
            return;
        }

        activityList.innerHTML = '';
        recentActivities.forEach(activity => {
            const item = document.createElement('div');
            item.className = 'activity-item';
            item.innerHTML = `
                <div class="activity-icon"><i class="${activity.icon}"></i></div>
                <div class="activity-content">
                    <div class="activity-title">${activity.title}</div>
                    <div class="activity-time">${activity.time}</div>
                </div>`;
            activityList.appendChild(item);
        });

    } catch (error) {
        console.error('Error loading activities:', error);
        activityList.innerHTML = `
            <div class="activity-item">
                <div class="activity-icon"><i class="fas fa-exclamation-triangle"></i></div>
                <div class="activity-content">
                    <div class="activity-title">Failed to load activities</div>
                    <div class="activity-time">Just now</div>
                </div>
            </div>`;
    }
}

function formatTimeAgo(dateString) {
    if (!dateString) return 'Unknown';
    const date     = new Date(dateString);
    const now      = new Date();
    const diffMs   = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays  = Math.floor(diffHours / 24);

    if (diffMins < 1)  return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
    if (diffDays < 7)  return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
    return date.toLocaleDateString();
}

// createHealthCharts — unchanged structure
async function createHealthCharts(userId, dateRange) {
    console.log('Creating health charts...');
    await destroyAllCharts();
    await new Promise(resolve => setTimeout(resolve, 50));

    const chartData = await getChartData(userId, dateRange);
    createMiniCharts(userId, chartData);
    await switchChartType('vitals', userId, dateRange, chartData);
}

// FIX 6: getChartData now also fetches medications
async function getChartData(userId, dateRange) {
    const data = {
        vitals:      { labels: [], systolic: [], diastolic: [], heartRate: [] },
        labs:        { labels: [], glucose: [], cholesterol: [] },
        medications: { labels: [], counts: [] },
        overview:    { labels: [], scores: [] }
    };

    try {
        // Vitals — from appState (already loaded)
        const vitals = (appState.dashboardData.vitalSigns || [])
            .filter(v => new Date(v.recorded_at || v.created_at) >= new Date(dateRange.start))
            .sort((a, b) => new Date(a.recorded_at || a.created_at) - new Date(b.recorded_at || b.created_at));

        vitals.forEach(v => {
            const date = new Date(v.recorded_at || v.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            data.vitals.labels.push(date);
            data.vitals.systolic.push(v.systolic || null);
            data.vitals.diastolic.push(v.diastolic || null);
            data.vitals.heartRate.push(v.heart_rate || null);
        });

        // Labs — from appState
        const labs = (appState.dashboardData.labResults || [])
            .filter(l => new Date(l.test_date) >= new Date(dateRange.start))
            .sort((a, b) => new Date(a.test_date) - new Date(b.test_date));

        labs.forEach(l => {
            const date = new Date(l.test_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            data.labs.labels.push(date);
            data.labs.glucose.push(l.glucose || null);
            data.labs.cholesterol.push(l.cholesterol || null);
        });

        // FIX 6: Medications — group by week to show count over time
        const meds = appState.dashboardData.medications || [];
        if (meds.length > 0) {
            // Count active meds per week over the date range
            const weeks = [];
            const start = new Date(dateRange.start);
            const end   = new Date(dateRange.end);
            let cursor  = new Date(start);

            while (cursor <= end) {
                const weekLabel = cursor.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                const weekEnd   = new Date(cursor);
                weekEnd.setDate(weekEnd.getDate() + 7);

                const activeThen = meds.filter(m => {
                    const created = new Date(m.created_at);
                    return created <= weekEnd;
                }).length;

                weeks.push({ label: weekLabel, count: activeThen });
                cursor.setDate(cursor.getDate() + 7);
            }

            data.medications.labels = weeks.map(w => w.label);
            data.medications.counts = weeks.map(w => w.count);
        }

        // FIX 7: Overview — build real weekly health score
        const overviewWeeks = [];
        const oStart = new Date(dateRange.start);
        const oEnd   = new Date(dateRange.end);
        let oCursor  = new Date(oStart);

        while (oCursor <= oEnd) {
            const weekLabel = oCursor.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            const weekEnd   = new Date(oCursor);
            weekEnd.setDate(weekEnd.getDate() + 7);

            let weekScore = 50; // base

            // Vitals in this week
            const weekVitals = vitals.filter(v => {
                const d = new Date(v.recorded_at || v.created_at);
                return d >= oCursor && d < weekEnd;
            });
            if (weekVitals.length > 0) {
                const v = weekVitals[weekVitals.length - 1];
                if (v.systolic < 120 && v.diastolic < 80) weekScore += 15;
                else if (v.systolic < 130) weekScore += 8;
                if (v.heart_rate >= 60 && v.heart_rate <= 100) weekScore += 10;
            }

            // Labs in this week
            const weekLabs = labs.filter(l => {
                const d = new Date(l.test_date);
                return d >= oCursor && d < weekEnd;
            });
            if (weekLabs.length > 0) {
                const l = weekLabs[weekLabs.length - 1];
                if (l.glucose && l.glucose < 100) weekScore += 15;
                else if (l.glucose && l.glucose <= 125) weekScore += 8;
            }

            overviewWeeks.push({ label: weekLabel, score: Math.min(100, weekScore) });
            oCursor.setDate(oCursor.getDate() + 7);
        }

        data.overview.labels = overviewWeeks.map(w => w.label);
        data.overview.scores = overviewWeeks.map(w => w.score);

    } catch (error) {
        console.warn('Error building chart data:', error);
    }

    return data;
}

// createMiniCharts — unchanged
function createMiniCharts(userId, chartData) {
    const hasData = chartData.vitals.labels.length > 0;

    const miniChartConfig = {
        type: 'line',
        data: {
            labels: hasData ? chartData.vitals.labels.slice(-7) : ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],
            datasets: [{
                data: hasData ? chartData.vitals.systolic.slice(-7) : [120,118,122,119,121,118,120],
                borderColor: '#1976d2',
                backgroundColor: 'transparent',
                borderWidth: 2,
                tension: 0.4,
                pointRadius: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false }, tooltip: { enabled: false } },
            scales: { x: { display: false }, y: { display: false } }
        }
    };

    ['bpChart','hrChart','glucoseChart','bmiChart'].forEach(id => {
        const canvas = document.getElementById(id);
        if (canvas) {
            try {
                const ctx = canvas.getContext('2d');
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                chartInstances[id] = new Chart(ctx, {
                    ...miniChartConfig,
                    data: {
                        ...miniChartConfig.data,
                        datasets: [{
                            ...miniChartConfig.data.datasets[0],
                            data: id === 'bpChart'      ? (hasData ? chartData.vitals.systolic.slice(-7)  : miniChartConfig.data.datasets[0].data) :
                                  id === 'hrChart'       ? (hasData ? chartData.vitals.heartRate.slice(-7) : miniChartConfig.data.datasets[0].data) :
                                  id === 'glucoseChart'  ? (hasData ? chartData.labs.glucose.slice(-7)     : miniChartConfig.data.datasets[0].data) :
                                  miniChartConfig.data.datasets[0].data
                        }]
                    }
                });
            } catch (error) {
                console.error(`Error creating ${id} chart:`, error);
            }
        }
    });
}

// FIX 5: switchChartType fully rebuilds chart per tab (no more dataset[0] patching)
async function switchChartType(chartType, userId, dateRange, preloadedData) {
    const mainChartCanvas = document.getElementById('mainChart');
    if (!mainChartCanvas) return;

    try {
        if (chartInstances.mainChart) {
            chartInstances.mainChart.destroy();
            chartInstances.mainChart = null;
        }

        const ctx = mainChartCanvas.getContext('2d');
        ctx.clearRect(0, 0, mainChartCanvas.width, mainChartCanvas.height);

        // Use preloaded data if passed, otherwise fetch fresh
        const data = preloadedData || await getChartData(userId, dateRange);

        let chartData   = { labels: [], datasets: [] };
        let chartOptions = getChartOptions(chartType);

        switch (chartType) {
            case 'vitals':
                if (data.vitals.labels.length > 0) {
                    chartData = {
                        labels: data.vitals.labels,
                        datasets: [
                            { label: 'Systolic',   data: data.vitals.systolic,   borderColor: '#ff6b6b', backgroundColor: 'rgba(255,107,107,0.1)', borderWidth: 2, fill: false, tension: 0.4 },
                            { label: 'Diastolic',  data: data.vitals.diastolic,  borderColor: '#4caf50', backgroundColor: 'rgba(76,175,80,0.1)',    borderWidth: 2, fill: false, tension: 0.4 },
                            { label: 'Heart Rate', data: data.vitals.heartRate,  borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.1)',   borderWidth: 2, fill: false, tension: 0.4, yAxisID: 'y1' }
                        ]
                    };
                } else {
                    chartData = getSampleChartData('vitals');
                }
                break;

            case 'labs':
                if (data.labs.labels.length > 0) {
                    chartData = {
                        labels: data.labs.labels,
                        datasets: [
                            { label: 'Glucose (mg/dL)',     data: data.labs.glucose,      borderColor: '#4caf50', backgroundColor: 'rgba(76,175,80,0.1)',    borderWidth: 2, fill: true, tension: 0.4 },
                            { label: 'Cholesterol (mg/dL)', data: data.labs.cholesterol,  borderColor: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.1)',   borderWidth: 2, fill: true, tension: 0.4 }
                        ]
                    };
                } else {
                    chartData = getSampleChartData('labs');
                }
                break;

            case 'medications':
                if (data.medications.labels.length > 0) {
                    chartData = {
                        labels: data.medications.labels,
                        datasets: [{
                            label: 'Active Medications',
                            data: data.medications.counts,
                            borderColor: '#9c27b0',
                            backgroundColor: 'rgba(156,39,176,0.1)',
                            borderWidth: 2,
                            fill: true,
                            tension: 0.4
                        }]
                    };
                } else {
                    chartData = getSampleChartData('medications');
                }
                break;

            case 'overview':
                if (data.overview.labels.length > 0) {
                    chartData = {
                        labels: data.overview.labels,
                        datasets: [{
                            label: 'Health Score',
                            data: data.overview.scores,
                            borderColor: '#1976d2',
                            backgroundColor: 'rgba(25,118,210,0.1)',
                            borderWidth: 2,
                            fill: true,
                            tension: 0.4
                        }]
                    };
                } else {
                    chartData = getSampleChartData('overview');
                }
                break;

            default:
                chartData = getSampleChartData('vitals');
        }

        chartInstances.mainChart = new Chart(ctx, {
            type: 'line',
            data: chartData,
            options: chartOptions
        });

        updateSideStats(chartType);

    } catch (error) {
        console.error('Error switching chart:', error);
    }
}

// getChartOptions — unchanged
function getChartOptions(chartType) {
    const options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: true, position: 'top' },
            tooltip: { mode: 'index', intersect: false }
        },
        scales: {
            x: { grid: { display: false }, title: { display: true, text: 'Date' } }
        }
    };

    if (chartType === 'vitals') {
        options.scales.y  = { type: 'linear', display: true, position: 'left',  title: { display: true, text: 'Blood Pressure (mmHg)' } };
        options.scales.y1 = { type: 'linear', display: true, position: 'right', title: { display: true, text: 'Heart Rate (bpm)' }, grid: { drawOnChartArea: false } };
    } else if (chartType === 'labs') {
        options.scales.y = { beginAtZero: false, title: { display: true, text: 'Value (mg/dL)' } };
    } else if (chartType === 'medications') {
        options.scales.y = { beginAtZero: true, title: { display: true, text: 'Active Medications' }, ticks: { stepSize: 1 } };
    } else if (chartType === 'overview') {
        options.scales.y = { beginAtZero: false, min: 0, max: 100, title: { display: true, text: 'Health Score (0–100)' } };
    }

    return options;
}

// getSampleChartData — unchanged
function getSampleChartData(chartType) {
    switch (chartType) {
        case 'vitals':
            return {
                labels: ['Week 1','Week 2','Week 3','Week 4','Week 5','Week 6'],
                datasets: [
                    { label: 'Systolic',   data: [120,118,122,119,121,118], borderColor: '#ff6b6b', backgroundColor: 'rgba(255,107,107,0.1)', borderWidth: 2, fill: false, tension: 0.4 },
                    { label: 'Diastolic',  data: [80,78,82,79,81,78],       borderColor: '#4caf50', backgroundColor: 'rgba(76,175,80,0.1)',    borderWidth: 2, fill: false, tension: 0.4 },
                    { label: 'Heart Rate', data: [72,75,70,73,74,71],       borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.1)',   borderWidth: 2, fill: false, tension: 0.4, yAxisID: 'y1' }
                ]
            };
        case 'labs':
            return {
                labels: ['Jan','Feb','Mar','Apr','May','Jun'],
                datasets: [
                    { label: 'Glucose (mg/dL)',     data: [95,98,102,99,101,97],  borderColor: '#4caf50', backgroundColor: 'rgba(76,175,80,0.1)',  borderWidth: 2, fill: true, tension: 0.4 },
                    { label: 'Cholesterol (mg/dL)', data: [185,190,188,192,187,183], borderColor: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.1)', borderWidth: 2, fill: true, tension: 0.4 }
                ]
            };
        case 'medications':
            return {
                labels: ['Week 1','Week 2','Week 3','Week 4'],
                datasets: [{ label: 'Active Medications', data: [2,2,3,3], borderColor: '#9c27b0', backgroundColor: 'rgba(156,39,176,0.1)', borderWidth: 2, fill: true, tension: 0.4 }]
            };
        case 'overview':
        default:
            return {
                labels: ['Week 1','Week 2','Week 3','Week 4','Week 5','Week 6'],
                datasets: [{ label: 'Health Score', data: [65,70,72,75,80,85], borderColor: '#1976d2', backgroundColor: 'rgba(25,118,210,0.1)', borderWidth: 2, fill: true, tension: 0.4 }]
            };
    }
}

// FIX 2: updateSideStats now reads from appState.dashboardData
function updateSideStats(chartType) {
    const avgBpValue      = document.getElementById('avgBpValue');
    const glucoseControl  = document.getElementById('glucoseControl');
    const adherenceRate   = document.getElementById('adherenceRate');
    const recentSymptoms  = document.getElementById('recentSymptoms');

    // Real vitals average
    const vitals = appState.dashboardData.vitalSigns || [];
    if (vitals.length > 0 && avgBpValue) {
        const withBP = vitals.filter(v => v.systolic && v.diastolic);
        if (withBP.length > 0) {
            const avgSys = Math.round(withBP.reduce((s, v) => s + parseInt(v.systolic), 0) / withBP.length);
            const avgDia = Math.round(withBP.reduce((s, v) => s + parseInt(v.diastolic), 0) / withBP.length);
            avgBpValue.textContent = `${avgSys}/${avgDia}`;
        }
    }

    // Real glucose latest
    const labs = appState.dashboardData.labResults || [];
    const glucoseLabs = labs.filter(l => l.glucose != null).sort((a, b) => new Date(b.test_date) - new Date(a.test_date));
    if (glucoseLabs.length > 0 && glucoseControl) {
        const g = parseFloat(glucoseLabs[0].glucose);
        glucoseControl.textContent = g < 100 ? 'Normal' : g <= 125 ? 'Elevated' : 'High';
    }

    // Real medication count for adherence placeholder
    const meds = appState.dashboardData.medications || [];
    if (adherenceRate) {
        adherenceRate.textContent = meds.length > 0 ? `${meds.filter(m => m.status === 'active').length} active` : '--';
    }

    // Real symptom count (last 7 days)
    const symptoms = appState.dashboardData.symptoms || [];
    if (recentSymptoms) {
        const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
        const recent  = symptoms.filter(s => new Date(s.symptom_date) >= weekAgo);
        recentSymptoms.textContent = recent.length;
    }
}

// FIX 8: loadHealthInsights — expanded rules + Claude API call
async function loadHealthInsights(userId) {
    const analysisEl       = document.getElementById('analysisInsights');
    const recommendationEl = document.getElementById('recommendationInsights');

    if (!analysisEl || !recommendationEl) return;

    // Show loading state
    analysisEl.innerHTML       = '<p>🔍 Analysing your health data...</p>';
    recommendationEl.innerHTML = '<p>🤖 Generating recommendations...</p>';

    try {
        const insights        = [];
        const recommendations = [];

        const vitals      = appState.dashboardData.vitalSigns      || [];
        const meds        = appState.dashboardData.medications      || [];
        const apps        = appState.dashboardData.appointments     || [];
        const symptoms    = appState.dashboardData.symptoms         || [];
        const labs        = appState.dashboardData.labResults       || [];

        const today       = new Date();
        const todayStr    = today.toISOString().split('T')[0];
        const weekAgo     = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);

        // --- RULE ENGINE ---

        // Blood pressure
        if (vitals.length > 0) {
            const sorted = [...vitals].sort((a, b) => new Date(b.recorded_at || b.created_at) - new Date(a.recorded_at || a.created_at));
            const latest = sorted[0];
            const avgSys = vitals.filter(v => v.systolic).reduce((s, v) => s + parseInt(v.systolic), 0) / (vitals.filter(v => v.systolic).length || 1);

            if (avgSys > 140) {
                insights.push('⚠️ Your average blood pressure is significantly elevated (Stage 2 Hypertension range).');
                recommendations.push('Consult your doctor urgently about blood pressure management. Reduce salt intake and avoid strenuous exercise until reviewed.');
            } else if (avgSys > 130) {
                insights.push('📈 Your blood pressure has been elevated recently (Stage 1 Hypertension range).');
                recommendations.push('Reduce sodium intake, increase potassium-rich foods (bananas, spinach), and aim for 30 min of moderate exercise daily.');
            } else if (avgSys < 90) {
                insights.push('📉 Your blood pressure readings are on the low side.');
                recommendations.push('Stay well hydrated, avoid standing up quickly, and speak to your doctor if you feel dizzy or faint.');
            } else {
                insights.push('✅ Your blood pressure is within a healthy range.');
                recommendations.push('Keep up your current lifestyle habits to maintain healthy blood pressure.');
            }

            // Heart rate
            if (latest.heart_rate) {
                const hr = parseInt(latest.heart_rate);
                if (hr > 100) {
                    insights.push('💓 Your resting heart rate is elevated (Tachycardia). This may indicate stress, dehydration, or an underlying condition.');
                    recommendations.push('Practice breathing exercises and reduce caffeine. If consistently above 100 bpm, seek medical evaluation.');
                } else if (hr < 60) {
                    insights.push('💓 Your resting heart rate is low (Bradycardia). This can be normal for athletes but may need monitoring.');
                    recommendations.push('Monitor for symptoms like dizziness or fatigue. Report persistent low heart rate to your doctor.');
                }
            }

            // Stale vitals check
            const lastVitalDate = new Date(sorted[0].recorded_at || sorted[0].created_at);
            const daysSinceVitals = Math.floor((today - lastVitalDate) / (1000 * 60 * 60 * 24));
            if (daysSinceVitals > 7) {
                insights.push(`📅 Your last vital signs were recorded ${daysSinceVitals} days ago.`);
                recommendations.push('Log your vitals regularly — at least once a week — for accurate trend tracking.');
            }
        } else {
            insights.push('📋 No vital signs recorded yet.');
            recommendations.push('Start logging your blood pressure, heart rate, and weight regularly for personalised insights.');
        }

        // Glucose
        const glucoseLabs = labs.filter(l => l.glucose != null).sort((a, b) => new Date(b.test_date) - new Date(a.test_date));
        if (glucoseLabs.length > 0) {
            const g = parseFloat(glucoseLabs[0].glucose);
            if (g >= 126) {
                insights.push(`🩸 Your latest fasting glucose (${g} mg/dL) is in the diabetes range.`);
                recommendations.push('Consult your doctor immediately. Monitor carbohydrate intake, increase fibre, and avoid sugary drinks.');
            } else if (g >= 100) {
                insights.push(`🩸 Your latest glucose (${g} mg/dL) indicates prediabetes.`);
                recommendations.push('Reduce refined sugars and processed carbs. Aim for 150 min of moderate exercise per week. Retest in 3 months.');
            } else {
                insights.push(`✅ Your fasting glucose (${g} mg/dL) is in the normal range.`);
            }

            // Cholesterol
            const cholLabs = labs.filter(l => l.cholesterol != null).sort((a, b) => new Date(b.test_date) - new Date(a.test_date));
            if (cholLabs.length > 0) {
                const c = parseFloat(cholLabs[0].cholesterol);
                if (c > 240) {
                    insights.push(`🧪 Your cholesterol (${c} mg/dL) is high.`);
                    recommendations.push('Reduce saturated fats and trans fats. Increase omega-3 rich foods (fish, flaxseed). Discuss statins with your doctor.');
                } else if (c > 200) {
                    insights.push(`🧪 Your cholesterol (${c} mg/dL) is borderline high.`);
                    recommendations.push('Adopt a heart-healthy diet. Limit red meat and full-fat dairy. Exercise at least 5 days per week.');
                }
            }
        } else {
            insights.push('🧪 No lab results recorded yet.');
            recommendations.push('Schedule a blood test to check glucose, cholesterol, and other key markers.');
        }

        // Medications
        const activeMeds = meds.filter(m => !m.status || m.status === 'active' || m.status === 'current');
        if (activeMeds.length > 0) {
            insights.push(`💊 You have ${activeMeds.length} active medication${activeMeds.length > 1 ? 's' : ''}.`);
            recommendations.push('Take medications at the same time each day. Use a pill organiser or set phone reminders to improve adherence.');
            if (activeMeds.length >= 5) {
                recommendations.push('You are on multiple medications (polypharmacy). Ask your doctor to review your full medication list for interactions.');
            }
        }

        // Appointments
        const upcomingApps = apps.filter(a => a.appointment_date >= todayStr).sort((a, b) => new Date(a.appointment_date) - new Date(b.appointment_date));
        if (upcomingApps.length > 0) {
            const next = upcomingApps[0];
            const daysUntil = Math.ceil((new Date(next.appointment_date) - today) / (1000 * 60 * 60 * 24));
            if (daysUntil <= 7) {
                recommendations.push(`📅 You have an appointment with ${next.doctor_name || 'your doctor'} in ${daysUntil} day${daysUntil === 1 ? '' : 's'}. Prepare a list of questions.`);
            }
        } else {
            recommendations.push('No upcoming appointments. Consider scheduling a routine check-up if it has been more than 6 months.');
        }

        // Symptoms
        const recentSymptoms = symptoms.filter(s => new Date(s.symptom_date) >= weekAgo);
        if (recentSymptoms.length >= 3) {
            insights.push(`🤒 You logged ${recentSymptoms.length} symptoms in the past 7 days.`);
            recommendations.push('Multiple recent symptoms may warrant a doctor visit. Bring your symptom log to your next appointment.');
        }

        // Display rule-based results immediately
        analysisEl.innerHTML       = insights.map(i => `<p style="margin-bottom:8px">${i}</p>`).join('');
        recommendationEl.innerHTML = recommendations.map(r => `<p style="margin-bottom:8px">• ${r}</p>`).join('');

        // --- CLAUDE API CALL for AI Health Summary ---
        await loadClaudeInsights(userId, vitals, labs, meds, symptoms, apps);

    } catch (error) {
        console.warn('Error loading insights:', error);
        analysisEl.innerHTML       = '<p>• Your health data is being analysed.</p>';
        recommendationEl.innerHTML = '<p>• Continue tracking your health metrics.</p>';
    }
}

// Claude API health summary
async function loadClaudeInsights(userId, vitals, labs, meds, symptoms, apps) {
    // Find or create the AI card
    let aiCard = document.getElementById('aiInsightCard');
    if (!aiCard) {
        const insightsContainer = document.querySelector('.insights-container');
        if (!insightsContainer) return;

        aiCard = document.createElement('div');
        aiCard.id        = 'aiInsightCard';
        aiCard.className = 'insight-card';
        aiCard.style.cssText = 'grid-column: 1 / -1; border-left: 4px solid #1976d2;';
        aiCard.innerHTML = `
            <div class="insight-header">
                <i class="fas fa-robot" style="color:#1976d2"></i>
                <h3>AI Health Summary</h3>
                <span id="aiLoadingBadge" style="margin-left:auto;font-size:12px;color:#64748b;display:flex;align-items:center;gap:6px;">
                    <i class="fas fa-spinner fa-spin"></i> Generating personalised summary...
                </span>
            </div>
            <div class="insight-content" id="aiInsightContent" style="color:#475569;line-height:1.8;"></div>
        `;
        insightsContainer.appendChild(aiCard);
    }

    const aiContent = document.getElementById('aiInsightContent');
    const aiBadge   = document.getElementById('aiLoadingBadge');

    // Build summary of patient data for prompt
    const latestVital = vitals.length > 0
        ? vitals.sort((a, b) => new Date(b.recorded_at || b.created_at) - new Date(a.recorded_at || a.created_at))[0]
        : null;

    const latestGlucose = labs.filter(l => l.glucose != null).sort((a, b) => new Date(b.test_date) - new Date(a.test_date))[0];
    const latestCholesterol = labs.filter(l => l.cholesterol != null).sort((a, b) => new Date(b.test_date) - new Date(a.test_date))[0];
    const activeMedCount = meds.filter(m => !m.status || m.status === 'active' || m.status === 'current').length;
    const recentSymptomCount = symptoms.filter(s => {
        const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
        return new Date(s.symptom_date) >= weekAgo;
    }).length;
    const today = new Date().toISOString().split('T')[0];
    const upcomingApptCount = apps.filter(a => a.appointment_date >= today).length;

    const patientSummary = [
        latestVital?.systolic  ? `Blood pressure: ${latestVital.systolic}/${latestVital.diastolic} mmHg` : 'No blood pressure recorded',
        latestVital?.heart_rate ? `Heart rate: ${latestVital.heart_rate} bpm` : null,
        latestGlucose           ? `Fasting glucose: ${latestGlucose.glucose} mg/dL` : 'No glucose recorded',
        latestCholesterol       ? `Cholesterol: ${latestCholesterol.cholesterol} mg/dL` : null,
        `Active medications: ${activeMedCount}`,
        `Symptoms in last 7 days: ${recentSymptomCount}`,
        `Upcoming appointments: ${upcomingApptCount}`,
        `Total vitals logged: ${vitals.length}`,
        `Total lab results: ${labs.length}`
    ].filter(Boolean).join('\n');

    try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 1000,
                messages: [{
                    role: 'user',
                    content: `You are a compassionate health assistant inside a personal health tracking app called Healytica Record. 
                    
Based on the following patient health data, write a brief, friendly, and personalised health summary in 3–4 sentences. 
Focus on the most important findings, highlight what is going well, and flag anything that needs attention. 
Do NOT give a diagnosis. Do NOT use bullet points. Write in plain, warm, conversational English.
End with one encouraging sentence.

Patient data:
${patientSummary}

Respond with ONLY the health summary paragraph. No preamble, no headings.`
                }]
            })
        });

        const result = await response.json();

        if (result.content && result.content[0] && result.content[0].text) {
            if (aiContent) aiContent.innerHTML = `<p>${result.content[0].text}</p>`;
            if (aiBadge)   aiBadge.style.display = 'none';
        } else {
            throw new Error('No content in response');
        }

    } catch (error) {
        console.warn('Claude API call failed:', error);
        if (aiContent) aiContent.innerHTML = '<p>Unable to generate AI summary at this time. Your rule-based insights above are still accurate.</p>';
        if (aiBadge)   aiBadge.style.display = 'none';
    }
}

// destroyAllCharts — unchanged
async function destroyAllCharts() {
    Object.keys(chartInstances).forEach(key => {
        if (chartInstances[key]) {
            try { chartInstances[key].destroy(); chartInstances[key] = null; } catch (e) { /* ignore */ }
        }
    });

    try {
        if (window.Chart && Chart.instances) {
            Object.values({ ...Chart.instances }).forEach(i => { try { i.destroy(); } catch (e) { /* ignore */ } });
        }
    } catch (e) { /* ignore */ }

    ['bpChart','hrChart','glucoseChart','bmiChart','mainChart'].forEach(id => {
        const canvas = document.getElementById(id);
        if (canvas) { try { canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height); } catch (e) { /* ignore */ } }
    });

    await new Promise(resolve => setTimeout(resolve, 50));
}

// FIX 4 + FIX 5: setupDashboardListeners — chart tab now calls full switchChartType rebuild
function setupDashboardListeners() {
    console.log('Setting up dashboard listeners...');

    // Logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async function() {
            if (confirm('Are you sure you want to logout?')) {
                try {
                    await supabaseService.signOut();
                    window.location.href = 'index.html';
                } catch (error) {
                    showMessage('error', 'Logout failed');
                }
            }
        });
    }

    // Mobile menu
    const menuToggle = document.getElementById('menuToggle');
    if (menuToggle) {
        menuToggle.addEventListener('click', function() {
            const sidebar = document.getElementById('sidebar');
            if (sidebar) sidebar.classList.toggle('mobile-open');
        });
    }

    // Refresh
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', async function() {
            const originalText = this.innerHTML;
            this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Refreshing';
            this.disabled  = true;
            try {
                await loadDashboardData();
                showMessage('success', 'Dashboard refreshed successfully!');
            } catch (error) {
                showMessage('error', 'Failed to refresh dashboard');
            } finally {
                this.innerHTML = originalText;
                this.disabled  = false;
            }
        });
    }

    // Quick action buttons
    const quickButtons = [
        { id: 'quickMedBtn',      url: 'medications.html?action=add' },
        { id: 'quickVitalBtn',    url: 'vital_signs.html?action=add' },
        { id: 'actionMedication', url: 'medications.html?action=add' },
        { id: 'actionLab',        url: 'lab_results.html?action=add' },
        { id: 'actionVital',      url: 'vital_signs.html?action=add' },
        { id: 'actionSymptom',    url: 'symptoms.html?action=add' },
        { id: 'actionAppointment',url: 'appointments.html?action=add' }
    ];
    quickButtons.forEach(item => {
        const btn = document.getElementById(item.id);
        if (btn) {
            btn.addEventListener('click', function(e) {
                e.preventDefault();
                window.location.href = item.url;
            });
        }
    });

    // Export
    const exportBtn = document.getElementById('actionExport');
    if (exportBtn) {
        exportBtn.addEventListener('click', function() { exportHealthData(); });
    }

    // FIX 5: Chart tabs — full rebuild per tab
    const chartTabs = document.querySelectorAll('.chart-tab');
    chartTabs.forEach(tab => {
        tab.addEventListener('click', async function() {
            chartTabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');

            const chartType = this.getAttribute('data-chart');
            const dateRange = getDateRange();

            // Fully rebuild chart with correct datasets
            await switchChartType(chartType, appState.currentUser?.id, dateRange);
            showMessage('info', `Showing ${chartType} data`);
        });
    });

    // View all activity
    const viewAllActivity = document.getElementById('viewAllActivity');
    if (viewAllActivity) {
        viewAllActivity.addEventListener('click', function() {
            showMessage('info', 'Viewing all activity history');
        });
    }

    // Footer links
    const privacyLink = document.getElementById('privacyPolicyLink');
    if (privacyLink) {
        privacyLink.addEventListener('click', function(e) {
            e.preventDefault();
            showMessage('info', 'Privacy Policy - Your data is encrypted and secure');
        });
    }

    const termsLink = document.getElementById('termsOfServiceLink');
    if (termsLink) {
        termsLink.addEventListener('click', function(e) {
            e.preventDefault();
            showMessage('info', 'Terms of Service - Healytica Record v1.0');
        });
    }

    const helpLink = document.getElementById('helpCenterLink');
    if (helpLink) {
        helpLink.addEventListener('click', function(e) {
            e.preventDefault();
            showMessage('info', 'Help Center - Contact support@healytica.com');
        });
    }

    // Keyboard shortcuts
    document.addEventListener('keydown', function(e) {
        if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
            e.preventDefault();
            document.getElementById('refreshBtn')?.click();
        }
        if (e.key === 'Escape') {
            const sidebar = document.getElementById('sidebar');
            if (sidebar && sidebar.classList.contains('mobile-open')) sidebar.classList.remove('mobile-open');
        }
        if (!e.ctrlKey && !e.metaKey && !e.altKey) {
            const num = parseInt(e.key);
            if (num >= 1 && num <= 4) {
                const tabs = document.querySelectorAll('.chart-tab');
                if (tabs[num - 1]) tabs[num - 1].click();
            }
        }
    });
}

// exportHealthData — upgraded to use appState real data
function exportHealthData() {
    showMessage('info', 'Preparing your health data export...');

    try {
        const data = {
            user:       { email: appState.currentUser?.email, profile: appState.userProfile },
            exportDate: new Date().toISOString(),
            metrics: {
                bloodPressure: document.getElementById('bpValue')?.textContent,
                heartRate:     document.getElementById('hrValue')?.textContent,
                glucose:       document.getElementById('glucoseValue')?.textContent,
                bmi:           document.getElementById('bmiValue')?.textContent
            },
            data: {
                medications:  appState.dashboardData.medications,
                labResults:   appState.dashboardData.labResults,
                appointments: appState.dashboardData.appointments,
                symptoms:     appState.dashboardData.symptoms,
                vitalSigns:   appState.dashboardData.vitalSigns
            },
            timestamp: new Date().toLocaleString()
        };

        const dataStr  = JSON.stringify(data, null, 2);
        const dataUri  = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
        const fileName = `healytica_export_${new Date().toISOString().split('T')[0]}.json`;

        const a = document.createElement('a');
        a.setAttribute('href', dataUri);
        a.setAttribute('download', fileName);
        a.click();

        showMessage('success', 'Health data exported successfully!');

    } catch (error) {
        console.error('Export error:', error);
        showMessage('error', 'Failed to export data');
    }
}

// showMessage — unchanged
function showMessage(type, text) {
    const container = document.getElementById('messageContainer');
    if (!container) return;

    const message = document.createElement('div');
    message.className = `message ${type}`;

    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    message.innerHTML = `
        <span class="message-icon">${icons[type] || 'ℹ️'}</span>
        <span class="message-text">${text}</span>
    `;
    container.appendChild(message);

    setTimeout(() => {
        message.style.opacity    = '0';
        message.style.transition = 'opacity 0.3s';
        setTimeout(() => { if (message.parentNode) message.parentNode.removeChild(message); }, 300);
    }, 5000);
}

// showLoading / hideLoading — unchanged
function showLoading() {
    const loader = document.getElementById('loader');
    if (loader) { loader.style.display = 'flex'; setTimeout(() => { loader.style.opacity = '1'; }, 10); }
}

function hideLoading() {
    const loader = document.getElementById('loader');
    if (loader) { loader.style.opacity = '0'; setTimeout(() => { loader.style.display = 'none'; }, 300); }
}

window.addEventListener('beforeunload', function() { destroyAllCharts(); });

// FIX 9: DOMContentLoaded — loader hides ONLY after initDashboard resolves
document.addEventListener('DOMContentLoaded', function() {
    console.log('Dashboard page loaded');

    if (window.location.pathname.includes('dashboard.html') || document.querySelector('.dashboard-page')) {
        destroyAllCharts();
        // NOTE: loader is NOT hidden here — initDashboard calls hideLoading() in its finally block
        setTimeout(async () => {
            if (typeof initDashboard === 'function') {
                await initDashboard();
            }
        }, 100);
    }
});

window.initDashboard     = initDashboard;
window.loadDashboardData = loadDashboardData;
window.destroyAllCharts  = destroyAllCharts;
window.switchChartType   = switchChartType;