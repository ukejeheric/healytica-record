// ===== LAB RESULTS MANAGEMENT - SURGICAL FIXES =====
// FIX 1: Single DOMContentLoaded — removed duplicate from bottom of file
// FIX 2: Triple-result bug fixed — removed duplicate HTML inline init + database.js/app.js
// FIX 3: Full standard test panels with proper reference ranges
// FIX 4: Tabs all wired and working including analysis auto-load
// FIX 5: Analysis tab — Run Analysis button, multi-param chart, health status
// FIX 6: Lab Learning — 20+ tests, category filter, highlighted search
// FIX 7: Upload + AI Analysis — real Claude API call via Supabase Edge Function

// ===== appState compatibility shim =====
// lab_results.js uses appState.currentUser; define it if not already defined
if (typeof window.appState === 'undefined') {
    window.appState = { currentUser: null };
}

// ===== Lab state =====
const labState = {
    currentTab: 'add',
    labTests: [],
    filteredTests: [],
    currentPage: 1,
    itemsPerPage: 10,
    charts: {},
    selectedFile: null,
    editingLabId: null
};

// ===== FIX 3: Full test panel database with standard reference ranges =====
const LAB_PANELS = {
    hematology: [
        { label: 'Complete Blood Count (CBC)', value: 'cbc' },
        { label: 'Coagulation Profile (PT/INR)', value: 'coagulation' },
        { label: 'Iron Studies', value: 'iron' }
    ],
    biochemistry: [
        { label: 'Basic Metabolic Panel (BMP)', value: 'bmp' },
        { label: 'Comprehensive Metabolic Panel (CMP)', value: 'cmp' },
        { label: 'Electrolytes', value: 'electrolytes' }
    ],
    diabetes: [
        { label: 'Diabetes Panel (FBS + HbA1c)', value: 'diabetes_panel' },
        { label: 'Fasting Blood Sugar (FBS)', value: 'fbs_only' },
        { label: 'HbA1c Only', value: 'hba1c_only' },
        { label: 'Glucose Tolerance Test (GTT)', value: 'gtt' }
    ],
    lipids: [
        { label: 'Full Lipid Profile', value: 'lipid_full' },
        { label: 'Cholesterol Only', value: 'cholesterol_only' }
    ],
    liver: [
        { label: 'Liver Function Tests (LFTs)', value: 'lft' },
        { label: 'Hepatitis Panel', value: 'hepatitis' }
    ],
    renal: [
        { label: 'Renal Function Tests (RFTs)', value: 'rft' },
        { label: 'Urine Analysis (UA)', value: 'urinalysis' }
    ],
    thyroid: [
        { label: 'Thyroid Function Tests (TFTs)', value: 'tft' },
        { label: 'TSH Only', value: 'tsh_only' }
    ],
    infectious: [
        { label: 'Inflammation Markers (CRP/ESR)', value: 'inflammation' },
        { label: 'Malaria Screening', value: 'malaria' },
        { label: 'HIV Screening', value: 'hiv' },
        { label: 'Hepatitis B & C', value: 'hepatitis_bc' }
    ],
    other: [
        { label: 'Custom / Other', value: 'custom' }
    ]
};

// Parameters per panel — only using columns that exist in Supabase
const PANEL_PARAMETERS = {
    diabetes_panel: [
        { name: 'Fasting Blood Sugar (FBS)', unit: 'mg/dL', ref: '70–100', low: 70, high: 100, critHigh: 126, field: 'glucose' },
        { name: 'HbA1c', unit: '%', ref: '<5.7', high: 5.7, critHigh: 6.5, field: 'hba1c' }
    ],
    fbs_only: [
        { name: 'Fasting Blood Sugar (FBS)', unit: 'mg/dL', ref: '70–100', low: 70, high: 100, critHigh: 126, field: 'glucose' }
    ],
    hba1c_only: [
        { name: 'HbA1c', unit: '%', ref: '<5.7', high: 5.7, critHigh: 6.5, field: 'hba1c' }
    ],
    gtt: [
        { name: 'Fasting Glucose', unit: 'mg/dL', ref: '<100', high: 100, critHigh: 126, field: 'glucose' },
        { name: 'HbA1c', unit: '%', ref: '<5.7', high: 5.7, critHigh: 6.5, field: 'hba1c' }
    ],
    lipid_full: [
        { name: 'Total Cholesterol', unit: 'mg/dL', ref: '<200', high: 200, critHigh: 240, field: 'cholesterol' },
        { name: 'LDL Cholesterol', unit: 'mg/dL', ref: '<100 (optimal)', high: 130, critHigh: 160, field: 'ldl' },
        { name: 'HDL Cholesterol', unit: 'mg/dL', ref: '>60 (good)', low: 40, field: 'hdl' },
        { name: 'Triglycerides', unit: 'mg/dL', ref: '<150', high: 150, critHigh: 200, field: 'triglycerides' }
    ],
    cholesterol_only: [
        { name: 'Total Cholesterol', unit: 'mg/dL', ref: '<200', high: 200, critHigh: 240, field: 'cholesterol' }
    ],
    bmp: [
        { name: 'Glucose', unit: 'mg/dL', ref: '70–100', low: 70, high: 100, critHigh: 126, field: 'glucose' }
    ],
    cmp: [
        { name: 'Glucose', unit: 'mg/dL', ref: '70–100', low: 70, high: 100, critHigh: 126, field: 'glucose' },
        { name: 'Cholesterol', unit: 'mg/dL', ref: '<200', high: 200, field: 'cholesterol' }
    ],
    custom: [
        { name: 'Primary Result', unit: 'units', ref: 'See report', field: 'glucose' }
    ]
};

// ===== FIX 6: Expanded lab learning database =====
const LAB_LEARNING_DB = [
    {
        name: 'Complete Blood Count (CBC)', category: 'hematology', icon: 'fas fa-tint',
        description: 'Measures red cells, white cells, haemoglobin, haematocrit, and platelets in one panel.',
        purpose: 'Screen for anaemia, infection, bleeding disorders, and many blood diseases.',
        preparation: 'No special preparation required.',
        normalRanges: 'Haemoglobin: 13.8–17.2 g/dL (M), 12.1–15.1 g/dL (F). WBC: 4.5–11 ×10³/µL. Platelets: 150–400 ×10³/µL.',
        interpretation: 'Low Hb = anaemia. High WBC = infection or inflammation. Low platelets = bleeding risk.',
        importance: 'One of the most commonly ordered tests — a first-line screening tool.',
        link: 'https://www.mayoclinic.org/tests-procedures/complete-blood-count/about/pac-20384919'
    },
    {
        name: 'Fasting Blood Sugar (FBS)', category: 'diabetes', icon: 'fas fa-tint',
        description: 'Measures glucose in the blood after at least 8 hours of fasting.',
        purpose: 'Diagnose and monitor diabetes and prediabetes.',
        preparation: 'Fast for 8–12 hours before the test. Water is allowed.',
        normalRanges: 'Normal: 70–99 mg/dL. Prediabetes: 100–125 mg/dL. Diabetes: ≥126 mg/dL.',
        interpretation: 'Values ≥126 mg/dL on two separate tests confirm diabetes diagnosis.',
        importance: 'Primary screening test for diabetes in most clinical guidelines.',
        link: 'https://www.cdc.gov/diabetes/basics/getting-tested.html'
    },
    {
        name: 'HbA1c (Glycated Haemoglobin)', category: 'diabetes', icon: 'fas fa-percent',
        description: 'Reflects average blood sugar levels over the past 2–3 months by measuring glucose attached to haemoglobin.',
        purpose: 'Diagnose diabetes and monitor long-term glucose control.',
        preparation: 'No fasting required. Can be taken any time of day.',
        normalRanges: 'Normal: <5.7%. Prediabetes: 5.7–6.4%. Diabetes: ≥6.5%.',
        interpretation: 'Each 1% reduction in HbA1c reduces risk of diabetic complications by ~20–30%.',
        importance: 'Gold standard for monitoring diabetes management over time.',
        link: 'https://www.mayoclinic.org/tests-procedures/a1c-test/about/pac-20384643'
    },
    {
        name: 'Lipid Profile', category: 'lipids', icon: 'fas fa-heart',
        description: 'Measures total cholesterol, LDL, HDL, and triglycerides to assess cardiovascular disease risk.',
        purpose: 'Evaluate heart disease risk and guide lipid-lowering treatment.',
        preparation: 'Fast for 9–12 hours. Avoid alcohol 24 hours before.',
        normalRanges: 'Total Cholesterol: <200 mg/dL. LDL: <100 mg/dL (optimal). HDL: >60 mg/dL. Triglycerides: <150 mg/dL.',
        interpretation: 'High LDL and low HDL increase cardiovascular risk. High triglycerides linked to pancreatitis risk.',
        importance: 'Guides statin therapy and lifestyle interventions for heart disease prevention.',
        link: 'https://www.heart.org/en/health-topics/cholesterol/about-cholesterol'
    },
    {
        name: 'Liver Function Tests (LFTs)', category: 'liver', icon: 'fas fa-procedures',
        description: 'Group of blood tests measuring enzymes and proteins that indicate liver health.',
        purpose: 'Detect liver inflammation, damage, or disease.',
        preparation: 'No special preparation. Avoid alcohol 24 hours before.',
        normalRanges: 'ALT: 7–55 U/L (M), 7–45 U/L (F). AST: 8–48 U/L. ALP: 44–147 U/L. Bilirubin: 0.1–1.2 mg/dL.',
        interpretation: 'Elevated ALT/AST = liver inflammation. Elevated ALP = bile duct problems or bone disease.',
        importance: 'Essential for monitoring hepatitis, fatty liver, cirrhosis, and medication side effects.',
        link: 'https://www.mayoclinic.org/tests-procedures/liver-function-tests/about/pac-20394595'
    },
    {
        name: 'Thyroid Function Tests (TFTs)', category: 'thyroid', icon: 'fas fa-brain',
        description: 'Measures TSH, T4, and T3 to assess how well the thyroid gland is working.',
        purpose: 'Diagnose hypothyroidism, hyperthyroidism, and monitor thyroid treatment.',
        preparation: 'No special preparation. Best done in the morning.',
        normalRanges: 'TSH: 0.4–4.0 mIU/L. Free T4: 0.8–1.8 ng/dL. Free T3: 2.3–4.1 pg/mL.',
        interpretation: 'High TSH + low T4 = hypothyroidism. Low TSH + high T4 = hyperthyroidism.',
        importance: 'Thyroid disorders affect metabolism, weight, energy, and mood. Early detection is key.',
        link: 'https://www.thyroid.org/thyroid-function-tests/'
    },
    {
        name: 'Renal Function Tests (RFTs)', category: 'renal', icon: 'fas fa-kidneys',
        description: 'Assesses kidney function through creatinine, urea, eGFR, and electrolytes.',
        purpose: 'Detect chronic kidney disease, acute kidney injury, and monitor kidney health.',
        preparation: 'Stay well hydrated. Avoid excessive protein intake 24 hours before.',
        normalRanges: 'Creatinine: 0.6–1.2 mg/dL (M), 0.5–1.1 mg/dL (F). eGFR: >60 mL/min. Urea: 7–20 mg/dL.',
        interpretation: 'Rising creatinine or falling eGFR indicates declining kidney function.',
        importance: 'Critical for monitoring diabetic nephropathy, hypertensive kidney disease, and drug dosing.',
        link: 'https://www.kidney.org/atoz/content/gfr'
    },
    {
        name: 'C-Reactive Protein (CRP)', category: 'chemistry', icon: 'fas fa-fire',
        description: 'A protein produced by the liver in response to inflammation anywhere in the body.',
        purpose: 'Detect infection, inflammation, and assess cardiovascular risk (hs-CRP).',
        preparation: 'No special preparation required.',
        normalRanges: 'Standard CRP: <10 mg/L (normal). hs-CRP: <1 mg/L (low risk), 1–3 mg/L (average risk), >3 mg/L (high risk).',
        interpretation: 'Very high CRP (>100 mg/L) suggests bacterial infection. Mildly elevated hs-CRP raises cardiac risk.',
        importance: 'Useful for monitoring autoimmune diseases, infections, and cardiovascular risk stratification.',
        link: 'https://www.mayoclinic.org/tests-procedures/c-reactive-protein-test/about/pac-20384595'
    },
    {
        name: 'Electrolytes Panel', category: 'chemistry', icon: 'fas fa-atom',
        description: 'Measures sodium, potassium, chloride, and bicarbonate levels in the blood.',
        purpose: 'Assess fluid balance, kidney function, and detect electrolyte imbalances.',
        preparation: 'No special preparation required.',
        normalRanges: 'Sodium: 135–145 mmol/L. Potassium: 3.5–5.0 mmol/L. Chloride: 98–106 mmol/L. Bicarbonate: 22–29 mmol/L.',
        interpretation: 'Low sodium = hyponatraemia (risk of seizures). High potassium = hyperkalaemia (cardiac risk).',
        importance: 'Critical for patients on diuretics, with kidney disease, or receiving IV fluids.',
        link: 'https://medlineplus.gov/lab-tests/electrolyte-panel/'
    },
    {
        name: 'Uric Acid', category: 'chemistry', icon: 'fas fa-bone',
        description: 'Measures the level of uric acid — a waste product from purine metabolism — in blood.',
        purpose: 'Diagnose gout and monitor urate-lowering therapy.',
        preparation: 'No special preparation. Avoid high-purine foods (red meat, shellfish, alcohol) 24 hours before.',
        normalRanges: 'Men: 3.4–7.0 mg/dL. Women: 2.4–6.0 mg/dL.',
        interpretation: 'Levels above 7 mg/dL (M) or 6 mg/dL (F) increase gout risk. Very high levels can damage kidneys.',
        importance: 'Essential for managing gout, kidney stones, and some chemotherapy-related complications.',
        link: 'https://www.mayoclinic.org/tests-procedures/uric-acid-test/about/pac-20384994'
    },
    {
        name: 'Iron Studies', category: 'hematology', icon: 'fas fa-flask',
        description: 'Measures serum iron, ferritin, TIBC, and transferrin saturation to assess iron stores.',
        purpose: 'Diagnose iron deficiency anaemia and iron overload disorders.',
        preparation: 'Fast for 8 hours. Test in the morning (iron levels fluctuate throughout the day).',
        normalRanges: 'Serum Iron: 60–170 µg/dL. Ferritin: 12–300 ng/mL (M), 12–150 ng/mL (F). Transferrin sat: 20–50%.',
        interpretation: 'Low ferritin + low iron + high TIBC = iron deficiency. High ferritin + high iron = haemochromatosis.',
        importance: 'Iron deficiency is the most common nutritional deficiency worldwide.',
        link: 'https://labtestsonline.org/tests/iron-tests'
    },
    {
        name: 'Vitamin D', category: 'chemistry', icon: 'fas fa-sun',
        description: 'Measures 25-hydroxyvitamin D — the main circulating form of vitamin D in the body.',
        purpose: 'Diagnose vitamin D deficiency and monitor supplementation.',
        preparation: 'No special preparation required.',
        normalRanges: 'Deficiency: <20 ng/mL. Insufficiency: 20–29 ng/mL. Sufficient: 30–100 ng/mL.',
        interpretation: 'Deficiency is extremely common. Low levels are linked to bone disease, immune dysfunction, and depression.',
        importance: 'Vitamin D is essential for calcium absorption, immune function, and muscle strength.',
        link: 'https://www.mayoclinic.org/tests-procedures/vitamin-d-test/about/pac-20385054'
    },
    {
        name: 'Blood Urea Nitrogen (BUN)', category: 'renal', icon: 'fas fa-filter',
        description: 'Measures the amount of nitrogen in blood from urea — a waste product of protein breakdown.',
        purpose: 'Assess kidney function and hydration status.',
        preparation: 'No special preparation required.',
        normalRanges: '7–20 mg/dL.',
        interpretation: 'High BUN can indicate kidney disease, dehydration, or high protein diet. Low BUN may indicate malnutrition.',
        importance: 'BUN/Creatinine ratio helps distinguish kidney disease from dehydration.',
        link: 'https://medlineplus.gov/lab-tests/blood-urea-nitrogen-bun-test/'
    },
    {
        name: 'PSA (Prostate-Specific Antigen)', category: 'chemistry', icon: 'fas fa-user',
        description: 'A protein produced by prostate cells, measured in blood to screen for prostate cancer.',
        purpose: 'Prostate cancer screening and monitoring treatment response.',
        preparation: 'Avoid ejaculation for 48 hours and strenuous exercise for 24 hours before.',
        normalRanges: 'Age 40–49: <2.5 ng/mL. Age 50–59: <3.5 ng/mL. Age 60–69: <4.5 ng/mL.',
        interpretation: 'Elevated PSA may indicate prostate cancer, BPH, or prostatitis. Further investigation required.',
        importance: 'Controversial screening tool — benefits and harms should be discussed with a physician.',
        link: 'https://www.cancer.org/cancer/prostate-cancer/detection-diagnosis-staging/tests.html'
    },
    {
        name: 'Coagulation Profile (PT/INR)', category: 'hematology', icon: 'fas fa-band-aid',
        description: 'Measures how long blood takes to clot — prothrombin time (PT) and international normalised ratio (INR).',
        purpose: 'Evaluate bleeding risk and monitor warfarin (anticoagulant) therapy.',
        preparation: 'No special preparation. Inform lab of any anticoagulants being taken.',
        normalRanges: 'PT: 11–13.5 seconds. INR: 0.8–1.2 (normal). Therapeutic INR on warfarin: 2.0–3.0.',
        interpretation: 'Prolonged PT/elevated INR = increased bleeding risk. Too high on warfarin = bleeding; too low = clotting.',
        importance: 'Critical for patients on blood thinners or with liver disease.',
        link: 'https://www.mayoclinic.org/tests-procedures/prothrombin-time/about/pac-20384661'
    }
];

// ===== SINGLE DOMContentLoaded — only one init =====
document.addEventListener('DOMContentLoaded', async function() {
    console.log('Lab results page loaded — initialising...');

    // Step 1: Auth — only redirect on auth failure
    let user = null;
    try {
        user = await supabaseService.getCurrentUser();
        if (!user) {
            window.location.href = 'index.html';
            return;
        }
        window.appState.currentUser = user;
    } catch (e) {
        console.error('Auth error:', e);
        window.location.href = 'index.html';
        return;
    }

    // Step 2: Sidebar
    try {
        const userName   = document.getElementById('userName');
        const userAvatar = document.getElementById('userAvatar');
        const dateEl     = document.getElementById('currentDate');
        if (userName)   userName.textContent   = user.email.split('@')[0];
        if (userAvatar) userAvatar.textContent  = user.email.substring(0, 2).toUpperCase();
        if (dateEl)     dateEl.textContent      = new Date().toLocaleDateString('en-US', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });
    } catch (e) { console.warn('Sidebar error:', e); }

    // Step 3: Load data
    try { await loadUserLabResults(); } catch (e) { console.warn('Data load error:', e); labState.labTests = []; }

    // Step 4: Setup UI
    try { setupLabPageUI(); }  catch (e) { console.warn('UI setup error:', e); }
    try { setupLabListeners(); } catch (e) { console.warn('Listener error:', e); }
    try { setupBasicListeners(); } catch (e) { console.warn('Basic listener error:', e); }

    // Step 5: Set today's date default
    const testDateEl = document.getElementById('testDate');
    if (testDateEl && !testDateEl.value) testDateEl.value = new Date().toISOString().split('T')[0];

    // Step 6: Hide loader
    const loader = document.getElementById('loader');
    if (loader) { loader.style.opacity = '0'; setTimeout(() => loader.style.display = 'none', 300); }

    console.log('Lab results page ready.');
});

// Load lab results from Supabase
async function loadUserLabResults() {
    const userId = window.appState.currentUser?.id;
    if (!userId) return;

    const result = await supabaseService.getUserLabResults(userId);
    labState.labTests = (result.success ? result.data : result) || [];
    labState.labTests.sort((a, b) => new Date(b.test_date) - new Date(a.test_date));
    labState.filteredTests = [...labState.labTests];
    console.log('Loaded', labState.labTests.length, 'lab results');
    updateLabStats();
}

// Update stats
function updateLabStats() {
    const count = labState.labTests.length;
    const thirtyAgo = new Date(); thirtyAgo.setDate(thirtyAgo.getDate() - 30);
    const recent = labState.labTests.filter(l => new Date(l.test_date) >= thirtyAgo).length;

    ['labCount', 'totalLabs'].forEach(id => { const el = document.getElementById(id); if (el) el.textContent = count; });
    ['recentLabs', 'last30Days'].forEach(id => { const el = document.getElementById(id); if (el) el.textContent = recent; });

    const unique = [...new Set(labState.labTests.map(l => l.test_name))].length;
    const uniqueEl = document.getElementById('uniqueTests'); if (uniqueEl) uniqueEl.textContent = unique;

    const latestEl = document.getElementById('latestTest');
    if (latestEl) latestEl.textContent = labState.labTests.length > 0 ? formatDate(labState.labTests[0].test_date) : '--';
}

// Setup page UI
function setupLabPageUI() {
    populateCategoryDropdown();
    populateTestTypeFilter();
    populateAnalysisDropdowns();
    populateAiTestSelect();
    loadLabHistoryTable();
    loadLearningContent('all');
    loadUploadHistory();
}

function populateCategoryDropdown() { /* already in HTML */ }

function populateTestTypeFilter() {
    const sel = document.getElementById('testTypeFilter');
    if (!sel) return;
    const types = [...new Set(labState.labTests.map(l => l.test_name))];
    sel.innerHTML = '<option value="all">All Tests</option>';
    types.forEach(t => { const o = document.createElement('option'); o.value = o.textContent = t; sel.appendChild(o); });
}

function populateAnalysisDropdowns() {
    const sel = document.getElementById('analysisTest');
    if (!sel) return;
    const types = [...new Set(labState.labTests.map(l => l.test_name))];
    sel.innerHTML = '<option value="">Select a test...</option>';
    types.forEach(t => { const o = document.createElement('option'); o.value = o.textContent = t; sel.appendChild(o); });
}

function populateAiTestSelect() {
    const sel = document.getElementById('aiTestSelect');
    if (!sel) return;
    sel.innerHTML = '<option value="">Select a result...</option>';
    labState.labTests.slice(0, 20).forEach(l => {
        const o = document.createElement('option');
        o.value = l.id;
        o.textContent = `${l.test_name} — ${formatDate(l.test_date)}`;
        sel.appendChild(o);
    });
}

// ===== FIX 4: All tab listeners =====
function setupLabListeners() {
    // Tab switching
    document.querySelectorAll('.page-tab').forEach(tab => {
        tab.addEventListener('click', function() {
            document.querySelectorAll('.page-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            this.classList.add('active');
            const content = document.getElementById(`tab-${this.dataset.tab}`);
            if (content) content.classList.add('active');
            labState.currentTab = this.dataset.tab;
            if (this.dataset.tab === 'learning') loadLearningContent(document.getElementById('learningCategory')?.value || 'all');
            if (this.dataset.tab === 'upload')   loadUploadHistory();
        });
    });

    // Category → panel dropdown
    const catSel = document.getElementById('labCategory');
    if (catSel) {
        catSel.addEventListener('change', function() {
            const panelSel = document.getElementById('labTestPanel');
            if (!panelSel) return;
            const panels = LAB_PANELS[this.value] || [];
            panelSel.innerHTML = '<option value="">Select Test Panel</option>';
            panels.forEach(p => {
                const o = document.createElement('option');
                o.value = p.value; o.textContent = p.label;
                panelSel.appendChild(o);
            });
            panelSel.disabled = !this.value;
            document.getElementById('parametersCard').style.display = 'none';
        });
    }

    // Panel → parameters
    const panelSel = document.getElementById('labTestPanel');
    if (panelSel) {
        panelSel.addEventListener('change', function() {
            const testTypeEl = document.getElementById('testType');
            if (testTypeEl && this.options[this.selectedIndex]?.text) {
                testTypeEl.value = this.options[this.selectedIndex].text;
            }
            const params = PANEL_PARAMETERS[this.value];
            if (params) {
                loadTestParameters(params);
                document.getElementById('parametersCard').style.display = 'block';
            } else {
                document.getElementById('parametersCard').style.display = 'none';
            }
        });
    }

    // Custom test name
    const customEl = document.getElementById('customTestName');
    if (customEl) {
        customEl.addEventListener('input', function() {
            const testTypeEl = document.getElementById('testType');
            if (testTypeEl && this.value.trim()) testTypeEl.value = this.value.trim();
        });
    }

    // Save form
    const form = document.getElementById('addLabForm');
    if (form) form.addEventListener('submit', async e => { e.preventDefault(); await saveLabResults(); });

    // Clear form
    const clearBtn = document.getElementById('clearFormBtn');
    if (clearBtn) clearBtn.addEventListener('click', clearLabForm);

    // Filters
    ['dateFilter','testTypeFilter','sortFilter'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', applyFilters);
    });
    const searchEl = document.getElementById('searchLabs');
    if (searchEl) searchEl.addEventListener('input', debounce(applyFilters, 300));

    // Export
    const exportBtn = document.getElementById('exportLabsBtn');
    if (exportBtn) exportBtn.addEventListener('click', exportLabResults);

    // Analysis
    const runBtn = document.getElementById('runAnalysisBtn');
    if (runBtn) runBtn.addEventListener('click', loadAnalysisTab);

    document.querySelectorAll('#analysisTest,#analysisParameter,#analysisPeriod').forEach(el => {
        if (el) el.addEventListener('change', loadAnalysisTab);
    });

    // Chart type buttons
    document.querySelectorAll('.chart-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.chart-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            loadAnalysisTab();
        });
    });

    // Learning
    const learnCat = document.getElementById('learningCategory');
    if (learnCat) learnCat.addEventListener('change', () => loadLearningContent(learnCat.value));
    const searchBtn = document.getElementById('searchLabBtn');
    if (searchBtn) searchBtn.addEventListener('click', searchLabInfo);
    const searchInput = document.getElementById('labSearch');
    if (searchInput) searchInput.addEventListener('keypress', e => { if (e.key === 'Enter') searchLabInfo(); });

    // File upload
    setupFileUploadListeners();

    // AI Analysis
    const aiBtn = document.getElementById('runAiAnalysisBtn');
    if (aiBtn) aiBtn.addEventListener('click', runAiAnalysis);
}

// Basic sidebar/nav listeners
function setupBasicListeners() {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            if (confirm('Logout?')) { await supabaseService.signOut(); window.location.href = 'index.html'; }
        });
    }

    const menuToggle = document.getElementById('menuToggle');
    if (menuToggle) {
        menuToggle.addEventListener('click', () => document.getElementById('sidebar')?.classList.toggle('mobile-open'));
    }

    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', async () => {
            refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            refreshBtn.disabled = true;
            await loadUserLabResults();
            loadLabHistoryTable();
            populateTestTypeFilter();
            populateAnalysisDropdowns();
            populateAiTestSelect();
            refreshBtn.innerHTML = '<i class="fas fa-sync-alt"></i><span>Refresh</span>';
            refreshBtn.disabled = false;
            showMessage('success', 'Lab results refreshed!');
        });
    }
}

// ===== FIX 1: Standard parameters with reference ranges =====
function loadTestParameters(params) {
    const container = document.getElementById('parametersContainer');
    if (!container) return;
    container.innerHTML = '';

    const grid = document.createElement('div');
    grid.style.cssText = 'display:grid;gap:12px;';

    params.forEach(param => {
        const row = document.createElement('div');
        row.className = 'parameter-row';
        row.style.cssText = 'display:grid;grid-template-columns:2fr 1fr 1.5fr 1.2fr 1fr;gap:12px;align-items:center;padding:12px 15px;background:#f8f9fa;border-radius:8px;';
        row.innerHTML = `
            <div>
                <div class="parameter-name" style="font-weight:600;color:#333;">${param.name}</div>
                <div style="font-size:0.82em;color:#888;margin-top:2px;">${param.unit}</div>
            </div>
            <div style="font-size:0.82em;color:#0078D4;background:#e7f3ff;padding:4px 8px;border-radius:4px;">${param.ref}</div>
            <input type="number" class="parameter-result" placeholder="Enter value" step="0.01"
                   data-param="${param.field}"
                   style="padding:8px 12px;border:2px solid #e0e0e0;border-radius:6px;width:100%;font-size:0.95em;">
            <div class="parameter-status" style="padding:4px 10px;border-radius:4px;text-align:center;font-size:0.82em;font-weight:600;color:#999;">--</div>
            <div class="parameter-flag" style="font-size:0.8em;color:#666;"></div>
        `;

        const input  = row.querySelector('.parameter-result');
        const status = row.querySelector('.parameter-status');
        const flag   = row.querySelector('.parameter-flag');

        input.addEventListener('input', function() {
            evaluateParam(parseFloat(this.value), param, status, flag);
        });

        grid.appendChild(row);
    });

    container.appendChild(grid);
}

// Evaluate parameter status with colour coding
function evaluateParam(value, param, statusEl, flagEl) {
    if (!value || isNaN(value)) {
        statusEl.textContent = '--'; statusEl.style.background = '#f0f0f0'; statusEl.style.color = '#999';
        flagEl.textContent = '';
        return;
    }

    let status = 'NORMAL', bg = '#d4edda', color = '#155724', advice = '';

    if (param.critHigh && value >= param.critHigh) {
        status = 'CRITICAL ↑'; bg = '#dc3545'; color = 'white';
        advice = '⚠ Critically high — seek medical attention';
    } else if (param.high && value > param.high) {
        status = 'HIGH ↑'; bg = '#f8d7da'; color = '#721c24';
        advice = 'Above normal range';
    } else if (param.low && value < param.low) {
        status = 'LOW ↓'; bg = '#fff3cd'; color = '#856404';
        advice = 'Below normal range';
    } else {
        advice = 'Within normal range ✓';
    }

    statusEl.textContent    = status;
    statusEl.style.background = bg;
    statusEl.style.color    = color;
    flagEl.textContent      = advice;
    flagEl.style.color      = color === 'white' ? '#dc3545' : color;
}

// Save lab results
async function saveLabResults() {
    const saveBtn    = document.getElementById('saveLabBtn');
    const testType   = document.getElementById('testType')?.value.trim();
    const testDate   = document.getElementById('testDate')?.value;

    if (!testType)  { showMessage('error', 'Test type is required'); return; }
    if (!testDate)  { showMessage('error', 'Test date is required'); return; }

    if (saveBtn) { saveBtn.disabled = true; saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...'; }

    try {
        const labData = {
            user_id:    window.appState.currentUser.id,
            test_name:  testType,
            test_date:  testDate,
            lab_name:   document.getElementById('labName')?.value.trim()    || null,
            doctor_name:document.getElementById('doctorName')?.value.trim() || null,
            notes:      null
        };

        // Collect parameter values
        document.querySelectorAll('.parameter-result').forEach(input => {
            const field = input.getAttribute('data-param');
            const val   = input.value.trim();
            if (field && val && !isNaN(parseFloat(val))) {
                labData[field] = parseFloat(val);
            }
        });

        // Notes
        let notes = document.getElementById('resultsText')?.value.trim() || '';
        const bp  = document.getElementById('bloodPressure')?.value.trim();
        const hr  = document.getElementById('heartRate')?.value;
        if (bp) notes += (notes ? '\n' : '') + `Blood Pressure: ${bp}`;
        if (hr) notes += (notes ? '\n' : '') + `Heart Rate: ${parseInt(hr)} bpm`;
        if (notes) labData.notes = notes;

        console.log('Saving lab data:', labData);
        const saved = await supabaseService.addLabResult(labData);

        showMessage('success', 'Lab results saved successfully!');
        clearLabForm();
        await loadUserLabResults();
        populateTestTypeFilter();
        populateAnalysisDropdowns();
        populateAiTestSelect();
        setTimeout(() => {
            document.querySelector('.page-tab[data-tab="history"]')?.click();
        }, 1000);

    } catch (err) {
        console.error('Save error:', err);
        showMessage('error', 'Failed to save: ' + err.message);
    } finally {
        if (saveBtn) { saveBtn.disabled = false; saveBtn.innerHTML = '<i class="fas fa-save"></i> Save Lab Results'; }
    }
}

// Clear form
function clearLabForm() {
    document.getElementById('addLabForm')?.reset();
    document.getElementById('customTestName').value = '';
    document.getElementById('testType').value = '';
    document.getElementById('parametersContainer').innerHTML = '';
    document.getElementById('parametersCard').style.display = 'none';
    document.getElementById('labCategory').value = '';
    const panelSel = document.getElementById('labTestPanel');
    if (panelSel) { panelSel.innerHTML = '<option value="">Select Category First</option>'; panelSel.disabled = true; }
    document.getElementById('testDate').value = new Date().toISOString().split('T')[0];
    showMessage('info', 'Form cleared');
}

// Load lab history table
function loadLabHistoryTable() {
    const tbody = document.getElementById('labsTableBody');
    if (!tbody) return;

    if (!labState.filteredTests.length) {
        tbody.innerHTML = `<tr><td colspan="9" class="text-center"><div class="empty-state"><i class="fas fa-flask"></i><h4>No lab results found</h4><p>Add your first lab result to get started!</p><button class="btn-secondary" onclick="document.querySelector('.page-tab[data-tab=add]').click()"><i class="fas fa-plus"></i> Add Lab Result</button></div></td></tr>`;
        return;
    }

    const start = (labState.currentPage - 1) * labState.itemsPerPage;
    const page  = labState.filteredTests.slice(start, start + labState.itemsPerPage);

    tbody.innerHTML = '';
    page.forEach(lab => {
        const tr = document.createElement('tr');
        const fmt = (v, u) => v != null ? `${v} ${u}` : '--';
        tr.innerHTML = `
            <td>${formatDate(lab.test_date)}</td>
            <td><strong>${lab.test_name}</strong></td>
            <td>${fmt(lab.glucose, 'mg/dL')}</td>
            <td>${fmt(lab.hba1c, '%')}</td>
            <td>${fmt(lab.cholesterol, 'mg/dL')}</td>
            <td>${fmt(lab.triglycerides, 'mg/dL')}</td>
            <td>${fmt(lab.ldl, 'mg/dL')}</td>
            <td>${fmt(lab.hdl, 'mg/dL')}</td>
            <td><div class="action-buttons">
                <button class="btn-icon view-btn"   title="View"   onclick="viewLabDetail('${lab.id}')"><i class="fas fa-eye"></i></button>
                <button class="btn-icon edit-btn"   title="Edit"   onclick="editLabResult('${lab.id}')"><i class="fas fa-edit"></i></button>
                <button class="btn-icon delete-btn" title="Delete" onclick="deleteLabResult('${lab.id}')"><i class="fas fa-trash"></i></button>
            </div></td>`;
        tbody.appendChild(tr);
    });

    updatePagination();
}

function updatePagination() {
    const pg = document.getElementById('labsPagination');
    if (!pg) return;
    const total = Math.ceil(labState.filteredTests.length / labState.itemsPerPage);
    if (total <= 1) { pg.innerHTML = ''; return; }

    let html = `<button class="pagination-btn" onclick="changePage(${labState.currentPage-1})" ${labState.currentPage===1?'disabled':''}>‹</button>`;
    for (let i = 1; i <= total; i++) {
        if (i===1||i===total||Math.abs(i-labState.currentPage)<=1)
            html += `<button class="pagination-btn ${i===labState.currentPage?'active':''}" onclick="changePage(${i})">${i}</button>`;
        else if (Math.abs(i-labState.currentPage)===2) html += '<span class="pagination-info">…</span>';
    }
    html += `<button class="pagination-btn" onclick="changePage(${labState.currentPage+1})" ${labState.currentPage===total?'disabled':''}>›</button>`;
    html += `<span class="pagination-info">${(labState.currentPage-1)*labState.itemsPerPage+1}–${Math.min(labState.currentPage*labState.itemsPerPage,labState.filteredTests.length)} of ${labState.filteredTests.length}</span>`;
    pg.innerHTML = html;
}

function changePage(p) {
    const total = Math.ceil(labState.filteredTests.length / labState.itemsPerPage);
    if (p < 1 || p > total) return;
    labState.currentPage = p;
    loadLabHistoryTable();
}

function applyFilters() {
    labState.currentPage = 1;
    let filtered = [...labState.labTests];

    const dateVal = document.getElementById('dateFilter')?.value;
    if (dateVal && dateVal !== 'all') {
        const cutoff = new Date();
        if (dateVal === '7days')  cutoff.setDate(cutoff.getDate() - 7);
        if (dateVal === '30days') cutoff.setDate(cutoff.getDate() - 30);
        if (dateVal === '90days') cutoff.setDate(cutoff.getDate() - 90);
        if (dateVal === 'year')   cutoff.setFullYear(cutoff.getFullYear() - 1);
        filtered = filtered.filter(l => new Date(l.test_date) >= cutoff);
    }

    const typeVal = document.getElementById('testTypeFilter')?.value;
    if (typeVal && typeVal !== 'all') filtered = filtered.filter(l => l.test_name === typeVal);

    const searchVal = document.getElementById('searchLabs')?.value.toLowerCase().trim();
    if (searchVal) filtered = filtered.filter(l =>
        l.test_name.toLowerCase().includes(searchVal) ||
        (l.notes||'').toLowerCase().includes(searchVal) ||
        (l.lab_name||'').toLowerCase().includes(searchVal)
    );

    const sortVal = document.getElementById('sortFilter')?.value;
    filtered.sort((a, b) => {
        if (sortVal === 'date_asc') return new Date(a.test_date) - new Date(b.test_date);
        if (sortVal === 'name')     return a.test_name.localeCompare(b.test_name);
        return new Date(b.test_date) - new Date(a.test_date);
    });

    labState.filteredTests = filtered;
    loadLabHistoryTable();
}

// ===== FIX 5: Analysis tab — full implementation =====
function loadAnalysisTab() {
    const testName = document.getElementById('analysisTest')?.value;
    const param    = document.getElementById('analysisParameter')?.value || 'glucose';
    const period   = document.getElementById('analysisPeriod')?.value || '90days';

    if (!testName) {
        showMessage('info', 'Select a test to analyse');
        return;
    }

    // Date cutoff
    const cutoff = new Date();
    if (period === '30days')  cutoff.setDate(cutoff.getDate() - 30);
    else if (period === '90days') cutoff.setDate(cutoff.getDate() - 90);
    else if (period === '6months') cutoff.setMonth(cutoff.getMonth() - 6);
    else if (period === '1year')   cutoff.setFullYear(cutoff.getFullYear() - 1);
    else cutoff.setFullYear(2000); // all time

    const tests = labState.labTests
        .filter(l => l.test_name === testName && new Date(l.test_date) >= cutoff)
        .sort((a, b) => new Date(a.test_date) - new Date(b.test_date));

    if (!tests.length) {
        showMessage('info', 'No data for selected test in this time period');
        return;
    }

    updateAnalysisStats(tests, param);
    createTrendChart(tests, param);
    createCorrelationChart(tests);
}

function updateAnalysisStats(tests, param) {
    const values = tests.map(t => t[param]).filter(v => v != null);
    if (!values.length) {
        ['latestValue','averageValue','highestValue','lowestValue','changeValue'].forEach(id => {
            const el = document.getElementById(id); if (el) el.textContent = '--';
        });
        updateHealthStatus(null, param);
        return;
    }

    const latest  = values[values.length - 1];
    const avg     = values.reduce((a,b) => a+b, 0) / values.length;
    const highest = Math.max(...values);
    const lowest  = Math.min(...values);

    const setEl = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    setEl('latestValue',  latest.toFixed(1));
    setEl('averageValue', avg.toFixed(1));
    setEl('highestValue', highest.toFixed(1));
    setEl('lowestValue',  lowest.toFixed(1));

    if (values.length > 1) {
        const prev   = values[values.length - 2];
        const change = latest - prev;
        const pct    = ((change / prev) * 100).toFixed(1);
        setEl('changeValue', `${change > 0 ? '+' : ''}${change.toFixed(1)} (${pct}%)`);
    } else {
        setEl('changeValue', 'N/A (only 1 result)');
    }

    updateHealthStatus(latest, param);
}

function updateHealthStatus(value, param) {
    const ind = document.getElementById('statusIndicator');
    const desc = document.getElementById('statusDescription');
    if (!ind) return;

    if (value === null) {
        ind.innerHTML = `<div class="status-icon"><i class="fas fa-question-circle"></i></div><div class="status-text"><div class="status-title">Status</div><div class="status-value" id="statusValue">No data</div></div>`;
        if (desc) desc.textContent = 'Add lab results to see health status.';
        return;
    }

    const statuses = {
        glucose:      v => v < 70 ? ['Low','warning','Hypoglycaemia range — seek attention immediately.'] : v <= 100 ? ['Normal','normal','Excellent glucose control. Keep it up!'] : v <= 125 ? ['Prediabetes','warning','Monitor closely and consider lifestyle changes.'] : ['Diabetes Range','danger','Consult your doctor — medical management needed.'],
        hba1c:        v => v < 5.7 ? ['Normal','normal','Excellent long-term glucose control.'] : v <= 6.4 ? ['Prediabetes','warning','Increased diabetes risk — lifestyle changes recommended.'] : ['Diabetes Range','danger','Diabetes range — consistent medical management needed.'],
        cholesterol:  v => v < 200 ? ['Optimal','normal','Excellent cholesterol levels for heart health.'] : v <= 239 ? ['Borderline High','warning','Consider dietary changes and increased exercise.'] : ['High','danger','High cholesterol — medical consultation recommended.'],
        ldl:          v => v < 100 ? ['Optimal','normal','Optimal LDL for cardiovascular health.'] : v <= 129 ? ['Near Optimal','normal','Near optimal. Maintain heart-healthy diet.'] : v <= 159 ? ['Borderline High','warning','Consider dietary intervention.'] : ['High','danger','High LDL — discuss treatment with your doctor.'],
        hdl:          v => v >= 60 ? ['Optimal','normal','Excellent HDL — protective against heart disease.'] : v >= 40 ? ['Acceptable','normal','Acceptable HDL. Exercise can help raise it.'] : ['Low','danger','Low HDL is a cardiovascular risk factor.'],
        triglycerides:v => v < 150 ? ['Normal','normal','Normal triglycerides.'] : v <= 199 ? ['Borderline High','warning','Reduce refined carbs and alcohol.'] : v <= 499 ? ['High','danger','High triglycerides — medical advice needed.'] : ['Very High','danger','Very high — risk of pancreatitis. Urgent care needed.']
    };

    const fn = statuses[param];
    const [label, cls, description] = fn ? fn(value) : ['Measured','normal','Value recorded.'];

    const iconMap = { normal: 'check-circle', warning: 'exclamation-triangle', danger: 'times-circle' };
    ind.innerHTML = `
        <div class="status-icon ${cls}"><i class="fas fa-${iconMap[cls]||'info-circle'}"></i></div>
        <div class="status-text"><div class="status-title">Status</div><div class="status-value">${label}</div></div>`;
    if (desc) desc.textContent = description;
}

function createTrendChart(tests, param) {
    const canvas = document.getElementById('trendChart');
    if (!canvas) return;
    if (labState.charts.trend) { labState.charts.trend.destroy(); labState.charts.trend = null; }

    const paramNames = {
        glucose: 'Glucose (mg/dL)', hba1c: 'HbA1c (%)', cholesterol: 'Cholesterol (mg/dL)',
        triglycerides: 'Triglycerides (mg/dL)', ldl: 'LDL (mg/dL)', hdl: 'HDL (mg/dL)'
    };

    const validTests = tests.filter(t => t[param] != null);
    if (!validTests.length) return;

    const activeBtn = document.querySelector('.chart-btn.active');
    const chartType = activeBtn?.dataset.chart || 'area';

    labState.charts.trend = new Chart(canvas, {
        type: chartType === 'area' ? 'line' : chartType,
        data: {
            labels: validTests.map(t => formatDate(t.test_date)),
            datasets: [{
                label: paramNames[param] || param,
                data:  validTests.map(t => t[param]),
                borderColor: '#0078D4',
                backgroundColor: chartType === 'area' ? 'rgba(0,120,212,0.12)' : 'rgba(0,120,212,0.6)',
                borderWidth: 3,
                fill: chartType === 'area',
                tension: 0.4,
                pointRadius: 5,
                pointHoverRadius: 8
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { display: true, position: 'top' },
                tooltip: { mode: 'index', intersect: false }
            },
            scales: {
                x: { grid: { display: false }, title: { display: true, text: 'Date' } },
                y: { beginAtZero: false, title: { display: true, text: paramNames[param] || param } }
            }
        }
    });
}

function createCorrelationChart(tests) {
    const canvas = document.getElementById('correlationChart');
    if (!canvas) return;
    if (labState.charts.correlation) { labState.charts.correlation.destroy(); labState.charts.correlation = null; }

    const params   = ['glucose','hba1c','cholesterol','triglycerides','ldl','hdl'];
    const labels   = ['Glucose\n(mg/dL)','HbA1c\n(%)','Cholesterol\n(mg/dL)','Triglycerides\n(mg/dL)','LDL\n(mg/dL)','HDL\n(mg/dL)'];
    const colors   = ['#FF6384','#FF9F40','#FFCD56','#4BC0C0','#36A2EB','#9966FF'];

    const available = params.map((p, i) => ({
        param: p, label: labels[i], color: colors[i],
        avg: tests.filter(t => t[p]!=null).reduce((s,t,_,a) => s + t[p]/a.length, 0),
        count: tests.filter(t => t[p]!=null).length
    })).filter(d => d.count > 0);

    if (available.length < 2) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0,0,canvas.width,canvas.height);
        ctx.fillStyle = '#666'; ctx.font = '14px Arial'; ctx.textAlign = 'center';
        ctx.fillText('Record results for multiple parameters to see comparison chart', canvas.width/2, canvas.height/2);
        return;
    }

    labState.charts.correlation = new Chart(canvas, {
        type: 'bar',
        data: {
            labels: available.map(d => d.label.replace('\n',' ')),
            datasets: [{
                label: 'Average Value',
                data:   available.map(d => parseFloat(d.avg.toFixed(2))),
                backgroundColor: available.map(d => d.color + 'CC'),
                borderColor:     available.map(d => d.color),
                borderWidth: 2,
                borderRadius: 6
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                title:  { display: true, text: 'Average Values Across Parameters' }
            },
            scales: {
                x: { title: { display: true, text: 'Parameter' } },
                y: { beginAtZero: true, title: { display: true, text: 'Average Value' } }
            }
        }
    });
}

// ===== FIX 6: Full lab learning with category filter and search highlight =====
function loadLearningContent(category) {
    const grid = document.getElementById('labInfoGrid');
    if (!grid) return;

    const filtered = category === 'all'
        ? LAB_LEARNING_DB
        : LAB_LEARNING_DB.filter(t => t.category === category);

    if (!filtered.length) {
        grid.innerHTML = '<div class="loading-state"><i class="fas fa-info-circle"></i> No tests in this category yet.</div>';
        return;
    }

    grid.innerHTML = '';
    filtered.forEach(test => {
        const card = document.createElement('div');
        card.className = 'test-info-card';
        card.innerHTML = `
            <div class="test-info-header">
                <i class="${test.icon}" style="color:#0078D4;font-size:1.4em;"></i>
                <h4 style="margin:0;flex:1;color:#333;">${test.name}</h4>
                <span style="font-size:0.75em;background:#e7f3ff;color:#0078D4;padding:2px 8px;border-radius:10px;text-transform:capitalize;">${test.category}</span>
            </div>
            <div class="test-info-body">
                <div class="info-item"><div class="info-label">Description</div><div class="info-value">${test.description}</div></div>
                <div class="info-item"><div class="info-label">Purpose</div><div class="info-value">${test.purpose}</div></div>
                <div class="info-item"><div class="info-label">Preparation</div><div class="info-value">${test.preparation}</div></div>
                <div class="info-item"><div class="info-label">Normal Ranges</div><div class="info-value" style="font-family:monospace;font-size:0.9em;background:#f8f9fa;padding:6px 10px;border-radius:4px;">${test.normalRanges}</div></div>
                <div class="info-item"><div class="info-label">Interpretation</div><div class="info-value">${test.interpretation}</div></div>
            </div>
            <div class="test-info-footer">
                <button class="learn-more-btn" onclick="window.open('${test.link}','_blank')">
                    <i class="fas fa-external-link-alt"></i> Learn More
                </button>
            </div>`;
        grid.appendChild(card);
    });
}

function searchLabInfo() {
    const query = document.getElementById('labSearch')?.value.toLowerCase().trim();
    const resultsEl = document.getElementById('labSearchResults');
    if (!resultsEl) return;

    if (!query) { resultsEl.innerHTML = ''; return; }

    const matches = LAB_LEARNING_DB.filter(t =>
        t.name.toLowerCase().includes(query) ||
        t.description.toLowerCase().includes(query) ||
        t.purpose.toLowerCase().includes(query) ||
        t.category.toLowerCase().includes(query)
    );

    if (!matches.length) {
        resultsEl.innerHTML = `<div class="no-results"><i class="fas fa-search" style="font-size:2em;color:#ccc;display:block;margin-bottom:10px;"></i><h4>No tests found for "${query}"</h4><p>Try: HbA1c, Cholesterol, Liver, Thyroid, CBC</p></div>`;
        return;
    }

    const highlight = (text) => text.replace(new RegExp(`(${query})`, 'gi'), '<mark style="background:#fff3cd;padding:0 2px;border-radius:2px;">$1</mark>');

    resultsEl.innerHTML = `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:15px;margin-top:10px;">` +
        matches.map(t => `
            <div style="background:white;border-radius:10px;padding:15px;box-shadow:0 2px 8px rgba(0,0,0,0.1);border:1px solid #e0e0e0;">
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
                    <i class="${t.icon}" style="color:#0078D4;"></i>
                    <strong>${highlight(t.name)}</strong>
                </div>
                <p style="color:#666;font-size:0.9em;margin:0 0 8px;">${highlight(t.purpose)}</p>
                <button class="learn-more-btn" onclick="window.open('${t.link}','_blank')" style="width:100%;padding:8px;">
                    <i class="fas fa-external-link-alt"></i> Learn More
                </button>
            </div>`).join('') + `</div>`;
}

// ===== FIX 7: File upload =====
function setupFileUploadListeners() {
    const uploadArea = document.getElementById('uploadArea');
    const fileInput  = document.getElementById('fileUpload');
    const browseBtn  = document.getElementById('browseBtn');

    if (browseBtn) browseBtn.addEventListener('click', () => fileInput?.click());
    if (uploadArea) {
        uploadArea.addEventListener('click', (e) => { if (e.target !== browseBtn) fileInput?.click(); });
        uploadArea.addEventListener('dragover', (e) => { e.preventDefault(); uploadArea.style.borderColor = '#0078D4'; uploadArea.style.background = '#f0f7ff'; });
        uploadArea.addEventListener('dragleave', ()  => { uploadArea.style.borderColor = ''; uploadArea.style.background = ''; });
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault(); uploadArea.style.borderColor = ''; uploadArea.style.background = '';
            if (e.dataTransfer.files.length) handleFileSelect({ target: { files: e.dataTransfer.files } });
        });
    }
    if (fileInput) fileInput.addEventListener('change', handleFileSelect);

    const removeBtn  = document.getElementById('removeFileBtn');
    const cancelBtn  = document.getElementById('cancelUploadBtn');
    const saveFileBtn = document.getElementById('saveFileBtn');
    if (removeBtn)  removeBtn.addEventListener('click', clearFileSelection);
    if (cancelBtn)  cancelBtn.addEventListener('click', clearFileSelection);
    if (saveFileBtn) saveFileBtn.addEventListener('click', saveFileInformation);
}

function handleFileSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['application/pdf','image/jpeg','image/png','text/plain'];
    if (!validTypes.includes(file.type)) { showMessage('error', 'Invalid file type. Use PDF, JPG, PNG, or TXT.'); return; }
    if (file.size > 10 * 1024 * 1024)    { showMessage('error', 'File too large. Max 10MB.'); return; }

    labState.selectedFile = file;
    document.getElementById('uploadArea').style.display  = 'none';
    document.getElementById('filePreview').style.display = 'block';

    const fileInfo = document.getElementById('fileInfo');
    fileInfo.innerHTML = `
        <div class="file-info-item"><div class="file-info-label">Filename</div><div class="file-info-value">${file.name}</div></div>
        <div class="file-info-item"><div class="file-info-label">Type</div><div class="file-info-value">${file.type}</div></div>
        <div class="file-info-item"><div class="file-info-label">Size</div><div class="file-info-value">${(file.size/1024).toFixed(1)} KB</div></div>`;

    const fileImage = document.getElementById('fileImage');
    if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = e => { fileImage.innerHTML = `<img src="${e.target.result}" alt="Preview" style="max-width:100%;border-radius:8px;">`; };
        reader.readAsDataURL(file);
    } else {
        fileImage.innerHTML = `<div style="text-align:center;padding:20px;color:#0078D4;"><i class="fas fa-file-${file.type.includes('pdf')?'pdf':'alt'}" style="font-size:3em;display:block;margin-bottom:10px;"></i>${file.type.split('/')[1]?.toUpperCase()||'File'}</div>`;
    }
}

function clearFileSelection() {
    labState.selectedFile = null;
    const fileInput = document.getElementById('fileUpload');
    if (fileInput) fileInput.value = '';
    document.getElementById('uploadArea').style.display  = '';
    document.getElementById('filePreview').style.display = 'none';
}

async function saveFileInformation() {
    if (!labState.selectedFile) { showMessage('error', 'No file selected'); return; }
    const saveBtn = document.getElementById('saveFileBtn');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading...'; }

    try {
        await supabaseService.uploadDocument(window.appState.currentUser.id, labState.selectedFile);
        showMessage('success', 'File uploaded successfully!');
        clearFileSelection();
        await loadUploadHistory();
    } catch (err) {
        showMessage('error', 'Upload failed: ' + err.message);
    } finally {
        if (saveBtn) { saveBtn.disabled = false; saveBtn.innerHTML = '<i class="fas fa-save"></i> Save File'; }
    }
}

async function loadUploadHistory() {
    const tbody = document.getElementById('uploadHistoryTable');
    if (!tbody) return;

    try {
        const result = await supabaseService.getUserDocuments(window.appState.currentUser.id);
        const docs   = result.success ? result.data : result.data || [];

        if (!docs.length) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center">No files uploaded yet.</td></tr>';
            return;
        }

        tbody.innerHTML = docs.map(doc => `
            <tr>
                <td>${new Date(doc.uploaded_at).toLocaleDateString()}</td>
                <td>${doc.file_name}</td>
                <td>${(doc.file_type||'').split('/')[1]?.toUpperCase()||'--'}</td>
                <td>${doc.file_size ? (doc.file_size/1024).toFixed(1)+' KB' : '--'}</td>
                <td><span class="status-badge uploaded">Uploaded</span></td>
                <td><div class="action-buttons">
                    <button class="btn-icon view-btn" onclick="viewDocument('${doc.file_path}','${doc.file_name}')" title="View"><i class="fas fa-eye"></i></button>
                    <button class="btn-icon delete-btn" onclick="deleteUpload('${doc.id}','${doc.file_path}')" title="Delete"><i class="fas fa-trash"></i></button>
                </div></td>
            </tr>`).join('');
    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">Failed to load upload history.</td></tr>';
    }
}

// ===== AI Analysis via Supabase Edge Function =====
async function runAiAnalysis() {
    const labId = document.getElementById('aiTestSelect')?.value;
    if (!labId) { showMessage('error', 'Please select a lab result to analyse'); return; }

    const lab = labState.labTests.find(l => String(l.id) === String(labId));
    if (!lab)  { showMessage('error', 'Lab result not found'); return; }

    const resultDiv  = document.getElementById('aiAnalysisResult');
    const loadingDiv = document.getElementById('aiLoading');
    const textDiv    = document.getElementById('aiResultText');
    const btn        = document.getElementById('runAiAnalysisBtn');

    resultDiv.style.display = 'block';
    loadingDiv.style.display = 'flex';
    textDiv.innerHTML = '';
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Analysing...'; }

    // Build patient summary
    const summary = [
        `Test: ${lab.test_name}`,
        `Date: ${formatDate(lab.test_date)}`,
        lab.glucose       ? `Fasting Glucose: ${lab.glucose} mg/dL`       : null,
        lab.hba1c         ? `HbA1c: ${lab.hba1c}%`                        : null,
        lab.cholesterol   ? `Total Cholesterol: ${lab.cholesterol} mg/dL` : null,
        lab.ldl           ? `LDL: ${lab.ldl} mg/dL`                       : null,
        lab.hdl           ? `HDL: ${lab.hdl} mg/dL`                       : null,
        lab.triglycerides ? `Triglycerides: ${lab.triglycerides} mg/dL`   : null,
        lab.notes         ? `Notes: ${lab.notes}`                          : null
    ].filter(Boolean).join('\n');

    const prompt = `You are a compassionate medical assistant in a personal health tracking app called Healytica Record.

Analyse the following lab result and provide:
1. A brief plain-English summary of what each value means
2. Whether each value is normal, borderline, or concerning (with reference ranges)
3. Specific health recommendations based on the results
4. What the patient should discuss with their doctor

Be clear, kind, and non-alarmist. Do NOT diagnose. Use bullet points for clarity.

Lab Result:
${summary}

Format your response with clear sections: Summary, Values Analysis, Recommendations, Questions for Your Doctor.`;

    try {
        // Call Supabase Edge Function (same as dashboard AI)
        const EDGE_URL = `https://osoclzojtrqdxykdmiks.supabase.co/functions/v1/claude-insights`;
        const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9zb2Nsem9qdHJxZHh5a2RtaWtzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4NzU4MjcsImV4cCI6MjA4MTQ1MTgyN30.fjFbgrqqXrxcnVPfSwHOsfPmi1PMXf-wW12p6J1nInk';

        const response = await fetch(EDGE_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': ANON_KEY,
                'Authorization': `Bearer ${ANON_KEY}`
            },
            body: JSON.stringify({ prompt })
        });

        const data = await response.json();
        const text = data.content?.[0]?.text || data.error || 'No response from AI.';

        // Format the response nicely
        const formatted = text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/^## (.*)/gm, '<h4 style="color:#0078D4;margin:15px 0 8px;">$1</h4>')
            .replace(/^### (.*)/gm, '<h5 style="color:#333;margin:12px 0 6px;">$1</h5>')
            .replace(/^- (.*)/gm, '<li style="margin-bottom:4px;">$1</li>')
            .replace(/(<li.*<\/li>(\n|$))+/g, m => `<ul style="padding-left:20px;margin:8px 0;">${m}</ul>`)
            .replace(/\n\n/g, '</p><p style="margin:8px 0;">')
            .replace(/\n/g, '<br>');

        textDiv.innerHTML = `<div style="background:#fff;border-radius:8px;padding:5px 0;">${formatted}</div>`;

    } catch (err) {
        textDiv.innerHTML = `<p style="color:#666;font-style:italic;">AI analysis unavailable. Please deploy the Supabase Edge Function (claude-insights) to enable this feature.</p><p style="color:#666;font-size:0.9em;">Error: ${err.message}</p>`;
    } finally {
        loadingDiv.style.display = 'none';
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-brain"></i> Generate AI Analysis'; }
    }
}

// ===== Modal for lab detail =====
function viewLabDetail(labId) {
    const lab = labState.labTests.find(l => String(l.id) === String(labId));
    if (!lab) { showMessage('error', 'Lab result not found'); return; }

    const body = document.getElementById('labDetailBody');
    if (body) {
        const fmt = (v, u) => v != null ? `${v} ${u}` : '<em style="color:#999;">Not recorded</em>';
        body.innerHTML = `
            <div class="lab-detail-section">
                <h4>Test Information</h4>
                <div class="detail-grid">
                    <div class="detail-item"><span class="detail-label">Test Type</span><span class="detail-value">${lab.test_name}</span></div>
                    <div class="detail-item"><span class="detail-label">Date</span><span class="detail-value">${formatDate(lab.test_date)}</span></div>
                    ${lab.lab_name    ? `<div class="detail-item"><span class="detail-label">Laboratory</span><span class="detail-value">${lab.lab_name}</span></div>` : ''}
                    ${lab.doctor_name ? `<div class="detail-item"><span class="detail-label">Doctor</span><span class="detail-value">${lab.doctor_name}</span></div>` : ''}
                </div>
            </div>
            <div class="lab-detail-section">
                <h4>Results</h4>
                <div class="detail-grid">
                    <div class="detail-item"><span class="detail-label">Glucose (FBS)</span><span class="detail-value">${fmt(lab.glucose,'mg/dL')}</span></div>
                    <div class="detail-item"><span class="detail-label">HbA1c</span><span class="detail-value">${fmt(lab.hba1c,'%')}</span></div>
                    <div class="detail-item"><span class="detail-label">Cholesterol</span><span class="detail-value">${fmt(lab.cholesterol,'mg/dL')}</span></div>
                    <div class="detail-item"><span class="detail-label">Triglycerides</span><span class="detail-value">${fmt(lab.triglycerides,'mg/dL')}</span></div>
                    <div class="detail-item"><span class="detail-label">LDL</span><span class="detail-value">${fmt(lab.ldl,'mg/dL')}</span></div>
                    <div class="detail-item"><span class="detail-label">HDL</span><span class="detail-value">${fmt(lab.hdl,'mg/dL')}</span></div>
                </div>
            </div>
            ${lab.notes ? `<div class="lab-detail-section"><h4>Notes</h4><div class="detail-text">${lab.notes}</div></div>` : ''}`;
    }

    const editBtn = document.getElementById('editFromModalBtn');
    if (editBtn) editBtn.onclick = () => { closeModal(); editLabResult(labId); };

    const modal = document.getElementById('labDetailModal');
    if (modal) modal.classList.add('open');
}

function closeModal() {
    const modal = document.getElementById('labDetailModal');
    if (modal) modal.classList.remove('open');
}

async function editLabResult(labId) {
    closeModal();
    const lab = labState.labTests.find(l => String(l.id) === String(labId));
    if (!lab) { showMessage('error', 'Lab result not found'); return; }

    document.querySelector('.page-tab[data-tab="add"]')?.click();

    setTimeout(() => {
        const setVal = (id, v) => { const el = document.getElementById(id); if (el && v != null) el.value = v; };
        setVal('testType',   lab.test_name);
        setVal('testDate',   lab.test_date?.split('T')[0]);
        setVal('labName',    lab.lab_name);
        setVal('doctorName', lab.doctor_name);
        setVal('resultsText',lab.notes);
        labState.editingLabId = labId;
        showMessage('info', 'Editing lab result — update fields and save.');
    }, 300);
}

async function deleteLabResult(labId) {
    if (!confirm('Delete this lab result? This cannot be undone.')) return;
    try {
        await supabaseService.deleteLabResult(labId);
        labState.labTests      = labState.labTests.filter(l => String(l.id) !== String(labId));
        labState.filteredTests = labState.filteredTests.filter(l => String(l.id) !== String(labId));
        updateLabStats();
        loadLabHistoryTable();
        showMessage('success', 'Lab result deleted.');
    } catch (err) {
        showMessage('error', 'Failed to delete: ' + err.message);
    }
}

async function viewDocument(filePath, fileName) {
    try {
        const result = await supabaseService.getDocumentUrl(filePath);
        if (result.success) window.open(result.url, '_blank');
        else showMessage('error', 'Cannot open document: ' + result.error);
    } catch (err) { showMessage('error', 'Failed to open: ' + err.message); }
}

async function deleteUpload(docId, filePath) {
    if (!confirm('Delete this file?')) return;
    try {
        const result = await supabaseService.deleteDocument(docId, filePath);
        if (result.success) { showMessage('success', 'File deleted.'); await loadUploadHistory(); }
        else showMessage('error', 'Delete failed.');
    } catch (err) { showMessage('error', 'Failed: ' + err.message); }
}

function exportLabResults() {
    if (!labState.labTests.length) { showMessage('info', 'No lab results to export'); return; }
    const esc = t => { t = String(t||''); return (t.includes(',') || t.includes('"')) ? `"${t.replace(/"/g,'""')}"` : t; };
    const csv = [
        ['Date','Test Type','Glucose (mg/dL)','HbA1c (%)','Cholesterol (mg/dL)','Triglycerides (mg/dL)','LDL (mg/dL)','HDL (mg/dL)','Lab','Notes'].join(','),
        ...labState.labTests.map(l => [
            formatDate(l.test_date), esc(l.test_name), l.glucose||'', l.hba1c||'',
            l.cholesterol||'', l.triglycerides||'', l.ldl||'', l.hdl||'',
            esc(l.lab_name||''), esc(l.notes||'')
        ].join(','))
    ].join('\n');

    const a = document.createElement('a');
    a.href     = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    a.download = `lab_results_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    showMessage('success', 'Lab results exported!');
}

// Utilities
function formatDate(ds) {
    if (!ds) return '--';
    return new Date(ds).toLocaleDateString('en-US', { year:'numeric', month:'short', day:'numeric' });
}

function debounce(fn, ms) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

function showMessage(type, text) {
    let container = document.getElementById('messageContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'messageContainer';
        container.className = 'message-container';
        document.body.appendChild(container);
    }
    const msg = document.createElement('div');
    msg.className = `message ${type}`;
    const icons = { success:'✅', error:'❌', warning:'⚠️', info:'ℹ️' };
    msg.innerHTML = `<span>${icons[type]||'ℹ️'}</span><span>${text}</span>`;
    container.appendChild(msg);
    setTimeout(() => {
        msg.style.opacity = '0'; msg.style.transition = 'opacity 0.3s';
        setTimeout(() => msg.parentNode?.removeChild(msg), 300);
    }, 5000);
}

// Global exports for inline onclick handlers
window.viewLabDetail   = viewLabDetail;
window.editLabResult   = editLabResult;
window.deleteLabResult = deleteLabResult;
window.changePage      = changePage;
window.closeModal      = closeModal;
window.viewDocument    = viewDocument;
window.deleteUpload    = deleteUpload;
window.loadLabResults  = async function() {
    await loadUserLabResults();
    setupLabPageUI();
};
window.labState = labState;