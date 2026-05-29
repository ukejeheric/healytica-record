// supabase-service.js - Supabase Service Layer
// ===========================================

class SupabaseService {
    constructor() {
        this.supabase = window.supabase;
        this.currentUser = null;
    }

    // Initialize service
    initialize() {
        // Get current session
        this.supabase.auth.getSession().then(({ data: { session } }) => {
            if (session) {
                this.currentUser = session.user;
            }
        });

        // Listen for auth changes
        this.supabase.auth.onAuthStateChange((event, session) => {
            this.currentUser = session?.user || null;
        });
    }

    // Get current user
    getCurrentUser() {
        return this.currentUser;
    }

    // ========== PROFILE OPERATIONS ==========

    // Get user profile
    async getUserProfile(userId) {
        try {
            const { data, error } = await this.supabase
                .from('user_profiles')
                .select('*')
                .eq('user_id', userId)
                .single();

            if (error) {
                if (error.code === 'PGRST116') { // No rows returned
                    return null;
                }
                throw error;
            }

            return data;
        } catch (error) {
            console.error('Error getting user profile:', error);
            throw error;
        }
    }

    // Update user profile
    async updateUserProfile(userId, profileData) {
        try {
            // Check if profile exists
            const existingProfile = await this.getUserProfile(userId);
            
            let result;
            
            if (existingProfile) {
                // Update existing profile
                const { data, error } = await this.supabase
                    .from('user_profiles')
                    .update(profileData)
                    .eq('user_id', userId)
                    .select()
                    .single();

                if (error) throw error;
                result = data;
            } else {
                // Create new profile
                const { data, error } = await this.supabase
                    .from('user_profiles')
                    .insert([{ ...profileData, created_at: new Date().toISOString() }])
                    .select()
                    .single();

                if (error) throw error;
                result = data;
            }

            return { success: true, data: result };
        } catch (error) {
            console.error('Error updating user profile:', error);
            return { success: false, error: error.message };
        }
    }

    // ========== DOCUMENT OPERATIONS ==========

    // Get user documents
    async getUserDocuments(userId) {
        try {
            const { data, error } = await this.supabase
                .from('health_documents')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });

            if (error) throw error;

            return { success: true, data: data || [] };
        } catch (error) {
            console.error('Error getting user documents:', error);
            return { success: false, error: error.message };
        }
    }

    // Upload document
    async uploadDocument(userId, file) {
        try {
            // Create unique filename
            const fileExt = file.name.split('.').pop();
            const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
            const filePath = `health-documents/${fileName}`;

            // Upload to storage
            const { error: uploadError } = await this.supabase.storage
                .from('documents')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            // Get public URL
            const { data: urlData } = this.supabase.storage
                .from('documents')
                .getPublicUrl(filePath);

            // Save document metadata
            const { data, error: dbError } = await this.supabase
                .from('health_documents')
                .insert([{
                    user_id: userId,
                    file_name: file.name,
                    file_path: filePath,
                    file_url: urlData.publicUrl,
                    file_type: file.type,
                    file_size: file.size,
                    created_at: new Date().toISOString()
                }])
                .select()
                .single();

            if (dbError) throw dbError;

            return { success: true, data };
        } catch (error) {
            console.error('Error uploading document:', error);
            return { success: false, error: error.message };
        }
    }

    // Get document URL
    async getDocumentUrl(filePath) {
        try {
            const { data } = this.supabase.storage
                .from('documents')
                .getPublicUrl(filePath);

            return { success: true, url: data.publicUrl };
        } catch (error) {
            console.error('Error getting document URL:', error);
            return { success: false, error: error.message };
        }
    }

    // Download document
    async downloadDocument(filePath, fileName) {
        try {
            const { data, error } = await this.supabase.storage
                .from('documents')
                .download(filePath);

            if (error) throw error;

            // Create download link
            const url = URL.createObjectURL(data);
            const a = document.createElement('a');
            a.href = url;
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
    }

    // Delete document
    async deleteDocument(documentId, filePath) {
        try {
            // Delete from storage
            const { error: storageError } = await this.supabase.storage
                .from('documents')
                .remove([filePath]);

            if (storageError) throw storageError;

            // Delete from database
            const { error: dbError } = await this.supabase
                .from('health_documents')
                .delete()
                .eq('id', documentId);

            if (dbError) throw dbError;

            return { success: true };
        } catch (error) {
            console.error('Error deleting document:', error);
            return { success: false, error: error.message };
        }
    }

    // ========== SHARE & BACKUP OPERATIONS ==========

    // Generate share token
    async generateShareToken(profileId) {
        try {
            // Create a share token (valid for 7 days)
            const token = btoa(`${profileId}:${Date.now() + 7 * 24 * 60 * 60 * 1000}`);
            
            // In a real app, save this token to the database
            const { data, error } = await this.supabase
                .from('share_tokens')
                .insert([{
                    profile_id: profileId,
                    token: token,
                    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                    created_at: new Date().toISOString()
                }])
                .select()
                .single();

            if (error) throw error;

            return { success: true, token };
        } catch (error) {
            console.error('Error generating share token:', error);
            return { success: false, error: error.message };
        }
    }

    // Create backup
    async createBackup(userId, backupData) {
        try {
            const { data, error } = await this.supabase
                .from('backups')
                .insert([{
                    user_id: userId,
                    backup_data: backupData,
                    created_at: new Date().toISOString()
                }])
                .select()
                .single();

            if (error) throw error;

            return { success: true, data };
        } catch (error) {
            console.error('Error creating backup:', error);
            return { success: false, error: error.message };
        }
    }

    // ========== AUTH OPERATIONS ==========

    // Sign up
    async signUp(email, password, fullName) {
        try {
            const { data, error } = await this.supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        full_name: fullName
                    }
                }
            });

            if (error) throw error;

            return { success: true, user: data.user };
        } catch (error) {
            console.error('Error signing up:', error);
            return { success: false, error: error.message };
        }
    }

    // Sign in
    async signIn(email, password) {
        try {
            const { data, error } = await this.supabase.auth.signInWithPassword({
                email,
                password
            });

            if (error) throw error;

            this.currentUser = data.user;
            return { success: true, user: data.user };
        } catch (error) {
            console.error('Error signing in:', error);
            return { success: false, error: error.message };
        }
    }

    // Sign out
    async signOut() {
        try {
            const { error } = await this.supabase.auth.signOut();
            if (error) throw error;

            this.currentUser = null;
            return { success: true };
        } catch (error) {
            console.error('Error signing out:', error);
            return { success: false, error: error.message };
        }
    }

    // Update user metadata
    async updateUserMetadata(metadata) {
        try {
            const { data, error } = await this.supabase.auth.updateUser({
                data: metadata
            });

            if (error) throw error;

            this.currentUser = data.user;
            return { success: true, user: data.user };
        } catch (error) {
            console.error('Error updating user metadata:', error);
            return { success: false, error: error.message };
        }
    }
}

// Add this to your supabaseService.js if not already present
async function addLabResult(labData) {
    try {
        const { data, error } = await supabase
            .from('lab_results')
            .insert([labData])
            .select()
            .single();
        
        if (error) {
            console.error('Error adding lab result:', error);
            throw error;
        }
        
        console.log('Lab result added successfully:', data);
        return data;
    } catch (error) {
        console.error('Error in addLabResult:', error);
        throw error;
    }
}

// Initialize and export service
const supabaseService = new SupabaseService();
window.supabaseService = supabaseService;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    supabaseService.initialize();
});