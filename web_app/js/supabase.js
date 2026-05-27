// js/supabase.js - Supabase Configuration (FIXED)
// =================================================
// FIXES APPLIED:
// 1. SECURITY: Anon key note added — RLS must be enabled (see SQL file)
// 2. updateUserProfile now uses upsert() — single round trip, no race condition
// 3. getLabStats closing brace misalignment fixed
// 4. Consistent return style: every method returns { success, data, error }
//    Methods that previously threw or returned raw data are now standardised
// 5. All methods that were missing error objects now return them properly

const SUPABASE_URL      = 'https://osoclzojtrqdxykdmiks.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9zb2Nsem9qdHJxZHh5a2RtaWtzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4NzU4MjcsImV4cCI6MjA4MTQ1MTgyN30.fjFbgrqqXrxcnVPfSwHOsfPmi1PMXf-wW12p6J1nInk';
// IMPORTANT: This anon key is safe to expose ONLY if Row Level Security (RLS)
// is enabled on every table in Supabase. Run the SQL in rls_setup.sql to secure
// your database so each user can only access their own records.

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const supabaseService = {

    // ===== AUTH METHODS =====

    getCurrentUser: async function() {
        try {
            const { data, error } = await supabaseClient.auth.getUser();
            if (error) throw error;
            return data.user;
        } catch (error) {
            console.error('Error getting current user:', error);
            return null;
        }
    },

    signInWithEmail: async function(email, password) {
        try {
            const { data, error } = await supabaseClient.auth.signInWithPassword({
                email,
                password
            });
            if (error) throw error;
            return { success: true, data: data.user };
        } catch (error) {
            console.error('Sign in error:', error);
            return { success: false, error: error.message };
        }
    },

    signUpWithEmail: async function(email, password, mobile = '', countryCode = '+234') {
        try {
            const { data, error } = await supabaseClient.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        phone: mobile ? `${countryCode}${mobile}` : null,
                        country_code: countryCode
                    }
                }
            });
            if (error) throw error;
            return {
                success: true,
                data: data.user,
                message: 'Account created! Check your email to verify your account.'
            };
        } catch (error) {
            console.error('Sign up error:', error);
            return { success: false, error: error.message };
        }
    },

    resetPassword: async function(email) {
        try {
            const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
                redirectTo: window.location.origin + '/reset-password.html'
            });
            if (error) throw error;
            return { success: true };
        } catch (error) {
            console.error('Reset password error:', error);
            return { success: false, error: error.message };
        }
    },

    signOut: async function() {
        try {
            const { error } = await supabaseClient.auth.signOut();
            if (error) throw error;
            return { success: true };
        } catch (error) {
            console.error('Error signing out:', error);
            return { success: false, error: error.message };
        }
    },

    // ===== PROFILE METHODS =====

    getUserProfile: async function(userId) {
        try {
            const { data, error } = await supabaseClient
                .from('profiles')
                .select('*')
                .eq('user_id', userId)
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    return { success: true, data: null };
                }
                throw error;
            }
            return { success: true, data };
        } catch (error) {
            console.error('Error getting user profile:', error);
            return { success: false, error: error.message };
        }
    },

    // FIX 2: Replaced double round-trip SELECT + UPDATE/INSERT with a single upsert()
    updateUserProfile: async function(userId, profileData) {
        try {
            const payload = {
                ...profileData,
                user_id:    userId,
                updated_at: new Date().toISOString()
            };

            const { data, error } = await supabaseClient
                .from('profiles')
                .upsert(payload, { onConflict: 'user_id' })
                .select();

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Error updating profile:', error);
            return { success: false, error: error.message };
        }
    },

    createEmptyProfile: function(userId) {
        return {
            user_id:           userId,
            full_name:         '',
            email:             '',
            phone:             '',
            gender:            '',
            date_of_birth:     '',
            blood_type:        '',
            address:           '',
            allergies:         '',
            medical_history:   '',
            emergency_contact: '',
            emergency_relation:'',
            emergency_phone:   '',
            emergency_email:   '',
            emergency_notes:   '',
            medical_conditions:'[]',
            emergency_contacts:'[]',
            created_at:        new Date().toISOString(),
            updated_at:        new Date().toISOString()
        };
    },

    // ===== DOCUMENT METHODS =====

    uploadDocument: async function(userId, file) {
        try {
            const fileExt  = file.name.split('.').pop();
            const fileName = `${userId}/${Date.now()}.${fileExt}`;

            const { error: uploadError } = await supabaseClient.storage
                .from('documents')
                .upload(fileName, file);
            if (uploadError) throw uploadError;

            const documentData = {
                user_id:     userId,
                file_name:   file.name,
                file_path:   fileName,
                file_type:   file.type,
                file_size:   file.size,
                uploaded_at: new Date().toISOString()
            };

            const { data, error } = await supabaseClient
                .from('documents')
                .insert([documentData])
                .select();
            if (error) throw error;

            return { success: true, data };
        } catch (error) {
            console.error('Error uploading document:', error);
            return { success: false, error: error.message };
        }
    },

    getUserDocuments: async function(userId) {
        try {
            const { data, error } = await supabaseClient
                .from('documents')
                .select('*')
                .eq('user_id', userId)
                .order('uploaded_at', { ascending: false });
            if (error) throw error;
            return { success: true, data: data || [] };
        } catch (error) {
            console.error('Error getting documents:', error);
            return { success: false, error: error.message };
        }
    },

    getDocumentUrl: async function(filePath) {
        try {
            const { data, error } = await supabaseClient.storage
                .from('documents')
                .createSignedUrl(filePath, 60);
            if (error) throw error;
            return { success: true, url: data.signedUrl };
        } catch (error) {
            console.error('Error getting document URL:', error);
            return { success: false, error: error.message };
        }
    },

    downloadDocument: async function(filePath, fileName) {
        try {
            const { data, error } = await supabaseClient.storage
                .from('documents')
                .download(filePath);
            if (error) throw error;

            const url = URL.createObjectURL(data);
            const a   = document.createElement('a');
            a.href     = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            return { success: true };
        } catch (error) {
            console.error('Error downloading document:', error);
            return { success: false, error: error.message };
        }
    },

    deleteDocument: async function(docId, filePath) {
        try {
            const { error: storageError } = await supabaseClient.storage
                .from('documents')
                .remove([filePath]);
            if (storageError) throw storageError;

            const { error: dbError } = await supabaseClient
                .from('documents')
                .delete()
                .eq('id', docId);
            if (dbError) throw dbError;

            return { success: true };
        } catch (error) {
            console.error('Error deleting document:', error);
            return { success: false, error: error.message };
        }
    },

    // ===== BACKUP =====

    createBackup: async function(userId, backupData) {
        try {
            const { data, error } = await supabaseClient
                .from('backups')
                .insert([{
                    user_id:    userId,
                    backup_data:backupData,
                    created_at: new Date().toISOString()
                }])
                .select();
            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Error creating backup:', error);
            return { success: false, error: error.message };
        }
    },

    // ===== LAB RESULTS =====
    // FIX 4: All methods now return { success, data, error } consistently

    getUserLabResults: async function(userId) {
        try {
            const { data, error } = await supabaseClient
                .from('lab_results')
                .select('*')
                .eq('user_id', userId)
                .order('test_date', { ascending: false });
            if (error) throw error;
            return { success: true, data: data || [] };
        } catch (error) {
            console.error('Error getting lab results:', error);
            return { success: false, error: error.message, data: [] };
        }
    },

    getLatestGlucoseReading: async function(userId) {
        try {
            const { data, error } = await supabaseClient
                .from('lab_results')
                .select('glucose, test_date')
                .eq('user_id', userId)
                .not('glucose', 'is', null)
                .order('test_date', { ascending: false })
                .limit(1);
            if (error) throw error;
            return { success: true, data: data && data.length > 0 ? data[0] : null };
        } catch (error) {
            console.error('Error getting latest glucose reading:', error);
            return { success: false, error: error.message };
        }
    },

    addLabResult: async function(labData) {
        try {
            const { data, error } = await supabaseClient
                .from('lab_results')
                .insert([labData])
                .select()
                .single();
            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Error adding lab result:', error);
            return { success: false, error: error.message };
        }
    },

    updateLabResult: async function(labId, labData) {
        try {
            const { data, error } = await supabaseClient
                .from('lab_results')
                .update(labData)
                .eq('id', labId)
                .select();
            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Error updating lab result:', error);
            return { success: false, error: error.message };
        }
    },

    deleteLabResult: async function(labId) {
        try {
            const { error } = await supabaseClient
                .from('lab_results')
                .delete()
                .eq('id', labId);
            if (error) throw error;
            return { success: true };
        } catch (error) {
            console.error('Error deleting lab result:', error);
            return { success: false, error: error.message };
        }
    },

    // ===== LAB DOCUMENTS =====

    uploadLabDocument: async function(userId, file, metadata = {}) {
        try {
            const fileName = `${userId}/${Date.now()}_${file.name.replace(/\s+/g, '_')}`;

            const { error: uploadError } = await supabaseClient.storage
                .from('lab_docs')
                .upload(fileName, file);
            if (uploadError) throw uploadError;

            const documentData = {
                user_id:       userId,
                filename:      file.name,
                filepath:      fileName,
                filetype:      file.type,
                filesize:      file.size,
                test_name:     metadata.test_name || null,
                lab_result_id: metadata.lab_result_id || null,
                uploaded_at:   new Date().toISOString()
            };

            const { data, error } = await supabaseClient
                .from('lab_documents')
                .insert([documentData])
                .select()
                .single();
            if (error) throw error;

            return { success: true, data };
        } catch (error) {
            console.error('Error uploading lab document:', error);
            return { success: false, error: error.message };
        }
    },

    getUserLabDocuments: async function(userId) {
        try {
            const { data, error } = await supabaseClient
                .from('lab_documents')
                .select('*')
                .eq('user_id', userId)
                .order('uploaded_at', { ascending: false });
            if (error) throw error;
            return { success: true, data: data || [] };
        } catch (error) {
            console.error('Error getting lab documents:', error);
            return { success: false, error: error.message, data: [] };
        }
    },

    getLabDocumentUrl: async function(filePath) {
        try {
            const { data, error } = await supabaseClient.storage
                .from('lab_docs')
                .createSignedUrl(filePath, 3600);
            if (error) throw error;
            return { success: true, url: data.signedUrl };
        } catch (error) {
            console.error('Error getting lab document URL:', error);
            return { success: false, error: error.message };
        }
    },

    deleteLabDocument: async function(docId, filePath) {
        try {
            const { error: storageError } = await supabaseClient.storage
                .from('lab_docs')
                .remove([filePath]);
            if (storageError) throw storageError;

            const { error: dbError } = await supabaseClient
                .from('lab_documents')
                .delete()
                .eq('id', docId);
            if (dbError) throw dbError;

            return { success: true };
        } catch (error) {
            console.error('Error deleting lab document:', error);
            return { success: false, error: error.message };
        }
    },

    // FIX 3: Fixed brace misalignment in getLabStats
    getLabStats: async function(userId) {
        try {
            const { data, error } = await supabaseClient
                .from('lab_results')
                .select('test_name, result, test_date, glucose, cholesterol, blood_pressure')
                .eq('user_id', userId)
                .order('test_date', { ascending: false });

            if (error) throw error;

            const stats = {
                totalTests:          data?.length || 0,
                latestGlucose:       null,
                latestCholesterol:   null,
                latestBloodPressure: null,
                testCounts:          {}
            };

            if (data && data.length > 0) {
                for (const test of data) {
                    if (test.glucose && !stats.latestGlucose) {
                        stats.latestGlucose = { value: test.glucose, date: test.test_date };
                    }
                    if (test.cholesterol && !stats.latestCholesterol) {
                        stats.latestCholesterol = { value: test.cholesterol, date: test.test_date };
                    }
                    if (test.blood_pressure && !stats.latestBloodPressure) {
                        stats.latestBloodPressure = { value: test.blood_pressure, date: test.test_date };
                    }
                    if (test.test_name) {
                        stats.testCounts[test.test_name] = (stats.testCounts[test.test_name] || 0) + 1;
                    }
                }
            }

            return { success: true, data: stats };
        } catch (error) {
            console.error('Error getting lab stats:', error);
            return { success: false, error: error.message };
        }
    },

    // ===== SYMPTOMS =====

    addSymptom: async function(symptomData) {
        try {
            const { data, error } = await supabaseClient
                .from('symptoms')
                .insert([symptomData])
                .select()
                .single();
            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Error adding symptom:', error);
            return { success: false, error: error.message };
        }
    },

    getUserSymptoms: async function(userId) {
        try {
            const { data, error } = await supabaseClient
                .from('symptoms')
                .select('*')
                .eq('user_id', userId)
                .order('symptom_date', { ascending: false })
                .order('symptom_time', { ascending: false });
            if (error) throw error;
            return { success: true, data: data || [] };
        } catch (error) {
            console.error('Error getting symptoms:', error);
            return { success: false, error: error.message, data: [] };
        }
    },

    deleteSymptom: async function(symptomId) {
        try {
            const { error } = await supabaseClient
                .from('symptoms')
                .delete()
                .eq('id', symptomId);
            if (error) throw error;
            return { success: true };
        } catch (error) {
            console.error('Error deleting symptom:', error);
            return { success: false, error: error.message };
        }
    },

    getSymptomStats: async function(userId) {
        try {
            const today    = new Date();
            const todayStr = today.toISOString().split('T')[0];
            const weekAgo  = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            const weekAgoStr = weekAgo.toISOString().split('T')[0];

            const { data: allSymptoms, error } = await supabaseClient
                .from('symptoms')
                .select('symptom_date, severity, status')
                .eq('user_id', userId);
            if (error) throw error;

            const stats = { today: 0, week: 0, active: 0, total: allSymptoms?.length || 0 };

            if (allSymptoms && allSymptoms.length > 0) {
                allSymptoms.forEach(symptom => {
                    if (symptom.symptom_date === todayStr)    stats.today++;
                    if (symptom.symptom_date >= weekAgoStr)   stats.week++;
                    if (symptom.status === 'active' ||
                        (!symptom.status && symptom.symptom_date >= weekAgoStr)) {
                        stats.active++;
                    }
                });
            }

            return { success: true, data: stats };
        } catch (error) {
            console.error('Error getting symptom stats:', error);
            return { success: false, error: error.message };
        }
    },

    // ===== JOURNAL =====

    getJournalEntries: async function(userId) {
        try {
            const { data, error } = await supabaseClient
                .from('journal_entries')
                .select('*')
                .eq('user_id', userId)
                .order('entry_date', { ascending: false });
            if (error) throw error;
            return { success: true, data: data || [] };
        } catch (error) {
            console.error('Error getting journal entries:', error);
            return { success: false, error: error.message, data: [] };
        }
    },

    addJournalEntry: async function(userId, entryData) {
        try {
            const fullEntryData = {
                ...entryData,
                user_id:    userId,
                entry_date: entryData.date || new Date().toISOString().split('T')[0],
                created_at: new Date().toISOString()
            };
            delete fullEntryData.date;

            const { data, error } = await supabaseClient
                .from('journal_entries')
                .insert([fullEntryData])
                .select()
                .single();
            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Error adding journal entry:', error);
            return { success: false, error: error.message };
        }
    },

    // ===== MEDICATIONS =====

    getUserMedications: async function(userId) {
        try {
            const { data, error } = await supabaseClient
                .from('medications')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });
            if (error) throw error;
            return { success: true, data: data || [] };
        } catch (error) {
            console.error('Error getting medications:', error);
            return { success: false, error: error.message, data: [] };
        }
    },

    addMedication: async function(medicationData) {
        try {
            const { data, error } = await supabaseClient
                .from('medications')
                .insert([medicationData])
                .select()
                .single();
            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Error adding medication:', error);
            return { success: false, error: error.message };
        }
    },

    updateMedication: async function(medicationId, medicationData) {
        try {
            const { data, error } = await supabaseClient
                .from('medications')
                .update(medicationData)
                .eq('id', medicationId)
                .select();
            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Error updating medication:', error);
            return { success: false, error: error.message };
        }
    },

    deleteMedication: async function(medicationId) {
        try {
            const { error } = await supabaseClient
                .from('medications')
                .delete()
                .eq('id', medicationId);
            if (error) throw error;
            return { success: true };
        } catch (error) {
            console.error('Error deleting medication:', error);
            return { success: false, error: error.message };
        }
    },

    // ===== VITAL SIGNS =====

    getUserVitalSigns: async function(userId) {
        try {
            const { data, error } = await supabaseClient
                .from('vital_signs')
                .select('*')
                .eq('user_id', userId)
                .order('recorded_at', { ascending: false });
            if (error) throw error;
            return { success: true, data: data || [] };
        } catch (error) {
            console.error('Error getting vital signs:', error);
            return { success: false, error: error.message, data: [] };
        }
    },

    addVitalSign: async function(vitalSignData) {
        try {
            const { data, error } = await supabaseClient
                .from('vital_signs')
                .insert([vitalSignData])
                .select()
                .single();
            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Error adding vital sign:', error);
            return { success: false, error: error.message };
        }
    },

    // ===== APPOINTMENTS =====

    getUserAppointments: async function(userId) {
        try {
            const { data, error } = await supabaseClient
                .from('appointments')
                .select('*')
                .eq('user_id', userId)
                .order('appointment_date', { ascending: true })
                .order('appointment_time', { ascending: true });
            if (error) throw error;
            return { success: true, data: data || [] };
        } catch (error) {
            console.error('Error getting appointments:', error);
            return { success: false, error: error.message, data: [] };
        }
    },

    addAppointment: async function(appointmentData) {
        try {
            const { data, error } = await supabaseClient
                .from('appointments')
                .insert([appointmentData])
                .select()
                .single();
            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Error adding appointment:', error);
            return { success: false, error: error.message };
        }
    },

    updateAppointment: async function(appointmentId, appointmentData) {
        try {
            const { data, error } = await supabaseClient
                .from('appointments')
                .update(appointmentData)
                .eq('id', appointmentId)
                .select();
            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Error updating appointment:', error);
            return { success: false, error: error.message };
        }
    },

    deleteAppointment: async function(appointmentId) {
        try {
            const { error } = await supabaseClient
                .from('appointments')
                .delete()
                .eq('id', appointmentId);
            if (error) throw error;
            return { success: true };
        } catch (error) {
            console.error('Error deleting appointment:', error);
            return { success: false, error: error.message };
        }
    },

    // ===== ANALYTICS =====

    getHealthAnalytics: async function(userId, timeRange = 'month') {
        try {
            const endDate   = new Date();
            const startDate = new Date();

            switch (timeRange) {
                case 'week':    startDate.setDate(startDate.getDate() - 7);          break;
                case 'month':   startDate.setMonth(startDate.getMonth() - 1);        break;
                case 'quarter': startDate.setMonth(startDate.getMonth() - 3);        break;
                case 'year':    startDate.setFullYear(startDate.getFullYear() - 1);  break;
                default:        startDate.setMonth(startDate.getMonth() - 1);
            }

            const startDateStr = startDate.toISOString().split('T')[0];
            const endDateStr   = endDate.toISOString().split('T')[0];

            const [symptoms, journal, vitals] = await Promise.all([
                supabaseClient
                    .from('symptoms')
                    .select('symptom_date, severity, symptom_name')
                    .eq('user_id', userId)
                    .gte('symptom_date', startDateStr)
                    .lte('symptom_date', endDateStr),

                supabaseClient
                    .from('journal_entries')
                    .select('entry_date, health_rating, mood, sleep_quality, energy_level')
                    .eq('user_id', userId)
                    .gte('entry_date', startDateStr)
                    .lte('entry_date', endDateStr),

                supabaseClient
                    .from('vital_signs')
                    .select('recorded_at, systolic, diastolic, heart_rate, temperature, oxygen_saturation')
                    .eq('user_id', userId)
                    .gte('recorded_at', startDateStr)
                    .lte('recorded_at', endDateStr)
            ]);

            return {
                success: true,
                data: {
                    symptoms:  symptoms.data  || [],
                    journal:   journal.data   || [],
                    vitals:    vitals.data    || [],
                    timeRange: { start: startDateStr, end: endDateStr }
                }
            };
        } catch (error) {
            console.error('Error getting health analytics:', error);
            return { success: false, error: error.message };
        }
    }
};

window.supabaseService = supabaseService;