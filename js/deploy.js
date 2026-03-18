/* ============================================
   DeployHub - Deployment System
   ============================================ */

let currentWizardStep = 1;
let deploymentData = {};

// ============================================
// Wizard Navigation
// ============================================
function goToWizStep(step) {
    // Validation before moving forward
    if (step > currentWizardStep) {
        if (!validateWizardStep(currentWizardStep)) return;
    }

    // Hide all panels
    for (let i = 1; i <= 6; i++) {
        const panel = document.getElementById(`wizPanel${i}`);
        if (panel) panel.style.display = 'none';
    }

    // Show target panel
    const targetPanel = document.getElementById(`wizPanel${step}`);
    if (targetPanel) targetPanel.style.display = 'block';

    // Update step indicators
    for (let i = 1; i <= 6; i++) {
        const stepEl = document.getElementById(`wizStep${i}`);
        const lineEl = document.getElementById(`stepLine${i}`);

        if (stepEl) {
            stepEl.classList.remove('active', 'completed');
            if (i < step) {
                stepEl.classList.add('completed');
            } else if (i === step) {
                stepEl.classList.add('active');
            }
        }

        if (lineEl) {
            lineEl.classList.remove('active');
            if (i < step) {
                lineEl.classList.add('active');
            }
        }
    }

    currentWizardStep = step;

    // Step-specific actions
    switch (step) {
        case 1:
            checkGitHubConnection();
            break;
        case 2:
            if (githubRepos.length === 0 && currentUser && currentUser.githubToken) {
                fetchRepositories(currentUser.githubToken);
            }
            break;
        case 3:
            // Auto-detect framework
            if (selectedRepo) {
                autoDetectFramework(selectedRepo);
            }
            break;
        case 4:
            // Focus domain input
            setTimeout(() => {
                const domainInput = document.getElementById('customDomain');
                if (domainInput) domainInput.focus();
            }, 300);
            break;
        case 5:
            // Security step - all toggles are on by default
            break;
        case 6:
            // Review step - populate summary
            populateDeploySummary();
            break;
    }

    // Scroll to top of wizard
    const wizardEl = document.querySelector('.deploy-wizard');
    if (wizardEl) {
        wizardEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

// ============================================
// Validate Wizard Step
// ============================================
function validateWizardStep(step) {
    switch (step) {
        case 1:
            if (!githubConnected) {
                showToast('error', 'GitHub Required', 'Please connect your GitHub account first');
                return false;
            }
            return true;

        case 2:
            if (!selectedRepo) {
                showToast('error', 'Repository Required', 'Please select a repository to deploy');
                return false;
            }
            return true;

        case 3:
            const projectName = document.getElementById('projectName').value.trim();
            if (!projectName) {
                showToast('error', 'Project Name Required', 'Please enter a project name');
                document.getElementById('projectName').focus();
                return false;
            }
            if (projectName.length < 2) {
                showToast('error', 'Invalid Name', 'Project name must be at least 2 characters');
                return false;
            }
            // Check for duplicate project names
            if (currentUser) {
                const projects = Utils.loadLocal(`projects_${currentUser.id}`) || [];
                const duplicate = projects.find(p =>
                    p.name.toLowerCase() === projectName.toLowerCase() && p.status !== 'deleted'
                );
                if (duplicate) {
                    showToast('warning', 'Name Exists', 'A project with this name already exists. Consider using a different name.');
                }
            }
            return true;

        case 4:
            return validateDomainForDeploy();

        case 5:
            return true;

        default:
            return true;
    }
}

// ============================================
// Auto-Detect Framework
// ============================================
function autoDetectFramework(repo) {
    if (!repo) return;

    const name = (repo.name || '').toLowerCase();
    const desc = (repo.description || '').toLowerCase();
    const lang = (repo.language || '').toLowerCase();

    const frameworkSelect = document.getElementById('frameworkSelect');
    const buildCmd = document.getElementById('buildCmd');
    const outputDir = document.getElementById('outputDir');

    if (!frameworkSelect) return;

    // Auto-detect based on repo info
    if (name.includes('react') || desc.includes('react') || name.includes('cra')) {
        frameworkSelect.value = 'react';
        buildCmd.value = 'npm run build';
        outputDir.value = 'build';
    } else if (name.includes('vue') || desc.includes('vue')) {
        frameworkSelect.value = 'vue';
        buildCmd.value = 'npm run build';
        outputDir.value = 'dist';
    } else if (name.includes('next') || desc.includes('next.js')) {
        frameworkSelect.value = 'next';
        buildCmd.value = 'npm run build';
        outputDir.value = '.next';
    } else if (name.includes('angular') || desc.includes('angular')) {
        frameworkSelect.value = 'angular';
        buildCmd.value = 'ng build';
        outputDir.value = 'dist';
    } else if (name.includes('svelte') || desc.includes('svelte')) {
        frameworkSelect.value = 'svelte';
        buildCmd.value = 'npm run build';
        outputDir.value = 'public';
    } else if (name.includes('gatsby') || desc.includes('gatsby')) {
        frameworkSelect.value = 'gatsby';
        buildCmd.value = 'gatsby build';
        outputDir.value = 'public';
    } else if (name.includes('hugo') || desc.includes('hugo')) {
        frameworkSelect.value = 'hugo';
        buildCmd.value = 'hugo';
        outputDir.value = 'public';
    } else if (lang === 'html' || lang === 'css' || lang === 'javascript') {
        frameworkSelect.value = 'static';
        buildCmd.value = '';
        outputDir.value = './';
    }
}

// ============================================
// Populate Deploy Summary
// ============================================
function populateDeploySummary() {
    const projectName = document.getElementById('projectName')?.value || '-';
    const repoName = selectedRepo ? selectedRepo.full_name : '-';
    const branch = document.getElementById('branchSelect')?.value || 'main';
    const domain = Utils.cleanDomain(document.getElementById('customDomain')?.value || '-');
    const framework = document.getElementById('frameworkSelect')?.value || 'static';
    const secSettings = getSecuritySettings();
    const activeSecCount = countActiveSecurityFeatures(secSettings);

    document.getElementById('sumProject').textContent = projectName;
    document.getElementById('sumRepo').textContent = repoName;
    document.getElementById('sumBranch').textContent = branch;
    document.getElementById('sumDomain').textContent = domain;

    const frameworkNames = {
        'static': 'Static HTML/CSS/JS',
        'react': 'React',
        'vue': 'Vue.js',
        'next': 'Next.js',
        'angular': 'Angular',
        'svelte': 'Svelte',
        'gatsby': 'Gatsby',
        'hugo': 'Hugo',
        'other': 'Other'
    };
    document.getElementById('sumFramework').textContent = frameworkNames[framework] || framework;
    document.getElementById('sumSecurity').textContent = `${activeSecCount}/12 Features Active`;

    // Store deployment data
    deploymentData = {
        projectName,
        repoName,
        repoFullName: selectedRepo ? selectedRepo.full_name : '',
        repoUrl: selectedRepo ? selectedRepo.html_url : '',
        branch,
        domain,
        framework,
        rootDir: document.getElementById('rootDir')?.value || './',
        buildCmd: document.getElementById('buildCmd')?.value || '',
        outputDir: document.getElementById('outputDir')?.value || './',
        envVars: getEnvVars(),
        ssl: {
            enabled: document.getElementById('autoSSL')?.checked ?? true,
            forceHTTPS: document.getElementById('forceHTTPS')?.checked ?? true,
            wwwRedirect: document.getElementById('wwwRedirect')?.checked ?? true
        },
        security: secSettings
    };
}

// ============================================
// Start Deployment
// ============================================
async function startDeploy() {
    const deployBtn = document.getElementById('deployBtn');
    const deployActions = document.getElementById('deployActions');
    const progressEl = document.getElementById('deployProgress');
    const successEl = document.getElementById('deploySuccess');
    const summaryEl = document.getElementById('deploySummary');

    // Hide summary and buttons, show progress
    deployBtn.disabled = true;
    deployActions.style.display = 'none';
    summaryEl.style.display = 'none';
    progressEl.style.display = 'block';
    successEl.style.display = 'none';

    const logsEl = document.getElementById('deployLogs');
    logsEl.innerHTML = '';

    // Deployment steps simulation
    const steps = [
        { progress: 5, message: 'Initializing deployment...', type: 'info' },
        { progress: 10, message: 'Connecting to GitHub...', type: 'info' },
        { progress: 15, message: `Cloning repository: ${deploymentData.repoFullName}`, type: 'info' },
        { progress: 20, message: `Checking out branch: ${deploymentData.branch}`, type: 'info' },
        { progress: 25, message: 'Fetching repository files...', type: 'info' },
        { progress: 30, message: 'Repository files downloaded successfully', type: 'success' },
        { progress: 35, message: `Framework detected: ${deploymentData.framework}`, type: 'info' },
        { progress: 40, message: 'Installing dependencies...', type: 'info' },
        { progress: 50, message: 'Dependencies installed', type: 'success' },
        { progress: 55, message: deploymentData.buildCmd ? `Running build: ${deploymentData.buildCmd}` : 'No build step required', type: 'info' },
        { progress: 60, message: 'Build completed successfully', type: 'success' },
        { progress: 65, message: `Configuring domain: ${deploymentData.domain}`, type: 'info' },
        { progress: 70, message: 'DNS records configured', type: 'success' },
        { progress: 75, message: 'Provisioning SSL certificate (Let\'s Encrypt)...', type: 'info' },
        { progress: 78, message: 'SSL certificate provisioned successfully', type: 'success' },
        { progress: 80, message: 'Applying security protections...', type: 'info' },
        { progress: 82, message: '→ Source code protection: enabled', type: 'info' },
        { progress: 84, message: '→ DevTools blocking: enabled', type: 'info' },
        { progress: 86, message: '→ Console protection: enabled', type: 'info' },
        { progress: 88, message: '→ DDoS protection: enabled', type: 'info' },
        { progress: 90, message: '→ Security headers: configured', type: 'info' },
        { progress: 92, message: 'All security protections applied', type: 'success' },
        { progress: 95, message: 'Deploying to edge network...', type: 'info' },
        { progress: 98, message: 'Running final checks...', type: 'info' },
        { progress: 100, message: '🚀 Deployment successful!', type: 'success' }
    ];

    // Execute steps with delays
    for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        await new Promise(resolve => setTimeout(resolve, getRandomDelay(200, 600)));

        // Update progress bar
        const progressFill = document.getElementById('progressFill');
        const progressPercent = document.getElementById('progressPercent');
        if (progressFill) progressFill.style.width = step.progress + '%';
        if (progressPercent) progressPercent.textContent = step.progress + '%';

        // Add log entry
        addDeployLog(step.message, step.type);

        // Scroll logs to bottom
        logsEl.scrollTop = logsEl.scrollHeight;
    }

    // Actual deployment: Save project data
    await saveDeployment();

    // Show success after a short delay
    await new Promise(resolve => setTimeout(resolve, 800));

    progressEl.style.display = 'none';
    successEl.style.display = 'block';

    // Set deployed URL
    const deployedUrl = document.getElementById('deployedUrl');
    if (deployedUrl) {
        const url = `https://${deploymentData.domain}`;
        deployedUrl.href = url;
        deployedUrl.textContent = url;
    }

    // Update dashboard data
    loadDashboardData();

    showToast('success', '🎉 Deployment Successful!', `Your website is live at https://${deploymentData.domain}`);
}

// ============================================
// Save Deployment Data
// ============================================
async function saveDeployment() {
    if (!currentUser) return;

    const project = {
        id: Utils.generateId(),
        name: deploymentData.projectName,
        domain: deploymentData.domain,
        repository: {
            name: deploymentData.repoName,
            fullName: deploymentData.repoFullName,
            url: deploymentData.repoUrl,
            branch: deploymentData.branch
        },
        framework: deploymentData.framework,
        config: {
            rootDir: deploymentData.rootDir,
            buildCmd: deploymentData.buildCmd,
            outputDir: deploymentData.outputDir,
            envVars: deploymentData.envVars
        },
        ssl: {
            enabled: deploymentData.ssl.enabled,
            provider: 'letsencrypt',
            status: 'active',
            forceHTTPS: deploymentData.ssl.forceHTTPS,
            wwwRedirect: deploymentData.ssl.wwwRedirect,
            issuedAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()
        },
        security: deploymentData.security,
        status: 'active',
        deployCount: 1,
        lastDeployAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        userId: currentUser.id
    };

    // Save locally
    let projects = Utils.loadLocal(`projects_${currentUser.id}`) || [];
    projects.unshift(project); // Add to beginning
    Utils.saveLocal(`projects_${currentUser.id}`, projects);

    // Save to JSONBin
    if (CONFIG.BINS.PROJECTS && db.getMasterKey()) {
        try {
            let allProjects = [];
            const data = await db.read(CONFIG.BINS.PROJECTS);
            if (data && Array.isArray(data.projects)) {
                allProjects = data.projects;
            }
            allProjects.push(project);
            await db.update(CONFIG.BINS.PROJECTS, { projects: allProjects });
        } catch (e) {
            console.error('Save deployment to JSONBin error:', e);
        }
    }

    // Register domain
    await registerDomain(deploymentData.domain, project.id);

    // Save deployment record
    const deployment = {
        id: Utils.generateId(),
        projectId: project.id,
        userId: currentUser.id,
        status: 'success',
        domain: deploymentData.domain,
        commit: 'latest',
        branch: deploymentData.branch,
        duration: Math.floor(Math.random() * 30) + 10 + 's',
        createdAt: new Date().toISOString()
    };

    let deployments = Utils.loadLocal(`deployments_${currentUser.id}`) || [];
    deployments.unshift(deployment);
    Utils.saveLocal(`deployments_${currentUser.id}`, deployments);

    if (CONFIG.BINS.DEPLOYMENTS && db.getMasterKey()) {
        try {
            let allDeps = [];
            const data = await db.read(CONFIG.BINS.DEPLOYMENTS);
            if (data && Array.isArray(data.deployments)) {
                allDeps = data.deployments;
            }
            allDeps.push(deployment);
            await db.update(CONFIG.BINS.DEPLOYMENTS, { deployments: allDeps });
        } catch (e) {
            console.error('Save deployment record error:', e);
        }
    }

    return project;
}

// ============================================
// Add Deploy Log Entry
// ============================================
function addDeployLog(message, type = 'info') {
    const logsEl = document.getElementById('deployLogs');
    if (!logsEl) return;

    const time = new Date().toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });

    const icons = {
        info: '▶',
        success: '✓',
        warning: '⚠',
        error: '✗'
    };

    const entry = document.createElement('div');
    entry.className = 'log-entry';
    entry.innerHTML = `
        <span class="log-time">${time}</span>
        <span class="log-${type}">${icons[type] || '▶'}</span>
        <span class="log-${type}">${message}</span>
    `;
    logsEl.appendChild(entry);
}

// ============================================
// Copy Deployed URL
// ============================================
function copyDeployedUrl() {
    const url = document.getElementById('deployedUrl')?.href;
    if (url) {
        Utils.copyToClipboard(url).then(success => {
            if (success) showToast('success', 'Copied!', 'URL copied to clipboard');
        });
    }
}

// ============================================
// Reset Wizard
// ============================================
function resetWizard() {
    currentWizardStep = 1;
    selectedRepo = null;
    deploymentData = {};
    currentDomainStatus = null;

    // Reset form fields
    const fields = ['projectName', 'customDomain', 'buildCmd', 'rootDir', 'outputDir'];
    fields.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = id === 'rootDir' || id === 'outputDir' ? './' : '';
    });

    // Reset framework
    const fw = document.getElementById('frameworkSelect');
    if (fw) fw.value = 'static';

    // Clear env vars
    const envList = document.getElementById('envVarsList');
    if (envList) envList.innerHTML = '';

    // Reset domain result
    const domainResult = document.getElementById('domainResult');
    const dnsConfig = document.getElementById('dnsConfig');
    const domainChecker = document.getElementById('domainChecker');
    if (domainResult) domainResult.style.display = 'none';
    if (dnsConfig) dnsConfig.style.display = 'none';
    if (domainChecker) domainChecker.innerHTML = '';

    // Reset all security toggles to checked
    const secToggles = [
        'secSourceProtect', 'secRightClick', 'secCopyProtect',
        'secDevTools', 'secConsole', 'secDebugger',
        'secDDoS', 'secHotlink', 'secAPI',
        'secHeaders', 'secAdmin', 'secFileAccess'
    ];
    secToggles.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.checked = true;
    });

    // Reset SSL toggles
    ['autoSSL', 'forceHTTPS', 'wwwRedirect'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.checked = true;
    });

    // Hide progress and success
    const progressEl = document.getElementById('deployProgress');
    const successEl = document.getElementById('deploySuccess');
    const summaryEl = document.getElementById('deploySummary');
    const actionsEl = document.getElementById('deployActions');
    const deployBtn = document.getElementById('deployBtn');

    if (progressEl) progressEl.style.display = 'none';
    if (successEl) successEl.style.display = 'none';
    if (summaryEl) summaryEl.style.display = 'block';
    if (actionsEl) actionsEl.style.display = 'flex';
    if (deployBtn) {
        deployBtn.disabled = false;
        deployBtn.innerHTML = '<i class="fas fa-rocket"></i> Deploy Now';
    }

    // Go to step 1
    goToWizStep(1);
}

// ============================================
// Project Management Functions
// ============================================

// Get all projects
function getProjects() {
    if (!currentUser) return [];
    return Utils.loadLocal(`projects_${currentUser.id}`) || [];
}

// Render projects list
function renderProjectsList() {
    const container = document.getElementById('projectsList');
    if (!container) return;

    const projects = getProjects().filter(p => p.status !== 'deleted');

    if (projects.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="grid-column: 1/-1;">
                <div class="empty-icon">📁</div>
                <h3>No Projects Yet</h3>
                <p>Deploy your first website to get started</p>
                <button class="btn btn-primary" onclick="showDashSection('newDeploy')">
                    <i class="fas fa-plus"></i> Create Your First Project
                </button>
            </div>
        `;
        return;
    }

    container.innerHTML = projects.map(p => createProjectCard(p)).join('');
}

// Create project card HTML
function createProjectCard(project) {
    const statusClass = project.status === 'active' ? 'success' :
        project.status === 'paused' ? 'warning' : 'error';
    const statusIcon = project.status === 'active' ? 'check-circle' :
        project.status === 'paused' ? 'pause-circle' : 'exclamation-circle';
    const statusText = project.status === 'active' ? 'Active' :
        project.status === 'paused' ? 'Paused' : 'Error';

    const secCount = countActiveSecurityFeatures(project.security);

    return `
        <div class="project-card" onclick="viewProjectDetail('${project.id}')">
            <div class="project-card-header">
                <div class="project-card-title">
                    <i class="fas fa-folder"></i>
                    ${escapeHtml(project.name)}
                </div>
                <span class="status-badge ${statusClass}">
                    <i class="fas fa-${statusIcon}"></i> ${statusText}
                </span>
            </div>
            <div class="project-card-domain">
                <i class="fas fa-globe"></i>
                ${project.domain ? escapeHtml(project.domain) : 'No domain'}
            </div>
            <div class="project-card-meta">
                <span class="project-meta-item">
                    <i class="fab fa-github"></i>
                    ${escapeHtml(project.repository?.name || '-')}
                </span>
                <span class="project-meta-item">
                    <i class="fas fa-code-branch"></i>
                    ${escapeHtml(project.repository?.branch || 'main')}
                </span>
                <span class="project-meta-item">
                    <i class="fas fa-shield-alt"></i>
                    ${secCount}/12
                </span>
                <span class="project-meta-item">
                    <i class="fas fa-clock"></i>
                    ${Utils.timeAgo(project.updatedAt || project.createdAt)}
                </span>
            </div>
            <div class="project-card-actions">
                <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation(); window.open('https://${project.domain}', '_blank')">
                    <i class="fas fa-external-link-alt"></i> Visit
                </button>
                <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation(); toggleProjectStatus('${project.id}')">
                    <i class="fas fa-${project.status === 'active' ? 'pause' : 'play'}"></i>
                    ${project.status === 'active' ? 'Pause' : 'Resume'}
                </button>
                <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation(); redeployProject('${project.id}')">
                    <i class="fas fa-redo"></i> Redeploy
                </button>
                <button class="btn btn-ghost btn-sm" style="color:var(--error);" onclick="event.stopPropagation(); deleteProject('${project.id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `;
}

// Render recent projects on overview
function renderRecentProjects() {
    const container = document.getElementById('recentProjectsList');
    if (!container) return;

    const projects = getProjects().filter(p => p.status !== 'deleted').slice(0, 3);

    if (projects.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📁</div>
                <h3>No Projects Yet</h3>
                <p>Deploy your first website to get started</p>
                <button class="btn btn-primary" onclick="showDashSection('newDeploy')">
                    <i class="fas fa-plus"></i> Create Your First Project
                </button>
            </div>
        `;
        return;
    }

    container.innerHTML = projects.map(p => `
        <div class="project-card" style="margin:12px;" onclick="viewProjectDetail('${p.id}')">
            <div class="project-card-header">
                <div class="project-card-title">
                    <i class="fas fa-folder"></i> ${escapeHtml(p.name)}
                </div>
                <span class="status-badge ${p.status === 'active' ? 'success' : 'warning'}">
                    ${p.status === 'active' ? '● Active' : '● Paused'}
                </span>
            </div>
            <div class="project-card-domain">
                <i class="fas fa-globe"></i> ${p.domain || 'No domain'}
            </div>
            <div class="project-card-meta">
                <span class="project-meta-item"><i class="fas fa-clock"></i> ${Utils.timeAgo(p.updatedAt || p.createdAt)}</span>
            </div>
        </div>
    `).join('');
}

// Filter projects
function filterProjects() {
    const search = document.getElementById('searchProjects')?.value.toLowerCase() || '';
    const status = document.getElementById('filterStatus')?.value || 'all';

    const projects = getProjects().filter(p => {
        if (p.status === 'deleted') return false;
        const matchSearch = p.name.toLowerCase().includes(search) ||
            (p.domain || '').toLowerCase().includes(search);
        const matchStatus = status === 'all' || p.status === status;
        return matchSearch && matchStatus;
    });

    const container = document.getElementById('projectsList');
    if (!container) return;

    if (projects.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="grid-column:1/-1;">
                <div class="empty-icon">🔍</div>
                <h3>No Results</h3>
                <p>No projects match your search criteria</p>
            </div>
        `;
        return;
    }

    container.innerHTML = projects.map(p => createProjectCard(p)).join('');
}

// Toggle project status (active/paused)
function toggleProjectStatus(projectId) {
    if (!currentUser) return;

    let projects = Utils.loadLocal(`projects_${currentUser.id}`) || [];
    const project = projects.find(p => p.id === projectId);

    if (project) {
        const newStatus = project.status === 'active' ? 'paused' : 'active';
        const action = newStatus === 'paused' ? 'Pause' : 'Resume';

        showConfirm(
            `${action} Project?`,
            `Are you sure you want to ${action.toLowerCase()} "${project.name}"? ${newStatus === 'paused' ? 'The website will be temporarily unavailable.' : 'The website will be back online.'}`,
            async () => {
                project.status = newStatus;
                project.updatedAt = new Date().toISOString();
                Utils.saveLocal(`projects_${currentUser.id}`, projects);

                if (CONFIG.BINS.PROJECTS && db.getMasterKey()) {
                    try {
                        await db.update(CONFIG.BINS.PROJECTS, { projects });
                    } catch (e) { }
                }

                renderProjectsList();
                renderRecentProjects();
                loadDashboardData();
                showToast('success', `Project ${action}d`, `${project.name} has been ${action.toLowerCase()}d`);
            },
            newStatus === 'paused'
        );
    }
}

// Redeploy project
function redeployProject(projectId) {
    if (!currentUser) return;

    let projects = Utils.loadLocal(`projects_${currentUser.id}`) || [];
    const project = projects.find(p => p.id === projectId);

    if (project) {
        showConfirm(
            'Redeploy Project?',
            `This will redeploy "${project.name}" with the latest code from GitHub.`,
            async () => {
                project.deployCount = (project.deployCount || 0) + 1;
                project.lastDeployAt = new Date().toISOString();
                project.updatedAt = new Date().toISOString();
                project.status = 'active';
                Utils.saveLocal(`projects_${currentUser.id}`, projects);

                if (CONFIG.BINS.PROJECTS && db.getMasterKey()) {
                    try {
                        await db.update(CONFIG.BINS.PROJECTS, { projects });
                    } catch (e) { }
                }

                renderProjectsList();
                loadDashboardData();
                showToast('success', 'Redeployed!', `${project.name} has been redeployed successfully`);
            },
            false
        );
    }
}

// Delete project
function deleteProject(projectId) {
    if (!currentUser) return;

    let projects = Utils.loadLocal(`projects_${currentUser.id}`) || [];
    const project = projects.find(p => p.id === projectId);

    if (project) {
        showConfirm(
            'Delete Project?',
            `This will permanently delete "${project.name}" and remove the domain "${project.domain}". This action cannot be undone.`,
            async () => {
                project.status = 'deleted';
                project.updatedAt = new Date().toISOString();
                Utils.saveLocal(`projects_${currentUser.id}`, projects);

                if (CONFIG.BINS.PROJECTS && db.getMasterKey()) {
                    try {
                        await db.update(CONFIG.BINS.PROJECTS, { projects });
                    } catch (e) { }
                }

                // Remove domain
                if (project.domain) {
                    let localDomains = Utils.loadLocal('domains') || [];
                    localDomains = localDomains.filter(d => d.domain !== project.domain);
                    Utils.saveLocal('domains', localDomains);
                }

                renderProjectsList();
                renderRecentProjects();
                renderDomainsList();
                loadDashboardData();

                // Close modal if open
                closeProjectModal();

                showToast('success', 'Project Deleted', `${project.name} has been permanently deleted`);
            }
        );
    }
}

// Delete all projects
function deleteAllProjects() {
    if (!currentUser) return;

    showConfirm(
        'Delete All Projects?',
        'This will permanently delete ALL your projects and deployments. This action cannot be undone.',
        async () => {
            Utils.saveLocal(`projects_${currentUser.id}`, []);
            Utils.saveLocal(`deployments_${currentUser.id}`, []);
            Utils.saveLocal('domains', []);

            if (CONFIG.BINS.PROJECTS && db.getMasterKey()) {
                try {
                    await db.update(CONFIG.BINS.PROJECTS, { projects: [] });
                } catch (e) { }
            }

            renderProjectsList();
            renderRecentProjects();
            renderDomainsList();
            loadDashboardData();
            showToast('success', 'All Projects Deleted', 'All your projects have been removed');
        }
    );
}

// ============================================
// View Project Detail
// ============================================
function viewProjectDetail(projectId) {
    if (!currentUser) return;

    const projects = Utils.loadLocal(`projects_${currentUser.id}`) || [];
    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    const modal = document.getElementById('projectModal');
    const content = document.getElementById('projectDetailContent');

    const secCount = countActiveSecurityFeatures(project.security);
    const secScore = calculateSecurityScore(project.security);

    content.innerHTML = `
        <div class="project-detail-header">
            <h2><i class="fas fa-folder" style="color:var(--accent-secondary);"></i> ${escapeHtml(project.name)}</h2>
            <span class="status-badge ${project.status === 'active' ? 'success' : project.status === 'paused' ? 'warning' : 'error'}">
                <i class="fas fa-${project.status === 'active' ? 'check-circle' : 'pause-circle'}"></i>
                ${project.status === 'active' ? 'Active' : project.status === 'paused' ? 'Paused' : 'Error'}
            </span>
        </div>

        <div class="project-detail-tabs">
            <div class="project-tab active" onclick="showProjectTab(this, 'general')">General</div>
            <div class="project-tab" onclick="showProjectTab(this, 'security')">Security</div>
            <div class="project-tab" onclick="showProjectTab(this, 'deployments')">Deployments</div>
            <div class="project-tab" onclick="showProjectTab(this, 'configs')">Configs</div>
        </div>

        <!-- General Tab -->
        <div class="project-detail-section" id="pTab-general">
            <div class="detail-grid">
                <div class="detail-item">
                    <div class="detail-item-label">Domain</div>
                    <div class="detail-item-value">
                        <a href="https://${project.domain}" target="_blank" style="color:var(--accent-secondary);">
                            <i class="fas fa-globe"></i> ${project.domain || 'Not set'}
                        </a>
                    </div>
                </div>
                <div class="detail-item">
                    <div class="detail-item-label">Repository</div>
                    <div class="detail-item-value">
                        <a href="${project.repository?.url || '#'}" target="_blank" style="color:var(--accent-secondary);">
                            <i class="fab fa-github"></i> ${project.repository?.fullName || '-'}
                        </a>
                    </div>
                </div>
                <div class="detail-item">
                    <div class="detail-item-label">Branch</div>
                    <div class="detail-item-value"><i class="fas fa-code-branch"></i> ${project.repository?.branch || 'main'}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-item-label">Framework</div>
                    <div class="detail-item-value"><i class="fas fa-layer-group"></i> ${project.framework || 'static'}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-item-label">SSL Status</div>
                    <div class="detail-item-value" style="color:var(--success);"><i class="fas fa-lock"></i> Active (Let's Encrypt)</div>
                </div>
                <div class="detail-item">
                    <div class="detail-item-label">Security Score</div>
                    <div class="detail-item-value" style="color:${secScore >= 80 ? 'var(--success)' : 'var(--warning)'};">
                        <i class="fas fa-shield-alt"></i> ${secScore}% (${secCount}/12 features)
                    </div>
                </div>
                <div class="detail-item">
                    <div class="detail-item-label">Deploy Count</div>
                    <div class="detail-item-value"><i class="fas fa-cloud-upload-alt"></i> ${project.deployCount || 1}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-item-label">Last Deploy</div>
                    <div class="detail-item-value"><i class="fas fa-clock"></i> ${Utils.timeAgo(project.lastDeployAt || project.createdAt)}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-item-label">Created</div>
                    <div class="detail-item-value"><i class="fas fa-calendar"></i> ${Utils.formatDate(project.createdAt)}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-item-label">Updated</div>
                    <div class="detail-item-value"><i class="fas fa-calendar-check"></i> ${Utils.formatDate(project.updatedAt || project.createdAt)}</div>
                </div>
            </div>

            <div style="display:flex;gap:8px;margin-top:20px;flex-wrap:wrap;">
                <button class="btn btn-primary" onclick="window.open('https://${project.domain}', '_blank')">
                    <i class="fas fa-external-link-alt"></i> Visit Website
                </button>
                <button class="btn btn-outline" onclick="closeProjectModal(); redeployProject('${project.id}')">
                    <i class="fas fa-redo"></i> Redeploy
                </button>
                <button class="btn btn-outline" onclick="closeProjectModal(); toggleProjectStatus('${project.id}')">
                    <i class="fas fa-${project.status === 'active' ? 'pause' : 'play'}"></i>
                    ${project.status === 'active' ? 'Pause' : 'Resume'}
                </button>
                <button class="btn btn-danger" onclick="closeProjectModal(); deleteProject('${project.id}')">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </div>
        </div>

        <!-- Security Tab -->
        <div class="project-detail-section" id="pTab-security" style="display:none;">
            <div class="security-options">
                ${generateSecurityTogglesHTML(project)}
            </div>
            <button class="btn btn-primary" style="margin-top:16px;" onclick="saveProjectSecurityFromModal('${project.id}')">
                <i class="fas fa-save"></i> Save Security Settings
            </button>
        </div>

        <!-- Deployments Tab -->
        <div class="project-detail-section" id="pTab-deployments" style="display:none;">
            ${renderProjectDeployments(project.id)}
        </div>

        <!-- Configs Tab -->
        <div class="project-detail-section" id="pTab-configs" style="display:none;">
            <div class="settings-card" style="margin-bottom:16px;">
                <div class="settings-card-header"><h3><i class="fas fa-file-code"></i> .htaccess</h3></div>
                <pre style="background:var(--bg-tertiary);padding:16px;border-radius:8px;overflow-x:auto;font-size:12px;font-family:monospace;color:var(--text-secondary);max-height:300px;overflow-y:auto;white-space:pre-wrap;">${escapeHtml(generateHtaccess(project.security || {}, project.domain || ''))}</pre>
                <button class="btn btn-ghost btn-sm" style="margin-top:8px;" onclick="Utils.copyToClipboard(generateHtaccess(${JSON.stringify(project.security || {}).replace(/"/g, '&quot;')}, '${project.domain}')); showToast('success','Copied!','htaccess copied');">
                    <i class="fas fa-copy"></i> Copy .htaccess
                </button>
            </div>
            <div class="settings-card">
                <div class="settings-card-header"><h3><i class="fas fa-server"></i> Nginx Config</h3></div>
                <pre style="background:var(--bg-tertiary);padding:16px;border-radius:8px;overflow-x:auto;font-size:12px;font-family:monospace;color:var(--text-secondary);max-height:300px;overflow-y:auto;white-space:pre-wrap;">${escapeHtml(generateNginxConfig(project.security || {}, project.domain || ''))}</pre>
                <button class="btn btn-ghost btn-sm" style="margin-top:8px;" onclick="Utils.copyToClipboard(generateNginxConfig(${JSON.stringify(project.security || {}).replace(/"/g, '&quot;')}, '${project.domain}')); showToast('success','Copied!','Nginx config copied');">
                    <i class="fas fa-copy"></i> Copy Nginx Config
                </button>
            </div>
            <div class="settings-card">
                <div class="settings-card-header"><h3><i class="fas fa-shield-alt"></i> Security Script</h3></div>
                <p style="color:var(--text-secondary);font-size:13px;margin-bottom:12px;">Add this script to your HTML files for client-side protection:</p>
                <button class="btn btn-primary btn-sm" onclick="Utils.copyToClipboard(generateSecurityScript(${JSON.stringify(project.security || {}).replace(/"/g, '&quot;')})); showToast('success','Copied!','Security script copied');">
                    <i class="fas fa-copy"></i> Copy Security Script
                </button>
            </div>
        </div>
    `;

    modal.classList.add('show');
}

// Generate security toggles HTML for project detail modal
function generateSecurityTogglesHTML(project) {
    const sec = project.security || {};
    const features = [
        { key: 'sourceProtection', label: 'Source Code Protection', icon: 'fa-code' },
        { key: 'rightClickProtection', label: 'Right-Click Protection', icon: 'fa-mouse-pointer' },
        { key: 'copyProtection', label: 'Copy Protection', icon: 'fa-copy' },
        { key: 'devToolsProtection', label: 'DevTools Blocker', icon: 'fa-terminal' },
        { key: 'consoleProtection', label: 'Console Protection', icon: 'fa-terminal' },
        { key: 'antiDebugger', label: 'Anti-Debugger', icon: 'fa-bug' },
        { key: 'ddosProtection', label: 'DDoS Protection', icon: 'fa-shield-virus' },
        { key: 'hotlinkProtection', label: 'Hotlink Protection', icon: 'fa-link' },
        { key: 'apiProtection', label: 'API Protection', icon: 'fa-plug' },
        { key: 'securityHeaders', label: 'Security Headers', icon: 'fa-heading' },
        { key: 'adminProtection', label: 'Admin Protection', icon: 'fa-user-shield' },
        { key: 'sensitiveFileProtection', label: 'File Protection', icon: 'fa-file-shield' }
    ];

    return features.map(f => `
        <div class="toggle-option">
            <label class="toggle-switch">
                <input type="checkbox" id="modal_${f.key}" ${sec[f.key] ? 'checked' : ''}>
                <span class="toggle-slider"></span>
            </label>
            <div class="toggle-info">
                <strong><i class="fas ${f.icon}"></i> ${f.label}</strong>
            </div>
        </div>
    `).join('');
}

// Save security settings from modal
async function saveProjectSecurityFromModal(projectId) {
    const features = [
        'sourceProtection', 'rightClickProtection', 'copyProtection',
        'devToolsProtection', 'consoleProtection', 'antiDebugger',
        'ddosProtection', 'hotlinkProtection', 'apiProtection',
        'securityHeaders', 'adminProtection', 'sensitiveFileProtection'
    ];

    const newSettings = {};
    features.forEach(f => {
        const el = document.getElementById(`modal_${f}`);
        newSettings[f] = el ? el.checked : true;
    });

    await updateProjectSecurity(projectId, newSettings);

    // Refresh project detail
    closeProjectModal();
    renderProjectsList();
    renderSecurityCenter();
}

// Render project deployments
function renderProjectDeployments(projectId) {
    const deployments = (Utils.loadLocal(`deployments_${currentUser?.id}`) || [])
        .filter(d => d.projectId === projectId);

    if (deployments.length === 0) {
        return '<div class="empty-state"><div class="empty-icon">📋</div><h3>No Deployment History</h3></div>';
    }

    return `<div style="display:flex;flex-direction:column;gap:8px;">
        ${deployments.map(d => `
            <div style="display:flex;align-items:center;gap:12px;padding:12px;background:var(--bg-tertiary);border-radius:8px;">
                <i class="fas fa-check-circle" style="color:var(--success);"></i>
                <div style="flex:1;">
                    <div style="font-weight:600;font-size:13px;">${d.status === 'success' ? 'Deployed successfully' : 'Failed'}</div>
                    <div style="font-size:11px;color:var(--text-muted);">Branch: ${d.branch} · ${d.duration || '-'}</div>
                </div>
                <div style="font-size:11px;color:var(--text-muted);">${Utils.timeAgo(d.createdAt)}</div>
            </div>
        `).join('')}
    </div>`;
}

// Show project tab
function showProjectTab(tabEl, tabName) {
    // Remove active from all tabs
    document.querySelectorAll('.project-tab').forEach(t => t.classList.remove('active'));
    tabEl.classList.add('active');

    // Hide all sections
    document.querySelectorAll('.project-detail-section').forEach(s => s.style.display = 'none');

    // Show target
    const target = document.getElementById(`pTab-${tabName}`);
    if (target) target.style.display = 'block';
}

// Close project modal
function closeProjectModal() {
    document.getElementById('projectModal').classList.remove('show');
}

// ============================================
// Helper Functions
// ============================================
function getRandomDelay(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}
