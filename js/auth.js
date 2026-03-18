/* ============================================
   DeployHub - Authentication System
   ============================================ */

// Current user state
let currentUser = null;

// ============================================
// Show/Hide Auth Modals
// ============================================
function showLogin() {
    closeModals();
    document.getElementById('loginModal').classList.add('show');
    document.getElementById('loginEmail').focus();
}

function showRegister() {
    closeModals();
    document.getElementById('registerModal').classList.add('show');
    document.getElementById('regName').focus();
}

function closeModals() {
    document.querySelectorAll('.modal').forEach(m => m.classList.remove('show'));
}

// ============================================
// Password Visibility Toggle
// ============================================
function togglePassword(inputId, btn) {
    const input = document.getElementById(inputId);
    const icon = btn.querySelector('i');
    if (input.type === 'password') {
        input.type = 'text';
        icon.className = 'fas fa-eye-slash';
    } else {
        input.type = 'password';
        icon.className = 'fas fa-eye';
    }
}

// ============================================
// Password Strength Checker
// ============================================
function checkPasswordStrength(password) {
    let score = 0;
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
    if (/\d/.test(password)) score++;
    if (/[^a-zA-Z\d]/.test(password)) score++;

    const levels = [
        { text: '', color: '', width: '0%' },
        { text: 'Very Weak', color: '#ff4757', width: '20%' },
        { text: 'Weak', color: '#ff6b81', width: '40%' },
        { text: 'Fair', color: '#ffc107', width: '60%' },
        { text: 'Strong', color: '#00b894', width: '80%' },
        { text: 'Very Strong', color: '#00ff88', width: '100%' }
    ];

    return levels[Math.min(score, 5)];
}

// Password strength UI update
document.addEventListener('DOMContentLoaded', () => {
    const regPwd = document.getElementById('regPassword');
    if (regPwd) {
        regPwd.addEventListener('input', function () {
            const strength = checkPasswordStrength(this.value);
            const fill = document.getElementById('strengthFill');
            const text = document.getElementById('strengthText');
            if (fill) {
                fill.style.width = strength.width;
                fill.style.background = strength.color;
            }
            if (text) {
                text.textContent = strength.text;
                text.style.color = strength.color;
            }
        });
    }
});

// ============================================
// Handle Registration
// ============================================
async function handleRegister(e) {
    e.preventDefault();

    const name = document.getElementById('regName').value.trim();
    const email = document.getElementById('regEmail').value.trim().toLowerCase();
    const password = document.getElementById('regPassword').value;
    const confirmPassword = document.getElementById('regConfirmPassword').value;
    const errorEl = document.getElementById('regError');
    const btn = document.getElementById('regBtn');

    // Validation
    errorEl.style.display = 'none';

    if (!name || name.length < 2) {
        showFormError(errorEl, 'Please enter a valid name (min 2 characters)');
        return;
    }

    if (!Utils.isValidEmail(email)) {
        showFormError(errorEl, 'Please enter a valid email address');
        return;
    }

    if (password.length < 8) {
        showFormError(errorEl, 'Password must be at least 8 characters');
        return;
    }

    if (password !== confirmPassword) {
        showFormError(errorEl, 'Passwords do not match');
        return;
    }

    // Show loading
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner" style="width:20px;height:20px;border-width:2px;margin:0;"></div> Creating Account...';

    try {
        // Check if JSONBin key exists
        if (!db.getMasterKey()) {
            showFormError(errorEl, 'Please set up JSONBin.io Master Key first in Settings');
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-user-plus"></i> Create Account';
            return;
        }

        // Load existing users
        let users = [];
        if (CONFIG.BINS.USERS) {
            const data = await db.read(CONFIG.BINS.USERS);
            if (data && Array.isArray(data.users)) {
                users = data.users;
            } else if (data && Array.isArray(data)) {
                users = data;
            }
        }

        // Check if email already exists
        const existingUser = users.find(u => u.email === email);
        if (existingUser) {
            showFormError(errorEl, 'An account with this email already exists');
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-user-plus"></i> Create Account';
            return;
        }

        // Hash password
        const hashedPassword = await Utils.hashPassword(password);

        // Create user object
        const newUser = {
            id: Utils.generateId(),
            name: name,
            email: email,
            password: hashedPassword,
            avatar: name.charAt(0).toUpperCase(),
            githubToken: '',
            githubUsername: '',
            createdAt: new Date().toISOString(),
            lastLogin: new Date().toISOString(),
            projects: [],
            settings: {
                notifications: true,
                twoFactor: false
            }
        };

        // Save user
        users.push(newUser);

        if (CONFIG.BINS.USERS) {
            await db.update(CONFIG.BINS.USERS, { users: users });
        }

        // Also save locally
        Utils.saveLocal('users', users);

        // Auto login
        setCurrentUser(newUser);

        closeModals();
        showToast('success', 'Account Created!', 'Welcome to DeployHub, ' + name);
        goToDashboard();

    } catch (error) {
        console.error('Registration error:', error);
        showFormError(errorEl, 'Registration failed. Please try again.');
    }

    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-user-plus"></i> Create Account';
}

// ============================================
// Handle Login
// ============================================
async function handleLogin(e) {
    e.preventDefault();

    const email = document.getElementById('loginEmail').value.trim().toLowerCase();
    const password = document.getElementById('loginPassword').value;
    const errorEl = document.getElementById('loginError');
    const btn = document.getElementById('loginBtn');

    errorEl.style.display = 'none';

    if (!Utils.isValidEmail(email)) {
        showFormError(errorEl, 'Please enter a valid email address');
        return;
    }

    if (!password) {
        showFormError(errorEl, 'Please enter your password');
        return;
    }

    btn.disabled = true;
    btn.innerHTML = '<div class="spinner" style="width:20px;height:20px;border-width:2px;margin:0;"></div> Logging in...';

    try {
        // Load users
        let users = [];

        if (CONFIG.BINS.USERS && db.getMasterKey()) {
            const data = await db.read(CONFIG.BINS.USERS);
            if (data && Array.isArray(data.users)) {
                users = data.users;
            } else if (data && Array.isArray(data)) {
                users = data;
            }
        }

        // Also check local storage
        const localUsers = Utils.loadLocal('users');
        if (localUsers && Array.isArray(localUsers)) {
            // Merge (prefer remote)
            if (users.length === 0) users = localUsers;
        }

        // Find user
        const hashedPassword = await Utils.hashPassword(password);
        const user = users.find(u => u.email === email && u.password === hashedPassword);

        if (!user) {
            showFormError(errorEl, 'Invalid email or password');
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Log In';
            return;
        }

        // Update last login
        user.lastLogin = new Date().toISOString();
        if (CONFIG.BINS.USERS && db.getMasterKey()) {
            await db.update(CONFIG.BINS.USERS, { users: users });
        }
        Utils.saveLocal('users', users);

        // Set current user
        setCurrentUser(user);

        closeModals();
        showToast('success', 'Welcome Back!', 'Hello, ' + user.name);
        goToDashboard();

    } catch (error) {
        console.error('Login error:', error);
        showFormError(errorEl, 'Login failed. Check your connection and try again.');
    }

    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Log In';
}

// ============================================
// GitHub OAuth Login (Simplified)
// ============================================
function loginWithGitHub() {
    showToast('info', 'GitHub Login', 'Please use the GitHub token method in the Deploy wizard after signing up.');
    showRegister();
}

// ============================================
// Set Current User
// ============================================
function setCurrentUser(user) {
    currentUser = user;

    // Save session
    const session = {
        userId: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar || user.name.charAt(0).toUpperCase(),
        loginAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + CONFIG.SESSION_DURATION).toISOString()
    };
    Utils.saveLocal('session', session);

    // Update UI
    updateAuthUI(true);
}

// ============================================
// Check Existing Session
// ============================================
async function checkSession() {
    const session = Utils.loadLocal('session');
    if (!session) return false;

    // Check expiry
    if (new Date(session.expiresAt) < new Date()) {
        Utils.removeLocal('session');
        return false;
    }

    // Load full user data
    let users = [];
    if (CONFIG.BINS.USERS && db.getMasterKey()) {
        try {
            const data = await db.read(CONFIG.BINS.USERS);
            if (data && Array.isArray(data.users)) {
                users = data.users;
            } else if (data && Array.isArray(data)) {
                users = data;
            }
        } catch (e) {
            // Use local
        }
    }

    const localUsers = Utils.loadLocal('users');
    if (users.length === 0 && localUsers) {
        users = localUsers;
    }

    const user = users.find(u => u.id === session.userId);
    if (user) {
        currentUser = user;
        updateAuthUI(true);
        return true;
    }

    return false;
}

// ============================================
// Logout
// ============================================
function logout() {
    currentUser = null;
    Utils.removeLocal('session');

    // Reset GitHub state
    githubConnected = false;
    githubUser = null;
    githubRepos = [];

    updateAuthUI(false);
    showLandingPage();
    showToast('info', 'Logged Out', 'You have been signed out successfully');
}

// ============================================
// Update Auth UI
// ============================================
function updateAuthUI(isLoggedIn) {
    const navAuth = document.getElementById('navAuth');
    const navUser = document.getElementById('navUser');

    if (isLoggedIn && currentUser) {
        navAuth.style.display = 'none';
        navUser.style.display = 'flex';

        const avatar = currentUser.avatar || currentUser.name.charAt(0).toUpperCase();
        document.getElementById('navAvatar').textContent = avatar;
        document.getElementById('dropdownName').textContent = currentUser.name;
        document.getElementById('dropdownEmail').textContent = currentUser.email;

        // Sidebar
        const sidebarAvatar = document.getElementById('sidebarAvatar');
        const sidebarName = document.getElementById('sidebarUserName');
        if (sidebarAvatar) sidebarAvatar.textContent = avatar;
        if (sidebarName) sidebarName.textContent = currentUser.name;

        // Welcome name
        const welcomeName = document.getElementById('welcomeName');
        if (welcomeName) welcomeName.textContent = currentUser.name.split(' ')[0];

        // Settings
        const settingsName = document.getElementById('settingsName');
        const settingsEmail = document.getElementById('settingsEmail');
        if (settingsName) settingsName.value = currentUser.name;
        if (settingsEmail) settingsEmail.value = currentUser.email;

        // GitHub token in settings
        const settingsGH = document.getElementById('settingsGHToken');
        if (settingsGH && currentUser.githubToken) {
            settingsGH.value = currentUser.githubToken;
        }

    } else {
        navAuth.style.display = 'flex';
        navUser.style.display = 'none';
    }
}

// ============================================
// User Dropdown
// ============================================
function toggleUserMenu() {
    const dropdown = document.getElementById('userDropdown');
    dropdown.classList.toggle('show');
}

// Close dropdown on outside click
document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('userDropdown');
    const avatar = document.getElementById('navAvatar');
    if (dropdown && avatar && !dropdown.contains(e.target) && !avatar.contains(e.target)) {
        dropdown.classList.remove('show');
    }
});

// ============================================
// Save Profile
// ============================================
async function saveProfile() {
    if (!currentUser) return;

    const name = document.getElementById('settingsName').value.trim();
    if (!name || name.length < 2) {
        showToast('error', 'Invalid Name', 'Name must be at least 2 characters');
        return;
    }

    currentUser.name = name;
    currentUser.avatar = name.charAt(0).toUpperCase();

    await saveUserData();
    updateAuthUI(true);
    showToast('success', 'Profile Updated', 'Your profile has been saved');
}

// ============================================
// Save API Keys
// ============================================
async function saveAPIKeys() {
    const jsonbinKey = document.getElementById('settingsJsonbinKey').value.trim();
    const ghToken = document.getElementById('settingsGHToken').value.trim();

    if (jsonbinKey) {
        db.setMasterKey(jsonbinKey);
        CONFIG.JSONBIN_MASTER_KEY = jsonbinKey;
    }

    if (ghToken && currentUser) {
        currentUser.githubToken = ghToken;
        await saveUserData();
    }

    showToast('success', 'API Keys Saved', 'Your API keys have been updated');
}

// ============================================
// Change Password
// ============================================
async function changePassword() {
    if (!currentUser) return;

    const current = document.getElementById('currentPassword').value;
    const newPwd = document.getElementById('newPassword').value;
    const confirm = document.getElementById('confirmNewPassword').value;

    if (!current) {
        showToast('error', 'Error', 'Please enter your current password');
        return;
    }

    const currentHash = await Utils.hashPassword(current);
    if (currentHash !== currentUser.password) {
        showToast('error', 'Error', 'Current password is incorrect');
        return;
    }

    if (newPwd.length < 8) {
        showToast('error', 'Error', 'New password must be at least 8 characters');
        return;
    }

    if (newPwd !== confirm) {
        showToast('error', 'Error', 'New passwords do not match');
        return;
    }

    currentUser.password = await Utils.hashPassword(newPwd);
    await saveUserData();

    document.getElementById('currentPassword').value = '';
    document.getElementById('newPassword').value = '';
    document.getElementById('confirmNewPassword').value = '';

    showToast('success', 'Password Changed', 'Your password has been updated');
}

// ============================================
// Save User Data to DB
// ============================================
async function saveUserData() {
    if (!currentUser) return;

    let users = Utils.loadLocal('users') || [];

    const idx = users.findIndex(u => u.id === currentUser.id);
    if (idx >= 0) {
        users[idx] = currentUser;
    } else {
        users.push(currentUser);
    }

    Utils.saveLocal('users', users);

    // Also save to JSONBin
    if (CONFIG.BINS.USERS && db.getMasterKey()) {
        try {
            await db.update(CONFIG.BINS.USERS, { users: users });
        } catch (e) {
            console.error('Failed to sync users to JSONBin:', e);
        }
    }

    // Update session
    const session = Utils.loadLocal('session');
    if (session) {
        session.name = currentUser.name;
        session.avatar = currentUser.avatar;
        Utils.saveLocal('session', session);
    }
}

// ============================================
// Delete Account
// ============================================
function deleteAccount() {
    showConfirm(
        'Delete Account?',
        'This will permanently delete your account and all projects. This action cannot be undone.',
        async () => {
            if (!currentUser) return;

            let users = Utils.loadLocal('users') || [];
            users = users.filter(u => u.id !== currentUser.id);
            Utils.saveLocal('users', users);

            if (CONFIG.BINS.USERS && db.getMasterKey()) {
                try {
                    await db.update(CONFIG.BINS.USERS, { users: users });
                } catch (e) { }
            }

            // Delete all projects
            Utils.removeLocal(`projects_${currentUser.id}`);

            logout();
            showToast('success', 'Account Deleted', 'Your account has been permanently deleted');
        }
    );
}

// ============================================
// Export Data
// ============================================
function exportData() {
    if (!currentUser) return;

    const projects = Utils.loadLocal(`projects_${currentUser.id}`) || [];
    const exportObj = {
        user: {
            name: currentUser.name,
            email: currentUser.email,
            createdAt: currentUser.createdAt
        },
        projects: projects,
        exportedAt: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `deployhub-export-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);

    showToast('success', 'Data Exported', 'Your data has been downloaded');
}

// ============================================
// Helper: Show Form Error
// ============================================
function showFormError(el, message) {
    el.textContent = message;
    el.style.display = 'flex';
    el.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${message}`;
}
