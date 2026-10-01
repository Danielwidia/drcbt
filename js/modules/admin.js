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

function normalizeStudentRecord(student, fallbackIndex = 0) {
    if (!student || typeof student !== 'object') return null;

    const rawRole = String(student.role ?? student.userRole ?? student.level ?? student.jenis ?? '').trim().toLowerCase();
    const normalizedRole = rawRole === 'admin' || rawRole === 'administrator'
        ? 'admin'
        : rawRole === 'teacher' || rawRole === 'guru' || rawRole === 'pengajar'
            ? 'teacher'
            : rawRole === 'student' || rawRole === 'siswa' || rawRole === 'murid' || rawRole === ''
                ? 'student'
                : rawRole || 'student';

    const id = String(student.id ?? student.studentId ?? student.nisn ?? student.username ?? '').trim() || `DRKS-${fallbackIndex + 1}`;
    const name = String(student.name ?? student.nama ?? student.fullName ?? student.full_name ?? student.studentName ?? student.student_name ?? '').trim() || `Siswa ${fallbackIndex + 1}`;
    const rombel = String(student.rombel ?? student.kelas ?? student.kelasName ?? student.className ?? student.group ?? '').trim() || '-';
    const password = String(student.password ?? student.sandi ?? student.pass ?? student.pwd ?? 'escrido').trim() || 'escrido';

    return { ...student, id, name, rombel, password, role: normalizedRole };
}

if (typeof window.renderAdminStudents !== 'function') {
    window.renderAdminStudents = function renderAdminStudents() {
        const tbody = document.getElementById('students-table-body');
        const filterSelect = document.getElementById('students-filter-rombel');
        const rawStudents = Array.isArray(window.db?.students) ? window.db.students : [];
        const normalizedStudents = rawStudents
            .map((student, index) => normalizeStudentRecord(student, index))
            .filter(Boolean);
        const studentList = normalizedStudents.filter(s => s.role !== 'admin');
        const selectedRombel = filterSelect ? filterSelect.value : '';

        if (filterSelect) {
            const current = filterSelect.value;
            const uniqueRombels = [...new Set(studentList.map(s => String(s.rombel || '').trim()).filter(Boolean))];
            const options = ['<option value="">Semua</option>'];
            const allRombels = [...new Set([...(window.db?.rombels || []), ...uniqueRombels])];
            allRombels.forEach(r => {
                const value = String(r || '').trim();
                if (!value) return;
                options.push(`<option value="${value}"${value === current ? ' selected' : ''}>${value}</option>`);
            });
            filterSelect.innerHTML = options.join('');
        }

        let list = [...studentList];
        if (selectedRombel) {
            list = list.filter(s => String(s.rombel || '').trim() === String(selectedRombel).trim());
        }

        list.sort((a, b) => {
            const rombelCompare = String(a.rombel || '').localeCompare(String(b.rombel || ''));
            if (rombelCompare !== 0) return rombelCompare;
            return String(a.name || '').localeCompare(String(b.name || ''));
        });

        if (!tbody) return;

        if (list.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="4" class="px-6 py-8 text-center text-slate-400 italic font-medium">Belum ada peserta didik yang tampil untuk filter ini.</td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = list.map(s => {
            const safeId = String(s.id || '').replace(/'/g, "\\'");
            const safeName = String(s.name || 'Tanpa Nama').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            const safePassword = String(s.password || '—').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            const safeRombel = String(s.rombel || '-').replace(/</g, '&lt;').replace(/>/g, '&gt;');

            return `
                <tr>
                    <td class="px-6 py-4 font-bold text-slate-700">${safeName}</td>
                    <td class="px-6 py-4 text-xs font-semibold text-slate-500">${safeRombel}</td>
                    <td class="px-6 py-4"><span class="bg-slate-50 border border-slate-100 px-2 py-1 rounded font-bold text-sky-600 text-[10px] tracking-widest">${String(s.id || '—')} / ${safePassword}</span></td>
                    <td class="px-6 py-4 text-center">
                        <div class="flex items-center justify-center gap-1">
                            <button onclick="editStudent('${safeId}')" class="w-8 h-8 rounded-lg bg-sky-50 text-sky-500 hover:bg-sky-100 transition-all flex items-center justify-center" title="Edit Data"><i class="fas fa-edit text-xs"></i></button>
                            <button onclick="resetStudentResults('${safeId}')" class="w-8 h-8 rounded-lg bg-amber-50 text-amber-500 hover:bg-amber-100 transition-all flex items-center justify-center" title="Reset Hasil Ujian"><i class="fas fa-sync-alt text-xs"></i></button>
                            <button onclick="deleteStudent('${safeId}')" class="w-8 h-8 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-all flex items-center justify-center" title="Hapus"><i class="fas fa-trash text-xs"></i></button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    };
}

