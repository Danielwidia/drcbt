/**
 * js/core/app-state.js
 * Part of CBT application refactored module
 */

function showLoginForm(type) {
    window.loginType = type;
    document.getElementById('auth-modal').classList.remove('hidden');
    document.getElementById('auth-modal').classList.add('flex');
}

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

        // equal timestamp: maximize details and preserve deletion flag
        if (!existing.deleted && r.deleted) {
            map.set(key, Object.assign({}, existing, r));
        } else if (existing.deleted && !r.deleted) {
            map.set(key, Object.assign({}, existing, r));
        } else if (!hasDetails(existing) && hasDetails(r)) {
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
                    // Merge results from server to local state
                    if (serverDb.results) db.results = mergeResults(db.results, serverDb.results);

                    // For other settings, we might want to keep some server-side updates
                    // but usually, if we are calling save(), the current local 'db' 
                    // contains the change we explicitly want to make.
                    // However, we should at least ensure we don't 'undo' other changes.

                    // Update students, subjects, rombels if they look newer/different 
                    // (unless we are currently in that management screen - but app.js is single-state)
                    // For now, simpler: we fetch to ensure we have the latest results/state
                    // and let the local explicit change (like schedules) take precedence in the final POST.
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

            // Simpan seluruh database lokal ke server dalam satu panggilan.
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

function teacherSubjectNames(teacher) {
    if (!teacher) return [];
    if (teacher.role === 'admin') {
        return (db.subjects || []).map(s => typeof s === 'string' ? s : s.name);
    }
    if (!Array.isArray(teacher.subjects)) return [];
    return teacher.subjects.map(s => typeof s === 'string' ? s : s.name);
}

function teacherAllowedRombels(teacher, subjectName) {
    if (!teacher) return [];
    if (teacher.role === 'admin') {
        return db.rombels || [];
    }
    if (!Array.isArray(teacher.subjects)) return [];
    const entry = teacher.subjects.find(s => (typeof s === 'string' ? s : s.name) === subjectName);
    if (!entry) return [];
    if (typeof entry === 'string') {
        return teacher.rombels || [];
    }
    return entry.rombels || [];
}

function teacherCombinedRombels(teacher) {
    if (!teacher || !Array.isArray(teacher.subjects)) return [];
    const set = new Set();
    teacher.subjects.forEach(s => {
        const roms = typeof s === 'string' ? (teacher.rombels || []) : (s.rombels || []);
        roms.forEach(r => set.add(r));
    });
    if (Array.isArray(teacher.rombels)) {
        teacher.rombels.forEach(r => set.add(r));
    }
    return Array.from(set);
}

async function fetchIPs() {
    try {
        const response = await fetch(getApiBaseUrl() + '/api/ips');
        if (!response.ok) throw new Error('Failed to fetch IPs');
        const ips = await response.json();
        const ipContainer = document.getElementById('accessible-ips');
        if (ips.length === 0) {
            ipContainer.innerHTML = '<div class="text-slate-500">Tidak ada alamat IP yang dapat diakses</div>';
        } else {
            ipContainer.innerHTML = ips.map(ip => `<div class="font-mono bg-slate-50 px-3 py-2 rounded-lg mb-2">http://${ip}:3000</div>`).join('');
        }
    } catch (error) {
        console.error('Error fetching IPs:', error);
        document.getElementById('accessible-ips').innerHTML = '<div class="text-red-500">Gagal memuat alamat IP</div>';
    }
}

async function logActivity(activity) {
    if (!currentSiswa) return;
    try {
        await fetch(getApiBaseUrl() + '/api/logs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: currentSiswa.id,
                userName: currentSiswa.name,
                role: currentSiswa.role,
                activity: activity
            })
        });
    } catch (e) {
        console.warn('[logActivity] Failed:', e.message);
    }
}

async function handleLogin() {
    const u = document.getElementById('username').value.trim().toUpperCase();
    const p = document.getElementById('password').value.trim();

    if (!db.students) {
        alert('Database belum siap. Silakan refresh halaman.');
        return;
    }

    // Coba cari berdasarkan ID yang tepat
    let user = db.students.find(x => x.id.toUpperCase() === u && x.password === p);

    // Jika tidak ditemukan, coba cari berdasarkan nama (untuk kemudahan)
    if (!user) {
        const nameSearch = u.toLowerCase();
        if (window.loginType === 'student') {
            user = db.students.find(x =>
                x.name.toLowerCase().includes(nameSearch) &&
                x.password === p &&
                x.role === 'student'
            );
        } else if (window.loginType === 'admin' || window.loginType === 'teacher') {
            user = db.students.find(x =>
                x.name.toLowerCase().includes(nameSearch) &&
                x.password === p &&
                x.role === window.loginType
            );
        }
    }

    if (user) {
        const roleMatch = (window.loginType === user.role);
        console.log('User found:', user.name, '| Role matches:', roleMatch);

        if (roleMatch) {
            currentSiswa = user;
            // For student updateCompletionCharts is used
            if (user.role === 'student' && typeof updateCompletionCharts === 'function') updateCompletionCharts();
            saveSession();

            await logActivity('Login ke aplikasi');

            if (user.role === 'admin') window.location.href = 'admin.html';
            else if (user.role === 'student') window.location.href = 'siswa.html';
            else if (user.role === 'teacher') window.location.href = 'guru.html';
        } else {
            console.log('Role mismatch - Expected:', window.loginType, 'Actual:', user.role);
            showError(`Akun ini terdaftar sebagai ${user.role}. Silakan klik menu login yang sesuai.`);
        }
    } else {
        // Determine if ID exists but password fails, or ID missing
        const idMatch = db.students.find(x => x.id.toUpperCase() === u);
        if (idMatch) {
            showError('ID ditemukan, tapi password salah. Coba lagi.');
        } else {
            showError('ID atau Nama tidak ditemukan. Pastikan data sudah tersimpan di Admin.');
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('login-btn');
    if (btn) btn.addEventListener('click', handleLogin);

    // Add Enter key support for login
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');

    if (usernameInput) {
        usernameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                handleLogin();
            }
        });
    }

    if (passwordInput) {
        passwordInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                handleLogin();
            }
        });
    }
});

function showError(customMsg) {
    const err = document.getElementById('login-error');
    const defaultRoleMsg = window.loginType === 'teacher' ? 'Password default: escrido123' : 'Password default: escrido';
    err.innerHTML = (customMsg || `ID atau password salah!`) + `<br><span class="text-[10px] opacity-70 mt-1 block tracking-tight">• ${defaultRoleMsg}</span>`;
    err.classList.remove('hidden');
}

function logout() {
    isExamActive = false;
    // Pastikan data exam final disimpan sebelum logout
    if (currentSiswa && currentSiswa.role === 'student' && examData && Array.isArray(examData.answers)) {
        console.log('[logout] Saving final exam data to localStorage...');
        // Save ke localStorage SYNCHRONOUSLY terlebih dahulu
        if (typeof saveStudentExamProgress === 'function') saveStudentExamProgress();
        // Kemudian try update server async tanpa wait (fire and forget dengan delay)
        if (navigator.onLine && typeof updateLiveExamStatus === 'function') {
            updateLiveExamStatus(false).catch(e => console.warn('[logout-async] Error:', e.message));
        }
    }
    clearSession();
    // Delay redirect untuk memastikan localStorage write selesai
    setTimeout(() => {
        window.location.href = 'index.html';
    }, 300);
}

function renderTeacherSubjectCheckboxes() {
    const container = document.getElementById('teacher-subjects');
    if (!container) return;

    const html = db.subjects.map((s, i) => {
        const name = typeof s === 'string' ? s : s.name;
        // build rombel checkboxes for this subject
        const rombCheckboxes = db.rombels.map(r =>
            `<label class="flex items-center gap-2 group cursor-pointer">
                <input type="checkbox" disabled class="teacher-rombel-checkbox w-4 h-4 text-amber-500 rounded border-slate-300 focus:ring-amber-500/30 transition-all" data-parent-subject="${name}" data-rombel="${r}" />
                <span class="text-[11px] font-bold text-slate-500 group-hover:text-slate-700 transition-colors">${r}</span>
            </label>`
        ).join('');

        return `<div class="p-4 bg-white rounded-2xl border border-slate-100 mb-3 shadow-sm hover:border-amber-200 transition-all group/card">
                    <label class="flex items-center gap-3 cursor-pointer">
                        <div class="relative flex items-center">
                            <input type="checkbox" class="teacher-subject-checkbox w-5 h-5 text-amber-500 rounded-lg border-slate-300 focus:ring-amber-500/30 transition-all" data-subject="${name}" />
                        </div>
                        <span class="text-sm text-slate-800 font-black tracking-tight group-hover/card:text-amber-600 transition-colors">${name}</span>
                    </label>
                    <div class="mt-3 ml-8 flex flex-wrap gap-x-4 gap-y-2 rombel-group opacity-50 transition-opacity" id="rombel-group-${i}">
                        ${rombCheckboxes}
                    </div>
                </div>`;
    }).join('');

    container.innerHTML = html || `<div class="py-10 text-center text-slate-400 italic text-xs">Belum ada mata pelajaran terdaftar</div>`;

    document.querySelectorAll('.teacher-subject-checkbox').forEach((cb, idx) => {
        cb.addEventListener('change', (e) => {
            const subj = e.target.dataset.subject;
            const rombelGroup = document.getElementById(`rombel-group-${idx}`);
            if (rombelGroup) {
                if (e.target.checked) {
                    rombelGroup.classList.remove('opacity-50');
                } else {
                    rombelGroup.classList.add('opacity-50');
                }
            }
            document.querySelectorAll(`.teacher-rombel-checkbox[data-parent-subject="${subj}"]`).forEach(rb => {
                rb.disabled = !e.target.checked;
                if (!e.target.checked) rb.checked = false;
            });
        });
    });
}

function renderTeacherRombelCheckboxes() {
    // deprecated: rombel choices are now tied to each subject
    // kept for backwards compatibility but does nothing
}

function renderTeachersList() {
    const tbody = document.getElementById('teachers-table-body');
    const teachers = db.students.filter(s => s.role === 'teacher');

    if (teachers.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="3" class="px-6 py-16 text-center">
                    <div class="flex flex-col items-center justify-center gap-3 grayscale opacity-30 text-slate-400">
                        <i class="fas fa-users-slash text-4xl"></i>
                        <p class="text-sm font-bold">Belum ada guru terdaftar</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = teachers.map(t => {
        const subjectsHtml = (t.subjects || []).map(s => {
            const name = typeof s === 'string' ? s : s.name;
            const rombels = (s.rombels || []).join(', ');
            return `
                <div class="mb-2 last:mb-0">
                    <div class="text-[11px] font-black text-slate-800 uppercase tracking-tight">${name}</div>
                    <div class="text-[10px] font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md inline-block mt-0.5 border border-amber-100">${rombels}</div>
                </div>
            `;
        }).join('');

        return `
            <tr class="hover:bg-amber-50/20 transition-colors group">
                <td class="px-6 py-5">
                    <div class="flex items-center gap-4">
                        <div class="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-amber-500 group-hover:text-white transition-all shadow-inner">
                            <i class="fas fa-user-tie"></i>
                        </div>
                        <div>
                            <div class="font-black text-slate-800 tracking-tight">${t.name}</div>
                            <div class="flex items-center gap-2 mt-0.5">
                                <span class="bg-slate-100 text-slate-500 text-[10px] px-2 py-0.5 rounded-full font-bold border border-slate-200">ID: ${t.id}</span>
                                <span class="text-[10px] text-slate-400 font-medium italic">Teacher Account</span>
                            </div>
                        </div>
                    </div>
                </td>
                <td class="px-6 py-5">
                    <div class="max-w-[250px]">
                        ${subjectsHtml}
                    </div>
                </td>
                <td class="px-6 py-5 text-center">
                    <div class="flex items-center justify-center gap-2 transform translate-x-2 group-hover:translate-x-0 opacity-0 group-hover:opacity-100 transition-all duration-300">
                        <button onclick="deleteTeacher('${t.id}')" 
                                class="w-9 h-9 rounded-xl bg-red-50 text-red-500 hover:bg-red-500 hover:text-white transition-all flex items-center justify-center shadow-sm border border-red-100" 
                                title="Hapus Guru">
                            <i class="fas fa-trash-alt text-sm"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function toggleTeacherSelectAll(event) {
    const checked = event.target.checked;
    const selectedSubject = document.getElementById('teacher-filter-mapel')?.value || '';
    const selectedRombel = document.getElementById('teacher-filter-rombel')?.value || '';
    let list = db.questions.filter(q => {
        const qSubject = q.mapel;
        if (!qSubject) return false;
        const qSubjectName = typeof qSubject === 'string' ? qSubject : qSubject.name || qSubject;
        if (!teacherSubjectNames(currentSiswa).includes(qSubjectName)) return false;
        const allowed = teacherAllowedRombels(currentSiswa, qSubjectName);
        if (!allowed.includes(q.rombel)) return false;
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
    if (checked) {
        list.forEach(q => selectedTeacherQuestions.add(q));
    } else {
        list.forEach(q => selectedTeacherQuestions.delete(q));
    }
    renderTeacherQuestions();
}

let resultsPollInterval = null;

async function fetchAndMerge() {
    try {
        // Fetch results directly from /api/results
        const res = await fetch(getApiBaseUrl() + '/api/results?limit=-1');
        if (res.ok) {
            const data = await res.json();
            const serverResults = Array.isArray(data) ? data : (data.items || []);
            if (Array.isArray(serverResults)) {
                const merged = mergeResults(db.results, serverResults);
                const dbJson = JSON.stringify(db.results || []);
                const mergedJson = JSON.stringify(merged || []);
                if (mergedJson !== dbJson) {
                    db.results = merged;
                    console.log(`[SYNC] Results updated from server. New count: ${db.results.length}`);
                    updateStats();
                    // persist new merged data locally; this way reloading the
                    // admin UI while offline still shows the most recent
                    // scores fetched from the server.
                    try {
                        await saveLocalDb();
                    } catch (e) {
                        console.warn('Could not save merged results locally:', e.message || e);
                    }

                    // Update Admin View
                    if (document.getElementById('admin-results') && !document.getElementById('admin-results').classList.contains('hidden')) {
                        renderAdminResults();
                    }

                    // Update Teacher View if active
                    if (document.getElementById('teacher-dashboard') &&
                        !document.getElementById('teacher-dashboard').classList.contains('hidden')) {
                        if (typeof renderTeacherResults === 'function') renderTeacherResults();
                    }
                }
            }
        }
    } catch (err) {
        console.warn('fetchAndMerge failed: Connection to server failed. Please check your network or server URL.');
    }
}

function renderRombelSection() {
    const mapelList = document.getElementById('mapel-list');
    const rombelList = document.getElementById('rombel-list');

    if (mapelList) {
        mapelList.innerHTML = db.subjects.map(s => {
            const name = getSubjectName(s);
            return `
                        <div class="group flex items-center justify-between p-3.5 bg-slate-50 hover:bg-white hover:ring-1 hover:ring-sky-100 rounded-2xl transition-all">
                            <div class="flex items-center gap-3">
                                <i class="fas fa-bookmark text-[10px] text-sky-300"></i>
                                <span class="text-xs font-bold text-slate-700">${name}</span>
                            </div>
                            <button onclick="deleteMapel('${name}')" class="w-7 h-7 flex items-center justify-center rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100">
                                <i class="fas fa-trash-alt text-[10px]"></i>
                            </button>
                        </div>
                    `;
        }).join('');
    }

    if (rombelList) {
        rombelList.innerHTML = db.rombels.map(r => `
                    <div class="group flex items-center justify-between p-3.5 bg-slate-50 hover:bg-white hover:ring-1 hover:ring-emerald-100 rounded-2xl transition-all">
                        <div class="flex items-center gap-3">
                            <i class="fas fa-graduation-cap text-[10px] text-emerald-300"></i>
                            <span class="text-xs font-bold text-slate-700">${r}</span>
                        </div>
                        <button onclick="deleteRombel('${r}')" class="w-7 h-7 flex items-center justify-center rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100">
                            <i class="fas fa-trash-alt text-[10px]"></i>
                        </button>
                    </div>
                `).join('');
    }
    const progressFilter = document.getElementById('progress-filter-rombel');
    if (progressFilter) {
        const current = progressFilter.value;
        progressFilter.innerHTML = '<option value="">Semua</option>' +
            db.rombels.map(r => `<option value="${r}"${r === current ? ' selected' : ''}>${r}</option>`).join('');
    }
    const progressMapel = document.getElementById('progress-filter-mapel');
    if (progressMapel) {
        const currentMapel = progressMapel.value;
        progressMapel.innerHTML = '<option value="">Semua</option>' +
            db.subjects.map(s => `<option value="${getSubjectName(s)}"${getSubjectName(s) === currentMapel ? ' selected' : ''}>${getSubjectName(s)}</option>`).join('');
    }

    // Teacher Progress Filters
    const teacherProgressRombel = document.getElementById('teacher-progress-filter-rombel');
    const isTeacher = currentSiswa && currentSiswa.role === 'teacher';

    if (teacherProgressRombel) {
        const current = teacherProgressRombel.value;
        const availableRombels = isTeacher ? teacherCombinedRombels(currentSiswa) : db.rombels;
        teacherProgressRombel.innerHTML = '<option value="">Semua</option>' +
            availableRombels.map(r => `<option value="${r}"${r === current ? ' selected' : ''}>${r}</option>`).join('');
    }

    const teacherProgressMapel = document.getElementById('teacher-progress-filter-mapel');
    if (teacherProgressMapel) {
        const currentMapel = teacherProgressMapel.value;
        const availableMapels = isTeacher ? teacherSubjectNames(currentSiswa) : db.subjects;
        teacherProgressMapel.innerHTML = '<option value="">Semua</option>' +
            availableMapels.map(s => {
                const name = typeof s === 'string' ? s : getSubjectName(s);
                return `<option value="${name}"${name === currentMapel ? ' selected' : ''}>${name}</option>`;
            }).join('');
    }

    renderRombelProgress();
}

function renderRombelProgress() {
    // Determine elements based on visibility
    const adminEl = document.getElementById('admin-rombel');
    const teacherEl = document.getElementById('teacher-tab-live-progress');
    const isAdminVisible = adminEl && !adminEl.classList.contains('hidden');
    const isTeacherVisible = teacherEl && !teacherEl.classList.contains('hidden');

    let progressList, filterSelect, mapelSelect;

    if (isTeacherVisible) {
        progressList = document.getElementById('teacher-rombel-progress-list');
        filterSelect = document.getElementById('teacher-progress-filter-rombel');
        mapelSelect = document.getElementById('teacher-progress-filter-mapel');
    } else {
        progressList = document.getElementById('rombel-progress-list');
        filterSelect = document.getElementById('progress-filter-rombel');
        mapelSelect = document.getElementById('progress-filter-mapel');
    }

    if (!progressList) {
        console.warn('[renderRombelProgress] progressList element not found');
        return;
    }

    const selectedRombel = filterSelect ? filterSelect.value : '';
    const selectedMapel = mapelSelect ? mapelSelect.value : '';
    const activeExamsCount = (db.activeExams || []).length;
    console.log('%c[renderRombelProgress] RENDER CALL', 'color: blue; font-weight: bold', {
        timestamp: new Date().toLocaleTimeString(),
        selectedRombel,
        selectedMapel,
        activeExamsCount,
        students: (db.students || []).filter(s => s.role !== 'admin').length
    });

    const questionsList = Array.isArray(db.questions) ? db.questions : [];
    const questionsByRombel = questionsList.reduce((acc, q) => {
        if (!q.rombel || !q.mapel) return acc;
        if (!acc[q.rombel]) acc[q.rombel] = new Set();
        acc[q.rombel].add(q.mapel);
        return acc;
    }, {});

    function formatTimeRemaining(seconds) {
        if (seconds <= 0) return 'Waktu habis';
        const hrs = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        if (hrs > 0) {
            return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    function formatLastSeen(updatedAt) {
        if (!updatedAt) return 'Never';
        const now = Date.now();
        const diff = Math.floor((now - new Date(updatedAt).getTime()) / 1000);
        if (diff < 2) return 'Baru saja';
        if (diff < 60) return `${diff} detik lalu`;
        return `${Math.floor(diff / 60)} menit lalu`;
    }

    let list = (db.students || []).filter(s => s.role !== 'admin');

    if (isTeacherVisible && currentSiswa && currentSiswa.role === 'teacher') {
        const allowedRombels = teacherCombinedRombels(currentSiswa);
        list = list.filter(s => allowedRombels.includes(s.rombel));
    }

    list = list.filter(s => !selectedRombel || s.rombel === selectedRombel)
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    if (list.length === 0) {
        progressList.innerHTML = `<div class="px-6 py-8 text-center text-slate-500 rounded-3xl border border-dashed border-slate-200">Tidak ada siswa untuk ditampilkan.</div>`;
        return;
    }

    const html = list.map(s => {
        const isTeacher = isTeacherVisible && currentSiswa && currentSiswa.role === 'teacher';
        const teacherMapels = isTeacher ? teacherSubjectNames(currentSiswa) : null;

        const availableMapels = Array.from(questionsByRombel[s.rombel] || [])
            .filter(m => teacherMapels ? teacherMapels.includes(m) : true);

        const studentResults = (db.results || []).filter(r =>
            r.studentId === s.id && !r.deleted &&
            (!selectedMapel ? (teacherMapels ? teacherMapels.includes(r.mapel) : true) : r.mapel === selectedMapel)
        );

        const completedMapels = new Set(studentResults.map(r => r.mapel));
        const completedCount = completedMapels.size;
        const totalMapels = selectedMapel ? (availableMapels.includes(selectedMapel) ? 1 : 0) : availableMapels.length;

        const normStr = v => String(v || '').trim().toLowerCase();
        const sid = normStr(s.id);
        const srom = normStr(s.rombel);

        const activeEntry = (db.activeExams || []).find(e => {
            const sameId = normStr(e.studentId) === sid;
            const sameRombel = !e.rombel || !s.rombel || normStr(e.rombel) === srom;
            const sameMapel = !selectedMapel ?
                (teacherMapels ? teacherMapels.some(tm => normStr(tm) === normStr(e.mapel)) : true) :
                normStr(e.mapel) === normStr(selectedMapel);

            return sameId && sameRombel && sameMapel;
        });

        if (activeEntry) {
            console.log(`  📊 Student ${s.name}: ACTIVE in ${activeEntry.mapel}, Q${activeEntry.currentQuestionNumber}/${activeEntry.totalQuestions}, ${activeEntry.percentage}%`);
        }

        const progress = activeEntry ? activeEntry.percentage : (totalMapels ? Math.round((completedCount / totalMapels) * 100) : 0);
        const averageScore = studentResults.length ? (studentResults.reduce((sum, r) => sum + Number(r.score || 0), 0) / studentResults.length).toFixed(1) : '-';

        let infoText = '';
        let timeAlertClass = '';
        let barHtml = '';

        if (activeEntry) {
            const timeRemainingText = formatTimeRemaining(activeEntry.timeRemaining || 0);
            const correctCount = activeEntry.correctCount || 0;
            const totalItems = activeEntry.totalItems || activeEntry.totalQuestions || 100;
            const answeredItems = activeEntry.answeredItemsCount || 0;
            const answeredQuestions = activeEntry.answeredCount || 0;

            const lastSeenText = formatLastSeen(activeEntry.updatedAt);
            infoText = `Sedang ujian ${activeEntry.mapel} • ${answeredQuestions}/${activeEntry.totalQuestions} Terjawab • ${activeEntry.percentage}% dijawab • ${correctCount} benar • Sisa waktu: ${timeRemainingText} • <span class="text-[10px] text-emerald-400 font-bold">${lastSeenText}</span>`;

            // Highlight if <5 minutes remaining
            if ((activeEntry.timeRemaining || 0) < 300 && (activeEntry.timeRemaining || 0) > 0) {
                timeAlertClass = ' border-l-4 border-l-red-500 bg-red-50';
            }

            const correctPercent = (correctCount / totalItems) * 100;
            const remainingProgressPercent = Math.max(0, ((answeredItems - correctCount) / totalItems) * 100);

            // Progress Bar Fallback: If detailed counts are 0, use general percentage
            let greenWidth = correctPercent;
            let blueWidth = remainingProgressPercent;
            if (greenWidth === 0 && blueWidth === 0 && activeEntry.percentage > 0) {
                blueWidth = activeEntry.percentage;
            }

            barHtml = `
                        <div class="mt-4 h-2.5 w-full rounded-full bg-slate-200 overflow-hidden flex shadow-inner border border-slate-100">
                            <div class="h-full bg-emerald-500 transition-all duration-700 ease-out" style="width:${greenWidth}%" title="${correctCount} Benar"></div>
                            <div class="h-full bg-sky-400 transition-all duration-700 ease-out" style="width:${blueWidth}%" title="Progres Lainnya"></div>
                        </div>
                    `;
        } else {
            infoText = selectedMapel
                ? totalMapels
                    ? (completedCount > 0 ? `Selesai ${selectedMapel} • Rata-rata skor ${averageScore === '-' ? '-' : averageScore + '%'}` : `Belum mengerjakan ${selectedMapel}`)
                    : `Mapel ${selectedMapel} tidak tersedia di rombel ${s.rombel}`
                : totalMapels
                    ? `${completedCount}/${totalMapels} mapel selesai • Rata-rata skor ${averageScore === '-' ? '-' : averageScore + '%'}`
                    : 'Belum ada mata pelajaran aktif untuk rombel ini.';

            barHtml = `
                        <div class="mt-4 h-2.5 w-full rounded-full bg-slate-200 overflow-hidden shadow-inner border border-slate-100">
                            <div class="h-full rounded-full bg-emerald-500 transition-all duration-700 ease-out" style="width:${progress}%;"></div>
                        </div>
                    `;
        }

        const saveIcon = activeEntry ? `
            <button onclick="requestStudentSave('${s.id}')" title="Simpan Progres Siswa" 
                class="w-7 h-7 flex items-center justify-center bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-all ml-2">
                <i class="fas fa-save text-xs"></i>
            </button>` : '';

        const reloadIcon = activeEntry ? `
            <button onclick="requestStudentReload('${s.id}')" title="Reload Tab Siswa" 
                class="w-7 h-7 flex items-center justify-center bg-sky-50 text-sky-600 rounded-lg hover:bg-sky-100 transition-all">
                <i class="fas fa-sync-alt text-xs"></i>
            </button>` : '';

        const clearIcon = activeEntry ? `
            <button onclick="requestStudentClearAnswers('${s.id}')" title="Hapus Jawaban Siswa" 
                class="w-7 h-7 flex items-center justify-center bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-all">
                <i class="fas fa-trash-alt text-xs"></i>
            </button>` : '';

        const statusBadge = activeEntry
            ? `<div class="flex items-center gap-1">
                <span class="px-3 py-1 bg-sky-100 text-sky-700 rounded-full text-[10px] font-black uppercase">Sedang mengerjakan</span>
                ${saveIcon}
                ${clearIcon}
                ${reloadIcon}
               </div>`
            : '<span class="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-[10px] font-black uppercase">Tidak sedang mengerjakan</span>';

        const requestBadges = activeEntry ? [
            activeEntry.adminSaveRequest ? '<span class="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-black uppercase">Permintaan SIMPAN terkirim</span>' : null,
            activeEntry.adminReloadRequest ? '<span class="px-3 py-1 bg-sky-100 text-sky-700 rounded-full text-[10px] font-black uppercase">Permintaan RELOAD terkirim</span>' : null
        ].filter(Boolean).join(' ') : '';

        return `
                    <div class="p-4 bg-slate-50 rounded-3xl border border-slate-100${timeAlertClass} transition-all duration-300 hover:shadow-md">
                        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div>
                                <div class="flex items-center gap-2 mb-2">${statusBadge}</div>
                                <p class="text-xs text-slate-500">Nama Siswa</p>
                                <p class="font-black text-slate-800">${s.name}</p>
                                <p class="text-xs text-slate-500">${s.rombel} • ${infoText}</p>
                                ${requestBadges ? `<div class="mt-3 flex flex-wrap gap-2">${requestBadges}</div>` : ''}
                            </div>
                            <div class="text-right">
                                <span class="text-sm font-black text-slate-800">${progress}%</span>
                            </div>
                        </div>
                        ${barHtml}
                    </div>`;
    }).join('');

    progressList.innerHTML = html;
    console.log('%c[renderRombelProgress] RENDER COMPLETE', 'color: green; font-weight: bold', `${list.length} students rendered`);
}

function deleteMapel(name) {
    if (confirm(`Hapus mata pelajaran "${name}"?`)) {
        db.subjects = db.subjects.filter(s => getSubjectName(s) !== name);
        save();
        renderRombelSection();
    }
}

function deleteRombel(name) {
    if (confirm(`Hapus rombel "${name}"?`)) {
        db.rombels = db.rombels.filter(r => r !== name);
        save();
        renderRombelSection();
    }
}

function toggleMobileMenu() {
    const menu = document.getElementById('mobile-menu');
    if (menu) menu.classList.toggle('hidden');
}

function getSubjectName(subject) {
    return typeof subject === 'string' ? subject : subject.name;
}

function populateSelects(ids, includeAll = false) {
    ids.forEach(id => {
        const el = document.getElementById(id); if (!el) return;
        const list = id.includes('mapel') ? db.subjects : db.rombels;
        let html = includeAll ? `<option value="ALL">SEMUA</option>` : '';
        html += list.map(item => {
            const val = id.includes('mapel') ? getSubjectName(item) : item;
            const display = id.includes('mapel') ? getSubjectName(item) : item;
            return `<option value="${val}">${display}</option>`;
        }).join('');
        el.innerHTML = html;
    });
}

let currentQType = 'single';

let activeCorrect = 0;

let activeCorrectMultiple = [];

function addMatchingARow() {
    const container = document.getElementById('q-matching-answers');
    if (!container) return;

    const row = document.createElement('div');
    row.className = 'matching-a-row flex items-center gap-2';
    row.innerHTML = `
                <input type="text" class="matching-answer flex-1 p-3 bg-slate-50 rounded-xl text-sm border-none" placeholder="Jawaban ${container.children.length + 1}">
                <button type="button" onclick="removeMatchingARow(this)" class="text-red-500">&times;</button>
            `;

    container.appendChild(row);
}

function removeMatchingARow(btn) {
    const row = btn.closest('.matching-a-row');
    if (row) row.remove();
}

async function uploadImageToServer(base64OrBlob, fileName = 'image.jpg') {
    const formData = new FormData();

    let blob;
    if (typeof base64OrBlob === 'string' && base64OrBlob.startsWith('data:')) {
        const resp = await fetch(base64OrBlob);
        blob = await resp.blob();
    } else {
        blob = base64OrBlob;
    }

    formData.append('image', blob, fileName);

    const res = await fetch(getApiBaseUrl() + '/api/upload-image', {
        method: 'POST',
        body: formData
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Upload failed' }));
        throw new Error(err.error || 'Server error');
    }

    const data = await res.json();
    return data.url;
}

async function addImageUrl() {
    const urlInput = document.getElementById('q-image-url');
    const url = urlInput.value.trim();
    if (!url) return;

    if (!window.storedImages) window.storedImages = [];

    if (url.startsWith('data:image')) {
        showToast('Mengunggah data gambar...', 'info');
        try {
            const compressed = await compressImage(url);
            const cloudUrl = await uploadImageToServer(compressed, 'pasted-image.jpg');
            window.storedImages.push(cloudUrl);
            showToast('Gambar berhasil diunggah ke cloud', 'success');
        } catch (err) {
            console.error('Failed to upload pasted image:', err);
            showToast('Gagal upload ke cloud: ' + err.message, 'error');
            window.storedImages.push(url);
        }
    } else {
        window.storedImages.push(url);
    }

    urlInput.value = '';
    renderImagePreviews();
}

function compressImage(base64Str, maxWidth = 1024, maxHeight = 1024, quality = 0.7) {
    return new Promise((resolve) => {
        const img = new Image();
        img.src = base64Str;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;

            if (width > height) {
                if (width > maxWidth) {
                    height *= maxWidth / width;
                    width = maxWidth;
                }
            } else {
                if (height > maxHeight) {
                    width *= maxHeight / height;
                    height = maxHeight;
                }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', quality));
        };
    });
}

function renderImagePreviews() {
    const previewContainer = document.getElementById('q-images-preview');
    const listContainer = document.getElementById('q-images-list');
    previewContainer.innerHTML = '';
    listContainer.innerHTML = '';

    if (!window.storedImages) return;

    window.storedImages.forEach((img, idx) => {
        const isUrl = typeof img === 'string' && (img.startsWith('http') || img.startsWith('https'));
        const isBase64 = typeof img === 'string' && img.startsWith('data:image');

        // Show thumbnail preview
        const thumb = document.createElement('div');
        thumb.className = 'relative w-24 h-24 border-2 border-sky-300 rounded-lg overflow-hidden group hover:border-red-400 transition-all cursor-pointer';
        thumb.onclick = () => {
            window.storedImages.splice(idx, 1);
            renderImagePreviews();
        };

        const imgEl = document.createElement('img');
        imgEl.src = normalizeImgSrc(img);
        imgEl.className = 'w-full h-full object-cover';

        const badge = document.createElement('div');
        badge.className = 'absolute top-1 right-1 bg-sky-600 text-white text-[10px] rounded px-1 font-bold';
        badge.textContent = idx + 1;

        const overlay = document.createElement('div');
        overlay.className = 'absolute inset-0 bg-red-500/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity';
        overlay.innerHTML = '<i class="fas fa-trash text-white text-xs"></i>';

        thumb.appendChild(imgEl);
        thumb.appendChild(badge);
        thumb.appendChild(overlay);
        previewContainer.appendChild(thumb);

        // Add to list
        const item = document.createElement('div');
        item.className = 'flex justify-between items-center bg-slate-50 p-1.5 rounded-lg';
        const label = isUrl ? '🔗 URL' : '📁 File';
        const name = isUrl ? (img.length > 30 ? img.substring(0, 30) + '...' : img) : `Gambar ${idx + 1}`;
        item.innerHTML = `<span class="text-[10px] font-bold text-slate-500">${label}: ${name}</span>`;
        listContainer.appendChild(item);
    });
}

function renderCorrectButtons() {
    document.querySelectorAll('.c-btn').forEach((b, i) => {
        let selected = false;
        if (currentQType === 'multiple') {
            selected = activeCorrectMultiple.includes(i);
        } else {
            selected = activeCorrect === i;
        }
        b.className = selected ? 'c-btn flex-1 py-3 border-2 border-sky-600 bg-sky-50 text-sky-600 font-bold rounded-xl' : 'c-btn flex-1 py-3 border-2 border-slate-100 text-slate-400 font-bold rounded-xl';
    });
}

function setActiveCorrect(idx) {
    if (currentQType === 'multiple') {
        const pos = activeCorrectMultiple.indexOf(idx);
        if (pos === -1) activeCorrectMultiple.push(idx);
        else activeCorrectMultiple.splice(pos, 1);
    } else {
        activeCorrect = idx;
        activeCorrectMultiple = [];
    }
    renderCorrectButtons();
}

function clearSearch() {
    document.getElementById('search-questions').value = '';
    renderAdminQuestions();
}

function clearFilters() {
    document.getElementById('search-questions').value = '';
    document.getElementById('filter-rombel').value = 'ALL';
    document.getElementById('filter-mapel').value = 'ALL';
    renderAdminQuestions();
}

async function pingBackend() {
    try {
        const res = await fetch(getApiBaseUrl() + '/api/ips', { cache: 'no-store' });
        return res.ok;
    } catch (e) {
        return false;
    }
}

const SCHOOL_SETTINGS_KEY = 'cbt_school_settings';

function saveSchoolSettings() {
    const storedLogo = localStorage.getItem('cbt_school_logo') || '';
    let storedLogoUrl = localStorage.getItem('cbt_school_logo_url') || '';
    if (storedLogoUrl === "undefined" || storedLogoUrl === "null") storedLogoUrl = "";

    const previewEl = document.getElementById('school-logo-preview');
    const previewSrc = previewEl?.src || '';
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
        showToast('Nama sekolah tidak boleh kosong!', 'error');
        return;
    }

    // Simpan ke localStorage untuk fallback
    localStorage.setItem(SCHOOL_SETTINGS_KEY, JSON.stringify(settings));
    if (settings.logo && settings.logo.startsWith('data:')) {
        localStorage.setItem('cbt_school_logo', settings.logo);
    }

    // Backward compatibility untuk modul Teacher / Perangkat Ajar
    localStorage.setItem('ADMIN_IDENTITAS_SEKOLAH', settings.name);
    localStorage.setItem('ADMIN_IDENTITAS_GURU', settings.principal);
    localStorage.setItem('ADMIN_IDENTITAS_ALAMAT', settings.address);
    localStorage.setItem('ADMIN_IDENTITAS_TAHUN', settings.tahun || '2026/2027');
    localStorage.setItem('ADMIN_IDENTITAS_SEMESTER', settings.semester);

    // Sync ke db state lokal
    if (!db.schoolSettings) db.schoolSettings = {};
    Object.assign(db.schoolSettings, settings);

    // Langsung simpan ke server via endpoint khusus (lebih andal dari save() umum)
    fetch(getApiBaseUrl() + '/api/school-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
    }).then(r => {
        if (r.ok) {
            console.log('[SchoolSettings] Tersimpan ke server. Logo:', settings.logo ? '✅' : '❌ (kosong)');
        } else {
            console.warn('[SchoolSettings] Gagal simpan ke server:', r.status);
        }
    }).catch(e => console.warn('[SchoolSettings] Error:', e.message));

    renderSchoolIdentity(settings);
    showToast('Identitas sekolah berhasil disimpan!', 'success');
}

async function fetchSchoolSettings() {
    try {
        const res = await fetch(getApiBaseUrl() + '/api/school-settings');
        if (res.ok) {
            const settings = await res.json();
            if (settings && settings.name) {
                if (!db.schoolSettings) db.schoolSettings = {};
                Object.assign(db.schoolSettings, settings);
                renderSchoolIdentity(settings);
            }
        }
    } catch (e) {
        console.warn('[fetchSchoolSettings] Failed:', e.message);
        // Fallback to local db if fetch fails
        if (db.schoolSettings && db.schoolSettings.name) {
            renderSchoolIdentity(db.schoolSettings);
        }
    }
}

function renderSchoolIdentity(settings) {
    if (!settings || !settings.name) return;

    const name = settings.name;
    // Prioritaskan logoUrl dari server (static file)
    let logoUrl = settings.logoUrl;
    if (logoUrl === "undefined" || logoUrl === "null") logoUrl = null;

    let logo = logoUrl || settings.logo || localStorage.getItem('cbt_school_logo') || 'logo.png';

    // Jika itu adalah path internal, pastikan kita pakai API Base URL jika diperlukan
    if (logo && logo !== "undefined" && logo !== "null" && !logo.startsWith('data:') && !logo.startsWith('http') && logo !== 'logo.png') {
        logo = getApiBaseUrl() + logo;
    }
    const address = settings.address || '';
    const yayasan = settings.yayasan || '';

    // 1. Update Page Title
    const currentTitle = document.title;
    if (!currentTitle.includes(name.toUpperCase())) {
        document.title = `CBT - ${name}`;
    }

    // 1.5 Update specific elements by ID if they exist
    const schoolElements = [
        'school-name-display',
        'raport-school-name',
        'cert-school-name'
    ];
    schoolElements.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerText = name;
    });

    // 2. Update Login Screen Branding
    const loginTitle = document.querySelector('.cbt-title');
    const loginSubtitle = document.querySelector('.cbt-subtitle');
    const loginLogo = document.querySelector('.logo-glow');

    if (loginSubtitle) loginSubtitle.innerText = name;
    if (loginLogo) {
        loginLogo.src = logo;
        // Also update favicon & apple touch icon
        const favicon = document.querySelector('link[rel="icon"]');
        if (favicon) favicon.href = logo;
        const appleIcon = document.querySelector('link[rel="apple-touch-icon"]');
        if (appleIcon) appleIcon.href = logo;
    }

    // 3. Update Admin Sidebar Branding
    const adminSidebarTitle = document.getElementById('admin-sidebar-title');

    const adminSidebarLogo = document.getElementById('admin-sidebar-logo');
    const raportLogo = document.getElementById('raport-logo');

    if (adminSidebarTitle) adminSidebarTitle.innerText = `ADMIN CBT ${name}`;
    if (adminSidebarLogo) adminSidebarLogo.src = logo;
    if (raportLogo) raportLogo.src = logo;

    // 4. Update Teacher Sidebar Branding
    const teacherSidebarTitle = document.getElementById('teacher-sidebar-title');
    const teacherSidebarLogo = document.getElementById('teacher-sidebar-logo');
    if (teacherSidebarTitle) teacherSidebarTitle.innerText = `${name} - GURU`;
    if (teacherSidebarLogo) teacherSidebarLogo.src = logo;

    // 5. Update Student Area Branding
    const studentSidebarTitle = document.getElementById('student-sidebar-title');
    const studentSidebarLogo = document.getElementById('student-sidebar-logo');
    const studentMeta = document.getElementById('student-meta-school');
    if (studentSidebarTitle) studentSidebarTitle.innerText = name;
    if (studentSidebarLogo) studentSidebarLogo.src = logo;
    if (studentMeta) studentMeta.innerText = name;

    console.log('[SchoolIdentity] UI updated for:', name);
}

function loadSchoolSettings() {
    let settings = {};

    // Prioritas 1: Database (Single Source of Truth)
    if (db.schoolSettings && db.schoolSettings.name) {
        settings = {
            yayasan: db.schoolSettings.yayasan,
            name: db.schoolSettings.name,
            principal: db.schoolSettings.principal,
            principalNip: db.schoolSettings.principalNip,
            address: db.schoolSettings.address,
            kota: db.schoolSettings.kota,
            logo: db.schoolSettings.logo,
            logoUrl: db.schoolSettings.logoUrl
        };
    } else {
        // Prioritas 2: LocalStorage (Migration fallback)
        try {
            const raw = localStorage.getItem(SCHOOL_SETTINGS_KEY);
            if (raw) settings = JSON.parse(raw);
        } catch (e) { }
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

    // Restore logo (Prioritas: DB settings URL > DB settings Base64 > localStorage)
    let logoUrl = settings.logoUrl;
    if (logoUrl === "undefined" || logoUrl === "null") logoUrl = null;

    let savedLogo = logoUrl || settings.logo || localStorage.getItem('cbt_school_logo');

    if (savedLogo && savedLogo !== "undefined" && savedLogo !== "null" && !savedLogo.startsWith('data:') && !savedLogo.startsWith('http') && savedLogo !== 'logo.png') {
        savedLogo = getApiBaseUrl() + savedLogo;
    }
    const logoPreview = document.getElementById('school-logo-preview');
    const logoPlaceholder = document.getElementById('school-logo-placeholder');
    if (savedLogo && logoPreview) {
        logoPreview.src = savedLogo;
        logoPreview.style.display = 'block';
        if (logoPlaceholder) logoPlaceholder.style.display = 'none';

        // Update input file label if possible (optional UI polish)
        const logoName = document.getElementById('school-logo-name');
        if (logoName) logoName.innerText = "Logo tersimpan";
    }
}

async function previewSchoolLogo(event) {
    const file = event.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {  // max 5MB untuk file upload
        return showToast('Ukuran file melebihi 5MB!', 'error');
    }

    // Tampilkan preview lokal dulu (segera)
    const reader = new FileReader();
    reader.onload = function (e) {
        const base64 = e.target.result;
        const preview = document.getElementById('school-logo-preview');
        const placeholder = document.getElementById('school-logo-placeholder');
        if (preview) {
            preview.src = base64;
            preview.style.display = '';
        }
        if (placeholder) placeholder.style.display = 'none';
        // Simpan ke localStorage sebagai fallback
        localStorage.setItem('cbt_school_logo', base64);
    };
    reader.readAsDataURL(file);

    // Upload file langsung ke server
    try {
        showToast('Mengupload logo...', 'info');
        const formData = new FormData();
        formData.append('logo', file);
        const res = await fetch(getApiBaseUrl() + '/api/upload-logo', {
            method: 'POST',
            body: formData
        });
        if (res.ok) {
            const data = await res.json();
            if (data.ok && data.url) {
                const urlToSave = data.urlBase || data.url;
                if (urlToSave) {
                    localStorage.setItem('cbt_school_logo_url', urlToSave);
                    localStorage.setItem('cbt_school_logo', data.url);
                }
                if (!db.schoolSettings) db.schoolSettings = {};
                db.schoolSettings.logoUrl = data.url;
                db.schoolSettings.logo = data.url;
                renderSchoolIdentity(db.schoolSettings);
                console.log('[Logo] ✅ Upload berhasil. URL:', data.url);
                showToast('Logo berhasil diupload ke server!', 'success');
            }
        } else {
            console.warn('[Logo] Server upload gagal, fallback ke base64');
        }
    } catch (e) {
        console.warn('[Logo] Upload error:', e.message, '- fallback ke base64');
    }
}

function getSchoolSettings() {
    let settings = { yayasan: 'YAYASAN PENDIDIKAN', name: 'NAMA SEKOLAH', principal: 'Kepala Sekolah', principalNip: '-', address: 'Alamat Sekolah' };
    try {
        const raw = localStorage.getItem(SCHOOL_SETTINGS_KEY);
        if (raw) Object.assign(settings, JSON.parse(raw));
    } catch (e) { }
    if (db.schoolSettings) Object.assign(settings, db.schoolSettings);
    settings.logo = localStorage.getItem('cbt_school_logo') || 'logo.png';
    return settings;
}

function renderSubjectsLockManagement() {
    const container = document.getElementById('subjects-lock-container');
    if (!container) return;

    container.innerHTML = db.subjects.map((subject, idx) => {
        const subjectName = getSubjectName(subject);
        const isLocked = subject.locked;
        return `
                    <div class="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between hover:shadow-md transition-all" data-subject-index="${idx}">
                        <div>
                            <h3 class="font-bold text-slate-800">${subjectName}</h3>
                            <p class="text-xs text-slate-400 mt-1">Status: ${isLocked ? '<span class="text-red-600 font-bold">🔒 TERKUNCI</span>' : '<span class="text-emerald-600 font-bold">🔓 TERBUKA</span>'}</p>
                        </div>
                        <div class="flex gap-2">
                            ${isLocked ?
                `<button class="toggle-lock-btn px-4 py-2 bg-emerald-600 text-white font-bold rounded-xl text-sm hover:bg-emerald-700 transition-all flex items-center gap-2"><i class="fas fa-unlock"></i> Buka</button>` :
                `<button class="toggle-lock-btn px-4 py-2 bg-red-600 text-white font-bold rounded-xl text-sm hover:bg-red-700 transition-all flex items-center gap-2"><i class="fas fa-lock"></i> Kunci</button>`
            }
                        </div>
                    </div>
                `;
    }).join('');

    // Attach event listeners to buttons
    document.querySelectorAll('.toggle-lock-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            const idx = parseInt(this.closest('[data-subject-index]').dataset.subjectIndex);
            toggleSubjectLock(idx);
        });
    });
}

function toggleSubjectLock(idx) {
    if (idx < 0 || idx >= db.subjects.length) return;

    const subject = db.subjects[idx];
    subject.locked = !subject.locked;
    save();
    renderSubjectsLockManagement();
    renderStudentExamList(); // Update student view if they're looking at exam list

    const subjectName = getSubjectName(subject);
    const status = subject.locked ? 'TERKUNCI' : 'TERBUKA';
    console.log(`Mata pelajaran "${subjectName}" sekarang ${status}`);
}

function clearResultsFilter() {
    const f = document.getElementById('results-date-from');
    const t = document.getElementById('results-date-to');
    if (f) f.value = '';
    if (t) t.value = '';
    renderAdminResults();
}

function deleteResult(idx) {
    if (!confirm('Hapus hasil ujian ini?')) return;
    if (!db.results[idx]) return;
    db.results[idx].deleted = true;
    db.results[idx].updatedAt = Date.now();
    // PENTING: Tandai results sudah dimuat agar save() menyertakan array results
    // dalam payload ke server. Tanpa ini, server tidak menerima status deleted
    // dan data akan muncul kembali setelah reload.
    loadedCollections.results = true;
    updateCompletionCharts();
    save();

    // Check which dashboard is currently active and render accordingly
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
    // Tandai semua hasil sebagai dihapus; ini penting agar merge server menyampaikan status deleted.
    db.results = (db.results || []).map(r => ({
        ...r,
        deleted: true,
        updatedAt: now
    }));

    // PENTING: Tandai results sudah dimuat agar save() menyertakan array results
    // dalam payload ke server. Tanpa ini, server tidak menerima status deleted.
    loadedCollections.results = true;
    save();
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
    // Tandai semua results yang incomplete sebagai dihapus
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

    save();
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
        console.error('[batchAiCorrect] Save error:', e.message);
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
                            <input type="number" id="ai-essay-score-input-${resultIdx}-${qIdx}" min="0" max="5" step="0.5" value="${score.toFixed(1)}" class="w-20 border border-slate-300 rounded-lg px-2 py-1 text-sm font-bold text-center focus:outline-none focus:ring-2 focus:ring-violet-400">
                            <button onclick="applyEssayScore(${resultIdx}, ${qIdx}, document.getElementById('ai-essay-score-input-${resultIdx}-${qIdx}').value)" class="px-3 py-1 bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold rounded-lg transition-colors"><i class="fas fa-check mr-1"></i>Terapkan Skor</button>
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

function saveConfig() {
    const val = document.getElementById('config-input').value.trim();
    if (!val) return;
    if (currentConfigType === 'mapel') {
        // Check if subject already exists
        if (!db.subjects.find(s => getSubjectName(s) === val)) {
            db.subjects.push({ name: val, locked: false });
        }
    } else {
        db.rombels.push(val);
    }
    save();
    closeModals();
    showAdminSection('rombel');
}

function setAnswer(i) {
    const q = examData.questions[examData.currentIdx];
    if (q.type === 'multiple') {
        let arr = examData.answers[examData.currentIdx] || [];
        const idx = arr.indexOf(i);
        if (idx === -1) arr.push(i);
        else arr.splice(idx, 1);
        examData.answers[examData.currentIdx] = arr;
    } else {
        examData.answers[examData.currentIdx] = i;
    }
    saveStudentExamProgress();
    showQuestion(examData.currentIdx);
}

function toggleAnswer(i) { setAnswer(i); }

function setAnswerText(val) {
    examData.answers[examData.currentIdx] = val;
    saveStudentExamProgress();
    updateQuestionStatus();
    updateProgress();
}

function setAnswerTF(stmtIdx, boolVal) {
    const idx = examData.currentIdx;
    const ansArr = examData.answers[idx] || [];
    ansArr[stmtIdx] = boolVal;
    examData.answers[idx] = ansArr;
    saveStudentExamProgress();
    // re-render current question to update styling
    showQuestion(idx);
}

function setMatchingAnswer(qIdx, aIdx) {
    const idx = examData.currentIdx;
    const ansArr = examData.answers[idx] || [];
    ansArr[qIdx] = aIdx === "" ? null : parseInt(aIdx);
    examData.answers[idx] = ansArr;
    saveStudentExamProgress();
    showQuestion(idx);
}

function navQ(dir) { showQuestion(examData.currentIdx + dir); }


let statusShowAll = false; // show all questions when true

const MAX_VISIBLE_STATUS = 8;

function toggleStatusView() {
    statusShowAll = !statusShowAll;
    document.getElementById('toggle-status-btn').innerText = statusShowAll ? '(Tutup)' : '(Lihat semua)';
    updateQuestionStatus();
}

function toggleDoubt() {
    const idx = examData.currentIdx;
    examData.ragu[idx] = !examData.ragu[idx];
    saveStudentExamProgress();
    updateQuestionStatus();
    updateDoubtBtn();
}

function getTypeLabel(type) {
    if (type === 'single') return 'Pilihan ganda';
    if (type === 'multiple') return 'Pilihan ganda (Kompleks)';
    if (type === 'text') return 'Uraian';
    if (type === 'tf') return 'Benar / Salah';
    if (type === 'matching') return 'Menjodohkan';
    return type;
}

let currentZoomImageIndex = 0;

function openImageZoom(qIdx, imgIdx) {
    try {
        currentZoomQuestion = qIdx;
        currentZoomImageIndex = imgIdx;
        const q = examData.questions[qIdx];
        if (!q) {
            console.warn('Question not found at index:', qIdx);
            return;
        }
        const images = getQuestionImageSources(q);

        if (images.length > 0 && images[imgIdx]) {
            const zoomModal = document.getElementById('image-zoom-modal');
            const zoomImage = document.getElementById('zoom-image-display');
            const counter = document.getElementById('zoom-image-counter');

            if (!zoomModal || !zoomImage || !counter) {
                console.error('Modal elements not found');
                return;
            }

            zoomImage.src = images[imgIdx];
            counter.textContent = `${imgIdx + 1}/${images.length}`;
            zoomModal.classList.remove('hidden');
            zoomModal.style.display = 'flex';
            console.log('Zoom modal opened for image', imgIdx + 1, 'of', images.length);
        } else {
            console.warn('No images found for question or invalid image index');
        }
    } catch (error) {
        console.error('Error opening image zoom:', error);
    }
}

function closeImageZoom() {
    try {
        const zoomModal = document.getElementById('image-zoom-modal');
        if (zoomModal) {
            zoomModal.classList.add('hidden');
            zoomModal.style.display = 'none';
        }
    } catch (error) {
        console.error('Error closing image zoom:', error);
    }
}

function nextZoomImage() {
    const q = examData.questions[currentZoomQuestion];
    const images = getQuestionImageSources(q);
    if (!images.length) return;
    currentZoomImageIndex = (currentZoomImageIndex + 1) % images.length;
    const zoomImage = document.getElementById('zoom-image-display');
    const counter = document.getElementById('zoom-image-counter');
    zoomImage.src = images[currentZoomImageIndex];
    counter.textContent = `${currentZoomImageIndex + 1}/${images.length}`;
}

function previousZoomImage() {
    const q = examData.questions[currentZoomQuestion];
    const images = getQuestionImageSources(q);
    if (!images.length) return;
    currentZoomImageIndex = (currentZoomImageIndex - 1 + images.length) % images.length;
    const zoomImage = document.getElementById('zoom-image-display');
    const counter = document.getElementById('zoom-image-counter');
    zoomImage.src = images[currentZoomImageIndex];
    counter.textContent = `${currentZoomImageIndex + 1}/${images.length}`;
}

function getAiTypeCounts() {
    const typeCounts = { single: 0, multiple: 0, text: 0, tf: 0, matching: 0 };
    const oldJumlah = document.getElementById('ai-jumlah');
    const oldType = document.getElementById('ai-type');

    if (oldJumlah && oldType) {
        const chosen = (oldType.value || 'single').trim();
        typeCounts[chosen] = Number(oldJumlah.value) || 0;
    } else {
        typeCounts.single = Number(document.getElementById('ai-jml-pg')?.value) || 0;
        typeCounts.multiple = Number(document.getElementById('ai-jml-pgk')?.value) || 0;
        typeCounts.text = Number(document.getElementById('ai-jml-esai')?.value) || 0;
        typeCounts.tf = Number(document.getElementById('ai-jml-bs')?.value) || 0;
        typeCounts.matching = Number(document.getElementById('ai-jml-jodoh')?.value) || 0;
    }

    return typeCounts;
}

function getAiLevelCounts(totalQuestions) {
    const levels = { mudah: 0, sedang: 0, hots: 0 };
    const mudah = Number(document.getElementById('ai-lvl-mudah')?.value) || 0;
    const sedang = Number(document.getElementById('ai-lvl-sedang')?.value) || 0;
    const hotsInput = document.getElementById('ai-lvl-hots');

    levels.mudah = mudah;
    levels.sedang = sedang;
    levels.hots = Math.max(0, totalQuestions - mudah - sedang);

    if (hotsInput) {
        hotsInput.value = String(levels.hots);
    }

    return levels;
}

function getAIErrorExplanation(errorMessage) {
    if (!errorMessage) return '';
    const normalized = String(errorMessage).toLowerCase();
    if (normalized.includes('kuota habis') || normalized.includes('quota') || normalized.includes('balance') || normalized.includes('insufficient') || normalized.includes('402')) {
        return 'Catatan: pesan ini menunjukkan bahwa API key sudah mencapai batas kuota/saldo. Silakan ganti atau tambahkan API key yang masih aktif.';
    }
    if (normalized.includes('rate limit') || normalized.includes('too many requests') || normalized.includes('service unavailable') || normalized.includes('server busy') || normalized.includes('503') || normalized.includes('sistem sibuk')) {
        return 'Catatan: ini berarti layanan AI sedang sibuk atau terlalu banyak permintaan. Bukan kuota habis permanen; coba lagi beberapa menit kemudian.';
    }
    if (normalized.includes('tidak ditemukan atau kuota habis') || normalized.includes('tidak ditemukan atau kuota habis di semua sumber')) {
        return 'Catatan: sistem tidak menemukan API key aktif saat ini. Periksa konfigurasi API key atau tambahkan key baru di pengaturan.';
    }
    return '';
}

let currentKisiKisiData = [];

async function generateKisiKisiWithAi() {
    const mapel = document.getElementById('kk-mapel').value;
    const rombel = document.getElementById('kk-rombel').value;

    // Filter questions to send
    const questions = db.questions.filter(q => q.mapel === mapel && q.rombel === rombel);
    if (questions.length === 0) {
        alert('Tidak ada soal yang ditemukan untuk Mapel and Rombel ini!');
        return;
    }

    const loading = document.getElementById('ai-loading');
    loading.classList.remove('hidden');
    loading.classList.add('flex');

    try {
        const response = await fetch(getApiBaseUrl() + '/api/generate-kisi-kisi', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ questions, mapel, rombel })
        });

        const result = await response.json();
        if (result.ok) {
            currentKisiKisiData = result.kisiKisi;
            renderKisiKisiTable(currentKisiKisiData);
            document.getElementById('kisi-kisi-setup').classList.add('hidden');
            document.getElementById('kisi-kisi-result').classList.remove('hidden');
            document.getElementById('kk-count').innerText = questions.length;
        } else {
            const explanation = getAIErrorExplanation(result.error);
            alert('Error AI: ' + (result.error || 'Gagal generate kisi-kisi') + (explanation ? '\n\n' + explanation : ''));
        }
    } catch (err) {
        console.error('Kisi-kisi Generation Error:', err);
        alert('Terjadi kesalahan saat memanggil AI: ' + err.message);
    } finally {
        loading.classList.add('hidden');
        loading.classList.remove('flex');
    }
}

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

let apiKeysStatsPollingInterval = null;

const STATS_POLLING_INTERVAL = 3000; // 3 detik


function addTeacherAPIKeyForm() {
    const input = document.getElementById('new-api-key-input');
    if (!input) {
        showToast('Form tidak ditemukan', 'error');
        return;
    }

    const apiKey = input.value.trim();
    if (!apiKey) {
        showToast('Masukkan API Key terlebih dahulu', 'error');
        return;
    }

    if (!currentSiswa || currentSiswa.role !== 'teacher') {
        alert('Hanya guru yang dapat menambahkan API Key');
        return;
    }

    // Show loading state
    const btn = (window.event && window.event.target) ? window.event.target : null;
    const originalText = btn ? btn.innerHTML : '';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memproses...';
    }

    // Send to server for auto-setup to Vercel
    fetch(getApiBaseUrl() + '/api/teacher/add-api-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            teacherId: currentSiswa.id,
            apiKey: apiKey
        })
    })
        .then(res => res.json())
        .then(data => {
            if (!data.ok) {
                showToast(data.error || 'Gagal menambahkan API Key', 'error');
                return;
            }
            if (typeof updateApiKeysWarningBanner === 'function') {
                updateApiKeysWarningBanner('', '');
            }

            // Update local state
            if (!Array.isArray(currentSiswa.apiKeys)) {
                currentSiswa.apiKeys = [];
            }

            const trimmedKey = apiKey.trim();
            const alreadyExists = currentSiswa.apiKeys.some(entry => {
                if (typeof entry === 'string') return entry.trim() === trimmedKey;
                if (typeof entry === 'object' && entry.key) return entry.key.trim() === trimmedKey;
                return false;
            });

            if (!alreadyExists) {
                currentSiswa.apiKeys.push({
                    key: trimmedKey,
                    status: 'active',
                    addedAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    note: ''
                });
            }

            save();
            input.value = '';
            input.type = 'password';
            if (typeof renderTeacherAPIKeys === 'function') {
                renderTeacherAPIKeys();
            }

            // Update real-time stats immediately
            updateRealtimeStats();

            // Show success with Vercel status
            const message = data.vercelStatus
                ? `✅ API Key ditambahkan! ${data.vercelStatus}`
                : '✅ API Key berhasil ditambahkan!';
            showToast(message, 'success');

        })
        .catch(err => {
            console.error('API Key Error:', err);
            showToast('Terjadi kesalahan: ' + err.message, 'error');
        })
        .finally(() => {
            btn.disabled = false;
            btn.innerHTML = originalText;
        });
}

function removeTeacherAPIKey(index) {
    if (!confirm('Apakah Anda yakin ingin menghapus API Key ini?')) {
        return;
    }

    if (!currentSiswa || currentSiswa.role !== 'teacher') {
        alert('Hanya guru yang dapat menghapus API Key');
        return;
    }

    fetch(getApiBaseUrl() + '/api/teacher/remove-api-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            teacherId: currentSiswa.id,
            keyIndex: index
        })
    })
        .then(res => res.json())
        .then(data => {
            if (!data.ok) {
                showToast(data.error || 'Gagal menghapus API Key', 'error');
                return;
            }

            // Remove from local state
            if (Array.isArray(currentSiswa.apiKeys)) {
                currentSiswa.apiKeys.splice(index, 1);
            }

            save();

            if (typeof renderTeacherAPIKeys === 'function') {
                renderTeacherAPIKeys();
            }

            // Update real-time stats immediately
            updateRealtimeStats();

            showToast('✅ API Key berhasil dihapus!', 'success');
        })
        .catch(err => {
            console.error('Remove API Key Error:', err);
            showToast('Terjadi kesalahan: ' + err.message, 'error');
        });
}

function detectProviderFromKey(key) {
    if (!key) return 'Unknown';
    if (key.startsWith('AIzaSy')) return 'Google Gemini';
    if (key.startsWith('sk-')) return 'OpenAI (ChatGPT)';
    if (key.startsWith('sk-or-v1-') || key.startsWith('sk-or-')) return 'OpenRouter';
    if (key.startsWith('gsk_')) return 'Groq';
    if (key.includes('deepseek')) return 'DeepSeek';
    return 'Other Provider';
}

function toggleNewKeyVisibility() {
    const input = document.getElementById('new-api-key-input');
    const icon = document.getElementById('toggle-new-key-icon');
    if (!input) return;

    if (input.type === 'password') {
        input.type = 'text';
        if (icon) icon.classList.replace('fa-eye', 'fa-eye-slash');
    } else {
        input.type = 'password';
        if (icon) icon.classList.replace('fa-eye-slash', 'fa-eye');
    }
}

async function renderTeacherAPIKeys() {
    const listContainer = document.getElementById('api-keys-list');
    if (!listContainer) return;

    console.log('renderTeacherAPIKeys called');

    // Auto-sync if keys are missing or it's been a while (optional enhancement)
    if (!currentSiswa || !Array.isArray(currentSiswa.apiKeys)) {
        listContainer.innerHTML = `
            <div class="text-center py-12 text-slate-400">
                <i class="fas fa-circle-notch fa-spin text-4xl mb-4 opacity-20"></i>
                <p class="font-bold">Memuat daftar API Key...</p>
            </div>`;
        await syncTeacherAPIKeysFromServer();
    }

    if (!currentSiswa || !Array.isArray(currentSiswa.apiKeys)) {
        listContainer.innerHTML = `
            <div class="text-center py-12 text-slate-400">
                <i class="fas fa-key text-4xl mb-4 opacity-20"></i>
                <p class="font-bold">Belum ada API Key pribadi</p>
                <p class="text-xs">Gunakan form di atas untuk menambahkan key Gemini atau ChatGPT.</p>
            </div>`;
        updateTeacherApiKeysStats([]);
        return;
    }

    const filter = document.getElementById('api-keys-filter')?.value || 'all';
    let keys = currentSiswa.apiKeys;

    updateTeacherApiKeysStats(currentSiswa.apiKeys);

    if (filter === 'active') {
        keys = keys.filter(k => (typeof k === 'object' ? k.status : 'active') !== 'exhausted');
    } else if (filter === 'exhausted') {
        keys = keys.filter(k => (typeof k === 'object' ? k.status : 'active') === 'exhausted');
    }

    if (keys.length === 0) {
        listContainer.innerHTML = `
            <div class="text-center py-12 text-slate-400">
                <i class="fas fa-filter text-4xl mb-4 opacity-20"></i>
                <p class="font-bold">Tidak ada key yang sesuai filter</p>
            </div>`;
        return;
    }

    listContainer.innerHTML = keys.map((key, index) => {
        const fullKey = typeof key === 'object' ? (key.key || '') : key;
        const status = typeof key === 'object' ? (key.status || 'active') : 'active';
        const displayKey = fullKey.length > 20 ? fullKey.substring(0, 10) + '...' + fullKey.substring(fullKey.length - 8) : fullKey;
        const provider = detectProviderFromKey(fullKey);
        const isExhausted = status === 'exhausted';

        return `
            <div class="bg-white border ${isExhausted ? 'border-red-100 bg-red-50/10' : 'border-slate-100'} rounded-2xl p-4 flex items-center justify-between group transition-all hover:shadow-md">
                <div class="flex items-center gap-4">
                    <div class="w-10 h-10 ${isExhausted ? 'bg-red-100 text-red-600' : 'bg-sky-100 text-sky-600'} rounded-xl flex items-center justify-center text-lg">
                        <i class="fas ${provider.includes('Gemini') ? 'fa-gem' : (provider.includes('ChatGPT') ? 'fa-robot' : 'fa-key')}"></i>
                    </div>
                    <div>
                        <div class="flex items-center gap-2 mb-1">
                            <span class="text-xs font-black text-slate-800">${provider}</span>
                            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${isExhausted ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'} uppercase tracking-tight">
                                ${isExhausted ? 'Habis' : 'Aktif'}
                            </span>
                        </div>
                        <p class="text-xs font-mono text-slate-500">${displayKey}</p>
                    </div>
                </div>
                <div class="flex items-center gap-2">
                    <button onclick="removeTeacherAPIKey(${index})" class="w-9 h-9 flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all" title="Hapus Key">
                        <i class="fas fa-trash-alt text-sm"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

async function renderGlobalAPIKeys() {
    const container = document.getElementById('global-api-keys-list');
    if (!container) return;
    console.log('renderGlobalAPIKeys called');
    // Minimal implementation - if needed, fetch and render global API keys
    try {
        const response = await fetch(getApiBaseUrl() + '/api/teacher/global-api-keys');
        const result = await response.json();
        console.log('Global API keys loaded:', result);
        if (result.ok && result.globalKeys && result.globalKeys.length > 0) {
            updateGlobalApiKeysStats(result.globalKeys);
        }
    } catch (err) {
        console.error('Error loading global API keys:', err);
    }
}

function toggleGlobalAPIKeysList() {
    const list = document.getElementById('global-api-keys-list');
    const icon = document.getElementById('global-api-keys-toggle-icon');

    if (!list || !icon) return;

    const isHidden = list.classList.contains('hidden');

    if (isHidden) {
        list.classList.remove('hidden');
        icon.style.transform = 'rotate(180deg)';
        // Load the list if it's empty (first time opening)
        if (list.children.length === 0 || list.querySelector('.fa-loader')) {
            renderGlobalAPIKeys();
        }
    } else {
        list.classList.add('hidden');
        icon.style.transform = 'rotate(0deg)';
    }
}


// === UNCLAIMED TOP LEVEL LINES & HEADERS ===
// ─── Quill Rich Text Editor Helpers ────────────────────────────────────────
window._quillQuestion = null;
window._quillAnswer = null;
window._quillQuizz = null;
// ─────────────────────────────────────────────────────────────────────────────




















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
window.removeTeacherAPIKey = removeTeacherAPIKey;

// Stub helper functions for API key management







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


