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


