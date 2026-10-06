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

// Delete question from local DB and re-render lists
function deleteQuestion(idx) {
    if (!confirm('Hapus soal?')) return;
    loadedCollections.questions = true;
    if (!Array.isArray(db.questions) || idx < 0 || idx >= db.questions.length) return;
    db.questions.splice(idx, 1);
    if (typeof save === 'function') save();
    if (window.isTeacherMode || (currentSiswa && currentSiswa.role === 'teacher')) {
        if (typeof renderTeacherQuestions === 'function') renderTeacherQuestions();
    } else if (typeof renderAdminQuestions === 'function') {
        renderAdminQuestions();
    }
}
window.deleteQuestion = deleteQuestion;

function clearResultsFilter() {
    const f = document.getElementById('results-date-from');
    const t = document.getElementById('results-date-to');
    if (f) f.value = '';
    if (t) t.value = '';
    if (typeof renderAdminResults === 'function') renderAdminResults();
}
window.clearResultsFilter = clearResultsFilter;

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

    if (typeof adminSyncState !== 'undefined' && adminSyncState.isAdminMode) {
        if (typeof adminSave === 'function') adminSave();
        if (typeof markAdminChanges === 'function') markAdminChanges();
    } else if (typeof save === 'function') {
        save();
    }

    if (typeof updateCompletionCharts === 'function') updateCompletionCharts();
    if (typeof renderAdminResults === 'function') renderAdminResults();

    if (typeof adminSyncState !== 'undefined' && adminSyncState.isAdminMode) {
        alert('Semua hasil ujian telah dihapus secara lokal. Klik tombol Sinkron di kanan bawah untuk menyimpan ke server.');
    } else {
        alert('Semua hasil ujian telah dihapus secara permanen.');
    }
}
window.clearAllResults = clearAllResults;

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
        if (typeof adminSave === 'function') adminSave();
        if (typeof markAdminChanges === 'function') markAdminChanges();
    } else if (typeof save === 'function') {
        save();
    }

    if (typeof updateCompletionCharts === 'function') updateCompletionCharts();
    if (typeof renderAdminResults === 'function') renderAdminResults();

    if (typeof adminSyncState !== 'undefined' && adminSyncState.isAdminMode) {
        alert(`✅ ${incompleteResults.length} hasil ujian yang tidak lengkap telah dihapus secara lokal. Klik tombol Sinkron di kanan bawah untuk menyimpan ke server.`);
    } else {
        alert(`✅ ${incompleteResults.length} hasil ujian yang tidak lengkap telah dihapus.`);
    }
}
window.cleanIncompleteResults = cleanIncompleteResults;

function viewDetailedResult(idx) {
    const result = db.results[idx];
    if (!result || result.deleted) {
        alert('Hasil ujian tidak ditemukan atau sudah dihapus.');
        return;
    }

    const questions = Array.isArray(result.questions) ? result.questions : [];
    const answers = Array.isArray(result.answers) ? result.answers : [];

    if (result.isIncomplete) {
        const msg = `⚠️ Data Tidak Lengkap\n\nHasil ujian untuk "${result.studentName}" tidak memiliki struktur data yang lengkap.\n\nInfo yang tersedia:\n- Soal: ${questions.length} soal\n- Jawaban: Tidak tersimpan\n- Skor: Belum dihitung\n\nOpsi:\n1. Tunggu sinkronisasi server\n2. Hapus hasil ini dan minta siswa mengulang ujian`;
        alert(msg);
        return;
    }

    if (questions.length === 0) {
        alert('❌ Data Soal Tidak Tersedia\n\nUntuk hasil ujian ini tidak ditemukan data soal yang lengkap. Kemungkinan:\n1. Data rusak atau tidak tersimpan dengan sempurna\n2. Ujian belum selesai disimpan\n3. Ada masalah saat sinkronisasi\n\nSilakan hapus hasil ini dan minta siswa mengulang ujian.');
        return;
    }

    while (answers.length < questions.length) {
        answers.push(null);
    }

    console.log(`Viewing result #${idx}: ${questions.length} soal, ${answers.length} jawaban`);

    const escapeHtml = (text) => {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    };

    let content = `<div class="mb-8">
                <h3 class="text-2xl font-black text-slate-800 mb-2">Detail Jawaban - ${escapeHtml(result.studentName)}</h3>
                <p class="text-slate-600 text-sm font-medium">Rombel: <span class="font-bold text-slate-800">${escapeHtml(result.rombel)}</span> | Mata Pelajaran: <span class="font-bold text-slate-800">${escapeHtml(result.mapel)}</span> | Skor: <span class="font-bold text-sky-600 text-lg">${result.score}</span></p>
            </div>`;

    questions.forEach((q, i) => {
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
            const imgSrcSingle = typeof q.image === 'string' ? q.image : (q.image.data || '');
            content += `<img src="${imgSrcSingle}" alt="Gambar soal" class="mb-4 max-w-full h-auto rounded-lg border border-slate-300 shadow-sm">`;
        }

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

                content += `<div class="${className}">${icon}<span class="font-bold">${String.fromCharCode(65 + optIdx)}.</span> ${escapeHtml(opt)}</div>`;
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
                                <span class="flex-1">${escapeHtml(opt)}</span>
                                <div class="text-right ml-4">
                                    <div class="text-xs text-slate-500 mb-1">Siswa: <span class="font-bold">${studentText}</span></div>
                                    <div class="text-xs text-slate-500">Kunci: <span class="font-bold">${correctText}</span></div>
                                </div>
                            </div>
                        </div>`;
            });
            content += '</div>';
        } else if (qType === 'matching') {
            let qSubQuestions = q.questions || [];
            let qSubAnswers = q.answers || [];

            if (qSubQuestions.length === 0) {
                const originalQ = (db.questions || []).find(orig =>
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
                const sAns = (rawAns !== null && rawAns !== undefined) ? String(rawAns) : null;
                const cAns = Array.isArray(correctAnswer) ? correctAnswer[qi] : null;
                const isCorrect = sAns !== null && cAns !== null && sAns === String(cAns);
                const displayAns = sAns ? escapeHtml(sAns) : '<em class="opacity-50">Tidak dijawab</em>';
                const correctDisplay = cAns !== null ? escapeHtml(String(cAns)) : 'N/A';

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
                                    <div class="truncate font-semibold">${escapeHtml(subQ)}</div>
                                </div>
                                <div class="text-right ml-4">
                                    <div class="text-xs text-slate-500 mb-1">Siswa: <span class="font-bold">${displayAns}</span></div>
                                    <div class="text-xs text-slate-500">Kunci: <span class="font-bold">${correctDisplay}</span></div>
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
window.viewDetailedResult = viewDetailedResult;

async function applyEssayScore(resultIdx, qIdx, rawScore) {
    const result = db.results[resultIdx];
    if (!result) return;

    const score = Math.min(5, Math.max(0, parseFloat(rawScore) || 0));

    if (!result.manualScores) result.manualScores = {};
    result.manualScores[qIdx] = score;

    const feedbackEl = document.getElementById(`ai-essay-result-${resultIdx}-${qIdx}`)?.querySelector('p.italic');
    if (feedbackEl) {
        if (!result.aiEssayFeedback) result.aiEssayFeedback = {};
        result.aiEssayFeedback[qIdx] = feedbackEl.textContent.replace(/^"|"$/g, '');
    }

    const questions = result.questions || [];
    const answers = result.answers || [];
    let totalItems = 0;
    let correctCount = 0;

    questions.forEach((q, i) => {
        const ans = answers[i];
        const qType = q.type || 'single';

        if (qType === 'text') {
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
    db.results[resultIdx] = result;

    try {
        if (typeof save === 'function') await save();
    } catch (e) {
        console.error('[applyEssayScore] Save error:', e.message);
    }

    const adminDash = document.getElementById('admin-dashboard');
    const teacherDash = document.getElementById('teacher-dashboard');
    if (adminDash && !adminDash.classList.contains('hidden') && typeof renderAdminResults === 'function') {
        renderAdminResults();
    } else if (teacherDash && !teacherDash.classList.contains('hidden') && typeof renderTeacherResults === 'function') {
        renderTeacherResults();
    }
}
window.applyEssayScore = applyEssayScore;

async function batchAiCorrectEssay(resultIdx) {
    const result = db.results[resultIdx];
    if (!result) return;

    const questions = result.questions || [];
    const answers = result.answers || [];

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
            const baseUrl = typeof getApiBaseUrl === 'function' ? getApiBaseUrl() : '';
            const response = await fetch(baseUrl + '/api/ai-correct-essay', {
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

    if (progressEl) progressEl.style.width = '100%';
    if (counterEl) counterEl.textContent = `${essayIndices.length} / ${essayIndices.length} soal selesai`;
    if (statusEl) statusEl.textContent = 'Menghitung ulang skor...';

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

    try {
        if (typeof save === 'function') await save();
    } catch (e) {
        console.error('[batchAiCorrect] Save error:', e.message);
    }

    overlay.remove();
    if (btn) btn.disabled = false;

    const adminDash = document.getElementById('admin-dashboard');
    const teacherDash = document.getElementById('teacher-dashboard');
    if (adminDash && !adminDash.classList.contains('hidden') && typeof renderAdminResults === 'function') {
        renderAdminResults();
    } else if (teacherDash && !teacherDash.classList.contains('hidden') && typeof renderTeacherResults === 'function') {
        renderTeacherResults();
    }

    const msg = errorCount === 0
        ? `✅ Semua ${successCount} soal esai berhasil dikoreksi AI!\nSkor baru: ${newScore}`
        : `⚠️ ${successCount} soal berhasil, ${errorCount} soal gagal.\nSkor baru: ${newScore}`;
    alert(msg);
}
window.batchAiCorrectEssay = batchAiCorrectEssay;

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
        const baseUrl = typeof getApiBaseUrl === 'function' ? getApiBaseUrl() : '';
        const response = await fetch(baseUrl + '/api/ai-correct-essay', {
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
window.runAiCorrection = runAiCorrection;

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
        const res = await fetchJsonWithTimeout(getApiBaseUrl() + '/api/school-settings', {}, 3000);
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

function hideLoadingOverlay() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
        overlay.classList.add('hidden');
        overlay.classList.remove('flex');
    }
}
window.hideLoadingOverlay = hideLoadingOverlay;

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
    try {
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

            let res;
            try {
                res = await fetchJsonWithTimeout(getApiBaseUrl() + '/api/db', {}, 7000);
            } catch (fetchErr) {
                console.warn('[init] Server DB fetch failed or timed out:', fetchErr.message || fetchErr);
                window.isStaticMode = true;
                showStaticModeWarning();
                res = null;
            }

            if (res && !res.ok && (res.status === 404 || res.status === 0)) {
                try {
                    res = await fetchJsonWithTimeout('database.json', {}, 7000);
                    window.isStaticMode = true;
                    showStaticModeWarning();
                } catch (err) {
                    console.warn('[init] database.json fallback failed:', err.message || err);
                }
            }

            if (res && res.ok) {
                const serverDb = await res.json();
                if (serverDb) {
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
    } catch (err) {
        console.error('[init] Initialization error:', err);
    } finally {
        hideLoadingOverlay();
    }
}
window.init = init;

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

function logout() {
    // Stop any active exam timer
    if (typeof isExamActive !== 'undefined') isExamActive = false;

    // Save exam progress to localStorage before logging out
    if (currentSiswa && currentSiswa.role === 'student') {
        if (typeof saveStudentExamProgress === 'function') {
            try { saveStudentExamProgress(); } catch (e) { /* ignore */ }
        }
        // Fire-and-forget live exam status update
        if (navigator.onLine && typeof updateLiveExamStatus === 'function') {
            updateLiveExamStatus(false).catch(e => console.warn('[logout] updateLiveExamStatus:', e.message));
        }
    }

    clearSession();

    // Small delay so localStorage write completes before redirect
    setTimeout(() => {
        window.location.href = 'index.html';
    }, 300);
}

window.logout = logout;

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

function showError(customMsg) {
    const err = document.getElementById('login-error');
    if (!err) return;
    const defaultRoleMsg = window.loginType === 'teacher' ? 'Password default: 123456' : 'Password default: 123456';
    err.innerHTML = (customMsg || `ID atau password salah!`) + `<br><span class="text-[10px] opacity-70 mt-1 block tracking-tight">• ${defaultRoleMsg}</span>`;
    err.classList.remove('hidden');
}
window.showError = showError;

async function handleLogin() {
    const usernameEl = document.getElementById('username');
    const passwordEl = document.getElementById('password');
    if (!usernameEl || !passwordEl) return;

    const u = usernameEl.value.trim().toUpperCase();
    const p = passwordEl.value.trim();

    if (!u || !p) {
        showError('ID dan password tidak boleh kosong.');
        return;
    }

    if (!db.students || db.students.length === 0) {
        alert('Database belum siap. Silakan refresh halaman.');
        return;
    }

    // Cari berdasarkan ID tepat
    let user = db.students.find(x => x && x.id && String(x.id).toUpperCase() === u && String(x.password) === p);

    // Fallback: cari berdasarkan nama
    if (!user) {
        const nameSearch = u.toLowerCase();
        if (window.loginType === 'student') {
            user = db.students.find(x =>
                x && x.name && String(x.name).toLowerCase().includes(nameSearch) &&
                String(x.password) === p && x.role === 'student'
            );
        } else if (window.loginType === 'admin' || window.loginType === 'teacher') {
            user = db.students.find(x =>
                x && x.name && String(x.name).toLowerCase().includes(nameSearch) &&
                String(x.password) === p && x.role === window.loginType
            );
        }
    }

    if (user) {
        const roleMatch = (window.loginType === user.role) || (!window.loginType);
        console.log('User found:', user.name, '| Role matches:', roleMatch);

        if (roleMatch) {
            currentSiswa = user;
            window.currentSiswa = user;
            if (user.role === 'student' && typeof updateCompletionCharts === 'function') updateCompletionCharts();
            saveSession();

            try { await logActivity('Login ke aplikasi'); } catch (e) { /* ignore */ }

            if (user.role === 'admin') window.location.href = 'admin.html';
            else if (user.role === 'student') window.location.href = 'siswa.html';
            else if (user.role === 'teacher') window.location.href = 'guru.html';
        } else {
            console.log('Role mismatch - Expected:', window.loginType, 'Actual:', user.role);
            showError(`Akun ini terdaftar sebagai ${user.role}. Silakan klik menu login yang sesuai.`);
        }
    } else {
        const idOnlyMatch = db.students.find(x => x && x.id && String(x.id).toUpperCase() === u);
        if (idOnlyMatch) {
            showError('ID ditemukan, tapi password salah. Coba lagi.');
        } else {
            showError('ID atau Nama tidak ditemukan. Pastikan data sudah tersimpan di Admin.');
        }
    }
}
window.handleLogin = handleLogin;

// Bind login button + Enter key
document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('login-btn');
    if (btn) btn.addEventListener('click', handleLogin);

    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');

    if (usernameInput) {
        usernameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleLogin();
        });
    }
    if (passwordInput) {
        passwordInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleLogin();
        });
    }
});

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
            console.log(`[sendResult] ✅ Hasil ujian ${result.studentName || result.studentId} (${result.mapel}) berhasil terkirim ke server (/api/result)!`);
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
                    console.log(`[sendResult] ✅ Hasil ujian ${result.studentName || result.studentId} (${result.mapel}) berhasil terkirim ke server (/api/results)!`);
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
                    console.log(`[sendResult] ✅ Hasil ujian ${result.studentName || result.studentId} (${result.mapel}) berhasil terkirim ke server (/api/db)!`);
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
        console.log('[SAVE] Peran siswa: penimpaan DB utama dilewati (hasil disinkron via sendResult). Menyimpan ke IndexedDB lokal.');
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

// --- AUTO INITIALIZE ON DOM LOAD ---
const startAppInitialization = async () => {
    // Safety fallback timer: guarantee overlay removal after max 2.5s regardless of init progress
    const safetyTimer = setTimeout(() => {
        hideLoadingOverlay();
    }, 2500);

    try {
        await init();
    } catch (err) {
        console.error('[init] Initialization failed:', err);
    } finally {
        clearTimeout(safetyTimer);
        hideLoadingOverlay();
    }

    // Question type change listener
    const typeSel = document.getElementById('q-type');
    if (typeSel && typeof onQuestionTypeChange === 'function') {
        typeSel.addEventListener('change', onQuestionTypeChange);
    }

    // Close import/export dropdowns when clicking outside
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
};

if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', startAppInitialization);
} else {
    startAppInitialization();
}

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