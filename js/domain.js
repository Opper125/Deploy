/* ============================================
   DeployHub - Domain Management System
   ============================================ */

let domainCheckTimeout = null;
let currentDomainStatus = null;
let checkedDomains = new Map(); // Cache checked domains

// ============================================
// Handle Domain Input (Auto-Check)
// ============================================
function handleDomainInput(value) {
    const domain = Utils.cleanDomain(value);
    const checker = document.getElementById('domainChecker');
    const result = document.getElementById('domainResult');

    // Clear previous timeout
    if (domainCheckTimeout) {
        clearTimeout(domainCheckTimeout);
    }

    // Reset
    currentDomainStatus = null;
    result.style.display = 'none';

    if (!domain) {
        checker.innerHTML = '';
        return;
    }

    // Show checking indicator
    checker.innerHTML = `
        <div class="domain-checking">
            <div class="mini-spinner"></div>
            <span>Checking...</span>
        </div>
    `;

    // Debounce the check
    domainCheckTimeout = setTimeout(() => {
        checkDomainAvailability(domain);
    }, CONFIG.DOMAIN_CHECK_DELAY);
}

// ============================================
// Check Domain Availability
// ============================================
async function checkDomainAvailability(domain) {
    const checker = document.getElementById('domainChecker');
    const result = document.getElementById('domainResult');
    const dnsConfig = document.getElementById('dnsConfig');

    // Validate domain format
    if (!Utils.isValidDomain(domain)) {
        checker.innerHTML = '<span style="color:var(--error);font-size:12px;"><i class="fas fa-times-circle"></i> Invalid format</span>';
        result.style.display = 'none';
        dnsConfig.style.display = 'none';
        currentDomainStatus = null;
        return;
    }

    // Check if already in our system (used by other users)
    const isUsedInternally = await checkDomainInSystem(domain);
    if (isUsedInternally) {
        showDomainUnavailable(domain, 'This domain is already deployed on DeployHub by another user.');
        return;
    }

    // Check cache
    if (checkedDomains.has(domain)) {
        const cached = checkedDomains.get(domain);
        if (Date.now() - cached.timestamp < 60000) { // 1 min cache
            if (cached.available) {
                showDomainAvailable(domain);
            } else {
                showDomainUnavailable(domain, cached.reason);
            }
            return;
        }
    }

    try {
        // Method 1: Check DNS records using Google DNS API
        const dnsAvailable = await checkDNS(domain);

        // Method 2: Check if website is reachable (HTTP check)
        const httpReachable = await checkHTTPReachable(domain);

        // Method 3: Check WHOIS-like status
        const whoisStatus = await checkDomainRegistration(domain);

        // Determine availability
        // Domain is "available for hosting" if:
        // - DNS doesn't point to an active hosting server, OR
        // - The domain has no active website
        
        if (dnsAvailable.hasRecords && httpReachable) {
            // Domain has DNS records AND is serving content = TAKEN
            showDomainUnavailable(domain, 'This domain is already active with existing hosting. It has DNS records pointing to a live server.');
            checkedDomains.set(domain, { available: false, reason: 'Active hosting detected', timestamp: Date.now() });
        } else if (dnsAvailable.hasRecords && !httpReachable) {
            // Has DNS but not serving = Available for our hosting (might be parked)
            showDomainAvailable(domain, 'Domain has DNS records but no active website detected. You can configure it for DeployHub hosting.');
            checkedDomains.set(domain, { available: true, timestamp: Date.now() });
        } else if (!dnsAvailable.hasRecords) {
            // No DNS records = Available
            showDomainAvailable(domain, 'No existing DNS records found. This domain is ready for DeployHub hosting!');
            checkedDomains.set(domain, { available: true, timestamp: Date.now() });
        }

    } catch (error) {
        console.error('Domain check error:', error);

        // Fallback: Use simpler check
        try {
            const simpleDNS = await simpleCheckDNS(domain);
            if (simpleDNS) {
                showDomainUnavailable(domain, 'This domain appears to be already in use with existing hosting.');
                checkedDomains.set(domain, { available: false, reason: 'DNS active', timestamp: Date.now() });
            } else {
                showDomainAvailable(domain, 'Domain appears to be available for hosting.');
                checkedDomains.set(domain, { available: true, timestamp: Date.now() });
            }
        } catch (e2) {
            // If all checks fail, show as potentially available with warning
            showDomainAvailableWithWarning(domain);
        }
    }
}

// ============================================
// DNS Check via Google DNS API
// ============================================
async function checkDNS(domain) {
    const result = {
        hasRecords: false,
        aRecords: [],
        cnameRecords: [],
        nsRecords: []
    };

    try {
        // Check A records
        const aResponse = await fetch(`${CONFIG.DOMAIN_CHECK_API}?name=${domain}&type=A`);
        const aData = await aResponse.json();

        if (aData.Answer && aData.Answer.length > 0) {
            result.hasRecords = true;
            result.aRecords = aData.Answer.filter(a => a.type === 1).map(a => a.data);
        }

        // Check CNAME records
        const cnameResponse = await fetch(`${CONFIG.DOMAIN_CHECK_API}?name=${domain}&type=CNAME`);
        const cnameData = await cnameResponse.json();

        if (cnameData.Answer && cnameData.Answer.length > 0) {
            result.hasRecords = true;
            result.cnameRecords = cnameData.Answer.filter(a => a.type === 5).map(a => a.data);
        }

        // Check NS records
        const nsResponse = await fetch(`${CONFIG.DOMAIN_CHECK_API}?name=${domain}&type=NS`);
        const nsData = await nsResponse.json();

        if (nsData.Answer && nsData.Answer.length > 0) {
            result.nsRecords = nsData.Answer.filter(a => a.type === 2).map(a => a.data);
        }

        // Check if any A record points to known parking/default IPs
        const parkingIPs = ['0.0.0.0', '127.0.0.1', '192.0.2.1'];
        if (result.aRecords.length > 0 && result.aRecords.every(ip => parkingIPs.includes(ip))) {
            result.hasRecords = false; // Parked domain, treat as available
        }

    } catch (error) {
        console.error('DNS check error:', error);
    }

    return result;
}

// ============================================
// Simple DNS Check (Fallback)
// ============================================
async function simpleCheckDNS(domain) {
    try {
        const response = await fetch(`${CONFIG.DOMAIN_CHECK_API}?name=${domain}&type=A`);
        const data = await response.json();
        return data.Answer && data.Answer.length > 0 && data.Status === 0;
    } catch (e) {
        return false;
    }
}

// ============================================
// HTTP Reachability Check
// ============================================
async function checkHTTPReachable(domain) {
    try {
        // Use a CORS proxy or just check if fetch succeeds
        // Note: This may be blocked by CORS in browser
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(`https://${domain}`, {
            method: 'HEAD',
            mode: 'no-cors',
            signal: controller.signal
        });

        clearTimeout(timeout);
        // If we get here without error, the domain is reachable
        return true;
    } catch (error) {
        // Could be CORS error (domain exists) or network error (domain doesn't exist)
        if (error.name === 'AbortError') {
            return false; // Timeout = not reachable
        }
        // TypeError usually means CORS blocked = domain is active
        if (error.name === 'TypeError') {
            return true; // Likely active but CORS blocked
        }
        return false;
    }
}

// ============================================
// Domain Registration Check (Simulated)
// ============================================
async function checkDomainRegistration(domain) {
    // In a real implementation, this would call a WHOIS API
    // For now, we'll rely on DNS checks
    return { registered: false };
}

// ============================================
// Check Domain in Our System
// ============================================
async function checkDomainInSystem(domain) {
    const cleanDomain = Utils.cleanDomain(domain);

    // Check local projects
    if (currentUser) {
        const projects = Utils.loadLocal(`projects_${currentUser.id}`) || [];
        const found = projects.find(p =>
            p.domain && Utils.cleanDomain(p.domain) === cleanDomain && p.status !== 'deleted'
        );
        if (found) return false; // User's own domain, allow
    }

    // Check all users' projects
    try {
        if (CONFIG.BINS.DOMAINS && db.getMasterKey()) {
            const data = await db.read(CONFIG.BINS.DOMAINS);
            if (data && Array.isArray(data.domains)) {
                const found = data.domains.find(d =>
                    Utils.cleanDomain(d.domain) === cleanDomain &&
                    d.userId !== (currentUser ? currentUser.id : '') &&
                    d.status === 'active'
                );
                return !!found;
            }
        }
    } catch (e) {
        console.error('Domain system check error:', e);
    }

    return false;
}

// ============================================
// Show Domain Available
// ============================================
function showDomainAvailable(domain, message) {
    const checker = document.getElementById('domainChecker');
    const result = document.getElementById('domainResult');
    const dnsConfig = document.getElementById('dnsConfig');

    currentDomainStatus = 'available';

    checker.innerHTML = '<span style="color:var(--success);font-size:12px;"><i class="fas fa-check-circle"></i> Available</span>';

    result.style.display = 'flex';
    result.className = 'domain-result available';
    result.innerHTML = `
        <div class="domain-result-icon"><i class="fas fa-check-circle"></i></div>
        <div class="domain-result-info">
            <h4>✅ ${domain} is available!</h4>
            <p>${message || 'This domain can be used for your DeployHub deployment.'}</p>
        </div>
    `;

    // Show DNS configuration
    dnsConfig.style.display = 'block';
    document.getElementById('dnsCnameValue').textContent = CONFIG.CNAME_TARGET;
    document.getElementById('dnsAValue').textContent = CONFIG.HOSTING_IP;
}

// ============================================
// Show Domain Available with Warning
// ============================================
function showDomainAvailableWithWarning(domain) {
    const checker = document.getElementById('domainChecker');
    const result = document.getElementById('domainResult');
    const dnsConfig = document.getElementById('dnsConfig');

    currentDomainStatus = 'available';

    checker.innerHTML = '<span style="color:var(--warning);font-size:12px;"><i class="fas fa-exclamation-triangle"></i> Check</span>';

    result.style.display = 'flex';
    result.className = 'domain-result available';
    result.innerHTML = `
        <div class="domain-result-icon" style="color:var(--warning);"><i class="fas fa-exclamation-triangle"></i></div>
        <div class="domain-result-info">
            <h4>⚠️ ${domain} - Unable to fully verify</h4>
            <p>Could not fully verify domain status. You may proceed, but ensure you own this domain and can configure DNS records.</p>
        </div>
    `;

    dnsConfig.style.display = 'block';
    document.getElementById('dnsCnameValue').textContent = CONFIG.CNAME_TARGET;
    document.getElementById('dnsAValue').textContent = CONFIG.HOSTING_IP;
}

// ============================================
// Show Domain Unavailable
// ============================================
function showDomainUnavailable(domain, reason) {
    const checker = document.getElementById('domainChecker');
    const result = document.getElementById('domainResult');
    const dnsConfig = document.getElementById('dnsConfig');

    currentDomainStatus = 'unavailable';

    checker.innerHTML = '<span style="color:var(--error);font-size:12px;"><i class="fas fa-times-circle"></i> Taken</span>';

    result.style.display = 'flex';
    result.className = 'domain-result unavailable';
    result.innerHTML = `
        <div class="domain-result-icon"><i class="fas fa-times-circle"></i></div>
        <div class="domain-result-info">
            <h4>❌ ${domain} is not available</h4>
            <p>${reason || 'This domain is already in use. Please try a different domain name.'}</p>
        </div>
    `;

    dnsConfig.style.display = 'none';
}

// ============================================
// Copy DNS Records
// ============================================
function copyDNS(type) {
    let text = '';
    if (type === 'a') {
        text = `Type: A\nName: @\nValue: ${CONFIG.HOSTING_IP}\nTTL: 3600`;
    } else {
        text = `Type: CNAME\nName: www\nValue: ${CONFIG.CNAME_TARGET}\nTTL: 3600`;
    }

    Utils.copyToClipboard(text).then(success => {
        if (success) {
            showToast('success', 'Copied!', 'DNS record copied to clipboard');
        }
    });
}

// ============================================
// Register Domain in System
// ============================================
async function registerDomain(domain, projectId) {
    if (!currentUser) return false;

    const domainRecord = {
        id: Utils.generateId(),
        domain: Utils.cleanDomain(domain),
        projectId: projectId,
        userId: currentUser.id,
        status: 'active',
        ssl: {
            enabled: document.getElementById('autoSSL')?.checked || true,
            provider: 'letsencrypt',
            status: 'provisioned',
            expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()
        },
        dns: {
            aRecord: CONFIG.HOSTING_IP,
            cnameRecord: CONFIG.CNAME_TARGET,
            configured: true
        },
        security: {
            forceHTTPS: document.getElementById('forceHTTPS')?.checked || true,
            wwwRedirect: document.getElementById('wwwRedirect')?.checked || true,
            hsts: true,
            headers: true
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    try {
        // Save to JSONBin
        if (CONFIG.BINS.DOMAINS && db.getMasterKey()) {
            let data = await db.read(CONFIG.BINS.DOMAINS);
            let domains = [];
            if (data && Array.isArray(data.domains)) {
                domains = data.domains;
            }
            domains.push(domainRecord);
            await db.update(CONFIG.BINS.DOMAINS, { domains: domains });
        }

        // Also save locally
        let localDomains = Utils.loadLocal('domains') || [];
        localDomains.push(domainRecord);
        Utils.saveLocal('domains', localDomains);

        return domainRecord;
    } catch (error) {
        console.error('Register domain error:', error);
        return null;
    }
}

// ============================================
// Get User's Domains
// ============================================
function getUserDomains() {
    if (!currentUser) return [];

    const projects = Utils.loadLocal(`projects_${currentUser.id}`) || [];
    return projects
        .filter(p => p.domain && p.status !== 'deleted')
        .map(p => ({
            domain: p.domain,
            projectId: p.id,
            projectName: p.name,
            status: p.status,
            ssl: p.ssl || { enabled: true, status: 'active' },
            createdAt: p.createdAt
        }));
}

// ============================================
// Render Domains List (Dashboard)
// ============================================
function renderDomainsList() {
    const container = document.getElementById('domainsList');
    if (!container) return;

    const domains = getUserDomains();

    if (domains.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🌐</div>
                <h3>No Domains Yet</h3>
                <p>Deploy a project with a custom domain to see it here</p>
                <button class="btn btn-primary" onclick="showDashSection('newDeploy')">
                    <i class="fas fa-plus"></i> Deploy Project
                </button>
            </div>
        `;
        return;
    }

    container.innerHTML = domains.map(d => `
        <div class="domain-card">
            <div class="domain-card-header">
                <div class="domain-card-name">
                    <i class="fas fa-globe"></i>
                    ${escapeHtml(d.domain)}
                </div>
                <span class="status-badge ${d.status === 'active' ? 'success' : d.status === 'paused' ? 'warning' : 'error'}">
                    <i class="fas fa-${d.status === 'active' ? 'check-circle' : d.status === 'paused' ? 'pause-circle' : 'exclamation-circle'}"></i>
                    ${d.status === 'active' ? 'Active' : d.status === 'paused' ? 'Paused' : 'Error'}
                </span>
            </div>
            <div class="domain-card-meta">
                <span><i class="fas fa-project-diagram"></i> ${escapeHtml(d.projectName)}</span>
                <span><i class="fas fa-lock" style="color:var(--success);"></i> SSL Active</span>
                <span><i class="fas fa-clock"></i> ${Utils.timeAgo(d.createdAt)}</span>
            </div>
            <div class="domain-card-actions">
                <button class="btn btn-ghost btn-sm" onclick="window.open('https://${d.domain}', '_blank')">
                    <i class="fas fa-external-link-alt"></i> Visit
                </button>
                <button class="btn btn-ghost btn-sm" onclick="viewDomainDNS('${d.domain}')">
                    <i class="fas fa-network-wired"></i> DNS
                </button>
                <button class="btn btn-ghost btn-sm" onclick="viewProjectDetail('${d.projectId}')">
                    <i class="fas fa-cog"></i> Manage
                </button>
            </div>
        </div>
    `).join('');
}

// ============================================
// View Domain DNS Info
// ============================================
function viewDomainDNS(domain) {
    showToast('info', 'DNS Records', `A Record: ${CONFIG.HOSTING_IP}\nCNAME: ${CONFIG.CNAME_TARGET}`);
}

// ============================================
// Show Add Domain Modal
// ============================================
function showAddDomainModal() {
    showDashSection('newDeploy');
    setTimeout(() => goToWizStep(4), 300);
}

// ============================================
// Delete Domain
// ============================================
async function deleteDomain(domainName) {
    showConfirm(
        'Remove Domain?',
        `Are you sure you want to remove ${domainName}? The website will no longer be accessible via this domain.`,
        async () => {
            // Update local projects
            let projects = Utils.loadLocal(`projects_${currentUser.id}`) || [];
            const project = projects.find(p => p.domain === domainName);
            if (project) {
                project.domain = '';
                project.status = 'paused';
            }
            Utils.saveLocal(`projects_${currentUser.id}`, projects);

            // Update JSONBin
            if (CONFIG.BINS.DOMAINS && db.getMasterKey()) {
                try {
                    let data = await db.read(CONFIG.BINS.DOMAINS);
                    if (data && Array.isArray(data.domains)) {
                        data.domains = data.domains.filter(d => d.domain !== domainName);
                        await db.update(CONFIG.BINS.DOMAINS, { domains: data.domains });
                    }
                } catch (e) {
                    console.error('Delete domain error:', e);
                }
            }

            renderDomainsList();
            loadDashboardData();
            showToast('success', 'Domain Removed', `${domainName} has been removed`);
        }
    );
}

// ============================================
// Validate Domain Before Deploy
// ============================================
function validateDomainForDeploy() {
    const domainInput = document.getElementById('customDomain');
    const domain = Utils.cleanDomain(domainInput.value);

    if (!domain) {
        showToast('error', 'Domain Required', 'Please enter a custom domain name');
        return false;
    }

    if (!Utils.isValidDomain(domain)) {
        showToast('error', 'Invalid Domain', 'Please enter a valid domain name (e.g., example.com)');
        return false;
    }

    // Check if domain has vercel.app, netlify.app etc suffix - block these
    const blockedSuffixes = [
        '.vercel.app', '.netlify.app', '.herokuapp.com',
        '.github.io', '.gitlab.io', '.surge.sh',
        '.firebase.com', '.firebaseapp.com',
        '.web.app', '.pages.dev'
    ];

    for (const suffix of blockedSuffixes) {
        if (domain.endsWith(suffix)) {
            showToast('error', 'Domain Not Allowed', `Subdomain hosting (${suffix}) is not supported. Please use your own custom domain.`);
            return false;
        }
    }

    if (currentDomainStatus === 'unavailable') {
        showToast('error', 'Domain Unavailable', 'This domain is already in use. Please choose a different domain.');
        return false;
    }

    return true;
}

// ============================================
// Override: Update DNS Config Display for GitHub Pages
// ============================================
function updateDNSDisplay() {
    const aValueEl = document.getElementById('dnsAValue');
    const cnameValueEl = document.getElementById('dnsCnameValue');
    
    if (aValueEl) {
        aValueEl.innerHTML = '185.199.108.153<br>185.199.109.153<br>185.199.110.153<br>185.199.111.153';
    }
    if (cnameValueEl && githubUser) {
        cnameValueEl.textContent = githubUser.login + '.github.io';
    }
}

// Override showDomainAvailable to update DNS
const originalShowDomainAvailable = showDomainAvailable;
showDomainAvailable = function(domain, message) {
    originalShowDomainAvailable(domain, message);
    updateDNSDisplay();
};

const originalShowDomainAvailableWithWarning = showDomainAvailableWithWarning;
showDomainAvailableWithWarning = function(domain) {
    originalShowDomainAvailableWithWarning(domain);
    updateDNSDisplay();
};
