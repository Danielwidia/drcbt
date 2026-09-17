/**
 * js/modules/admin.js
 * Part of CBT application refactored module
 */

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
})();

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
        try { if (typeof save === 'function') await save(); } catch (e) { console.error('[AI-Group] Final save error:', e.message); }

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
            if (typeof save === 'function') save();
            if (typeof updateCompletionCharts === 'function') updateCompletionCharts();
            if (typeof renderAdminResults === 'function') renderAdminResults();
            alert(`✅ SUKSES!\n\n${cleanedCount} hasil ujian corrupt telah dibersihkan dan disimpan ke server.`);
        }
    }
    window.cleanCorruptedResults = cleanCorruptedResults;
}

