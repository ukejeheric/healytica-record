// ===== MEDICATIONS DEBUG VERSION =====
console.log('Medications debug script loaded');

// Simple test function
async function testMedications() {
    console.log('Testing medications functionality...');
    
    // Test 1: Check if user is logged in
    const user = checkAuth();
    console.log('User logged in:', user);
    
    if (!user) {
        console.error('User not logged in');
        showMessage('error', 'Please login first');
        return;
    }
    
    // Test 2: Try to load medications
    try {
        console.log('Loading user medications...');
        const medications = await healthDB.getUserMedications(user.id);
        console.log('Medications loaded:', medications);
        
        if (medications.length === 0) {
            console.log('No medications found. Creating test data...');
            await createTestMedication();
            showMessage('info', 'Test medication created. Refresh the page.');
        } else {
            console.log(`Found ${medications.length} medications`);
            showMessage('success', `Found ${medications.length} medications`);
        }
    } catch (error) {
        console.error('Error loading medications:', error);
        showMessage('error', `Database error: ${error.message}`);
    }
}

// Create test medication
async function createTestMedication() {
    const user = checkAuth();
    if (!user) return;
    
    const testMed = {
        user_id: user.id,
        medication_name: 'Test Medication',
        dosage: '500mg',
        frequency: 'Once daily',
        start_date: new Date().toISOString().split('T')[0],
        status: 'active',
        created_at: new Date().toISOString()
    };
    
    try {
        await healthDB.add('medications', testMed);
        console.log('Test medication created');
    } catch (error) {
        console.error('Error creating test medication:', error);
    }
}

// Simple initialization
async function initMedicationsSimple() {
    console.log('Initializing medications page (simple version)...');
    
    // Check authentication
    const user = checkAuth();
    if (!user) {
        window.location.href = 'index.html';
        return;
    }
    
    // Update UI elements
    updateSimpleUI();
    
    // Setup basic event listeners
    setupBasicListeners();
    
    // Load and display medications
    await loadAndDisplayMedications();
}

function updateSimpleUI() {
    console.log('Updating UI...');
    
    // Update user info
    const userName = document.getElementById('userName');
    if (userName && appState.currentUser) {
        userName.textContent = appState.currentUser.full_name || appState.currentUser.mobile_number;
    }
    
    // Update date
    const dateEl = document.getElementById('currentDate');
    if (dateEl) {
        dateEl.textContent = new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }
}

function setupBasicListeners() {
    console.log('Setting up basic listeners...');
    
    // Tab switching
    const tabs = document.querySelectorAll('.page-tab');
    const contents = document.querySelectorAll('.tab-content');
    
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Remove active class
            tabs.forEach(t => t.classList.remove('active'));
            contents.forEach(c => c.classList.remove('active'));
            
            // Add active class
            tab.classList.add('active');
            const tabId = tab.dataset.tab;
            const content = document.getElementById(`tab-${tabId}`);
            if (content) content.classList.add('active');
        });
    });
    
    // Logout button
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to logout?')) {
                logoutUser();
            }
        });
    }
    
    // Refresh button
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            location.reload();
        });
    }
}

async function loadAndDisplayMedications() {
    console.log('Loading medications...');
    
    const user = checkAuth();
    if (!user) return;
    
    try {
        // Show loading state
        const loader = document.getElementById('loader');
        if (loader) loader.style.display = 'flex';
        
        // Load medications
        const medications = await healthDB.getUserMedications(user.id);
        console.log(`Loaded ${medications.length} medications:`, medications);
        
        // Update summary counts
        updateSummaryCountsSimple(medications);
        
        // Display in list
        displayMedicationsListSimple(medications);
        
    } catch (error) {
        console.error('Error in loadAndDisplayMedications:', error);
        showMessage('error', `Error: ${error.message}`);
    } finally {
        const loader = document.getElementById('loader');
        if (loader) loader.style.display = 'none';
    }
}

function updateSummaryCountsSimple(medications) {
    console.log('Updating summary counts...');
    
    const totalEl = document.getElementById('totalMedsCount');
    const activeEl = document.getElementById('activeMedsCount');
    
    if (totalEl) totalEl.textContent = medications.length;
    if (activeEl) {
        const activeCount = medications.filter(m => m.status === 'active').length;
        activeEl.textContent = activeCount;
    }
}

function displayMedicationsListSimple(medications) {
    console.log('Displaying medications list...');
    
    const listContainer = document.getElementById('medicationsList');
    if (!listContainer) {
        console.error('medicationsList container not found');
        return;
    }
    
    if (medications.length === 0) {
        listContainer.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-pills fa-3x"></i>
                <h3>No medications found</h3>
                <p>Add your first medication to get started!</p>
                <button class="btn-primary" id="addFirstMedSimple">
                    <i class="fas fa-plus"></i> Add Medication
                </button>
            </div>
        `;
        
        // Add event listener
        const addBtn = document.getElementById('addFirstMedSimple');
        if (addBtn) {
            addBtn.addEventListener('click', () => {
                const addTab = document.querySelector('[data-tab="add"]');
                if (addTab) addTab.click();
            });
        }
        
        return;
    }
    
    let html = '';
    medications.forEach(med => {
        html += `
            <div class="medication-item">
                <div class="medication-status ${med.status}" 
                     style="background-color: ${med.status === 'active' ? 'green' : 'gray'}">
                </div>
                <div class="medication-info">
                    <div class="medication-name">${med.medication_name}</div>
                    <div class="medication-details">${med.dosage} • ${med.frequency}</div>
                </div>
                <div class="medication-date">
                    <div class="medication-start">Start: ${formatDate(med.start_date)}</div>
                    <div class="medication-status-text">${med.status}</div>
                </div>
            </div>
        `;
    });
    
    listContainer.innerHTML = html;
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOM loaded - starting medications debug...');
    
    // Initialize database
    try {
        await initDatabase();
        console.log('Database initialized');
    } catch (error) {
        console.error('Database initialization failed:', error);
        showMessage('error', 'Database initialization failed');
        return;
    }
    
    // Initialize app
    try {
        await initApp();
        console.log('App initialized');
    } catch (error) {
        console.error('App initialization failed:', error);
        showMessage('error', 'App initialization failed');
        return;
    }
    
    // Initialize medications
    await initMedicationsSimple();
    
    // Add debug button
    const debugBtn = document.createElement('button');
    debugBtn.textContent = '🔄 Debug';
    debugBtn.style.cssText = `
        position: fixed;
        bottom: 70px;
        right: 20px;
        padding: 10px 15px;
        background: #ff6b6b;
        color: white;
        border: none;
        border-radius: 5px;
        cursor: pointer;
        z-index: 1000;
        font-size: 12px;
    `;
    debugBtn.onclick = testMedications;
    document.body.appendChild(debugBtn);
});

console.log('Medications debug script loaded successfully');