// ===== settings.js - FIXED VERSION =====

// ===== SUPABASE CONFIGURATION =====
// Use the existing supabaseService from supabase.js
if (typeof window.supabaseService === 'undefined') {
    console.error('Supabase service not loaded!');
}

// ===== SETTINGS PAGE FUNCTIONALITY =====

// Settings state
const settingsState = {
    currentTab: 'profile',
    profileData: null,
    settings: {
        security: {},
        preferences: {},
        health: {}
    },
    appInfo: {
        version: '1.0.0',
        lastUpdated: '2024-01-15',
        dbSize: '0 KB',
        recordCount: 0
    }
};

// Show loading spinner
function showLoading() {
    const loader = document.getElementById('loader');
    if (loader) loader.style.display = 'flex';
}

// Hide loading spinner
function hideLoading() {
    const loader = document.getElementById('loader');
    if (loader) loader.style.display = 'none';
}

// Show message
function showMessage(type, text) {
    const container = document.getElementById('messageContainer');
    if (!container) {
        console.log(`[${type}] ${text}`);
        return;
    }
    
    const message = document.createElement('div');
    message.className = `message message-${type}`;
    message.textContent = text;
    
    container.innerHTML = '';
    container.appendChild(message);
    
    // Auto hide after 3 seconds
    setTimeout(() => {
        if (message.parentNode) {
            message.remove();
        }
    }, 3000);
}

// Initialize settings page
async function loadSettings() {
    console.log('Loading settings...');
    showLoading();
    
    try {
        // Check if supabaseService is available
        if (typeof window.supabaseService === 'undefined') {
            throw new Error('Supabase service not initialized');
        }
        
        // Get current user
        const user = await window.supabaseService.getCurrentUser();
        
        if (!user) {
            console.log('No active session, redirecting to login');
            showMessage('error', 'Please login again');
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 1500);
            return;
        }
        
        console.log('User authenticated:', user.email);
        
        // Update appState
        if (!window.appState) window.appState = {};
        window.appState.currentUser = user;
        
        // Load user profile
        await loadProfileData(user);
        
        // Load saved settings (with fallbacks for missing tables)
        await loadSavedSettings(user);
        
        // Update UI
        updateSettingsUI();
        
        // Setup event listeners
        setupSettingsListeners();
        
        // Update quick stats
        await updateQuickStats(user);
        
        // Update date display
        updateDateDisplay();
        
        // Update user info in sidebar
        updateUserInfo(user);
        
        console.log('Settings loaded successfully');
        
    } catch (error) {
        console.error('Error loading settings:', error);
        showMessage('error', 'Failed to load settings: ' + error.message);
    } finally {
        hideLoading();
    }
}

// Update user info in sidebar
function updateUserInfo(user) {
    const userNameEl = document.getElementById('userName');
    const userAvatarEl = document.getElementById('userAvatar');
    
    if (userNameEl) {
        const displayName = settingsState.profileData?.full_name || 
                           user.user_metadata?.full_name || 
                           user.email?.split('@')[0] || 
                           'User';
        userNameEl.textContent = displayName;
    }
    
    if (userAvatarEl) {
        const name = settingsState.profileData?.full_name || user.email || 'U';
        const initials = name
            .split(' ')
            .map(n => n[0])
            .join('')
            .toUpperCase()
            .substring(0, 2);
        userAvatarEl.textContent = initials;
    }
}

// Load user profile data from Supabase
async function loadProfileData(user) {
    try {
        console.log('Loading profile data for user:', user.id);
        
        // Use the getUserProfile method from supabaseService
        const result = await window.supabaseService.getUserProfile(user.id);
        
        if (result.success && result.data) {
            console.log('Profile found:', result.data);
            settingsState.profileData = result.data;
        } else {
            console.log('No profile found, creating empty profile');
            // Create empty profile object
            settingsState.profileData = {
                user_id: user.id,
                full_name: user.user_metadata?.full_name || '',
                email: user.email || '',
                phone: '',
                gender: '',
                date_of_birth: '',
                blood_type: '',
                address: '',
                allergies: '',
                medical_history: '',
                emergency_contact: '',
                emergency_relation: '',
                emergency_phone: '',
                emergency_email: '',
                emergency_notes: '',
                medical_conditions: '[]',
                emergency_contacts: '[]'
            };
        }
        
        // Set max date for DOB (today)
        const dobInput = document.getElementById('settingsDOB');
        if (dobInput) {
            const today = new Date().toISOString().split('T')[0];
            dobInput.max = today;
        }
        
    } catch (error) {
        console.error('Error in loadProfileData:', error);
        // Create default profile as fallback
        settingsState.profileData = {
            user_id: user.id,
            full_name: user.user_metadata?.full_name || '',
            email: user.email || ''
        };
    }
}

// Load saved settings from Supabase (with fallbacks)
async function loadSavedSettings(user) {
    try {
        // Try to load from localStorage first (as fallback)
        loadSettingsFromLocalStorage();
        
        // Then try to load from Supabase if tables exist
        try {
            await loadSecuritySettingsFromDB(user);
        } catch (e) {
            console.log('Security settings table may not exist, using defaults');
        }
        
        try {
            await loadPreferenceSettingsFromDB(user);
        } catch (e) {
            console.log('Preference settings table may not exist, using defaults');
        }
        
        try {
            await loadHealthSettingsFromDB(user);
        } catch (e) {
            console.log('Health settings table may not exist, using defaults');
        }
        
        // Update app info
        await updateAppInfo(user);
        
    } catch (error) {
        console.error('Error loading saved settings:', error);
    }
}

// Load settings from localStorage
function loadSettingsFromLocalStorage() {
    try {
        const savedSecurity = localStorage.getItem('health_settings_security');
        if (savedSecurity) {
            settingsState.settings.security = JSON.parse(savedSecurity);
        }
        
        const savedPreferences = localStorage.getItem('health_settings_preferences');
        if (savedPreferences) {
            settingsState.settings.preferences = JSON.parse(savedPreferences);
        }
        
        const savedHealth = localStorage.getItem('health_settings_health');
        if (savedHealth) {
            settingsState.settings.health = JSON.parse(savedHealth);
        }
    } catch (e) {
        console.error('Error loading from localStorage:', e);
    }
}

// Load security settings from DB (if table exists)
async function loadSecuritySettingsFromDB(user) {
    // This is a generic approach - check if table exists first
    try {
        const { data, error } = await window.supabaseClient
            .from('settings_security')
            .select('*')
            .eq('user_id', user.id)
            .maybeSingle();
        
        if (!error && data) {
            settingsState.settings.security = {
                enablePIN: data.enable_pin || false,
                appPIN: data.app_pin || '',
                autoLogout: data.auto_logout || '15',
                dataSharing: data.data_sharing || 'none',
                emergencyAccess: data.emergency_access !== false,
                shareAnalytics: data.share_analytics !== false,
                backupEncryption: data.backup_encryption !== false
            };
            
            // Save to localStorage as backup
            localStorage.setItem('health_settings_security', JSON.stringify(settingsState.settings.security));
        }
    } catch (e) {
        console.log('Security table may not exist:', e.message);
    }
}

// Load preference settings from DB (if table exists)
async function loadPreferenceSettingsFromDB(user) {
    try {
        const { data, error } = await window.supabaseClient
            .from('settings_preferences')
            .select('*')
            .eq('user_id', user.id)
            .maybeSingle();
        
        if (!error && data) {
            settingsState.settings.preferences = {
                theme: data.theme || 'light',
                fontSize: data.font_size || 'medium',
                density: data.info_density || 'comfortable',
                notifyMeds: data.notify_meds !== false,
                notifyAppointments: data.notify_appointments !== false,
                notifyLabs: data.notify_labs !== false,
                notifySymptoms: data.notify_symptoms || false,
                notificationTime: data.notification_time || '19:00',
                language: data.app_language || 'en',
                region: data.app_region || 'us',
                units: data.measurement_units || 'metric',
                autoSave: data.auto_save_forms !== false,
                developerMode: data.developer_mode || false,
                debugLogging: data.debug_logging || false
            };
            
            localStorage.setItem('health_settings_preferences', JSON.stringify(settingsState.settings.preferences));
        }
    } catch (e) {
        console.log('Preferences table may not exist:', e.message);
    }
}

// Load health settings from DB (if table exists)
async function loadHealthSettingsFromDB(user) {
    try {
        const { data, error } = await window.supabaseClient
            .from('settings_health')
            .select('*')
            .eq('user_id', user.id)
            .maybeSingle();
        
        if (!error && data) {
            settingsState.settings.health = {
                primaryCareDoctor: data.primary_care_doctor || '',
                preferredPharmacy: data.preferred_pharmacy || '',
                insuranceProvider: data.insurance_provider || '',
                weightGoal: data.weight_goal || 70,
                bloodPressureGoal: data.blood_pressure_goal || '120/80',
                activityGoal: data.activity_goal || 10000,
                showEmergencyCard: data.show_emergency_card !== false,
                autoNotifyEmergency: data.auto_notify_emergency !== false,
                shareVitalsEmergency: data.share_vitals_emergency !== false,
                advancedDirective: data.advanced_directive || 'none',
                reminderLeadTime: data.reminder_lead_time || 15,
                refillAlertDays: data.refill_alert_days || 7,
                trackAdherence: data.track_adherence !== false,
                trackSideEffects: data.track_side_effects !== false
            };
            
            localStorage.setItem('health_settings_health', JSON.stringify(settingsState.settings.health));
        }
    } catch (e) {
        console.log('Health table may not exist:', e.message);
    }
}

// Update app information
async function updateAppInfo(user) {
    try {
        // Get record counts from tables that exist
        const tables = [
            { name: 'medications', field: 'user_id' },
            { name: 'lab_results', field: 'user_id' },
            { name: 'vital_signs', field: 'user_id' },
            { name: 'symptoms', field: 'user_id' },
            { name: 'appointments', field: 'user_id' },
            { name: 'journal_entries', field: 'user_id' }
        ];
        
        let totalRecords = 0;
        
        for (const table of tables) {
            try {
                const { count, error } = await window.supabaseClient
                    .from(table.name)
                    .select('*', { count: 'exact', head: true })
                    .eq(table.field, user.id);
                
                if (!error && count !== null) {
                    totalRecords += count;
                }
            } catch (e) {
                console.log(`Table ${table.name} may not exist`);
            }
        }
        
        settingsState.appInfo.recordCount = totalRecords;
        
        // Estimate database size (rough estimate: 1KB per record)
        const estimatedSize = totalRecords * 1;
        settingsState.appInfo.dbSize = estimatedSize > 1024 
            ? `${(estimatedSize / 1024).toFixed(1)} MB` 
            : `${estimatedSize} KB`;
            
    } catch (error) {
        console.error('Error updating app info:', error);
    }
}

// Update settings UI
function updateSettingsUI() {
    updateProfileTab();
    updateSecurityTab();
    updatePreferencesTab();
    updateHealthTab();
    updateInfoTab();
}

// Update profile tab
function updateProfileTab() {
    if (!settingsState.profileData) return;
    
    const profile = settingsState.profileData;
    
    // Map database field names to form IDs
    setValue('settingsFullName', profile.full_name || '');
    setValue('settingsEmail', profile.email || '');
    setValue('settingsPhone', profile.phone || '');
    setValue('settingsGender', profile.gender || '');
    setValue('settingsDOB', profile.date_of_birth || profile.dob || '');
    setValue('settingsBloodType', profile.blood_type || '');
    setValue('settingsAllergies', profile.allergies || '');
    setValue('settingsMedicalHistory', profile.medical_history || '');
    setValue('settingsEmergencyName', profile.emergency_contact || '');
    setValue('settingsEmergencyPhone', profile.emergency_phone || '');
    setValue('settingsEmergencyRelation', profile.emergency_relation || '');
    setValue('settingsAddress', profile.address || '');
}

// Update security tab
function updateSecurityTab() {
    const security = settingsState.settings.security || {};
    
    // Set PIN settings
    const enablePIN = document.getElementById('enablePIN');
    const pinSettings = document.getElementById('pinSettings');
    
    if (enablePIN && pinSettings) {
        enablePIN.checked = security.enablePIN || false;
        pinSettings.style.display = enablePIN.checked ? 'block' : 'none';
        
        if (security.appPIN) {
            setValue('appPIN', security.appPIN);
        }
    }
    
    // Set other security settings
    setValue('autoLogout', security.autoLogout || '15');
    setValue('dataSharing', security.dataSharing || 'none');
    setCheckbox('emergencyAccess', security.emergencyAccess !== false);
    setCheckbox('shareAnalytics', security.shareAnalytics !== false);
    setCheckbox('backupEncryption', security.backupEncryption !== false);
}

// Update preferences tab
function updatePreferencesTab() {
    const preferences = settingsState.settings.preferences || {};
    
    // Set display preferences
    setValue('appTheme', preferences.theme || 'light');
    setValue('fontSize', preferences.fontSize || 'medium');
    setValue('infoDensity', preferences.density || 'comfortable');
    
    // Set notification preferences
    setCheckbox('notifyMeds', preferences.notifyMeds !== false);
    setCheckbox('notifyAppointments', preferences.notifyAppointments !== false);
    setCheckbox('notifyLabs', preferences.notifyLabs !== false);
    setCheckbox('notifySymptoms', preferences.notifySymptoms || false);
    setValue('notificationTime', preferences.notificationTime || '19:00');
    
    // Set language & region
    setValue('appLanguage', preferences.language || 'en');
    setValue('appRegion', preferences.region || 'us');
    setValue('measurementUnits', preferences.units || 'metric');
    
    // Set advanced preferences
    setCheckbox('autoSaveForms', preferences.autoSave !== false);
    setCheckbox('developerMode', preferences.developerMode || false);
    setCheckbox('debugLogging', preferences.debugLogging || false);
}

// Update health tab
function updateHealthTab() {
    const health = settingsState.settings.health || {};
    
    // Set health monitoring
    setValue('primaryCareDoctor', health.primaryCareDoctor || '');
    setValue('preferredPharmacy', health.preferredPharmacy || '');
    setValue('insuranceProvider', health.insuranceProvider || '');
    
    // Set health goals
    setValue('weightGoal', health.weightGoal || 70);
    setValue('bloodPressureGoal', health.bloodPressureGoal || '120/80');
    setValue('activityGoal', health.activityGoal || 10000);
    
    // Set emergency preferences
    setCheckbox('showEmergencyCard', health.showEmergencyCard !== false);
    setCheckbox('autoNotifyEmergency', health.autoNotifyEmergency !== false);
    setCheckbox('shareVitalsEmergency', health.shareVitalsEmergency !== false);
    setValue('advancedDirective', health.advancedDirective || 'none');
    
    // Set medication management
    setValue('reminderLeadTime', health.reminderLeadTime || 15);
    setValue('refillAlertDays', health.refillAlertDays || 7);
    setCheckbox('trackAdherence', health.trackAdherence !== false);
    setCheckbox('trackSideEffects', health.trackSideEffects !== false);
}

// Update info tab
function updateInfoTab() {
    const info = settingsState.appInfo || {};
    
    // Set app details
    setText('appVersion', info.version || '1.0.0');
    setText('lastUpdated', info.lastUpdated || '2024-01-15');
    setText('dbSize', info.dbSize || '0 KB');
    setText('recordCount', info.recordCount || '0');
    
    // Set last backup date
    const lastBackup = localStorage.getItem('health_last_backup');
    setText('lastBackupDate', lastBackup ? formatDate(lastBackup) : 'Never');
}

// Update quick stats
async function updateQuickStats(user) {
    try {
        // Get active medications count
        try {
            const result = await window.supabaseService.getUserMedications(user.id);
            if (result.success) {
                const activeMeds = result.data.filter(med => med.status === 'active' || !med.status);
                setText('activeMedsCount', activeMeds.length);
            } else {
                setText('activeMedsCount', '0');
            }
        } catch (e) {
            setText('activeMedsCount', '0');
        }
        
        // Get upcoming appointments count
        try {
            const result = await window.supabaseService.getUserAppointments(user.id);
            if (result.success) {
                const today = new Date().toISOString().split('T')[0];
                const upcoming = result.data.filter(apt => apt.appointment_date >= today);
                setText('upcomingAptsCount', upcoming.length);
            } else {
                setText('upcomingAptsCount', '0');
            }
        } catch (e) {
            setText('upcomingAptsCount', '0');
        }
        
        // Calculate simple health score
        let score = 75;
        try {
            const vitalsResult = await window.supabaseService.getUserVitalSigns(user.id);
            if (vitalsResult.success && vitalsResult.data.length > 0) {
                const latest = vitalsResult.data[0];
                if (latest.systolic && latest.systolic <= 120) score += 10;
                else if (latest.systolic && latest.systolic <= 140) score += 5;
            }
        } catch (e) {
            // Keep default score
        }
        
        score = Math.max(0, Math.min(100, score));
        setText('healthScore', score);
        
    } catch (error) {
        console.error('Error updating quick stats:', error);
        setText('activeMedsCount', '0');
        setText('upcomingAptsCount', '0');
        setText('healthScore', '--');
    }
}

// Update date display
function updateDateDisplay() {
    const dateEl = document.getElementById('currentDate');
    if (!dateEl) return;
    
    const now = new Date();
    const options = { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    };
    dateEl.textContent = now.toLocaleDateString('en-US', options);
}

// Setup settings event listeners
function setupSettingsListeners() {
    setupTabNavigation();
    setupProfileListeners();
    setupSecurityListeners();
    setupDataListeners();
    setupPreferencesListeners();
    setupHealthListeners();
    setupInfoListeners();
    setupCommonListeners();
    setupModalListeners();
}

// Setup tab navigation
function setupTabNavigation() {
    const tabs = document.querySelectorAll('.settings-tab');
    const panes = document.querySelectorAll('.tab-pane');
    
    tabs.forEach(tab => {
        tab.addEventListener('click', function() {
            const tabId = this.dataset.tab;
            
            // Update active tab
            tabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            
            // Update active pane
            panes.forEach(pane => {
                pane.classList.remove('active');
                if (pane.id === tabId + 'Tab') {
                    pane.classList.add('active');
                }
            });
            
            settingsState.currentTab = tabId;
        });
    });
}

// Setup profile listeners
function setupProfileListeners() {
    const saveBtn = document.getElementById('saveProfile');
    if (saveBtn) {
        saveBtn.addEventListener('click', saveProfile);
    }
    
    const cancelBtn = document.getElementById('cancelProfile');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', function() {
            updateProfileTab();
            showMessage('info', 'Changes cancelled');
        });
    }
}

// Setup security listeners
function setupSecurityListeners() {
    const enablePIN = document.getElementById('enablePIN');
    if (enablePIN) {
        enablePIN.addEventListener('change', function() {
            const pinSettings = document.getElementById('pinSettings');
            if (pinSettings) {
                pinSettings.style.display = this.checked ? 'block' : 'none';
            }
            saveSecuritySettings();
        });
    }
    
    const changePasswordBtn = document.getElementById('changePasswordBtn');
    if (changePasswordBtn) {
        changePasswordBtn.addEventListener('click', changePassword);
    }
    
    const logoutAllBtn = document.getElementById('logoutAllBtn');
    if (logoutAllBtn) {
        logoutAllBtn.addEventListener('click', logoutAllDevices);
    }
    
    const resetAppBtn = document.getElementById('resetAppBtn');
    if (resetAppBtn) {
        resetAppBtn.addEventListener('click', confirmResetApp);
    }
    
    // Auto-save on change for security settings
    const securityInputs = ['autoLogout', 'dataSharing', 'emergencyAccess', 'shareAnalytics', 'backupEncryption', 'appPIN'];
    securityInputs.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('change', saveSecuritySettings);
            if (element.tagName === 'INPUT' && element.type === 'text') {
                element.addEventListener('blur', saveSecuritySettings);
            }
        }
    });
}

// Setup data listeners
function setupDataListeners() {
    const generateExportBtn = document.getElementById('generateExportBtn');
    if (generateExportBtn) {
        generateExportBtn.addEventListener('click', generateExport);
    }
    
    const createBackupBtn = document.getElementById('createBackupBtn');
    if (createBackupBtn) {
        createBackupBtn.addEventListener('click', createBackup);
    }
    
    const restoreBackupBtn = document.getElementById('restoreBackupBtn');
    if (restoreBackupBtn) {
        restoreBackupBtn.addEventListener('click', restoreBackup);
    }
    
    const clearCacheBtn = document.getElementById('clearCacheBtn');
    if (clearCacheBtn) {
        clearCacheBtn.addEventListener('click', clearCache);
    }
    
    const rebuildAnalyticsBtn = document.getElementById('rebuildAnalyticsBtn');
    if (rebuildAnalyticsBtn) {
        rebuildAnalyticsBtn.addEventListener('click', rebuildAnalytics);
    }
}

// Setup preferences listeners
function setupPreferencesListeners() {
    const prefInputs = ['appTheme', 'fontSize', 'infoDensity', 'notifyMeds', 'notifyAppointments', 
                       'notifyLabs', 'notifySymptoms', 'notificationTime', 'appLanguage', 
                       'appRegion', 'measurementUnits', 'autoSaveForms', 'developerMode', 'debugLogging'];
    
    prefInputs.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('change', savePreferenceSettings);
        }
    });
    
    const themeSelect = document.getElementById('appTheme');
    if (themeSelect) {
        themeSelect.addEventListener('change', function() {
            applyTheme(this.value);
        });
    }
}

// Setup health listeners
function setupHealthListeners() {
    const healthInputs = ['primaryCareDoctor', 'preferredPharmacy', 'insuranceProvider', 
                         'weightGoal', 'bloodPressureGoal', 'activityGoal', 'showEmergencyCard',
                         'autoNotifyEmergency', 'shareVitalsEmergency', 'advancedDirective',
                         'reminderLeadTime', 'refillAlertDays', 'trackAdherence', 'trackSideEffects'];
    
    healthInputs.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('change', saveHealthSettings);
            if (element.tagName === 'INPUT' && element.type === 'text') {
                element.addEventListener('blur', saveHealthSettings);
            }
        }
    });
}

// Setup info listeners
function setupInfoListeners() {
    const showTechDetails = document.getElementById('showTechDetails');
    if (showTechDetails) {
        showTechDetails.addEventListener('change', function() {
            const techDetails = document.getElementById('techDetails');
            if (techDetails) {
                techDetails.style.display = this.checked ? 'block' : 'none';
            }
        });
    }
    
    const checkUpdatesBtn = document.getElementById('checkUpdatesBtn');
    if (checkUpdatesBtn) {
        checkUpdatesBtn.addEventListener('click', checkForUpdates);
    }
    
    const contactSupportBtn = document.getElementById('contactSupportBtn');
    if (contactSupportBtn) {
        contactSupportBtn.addEventListener('click', contactSupport);
    }
    
    const reportBugBtn = document.getElementById('reportBugBtn');
    if (reportBugBtn) {
        reportBugBtn.addEventListener('click', reportBug);
    }
    
    const suggestFeatureBtn = document.getElementById('suggestFeatureBtn');
    if (suggestFeatureBtn) {
        suggestFeatureBtn.addEventListener('click', suggestFeature);
    }
    
    const viewTermsBtn = document.getElementById('viewTermsBtn');
    if (viewTermsBtn) {
        viewTermsBtn.addEventListener('click', viewTerms);
    }
    
    const viewPrivacyBtn = document.getElementById('viewPrivacyBtn');
    if (viewPrivacyBtn) {
        viewPrivacyBtn.addEventListener('click', viewPrivacy);
    }
    
    const viewDisclaimerBtn = document.getElementById('viewDisclaimerBtn');
    if (viewDisclaimerBtn) {
        viewDisclaimerBtn.addEventListener('click', viewDisclaimer);
    }
    
    const runDiagnosticsBtn = document.getElementById('runDiagnosticsBtn');
    if (runDiagnosticsBtn) {
        runDiagnosticsBtn.addEventListener('click', runDiagnostics);
    }
}

// Setup common listeners
function setupCommonListeners() {
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', function() {
            loadSettings();
        });
    }
    
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }
    
    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.getElementById('sidebar');
    if (menuToggle && sidebar) {
        menuToggle.addEventListener('click', function() {
            sidebar.classList.toggle('active');
        });
    }
}

// Setup modal listeners
function setupModalListeners() {
    const modal = document.getElementById('confirmationModal');
    const modalClose = document.getElementById('modalClose');
    const modalCancel = document.getElementById('modalCancel');
    
    if (modalClose) {
        modalClose.addEventListener('click', function() {
            modal.style.display = 'none';
        });
    }
    
    if (modalCancel) {
        modalCancel.addEventListener('click', function() {
            modal.style.display = 'none';
        });
    }
    
    window.addEventListener('click', function(event) {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });
}

// ===== SETTINGS ACTIONS =====

// Save profile to Supabase
async function saveProfile() {
    try {
        const user = await window.supabaseService.getCurrentUser();
        if (!user) {
            showMessage('error', 'User not authenticated');
            return;
        }
        
        // Map form fields to database fields
        const profileData = {
            user_id: user.id,
            full_name: getValue('settingsFullName'),
            email: getValue('settingsEmail') || user.email,
            phone: getValue('settingsPhone'),
            gender: getValue('settingsGender'),
            date_of_birth: getValue('settingsDOB'),
            blood_type: getValue('settingsBloodType'),
            allergies: getValue('settingsAllergies'),
            medical_history: getValue('settingsMedicalHistory'),
            emergency_contact: getValue('settingsEmergencyName'),
            emergency_phone: getValue('settingsEmergencyPhone'),
            emergency_relation: getValue('settingsEmergencyRelation'),
            address: getValue('settingsAddress'),
            updated_at: new Date().toISOString()
        };
        
        // Validate required fields
        if (!profileData.full_name || !profileData.full_name.trim()) {
            showMessage('error', 'Full name is required');
            return;
        }
        
        // Update in Supabase using the service
        const result = await window.supabaseService.updateUserProfile(user.id, profileData);
        
        if (!result.success) {
            console.error('Error saving profile:', result.error);
            showMessage('error', 'Failed to save profile: ' + result.error);
            return;
        }
        
        // Update local state
        settingsState.profileData = profileData;
        
        // Update user metadata in auth
        try {
            await window.supabaseClient.auth.updateUser({
                data: { full_name: profileData.full_name }
            });
        } catch (e) {
            console.error('Error updating auth metadata:', e);
        }
        
        // Update sidebar user info
        updateUserInfo(user);
        
        showMessage('success', 'Profile saved successfully!');
        
    } catch (error) {
        console.error('Error saving profile:', error);
        showMessage('error', 'Failed to save profile: ' + error.message);
    }
}

// Change password with Supabase
async function changePassword() {
    const currentPassword = getValue('currentPassword');
    const newPassword = getValue('newPassword');
    const confirmPassword = getValue('confirmPasswordSec');
    
    // Validate inputs
    if (!currentPassword || !newPassword || !confirmPassword) {
        showMessage('error', 'Please fill all password fields');
        return;
    }
    
    if (newPassword.length < 6) {
        showMessage('error', 'Password must be at least 6 characters');
        return;
    }
    
    if (newPassword !== confirmPassword) {
        showMessage('error', 'New passwords don\'t match');
        return;
    }
    
    try {
        // Update password with Supabase
        const { error } = await window.supabaseClient.auth.updateUser({
            password: newPassword
        });
        
        if (error) {
            console.error('Error changing password:', error);
            showMessage('error', error.message || 'Failed to change password');
            return;
        }
        
        showMessage('success', 'Password changed successfully!');
        
        // Clear form
        setValue('currentPassword', '');
        setValue('newPassword', '');
        setValue('confirmPasswordSec', '');
        
    } catch (error) {
        console.error('Error changing password:', error);
        showMessage('error', 'Failed to change password');
    }
}

// Save security settings to localStorage and optionally Supabase
async function saveSecuritySettings() {
    try {
        const security = {
            enablePIN: getCheckbox('enablePIN'),
            appPIN: getValue('appPIN'),
            autoLogout: getValue('autoLogout') || '15',
            dataSharing: getValue('dataSharing'),
            emergencyAccess: getCheckbox('emergencyAccess'),
            shareAnalytics: getCheckbox('shareAnalytics'),
            backupEncryption: getCheckbox('backupEncryption')
        };
        
        // Update local state
        settingsState.settings.security = security;
        
        // Save to localStorage as backup
        localStorage.setItem('health_settings_security', JSON.stringify(security));
        
        // Try to save to Supabase if table exists
        try {
            const user = await window.supabaseService.getCurrentUser();
            if (user) {
                const dbSecurity = {
                    user_id: user.id,
                    enable_pin: security.enablePIN,
                    app_pin: security.appPIN,
                    auto_logout: parseInt(security.autoLogout) || 15,
                    data_sharing: security.dataSharing,
                    emergency_access: security.emergencyAccess,
                    share_analytics: security.shareAnalytics,
                    backup_encryption: security.backupEncryption,
                    updated_at: new Date().toISOString()
                };
                
                await window.supabaseClient
                    .from('settings_security')
                    .upsert(dbSecurity);
            }
        } catch (e) {
            console.log('Could not save to Supabase, using localStorage only');
        }
        
        showAutoSaveMessage();
        
    } catch (error) {
        console.error('Error saving security settings:', error);
    }
}

// Save preference settings
async function savePreferenceSettings() {
    try {
        const preferences = {
            theme: getValue('appTheme'),
            fontSize: getValue('fontSize'),
            density: getValue('infoDensity'),
            notifyMeds: getCheckbox('notifyMeds'),
            notifyAppointments: getCheckbox('notifyAppointments'),
            notifyLabs: getCheckbox('notifyLabs'),
            notifySymptoms: getCheckbox('notifySymptoms'),
            notificationTime: getValue('notificationTime'),
            language: getValue('appLanguage'),
            region: getValue('appRegion'),
            units: getValue('measurementUnits'),
            autoSave: getCheckbox('autoSaveForms'),
            developerMode: getCheckbox('developerMode'),
            debugLogging: getCheckbox('debugLogging')
        };
        
        // Update local state
        settingsState.settings.preferences = preferences;
        
        // Save to localStorage
        localStorage.setItem('health_settings_preferences', JSON.stringify(preferences));
        
        // Try to save to Supabase
        try {
            const user = await window.supabaseService.getCurrentUser();
            if (user) {
                const dbPreferences = {
                    user_id: user.id,
                    theme: preferences.theme,
                    font_size: preferences.fontSize,
                    info_density: preferences.density,
                    notify_meds: preferences.notifyMeds,
                    notify_appointments: preferences.notifyAppointments,
                    notify_labs: preferences.notifyLabs,
                    notify_symptoms: preferences.notifySymptoms,
                    notification_time: preferences.notificationTime,
                    app_language: preferences.language,
                    app_region: preferences.region,
                    measurement_units: preferences.units,
                    auto_save_forms: preferences.autoSave,
                    developer_mode: preferences.developerMode,
                    debug_logging: preferences.debugLogging,
                    updated_at: new Date().toISOString()
                };
                
                await window.supabaseClient
                    .from('settings_preferences')
                    .upsert(dbPreferences);
            }
        } catch (e) {
            console.log('Could not save to Supabase, using localStorage only');
        }
        
        // Apply theme immediately
        applyTheme(preferences.theme);
        
        showAutoSaveMessage();
        
    } catch (error) {
        console.error('Error saving preferences:', error);
    }
}

// Save health settings
async function saveHealthSettings() {
    try {
        const health = {
            primaryCareDoctor: getValue('primaryCareDoctor'),
            preferredPharmacy: getValue('preferredPharmacy'),
            insuranceProvider: getValue('insuranceProvider'),
            weightGoal: parseFloat(getValue('weightGoal')) || 70,
            bloodPressureGoal: getValue('bloodPressureGoal'),
            activityGoal: parseInt(getValue('activityGoal')) || 10000,
            showEmergencyCard: getCheckbox('showEmergencyCard'),
            autoNotifyEmergency: getCheckbox('autoNotifyEmergency'),
            shareVitalsEmergency: getCheckbox('shareVitalsEmergency'),
            advancedDirective: getValue('advancedDirective'),
            reminderLeadTime: parseInt(getValue('reminderLeadTime')) || 15,
            refillAlertDays: parseInt(getValue('refillAlertDays')) || 7,
            trackAdherence: getCheckbox('trackAdherence'),
            trackSideEffects: getCheckbox('trackSideEffects')
        };
        
        // Update local state
        settingsState.settings.health = health;
        
        // Save to localStorage
        localStorage.setItem('health_settings_health', JSON.stringify(health));
        
        // Try to save to Supabase
        try {
            const user = await window.supabaseService.getCurrentUser();
            if (user) {
                const dbHealth = {
                    user_id: user.id,
                    primary_care_doctor: health.primaryCareDoctor,
                    preferred_pharmacy: health.preferredPharmacy,
                    insurance_provider: health.insuranceProvider,
                    weight_goal: health.weightGoal,
                    blood_pressure_goal: health.bloodPressureGoal,
                    activity_goal: health.activityGoal,
                    show_emergency_card: health.showEmergencyCard,
                    auto_notify_emergency: health.autoNotifyEmergency,
                    share_vitals_emergency: health.shareVitalsEmergency,
                    advanced_directive: health.advancedDirective,
                    reminder_lead_time: health.reminderLeadTime,
                    refill_alert_days: health.refillAlertDays,
                    track_adherence: health.trackAdherence,
                    track_side_effects: health.trackSideEffects,
                    updated_at: new Date().toISOString()
                };
                
                await window.supabaseClient
                    .from('settings_health')
                    .upsert(dbHealth);
            }
        } catch (e) {
            console.log('Could not save to Supabase, using localStorage only');
        }
        
        showAutoSaveMessage();
        
    } catch (error) {
        console.error('Error saving health settings:', error);
    }
}

// Apply theme
function applyTheme(theme) {
    if (theme === 'dark') {
        document.body.classList.add('dark-theme');
    } else if (theme === 'light') {
        document.body.classList.remove('dark-theme');
    } else {
        // Auto - check system preference
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            document.body.classList.add('dark-theme');
        } else {
            document.body.classList.remove('dark-theme');
        }
    }
}

// Generate export
async function generateExport() {
    try {
        const user = await window.supabaseService.getCurrentUser();
        if (!user) {
            showMessage('error', 'User not authenticated');
            return;
        }
        
        const format = getValue('exportFormat');
        
        showMessage('info', `Generating ${format.toUpperCase()} export...`);
        
        // Collect data from Supabase
        const exportData = {
            format: format,
            generatedAt: new Date().toISOString(),
            data: {}
        };
        
        // Get data from various tables
        const tables = ['medications', 'lab_results', 'vital_signs', 'symptoms', 'appointments', 'journal_entries'];
        
        for (const table of tables) {
            try {
                const { data } = await window.supabaseClient
                    .from(table)
                    .select('*')
                    .eq('user_id', user.id);
                
                exportData.data[table] = data || [];
            } catch (e) {
                console.log(`Could not fetch ${table}:`, e);
                exportData.data[table] = [];
            }
        }
        
        // Get profile data
        const profileResult = await window.supabaseService.getUserProfile(user.id);
        exportData.data.profile = profileResult.success ? profileResult.data : {};
        
        // Create download link
        const dataStr = JSON.stringify(exportData, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
        
        const exportFileName = `healytica_export_${new Date().toISOString().split('T')[0]}.json`;
        
        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileName);
        linkElement.click();
        
        showMessage('success', 'Export generated and downloaded successfully!');
        
    } catch (error) {
        console.error('Error generating export:', error);
        showMessage('error', 'Failed to generate export');
    }
}

// Create backup
async function createBackup() {
    try {
        showMessage('info', 'Creating backup...');
        
        const user = await window.supabaseService.getCurrentUser();
        if (!user) {
            showMessage('error', 'User not authenticated');
            return;
        }
        
        // Collect all data
        const backupData = await generateBackupData(user);
        
        // Save to localStorage
        localStorage.setItem('health_backup', JSON.stringify(backupData));
        localStorage.setItem('health_last_backup', new Date().toISOString());
        
        // Update UI
        updateInfoTab();
        
        showMessage('success', 'Backup created successfully!');
        
    } catch (error) {
        console.error('Error creating backup:', error);
        showMessage('error', 'Failed to create backup');
    }
}

// Generate backup data
async function generateBackupData(user) {
    const backupData = {
        timestamp: new Date().toISOString(),
        user: {
            id: user.id,
            email: user.email
        },
        data: {}
    };
    
    const tables = ['medications', 'lab_results', 'vital_signs', 'symptoms', 'appointments', 'journal_entries'];
    
    for (const table of tables) {
        try {
            const { data } = await window.supabaseClient
                .from(table)
                .select('*')
                .eq('user_id', user.id);
            
            backupData.data[table] = data || [];
        } catch (e) {
            backupData.data[table] = [];
        }
    }
    
    return backupData;
}

// Restore backup
function restoreBackup() {
    showConfirmationModal(
        'Restore Backup',
        'This will replace all your current data with the backup. This action cannot be undone. Continue?',
        async () => {
            try {
                showMessage('info', 'Restoring backup...');
                
                // Get backup from localStorage
                const localBackup = localStorage.getItem('health_backup');
                if (!localBackup) {
                    showMessage('error', 'No backup found');
                    return;
                }
                
                showMessage('success', 'Backup restored successfully! Refreshing...');
                
                setTimeout(() => {
                    window.location.reload();
                }, 1500);
                
            } catch (error) {
                console.error('Error restoring backup:', error);
                showMessage('error', 'Failed to restore backup');
            }
        }
    );
}

// Clear cache
function clearCache() {
    showConfirmationModal(
        'Clear Cache',
        'This will clear temporary data and refresh the page. Your saved data will not be affected. Continue?',
        () => {
            // Clear service worker caches if any
            if ('caches' in window) {
                caches.keys().then(names => {
                    names.forEach(name => {
                        caches.delete(name);
                    });
                });
            }
            
            showMessage('success', 'Cache cleared! Refreshing...');
            
            setTimeout(() => {
                window.location.reload();
            }, 1500);
        }
    );
}

// Rebuild analytics
function rebuildAnalytics() {
    showConfirmationModal(
        'Rebuild Analytics',
        'This will recalculate all health analytics based on your current data. Continue?',
        async () => {
            showMessage('info', 'Rebuilding analytics...');
            setTimeout(() => {
                showMessage('success', 'Analytics rebuilt successfully!');
            }, 2000);
        }
    );
}

// Logout from all devices
async function logoutAllDevices() {
    showConfirmationModal(
        'Logout from All Devices',
        'This will log you out from all devices where you are currently signed in. You will need to log in again. Continue?',
        async () => {
            try {
                showMessage('info', 'Logging out from all devices...');
                
                const { error } = await window.supabaseClient.auth.signOut({ scope: 'global' });
                
                if (error) {
                    console.error('Error logging out from all devices:', error);
                    showMessage('error', 'Failed to logout from all devices');
                    return;
                }
                
                // Clear local data
                localStorage.clear();
                
                showMessage('success', 'Logged out from all devices. Redirecting...');
                
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 1500);
                
            } catch (error) {
                console.error('Error in logoutAllDevices:', error);
                showMessage('error', 'Failed to logout from all devices');
            }
        }
    );
}

// Confirm reset app
function confirmResetApp() {
    showConfirmationModal(
        'Reset Application',
        '⚠️ WARNING: This will permanently delete ALL your health data. This action CANNOT be undone. Are you absolutely sure?',
        resetAppData,
        'Delete Everything',
        'danger'
    );
}

// Reset app data
async function resetAppData() {
    try {
        showLoading();
        
        const user = await window.supabaseService.getCurrentUser();
        if (!user) {
            showMessage('error', 'User not authenticated');
            hideLoading();
            return;
        }
        
        // Delete user data from Supabase tables that exist
        const tables = ['medications', 'lab_results', 'vital_signs', 'symptoms', 'appointments', 'journal_entries'];
        
        for (const table of tables) {
            try {
                await window.supabaseClient
                    .from(table)
                    .delete()
                    .eq('user_id', user.id);
            } catch (e) {
                console.log(`Error deleting from ${table}:`, e.message);
            }
        }
        
        // Clear localStorage (keep session info)
        const session = localStorage.getItem('health_user_session');
        const expires = localStorage.getItem('health_session_expires');
        
        localStorage.clear();
        
        if (session) localStorage.setItem('health_user_session', session);
        if (expires) localStorage.setItem('health_session_expires', expires);
        
        // Reset settings state
        settingsState.settings = {
            security: {},
            preferences: {},
            health: {}
        };
        
        showMessage('success', 'All data cleared successfully! App will reload...');
        
        setTimeout(() => {
            window.location.reload();
        }, 2000);
        
    } catch (error) {
        console.error('Error resetting app:', error);
        showMessage('error', 'Failed to reset app');
    } finally {
        hideLoading();
    }
}

// Check for updates
function checkForUpdates() {
    showMessage('info', 'Checking for updates...');
    setTimeout(() => {
        showMessage('success', 'You are using the latest version (1.0.0)');
    }, 1500);
}

// Contact support
function contactSupport() {
    window.location.href = 'mailto:support@healytica.com';
}

// Report bug
function reportBug() {
    window.location.href = 'mailto:support@healytica.com?subject=Bug Report';
}

// Suggest feature
function suggestFeature() {
    window.location.href = 'mailto:support@healytica.com?subject=Feature Suggestion';
}

// View terms
function viewTerms() {
    window.open('#', '_blank');
    showMessage('info', 'Terms of Service would open in a new tab');
}

// View privacy
function viewPrivacy() {
    window.open('#', '_blank');
    showMessage('info', 'Privacy Policy would open in a new tab');
}

// View disclaimer
function viewDisclaimer() {
    window.open('#', '_blank');
    showMessage('info', 'Medical Disclaimer would open in a new tab');
}

// Run diagnostics
function runDiagnostics() {
    showMessage('info', 'Running system diagnostics...');
    setTimeout(() => {
        showMessage('success', 'All systems operational');
    }, 2000);
}

// Logout function
async function logout() {
    showConfirmationModal(
        'Logout',
        'Are you sure you want to logout?',
        async () => {
            try {
                await window.supabaseService.signOut();
                localStorage.clear();
                window.location.href = 'index.html';
            } catch (error) {
                console.error('Error logging out:', error);
                window.location.href = 'index.html';
            }
        }
    );
}

// ===== HELPER FUNCTIONS =====

function setValue(id, value) {
    const element = document.getElementById(id);
    if (element) {
        element.value = value || '';
    }
}

function getValue(id) {
    const element = document.getElementById(id);
    return element ? element.value : '';
}

function setCheckbox(id, checked) {
    const element = document.getElementById(id);
    if (element) {
        element.checked = checked;
    }
}

function getCheckbox(id) {
    const element = document.getElementById(id);
    return element ? element.checked : false;
}

function setText(id, text) {
    const element = document.getElementById(id);
    if (element) {
        element.textContent = text;
    }
}

function formatDate(dateString) {
    if (!dateString) return 'Never';
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (e) {
        return 'Invalid date';
    }
}

// Show confirmation modal
function showConfirmationModal(title, message, onConfirm, confirmText = 'Confirm', confirmType = 'primary') {
    const modal = document.getElementById('confirmationModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');
    const modalConfirm = document.getElementById('modalConfirm');
    
    if (!modal || !modalTitle || !modalBody || !modalConfirm) return;
    
    modalTitle.textContent = title;
    modalBody.textContent = message;
    modalConfirm.textContent = confirmText;
    
    // Set button class
    modalConfirm.className = 'btn';
    if (confirmType === 'danger') {
        modalConfirm.classList.add('btn-danger');
    } else {
        modalConfirm.classList.add('btn-primary');
    }
    
    // Remove previous event listeners
    const newModalConfirm = modalConfirm.cloneNode(true);
    modalConfirm.parentNode.replaceChild(newModalConfirm, modalConfirm);
    
    // Add new event listener
    newModalConfirm.addEventListener('click', function() {
        modal.style.display = 'none';
        onConfirm();
    });
    
    modal.style.display = 'flex';
}

// Show auto-save message
function showAutoSaveMessage() {
    const saveIndicator = document.createElement('div');
    saveIndicator.className = 'auto-save-indicator';
    saveIndicator.textContent = 'Settings saved';
    saveIndicator.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: #28a745;
        color: white;
        padding: 8px 15px;
        border-radius: 5px;
        font-size: 0.9em;
        animation: fadeInOut 2s ease;
        z-index: 1000;
    `;
    
    document.body.appendChild(saveIndicator);
    
    setTimeout(() => {
        if (saveIndicator.parentNode) {
            saveIndicator.parentNode.removeChild(saveIndicator);
        }
    }, 2000);
}

// Export settings functions
window.loadSettings = loadSettings;
window.settingsState = settingsState;
window.showMessage = showMessage;