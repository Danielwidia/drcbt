/**
 * js/modules/admin.js
 * Part of CBT application refactored module
 */


/**
 * Shuffle the order of questions (and their answer options) in the question bank,
 * grouped by the current admin filter (rombel / mapel).
 * Called by the "Acak" button in Bank Soal.
 */
function shuffleQuestions() {
    const isTeacher = window.isTeacherMode || (typeof currentSiswa !== 'undefined' && currentSiswa && currentSiswa.role === 'teacher');
    let questionsToShuffleIndices = [];
    let fM = '';
    let fR = '';

    if (isTeacher) {
        fM = document.getElementById('teacher-filter-mapel')?.value || '';
        fR = document.getElementById('teacher-filter-rombel')?.value || '';
        for (let i = 0; i < db.questions.length; i++) {
            const q = db.questions[i];
            const qSubject = typeof q.mapel === 'string' ? q.mapel : q.mapel?.name || q.mapel;
            if (!teacherSubjectNames(currentSiswa).includes(qSubject)) continue;
            const allowed = teacherAllowedRombels(currentSiswa, qSubject);
            if (!allowed.includes(q.rombel)) continue;
            if (fM && qSubject !== fM) continue;
            if (fR && q.rombel !== fR) continue;
            questionsToShuffleIndices.push(i);
        }
    } else {
        fR = document.getElementById('filter-rombel')?.value || 'ALL';
        fM = document.getElementById('filter-mapel')?.value || 'ALL';
        for (let i = 0; i < db.questions.length; i++) {
            const q = db.questions[i];
            if ((fR === 'ALL' || q.rombel === fR) && (fM === 'ALL' || q.mapel === fM)) {
                questionsToShuffleIndices.push(i);
            }
        }
    }

    if (questionsToShuffleIndices.length === 0) {
        alert('Tidak ada soal yang sesuai dengan filter saat ini untuk diacak.');
        return;
    }

    let msg = 'Acak urutan semua soal dan opsi jawabannya?';
    if (isTeacher) {
        const mapelLabel = fM ? fM : 'Semua Mapel';
        const rombelLabel = fR ? fR : 'Semua Rombel';
        if (fM || fR) {
            msg = `Acak urutan ${questionsToShuffleIndices.length} soal beserta opsi jawabannya dengan filter:\nMapel: ${mapelLabel}\nRombel: ${rombelLabel}?`;
        } else {
            msg = `Acak urutan ${questionsToShuffleIndices.length} soal beserta opsi jawabannya milik Anda?`;
        }
    } else {
        if (fR !== 'ALL' || fM !== 'ALL') {
            const rombelLabel = fR === 'ALL' ? 'Semua Rombel' : fR;
            const mapelLabel = fM === 'ALL' ? 'Semua Mapel' : fM;
            msg = `Acak urutan ${questionsToShuffleIndices.length} soal beserta opsi jawabannya dengan filter:\nRombel: ${rombelLabel}\nMapel: ${mapelLabel}?`;
        }
    }

    if (!confirm(msg)) return;

    const filteredQuestions = questionsToShuffleIndices.map(i => db.questions[i]);

    // Fisher-Yates shuffle of question order
    for (let i = filteredQuestions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [filteredQuestions[i], filteredQuestions[j]] = [filteredQuestions[j], filteredQuestions[i]];
    }

    // Also shuffle answer options for each question
    filteredQuestions.forEach(q => {
        if (!q || !Array.isArray(q.options) || q.options.length <= 1) return;
        const qType = q.type || 'single';
        if (qType === 'single') {
            const origOpts = [...q.options];
            const origCorrectIdx = typeof q.correct === 'number' ? q.correct : parseInt(q.correct);
            const shuffledIdx = shuffleArray(origOpts.map((_, i) => i));
            q.options = shuffledIdx.map(i => origOpts[i]);
            q.correct = (!isNaN(origCorrectIdx) && origCorrectIdx >= 0) ? shuffledIdx.indexOf(origCorrectIdx) : 0;
        } else if (qType === 'multiple') {
            const origOpts = [...q.options];
            const origCorr = Array.isArray(q.correct) ? q.correct : [];
            const shuffledIdx = shuffleArray(origOpts.map((_, i) => i));
            q.options = shuffledIdx.map(i => origOpts[i]);
            q.correct = origCorr.map(old => shuffledIdx.indexOf(old)).filter(n => n !== -1).sort((a, b) => a - b);
        } else if (qType === 'tf') {
            const origOpts = [...q.options];
            const origCorr = Array.isArray(q.correct) ? q.correct : [];
            const shuffledIdx = shuffleArray(origOpts.map((_, i) => i));
            q.options = shuffledIdx.map(i => origOpts[i]);
            q.correct = shuffledIdx.map(old => origCorr[old] ?? false);
        }
    });

    for (let i = 0; i < questionsToShuffleIndices.length; i++) {
        db.questions[questionsToShuffleIndices[i]] = filteredQuestions[i];
    }

    save();
    if (isTeacher) {
        if (typeof renderTeacherQuestions === 'function') renderTeacherQuestions();
    } else {
        if (typeof renderAdminQuestions === 'function') renderAdminQuestions();
    }
    if (typeof showToast === 'function') showToast('Berhasil mengacak urutan soal dan opsi jawaban!', 'success');
}

/**
 * Delete all questions that match the current admin filter (rombel and mapel).
 * Called by the "Hapus Soal" button in Bank Soal.
 */
function deleteFilteredQuestions() {
    const fR = document.getElementById('filter-rombel')?.value || 'ALL';
    const fM = document.getElementById('filter-mapel')?.value || 'ALL';

    const toDelete = db.questions.filter(q =>
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

    if (typeof selectedAdminQuestions !== 'undefined') selectedAdminQuestions.clear();
    save();
    if (typeof renderAdminQuestions === 'function') renderAdminQuestions();
    if (typeof updateStats === 'function') updateStats();
    alert(`${toDelete.length} soal berhasil dihapus.`);
}


function findActiveExamForStudent(studentId) {
    if (!Array.isArray(db.activeExams)) return null;
    const norm = v => String(v || '').trim().toLowerCase();
    const nid = norm(studentId);
    return db.activeExams.find(e => norm(e.studentId) === nid);
}

async function requestStudentSave(studentId) {
    const activeExam = findActiveExamForStudent(studentId);
    if (!activeExam) {
        showToast('Tidak ada sesi ujian aktif untuk siswa ini.', 'warning');
        return;
    }

    console.log('[requestStudentSave] Sending save request for student:', studentId);
    console.log('[requestStudentSave] Active exam before:', activeExam);

    // SIMPAN JAWABAN SISWA LANGSUNG KE SERVER sebagai checkpoint admin
    const saveEntry = {
        ...activeExam,
        adminSaveRequest: true,
        adminReloadRequest: activeExam.adminReloadRequest || false,
        adminSaveConfirmed: true,
        updatedAt: Date.now(),
        adminSavedProgress: {
            studentId: activeExam.studentId,
            studentName: activeExam.studentName,
            rombel: activeExam.rombel,
            mapel: activeExam.mapel,
            answers: Array.isArray(activeExam.answers) ? activeExam.answers : [],
            currentIdx: typeof activeExam.currentIdx === 'number' ? activeExam.currentIdx : 0,
            ragu: Array.isArray(activeExam.ragu) ? activeExam.ragu : [],
            totalSeconds: activeExam.totalSeconds || 0,
            remainingSeconds: activeExam.timeRemaining || activeExam.remainingSeconds || 0,
            savedAt: Date.now()
        }
    };
    if (Array.isArray(activeExam.answers)) saveEntry.answers = activeExam.answers;
    if (typeof activeExam.currentIdx === 'number') saveEntry.currentIdx = activeExam.currentIdx;

    console.log('[requestStudentSave] Save entry with answers:', saveEntry);

    // Simpan snapshot ke activeExam lokal agar update berikutnya tidak menghapus checkpoint
    activeExam.adminSavedProgress = saveEntry.adminSavedProgress;
    activeExam.adminSaveConfirmed = true;
    activeExam.savedByAdminCommand = true; // Mark this specific exam state as admin-saved
    activeExam.adminSaveRequest = true;
    activeExam.updatedAt = saveEntry.updatedAt;

    try {
        await sendLiveExamToServer(saveEntry);
        await saveLocalDb();
        console.log(`[requestStudentSave] ✅ JAWABAN SISWA ${studentId} DISIMPAN KE SERVER - adminSaveRequest SET TRUE`);
        showToast(`✅ Jawaban ${activeExam.studentName || 'siswa'} tersimpan ke server. Siswa dapat melanjutkan ujian setelah reload/login.`, 'success');
        if (typeof renderRombelProgress === 'function') renderRombelProgress();
    } catch (err) {
        console.warn('[requestStudentSave] error:', err.message || err);
        showToast('Gagal menyimpan jawaban siswa ke server.', 'error');
    }
}

async function requestStudentReload(studentId) {
    const activeExam = findActiveExamForStudent(studentId);
    if (!activeExam) {
        showToast('Tidak ada sesi ujian aktif.', 'warning');
        return;
    }
    const reloadEntry = { ...activeExam, adminReloadRequest: Date.now(), updatedAt: Date.now() };
    try {
        await sendLiveExamToServer(reloadEntry);
        showToast(`✅ Permintaan RELOAD terkirim ke ${activeExam.studentName}.`, 'success');
    } catch (e) {
        console.error('[requestStudentReload] Error:', e.message);
    }
}

async function requestStudentClearAnswers(studentId) {
    const activeExam = findActiveExamForStudent(studentId);
    if (!activeExam) {
        showToast('Tidak ada sesi ujian aktif.', 'warning');
        return;
    }

    if (!confirm(`Hapus SEMUA JAWABAN ${activeExam.studentName} untuk mapel ${activeExam.mapel}?\n\nPERINGATAN: Tindakan ini tidak dapat dibatalkan.`)) {
        return;
    }

    console.log('[requestStudentClearAnswers] Sending CLEAR request for student:', studentId);
    const clearEntry = {
        ...activeExam,
        adminClearRequest: Date.now(), // Unique Command ID
        adminDeleteCheckpoint: true,
        adminSaveConfirmed: false,   // Clear Save Flag
        savedByAdminCommand: false,  // Clear Save Flag
        adminReloadRequest: false,   // Clear Reload Flag
        updatedAt: Date.now(),
        adminSavedProgress: null,
        answers: activeExam.answers.map(ans => {
            if (Array.isArray(ans)) return [];
            if (typeof ans === 'string') return '';
            return null;
        })
    };

    try {
        await sendLiveExamToServer(clearEntry);

        // Update local active exam state immediately so Admin UI reflects 0%
        const localIndex = db.activeExams.findIndex(e => e.studentId === activeExam.studentId);
        if (localIndex >= 0) {
            db.activeExams[localIndex] = {
                ...db.activeExams[localIndex],
                answers: clearEntry.answers,
                adminSavedProgress: null,
                adminSaveConfirmed: false,
                updatedAt: Date.now()
            };
        }

        // Clear local cache too just in case
        localStorage.removeItem(STUDENT_ADMIN_SAVED_PROGRESS_KEY);
        await saveLocalDb();

        showToast(`✅ Progres dan Jawaban ${activeExam.studentName} telah dihapus permanen.`, 'success');
        if (typeof renderRombelProgress === 'function') renderRombelProgress();
    } catch (e) {
        console.error('[requestStudentClearAnswers] Error:', e.message);
    }
}

let editStudentId = null;

let selectedAdminQuestions = new Set();

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

async function updateAdminAPIStats() {
    const activeEl = document.getElementById('stat-api-active');
    const exhaustedEl = document.getElementById('stat-api-exhausted');

    if (!activeEl && !exhaustedEl) return;

    try {
        const res = await fetch(getApiBaseUrl() + '/api/admin/global-api-keys');
        if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
        }
        const data = await res.json();

        if (data.ok) {
            if (activeEl) activeEl.innerText = data.activeCount || 0;
            if (exhaustedEl) exhaustedEl.innerText = data.exhaustedCount || 0;
        }
    } catch (err) {
        console.warn('Gagal membarui statistik API Admin:', err.message);
    }
}

function openStudentModal() {
    editStudentId = null;
    const nameEl = document.getElementById('st-name');
    const idEl = document.getElementById('st-id');
    const passEl = document.getElementById('st-password');
    const extraEl = document.getElementById('st-extra-fields');
    const titleEl = document.getElementById('student-modal-title');
    const btnEl = document.getElementById('student-save-btn');

    if (nameEl) nameEl.value = '';
    if (idEl) idEl.value = '';
    if (passEl) passEl.value = '';
    if (extraEl) extraEl.classList.add('hidden');
    if (titleEl) titleEl.textContent = 'Siswa Baru';
    if (btnEl) btnEl.textContent = 'DAFTAR';

    populateSelects(['st-rombel']);
    document.getElementById('student-modal').classList.replace('hidden', 'flex');
}

function editStudent(id) {
    const s = db.students.find(x => x.id === id);
    if (!s) return alert('Siswa tidak ditemukan');

    editStudentId = id;
    const nameEl = document.getElementById('st-name');
    const idEl = document.getElementById('st-id');
    const passEl = document.getElementById('st-password');
    const extraEl = document.getElementById('st-extra-fields');
    const titleEl = document.getElementById('student-modal-title');
    const btnEl = document.getElementById('student-save-btn');

    if (nameEl) nameEl.value = s.name || '';
    if (idEl) idEl.value = s.id || '';
    if (passEl) passEl.value = s.password || '';
    if (extraEl) extraEl.classList.remove('hidden');
    if (titleEl) titleEl.textContent = 'Edit Siswa';
    if (btnEl) btnEl.textContent = 'PERBARUI';

    populateSelects(['st-rombel']);
    const rombelSelect = document.getElementById('st-rombel');
    if (rombelSelect) rombelSelect.value = s.rombel || '';

    document.getElementById('student-modal').classList.replace('hidden', 'flex');
}

function saveStudent() {
    const name = document.getElementById('st-name').value.trim();
    const rombel = document.getElementById('st-rombel').value;
    if (!name) return alert("Nama harus diisi");

    if (editStudentId) {
        const student = db.students.find(x => x.id === editStudentId);
        if (student) {
            const newId = document.getElementById('st-id').value.trim();
            const newPassword = document.getElementById('st-password').value.trim();

            // Update results if ID changed to maintain history
            if (newId && newId !== student.id) {
                (db.results || []).forEach(r => {
                    if (r.studentId === student.id) r.studentId = newId;
                });
                student.id = newId;
            }

            student.name = name;
            student.rombel = rombel;
            if (newPassword) student.password = newPassword;
            showToast('Data siswa diperbarui', 'success');
        }
    } else {
        const id = "DRKS-" + Math.floor(1000 + Math.random() * 9000);
        db.students.push({ id, password: "escrido", name, rombel, role: "student" });
        showToast('Siswa berhasil didaftarkan', 'success');
    }

    updateCompletionCharts();
    save();
    renderAdminStudents();
    closeModals();
}

function renderAdminStudents() {
    const tbody = document.getElementById('students-table-body');
    const filterSelect = document.getElementById('students-filter-rombel');
    const selectedRombel = filterSelect ? filterSelect.value : '';

    // populate filter options from available rombels (keep existing selection)
    if (filterSelect) {
        const current = filterSelect.value;
        filterSelect.innerHTML = '<option value="">Semua</option>' +
            db.rombels.map(r => `<option value="${r}"${r === current ? ' selected' : ''}>${r}</option>`).join('');
    }

    let list = db.students.filter(x => x.role !== 'admin');
    if (selectedRombel) {
        list = list.filter(s => s.rombel === selectedRombel);
    }
    // Sort by rombel then by name alphabetically
    list.sort((a, b) => {
        if (a.rombel === b.rombel) {
            return a.name.localeCompare(b.name);
        }
        return a.rombel.localeCompare(b.rombel);
    });

    tbody.innerHTML = list.map(s => `
                <tr>
                    <td class="px-6 py-4 font-bold text-slate-700">${s.name}</td>
                    <td class="px-6 py-4 text-xs font-semibold text-slate-500">${s.rombel}</td>
                    <td class="px-6 py-4"><span class="bg-slate-50 border border-slate-100 px-2 py-1 rounded font-bold text-sky-600 text-[10px] tracking-widest">${s.id} / ${s.password}</span></td>
                    <td class="px-6 py-4 text-center">
                        <div class="flex items-center justify-center gap-1">
                            <button onclick="editStudent('${s.id}')" class="w-8 h-8 rounded-lg bg-sky-50 text-sky-500 hover:bg-sky-100 transition-all flex items-center justify-center" title="Edit Data"><i class="fas fa-edit text-xs"></i></button>
                            <button onclick="resetStudentResults('${s.id}')" class="w-8 h-8 rounded-lg bg-amber-50 text-amber-500 hover:bg-amber-100 transition-all flex items-center justify-center" title="Reset Hasil Ujian"><i class="fas fa-sync-alt text-xs"></i></button>
                            <button onclick="deleteStudent('${s.id}')" class="w-8 h-8 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-all flex items-center justify-center" title="Hapus"><i class="fas fa-trash text-xs"></i></button>
                        </div>
                    </td>
                </tr>
            `).join('');
}

function deleteStudent(id) {
    if (confirm("Hapus siswa ini?")) {
        db.students = db.students.filter(x => x.id !== id);
        updateCompletionCharts();
        save();
        renderAdminStudents();
    }
}

function resetStudentResults(studentId) {
    if (!confirm('Reset hasil ujian untuk siswa ini?')) return;
    let any = false;
    db.results = (db.results || []).map(r => {
        if (r.studentId === studentId && !r.deleted) {
            any = true;
            return { ...r, deleted: true, updatedAt: Date.now() };
        }
        return r;
    });
    if (!any) {
        alert('Tidak ada hasil ujian aktif untuk siswa ini.');
        return;
    }
    save();
    updateCompletionCharts();
    updateStats();
    renderAdminResults();
    renderAdminStudents();
    alert('Reset hasil ujian siswa berhasil.');
}

function generateStudentCardsPDF() {
    const settings = db.schoolSettings || {};
    const list = db.students.filter(x => x.role !== 'admin');
    if (list.length === 0) return alert('Tidak ada siswa untuk dicetak.');
    const container = document.createElement('div');
    container.style.width = '210mm';
    container.style.padding = '3mm';
    container.style.display = 'grid';
    container.style.gridTemplateColumns = 'repeat(2, 1fr)';
    container.style.gap = '3mm';
    container.style.boxSizing = 'border-box';
    container.style.backgroundColor = '#f5f5f5';

    list.forEach(s => {
        const card = document.createElement('div');
        card.style.border = '2px solid #1a5490';
        card.style.borderRadius = '12px';
        card.style.padding = '14px';
        card.style.width = '100%';
        card.style.boxSizing = 'border-box';
        card.style.display = 'flex';
        card.style.flexDirection = 'column';
        card.style.fontFamily = 'Arial, sans-serif';
        card.style.backgroundColor = '#ffffff';
        card.style.minHeight = '173px';
        card.innerHTML = `
                    <div style="display: flex; align-items: center; justify-content: flex-start; gap: 6px; margin-bottom: 8px; padding-left: 4px;">
                        <img src="${settings.logoUrl || settings.logo || 'logo.png'}" alt="Logo" style="width: 40px; height: 40px; flex-shrink: 0; object-fit: contain;">
                        <div style="flex: 1; text-align: center;">
                            <div style="font-size: 14px; font-weight: bold; letter-spacing: 1px; color: #666;">KARTU TES</div>
                            <div style="font-size: 12px; font-weight: bold; color: #333;">${settings.name || 'CBT APPLICATION'}</div>
                        </div>
                    </div>
                    <div style="border-top: 1px solid #ddd; padding-top: 8px; font-size: 11px; line-height: 1.8; color: #333;">
                        <div style="display: grid; grid-template-columns: 60px 1fr; gap: 5px;">
                            <span style="font-weight: bold; text-align: left;">Nama</span>
                            <span>: ${s.name}</span>
                        </div>
                        <div style="display: grid; grid-template-columns: 60px 1fr; gap: 5px;">
                            <span style="font-weight: bold; text-align: left;">Rombel</span>
                            <span>: ${s.rombel}</span>
                        </div>
                        <div style="display: grid; grid-template-columns: 60px 1fr; gap: 5px;">
                            <span style="font-weight: bold; text-align: left;">Username</span>
                            <span>: ${s.id}</span>
                        </div>
                        <div style="display: grid; grid-template-columns: 60px 1fr; gap: 5px;">
                            <span style="font-weight: bold; text-align: left;">Password</span>
                            <span>: ${s.password}</span>
                        </div>
                    </div>
                `;
        container.appendChild(card);
    });
    html2pdf().from(container).set({ margin: [1, 0, 1, 0], filename: 'kartu_akun_siswa.pdf', html2canvas: { scale: 2 }, pagebreak: { mode: 'avoid' }, format: 'a4', orientation: 'portrait' }).save();
}

function registerTeacher() {
    console.log('=== registerTeacher() called ===');
    const nameInput = document.getElementById('teacher-name');
    const idInput = document.getElementById('teacher-id');
    const passwordInput = document.getElementById('teacher-password');
    const checkedSubjects = document.querySelectorAll('.teacher-subject-checkbox:checked');

    console.log('Name Input:', { element: !!nameInput, value: nameInput?.value });
    console.log('ID Input:', { element: !!idInput, value: idInput?.value });
    console.log('Password Input:', { element: !!passwordInput, value: passwordInput?.value });
    console.log('Checked Subjects count:', checkedSubjects.length);

    const name = (nameInput?.value || '').trim();
    const id = (idInput?.value || '').toUpperCase().trim();
    const password = (passwordInput?.value || '').trim();

    // Build subject objects with rombels
    const selected = Array.from(checkedSubjects).map(cb => {
        const subj = cb.dataset.subject;
        const rombelBoxes = document.querySelectorAll(`.teacher-rombel-checkbox[data-parent-subject="${subj}"]:checked`);
        const rombels = Array.from(rombelBoxes).map(rb => rb.dataset.rombel);
        return { name: subj, rombels };
    });

    const combinedRombels = [...new Set(selected.flatMap(s => s.rombels))];

    console.log('Form data collected:', { name: name || '(empty)', id: id || '(empty)', password: password ? '***' : '(empty)', subjects: selected, rombels: combinedRombels });

    if (!name || !id || !password) {
        alert('Nama, ID, dan password harus diisi!');
        return;
    }
    if (selected.length === 0) {
        alert('Pilih minimal satu mata pelajaran!');
        return;
    }
    if (selected.some(s => s.rombels.length === 0)) {
        alert('Pilih rombel untuk setiap mata pelajaran!');
        return;
    }
    if (db.students.some(s => s.id.toUpperCase() === id)) {
        alert('ID sudah terdaftar!');
        return;
    }

    db.students.push({ id, password, name, role: 'teacher', subjects: selected, rombels: combinedRombels });
    save();

    // Clear inputs
    document.getElementById('teacher-name').value = '';
    document.getElementById('teacher-id').value = '';
    document.getElementById('teacher-password').value = 'escrido123';

    // Refresh UI components
    renderTeacherSubjectCheckboxes();
    renderTeachersList();

    Swal.fire({
        icon: 'success',
        title: 'Pendaftaran Berhasil',
        text: `Guru ${name} telah berhasil didaftarkan ke sistem.`,
        border: 'none',
        borderRadius: '2rem',
        confirmButtonColor: '#f59e0b'
    });
}

async function deleteTeacher(id) {
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
        await save();
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
}

function openScheduleModal() {
    renderScheduleChecklist();
    document.getElementById('schedule-modal').classList.replace('hidden', 'flex');
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
        <div class="schedule-subject-card border-2 rounded-2xl overflow-hidden transition-all ${
            checkedCount > 0 ? 'border-purple-200' : 'border-slate-100'
        }" data-subject-idx="${sIdx}">
            <!-- Subject Header / Toggle Button -->
            <button type="button"
                class="schedule-subject-toggle w-full flex items-center gap-3 p-4 text-left hover:bg-slate-50 transition-all"
                onclick="toggleScheduleSubjectCard(this)"
                aria-expanded="false">
                <div class="schedule-card-icon w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all ${
                    checkedCount > 0 ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-500'
                }">
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
            <!-- Rombel Checklist (collapsed by default) -->
            <div class="schedule-subject-panel hidden px-4 pb-4">
                <!-- Pilih Semua toggle -->
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
                <div class="space-y-1.5">
                    ${rombelItems}
                </div>
            </div>
        </div>`;
    }).join('');

    container.innerHTML = html;

    // Fix indeterminate state (cannot be set via HTML attribute)
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

    // Update select-all state
    if (selectAllCb) {
        selectAllCb.checked = checkedCount === total;
        selectAllCb.indeterminate = checkedCount > 0 && checkedCount < total;
    }

    // Update badge
    const badge = card.querySelector('.schedule-card-badge');
    if (badge) {
        badge.textContent = `${checkedCount}/${total}`;
        badge.className = `schedule-card-badge text-[10px] font-black px-2.5 py-1 rounded-full ${
            checkedCount > 0 ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-400'
        }`;
    }

    // Update description text
    const desc = card.querySelector('.schedule-card-desc');
    if (desc) desc.textContent = `${checkedCount} dari ${total} rombel aktif`;

    // Update icon color
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

    // Update card border
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
    // Set all rombel checkboxes to match the select-all state
    rombelCbs.forEach(cb => {
        cb.checked = selectAllCb.checked;
        _updateRombelLabelStyle(cb);
    });
    // Update header once after all are toggled
    if (card) _updateScheduleCardHeader(card);
}

async function saveSchedules() {
    const checkboxes = document.querySelectorAll('.schedule-checkbox:checked');
    const newSchedules = Array.from(checkboxes).map(cb => cb.dataset.key);

    // Apply changes to local state
    db.schedules = newSchedules;

    // Save with mandatory refresh from server first to prevent overwriting other admins
    await save({ refreshBeforeSave: true });

    closeModals();
    alert('Jadwal akses tersimpan!');
}

let adminStatsPollInterval = null;

let adminRombelPollInterval = null;

function saveRemoteServer() {
    const url = document.getElementById('set-remote-url').value.trim();
    if (url) {
        localStorage.setItem(REMOTE_SERVER_KEY, url);
        alert('URL Server tersimpan! Halaman akan dimuat ulang.');
        setTimeout(() => location.reload(), 1000);
    }
}

function clearRemoteServer() {
    localStorage.removeItem(REMOTE_SERVER_KEY);
    document.getElementById('set-remote-url').value = '';
    alert('URL Server dihapus! Kembali ke default.');
    setTimeout(() => location.reload(), 1000);
}

function toggleUserLogs() {
    const list = document.getElementById('user-logs-list');
    const chevron = document.getElementById('user-logs-chevron');
    if (!list || !chevron) return;

    list.classList.toggle('hidden');
    if (list.classList.contains('hidden')) {
        chevron.style.transform = 'rotate(180deg)';
    } else {
        chevron.style.transform = 'rotate(0deg)';
        renderUserLogs(); // Auto refresh when opening
    }
}

async function clearUserLogs() {
    const confirm = await Swal.fire({
        title: 'Hapus Semua Log?',
        text: "Data aktivitas yang sudah dihapus tidak dapat dikembalikan!",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Ya, Hapus!',
        cancelButtonText: 'Batal'
    });

    if (confirm.isConfirmed) {
        try {
            const res = await fetch(getApiBaseUrl() + '/api/logs', { method: 'DELETE' });
            const data = await res.json();
            if (data.ok) {
                renderUserLogs();
                Swal.fire('Terhapus!', 'Semua log aktivitas telah dihapus.', 'success');
            }
        } catch (e) {
            console.error('[clearUserLogs] Error:', e.message);
            Swal.fire('Gagal!', 'Terjadi kesalahan saat menghapus log.', 'error');
        }
    }
}

async function renderUserLogs() {
    const list = document.getElementById('user-logs-list');
    if (!list) return;

    try {
        const res = await fetch(getApiBaseUrl() + '/api/logs?limit=20');
        const data = await res.json();

        if (data.ok && data.items) {
            if (data.items.length === 0) {
                list.innerHTML = `<div class="text-xs text-slate-400 italic p-4 text-center">Belum ada aktivitas.</div>`;
                return;
            }

            list.innerHTML = data.items.map(log => {
                const date = new Date(log.created_at);
                const time = date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
                const fullDate = date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });

                let roleColor = 'bg-slate-100 text-slate-600';
                if (log.role === 'admin') roleColor = 'bg-rose-100 text-rose-600';
                else if (log.role === 'teacher') roleColor = 'bg-sky-100 text-sky-600';
                else if (log.role === 'student') roleColor = 'bg-emerald-100 text-emerald-600';

                return `
                <div class="flex items-center gap-4 p-3 hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0">
                    <div class="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs ${roleColor}">
                        ${log.user_name ? log.user_name.substring(0, 2).toUpperCase() : '??'}
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center justify-between gap-2">
                            <h4 class="text-xs font-bold text-slate-800 truncate">${log.user_name}</h4>
                            <span class="text-[10px] font-medium text-slate-400 whitespace-nowrap">${time} · ${fullDate}</span>
                        </div>
                        <p class="text-[11px] text-slate-500 truncate">${log.activity}</p>
                    </div>
                </div>
                `;
            }).join('');
        }
    } catch (e) {
        console.warn('[renderUserLogs] Error:', e.message);
        list.innerHTML = `<div class="text-xs text-red-400 p-4 text-center">Gagal memuat log.</div>`;
    }
}

function showAdminSection(sec) {
    document.querySelectorAll('.admin-section').forEach(s => s.classList.add('hidden'));
    document.getElementById('admin-' + sec).classList.remove('hidden');
    document.querySelectorAll('.nav-link').forEach(l => {
        l.classList.remove('bg-sky-600', 'text-white');
        if (l.dataset.section === sec) l.classList.add('bg-sky-600', 'text-white');
    });

    if (sec === 'overview') {
        renderUserLogs();
    }

    if (sec === 'banksoal') {
        (async () => {
            await ensureDataLoaded('questions');
            populateSelects(['filter-mapel', 'filter-rombel'], true);
            renderAdminPaketSoal();
            switchAdminBankSoalTab('paket');
        })();
    }
    if (sec === 'rombel') {
        renderRombelSection();
        if (adminRombelPollInterval) clearInterval(adminRombelPollInterval);
        adminRombelPollInterval = setInterval(async () => {
            const adminSection = document.getElementById('admin-rombel');
            if (adminSection && !adminSection.classList.contains('hidden')) {
                const changed = await syncAdminLiveState();
                if (changed) renderRombelProgress();

                // Active Pulse Indicator
                const syncIndicator = document.getElementById('sync-pulse');
                if (syncIndicator) {
                    syncIndicator.classList.remove('opacity-0');
                    setTimeout(() => syncIndicator.classList.add('opacity-0'), 300);
                }
            }
        }, 1000);
        console.log('[Admin Rombel] Started polling interval');
    } else {
        if (adminRombelPollInterval) {
            clearInterval(adminRombelPollInterval);
            adminRombelPollInterval = null;
        }
    }
    if (sec === 'students') {
        (async () => {
            await ensureDataLoaded('students');
            renderAdminStudents();
        })();
    }
    if (sec === 'quizz') renderAdminQuizz();
    if (sec === 'results') {
        populateSelects(['results-filter-rombel', 'results-filter-mapel'], true);
        renderAdminResults();
        // Immediately fetch fresh results from server, then poll every 5s
        fetchAndMerge();
        if (resultsPollInterval) clearInterval(resultsPollInterval);
        resultsPollInterval = setInterval(fetchAndMerge, 5000);
    } else {
        if (resultsPollInterval) { clearInterval(resultsPollInterval); resultsPollInterval = null; }
    }
    if (sec === 'raport') {
        (async () => {
            await ensureDataLoaded('students');
            await ensureDataLoaded('results');
            populateRaportFilters();
            renderRaport();
        })();
    }
    if (sec === 'overview') {
        updateStats();
        fetchIPs();
        if (adminStatsPollInterval) clearInterval(adminStatsPollInterval);
        adminStatsPollInterval = setInterval(updateStats, 5000);
    } else {
        if (adminStatsPollInterval) {
            clearInterval(adminStatsPollInterval);
            adminStatsPollInterval = null;
        }
    }
    if (sec === 'settings') {
        (async () => {
            await ensureDataLoaded('students');
            const admin = db.students.find(x => x.role === 'admin');
            if (admin) document.getElementById('set-admin-id').value = admin.id;
            renderTeacherSubjectCheckboxes();
            renderTeachersList();
        })();
        // Populate remote URL input from localStorage
        const remoteUrlInput = document.getElementById('set-remote-url');
        if (remoteUrlInput) {
            remoteUrlInput.value = localStorage.getItem(REMOTE_SERVER_KEY) || '';
        }
        // Load school identity settings
        loadSchoolSettings();
    }
}

function switchAdminBankSoalTab(tab) {
    const paketSection = document.getElementById('banksoal-paket-section');
    const detailSection = document.getElementById('banksoal-detail-section');
    const globalSection = document.getElementById('banksoal-global-section');
    const paketBtn = document.getElementById('banksoal-tab-paket');
    const detailBtn = document.getElementById('banksoal-tab-detail');
    const globalBtn = document.getElementById('banksoal-tab-global');
    if (!paketSection || !detailSection || !globalSection || !paketBtn || !detailBtn || !globalBtn) return;

    const hasDetail = currentDetailPackage !== null;
    if (hasDetail) {
        detailBtn.classList.remove('hidden');
    } else {
        detailBtn.classList.add('hidden');
    }

    const activateButton = (button) => {
        button.classList.add('bg-sky-600', 'text-white');
        button.classList.remove('bg-slate-100', 'text-slate-700');
    };
    const deactivateButton = (button) => {
        button.classList.add('bg-slate-100', 'text-slate-700');
        button.classList.remove('bg-sky-600', 'text-white');
    };

    if (tab === 'detail' && !hasDetail) {
        tab = 'paket';
    }

    if (tab === 'paket') {
        paketSection.classList.remove('hidden');
        detailSection.classList.add('hidden');
        globalSection.classList.add('hidden');
        activateButton(paketBtn);
        deactivateButton(detailBtn);
        deactivateButton(globalBtn);
        renderAdminPaketSoal();
    } else if (tab === 'detail') {
        paketSection.classList.add('hidden');
        detailSection.classList.remove('hidden');
        globalSection.classList.add('hidden');
        deactivateButton(paketBtn);
        activateButton(detailBtn);
        deactivateButton(globalBtn);
        renderAdminDetailPaket();
    } else {
        paketSection.classList.add('hidden');
        detailSection.classList.add('hidden');
        globalSection.classList.remove('hidden');
        deactivateButton(paketBtn);
        deactivateButton(detailBtn);
        activateButton(globalBtn);
        renderAdminQuestions();
    }
}

function renderAdminPaketSoal() {
    const tbody = document.getElementById('paket-soal-table-body');
    if (!tbody) return;

    if (!Array.isArray(db.questions)) db.questions = [];
    const paketData = {};
    db.questions.forEach(question => {
        const mapel = question.mapel || 'Unknown';
        const rombel = question.rombel || 'Unknown';
        const key = `${mapel}||${rombel}`;
        if (!paketData[key]) {
            paketData[key] = { mapel, rombel, pg: 0, pgk: 0, bs: 0, u: 0, m: 0, total: 0 };
        }
        const group = paketData[key];
        group.total += 1;
        if (question.type === 'single') group.pg += 1;
        else if (question.type === 'multiple') group.pgk += 1;
        else if (question.type === 'tf') group.bs += 1;
        else if (question.type === 'text') group.u += 1;
        else if (question.type === 'matching') group.m += 1;
        else group.m += 1;
    });

    const rows = Object.values(paketData).sort((a, b) => {
        let aVal, bVal;
        if (currentSortBy === 'mapel') {
            aVal = a.mapel;
            bVal = b.mapel;
        } else {
            // for rombel, try numerical sort
            const aNum = parseInt(a.rombel.replace(/\D/g, '')) || 0;
            const bNum = parseInt(b.rombel.replace(/\D/g, '')) || 0;
            if (aNum !== bNum) {
                aVal = aNum;
                bVal = bNum;
            } else {
                aVal = a.rombel;
                bVal = b.rombel;
            }
        }
        if (currentSortOrder === 'asc') {
            return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
        } else {
            return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
        }
    }).map(group => {
        const safeMapel = escapeHtml(group.mapel);
        const safeRombel = escapeHtml(group.rombel);
        const key = `${group.mapel}|${group.rombel}`;
        const currentJenis = db.jenisUjian && db.jenisUjian[key] ? db.jenisUjian[key] : 'Ujian Semester';

        return `
                    <tr class="hover:bg-slate-50 transition-colors">
                        <td class="px-4 py-4 font-bold text-slate-700">${safeMapel}</td>
                        <td class="px-4 py-4 text-slate-600">${safeRombel}</td>
                        <td class="px-4 py-4 text-center">
                            <select onchange="handleJenisUjianChange('${safeMapel}', '${safeRombel}', this.value)" 
                                class="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-bold text-slate-600 outline-none focus:ring-1 focus:ring-sky-500">
                                <option value="Ujian Semester" ${currentJenis === 'Ujian Semester' ? 'selected' : ''}>Ujian Semester</option>
                                <option value="Ulangan Harian" ${currentJenis === 'Ulangan Harian' ? 'selected' : ''}>Ulangan Harian</option>
                                <option value="PTS" ${currentJenis === 'PTS' ? 'selected' : ''}>PTS</option>
                                <option value="PAS" ${currentJenis === 'PAS' ? 'selected' : ''}>PAS</option>
                                <option value="ASAS" ${currentJenis === 'ASAS' ? 'selected' : ''}>ASAS</option>
                                <option value="ASAT" ${currentJenis === 'ASAT' ? 'selected' : ''}>ASAT</option>
                                <option value="ASAJ" ${currentJenis === 'ASAJ' ? 'selected' : ''}>ASAJ</option>
                                <option value="Ujian Sekolah" ${currentJenis === 'Ujian Sekolah' ? 'selected' : ''}>Ujian Sekolah</option>
                                <option value="Try Out" ${currentJenis === 'Try Out' ? 'selected' : ''}>Try Out</option>
                                <option value="HIDDEN" ${currentJenis === 'HIDDEN' ? 'selected' : ''}>🚫 SEMBUNYIKAN</option>
                                <option value="CUSTOM" ${!['Ujian Semester', 'Ulangan Harian', 'PTS', 'PAS', 'ASAS', 'ASAT', 'ASAJ', 'Ujian Sekolah', 'Try Out', 'HIDDEN'].includes(currentJenis) ? 'selected' : ''}>📝 KUSTOM...</option>
                            </select>
                            ${!['Ujian Semester', 'Ulangan Harian', 'PTS', 'PAS', 'ASAS', 'ASAT', 'ASAJ', 'Ujian Sekolah', 'Try Out', 'HIDDEN', 'CUSTOM'].includes(currentJenis) ? `<div class="text-[9px] mt-1 text-sky-600 font-bold">${currentJenis}</div>` : ''}
                        </td>
                        <td class="px-4 py-4 text-center text-slate-700">${group.pg}</td>
                        <td class="px-4 py-4 text-center text-slate-700">${group.pgk}</td>
                        <td class="px-4 py-4 text-center text-slate-700">${group.bs}</td>
                        <td class="px-4 py-4 text-center text-slate-700">${group.u}</td>
                        <td class="px-4 py-4 text-center text-slate-700">${group.m}</td>
                        <td class="px-4 py-4 text-center font-black text-slate-800">${group.total}</td>
                        <td class="px-4 py-4 text-center">
                            <button data-mapel="${safeMapel}" data-rombel="${safeRombel}" onclick="openPaketSoalDetail(this.dataset.mapel, this.dataset.rombel)"
                                class="p-2 text-sky-400 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-colors" title="Lihat Detail">
                                <i class="fas fa-eye"></i>
                            </button>
                            <button data-mapel="${safeMapel}" data-rombel="${safeRombel}" onclick="deletePaketSoal(this.dataset.mapel, this.dataset.rombel)"
                                class="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Hapus Paket">
                                <i class="fas fa-trash"></i>
                            </button>
                        </td>
                    </tr>
                `;
    }).join('');

    tbody.innerHTML = rows || `
                <tr>
                    <td colspan="10" class="px-4 py-12 text-center text-slate-500 text-sm">
                        Belum ada paket soal. Tambahkan soal baru terlebih dahulu.
                    </td>
            `;
}

function handleJenisUjianChange(mapel, rombel, value) {
    if (value === 'CUSTOM') {
        const customValue = prompt('Masukkan nama jenis ujian kustom:', '');
        if (customValue !== null && customValue.trim() !== '') {
            setJenisUjian(mapel, rombel, customValue.trim());
        } else {
            renderAdminPaketSoal(); // Refresh to reset select if cancelled
        }
    } else {
        setJenisUjian(mapel, rombel, value);
    }
}

function setJenisUjian(mapel, rombel, value) {
    if (!db.jenisUjian) db.jenisUjian = {};
    const key = `${mapel}|${rombel}`;
    db.jenisUjian[key] = value;
    save();
    showToast(`Jenis ujian untuk ${mapel} ${rombel} diatur ke: ${value}`, 'success');
    renderAdminPaketSoal();
}

function renderAdminDetailPaket() {
    const tbody = document.getElementById('detail-paket-table-body');
    const subtitle = document.getElementById('detail-paket-description');
    if (!tbody || !subtitle) return;

    if (!currentDetailPackage) {
        subtitle.textContent = 'Pilih sebuah paket soal untuk melihat daftar pertanyaan.';
        tbody.innerHTML = `
                    <tr>
                        <td colspan="7" class="px-4 py-12 text-center text-slate-500 text-sm">
                            Belum ada paket yang dipilih.
                        </td>
                    </tr>
                `;
        return;
    }

    const { mapel, rombel } = currentDetailPackage;
    const filtered = db.questions.filter(q => q.mapel === mapel && q.rombel === rombel);
    subtitle.textContent = `Mapel ${mapel} • Rombel ${rombel} • ${filtered.length} soal`;

    const rows = filtered.map((q, idx) => {
        let typeName = { 'single': 'Pilihan Ganda', 'multiple': 'PG Kompleks', 'text': 'Uraian', 'tf': 'Benar/Salah', 'matching': 'Menjodohkan' }[q.type || 'single'] || 'Pilihan Ganda';
        let corrText = '';
        if (q.type === 'multiple') {
            corrText = (Array.isArray(q.correct) ? q.correct.map(x => ['A', 'B', 'C', 'D'][x]).join(',') : q.correct);
        } else if (q.type === 'text') {
            corrText = 'Teks';
        } else if (q.type === 'tf') {
            if (Array.isArray(q.options)) {
                corrText = q.options.map((stmt, j) => {
                    const val = Array.isArray(q.correct) ? q.correct[j] : false;
                    return `${stmt} (${val ? 'Benar' : 'Salah'})`;
                }).join(' / ');
            } else {
                corrText = 'Benar/Salah';
            }
        } else if (q.type === 'matching') {
            corrText = 'Match';
        } else {
            corrText = ['A', 'B', 'C', 'D'][q.correct];
        }

        // Generate image column HTML
        let imageColHtml = '<span class="text-slate-400">-</span>';
        if (q.images && Array.isArray(q.images) && q.images.length > 0) {
            const firstImg = normalizeImgSrc(q.images[0]);
            imageColHtml = `
                <div class="flex items-center gap-2">
                    <img src="${firstImg}" alt="Gambar" class="w-8 h-8 object-cover rounded border border-slate-200 cursor-zoom-in" 
                        onclick="event.stopPropagation(); Swal.fire({imageUrl: '${firstImg}', showConfirmButton: false, customClass: {popup: 'rounded-3xl border-none shadow-2xl'}})" title="Klik untuk perbesar">
                    <span class="text-[10px] font-bold text-sky-600 bg-sky-50 px-1.5 py-0.5 rounded">${q.images.length}</span>
                </div>
            `;
        } else if (q.image) {
            const imgSrc = normalizeImgSrc(q.image);
            imageColHtml = `
                <img src="${imgSrc}" alt="Gambar" class="w-8 h-8 object-cover rounded border border-slate-200 cursor-zoom-in" 
                    onclick="event.stopPropagation(); Swal.fire({imageUrl: '${imgSrc}', showConfirmButton: false, customClass: {popup: 'rounded-3xl border-none shadow-2xl'}})" title="Klik untuk perbesar">
            `;
        }

        return `
                    <tr class="hover:bg-slate-50 transition-colors">
                        <td class="px-4 py-4 text-slate-700">${idx + 1}</td>
                        <td class="px-4 py-4 text-slate-700 whitespace-pre-wrap break-words">${normalizeHtmlImages(q.text)}</td>
                        <td class="px-4 py-4 text-center">${imageColHtml}</td>
                        <td class="px-4 py-4 text-slate-700 overflow-hidden text-ellipsis">${escapeHtml(q.mapel)} / ${escapeHtml(q.rombel)}</td>
                        <td class="px-4 py-4 text-slate-700 whitespace-pre-wrap break-words">${escapeHtml(corrText)}</td>
                        <td class="px-4 py-4 text-slate-700">${typeName}</td>
                        <td class="px-4 py-4 text-center">
                            <button type="button" onclick="openEditQuestionModal(${db.questions.indexOf(q)})" class="p-2 text-sky-400 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-colors" title="Edit"><i class="fas fa-edit"></i></button>
                            <button type="button" onclick="deleteQuestion(${db.questions.indexOf(q)})" class="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Hapus"><i class="fas fa-trash"></i></button>
                        </td>
                    </tr>
                `;
    }).join('');

    tbody.innerHTML = rows || `
                <tr>
                    <td colspan="7" class="px-4 py-12 text-center text-slate-500 text-sm">
                        Paket soal ini belum memiliki pertanyaan.
                    </td>
                </tr>
            `;
}

async function renderAdminQuestions() {
    await ensureDataLoaded('questions');
    const fR = document.getElementById('filter-rombel').value;
    const fM = document.getElementById('filter-mapel').value;
    const searchTerm = document.getElementById('search-questions').value.toLowerCase();
    const tbody = document.getElementById('questions-table-body');
    const selectAllCheckbox = document.getElementById('admin-select-all-checkbox');

    let filtered = db.questions.filter(q => (fR === 'ALL' || q.rombel === fR) && (fM === 'ALL' || q.mapel === fM));

    // Apply search filter
    if (searchTerm) {
        filtered = filtered.filter(q => q.text.toLowerCase().includes(searchTerm));
    }

    // Update statistics
    document.getElementById('total-questions').textContent = db.questions.length;
    document.getElementById('filtered-questions').textContent = filtered.length;
    document.getElementById('total-count').textContent = db.questions.length;
    document.getElementById('filtered-count').textContent = filtered.length;

    const allSelected = filtered.length > 0 && filtered.every(q => selectedAdminQuestions.has(q));
    if (selectAllCheckbox) selectAllCheckbox.checked = allSelected;

    tbody.innerHTML = filtered.map((q, i) => {
        let typeName = { 'single': 'Pilihan Ganda', 'multiple': 'PG Kompleks', 'text': 'Uraian', 'tf': 'Benar/Salah', 'matching': 'Menjodohkan' }[q.type || 'single'] || 'Pilihan Ganda';
        let corrText = '';
        if (q.type === 'multiple') {
            corrText = (Array.isArray(q.correct) ? q.correct.map(x => ['A', 'B', 'C', 'D'][x]).join(',') : q.correct);
        } else if (q.type === 'text') {
            corrText = 'Teks';
        } else if (q.type === 'tf') {
            if (Array.isArray(q.options)) {
                corrText = q.options.map((stmt, j) => {
                    const val = Array.isArray(q.correct) ? q.correct[j] : false;
                    return `${stmt} (${val ? 'Benar' : 'Salah'})`;
                }).join(' / ');
            } else {
                corrText = 'Benar/Salah';
            }
        } else if (q.type === 'matching') {
            corrText = 'Match';
        } else {
            corrText = ['A', 'B', 'C', 'D'][q.correct];
        }
        const originalIndex = db.questions.indexOf(q);
        return `
                <tr class="hover:bg-slate-50 transition-colors">
                    <td class="px-6 py-4 text-center">
                        <div class="flex items-center justify-center gap-2">
                            <input type="checkbox" id="admin-select-${originalIndex}" data-index="${originalIndex}" class="rounded border-slate-300 text-sky-600 focus:ring-sky-500" ${selectedAdminQuestions.has(q) ? 'checked' : ''} onclick="toggleAdminQuestionSelection(event)">
                            <div class="flex flex-col gap-1 items-center">
                                <span class="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded">${originalIndex + 1}</span>
                                <div class="flex gap-1">
                                    <button type="button" onclick="moveQuestionUp(${originalIndex})" class="text-slate-400 hover:text-slate-600 text-xs p-1 rounded hover:bg-slate-100 transition-colors ${originalIndex === 0 ? 'opacity-50 cursor-not-allowed' : ''}" ${originalIndex === 0 ? 'disabled' : ''}><i class="fas fa-chevron-up"></i></button>
                                    <button type="button" onclick="moveQuestionDown(${originalIndex})" class="text-slate-400 hover:text-slate-600 text-xs p-1 rounded hover:bg-slate-100 transition-colors ${originalIndex === db.questions.length - 1 ? 'opacity-50 cursor-not-allowed' : ''}" ${originalIndex === db.questions.length - 1 ? 'disabled' : ''}><i class="fas fa-chevron-down"></i></button>
                                </div>
                            </div>
                        </div>
                    </td>
                    <td class="px-6 py-4">
                        <div class="whitespace-pre-wrap break-words font-bold mb-1">${normalizeHtmlImages(q.text)}</div>
                        ${q.type === 'tf' && Array.isArray(q.options) && q.options.length > 0 ? `
                            <div class="mt-2 pl-3 border-l-2 border-sky-200 space-y-1">
                                ${q.options.map((opt, idx) => `<div class="text-xs text-slate-600"><span class="font-bold text-sky-600 mr-1">${idx + 1}.</span> ${opt}</div>`).join('')}
                            </div>
                        ` : ''}
                        ${(q.images && Array.isArray(q.images) && q.images.length > 0) ? `
                            <div class="flex items-center gap-2 mt-1">
                                <img src="${normalizeImgSrc(q.images[0])}" class="w-8 h-8 object-cover rounded border border-slate-200 cursor-zoom-in" onclick="Swal.fire({imageUrl: '${normalizeImgSrc(q.images[0])}', showConfirmButton: false, customClass: {popup: 'rounded-3xl border-none shadow-2xl'}})">
                                <span class="text-[10px] font-bold text-sky-600 bg-sky-50 px-1.5 py-0.5 rounded">${q.images.length} Gambar</span>
                            </div>
                        ` : (q.image ? `
                            <div class="flex items-center gap-2 mt-1">
                                <img src="${normalizeImgSrc(q.image)}" class="w-8 h-8 object-cover rounded border border-slate-200 cursor-zoom-in" onclick="Swal.fire({imageUrl: '${normalizeImgSrc(q.image)}', showConfirmButton: false, customClass: {popup: 'rounded-3xl border-none shadow-2xl'}})">
                                <span class="text-[10px] font-bold text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded">1 Gambar</span>
                            </div>
                        ` : '')}
                    </td>
                    <td class="px-6 py-4">
                        <div class="flex flex-col gap-1 items-start">
                            <span class="px-3 py-1 bg-sky-100 text-sky-700 rounded-full text-[10px] font-bold text-center inline-block break-words">${q.mapel}</span>
                            <span class="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-[10px] font-bold text-center inline-block break-words">${q.rombel}</span>
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
            `}).join('');

    // Show empty state if no questions
    if (filtered.length === 0) {
        tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="px-6 py-12 text-center">
                        <div class="flex flex-col items-center gap-3">
                            <i class="fas fa-inbox text-4xl text-slate-300"></i>
                            <p class="text-slate-500 text-sm">Tidak ada soal ditemukan</p>
                            <p class="text-slate-400 text-xs">Coba ubah filter atau tambah soal baru</p>
                        </div>
                    </td>
                </tr>
                `;
    }
}

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
    renderAdminQuestions();
}

function toggleAdminSelectAll(event) {
    const checked = event.target.checked;
    const fR = document.getElementById('filter-rombel').value;
    const fM = document.getElementById('filter-mapel').value;
    const filtered = db.questions.filter(q => (fR === 'ALL' || q.rombel === fR) && (fM === 'ALL' || q.mapel === fM));
    filtered.forEach(q => {
        if (checked) {
            selectedAdminQuestions.add(q);
        } else {
            selectedAdminQuestions.delete(q);
        }
    });
    renderAdminQuestions();
}

function deleteSelectedAdminQuestions() {
    if (selectedAdminQuestions.size === 0) {
        return alert('Pilih soal yang ingin dihapus terlebih dahulu.');
    }
    if (!confirm(`Hapus ${selectedAdminQuestions.size} soal terpilih?`)) return;
    loadedCollections.questions = true;
    db.questions = db.questions.filter(q => !selectedAdminQuestions.has(q));
    selectedAdminQuestions.clear();
    save();
    renderAdminQuestions();
}

function deleteTeacherFilteredQuestions() {
    if (!currentSiswa || currentSiswa.role !== 'teacher') return;

    const fM = document.getElementById('teacher-filter-mapel')?.value || '';
    const fR = document.getElementById('teacher-filter-rombel')?.value || '';

    // Find questions that belong to the teacher AND match current filters
    const toDelete = db.questions.filter(q => {
        const qSubject = typeof q.mapel === 'string' ? q.mapel : q.mapel?.name || q.mapel;
        // Must be teacher's subject
        if (!teacherSubjectNames(currentSiswa).includes(qSubject)) return false;
        // Must be in teacher's allowed rombels for that subject
        const allowed = teacherAllowedRombels(currentSiswa, qSubject);
        if (!allowed.includes(q.rombel)) return false;
        // Apply mapel filter
        if (fM && qSubject !== fM) return false;
        // Apply rombel filter
        if (fR && q.rombel !== fR) return false;
        return true;
    });

    if (toDelete.length === 0) {
        alert('Tidak ada soal yang sesuai dengan filter saat ini.');
        return;
    }

    const mapelLabel = fM || 'Semua Mapel';
    const rombelLabel = fR || 'Semua Rombel';
    const msg = `Anda akan menghapus ${toDelete.length} soal dengan filter:\n\n• Mapel: ${mapelLabel}\n• Rombel: ${rombelLabel}\n\nTindakan ini tidak dapat dibatalkan. Lanjutkan?`;

    if (!confirm(msg)) return;

    // Build a Set of references to delete
    loadedCollections.questions = true;
    const deleteSet = new Set(toDelete);
    db.questions = db.questions.filter(q => !deleteSet.has(q));

    selectedTeacherQuestions.clear();
    save();
    renderTeacherQuestions();
    updateStats();
    alert(`${toDelete.length} soal berhasil dihapus.`);
}

function updateAdminAccount() {
    const admin = db.students.find(x => x.role === 'admin');
    if (!admin) return alert('Administrator tidak ditemukan.');
    const oldPass = document.getElementById('set-admin-old-pass').value;
    const newId = document.getElementById('set-admin-id').value.trim();
    const newPass = document.getElementById('set-admin-new-pass').value;

    if (oldPass !== admin.password) return alert('Password saat ini salah.');
    if (newId) admin.id = newId;
    if (newPass) admin.password = newPass;
    save();
    alert('Perubahan tersimpan.');
    showAdminSection('settings');
}

async function renderAdminResults() {
    await ensureDataLoaded('results');
    const tbody = document.getElementById('results-table-body');
    const from = document.getElementById('results-date-from')?.value;
    const to = document.getElementById('results-date-to')?.value;
    const fromTs = from ? new Date(from + 'T00:00:00').getTime() : null;
    const toTs = to ? new Date(to + 'T23:59:59').getTime() : null;

    const rows = db.results
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
                    <td class="px-6 py-4 font-bold">${r.studentName}</td>
                    <td class="px-6 py-4 text-xs">${r.rombel}</td>
                    <td class="px-6 py-4 text-xs font-medium">${r.mapel}</td>
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

async function batchAiCorrectAllStudents() {
    // Ensure server is reachable before starting
    const serverOk = await pingBackend();
    if (!serverOk) {
        const currentBase = getApiBaseUrl() || window.location.origin;
        alert(`⚠️ Gagal terhubung ke server!\n\nAlamat: ${currentBase}\n\nPastikan server aktif dan alamat server di Pengaturan Admin sudah benar.`);
        return;
    }

    // Determine which results are currently visible
    const isTeacher = document.getElementById('teacher-dashboard') && !document.getElementById('teacher-dashboard').classList.contains('hidden');
    let poolResults = []; // { resultIdx, result }

    if (isTeacher && currentSiswa && currentSiswa.subjects) {
        const selectedMapel = document.getElementById('teacher-results-filter-mapel')?.value || '';
        const selectedRombel = document.getElementById('teacher-results-filter-rombel')?.value || '';
        db.results.forEach((r, i) => {
            if (r.deleted) return;
            if (!teacherSubjectNames(currentSiswa).includes(r.mapel)) return;
            const allowed = teacherAllowedRombels(currentSiswa, r.mapel);
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

        db.results.forEach((r, i) => {
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

    // COLLECT ALL WORK ITEMS (Uncorrected Essays)
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

    // GROUP BY QUESTION
    const groupsMap = new Map(); // questionKey -> Array of workItems
    workItems.forEach(item => {
        const key = `${item.qText}|${item.refAns}`;
        if (!groupsMap.has(key)) groupsMap.set(key, []);
        groupsMap.get(key).push(item);
    });

    const uniqueQuestionsCount = groupsMap.size;
    const totalTasks = workItems.length;

    if (!confirm(`Terdapat ${totalTasks} tugas koreksi esai dari ${poolResults.length} siswa.\n\nSistem akan menggunakan "Koreksi Cepat" (batch 5 jawaban sekaligus) agar lebih efisien dan hemat kuota.\n\nLanjutkan?`)) return;

    // Show progress overlay
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

    // Process groups (Batching by 5 for efficiency)
    const keys = Array.from(groupsMap.keys());
    for (const key of keys) {
        const groupItems = groupsMap.get(key);
        const qText = groupItems[0].qText;
        const refAns = groupItems[0].refAns;

        if (qLabel) qLabel.textContent = `Mengoreksi: ${groupItems[0].result.mapel}`;
        if (sLabel) sLabel.textContent = `Soal: "${qText.substring(0, 30)}..."`;

        // Split group into chunks of 5
        for (let i = 0; i < groupItems.length; i += 5) {
            const chunk = groupItems.slice(i, i + 5);
            const studentAnswers = chunk.map(item => item.studentAns);

            try {
                const res = await fetch(getApiBaseUrl() + '/api/ai-correct-essay-batch', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        questionText: qText,
                        referenceAnswer: refAns,
                        studentAnswers: studentAnswers,
                        teacherId: currentSiswa ? currentSiswa.id : null
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
                console.error(`[AI-Correction] Batch Error:`, e.message);
                errorTotal += chunk.length;
                finishedCount += chunk.length;
                chunk.forEach(item => affectedResultIndices.add(item.resultIdx));
            }

            // Update progress
            const pct = Math.round((finishedCount / totalTasks) * 100);
            if (progressBar) progressBar.style.width = pct + '%';
            if (counterEl) counterEl.textContent = `${finishedCount} / ${totalTasks} jawaban`;
        }
    }

    // RECALCULATE ALL AFFECTED STUDENT SCORES
    if (qLabel) qLabel.textContent = 'Menghitung ulang nilai akhir...';
    affectedResultIndices.forEach(idx => {
        const r = db.results[idx];
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
    try { await save(); } catch (e) { console.error('[AI-Group] Final save error:', e.message); }

    overlay.remove();

    // Refresh UI
    const adminDash = document.getElementById('admin-dashboard');
    const teacherDash = document.getElementById('teacher-dashboard');
    if (adminDash && !adminDash.classList.contains('hidden')) renderAdminResults();
    else if (teacherDash && !teacherDash.classList.contains('hidden')) renderTeacherResults();

    const msg = errorTotal === 0
        ? `✅ Selesai! ${successTotal} jawaban esai berhasil dikoreksi.`
        : `⚠️ ${successTotal} berhasil, ${errorTotal} gagal dari total ${totalTasks} jawaban.`;
    alert(msg);
}

async function syncAdminLiveState() {
    const adminSection = document.getElementById('admin-rombel');
    const teacherProgressSection = document.getElementById('teacher-tab-live-progress');
    const isAdminActive = adminSection && !adminSection.classList.contains('hidden');
    const isTeacherProgressActive = teacherProgressSection && !teacherProgressSection.classList.contains('hidden');

    if (!isAdminActive && !isTeacherProgressActive) return false;

    try {
        let changed = false;
        const now = Date.now();
        const fiveMinMs = 5 * 60 * 1000;
        const norm = v => String(v || '').trim().toLowerCase();

        // Load local state from other tabs (optional but good for consistency)
        const other = await loadLocalDb();

        // Fetch from server if online
        let serverExams = [];
        if (navigator.onLine) {
            try {
                serverExams = await fetchLiveExamsFromServer();
            } catch (e) {
                console.warn('[syncAdminLiveState] Server fetch failed:', e.message);
            }
        }

        // Merge logic
        const mergedExams = {};

        // 1. Add local exams first (fallback)
        const localExams = Array.isArray(db.activeExams) ? db.activeExams : ((other && Array.isArray(other.activeExams)) ? other.activeExams : []);
        localExams.forEach(exam => {
            if (!exam || !exam.studentId || !exam.mapel) return;
            const key = `${norm(exam.studentId)}|${norm(exam.mapel)}`;
            // Preserve age filtering for local data
            const updatedAt = parseLiveExamTimestamp(exam.updatedAt);
            if (now - updatedAt < fiveMinMs) {
                mergedExams[key] = exam;
            }
        });

        // 2. Override with Server Exams (Precedence)
        serverExams.forEach(exam => {
            if (!exam || !exam.studentId || !exam.mapel) return;
            const key = `${norm(exam.studentId)}|${norm(exam.mapel)}`;
            // Mark server data as "Trusted" (Skip aggressive age check locally if server says OK)
            exam.isActive = true;
            mergedExams[key] = exam;
        });

        const finalExams = Object.values(mergedExams);

        // Update in-memory db
        const oldLen = (db.activeExams || []).length;
        const newLen = finalExams.length;

        let contentChanged = oldLen !== newLen;
        if (!contentChanged && newLen > 0) {
            // Shallow check for timestamp changes or percentage changes
            contentChanged = finalExams.some((exam) => {
                const old = (db.activeExams || []).find(oe => norm(oe.studentId) === norm(exam.studentId) && norm(oe.mapel) === norm(exam.mapel));
                return !old || old.updatedAt !== exam.updatedAt || old.percentage !== exam.percentage || old.currentQuestionNumber !== exam.currentQuestionNumber;
            });
        }

        db.activeExams = finalExams;

        if (contentChanged || (oldLen === 0 && newLen > 0)) {
            changed = true;
            await saveLocalDb(); // Ensure persistence for other tabs
        }

        return changed;
    } catch (err) {
        console.warn('Gagal sinkronisasi admin live state:', err.message || err);
        return false;
    }
}

