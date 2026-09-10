/**
 * js/modules/siswa.js
 * Part of CBT application refactored module
 */

function saveExamProgress() {
    saveStudentExamProgress();
    showToast('Jawaban siswa telah disimpan.', 'success');
}

function saveExamProgressAndReload() {
    saveStudentExamProgress();
    showToast('Jawaban tersimpan. Memuat ulang halaman...', 'info');
    reloadPage();
}

async function saveLiveProgressState(requestReload = false) {
    showToast(requestReload ? 'Memerintahkan RELOAD kepada semua siswa...' : 'Menyimpan live progress semua siswa...', 'info');
    try {
        // Step 1: Save general DB
        await save({ forceServerSave: true });

        // Step 2: Save each active exam individually to the live store
        const savedCount = await saveAllLiveProgress(requestReload);

        showToast(`Berhasil ${requestReload ? 'reload & simpan' : 'menyimpan'} ${savedCount} progres siswa.`, 'success');
        if (typeof renderRombelProgress === 'function') renderRombelProgress();
    } catch (err) {
        console.warn('[saveLiveProgressState] error:', err.message || err);
        showToast('Gagal menyimpan live progress.', 'error');
    }
}

async function saveAllLiveProgress(forceReload = false) {
    if (!db.activeExams || !db.activeExams.length) return 0;

    console.log('[saveAllLiveProgress] Saving all active exams:', db.activeExams.length, 'forceReload:', forceReload);
    let count = 0;

    // Use for...of for sequential execution to avoid flooding the server
    for (const exam of db.activeExams) {
        if (!exam.studentId || !exam.mapel) continue;

        try {
            console.log(`[saveAllLiveProgress] Saving for: ${exam.studentName} (${exam.studentId})`);

            const saveEntry = {
                ...exam,
                adminSaveRequest: true,
                adminReloadRequest: forceReload ? Date.now() : (exam.adminReloadRequest || false),
                adminSaveConfirmed: true,
                updatedAt: Date.now(),
                savedByAdminCommand: true,
                adminSavedProgress: {
                    studentId: exam.studentId,
                    studentName: exam.studentName,
                    rombel: exam.rombel,
                    mapel: exam.mapel,
                    answers: Array.isArray(exam.answers) ? exam.answers : [],
                    currentIdx: typeof exam.currentIdx === 'number' ? exam.currentIdx : 0,
                    ragu: Array.isArray(exam.ragu) ? exam.ragu : [],
                    totalSeconds: exam.totalSeconds || 0,
                    remainingSeconds: exam.timeRemaining || exam.remainingSeconds || 0,
                    savedAt: Date.now()
                }
            };

            await sendLiveExamToServer(saveEntry);
            count++;

            // Tiny delay to be gentle on local network/server
            if (db.activeExams.length > 5) await new Promise(r => setTimeout(r, 50));
        } catch (e) {
            console.warn(`[saveAllLiveProgress] Failed to save for ${exam.studentId}:`, e.message);
        }
    }

    await saveLocalDb();
    return count;
}

async function saveLiveProgressStateAndReload() {
    await saveLiveProgressState(true);
    reloadPage();
}

isExamActive = false;

let cheatingCount = 0;

let wakeLock = null;

let isFullscreen = false;

let examStartTime = null;

let examSecondsRemaining = 0;

function handleCheating(reason) {
    if (!isExamActive) return;

    // Increment cheat count
    cheatingCount++;
    console.warn(`Anti-Cheat Triggered: ${reason} (Attempt: ${cheatingCount})`);

    if (cheatingCount >= 3) {
        // Final Strike - Auto Submit
        isExamActive = false;
        alert('UJIAN DIBERHENTIKAN! Anda terdeteksi melakukan kecurangan berkali-kali. Jawaban Anda telah dikirim.');
        submitExam();
    } else {
        // First or Second Warning
        const attemptsLeft = 3 - cheatingCount;
        const warningMsg = attemptsLeft === 1 ? 'Peringatan Terakhir!' : `Peringatan ${cheatingCount}!`;

        document.getElementById('cheat-warning-modal').classList.remove('hidden');
        document.getElementById('cheat-warning-modal').classList.add('flex');

        // (Optional) Update modal text if there's a specific element for it
        const warningText = document.getElementById('cheat-warning-text');
        if (warningText) {
            warningText.innerText = `${reason}. ${warningMsg} Jika terdeteksi lagi, ujian akan dihentikan secara otomatis.`;
        }
    }
}

function closeCheatWarning() {
    document.getElementById('cheat-warning-modal').classList.add('hidden');
    document.getElementById('cheat-warning-modal').classList.remove('flex');
}

async function requestFullscreen() {
    console.log('Attempting to request browser fullscreen API...');

    // Don't interfere if CSS simulation is already active
    if (isFullscreen) {
        console.log('CSS fullscreen already active, skipping API request');
        return;
    }

    // Check if fullscreen is supported and enabled
    const fullscreenEnabled = document.fullscreenEnabled ||
        document.webkitFullscreenEnabled ||
        document.msFullscreenEnabled ||
        document.mozFullScreenEnabled ||
        false;

    if (!fullscreenEnabled) {
        console.warn('Browser fullscreen not supported, relying on CSS simulation');
        return;
    }

    try {
        const elem = document.documentElement;

        // Try different fullscreen methods
        if (elem.requestFullscreen) {
            console.log('Using requestFullscreen');
            await elem.requestFullscreen();
        } else if (elem.webkitRequestFullscreen) {
            console.log('Using webkitRequestFullscreen');
            await elem.webkitRequestFullscreen();
        } else if (elem.webkitEnterFullscreen) {
            console.log('Using webkitEnterFullscreen');
            await elem.webkitEnterFullscreen();
        } else if (elem.msRequestFullscreen) {
            console.log('Using msRequestFullscreen');
            await elem.msRequestFullscreen();
        } else if (elem.mozRequestFullScreen) {
            console.log('Using mozRequestFullScreen');
            await elem.mozRequestFullScreen();
        } else {
            console.warn('No fullscreen API available');
            return;
        }

        // Check if fullscreen was actually entered
        setTimeout(() => {
            const isInFullscreen = document.fullscreenElement ||
                document.webkitFullscreenElement ||
                document.msFullscreenElement ||
                document.mozFullScreenElement;

            if (isInFullscreen) {
                console.log('Browser fullscreen API succeeded');
                isFullscreen = true;
            } else {
                console.log('Browser fullscreen API did not activate, CSS simulation will handle it');
            }
        }, 200);

    } catch (error) {
        console.warn('Browser fullscreen request failed:', error);
        console.log('Relying on CSS fullscreen simulation');
    }
}

function simulateFullscreen() {
    console.log('Activating CSS fullscreen simulation');

    // Create fullscreen overlay if it doesn't exist
    let overlay = document.getElementById('exam-fullscreen-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'exam-fullscreen-overlay';
        overlay.style.cssText = `
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100vw;
                    height: 100vh;
                    background: transparent;
                    z-index: -1;
                    pointer-events: none;
                `;
        document.body.appendChild(overlay);
    }

    // Apply aggressive fullscreen styles
    document.body.style.cssText += `
                position: fixed !important;
                top: 0 !important;
                left: 0 !important;
                width: 100vw !important;
                height: 100vh !important;
                margin: 0 !important;
                padding: 0 !important;
                overflow: hidden !important;
                z-index: 10001 !important;
            `;

    // Hide html scrollbars and margins
    document.documentElement.style.cssText += `
                overflow: hidden !important;
                margin: 0 !important;
                padding: 0 !important;
                width: 100vw !important;
                height: 100vh !important;
            `;

    // Hide all browser UI elements
    const style = document.createElement('style');
    style.id = 'exam-fullscreen-styles';
    style.textContent = `
                * {
                    -webkit-touch-callout: none !important;
                    -webkit-user-select: none !important;
                    -khtml-user-select: none !important;
                    -moz-user-select: none !important;
                    -ms-user-select: none !important;
                    user-select: none !important;
                }
                html, body {
                    cursor: default !important;
                }
                /* Hide browser UI */
                ::-webkit-scrollbar {
                    display: none !important;
                }
                /* Mobile specific */
                @media screen and (max-width: 768px) {
                    html, body {
                        -webkit-text-size-adjust: 100% !important;
                        -ms-text-size-adjust: 100% !important;
                    }
                }
            `;
    document.head.appendChild(style);

    isFullscreen = true;
    console.log('CSS fullscreen simulation activated successfully');

    // Force layout recalculation
    document.body.offsetHeight;
}

function exitSimulatedFullscreen() {
    console.log('Deactivating CSS fullscreen simulation');

    // Remove overlay
    const overlay = document.getElementById('exam-fullscreen-overlay');
    if (overlay) {
        overlay.remove();
    }

    // Remove custom styles
    const style = document.getElementById('exam-fullscreen-styles');
    if (style) {
        style.remove();
    }

    // Reset body styles
    document.body.style.cssText = '';
    document.body.removeAttribute('style');

    // Reset html styles
    document.documentElement.style.cssText = '';
    document.documentElement.removeAttribute('style');

    isFullscreen = false;
    console.log('CSS fullscreen simulation deactivated');
}

async function requestWakeLock() {
    try {
        if ('wakeLock' in navigator) {
            wakeLock = await navigator.wakeLock.request('screen');
            console.log('Wake lock activated');
        }
    } catch (error) {
        console.warn('Failed to request wake lock:', error);
    }
}

function releaseWakeLock() {
    if (wakeLock) {
        wakeLock.release();
        wakeLock = null;
        console.log('Wake lock released');
    }
}

function exitFullscreen() {
    try {
        const isBrowserFullscreen = document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement || document.mozFullScreenElement;

        if (isBrowserFullscreen) {
            if (document.exitFullscreen) {
                const promise = document.exitFullscreen();
                if (promise && typeof promise.catch === 'function') {
                    promise.catch(err => console.warn('Exit fullscreen caught:', err));
                }
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            } else if (document.msExitFullscreen) {
                document.msExitFullscreen();
            } else if (document.mozCancelFullScreen) {
                document.mozCancelFullScreen();
            }
        }
    } catch (error) {
        console.warn('Failed to exit fullscreen:', error);
    } finally {
        // Also exit simulated fullscreen
        try {
            exitSimulatedFullscreen();
        } catch (e) {
            console.warn('Failed to exit simulated fullscreen:', e);
        }
        isFullscreen = false;
    }
}

function checkFullscreenStatus() {
    // For CSS simulation, we don't need to check browser fullscreen state
    if (isFullscreen) {
        console.log('CSS fullscreen simulation is active');
        return;
    }

    const isInBrowserFullscreen = document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.msFullscreenElement ||
        document.mozFullScreenElement;

    if (isExamActive && !isInBrowserFullscreen) {
        console.log('Detected exit from browser fullscreen, attempting to restore');
        handleCheating('Keluar dari mode layar penuh');
        // Force back to fullscreen
        setTimeout(() => {
            if (isExamActive) {
                if (isMobileDevice()) {
                    requestMobileFullscreen();
                } else {
                    requestFullscreen();
                }
            }
        }, 500);
    }
}

// Anti-Cheat Event Listeners
document.addEventListener('visibilitychange', () => {
    if (isExamActive) {
        if (document.visibilityState === 'hidden') {
            const cheatMask = document.getElementById('cheat-mask');
            if (cheatMask) {
                cheatMask.classList.remove('hidden');
                cheatMask.classList.add('flex');
            }
            handleCheating('Berpindah tab/aplikasi');
        } else {
            const cheatMask = document.getElementById('cheat-mask');
            if (cheatMask) {
                cheatMask.classList.add('hidden');
                cheatMask.classList.remove('flex');
            }
        }
    }
});

window.addEventListener('blur', () => {
    if (isExamActive) {
        if (typeof isMobileDevice === 'function' && isMobileDevice()) {
            const widthDiff = Math.abs(window.innerWidth - window.screen.width);
            if (widthDiff <= 25) return;
        }
        handleCheating('Meninggalkan jendela ujian');
    }
});

document.addEventListener('contextmenu', e => isExamActive && e.preventDefault());
document.addEventListener('copy', e => isExamActive && e.preventDefault());
document.addEventListener('cut', e => isExamActive && e.preventDefault());
document.addEventListener('paste', e => isExamActive && e.preventDefault());
document.addEventListener('selectstart', e => isExamActive && e.preventDefault());

document.addEventListener('keydown', e => {
    if (isExamActive) {
        if (e.key === 'PrintScreen' || e.keyCode === 44) {
            e.preventDefault();
            handleCheating('Screenshot terdeteksi');
        }
        if (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C')) e.preventDefault();
        if (e.key === 'F12') e.preventDefault();
        if (e.key === 'Escape' || e.key === 'F11') {
            e.preventDefault();
            handleCheating('Mencoba keluar dari mode layar penuh');
        }
    }
});

document.addEventListener('fullscreenchange', checkFullscreenStatus);
document.addEventListener('webkitfullscreenchange', checkFullscreenStatus);
document.addEventListener('mozfullscreenchange', checkFullscreenStatus);
document.addEventListener('MSFullscreenChange', checkFullscreenStatus);

window.addEventListener('resize', () => {
    if (isExamActive && isFullscreen) {
        const currentWidth = window.innerWidth;
        const currentHeight = window.innerHeight;
        const screenWidth = window.screen.width;
        const screenHeight = window.screen.height;

        const widthDiff = Math.abs(currentWidth - screenWidth);
        const heightDiff = Math.abs(currentHeight - screenHeight);

        if (typeof isMobileDevice === 'function' && isMobileDevice()) {
            if (widthDiff <= 25) return;
        }

        if (widthDiff > 20 || heightDiff > 20) {
            console.log('Window resize detected during exam, possible fullscreen exit attempt');
            handleCheating('Perubahan ukuran jendela terdeteksi');
            setTimeout(() => {
                if (isExamActive) {
                    simulateFullscreen();
                }
            }, 200);
        }
    }
});

// currentSiswa is declared globally in app-state.js

let editQuestionIndex = null;

let liveExamInterval = null;

async function requestMobileFullscreen() {
    console.log('Attempting mobile fullscreen');
    try {
        // First try standard fullscreen
        await requestFullscreen();
    } catch (error) {
        console.warn('Standard fullscreen failed on mobile, trying alternatives:', error);
        // On mobile, fullscreen might not work, so we'll use CSS simulation
        simulateFullscreen();
        // Also try to hide browser UI
        if (window.navigator.standalone === false) {
            // iOS Safari
            window.scrollTo(0, 1);
        }
        if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) {
            // PWA mode
            console.log('Running in PWA mode');
        }
    }
}

function viewQuestion(index) {
    if (index < 0 || index >= db.questions.length) {
        alert('Soal tidak ditemukan!');
        return;
    }
    const q = db.questions[index];
    let msg = `Soal: ${q.text}\n\nType: ${q.type}\nMapel: ${q.mapel}\nRombel: ${q.rombel}\n\n`;
    if (q.type === 'single' || q.type === 'multiple') {
        msg += `Opsi: ${Array.isArray(q.options) ? q.options.join(', ') : ''}\n`;
        if (Array.isArray(q.correct)) {
            msg += `Kunci: ${q.correct.map(i => ['A', 'B', 'C', 'D'][i]).join(', ')}`;
        } else {
            msg += `Kunci: ${['A', 'B', 'C', 'D'][q.correct]}`;
        }
    } else if (q.type === 'tf') {
        msg += Array.isArray(q.options) ? q.options.map((s, i) => `${s}: ${Array.isArray(q.correct) && q.correct[i] ? 'Benar' : 'Salah'}`).join('\n') : '';
    } else if (q.type === 'matching') {
        const questions = Array.isArray(q.questions) ? q.questions : [];
        const answers = Array.isArray(q.answers) ? q.answers : [];
        msg += 'Pasangan:\n';
        questions.forEach((question, i) => {
            msg += `${question} ⇔ ${answers[i] || '-'}\n`;
        });
    } else {
        msg += `Kunci: ${q.correct}`;
    }
    alert(msg);
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

async function previewQuestionImages(event) {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;

    if (!window.storedImages) window.storedImages = [];

    showToast('Memproses gambar...', 'info');

    for (const file of files) {
        try {
            const base64 = await new Promise(resolve => {
                const reader = new FileReader();
                reader.onload = e => resolve(e.target.result);
                reader.readAsDataURL(file);
            });

            if (file.type.startsWith('image/')) {
                const compressed = await compressImage(base64);
                const cloudUrl = await uploadImageToServer(compressed, file.name);
                window.storedImages.push(cloudUrl);
                console.log(`[STORAGE] Uploaded: ${file.name} -> ${cloudUrl}`);
            } else {
                window.storedImages.push(base64);
            }
        } catch (err) {
            console.error('Failed to upload image:', file.name, err);
            showToast('Gagal upload ' + file.name + ': ' + err.message, 'error');
        }
    }
    showToast('Proses upload selesai', 'success');
    renderImagePreviews();
}

function deleteQuestion(idx) {
    if (confirm("Hapus soal?")) {
        loadedCollections.questions = true;
        db.questions.splice(idx, 1);
        save();
        if (window.isTeacherMode || (currentSiswa && currentSiswa.role === 'teacher')) {
            if (typeof renderTeacherQuestions === 'function') renderTeacherQuestions();
        } else if (typeof renderAdminQuestions === 'function') {
            renderAdminQuestions();
        }
    }
}


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
        const fR = document.getElementById('filter-rombel').value;
        const fM = document.getElementById('filter-mapel').value;
        questionsToExport = db.questions.filter(q =>
            (fR === 'ALL' || q.rombel === fR) && (fM === 'ALL' || q.mapel === fM)
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

function moveQuestionUp(idx) {
    if (idx > 0) {
        [db.questions[idx], db.questions[idx - 1]] = [db.questions[idx - 1], db.questions[idx]];
        save();
        if (window.isTeacherMode || (currentSiswa && currentSiswa.role === 'teacher')) {
            renderTeacherQuestions();
        } else {
            renderAdminQuestions();
        }
    }
}

function moveQuestionDown(idx) {
    if (idx < db.questions.length - 1) {
        [db.questions[idx], db.questions[idx + 1]] = [db.questions[idx + 1], db.questions[idx]];
        save();
        if (window.isTeacherMode || (currentSiswa && currentSiswa.role === 'teacher')) {
            renderTeacherQuestions();
        } else {
            renderAdminQuestions();
        }
    }
}

function shuffleQuestionOptionsInBank(q) {
    if (!q || !Array.isArray(q.options) || q.options.length <= 1) return;
    const qType = q.type || 'single';

    if (qType === 'single') {
        const origOptions = [...q.options];
        const origCorrectIndex = typeof q.correct === 'number' ? q.correct : parseInt(q.correct);
        const indices = origOptions.map((_, i) => i);
        const shuffledIndices = shuffleArray(indices);

        const newOptions = shuffledIndices.map(i => origOptions[i]);
        let newCorrect = 0;
        if (!isNaN(origCorrectIndex) && origCorrectIndex >= 0 && origCorrectIndex < origOptions.length) {
            newCorrect = shuffledIndices.indexOf(origCorrectIndex);
        }

        q.options = newOptions;
        q.correct = newCorrect;

    } else if (qType === 'multiple') {
        const origOptions = [...q.options];
        const origCorrectArr = Array.isArray(q.correct) ? q.correct : [];
        const indices = origOptions.map((_, i) => i);
        const shuffledIndices = shuffleArray(indices);

        const newOptions = shuffledIndices.map(i => origOptions[i]);
        const newCorrect = origCorrectArr
            .map(oldIdx => shuffledIndices.indexOf(oldIdx))
            .filter(newIdx => newIdx !== -1)
            .sort((a, b) => a - b);

        q.options = newOptions;
        q.correct = newCorrect;

    } else if (qType === 'tf') {
        const origOptions = [...q.options];
        const origCorrectArr = Array.isArray(q.correct) ? q.correct : [];
        const indices = origOptions.map((_, i) => i);
        const shuffledIndices = shuffleArray(indices);

        const newOptions = shuffledIndices.map(i => origOptions[i]);
        const newCorrect = shuffledIndices.map(oldIdx => origCorrectArr[oldIdx] ?? false);

        q.options = newOptions;
        q.correct = newCorrect;
    }
}

examData = { mapel: "", questions: [], currentIdx: 0, answers: [], ragu: [], timer: null };


async function startExam(mapel) {
    console.log('[startExam] Starting for mapel:', mapel, 'student:', currentSiswa?.id);
    const qs = db.questions.filter(q => q.mapel === mapel && q.rombel === currentSiswa.rombel);
    console.log('[startExam] Questions found for mapel:', qs.length);

    console.log('[startExam] Checking for saved progress...');
    const saved = await getSavedStudentExamProgress(mapel);
    console.log('[startExam] getSavedStudentExamProgress returned:', saved ? { currentIdx: saved.currentIdx, answersLength: saved.answers?.length, source: saved.source } : null);

    if (saved && saved.mapel === mapel && Array.isArray(saved.answers) && saved.answers.length > 0) {
        console.log('[startExam] ✅ Found saved progress for mapel, resuming instead of restarting:', mapel, 'from index:', saved.currentIdx);
        await resumeStudentExam(saved);
        return;
    }

    console.log('[startExam] No saved progress found, starting fresh exam for mapel:', mapel);
    const shuffledQs = shuffleArray(qs);
    const normalizedQuestions = shuffledQs.map(q => {
        const studentQ = {
            ...q,
            type: q.type || 'single'
        };

        // Randomize option choices per student for questions with multiple options
        if (Array.isArray(q.options) && q.options.length > 1) {
            const indices = q.options.map((_, i) => i);
            const shuffledOptionIndices = shuffleArray(indices);
            studentQ.options = shuffledOptionIndices.map(i => q.options[i]);
            studentQ._shuffledOptionIndices = shuffledOptionIndices;
        }

        // Initialize matching shuffle indices if matching type
        if (studentQ.type === 'matching') {
            if (Array.isArray(q.answers)) {
                studentQ._shuffledAnswers = shuffleArray(q.answers);
            }
            if (Array.isArray(q.questions)) {
                const indices = q.questions.map((_, i) => i);
                studentQ._shuffledQuestionIndices = shuffleArray(indices);
            }
        }

        return studentQ;
    });

    // initialise answers based on question type (multiple => [], text => "", single => null)
    const answers = normalizedQuestions.map(q => {
        if (q.type === 'multiple') return [];
        if (q.type === 'text') return '';
        if (q.type === 'matching') return [];
        return null; // default single-choice
    });
    const ragu = normalizedQuestions.map(_ => false);
    examData = { mapel, questions: normalizedQuestions, currentIdx: 0, answers, ragu };

    // Tampilkan petunjuk ujian untuk siswa
    showStudentInstructionModal();

    // Reset and start anti-cheat
    cheatingCount = 0;
    isExamActive = true;
    examStartTime = Date.now();

    // Request fullscreen for exam
    if (typeof requestFullscreen === 'function') {
        requestFullscreen();
    }
    document.getElementById('cheat-mask').classList.add('hidden');

    document.getElementById('student-exam-list').classList.add('hidden');
    document.getElementById('exam-screen').classList.remove('hidden');
    document.getElementById('exam-meta').innerText = `${mapel} | ${currentSiswa.rombel}`;

    showQuestion(0);
    updateQuestionStatus();
    updateProgress();
    updateLiveExamStatus(true);
    if (liveExamInterval) clearInterval(liveExamInterval);
    liveExamInterval = setInterval(() => updateLiveExamStatus(true), 1000);
    console.log('[Student] Started live exam interval for:', mapel, 'studentId:', currentSiswa.id);

    const timeLimits = db.timeLimits || {};
    const key = `${currentSiswa.rombel}|${mapel}`.toLowerCase().trim();
    const timeLimit = timeLimits[key] || 60; // default 60 menit agar sama dengan admin
    examSecondsRemaining = timeLimit * 60;
    examData.totalSeconds = examSecondsRemaining;
    console.log('Starting exam for', key, 'timeLimit:', timeLimit, 'timeLimits:', timeLimits);
    startTimer(examSecondsRemaining);
    saveStudentExamProgress();
}

function showQuestion(idx) {
    examData.currentIdx = idx;
    const q = examData.questions[idx];
    document.getElementById('curr-q-num').innerText = idx + 1;
    document.getElementById('total-q-num').innerText = examData.questions.length;
    document.getElementById('exam-q-text').innerHTML = normalizeHtmlImages(q.text || '');
    // refresh progress display (including type)
    updateProgress();

    // make inline images zoomable inside question text
    const questionText = document.getElementById('exam-q-text');
    if (questionText) {
        const inlineImgs = questionText.querySelectorAll('img');
        inlineImgs.forEach((img, inlineIdx) => {
            img.classList.add('cursor-zoom-in');
            img.style.maxWidth = '100%';
            img.style.height = 'auto';
            img.setAttribute('loading', 'lazy');

            const externalCount = (q.images && Array.isArray(q.images) ? q.images.length : (q.image ? 1 : 0));
            img.addEventListener('click', () => openImageZoom(idx, externalCount + inlineIdx));
        });
    }

    // show images if available
    const imgContainer = document.getElementById('exam-images');
    imgContainer.innerHTML = '';
    if (q.images && Array.isArray(q.images) && q.images.length > 0) {
        q.images.forEach((img, imgIdx) => {
            const imgSrc = typeof img === 'string' ? normalizeImgSrc(img) : (img.data || '');
            imgContainer.innerHTML += `<div class="relative w-full cursor-pointer group hover:opacity-90 transition-opacity" onclick="openImageZoom(${idx}, ${imgIdx})">
                        <img src="${imgSrc}" alt="Gambar soal ${imgIdx + 1}" class="w-full h-auto rounded-lg border border-slate-300 shadow-sm object-contain" loading="lazy">
                        <span class="absolute top-2 right-2 bg-sky-600 text-white text-xs font-bold px-2 py-1 rounded">${imgIdx + 1}</span>
                        <div class="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100">
                            <i class="fas fa-search-plus text-white text-3xl"></i>
                        </div>
                    </div>`;
        });
        imgContainer.classList.remove('hidden');
    } else if (q.image) {
        const imgSrcSingle = typeof q.image === 'string' ? normalizeImgSrc(q.image) : (q.image.data || '');
        imgContainer.innerHTML = `<div class="relative w-full cursor-pointer group hover:opacity-90 transition-opacity" onclick="openImageZoom(${idx}, 0)">
                    <img src="${imgSrcSingle}" alt="Gambar soal" class="w-full h-auto rounded-lg border border-slate-300 shadow-sm object-contain" loading="lazy">
                    <div class="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100">
                        <i class="fas fa-search-plus text-white text-3xl"></i>
                    </div>
                </div>`;
        imgContainer.classList.remove('hidden');
    } else {
        imgContainer.classList.add('hidden');
    }

    let optionHtml = '';
    if (q.type === 'multiple') {
        // render checkboxes for multiple-choice
        optionHtml = q.options
            .map((opt, i) => ({ opt, i }))
            .filter(item => item.opt && item.opt.trim() !== '')
            .map((item, displayIdx) => {
                const { opt, i } = item;
                const checked = (examData.answers[idx] || []).includes(i) ? 'checked' : '';
                const label = String.fromCharCode(65 + displayIdx);
                return `
                    <label class="flex items-center w-full p-4 md:p-5 rounded-2xl border-2 transition-all ${checked ? 'border-sky-600 bg-sky-50 text-sky-700 font-bold' : 'border-slate-50 hover:bg-slate-50 text-slate-600'}">
                        <input type="checkbox" class="mr-3 w-5 h-5"
                            onchange="toggleAnswer(${i})" ${checked} />
                        <span class="inline-block w-8 font-bold">${label}.</span>
                        <span class="flex-1 text-sm md:text-base">${opt}</span>
                    </label>`;
            }).join('');

    } else if (q.type === 'text') {
        const value = examData.answers[idx] || '';
        optionHtml = `
                    <textarea id="text-answer" class="w-full p-4 md:p-5 border rounded-lg h-28 md:h-32 text-sm md:text-base" 
                        oninput="setAnswerText(this.value)">${value}</textarea>`;
    } else if (q.type === 'tf') {
        const ansArr = examData.answers[idx] || [];
        optionHtml = `
            <div class="tf-container animate-fade-in">
                ${q.options.map((stmt, j) => {
            const val = ansArr[j];
            const isAnswered = val === true || val === false;
            return `
                        <div class="tf-item ${isAnswered ? 'answered' : ''}">
                            <div class="tf-statement">
                                <span class="tf-statement-num">${j + 1}</span>
                                <span>${stmt}</span>
                            </div>
                            <div class="tf-options-stack">
                                <button onclick="setAnswerTF(${j}, true)" 
                                    class="tf-btn ${val === true ? 'active-true' : ''}">
                                    BENAR <i class="fas ${val === true ? 'fa-check-circle' : 'fa-circle'}"></i>
                                </button>
                                <button onclick="setAnswerTF(${j}, false)" 
                                    class="tf-btn ${val === false ? 'active-false' : ''}">
                                    SALAH <i class="fas ${val === false ? 'fa-times-circle' : 'fa-circle'}"></i>
                                </button>
                            </div>
                        </div>`;
        }).join('')}
            </div>`;
    } else if (q.type === 'matching') {
        // Runtime fallback: recover answers pool if it's empty (AI normalization edge case)
        if (!Array.isArray(q.answers) || q.answers.length === 0) {
            if (Array.isArray(q.correct) && q.correct.length > 0 &&
                q.correct.every(c => typeof c === 'string' && c.trim() !== '')) {
                q.answers = [...new Set(q.correct)];
            } else if (Array.isArray(q.options) && q.options.length > 0) {
                q.answers = q.options.map(o => String(o)).filter(o => o.trim() !== '');
            }
        }

        // Pastikan pilihan jawaban (pool) diacak sekali
        if (!Array.isArray(q._shuffledAnswers) || q._shuffledAnswers.length !== (q.answers?.length || 0)) {
            q._shuffledAnswers = shuffleArray(q.answers || []);
        }
        const shuffledAnswers = q._shuffledAnswers;
        examData.shuffledAnswers = shuffledAnswers;

        // Pastikan urutan pertanyaan (kiri) diacak sekali
        if (!Array.isArray(q._shuffledQuestionIndices) || q._shuffledQuestionIndices.length !== (q.questions?.length || 0)) {
            const indices = (q.questions || []).map((_, i) => i);
            q._shuffledQuestionIndices = shuffleArray(indices);
        }
        const questionIndices = q._shuffledQuestionIndices;
        const selected = examData.answers[idx] || [];

        optionHtml = `
                    <div class="matching-box animate-fade-in">
                        <div class="matching-header">
                            <div class="flex items-center gap-2 mb-3">
                                <i class="fas fa-list-check text-sky-600"></i>
                                <span class="text-xs font-black text-slate-500 uppercase tracking-widest">Referensi Pilihan Jawaban</span>
                            </div>
                            <div class="matching-legend-grid">
                                ${shuffledAnswers.map((ans, ai) => `
                                    <div class="matching-legend-item">
                                        <span class="matching-legend-label">${String.fromCharCode(65 + ai)}.</span>
                                        <span>${ans}</span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>

                        <div class="flex items-center gap-2 mb-4">
                            <i class="fas fa-layer-group text-sky-600"></i>
                            <span class="text-xs font-black text-slate-500 uppercase tracking-widest">Pasangkan Jawaban</span>
                        </div>
                        
                        <div class="matching-select-wrapper">
                            ${questionIndices.map((origQi, displayIdx) => {
            const quest = q.questions[origQi];
            return `
                                <div class="matching-item-card ${selected[origQi] != null ? 'answered' : ''}">
                                    <div class="flex items-center gap-3 flex-1">
                                        <div class="w-7 h-7 bg-slate-100 text-slate-600 rounded-lg flex items-center justify-center font-bold text-sm flex-shrink-0">${displayIdx + 1}</div>
                                        <div class="matching-question-text">${quest}</div>
                                    </div>
                                    <div class="w-full sm:w-64 md:w-80 flex-shrink-0">
                                        <select onchange="setMatchingAnswer(${origQi}, this.value)" class="matching-select">
                                            <option value="">Pilih Pasangan...</option>
                                            ${shuffledAnswers.map((ans, ai) => `
                                                <option value="${ai}" ${selected[origQi] == ai ? 'selected' : ''}>
                                                    ${String.fromCharCode(65 + ai)}. ${ans.length > 40 ? ans.substring(0, 37) + '...' : ans}
                                                </option>
                                            `).join('')}
                                        </select>
                                    </div>
                                </div>
                            `;
        }).join('')}
                        </div>
                    </div>
                `;
    } else {
        // default single-choice
        optionHtml = q.options
            .map((opt, i) => ({ opt, i }))
            .filter(item => item.opt && item.opt.trim() !== '')
            .map((item, displayIdx) => {
                const { opt, i } = item;
                const label = String.fromCharCode(65 + displayIdx);
                return `
                    <button onclick="setAnswer(${i})" class="w-full p-4 md:p-5 text-left rounded-2xl border-2 transition-all ${examData.answers[idx] === i ? 'border-sky-600 bg-sky-50 text-sky-700 font-bold' : 'border-slate-50 hover:bg-slate-50 text-slate-600'}">
                        <span class="inline-block w-8 font-bold">${label}.</span>
                        <span class="text-sm md:text-base">${opt}</span>
                    </button>`;
            }).join('');

    }
    document.getElementById('exam-options').innerHTML = optionHtml;

    // Update question status indicators
    updateQuestionStatus();
    updateDoubtBtn();
    updateProgress();

    document.getElementById('btn-prev').disabled = idx === 0;
    document.getElementById('btn-next').classList.toggle('hidden', idx === examData.questions.length - 1);
    document.getElementById('btn-finish').classList.toggle('hidden', idx !== examData.questions.length - 1);
}

function updateQuestionStatus() {
    const statusContainer = document.getElementById('question-status');

    const total = examData.questions.length;
    const unansweredIndices = [];
    examData.questions.forEach((_, i) => {
        const ans = examData.answers[i];
        const isAnswered = ans !== null && ans !== undefined && (
            Array.isArray(ans) ? ans.length > 0 :
                typeof ans === 'string' ? ans.trim() !== '' :
                    true
        );
        if (!isAnswered) unansweredIndices.push(i);
    });

    let indicesToRender;
    if (statusShowAll) {
        indicesToRender = [...Array(total).keys()];
    } else {
        if (unansweredIndices.length <= MAX_VISIBLE_STATUS) {
            indicesToRender = unansweredIndices.length ? unansweredIndices.slice() : [...Array(total).keys()];
        } else {
            indicesToRender = unansweredIndices.slice(0, MAX_VISIBLE_STATUS);
        }
    }
    if (!indicesToRender.includes(examData.currentIdx)) {
        indicesToRender.unshift(examData.currentIdx);
    }

    const buttons = indicesToRender.map(i => {
        const ans = examData.answers[i];
        const isAnswered = ans !== null && ans !== undefined && (
            Array.isArray(ans) ? ans.length > 0 :
                typeof ans === 'string' ? ans.trim() !== '' :
                    true
        );
        const isRagu = examData.ragu && examData.ragu[i];
        const isCurrent = i === examData.currentIdx;
        let bgColor;
        if (isRagu) {
            bgColor = 'bg-yellow-500 text-white hover:bg-yellow-600';
        } else if (isAnswered) {
            bgColor = 'bg-emerald-500 text-white hover:bg-emerald-600';
        } else {
            bgColor = 'bg-red-500 text-white hover:bg-red-600';
        }
        const ringClass = isCurrent ? 'ring-2 ring-sky-400 ring-offset-2' : '';
        return `<button onclick="showQuestion(${i})" class="w-10 h-10 rounded-lg font-bold text-sm transition-all ${bgColor} ${ringClass}">${i + 1}</button>`;
    });
    if (!statusShowAll && total > indicesToRender.length) {
        buttons.push(`<button onclick="toggleStatusView()" class="view-all w-10 h-10 rounded-lg font-bold text-sm transition-all">⋯</button>`);
    }
    if (statusShowAll && total > MAX_VISIBLE_STATUS) {
        buttons.push(`<button onclick="toggleStatusView()" class="view-all w-10 h-10 rounded-lg font-bold text-sm transition-all">×</button>`);
    }
    statusContainer.innerHTML = buttons.join('');
}

let lastLiveExamUpdate = 0;

let isUpdateLiveExamRunning = false;

async function updateLiveExamStatus(force = false) {
    if (isUpdateLiveExamRunning) return;
    isUpdateLiveExamRunning = true;
    try {
        await _updateLiveExamStatusInternal(force);
    } finally {
        isUpdateLiveExamRunning = false;
    }
}

async function _updateLiveExamStatusInternal(force = false) {
    if (!currentSiswa) {
        console.warn('[updateLiveExamStatus] missing currentSiswa');
        return;
    }
    if (currentSiswa.role !== 'student') {
        console.warn('[updateLiveExamStatus] not a student account:', currentSiswa.role);
        return;
    }
    if (!isExamActive) {
        console.warn('[updateLiveExamStatus] exam is not active');
        return;
    }
    if (!examData || !Array.isArray(examData.questions) || examData.questions.length === 0) {
        console.warn('[updateLiveExamStatus] invalid examData or no questions', examData);
        return;
    }
    const now = Date.now();
    if (!force && now - lastLiveExamUpdate < 1000) return;
    lastLiveExamUpdate = now;

    const total = examData.questions.length;
    const answeredCount = examData.answers.reduce((count, ans) => {
        const isAnswered = ans !== null && ans !== undefined && (
            Array.isArray(ans) ? ans.length > 0 :
                typeof ans === 'string' ? ans.trim() !== '' :
                    true
        );
        return count + (isAnswered ? 1 : 0);
    }, 0);
    const currentQuestionNumber = examData.currentIdx + 1;
    const percentage = total ? Math.round((answeredCount / total) * 100) : 0;

    let liveCorrectCount = 0;
    let liveTotalItems = 0;
    let liveAnsweredItemsCount = 0;
    examData.questions.forEach((q, i) => {
        if (!q) return;
        const ans = examData.answers[i];
        const qType = q.type || 'single';

        if (qType === 'tf' && Array.isArray(q.options)) {
            q.options.forEach((stmt, j) => {
                liveTotalItems++;
                const ansArr = Array.isArray(ans) ? ans : [];
                const studentVal = ansArr[j];
                if (studentVal !== null && studentVal !== undefined) {
                    liveAnsweredItemsCount++;
                    const origJ = getOriginalOptionIndex(q, j);
                    const corrVal = Array.isArray(q.correct) ? q.correct[origJ] : false;
                    if (studentVal === corrVal) liveCorrectCount++;
                }
            });
        } else if (qType === 'multiple') {
            const corr = Array.isArray(q.correct) ? q.correct : [];
            const ansArr = Array.isArray(ans) ? ans : [];
            const totalCorrectOptions = corr.length > 0 ? corr.length : 1;
            liveTotalItems += totalCorrectOptions;

            if (ansArr.length > 0) {
                // For simplicity, we count it as "answered" if at least one checkbox is ticked
                // But we only count "correct" for the fraction they got right
                liveAnsweredItemsCount += totalCorrectOptions;
                const origAnsArr = ansArr.map(dIdx => getOriginalOptionIndex(q, dIdx));
                const selectedCorrect = origAnsArr.filter(idx => corr.includes(idx)).length;
                liveCorrectCount += selectedCorrect;
            }
        } else if (qType === 'matching') {
            const ansArr = Array.isArray(ans) ? ans : [];
            const shuffled = Array.isArray(q._shuffledAnswers) ? q._shuffledAnswers : (q.answers || []);
            if (Array.isArray(q.questions)) {
                q.questions.forEach((_, qi) => {
                    liveTotalItems++;
                    const selectedIdx = ansArr[qi];
                    if (selectedIdx != null) {
                        liveAnsweredItemsCount++;
                        if (Array.isArray(q.correct) && shuffled[selectedIdx] === q.correct[qi]) {
                            liveCorrectCount++;
                        }
                    }
                });
            } else {
                liveTotalItems++;
            }
        } else {
            // Standard or Essay/Text
            liveTotalItems++;
            const isAnswered = ans !== null && ans !== undefined && (typeof ans === 'string' ? ans.trim() !== '' : true);
            if (isAnswered) {
                liveAnsweredItemsCount++;
                let isCorrect = false;
                if (q.correct !== undefined && q.correct !== null) {
                    if (qType === 'text') {
                        const corrText = (typeof q.correct === 'string' ? q.correct : '').trim().toLowerCase();
                        isCorrect = typeof ans === 'string' && ans.trim().toLowerCase() === corrText;
                    } else {
                        const origAns = getOriginalOptionIndex(q, ans);
                        isCorrect = origAns === q.correct;
                    }
                }
                if (isCorrect) liveCorrectCount++;
            }
        }
    });

    const existingIndex = (db.activeExams || []).findIndex(e => e.studentId === currentSiswa.id && e.mapel === examData.mapel && e.rombel === currentSiswa.rombel);

    // Calculate time remaining
    const timeLimits = db.timeLimits || {};
    const key = `${currentSiswa.rombel}|${examData.mapel}`.toLowerCase().trim();
    const timeLimitSeconds = (timeLimits[key] || 60) * 60; // convert minutes to seconds, default 60 agar sama dengan admin
    const elapsedSeconds = examStartTime ? Math.floor((Date.now() - examStartTime) / 1000) : 0;
    const timeRemaining = Math.max(0, timeLimitSeconds - elapsedSeconds);

    const existingEntry = existingIndex >= 0 ? db.activeExams[existingIndex] : null;
    const liveEntry = {
        studentId: currentSiswa.id,
        studentName: currentSiswa.name,
        rombel: currentSiswa.rombel,
        mapel: examData.mapel,
        currentIdx: examData.currentIdx,
        currentQuestionNumber,
        answeredCount,
        totalQuestions: total,
        correctCount: liveCorrectCount,
        answeredItemsCount: liveAnsweredItemsCount,
        totalItems: liveTotalItems,
        percentage,
        questionType: examData.questions[examData.currentIdx]?.type || 'single',
        answers: examData.answers,
        ragu: examData.ragu,
        startTime: examStartTime,
        timeRemaining,
        updatedAt: now,
        isActive: true,
        adminSaveRequest: existingEntry?.adminSaveRequest || false,
        adminReloadRequest: existingEntry?.adminReloadRequest || false,
        adminSaveConfirmed: existingEntry?.adminSaveConfirmed || false,
        savedByAdminCommand: existingEntry?.savedByAdminCommand || false,
        adminSavedProgress: existingEntry?.adminSavedProgress || null
    };
    if (!Array.isArray(db.activeExams)) db.activeExams = [];
    if (existingIndex >= 0) {
        db.activeExams[existingIndex] = liveEntry;
    } else {
        db.activeExams.push(liveEntry);
    }
    console.log('%c[Student] ✏️ Updated live exam status', 'color: darkcyan; font-weight: bold', {
        student: currentSiswa.name,
        mapel: examData.mapel,
        question: `Q${currentQuestionNumber}/${total}`,
        percentage,
        answered: answeredCount,
        timeRemaining,
        startTime: examStartTime
    });
    console.log('[Student] activeExams length after update', db.activeExams.length, 'liveExamInterval', liveExamInterval);
    try {
        await saveLocalDb();
        saveStudentExamProgress();
    } catch (err) {
        console.warn('[Student] ❌ IDB save failed:', err.message || err);
    }
    await sendLiveExamToServer(liveEntry);
    if (navigator.onLine) {
        const serverLiveExams = await fetchLiveExamsFromServer();
        await processAdminCommandsOnStudent(serverLiveExams);
    }
}

async function clearLiveExamStatus() {
    if (!currentSiswa || currentSiswa.role !== 'student') return;
    const norm = v => String(v || '').trim().toLowerCase();
    const sid = norm(currentSiswa.id);
    const srb = norm(currentSiswa.rombel);

    if (Array.isArray(db.activeExams)) {
        db.activeExams = db.activeExams.filter(e => !(norm(e.studentId) === sid && norm(e.rombel) === srb));
    }
    examStartTime = null;
    if (typeof clearStudentExamProgress === 'function') clearStudentExamProgress();

    if (navigator.onLine && typeof sendLiveExamToServer === 'function' && examData && examData.mapel) {
        try {
            await sendLiveExamToServer({
                studentId: currentSiswa.id,
                studentName: currentSiswa.name,
                rombel: currentSiswa.rombel,
                mapel: examData.mapel,
                isActive: false,
                adminSavedProgress: null,
                adminSaveConfirmed: false,
                savedByAdminCommand: false,
                updatedAt: Date.now()
            });
        } catch (err) {
            console.warn('[clearLiveExamStatus] Failed to notify server:', err);
        }
    }

    try {
        if (typeof saveLocalDb === 'function') await saveLocalDb();
    } catch (err) {
        console.warn('Gagal membersihkan live exam status:', err.message || err);
    }
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
        if (data.length > 0) {
            console.log('  Data:', data.map(e => `${e.studentId}/${e.mapel}`));
        }
        return Array.isArray(data) ? data : [];
    } catch (err) {
        console.warn('%c[fetchLiveExamsFromServer] ❌ Error:', 'color: red', err.message);
        return [];
    }
}

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

function shuffleArray(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function getOriginalOptionIndex(q, displayIdx) {
    if (displayIdx === null || displayIdx === undefined) return null;
    if (q && Array.isArray(q._shuffledOptionIndices) && q._shuffledOptionIndices[displayIdx] !== undefined) {
        return q._shuffledOptionIndices[displayIdx];
    }
    return displayIdx;
}

function startTimer(sec) {
    clearInterval(examData.timer);
    examSecondsRemaining = sec;
    const timerEl = document.getElementById('timer');
    if (timerEl) timerEl.classList.remove('animate-blink-red');

    examData.timer = setInterval(() => {
        sec--;
        examSecondsRemaining = sec;
        const h = Math.floor(sec / 3600);
        const m = Math.floor((sec % 3600) / 60);
        const s = sec % 60;
        if (h > 0) {
            document.getElementById('timer').innerText = `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        } else {
            document.getElementById('timer').innerText = `${m}:${String(s).padStart(2, '0')}`;
        }

        // Efek visual berkedip merah saat sisa 5 menit
        if (sec <= 300 && timerEl) {
            timerEl.classList.add('animate-blink-red');
        }

        // Tambahkan peringatan sisa waktu
        if (sec === 300) {
            showToast("Peringatan: Sisa waktu 5 menit!", "info");
        } else if (sec === 60) {
            showToast("Peringatan: Sisa waktu 1 menit! Segera selesaikan jawaban Anda.", "error");
        }

        if (sec <= 0) {
            showToast("Waktu habis! Jawaban Anda otomatis dikirim.", "error");
            submitExam();
        }
    }, 1000);
}

async function finishExam() {
    // Calculate answered vs total
    const total = examData.questions.length;
    const answeredCount = examData.answers.reduce((count, ans) => {
        const isAnswered = ans !== null && ans !== undefined && (
            Array.isArray(ans) ? ans.length > 0 :
                typeof ans === 'string' ? ans.trim() !== '' :
                    true
        );
        return count + (isAnswered ? 1 : 0);
    }, 0);
    const unansweredCount = total - answeredCount;

    // Update modal UI
    document.getElementById('confirm-answered-count').innerText = answeredCount;
    document.getElementById('confirm-unanswered-count').innerText = unansweredCount;

    const warning = document.getElementById('unanswered-warning');
    if (unansweredCount > 0) {
        warning.classList.remove('hidden');
        warning.classList.add('flex');
    } else {
        warning.classList.add('hidden');
        warning.classList.remove('flex');
    }

    // Show modal
    const modal = document.getElementById('confirm-finish-modal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

async function submitExam() {
    // IMMEDIATE UI TRANSITION: Stop exam and hide screens before processing heavy data
    isExamActive = false;
    if (liveExamInterval) {
        clearInterval(liveExamInterval);
        liveExamInterval = null;
    }
    await clearLiveExamStatus();
    // Release fullscreen and wake lock
    exitFullscreen();
    releaseWakeLock();
    closeConfirmModal();
    closeCheatWarning();
    clearInterval(examData.timer);

    // Hide question UI immediately so it doesn't look "stuck"
    document.getElementById('exam-screen').classList.add('hidden');

    // Show processing modal
    const savingModal = document.getElementById('saving-modal');
    const savingProg = document.getElementById('saving-progress-bar');
    if (savingModal) {
        savingModal.classList.remove('hidden');
        savingModal.classList.add('flex');
        if (savingProg) savingProg.style.width = '30%';
    }

    // RANDOM DELAY: 2-12 seconds to ensure stability (Sequential Render Queue)
    const randomDelay = Math.floor(Math.random() * (12000 - 2000 + 1)) + 2000;
    console.log(`[QUEUE] Enforcing sequential wait: ${randomDelay}ms`);

    // Simulasikan progress bar visual
    const progressInterval = setInterval(() => {
        if (savingProg) {
            const currentWidth = parseFloat(savingProg.style.width);
            if (currentWidth < 90) savingProg.style.width = (currentWidth + 5) + '%';
        }
    }, randomDelay / 10);

    await new Promise(resolve => setTimeout(resolve, randomDelay));
    clearInterval(progressInterval);
    if (savingProg) savingProg.style.width = '100%';

    let correctCount = 0;

    // VALIDASI: Pastikan questions dan answers punya panjang yang sama
    if (!Array.isArray(examData.questions) || !Array.isArray(examData.answers)) {
        console.error('ERROR: Questions atau answers bukan array!');
        alert('Terjadi error saat merekam ujian. Silakan hubungi administrator.');
        return;
    }

    if (examData.questions.length !== examData.answers.length) {
        console.warn(`WARNING: Jumlah soal (${examData.questions.length}) != jumlah jawaban (${examData.answers.length})`);
        // Pad answers array jika kurang
        while (examData.answers.length < examData.questions.length) {
            examData.answers.push(null);
        }
    }

    // Each question contributes one point to the final score.
    // For TF questions we treat every individual statement as a
    // separate scoring item; for complex multiple-choice each
    // option is an item.  The student's score is calculated as
    // (#correctItems / #totalItems) * 100.  In other words, the
    // one-point question is divided evenly across all statements /
    // options (i.e. score per statement = 1/totalItems), so a
    // partially correct TF/multiple question gives fractional credit.
    // This matches the requirement: "skor 1 soal dibagi pernyataan
    // yang dijawab dengan benar" (and similarly for multiple choice).
    // The debug logs below print the intermediate counts.
    // count answers at the granularity of TF statements
    let totalItems = 0;
    examData.questions.forEach((q, i) => {
        const ans = examData.answers[i];

        // VALIDASI: Pastikan question memiliki kunci jawaban (gunakan default type 'single' jika tidak ada)
        if (!q || q.correct === undefined) {
            console.warn(`WARNING: Soal ${i} tidak valid:`, q);
            return;
        }
        const qType = q.type || 'single'; // Default ke single-choice jika tidak ada type

        if (qType === 'tf' && Array.isArray(q.options)) {
            // tiap pernyataan dianggap satu item dalam perhitungan skor
            const ansArr = Array.isArray(ans) ? ans : [];
            q.options.forEach((stmt, j) => {
                totalItems++;
                const origJ = getOriginalOptionIndex(q, j);
                const corrVal = Array.isArray(q.correct) ? q.correct[origJ] : false;
                const studentVal = ansArr[j];
                if (studentVal === corrVal) {
                    correctCount++;
                }
            });
        } else if (qType === 'multiple') {
            // per-option scoring untuk pilihan ganda kompleks
            const corr = Array.isArray(q.correct) ? q.correct : [];
            const ansArr = Array.isArray(ans) ? ans : [];
            const origAnsArr = ansArr.map(dIdx => getOriginalOptionIndex(q, dIdx));
            const selectedCorrect = origAnsArr.filter(idx => corr.includes(idx)).length;

            const totalCorrectOptions = corr.length > 0 ? corr.length : 1;
            totalItems += totalCorrectOptions;
            correctCount += selectedCorrect;
        } else if (qType === 'matching') {
            const ansArr = Array.isArray(ans) ? ans : [];
            const shuffled = Array.isArray(q._shuffledAnswers) ? q._shuffledAnswers : (q.answers || []);

            // SAFETY: Ensure both prompt questions and correct answers exist
            if (Array.isArray(q.questions) && Array.isArray(q.correct)) {
                q.questions.forEach((_, qi) => {
                    totalItems++;
                    const selectedIdx = ansArr[qi];
                    const selectedStr = (selectedIdx != null && shuffled[selectedIdx] !== undefined) ? String(shuffled[selectedIdx]) : null;
                    const correctStr = q.correct[qi] !== undefined ? String(q.correct[qi]) : null;
                    if (selectedStr !== null && correctStr !== null && selectedStr === correctStr) {
                        correctCount++;
                    }
                });
            } else {
                console.warn(`[SCORE] SKIPPING matching question ${i} due to missing questions/correct data`);
                // Still increment totalItems by 1 to represent the question exists
                totalItems += 1;
            }
        } else {
            // non-TF and non-multiple questions still contribute satu item
            totalItems++;
            let correct = false;

            if (qType === 'text') {
                const corrText = (typeof q.correct === 'string' ? q.correct : '').trim().toLowerCase();
                correct = typeof ans === 'string' && ans.trim().toLowerCase() === corrText;
            } else {
                // Single choice (default)
                const origAns = getOriginalOptionIndex(q, ans);
                correct = origAns === q.correct;
            }

            if (correct) correctCount++;
        }
    });

    // DEBUG: Log perhitungan skor
    console.log('[SCORE DEBUG] Total items:', totalItems, 'Jawaban benar:', correctCount);
    console.log('[SCORE DEBUG] Perhitungan: (', correctCount, '/', totalItems, ') * 100 =', (totalItems ? (correctCount / totalItems) * 100 : 0));

    const score = totalItems ? ((correctCount / totalItems) * 100).toFixed(1) : 0;

    // Save essential question data (without images) so teachers/admins can view answers.
    // Restores original option order if options were shuffled.
    const savedQuestions = examData.questions.map(q => {
        const essential = {
            text: q.text || '',
            type: q.type || 'single',
            correct: q.correct,
        };
        if (Array.isArray(q.options)) {
            if (Array.isArray(q._shuffledOptionIndices)) {
                const origOptions = [];
                q._shuffledOptionIndices.forEach((origIdx, displayIdx) => {
                    origOptions[origIdx] = q.options[displayIdx];
                });
                essential.options = origOptions;
            } else {
                essential.options = q.options;
            }
        }
        if (Array.isArray(q.questions)) essential.questions = q.questions; // for matching
        if (Array.isArray(q.answers)) essential.answers = q.answers;       // for matching
        // intentionally omit q.images / q.image to keep payload small
        return essential;
    });

    // Transform student display choices back to original option indices before saving
    const savedAnswers = examData.answers.map((ans, i) => {
        const q = examData.questions[i];
        if (!q) return ans;
        if (q.type === 'matching' && Array.isArray(ans)) {
            const shuffled = q._shuffledAnswers || q.answers || [];
            return ans.map(ai => (ai !== null && ai !== undefined) ? shuffled[ai] : null);
        }
        if ((q.type === 'single' || !q.type) && typeof ans === 'number') {
            return getOriginalOptionIndex(q, ans);
        }
        if (q.type === 'multiple' && Array.isArray(ans)) {
            return ans.map(dIdx => getOriginalOptionIndex(q, dIdx));
        }
        if (q.type === 'tf' && Array.isArray(ans)) {
            const origAns = [];
            ans.forEach((val, dIdx) => {
                const origJ = getOriginalOptionIndex(q, dIdx);
                origAns[origJ] = val;
            });
            return origAns;
        }
        return ans;
    });

    const newEntry = {
        studentId: currentSiswa.id,
        studentName: currentSiswa.name,
        rombel: currentSiswa.rombel,
        mapel: examData.mapel,
        score: score,
        date: new Date().toISOString(),
        answers: savedAnswers, // Save transformed answers
        questions: savedQuestions // Save the questions with all essential data
    };
    db.results.push(newEntry);
    updateCompletionCharts();

    let directSyncError = null;
    let backgroundSaveError = null;

    try {
        // 1. Mandatory Single Result Sync (The most critical part)
        try {
            await sendResult(newEntry);
        } catch (e) {
            console.warn('[SUBMIT] Direct result sync failed, relying on background save:', e.message || e);
            directSyncError = e;
        }

        // 2. Background Full DB Save (Updates IndexedDB and triggers fallback sync)
        try {
            await save();
        } catch (e) {
            console.warn('[SUBMIT] Background database save encountered an issue:', e.message || e);
            backgroundSaveError = e;
        }
    } finally {
        // ALWAYS close the modal regardless of network state
        if (savingModal) {
            savingModal.classList.add('hidden');
            savingModal.classList.remove('flex');
        }
    }

    if (directSyncError || backgroundSaveError) {
        // Hapus entry yang gagal dari state agar tidak dobel saat ditekan "Coba Lagi"
        db.results.pop();

        const failModal = document.getElementById('failed-result');
        if (failModal) {
            let errMsg = "Koneksi ke server terputus atau gagal terakses.";
            if (backgroundSaveError) errMsg = "Penyimpanan lokal dan server mengalami masalah.";
            document.getElementById('failed-result-msg').innerHTML = `${errMsg}<br>Silakan periksa koneksi internet atau server, lalu <b>coba lagi</b>.`;
            failModal.classList.remove('hidden');
            const scoreRes = document.getElementById('score-result');
            if (scoreRes) scoreRes.classList.add('hidden');
        } else {
            alert('GAGAL TERSIMPAN: Periksa koneksi Anda dan coba lagi.');
        }
        return; // Stop here, so we don't show the success UI
    }

    clearStudentExamProgress();

    // refresh admin/teacher views if they're visible so the new score
    // shows up right away
    if (document.getElementById('admin-dashboard') &&
        !document.getElementById('admin-dashboard').classList.contains('hidden') &&
        !document.getElementById('admin-results').classList.contains('hidden')) {
        renderAdminResults();
    }
    if (document.getElementById('teacher-dashboard') &&
        !document.getElementById('teacher-dashboard').classList.contains('hidden') &&
        document.getElementById('teacher-tab-hasil-ujian') &&
        !document.getElementById('teacher-tab-hasil-ujian').classList.contains('text-slate-400')) {
        renderTeacherResults();
    }

    const successModal = document.getElementById('score-result');
    if (successModal) successModal.classList.remove('hidden');
    const failModalUI = document.getElementById('failed-result');
    if (failModalUI) failModalUI.classList.add('hidden');
    document.getElementById('final-score-val').innerText = score;
}

let currentZoomQuestion = null;

function getQuestionImageSources(q) {
    const sources = [];
    const extractSrc = item => {
        if (!item) return '';
        if (typeof item === 'string') return item;
        return item.data || item.src || '';
    };

    if (q.images && Array.isArray(q.images)) {
        q.images.forEach(img => {
            const src = extractSrc(img);
            if (src) sources.push(src);
        });
    } else if (q.image) {
        const src = extractSrc(q.image);
        if (src) sources.push(src);
    }

    if (typeof q.text === 'string' && q.text.includes('<img')) {
        const imgRegex = /<img[^>]+src=(?:"|')([^"'>]+)(?:"|')[^>]*>/gi;
        let match;
        while ((match = imgRegex.exec(q.text)) !== null) {
            if (match[1]) sources.push(match[1]);
        }
    }

    return sources;
}

async function generateQuestionsWithAi() {
    const materi = document.getElementById('ai-materi')?.value.trim();
    const mapel = document.getElementById('ai-mapel')?.value;
    const rombel = document.getElementById('ai-rombel')?.value;
    const file = document.getElementById('ai-blueprint-file')?.files[0];
    const oldJumlah = document.getElementById('ai-jumlah');
    const oldType = document.getElementById('ai-type');

    const typeCounts = getAiTypeCounts();
    let jumlah = Object.values(typeCounts).reduce((sum, n) => sum + (Number(n) || 0), 0);
    let tipe = 'single';

    if (oldJumlah && oldType) {
        jumlah = Number(oldJumlah.value) || 0;
        tipe = oldType.value || 'single';
        if (jumlah > 0 && jumlah !== Object.values(typeCounts).reduce((sum, n) => sum + (Number(n) || 0), 0)) {
            typeCounts[tipe] = jumlah;
        }
    }

    if (!materi && !file) {
        alert('Harap masukkan materi/topik atau upload kisi-kisi!');
        return;
    }
    if (!mapel) {
        alert('Pilih mata pelajaran!');
        return;
    }
    if (!rombel) {
        alert('Pilih rombel!');
        return;
    }
    if (jumlah <= 0) {
        alert('Harap pilih jumlah soal minimal 1!');
        return;
    }

    const levelCounts = getAiLevelCounts(jumlah);
    const opsiGambar = document.getElementById('ai-opsi-gambar')?.value || 'none';
    const loading = document.getElementById('ai-loading');
    if (loading) {
        loading.classList.remove('hidden');
        loading.classList.add('flex');
    }

    try {
        const response = await fetch(getApiBaseUrl() + '/api/generate-ai', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                materi, jumlah, tipe, mapel, rombel, typeCounts, levelCounts, opsiGambar,
                teacherId: (currentSiswa && currentSiswa.role === 'teacher') ? currentSiswa.id : null
            })
        });

        const result = await response.json();

        if (result.ok) {
            const newQuestions = result.questions.map(q => ({
                ...q,
                id: Date.now() + Math.random().toString(36).substr(2, 4),
                createdAt: new Date().toISOString()
            }));

            db.questions = [...db.questions, ...newQuestions];
            await save();

            alert(`Berhasil membuat ${newQuestions.length} soal baru dengan AI!`);
            closeModals();

            if (typeof renderAdminQuestions === 'function') renderAdminQuestions();
            if (typeof renderTeacherQuestions === 'function') renderTeacherQuestions();
        } else {
            const explanation = getAIErrorExplanation(result.error);
            alert('Error AI: ' + (result.error || 'Gagal generate soal') + (explanation ? '\n\n' + explanation : ''));
        }
    } catch (err) {
        console.error('AI Generation Error:', err);
        if (window.isStaticMode || window.location.hostname.includes('github.io')) {
            alert('Kesalahan AI: Fitur ini membutuhkan Backend Node.js yang berjalan.\n\nJika anda menjalankan di GitHub, silakan hubungkan ke Backend eksternal via Administrator > Settings.');
        } else {
            alert('Terjadi kesalahan saat memanggil AI: ' + (err.message || 'Error tidak diketahui'));
        }
    } finally {
        if (loading) {
            loading.classList.add('hidden');
            loading.classList.remove('flex');
        }
    }
}



async function renderStudentExamList() {
    const container = document.getElementById('student-exam-list');
    if (!container) return;

    // Ensure core data is loaded for the student view (force load results for freshness)
    if (typeof ensureDataLoaded === 'function') {
        await ensureDataLoaded('questions');
        await ensureDataLoaded('results', true);
    }

    if (!currentSiswa || !currentSiswa.rombel) {
        container.innerHTML = `<div class="col-span-full text-center py-20"><p class="text-slate-400 font-bold">Data siswa tidak teridentifikasi.</p></div>`;
        return;
    }

    const norm = v => String(v || '').trim().toLowerCase();
    const myStudentId = norm(currentSiswa.id);
    const myRombel = currentSiswa.rombel;
    const questions = Array.isArray(db?.questions) ? db.questions : [];
    const availableMapels = [...new Set(questions.filter(q => norm(q.rombel) === norm(myRombel)).map(q => q.mapel))];

    if (availableMapels.length === 0) {
        container.innerHTML = `<div class="col-span-full text-center py-20"><p class="text-slate-400 font-bold">Belum ada ujian tersedia untuk rombel ${myRombel}.</p></div>`;
        return;
    }

    const schoolInfo = typeof getSchoolSettings === 'function' ? getSchoolSettings() : { name: 'DR CBT' };

    container.innerHTML = availableMapels.map(m => {
        const subjects = Array.isArray(db?.subjects) ? db.subjects : [];
        const subjectObj = subjects.find(s => typeof getSubjectName === 'function' ? getSubjectName(s) === m : (typeof s === 'string' ? s === m : s.name === m));
        const scheduleKey = `${myRombel}|${m}`;
        const jenisKey = `${m}|${myRombel}`;
        const currentJenis = db.jenisUjian && db.jenisUjian[jenisKey] ? db.jenisUjian[jenisKey] : 'Ujian Semester';

        if (currentJenis === 'HIDDEN') return '';

        const isScheduleActive = !db.schedules || db.schedules.length === 0 || db.schedules.includes(scheduleKey);
        const isLocked = subjectObj && subjectObj.locked;
        const results = Array.isArray(db?.results) ? db.results : [];
        const mNorm = norm(m);

        const alreadyDone = results.find(r => {
            if (!r || r.deleted) return false;
            const rSid = norm(r.studentId || r.student_id);
            const rMapel = norm(r.mapel);
            return rSid === myStudentId && rMapel === mNorm;
        });

        const isNotAccessible = !isScheduleActive || isLocked;

        return `
            <div class="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm transition-all hover:shadow-xl">
                <div class="flex justify-between items-start mb-6">
                    <div class="w-12 h-12 bg-sky-100 text-sky-600 rounded-2xl flex items-center justify-center text-xl"><i class="fas fa-file-alt"></i></div>
                    ${isNotAccessible ? '<span class="px-3 py-1 bg-red-100 text-red-600 rounded-full text-[10px] font-black uppercase flex items-center gap-1"><i class="fas fa-lock"></i> Belum Dibuka</span>' : alreadyDone ? '<span class="px-3 py-1 bg-emerald-100 text-emerald-600 rounded-full text-[10px] font-black uppercase">Selesai</span>' : '<span class="px-3 py-1 bg-amber-100 text-amber-600 rounded-full text-[10px] font-black uppercase">Tersedia</span>'}
                </div>
                <h3 class="text-lg font-black text-slate-800 mb-1">${m}</h3>
                <p class="text-slate-400 text-xs mb-6 font-medium">${currentJenis} - ${schoolInfo?.name || 'DR CBT'}</p>
                ${isNotAccessible ?
                `<button disabled class="w-full py-4 bg-slate-300 text-slate-600 font-bold rounded-2xl cursor-not-allowed">BELUM DIBUKA</button>` :
                alreadyDone ?
                    `<div class="flex items-center gap-2 text-sky-600 font-black">Skor: ${alreadyDone.score}</div>` :
                    `<button onclick="startExam('${m}')" class="w-full py-4 bg-slate-900 text-white font-bold rounded-2xl hover:bg-sky-600 transition-all">MULAI UJIAN</button>`
            }
            </div>
        `;
    }).join('');
}

function showStudentInstructionModal() {
    const modal = document.getElementById('student-instruction-modal');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
}

function closeStudentInstructionModal() {
    const modal = document.getElementById('student-instruction-modal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}

function loadStudentExamProgress() {
    try {
        const saved = localStorage.getItem(STUDENT_EXAM_PROGRESS_KEY);
        return saved ? JSON.parse(saved) : null;
    } catch (e) {
        console.warn('[loadStudentExamProgress] Failed to load saved student exam progress:', e.message);
        return null;
    }
}

function saveStudentExamProgress() {
    if (!currentSiswa || currentSiswa.role !== 'student' || !examData || !examData.mapel) return;
    let checkpoint = null;

    if (examData.adminSavedProgress && examData.adminSavedProgress.answers) {
        checkpoint = {
            studentId: currentSiswa.id,
            studentName: currentSiswa.name,
            rombel: currentSiswa.rombel,
            mapel: examData.mapel,
            currentIdx: examData.adminSavedProgress.currentIdx,
            answers: examData.adminSavedProgress.answers,
            ragu: examData.adminSavedProgress.ragu || [],
            totalSeconds: examData.adminSavedProgress.totalSeconds || 0,
            remainingSeconds: examData.adminSavedProgress.remainingSeconds || 0,
            savedAt: examData.adminSavedProgress.savedAt || Date.now(),
            savedByAdminCommand: true,
            adminSaveConfirmed: true,
            adminSavedProgress: examData.adminSavedProgress
        };
    } else if (examData.savedByAdminCommand && examData.answers) {
        checkpoint = {
            studentId: currentSiswa.id,
            studentName: currentSiswa.name,
            rombel: currentSiswa.rombel,
            mapel: examData.mapel,
            currentIdx: examData.currentIdx,
            answers: examData.answers,
            ragu: examData.ragu || [],
            totalSeconds: examData.totalSeconds || examSecondsRemaining || 0,
            remainingSeconds: examSecondsRemaining,
            savedAt: Date.now(),
            savedByAdminCommand: true,
            adminSaveConfirmed: true
        };
    } else {
        return;
    }

    if (!checkpoint) return;
    try {
        localStorage.setItem(STUDENT_ADMIN_SAVED_PROGRESS_KEY, JSON.stringify(checkpoint));
        console.log('[saveStudentExamProgress] ✅ Checkpoint saved:', { currentIdx: checkpoint.currentIdx, answersCount: checkpoint.answers.length });
    } catch (e) {
        console.warn('[saveStudentExamProgress] Failed to persist admin checkpoint:', e.message);
    }
}

function loadAdminSavedProgress() {
    try {
        const saved = localStorage.getItem(STUDENT_ADMIN_SAVED_PROGRESS_KEY);
        return saved ? JSON.parse(saved) : null;
    } catch (e) {
        console.warn('[loadAdminSavedProgress] Failed to load admin saved progress:', e.message);
        return null;
    }
}

function clearStudentExamProgress() {
    try {
        localStorage.removeItem(STUDENT_EXAM_PROGRESS_KEY);
        localStorage.removeItem(STUDENT_ADMIN_SAVED_PROGRESS_KEY);
    } catch (e) {
        console.warn('[clearStudentExamProgress] Failed to clear exam progress:', e.message);
    }
}

async function getSavedStudentExamProgress(mapel = null) {
    const matchSaved = saved => {
        if (!saved || !saved.studentId || !saved.rombel || !saved.mapel || !Array.isArray(saved.answers)) return false;

        const norm = v => String(v || '').trim().toLowerCase();
        const idMatch = norm(saved.studentId) === norm(currentSiswa.id);
        const rombelMatch = norm(saved.rombel) === norm(currentSiswa.rombel);
        const mapelMatch = !mapel || norm(saved.mapel) === norm(mapel);

        if (!idMatch || !rombelMatch || !mapelMatch) return false;
        if (!saved.savedByAdminCommand && !saved.adminSaveConfirmed) return false;

        const hasAnswers = saved.answers.length > 0;
        if (!hasAnswers) {
            console.log('[matchSaved] Checkpoint found but has 0 answers, ignoring.');
            return false;
        }
        return true;
    };

    if (navigator.onLine && typeof fetchLiveExamsFromServer === 'function') {
        try {
            if (mapel) {
                console.log('[getSavedStudentExamProgress] Checking server for checkpoint:', currentSiswa.id, 'mapel:', mapel);
                try {
                    const url = getApiBaseUrl() + `/api/saved-exam/${encodeURIComponent(currentSiswa.id)}/${encodeURIComponent(mapel)}?rombel=${encodeURIComponent(currentSiswa.rombel)}`;
                    const res = await fetch(url);
                    if (res.ok) {
                        const data = await res.json();
                        if (data.ok && data.exam) {
                            const exact = data.exam;
                            console.log('[getSavedStudentExamProgress] ✅ Found server checkpoint');
                            const saved = {
                                studentId: exact.studentId,
                                studentName: exact.studentName,
                                rombel: exact.rombel,
                                mapel: exact.mapel,
                                currentIdx: Number.isInteger(exact.adminSavedProgress?.currentIdx) ? exact.adminSavedProgress.currentIdx : 0,
                                answers: exact.adminSavedProgress?.answers || [],
                                ragu: Array.isArray(exact.adminSavedProgress?.ragu) ? exact.adminSavedProgress.ragu : [],
                                remainingSeconds: Number(exact.adminSavedProgress?.remainingSeconds) || Number(exact.adminSavedProgress?.timeRemaining) || 0,
                                totalSeconds: Number(exact.adminSavedProgress?.totalSeconds) || 0,
                                savedAt: exact.adminSavedProgress?.savedAt || Date.now(),
                                source: 'server_checkpoint',
                                savedByAdminCommand: true,
                                adminSaveConfirmed: true
                            };
                            return saved;
                        } else {
                            console.log('[getSavedStudentExamProgress] 🗑️ Server has no checkpoint. Clearing local cache for consistency.');
                            clearStudentExamProgress();
                        }
                    }
                } catch (e2) {
                    console.warn('[getSavedStudentExamProgress] Specific endpoint failed:', e2.message);
                }
            }
        } catch (e) {
            console.warn('[getSavedStudentExamProgress] Server check failed:', e.message);
        }
    }

    const localSaved = loadAdminSavedProgress();
    console.log('[getSavedStudentExamProgress] Local saved:', !!localSaved);
    if (localSaved && matchSaved(localSaved)) {
        console.log('[getSavedStudentExamProgress] ✅ Using local saved progress');
        return { ...localSaved, source: 'localStorage' };
    }

    console.log('[getSavedStudentExamProgress] ❌ No saved progress found anywhere');
    return null;
}

async function resumeStudentExam(saved) {
    if (!saved || !saved.mapel || !Array.isArray(saved.answers)) return false;
    console.log('[resumeStudentExam] Resuming exam from saved progress:', { mapel: saved.mapel, currentIdx: saved.currentIdx, answersCount: saved.answers.length, source: saved.source });

    const questions = db.questions.filter(q => q.mapel === saved.mapel && q.rombel === currentSiswa.rombel);
    if (!questions.length) {
        console.warn('[resumeStudentExam] No questions found for mapel:', saved.mapel);
        clearStudentExamProgress();
        return false;
    }

    const normalizedQuestions = questions.map(q => ({ ...q, type: q.type || 'single' }));
    const answers = saved.answers.slice(0, normalizedQuestions.length);
    const ragu = Array.isArray(saved.ragu) ? saved.ragu : normalizedQuestions.map(() => false);

    const timeLimits = db.timeLimits || {};
    const key = `${currentSiswa.rombel}|${saved.mapel}`.toLowerCase().trim();
    const totalSeconds = (timeLimits[key] || 60) * 60;
    let remainingSeconds = Number(saved.remainingSeconds) || Number(saved.timeRemaining) || totalSeconds;
    if (remainingSeconds <= 0) remainingSeconds = totalSeconds;

    examData = {
        mapel: saved.mapel,
        questions: normalizedQuestions,
        currentIdx: Number.isInteger(saved.currentIdx) ? saved.currentIdx : 0,
        answers,
        ragu,
        timer: null,
        totalSeconds,
    };

    if (typeof showToast === 'function') {
        showToast(`✅ Progres ujian ${saved.mapel} dipulihkan! Anda dapat melanjutkan pengerjaan soal.`, 'success');
    }

    isExamActive = true;
    cheatingCount = 0;
    examSecondsRemaining = remainingSeconds;
    examStartTime = Date.now() - ((totalSeconds - remainingSeconds) * 1000);

    const studentExamList = document.getElementById('student-exam-list');
    const examScreen = document.getElementById('exam-screen');
    if (studentExamList) studentExamList.classList.add('hidden');
    if (examScreen) examScreen.classList.remove('hidden');
    const meta = document.getElementById('exam-meta');
    if (meta) meta.innerText = `${saved.mapel} | ${currentSiswa.rombel}`;

    if (typeof showQuestion === 'function') showQuestion(examData.currentIdx);
    if (examSecondsRemaining > 0 && typeof startTimer === 'function') {
        startTimer(examSecondsRemaining);
    }
    if (typeof updateLiveExamStatus === 'function') updateLiveExamStatus(true);
    if (typeof liveExamInterval !== 'undefined' && liveExamInterval) clearInterval(liveExamInterval);
    if (typeof updateLiveExamStatus === 'function') {
        liveExamInterval = setInterval(() => updateLiveExamStatus(true), 1000);
    }

    if (navigator.onLine && typeof fetchLiveExamsFromServer === 'function') {
        setTimeout(async () => {
            try {
                const serverLiveExams = await fetchLiveExamsFromServer();
                await processAdminCommandsOnStudent(serverLiveExams);
            } catch (e) {
                console.warn('[resumeStudentExam] Error checking admin commands:', e.message);
            }
        }, 500);
    }

    const existingIndex = (db.activeExams || []).findIndex(e => e.studentId === currentSiswa.id && e.rombel === currentSiswa.rombel && e.mapel === examData.mapel);
    const resumeEntry = {
        studentId: currentSiswa.id,
        studentName: currentSiswa.name,
        rombel: currentSiswa.rombel,
        mapel: examData.mapel,
        currentIdx: examData.currentIdx,
        answers,
        ragu,
        totalSeconds: examData.totalSeconds,
        remainingSeconds: examSecondsRemaining,
        updatedAt: Date.now(),
        isActive: true
    };
    if (!Array.isArray(db.activeExams)) db.activeExams = [];
    if (existingIndex >= 0) {
        db.activeExams[existingIndex] = { ...db.activeExams[existingIndex], ...resumeEntry };
    } else {
        db.activeExams.push(resumeEntry);
    }
    try {
        if (typeof saveLocalDb === 'function') await saveLocalDb();
    } catch (err) {
        console.warn('[resumeStudentExam] failed to save local active exam:', err.message || err);
    }

    saveStudentExamProgress();
    return true;
}

async function restoreStudentExamProgress() {
    console.log('[restoreStudentExamProgress] START - Checking for saved exam data...');

    if (!currentSiswa || currentSiswa.role !== 'student') {
        console.log('[restoreStudentExamProgress] SKIP - Not a student or no current user');
        return false;
    }

    const saved = await getSavedStudentExamProgress();

    if (!saved || !saved.mapel || !Array.isArray(saved.answers)) {
        console.log('[restoreStudentExamProgress] ❌ Tidak ada data untuk restore.');
        return false;
    }

    console.log('[restoreStudentExamProgress] ✅ Found saved data, resuming exam...');
    return await resumeStudentExam(saved);
}

async function processAdminCommandsOnStudent(liveExams) {
    if (!currentSiswa || currentSiswa.role !== 'student' || !examData || !examData.mapel) return;
    if (!Array.isArray(liveExams)) return;

    const norm = v => String(v || '').trim().toLowerCase();
    const sid = norm(currentSiswa.id);
    const srb = norm(currentSiswa.rombel);
    const smp = norm(examData.mapel);

    const commandEntry = liveExams.find(e =>
        norm(e.studentId) === sid &&
        norm(e.rombel) === srb &&
        norm(e.mapel) === smp
    );
    if (!commandEntry) return;

    let updated = false;

    if (commandEntry.adminSaveRequest) {
        console.log('[Student] ADMIN SAVE REQUEST DETECTED - Forcing latest exam state save');
        commandEntry.adminSaveRequest = false;
        commandEntry.adminSaveConfirmed = true;
        commandEntry.savedByAdminCommand = true;

        if (commandEntry.adminSavedProgress) {
            examData.adminSavedProgress = commandEntry.adminSavedProgress;
            examData.currentIdx = commandEntry.adminSavedProgress.currentIdx;
            examData.answers = commandEntry.adminSavedProgress.answers;
            examData.ragu = commandEntry.adminSavedProgress.ragu || [];
            examData.totalSeconds = commandEntry.adminSavedProgress.totalSeconds || 0;
            if (typeof examSecondsRemaining !== 'undefined') {
                examSecondsRemaining = commandEntry.adminSavedProgress.remainingSeconds || 0;
            }
        }

        examData.savedByAdminCommand = true;
        updated = true;
        saveStudentExamProgress();
        if (typeof showToast === 'function') showToast('✅ Admin menyimpan jawaban Anda. Data terbaru telah dikirim ke server.', 'success');
    }

    if (commandEntry.adminReloadRequest && String(commandEntry.adminReloadRequest) !== sessionStorage.getItem('last_reload_cmd')) {
        console.log('[Student] Admin reload request received - ID:', commandEntry.adminReloadRequest);
        sessionStorage.setItem('last_reload_cmd', commandEntry.adminReloadRequest);
        saveStudentExamProgress();
        updated = true;
        if (typeof showToast === 'function') showToast('Perintah reload diterima. Memuat ulang...', 'info');
        setTimeout(() => location.reload(), 1000);
    }

    if (commandEntry.adminDeleteCheckpoint || commandEntry.adminClearRequest) {
        const lastCmd = sessionStorage.getItem('last_clear_cmd');
        if (String(commandEntry.adminClearRequest) !== lastCmd) {
            sessionStorage.setItem('last_clear_cmd', String(commandEntry.adminClearRequest));
            console.log('[Student] ADMIN CLEAR REQUEST DETECTED - Wiping answers');
            clearStudentExamProgress();
            if (Array.isArray(examData.answers)) {
                examData.answers = examData.answers.map(ans => {
                    if (Array.isArray(ans)) return [];
                    if (typeof ans === 'string') return '';
                    return null;
                });
            }
            if (typeof showQuestion === 'function') showQuestion(examData.currentIdx || 0);
            if (typeof updateQuestionStatus === 'function') updateQuestionStatus();
            if (typeof showToast === 'function') showToast('⚠️ Admin telah mengosongkan jawaban Anda.', 'warning');
        }
    }
}



