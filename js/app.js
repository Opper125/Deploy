/* ============================================
   DeployHub - Main Application Controller
   ============================================ */

// ============================================
// App Initialization
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
    // Show loading screen
    const loadingScreen = document.getElementById('loadingScreen');

    // Terminal animation on hero
    animateTerminal();

    // Check for existing session
    const hasSession = await checkSession();

    // Hide loading screen
    setTimeout(() => {
        if (loadingScreen) {
            loadingScreen.classList.add('hidden');
        }
    }, 1500);

    // If logged in, check if should show dashboard
    if (hasSession) {
        // Check URL hash
        if (window.location.hash === '#dashboard') {
            goToDashboard();
        }
    }

    // Setup navbar scroll effect
    setupNavbarScroll();

    // Setup keyboard shortcuts
    setupKeyboardShortcuts();

    // Load JSONBin key from settings
    const savedKey = localStorage.getItem('dh_jsonbin_key');
    if (savedKey) {
        db.setMasterKey(savedKey);
    }
});

// ============================================
// Navigation Functions
// ============================================
function goHome() {
    if (currentUser) {
        showLandingPage();
    } else {
        showLandingPage();
    }
}

function showLandingPage() {
    document.getElementById('landingPage').style.display = 'block';
    document.getElementById('dashboard').style.display = 'none';
    window.location.hash = '';
    document.body.style.overflow = '';
}

function goToDashboard() {
    if (!currentUser) {
        showLogin();
        return;
    }

    document.getElementById('landingPage').style.display = 'none';
    document.getElementById('dashboard').style.display = 'block';
    window.location.hash = '#dashboard';

    // Load dashboard data
    loadDashboardData();

    // Show overview by default
    showDashSection('overview');
}

function scrollToFeatures() {
    document.getElementById('features').scrollIntoView({ behavior: 'smooth' });
}

function showDocs() {
    showToast('info', 'Documentation', 'Documentation portal coming soon!');
}

// ============================================
// Dashboard Section Navigation
// ============================================
function showDashSection(sectionName) {
    // Hide all sections
    document.querySelectorAll('.dash-section').forEach(el => {
        el.style.display = 'none';
    });

    // Show target section
    const target = document.getElementById(`sec-${sectionName}`);
    if (target) {
        target.style.display = 'block';
    }

    // Update sidebar active
    document.querySelectorAll('.sidebar-link').forEach(link => {
        link.classList.remove('active');
        if (link.dataset.section === sectionName) {
            link.classList.add('active');
        }
    });

    // Close mobile sidebar
    const sidebar = document.getElementById('sidebar');
    if (window.innerWidth <= 1024 && sidebar) {
        sidebar.classList.remove('show');
    }

    // Section-specific loading
    switch (sectionName) {
        case 'overview':
            loadDashboardData();
            renderRecentProjects();
            break;
        case 'projects':
            renderProjectsList();
            break;
        case 'newDeploy':
            if (currentWizardStep === 1) {
                checkGitHubConnection();
            }
            break;
        case 'domains':
            renderDomainsList();
            break;
        case 'security':
            renderSecurityCenter();
            break;
        case 'vps':
            loadVPSData();
            break;
        case 'settings':
            loadSettingsData();
            break;
    }
}

// ============================================
// Load Dashboard Data
// ============================================
function loadDashboardData() {
    if (!currentUser) return;

    const projects = Utils.loadLocal(`projects_${currentUser.id}`) || [];
    const activeProjects = projects.filter(p => p.status === 'active');
    const domains = projects.filter(p => p.domain && p.status !== 'deleted');
    const deployments = Utils.loadLocal(`deployments_${currentUser.id}`) || [];

    // Update stats
    const totalEl = document.getElementById('totalProjects');
    const activeEl = document.getElementById('activeSites');
    const domainsEl = document.getElementById('totalDomains');
    const deploysEl = document.getElementById('totalDeploys');
    const projectsBadge = document.getElementById('projectsBadge');

    if (totalEl) animateNumber(totalEl, projects.filter(p => p.status !== 'deleted').length);
    if (activeEl) animateNumber(activeEl, activeProjects.length);
    if (domainsEl) animateNumber(domainsEl, domains.length);
    if (deploysEl) animateNumber(deploysEl, deployments.length);
    if (projectsBadge) projectsBadge.textContent = projects.filter(p => p.status !== 'deleted').length;
}

// Animate number counting
function animateNumber(el, target) {
    const current = parseInt(el.textContent) || 0;
    if (current === target) return;

    const duration = 500;
    const step = (target - current) / (duration / 16);
    let value = current;

    const animate = () => {
        value += step;
        if ((step > 0 && value >= target) || (step < 0 && value <= target)) {
            el.textContent = target;
            return;
        }
        el.textContent = Math.round(value);
        requestAnimationFrame(animate);
    };

    animate();
}

// ============================================
// Load Settings Data
// ============================================
function loadSettingsData() {
    if (!currentUser) return;

    const settingsName = document.getElementById('settingsName');
    const settingsEmail = document.getElementById('settingsEmail');
    const settingsJsonbinKey = document.getElementById('settingsJsonbinKey');
    const settingsGHToken = document.getElementById('settingsGHToken');

    if (settingsName) settingsName.value = currentUser.name || '';
    if (settingsEmail) settingsEmail.value = currentUser.email || '';
    if (settingsJsonbinKey) settingsJsonbinKey.value = db.getMasterKey() || '';
    if (settingsGHToken) settingsGHToken.value = currentUser.githubToken || '';
}

// ============================================
// Sidebar Toggle (Mobile)
// ============================================
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
        sidebar.classList.toggle('show');
    }
}

// ============================================
// Mobile Nav Toggle
// ============================================
function toggleMobileNav() {
    const links = document.getElementById('navLinks');
    const auth = document.getElementById('navAuth');
    if (links) links.classList.toggle('mobile-show');
    if (auth) auth.classList.toggle('mobile-show');
}

// ============================================
// Navbar Scroll Effect
// ============================================
function setupNavbarScroll() {
    window.addEventListener('scroll', () => {
        const navbar = document.getElementById('navbar');
        if (navbar) {
            if (window.scrollY > 50) {
                navbar.classList.add('scrolled');
            } else {
                navbar.classList.remove('scrolled');
            }
        }
    });
}

// ============================================
// Terminal Animation (Hero)
// ============================================
function animateTerminal() {
    const lines = [
        'termLine1', 'termLine2', 'termLine3',
        'termLine4', 'termLine5', 'termLine6', 'termLine7'
    ];

    lines.forEach((id, index) => {
        setTimeout(() => {
            const el = document.getElementById(id);
            if (el) {
                el.style.opacity = '1';
                el.style.transition = 'opacity 0.3s ease';
            }
        }, 800 + (index * 600));
    });
}

// ============================================
// Keyboard Shortcuts
// ============================================
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Escape - close modals
        if (e.key === 'Escape') {
            closeModals();
            closeProjectModal();
            closeConfirm();

            const dropdown = document.getElementById('userDropdown');
            if (dropdown) dropdown.classList.remove('show');
        }

        // Ctrl+K - search (if on dashboard)
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            if (currentUser && document.getElementById('dashboard').style.display !== 'none') {
                e.preventDefault();
                showDashSection('projects');
                setTimeout(() => {
                    const search = document.getElementById('searchProjects');
                    if (search) search.focus();
                }, 200);
            }
        }

        // Ctrl+N - new deploy
        if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
            if (currentUser && document.getElementById('dashboard').style.display !== 'none') {
                e.preventDefault();
                showDashSection('newDeploy');
            }
        }
    });
}

// ============================================
// Handle Browser Back/Forward
// ============================================
window.addEventListener('hashchange', () => {
    const hash = window.location.hash;
    if (hash === '#dashboard' && currentUser) {
        goToDashboard();
    } else if (!hash || hash === '#') {
        showLandingPage();
    }
});

// ============================================
// Service Worker Registration (PWA Support)
// ============================================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        // Optional: Register service worker for offline support
        // navigator.serviceWorker.register('/sw.js');
    });
}

// ============================================
// Global Error Handler
// ============================================
window.addEventListener('error', (e) => {
    console.error('Global error:', e.error);
});

window.addEventListener('unhandledrejection', (e) => {
    console.error('Unhandled promise rejection:', e.reason);
});

// ============================================
// Prevent form resubmission
// ============================================
if (window.history.replaceState) {
    window.history.replaceState(null, null, window.location.href);
}

// ============================================
// Auto-check for updates
// ============================================
setInterval(() => {
    // Periodic session check
    const session = Utils.loadLocal('session');
    if (session && new Date(session.expiresAt) < new Date()) {
        logout();
        showToast('warning', 'Session Expired', 'Please log in again');
    }
}, 60000); // Check every minute

console.log('🚀 DeployHub Application Loaded Successfully');
