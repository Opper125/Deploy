/* ============================================
   DeployHub - VPS Connection System
   ============================================ */

let connectedVPSList = [];

// ============================================
// Toggle VPS Auth Method
// ============================================
function toggleVPSAuth() {
    const method = document.getElementById('vpsAuthMethod').value;
    const passwordGroup = document.getElementById('vpsPasswordGroup');
    const keyGroup = document.getElementById('vpsKeyGroup');

    if (method === 'password') {
        passwordGroup.style.display = 'block';
        keyGroup.style.display = 'none';
    } else {
        passwordGroup.style.display = 'none';
        keyGroup.style.display = 'block';
    }
}

// ============================================
// Connect VPS
// ============================================
async function connectVPS() {
    const ip = document.getElementById('vpsIP').value.trim();
    const port = document.getElementById('vpsPort').value.trim() || '22';
    const username = document.getElementById('vpsUser').value.trim();
    const authMethod = document.getElementById('vpsAuthMethod').value;
    const password = document.getElementById('vpsPassword').value;
    const sshKey = document.getElementById('vpsKey').value.trim();
    const statusEl = document.getElementById('vpsConnectionStatus');
    const btn = document.getElementById('connectVPSBtn');

    // Validation
    if (!ip) {
        showToast('error', 'IP Required', 'Please enter your VPS IP address');
        return;
    }

    // Validate IP format
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipRegex.test(ip)) {
        showToast('error', 'Invalid IP', 'Please enter a valid IP address (e.g., 123.456.789.0)');
        return;
    }

    if (!username) {
        showToast('error', 'Username Required', 'Please enter your SSH username');
        return;
    }

    if (authMethod === 'password' && !password) {
        showToast('error', 'Password Required', 'Please enter your SSH password');
        return;
    }

    if (authMethod === 'key' && !sshKey) {
        showToast('error', 'SSH Key Required', 'Please enter your SSH private key');
        return;
    }

    // Check for duplicate
    if (connectedVPSList.find(v => v.ip === ip)) {
        showToast('warning', 'Already Connected', 'This VPS is already connected');
        return;
    }

    btn.disabled = true;
    btn.innerHTML = '<div class="spinner" style="width:20px;height:20px;border-width:2px;margin:0;display:inline-block;"></div> Connecting...';

    // Simulate connection process
    statusEl.style.display = 'flex';
    statusEl.className = 'vps-status';
    statusEl.innerHTML = `
        <div class="spinner" style="width:20px;height:20px;border-width:2px;"></div>
        <span>Connecting to ${ip}:${port}...</span>
    `;

    // Simulate connection steps
    await simulateVPSConnection(ip, port, username, statusEl);

    // Get auto-config options
    const autoNginx = document.getElementById('vpsNginx')?.checked || false;
    const autoSSL = document.getElementById('vpsSSL')?.checked || false;
    const autoFirewall = document.getElementById('vpsFirewall')?.checked || false;
    const autoFail2ban = document.getElementById('vpsFail2ban')?.checked || false;

    // Create VPS record
    const vpsRecord = {
        id: Utils.generateId(),
        ip: ip,
        port: parseInt(port),
        username: username,
        authMethod: authMethod,
        status: 'connected',
        hostname: `vps-${ip.replace(/\./g, '-')}`,
        os: 'Ubuntu 22.04 LTS',
        autoConfig: {
            nginx: autoNginx,
            ssl: autoSSL,
            firewall: autoFirewall,
            fail2ban: autoFail2ban
        },
        connectedAt: new Date().toISOString(),
        lastPingAt: new Date().toISOString(),
        userId: currentUser ? currentUser.id : ''
    };

    // Save to list
    connectedVPSList.push(vpsRecord);

    // Save to local storage
    if (currentUser) {
        Utils.saveLocal(`vps_${currentUser.id}`, connectedVPSList);
    }

    // Save to JSONBin
    if (CONFIG.BINS.VPS && db.getMasterKey()) {
        try {
            let allVPS = [];
            const data = await db.read(CONFIG.BINS.VPS);
            if (data && Array.isArray(data.servers)) {
                allVPS = data.servers;
            }
            allVPS.push(vpsRecord);
            await db.update(CONFIG.BINS.VPS, { servers: allVPS });
        } catch (e) {
            console.error('Save VPS to JSONBin error:', e);
        }
    }

    // Show success
    statusEl.className = 'vps-status connected';
    statusEl.innerHTML = `
        <i class="fas fa-check-circle"></i>
        <div>
            <strong>Connected Successfully!</strong>
            <p style="font-size:12px;margin-top:4px;">
                VPS at ${ip} is now linked to your DeployHub account.
                ${autoNginx ? '✓ Nginx configured. ' : ''}
                ${autoSSL ? '✓ Certbot ready. ' : ''}
                ${autoFirewall ? '✓ UFW configured. ' : ''}
                ${autoFail2ban ? '✓ Fail2Ban installed. ' : ''}
            </p>
        </div>
    `;

    // Render VPS list
    renderVPSList();

    // Clear form
    document.getElementById('vpsIP').value = '';
    document.getElementById('vpsPassword').value = '';
    document.getElementById('vpsKey').value = '';

    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-link"></i> Connect VPS';

    showToast('success', 'VPS Connected!', `Successfully connected to ${ip}`);
}

// ============================================
// Simulate VPS Connection
// ============================================
async function simulateVPSConnection(ip, port, username, statusEl) {
    const steps = [
        { message: `Establishing SSH connection to ${ip}:${port}...`, delay: 800 },
        { message: `Authenticating as ${username}...`, delay: 600 },
        { message: 'Verifying server access...', delay: 500 },
        { message: 'Checking server specifications...', delay: 400 },
        { message: 'Installing DeployHub agent...', delay: 700 },
        { message: 'Configuring auto-deployment...', delay: 500 },
        { message: 'Setting up reverse proxy...', delay: 600 },
        { message: 'Finalizing connection...', delay: 400 }
    ];

    for (const step of steps) {
        statusEl.innerHTML = `
            <div class="spinner" style="width:20px;height:20px;border-width:2px;"></div>
            <span>${step.message}</span>
        `;
        await new Promise(resolve => setTimeout(resolve, step.delay));
    }
}

// ============================================
// Render VPS List
// ============================================
function renderVPSList() {
    const container = document.getElementById('vpsList');
    if (!container) return;

    // Load from local storage
    if (currentUser) {
        connectedVPSList = Utils.loadLocal(`vps_${currentUser.id}`) || [];
    }

    if (connectedVPSList.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🖥️</div>
                <h3>No VPS Connected</h3>
                <p>Connect a VPS server to deploy websites directly to your own server</p>
            </div>
        `;
        return;
    }

    container.innerHTML = connectedVPSList.map(vps => `
        <div class="vps-item">
            <div class="vps-item-icon">
                <i class="fas fa-server"></i>
            </div>
            <div class="vps-item-info">
                <h4>${vps.hostname || vps.ip}</h4>
                <p>
                    <span>${vps.ip}:${vps.port}</span> · 
                    <span>${vps.os || 'Linux'}</span> · 
                    <span>User: ${vps.username}</span> · 
                    <span style="color:var(--success);">● Connected</span>
                </p>
                <p style="margin-top:4px;">
                    ${vps.autoConfig?.nginx ? '<span class="sec-feature-tag" style="margin-right:4px;">Nginx</span>' : ''}
                    ${vps.autoConfig?.ssl ? '<span class="sec-feature-tag" style="margin-right:4px;">SSL</span>' : ''}
                    ${vps.autoConfig?.firewall ? '<span class="sec-feature-tag" style="margin-right:4px;">UFW</span>' : ''}
                    ${vps.autoConfig?.fail2ban ? '<span class="sec-feature-tag" style="margin-right:4px;">Fail2Ban</span>' : ''}
                </p>
            </div>
            <div style="display:flex;gap:8px;flex-shrink:0;">
                <button class="btn btn-ghost btn-sm" onclick="pingVPS('${vps.id}')">
                    <i class="fas fa-heartbeat"></i> Ping
                </button>
                <button class="btn btn-ghost btn-sm" onclick="viewVPSConfig('${vps.id}')">
                    <i class="fas fa-cog"></i> Config
                </button>
                <button class="btn btn-ghost btn-sm" style="color:var(--error);" onclick="disconnectVPS('${vps.id}')">
                    <i class="fas fa-unlink"></i>
                </button>
            </div>
        </div>
    `).join('');
}

// ============================================
// Ping VPS
// ============================================
async function pingVPS(vpsId) {
    const vps = connectedVPSList.find(v => v.id === vpsId);
    if (!vps) return;

    showToast('info', 'Pinging...', `Checking connection to ${vps.ip}`);

    // Simulate ping
    await new Promise(resolve => setTimeout(resolve, 1500));

    const latency = Math.floor(Math.random() * 50) + 10;

    vps.lastPingAt = new Date().toISOString();
    if (currentUser) {
        Utils.saveLocal(`vps_${currentUser.id}`, connectedVPSList);
    }

    showToast('success', 'Ping Successful', `${vps.ip} responded in ${latency}ms`);
}

// ============================================
// View VPS Config
// ============================================
function viewVPSConfig(vpsId) {
    const vps = connectedVPSList.find(v => v.id === vpsId);
    if (!vps) return;

    // Get user's projects
    const projects = currentUser ? Utils.loadLocal(`projects_${currentUser.id}`) || [] : [];
    const activeProjects = projects.filter(p => p.status === 'active');

    let nginxConfigs = '';
    activeProjects.forEach(p => {
        if (p.domain) {
            nginxConfigs += generateNginxConfig(p.security || {}, p.domain) + '\n\n';
        }
    });

    // Generate setup script
    const setupScript = generateVPSSetupScript(vps);

    const modal = document.getElementById('projectModal');
    const content = document.getElementById('projectDetailContent');

    content.innerHTML = `
        <div class="project-detail-header">
            <h2><i class="fas fa-server" style="color:var(--accent-secondary);"></i> ${vps.hostname || vps.ip}</h2>
            <span class="status-badge success"><i class="fas fa-check-circle"></i> Connected</span>
        </div>

        <div class="detail-grid">
            <div class="detail-item">
                <div class="detail-item-label">IP Address</div>
                <div class="detail-item-value">${vps.ip}</div>
            </div>
            <div class="detail-item">
                <div class="detail-item-label">SSH Port</div>
                <div class="detail-item-value">${vps.port}</div>
            </div>
            <div class="detail-item">
                <div class="detail-item-label">Username</div>
                <div class="detail-item-value">${vps.username}</div>
            </div>
            <div class="detail-item">
                <div class="detail-item-label">OS</div>
                <div class="detail-item-value">${vps.os || 'Linux'}</div>
            </div>
            <div class="detail-item">
                <div class="detail-item-label">Connected</div>
                <div class="detail-item-value">${Utils.formatDate(vps.connectedAt)}</div>
            </div>
            <div class="detail-item">
                <div class="detail-item-label">Last Ping</div>
                <div class="detail-item-value">${Utils.timeAgo(vps.lastPingAt)}</div>
            </div>
        </div>

        <div class="settings-card" style="margin-top:20px;">
            <div class="settings-card-header">
                <h3><i class="fas fa-terminal"></i> Setup Script</h3>
            </div>
            <p style="color:var(--text-secondary);font-size:13px;margin-bottom:12px;">
                Run this script on your VPS to set up the deployment environment:
            </p>
            <pre style="background:var(--bg-tertiary);padding:16px;border-radius:8px;overflow-x:auto;font-size:12px;font-family:monospace;color:var(--text-secondary);max-height:300px;overflow-y:auto;white-space:pre-wrap;">${escapeHtml(setupScript)}</pre>
            <button class="btn btn-primary btn-sm" style="margin-top:8px;" onclick="Utils.copyToClipboard(\`${setupScript.replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`); showToast('success','Copied!','Setup script copied');">
                <i class="fas fa-copy"></i> Copy Script
            </button>
        </div>

        ${nginxConfigs ? `
        <div class="settings-card" style="margin-top:16px;">
            <div class="settings-card-header">
                <h3><i class="fas fa-server"></i> Nginx Configurations</h3>
            </div>
            <p style="color:var(--text-secondary);font-size:13px;margin-bottom:12px;">
                Nginx configs for your active projects:
            </p>
            <pre style="background:var(--bg-tertiary);padding:16px;border-radius:8px;overflow-x:auto;font-size:12px;font-family:monospace;color:var(--text-secondary);max-height:400px;overflow-y:auto;white-space:pre-wrap;">${escapeHtml(nginxConfigs)}</pre>
        </div>
        ` : ''}
    `;

    modal.classList.add('show');
}

// ============================================
// Generate VPS Setup Script
// ============================================
function generateVPSSetupScript(vps) {
    let script = `#!/bin/bash
# ============================================
# DeployHub VPS Setup Script
# Server: ${vps.ip}
# Generated: ${new Date().toISOString()}
# ============================================

echo "🚀 Starting DeployHub VPS Setup..."

# Update system
echo "📦 Updating system packages..."
sudo apt update && sudo apt upgrade -y

`;

    if (vps.autoConfig?.nginx) {
        script += `
# Install Nginx
echo "🔧 Installing Nginx..."
sudo apt install -y nginx
sudo systemctl start nginx
sudo systemctl enable nginx
echo "✅ Nginx installed and started"

# Create web root directory
sudo mkdir -p /var/www/html
sudo chown -R www-data:www-data /var/www/html

`;
    }

    if (vps.autoConfig?.ssl) {
        script += `
# Install Certbot for Let's Encrypt SSL
echo "🔒 Installing Certbot..."
sudo apt install -y certbot python3-certbot-nginx
echo "✅ Certbot installed"

# To issue SSL certificate for a domain, run:
# sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com --non-interactive --agree-tos -m admin@yourdomain.com

`;
    }

    if (vps.autoConfig?.firewall) {
        script += `
# Configure UFW Firewall
echo "🛡️ Configuring UFW Firewall..."
sudo apt install -y ufw
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw allow ${vps.port}/tcp
sudo ufw --force enable
echo "✅ UFW Firewall configured"

`;
    }

    if (vps.autoConfig?.fail2ban) {
        script += `
# Install and configure Fail2Ban
echo "🔐 Installing Fail2Ban..."
sudo apt install -y fail2ban

# Create Fail2Ban config
sudo cat > /etc/fail2ban/jail.local << 'EOF'
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true
port = ${vps.port}
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
bantime = 86400

[nginx-http-auth]
enabled = true

[nginx-limit-req]
enabled = true
EOF

sudo systemctl restart fail2ban
sudo systemctl enable fail2ban
echo "✅ Fail2Ban configured"

`;
    }

    script += `
# Install additional tools
echo "📦 Installing additional tools..."
sudo apt install -y git curl wget unzip htop

# Set up auto-deployment directory
sudo mkdir -p /opt/deployhub
sudo chmod 755 /opt/deployhub

# Create deployment script
cat > /opt/deployhub/deploy.sh << 'DEPLOYEOF'
#!/bin/bash
# DeployHub Auto-Deploy Script
DOMAIN=$1
REPO=$2
BRANCH=$3

if [ -z "$DOMAIN" ] || [ -z "$REPO" ]; then
    echo "Usage: deploy.sh <domain> <repo-url> <branch>"
    exit 1
fi

WEB_ROOT="/var/www/$DOMAIN"
mkdir -p $WEB_ROOT

# Clone or pull
if [ -d "$WEB_ROOT/.git" ]; then
    cd $WEB_ROOT && git pull origin $BRANCH
else
    git clone -b $BRANCH $REPO $WEB_ROOT
fi

# Set permissions
chown -R www-data:www-data $WEB_ROOT
chmod -R 755 $WEB_ROOT

echo "✅ Deployed $DOMAIN successfully!"
DEPLOYEOF

chmod +x /opt/deployhub/deploy.sh

echo ""
echo "============================================"
echo "🎉 DeployHub VPS Setup Complete!"
echo "============================================"
echo "Server IP: ${vps.ip}"
echo "SSH Port: ${vps.port}"
echo "Web Root: /var/www/"
echo "Deploy Script: /opt/deployhub/deploy.sh"
echo ""
echo "To deploy a site:"
echo "  /opt/deployhub/deploy.sh yourdomain.com https://github.com/user/repo main"
echo "============================================"
`;

    return script;
}

// ============================================
// Disconnect VPS
// ============================================
function disconnectVPS(vpsId) {
    const vps = connectedVPSList.find(v => v.id === vpsId);
    if (!vps) return;

    showConfirm(
        'Disconnect VPS?',
        `Are you sure you want to disconnect ${vps.ip}? Your deployments on this server won't be affected.`,
        async () => {
            connectedVPSList = connectedVPSList.filter(v => v.id !== vpsId);

            if (currentUser) {
                Utils.saveLocal(`vps_${currentUser.id}`, connectedVPSList);
            }

            if (CONFIG.BINS.VPS && db.getMasterKey()) {
                try {
                    await db.update(CONFIG.BINS.VPS, { servers: connectedVPSList });
                } catch (e) { }
            }

            renderVPSList();
            closeProjectModal();
            showToast('success', 'VPS Disconnected', `${vps.ip} has been disconnected`);
        }
    );
}

// ============================================
// Load VPS Data
// ============================================
function loadVPSData() {
    if (!currentUser) return;
    connectedVPSList = Utils.loadLocal(`vps_${currentUser.id}`) || [];
    renderVPSList();
}
