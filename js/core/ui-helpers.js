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

function saveConfig() {
    const input = document.getElementById('config-input');
    const val = input ? input.value.trim() : '';
    if (!val) return;

    if (!Array.isArray(db.subjects)) db.subjects = [];
    if (!Array.isArray(db.rombels)) db.rombels = [];

    if (currentConfigType === 'mapel') {
        const exists = db.subjects.some(s => (typeof s === 'object' && s !== null ? s.name : s) === val);
        if (!exists) {
            db.subjects.push({ name: val, locked: false });
        }
    } else {
        if (!db.rombels.includes(val)) {
            db.rombels.push(val);
        }
    }

    save({ forceServerSave: true });
    if (input) input.value = '';
    closeModals();
    if (typeof renderRombelSection === 'function') renderRombelSection();
    if (typeof showAdminSection === 'function') showAdminSection('rombel');
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

// ===== ROMBEL & LIVE RENDERING HELPERS =====
function getSubjectName(subject) {
    if (!subject) return '';
    return typeof subject === 'string' ? subject : (subject.name || '');
}

function populateSelects(ids, includeAll = false) {
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        const list = id.includes('mapel') ? (window.db?.subjects || []) : (window.db?.rombels || []);
        let html = includeAll ? `<option value="ALL">SEMUA</option>` : '';
        html += list.map(item => {
            const val = id.includes('mapel') ? getSubjectName(item) : item;
            const display = id.includes('mapel') ? getSubjectName(item) : item;
            return `<option value="${val}">${display}</option>`;
        }).join('');
        el.innerHTML = html;
    });
}

function deleteMapel(name) {
    if (confirm(`Hapus mata pelajaran "${name}"?`)) {
        window.db.subjects = (window.db?.subjects || []).filter(s => getSubjectName(s) !== name);
        if (typeof adminSyncState !== 'undefined' && adminSyncState.isAdminMode && typeof adminSave === 'function') {
            adminSave();
            if (typeof markAdminChanges === 'function') markAdminChanges();
        } else if (typeof save === 'function') {
            save();
        }
        renderRombelSection();
    }
}

function deleteRombel(name) {
    if (confirm(`Hapus rombel "${name}"?`)) {
        window.db.rombels = (window.db?.rombels || []).filter(r => r !== name);
        if (typeof adminSyncState !== 'undefined' && adminSyncState.isAdminMode && typeof adminSave === 'function') {
            adminSave();
            if (typeof markAdminChanges === 'function') markAdminChanges();
        } else if (typeof save === 'function') {
            save();
        }
        renderRombelSection();
    }
}

function renderRombelSection() {
    const mapelList = document.getElementById('mapel-list');
    const rombelList = document.getElementById('rombel-list');

    if (mapelList) {
        mapelList.innerHTML = (window.db?.subjects || []).map(s => {
            const name = getSubjectName(s);
            const safeName = String(name).replace(/'/g, "\\'");
            return `
                <div class="group flex items-center justify-between p-3.5 bg-slate-50 hover:bg-white hover:ring-1 hover:ring-sky-100 rounded-2xl transition-all">
                    <div class="flex items-center gap-3">
                        <i class="fas fa-bookmark text-[10px] text-sky-300"></i>
                        <span class="text-xs font-bold text-slate-700">${name}</span>
                    </div>
                    <button onclick="deleteMapel('${safeName}')" class="w-7 h-7 flex items-center justify-center rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100">
                        <i class="fas fa-trash-alt text-[10px]"></i>
                    </button>
                </div>
            `;
        }).join('');
    }

    if (rombelList) {
        rombelList.innerHTML = (window.db?.rombels || []).map(r => {
            const safeRombel = String(r).replace(/'/g, "\\'");
            return `
                <div class="group flex items-center justify-between p-3.5 bg-slate-50 hover:bg-white hover:ring-1 hover:ring-emerald-100 rounded-2xl transition-all">
                    <div class="flex items-center gap-3">
                        <i class="fas fa-graduation-cap text-[10px] text-emerald-300"></i>
                        <span class="text-xs font-bold text-slate-700">${r}</span>
                    </div>
                    <button onclick="deleteRombel('${safeRombel}')" class="w-7 h-7 flex items-center justify-center rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100">
                        <i class="fas fa-trash-alt text-[10px]"></i>
                    </button>
                </div>
            `;
        }).join('');
    }

    const progressFilter = document.getElementById('progress-filter-rombel');
    if (progressFilter) {
        const current = progressFilter.value;
        progressFilter.innerHTML = '<option value="">Semua</option>' +
            (window.db?.rombels || []).map(r => `<option value="${r}"${r === current ? ' selected' : ''}>${r}</option>`).join('');
    }
    const progressMapel = document.getElementById('progress-filter-mapel');
    if (progressMapel) {
        const currentMapel = progressMapel.value;
        progressMapel.innerHTML = '<option value="">Semua</option>' +
            (window.db?.subjects || []).map(s => `<option value="${getSubjectName(s)}"${getSubjectName(s) === currentMapel ? ' selected' : ''}>${getSubjectName(s)}</option>`).join('');
    }

    // Teacher Progress Filters
    const teacherProgressRombel = document.getElementById('teacher-progress-filter-rombel');
    const isTeacher = window.currentSiswa && window.currentSiswa.role === 'teacher';

    if (teacherProgressRombel) {
        const current = teacherProgressRombel.value;
        const availableRombels = isTeacher ? (typeof teacherCombinedRombels === 'function' ? teacherCombinedRombels(window.currentSiswa) : (window.db?.rombels || [])) : (window.db?.rombels || []);
        teacherProgressRombel.innerHTML = '<option value="">Semua</option>' +
            availableRombels.map(r => `<option value="${r}"${r === current ? ' selected' : ''}>${r}</option>`).join('');
    }

    const teacherProgressMapel = document.getElementById('teacher-progress-filter-mapel');
    if (teacherProgressMapel) {
        const currentMapel = teacherProgressMapel.value;
        const availableMapels = isTeacher ? (typeof teacherSubjectNames === 'function' ? teacherSubjectNames(window.currentSiswa) : (window.db?.subjects || [])) : (window.db?.subjects || []);
        teacherProgressMapel.innerHTML = '<option value="">Semua</option>' +
            availableMapels.map(s => {
                const name = typeof s === 'string' ? s : getSubjectName(s);
                return `<option value="${name}"${name === currentMapel ? ' selected' : ''}>${name}</option>`;
            }).join('');
    }

    renderRombelProgress();
}

function renderRombelProgress() {
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
        return;
    }

    const selectedRombel = filterSelect ? filterSelect.value : '';
    const selectedMapel = mapelSelect ? mapelSelect.value : '';

    const questionsList = Array.isArray(window.db?.questions) ? window.db.questions : [];
    const questionsByRombel = questionsList.reduce((acc, q) => {
        if (!q.rombel || !q.mapel) return acc;
        if (!acc[q.rombel]) acc[q.rombel] = new Set();
        const mapelName = typeof q.mapel === 'string' ? q.mapel : q.mapel.name;
        if (mapelName) acc[q.rombel].add(mapelName);
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

    let list = (Array.isArray(window.db?.students) ? window.db.students : []).filter(s => s.role !== 'admin');

    if (isTeacherVisible && window.currentSiswa && window.currentSiswa.role === 'teacher') {
        const allowedRombels = typeof teacherCombinedRombels === 'function' ? teacherCombinedRombels(window.currentSiswa) : [];
        list = list.filter(s => allowedRombels.includes(s.rombel));
    }

    list = list.filter(s => !selectedRombel || s.rombel === selectedRombel)
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    if (list.length === 0) {
        progressList.innerHTML = `<div class="px-6 py-8 text-center text-slate-500 rounded-3xl border border-dashed border-slate-200">Tidak ada siswa untuk ditampilkan.</div>`;
        return;
    }

    const html = list.map(s => {
        const isTeacher = isTeacherVisible && window.currentSiswa && window.currentSiswa.role === 'teacher';
        const teacherMapels = isTeacher && typeof teacherSubjectNames === 'function' ? teacherSubjectNames(window.currentSiswa) : null;

        const questionsFromRombel = Array.from(questionsByRombel[s.rombel] || []);
        const allSubjectsFromDb = (window.db?.subjects || []).map(sub => getSubjectName(sub));
        const rawAvailable = questionsFromRombel.length > 0 ? questionsFromRombel : allSubjectsFromDb;
        const availableMapels = rawAvailable.filter(m => teacherMapels ? teacherMapels.includes(m) : true);

        const studentResults = (window.db?.results || []).filter(r =>
            String(r.studentId) === String(s.id) && !r.deleted &&
            (!selectedMapel ? (teacherMapels ? teacherMapels.includes(r.mapel) : true) : r.mapel === selectedMapel)
        );

        const completedMapels = new Set(studentResults.map(r => r.mapel));
        const completedCount = completedMapels.size;
        const totalMapels = selectedMapel ? (availableMapels.includes(selectedMapel) ? 1 : 0) : availableMapels.length;

        const normStr = v => String(v || '').trim().toLowerCase();
        const sid = normStr(s.id);
        const srom = normStr(s.rombel);

        const activeEntry = (window.db?.activeExams || []).find(e => {
            const sameId = normStr(e.studentId) === sid;
            const sameRombel = !e.rombel || !s.rombel || normStr(e.rombel) === srom;
            const sameMapel = !selectedMapel ?
                (teacherMapels ? teacherMapels.some(tm => normStr(tm) === normStr(e.mapel)) : true) :
                normStr(e.mapel) === normStr(selectedMapel);

            return sameId && sameRombel && sameMapel;
        });

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
            infoText = `Sedang ujian ${activeEntry.mapel || '-'} • ${answeredQuestions}/${activeEntry.totalQuestions || 0} Terjawab • ${activeEntry.percentage || 0}% dijawab • ${correctCount} benar • Sisa waktu: ${timeRemainingText} • <span class="text-[10px] text-emerald-400 font-bold">${lastSeenText}</span>`;

            if ((activeEntry.timeRemaining || 0) < 300 && (activeEntry.timeRemaining || 0) > 0) {
                timeAlertClass = ' border-l-4 border-l-red-500 bg-red-50';
            }

            const correctPercent = (correctCount / totalItems) * 100;
            const remainingProgressPercent = Math.max(0, ((answeredItems - correctCount) / totalItems) * 100);

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

        const safeId = String(s.id).replace(/'/g, "\\'");

        const saveIcon = activeEntry ? `
            <button onclick="requestStudentSave('${safeId}')" title="Simpan Progres Siswa" 
                class="w-7 h-7 flex items-center justify-center bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-all ml-2">
                <i class="fas fa-save text-xs"></i>
            </button>` : '';

        const reloadIcon = activeEntry ? `
            <button onclick="requestStudentReload('${safeId}')" title="Reload Tab Siswa" 
                class="w-7 h-7 flex items-center justify-center bg-sky-50 text-sky-600 rounded-lg hover:bg-sky-100 transition-all">
                <i class="fas fa-sync-alt text-xs"></i>
            </button>` : '';

        const clearIcon = activeEntry ? `
            <button onclick="requestStudentClearAnswers('${safeId}')" title="Hapus Jawaban Siswa" 
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
}

window.getSubjectName = getSubjectName;
window.populateSelects = populateSelects;
window.deleteMapel = deleteMapel;
window.deleteRombel = deleteRombel;
window.renderRombelSection = renderRombelSection;
window.renderRombelProgress = renderRombelProgress;



