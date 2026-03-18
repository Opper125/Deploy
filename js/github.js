/* ============================================
   DeployHub - GitHub Integration
   ============================================ */

let githubConnected = false;
let githubUser = null;
let githubRepos = [];
let selectedRepo = null;
let allBranches = [];

// ============================================
// Connect GitHub with Token
// ============================================
async function connectGitHub() {
    const tokenInput = document.getElementById('githubToken');
    const token = tokenInput.value.trim();
    const btn = document.getElementById('connectGHBtn');

    if (!token) {
        showToast('error', 'Token Required', 'Please enter your GitHub Personal Access Token');
        return;
    }

    if (!token.startsWith('ghp_') && !token.startsWith('github_pat_')) {
        showToast('warning', 'Invalid Token Format', 'Token should start with ghp_ or github_pat_');
    }

    btn.disabled = true;
    btn.innerHTML = '<div class="spinner" style="width:20px;height:20px;border-width:2px;margin:0;display:inline-block;"></div> Connecting...';

    try {
        // Verify token by fetching user info
        const response = await fetch(`${CONFIG.GITHUB_API_URL}/user`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        if (!response.ok) {
            throw new Error(`GitHub API error: ${response.status}`);
        }

        const user = await response.json();
        githubUser = user;
        githubConnected = true;

        // Save token to current user
        if (currentUser) {
            currentUser.githubToken = token;
            currentUser.githubUsername = user.login;
            await saveUserData();
        }

        // Update UI
        document.getElementById('githubNotConnected').style.display = 'none';
        document.getElementById('githubConnected').style.display = 'block';
        document.getElementById('ghAvatar').src = user.avatar_url;
        document.getElementById('ghDisplayName').textContent = user.name || user.login;
        document.getElementById('ghUsername').textContent = '@' + user.login;
        document.getElementById('ghRepoCount').textContent = user.public_repos;
        document.getElementById('ghFollowers').textContent = user.followers;

        showToast('success', 'GitHub Connected!', `Welcome, ${user.login}`);

        // Prefetch repos
        await fetchRepositories(token);

    } catch (error) {
        console.error('GitHub connect error:', error);
        showToast('error', 'Connection Failed', 'Invalid token or network error. Please check your token.');
    }

    btn.disabled = false;
    btn.innerHTML = '<i class="fab fa-github"></i> Connect GitHub';
}

// ============================================
// Disconnect GitHub
// ============================================
function disconnectGitHub() {
    githubConnected = false;
    githubUser = null;
    githubRepos = [];
    selectedRepo = null;

    document.getElementById('githubNotConnected').style.display = 'block';
    document.getElementById('githubConnected').style.display = 'none';
    document.getElementById('githubToken').value = '';

    showToast('info', 'GitHub Disconnected', 'You can reconnect anytime');
}

// ============================================
// Fetch Repositories
// ============================================
async function fetchRepositories(token) {
    const ghToken = token || (currentUser ? currentUser.githubToken : '');
    if (!ghToken) return;

    try {
        let allRepos = [];
        let page = 1;
        let hasMore = true;

        // Fetch all repos (paginated)
        while (hasMore && page <= 10) {
            const response = await fetch(
                `${CONFIG.GITHUB_API_URL}/user/repos?per_page=100&page=${page}&sort=updated&direction=desc`,
                {
                    headers: {
                        'Authorization': `Bearer ${ghToken}`,
                        'Accept': 'application/vnd.github.v3+json'
                    }
                }
            );

            if (!response.ok) break;

            const repos = await response.json();
            if (repos.length === 0) {
                hasMore = false;
            } else {
                allRepos = allRepos.concat(repos);
                page++;
                if (repos.length < 100) hasMore = false;
            }
        }

        githubRepos = allRepos;
        renderReposList(allRepos);

    } catch (error) {
        console.error('Fetch repos error:', error);
        document.getElementById('reposList').innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">❌</div>
                <h3>Failed to Load Repositories</h3>
                <p>Please check your GitHub token and try again</p>
                <button class="btn btn-primary" onclick="goToWizStep(1)">
                    <i class="fas fa-redo"></i> Reconnect
                </button>
            </div>
        `;
    }
}

// ============================================
// Render Repository List
// ============================================
function renderReposList(repos) {
    const container = document.getElementById('reposList');

    if (!repos || repos.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📂</div>
                <h3>No Repositories Found</h3>
                <p>Create a repository on GitHub first</p>
            </div>
        `;
        return;
    }

    container.innerHTML = repos.map(repo => `
        <div class="repo-item ${selectedRepo && selectedRepo.id === repo.id ? 'selected' : ''}" 
             onclick="selectRepo(${repo.id})" data-id="${repo.id}">
            <div class="repo-icon">
                <i class="fas ${repo.private ? 'fa-lock' : 'fa-book'}"></i>
            </div>
            <div class="repo-info">
                <div class="repo-name">${escapeHtml(repo.name)}</div>
                <div class="repo-desc">${escapeHtml(repo.description || 'No description')}</div>
                <div class="repo-meta">
                    ${repo.language ? `<span><i class="fas fa-circle" style="font-size:8px;color:${getLanguageColor(repo.language)}"></i> ${repo.language}</span>` : ''}
                    <span><i class="fas fa-star"></i> ${repo.stargazers_count}</span>
                    <span><i class="fas fa-code-branch"></i> ${repo.default_branch}</span>
                    <span><i class="fas fa-clock"></i> ${Utils.timeAgo(repo.updated_at)}</span>
                    <span class="status-badge ${repo.private ? 'warning' : 'info'}" style="padding:2px 6px;">
                        ${repo.private ? 'Private' : 'Public'}
                    </span>
                </div>
            </div>
            <div class="repo-action">
                <button class="btn btn-primary btn-sm" onclick="event.stopPropagation(); selectRepo(${repo.id})">
                    <i class="fas fa-check"></i> Select
                </button>
            </div>
        </div>
    `).join('');
}

// ============================================
// Filter Repositories
// ============================================
function filterRepos() {
    const search = document.getElementById('searchRepos').value.toLowerCase();
    const typeFilter = document.getElementById('repoTypeFilter').value;

    let filtered = githubRepos.filter(repo => {
        const matchesSearch = repo.name.toLowerCase().includes(search) ||
            (repo.description || '').toLowerCase().includes(search);
        const matchesType = typeFilter === 'all' ||
            (typeFilter === 'public' && !repo.private) ||
            (typeFilter === 'private' && repo.private);
        return matchesSearch && matchesType;
    });

    renderReposList(filtered);
}

// ============================================
// Select Repository
// ============================================
async function selectRepo(repoId) {
    const repo = githubRepos.find(r => r.id === repoId);
    if (!repo) return;

    selectedRepo = repo;

    // Update UI - highlight selected
    document.querySelectorAll('.repo-item').forEach(el => {
        el.classList.remove('selected');
    });
    const selectedEl = document.querySelector(`.repo-item[data-id="${repoId}"]`);
    if (selectedEl) selectedEl.classList.add('selected');

    // Auto-fill project name
    const projectNameInput = document.getElementById('projectName');
    if (projectNameInput && !projectNameInput.value) {
        projectNameInput.value = repo.name;
    }

    // Fetch branches
    await fetchBranches(repo);

    showToast('success', 'Repository Selected', repo.name);

    // Move to step 3
    setTimeout(() => goToWizStep(3), 500);
}

// ============================================
// Fetch Branches
// ============================================
async function fetchBranches(repo) {
    const ghToken = currentUser ? currentUser.githubToken : '';
    if (!ghToken || !repo) return;

    try {
        const response = await fetch(
            `${CONFIG.GITHUB_API_URL}/repos/${repo.full_name}/branches`,
            {
                headers: {
                    'Authorization': `Bearer ${ghToken}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            }
        );

        if (!response.ok) return;

        const branches = await response.json();
        allBranches = branches;

        // Update branch select
        const branchSelect = document.getElementById('branchSelect');
        if (branchSelect) {
            branchSelect.innerHTML = branches.map(b =>
                `<option value="${b.name}" ${b.name === repo.default_branch ? 'selected' : ''}>${b.name}</option>`
            ).join('');
        }

    } catch (error) {
        console.error('Fetch branches error:', error);
    }
}

// ============================================
// Fetch Repository Files (for deployment)
// ============================================
async function fetchRepoFiles(repo, branch) {
    const ghToken = currentUser ? currentUser.githubToken : '';
    if (!ghToken || !repo) return null;

    try {
        // Get the tree recursively
        const response = await fetch(
            `${CONFIG.GITHUB_API_URL}/repos/${repo.full_name}/git/trees/${branch}?recursive=1`,
            {
                headers: {
                    'Authorization': `Bearer ${ghToken}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            }
        );

        if (!response.ok) throw new Error('Failed to fetch file tree');

        const data = await response.json();
        return data.tree.filter(item => item.type === 'blob');

    } catch (error) {
        console.error('Fetch files error:', error);
        return null;
    }
}

// ============================================
// Fetch File Content
// ============================================
async function fetchFileContent(repo, path, branch) {
    const ghToken = currentUser ? currentUser.githubToken : '';
    if (!ghToken || !repo) return null;

    try {
        const response = await fetch(
            `${CONFIG.GITHUB_API_URL}/repos/${repo.full_name}/contents/${path}?ref=${branch}`,
            {
                headers: {
                    'Authorization': `Bearer ${ghToken}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            }
        );

        if (!response.ok) throw new Error('Failed to fetch file');

        const data = await response.json();
        
        // Decode base64 content
        if (data.content) {
            return {
                content: atob(data.content.replace(/\n/g, '')),
                sha: data.sha,
                size: data.size,
                encoding: data.encoding
            };
        }

        return data;

    } catch (error) {
        console.error('Fetch file content error:', error);
        return null;
    }
}

// ============================================
// Environment Variables UI
// ============================================
function addEnvVar() {
    const list = document.getElementById('envVarsList');
    const row = document.createElement('div');
    row.className = 'env-var-row';
    row.innerHTML = `
        <input type="text" placeholder="VARIABLE_NAME" class="env-key">
        <input type="text" placeholder="value" class="env-value">
        <button onclick="this.parentElement.remove()" title="Remove">
            <i class="fas fa-trash-alt"></i>
        </button>
    `;
    list.appendChild(row);
}

function getEnvVars() {
    const vars = {};
    document.querySelectorAll('.env-var-row').forEach(row => {
        const key = row.querySelector('.env-key').value.trim();
        const value = row.querySelector('.env-value').value.trim();
        if (key) vars[key] = value;
    });
    return vars;
}

// ============================================
// Helper: Get Language Color
// ============================================
function getLanguageColor(lang) {
    const colors = {
        'JavaScript': '#f1e05a',
        'TypeScript': '#3178c6',
        'Python': '#3572A5',
        'HTML': '#e34c26',
        'CSS': '#563d7c',
        'Java': '#b07219',
        'PHP': '#4F5D95',
        'Ruby': '#701516',
        'Go': '#00ADD8',
        'Rust': '#dea584',
        'C++': '#f34b7d',
        'C': '#555555',
        'C#': '#178600',
        'Swift': '#F05138',
        'Kotlin': '#A97BFF',
        'Vue': '#41b883',
        'Svelte': '#ff3e00',
        'Dart': '#00B4AB',
        'Shell': '#89e051',
        'SCSS': '#c6538c'
    };
    return colors[lang] || '#8b8b8b';
}

// ============================================
// Helper: Escape HTML
// ============================================
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================
// Check if GitHub is already connected
// ============================================
function checkGitHubConnection() {
    if (currentUser && currentUser.githubToken) {
        // Auto-connect on wizard open
        document.getElementById('githubToken').value = currentUser.githubToken;
    }
}
