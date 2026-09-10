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

