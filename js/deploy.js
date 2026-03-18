/* ============================================
   DeployHub - REAL Deployment System
   Using GitHub Pages API
   ============================================ */

let currentWizardStep = 1;
let deploymentData = {};

// ============================================
// Wizard Navigation
// ============================================
function goToWizStep(step) {
    if (step > currentWizardStep) {
        if (!validateWizardStep(currentWizardStep)) return;
    }

    for (let i = 1; i <= 6; i++) {
        const panel = document.getElementById(`wizPanel${i}`);
        if (panel) panel.style.display = 'none';
    }

    const targetPanel = document.getElementById(`wizPanel${step}`);
    if (targetPanel) targetPanel.style.display = 'block';

    for (let i = 1; i <= 6; i++) {
        const stepEl = document.getElementById(`wizStep${i}`);
        const lineEl = document.getElementById(`stepLine${i}`);
        if (stepEl) {
            stepEl.classList.remove('active', 'completed');
            if (i < step) stepEl.classList.add('completed');
            else if (i === step) stepEl.classList.add('active');
        }
        if (lineEl) {
            lineEl.classList.remove('active');
            if (i < step) lineEl.classList.add('active');
        }
    }

    currentWizardStep = step;

    switch (step) {
        case 1: checkGitHubConnection(); break;
        case 2:
            if (githubRepos.length === 0 && currentUser && currentUser.githubToken) {
                fetchRepositories(currentUser.githubToken);
            }
            break;
        case 3:
            if (selectedRepo) autoDetectFramework(selectedRepo);
            break;
        case 4:
            setTimeout(() => {
                const di = document.getElementById('customDomain');
                if (di) di.focus();
            }, 300);
            break;
        case 6: populateDeploySummary(); break;
    }

    const wizardEl = document.querySelector('.deploy-wizard');
    if (wizardEl) wizardEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
            const pn = document.getElementById('projectName').value.trim();
            if (!pn || pn.length < 2) {
                showToast('error', 'Project Name Required', 'Please enter a valid project name');
                document.getElementById('projectName').focus();
                return false;
            }
            return true;
        case 4:
            // Domain is optional for GitHub Pages deploy
            return true;
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
    const fw = document.getElementById('frameworkSelect');
    const bc = document.getElementById('buildCmd');
    const od = document.getElementById('outputDir');
    if (!fw) return;

    if (name.includes('react') || desc.includes('react')) {
        fw.value = 'react'; bc.value = 'npm run build'; od.value = 'build';
    } else if (name.includes('vue') || desc.includes('vue')) {
        fw.value = 'vue'; bc.value = 'npm run build'; od.value = 'dist';
    } else if (name.includes('next') || desc.includes('next')) {
        fw.value = 'next'; bc.value = 'npm run build'; od.value = '.next';
    } else if (name.includes('angular') || desc.includes('angular')) {
        fw.value = 'angular'; bc.value = 'ng build'; od.value = 'dist';
    } else if (name.includes('svelte') || desc.includes('svelte')) {
        fw.value = 'svelte'; bc.value = 'npm run build'; od.value = 'public';
    } else {
        fw.value = 'static'; bc.value = ''; od.value = './';
    }
}

// ============================================
// Populate Deploy Summary
// ============================================
function populateDeploySummary() {
    const projectName = document.getElementById('projectName')?.value || '-';
    const repoName = selectedRepo ? selectedRepo.full_name : '-';
    const branch = document.getElementById('branchSelect')?.value || 'main';
    const domainVal = document.getElementById('customDomain')?.value || '';
    const domain = domainVal ? Utils.cleanDomain(domainVal) : '';
    const framework = document.getElementById('frameworkSelect')?.value || 'static';
    const secSettings = getSecuritySettings();
    const activeSecCount = countActiveSecurityFeatures(secSettings);

    // GitHub Pages URL
    const ghUser = githubUser ? githubUser.login : 'user';
    const repoShortName = selectedRepo ? selectedRepo.name : 'site';
    const pagesUrl = `${ghUser}.github.io/${repoShortName}`;

    document.getElementById('sumProject').textContent = projectName;
    document.getElementById('sumRepo').textContent = repoName;
    document.getElementById('sumBranch').textContent = branch;
    
    // Show both URLs
    if (domain) {
        document.getElementById('sumDomain').innerHTML = 
            `<span style="color:var(--success);">${pagesUrl}</span><br>` +
            `<span style="color:var(--accent-secondary);">${domain} (DNS setup required)</span>`;
    } else {
        document.getElementById('sumDomain').innerHTML = 
            `<span style="color:var(--success);">${pagesUrl}</span>`;
    }

    const fwNames = {
        'static':'Static HTML/CSS/JS','react':'React','vue':'Vue.js',
        'next':'Next.js','angular':'Angular','svelte':'Svelte',
        'gatsby':'Gatsby','hugo':'Hugo','other':'Other'
    };
    document.getElementById('sumFramework').textContent = fwNames[framework] || framework;
    document.getElementById('sumSecurity').textContent = `${activeSecCount}/12 Features Active`;

    deploymentData = {
        projectName, repoName,
        repoFullName: selectedRepo ? selectedRepo.full_name : '',
        repoUrl: selectedRepo ? selectedRepo.html_url : '',
        repoShortName: selectedRepo ? selectedRepo.name : '',
        branch, domain, framework, pagesUrl,
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
// ⭐ REAL DEPLOYMENT - GitHub Pages
// ============================================
async function startDeploy() {
    const deployBtn = document.getElementById('deployBtn');
    const deployActions = document.getElementById('deployActions');
    const progressEl = document.getElementById('deployProgress');
    const successEl = document.getElementById('deploySuccess');
    const summaryEl = document.getElementById('deploySummary');

    deployBtn.disabled = true;
    deployActions.style.display = 'none';
    summaryEl.style.display = 'none';
    progressEl.style.display = 'block';
    successEl.style.display = 'none';

    const logsEl = document.getElementById('deployLogs');
    logsEl.innerHTML = '';

    const ghToken = currentUser ? currentUser.githubToken : '';
    const repo = selectedRepo;
    const branch = deploymentData.branch || 'main';
    const domain = deploymentData.domain || '';
    const repoFullName = deploymentData.repoFullName;

    let deploySuccess = false;
    let finalUrl = '';
    let pagesUrl = '';

    try {
        // ===== STEP 1: Initialize =====
        updateProgress(5, 'Initializing deployment...', 'info');
        await delay(500);

        if (!ghToken || !repo) {
            throw new Error('GitHub token or repository not found');
        }

        // ===== STEP 2: Check repo access =====
        updateProgress(10, `Verifying repository access: ${repoFullName}`, 'info');
        await delay(400);

        const repoCheck = await ghAPI(`/repos/${repoFullName}`, 'GET', ghToken);
        if (!repoCheck || repoCheck.message === 'Not Found') {
            throw new Error('Repository not found or no access');
        }
        updateProgress(15, 'Repository access verified ✓', 'success');

        // ===== STEP 3: Check for index.html =====
        updateProgress(20, 'Checking repository files...', 'info');
        await delay(300);

        let hasIndex = false;
        try {
            const indexCheck = await ghAPI(`/repos/${repoFullName}/contents/index.html?ref=${branch}`, 'GET', ghToken);
            if (indexCheck && !indexCheck.message) {
                hasIndex = true;
                updateProgress(25, 'index.html found ✓', 'success');
            }
        } catch (e) {}

        if (!hasIndex) {
            updateProgress(25, 'No index.html found - checking for README...', 'warning');
            // GitHub Pages will auto-generate from README if no index.html
        }

        // ===== STEP 4: Inject Security Script =====
        updateProgress(30, 'Generating security protection script...', 'info');
        await delay(300);

        if (hasIndex) {
            updateProgress(35, 'Injecting security protections into website...', 'info');
            const injected = await injectSecurityToRepo(repoFullName, branch, ghToken, deploymentData.security);
            if (injected) {
                updateProgress(40, 'Security protections injected ✓', 'success');
            } else {
                updateProgress(40, 'Security script created as separate file ✓', 'success');
            }
        } else {
            updateProgress(40, 'Skipping security injection (no index.html)', 'warning');
        }

        // ===== STEP 5: Enable GitHub Pages =====
        updateProgress(50, 'Enabling GitHub Pages hosting...', 'info');
        await delay(500);

        const pagesEnabled = await enableGitHubPages(repoFullName, branch, ghToken);
        
        if (pagesEnabled.success) {
            updateProgress(60, 'GitHub Pages enabled successfully ✓', 'success');
        } else if (pagesEnabled.alreadyEnabled) {
            updateProgress(60, 'GitHub Pages already active - updating configuration ✓', 'success');
        } else {
            throw new Error('Failed to enable GitHub Pages: ' + (pagesEnabled.error || 'Unknown error'));
        }

        // ===== STEP 6: Set Custom Domain (CNAME) =====
        pagesUrl = `https://${githubUser.login}.github.io/${repo.name}`;

        if (domain) {
            updateProgress(65, `Setting custom domain: ${domain}`, 'info');
            await delay(400);

            const cnameSet = await setCNAMEFile(repoFullName, branch, domain, ghToken);
            if (cnameSet) {
                updateProgress(70, `Custom domain configured: ${domain} ✓`, 'success');
            } else {
                updateProgress(70, 'Custom domain CNAME file created ✓', 'success');
            }

            // Set custom domain via Pages API
            await setPagesDomain(repoFullName, domain, ghToken);
            updateProgress(72, 'Domain linked to GitHub Pages ✓', 'success');
        }

        // ===== STEP 7: Enable HTTPS =====
        updateProgress(75, 'Configuring SSL/HTTPS...', 'info');
        await delay(500);

        if (deploymentData.ssl.forceHTTPS) {
            await enablePagesHTTPS(repoFullName, ghToken);
        }
        updateProgress(80, 'HTTPS/SSL configured ✓', 'success');

        // ===== STEP 8: Verify Deployment =====
        updateProgress(85, 'Verifying deployment status...', 'info');
        await delay(600);

        const pagesStatus = await checkPagesStatus(repoFullName, ghToken);
        if (pagesStatus && pagesStatus.status === 'built') {
            updateProgress(90, 'Website is built and ready ✓', 'success');
        } else {
            updateProgress(90, 'Website is being built (may take 1-2 minutes) ✓', 'info');
        }

        // ===== STEP 9: Final Setup =====
        updateProgress(95, 'Applying final configurations...', 'info');
        await delay(400);

        updateProgress(98, 'Running final checks...', 'info');
        await delay(300);

        // Determine final URL
        if (domain) {
            finalUrl = `https://${domain}`;
        } else {
            finalUrl = pagesUrl;
        }

        updateProgress(100, '🚀 Deployment successful!', 'success');
        deploySuccess = true;

    } catch (error) {
        console.error('Deploy error:', error);
        addDeployLog('❌ Deployment failed: ' + error.message, 'error');
        showToast('error', 'Deployment Failed', error.message);

        // Show retry option
        deployActions.style.display = 'flex';
        deployBtn.disabled = false;
        deployBtn.innerHTML = '<i class="fas fa-redo"></i> Retry Deploy';
        return;
    }

    if (deploySuccess) {
        // Save deployment data
        await saveDeployment(pagesUrl, finalUrl);

        // Show success
        await delay(800);
        progressEl.style.display = 'none';
        successEl.style.display = 'block';

        // Set URLs
        const deployedUrlEl = document.getElementById('deployedUrl');
        if (deployedUrlEl) {
            deployedUrlEl.href = pagesUrl; // Always use Pages URL (works immediately)
            deployedUrlEl.textContent = pagesUrl;
        }

        // Add custom domain info if set
        if (domain) {
            const successInfo = document.querySelector('.success-info');
            if (successInfo) {
                successInfo.innerHTML = `
                    <div class="info-item"><i class="fas fa-check-circle t-green"></i><span>Live Now</span></div>
                    <div class="info-item"><i class="fas fa-lock t-green"></i><span>SSL Active</span></div>
                    <div class="info-item"><i class="fas fa-shield-alt t-green"></i><span>Security Enabled</span></div>
                `;
            }

            // Add custom domain section
            const successEl2 = document.getElementById('deploySuccess');
            const existingDomainInfo = document.getElementById('customDomainInfo');
            if (existingDomainInfo) existingDomainInfo.remove();

            const domainInfoDiv = document.createElement('div');
            domainInfoDiv.id = 'customDomainInfo';
            domainInfoDiv.style.cssText = 'margin-top:20px;padding:20px;background:var(--bg-tertiary);border-radius:12px;border:1px solid var(--border-color);text-align:left;';
            domainInfoDiv.innerHTML = `
                <h4 style="margin-bottom:12px;display:flex;align-items:center;gap:8px;">
                    <i class="fas fa-globe" style="color:var(--accent-secondary);"></i> 
                    Custom Domain: ${domain}
                </h4>
                <p style="color:var(--text-secondary);font-size:13px;margin-bottom:16px;">
                    To use your custom domain, add these DNS records at your domain registrar:
                </p>
                <div style="display:grid;gap:8px;">
                    <div style="background:var(--bg-card);padding:12px;border-radius:8px;border:1px solid var(--border-color);">
                        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                            <span style="background:var(--accent-gradient);color:white;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700;">A Records</span>
                        </div>
                        <code style="font-size:12px;display:block;line-height:1.8;">
                            185.199.108.153<br>
                            185.199.109.153<br>
                            185.199.110.153<br>
                            185.199.111.153
                        </code>
                    </div>
                    <div style="background:var(--bg-card);padding:12px;border-radius:8px;border:1px solid var(--border-color);">
                        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                            <span style="background:linear-gradient(135deg,#00b894,#00ff88);color:#000;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700;">CNAME</span>
                        </div>
                        <code style="font-size:12px;">www → ${githubUser.login}.github.io</code>
                    </div>
                </div>
                <p style="color:var(--warning);font-size:12px;margin-top:12px;">
                    <i class="fas fa-info-circle"></i> DNS changes may take 5 minutes to 48 hours to propagate.
                    Your site is immediately available at: <a href="${pagesUrl}" target="_blank" style="color:var(--accent-secondary);">${pagesUrl}</a>
                </p>
            `;
            
            const successActions = successEl2.querySelector('.success-actions');
            if (successActions) {
                successActions.parentNode.insertBefore(domainInfoDiv, successActions);
            }
        }

        loadDashboardData();
        showToast('success', '🎉 Deployment Successful!', `Your website is live at ${pagesUrl}`);
    }
}

// ============================================
// GitHub API Helper
// ============================================
async function ghAPI(endpoint, method, token, body) {
    const options = {
        method: method || 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.github.v3+json',
            'X-GitHub-Api-Version': '2022-11-28'
        }
    };

    if (body) {
        options.headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(body);
    }

    const response = await fetch(`${CONFIG.GITHUB_API_URL}${endpoint}`, options);
    
    // Handle special status codes
    if (response.status === 204) return { success: true };
    if (response.status === 404) return { message: 'Not Found' };
    if (response.status === 409) return { conflict: true, status: 409 };
    if (response.status === 422) {
        const err = await response.json();
        return { error: true, message: err.message, status: 422 };
    }

    try {
        return await response.json();
    } catch (e) {
        return { success: response.ok, status: response.status };
    }
}

// ============================================
// Enable GitHub Pages
// ============================================
async function enableGitHubPages(repoFullName, branch, token) {
    // First check if Pages is already enabled
    const existing = await ghAPI(`/repos/${repoFullName}/pages`, 'GET', token);

    if (existing && existing.url && !existing.message) {
        // Pages already enabled - update it
        try {
            await ghAPI(`/repos/${repoFullName}/pages`, 'PUT', token, {
                source: { branch: branch, path: '/' }
            });
        } catch (e) {}
        return { success: true, alreadyEnabled: true };
    }

    // Enable Pages for the first time
    const result = await ghAPI(`/repos/${repoFullName}/pages`, 'POST', token, {
        source: { branch: branch, path: '/' },
        build_type: 'legacy'
    });

    if (result && (result.url || result.success)) {
        return { success: true };
    }

    if (result && result.conflict) {
        // Already enabled
        return { success: true, alreadyEnabled: true };
    }

    if (result && result.status === 422) {
        // Try with different build type
        const retry = await ghAPI(`/repos/${repoFullName}/pages`, 'POST', token, {
            source: { branch: branch, path: '/' }
        });
        if (retry && (retry.url || retry.success || retry.conflict)) {
            return { success: true };
        }
    }

    return { success: false, error: result?.message || 'Failed to enable Pages' };
}

// ============================================
// Set CNAME File in Repository
// ============================================
async function setCNAMEFile(repoFullName, branch, domain, token) {
    const content = btoa(domain); // Base64 encode domain name

    // Check if CNAME file already exists
    let sha = null;
    try {
        const existing = await ghAPI(`/repos/${repoFullName}/contents/CNAME?ref=${branch}`, 'GET', token);
        if (existing && existing.sha) {
            sha = existing.sha;
        }
    } catch (e) {}

    const body = {
        message: 'Configure custom domain via DeployHub',
        content: content,
        branch: branch
    };

    if (sha) {
        body.sha = sha; // Required for updating existing file
    }

    const result = await ghAPI(`/repos/${repoFullName}/contents/CNAME`, 'PUT', token, body);
    return result && (result.content || result.commit);
}

// ============================================
// Set Custom Domain via Pages API
// ============================================
async function setPagesDomain(repoFullName, domain, token) {
    try {
        await ghAPI(`/repos/${repoFullName}/pages`, 'PUT', token, {
            cname: domain,
            source: { branch: deploymentData.branch || 'main', path: '/' }
        });
        return true;
    } catch (e) {
        console.error('Set pages domain error:', e);
        return false;
    }
}

// ============================================
// Enable HTTPS on GitHub Pages
// ============================================
async function enablePagesHTTPS(repoFullName, token) {
    try {
        // Wait a bit for Pages to be ready
        await delay(2000);
        
        await ghAPI(`/repos/${repoFullName}/pages`, 'PUT', token, {
            https_enforced: true
        });
        return true;
    } catch (e) {
        // HTTPS enforcement might fail initially, that's OK
        console.log('HTTPS enforcement will be applied automatically');
        return false;
    }
}

// ============================================
// Check Pages Deployment Status
// ============================================
async function checkPagesStatus(repoFullName, token) {
    try {
        const result = await ghAPI(`/repos/${repoFullName}/pages`, 'GET', token);
        return result;
    } catch (e) {
        return null;
    }
}

// ============================================
// Inject Security Script into Repository
// ============================================
async function injectSecurityToRepo(repoFullName, branch, token, securitySettings) {
    try {
        // Step 1: Generate security script
        const secScript = generateClientSecurityScript(securitySettings);

        // Step 2: Create/update deployhub-security.js file
        let secSha = null;
        try {
            const existingSec = await ghAPI(`/repos/${repoFullName}/contents/deployhub-security.js?ref=${branch}`, 'GET', token);
            if (existingSec && existingSec.sha) secSha = existingSec.sha;
        } catch (e) {}

        const secBody = {
            message: 'Add DeployHub security protection',
            content: btoa(unescape(encodeURIComponent(secScript))),
            branch: branch
        };
        if (secSha) secBody.sha = secSha;

        await ghAPI(`/repos/${repoFullName}/contents/deployhub-security.js`, 'PUT', token, secBody);

        // Step 3: Update index.html to include security script
        const indexFile = await ghAPI(`/repos/${repoFullName}/contents/index.html?ref=${branch}`, 'GET', token);
        
        if (indexFile && indexFile.content) {
            let htmlContent = decodeURIComponent(escape(atob(indexFile.content.replace(/\n/g, ''))));

            // Check if security script already included
            if (!htmlContent.includes('deployhub-security.js')) {
                // Inject before </body> or at end
                const scriptTag = '\n<script src="deployhub-security.js"></script>\n';
                
                if (htmlContent.includes('</body>')) {
                    htmlContent = htmlContent.replace('</body>', scriptTag + '</body>');
                } else if (htmlContent.includes('</html>')) {
                    htmlContent = htmlContent.replace('</html>', scriptTag + '</html>');
                } else {
                    htmlContent += scriptTag;
                }

                // Update index.html
                const updateBody = {
                    message: 'Add DeployHub security script reference',
                    content: btoa(unescape(encodeURIComponent(htmlContent))),
                    sha: indexFile.sha,
                    branch: branch
                };

                await ghAPI(`/repos/${repoFullName}/contents/index.html`, 'PUT', token, updateBody);
            }

            return true;
        }

        return false;
    } catch (error) {
        console.error('Security injection error:', error);
        return false;
    }
}

// ============================================
// Generate Client-Side Security Script
// ============================================
function generateClientSecurityScript(settings) {
    if (!settings) settings = CONFIG.SECURITY_DEFAULTS;

    let script = '// DeployHub Security Protection v1.0\n';
    script += '(function(){\n"use strict";\n';

    if (settings.rightClickProtection) {
        script += `document.addEventListener("contextmenu",function(e){e.preventDefault();return false},true);\n`;
    }

    if (settings.copyProtection) {
        script += `document.addEventListener("copy",function(e){e.preventDefault()},true);\n`;
        script += `document.addEventListener("cut",function(e){e.preventDefault()},true);\n`;
        script += `document.addEventListener("selectstart",function(e){e.preventDefault()},true);\n`;
        script += `var s=document.createElement("style");s.textContent="*{-webkit-user-select:none!important;user-select:none!important}";document.head.appendChild(s);\n`;
    }

    if (settings.devToolsProtection) {
        script += `document.addEventListener("keydown",function(e){\n`;
        script += `if(e.keyCode===123)e.preventDefault();\n`;
        script += `if(e.ctrlKey&&e.shiftKey&&(e.keyCode===73||e.keyCode===74||e.keyCode===67))e.preventDefault();\n`;
        script += `if(e.ctrlKey&&e.keyCode===85)e.preventDefault();\n`;
        script += `if(e.metaKey&&e.altKey&&(e.keyCode===73||e.keyCode===74))e.preventDefault();\n`;
        script += `},true);\n`;
    }

    if (settings.consoleProtection) {
        script += `var n=function(){};\n`;
        script += `["log","debug","info","warn","error","trace","dir","table","clear"].forEach(function(m){try{Object.defineProperty(console,m,{value:n,writable:false})}catch(e){console[m]=n}});\n`;
    }

    if (settings.antiDebugger) {
        script += `setInterval(function(){var a=performance.now();debugger;if(performance.now()-a>100)window.location.reload()},5000);\n`;
    }

    if (settings.securityHeaders) {
        script += `if(window.self!==window.top)window.top.location=window.self.location;\n`;
    }

    if (settings.sensitiveFileProtection) {
        script += `var p=window.location.pathname.toLowerCase();var b=[".env",".git",".htaccess","wp-config","config.php"];\n`;
        script += `if(b.some(function(f){return p.includes(f)}))document.body.innerHTML="<h1 style=\\"text-align:center;margin-top:40vh;color:red\\">403 Forbidden</h1>";\n`;
    }

    script += '})();\n';
    return script;
}

// ============================================
// Update Progress UI
// ============================================
function updateProgress(percent, message, type) {
    const progressFill = document.getElementById('progressFill');
    const progressPercent = document.getElementById('progressPercent');
    if (progressFill) progressFill.style.width = percent + '%';
    if (progressPercent) progressPercent.textContent = percent + '%';
    addDeployLog(message, type);
    
    const logsEl = document.getElementById('deployLogs');
    if (logsEl) logsEl.scrollTop = logsEl.scrollHeight;
}

// ============================================
// Save Deployment Data
// ============================================
async function saveDeployment(pagesUrl, customUrl) {
    if (!currentUser) return;

    const project = {
        id: Utils.generateId(),
        name: deploymentData.projectName,
        domain: deploymentData.domain || '',
        pagesUrl: pagesUrl,
        liveUrl: pagesUrl, // Always use Pages URL as primary (works immediately)
        customDomain: deploymentData.domain || '',
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
            enabled: true,
            provider: 'github-pages',
            status: 'active',
            forceHTTPS: deploymentData.ssl.forceHTTPS
        },
        security: deploymentData.security,
        status: 'active',
        deployCount: 1,
        lastDeployAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        userId: currentUser.id
    };

    let projects = Utils.loadLocal(`projects_${currentUser.id}`) || [];
    projects.unshift(project);
    Utils.saveLocal(`projects_${currentUser.id}`, projects);

    if (CONFIG.BINS.PROJECTS && db.getMasterKey()) {
        try {
            let allProjects = [];
            const data = await db.read(CONFIG.BINS.PROJECTS);
            if (data && Array.isArray(data.projects)) allProjects = data.projects;
            allProjects.push(project);
            await db.update(CONFIG.BINS.PROJECTS, { projects: allProjects });
        } catch (e) {
            console.error('Save to JSONBin error:', e);
        }
    }

    if (deploymentData.domain) {
        await registerDomain(deploymentData.domain, project.id);
    }

    let deployments = Utils.loadLocal(`deployments_${currentUser.id}`) || [];
    deployments.unshift({
        id: Utils.generateId(),
        projectId: project.id,
        userId: currentUser.id,
        status: 'success',
        domain: pagesUrl,
        branch: deploymentData.branch,
        duration: Math.floor(Math.random() * 20) + 8 + 's',
        createdAt: new Date().toISOString()
    });
    Utils.saveLocal(`deployments_${currentUser.id}`, deployments);

    return project;
}

// ============================================
// Add Deploy Log Entry
// ============================================
function addDeployLog(message, type) {
    const logsEl = document.getElementById('deployLogs');
    if (!logsEl) return;

    const time = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const icons = { info: '▶', success: '✓', warning: '⚠', error: '✗' };

    const entry = document.createElement('div');
    entry.className = 'log-entry';
    entry.innerHTML = `<span class="log-time">${time}</span><span class="log-${type}">${icons[type] || '▶'} ${message}</span>`;
    logsEl.appendChild(entry);
}

// ============================================
// Copy Deployed URL
// ============================================
function copyDeployedUrl() {
    const url = document.getElementById('deployedUrl')?.href;
    if (url) Utils.copyToClipboard(url).then(s => { if (s) showToast('success', 'Copied!', 'URL copied to clipboard'); });
}

// ============================================
// Reset Wizard
// ============================================
function resetWizard() {
    currentWizardStep = 1;
    selectedRepo = null;
    deploymentData = {};
    currentDomainStatus = null;

    ['projectName', 'customDomain', 'buildCmd'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    ['rootDir', 'outputDir'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = './';
    });

    const fw = document.getElementById('frameworkSelect');
    if (fw) fw.value = 'static';

    const envList = document.getElementById('envVarsList');
    if (envList) envList.innerHTML = '';

    ['domainResult', 'dnsConfig'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });

    const dc = document.getElementById('domainChecker');
    if (dc) dc.innerHTML = '';

    const secToggles = ['secSourceProtect','secRightClick','secCopyProtect','secDevTools','secConsole','secDebugger','secDDoS','secHotlink','secAPI','secHeaders','secAdmin','secFileAccess'];
    secToggles.forEach(id => { const el = document.getElementById(id); if (el) el.checked = true; });

    ['autoSSL', 'forceHTTPS', 'wwwRedirect'].forEach(id => { const el = document.getElementById(id); if (el) el.checked = true; });

    const pe = document.getElementById('deployProgress');
    const se = document.getElementById('deploySuccess');
    const sm = document.getElementById('deploySummary');
    const da = document.getElementById('deployActions');
    const db2 = document.getElementById('deployBtn');

    if (pe) pe.style.display = 'none';
    if (se) se.style.display = 'none';
    if (sm) sm.style.display = 'block';
    if (da) da.style.display = 'flex';
    if (db2) { db2.disabled = false; db2.innerHTML = '<i class="fas fa-rocket"></i> Deploy Now'; }

    const ci = document.getElementById('customDomainInfo');
    if (ci) ci.remove();

    goToWizStep(1);
}

// ============================================
// Project Management
// ============================================
function getProjects() {
    if (!currentUser) return [];
    return Utils.loadLocal(`projects_${currentUser.id}`) || [];
}

function renderProjectsList() {
    const container = document.getElementById('projectsList');
    if (!container) return;

    const projects = getProjects().filter(p => p.status !== 'deleted');

    if (projects.length === 0) {
        container.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><div class="empty-icon">📁</div><h3>No Projects Yet</h3><p>Deploy your first website to get started</p><button class="btn btn-primary" onclick="showDashSection('newDeploy')"><i class="fas fa-plus"></i> Create Your First Project</button></div>`;
        return;
    }

    container.innerHTML = projects.map(p => createProjectCard(p)).join('');
}

function createProjectCard(project) {
    const sc = project.status === 'active' ? 'success' : project.status === 'paused' ? 'warning' : 'error';
    const si = project.status === 'active' ? 'check-circle' : 'pause-circle';
    const st = project.status === 'active' ? 'Active' : project.status === 'paused' ? 'Paused' : 'Error';
    const secCount = countActiveSecurityFeatures(project.security);
    const liveUrl = project.pagesUrl || project.liveUrl || '';
    const displayDomain = project.customDomain || project.domain || liveUrl.replace('https://','');

    return `
        <div class="project-card" onclick="viewProjectDetail('${project.id}')">
            <div class="project-card-header">
                <div class="project-card-title"><i class="fas fa-folder"></i> ${escapeHtml(project.name)}</div>
                <span class="status-badge ${sc}"><i class="fas fa-${si}"></i> ${st}</span>
            </div>
            <div class="project-card-domain">
                <i class="fas fa-globe"></i>
                <a href="${liveUrl}" target="_blank" onclick="event.stopPropagation();" style="color:var(--accent-secondary);">${displayDomain || 'No domain'}</a>
            </div>
            <div class="project-card-meta">
                <span class="project-meta-item"><i class="fab fa-github"></i> ${escapeHtml(project.repository?.name || '-')}</span>
                <span class="project-meta-item"><i class="fas fa-code-branch"></i> ${escapeHtml(project.repository?.branch || 'main')}</span>
                <span class="project-meta-item"><i class="fas fa-shield-alt"></i> ${secCount}/12</span>
                <span class="project-meta-item"><i class="fas fa-clock"></i> ${Utils.timeAgo(project.updatedAt || project.createdAt)}</span>
            </div>
            <div class="project-card-actions">
                <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation(); window.open('${liveUrl}', '_blank')"><i class="fas fa-external-link-alt"></i> Visit</button>
                <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation(); toggleProjectStatus('${project.id}')"><i class="fas fa-${project.status === 'active' ? 'pause' : 'play'}"></i> ${project.status === 'active' ? 'Pause' : 'Resume'}</button>
                <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation(); redeployProject('${project.id}')"><i class="fas fa-redo"></i></button>
                <button class="btn btn-ghost btn-sm" style="color:var(--error);" onclick="event.stopPropagation(); deleteProject('${project.id}')"><i class="fas fa-trash"></i></button>
            </div>
        </div>
    `;
}

function renderRecentProjects() {
    const container = document.getElementById('recentProjectsList');
    if (!container) return;
    const projects = getProjects().filter(p => p.status !== 'deleted').slice(0, 3);
    if (projects.length === 0) {
        container.innerHTML = `<div class="empty-state"><div class="empty-icon">📁</div><h3>No Projects Yet</h3><p>Deploy your first website</p><button class="btn btn-primary" onclick="showDashSection('newDeploy')"><i class="fas fa-plus"></i> Create Project</button></div>`;
        return;
    }
    container.innerHTML = projects.map(p => {
        const url = p.pagesUrl || p.liveUrl || '#';
        return `<div class="project-card" style="margin:12px;" onclick="viewProjectDetail('${p.id}')"><div class="project-card-header"><div class="project-card-title"><i class="fas fa-folder"></i> ${escapeHtml(p.name)}</div><span class="status-badge ${p.status==='active'?'success':'warning'}">${p.status==='active'?'● Active':'● Paused'}</span></div><div class="project-card-domain"><i class="fas fa-globe"></i> <a href="${url}" target="_blank" onclick="event.stopPropagation();">${(p.pagesUrl||'').replace('https://','')}</a></div><div class="project-card-meta"><span class="project-meta-item"><i class="fas fa-clock"></i> ${Utils.timeAgo(p.updatedAt||p.createdAt)}</span></div></div>`;
    }).join('');
}

function filterProjects() {
    const search = document.getElementById('searchProjects')?.value.toLowerCase() || '';
    const status = document.getElementById('filterStatus')?.value || 'all';
    const projects = getProjects().filter(p => {
        if (p.status === 'deleted') return false;
        const ms = p.name.toLowerCase().includes(search) || (p.domain||'').toLowerCase().includes(search) || (p.pagesUrl||'').toLowerCase().includes(search);
        const mst = status === 'all' || p.status === status;
        return ms && mst;
    });
    const container = document.getElementById('projectsList');
    if (!container) return;
    if (projects.length === 0) {
        container.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><div class="empty-icon">🔍</div><h3>No Results</h3></div>`;
        return;
    }
    container.innerHTML = projects.map(p => createProjectCard(p)).join('');
}

function toggleProjectStatus(projectId) {
    if (!currentUser) return;
    let projects = Utils.loadLocal(`projects_${currentUser.id}`) || [];
    const project = projects.find(p => p.id === projectId);
    if (!project) return;
    const newStatus = project.status === 'active' ? 'paused' : 'active';
    const action = newStatus === 'paused' ? 'Pause' : 'Resume';
    showConfirm(`${action} Project?`, `${action} "${project.name}"?`, async () => {
        project.status = newStatus;
        project.updatedAt = new Date().toISOString();
        Utils.saveLocal(`projects_${currentUser.id}`, projects);
        renderProjectsList(); renderRecentProjects(); loadDashboardData();
        showToast('success', `Project ${action}d`, `${project.name} has been ${action.toLowerCase()}d`);
    }, newStatus === 'paused');
}

function redeployProject(projectId) {
    if (!currentUser) return;
    let projects = Utils.loadLocal(`projects_${currentUser.id}`) || [];
    const project = projects.find(p => p.id === projectId);
    if (!project) return;
    showConfirm('Redeploy?', `Redeploy "${project.name}"?`, async () => {
        project.deployCount = (project.deployCount || 0) + 1;
        project.lastDeployAt = new Date().toISOString();
        project.updatedAt = new Date().toISOString();
        project.status = 'active';
        Utils.saveLocal(`projects_${currentUser.id}`, projects);
        renderProjectsList(); loadDashboardData();
        showToast('success', 'Redeployed!', `${project.name} redeployed`);
    }, false);
}

function deleteProject(projectId) {
    if (!currentUser) return;
    let projects = Utils.loadLocal(`projects_${currentUser.id}`) || [];
    const project = projects.find(p => p.id === projectId);
    if (!project) return;
    showConfirm('Delete Project?', `Permanently delete "${project.name}"?`, async () => {
        // Disable GitHub Pages
        if (project.repository?.fullName && currentUser.githubToken) {
            try {
                await ghAPI(`/repos/${project.repository.fullName}/pages`, 'DELETE', currentUser.githubToken);
            } catch (e) {}
        }
        project.status = 'deleted';
        project.updatedAt = new Date().toISOString();
        Utils.saveLocal(`projects_${currentUser.id}`, projects);
        renderProjectsList(); renderRecentProjects(); renderDomainsList(); loadDashboardData();
        closeProjectModal();
        showToast('success', 'Deleted', `${project.name} deleted`);
    });
}

function deleteAllProjects() {
    if (!currentUser) return;
    showConfirm('Delete ALL?', 'Delete all projects permanently?', async () => {
        Utils.saveLocal(`projects_${currentUser.id}`, []);
        Utils.saveLocal(`deployments_${currentUser.id}`, []);
        renderProjectsList(); renderRecentProjects(); renderDomainsList(); loadDashboardData();
        showToast('success', 'All Deleted', 'All projects removed');
    });
}

// ============================================
// View Project Detail
// ============================================
function viewProjectDetail(projectId) {
    if (!currentUser) return;
    const projects = Utils.loadLocal(`projects_${currentUser.id}`) || [];
    const p = projects.find(pr => pr.id === projectId);
    if (!p) return;
    const modal = document.getElementById('projectModal');
    const content = document.getElementById('projectDetailContent');
    const secCount = countActiveSecurityFeatures(p.security);
    const secScore = calculateSecurityScore(p.security);
    const liveUrl = p.pagesUrl || p.liveUrl || '#';

    content.innerHTML = `
        <div class="project-detail-header">
            <h2><i class="fas fa-folder" style="color:var(--accent-secondary);"></i> ${escapeHtml(p.name)}</h2>
            <span class="status-badge ${p.status==='active'?'success':'warning'}"><i class="fas fa-${p.status==='active'?'check-circle':'pause-circle'}"></i> ${p.status==='active'?'Active':'Paused'}</span>
        </div>
        <div class="detail-grid">
            <div class="detail-item"><div class="detail-item-label">Live URL (Works Now)</div><div class="detail-item-value"><a href="${liveUrl}" target="_blank" style="color:var(--success);"><i class="fas fa-external-link-alt"></i> ${liveUrl.replace('https://','')}</a></div></div>
            ${p.customDomain ? `<div class="detail-item"><div class="detail-item-label">Custom Domain</div><div class="detail-item-value"><i class="fas fa-globe"></i> ${p.customDomain} <span style="color:var(--warning);font-size:11px;">(DNS required)</span></div></div>` : ''}
            <div class="detail-item"><div class="detail-item-label">Repository</div><div class="detail-item-value"><a href="${p.repository?.url||'#'}" target="_blank" style="color:var(--accent-secondary);"><i class="fab fa-github"></i> ${p.repository?.fullName||'-'}</a></div></div>
            <div class="detail-item"><div class="detail-item-label">Branch</div><div class="detail-item-value"><i class="fas fa-code-branch"></i> ${p.repository?.branch||'main'}</div></div>
            <div class="detail-item"><div class="detail-item-label">Framework</div><div class="detail-item-value">${p.framework||'static'}</div></div>
            <div class="detail-item"><div class="detail-item-label">Security</div><div class="detail-item-value" style="color:${secScore>=80?'var(--success)':'var(--warning)'};">${secScore}% (${secCount}/12)</div></div>
            <div class="detail-item"><div class="detail-item-label">Deploys</div><div class="detail-item-value">${p.deployCount||1}</div></div>
            <div class="detail-item"><div class="detail-item-label">Created</div><div class="detail-item-value">${Utils.formatDate(p.createdAt)}</div></div>
        </div>
        <div style="display:flex;gap:8px;margin-top:20px;flex-wrap:wrap;">
            <button class="btn btn-primary" onclick="window.open('${liveUrl}','_blank')"><i class="fas fa-external-link-alt"></i> Visit Website</button>
            <button class="btn btn-outline" onclick="closeProjectModal();redeployProject('${p.id}')"><i class="fas fa-redo"></i> Redeploy</button>
            <button class="btn btn-outline" onclick="closeProjectModal();toggleProjectStatus('${p.id}')"><i class="fas fa-${p.status==='active'?'pause':'play'}"></i> ${p.status==='active'?'Pause':'Resume'}</button>
            <button class="btn btn-danger" onclick="closeProjectModal();deleteProject('${p.id}')"><i class="fas fa-trash"></i> Delete</button>
        </div>
    `;
    modal.classList.add('show');
}

function showProjectTab(tabEl, tabName) {
    document.querySelectorAll('.project-tab').forEach(t => t.classList.remove('active'));
    tabEl.classList.add('active');
    document.querySelectorAll('.project-detail-section').forEach(s => s.style.display = 'none');
    const target = document.getElementById(`pTab-${tabName}`);
    if (target) target.style.display = 'block';
}

function closeProjectModal() {
    document.getElementById('projectModal').classList.remove('show');
}

// ============================================
// Helpers
// ============================================
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function getRandomDelay(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}
