// ===== HEALTH DATABASE - COMPLETE FIXED VERSION =====
class HealthDatabase {
    constructor() {
        // Initialize Dexie database
        this.db = new Dexie('HealthTrackerDB');
        
        // Define database schema (version 2 to include all necessary tables)
        this.db.version(2).stores({
            users: '++id, email, username, full_name',
            medications: '++id, user_id, medication_name, dosage, frequency, start_date, end_date, status',
            labResults: '++id, user_id, test_type, test_date, fbs, cholesterol, hdl, ldl, triglycerides, hba1c',
            vitalSigns: '++id, user_id, record_date, blood_pressure_systolic, blood_pressure_diastolic, heart_rate, temperature, weight, height, bmi, respiratory_rate, oxygen_saturation',
            symptoms: '++id, user_id, symptom_name, symptom_date, severity, duration, notes',
            appointments: '++id, user_id, appointment_date, doctor_name, specialty, reason, notes',
            healthGoals: '++id, user_id, goal_name, target_value, current_value, start_date, end_date, status',
            // Add notifications table
            notifications: '++id, user_id, title, message, type, read, created_at'
        });
        
        // Create shortcuts to tables
        this.users = this.db.users;
        this.medications = this.db.medications;
        this.labResults = this.db.labResults;
        this.vitalSigns = this.db.vitalSigns;
        this.symptoms = this.db.symptoms;
        this.appointments = this.db.appointments;
        this.healthGoals = this.db.healthGoals;
        this.notifications = this.db.notifications;
        
        console.log('Health Database initialized with all tables');
    }
    
    // ===== USER OPERATIONS =====
    async createUser(userData) {
        try {
            const userId = await this.users.add(userData);
            console.log('User created with ID:', userId);
            
            // Create default notifications for new user
            await this.createDefaultNotifications(userId);
            
            return userId;
        } catch (error) {
            console.error('Error creating user:', error);
            throw error;
        }
    }
    
    async getUserByEmail(email) {
        try {
            return await this.users.where('email').equals(email).first();
        } catch (error) {
            console.error('Error getting user by email:', error);
            return null;
        }
    }
    
    async getUserById(userId) {
        try {
            return await this.users.get(userId);
        } catch (error) {
            console.error('Error getting user by ID:', error);
            return null;
        }
    }
    
    async updateUser(userId, userData) {
        try {
            await this.users.update(userId, userData);
            console.log('User updated:', userId);
            return true;
        } catch (error) {
            console.error('Error updating user:', error);
            return false;
        }
    }
    
    // ===== MEDICATION OPERATIONS =====
    async addMedication(userId, medicationData) {
        try {
            const dataWithUserId = {
                ...medicationData,
                user_id: userId,
                created_at: new Date().toISOString()
            };
            const id = await this.medications.add(dataWithUserId);
            console.log('Medication added with ID:', id);
            
            // Create notification for new medication
            await this.createNotification(
                userId,
                'New Medication Added',
                `${medicationData.medication_name} has been added to your medications list.`,
                'info'
            );
            
            return id;
        } catch (error) {
            console.error('Error adding medication:', error);
            throw error;
        }
    }
    
    async getUserMedications(userId) {
        try {
            const medications = await this.medications
                .where('user_id')
                .equals(userId)
                .sortBy('start_date');
            return medications.reverse(); // Newest first
        } catch (error) {
            console.error('Error getting user medications:', error);
            return [];
        }
    }
    
    async getActiveMedications(userId) {
        try {
            const medications = await this.medications
                .where('user_id')
                .equals(userId)
                .and(med => med.status === 'active')
                .sortBy('start_date');
            return medications.reverse();
        } catch (error) {
            console.error('Error getting active medications:', error);
            return [];
        }
    }
    
    async updateMedication(medicationId, medicationData) {
        try {
            await this.medications.update(medicationId, medicationData);
            console.log('Medication updated:', medicationId);
            return true;
        } catch (error) {
            console.error('Error updating medication:', error);
            return false;
        }
    }
    
    async deleteMedication(medicationId) {
        try {
            await this.medications.delete(medicationId);
            console.log('Medication deleted:', medicationId);
            return true;
        } catch (error) {
            console.error('Error deleting medication:', error);
            return false;
        }
    }
    
    // ===== LAB RESULTS OPERATIONS =====
    async addLabResult(userId, labData) {
        try {
            const dataWithUserId = {
                ...labData,
                user_id: userId,
                created_at: new Date().toISOString()
            };
            const id = await this.labResults.add(dataWithUserId);
            console.log('Lab result added with ID:', id);
            
            // Create notification for new lab result
            await this.createNotification(
                userId,
                'New Lab Result Added',
                `Lab test "${labData.test_type}" has been recorded.`,
                'info'
            );
            
            return id;
        } catch (error) {
            console.error('Error adding lab result:', error);
            throw error;
        }
    }
    
    async getUserLabResults(userId) {
        try {
            const labs = await this.labResults
                .where('user_id')
                .equals(userId)
                .sortBy('test_date');
            return labs.reverse(); // Newest first
        } catch (error) {
            console.error('Error getting user lab results:', error);
            return [];
        }
    }
    
    async getRecentLabResults(userId, limit = 5) {
        try {
            const labs = await this.getUserLabResults(userId);
            return labs.slice(0, limit);
        } catch (error) {
            console.error('Error getting recent lab results:', error);
            return [];
        }
    }
    
    // ===== VITAL SIGNS OPERATIONS =====
    async addVitalSign(userId, vitalData) {
        try {
            const dataWithUserId = {
                ...vitalData,
                user_id: userId,
                created_at: new Date().toISOString()
            };
            
            // Calculate BMI if weight and height are provided
            if (vitalData.weight && vitalData.height) {
                const heightInMeters = vitalData.height / 100;
                dataWithUserId.bmi = (vitalData.weight / (heightInMeters * heightInMeters)).toFixed(1);
            }
            
            const id = await this.vitalSigns.add(dataWithUserId);
            console.log('Vital sign added with ID:', id);
            
            // Check for abnormal values and create notifications
            await this.checkVitalSignAlerts(userId, vitalData);
            
            return id;
        } catch (error) {
            console.error('Error adding vital sign:', error);
            throw error;
        }
    }
    
    async getUserVitalSigns(userId) {
        try {
            const vitals = await this.vitalSigns
                .where('user_id')
                .equals(userId)
                .sortBy('record_date');
            return vitals.reverse(); // Newest first
        } catch (error) {
            console.error('Error getting user vital signs:', error);
            return [];
        }
    }
    
    async getRecentVitalSigns(userId, limit = 10) {
        try {
            const vitals = await this.getUserVitalSigns(userId);
            return vitals.slice(0, limit);
        } catch (error) {
            console.error('Error getting recent vital signs:', error);
            return [];
        }
    }
    
    // ===== SYMPTOM OPERATIONS =====
    async addSymptom(userId, symptomData) {
        try {
            const dataWithUserId = {
                ...symptomData,
                user_id: userId,
                created_at: new Date().toISOString()
            };
            const id = await this.symptoms.add(dataWithUserId);
            console.log('Symptom added with ID:', id);
            
            // Create notification for severe symptoms
            if (symptomData.severity >= 7) {
                await this.createNotification(
                    userId,
                    'Severe Symptom Recorded',
                    `You recorded "${symptomData.symptom_name}" with severity ${symptomData.severity}/10. Consider consulting a doctor.`,
                    'warning'
                );
            }
            
            return id;
        } catch (error) {
            console.error('Error adding symptom:', error);
            throw error;
        }
    }
    
    async getUserSymptoms(userId) {
        try {
            const symptoms = await this.symptoms
                .where('user_id')
                .equals(userId)
                .sortBy('symptom_date');
            return symptoms.reverse(); // Newest first
        } catch (error) {
            console.error('Error getting user symptoms:', error);
            return [];
        }
    }
    
    async getRecentSymptoms(userId, days = 7) {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - days);
            
            const symptoms = await this.symptoms
                .where('user_id')
                .equals(userId)
                .and(symptom => new Date(symptom.symptom_date) >= cutoffDate)
                .sortBy('symptom_date');
            
            return symptoms.reverse();
        } catch (error) {
            console.error('Error getting recent symptoms:', error);
            return [];
        }
    }
    
    // ===== APPOINTMENT OPERATIONS =====
    async addAppointment(userId, appointmentData) {
        try {
            const dataWithUserId = {
                ...appointmentData,
                user_id: userId,
                created_at: new Date().toISOString()
            };
            const id = await this.appointments.add(dataWithUserId);
            console.log('Appointment added with ID:', id);
            
            // Create notification for upcoming appointment
            const appointmentDate = new Date(appointmentData.appointment_date);
            const now = new Date();
            const daysUntil = Math.ceil((appointmentDate - now) / (1000 * 60 * 60 * 24));
            
            if (daysUntil <= 7) {
                await this.createNotification(
                    userId,
                    'Upcoming Appointment',
                    `You have an appointment with ${appointmentData.doctor_name} in ${daysUntil} day(s).`,
                    'reminder'
                );
            }
            
            return id;
        } catch (error) {
            console.error('Error adding appointment:', error);
            throw error;
        }
    }
    
    async getUserAppointments(userId) {
        try {
            const appointments = await this.appointments
                .where('user_id')
                .equals(userId)
                .sortBy('appointment_date');
            return appointments.reverse(); // Newest first
        } catch (error) {
            console.error('Error getting user appointments:', error);
            return [];
        }
    }
    
    async getUpcomingAppointments(userId, limit = 5) {
        try {
            const now = new Date();
            const appointments = await this.appointments
                .where('user_id')
                .equals(userId)
                .and(appointment => new Date(appointment.appointment_date) >= now)
                .sortBy('appointment_date');
            
            return appointments.slice(0, limit);
        } catch (error) {
            console.error('Error getting upcoming appointments:', error);
            return [];
        }
    }
    
    // ===== HEALTH GOALS OPERATIONS =====
    async addHealthGoal(userId, goalData) {
        try {
            const dataWithUserId = {
                ...goalData,
                user_id: userId,
                created_at: new Date().toISOString()
            };
            const id = await this.healthGoals.add(dataWithUserId);
            console.log('Health goal added with ID:', id);
            
            return id;
        } catch (error) {
            console.error('Error adding health goal:', error);
            throw error;
        }
    }
    
    async getUserHealthGoals(userId) {
        try {
            const goals = await this.healthGoals
                .where('user_id')
                .equals(userId)
                .sortBy('start_date');
            return goals.reverse();
        } catch (error) {
            console.error('Error getting user health goals:', error);
            return [];
        }
    }
    
    async updateHealthGoal(goalId, goalData) {
        try {
            await this.healthGoals.update(goalId, goalData);
            console.log('Health goal updated:', goalId);
            return true;
        } catch (error) {
            console.error('Error updating health goal:', error);
            return false;
        }
    }
    
    // ===== NOTIFICATION OPERATIONS =====
    async createNotification(userId, title, message, type = 'info') {
        try {
            const notification = {
                user_id: userId,
                title: title,
                message: message,
                type: type,
                read: false,
                created_at: new Date().toISOString()
            };
            
            const id = await this.notifications.add(notification);
            console.log('Notification created with ID:', id);
            return id;
        } catch (error) {
            console.error('Error creating notification:', error);
            return null;
        }
    }
    
    async createDefaultNotifications(userId) {
        try {
            const defaultNotifications = [
                {
                    title: 'Welcome to Healytica Record!',
                    message: 'Start tracking your health by adding your medications, vital signs, and lab results.',
                    type: 'welcome'
                },
                {
                    title: 'Health Tracking Tips',
                    message: 'Regular tracking helps identify patterns and improve health outcomes.',
                    type: 'info'
                }
            ];
            
            for (const notif of defaultNotifications) {
                await this.createNotification(userId, notif.title, notif.message, notif.type);
            }
        } catch (error) {
            console.error('Error creating default notifications:', error);
        }
    }
    
    async getUserNotifications(userId, unreadOnly = false) {
        try {
            let query = this.notifications.where('user_id').equals(userId);
            
            if (unreadOnly) {
                query = query.and(notif => notif.read === false);
            }
            
            const notifications = await query.sortBy('created_at');
            return notifications.reverse(); // Newest first
        } catch (error) {
            console.error('Error getting user notifications:', error);
            return [];
        }
    }
    
    async markNotificationAsRead(notificationId) {
        try {
            await this.notifications.update(notificationId, { read: true });
            console.log('Notification marked as read:', notificationId);
            return true;
        } catch (error) {
            console.error('Error marking notification as read:', error);
            return false;
        }
    }
    
    async markAllNotificationsAsRead(userId) {
        try {
            const notifications = await this.getUserNotifications(userId, true);
            
            for (const notif of notifications) {
                await this.markNotificationAsRead(notif.id);
            }
            
            console.log('All notifications marked as read for user:', userId);
            return true;
        } catch (error) {
            console.error('Error marking all notifications as read:', error);
            return false;
        }
    }
    
    async deleteNotification(notificationId) {
        try {
            await this.notifications.delete(notificationId);
            console.log('Notification deleted:', notificationId);
            return true;
        } catch (error) {
            console.error('Error deleting notification:', error);
            return false;
        }
    }
    
    // ===== HEALTH ALERTS & MONITORING =====
    async checkVitalSignAlerts(userId, vitalData) {
        const alerts = [];
        
        // Check blood pressure
        if (vitalData.blood_pressure_systolic > 180 || vitalData.blood_pressure_diastolic > 120) {
            alerts.push({
                title: 'Critical Blood Pressure',
                message: `Your blood pressure is critically high (${vitalData.blood_pressure_systolic}/${vitalData.blood_pressure_diastolic}). Seek immediate medical attention.`,
                type: 'critical'
            });
        } else if (vitalData.blood_pressure_systolic > 140 || vitalData.blood_pressure_diastolic > 90) {
            alerts.push({
                title: 'High Blood Pressure',
                message: `Your blood pressure is elevated (${vitalData.blood_pressure_systolic}/${vitalData.blood_pressure_diastolic}). Consider consulting your doctor.`,
                type: 'warning'
            });
        }
        
        // Check heart rate
        if (vitalData.heart_rate > 100) {
            alerts.push({
                title: 'High Heart Rate',
                message: `Your heart rate is elevated (${vitalData.heart_rate} bpm). Rest and monitor.`,
                type: 'warning'
            });
        } else if (vitalData.heart_rate < 50) {
            alerts.push({
                title: 'Low Heart Rate',
                message: `Your heart rate is low (${vitalData.heart_rate} bpm). Consult your doctor if symptomatic.`,
                type: 'warning'
            });
        }
        
        // Check temperature
        if (vitalData.temperature > 38) {
            alerts.push({
                title: 'Fever Detected',
                message: `Your temperature is elevated (${vitalData.temperature}°C). Rest and monitor symptoms.`,
                type: 'warning'
            });
        }
        
        // Check oxygen saturation
        if (vitalData.oxygen_saturation && vitalData.oxygen_saturation < 92) {
            alerts.push({
                title: 'Low Oxygen Saturation',
                message: `Your oxygen saturation is low (${vitalData.oxygen_saturation}%). Seek medical attention if you have difficulty breathing.`,
                type: 'critical'
            });
        }
        
        // Create notifications for each alert
        for (const alert of alerts) {
            await this.createNotification(userId, alert.title, alert.message, alert.type);
        }
        
        return alerts;
    }
    
    // ===== STATISTICS & ANALYTICS =====
    async getSystemStats(userId) {
        try {
            const [
                totalMedications,
                totalLabs,
                totalVitals,
                totalSymptoms,
                totalAppointments,
                activeMedications,
                upcomingAppointments,
                recentVitals,
                recentLabs,
                recentSymptoms,
                unreadNotifications
            ] = await Promise.all([
                this.getUserMedications(userId).then(meds => meds.length),
                this.getUserLabResults(userId).then(labs => labs.length),
                this.getUserVitalSigns(userId).then(vitals => vitals.length),
                this.getUserSymptoms(userId).then(symptoms => symptoms.length),
                this.getUserAppointments(userId).then(appointments => appointments.length),
                this.getActiveMedications(userId).then(meds => meds.length),
                this.getUpcomingAppointments(userId).then(appointments => appointments.length),
                this.getRecentVitalSigns(userId, 5),
                this.getRecentLabResults(userId, 5),
                this.getRecentSymptoms(userId, 7),
                this.getUserNotifications(userId, true).then(notifs => notifs.length)
            ]);
            
            return {
                totalMedications,
                totalLabs,
                totalVitals,
                totalSymptoms,
                totalAppointments,
                activeMedications,
                upcomingAppointments,
                recentVitals,
                recentLabs,
                recentSymptoms,
                unreadNotifications,
                dataCompleteness: this.calculateDataCompleteness(userId)
            };
        } catch (error) {
            console.error('Error getting system stats:', error);
            return {
                totalMedications: 0,
                totalLabs: 0,
                totalVitals: 0,
                totalSymptoms: 0,
                totalAppointments: 0,
                activeMedications: 0,
                upcomingAppointments: 0,
                recentVitals: [],
                recentLabs: [],
                recentSymptoms: [],
                unreadNotifications: 0,
                dataCompleteness: 0
            };
        }
    }
    
    async calculateDataCompleteness(userId) {
        try {
            const [
                hasMedications,
                hasLabs,
                hasVitals,
                hasSymptoms,
                hasAppointments
            ] = await Promise.all([
                this.getUserMedications(userId).then(meds => meds.length > 0),
                this.getUserLabResults(userId).then(labs => labs.length > 0),
                this.getUserVitalSigns(userId).then(vitals => vitals.length > 0),
                this.getUserSymptoms(userId).then(symptoms => symptoms.length > 0),
                this.getUserAppointments(userId).then(appointments => appointments.length > 0)
            ]);
            
            const completedItems = [hasMedications, hasLabs, hasVitals, hasSymptoms, hasAppointments]
                .filter(Boolean).length;
            
            return Math.round((completedItems / 5) * 100);
        } catch (error) {
            console.error('Error calculating data completeness:', error);
            return 0;
        }
    }
    
    // ===== DATA EXPORT =====
    async exportUserData(userId, format = 'json') {
        try {
            const userData = await this.getUserById(userId);
            const medications = await this.getUserMedications(userId);
            const labResults = await this.getUserLabResults(userId);
            const vitalSigns = await this.getUserVitalSigns(userId);
            const symptoms = await this.getUserSymptoms(userId);
            const appointments = await this.getUserAppointments(userId);
            const healthGoals = await this.getUserHealthGoals(userId);
            const notifications = await this.getUserNotifications(userId);
            
            const exportData = {
                user: userData,
                medications,
                labResults,
                vitalSigns,
                symptoms,
                appointments,
                healthGoals,
                notifications,
                exportDate: new Date().toISOString(),
                recordCount: {
                    medications: medications.length,
                    labResults: labResults.length,
                    vitalSigns: vitalSigns.length,
                    symptoms: symptoms.length,
                    appointments: appointments.length,
                    healthGoals: healthGoals.length,
                    notifications: notifications.length
                }
            };
            
            if (format === 'json') {
                return JSON.stringify(exportData, null, 2);
            } else if (format === 'csv') {
                // Simple CSV conversion for medications
                let csv = 'Medication Name,Dosage,Frequency,Start Date,End Date,Status\n';
                medications.forEach(med => {
                    csv += `"${med.medication_name}","${med.dosage}","${med.frequency}","${med.start_date}","${med.end_date || ''}","${med.status}"\n`;
                });
                return csv;
            }
            
            return exportData;
        } catch (error) {
            console.error('Error exporting user data:', error);
            throw error;
        }
    }
    
    // ===== DATABASE MAINTENANCE =====
    async clearAllData() {
        try {
            await Promise.all([
                this.users.clear(),
                this.medications.clear(),
                this.labResults.clear(),
                this.vitalSigns.clear(),
                this.symptoms.clear(),
                this.appointments.clear(),
                this.healthGoals.clear(),
                this.notifications.clear()
            ]);
            
            console.log('All data cleared from database');
            return true;
        } catch (error) {
            console.error('Error clearing database:', error);
            return false;
        }
    }
    
    async deleteUserData(userId) {
        try {
            await Promise.all([
                this.medications.where('user_id').equals(userId).delete(),
                this.labResults.where('user_id').equals(userId).delete(),
                this.vitalSigns.where('user_id').equals(userId).delete(),
                this.symptoms.where('user_id').equals(userId).delete(),
                this.appointments.where('user_id').equals(userId).delete(),
                this.healthGoals.where('user_id').equals(userId).delete(),
                this.notifications.where('user_id').equals(userId).delete()
            ]);
            
            console.log('All user data deleted for user:', userId);
            return true;
        } catch (error) {
            console.error('Error deleting user data:', error);
            return false;
        }
    }
    
    // ===== BACKUP & RESTORE =====
    async createBackup() {
        try {
            const allData = {
                users: await this.users.toArray(),
                medications: await this.medications.toArray(),
                labResults: await this.labResults.toArray(),
                vitalSigns: await this.vitalSigns.toArray(),
                symptoms: await this.symptoms.toArray(),
                appointments: await this.appointments.toArray(),
                healthGoals: await this.healthGoals.toArray(),
                notifications: await this.notifications.toArray(),
                backupDate: new Date().toISOString(),
                version: 2
            };
            
            return JSON.stringify(allData, null, 2);
        } catch (error) {
            console.error('Error creating backup:', error);
            throw error;
        }
    }
    
    async restoreBackup(backupData) {
        try {
            const data = JSON.parse(backupData);
            
            // Clear existing data
            await this.clearAllData();
            
            // Restore data
            await Promise.all([
                this.users.bulkAdd(data.users || []),
                this.medications.bulkAdd(data.medications || []),
                this.labResults.bulkAdd(data.labResults || []),
                this.vitalSigns.bulkAdd(data.vitalSigns || []),
                this.symptoms.bulkAdd(data.symptoms || []),
                this.appointments.bulkAdd(data.appointments || []),
                this.healthGoals.bulkAdd(data.healthGoals || []),
                this.notifications.bulkAdd(data.notifications || [])
            ]);
            
            console.log('Backup restored successfully');
            return true;
        } catch (error) {
            console.error('Error restoring backup:', error);
            throw error;
        }
    }
    
    // ===== HEALTH INSIGHTS =====
    async getHealthInsights(userId) {
        try {
            const [vitals, labs, medications, symptoms] = await Promise.all([
                this.getRecentVitalSigns(userId, 10),
                this.getRecentLabResults(userId, 5),
                this.getActiveMedications(userId),
                this.getRecentSymptoms(userId, 30)
            ]);
            
            const insights = [];
            
            // Blood pressure trend
            if (vitals.length >= 2) {
                const latestBP = vitals[0];
                const previousBP = vitals[1];
                const bpChange = latestBP.blood_pressure_systolic - previousBP.blood_pressure_systolic;
                
                if (Math.abs(bpChange) > 10) {
                    insights.push({
                        type: bpChange > 0 ? 'warning' : 'positive',
                        title: 'Blood Pressure Trend',
                        message: `Blood pressure changed by ${bpChange > 0 ? '+' : ''}${bpChange} mmHg`,
                        priority: 2
                    });
                }
            }
            
            // High blood pressure alert
            if (vitals.length > 0 && vitals[0].blood_pressure_systolic > 140) {
                insights.push({
                    type: 'warning',
                    title: 'Elevated Blood Pressure',
                    message: `Current blood pressure is ${vitals[0].blood_pressure_systolic}/${vitals[0].blood_pressure_diastolic} mmHg`,
                    priority: 1
                });
            }
            
            // High glucose alert
            if (labs.length > 0 && labs[0].fbs && labs[0].fbs > 126) {
                insights.push({
                    type: 'critical',
                    title: 'High Blood Sugar',
                    message: `Fasting blood sugar is ${labs[0].fbs} mg/dL (Diabetes range)`,
                    priority: 1
                });
            }
            
            // Multiple medications alert
            if (medications.length > 5) {
                insights.push({
                    type: 'info',
                    title: 'Multiple Medications',
                    message: `You have ${medications.length} active medications. Review with your doctor.`,
                    priority: 3
                });
            }
            
            // Frequent symptoms alert
            if (symptoms.length >= 3) {
                insights.push({
                    type: 'warning',
                    title: 'Frequent Symptoms',
                    message: `You've recorded ${symptoms.length} symptoms in the last 30 days`,
                    priority: 2
                });
            }
            
            // Sort by priority (lower number = higher priority)
            insights.sort((a, b) => a.priority - b.priority);
            
            return insights;
        } catch (error) {
            console.error('Error getting health insights:', error);
            return [];
        }
    }
}

// Create global instance
const healthDB = new HealthDatabase();

// ===== EXPORT HELPER FUNCTIONS =====
// These are the functions your analytics.js is trying to call
// They're already part of the HealthDatabase class, but we'll expose them at the top level too

// Helper function to check if database is ready
healthDB.isReady = function() {
    return healthDB.db && healthDB.db.isOpen();
};

// The functions you're calling from analytics.js are already available as:
// healthDB.getUserMedications(userId)
// healthDB.getUserLabResults(userId)
// healthDB.getUserVitalSigns(userId)
// healthDB.getUserSymptoms(userId)
// healthDB.getUserAppointments(userId)

// But we'll create direct references for compatibility
Object.assign(healthDB, {
    // User data getters
    getUserVitalSigns: function(userId) {
        return healthDB.getUserVitalSigns(userId);
    },
    
    getUserLabResults: function(userId) {
        return healthDB.getUserLabResults(userId);
    },
    
    getUserMedications: function(userId) {
        return healthDB.getUserMedications(userId);
    },
    
    getUserSymptoms: function(userId) {
        return healthDB.getUserSymptoms(userId);
    },
    
    getUserAppointments: function(userId) {
        return healthDB.getUserAppointments(userId);
    }
});

console.log('Health Database initialized with all methods');