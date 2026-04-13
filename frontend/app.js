// ═══════════════════════════════════════════════════════════════════════════
// StudyPulse - Frontend Application
// ═══════════════════════════════════════════════════════════════════════════

const API_URL = window.SCHOLAR_API_URL || 'http://localhost:8000';

// ─── State ───────────────────────────────────────────────────────────────────
let currentUser = null;
let allUnits = [];
let currentCategoryFilter = '';
let currentStatusFilter = '';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getToken() {
    return localStorage.getItem('scholar_token');
}

function setToken(token) {
    localStorage.setItem('scholar_token', token);
}

function clearToken() {
    localStorage.removeItem('scholar_token');
    localStorage.removeItem('scholar_user');
}

function getUser() {
    const u = localStorage.getItem('scholar_user');
    return u ? JSON.parse(u) : null;
}

function setUser(user) {
    localStorage.setItem('scholar_user', JSON.stringify(user));
    currentUser = user;
}

async function apiFetch(path, options = {}) {
    const token = getToken();
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${API_URL}${path}`, { ...options, headers });
    if (res.status === 401) {
        clearToken();
        showPage('login');
        throw new Error('Unauthorized');
    }
    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Request failed' }));
        throw new Error(err.detail || 'Request failed');
    }
    return res.json();
}

function timeAgo(dateStr) {
    if (!dateStr) return 'Never';
    const date = new Date(dateStr + 'Z');
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hours ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return '1 day ago';
    return `${diffDays} days ago`;
}

function getCategoryIcon(cat) {
    const icons = { DSA: 'data_object', Web: 'html', Java: 'coffee', default: 'school' };
    return icons[cat] || icons.default;
}

function getCategoryColor(cat) {
    const colors = { DSA: 'bg-blue-50 text-primary', Web: 'bg-emerald-50 text-secondary', Java: 'bg-amber-50 text-on-tertiary-container' };
    return colors[cat] || 'bg-slate-50 text-primary';
}

function getStatusBadge(status) {
    if (status === 'Done') return '<span class="px-3 py-1 rounded-lg bg-secondary-fixed text-on-secondary-fixed-variant text-xs font-bold">Done</span>';
    if (status === 'Need Revision') return '<span class="px-3 py-1 rounded-lg bg-error-container text-on-error-container text-xs font-bold">Need Revision</span>';
    return '<span class="px-3 py-1 rounded-lg bg-tertiary-fixed text-on-tertiary-fixed-variant text-xs font-bold">In Progress</span>';
}

function getProgressBarColor(status) {
    if (status === 'Done') return 'bg-gradient-to-r from-secondary to-secondary-container';
    if (status === 'Need Revision') return 'bg-error';
    return 'bg-gradient-to-r from-primary to-primary-fixed-dim';
}

// ─── Page Navigation ─────────────────────────────────────────────────────────

function showPage(page) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const el = document.getElementById(`page-${page}`) || document.getElementById('app-shell');
    if (el) el.classList.add('active');
}

function showAppPage(page) {
    document.querySelectorAll('.app-page').forEach(p => p.classList.add('hidden'));
    const el = document.getElementById(`app-${page}`);
    if (el) el.classList.remove('hidden');

    // Update nav highlights
    document.querySelectorAll('.nav-link').forEach(a => {
        a.classList.remove('text-blue-700', 'font-semibold');
        a.classList.add('text-slate-500', 'hover:bg-slate-100');
        if (a.dataset.page === page) {
            a.classList.add('text-blue-700', 'font-semibold');
            a.classList.remove('text-slate-500');
        }
    });
    document.querySelectorAll('.side-link').forEach(a => {
        a.classList.remove('bg-white', 'text-blue-700', 'shadow-sm', 'font-bold');
        a.classList.add('text-slate-600', 'font-medium', 'hover:bg-slate-200/50');
        if (a.dataset.page === page) {
            a.classList.add('bg-white', 'text-blue-700', 'shadow-sm', 'font-bold');
            a.classList.remove('text-slate-600', 'font-medium', 'hover:bg-slate-200/50');
        }
    });
    document.querySelectorAll('.mob-link').forEach(a => {
        a.classList.remove('text-blue-700');
        a.classList.add('text-slate-400');
        if (a.dataset.page === page) {
            a.classList.add('text-blue-700');
            a.classList.remove('text-slate-400');
        }
    });

    // Load data
    if (page === 'dashboard') loadDashboard();
    if (page === 'library') loadLibrary();
    if (page === 'analytics') loadAnalytics();
}

// ─── Auth ────────────────────────────────────────────────────────────────────

document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errEl = document.getElementById('login-error');
    errEl.classList.add('hidden');
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    try {
        const data = await apiFetch('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
        });
        setToken(data.token);
        setUser(data.user);
        enterApp();
    } catch (err) {
        errEl.textContent = err.message;
        errEl.classList.remove('hidden');
    }
});

document.getElementById('signup-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errEl = document.getElementById('signup-error');
    errEl.classList.add('hidden');
    const full_name = document.getElementById('signup-name').value;
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    const confirm = document.getElementById('signup-confirm').value;
    if (password !== confirm) {
        errEl.textContent = 'Passwords do not match';
        errEl.classList.remove('hidden');
        return;
    }
    try {
        const data = await apiFetch('/api/auth/signup', {
            method: 'POST',
            body: JSON.stringify({ full_name, email, password }),
        });
        setToken(data.token);
        setUser(data.user);
        enterApp();
    } catch (err) {
        errEl.textContent = err.message;
        errEl.classList.remove('hidden');
    }
});

function logout() {
    clearToken();
    showPage('login');
}

function enterApp() {
    const user = getUser();
    if (user) {
        document.getElementById('user-avatar').textContent = (user.full_name || 'U')[0].toUpperCase();
    }
    showPage('app');
    document.getElementById('app-shell').classList.add('active');
    showAppPage('dashboard');
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

async function loadDashboard() {
    try {
        const data = await apiFetch('/api/dashboard');
        document.getElementById('dash-username').textContent = data.user_name.split(' ')[0];
        document.getElementById('dash-completed').textContent = data.units_completed;
        document.getElementById('dash-hours').textContent = data.hours_studied;
        document.getElementById('dash-in-progress').textContent = data.units_in_progress;

        // Categories
        const catContainer = document.getElementById('dash-categories');
        catContainer.innerHTML = data.categories.map(c => `
            <div class="bg-surface-container-lowest p-6 rounded-2xl transition-all hover:shadow-sm">
                <div class="flex justify-between items-center mb-3">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 ${getCategoryColor(c.category)} rounded-xl flex items-center justify-center">
                            <span class="material-symbols-outlined">${getCategoryIcon(c.category)}</span>
                        </div>
                        <span class="font-headline font-bold text-primary">${c.category}</span>
                    </div>
                    <span class="text-sm font-bold text-slate-700">${Math.round(c.avg_progress)}%</span>
                </div>
                <div class="w-full bg-surface-variant h-1 rounded-full overflow-hidden">
                    <div class="bg-gradient-to-r from-primary to-primary-fixed-dim h-full" style="width: ${c.avg_progress}%"></div>
                </div>
            </div>
        `).join('');

        // Revision queue
        const revContainer = document.getElementById('dash-revision-queue');
        if (data.revision_queue.length === 0) {
            revContainer.innerHTML = '<p class="text-slate-400 text-sm text-center py-4">All caught up! No units to revise.</p>';
        } else {
            revContainer.innerHTML = data.revision_queue.map(u => {
                const borderColor = u.status === 'Need Revision' ? 'border-error' : 'border-tertiary-fixed';
                return `
                <div class="bg-surface-container-lowest p-5 rounded-2xl shadow-sm border-l-4 ${borderColor} hover:-translate-y-1 transition-all">
                    <div class="flex justify-between items-start mb-4">
                        ${getStatusBadge(u.status)}
                        <span class="text-slate-400 text-[10px]">${timeAgo(u.last_revised)}</span>
                    </div>
                    <h4 class="font-headline font-bold text-primary mb-2">${u.title}</h4>
                    <p class="text-slate-500 text-xs mb-4">${u.notes || ''}</p>
                    <div class="flex items-center gap-2">
                        <button class="flex-1 py-2 text-xs font-bold text-primary bg-primary-fixed rounded-lg hover:bg-primary-fixed-dim transition-colors" onclick="openEditModal(${u.id})">Start Review</button>
                    </div>
                </div>`;
            }).join('');
        }
    } catch (err) {
        console.error('Failed to load dashboard:', err);
    }
}

// ─── Library ─────────────────────────────────────────────────────────────────

async function loadLibrary() {
    try {
        allUnits = await apiFetch('/api/units');
        document.getElementById('lib-total-count').textContent = allUnits.length;
        renderUnits(allUnits);
    } catch (err) {
        console.error('Failed to load library:', err);
    }
}

function filterUnits() {
    const search = document.getElementById('lib-search').value.toLowerCase();
    let filtered = allUnits;
    if (currentCategoryFilter) filtered = filtered.filter(u => u.category === currentCategoryFilter);
    if (currentStatusFilter) filtered = filtered.filter(u => u.status === currentStatusFilter);
    if (search) filtered = filtered.filter(u => u.title.toLowerCase().includes(search));
    renderUnits(filtered);
}

function filterByCategory(cat) {
    currentCategoryFilter = cat;
    document.querySelectorAll('.cat-filter').forEach(b => {
        b.classList.remove('bg-surface-container-lowest', 'shadow-sm', 'text-primary', 'font-semibold');
        b.classList.add('text-on-surface-variant', 'font-medium');
        if (b.dataset.cat === cat) {
            b.classList.add('bg-surface-container-lowest', 'shadow-sm', 'text-primary', 'font-semibold');
            b.classList.remove('text-on-surface-variant', 'font-medium');
        }
    });
    filterUnits();
}

function filterByStatus(status) {
    currentStatusFilter = status;
    document.querySelectorAll('.status-filter').forEach(b => {
        b.classList.remove('bg-primary', 'text-on-primary', 'shadow-md', 'font-semibold');
        b.classList.add('bg-surface-container-lowest', 'text-on-surface-variant', 'font-medium');
        if (b.dataset.status === status) {
            b.classList.add('bg-primary', 'text-on-primary', 'shadow-md', 'font-semibold');
            b.classList.remove('bg-surface-container-lowest', 'text-on-surface-variant', 'font-medium');
        }
    });
    filterUnits();
}

function renderUnits(units) {
    const container = document.getElementById('lib-cards');
    let html = units.map(u => `
        <div class="group bg-surface-container-lowest p-6 rounded-xl shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col gap-4 relative overflow-hidden">
            <div class="flex justify-between items-start">
                <div class="space-y-1">
                    <span class="text-[10px] font-bold tracking-widest uppercase text-outline px-2 py-0.5 bg-surface-container rounded">${u.category}</span>
                    <h3 class="text-lg font-bold text-primary group-hover:text-on-primary-container transition-colors">${u.title}</h3>
                </div>
                ${getStatusBadge(u.status)}
            </div>
            <div class="space-y-2 mt-2">
                <div class="flex justify-between items-end">
                    <span class="text-xs font-medium text-on-surface-variant italic">Concept Mastery</span>
                    <span class="text-sm font-bold ${u.status === 'Done' ? 'text-secondary' : u.status === 'Need Revision' ? 'text-error' : 'text-primary'}">${u.progress}%</span>
                </div>
                <div class="h-1 w-full bg-surface-variant rounded-full overflow-hidden">
                    <div class="h-full ${getProgressBarColor(u.status)} rounded-full" style="width: ${u.progress}%"></div>
                </div>
            </div>
            <div class="flex items-center justify-between mt-4 pt-4 border-t border-surface-variant/30">
                <div class="flex items-center gap-2 text-outline">
                    <span class="material-symbols-outlined text-sm">schedule</span>
                    <span class="text-[11px] font-medium">Last revised ${timeAgo(u.last_revised)}</span>
                </div>
                <div class="flex gap-2">
                    <button class="p-2 text-primary hover:bg-primary/5 rounded-lg transition-colors" onclick="openEditModal(${u.id})">
                        <span class="material-symbols-outlined text-lg">edit</span>
                    </button>
                    <button class="p-2 text-error hover:bg-error/5 rounded-lg transition-colors" onclick="deleteUnit(${u.id})">
                        <span class="material-symbols-outlined text-lg">delete</span>
                    </button>
                </div>
            </div>
        </div>
    `).join('');

    // Add "Create New Unit" card
    html += `
        <button class="border-2 border-dashed border-outline-variant hover:border-primary hover:bg-primary/5 rounded-xl transition-all group flex flex-col items-center justify-center p-8 gap-4 min-h-[220px]" onclick="openAddModal()">
            <div class="w-12 h-12 rounded-full bg-surface-container-high flex items-center justify-center group-hover:scale-110 transition-transform">
                <span class="material-symbols-outlined text-primary">add_circle</span>
            </div>
            <div class="text-center">
                <p class="font-headline font-bold text-primary">Create New Unit</p>
                <p class="text-xs text-outline">Expand your knowledge library</p>
            </div>
        </button>`;

    container.innerHTML = html;
}

// ─── Analytics ───────────────────────────────────────────────────────────────

async function loadAnalytics() {
    try {
        const data = await apiFetch('/api/analytics');

        // Mastery bars
        const masteryContainer = document.getElementById('analytics-mastery');
        const categoryNames = { DSA: 'Data Structures & Algorithms', Web: 'Web Architectures', Java: 'Java Enterprise Systems' };
        masteryContainer.innerHTML = data.mastery.map(m => `
            <div class="space-y-3">
                <div class="flex justify-between items-end">
                    <span class="font-headline font-bold text-lg">${categoryNames[m.category] || m.category}</span>
                    <span class="text-primary font-bold">${Math.round(m.avg_progress)}%</span>
                </div>
                <div class="h-3 w-full bg-surface-variant rounded-full overflow-hidden">
                    <div class="h-full bg-gradient-to-r from-primary to-primary-container rounded-full" style="width: ${m.avg_progress}%"></div>
                </div>
            </div>
        `).join('');

        // Weakest areas
        const weakestContainer = document.getElementById('analytics-weakest');
        weakestContainer.innerHTML = data.weakest_areas.map(w => `
            <div class="bg-surface-container-lowest p-4 rounded-lg flex items-center justify-between shadow-sm border border-outline-variant/5">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-full bg-error-container flex items-center justify-center text-on-error-container">
                        <span class="material-symbols-outlined">${getCategoryIcon(w.category)}</span>
                    </div>
                    <div>
                        <h4 class="font-bold text-sm">${w.title}</h4>
                        <p class="text-xs text-on-surface-variant">${w.progress}% Mastery</p>
                    </div>
                </div>
                <span class="material-symbols-outlined text-outline cursor-pointer" onclick="openEditModal(${w.id})">chevron_right</span>
            </div>
        `).join('');
    } catch (err) {
        console.error('Failed to load analytics:', err);
    }
}

// ─── Unit Modal (Add/Edit) ───────────────────────────────────────────────────

function openAddModal() {
    document.getElementById('modal-title').textContent = 'Add New Learning Unit';
    document.getElementById('unit-id').value = '';
    document.getElementById('unit-title').value = '';
    document.getElementById('unit-category').value = 'DSA';
    document.getElementById('unit-status').value = 'In Progress';
    document.getElementById('unit-progress').value = '0';
    document.getElementById('unit-notes').value = '';
    document.getElementById('unit-modal').classList.remove('hidden');
}

function openEditModal(unitId) {
    const unit = allUnits.find(u => u.id === unitId);
    if (!unit) {
        // Try to fetch it
        apiFetch(`/api/units`).then(units => {
            allUnits = units;
            const u = units.find(u => u.id === unitId);
            if (u) populateEditModal(u);
        });
        return;
    }
    populateEditModal(unit);
}

function populateEditModal(unit) {
    document.getElementById('modal-title').textContent = 'Edit Learning Unit';
    document.getElementById('unit-id').value = unit.id;
    document.getElementById('unit-title').value = unit.title;
    document.getElementById('unit-category').value = unit.category;
    document.getElementById('unit-status').value = unit.status;
    document.getElementById('unit-progress').value = unit.progress;
    document.getElementById('unit-notes').value = unit.notes || '';
    document.getElementById('unit-modal').classList.remove('hidden');
}

function closeModal() {
    document.getElementById('unit-modal').classList.add('hidden');
}

document.getElementById('unit-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const unitId = document.getElementById('unit-id').value;
    const payload = {
        title: document.getElementById('unit-title').value,
        category: document.getElementById('unit-category').value,
        status: document.getElementById('unit-status').value,
        progress: parseInt(document.getElementById('unit-progress').value) || 0,
        notes: document.getElementById('unit-notes').value,
    };
    try {
        if (unitId) {
            await apiFetch(`/api/units/${unitId}`, { method: 'PUT', body: JSON.stringify(payload) });
        } else {
            await apiFetch('/api/units', { method: 'POST', body: JSON.stringify(payload) });
        }
        closeModal();
        // Refresh current view
        const activePage = document.querySelector('.app-page:not(.hidden)');
        if (activePage) {
            if (activePage.id === 'app-dashboard') loadDashboard();
            if (activePage.id === 'app-library') loadLibrary();
            if (activePage.id === 'app-analytics') loadAnalytics();
        }
    } catch (err) {
        alert('Error: ' + err.message);
    }
});

async function deleteUnit(unitId) {
    if (!confirm('Are you sure you want to delete this unit?')) return;
    try {
        await apiFetch(`/api/units/${unitId}`, { method: 'DELETE' });
        loadLibrary();
    } catch (err) {
        alert('Error: ' + err.message);
    }
}

// ─── Init ────────────────────────────────────────────────────────────────────

(function init() {
    const token = getToken();
    const user = getUser();
    if (token && user) {
        currentUser = user;
        enterApp();
    } else {
        showPage('home');
    }
})();
