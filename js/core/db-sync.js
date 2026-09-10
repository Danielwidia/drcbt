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
            const loaded = JSON.parse(raw);
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
        localStorage.setItem(DB_KEY, Date.now());
        console.log('[saveLocalDb] Updated localStorage timestamp');
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

