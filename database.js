// ===== DATABASE SETUP =====
// Using IndexedDB for browser storage

class HealthDatabase {
    constructor() {
        this.dbName = 'HealyticaRecordDB';
        this.dbVersion = 1;
        this.db = null;
        this.isInitialized = false;
    }

    // Initialize database
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = (event) => {
                console.error('Database error:', event.target.error);
                reject(event.target.error);
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                this.isInitialized = true;
                console.log('Database initialized successfully');
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                this.createTables(db);
            };
        });
    }

    // Create all tables (object stores)
    createTables(db) {
        // Users table (for authentication)
        if (!db.objectStoreNames.contains('users')) {
            const usersStore = db.createObjectStore('users', { keyPath: 'id', autoIncrement: true });
            usersStore.createIndex('mobile_number', 'mobile_number', { unique: true });
            usersStore.createIndex('email', 'email', { unique: false });
        }

        // User profile table
        if (!db.objectStoreNames.contains('user_profile')) {
            const profileStore = db.createObjectStore('user_profile', { keyPath: 'id', autoIncrement: true });
            profileStore.createIndex('user_id', 'user_id', { unique: true });
        }

        // Medications table
        if (!db.objectStoreNames.contains('medications')) {
            const medsStore = db.createObjectStore('medications', { keyPath: 'id', autoIncrement: true });
            medsStore.createIndex('user_id', 'user_id', { unique: false });
            medsStore.createIndex('status', 'status', { unique: false });
            medsStore.createIndex('start_date', 'start_date', { unique: false });
        }

        // Lab results table
        if (!db.objectStoreNames.contains('lab_results')) {
            const labsStore = db.createObjectStore('lab_results', { keyPath: 'id', autoIncrement: true });
            labsStore.createIndex('user_id', 'user_id', { unique: false });
            labsStore.createIndex('test_date', 'test_date', { unique: false });
        }

        // Vital signs table
        if (!db.objectStoreNames.contains('vital_signs')) {
            const vitalsStore = db.createObjectStore('vital_signs', { keyPath: 'id', autoIncrement: true });
            vitalsStore.createIndex('user_id', 'user_id', { unique: false });
            vitalsStore.createIndex('record_date', 'record_date', { unique: false });
        }

        // Appointments table
        if (!db.objectStoreNames.contains('appointments')) {
            const appointmentsStore = db.createObjectStore('appointments', { keyPath: 'id', autoIncrement: true });
            appointmentsStore.createIndex('user_id', 'user_id', { unique: false });
            appointmentsStore.createIndex('appointment_date', 'appointment_date', { unique: false });
        }

        // Symptoms table
        if (!db.objectStoreNames.contains('symptoms')) {
            const symptomsStore = db.createObjectStore('symptoms', { keyPath: 'id', autoIncrement: true });
            symptomsStore.createIndex('user_id', 'user_id', { unique: false });
            symptomsStore.createIndex('symptom_date', 'symptom_date', { unique: false });
        }
    }

    // ===== GENERIC CRUD OPERATIONS =====
    async add(storeName, data) {
        if (!this.db) {
            await this.waitForInit();
        }
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.add(data);

            request.onsuccess = () => resolve(request.result);
            request.onerror = (event) => reject(event.target.error);
        });
    }

    async get(storeName, id) {
        if (!this.db) {
            await this.waitForInit();
        }
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.get(id);

            request.onsuccess = () => resolve(request.result);
            request.onerror = (event) => reject(event.target.error);
        });
    }

    async getAll(storeName) {
        if (!this.db) {
            await this.waitForInit();
        }
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result);
            request.onerror = (event) => reject(event.target.error);
        });
    }

    async update(storeName, id, data) {
        if (!this.db) {
            await this.waitForInit();
        }
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.put({ ...data, id });

            request.onsuccess = () => resolve(request.result);
            request.onerror = (event) => reject(event.target.error);
        });
    }

    async delete(storeName, id) {
        if (!this.db) {
            await this.waitForInit();
        }
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.delete(id);

            request.onsuccess = () => resolve(true);
            request.onerror = (event) => reject(event.target.error);
        });
    }

    async query(storeName, indexName, value) {
        if (!this.db) {
            await this.waitForInit();
        }
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const index = store.index(indexName);
            const request = index.getAll(value);

            request.onsuccess = () => resolve(request.result);
            request.onerror = (event) => reject(event.target.error);
        });
    }

    // Wait for database to initialize
    async waitForInit() {
        if (!this.isInitialized) {
            await this.init();
        }
    }

    // ===== SPECIFIC DATABASE FUNCTIONS =====

    // User functions
    async getUserByMobile(mobileNumber) {
        const users = await this.query('users', 'mobile_number', mobileNumber);
        return users.length > 0 ? users[0] : null;
    }

    async getUserProfile(userId) {
        const profiles = await this.query('user_profile', 'user_id', userId);
        return profiles.length > 0 ? profiles[0] : null;
    }

    // ===== MEDICATION FUNCTIONS =====
    async getUserMedications(userId) {
        return this.query('medications', 'user_id', userId);
    }

    async getActiveMedications(userId) {
        const allMeds = await this.getUserMedications(userId);
        return allMeds.filter(med => med.status === 'active');
    }

    // Add medication with enhanced error handling
    async addMedication(userId, medicationData) {
        try {
            const medication = {
                user_id: userId,
                ...medicationData,
                created_at: new Date().toISOString()
            };
            
            // Set default status if not provided
            if (!medication.status) {
                medication.status = 'active';
            }
            
            const id = await this.add('medications', medication);
            console.log('Medication added with ID:', id);
            return id;
        } catch (error) {
            console.error('Error adding medication:', error);
            throw error;
        }
    }

    // Update medication
    async updateMedication(medicationId, medicationData) {
        try {
            // First get the existing medication
            const existing = await this.get('medications', medicationId);
            if (!existing) {
                throw new Error('Medication not found');
            }
            
            // Merge with existing data
            const updatedMedication = {
                ...existing,
                ...medicationData,
                id: medicationId
            };
            
            await this.update('medications', medicationId, updatedMedication);
            console.log('Medication updated:', medicationId);
            return true;
        } catch (error) {
            console.error('Error updating medication:', error);
            throw error;
        }
    }

    // Complete medication
    async completeMedication(medicationId) {
        try {
            const existing = await this.get('medications', medicationId);
            if (existing) {
                existing.status = 'completed';
                await this.update('medications', medicationId, existing);
                return true;
            }
            return false;
        } catch (error) {
            console.error('Error completing medication:', error);
            throw error;
        }
    }

    // Reactivate medication
    async reactivateMedication(medicationId) {
        try {
            const existing = await this.get('medications', medicationId);
            if (existing) {
                existing.status = 'active';
                await this.update('medications', medicationId, existing);
                return true;
            }
            return false;
        } catch (error) {
            console.error('Error reactivating medication:', error);
            throw error;
        }
    }

    // Get medications by status
    async getMedicationsByStatus(userId, status) {
        try {
            const allMeds = await this.getUserMedications(userId);
            return allMeds.filter(med => med.status === status);
        } catch (error) {
            console.error('Error getting medications by status:', error);
            return [];
        }
    }

    // Lab results functions
    async getUserLabResults(userId) {
        return this.query('lab_results', 'user_id', userId);
    }

    // Vital signs functions
    async getUserVitalSigns(userId) {
        return this.query('vital_signs', 'user_id', userId);
    }

    // Appointments functions
    async getUserAppointments(userId) {
        return this.query('appointments', 'user_id', userId);
    }

    async getUpcomingAppointments(userId) {
        const today = new Date().toISOString().split('T')[0];
        const appointments = await this.getUserAppointments(userId);
        return appointments.filter(apt => apt.appointment_date >= today);
    }

    // Symptoms functions
    async getUserSymptoms(userId) {
        return this.query('symptoms', 'user_id', userId);
    }

    // Analytics functions
    async getSystemStats(userId) {
        const stats = {};
        
        const activeMeds = await this.getActiveMedications(userId);
        stats.active_medications = activeMeds.length;
        
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const recentLabs = await this.getUserLabResults(userId);
        stats.recent_labs = recentLabs.filter(lab => new Date(lab.test_date) >= thirtyDaysAgo).length;
        
        const upcomingApts = await this.getUpcomingAppointments(userId);
        stats.upcoming_appointments = upcomingApts.length;
        
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const recentVitals = await this.getUserVitalSigns(userId);
        stats.recent_vitals = recentVitals.filter(vital => new Date(vital.record_date) >= sevenDaysAgo).length;
        
        return stats;
    }

    // Clear all data (for testing/reset)
    async clearDatabase() {
        if (!this.db) {
            await this.waitForInit();
        }
        
        const stores = [
            'users', 'user_profile', 'medications', 
            'lab_results', 'vital_signs', 'appointments', 'symptoms'
        ];

        for (const storeName of stores) {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            store.clear();
        }
        
        return true;
    }
}

// Create global database instance
const healthDB = new HealthDatabase();

// Initialize database function
async function initDatabase() {
    try {
        await healthDB.init();
        console.log('Health database ready');
        return true;
    } catch (error) {
        console.error('Failed to initialize database:', error);
        showMessage('error', 'Database initialization failed. Please refresh the page.');
        return false;
    }
}

// Helper function to show messages
function showMessage(type, text) {
    const container = document.getElementById('messageContainer');
    if (!container) return;

    const message = document.createElement('div');
    message.className = `message ${type}`;
    
    const icon = type === 'success' ? '✅' : 
                 type === 'error' ? '❌' : 
                 type === 'warning' ? '⚠️' : 'ℹ️';
    
    message.innerHTML = `<span>${icon}</span> <span>${text}</span>`;
    
    container.appendChild(message);
    
    // Remove message after 5 seconds
    setTimeout(() => {
        message.style.opacity = '0';
        message.style.transform = 'translateX(100%)';
        setTimeout(() => {
            if (message.parentNode) {
                message.parentNode.removeChild(message);
            }
        }, 300);
    }, 5000);
}

// Export database instance
window.healthDB = healthDB;
window.initDatabase = initDatabase;
window.showMessage = showMessage;