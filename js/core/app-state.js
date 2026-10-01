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


