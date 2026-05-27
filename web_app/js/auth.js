// auth.js - FIXED Email Authentication
// ======================================
// FIXES APPLIED:
// 1. isCheckingAuth now resets on successful login (was permanently locking the button)
// 2. Email verification check added after registration
// 3. Password reset uses inline UI instead of browser prompt()
// 4. checkAuthForPage() now uses a whitelist approach (protects ALL pages by default)
// 5. Removed duplicate showMessage definition (keep only the one in auth.js)

let isCheckingAuth = false;

async function setupAuthListeners() {
    console.log('Setting up email authentication...');

    // Only check auth on index.html / root
    if (window.location.pathname.includes('index.html') ||
        window.location.pathname.endsWith('/') ||
        window.location.pathname === '') {

        try {
            const user = await supabaseService.getCurrentUser();
            if (user) {
                console.log('Already logged in, redirecting to dashboard...');
                showMessage('info', 'Already logged in, redirecting...');
                setTimeout(() => {
                    window.location.href = 'dashboard.html';
                }, 1000);
                return;
            }
        } catch (error) {
            console.warn('Session check failed, showing login form:', error);
        }
    }

    // ===== TAB SWITCHING =====
    const loginTab     = document.getElementById('loginTab');
    const registerTab  = document.getElementById('registerTab');
    const showRegister = document.getElementById('showRegister');
    const showLogin    = document.getElementById('showLogin');

    if (loginTab && registerTab) {
        loginTab.addEventListener('click',  () => switchTab('login'));
        registerTab.addEventListener('click', () => switchTab('register'));
    }
    if (showRegister) showRegister.addEventListener('click', (e) => { e.preventDefault(); switchTab('register'); });
    if (showLogin)    showLogin.addEventListener('click',    (e) => { e.preventDefault(); switchTab('login'); });

    // ===== LOGIN =====
    const loginBtn = document.getElementById('loginBtn');
    if (loginBtn) {
        loginBtn.addEventListener('click', handleLogin);
        const loginPassword = document.getElementById('loginPassword');
        if (loginPassword) {
            loginPassword.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') handleLogin();
            });
        }
    }

    // ===== REGISTER =====
    const registerBtn = document.getElementById('registerBtn');
    if (registerBtn) {
        registerBtn.addEventListener('click', handleRegister);
        const confirmPassword = document.getElementById('confirmPassword');
        if (confirmPassword) {
            confirmPassword.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') handleRegister();
            });
        }
    }

    // ===== FORGOT PASSWORD - inline UI (replaces browser prompt) =====
    const forgotPassword = document.getElementById('forgotPassword');
    if (forgotPassword) {
        forgotPassword.addEventListener('click', handleForgotPassword);
    }

    console.log('Auth setup complete');
}

// ===== HANDLERS =====

async function handleLogin() {
    if (isCheckingAuth) return;
    isCheckingAuth = true;

    const loginBtn = document.getElementById('loginBtn');
    const email    = document.getElementById('loginEmail')?.value.trim();
    const password = document.getElementById('loginPassword')?.value;

    if (!email || !password) {
        showMessage('error', 'Please enter email and password');
        isCheckingAuth = false;
        return;
    }

    if (!isValidEmail(email)) {
        showMessage('error', 'Please enter a valid email address');
        isCheckingAuth = false;
        return;
    }

    const originalText = loginBtn.innerHTML;
    loginBtn.disabled  = true;
    loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> LOGGING IN...';

    try {
        const result = await supabaseService.signInWithEmail(email, password);

        if (result.success) {
            showMessage('success', 'Login successful! Redirecting...');
            localStorage.setItem('lastLoginTime', Date.now().toString());

            // FIX 1: Reset flag before redirect so back-navigation doesn't lock the button
            isCheckingAuth = false;

            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 1000);
        } else {
            showMessage('error', result.error || 'Login failed');
            loginBtn.disabled  = false;
            loginBtn.innerHTML = originalText;
            isCheckingAuth     = false;
        }
    } catch (error) {
        console.error('Login error:', error);
        showMessage('error', 'Login failed. Please try again.');
        loginBtn.disabled  = false;
        loginBtn.innerHTML = originalText;
        isCheckingAuth     = false;
    }
}

async function handleRegister() {
    if (isCheckingAuth) return;
    isCheckingAuth = true;

    const registerBtn     = document.getElementById('registerBtn');
    const email           = document.getElementById('registerEmail')?.value.trim();
    const mobile          = document.getElementById('registerMobile')?.value.trim() || '';
    const countryCode     = document.getElementById('registerCountry')?.value || '+234';
    const password        = document.getElementById('registerPassword')?.value;
    const confirmPassword = document.getElementById('confirmPassword')?.value;

    if (!email || !password || !confirmPassword) {
        showMessage('error', 'Please fill all required fields');
        isCheckingAuth = false;
        return;
    }

    if (!isValidEmail(email)) {
        showMessage('error', 'Please enter a valid email address');
        isCheckingAuth = false;
        return;
    }

    if (password.length < 6) {
        showMessage('error', 'Password must be at least 6 characters');
        isCheckingAuth = false;
        return;
    }

    if (password !== confirmPassword) {
        showMessage('error', 'Passwords do not match');
        isCheckingAuth = false;
        return;
    }

    const originalText     = registerBtn.innerHTML;
    registerBtn.disabled   = true;
    registerBtn.innerHTML  = '<i class="fas fa-spinner fa-spin"></i> CREATING ACCOUNT...';

    try {
        const result = await supabaseService.signUpWithEmail(email, password, mobile, countryCode);

        if (result.success) {
            // FIX 2: Check if email verification is required
            const needsVerification = result.data && !result.data.confirmed_at;

            if (needsVerification) {
                showMessage('success', 'Account created! Please check your email and click the verification link before logging in.');
            } else {
                showMessage('success', result.message || 'Account created successfully!');
            }

            // Clear form
            document.getElementById('registerEmail').value    = '';
            document.getElementById('registerMobile').value   = '';
            document.getElementById('registerPassword').value = '';
            document.getElementById('confirmPassword').value  = '';

            setTimeout(() => {
                switchTab('login');
                // Only pre-fill email if no verification needed
                if (!needsVerification) {
                    document.getElementById('loginEmail').value = email;
                }
                isCheckingAuth = false;
            }, 2500);

        } else {
            showMessage('error', result.error || 'Registration failed');
            registerBtn.disabled  = false;
            registerBtn.innerHTML = originalText;
            isCheckingAuth        = false;
        }
    } catch (error) {
        console.error('Registration error:', error);
        showMessage('error', 'Registration failed. Please try again.');
        registerBtn.disabled  = false;
        registerBtn.innerHTML = originalText;
        isCheckingAuth        = false;
    }
}

// FIX 3: Replaced browser prompt() with inline reset UI
function handleForgotPassword(e) {
    e.preventDefault();

    // Remove any existing reset UI first
    const existing = document.getElementById('forgotPasswordUI');
    if (existing) { existing.remove(); return; }

    const loginForm = document.getElementById('loginForm');
    if (!loginForm) return;

    const resetUI = document.createElement('div');
    resetUI.id = 'forgotPasswordUI';
    resetUI.style.cssText = 'margin-top:12px; padding:12px; border:1px solid rgba(255,255,255,0.2); border-radius:8px; background:rgba(255,255,255,0.05);';
    resetUI.innerHTML = `
        <label style="display:block; margin-bottom:6px; font-size:13px; color:inherit;">Enter your email to receive a reset link:</label>
        <div style="display:flex; gap:8px;">
            <input 
                type="email" 
                id="resetEmailInput" 
                placeholder="your@email.com"
                style="flex:1; padding:8px 12px; border-radius:6px; border:1px solid rgba(255,255,255,0.3); background:rgba(255,255,255,0.1); color:inherit; font-size:14px;"
            >
            <button 
                id="sendResetBtn"
                style="padding:8px 14px; border-radius:6px; border:none; background:var(--primary-color, #1976D2); color:#fff; cursor:pointer; font-size:13px; white-space:nowrap;"
            >Send link</button>
        </div>
    `;

    loginForm.appendChild(resetUI);

    // Focus the input
    setTimeout(() => document.getElementById('resetEmailInput')?.focus(), 50);

    // Wire up send button
    document.getElementById('sendResetBtn').addEventListener('click', async () => {
        const email    = document.getElementById('resetEmailInput')?.value.trim();
        const sendBtn  = document.getElementById('sendResetBtn');

        if (!email || !isValidEmail(email)) {
            showMessage('error', 'Please enter a valid email address');
            return;
        }

        sendBtn.disabled   = true;
        sendBtn.textContent = 'Sending...';

        try {
            const result = await supabaseService.resetPassword(email);
            if (result.success) {
                showMessage('success', 'Password reset link sent! Check your email.');
                resetUI.remove();
            } else {
                showMessage('error', result.error || 'Failed to send reset link.');
                sendBtn.disabled    = false;
                sendBtn.textContent = 'Send link';
            }
        } catch (error) {
            console.error('Password reset error:', error);
            showMessage('error', 'Failed to send reset link.');
            sendBtn.disabled    = false;
            sendBtn.textContent = 'Send link';
        }
    });

    // Allow Enter key in input
    document.getElementById('resetEmailInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') document.getElementById('sendResetBtn').click();
    });
}

// ===== UTILITIES =====

function switchTab(tab) {
    const loginTab    = document.getElementById('loginTab');
    const registerTab = document.getElementById('registerTab');
    const loginForm   = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');

    // Remove inline reset UI when switching tabs
    const resetUI = document.getElementById('forgotPasswordUI');
    if (resetUI) resetUI.remove();

    if (tab === 'login') {
        loginTab?.classList.add('active');
        registerTab?.classList.remove('active');
        if (loginForm)    { loginForm.classList.add('active');    loginForm.style.display = 'block'; }
        if (registerForm) { registerForm.classList.remove('active'); registerForm.style.display = 'none'; }
    } else {
        registerTab?.classList.add('active');
        loginTab?.classList.remove('active');
        if (registerForm) { registerForm.classList.add('active');  registerForm.style.display = 'block'; }
        if (loginForm)    { loginForm.classList.remove('active');  loginForm.style.display = 'none'; }
    }
    clearMessages();
}

function isValidEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

function clearMessages() {
    const container = document.getElementById('messageContainer');
    if (container) container.innerHTML = '';
}

// FIX 5: Single definition of showMessage (remove the duplicate in index.html)
function showMessage(type, text) {
    const container = document.getElementById('messageContainer');
    if (!container) {
        console.log(`[${type.toUpperCase()}] ${text}`);
        return;
    }

    // Prevent stacking identical messages
    const existing = container.querySelectorAll('.message-text');
    for (const el of existing) {
        if (el.textContent === text) return;
    }

    const message = document.createElement('div');
    message.className = `message ${type}`;

    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };

    message.innerHTML = `
        <span class="message-icon">${icons[type] || 'ℹ️'}</span>
        <span class="message-text">${text}</span>
    `;

    container.appendChild(message);

    setTimeout(() => {
        message.style.opacity = '0';
        message.style.transition = 'opacity 0.3s';
        setTimeout(() => {
            if (message.parentNode) message.parentNode.removeChild(message);
        }, 300);
    }, 5000);
}

// ===== CHECK AUTH FOR PROTECTED PAGES =====
// FIX 4: Whitelist approach — only index.html is public, everything else requires auth
async function checkAuthForPage() {
    console.log('Checking authentication for protected page...');

    // Public pages that do NOT require login
    const publicPages = ['index.html', ''];
    const currentPage = window.location.pathname.split('/').pop();

    if (publicPages.includes(currentPage)) {
        return true; // No auth needed
    }

    try {
        const user = await supabaseService.getCurrentUser();
        if (!user) {
            console.log('No authenticated user, redirecting to login...');
            showMessage('error', 'Please login to continue');
            setTimeout(() => {
                window.location.href = 'index.html?redirect=auth';
            }, 1500);
            return false;
        }

        console.log('User authenticated:', user.email);
        return true;
    } catch (error) {
        console.error('Auth check error:', error);
        showMessage('error', 'Authentication error. Please login again.');
        setTimeout(() => {
            window.location.href = 'index.html?redirect=auth';
        }, 1500);
        return false;
    }
}

// ===== EXPORTS =====
window.setupAuthListeners = setupAuthListeners;
window.showMessage        = showMessage;
window.checkAuthForPage   = checkAuthForPage;
window.isValidEmail       = isValidEmail;