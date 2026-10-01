/**
 * DR CBT - Combined Application Bundle
 * Generated from modular files in js/
 * Last Built: 2026-10-01T13:56:47.618Z
 */


/* ==================== FILE: js/core/app-state.js ==================== */
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

async function save(options = {}) {
    const isAdminMode = typeof adminSyncState !== 'undefined' && adminSyncState.isAdminMode;
    const shouldRefreshBeforeSave = Boolean(options.refreshBeforeSave || (isAdminMode && options.forceServerSave));

    // Admin mode is LOCAL-ONLY by default. All admin edits are kept in the browser
    // until the admin explicitly clicks the sync button, which calls save({ forceServerSave: true }).
    if (isAdminMode && !options.forceServerSave) {
        adminSyncState.hasUnsyncedChanges = true;
        if (typeof updateAdminSyncIndicator === 'function') updateAdminSyncIndicator();
        console.log('[SAVE] Admin mode active: persisting locally only, waiting for manual sync.');
        try {
            await saveLocalDb();
            updateStats();
        } catch (err) {
            console.warn('LocalStorage save failed:', err.message || err);
        }
        return;
    }

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
    if (shouldRefreshBeforeSave) {
        try {
            const res = await fetch(getApiBaseUrl() + '/api/db?t=' + Date.now());
            if (res.ok) {
                const serverDb = await res.json();
                if (serverDb && serverDb.students) {
                    // Merge results from server to local state
                    if (serverDb.results) db.results = mergeResults(db.results, serverDb.results);

                    // Keep the current local state as higher priority while preventing stale overwrites.
                    if (serverDb.questions) db.questions = Array.isArray(serverDb.questions) ? serverDb.questions : db.questions;
                    if (serverDb.students) db.students = Array.isArray(serverDb.students) ? serverDb.students : db.students;
                    if (serverDb.subjects) db.subjects = Array.isArray(serverDb.subjects) ? serverDb.subjects : db.subjects;
                    if (serverDb.rombels) db.rombels = Array.isArray(serverDb.rombels) ? serverDb.rombels : db.rombels;
                }
            }
        } catch (e) {
            console.warn('Pre-save refresh failed, proceeding with local state:', e.message);
        }
    }

    // First send database to server; don’t let localStorage issues
    // block the network request.
    let serverSaveSuccess = false;
    let retries = 3;

    showToast('Menyimpan ke server...', 'info');
    while (retries > 0 && !serverSaveSuccess) {
        try {
            // PROTEKSI DATA: Jangan kirim koleksi besar jika belum dimuat (agar tidak menimpa dengan array kosong)
            // CATATAN: students SELALU dikirim karena ini data master penting (bukan koleksi besar)
            const payloadToSync = { ...db };
            if (!loadedCollections.questions) delete payloadToSync.questions;
            // students selalu disertakan — hapus baris: if (!loadedCollections.students) delete payloadToSync.students;
            if (!loadedCollections.results) delete payloadToSync.results;

            const jsonBody = JSON.stringify(payloadToSync);
            const bodySize = jsonBody.length / (1024 * 1024);

            console.log(`[SAVE] Payload size: ${bodySize.toFixed(2)} MB`);

            // If payload is large (likely causing 413 on some hosts),
            // send metadata (dbOnly) to /api/db and send results in smaller batches
            if (bodySize > 0.9 && Array.isArray(payloadToSync.results) && payloadToSync.results.length > 0) {
                // Send DB without results first
                const { results, ...dbOnly } = payloadToSync;
                const dbJson = JSON.stringify(dbOnly);
                const resMeta = await fetch(getApiBaseUrl() + '/api/db', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: dbJson
                });
                if (!resMeta.ok) throw new Error('Gagal sync metadata ke server');

                // Helper to send results in batches sized to stay under ~500KB
                const sendResultsBatches = async (allResults) => {
                    const maxBytes = 500 * 1024; // 500 KB
                    let batch = [];
                    for (const r of allResults) {
                        batch.push(r);
                        const size = JSON.stringify(batch).length;
                        if (size >= maxBytes) {
                            const ok = await postResultsBatch(batch);
                            if (!ok) throw new Error('Gagal mengirim batch results');
                            batch = [];
                        }
                    }
                    if (batch.length > 0) {
                        const ok = await postResultsBatch(batch);
                        if (!ok) throw new Error('Gagal mengirim batch results');
                    }
                };

                const postResultsBatch = async (batchArray) => {
                    try {
                        const resBatch = await fetch(getApiBaseUrl() + '/api/results', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(batchArray)
                        });
                        return resBatch.ok;
                    } catch (e) {
                        console.warn('[SAVE] postResultsBatch error:', e.message || e);
                        return false;
                    }
                };

                await sendResultsBatches(payloadToSync.results);

            } else {
                // Simpan seluruh database lokal ke server dalam satu panggilan.
                const res = await fetch(getApiBaseUrl() + '/api/db', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: jsonBody
                });
                if (!res.ok) throw new Error('Gagal sync database lokal ke server');
            }

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
        if (typeof adminSyncState !== 'undefined' && adminSyncState.isAdminMode) {
            adminSyncState.hasUnsyncedChanges = false;
            if (typeof updateAdminSyncIndicator === 'function') updateAdminSyncIndicator();
        }
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

function deleteResult(idx) {
    if (!confirm('Hapus hasil ujian ini?')) return;
    if (!db.results[idx]) return;
    db.results[idx].deleted = true;
    db.results[idx].updatedAt = Date.now();
    loadedCollections.results = true;
    updateCompletionCharts();

    if (typeof adminSyncState !== 'undefined' && adminSyncState.isAdminMode) {
        adminSyncState.hasUnsyncedChanges = true;
        if (typeof updateAdminSyncIndicator === 'function') updateAdminSyncIndicator();
        if (typeof adminSave === 'function') {
            adminSave();
        } else {
            saveLocalDb();
        }
    } else {
        save();
    }

    const adminDash = document.getElementById('admin-dashboard');
    const teacherDash = document.getElementById('teacher-dashboard');

    if (adminDash && !adminDash.classList.contains('hidden')) {
        renderAdminResults();
    } else if (teacherDash && !teacherDash.classList.contains('hidden')) {
        renderTeacherResults();
    }
}

function clearAllResults() {
    const activeResults = (db.results || []).filter(r => !r.deleted);
    if (activeResults.length === 0) {
        alert('Tidak ada hasil ujian tersisa untuk dihapus.');
        return;
    }

    if (!confirm('Anda yakin ingin menghapus semua data skor hasil ujian? Tindakan ini tidak dapat dibatalkan.')) return;

    const now = Date.now();
    db.results = (db.results || []).map(r => ({
        ...r,
        deleted: true,
        updatedAt: now
    }));

    loadedCollections.results = true;
    if (typeof adminSyncState !== 'undefined' && adminSyncState.isAdminMode) {
        adminSyncState.hasUnsyncedChanges = true;
        if (typeof updateAdminSyncIndicator === 'function') updateAdminSyncIndicator();
        if (typeof adminSave === 'function') adminSave();
    } else {
        save();
    }
    updateCompletionCharts();
    renderAdminResults();

    alert('Semua hasil ujian telah dihapus secara permanen.');
}

function cleanIncompleteResults() {
    const incompleteResults = (db.results || []).filter(r => !r.deleted && r.isIncomplete);

    if (incompleteResults.length === 0) {
        alert('✅ Tidak ada data yang tidak lengkap. Semua hasil ujian sudah sempurna!');
        return;
    }

    const msg = `Ditemukan ${incompleteResults.length} hasil ujian yang tidak lengkap:\n\n${incompleteResults.map(r => `• ${r.studentName || 'Unknown'}`).join('\n')}\n\nYakin ingin menghapus semua data ini? (Tidak dapat dibatalkan)`;

    if (!confirm(msg)) return;

    const now = Date.now();
    db.results = (db.results || []).map(r => {
        if (!r.deleted && r.isIncomplete) {
            return {
                ...r,
                deleted: true,
                updatedAt: now
            };
        }
        return r;
    });

    if (typeof adminSyncState !== 'undefined' && adminSyncState.isAdminMode) {
        adminSyncState.hasUnsyncedChanges = true;
        if (typeof updateAdminSyncIndicator === 'function') updateAdminSyncIndicator();
        if (typeof adminSave === 'function') adminSave();
    } else {
        save();
    }
    updateCompletionCharts();
    renderAdminResults();

    alert(`✅ ${incompleteResults.length} hasil ujian yang tidak lengkap telah dihapus.`);
}

function viewDetailedResult(idx) {
    const result = db.results[idx];
    if (!result || result.deleted) {
        alert('Hasil ujian tidak ditemukan atau sudah dihapus.');
        return;
    }

    // VALIDASI: Ensure both answers dan questions exist dan valid
    const questions = Array.isArray(result.questions) ? result.questions : [];
    const answers = Array.isArray(result.answers) ? result.answers : [];

    // Cek apakah ini adalah data incomplete
    if (result.isIncomplete) {
        const msg = `⚠️ Data Tidak Lengkap\n\nHasil ujian untuk "${result.studentName}" tidak memiliki struktur data yang lengkap.\n\nInfo yang tersedia:\n- Soal: ${questions.length} soal\n- Jawaban: Tidak tersimpan\n- Skor: Belum dihitung\n\nOpsi:\n1. Tunggu sinkronisasi server\n2. Hapus hasil ini dan minta siswa mengulang ujian`;
        alert(msg);
        return;
    }

    if (questions.length === 0) {
        alert('❌ Data Soal Tidak Tersedia\n\nUntuk hasil ujian ini tidak ditemukan data soal yang lengkap. Kemungkinan:\n1. Data rusak atau tidak tersimpan dengan sempurna\n2. Ujian belum selesai disimpan\n3. Ada masalah saat sinkronisasi\n\nSilakan hapus hasil ini dan minta siswa mengulang ujian.');
        return;
    }

    // Ensure arrays sama panjang
    while (answers.length < questions.length) {
        answers.push(null);
    }

    console.log(`Viewing result #${idx}: ${questions.length} soal, ${answers.length} jawaban`);

    // Helper function to escape HTML
    const escapeHtml = (text) => {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    };

    let content = `<div class="mb-8">
                <h3 class="text-2xl font-black text-slate-800 mb-2">Detail Jawaban - ${escapeHtml(result.studentName)}</h3>
                <p class="text-slate-600 text-sm font-medium">Rombel: <span class="font-bold text-slate-800">${result.rombel}</span> | Mata Pelajaran: <span class="font-bold text-slate-800">${result.mapel}</span> | Skor: <span class="font-bold text-sky-600 text-lg">${result.score}</span></p>
            </div>`;

    questions.forEach((q, i) => {
        // DEFENSIVE: Handle missing or invalid question
        if (!q || typeof q !== 'object') {
            console.warn(`Question ${i} is invalid:`, q);
            return;
        }

        const studentAnswer = answers[i];
        const correctAnswer = q.correct !== undefined ? q.correct : null;
        const qType = q.type || 'single';

        content += `<div class="mb-8 p-6 bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl border border-slate-200 shadow-sm">
                    <div class="flex items-center gap-3 mb-4">
                        <span class="w-8 h-8 bg-sky-600 text-white rounded-full flex items-center justify-center text-sm font-bold">${i + 1}</span>
                        <h4 class="font-bold text-slate-800 text-lg">Soal</h4>
                    </div>
                    <div class="text-slate-800 mb-4 leading-relaxed">${q.text}</div>
                    <p class="text-xs text-slate-500 mb-2"><strong>Jenis:</strong> ${qType === 'single' ? 'Pilihan ganda' : qType === 'multiple' ? 'Pilihan ganda (Kompleks)' : qType === 'text' ? 'Esai' : qType === 'tf' ? 'Benar / Salah' : escapeHtml(qType)}</p>`;

        if (q.images && Array.isArray(q.images) && q.images.length > 0) {
            content += '<div class="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">';
            q.images.forEach((img, imgIdx) => {
                const imgSrc = typeof img === 'string' ? img : (img.data || '');
                content += `<div class="relative">
                            <img src="${imgSrc}" alt="Gambar soal ${imgIdx + 1}" class="w-full h-auto rounded-lg border border-slate-300 shadow-sm">
                            <span class="absolute top-2 right-2 bg-sky-600 text-white text-xs font-bold px-2 py-1 rounded">${imgIdx + 1}</span>
                        </div>`;
            });
            content += '</div>';
        } else if (q.image) {
            // Backward compatibility for single image
            const imgSrcSingle = typeof q.image === 'string' ? q.image : (q.image.data || '');
            content += `<img src="${imgSrcSingle}" alt="Gambar soal" class="mb-4 max-w-full h-auto rounded-lg border border-slate-300 shadow-sm">`;
        }

        // Display options and answers
        const qOptions = Array.isArray(q.options) ? q.options : [];

        if (qType === 'single' || qType === 'multiple') {
            content += '<div class="space-y-2 mt-4">';
            qOptions.forEach((opt, optIdx) => {
                let isStudentAnswer = false;
                let isCorrectAnswer = false;

                if (qType === 'single') {
                    isStudentAnswer = studentAnswer === optIdx;
                    isCorrectAnswer = correctAnswer === optIdx;
                } else if (qType === 'multiple') {
                    isStudentAnswer = Array.isArray(studentAnswer) && studentAnswer.includes(optIdx);
                    isCorrectAnswer = Array.isArray(correctAnswer) && correctAnswer.includes(optIdx);
                }

                let className = 'p-3 rounded-xl text-sm font-medium transition-all border-2 ';
                let icon = '';

                if (isCorrectAnswer && isStudentAnswer) {
                    className += 'bg-emerald-50 text-emerald-900 border-emerald-400 shadow-sm';
                    icon = '<i class="fas fa-check-circle text-emerald-600 mr-2"></i>';
                } else if (isCorrectAnswer && !isStudentAnswer) {
                    className += 'bg-emerald-50 text-emerald-900 border-emerald-400 shadow-sm';
                    icon = '<i class="fas fa-lightbulb text-emerald-600 mr-2"></i>';
                } else if (isStudentAnswer) {
                    className += 'bg-red-50 text-red-900 border-red-400 shadow-sm';
                    icon = '<i class="fas fa-times-circle text-red-600 mr-2"></i>';
                } else {
                    className += 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50';
                    icon = '';
                }

                content += `<div class="${className}">${icon}<span class="font-bold">${String.fromCharCode(65 + optIdx)}.</span> ${opt}</div>`;
            });
            content += '</div>';
        } else if (qType === 'text') {
            const studentText = studentAnswer || '';
            const correctText = correctAnswer || '';
            const manualScore = result.manualScores ? result.manualScores[i] : undefined;
            const aiFeedback = result.aiEssayFeedback ? result.aiEssayFeedback[i] : '';
            const scoreValue = (manualScore !== undefined && manualScore !== null) ? Number(manualScore).toFixed(1) : '';
            const panelClass = (manualScore !== undefined && manualScore !== null) ? 'border-violet-300 bg-violet-50' : 'border-dashed border-violet-200 bg-violet-50/40';
            content += `<div class="space-y-3 mt-4">
                        <div class="bg-white border-2 border-slate-200 rounded-xl p-4">
                            <p class="text-xs font-black text-slate-400 uppercase tracking-wider mb-2">Jawaban Siswa:</p>
                            <p class="text-slate-800 leading-relaxed whitespace-pre-wrap border-l-4 border-sky-400 pl-3">${escapeHtml(studentText) || '<em class="text-slate-400">Tidak dijawab</em>'}</p>
                        </div>
                        <div class="bg-emerald-50 border-2 border-emerald-300 rounded-xl p-4">
                            <p class="text-xs font-black text-emerald-600 uppercase tracking-wider mb-2">Kunci Jawaban:</p>
                            <p class="text-emerald-900 leading-relaxed whitespace-pre-wrap border-l-4 border-emerald-500 pl-3">${escapeHtml(correctText) || '<em class="text-emerald-500">Tidak ada kunci</em>'}</p>
                        </div>
                        <div class="rounded-xl border-2 ${panelClass} p-4">
                            <div class="flex items-center justify-between mb-2">
                                <p class="text-xs font-black text-violet-600 uppercase tracking-wider flex items-center gap-1"><i class="fas fa-robot"></i> Koreksi Esai</p>
                                ${scoreValue ? `<span class="inline-flex items-center gap-1 px-3 py-1 bg-violet-600 text-white rounded-full text-xs font-black"><i class="fas fa-star"></i> ${scoreValue} / 5</span>` : `<span class="text-xs text-violet-600 italic">Belum ada skor</span>`}
                            </div>
                            ${aiFeedback ? `<p class="text-slate-700 text-sm leading-relaxed italic mb-3">"${escapeHtml(aiFeedback)}"</p>` : ''}
                            <div class="flex items-center gap-2 flex-wrap mt-1">
                                <label class="text-xs text-slate-500 font-semibold">Ubah Skor Manual:</label>
                                <input type="number" id="ai-essay-score-input-${idx}-${i}" min="0" max="5" step="0.5" value="${scoreValue}" placeholder="0.0" class="w-20 border border-slate-300 rounded-lg px-2 py-1 text-sm font-bold text-center focus:outline-none focus:ring-2 focus:ring-violet-400">
                                <button onclick="applyEssayScore(${idx}, ${i}, document.getElementById('ai-essay-score-input-${idx}-${i}').value)" class="px-3 py-1 bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold rounded-lg transition-colors"><i class="fas fa-check mr-1"></i>Terapkan</button>
                            </div>
                            ${(!aiFeedback && !scoreValue) ? `<p class="text-xs text-violet-400 mt-2 italic">Belum dikoreksi AI. Anda dapat langsung memberi nilai manual atau gunakan tombol "Koreksi AI" di tabel hasil ujian.</p>` : ''}
                        </div>
                    </div>`;

        } else if (qType === 'tf') {
            content += '<div class="space-y-2 mt-4">';
            qOptions.forEach((opt, optIdx) => {
                const studentAns = Array.isArray(studentAnswer) ? studentAnswer[optIdx] : null;
                const correctAns = Array.isArray(correctAnswer) ? correctAnswer[optIdx] : null;
                const isCorrect = studentAns === correctAns;
                const studentText = studentAns === true ? 'Benar' : studentAns === false ? 'Salah' : 'Tidak dijawab';
                const correctText = correctAns === true ? 'Benar' : correctAns === false ? 'Salah' : 'N/A';

                let className = 'p-4 rounded-xl text-sm font-medium border-2 transition-all ';
                let icon = '';

                if (isCorrect) {
                    className += 'bg-emerald-50 text-emerald-900 border-emerald-400 shadow-sm';
                    icon = '<i class="fas fa-check-circle text-emerald-600 mr-2"></i>';
                } else {
                    className += 'bg-red-50 text-red-900 border-red-400 shadow-sm';
                    icon = '<i class="fas fa-times-circle text-red-600 mr-2"></i>';
                }

                content += `<div class="${className}">
                            ${icon}
                            <div class="flex justify-between items-start">
                                <span class="flex-1">${opt}</span>
                                <div class="text-right ml-4">
                                    <div class="text-xs text-slate-500 mb-1">Siswa: <span class="font-bold">${studentText}</span></div>
                                    <div class="text-xs text-slate-500">Kunci: <span class="font-bold">${correctText}</span></div>
                                </div>
                            </div>
                        </div>`;
            });
            content += '</div>';
        } else if (qType === 'matching') {
            // Fallback: If questions/answers were not saved in result, try to find them in the bank
            let qSubQuestions = q.questions || [];
            let qSubAnswers = q.answers || [];

            if (qSubQuestions.length === 0) {
                // Use strict lookup: must match text AND mapel AND rombel AND type
                const originalQ = db.questions.find(orig =>
                    orig.type === 'matching' &&
                    orig.mapel === q.mapel &&
                    orig.rombel === q.rombel &&
                    (orig.text === q.text || (q.text && orig.text && orig.text.substring(0, 30) === q.text.substring(0, 30)))
                );
                if (originalQ) {
                    qSubQuestions = originalQ.questions || [];
                    qSubAnswers = originalQ.answers || [];
                }
            }

            content += '<div class="space-y-3 mt-4">';
            if (qSubQuestions.length === 0) {
                content += '<div class="p-4 bg-yellow-50 text-yellow-700 text-xs rounded-xl border border-yellow-200">Data pertanyaan menjodohkan tidak ditemukan.</div>';
            }
            qSubQuestions.forEach((subQ, qi) => {
                const rawAns = Array.isArray(studentAnswer) ? studentAnswer[qi] : null;
                // Answers are stored as strings after submitExam transform
                const sAns = (rawAns !== null && rawAns !== undefined) ? String(rawAns) : null;
                const cAns = Array.isArray(correctAnswer) ? correctAnswer[qi] : null;
                const isCorrect = sAns !== null && cAns !== null && sAns === String(cAns);
                const displayAns = sAns || '<em class="opacity-50">Tidak dijawab</em>';

                let className = 'p-4 rounded-2xl border-2 transition-all ';
                let icon = '';

                if (sAns === null) {
                    className += 'bg-slate-50 border-slate-200 text-slate-500 shadow-sm';
                    icon = '<i class="fas fa-minus-circle text-slate-400"></i>';
                } else if (isCorrect) {
                    className += 'bg-emerald-50 border-emerald-200 text-emerald-900 shadow-sm';
                    icon = '<i class="fas fa-check-circle text-emerald-500"></i>';
                } else {
                    className += 'bg-red-50 border-red-200 text-red-900 shadow-sm';
                    icon = '<i class="fas fa-times-circle text-red-500"></i>';
                }

                content += `
                        <div class="${className}">
                            <div class="flex items-center justify-between gap-4">
                                <div class="flex items-center gap-3 flex-1 min-w-0">
                                    <div class="w-8 h-8 rounded-lg bg-white/50 flex items-center justify-center text-xs font-bold border border-current/10 flex-shrink-0">${qi + 1}</div>
                                    <div class="truncate font-semibold">${subQ}</div>
                                </div>
                                <div class="text-right ml-4">
                                    <div class="text-xs text-slate-500 mb-1">Siswa: <span class="font-bold">${studentText}</span></div>
                                    <div class="text-xs text-slate-500">Kunci: <span class="font-bold">${correctText}</span></div>
                                </div>
                                <div class="text-lg">${icon}</div>
                            </div>
                        </div>`;
            });
            content += '</div>';
        } else {
            content += `<div class="bg-yellow-50 border border-yellow-300 rounded-xl p-4 text-yellow-800 text-sm">
                        <i class="fas fa-exclamation-triangle mr-2"></i>
                        Tipe soal tidak dikenali: ${escapeHtml(qType)}
                    </div>`;
        }

        content += '</div>';
    });

    // Create modal
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50 backdrop-blur-sm';
    modal.innerHTML = `
                <div class="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto animate-fade-in">
                    <div class="flex justify-between items-center p-8 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white sticky top-0">
                        <h2 class="text-2xl font-black text-slate-800">Detail Jawaban Ujian</h2>
                        <button onclick="this.closest('.fixed').remove()" class="text-slate-400 hover:text-slate-600 text-2xl transition-colors">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="p-8">
                        ${content}
                    </div>
                </div>
            `;
    document.body.appendChild(modal);
}

async function batchAiCorrectEssay(resultIdx) {
    const result = db.results[resultIdx];
    if (!result) return;

    const questions = result.questions || [];
    const answers = result.answers || [];

    // Collect uncorrected essay question indices
    const essayIndices = questions.reduce((acc, q, i) => {
        if (q.type === 'text' &&
            (!result.manualScores || result.manualScores[i] === undefined || result.manualScores[i] === null) &&
            (!result.aiEssayFeedback || result.aiEssayFeedback[i] === undefined || result.aiEssayFeedback[i] === null)
        ) {
            acc.push(i);
        }
        return acc;
    }, []);

    if (essayIndices.length === 0) {
        alert('Semua soal esai untuk siswa ini sudah pernah dikoreksi AI/Manual.');
        return;
    }

    // Show progress overlay
    const overlay = document.createElement('div');
    overlay.id = 'ai-batch-overlay';
    overlay.className = 'fixed inset-0 bg-slate-900/70 flex items-center justify-center z-50 backdrop-blur-sm';
    overlay.innerHTML = `
                <div class="bg-white rounded-3xl shadow-2xl p-8 max-w-sm w-full mx-4 text-center">
                    <div class="w-16 h-16 bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                        <i class="fas fa-robot text-white text-2xl"></i>
                    </div>
                    <h3 class="text-lg font-black text-slate-800 mb-1">AI Sedang Mengoreksi</h3>
                    <p id="ai-batch-status" class="text-slate-500 text-sm mb-4">Memproses soal esai...</p>
                    <div class="w-full bg-slate-100 rounded-full h-3 mb-2">
                        <div id="ai-batch-progress" class="h-3 bg-gradient-to-r from-violet-500 to-purple-500 rounded-full transition-all duration-500" style="width: 0%"></div>
                    </div>
                    <p id="ai-batch-counter" class="text-xs text-slate-400 font-semibold">0 / ${essayIndices.length} soal</p>
                </div>`;
    document.body.appendChild(overlay);

    const statusEl = document.getElementById('ai-batch-status');
    const progressEl = document.getElementById('ai-batch-progress');
    const counterEl = document.getElementById('ai-batch-counter');

    const btn = document.getElementById(`ai-batch-btn-${resultIdx}`);
    if (btn) btn.disabled = true;

    let successCount = 0;
    let errorCount = 0;

    if (!result.manualScores) result.manualScores = {};
    if (!result.aiEssayFeedback) result.aiEssayFeedback = {};

    for (let idx = 0; idx < essayIndices.length; idx++) {
        const qi = essayIndices[idx];
        const q = questions[qi];
        const studentAnswer = answers[qi];

        if (statusEl) statusEl.textContent = `Mengoreksi soal ${idx + 1} dari ${essayIndices.length}...`;
        if (progressEl) progressEl.style.width = `${((idx) / essayIndices.length) * 100}%`;
        if (counterEl) counterEl.textContent = `${idx} / ${essayIndices.length} soal selesai`;

        try {
            const response = await fetch(getApiBaseUrl() + '/api/ai-correct-essay', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    questionText: q.text || '',
                    studentAnswer: typeof studentAnswer === 'string' ? studentAnswer : '',
                    referenceAnswer: q.correct || '',
                    teacherId: currentSiswa ? currentSiswa.id : null
                })
            });
            const data = await response.json();
            if (response.ok && data.ok) {
                result.manualScores[qi] = data.score;
                result.aiEssayFeedback[qi] = data.feedback;
                successCount++;
            } else {
                errorCount++;
            }
        } catch (e) {
            console.error(`[batchAiCorrect] Error on question ${qi}:`, e.message);
            errorCount++;
        }
    }

    // Final progress
    if (progressEl) progressEl.style.width = '100%';
    if (counterEl) counterEl.textContent = `${essayIndices.length} / ${essayIndices.length} soal selesai`;
    if (statusEl) statusEl.textContent = 'Menghitung ulang skor...';

    // Recalculate total score
    let totalItems = 0;
    let correctCount = 0;
    questions.forEach((q, i) => {
        const ans = answers[i];
        const qType = q.type || 'single';
        if (qType === 'text') {
            const essayScore = (result.manualScores[i] !== undefined && result.manualScores[i] !== null) ? result.manualScores[i] : 0;
            totalItems += 5;
            correctCount += essayScore;
        } else if (qType === 'tf' && Array.isArray(q.options)) {
            const ansArr = Array.isArray(ans) ? ans : [];
            q.options.forEach((_, j) => {
                totalItems++;
                const corrVal = Array.isArray(q.correct) ? q.correct[j] : false;
                if (ansArr[j] === corrVal) correctCount++;
            });
        } else if (qType === 'multiple') {
            const corr = Array.isArray(q.correct) ? q.correct : [];
            const ansArr = Array.isArray(ans) ? ans : [];
            const totalCorrectOpts = corr.length > 0 ? corr.length : 1;
            totalItems += totalCorrectOpts;
            correctCount += ansArr.filter(idx2 => corr.includes(idx2)).length;
        } else if (qType === 'matching') {
            const ansArr = Array.isArray(ans) ? ans : [];
            const corrArr = Array.isArray(q.correct) ? q.correct : [];
            if (Array.isArray(q.questions)) {
                q.questions.forEach((_, qi2) => {
                    totalItems++;
                    const a = ansArr[qi2];
                    const c = corrArr[qi2];
                    if (a !== null && a !== undefined && c !== null && c !== undefined && String(a) === String(c)) correctCount++;
                });
            } else {
                totalItems++;
            }
        } else {
            totalItems++;
            if (ans === q.correct) correctCount++;
        }
    });

    const newScore = totalItems > 0 ? ((correctCount / totalItems) * 100).toFixed(1) : '0.0';
    result.score = newScore;
    result.updatedAt = Date.now();
    db.results[resultIdx] = result;

    // Save and close overlay
    try {
        await save();
    } catch (e) {
        alert('Gagal menyimpan skor: ' + e.message);
    }

    overlay.remove();
    if (btn) btn.disabled = false;

    // Refresh the active dashboard
    const adminDash = document.getElementById('admin-dashboard');
    const teacherDash = document.getElementById('teacher-dashboard');
    if (adminDash && !adminDash.classList.contains('hidden')) {
        renderAdminResults();
    } else if (teacherDash && !teacherDash.classList.contains('hidden')) {
        renderTeacherResults();
    }

    const msg = errorCount === 0
        ? `✅ Semua ${successCount} soal esai berhasil dikoreksi AI!\nSkor baru: ${newScore}`
        : `⚠️ ${successCount} soal berhasil, ${errorCount} soal gagal.\nSkor baru: ${newScore}`;
    alert(msg);
}

async function runAiCorrection(resultIdx, qIdx) {
    const result = db.results[resultIdx];
    if (!result) return;
    const q = (result.questions || [])[qIdx];
    const studentAnswer = (result.answers || [])[qIdx];

    const btnEl = document.getElementById(`ai-essay-btn-${resultIdx}-${qIdx}`);
    const loadingEl = document.getElementById(`ai-essay-loading-${resultIdx}-${qIdx}`);
    const resultEl = document.getElementById(`ai-essay-result-${resultIdx}-${qIdx}`);
    const panelEl = document.getElementById(`ai-essay-panel-${resultIdx}-${qIdx}`);

    if (btnEl) btnEl.disabled = true;
    if (loadingEl) { loadingEl.classList.remove('hidden'); loadingEl.style.display = 'flex'; }

    try {
        const response = await fetch(getApiBaseUrl() + '/api/ai-correct-essay', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                questionText: q ? q.text : '',
                studentAnswer: typeof studentAnswer === 'string' ? studentAnswer : '',
                referenceAnswer: q ? (q.correct || '') : '',
                teacherId: currentSiswa ? currentSiswa.id : null
            })
        });

        const data = await response.json();
        if (!response.ok || !data.ok) {
            alert('Gagal koreksi AI: ' + (data.error || 'Terjadi kesalahan.'));
            return;
        }

        const score = data.score;
        const feedback = data.feedback;

        // Display result in UI
        if (resultEl) {
            resultEl.innerHTML = `
                        <p class="text-slate-700 text-sm leading-relaxed mb-3 italic">"${feedback.replace(/</g, '&lt;').replace(/>/g, '&gt;')}"</p>
                        <div class="flex items-center gap-2 flex-wrap">
                            <label class="text-xs text-slate-500 font-semibold">Skor AI: <strong class="text-violet-700">${score.toFixed(1)}/5</strong> &nbsp;|&nbsp; Ubah:</label>
                            <input type="number" id="ai-essay-score-input-${resultIdx}-${qIdx}" min="0" max="5" step="0.5" value="${score.toFixed(1)}" placeholder="0.0" class="w-20 border border-slate-300 rounded-lg px-2 py-1 text-sm font-bold text-center focus:outline-none focus:ring-2 focus:ring-violet-400">
                            <button onclick="applyEssayScore(${resultIdx}, ${qIdx}, document.getElementById('ai-essay-score-input-${resultIdx}-${qIdx}').value)" class="px-3 py-1 bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold rounded-lg transition-colors"><i class="fas fa-check mr-1"></i>Terapkan</button>
                        </div>`;
            resultEl.classList.remove('hidden');
        }

        // Update panel badge
        if (panelEl) {
            panelEl.classList.remove('border-slate-200');
            panelEl.classList.add('border-violet-300', 'bg-violet-50');
            const badgeContainer = panelEl.querySelector('.flex.items-center.justify-between');
            if (badgeContainer) {
                const existingBadge = badgeContainer.querySelector('span');
                if (existingBadge) existingBadge.remove();
                const badge = document.createElement('span');
                badge.className = 'inline-flex items-center gap-1 px-3 py-1 bg-violet-500 text-white rounded-full text-xs font-black';
                badge.innerHTML = `<i class="fas fa-star"></i> Skor AI: ${score.toFixed(1)} / 5`;
                badgeContainer.appendChild(badge);
            }
        }

        if (btnEl) btnEl.textContent = '✦ Koreksi Ulang dengan AI';

    } catch (e) {
        alert('Error: ' + e.message);
    } finally {
        if (loadingEl) { loadingEl.classList.add('hidden'); loadingEl.style.display = ''; }
        if (btnEl) btnEl.disabled = false;
    }
}

async function applyEssayScore(resultIdx, qIdx, rawScore) {
    const result = db.results[resultIdx];
    if (!result) return;

    const score = Math.min(5, Math.max(0, parseFloat(rawScore) || 0));

    // Save manual score and feedback
    if (!result.manualScores) result.manualScores = {};
    result.manualScores[qIdx] = score;

    // Also persist AI feedback if available
    const feedbackEl = document.getElementById(`ai-essay-result-${resultIdx}-${qIdx}`)?.querySelector('p.italic');
    if (feedbackEl) {
        if (!result.aiEssayFeedback) result.aiEssayFeedback = {};
        result.aiEssayFeedback[qIdx] = feedbackEl.textContent.replace(/^"|"$/g, '');
    }

    // Recalculate total score
    // Essay questions get a weight of 5 (max). Others use the existing per-item scoring.
    const questions = result.questions || [];
    const answers = result.answers || [];
    let totalItems = 0;
    let correctCount = 0;

    questions.forEach((q, i) => {
        const ans = answers[i];
        const qType = q.type || 'single';

        if (qType === 'text') {
            // Essay contributes 5 points max
            const essayScore = (result.manualScores && result.manualScores[i] !== undefined && result.manualScores[i] !== null)
                ? result.manualScores[i]
                : 0;
            totalItems += 5;
            correctCount += essayScore;
        } else if (qType === 'tf' && Array.isArray(q.options)) {
            const ansArr = Array.isArray(ans) ? ans : [];
            q.options.forEach((_, j) => {
                totalItems++;
                const corrVal = Array.isArray(q.correct) ? q.correct[j] : false;
                if (ansArr[j] === corrVal) correctCount++;
            });
        } else if (qType === 'multiple') {
            const corr = Array.isArray(q.correct) ? q.correct : [];
            const ansArr = Array.isArray(ans) ? ans : [];
            const totalCorrectOpts = corr.length > 0 ? corr.length : 1;
            totalItems += totalCorrectOpts;
            correctCount += ansArr.filter(idx => corr.includes(idx)).length;
        } else if (qType === 'matching') {
            const ansArr = Array.isArray(ans) ? ans : [];
            const corrArr = Array.isArray(q.correct) ? q.correct : [];
            if (Array.isArray(q.questions)) {
                q.questions.forEach((_, qi) => {
                    totalItems++;
                    const a = ansArr[qi];
                    const c = corrArr[qi];
                    if (a !== null && a !== undefined && c !== null && c !== undefined && String(a) === String(c)) correctCount++;
                });
            } else {
                totalItems++;
            }
        } else {
            totalItems++;
            if (ans === q.correct) correctCount++;
        }
    });

    const newScore = totalItems > 0 ? ((correctCount / totalItems) * 100).toFixed(1) : '0.0';
    result.score = newScore;
    result.updatedAt = Date.now();

    // Update in db array
    db.results[resultIdx] = result;

    // Persist to backend
    try {
        await save();
        // Refresh score in modal badge
        const panelEl = document.getElementById(`ai-essay-panel-${resultIdx}-${qIdx}`);
        if (panelEl) {
            const badgeContainer = panelEl.querySelector('.flex.items-center.justify-between');
            if (badgeContainer) {
                const existingBadge = badgeContainer.querySelector('span');
                if (existingBadge) {
                    existingBadge.innerHTML = `<i class="fas fa-star"></i> Skor: ${score.toFixed(1)} / 5`;
                    existingBadge.className = 'inline-flex items-center gap-1 px-3 py-1 bg-violet-600 text-white rounded-full text-xs font-black';
                }
            }
        }
        // Refresh active results table
        const adminDash2 = document.getElementById('admin-dashboard');
        const teacherDash2 = document.getElementById('teacher-dashboard');
        if (adminDash2 && !adminDash2.classList.contains('hidden')) {
            renderAdminResults();
        } else if (teacherDash2 && !teacherDash2.classList.contains('hidden')) {
            renderTeacherResults();
        }
        alert(`✅ Skor esai berhasil diterapkan! Skor baru: ${score.toFixed(1)}/5 → Total ujian: ${newScore}`);

    } catch (e) {
        alert('Gagal menyimpan skor: ' + e.message);
    }
}

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
        const base = getApiBaseUrl ? getApiBaseUrl() : '';
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

function loadSchoolSettings() {
    let settings = {};

    if (db.schoolSettings && db.schoolSettings.name) {
        settings = normalizeSchoolSettings(db.schoolSettings);
    } else {
        try {
            const raw = localStorage.getItem(SCHOOL_SETTINGS_KEY);
            if (raw) settings = normalizeSchoolSettings(JSON.parse(raw));
        } catch (e) {
            console.warn('[loadSchoolSettings] Failed reading localStorage:', e.message);
        }
    }

    const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.value = val || '';
    };

    setVal('school-yayasan', settings.yayasan);
    setVal('school-name', settings.name);
    setVal('school-principal', settings.principal);
    setVal('school-principal-nip', settings.principalNip);
    setVal('school-address', settings.address);
    setVal('school-city', settings.kota);
    setVal('school-tahun', settings.tahun);
    setVal('school-semester', settings.semester || 'GANJIL');

    let logoUrl = settings.logoUrl;
    if (logoUrl === 'undefined' || logoUrl === 'null') logoUrl = '';

    let savedLogo = logoUrl || settings.logo || localStorage.getItem('cbt_school_logo');
    if (savedLogo && savedLogo !== 'undefined' && savedLogo !== 'null' && !savedLogo.startsWith('data:') && !savedLogo.startsWith('http') && savedLogo !== 'logo.png') {
        const base = getApiBaseUrl ? getApiBaseUrl() : '';
        if (base) savedLogo = base + (savedLogo.startsWith('/') ? savedLogo : '/' + savedLogo);
    }

    const logoPreview = document.getElementById('school-logo-preview');
    const logoPlaceholder = document.getElementById('school-logo-placeholder');
    if (savedLogo && logoPreview) {
        logoPreview.src = savedLogo;
        logoPreview.style.display = 'block';
        if (logoPlaceholder) logoPlaceholder.style.display = 'none';
    }
}
window.loadSchoolSettings = loadSchoolSettings;

function saveSchoolSettings() {
    const storedLogo = localStorage.getItem('cbt_school_logo') || '';
    let storedLogoUrl = localStorage.getItem('cbt_school_logo_url') || '';
    if (storedLogoUrl === 'undefined' || storedLogoUrl === 'null') storedLogoUrl = '';

    const previewEl = document.getElementById('school-logo-preview');
    const previewSrc = previewEl && previewEl.src ? previewEl.src : '';
    const logoBase64 = previewSrc.startsWith('data:') ? previewSrc : storedLogo;

    const settings = {
        yayasan: document.getElementById('school-yayasan')?.value.trim() || '',
        name: document.getElementById('school-name')?.value.trim() || '',
        principal: document.getElementById('school-principal')?.value.trim() || '',
        principalNip: document.getElementById('school-principal-nip')?.value.trim() || '',
        address: document.getElementById('school-address')?.value.trim() || '',
        kota: document.getElementById('school-city')?.value.trim() || '',
        tahun: document.getElementById('school-tahun')?.value.trim() || '',
        semester: document.getElementById('school-semester')?.value || 'GANJIL',
        logo: logoBase64,
        logoUrl: storedLogoUrl
    };

    if (!settings.name) {
        if (typeof showToast === 'function') showToast('Nama sekolah tidak boleh kosong!', 'error');
        return;
    }

    localStorage.setItem(SCHOOL_SETTINGS_KEY, JSON.stringify(settings));
    if (settings.logo && settings.logo.startsWith('data:')) {
        localStorage.setItem('cbt_school_logo', settings.logo);
    }

    if (!db.schoolSettings) db.schoolSettings = {};
    Object.assign(db.schoolSettings, settings);

    fetch(getApiBaseUrl() + '/api/school-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
    }).catch(e => console.warn('[SchoolSettings] Error:', e.message));

    renderSchoolIdentity(settings);
    if (typeof showToast === 'function') showToast('Identitas sekolah berhasil disimpan!', 'success');
}
window.saveSchoolSettings = saveSchoolSettings;

// Quill Rich Text Editor Helpers
window._quillQuestion = null;
window._quillAnswer = null;
window._quillQuizz = null;

// Global Anti-Cheat State

// Anti-Cheat Event Listeners

// Anti-Copy & Select

// Anti-Screenshot (PrintScreen)

// Fullscreen and Wake Lock Functions

// Enhanced fullscreen change detection

// Multiple event listeners for comprehensive fullscreen monitoring

// Additional checks for simulated fullscreen

// Detect focus loss (alt+tab, clicking outside window, etc.)

// Listen for page visibility changes

// Returns the base URL for API calls.

// Global helper to normalize image URLs

/**
 * Scans an HTML string for <img> tags and normalizes their src attributes
 * so they resolve correctly (especially local /images/ paths).
 */

// IndexedDB helpers - persistent storage with much larger quotas than
// localStorage.  We still write a timestamp into localStorage after a
// successful IDB write so that other tabs can be notified via the
// existing "storage" listener logic.

// read/write db via IDB, fallback to localStorage if IDB fails

// Track which large collections have been explicitly loaded from the server

/**
 * Ensures that a specific collection (questions, students, results) is loaded from the server.
 * Uses lazy loading to avoid pulling thousands of rows into memory unless needed.
 */

// helper used during initialization to merge results from two sources

// when another tab updates the storage we want to re-read the database.



// --- AUTH ---

// --- CORE FUNCTIONS ---




// push a single result object to the server (lightweight endpoint)


/**
         * Generic save function that pushes the current 'db' state to the server and IndexedDB.
         * @param {Object} options Configuration for the save operation.
         * @param {boolean} options.refreshBeforeSave If true, fetches latest data from server 
         *                                           and merges local changes before pushing.
         * @param {boolean} options.forceServerSave If true, pushes to server even if the user is a student.
         */




// Helpers for teacher subject/rombel management



// --- AUTH ---
// showLoginForm moved to top



// attach login button listener once DOM ready to avoid reference errors



// --- IMPORT SISWA (NEW FEATURE) ---


// parse Excel file to textarea for import

// --- STUDENT MANAGEMENT ---







// --- TEACHER QUESTION MANAGEMENT ---





// ─── Manajemen Nilai Logic ───────────────────────────────────────────────────











// Render teacher exam results filtered by subject and rombel


// --- SCHEDULE MANAGEMENT ---

// --- TEACHER MANAGEMENT ---








// --- TEACHER QUESTION MANAGEMENT ---



// Update visual style of a single rombel label row

// Update header badge, description, icon, and card border based on current checked state

// Called when a single rombel checkbox changes

// Called when "Pilih Semua" checkbox changes





// --- UI HELPERS ---






















// toggle mobile menu visibility





// --- QUESTION MANAGEMENT ---









































// --- WORD IMPORT HANDLER ---

// --- RESULTS & CONFIG ---

// --- EXPLICIT SAVE / LOAD DB (admin actions) ---



// --- SCHOOL SETTINGS ---


// Helper: get current school settings (for use in other parts)

// --- SUBJECT LOCK MANAGEMENT ---


// --- RESULTS & CONFIG ---















// --- STUDENT EXAM LOGIC ---

// examData keeps track of current exam state. answers array holds either
// - a single index for single-choice questions
// - an array of indices for multiple-choice questions
// - a string for text/complex questions

























// --- IMAGE ZOOM FUNCTIONALITY ---






// --- AI QUESTION GENERATION ---
















window.editRaportScore = async function(studentId, mapel) {
    // Find all matching results
    const results = (db.results || []).filter(r => !r.deleted && r.studentId === studentId && r.mapel === mapel);
    if (!results.length) {
        Swal.fire('Error', 'Data hasil tidak ditemukan.', 'error');
        return;
    }

    // Sort to pick the latest result (same logic as consolidatedMap in renderRaport)
    results.sort((a, b) => new Date(b.date) - new Date(a.date));
    const result = results[0];

    const { value: newScore } = await Swal.fire({
        title: 'Edit Nilai Raport',
        text: `Mata Pelajaran: ${mapel}`,
        input: 'number',
        inputValue: Number(result.score).toFixed(1),

        inputAttributes: {
            min: 0,
            max: 100,
            step: 0.1
        },
        showCancelButton: true,
        confirmButtonText: 'Simpan',
        cancelButtonText: 'Batal',
        confirmButtonColor: '#f59e0b'
    });

    if (newScore !== undefined && newScore !== null && newScore !== '') {
        const idx = db.results.indexOf(result);
        db.results[idx].score = parseFloat(newScore);
        db.results[idx].updatedAt = Date.now();
        
        await save();
        renderRaport();
        
        Swal.fire({
            icon: 'success',
            title: 'Nilai Diperbarui',
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 2000
        });
    }
}

window.deleteRaportEntry = async function(studentId, mapel) {
    const results = (db.results || []).filter(r => !r.deleted && r.studentId === studentId && r.mapel === mapel);
    if (!results.length) {
        Swal.fire('Error', 'Data hasil tidak ditemukan.', 'error');
        return;
    }

    results.sort((a, b) => new Date(b.date) - new Date(a.date));
    const result = results[0];

    const confirmation = await Swal.fire({
        title: 'Hapus Nilai Raport?',
        text: `Anda akan menghapus nilai "${mapel}" untuk siswa ini. Tindakan ini tidak dapat dibatalkan.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#94a3b8',
        confirmButtonText: 'Ya, Hapus!',
        cancelButtonText: 'Batal'
    });

    if (confirmation.isConfirmed) {
        const idx = db.results.indexOf(result);
        db.results[idx].deleted = true;
        db.results[idx].updatedAt = Date.now();
        
        await save();
        renderRaport();
        
        Swal.fire({
            icon: 'success',
            title: 'Data dihapus',
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 2000
        });
    }
}

// --- KISI-KISI AI FUNCTIONALITY ---










// Toggle dropdown functions


// --- API KEY MANAGEMENT FUNCTIONS ---


// ─── Real-time API Keys Stats Polling ─────────────────────────────


// ─── Live Progress Polling ─────────────────────────────────────────







// Make function globally accessible
function removeTeacherAPIKey(index) { console.warn('removeTeacherAPIKey is not fully implemented in this module'); }
window.removeTeacherAPIKey = removeTeacherAPIKey;

// Stub helper functions for API key management
function toggleGlobalAPIKeysList() { console.warn('toggleGlobalAPIKeysList is not fully implemented in this module'); }

// Make function globally accessible
window.toggleGlobalAPIKeysList = toggleGlobalAPIKeysList;



window.addGlobalApiKey = async function () {
    const apiKey = document.getElementById('new-api-key').value.trim();
    if (!apiKey) return showToast('API Key harus diisi', 'error');

    // Auto-detect provider based on API key format
    let detectedProvider = 'OpenAI'; // Default fallback
    if (apiKey.startsWith('AIzaSy')) {
        detectedProvider = 'Gemini';
    } else if (apiKey.startsWith('sk-')) {
        detectedProvider = 'OpenAI';
    } else if (apiKey.startsWith('sk-or-v1-') || apiKey.startsWith('sk-or-')) {
        detectedProvider = 'OpenRouter';
    } else if (apiKey.startsWith('gsk_')) {
        detectedProvider = 'Groq';
    } else if (apiKey.startsWith('sk-') && apiKey.includes('deepseek')) {
        detectedProvider = 'DeepSeek';
    }

    try {
        const response = await fetch(getApiBaseUrl() + '/api/admin/add-global-key', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ provider: detectedProvider, apiKey, note: '' })
        });

        const result = await response.json();

        if (result.ok) {
            showToast(`Global API Key berhasil ditambahkan (${detectedProvider})`, 'success');
            document.getElementById('new-api-key').value = '';
            renderApiKeysList(); // Refresh list
            updateStats(); // Update stats
        } else {
            showToast(result.error || 'Gagal menambahkan key', 'error');
        }
    } catch (err) {
        showToast('Error: ' + err.message, 'error');
    }
};

// --- INIT ---
window.addEventListener('load', async () => {
    // Fallback: Hide loading overlay after 3 seconds regardless
    setTimeout(() => {
        const overlay = document.getElementById('loading-overlay');
        if (overlay && !overlay.classList.contains('hidden')) {
            overlay.classList.add('hidden');
            overlay.classList.remove('flex');
        }
    }, 2000);

    try {
        await init();
        console.log('App initialized, db has', db.students ? db.students.length : 0, 'students');
        const typeSel = document.getElementById('q-type');
        if (typeSel && typeof onQuestionTypeChange === 'function') typeSel.addEventListener('change', onQuestionTypeChange);

        // Close import/export dropdowns when clicking outside their controls
        document.addEventListener('click', (e) => {
            const importDropdown = document.getElementById('import-dropdown');
            const exportDropdown = document.getElementById('export-dropdown');

            if (!importDropdown || !exportDropdown) return;

            const clickedImportToggle = e.target.closest('[onclick="toggleImportDropdown()"]');
            const clickedExportToggle = e.target.closest('[onclick="toggleExportDropdown()"]');
            const clickedImportDropdown = e.target.closest('#import-dropdown');
            const clickedExportDropdown = e.target.closest('#export-dropdown');

            if (!clickedImportToggle && !clickedExportToggle && !clickedImportDropdown && !clickedExportDropdown) {
                importDropdown.classList.add('hidden');
                exportDropdown.classList.add('hidden');
            }
        });

        // Handle hash-based tab switching for guru.html
        if (window.location.pathname.endsWith('guru.html') && window.location.hash) {
            const tabName = window.location.hash.substring(1);
            if (typeof switchTeacherTab === 'function') {
                setTimeout(() => switchTeacherTab(tabName), 500);
            }
        }

        // Hide loading overlay after initialization
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.classList.add('hidden');
            overlay.classList.remove('flex');
        }
    } catch (error) {
        console.error('Initialization error:', error);
        // Hide loading overlay even if init fails
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.classList.add('hidden');
            overlay.classList.remove('flex');
        }
    }

    // Add keyboard support for zoom modal
    document.addEventListener('keydown', function (e) {
        const modal = document.getElementById('image-zoom-modal');
        if (!modal || modal.classList.contains('hidden')) return;

        if (e.key === 'Escape') {
            if (typeof closeImageZoom === 'function') closeImageZoom();
        } else if (e.key === 'ArrowRight') {
            if (typeof nextZoomImage === 'function') nextZoomImage();
            e.preventDefault();
        } else if (e.key === 'ArrowLeft') {
            if (typeof previousZoomImage === 'function') previousZoomImage();
            e.preventDefault();
        }
    });
});




/* ==================== FILE: js/core/db-sync.js ==================== */
/**
 * js/core/db-sync.js
 * Part of CBT application refactored module
 */

const IDB_DB_NAME = 'DORKAS_EXAM_STORAGE';

const IDB_STORE = 'store';

function openIdb() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(IDB_DB_NAME, 1);
        req.onupgradeneeded = e => {
            e.target.result.createObjectStore(IDB_STORE);
        };
        req.onsuccess = e => resolve(e.target.result);
        req.onerror = e => reject(e.target.error);
    });
}

async function idbGet(key) {
    const idb = await openIdb();
    return new Promise((res, rej) => {
        const tx = idb.transaction(IDB_STORE, 'readonly');
        const store = tx.objectStore(IDB_STORE);
        const r = store.get(key);
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
    });
}

async function idbSet(key, value) {
    const idb = await openIdb();
    return new Promise((res, rej) => {
        const tx = idb.transaction(IDB_STORE, 'readwrite');
        const store = tx.objectStore(IDB_STORE);
        const r = store.put(value, key);
        r.onsuccess = () => res();
        r.onerror = () => rej(r.error);
    });
}

async function loadLocalDb() {
    try {
        const raw = await idbGet(DB_KEY);
        if (raw) {
            const loaded = typeof raw === 'string' ? JSON.parse(raw) : raw;
            console.log('[loadLocalDb] Loaded from IDB, activeExams count:', loaded.activeExams?.length || 0);
            return loaded;
        }
    } catch (e) {
        console.warn('[loadLocalDb] IDB load failed:', e.message || e);
    }
    try {
        const saved = localStorage.getItem(DB_KEY);
        if (saved) {
            const loaded = JSON.parse(saved);
            console.log('[loadLocalDb] Loaded from localStorage, activeExams count:', loaded.activeExams?.length || 0);
            return loaded;
        }
    } catch (e) {
        console.warn('[loadLocalDb] Failed to read from localStorage:', e.message);
    }
    console.warn('[loadLocalDb] No data found in IDB or localStorage');
    return null;
}

async function saveLocalDb() {
    try {
        const dbStr = JSON.stringify(db);
        console.log('[saveLocalDb] Saving db to IDB, activeExams count:', db.activeExams?.length || 0, 'size:', dbStr.length, 'bytes');
        await idbSet(DB_KEY, dbStr);
        console.log('[saveLocalDb] Save to IDB successful');
    } catch (e) {
        console.warn('[saveLocalDb] IDB save failed:', e.message || e);
    }
    try {
        localStorage.setItem(DB_KEY, JSON.stringify(db));
        console.log('[saveLocalDb] Updated localStorage snapshot');
    } catch (e) {
        console.warn('[saveLocalDb] localStorage update failed:', e.message);
    }
}

function normalizeDb(d, existing = {}) {
    if (!d || typeof d !== 'object') d = {};

    // PRIORITY: If server sent students data (d.students), use it directly — do NOT overwrite with local cache.
    // Only fallback to local cache (existing.students) if server sent nothing (undefined/null).
    let normalizedStudents;
    if (Array.isArray(d.students) && d.students.length > 0) {
        // Server has data → always trust server
        normalizedStudents = d.students.slice();
    } else if (d.students === undefined || d.students === null) {
        // Server did not include students field → use local cache
        normalizedStudents = Array.isArray(existing.students) ? existing.students.slice() : [];
    } else {
        // Server explicitly sent empty array → use local cache as fallback
        normalizedStudents = Array.isArray(existing.students) && existing.students.length > 0
            ? existing.students.slice()
            : [];
    }

    if (normalizedStudents.length === 0) {
        normalizedStudents.push({ id: 'ADM', password: 'admin321', name: 'Administrator', role: 'admin' });
    }
    if (!normalizedStudents.some(s => s.role === 'admin')) {
        normalizedStudents.unshift({ id: 'ADM', password: 'admin321', name: 'Administrator', role: 'admin' });
    }

    return {
        subjects: Array.isArray(d.subjects) ? d.subjects : (existing.subjects || []),
        rombels: Array.isArray(d.rombels) ? d.rombels : (existing.rombels || []),
        questions: Array.isArray(d.questions) ? d.questions : (existing.questions || []),
        quizzes: Array.isArray(d.quizzes) ? d.quizzes : (existing.quizzes || []),
        students: normalizedStudents,
        results: Array.isArray(d.results) ? d.results : (existing.results || []),
        schedules: Array.isArray(d.schedules) ? d.schedules : (existing.schedules || []),
        activeExams: Array.isArray(d.activeExams) ? d.activeExams : (existing.activeExams || []),
        timeLimits: d.timeLimits && typeof d.timeLimits === 'object' ? d.timeLimits : (existing.timeLimits || {}),
        jenisUjian: d.jenisUjian && typeof d.jenisUjian === 'object' ? d.jenisUjian : (existing.jenisUjian || {}),
        schoolSettings: d.schoolSettings && typeof d.schoolSettings === 'object' ? d.schoolSettings : (existing.schoolSettings || {})
    };

    // Ensure nested fields in schoolSettings are initialized if it exists
    if (res.schoolSettings) {
        res.schoolSettings = {
            yayasan: res.schoolSettings.yayasan || '',
            name: res.schoolSettings.name || '',
            principal: res.schoolSettings.principal || '',
            principalNip: res.schoolSettings.principalNip || '',
            address: res.schoolSettings.address || '',
            kota: res.schoolSettings.kota || ''
        };
    }
    return res;
}

function migrateRombels() {
    const legacyRombels = ['VII', 'VIII', 'IX'];
    const hasLegacy = db.rombels && db.rombels.some(r => legacyRombels.includes(r));

    if (hasLegacy) {
        console.log('[MIGRATION] Migrating rombels to Phase D format...');

        const mapping = {
            'VII': 'Fase D (Kelas 7)',
            'VIII': 'Fase D (Kelas 8)',
            'IX': 'Fase D (Kelas 9)'
        };

        // Update db.rombels
        db.rombels = db.rombels.map(r => mapping[r] || r);
        // Ensure unique and sorted
        db.rombels = [...new Set(db.rombels)];

        // Update questions
        db.questions.forEach(q => {
            if (mapping[q.rombel]) q.rombel = mapping[q.rombel];
        });

        // Update students
        db.students.forEach(s => {
            if (mapping[s.rombel]) s.rombel = mapping[s.rombel];
            if (s.role === 'teacher' && s.subjects) {
                s.subjects.forEach(subj => {
                    if (subj.rombels) {
                        subj.rombels = subj.rombels.map(r => mapping[r] || r);
                    }
                });
            }
            if (s.role === 'teacher' && s.rombels) {
                s.rombels = s.rombels.map(r => mapping[r] || r);
            }
        });

        // Update results
        db.results.forEach(r => {
            if (mapping[r.rombel]) r.rombel = mapping[r.rombel];
        });

        // Update schedules
        if (db.schedules) {
            db.schedules = db.schedules.map(k => {
                const parts = k.split('|');
                if (parts.length === 2 && mapping[parts[0]]) {
                    return `${mapping[parts[0]]}|${parts[1]}`;
                }
                return k;
            });
        }

        // Update timeLimits (keys are usually stored as lowercase)
        if (db.timeLimits) {
            const newLimits = {};
            for (const k in db.timeLimits) {
                let newKey = k;
                for (const oldR in mapping) {
                    if (k.toLowerCase().startsWith(oldR.toLowerCase() + '|')) {
                        const subjectPart = k.split('|')[1] || '';
                        newKey = (mapping[oldR] + '|' + subjectPart).toLowerCase().trim();
                        break;
                    }
                }
                newLimits[newKey] = db.timeLimits[k];
            }
            db.timeLimits = newLimits;
        }

        saveLocalDb();
        console.log('[MIGRATION] Rombel migration complete.');
    }
}

function migrateTeacherData() {
    db.students.forEach(s => {
        if (s.role === 'teacher' && Array.isArray(s.subjects) && s.subjects.length &&
            s.subjects.every(x => typeof x === 'string') && Array.isArray(s.rombels)) {
            const roms = s.rombels.slice();
            s.subjects = s.subjects.map(name => ({ name, rombels: roms.slice() }));
            // keep top-level rombels as union for compatibility
            // s.rombels = roms;
        }
    });
}

function migrateQuestionTypes() {
    if (!Array.isArray(db.questions)) return;
    let changed = false;
    const mapping = {
        // Benar/Salah variants
        'boolean': 'tf',
        'benar_salah': 'tf',
        'true_false': 'tf',
        'bs': 'tf',
        // Matching variants
        'jodohkan': 'matching',
        'pasangkan': 'matching',
        'pairing': 'matching',
        'match': 'matching',
        // Essay variants
        'essay': 'text',
        'isian': 'text',
        'uraian': 'text',
        // PG variants
        'pg': 'single',
        'pilihan_ganda': 'single',
        'multiple_choice': 'single'
    };

    db.questions.forEach(q => {
        const oldType = String(q.type || 'single').toLowerCase().trim();
        if (mapping[oldType]) {
            q.type = mapping[oldType];
            changed = true;
        }
    });

    if (changed) {
        saveLocalDb();
        console.log('[MIGRATION] Question types normalized.');
    }
}

async function syncUasFromCbt() {
    const mapel = document.getElementById('mn-filter-mapel').value;
    const rombel = document.getElementById('mn-filter-rombel').value;
    if (!mapel || !rombel) return alert('Pilih Mapel dan Rombel lebih dulu.');

    if (!confirm('Tarik nilai UAS dari hasil CBT yang ada? Nilai di kolom UAS saat ini akan ditimpa dengan hasil ujian terbaru.')) return;

    try {
        const res = await fetch(getApiBaseUrl() + `/api/results?mapel=${encodeURIComponent(mapel)}&rombel=${encodeURIComponent(rombel)}&limit=-1`);
        const resultsRaw = await res.json();
        const results = Array.isArray(resultsRaw) ? resultsRaw : (resultsRaw.items || []);

        let count = 0;
        let notFound = 0;
        document.querySelectorAll('#mn-table-body tr').forEach(tr => {
            const sid = String(tr.dataset.studentId || "").trim().toLowerCase();
            // Find result with multiple key variant support
            const r = results.find(x => {
                const rsid = String(x.studentId || x.student_id || x.id || "").trim().toLowerCase();
                return rsid === sid && !x.deleted;
            });

            if (r) {
                const uasInput = tr.querySelector('[data-field="uas"]');
                if (uasInput) {
                    uasInput.value = r.score;
                    calculateMnRow(uasInput);
                    count++;
                }
            } else {
                notFound++;
            }
        });

        if (count === 0) {
            if (confirm('Tidak ditemukan nilai UAS yang cocok dengan mata pelajaran ini. Ingin mencoba menarik nilai ujian terbaru lainnya (lintas mapel) di rombel ini?')) {
                const altRes = await fetch(getApiBaseUrl() + `/api/results?rombel=${encodeURIComponent(rombel)}&limit=200`);
                const altResultsRaw = await altRes.json();
                const altResults = Array.isArray(altResultsRaw) ? altResultsRaw : (altResultsRaw.items || []);

                let altCount = 0;
                document.querySelectorAll('#mn-table-body tr').forEach(tr => {
                    const sid = String(tr.dataset.studentId || "").trim().toLowerCase();
                    // Handle various possible key names for ID
                    const r = altResults.find(x => {
                        const rsid = String(x.studentId || x.student_id || x.id || "").trim().toLowerCase();
                        return rsid === sid && !x.deleted;
                    });
                    if (r) {
                        const uasInput = tr.querySelector('[data-field="uas"]');
                        if (uasInput) {
                            uasInput.value = r.score;
                            calculateMnRow(uasInput);
                            altCount++;
                        }
                    }
                });
                alert(`Berhasil menarik ${altCount} nilai dari ujian alternatif rombel ${rombel}.`);
            }
        } else {
            alert(`Berhasil menarik ${count} nilai UAS siswa.`);
        }
    } catch (e) {
        alert('Gagal menarik nilai: ' + e.message);
    }
}

async function syncTeacherAPIKeysFromServer() {
    if (!currentSiswa || currentSiswa.role !== 'teacher') return;

    try {
        const response = await fetch(getApiBaseUrl() + `/api/teacher/api-keys?teacherId=${encodeURIComponent(currentSiswa.id)}`);
        if (!response.ok) {
            console.warn('Failed to sync API keys from server:', response.status);
            return;
        }

        const result = await response.json();
        if (result.ok && Array.isArray(result.apiKeys)) {
            // Filter out global keys, only keep personal teacher keys strictly
            const personalKeys = result.apiKeys.filter(key =>
                !key.isGlobal &&
                (!key.addedAt || !key.addedAt.includes('System'))
            );
            // Update local currentSiswa with server data
            currentSiswa.apiKeys = personalKeys;
            save(); // Save to local storage
            console.log('Synced personal API keys from server:', personalKeys.length, 'keys');
        }
    } catch (e) {
        console.warn('Error syncing API keys from server:', e.message);
    }
}

async function syncGlobalAPIKeysFromServer() {
    try {
        // Refresh global API keys list by re-rendering
        if (typeof renderGlobalAPIKeys === 'function') {
            await renderGlobalAPIKeys();
        }
        console.log('Synced global API keys from server');
    } catch (e) {
        console.warn('Error syncing global API keys from server:', e.message);
    }
}

/**
 * Fetch live exam data from the server.
 * Used by syncAdminLiveState, student restore/command checks, and live monitoring polling.
 */
async function fetchLiveExamsFromServer() {
    try {
        const url = getApiBaseUrl() + '/api/live-exams?_t=' + Date.now();
        console.log('%c[fetchLiveExamsFromServer]', 'color: purple; font-weight: bold', 'GET', url, 'navigator.onLine:', navigator.onLine);
        const res = await fetch(url);
        if (!res.ok) {
            const text = await res.text();
            console.warn('[fetchLiveExamsFromServer] HTTP', res.status, ':', text);
            throw new Error(`Server responded ${res.status}`);
        }
        const data = await res.json();
        console.log('%c[fetchLiveExamsFromServer] ✅ Success:', 'color: purple', data?.length || 0, 'exams');
        if (data && data.length > 0) {
            console.log('  Data:', data.map(e => `${e.studentId}/${e.mapel}`));
        }
        return Array.isArray(data) ? data : [];
    } catch (err) {
        console.warn('%c[fetchLiveExamsFromServer] ❌ Error:', 'color: red', err.message);
        return [];
    }
}



/* ==================== FILE: js/core/ui-helpers.js ==================== */
/**
 * js/core/ui-helpers.js
 * Part of CBT application refactored module
 */

function switchTeacherTab(tab) {
    const tabs = ['bank-soal', 'hasil-ujian', 'manajemen-nilai', 'api-keys', 'live-progress', 'quizz'];
    tabs.forEach(t => {
        const tabDiv = document.getElementById(`teacher-tab-${t}`);
        const tabBtn = document.getElementById(`tab-${t}`);
        if (t === tab) {
            if (tabDiv) tabDiv.classList.remove('hidden');
            if (tabBtn) {
                tabBtn.classList.remove('text-slate-400', 'border-transparent');
                tabBtn.classList.add('text-slate-700', 'border-amber-600');
            }
        } else {
            if (tabDiv) tabDiv.classList.add('hidden');
            if (tabBtn) {
                tabBtn.classList.add('text-slate-400', 'border-transparent');
                tabBtn.classList.remove('text-slate-700', 'border-amber-600');
            }
        }
    });

    if (tab === 'hasil-ujian') {
        renderTeacherResults();
        // begin polling server for new results if in teacher results tab
        if (teacherResultsPollInterval) clearInterval(teacherResultsPollInterval);
        teacherResultsPollInterval = setInterval(fetchAndMerge, 5000);
        // Stop API keys polling if it was running
        stopRealtimeStatsPolling();
        if (typeof stopLiveProgressPolling === 'function') stopLiveProgressPolling();
    } else if (tab === 'live-progress') {
        if (teacherResultsPollInterval) {
            clearInterval(teacherResultsPollInterval);
            teacherResultsPollInterval = null;
        }
        stopRealtimeStatsPolling();
        if (typeof startLiveProgressPolling === 'function') startLiveProgressPolling();
        renderRombelSection(); // This will also update the progress list
    } else {
        if (teacherResultsPollInterval) {
            clearInterval(teacherResultsPollInterval);
            teacherResultsPollInterval = null;
        }
        if (typeof stopLiveProgressPolling === 'function') stopLiveProgressPolling();
        if (tab === 'quizz') {
            renderTeacherQuizz();
        } else if (tab === 'bank-soal') {
            // Clear search input to prevent browser autocomplete from persisting values
            const searchInput = document.getElementById('teacher-search-questions');
            if (searchInput) searchInput.value = '';
            renderTeacherQuestions();
            // Stop API keys polling if it was running
            stopRealtimeStatsPolling();
        } else if (tab === 'api-keys') {
            // Clear API key input to prevent browser autocomplete from persisting values
            const apiKeyInput = document.getElementById('new-api-key-input');
            if (apiKeyInput) apiKeyInput.value = '';
            renderTeacherAPIKeys();
            // Start real-time API keys stats polling
            startRealtimeStatsPolling();
        } else if (tab === 'manajemen-nilai') {
            loadMnWeights();
            renderManajemenNilaiFilters();
            renderManajemenNilai();
            stopRealtimeStatsPolling();
            if (typeof stopLiveProgressPolling === 'function') stopLiveProgressPolling();
        }
    }
}

function togglePasswordVisibility() {
    const pwInput = document.getElementById('password');
    const icon = document.getElementById('toggle-pw-icon');
    if (!pwInput || !icon) return;
    if (pwInput.type === 'password') {
        pwInput.type = 'text';
        icon.classList.replace('fa-eye', 'fa-eye-slash');
    } else {
        pwInput.type = 'password';
        icon.classList.replace('fa-eye-slash', 'fa-eye');
    }
}

function openTimeLimitModal() {
    renderTimeLimitList();
    document.getElementById('time-limit-modal').classList.replace('hidden', 'flex');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

async function saveDatabaseToServer() {
    try {
        await save({ forceServerSave: true });
        alert('Database berhasil disimpan ke server.');
    } catch (err) {
        alert('Error saat menyimpan ke server: ' + (err.message || err));
    }
}

async function loadDatabaseFromServer() {
    if (!confirm('Ambil database dari server akan menggantikan data saat ini. Lanjutkan?')) return;
    try {
        const res = await fetch(getApiBaseUrl() + '/api/db');
        if (!res.ok) throw new Error(res.statusText || res.status);
        const payload = await res.json();
        if (payload && typeof payload === 'object') {
            // compare result counts so we don't lose local-only data
            const localCount = Array.isArray(db.results) ? db.results.length : 0;
            const serverCount = Array.isArray(payload.results) ? payload.results.length : 0;
            if (serverCount < localCount) {
                const isAdmin = currentSiswa && currentSiswa.role === 'admin';
                const shouldMerge = isAdmin ?
                    confirm('Data server memiliki lebih sedikit hasil ujian daripada data lokal. Ingin menggabungkan keduanya? (Cancel berarti tetap menggunakan data lokal)') :
                    true; // Non-admin silently merges to preserve local work

                if (shouldMerge) {
                    db.results = mergeResults(db.results, payload.results);
                    db = { ...payload, results: db.results };
                }
            } else if (serverCount > localCount) {
                // merge to pick up any extra entries
                db.results = mergeResults(db.results, payload.results);
                db = { ...payload, results: db.results };
            } else {
                // same size, just merge to dedupe
                db.results = mergeResults(db.results, payload.results);
                db = { ...payload, results: db.results };
            }

            try { localStorage.setItem(DB_KEY, JSON.stringify(db)); } catch (e) { }
                    const seed = document.querySelector("button[onclick*='insertOptionSymbol(\'²\')']") || document.querySelector("button[onclick*=\"insertOptionSymbol('²')\"]");
            renderAdminStudents();
            renderAdminQuestions();
            renderAdminResults();
            alert('Database berhasil diambil dari server.');
        } else {
            throw new Error('Format data tidak valid');
        }
    } catch (err) {
        alert('Gagal mengambil database: ' + (err.message || err));
    }
}

function openConfigModal(type) {
    currentConfigType = type;
    document.getElementById('config-title').innerText = "Tambah " + (type === 'mapel' ? 'Mata Pelajaran' : 'Rombel');
    document.getElementById('config-modal').classList.replace('hidden', 'flex');
}

function exportDatabase() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(db));
    const dl = document.createElement('a');
    dl.setAttribute("href", dataStr);
    dl.setAttribute("download", `BACKUP_DORKAS_${new Date().toISOString().slice(0, 10)}.json`);
    dl.click();
}

function closeConfirmModal() {
    const modal = document.getElementById('confirm-finish-modal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}

function openAiModal() {
    const modal = document.getElementById('ai-modal');
    if (!modal) return;
    modal.classList.remove('hidden');
    modal.classList.add('flex');

    // Reset blueprint file and label
    const blueprintInput = document.getElementById('ai-blueprint-file');
    if (blueprintInput) blueprintInput.value = '';
    const label = document.getElementById('ai-materi-label');
    if (label) label.innerText = 'Materi / Topik Utama';

    const mapelSel = document.getElementById('ai-mapel');
    const rombelSel = document.getElementById('ai-rombel');

    if (mapelSel && db.subjects) {
        mapelSel.innerHTML = db.subjects.map(s => {
            const name = (typeof s === 'object') ? s.name : s;
            return `<option value="${name}">${name}</option>`;
        }).join('');
    }
    if (rombelSel && db.rombels) {
        rombelSel.innerHTML = db.rombels.map(r => `<option value="${r}">${r}</option>`).join('');
    }

    const targetSelectors = document.getElementById('ai-target-selectors');
    if (targetSelectors) targetSelectors.classList.remove('hidden');
    calculateAiHots();
}

function openTeacherAiModal() {
    openAiModal();
    if (window.currentTeacher && window.currentTeacher.subjects) {
        const mapelSel = document.getElementById('ai-mapel');
        const rombelSel = document.getElementById('ai-rombel');
        const subjects = window.currentTeacher.subjects;

        if (mapelSel && subjects.length > 0) {
            const uniqueMapels = [...new Set(subjects.map(s => s.mapel))];
            mapelSel.innerHTML = uniqueMapels.map(m => `<option value="${m}">${m}</option>`).join('');

            const updateTeacherAiRombel = () => {
                const selectedMapel = mapelSel.value;
                const relevantRombels = subjects.filter(s => s.mapel === selectedMapel).map(s => s.rombel);
                if (rombelSel) rombelSel.innerHTML = relevantRombels.map(r => `<option value="${r}">${r}</option>`).join('');
            };

            mapelSel.onchange = updateTeacherAiRombel;
            updateTeacherAiRombel();
        }
    }
}

function openKisiKisiModal() {
    const modal = document.getElementById('kisi-kisi-modal');
    if (!modal) return;
    modal.classList.remove('hidden');
    modal.classList.add('flex');

    const mapelSel = document.getElementById('kk-mapel');
    const rombelSel = document.getElementById('kk-rombel');

    // Reset UI
    document.getElementById('kisi-kisi-setup').classList.remove('hidden');
    document.getElementById('kisi-kisi-result').classList.add('hidden');

    // Populate based on current mode (Admin or Teacher)
    if (window.currentSiswa && window.currentSiswa.role === 'teacher') {
        const subjects = window.currentSiswa.subjects || [];
        const uniqueMapels = [...new Set(subjects.map(s => s.mapel))];
        mapelSel.innerHTML = uniqueMapels.map(m => `<option value="${m}">${m}</option>`).join('');

        const updateRombel = () => {
            const selectedMapel = mapelSel.value;
            const relevantRombels = subjects.filter(s => s.mapel === selectedMapel).map(s => s.rombel);
            rombelSel.innerHTML = relevantRombels.map(r => `<option value="${r}">${r}</option>`).join('');
        };
        mapelSel.onchange = updateRombel;
        updateRombel();
    } else {
        // Admin mode
        mapelSel.innerHTML = db.subjects.map(s => {
            const name = (typeof s === 'object') ? s.name : s;
            return `<option value="${name}">${name}</option>`;
        }).join('');
        rombelSel.innerHTML = db.rombels.map(r => `<option value="${r}">${r}</option>`).join('');
        mapelSel.onchange = null;
    }
}

function renderKisiKisiTable(data) {
    const tbody = document.getElementById('kk-table-body');
    tbody.innerHTML = data.map(item => `
                <tr>
                    <td class="px-4 py-3 border border-slate-200 text-center">${item.no}</td>
                    <td class="px-4 py-3 border border-slate-200 font-medium">${item.kd}</td>
                    <td class="px-4 py-3 border border-slate-200">${item.materi}</td>
                    <td class="px-4 py-3 border border-slate-200 italic">${item.indikator}</td>
                    <td class="px-4 py-3 border border-slate-200 text-center">${item.level}</td>
                    <td class="px-4 py-3 border border-slate-200 text-center font-bold">${item.no_soal}</td>
                    <td class="px-4 py-3 border border-slate-200 text-center">${item.bentuk}</td>
                </tr>
            `).join('');
}

function resetKisiKisiModal() {
    document.getElementById('kisi-kisi-setup').classList.remove('hidden');
    document.getElementById('kisi-kisi-result').classList.add('hidden');
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `flex items-center gap-3 px-6 py-3 rounded-2xl shadow-xl transform transition-all duration-300 translate-y-10 opacity-0`;

    if (type === 'success') {
        toast.classList.add('bg-emerald-600', 'text-white');
        toast.innerHTML = `<i class="fas fa-check-circle"></i> <span class="text-xs font-bold">${message}</span>`;
    } else if (type === 'error') {
        toast.classList.add('bg-red-600', 'text-white');
        toast.innerHTML = `<i class="fas fa-exclamation-circle"></i> <span class="text-xs font-bold">${message}</span>`;
    } else {
        toast.classList.add('bg-sky-600', 'text-white');
        toast.innerHTML = `<i class="fas fa-sync fa-spin"></i> <span class="text-xs font-bold">${message}</span>`;
    }

    container.appendChild(toast);

    // Trigger animation
    setTimeout(() => {
        toast.classList.remove('translate-y-10', 'opacity-0');
    }, 10);

    // Auto hide
    setTimeout(() => {
        toast.classList.add('translate-y-[-10px]', 'opacity-0');
        setTimeout(() => toast.remove(), 300);
    }, type === 'info' ? 1500 : 3000);
}

function getWritingTargetInput(targetInputEl) {
    if (targetInputEl && typeof targetInputEl.matches === 'function' && targetInputEl.matches('.q-opt, .tf-statement, .matching-question, .matching-answer')) {
        return targetInputEl;
    }

    const active = document.activeElement;
    if (active && typeof active.matches === 'function' && active.matches('.q-opt, .tf-statement, .matching-question, .matching-answer')) {
        return active;
    }

    const lastFocused = window.__lastFocusedOptionInput;
    if (lastFocused && lastFocused.isConnected) {
        return lastFocused;
    }

    const opts = document.querySelectorAll('.q-opt, .tf-statement, .matching-question, .matching-answer');
    return opts.length ? opts[0] : null;
}

document.addEventListener('focusin', (event) => {
    const el = event.target;
    if (el && typeof el.matches === 'function' && el.matches('.q-opt, .tf-statement, .matching-question, .matching-answer')) {
        window.__lastFocusedOptionInput = el;
    }
});

function toSuperscriptText(value) {
    const map = {
        '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
        'a': 'ᵃ', 'b': 'ᵇ', 'c': 'ᶜ', 'd': 'ᵈ', 'e': 'ᵉ', 'f': 'ᶠ', 'g': 'ᵍ', 'h': 'ʰ', 'i': 'ⁱ', 'j': 'ʲ', 'k': 'ᵏ', 'l': 'ˡ', 'm': 'ᵐ', 'n': 'ⁿ', 'o': 'ᵒ', 'p': 'ᵖ', 'q': 'ᑫ', 'r': 'ʳ', 's': 'ˢ', 't': 'ᵗ', 'u': 'ᵘ', 'v': 'ᵛ', 'w': 'ʷ', 'x': 'ˣ', 'y': 'ʸ', 'z': 'ᶻ',
        'A': 'ᴬ', 'B': 'ᴮ', 'C': 'ᶜ', 'D': 'ᴰ', 'E': 'ᴱ', 'F': 'ᶠ', 'G': 'ᴳ', 'H': 'ᴴ', 'I': 'ᴵ', 'J': 'ᴶ', 'K': 'ᴷ', 'L': 'ᴸ', 'M': 'ᴹ', 'N': 'ᴺ', 'O': 'ᴼ', 'P': 'ᴾ', 'Q': 'Q', 'R': 'ᴿ', 'S': 'ˢ', 'T': 'ᵀ', 'U': 'ᵁ', 'V': 'ᵛ', 'W': 'ᵂ', 'X': 'ˣ', 'Y': 'ʸ', 'Z': 'ᶻ'
    };
    return Array.from(String(value || '')).map(ch => map[ch] || ch).join('');
}

function toSubscriptText(value) {
    const map = {
        '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
        'a': 'ₐ', 'e': 'ₑ', 'h': 'ₕ', 'i': 'ᵢ', 'j': 'ⱼ', 'k': 'ₖ', 'l': 'ₗ', 'm': 'ₘ', 'n': 'ₙ', 'o': 'ₒ', 'p': 'ₚ', 'r': 'ᵣ', 's': 'ₛ', 't': 'ₜ', 'u': 'ᵤ', 'v': 'ᵥ', 'x': 'ₓ',
        'A': 'ₐ', 'E': 'ₑ', 'H': 'ₕ', 'I': 'ᵢ', 'J': 'ⱼ', 'K': 'ₖ', 'L': 'ₗ', 'M': 'ₘ', 'N': 'ₙ', 'O': 'ₒ', 'P': 'ₚ', 'R': 'ᵣ', 'S': 'ₛ', 'T': 'ₜ', 'U': 'ᵤ', 'V': 'ᵥ', 'X': 'ₓ'
    };
    return Array.from(String(value || '')).map(ch => map[ch] || ch).join('');
}

function buildTemplateSymbol(symbol, selectedText) {
    const clean = String(selectedText || '').trim();
    if (symbol === 'xⁿ') {
        if (clean) return toSuperscriptText(clean);
        return 'xⁿ';
    }
    if (symbol === 'xₙ') {
        if (clean) return toSubscriptText(clean);
        return 'xₙ';
    }
    return symbol;
}

function insertOptionSymbol(symbol, targetInputEl) {
    let el = getWritingTargetInput(targetInputEl);
    if (!el) return;

    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const selectedText = el.value.slice(start, end);
    const replacement = buildTemplateSymbol(symbol, selectedText);
    const val = el.value || '';
    el.value = val.substring(0, start) + replacement + val.substring(end);

    if (typeof el.setSelectionRange === 'function') {
        if (symbol === 'xⁿ' || symbol === 'xₙ') {
            if (selectedText) {
                const cursorPos = start + replacement.length;
                el.setSelectionRange(cursorPos, cursorPos);
            } else {
                const placeholderPos = start + 1;
                el.setSelectionRange(placeholderPos, placeholderPos);
            }
        } else {
            const cursorPos = start + replacement.length;
            el.setSelectionRange(cursorPos, cursorPos);
        }
    }

    el.focus();
    el.dispatchEvent(new Event('input', { bubbles: true }));
}

function shuffleArray(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}
window.insertOptionSymbol = insertOptionSymbol;


;(function(){
    function buildAksaraPanel() {
        if (document.getElementById('aksara-jawa-panel')) return;
        const panel = document.createElement('div');
        panel.id = 'aksara-jawa-panel';
        panel.setAttribute('role','dialog');
        panel.style.cssText = 'position:fixed;left:16px;bottom:64px;z-index:10000;background:#ffffff;padding:10px;border-radius:12px;box-shadow:0 12px 32px rgba(2,6,23,0.14);max-width:720px;display:grid;grid-template-columns:repeat(auto-fill,minmax(44px,1fr));gap:6px;align-items:center;';

        const aksara = ['ꦲ','ꦧ','ꦕ','ꦗ','ꦠ','ꦢ','ꦤ','ꦒ','ꦏ','ꦭ','ꦩ','ꦫ','ꦱ','ꦮ','ꦚ','ꦛ','ꦝ','ꦔ','ꦞ','ꦟ','ꦣ','ꦩ','ꦦ','ꦨ','ꦩ'];
        const pasangan = ['꧀ꦲ','꧀ꦧ','꧀ꦕ','꧀ꦗ','꧀ꦠ','꧀ꦢ','꧀ꦤ','꧀ꦒ','꧀ꦏ','꧀ꦭ','꧀ꦩ','꧀ꦫ','꧀ꦱ','꧀ꦮ','꧀ꦚ','꧀ꦛ','꧀ꦝ','꧀ꦔ'];
        const diacritics = ['ꦶ','ꦷ','ꦸ','ꦹ','ꦺ','ꦻ','ꦼ','ꦽ','ꦾ','ꦿ','ꦴ','ꦵ','꧀'];

        const all = aksara.concat(pasangan).concat(diacritics);

        all.forEach(ch => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'aksara-jawa-btn';
            btn.style.cssText = 'padding:6px 8px;border-radius:8px;background:#fff;border:1px solid #f1f5f9;cursor:pointer;font-weight:700;font-size:18px';
            btn.textContent = ch;
            btn.onclick = function() { insertOptionSymbol(ch); const p = document.getElementById('aksara-jawa-panel'); if (p) p.remove(); };
            panel.appendChild(btn);
        });

        const close = document.createElement('button');
        close.type = 'button';
        close.textContent = 'Tutup';
        close.style.cssText = 'grid-column:1/-1;margin-top:6px;padding:8px;border-radius:10px;background:#f1f5f9;border:none;cursor:pointer;font-weight:700';
        close.onclick = function() { panel.remove(); };
        panel.appendChild(close);

        document.body.appendChild(panel);
    }

    window.toggleAksaraJawa = function() {
        const panel = document.getElementById('aksara-jawa-panel');
        if (panel) { panel.remove(); return; }
        buildAksaraPanel();
    };

    // Try to insert the toggle into the symbol helper toolbar in the question modal.
    // Falls back to a floating button when toolbar can't be found.
    function createToolbarToggle() {
        if (document.getElementById('toggle-aksara-jawa-btn')) return;

        // Find an existing helper button that calls insertOptionSymbol
        const seed = Array.from(document.querySelectorAll('button')).find(b => {
            const o = b.getAttribute && b.getAttribute('onclick');
            return typeof o === 'string' && o.includes('insertOptionSymbol(');
        });

        const makeBtn = () => {
            const tbtn = document.createElement('button');
            tbtn.id = 'toggle-aksara-jawa-btn';
            tbtn.type = 'button';
            tbtn.title = 'Aksara Jawa';
            tbtn.textContent = 'Aksara Jawa';
            tbtn.onclick = window.toggleAksaraJawa;
            // match helper button styling used in the modal toolbar
            tbtn.className = 'px-2 py-0.5 bg-amber-100 hover:bg-amber-600 text-amber-700 hover:text-white rounded text-xs font-black transition-colors';
            return tbtn;
        };

        if (seed && seed.parentElement) {
            const container = seed.parentElement;
            const tbtn = makeBtn();
            container.appendChild(tbtn);
            return;
        }

        // Do not create a floating fallback button on pages without the editor toolbar.
        // This prevents the "Aksara Jawa" toggle from appearing on the login page.
        return;
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', createToolbarToggle);
    } else {
        createToolbarToggle();
    }

})();




/* ==================== FILE: js/utils/formatters.js ==================== */
/**
 * js/utils/formatters.js
 * Part of CBT application refactored module
 */

function getApiBaseUrl() {
    // Priority 1: User-defined remote server from settings
    const remote = localStorage.getItem(REMOTE_SERVER_KEY);
    if (remote && remote.trim()) {
        return remote.trim().replace(/\/$/, "");
    }

    // Priority 2: Direct file access (testing locally)
    if (window.location.protocol === 'file:') {
        return 'http://localhost:3000';
    }

    // Priority 3: Same origin (standard hosting)
    return '';
}

function normalizeImgSrc(src) {
    if (!src) return '';
    if (typeof src !== 'string') return src;
    let trimmed = src.trim();

    // already full URL or data URI
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:') || trimmed.startsWith('blob:') || trimmed.startsWith('//')) {
        return trimmed;
    }

    // Special handling for /images/ folder which is shared between frontend and backend
    const isLocalImagePath = trimmed.startsWith('/images/') || trimmed.startsWith('images/');

    if (window.location.protocol === 'file:') {
        // When running the app directly from the file system, use a relative path
        return trimmed.replace(/^\/+/, '');
    }

    const base = getApiBaseUrl();
    if (base) {
        const path = trimmed.startsWith('/') ? trimmed : '/' + trimmed;
        return base + path;
    }

    // Fallback: if it's a relative-looking path like /images/foo.jpg, 
    // and we're on http:// but no explicit base, it will be relative to the current host.
    return trimmed;
}

function normalizeHtmlImages(html) {
    if (!html || typeof html !== 'string' || !html.includes('<img')) return html;

    // Simple regex to find img srcs. We only replace /images/ or images/ paths.
    // For more complex HTML, a DOMParser would be better, but regex is faster for large lists.
    return html.replace(/<img([^>]+)src=["']([^"'>]+)["']/gi, (match, before, src) => {
        const normalized = normalizeImgSrc(src);
        return `<img${before}src="${normalized}"`;
    });
}

async function updateStats() {
    const subjects = Array.isArray(db?.subjects) ? db.subjects : [];
    const questions = Array.isArray(db?.questions) ? db.questions : [];
    const rombels = Array.isArray(db?.rombels) ? db.rombels : [];
    const students = Array.isArray(db?.students) ? db.students : [];
    const results = Array.isArray(db?.results) ? db.results : [];

    const ids = ['stat-subjects', 'stat-questions', 'stat-rombel', 'stat-students', 'stat-results'];
    const vals = [
        subjects.length,
        questions.length,
        rombels.length,
        students.filter(x => x.role !== 'admin').length,
        results.filter(r => !r.deleted).length
    ];
    ids.forEach((id, i) => { if (document.getElementById(id)) document.getElementById(id).innerText = vals[i]; });

    // Also update API stats in overview if available
    if (typeof updateAdminAPIStats === 'function') {
        await updateAdminAPIStats();
    }
}

function updateCompletionCharts() {
    if (!document.getElementById('admin-rombel') || document.getElementById('admin-rombel').classList.contains('hidden')) return;
    renderRombelProgress();
}

function formatTeacherSubjects(teacher) {
    return teacherSubjectNames(teacher).map(name => {
        const roms = teacherAllowedRombels(teacher, name);
        return roms.length ? `${name} (${roms.join(',')})` : name;
    }).join(', ');
}

function calculateMnRow(el) {
    const tr = el.closest('tr');

    // Dynamic Ulangan
    const uInputs = Array.from(tr.querySelectorAll('[data-field="u"]'));
    const uSum = uInputs.reduce((sum, inp) => sum + (parseFloat(inp.value) || 0), 0);
    const avgU = uInputs.length > 0 ? uSum / uInputs.length : 0;

    // Dynamic Tugas
    const tInputs = Array.from(tr.querySelectorAll('[data-field="t"]'));
    const tSum = tInputs.reduce((sum, inp) => sum + (parseFloat(inp.value) || 0), 0);
    const avgT = tInputs.length > 0 ? tSum / tInputs.length : 0;

    const kelas = parseFloat(tr.querySelector('[data-field="kelas"]').value) || 0;
    const uas = parseFloat(tr.querySelector('[data-field="uas"]').value) || 0;

    const wHarian = (parseFloat(document.getElementById('mn-weight-harian').value) || 0) / 100;
    const wKelas = (parseFloat(document.getElementById('mn-weight-kelas').value) || 0) / 100;
    const wUas = (parseFloat(document.getElementById('mn-weight-uas').value) || 0) / 100;

    const final = ((avgU + avgT) / 2 * wHarian) + (kelas * wKelas) + (uas * wUas);
    tr.querySelector('.mn-final-grade').textContent = final.toFixed(1);
}

function _updateRombelLabelStyle(cb) {
    const label = cb.closest('.schedule-rombel-label');
    if (!label) return;
    const statusSpan = label.querySelector('.schedule-status-span');
    if (cb.checked) {
        label.classList.remove('bg-slate-50', 'border-transparent');
        label.classList.add('bg-purple-50', 'border', 'border-purple-100');
        if (statusSpan) {
            statusSpan.innerHTML = '<i class="fas fa-check"></i> Aktif';
            statusSpan.className = 'schedule-status-span text-[10px] font-bold text-purple-500';
        }
    } else {
        label.classList.remove('bg-purple-50', 'border-purple-100');
        label.classList.add('bg-slate-50', 'border-transparent');
        if (statusSpan) {
            statusSpan.innerHTML = 'Nonaktif';
            statusSpan.className = 'schedule-status-span text-[10px] font-bold text-slate-300';
        }
    }
}

function renderTimeLimitList() {
    const container = document.getElementById('time-limit-list');
    if (!container) return;

    const timeLimits = db.timeLimits || {};
    const listHTML = db.rombels.map(rombel => {
        return db.subjects.map(subject => {
            const subjectName = getSubjectName(subject);
            const key = `${rombel}|${subjectName}`.toLowerCase().trim();
            const currentTime = timeLimits[key] || 60; // default 60 menit
            return `
                        <div class="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                            <span class="font-bold text-slate-700">${rombel} - ${subjectName}</span>
                            <div class="flex items-center gap-2">
                                <input type="number" class="time-limit-input w-16 px-2 py-1 border border-slate-300 rounded text-center" data-key="${key}" value="${currentTime}" min="1" max="300" />
                                <span class="text-sm text-slate-500">menit</span>
                            </div>
                        </div>
                    `;
        }).join('');
    }).join('');

    container.innerHTML = listHTML;
}

async function saveTimeLimits() {
    const inputs = document.querySelectorAll('.time-limit-input');
    const newTimeLimits = {};
    inputs.forEach(input => {
        const key = input.dataset.key;
        const value = parseInt(input.value) || 60;
        newTimeLimits[key] = value;
    });
    console.log('Saving timeLimits:', newTimeLimits);

    db.timeLimits = newTimeLimits;

    // Save with refresh
    await save({ refreshBeforeSave: true });

    closeModals();
    alert('Waktu pengerjaan tersimpan!');
}

function updateDoubtBtn() {
    const btn = document.getElementById('btn-doubt');
    if (!btn) return;
    const isRagu = examData.ragu && examData.ragu[examData.currentIdx];
    btn.classList.toggle('bg-yellow-600', isRagu);
}

function updateProgress() {
    const total = examData.questions.length;
    const answeredCount = examData.answers.reduce((count, ans) => {
        const isAnswered = ans !== null && ans !== undefined && (
            Array.isArray(ans) ? ans.length > 0 :
                typeof ans === 'string' ? ans.trim() !== '' :
                    true
        );
        return count + (isAnswered ? 1 : 0);
    }, 0);
    const percentage = total ? (answeredCount / total) * 100 : 0;
    document.getElementById('progress-bar').style.width = `${percentage}%`;
    document.getElementById('progress-text').innerText = `${Math.round(percentage)}%`;

    // update current question type label
    if (examData && examData.questions && typeof examData.currentIdx === 'number') {
        const q = examData.questions[examData.currentIdx];
        const typeLabel = q ? getTypeLabel(q.type || 'single') : '';
        document.getElementById('progress-type').innerText = typeLabel;
    }
    updateLiveExamStatus();
}

function handleAiBlueprintChange(input) {
    const label = document.getElementById('ai-materi-label');
    if (input.files && input.files.length > 0) {
        if (label) label.innerHTML = 'Materi / Topik Utama <span class="text-blue-500 font-bold lowercase text-[9px]">(Opsional jika upload file)</span>';
    } else {
        if (label) label.innerText = 'Materi / Topik Utama';
    }
}

function calculateAiHots() {
    const typeCounts = getAiTypeCounts();
    const total = Object.values(typeCounts).reduce((sum, n) => sum + (Number(n) || 0), 0);
    const totalDisplay = document.getElementById('ai-total-display');
    if (totalDisplay) {
        totalDisplay.textContent = String(total);
    }

    const mudahInput = document.getElementById('ai-lvl-mudah');
    const sedangInput = document.getElementById('ai-lvl-sedang');
    const hotsInput = document.getElementById('ai-lvl-hots');
    const mudah = Number(mudahInput?.value) || 0;
    const sedang = Number(sedangInput?.value) || 0;
    if (hotsInput) {
        hotsInput.value = String(Math.max(0, total - mudah - sedang));
    }
}

function downloadKisiKisiPdf() {
    if (!currentKisiKisiData.length) return;
    const element = document.getElementById('kisi-kisi-result').cloneNode(true);
    // Hide the buttons in the clone
    element.querySelector('.flex.gap-2').style.display = 'none';
    element.querySelector('button.mt-4').style.display = 'none';

    const opt = {
        margin: 1,
        filename: `Kisi-kisi_${document.getElementById('kk-mapel').value}_${document.getElementById('kk-rombel').value}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'landscape' }
    };
    html2pdf().set(opt).from(element).save();
}

function toggleExportDropdown() {
    const dropdown = document.getElementById('export-dropdown');
    if (dropdown) dropdown.classList.toggle('hidden');
    // Hide import dropdown if open
    const importDropdown = document.getElementById('import-dropdown');
    if (importDropdown) importDropdown.classList.add('hidden');
}

async function startRealtimeStatsPolling() {
    if (!currentSiswa || currentSiswa.role !== 'teacher') return;

    // Clear existing interval jika ada
    if (apiKeysStatsPollingInterval) {
        clearInterval(apiKeysStatsPollingInterval);
    }

    // Poll immediately
    await updateRealtimeStats();

    // Then set interval for continuous polling
    apiKeysStatsPollingInterval = setInterval(updateRealtimeStats, STATS_POLLING_INTERVAL);
}

function stopRealtimeStatsPolling() {
    if (apiKeysStatsPollingInterval) {
        clearInterval(apiKeysStatsPollingInterval);
        apiKeysStatsPollingInterval = null;
    }
}

async function updateRealtimeStats() {
    if (!currentSiswa || currentSiswa.role !== 'teacher') return;

    try {
        const response = await fetch(getApiBaseUrl() + `/api/teacher/realtime-stats?teacherId=${encodeURIComponent(currentSiswa.id)}`);
        if (!response.ok) return;

        const data = await response.json();
        if (!data.ok) return;

        // Update teacher API keys stats
        if (data.teacherKeys) {
            const keyCountEl = document.getElementById('api-keys-count');
            if (keyCountEl) {
                keyCountEl.textContent = `${data.teacherKeys.active}/${data.teacherKeys.total}`;
                keyCountEl.classList.add('animate-pulse-brief');
                setTimeout(() => keyCountEl.classList.remove('animate-pulse-brief'), 300);
            }
        }

        // Update global API keys stats
        if (data.globalKeys) {
            const globalKeyCountEl = document.getElementById('global-api-keys-count');
            if (globalKeyCountEl) {
                globalKeyCountEl.textContent = `${data.globalKeys.active}/${data.globalKeys.total}`;
                globalKeyCountEl.classList.add('animate-pulse-brief');
                setTimeout(() => globalKeyCountEl.classList.remove('animate-pulse-brief'), 300);
            }
        }

        // Update last updated timestamp
        const timestamp = new Date(data.timestamp);
        const lastUpdatedEl = document.getElementById('api-keys-last-updated');
        if (lastUpdatedEl && data.timestamp) {
            const timeStr = timestamp.toLocaleTimeString('id-ID');
            lastUpdatedEl.textContent = `Update terakhir: ${timeStr}`;
            lastUpdatedEl.classList.add('opacity-50');
        }

        // Update status badges
        updateAPIKeysStatusBadges(data.teacherKeys, data.globalKeys);

    } catch (err) {
        console.warn('Error updating real-time stats:', err.message);
    }
}

function updateAPIKeysStatusBadges(teacherKeys, globalKeys) {
    // Update teacher keys status
    const statusBadge = document.getElementById('api-keys-status-badge');
    if (statusBadge && teacherKeys) {
        if (teacherKeys.total === 0) {
            statusBadge.innerHTML = '<i class="fas fa-info-circle mr-1"></i>Belum ada API Key pribadi';
            statusBadge.className = 'inline-block px-3 py-1 bg-slate-100 text-slate-700 text-xs font-bold rounded-full';
        } else if (teacherKeys.active === 0) {
            statusBadge.innerHTML = '<i class="fas fa-exclamation-circle mr-1"></i>Semua API Key habis kuota';
            statusBadge.className = 'inline-block px-3 py-1 bg-red-100 text-red-700 text-xs font-bold rounded-full';
        } else {
            statusBadge.innerHTML = '<i class="fas fa-check-circle mr-1"></i>API Keys Siap Digunakan';
            statusBadge.className = 'inline-block px-3 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full';
        }
    }

    // Update global keys status
    const globalStatusBadge = document.getElementById('global-api-keys-status-badge');
    if (globalStatusBadge && globalKeys) {
        if (globalKeys.total === 0) {
            globalStatusBadge.innerHTML = '<i class="fas fa-times-circle mr-1"></i>Tidak ada key global';
            globalStatusBadge.className = 'inline-block px-3 py-1 bg-slate-100 text-slate-700 text-xs font-bold rounded-full';
        } else if (globalKeys.active === 0) {
            globalStatusBadge.innerHTML = '<i class="fas fa-exclamation-circle mr-1"></i>Semua global key habis';
            globalStatusBadge.className = 'inline-block px-3 py-1 bg-red-100 text-red-700 text-xs font-bold rounded-full';
        } else {
            globalStatusBadge.innerHTML = '<i class="fas fa-check-circle mr-1"></i>Global keys aktif';
            globalStatusBadge.className = 'inline-block px-3 py-1 bg-yellow-100 text-yellow-700 text-xs font-bold rounded-full';
        }
    }
}

function updateApiKeysWarningBanner(message, type = 'error') {
    const banner = document.getElementById('api-keys-warning-banner');
    if (!banner) return;
    banner.textContent = message || '';
    if (!message) {
        banner.classList.add('hidden');
        return;
    }
    banner.classList.remove('hidden');
}

function updateTeacherApiKeysStats(keys = []) {
    const countDisplay = document.getElementById('api-keys-count');
    const statusBadge = document.getElementById('api-keys-status-badge');
    const lastUpdatedDisplay = document.getElementById('api-keys-last-updated');

    if (!Array.isArray(keys)) keys = [];
    const total = keys.length;
    const active = keys.filter(k => (typeof k === 'object' ? k.status : 'active') !== 'exhausted').length;

    if (countDisplay) countDisplay.textContent = `${active}/${total}`;

    if (statusBadge) {
        if (total === 0) {
            statusBadge.innerHTML = '<i class="fas fa-exclamation-circle mr-1"></i>Belum ada key pribadi';
            statusBadge.className = 'inline-block px-3 py-1 bg-slate-100 text-slate-500 text-xs font-bold rounded-full';
        } else if (active === 0) {
            statusBadge.innerHTML = '<i class="fas fa-times-circle mr-1"></i>Semua Key Pribadi Habis';
            statusBadge.className = 'inline-block px-3 py-1 bg-red-100 text-red-700 text-xs font-bold rounded-full';
        } else {
            statusBadge.innerHTML = '<i class="fas fa-check-circle mr-1"></i>Key Pribadi Siap Digunakan';
            statusBadge.className = 'inline-block px-3 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full';
        }
    }
}

function updateApiKeysQuotaNote() {
    const note = document.getElementById('api-keys-quota-note');
    if (!note) return;
    // Minimal implementation - updates quota note display
    note.textContent = 'Sisa kuota tidak dapat ditentukan secara pasti oleh Google Gemini.';
}

function updateGlobalApiKeysStats(keys = []) {
    const countDisplay = document.getElementById('global-api-keys-count');
    const statusBadge = document.getElementById('global-api-keys-status-badge');

    if (!Array.isArray(keys)) keys = [];
    const totalCount = keys.length;
    const activeCount = keys.filter(k => k.status !== 'exhausted').length;

    if (countDisplay) {
        countDisplay.textContent = `${activeCount}/${totalCount}`;
    }

    if (!statusBadge) return;

    if (totalCount === 0) {
        statusBadge.innerHTML = '<i class="fas fa-exclamation-circle mr-1"></i>Tidak ada key global';
        statusBadge.className = 'inline-block px-3 py-1 bg-yellow-100 text-yellow-700 text-xs font-bold rounded-full';
    } else if (activeCount === 0) {
        statusBadge.innerHTML = '<i class="fas fa-times-circle mr-1"></i>Semua Global Key Habis';
        statusBadge.className = 'inline-block px-3 py-1 bg-red-100 text-red-700 text-xs font-bold rounded-full';
    } else {
        statusBadge.innerHTML = '<i class="fas fa-check-circle mr-1"></i>Global Keys Siap';
        statusBadge.className = 'inline-block px-3 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full';
    }
}



/* ==================== FILE: js/modules/siswa.js ==================== */
/**
 * js/modules/siswa.js
 * Part of CBT application refactored module
 */

function saveExamProgress() {
    saveStudentExamProgress();
    showToast('Jawaban siswa telah disimpan.', 'success');
}

function saveExamProgressAndReload() {
    saveStudentExamProgress();
    showToast('Jawaban tersimpan. Memuat ulang halaman...', 'info');
    reloadPage();
}

async function saveLiveProgressState(requestReload = false) {
    showToast(requestReload ? 'Memerintahkan RELOAD kepada semua siswa...' : 'Menyimpan live progress semua siswa...', 'info');
    try {
        // Step 1: Save general DB
        await save({ forceServerSave: true });

        // Step 2: Save each active exam individually to the live store
        const savedCount = await saveAllLiveProgress(requestReload);

        showToast(`Berhasil ${requestReload ? 'reload & simpan' : 'menyimpan'} ${savedCount} progres siswa.`, 'success');
        if (typeof renderRombelProgress === 'function') renderRombelProgress();
    } catch (err) {
        console.warn('[saveLiveProgressState] error:', err.message || err);
        showToast('Gagal menyimpan live progress.', 'error');
    }
}

async function saveAllLiveProgress(forceReload = false) {
    if (!db.activeExams || !db.activeExams.length) return 0;

    console.log('[saveAllLiveProgress] Saving all active exams:', db.activeExams.length, 'forceReload:', forceReload);
    let count = 0;

    // Use for...of for sequential execution to avoid flooding the server
    for (const exam of db.activeExams) {
        if (!exam.studentId || !exam.mapel) continue;

        try {
            console.log(`[saveAllLiveProgress] Saving for: ${exam.studentName} (${exam.studentId})`);

            const saveEntry = {
                ...exam,
                adminSaveRequest: true,
                adminReloadRequest: forceReload ? Date.now() : (exam.adminReloadRequest || false),
                adminSaveConfirmed: true,
                updatedAt: Date.now(),
                savedByAdminCommand: true,
                adminSavedProgress: {
                    studentId: exam.studentId,
                    studentName: exam.studentName,
                    rombel: exam.rombel,
                    mapel: exam.mapel,
                    answers: Array.isArray(exam.answers) ? exam.answers : [],
                    currentIdx: typeof exam.currentIdx === 'number' ? exam.currentIdx : 0,
                    ragu: Array.isArray(exam.ragu) ? exam.ragu : [],
                    totalSeconds: exam.totalSeconds || 0,
                    remainingSeconds: exam.timeRemaining || exam.remainingSeconds || 0,
                    savedAt: Date.now()
                }
            };

            await sendLiveExamToServer(saveEntry);
            count++;

            // Tiny delay to be gentle on local network/server
            if (db.activeExams.length > 5) await new Promise(r => setTimeout(r, 50));
        } catch (e) {
            console.warn(`[saveAllLiveProgress] Failed to save for ${exam.studentId}:`, e.message);
        }
    }

    await saveLocalDb();
    return count;
}

async function saveLiveProgressStateAndReload() {
    await saveLiveProgressState(true);
    reloadPage();
}

isExamActive = false;

let cheatingCount = 0;

let wakeLock = null;

let isFullscreen = false;

let examStartTime = null;

let examSecondsRemaining = 0;

function handleCheating(reason) {
    if (!isExamActive) return;

    // Increment cheat count
    cheatingCount++;
    console.warn(`Anti-Cheat Triggered: ${reason} (Attempt: ${cheatingCount})`);

    if (cheatingCount >= 3) {
        // Final Strike - Auto Submit
        isExamActive = false;
        alert('UJIAN DIBERHENTIKAN! Anda terdeteksi melakukan kecurangan berkali-kali. Jawaban Anda telah dikirim.');
        submitExam();
    } else {
        // First or Second Warning
        const attemptsLeft = 3 - cheatingCount;
        const warningMsg = attemptsLeft === 1 ? 'Peringatan Terakhir!' : `Peringatan ${cheatingCount}!`;

        document.getElementById('cheat-warning-modal').classList.remove('hidden');
        document.getElementById('cheat-warning-modal').classList.add('flex');

        // (Optional) Update modal text if there's a specific element for it
        const warningText = document.getElementById('cheat-warning-text');
        if (warningText) {
            warningText.innerText = `${reason}. ${warningMsg} Jika terdeteksi lagi, ujian akan dihentikan secara otomatis.`;
        }
    }
}

function closeCheatWarning() {
    document.getElementById('cheat-warning-modal').classList.add('hidden');
    document.getElementById('cheat-warning-modal').classList.remove('flex');
}

async function requestFullscreen() {
    console.log('Attempting to request browser fullscreen API...');

    // Don't interfere if CSS simulation is already active
    if (isFullscreen) {
        console.log('CSS fullscreen already active, skipping API request');
        return;
    }

    // Check if fullscreen is supported and enabled
    const fullscreenEnabled = document.fullscreenEnabled ||
        document.webkitFullscreenEnabled ||
        document.msFullscreenEnabled ||
        document.mozFullScreenEnabled ||
        false;

    if (!fullscreenEnabled) {
        console.warn('Browser fullscreen not supported, relying on CSS simulation');
        return;
    }

    try {
        const elem = document.documentElement;

        // Try different fullscreen methods
        if (elem.requestFullscreen) {
            console.log('Using requestFullscreen');
            await elem.requestFullscreen();
        } else if (elem.webkitRequestFullscreen) {
            console.log('Using webkitRequestFullscreen');
            await elem.webkitRequestFullscreen();
        } else if (elem.webkitEnterFullscreen) {
            console.log('Using webkitEnterFullscreen');
            await elem.webkitEnterFullscreen();
        } else if (elem.msRequestFullscreen) {
            console.log('Using msRequestFullscreen');
            await elem.msRequestFullscreen();
        } else if (elem.mozRequestFullScreen) {
            console.log('Using mozRequestFullScreen');
            await elem.mozRequestFullScreen();
        } else {
            console.warn('No fullscreen API available');
            return;
        }

        // Check if fullscreen was actually entered
        setTimeout(() => {
            const isInFullscreen = document.fullscreenElement ||
                document.webkitFullscreenElement ||
                document.msFullscreenElement ||
                document.mozFullScreenElement;

            if (isInFullscreen) {
                console.log('Browser fullscreen API succeeded');
                isFullscreen = true;
            } else {
                console.log('Browser fullscreen API did not activate, CSS simulation will handle it');
            }
        }, 200);

    } catch (error) {
        console.warn('Browser fullscreen request failed:', error);
        console.log('Relying on CSS fullscreen simulation');
    }
}

function simulateFullscreen() {
    console.log('Activating CSS fullscreen simulation');

    // Create fullscreen overlay if it doesn't exist
    let overlay = document.getElementById('exam-fullscreen-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'exam-fullscreen-overlay';
        overlay.style.cssText = `
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100vw;
                    height: 100vh;
                    background: transparent;
                    z-index: -1;
                    pointer-events: none;
                `;
        document.body.appendChild(overlay);
    }

    // Apply aggressive fullscreen styles
    document.body.style.cssText += `
                position: fixed !important;
                top: 0 !important;
                left: 0 !important;
                width: 100vw !important;
                height: 100vh !important;
                margin: 0 !important;
                padding: 0 !important;
                overflow: hidden !important;
                z-index: 10001 !important;
            `;

    // Hide html scrollbars and margins
    document.documentElement.style.cssText += `
                overflow: hidden !important;
                margin: 0 !important;
                padding: 0 !important;
                width: 100vw !important;
                height: 100vh !important;
            `;

    // Hide all browser UI elements
    const style = document.createElement('style');
    style.id = 'exam-fullscreen-styles';
    style.textContent = `
                * {
                    -webkit-touch-callout: none !important;
                    -webkit-user-select: none !important;
                    -khtml-user-select: none !important;
                    -moz-user-select: none !important;
                    -ms-user-select: none !important;
                    user-select: none !important;
                }
                html, body {
                    cursor: default !important;
                }
                /* Hide browser UI */
                ::-webkit-scrollbar {
                    display: none !important;
                }
                /* Mobile specific */
                @media screen and (max-width: 768px) {
                    html, body {
                        -webkit-text-size-adjust: 100% !important;
                        -ms-text-size-adjust: 100% !important;
                    }
                }
            `;
    document.head.appendChild(style);

    isFullscreen = true;
    console.log('CSS fullscreen simulation activated successfully');

    // Force layout recalculation
    document.body.offsetHeight;
}

function exitSimulatedFullscreen() {
    console.log('Deactivating CSS fullscreen simulation');

    // Remove overlay
    const overlay = document.getElementById('exam-fullscreen-overlay');
    if (overlay) {
        overlay.remove();
    }

    // Remove custom styles
    const style = document.getElementById('exam-fullscreen-styles');
    if (style) {
        style.remove();
    }

    // Reset body styles
    document.body.style.cssText = '';
    document.body.removeAttribute('style');

    // Reset html styles
    document.documentElement.style.cssText = '';
    document.documentElement.removeAttribute('style');

    isFullscreen = false;
    console.log('CSS fullscreen simulation deactivated');
}

async function requestWakeLock() {
    try {
        if ('wakeLock' in navigator) {
            wakeLock = await navigator.wakeLock.request('screen');
            console.log('Wake lock activated');
        }
    } catch (error) {
        console.warn('Failed to request wake lock:', error);
    }
}

function releaseWakeLock() {
    if (wakeLock) {
        wakeLock.release();
        wakeLock = null;
        console.log('Wake lock released');
    }
}

function exitFullscreen() {
    try {
        const isBrowserFullscreen = document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement || document.mozFullScreenElement;

        if (isBrowserFullscreen) {
            if (document.exitFullscreen) {
                const promise = document.exitFullscreen();
                if (promise && typeof promise.catch === 'function') {
                    promise.catch(err => console.warn('Exit fullscreen caught:', err));
                }
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            } else if (document.msExitFullscreen) {
                document.msExitFullscreen();
            } else if (document.mozCancelFullScreen) {
                document.mozCancelFullScreen();
            }
        }
    } catch (error) {
        console.warn('Failed to exit fullscreen:', error);
    } finally {
        // Also exit simulated fullscreen
        try {
            exitSimulatedFullscreen();
        } catch (e) {
            console.warn('Failed to exit simulated fullscreen:', e);
        }
        isFullscreen = false;
    }
}

function checkFullscreenStatus() {
    // For CSS simulation, we don't need to check browser fullscreen state
    if (isFullscreen) {
        console.log('CSS fullscreen simulation is active');
        return;
    }

    const isInBrowserFullscreen = document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.msFullscreenElement ||
        document.mozFullScreenElement;

    if (isExamActive && !isInBrowserFullscreen) {
        console.log('Detected exit from browser fullscreen, attempting to restore');
        handleCheating('Keluar dari mode layar penuh');
        // Force back to fullscreen
        setTimeout(() => {
            if (isExamActive) {
                if (isMobileDevice()) {
                    requestMobileFullscreen();
                } else {
                    requestFullscreen();
                }
            }
        }, 500);
    }
}

// Anti-Cheat Event Listeners
document.addEventListener('visibilitychange', () => {
    if (isExamActive) {
        if (document.visibilityState === 'hidden') {
            const cheatMask = document.getElementById('cheat-mask');
            if (cheatMask) {
                cheatMask.classList.remove('hidden');
                cheatMask.classList.add('flex');
            }
            handleCheating('Berpindah tab/aplikasi');
        } else {
            const cheatMask = document.getElementById('cheat-mask');
            if (cheatMask) {
                cheatMask.classList.add('hidden');
                cheatMask.classList.remove('flex');
            }
        }
    }
});

window.addEventListener('blur', () => {
    if (isExamActive) {
        if (typeof isMobileDevice === 'function' && isMobileDevice()) {
            const widthDiff = Math.abs(window.innerWidth - window.screen.width);
            if (widthDiff <= 25) return;
        }
        handleCheating('Meninggalkan jendela ujian');
    }
});

document.addEventListener('contextmenu', e => isExamActive && e.preventDefault());
document.addEventListener('copy', e => isExamActive && e.preventDefault());
document.addEventListener('cut', e => isExamActive && e.preventDefault());
document.addEventListener('paste', e => isExamActive && e.preventDefault());
document.addEventListener('selectstart', e => isExamActive && e.preventDefault());

document.addEventListener('keydown', e => {
    if (isExamActive) {
        if (e.key === 'PrintScreen' || e.keyCode === 44) {
            e.preventDefault();
            handleCheating('Screenshot terdeteksi');
        }
        if (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C')) e.preventDefault();
        if (e.key === 'F12') e.preventDefault();
        if (e.key === 'Escape' || e.key === 'F11') {
            e.preventDefault();
            handleCheating('Mencoba keluar dari mode layar penuh');
        }
    }
});

document.addEventListener('fullscreenchange', checkFullscreenStatus);
document.addEventListener('webkitfullscreenchange', checkFullscreenStatus);
document.addEventListener('mozfullscreenchange', checkFullscreenStatus);
document.addEventListener('MSFullscreenChange', checkFullscreenStatus);

window.addEventListener('resize', () => {
    if (isExamActive && isFullscreen) {
        const currentWidth = window.innerWidth;
        const currentHeight = window.innerHeight;
        const screenWidth = window.screen.width;
        const screenHeight = window.screen.height;

        const widthDiff = Math.abs(currentWidth - screenWidth);
        const heightDiff = Math.abs(currentHeight - screenHeight);

        if (typeof isMobileDevice === 'function' && isMobileDevice()) {
            if (widthDiff <= 25) return;
        }

        if (widthDiff > 20 || heightDiff > 20) {
            console.log('Window resize detected during exam, possible fullscreen exit attempt');
            handleCheating('Perubahan ukuran jendela terdeteksi');
            setTimeout(() => {
                if (isExamActive) {
                    simulateFullscreen();
                }
            }, 200);
        }
    }
});

// currentSiswa is declared globally in app-state.js

let editQuestionIndex = null;

let liveExamInterval = null;

async function requestMobileFullscreen() {
    console.log('Attempting mobile fullscreen');
    try {
        // First try standard fullscreen
        await requestFullscreen();
    } catch (error) {
        console.warn('Standard fullscreen failed on mobile, trying alternatives:', error);
        // On mobile, fullscreen might not work, so we'll use CSS simulation
        simulateFullscreen();
        // Also try to hide browser UI
        if (window.navigator.standalone === false) {
            // iOS Safari
            window.scrollTo(0, 1);
        }
        if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) {
            // PWA mode
            console.log('Running in PWA mode');
        }
    }
}

function viewQuestion(index) {
    if (index < 0 || index >= db.questions.length) {
        alert('Soal tidak ditemukan!');
        return;
    }
    const q = db.questions[index];
    let msg = `Soal: ${q.text}\n\nType: ${q.type}\nMapel: ${q.mapel}\nRombel: ${q.rombel}\n\n`;
    if (q.type === 'single' || q.type === 'multiple') {
        msg += `Opsi: ${Array.isArray(q.options) ? q.options.join(', ') : ''}\n`;
        if (Array.isArray(q.correct)) {
            msg += `Kunci: ${q.correct.map(i => ['A', 'B', 'C', 'D'][i]).join(', ')}`;
        } else {
            msg += `Kunci: ${['A', 'B', 'C', 'D'][q.correct]}`;
        }
    } else if (q.type === 'tf') {
        msg += Array.isArray(q.options) ? q.options.map((s, i) => `${s}: ${Array.isArray(q.correct) && q.correct[i] ? 'Benar' : 'Salah'}`).join('\n') : '';
    } else if (q.type === 'matching') {
        const questions = Array.isArray(q.questions) ? q.questions : [];
        const answers = Array.isArray(q.answers) ? q.answers : [];
        msg += 'Pasangan:\n';
        questions.forEach((question, i) => {
            msg += `${question} ⇔ ${answers[i] || '-'}\n`;
        });
    } else {
        msg += `Kunci: ${q.correct}`;
    }
    alert(msg);
}


async function previewQuestionImages(event) {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;

    if (!window.storedImages) window.storedImages = [];

    showToast('Memproses gambar...', 'info');

    for (const file of files) {
        try {
            const base64 = await new Promise(resolve => {
                const reader = new FileReader();
                reader.onload = e => resolve(e.target.result);
                reader.readAsDataURL(file);
            });

            if (file.type.startsWith('image/')) {
                const compressed = await compressImage(base64);
                const cloudUrl = await uploadImageToServer(compressed, file.name);
                window.storedImages.push(cloudUrl);
                console.log(`[STORAGE] Uploaded: ${file.name} -> ${cloudUrl}`);
            } else {
                window.storedImages.push(base64);
            }
        } catch (err) {
            console.error('Failed to upload image:', file.name, err);
            showToast('Gagal upload ' + file.name + ': ' + err.message, 'error');
        }
    }
    showToast('Proses upload selesai', 'success');
    renderImagePreviews();
}

function deleteQuestion(idx) {
    if (confirm("Hapus soal?")) {
        loadedCollections.questions = true;
        db.questions.splice(idx, 1);
        save();
        if (window.isTeacherMode || (currentSiswa && currentSiswa.role === 'teacher')) {
            if (typeof renderTeacherQuestions === 'function') renderTeacherQuestions();
        } else if (typeof renderAdminQuestions === 'function') {
            renderAdminQuestions();
        }
    }
}


function exportQuestions() {
    let questionsToExport = [];
    if (window.isTeacherMode || (currentSiswa && currentSiswa.role === 'teacher')) {
        // Konteks guru: export sesuai filter yang aktif dan hanya soal milik guru tersebut
        const fM = document.getElementById('teacher-filter-mapel')?.value || '';
        const fR = document.getElementById('teacher-filter-rombel')?.value || '';
        questionsToExport = db.questions.filter(q => {
            const qSubject = typeof q.mapel === 'string' ? q.mapel : q.mapel?.name || q.mapel;
            if (!teacherSubjectNames(currentSiswa).includes(qSubject)) return false;
            const allowed = teacherAllowedRombels(currentSiswa, qSubject);
            if (!allowed.includes(q.rombel)) return false;
            if (fM && qSubject !== fM) return false;
            if (fR && q.rombel !== fR) return false;
            return true;
        });
    } else {
        // Konteks admin: export sesuai filter admin
        const fR = document.getElementById('filter-rombel').value;
        const fM = document.getElementById('filter-mapel').value;
        questionsToExport = db.questions.filter(q =>
            (fR === 'ALL' || q.rombel === fR) && (fM === 'ALL' || q.mapel === fM)
        );
    }

    if (questionsToExport.length === 0) {
        alert('Tidak ada soal yang bisa diexport berdasarkan filter saat ini.');
        return;
    }

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(questionsToExport, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `soal_cbt_export_${new Date().getTime()}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
}

function moveQuestionUp(idx) {
    if (idx > 0) {
        [db.questions[idx], db.questions[idx - 1]] = [db.questions[idx - 1], db.questions[idx]];
        save();
        if (window.isTeacherMode || (currentSiswa && currentSiswa.role === 'teacher')) {
            renderTeacherQuestions();
        } else {
            renderAdminQuestions();
        }
    }
}

function moveQuestionDown(idx) {
    if (idx < db.questions.length - 1) {
        [db.questions[idx], db.questions[idx + 1]] = [db.questions[idx + 1], db.questions[idx]];
        save();
        if (window.isTeacherMode || (currentSiswa && currentSiswa.role === 'teacher')) {
            renderTeacherQuestions();
        } else {
            renderAdminQuestions();
        }
    }
}

function shuffleQuestionOptionsInBank(q) {
    if (!q || !Array.isArray(q.options) || q.options.length <= 1) return;
    const qType = q.type || 'single';

    if (qType === 'single') {
        const origOptions = [...q.options];
        const origCorrectIndex = typeof q.correct === 'number' ? q.correct : parseInt(q.correct);
        const indices = origOptions.map((_, i) => i);
        const shuffledIndices = shuffleArray(indices);

        const newOptions = shuffledIndices.map(i => origOptions[i]);
        let newCorrect = 0;
        if (!isNaN(origCorrectIndex) && origCorrectIndex >= 0 && origCorrectIndex < origOptions.length) {
            newCorrect = shuffledIndices.indexOf(origCorrectIndex);
        }

        q.options = newOptions;
        q.correct = newCorrect;

    } else if (qType === 'multiple') {
        const origOptions = [...q.options];
        const origCorrectArr = Array.isArray(q.correct) ? q.correct : [];
        const indices = origOptions.map((_, i) => i);
        const shuffledIndices = shuffleArray(indices);

        const newOptions = shuffledIndices.map(i => origOptions[i]);
        const newCorrect = origCorrectArr
            .map(oldIdx => shuffledIndices.indexOf(oldIdx))
            .filter(newIdx => newIdx !== -1)
            .sort((a, b) => a - b);

        q.options = newOptions;
        q.correct = newCorrect;

    } else if (qType === 'tf') {
        const origOptions = [...q.options];
        const origCorrectArr = Array.isArray(q.correct) ? q.correct : [];
        const indices = origOptions.map((_, i) => i);
        const shuffledIndices = shuffleArray(indices);

        const newOptions = shuffledIndices.map(i => origOptions[i]);
        const newCorrect = shuffledIndices.map(oldIdx => origCorrectArr[oldIdx] ?? false);

        q.options = newOptions;
        q.correct = newCorrect;
    }
}

examData = { mapel: "", questions: [], currentIdx: 0, answers: [], ragu: [], timer: null };


async function startExam(mapel) {
    console.log('[startExam] Starting for mapel:', mapel, 'student:', currentSiswa?.id);
    const qs = db.questions.filter(q => q.mapel === mapel && q.rombel === currentSiswa.rombel);
    console.log('[startExam] Questions found for mapel:', qs.length);

    console.log('[startExam] Checking for saved progress...');
    const saved = await getSavedStudentExamProgress(mapel);
    console.log('[startExam] getSavedStudentExamProgress returned:', saved ? { currentIdx: saved.currentIdx, answersLength: saved.answers?.length, source: saved.source } : null);

    if (saved && saved.mapel === mapel && Array.isArray(saved.answers) && saved.answers.length > 0) {
        console.log('[startExam] ✅ Found saved progress for mapel, resuming instead of restarting:', mapel, 'from index:', saved.currentIdx);
        await resumeStudentExam(saved);
        return;
    }

    console.log('[startExam] No saved progress found, starting fresh exam for mapel:', mapel);
    const shuffledQs = shuffleArray(qs);
    const normalizedQuestions = shuffledQs.map(q => {
        const studentQ = {
            ...q,
            type: q.type || 'single'
        };

        // Randomize option choices per student for questions with multiple options
        if (Array.isArray(q.options) && q.options.length > 1) {
            const indices = q.options.map((_, i) => i);
            const shuffledOptionIndices = shuffleArray(indices);
            studentQ.options = shuffledOptionIndices.map(i => q.options[i]);
            studentQ._shuffledOptionIndices = shuffledOptionIndices;
        }

        // Initialize matching shuffle indices if matching type
        if (studentQ.type === 'matching') {
            if (Array.isArray(q.answers)) {
                studentQ._shuffledAnswers = shuffleArray(q.answers);
            }
            if (Array.isArray(q.questions)) {
                const indices = q.questions.map((_, i) => i);
                studentQ._shuffledQuestionIndices = shuffleArray(indices);
            }
        }

        return studentQ;
    });

    // initialise answers based on question type (multiple => [], text => "", single => null)
    const answers = normalizedQuestions.map(q => {
        if (q.type === 'multiple') return [];
        if (q.type === 'text') return '';
        if (q.type === 'matching') return [];
        return null; // default single-choice
    });
    const ragu = normalizedQuestions.map(_ => false);
    examData = { mapel, questions: normalizedQuestions, currentIdx: 0, answers, ragu };

    // Tampilkan petunjuk ujian untuk siswa
    showStudentInstructionModal();

    // Reset and start anti-cheat
    cheatingCount = 0;
    isExamActive = true;
    examStartTime = Date.now();

    // Request fullscreen for exam
    if (typeof requestFullscreen === 'function') {
        requestFullscreen();
    }
    document.getElementById('cheat-mask').classList.add('hidden');

    document.getElementById('student-exam-list').classList.add('hidden');
    document.getElementById('exam-screen').classList.remove('hidden');
    document.getElementById('exam-meta').innerText = `${mapel} | ${currentSiswa.rombel}`;

    showQuestion(0);
    updateQuestionStatus();
    updateProgress();
    updateLiveExamStatus(true);
    if (liveExamInterval) clearInterval(liveExamInterval);
    liveExamInterval = setInterval(() => updateLiveExamStatus(true), 1000);
    console.log('[Student] Started live exam interval for:', mapel, 'studentId:', currentSiswa.id);

    const timeLimits = db.timeLimits || {};
    const key = `${currentSiswa.rombel}|${mapel}`.toLowerCase().trim();
    const timeLimit = timeLimits[key] || 60; // default 60 menit agar sama dengan admin
    examSecondsRemaining = timeLimit * 60;
    examData.totalSeconds = examSecondsRemaining;
    console.log('Starting exam for', key, 'timeLimit:', timeLimit, 'timeLimits:', timeLimits);
    startTimer(examSecondsRemaining);
    saveStudentExamProgress();
}

function showQuestion(idx) {
    examData.currentIdx = idx;
    const q = examData.questions[idx];
    document.getElementById('curr-q-num').innerText = idx + 1;
    document.getElementById('total-q-num').innerText = examData.questions.length;
    document.getElementById('exam-q-text').innerHTML = normalizeHtmlImages(q.text || '');
    // refresh progress display (including type)
    updateProgress();

    // make inline images zoomable inside question text
    const questionText = document.getElementById('exam-q-text');
    if (questionText) {
        const inlineImgs = questionText.querySelectorAll('img');
        inlineImgs.forEach((img, inlineIdx) => {
            img.classList.add('cursor-zoom-in');
            img.style.maxWidth = '100%';
            img.style.height = 'auto';
            img.setAttribute('loading', 'lazy');

            const externalCount = (q.images && Array.isArray(q.images) ? q.images.length : (q.image ? 1 : 0));
            img.addEventListener('click', () => openImageZoom(idx, externalCount + inlineIdx));
        });
    }

    // show images if available
    const imgContainer = document.getElementById('exam-images');
    imgContainer.innerHTML = '';
    if (q.images && Array.isArray(q.images) && q.images.length > 0) {
        q.images.forEach((img, imgIdx) => {
            const imgSrc = typeof img === 'string' ? normalizeImgSrc(img) : (img.data || '');
            imgContainer.innerHTML += `<div class="relative w-full cursor-pointer group hover:opacity-90 transition-opacity" onclick="openImageZoom(${idx}, ${imgIdx})">
                        <img src="${imgSrc}" alt="Gambar soal ${imgIdx + 1}" class="w-full h-auto rounded-lg border border-slate-300 shadow-sm object-contain" loading="lazy">
                        <span class="absolute top-2 right-2 bg-sky-600 text-white text-xs font-bold px-2 py-1 rounded">${imgIdx + 1}</span>
                        <div class="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100">
                            <i class="fas fa-search-plus text-white text-3xl"></i>
                        </div>
                    </div>`;
        });
        imgContainer.classList.remove('hidden');
    } else if (q.image) {
        const imgSrcSingle = typeof q.image === 'string' ? normalizeImgSrc(q.image) : (q.image.data || '');
        imgContainer.innerHTML = `<div class="relative w-full cursor-pointer group hover:opacity-90 transition-opacity" onclick="openImageZoom(${idx}, 0)">
                    <img src="${imgSrcSingle}" alt="Gambar soal" class="w-full h-auto rounded-lg border border-slate-300 shadow-sm object-contain" loading="lazy">
                    <div class="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100">
                        <i class="fas fa-search-plus text-white text-3xl"></i>
                    </div>
                </div>`;
        imgContainer.classList.remove('hidden');
    } else {
        imgContainer.classList.add('hidden');
    }

    let optionHtml = '';
    if (q.type === 'multiple') {
        // render checkboxes for multiple-choice
        optionHtml = q.options
            .map((opt, i) => ({ opt, i }))
            .filter(item => item.opt && item.opt.trim() !== '')
            .map((item, displayIdx) => {
                const { opt, i } = item;
                const checked = (examData.answers[idx] || []).includes(i) ? 'checked' : '';
                const label = String.fromCharCode(65 + displayIdx);
                return `
                    <label class="flex items-center w-full p-4 md:p-5 rounded-2xl border-2 transition-all ${checked ? 'border-sky-600 bg-sky-50 text-sky-700 font-bold' : 'border-slate-50 hover:bg-slate-50 text-slate-600'}">
                        <input type="checkbox" class="mr-3 w-5 h-5"
                            onchange="toggleAnswer(${i})" ${checked} />
                        <span class="inline-block w-8 font-bold">${label}.</span>
                        <span class="flex-1 text-sm md:text-base">${opt}</span>
                    </label>`;
            }).join('');

    } else if (q.type === 'text') {
        const value = examData.answers[idx] || '';
        optionHtml = `
                    <textarea id="text-answer" class="w-full p-4 md:p-5 border rounded-lg h-28 md:h-32 text-sm md:text-base" 
                        oninput="setAnswerText(this.value)">${value}</textarea>`;
    } else if (q.type === 'tf') {
        const ansArr = examData.answers[idx] || [];
        optionHtml = `
            <div class="tf-container animate-fade-in">
                ${q.options.map((stmt, j) => {
            const val = ansArr[j];
            const isAnswered = val === true || val === false;
            return `
                        <div class="tf-item ${isAnswered ? 'answered' : ''}">
                            <div class="tf-statement">
                                <span class="tf-statement-num">${j + 1}</span>
                                <span>${stmt}</span>
                            </div>
                            <div class="tf-options-stack">
                                <button onclick="setAnswerTF(${j}, true)" 
                                    class="tf-btn ${val === true ? 'active-true' : ''}">
                                    BENAR <i class="fas ${val === true ? 'fa-check-circle' : 'fa-circle'}"></i>
                                </button>
                                <button onclick="setAnswerTF(${j}, false)" 
                                    class="tf-btn ${val === false ? 'active-false' : ''}">
                                    SALAH <i class="fas ${val === false ? 'fa-times-circle' : 'fa-circle'}"></i>
                                </button>
                            </div>
                        </div>`;
        }).join('')}
            </div>`;
    } else if (q.type === 'matching') {
        // Runtime fallback: recover answers pool if it's empty (AI normalization edge case)
        if (!Array.isArray(q.answers) || q.answers.length === 0) {
            if (Array.isArray(q.correct) && q.correct.length > 0 &&
                q.correct.every(c => typeof c === 'string' && c.trim() !== '')) {
                q.answers = [...new Set(q.correct)];
            } else if (Array.isArray(q.options) && q.options.length > 0) {
                q.answers = q.options.map(o => String(o)).filter(o => o.trim() !== '');
            }
        }

        // Pastikan pilihan jawaban (pool) diacak sekali
        if (!Array.isArray(q._shuffledAnswers) || q._shuffledAnswers.length !== (q.answers?.length || 0)) {
            q._shuffledAnswers = shuffleArray(q.answers || []);
        }
        const shuffledAnswers = q._shuffledAnswers;
        examData.shuffledAnswers = shuffledAnswers;

        // Pastikan urutan pertanyaan (kiri) diacak sekali
        if (!Array.isArray(q._shuffledQuestionIndices) || q._shuffledQuestionIndices.length !== (q.questions?.length || 0)) {
            const indices = (q.questions || []).map((_, i) => i);
            q._shuffledQuestionIndices = shuffleArray(indices);
        }
        const questionIndices = q._shuffledQuestionIndices;
        const selected = examData.answers[idx] || [];

        optionHtml = `
                    <div class="matching-box animate-fade-in">
                        <div class="matching-header">
                            <div class="flex items-center gap-2 mb-3">
                                <i class="fas fa-list-check text-sky-600"></i>
                                <span class="text-xs font-black text-slate-500 uppercase tracking-widest">Referensi Pilihan Jawaban</span>
                            </div>
                            <div class="matching-legend-grid">
                                ${shuffledAnswers.map((ans, ai) => `
                                    <div class="matching-legend-item">
                                        <span class="matching-legend-label">${String.fromCharCode(65 + ai)}.</span>
                                        <span>${ans}</span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>

                        <div class="flex items-center gap-2 mb-4">
                            <i class="fas fa-layer-group text-sky-600"></i>
                            <span class="text-xs font-black text-slate-500 uppercase tracking-widest">Pasangkan Jawaban</span>
                        </div>
                        
                        <div class="matching-select-wrapper">
                            ${questionIndices.map((origQi, displayIdx) => {
            const quest = q.questions[origQi];
            return `
                                <div class="matching-item-card ${selected[origQi] != null ? 'answered' : ''}">
                                    <div class="flex items-center gap-3 flex-1">
                                        <div class="w-7 h-7 bg-slate-100 text-slate-600 rounded-lg flex items-center justify-center font-bold text-sm flex-shrink-0">${displayIdx + 1}</div>
                                        <div class="matching-question-text">${quest}</div>
                                    </div>
                                    <div class="w-full sm:w-64 md:w-80 flex-shrink-0">
                                        <select onchange="setMatchingAnswer(${origQi}, this.value)" class="matching-select">
                                            <option value="">Pilih Pasangan...</option>
                                            ${shuffledAnswers.map((ans, ai) => `
                                                <option value="${ai}" ${selected[origQi] == ai ? 'selected' : ''}>
                                                    ${String.fromCharCode(65 + ai)}. ${ans.length > 40 ? ans.substring(0, 37) + '...' : ans}
                                                </option>
                                            `).join('')}
                                        </select>
                                    </div>
                                </div>
                            `;
        }).join('')}
                        </div>
                    </div>
                `;
    } else {
        // default single-choice
        optionHtml = q.options
            .map((opt, i) => ({ opt, i }))
            .filter(item => item.opt && item.opt.trim() !== '')
            .map((item, displayIdx) => {
                const { opt, i } = item;
                const label = String.fromCharCode(65 + displayIdx);
                return `
                    <button onclick="setAnswer(${i})" class="w-full p-4 md:p-5 text-left rounded-2xl border-2 transition-all ${examData.answers[idx] === i ? 'border-sky-600 bg-sky-50 text-sky-700 font-bold' : 'border-slate-50 hover:bg-slate-50 text-slate-600'}">
                        <span class="inline-block w-8 font-bold">${label}.</span>
                        <span class="text-sm md:text-base">${opt}</span>
                    </button>`;
            }).join('');

    }
    document.getElementById('exam-options').innerHTML = optionHtml;

    // Update question status indicators
    updateQuestionStatus();
    updateDoubtBtn();
    updateProgress();

    document.getElementById('btn-prev').disabled = idx === 0;
    document.getElementById('btn-next').classList.toggle('hidden', idx === examData.questions.length - 1);
    document.getElementById('btn-finish').classList.toggle('hidden', idx !== examData.questions.length - 1);
}

function updateQuestionStatus() {
    const statusContainer = document.getElementById('question-status');

    const total = examData.questions.length;
    const unansweredIndices = [];
    examData.questions.forEach((_, i) => {
        const ans = examData.answers[i];
        const isAnswered = ans !== null && ans !== undefined && (
            Array.isArray(ans) ? ans.length > 0 :
                typeof ans === 'string' ? ans.trim() !== '' :
                    true
        );
        if (!isAnswered) unansweredIndices.push(i);
    });

    let indicesToRender;
    if (statusShowAll) {
        indicesToRender = [...Array(total).keys()];
    } else {
        if (unansweredIndices.length <= MAX_VISIBLE_STATUS) {
            indicesToRender = unansweredIndices.length ? unansweredIndices.slice() : [...Array(total).keys()];
        } else {
            indicesToRender = unansweredIndices.slice(0, MAX_VISIBLE_STATUS);
        }
    }
    if (!indicesToRender.includes(examData.currentIdx)) {
        indicesToRender.unshift(examData.currentIdx);
    }

    const buttons = indicesToRender.map(i => {
        const ans = examData.answers[i];
        const isAnswered = ans !== null && ans !== undefined && (
            Array.isArray(ans) ? ans.length > 0 :
                typeof ans === 'string' ? ans.trim() !== '' :
                    true
        );
        const isRagu = examData.ragu && examData.ragu[i];
        const isCurrent = i === examData.currentIdx;
        let bgColor;
        if (isRagu) {
            bgColor = 'bg-yellow-500 text-white hover:bg-yellow-600';
        } else if (isAnswered) {
            bgColor = 'bg-emerald-500 text-white hover:bg-emerald-600';
        } else {
            bgColor = 'bg-red-500 text-white hover:bg-red-600';
        }
        const ringClass = isCurrent ? 'ring-2 ring-sky-400 ring-offset-2' : '';
        return `<button onclick="showQuestion(${i})" class="w-10 h-10 rounded-lg font-bold text-sm transition-all ${bgColor} ${ringClass}">${i + 1}</button>`;
    });
    if (!statusShowAll && total > indicesToRender.length) {
        buttons.push(`<button onclick="toggleStatusView()" class="view-all w-10 h-10 rounded-lg font-bold text-sm transition-all">⋯</button>`);
    }
    if (statusShowAll && total > MAX_VISIBLE_STATUS) {
        buttons.push(`<button onclick="toggleStatusView()" class="view-all w-10 h-10 rounded-lg font-bold text-sm transition-all">×</button>`);
    }
    statusContainer.innerHTML = buttons.join('');
}

let lastLiveExamUpdate = 0;

let isUpdateLiveExamRunning = false;

async function updateLiveExamStatus(force = false) {
    if (isUpdateLiveExamRunning) return;
    isUpdateLiveExamRunning = true;
    try {
        await _updateLiveExamStatusInternal(force);
    } finally {
        isUpdateLiveExamRunning = false;
    }
}

async function _updateLiveExamStatusInternal(force = false) {
    if (!currentSiswa) {
        console.warn('[updateLiveExamStatus] missing currentSiswa');
        return;
    }
    if (currentSiswa.role !== 'student') {
        console.warn('[updateLiveExamStatus] not a student account:', currentSiswa.role);
        return;
    }
    if (!isExamActive) {
        console.warn('[updateLiveExamStatus] exam is not active');
        return;
    }
    if (!examData || !Array.isArray(examData.questions) || examData.questions.length === 0) {
        console.warn('[updateLiveExamStatus] invalid examData or no questions', examData);
        return;
    }
    const now = Date.now();
    if (!force && now - lastLiveExamUpdate < 1000) return;
    lastLiveExamUpdate = now;

    const total = examData.questions.length;
    const answeredCount = examData.answers.reduce((count, ans) => {
        const isAnswered = ans !== null && ans !== undefined && (
            Array.isArray(ans) ? ans.length > 0 :
                typeof ans === 'string' ? ans.trim() !== '' :
                    true
        );
        return count + (isAnswered ? 1 : 0);
    }, 0);
    const currentQuestionNumber = examData.currentIdx + 1;
    const percentage = total ? Math.round((answeredCount / total) * 100) : 0;

    let liveCorrectCount = 0;
    let liveTotalItems = 0;
    let liveAnsweredItemsCount = 0;
    examData.questions.forEach((q, i) => {
        if (!q) return;
        const ans = examData.answers[i];
        const qType = q.type || 'single';

        if (qType === 'tf' && Array.isArray(q.options)) {
            q.options.forEach((stmt, j) => {
                liveTotalItems++;
                const ansArr = Array.isArray(ans) ? ans : [];
                const studentVal = ansArr[j];
                if (studentVal !== null && studentVal !== undefined) {
                    liveAnsweredItemsCount++;
                    const origJ = getOriginalOptionIndex(q, j);
                    const corrVal = Array.isArray(q.correct) ? q.correct[origJ] : false;
                    if (studentVal === corrVal) liveCorrectCount++;
                }
            });
        } else if (qType === 'multiple') {
            const corr = Array.isArray(q.correct) ? q.correct : [];
            const ansArr = Array.isArray(ans) ? ans : [];
            const totalCorrectOptions = corr.length > 0 ? corr.length : 1;
            liveTotalItems += totalCorrectOptions;

            if (ansArr.length > 0) {
                // For simplicity, we count it as "answered" if at least one checkbox is ticked
                // But we only count "correct" for the fraction they got right
                liveAnsweredItemsCount += totalCorrectOptions;
                const origAnsArr = ansArr.map(dIdx => getOriginalOptionIndex(q, dIdx));
                const selectedCorrect = origAnsArr.filter(idx => corr.includes(idx)).length;
                liveCorrectCount += selectedCorrect;
            }
        } else if (qType === 'matching') {
            const ansArr = Array.isArray(ans) ? ans : [];
            const shuffled = Array.isArray(q._shuffledAnswers) ? q._shuffledAnswers : (q.answers || []);
            if (Array.isArray(q.questions)) {
                q.questions.forEach((_, qi) => {
                    liveTotalItems++;
                    const selectedIdx = ansArr[qi];
                    if (selectedIdx != null) {
                        liveAnsweredItemsCount++;
                        if (Array.isArray(q.correct) && shuffled[selectedIdx] === q.correct[qi]) {
                            liveCorrectCount++;
                        }
                    }
                });
            } else {
                liveTotalItems++;
            }
        } else {
            // Standard or Essay/Text
            liveTotalItems++;
            const isAnswered = ans !== null && ans !== undefined && (typeof ans === 'string' ? ans.trim() !== '' : true);
            if (isAnswered) {
                liveAnsweredItemsCount++;
                let isCorrect = false;
                if (q.correct !== undefined && q.correct !== null) {
                    if (qType === 'text') {
                        const corrText = (typeof q.correct === 'string' ? q.correct : '').trim().toLowerCase();
                        isCorrect = typeof ans === 'string' && ans.trim().toLowerCase() === corrText;
                    } else {
                        const origAns = getOriginalOptionIndex(q, ans);
                        isCorrect = origAns === q.correct;
                    }
                }
                if (isCorrect) liveCorrectCount++;
            }
        }
    });

    const existingIndex = (db.activeExams || []).findIndex(e => e.studentId === currentSiswa.id && e.mapel === examData.mapel && e.rombel === currentSiswa.rombel);

    // Calculate time remaining
    const timeLimits = db.timeLimits || {};
    const key = `${currentSiswa.rombel}|${examData.mapel}`.toLowerCase().trim();
    const timeLimitSeconds = (timeLimits[key] || 60) * 60; // convert minutes to seconds, default 60 agar sama dengan admin
    const elapsedSeconds = examStartTime ? Math.floor((Date.now() - examStartTime) / 1000) : 0;
    const timeRemaining = Math.max(0, timeLimitSeconds - elapsedSeconds);

    const existingEntry = existingIndex >= 0 ? db.activeExams[existingIndex] : null;
    const liveEntry = {
        studentId: currentSiswa.id,
        studentName: currentSiswa.name,
        rombel: currentSiswa.rombel,
        mapel: examData.mapel,
        currentIdx: examData.currentIdx,
        currentQuestionNumber,
        answeredCount,
        totalQuestions: total,
        correctCount: liveCorrectCount,
        answeredItemsCount: liveAnsweredItemsCount,
        totalItems: liveTotalItems,
        percentage,
        questionType: examData.questions[examData.currentIdx]?.type || 'single',
        answers: examData.answers,
        ragu: examData.ragu,
        startTime: examStartTime,
        timeRemaining,
        updatedAt: now,
        isActive: true,
        adminSaveRequest: existingEntry?.adminSaveRequest || false,
        adminReloadRequest: existingEntry?.adminReloadRequest || false,
        adminSaveConfirmed: existingEntry?.adminSaveConfirmed || false,
        savedByAdminCommand: existingEntry?.savedByAdminCommand || false,
        adminSavedProgress: existingEntry?.adminSavedProgress || null
    };
    if (!Array.isArray(db.activeExams)) db.activeExams = [];
    if (existingIndex >= 0) {
        db.activeExams[existingIndex] = liveEntry;
    } else {
        db.activeExams.push(liveEntry);
    }
    console.log('%c[Student] ✏️ Updated live exam status', 'color: darkcyan; font-weight: bold', {
        student: currentSiswa.name,
        mapel: examData.mapel,
        question: `Q${currentQuestionNumber}/${total}`,
        percentage,
        answered: answeredCount,
        timeRemaining,
        startTime: examStartTime
    });
    console.log('[Student] activeExams length after update', db.activeExams.length, 'liveExamInterval', liveExamInterval);
    try {
        await saveLocalDb();
        saveStudentExamProgress();
    } catch (err) {
        console.warn('[Student] ❌ IDB save failed:', err.message || err);
    }
    await sendLiveExamToServer(liveEntry);
    if (navigator.onLine) {
        const serverLiveExams = await fetchLiveExamsFromServer();
        await processAdminCommandsOnStudent(serverLiveExams);
    }
}

async function clearLiveExamStatus() {
    if (!currentSiswa || currentSiswa.role !== 'student') return;
    const norm = v => String(v || '').trim().toLowerCase();
    const sid = norm(currentSiswa.id);
    const srb = norm(currentSiswa.rombel);

    if (Array.isArray(db.activeExams)) {
        db.activeExams = db.activeExams.filter(e => !(norm(e.studentId) === sid && norm(e.rombel) === srb));
    }
    examStartTime = null;
    if (typeof clearStudentExamProgress === 'function') clearStudentExamProgress();

    if (navigator.onLine && typeof sendLiveExamToServer === 'function' && examData && examData.mapel) {
        try {
            await sendLiveExamToServer({
                studentId: currentSiswa.id,
                studentName: currentSiswa.name,
                rombel: currentSiswa.rombel,
                mapel: examData.mapel,
                isActive: false,
                adminSavedProgress: null,
                adminSaveConfirmed: false,
                savedByAdminCommand: false,
                updatedAt: Date.now()
            });
        } catch (err) {
            console.warn('[clearLiveExamStatus] Failed to notify server:', err);
        }
    }

    try {
        if (typeof saveLocalDb === 'function') await saveLocalDb();
    } catch (err) {
        console.warn('Gagal membersihkan live exam status:', err.message || err);
    }
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

async function fetchLiveExamsFromServer() {
    try {
        const url = getApiBaseUrl() + '/api/live-exams?_t=' + Date.now();
        console.log('%c[fetchLiveExamsFromServer]', 'color: purple; font-weight: bold', 'GET', url, 'navigator.onLine:', navigator.onLine);
        const res = await fetch(url);
        if (!res.ok) {
            const text = await res.text();
            console.warn('[fetchLiveExamsFromServer] HTTP', res.status, ':', text);
            throw new Error(`Server responded ${res.status}`);
        }
        const data = await res.json();
        console.log('%c[fetchLiveExamsFromServer] ✅ Success:', 'color: purple', data?.length || 0, 'exams');
        if (data.length > 0) {
            console.log('  Data:', data.map(e => `${e.studentId}/${e.mapel}`));
        }
        return Array.isArray(data) ? data : [];
    } catch (err) {
        console.warn('%c[fetchLiveExamsFromServer] ❌ Error:', 'color: red', err.message);
        return [];
    }
}

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

function shuffleArray(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function getOriginalOptionIndex(q, displayIdx) {
    if (displayIdx === null || displayIdx === undefined) return null;
    if (q && Array.isArray(q._shuffledOptionIndices) && q._shuffledOptionIndices[displayIdx] !== undefined) {
        return q._shuffledOptionIndices[displayIdx];
    }
    return displayIdx;
}

function startTimer(sec) {
    clearInterval(examData.timer);
    examSecondsRemaining = sec;
    const timerEl = document.getElementById('timer');
    if (timerEl) timerEl.classList.remove('animate-blink-red');

    examData.timer = setInterval(() => {
        sec--;
        examSecondsRemaining = sec;
        const h = Math.floor(sec / 3600);
        const m = Math.floor((sec % 3600) / 60);
        const s = sec % 60;
        if (h > 0) {
            document.getElementById('timer').innerText = `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        } else {
            document.getElementById('timer').innerText = `${m}:${String(s).padStart(2, '0')}`;
        }

        // Efek visual berkedip merah saat sisa 5 menit
        if (sec <= 300 && timerEl) {
            timerEl.classList.add('animate-blink-red');
        }

        // Tambahkan peringatan sisa waktu
        if (sec === 300) {
            showToast("Peringatan: Sisa waktu 5 menit!", "info");
        } else if (sec === 60) {
            showToast("Peringatan: Sisa waktu 1 menit! Segera selesaikan jawaban Anda.", "error");
        }

        if (sec <= 0) {
            showToast("Waktu habis! Jawaban Anda otomatis dikirim.", "error");
            submitExam();
        }
    }, 1000);
}

async function finishExam() {
    // Calculate answered vs total
    const total = examData.questions.length;
    const answeredCount = examData.answers.reduce((count, ans) => {
        const isAnswered = ans !== null && ans !== undefined && (
            Array.isArray(ans) ? ans.length > 0 :
                typeof ans === 'string' ? ans.trim() !== '' :
                    true
        );
        return count + (isAnswered ? 1 : 0);
    }, 0);
    const unansweredCount = total - answeredCount;

    // Update modal UI
    document.getElementById('confirm-answered-count').innerText = answeredCount;
    document.getElementById('confirm-unanswered-count').innerText = unansweredCount;

    const warning = document.getElementById('unanswered-warning');
    if (unansweredCount > 0) {
        warning.classList.remove('hidden');
        warning.classList.add('flex');
    } else {
        warning.classList.add('hidden');
        warning.classList.remove('flex');
    }

    // Show modal
    const modal = document.getElementById('confirm-finish-modal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

async function submitExam() {
    // IMMEDIATE UI TRANSITION: Stop exam and hide screens before processing heavy data
    isExamActive = false;
    if (liveExamInterval) {
        clearInterval(liveExamInterval);
        liveExamInterval = null;
    }
    await clearLiveExamStatus();
    // Release fullscreen and wake lock
    exitFullscreen();
    releaseWakeLock();
    closeConfirmModal();
    closeCheatWarning();
    clearInterval(examData.timer);

    // Hide question UI immediately so it doesn't look "stuck"
    document.getElementById('exam-screen').classList.add('hidden');

    // Show processing modal
    const savingModal = document.getElementById('saving-modal');
    const savingProg = document.getElementById('saving-progress-bar');
    if (savingModal) {
        savingModal.classList.remove('hidden');
        savingModal.classList.add('flex');
        if (savingProg) savingProg.style.width = '30%';
    }

    // RANDOM DELAY: 2-12 seconds to ensure stability (Sequential Render Queue)
    const randomDelay = Math.floor(Math.random() * (12000 - 2000 + 1)) + 2000;
    console.log(`[QUEUE] Enforcing sequential wait: ${randomDelay}ms`);

    // Simulasikan progress bar visual
    const progressInterval = setInterval(() => {
        if (savingProg) {
            const currentWidth = parseFloat(savingProg.style.width);
            if (currentWidth < 90) savingProg.style.width = (currentWidth + 5) + '%';
        }
    }, randomDelay / 10);

    await new Promise(resolve => setTimeout(resolve, randomDelay));
    clearInterval(progressInterval);
    if (savingProg) savingProg.style.width = '100%';

    let correctCount = 0;

    // VALIDASI: Pastikan questions dan answers punya panjang yang sama
    if (!Array.isArray(examData.questions) || !Array.isArray(examData.answers)) {
        console.error('ERROR: Questions atau answers bukan array!');
        alert('Terjadi error saat merekam ujian. Silakan hubungi administrator.');
        return;
    }

    if (examData.questions.length !== examData.answers.length) {
        console.warn(`WARNING: Jumlah soal (${examData.questions.length}) != jumlah jawaban (${examData.answers.length})`);
        // Pad answers array jika kurang
        while (examData.answers.length < examData.questions.length) {
            examData.answers.push(null);
        }
    }

    // Each question contributes one point to the final score.
    // For TF questions we treat every individual statement as a
    // separate scoring item; for complex multiple-choice each
    // option is an item.  The student's score is calculated as
    // (#correctItems / #totalItems) * 100.  In other words, the
    // one-point question is divided evenly across all statements /
    // options (i.e. score per statement = 1/totalItems), so a
    // partially correct TF/multiple question gives fractional credit.
    // This matches the requirement: "skor 1 soal dibagi pernyataan
    // yang dijawab dengan benar" (and similarly for multiple choice).
    // The debug logs below print the intermediate counts.
    // count answers at the granularity of TF statements
    let totalItems = 0;
    examData.questions.forEach((q, i) => {
        const ans = examData.answers[i];

        // VALIDASI: Pastikan question memiliki kunci jawaban (gunakan default type 'single' jika tidak ada)
        if (!q || q.correct === undefined) {
            console.warn(`WARNING: Soal ${i} tidak valid:`, q);
            return;
        }
        const qType = q.type || 'single'; // Default ke single-choice jika tidak ada type

        if (qType === 'tf' && Array.isArray(q.options)) {
            // tiap pernyataan dianggap satu item dalam perhitungan skor
            const ansArr = Array.isArray(ans) ? ans : [];
            q.options.forEach((stmt, j) => {
                totalItems++;
                const origJ = getOriginalOptionIndex(q, j);
                const corrVal = Array.isArray(q.correct) ? q.correct[origJ] : false;
                const studentVal = ansArr[j];
                if (studentVal === corrVal) {
                    correctCount++;
                }
            });
        } else if (qType === 'multiple') {
            // per-option scoring untuk pilihan ganda kompleks
            const corr = Array.isArray(q.correct) ? q.correct : [];
            const ansArr = Array.isArray(ans) ? ans : [];
            const origAnsArr = ansArr.map(dIdx => getOriginalOptionIndex(q, dIdx));
            const selectedCorrect = origAnsArr.filter(idx => corr.includes(idx)).length;

            const totalCorrectOptions = corr.length > 0 ? corr.length : 1;
            totalItems += totalCorrectOptions;
            correctCount += selectedCorrect;
        } else if (qType === 'matching') {
            const ansArr = Array.isArray(ans) ? ans : [];
            const shuffled = Array.isArray(q._shuffledAnswers) ? q._shuffledAnswers : (q.answers || []);

            // SAFETY: Ensure both prompt questions and correct answers exist
            if (Array.isArray(q.questions) && Array.isArray(q.correct)) {
                q.questions.forEach((_, qi) => {
                    totalItems++;
                    const selectedIdx = ansArr[qi];
                    const selectedStr = (selectedIdx != null && shuffled[selectedIdx] !== undefined) ? String(shuffled[selectedIdx]) : null;
                    const correctStr = q.correct[qi] !== undefined ? String(q.correct[qi]) : null;
                    if (selectedStr !== null && correctStr !== null && selectedStr === correctStr) {
                        correctCount++;
                    }
                });
            } else {
                console.warn(`[SCORE] SKIPPING matching question ${i} due to missing questions/correct data`);
                // Still increment totalItems by 1 to represent the question exists
                totalItems += 1;
            }
        } else {
            // non-TF and non-multiple questions still contribute satu item
            totalItems++;
            let correct = false;

            if (qType === 'text') {
                const corrText = (typeof q.correct === 'string' ? q.correct : '').trim().toLowerCase();
                correct = typeof ans === 'string' && ans.trim().toLowerCase() === corrText;
            } else {
                // Single choice (default)
                const origAns = getOriginalOptionIndex(q, ans);
                correct = origAns === q.correct;
            }

            if (correct) correctCount++;
        }
    });

    // DEBUG: Log perhitungan skor
    console.log('[SCORE DEBUG] Total items:', totalItems, 'Jawaban benar:', correctCount);
    console.log('[SCORE DEBUG] Perhitungan: (', correctCount, '/', totalItems, ') * 100 =', (totalItems ? (correctCount / totalItems) * 100 : 0));

    const score = totalItems ? ((correctCount / totalItems) * 100).toFixed(1) : 0;

    // Save essential question data (without images) so teachers/admins can view answers.
    // Restores original option order if options were shuffled.
    const savedQuestions = examData.questions.map(q => {
        const essential = {
            text: q.text || '',
            type: q.type || 'single',
            correct: q.correct,
        };
        if (Array.isArray(q.options)) {
            if (Array.isArray(q._shuffledOptionIndices)) {
                const origOptions = [];
                q._shuffledOptionIndices.forEach((origIdx, displayIdx) => {
                    origOptions[origIdx] = q.options[displayIdx];
                });
                essential.options = origOptions;
            } else {
                essential.options = q.options;
            }
        }
        if (Array.isArray(q.questions)) essential.questions = q.questions; // for matching
        if (Array.isArray(q.answers)) essential.answers = q.answers;       // for matching
        // intentionally omit q.images / q.image to keep payload small
        return essential;
    });

    // Transform student display choices back to original option indices before saving
    const savedAnswers = examData.answers.map((ans, i) => {
        const q = examData.questions[i];
        if (!q) return ans;
        if (q.type === 'matching' && Array.isArray(ans)) {
            const shuffled = q._shuffledAnswers || q.answers || [];
            return ans.map(ai => (ai !== null && ai !== undefined) ? shuffled[ai] : null);
        }
        if ((q.type === 'single' || !q.type) && typeof ans === 'number') {
            return getOriginalOptionIndex(q, ans);
        }
        if (q.type === 'multiple' && Array.isArray(ans)) {
            return ans.map(dIdx => getOriginalOptionIndex(q, dIdx));
        }
        if (q.type === 'tf' && Array.isArray(ans)) {
            const origAns = [];
            ans.forEach((val, dIdx) => {
                const origJ = getOriginalOptionIndex(q, dIdx);
                origAns[origJ] = val;
            });
            return origAns;
        }
        return ans;
    });

    const newEntry = {
        studentId: currentSiswa.id,
        studentName: currentSiswa.name,
        rombel: currentSiswa.rombel,
        mapel: examData.mapel,
        score: score,
        date: new Date().toISOString(),
        answers: savedAnswers, // Save transformed answers
        questions: savedQuestions // Save the questions with all essential data
    };
    db.results.push(newEntry);
    updateCompletionCharts();

    let directSyncError = null;
    let backgroundSaveError = null;

    try {
        // 1. Mandatory Single Result Sync (The most critical part)
        try {
            await sendResult(newEntry);
        } catch (e) {
            console.warn('[SUBMIT] Direct result sync failed, relying on background save:', e.message || e);
            directSyncError = e;
        }

        // 2. Background Full DB Save (Updates IndexedDB and triggers fallback sync)
        try {
            await save();
        } catch (e) {
            console.warn('[SUBMIT] Background database save encountered an issue:', e.message || e);
            backgroundSaveError = e;
        }
    } finally {
        // ALWAYS close the modal regardless of network state
        if (savingModal) {
            savingModal.classList.add('hidden');
            savingModal.classList.remove('flex');
        }
    }

    if (directSyncError || backgroundSaveError) {
        // Hapus entry yang gagal dari state agar tidak dobel saat ditekan "Coba Lagi"
        db.results.pop();

        const failModal = document.getElementById('failed-result');
        if (failModal) {
            let errMsg = "Koneksi ke server terputus atau gagal terakses.";
            if (backgroundSaveError) errMsg = "Penyimpanan lokal dan server mengalami masalah.";
            document.getElementById('failed-result-msg').innerHTML = `${errMsg}<br>Silakan periksa koneksi internet atau server, lalu <b>coba lagi</b>.`;
            failModal.classList.remove('hidden');
            const scoreRes = document.getElementById('score-result');
            if (scoreRes) scoreRes.classList.add('hidden');
        } else {
            alert('GAGAL TERSIMPAN: Periksa koneksi Anda dan coba lagi.');
        }
        return; // Stop here, so we don't show the success UI
    }

    clearStudentExamProgress();

    // refresh admin/teacher views if they're visible so the new score
    // shows up right away
    if (document.getElementById('admin-dashboard') &&
        !document.getElementById('admin-dashboard').classList.contains('hidden') &&
        !document.getElementById('admin-results').classList.contains('hidden')) {
        renderAdminResults();
    }
    if (document.getElementById('teacher-dashboard') &&
        !document.getElementById('teacher-dashboard').classList.contains('hidden') &&
        document.getElementById('teacher-tab-hasil-ujian') &&
        !document.getElementById('teacher-tab-hasil-ujian').classList.contains('text-slate-400')) {
        renderTeacherResults();
    }

    const successModal = document.getElementById('score-result');
    if (successModal) successModal.classList.remove('hidden');
    const failModalUI = document.getElementById('failed-result');
    if (failModalUI) failModalUI.classList.add('hidden');
    document.getElementById('final-score-val').innerText = score;
}

let currentZoomQuestion = null;

function getQuestionImageSources(q) {
    const sources = [];
    const extractSrc = item => {
        if (!item) return '';
        if (typeof item === 'string') return item;
        return item.data || item.src || '';
    };

    if (q.images && Array.isArray(q.images)) {
        q.images.forEach(img => {
            const src = extractSrc(img);
            if (src) sources.push(src);
        });
    } else if (q.image) {
        const src = extractSrc(q.image);
        if (src) sources.push(src);
    }

    if (typeof q.text === 'string' && q.text.includes('<img')) {
        const imgRegex = /<img[^>]+src=(?:"|')([^"'>]+)(?:"|')[^>]*>/gi;
        let match;
        while ((match = imgRegex.exec(q.text)) !== null) {
            if (match[1]) sources.push(match[1]);
        }
    }

    return sources;
}

async function generateQuestionsWithAi() {
    const materi = document.getElementById('ai-materi')?.value.trim();
    const mapel = document.getElementById('ai-mapel')?.value;
    const rombel = document.getElementById('ai-rombel')?.value;
    const file = document.getElementById('ai-blueprint-file')?.files[0];
    const oldJumlah = document.getElementById('ai-jumlah');
    const oldType = document.getElementById('ai-type');

    const typeCounts = getAiTypeCounts();
    let jumlah = Object.values(typeCounts).reduce((sum, n) => sum + (Number(n) || 0), 0);
    let tipe = 'single';

    if (oldJumlah && oldType) {
        jumlah = Number(oldJumlah.value) || 0;
        tipe = oldType.value || 'single';
        if (jumlah > 0 && jumlah !== Object.values(typeCounts).reduce((sum, n) => sum + (Number(n) || 0), 0)) {
            typeCounts[tipe] = jumlah;
        }
    }

    if (!materi && !file) {
        alert('Harap masukkan materi/topik atau upload kisi-kisi!');
        return;
    }
    if (!mapel) {
        alert('Pilih mata pelajaran!');
        return;
    }
    if (!rombel) {
        alert('Pilih rombel!');
        return;
    }
    if (jumlah <= 0) {
        alert('Harap pilih jumlah soal minimal 1!');
        return;
    }

    const levelCounts = getAiLevelCounts(jumlah);
    const opsiGambar = document.getElementById('ai-opsi-gambar')?.value || 'none';
    const loading = document.getElementById('ai-loading');
    if (loading) {
        loading.classList.remove('hidden');
        loading.classList.add('flex');
    }

    try {
        const response = await fetch(getApiBaseUrl() + '/api/generate-ai', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                materi, jumlah, tipe, mapel, rombel, typeCounts, levelCounts, opsiGambar,
                teacherId: (currentSiswa && currentSiswa.role === 'teacher') ? currentSiswa.id : null
            })
        });

        const result = await response.json();

        if (result.ok) {
            const newQuestions = result.questions.map(q => ({
                ...q,
                id: Date.now() + Math.random().toString(36).substr(2, 4),
                createdAt: new Date().toISOString()
            }));

            db.questions = [...db.questions, ...newQuestions];
            await save();

            alert(`Berhasil membuat ${newQuestions.length} soal baru dengan AI!`);
            closeModals();

            if (typeof renderAdminQuestions === 'function') renderAdminQuestions();
            if (typeof renderTeacherQuestions === 'function') renderTeacherQuestions();
        } else {
            const explanation = getAIErrorExplanation(result.error);
            alert('Error AI: ' + (result.error || 'Gagal generate soal') + (explanation ? '\n\n' + explanation : ''));
        }
    } catch (err) {
        console.error('AI Generation Error:', err);
        if (window.isStaticMode || window.location.hostname.includes('github.io')) {
            alert('Kesalahan AI: Fitur ini membutuhkan Backend Node.js yang berjalan.\n\nJika anda menjalankan di GitHub, silakan hubungkan ke Backend eksternal via Administrator > Settings.');
        } else {
            alert('Terjadi kesalahan saat memanggil AI: ' + (err.message || 'Error tidak diketahui'));
        }
    } finally {
        if (loading) {
            loading.classList.add('hidden');
            loading.classList.remove('flex');
        }
    }
}



async function renderStudentExamList() {
    const container = document.getElementById('student-exam-list');
    if (!container) return;

    // Ensure core data is loaded for the student view (force load results for freshness)
    if (typeof ensureDataLoaded === 'function') {
        await ensureDataLoaded('questions');
        await ensureDataLoaded('results', true);
    }

    if (!currentSiswa || !currentSiswa.rombel) {
        container.innerHTML = `<div class="col-span-full text-center py-20"><p class="text-slate-400 font-bold">Data siswa tidak teridentifikasi.</p></div>`;
        return;
    }

    const norm = v => String(v || '').trim().toLowerCase();
    const myStudentId = norm(currentSiswa.id);
    const myRombel = currentSiswa.rombel;
    const questions = Array.isArray(db?.questions) ? db.questions : [];
    const availableMapels = [...new Set(questions.filter(q => norm(q.rombel) === norm(myRombel)).map(q => q.mapel))];

    if (availableMapels.length === 0) {
        container.innerHTML = `<div class="col-span-full text-center py-20"><p class="text-slate-400 font-bold">Belum ada ujian tersedia untuk rombel ${myRombel}.</p></div>`;
        return;
    }

    const schoolInfo = typeof getSchoolSettings === 'function' ? getSchoolSettings() : { name: 'DR CBT' };

    container.innerHTML = availableMapels.map(m => {
        const subjects = Array.isArray(db?.subjects) ? db.subjects : [];
        const subjectObj = subjects.find(s => typeof getSubjectName === 'function' ? getSubjectName(s) === m : (typeof s === 'string' ? s === m : s.name === m));
        const scheduleKey = `${myRombel}|${m}`;
        const jenisKey = `${m}|${myRombel}`;
        const currentJenis = db.jenisUjian && db.jenisUjian[jenisKey] ? db.jenisUjian[jenisKey] : 'Ujian Semester';

        if (currentJenis === 'HIDDEN') return '';

        const isScheduleActive = !db.schedules || db.schedules.length === 0 || db.schedules.includes(scheduleKey);
        const isLocked = subjectObj && subjectObj.locked;
        const results = Array.isArray(db?.results) ? db.results : [];
        const mNorm = norm(m);

        const alreadyDone = results.find(r => {
            if (!r || r.deleted) return false;
            const rSid = norm(r.studentId || r.student_id);
            const rMapel = norm(r.mapel);
            return rSid === myStudentId && rMapel === mNorm;
        });

        const isNotAccessible = !isScheduleActive || isLocked;

        return `
            <div class="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm transition-all hover:shadow-xl">
                <div class="flex justify-between items-start mb-6">
                    <div class="w-12 h-12 bg-sky-100 text-sky-600 rounded-2xl flex items-center justify-center text-xl"><i class="fas fa-file-alt"></i></div>
                    ${isNotAccessible ? '<span class="px-3 py-1 bg-red-100 text-red-600 rounded-full text-[10px] font-black uppercase flex items-center gap-1"><i class="fas fa-lock"></i> Belum Dibuka</span>' : alreadyDone ? '<span class="px-3 py-1 bg-emerald-100 text-emerald-600 rounded-full text-[10px] font-black uppercase">Selesai</span>' : '<span class="px-3 py-1 bg-amber-100 text-amber-600 rounded-full text-[10px] font-black uppercase">Tersedia</span>'}
                </div>
                <h3 class="text-lg font-black text-slate-800 mb-1">${m}</h3>
                <p class="text-slate-400 text-xs mb-6 font-medium">${currentJenis} - ${schoolInfo?.name || 'DR CBT'}</p>
                ${isNotAccessible ?
                `<button disabled class="w-full py-4 bg-slate-300 text-slate-600 font-bold rounded-2xl cursor-not-allowed">BELUM DIBUKA</button>` :
                alreadyDone ?
                    `<div class="flex items-center gap-2 text-sky-600 font-black">Skor: ${alreadyDone.score}</div>` :
                    `<button onclick="startExam('${m}')" class="w-full py-4 bg-slate-900 text-white font-bold rounded-2xl hover:bg-sky-600 transition-all">MULAI UJIAN</button>`
            }
            </div>
        `;
    }).join('');
}

function showStudentInstructionModal() {
    const modal = document.getElementById('student-instruction-modal');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
}

function closeStudentInstructionModal() {
    const modal = document.getElementById('student-instruction-modal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}

function loadStudentExamProgress() {
    try {
        const saved = localStorage.getItem(STUDENT_EXAM_PROGRESS_KEY);
        return saved ? JSON.parse(saved) : null;
    } catch (e) {
        console.warn('[loadStudentExamProgress] Failed to load saved student exam progress:', e.message);
        return null;
    }
}

function saveStudentExamProgress() {
    if (!currentSiswa || currentSiswa.role !== 'student' || !examData || !examData.mapel) return;
    let checkpoint = null;

    if (examData.adminSavedProgress && examData.adminSavedProgress.answers) {
        checkpoint = {
            studentId: currentSiswa.id,
            studentName: currentSiswa.name,
            rombel: currentSiswa.rombel,
            mapel: examData.mapel,
            currentIdx: examData.adminSavedProgress.currentIdx,
            answers: examData.adminSavedProgress.answers,
            ragu: examData.adminSavedProgress.ragu || [],
            totalSeconds: examData.adminSavedProgress.totalSeconds || 0,
            remainingSeconds: examData.adminSavedProgress.remainingSeconds || 0,
            savedAt: examData.adminSavedProgress.savedAt || Date.now(),
            savedByAdminCommand: true,
            adminSaveConfirmed: true,
            adminSavedProgress: examData.adminSavedProgress
        };
    } else if (examData.savedByAdminCommand && examData.answers) {
        checkpoint = {
            studentId: currentSiswa.id,
            studentName: currentSiswa.name,
            rombel: currentSiswa.rombel,
            mapel: examData.mapel,
            currentIdx: examData.currentIdx,
            answers: examData.answers,
            ragu: examData.ragu || [],
            totalSeconds: examData.totalSeconds || examSecondsRemaining || 0,
            remainingSeconds: examSecondsRemaining,
            savedAt: Date.now(),
            savedByAdminCommand: true,
            adminSaveConfirmed: true
        };
    } else {
        return;
    }

    if (!checkpoint) return;
    try {
        localStorage.setItem(STUDENT_ADMIN_SAVED_PROGRESS_KEY, JSON.stringify(checkpoint));
        console.log('[saveStudentExamProgress] ✅ Checkpoint saved:', { currentIdx: checkpoint.currentIdx, answersCount: checkpoint.answers.length });
    } catch (e) {
        console.warn('[saveStudentExamProgress] Failed to persist admin checkpoint:', e.message);
    }
}

function loadAdminSavedProgress() {
    try {
        const saved = localStorage.getItem(STUDENT_ADMIN_SAVED_PROGRESS_KEY);
        return saved ? JSON.parse(saved) : null;
    } catch (e) {
        console.warn('[loadAdminSavedProgress] Failed to load admin saved progress:', e.message);
        return null;
    }
}

function clearStudentExamProgress() {
    try {
        localStorage.removeItem(STUDENT_EXAM_PROGRESS_KEY);
        localStorage.removeItem(STUDENT_ADMIN_SAVED_PROGRESS_KEY);
    } catch (e) {
        console.warn('[clearStudentExamProgress] Failed to clear exam progress:', e.message);
    }
}

async function getSavedStudentExamProgress(mapel = null) {
    const matchSaved = saved => {
        if (!saved || !saved.studentId || !saved.rombel || !saved.mapel || !Array.isArray(saved.answers)) return false;

        const norm = v => String(v || '').trim().toLowerCase();
        const idMatch = norm(saved.studentId) === norm(currentSiswa.id);
        const rombelMatch = norm(saved.rombel) === norm(currentSiswa.rombel);
        const mapelMatch = !mapel || norm(saved.mapel) === norm(mapel);

        if (!idMatch || !rombelMatch || !mapelMatch) return false;
        if (!saved.savedByAdminCommand && !saved.adminSaveConfirmed) return false;

        const hasAnswers = saved.answers.length > 0;
        if (!hasAnswers) {
            console.log('[matchSaved] Checkpoint found but has 0 answers, ignoring.');
            return false;
        }
        return true;
    };

    if (navigator.onLine && typeof fetchLiveExamsFromServer === 'function') {
        try {
            if (mapel) {
                console.log('[getSavedStudentExamProgress] Checking server for checkpoint:', currentSiswa.id, 'mapel:', mapel);
                try {
                    const url = getApiBaseUrl() + `/api/saved-exam/${encodeURIComponent(currentSiswa.id)}/${encodeURIComponent(mapel)}?rombel=${encodeURIComponent(currentSiswa.rombel)}`;
                    const res = await fetch(url);
                    if (res.ok) {
                        const data = await res.json();
                        if (data.ok && data.exam) {
                            const exact = data.exam;
                            console.log('[getSavedStudentExamProgress] ✅ Found server checkpoint');
                            const saved = {
                                studentId: exact.studentId,
                                studentName: exact.studentName,
                                rombel: exact.rombel,
                                mapel: exact.mapel,
                                currentIdx: Number.isInteger(exact.adminSavedProgress?.currentIdx) ? exact.adminSavedProgress.currentIdx : 0,
                                answers: exact.adminSavedProgress?.answers || [],
                                ragu: Array.isArray(exact.adminSavedProgress?.ragu) ? exact.adminSavedProgress.ragu : [],
                                remainingSeconds: Number(exact.adminSavedProgress?.remainingSeconds) || Number(exact.adminSavedProgress?.timeRemaining) || 0,
                                totalSeconds: Number(exact.adminSavedProgress?.totalSeconds) || 0,
                                savedAt: exact.adminSavedProgress?.savedAt || Date.now(),
                                source: 'server_checkpoint',
                                savedByAdminCommand: true,
                                adminSaveConfirmed: true
                            };
                            return saved;
                        } else {
                            console.log('[getSavedStudentExamProgress] 🗑️ Server has no checkpoint. Clearing local cache for consistency.');
                            clearStudentExamProgress();
                        }
                    }
                } catch (e2) {
                    console.warn('[getSavedStudentExamProgress] Specific endpoint failed:', e2.message);
                }
            }
        } catch (e) {
            console.warn('[getSavedStudentExamProgress] Server check failed:', e.message);
        }
    }

    const localSaved = loadAdminSavedProgress();
    console.log('[getSavedStudentExamProgress] Local saved:', !!localSaved);
    if (localSaved && matchSaved(localSaved)) {
        console.log('[getSavedStudentExamProgress] ✅ Using local saved progress');
        return { ...localSaved, source: 'localStorage' };
    }

    console.log('[getSavedStudentExamProgress] ❌ No saved progress found anywhere');
    return null;
}

async function resumeStudentExam(saved) {
    if (!saved || !saved.mapel || !Array.isArray(saved.answers)) return false;
    console.log('[resumeStudentExam] Resuming exam from saved progress:', { mapel: saved.mapel, currentIdx: saved.currentIdx, answersCount: saved.answers.length, source: saved.source });

    const questions = db.questions.filter(q => q.mapel === saved.mapel && q.rombel === currentSiswa.rombel);
    if (!questions.length) {
        console.warn('[resumeStudentExam] No questions found for mapel:', saved.mapel);
        clearStudentExamProgress();
        return false;
    }

    const normalizedQuestions = questions.map(q => ({ ...q, type: q.type || 'single' }));
    const answers = saved.answers.slice(0, normalizedQuestions.length);
    const ragu = Array.isArray(saved.ragu) ? saved.ragu : normalizedQuestions.map(() => false);

    const timeLimits = db.timeLimits || {};
    const key = `${currentSiswa.rombel}|${saved.mapel}`.toLowerCase().trim();
    const totalSeconds = (timeLimits[key] || 60) * 60;
    let remainingSeconds = Number(saved.remainingSeconds) || Number(saved.timeRemaining) || totalSeconds;
    if (remainingSeconds <= 0) remainingSeconds = totalSeconds;

    examData = {
        mapel: saved.mapel,
        questions: normalizedQuestions,
        currentIdx: Number.isInteger(saved.currentIdx) ? saved.currentIdx : 0,
        answers,
        ragu,
        timer: null,
        totalSeconds,
    };

    if (typeof showToast === 'function') {
        showToast(`✅ Progres ujian ${saved.mapel} dipulihkan! Anda dapat melanjutkan pengerjaan soal.`, 'success');
    }

    isExamActive = true;
    cheatingCount = 0;
    examSecondsRemaining = remainingSeconds;
    examStartTime = Date.now() - ((totalSeconds - remainingSeconds) * 1000);

    const studentExamList = document.getElementById('student-exam-list');
    const examScreen = document.getElementById('exam-screen');
    if (studentExamList) studentExamList.classList.add('hidden');
    if (examScreen) examScreen.classList.remove('hidden');
    const meta = document.getElementById('exam-meta');
    if (meta) meta.innerText = `${saved.mapel} | ${currentSiswa.rombel}`;

    if (typeof showQuestion === 'function') showQuestion(examData.currentIdx);
    if (examSecondsRemaining > 0 && typeof startTimer === 'function') {
        startTimer(examSecondsRemaining);
    }
    if (typeof updateLiveExamStatus === 'function') updateLiveExamStatus(true);
    if (typeof liveExamInterval !== 'undefined' && liveExamInterval) clearInterval(liveExamInterval);
    if (typeof updateLiveExamStatus === 'function') {
        liveExamInterval = setInterval(() => updateLiveExamStatus(true), 1000);
    }

    if (navigator.onLine && typeof fetchLiveExamsFromServer === 'function') {
        setTimeout(async () => {
            try {
                const serverLiveExams = await fetchLiveExamsFromServer();
                await processAdminCommandsOnStudent(serverLiveExams);
            } catch (e) {
                console.warn('[resumeStudentExam] Error checking admin commands:', e.message);
            }
        }, 500);
    }

    const existingIndex = (db.activeExams || []).findIndex(e => e.studentId === currentSiswa.id && e.rombel === currentSiswa.rombel && e.mapel === examData.mapel);
    const resumeEntry = {
        studentId: currentSiswa.id,
        studentName: currentSiswa.name,
        rombel: currentSiswa.rombel,
        mapel: examData.mapel,
        currentIdx: examData.currentIdx,
        answers,
        ragu,
        totalSeconds: examData.totalSeconds,
        remainingSeconds: examSecondsRemaining,
        updatedAt: Date.now(),
        isActive: true
    };
    if (!Array.isArray(db.activeExams)) db.activeExams = [];
    if (existingIndex >= 0) {
        db.activeExams[existingIndex] = { ...db.activeExams[existingIndex], ...resumeEntry };
    } else {
        db.activeExams.push(resumeEntry);
    }
    try {
        if (typeof saveLocalDb === 'function') await saveLocalDb();
    } catch (err) {
        console.warn('[resumeStudentExam] failed to save local active exam:', err.message || err);
    }

    saveStudentExamProgress();
    return true;
}

async function restoreStudentExamProgress() {
    console.log('[restoreStudentExamProgress] START - Checking for saved exam data...');

    if (!currentSiswa || currentSiswa.role !== 'student') {
        console.log('[restoreStudentExamProgress] SKIP - Not a student or no current user');
        return false;
    }

    const saved = await getSavedStudentExamProgress();

    if (!saved || !saved.mapel || !Array.isArray(saved.answers)) {
        console.log('[restoreStudentExamProgress] ❌ Tidak ada data untuk restore.');
        return false;
    }

    console.log('[restoreStudentExamProgress] ✅ Found saved data, resuming exam...');
    return await resumeStudentExam(saved);
}

async function processAdminCommandsOnStudent(liveExams) {
    if (!currentSiswa || currentSiswa.role !== 'student' || !examData || !examData.mapel) return;
    if (!Array.isArray(liveExams)) return;

    const norm = v => String(v || '').trim().toLowerCase();
    const sid = norm(currentSiswa.id);
    const srb = norm(currentSiswa.rombel);
    const smp = norm(examData.mapel);

    const commandEntry = liveExams.find(e =>
        norm(e.studentId) === sid &&
        norm(e.rombel) === srb &&
        norm(e.mapel) === smp
    );
    if (!commandEntry) return;

    let updated = false;

    if (commandEntry.adminSaveRequest) {
        console.log('[Student] ADMIN SAVE REQUEST DETECTED - Forcing latest exam state save');
        commandEntry.adminSaveRequest = false;
        commandEntry.adminSaveConfirmed = true;
        commandEntry.savedByAdminCommand = true;

        if (commandEntry.adminSavedProgress) {
            examData.adminSavedProgress = commandEntry.adminSavedProgress;
            examData.currentIdx = commandEntry.adminSavedProgress.currentIdx;
            examData.answers = commandEntry.adminSavedProgress.answers;
            examData.ragu = commandEntry.adminSavedProgress.ragu || [];
            examData.totalSeconds = commandEntry.adminSavedProgress.totalSeconds || 0;
            if (typeof examSecondsRemaining !== 'undefined') {
                examSecondsRemaining = commandEntry.adminSavedProgress.remainingSeconds || 0;
            }
        }

        examData.savedByAdminCommand = true;
        updated = true;
        saveStudentExamProgress();
        if (typeof showToast === 'function') showToast('✅ Admin menyimpan jawaban Anda. Data terbaru telah dikirim ke server.', 'success');
    }

    if (commandEntry.adminReloadRequest && String(commandEntry.adminReloadRequest) !== sessionStorage.getItem('last_reload_cmd')) {
        console.log('[Student] Admin reload request received - ID:', commandEntry.adminReloadRequest);
        sessionStorage.setItem('last_reload_cmd', commandEntry.adminReloadRequest);
        saveStudentExamProgress();
        updated = true;
        if (typeof showToast === 'function') showToast('Perintah reload diterima. Memuat ulang...', 'info');
        setTimeout(() => location.reload(), 1000);
    }

    if (commandEntry.adminDeleteCheckpoint || commandEntry.adminClearRequest) {
        const lastCmd = sessionStorage.getItem('last_clear_cmd');
        if (String(commandEntry.adminClearRequest) !== lastCmd) {
            sessionStorage.setItem('last_clear_cmd', String(commandEntry.adminClearRequest));
            console.log('[Student] ADMIN CLEAR REQUEST DETECTED - Wiping answers');
            clearStudentExamProgress();
            if (Array.isArray(examData.answers)) {
                examData.answers = examData.answers.map(ans => {
                    if (Array.isArray(ans)) return [];
                    if (typeof ans === 'string') return '';
                    return null;
                });
            }
            if (typeof showQuestion === 'function') showQuestion(examData.currentIdx || 0);
            if (typeof updateQuestionStatus === 'function') updateQuestionStatus();
            if (typeof showToast === 'function') showToast('⚠️ Admin telah mengosongkan jawaban Anda.', 'warning');
        }
    }
}





/* ==================== FILE: js/modules/guru.js ==================== */
/**
 * js/modules/guru.js
 * Part of CBT application refactored module
 */

/**
 * Show/hide the correct form containers based on selected question type.
 * Called by openQuestionModal and the q-type <select> onChange handler.
 */
function onQuestionTypeChange() {
    const sel = document.getElementById('q-type');
    if (!sel) return;
    const type = sel.value;
    const optsContainer = document.getElementById('q-opts-container');
    const answerTextContainer = document.getElementById('q-answer-text-container');
    const tfContainer = document.getElementById('q-tf-container');
    const matchingContainer = document.getElementById('q-matching-container');
    const correctButtonsGroup = document.getElementById('q-correct-buttons-group');
    const qOpsiGroup = document.getElementById('q-opsi-group');

    // Hide all containers first
    if (optsContainer) optsContainer.classList.add('hidden');
    if (answerTextContainer) answerTextContainer.classList.add('hidden');
    if (tfContainer) tfContainer.classList.add('hidden');
    if (matchingContainer) matchingContainer.classList.add('hidden');
    if (correctButtonsGroup) correctButtonsGroup.classList.add('hidden');
    if (qOpsiGroup) qOpsiGroup.classList.add('hidden');

    if (type === 'text') {
        if (answerTextContainer) answerTextContainer.classList.remove('hidden');
    } else if (type === 'tf') {
        if (tfContainer) tfContainer.classList.remove('hidden');
        // Ensure at least 2 TF rows exist
        if (tfContainer) {
            const existingRows = tfContainer.querySelectorAll('.tf-row').length;
            for (let i = existingRows; i < 2; i++) {
                if (typeof addTfRow === 'function') addTfRow();
            }
        }
    } else if (type === 'matching') {
        if (matchingContainer) matchingContainer.classList.remove('hidden');
    } else {
        // single or multiple choice
        if (optsContainer) optsContainer.classList.remove('hidden');
        if (correctButtonsGroup) correctButtonsGroup.classList.remove('hidden');
        if (qOpsiGroup) qOpsiGroup.classList.remove('hidden');
        if (optsContainer) {
            optsContainer.querySelectorAll('.q-opt').forEach(inp => {
                inp.disabled = false;
                if (inp.parentElement) inp.parentElement.style.display = '';
            });
        }
    }

    // Show/hide correct-button group for tf/text/matching
    if (correctButtonsGroup) {
        if (type === 'tf' || type === 'text' || type === 'matching') {
            correctButtonsGroup.style.display = 'none';
        } else {
            correctButtonsGroup.style.display = '';
        }
    }

    // Update correct button labels
    const buttons = document.querySelectorAll('.c-btn');
    if (buttons && buttons.length >= 4) {
        ['A', 'B', 'C', 'D'].forEach((l, i) => {
            buttons[i].innerText = l;
            buttons[i].style.display = '';
        });
    }

    // Reset correct state
    if (typeof activeCorrect !== 'undefined') activeCorrect = 0;
    if (typeof activeCorrectMultiple !== 'undefined') activeCorrectMultiple = [];
    if (typeof renderCorrectButtons === 'function') renderCorrectButtons();
}

function initQuillEditors() {
    const questionEditorEl = document.getElementById('q-text-editor');
    const answerEditorEl = document.getElementById('q-answer-text-editor');
    const quizzEditorEl = document.getElementById('quizz-question-editor');

    const fullToolbarOptions = [
        [{ 'header': [1, 2, 3, false] }, { 'size': ['small', false, 'large', 'huge'] }],
        ['bold', 'italic', 'underline', 'strike'],
        [{ 'color': [] }, { 'background': [] }],
        [{ 'script': 'sub'}, { 'script': 'super' }],
        [{ 'align': [] }],
        [{ 'list': 'ordered'}, { 'list': 'bullet' }, { 'indent': '-1'}, { 'indent': '+1' }],
        ['blockquote', 'code-block'],
        ['link', 'image'],
        ['clean']
    ];

    const simpleToolbarOptions = [
        ['bold', 'italic', 'underline', 'strike'],
        [{ 'script': 'sub'}, { 'script': 'super' }],
        [{ 'color': [] }, { 'background': [] }],
        [{ 'list': 'ordered'}, { 'list': 'bullet' }],
        ['clean']
    ];

    if (questionEditorEl && !window._quillQuestion) {
        window._quillQuestion = new Quill('#q-text-editor', {
            theme: 'snow',
            placeholder: 'Tulis atau format pertanyaan soal di sini (dukung gambar, tabel, rumus, tebal, miring, dll)...',
            modules: { toolbar: fullToolbarOptions }
        });
        window._quillQuestion.on('text-change', () => {
            const html = window._quillQuestion.root.innerHTML;
            const ta = document.getElementById('q-text');
            if (ta) ta.value = (html === '<p><br></p>' ? '' : html);
        });
    }

    if (answerEditorEl && !window._quillAnswer) {
        window._quillAnswer = new Quill('#q-answer-text-editor', {
            theme: 'snow',
            placeholder: 'Tuliskan pembahasan atau kunci jawaban esai di sini...',
            modules: { toolbar: simpleToolbarOptions }
        });
        window._quillAnswer.on('text-change', () => {
            const html = window._quillAnswer.root.innerHTML;
            const ta = document.getElementById('q-answer-text');
            if (ta) ta.value = (html === '<p><br></p>' ? '' : html);
        });
    }

    if (quizzEditorEl && !window._quillQuizz) {
        window._quillQuizz = new Quill('#quizz-question-editor', {
            theme: 'snow',
            placeholder: 'Tulis pertanyaan quizz interaktif di sini...',
            modules: { toolbar: fullToolbarOptions }
        });
        window._quillQuizz.on('text-change', () => {
            const html = window._quillQuizz.root.innerHTML;
            const ta = document.getElementById('quizz-question');
            if (ta) ta.value = (html === '<p><br></p>' ? '' : html);
        });
    }
}

function setQuillContent(editorKey, html) {
    let q;
    if (editorKey === 'question') q = window._quillQuestion;
    else if (editorKey === 'answer') q = window._quillAnswer;
    else if (editorKey === 'quizz') q = window._quillQuizz;

    if (!q) return;
    if (!html || html.trim() === '') {
        q.setContents([]);
    } else {
        q.clipboard.dangerouslyPasteHTML(html);
    }
}

function getQuillContent(editorKey) {
    let q, id;
    if (editorKey === 'question') { q = window._quillQuestion; id = 'q-text'; }
    else if (editorKey === 'answer') { q = window._quillAnswer; id = 'q-answer-text'; }
    else if (editorKey === 'quizz') { q = window._quillQuizz; id = 'quizz-question'; }

    if (!q) {
        const el = document.getElementById(id);
        return el ? el.value : '';
    }
    const html = q.root.innerHTML;
    return (html === '<p><br></p>') ? '' : html;
}

function closeModals() {
    window.isTeacherMode = false;
    if (window.leaderboardInterval) clearInterval(window.leaderboardInterval);
    document.querySelectorAll('[id$="-modal"]').forEach(m => {
        m.classList.remove('flex');
        m.classList.add('hidden');
    });
    const qText = document.getElementById('q-text');
    if (qText) qText.value = '';
    // Clear Quill editors
    if (window._quillQuestion) window._quillQuestion.setContents([]);
    if (window._quillAnswer) window._quillAnswer.setContents([]);
    if (window._quillQuizz) window._quillQuizz.setContents([]);
    document.querySelectorAll('.q-opt').forEach(i => i.value = '');
    const qMapel = document.getElementById('q-mapel');
    const qRombel = document.getElementById('q-rombel');
    if (qMapel) qMapel.value = '';
    if (qRombel) qRombel.value = '';
    const imageUrlInput = document.getElementById('q-image-url');
    if (imageUrlInput) imageUrlInput.value = '';
    const imageFile = document.getElementById('q-image-file');
    if (imageFile) imageFile.value = '';
    const imagesPreview = document.getElementById('q-images-preview');
    if (imagesPreview) imagesPreview.innerHTML = '';
    const imagesList = document.getElementById('q-images-list');
    if (imagesList) imagesList.innerHTML = '';
    window.storedImages = [];
    activeCorrect = 0;

    // Reset Quizz Form States
    if (document.getElementById('quizz-edit-idx')) document.getElementById('quizz-edit-idx').value = '';
    if (document.getElementById('quizz-image-url')) document.getElementById('quizz-image-url').value = '';
    if (document.getElementById('quizz-image-file')) document.getElementById('quizz-image-file').value = '';
    if (document.getElementById('quizz-images-preview')) document.getElementById('quizz-images-preview').innerHTML = '';
    window.storedQuizzImages = [];
}


let selectedTeacherQuestions = new Set();

function openImportSiswaModal() {
    document.getElementById('import-siswa-area').value = "";
    document.getElementById('import-excel-file').value = null;
    document.getElementById('import-siswa-modal').classList.replace('hidden', 'flex');
}

function processImportSiswa() {
    const raw = document.getElementById('import-siswa-area').value.trim();
    if (!raw) return alert("Tempelkan data terlebih dahulu!");

    const rows = raw.split("\n");
    let count = 0;
    let errors = 0;

    rows.forEach(row => {
        // Mendeteksi pemisah tab (Excel default) atau spasi ganda
        let parts = row.split("\t");
        if (parts.length < 2) parts = row.split(/ {2,}/); // Fallback jika dipisah spasi banyak

        if (parts.length >= 2) {
            const nama = parts[0].trim();
            const rombel = parts[1].trim();

            if (nama && rombel) {
                // Generate ID sederhana dari nama + random suffix jika perlu
                const baseId = "DRKS-" + Math.floor(1000 + Math.random() * 9000);

                db.students.push({
                    id: baseId,
                    password: "escrido",
                    name: nama,
                    rombel: rombel,
                    role: "student"
                });
                count++;
            }
        } else {
            errors++;
        }
    });

    save();
    updateCompletionCharts();
    renderAdminStudents();
    closeModals();
    alert(`Berhasil mengimport ${count} siswa. ${errors > 0 ? errors + ' baris gagal diproses.' : ''}`);
}

function handleExcelFile(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const data = new Uint8Array(e.target.result);
            const wb = XLSX.read(data, { type: 'array' });
            const firstSheet = wb.Sheets[wb.SheetNames[0]];
            // convert to tab-delimited text, which matches processImportSiswa expectations
            const csv = XLSX.utils.sheet_to_csv(firstSheet, { FS: '\t' });
            document.getElementById('import-siswa-area').value = csv;
        } catch (err) {
            alert('Gagal membaca file Excel: ' + err.message);
        }
    };
    reader.readAsArrayBuffer(file);
}

function openTeacherImportModal() {
    window.isTeacherMode = true;
    openImportModal();
}

function openTeacherQuestionModal() {
    window.isTeacherMode = true;
    editQuestionIndex = null;
    window.matchingEditOriginalCorrect = null;

    // Initialize Quill editors
    setTimeout(() => initQuillEditors(), 50);

    document.getElementById('q-type').value = 'single';
    // Clear Quill editors
    setTimeout(() => {
        if (window._quillQuestion) window._quillQuestion.setContents([]);
        if (window._quillAnswer) window._quillAnswer.setContents([]);
    }, 80);
    const textEl = document.getElementById('q-text');
    if (textEl) textEl.value = '';
    document.getElementById('q-mapel').value = teacherSubjectNames(currentSiswa)[0] || '';
    document.getElementById('q-image-file').value = '';
    // Clear multiple images preview
    document.getElementById('q-images-preview').innerHTML = '';
    document.getElementById('q-images-list').innerHTML = '';
    window.storedImages = [];
    document.getElementById('q-opts-container').innerHTML = '<input type="text" class="q-opt w-full p-3 bg-slate-50 rounded-xl text-sm border-none" placeholder="Opsi A"><input type="text" class="q-opt w-full p-3 bg-slate-50 rounded-xl text-sm border-none" placeholder="Opsi B"><input type="text" class="q-opt w-full p-3 bg-slate-50 rounded-xl text-sm border-none" placeholder="Opsi C"><input type="text" class="q-opt w-full p-3 bg-slate-50 rounded-xl text-sm border-none" placeholder="Opsi D">';
    document.getElementById('q-tf-container').innerHTML = '<div class="tf-row flex items-center gap-2"><input type="text" class="tf-statement flex-1 p-3 bg-slate-50 rounded-xl text-sm border-none" placeholder="Pernyataan"><select class="tf-correct p-3 bg-slate-50 rounded-xl text-sm border-none"><option value="">--Benar/Salah--</option><option value="true">Benar</option><option value="false">Salah</option></select><button type="button" onclick="removeTfRow(this)" class="text-red-500">&times;</button></div><button type="button" onclick="addTfRow()" class="mt-2 text-sm text-sky-600">+ Tambah Pernyataan</button>';
    document.getElementById('q-matching-container').innerHTML = '<div class="grid grid-cols-2 gap-4"><div><label class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 block">Pertanyaan (Kiri)</label><div id="q-matching-questions" class="space-y-2"><div class="matching-q-row flex items-center gap-2"><input type="text" class="matching-question flex-1 p-3 bg-slate-50 rounded-xl text-sm border-none" placeholder="Pertanyaan 1"><button type="button" onclick="removeMatchingQRow(this)" class="text-red-500">&times;</button></div></div><button type="button" onclick="addMatchingQRow()" class="mt-2 text-sm text-sky-600">+ Tambah Pertanyaan</button></div><div><label class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 block">Jawaban (Kanan)</label><div id="q-matching-answers" class="space-y-2"><div class="matching-a-row flex items-center gap-2"><input type="text" class="matching-answer flex-1 p-3 bg-slate-50 rounded-xl text-sm border-none" placeholder="Jawaban 1"><button type="button" onclick="removeMatchingARow(this)" class="text-red-500">&times;</button></div></div><button type="button" onclick="addMatchingARow()" class="mt-2 text-sm text-sky-600">+ Tambah Jawaban</button></div></div>';
    document.getElementById('save-question-btn').textContent = 'SIMPAN SOAL';
    window.isTeacherMode = true;
    editQuestionIndex = null;

    // Populate selects with filters
    populateSelects(['q-mapel', 'q-rombel']);

    // Filter for teacher mode
    const teacher = currentSiswa;
    if (teacher) {
        // Filter mapel
        const mapelSelect = document.getElementById('q-mapel');
        if (mapelSelect && teacher.subjects) {
            const names = teacherSubjectNames(teacher);
            mapelSelect.innerHTML = '<option value="">--Pilih Mapel--</option>' + names.map(n => `<option value="${n}">${n}</option>`).join('');
        }
        // Filter rombel
        const rombelSelect = document.getElementById('q-rombel');
        if (rombelSelect) {
            const updateRombels = (chosenMapel) => {
                let rombelsToUse;
                if (chosenMapel) {
                    rombelsToUse = teacherAllowedRombels(teacher, chosenMapel);
                } else {
                    rombelsToUse = teacher.rombels && teacher.rombels.length > 0 ? teacher.rombels : db.rombels;
                }
                rombelSelect.innerHTML = '<option value="">--Pilih Rombel--</option>' + rombelsToUse.map(r => `<option value="${r}">${r}</option>`).join('');
            };
            updateRombels(mapelSelect.value);
            mapelSelect.addEventListener('change', () => updateRombels(mapelSelect.value));
        }
    }

    document.getElementById('question-modal').classList.replace('hidden', 'flex');
    updateQuestionTypeDisplay('single');
}

function saveTeacherQuestion() {
    const text = getQuillContent('question');
    const options = Array.from(document.querySelectorAll('.q-opt')).map(i => i.value);
    const mapel = document.getElementById('q-mapel').value;
    const rombel = document.getElementById('q-rombel').value;
    let imagesData = window.storedImages || [];
    window.storedImages = [];

    const type = document.getElementById('q-type').value;
    if (!text) return alert("Lengkapi pertanyaan!");
    if (!mapel || !teacherSubjectNames(currentSiswa).includes(mapel)) {
        alert('Pilih mata pelajaran yang Anda ajar!');
        return;
    }
    if (!rombel) {
        alert('Pilih rombel yang Anda ajar!');
        return;
    }
    const allowedRombels = teacherAllowedRombels(currentSiswa, mapel);
    if (!allowedRombels.includes(rombel)) {
        alert('Rombel tidak valid untuk mata pelajaran tersebut!');
        return;
    }

    let record = { text, mapel, rombel, type, images: imagesData };

    if (type === 'multiple') {
        if (options.some(o => !o)) return alert("Lengkapi semua pilihan!");
        const corr = activeCorrectMultiple.slice();
        if (corr.length < 2 || corr.length > 3) return alert('Pilih 2-3 jawaban benar untuk soal pilihan ganda kompleks!');
        record.options = options;
        record.correct = corr;
    } else if (type === 'text') {
        const ans = getQuillContent('answer').trim();
        if (!ans) return alert('Tuliskan jawaban esai yang benar!');
        record.correct = ans;
    } else if (type === 'tf') {
        const rows = Array.from(document.querySelectorAll('#q-tf-container .tf-row'));
        if (rows.length === 0) return alert('Tambahkan minimal satu pernyataan!');
        const stmts = [];
        const corrs = [];
        for (const r of rows) {
            const stmt = r.querySelector('.tf-statement').value.trim();
            const sel = r.querySelector('.tf-correct').value;
            if (!stmt || sel === '') return alert('Lengkapi pernyataan dan pilih Benar/Salah!');
            stmts.push(stmt);
            corrs.push(sel === 'true');
        }
        record.options = stmts;
        record.correct = corrs;
    } else if (type === 'matching') {
        const qRows = Array.from(document.querySelectorAll('#q-matching-questions .matching-question'));
        const aRows = Array.from(document.querySelectorAll('#q-matching-answers .matching-answer'));
        const questions = qRows.map(inp => inp.value.trim()).filter(v => v);
        const answers = aRows.map(inp => inp.value.trim()).filter(v => v);
        if (questions.length === 0 || answers.length === 0) return alert('Tambahkan minimal satu pertanyaan dan satu jawaban!');
        if (answers.length < questions.length) return alert('Jumlah jawaban minimal harus sama dengan jumlah pertanyaan!');
        record.questions = questions;
        record.answers = answers;
        const preserveCorrect = Array.isArray(window.matchingEditOriginalCorrect) && window.matchingEditOriginalCorrect.length === questions.length
            && window.matchingEditOriginalCorrect.every(orig => answers.some(ans => String(ans).trim().toLowerCase() === String(orig).trim().toLowerCase()));
        record.correct = preserveCorrect ? window.matchingEditOriginalCorrect.slice() : answers.slice(0, questions.length);
    } else {
        // single choice
        if (options.some(o => !o)) return alert("Lengkapi semua pilihan!");
        record.options = options;
        record.correct = activeCorrect;
    }

    if (editQuestionIndex !== null) {
        db.questions[editQuestionIndex] = record;
    } else {
        db.questions.push(record);
    }

    save();
    renderTeacherQuestions();
    closeModals();
    alert('Soal berhasil disimpan!');
}

function editTeacherQuestion(index) {
    try {
        if (index < 0 || index >= db.questions.length) {
            alert('Soal tidak ditemukan!');
            return;
        }
        window.isTeacherMode = true;
        openEditQuestionModal(index);

        // Override modal title and button text for teacher view
        const titleEl = document.getElementById('question-modal-title');
        const btnEl = document.getElementById('save-question-btn');
        const rombelEl = document.getElementById('q-rombel');
        if (titleEl) titleEl.textContent = 'Edit Soal';
        if (btnEl) btnEl.textContent = 'PERBARUI SOAL';

        // Disable rombel edit for teachers as it should remain consistent
        if (rombelEl) rombelEl.disabled = true;
    } catch (error) {
        console.error('Error in editTeacherQuestion:', error);
        alert('Terjadi kesalahan saat membuka edit soal: ' + error.message);
    }
}

function loadMnWeights() {
    const weights = JSON.parse(localStorage.getItem('mn_weights') || '{"harian":50,"kelas":25,"uas":25}');
    document.getElementById('mn-weight-harian').value = weights.harian;
    document.getElementById('mn-weight-kelas').value = weights.kelas;
    document.getElementById('mn-weight-uas').value = weights.uas;
    updateMnWeightsDisplay();
}

function updateMnWeights() {
    const h = parseFloat(document.getElementById('mn-weight-harian').value) || 0;
    const k = parseFloat(document.getElementById('mn-weight-kelas').value) || 0;
    const u = parseFloat(document.getElementById('mn-weight-uas').value) || 0;

    updateMnWeightsDisplay();
    localStorage.setItem('mn_weights', JSON.stringify({ harian: h, kelas: k, uas: u }));

    // Recalculate all rows
    document.querySelectorAll('#mn-table-body tr').forEach(tr => {
        const first = tr.querySelector('input');
        if (first) calculateMnRow(first);
    });
}

function updateMnWeightsDisplay() {
    const h = parseFloat(document.getElementById('mn-weight-harian').value) || 0;
    const k = parseFloat(document.getElementById('mn-weight-kelas').value) || 0;
    const u = parseFloat(document.getElementById('mn-weight-uas').value) || 0;
    const total = h + k + u;
    const el = document.getElementById('mn-weight-total');
    if (el) {
        el.textContent = `TOTAL: ${total}%`;
        if (total === 100) {
            el.className = 'px-4 py-2 bg-emerald-50 text-emerald-600 rounded-full font-black text-[10px] tracking-widest border border-emerald-100 shadow-sm shadow-emerald-50 self-end';
        } else {
            el.className = 'px-4 py-2 bg-red-50 text-red-600 rounded-full font-black text-[10px] tracking-widest border border-red-100 shadow-sm self-end';
        }
    }
}

function renderManajemenNilaiFilters() {
    const mapelSelect = document.getElementById('mn-filter-mapel');
    const rombelSelect = document.getElementById('mn-filter-rombel');
    if (!currentSiswa || !currentSiswa.subjects) return;

    if (mapelSelect) {
        const currentValue = mapelSelect.value;
        const teacherSubjects = teacherSubjectNames(currentSiswa);
        mapelSelect.innerHTML = '<option value="">--Pilih Mapel--</option>' +
            teacherSubjects.map(name => `<option value="${name}"${name === currentValue ? ' selected' : ''}>${name}</option>`).join('');
    }

    if (rombelSelect) {
        const currentValue = rombelSelect.value;
        const selectedMapel = mapelSelect?.value;
        let rombels = [];
        if (selectedMapel) {
            rombels = teacherAllowedRombels(currentSiswa, selectedMapel);
        } else {
            rombels = teacherCombinedRombels(currentSiswa);
        }
        rombelSelect.innerHTML = '<option value="">--Pilih Rombel--</option>' +
            rombels.map(r => `<option value="${r}"${r === currentValue ? ' selected' : ''}>${r}</option>`).join('');
    }
}

async function renderManajemenNilai() {
    const mapel = document.getElementById('mn-filter-mapel').value;
    const rombel = document.getElementById('mn-filter-rombel').value;
    const thead = document.getElementById('mn-table-head');
    const tbody = document.getElementById('mn-table-body');
    const countU = parseInt(document.getElementById('mn-count-u').value) || 3;
    const countT = parseInt(document.getElementById('mn-count-t').value) || 3;

    if (!mapel || !rombel) {
        if (thead) thead.innerHTML = '';
        tbody.innerHTML = '<tr><td colspan="10" class="px-6 py-12 text-center text-slate-400 italic text-xs">Silakan pilih Rombel dan Mapel untuk menampilkan data.</td></tr>';
        return;
    }

    // Render THEAD dynamically
    if (thead) {
        thead.innerHTML = `
            <tr>
                <th rowspan="2" style="text-align:left; min-width:140px;">Nama Siswa</th>
                <th colspan="${countU}" style="text-align:center; color:#818cf8; border-left:2px solid #e0e7ff;">Ulangan Harian</th>
                <th colspan="${countT}" style="text-align:center; color:#f59e0b; border-left:2px solid #fef3c7;">Tugas / Mandiri</th>
                <th rowspan="2" style="text-align:center; min-width:56px; border-left:2px solid #e2e8f0;">Kelas</th>
                <th rowspan="2" style="text-align:center; min-width:56px; border-left:2px solid #dbeafe; color:#1d4ed8;">UAS</th>
                <th rowspan="2" style="text-align:center; min-width:64px; border-left:2px solid #e2e8f0; background:#f1f5f9; color:#0f172a;">Nilai Akhir</th>
            </tr>
            <tr>
                ${Array.from({ length: countU }).map((_, i) => `<th style="text-align:center; color:#818cf8; border-left:${i === 0 ? '2px solid #e0e7ff' : 'none'};">U${i + 1}</th>`).join('')}
                ${Array.from({ length: countT }).map((_, i) => `<th style="text-align:center; color:#d97706; border-left:${i === 0 ? '2px solid #fef3c7' : 'none'};">T${i + 1}</th>`).join('')}
            </tr>
        `;
    }

    try {
        const [gradesRes, resultsRes] = await Promise.all([
            fetch(getApiBaseUrl() + `/api/grades?mapel=${encodeURIComponent(mapel)}&rombel=${encodeURIComponent(rombel)}`),
            fetch(getApiBaseUrl() + `/api/results?mapel=${encodeURIComponent(mapel)}&rombel=${encodeURIComponent(rombel)}&limit=-1`)
        ]);

        const grades = await gradesRes.json();
        const resultsRaw = await resultsRes.json();
        const results = Array.isArray(resultsRaw) ? resultsRaw : (resultsRaw.items || []);

        const students = db.students.filter(s => s.rombel === rombel && s.role === 'student');

        if (students.length === 0) {
            tbody.innerHTML = `<tr><td colspan="${4 + countU + countT}" class="px-6 py-12 text-center text-slate-400 font-bold text-xs">Tidak ada siswa yang terdaftar di rombel ini.</td></tr>`;
            return;
        }

        tbody.innerHTML = students.map(s => {
            const g = (Array.isArray(grades) ? grades : []).find(x => String(x.student_id).toLowerCase() === String(s.id).toLowerCase()) || {};
            const r = results.find(x => String(x.studentId || x.student_id || x.id || "").trim().toLowerCase() === String(s.id).toLowerCase().trim() && !x.deleted);

            // Extract values from flexible JSON if available
            let extra = {};
            try { extra = typeof g.data === 'string' ? JSON.parse(g.data) : (g.data || {}); } catch (e) { }

            const uVals = Array.isArray(extra.u) ? extra.u : [g.u1, g.u2, g.u3];
            const tVals = Array.isArray(extra.t) ? extra.t : [g.t1, g.t2, g.t3];

            const uasVal = (g.uas !== undefined && g.uas !== 0) ? g.uas : (r ? r.score : 0);
            const kelasVal = (g.kelas !== undefined) ? g.kelas : 100;

            return `
                <tr data-student-id="${s.id}">
                    <td style="padding:0.6rem 1rem; font-weight:700; color:#374151; font-size:0.78rem; white-space:nowrap;">${s.name}</td>
                    ${Array.from({ length: countU }).map((_, i) => `
                        <td style="padding:0.25rem 0.2rem; border-left:${i === 0 ? '2px solid #e0e7ff' : 'none'};"><input type="number" class="mn-input" value="${uVals[i] || 0}" oninput="calculateMnRow(this)" data-field="u" data-idx="${i}"></td>
                    `).join('')}
                    ${Array.from({ length: countT }).map((_, i) => `
                        <td style="padding:0.25rem 0.2rem; border-left:${i === 0 ? '2px solid #fef3c7' : 'none'}; background:rgba(254,243,199,0.2);"><input type="number" class="mn-input" value="${tVals[i] || 0}" oninput="calculateMnRow(this)" data-field="t" data-idx="${i}"></td>
                    `).join('')}
                    <td style="padding:0.25rem 0.2rem; border-left:2px solid #e2e8f0;"><input type="number" class="mn-input" value="${kelasVal}" oninput="calculateMnRow(this)" data-field="kelas"></td>
                    <td style="padding:0.25rem 0.2rem; border-left:2px solid #dbeafe;"><input type="number" class="mn-input uas-input" value="${uasVal}" oninput="calculateMnRow(this)" data-field="uas"></td>
                    <td class="mn-final-grade">0</td>
                </tr>
            `;
        }).join('');


        // Initial trigger
        document.querySelectorAll('#mn-table-body tr').forEach(tr => {
            const first = tr.querySelector('input');
            if (first) calculateMnRow(first);
        });
    } catch (e) {
        console.error('renderManajemenNilai Error:', e);
    }
}

async function saveManajemenNilai() {
    const mapel = document.getElementById('mn-filter-mapel').value;
    const rombel = document.getElementById('mn-filter-rombel').value;
    if (!mapel || !rombel) return alert('Pilih Mapel dan Rombel lebih dulu.');

    const rows = document.querySelectorAll('#mn-table-body tr');
    const dataArr = Array.from(rows).map(tr => {
        const uVals = Array.from(tr.querySelectorAll('[data-field="u"]')).map(i => parseFloat(i.value) || 0);
        const tVals = Array.from(tr.querySelectorAll('[data-field="t"]')).map(i => parseFloat(i.value) || 0);

        return {
            student_id: tr.dataset.studentId,
            mapel,
            rombel,
            // Keep first 3 for legacy columns in DB table
            u1: uVals[0] || 0, u2: uVals[1] || 0, u3: uVals[2] || 0,
            t1: tVals[0] || 0, t2: tVals[1] || 0, t3: tVals[2] || 0,
            kelas: parseFloat(tr.querySelector('[data-field="kelas"]').value) || 0,
            uas: parseFloat(tr.querySelector('[data-field="uas"]').value) || 0,
            nilai_akhir: parseFloat(tr.querySelector('.mn-final-grade').textContent) || 0,
            data: { u: uVals, t: tVals } // Flexible storage for JSON column
        };
    });

    try {
        const res = await fetch(getApiBaseUrl() + '/api/grades', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dataArr)
        });
        if (res.ok) {
            alert('Nilai berhasil disimpan!');
        } else {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || 'Simpan gagal (Server error)');
        }
    } catch (e) {
        alert('Gagal menyimpan nilai: ' + e.message);
    }
}

function exportGradesToExcel() {
    const mapel = document.getElementById('mn-filter-mapel').value;
    const rombel = document.getElementById('mn-filter-rombel').value;
    if (!mapel || !rombel) return alert('Pilih data per Mapel dan Rombel.');

    const table = document.querySelector('#teacher-tab-manajemen-nilai table');
    const wb = XLSX.utils.table_to_book(table);
    XLSX.writeFile(wb, `REKAP_NILAI_${mapel}_${rombel}.xlsx`);
}

async function renderTeacherResults() {
    await ensureDataLoaded('results');
    const mapelSelect = document.getElementById('teacher-results-filter-mapel');
    const rombelSelect = document.getElementById('teacher-results-filter-rombel');
    const tbody = document.getElementById('teacher-results-table-body');

    if (!currentSiswa || !currentSiswa.subjects) {
        console.warn('[TEACHER] No active session or subjects found.');
        return;
    }

    // Populate mapel filter using normalized subject names
    if (mapelSelect) {
        const currentValue = mapelSelect.value;
        const teacherSubjects = teacherSubjectNames(currentSiswa);
        mapelSelect.innerHTML = '<option value="">Semua Mata Pelajaran</option>' +
            teacherSubjects.map(name => {
                return `<option value="${name}"${name === currentValue ? ' selected' : ''}>${name}</option>`;
            }).join('');
    }

    // Populate rombel filter with all available rombels
    if (rombelSelect) {
        const currentValue = rombelSelect.value;
        const allRombels = db.rombels || [];
        const additionalOptions = allRombels.map(r =>
            `<option value="${r}"${r === currentValue ? ' selected' : ''}>${r}</option>`
        ).join('');
        rombelSelect.innerHTML = '<option value="">Semua Rombel</option>' + additionalOptions;
    }

    // Filter results
    const selectedMapel = mapelSelect ? mapelSelect.value : '';
    const selectedRombel = rombelSelect ? rombelSelect.value : '';

    let results = db.results.filter(r => {
        // Filter out deleted results
        if (r.deleted) return false;

        // Filter by teacher's subjects
        if (!teacherSubjectNames(currentSiswa).includes(r.mapel)) return false;
        // also restrict by rombels assigned for that subject
        const allowed = teacherAllowedRombels(currentSiswa, r.mapel);
        if (!allowed.includes(r.rombel)) return false;

        // Filter by selected mapel
        if (selectedMapel && r.mapel !== selectedMapel) return false;

        // Filter by selected rombel
        if (selectedRombel && r.rombel !== selectedRombel) return false;

        return true;
    });

    // Sort results by date (newest first)
    // FIXED: use Date constructor for ISO strings
    results.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

    console.log(`[TEACHER] Rendering ${results.length} results.`);

    // Display results in table
    tbody.innerHTML = results.map((r) => {
        // Finding index in global db.results for detail view
        const resultIndex = db.results.indexOf(r);
        if (resultIndex === -1) return '';

        const hasEssay = Array.isArray(r.questions) && r.questions.some(q => q.type === 'text');
        const allEssayDone = hasEssay && Array.isArray(r.questions) &&
            r.questions.every((q, qi) => q.type !== 'text' || (r.manualScores && r.manualScores[qi] !== undefined && r.manualScores[qi] !== null));
        const scoreDisplay = r.score != null && !isNaN(Number(r.score)) ? Number(r.score).toFixed(1) : '-';

        let aiBtn = '';
        if (hasEssay) {
            if (allEssayDone) {
                aiBtn = `<button onclick="batchAiCorrectEssay(${resultIndex})" id="ai-batch-btn-${resultIndex}" title="Koreksi ulang semua esai dengan AI" class="ml-2 inline-flex items-center gap-1 px-2 py-0.5 bg-violet-100 hover:bg-violet-200 text-violet-700 text-[10px] font-black rounded-lg border border-violet-300 transition-all"><i class="fas fa-robot"></i> ✓ Koreksi Ulang</button>`;
            } else {
                aiBtn = `<button onclick="batchAiCorrectEssay(${resultIndex})" id="ai-batch-btn-${resultIndex}" title="Koreksi semua soal esai dengan AI" class="ml-2 inline-flex items-center gap-1 px-2 py-0.5 bg-violet-600 hover:bg-violet-700 text-white text-[10px] font-black rounded-lg transition-all shadow-sm"><i class="fas fa-magic"></i> Koreksi AI</button>`;
            }
        }

        return `
                <tr class="hover:bg-slate-50 transition-colors">
                    <td class="px-6 py-4 font-bold text-slate-700">${r.studentName}</td>
                    <td class="px-6 py-4 text-xs font-semibold text-slate-500">${r.rombel}</td>
                    <td class="px-6 py-4 text-xs font-bold text-sky-600 uppercase tracking-tighter">${r.mapel}</td>
                    <td class="px-6 py-4 text-[10px] font-medium text-slate-400">${r.date ? new Date(r.date).toLocaleString('id-ID') : '-'}</td>
                    <td class="px-6 py-4 text-center">
                        <span class="font-black text-sky-600 text-lg">${scoreDisplay}</span>
                        ${aiBtn}
                    </td>
                    <td class="px-6 py-4 text-center">
                        <button onclick="viewDetailedResult(${resultIndex})" class="w-8 h-8 rounded-lg bg-sky-50 text-sky-500 hover:bg-sky-100 transition-all shadow-sm mr-2" title="Lihat Jawaban"><i class="fas fa-eye"></i></button>
                        <button onclick="deleteResult(${resultIndex})" class="w-8 h-8 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-all shadow-sm" title="Hapus"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>`;
    }).join('');

    if (results.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="px-6 py-12 text-center text-slate-400 italic">Belum ada hasil ujian yang sesuai filter</td></tr>';
    }
}

async function renderTeacherQuestions() {
    await ensureDataLoaded('questions');
    const filterSelect = document.getElementById('teacher-filter-mapel');
    const rombelSelect = document.getElementById('teacher-filter-rombel');
    const searchTerm = document.getElementById('teacher-search-questions')?.value?.toLowerCase() || '';
    const selectedSubject = filterSelect ? filterSelect.value : '';
    const selectedRombel = rombelSelect ? rombelSelect.value : '';
    const tbody = document.getElementById('teacher-questions-table-body');
    const selectAllCheckbox = document.getElementById('teacher-select-all-checkbox');

    // Populate mapel filter with normalized subject list
    if (filterSelect && currentSiswa && currentSiswa.role === 'teacher') {
        const current = filterSelect.value;
        const teacherSubjects = teacherSubjectNames(currentSiswa);
        filterSelect.innerHTML = '<option value="">Semua</option>' +
            teacherSubjects.map(name => `<option value="${name}"${name === current ? ' selected' : ''}>${name}</option>`).join('');
    }
    // Populate rombel filter depending on selected subject or combined rombels
    if (rombelSelect && currentSiswa && currentSiswa.role === 'teacher') {
        const current = rombelSelect.value;
        let rombels = [];
        if (selectedSubject) {
            rombels = teacherAllowedRombels(currentSiswa, selectedSubject);
        } else {
            rombels = teacherCombinedRombels(currentSiswa);
        }
        rombelSelect.innerHTML = '<option value="">Semua Rombel</option>' +
            rombels.map(r => `<option value="${r}"${r === current ? ' selected' : ''}>${r}</option>`).join('');
    }

    if (!currentSiswa || !currentSiswa.subjects) return;

    let list = db.questions.filter(q => {
        const qSubject = q.mapel;
        if (!qSubject) return false;
        const qSubjectName = typeof qSubject === 'string' ? qSubject : qSubject.name || qSubject;

        const tSubjects = teacherSubjectNames(currentSiswa);
        if (!tSubjects.includes(qSubjectName)) return false;

        const allowed = teacherAllowedRombels(currentSiswa, qSubjectName);

        // Use robust comparison (trim and string conversion) to avoid mismatch
        const qRombel = String(q.rombel || '').trim();
        const isAllowed = allowed.some(a => String(a).trim() === qRombel);

        if (!isAllowed) return false;
        return true;
    });


    if (selectedSubject) {
        list = list.filter(q => {
            const qSubject = typeof q.mapel === 'string' ? q.mapel : q.mapel.name || q.mapel;
            return qSubject === selectedSubject;
        });
    }
    if (selectedRombel) {
        list = list.filter(q => q.rombel === selectedRombel);
    }
    if (searchTerm) {
        list = list.filter(q => q.text.toLowerCase().includes(searchTerm));
    }

    const allSelected = list.length > 0 && list.every(q => selectedTeacherQuestions.has(q));
    if (selectAllCheckbox) selectAllCheckbox.checked = allSelected;

    tbody.innerHTML = list.map((q, i) => {
        const subject = typeof q.mapel === 'string' ? q.mapel : q.mapel.name || q.mapel;
        const actualIndex = db.questions.indexOf(q);
        let typeName = { 'single': 'Pilihan Ganda', 'multiple': 'PG Kompleks', 'text': 'Uraian', 'tf': 'Benar/Salah', 'matching': 'Menjodohkan' }[q.type || 'single'] || 'Pilihan Ganda';

        let corrText = '';
        if (q.type === 'multiple') {
            corrText = (Array.isArray(q.correct) ? q.correct.map(x => ['A', 'B', 'C', 'D'][x]).join(',') : q.correct);
        } else if (q.type === 'text') {
            corrText = 'Teks';
        } else if (q.type === 'tf') {
            if (Array.isArray(q.options)) {
                corrText = q.options.map((stmt, j) => {
                    const val = Array.isArray(q.correct) ? q.correct[j] : false;
                    return `${stmt} (${val ? 'Benar' : 'Salah'})`;
                }).join(' / ');
            } else {
                corrText = 'Benar/Salah';
            }
        } else if (q.type === 'matching') {
            corrText = 'Match';
        } else {
            corrText = ['A', 'B', 'C', 'D'][q.correct];
        }

        return `<tr>
                    <td class="px-6 py-4 text-center">
                        <input type="checkbox" id="teacher-select-${actualIndex}" data-index="${actualIndex}" class="rounded border-slate-300 text-sky-600 focus:ring-sky-500" ${selectedTeacherQuestions.has(q) ? 'checked' : ''} onclick="toggleTeacherQuestionSelection(event)">
                    </td>
                    <td class="px-6 py-4 text-center">
                        <div class="flex items-center justify-center gap-2">
                            <span class="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded">${actualIndex + 1}</span>
                            <div class="flex flex-col gap-1">
                                <button type="button" onclick="moveQuestionUp(${actualIndex})" class="text-slate-400 hover:text-slate-600 text-xs p-1 rounded hover:bg-slate-100 transition-colors ${actualIndex === 0 ? 'opacity-50 cursor-not-allowed' : ''}" ${actualIndex === 0 ? 'disabled' : ''}><i class="fas fa-chevron-up"></i></button>
                                <button type="button" onclick="moveQuestionDown(${actualIndex})" class="text-slate-400 hover:text-slate-600 text-xs p-1 rounded hover:bg-slate-100 transition-colors ${actualIndex === db.questions.length - 1 ? 'opacity-50 cursor-not-allowed' : ''}" ${actualIndex === db.questions.length - 1 ? 'disabled' : ''}><i class="fas fa-chevron-down"></i></button>
                            </div>
                        </div>
                    </td>
                    <td class="px-6 py-4">
                        <div style="word-wrap: break-word; white-space: pre-wrap; max-width: none;" class="font-bold mb-1">${normalizeHtmlImages(q.text)}</div>
                        ${q.type === 'tf' && Array.isArray(q.options) && q.options.length > 0 ? `
                            <div class="mt-2 pl-3 border-l-2 border-sky-200 space-y-1">
                                ${q.options.map((opt, idx) => `<div class="text-xs text-slate-600"><span class="font-bold text-sky-600 mr-1">${idx + 1}.</span> ${opt}</div>`).join('')}
                            </div>
                        ` : ''}
                        ${(q.images && Array.isArray(q.images) && q.images.length > 0) ? `
                            <div class="flex items-center gap-2 mt-1">
                                <img src="${normalizeImgSrc(q.images[0])}" class="w-8 h-8 object-cover rounded border border-slate-200 cursor-zoom-in" onclick="Swal.fire({imageUrl: '${normalizeImgSrc(q.images[0])}', showConfirmButton: false, customClass: {popup: 'rounded-3xl border-none shadow-2xl'}})">
                                <span class="text-[10px] font-bold text-sky-600 bg-sky-50 px-1.5 py-0.5 rounded">${q.images.length} Gambar</span>
                            </div>
                        ` : (q.image ? `
                            <div class="flex items-center gap-2 mt-1">
                                <img src="${normalizeImgSrc(q.image)}" class="w-8 h-8 object-cover rounded border border-slate-200 cursor-zoom-in" onclick="Swal.fire({imageUrl: '${normalizeImgSrc(q.image)}', showConfirmButton: false, customClass: {popup: 'rounded-3xl border-none shadow-2xl'}})">
                                <span class="text-[10px] font-bold text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded">1 Gambar</span>
                            </div>
                        ` : '')}
                    </td>
                    <td class="px-6 py-4">
                        <div class="flex flex-col gap-1 items-start">
                            <span class="px-3 py-1 bg-sky-100 text-sky-700 rounded-full text-[10px] font-bold text-center inline-block">${subject}</span>
                            <span class="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-[10px] font-bold text-center inline-block">${q.rombel}</span>
                        </div>
                    </td>
                    <td class="px-6 py-4">
                        <span style="word-wrap: break-word; white-space: pre-wrap; max-width: none; font-weight: bold; color: #0369a1; font-size: 0.875rem;">${corrText}</span>
                    </td>
                    <td class="px-6 py-4">
                        <span class="inline-flex items-center justify-center px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-[10px] font-bold whitespace-nowrap">${typeName}</span>
                    </td>
                    <td class="px-6 py-4 text-center flex gap-1 justify-center">
                        <button type="button" class="p-2 text-sky-400 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-colors" onclick="viewQuestion(${actualIndex})" title="Lihat">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button type="button" class="p-2 text-amber-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors" onclick="editTeacherQuestion(${actualIndex})" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button type="button" class="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" onclick="deleteQuestion(${actualIndex})" title="Hapus">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>`;
    }).join('');

    if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="px-6 py-12 text-center text-slate-500 text-sm">Tidak ada soal ditemukan.</td></tr>`;
    }
}

function toggleTeacherQuestionSelection(event) {
    const idx = Number(event.target.dataset.index);
    if (Number.isNaN(idx)) return;
    const question = db.questions[idx];
    if (!question) return;
    if (event.target.checked) {
        selectedTeacherQuestions.add(question);
    } else {
        selectedTeacherQuestions.delete(question);
    }
    renderTeacherQuestions();
}

function deleteSelectedTeacherQuestions() {
    if (selectedTeacherQuestions.size === 0) {
        return alert('Pilih soal yang ingin dihapus terlebih dahulu.');
    }
    if (!confirm(`Hapus ${selectedTeacherQuestions.size} soal terpilih?`)) return;
    loadedCollections.questions = true;
    db.questions = db.questions.filter(q => !selectedTeacherQuestions.has(q));
    selectedTeacherQuestions.clear();
    save();
    renderTeacherQuestions();
}

let teacherResultsPollInterval = null;

function openPaketSoalDetail(mapel, rombel) {
    currentDetailPackage = { mapel, rombel };
    switchAdminBankSoalTab('detail');
}

function deletePaketSoal(mapel, rombel) {
    if (confirm(`Apakah Anda yakin ingin menghapus semua soal untuk Mapel ${mapel} dan Rombel ${rombel}?`)) {
        loadedCollections.questions = true;
        db.questions = db.questions.filter(q => !(q.mapel === mapel && q.rombel === rombel));
        save();
        renderAdminPaketSoal();
        if (currentDetailPackage && currentDetailPackage.mapel === mapel && currentDetailPackage.rombel === rombel) {
            closePaketDetail();
        }
    }
}

function sortPaketSoal(by) {
    if (currentSortBy === by) {
        currentSortOrder = currentSortOrder === 'asc' ? 'desc' : 'asc';
    } else {
        currentSortBy = by;
        currentSortOrder = 'asc';
    }
    renderAdminPaketSoal();
}

function closePaketDetail() {
    currentDetailPackage = null;
    switchAdminBankSoalTab('paket');
}

function populateRaportFilters() {
    const rombelSelect = document.getElementById('raport-filter-rombel');
    const siswaSelect = document.getElementById('raport-filter-siswa');
    if (rombelSelect) {
        const rombels = Array.isArray(db.rombels) ? db.rombels : [];
        rombelSelect.innerHTML = '<option value="ALL">Semua Rombel</option>' + rombels.map(r => `<option value="${r}">${r}</option>`).join('');
    }
    updateRaportSiswaFilter('ALL');

    // Sync school settings to raport filters
    const stats = db.schoolSettings || {};
    const kName = document.getElementById('raport-kepala-name');
    if (kName && stats.principal) kName.value = stats.principal;

    const kTahun = document.getElementById('raport-tahun');
    if (kTahun) {
        kTahun.value = stats.tahun || '2026/2027';
    }

    const kSem = document.getElementById('raport-semester');
    if (kSem) kSem.value = stats.semester || 'GANJIL';
}

function updateRaportSiswaFilter(selectedRombel) {
    const siswaSelect = document.getElementById('raport-filter-siswa');
    if (!siswaSelect) return;

    let students = Array.isArray(db.students) ? db.students.filter(s => s.role === 'student') : [];

    if (selectedRombel && selectedRombel !== 'ALL') {
        students = students.filter(s => s.rombel === selectedRombel);
    }

    students = students.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    const showRombel = selectedRombel === 'ALL';
    siswaSelect.innerHTML = '<option value="ALL">Semua Siswa</option>' + students.map(s => `<option value="${s.id}">${s.name}${showRombel ? ` (${s.rombel || '-'})` : ''}</option>`).join('');

    // Reset siswa selection to ALL if current selection is not in the filtered list
    const currentSiswa = siswaSelect.value;
    if (currentSiswa !== 'ALL' && !students.some(s => s.id === currentSiswa)) {
        siswaSelect.value = 'ALL';
    }
}

function addTfRow() {
    const container = document.getElementById('q-tf-container');
    if (!container) return;

    const row = document.createElement('div');
    row.className = 'tf-row flex items-center gap-2';
    row.innerHTML = `
                <input type="text" class="tf-statement flex-1 p-3 bg-slate-50 rounded-xl text-sm border-none" placeholder="Pernyataan">
                <select class="tf-correct p-3 bg-slate-50 rounded-xl text-sm border-none">
                    <option value="">--Benar/Salah--</option>
                    <option value="true">Benar</option>
                    <option value="false">Salah</option>
                </select>
                <button type="button" onclick="removeTfRow(this)" class="text-red-500">&times;</button>
            `;

    // Find the add button (has addTfRow in onclick)
    const addButton = container.querySelector('button[onclick*="addTfRow"]');
    if (addButton) {
        container.insertBefore(row, addButton);
    } else {
        // Fallback: just append to container
        container.appendChild(row);
    }
}

function removeTfRow(btn) {
    const row = btn.closest('.tf-row');
    if (row) row.remove();
}

function addMatchingQRow() {
    const container = document.getElementById('q-matching-questions');
    if (!container) return;

    const row = document.createElement('div');
    row.className = 'matching-q-row flex items-center gap-2';
    row.innerHTML = `
                <input type="text" class="matching-question flex-1 p-3 bg-slate-50 rounded-xl text-sm border-none" placeholder="Pertanyaan ${container.children.length + 1}">
                <button type="button" onclick="removeMatchingQRow(this)" class="text-red-500">&times;</button>
            `;

    container.appendChild(row);
}

function removeMatchingQRow(btn) {
    const row = btn.closest('.matching-q-row');
    if (row) row.remove();
}

function openQuestionModal() {
    console.log('openQuestionModal called');
    try {
        editQuestionIndex = null;
        window.matchingEditOriginalCorrect = null;

        // Show the modal first
        const modal = document.getElementById('question-modal');
        if (!modal) {
            console.error('question-modal not found');
            return;
        }
        modal.classList.remove('hidden');
        modal.classList.add('flex');

        // Initialize Quill editors
        setTimeout(() => initQuillEditors(), 50);

        // Reset form fields
        const typeEl = document.getElementById('q-type');
        if (typeEl) typeEl.value = 'single';

        // Clear Quill question editor
        setTimeout(() => {
            if (window._quillQuestion) window._quillQuestion.setContents([]);
            if (window._quillAnswer) window._quillAnswer.setContents([]);
        }, 80);

        const textEl = document.getElementById('q-text');
        if (textEl) textEl.value = '';

        const ansEl = document.getElementById('q-answer-text');
        if (ansEl) ansEl.value = '';

        // Clear options
        document.querySelectorAll('.q-opt').forEach(opt => {
            opt.value = '';
        });

        // Clear image
        const imgFile = document.getElementById('q-image-file');
        if (imgFile) imgFile.value = null;

        // Clear multiple images preview
        const imgPreviewContainer = document.getElementById('q-images-preview');
        if (imgPreviewContainer) imgPreviewContainer.innerHTML = '';
        const imgListContainer = document.getElementById('q-images-list');
        if (imgListContainer) imgListContainer.innerHTML = '';
        window.storedImages = [];

        // Reset TF rows
        const tfCont = document.getElementById('q-tf-container');
        if (tfCont) {
            tfCont.querySelectorAll('.tf-row').forEach(r => r.remove());
            if (typeof addTfRow === 'function') {
                addTfRow();
                addTfRow();
            }
        }

        // Populate dropdowns and update UI
        populateSelects(['q-mapel', 'q-rombel']);

        // Filter for teacher mode
        if (window.isTeacherMode) {
            const teacher = db.students.find(s => s.id === currentSiswa.id);
            if (teacher) {
                // Filter mapel
                const mapelSelect = document.getElementById('q-mapel');
                if (mapelSelect && teacher.subjects) {
                    const names = teacherSubjectNames(teacher);
                    mapelSelect.innerHTML = '<option value="">--Pilih Mapel--</option>' + names.map(n => `<option value="${n}">${n}</option>`).join('');
                }
                // Filter rombel (update when mapel changes)
                const rombelSelect = document.getElementById('q-rombel');
                if (rombelSelect) {
                    const updateRombs = (chosen) => {
                        let rombelsToUse;
                        if (chosen) {
                            rombelsToUse = teacherAllowedRombels(teacher, chosen);
                        } else {
                            rombelsToUse = teacherCombinedRombels(teacher).length > 0 ? teacherCombinedRombels(teacher) : db.rombels;
                        }
                        rombelSelect.innerHTML = '<option value="">--Pilih Rombel--</option>' + rombelsToUse.map(r => `<option value="${r}">${r}</option>`).join('');
                    };
                    updateRombs(mapelSelect ? mapelSelect.value : '');
                    if (mapelSelect) mapelSelect.addEventListener('change', () => updateRombs(mapelSelect.value));
                }
            }
        }

        onQuestionTypeChange();

        console.log('openQuestionModal completed successfully');
    } catch (err) {
        console.error('Error opening question modal:', err, err.stack);
        alert('Terjadi kesalahan: ' + err.message);
    }
}

function openEditQuestionModal(idx) {
    editQuestionIndex = idx;
    window.matchingEditOriginalCorrect = null;
    const q = db.questions[idx];
    populateSelects(['q-mapel', 'q-rombel']);

    // Filter for teacher mode
    if (window.isTeacherMode) {
        const teacher = db.students.find(s => s.id === currentSiswa.id);
        if (teacher) {
            // Filter mapel
            const mapelSelect = document.getElementById('q-mapel');
            if (mapelSelect && teacher.subjects) {
                const names = teacherSubjectNames(teacher);
                mapelSelect.innerHTML = '<option value="">--Pilih Mapel--</option>' + names.map(n => `<option value="${n}">${n}</option>`).join('');
            }
            // Filter rombel (update when mapel changes)
            const rombelSelect = document.getElementById('q-rombel');
            if (rombelSelect) {
                const updateRombs = (chosen) => {
                    let rombelsToUse;
                    if (chosen) {
                        rombelsToUse = teacherAllowedRombels(teacher, chosen);
                    } else {
                        rombelsToUse = teacherCombinedRombels(teacher).length > 0 ? teacherCombinedRombels(teacher) : db.rombels;
                    }
                    rombelSelect.innerHTML = '<option value="">--Pilih Rombel--</option>' + rombelsToUse.map(r => `<option value="${r}">${r}</option>`).join('');
                };
                updateRombs(mapelSelect ? mapelSelect.value : '');
                if (mapelSelect) mapelSelect.addEventListener('change', () => updateRombs(mapelSelect.value));
            }
        }
    }

    document.getElementById('q-mapel').value = q.mapel;
    document.getElementById('q-rombel').value = q.rombel;
    // Set Quill content
    setTimeout(() => {
        initQuillEditors();
        setQuillContent('question', q.text || '');
        if (q.type === 'text') {
            setQuillContent('answer', q.correct || '');
        } else {
            if (window._quillAnswer) window._quillAnswer.setContents([]);
        }
    }, 80);
    const textEl = document.getElementById('q-text');
    if (textEl) textEl.value = q.text || '';
    window.matchingEditOriginalCorrect = Array.isArray(q.correct) ? q.correct.slice() : null;
    // Keep hidden textarea in sync for fallback
    const ansEl = document.getElementById('q-answer-text');
    if (q.type === 'text') {
        if (ansEl) ansEl.value = q.correct || '';
    } else {
        if (ansEl) ansEl.value = '';
    }
    document.getElementById('q-type').value = q.type || 'single';
    onQuestionTypeChange();
    if (q.type === 'tf') {
        // SELF-HEALING: If text box contains a long sentence and options are empty/generic
        const textLower = (q.text || '').toLowerCase();
        const looksLikeInstruction = textLower.includes('pilihlah') || textLower.includes('tentukan') || textLower.includes('berikut ini') || textLower.includes('instruksi');
        const isGeneric = (opt) => {
            if (!opt || String(opt).trim() === '') return true;
            const clean = String(opt).replace(/[\[\]\-\(\)\.\–\—\_]/g, '').trim().toLowerCase();
            return /^(benar|salah|true|false|ya|tidak|ok|yes|no|pilihan|option)$/.test(clean);
        };
        const optionsAreGeneric = !q.options || q.options.length === 0 || q.options.every(isGeneric);

        if (q.text && q.text.length > 25 && !looksLikeInstruction && optionsAreGeneric) {
            q.options = [q.text.replace(/^pernyataan\s*[:\-–]\s*/i, '').trim()];
            q.text = "Tentukan apakah pernyataan berikut Benar atau Salah:";
            if (!Array.isArray(q.correct) || q.correct.length === 0) q.correct = [false];
            // Update UI field for main text
            document.getElementById('q-text').value = q.text;
        }

        const tfCont = document.getElementById('q-tf-container');
        if (tfCont) {
            tfCont.querySelectorAll('.tf-row').forEach(r => r.remove());
            // Ensure at least 3 rows if empty, otherwise use existing options
            const optionCount = (Array.isArray(q.options) && q.options.length > 0) ? q.options.length : 3;
            for (let i = 0; i < optionCount; i++) {
                addTfRow();
            }
            document.querySelectorAll('#q-tf-container .tf-row').forEach((row, i) => {
                const inp = row.querySelector('.tf-statement');
                const sel = row.querySelector('.tf-correct');
                if (inp) inp.value = (q.options && q.options[i]) || '';
                if (sel) sel.value = (q.correct && Array.isArray(q.correct) ? String(q.correct[i]) : '');
            });
        }
    } else if (q.type === 'matching') {
        const qCont = document.getElementById('q-matching-questions');
        const aCont = document.getElementById('q-matching-answers');
        if (document.getElementById('q-text')) {
            document.getElementById('q-text').value = q.text || '';
            setTimeout(() => setQuillContent('question', q.text || ''), 80);
        }

        if (qCont && aCont) {
            qCont.innerHTML = '';
            aCont.innerHTML = '';

            const subQs = Array.isArray(q.questions) && q.questions.length ? q.questions : [''];
            let subAs = [];

            // ALIGNMENT LOGIC: Ensure first N slots match correct answers
            if (Array.isArray(q.correct) && q.correct.length > 0) {
                subAs = [...q.correct]; // Use correct answers as the base order
                // Add distractors from q.answers that are NOT in q.correct
                if (Array.isArray(q.answers)) {
                    const correctSet = q.correct.map(c => String(c).trim().toLowerCase());
                    const distractors = q.answers.filter(ans => !correctSet.includes(String(ans).trim().toLowerCase()));
                    subAs = subAs.concat(distractors);
                }
            } else {
                // Fallback to recovery logic if correct array is missing or invalid
                subAs = Array.isArray(q.answers) && q.answers.length ? q.answers : [];
                if (!subAs.length && Array.isArray(q.options) && q.options.length > 0) {
                    subAs = q.options.map(o => String(o)).filter(o => o.trim() !== '');
                }
            }
            if (!subAs.length) subAs = [''];

            // Populate DOM
            subQs.forEach(() => addMatchingQRow());
            subAs.forEach(() => addMatchingARow());

            document.querySelectorAll('#q-matching-questions .matching-question').forEach((inp, i) => {
                if (inp) inp.value = subQs[i] || '';
            });
            document.querySelectorAll('#q-matching-answers .matching-answer').forEach((inp, i) => {
                if (inp) inp.value = subAs[i] || '';
            });
        }
    } else {
        const opts = document.querySelectorAll('.q-opt');
        (q.options || []).forEach((opt, i) => { if (opts[i]) opts[i].value = opt; });
    }
    if (q.type === 'multiple') {
        activeCorrectMultiple = Array.isArray(q.correct) ? q.correct.slice() : [];
    } else {
        activeCorrect = q.correct || 0;
    }
    renderCorrectButtons();

    // Load images for editing
    if (q.images && Array.isArray(q.images) && q.images.length > 0) {
        window.storedImages = q.images.slice();
        renderImagePreviews();
    } else if (q.image) {
        // Backward compatibility for single image
        window.storedImages = [q.image];
        renderImagePreviews();
    } else {
        window.storedImages = [];
        renderImagePreviews();
    }
    document.getElementById('question-modal-title').innerText = 'Edit Soal';
    document.getElementById('save-question-btn').innerText = 'UPDATE SOAL';
    document.getElementById('question-modal').classList.replace('hidden', 'flex');
}

function saveQuestion() {
    const text = getQuillContent('question');
    const options = Array.from(document.querySelectorAll('.q-opt')).map(i => i.value);
    const mapel = document.getElementById('q-mapel').value;
    const rombel = document.getElementById('q-rombel').value;
    let imagesData = window.storedImages || [];
    window.storedImages = [];

    const type = document.getElementById('q-type').value;
    if (type !== 'matching' && !text) return alert("Lengkapi pertanyaan!");
    let record = { text, mapel, rombel, type, images: imagesData };
    if (type === 'multiple') {
        if (options.some(o => !o)) return alert("Lengkapi semua pilihan!");
        const corr = activeCorrectMultiple.slice();
        if (corr.length < 2 || corr.length > 3) return alert('Pilih 2-3 jawaban benar untuk soal pilihan ganda kompleks!');
        record.options = options;
        record.correct = corr;
    } else if (type === 'text') {
        const ans = getQuillContent('answer').trim();
        if (!ans) return alert('Tuliskan jawaban esai yang benar!');
        record.correct = ans;
    } else if (type === 'tf') {
        const rows = Array.from(document.querySelectorAll('#q-tf-container .tf-row'));
        if (rows.length < 1) return alert('Soal Benar/Salah harus memiliki minimal 1 pernyataan!');
        const stmts = [];
        const corrs = [];
        for (const r of rows) {
            const stmt = r.querySelector('.tf-statement').value.trim();
            const sel = r.querySelector('.tf-correct').value;
            if (!stmt || sel === '') return alert('Lengkapi pernyataan dan pilih Benar/Salah!');
            stmts.push(stmt);
            corrs.push(sel === 'true');
        }
        record.options = stmts;
        record.correct = corrs;
    } else if (type === 'matching') {
        const qRows = Array.from(document.querySelectorAll('#q-matching-questions .matching-question'));
        const aRows = Array.from(document.querySelectorAll('#q-matching-answers .matching-answer'));
        const questions = qRows.map(inp => inp.value.trim()).filter(v => v);
        const answers = aRows.map(inp => inp.value.trim()).filter(v => v);
        if (questions.length === 0 || answers.length === 0) return alert('Tambahkan minimal satu pertanyaan dan satu jawaban!');
        if (answers.length < questions.length) return alert('Jumlah jawaban minimal harus sama dengan jumlah pertanyaan!');
        record.questions = questions;
        record.answers = answers;
        // The first N answers in the list are treated as keys for the N questions
        record.correct = answers.slice(0, questions.length);
    } else {
        if (options.some(o => !o)) return alert("Lengkapi semua pilihan!");
        record.options = options;
        record.correct = activeCorrect;
    }
    if (editQuestionIndex !== null) {
        db.questions[editQuestionIndex] = record;
    } else {
        db.questions.push(record);
    }
    save();
    if (window.isTeacherMode) {
        renderTeacherQuestions();
    } else {
        renderAdminQuestions();
    }
    closeModals();
}

function importQuestionsJSON() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';

    input.onchange = (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function (e) {
            try {
                const imported = JSON.parse(e.target.result);
                if (!Array.isArray(imported)) {
                    alert('Format file JSON tidak valid. Harus berupa array soal (JSON).');
                    return;
                }

                let added = 0;
                imported.forEach(q => {
                    // Validasi dasar minimal ada text dan type soal
                    if (q.text && q.type) {
                        db.questions.push(q);
                        added++;
                    }
                });

                if (added > 0) {
                    save();
                    if (window.isTeacherMode || (currentSiswa && currentSiswa.role === 'teacher')) {
                        renderTeacherQuestions();
                    } else {
                        renderAdminQuestions();
                    }
                    updateStats();
                    alert(`${added} soal berhasil diimport.`);
                } else {
                    alert('Tidak ada soal valid yang ditemukan dalam file ini.');
                }
            } catch (err) {
                alert('Gagal memproses file JSON: ' + err.message);
            }
        };
        reader.readAsText(file);
    };

    input.click();
}

function exportQuestionsExcel() {
    let questionsToExport = [];
    if (window.isTeacherMode || (currentSiswa && currentSiswa.role === 'teacher')) {
        const fM = document.getElementById('teacher-filter-mapel')?.value || '';
        const fR = document.getElementById('teacher-filter-rombel')?.value || '';
        questionsToExport = db.questions.filter(q => {
            const qSubject = typeof q.mapel === 'string' ? q.mapel : q.mapel?.name || q.mapel;
            if (!teacherSubjectNames(currentSiswa).includes(qSubject)) return false;
            const allowed = teacherAllowedRombels(currentSiswa, qSubject);
            if (!allowed.includes(q.rombel)) return false;
            if (fM && qSubject !== fM) return false;
            if (fR && q.rombel !== fR) return false;
            return true;
        });
    } else {
        const fR = document.getElementById('filter-rombel').value;
        const fM = document.getElementById('filter-mapel').value;
        questionsToExport = db.questions.filter(q =>
            (fR === 'ALL' || q.rombel === fR) && (fM === 'ALL' || q.mapel === fM)
        );
    }

    if (questionsToExport.length === 0) {
        alert('Tidak ada soal yang bisa diexport berdasarkan filter saat ini.');
        return;
    }

    const flatData = questionsToExport.map(q => {
        let opsiText = '';
        if (q.options && Array.isArray(q.options)) {
            opsiText = q.options.join(' || ');
        }
        let kunciText = '';
        if (q.correct !== undefined) {
            if (Array.isArray(q.correct)) {
                kunciText = q.correct.join(' || ');
            } else {
                kunciText = q.correct;
            }
        }

        let matchQ = '';
        let matchA = '';
        if (q.questions && Array.isArray(q.questions)) matchQ = q.questions.join(' || ');
        if (q.answers && Array.isArray(q.answers)) matchA = q.answers.join(' || ');

        return {
            'Tipe': q.type || 'single',
            'Mapel': typeof q.mapel === 'string' ? q.mapel : q.mapel?.name || q.mapel,
            'Rombel': q.rombel || '',
            'Pertanyaan': q.text || '',
            'Opsi': opsiText,
            'Jawaban Benar atau Kunci': kunciText,
            'Pertanyaan Matching (Kiri)': matchQ,
            'Jawaban Matching (Kanan)': matchA,
            'Catatan': 'Gambar tidak dieskpor via format Excel'
        };
    });

    const worksheet = XLSX.utils.json_to_sheet(flatData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "BankSoal");

    XLSX.writeFile(workbook, `soal_cbt_export_${new Date().getTime()}.xlsx`);
}

function importQuestionsExcel() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx, .xls';

    input.onchange = (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function (e) {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                const jsonData = XLSX.utils.sheet_to_json(firstSheet);

                let added = 0;
                jsonData.forEach(row => {
                    if (row['Pertanyaan']) {
                        let type = row['Tipe'] || 'single';

                        let options = [];
                        if (row['Opsi']) {
                            options = row['Opsi'].toString().split('||').map(s => s.trim()).filter(s => s);
                        }

                        let correctStr = row['Jawaban Benar atau Kunci']?.toString() || '';
                        let correct;
                        if (type === 'multiple' || type === 'tf' || type === 'matching') {
                            correct = correctStr.split('||').map(s => {
                                let trimmed = s.trim();
                                if (trimmed.toLowerCase() === 'true') return true;
                                if (trimmed.toLowerCase() === 'false') return false;
                                if (!isNaN(trimmed) && trimmed !== '') return Number(trimmed);
                                return trimmed;
                            }).filter(s => s !== '');
                        } else {
                            if (!isNaN(correctStr) && correctStr !== '') {
                                correct = Number(correctStr);
                            } else {
                                correct = correctStr;
                            }
                        }

                        let matchQ = [];
                        let matchA = [];
                        if (row['Pertanyaan Matching (Kiri)']) {
                            matchQ = row['Pertanyaan Matching (Kiri)'].toString().split('||').map(s => s.trim());
                        }
                        if (row['Jawaban Matching (Kanan)']) {
                            matchA = row['Jawaban Matching (Kanan)'].toString().split('||').map(s => s.trim());
                        }

                        const newQ = {
                            type: type,
                            mapel: row['Mapel'] || 'General',
                            rombel: row['Rombel'] || '',
                            text: row['Pertanyaan'],
                        };

                        if (options.length > 0) newQ.options = options;
                        if (correct !== undefined && correct !== '') newQ.correct = correct;
                        if (matchQ.length > 0) newQ.questions = matchQ;
                        if (matchA.length > 0) newQ.answers = matchA;

                        db.questions.push(newQ);
                        added++;
                    }
                });

                if (added > 0) {
                    save();
                    if (window.isTeacherMode || (currentSiswa && currentSiswa.role === 'teacher')) {
                        renderTeacherQuestions();
                    } else {
                        renderAdminQuestions();
                    }
                    updateStats();
                    alert(`${added} soal dari Excel berhasil diimport.`);
                } else {
                    alert('Tidak ada soal valid yang ditemukan dalam file Excel ini atau format kolom tidak sesuai.');
                }
            } catch (err) {
                alert('Gagal memproses file Excel: ' + err.message);
            }
        };
        reader.readAsArrayBuffer(file);
    };

    input.click();
}

async function openImportModal() {
    populateSelects(['import-mapel', 'import-rombel']);
    if (window.isTeacherMode) {
        const mapelSelect = document.getElementById('import-mapel');
        const teacherSubjects = teacherSubjectNames(currentSiswa);
        mapelSelect.innerHTML = teacherSubjects.map(subj => `<option value="${subj}">${subj}</option>`).join('');
    }
    document.getElementById('import-text-area').value = '';
    document.getElementById('import-word-file').value = null;

    // check backend availability so user isn’t surprised by 404 later
    const warningEl = document.getElementById('import-backend-warning');
    const btn = document.querySelector('[onclick="processImport()"]');
    const fileInput = document.getElementById('import-word-file');
    const backendOk = await pingBackend();
    if (!backendOk) {
        warningEl.textContent = '⚠️ Server tidak tersedia. Jalankan backend untuk menggunakan fitur ini.';
        fileInput.disabled = true;
        btn.disabled = true;
    } else {
        warningEl.textContent = '';
        fileInput.disabled = false;
        btn.disabled = false;
    }

    document.getElementById('import-word-file').value = null;
    document.getElementById('import-modal').classList.replace('hidden', 'flex');
}

function processImport() {
    const mapel = document.getElementById('import-mapel').value;
    const rombel = document.getElementById('import-rombel').value;

    if (window.isTeacherMode && !teacherSubjectNames(currentSiswa).includes(mapel)) {
        alert('Anda hanya dapat mengimport soal untuk mata pelajaran yang Anda ajar!');
        return;
    }

    let added = 0, failed = 0;
    const importLog = [];

    // If Word parsing already produced questions (new backend feature), use them
    if (window.importedQuestions && window.importedQuestions.length > 0) {
        const questions = window.importedQuestions;
        console.log('🔄 Processing', questions.length, 'imported questions');

        questions.forEach((q, idx) => {
            try {
                if (!q.text) {
                    failed++;
                    importLog.push(`❌ Soal ${idx + 1}: Text kosong`);
                    return;
                }
                const qCopy = {
                    ...q,
                    mapel: q.mapel || mapel || 'General',
                    rombel: q.rombel || rombel || ''
                };
                db.questions.push(qCopy);
                added++;
            } catch (err) {
                console.error('Error adding question:', err);
                failed++;
            }
        });

        window.importedQuestions = null;
        window.importCount = 0;
    } else {
        // legacy text import
        let raw = document.getElementById('import-text-area').value.trim();
        if (!raw) return alert('Tempel teks soal terlebih dahulu atau pilih file Word!');

        const blocks = raw.split(/\n{2,}/).map(b => b.trim()).filter(Boolean);

        blocks.forEach(block => {
            // capture everything after "Kunci:" as keyText
            const keyFullMatch = block.match(/kunci\s*[:\-]?\s*(.+)/i);
            let keyText = keyFullMatch ? keyFullMatch[1].trim() : null;
            let keyLetters = [];
            let isEssay = false;
            if (keyText) {
                const letterPattern = /^([A-D](?:\s*,\s*[A-D])*)$/i;
                const letterMatch = keyText.match(letterPattern);
                if (letterMatch) {
                    keyLetters = letterMatch[1].toUpperCase().split(/\s*,\s*/);
                } else {
                    isEssay = true;
                }
            }

            // remove the key line entirely from content
            let content = block.replace(/kunci\s*[:\-]?\s*.+/i, '').trim();

            // split question text and options by detecting markers like A., [ ], or o [ ]
            const parts = content.split(/[\s\n]+(?=(?:[A-D][\.\)\:\-\s]|[o\-\*]?\s*\[[\s_xX]?\])\s*)/i);
            const qText = parts[0].replace(/^[0-9]+\.\s*/, '').trim();
            const opts = [];
            const autoKeys = [];
            for (let i = 1; i < parts.length; i++) {
                const rawOpt = parts[i];
                // Detect if this option is marked as correct [x]
                if (/[o\-\*]?\s*\[[xX]\]/i.test(rawOpt)) {
                    autoKeys.push(i - 1);
                }
                // Clean up the marker
                opts.push(rawOpt.replace(/^(?:[A-D][\.\)\:\-\s]|[o\-\*]?\s*\[[\s_xX]?\])\s*/i, '').trim());
            }

            // fallback: try splitting by letters if no [ ] found but still only 1 part
            if (opts.length < 2) {
                const alt = content.split(/\s+(?=[A-D][\.\)\:\-\s])/i).slice(1);
                if (alt.length >= 2) {
                    opts.length = 0;
                    alt.forEach(a => opts.push(a.trim().replace(/^[A-D][\.\)\:\-\s]\s*/i, '')));
                }
            }

            if (isEssay) {
                // essay type question
                if (qText && keyText) {
                    db.questions.push({ text: qText, mapel, rombel, type: 'text', correct: keyText });
                    added++;
                } else {
                    failed++;
                }
            } else if (opts.length >= 2 && (keyLetters.length > 0 || autoKeys.length > 0)) {
                // multiple-choice question (single or complex)
                let indices = keyLetters.map(l => l.charCodeAt(0) - 65).filter(i => i >= 0 && i < opts.length);

                // If no keyLetters found from "Kunci:", use autoKeys from [x] markers
                if (indices.length === 0 && autoKeys.length > 0) {
                    indices = autoKeys;
                }

                const qType = indices.length > 1 ? 'multiple' : 'single';
                let correctVal = qType === 'multiple' ? indices : indices[0];

                // Limit to 4 options as requested
                const finalOpts = opts.slice(0, 4);
                if (qType === 'multiple' && Array.isArray(correctVal)) {
                    correctVal = correctVal.filter(idx => idx < 4);
                } else if (qType === 'single' && typeof correctVal === 'number' && correctVal >= 4) {
                    correctVal = 0; // fallback
                }

                db.questions.push({ text: qText, options: finalOpts, mapel, rombel, type: qType, correct: correctVal });
                added++;
            } else {
                // unable to parse
                failed++;
                importLog.push(`❌ Soal Gagal: Format tidak dikenali atau kunci jawaban tidak ditemukan (Blok: "${qText.substring(0, 30)}...")`);
            }
        });
    }


    save();

    // Show detailed result
    const resultMsg = `✅ Import Berhasil!\n\nDitambahkan: ${added} soal\n${failed > 0 ? `Gagal: ${failed} soal` : 'Semua soal berhasil diproses!'}`;
    alert(resultMsg);

    console.log('✅ Import complete. Added:', added, 'Failed:', failed);
    console.log(importLog.join('\n'));

    if (window.isTeacherMode) {
        renderTeacherQuestions();
    } else {
        renderAdminQuestions();
    }
    closeModals();
}

function importDatabase(event) {
    const file = event?.target?.files?.[0];
    if (!file) return;
    if (!confirm('Restore database akan menggantikan data saat ini. Lanjutkan?')) return;
    const reader = new FileReader();
    reader.onload = e => {
        try {
            const parsed = JSON.parse(e.target.result);
            if (parsed && typeof parsed === 'object') {
                db = parsed;
                save();
                // Refresh UI tanpa reload halaman — sinkronkan manual via tombol Sinkron jika diperlukan
                if (typeof updateStats === 'function') updateStats();
                if (typeof populateSelects === 'function') populateSelects(['filter-mapel', 'filter-rombel', 'results-filter-rombel', 'results-filter-mapel'], true);
                if (typeof renderAdminQuestions === 'function') renderAdminQuestions();
                if (typeof renderAdminPaketSoal === 'function') renderAdminPaketSoal();
                if (typeof renderAdminResults === 'function') renderAdminResults();
                if (typeof renderAdminStudents === 'function') renderAdminStudents();
                if (typeof renderRombelSection === 'function') renderRombelSection();
                if (typeof renderUserLogs === 'function') renderUserLogs();
                if (typeof markAdminChanges === 'function') markAdminChanges();
                if (typeof showToast === 'function') {
                    showToast('✅ Restore berhasil! Tekan tombol SINKRON untuk mengirim ke server.', 'success');
                } else {
                    alert('✅ Restore berhasil! Tekan tombol Sinkron untuk mengirim data ke server.');
                }
            } else {
                alert('Format file tidak valid.');
            }
        } catch (err) {
            alert('Gagal membaca file: ' + err.message);
        }
    };
    reader.readAsText(file);
    // reset input value so same file can be selected again
    event.target.value = '';
}

async function handleWordFile(event) {
    const file = event.target.files[0];
    if (!file) return;
    // quick backend ping before doing anything else
    const backendOk = await pingBackend();
    if (!backendOk) {
        const textarea = document.getElementById('import-text-area');
        textarea.value = 'Copy Paste secara manual dengan format\n\n' +
            'Contoh format word pilihan ganda\n' +
            '1. Apa itu teks prosedur....\n' +
            'A. Langkah-langkah\n' +
            'B. Rangkaian\n' +
            'C. Informasi\n' +
            'D. Berita\n' +
            'Kunci: A\n\n' +
            'Contoh format word pilihan ganda kompleks\n' +
            '1. Apa itu teks prosedur....\n' +
            'A. Langkah-langkah\n' +
            'B. Rangkaian\n' +
            'C. Informasi\n' +
            'D. Berita\n' +
            'Kunci: A, B\n\n' +
            'Contoh format word urauan/esai\n' +
            '1. Apa itu teks prosedur....\n' +
            'Kunci: Teks yang memuat langkah-langkah';
        alert('Tidak dapat menghubungi server. Silakan copy-paste manual di sini mengikuti contoh di textarea.');
        return;
    }


    try {
        // Show loading state
        const btn = document.querySelector('[onclick="processImport()"]');
        const originalText = btn.textContent;
        const textarea = document.getElementById('import-text-area');

        btn.disabled = true;
        btn.textContent = '⏳ Memproses Word...';
        textarea.value = '⏳ Sedang membaca file Word...';

        // Create FormData and send to backend
        const formData = new FormData();
        formData.append('file', file);
        formData.append('subject', document.getElementById('import-mapel').value);
        formData.append('class', document.getElementById('import-rombel').value);

        console.log('📤 Sending Word file to server:', file.name);

        const response = await fetch(getApiBaseUrl() + '/api/import-word', {
            method: 'POST',
            body: formData
        });

        console.log('📥 Response status:', response.status);
        // the backend should always send JSON, but if the server is unreachable / misconfigured
        // we may get an HTML error page (which starts with "<!DOCTYPE"). parsing that as JSON
        // throws a syntax error and leads to the issue seen in the console. guard against it.
        let result;
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
            result = await response.json();
        } else {
            // fallback: try to read text to aid debugging
            const text = await response.text();
            console.error('⚠️ Expected JSON but received:', text);
            let hint = 'Pastikan server berjalan dan endpoint benar.';
            if (response.status === 404) {
                hint = 'Endpoint tidak ditemukan (404) – apakah backend diaktifkan pada origin ini?';
            }
            throw new Error(`Server returned non-JSON response (status ${response.status}). ${hint} Lihat console untuk detail.`);
        }
        console.log('📦 Parsed result:', result);

        if (!response.ok) {
            const errorMsg = result.error || result.message || 'Unknown error';
            textarea.value = `❌ Gagal membaca Word:\n\n${errorMsg}\n\n` +
                `Contoh format word pilihan ganda\n` +
                `1. Apa itu teks prosedur\n` +
                `A. Langkah-langkah\n` +
                `B. Rangkaian\n` +
                `C. Informasi\n` +
                `D. Berita\n` +
                `Kunci: A\n\n` +
                `Contoh format word pilihan ganda kompleks\n` +
                `1. Apa itu teks prosedur\n` +
                `A. Langkah-langkah\n` +
                `B. Rangkaian\n` +
                `C. Informasi\n` +
                `D. Berita\n` +
                `Kunci: A, B\n\n` +
                `Contoh format word urauan/esai\n` +
                `1. Apa itu teks prosedur\n` +
                `Kunci: Teks yang memuat langkah-langkah`;
            alert('Gagal membaca Word: ' + errorMsg + '\nSilakan periksa format dokumen di textarea.');
            btn.disabled = false;
            btn.textContent = originalText;
            return;
        }

        // Store imported questions for preview
        window.importedQuestions = result.questions || [];
        window.importCount = result.imported || 0;

        console.log('✅ Successfully parsed:', window.importedQuestions.length, 'questions');

        // Show success message with detailed preview
        if (result.imported > 0) {
            const preview = result.questions.map((q, i) => {
                const optionsList = q.options && q.options.length > 0
                    ? `\n   Pilihan: ${q.options.map((opt, idx) => `${String.fromCharCode(65 + idx)}. ${opt}`).join(', ')}`
                    : '';
                let correctInfo = '';
                if (q.type === 'text') {
                    correctInfo = `\n   Jawab: ${q.correct}`;
                } else if (q.type === 'multiple') {
                    const correctLetters = Array.isArray(q.correct) ? q.correct.map(idx => String.fromCharCode(65 + idx)).join(', ') : String.fromCharCode(65 + q.correct);
                    correctInfo = `\n   Kunci: ${correctLetters}`;
                } else if (q.type === 'single') {
                    const correctLetter = String.fromCharCode(65 + q.correct);
                    correctInfo = `\n   Kunci: ${correctLetter}`;
                } else {
                    correctInfo = `\n   Jawab: ${Array.isArray(q.correct) ? q.correct.map(idx => q.options[idx] || `[${idx}]`).join(', ') : q.options[q.correct] || `[${q.correct}]`}`;
                }
                return `${i + 1}. ${q.text}${optionsList}${correctInfo}\n   Tipe: ${q.type === 'multiple' ? 'Pilihan Ganda Kompleks' : q.type} | Mapel: ${q.mapel} | Kelas: ${q.rombel}`;
            }).join('\n\n');

            textarea.value = `✅ BERHASIL MEMBACA ${result.imported} SOAL\n\n${preview}`;
            alert(`✅ Berhasil membaca ${result.imported} soal dari Word!\n\nKlik "PROSES IMPORT" untuk menambahkan ke database.`);
        } else {
            textarea.value = '⚠️ Tidak ada soal ditemukan dalam dokumen Word.\n\nPastikan file Anda menggunakan format yang didukung (tabel dengan kolom: Soal | Pilihan1 | ... | Jawaban atau format teks tanpa tabel seperti panduan).';
            alert('⚠️ Tidak ada soal ditemukan. Periksa format tabel atau teks dan coba lagi.');
        }

        btn.disabled = false;
        btn.textContent = originalText;

    } catch (err) {
        console.error('❌ Error:', err);
        const btn = document.querySelector('[onclick="processImport()"]');
        btn.disabled = false;
        const textarea = document.getElementById('import-text-area');
        textarea.value = 'Copy Paste secara manual dengan format\n\n' +
            'Contoh format word pilihan ganda\n' +
            '1. Apa itu teks prosedur....\n' +
            'A. Langkah-langkah\n' +
            'B. Rangkaian\n' +
            'C. Informasi\n' +
            'D. Berita\n' +
            'Kunci: A\n\n' +
            'Contoh format word pilihan ganda kompleks\n' +
            '1. Apa itu teks prosedur....\n' +
            'A. Langkah-langkah\n' +
            'B. Rangkaian\n' +
            'C. Informasi\n' +
            'D. Berita\n' +
            'Kunci: A, B\n\n' +
            'Contoh format word urauan/esai\n' +
            '1. Apa itu teks prosedur....\n' +
            'Kunci: Teks yang memuat langkah-langkah';
        alert('Gagal membaca Word. Silakan gunakan copy-paste manual seperti format di textarea.');
    }
}

function exportResultsToExcel() {
    const from = document.getElementById('results-date-from')?.value;
    const to = document.getElementById('results-date-to')?.value;
    const fromTs = from ? new Date(from + 'T00:00:00').getTime() : null;
    const toTs = to ? new Date(to + 'T23:59:59').getTime() : null;

    // Filter the results using the same logic as renderAdminResults
    const filteredResults = db.results.filter(r => {
        const rombelFilter = document.getElementById('results-filter-rombel')?.value;
        const mapelFilter = document.getElementById('results-filter-mapel')?.value;

        if (rombelFilter && rombelFilter !== 'ALL' && r.rombel !== rombelFilter) return false;
        if (mapelFilter && mapelFilter !== 'ALL' && r.mapel !== mapelFilter) return false;

        if (!fromTs && !toTs) return true;
        if (!r.date) return false;
        const t = new Date(r.date).getTime();
        if (fromTs && t < fromTs) return false;
        if (toTs && t > toTs) return false;
        return true;
    });

    // Prepare data for Excel
    const excelData = filteredResults.map(r => {
        let row = {
            'Nama Siswa': r.studentName,
            'Rombel': r.rombel,
            'Mata Pelajaran': r.mapel,
            'Tanggal': r.date ? new Date(r.date).toLocaleString() : '-',
            'Skor Akhir': r.score
        };

        // Add answers if available
        if (r.questions && r.answers) {
            r.questions.forEach((q, i) => {
                // catat jenis soal
                row[`Jenis Soal ${i + 1}`] = q.type || 'single';

                const studentAnswer = r.answers[i];
                let answerText = '';

                if (q.type === 'single') {
                    answerText = studentAnswer !== undefined && q.options ? q.options[studentAnswer] || 'Tidak dijawab' : 'Tidak dijawab';
                } else if (q.type === 'multiple') {
                    if (Array.isArray(studentAnswer) && q.options) {
                        answerText = studentAnswer.map(idx => q.options[idx]).join('; ') || 'Tidak dijawab';
                    } else {
                        answerText = 'Tidak dijawab';
                    }
                } else if (q.type === 'text') {
                    answerText = studentAnswer || 'Tidak dijawab';
                } else if (q.type === 'tf') {
                    if (Array.isArray(studentAnswer) && q.options) {
                        answerText = q.options.map((opt, idx) => `${opt}: ${studentAnswer[idx] ? 'Benar' : 'Salah'}`).join('; ');
                    } else {
                        answerText = 'Tidak dijawab';
                    }
                } else if (q.type === 'matching') {
                    let qSubQuestions = q.questions || [];
                    if (qSubQuestions.length === 0) {
                        const orig = db.questions.find(o =>
                            o.type === 'matching' && o.mapel === q.mapel &&
                            (o.text === q.text || (q.text && o.text && o.text.substring(0, 30) === q.text.substring(0, 30)))
                        );
                        if (orig) qSubQuestions = orig.questions || [];
                    }
                    if (Array.isArray(studentAnswer) && qSubQuestions.length > 0) {
                        answerText = qSubQuestions.map((sq, idx) => {
                            const a = studentAnswer[idx];
                            return `${sq}: ${(a !== null && a !== undefined) ? String(a) : 'Tidak dijawab'}`;
                        }).join('; ');
                    } else {
                        answerText = 'Tidak dijawab';
                    }
                }

                row[`Jawaban Soal ${i + 1}`] = answerText;
            });
        }

        return row;
    });

    // Create workbook and worksheet
    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Hasil Ujian');

    // Set column widths
    worksheet['!cols'] = [
        { wch: 25 },  // Nama Siswa
        { wch: 12 },  // Rombel
        { wch: 20 },  // Mata Pelajaran
        { wch: 18 },  // Tanggal
        { wch: 12 }   // Skor Akhir
    ];

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `Hasil_Ujian_${timestamp}.xlsx`;

    // Write the file
    XLSX.writeFile(workbook, filename);
}

function exportTeacherResultsToExcel() {
    if (!currentSiswa || !currentSiswa.subjects) {
        alert('Data guru tidak valid');
        return;
    }

    // Get filter values
    const selectedMapel = document.getElementById('teacher-results-filter-mapel')?.value || '';
    const selectedRombel = document.getElementById('teacher-results-filter-rombel')?.value || '';

    // Filter results using the same logic as renderTeacherResults
    let filteredResults = db.results.filter(r => {
        // Filter out deleted results
        if (r.deleted) return false;

        // Filter by teacher's subjects (normalized)
        if (!teacherSubjectNames(currentSiswa).includes(r.mapel)) return false;
        // also restrict by rombels per subject
        const allowed = teacherAllowedRombels(currentSiswa, r.mapel);
        if (!allowed.includes(r.rombel)) return false;

        // Filter by selected mapel
        if (selectedMapel && r.mapel !== selectedMapel) return false;

        // Filter by selected rombel
        if (selectedRombel && r.rombel !== selectedRombel) return false;

        return true;
    });

    // Prepare data for Excel
    const excelData = filteredResults.map(r => {
        let row = {
            'Nama Siswa': r.studentName,
            'Rombel': r.rombel,
            'Mata Pelajaran': r.mapel,
            'Tanggal': r.date ? new Date(r.date).toLocaleString() : '-',
            'Skor Akhir': r.score
        };

        // Add answers if available
        if (r.questions && r.answers) {
            r.questions.forEach((q, i) => {
                // sertakan jenis soal
                row[`Jenis Soal ${i + 1}`] = q.type || 'single';

                const studentAnswer = r.answers[i];
                let answerText = '';

                if (q.type === 'single') {
                    answerText = studentAnswer !== undefined && q.options ? q.options[studentAnswer] || 'Tidak dijawab' : 'Tidak dijawab';
                } else if (q.type === 'multiple') {
                    if (Array.isArray(studentAnswer) && q.options) {
                        answerText = studentAnswer.map(idx => q.options[idx]).join('; ') || 'Tidak dijawab';
                    } else {
                        answerText = 'Tidak dijawab';
                    }
                } else if (q.type === 'text') {
                    answerText = studentAnswer || 'Tidak dijawab';
                } else if (q.type === 'tf') {
                    if (Array.isArray(studentAnswer) && q.options) {
                        answerText = q.options.map((opt, idx) => `${opt}: ${studentAnswer[idx] ? 'Benar' : 'Salah'}`).join('; ');
                    } else {
                        answerText = 'Tidak dijawab';
                    }
                } else if (q.type === 'matching') {
                    let qSubQuestions = q.questions || [];
                    if (qSubQuestions.length === 0) {
                        const orig = db.questions.find(o =>
                            o.type === 'matching' && o.mapel === q.mapel &&
                            (o.text === q.text || (q.text && o.text && o.text.substring(0, 30) === q.text.substring(0, 30)))
                        );
                        if (orig) qSubQuestions = orig.questions || [];
                    }
                    if (Array.isArray(studentAnswer) && qSubQuestions.length > 0) {
                        answerText = qSubQuestions.map((sq, idx) => {
                            const a = studentAnswer[idx];
                            return `${sq}: ${(a !== null && a !== undefined) ? String(a) : 'Tidak dijawab'}`;
                        }).join('; ');
                    } else {
                        answerText = 'Tidak dijawab';
                    }
                }

                row[`Jawaban Soal ${i + 1}`] = answerText;
            });
        }

        return row;
    });

    // Create workbook and worksheet
    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Hasil Ujian');

    // Set column widths
    worksheet['!cols'] = [
        { wch: 25 },  // Nama Siswa
        { wch: 12 },  // Rombel
        { wch: 20 },  // Mata Pelajaran
        { wch: 18 },  // Tanggal
        { wch: 12 }   // Skor Akhir
    ];

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `Hasil_Ujian_Siswa_${timestamp}.xlsx`;

    // Write the file
    XLSX.writeFile(workbook, filename);
}

async function syncGradesToRaport() {
    const rombel = document.getElementById('raport-filter-rombel').value;
    const siswaId = document.getElementById('raport-filter-siswa')?.value || 'ALL';

    if (!rombel || rombel === 'ALL') return alert('Pilih Rombel spesifik terlebih dahulu.');

    let confirmMsg = `Ambil Nilai Akhir yang sudah diolah guru di rombel ${rombel}?`;
    if (siswaId !== 'ALL') {
        const student = (db.students || []).find(s => s.id === siswaId);
        const studentName = student ? student.name : siswaId;
        confirmMsg = `Ambil Nilai Akhir yang sudah diolah guru untuk siswa: ${studentName}?`;
    }

    if (!confirm(confirmMsg + `\nNilai-nilai ini akan dipindahkan ke daftar Raport untuk dicetak.`)) return;

    try {
        // 1. Ambil data nilai dari guru
        const resGrades = await fetch(getApiBaseUrl() + `/api/grades?rombel=${encodeURIComponent(rombel)}`);
        let grades = await resGrades.json();

        // 1.1 Filter by student if specified
        if (siswaId !== 'ALL') {
            grades = grades.filter(g => String(g.student_id).toLowerCase() === String(siswaId).toLowerCase());
        }

        if (!grades || !grades.length) {
            return alert('Tidak ada data nilai akhir guru ditemukan. Pastikan guru sudah menyimpan nilai di Manajemen Nilai.');
        }

        // 2. Petakan ke format hasil ujian (results)
        const syncDate = new Date().toISOString().split('T')[0]; // Stability for overwriting same-day syncs
        const syncData = grades.map(g => {
            const student = db.students.find(s => String(s.id).toLowerCase() === String(g.student_id).toLowerCase());
            return {
                studentId: g.student_id,
                studentName: student ? student.name : g.student_id,
                rombel: g.rombel,
                mapel: g.mapel,
                score: g.nilai_akhir,
                date: syncDate,
                is_raport_sync: true // Mark as synced from teacher
            };
        });

        // 3. Simpan ke database hasil (API /api/results)
        const resSync = await fetch(getApiBaseUrl() + '/api/results', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(syncData)
        });

        if (resSync.ok) {
            // Force reload results from server
            await ensureDataLoaded('results', true);
            alert(`Berhasil menarik ${syncData.length} nilai akhir dari guru. Sekarang data siap dicetak di Raport.`);
            renderRaport();
        } else {
            throw new Error('Gagal menyimpan sinkronisasi ke server.');
        }
    } catch (e) {
        console.error('Sync error:', e);
        alert('Gagal sinkronisasi: ' + e.message);
    }
}

function renderRaport() {
    const rombel = document.getElementById('raport-filter-rombel')?.value || 'ALL';
    const siswaId = document.getElementById('raport-filter-siswa')?.value || 'ALL';
    const tahun = document.getElementById('raport-tahun')?.value || '';
    const kopRombel = document.getElementById('raport-kop-rombel');
    const kopTahun = document.getElementById('raport-kop-tahun');
    const kopSiswa = document.getElementById('raport-kop-siswa');
    const kopTanggal = document.getElementById('raport-footer-date');
    const kopParent = document.getElementById('raport-footer-parent');
    const kopWali = document.getElementById('raport-footer-wali');
    const kopKepalaTitle = document.getElementById('raport-footer-kepala-title');
    const kopKepalaName = document.getElementById('raport-footer-kepala-name');
    const raportFooter = document.getElementById('raport-footer');
    const thead = document.getElementById('raport-thead');
    const tbody = document.getElementById('raport-tbody');
    const raportEmpty = document.getElementById('raport-empty');

    const schoolStats = db.schoolSettings || {};
    const parentName = document.getElementById('raport-parent-name')?.value?.trim() || 'Orang Tua / Wali Siswa';
    const waliName = document.getElementById('raport-wali-name')?.value?.trim() || 'Wali Kelas';
    const waliNip = document.getElementById('raport-wali-nip')?.value?.trim() || '-';
    const semester = document.getElementById('raport-semester')?.value?.trim() || 'GANJIL';
    const today = new Date();
    const dateLabel = today.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });

    // Update KOP Sekolah
    const kopYayasan = document.getElementById('raport-kop-yayasan');
    const kopNama = document.getElementById('raport-kop-nama');
    const kopAlamat = document.getElementById('raport-kop-alamat');
    const kopImg = document.getElementById('raport-logo');

    if (kopYayasan) kopYayasan.textContent = schoolStats.yayasan || 'YAYASAN PENDIDIKAN';
    if (kopNama) kopNama.textContent = schoolStats.name || 'NAMA SEKOLAH';
    if (kopAlamat) kopAlamat.textContent = schoolStats.address || '-';

    const savedLogo = localStorage.getItem('cbt_school_logo');
    if (kopImg && savedLogo) kopImg.src = savedLogo;

    // Gunakan settings database, fallback ke input field, lalu ke hardcoded lama
    const kepalaTitle = document.getElementById('raport-kepala-title')?.value?.trim() || (schoolStats.name ? `Kepala ${schoolStats.name}` : 'Kepala Sekolah');
    const kepalaName = document.getElementById('raport-kepala-name')?.value?.trim() || schoolStats.principal || '-';

    // Extract location (City/Town) from settings or address
    let location = schoolStats.kota || (schoolStats.address ? (schoolStats.address.split(',').length > 1 ? schoolStats.address.split(',').pop().trim() : schoolStats.address.split(' ').pop().trim()) : '-');
    location = location.replace(/[^a-zA-Z\s]/g, ''); // Clean up symbols

    if (kopRombel) kopRombel.textContent = rombel === 'ALL' ? 'Semua' : rombel;
    if (kopTahun) kopTahun.textContent = tahun || '2026/2027';
    if (kopSiswa) {
        if (siswaId === 'ALL') {
            kopSiswa.textContent = 'Semua';
        } else {
            const siswa = (db.students || []).find(s => s.id === siswaId);
            kopSiswa.textContent = siswa ? siswa.name : 'Tidak diketahui';
        }
    }
    if (kopTanggal) kopTanggal.textContent = `${location}, ${dateLabel}`;
    if (kopParent) kopParent.textContent = parentName;
    if (kopWali) kopWali.textContent = waliName;

    const kopSemester = document.getElementById('raport-semester-view');
    if (kopSemester) kopSemester.textContent = semester;

    const kopWaliNip = document.getElementById('raport-footer-wali-nip');
    if (kopWaliNip) {
        kopWaliNip.textContent = (waliNip && waliNip !== '-') ? `NIP. ${waliNip}` : 'NIP. -';
    }
    if (kopKepalaTitle) kopKepalaTitle.textContent = kepalaTitle;
    if (kopKepalaName) kopKepalaName.textContent = kepalaName;

    // Update NIP in Raport footer
    const kopKepalaNip = document.getElementById('raport-footer-kepala-nip');
    if (kopKepalaNip) {
        kopKepalaNip.textContent = schoolStats.principalNip ? `NIP. ${schoolStats.principalNip}` : 'NIP. -';
    }

    const filtered = (db.results || []).filter(r => {
        if (r.deleted) return false;
        if (rombel !== 'ALL' && r.rombel !== rombel) return false;
        if (siswaId !== 'ALL' && r.studentId !== siswaId) return false;
        return true;
    });

    // Consolidate: only take the latest result per mapel for each student
    const consolidatedMap = new Map();
    filtered.forEach(r => {
        const key = `${r.studentId}|${r.mapel}`;
        const existing = consolidatedMap.get(key);
        if (!existing || new Date(r.date) > new Date(existing.date)) {
            consolidatedMap.set(key, r);
        }
    });
    const consolidated = Array.from(consolidatedMap.values());

    if (!consolidated.length) {
        if (tbody) tbody.innerHTML = '';
        if (raportEmpty) {
            raportEmpty.classList.remove('hidden');
            raportEmpty.classList.add('flex');
        }
        if (raportFooter) raportFooter.classList.add('hidden');
        return;
    }

    if (raportEmpty) {
        raportEmpty.classList.add('hidden');
        raportEmpty.classList.remove('flex');
    }
    if (raportFooter) raportFooter.classList.remove('hidden');

    const rows = consolidated.sort((a, b) => {
        const nameCompare = (a.studentName || '').localeCompare(b.studentName || '');
        if (nameCompare !== 0) return nameCompare;
        const subjectCompare = (a.mapel || '').localeCompare(b.mapel || '');
        if (subjectCompare !== 0) return subjectCompare;
        return new Date(b.date) - new Date(a.date);
    }).map((r, index) => {
        const dateText = r.date ? new Date(r.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
        return `
                    <tr class="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                        <td class="px-6 py-4 text-xs text-slate-600 font-medium">${index + 1}</td>
                        <td class="px-6 py-4 text-xs text-slate-600 font-bold">${r.mapel || '-'}</td>
                        <td class="px-6 py-4 text-xs text-slate-500">${dateText}</td>
                        <td class="px-6 py-4 text-xs text-center font-black text-sky-600">${Number(r.score).toFixed(1)}</td>
                        <td class="px-6 py-4 text-center">
                            <div class="flex items-center justify-center gap-2">
                                <button onclick="editRaportScore('${r.studentId}', '${r.mapel}')" 
                                    class="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 hover:bg-amber-500 hover:text-white transition-all shadow-sm flex items-center justify-center"
                                    title="Edit Nilai">
                                    <i class="fas fa-edit text-[10px]"></i>
                                </button>
                                <button onclick="deleteRaportEntry('${r.studentId}', '${r.mapel}')" 
                                    class="w-8 h-8 rounded-lg bg-red-50 text-red-500 hover:bg-red-500 hover:text-white transition-all shadow-sm flex items-center justify-center"
                                    title="Hapus Nilai">
                                    <i class="fas fa-trash-alt text-[10px]"></i>
                                </button>
                            </div>
                        </td>
                    </tr>`;
    });

    const siswaNameEl = document.getElementById('raport-siswa-name');
    const siswaRombelEl = document.getElementById('raport-siswa-rombel');
    if (siswaNameEl && siswaRombelEl) {
        if (siswaId === 'ALL') {
            siswaNameEl.textContent = 'Semua Siswa';
        } else {
            const siswa = (db.students || []).find(s => s.id === siswaId);
            siswaNameEl.textContent = siswa ? siswa.name : 'Tidak diketahui';
        }
        siswaRombelEl.textContent = rombel === 'ALL' ? 'Semua' : rombel;
    }

    if (thead) {
        thead.innerHTML = `
                    <tr>
                        <th class="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-slate-500">No</th>
                        <th class="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-slate-500">Mata Pelajaran</th>
                        <th class="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-slate-500">Tanggal</th>
                        <th class="px-6 py-4 text-center text-[10px] font-black uppercase tracking-widest text-slate-500">Nilai</th>
                        <th class="px-6 py-4 text-center text-[10px] font-black uppercase tracking-widest text-slate-500">Aksi</th>
                    </tr>`;
    }
    if (tbody) tbody.innerHTML = rows.join('');
}

function _buildRaportPrintHTML(forPrint = false) {
    renderRaport();

    // Ambil data sekolah: prioritas db, fallback ke localStorage
    let schoolDb = db.schoolSettings || {};
    let schoolLs = {};
    try {
        const raw = localStorage.getItem('cbt_school_settings') || localStorage.getItem(SCHOOL_SETTINGS_KEY);
        if (raw) schoolLs = JSON.parse(raw);
    } catch (e) { }
    const school = {
        yayasan: schoolDb.yayasan || schoolLs.yayasan || '',
        name: schoolDb.name || schoolLs.name || '',
        principal: schoolDb.principal || schoolLs.principal || '',
        principalNip: schoolDb.principalNip || schoolLs.principalNip || '',
        address: schoolDb.address || schoolLs.address || '',
        kota: schoolDb.kota || schoolLs.kota || ''
    };
    const logo = (db.schoolSettings && db.schoolSettings.logoUrl)
        ? (db.schoolSettings.logoUrl.startsWith('http') ? db.schoolSettings.logoUrl : getApiBaseUrl() + db.schoolSettings.logoUrl)
        : (localStorage.getItem('cbt_school_logo') || 'logo.png');
    const tahun = document.getElementById('raport-tahun')?.value || '2026/2027';
    const semester = document.getElementById('raport-semester')?.value || 'GANJIL';
    const siswaName = document.getElementById('raport-siswa-name')?.textContent || 'Semua Siswa';
    const rombel = document.getElementById('raport-siswa-rombel')?.textContent || 'Semua';
    const parentName = document.getElementById('raport-parent-name')?.value || '.....................';
    const waliName = document.getElementById('raport-wali-name')?.value || '.....................';
    const waliNip = document.getElementById('raport-wali-nip')?.value || '-';
    const kepalaName = school.principal || '.....................';
    const kepalaNip = school.principalNip || '-';
    const kepalaTitle = school.name ? `Kepala ${school.name}` : 'Kepala Sekolah';
    const kota = school.kota || (school.address ? school.address.split(',').pop().trim().replace(/[^a-zA-Z\s]/g, '') : '-');
    const today = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
    const tableEl = document.getElementById('raport-table');
    const tableHTML = tableEl ? tableEl.outerHTML : '';
    const yayasanHTML = school.yayasan ? `<h1>${school.yayasan}</h1>` : '';

    return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<title>${forPrint ? 'Cetak Raport' : 'Preview Raport'} - ${siswaName}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', Arial, sans-serif; font-size: 11pt; color: #0f172a; background: #fff; padding: 10mm 15mm; }
  
  /* KOP */
  .kop { display: flex; align-items: center; gap: 20px; padding-bottom: 12px; border-bottom: 3px solid #0f172a; margin-bottom: 8px; }
  .kop img { width: 70px; height: 70px; object-fit: contain; }
  .kop-text { text-align: center; flex: 1; }
  .kop-text h1 { font-size: 12pt; font-weight: 900; text-transform: uppercase; letter-spacing: 0.05em; }
  .kop-text h2 { font-size: 16pt; font-weight: 900; text-transform: uppercase; letter-spacing: 0.05em; margin: 2px 0; }
  .kop-text p { font-size: 9pt; color: #475569; }

  /* Judul */
  .judul { text-align: center; padding: 10px 0 6px; border-bottom: 1px solid #e2e8f0; }
  .judul h3 { font-size: 13pt; font-weight: 900; text-transform: uppercase; letter-spacing: 0.1em; }
  .judul p { font-size: 9pt; color: #475569; margin-top: 3px; }

  /* Info baris */
  .info-row { display: flex; justify-content: space-between; align-items: center; padding: 7px 0; border-bottom: 1px solid #e2e8f0; font-size: 10pt; font-weight: 700; }
  .semester-badge { font-weight: 900; color: #4338ca; font-size: 11pt; }

  /* Tabel */
  table { width: 100%; border-collapse: collapse; margin-top: 1px; font-size: 10pt; }
  thead th { background: #0f172a; color: #fff; padding: 8px 10px; text-align: left; font-size: 9pt; text-transform: uppercase; letter-spacing: 0.06em; font-weight: 900; }
  tbody td { padding: 8px 10px; border-bottom: 1px solid #f1f5f9; }
  tbody tr:nth-child(even) td { background: #f8fafc; }
  tfoot td { padding: 8px 10px; font-weight: 700; border-top: 2px solid #0f172a; background: #f8fafc; }

  /* Sembunyikan kolom Aksi (terakhir) saat cetak/preview */
  table th:last-child, table td:last-child { display: none !important; }

  /* Footer Tanda Tangan */
  .footer-sigs { margin-top: 30px; }
  .sig-row-top { display: flex; justify-content: space-between; margin-bottom: 40px; }
  .sig-row-bottom { display: flex; justify-content: center; }
  .sig-box { text-align: center; min-width: 180px; }
  .sig-label { font-size: 8pt; font-weight: 900; text-transform: uppercase; letter-spacing: 0.08em; color: #475569; }
  .sig-date { font-size: 8pt; color: #475569; margin-bottom: 3px; }
  .sig-space { height: 60px; }
  .sig-name { font-weight: 900; font-size: 11pt; padding-top: 4px; margin-top: 2px; min-width: 160px; display: inline-block; }
  .sig-nip { font-size: 8pt; color: #64748b; margin-top: 2px; }

  ${forPrint ? '@page { margin: 8mm 12mm; } @media print { body { padding: 0; } }' : ''}
</style>
</head>
<body>

  <!-- KOP Surat -->
  <div class="kop">
    <img src="${logo}" alt="Logo Sekolah" onerror="this.style.display='none'">
    <div class="kop-text">
      ${yayasanHTML}
      <h2>${school.name || 'NAMA SEKOLAH'}</h2>
      <p>${school.address || ''}</p>
    </div>
  </div>

  <!-- Judul -->
  <div class="judul">
    <h3>Laporan Hasil Belajar</h3>
    <p>Tahun Ajaran: <strong>${tahun}</strong></p>
  </div>

  <!-- Info Baris: Siswa | Rombel -- Semester -->
  <div class="info-row">
    <span>Nama Siswa: <strong>${siswaName}</strong> &nbsp;|&nbsp; Rombel: <strong>${rombel}</strong></span>
    <span>Semester: <span class="semester-badge">${semester.toUpperCase()}</span></span>
  </div>

  <!-- Tabel Nilai -->
  ${tableHTML}

  <!-- Tanda Tangan -->
  <div class="footer-sigs">
    <!-- Baris 1: Orang Tua & Wali Kelas -->
    <div class="sig-row-top">
      <div class="sig-box">
        <div class="sig-space"></div>
        <p class="sig-label">Orang Tua / Wali</p>
        <div class="sig-space"></div>
        <span class="sig-name">${parentName}</span>
      </div>
      <div class="sig-box">
        <p class="sig-date">${kota}, ${today}</p>
        <p class="sig-label">Wali Kelas</p>
        <div class="sig-space"></div>
        <span class="sig-name">${waliName}</span>
        <p class="sig-nip">NIP. ${waliNip !== '-' ? waliNip : '-'}</p>
      </div>
    </div>

    <!-- Baris 2: Kepala Sekolah (Tengah) -->
    <div class="sig-row-bottom">
      <div class="sig-box">
        <p class="sig-label">Mengetahui,</p>
        <p class="sig-label">${kepalaTitle}</p>
        <div class="sig-space"></div>
        <span class="sig-name">${kepalaName}</span>
        <p class="sig-nip">NIP. ${kepalaNip !== '-' ? kepalaNip : '-'}</p>
      </div>
    </div>
  </div>

${forPrint ? '<script>window.onload = function() { window.print(); }<\/script>' : ''}
</body>
</html>`;
}

function previewRaport() {
    const html = _buildRaportPrintHTML(false);
    const win = window.open('', '_blank');
    if (!win) { alert('Popup diblokir! Izinkan popup untuk halaman ini.'); return; }
    win.document.write(html);
    win.document.close();
    win.focus();
}

function printRaport() {
    const html = _buildRaportPrintHTML(true);
    const win = window.open('', '_blank');
    if (!win) { alert('Popup diblokir! Izinkan popup untuk halaman ini.'); return; }
    win.document.write(html);
    win.document.close();
    win.focus();
}

function downloadRaportPDF() {
    renderRaport();
    const raportContainer = document.getElementById('raport-container');
    if (!raportContainer || typeof html2pdf === 'undefined') return;

    const clone = raportContainer.cloneNode(true);
    clone.style.width = '210mm';
    clone.style.padding = '10mm';
    clone.style.boxSizing = 'border-box';
    const opt = {
        margin: [10, 10, 10, 10],
        filename: `Raport_${(document.getElementById('raport-siswa-name')?.textContent || 'Siswa').replace(/\s+/g, '_')}_${(document.getElementById('raport-siswa-rombel')?.textContent || 'Semua').replace(/\s+/g, '_')}_${(document.getElementById('raport-tahun')?.value || '').replace(/\D/g, '') || '2026'}.pdf`,
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: 'avoid' }
    };
    html2pdf().set(opt).from(clone).save();
}

function downloadRaportExcel() {
    renderRaport();
    const rombel = document.getElementById('raport-filter-rombel')?.value || 'ALL';
    const siswaId = document.getElementById('raport-filter-siswa')?.value || 'ALL';
    const tahun = document.getElementById('raport-tahun')?.value || '';
    const filtered = (db.results || []).filter(r => {
        if (r.deleted) return false;
        if (rombel !== 'ALL' && r.rombel !== rombel) return false;
        if (siswaId !== 'ALL' && r.studentId !== siswaId) return false;
        return true;
    });
    if (!filtered.length || typeof XLSX === 'undefined') return;

    const excelData = filtered.map((r, index) => ({
        No: index + 1,
        Mata_Pelajaran: r.mapel || '',
        Tanggal: r.date ? new Date(r.date).toLocaleDateString('id-ID') : '',
        Nilai: Number(r.score).toFixed(1)
    }));
    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Raport');
    const selectedStudent = document.getElementById('raport-filter-siswa')?.value || 'ALL';
    const studentName = (document.getElementById('raport-siswa-name')?.textContent || 'Siswa');
    const rombelName = (document.getElementById('raport-siswa-rombel')?.textContent || 'Semua');
    XLSX.writeFile(workbook, `Raport_${studentName.replace(/\s+/g, '_')}_${rombelName.replace(/\s+/g, '_')}_${tahun.replace(/\D/g, '') || '2026'}.xlsx`);
}

function openEditRaportTab() {
    const Toast = Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true
    });
    Toast.fire({
        icon: 'info',
        title: 'Mode Edit Aktif',
        text: 'Klik ikon pensil untuk EDIT atau ikon sampah untuk HAPUS nilai di tabel raport.'
    });
}

function downloadKisiKisiExcel() {
    if (!currentKisiKisiData.length) return;
    const siswaNameText = document.getElementById('raport-siswa-name')?.textContent || 'Semua';
    const siswaRombelText = document.getElementById('raport-siswa-rombel')?.textContent || 'Semua';
    const ws = XLSX.utils.json_to_sheet(currentKisiKisiData.map(item => ({
        'No': item.no,
        'Kompetensi Dasar': item.kd,
        'Materi': item.materi,
        'Indikator Soal': item.indikator,
        'Level': item.level,
        'No Soal': item.no_soal,
        'Bentuk': item.bentuk
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Kisi-kisi");
    XLSX.writeFile(wb, `Kisi-kisi_${document.getElementById('kk-mapel').value}_${document.getElementById('kk-rombel').value}.xlsx`);
}

function downloadKisiKisiWord() {
    if (!currentKisiKisiData.length) return;
    const mapel = document.getElementById('kk-mapel').value;
    const rombel = document.getElementById('kk-rombel').value;
    const schoolName = db.schoolSettings?.name || 'NAMA SEKOLAH';

    let html = `
                <div style="font-family: 'Arial', sans-serif;">
                    <h2 style="text-align: center; text-transform: uppercase;">KISI-KISI INSTRUMEN UJIAN</h2>
                    <table style="margin-bottom: 20px;">
                        <tr><td>Mata Pelajaran</td><td>: ${mapel}</td></tr>
                        <tr><td>Kelas / Rombel</td><td>: ${rombel}</td></tr>
                        <tr><td>Sekolah</td><td>: ${schoolName}</td></tr>
                    </table>
                    <table border="1" cellspacing="0" cellpadding="5" style="width: 100%; border-collapse: collapse;">
                        <thead style="background-color: #f2f2f2;">
                            <tr>
                                <th>No</th>
                                <th>Kompetensi Dasar</th>
                                <th>Materi</th>
                                <th>Indikator Soal</th>
                                <th>Level</th>
                                <th>No Soal</th>
                                <th>Bentuk</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${currentKisiKisiData.map(item => `
                                <tr>
                                    <td align="center">${item.no}</td>
                                    <td>${item.kd}</td>
                                    <td>${item.materi}</td>
                                    <td>${item.indikator}</td>
                                    <td align="center">${item.level}</td>
                                    <td align="center">${item.no_soal}</td>
                                    <td align="center">${item.bentuk}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;

    // Simple blob trick for .doc
    const header = "<html xmlns:o='urn:schemas-microsoft-com:office:office' " +
        "xmlns:w='urn:schemas-microsoft-com:office:word' " +
        "xmlns='http://www.w3.org/TR/REC-html40'>" +
        "<head><meta charset='utf-8'><title>Export HTML to Word</title></head><body>";
    const footer = "</body></html>";
    const sourceHTML = header + html + footer;

    const blob = new Blob([sourceHTML], { type: 'application/msword;charset=utf-8' });
    const fileDownload = document.createElement("a");
    document.body.appendChild(fileDownload);
    const downloadUrl = URL.createObjectURL(blob);
    fileDownload.href = downloadUrl;
    fileDownload.download = `Kisi-kisi_${mapel}_${rombel}.doc`;
    fileDownload.click();
    setTimeout(() => URL.revokeObjectURL(downloadUrl), 100);
    document.body.removeChild(fileDownload);
}

function toggleImportDropdown() {
    const dropdown = document.getElementById('import-dropdown');
    if (dropdown) dropdown.classList.toggle('hidden');
    // Hide export dropdown if open
    const exportDropdown = document.getElementById('export-dropdown');
    if (exportDropdown) exportDropdown.classList.add('hidden');
}

/**
 * Show/hide question form containers based on selected type.
 * Used when opening teacher modal.
 */
function updateQuestionTypeDisplay(type) {
    const answerTextContainer = document.getElementById('q-answer-text-container');
    const tfContainer = document.getElementById('q-tf-container');
    const matchingContainer = document.getElementById('q-matching-container');
    const optsContainer = document.getElementById('q-opts-container');
    const correctButtonsGroup = document.getElementById('q-correct-buttons-group');
    const qText = document.getElementById('q-text');
    const qOpsiGroup = document.getElementById('q-opsi-group');

    // Hide all containers first
    if (answerTextContainer) answerTextContainer.classList.add('hidden');
    if (tfContainer) tfContainer.classList.add('hidden');
    if (matchingContainer) matchingContainer.classList.add('hidden');
    if (optsContainer) optsContainer.classList.add('hidden');
    if (correctButtonsGroup) correctButtonsGroup.classList.add('hidden');
    if (qText) qText.classList.remove('hidden');
    if (qOpsiGroup) qOpsiGroup.classList.add('hidden');

    // Show relevant containers based on type
    if (type === 'text') {
        if (answerTextContainer) answerTextContainer.classList.remove('hidden');
    } else if (type === 'tf') {
        if (tfContainer) tfContainer.classList.remove('hidden');
        const existingRows = tfContainer.querySelectorAll('.tf-row').length;
        for (let i = existingRows; i < 2; i++) {
            if (typeof addTfRow === 'function') addTfRow();
        }
    } else if (type === 'matching') {
        if (matchingContainer) matchingContainer.classList.remove('hidden');
        if (qText) qText.classList.remove('hidden');
    } else {
        // single or multiple
        if (optsContainer) optsContainer.classList.remove('hidden');
        if (correctButtonsGroup) correctButtonsGroup.classList.remove('hidden');
        if (qOpsiGroup) qOpsiGroup.classList.remove('hidden');
    }
}

let teacherLiveProgressPollInterval = null;

async function startLiveProgressPolling() {
    if (!currentSiswa || currentSiswa.role !== 'teacher') return;

    if (teacherLiveProgressPollInterval) {
        clearInterval(teacherLiveProgressPollInterval);
    }

    console.log('[Teacher Progress] Starting live progress polling...');

    try {
        if (typeof syncAdminLiveState === 'function') await syncAdminLiveState();
        if (typeof renderRombelProgress === 'function') renderRombelProgress();
    } catch (err) {
        console.warn('[Teacher Progress] Initial sync failed:', err);
    }

    teacherLiveProgressPollInterval = setInterval(async () => {
        const teacherTab = document.getElementById('teacher-tab-live-progress');
        if (teacherTab && !teacherTab.classList.contains('hidden')) {
            console.log('[Teacher Progress] Syncing live state...', new Date().toLocaleTimeString());
            if (typeof syncAdminLiveState === 'function') await syncAdminLiveState();
            if (typeof renderRombelProgress === 'function') renderRombelProgress();
        } else {
            console.log('[Teacher Progress] Section hidden, stopping poll');
            stopLiveProgressPolling();
        }
    }, 4000);
}

function stopLiveProgressPolling() {
    if (teacherLiveProgressPollInterval) {
        console.log('[Teacher Progress] Stopping live progress polling');
        clearInterval(teacherLiveProgressPollInterval);
        teacherLiveProgressPollInterval = null;
    }
}




/* ==================== FILE: js/modules/admin.js ==================== */
/**
 * js/modules/admin.js
 * Part of CBT application refactored module
 */

// ===== ADMIN SYNC MODE =====
// State untuk mendeteksi perubahan belum disinkronkan ke server
let adminSyncState = {
    isAdminMode: false,
    hasUnsyncedChanges: false,
    isSyncing: false,
    lastSyncTime: null
};

console.log('[ADMIN SYNC] ✓ Admin sync state initialized');

// Fungsi untuk menandai ada perubahan belum disinkronkan
function markAdminChanges() {
    if (adminSyncState.isAdminMode && !adminSyncState.isSyncing) {
        adminSyncState.hasUnsyncedChanges = true;
        updateAdminSyncIndicator();
        console.log('[ADMIN SYNC] ⚠️ Changes marked unsaved');
    }
}

// Update visual indicator untuk perubahan yang belum disinkronkan
function updateAdminSyncIndicator() {
    const syncBtn = document.getElementById('admin-sync-btn');
    if (!syncBtn) return;

    if (adminSyncState.hasUnsyncedChanges) {
        syncBtn.classList.add('has-changes');
        syncBtn.style.animation = 'pulse-sync 2s infinite';
        console.log('[ADMIN SYNC] 🔴 Button indicator updated - has changes');
    } else {
        syncBtn.classList.remove('has-changes');
        syncBtn.style.animation = 'none';
        console.log('[ADMIN SYNC] 🔵 Button indicator updated - no changes');
    }
}

// Fungsi khusus save untuk admin (hanya localStorage, tidak ke server)
async function adminSave(options = {}) {
    if (!adminSyncState.isAdminMode) {
        // Bukan admin, lanjut ke save normal
        return save(options);
    }

    // Admin: Hanya save ke localStorage
    try {
        await saveLocalDb();
        updateStats();
        console.log('[ADMIN] Perubahan tersimpan lokal (belum ke server)');
    } catch (err) {
        console.warn('[ADMIN] LocalStorage save failed:', err.message || err);
    }
}

// Fungsi sinkronisasi ke server (dipanggil saat tombol diklik)
async function adminSyncToServer() {
    if (!adminSyncState.isAdminMode) return;
    if (adminSyncState.isSyncing) return;

    adminSyncState.isSyncing = true;
    const syncBtn = document.getElementById('admin-sync-btn');
    const originalInnerHTML = '<i class="fas fa-cloud-upload-alt"></i><div id="admin-sync-tooltip">Klik untuk sinkronkan perubahan ke server</div><div id="admin-sync-badge">!</div>';
    
    if (syncBtn) {
        syncBtn.disabled = true;
        syncBtn.classList.add('syncing');
        // Hanya animasi icon, tanpa tulisan
        syncBtn.innerHTML = '<i class="fas fa-sync-alt animate-spin"></i>';
    }

    try {
        // Panggil fungsi save() asli untuk mengirim ke server
        await save({ forceServerSave: true });
        
        adminSyncState.hasUnsyncedChanges = false;
        adminSyncState.lastSyncTime = new Date();
        
        // Tampilkan pesan sukses
        if (typeof showToast === 'function') {
            showToast('✅ Perubahan berhasil disinkronkan ke server!', 'success');
        } else {
            alert('✅ Perubahan berhasil disinkronkan ke server!');
        }
        
        console.log('[ADMIN SYNC] ✅ Berhasil sinkronkan ke server');
    } catch (err) {
        console.error('[ADMIN SYNC] ❌ Error:', err.message || err);
        if (typeof showToast === 'function') {
            showToast('❌ Gagal sinkronkan ke server: ' + (err.message || err), 'error');
        } else {
            alert('❌ Gagal sinkronkan: ' + (err.message || err));
        }
    } finally {
        adminSyncState.isSyncing = false;
        if (syncBtn) {
            syncBtn.disabled = false;
            syncBtn.classList.remove('syncing');
            // Restore innerHTML ke asli
            syncBtn.innerHTML = originalInnerHTML;
            updateAdminSyncIndicator();
        }
    }
}

// Register global function
window.adminSyncToServer = adminSyncToServer;

(function ensureAdminGlobalHandlers() {
    const fallback = (name, action) => {
        if (typeof window[name] !== 'function') {
            window[name] = function (...args) {
                if (typeof action === 'function') {
                    return action(...args);
                }
                console.warn(`[admin] Handler ${name} not ready yet.`);
            };
        }
    };

    fallback('openQuizzModal', () => {
        const modal = document.getElementById('quizz-modal');
        if (modal) {
            modal.classList.remove('hidden');
            modal.classList.add('flex');
        }
    });

    fallback('openQuizzAiModal', () => {
        const modal = document.getElementById('quizz-ai-modal');
        if (modal) {
            modal.classList.remove('hidden');
            modal.classList.add('flex');
        }
    });

    fallback('openQuizzLeaderboardModal', () => {
        const modal = document.getElementById('quizz-leaderboard-modal');
        if (modal) {
            modal.classList.remove('hidden');
            modal.classList.add('flex');
        }
    });

    fallback('openExamResultsRankingModal', () => {
        const modal = document.getElementById('exam-results-ranking-modal');
        if (modal) {
            modal.classList.remove('hidden');
            modal.classList.add('flex');
        }
        if (typeof window.fetchExamResultsRanking === 'function') {
            window.fetchExamResultsRanking();
        }
    });

    fallback('fetchExamResultsRanking', () => {
        const modal = document.getElementById('exam-results-ranking-modal');
        if (modal) {
            modal.classList.remove('hidden');
            modal.classList.add('flex');
        }
    });

    fallback('openScheduleModal', () => {
        renderScheduleChecklist();
        const modal = document.getElementById('schedule-modal');
        if (modal) modal.classList.replace('hidden', 'flex');
    });

    fallback('deleteTeacher', async (id) => {
        const result = await Swal.fire({
            title: 'Hapus Akun Guru?',
            text: "Guru yang dihapus tidak akan bisa login lagi ke sistem.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#64748b',
            confirmButtonText: 'Ya, Hapus!',
            cancelButtonText: 'Batal',
            borderRadius: '2rem'
        });

        if (result.isConfirmed) {
            db.students = db.students.filter(s => s.id !== id);
            // Reset flag agar data di-fetch ulang dari server saat berikutnya dibuka
            _hasLoadedFlags.students = false;
            if (adminSyncState.isAdminMode) {
                await adminSave();
                markAdminChanges();
            } else {
                await save();
            }
            // Re-fetch dari server untuk memastikan state benar-benar sinkron
            await ensureDataLoaded('students', true);
            renderTeachersList();
            Swal.fire({
                title: 'Terhapus!',
                text: 'Akun guru telah berhasil dihapus.',
                icon: 'success',
                borderRadius: '2rem',
                confirmButtonColor: '#f59e0b'
            });
        }
    });

    fallback('openStudentModal', () => {
        editStudentId = null;
        const nameEl = document.getElementById('st-name');
        const idEl = document.getElementById('st-id');
        const passEl = document.getElementById('st-password');
        const extraEl = document.getElementById('st-extra-fields');
        const titleEl = document.getElementById('student-modal-title');
        const btnEl = document.getElementById('student-save-btn');

        if (nameEl) nameEl.value = '';
        if (idEl) idEl.value = '';
        if (passEl) passEl.value = '';
        if (extraEl) extraEl.classList.add('hidden');
        if (titleEl) titleEl.textContent = 'Siswa Baru';
        if (btnEl) btnEl.textContent = 'DAFTAR';

        if (typeof populateSelects === 'function') populateSelects(['st-rombel']);
        const modal = document.getElementById('student-modal');
        if (modal) modal.classList.replace('hidden', 'flex');
    });

    fallback('saveStudent', function () {
        const nameEl = document.getElementById('st-name');
        const rombelEl = document.getElementById('st-rombel');
        const name = nameEl ? nameEl.value.trim() : '';
        const rombel = rombelEl ? rombelEl.value : '';

        if (!name) return alert('Nama harus diisi');

        if (editStudentId) {
            const student = Array.isArray(db?.students) ? db.students.find(x => x.id === editStudentId) : null;
            if (student) {
                const newId = document.getElementById('st-id')?.value.trim() || '';
                const newPassword = document.getElementById('st-password')?.value.trim() || '';

                if (newId && newId !== student.id) {
                    (db.results || []).forEach(r => {
                        if (r.studentId === student.id) r.studentId = newId;
                    });
                    student.id = newId;
                }

                student.name = name;
                student.rombel = rombel;
                if (newPassword) student.password = newPassword;
                if (typeof showToast === 'function') showToast('Data siswa diperbarui', 'success');
            }
        } else {
            const id = 'DRKS-' + Math.floor(1000 + Math.random() * 9000);
            if (!Array.isArray(db.students)) db.students = [];
            db.students.push({ id, password: 'escrido', name, rombel, role: 'student' });
            if (typeof showToast === 'function') showToast('Siswa berhasil didaftarkan', 'success');
        }

        if (typeof updateCompletionCharts === 'function') updateCompletionCharts();

        if (typeof adminSyncState !== 'undefined' && adminSyncState.isAdminMode) {
            if (typeof adminSave === 'function') adminSave();
            if (typeof markAdminChanges === 'function') markAdminChanges();
        } else if (typeof save === 'function') {
            save();
        }

        if (typeof renderAdminStudents === 'function') renderAdminStudents();
        if (typeof closeModals === 'function') closeModals();
    });

    fallback('editStudent', function (id) {
        const student = Array.isArray(db?.students) ? db.students.find(x => x.id === id) : null;
        if (!student) return alert('Siswa tidak ditemukan');

        editStudentId = id;
        const nameEl = document.getElementById('st-name');
        const idEl = document.getElementById('st-id');
        const passEl = document.getElementById('st-password');
        const extraEl = document.getElementById('st-extra-fields');
        const titleEl = document.getElementById('student-modal-title');
        const btnEl = document.getElementById('student-save-btn');

        if (nameEl) nameEl.value = student.name || '';
        if (idEl) idEl.value = student.id || '';
        if (passEl) passEl.value = student.password || '';
        if (extraEl) extraEl.classList.remove('hidden');
        if (titleEl) titleEl.textContent = 'Edit Siswa';
        if (btnEl) btnEl.textContent = 'PERBARUI';

        if (typeof populateSelects === 'function') populateSelects(['st-rombel']);
        const rombelSelect = document.getElementById('st-rombel');
        if (rombelSelect) rombelSelect.value = student.rombel || '';

        const modal = document.getElementById('student-modal');
        if (modal) modal.classList.replace('hidden', 'flex');
    });

    fallback('deleteStudent', function (id) {
        if (!confirm('Hapus siswa ini?')) return;
        if (Array.isArray(db?.students)) {
            db.students = db.students.filter(x => x.id !== id);
        }
        if (typeof updateCompletionCharts === 'function') updateCompletionCharts();

        if (typeof adminSyncState !== 'undefined' && adminSyncState.isAdminMode) {
            if (typeof adminSave === 'function') adminSave();
            if (typeof markAdminChanges === 'function') markAdminChanges();
        } else if (typeof save === 'function') {
            save();
        }

        if (typeof renderAdminStudents === 'function') renderAdminStudents();
    });

    fallback('resetStudentResults', function (studentId) {
        if (!confirm('Reset hasil ujian untuk siswa ini?')) return;

        let any = false;
        if (Array.isArray(db?.results)) {
            db.results = db.results.map(r => {
                if (r.studentId === studentId && !r.deleted) {
                    any = true;
                    return { ...r, deleted: true, updatedAt: Date.now() };
                }
                return r;
            });
        }

        if (!any) {
            alert('Tidak ada hasil ujian aktif untuk siswa ini.');
            return;
        }

        if (typeof loadedCollections !== 'undefined') loadedCollections.results = true;

        if (typeof adminSyncState !== 'undefined' && adminSyncState.isAdminMode) {
            if (typeof adminSave === 'function') adminSave();
            if (typeof markAdminChanges === 'function') markAdminChanges();
        } else if (typeof save === 'function') {
            save();
        }

        if (typeof updateCompletionCharts === 'function') updateCompletionCharts();
        if (typeof updateStats === 'function') updateStats();
        if (typeof renderAdminResults === 'function') renderAdminResults();
        if (typeof renderAdminStudents === 'function') renderAdminStudents();
        alert('Reset hasil ujian siswa berhasil.');
    });
})();

// Initialize Admin Sync Mode - akan dipanggil dari showAdminSection
function initAdminSyncMode() {
    // Cek apakah user adalah admin
    const currentUser = typeof currentSiswa !== 'undefined' ? currentSiswa : null;
    console.log('[ADMIN SYNC] initAdminSyncMode() called - currentUser:', currentUser ? currentUser.role : 'undefined');
    
    if (currentUser && currentUser.role === 'admin') {
        adminSyncState.isAdminMode = true;
        console.log('[ADMIN SYNC] 🔒 Admin mode activated - changes will be staged locally');
        
        // Create sync button UI immediately
        createAdminSyncUI();
    } else {
        console.log('[ADMIN SYNC] ⚠️ Not admin or currentSiswa not defined - sync button NOT created');
    }
}

window.initAdminSyncMode = initAdminSyncMode;

// Buat UI tombol sinkron
function createAdminSyncUI() {
    // Cek apakah sudah ada
    if (document.getElementById('admin-sync-btn')) {
        console.log('[ADMIN SYNC] ℹ️ Button sudah ada, skip create');
        return;
    }
    
    console.log('[ADMIN SYNC] 🔨 Creating sync button UI...');
    
    // Buat CSS untuk animation dan styling yang lebih robust
    const styleId = 'admin-sync-styles';
    if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.setTimeout = '10000';
        style.innerHTML = `
            #admin-sync-btn {
                position: fixed !important;
                bottom: 2rem !important;
                right: 2rem !important;
                z-index: 9999 !important;
                width: 60px !important;
                height: 60px !important;
                border-radius: 50% !important;
                background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%) !important;
                color: white !important;
                border: none !important;
                cursor: pointer !important;
                box-shadow: 0 4px 20px rgba(37, 99, 235, 0.4) !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                font-size: 1.5rem !important;
                transition: all 0.3s ease !important;
                font-weight: bold !important;
                text-align: center !important;
                padding: 0 !important;
                margin: 0 !important;
                outline: none !important;
                visibility: visible !important;
                opacity: 1 !important;
            }

            #admin-sync-btn:hover:not(:disabled) {
                transform: scale(1.1) !important;
                box-shadow: 0 6px 25px rgba(37, 99, 235, 0.6) !important;
            }

            #admin-sync-btn:active:not(:disabled) {
                transform: scale(0.95) !important;
            }

            #admin-sync-btn:disabled {
                opacity: 0.6 !important;
                cursor: not-allowed !important;
            }

            #admin-sync-btn.has-changes {
                animation: pulse-sync 2s infinite !important;
                background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%) !important;
                box-shadow: 0 0 20px rgba(239, 68, 68, 0.8), 0 4px 20px rgba(239, 68, 68, 0.4) !important;
            }

            #admin-sync-btn.syncing {
                background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%) !important;
                box-shadow: 0 4px 20px rgba(245, 158, 11, 0.4) !important;
            }

            @keyframes pulse-sync {
                0% {
                    box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7), 0 4px 20px rgba(239, 68, 68, 0.4);
                }
                50% {
                    box-shadow: 0 0 30px 10px rgba(239, 68, 68, 0.3), 0 4px 20px rgba(239, 68, 68, 0.4);
                }
                100% {
                    box-shadow: 0 0 0 20px rgba(239, 68, 68, 0), 0 4px 20px rgba(239, 68, 68, 0.4);
                }
            }

            @keyframes spin {
                to { transform: rotate(360deg); }
            }

            .animate-spin {
                animation: spin 1s linear infinite;
            }

            #admin-sync-tooltip {
                position: absolute !important;
                bottom: 80px !important;
                right: 0 !important;
                background: #1e293b !important;
                color: white !important;
                padding: 0.5rem 1rem !important;
                border-radius: 0.5rem !important;
                font-size: 0.75rem !important;
                font-weight: 600 !important;
                white-space: nowrap !important;
                opacity: 0 !important;
                pointer-events: none !important;
                transition: opacity 0.3s ease !important;
                z-index: 10000 !important;
                text-align: center !important;
                min-width: 200px !important;
            }

            #admin-sync-btn:hover #admin-sync-tooltip {
                opacity: 1 !important;
            }

            #admin-sync-badge {
                position: absolute !important;
                top: -5px !important;
                right: -5px !important;
                background: #ef4444 !important;
                color: white !important;
                border-radius: 50% !important;
                width: 24px !important;
                height: 24px !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                font-size: 0.75rem !important;
                font-weight: bold !important;
                border: 2px solid white !important;
                opacity: 0 !important;
                transition: opacity 0.3s ease !important;
                z-index: 10001 !important;
            }

            #admin-sync-btn.has-changes #admin-sync-badge {
                opacity: 1 !important;
            }
        `;
        document.head.appendChild(style);
        console.log('[ADMIN SYNC] ✅ CSS styles injected with !important');
    }

    // Buat button element dengan lebih robust
    const btn = document.createElement('button');
    btn.id = 'admin-sync-btn';
    btn.type = 'button';
    btn.title = 'Sinkronkan perubahan ke server (Admin)';
    btn.setAttribute('aria-label', 'Tombol sinkronkan perubahan admin');
    
    // Tambahkan event listener yang robust
    btn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        if (typeof adminSyncToServer === 'function') {
            adminSyncToServer();
        }
    });
    
    btn.innerHTML = `
        <i class="fas fa-cloud-upload-alt"></i>
        <div id="admin-sync-tooltip">Klik untuk sinkronkan perubahan ke server</div>
        <div id="admin-sync-badge">!</div>
    `;
    
    // Append ke body
    if (document.body) {
        document.body.appendChild(btn);
        console.log('[ADMIN SYNC] ✅ Sync button created and appended to body');
        console.log('[ADMIN SYNC] 📍 Button position: fixed, bottom-right corner');
        
        // Verify button is in DOM
        const checkBtn = document.getElementById('admin-sync-btn');
        if (checkBtn) {
            console.log('[ADMIN SYNC] ✅ Button verified in DOM');
            console.log('[ADMIN SYNC] 📊 Button computed style:', {
                position: window.getComputedStyle(checkBtn).position,
                display: window.getComputedStyle(checkBtn).display,
                visibility: window.getComputedStyle(checkBtn).visibility,
                opacity: window.getComputedStyle(checkBtn).opacity,
                zIndex: window.getComputedStyle(checkBtn).zIndex
            });
        } else {
            console.warn('[ADMIN SYNC] ⚠️ Button NOT verified in DOM after append!');
        }
    } else {
        console.error('[ADMIN SYNC] ❌ document.body is not available!');
        // Fallback: tunggu sampai body ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                if (document.body && !document.getElementById('admin-sync-btn')) {
                    document.body.appendChild(btn);
                    console.log('[ADMIN SYNC] ✅ Button appended after DOMContentLoaded');
                }
            });
        }
    }
}

// Helper untuk delete admin paket soal
function deleteAdminPackageQuestions(mapel, rombel) {
    if (confirm(`Hapus semua soal untuk ${mapel} / ${rombel}?`)) {
        db.questions = db.questions.filter(q => !(q.mapel === mapel && q.rombel === rombel));
        if (adminSyncState.isAdminMode) {
            adminSave();
            markAdminChanges();
        } else {
            save();
        }
        if (typeof renderAdminPaketSoal === 'function') renderAdminPaketSoal();
        if (currentDetailPackage && currentDetailPackage.mapel === mapel && currentDetailPackage.rombel === rombel) {
            currentDetailPackage = null;
            if (typeof switchAdminBankSoalTab === 'function') switchAdminBankSoalTab('paket');
        }
    }
}

window.deleteAdminPackageQuestions = deleteAdminPackageQuestions;

// Fallback initialization saat window load (untuk memastikan tombol dibuat)
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        console.log('[ADMIN SYNC] Window DOMContentLoaded - checking for admin...');
        setTimeout(() => {
            if (typeof initAdminSyncMode === 'function') {
                initAdminSyncMode();
            }
        }, 500);
    });
} else {
    // Jika page sudah loaded
    console.log('[ADMIN SYNC] Window already loaded - checking for admin...');
    setTimeout(() => {
        if (typeof initAdminSyncMode === 'function') {
            initAdminSyncMode();
        }
    }, 500);
}

function ensureQuizzActionButtons() {
    const section = document.getElementById('admin-quizz');
    if (!section) return;

    // Buttons should already be visible in the simplified HTML structure
    const mainBtn = section.querySelector('#btn-open-quizz-modal');
    const aiBtn = section.querySelector('#btn-open-quizz-ai-modal');
    
    if (mainBtn && aiBtn) {
        // Ensure buttons are visible (not hidden by any class)
        mainBtn.style.display = 'flex';
        aiBtn.style.display = 'flex';
    }
}

function showAdminSection(sec) {
    // Initialize admin sync mode (will create sync button if not exists)
    if (typeof initAdminSyncMode === 'function') {
        initAdminSyncMode();
    }
    
    const sectionEl = document.getElementById('admin-' + sec);
    if (!sectionEl) {
        console.warn('[showAdminSection] Section not found:', sec);
        return;
    }

    document.querySelectorAll('.admin-section').forEach(el => el.classList.add('hidden'));
    sectionEl.classList.remove('hidden');

    if (sec === 'quizz') {
        ensureQuizzActionButtons();
    }

    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('bg-sky-600', 'text-white');
        if (link.dataset.section === sec) {
            link.classList.add('bg-sky-600', 'text-white');
        }
    });

    if (sec === 'overview') {
        if (typeof renderUserLogs === 'function') renderUserLogs();
        if (typeof updateStats === 'function') updateStats();
        if (typeof fetchIPs === 'function') fetchIPs();
        if (typeof clearInterval === 'function') {
            if (typeof adminStatsPollInterval !== 'undefined' && adminStatsPollInterval) clearInterval(adminStatsPollInterval);
            adminStatsPollInterval = setInterval(() => {
                if (typeof updateStats === 'function') updateStats();
            }, 5000);
        }
    } else {
        if (typeof adminStatsPollInterval !== 'undefined' && adminStatsPollInterval) {
            clearInterval(adminStatsPollInterval);
            adminStatsPollInterval = null;
        }
    }

    if (sec === 'banksoal') {
        (async () => {
            if (typeof ensureDataLoaded === 'function') await ensureDataLoaded('questions');
            if (typeof populateSelects === 'function') populateSelects(['filter-mapel', 'filter-rombel'], true);
            if (typeof renderAdminPaketSoal === 'function') renderAdminPaketSoal();
            if (typeof switchAdminBankSoalTab === 'function') switchAdminBankSoalTab('paket');
        })();
    }

    if (sec === 'rombel') {
        if (typeof renderRombelSection === 'function') renderRombelSection();
        if (typeof adminRombelPollInterval !== 'undefined' && adminRombelPollInterval) clearInterval(adminRombelPollInterval);
        adminRombelPollInterval = setInterval(async () => {
            const adminSection = document.getElementById('admin-rombel');
            if (adminSection && !adminSection.classList.contains('hidden')) {
                const changed = typeof syncAdminLiveState === 'function' ? await syncAdminLiveState() : false;
                if (changed && typeof renderRombelProgress === 'function') renderRombelProgress();
            }
        }, 1000);
    } else if (typeof adminRombelPollInterval !== 'undefined' && adminRombelPollInterval) {
        clearInterval(adminRombelPollInterval);
        adminRombelPollInterval = null;
    }

    if (sec === 'students') {
        (async () => {
            if (typeof ensureDataLoaded === 'function') await ensureDataLoaded('students');
            if (typeof renderAdminStudents === 'function') renderAdminStudents();
        })();
    }

    if (sec === 'quizz' && typeof renderAdminQuizz === 'function') {
        renderAdminQuizz();
    }

    if (sec === 'results') {
        if (typeof populateSelects === 'function') populateSelects(['results-filter-rombel', 'results-filter-mapel'], true);
        if (typeof renderAdminResults === 'function') renderAdminResults();
        if (typeof fetchAndMerge === 'function') {
            fetchAndMerge();
            if (typeof resultsPollInterval !== 'undefined' && resultsPollInterval) clearInterval(resultsPollInterval);
            resultsPollInterval = setInterval(fetchAndMerge, 5000);
        }
    } else if (typeof resultsPollInterval !== 'undefined' && resultsPollInterval) {
        clearInterval(resultsPollInterval);
        resultsPollInterval = null;
    }

    if (sec === 'raport') {
        (async () => {
            if (typeof ensureDataLoaded === 'function') {
                await ensureDataLoaded('students');
                await ensureDataLoaded('results');
            }
            if (typeof populateRaportFilters === 'function') populateRaportFilters();
            if (typeof renderRaport === 'function') renderRaport();
        })();
    }

    if (sec === 'settings') {
        (async () => {
            if (typeof ensureDataLoaded === 'function') await ensureDataLoaded('students');
            const admin = Array.isArray(window.db?.students) ? window.db.students.find(x => x.role === 'admin') : null;
            const adminIdInput = document.getElementById('set-admin-id');
            if (admin && adminIdInput) adminIdInput.value = admin.id;
            if (typeof renderTeacherSubjectCheckboxes === 'function') renderTeacherSubjectCheckboxes();
            if (typeof renderTeachersList === 'function') renderTeachersList();
        })();

        const remoteUrlInput = document.getElementById('set-remote-url');
        if (remoteUrlInput) {
            remoteUrlInput.value = localStorage.getItem('REMOTE_SERVER_KEY') || '';
        }

        if (typeof loadSchoolSettings === 'function') loadSchoolSettings();
    }
}

window.showAdminSection = showAdminSection;

if (typeof window.renderAdminResults !== 'function') {
    async function renderAdminResults() {
        if (typeof ensureDataLoaded === 'function') await ensureDataLoaded('results');

        const tbody = document.getElementById('results-table-body');
        if (!tbody) return;

        const from = document.getElementById('results-date-from')?.value;
        const to = document.getElementById('results-date-to')?.value;
        const fromTs = from ? new Date(from + 'T00:00:00').getTime() : null;
        const toTs = to ? new Date(to + 'T23:59:59').getTime() : null;

        const rows = (window.db?.results || [])
            .map((r, i) => ({ r, i }))
            .filter(({ r }) => !r.deleted)
            .filter(({ r }) => {
                const rombelFilter = document.getElementById('results-filter-rombel')?.value;
                const mapelFilter = document.getElementById('results-filter-mapel')?.value;

                if (rombelFilter && rombelFilter !== 'ALL' && r.rombel !== rombelFilter) return false;
                if (mapelFilter && mapelFilter !== 'ALL' && r.mapel !== mapelFilter) return false;

                if (!fromTs && !toTs) return true;
                if (!r.date) return false;
                const t = new Date(r.date).getTime();
                if (fromTs && t < fromTs) return false;
                if (toTs && t > toTs) return false;
                return true;
            })
            .map(({ r, i }) => {
                const hasEssay = Array.isArray(r.questions) && r.questions.some(q => q.type === 'text');
                const allEssayDone = hasEssay && Array.isArray(r.questions) &&
                    r.questions.every((q, qi) => q.type !== 'text' || (r.manualScores && r.manualScores[qi] !== undefined && r.manualScores[qi] !== null));
                const scoreDisplay = r.score != null && !isNaN(Number(r.score)) ? Number(r.score).toFixed(1) : '-';

                let aiBtn = '';
                if (hasEssay) {
                    if (allEssayDone) {
                        aiBtn = `<button onclick="batchAiCorrectEssay(${i})" id="ai-batch-btn-${i}" title="Koreksi ulang semua esai dengan AI" class="ml-2 inline-flex items-center gap-1 px-2 py-0.5 bg-violet-100 hover:bg-violet-200 text-violet-700 text-[10px] font-black rounded-lg border border-violet-300 transition-all"><i class="fas fa-robot"></i> ✓ Koreksi Ulang</button>`;
                    } else {
                        aiBtn = `<button onclick="batchAiCorrectEssay(${i})" id="ai-batch-btn-${i}" title="Koreksi semua soal esai dengan AI" class="ml-2 inline-flex items-center gap-1 px-2 py-0.5 bg-violet-600 hover:bg-violet-700 text-white text-[10px] font-black rounded-lg transition-all shadow-sm"><i class="fas fa-magic"></i> Koreksi AI</button>`;
                    }
                }

                return `
                    <tr>
                        <td class="px-6 py-4 font-bold">${r.studentName || '-'}</td>
                        <td class="px-6 py-4 text-xs">${r.rombel || '-'}</td>
                        <td class="px-6 py-4 text-xs font-medium">${r.mapel || '-'}</td>
                        <td class="px-6 py-4 text-xs">${r.date ? new Date(r.date).toLocaleString() : '-'}</td>
                        <td class="px-6 py-4 text-center">
                            <span class="font-black text-sky-600">${scoreDisplay}</span>
                            ${aiBtn}
                        </td>
                        <td class="px-6 py-4 text-center">
                            <button onclick="viewDetailedResult(${i})" class="text-sky-400 hover:text-sky-600 mr-2" title="Lihat Jawaban"><i class="fas fa-eye"></i></button>
                            <button onclick="deleteResult(${i})" class="text-red-400 hover:text-red-600" title="Hapus"><i class="fas fa-trash"></i></button>
                        </td>
                    </tr>
                `;
            }).join('');

        tbody.innerHTML = rows;
    }
    window.renderAdminResults = renderAdminResults;
}

if (typeof window.batchAiCorrectAllStudents !== 'function') {
    async function batchAiCorrectAllStudents() {
        if (typeof pingBackend === 'function') {
            const serverOk = await pingBackend();
            if (!serverOk) {
                const currentBase = typeof getApiBaseUrl === 'function' ? getApiBaseUrl() : window.location.origin;
                alert(`⚠️ Gagal terhubung ke server!\n\nAlamat: ${currentBase}\n\nPastikan server aktif dan alamat server di Pengaturan Admin sudah benar.`);
                return;
            }
        }

        const isTeacher = document.getElementById('teacher-dashboard') && !document.getElementById('teacher-dashboard').classList.contains('hidden');
        let poolResults = [];

        if (isTeacher && window.currentSiswa && window.currentSiswa.subjects) {
            const selectedMapel = document.getElementById('teacher-results-filter-mapel')?.value || '';
            const selectedRombel = document.getElementById('teacher-results-filter-rombel')?.value || '';
            (window.db?.results || []).forEach((r, i) => {
                if (r.deleted) return;
                if (typeof teacherSubjectNames === 'function' && !teacherSubjectNames(window.currentSiswa).includes(r.mapel)) return;
                const allowed = (typeof teacherAllowedRombels === 'function' && teacherAllowedRombels(window.currentSiswa, r.mapel)) || [];
                if (!allowed.includes(r.rombel)) return;
                if (selectedMapel && r.mapel !== selectedMapel) return;
                if (selectedRombel && r.rombel !== selectedRombel) return;
                if (Array.isArray(r.questions)) poolResults.push({ resultIdx: i, result: r });
            });
        } else {
            const rombelFilter = document.getElementById('results-filter-rombel')?.value;
            const mapelFilter = document.getElementById('results-filter-mapel')?.value;
            const from = document.getElementById('results-date-from')?.value;
            const to = document.getElementById('results-date-to')?.value;
            const fromTs = from ? new Date(from + 'T00:00:00').getTime() : null;
            const toTs = to ? new Date(to + 'T23:59:59').getTime() : null;

            (window.db?.results || []).forEach((r, i) => {
                if (r.deleted) return;
                if (rombelFilter && rombelFilter !== 'ALL' && r.rombel !== rombelFilter) return;
                if (mapelFilter && mapelFilter !== 'ALL' && r.mapel !== mapelFilter) return;
                if (fromTs || toTs) {
                    if (!r.date) return;
                    const t = new Date(r.date).getTime();
                    if (fromTs && t < fromTs) return;
                    if (toTs && t > toTs) return;
                }
                if (Array.isArray(r.questions)) poolResults.push({ resultIdx: i, result: r });
            });
        }

        const workItems = [];
        poolResults.forEach(({ resultIdx, result }) => {
            const questions = result.questions || [];
            const answers = result.answers || [];
            questions.forEach((q, qi) => {
                if (q.type === 'text' && (!result.manualScores || result.manualScores[qi] === undefined || result.manualScores[qi] === null) && (!result.aiEssayFeedback || result.aiEssayFeedback[qi] === undefined || result.aiEssayFeedback[qi] === null)) {
                    workItems.push({
                        resultIdx,
                        result,
                        studentId: result.studentId || (`STUDENT_${resultIdx}`),
                        qi,
                        qText: q.text || '',
                        refAns: q.correct || '',
                        studentAns: answers[qi] || ''
                    });
                }
            });
        });

        if (workItems.length === 0) {
            alert('Semua soal esai untuk siswa dalam filter saat ini sudah pernah dikoreksi AI/Manual.');
            return;
        }

        const groupsMap = new Map();
        workItems.forEach(item => {
            const key = `${item.qText}|${item.refAns}`;
            if (!groupsMap.has(key)) groupsMap.set(key, []);
            groupsMap.get(key).push(item);
        });

        const totalTasks = workItems.length;
        if (!confirm(`Terdapat ${totalTasks} tugas koreksi esai dari ${poolResults.length} siswa.\n\nSistem akan menggunakan "Koreksi Cepat" (batch 5 jawaban sekaligus) agar lebih efisien dan hemat kuota.\n\nLanjutkan?`)) return;

        const overlay = document.createElement('div');
        overlay.className = 'fixed inset-0 bg-slate-900/80 flex items-center justify-center z-50 backdrop-blur-sm';
        overlay.innerHTML = `
            <div class="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full mx-4 text-center">
                <div class="w-16 h-16 bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                    <i class="fas fa-robot text-white text-2xl animate-bounce"></i>
                </div>
                <h3 class="text-lg font-black text-slate-800 mb-1">Koreksi Cepat AI</h3>
                <p id="batch-q-label" class="text-slate-500 text-sm mb-1">Menganalisis soal...</p>
                <p id="batch-s-label" class="text-violet-500 text-[10px] font-bold mb-4 uppercase tracking-wider"></p>
                <div class="w-full bg-slate-100 rounded-full h-3 mb-2">
                    <div id="batch-progress" class="h-3 bg-gradient-to-r from-violet-500 to-purple-500 rounded-full transition-all duration-300" style="width:0%"></div>
                </div>
                <p id="batch-counter" class="text-xs text-slate-400 font-semibold">0 / ${totalTasks} jawaban</p>
            </div>`;
        document.body.appendChild(overlay);

        const qLabel = document.getElementById('batch-q-label');
        const sLabel = document.getElementById('batch-s-label');
        const progressBar = document.getElementById('batch-progress');
        const counterEl = document.getElementById('batch-counter');

        let finishedCount = 0;
        let successTotal = 0;
        let errorTotal = 0;
        const affectedResultIndices = new Set();

        for (const key of Array.from(groupsMap.keys())) {
            const groupItems = groupsMap.get(key);
            const qText = groupItems[0].qText;
            const refAns = groupItems[0].refAns;

            if (qLabel) qLabel.textContent = `Mengoreksi: ${groupItems[0].result.mapel}`;
            if (sLabel) sLabel.textContent = `Soal: "${qText.substring(0, 30)}..."`;

            for (let i = 0; i < groupItems.length; i += 5) {
                const chunk = groupItems.slice(i, i + 5);
                const studentAnswers = chunk.map(item => item.studentAns);

                try {
                    const res = await fetch((typeof getApiBaseUrl === 'function' ? getApiBaseUrl() : window.location.origin) + '/api/ai-correct-essay-batch', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            questionText: qText,
                            referenceAnswer: refAns,
                            studentAnswers: studentAnswers,
                            teacherId: window.currentSiswa ? window.currentSiswa.id : null
                        })
                    });

                    const data = await res.json();
                    if (res.ok && data.ok && Array.isArray(data.results)) {
                        data.results.forEach((r, idx) => {
                            const item = chunk[idx];
                            if (!item) return;

                            if (!item.result.manualScores) item.result.manualScores = {};
                            if (!item.result.aiEssayFeedback) item.result.aiEssayFeedback = {};

                            item.result.manualScores[item.qi] = r.score;
                            item.result.aiEssayFeedback[item.qi] = r.feedback;
                            successTotal++;
                            finishedCount++;
                            affectedResultIndices.add(item.resultIdx);
                        });
                    } else {
                        errorTotal += chunk.length;
                        finishedCount += chunk.length;
                        chunk.forEach(item => affectedResultIndices.add(item.resultIdx));
                    }
                } catch (e) {
                    console.error('[AI-Correction] Batch Error:', e.message);
                    errorTotal += chunk.length;
                    finishedCount += chunk.length;
                    chunk.forEach(item => affectedResultIndices.add(item.resultIdx));
                }

                const pct = Math.round((finishedCount / totalTasks) * 100);
                if (progressBar) progressBar.style.width = pct + '%';
                if (counterEl) counterEl.textContent = `${finishedCount} / ${totalTasks} jawaban`;
            }
        }

        if (qLabel) qLabel.textContent = 'Menghitung ulang nilai akhir...';
        affectedResultIndices.forEach(idx => {
            const r = window.db?.results?.[idx];
            if (!r || !r.questions) return;

            let totalItems = 0, correctCount = 0;
            r.questions.forEach((q, i) => {
                const ans = r.answers ? r.answers[i] : null;
                const qType = q.type || 'single';
                if (qType === 'text') {
                    totalItems += 5;
                    correctCount += (r.manualScores?.[i] !== undefined && r.manualScores?.[i] !== null) ? r.manualScores[i] : 0;
                } else if (qType === 'tf' && Array.isArray(q.options)) {
                    const ansArr = Array.isArray(ans) ? ans : [];
                    q.options.forEach((_, j) => { totalItems++; if (ansArr[j] === (Array.isArray(q.correct) ? q.correct[j] : false)) correctCount++; });
                } else if (qType === 'multiple') {
                    const corr = Array.isArray(q.correct) ? q.correct : [];
                    const ansArr = Array.isArray(ans) ? ans : [];
                    totalItems += corr.length > 0 ? corr.length : 1;
                    correctCount += ansArr.filter(v => corr.includes(v)).length;
                } else if (qType === 'matching') {
                    const ansArr = Array.isArray(ans) ? ans : [];
                    const corrArr = Array.isArray(q.correct) ? q.correct : [];
                    if (Array.isArray(q.questions)) {
                        q.questions.forEach((_, qi2) => {
                            totalItems++;
                            const a = ansArr[qi2];
                            const c = corrArr[qi2];
                            if (a !== null && a !== undefined && c !== null && c !== undefined && String(a) === String(c)) correctCount++;
                        });
                    } else totalItems++;
                } else {
                    totalItems++;
                    if (ans === q.correct) correctCount++;
                }
            });
            r.score = totalItems > 0 ? ((correctCount / totalItems) * 100).toFixed(1) : '0.0';
            r.updatedAt = Date.now();
        });

        if (qLabel) qLabel.textContent = 'Menyimpan ke database...';
        try {
            if (adminSyncState.isAdminMode) {
                await adminSave();
                markAdminChanges();
            } else {
                if (typeof save === 'function') await save();
            }
        } catch (e) {
            console.error('[AI-Group] Final save error:', e.message);
        }

        overlay.remove();

        const adminDash = document.getElementById('admin-dashboard');
        const teacherDash = document.getElementById('teacher-dashboard');
        if (adminDash && !adminDash.classList.contains('hidden') && typeof renderAdminResults === 'function') renderAdminResults();
        else if (teacherDash && !teacherDash.classList.contains('hidden') && typeof renderTeacherResults === 'function') renderTeacherResults();

        const msg = errorTotal === 0
            ? `✅ Selesai! ${successTotal} jawaban esai berhasil dikoreksi.`
            : `⚠️ ${successTotal} berhasil, ${errorTotal} gagal dari total ${totalTasks} jawaban.`;
        alert(msg);
    }
    window.batchAiCorrectAllStudents = batchAiCorrectAllStudents;
}

if (typeof window.cleanCorruptedResults !== 'function') {
    function cleanCorruptedResults() {
        const corruptedResults = (window.db?.results || []).filter(r => {
            if (!r || r.deleted) return false;
            const hasUndefinedName = !r.studentName || String(r.studentName).trim() === 'undefined';
            const hasUndefinedRombel = !r.rombel || String(r.rombel).trim() === 'undefined';
            const hasUndefinedMapel = !r.mapel || String(r.mapel).trim() === 'undefined';
            const hasUndefinedId = !r.studentId || String(r.studentId).trim() === 'undefined';
            return hasUndefinedName || hasUndefinedRombel || hasUndefinedMapel || hasUndefinedId;
        });

        if (corruptedResults.length === 0) {
            alert('✅ Tidak ada hasil ujian yang corrupt. Semua data valid!');
            return;
        }

        if (!confirm(`⚠️ Akan menghapus ${corruptedResults.length} hasil ujian yang corrupt/undefined dari database.\n\nLanjutkan?`)) return;

        const now = Date.now();
        let cleanedCount = 0;
        window.db.results = (window.db?.results || []).map(r => {
            if (!r || r.deleted) return r;
            const hasUndefinedName = !r.studentName || String(r.studentName).trim() === 'undefined';
            const hasUndefinedRombel = !r.rombel || String(r.rombel).trim() === 'undefined';
            const hasUndefinedMapel = !r.mapel || String(r.mapel).trim() === 'undefined';
            const hasUndefinedId = !r.studentId || String(r.studentId).trim() === 'undefined';
            if (hasUndefinedName || hasUndefinedRombel || hasUndefinedMapel || hasUndefinedId) {
                cleanedCount++;
                return { ...r, deleted: true, updatedAt: now, cleanedReason: 'Corrupted: undefined fields' };
            }
            return r;
        });

        if (cleanedCount > 0) {
            if (typeof loadedCollections !== 'undefined') loadedCollections.results = true;
            if (adminSyncState.isAdminMode) {
                adminSave();
                markAdminChanges();
            } else {
                if (typeof save === 'function') save();
            }
            if (typeof updateCompletionCharts === 'function') updateCompletionCharts();
            if (typeof renderAdminResults === 'function') renderAdminResults();
            alert(`✅ SUKSES!\n\n${cleanedCount} hasil ujian corrupt telah dibersihkan dan disimpan ke server.`);
        }
    }
    window.cleanCorruptedResults = cleanCorruptedResults;
}

function renderScheduleChecklist() {
    const container = document.getElementById('schedule-checklist');
    if (!container) return;

    const schedules = db.schedules || [];
    const rombels = db.rombels || [];
    const subjects = db.subjects || [];

    if (subjects.length === 0) {
        container.innerHTML = `<div class="text-center py-8 text-slate-400"><i class="fas fa-book-open text-3xl mb-3 block"></i><p class="text-sm font-bold">Belum ada mata pelajaran terdaftar.</p></div>`;
        return;
    }
    if (rombels.length === 0) {
        container.innerHTML = `<div class="text-center py-8 text-slate-400"><i class="fas fa-users text-3xl mb-3 block"></i><p class="text-sm font-bold">Belum ada rombel terdaftar.</p></div>`;
        return;
    }

    const html = subjects.map((subject, sIdx) => {
        const subjectName = getSubjectName(subject);
        const subjRombels = rombels.map(rombel => {
            const key = `${rombel}|${subjectName}`;
            return { rombel, key, isChecked: schedules.includes(key) };
        });
        const checkedCount = subjRombels.filter(r => r.isChecked).length;
        const allChecked = checkedCount === rombels.length;
        const someChecked = checkedCount > 0 && !allChecked;

        const badgeColor = checkedCount > 0
            ? 'bg-purple-100 text-purple-700'
            : 'bg-slate-100 text-slate-400';

        const rombelItems = subjRombels.map(({ rombel, key, isChecked }) => `
            <label class="schedule-rombel-label flex items-center gap-3 px-4 py-2.5 rounded-xl cursor-pointer transition-all hover:bg-purple-50 ${isChecked ? 'bg-purple-50 border border-purple-100' : 'bg-slate-50 border border-transparent'}">
                <input type="checkbox"
                    class="schedule-checkbox w-4 h-4 rounded accent-purple-600"
                    data-key="${key}"
                    data-subject="${subjectName}"
                    ${isChecked ? 'checked' : ''}
                    onchange="onScheduleRombelChange(this)"
                />
                <div class="flex-1">
                    <span class="text-sm font-bold text-slate-700">${rombel}</span>
                </div>
                <span class="schedule-status-span text-[10px] font-bold ${isChecked ? 'text-purple-500' : 'text-slate-300'}">
                    ${isChecked ? '<i class="fas fa-check"></i> Aktif' : 'Nonaktif'}
                </span>
            </label>
        `).join('');

        return `
        <div class="schedule-subject-card border-2 rounded-2xl overflow-hidden transition-all ${checkedCount > 0 ? 'border-purple-200' : 'border-slate-100'}" data-subject-idx="${sIdx}">
            <button type="button"
                class="schedule-subject-toggle w-full flex items-center gap-3 p-4 text-left hover:bg-slate-50 transition-all"
                onclick="toggleScheduleSubjectCard(this)"
                aria-expanded="false">
                <div class="schedule-card-icon w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all ${checkedCount > 0 ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-500'}">
                    <i class="fas fa-book text-xs"></i>
                </div>
                <div class="flex-1 min-w-0">
                    <div class="font-black text-slate-800 leading-tight truncate">${subjectName}</div>
                    <div class="schedule-card-desc text-[11px] text-slate-400 mt-0.5">${checkedCount} dari ${rombels.length} rombel aktif</div>
                </div>
                <div class="flex items-center gap-2">
                    <span class="schedule-card-badge text-[10px] font-black px-2.5 py-1 rounded-full ${badgeColor}">
                        ${checkedCount}/${rombels.length}
                    </span>
                    <i class="fas fa-chevron-down text-slate-300 text-xs transition-transform duration-200 schedule-chevron"></i>
                </div>
            </button>
            <div class="schedule-subject-panel hidden px-4 pb-4">
                <label class="flex items-center gap-3 px-4 py-2.5 rounded-xl cursor-pointer bg-purple-600/10 border border-purple-200 mb-2 hover:bg-purple-600/20 transition-all">
                    <input type="checkbox"
                        class="schedule-select-all-cb w-4 h-4 rounded accent-purple-600"
                        data-subject="${subjectName}"
                        ${allChecked ? 'checked' : ''}
                        ${someChecked ? 'data-indeterminate="true"' : ''}
                        onchange="onScheduleSelectAll(this)"
                    />
                    <span class="text-sm font-black text-purple-700">Pilih Semua Rombel</span>
                </label>
                <div class="space-y-1.5">${rombelItems}</div>
            </div>
        </div>`;
    }).join('');

    container.innerHTML = html;
    container.querySelectorAll('.schedule-select-all-cb[data-indeterminate="true"]').forEach(cb => {
        cb.indeterminate = true;
    });
}

function toggleScheduleSubjectCard(btn) {
    const card = btn.closest('.schedule-subject-card');
    const panel = card.querySelector('.schedule-subject-panel');
    const chevron = btn.querySelector('.schedule-chevron');
    const expanded = btn.getAttribute('aria-expanded') === 'true';
    if (expanded) {
        panel.classList.add('hidden');
        chevron.style.transform = 'rotate(0deg)';
        btn.setAttribute('aria-expanded', 'false');
    } else {
        panel.classList.remove('hidden');
        chevron.style.transform = 'rotate(180deg)';
        btn.setAttribute('aria-expanded', 'true');
    }
}

function _updateScheduleCardHeader(card) {
    const panel = card.querySelector('.schedule-subject-panel');
    if (!panel) return;
    const rombelCbs = panel.querySelectorAll('.schedule-checkbox');
    const selectAllCb = panel.querySelector('.schedule-select-all-cb');
    const checkedCount = Array.from(rombelCbs).filter(c => c.checked).length;
    const total = rombelCbs.length;

    if (selectAllCb) {
        selectAllCb.checked = checkedCount === total;
        selectAllCb.indeterminate = checkedCount > 0 && checkedCount < total;
    }

    const badge = card.querySelector('.schedule-card-badge');
    if (badge) {
        badge.textContent = `${checkedCount}/${total}`;
        badge.className = `schedule-card-badge text-[10px] font-black px-2.5 py-1 rounded-full ${checkedCount > 0 ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-400'}`;
    }

    const desc = card.querySelector('.schedule-card-desc');
    if (desc) desc.textContent = `${checkedCount} dari ${total} rombel aktif`;

    const icon = card.querySelector('.schedule-card-icon');
    if (icon) {
        if (checkedCount > 0) {
            icon.classList.remove('bg-slate-100', 'text-slate-500');
            icon.classList.add('bg-purple-600', 'text-white');
        } else {
            icon.classList.remove('bg-purple-600', 'text-white');
            icon.classList.add('bg-slate-100', 'text-slate-500');
        }
    }

    if (checkedCount > 0) {
        card.classList.remove('border-slate-100');
        card.classList.add('border-purple-200');
    } else {
        card.classList.remove('border-purple-200');
        card.classList.add('border-slate-100');
    }
}

function onScheduleRombelChange(cb) {
    _updateRombelLabelStyle(cb);
    const card = cb.closest('.schedule-subject-card');
    if (card) _updateScheduleCardHeader(card);
}

function onScheduleSelectAll(selectAllCb) {
    const panel = selectAllCb.closest('.schedule-subject-panel');
    if (!panel) return;
    const card = panel.closest('.schedule-subject-card');
    const rombelCbs = panel.querySelectorAll('.schedule-checkbox');
    rombelCbs.forEach(cb => {
        cb.checked = selectAllCb.checked;
        _updateRombelLabelStyle(cb);
    });
    if (card) _updateScheduleCardHeader(card);
}

async function saveSchedules() {
    const checkboxes = document.querySelectorAll('.schedule-checkbox:checked');
    const newSchedules = Array.from(checkboxes).map(cb => cb.dataset.key);

    db.schedules = newSchedules;

    if (adminSyncState.isAdminMode) {
        await adminSave();
        markAdminChanges();
    } else {
        await save({ refreshBeforeSave: true });
    }

    closeModals();
    alert('Jadwal akses tersimpan!');
}

let adminStatsPollInterval = null;

function switchAdminBankSoalTab(tab) {
    const paketSection = document.getElementById('banksoal-paket-section');
    const detailSection = document.getElementById('banksoal-detail-section');
    const globalSection = document.getElementById('banksoal-global-section');
    const paketBtn = document.getElementById('banksoal-tab-paket');
    const detailBtn = document.getElementById('banksoal-tab-detail');
    const globalBtn = document.getElementById('banksoal-tab-global');

    if (!paketSection || !detailSection || !globalSection || !paketBtn || !detailBtn || !globalBtn) return;

    const hasDetail = !!currentDetailPackage;
    detailBtn.classList.toggle('hidden', !hasDetail);

    const activateButton = (button) => {
        button.classList.add('bg-sky-600', 'text-white');
        button.classList.remove('bg-slate-100', 'text-slate-700');
    };
    const deactivateButton = (button) => {
        button.classList.add('bg-slate-100', 'text-slate-700');
        button.classList.remove('bg-sky-600', 'text-white');
    };

    let activeTab = tab;
    if (activeTab === 'detail' && !hasDetail) {
        activeTab = 'paket';
    }

    if (activeTab === 'paket') {
        paketSection.classList.remove('hidden');
        detailSection.classList.add('hidden');
        globalSection.classList.add('hidden');
        activateButton(paketBtn);
        deactivateButton(detailBtn);
        deactivateButton(globalBtn);
        if (typeof renderAdminPaketSoal === 'function') renderAdminPaketSoal();
    } else if (activeTab === 'detail') {
        paketSection.classList.add('hidden');
        detailSection.classList.remove('hidden');
        globalSection.classList.add('hidden');
        deactivateButton(paketBtn);
        activateButton(detailBtn);
        deactivateButton(globalBtn);
        if (typeof renderAdminDetailPaket === 'function') renderAdminDetailPaket();
    } else {
        paketSection.classList.add('hidden');
        detailSection.classList.add('hidden');
        globalSection.classList.remove('hidden');
        deactivateButton(paketBtn);
        deactivateButton(detailBtn);
        activateButton(globalBtn);
        if (typeof renderAdminQuestions === 'function') renderAdminQuestions();
    }
}

window.switchAdminBankSoalTab = switchAdminBankSoalTab;

function renderAdminPaketSoal() {
    const tbody = document.getElementById('paket-soal-table-body');
    if (!tbody) return;

    const questions = Array.isArray(db.questions) ? db.questions : [];
    const paketMap = new Map();

    questions.forEach((question) => {
        const mapel = String(question.mapel || 'Unknown');
        const rombel = String(question.rombel || 'Unknown');
        const key = `${mapel}||${rombel}`;
        if (!paketMap.has(key)) {
            paketMap.set(key, {
                mapel,
                rombel,
                pg: 0,
                pgk: 0,
                bs: 0,
                u: 0,
                m: 0,
                total: 0,
                jenisUjian: question.jenisUjian || 'Umum'
            });
        }
        const row = paketMap.get(key);
        row.total += 1;
        if (question.type === 'single') row.pg += 1;
        else if (question.type === 'multiple') row.pgk += 1;
        else if (question.type === 'tf') row.bs += 1;
        else if (question.type === 'text') row.u += 1;
        else row.m += 1;
    });

    const rows = Array.from(paketMap.values()).sort((a, b) => {
        const aText = `${a.mapel} ${a.rombel}`.toLowerCase();
        const bText = `${b.mapel} ${b.rombel}`.toLowerCase();
        return aText.localeCompare(bText);
    });

    if (!rows.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="10" class="px-4 py-12 text-center text-slate-500 text-sm">Belum ada paket soal.</td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = rows.map((item) => `
        <tr class="hover:bg-slate-50 transition-colors">
            <td class="px-4 py-4 font-bold text-slate-700">${item.mapel}</td>
            <td class="px-4 py-4 text-slate-600">${item.rombel}</td>
            <td class="px-4 py-4 text-center">
                <span class="inline-flex px-2 py-1 rounded-full text-[10px] font-black bg-indigo-50 text-indigo-700">${item.jenisUjian}</span>
            </td>
            <td class="px-4 py-4 text-center text-slate-700">${item.pg}</td>
            <td class="px-4 py-4 text-center text-slate-700">${item.pgk}</td>
            <td class="px-4 py-4 text-center text-slate-700">${item.bs}</td>
            <td class="px-4 py-4 text-center text-slate-700">${item.u}</td>
            <td class="px-4 py-4 text-center text-slate-700">${item.m}</td>
            <td class="px-4 py-4 text-center font-black text-slate-800">${item.total}</td>
            <td class="px-4 py-4 text-center">
                <div class="flex items-center justify-center gap-2">
                    <button type="button" onclick="currentDetailPackage = { mapel: '${item.mapel}', rombel: '${item.rombel}' }; switchAdminBankSoalTab('detail');" class="p-2 text-sky-400 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-colors" title="Lihat Detail">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button type="button" onclick="deleteAdminPackageQuestions('${item.mapel}', '${item.rombel}')" class="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Hapus Paket">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

window.renderAdminPaketSoal = renderAdminPaketSoal;

function renderAdminDetailPaket() {
    const tbody = document.getElementById('detail-paket-table-body');
    const subtitle = document.getElementById('detail-paket-description');
    if (!tbody || !subtitle) return;

    if (!currentDetailPackage) {
        subtitle.textContent = 'Pilih sebuah paket soal untuk melihat daftar pertanyaan.';
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="px-4 py-12 text-center text-slate-500 text-sm">Belum ada paket yang dipilih.</td>
            </tr>
        `;
        return;
    }

    const { mapel, rombel } = currentDetailPackage;
    const filtered = (Array.isArray(db.questions) ? db.questions : []).filter(q => q.mapel === mapel && q.rombel === rombel);
    subtitle.textContent = `Mapel ${mapel} • Rombel ${rombel} • ${filtered.length} soal`;

    if (!filtered.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="px-4 py-12 text-center text-slate-500 text-sm">Paket soal ini belum memiliki pertanyaan.</td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = filtered.map((q, idx) => {
        const typeName = { single: 'Pilihan Ganda', multiple: 'PG Kompleks', text: 'Uraian', tf: 'Benar/Salah', matching: 'Menjodohkan' }[q.type || 'single'] || 'Pilihan Ganda';
        let corrText = '';
        if (q.type === 'multiple') {
            corrText = Array.isArray(q.correct) ? q.correct.map(x => ['A', 'B', 'C', 'D'][x] || x).join(',') : (q.correct ?? '-');
        } else if (q.type === 'text') {
            corrText = 'Teks';
        } else if (q.type === 'tf') {
            corrText = Array.isArray(q.options) ? q.options.map((stmt, i) => `${stmt} (${Array.isArray(q.correct) ? (q.correct[i] ? 'Benar' : 'Salah') : 'Benar/Salah'})`).join(' / ') : 'Benar/Salah';
        } else if (q.type === 'matching') {
            corrText = 'Match';
        } else {
            corrText = ['A', 'B', 'C', 'D'][q.correct] || q.correct || '-';
        }

        return `
            <tr class="hover:bg-slate-50 transition-colors">
                <td class="px-4 py-4 text-slate-700">${idx + 1}</td>
                <td class="px-4 py-4 text-slate-700 whitespace-pre-wrap break-words">${(q.text || '').substring(0, 220)}${(q.text || '').length > 220 ? '...' : ''}</td>
                <td class="px-4 py-4 text-center">
                    <span class="px-2 py-1 rounded-full text-[10px] font-bold bg-sky-50 text-sky-700">${typeName}</span>
                </td>
                <td class="px-4 py-4 text-slate-700 whitespace-pre-wrap break-words">${corrText}</td>
                <td class="px-4 py-4 text-slate-700">${typeName}</td>
                <td class="px-4 py-4 text-center">
                    <div class="flex items-center justify-center gap-1">
                        <button type="button" onclick="openEditQuestionModal(${db.questions.indexOf(q)})" class="p-2 text-sky-400 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-colors" title="Edit"><i class="fas fa-edit"></i></button>
                        <button type="button" onclick="deleteQuestion(${db.questions.indexOf(q)})" class="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Hapus"><i class="fas fa-trash"></i></button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

window.renderAdminDetailPaket = renderAdminDetailPaket;

async function renderAdminQuestions() {
    await ensureDataLoaded('questions');
    const tbody = document.getElementById('questions-table-body');
    if (!tbody) return;

    const rombelFilter = document.getElementById('filter-rombel')?.value || 'ALL';
    const mapelFilter = document.getElementById('filter-mapel')?.value || 'ALL';
    const searchTerm = (document.getElementById('search-questions')?.value || '').toLowerCase();

    let filtered = (Array.isArray(db.questions) ? db.questions : []).filter((q) => {
        const matchesRombel = rombelFilter === 'ALL' || q.rombel === rombelFilter;
        const matchesMapel = mapelFilter === 'ALL' || q.mapel === mapelFilter;
        const matchesSearch = !searchTerm || (String(q.text || '')).toLowerCase().includes(searchTerm);
        return matchesRombel && matchesMapel && matchesSearch;
    });

    if (!filtered.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="px-6 py-12 text-center">
                    <div class="flex flex-col items-center gap-3">
                        <i class="fas fa-inbox text-4xl text-slate-300"></i>
                        <p class="text-slate-500 text-sm">Tidak ada soal ditemukan</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = filtered.map((q, idx) => {
        const originalIndex = db.questions.indexOf(q);
        const typeName = { single: 'Pilihan Ganda', multiple: 'PG Kompleks', text: 'Uraian', tf: 'Benar/Salah', matching: 'Menjodohkan' }[q.type || 'single'] || 'Pilihan Ganda';
        let corrText = '';
        if (q.type === 'multiple') {
            corrText = Array.isArray(q.correct) ? q.correct.map(x => ['A', 'B', 'C', 'D'][x] || x).join(',') : (q.correct ?? '-');
        } else if (q.type === 'text') {
            corrText = 'Teks';
        } else if (q.type === 'tf') {
            corrText = Array.isArray(q.options) ? q.options.map((stmt, i) => `${stmt} (${Array.isArray(q.correct) ? (q.correct[i] ? 'Benar' : 'Salah') : 'Benar/Salah'})`).join(' / ') : 'Benar/Salah';
        } else if (q.type === 'matching') {
            corrText = 'Match';
        } else {
            corrText = ['A', 'B', 'C', 'D'][q.correct] || q.correct || '-';
        }

        return `
            <tr class="hover:bg-slate-50 transition-colors">
                <td class="px-6 py-4 text-center">
                    <span class="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded">${originalIndex + 1}</span>
                </td>
                <td class="px-6 py-4">
                    <div class="whitespace-pre-wrap break-words font-bold mb-1">${(q.text || '').substring(0, 220)}${(q.text || '').length > 220 ? '...' : ''}</div>
                </td>
                <td class="px-6 py-4">
                    <div class="flex flex-col gap-1 items-start">
                        <span class="px-3 py-1 bg-sky-100 text-sky-700 rounded-full text-[10px] font-bold">${q.mapel || '-'}</span>
                        <span class="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-[10px] font-bold">${q.rombel || '-'}</span>
                    </div>
                </td>
                <td class="px-6 py-4">
                    <span class="whitespace-pre-wrap break-words font-bold text-sky-700 text-sm inline-block w-full">${corrText}</span>
                </td>
                <td class="px-6 py-4">
                    <span class="inline-flex items-center justify-center px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-[10px] font-bold whitespace-normal">${typeName}</span>
                </td>
                <td class="px-6 py-4 text-center">
                    <div class="flex items-center justify-center gap-1">
                        <button type="button" onclick="openEditQuestionModal(${originalIndex})" class="p-2 text-sky-400 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-colors" title="Edit"><i class="fas fa-edit"></i></button>
                        <button type="button" onclick="deleteQuestion(${originalIndex})" class="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Hapus"><i class="fas fa-trash"></i></button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

window.renderAdminQuestions = renderAdminQuestions;

let selectedAdminQuestions = new Set();
window.selectedAdminQuestions = selectedAdminQuestions;

function toggleAdminQuestionSelection(event) {
    const idx = Number(event.target.dataset.index);
    if (Number.isNaN(idx)) return;
    const question = db.questions[idx];
    if (!question) return;

    if (event.target.checked) {
        selectedAdminQuestions.add(question);
    } else {
        selectedAdminQuestions.delete(question);
    }

    if (typeof renderAdminQuestions === 'function') renderAdminQuestions();
}

window.toggleAdminQuestionSelection = toggleAdminQuestionSelection;

function toggleAdminSelectAll(event) {
    const checked = !!event.target.checked;
    const fR = document.getElementById('filter-rombel')?.value || 'ALL';
    const fM = document.getElementById('filter-mapel')?.value || 'ALL';

    const filtered = (Array.isArray(db.questions) ? db.questions : []).filter(q =>
        (fR === 'ALL' || q.rombel === fR) && (fM === 'ALL' || q.mapel === fM)
    );

    filtered.forEach(q => {
        if (checked) selectedAdminQuestions.add(q);
        else selectedAdminQuestions.delete(q);
    });

    if (typeof renderAdminQuestions === 'function') renderAdminQuestions();
}

window.toggleAdminSelectAll = toggleAdminSelectAll;

function deleteSelectedAdminQuestions() {
    if (selectedAdminQuestions.size === 0) {
        alert('Pilih soal yang ingin dihapus terlebih dahulu.');
        return;
    }

    if (!confirm(`Hapus ${selectedAdminQuestions.size} soal terpilih?`)) return;

    loadedCollections.questions = true;
    db.questions = db.questions.filter(q => !selectedAdminQuestions.has(q));
    selectedAdminQuestions.clear();
    if (adminSyncState.isAdminMode) {
        adminSave();
        markAdminChanges();
    } else {
        save();
    }
    if (typeof renderAdminQuestions === 'function') renderAdminQuestions();
    if (typeof updateStats === 'function') updateStats();
}

window.deleteSelectedAdminQuestions = deleteSelectedAdminQuestions;

function deleteFilteredQuestions() {
    const fR = document.getElementById('filter-rombel')?.value || 'ALL';
    const fM = document.getElementById('filter-mapel')?.value || 'ALL';

    const toDelete = (Array.isArray(db.questions) ? db.questions : []).filter(q =>
        (fR === 'ALL' || q.rombel === fR) && (fM === 'ALL' || q.mapel === fM)
    );

    if (toDelete.length === 0) {
        alert('Tidak ada soal yang sesuai dengan filter saat ini.');
        return;
    }

    const rombelLabel = fR === 'ALL' ? 'Semua Rombel' : fR;
    const mapelLabel = fM === 'ALL' ? 'Semua Mapel' : fM;
    const msg = `Anda akan menghapus ${toDelete.length} soal dengan filter:\n\n• Rombel: ${rombelLabel}\n• Mapel: ${mapelLabel}\n\nTindakan ini tidak dapat dibatalkan. Lanjutkan?`;

    if (!confirm(msg)) return;

    if (fR === 'ALL' && fM === 'ALL') {
        if (!confirm(`PERINGATAN: Anda akan menghapus SEMUA ${toDelete.length} soal dari database!\n\nApakah Anda benar-benar yakin?`)) return;
    }

    loadedCollections.questions = true;
    db.questions = db.questions.filter(q =>
        !((fR === 'ALL' || q.rombel === fR) && (fM === 'ALL' || q.mapel === fM))
    );

    selectedAdminQuestions.clear();
    if (adminSyncState.isAdminMode) {
        adminSave();
        markAdminChanges();
    } else {
        save();
    }
    if (typeof renderAdminQuestions === 'function') renderAdminQuestions();
    if (typeof updateStats === 'function') updateStats();
    alert(`${toDelete.length} soal berhasil dihapus.`);
}

window.deleteFilteredQuestions = deleteFilteredQuestions;

let editStudentId = null;

function openStudentModal() {
    editStudentId = null;
    const nameEl = document.getElementById('st-name');
    const idEl = document.getElementById('st-id');
    const passEl = document.getElementById('st-password');
    const extraEl = document.getElementById('st-extra-fields');
    const titleEl = document.getElementById('student-modal-title');
    const btnEl = document.getElementById('student-save-btn');

    if (nameEl) nameEl.value = '';
    if (idEl) idEl.value = '';
    if (passEl) passEl.value = '';
    if (extraEl) extraEl.classList.add('hidden');
    if (titleEl) titleEl.textContent = 'Siswa Baru';
    if (btnEl) btnEl.textContent = 'DAFTAR';

    if (typeof populateSelects === 'function') populateSelects(['st-rombel']);
    const modal = document.getElementById('student-modal');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
}
window.openStudentModal = openStudentModal;

function editStudent(id) {
    const students = Array.isArray(window.db?.students) ? db.students : [];
    const s = students.find(x => String(x.id) === String(id));
    if (!s) return alert('Siswa tidak ditemukan');

    editStudentId = id;
    const nameEl = document.getElementById('st-name');
    const idEl = document.getElementById('st-id');
    const passEl = document.getElementById('st-password');
    const extraEl = document.getElementById('st-extra-fields');
    const titleEl = document.getElementById('student-modal-title');
    const btnEl = document.getElementById('student-save-btn');

    if (nameEl) nameEl.value = s.name || '';
    if (idEl) idEl.value = s.id || '';
    if (passEl) passEl.value = s.password || '';
    if (extraEl) extraEl.classList.remove('hidden');
    if (titleEl) titleEl.textContent = 'Edit Siswa';
    if (btnEl) btnEl.textContent = 'PERBARUI';

    if (typeof populateSelects === 'function') populateSelects(['st-rombel']);
    const rombelSelect = document.getElementById('st-rombel');
    if (rombelSelect) rombelSelect.value = s.rombel || '';

    const modal = document.getElementById('student-modal');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
}
window.editStudent = editStudent;

function saveStudent() {
    const nameInput = document.getElementById('st-name');
    const rombelSelect = document.getElementById('st-rombel');
    const name = nameInput ? nameInput.value.trim() : '';
    const rombel = rombelSelect ? rombelSelect.value : '';
    if (!name) return alert('Nama harus diisi');

    if (editStudentId) {
        const student = (window.db?.students || []).find(x => String(x.id) === String(editStudentId));
        if (student) {
            const newId = document.getElementById('st-id')?.value.trim() || '';
            const newPassword = document.getElementById('st-password')?.value.trim() || '';

            if (newId && newId !== student.id) {
                (window.db?.results || []).forEach(r => {
                    if (String(r.studentId) === String(student.id)) r.studentId = newId;
                });
                student.id = newId;
            }

            student.name = name;
            student.rombel = rombel;
            if (newPassword) student.password = newPassword;
            if (typeof showToast === 'function') showToast('Data siswa diperbarui', 'success');
        }
    } else {
        const id = 'DRKS-' + Math.floor(1000 + Math.random() * 9000);
        (window.db?.students || []).push({ id, password: 'escrido', name, rombel, role: 'student' });
        if (typeof showToast === 'function') showToast('Siswa berhasil didaftarkan', 'success');
    }

    if (typeof updateCompletionCharts === 'function') updateCompletionCharts();

    if (typeof adminSyncState !== 'undefined' && adminSyncState.isAdminMode) {
        if (typeof adminSave === 'function') adminSave();
        if (typeof markAdminChanges === 'function') markAdminChanges();
    } else if (typeof save === 'function') {
        save();
    }

    if (typeof renderAdminStudents === 'function') renderAdminStudents();
    if (typeof closeModals === 'function') closeModals();
}
window.saveStudent = saveStudent;

async function deleteStudent(id) {
    if (!confirm('Hapus siswa ini?')) return;
    const students = Array.isArray(window.db?.students) ? db.students : [];
    window.db.students = students.filter(x => String(x.id) !== String(id));
    if (typeof updateCompletionCharts === 'function') updateCompletionCharts();

    if (typeof adminSyncState !== 'undefined' && adminSyncState.isAdminMode) {
        if (typeof adminSave === 'function') await adminSave();
        if (typeof markAdminChanges === 'function') markAdminChanges();
    } else if (typeof save === 'function') {
        await save();
    }

    if (typeof renderAdminStudents === 'function') renderAdminStudents();
}
window.deleteStudent = deleteStudent;

async function resetStudentResults(studentId) {
    if (!confirm('Reset hasil ujian untuk siswa ini?')) return;

    let any = false;
    window.db.results = (window.db?.results || []).map(r => {
        if (String(r.studentId) === String(studentId) && !r.deleted) {
            any = true;
            return { ...r, deleted: true, updatedAt: Date.now() };
        }
        return r;
    });

    if (!any) {
        alert('Tidak ada hasil ujian aktif untuk siswa ini.');
        return;
    }

    if (typeof loadedCollections !== 'undefined') loadedCollections.results = true;

    if (typeof adminSyncState !== 'undefined' && adminSyncState.isAdminMode) {
        if (typeof adminSave === 'function') await adminSave();
        if (typeof markAdminChanges === 'function') markAdminChanges();
    } else if (typeof save === 'function') {
        await save();
    }

    if (typeof updateCompletionCharts === 'function') updateCompletionCharts();
    if (typeof updateStats === 'function') updateStats();
    if (typeof renderAdminResults === 'function') renderAdminResults();
    if (typeof renderAdminStudents === 'function') renderAdminStudents();
    alert('Reset hasil ujian siswa berhasil.');
}
window.resetStudentResults = resetStudentResults;

if (typeof window.openStudentModal !== 'function') {
    window.openStudentModal = openStudentModal;
}

if (typeof window.editStudent !== 'function') {
    window.editStudent = editStudent;
}

if (typeof window.saveStudent !== 'function') {
    window.saveStudent = saveStudent;
}

if (typeof window.deleteStudent !== 'function') {
    window.deleteStudent = deleteStudent;
}

if (typeof window.resetStudentResults !== 'function') {
    window.resetStudentResults = resetStudentResults;
}

function renderAdminStudents() {
    const tbody = document.getElementById('students-table-body');
    const filterSelect = document.getElementById('students-filter-rombel');
    const selectedRombel = filterSelect ? filterSelect.value : '';

    if (filterSelect) {
        const current = filterSelect.value;
        const rombels = Array.isArray(window.db?.rombels) ? window.db.rombels : [];
        filterSelect.innerHTML = '<option value="">Semua</option>' + rombels.map(r => `<option value="${r}"${r === current ? ' selected' : ''}>${r}</option>`).join('');
        if (!current || !rombels.includes(current)) {
            filterSelect.value = '';
        }
    }

    let list = (Array.isArray(window.db?.students) ? db.students : []).filter(x => String(x.role || '') !== 'admin');

    if (selectedRombel) {
        list = list.filter(s => String(s.rombel || '') === String(selectedRombel));
    }

    list.sort((a, b) => {
        const aName = String(a.name || '');
        const bName = String(b.name || '');
        if (String(a.rombel || '') === String(b.rombel || '')) return aName.localeCompare(bName);
        return String(a.rombel || '').localeCompare(String(b.rombel || ''));
    });

    if (!tbody) return;

    if (!list.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4" class="px-6 py-12 text-center text-slate-500 text-sm">
                    <div class="flex flex-col items-center gap-3">
                        <i class="fas fa-user-slash text-3xl text-slate-300"></i>
                        <span>Belum ada siswa yang terdaftar.</span>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = list.map(s => `
        <tr>
            <td class="px-6 py-4 font-bold text-slate-700">${s.name || '-'}</td>
            <td class="px-6 py-4 text-xs font-semibold text-slate-500">${s.rombel || '-'}</td>
            <td class="px-6 py-4">
                <span class="bg-slate-50 border border-slate-100 px-2 py-1 rounded font-bold text-sky-600 text-[10px] tracking-widest">
                    ${s.id || '-'} / ${s.password || '-'}
                </span>
            </td>
            <td class="px-6 py-4 text-center">
                <div class="flex items-center justify-center gap-1">
                    <button onclick="editStudent('${String(s.id || '').replace(/'/g, "\\'")}')" class="w-8 h-8 rounded-lg bg-sky-50 text-sky-500 hover:bg-sky-100 transition-all flex items-center justify-center" title="Edit Data"><i class="fas fa-edit text-xs"></i></button>
                    <button onclick="resetStudentResults('${String(s.id || '').replace(/'/g, "\\'")}')" class="w-8 h-8 rounded-lg bg-amber-50 text-amber-500 hover:bg-amber-100 transition-all flex items-center justify-center" title="Reset Hasil Ujian"><i class="fas fa-sync-alt text-xs"></i></button>
                    <button onclick="deleteStudent('${String(s.id || '').replace(/'/g, "\\'")}')" class="w-8 h-8 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-all flex items-center justify-center" title="Hapus"><i class="fas fa-trash text-xs"></i></button>
                </div>
            </td>
        </tr>
    `).join('');
}

window.renderAdminStudents = renderAdminStudents;



/* ==================== FILE: js/modules/quizz.js ==================== */
/**
 * js/modules/quizz.js
 * Part of CBT application refactored module
 */

async function renderApiKeysList() {
    const container = document.getElementById('api-keys-list');
    if (!container) return;

    try {
        const response = await fetch(getApiBaseUrl() + '/api/admin/global-api-keys');

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();

        if (result.ok && Array.isArray(result.globalKeys)) {
            const keys = result.globalKeys;
            window.globalApiKeysActive = result.activeCount || 0;
            window.globalApiKeysExhausted = result.exhaustedCount || 0;
            updateStats(); // Update stats with new API keys data

            // Helper function to detect provider from API key
            function detectProviderFromKey(key) {
                if (!key) return 'Unknown';
                if (key.startsWith('AIzaSy')) return 'Google Gemini';
                if (key.startsWith('sk-')) return 'OpenAI (ChatGPT)';
                if (key.startsWith('sk-or-v1-') || key.startsWith('sk-or-')) return 'OpenRouter';
                if (key.startsWith('gsk_')) return 'Groq';
                if (key.includes('deepseek')) return 'DeepSeek';
                return 'Unknown';
            }

            container.innerHTML = keys.length === 0 ?
                '<p class="text-xs text-slate-500">Belum ada API Key global</p>' :
                keys.map((key, index) => {
                    const fullKey = key.key || '';
                    const displayKey = fullKey.length > 20 ? fullKey.substring(0, 20) + '...' : fullKey;

                    // Use detected provider from key format, fallback to stored provider
                    const detectedProvider = detectProviderFromKey(fullKey);
                    const displayProvider = detectedProvider !== 'Unknown' ? detectedProvider : (key.provider || 'Unknown');

                    const source = key.addedAt || 'Global Settings';
                    const isExternal = key.source === 'teacher' || key.source === 'env';

                    // Prepare identifiers for deletion
                    const deleteArgs = JSON.stringify({
                        id: key.id,
                        source: key.source,
                        index: key.index,
                        key: fullKey
                    }).replace(/"/g, '&quot;');

                    return `
                                <div class="flex items-center justify-between bg-slate-50 p-3 rounded-2xl border border-slate-100 mb-2">
                                    <div class="flex-1">
                                        <div class="flex items-center gap-2 mb-1">
                                            <span class="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-slate-200 text-slate-600">${displayProvider}</span>
                                            <span class="text-[10px] font-bold px-2 py-0.5 rounded ${key.source === 'teacher' ? 'bg-amber-100 text-amber-700' : (key.source === 'env' ? 'bg-purple-100 text-purple-700' : 'bg-sky-100 text-sky-700')}">${source}</span>
                                        </div>
                                        <div class="flex items-center gap-2">
                                            <span class="text-xs font-mono text-slate-700">${displayKey}</span>
                                            ${key.status === 'exhausted' ? '<span class="text-[10px] font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded border border-red-100">KUOTA HABIS</span>' : '<span class="text-[10px] font-bold text-emerald-500 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">AKTIF</span>'}
                                        </div>
                                    </div>
                                    ${!isExternal ? `
                                    <button onclick="removeGlobalApiKey(${deleteArgs})" class="w-8 h-8 flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all">
                                        <i class="fas fa-trash"></i>
                                    </button>
                                    ` : `
                                    <div class="w-8 h-8 flex items-center justify-center text-slate-300 cursor-not-allowed" title="Key ini dikelola di sumber aslinya (Guru/Env)">
                                        <i class="fas fa-lock text-xs"></i>
                                    </div>
                                    `}
                                </div>
                            `;
                }).join('');
        } else {
            container.innerHTML = `<p class="text-xs text-red-500">Error: ${result.error || 'Response tidak valid'}</p>`;
        }
    } catch (err) {
        console.error('Error loading API keys:', err);
        container.innerHTML = `<p class="text-xs text-red-500">Gagal memuat API Keys: ${err.message}</p>`;
    }
}

window.removeGlobalApiKey = async function (ident) {
    if (!confirm('Apakah Anda yakin ingin menghapus Global API Key ini?')) return;

    let body = {};
    if (typeof ident === 'object') {
        if (ident.source === 'supabase') body.keyId = ident.id;
        else if (ident.source === 'mysql') body.keyIndex = ident.index;
        else body.keyValue = ident.key; // Fallback
    } else {
        body.keyIndex = ident; // Legacy support
    }

    try {
        const response = await fetch(getApiBaseUrl() + '/api/admin/remove-global-key', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        const result = await response.json();

        if (result.ok) {
            showToast('Global API Key berhasil dihapus', 'success');
            renderApiKeysList(); // Refresh list for admin overview
            updateStats(); // Update stats
        } else {
            showToast(result.error || 'Gagal menghapus key', 'error');
        }
    } catch (err) {
        showToast('Error: ' + err.message, 'error');
    }
};

// ─── Detailed API Keys Modal Logic ───────────────────
window.openApiKeysDetailModal = async function () {
    const modal = document.getElementById('api-keys-detail-modal');
    if (modal) modal.classList.remove('hidden');
    if (modal) modal.classList.add('flex');

    // Show loading in table body
    const tbody = document.getElementById('api-keys-detail-table-body');
    if (tbody) tbody.innerHTML = `<tr><td colspan="6" class="px-6 py-8 text-center text-slate-400 font-bold"><i class="fas fa-spinner fa-spin mr-2"></i> Mengambil data API Keys...</td></tr>`;

    try {
        const response = await fetch(getApiBaseUrl() + '/api/admin/global-api-keys');
        if (!response.ok) throw new Error('Refresh gagal');
        const result = await response.json();

        if (result.ok && Array.isArray(result.globalKeys)) {
            renderApiKeysDetailTable(result.globalKeys);
        } else {
            if (tbody) tbody.innerHTML = `<tr><td colspan="6" class="px-6 py-8 text-center text-red-500 font-bold">Gagal memuat data API Keys</td></tr>`;
        }
    } catch (err) {
        if (tbody) tbody.innerHTML = `<tr><td colspan="6" class="px-6 py-8 text-center text-red-500 font-bold">Error: ${err.message}</td></tr>`;
    }
};

window.closeApiKeysDetailModal = function () {
    const modal = document.getElementById('api-keys-detail-modal');
    if (modal) modal.classList.add('hidden');
    if (modal) modal.classList.remove('flex');
};

function renderApiKeysDetailTable(keys) {
    const tbody = document.getElementById('api-keys-detail-table-body');
    if (!tbody) return;

    if (keys.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="px-6 py-8 text-center text-slate-400 font-bold">Belum ada API Key global terdaftar.</td></tr>`;
        return;
    }

    function detectProviderFromKey(key) {
        if (!key) return 'Unknown';
        if (key.startsWith('AIzaSy')) return 'Google Gemini';
        if (key.startsWith('sk-')) return 'OpenAI (ChatGPT)';
        if (key.startsWith('sk-or-v1-') || key.startsWith('sk-or-')) return 'OpenRouter';
        if (key.startsWith('gsk_')) return 'Groq';
        if (key.includes('deepseek')) return 'DeepSeek';
        return 'Unknown';
    }

    tbody.innerHTML = keys.map((k, i) => {
        const fullKey = k.key || '';
        const provider = detectProviderFromKey(fullKey);
        const source = k.addedAt || 'Global Settings';
        const isExhausted = k.status === 'exhausted';
        const lastUpdated = k.updatedAt ? new Date(k.updatedAt).toLocaleString('id-ID') : '-';
        const isExternal = k.source === 'teacher' || k.source === 'env';

        const deleteArgs = JSON.stringify({
            id: k.id,
            source: k.source,
            index: k.index,
            key: fullKey
        }).replace(/"/g, '&quot;');

        return `
                    <tr class="hover:bg-slate-50 transition-colors">
                        <td class="px-6 py-4 text-center font-bold text-slate-400">${i + 1}</td>
                        <td class="px-6 py-4">
                            <span class="text-[10px] font-black uppercase px-2 py-1 rounded bg-slate-200 text-slate-600">${provider}</span>
                        </td>
                        <td class="px-6 py-4">
                            <div class="flex items-center gap-2">
                                <code class="text-xs font-mono bg-white border border-slate-100 px-2 py-1 rounded-lg text-slate-700">${fullKey.substring(0, 8)}••••••••${fullKey.substring(fullKey.length - 4)}</code>
                                <button onclick="copyApiKey('${fullKey}')" class="text-slate-400 hover:text-sky-600 transition-all" title="Salin Key">
                                    <i class="fas fa-copy text-xs"></i>
                                </button>
                            </div>
                        </td>
                        <td class="px-6 py-4">
                            ${isExhausted ?
                '<span class="text-[9px] font-black bg-red-100 text-red-600 px-2.5 py-1 rounded-full flex items-center gap-1 w-fit"><i class="fas fa-times-circle"></i> KUOTA HABIS</span>' :
                '<span class="text-[9px] font-black bg-emerald-100 text-emerald-600 px-2.5 py-1 rounded-full flex items-center gap-1 w-fit"><i class="fas fa-check-circle"></i> AKTIF</span>'
            }
                        </td>
                        <td class="px-6 py-4">
                            <span class="text-[10px] font-bold text-slate-500">${source}</span>
                            ${k.note ? `<p class="text-[10px] text-slate-400 mt-0.5 italic">${k.note}</p>` : ''}
                        </td>
                        <td class="px-6 py-4 text-center">
                            ${!isExternal ? `
                            <button onclick="removeGlobalApiKey(${deleteArgs})" class="w-8 h-8 flex items-center justify-center text-red-300 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all" title="Hapus Key">
                                <i class="fas fa-trash-alt text-xs"></i>
                            </button>
                            ` : `
                            <div class="w-8 h-8 flex items-center justify-center text-slate-300 cursor-not-allowed" title="Key ini dikelola di sumber aslinya">
                                <i class="fas fa-lock text-xs"></i>
                            </div>
                            `}
                        </td>
                    </tr>
                `;
    }).join('');
}

window.copyApiKey = function (key) {
    navigator.clipboard.writeText(key).then(() => {
        showToast('API Key disalin ke clipboard!', 'success');
    }).catch(err => {
        console.error('Clipboard error:', err);
        showToast('Gagal menyalin key', 'error');
    });
};

// --- END API KEY MANAGEMENT FUNCTIONS ---

// --- QUIZZ MANAGEMENT FUNCTIONS ---

async function openQuizzAiModal() {
    const modal = document.getElementById('quizz-ai-modal');
    if (!modal) {
        console.warn('[Quizz] quizz-ai-modal not found.');
        return;
    }

    let mapelOpts = '<option value="">--Pilih Mapel--</option>';
    if (db.subjects) {
        db.subjects.forEach(m => {
            const mName = typeof m === 'string' ? m : m.name;
            mapelOpts += `<option value="${mName}">${mName}</option>`;
        });
    }
    let rombelOpts = '<option value="">--Pilih Rombel--</option>';
    if (db.rombels) {
        db.rombels.forEach(r => rombelOpts += `<option value="${r}">${r}</option>`);
    }

    const mapelSelect = document.getElementById('quizz-ai-mapel');
    const rombelSelect = document.getElementById('quizz-ai-rombel');

    const isTeacher = currentSiswa && currentSiswa.role === 'teacher';
    if (isTeacher) {
        const teacher = currentSiswa;
        const subjects = teacherSubjectNames(teacher);
        mapelOpts = '<option value="">--Pilih Mapel--</option>' + subjects.map(n => `<option value="${n}">${n}</option>`).join('');

        const updateRombels = (chosenMapel) => {
            let rombelsToUse;
            if (chosenMapel) {
                rombelsToUse = teacherAllowedRombels(teacher, chosenMapel);
            } else {
                rombelsToUse = teacherCombinedRombels(teacher);
            }
            if (rombelSelect) {
                rombelSelect.innerHTML = '<option value="">--Pilih Rombel--</option>' + rombelsToUse.map(r => `<option value="${r}">${r}</option>`).join('');
            }
        };

        if (mapelSelect) {
            mapelSelect.innerHTML = mapelOpts;
            mapelSelect.onchange = () => updateRombels(mapelSelect.value);
        }
        if (rombelSelect) {
            updateRombels(mapelSelect ? mapelSelect.value : '');
        }
    } else {
        if (mapelSelect) mapelSelect.innerHTML = mapelOpts;
        if (rombelSelect) rombelSelect.innerHTML = rombelOpts;
    }

    const topicInput = document.getElementById('quizz-ai-topic');
    const countInput = document.getElementById('quizz-ai-count');
    const errorEl = document.getElementById('quizz-ai-modal-error');

    if (topicInput) topicInput.value = '';
    if (countInput) countInput.value = '5';
    if (errorEl) errorEl.classList.add('hidden');

    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function adjustQuizzAiCount(delta) {
    const input = document.getElementById('quizz-ai-count');
    let val = parseInt(input.value) || 5;
    val += delta;
    if (val < 1) val = 1;
    if (val > 30) val = 30;
    input.value = val;
}

async function generateQuizzWithAi() {
    const topic = document.getElementById('quizz-ai-topic').value;
    const count = parseInt(document.getElementById('quizz-ai-count').value) || 5;
    const mapel = document.getElementById('quizz-ai-mapel').value;
    const rombel = document.getElementById('quizz-ai-rombel').value;
    const errorEl = document.getElementById('quizz-ai-modal-error');

    if (!topic || !mapel || !rombel) {
        errorEl.innerText = "Topik, Mapel, dan Rombel wajib diisi!";
        errorEl.classList.remove('hidden');
        return;
    }
    errorEl.classList.add('hidden');

    closeModals();

    Swal.fire({
        title: 'Membuat Quizz...',
        html: '<div class="text-sm text-slate-500">AI sedang menyusun pertanyaan interaktif, harap tunggu.</div>',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
    });

    try {
        let teacherId = null;
        if (typeof currentSiswa !== 'undefined' && currentSiswa && currentSiswa.role === 'guru') {
            teacherId = currentSiswa.id;
        }
        const response = await fetch(getApiBaseUrl() + '/api/generate-quizz-ai', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                topic: topic,
                count: count,
                teacherId: teacherId
            })
        });

        const data = await response.json();
        if (data.ok && data.questions) {
            if (!db.quizzes) db.quizzes = [];
            const questions = data.questions.map(q => ({
                mapel: mapel,
                rombel: rombel,
                ...q
            }));
            db.quizzes.push(...questions);
            await save();
            renderAdminQuizz();
            if (typeof renderTeacherQuizz === 'function') renderTeacherQuizz();
            Swal.fire('Berhasil!', `${questions.length} soal quizz telah ditambahkan.`, 'success');
        } else {
            throw new Error(data.error || 'Gagal generate AI');
        }
    } catch (e) {
        Swal.fire('Error', e.message, 'error');
    }
}

// === Quizz Image Helpers ===
async function previewQuizzImages(event) {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;

    if (!window.storedQuizzImages) window.storedQuizzImages = [];

    showToast('Memproses gambar...', 'info');

    for (const file of files) {
        try {
            const base64 = await new Promise(resolve => {
                const reader = new FileReader();
                reader.onload = e => resolve(e.target.result);
                reader.readAsDataURL(file);
            });

            if (file.type.startsWith('image/')) {
                const compressed = await compressImage(base64);
                const cloudUrl = await uploadImageToServer(compressed, file.name);
                window.storedQuizzImages.push(cloudUrl);
            } else {
                window.storedQuizzImages.push(base64);
            }
        } catch (err) {
            console.error('Failed to upload image:', file.name, err);
            showToast('Gagal upload ' + file.name + ': ' + err.message, 'error');
        }
    }
    showToast('Proses upload selesai', 'success');
    renderQuizzImagePreviews();
}

async function addQuizzImageUrl() {
    const urlInput = document.getElementById('quizz-image-url');
    const url = urlInput.value.trim();
    if (!url) return;

    if (!window.storedQuizzImages) window.storedQuizzImages = [];

    if (url.startsWith('data:image')) {
        showToast('Mengunggah data gambar...', 'info');
        try {
            const compressed = await compressImage(url);
            const cloudUrl = await uploadImageToServer(compressed, 'pasted-image.jpg');
            window.storedQuizzImages.push(cloudUrl);
            showToast('Gambar berhasil diunggah ke cloud', 'success');
        } catch (err) {
            showToast('Gagal upload ke cloud: ' + err.message, 'error');
            window.storedQuizzImages.push(url);
        }
    } else {
        window.storedQuizzImages.push(url);
    }

    urlInput.value = '';
    renderQuizzImagePreviews();
}

function removeQuizzImage(index) {
    if (window.storedQuizzImages && window.storedQuizzImages.length > index) {
        window.storedQuizzImages.splice(index, 1);
        renderQuizzImagePreviews();
    }
}

function renderQuizzImagePreviews() {
    const previewContainer = document.getElementById('quizz-images-preview');
    previewContainer.innerHTML = '';

    if (!window.storedQuizzImages) return;

    window.storedQuizzImages.forEach((url, idx) => {
        const wrp = document.createElement('div');
        wrp.className = 'relative inline-block';
        wrp.innerHTML = `
            <img src="${normalizeImgSrc(url)}" class="h-16 w-16 object-cover rounded shadow-sm border border-slate-200 cursor-pointer" onclick="openImageZoom('${normalizeImgSrc(url)}', ${idx}, window.storedQuizzImages)">
            <button onclick="removeQuizzImage(${idx})" class="absolute -top-2 -right-2 bg-red-500 text-white w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center hover:bg-red-600 shadow">&times;</button>
        `;
        previewContainer.appendChild(wrp);
    });
}
// === End Quizz Image Helpers ===

async function openQuizzModal(idx = null) {
    const modal = document.getElementById('quizz-modal');
    if (!modal) {
        console.warn('[Quizz] quizz-modal not found.');
        return;
    }

    let mapelOpts = '<option value="">--Pilih Mapel--</option>';
    if (db.subjects) {
        db.subjects.forEach(m => {
            const mName = typeof m === 'string' ? m : m.name;
            mapelOpts += `<option value="${mName}">${mName}</option>`;
        });
    }
    let rombelOpts = '<option value="">--Pilih Rombel--</option>';
    if (db.rombels) {
        db.rombels.forEach(r => rombelOpts += `<option value="${r}">${r}</option>`);
    }

    const mapelSelect = document.getElementById('quizz-mapel');
    const rombelSelect = document.getElementById('quizz-rombel');

    // Filter for teacher mode
    const isTeacher = currentSiswa && currentSiswa.role === 'teacher';
    if (isTeacher) {
        const teacher = currentSiswa;
        const subjects = teacherSubjectNames(teacher);
        mapelOpts = '<option value="">--Pilih Mapel--</option>' + subjects.map(n => `<option value="${n}">${n}</option>`).join('');

        const updateRombels = (chosenMapel) => {
            let rombelsToUse;
            if (chosenMapel) {
                rombelsToUse = teacherAllowedRombels(teacher, chosenMapel);
            } else {
                rombelsToUse = teacherCombinedRombels(teacher);
            }
            if (rombelSelect) {
                rombelSelect.innerHTML = '<option value="">--Pilih Rombel--</option>' + rombelsToUse.map(r => `<option value="${r}">${r}</option>`).join('');
            }
        };

        if (mapelSelect) {
            mapelSelect.innerHTML = mapelOpts;
            mapelSelect.onchange = () => updateRombels(mapelSelect.value);
        }
        if (rombelSelect) {
            updateRombels(mapelSelect ? mapelSelect.value : '');
        }
    } else {
        if (mapelSelect) mapelSelect.innerHTML = mapelOpts;
        if (rombelSelect) rombelSelect.innerHTML = rombelOpts;
    }

    const errorEl = document.getElementById('quizz-modal-error');
    if (errorEl) errorEl.classList.add('hidden');
    window.storedQuizzImages = [];

    setTimeout(() => initQuillEditors(), 50);

    if (idx !== null && db.quizzes && db.quizzes[idx]) {
        const q = db.quizzes[idx];
        const title = document.getElementById('quizz-modal-title');
        const editIdx = document.getElementById('quizz-edit-idx');
        if (title) title.innerText = 'Edit Soal Quizz';
        if (editIdx) editIdx.value = idx.toString();

        if (mapelSelect) mapelSelect.value = q.mapel || '';
        if (rombelSelect) rombelSelect.value = q.rombel || '';
        const questionInput = document.getElementById('quizz-question');
        if (questionInput) questionInput.value = q.question || '';
        setTimeout(() => setQuillContent('quizz', q.question || ''), 80);

        const a0 = document.getElementById('quizz-a0');
        const a1 = document.getElementById('quizz-a1');
        const a2 = document.getElementById('quizz-a2');
        const a3 = document.getElementById('quizz-a3');
        if (a0) a0.value = q.answers[0] || '';
        if (a1) a1.value = q.answers[1] || '';
        if (a2) a2.value = q.answers[2] || '';
        if (a3) a3.value = q.answers[3] || '';

        setQuizzCorrect(q.correct || 0);

        if (q.images && q.images.length > 0) {
            window.storedQuizzImages = [...q.images];
        }
    } else {
        const title = document.getElementById('quizz-modal-title');
        const editIdx = document.getElementById('quizz-edit-idx');
        if (title) title.innerText = 'Soal Quizz Baru';
        if (editIdx) editIdx.value = '';

        const questionInput = document.getElementById('quizz-question');
        if (questionInput) questionInput.value = '';
        setTimeout(() => setQuillContent('quizz', ''), 80);
        const a0 = document.getElementById('quizz-a0');
        const a1 = document.getElementById('quizz-a1');
        const a2 = document.getElementById('quizz-a2');
        const a3 = document.getElementById('quizz-a3');
        if (a0) a0.value = '';
        if (a1) a1.value = '';
        if (a2) a2.value = '';
        if (a3) a3.value = '';
        setQuizzCorrect(0);
    }

    renderQuizzImagePreviews();
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function setQuizzCorrect(idx) {
    document.getElementById('quizz-correct-val').value = idx;
    document.querySelectorAll('.quizz-c-btn').forEach((btn, i) => {
        if (i === idx) {
            const colors = ['sky', 'indigo', 'violet', 'amber'];
            btn.className = `quizz-c-btn flex-1 py-3 rounded-xl font-black text-sm border-2 border-${colors[i]}-500 bg-${colors[i]}-50 text-${colors[i]}-700 transition-all shadow-sm`;
        } else {
            btn.className = `quizz-c-btn flex-1 py-3 rounded-xl font-black text-sm border-2 border-slate-200 text-slate-400 hover:border-slate-300 hover:text-slate-600 transition-all`;
        }
    });
}

async function saveQuizzManual() {
    const mapel = document.getElementById('quizz-mapel').value;
    const rombel = document.getElementById('quizz-rombel').value;
    const q = getQuillContent('quizz');
    const a0 = document.getElementById('quizz-a0').value;
    const a1 = document.getElementById('quizz-a1').value;
    const a2 = document.getElementById('quizz-a2').value;
    const a3 = document.getElementById('quizz-a3').value;
    const correctIdx = parseInt(document.getElementById('quizz-correct-val').value) || 0;
    const errorEl = document.getElementById('quizz-modal-error');

    if (!mapel || !rombel) {
        errorEl.innerText = "Mapel dan Rombel wajib dipilih!";
        errorEl.classList.remove('hidden');
        return;
    }
    if (!q || !a0 || !a1) {
        errorEl.innerText = "Pertanyaan dan minimal 2 opsi (A & B) wajib diisi!";
        errorEl.classList.remove('hidden');
        return;
    }

    const answers = [a0, a1, a2, a3].filter(x => x && x.trim() !== "");
    const safeCorrect = Math.min(correctIdx, answers.length - 1);

    const editIdx = document.getElementById('quizz-edit-idx').value;

    if (!db.quizzes) db.quizzes = [];

    const quizzObj = {
        mapel: mapel,
        rombel: rombel,
        question: q,
        answers: answers,
        correct: safeCorrect,
        images: window.storedQuizzImages && window.storedQuizzImages.length > 0 ? [...window.storedQuizzImages] : []
    };

    if (editIdx !== '') {
        const idx = parseInt(editIdx);
        if (idx >= 0 && idx < db.quizzes.length) {
            db.quizzes[idx] = quizzObj;
        } else {
            db.quizzes.push(quizzObj);
        }
    } else {
        db.quizzes.push(quizzObj);
    }

    await save();
    if (currentSiswa && currentSiswa.role === 'teacher') {
        renderTeacherQuizz();
    } else {
        renderAdminQuizz();
    }
    if (typeof renderTeacherQuizz === 'function') renderTeacherQuizz();

    closeModals();
    const Toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 3000 });
    Toast.fire({ icon: 'success', title: editIdx !== '' ? 'Pertanyaan Quizz Diperbarui!' : 'Pertanyaan Quizz Ditambahkan!' });
}

async function deleteQuizz(idx) {
    const result = await Swal.fire({
        title: 'Hapus Pertanyaan Quizz?',
        text: 'Pertanyaan ini akan dihapus secara permanen.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        confirmButtonText: 'Ya, Hapus!'
    });
    if (result.isConfirmed) {
        db.quizzes.splice(idx, 1);
        await save();
        renderAdminQuizz();
        renderTeacherQuizz();
    }
}

function populateQuizzFilters(mapelSelect, rombelSelect) {
    const isTeacher = currentSiswa && currentSiswa.role === 'teacher';
    const isTeacherSelect = mapelSelect && mapelSelect.id.includes('teacher');

    if (mapelSelect && mapelSelect.options.length <= 1) {
        let subjects = db.subjects || [];
        if (isTeacher && isTeacherSelect) {
            subjects = teacherSubjectNames(currentSiswa);
        }

        mapelSelect.innerHTML = '<option value="">Semua Mapel</option>';
        subjects.forEach(m => {
            const mName = typeof m === 'string' ? m : m.name;
            const opt = document.createElement('option');
            opt.value = opt.textContent = mName;
            mapelSelect.appendChild(opt);
        });

        // Add change listener to update rombels if it's teacher select
        if (isTeacher && isTeacherSelect && rombelSelect) {
            mapelSelect.addEventListener('change', () => {
                const selectedMapel = mapelSelect.value;
                let rombels = [];
                if (selectedMapel) {
                    rombels = teacherAllowedRombels(currentSiswa, selectedMapel);
                } else {
                    rombels = teacherCombinedRombels(currentSiswa);
                }
                const currentRombel = rombelSelect.value;
                rombelSelect.innerHTML = '<option value="">Semua Rombel</option>' +
                    rombels.map(r => `<option value="${r}">${r === currentRombel ? ' selected' : ''}>${r}</option>`).join('');
            });
        }
    }

    if (rombelSelect && rombelSelect.options.length <= 1) {
        let rombels = db.rombels || [];
        if (isTeacher && isTeacherSelect) {
            const selectedMapel = mapelSelect ? mapelSelect.value : '';
            if (selectedMapel) {
                rombels = teacherAllowedRombels(currentSiswa, selectedMapel);
            } else {
                rombels = teacherCombinedRombels(currentSiswa);
            }
        }

        rombelSelect.innerHTML = '<option value="">Semua Rombel</option>';
        rombels.forEach(m => {
            const opt = document.createElement('option');
            opt.value = opt.textContent = m;
            rombelSelect.appendChild(opt);
        });
    }
}

function buildQuizzRow(tbody, q, baseIdx) {
    const tr = document.createElement('tr');
    tr.className = 'border-b border-slate-50 hover:bg-slate-50/50 transition-colors';
    let answersHtml = q.answers.map((a, i) =>
        `<div class="${i === q.correct ? 'text-green-600 font-bold' : 'text-slate-500'} bg-slate-50 p-1 mb-1 rounded flex items-center justify-between">
                    <span>${String.fromCharCode(65 + i)}. ${a}</span>
                    <i class="fas ${i === q.correct ? 'fa-check text-green-500' : 'fa-times opacity-0'}"></i>
                </div>`
    ).join('');

    let mapelBadge = q.mapel ? `<span class="bg-blue-100 text-blue-700 font-bold text-[9px] px-2 py-0.5 rounded-full mr-1">${q.mapel}</span>` : '';
    let rombelBadge = q.rombel ? `<span class="bg-purple-100 text-purple-700 font-bold text-[9px] px-2 py-0.5 rounded-full">${q.rombel}</span>` : '';

    let imagesHtml = '';
    if (q.images && q.images.length > 0) {
        imagesHtml = `<div class="mt-2 flex flex-wrap gap-2">` +
            q.images.map((img, imgIdx) => `<img src="${img}" class="h-16 w-16 object-cover rounded border border-slate-200 cursor-pointer shadow-sm hover:shadow-md transition-all" onclick="openImageZoom('${img}', ${imgIdx}, ${JSON.stringify(q.images).replace(/"/g, '&quot;')})">`).join('') +
            `</div>`;
    }

    tr.innerHTML = `
                <td class="px-6 py-4">
                    <div class="mb-2">${mapelBadge}${rombelBadge}</div>
                    <div class="text-sm font-bold text-slate-800">${q.question}</div>
                    ${imagesHtml}
                </td>
                <td class="px-6 py-4 text-xs w-1/2">${answersHtml}</td>
                <td class="px-6 py-4 text-center">
                    <div class="flex items-center justify-center gap-1.5">
                        <button onclick="openQuizzModal(${baseIdx})" class="w-8 h-8 rounded-xl bg-sky-50 text-sky-600 hover:bg-sky-600 hover:text-white transition-all" title="Edit Soal">
                            <i class="fas fa-pencil-alt text-[10px]"></i>
                        </button>
                        <button onclick="deleteQuizz(${baseIdx})" class="w-8 h-8 rounded-xl bg-red-50 text-red-500 hover:bg-red-500 hover:text-white transition-all" title="Hapus Soal">
                            <i class="fas fa-trash-alt text-[10px]"></i>
                        </button>
                    </div>
                </td>
            `;
    tbody.appendChild(tr);
}

function renderAdminQuizz() {
    const tbody = document.getElementById('admin-quizz-table-body');
    const mapelFilter = document.getElementById('admin-quizz-filter-mapel');
    const rombelFilter = document.getElementById('admin-quizz-filter-rombel');
    if (!tbody) return;

    populateQuizzFilters(mapelFilter, rombelFilter);

    const fMapel = mapelFilter ? mapelFilter.value : '';
    const fRombel = rombelFilter ? rombelFilter.value : '';

    let quizzes = db.quizzes || [];
    if (fMapel) quizzes = quizzes.filter(q => q.mapel === fMapel);
    if (fRombel) quizzes = quizzes.filter(q => q.rombel === fRombel);

    tbody.innerHTML = '';

    if (quizzes.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-center py-8 text-slate-400"><i class="fas fa-gamepad text-3xl mb-2 opacity-30 block"></i>Belum ada pertanyaan quizz untuk kategori ini.</td></tr>';
        return;
    }

    quizzes.forEach((q) => {
        const baseIdx = db.quizzes.indexOf(q);
        buildQuizzRow(tbody, q, baseIdx);
    });
}

function renderTeacherQuizz() {
    const tbody = document.getElementById('teacher-quizz-table-body');
    const mapelFilter = document.getElementById('teacher-quizz-filter-mapel');
    const rombelFilter = document.getElementById('teacher-quizz-filter-rombel');
    if (!tbody) return;

    populateQuizzFilters(mapelFilter, rombelFilter);

    const fMapel = mapelFilter ? mapelFilter.value : '';
    const fRombel = rombelFilter ? rombelFilter.value : '';

    let quizzes = db.quizzes || [];

    // Strict enforcement for teachers
    if (currentSiswa && currentSiswa.role === 'teacher') {
        const tSubjects = teacherSubjectNames(currentSiswa);
        quizzes = quizzes.filter(q => {
            const allowedRombels = teacherAllowedRombels(currentSiswa, q.mapel);
            return tSubjects.includes(q.mapel) && allowedRombels.includes(q.rombel);
        });
    } else if (currentSiswa && currentSiswa.role === 'admin') {
        // Admin sees all
    }

    if (fMapel) quizzes = quizzes.filter(q => q.mapel === fMapel);
    if (fRombel) quizzes = quizzes.filter(q => q.rombel === fRombel);

    tbody.innerHTML = '';

    if (quizzes.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-center py-8 text-slate-400"><i class="fas fa-gamepad text-3xl mb-2 opacity-30 block"></i>Belum ada pertanyaan quizz untuk kategori ini.</td></tr>';
        return;
    }

    quizzes.forEach((q) => {
        const baseIdx = db.quizzes.indexOf(q);
        buildQuizzRow(tbody, q, baseIdx);
    });
}

window.syncUploadToSupabase = async function () {
    const btn = document.getElementById('btn-sync-upload');
    const status = document.getElementById('sync-status');
    const statusContent = document.getElementById('sync-status-content');

    if (!confirm('Apakah Anda yakin ingin mengupload database lokal ke Supabase Cloud? Ini akan memperbarui data di cloud dengan data lokal saat ini.')) return;

    try {
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memproses...';
        }
        if (status) status.classList.remove('hidden');
        if (statusContent) {
            statusContent.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menghubungkan ke server...';
            statusContent.className = 'flex items-center gap-2 text-sm px-4 py-2.5 rounded-xl font-medium bg-sky-50 text-sky-600 border border-sky-100';
        }

        const response = await fetch(getApiBaseUrl() + '/api/sync/upload-to-supabase', {
            method: 'POST'
        });

        const result = await response.json();

        if (result.ok) {
            if (statusContent) {
                statusContent.innerHTML = `<i class="fas fa-check-circle"></i> ${result.message}`;
                statusContent.className = 'flex items-center gap-2 text-sm px-4 py-2.5 rounded-xl font-medium bg-emerald-50 text-emerald-600 border border-emerald-100';
            }
            Swal.fire('Berhasil', result.message, 'success');
        } else {
            throw new Error(result.error || 'Terjadi kesalahan saat upload');
        }
    } catch (e) {
        console.error('Sync Upload Error:', e);
        if (statusContent) {
            statusContent.innerHTML = `<i class="fas fa-exclamation-circle"></i> Gagal: ${e.message}`;
            statusContent.className = 'flex items-center gap-2 text-sm px-4 py-2.5 rounded-xl font-medium bg-red-50 text-red-600 border border-red-100';
        }
        Swal.fire('Gagal', e.message, 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> Upload ke Supabase';
        }
    }
};

window.syncDownloadFromSupabase = async function () {
    const btn = document.getElementById('btn-sync-download');
    const status = document.getElementById('sync-status');
    const statusContent = document.getElementById('sync-status-content');

    if (!confirm('Apakah Anda yakin ingin mendownload database dari Supabase Cloud? DATA LOKAL AKAN DITIMPA dengan data dari cloud.')) return;

    try {
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memproses...';
        }
        if (status) status.classList.remove('hidden');
        if (statusContent) {
            statusContent.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menghubungkan ke server...';
            statusContent.className = 'flex items-center gap-2 text-sm px-4 py-2.5 rounded-xl font-medium bg-sky-50 text-sky-600 border border-sky-100';
        }

        const response = await fetch(getApiBaseUrl() + '/api/sync/download-from-supabase', {
            method: 'POST'
        });

        const result = await response.json();

        if (result.ok) {
            if (statusContent) {
                statusContent.innerHTML = `<i class="fas fa-check-circle"></i> ${result.message}`;
                statusContent.className = 'flex items-center gap-2 text-sm px-4 py-2.5 rounded-xl font-medium bg-emerald-50 text-emerald-600 border border-emerald-100';
            }
            Swal.fire({
                title: 'Berhasil',
                text: result.message + ' Halaman akan dimuat ulang.',
                icon: 'success',
                confirmButtonText: 'OK'
            }).then(() => {
                location.reload();
            });
        } else {
            throw new Error(result.error || 'Terjadi kesalahan saat download');
        }
    } catch (e) {
        console.error('Sync Download Error:', e);
        if (statusContent) {
            statusContent.innerHTML = `<i class="fas fa-exclamation-circle"></i> Gagal: ${e.message}`;
            statusContent.className = 'flex items-center gap-2 text-sm px-4 py-2.5 rounded-xl font-medium bg-red-50 text-red-600 border border-red-100';
        }
        Swal.fire('Gagal', e.message, 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-cloud-download-alt"></i> Download dari Supabase';
        }
    }
};

window.openQuizzAiModal = openQuizzAiModal;
window.openQuizzModal = openQuizzModal;
window.deleteQuizz = deleteQuizz;
window.renderAdminQuizz = renderAdminQuizz;
window.renderTeacherQuizz = renderTeacherQuizz;
window.syncUploadToSupabase = syncUploadToSupabase;
window.syncDownloadFromSupabase = syncDownloadFromSupabase;

async function openQuizzLeaderboardModal() {
    const mapelSel = document.getElementById('leaderboard-filter-mapel');
    const rombelSel = document.getElementById('leaderboard-filter-rombel');
    const modal = document.getElementById('quizz-leaderboard-modal');
    if (!mapelSel || !rombelSel || !modal) return;

    let subjects = [...new Set((db.quizzes || []).map(q => q.mapel))].filter(Boolean);
    let sections = [...new Set((db.quizzes || []).map(q => q.rombel))].filter(Boolean);

    if (currentSiswa && currentSiswa.role === 'teacher') {
        const tSubjects = teacherSubjectNames(currentSiswa);
        subjects = subjects.filter(s => tSubjects.includes(s));

        const updateLeaderboardRombels = (chosenMapel) => {
            let rombelsToUse;
            if (chosenMapel) {
                rombelsToUse = teacherAllowedRombels(currentSiswa, chosenMapel);
            } else {
                rombelsToUse = teacherCombinedRombels(currentSiswa);
            }
            rombelSel.innerHTML = '<option value="">Pilih Rombel</option>' +
                rombelsToUse.filter(r => sections.includes(r)).map(s => `<option value="${s}">${s}</option>`).join('');
        };

        mapelSel.innerHTML = '<option value="">Pilih Mapel</option>' + subjects.map(s => `<option value="${s}">${s}</option>`).join('');
        mapelSel.onchange = () => {
            updateLeaderboardRombels(mapelSel.value);
            fetchQuizzLeaderboard();
        };
        updateLeaderboardRombels('');
    } else {
        mapelSel.innerHTML = '<option value="">Pilih Mapel</option>' + subjects.map(s => `<option value="${s}">${s}</option>`).join('');
        rombelSel.innerHTML = '<option value="">Pilih Rombel</option>' + sections.map(s => `<option value="${s}">${s}</option>`).join('');
    }

    modal.classList.remove('hidden');
    modal.classList.add('flex');

    if (window.leaderboardInterval) clearInterval(window.leaderboardInterval);
    window.leaderboardInterval = setInterval(fetchQuizzLeaderboard, 5000);
    fetchQuizzLeaderboard();
}

async function fetchQuizzLeaderboard() {
    const mapel = document.getElementById('leaderboard-filter-mapel')?.value;
    const rombel = document.getElementById('leaderboard-filter-rombel')?.value;
    const body = document.getElementById('leaderboard-body');
    const table = document.getElementById('leaderboard-table');
    const loading = document.getElementById('leaderboard-loading');
    const empty = document.getElementById('leaderboard-empty');

    if (!mapel || !rombel) {
        if (empty) empty.classList.remove('hidden');
        if (table) table.classList.add('hidden');
        return;
    }

    if (empty) empty.classList.add('hidden');
    if (body && !body.innerHTML.trim() && loading) loading.classList.remove('hidden');

    try {
        const res = await fetch(`/api/quizz/participants?mapel=${encodeURIComponent(mapel)}&rombel=${encodeURIComponent(rombel)}`);
        const participants = await res.json();

        if (loading) loading.classList.add('hidden');
        participants.sort((a, b) => (b.score || 0) - (a.score || 0));

        if (body) {
            if (participants.length === 0) {
                body.innerHTML = '<tr><td colspan="3" class="p-8 text-center text-slate-400 font-bold italic">Belum ada peserta aktif dalam kuis ini.</td></tr>';
            } else {
                body.innerHTML = participants.map((p, idx) => `
                    <tr class="hover:bg-slate-50 transition-colors animate-fade-in">
                        <td class="px-4 py-4 text-center">
                            <div class="w-8 h-8 rounded-lg ${idx === 0 ? 'bg-amber-400 text-white' : idx === 1 ? 'bg-slate-300 text-slate-700' : idx === 2 ? 'bg-orange-300 text-orange-900' : 'bg-slate-100 text-slate-400'} flex items-center justify-center font-black mx-auto shadow-sm">
                                ${idx + 1}
                            </div>
                        </td>
                        <td class="px-4 py-4">
                            <div class="font-bold text-slate-700">${p.student_name}</div>
                            <div class="text-[10px] text-slate-400 uppercase font-black tracking-tighter">${p.student_id}</div>
                        </td>
                        <td class="px-4 py-4 text-center font-black text-sky-600 text-sm">
                            ${(p.score || 0).toLocaleString()}
                        </td>
                    </tr>
                `).join('');
            }
            if (table) table.classList.remove('hidden');
        }
    } catch (e) {
        console.error('Leaderboard Fetch Error:', e);
    }
}

async function openExamResultsRankingModal() {
    const rombelSel = document.getElementById('exam-ranking-filter-rombel');
    const mapelSel = document.getElementById('exam-ranking-filter-mapel');
    const modal = document.getElementById('exam-results-ranking-modal');
    if (!rombelSel || !mapelSel || !modal) return;

    await ensureDataLoaded('results');

    const results = (db.results || []).filter(r => !r.deleted && r.rombel);
    const rombels = [...new Set(results.map(r => r.rombel))].sort();
    rombelSel.innerHTML = '<option value="">Pilih Rombel</option>' + rombels.map(r => `<option value="${r}">${r}</option>`).join('');
    mapelSel.innerHTML = '<option value="">Semua Mapel</option>';

    modal.classList.remove('hidden');
    modal.classList.add('flex');
    fetchExamResultsRanking();
}

function fetchExamResultsRanking() {
    const rombel = document.getElementById('exam-ranking-filter-rombel')?.value;
    const mapel = document.getElementById('exam-ranking-filter-mapel')?.value;
    const body = document.getElementById('exam-ranking-body');
    const table = document.getElementById('exam-ranking-table');
    const loading = document.getElementById('exam-ranking-loading');
    const empty = document.getElementById('exam-ranking-empty');

    if (!body || !table || !loading || !empty) return;
    if (!rombel) {
        empty.classList.remove('hidden');
        table.classList.add('hidden');
        return;
    }

    empty.classList.add('hidden');
    loading.classList.remove('hidden');
    table.classList.add('hidden');

    const allResults = (db.results || []).filter(r => !r.deleted && r.rombel === rombel);
    const mapels = [...new Set(allResults.map(r => r.mapel))].sort();
    const mapelSel = document.getElementById('exam-ranking-filter-mapel');
    if (mapelSel) {
        mapelSel.innerHTML = '<option value="">Semua Mapel</option>' + mapels.map(m => `<option value="${m}">${m}</option>`).join('');
        if (mapel && !mapels.includes(mapel)) {
            mapelSel.value = '';
        }
    }

    const filteredResults = mapel ? allResults.filter(r => r.mapel === mapel) : allResults;
    const aggregated = {};

    filteredResults.forEach(r => {
        const key = (r.studentId || r.studentName || '').trim() || `unknown-${r.mapel}`;
        if (!aggregated[key]) {
            aggregated[key] = {
                studentId: r.studentId || '—',
                studentName: r.studentName || '—',
                score: 0,
                count: 0,
                latestDate: r.date ? new Date(r.date) : null,
                mapelLabel: mapel ? mapel : 'Semua Mapel'
            };
        }
        aggregated[key].score += Number(r.score || 0);
        aggregated[key].count += 1;
        const date = r.date ? new Date(r.date) : null;
        if (date && (!aggregated[key].latestDate || date > aggregated[key].latestDate)) {
            aggregated[key].latestDate = date;
        }
    });

    const rows = Object.values(aggregated);

    setTimeout(() => {
        loading.classList.add('hidden');
        if (rows.length === 0) {
            empty.classList.remove('hidden');
            table.classList.add('hidden');
            body.innerHTML = '';
            return;
        }

        rows.sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            if (b.latestDate && a.latestDate) return b.latestDate - a.latestDate;
            return 0;
        });

        body.innerHTML = rows.map((r, idx) => `
            <tr class="hover:bg-slate-50 transition-colors animate-fade-in">
                <td class="px-4 py-4 text-center">
                    <div class="w-8 h-8 rounded-lg ${idx === 0 ? 'bg-amber-400 text-white' : idx === 1 ? 'bg-slate-300 text-slate-700' : idx === 2 ? 'bg-orange-300 text-orange-900' : 'bg-slate-100 text-slate-400'} flex items-center justify-center font-black mx-auto shadow-sm">
                        ${idx + 1}
                    </div>
                </td>
                <td class="px-4 py-4">
                    <div class="font-bold text-slate-700">${r.studentName}</div>
                    <div class="text-[10px] text-slate-400 uppercase font-black tracking-tighter">${r.studentId}</div>
                    <div class="text-[10px] text-slate-500 mt-1">${r.count} hasil ujian</div>
                </td>
                <td class="px-4 py-4 text-slate-600">${r.mapelLabel}</td>
                <td class="px-4 py-4 text-center font-black text-sky-600 text-sm">${r.score.toFixed(1)}</td>
                <td class="px-4 py-4 text-slate-400 text-xs">${r.latestDate ? r.latestDate.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}</td>
            </tr>
        `).join('');

        empty.classList.add('hidden');
        table.classList.remove('hidden');
    }, 50);
}

window.openQuizzLeaderboardModal = openQuizzLeaderboardModal;
window.fetchQuizzLeaderboard = fetchQuizzLeaderboard;
window.openExamResultsRankingModal = openExamResultsRankingModal;
window.fetchExamResultsRanking = fetchExamResultsRanking;

// --- Gemini Model Preference ---
async function saveGeminiModelPreference() {
    const sel = document.getElementById('gemini-model-selection');
    if (!sel) return;
    const model = sel.value;
    try {
        const res = await fetch('/api/admin/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key: 'gemini_model_preference', value: model })
        });
        if (res.ok) {
            console.log('[AI] Gemini model preference saved:', model);
            if (typeof Swal !== 'undefined') {
                const Toast = Swal.mixin({
                    toast: true,
                    position: 'bottom-end',
                    showConfirmButton: false,
                    timer: 2000,
                    timerProgressBar: true
                });
                Toast.fire({ icon: 'success', title: `Model preferred: ${model}` });
            }
        }
    } catch (e) {
        console.error('[AI] Failed to save Gemini model preference:', e.message);
    }
}

async function loadGeminiModelPreference() {
    const sel = document.getElementById('gemini-model-selection');
    if (!sel) return;
    try {
        const res = await fetch('/api/admin/config/gemini_model_preference');
        if (res.ok) {
            const data = await res.json();
            if (data.value) {
                sel.value = data.value;
                console.log('[AI] Gemini model preference loaded:', data.value);
            }
        }
    } catch (e) {
        console.error('[AI] Failed to load Gemini model preference:', e.message);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(loadGeminiModelPreference, 1000);
});

window.saveGeminiModelPreference = saveGeminiModelPreference;
window.loadGeminiModelPreference = loadGeminiModelPreference;



