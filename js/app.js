// ===== MAIN APPLICATION LOGIC WITH SUPABASE =====

// App state
const appState = {
    currentUser: null,
    currentPage: 'dashboard',
    isLoading: false
};

// ===== UTILITY FUNCTIONS =====

// Show loading state
function showLoading() {
    appState.isLoading = true;
    const loader = document.getElementById('loader');
    if (loader) loader.style.display = 'flex';
}

// Hide loading state
function hideLoading() {
    appState.isLoading = false;
    const loader = document.getElementById('loader');
    if (loader) loader.style.display = 'none';
}

// Format date for display
function formatDate(dateString) {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

// Format time
function formatTime(timeString) {
    if (!timeString) return '';
    
    const time = new Date(`2000-01-01T${timeString}`);
    return time.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Generate random ID
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Scroll to section
function scrollToSection(sectionId) {
    const section = document.getElementById(sectionId);
    if (section) {
        section.scrollIntoView({ behavior: 'smooth' });
    }
}

// ===== COMMON UI FUNCTIONS =====

// Update user information display
async function updateUserInfo() {
    const userDisplay = document.getElementById('userDisplay');
    const userName = document.getElementById('userName');
    const userAvatar = document.getElementById('userAvatar');
    
    if (appState.currentUser) {
        try {
            // Get user profile from Supabase
            const { success, data: profile } = await supabaseService.getUserProfile(appState.currentUser.id);
            
            let displayName = '';
            if (success && profile && profile.full_name) {
                displayName = profile.full_name;
            } else if (appState.currentUser.email) {
                displayName = appState.currentUser.email.split('@')[0];
            } else {
                displayName = 'User';
            }
            
            if (userDisplay) userDisplay.textContent = displayName;
            if (userName) userName.textContent = displayName;
            
            // Create avatar initials
            if (userAvatar) {
                const initials = displayName
                    .split(' ')
                    .map(name => name[0])
                    .join('')
                    .toUpperCase()
                    .slice(0, 2);
                
                userAvatar.textContent = initials || 'U';
            }
        } catch (error) {
            console.error('Error updating user info:', error);
        }
    }
}

// Setup logout button
function setupLogoutButton() {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            if (confirm('Are you sure you want to logout?')) {
                try {
                    const { success, error } = await supabaseService.signOut();
                    
                    if (success) {
                        // Clear local storage
                        localStorage.removeItem('health_user_session');
                        localStorage.removeItem('health_user_profile');
                        
                        // Redirect to login page
                        window.location.href = 'index.html';
                    } else {
                        showMessage('error', error || 'Logout failed');
                    }
                } catch (error) {
                    console.error('Logout error:', error);
                    showMessage('error', 'Logout failed');
                }
            }
        });
    }
}

// Setup navigation
function setupNavigation() {
    // Highlight current page in navigation
    const currentPage = window.location.pathname.split('/').pop();
    const navLinks = document.querySelectorAll('.nav-link');
    
    navLinks.forEach(link => {
        const href = link.getAttribute('href');
        if (href === currentPage || (currentPage === '' && href === 'dashboard.html')) {
            link.classList.add('active');
        }
        
        // Prevent default for in-app navigation
        link.addEventListener('click', (e) => {
            if (link.getAttribute('href').startsWith('#')) {
                e.preventDefault();
                const target = link.getAttribute('href').substring(1);
                scrollToSection(target);
            }
        });
    });

    // Mobile menu toggle
    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.getElementById('sidebar');
    
    if (menuToggle && sidebar) {
        menuToggle.addEventListener('click', () => {
            sidebar.classList.toggle('active');
            sidebar.classList.toggle('mobile-open');
        });
    }
}

// Setup common UI elements
async function setupCommonUI() {
    // Update user info in sidebar/header
    await updateUserInfo();
    
    // Setup logout button
    setupLogoutButton();
    
    // Setup navigation
    setupNavigation();
}

// ===== PAGE-SPECIFIC LOADERS =====

function loadDashboard() {
    console.log('Loading dashboard...');
    // Actual implementation in dashboard.js
}

function loadProfile() {
    console.log('Loading profile...');
    // Will implement when we create profile.html
}

function loadMedications() {
    console.log('Loading medications...');
    // Actual implementation in medications.js
}

function loadLabResults() {
    console.log('Loading lab results...');
    // Will implement when we create lab_results.html
}

function loadVitalSigns() {
    console.log('Loading vital signs...');
    // Will implement when we create vital_signs.html
}

function loadAppointments() {
    console.log('Loading appointments...');
    // Will implement when we create appointments.html
}

function loadSymptoms() {
    console.log('Loading symptoms...');
    // Will implement when we create symptoms.html
}

function loadAnalytics() {
    console.log('Loading analytics...');
    // Will implement when we create analytics.html
}

function loadSettings() {
    console.log('Loading settings...');
    // Will implement when we create settings.html
}

// Load functionality based on current page
function loadPageFunctionality() {
    const path = window.location.pathname;
    
    if (path.includes('dashboard.html')) {
        loadDashboard();
    } else if (path.includes('profile.html')) {
        loadProfile();
    } else if (path.includes('medications.html')) {
        loadMedications();
    } else if (path.includes('lab_results.html')) {
        loadLabResults();
    } else if (path.includes('vital_signs.html')) {
        loadVitalSigns();
    } else if (path.includes('appointments.html')) {
        loadAppointments();
    } else if (path.includes('symptoms.html')) {
        loadSymptoms();
    } else if (path.includes('analytics.html')) {
        loadAnalytics();
    } else if (path.includes('settings.html')) {
        loadSettings();
    }

    // Setup common functionality
    setupCommonUI();
}

// ===== AUTHENTICATION FUNCTIONS =====

// Check authentication with Supabase
async function checkAuth() {
    try {
        // Check if user is logged in via Supabase
        const { data, error } = await supabaseClient.auth.getUser();
        
        if (error) {
            console.error('Auth check error:', error);
            return null;
        }
        
        if (!data.user) {
            return null;
        }
        
        // Get user profile
        const { success, data: profile } = await supabaseService.getUserProfile(data.user.id);
        
        // Store user in app state
        appState.currentUser = {
            ...data.user,
            profile: profile || {}
        };
        
        // Store in localStorage for quick access
        localStorage.setItem('health_user_session', JSON.stringify({
            id: data.user.id,
            email: data.user.email,
            profile: profile || {}
        }));
        
        return appState.currentUser;
        
    } catch (error) {
        console.error('Error checking auth:', error);
        return null;
    }
}

// ===== APP INITIALIZATION =====

// Initialize app with Supabase
async function initApp() {
    console.log('Initializing Healytica Record App with Supabase...');
    
    // Show loading
    showLoading();
    
    try {
        // Check authentication with Supabase
        const user = await checkAuth();
        
        if (!user) {
            // If not on login page, redirect to login
            if (!window.location.pathname.includes('index.html') && 
                !window.location.pathname.includes('register.html') &&
                !window.location.pathname.includes('reset-password.html')) {
                window.location.href = 'index.html';
            }
            
            // If on login page, setup auth listeners
            if (window.location.pathname.includes('index.html') && typeof setupAuthListeners === 'function') {
                setupAuthListeners();
            }
            
            hideLoading();
            return;
        }

        appState.currentUser = user;
        
        // If on login page but logged in, redirect to dashboard
        if (window.location.pathname.includes('index.html') || 
            window.location.pathname.includes('register.html') ||
            window.location.pathname.includes('reset-password.html')) {
            window.location.href = 'dashboard.html';
            return;
        }

        // Load page-specific functionality
        loadPageFunctionality();
        
        // Hide loading
        hideLoading();
        
        console.log('App initialized successfully for user:', appState.currentUser.email);
        
    } catch (error) {
        console.error('Error initializing app:', error);
        showMessage('error', 'Failed to initialize application');
        hideLoading();
    }
}

// ===== TEST DATA FUNCTIONS =====

// For development and testing - Generate test data in Supabase
async function generateTestData() {
    if (!appState.currentUser) {
        showMessage('error', 'Please login first');
        return;
    }
    
    console.log('Generating test data for Supabase...');
    
    const userId = appState.currentUser.id;
    const today = new Date();
    
    // Generate test medications for Supabase
    const testMeds = [
        {
            user_id: userId,
            medication_name: 'Metformin',
            dosage: '500mg',
            frequency: 'Twice daily',
            start_date: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 30).toISOString().split('T')[0],
            end_date: null,
            prescribed_by: 'Dr. Smith',
            special_instructions: 'Take with meals',
            status: 'active'
        },
        {
            user_id: userId,
            medication_name: 'Lisinopril',
            dosage: '10mg',
            frequency: 'Once daily',
            start_date: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 15).toISOString().split('T')[0],
            end_date: null,
            prescribed_by: 'Dr. Johnson',
            special_instructions: 'Take in the morning',
            status: 'active'
        }
    ];
    
    // Add test medications to Supabase
    try {
        for (const med of testMeds) {
            const { data, error } = await supabaseClient
                .from('medications')
                .insert([med])
                .select();
            
            if (error) throw error;
        }
        
        showMessage('success', 'Test medications generated successfully in Supabase!');
        
    } catch (error) {
        console.error('Error generating test data:', error);
        showMessage('error', 'Failed to generate test data: ' + error.message);
    }
}

// ===== EVENT LISTENERS =====

// Start app when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    console.log('📱 DOM loaded, starting app with Supabase...');
    
    // Initialize app with Supabase
    await initApp();
    
    // For development: add test data button
    if ((window.location.href.includes('localhost') || window.location.href.includes('127.0.0.1')) && 
        appState.currentUser) {
        
        const testBtn = document.createElement('button');
        testBtn.textContent = 'Generate Test Data';
        testBtn.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            padding: 10px 15px;
            background: #ff6b6b;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            z-index: 1000;
            font-size: 12px;
            display: none; /* Hidden by default */
        `;
        testBtn.onclick = generateTestData;
        document.body.appendChild(testBtn);
        
        // Only show on dashboard and medications pages for testing
        if (window.location.pathname.includes('dashboard.html') || 
            window.location.pathname.includes('medications.html')) {
            testBtn.style.display = 'block';
        }
    }
});

// ===== GLOBAL MESSAGE FUNCTION =====

// Global function to show messages
function showMessage(type, text) {
    const container = document.getElementById('messageContainer');
    if (!container) {
        console.log(`[${type.toUpperCase()}] ${text}`);
        return;
    }

    const message = document.createElement('div');
    message.className = `message ${type}`;
    
    const icons = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
    };
    
    message.innerHTML = `
        <span class="message-icon">${icons[type] || 'ℹ️'}</span>
        <span class="message-text">${text}</span>
    `;
    
    container.appendChild(message);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        message.style.opacity = '0';
        setTimeout(() => {
            if (message.parentNode) {
                message.parentNode.removeChild(message);
            }
        }, 300);
    }, 5000);
}

// ===== EXPORT FUNCTIONS =====

// Export app functions to window object
window.appState = appState;
window.initApp = initApp;
window.formatDate = formatDate;
window.formatTime = formatTime;
window.generateId = generateId;
window.generateTestData = generateTestData;
window.showLoading = showLoading;
window.hideLoading = hideLoading;
window.showMessage = showMessage;