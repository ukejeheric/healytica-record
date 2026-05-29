// ===== HEALYTICA RECORD — APPOINTMENTS MODULE =====
// Single source of truth. Do NOT duplicate this logic in appointments.html.
// appointments.html should only contain HTML + CSS, and load this file + Chart.js at the bottom of <body>.

// ===== SUPABASE INIT =====
// The Supabase CDN sets window.supabase. We create our named client here so every
// function in this file uses the same variable.
const SUPABASE_URL = 'https://osoclzojtrqdxykdmiks.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9zb2Nsem9qdHJxZHh5a2RtaWtzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4NzU4MjcsImV4cCI6MjA4MTQ1MTgyN30.fjFbgrqqXrxcnVPfSwHOsfPmi1PMXf-wW12p6J1nInk';

// supabaseClient is declared here and used by every function below.
// The HTML file must NOT declare its own supabaseClient or call createClient again.
let supabaseClient = null;

// ===== GLOBAL STATE =====
let currentUser = null;

const appointmentsState = {
    appointments: [],
    doctors: [],
    currentTab: 'schedule',
    calendar: {
        currentMonth: new Date().getMonth(),
        currentYear: new Date().getFullYear()
    }
};

// ===== MEDICAL SPECIALTIES =====
const MEDICAL_SPECIALTIES = {
    'primary':          ['Family Medicine Physician', 'Internal Medicine Physician', 'General Practitioner', 'Pediatrician', 'Geriatrician'],
    'cardiology':       ['Cardiologist', 'Interventional Cardiologist', 'Electrophysiologist', 'Cardiac Surgeon', 'Heart Failure Specialist'],
    'endocrinology':    ['Endocrinologist', 'Diabetes Specialist', 'Thyroid Specialist', 'Metabolic Specialist', 'Hormone Specialist'],
    'neurology':        ['Neurologist', 'Neurosurgeon', 'Stroke Specialist', 'Epilepsy Specialist', 'Movement Disorder Specialist'],
    'pulmonology':      ['Pulmonologist', 'Asthma Specialist', 'COPD Specialist', 'Sleep Medicine Specialist', 'Critical Care Specialist'],
    'gastroenterology': ['Gastroenterologist', 'Hepatologist', 'Endoscopist', 'IBD Specialist', 'Pancreatic Specialist'],
    'orthopedics':      ['Orthopedic Surgeon', 'Sports Medicine Specialist', 'Joint Replacement Specialist', 'Spine Specialist', 'Hand Surgeon'],
    'ophthalmology':    ['Ophthalmologist', 'Retina Specialist', 'Cornea Specialist', 'Glaucoma Specialist', 'Pediatric Ophthalmologist'],
    'ent':              ['Otolaryngologist', 'Head and Neck Surgeon', 'Rhinologist', 'Otologist', 'Laryngologist'],
    'dermatology':      ['Dermatologist', 'Cosmetic Dermatologist', 'Mohs Surgeon', 'Pediatric Dermatologist', 'Dermatopathologist'],
    'dentistry':        ['General Dentist', 'Orthodontist', 'Oral Surgeon', 'Periodontist', 'Endodontist'],
    'mental-health':    ['Psychiatrist', 'Psychologist', 'Therapist', 'Counselor', 'Addiction Specialist']
};

// ===== XSS HELPER =====
// BUG FIX: All user-supplied data rendered via innerHTML must be escaped.
function esc(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
}

// ===== SAFE DATE PARSER =====
// BUG FIX: new Date("2025-06-10") parses as UTC midnight, causing a timezone
// off-by-one day in negative-offset timezones. Always parse as local time.
function parseLocalDate(dateStr) {
    if (!dateStr) return new Date();
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d);
}

// ===== ENTRY POINT =====
document.addEventListener('DOMContentLoaded', async function () {
    console.log('DOM loaded — initialising appointments...');
    showLoading();

    try {
        // 1. Initialise Supabase
        if (typeof supabase === 'undefined') {
            showMessage('error', 'Supabase library failed to load. Please refresh the page.');
            return;
        }
        supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

        // 2. Check authentication
        const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
        if (authError || !user) {
            window.location.href = 'index.html';
            return;
        }
        currentUser = user;

        // 3. Update sidebar user info
        updateUserInfo();

        // 4. Set up all non-data UI (date, mobile menu, form steps, tabs, calendar nav)
        setupBasicUI();

        // 5. Load data from Supabase + localStorage
        await loadAppointmentsData();
        loadSavedDoctors();

        // 6. Wire up remaining interactive listeners
        setupEventListeners();

        // 7. Render initial UI state
        updateAppointmentsUI();

        console.log('Appointments page ready.');
    } catch (err) {
        console.error('Error initialising page:', err);
        showMessage('error', 'Failed to initialise page: ' + err.message);
    } finally {
        hideLoading();
    }
});

// ===== USER INFO =====
function updateUserInfo() {
    const userNameEl  = document.getElementById('userName');
    const userAvatarEl = document.getElementById('userAvatar');

    if (userNameEl)  userNameEl.textContent = currentUser.email || 'User';
    if (userAvatarEl) {
        userAvatarEl.textContent = (currentUser.email || 'U').charAt(0).toUpperCase();
        userAvatarEl.style.backgroundColor = '#1e3c72';
        userAvatarEl.style.color = 'white';
    }

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            await supabaseClient.auth.signOut();
            window.location.href = 'index.html';
        });
    }
}

// ===== BASIC UI =====
function setupBasicUI() {
    // Current date in header
    const dateEl = document.getElementById('currentDate');
    if (dateEl) {
        dateEl.textContent = new Date().toLocaleDateString('en-US', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });
    }

    // Mobile sidebar toggle
    const menuToggle = document.getElementById('menuToggle');
    const sidebar    = document.getElementById('sidebar');
    if (menuToggle && sidebar) {
        menuToggle.addEventListener('click', () => sidebar.classList.toggle('mobile-show'));
    }

    // Specialty → doctor-type cascade
    const specialtySelect   = document.getElementById('specialty');
    const doctorTypeSelect  = document.getElementById('doctorType');
    if (specialtySelect && doctorTypeSelect) {
        specialtySelect.addEventListener('change', function () {
            const doctors = MEDICAL_SPECIALTIES[this.value] || [];
            doctorTypeSelect.innerHTML = '<option value="">Select Doctor Type</option>';
            doctors.forEach(d => {
                const opt = document.createElement('option');
                opt.value = opt.textContent = d;
                doctorTypeSelect.appendChild(opt);
            });
        });
    }

    // Default date/time in form
    const today = new Date();
    const minDate = today.toISOString().split('T')[0];
    const apptDate = document.getElementById('appointmentDate');
    if (apptDate) { apptDate.min = minDate; apptDate.value = minDate; }

    const apptTime = document.getElementById('appointmentTime');
    if (apptTime) {
        const rounded = new Date();
        rounded.setMinutes(Math.ceil(rounded.getMinutes() / 30) * 30, 0, 0);
        apptTime.value = rounded.toTimeString().slice(0, 5);
    }

    // Multi-step form navigation
    document.querySelectorAll('.btn-next').forEach(btn => {
        btn.addEventListener('click', () => goToStep(btn.dataset.next));
    });
    document.querySelectorAll('.btn-prev').forEach(btn => {
        btn.addEventListener('click', () => goToStep(btn.dataset.prev));
    });

    // Tab switching
    document.querySelectorAll('.appointment-tab').forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });

    // Calendar prev/next/today
    setupCalendarNavigation();
}

// ===== EVENT LISTENERS =====
function setupEventListeners() {
    // Quick schedule + empty-state schedule buttons
    ['quickScheduleBtn', 'emptyScheduleBtn'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) btn.addEventListener('click', () => switchTab('schedule'));
    });

    // Add doctor
    const addDoctorBtn = document.getElementById('addDoctorBtn');
    if (addDoctorBtn) addDoctorBtn.addEventListener('click', () => showAddDoctorModal());

    // Doctor search (demo)
    const searchDoctorBtn = document.getElementById('searchDoctorBtn');
    if (searchDoctorBtn) {
        searchDoctorBtn.addEventListener('click', () => {
            const q = (document.getElementById('doctorSearch')?.value || '').trim();
            if (q) showMessage('info', `Searching for "${q}"… (would query external database)`);
        });
    }

    // Filter & search on appointments list
    const filterSelect = document.getElementById('appointmentFilter');
    const searchInput  = document.getElementById('appointmentSearch');
    if (filterSelect) filterSelect.addEventListener('change', updateAppointmentsList);
    if (searchInput)  searchInput.addEventListener('input',  updateAppointmentsList);

    // Form submission
    setupFormSubmission();
}

// ===== DATA LOADING =====
async function loadAppointmentsData() {
    try {
        const { data, error } = await supabaseClient
            .from('appointments')
            .select('*')
            .eq('user_id', currentUser.id)
            .order('appointment_date', { ascending: false });

        if (error) {
            if (error.code === 'PGRST204') {
                showMessage('warning', 'Database is still initialising. Please refresh in a moment.');
            } else {
                showMessage('error', 'Failed to load appointments: ' + error.message);
            }
            appointmentsState.appointments = [];
            return;
        }
        appointmentsState.appointments = data || [];
    } catch (err) {
        console.error('loadAppointmentsData:', err);
        appointmentsState.appointments = [];
    }
}

function loadSavedDoctors() {
    try {
        const stored = localStorage.getItem('saved_doctors');
        if (stored) {
            appointmentsState.doctors = JSON.parse(stored);
        } else {
            // Seed with sample data on first use
            appointmentsState.doctors = [
                { id: 1, name: 'Dr. Sarah Johnson',    specialty: 'primary',       clinic: 'City Health Center',         phone: '(555) 123-4567', address: '123 Medical Street, Health City',     notes: 'Primary care physician' },
                { id: 2, name: 'Dr. Michael Chen',     specialty: 'cardiology',    clinic: 'Heart Care Associates',      phone: '(555) 234-5678', address: '456 Heart Avenue, Cardiology Center', notes: 'Cardiologist specialising in heart failure' },
                { id: 3, name: 'Dr. Emily Rodriguez',  specialty: 'endocrinology', clinic: 'Diabetes & Hormone Center',  phone: '(555) 345-6789', address: '789 Hormone Lane, Endocrine Building', notes: 'Diabetes specialist' }
            ];
            localStorage.setItem('saved_doctors', JSON.stringify(appointmentsState.doctors));
        }
    } catch (err) {
        console.error('loadSavedDoctors:', err);
        appointmentsState.doctors = [];
    }
}

// ===== UI REFRESH =====
// BUG FIX: updateCalendar() was called but never defined. Renamed to renderCalendar()
// which exists. updateAnalytics() no longer has an early-return guard that blocked
// status counts from updating outside the analytics tab.
function updateAppointmentsUI() {
    updateAppointmentStats();
    updateSidebarStats();
    updateAppointmentsList();
    renderCalendar();     // was: updateCalendar() — undefined
    updateAnalytics();
}

function updateAppointmentStats() {
    const apts  = appointmentsState.appointments;
    const today = new Date().toISOString().split('T')[0];

    const set = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
    };

    set('totalAppointments', apts.length);
    set('upcomingCount', apts.filter(a => a.appointment_date >= today && a.status === 'scheduled').length);
    set('todayCount',    apts.filter(a => a.appointment_date === today && a.status === 'scheduled').length);
    set('pastCount',     apts.filter(a => a.appointment_date < today  || a.status !== 'scheduled').length);
    set('scheduledCount', apts.filter(a => a.status === 'scheduled').length);
    set('completedCount', apts.filter(a => a.status === 'completed').length);
    set('cancelledCount', apts.filter(a => a.status === 'cancelled').length);
}

function updateSidebarStats() {
    const apts  = appointmentsState.appointments;
    const today = new Date().toISOString().split('T')[0];

    const todayEl    = document.getElementById('todayAppointments');
    const upcomingEl = document.getElementById('upcomingAppointments');
    if (todayEl)    todayEl.textContent    = apts.filter(a => a.appointment_date === today && a.status === 'scheduled').length;
    if (upcomingEl) upcomingEl.textContent = apts.filter(a => a.appointment_date >= today  && a.status === 'scheduled').length;
}

// ===== TAB SWITCHING =====
function switchTab(tabId) {
    document.querySelectorAll('.appointment-tab').forEach(t =>
        t.classList.toggle('active', t.dataset.tab === tabId)
    );
    document.querySelectorAll('.tab-content').forEach(c =>
        c.classList.toggle('active', c.id === `${tabId}-tab`)
    );
    appointmentsState.currentTab = tabId;

    switch (tabId) {
        case 'my-appointments': updateAppointmentsList(); break;
        case 'calendar':        renderCalendar();         break;
        case 'doctors':         loadDoctorsDirectory();   break;
        case 'analytics':       updateAnalytics();        break;
    }
}

// ===== MULTI-STEP FORM =====
function goToStep(stepNumber) {
    const current = document.querySelector('.form-step.active');
    const next    = document.querySelector(`[data-step="${stepNumber}"]`);
    if (!current || !next) return;

    // Validate before advancing
    if (Number(stepNumber) > Number(current.dataset.step)) {
        if (!validateStep(current)) {
            showMessage('error', 'Please fill all required fields before proceeding.');
            return;
        }
    }
    current.classList.remove('active');
    next.classList.add('active');
    next.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// BUG FIX: Error messages were stacking on repeated clicks because the check used
// nextElementSibling (fragile). Now we always remove any existing .error-message
// first, then add one only when needed.
function validateStep(stepEl) {
    let isValid = true;
    stepEl.querySelectorAll('[required]').forEach(field => {
        // Always clear previous error first
        const prev = field.parentNode.querySelector('.error-message');
        if (prev) prev.remove();
        field.classList.remove('error');

        if (!field.value.trim()) {
            isValid = false;
            field.classList.add('error');
            const msg = document.createElement('div');
            msg.className = 'error-message';
            msg.textContent = 'This field is required';
            field.parentNode.appendChild(msg);
        }
    });
    return isValid;
}

function setupFormSubmission() {
    const form = document.getElementById('scheduleAppointmentForm');
    if (!form) return;

    form.addEventListener('submit', async function (e) {
        e.preventDefault();

        // Validate all steps
        const steps = this.querySelectorAll('.form-step');
        let allValid = true;
        steps.forEach(s => { if (!validateStep(s)) allValid = false; });
        if (!allValid) { showMessage('error', 'Please fill all required fields.'); return; }

        const symptoms = [...document.querySelectorAll('input[name="symptoms"]:checked')]
            .map(cb => cb.value).join(', ');

        const formData = {
            user_id:            currentUser.id,
            specialty:          document.getElementById('specialty').value,
            doctor_type:        document.getElementById('doctorType').value,
            doctor_name:        document.getElementById('doctorName').value || document.getElementById('doctorType').value,
            appointment_date:   document.getElementById('appointmentDate').value,
            appointment_time:   document.getElementById('appointmentTime').value,
            appointment_type:   document.getElementById('appointmentType').value,
            clinic_name:        document.getElementById('clinicName').value,
            clinic_address:     document.getElementById('clinicAddress').value,
            clinic_phone:       document.getElementById('clinicPhone').value,
            insurance_provider: document.getElementById('insuranceProvider').value,
            insurance_id:       document.getElementById('insuranceId').value,
            reason:             document.getElementById('reason').value,
            urgency:            document.getElementById('urgency').value,
            preparation:        document.getElementById('preparation').value,
            questions:          document.getElementById('questions').value,
            additional_notes:   document.getElementById('additionalNotes').value,
            symptoms,
            status: 'scheduled'
        };

        showLoading();
        try {
            const { data, error } = await supabaseClient
                .from('appointments')
                .insert([formData])
                .select()
                .single();

            if (error) {
                if (error.code === 'PGRST204') {
                    showMessage('error', 'Database is still initialising. Please try again in a moment.');
                    return;
                }
                throw error;
            }

            appointmentsState.appointments.unshift(data);
            form.reset();
            goToStep('1');

            const spec = document.getElementById('specialty');
            if (spec) { spec.selectedIndex = 0; spec.dispatchEvent(new Event('change')); }

            showMessage('success', 'Appointment scheduled successfully!');
            updateAppointmentsUI();
            setTimeout(() => switchTab('my-appointments'), 1000);

        } catch (err) {
            console.error('Error saving appointment:', err);
            showMessage('error', 'Failed to schedule appointment: ' + err.message);
        } finally {
            hideLoading();
        }
    });
}

// ===== APPOINTMENTS LIST =====
function updateAppointmentsList() {
    const list = document.getElementById('appointmentsList');
    if (!list) return;

    const filter = document.getElementById('appointmentFilter')?.value || 'all';
    const search = (document.getElementById('appointmentSearch')?.value || '').toLowerCase();
    const today  = new Date().toISOString().split('T')[0];

    let apts = [...appointmentsState.appointments];

    switch (filter) {
        case 'upcoming':   apts = apts.filter(a => a.appointment_date >= today && a.status === 'scheduled'); break;
        case 'past':       apts = apts.filter(a => a.appointment_date <  today || a.status !== 'scheduled'); break;
        case 'today':      apts = apts.filter(a => a.appointment_date === today && a.status === 'scheduled'); break;
        case 'scheduled':  apts = apts.filter(a => a.status === 'scheduled');  break;
        case 'completed':  apts = apts.filter(a => a.status === 'completed');  break;
        case 'cancelled':  apts = apts.filter(a => a.status === 'cancelled');  break;
    }

    if (search) {
        apts = apts.filter(a =>
            [a.doctor_name, a.doctor_type, a.reason, a.clinic_name, a.specialty]
                .some(f => f && f.toLowerCase().includes(search))
        );
    }

    apts.sort((a, b) =>
        a.appointment_date !== b.appointment_date
            ? a.appointment_date.localeCompare(b.appointment_date)
            : a.appointment_time.localeCompare(b.appointment_time)
    );

    list.innerHTML = '';

    if (apts.length === 0) {
        list.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-calendar-times"></i>
                <h3>No Appointments Found</h3>
                <p>${search ? 'Try a different search term.' : 'Schedule your first appointment to get started!'}</p>
                <button class="btn-schedule" id="emptyScheduleBtn2">
                    <i class="fas fa-calendar-plus"></i> Schedule Appointment
                </button>
            </div>`;
        document.getElementById('emptyScheduleBtn2')
            ?.addEventListener('click', () => switchTab('schedule'));
        return;
    }

    apts.forEach(a => list.appendChild(createAppointmentElement(a)));
}

// BUG FIX: All dynamic fields now go through esc() to prevent XSS.
// BUG FIX: Date parsed with parseLocalDate() to fix off-by-one timezone issue.
function createAppointmentElement(apt) {
    const div = document.createElement('div');
    div.className = 'appointment-item';
    div.dataset.id = apt.id;

    const date          = parseLocalDate(apt.appointment_date);
    const formattedDate = date.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
    const statusText    = apt.status.charAt(0).toUpperCase() + apt.status.slice(1);
    const doctorName    = esc(apt.doctor_name || apt.doctor_type || 'Doctor');
    const reason        = esc(apt.reason || 'No reason specified');
    const clinic        = esc(apt.clinic_name || 'Clinic not specified');

    div.innerHTML = `
        <div class="appointment-header">
            <div class="appointment-title">
                <div class="appointment-doctor">${doctorName}</div>
                <div class="appointment-reason">${reason}</div>
            </div>
            <div class="appointment-status status-${apt.status}">${esc(statusText)}</div>
        </div>
        <div class="appointment-details">
            <div class="appointment-info">
                <div class="appointment-date">
                    <i class="fas fa-calendar-alt"></i>
                    ${esc(formattedDate)} at ${esc(apt.appointment_time)}
                </div>
                <div class="appointment-location">
                    <i class="fas fa-map-marker-alt"></i>
                    ${clinic}
                </div>
            </div>
            <div class="appointment-actions">
                ${apt.status === 'scheduled' ? `
                    <button class="btn-action btn-complete" data-id="${apt.id}">
                        <i class="fas fa-check"></i> Complete
                    </button>
                    <button class="btn-action btn-cancel" data-id="${apt.id}">
                        <i class="fas fa-times"></i> Cancel
                    </button>` : ''}
                <button class="btn-action btn-delete" data-id="${apt.id}">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </div>
        </div>`;

    if (apt.status === 'scheduled') {
        div.querySelector('.btn-complete')?.addEventListener('click', () => updateAppointmentStatus(apt.id, 'completed'));
        div.querySelector('.btn-cancel')?.addEventListener('click',   () => updateAppointmentStatus(apt.id, 'cancelled'));
    }
    div.querySelector('.btn-delete')?.addEventListener('click', () => deleteAppointment(apt.id));
    return div;
}

async function updateAppointmentStatus(id, newStatus) {
    if (!confirm(`Mark this appointment as ${newStatus}?`)) return;
    showLoading();
    try {
        const { data, error } = await supabaseClient
            .from('appointments')
            .update({ status: newStatus, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;

        const idx = appointmentsState.appointments.findIndex(a => a.id === id);
        if (idx !== -1) appointmentsState.appointments[idx] = data;

        updateAppointmentsUI();
        showMessage('success', `Appointment marked as ${newStatus}!`);
    } catch (err) {
        showMessage('error', 'Failed to update appointment status.');
    } finally {
        hideLoading();
    }
}

async function deleteAppointment(id) {
    if (!confirm('Delete this appointment? This cannot be undone.')) return;
    showLoading();
    try {
        const { error } = await supabaseClient.from('appointments').delete().eq('id', id);
        if (error) throw error;

        const idx = appointmentsState.appointments.findIndex(a => a.id === id);
        if (idx !== -1) appointmentsState.appointments.splice(idx, 1);

        updateAppointmentsUI();
        showMessage('success', 'Appointment deleted.');
    } catch (err) {
        showMessage('error', 'Failed to delete appointment.');
    } finally {
        hideLoading();
    }
}

// ===== CALENDAR =====
function setupCalendarNavigation() {
    document.getElementById('prevMonth')?.addEventListener('click', () => {
        if (--appointmentsState.calendar.currentMonth < 0) {
            appointmentsState.calendar.currentMonth = 11;
            appointmentsState.calendar.currentYear--;
        }
        renderCalendar();
    });
    document.getElementById('nextMonth')?.addEventListener('click', () => {
        if (++appointmentsState.calendar.currentMonth > 11) {
            appointmentsState.calendar.currentMonth = 0;
            appointmentsState.calendar.currentYear++;
        }
        renderCalendar();
    });
    document.getElementById('todayBtn')?.addEventListener('click', () => {
        appointmentsState.calendar.currentMonth = new Date().getMonth();
        appointmentsState.calendar.currentYear  = new Date().getFullYear();
        renderCalendar();
    });
}

function renderCalendar() {
    const grid         = document.getElementById('calendarGrid');
    const currentMonthEl = document.getElementById('currentMonth');
    if (!grid || !currentMonthEl) return;

    const { currentMonth, currentYear } = appointmentsState.calendar;
    const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    currentMonthEl.textContent = `${monthNames[currentMonth]} ${currentYear}`;

    const firstDay   = new Date(currentYear, currentMonth, 1);
    const totalDays  = new Date(currentYear, currentMonth + 1, 0).getDate();
    const startDay   = firstDay.getDay(); // 0=Sun
    const offset     = startDay === 0 ? 6 : startDay - 1; // make Mon=0

    grid.innerHTML = '';

    // Empty leading cells
    for (let i = 0; i < offset; i++) {
        const cell = document.createElement('div');
        cell.className = 'calendar-day empty';
        grid.appendChild(cell);
    }

    const todayStr = new Date().toISOString().split('T')[0];

    for (let day = 1; day <= totalDays; day++) {
        const cell    = document.createElement('div');
        const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
        cell.className = 'calendar-day' + (dateStr === todayStr ? ' today' : '');

        const dayApts = appointmentsState.appointments.filter(a => a.appointment_date === dateStr);

        cell.innerHTML = `
            <div class="day-number">${day}</div>
            ${dayApts.length ? `
                <div class="day-appointments">
                    <span class="has-appointment"></span>
                    ${dayApts.length} appointment${dayApts.length > 1 ? 's' : ''}
                </div>` : ''}`;

        if (dayApts.length) {
            cell.style.cursor = 'pointer';
            cell.addEventListener('click', () => showDayAppointments(dateStr, dayApts));
        }
        grid.appendChild(cell);
    }

    updateMonthAppointments();
}

function updateMonthAppointments() {
    const list = document.getElementById('monthAppointmentsList');
    if (!list) return;

    const { currentMonth, currentYear } = appointmentsState.calendar;
    const prefix = `${currentYear}-${String(currentMonth + 1).padStart(2,'0')}`;
    const apts   = appointmentsState.appointments
        .filter(a => a.appointment_date.startsWith(prefix))
        .sort((a, b) => a.appointment_date.localeCompare(b.appointment_date));

    list.innerHTML = '';
    if (!apts.length) {
        list.innerHTML = '<div class="empty-state-mini"><i class="fas fa-calendar-times"></i><p>No appointments this month</p></div>';
        return;
    }
    apts.forEach(a => {
        const el = document.createElement('div');
        el.className = 'mini-appointment';
        const d = parseLocalDate(a.appointment_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        el.innerHTML = `
            <div class="mini-appointment-date">${esc(d)}</div>
            <div class="mini-appointment-details">
                <div class="mini-appointment-doctor">${esc(a.doctor_name || a.doctor_type || 'Doctor')}</div>
                <div class="mini-appointment-time">${esc(a.appointment_time)} • ${esc(a.clinic_name)}</div>
            </div>`;
        list.appendChild(el);
    });
}

function showDayAppointments(dateStr, apts) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    const formattedDate = parseLocalDate(dateStr).toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });

    modal.innerHTML = `
        <div class="modal-content" style="background:white;border-radius:10px;padding:30px;max-width:500px;width:90%;max-height:80vh;overflow-y:auto;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;padding-bottom:15px;border-bottom:1px solid #eee;">
                <h3 style="margin:0;color:#333;">Appointments — ${esc(formattedDate)}</h3>
                <button class="modal-close" style="background:none;border:none;font-size:1.5em;cursor:pointer;color:#666;">×</button>
            </div>
            ${apts.map(a => `
                <div style="padding:15px;border:1px solid #e0e0e0;border-radius:8px;margin-bottom:10px;">
                    <div style="display:flex;justify-content:space-between;margin-bottom:10px;">
                        <strong style="color:#333;">${esc(a.doctor_name || a.doctor_type)}</strong>
                        <span style="padding:3px 10px;border-radius:12px;font-size:0.85em;font-weight:500;
                            background:${a.status==='scheduled'?'#007bff':a.status==='completed'?'#28a745':'#dc3545'};color:white;">
                            ${esc(a.status)}
                        </span>
                    </div>
                    <div style="color:#666;font-size:0.9em;">
                        <div><i class="fas fa-clock"></i> ${esc(a.appointment_time)}</div>
                        <div><i class="fas fa-map-marker-alt"></i> ${esc(a.clinic_name)}</div>
                        <div><i class="fas fa-stethoscope"></i> ${esc(a.reason || 'No reason specified')}</div>
                    </div>
                </div>`).join('')}
        </div>`;

    document.body.appendChild(modal);
    const close = () => document.body.removeChild(modal);
    modal.querySelector('.modal-close').addEventListener('click', close);
    modal.addEventListener('click', e => { if (e.target === modal) close(); });
}

// ===== DOCTOR DIRECTORY =====
function loadDoctorsDirectory() {
    const grid = document.getElementById('savedDoctors');
    if (!grid) return;
    grid.innerHTML = '';

    if (!appointmentsState.doctors.length) {
        grid.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-user-md"></i>
                <h3>No Doctors Saved</h3>
                <p>Add your healthcare providers to quickly schedule appointments.</p>
            </div>`;
        return;
    }

    appointmentsState.doctors.forEach(doctor => {
        const card = document.createElement('div');
        card.className = 'doctor-card';
        card.innerHTML = `
            <div class="doctor-name">${esc(doctor.name)}</div>
            <div class="doctor-specialty"><i class="fas fa-stethoscope"></i> ${esc(doctor.specialty)}</div>
            <div class="doctor-info">
                <div class="doctor-clinic"><i class="fas fa-hospital"></i> ${esc(doctor.clinic)}</div>
                <div class="doctor-phone"><i class="fas fa-phone"></i> ${esc(doctor.phone)}</div>
            </div>
            <div class="doctor-actions">
                <button class="btn-action" data-id="${doctor.id}" data-action="schedule"><i class="fas fa-calendar-plus"></i> Schedule</button>
                <button class="btn-action" data-id="${doctor.id}" data-action="edit"><i class="fas fa-edit"></i> Edit</button>
                <button class="btn-action" data-id="${doctor.id}" data-action="delete"><i class="fas fa-trash"></i> Delete</button>
            </div>`;
        grid.appendChild(card);
    });

    // Wire up action buttons
    grid.querySelectorAll('.doctor-actions .btn-action').forEach(btn => {
        btn.addEventListener('click', function () {
            const id     = parseInt(this.dataset.id);
            const action = this.dataset.action;
            const doctor = appointmentsState.doctors.find(d => d.id === id);
            if (!doctor) return;
            if (action === 'schedule') scheduleWithDoctor(doctor);
            if (action === 'edit')     showAddDoctorModal(doctor);
            if (action === 'delete')   deleteDoctor(id);
        });
    });
}

// BUG FIX: setupDoctorDirectoryListeners() was called but never defined.
// Doctor listeners are now set up inline inside loadDoctorsDirectory() above.

function scheduleWithDoctor(doctor) {
    switchTab('schedule');
    setTimeout(() => {
        const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
        set('doctorName',   doctor.name);
        set('clinicName',   doctor.clinic);
        set('clinicPhone',  doctor.phone);
        set('clinicAddress', doctor.address);
        const spec = document.getElementById('specialty');
        if (spec && doctor.specialty) { spec.value = doctor.specialty; spec.dispatchEvent(new Event('change')); }
        window.scrollTo({ top: 0, behavior: 'smooth' });
        showMessage('info', `Scheduling with ${doctor.name} — fill in the remaining details.`);
    }, 300);
}

function deleteDoctor(id) {
    if (!confirm('Delete this doctor?')) return;
    const idx = appointmentsState.doctors.findIndex(d => d.id === id);
    if (idx !== -1) {
        appointmentsState.doctors.splice(idx, 1);
        localStorage.setItem('saved_doctors', JSON.stringify(appointmentsState.doctors));
        loadDoctorsDirectory();
        showMessage('success', 'Doctor deleted.');
    }
}

function showAddDoctorModal(doctor = null) {
    const isEdit = !!doctor;
    const modal  = document.createElement('div');
    modal.className = 'modal';

    modal.innerHTML = `
        <div class="modal-content" style="background:white;border-radius:10px;padding:30px;max-width:500px;width:90%;max-height:80vh;overflow-y:auto;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;padding-bottom:15px;border-bottom:1px solid #eee;">
                <h3 style="margin:0;color:#333;">${isEdit ? 'Edit Doctor' : 'Add New Doctor'}</h3>
                <button class="modal-close" style="background:none;border:none;font-size:1.5em;cursor:pointer;color:#666;">×</button>
            </div>
            <form id="doctorForm" style="display:flex;flex-direction:column;gap:15px;">
                <div>
                    <label style="display:block;margin-bottom:5px;font-weight:500;">Doctor Name *</label>
                    <input type="text" id="modalDoctorName" required style="width:100%;padding:10px;border:2px solid #e0e0e0;border-radius:6px;font-size:1em;box-sizing:border-box;"
                        value="${esc(doctor?.name || '')}">
                </div>
                <div>
                    <label style="display:block;margin-bottom:5px;font-weight:500;">Specialty *</label>
                    <select id="modalSpecialty" required style="width:100%;padding:10px;border:2px solid #e0e0e0;border-radius:6px;font-size:1em;">
                        <option value="">Select Specialty</option>
                        ${Object.keys(MEDICAL_SPECIALTIES).map(k => `
                            <option value="${k}" ${doctor?.specialty === k ? 'selected' : ''}>
                                ${k.charAt(0).toUpperCase() + k.slice(1).replace('-', ' ')}
                            </option>`).join('')}
                    </select>
                </div>
                <div>
                    <label style="display:block;margin-bottom:5px;font-weight:500;">Clinic/Hospital *</label>
                    <input type="text" id="modalClinic" required style="width:100%;padding:10px;border:2px solid #e0e0e0;border-radius:6px;font-size:1em;box-sizing:border-box;"
                        value="${esc(doctor?.clinic || '')}">
                </div>
                <div>
                    <label style="display:block;margin-bottom:5px;font-weight:500;">Phone</label>
                    <input type="tel" id="modalPhone" style="width:100%;padding:10px;border:2px solid #e0e0e0;border-radius:6px;font-size:1em;box-sizing:border-box;"
                        value="${esc(doctor?.phone || '')}">
                </div>
                <div>
                    <label style="display:block;margin-bottom:5px;font-weight:500;">Address</label>
                    <textarea id="modalAddress" rows="3" style="width:100%;padding:10px;border:2px solid #e0e0e0;border-radius:6px;font-size:1em;box-sizing:border-box;resize:vertical;">${esc(doctor?.address || '')}</textarea>
                </div>
                <div>
                    <label style="display:block;margin-bottom:5px;font-weight:500;">Notes</label>
                    <textarea id="modalNotes" rows="2" style="width:100%;padding:10px;border:2px solid #e0e0e0;border-radius:6px;font-size:1em;box-sizing:border-box;resize:vertical;">${esc(doctor?.notes || '')}</textarea>
                </div>
                <div style="display:flex;gap:10px;margin-top:10px;">
                    <button type="button" class="modal-cancel" style="flex:1;padding:12px;background:#f8f9fa;border:1px solid #ddd;border-radius:6px;cursor:pointer;font-weight:500;">Cancel</button>
                    <button type="submit" style="flex:1;padding:12px;background:#1e3c72;border:none;border-radius:6px;color:white;cursor:pointer;font-weight:500;">
                        ${isEdit ? 'Update Doctor' : 'Add Doctor'}
                    </button>
                </div>
            </form>
        </div>`;

    document.body.appendChild(modal);

    modal.querySelector('#doctorForm').addEventListener('submit', e => {
        e.preventDefault();
        const doctorData = {
            name:      modal.querySelector('#modalDoctorName').value,
            specialty: modal.querySelector('#modalSpecialty').value,
            clinic:    modal.querySelector('#modalClinic').value,
            phone:     modal.querySelector('#modalPhone').value,
            address:   modal.querySelector('#modalAddress').value,
            notes:     modal.querySelector('#modalNotes').value
        };

        if (isEdit) {
            doctorData.id = doctor.id;
            const idx = appointmentsState.doctors.findIndex(d => d.id === doctor.id);
            if (idx !== -1) appointmentsState.doctors[idx] = doctorData;
        } else {
            // BUG FIX: Math.max of empty array returns -Infinity. Guard against that.
            const maxId = appointmentsState.doctors.length
                ? Math.max(...appointmentsState.doctors.map(d => d.id))
                : 0;
            doctorData.id = maxId + 1;
            appointmentsState.doctors.push(doctorData);
        }

        localStorage.setItem('saved_doctors', JSON.stringify(appointmentsState.doctors));
        document.body.removeChild(modal);
        loadDoctorsDirectory();
        showMessage('success', `Doctor ${isEdit ? 'updated' : 'added'} successfully!`);
    });

    const close = () => document.body.removeChild(modal);
    modal.querySelector('.modal-close').addEventListener('click', close);
    modal.querySelector('.modal-cancel').addEventListener('click', close);
    modal.addEventListener('click', e => { if (e.target === modal) close(); });
}

// ===== ANALYTICS =====
// BUG FIX: Removed the early-return guard (if currentTab !== 'analytics') that
// prevented status counts from updating when the user was on other tabs.
// Charts are still only rendered when the analytics tab is active (they need
// visible canvas dimensions), but the stat counters always update.
function updateAnalytics() {
    // Always update status counters
    updateAppointmentStats(); // already sets scheduledCount / completedCount / cancelledCount

    // Only render charts when the tab is visible (canvas needs layout dimensions)
    if (appointmentsState.currentTab === 'analytics') {
        updateFrequencyChart(appointmentsState.appointments);
        updateDoctorChart(appointmentsState.appointments);
        updateUpcomingList();
    }
}

function updateFrequencyChart(apts) {
    const canvas = document.getElementById('frequencyChart');
    if (!canvas) return;
    Chart.getChart(canvas)?.destroy();

    const counts = {};
    apts.forEach(a => {
        const d  = parseLocalDate(a.appointment_date);
        const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
        counts[key] = (counts[key] || 0) + 1;
    });
    const months = Object.keys(counts).sort();

    new Chart(canvas, {
        type: 'line',
        data: {
            labels: months.map(m => {
                const [y, mo] = m.split('-');
                return `${new Date(+y, +mo-1).toLocaleDateString('en-US', { month: 'short' })} ${y}`;
            }),
            datasets: [{ label: 'Appointments', data: months.map(m => counts[m]),
                borderColor: '#1e3c72', backgroundColor: 'rgba(30,60,114,0.1)', tension: 0.4, fill: true }]
        },
        options: { responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }
    });
}

function updateDoctorChart(apts) {
    const canvas = document.getElementById('doctorChart');
    if (!canvas) return;
    Chart.getChart(canvas)?.destroy();

    const counts = {};
    apts.forEach(a => {
        const key = a.doctor_name || a.doctor_type || 'Unknown';
        counts[key] = (counts[key] || 0) + 1;
    });

    const top5 = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

    new Chart(canvas, {
        type: 'doughnut',
        data: {
            labels: top5.map(([k]) => k),
            datasets: [{ data: top5.map(([,v]) => v),
                backgroundColor: ['#1e3c72','#28a745','#0078D4','#ffc107','#dc3545'] }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' } } }
    });
}

function updateUpcomingList() {
    const list  = document.getElementById('upcomingList');
    if (!list) return;
    const today = new Date().toISOString().split('T')[0];
    const apts  = appointmentsState.appointments
        .filter(a => a.appointment_date >= today && a.status === 'scheduled')
        .sort((a, b) => a.appointment_date.localeCompare(b.appointment_date))
        .slice(0, 5);

    list.innerHTML = '';
    if (!apts.length) {
        list.innerHTML = '<div class="empty-state-mini"><i class="fas fa-calendar-times"></i><p>No upcoming appointments</p></div>';
        return;
    }
    apts.forEach(a => {
        const el = document.createElement('div');
        el.className = 'mini-appointment';
        const d = parseLocalDate(a.appointment_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        el.innerHTML = `
            <div class="mini-appointment-date">${esc(d)}</div>
            <div class="mini-appointment-details">
                <div class="mini-appointment-doctor">${esc(a.doctor_name || a.doctor_type || 'Doctor')}</div>
                <div class="mini-appointment-time">${esc(a.appointment_time)}</div>
            </div>`;
        list.appendChild(el);
    });
}

// ===== UTILITIES =====
function showLoading() {
    const el = document.getElementById('loader');
    if (el) el.style.display = 'flex';
}
function hideLoading() {
    const el = document.getElementById('loader');
    if (el) el.style.display = 'none';
}
function showMessage(type, text) {
    const container = document.getElementById('messageContainer');
    if (!container) { console.log(`[${type.toUpperCase()}]`, text); return; }

    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    const msg = document.createElement('div');
    msg.className = `message ${type}`;
    msg.innerHTML = `<span class="message-icon">${icons[type] || 'ℹ️'}</span><span class="message-text">${esc(text)}</span>`;
    container.appendChild(msg);

    setTimeout(() => {
        msg.style.transition = 'opacity 0.3s';
        msg.style.opacity = '0';
        setTimeout(() => msg.parentNode?.removeChild(msg), 300);
    }, 5000);
}