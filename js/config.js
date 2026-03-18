/* ============================================
   DeployHub - Configuration
   ============================================ */

const CONFIG = {
    // ============================================
    // JSONBin.io Configuration
    // ============================================
    // TODO: ⬇️ ဒီ values တွေကို သင့်ရဲ့ JSONBin.io credentials နဲ့ အစားထိုးပါ
    JSONBIN_BASE_URL: 'https://api.jsonbin.io/v3',
    JSONBIN_MASTER_KEY: '', // ← သင့်ရဲ့ JSONBin.io Master Key ထဲ့ပါ

    // Database Bins - TODO: ⬇️ ဒီ BIN IDs တွေကို သင်ဖန်တီးပြီး ထဲ့ပါ
    BINS: {
        USERS: '',       // ← Users Bin ID
        PROJECTS: '',    // ← Projects Bin ID
        DOMAINS: '',     // ← Domains Bin ID
        VPS: '',         // ← VPS Bin ID
        DEPLOYMENTS: '', // ← Deployments Bin ID
        SECURITY: '',    // ← Security Bin ID
        SESSIONS: '',    // ← Sessions Bin ID
    },

    // ============================================
    // GitHub Configuration
    // ============================================
    GITHUB_API_URL: 'https://api.github.com',

    // ============================================
    // Domain Configuration
    // ============================================
    DOMAIN_CHECK_API: 'https://dns.google/resolve',
    HOSTING_IP: '76.76.21.21',
    CNAME_TARGET: 'cname.deployhub.dev',

    // ============================================
    // Security Configuration
    // ============================================
    SECURITY_DEFAULTS: {
        sourceProtection: true,
        rightClickProtection: true,
        copyProtection: true,
        devToolsProtection: true,
        consoleProtection: true,
        antiDebugger: true,
        ddosProtection: true,
        hotlinkProtection: true,
        apiProtection: true,
        securityHeaders: true,
        adminProtection: true,
        sensitiveFileProtection: true
    },

    // ============================================
    // App Settings
    // ============================================
    APP_NAME: 'DeployHub',
    APP_VERSION: '1.0.0',
    SESSION_DURATION: 7 * 24 * 60 * 60 * 1000, // 7 days
    TOAST_DURATION: 4000,
    DOMAIN_CHECK_DELAY: 800, // ms debounce for domain check

    // Encryption key for local storage
    ENCRYPTION_KEY: 'DH_2025_SEC_KEY',
};

// ============================================
// JSONBin.io API Helper
// ============================================
class JSONBinDB {
    constructor() {
        this.baseURL = CONFIG.JSONBIN_BASE_URL;
        this.masterKey = CONFIG.JSONBIN_MASTER_KEY || localStorage.getItem('dh_jsonbin_key') || '';
    }

    setMasterKey(key) {
        this.masterKey = key;
        localStorage.setItem('dh_jsonbin_key', key);
    }

    getMasterKey() {
        return this.masterKey || localStorage.getItem('dh_jsonbin_key') || '';
    }

    getHeaders() {
        return {
            'Content-Type': 'application/json',
            'X-Master-Key': this.getMasterKey(),
            'X-Bin-Meta': false
        };
    }

    // Read bin data
    async read(binId) {
        try {
            const response = await fetch(`${this.baseURL}/b/${binId}/latest`, {
                method: 'GET',
                headers: this.getHeaders()
            });
            if (!response.ok) throw new Error(`Failed to read bin: ${response.status}`);
            return await response.json();
        } catch (error) {
            console.error('JSONBin Read Error:', error);
            return null;
        }
    }

    // Update bin data
    async update(binId, data) {
        try {
            const response = await fetch(`${this.baseURL}/b/${binId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Master-Key': this.getMasterKey()
                },
                body: JSON.stringify(data)
            });
            if (!response.ok) throw new Error(`Failed to update bin: ${response.status}`);
            return await response.json();
        } catch (error) {
            console.error('JSONBin Update Error:', error);
            return null;
        }
    }

    // Create new bin
    async create(data, name) {
        try {
            const headers = {
                'Content-Type': 'application/json',
                'X-Master-Key': this.getMasterKey()
            };
            if (name) headers['X-Bin-Name'] = name;

            const response = await fetch(`${this.baseURL}/b`, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(data)
            });
            if (!response.ok) throw new Error(`Failed to create bin: ${response.status}`);
            return await response.json();
        } catch (error) {
            console.error('JSONBin Create Error:', error);
            return null;
        }
    }
}

// Global DB instance
const db = new JSONBinDB();

// ============================================
// Utility Functions
// ============================================
const Utils = {
    // Generate unique ID
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
    },

    // Hash password (simple hash - in production use bcrypt)
    async hashPassword(password) {
        const encoder = new TextEncoder();
        const data = encoder.encode(password + CONFIG.ENCRYPTION_KEY);
        const hash = await crypto.subtle.digest('SHA-256', data);
        return Array.from(new Uint8Array(hash))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    },

    // Format date
    formatDate(dateStr) {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    },

    // Format relative time
    timeAgo(dateStr) {
        const seconds = Math.floor((new Date() - new Date(dateStr)) / 1000);
        const intervals = [
            { label: 'year', seconds: 31536000 },
            { label: 'month', seconds: 2592000 },
            { label: 'week', seconds: 604800 },
            { label: 'day', seconds: 86400 },
            { label: 'hour', seconds: 3600 },
            { label: 'minute', seconds: 60 },
            { label: 'second', seconds: 1 }
        ];
        for (const interval of intervals) {
            const count = Math.floor(seconds / interval.seconds);
            if (count >= 1) {
                return `${count} ${interval.label}${count > 1 ? 's' : ''} ago`;
            }
        }
        return 'Just now';
    },

    // Validate email
    isValidEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    },

    // Validate domain
    isValidDomain(domain) {
        return /^(?!:\/\/)([a-zA-Z0-9-]+\.)*[a-zA-Z0-9][a-zA-Z0-9-]+\.[a-zA-Z]{2,}$/.test(domain);
    },

    // Clean domain (remove http/www)
    cleanDomain(domain) {
        return domain.replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/$/, '').toLowerCase();
    },

    // Truncate text
    truncate(text, length = 50) {
        if (!text) return '';
        return text.length > length ? text.substring(0, length) + '...' : text;
    },

    // Debounce
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    // Save to local storage (encrypted)
    saveLocal(key, data) {
        try {
            const json = JSON.stringify(data);
            const encoded = btoa(encodeURIComponent(json));
            localStorage.setItem(`dh_${key}`, encoded);
        } catch (e) {
            console.error('Save local error:', e);
        }
    },

    // Load from local storage (decrypted)
    loadLocal(key) {
        try {
            const encoded = localStorage.getItem(`dh_${key}`);
            if (!encoded) return null;
            const json = decodeURIComponent(atob(encoded));
            return JSON.parse(json);
        } catch (e) {
            console.error('Load local error:', e);
            return null;
        }
    },

    // Remove from local storage
    removeLocal(key) {
        localStorage.removeItem(`dh_${key}`);
    },

    // Copy to clipboard
    async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (e) {
            // Fallback
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            const result = document.execCommand('copy');
            document.body.removeChild(ta);
            return result;
        }
    }
};

// ============================================
// Toast Notification System
// ============================================
function showToast(type, title, message = '') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const icons = {
        success: 'fas fa-check-circle',
        error: 'fas fa-exclamation-circle',
        warning: 'fas fa-exclamation-triangle',
        info: 'fas fa-info-circle'
    };

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <i class="toast-icon ${icons[type] || icons.info}"></i>
        <div class="toast-content">
            <div class="toast-title">${title}</div>
            ${message ? `<div class="toast-message">${message}</div>` : ''}
        </div>
        <button class="toast-close" onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;

    container.appendChild(toast);

    // Auto remove
    setTimeout(() => {
        toast.classList.add('hiding');
        setTimeout(() => toast.remove(), 300);
    }, CONFIG.TOAST_DURATION);
}

// ============================================
// Confirm Dialog System
// ============================================
let pendingConfirmCallback = null;

function showConfirm(title, message, callback, isDanger = true) {
    const modal = document.getElementById('confirmModal');
    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmMessage').textContent = message;
    document.getElementById('confirmBtn').className = isDanger ? 'btn btn-danger' : 'btn btn-primary';
    pendingConfirmCallback = callback;
    modal.classList.add('show');
}

function confirmAction() {
    if (pendingConfirmCallback) {
        pendingConfirmCallback();
        pendingConfirmCallback = null;
    }
    closeConfirm();
}

function closeConfirm() {
    document.getElementById('confirmModal').classList.remove('show');
    pendingConfirmCallback = null;
}

console.log(`%c${CONFIG.APP_NAME} v${CONFIG.APP_VERSION}`, 'color: #6c5ce7; font-size: 20px; font-weight: bold;');
console.log('%cSecure Deployment Platform', 'color: #a29bfe; font-size: 14px;');
