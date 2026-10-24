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

async function fetchJsonWithTimeout(url, options = {}, timeoutMs = 7000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
        return await fetch(url, { ...options, signal: controller.signal });
    } catch (error) {
        if (error && error.name === 'AbortError') {
            throw new Error(`Request timeout after ${timeoutMs}ms: ${url}`);
        }
        throw error;
    } finally {
        clearTimeout(timer);
    }
}

window.fetchJsonWithTimeout = fetchJsonWithTimeout;

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

// Question form state (used by guru/admin modules)
let currentQType = 'single';
let activeCorrect = 0;
let activeCorrectMultiple = [];
window.currentQType = currentQType;
window.activeCorrect = activeCorrect;
window.activeCorrectMultiple = activeCorrectMultiple;

const loadedCollections = {
    questions: false,
    students: false,
    results: false
};

let _hasLoadedFlags = { questions: false, students: false, results: false };
let _inFlightLoads = {};

async function ensureDataLoaded(type, force = false, silent = false) {
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

    // Deduplicate in-flight requests to prevent concurrent redundant fetches
    if (_inFlightLoads[type]) {
        return _inFlightLoads[type];
    }

    _inFlightLoads[type] = (async () => {
        console.log(`[LAZY-LOAD] Fetching ${type} on-demand...`);
        if (!silent && typeof showToast === 'function') {
            showToast(`Memuat data ${type}...`, 'info');
        }

        try {
            let res;
            if (type === 'questions') {
                res = await fetchJsonWithTimeout(getApiBaseUrl() + '/api/questions?limit=-1', {}, 12000);
                if (res.ok) {
                    const data = await res.json();
                    db.questions = Array.isArray(data.items) ? data.items : (Array.isArray(data) ? data : []);
                    _hasLoadedFlags.questions = true;
                }
            } else if (type === 'students') {
                res = await fetchJsonWithTimeout(getApiBaseUrl() + '/api/students', {}, 12000);
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
                res = await fetchJsonWithTimeout(getApiBaseUrl() + '/api/results?limit=-1', {}, 15000);
                if (res.ok) {
                    const data = await res.json();
                    const serverResults = Array.isArray(data.items) ? data.items : (Array.isArray(data) ? data : []);
                    db.results = mergeResults(db.results, serverResults);
                    _hasLoadedFlags.results = true;
                }
            }

            if (loadedCollections.hasOwnProperty(type)) {
                loadedCollections[type] = true;
            }

            console.log(`[LAZY-LOAD] ✅ ${type} loaded:`, db[type]?.length);
        } catch (e) {
            console.warn(`[LAZY-LOAD] Failed to load ${type}:`, e.message);
        } finally {
            delete _inFlightLoads[type];
        }
    })();

    return _inFlightLoads[type];
}
window.ensureDataLoaded = ensureDataLoaded;

function mergeResults(localArr = [], serverArr = []) {
    const map = new Map();
    const norm = v => String(v || '').trim().toLowerCase();
    const makeKey = r => {
        if (!r || typeof r !== 'object') return JSON.stringify(r);
        const sid = norm(r.studentId || r.student_id);
        const mapel = norm(r.mapel);
        const rombel = norm(r.rombel);
        if (sid && mapel) {
            return `${sid}|${mapel}|${rombel}`;
        }
        if (r.id) return String(r.id);
        return `${sid || 'unknown'}-${mapel || 'unknown'}-${rombel || 'unknown'}-${r.date || ''}`;
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

        // equal timestamp: merge incoming server properties (e.g. server id) into existing record
        map.set(key, Object.assign({}, existing, r));
    });
    return Array.from(map.values());
}
window.mergeResults = mergeResults;

async function fetchAndMerge() {
    try {
        await ensureDataLoaded('results', true, true);
        if (document.getElementById('results-table-body') || (document.getElementById('admin-results') && !document.getElementById('admin-results').classList.contains('hidden'))) {
            if (typeof renderAdminResults === 'function') renderAdminResults();
        }
        if (document.getElementById('teacher-results-table-body') || (document.getElementById('teacher-dashboard') && !document.getElementById('teacher-dashboard').classList.contains('hidden'))) {
            if (typeof renderTeacherResults === 'function') renderTeacherResults();
        }
    } catch (e) {
        console.warn('[fetchAndMerge] Error polling results:', e.message || e);
    }
}
window.fetchAndMerge = fetchAndMerge;

function deleteResult(idx) {
    if (!confirm('Hapus hasil ujian ini?')) return;
    if (!db.results[idx]) return;
    db.results[idx].deleted = true;
    db.results[idx].updatedAt = Date.now();
    if (typeof updateCompletionCharts === 'function') updateCompletionCharts();
    
    if (typeof adminSyncState !== 'undefined' && adminSyncState.isAdminMode) {
        if (typeof adminSave === 'function') adminSave();
        if (typeof markAdminChanges === 'function') markAdminChanges();
    } else if (typeof save === 'function') {
        save();
    }

    if (document.getElementById('results-table-body')) {
        if (typeof renderAdminResults === 'function') renderAdminResults();
    }
    if (document.getElementById('teacher-results-table-body')) {
        if (typeof renderTeacherResults === 'function') renderTeacherResults();
    }
}
window.deleteResult = deleteResult;

// Render/update correct-answer buttons in question modal
function renderCorrectButtons() {
    document.querySelectorAll('.c-btn').forEach((b, i) => {
        let selected = false;
        if (currentQType === 'multiple') {
            selected = Array.isArray(activeCorrectMultiple) && activeCorrectMultiple.includes(i);
        } else {
            selected = activeCorrect === i;
        }
        b.className = selected ? 'c-btn flex-1 py-3 border-2 border-sky-600 bg-sky-50 text-sky-600 font-bold rounded-xl' : 'c-btn flex-1 py-3 border-2 border-slate-100 text-slate-400 font-bold rounded-xl';
    });
}
window.renderCorrectButtons = renderCorrectButtons;

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
window.setActiveCorrect = setActiveCorrect;

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
window.uploadImageToServer = uploadImageToServer;

async function addImageUrl() {
    const urlInput = document.getElementById('q-image-url');
    if (!urlInput) return;

    const url = urlInput.value.trim();
    if (!url) return;

    if (!window.storedImages) window.storedImages = [];

    if (url.startsWith('data:image')) {
        if (typeof showToast === 'function') showToast('Mengunggah data gambar...', 'info');
        try {
            const compressed = await compressImage(url);
            const cloudUrl = await uploadImageToServer(compressed, 'pasted-image.jpg');
            window.storedImages.push(cloudUrl);
            if (typeof showToast === 'function') showToast('Gambar berhasil diunggah ke cloud', 'success');
        } catch (err) {
            console.error('Failed to upload pasted image:', err);
            if (typeof showToast === 'function') showToast('Gagal upload ke cloud: ' + (err.message || err), 'error');
            window.storedImages.push(url);
        }
    } else {
        window.storedImages.push(url);
    }

    urlInput.value = '';
    renderImagePreviews();
}
window.addImageUrl = addImageUrl;

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

        img.onerror = () => resolve(base64Str);
    });
}
window.compressImage = compressImage;

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

// Question form state (used by guru/admin modules)
let currentQType = 'single';
let activeCorrect = 0;
let activeCorrectMultiple = [];
window.currentQType = currentQType;
window.activeCorrect = activeCorrect;
window.activeCorrectMultiple = activeCorrectMultiple;

const loadedCollections = {
    questions: false,
    students: false,
    results: false
};

let _hasLoadedFlags = { questions: false, students: false, results: false };
let _inFlightLoads = {};

async function ensureDataLoaded(type, force = false, silent = false) {
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

    // Deduplicate in-flight requests to prevent concurrent redundant fetches
    if (_inFlightLoads[type]) {
        return _inFlightLoads[type];
    }

    _inFlightLoads[type] = (async () => {
        console.log(`[LAZY-LOAD] Fetching ${type} on-demand...`);
        if (!silent && typeof showToast === 'function') {
            showToast(`Memuat data ${type}...`, 'info');
        }

        try {
            let res;
            if (type === 'questions') {
                res = await fetchJsonWithTimeout(getApiBaseUrl() + '/api/questions?limit=-1', {}, 12000);
                if (res.ok) {
                    const data = await res.json();
                    db.questions = Array.isArray(data.items) ? data.items : (Array.isArray(data) ? data : []);
                    _hasLoadedFlags.questions = true;
                }
            } else if (type === 'students') {
                res = await fetchJsonWithTimeout(getApiBaseUrl() + '/api/students', {}, 12000);
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
                res = await fetchJsonWithTimeout(getApiBaseUrl() + '/api/results?limit=-1', {}, 15000);
                if (res.ok) {
                    const data = await res.json();
                    const serverResults = Array.isArray(data.items) ? data.items : (Array.isArray(data) ? data : []);
                    db.results = mergeResults(db.results, serverResults);
                    _hasLoadedFlags.results = true;
                }
            }

            if (loadedCollections.hasOwnProperty(type)) {
                loadedCollections[type] = true;
            }

            console.log(`[LAZY-LOAD] ✅ ${type} loaded:`, db[type]?.length);
        } catch (e) {
            console.warn(`[LAZY-LOAD] Failed to load ${type}:`, e.message);
        } finally {
            delete _inFlightLoads[type];
        }
    })();

    return _inFlightLoads[type];
}
window.ensureDataLoaded = ensureDataLoaded;

function mergeResults(localArr = [], serverArr = []) {
    const map = new Map();
    const norm = v => String(v || '').trim().toLowerCase();
    const makeKey = r => {
        if (!r || typeof r !== 'object') return JSON.stringify(r);
        const sid = norm(r.studentId || r.student_id);
        const mapel = norm(r.mapel);
        const rombel = norm(r.rombel);
        if (sid && mapel) {
            return `${sid}|${mapel}|${rombel}`;
        }
        if (r.id) return String(r.id);
        return `${sid || 'unknown'}-${mapel || 'unknown'}-${rombel || 'unknown'}-${r.date || ''}`;
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

        // equal timestamp: merge incoming server properties (e.g. server id) into existing record
        map.set(key, Object.assign({}, existing, r));
    });
    return Array.from(map.values());
}
window.mergeResults = mergeResults;

async function fetchAndMerge() {
    try {
        await ensureDataLoaded('results', true, true);
        if (document.getElementById('results-table-body') || (document.getElementById('admin-results') && !document.getElementById('admin-results').classList.contains('hidden'))) {
            if (typeof renderAdminResults === 'function') renderAdminResults();
        }
        if (document.getElementById('teacher-results-table-body') || (document.getElementById('teacher-dashboard') && !document.getElementById('teacher-dashboard').classList.contains('hidden'))) {
            if (typeof renderTeacherResults === 'function') renderTeacherResults();
        }
    } catch (e) {
        console.warn('[fetchAndMerge] Error polling results:', e.message || e);
    }
}
window.fetchAndMerge = fetchAndMerge;

function deleteResult(idx) {
    if (!confirm('Hapus hasil ujian ini?')) return;
    if (!db.results[idx]) return;
    db.results[idx].deleted = true;
    db.results[idx].updatedAt = Date.now();
    if (typeof updateCompletionCharts === 'function') updateCompletionCharts();
    
    if (typeof adminSyncState !== 'undefined' && adminSyncState.isAdminMode) {
        if (typeof adminSave === 'function') adminSave();
        if (typeof markAdminChanges === 'function') markAdminChanges();
    } else if (typeof save === 'function') {
        save();
    }

    if (document.getElementById('results-table-body')) {
        if (typeof renderAdminResults === 'function') renderAdminResults();
    }
    if (document.getElementById('teacher-results-table-body')) {
        if (typeof renderTeacherResults === 'function') renderTeacherResults();
    }
}
window.deleteResult = deleteResult;

// Render/update correct-answer buttons in question modal
function renderCorrectButtons() {
    document.querySelectorAll('.c-btn').forEach((b, i) => {
        let selected = false;
        if (currentQType === 'multiple') {
            selected = Array.isArray(activeCorrectMultiple) && activeCorrectMultiple.includes(i);
        } else {
            selected = activeCorrect === i;
        }
        b.className = selected ? 'c-btn flex-1 py-3 border-2 border-sky-600 bg-sky-50 text-sky-600 font-bold rounded-xl' : 'c-btn flex-1 py-3 border-2 border-slate-100 text-slate-400 font-bold rounded-xl';
    });
}
window.renderCorrectButtons = renderCorrectButtons;

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
window.setActiveCorrect = setActiveCorrect;

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
window.uploadImageToServer = uploadImageToServer;

async function addImageUrl() {
    const urlInput = document.getElementById('q-image-url');
    if (!urlInput) return;

    const url = urlInput.value.trim();
    if (!url) return;

    if (!window.storedImages) window.storedImages = [];

    if (url.startsWith('data:image')) {
        if (typeof showToast === 'function') showToast('Mengunggah data gambar...', 'info');
        try {
            const compressed = await compressImage(url);
            const cloudUrl = await uploadImageToServer(compressed, 'pasted-image.jpg');
            window.storedImages.push(cloudUrl);
            if (typeof showToast === 'function') showToast('Gambar berhasil diunggah ke cloud', 'success');
        } catch (err) {
            console.error('Failed to upload pasted image:', err);
            if (typeof showToast === 'function') showToast('Gagal upload ke cloud: ' + (err.message || err), 'error');
            window.storedImages.push(url);
        }
    } else {
        window.storedImages.push(url);
    }

    urlInput.value = '';
    renderImagePreviews();
}
window.addImageUrl = addImageUrl;

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

        img.onerror = () => resolve(base64Str);
    });
}
window.compressImage = compressImage;

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

// Question form state (used by guru/admin modules)
let currentQType = 'single';
let activeCorrect = 0;
let activeCorrectMultiple = [];
window.currentQType = currentQType;
window.activeCorrect = activeCorrect;
window.activeCorrectMultiple = activeCorrectMultiple;

const loadedCollections = {
    questions: false,
    students: false,
    results: false
};

let _hasLoadedFlags = { questions: false, students: false, results: false };
let _inFlightLoads = {};

async function ensureDataLoaded(type, force = false, silent = false) {
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

    // Deduplicate in-flight requests to prevent concurrent redundant fetches
    if (_inFlightLoads[type]) {
        return _inFlightLoads[type];
    }

    _inFlightLoads[type] = (async () => {
        console.log(`[LAZY-LOAD] Fetching ${type} on-demand...`);
        if (!silent && typeof showToast === 'function') {
            showToast(`Memuat data ${type}...`, 'info');
        }

        try {
            let res;
            if (type === 'questions') {
                res = await fetchJsonWithTimeout(getApiBaseUrl() + '/api/questions?limit=-1', {}, 12000);
                if (res.ok) {
                    const data = await res.json();
                    db.questions = Array.isArray(data.items) ? data.items : (Array.isArray(data) ? data : []);
                    _hasLoadedFlags.questions = true;
                }
            } else if (type === 'students') {
                res = await fetchJsonWithTimeout(getApiBaseUrl() + '/api/students', {}, 12000);
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
                res = await fetchJsonWithTimeout(getApiBaseUrl() + '/api/results?limit=-1', {}, 15000);
                if (res.ok) {
                    const data = await res.json();
                    const serverResults = Array.isArray(data.items) ? data.items : (Array.isArray(data) ? data : []);
                    db.results = mergeResults(db.results, serverResults);
                    _hasLoadedFlags.results = true;
                }
            }

            if (loadedCollections.hasOwnProperty(type)) {
                loadedCollections[type] = true;
            }

            console.log(`[LAZY-LOAD] ✅ ${type} loaded:`, db[type]?.length);
        } catch (e) {
            console.warn(`[LAZY-LOAD] Failed to load ${type}:`, e.message);
        } finally {
            delete _inFlightLoads[type];
        }
    })();

    return _inFlightLoads[type];
}
window.ensureDataLoaded = ensureDataLoaded;

function mergeResults(localArr = [], serverArr = []) {
    const map = new Map();
    const norm = v => String(v || '').trim().toLowerCase();
    const makeKey = r => {
        if (!r || typeof r !== 'object') return JSON.stringify(r);
        const sid = norm(r.studentId || r.student_id);
        const mapel = norm(r.mapel);
        const rombel = norm(r.rombel);
        if (sid && mapel) {
            return `${sid}|${mapel}|${rombel}`;
        }
        if (r.id) return String(r.id);
        return `${sid || 'unknown'}-${mapel || 'unknown'}-${rombel || 'unknown'}-${r.date || ''}`;
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

        // equal timestamp: merge incoming server properties (e.g. server id) into existing record
        map.set(key, Object.assign({}, existing, r));
    });
    return Array.from(map.values());
}
window.mergeResults = mergeResults;

async function fetchAndMerge() {
    try {
        await ensureDataLoaded('results', true, true);
        if (document.getElementById('results-table-body') || (document.getElementById('admin-results') && !document.getElementById('admin-results').classList.contains('hidden'))) {
            if (typeof renderAdminResults === 'function') renderAdminResults();
        }
        if (document.getElementById('teacher-results-table-body') || (document.getElementById('teacher-dashboard') && !document.getElementById('teacher-dashboard').classList.contains('hidden'))) {
            if (typeof renderTeacherResults === 'function') renderTeacherResults();
        }
    } catch (e) {
        console.warn('[fetchAndMerge] Error polling results:', e.message || e);
    }
}
window.fetchAndMerge = fetchAndMerge;

function deleteResult(idx) {
    if (!confirm('Hapus hasil ujian ini?')) return;
    if (!db.results[idx]) return;
    db.results[idx].deleted = true;
    db.results[idx].updatedAt = Date.now();
    if (typeof updateCompletionCharts === 'function') updateCompletionCharts();
    
    if (typeof adminSyncState !== 'undefined' && adminSyncState.isAdminMode) {
        if (typeof adminSave === 'function') adminSave();
        if (typeof markAdminChanges === 'function') markAdminChanges();
    } else if (typeof save === 'function') {
        save();
    }

    if (document.getElementById('results-table-body')) {
        if (typeof renderAdminResults === 'function') renderAdminResults();
    }
    if (document.getElementById('teacher-results-table-body')) {
        if (typeof renderTeacherResults === 'function') renderTeacherResults();
    }
}
window.deleteResult = deleteResult;

// Render/update correct-answer buttons in question modal
function renderCorrectButtons() {
    document.querySelectorAll('.c-btn').forEach((b, i) => {
        let selected = false;
        if (currentQType === 'multiple') {
            selected = Array.isArray(activeCorrectMultiple) && activeCorrectMultiple.includes(i);
        } else {
            selected = activeCorrect === i;
        }
        b.className = selected ? 'c-btn flex-1 py-3 border-2 border-sky-600 bg-sky-50 text-sky-600 font-bold rounded-xl' : 'c-btn flex-1 py-3 border-2 border-slate-100 text-slate-400 font-bold rounded-xl';
    });
}
window.renderCorrectButtons = renderCorrectButtons;

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
window.setActiveCorrect = setActiveCorrect;

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
window.uploadImageToServer = uploadImageToServer;

async function addImageUrl() {
    const urlInput = document.getElementById('q-image-url');
    if (!urlInput) return;

    const url = urlInput.value.trim();
    if (!url) return;

    if (!window.storedImages) window.storedImages = [];

    if (url.startsWith('data:image')) {
        if (typeof showToast === 'function') showToast('Mengunggah data gambar...', 'info');
        try {
            const compressed = await compressImage(url);
            const cloudUrl = await uploadImageToServer(compressed, 'pasted-image.jpg');
            window.storedImages.push(cloudUrl);
            if (typeof showToast === 'function') showToast('Gambar berhasil diunggah ke cloud', 'success');
        } catch (err) {
            console.error('Failed to upload pasted image:', err);
            if (typeof showToast === 'function') showToast('Gagal upload ke cloud: ' + (err.message || err), 'error');
            window.storedImages.push(url);
        }
    } else {
        window.storedImages.push(url);
    }

    urlInput.value = '';
    renderImagePreviews();
}
window.addImageUrl = addImageUrl;

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

        img.onerror = () => resolve(base64Str);
    });
}
window.compressImage = compressImage;

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

// Question form state (used by guru/admin modules)
let currentQType = 'single';
let activeCorrect = 0;
let activeCorrectMultiple = [];
window.currentQType = currentQType;
window.activeCorrect = activeCorrect;
window.activeCorrectMultiple = activeCorrectMultiple;

const loadedCollections = {
    questions: false,
    students: false,
    results: false
};

let _hasLoadedFlags = { questions: false, students: false, results: false };
let _inFlightLoads = {};

async function ensureDataLoaded(type, force = false, silent = false) {
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

    // Deduplicate in-flight requests to prevent concurrent redundant fetches
    if (_inFlightLoads[type]) {
        return _inFlightLoads[type];
    }

    _inFlightLoads[type] = (async () => {
        console.log(`[LAZY-LOAD] Fetching ${type} on-demand...`);
        if (!silent && typeof showToast === 'function') {
            showToast(`Memuat data ${type}...`, 'info');
        }

        try {
            let res;
            if (type === 'questions') {
                res = await fetchJsonWithTimeout(getApiBaseUrl() + '/api/questions?limit=-1', {}, 12000);
                if (res.ok) {
                    const data = await res.json();
                    db.questions = Array.isArray(data.items) ? data.items : (Array.isArray(data) ? data : []);
                    _hasLoadedFlags.questions = true;
                }
            } else if (type === 'students') {
                res = await fetchJsonWithTimeout(getApiBaseUrl() + '/api/students', {}, 12000);
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
                res = await fetchJsonWithTimeout(getApiBaseUrl() + '/api/results?limit=-1', {}, 15000);
                if (res.ok) {
                    const data = await res.json();
                    const serverResults = Array.isArray(data.items) ? data.items : (Array.isArray(data) ? data : []);
                    db.results = mergeResults(db.results, serverResults);
                    _hasLoadedFlags.results = true;
                }
            }

            if (loadedCollections.hasOwnProperty(type)) {
                loadedCollections[type] = true;
            }

            console.log(`[LAZY-LOAD] ✅ ${type} loaded:`, db[type]?.length);
        } catch (e) {
            console.warn(`[LAZY-LOAD] Failed to load ${type}:`, e.message);
        } finally {
            delete _inFlightLoads[type];
        }
    })();

    return _inFlightLoads[type];
}
window.ensureDataLoaded = ensureDataLoaded;

function mergeResults(localArr = [], serverArr = []) {
    const map = new Map();
    const norm = v => String(v || '').trim().toLowerCase();
    const makeKey = r => {
        if (!r || typeof r !== 'object') return JSON.stringify(r);
        const sid = norm(r.studentId || r.student_id);
        const mapel = norm(r.mapel);
        const rombel = norm(r.rombel);
        if (sid && mapel) {
            return `${sid}|${mapel}|${rombel}`;
        }
        if (r.id) return String(r.id);
        return `${sid || 'unknown'}-${mapel || 'unknown'}-${rombel || 'unknown'}-${r.date || ''}`;
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

        // equal timestamp: merge incoming server properties (e.g. server id) into existing record
        map.set(key, Object.assign({}, existing, r));
    });
    return Array.from(map.values());
}
window.mergeResults = mergeResults;

async function fetchAndMerge() {
    try {
        await ensureDataLoaded('results', true, true);
        if (document.getElementById('results-table-body') || (document.getElementById('admin-results') && !document.getElementById('admin-results').classList.contains('hidden'))) {
            if (typeof renderAdminResults === 'function') renderAdminResults();
        }
        if (document.getElementById('teacher-results-table-body') || (document.getElementById('teacher-dashboard') && !document.getElementById('teacher-dashboard').classList.contains('hidden'))) {
            if (typeof renderTeacherResults === 'function') renderTeacherResults();
        }
    } catch (e) {
        console.warn('[fetchAndMerge] Error polling results:', e.message || e);
    }
}
window.fetchAndMerge = fetchAndMerge;

function deleteResult(idx) {
    if (!confirm('Hapus hasil ujian ini?')) return;
    if (!db.results[idx]) return;
    db.results[idx].deleted = true;
    db.results[idx].updatedAt = Date.now();
    if (typeof updateCompletionCharts === 'function') updateCompletionCharts();
    
    if (typeof adminSyncState !== 'undefined' && adminSyncState.isAdminMode) {
        if (typeof adminSave === 'function') adminSave();
        if (typeof markAdminChanges === 'function') markAdminChanges();
    } else if (typeof save === 'function') {
        save();
    }

    if (document.getElementById('results-table-body')) {
        if (typeof renderAdminResults === 'function') renderAdminResults();
    }
    if (document.getElementById('teacher-results-table-body')) {
        if (typeof renderTeacherResults === 'function') renderTeacherResults();
    }
}
window.deleteResult = deleteResult;

// Render/update correct-answer buttons in question modal
function renderCorrectButtons() {
    document.querySelectorAll('.c-btn').forEach((b, i) => {
        let selected = false;
        if (currentQType === 'multiple') {
            selected = Array.isArray(activeCorrectMultiple) && activeCorrectMultiple.includes(i);
        } else {
            selected = activeCorrect === i;
        }
        b.className = selected ? 'c-btn flex-1 py-3 border-2 border-sky-600 bg-sky-50 text-sky-600 font-bold rounded-xl' : 'c-btn flex-1 py-3 border-2 border-slate-100 text-slate-400 font-bold rounded-xl';
    });
}
window.renderCorrectButtons = renderCorrectButtons;

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
window.setActiveCorrect = setActiveCorrect;

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
window.uploadImageToServer = uploadImageToServer;

async function addImageUrl() {
    const urlInput = document.getElementById('q-image-url');
    if (!urlInput) return;

    const url = urlInput.value.trim();
    if (!url) return;

    if (!window.storedImages) window.storedImages = [];

    if (url.startsWith('data:image')) {
        if (typeof showToast === 'function') showToast('Mengunggah data gambar...', 'info');
        try {
            const compressed = await compressImage(url);
            const cloudUrl = await uploadImageToServer(compressed, 'pasted-image.jpg');
            window.storedImages.push(cloudUrl);
            if (typeof showToast === 'function') showToast('Gambar berhasil diunggah ke cloud', 'success');
        } catch (err) {
            console.error('Failed to upload pasted image:', err);
            if (typeof showToast === 'function') showToast('Gagal upload ke cloud: ' + (err.message || err), 'error');
            window.storedImages.push(url);
        }
    } else {
        window.storedImages.push(url);
    }

    urlInput.value = '';
    renderImagePreviews();
}
window.addImageUrl = addImageUrl;

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

        img.onerror = () => resolve(base64Str);
    });
}
window.compressImage = compressImage;

// ...existing code...

// ========================================================
// API KEYS - POLLING VARIABLES & FUNCTIONS
// ========================================================

let apiKeysStatsPollingInterval = null;
const STATS_POLLING_INTERVAL = 3000; // 3 detik

function detectProviderFromKey(key) {
    if (!key) return 'Unknown';
    if (key.startsWith('AIzaSy')) return 'Google Gemini';
    if (key.startsWith('sk-or-v1-') || key.startsWith('sk-or-')) return 'OpenRouter';
    if (key.startsWith('sk-')) return 'OpenAI (ChatGPT)';
    if (key.startsWith('gsk_')) return 'Groq';
    if (key.includes('deepseek')) return 'DeepSeek';
    return 'Other Provider';
}
window.detectProviderFromKey = detectProviderFromKey;

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

    const btn = (window.event && window.event.target) ? window.event.target : null;
    const originalText = btn ? btn.innerHTML : '';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memproses...';
    }

    fetch(getApiBaseUrl() + '/api/teacher/add-api-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teacherId: currentSiswa.id, apiKey: apiKey })
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

            if (typeof save === 'function') save();
            input.value = '';
            input.type = 'password';
            if (typeof renderTeacherAPIKeys === 'function') renderTeacherAPIKeys();
            if (typeof updateRealtimeStats === 'function') updateRealtimeStats();

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
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = originalText;
            }
        });
}
window.addTeacherAPIKeyForm = addTeacherAPIKeyForm;

function removeTeacherAPIKey(index) {
    if (!confirm('Apakah Anda yakin ingin menghapus API Key ini?')) return;

    if (!currentSiswa || currentSiswa.role !== 'teacher') {
        alert('Hanya guru yang dapat menghapus API Key');
        return;
    }

    fetch(getApiBaseUrl() + '/api/teacher/remove-api-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teacherId: currentSiswa.id, keyIndex: index })
    })
        .then(res => res.json())
        .then(data => {
            if (!data.ok) {
                showToast(data.error || 'Gagal menghapus API Key', 'error');
                return;
            }
            if (Array.isArray(currentSiswa.apiKeys)) {
                currentSiswa.apiKeys.splice(index, 1);
            }
            if (typeof save === 'function') save();
            if (typeof renderTeacherAPIKeys === 'function') renderTeacherAPIKeys();
            if (typeof updateRealtimeStats === 'function') updateRealtimeStats();
            showToast('✅ API Key berhasil dihapus!', 'success');
        })
        .catch(err => {
            console.error('Remove API Key Error:', err);
            showToast('Terjadi kesalahan: ' + err.message, 'error');
        });
}
window.removeTeacherAPIKey = removeTeacherAPIKey;

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
window.toggleNewKeyVisibility = toggleNewKeyVisibility;

async function renderTeacherAPIKeys() {
    const listContainer = document.getElementById('api-keys-list');
    if (!listContainer) return;

    if (!currentSiswa || !Array.isArray(currentSiswa.apiKeys)) {
        listContainer.innerHTML = `
            <div class="text-center py-12 text-slate-400">
                <i class="fas fa-circle-notch fa-spin text-4xl mb-4 opacity-20"></i>
                <p class="font-bold">Memuat daftar API Key...</p>
            </div>`;
        if (typeof syncTeacherAPIKeysFromServer === 'function') {
            await syncTeacherAPIKeysFromServer();
        }
    }

    if (!currentSiswa || !Array.isArray(currentSiswa.apiKeys)) {
        listContainer.innerHTML = `
            <div class="text-center py-12 text-slate-400">
                <i class="fas fa-key text-4xl mb-4 opacity-20"></i>
                <p class="font-bold">Belum ada API Key pribadi</p>
                <p class="text-xs">Gunakan form di atas untuk menambahkan key Gemini atau ChatGPT.</p>
            </div>`;
        if (typeof updateTeacherApiKeysStats === 'function') updateTeacherApiKeysStats([]);
        return;
    }

    const filter = document.getElementById('api-keys-filter')?.value || 'all';
    let keys = currentSiswa.apiKeys;

    if (typeof updateTeacherApiKeysStats === 'function') updateTeacherApiKeysStats(currentSiswa.apiKeys);

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
window.renderTeacherAPIKeys = renderTeacherAPIKeys;

function toggleMobileMenu() {
    const menu = document.getElementById('mobile-menu');
    if (menu) menu.classList.toggle('hidden');
}
window.toggleMobileMenu = toggleMobileMenu;

// ========================================================
// TEACHER HELPER FUNCTIONS
// ========================================================

function teacherSubjectNames(teacher) {
    if (!teacher) return [];
    if (teacher.role === 'admin') {
        return (db.subjects || []).map(s => typeof s === 'string' ? s : s.name);
    }
    if (!Array.isArray(teacher.subjects)) return [];
    return teacher.subjects.map(s => typeof s === 'string' ? s : s.name);
}
window.teacherSubjectNames = teacherSubjectNames;

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
window.teacherAllowedRombels = teacherAllowedRombels;

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
window.teacherCombinedRombels = teacherCombinedRombels;

function toggleTeacherSelectAll(event) {
    const checked = event.target.checked;
    const selectedSubject = document.getElementById('teacher-filter-mapel')?.value || '';
    const selectedRombel = document.getElementById('teacher-filter-rombel')?.value || '';
    let list = db.questions.filter(q => {
        const qSubject = typeof q.mapel === 'string' ? q.mapel : q.mapel?.name || q.mapel;
        if (!teacherSubjectNames(currentSiswa).includes(qSubject)) return false;
        const allowed = teacherAllowedRombels(currentSiswa, qSubject);
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
    if (typeof renderTeacherQuestions === 'function') renderTeacherQuestions();
}
window.toggleTeacherSelectAll = toggleTeacherSelectAll;

// ========================================================
// AI TYPE COUNTS
// ========================================================

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
window.getAiTypeCounts = getAiTypeCounts;

// ========================================================
// EXPORT QUESTIONS
// ========================================================

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
        const fR = document.getElementById('filter-rombel')?.value || '';
        const fM = document.getElementById('filter-mapel')?.value || '';
        questionsToExport = db.questions.filter(q =>
            (!fR || fR === 'ALL' || q.rombel === fR) && (!fM || fM === 'ALL' || q.mapel === fM)
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
window.exportQuestions = exportQuestions;