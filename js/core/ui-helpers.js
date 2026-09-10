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
            updateStats();
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

function insertOptionSymbol(symbol, targetInputEl) {
    let el = targetInputEl || document.activeElement;
    if (!el || (el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA')) {
        const opts = document.querySelectorAll('.q-opt, .tf-statement, .matching-question, .matching-answer');
        el = Array.from(opts).find(input => input === document.activeElement) || opts[0];
    }
    if (!el) return;

    const start = el.selectionStart || el.value.length;
    const end = el.selectionEnd || el.value.length;
    const val = el.value;
    el.value = val.substring(0, start) + symbol + val.substring(end);
    el.selectionStart = el.selectionEnd = start + symbol.length;
    el.focus();
    el.dispatchEvent(new Event('input', { bubbles: true }));
}
window.insertOptionSymbol = insertOptionSymbol;


