// profile.js - SURGICAL FIXES ONLY
// ==================================
// FIXES:
// FIX 1: setupProfileUI() stub filled in — populates all form fields from profileState
// FIX 2: Duplicate setupProfileListeners() removed — kept the coordinator version only
// FIX 3: Duplicate saveProfile() removed — kept the better version (with switchToTab)
// FIX 4: setupDocumentListeners() now always called from the coordinator
// FIX 5: updateDocumentsList() re-runs when documents tab is clicked (hidden grid fix)
// FIX 6: generateQRCode() now renders a real QR code via qrcode.js CDN
// FIX 7: shareProfile() copies a formatted summary to clipboard
// FIX 8: printProfile() auto-triggers window.print() after open

// Profile state
const profileState = {
    currentProfile: null,
    conditions: [],
    contacts: [],
    documents: [],
    isEditing: false
};

// Initialize tabs properly
function initializeTabs() {
    console.log('Initializing tabs...');

    const tabs  = document.querySelectorAll('.profile-tab');
    const forms = document.querySelectorAll('.profile-form');

    // Ensure all forms are hidden initially
    forms.forEach(form => {
        form.classList.remove('active');
        form.style.display = 'none';
    });

    tabs.forEach(tab => {
        tab.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('Tab clicked:', this.dataset.tab);

            tabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');

            forms.forEach(form => {
                form.classList.remove('active');
                form.style.display = 'none';
            });

            const tabId      = this.dataset.tab;
            const targetForm = document.getElementById(`${tabId}Form`);

            if (targetForm) {
                targetForm.classList.add('active');
                targetForm.style.display = 'block';
                console.log('Showing form:', targetForm.id);

                // FIX 5: Re-render documents list when documents tab is opened
                // so it renders into the now-visible grid, not a hidden one
                if (tabId === 'documents') {
                    updateDocumentsList();
                    updateDocumentsCount();
                }
            } else {
                console.error('Form not found for tab:', tabId);
            }
        });
    });

    // Activate the first tab by default
    if (tabs.length > 0) {
        const firstTab  = tabs[0];
        firstTab.classList.add('active');
        const firstForm = document.getElementById(`${firstTab.dataset.tab}Form`);
        if (firstForm) {
            firstForm.classList.add('active');
            firstForm.style.display = 'block';
        }
    }
}

// Load profile data from Supabase
async function loadProfileData(userId) {
    try {
        console.log('Loading profile data for user:', userId);

        const result = await supabaseService.getUserProfile(userId);
        console.log('Profile load result:', result);

        if (result && result.success) {
            profileState.currentProfile = result.data;
            if (!profileState.currentProfile) {
                profileState.currentProfile = supabaseService.createEmptyProfile(userId);
                console.log('Created empty profile for new user');
            }
            console.log('Profile data loaded:', profileState.currentProfile);
        } else {
            console.error('Failed to load profile:', result ? result.error : 'No result returned');
            profileState.currentProfile = supabaseService.createEmptyProfile(userId);
        }

    } catch (error) {
        console.error('Error loading profile data:', error);
        profileState.currentProfile = supabaseService.createEmptyProfile(userId);
        throw error;
    }
}

// Initialize profile page
async function loadProfile(user) {
    console.log('Loading profile page...', user.email);

    showLoading();

    try {
        await loadProfileData(user.id);
        setupProfileUI();       // FIX 1: now actually populates fields
        initializeTabs();
        setupProfileListeners(user); // FIX 2: single coordinator, no duplicate
        await loadDocuments(user.id);
        calculateProfileCompletion();

    } catch (error) {
        console.error('Error loading profile:', error);
        showMessage('error', 'Failed to load profile data: ' + error.message);
    } finally {
        hideLoading();
    }
}

// FIX 1: setupProfileUI — actually populates all form fields from profileState
function setupProfileUI() {
    const profile = profileState.currentProfile;
    if (!profile) return;

    // Personal tab
    setVal('fullName',    profile.full_name);
    setVal('email',       profile.email);
    setVal('phone',       profile.phone);
    setVal('gender',      profile.gender);
    setVal('dob',         profile.date_of_birth);
    setVal('bloodType',   profile.blood_type);
    setVal('address',     profile.address);

    // Medical tab
    setVal('allergies',     profile.allergies);
    setVal('medicalHistory', profile.medical_history);

    // Conditions
    try {
        profileState.conditions = profile.medical_conditions
            ? JSON.parse(profile.medical_conditions)
            : [];
    } catch (e) {
        profileState.conditions = [];
    }
    updateConditionsList();

    // Emergency tab
    setVal('emergencyName',     profile.emergency_contact);
    setVal('emergencyRelation', profile.emergency_relation);
    setVal('emergencyPhone',    profile.emergency_phone);
    setVal('emergencyEmail',    profile.emergency_email);
    setVal('emergencyNotes',    profile.emergency_notes);

    // Additional contacts
    try {
        profileState.contacts = profile.emergency_contacts
            ? JSON.parse(profile.emergency_contacts)
            : [];
    } catch (e) {
        profileState.contacts = [];
    }
    updateContactsList();

    // Update last updated display
    updateLastUpdatedDisplay();

    // Add per-tab save buttons
    ensureSaveButtonInAllTabs();
}

// Helper: safely set element value
function setVal(id, value) {
    const el = document.getElementById(id);
    if (el && value !== undefined && value !== null) {
        el.value = value;
    }
}

// FIX 2: Single coordinator setupProfileListeners — no duplicate
function setupProfileListeners(user) {
    setupFormListeners(user);
    setupConditionListeners();
    setupContactListeners();
    setupDocumentListeners();   // FIX 4: now always called
    setupQuickActionListeners();
    setupHeaderButtonListeners();
}

// Setup form save/cancel
function setupFormListeners(user) {
    const saveBtn   = document.getElementById('saveProfileBtn');
    const cancelBtn = document.getElementById('cancelBtn');

    if (saveBtn) {
        // Clone to remove any duplicate listeners added by inline HTML script
        const newSaveBtn = saveBtn.cloneNode(true);
        saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
        newSaveBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            console.log('Save button clicked');
            await saveProfile(user);
        });
    }

    if (cancelBtn) {
        const newCancelBtn = cancelBtn.cloneNode(true);
        cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
        newCancelBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to cancel? Any unsaved changes will be lost.')) {
                setupProfileUI();
                showMessage('info', 'Changes discarded');
            }
        });
    }

    // Enter-key save in non-textarea inputs
    document.querySelectorAll('.profile-form input, .profile-form select').forEach(input => {
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                document.getElementById('saveProfileBtn')?.click();
            }
        });
    });
}

// FIX 3: Single saveProfile definition (merged best of both)
async function saveProfile(user) {
    console.log('Saving profile for user:', user?.id);

    if (!user || !user.id) {
        showMessage('error', 'User not authenticated. Please log in again.');
        return;
    }

    const currentUser = await supabaseService.getCurrentUser();
    if (!currentUser) {
        showMessage('error', 'Please log in again');
        window.location.href = 'index.html';
        return;
    }

    const profileData = {
        user_id:            user.id,
        full_name:          getValueById('fullName')          || '',
        email:              getValueById('email')             || user.email || '',
        phone:              getValueById('phone')             || '',
        gender:             getValueById('gender')            || '',
        date_of_birth:      getValueById('dob')               || '',
        blood_type:         getValueById('bloodType')         || '',
        address:            getValueById('address')           || '',
        allergies:          getValueById('allergies')         || '',
        medical_history:    getValueById('medicalHistory')    || '',
        emergency_contact:  getValueById('emergencyName')     || '',
        emergency_relation: getValueById('emergencyRelation') || '',
        emergency_phone:    getValueById('emergencyPhone')    || '',
        emergency_email:    getValueById('emergencyEmail')    || '',
        emergency_notes:    getValueById('emergencyNotes')    || '',
        medical_conditions: JSON.stringify(profileState.conditions),
        emergency_contacts: JSON.stringify(profileState.contacts),
        updated_at:         new Date().toISOString()
    };

    if (!profileData.full_name) {
        showMessage('error', 'Full name is required');
        switchToTab('personal');
        document.getElementById('fullName')?.focus();
        return;
    }

    showLoading();

    try {
        const result = await supabaseService.updateUserProfile(user.id, profileData);
        console.log('Supabase response:', result);

        if (result.success) {
            profileState.currentProfile = {
                ...profileState.currentProfile,
                ...profileData,
                id: result.data?.[0]?.id || profileState.currentProfile?.id
            };
            calculateProfileCompletion();
            updateLastUpdatedDisplay();
            showMessage('success', 'Profile saved successfully!');
        } else {
            throw new Error(result.error || 'Failed to save profile');
        }
    } catch (error) {
        console.error('Error saving profile:', error);
        showMessage('error', 'Failed to save profile: ' + error.message);
    } finally {
        hideLoading();
    }
}

// Helper: get element value trimmed
function getValueById(id) {
    const el = document.getElementById(id);
    return el ? el.value.trim() : '';
}

// Switch to a specific tab programmatically
function switchToTab(tabId) {
    const tab = document.querySelector(`[data-tab="${tabId}"]`);
    if (tab) tab.click();
}

// Per-tab save buttons
function ensureSaveButtonInAllTabs() {
    ['personal', 'medical', 'emergency', 'documents'].forEach(tabId => {
        const form = document.getElementById(`${tabId}Form`);
        if (form && !form.querySelector('.save-profile-btn')) {
            const saveBtn        = document.createElement('button');
            saveBtn.type         = 'button';
            saveBtn.className    = 'btn btn-primary save-profile-btn';
            saveBtn.innerHTML    = '<i class="fas fa-save"></i> Save Changes';
            saveBtn.style.cssText = 'margin-top:20px; width:100%; padding:12px; background:#1e3c72; color:white; border:none; border-radius:8px; cursor:pointer; font-size:1em; font-weight:600;';

            saveBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                const u = await supabaseService.getCurrentUser();
                if (u) await saveProfile(u);
            });

            form.appendChild(saveBtn);
        }
    });
}

// Setup medical condition listeners
function setupConditionListeners() {
    const addConditionBtn  = document.getElementById('addConditionBtn');
    const newConditionInput = document.getElementById('newCondition');

    if (addConditionBtn && newConditionInput) {
        addConditionBtn.addEventListener('click', () => {
            const condition = newConditionInput.value.trim();
            if (condition) {
                addCondition(condition);
                newConditionInput.value = '';
                newConditionInput.focus();
            } else {
                showMessage('warning', 'Please enter a condition');
            }
        });

        newConditionInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                addConditionBtn.click();
            }
        });
    }
}

function addCondition(condition) {
    if (!condition) return;
    if (profileState.conditions.includes(condition)) {
        showMessage('warning', 'Condition already exists');
        return;
    }
    profileState.conditions.push(condition);
    updateConditionsList();
    calculateProfileCompletion();
    showMessage('success', 'Condition added');
}

function removeCondition(index) {
    if (index >= 0 && index < profileState.conditions.length) {
        const removed = profileState.conditions.splice(index, 1);
        updateConditionsList();
        calculateProfileCompletion();
        showMessage('info', `Removed: ${removed[0]}`);
    }
}

function updateConditionsList() {
    const conditionsList = document.getElementById('conditionsList');
    if (!conditionsList) return;

    conditionsList.innerHTML = '';

    if (profileState.conditions.length === 0) {
        conditionsList.innerHTML = `
            <div style="text-align:center;padding:20px;color:#666;">
                <i class="fas fa-clipboard-list" style="font-size:2em;margin-bottom:10px;display:block;"></i>
                <p>No medical conditions added yet</p>
                <p style="font-size:0.9em;">Add conditions using the input below</p>
            </div>`;
        return;
    }

    profileState.conditions.forEach((condition, index) => {
        const item = document.createElement('div');
        item.className = 'condition-item';
        item.innerHTML = `
            <span class="condition-name">${condition}</span>
            <button class="condition-remove" data-index="${index}"><i class="fas fa-times"></i></button>`;
        conditionsList.appendChild(item);
    });

    conditionsList.querySelectorAll('.condition-remove').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const index = parseInt(btn.dataset.index);
            if (!isNaN(index)) removeCondition(index);
        });
    });
}

// Setup emergency contact listeners
function setupContactListeners() {
    const addContactBtn = document.getElementById('addContactBtn');
    if (addContactBtn) {
        addContactBtn.addEventListener('click', (e) => {
            e.preventDefault();
            addContact();
        });
    }
}

function addContact() {
    profileState.contacts.push({ id: Date.now(), name: '', relationship: '', phone: '', email: '' });
    updateContactsList();
    showMessage('info', 'New contact added — fill in the details');
}

function removeContact(id) {
    const idx = profileState.contacts.findIndex(c => c.id === id);
    if (idx !== -1) {
        const removed = profileState.contacts.splice(idx, 1)[0];
        updateContactsList();
        showMessage('info', `Removed contact: ${removed.name || 'Unnamed contact'}`);
    }
}

function updateContactsList() {
    const contactsList = document.getElementById('additionalContacts');
    if (!contactsList) return;

    contactsList.innerHTML = '';

    if (profileState.contacts.length === 0) {
        contactsList.innerHTML = `
            <div style="text-align:center;padding:20px;color:#666;">
                <i class="fas fa-users" style="font-size:2em;margin-bottom:10px;display:block;"></i>
                <p>No additional contacts added yet</p>
                <p style="font-size:0.9em;">Click "Add Another Contact" to add emergency contacts</p>
            </div>`;
        return;
    }

    profileState.contacts.forEach((contact, index) => {
        const card = document.createElement('div');
        card.className = 'contact-card';
        card.innerHTML = `
            <div class="contact-header">
                <div class="contact-title">Emergency Contact ${index + 2}</div>
                <button class="contact-remove" data-id="${contact.id}"><i class="fas fa-trash-alt"></i></button>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <input type="text" placeholder="Full Name" value="${contact.name || ''}"
                           data-id="${contact.id}" data-field="name" class="contact-input">
                </div>
                <div class="form-group">
                    <select data-id="${contact.id}" data-field="relationship" class="contact-input">
                        <option value="">Relationship</option>
                        ${['Spouse','Parent','Child','Sibling','Friend','Other'].map(r =>
                            `<option value="${r}" ${contact.relationship === r ? 'selected' : ''}>${r}</option>`
                        ).join('')}
                    </select>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <input type="tel" placeholder="Phone Number" value="${contact.phone || ''}"
                           data-id="${contact.id}" data-field="phone" class="contact-input">
                </div>
                <div class="form-group">
                    <input type="email" placeholder="Email" value="${contact.email || ''}"
                           data-id="${contact.id}" data-field="email" class="contact-input">
                </div>
            </div>`;
        contactsList.appendChild(card);
    });

    contactsList.querySelectorAll('.contact-remove').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const id = parseInt(btn.dataset.id);
            if (!isNaN(id)) removeContact(id);
        });
    });

    contactsList.querySelectorAll('.contact-input').forEach(input => {
        const updateContact = (e) => {
            const id    = parseInt(e.target.dataset.id);
            const field = e.target.dataset.field;
            if (!isNaN(id)) {
                const contact = profileState.contacts.find(c => c.id === id);
                if (contact) contact[field] = e.target.value;
            }
        };
        input.addEventListener('change', updateContact);
        input.addEventListener('input',  updateContact);
    });
}

// FIX 4: setupDocumentListeners — unchanged logic, now always called
function setupDocumentListeners() {
    const uploadArea = document.getElementById('uploadArea');
    const fileInput  = document.getElementById('documentUpload');

    if (uploadArea && fileInput) {
        uploadArea.addEventListener('click', () => fileInput.click());

        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.style.borderColor = '#1e3c72';
            uploadArea.style.background  = '#e7f3ff';
        });

        uploadArea.addEventListener('dragleave', () => {
            uploadArea.style.borderColor = '#ddd';
            uploadArea.style.background  = '#f8f9fa';
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.style.borderColor = '#ddd';
            uploadArea.style.background  = '#f8f9fa';
            handleDocumentUpload(e.dataTransfer.files);
        });

        fileInput.addEventListener('change', (e) => {
            handleDocumentUpload(e.target.files);
            e.target.value = '';
        });
    }
}

// Handle document upload with progress indication
async function handleDocumentUpload(files) {
    if (!files || files.length === 0) return;

    const user = await supabaseService.getCurrentUser();
    if (!user) {
        showMessage('error', 'Please log in to upload documents');
        return;
    }

    const uploadArea = document.getElementById('uploadArea');
    const originalHTML = uploadArea ? uploadArea.innerHTML : '';

    showLoading();

    try {
        for (let i = 0; i < files.length; i++) {
            const file = files[i];

            // Show file being uploaded
            if (uploadArea) {
                uploadArea.innerHTML = `
                    <i class="fas fa-spinner fa-spin"></i>
                    <div class="upload-text">
                        <h4>Uploading ${i + 1} of ${files.length}</h4>
                        <p>${file.name}</p>
                    </div>`;
            }

            if (file.size > 10 * 1024 * 1024) {
                showMessage('error', `"${file.name}" is too large (max 10MB)`);
                continue;
            }

            const result = await supabaseService.uploadDocument(user.id, file);

            if (result.success) {
                showMessage('success', `Uploaded: ${file.name}`);
            } else {
                showMessage('error', `Failed to upload ${file.name}: ${result.error}`);
            }
        }

        // Reload documents list
        await loadDocuments(user.id);

        // Switch to documents tab so user sees the uploaded file
        switchToTab('documents');

    } catch (error) {
        console.error('Upload error:', error);
        showMessage('error', 'Upload failed: ' + error.message);
    } finally {
        // Restore upload area
        if (uploadArea) uploadArea.innerHTML = originalHTML;
        // Re-bind click since innerHTML was replaced
        setupDocumentListeners();
        hideLoading();
    }
}

// Load documents from Supabase
async function loadDocuments(userId) {
    try {
        const result = await supabaseService.getUserDocuments(userId);

        if (result.success) {
            profileState.documents = result.data || [];
            updateDocumentsList();
            updateDocumentsCount();
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        console.error('Error loading documents:', error);
        showMessage('error', 'Failed to load documents');
    }
}

// FIX 5: updateDocumentsList renders correctly whether grid is visible or not
function updateDocumentsList() {
    const documentsGrid = document.getElementById('documentsGrid');
    if (!documentsGrid) return;

    documentsGrid.innerHTML = '';

    if (profileState.documents.length === 0) {
        documentsGrid.innerHTML = `
            <div class="empty-state" style="grid-column:1/-1;text-align:center;padding:40px;">
                <i class="fas fa-file-medical" style="font-size:3em;color:#ccc;margin-bottom:15px;display:block;"></i>
                <p style="color:#666;margin:0;">No documents uploaded yet</p>
            </div>`;
        return;
    }

    profileState.documents.forEach(doc => {
        const card  = document.createElement('div');
        card.className = 'document-card';

        const icon = getDocumentIcon(doc.file_type || doc.file_name);
        const date = doc.uploaded_at ? new Date(doc.uploaded_at).toLocaleDateString() : 'Unknown date';
        const size = formatFileSize(doc.file_size);

        card.innerHTML = `
            <div class="document-icon"><i class="${icon}"></i></div>
            <div class="document-info">
                <div class="document-name">${doc.file_name || 'Document'}</div>
                <div class="document-date">Uploaded: ${date}</div>
                ${size ? `<div class="document-size">${size}</div>` : ''}
            </div>
            <div class="document-actions">
                <button class="btn-icon view-document"     data-id="${doc.id}" title="View"><i class="fas fa-eye"></i></button>
                <button class="btn-icon download-document" data-id="${doc.id}" data-path="${doc.file_path}" title="Download"><i class="fas fa-download"></i></button>
                <button class="btn-icon delete-document"   data-id="${doc.id}" title="Delete"><i class="fas fa-trash-alt"></i></button>
            </div>`;
        documentsGrid.appendChild(card);
    });

    setupDocumentActionListeners();
}

function getDocumentIcon(fileTypeOrName) {
    if (!fileTypeOrName) return 'fas fa-file';
    const t = fileTypeOrName.toLowerCase();
    if (t.includes('pdf'))                                               return 'fas fa-file-pdf';
    if (t.includes('image') || t.includes('jpg') || t.includes('png')) return 'fas fa-file-image';
    if (t.includes('word') || t.includes('doc'))                        return 'fas fa-file-word';
    return 'fas fa-file';
}

function formatFileSize(bytes) {
    if (!bytes) return '';
    const units = ['B','KB','MB','GB'];
    let size = bytes, unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) { size /= 1024; unitIndex++; }
    return `${size.toFixed(1)} ${units[unitIndex]}`;
}

function setupDocumentActionListeners() {
    // View
    document.querySelectorAll('.view-document').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const button = e.target.closest('button');
            const docId  = button.dataset.id;
            const doc    = profileState.documents.find(d => d.id == docId);
            if (doc) {
                try {
                    const result = await supabaseService.getDocumentUrl(doc.file_path);
                    if (result.success) window.open(result.url, '_blank');
                    else showMessage('error', 'Cannot view document: ' + result.error);
                } catch (error) {
                    showMessage('error', 'Failed to view document');
                }
            }
        });
    });

    // Download
    document.querySelectorAll('.download-document').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const button   = e.target.closest('button');
            const docId    = button.dataset.id;
            const filePath = button.dataset.path;
            const doc      = profileState.documents.find(d => d.id == docId);
            if (doc) {
                try {
                    const result = await supabaseService.downloadDocument(filePath, doc.file_name);
                    if (!result.success) showMessage('error', 'Cannot download: ' + result.error);
                } catch (error) {
                    showMessage('error', 'Failed to download document');
                }
            }
        });
    });

    // Delete
    document.querySelectorAll('.delete-document').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const button = e.target.closest('button');
            const docId  = button.dataset.id;
            const doc    = profileState.documents.find(d => d.id == docId);
            if (doc && confirm(`Delete "${doc.file_name}"?`)) {
                try {
                    const user   = await supabaseService.getCurrentUser();
                    const result = await supabaseService.deleteDocument(docId, doc.file_path);
                    if (result.success) {
                        showMessage('success', 'Document deleted successfully');
                        await loadDocuments(user.id);
                    } else {
                        throw new Error(result.error);
                    }
                } catch (error) {
                    showMessage('error', 'Failed to delete document');
                }
            }
        });
    });
}

// FIX 6 & 7: Quick action listeners with real implementations
function setupQuickActionListeners() {
    const actions = {
        shareProfileBtn:  'shareProfile',
        exportProfileBtn: 'exportProfile',
        qrCodeBtn:        'generateQRCode',
        backupProfileBtn: 'backupData'
    };

    Object.entries(actions).forEach(([id, action]) => {
        const btn = document.getElementById(id);
        if (btn) {
            // Clone to remove any "Feature coming soon" listener from HTML inline script
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);
            newBtn.addEventListener('click', () => handleQuickAction(action));
        }
    });
}

async function handleQuickAction(action) {
    const user = await supabaseService.getCurrentUser();
    if (!user) { showMessage('error', 'Please log in first'); return; }

    switch (action) {
        case 'shareProfile':  await shareProfile();      break;
        case 'exportProfile':  exportProfile(user);      break;
        case 'generateQRCode': generateQRCode();         break;
        case 'backupData':    await backupData(user);    break;
    }
}

// FIX 7: shareProfile — copies formatted summary to clipboard
async function shareProfile() {
    if (!profileState.currentProfile) {
        showMessage('error', 'No profile data to share');
        return;
    }

    const p = profileState.currentProfile;
    const summary = [
        '=== HEALYTICA HEALTH PROFILE ===',
        `Name:        ${p.full_name       || 'Not set'}`,
        `Blood Type:  ${p.blood_type      || 'Not set'}`,
        `Gender:      ${p.gender          || 'Not set'}`,
        `DOB:         ${p.date_of_birth   || 'Not set'}`,
        '',
        '--- EMERGENCY CONTACT ---',
        `Name:        ${p.emergency_contact  || 'Not set'}`,
        `Relation:    ${p.emergency_relation || 'Not set'}`,
        `Phone:       ${p.emergency_phone    || 'Not set'}`,
        '',
        '--- MEDICAL ---',
        `Allergies:   ${p.allergies           || 'None listed'}`,
        `Conditions:  ${profileState.conditions.join(', ') || 'None listed'}`,
        '',
        `Generated: ${new Date().toLocaleString()} via Healytica Record`
    ].join('\n');

    try {
        await navigator.clipboard.writeText(summary);
        showMessage('success', 'Profile summary copied to clipboard — paste it to share with your provider!');
    } catch (err) {
        // Fallback for browsers that block clipboard
        const ta = document.createElement('textarea');
        ta.value = summary;
        ta.style.position = 'fixed';
        ta.style.opacity  = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        showMessage('success', 'Profile summary copied to clipboard!');
    }
}

// Export profile as JSON
function exportProfile(user) {
    if (!profileState.currentProfile) {
        showMessage('error', 'No profile data to export');
        return;
    }

    try {
        const exportData = {
            profile:     profileState.currentProfile,
            conditions:  profileState.conditions,
            contacts:    profileState.contacts,
            documents:   profileState.documents.map(d => ({
                name: d.file_name, type: d.file_type, size: d.file_size, uploaded: d.uploaded_at
            })),
            export_date: new Date().toISOString(),
            app_version: '1.0.0'
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = `health-profile-${user.email}-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showMessage('success', 'Profile exported successfully!');
    } catch (error) {
        showMessage('error', 'Failed to export profile');
    }
}

// FIX 6: generateQRCode — real QR code using qrcode.js CDN
function generateQRCode() {
    if (!profileState.currentProfile) {
        showMessage('error', 'Please complete your profile first');
        return;
    }

    const p = profileState.currentProfile;
    const emergencyData = JSON.stringify({
        name:       p.full_name,
        blood:      p.blood_type,
        allergies:  p.allergies,
        emergency:  p.emergency_contact,
        phone:      p.emergency_phone,
        conditions: profileState.conditions.join(', ')
    });

    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position:fixed; top:0; left:0; width:100%; height:100%;
        background:rgba(0,0,0,0.6); z-index:10000;
        display:flex; align-items:center; justify-content:center;`;

    overlay.innerHTML = `
        <div style="background:white; border-radius:12px; padding:30px; text-align:center; max-width:340px; width:90%;">
            <h3 style="margin:0 0 10px; color:#1e3c72;">Emergency QR Code</h3>
            <p style="color:#666; font-size:0.9em; margin-bottom:20px;">
                Scan to view emergency medical information
            </p>
            <div id="qrCodeCanvas" style="display:flex; justify-content:center; margin-bottom:20px;"></div>
            <p style="font-size:0.8em; color:#999; margin-bottom:20px;">
                Contains: name, blood type, allergies, emergency contact
            </p>
            <div style="display:flex; gap:10px; justify-content:center;">
                <button id="qrPrintBtn" style="padding:10px 20px; background:#1e3c72; color:white; border:none; border-radius:6px; cursor:pointer;">
                    <i class="fas fa-print"></i> Print
                </button>
                <button id="qrCloseBtn" style="padding:10px 20px; background:#f8f9fa; border:1px solid #ddd; border-radius:6px; cursor:pointer;">
                    Close
                </button>
            </div>
        </div>`;

    document.body.appendChild(overlay);

    // Load qrcode.js and render
    const script = document.createElement('script');
    script.src   = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
    script.onload = () => {
        try {
            new QRCode(document.getElementById('qrCodeCanvas'), {
                text:   emergencyData,
                width:  200,
                height: 200,
                colorDark:  '#1e3c72',
                colorLight: '#ffffff',
                correctLevel: QRCode.CorrectLevel.M
            });
        } catch (e) {
            document.getElementById('qrCodeCanvas').innerHTML =
                '<p style="color:#dc3545;">Failed to generate QR code</p>';
        }
    };
    script.onerror = () => {
        document.getElementById('qrCodeCanvas').innerHTML =
            '<p style="color:#dc3545;">QR library failed to load</p>';
    };
    document.head.appendChild(script);

    document.getElementById('qrCloseBtn').addEventListener('click', () => overlay.remove());
    document.getElementById('qrPrintBtn').addEventListener('click', () => window.print());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
}

// Backup data to Supabase
async function backupData(user) {
    try {
        showMessage('info', 'Creating backup...');

        const result = await supabaseService.createBackup(user.id, {
            user_id:         user.id,
            profile:         profileState.currentProfile,
            conditions:      profileState.conditions,
            contacts:        profileState.contacts,
            documents_count: profileState.documents.length,
            backup_date:     new Date().toISOString()
        });

        if (result.success) showMessage('success', 'Data backed up successfully!');
        else throw new Error(result.error);
    } catch (error) {
        showMessage('error', 'Backup failed: ' + error.message);
    }
}

// Header buttons
function setupHeaderButtonListeners() {
    const printBtn        = document.getElementById('printProfileBtn');
    const emergencyCardBtn = document.getElementById('emergencyCardBtn');

    if (printBtn) {
        // Clone to remove "Feature coming soon" listener from HTML inline script
        const newPrintBtn = printBtn.cloneNode(true);
        printBtn.parentNode.replaceChild(newPrintBtn, printBtn);
        newPrintBtn.addEventListener('click', () => printProfile());
    }

    if (emergencyCardBtn) {
        const newEmergBtn = emergencyCardBtn.cloneNode(true);
        emergencyCardBtn.parentNode.replaceChild(newEmergBtn, emergencyCardBtn);
        newEmergBtn.addEventListener('click', () => generateEmergencyCard());
    }
}

// FIX 8: printProfile auto-triggers print after open
function printProfile() {
    if (!profileState.currentProfile) {
        showMessage('error', 'No profile data to print');
        return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) { showMessage('error', 'Pop-up blocked — please allow pop-ups for this site'); return; }

    const p = profileState.currentProfile;
    printWindow.document.write(`
        <!DOCTYPE html><html><head>
        <title>Health Profile — ${p.full_name || 'Healytica'}</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
            .print-header { text-align:center; margin-bottom:30px; border-bottom:3px solid #1e3c72; padding-bottom:20px; }
            .section { margin-bottom:25px; page-break-inside:avoid; }
            .section-title { color:#1e3c72; border-bottom:2px solid #eee; padding-bottom:8px; margin-bottom:15px; }
            .info-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:15px; }
            .info-item { margin-bottom:10px; }
            .info-label { font-weight:bold; color:#666; }
            .emergency-box { border:2px solid #dc3545; border-radius:5px; padding:15px; margin:20px 0; background:#fff5f5; }
            @media print { .no-print { display:none; } }
        </style>
        </head><body>
        <div class="print-header">
            <h1 style="color:#1e3c72;margin:0;">Healytica Record</h1>
            <h2 style="margin:10px 0 0;">Health Profile</h2>
            <p style="color:#666;">Generated: ${new Date().toLocaleDateString()}</p>
        </div>
        <div class="section">
            <h3 class="section-title">Personal Information</h3>
            <div class="info-grid">
                <div class="info-item"><div class="info-label">Full Name</div><div>${p.full_name || 'Not set'}</div></div>
                <div class="info-item"><div class="info-label">Email</div><div>${p.email || 'Not set'}</div></div>
                <div class="info-item"><div class="info-label">Phone</div><div>${p.phone || 'Not set'}</div></div>
                <div class="info-item"><div class="info-label">Gender</div><div>${p.gender || 'Not set'}</div></div>
                <div class="info-item"><div class="info-label">Date of Birth</div><div>${p.date_of_birth || 'Not set'}</div></div>
                <div class="info-item"><div class="info-label">Blood Type</div><div>${p.blood_type || 'Not set'}</div></div>
                <div class="info-item" style="grid-column:1/-1;"><div class="info-label">Address</div><div>${p.address || 'Not set'}</div></div>
            </div>
        </div>
        <div class="section">
            <h3 class="section-title">Medical Information</h3>
            <div class="info-item"><div class="info-label">Allergies</div><div>${p.allergies || 'None listed'}</div></div>
            <div class="info-item"><div class="info-label">Medical History</div><div>${p.medical_history || 'None listed'}</div></div>
            <div class="info-item"><div class="info-label">Current Conditions</div><div>${profileState.conditions.join(', ') || 'None listed'}</div></div>
        </div>
        <div class="section">
            <div class="emergency-box">
                <h3 class="section-title" style="color:#dc3545;">Emergency Information</h3>
                <div class="info-item"><div class="info-label">Primary Contact</div><div>${p.emergency_contact || 'Not set'} (${p.emergency_relation || ''}) — ${p.emergency_phone || ''}</div></div>
            </div>
        </div>
        <script>setTimeout(() => window.print(), 400);<\/script>
        </body></html>`);
    printWindow.document.close();
}

// Generate emergency card
function generateEmergencyCard() {
    if (!profileState.currentProfile) {
        showMessage('error', 'Please complete your profile first');
        return;
    }

    const p           = profileState.currentProfile;
    const printWindow = window.open('', '_blank');
    if (!printWindow) { showMessage('error', 'Pop-up blocked — please allow pop-ups for this site'); return; }

    printWindow.document.write(`
        <!DOCTYPE html><html><head>
        <title>Emergency Card — ${p.full_name || ''}</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
            .card { border:2px solid #dc3545; border-radius:10px; padding:20px; max-width:400px; margin:0 auto; }
            .card-title { color:#dc3545; text-align:center; margin-bottom:15px; }
            .field { margin-bottom:12px; }
            .field-label { font-weight:bold; color:#666; font-size:0.9em; }
            .field-value { font-size:1em; color:#333; }
            @media print { .no-print{display:none;} }
        </style>
        </head><body>
        <div class="card">
            <h2 class="card-title">🚨 EMERGENCY MEDICAL CARD</h2>
            <div class="field"><div class="field-label">Name</div><div class="field-value">${p.full_name || 'Not set'}</div></div>
            <div class="field"><div class="field-label">Blood Type</div><div class="field-value">${p.blood_type || 'Unknown'}</div></div>
            <div class="field"><div class="field-label">Allergies</div><div class="field-value">${p.allergies || 'None listed'}</div></div>
            <div class="field"><div class="field-label">Conditions</div><div class="field-value">${profileState.conditions.join(', ') || 'None listed'}</div></div>
            <div class="field"><div class="field-label">Emergency Contact</div><div class="field-value">${p.emergency_contact || 'Not set'} — ${p.emergency_phone || 'No phone'}</div></div>
            <hr>
            <div style="text-align:center;color:#666;font-size:0.85em;">
                Healytica Record • Last updated: ${p.updated_at ? new Date(p.updated_at).toLocaleDateString() : 'Never'}
            </div>
        </div>
        <div class="no-print" style="text-align:center;margin-top:20px;">
            <button onclick="window.print()" style="padding:10px 20px;background:#1e3c72;color:white;border:none;border-radius:5px;cursor:pointer;">Print Emergency Card</button>
        </div>
        <script>setTimeout(() => window.print(), 400);<\/script>
        </body></html>`);
    printWindow.document.close();
}

// Profile completion
function calculateProfileCompletion() {
    let completion = 0;
    const maxPoints = 12;

    if (!profileState.currentProfile) { updateCompletionDisplay(0); return; }

    const p = profileState.currentProfile;
    if (p.full_name?.trim())          completion++;
    if (p.email?.trim())              completion++;
    if (p.phone?.trim())              completion++;
    if (p.gender?.trim())             completion++;
    if (p.date_of_birth?.trim())      completion++;
    if (p.blood_type?.trim())         completion++;
    if (p.address?.trim())            completion++;
    if (p.allergies?.trim())          completion++;
    if (p.emergency_contact?.trim())  completion++;
    if (p.medical_history?.trim())    completion++;
    if (profileState.conditions.length > 0) completion++;
    if (profileState.contacts.length  > 0)  completion++;

    updateCompletionDisplay(Math.min(100, Math.round((completion / maxPoints) * 100)));
}

function updateCompletionDisplay(percentage) {
    const bar  = document.getElementById('completionBar');
    const text = document.getElementById('completionText');
    const sidebarEl = document.getElementById('profileComplete');

    if (bar)        bar.style.width    = `${percentage}%`;
    if (text)       text.textContent   = `${percentage}%`;
    if (sidebarEl)  sidebarEl.textContent = `${percentage}%`;

    const emergencyStatus = document.getElementById('emergencyInfoStatus');
    if (emergencyStatus) {
        const hasEmergency = profileState.currentProfile?.emergency_contact?.trim();
        emergencyStatus.textContent  = hasEmergency ? 'Set' : 'Not Set';
        emergencyStatus.style.color  = hasEmergency ? '#28a745' : '#dc3545';
    }
}

function updateLastUpdatedDisplay() {
    const lastUpdateEl    = document.getElementById('lastUpdateTime');
    const sidebarUpdateEl = document.getElementById('lastUpdated');

    if (profileState.currentProfile?.updated_at) {
        const d = new Date(profileState.currentProfile.updated_at).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric'
        });
        if (lastUpdateEl)    lastUpdateEl.textContent    = d;
        if (sidebarUpdateEl) sidebarUpdateEl.textContent = d;
    } else {
        if (lastUpdateEl)    lastUpdateEl.textContent    = 'Never';
        if (sidebarUpdateEl) sidebarUpdateEl.textContent = 'Never';
    }
}

function updateDocumentsCount() {
    const el = document.getElementById('documentsCount');
    if (el) el.textContent = `${profileState.documents.length} ${profileState.documents.length === 1 ? 'file' : 'files'}`;
}

// Utilities
function showLoading() {
    const loader = document.getElementById('loader');
    if (loader) { loader.style.display = 'flex'; loader.style.opacity = '1'; }
}

function hideLoading() {
    const loader = document.getElementById('loader');
    if (loader) {
        loader.style.opacity = '0';
        setTimeout(() => { loader.style.display = 'none'; }, 300);
    }
}

function showMessage(type, text) {
    let container = document.getElementById('messageContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'messageContainer';
        container.className = 'message-container';
        document.body.appendChild(container);
    }

    const message   = document.createElement('div');
    message.className = `message ${type}`;

    const iconMap = {
        success: 'fas fa-check-circle',
        error:   'fas fa-exclamation-circle',
        warning: 'fas fa-exclamation-triangle',
        info:    'fas fa-info-circle'
    };

    message.innerHTML = `
        <i class="${iconMap[type] || iconMap.info}"></i>
        <span>${text}</span>
        <button class="message-close"><i class="fas fa-times"></i></button>`;

    container.appendChild(message);

    const remove = () => {
        message.style.opacity = '0';
        setTimeout(() => { if (message.parentNode) message.parentNode.removeChild(message); }, 300);
    };

    setTimeout(remove, 5000);
    message.querySelector('.message-close').addEventListener('click', remove);
}

// Exports
window.loadProfile     = loadProfile;
window.loadProfileData = loadProfileData;
window.profileState    = profileState;