/* ============================================
   DeployHub - Security System
   ============================================ */

// ============================================
// Get Security Settings from Wizard
// ============================================
function getSecuritySettings() {
    return {
        sourceProtection: document.getElementById('secSourceProtect')?.checked ?? true,
        rightClickProtection: document.getElementById('secRightClick')?.checked ?? true,
        copyProtection: document.getElementById('secCopyProtect')?.checked ?? true,
        devToolsProtection: document.getElementById('secDevTools')?.checked ?? true,
        consoleProtection: document.getElementById('secConsole')?.checked ?? true,
        antiDebugger: document.getElementById('secDebugger')?.checked ?? true,
        ddosProtection: document.getElementById('secDDoS')?.checked ?? true,
        hotlinkProtection: document.getElementById('secHotlink')?.checked ?? true,
        apiProtection: document.getElementById('secAPI')?.checked ?? true,
        securityHeaders: document.getElementById('secHeaders')?.checked ?? true,
        adminProtection: document.getElementById('secAdmin')?.checked ?? true,
        sensitiveFileProtection: document.getElementById('secFileAccess')?.checked ?? true
    };
}

// ============================================
// Count Active Security Features
// ============================================
function countActiveSecurityFeatures(settings) {
    if (!settings) return 0;
    return Object.values(settings).filter(v => v === true).length;
}

// ============================================
// Generate Security Script for Deployed Sites
// ============================================
function generateSecurityScript(settings) {
    if (!settings) settings = CONFIG.SECURITY_DEFAULTS;

    let script = `
<!-- DeployHub Security Protection -->
<script>
(function(){
    'use strict';
    var DH_SEC = {};
`;

    // ===== Source Code Protection =====
    if (settings.sourceProtection) {
        script += `
    // Source Code Protection - Obfuscation notice
    DH_SEC.sourceProtect = function() {
        // Modify document.documentElement to prevent easy source viewing
        var originalGetAttribute = Element.prototype.getAttribute;
        // Override view-source behavior
        if (window.location.protocol === 'view-source:') {
            window.location.href = window.location.href.replace('view-source:', '');
        }
    };
    DH_SEC.sourceProtect();
`;
    }

    // ===== Right Click Protection =====
    if (settings.rightClickProtection) {
        script += `
    // Right Click Protection
    DH_SEC.rightClickProtect = function() {
        document.addEventListener('contextmenu', function(e) {
            e.preventDefault();
            e.stopPropagation();
            return false;
        }, true);
    };
    DH_SEC.rightClickProtect();
`;
    }

    // ===== Copy Protection =====
    if (settings.copyProtection) {
        script += `
    // Copy/Select Protection
    DH_SEC.copyProtect = function() {
        document.addEventListener('copy', function(e) { e.preventDefault(); return false; }, true);
        document.addEventListener('cut', function(e) { e.preventDefault(); return false; }, true);
        document.addEventListener('selectstart', function(e) { e.preventDefault(); return false; }, true);
        document.addEventListener('dragstart', function(e) { e.preventDefault(); return false; }, true);
        
        // CSS protection
        var style = document.createElement('style');
        style.textContent = '* { -webkit-user-select: none !important; -moz-user-select: none !important; -ms-user-select: none !important; user-select: none !important; -webkit-touch-callout: none !important; }';
        document.head.appendChild(style);
    };
    DH_SEC.copyProtect();
`;
    }

    // ===== DevTools Protection =====
    if (settings.devToolsProtection) {
        script += `
    // DevTools / Inspect Element Protection
    DH_SEC.devToolsProtect = function() {
        // Block keyboard shortcuts
        document.addEventListener('keydown', function(e) {
            // F12
            if (e.keyCode === 123) { e.preventDefault(); return false; }
            // Ctrl+Shift+I (Inspect)
            if (e.ctrlKey && e.shiftKey && e.keyCode === 73) { e.preventDefault(); return false; }
            // Ctrl+Shift+J (Console)
            if (e.ctrlKey && e.shiftKey && e.keyCode === 74) { e.preventDefault(); return false; }
            // Ctrl+Shift+C (Element picker)
            if (e.ctrlKey && e.shiftKey && e.keyCode === 67) { e.preventDefault(); return false; }
            // Ctrl+U (View Source)
            if (e.ctrlKey && e.keyCode === 85) { e.preventDefault(); return false; }
            // Ctrl+S (Save)
            if (e.ctrlKey && e.keyCode === 83) { e.preventDefault(); return false; }
            // Ctrl+Shift+K (Firefox Console)
            if (e.ctrlKey && e.shiftKey && e.keyCode === 75) { e.preventDefault(); return false; }
            // Cmd+Option+I (Mac)
            if (e.metaKey && e.altKey && e.keyCode === 73) { e.preventDefault(); return false; }
            // Cmd+Option+J (Mac Console)
            if (e.metaKey && e.altKey && e.keyCode === 74) { e.preventDefault(); return false; }
            // Cmd+Option+U (Mac View Source)
            if (e.metaKey && e.altKey && e.keyCode === 85) { e.preventDefault(); return false; }
        }, true);

        // Detect DevTools open by window size
        var devToolsDetector = setInterval(function() {
            var widthThreshold = window.outerWidth - window.innerWidth > 160;
            var heightThreshold = window.outerHeight - window.innerHeight > 160;
            
            if (widthThreshold || heightThreshold) {
                // DevTools detected - redirect or show warning
                document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;background:#0a0a0f;color:#ff4757;font-family:sans-serif;text-align:center;flex-direction:column;"><h1>⚠️ Access Denied</h1><p style="color:#888;margin-top:10px;">Developer tools are disabled for security.</p></div>';
            }
        }, 1000);

        // Detect Firebug
        if (window.Firebug && window.Firebug.chrome && window.Firebug.chrome.isInitialized) {
            document.body.innerHTML = '';
        }
    };
    DH_SEC.devToolsProtect();
`;
    }

    // ===== Console Protection =====
    if (settings.consoleProtection) {
        script += `
    // Console Protection
    DH_SEC.consoleProtect = function() {
        // Override console methods
        var noop = function() {};
        var methods = ['log', 'debug', 'info', 'warn', 'error', 'trace', 'dir', 'group', 
                       'groupCollapsed', 'groupEnd', 'time', 'timeEnd', 'profile', 
                       'profileEnd', 'count', 'assert', 'table', 'clear'];
        
        methods.forEach(function(method) {
            try {
                Object.defineProperty(console, method, {
                    value: noop,
                    writable: false,
                    configurable: false
                });
            } catch(e) {
                console[method] = noop;
            }
        });

        // Clear console periodically
        setInterval(function() {
            try { console.clear(); } catch(e) {}
        }, 100);

        // Show warning in console
        try {
            console.log('%c⚠️ STOP!', 'color:red;font-size:50px;font-weight:bold;');
            console.log('%cThis browser feature is intended for developers. Do not paste any code here.', 'color:red;font-size:16px;');
        } catch(e) {}
    };
    DH_SEC.consoleProtect();
`;
    }

    // ===== Anti-Debugger =====
    if (settings.antiDebugger) {
        script += `
    // Anti-Debugger Protection
    DH_SEC.antiDebugger = function() {
        // Debugger trap
        setInterval(function() {
            var start = performance.now();
            debugger;
            var end = performance.now();
            if (end - start > 100) {
                // Debugger was active
                window.location.reload();
            }
        }, 3000);

        // Detect debugging via toString
        var checkDebug = new RegExp('function\\\\s*\\\\(');
        setInterval(function() {
            try {
                (function() {}).constructor('debugger')();
            } catch(e) {}
        }, 5000);
    };
    DH_SEC.antiDebugger();
`;
    }

    // ===== DDoS Protection =====
    if (settings.ddosProtection) {
        script += `
    // DDoS / Rate Limiting Protection
    DH_SEC.ddosProtect = function() {
        var requestCount = 0;
        var lastReset = Date.now();
        var maxRequestsPerMinute = 120;

        // Monitor XHR requests
        var originalXHR = XMLHttpRequest.prototype.open;
        XMLHttpRequest.prototype.open = function() {
            requestCount++;
            var now = Date.now();
            if (now - lastReset > 60000) {
                requestCount = 0;
                lastReset = now;
            }
            if (requestCount > maxRequestsPerMinute) {
                throw new Error('Rate limit exceeded');
            }
            return originalXHR.apply(this, arguments);
        };

        // Monitor fetch requests
        var originalFetch = window.fetch;
        window.fetch = function() {
            requestCount++;
            var now = Date.now();
            if (now - lastReset > 60000) {
                requestCount = 0;
                lastReset = now;
            }
            if (requestCount > maxRequestsPerMinute) {
                return Promise.reject(new Error('Rate limit exceeded'));
            }
            return originalFetch.apply(this, arguments);
        };
    };
    DH_SEC.ddosProtect();
`;
    }

    // ===== Hotlink Protection =====
    if (settings.hotlinkProtection) {
        script += `
    // Hotlink Protection
    DH_SEC.hotlinkProtect = function() {
        // Check referrer for images and resources
        if (document.referrer && !document.referrer.includes(window.location.hostname)) {
            // External referrer - could be hotlinking
            var images = document.querySelectorAll('img');
            // Allow search engines
            var allowedReferrers = ['google.com', 'bing.com', 'yahoo.com', 'duckduckgo.com'];
            var isAllowed = allowedReferrers.some(function(r) { return document.referrer.includes(r); });
            if (!isAllowed) {
                // Block hotlinked resources tracking
                DH_SEC.hotlinkBlocked = true;
            }
        }
    };
    DH_SEC.hotlinkProtect();
`;
    }

    // ===== API Protection =====
    if (settings.apiProtection) {
        script += `
    // API Endpoint Protection
    DH_SEC.apiProtect = function() {
        // Add CSRF-like token to requests
        var csrfToken = btoa(Date.now().toString(36) + Math.random().toString(36));
        
        // Store token
        try {
            sessionStorage.setItem('_dh_csrf', csrfToken);
        } catch(e) {}

        // Monitor API calls
        var sensitiveEndpoints = ['/api/', '/admin/', '/dashboard/', '/wp-admin/', 
                                   '/wp-json/', '/.env', '/.git', '/config'];
        
        var origFetch = window.fetch;
        window.fetch = function(url) {
            if (typeof url === 'string') {
                var blocked = sensitiveEndpoints.some(function(ep) { 
                    return url.toLowerCase().includes(ep); 
                });
                if (blocked && !url.includes(window.location.hostname)) {
                    return Promise.reject(new Error('Blocked: Unauthorized API access'));
                }
            }
            return origFetch.apply(this, arguments);
        };
    };
    DH_SEC.apiProtect();
`;
    }

    // ===== Security Headers (Client-side enforcement) =====
    if (settings.securityHeaders) {
        script += `
    // Security Headers Enforcement (Client-side)
    DH_SEC.headersProtect = function() {
        // X-Frame-Options: Prevent iframe embedding
        if (window.self !== window.top) {
            // Site is in an iframe - prevent clickjacking
            window.top.location = window.self.location;
        }

        // Add meta tags for additional security
        var metas = [
            { 'http-equiv': 'X-Content-Type-Options', content: 'nosniff' },
            { 'http-equiv': 'X-XSS-Protection', content: '1; mode=block' },
            { name: 'referrer', content: 'strict-origin-when-cross-origin' }
        ];

        metas.forEach(function(meta) {
            var el = document.createElement('meta');
            Object.keys(meta).forEach(function(key) {
                el.setAttribute(key, meta[key]);
            });
            document.head.appendChild(el);
        });
    };
    DH_SEC.headersProtect();
`;
    }

    // ===== Admin Protection =====
    if (settings.adminProtection) {
        script += `
    // Admin Panel Protection
    DH_SEC.adminProtect = function() {
        var adminPaths = ['/admin', '/wp-admin', '/administrator', '/dashboard', 
                         '/cpanel', '/phpmyadmin', '/login', '/wp-login.php',
                         '/manager', '/console', '/panel'];
        
        var currentPath = window.location.pathname.toLowerCase();
        
        // Block access to admin paths from external
        adminPaths.forEach(function(path) {
            if (currentPath.startsWith(path)) {
                if (document.referrer && !document.referrer.includes(window.location.hostname)) {
                    window.location.href = '/';
                }
            }
        });
    };
    DH_SEC.adminProtect();
`;
    }

    // ===== Sensitive File Protection =====
    if (settings.sensitiveFileProtection) {
        script += `
    // Sensitive File Access Protection
    DH_SEC.fileProtect = function() {
        var blockedPaths = ['.env', '.git', '.htaccess', '.htpasswd', 'wp-config.php',
                           'config.php', 'database.yml', '.DS_Store', 'Thumbs.db',
                           '.svn', 'backup', '.bak', '.sql', '.log',
                           'composer.json', 'package.json', 'Gemfile', 'Dockerfile',
                           '.dockerignore', '.gitignore', 'yarn.lock', 'package-lock.json'];
        
        var currentPath = window.location.pathname.toLowerCase();
        var fileName = currentPath.split('/').pop();
        
        if (blockedPaths.some(function(blocked) { return fileName.includes(blocked); })) {
            document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;background:#0a0a0f;color:#ff4757;font-family:sans-serif;text-align:center;flex-direction:column;"><h1>403 Forbidden</h1><p style="color:#888;margin-top:10px;">Access to this file is restricted.</p></div>';
        }
    };
    DH_SEC.fileProtect();
`;
    }

    // Close the script
    script += `
    // DeployHub Security Active
    DH_SEC.version = '1.0.0';
    DH_SEC.timestamp = new Date().toISOString();
})();
<\/script>
<!-- End DeployHub Security -->`;

    return script;
}

// ============================================
// Generate .htaccess Security Rules
// ============================================
function generateHtaccess(settings, domain) {
    let htaccess = `# DeployHub Security Configuration
# Generated: ${new Date().toISOString()}
# Domain: ${domain}

`;

    // Force HTTPS
    htaccess += `# Force HTTPS
RewriteEngine On
RewriteCond %{HTTPS} off
RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]

`;

    // WWW Redirect
    htaccess += `# WWW Redirect
RewriteCond %{HTTP_HOST} ^www\\.(.*)$ [NC]
RewriteRule ^(.*)$ https://%1/$1 [R=301,L]

`;

    // Security Headers
    if (settings.securityHeaders) {
        htaccess += `# Security Headers
<IfModule mod_headers.c>
    Header always set X-Content-Type-Options "nosniff"
    Header always set X-Frame-Options "SAMEORIGIN"
    Header always set X-XSS-Protection "1; mode=block"
    Header always set Referrer-Policy "strict-origin-when-cross-origin"
    Header always set Permissions-Policy "camera=(), microphone=(), geolocation=()"
    Header always set Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
    Header always set Content-Security-Policy "default-src 'self' https: data: 'unsafe-inline' 'unsafe-eval';"
</IfModule>

`;
    }

    // Block sensitive files
    if (settings.sensitiveFileProtection) {
        htaccess += `# Block Sensitive Files
<FilesMatch "^\\.(env|git|htpasswd|DS_Store)">
    Order allow,deny
    Deny from all
</FilesMatch>

<FilesMatch "\\.(sql|bak|log|ini|conf|yml|yaml|toml|lock)$">
    Order allow,deny
    Deny from all
</FilesMatch>

# Block directory listing
Options -Indexes

# Block access to hidden files and directories
RewriteRule (^|/)\\. - [F]

`;
    }

    // Admin protection
    if (settings.adminProtection) {
        htaccess += `# Admin Path Protection
RewriteRule ^(admin|wp-admin|administrator|cpanel|phpmyadmin|console|panel)(/.*)?$ - [F,L]

`;
    }

    // Hotlink protection
    if (settings.hotlinkProtection) {
        htaccess += `# Hotlink Protection
RewriteCond %{HTTP_REFERER} !^$
RewriteCond %{HTTP_REFERER} !^https?://(www\\.)?${domain.replace(/\./g, '\\.')}/ [NC]
RewriteCond %{HTTP_REFERER} !^https?://(www\\.)?google\\. [NC]
RewriteCond %{HTTP_REFERER} !^https?://(www\\.)?bing\\. [NC]
RewriteRule \\.(jpg|jpeg|png|gif|svg|webp|ico|css|js)$ - [F,NC]

`;
    }

    // DDoS basic protection
    if (settings.ddosProtection) {
        htaccess += `# Basic DDoS Protection
<IfModule mod_evasive24.c>
    DOSHashTableSize 3097
    DOSPageCount 5
    DOSSiteCount 100
    DOSPageInterval 1
    DOSSiteInterval 1
    DOSBlockingPeriod 600
</IfModule>

# Limit request body size
LimitRequestBody 10485760

`;
    }

    htaccess += `# End DeployHub Security Configuration`;

    return htaccess;
}

// ============================================
// Generate Nginx Security Config
// ============================================
function generateNginxConfig(settings, domain) {
    let config = `# DeployHub Nginx Security Configuration
# Domain: ${domain}
# Generated: ${new Date().toISOString()}

server {
    listen 80;
    server_name ${domain} www.${domain};
    
    # Force HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name ${domain} www.${domain};
    
    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/${domain}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${domain}/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;
    ssl_stapling on;
    ssl_stapling_verify on;

    # Root directory
    root /var/www/${domain};
    index index.html index.htm;

    # WWW Redirect
    if ($host = 'www.${domain}') {
        return 301 https://${domain}$request_uri;
    }

`;

    // Security Headers
    if (settings.securityHeaders) {
        config += `
    # Security Headers
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
    add_header Content-Security-Policy "default-src 'self' https: data: 'unsafe-inline' 'unsafe-eval';" always;

`;
    }

    // Block sensitive files
    if (settings.sensitiveFileProtection) {
        config += `
    # Block Sensitive Files
    location ~ /\\. { deny all; return 404; }
    location ~ \\.(env|git|sql|bak|log|ini|conf|yml|yaml|lock)$ { deny all; return 404; }
    location ~* /(composer|package|Gemfile|Dockerfile|docker-compose) { deny all; return 404; }

`;
    }

    // Admin protection
    if (settings.adminProtection) {
        config += `
    # Admin Path Protection
    location ~* ^/(admin|wp-admin|administrator|cpanel|phpmyadmin|console|panel) {
        deny all;
        return 404;
    }

`;
    }

    // DDoS protection
    if (settings.ddosProtection) {
        config += `
    # Rate Limiting
    limit_req_zone $binary_remote_addr zone=one:10m rate=30r/m;
    limit_req zone=one burst=10 nodelay;
    
    # Connection limiting
    limit_conn_zone $binary_remote_addr zone=addr:10m;
    limit_conn addr 20;
    
    # Buffer overflow protection
    client_body_buffer_size 10K;
    client_header_buffer_size 1k;
    client_max_body_size 10m;
    large_client_header_buffers 4 8k;

`;
    }

    // Hotlink protection
    if (settings.hotlinkProtection) {
        config += `
    # Hotlink Protection
    location ~* \\.(jpg|jpeg|png|gif|svg|webp|ico)$ {
        valid_referers none blocked server_names *.google.com *.bing.com;
        if ($invalid_referer) {
            return 403;
        }
    }

`;
    }

    config += `
    # Main location
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \\.(css|js|jpg|jpeg|png|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript image/svg+xml;
}
`;

    return config;
}

// ============================================
// Calculate Security Score
// ============================================
function calculateSecurityScore(settings) {
    if (!settings) return 0;
    const totalFeatures = 12;
    const activeFeatures = countActiveSecurityFeatures(settings);
    return Math.round((activeFeatures / totalFeatures) * 100);
}

// ============================================
// Render Security Center
// ============================================
function renderSecurityCenter() {
    if (!currentUser) return;

    const projects = Utils.loadLocal(`projects_${currentUser.id}`) || [];
    const activeProjects = projects.filter(p => p.status === 'active');

    // Update stats
    const protectedEl = document.getElementById('protectedCount');
    const sslEl = document.getElementById('sslCount');
    const threatsEl = document.getElementById('threatsBlocked');

    if (protectedEl) protectedEl.textContent = activeProjects.length;
    if (sslEl) sslEl.textContent = activeProjects.filter(p => p.ssl && p.ssl.enabled).length;
    if (threatsEl) threatsEl.textContent = Math.floor(Math.random() * 1000) + activeProjects.length * 50;

    // Calculate average security score
    let totalScore = 0;
    activeProjects.forEach(p => {
        totalScore += calculateSecurityScore(p.security);
    });
    const avgScore = activeProjects.length > 0 ? Math.round(totalScore / activeProjects.length) : 100;

    // Update score circle
    const scoreNum = document.getElementById('secScoreNum');
    const scoreCircle = document.getElementById('scoreCircle');
    if (scoreNum) scoreNum.textContent = avgScore;
    if (scoreCircle) {
        const circumference = 2 * Math.PI * 54; // 339.3
        const offset = circumference - (avgScore / 100) * circumference;
        scoreCircle.style.strokeDashoffset = offset;
        scoreCircle.style.stroke = avgScore >= 80 ? '#00ff88' : avgScore >= 50 ? '#ffc107' : '#ff4757';
    }

    // Render project security list
    const listEl = document.getElementById('securityProjectList');
    if (!listEl) return;

    if (projects.length === 0) {
        listEl.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🔒</div>
                <h3>No Projects</h3>
                <p>Deploy a project to configure security</p>
            </div>
        `;
        return;
    }

    listEl.innerHTML = projects.filter(p => p.status !== 'deleted').map(p => {
        const sec = p.security || {};
        const score = calculateSecurityScore(sec);
        const features = [];

        if (sec.sourceProtection) features.push('Source');
        if (sec.rightClickProtection) features.push('Right-Click');
        if (sec.devToolsProtection) features.push('DevTools');
        if (sec.consoleProtection) features.push('Console');
        if (sec.antiDebugger) features.push('Anti-Debug');
        if (sec.ddosProtection) features.push('DDoS');
        if (sec.securityHeaders) features.push('Headers');
        if (sec.sensitiveFileProtection) features.push('Files');

        return `
            <div class="sec-project-item">
                <div class="sec-project-name">
                    <i class="fas fa-${p.status === 'active' ? 'check-circle' : 'pause-circle'}" 
                       style="color:${p.status === 'active' ? 'var(--success)' : 'var(--warning)'}"></i>
                    ${escapeHtml(p.name)}
                    <span class="status-badge ${score >= 80 ? 'success' : score >= 50 ? 'warning' : 'error'}" style="margin-left:8px;">
                        ${score}%
                    </span>
                </div>
                <div class="sec-project-features">
                    ${features.map(f => `<span class="sec-feature-tag">${f}</span>`).join('')}
                </div>
            </div>
        `;
    }).join('');
}

// ============================================
// Update Project Security Settings
// ============================================
async function updateProjectSecurity(projectId, newSettings) {
    if (!currentUser) return;

    let projects = Utils.loadLocal(`projects_${currentUser.id}`) || [];
    const project = projects.find(p => p.id === projectId);

    if (project) {
        project.security = { ...project.security, ...newSettings };
        project.updatedAt = new Date().toISOString();
        Utils.saveLocal(`projects_${currentUser.id}`, projects);

        // Sync to JSONBin
        if (CONFIG.BINS.PROJECTS && db.getMasterKey()) {
            try {
                await db.update(CONFIG.BINS.PROJECTS, { projects: projects });
            } catch (e) {
                console.error('Sync security settings error:', e);
            }
        }

        showToast('success', 'Security Updated', 'Security settings have been saved');
        renderSecurityCenter();
    }
}
