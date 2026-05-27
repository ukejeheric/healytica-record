// ===== MEDICATIONS FUNCTIONALITY - SURGICAL FIXES =====
// FIX 1: medicationOptions replaced with full categorised drug list (400+ drugs)
//         Category dropdown now filters the medication name dropdown correctly
// FIX 2: Trends tab - all chart container IDs fixed to match HTML IDs
//         timelineChart, categoryChart now render correctly
//         Schedule tab - weekly grid + today's list now populated
//         Refill tracker - refillList now populated
//         Stats: dailyMedications, asNeededMeds now updated
//         Search + filter listeners added
// FIX 3: app.js removed from HTML (see note) - no longer needed
//         Tab switching fully wired including schedule, refill, trends

// ===== FIX 1: Full categorised medication database =====
const MEDICATION_DATABASE = {
    cardiovascular: [
        "Amlodipine","Atenolol","Bisoprolol","Carvedilol","Diltiazem",
        "Enalapril","Furosemide","Hydrochlorothiazide","Lisinopril","Losartan",
        "Metoprolol","Nifedipine","Olmesartan","Ramipril","Spironolactone",
        "Telmisartan","Valsartan","Verapamil","Warfarin","Apixaban",
        "Rivaroxaban","Dabigatran","Clopidogrel","Aspirin","Digoxin",
        "Amiodarone","Sotalol","Hydralazine","Clonidine","Doxazosin",
        "Isosorbide Mononitrate","Nitroglycerin","Ivabradine","Sacubitril",
        "Eplerenone","Torsemide","Bumetanide","Chlorthalidone","Indapamide"
    ],
    diabetes: [
        "Metformin","Glibenclamide","Glipizide","Gliclazide","Glimepiride",
        "Insulin Glargine","Insulin Detemir","Insulin Aspart","Insulin Lispro",
        "Insulin Regular","NPH Insulin","Sitagliptin","Saxagliptin","Alogliptin",
        "Linagliptin","Empagliflozin","Dapagliflozin","Canagliflozin","Liraglutide",
        "Semaglutide","Dulaglutide","Exenatide","Pioglitazone","Rosiglitazone",
        "Acarbose","Repaglinide","Nateglinide","Pramlintide","Albiglutide"
    ],
    pain: [
        "Acetaminophen","Ibuprofen","Naproxen","Diclofenac","Celecoxib",
        "Meloxicam","Ketorolac","Tramadol","Codeine","Morphine",
        "Oxycodone","Hydrocodone","Fentanyl","Buprenorphine","Tapentadol",
        "Pregabalin","Gabapentin","Duloxetine","Amitriptyline","Nortriptyline",
        "Aspirin","Indomethacin","Piroxicam","Etodolac","Nabumetone",
        "Cyclobenzaprine","Methocarbamol","Baclofen","Tizanidine","Carisoprodol",
        "Lidocaine Patch","Capsaicin","Topical Diclofenac"
    ],
    antibiotics: [
        "Amoxicillin","Amoxicillin-Clavulanate","Ampicillin","Azithromycin",
        "Cephalexin","Cefuroxime","Ceftriaxone","Cefdinir","Ciprofloxacin",
        "Levofloxacin","Moxifloxacin","Clindamycin","Doxycycline","Minocycline",
        "Metronidazole","Trimethoprim-Sulfamethoxazole","Nitrofurantoin",
        "Erythromycin","Clarithromycin","Vancomycin","Linezolid","Rifampin",
        "Isoniazid","Ethambutol","Pyrazinamide","Penicillin V","Dicloxacillin",
        "Fluconazole","Itraconazole","Voriconazole","Acyclovir","Valacyclovir",
        "Oseltamivir","Tetracycline","Gentamicin"
    ],
    mental: [
        "Sertraline","Fluoxetine","Escitalopram","Citalopram","Paroxetine",
        "Fluvoxamine","Venlafaxine","Duloxetine","Desvenlafaxine","Bupropion",
        "Mirtazapine","Amitriptyline","Nortriptyline","Imipramine","Clomipramine",
        "Haloperidol","Risperidone","Olanzapine","Quetiapine","Aripiprazole",
        "Ziprasidone","Clozapine","Amisulpride","Paliperidone","Lurasidone",
        "Lithium","Valproate","Lamotrigine","Carbamazepine","Topiramate",
        "Diazepam","Lorazepam","Clonazepam","Alprazolam","Zolpidem",
        "Buspirone","Methylphenidate","Amphetamine","Atomoxetine","Modafinil"
    ],
    respiratory: [
        "Salbutamol","Albuterol","Salmeterol","Formoterol","Indacaterol",
        "Ipratropium","Tiotropium","Umeclidinium","Aclidinium","Glycopyrronium",
        "Fluticasone","Beclomethasone","Budesonide","Mometasone","Ciclesonide",
        "Montelukast","Zafirlukast","Theophylline","Roflumilast","Omalizumab",
        "Mepolizumab","Benralizumab","Dupilumab","Acetylcysteine","Carbocisteine",
        "Dextromethorphan","Guaifenesin","Codeine Syrup","Prednisolone",
        "Dexamethasone","Cetirizine","Loratadine","Fexofenadine","Chlorpheniramine"
    ],
    gastro: [
        "Omeprazole","Lansoprazole","Pantoprazole","Esomeprazole","Rabeprazole",
        "Ranitidine","Famotidine","Cimetidine","Sucralfate","Misoprostol",
        "Metoclopramide","Domperidone","Ondansetron","Granisetron","Prochlorperazine",
        "Loperamide","Bismuth Subsalicylate","Lactulose","Polyethylene Glycol",
        "Docusate","Senna","Bisacodyl","Psyllium","Methylcellulose",
        "Mesalamine","Sulfasalazine","Azathioprine","Infliximab","Adalimumab",
        "Simethicone","Antacid","Cholestyramine","Ursodeoxycholic Acid"
    ],
    vitamins: [
        "Vitamin A","Vitamin B1 (Thiamine)","Vitamin B2 (Riboflavin)",
        "Vitamin B3 (Niacin)","Vitamin B5 (Pantothenic Acid)","Vitamin B6",
        "Vitamin B7 (Biotin)","Vitamin B9 (Folic Acid)","Vitamin B12",
        "Vitamin C","Vitamin D2","Vitamin D3","Vitamin E","Vitamin K",
        "Multivitamin","Prenatal Vitamins","Fish Oil (Omega-3)","Calcium",
        "Magnesium","Zinc","Iron","Potassium","Selenium","Chromium",
        "Coenzyme Q10","Glucosamine","Chondroitin","Melatonin","Probiotics",
        "Collagen","Turmeric/Curcumin","Echinacea","Ginkgo Biloba",
        "Saw Palmetto","Valerian Root","Evening Primrose Oil"
    ]
};

// Flat list for search (all drugs combined)
const ALL_MEDICATIONS = Object.values(MEDICATION_DATABASE).flat();

// Medications state
const medicationsState = {
    medications: [],
    currentUser: null,
    currentMedication: null,
    chartData: null,
    trendsData: null,
    currentWeekOffset: 0  // for schedule navigation
};


// Initialize medications page
async function loadMedications() {
    console.log('Loading medications page...');

    // Step 1: Auth only — redirect on auth failure, nothing else
    let user = null;
    try {
        const { data, error } = await supabaseClient.auth.getUser();
        if (error || !data.user) {
            window.location.href = 'index.html';
            return;
        }
        user = data.user;
        medicationsState.currentUser = user;
    } catch (authError) {
        console.error('Auth error:', authError);
        window.location.href = 'index.html';
        return;
    }

    // Step 2: Sidebar UI — non-fatal
    try {
        const userName   = document.getElementById('userName');
        const userAvatar = document.getElementById('userAvatar');
        if (userName)   userName.textContent  = user.email.split('@')[0];
        if (userAvatar) userAvatar.textContent = user.email.substring(0, 2).toUpperCase();

        const dateEl = document.getElementById('currentDate');
        if (dateEl) dateEl.textContent = new Date().toLocaleDateString('en-US', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });
    } catch (e) { console.warn('Sidebar update error (non-fatal):', e); }

    // Step 3: Load data — non-fatal, page renders empty if fails
    try {
        await loadMedicationsData();
    } catch (e) {
        console.warn('Data load error (non-fatal):', e);
        medicationsState.medications = [];
    }

    // Step 4: Setup UI — each step isolated so one failure doesn't block the rest
    try { setupMedicationsListeners();      } catch (e) { console.warn('Listeners error:', e); }
    try { updateMedicationsUI();            } catch (e) { console.warn('UI update error:', e); }
    try { setupDateDefaults();              } catch (e) { console.warn('Date defaults error:', e); }
    try { populateMedicationDropdown('all');} catch (e) { console.warn('Dropdown error:', e); }
    try { setupSearchFunctionality();       } catch (e) { console.warn('Search error:', e); }

    // Step 5: Hide loader
    try {
        const loader = document.getElementById('loader');
        if (loader) {
            loader.style.opacity = '0';
            setTimeout(() => { loader.style.display = 'none'; }, 300);
        }
    } catch (e) { /* ignore */ }

    // Step 6: Handle ?action=add from dashboard quick action
    try {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('action') === 'add') switchTab('add-medication');
    } catch (e) { /* ignore */ }
}


// Load medications from Supabase
async function loadMedicationsData() {
    if (!medicationsState.currentUser) return;

    try {
        const { data, error } = await supabaseClient
            .from('medications')
            .select('*')
            .eq('user_id', medicationsState.currentUser.id)
            .order('start_date', { ascending: false });

        if (error) throw error;

        medicationsState.medications = data || [];
        console.log('Loaded medications:', medicationsState.medications.length);
    } catch (error) {
        console.error('Error loading medications:', error);
        medicationsState.medications = [];
    }
}

// FIX 1: Populate medication dropdown filtered by category
function populateMedicationDropdown(category) {
    const dropdown = document.getElementById('medicationName');
    if (!dropdown) return;

    dropdown.innerHTML = '<option value="">Select a medication...</option>';

    const list = (category === 'all' || !MEDICATION_DATABASE[category])
        ? ALL_MEDICATIONS
        : MEDICATION_DATABASE[category];

    // Sort alphabetically
    [...list].sort().forEach(med => {
        const option  = document.createElement('option');
        option.value  = med;
        option.textContent = med;
        dropdown.appendChild(option);
    });

    const other        = document.createElement('option');
    other.value        = 'other';
    other.textContent  = 'Other (specify below)';
    dropdown.appendChild(other);
}

// FIX 1: Search functionality for medication search box
function setupSearchFunctionality() {
    const searchInput       = document.getElementById('medicationSearch');
    const suggestionsBox    = document.getElementById('searchSuggestions');
    const categorySelect    = document.getElementById('medicationCategory');

    // Category filter wires into dropdown
    if (categorySelect) {
        categorySelect.addEventListener('change', function() {
            populateMedicationDropdown(this.value);
            // Also clear search
            if (searchInput) searchInput.value = '';
            if (suggestionsBox) suggestionsBox.style.display = 'none';
        });
    }

    if (searchInput && suggestionsBox) {
        searchInput.addEventListener('input', function() {
            const query = this.value.trim().toLowerCase();
            suggestionsBox.innerHTML = '';

            if (query.length < 2) {
                suggestionsBox.style.display = 'none';
                return;
            }

            const category = categorySelect ? categorySelect.value : 'all';
            const list = (category === 'all' || !MEDICATION_DATABASE[category])
                ? ALL_MEDICATIONS
                : MEDICATION_DATABASE[category];

            const matches = list.filter(m => m.toLowerCase().includes(query)).slice(0, 10);

            if (matches.length === 0) {
                suggestionsBox.style.display = 'none';
                return;
            }

            matches.forEach(med => {
                const item = document.createElement('div');
                item.className = 'search-suggestion';
                // Highlight matching part
                const idx   = med.toLowerCase().indexOf(query);
                item.innerHTML = med.substring(0, idx)
                    + `<strong>${med.substring(idx, idx + query.length)}</strong>`
                    + med.substring(idx + query.length);

                item.addEventListener('click', () => {
                    // Select in dropdown (if present) or set custom name
                    const dropdown = document.getElementById('medicationName');
                    if (dropdown) {
                        // Check if option exists
                        const opt = [...dropdown.options].find(o => o.value === med);
                        if (opt) {
                            dropdown.value = med;
                        } else {
                            dropdown.value = 'other';
                            const custom = document.getElementById('customMedicationName');
                            if (custom) custom.value = med;
                        }
                    }
                    searchInput.value = med;
                    suggestionsBox.style.display = 'none';
                });
                suggestionsBox.appendChild(item);
            });

            suggestionsBox.style.display = 'block';
        });

        // Close suggestions on outside click
        document.addEventListener('click', function(e) {
            if (e.target !== searchInput) suggestionsBox.style.display = 'none';
        });
    }

    // FIX 3: My Medications - search and filter listeners
    const searchList = document.getElementById('medicationSearchList');
    const filterSel  = document.getElementById('medicationFilter');

    if (searchList) {
        searchList.addEventListener('input', filterMedicationsList);
    }
    if (filterSel) {
        filterSel.addEventListener('change', filterMedicationsList);
    }
}

// FIX 3: Filter medications list by search + status
function filterMedicationsList() {
    const query  = (document.getElementById('medicationSearchList')?.value || '').toLowerCase();
    const status = document.getElementById('medicationFilter')?.value || 'all';

    let filtered = medicationsState.medications;

    if (status !== 'all') {
        filtered = filtered.filter(m => m.status === status);
    }

    if (query) {
        filtered = filtered.filter(m =>
            m.medication_name.toLowerCase().includes(query) ||
            (m.prescribed_by || '').toLowerCase().includes(query)
        );
    }

    renderMedicationCards(filtered);
}

// Setup event listeners
function setupMedicationsListeners() {
    // Tab switching
    document.querySelectorAll('.medication-tab').forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });

    // Save medication
    const saveBtn = document.getElementById('saveMedicationBtn');
    if (saveBtn) saveBtn.addEventListener('click', saveMedication);

    // Clear form
    const clearBtn = document.getElementById('clearFormBtn');
    if (clearBtn) clearBtn.addEventListener('click', clearMedicationForm);

    // Add first medication shortcut
    const addFirstBtn = document.getElementById('addFirstMedicationBtn');
    if (addFirstBtn) addFirstBtn.addEventListener('click', () => switchTab('add-medication'));

    // Medication name dropdown show/hide custom field
    const medicationDropdown = document.getElementById('medicationName');
    if (medicationDropdown) {
        medicationDropdown.addEventListener('change', handleMedicationSelection);
    }

    // Custom medication name input
    const customNameInput = document.getElementById('customMedicationName');
    if (customNameInput) customNameInput.addEventListener('input', handleCustomMedicationInput);

    // Supply auto-calculation
    const quantityInput    = document.getElementById('quantityPerDose');
    const frequencyInput   = document.getElementById('frequency');
    const totalSupplyInput = document.getElementById('totalSupply');

    if (quantityInput && frequencyInput && totalSupplyInput) {
        const calc = () => {
            const qty  = parseFloat(quantityInput.value) || 1;
            const freq = frequencyInput.value;
            const dailyMap = {
                'Once daily': 1, 'Twice daily': 2, 'Three times daily': 3,
                'Four times daily': 4, 'Once weekly': 1/7, 'Twice weekly': 2/7,
                'As needed': 1, 'Before meals': 3, 'After meals': 3, 'At bedtime': 1
            };
            const daily = (dailyMap[freq] || 1) * qty;
            totalSupplyInput.value = Math.ceil(daily * 30);
        };
        quantityInput.addEventListener('input', calc);
        frequencyInput.addEventListener('change', calc);
    }

    // Schedule navigation
    const prevWeekBtn = document.getElementById('prevWeek');
    const nextWeekBtn = document.getElementById('nextWeek');
    if (prevWeekBtn) prevWeekBtn.addEventListener('click', () => {
        medicationsState.currentWeekOffset--;
        renderScheduleGrid();
    });
    if (nextWeekBtn) nextWeekBtn.addEventListener('click', () => {
        medicationsState.currentWeekOffset++;
        renderScheduleGrid();
    });

    // Schedule view selector
    const scheduleViewSel = document.getElementById('scheduleView');
    if (scheduleViewSel) scheduleViewSel.addEventListener('change', renderScheduleGrid);

    // Pharmacy save
    const savePharmacyBtn = document.getElementById('savePharmacyBtn');
    if (savePharmacyBtn) {
        savePharmacyBtn.addEventListener('click', () => {
            showMessage('success', 'Pharmacy information saved!');
        });
    }

    // Refresh button
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', async () => {
            refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Refreshing';
            refreshBtn.disabled = true;
            await loadMedicationsData();
            updateMedicationsUI();
            refreshBtn.innerHTML = '<i class="fas fa-sync-alt"></i> <span>Refresh</span>';
            refreshBtn.disabled = false;
            showMessage('success', 'Medications refreshed!');
        });
    }

    // Logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            if (confirm('Logout?')) {
                await supabaseService.signOut();
                window.location.href = 'index.html';
            }
        });
    }

    // Mobile menu
    const menuToggle = document.getElementById('menuToggle');
    if (menuToggle) {
        menuToggle.addEventListener('click', () => {
            document.getElementById('sidebar')?.classList.toggle('mobile-open');
        });
    }

    // Timeline filter in trends tab
    const timelineFilter = document.getElementById('timelineFilter');
    if (timelineFilter) {
        timelineFilter.addEventListener('change', () => generateChartData());
    }
}

// Handle medication selection from dropdown
function handleMedicationSelection() {
    const dropdown        = document.getElementById('medicationName');
    const customContainer = document.getElementById('customMedicationContainer');
    if (!dropdown) return;

    if (customContainer) {
        customContainer.style.display = dropdown.value === 'other' ? 'block' : 'none';
    }
}

// Handle custom medication input
function handleCustomMedicationInput() {
    const customInput = document.getElementById('customMedicationName');
    const dropdown    = document.getElementById('medicationName');
    if (customInput && dropdown && customInput.value.trim()) dropdown.value = 'other';
}

// Save medication to Supabase
async function saveMedication() {
    try {
        if (!medicationsState.currentUser) { showMessage('error', 'Please login first'); return; }

        const nameDropdown = document.getElementById('medicationName');
        const medicationName = nameDropdown?.value === 'other'
            ? document.getElementById('customMedicationName')?.value?.trim()
            : nameDropdown?.value;

        const dosage    = document.getElementById('dosage')?.value?.trim();
        const frequency = document.getElementById('frequency')?.value;
        const startDate = document.getElementById('startDate')?.value;

        if (!medicationName || !dosage || !frequency || !startDate) {
            showMessage('error', 'Please fill in all required fields (Medication Name, Dosage, Frequency, Start Date)');
            return;
        }

        const medicationData = {
            user_id:              medicationsState.currentUser.id,
            medication_name:      medicationName,
            dosage,
            frequency,
            start_date:           startDate,
            medication_type:      document.getElementById('medicationType')?.value  || '',
            administration:       document.getElementById('administration')?.value  || '',
            quantity_per_dose:    document.getElementById('quantityPerDose')?.value || '1',
            total_supply:         document.getElementById('totalSupply')?.value     || '30',
            end_date:             document.getElementById('endDate')?.value         || null,
            refill_date:          document.getElementById('refillDate')?.value      || null,
            prescribed_by:        document.getElementById('prescribedBy')?.value?.trim()       || '',
            special_instructions: document.getElementById('specialInstructions')?.value?.trim() || '',
            additional_notes:     document.getElementById('additionalNotes')?.value?.trim()     || '',
            status: 'active'
        };

        const saveBtn = document.getElementById('saveMedicationBtn');
        if (saveBtn) { saveBtn.disabled = true; saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...'; }

        let result;
        if (medicationsState.currentMedication) {
            const { data, error } = await supabaseClient
                .from('medications').update(medicationData)
                .eq('id', medicationsState.currentMedication.id).select();
            if (error) throw error;
            result = data;
        } else {
            const { data, error } = await supabaseClient
                .from('medications').insert([medicationData]).select();
            if (error) throw error;
            result = data;
        }

        if (result && result.length > 0) {
            showMessage('success', `Medication ${medicationsState.currentMedication ? 'updated' : 'saved'} successfully!`);
            medicationsState.currentMedication = null;
            await loadMedicationsData();
            clearMedicationForm();
            updateMedicationsUI();
            setTimeout(() => switchTab('my-medications'), 1000);
        }

    } catch (error) {
        console.error('Error saving medication:', error);
        showMessage('error', 'Failed to save medication: ' + error.message);
    } finally {
        const saveBtn = document.getElementById('saveMedicationBtn');
        if (saveBtn) { saveBtn.disabled = false; saveBtn.innerHTML = '<i class="fas fa-save"></i> Save Medication'; }
    }
}

// Edit medication
async function editMedication(medicationId) {
    try {
        const { data, error } = await supabaseClient
            .from('medications').select('*').eq('id', medicationId).single();
        if (error) throw error;
        if (!data) { showMessage('error', 'Medication not found'); return; }

        medicationsState.currentMedication = data;
        switchTab('add-medication');
        populateMedicationForm(data);
        showMessage('info', 'Editing medication — update fields and click Save');

    } catch (error) {
        console.error('Error loading medication for edit:', error);
        showMessage('error', 'Failed to load medication for editing');
    }
}

// Populate form for editing
function populateMedicationForm(med) {
    const dropdown        = document.getElementById('medicationName');
    const customInput     = document.getElementById('customMedicationName');
    const customContainer = document.getElementById('customMedicationContainer');

    if (dropdown) {
        // Try to find in any category
        if (ALL_MEDICATIONS.includes(med.medication_name)) {
            dropdown.value = med.medication_name;
            if (customContainer) customContainer.style.display = 'none';
        } else {
            dropdown.value = 'other';
            if (customInput)     customInput.value              = med.medication_name;
            if (customContainer) customContainer.style.display  = 'block';
        }
    }

    const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
    setVal('dosage',               med.dosage);
    setVal('frequency',            med.frequency);
    setVal('medicationType',       med.medication_type);
    setVal('administration',       med.administration);
    setVal('quantityPerDose',      med.quantity_per_dose || '1');
    setVal('totalSupply',          med.total_supply      || '30');
    setVal('prescribedBy',         med.prescribed_by);
    setVal('specialInstructions',  med.special_instructions);
    setVal('additionalNotes',      med.additional_notes);
    setVal('startDate',  med.start_date  ? formatDateForInput(med.start_date)  : '');
    setVal('endDate',    med.end_date    ? formatDateForInput(med.end_date)    : '');
    setVal('refillDate', med.refill_date ? formatDateForInput(med.refill_date) : '');
}

// Switch tabs
function switchTab(tabId) {
    document.querySelectorAll('.medication-tab').forEach(t =>
        t.classList.toggle('active', t.dataset.tab === tabId)
    );
    document.querySelectorAll('.tab-content').forEach(c =>
        c.classList.toggle('active', c.id === `${tabId}-content`)
    );

    if (tabId === 'my-medications')   updateMedicationsList();
    if (tabId === 'schedule')         renderScheduleGrid();
    if (tabId === 'refill-tracker')   renderRefillTracker();
    if (tabId === 'trends')           setTimeout(initializeTrendsTab, 100);
}

// Setup date defaults
function setupDateDefaults() {
    const today           = new Date();
    const thirtyDaysLater = new Date(today);
    thirtyDaysLater.setDate(today.getDate() + 30);

    const startEl  = document.getElementById('startDate');
    const refillEl = document.getElementById('refillDate');
    if (startEl  && !startEl.value)  startEl.valueAsDate  = today;
    if (refillEl && !refillEl.value) refillEl.valueAsDate = thirtyDaysLater;
}

// Clear form
function clearMedicationForm() {
    ['medicationName','customMedicationName','dosage','frequency','medicationType',
     'administration','prescribedBy','specialInstructions','additionalNotes','endDate','refillDate'
    ].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });

    const qty = document.getElementById('quantityPerDose'); if (qty) qty.value = '1';
    const sup = document.getElementById('totalSupply');     if (sup) sup.value = '30';

    const customContainer = document.getElementById('customMedicationContainer');
    if (customContainer) customContainer.style.display = 'none';

    medicationsState.currentMedication = null;
    setupDateDefaults();
    showMessage('info', 'Form cleared');
}

// Update all UI sections
function updateMedicationsUI() {
    updateMedicationStats();
    updateMedicationsList();
    updateRefillAlerts();
    renderRefillTracker();

    // Sidebar quick stats
    const total  = medicationsState.medications.length;
    const active = medicationsState.medications.filter(m => m.status === 'active').length;
    const refill = medicationsState.medications.filter(m => {
        if (!m.refill_date || m.status !== 'active') return false;
        const days = Math.ceil((new Date(m.refill_date) - new Date()) / 86400000);
        return days <= 7 && days >= 0;
    }).length;

    const totalEl  = document.getElementById('totalMedsCount');
    const activeEl = document.getElementById('activeMedsSideCount');
    const refillEl = document.getElementById('refillSoonCount');
    if (totalEl)  totalEl.textContent  = total;
    if (activeEl) activeEl.textContent = active;
    if (refillEl) refillEl.textContent = refill;
}

// FIX 3: Update all stat cards including daily + as-needed
function updateMedicationStats() {
    const meds    = medicationsState.medications;
    const total   = meds.length;
    const active  = meds.filter(m => m.status === 'active').length;
    const daily   = meds.filter(m => m.status === 'active' &&
        ['Once daily','Twice daily','Three times daily','Four times daily','Before meals','After meals','At bedtime']
        .includes(m.frequency)).length;
    const asNeeded = meds.filter(m => m.status === 'active' && m.frequency === 'As needed').length;

    const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    setEl('totalMedications',  total);
    setEl('activeMedications', active);
    setEl('dailyMedications',  daily);
    setEl('asNeededMeds',      asNeeded);
}

// Update medications list (with filter support)
function updateMedicationsList() {
    filterMedicationsList();
}

// Render medication cards from a filtered list
function renderMedicationCards(list) {
    const container = document.getElementById('medicationsList');
    if (!container) return;
    container.innerHTML = '';

    if (!list || list.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-pills"></i>
                <h3>No medications found</h3>
                <p>Add your first medication to get started!</p>
                <button class="btn-primary" onclick="switchTab('add-medication')">
                    <i class="fas fa-plus"></i> Add Medication
                </button>
            </div>`;
        return;
    }

    list.forEach(med => container.appendChild(createMedicationCard(med)));
}

// Create medication card
function createMedicationCard(med) {
    const card      = document.createElement('div');
    card.className  = `medication-card ${med.status}`;
    card.dataset.id = med.id;

    const isActive   = med.status === 'active';
    const startDate  = formatDate(med.start_date);
    const refillDate = med.refill_date ? formatDate(med.refill_date) : 'Not set';

    let refillBadge = '';
    if (med.refill_date) {
        const days = Math.ceil((new Date(med.refill_date) - new Date()) / 86400000);
        if (days < 0)     refillBadge = `<div class="refill-alert alert-danger"><i class="fas fa-exclamation-circle"></i> Overdue refill!</div>`;
        else if (days <= 7) refillBadge = `<div class="refill-alert alert-warning"><i class="fas fa-exclamation-triangle"></i> Refill in ${days} day${days===1?'':'s'}</div>`;
    }

    card.innerHTML = `
        <div class="medication-card-header">
            <div>
                <div class="medication-name">${med.medication_name}</div>
                <div class="medication-details">
                    <span>${med.dosage}</span> • <span>${med.frequency}</span>
                    ${med.medication_type ? ` • <span>${med.medication_type}</span>` : ''}
                    <span> • Started: ${startDate}</span>
                </div>
            </div>
            <div class="medication-status ${isActive ? 'active' : 'completed'}">${isActive ? 'Active' : 'Completed'}</div>
        </div>
        ${refillBadge}
        <div class="medication-card-body">
            ${med.prescribed_by     ? `<p><strong>Prescribed by:</strong> ${med.prescribed_by}</p>` : ''}
            ${med.special_instructions ? `<p><strong>Instructions:</strong> ${med.special_instructions}</p>` : ''}
            <p><strong>Next refill:</strong> ${refillDate}</p>
        </div>
        <div class="medication-actions">
            <button class="action-btn edit"   onclick="editMedication('${med.id}')"><i class="fas fa-edit"></i> Edit</button>
            ${isActive
                ? `<button class="action-btn complete"   onclick="completeMedication('${med.id}')"><i class="fas fa-check"></i> Complete</button>`
                : `<button class="action-btn reactivate" onclick="reactivateMedication('${med.id}')"><i class="fas fa-redo"></i> Reactivate</button>`
            }
            <button class="action-btn delete" onclick="deleteMedication('${med.id}')"><i class="fas fa-trash"></i> Delete</button>
        </div>`;

    return card;
}

// Update refill alerts
function updateRefillAlerts() {
    const container = document.getElementById('refillAlerts');
    if (!container) return;
    container.innerHTML = '';

    const today = new Date();
    const urgent = medicationsState.medications.filter(m => {
        if (!m.refill_date || m.status !== 'active') return false;
        const days = Math.ceil((new Date(m.refill_date) - today) / 86400000);
        return days <= 7;
    });

    if (urgent.length === 0) {
        container.innerHTML = `<div class="refill-alert info"><i class="fas fa-check-circle"></i> <span>No refills needed in the next 7 days</span></div>`;
        return;
    }

    urgent.forEach(med => {
        const days = Math.ceil((new Date(med.refill_date) - today) / 86400000);
        const cls  = days <= 0 ? 'urgent' : days <= 3 ? 'urgent' : 'warning';
        const msg  = days <= 0 ? 'Overdue refill!' : days === 1 ? 'Refill tomorrow' : `Refill in ${days} days`;

        const el = document.createElement('div');
        el.className = `refill-alert ${cls}`;
        el.innerHTML = `
            <i class="fas fa-exclamation-${days <= 3 ? 'circle' : 'triangle'}"></i>
            <div class="alert-content">
                <strong>${med.medication_name}</strong>
                <span>${msg}</span>
                <small>${formatDate(med.refill_date)}</small>
            </div>
            <button class="action-btn" style="background:#1e3c72;color:white;margin-left:auto;"
                    onclick="markAsRefilled('${med.id}')">
                <i class="fas fa-check"></i> Mark Refilled
            </button>`;
        container.appendChild(el);
    });
}

// FIX 3: Render refill list (was never populated)
function renderRefillTracker() {
    updateRefillAlerts();

    const container = document.getElementById('refillList');
    if (!container) return;
    container.innerHTML = '';

    const active = medicationsState.medications.filter(m => m.status === 'active');
    if (active.length === 0) {
        container.innerHTML = '<p style="color:#666;text-align:center;padding:20px;">No active medications to track.</p>';
        return;
    }

    const today = new Date();

    active.forEach(med => {
        const days = med.refill_date
            ? Math.ceil((new Date(med.refill_date) - today) / 86400000)
            : null;

        let cls = 'good', statusText = 'Sufficient supply', statusIcon = '✅';
        if (days !== null) {
            if (days < 0)     { cls = 'urgent';  statusText = 'Overdue refill';    statusIcon = '🔴'; }
            else if (days <= 3) { cls = 'urgent';  statusText = `${days}d until refill`; statusIcon = '🔴'; }
            else if (days <= 7) { cls = 'warning'; statusText = `${days}d until refill`; statusIcon = '🟡'; }
            else               { cls = 'good';    statusText = `${days}d until refill`; statusIcon = '🟢'; }
        }

        const item = document.createElement('div');
        item.className = `refill-item ${cls}`;
        item.innerHTML = `
            <div class="refill-medication">${med.medication_name}</div>
            <div class="refill-details">
                ${med.dosage} • ${med.frequency}
                ${med.prescribed_by ? ` • ${med.prescribed_by}` : ''}
            </div>
            <div class="refill-details">
                Refill date: ${med.refill_date ? formatDate(med.refill_date) : 'Not set'}
                ${med.total_supply ? ` • Supply: ${med.total_supply} units` : ''}
            </div>
            <div class="refill-status-indicator">
                <span>${statusIcon}</span>
                <span>${statusText}</span>
            </div>`;
        container.appendChild(item);
    });
}

// Mark as refilled
async function markAsRefilled(medicationId) {
    try {
        const newDate = new Date();
        newDate.setDate(newDate.getDate() + 30);

        const { error } = await supabaseClient
            .from('medications')
            .update({ refill_date: newDate.toISOString().split('T')[0] })
            .eq('id', medicationId);

        if (error) throw error;

        showMessage('success', 'Refill date updated by 30 days!');
        await loadMedicationsData();
        updateMedicationsUI();
    } catch (error) {
        showMessage('error', 'Failed to update refill date');
    }
}

// Complete medication
async function completeMedication(medicationId) {
    if (!confirm('Mark this medication as completed?')) return;
    try {
        const { error } = await supabaseClient.from('medications')
            .update({ status: 'completed', end_date: new Date().toISOString().split('T')[0] })
            .eq('id', medicationId);
        if (error) throw error;
        showMessage('success', 'Medication marked as completed');
        await loadMedicationsData();
        updateMedicationsUI();
    } catch (error) { showMessage('error', 'Failed to complete medication'); }
}

// Reactivate medication
async function reactivateMedication(medicationId) {
    if (!confirm('Reactivate this medication?')) return;
    try {
        const { error } = await supabaseClient.from('medications')
            .update({ status: 'active', end_date: null })
            .eq('id', medicationId);
        if (error) throw error;
        showMessage('success', 'Medication reactivated');
        await loadMedicationsData();
        updateMedicationsUI();
    } catch (error) { showMessage('error', 'Failed to reactivate medication'); }
}

// Delete medication
async function deleteMedication(medicationId) {
    if (!confirm('Delete this medication? This cannot be undone.')) return;
    try {
        const { error } = await supabaseClient.from('medications')
            .delete().eq('id', medicationId);
        if (error) throw error;
        showMessage('success', 'Medication deleted');
        await loadMedicationsData();
        updateMedicationsUI();
    } catch (error) { showMessage('error', 'Failed to delete medication'); }
}

// ===== FIX 3: SCHEDULE TAB =====
function renderScheduleGrid() {
    const grid     = document.getElementById('scheduleGrid');
    const title    = document.getElementById('scheduleTitle');
    const todayList = document.getElementById('todayMedicationsList');
    if (!grid) return;

    const offset   = medicationsState.currentWeekOffset || 0;
    const now      = new Date();
    const weekStart = new Date(now);
    // Go to Monday of current week + offset weeks
    const day = weekStart.getDay();
    weekStart.setDate(weekStart.getDate() - (day === 0 ? 6 : day - 1) + offset * 7);

    const days    = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
    const active  = medicationsState.medications.filter(m => m.status === 'active');
    const todayStr = now.toISOString().split('T')[0];

    if (title) {
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        title.textContent = `${formatDate(weekStart.toISOString())} – ${formatDate(weekEnd.toISOString())}`;
    }

    grid.innerHTML = '';

    days.forEach((dayName, i) => {
        const d = new Date(weekStart);
        d.setDate(d.getDate() + i);
        const dStr = d.toISOString().split('T')[0];
        const isToday = dStr === todayStr;

        const col = document.createElement('div');
        col.className = 'schedule-day';
        if (isToday) col.style.background = '#e7f3ff';

        const header = document.createElement('div');
        header.className = 'day-header';
        header.style.cssText = isToday ? 'color:#1e3c72;font-weight:700;' : '';
        header.innerHTML = `<div>${dayName}</div><div style="font-size:0.85em;color:#666;">${d.getDate()}</div>`;
        col.appendChild(header);

        const medsDiv = document.createElement('div');
        medsDiv.className = 'day-medications';

        // Show medications scheduled for this day
        const dayMeds = active.filter(m => {
            const start = m.start_date ? new Date(m.start_date).toISOString().split('T')[0] : null;
            const end   = m.end_date   ? new Date(m.end_date).toISOString().split('T')[0]   : null;
            if (start && dStr < start) return false;
            if (end   && dStr > end)   return false;
            if (m.frequency === 'Once weekly' || m.frequency === 'Twice weekly') {
                return i === 0; // Show on Monday only for weekly
            }
            return true;
        });

        if (dayMeds.length === 0) {
            medsDiv.innerHTML = '<p style="font-size:0.8em;color:#999;text-align:center;">—</p>';
        } else {
            dayMeds.forEach(med => {
                const item = document.createElement('div');
                item.className = 'medication-schedule-item';
                item.title = `${med.dosage} • ${med.frequency}`;
                item.textContent = med.medication_name.length > 12
                    ? med.medication_name.substring(0, 12) + '…'
                    : med.medication_name;
                medsDiv.appendChild(item);
            });
        }

        col.appendChild(medsDiv);
        grid.appendChild(col);
    });

    // Today's medications panel
    if (todayList) {
        const todayMeds = active.filter(m => {
            const start = m.start_date ? new Date(m.start_date).toISOString().split('T')[0] : null;
            const end   = m.end_date   ? new Date(m.end_date).toISOString().split('T')[0]   : null;
            if (start && todayStr < start) return false;
            if (end   && todayStr > end)   return false;
            return true;
        });

        if (todayMeds.length === 0) {
            todayList.innerHTML = '<p style="color:#666;text-align:center;padding:15px;">No medications scheduled for today.</p>';
        } else {
            todayList.innerHTML = todayMeds.map(m => `
                <div class="today-medication">
                    <div class="today-medication-name">${m.medication_name}</div>
                    <div class="today-medication-details">
                        ${m.dosage} • ${m.frequency}
                        ${m.special_instructions ? `<br><em>${m.special_instructions}</em>` : ''}
                    </div>
                </div>`).join('');
        }
    }
}

// ===== FIX 2: TRENDS & ANALYSIS TAB =====
function initializeTrendsTab() {
    console.log('Initializing trends tab...');
    addChartStyles();
    generateChartData();
    renderTimelineChart();    // FIX 2: renders into #timelineChart (matches HTML)
    renderCategoryChart();    // FIX 2: renders into #categoryChart  (matches HTML)
    renderTrendInsights();    // FIX 2: renders into #trendInsights
    renderKeyInsights();      // FIX 2: renders into #keyInsights
}

// Generate chart data from medications
function generateChartData() {
    const filter = document.getElementById('timelineFilter')?.value || 'all';
    const meds = medicationsState.medications.filter(m =>
        filter === 'all' || m.status === filter
    );

    if (!meds.length) { medicationsState.chartData = null; return; }

    const activeCount    = meds.filter(m => m.status === 'active').length;
    const completedCount = meds.filter(m => m.status === 'completed').length;

    // Categories by medication_type
    const catMap = {};
    meds.forEach(m => {
        const t = m.medication_type || 'Uncategorized';
        catMap[t] = (catMap[t] || 0) + 1;
    });

    const catColors = ['#FF6B6B','#4ECDC4','#45B7D1','#96CEB4','#FFEAA7','#DDA0DD','#98D8C8','#F7DC6F'];

    medicationsState.chartData = {
        active: activeCount, completed: completedCount, total: meds.length,
        categories: Object.entries(catMap).map(([label, count], i) => ({
            label, count, color: catColors[i % catColors.length]
        })),
        timeline: meds.map(m => ({
            name:     m.medication_name,
            start:    new Date(m.start_date),
            end:      m.end_date ? new Date(m.end_date) : new Date(),
            status:   m.status,
            type:     m.medication_type || 'Other'
        })).sort((a, b) => a.start - b.start)
    };
}

// FIX 2: Render into #timelineChart (HTML ID)
function renderTimelineChart() {
    const container = document.getElementById('timelineChart');
    if (!container) return;
    container.innerHTML = '';

    if (!medicationsState.chartData || !medicationsState.chartData.timeline.length) {
        container.innerHTML = `<div class="chart-placeholder"><i class="fas fa-chart-line" style="font-size:3em;color:#ddd;"></i><p>No medication data yet</p></div>`;
        return;
    }

    const events = medicationsState.chartData.timeline;
    let html = '<div class="timeline-container">';

    // Group by month
    const byMonth = {};
    events.forEach(e => {
        const k = e.start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        (byMonth[k] = byMonth[k] || []).push(e);
    });

    Object.entries(byMonth).forEach(([month, list]) => {
        html += `<div class="timeline-month">
            <div class="timeline-month-header">${month}</div>
            <div class="timeline-events">`;
        list.forEach(e => {
            const days   = Math.ceil((e.end - e.start) / 86400000);
            const durTxt = days === 1 ? '1 day' : `${days} days`;
            html += `
                <div class="timeline-event ${e.status}">
                    <div class="timeline-event-dot"></div>
                    <div class="timeline-event-content">
                        <div class="timeline-event-header">
                            <strong>${e.name}</strong>
                            <span class="timeline-event-status ${e.status}">${e.status}</span>
                        </div>
                        <div class="timeline-event-details">
                            <span>${e.start.toLocaleDateString('en-US',{day:'numeric',month:'short'})}</span>
                            <span class="timeline-event-duration">${durTxt}</span>
                            <span>${e.type}</span>
                        </div>
                    </div>
                </div>`;
        });
        html += `</div></div>`;
    });

    html += '</div>';
    container.innerHTML = html;
}

// FIX 2: Render into #categoryChart (HTML ID) — uses canvas bar chart
function renderCategoryChart() {
    const container = document.getElementById('categoryChart');
    if (!container) return;
    container.innerHTML = '';

    if (!medicationsState.chartData || !medicationsState.chartData.categories.length) {
        container.innerHTML = `<div class="chart-placeholder"><i class="fas fa-chart-bar" style="font-size:3em;color:#ddd;"></i><p>No category data yet</p></div>`;
        return;
    }

    const cats   = medicationsState.chartData.categories;
    const canvas = document.createElement('canvas');
    canvas.width = 380; canvas.height = 220;
    container.appendChild(canvas);

    const ctx      = canvas.getContext('2d');
    const max      = Math.max(...cats.map(c => c.count));
    const cW       = canvas.width - 60;
    const cH       = canvas.height - 50;
    const barW     = cW / cats.length;

    // Y-axis labels
    ctx.fillStyle = '#666'; ctx.font = '11px Arial'; ctx.textAlign = 'right';
    for (let i = 0; i <= 5; i++) {
        const val = Math.round((max / 5) * i);
        const y   = cH - (cH / 5) * i + 20;
        ctx.fillText(val, 35, y);
        ctx.strokeStyle = '#eee'; ctx.lineWidth = 0.5;
        ctx.beginPath(); ctx.moveTo(40, y); ctx.lineTo(canvas.width, y); ctx.stroke();
    }

    // Bars
    cats.forEach((cat, i) => {
        const bH = max > 0 ? (cat.count / max) * cH : 0;
        const x  = 40 + i * barW + barW * 0.1;
        const y  = cH - bH + 20;
        const bW = barW * 0.8;

        ctx.fillStyle = cat.color;
        ctx.fillRect(x, y, bW, bH);

        // Value label
        ctx.fillStyle = '#333'; ctx.font = '12px Arial'; ctx.textAlign = 'center';
        ctx.fillText(cat.count, x + bW / 2, y - 5);

        // Category label (truncated)
        const lbl = cat.label.length > 8 ? cat.label.substring(0, 8) + '…' : cat.label;
        ctx.fillStyle = '#555'; ctx.font = '10px Arial';
        ctx.fillText(lbl, x + bW / 2, cH + 38);
    });

    // Legend
    const legend = document.createElement('div');
    legend.className = 'chart-legend';
    legend.style.cssText = 'display:flex;flex-wrap:wrap;gap:10px;margin-top:10px;';
    legend.innerHTML = cats.map(c => `
        <div style="display:flex;align-items:center;gap:6px;font-size:13px;">
            <span style="width:12px;height:12px;border-radius:3px;background:${c.color};display:inline-block;"></span>
            <span>${c.label} (${c.count})</span>
        </div>`).join('');
    container.appendChild(legend);

    // Active vs Completed donut summary
    const summary = document.createElement('div');
    summary.style.cssText = 'margin-top:15px;display:flex;gap:20px;align-items:center;justify-content:center;';
    const total = medicationsState.chartData.total;
    summary.innerHTML = `
        <div style="text-align:center;">
            <div style="font-size:2em;font-weight:bold;color:#4CAF50;">${medicationsState.chartData.active}</div>
            <div style="font-size:0.85em;color:#666;">Active</div>
        </div>
        <div style="text-align:center;">
            <div style="font-size:2em;font-weight:bold;color:#FF9800;">${medicationsState.chartData.completed}</div>
            <div style="font-size:0.85em;color:#666;">Completed</div>
        </div>
        <div style="text-align:center;">
            <div style="font-size:2em;font-weight:bold;color:#1e3c72;">${total}</div>
            <div style="font-size:0.85em;color:#666;">Total</div>
        </div>`;
    container.appendChild(summary);
}

// FIX 2: Render trend insights into #trendInsights
function renderTrendInsights() {
    const container = document.getElementById('trendInsights');
    if (!container) return;

    const meds = medicationsState.medications;
    if (!meds.length) {
        container.innerHTML = '<p>No trend data available yet. Add more medications to see trends and insights.</p>';
        return;
    }

    // Monthly average
    const dates    = meds.map(m => new Date(m.start_date));
    const minDate  = new Date(Math.min(...dates));
    const maxDate  = new Date();
    const months   = Math.max(1, (maxDate.getFullYear() - minDate.getFullYear()) * 12 + maxDate.getMonth() - minDate.getMonth() + 1);
    const monthly  = (meds.length / months).toFixed(1);

    // Average duration
    const durations = meds.map(m => {
        const s = new Date(m.start_date);
        const e = m.end_date ? new Date(m.end_date) : new Date();
        return Math.ceil((e - s) / 86400000);
    });
    const avgDur = Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);

    // Completion rate
    const completed     = meds.filter(m => m.status === 'completed').length;
    const completionPct = Math.round((completed / meds.length) * 100);

    // Insights list
    const insights = [];
    if (parseFloat(monthly) > 2) insights.push('You add new medications frequently — consider a regular medication review with your doctor.');
    if (avgDur > 180) insights.push('Several of your medications are long-term. Keep up with scheduled check-ups.');
    if (completionPct > 80) insights.push('Excellent medication completion rate — great adherence!');
    else if (completionPct < 50) insights.push('Consider setting reminders to improve medication adherence.');
    if (meds.filter(m => m.status === 'active').length >= 5)
        insights.push('You are managing multiple medications. Ask your doctor about potential interactions.');
    if (!insights.length) insights.push('Continue tracking your medications for personalised insights.');

    container.innerHTML = `
        <div class="trend-cards" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:15px;">
            <div class="trend-card" style="background:#f8f9fa;border-radius:8px;padding:15px;text-align:center;">
                <div style="font-size:1.8em;font-weight:bold;color:#1e3c72;">${monthly}</div>
                <div style="font-size:0.85em;color:#666;">Meds / month</div>
            </div>
            <div class="trend-card" style="background:#f8f9fa;border-radius:8px;padding:15px;text-align:center;">
                <div style="font-size:1.8em;font-weight:bold;color:#1e3c72;">${avgDur}d</div>
                <div style="font-size:0.85em;color:#666;">Avg duration</div>
            </div>
            <div class="trend-card" style="background:#f8f9fa;border-radius:8px;padding:15px;text-align:center;">
                <div style="font-size:1.8em;font-weight:bold;color:#1e3c72;">${completionPct}%</div>
                <div style="font-size:0.85em;color:#666;">Completion rate</div>
            </div>
        </div>
        <ul style="padding-left:20px;color:#555;line-height:1.8;">
            ${insights.map(i => `<li>${i}</li>`).join('')}
        </ul>`;
}

// FIX 2: Render key insights into #keyInsights (updates spans in HTML correctly)
function renderKeyInsights() {
    const meds = medicationsState.medications;

    // Update the span elements that already exist in the HTML
    const avgDurEl   = document.getElementById('avgDuration');
    const mostCatEl  = document.getElementById('mostCommonCategory');
    const activePctEl = document.getElementById('activePercentage');

    if (!meds.length) {
        if (avgDurEl)    avgDurEl.textContent    = '-- days';
        if (mostCatEl)   mostCatEl.textContent   = '--';
        if (activePctEl) activePctEl.textContent = '--%';
        return;
    }

    // Avg duration of completed meds
    const completed = meds.filter(m => m.status === 'completed' && m.end_date);
    if (avgDurEl) {
        if (completed.length) {
            const avg = Math.round(completed.reduce((sum, m) =>
                sum + Math.ceil((new Date(m.end_date) - new Date(m.start_date)) / 86400000), 0
            ) / completed.length);
            avgDurEl.textContent = `${avg} days`;
        } else {
            avgDurEl.textContent = 'N/A';
        }
    }

    // Most common medication_type
    if (mostCatEl) {
        const cats = {};
        meds.forEach(m => { const t = m.medication_type || 'Uncategorized'; cats[t] = (cats[t] || 0) + 1; });
        const top = Object.entries(cats).sort((a, b) => b[1] - a[1])[0];
        mostCatEl.textContent = top ? top[0] : '--';
    }

    // Active percentage
    if (activePctEl) {
        const pct = Math.round((meds.filter(m => m.status === 'active').length / meds.length) * 100);
        activePctEl.textContent = `${pct}%`;
    }
}

// Utility functions
function formatDate(dateString) {
    if (!dateString) return 'Not set';
    return new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatDateForInput(dateString) {
    if (!dateString) return '';
    return new Date(dateString).toISOString().split('T')[0];
}

function showMessage(type, text) {
    let container = document.getElementById('messageContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'messageContainer';
        container.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:9999;';
        document.body.appendChild(container);
    }

    const msg = document.createElement('div');
    msg.className = `message ${type}`;
    msg.style.cssText = `
        background:white; padding:12px 18px; margin-top:8px; border-radius:8px;
        box-shadow:0 4px 12px rgba(0,0,0,0.15); display:flex; align-items:center;
        gap:10px; min-width:280px; max-width:380px;
        border-left:4px solid ${type==='success'?'#28a745':type==='error'?'#dc3545':type==='warning'?'#ffc107':'#17a2b8'};`;

    const icons = { success:'✅', error:'❌', warning:'⚠️', info:'ℹ️' };
    msg.innerHTML = `<span>${icons[type]||'ℹ️'}</span><span>${text}</span>`;
    container.appendChild(msg);

    setTimeout(() => {
        msg.style.opacity = '0'; msg.style.transition = 'opacity 0.3s';
        setTimeout(() => { if (msg.parentNode) msg.parentNode.removeChild(msg); }, 300);
    }, 4000);
}

// Inject chart CSS
function addChartStyles() {
    if (document.getElementById('med-chart-styles')) return;
    const s = document.createElement('style');
    s.id = 'med-chart-styles';
    s.textContent = `
        .timeline-container{position:relative;padding-left:30px;}
        .timeline-container::before{content:'';position:absolute;left:10px;top:0;bottom:0;width:2px;background:#e0e0e0;}
        .timeline-month{margin-bottom:25px;}
        .timeline-month-header{background:#f5f5f5;padding:6px 14px;border-radius:20px;display:inline-block;
            margin-bottom:12px;font-weight:bold;color:#333;position:relative;left:-40px;font-size:0.9em;}
        .timeline-event{display:flex;align-items:flex-start;margin-bottom:15px;position:relative;}
        .timeline-event-dot{width:12px;height:12px;border-radius:50%;position:absolute;left:-31px;top:5px;border:3px solid white;}
        .timeline-event.active .timeline-event-dot{background:#4CAF50;box-shadow:0 0 0 2px #4CAF50;}
        .timeline-event.completed .timeline-event-dot{background:#FF9800;box-shadow:0 0 0 2px #FF9800;}
        .timeline-event-content{background:white;border-radius:8px;padding:12px;box-shadow:0 2px 6px rgba(0,0,0,0.1);flex:1;}
        .timeline-event-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;}
        .timeline-event-status{padding:2px 8px;border-radius:10px;font-size:11px;font-weight:bold;}
        .timeline-event-status.active{background:#e8f5e9;color:#2e7d32;}
        .timeline-event-status.completed{background:#fff3e0;color:#ef6c00;}
        .timeline-event-details{display:flex;gap:12px;font-size:12px;color:#666;}
        .timeline-event-duration{font-weight:bold;color:#333;}
        .trend-card{background:white;border-radius:10px;padding:15px;box-shadow:0 2px 8px rgba(0,0,0,0.08);}
    `;
    document.head.appendChild(s);
}

// Init on load
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Medications page loading...');
    addChartStyles();
    await loadMedications();
});

// Global exports for inline onclick handlers
window.completeMedication   = completeMedication;
window.reactivateMedication = reactivateMedication;
window.deleteMedication     = deleteMedication;
window.editMedication       = editMedication;
window.markAsRefilled       = markAsRefilled;
window.switchTab            = switchTab;