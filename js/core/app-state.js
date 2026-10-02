/**
 * js/core/app-state.js
 * Part of CBT application refactored module
 */

function showLoginForm(type) {
    window.loginType = type;
    document.getElementById('auth-modal').classList.remove('hidden');
    document.getElementById('auth-modal').classList.add('flex');
}

function closeModals() {
    const modalSelector = '[id$="-modal"]';
    document.querySelectorAll(modalSelector).forEach(modal => {
        if (!modal) return;
        modal.classList.remove('flex');
        modal.classList.add('hidden');
    });

    const authModal = document.getElementById('auth-modal');
    if (authModal) {
        authModal.classList.remove('flex');
        authModal.classList.add('hidden');
    }

    const loginError = document.getElementById('login-error');
    if (loginError) loginError.classList.add('hidden');
}

window.closeModals = closeModals;

function reloadPage() {
    // Show loading overlay
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
        overlay.classList.remove('hidden');
        overlay.classList.add('flex');
    }
    // Delay reload to show loading animation
    setTimeout(() => {
        location.reload();
    }, 500);
}

const DB_KEY = "EXAM_DORKAS_DATABASE_OFFICIAL";

const SESSION_KEY = "EXAM_DORKAS_SESSION";

const REMOTE_SERVER_KEY = "EXAM_DORKAS_REMOTE_SERVER_URL";

const STUDENT_EXAM_PROGRESS_KEY = "EXAM_DORKAS_STUDENT_PROGRESS";

const STUDENT_ADMIN_SAVED_PROGRESS_KEY = "EXAM_DORKAS_STUDENT_ADMIN_SAVED_PROGRESS";

window.addEventListener('error', event => {
    console.error('%c[Global Error]', 'background: red; color: white; font-weight: bold', event.message, event.filename, 'line', event.lineno, 'col', event.colno);
});

window.addEventListener('unhandledrejection', event => {
    console.error('%c[Unhandled Promise Rejection]', 'background: darkred; color: white; font-weight: bold', event.reason);
});

function parseLiveExamTimestamp(val) {
    if (!val && val !== 0) return Date.now();
    if (typeof val === 'number') return val;
    const str = String(val).trim();
    if (/^\d+$/.test(str)) {
        let ms = Number(str);
        if (str.length === 10) ms *= 1000;
        return ms;
    }
    const parsed = Date.parse(str);
    return Number.isNaN(parsed) ? Date.now() : parsed;
}

async function sendLiveExamToServer(liveEntry) {
    if (!liveEntry) {
        console.warn('[sendLiveExamToServer] liveEntry is null/undefined');
        return;
    }
    if (!liveEntry.studentId) {
        console.warn('[sendLiveExamToServer] liveEntry missing studentId:', liveEntry);
        return;
    }
    try {
        const url = getApiBaseUrl() + '/api/live-exam';
        console.log('%c[sendLiveExamToServer]', 'color: teal; font-weight: bold', 'POST', url);
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(liveEntry)
        });
        if (!res.ok) {
            const responseText = await res.text();
            console.warn('%c[sendLiveExamToServer] ❌ HTTP', 'color: red', res.status, ':', responseText);
        } else {
            const json = await res.json();
            console.log('%c[sendLiveExamToServer] ✅ HTTP 200', 'color: green', json);
        }
    } catch (err) {
        console.warn('%c[sendLiveExamToServer] ❌ Exception:', 'color: red', err.message || err);
    }
}

var db = {
    subjects: [{ name: "Pendidikan Agama", locked: false }, { name: "Bahasa Indonesia", locked: false }, { name: "Matematika", locked: false }, { name: "IPA", locked: false }, { name: "IPS", locked: false }, { name: "Bahasa Inggris", locked: false }],
    rombels: ["VII", "VIII", "IX"],
    questions: [],
    quizzes: [],
    students: [{ id: "ADM", password: "admin321", name: "Administrator", role: "admin" }],
    results: [],
    schedules: [],
    activeExams: [],
    jenisUjian: {},
    schoolSettings: {}
};
window.db = db;

var currentSiswa = null;
window.currentSiswa = null;
var isExamActive = false;
window.isExamActive = false;
var examData = null;
window.examData = null;

const loadedCollections = {
    questions: false,
    students: false,
    results: false
};

let _hasLoadedFlags = { questions: false, students: false, results: false };

async function ensureDataLoaded(type, force = false) {
    if (window.isStaticMode) return;

    // If not forced, check flags and existing data
    if (!force) {
        if (_hasLoadedFlags[type]) {
            if (loadedCollections.hasOwnProperty(type)) loadedCollections[type] = true;
            return;
        }

        if (type === 'questions' && db.questions.length > 0) {
            _hasLoadedFlags.questions = true;
            loadedCollections.questions = true;
            return;
        }
        if (type === 'students' && db.students.length > 1) { // ADM is always there
            _hasLoadedFlags.students = true;
            loadedCollections.students = true;
            return;
        }
        if (type === 'results' && db.results.length > 0) {
            _hasLoadedFlags.results = true;
            loadedCollections.results = true;
            return;
        }
    }

    console.log(`[LAZY-LOAD] Fetching ${type} on-demand...`);
    showToast(`Memuat data ${type}...`, 'info');

    try {
        let res;
        if (type === 'questions') {
            res = await fetch(getApiBaseUrl() + '/api/questions?limit=-1');
            if (res.ok) {
                const data = await res.json();
                db.questions = Array.isArray(data.items) ? data.items : (Array.isArray(data) ? data : []);
                _hasLoadedFlags.questions = true;
            }
        } else if (type === 'students') {
            res = await fetch(getApiBaseUrl() + '/api/students');
            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data) && data.length > 0) {
                    const adminUser = Array.isArray(db.students)
                        ? db.students.find(x => x.role === 'admin')
                        : null;
                    if (adminUser && !data.some(x => x.role === 'admin' && x.id === adminUser.id)) {
                        data.unshift(adminUser);
                    }
                    db.students = data;
                } else {
                    db.students = Array.isArray(db.students) && db.students.length > 0
                        ? db.students
                        : [{ id: 'ADM', password: 'admin321', name: 'Administrator', role: 'admin' }];
                }
                _hasLoadedFlags.students = true;
            }
        } else if (type === 'results') {
            res = await fetch(getApiBaseUrl() + '/api/results?limit=-1');
            if (res.ok) {
                const data = await res.json();
                db.results = Array.isArray(data.items) ? data.items : (Array.isArray(data) ? data : []);
                _hasLoadedFlags.results = true;
            }
        }


        if (loadedCollections.hasOwnProperty(type)) {
            loadedCollections[type] = true;
        }

        console.log(`[LAZY-LOAD] ✅ ${type} loaded:`, db[type]?.length);
    } catch (e) {
        console.warn(`[LAZY-LOAD] Failed to load ${type}:`, e.message);
    }
}

function mergeResults(localArr = [], serverArr = []) {
    const map = new Map();
    const makeKey = r => {
        if (!r || typeof r !== 'object') return JSON.stringify(r);
        if (r.id) return r.id;
        return `${r.studentId || ''}-${r.mapel || ''}-${r.rombel || ''}-${r.date || ''}`;
    };

    const getTimestamp = r => {
        if (!r || typeof r !== 'object') return 0;
        if (r.updatedAt) {
            const t = Number(r.updatedAt);
            if (!Number.isNaN(t) && t > 0) return t;
        }
        if (r.date) {
            const d = Date.parse(r.date);
            if (!Number.isNaN(d)) return d;
        }
        return 0;
    };

    const hasDetails = r => Array.isArray(r.questions) && r.questions.length > 0 && Array.isArray(r.answers);

    (Array.isArray(localArr) ? localArr : []).forEach(r => {
        const key = makeKey(r);
        map.set(key, r);
    });
    (Array.isArray(serverArr) ? serverArr : []).forEach(r => {
        const key = makeKey(r);
        if (!map.has(key)) {
            map.set(key, r);
            return;
        }
        const existing = map.get(key);
        const existingTs = getTimestamp(existing);
        const incomingTs = getTimestamp(r);

        if (incomingTs > existingTs) {
            map.set(key, Object.assign({}, existing, r));
            return;
        }
        if (incomingTs < existingTs) {
            return;
        }

        // Tombstone deletion must win on equal timestamps to prevent resurrecting deleted rows
        if (existing.deleted || r.deleted) {
            map.set(key, Object.assign({}, existing, r, { deleted: true }));
            return;
        }

        // equal timestamp: maximize details and preserve deletion flag
        if (!hasDetails(existing) && hasDetails(r)) {
            map.set(key, Object.assign({}, existing, r));
        }
    });
    return Array.from(map.values());
}

window.addEventListener('storage', async e => {
    if (e.key !== DB_KEY) return;
    try {
        const other = await loadLocalDb();
        if (other) {
            // Always sync results (merge them) to ensure score tracking is consistent
            if (other.results) {
                const merged = mergeResults(db.results, other.results);
                db.results = merged;
            }

            // For admin and teacher roles, we also want to sync configuration data
            // so that setting a schedule in one tab reflects in others immediately.
            const isManager = currentSiswa && (currentSiswa.role === 'admin' || currentSiswa.role === 'teacher');

            if (isManager) {
                // Sync settings from other tab
                if (other.subjects) db.subjects = other.subjects;
                if (other.rombels) db.rombels = other.rombels;
                if (other.students) db.students = other.students;
                if (other.questions) db.questions = other.questions;
                if (other.schedules) db.schedules = other.schedules;
                if (other.timeLimits) db.timeLimits = other.timeLimits;
                db.activeExams = Array.isArray(other.activeExams) ? other.activeExams : [];

                updateStats();
                updateCompletionCharts();

                // Re-render active admin sections if visible
                if (document.getElementById('admin-results') && !document.getElementById('admin-results').classList.contains('hidden')) {
                    renderAdminResults();
                }
                if (document.getElementById('admin-overview') && !document.getElementById('admin-overview').classList.contains('hidden')) {
                    updateStats();
                }
                if (document.getElementById('admin-rombel') && !document.getElementById('admin-rombel').classList.contains('hidden')) {
                    renderRombelSection();
                }
            }
        }
    } catch (err) {
        console.warn('Error during storage sync:', err);
    }
});

window.addEventListener('beforeunload', () => {
    if (isExamActive) {
        clearLiveExamStatus().catch(() => { });
    }
});

const SCHOOL_SETTINGS_KEY = 'cbt_school_settings';

function normalizeSchoolSettings(settings = {}) {
    if (!settings || typeof settings !== 'object') return {};
    return {
        yayasan: settings.yayasan || '',
        name: settings.name || '',
        principal: settings.principal || '',
        principalNip: settings.principalNip || '',
        address: settings.address || '',
        kota: settings.kota || '',
        tahun: settings.tahun || '',
        semester: settings.semester || 'GANJIL',
        logo: settings.logo || '',
        logoUrl: settings.logoUrl || '',
        ...settings
    };
}

function renderSchoolIdentity(settings) {
    const safeSettings = normalizeSchoolSettings(settings || db?.schoolSettings || {});
    if (!safeSettings.name) return;

    const name = safeSettings.name;
    let logo = safeSettings.logoUrl || safeSettings.logo || localStorage.getItem('cbt_school_logo') || 'logo.png';
    if (logo && logo !== 'undefined' && logo !== 'null' && !logo.startsWith('data:') && !logo.startsWith('http') && logo !== 'logo.png') {
        const base = typeof getApiBaseUrl === 'function' ? getApiBaseUrl() : '';
        if (base) logo = base + (logo.startsWith('/') ? logo : '/' + logo);
    }

    const currentTitle = document.title;
    if (!currentTitle.includes(name.toUpperCase())) {
        document.title = `CBT - ${name}`;
    }

    const ids = ['school-name-display', 'raport-school-name', 'cert-school-name'];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerText = name;
    });

    const loginSubtitle = document.querySelector('.cbt-subtitle');
    const loginLogo = document.querySelector('.logo-glow');
    if (loginSubtitle) loginSubtitle.innerText = name;
    if (loginLogo) {
        loginLogo.src = logo;
        const favicon = document.querySelector('link[rel="icon"]');
        const appleIcon = document.querySelector('link[rel="apple-touch-icon"]');
        if (favicon) favicon.href = logo;
        if (appleIcon) appleIcon.href = logo;
    }

    const adminSidebarTitle = document.getElementById('admin-sidebar-title');
    const adminSidebarLogo = document.getElementById('admin-sidebar-logo');
    const raportLogo = document.getElementById('raport-logo');
    if (adminSidebarTitle) adminSidebarTitle.innerText = `ADMIN CBT ${name}`;
    if (adminSidebarLogo) adminSidebarLogo.src = logo;
    if (raportLogo) raportLogo.src = logo;

    const teacherSidebarTitle = document.getElementById('teacher-sidebar-title');
    const teacherSidebarLogo = document.getElementById('teacher-sidebar-logo');
    if (teacherSidebarTitle) teacherSidebarTitle.innerText = `${name} - GURU`;
    if (teacherSidebarLogo) teacherSidebarLogo.src = logo;

    const studentSidebarTitle = document.getElementById('student-sidebar-title');
    const studentSidebarLogo = document.getElementById('student-sidebar-logo');
    const studentMeta = document.getElementById('student-meta-school');
    if (studentSidebarTitle) studentSidebarTitle.innerText = name;
    if (studentSidebarLogo) studentSidebarLogo.src = logo;
    if (studentMeta) studentMeta.innerText = name;
}
window.renderSchoolIdentity = renderSchoolIdentity;

async function fetchSchoolSettings() {
    try {
        const res = await fetch(getApiBaseUrl() + '/api/school-settings');
        if (res.ok) {
            const settings = await res.json();
            const safeSettings = normalizeSchoolSettings(settings);
            if (safeSettings.name) {
                if (!db.schoolSettings) db.schoolSettings = {};
                Object.assign(db.schoolSettings, safeSettings);
                renderSchoolIdentity(safeSettings);
            }
        }
    } catch (e) {
        console.warn('[fetchSchoolSettings] Failed:', e.message);
        if (db.schoolSettings && db.schoolSettings.name) {
            renderSchoolIdentity(db.schoolSettings);
        }
    }
}
window.fetchSchoolSettings = fetchSchoolSettings;

function showStaticModeWarning() {
    const warning = document.createElement('div');
    warning.id = 'static-mode-warning';
    warning.className = 'fixed bottom-4 right-4 bg-amber-600 text-white px-4 py-3 rounded-2xl shadow-2xl z-[9999] flex items-center gap-3 animate-bounce cursor-pointer';
    warning.innerHTML = `
        <div class="bg-white/20 w-8 h-8 rounded-full flex items-center justify-center"><i class="fas fa-exclamation-triangle"></i></div>
        <div>
            <p class="text-[10px] font-black uppercase tracking-widest opacity-80">Static Mode</p>
            <p class="text-xs font-bold leading-tight">Berjalan tanpa server. Perubahan tidak akan tersimpan ke server!</p>
        </div>
        <button class="ml-2 opacity-50 hover:opacity-100" onclick="this.parentElement.remove()"><i class="fas fa-times"></i></button>
    `;
    document.body.appendChild(warning);
}

window.showStaticModeWarning = showStaticModeWarning;

let currentConfigType = "";

let currentDetailPackage = null;

let currentSortBy = 'mapel';

let currentSortOrder = 'asc';


async function init() {
    const loginBtn = document.getElementById('login-btn');
    const loginBtnText = loginBtn ? loginBtn.innerHTML : '';
    if (loginBtn) {
        loginBtn.disabled = true;
        loginBtn.style.opacity = '0.7';
        loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading Data...';
    }

    // Move migrateRombels() to run AFTER database is actually loaded.
    // SYNC: Fix any data consistency issues in results
    if (Array.isArray(db.results)) {
        db.results.forEach((result, idx) => {
            // Ensure answers and questions arrays match in length
            if (Array.isArray(result.questions) && Array.isArray(result.answers)) {
                const qLen = result.questions.length;
                const aLen = result.answers.length;
                if (aLen < qLen) {
                    console.log(`Result ${idx}: Padding answers from ${aLen} to ${qLen}`);
                    while (result.answers.length < qLen) {
                        result.answers.push(null);
                    }
                }
                // Validate each question has required fields
                result.questions.forEach((q, i) => {
                    if (!q || typeof q !== 'object') {
                        console.warn(`Result ${idx}, Question ${i}: Invalid structure`);
                    }
                });
            }
        });
    }

    // First, check if there's a saved session
    let savedSession = null;
    try {
        savedSession = localStorage.getItem(SESSION_KEY);
    } catch (e) {
        console.warn('localStorage not available for session check:', e.message);
    }
    if (savedSession) {
        try {
            const session = JSON.parse(savedSession);
            currentSiswa = session.user;
        } catch (e) {
            console.warn('Invalid session format');
        }
    }

    // Then fetch DB
    try {
        const parsed = await loadLocalDb();
        if (parsed) db = normalizeDb(parsed);

        // Fetch School Identity First for public branding
        await fetchSchoolSettings();

        let res = await fetch(getApiBaseUrl() + '/api/db');
        if (!res.ok && (res.status === 404 || res.status === 0)) {
            res = await fetch('database.json');
            window.isStaticMode = true;
            showStaticModeWarning();
        }

        if (res.ok) {
            const serverDb = await res.json();
            if (serverDb) {
                // Merge metadata from server into local state without erasing 
                // large collections that weren't sent (lazy-loaded).
                db = normalizeDb(serverDb, db);
                if (db.schoolSettings && db.schoolSettings.name) {
                    renderSchoolIdentity(db.schoolSettings);
                }
                console.log('Database synced with server (Metadata load).');
            }
        }
    } catch (err) {
        console.error('Initialization error:', err);
    }

    // NOW run migration on the final loaded data
    migrateRombels();
    migrateQuestionTypes();

    // Re-enable login
    if (loginBtn) {
        loginBtn.disabled = false;
        loginBtn.style.opacity = '1';
        loginBtn.innerHTML = loginBtnText;
    }

    // Verify user still exists in database and sync with latest data
    if (currentSiswa) {
        await ensureDataLoaded('students');
        const updatedUser = db.students.find(x => x.id === currentSiswa.id && x.password === currentSiswa.password);
        if (!updatedUser) {
            console.warn('User from session not found in database or password mismatch, logging out');
            clearSession();
            window.location.href = 'index.html';
            return;
        }

        // CRITICAL: Update session object to latest structure (migrated rombels/subjects)
        currentSiswa = updatedUser;
        window.currentSiswa = updatedUser;
        console.log('Session synchronized with latest database for:', currentSiswa.name);

        const page = window.location.pathname.split('/').pop().split('?')[0];
        if (currentSiswa.role === 'admin' && page !== 'admin.html' && page !== 'guru.html') {
            window.location.href = 'admin.html';
            return;
        } else if (currentSiswa.role === 'student' && page !== 'siswa.html') {
            window.location.href = 'siswa.html';
            return;
        } else if (currentSiswa.role === 'teacher' && page !== 'guru.html') {
            window.location.href = 'guru.html';
            return;
        }

        const loginScreen = document.getElementById('login-screen');
        if (loginScreen) loginScreen.classList.add('hidden');

        if (typeof closeModals === 'function') closeModals();

        if (currentSiswa.role === 'admin') {
            const adminDash = document.getElementById('admin-dashboard');
            if (adminDash) adminDash.classList.remove('hidden');
            const teacherDash = document.getElementById('teacher-dashboard');
            if (teacherDash) teacherDash.classList.remove('hidden');

            // Auto-load core data for admin
            await ensureDataLoaded('students');
            await ensureDataLoaded('questions');
            await ensureDataLoaded('results');

            if (typeof showAdminSection === 'function') showAdminSection('overview');
        } else if (currentSiswa.role === 'student') {
            const studentDash = document.getElementById('student-dashboard');
            if (studentDash) studentDash.classList.remove('hidden');
            const stLabel = document.getElementById('st-info-label');
            if (stLabel) stLabel.innerText = `${currentSiswa.name} | ${currentSiswa.rombel}`;

            // Auto-load core data for student
            await ensureDataLoaded('questions');
            await ensureDataLoaded('results', true);

            console.log('[init] Student login detected, checking for exam restore...');
            console.log('[init] studentDash element:', !!studentDash);
            console.log('[init] restoreStudentExamProgress function:', typeof restoreStudentExamProgress);

            if (typeof restoreStudentExamProgress === 'function' && studentDash) {
                console.log('[init] Calling restoreStudentExamProgress...');
                const restored = await restoreStudentExamProgress();
                console.log('[init] restoreStudentExamProgress result:', restored);
                if (!restored && typeof renderStudentExamList === 'function') {
                    console.log('[init] No restore data, rendering exam list...');
                    renderStudentExamList();
                } else if (restored) {
                    console.log('[init] Exam restored successfully');
                }
            } else if (typeof renderStudentExamList === 'function') {
                console.log('[init] No restore function or studentDash, rendering exam list...');
                renderStudentExamList();
            }

            // Request fullscreen mode for student
            if (typeof requestFullscreen === 'function') {
                requestFullscreen();
            }
        } else if (currentSiswa.role === 'teacher') {
            const teacherDash = document.getElementById('teacher-dashboard');
            if (teacherDash) teacherDash.classList.remove('hidden');

            // Auto-load core data for teacher
            await ensureDataLoaded('students');
            await ensureDataLoaded('questions');
            await ensureDataLoaded('results');

            const tcLabel = document.getElementById('teacher-info-label');
            if (tcLabel) tcLabel.innerText = `${currentSiswa.name} | Guru ${typeof formatTeacherSubjects === 'function' ? formatTeacherSubjects(currentSiswa) : ''}`;
            // Clear search input and API key input on initial load
            const searchInput = document.getElementById('teacher-search-questions');
            if (searchInput) searchInput.value = '';
            const apiKeyInput = document.getElementById('new-api-key-input');
            if (apiKeyInput) apiKeyInput.value = '';
            if (typeof renderTeacherQuestions === 'function' && teacherDash) renderTeacherQuestions();
        }
        migrateTeacherData();
        updateStats();

        // Apply school branding AFTER dashboard is fully visible
        // This is the definitive call that sets logo/name on the rendered dashboard
        const schoolData = db.schoolSettings?.name ? db.schoolSettings : null;
        if (schoolData) {
            renderSchoolIdentity(schoolData);
        }

        return;
    }

    const page = window.location.pathname.split('/').pop().split('?')[0];
    if (page !== '' && page !== 'index.html') {
        window.location.href = 'index.html';
    } else {
        if (typeof showLoginScreen === 'function' && document.getElementById('login-screen')) showLoginScreen();
    }
}

function showLoginScreen() {
    const login = document.getElementById('login-screen');
    if (login) login.classList.remove('hidden');

    const admin = document.getElementById('admin-dashboard');
    if (admin) admin.classList.add('hidden');

    const student = document.getElementById('student-dashboard');
    if (student) student.classList.add('hidden');

    const teacher = document.getElementById('teacher-dashboard');
    if (teacher) teacher.classList.add('hidden');

    if (typeof closeModals === 'function') closeModals();
}

function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
        window.innerWidth <= 768;
}

function saveSession() {
    try {
        const session = {
            user: currentSiswa,
            timestamp: new Date().getTime()
        };
        localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } catch (e) {
        console.warn('Failed to save session to localStorage:', e.message);
    }
}

function clearSession() {
    if (currentSiswa && currentSiswa.role === 'student') {
        // offline flag handled earlier
        if (typeof updateCompletionCharts === 'function') updateCompletionCharts();
    }
    currentSiswa = null;
    try {
        localStorage.removeItem(SESSION_KEY);
    } catch (e) {
        console.warn('Failed to clear session from localStorage:', e.message);
    }
}

async function send_result_to_server(result) {
    const res = await fetch(getApiBaseUrl() + '/api/result', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(result)
    });
    if (!res.ok) throw new Error(`server responded ${res.status}`);
}

async function sendResult(result) {
    // wrapper with retry logic similar to save(); if /api/result is
    // unavailable (404) we fall back to /api/results then /api/db.
    let success = false;
    let attempts = 3;
    while (attempts > 0 && !success) {
        try {
            await send_result_to_server(result);
            success = true;
            break;
        } catch (e) {
            const msg = e.message || '';
            if (msg.includes('404')) {
                console.warn('/api/result not found, using /api/results fallback');
                const fallbackRes = await fetch(getApiBaseUrl() + '/api/results', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify([result])
                });
                if (fallbackRes.ok) {
                    success = true;
                    break;
                }
            }

            try {
                const dbRes = await fetch(getApiBaseUrl() + '/api/db', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ results: [result] })
                });
                if (dbRes.ok) {
                    success = true;
                    break;
                }
            } catch (dbErr) {
                console.warn('Fallback /api/db error', dbErr.message || dbErr);
            }

            console.warn('sendResult error, retrying', msg);
            attempts--;
            if (attempts > 0) await new Promise(r => setTimeout(r, 500));
        }
    }
    if (!success) throw new Error('could not send result to server');
}
window.sendResult = sendResult;

async function save(options = {}) {
    // Students should not overwrite the entire DB structure via /api/db 
    // as they may have stale caches that erase admin settings.
    // Their results are handled separately via sendResult().
    const isStudent = currentSiswa && currentSiswa.role === 'student';
    if (isStudent && !options.forceServerSave) {
        console.log('[SAVE] Skipping server push for student role. Local persistence only.');
        try {
            await saveLocalDb();
            updateStats();
        } catch (err) {
            console.warn('LocalStorage save failed:', err.message || err);
        }
        return;
    }

    // OPTIONAL: Refresh from server before saving to avoid overwriting recent changes from other admins
    if (options.refreshBeforeSave) {
        try {
            const res = await fetch(getApiBaseUrl() + '/api/db?t=' + Date.now());
            if (res.ok) {
                const serverDb = await res.json();
                if (serverDb && serverDb.students) {
                    if (serverDb.results) db.results = mergeResults(db.results, serverDb.results);
                }
            }
        } catch (e) {
            console.warn('Pre-save refresh failed, proceeding with local state:', e.message);
        }
    }

    // First send database to server; don’t let localStorage issues block the network request.
    let serverSaveSuccess = false;
    let retries = 3;

    showToast('Menyimpan ke server...', 'info');
    while (retries > 0 && !serverSaveSuccess) {
        try {
            const payloadToSync = { ...db };
            if (!loadedCollections.questions) delete payloadToSync.questions;
            if (!loadedCollections.results) delete payloadToSync.results;

            const jsonBody = JSON.stringify(payloadToSync);
            const bodySize = jsonBody.length / (1024 * 1024);

            console.log(`[SAVE] Payload size: ${bodySize.toFixed(2)} MB`);

            const res = await fetch(getApiBaseUrl() + '/api/db', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: jsonBody
            });
            if (!res.ok) throw new Error('Gagal sync database lokal ke server');

            serverSaveSuccess = true;
            console.log('Database berhasil disimpan ke server');
        } catch (err) {
            console.warn(`Error saat menyimpan ke server (attempt ${4 - retries}):`, err.message || err);
            retries--;
            if (retries > 0) {
                await new Promise(r => setTimeout(r, 1000));
            }
        }
    }

    if (serverSaveSuccess) {
        showToast('Perubahan tersimpan ke server!', 'success');
    } else {
        console.error('PERINGATAN: Gagal menyimpan ke server setelah 3 percobaan!');
        showToast('Gagal menyimpan ke server! Periksa koneksi.', 'error');
    }

    try {
        await saveLocalDb();
    } catch (err) {
        console.warn('LocalStorage save failed:', err.message || err);
    }

    updateStats();
}
window.save = save;